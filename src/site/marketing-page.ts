import { PRODUCT_NAME, PRODUCT_PROSE_NAME } from "../ui/brand.js";

// The marketing surface. Same tokens as the workbench, deliberately different
// density: DESIGN.md reserves generous whitespace for this surface and keeps
// the product itself tight, because one is read once and the other is worked in
// for hours.
//
// It is a single static page with no script, so it can be served from anywhere
// and cannot break in a way the product would notice.

interface Capability {
  title: string;
  body: string;
}

const CAPABILITIES: Capability[] = [
  {
    title: "Ask the models directly",
    body: "Put your domain to as many models as you want and keep every answer. The raw provider response is archived beside the parsed result, so a claim can always be traced back to the text that produced it.",
  },
  {
    title: "Find who is cited instead of you",
    body: "When a model names a competitor it usually cites a source. The citation gap lists the domains cited alongside your competitors that never appear in an answer naming you. That is a short, concrete list of places to get into.",
  },
  {
    title: "Ask whether it searched before asking whether it cited you",
    body: "An answer that never searched the web and an answer that searched and cited nobody are two different findings. Counting them together puts two populations under one denominator. Both are measured, and where a provider says nothing either way that stays unknown rather than being read as a no.",
  },
  {
    title: "Ask the same question again, and see how much moved",
    body: "The same question does not come back the same. Published work puts the day to day overlap of cited sources near a third, which makes a single pass close to a coin. Ask up to ten times and the passes are compared on the sources they cited, so you know whether a number is a finding or a draw.",
  },
  {
    title: "Read a rate with the range it is consistent with",
    body: "Two of twelve answers is not seventeen percent. It is a sample, and the interval around it is wide enough that a move inside it is not a move. Every rate carries that range, and says plainly when it is too wide to decide anything.",
  },
  {
    title: "Carry a name that should never appear",
    body: "Declare a brand you know is irrelevant and it rides along on every run. How often it turns up anyway is this tool's own error rate, and anything of yours below it has not been told apart from a name nobody wrote. On a real project, nought of twenty two answers still left a floor near fifteen percent.",
  },
  {
    title: "Know whether a page was cited or actually used",
    body: "A citation says a page was listed. It does not say the answer used it. Published work separating the two found one engine citing twice as many pages as another and taking a fifth as much from them. Every cited page is read back and scored on how much of the answer it accounts for, so a page cited first and leaned on for nothing is visible.",
  },
  {
    title: "See whether the words decide it, or the day",
    body: "Asking again holds the wording and varies the day. Asking it another way holds the day and varies the wording. Without both, a brand visible for an intent and a brand visible for one exact string give you the same number.",
  },
  {
    title: "Read your figure against brands like yours",
    body: "The same rate is poor for a household name and ordinary for a brand nobody has heard of. Say which you are and the figure gets something to mean. Nought of twenty two reads as catastrophic and is, for a niche brand at that many answers, exactly what its kind tends to get.",
  },
  {
    title: "Find what kind of page wins, not just which",
    body: "The ranked best-of listicle is the most cited format in published work. What wins in your category is a different question. Every cited page is classified by what it is and who it belongs to, so the answer comes from your own archive.",
  },
  {
    title: "Check the machine against a person",
    body: "Every figure here rests on a model classifying what another model wrote. Judge a random sample yourself and the agreement rate becomes the confidence in the whole column. One review of one mention reads as twenty one to a hundred percent, not as perfect.",
  },
  {
    title: "Test whether your change did anything",
    body: "A number moving after you changed something is not evidence your change moved it. Mark the questions you worked on, leave the rest as a control, and the two are compared on how much each moved rather than on where either ended up. No control and the answer is that nothing can be concluded, which is the honest end of most of this field's claims.",
  },
  {
    title: "Know whether it was you or the model that changed",
    body: "Every trend line in this category assumes the thing being measured held still while the brand changed. Models ship. The version a provider says it ran is stored with the answer, and a boundary where your presence moved by more than the noise on either side is named as what it is, which is not something you did.",
  },
  {
    title: "Prove the crawlers arrived",
    body: "robots.txt says a crawler may fetch you. Your access log says whether it did. Reading both separates a permission problem from an obscurity problem, which look identical from the outside. Blocking is reported as what it measurably costs, which is referred traffic, not citation.",
  },
  {
    title: "Get the next thing to do, not a score",
    body: "Every figure ends in the task it implies, ordered by what is holding the measurement back: what stops a number existing, what stops it being trusted, then what it says to do. Each one names the observation behind it and the button goes to the page that clears it.",
  },
];

