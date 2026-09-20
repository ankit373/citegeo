# Working in this repository

Conventions that are already load-bearing here. They are not style preferences:
each one exists because breaking it has already cost something.

## The product's one rule

**An absence is reported as an absence.** Never as a zero, never as a default,
never as a plausible-looking value.

- Visibility with nothing parsed is `null`, not `0%`.
- Share of voice with no competitor named is `null`, not `100%`.
- A classifier that failed returns `unknown`, not `neutral`.
- A crawler log that does not exist reports "not configured", not "no crawlers".

If a number cannot be derived from stored evidence, the type is nullable and the
UI says so in words. A tool whose whole claim is "here is the receipt" cannot
round up.

## Layout

```
src/core          shared types
src/config        environment and secret resolution
src/providers     model providers and their capability catalogues
src/product/*     the current product, one directory per domain
src/ui            emitted HTML shells
src/site          the marketing page
scripts/          checks and build steps run by CI
```

Everything in `src/` outside `src/product`, `src/ui`, `src/site`, `src/core`,
`src/config` and `src/providers` belongs to the **legacy workbench** reached
through `src/server.ts`. It still works and is still tested. Do not extend it,
and do not import it from `src/product`.

Two names exist in both worlds (`src/insights` and `src/product/insights`,
`src/projects` and `src/product/projects`). When touching either, check which
one you are in.

## HTTP

Every route lives in a `*-http.ts` in its own domain directory and exports one
handler with this shape:

```ts
export async function handleXApi(input: {
  method: string;
  route: string[];
  send: JsonSender;
  service: XService;
  readJson?: () => Promise<Record<string, unknown>>;
}): Promise<boolean>   // true when it handled the request
```

`product-server.ts` composes handlers and owns nothing else. Adding a route
inline there is how it grew to 49 imports, so do not.

## Composition

**Build the service graph once, in `createProductServices`.** It used to be
rebuilt per request, which silently discarded anything a service held between
calls: the insights cache cached nothing, and the measurement service's
in-flight set was always empty. Fixing it took one request from 60ms to 1.2ms.

A service that holds state across calls only works if something holds the
service.

## Providers

**A provider describes itself once, in `src/product/configuration/provider-access.ts`.**
Its label, cost posture, search posture, endpoint and setup note all live on one
row. The credentials form, the Setup page and the status builder are all derived
from that table.

This exists because the list used to be repeated in four places and only one of
them was ever updated: the shared catalogue implemented eight providers while
the product offered three, so an empty balance at a single aggregator stopped
the whole tool.

**Models come from the provider, not from us.** A hardcoded model list goes
stale silently. The catalogue still named `gemini-1.5-flash` long after Google
had retired it, and nothing in the product could tell. Where a provider
publishes a listing endpoint, read it and mark the provider `supportsAnyModel`.
Only where none exists does a declared list apply.

**Web search is the dividing line, and it is stated per provider.** The citation
gap, cited domains and query fanout are built from citations; visibility, share
of voice and sentiment are not. A provider that cannot search still powers the
second half, so say which half it powers rather than calling it unsupported.
## Discovery

**A domain is the only input the product should need.** `src/product/discovery`
reads a handful of pages a person would open to answer "what is this", and asks
a model to describe the company from those pages alone. Generation falls back
to it whenever nothing else knows the brand, so nobody types a description.

The model is told to use the pages and **not** what it already knows about the
name, and that an absent competitor list is a correct answer. A brand no model
recognises still has a homepage; a brand it half-recognises is worse than one it
does not, because it will confidently describe the wrong company.

A profile records the pages it came from, so a wrong one is traceable. A read
that fails saves nothing rather than a half profile.

## Prompts and topics

**The unit of measurement is the question a buyer types, not a keyword.**
`src/product/topics` holds the topic set, the prompt engine and the scoring.
A keyword collapses "best stock screener for indian markets" and "screener.in
alternatives" into one thing; they reach the same buyer through different
answers, so they are different prompts under different topics.

**A generated prompt set is proposed, never active.** What buyers ask is not
something this tool can observe, so a model suggests it and a person approves
it. A generation that returns nothing usable saves nothing, and passes the
model's own reasons back rather than a dead end.

**A prompt that names the brand cannot measure visibility.** The model will
discuss it whatever it thinks, so `measuresVisibility` is false and the prompt
still measures sentiment and framing. Identity matching is on whole tokens: a
brand called Ten is not named by the word "often".

**A score is reported with its components and its weights.** Presence,
prominence and sentiment are always shown next to the composite, and the two
floors in `visibility-score.ts` are named constants that travel with every
score, because they are a judgement rather than a measurement.

**`structuredOutput.value` may be a parsed object or a JSON string, sometimes
fenced.** Always read it through `readStructuredValue`. Assuming an object gives
an object-shaped read of a string: every field is absent and a correct payload
is discarded as empty.

## Rivals

**A rival you track and never see reads as zero, not as absent.** It was asked
about and the answer is none; omitting it hides the finding. With nothing
answered at all the share is `null`, because that is a different state again.

Declared rivals are separate from whoever the models happened to name. Adopting
takes both what the site names and what answers named more than once.

## Demand

**A corpus figure is a historical sample and says so.** `src/product/demand`
reports how often anyone asked something like a tracked prompt, from an openly
licensed corpus of real conversations. Every figure carries that corpus's own
caveat, and two counts are always reported, because quoting either alone
misleads.

