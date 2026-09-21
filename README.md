<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/citegeo-lockup.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/brand/citegeo-lockup-light.svg">
    <img src="assets/brand/citegeo-lockup-light.svg" width="336" alt="CiteGEO">
  </picture>
</p>

<p align="center">
  <a href="LICENSE"><img src="assets/readme/license.svg" alt="MIT" width="172" height="28"></a>
  <a href="docs/deployment/docker.md"><img src="assets/readme/self-hosted.svg" alt="Self-hosted" width="132" height="28"></a>
</p>

# What do AI models say about your product?

**Point CiteGEO at a domain. It asks several models the same questions, keeps every raw answer, and shows you the receipts.**

<p align="center">
  <strong><a href="#quick-start">Quick start</a> · <a href="#how-it-works">How it works</a> · <a href="#what-you-get">What you get</a> · <a href="#monitoring">Monitoring</a> · <a href="#docs">Docs</a></strong>
</p>

People increasingly ask an assistant for tool recommendations instead of searching. If your product does not come up, or comes up described wrongly, you currently have no way to see that happening.

CiteGEO is a self-hosted tool for watching it directly. You give it a domain. It queries the models you choose, records what each one said about the brand, which competitors it named, and which sources it cited, and stores the unedited response behind every claim.

> Every number in the interface opens onto the answer it came from. If the evidence is not there, the result stays marked uncertain rather than being rounded into a score.

<a id="quick-start"></a>

## Quick start

You need Node.js 22 or newer and an API key for at least one provider. OpenRouter is the easiest starting point because one key reaches many models.

```bash
git clone https://github.com/ankit373/citegeo.git
cd citegeo
npm ci
cp .env.example .env
```

Put `OPENROUTER_API_KEY` in `.env`, then start the server:

```bash
npm run server
```

Open <http://localhost:8787> and create a project.

Running against a container instead is covered in the [Docker guide](docs/deployment/docker.md). If you already have data, read [Backups and upgrades](docs/upgrade.md) first.

You pay your providers directly. CiteGEO adds no cost of its own and sends nothing anywhere except to the model APIs you configure.

<a id="how-it-works"></a>

## How it works

1. **Create a project** for one domain. The project is saved before any request is made, so nothing is lost if a run fails.
2. **Pick your models** and decide, per model, whether it may use web search. Offline and web-enabled answers are recorded as different conditions and never averaged together.
3. **Run a domain test.** Each model answers independently. One model failing does not discard the others.
4. **Read the answers.** Descriptions, named competitors, associated keywords and cited sources appear side by side, each linked to the raw response.
5. **Confirm what to track,** then run keyword tests that deliberately never mention your brand, to see who surfaces when you are not the subject.
6. **Repeat or schedule it** to build a record you can compare against later.

A model recognising a domain you asked it about is not the same as recommending it unprompted. The interface keeps those two things separate, because conflating them is the main way this kind of measurement goes wrong.

<a id="what-you-get"></a>

## What you get

| | |
| :--- | :--- |
| **Separate projects** | Each domain keeps its own configuration, runs and evidence. Nothing bleeds between products. |
| **Model comparison** | Search and select across providers, inspect each answer and error, and retry one model without rerunning the rest. |
| **Explicit search conditions** | Per-model web search, with the real execution conditions stored alongside the result. |
| **Brand and competitor reads** | Business descriptions, categories, named competitors and associated keywords, model by model. |
| **Unprompted visibility** | Keyword tests that omit your brand name, so you can see who appears without you in the question. |
| **Real evidence** | Provider citations kept separate from URLs that merely appear in answer text. Failures and uncertainty stay visible. |
| **History** | Repeat a measurement or schedule it. Data points trace back to the answers underneath them. |

<a id="monitoring"></a>

### Repeated measurement

One run tells you what the models say today. Confirm the competitors and keywords worth watching, then repeat that scope or put it on a schedule.

Scheduled runs need the [monitoring worker](docs/deployment/docker.md#enable-the-worker-explicitly) running. Changing your model selection does not fabricate history for the new models; earlier records stay attached to the models that produced them.

A handful of runs over a few minutes is not a trend. Treat it as a baseline.

<a id="docs"></a>

## Documentation

- [How it works](docs/how-it-works.md) · [Architecture](docs/ARCHITECTURE.md)
- [Measurement methodology](docs/measurement-methodology.md) · [Sources and evidence](docs/evidence-model.md)
- [Raising your standing](docs/ranking-process.md)
- [Deployment](docs/deployment/docker.md) · [Backups and upgrades](docs/upgrade.md)
- [Known issues](docs/known-issues.md) · [Limitations](docs/limitations.md)
- [Design system](DESIGN.md) · [Brand](docs/brand.md)
- [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md)
- [Roadmap](ROADMAP.md), including what this deliberately will not build
- [Marketing page source](src/site/marketing-page.ts), built to `site/` with `npm run build:site`

## Licence

MIT, see [LICENSE](LICENSE).

Issues and pull requests are welcome at [github.com/ankit373/citegeo](https://github.com/ankit373/citegeo).

---

CiteGEO reads provider API responses, not consumer chat interfaces, and the two do not always agree. Offline and web-enabled results mean different things and should be read separately. This is not search-engine rank tracking.
