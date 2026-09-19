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

| # | Feature | Taken from | Why it matters | Blocked on |
| :-- | :--- | :--- | :--- | :--- |
| 1 | **Fix as a pull request** — generate the schema, `llms.txt` and robots patch and open a PR against the site repo | Okara, Coding Agent | Closes the loop the action plan opens. This project is already git-native, so the fix belongs as a diff a human reviews, not as advice in a dashboard. | Write access to the site repo |
| 2 | **Sentiment and narrative themes** — classify how a model describes you, not just whether it knows you | Profound, Response Analysis | Recognition is binary and hides tone. Runs on local models at no cost. | nothing |
| 3 | **Search Console integration** — real query and impression data as the honest substitute for panel demand data | Okara, GA/GSC connection | The nearest legitimate replacement for Prompt Volumes, and free. | Google OAuth |
| 4 | **Engines with no API** — Google AI Overviews, AI Mode, Copilot through a driven browser | Profound, engine coverage | The API answer and the rendered answer differ. This is the fidelity gap. Playwright is already a dependency. | Browser automation, ongoing maintenance |
| 5 | **Scheduled report delivery** — send the findings somewhere rather than waiting to be asked | Profound, reporting | The scheduler and the CSV writer both exist; nothing delivers. | A destination, email or webhook |
| 6 | **Credential entry in the portal** | every hosted tool | Needed before anyone who will not edit `.env` can use this. | Authentication, see `SECURITY.md` |

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
