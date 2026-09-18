# Changelog

## Unreleased

First version under the CiteGEO name. No release has been tagged yet.

### Added

- MIT licence.
- Brand assets: a quotation-mark emblem and wordmark, with generated light-theme variants.
- A written design system in `DESIGN.md`, applied to the workbench and the generated HTML report.

### Changed

- Warm charcoal surface ramp in place of the previous near-black greys.
- Cabinet Grotesk, General Sans and JetBrains Mono in place of Inter, with tabular figures on every number.
- Colour split into two jobs that no longer overlap: three evidence-state tokens, and a separate six-colour palette for chart series identity.
- Removed the decorative accent colour, so focus rings and primary actions carry the text colour and links are underlined.
- Docker image now ships the current brand assets. It previously copied files that no longer existed, so the container served a broken logo.

### Removed

- Simplified Chinese documentation set.
- Inherited research archive, release-acceptance tooling and prior release records, none of which describe this repository.
