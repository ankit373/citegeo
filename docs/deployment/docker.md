# Docker deployment

## CiteGEO v0.2.0

The formal image is `ghcr.io/ankit373/citegeo:v0.2.0`, supporting Linux amd64 and arm64. Set `OPENROUTER_API_KEY` in the host environment first, then run:

```bash
docker pull ghcr.io/ankit373/citegeo:v0.2.0
docker run -d --name citegeo \
  -p 127.0.0.1:8787:8787 \
  -e OPENROUTER_API_KEY \
  -v citegeo-data:/app/data/product-v2 \
  ghcr.io/ankit373/citegeo:v0.2.0
```

Open <http://localhost:8787>. The named volume `citegeo-data` survives recreating the container; [back up](../upgrade.md) before an upgrade. Never expose the workbench directly to the public internet; remote access needs authentication and TLS configured separately.

Scheduled monitoring needs an extra worker started, using the same data volume; this executes due tasks and incurs an API cost:

```bash
docker run -d --name citegeo-worker --no-healthcheck \
  -e OPENROUTER_API_KEY \
  -v citegeo-data:/app/data/product-v2 \
  ghcr.io/ankit373/citegeo:v0.2.0 \
  node dist/src/product/scheduling/schedule-worker.js 60
```

The public image is built from the commit matching the `v0.2.0` tag. The workflow only writes `:v0.2.0` and `:latest` once the version, source markers, SVGs, project creation, and a persistence check after recreating the container have all passed; a candidate version never updates `latest`. See the [formal release attachment](https://github.com/ankit373/citegeo/releases/tag/v0.2.0) for the actual digest and provenance record. This version's statistics and acceptance gaps are still in the release notes; a historical `blocked` record is never rewritten as `passed`.

<details>
<summary>Historical candidate build record and deployment parameter notes (not the formal image's identity)</summary>

Reading the 20 Markdown cases needs no container or case site started. The commands below are only for the regular product workbench; the historical static preview is not a deployment dependency.

What follows is the **historical v0.2.0-rc.1 candidate record** from before the formal release, keeping its status, commands, and acceptance boundary from that time; it does not identify the v0.2.0 image. To install the current version, use the commands above.

The final OCI, index/per-architecture digests, build inputs, and their correspondence to source and the registry status are recorded in the local `release-manifest.json` (a local private record, not public: `../../validation/release-v0.2.0-rc.1/release-manifest.json`). That manifest has been generated, but this validation path is not a permanent public download entry point. See `rc4-image-provenance.json` (a local private record, not public: `../../validation/release-v0.2.0-rc.1/rc4-image-provenance.json`) for the current build-and-run mapping; some gates are still failing — see the version notes.

The current product entry point is [product-server.ts](../../src/product/product-server.ts), compiled to `dist/src/product/product-server.js`. The worker entry point is [schedule-worker.ts](../../src/product/scheduling/schedule-worker.ts), compiled to `dist/src/product/scheduling/schedule-worker.js`. The old `dist/src/server.js` and the old CLI's `monitor-worker` are not the current product's entry point.

## Confirm before building

Use the full current candidate working tree, not a checkout of an old HEAD alone; the product at this stage includes files not yet committed. Node 22 or later is required, and the image build depends on the repository's `package-lock.json`. The Dockerfile uses a multi-stage build; the runtime stage installs only production dependencies.

Before release, confirm the repository's [Dockerfile](../../Dockerfile) and [Compose file](../../docker-compose.yml) already reflect the current entry point:

- The default command is `node dist/src/product/product-server.js`.
- The runtime stage carries the compiled output, production dependencies, and the new logo and wordmark under `assets/brand/`; the current Dockerfile explicitly copies only those two brand files.
- The data root is set to `/app/data/product-v2`, mounting the entire product data directory.
- The worker uses the current scheduling entry point; the Compose worker is enabled by an explicit profile.
- `.dockerignore` excludes keys, `.env`, real user data, `validation`, the screenshot acceptance bundle, and temporary output, so no local business data is baked into the image.

For the old candidate OCI, the current server, the two new SVGs, `PRODUCT_DATA_DIR`, and `/health` already have local run evidence, with the loaded config for both amd64 and arm64 matching the multi-architecture archive. See `old image mapping` (a local private record, not public: `../../validation/release-v0.2.0-rc.1/image-provenance.json`) and `build metadata` (a local private record, not public: `../../validation/release-v0.2.0-rc.1/image-build-metadata.json`). Both files keep the old candidate's identity and cannot substitute for the final manifest.

The source still comes from a working tree with uncommitted changes, so it cannot be called "the product source commit is frozen." The HEAD in the old BuildKit provenance is only the base commit; the final manifest must list the dirty files and the actual build-input hashes, including `tsconfig.json`, the two SVGs, the dependency lockfile, and the Dockerfile. If a product commit is made later, its content must also be checked against the accepted OCI's relationship — never infer this from the current HEAD alone.

## Starting a local candidate

Run this from the project root. First choose the loaded image ID for the matching architecture from the release manifest and set `LOCAL_IMAGE`. This round already started the current candidate with the same server, port, and data mount, and completed create, restart, delete, and backup-read acceptance. This does not push or create a Git tag/release:

```sh
: "${LOCAL_IMAGE:?set the loaded image ID for the matching architecture from the release manifest}"
mkdir -p ./data/product-v2
docker run --detach --name citegeo-rc \
  --publish 127.0.0.1:8787:8787 \
  --env PORT=8787 \
  --env PRODUCT_DATA_DIR=/app/data/product-v2 \
  --mount type=bind,source="$(pwd)/data/product-v2",target=/app/data/product-v2 \
  "$LOCAL_IMAGE" \
  node dist/src/product/product-server.js
```

This key-less start is for the pages, reading existing data, and non-inference operations. The model catalog may still reach OpenRouter's public endpoint, but model execution without a key cannot obtain a real answer.

The page addresses are the [recognition workbench](http://127.0.0.1:8787/) and [continuous measurement](http://127.0.0.1:8787/?view=measurements). The service currently returns a page only at the root path; a deep link must not be freely changed to `/projects/...`. If the port is taken, replace the host port before the colon; the container's own port stays 8787.

## BYOK and cost

CiteGEO's current product uses OpenRouter BYOK. The key is read from the server's environment; it is never uploaded to a public demo site through a browser page. The user bears the model, search, and server costs; sponsorship never changes the measurement rules or results.

[env.ts](../../src/config/env.ts)'s key lookup order:

1. `OPENROUTER_API_KEY`'s direct non-empty value, or the content of the file `OPENROUTER_API_KEY_FILE` points to.
2. `OPENROUTER_KEY`'s direct non-empty value, or the content of the file `OPENROUTER_KEY_FILE` points to.

The project root's `.env` is loaded at process start and never overwrites an existing non-empty environment value. The container never automatically includes the host's `.env`; use environment injection or a read-only secret file instead. A key file that does not exist, cannot be read, or is empty still counts as a missing key.

To allow a real execution under an already-authorized budget, add this to the `docker run` above:

```sh
--env OPENROUTER_API_KEY_FILE=/run/secrets/openrouter_api_key \
--mount type=bind,source="$(pwd)/secrets/openrouter_api_key",target=/run/secrets/openrouter_api_key,readonly
```

This snippet is an addition to the `docker run` command, not a separate command. The file must be prepared on the host by the person deploying it beforehand, with read permission restricted, and never committed to the repository. Never write a real key into a README, a screenshot, a log, or an image build argument.

Configuring a key does not automatically run recognition, but clicking run, retry, enabling a due task, or calling `/api/scheduler/due` can incur a cost. Initial recognition may automatically add one more request on truncation; a measurement's `costLimitUsd`/`tokenLimit` are not currently a fully enforced budget gate. See [limitations](../limitations.md) for detail; never treat the UI's request count as a guarantee of the account's total budget.

## Data volume

| Environment variable | Current purpose |
| --- | --- |
| PRODUCT_DATA_DIR | The current product's full data root directory; takes the highest priority |
| MONITORING_DATA_DIR | Used with `product-v2` under it when `PRODUCT_DATA_DIR` is unset; defaults to `data` |
| RUNS_DIR | A legacy output path; it is not a substitute for the current product's data volume |
| PORT | The HTTP listen port; defaults to 8787 |

Mapping `./data/product-v2` to `/app/data/product-v2` and setting `PRODUCT_DATA_DIR` explicitly is recommended. If an existing deployment mounts the whole `./data:/app/data`, that mount can still be kept as long as `PRODUCT_DATA_DIR` points at `/app/data/product-v2`. Never mount two inconsistent data copies to the server and the worker.

What must be preserved: each project's `project.json` under `projects`, its model selection, baselines, recognition runs and their reports, measurement scope/runs/stats, and its tasks/occurrences/ledger. Backing up only the old `runs`, or only the attempt files, is not enough to restore the relationships between them. A relative path resolves against the container's working directory; this image's working directory is `/app`.

The host volume needs read/write access for the running user; the JSON files are not a read-only database. `docker rm` does not delete data in a bind mount, but the product's purge action permanently deletes a project's subtree. See [upgrade](../upgrade.md) for backup and restore steps.

## Enable the worker explicitly

The HTTP server itself never scans on a timer. The worker polls every 60 seconds by default; a positional argument can set the interval in seconds, with a minimum of 10. It does not accept the old CLI's `--poll-seconds` argument.

The command to start a worker on its own is below. Before running it, recheck every active task and the budget; it scans the same data root for due tasks and sends real requests to a model:

```sh
docker run --detach --name citegeo-rc-worker \
  --no-healthcheck \
  --env PRODUCT_DATA_DIR=/app/data/product-v2 \
  --env OPENROUTER_API_KEY_FILE=/run/secrets/openrouter_api_key \
  --mount type=bind,source="$(pwd)/data/product-v2",target=/app/data/product-v2 \
  --mount type=bind,source="$(pwd)/secrets/openrouter_api_key",target=/run/secrets/openrouter_api_key,readonly \
  "$LOCAL_IMAGE" \
  node dist/src/product/scheduling/schedule-worker.js 60
```

The worker has no extra HTTP port, so the image's built-in HTTP healthcheck is disabled when it is started on its own. Pausing a task only blocks its future due execution; it does not cancel a model request already in flight. Use the product's pause endpoint to pause any task that needs to stop, confirm its run reaches its final state, and only then stop the container:

```sh
docker stop citegeo-rc-worker
```

The current Compose file's server service is named `citegeo`, the worker is `citegeo-worker`, and its profile is `monitoring`. Compose passes `OPENROUTER_API_KEY`/`OPENROUTER_KEY` from the host environment or `.env` into the container, and both are allowed to be empty; this differs from the explicit secret-file mount described above. The default port binding is `127.0.0.1:8787`; a host `PORT` can override the host-side port. The worker is not enabled by the default start.

The Compose commands below are only for a scenario where someone deliberately deploys from source later; they build a new image, and it is **not guaranteed to be identical to the accepted OCI in the manifest**. Use the image ID above, or the registry digest below, for fixed-image acceptance and release:

```sh
docker compose up --build -d citegeo
```

Only start the worker explicitly once the tasks and budget are confirmed:

```sh
docker compose --profile monitoring up --build -d citegeo-worker
```

Both services mount the whole `./data:/app/data`, with the current product under its `product-v2` subdirectory. The worker's HTTP healthcheck is disabled, so the server being alive cannot be used to infer that scheduling is working.

## Existing verification and the final boundary

- The old OCI's two platform manifests/configs match the loaded images; the digest/size of all 28 OCI blobs has a read-only check recorded. The application layer contains only the compiled product, `package.json`, production dependencies, and the two new SVGs — the repository's tests, `validation`, real data, the site, the documentation, and screenshots are not baked in.
- The arm64 container read a copied preflight archive locally on 8795; `4 preflight screenshots and their index` (a local private record, not public: `../../validation/release-v0.2.0-rc.1/container-browser-1788846299778/report.json`) are recorded. They are a preflight replay and must not be counted as new inference for the 20 cases.
- amd64 has run under Docker Desktop emulation; 8796 used a separate empty data set, and a later `lifecycle record` on 8797 (a local private record, not public: `../../validation/release-v0.2.0-rc.1/container-lifecycle-1788847664760/report.json`) covers creation, restart persistence, archive/restore, a delete-then-refresh, and a deep query/resource check — 7 items passed. An earlier `failure cycle` (a local private record, not public: `../../validation/release-v0.2.0-rc.1/container-lifecycle-1788846686256/report.json`), caused by reading state immediately, is kept as-is and never deleted or rewritten as a success.
- A real backup copy-and-reopen has already been performed; see `rollback-check` (a local private record, not public: `../../validation/release-v0.2.0-rc.1/rollback-check.json`). This proves the old candidate read that isolated copy; it must never be used to claim an arbitrary cross-version schema migration, or a final rollback, has passed.

These conclusions belong only to the recorded old candidate. A minor fix rebuilds the final image, with the release manifest linking the affected acceptance; a model is never re-called by default just to fix documentation or a screenshot. The product UI is not fully bilingual end to end, and its statistics/source evidence also has existing limits — see the release notes and [L01 through L20](../limitations.md).

## Forwarding a kept digest to the registry

This section is an **unexecuted release procedure**, not a current authorization. Authorization for paid inference, a local build, or a documentation edit is not the same as authorization to upload to GHCR, `git push`, create a GitHub tag/release, or move `latest`.

Everything below must be satisfied before running this:

1. The final's minor fixes/rebuild and the affected acceptance are complete, and the release owner has confirmed the manifest's final OCI is the exact archive intended for release; stop if the manifest is missing, still points at the old candidate, or acceptance is incomplete.
2. Uploading this digest to the target GHCR repository has been explicitly authorized. The product's source and dirty changes are already accounted for in the manifest; to create a `sha-<commit>` tag, that commit must be checked for content correspondence — never fill in an old HEAD to pass it off as a frozen source.
3. The image, its evidence, and the public content in the documentation have been reviewed. Registry credentials are for login only and must never be written into the image, the manifest, a command log, or a public attachment.
4. Writes to other tags in the same repository have been coordinated to pause. The version/commit tags must be unclaimed; stop on any authentication, network, or service error, or if tags cannot be listed. There is no registry-level atomic lock between the check and the write, so another publisher must not be writing at the same time.

This needs Node 22+ and a Skopeo build that supports the options below. The release owner sets and `export`s these variables from `release-manifest.json`; this document does not assume a manifest field structure that is not yet finalized, and provides no placeholder digest:

| Variable | Source and requirement |
| --- | --- |
| OCI_ARCHIVE | Local path to the manifest's accepted final OCI archive; contains exactly one multi-architecture image index |
| EXPECTED_DIGEST | That same final's `sha256:` index digest — not a single-architecture config/image ID or a tar file hash |
| SOURCE_SHA | The product commit confirmed for content correspondence in the manifest, the full 40 characters; this upload flow must not proceed while the source is still dirty |
| TRANSFER_RECORDS | A new directory for this upload's records; never reuse a failure-cycle directory |
| GHCR_USER | An account with write access to the target repository; the token is entered interactively at login |

Everything below runs from the repository root, only once the authorization gates above have passed. Both tag writes copy the full accepted OCI, with no build step, and neither writes `latest`:

```sh
set -eu
export IMAGE=ghcr.io/ankit373/citegeo
export CANDIDATE_TAG=v0.2.0-rc.1
export RELEASE_MANIFEST=validation/release-v0.2.0-rc.1/release-manifest.json
: "${OCI_ARCHIVE:?set the final OCI path from the manifest}"
: "${EXPECTED_DIGEST:?set the accepted index digest from the manifest}"
: "${SOURCE_SHA:?set the checked product commit from the manifest}"
: "${TRANSFER_RECORDS:?set a new upload-records directory}"
: "${GHCR_USER:?set the registry account with permission}"
test -s "$RELEASE_MANIFEST"
test -s "$OCI_ARCHIVE"
test ! -e "$TRANSFER_RECORDS"
mkdir -p "$TRANSFER_RECORDS"
cp "$RELEASE_MANIFEST" "$TRANSFER_RECORDS/release-manifest.input.json"

node --input-type=module <<'NODE'
import { createReleasePlan, validateDigest } from './scripts/release-image-policy.mjs';
const plan = createReleasePlan({ eventName: 'workflow_dispatch', action: 'candidate', tag: process.env.CANDIDATE_TAG, sourceSha: process.env.SOURCE_SHA });
validateDigest(process.env.EXPECTED_DIGEST);
if (plan.image !== process.env.IMAGE) throw new Error('Registry differs from release policy');
NODE

skopeo inspect --raw "oci-archive:${OCI_ARCHIVE}" > "$TRANSFER_RECORDS/local-index.json"
test "$(skopeo manifest-digest "$TRANSFER_RECORDS/local-index.json")" = "$EXPECTED_DIGEST"
skopeo login --username "$GHCR_USER" ghcr.io
skopeo list-tags "docker://${IMAGE}" > "$TRANSFER_RECORDS/tags.before.json"
node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const { Tags } = JSON.parse(readFileSync(process.env.TRANSFER_RECORDS + '/tags.before.json', 'utf8'));
if (!Array.isArray(Tags)) throw new Error('Registry tag inventory unavailable');
for (const tag of [process.env.CANDIDATE_TAG, 'sha-' + process.env.SOURCE_SHA]) {
  if (Tags.includes(tag)) throw new Error('Immutable tag already exists: ' + tag);
}
NODE

for TARGET_TAG in "$CANDIDATE_TAG" "sha-${SOURCE_SHA}"; do
  export TARGET_TAG
  skopeo list-tags "docker://${IMAGE}" > "$TRANSFER_RECORDS/tags.current.json"
  node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const { Tags } = JSON.parse(readFileSync(process.env.TRANSFER_RECORDS + '/tags.current.json', 'utf8'));
if (!Array.isArray(Tags) || Tags.includes(process.env.TARGET_TAG)) throw new Error('Cannot create immutable tag');
NODE
  skopeo copy --all --preserve-digests \
    --digestfile "$TRANSFER_RECORDS/${TARGET_TAG}.digest" \
    "oci-archive:${OCI_ARCHIVE}" "docker://${IMAGE}:${TARGET_TAG}"
  test "$(cat "$TRANSFER_RECORDS/${TARGET_TAG}.digest")" = "$EXPECTED_DIGEST"
  skopeo inspect --raw "docker://${IMAGE}:${TARGET_TAG}" > "$TRANSFER_RECORDS/${TARGET_TAG}.index.json"
  test "$(skopeo manifest-digest "$TRANSFER_RECORDS/${TARGET_TAG}.index.json")" = "$EXPECTED_DIGEST"
done
```

`--all` copies the index and every one of its platform/attestation entries; `--preserve-digests` requires the content digest to be kept, failing if it cannot be. Never drop this option, force a format conversion, recompress, or substitute a `docker load` plus a single-architecture `docker push` for forwarding the whole archive. The options follow [Skopeo copy](https://github.com/podman-container-tools/skopeo/blob/main/docs/skopeo-copy.1.md) and the [OCI archive transport](https://github.com/containers/image/blob/main/docs/containers-transports.5.md); see [manifest-digest](https://github.com/podman-container-tools/skopeo/blob/main/docs/skopeo-manifest-digest.1.md) for how the index is computed.

A failure can happen after some blobs/tags have already been written. Keep every record, check the target state first, and only then decide what to do next; never delete an already-public tag, overwrite an existing immutable tag, or turn off digest verification just to retry. This also stops when a new repository cannot list its tags, which needs the release owner to handle the repository's initialization separately — never read that error as "the tag does not exist."

After the upload finishes, still recheck it architecture by architecture per the manifest and complete public-pull/access acceptance, recording the remote index and platform digests; a local image ID equals a config digest, not the multi-architecture index's identity. At deploy time, set `EXPECTED_DIGEST` from the manifest and always use `ghcr.io/ankit373/citegeo@${EXPECTED_DIGEST}` — never claim content is identical from a tag name alone.

## Workflow and promotion to stable

[docker-publish.yml](../../.github/workflows/docker-publish.yml)'s candidate path rebuilds the image and adds labels such as revision/version. Even from the same source, this cannot be called the same binary or the same digest as an already-accepted local OCI; the preserve-digest forwarding above is a separate procedure, and this page does not rewrite the workflow.

The preview/rc path, a normal release event, and the default manual candidate path must never move `latest`. Only a separately and explicitly authorized promotion to stable can manually select `promote-stable` on the default branch, supplying the stable version, the matching prerelease tag, the accepted digest, the checked product commit, and the acceptance-evidence URL, and confirming `confirm_tested`. The policy checks that the candidate/commit tag points at that digest, rejects an already-existing stable version tag, verifies the stable tag before moving `latest`, and does not rebuild. The acceptance URL and the confirmation are a manual record of responsibility, not proof that every acceptance step ran automatically.

Uploading an RC does not authorize creating a Git tag/release, a site deployment, or promotion to stable. This is still unreleased; see the release notes for the exact gates and what remains incomplete.

The current product has no built-in authentication, TLS, or multi-user access control. The local commands bind the port to 127.0.0.1; a deployment reachable from outside needs to run behind a controlled network or an authenticating proxy, keeping the raw text and keys inside your own environment.

</details>
