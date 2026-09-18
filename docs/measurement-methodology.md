# Measurement methodology and metric definitions

The real run found 7 conflicts over a unique first position across R06, R07, R10, R11, and R19. The related rankings, and any aggregate depending on that field, are excluded from comparisons for now; see [per-item evidence](known-issues.md). This round only discloses the issue and changes no original value or algorithm; arithmetic being recomputable does not mean the semantic judgment is correct.

Applies to: the current `src/product` working tree, planned for release as **v0.2.0-rc.1, UNPUBLISHED**. What follows describes the actual computation as read from source; it is not a claim that real D/K sampling, scheduling, or chart acceptance is complete. The authoritative computation entry point is [measurement-stats.ts](../src/product/measurements/measurement-stats.ts); field definitions are in [measurement-schema.ts](../src/product/measurements/measurement-schema.ts).

## This round's frozen plan and actual execution

The plan source is examples/study-plan.json, with 20 inputs under `examples/cases`. Three routes are fixed: `openai/gpt-4o-mini` and `google/gemini-2.5-flash-lite` offline, and `openai/gpt-4.1-mini` using `provider_native`; both D and continuous measurement use these same three routes. A model's actual search `executionMode` still has to be confirmed from the response — in particular, an SDK path must never be written up as the model's own built-in search.

Initial D is planned for at most 20×3=60 calls. Each case's continuous measurement selects only the target object, never a competitor's own domain D, keeping at most two eligible K keywords; each `MeasurementRun`'s `WatchSet.repetitions` is 1. R02/R04 each ran three `MeasurementRun`s, with the third dispatched by a real due schedule, and the task paused once it completed. So at most 24 `MeasurementRun`s × 3 routes × (1 target D + 2 K) = 216 calls, for a base ceiling of at most 276 calls. Up to 60 more application-level truncation retries and 6 preflight attempts are reserved on top, for a total planned ceiling of 342; this is not the number actually executed, and it is not a guarantee the budget is enough to reach the ceiling.

The user authorization at the time was a **cumulative USD 2** for the real-run stage, covering preflight, failures, retries, and search, stopping new calls on an unknown cost. The study executor reserves cost serially, with provider HTTP retries set to a single attempt; the core product's budget limit and this executor's guarantee should be explained separately — see [limitation L11](limitations.md). The actual archived calls are 204, 744,529 tokens, USD 1.00476325; see the version record. This documentation pass added no further inference and used none of the remaining historical budget.

Keywords follow `observed-consensus/v1`: from the archived target keywords, keep only ones with exact, precisely locatable raw-text evidence, associated by the same keyword from at least two different models, excluding any substring that is the target's or a competitor's own observed identity, then take at most two, ordered by descending independent-model count and ascending normalized keyword; both the candidates and their exclusion reasons are kept. The code is in study.mjs, with no semantic rewriting. It is a mechanical filter rule; it does not guarantee every ambiguity is resolved or that it reflects search demand. Each case's keyword manifest is separately frozen before K runs.

## Observation unit and conditions

A `ProbeRun` is one planned observation: one model, one protocol, one domain or keyword, one `sampleNumber`. A `ProbeAttempt` is an execution attempt; a retry is not an extra independent sample. Every metric point belongs to one project, one `MeasurementRun`, one model, one object, and an optional keyword/comparison object.

What must be stored and disclosed: the raw input, the normalized input, the provider and full model route, the model version actually returned, the requested search configuration and the actual search execution, the language, the D/K protocol version, the prompt/schema hash, temperature, the output cap, the matching rule, the scope version, `repetitions`, the actual timestamps, and the attempt-selection rule. The same model route does not prove the upstream weights or search index are unchanged.

The current default generation parameters are `temperature=0`, `maxTokens=900`, structured transport `response_json_schema`. The initial recognition service's truncation-retry cap is 2000; the measurement service has no matching auto-expansion branch. An attempt under different conditions must never be treated as a repeat under identical parameters.

A measurement plan's probe count is fixed by this formula:

```text
selected model count × repetitions × (objects with a domain and confirmed identity + keywords that are neutralEligible)
```

