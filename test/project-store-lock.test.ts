import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ProductProjectFileStore } from "../src/product/projects/project-store.js";
import { sha256 } from "../src/utils/hash.js";

test("a failed lock release does not hide the operation's own error", async () => {
  const root = await mkdtemp(join(tmpdir(), "citegeo-lock-"));
  try {
    const store = new ProductProjectFileStore(root);
    const lockPath = join(root, "locks", `${sha256("example.com")}.lock`);
    await assert.rejects(
      store.withDomainLock("example.com", async () => {
        // A non-empty directory in place of the file makes unlink fail.
        await unlink(lockPath);
        await mkdir(lockPath);
        await writeFile(join(lockPath, "keep"), "x");
        throw new Error("the operation failed");
      }),
      (error: Error) => error.message === "the operation failed",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