const REFUSALS: Capability[] = [
  {
    title: "It will not invent a number",
    body: "Visibility with nothing parsed reads as not measurable, never 0%. A share of voice with no competitor named reads as not comparable, never 100%. An absence is reported as an absence.",
  },
  {
    title: "It will not guess at a fix",
    body: "A robots.txt or llms.txt can be generated correctly, so it is. A schema change lives in a template that differs per site, so it is described rather than patched. A wrong diff that looks authoritative is worse than no diff.",
  },
  {
    title: "It will not sell you demand data it does not have",
    body: "Knowing what people actually ask an assistant needs a consumer panel. This project does not have one and will not estimate it. It reads your Search Console instead and says so.",
  },
  {
    title: "It will not invent a citation it could not read",
    body: "One surface lists its sources by domain and keeps the link to itself. Turning that into an address would send the page reader off to fetch a homepage and report it as the page the model cited. The citation comes back empty, and the reason is printed beside it.",
  },
  {
    title: "It will not take what a model says it did on trust",
    body: "A model reporting which brands it named is a second claim, not evidence for the first. Every reported mention is checked against the answer the model actually wrote, including whether the line it quoted as proof is in there at all. Often enough, it is not.",
  },
  {
    title: "It will not guess what kind of brand you are",
    body: "The baseline a figure is read against depends on whether you are a household name or nobody has heard of you. Working that out from your own visibility would compare the number with itself, so it is declared or there is no comparison at all.",
  },
  {
    title: "It will not call a version it cannot see a version that held still",
    body: "Some providers name the model they actually ran and some hand back the name they were given. Reading the second as proof the version never changed would invent the one fact the panel exists to establish, so it reads as unconfirmed and says which providers report and which do not.",
  },
  {
    title: "It will not ship a fix the evidence argues against",
    body: "Question and answer formatting is the fix this field sells hardest. Measured, it carries a small disadvantage for how much of an answer a page accounts for. It is offered here with that figure attached rather than generated into your site alongside the rest.",
  },
];

function capabilityList(items: Capability[]): string {
  return items
    .map((item) => `<article><h3>${item.title}</h3><p>${item.body}</p></article>`)
    .join("");
}

export function renderMarketingHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${PRODUCT_PROSE_NAME}: see what AI says about your brand, and the evidence behind it</title>
<meta name="description" content="Self-hosted, open source tracking of how AI models describe your brand, which competitors they name and which sources they cite. Every claim traceable to the raw model answer.">
<link rel="icon" type="image/svg+xml" href="/assets/brand/citegeo-emblem.svg">
<meta property="og:title" content="${PRODUCT_PROSE_NAME}">
<meta property="og:description" content="See what AI says about your brand, and the evidence behind it. Self-hosted and open source.">
<meta property="og:type" content="website">
<style>
  :root {
    --bg:#14120F; --panel:#1C1914; --line:#332C22; --line-strong:#4A4030;
    --text:#F2EEE4; --muted:#A89C87; --weak:#6E6455;
    --confirmed-text:#9DBC8E; --unknown-text:#DBB05F; --failed-text:#CC7157;
    /* The workbench is tight on purpose. This surface is not. */
    --measure:64ch; --gap:clamp(56px, 8vw, 104px);
  }
  * { box-sizing:border-box; }
  html { scroll-behavior:smooth; }
  body {
    margin:0; background:var(--bg); color:var(--text);
    font-family:"General Sans",ui-sans-serif,system-ui,-apple-system,sans-serif;
    font-size:17px; line-height:1.6; font-variant-numeric:tabular-nums;
  }
  h1,h2,h3 { font-family:"Cabinet Grotesk",ui-sans-serif,system-ui,sans-serif; letter-spacing:-0.02em; line-height:1.1; margin:0; }
  h1 { font-size:clamp(40px, 6vw, 68px); font-weight:800; }
  h2 { font-size:clamp(26px, 3.4vw, 38px); font-weight:700; }
  h3 { font-size:19px; font-weight:700; }
  p { margin:0; }
  a { color:var(--text); }
  code, .mono { font-family:"JetBrains Mono",ui-monospace,monospace; font-size:0.9em; }
  .wrap { width:min(1080px, calc(100% - 48px)); margin:0 auto; }
  header.top { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:26px 0; }
  .brand { display:flex; align-items:center; gap:10px; font-weight:700; letter-spacing:-0.01em; }
  .brand img { width:26px; height:26px; display:block; }
  nav { display:flex; gap:22px; color:var(--muted); font-size:15px; }
  nav a { color:var(--muted); text-decoration:none; }
  nav a:hover { color:var(--text); }
  .hero { padding:var(--gap) 0 calc(var(--gap) * 0.7); }
  .hero p.lede { max-width:var(--measure); margin-top:26px; color:var(--muted); font-size:clamp(18px, 2vw, 21px); }
  .actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:34px; }
  .button { display:inline-block; padding:13px 20px; border-radius:7px; border:1px solid var(--line-strong); color:var(--text); text-decoration:none; font-weight:600; }
  .button.primary { background:var(--text); border-color:var(--text); color:var(--bg); }
  section { padding:var(--gap) 0; border-top:1px solid var(--line); }
  section > .wrap > p.intro { max-width:var(--measure); margin-top:18px; color:var(--muted); }
  .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:34px 44px; margin-top:52px; }
  .grid article h3 { margin-bottom:10px; }
  .grid article p { color:var(--muted); }
  .terminal { margin-top:44px; border:1px solid var(--line); border-radius:9px; background:#0E0C0A; padding:22px 24px; overflow-x:auto; }
  .terminal pre { margin:0; font-family:"JetBrains Mono",ui-monospace,monospace; font-size:14px; line-height:1.75; color:var(--muted); }
  .terminal .prompt { color:var(--weak); }
  .terminal .ok { color:var(--confirmed-text); }
  .terminal .flag { color:var(--unknown-text); }
  .terminal .bad { color:var(--failed-text); }
  footer { padding:var(--gap) 0 72px; border-top:1px solid var(--line); color:var(--weak); font-size:15px; }
  footer a { color:var(--muted); }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior:auto; } }
