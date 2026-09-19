import { randomBytes, createCipheriv, createDecipheriv, randomUUID } from "node:crypto";
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

const ALGORITHM = "aes-256-gcm";

export interface StoredCredential {
  iv: string;
  tag: string;
  ciphertext: string;
  /** Enough to recognise which key this is, not enough to use it. */
  last4: string;
  updatedAt: string;
}

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

export function encryptSecret(key: Buffer, plaintext: string): StoredCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    last4: plaintext.slice(-4),
    updatedAt: new Date().toISOString(),
  };
}

/** Returns null rather than throwing when a record was tampered with. */
export function decryptSecret(key: Buffer, record: StoredCredential): string | null {
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(record.iv, "base64"));
    decipher.setAuthTag(Buffer.from(record.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
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
    await mkdir(this.dataDir, { recursive: true });
    const path = this.path();
    const temporary = `${path}.${randomUUID()}.tmp`;
    // Owner-only: the file holds ciphertext, but the mode is one more thing an
    // attacker with a shell would have to defeat.
    await writeFile(temporary, `${JSON.stringify(file, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, path);
  }
}
