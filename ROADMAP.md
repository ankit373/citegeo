# Roadmap

What belongs in CiteGEO, what does not, and why. Ordered by value against the
effort to build it.

The category splits into measurement, which tells you where you stand, and
action, which tells you what to change. A tool that only measures leaves the
second half of the loop to the reader.

Three rules decide what belongs here:

1. **Evidence, not opinion.** A recommendation has to name the observation
   behind it. Anything that needs a model to invent advice does not ship.
2. **Self-hosted and honest about cost.** No feature may depend on data this
   project cannot obtain. Where an openly licensed corpus of real questions
   exists, that counts as obtainable and is used; where nothing does, the
   number is not estimated.
3. **Own the gap the category ignores.** Every competitor sells a score.
   This one sells the receipt behind it.

## The action half, planned

Measurement is most of what is built. The other half of the loop is doing
something about what was measured, and the category has settled on a shape for
it: a workspace where repeatable jobs run against your own data and produce
something you can publish.

Rule 1 bites hardest here. A job that asks a model to invent advice does not
ship. A job that reads stored answers, names the ones it acted on and writes a
draft does, because the draft carries its own receipt.

| Feature | What it is | Why it is not built yet |
| :--- | :--- | :--- |
| **Ask the archive** | A question answered from the archived answers for this project, with the answer ids it used | Needs a retrieval layer over the archive. The archive itself is already there. |
| **Jobs** | A named, repeatable task over stored evidence: refresh a page against the questions it loses, draft an FAQ from the questions nobody answers with you in them | Needs a job definition, a runner and a place to put the output. The evidence side is done. |
| **Bulk runs** | One job over many rows: every page, every prompt, every rival | Needs the job runner first. Cheap once it exists. |
| **Documents** | Where a job's output lands, editable, exportable | Needs a store and an editor. The store is the one we already have. |
| **Declared context** | What the brand says about itself, editable, and pointed at more than the site | Half built. `src/product/discovery` already writes a profile from the site's own pages; what is missing is editing it and adding sources. |

Order matters: the archive query comes first because every job is a query with a
template around it. Bulk runs and documents are the same runner twice.

What will not be taken from the shape: a job that writes copy with no cited
observation behind it, and a model picker offered as a feature. The model is a
measurement instrument here, not a product surface.

## Outstanding

Everything below needs something this project cannot provide for itself.

| # | Feature | Taken from | Blocked on |
| :-- | :--- | :--- | :--- |
| 1 | **Fix as a pull request**: generate the schema, `llms.txt` and robots patch and open a PR against the site repo | Action loop | Write access to the site's own repository |
| 2 | **Search Console integration**: real query and impression data, alongside the open-corpus demand figures | Demand data | Google OAuth credentials |
| 3 | **Engines with no API**: Google AI Overviews, AI Mode, Copilot through a driven browser | Engine coverage | Browser automation and the maintenance it carries |

## Built, waiting on data rather than code


| Feature | State |
| :--- | :--- |
| **Citation gap** | Built and returning empty. It needs answers that name competitors, which needs web search enabled, which needs OpenRouter credit. |
| **Query fanout** | Built across six provider shapes and returning empty for the same reason: every run so far was offline. |
| **Share of voice** | Built. Reports mentions but a null share, because no competitor has been named yet. |
| **Crawler analytics** | Built and verified against a synthetic log. Needs `ACCESS_LOG_PATH` pointed at a real one. |

## Already shipped

- Recognition runs across OpenRouter, an OpenAI-compatible local gateway and Azure OpenAI
- Evidence archive: the raw answer and provider response behind every claim
- Measurement over time with per-model series
- **Visibility analytics**: visibility overall and per model, share of voice, cited-domain
  ranking, the categories the models used, and the citation gap
- **Claim audit**: model disagreement, assertions with no citation behind them, and claims
  sharing no meaningful word with what the brand declares
- **Query fanout capture**, read from archived provider responses across six provider shapes
- **AI crawler analytics** from a combined-format access log, ingested incrementally, with
  the three states a frequency chart hides: allowed but never arrived, fetched but never
  cited, and cited but never fetched
- **Site signal probe** on a worker cadence, with stored history and a diff between probes
- **Next-actions plan** built from the stored probe and the real recognition evidence
- **CSV export** for visibility, share of voice, citations, the gap, fanout and categories
- **Narrative and sentiment**, bounded so a classifier outage reads as unknown, never neutral
- **Digests** that report only when something moved, delivered from the worker, with the
  baseline advancing only on a send that succeeded
- **Optional password authentication**, off unless `AUTH_PASSWORD` is set
- **Provider keys entered in the portal**, encrypted at rest, never returned by any read,
  and refused entirely when the server has no password
