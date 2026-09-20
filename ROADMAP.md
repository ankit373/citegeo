# Roadmap

What CiteGEO could take from the commercial tools in this category, what it
should not, and why. Ordered by value against the effort to build it.

The two reference points are [Profound](https://www.tryprofound.com/), which is
measurement-led, and [Okara](https://okara.ai/), which is action-led. CiteGEO
today is measurement-only, so the whole second half of the loop is missing.

Three rules decide what belongs here:

1. **Evidence, not opinion.** A recommendation has to name the observation
   behind it. Anything that needs a model to invent advice does not ship.
2. **Self-hosted and honest about cost.** No feature may depend on data this
   project cannot obtain without a consumer panel.
3. **Own the gap the category ignores.** Every competitor sells a score.
   This one sells the receipt behind it.

## Outstanding

Everything below needs something this project cannot provide for itself.

| # | Feature | Taken from | Blocked on |
| :-- | :--- | :--- | :--- |
| 1 | **Fix as a pull request** — generate the schema, `llms.txt` and robots patch and open a PR against the site repo | Okara, Coding Agent | Write access to the site's own repository |
| 2 | **Search Console integration** — real query and impression data, the honest substitute for panel demand data | Okara, GA/GSC connection | Google OAuth credentials |
| 3 | **Engines with no API** — Google AI Overviews, AI Mode, Copilot through a driven browser | Profound, engine coverage | Browser automation and the maintenance it carries |

## Built, waiting on data rather than code


| Feature | State |
| :--- | :--- |
| **Citation gap** | Built and returning empty. It needs a grounded answer, which needs a provider that can search: Perplexity grounds every answer, OpenAI and Anthropic search on request, and Gemini does once billing is enabled. |
| **Query fanout** | Built across six provider shapes and returning empty for the same reason: every run so far was offline. |
| **Share of voice** | Built. Reports mentions but a null share, because no competitor has been named yet. |
| **Crawler analytics** | Built and verified against a synthetic log. Needs `ACCESS_LOG_PATH` pointed at a real one. |

## Already shipped

- Recognition runs across eight providers: OpenAI, Anthropic, Gemini, Perplexity, DeepSeek,
  OpenRouter, Azure OpenAI and any OpenAI-compatible local gateway, each reporting what it
  costs and whether it can cite before a run rather than during one
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
