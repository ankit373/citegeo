import { randomBytes, createCipheriv, createDecipheriv, createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Provider keys entered through the portal, encrypted at rest.
//
// Three rules hold this together:
//   1. Storage is refused unless CREDENTIAL_KEY is set, because encrypting with
//      a key regenerated each boot would lose the credential on restart and
//      encrypting with nothing is worse than being honest about it.
//   2. A stored key is never returned by any read. Callers get whether one is
//      set and its last four characters, which is enough to recognise it and
//      useless to anyone who steals the response.
//   3. The environment wins. A key set in .env is not editable here, so nobody
//      can edit a file, see no change, and conclude the app is broken.
//   4. A record is bound to the name it is filed under. Without that binding
//      the tag authenticates the bytes but not the slot, so anyone who can
//      write the file can move one provider's key into another's name and the
//      app will happily send it there.

const ALGORITHM = "aes-256-gcm";

export interface StoredCredential {
  iv: string;
  tag: string;
  ciphertext: string;
  /** Enough to recognise which key this is, not enough to use it. */
  last4: string;
  updatedAt: string;
  /** Absent on records written before the name was bound in. */
  version?: number;
  /** Which CREDENTIAL_KEY wrote this, so a changed key is reported as a
   * changed key rather than read as nothing being stored. */
  keyId?: string;
}

export const CREDENTIAL_VERSION = 2;

/** A one-way name for a key. Enough to tell two keys apart, useless for
 * recovering either. */
export function keyFingerprint(key: Buffer): string {
  return createHash("sha256").update("citegeo-credential-key-v1").update(key).digest("hex").slice(0, 16);
}

/** What a read found, so "nothing stored", "stored under another key" and
 * "tampered with" are three answers rather than one null. */
export type CredentialRead =
  | { state: "ok"; secret: string }
  | { state: "absent" }
  | { state: "wrong_key"; keyId: string }
  | { state: "unreadable" };

export type CredentialFile = Record<string, StoredCredential>;

export function credentialKey(): Buffer | null {
  const raw = process.env.CREDENTIAL_KEY?.trim();
  if (!raw) return null;
  for (const encoding of ["base64url", "base64", "hex"] as const) {
    try {
      const key = Buffer.from(raw, encoding);
      if (key.length === 32) return key;
    } catch {
      continue;
    }
  }
  return null;
}

export function encryptSecret(key: Buffer, plaintext: string, name = ""): StoredCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  // The slot name is authenticated but not encrypted, so a record moved to
  // another name fails its tag instead of decrypting into the wrong caller.
  if (name) cipher.setAAD(Buffer.from(name, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    last4: plaintext.slice(-4),
    updatedAt: new Date().toISOString(),
    version: CREDENTIAL_VERSION,
    keyId: keyFingerprint(key),
  };
}

/** Returns null rather than throwing when a record was tampered with. A record
 * written before versioning carries no name binding, so none is required. */
export function decryptSecret(key: Buffer, record: StoredCredential, name = ""): string | null {
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(record.iv, "base64"));
    decipher.setAuthTag(Buffer.from(record.tag, "base64"));
    if (name && (record.version || 1) >= 2) decipher.setAAD(Buffer.from(name, "utf8"));
    const plain = Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

/** The same read, with the reason when it fails. A rotated key looks exactly
 * like an empty store otherwise, and somebody re-enters every credential. */
export function readSecret(key: Buffer, record: StoredCredential | undefined, name = ""): CredentialRead {
  if (!record) return { state: "absent" };
  const secret = decryptSecret(key, record, name);
  if (secret !== null) return { state: "ok", secret };
  if (record.keyId && record.keyId !== keyFingerprint(key)) return { state: "wrong_key", keyId: record.keyId };
  return { state: "unreadable" };
}

function notFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

export class CredentialFileStore {
  constructor(private readonly dataDir: string) {}

  private path(): string {
    return join(this.dataDir, "credentials.json");
  }

  async read(): Promise<CredentialFile> {
    try {
      return JSON.parse(await readFile(this.path(), "utf8")) as CredentialFile;
    } catch (error) {
      if (notFound(error)) return {};
      return {};
    }
  }

  async write(file: CredentialFile): Promise<void> {
    // Owner-only on the directory too: the file is 0600, but a world-readable
    // directory still tells anyone which providers are configured.
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    const path = this.path();
    const temporary = `${path}.${randomUUID()}.tmp`;
    // Owner-only: the file holds ciphertext, but the mode is one more thing an
    // attacker with a shell would have to defeat.
    await writeFile(temporary, `${JSON.stringify(file, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  }
}
