# CiteGEO Brand Assets

Vector assets for the open-source AI visibility monitor, `citegeo`. The design system that governs them is [DESIGN.md](../../DESIGN.md); the usage rules are [docs/brand.md](../../docs/brand.md).

## Files

| File | Use and native proportions |
| --- | --- |
| `citegeo-emblem.svg` | Standalone emblem, viewBox 160×160; favicon, app icon, and small entry points |
| `citegeo-emblem-light.svg` | Light-theme fill variant of the emblem |
| `citegeo-lockup.svg` | Emblem plus lowercase wordmark, viewBox 640×160; README, site, and primary product navigation |
| `citegeo-lockup-light.svg` | Light-theme fill variant of the lockup |

The `-light.svg` variants are generated, not hand-edited. Run `node scripts/build-brand-assets.mjs` after changing a source file; the script rewrites fill only and asserts that no other geometry moved.

## Design Notes

The mark is two angled bars forming a quotation mark: the unit of evidence the product extracts and verifies from every model answer. It is deliberately concrete rather than an abstract orb, spark, or geo-pin.

Dark-theme fill is `#F2EEE4`, light-theme fill is `#1C1914`. A theme variant may change fill and nothing else.

## Usage

Use `citegeo` in lowercase for the product name in running text and `CiteGEO` in titles and headings. Keep result-source labels separate from the brand name, for example `Source: OpenRouter API`.

Preserve each SVG's paths, viewBox, transform, and proportions. Do not stretch, recolor beyond the two theme fills, add a glow, or embed a bitmap.
