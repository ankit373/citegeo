---
# citegeo: design-md-format=spec
name: citegeo
typography:
  display:
    fontFamily: Cabinet Grotesk
  body:
    fontFamily: General Sans
  label:
    fontFamily: General Sans
  mono:
    fontFamily: JetBrains Mono
    fontFeature: tnum
colors:
  bg: "#14120F"
  bg-elevated: "#1C1914"
  bg-hover: "#24201A"
  bg-inset: "#0E0C0A"
  border: "#332C22"
  border-strong: "#4A4030"
  text: "#F2EEE4"
  text-muted: "#A89C87"
  text-weak: "#6E6455"
  confirmed: "#7FA06E"
  confirmed-text: "#9DBC8E"
  unknown: "#C9973E"
  unknown-text: "#DBB05F"
  failed: "#B2503B"
  failed-text: "#CC7157"
  series-1: "#6B8CAE"
  series-2: "#8B7FBF"
  series-3: "#B98A5E"
  series-4: "#6FA88A"
  series-5: "#A6748F"
  series-6: "#7A94A0"
  bg-light: "#F5F1E8"
  surface-light: "#FFFFFF"
  border-light: "#DDD4C2"
  text-light: "#1C1914"
  text-muted-light: "#6E6455"
spacing:
  2xs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 20px
  xl: 32px
  2xl: 48px
rounded:
  sm: 2px
  md: 4px
  lg: 6px
  full: 9999px
---

# Design System, CiteGEO

## Overview

- **What this is:** CiteGEO, an open-source tool that tracks how AI models (ChatGPT, Claude, Gemini, Perplexity) describe a brand, which competitors they name, and which sources they cite. Evidence-first, not a ranking dashboard.
- **Who it's for:** Developers and marketers who want to inspect the raw model answer behind a claim, not just read a score.
- **Space/industry:** AI visibility / GEO tracking (peers: Profound, Peec, Otterly).
- **Project type:** Self-hosted product workbench (recognition + measurement UI) plus a documentation/marketing site.

- **Direction:** Industrial/Utilitarian, crossed with Brutalist/Raw. An evidence instrument, not a SaaS dashboard.
- **Decoration level:** Minimal. Typography, rule lines, and a semantic color system carry the whole design. No gradients, no glow, no icon tiles, no decorative accent color.
- **Mood:** An audit tool that takes its own claim seriously. "Open the black box, put the evidence in your hands" is a functional promise, not a tagline, so the UI itself should read as legible and inspectable rather than reassuring.
- **Name:** CiteGEO. The name points at the actual unit of evidence the product produces, a citation, rather than leaning on the category's GEO suffix alone.
- **Mark:** two angled bars forming a quotation mark. A concrete, ownable shape (not an abstract orb or spark) that is literally what the product extracts and verifies from every model answer.
- **Reference sites (real research, not vibes):**
  - Profound (`tryprofound.com`): near-black `#1b1b1b` plus one blue accent `#5dabff`. Category leader; this is the look every competitor converges on, including the product's own prior design.
  - Peec (`peec.ai`): Geist + Fragment Mono, warm neutral grays, no real accent color. Mono is used decoratively, not structurally.
  - Otterly, the one outlier: saturated indigo/magenta/violet, used decoratively across chrome.
  - Verdict: the category has one look, near-black plus a single brand-blue accent plus glow, which the design literature explicitly names as a default AI-generated pattern. This product does not compete on "looks trustworthy", it competes on "shows you the receipt", so the identity comes from a different place: color that means something, and a layout shaped like the data, not a template.

## Colors