An object can include the target and multiple competitors. One K answer can be used for multiple object metrics at once, with each object still sharing that one answer sample. Initial `recognition-runs` and continuous `measurement-runs` are stored separately; this page's chart formulas compute only the latter, and never auto-splice in initial recognition or a historical legacy record.

## Shared numerator, denominator, and missing values

Except where a count, a relative weight, or a difference is specifically noted otherwise:

```text
planned = the number of probe samples obtained for this metric
denominator = the number of samples with included=true
numerator = the number of samples with included=true and numerator=true
failed = the number of samples with included=false
value = denominator > 0 ? 100 × numerator / denominator : null
complete = planned > 0 and failed=0
pointState = no_data when denominator=0, otherwise complete or partial
```

`failed` means "failed or excluded," which can include a not-applicable offline citation sample, an unknown, or a missing value — not only a provider request error. `planned` comes from probes that have already been persisted and read back; it is not necessarily equal to the whole run's `plannedProbeCount`, since a probe not yet written mid-execution never automatically appears here. Building statistics before a run finishes carries a risk of incompleteness.

A failure or a missing value is never read as "the brand did not appear." A 0% under a valid denominator is a genuine miss; `null` means it could not be computed. A recognition category is never converted into an arbitrary 100/50/0 score. D and K handle `unknown` differently, detailed below.

## D: domain recognition and keyword association

The shared sample set is the current model's, current object's, own-domain D probes. **As long as a `DomainProbeResult` exists and `analysisStatus` is not `analysis_failed`, it enters the denominator.** The current code does not additionally require `domainRecognition` to be non-null, a brand field to exist, or the keyword field to be complete — so `recognized`, `not_recognized`, `unknown`, `ambiguous`, `partially_recognized`, and a result recovered from only some fields can all enter the denominator.

| User question / metric | Numerator and value | Denominator, exclusions, and explanation |
| --- | --- | --- |
| Did the model recognize this domain? `domain_recognition` | Sample count where `domainRecognition` is exactly `recognized`; computed as a percentage | All parseable D above; `unknown`/`not_recognized`/`null` do not hit but still count in the denominator — this is not an organic-discovery rate |
| How many times was this keyword associated? `keyword_association_count` | Number of answers whose `associatedKeywords` contains this keyword; the value is that count, in units of count | Still uses the parseable-D denominator from the table above; it is not the literal number of times a keyword repeats inside one answer |
| How many answers associated this keyword? `keyword_association_coverage` | Associated-answer count / parseable D × 100% | The same keyword repeating inside one answer counts once; a keyword field missing and parsed as an empty list can also count as a miss |
| What share of the monitored-keyword set does this keyword hold? `keyword_relative_weight` | This keyword's associated-answer count / the sum of every monitored keyword's associated-answer count × 100% | The denominator is the total association-event count, not the answer count; `null` when that total is 0 |

Keyword matching is exact equality after trimming and lowercasing only; it never merges synonyms, translations, or word forms. Each answer is first turned into a set. Relative weight is computed only within the current WatchSet's full monitored-keyword set, including a keyword unsuitable for K; one answer associating two monitored keywords contributes twice to the total denominator.

An implementation detail of relative weight: the numerator takes the count of valid D hits, but the total denominator loops over every already-read D's `associatedKeywords` without an additional explicit `analysisStatus` check — a normal parse failure outputs an empty list, but an anomalous or edited archive needs an extra check. A weight point inherits its `samples`, `planned`, `failed`, and `complete` from the association-count point, only replacing the denominator with the association total, so this denominator cannot be directly recomputed from the `included` sample count.

The association count is a special case: with a zero denominator, it currently still gives `value=0` while `pointState=no_data`; this count of 0 must never be reported as "zero association was observed." Relative weight is not a search-popularity, model-attention, commercial-value, or whole-market share signal.

## K: neutral selection, mentions, and recommendations

The shared samples come from the current model's, current keyword's, K probes. When the structured output's `analysisStatus=completed`, the service sets all four judgments to `adjudicable`; when it is `unknown`, all four are `unknown`. A parsing failure is also `unknown`. So although these four judgments are separate fields, the normal build path currently shares one eligibility condition: overall `completed`.

