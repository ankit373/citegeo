# Evidence model and source rules

Applies to: the current product implementation, planned for release as **v0.2.0-rc.1, UNPUBLISHED**. This page defines how to read a stored record and points out the guarantees that are not yet implemented. This round's R02 case keeps an actual partial completion and its raw text; the R04 case's web-enabled K response includes provider citations traceable to a structured payload path. Other answers with no citation still show an empty result rather than being backfilled from a plain link.

What is published is this run's answer and its evidence; it does not expose the model's internal reasoning, and a rerun is not guaranteed to produce an identical answer.

## Tracing a conclusion back to the raw text

The two evidence entry points sit at different layers:

```text
Recognition report → sourceAttemptMap → RecognitionModelRunAttempt
         → RecognitionArchive → field / competitor / keyword / provider citation / plain link

Measurement point → samples → ProbeRun → firstAttemptId / ProbeAttempt
       → DomainProbeResult or KeywordDiscoveryResult / mentions / evidence
```

A user rechecking a result needs the raw answer, the request conditions, and the specific field relationship; a run ID or a list of URLs alone is not enough. The project, run, model-run, and attempt IDs scope the evidence to one execution; they are reference identifiers, not proof that the content is true.

## Raw attempt record

The [recognition schema](../src/product/recognition/recognition-schema.ts) and the [measurement schema](../src/product/measurements/measurement-schema.ts) define an attempt's core fields:

| Field | How to read it |
| --- | --- |
| id, projectId, runId, modelRunId, attemptNumber | Locate the project and execution order; a measurement also carries probeRunId |
| status, errorCode, errorMessage | Distinguish a failed request, unsupported capability, parsing failure, and a normal result |
| promptHash | Hash of the prompt actually generated this time; the attempt itself does not store the full outbound HTTP request |
| requestParameters | Model, temperature, maxTokens, schema name/hash, structured-output transport, search configuration |
| rawProviderResponse | The response object the adapter kept, not a network capture that includes headers |
| rawAnswer | The answer text the adapter extracted; it may be JSON or tool-argument text and is not guaranteed to be a natural-language paragraph |
| providerId, providerModel, providerModelVersion | Records OpenRouter and the returned model info; the field value is not a guaranteed disclosure of an immutable model-weight version |
| providerSearch | The provider adapter's actual search-execution info, kept separate from the requested mode when reading it |
| tokenUsage, costUsd, latencyMs | Records only the usage, cost, and latency actually obtained; a missing cost should read as unknown, never backfilled with 0 |
| createdAt, startedAt, completedAt | Lifecycle timestamps; never substitute an export time or a screenshot time for these |

A failed request may have no raw text and no provider payload; a parsing failure may still have received a complete or a truncated answer. Currently, initial recognition writes `response_saved` first and parses afterward; the measurement service writes the attempt containing the raw text later than its derived result/evidence, so an interrupted process can leave a record where the derived result exists but the raw text has not yet been persisted.

## Fields, empty values, and local parsing

In a recognition archive, `RecognitionResult` stores the domain-recognition claim, the analysis status, the brand/business/category claims, `unknowns`, `fieldIssues`, and `mappingVersion`. Every claim uses `{ value, evidence }`; a competitor's keywords also keep their ownership via `competitorRecognitionId`, and must never be aggregated and mistaken for the target's own keywords.

| Recorded state | Meaning |
| --- | --- |
| domainRecognition=unknown | The model gave no definite recognition conclusion; this is not the same as a failed request |
| domainRecognition=not_recognized | The model explicitly did not recognize it; this is not the same as a missing field |
| value=null / a field issue | The field could not be obtained or has no definite value; combine with the issue to judge whether it is missing, invalid, or conflicting |
| A valid empty array | Nothing was listed this time; this is not the same as it not existing in reality |
| analysisStatus=analysis_failed | Local parsing produced no usable structured result; this does not mean the provider returned no raw text |
| localAnalysis=partial | Only some fields were recovered locally; this is not a "partial recognition" score for the brand |

The parser supports the current structure plus a limited compatibility field mapping, and records `missing_field`, `invalid_field`, and `conflicting_field`. A measurement's `DomainProbeResult` is a trimmed projection; it does not fully retain the `fieldIssues`, per-competitor keywords, or all field evidence found in a recognition archive. Checking a missing value or an empty array may still require the raw text; the two kinds of D must not be claimed to have identical derived fields.

`AnswerEvidenceLocation`'s `start`/`end` are in **UTF-16 code units**, with `end` as an exclusive boundary. The verification condition is `rawAnswer.slice(start, end) === quote`. It is not a UTF-8 byte offset. When location fails, `evidence` is `null`; an offset must never be invented. When the same text appears multiple times, the first exact match is generally taken.

