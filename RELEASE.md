# Releasing

## Versioning

`package.json` and the Helm chart's `appVersion` carry the application version.
The chart has its own `version`, bumped when the chart changes even if the
application does not.

Semantic versioning, with the caveat that this is pre-1.0 and the data layout
may change between minor versions. Read [upgrade](docs/upgrade.md) before moving
an installation with data in it.

## Before tagging

```bash
npm ci
npm run self-check                        # typecheck and unit tests
node scripts/check-emitted-scripts.mjs    # the page actually parses
node scripts/check-doc-links.mjs          # documentation links resolve
helm lint deploy/helm/citegeo
```

Then run the product and click through one full pass: choose models, save a
configuration, run a recognition test, read the results. The unit suite asserts
on HTML strings and does not execute the page, so it cannot tell you the
interface works.

## Cutting the release

Releases are cut from `main` by release-please.

1. Every merge into `main` is a squash commit titled by the pull request, so
   the title has to say what kind of change it is: `feat` bumps the minor
   version, `fix` and `perf` the patch, and `!` a major.
2. release-please keeps one release PR open. It bumps `package.json`, the
   lockfile and `CHANGELOG.md`, and the release workflow adds the chart
   version, `appVersion` and the regenerated `deploy/kubernetes/citegeo.yaml`.
3. Edit the CHANGELOG on that PR so it says what changed for someone running
   it, not what changed in the code.
4. Approve it. The queue merges it, release-please tags `vX.Y.Z` and publishes
   the release, and the Docker workflow builds and pushes the image. It never
   rebuilds an existing tag.

## After publishing

The publish workflow ends with a smoke test that pulls the published image for
both platforms and runs it. If it fails, it opens an issue labelled
`release:blocked` and puts the same label on the open release PR, so the next
release waits. A published release cannot be changed: fix forward with the next
patch. To run the smoke test again for any tag, start the "Release smoke test"
workflow by hand.

To check by hand:

```bash
docker run --rm -p 8787:8787 ghcr.io/ankit373/citegeo:vX.Y.Z
curl -fsS http://127.0.0.1:8787/health
```

Check the brand assets are served, since they are copied explicitly in the
Dockerfile and have been missed before:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8787/assets/brand/citegeo-lockup.svg
```

## What never ships

Provider keys, generated reports, private domains or prompts, and local run
directories. `.gitignore` and `.dockerignore` both exclude them; check the
staged file list anyway.
