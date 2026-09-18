# Upgrade, backup, and rollback

Markdown cases can be read directly, with no second service required. Retiring the case-specific preview never changes the regular product's data, run API, reports, or charts, and it does not mean any old case archive is deleted.

Applies to: the current product candidate **v0.2.0-rc.1, UNPUBLISHED**. rc4 has been built and its backup read verified, along with verifying that the backup copy reopens in the previous local candidate; no image has been publicly released. The final mapping is in the local `release-manifest.json` (a local private record, not public: `../validation/release-v0.2.0-rc.1/release-manifest.json`); that private path is not a public download address. See [Docker deployment](deployment/docker.md) for image preparation.

## Copy restoration already performed

The latest rc4's create, restart, archive/restore, delete-then-refresh, arm64 backup read, and old-candidate rollback read are recorded in `supplementary acceptance B08` (a local private record, not public: `../validation/release-v0.2.0-rc.1/additional-1788852792205/report.json`). Every operation used an isolated directory with no provider inference. The older records below keep their original identity and are not overwritten by this round's failure history.

`rollback-check.json` (a local private record, not public: `../validation/release-v0.2.0-rc.1/rollback-check.json`) records one real copy-and-reopen: an isolated backup copied from `container-lifecycle-1788847664760/backup`, reopened in a container, reading back the original two projects. It records `passed: true`, `providerCalls: 0`, with `beforeHash` and `afterHash` both `d4f18ca5944704415b574f0616941bd5ef1b5305c2f987c3dce7263efacaa69c`.

The companion `amd64 lifecycle record` (a local private record, not public: `../validation/release-v0.2.0-rc.1/container-lifecycle-1788847664760/report.json`) recorded, under Docker Desktop emulation, project creation, restart persistence, archive/restore, a delete followed by a refresh that did not resurrect it, and a query/resource read — 7 items passed. An earlier `async-state-assertion-failure cycle` (a local private record, not public: `../validation/release-v0.2.0-rc.1/container-lifecycle-1788846686256/report.json`) is still kept; a later pass does not overwrite the original failure record.

The evidence above targets the candidate and isolated data copy of that moment. Neither the old nor the new acceptance ever touched a real user's sole copy of their data, and neither proves a schema upgrade/downgrade between arbitrary versions, coverage of all historical data, or native amd64 hardware. What follows is the procedure for a future upgrade; the read results from this round's two local candidates must never be generalized into a universal migration guarantee.

## First confirm which product generation the data belongs to

The current product entry point is `src/product/product-server.ts`, with default data at `data/product-v2`. The old `runs/` and the old `data/projects/` are never auto-imported, and there is no accepted automatic legacy-to-product-v2 migration command.

When upgrading from the old alpha, keep the old image/source, the old directory, and its run configuration, and use a separate `product-v2` directory for the new product. Do not rename an old `audit.json` into a new run, and do not generate a D/K observation that never happened just to fill in a new field. The old CLI's `import-runs`/`monitor-worker` must never be assumed, by name alone, to be the new product's migration/scheduling tool.

Existing `product-v2` data needs the relationship between project, configuration, raw text, and derived results kept intact as a whole. See [architecture](ARCHITECTURE.md) for the storage layout in detail. The current file read is mainly JSON parsing plus a parent-ID check; it does not include a framework that automatically migrates every historical schema.

## What to record before upgrading

- The running image ID/digest, a list of product source and working-tree changes, and the actual server/worker command.
- `PRODUCT_DATA_DIR`'s resolved value, volume path, permissions, `PORT`, and secret file paths; never record a key's actual value.
- The project list with archived/deleted status, each project's `activeBaselineId`, current model selection, and WatchSet.
- Every running/queued recognition and measurement run, each task's status/`nextRunAt`, and its occurrence and ledger.
- The IDs of old reports that still open, their `sourceAttemptMap`, and a few representative raw texts and file hashes.

Any currently uncommitted file is part of the candidate source that needs checking; recording HEAD alone is not enough to describe an image's contents, and the product's source commit cannot yet be called frozen. The final manifest must record the dirty source, the build-context hash, the dependency lockfile, `tsconfig`, the Dockerfile/ignore rules, the brand assets, and the matching OCI image. Never reset, clean, or auto-commit someone else's changes in a shared working tree.

## Stop writes and back up

1. Use the product's task-pause endpoint to pause any task that should not run before recovery, recording its original status and time. Pausing does not cancel an in-flight request.
2. Wait for every recognition/measurement run to reach its final state, confirm the worker is no longer dispatching new requests, then stop the worker and the server. A response not yet archived when the process exits may be unrecoverable.
3. Back up the entire product data root directory and the deployment configuration; back up keys separately through the existing secrets-management method. If legacy data is kept, save its directory too, but never mix it into the public evidence bundle.
4. Compute a SHA-256 of the backup and unpack it in a separate path to check it; never trial a migration against the sole production copy.

