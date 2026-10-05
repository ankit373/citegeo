// One theme, imported by every surface. The tokens used to live in four files
// and drifted, because nothing made them move together.

/** Loaded once in the document head. Google Fonts is the only stylesheet host allowed here. */
export const THEME_FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600;700&display=swap">`;

/** Light by default; dark follows the system unless data-theme overrides it. */
export const THEME_TOKENS = `
  :root {
    color-scheme: light dark;

    --paper:#F4F6F8;
    --surface:#FFFFFF;
    --raised:#EDF0F4;
    --sunken:#E7EBF0;
    --line:#DDE2E9;
    --line-strong:#C9D1DB;

    --text:#11151C;
    --muted:#657182;
    --weak:#8E99A8;

    --accent:#0F6E7A;
    --accent-hover:#0B545E;
    --accent-ink:#FFFFFF;
    --accent-wash:rgba(15,110,122,.10);

    --confirmed:#1C7C4A;
    --confirmed-text:#176840;
    --confirmed-wash:rgba(28,124,74,.11);
    --unknown:#8A6100;
    --unknown-text:#7A5600;
    --unknown-wash:rgba(138,97,0,.11);
    --failed:#A32C32;
    --failed-text:#90272C;
    --failed-wash:rgba(163,44,50,.10);

    --skeleton:#E7EBF0;
    --skeleton-sheen:rgba(255,255,255,.70);

    --font-display:"IBM Plex Sans Condensed","IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
    --font-ui:"IBM Plex Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
    --font-mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;

    --figures:tabular-nums;
    --type-micro:10px;
    --type-xs:11px;
    --type-sm:12px;
    --type-md:13px;
    --type-base:14px;
    --type-lg:16px;
    --type-xl:20px;
    --type-2xl:26px;
    --type-hero:clamp(30px,3.2vw,40px);
    --leading-tight:1.14;
    --leading-snug:1.34;
    --leading-normal:1.55;
    --tracking-tight:-0.018em;
    --tracking-snug:-0.006em;
    --tracking-wide:0.085em;

    --space-2xs:2px;
    --space-xs:4px;
    --space-sm:8px;
    --space-md:12px;
    --space-lg:20px;
    --space-xl:32px;
    --space-2xl:48px;

    --radius:8px;
    --radius-sm:5px;
    --radius-xs:3px;
    --radius-pill:999px;
    --gutter:clamp(20px,3.6vw,56px);
    --hairline:1px solid var(--line);
    --hairline-strong:1px solid var(--line-strong);
    --shadow-sm:0 1px 2px rgba(13,17,23,.05);
    --shadow:0 1px 3px rgba(13,17,23,.06),0 1px 1px rgba(13,17,23,.04);

    --motion-fast:140ms;
    --motion-normal:260ms;
    --motion-shimmer:1500ms;
    --ease-standard:cubic-bezier(.22,1,.36,1);
    --ease-press:cubic-bezier(.2,.8,.2,1);
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper:#0D1117;
      --surface:#151B23;
      --raised:#1C232D;
      --sunken:#090D12;
      --line:#242D38;
      --line-strong:#323D4A;

      --text:#E8EDF4;
      --muted:#8B97A6;
      --weak:#6B7785;

      --accent:#4FC2CF;
      --accent-hover:#7FD8E2;
      --accent-ink:#06262B;
      --accent-wash:rgba(79,194,207,.16);

      --confirmed:#5CC48A;
      --confirmed-text:#79D5A2;
      --confirmed-wash:rgba(92,196,138,.14);
      --unknown:#D5A443;
      --unknown-text:#E0B860;
      --unknown-wash:rgba(213,164,67,.14);
      --failed:#E4747B;
      --failed-text:#EC8D93;
      --failed-wash:rgba(228,116,123,.14);

      --skeleton:#2C2B28;
      --skeleton-sheen:rgba(255,255,255,.06);

      --shadow-sm:0 1px 2px rgba(0,0,0,.28);
      --shadow:0 1px 3px rgba(0,0,0,.32),0 1px 1px rgba(0,0,0,.22);
    }
  }

  :root[data-theme="dark"] {
    --paper:#0D1117; --surface:#151B23; --raised:#1C232D; --sunken:#090D12;
    --line:#242D38; --line-strong:#323D4A;
    --text:#E8EDF4; --muted:#8B97A6; --weak:#6B7785;
    --accent:#4FC2CF; --accent-hover:#7FD8E2; --accent-ink:#06262B; --accent-wash:rgba(79,194,207,.16);
    --confirmed:#5CC48A; --confirmed-text:#79D5A2; --confirmed-wash:rgba(92,196,138,.14);
    --unknown:#D5A443; --unknown-text:#E0B860; --unknown-wash:rgba(213,164,67,.14);
    --failed:#E4747B; --failed-text:#EC8D93; --failed-wash:rgba(228,116,123,.14);
    --skeleton:#2C2B28; --skeleton-sheen:rgba(255,255,255,.06);
    --shadow-sm:0 1px 2px rgba(0,0,0,.28);
    --shadow:0 1px 3px rgba(0,0,0,.32),0 1px 1px rgba(0,0,0,.22);
  }
`;

/** Element defaults every surface shares, so no page restates them. */
export const THEME_BASE = `
  * { box-sizing:border-box; }
  body {
    margin:0; min-height:100vh; background:var(--paper); color:var(--text);
    font-family:var(--font-ui); font-size:var(--type-base); line-height:var(--leading-normal);
    font-variant-numeric:var(--figures); -webkit-font-smoothing:antialiased;
  }
  h1,h2,h3 { font-family:var(--font-display); font-weight:500; letter-spacing:var(--tracking-tight); margin:0; text-wrap:balance; }
  h1 { font-size:var(--type-hero); line-height:var(--leading-tight); }
  h2 { font-size:var(--type-xl); line-height:var(--leading-snug); }
  h3 { font-size:var(--type-lg); line-height:var(--leading-snug); letter-spacing:var(--tracking-snug); }
  h4 { font-family:var(--font-ui); font-size:var(--type-md); font-weight:600; line-height:var(--leading-snug); letter-spacing:var(--tracking-snug); margin:0; }
  p { margin:0; }
  a { color:var(--accent); text-underline-offset:2px; }
  hr { border:0; border-top:var(--hairline); margin:0; }
  .mono,.domain,code { font-family:var(--font-mono); font-size:.92em; font-variant-numeric:var(--figures); }
  th,td,.num,time { font-variant-numeric:var(--figures); }
  .subtle,.field-help,.model-meta { color:var(--muted); font-size:var(--type-md); }
  button,input,select,textarea { font:inherit; color:inherit; font-variant-numeric:var(--figures); }
  button { cursor:pointer; background:none; border:0; }
  button:disabled { cursor:not-allowed; opacity:.5; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:var(--radius-xs); }
  ::selection { background:var(--accent-wash); }
  @media (prefers-reduced-motion: reduce) {
    *,*::before,*::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; scroll-behavior:auto !important; }
  }
`;

/** Everything a page needs in its head, in one call. */
export function themeStyle(pageCss: string): string {
  return `${THEME_FONT_LINKS}
  <style>${THEME_TOKENS}${THEME_BASE}${pageCss}</style>`;
}