A report marks evidence as valid/missing/invalid, but this is a text-slice match, not fact-checking. K's quote/offset also attempts to locate itself, but the recommendation and ordering metrics do not yet enforce evidence integrity as a hard gate.

## Three kinds of source must be kept separate

| User-facing category | Raw field and meaning | What it can prove |
| --- | --- | --- |
| Provider citation | A structured annotation or citation array, etc.; keeps `providerPayloadPath` | The provider returned this citation item in this response |
| Search result | A search-tool result list with `source=provider_search_result`, etc. | This URL appeared in the search results; it is not automatic proof the answer cited it |
| Link in the answer | `source=answer_text_url`; a URL in the body text or in model-generated JSON | A URL appeared in the answer text; it is not proof the provider searched for it or cited it |

A citation existing does not mean the page has been verified, that its content is necessarily correct, that the page is official, or that it caused the model's recommendation. With no provider citation, use "**no provider citations were returned in this run**"; a link appearing in offline body text is still just a plain link and must never be used to infer training sources or that a search actually happened.

[citation-extractors.ts](../src/providers/citation-extractors.ts) reads a provider's sources from structured fields, extracts links from the answer with linkify-it, and parses URLs with the URL API. The same source+URL is de-duplicated and re-numbered as `citationIndex`; the original array position should be read from `providerPayloadPath` or `rawProviderResponse`, and the re-numbered index must never be treated as the original position.

The typical paths below come from an adapter's actual field convention. They are a description of the path, not a response actually obtained this round:

- `choices[0].message.annotations[index].url` or `.url_citation.url`: Chat Completions-style annotation.
- `output[index].content[index].annotations[index]...`: Responses-style annotation.
- `citations[index]`: a provider citation array.
- `search_results[index].url`: a search result; this category must be kept separate.
- `candidates[0].groundingMetadata.groundingChunks[index].web.uri`: a grounding source; judging its relation to the answer needs the raw response too.

The later adapter kinds exist in the shared provider layer; this does not mean the current product directly exposes a call entry point for every provider. The current product goes through OpenRouter; which field kind is actually used is governed by that attempt's response and adapter.

### Current classification boundary

Initial recognition's `providerCitations()` requires `answer.search.requested` and requires a title and a payload path; it excludes `answer_text_url` but does not separately exclude `provider_search_result`. The measurement path does not check `search.requested`, falls back to the domain when a title is missing, and only excludes `answer_text_url`/items with no path. So the two entry points are not fully consistent in what they keep as a source, and a search result can still end up inside the set named `providerCitations`.

**A collection's name is not a substitute for a provenance check.** A public export should distinguish a citation from a search result by `providerCitationSource` and the payload path; where no separate classification exists, state the limitation rather than claim the current UI already fully implements all three entry points. The measurement citation rate also does not yet force a check against the actual search `used` status; see [methodology](measurement-methodology.md).

A `ClaimCitationLink` is only established when a `citationUrls` URL listed in the model's own field matches an already-stored `ProviderCitation` URL from this run; the model writing a URL on its own never spontaneously generates a new `ProviderCitation`. The link represents the correspondence between the model's claim and an already-returned source, not that semantic support or causation has been verified. A report checks whether `providerPayloadPath`'s value in the raw response equals the archived URL; a mismatch can be flagged `evidence_integrity_error`.

## Native search and SDK paths

[openrouter-native-search.ts](../src/providers/openrouter-native-search.ts) chooses between `server_tool` and `built_in_grounding` based on the model's capability. A `server_tool` request uses `openrouter:web_search`, `engine=native`, and `tool_choice=required`; the actual path is read from the `server_tools` stage's mode inside `openrouter_metadata.pipeline`. Requesting `native` does not prove the model actually executed it natively in the end.

| executionMode | The current adapter's interpretation |
| --- | --- |
| native | OpenRouter's metadata confirms the native path |
| sdk | OpenRouter's metadata confirms a server-side tool's SDK path; **this does not claim the model has built-in search** |
| unverified | No matching path was confirmed; actual execution must never be inferred from the requested mode alone |
| provider_always_on | The capability is flagged as built-in grounding; the raw evidence and verification notes still need checking |

Both SDK and native can currently be classified as `usedMode=provider_native` inside `SearchExecution`, and a report's short label may show "Provider-native web search" for both. `executionMode`, its note, and the raw metadata should all be disclosed together; the two should never be directly compared as if they were the same actual path. `built_in_grounding` uses whether annotations/search_results/citations are non-empty as a confirmation clue, but `alwaysOn` can set `used=true` inside the shared search-status builder — never judge it from the `used` boolean alone.

