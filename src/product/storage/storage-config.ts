import { AzureBlobObjectStore } from "./azure-blob-store.js";
import { LocalObjectStore, ObjectStoreError, type ObjectStore } from "./object-store.js";
import { S3ObjectStore } from "./s3-store.js";

// What the interface offers and what each one needs. One row per backend, so
// adding a service is a row rather than a branch in four places.

export type StorageBackendId = "local" | "s3" | "r2" | "gcs" | "minio" | "azure";

export interface StorageField {
  key: string;
  label: string;
  envKey: string;
  required: boolean;
  secret?: boolean | undefined;
  placeholder?: string | undefined;
}

export interface StorageBackend {
  id: StorageBackendId;
  label: string;
  /** What it is and anything that will surprise them after they pick it. */
  note: string;
  fields: StorageField[];
}

const S3_FIELDS: StorageField[] = [
  { key: "bucket", label: "Bucket", envKey: "STORAGE_BUCKET", required: true },
  { key: "region", label: "Region", envKey: "STORAGE_REGION", required: false, placeholder: "us-east-1" },
  { key: "accessKeyId", label: "Access key ID", envKey: "STORAGE_ACCESS_KEY_ID", required: true, secret: true },
  { key: "secretAccessKey", label: "Secret access key", envKey: "STORAGE_SECRET_ACCESS_KEY", required: true, secret: true },
  { key: "prefix", label: "Prefix", envKey: "STORAGE_PREFIX", required: false, placeholder: "citegeo" },
];

const ENDPOINT: StorageField = { key: "endpoint", label: "Endpoint", envKey: "STORAGE_ENDPOINT", required: true };

export const STORAGE_BACKENDS: StorageBackend[] = [
  {
    id: "local",
    label: "This machine",
    note: "Files on disk beside the server. Needs nothing configured, and is the only option that survives with no network.",
    fields: [{ key: "rootDir", label: "Directory", envKey: "PRODUCT_DATA_DIR", required: false, placeholder: "data/product-v2" }],
  },
  {
    id: "s3",
    label: "Amazon S3",
    note: "A bucket in your own AWS account. The key needs GetObject, PutObject, DeleteObject and ListBucket on it, and nothing else.",
    fields: S3_FIELDS,
  },
  {
    id: "r2",
    label: "Cloudflare R2",
    note: "S3-compatible with no egress fee. The endpoint is https://ACCOUNT_ID.r2.cloudflarestorage.com and the region is auto.",
    fields: [...S3_FIELDS, ENDPOINT],
  },
  {
    id: "gcs",
    label: "Google Cloud Storage",
    note: "Through its S3-compatible API, so it needs an HMAC key from the console rather than a service account JSON. The endpoint is https://storage.googleapis.com.",
    fields: [...S3_FIELDS, ENDPOINT],
  },
  {
    id: "minio",
    label: "MinIO or other S3-compatible",
    note: "Anything speaking the S3 API, including Spaces and Backblaze B2. Most need path-style addressing.",
    fields: [...S3_FIELDS, ENDPOINT, { key: "forcePathStyle", label: "Path-style addressing", envKey: "STORAGE_FORCE_PATH_STYLE", required: false, placeholder: "true" }],
  },
  {
    id: "azure",
    label: "Azure Blob Storage",
    note: "A container in your own storage account, signed with the account key from Access keys in the portal.",
    fields: [
      { key: "account", label: "Storage account", envKey: "STORAGE_AZURE_ACCOUNT", required: true },
      { key: "container", label: "Container", envKey: "STORAGE_AZURE_CONTAINER", required: true },
      { key: "accountKey", label: "Account key", envKey: "STORAGE_AZURE_KEY", required: true, secret: true },
      { key: "prefix", label: "Prefix", envKey: "STORAGE_PREFIX", required: false },
    ],
  },
];

export function storageBackend(id: string): StorageBackend | undefined {
  return STORAGE_BACKENDS.find((row) => row.id === id);
}

export interface StorageSettings {
  backend: StorageBackendId;
  values: Record<string, string>;
}

function required(backend: StorageBackend, values: Record<string, string>): string[] {
  return backend.fields.filter((field) => field.required && !(values[field.key] || "").trim()).map((field) => field.label);
}

/** Builds the store, or says exactly which field is missing. */
export function createObjectStore(settings: StorageSettings, fallbackRoot: string): ObjectStore {
  const backend = storageBackend(settings.backend);
  if (!backend) throw new ObjectStoreError(`Unknown storage backend "${settings.backend}".`);
  const values = settings.values || {};
  const missing = required(backend, values);
  if (missing.length) throw new ObjectStoreError(`${backend.label} needs ${missing.join(", ")}.`);

  if (backend.id === "local") return new LocalObjectStore(values.rootDir?.trim() || fallbackRoot);
  if (backend.id === "azure") {
    return new AzureBlobObjectStore({
      account: values.account as string,
      container: values.container as string,
      accountKey: values.accountKey as string,
      prefix: values.prefix,
      endpoint: values.endpoint,
    });
  }
  return new S3ObjectStore({
    bucket: values.bucket as string,
    region: values.region || (backend.id === "r2" ? "auto" : "us-east-1"),
    accessKeyId: values.accessKeyId as string,
    secretAccessKey: values.secretAccessKey as string,
    endpoint: values.endpoint,
    // Every non-AWS service here is reached by path, and AWS is not.
    forcePathStyle: backend.id === "minio" ? values.forcePathStyle !== "false" : backend.id !== "s3",
    prefix: values.prefix,
  });
}

export interface StorageCheck {
  ok: boolean;
  backend: StorageBackendId;
  describes: string;
  detail: string;
}

/**
 * Writes, reads back, lists and deletes a probe object. Anything less reports
 * a connection that will fail on the first real write.
 */
export async function checkObjectStore(store: ObjectStore): Promise<StorageCheck> {
  const key = `.citegeo-check/${Date.now()}.json`;
  const body = `{"probe":"${Date.now()}"}`;
  const backend = "local" as StorageBackendId;
  try {
    await store.put(key, body);
    const read = await store.get(key);
    if (read !== body) throw new ObjectStoreError("The object read back did not match what was written.");
    const listed = await store.list(".citegeo-check");
    if (!listed.includes(key)) throw new ObjectStoreError("The object was written but did not appear in a listing, so reads of past runs will come back empty.");
    await store.delete(key);
    return { ok: true, backend, describes: store.describe(), detail: "Wrote, read back, listed and deleted a probe object." };
  } catch (error) {
    await store.delete(key).catch(() => undefined);
    return { ok: false, backend, describes: store.describe(), detail: error instanceof Error ? error.message : String(error) };
  }
}
