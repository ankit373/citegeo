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

## Now: the loop from finding to fix

| # | Feature | Taken from | Why it matters | Depends on |
| :-- | :--- | :--- | :--- | :--- |
| 1 | **Citation gap** — rank the domains cited when a model names a competitor, and mark the ones that never cite you | Profound, Citation Intelligence | The single most actionable output in the category. It converts "you are invisible" into a named outreach list. The data model already stores citations. | Web-search runs, so OpenRouter credit |
| 2 | **Crawler log analytics** — which AI bots actually fetched which pages, from CDN logs rather than a JS tag | Profound, Agent Analytics | robots.txt says a crawler *may* fetch you. Logs say whether it *did*. That is causally upstream of every citation and nothing else reveals it. | Cloudflare (or other CDN) log access |
| 3 | **Fix as a pull request** — generate the schema, `llms.txt` and robots patch and open a PR against the site repo | Okara, Coding Agent | Closes the loop the action plan opens. This project is already git-native, so the fix belongs as a diff a human reviews, not as advice in a dashboard. | Repo write access |
| 4 | **Share of voice** — your mentions against named competitors, per model | Profound, Competitive Benchmarking | Already half-built in the measurement view. Makes "not recognised" comparative instead of absolute. | none |
| 5 | **Brand accuracy check** — diff what a model asserts about you against your own `llms.txt` and about page, and flag contradictions | Profound, FactCheck | A model stating something false about your pricing or coverage is a live commercial risk, and today nothing surfaces it. | none |

## Next: needs a dependency first

| # | Feature | Taken from | Why it matters | Depends on |
| :-- | :--- | :--- | :--- | :--- |
| 6 | **Query fanout capture** — record the sub-queries an engine actually ran behind one prompt | Profound, Query Fanouts | Shows the queries to target rather than the ones you guessed. Some providers already return `search_queries`; it is thrown away today. | Web-search runs |
| 7 | **Sentiment and narrative themes** — classify how a model describes you, not just whether it knows you | Profound, Response Analysis | Recognition is binary and hides tone. Can run on local models at zero cost. | Local gateway |
| 8 | **Search Console integration** — real query and impression data as the honest substitute for panel demand data | Okara, GA/GSC connection | The nearest legitimate replacement for Prompt Volumes, and free. | Google OAuth |
| 9 | **Engines with no API** — Google AI Overviews, AI Mode, Copilot via a driven browser | Profound, engine coverage | The API answer and the rendered answer differ. This is the fidelity gap. Playwright is already a dependency. | Browser automation, ongoing maintenance |
| 10 | **Scheduled reports and CSV export** | Profound, data export | The scheduler exists; nothing formats or delivers a result. | none |
| 11 | **Credential entry in the portal** | every hosted tool | Needed before this is usable by anyone who will not edit `.env`. | Authentication, see `SECURITY.md` |

## Deliberately not doing

| Feature | Seen in | Why not |
| :--- | :--- | :--- |
| **Prompt Volumes** | Profound | Needs an opt-in consumer panel. There is no honest way to synthesise it, and estimating it would be exactly the invented number this project exists to avoid. Item 8 is the substitute. |
| **Reddit, influencer and UGC posting agents** | Okara | Auto-drafted community replies are spam whatever the intent, and this is an inspection tool, not a distribution channel. |
| **Blog generation at volume** | Okara, SEO Agent | Writing pages to rank is the thing that made AI search necessary. Item 3 fixes what is already there instead. |
| **Shopping / SKU visibility** | Profound | A separate product for a category this does not serve. |
| **SOC 2, SSO, RBAC, command centre** | Profound | Only meaningful once more than one person can log in, which needs authentication first. |

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
