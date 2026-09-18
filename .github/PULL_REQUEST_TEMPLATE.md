## What this changes

<!-- What behaviour is different after this merges, in a sentence or two. -->

## Why

<!-- The problem. Link an issue if there is one. -->

## How it was verified

<!-- What you actually ran, and what it said. "Should work" is not verification. -->

- [ ] `npm run self-check` passes
- [ ] `node scripts/check-emitted-scripts.mjs` passes
- [ ] Rendered the affected page in a browser, if the UI changed

## Checks that catch this project's recurring mistakes

- [ ] No regular expressions in `src/` (the architecture test enforces this)
- [ ] Quotes and apostrophes inside emitted scripts are escaped for their
      template type; `String.raw` and ordinary template literals differ
- [ ] No evidence-state colour used on chrome, per `DESIGN.md`
- [ ] A result with missing evidence still reads as uncertain, not rounded up
- [ ] No secrets, generated reports, private domains or run data committed