Zero matches means nobody in that sample asked it. An empty corpus reports
`null`, because zero over zero is not zero demand.

**No third-party hostname in `src/`.** `architecture-constraints` fails on one.
Download instructions live in `docs/`.

## Storage

**Everything stored is a small JSON document under a key**, which is why it can
sit on a disk or a bucket. `src/product/storage` holds the `ObjectStore`
interface and one adapter per backend: the disk, anything S3-compatible (AWS,
R2, GCS through its S3 API, MinIO, Spaces, B2) and Azure Blob.

Signing is written here rather than taken from an SDK, the same judgement as
the GitHub client. The signing-key derivation is checked against the vector AWS
publishes, so the crypto is verified rather than hoped at.

**A connection is only connected once it has written, read back, listed and
deleted a probe object.** Anything less reports a configuration that fails on
the first real write. Listing is part of it because a key can write and still
not appear, which makes every past run read as empty.

**Settings live on disk, never in the bucket they configure**, or the product
could not read its own configuration to reach its storage. Secrets are
encrypted with `CREDENTIAL_KEY` and never sent back to the page.

**Every store goes through it.** Nothing under `src/product` touches
`node:fs` for data any more. A store composes keys with
`projects.keyFor(projectId, ...)` and reads and writes through
`projects.objects`.

**Locks stay on local disk whatever the backend is.** They need an atomic
create-if-absent, which object storage does not offer portably, and the
deployment is single-writer so a local guard is the right scope. The scheduler
keeps its once-only guard local and the occurrence itself in the store.

**The local adapter prunes empty directories**, because object storage has no
such thing and a purged project must leave nothing behind.

One key prefix per project. Every write is **temp file then
rename**, never a direct write, because the worker writes while the server
reads the same volume.

The deployment assumes a single writer (`replicaCount: 1`, `strategy:
Recreate`). Scheduled work runs in the same worker process for that reason. A
second writing process needs that invariant revisited first, not worked around.

## Things this codebase bans

**No regular expressions in `src/`.** `test/architecture-constraints.test.ts`
parses every file and fails on a literal or a `RegExp` constructor. Parse by
hand: `indexOf`, `split`, `startsWith`.

**No `Signed-off-by`, `Co-Authored-By` or generated-by trailers** in commits.

**No new dependency for a handful of calls.** The GitHub integration calls four
endpoints directly rather than taking an SDK and its supply chain.

## Design

**One theme, in `src/ui/theme.ts`.** Tokens used to be redeclared in four files,
the login page, the project app, the workbench and the product shell, and they
drifted because nothing made them move together. Never write a colour, a font
or a radius as a literal in a surface; add a token.

Warm paper, a single terracotta accent, a text serif for headings against a
neutral sans, hairline rules instead of boxes. Light is the default and dark
follows the system, overridden by `data-theme` on the root and applied by an
inline script before first paint.

**A hardcoded hex survives a theme change and then looks broken.** The alert
boxes stayed black on paper for exactly this reason. State colours have `--x`,
`--x-text` and `--x-wash` so a badge never needs one.

**An image asset cannot change colour.** The brand lockup was light ink baked
into a file and vanished on paper. It is drawn inline and takes `currentColor`.

## The emitted-HTML shells

`src/ui/*-app.ts` return giant HTML strings with inline `<script>`. TypeScript
cannot see inside them, so it will not catch a syntax error, an undefined
variable or a broken CSS rule. Three things follow.

**Escaping differs by template type.** `product-phase5-app.ts` uses
`String.raw`, so one backslash. The others are ordinary template literals, so
two. Getting this wrong has blanked the entire app before.

**Run `node scripts/check-emitted-scripts.mjs` after any UI edit.** It parses
every emitted script, type-checks it for undefined and redeclared names, and
checks every emitted stylesheet for balanced braces. Each of those catches a
bug class `tsc` cannot see.

**A stray `}` in CSS is silent and destructive.** The parser recovers by
skipping to the end of the next block, so one extra brace disabled an entire
`@media` query and the responsive layout with it, for months, with nothing in
the source to see.

## Before opening a pull request

```bash
rm -rf dist && npm run check:all   # typecheck, tests, emitted scripts, doc links
```

**Delete `dist/` first.** The checks run against build output, and a file from
a branch you switched away from stays there and fails, or passes, for reasons
that are not in your working tree. It has produced three false failures.

If the UI changed, **open it in a browser**. Several real bugs here were
invisible to the test suite and obvious in a screenshot: a duplicated nav
heading, a severity label overflowing its column, a breadcrumb showing one
project above another project's numbers.

If a generated artifact changed (`site/`, `deploy/kubernetes/`), regenerate it.
CI fails on drift.

## Branching

`main` is protected: pull request, five required checks, no bypass. Work on a
branch, open a PR, and let the owner merge.

## Writing

Plain technical prose. No em dashes.

**Comments are capped at two lines.** No exceptions, including doc comments.
They explain *why*, never what the code already says. A comment that needs a
third line belongs in the pull request description instead.

A commit message says what changed and what it cost to learn.

**Never name another product in this repository.** Not in a comment, a
document, a commit or a pull request. It is public, and the work stands on its
own terms.
