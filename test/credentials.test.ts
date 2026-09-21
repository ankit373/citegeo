import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CredentialFileStore, credentialKey, decryptSecret, encryptSecret } from "../src/product/auth/credential-store.js";
import { CredentialService } from "../src/product/auth/credential-service.js";

const KEY_B64 = Buffer.alloc(32, 7).toString("base64");
const SECRET = "sk-or-v1-abcdefghijklmnop";

function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return run().finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

async function withStore(run: (store: CredentialFileStore, dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "citegeo-cred-"));
  try {
    await run(new CredentialFileStore(dir), dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("a round trip returns the original secret", () => {
  const key = Buffer.alloc(32, 1);
  const record = encryptSecret(key, SECRET);
  assert.equal(decryptSecret(key, record), SECRET);
});

test("the ciphertext does not contain the secret", () => {
  const record = encryptSecret(Buffer.alloc(32, 1), SECRET);
  assert.equal(JSON.stringify(record).includes(SECRET), false);
  assert.equal(record.last4, "mnop");
});

test("a tampered record decrypts to null rather than throwing", () => {
  const key = Buffer.alloc(32, 1);
  const record = encryptSecret(key, SECRET);
  const swapped = Buffer.from(record.ciphertext, "base64");
  swapped[0] = swapped[0]! ^ 0xff;
  assert.equal(decryptSecret(key, { ...record, ciphertext: swapped.toString("base64") }), null);
});

test("a different key cannot read the record", () => {
  const record = encryptSecret(Buffer.alloc(32, 1), SECRET);
  assert.equal(decryptSecret(Buffer.alloc(32, 2), record), null);
});

test("two encryptions of one secret differ, so the iv is not reused", () => {
  const key = Buffer.alloc(32, 1);
  assert.notEqual(encryptSecret(key, SECRET).ciphertext, encryptSecret(key, SECRET).ciphertext);
});

test("only a 32 byte key is accepted", async () => {
  await withEnv({ CREDENTIAL_KEY: KEY_B64 }, async () => assert.equal(credentialKey()?.length, 32));
  await withEnv({ CREDENTIAL_KEY: "too-short" }, async () => assert.equal(credentialKey(), null));
  await withEnv({ CREDENTIAL_KEY: undefined }, async () => assert.equal(credentialKey(), null));
});

test("storage is refused when no credential key is set", async () => {
  await withStore(async (store) => {
    await withEnv({ CREDENTIAL_KEY: undefined, OPENROUTER_API_KEY: undefined }, async () => {
      const result = await new CredentialService(store).save("openrouter", SECRET);
      assert.equal(result.outcome, "storage_disabled");
    });
  });
});

test("the environment owns a provider it has a key for", async () => {
  await withStore(async (store) => {
    await withEnv({ CREDENTIAL_KEY: KEY_B64, OPENROUTER_API_KEY: "sk-from-env-1234" }, async () => {
      const service = new CredentialService(store);
      const [status] = await service.status(["openrouter"]);
      assert.equal(status?.source, "environment");
      assert.equal(status?.editable, false);
      assert.equal(status?.last4, "1234");

      const write = await service.save("openrouter", SECRET);
      assert.equal(write.outcome, "owned_by_environment", "a stored value would be ignored, so it is refused");
    });
  });
});

test("a stored key is used when the environment has none", async () => {
  await withStore(async (store) => {
    await withEnv({ CREDENTIAL_KEY: KEY_B64, OPENROUTER_API_KEY: undefined, OPENROUTER_KEY: undefined }, async () => {
      const service = new CredentialService(store);
      assert.equal((await service.save("openrouter", SECRET)).outcome, "saved");
      assert.equal(await service.resolve("openrouter"), SECRET);

      const [status] = await service.status(["openrouter"]);
      assert.equal(status?.source, "stored");
      assert.equal(status?.last4, "mnop");
    });
  });
});

test("status never carries the key itself", async () => {
  await withStore(async (store) => {
    await withEnv({ CREDENTIAL_KEY: KEY_B64, OPENROUTER_API_KEY: undefined, OPENROUTER_KEY: undefined }, async () => {
      const service = new CredentialService(store);
      await service.save("openrouter", SECRET);
      const status = await service.status(["openrouter"]);
      assert.equal(JSON.stringify(status).includes(SECRET), false);
    });
  });
});

test("something too short to be a key is refused before it is stored", async () => {
  await withStore(async (store) => {
    await withEnv({ CREDENTIAL_KEY: KEY_B64, OPENROUTER_API_KEY: undefined, OPENROUTER_KEY: undefined }, async () => {
      const service = new CredentialService(store);
      assert.equal((await service.save("openrouter", "short")).outcome, "rejected");
      assert.equal((await service.save("openrouter", 42)).outcome, "rejected");
      assert.equal(await service.resolve("openrouter"), null);
    });
  });
});

test("clearing removes the stored key", async () => {
  await withStore(async (store) => {
    await withEnv({ CREDENTIAL_KEY: KEY_B64, OPENROUTER_API_KEY: undefined, OPENROUTER_KEY: undefined }, async () => {
      const service = new CredentialService(store);
      await service.save("openrouter", SECRET);
      assert.equal((await service.clear("openrouter")).outcome, "cleared");
      assert.equal(await service.resolve("openrouter"), null);
    });
  });
});

test("the credentials file is written owner-only", async () => {
  await withStore(async (store, dir) => {
    await withEnv({ CREDENTIAL_KEY: KEY_B64, OPENROUTER_API_KEY: undefined, OPENROUTER_KEY: undefined }, async () => {
      await new CredentialService(store).save("openrouter", SECRET);
      const mode = (await stat(join(dir, "credentials.json"))).mode & 0o777;
      assert.equal(mode, 0o600, `expected 0600, saw ${mode.toString(8)}`);
      const raw = await readFile(join(dir, "credentials.json"), "utf8");
      assert.equal(raw.includes(SECRET), false, "the file holds ciphertext only");
    });
  });
});

test("a record moved into another provider's name is refused, not decrypted into it", () => {
  const key = Buffer.alloc(32, 7);
  const stolen = encryptSecret(key, "sk-openrouter-live-9999", "openrouter");
  // Anyone who can write credentials.json could otherwise file OpenRouter's
  // key under google and the app would send it to Google.
  assert.equal(decryptSecret(key, stolen, "google"), null);
  assert.equal(decryptSecret(key, stolen, "openrouter"), "sk-openrouter-live-9999");
});

test("a record written before the name was bound in still opens", () => {
  const key = Buffer.alloc(32, 7);
  const legacy = encryptSecret(key, "older-secret-1234");
  delete (legacy as { version?: number }).version;
  delete (legacy as { keyId?: string }).keyId;
  assert.equal(decryptSecret(key, legacy, "openrouter"), "older-secret-1234", "upgrading must not orphan what is already stored");
});

test("a rotated key is reported as a rotated key, not as an empty store", async () => {
  const { readSecret, keyFingerprint } = await import("../src/product/auth/credential-store.js");
  const wrote = Buffer.alloc(32, 1);
  const now = Buffer.alloc(32, 2);
  const record = encryptSecret(wrote, "secret-abcd", "google");

  assert.deepEqual(readSecret(wrote, record, "google"), { state: "ok", secret: "secret-abcd" });
  assert.deepEqual(readSecret(now, record, "google"), { state: "wrong_key", keyId: keyFingerprint(wrote) });
  assert.deepEqual(readSecret(wrote, undefined, "google"), { state: "absent" });

  const tampered = { ...record, ciphertext: Buffer.from("not the ciphertext").toString("base64") };
  assert.deepEqual(readSecret(wrote, tampered, "google"), { state: "unreadable" });
});

test("the key fingerprint names a key without being reversible to it", async () => {
  const { keyFingerprint } = await import("../src/product/auth/credential-store.js");
  const one = keyFingerprint(Buffer.alloc(32, 1));
  const two = keyFingerprint(Buffer.alloc(32, 2));
  assert.notEqual(one, two);
  assert.equal(one, keyFingerprint(Buffer.alloc(32, 1)));
  assert.equal(one.length, 16);
  assert.equal(one.includes(Buffer.alloc(32, 1).toString("hex")), false);
});

test("a stored record never carries the secret in the clear beyond its last four", () => {
  const record = encryptSecret(Buffer.alloc(32, 3), "ghp_verysecrettokenvalue", "github");
  const serialised = JSON.stringify(record);
  assert.equal(serialised.includes("verysecret"), false);
  assert.equal(record.last4, "alue");
});
