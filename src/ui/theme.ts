// One theme, imported by every surface. The tokens used to live in four files
// and drifted, because nothing made them move together.

/** Loaded once in the document head. Google Fonts is the only stylesheet host allowed here. */
export const THEME_FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=Inter:wght@400;450;500;600&family=JetBrains+Mono:wght@400;500&display=swap">`;

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

    --font-display:"Source Serif 4",ui-serif,Georgia,"Times New Roman",serif;
    --font-ui:"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
    --font-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;

    --radius:12px;
    --radius-sm:8px;
    --radius-xs:6px;
    --gutter:clamp(20px,3.6vw,56px);
    --shadow-sm:0 1px 2px rgba(26,25,22,.05);
    --shadow:0 2px 8px rgba(26,25,22,.06),0 1px 2px rgba(26,25,22,.04);

    --motion-fast:140ms;
    --motion-normal:260ms;
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

      --shadow-sm:0 1px 2px rgba(0,0,0,.30);
      --shadow:0 2px 10px rgba(0,0,0,.34),0 1px 2px rgba(0,0,0,.24);
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
    --shadow-sm:0 1px 2px rgba(0,0,0,.30);
    --shadow:0 2px 10px rgba(0,0,0,.34),0 1px 2px rgba(0,0,0,.24);
  }
`;

/** Element defaults every surface shares, so no page restates them. */
export const THEME_BASE = `
  * { box-sizing:border-box; }
  body {
    margin:0; min-height:100vh; background:var(--paper); color:var(--text);
    font-family:var(--font-ui); font-size:14px; line-height:1.55;
    font-variant-numeric:tabular-nums; -webkit-font-smoothing:antialiased;
  }
  h1,h2,h3,h4 { font-family:var(--font-display); font-weight:500; letter-spacing:-0.012em; margin:0; }
  h1 { font-size:clamp(28px,3vw,38px); line-height:1.12; }
  h2 { font-size:clamp(18px,1.6vw,21px); line-height:1.25; }
  h3 { font-size:16px; }
  p { margin:0; }
  a { color:var(--accent); text-underline-offset:2px; }
  .mono,.domain,code { font-family:var(--font-mono); font-size:.92em; font-variant-numeric:tabular-nums; }
  .subtle,.field-help,.model-meta { color:var(--muted); font-size:13px; }
  button,input,select,textarea { font:inherit; color:inherit; }
  button { cursor:pointer; background:none; border:0; }
  button:disabled { cursor:not-allowed; opacity:.5; }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:4px; }
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