| User question / metric | Numerator | Denominator and special cases |
| --- | --- | --- |
| Was this object mentioned? `brand_name_mention` | Any `mention` whose `matchedObjectId` equals this object | K with `mentionJudgment=adjudicable`; can be hit by a domain match alone, so this internal name is not the same as a strict literal brand-name detection |
| Does the answer contain this domain? `domain_body_mention` | The first attempt's `rawAnswer` hits the object's domain via `includes` | Same denominator as above; a case-sensitive substring check, not an independent word boundary or a URL-host check — a JSON or URL field can also hit |
| Was it positively recommended? `positive_recommendation` | A matched object with `recommendation=positive` | `recommendationJudgment=adjudicable`; `negative`, `mentioned`, and `uncertain` all miss |
| Was it the sole first mention? `first_mention` | Exactly one entry across all mentions has `firstMentionState=unique` and it belongs to this object | `firstMentionJudgment=adjudicable`; `tied`, `none`, `unresolved` all miss, but as long as the judgment is adjudicable it still enters the denominator |
| Was it the sole first recommendation? `first_recommendation` | Exactly one entry across all mentions has `firstRecommendationState=unique`, matches this object, and is `positive` | `firstRecommendationJudgment=adjudicable`; a tie or an unresolvable case does not count as a hit |
| Did a web-enabled answer return a provider source for this official site? `provider_citation` | A `providerCitations` entry exists whose domain is exactly equal to the object's domain | Requires `webSearchMode=provider_native` and `mentionJudgment=adjudicable`; excluded as `offline_not_applicable` when offline |

`completed` with `mentions=[]` is a valid zero-mention/zero-recommendation answer; `unknown` or a parsing failure has no valid denominator for these ratios. When an object's domain is `null`, a body-text domain match and a citation can never hit, but the current code can still count it toward the eligible K denominator.

Identity matching, after a response comes back, does an exact lookup by normalized name/alias or normalized domain, succeeding only with a single matching object; multiple matches are `unresolved`. A match does not require both the name and the domain to agree, and it is not an external identity fact-check.

Evidence limits: the positive-recommendation and ordering metrics take the model's own structured labels directly — though a snippet and its UTF-16 offset are stored and an attempt is made to locate it, the statistics do not require the snippet to be non-empty or valid, and the offset is not used to independently recompute the true first position. So this should be called "the positive recommendation / sole first position this structured answer reported," with the raw text checked — it must never be claimed that every ordering relationship has been independently verified.

Citation eligibility uses the requested configuration mode; it does not check whether the attempt's actual `used`/`usedMode` confirmed a search happened, and the source set does not exclude `provider_search_result` either. So the "official-site citation" name in the current chart does not automatically prove it was the answer's citation, still less that the page caused the recommendation. For the real source classification, go back to [evidence model](evidence-model.md).

## The recommendation gap within one batch of answers

`recommendation_gap` uses the target as `objectId` and an identity-confirmed competitor as `comparisonObjectId`:

```text
value = target's positive_recommendation percentage − competitor's positive_recommendation percentage
unit = percentage_points
```

`pairedRecommendationGap()` requires both inputs to be positive-recommendation metrics, with the same `runId`, `modelId`, search configuration, and `keywordId`, equal and positive denominators, equal-length `samples`, and each position in the array checked to share the same `probeRunId`. Otherwise it is `null`. The output keeps the target's numerator/denominator and `comparisonNumerator`/`comparisonDenominator`.

This is a paired difference within one batch of matched answers, not the relative growth rate between two independent percentages, and it does not represent market share. The current function does no additional item-by-item comparison of the `included` mask or attempt IDs, so a recheck should still verify the underlying samples; a result under a different keyword, model, or web-enabled-versus-offline condition must never be subtracted directly.

## First-attempt policy and current gaps

Statistics' `firstAttempt()` selects only `probe.firstAttemptId`; `sample.attemptId` and the body-text domain check both read that same attempt. A retry appends an attempt without adding to the probe count, so it does not simply inflate the total sample count.

