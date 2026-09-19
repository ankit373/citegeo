# Contributing

Thanks for taking an interest in CiteGEO.

The goal of the project is narrow on purpose: make AI visibility measurable in a way you can check yourself, self-hosted, without a score standing in for the evidence behind it. A change that makes a number prettier at the cost of being able to trace it is not an improvement here.

## Setting up

```bash
cp .env.example .env
npm ci
npm run self-check
npm run server
```

You need at least one real provider key before you can run anything meaningful. A missing key must surface as a failure, never as a plausible-looking result.

## Good places to start

[ROADMAP.md](ROADMAP.md) lists what the project intends to build next, what it
has decided not to build, and why. It is the best place to find work that is
wanted rather than work that is merely possible.

- Provider adapters for models not yet covered
- Prompt generation, particularly for keyword tests that must not leak the brand name
- Competitor entity resolution and confirmation
- Classifying whether a citation actually supports the claim near it
- Wording and evidence links in the generated report
- Docker and first-run experience

## Rules the code has to keep

These are not style preferences. Breaking one of them makes the tool dishonest.

- Audit results come from real provider responses. There is no mock provider in the catalogue.
- A result stays labelled with the API that produced it.
- A provider key is only ever sent to that provider.
- An ordinary web search result is not a provider citation and must not be presented as one.
- Every conclusion in a report links to the answer or source underneath it.
- Where evidence is missing, the result says so. It does not get rounded up to a cleaner number.
- Failures stay on the record rather than disappearing from the run.
- Internal scaffolding (raw JSON, token cost, latency, prompt and run IDs) belongs in evidence views, not in the main report.

## Signing off your commits

Every commit in a pull request needs a `Signed-off-by` line matching its author.
That line certifies the [Developer Certificate of Origin](DCO): you are saying
you wrote the change, or you have the right to contribute it.

Git adds the line for you:

```bash
git commit -s -m "your message"
```

If you already pushed commits without it:

```bash
git rebase --signoff origin/main
git push --force-with-lease
```

Run the same check the CI runs before you push:

```bash
node scripts/check-dco.mjs origin/main HEAD
```

The check is skipped for the repository owner, who is the party the certificate
is made to rather than a contributor certifying to someone else. Bot commits are
skipped for the same reason: Dependabot cannot agree to anything.

## Signing the CLA

Your first pull request needs a signed [Contributor License Agreement](CLA.md).
A bot comments on the pull request with the one sentence to reply with, and that
covers every pull request you open afterwards.

You keep the copyright on your work. The agreement lets the project keep
distributing it under the MIT licence without tracking down each author again.
Signatures live in this repository on the `cla-signatures` branch, so there is no
external service involved.

## Before opening a pull request

```bash
npm run self-check
```

Check you are not committing secrets or private run data:

```bash
rg -n "OPENROUTER|OPENAI|ANTHROPIC|GEMINI|PERPLEXITY|DEEPSEEK|api_key|secret|token" .
```

Never include `.env`, generated reports, private domains or prompts, or local run directories.

## Documentation to update alongside code

- Changing report behaviour: `docs/REPORT_STANDARD.md`, `docs/CAPABILITY_MATRIX.md`, `README.md`
- Changing provider behaviour: document the source label and the key boundary
- Changing anything visual: `DESIGN.md` and `docs/brand.md`
