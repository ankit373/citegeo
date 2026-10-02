# Changelog

## Unreleased

Nothing yet.

## 0.3.1 - 2026-10-02

Two browser surfaces that were reporting the wrong thing.

### Fixed

- **Copilot answers again.** The surface moved to `copilot.com`, the old host
  redirects, and the redirect drops the query string the question was put in,
  so every run landed on an empty chat however the browser was signed in. The
  question is typed into the composer now, and the posted question is read back
  before anything is waited for: an empty composer still gets a reply, and
  archiving that would record an answer to a question nobody asked.
- **Copilot citations come back empty rather than invented.** It lists each
  source as a title and a domain and keeps the link in a click handler, so
  there is no page URL to read. Guessing one would have sent the page reader to
  fetch a homepage and report it as the page the model cited.
- **A ChatGPT sign-in wall is reported as a sign-in wall.** The signed-out page
  carries one `article` element, and `article` was treated as proof a transcript
  had rendered, so the wall was reported as a surface that answered nothing. One
  of those is a finding about the surface and the other is an instruction to
  whoever runs this.
- **Referral attribution learnt the new Copilot host,** keeping the old one,
  because a referral archived before the move is still a Copilot referral.
  Every `copilot.com` arrival had been going uncounted.

### Changed

- The marketing page states what the product now measures: searching measured
  before citation, asking a question more than once, and the range a rate is
  consistent with.

## 0.3.0 - 2026-10-02

First release under the CiteGEO name.

This release is mostly about the difference between a number and a number you
can act on. Six findings from a read of the published work on generative engine
measurement are answered here, and every panel that reports a figure now also
reports what to do about it.

### Added

- **Searching is measured before being cited is.** Pr(cited) decomposes into
  whether the surface searched at all, and the share cited among those that did.
  Counting an answer that never searched beside one that searched and cited
  nobody puts two populations under one denominator.
- **The provider's own account of whether it searched** is kept and preferred
  over any inference. Only the provider can tell a search that found nothing
  from a search that never ran, and that guess was the wider half of the band.
- **Browser surfaces are told apart by how they ground.** An AI overview is
  written from the search result it sits on; a chat surface decides per
  question. Calling both optional threw the difference away.
- **Repetitions.** A run can ask each question up to ten times, and the answers
  are compared pairwise on the sources they cited. Published work puts the day
  to day overlap near a third, which makes a single pass close to a coin.
- **A sampling interval on presence.** A Wilson interval beside the rate, and a
  flag where the range is too wide for the figure to decide anything.
- **A task listing on the dashboard and the report.** Ordered by what is holding
  the measurement back: blocking, limiting, then the work the measurement says
  to do. Every task carries the observation behind it and lands on the page that
  clears it, and each one also appears on the panel that measured it.
- **Mentions are checked against the answer the model wrote.** Positions are
  recounted from the text, and quoted evidence is confirmed to exist in it.
- **Page dates on cited sources,** so a stored page keeps the date rather than
  an age that silently went stale.
- **MIT licence.**
- Brand assets: a quotation-mark emblem and wordmark, with generated
  light-theme variants.
- A written design system in `DESIGN.md`, applied to the workbench and the
  generated HTML report.

### Changed

- **A cited page is counted once however the assistant spelled the URL.**
  Tracking parameters are dropped and the rest sorted, so one page is one page.
- **The score says what it is built to maximise and what it cannot answer.**
- **Blocking an AI crawler is no longer reported as the reason you are not
  cited.** Measured across millions of citations, most sites disallowing these
  agents were cited anyway. The cost of blocking is referred traffic.
- **The citation message names the cause.** Telling somebody to get a provider
  with web search is wrong when they have one with it switched off.
- Warm charcoal surface ramp in place of the previous near-black greys.
- Cabinet Grotesk, General Sans and JetBrains Mono in place of Inter, with
  tabular figures on every number.
- Colour split into two jobs that no longer overlap: three evidence-state
  tokens, and a separate six-colour palette for chart series identity.
- Removed the decorative accent colour, so focus rings and primary actions
  carry the text colour and links are underlined.
- Docker image now ships the current brand assets. It previously copied files
  that no longer existed, so the container served a broken logo.

### Fixed

- The integration test gave a server spawned through `tsx` four seconds to
  compile and listen, so the suite failed on a timeout that read as a broken
  server. It is now a deadline, and it says when the server printed nothing.

### Removed

- Simplified Chinese documentation set.
- Inherited research archive, release-acceptance tooling and prior release
  records, none of which describe this repository.
