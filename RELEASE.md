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

1. Update `CHANGELOG.md` under a new version heading. Say what changed for
   someone running it, not what changed in the code.
2. Bump `version` in `package.json`, and `appVersion` in
   `deploy/helm/citegeo/Chart.yaml`.
3. Commit, tag `vX.Y.Z`, push the tag.
4. Publish the GitHub release. The Docker workflow builds and pushes the image
   on publish; it never rebuilds an existing tag.

## After publishing

Verify the published image rather than assuming it:

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
