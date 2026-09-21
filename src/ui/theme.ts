// One theme, imported by every surface. The tokens used to live in four files
// and drifted, because nothing made them move together.

/** Loaded once in the document head. Google Fonts is the only stylesheet host allowed here. */
export const THEME_FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,400..600&display=swap">`;

/** Light by default; dark follows the system unless data-theme overrides it. */
export const THEME_TOKENS = `
  :root {
    color-scheme: light dark;

    --paper:#F7F6F3;
    --surface:#FFFFFF;
    --raised:#F2F0EA;
    --sunken:#EDEBE4;
    --line:#E4E1D8;
    --line-strong:#D2CEC2;

    --text:#1A1916;
    --muted:#6D6A62;
    --weak:#959187;

    --accent:#C15F3C;
    --accent-hover:#A94F30;
    --accent-ink:#FFFFFF;
    --accent-wash:rgba(193,95,60,.09);

    --confirmed:#3F7D58;
    --confirmed-text:#356B4B;
    --confirmed-wash:rgba(63,125,88,.10);
    --unknown:#9A6B18;
    --unknown-text:#8A5F15;
    --unknown-wash:rgba(154,107,24,.10);
    --failed:#A8402F;
    --failed-text:#96392A;
    --failed-wash:rgba(168,64,47,.10);

    --skeleton:#ECE9E1;
    --skeleton-sheen:rgba(255,255,255,.70);

    --font-display:"Newsreader",ui-serif,Georgia,"Times New Roman",serif;
    --font-ui:"Instrument Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
    --font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;

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
    --shadow-sm:0 1px 2px rgba(26,25,22,.04);
    --shadow:0 1px 3px rgba(26,25,22,.05),0 1px 1px rgba(26,25,22,.03);

    --motion-fast:140ms;
    --motion-normal:260ms;
    --motion-shimmer:1500ms;
    --ease-standard:cubic-bezier(.22,1,.36,1);
    --ease-press:cubic-bezier(.2,.8,.2,1);
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper:#1E1D1B;
      --surface:#262523;
      --raised:#2E2D2A;
      --sunken:#1A1917;
      --line:#38362F;
      --line-strong:#4A4740;

      --text:#F4F2EC;
      --muted:#A8A49B;
      --weak:#77736B;

      --accent:#D97757;
      --accent-hover:#E08D70;
      --accent-ink:#1A1108;
      --accent-wash:rgba(217,119,87,.14);

      --confirmed:#6FBF8F;
      --confirmed-text:#7FCE9E;
      --confirmed-wash:rgba(111,191,143,.13);
      --unknown:#D9A94E;
      --unknown-text:#E2B865;
      --unknown-wash:rgba(217,169,78,.13);
      --failed:#DE8271;
      --failed-text:#E89583;
      --failed-wash:rgba(222,130,113,.13);

      --skeleton:#2C2B28;
      --skeleton-sheen:rgba(255,255,255,.06);

      --shadow-sm:0 1px 2px rgba(0,0,0,.28);
      --shadow:0 1px 3px rgba(0,0,0,.32),0 1px 1px rgba(0,0,0,.22);
    }
  }

  :root[data-theme="dark"] {
    --paper:#1E1D1B; --surface:#262523; --raised:#2E2D2A; --sunken:#1A1917;
    --line:#38362F; --line-strong:#4A4740;
    --text:#F4F2EC; --muted:#A8A49B; --weak:#77736B;
    --accent:#D97757; --accent-hover:#E08D70; --accent-ink:#1A1108; --accent-wash:rgba(217,119,87,.14);
    --confirmed:#6FBF8F; --confirmed-text:#7FCE9E; --confirmed-wash:rgba(111,191,143,.13);
    --unknown:#D9A94E; --unknown-text:#E2B865; --unknown-wash:rgba(217,169,78,.13);
    --failed:#DE8271; --failed-text:#E89583; --failed-wash:rgba(222,130,113,.13);
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
