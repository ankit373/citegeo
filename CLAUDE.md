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

## Storage

File-backed, one directory per project. Every write is **temp file then
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
npm run check:all      # typecheck, 422 tests, emitted scripts, doc links
```

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

Plain technical prose. No em dashes. Comments explain **why**, in one or two
lines, and never restate the code. A commit message says what changed and what
it cost to learn.