**But the current result and citations are stored once per probe, not once per attempt.** `probeDetail()` returns the `domainResult`/`keywordResult`/`mentions`/`evidence` most recently written for that probe, and statistics use those same values. If the first attempt failed and a retry succeeded, it is possible for `sample.attemptId` to point at the failed first attempt while the numerator/denominator or citations actually come from the successful retry. This is an implementation gap; it must never be written up as "a first failure is never replaced by a later result."

A stats snapshot's ID uses only the run, probe, and first-attempt-ID list — it does not include the result content, the attempt status, the formula version, or a citation hash. A snapshot built early, or built before a retry, can keep being reused. Before publishing a computed figure, wait for every planned probe to reach its final state and check the citation/`result.attemptId` against `sample.attemptId`; where they disagree, mark it "needs recheck," keep the raw record, and never pick whichever reading is more favorable.

The initial recognition report uses `currentAttemptId` separately, and can include a truncation retry — the chart's first-sample policy does not apply to it. The recognition status in a report and a measurement point are different things and must never be blended into one combined "D success rate."

## One point, one line, and the time window

Every metric in the tables above generates a point per run, model, object, and matching keyword, with `observedAt` set to `Run.startedAt`, falling back to `createdAt`. It is not the completion time of a single answer, nor the time statistics were generated, exported, or screenshotted. Different model points each keep their own denominator; they are never averaged into an undefined composite score.

A probe's fingerprint includes the provider/model, the requested search mode, the protocol ID/version, the language, `scenario`, `subject`, `repetitions`, `temperature`/`maxTokens`, and `matchingRuleVersion`. K also includes a `keywordSetHash` over every eligible K keyword, sorted; D's `keywordSetHash` is currently `null`. The fingerprint does not include the baseline ID, the WatchSet ID, an object's alias, the actual search execution, the upstream model version, or the actual prompt/schema hash.

The resulting boundary: adding an unrelated model never requires backfilling old models; a new model starts from its own real probes. D's keyword relative weight can keep the same fingerprint even after the keyword set changes; a change to K's identity aliases also does not necessarily change the fingerprint. When comparing, also check the scope and the semantic version separately — never rely on the fingerprint alone.

The current [measurement interface](../src/ui/product-phase5-app.ts) offers all-time and a rolling 7/30/90 days, filterable by manual/scheduled, search configuration, and retired models, with no "last complete run of the day" selection and no confidence interval or automatic statistical-significance computation. The horizontal axis lays out different time points at equal spacing, not scaled to the real interval between them; read the actual time span from the tooltip.

Plotting groups by `modelId` + `webSearchMode` + fingerprint. A non-null `partial` point is shown but breaks the path; a single point only forms one visible dot, with no usable trend segment. But `null` points are filtered out first, so the valid points before and after can end up connected across the gap. The association chart also does not filter or group by the selected `keywordId`, so multiple monitored keywords can end up mixed into the same series. The current title "complete run per point" is stronger than the actual per-metric `complete` threshold — go by the sample detail instead.

## Recheck steps and the scope of a conclusion

1. Fix the project, run, model, D/K, object/keyword, requested and actual search condition, and version.
2. Read every sample, including misses and exclusions, through `measurement-stats`'s point-samples endpoint.
3. Check that `firstAttemptId`, `sample.attemptId`, the result's attempt ID, and the citation's attempt ID all agree with the raw text.
4. Recompute the numerator/denominator for the matching metric; compute the relative weight's association total separately, and check a recommendation gap against the same probe set.
5. Report the valid sample count, the planned count, failures/exclusions, unknowns, unknown costs, and the actual timestamps together.
6. Only describe a change across at least two observations that share the same scope with complete evidence; even three observations do not automatically produce statistical significance.

This round's R02 data is still pending, with no real number here to recompute from it yet. Phase 6's 20 domains are a targeted set of software/internet products, not a random market sample, and do not support an industry-wide conclusion. A competitor or keyword not listed does not mean it does not exist in reality; an offline-versus-web-enabled difference is not an independent experiment about which model is better; a change does not prove a causal effect from a GEO action. See [limitations](limitations.md) for the current execution and cost gaps.
