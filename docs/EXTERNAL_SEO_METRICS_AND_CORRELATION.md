# External SEO Metrics and Correlation

## What CiteGEO measures today

CiteGEO has a strong durable measurement model for AI visibility: an
immutable WatchSet and model configuration are sampled on a schedule, with
the prompt, response, provider route and evidence retained for every point.

Search Console and GA4 remain readable as current rolling reports, and each
new successful pull also appends a source-labelled metric snapshot. Ahrefs and
Semrush estimates are deliberately pulled only on request because they consume
provider units. The Setup data-history component shows these as dated points,
not as a fabricated real-time counter.

Ahrefs and Semrush are now registered in Setup as encrypted credentials (or
environment-owned credentials):

| Connection | Key | Required fixed scope | What it is for |
| --- | --- | --- | --- |
| Search Console | Google OAuth or service account | property, search type, country/device filters | observed Google Search clicks, impressions, CTR and position |
| GA4 | same Google credential | GA4 property, channel and conversion definition | observed sessions, engagement and conversions |
| Ahrefs | `AHREFS_API_KEY` | country and target/mode | estimated rankings, traffic and link authority |
| Semrush | `SEMRUSH_API_KEY` | regional database and target scope | estimated rankings, traffic and competitor landscape |

Ahrefs' Site Explorer metrics endpoint requires a date, target, mode and
country; Semrush Domain Overview is database-specific. The two providers use
different indices and estimation models, so their traffic and authority values
must remain source-labelled and must not be averaged with GA4 or with each
other. See the [Ahrefs Metrics API](https://docs.ahrefs.com/en/api/reference/site-explorer/get-metrics)
and [Semrush Domain Overview API](https://developer.semrush.com/api/v3/seo/overview-reports/).

## The continuous-data contract

Add a separate immutable `ExternalMetricSnapshot` stream. It must not be
stored as a property on an AI MeasurementRun, because external systems have
their own reporting lag and cadence.

```text
ExternalMetricSnapshot
  projectId
  source: google_search_console | google_analytics | ahrefs | semrush
  metricDefinitionVersion
  sourceScope         # property/database/country/device/channel/target
  observedAt          # when CiteGEO fetched it
  periodStart, periodEnd
  dataFreshThrough     # newest date the source says is complete
  values               # source-native metric names and numbers
  completeness         # complete | preliminary | partial | unavailable
  collectionId         # one scheduled collection occurrence, when scheduled
```

Rules:

1. Append snapshots; never overwrite a prior good snapshot.
2. Persist the source scope and definition with every point. A property,
   channel, country, database, metric definition, or target-mode change starts
   a new series instead of silently extending the old line.
3. Keep `observedAt` separate from `dataFreshThrough`. GA4 and GSC have
   reporting latency; Ahrefs and Semrush indices update on their own cadence.
4. Retain the raw, redacted provider response or a checksum plus normalised
   values. This makes a chart auditable when a provider revises data.
5. Record failed/partial pulls as collection events, but never coerce them to
   zero-valued metric points.

Recommended pull cadence: daily for GSC and GA4 (using a trailing, completed
28-day window); weekly for Ahrefs/Semrush estimates; and the existing selected
cadence for AI measurement. A future scheduled collector should run
independently from the AI model scheduler, then assign all observations
collected in the same cycle a `collectionId`. It must never make a paid
third-party API call merely because an AI measurement ran.

## What the platform should show

Use three linked panels, each preserving source identity:

```text
AI visibility     ─── named/recommended/cited rate by probe fingerprint
Search demand     ─── GSC clicks, impressions, CTR, position by query/page
Business outcome  ─── GA4 organic sessions, engaged sessions, conversions
Context           ─── Ahrefs/Semrush organic estimates, rank coverage, links
```

Each chart needs a shared date selector, a source badge, its source lag, its
scope, and a link to the exact stored observations. A combined timeline can
overlay normalised changes (for example, percentage change from the first
complete 28-day period), but not raw values with incompatible units.

Useful operational joins are:

| Question | Join level | Valid comparison |
| --- | --- | --- |
| Did AI visibility move before search demand? | topic/prompt family × weekly period | AI mention rate with GSC query impressions/clicks |
| Did search visibility become traffic? | canonical landing page × completed 28-day period | GSC clicks with GA4 organic sessions |
| Did a content change precede a movement? | URL/action date × future periods | action log with GSC/GA4 and AI metrics, using lags |
| Did authority change alongside organic reach? | domain × country/database × monthly period | Ahrefs **or** Semrush estimate with GSC/GA4, source-labelled |

The canonical URL is the safest page-level join key. Query text, brand names
and domains require normalisation tables; never join them with substring
matching alone. The platform should expose unmatched rows rather than losing
them in an apparently complete total.

## Correlation, not false causation

Build correlation only after at least 12 aligned weekly points (24 is better),
and show it as an exploratory relationship:

1. Resample to a common **completed** weekly period, using each source's
   `dataFreshThrough` date. Do not compare today's GA4 row to today's AI run
   if Search Console is still three days behind.
2. Compare changes or indexed values, not raw units. Example: weekly change
   in AI visibility rate versus change in GSC clicks.
3. Calculate Pearson (linear movement) and Spearman (monotonic movement)
   coefficients, sample count, confidence interval, and 0/7/14/28-day lag.
4. Select the best lag only as a hypothesis, and label it as multiple-testing
   exploratory analysis. Do not say that a positive coefficient proves AI
   visibility caused traffic.
5. Suppress a result when either series is incomplete, has fewer than 12
   aligned points, has too little variation, or changes scope mid-series.

A particularly valuable view is a lead/lag heatmap: rows are AI visibility,
GSC clicks, GA4 organic sessions, Ahrefs/Semrush estimated traffic and
referring domains; columns are lag weeks. Clicking a cell opens its exact
paired snapshot IDs and the excluded dates. That is much more actionable than
a single opaque "correlation score".

## Delivery order

1. [Done] Append source-labelled snapshots to current GSC and GA4 reads.
2. [Done] Add Ahrefs and Semrush on-demand snapshot adapters, respecting each
   provider's API-unit budget.
3. [Done] Ship a source-labelled data-history timeline and a minimum-evidence
   correlation gate in Setup.
4. [Next] Add an independent scheduled collector and collection-event ledger.
5. [Next] Add a visual normalisation/alignment panel with confidence intervals
   and inspectable paired snapshot IDs.

This order protects CiteGEO's existing evidence discipline: a missing or
incompatible external value remains missing, rather than becoming a fabricated
zero or an unjustified causal claim.
