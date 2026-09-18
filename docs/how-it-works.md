# How it works: from domain to evidence

Applies to the current `src/product` implementation; planned version **v0.2.0-rc.1, UNPUBLISHED**. This document explains how the product obtains and processes answers; it is not a claim that Phase 6's real calls, screenshots, or release acceptance are complete.

**Open the SEO / GEO reporting black box, and put the evidence back in the user's hands.** This measures AI answers and citations today; it does not provide traditional search-ranking monitoring.

Enter a domain and see how different AIs describe you, which competitors they name, which keywords they associate, and which sources an answer actually returned. Every comparison traces back to the matching model's original answer.

What is published is this run's answer and its evidence; it does not expose the model's internal reasoning, and a rerun is not guaranteed to produce an identical answer.

## Status of this document's case

R02: vercel.com is used as the walkthrough's entry point. It is an app-deployment case chosen before the run, with three models' initial D answers stored and three subsequent measurements. Of nine K observations, three failed structured parsing, with their raw text kept; all three runs are partial, and they should not be written up as three complete successes. At least one was triggered by a real due task, and that task has been paused since acceptance. Every request, keyword source, cost, screenshot, and raw text is in the case's evidence.

Case categorization is for indexing only and is never sent to a model. The study plan fixes 20 inputs, two offline model routes, and one web-enabled model route, with R02/R04 each running three continuous measurements. R02's answer language is `en`. The raw text and conclusions follow the case directory's versioned results and evidence; this round never renamed an old alpha run, a test fixture, or a historical case to count it as a new real run. See [measurement methodology](measurement-methodology.md) for the full call ceiling and filtering rules.

## 1. Saving a project and test conditions

Creating a project normalizes the domain and stores the brand display name, aliases, and default answer language. The `primaryDomain` itself is already the normalized value, so the study plan also keeps the user's raw input separately. Creating a project never crawls the site and never sends a model inference.

From the actual model catalog, choose an OpenRouter route and `off` (no web search) or `provider_native` (provider-native web search). The catalog's capability flag says a configuration is selectable, not that the next request is guaranteed to succeed. A baseline is then saved, a snapshot of the monitoring configuration; later runs record its ID and version.

A given model ID can currently appear only once within one model selection; comparing the same model with and without web search requires separate configurations or runs, each keeping its own condition explicit. The default parameters are `temperature` 0 and `maxTokens` 900. `temperature` 0 is not a guarantee of verbatim reproduction either.

## 2. Domain recognition D: description after being named

D's internal protocol is named `domain-recognition/v1`. The model receives the normalized domain, the language, and the fixed protocol instructions; the project's brand name, aliases, competitor list, site body text, case category, and other models' answers never enter this prompt.

The domain has already been named, so a D answer restating the domain does not prove "organic discovery" or "keyword recommendation." A web-enabled D lets the provider search on its own; the caller still never injects a site description.

Each initial recognition run is stored per model:

- The domain-recognition claim `domainRecognition`: recognized, not_recognized, or unknown.
- This output's completeness/certainty as `analysisStatus`, with a missing or invalid field recorded in `fieldIssues`.
- Brand, business description, category, competitors actually listed, target keywords, and per-competitor keywords.
- Citations returned by the provider, plain URLs that appear in the answer, and the traceable link between a citation and its field.
- The actual model, request parameters, search-execution info, raw response, raw answer, usage, cost or unknown-cost, timestamp, and any error.

These are observations from one API answer, not a fact-checked company profile. An empty competitor array only means no competitor was listed this time; a keyword being associated is not a search-popularity or commercial-value signal.

## 3. The answer, its parse, and its report are each stored separately

The initial recognition service first writes a `response_saved` attempt that includes the raw text, then parses the structured content. A failed request, a truncated response, a missing field, a parsing failure, and the model explicitly answering "unknown" are all different states. "Only some fields were recovered" must never be written up as "the model partly recognized the brand."

When raw text exists, it can be re-analyzed locally to produce an AnalysisRevision; this never calls the provider again. When a fresh request is needed, a new attempt is added, which may incur a cost. Right now, initial recognition also automatically re-requests once with a 2000-token output cap when parsing fails and the provider explicitly flagged truncation; the two requests have different conditions and both must be counted in the ledger.

A recognition report is generated from each model's current attempt in the run's final state, keeping a `sourceAttemptMap` and a record hash. Competitors are grouped exactly by normalized name and host; the report never visits the site and never calls another model to write its conclusions. One model failing never erases another model's raw text.

The recognition detail page can show the latest local analysis revision, but report building currently still reads the original attempt archive. After a re-analysis, do not assume the report has adopted the revision — check the report's actual source.  See [evidence model](evidence-model.md).

## 4. Building a scope to watch from a recognition report

A WatchSet is a versioned set of objects and keywords. The initial suggestion comes from the latest saved report of each recognition run in the project: the target object comes from the project configuration, competitors come from the report's competitor grouping, and keywords come from the target brand's keyword grouping. Every item keeps its source record ID. A competitor with no domain is kept as identity-to-confirm and is never sent its own competitor-domain D.