The commands below only demonstrate a stopped-write bind mount of the default `./data/product-v2`; complete the stop-writes steps above first. `BACKUP_STAMP` is this backup's own identifier, not a candidate version number:

```sh
BACKUP_STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p ./backups
tar -czf "./backups/product-v2-${BACKUP_STAMP}.tar.gz" -C ./data product-v2
shasum -a 256 "./backups/product-v2-${BACKUP_STAMP}.tar.gz"
mkdir -p "./restore-check/${BACKUP_STAMP}"
tar -xzf "./backups/product-v2-${BACKUP_STAMP}.tar.gz" -C "./restore-check/${BACKUP_STAMP}"
```

The hash in the backup output is the compressed file's own byte hash; separately keep the evidence index for the project JSON/raw responses. On Linux, `sha256sum` computes the same algorithm. When the configuration uses a different root directory or a Docker named volume, back up the actual mount source — never mechanically back up an empty default directory.

A file write is a single-file atomic replace, not a cross-file transaction, and a live `tar` cannot guarantee a run/attempt/result are all captured at the same instant. A temp file or a leftover lock may end up in the backup too; do not delete a lock directly — first confirm no process still holds it, and record any manual handling.

## Accept the candidate against a copy

Point the candidate server at the unpacked, separate `product-v2` directory, on a different host port, **without starting the worker and without injecting a provider key**. This lets existing data reads and local report/statistics operations be checked without letting an active task in the backup fire its own requests. The product may still request the model catalog; that is not model inference.

Check and record the actual result, in this order:

1. The project count and archived/deleted status match the backup, with no auto-imported public case or default project appearing.
2. The original configuration version, WatchSet, reports, and historical models still exist, and an old report opens without re-running a model.
3. The raw attempt, response, citation path, field evidence, and hash match the backup; a change in local parsing must never overwrite the raw text.
4. Check the actual display of `no_data`, `partial`, a provider failure, and `unknown`; old data with a missing field must stay unknown.
5. Check a task's next time and its occurrence, confirming that resuming the worker does not unexpectedly backfill runs or get stuck on an old due time.
6. Verify create/archive/soft-delete/restore/purge and a container rebuild against a second copy; never run a destructive check against the sole backup.

These are acceptance requirements; where no execution record exists, mark it "unverified." The current chart cache is keyed only by ID, so a candidate's code being able to read an old snapshot must never be used to assert a formula has been recomputed. Compatibility with an old layout such as `recognition-archive.json` should also be checked against the actual read code and an isolated copy, rather than assuming every historical format migrates.

## Switch over and resume tasks

Once the final copy passes acceptance and the release manifest confirms the image's contents, replace the product process with the accepted image from the manifest, still pointed at the original production `product-v2` data. Start only the server first, confirm `/health`, the pages, the SVGs, the projects, and the evidence, before handling tasks. A registry deployment uses the manifest's index digest; never let an image rebuilt by a workflow pass itself off as the same binary as the old candidate.

A model-selection change needs a new baseline; a new baseline needs its own new WatchSet. When a task is incompatible with the old baseline, recheck its scope and budget rather than simply flipping the JSON status back to `active`. A gap remains between a task's stored `watchSetId` and its scope at execution time; recheck task by task before resuming.

Record which tasks should continue, then resume them one at a time; never default to starting every task in the backup. The worker currently has no complete automatic-recovery capability for a missed time or a leftover occurrence, so it cannot promise "everything correctly skipped during the upgrade outage" or "backfilled exactly once." See [limitations](limitations.md) for detail.

## Rollback

1. Pause new execution, wait for any already-sent request to finish, and stop the product process.
2. Make a separate backup of the post-upgrade data, keeping any attempt, cost, or error added in the meantime; never overwrite it directly with the old backup.
3. Start the rollback image recorded in the manifest, pointed at a separate restore directory holding the pre-upgrade backup. Confirm the old version reads correctly before switching the service entry point over; the final install's digest and this rollback's target must be recorded separately — never fill in the same mutable tag for both.
4. Restore only the server first, check the projects/raw text/citations, then resume tasks based on that check. Never hand new post-upgrade-schema data, unverified, to the old version to write.
5. Record the restore time, the rollback image, the data-copy path, and anything that still needs manual merging afterward. A rollback does not undo a provider cost that already happened.

If the old version is the legacy product, its engine and data directory must be restored as a pair; the new `product-v2` must never auto-downgrade into old `runs`. Never move an already-released immutable tag onto a different image, and never make an old report look consistent by overwriting the original answer. A pure documentation fix needs no model re-request; a change to the product's build input requires re-verifying the affected behavior.

This round's release status is still unpublished. The old candidate's copy-and-reopen already performed is evidenced by the `rollback-check` above; a final or cross-version rollback is recorded separately against its actual result. The exact product source, documentation version, install/rollback image digest, and acceptance scope are linked through the release manifest; until that manifest is complete, a dirty HEAD is never written up as a frozen product commit. See [known limitations](limitations.md) for other statistics, evidence, and scheduling limits.