</style>
</head>
<body>

<div class="wrap">
  <header class="top">
    <span class="brand"><img src="/assets/brand/citegeo-emblem.svg" alt=""> ${PRODUCT_NAME}</span>
    <nav>
      <a href="#what">What it does</a>
      <a href="#refuses">What it refuses</a>
      <a href="#start">Run it</a>
      <a href="https://github.com/ankit373/citegeo">GitHub</a>
    </nav>
  </header>
</div>

<div class="wrap hero">
  <h1>See what AI says<br>about your brand.</h1>
  <p class="lede">Models describe your company to buyers every day, name competitors instead of you, and cite sources you have never heard of. ${PRODUCT_PROSE_NAME} asks them directly, keeps every answer, and shows the evidence behind every claim it makes.</p>
  <div class="actions">
    <a class="button primary" href="#start">Run it yourself</a>
    <a class="button" href="https://github.com/ankit373/citegeo">Read the source</a>
  </div>
</div>

<section id="what">
  <div class="wrap">
    <h2>Evidence, not a score</h2>
    <p class="intro">Every other tool in this category sells you a number. A number you cannot check is a number you cannot act on, and a number taken over the wrong population is worse than none.</p>
    <div class="grid">${capabilityList(CAPABILITIES)}</div>
  </div>
</section>

<section id="refuses">
  <div class="wrap">
    <h2>What it refuses to do</h2>
    <p class="intro">The limits are the product. Anything here that guessed would make the rest untrustworthy.</p>
    <div class="grid">${capabilityList(REFUSALS)}</div>
  </div>
</section>

<section id="start">
  <div class="wrap">
    <h2>Run it on your own machine</h2>
    <p class="intro">Self-hosted, MIT licensed, and your provider keys never leave it. Local models cost nothing to run, so you can try the whole flow before spending anything.</p>
    <div class="terminal"><pre><span class="prompt">$</span> git clone https://github.com/ankit373/citegeo
<span class="prompt">$</span> cp .env.example .env   <span class="prompt"># add a provider key</span>
<span class="prompt">$</span> npm ci &amp;&amp; npm run server

citegeo listening on http://127.0.0.1:8787

<span class="prompt">#</span> what it tells you to do after a run, and what it saw
<span class="bad">blocking</span>  Add a model that can search the web
          All 12 answers came from models with no web search.
<span class="flag">limiting</span>  Ask each question more than once
          6 of 11 questions were asked once, so most of this is a single draw.
<span class="flag">limiting</span>  Read the source list as one draw, not as the sources
          0% of cited sources survived one pass to the next, against 34% published.
<span class="ok">to do</span>     Write for the 4 questions you never appear in
          4 tracked questions returned answers that never named you.

<span class="prompt">#</span> and what it refuses to call a finding
<span class="ok">ok</span>        Named in 0% of answers, consistent with 0% to 14.9%
          That range covers the 11% a niche brand tends to get.
<span class="ok">ok</span>        Anything under 14.9% is not a finding
          A name invented for this project never appeared either.</pre></div>
  </div>
</section>

<footer>
  <div class="wrap">
    <p>${PRODUCT_PROSE_NAME} is open source under the MIT licence. It sends nothing anywhere except to the model APIs you configure.</p>
    <p style="margin-top:12px"><a href="https://github.com/ankit373/citegeo">Source</a> &middot; <a href="https://github.com/ankit373/citegeo/blob/main/ROADMAP.md">Roadmap</a> &middot; <a href="https://github.com/ankit373/citegeo/blob/main/SECURITY.md">Security</a></p>
  </div>
</footer>

</body>
</html>`;
}