The current WatchSet keyword check normalizes case and surrounding whitespace, then excludes any keyword that contains the monitored object's name, alias, or domain. It does not implement general disambiguation, and it has no automatic "at most two keywords per case" research rule. Phase 6 applies a separate filter at the case layer — requiring the same keyword to be associated by at least two different models, exact raw-text evidence, identity-substring exclusion, and deterministic ordering — freezing each case's keyword list before K runs; that safeguard must not be assumed to be a capability of the default WatchSet service.

When an active WatchSet already exists, a new draft copies the prior scope, so a new keyword from a later report is never silently introduced; it does not auto-merge new discoveries. A new scope must be confirmed after a model or configuration change. When no eligible keyword exists, the D result is kept and K should state "not enough information this round to establish a keyword test."

## 5. Keyword selection K: who shows up when nobody is named

K's protocol is `keyword-discovery/v1`. The request contains only one frozen keyword, the language, and the neutral-product-selection instructions; it never sends the target's or a competitor's name, domain, alias, or expected answer.

The model returns structured mentions, including a product/organization name, domain, mention-or-recommendation relationship, and an evidence snippet and ordering state. Locally, after the answer comes back, it is matched exactly against the WatchSet by name/alias or domain; `matchedObjectId` is assigned only on a unique match. An object outside the scope stays in the detail record and is never forced onto a particular competitor.

A "mention" is not the same as a "positive recommendation." "Mentioned/recommended first" only describes the order reported in the answer; it must not be read as which one the model actually thought of first internally. The current positive-relationship and unique/tied states come from the tested model's own structured output; the metric does not yet require every snippet and offset to be fully verified — check the raw text when reading an ordering conclusion.

One continuous-measurement run executes, for each selected model, D for every object that has a confirmed domain, plus K for every eligible keyword, each multiplied by `repetitions`. **It is not an endpoint that runs only K**; an initial D also never automatically becomes a chart sample for this run. Do not miscount "one target domain per case" as "one request per case."

## 6. How one answer becomes a chart

The path is `MeasurementRun → MeasurementModelRun → ProbeRun → ProbeAttempt → protocol result → MeasurementMetricPoint`. One K answer can support multiple metrics for both the target and its competitors at once; a sample count must never be inflated by the number of mentioned objects.

Each point records `numerator`, `denominator`, `planned`, `failed`, `value`, and `samples`. The sample detail lists hits, misses, and exclusions together, and can be opened along `probeRunId` and `attemptId` to the raw text. With no adjudicable denominator the value is usually `null`; only a genuine miss is a valid 0% under a real denominator. Keyword association counts have their own separate counting rule; see the [full formulas](measurement-methodology.md).

An initial recognition report never turns directly into a measurement curve; chart statistics come from the independent D/K probes under `measurements/`. D's `unknown` and K's `unknown` are handled differently for the denominator in the current code, and neither should be replaced by one generic "success sample rate."

The measurement is designed so that one planned probe only takes its first attempt; a retry does not add a sample. The current implementation still has a risk of mixing the first attempt with results/citations covered per probe; known gaps also exist in stats caching and chart disconnects. So a curve's shape alone cannot be used to claim strict first-attempt statistical acceptance is complete.

## 7. Repeats, scheduling, and model changes

Manual measurement and scheduled measurement reuse the same measurement service. When the scheduler's due time arrives, it saves the occurrence first, then creates a run with `source: scheduled`. Real scheduled evidence needs, at minimum, the task configuration, the planned time, a unique occurrence, the actual run, its attempts, and its final state; a manual button click or a single 200 from the scheduler's HTTP endpoint is not a substitute for that evidence chain.

After a model is added, it can be measured separately for what never appeared in the historical `modelScope`; a new model has no historical backfill. Removing a selection never deletes an old report or its raw evidence, but the default for later runs only switches to the new model set once a new baseline is saved. An old task can move into `incompatible` when its configuration changes; gaps remain in scheduling behavior for scope changes and missed times — see [limitations](limitations.md).

A chart's time axis uses the actual run's start time; the current long-range filter is a rolling 7/30/90 days or all time, with no automatic daily de-duplication. Three observations under the same condition only describe those three runs and their time span; they do not prove statistical stability, a brand ranking, or a causal effect from GEO optimization.

## Recheck versus re-measurement

A recheck reads existing raw text, parameters, citation paths, hashes, and formulas; a re-measurement requests the model again — the two should always be labeled separately. Reading a report, building local statistics, and re-analyzing a stored answer all need no model inference, but building a report/statistics does write a derived file, and reading the model catalog can still reach the public internet.

When public case data is missing, any formula demo should keep an empty state rather than filling in a sample value in place of a real measurement. See [architecture](ARCHITECTURE.md) for technical placement, and [Docker deployment](deployment/docker.md) for installation and cost boundaries.