The adapter throws `empty_answer` when the returned text is empty, even though the response may still contain tool metadata; a failure like this is not a guarantee that the full payload made it into the product's attempt. The combination of strict JSON Schema, a required tool, routing-parameter support, and search behavior still needs a real preflight; a catalog capability flag or an HTTP 200 is not a substitute for verification. The saved real results for all three paths are in the 20-case index; do not generalize them to an untested model or route.

## Actual scope of versioning and immutability

| Version field | Current value / meaning |
| --- | --- |
| D protocol | domain-recognition/v1 |
| K protocol | keyword-discovery/v1 |
| Baseline.analysisVersion | recognition-analysis/v1 |
| Local re-analysis analyzerVersion | recognition-analysis/v2 |
| Field mappingVersion | recognition-current/v1 or recognition-compatibility/v1 |
| Report schema | recognition-report/v1 |
| Report grouping | exact-name-host/v1 |
| Measurement matching | measurement-matching/v1 |

These version fields sit at different layers and must never be merged into one "unified analysis version" just because their names look similar. A protocol snapshot's `promptTemplateHash` is also not always the full-text hash of the current prompt function; each attempt's own `promptHash` is closer to the prompt actually generated, and a full rebuild also needs the same source code version and input.

A recognition retry appends an attempt and that attempt's own `RecognitionArchive`. A re-analysis appends a revision, including `sourceRawAnswerHash`, `analyzerVersion`, and its archive, without changing the original answer. A report selects `currentAttemptId` and its matching original archive; the detail page prefers the latest revision, so a display difference between the two can appear.

A report stores `sourceFingerprint`, `sourceAttemptMap`, `sourceRecordHashes`, and `reportRevision`. A record hash uses `sha256(JSON.stringify(value))`, **not a file-byte hash that includes indentation and a trailing newline**; a public evidence bundle should compute the file's SHA-256 separately. The stability check at report-creation time compares the run/model-run status and the current attempt ID; it is not a cross-file transaction or continuous tamper detection.

A measurement's probe attempt keeps its first/latest ID, but its result and evidence files are overwritten per probe. A stats snapshot caches only by run/probe/first-attempt ID, and is not guaranteed to auto-update after a retry, a status change, or a formula change. Public material must state which attempt was actually used and verify the link; "immutable evidence" must never be used to paper over this gap.

## Read-only recheck and export

The current product offers a JSON read API, with no general-purpose PDF/CSV/public-evidence-bundle export endpoint. See [architecture](ARCHITECTURE.md) for the product API list. Generating a recognition report, generating measurement statistics, and local re-analysis all send no inference, but they do write a derived file; a plain GET read of a report/attempt/probe should never be labeled a new measurement.

The current case index has local redacted evidence and an index already, not yet a public release. When reading it, check the following links; any missing release information is still pending:

- caseId, the original domain, and the version and file hash of the study plan and the keyword manifest.
- Product source/build inputs, the candidate image digest, and the documentation version, marked pending where missing.
- Every run/model-run/probe/attempt ID, its planned and actual time, status, request parameters, and actual search info.
- Per-file relative path, byte hash, raw-text and citation path, and the samples and exclusion reasons behind each metric.
- Every attempt's cost, unknown-cost cases, and retry notes; costs must never be summed from only the final successful attempt.
- A screenshot's original run time and its own capture time, viewport, evidence ID, file hash, and image digest.

Raw payloads and traces are kept in an isolated archive; the public redacted copy has its own hash and change notes; a local absolute path, `localhost`, or a temporary URL must never be treated as permanent public evidence. Case Markdown lives at `examples/cases`, serving raw text, images, and evidence directly, with no case service required; the export never writes a case project into the user's own data root directory. The 7 conflicts and 18 analysis failures are linked item by item at [known issues](known-issues.md).

A report's `safeProviderResponse()` is currently only a JSON-serialization check; it does not redact secrets or personal information. Before anything is made public, it still needs a check for API keys, auth headers, internal account identifiers, personal information, and sensitive URL parameters; record which fields were redacted and the distinction between the original and the copy. A hash check helps detect a change, but it is not proof that content is correct or that a source is trustworthy.

An external page being unreachable now does not make the raw answer disappear; a page-reachability check and the URL the provider actually returned at the time are two different things. The product itself makes no guarantee that a source page will remain available long-term. A later re-request to the model should be called a "re-measurement"; reading an old record should be called an "archive replay."
