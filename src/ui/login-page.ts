export function renderLoginPageHtml(failed = false): string {
  // Deliberately plain: no catalogue fetch, no app shell, nothing that runs
  // before someone is admitted.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/assets/brand/citegeo-emblem.svg">
  <title>Sign in | CiteGEO</title>
  <style>
    :root { --bg:#14120F; --panel:#1C1914; --line:#332C22; --line-strong:#4A4030; --text:#F2EEE4; --muted:#A89C87; --failed-text:#CC7157; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px; background:var(--bg); color:var(--text); font-family:"General Sans",ui-sans-serif,system-ui,-apple-system,sans-serif; }
    main { width:min(380px,100%); }
    h1 { font-family:"Cabinet Grotesk",ui-sans-serif,system-ui,sans-serif; font-size:22px; margin:0 0 6px; letter-spacing:-0.01em; }
    p { color:var(--muted); margin:0 0 20px; line-height:1.5; font-size:14px; }
    form { display:grid; gap:10px; border:1px solid var(--line); border-radius:8px; background:var(--panel); padding:18px; }
    label { font-size:12px; color:var(--muted); }
    input { width:100%; min-height:40px; border:1px solid var(--line); border-radius:7px; background:#0E0C0A; color:var(--text); padding:9px 11px; font:inherit; }
    input:focus-visible { outline:2px solid var(--text); outline-offset:2px; }
    button { min-height:40px; border:1px solid var(--text); border-radius:7px; background:var(--text); color:var(--bg); font:inherit; font-weight:600; cursor:pointer; }
    .failed { color:var(--failed-text); font-size:13px; margin:0; }
  </style>
</head>
<body>
  <main>
    <h1>CiteGEO</h1>
    <p>This instance requires a password. It is set by whoever runs the server.</p>
    <form method="post" action="/api/login">
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
      ${failed ? '<p class="failed">That password was not accepted.</p>' : ""}
      <button type="submit">Sign in</button>
    </form>
  </main>
</body>
</html>`;
}
