# CiteGEO Helm chart

```bash
helm install citegeo ./deploy/helm/citegeo \
  --namespace citegeo --create-namespace \
  --set secrets.existingSecret=citegeo-providers
```

## Before you expose it

**CiteGEO has no authentication.** Anyone who reaches the port can read every
stored project, run and raw model answer, and can spend your provider credit.
The ingress is disabled by default on purpose. Put an authenticating proxy in
front of it, and set `networkPolicy.enabled=true` with an explicit
`networkPolicy.ingressFrom`.

## Credentials

Create the secret yourself rather than putting keys in values:

```bash
kubectl -n citegeo create secret generic citegeo-providers \
  --from-literal=OPENROUTER_API_KEY=... \
  --from-literal=AZURE_OPENAI_API_KEY=...
```

Then `--set secrets.existingSecret=citegeo-providers`. `secrets.create=true`
exists for local experiments and writes keys into the release.

## Storage

Projects, runs and every raw answer live on one volume. The server is a single
writer, so `replicaCount` stays at 1 and the update strategy is `Recreate`. A
rolling update would briefly run two writers against one volume.

With `persistence.enabled=false` the data lives in an `emptyDir` and is lost on
restart. That is for a throwaway trial only.

## The worker

`worker.enabled=true` runs the scheduling worker as a second deployment sharing
the same volume. With `ReadWriteOnce` both pods must land on the same node; with
`ReadWriteMany` they need not. Leave it off unless you use scheduled monitoring.

## Values worth knowing

| Key | Default | Why it matters |
| --- | --- | --- |
| `persistence.size` | `10Gi` | Raw answers accumulate; every attempt is kept |
| `networkPolicy.enabled` | `false` | Enable it, and name your sources |
| `config.OPENAI_COMPATIBLE_BASE_URL` | `""` | Points at a local or in-cluster OpenAI-compatible gateway |
| `config.AZURE_OPENAI_DEPLOYMENTS` | `""` | Comma-separated deployment names; Azure exposes no listing |
| `resources.limits.memory` | `1Gi` | Reports are built in memory from stored runs |

## The plain manifests

`deploy/kubernetes/citegeo.yaml` is generated from this chart, and CI fails if
the two drift. Regenerate rather than editing it:

```bash
helm template citegeo deploy/helm/citegeo --namespace citegeo
```

CI renders with Helm 4.2.2, the version that generated the committed file.
Helm 3 emits different blank lines between documents, so the comparison
ignores blank lines and looks at content.

## Verifying a render

```bash
helm lint deploy/helm/citegeo
helm template citegeo deploy/helm/citegeo --set worker.enabled=true \
  | kubectl apply --dry-run=client -f -
```

CI validates the render with kubeconform in strict mode, which rejects unknown
fields. To reproduce that without a cluster:

```bash
helm template citegeo deploy/helm/citegeo --set worker.enabled=true \
  | kubeconform -strict -summary -kubernetes-version 1.30.0 -
```