- **Approach:** Committed, but functional rather than decorative. There is no single brand hue. Color is spent on two separate, non-overlapping jobs, and a color from one job never appears doing the other's:
  1. **Evidence state**, three colors, meaning the same thing everywhere they appear:
     - **Confirmed / valid / recognized**: `confirmed` `#7FA06E` (muted moss, ink-like, never neon)
     - **Unknown / unconfirmed / partial**: `unknown` `#C9973E` (muted ochre, a flagged-for-review color, not a warning-orange)
     - **Not recognized / failed / invalid**: `failed` `#B2503B` (muted brick red, not a saturated error-red)
     - These three colors appear only to report an evidence state (a badge, a point's completeness, a table cell). They never decorate a button, a logo, a nav item, or chrome. If a screen has no evidence state to show, it has no color beyond the neutrals.
  2. **Chart series identity**, six muted colors (`series-1` through `series-6`), used only to tell apart different models or objects plotted on the same chart. Assigned by a stable hash of the model or object ID, same rule the old palette used, new values. Deliberately desaturated and cooler than the three semantic colors so a reader never mistakes "which line is this" for "what state is this point in": `#6B8CAE` dusty blue, `#8B7FBF` dusty violet, `#B98A5E` warm tan, `#6FA88A` muted teal, `#A6748F` dusty mauve, `#7A94A0` muted slate. This is a real gap the first version of this system missed: three semantic colors cannot also distinguish four or more chart lines, so a categorical set had to exist somewhere, kept visually distinct from state color rather than reusing it.
- **Base (dark, primary mode):** `#14120F`. A warm charcoal, not pure black (`#050505`, the old value) and not a cool near-black-navy (`#1b1b1b`, Profound's value). The warmth reads as paper and ink rather than glass and glow.
- **Neutrals:** `bg-elevated` `#1C1914` for panels, `bg-hover` `#24201A`, `bg-inset` `#0E0C0A` for recessed/code surfaces, `border` `#332C22`, `border-strong` `#4A4030`. All warm, all derived from the same base hue rather than a cool gray scale.
- **Text:** `text` `#F2EEE4` (warm off-white, not pure `#FFFFFF`), `text-muted` `#A89C87`, `text-weak` `#6E6455`.
- **Light mode:** a genuine second mode, not an afterthought. `bg-light` `#F5F1E8` (warm paper, not stark white), `surface-light` `#FFFFFF` for elevated panels only, the same evidence-state and series colors darkened slightly for AA contrast on light.
- **What this buys and costs:** the product has no ownable "brand blue" the way Profound does; a logo mark cannot lean on a signature hue. In exchange, the interface is self-documenting (a color always means the same evidence fact, or the same series, never both) and the product cannot visually converge on "the blue one" or "the purple one" the way every direct competitor already has.

## Typography

- **Display (headings, hero text):** Cabinet Grotesk, Fontshare, free for commercial use, verified 2026-09-08. A grotesque with real character (flared terminals, slightly irregular counters) that avoids the Inter/Geist/Space-Grotesk default every competitor in this category uses. Set in Bold/Extrabold only, never past a poster-scale on a page that is not literally a poster.
- **Body / UI:** General Sans, same foundry (Fontshare), free commercial, verified. Plain and legible at UI sizes, pairs cleanly with Cabinet Grotesk's DNA without competing with it for attention. Regular for body copy, Medium for UI labels and buttons.
- **Data / evidence (load-bearing, not decorative):** JetBrains Mono, SIL OFL 1.1, verified. Every hash, quote, offset, model ID, JSON fragment, and timestamp in the product is set in this face, always. This is not a "code accent" the way competitors use a mono font for a stray label, it is the primary voice for roughly half the product's actual content, because the product's whole job is showing exact machine output. Tabular figures (`tnum`) on for every number so columns of costs, tokens, and percentages align.
- **Scale:** headings differ from body by more than weight, at least 1.6x jump between adjacent levels, never a heading that is just bold body text.
- **Anti-list respected:** no Inter, no Geist (both banned as display in the source research and both already used by Profound/Peec), no system-ui, no gradient text, no italic-serif-for-credibility.

## Layout

- **Approach:** grid-disciplined, data-matrix-first. The product's actual data shape is a matrix, models by prompts by time, so the primary UI unit is a dense table/grid, not a stack of rounded cards. A recognition result, a citation list, a run history: each renders as rows and columns with visible rule lines, not as a card grid.
- **Density:** tight and utilitarian on purpose. This audience wants to see the matrix, not scroll past whitespace to find it. Generous whitespace is reserved for the documentation/marketing surfaces, not the workbench.
- **No card-in-card nesting.** A table row can expand to show its evidence inline (raw answer, citation path) rather than opening a nested card.
- **Both modes matter.** Dark is the default working mode (this audience works in it for hours), but light mode is maintained as a first-class surface, not a forgotten toggle. Same rules, same density, swapped tokens only.

## Motion

- **Approach:** minimal-functional only. Motion exists to aid comprehension of a state change (a row loading, a value updating, a drawer opening), never to entertain, never to signal polish for its own sake. No scroll-driven choreography, no decorative entrance animation on static content.
- Durations stay short: about 80 to 160ms for UI feedback, up to about 300ms for a chart update. Nothing in the product should feel like it is performing calmness, this is an inspection tool, and it should feel instant.

## Decisions Log

- 2026-09-11: Replaced the prior black-background/white-geometric-mark identity (structurally identical to Profound's near-black-plus-one-accent formula) with a semantic, functional color system and a warm-charcoal base, after direct CSS/font research on Profound, Peec, and Otterly confirmed the category has converged on one look.
- 2026-09-11: Chose Cabinet Grotesk + General Sans + JetBrains Mono over Inter/Geist, both banned as a display voice per the anti-convergence research, and both already the choice of at least one direct competitor.
- 2026-09-11: Settled the name as CiteGEO and adopted a quotation-mark glyph as the mark.
- 2026-09-11: Added the series-1 through series-6 chart palette. The three semantic colors alone cannot distinguish four or more model lines on one chart; that is a different job from reporting evidence state, so it gets its own, deliberately muted, palette rather than reusing state color or reviving the old decorative six-color set.
