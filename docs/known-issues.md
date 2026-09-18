# Known issues

Current, honest state of the tool. If something here matters to you, the issue tracker is the place to push on it.

## Verification gaps

- The Playwright browser suites under `e2e/` have not been run against the current build. They assert on interface text that changed during the rebrand.
- The Docker image has not been rebuilt or verified since the brand assets changed.
- Light mode is specified in `DESIGN.md` but not implemented. The generated HTML report still carries a light stylesheet that the dark rules below it fully override, so it is dead code.

## Product limitations

- There is no authentication. See [the security policy](../SECURITY.md) for what that means if you expose the port.
- A model recognising a domain you asked about is not evidence that it recommends that domain unprompted. The interface separates these, but the distinction is easy to lose when summarising results elsewhere.
- Provider responses vary between identical runs. A single run is an observation, not a measurement. Treat a small number of runs as a baseline rather than a trend.
- Analysis can fail on a response that was returned successfully. That is recorded as a failure, not as the brand being absent, and the two must not be read as the same thing.
- Web-enabled and offline answers are different conditions and are never averaged together. Comparing across them is your call to make explicitly.

## Brand assets

The wordmark is live `<text>` rather than outlined paths. SVGs loaded through an `<img>` tag cannot fetch webfonts, so a machine without Cabinet Grotesk installed renders the Arial fallback. Converting the wordmark to paths needs the font file.

## External dependencies

The workbench and the generated report load Cabinet Grotesk and General Sans from `api.fontshare.com` and JetBrains Mono from `fonts.googleapis.com` at runtime. This is the only outbound request the interface makes that is not a provider API call. Self-hosting the fonts would remove it.
