import { html, join } from "../dom.js";
import { button } from "../components/button.js";
import { cell, nameCell, row, section, table, tiles } from "../components/primitives.js";

/** Mirrors the server shapes. The types stay local so every import stays inside
 * the tree the app route serves. */
export interface Movement { field: string; direction: "up" | "down"; before: string; after: string; size: number }
export interface Cause { statement: string; evidence: string }
export interface AimTask { title: string; workflow: string | null; detail: string }
export interface AimMemo {
  movement: Movement | null;
  headline: string;
  causes: Cause[];
  tasks: AimTask[];
  unexplained: string | null;
  writtenAt: string;
}

export interface TemplateOffer { id: string; label: string; purpose: string; needs: string; blocked: string | null; rationale: string }
export interface DraftRow {
  id: string; templateId: string; title: string; body: string; rationale: string;
  status: "awaiting_review" | "approved" | "rejected";
  sources: Array<{ kind: string; reference: string; detail: string }>;
  createdAt: string; reviewNote: string | null;
}

export interface ClaimGroup { claim: string; models: string[]; occurrences: Array<{ quote: string; sourceQuote: string | null; detail: string }> }
export interface FactCheckView {
  tally: { supported: number; contradicted: number; unsupported: number };
  contradicted: ClaimGroup[];
  unsupported: ClaimGroup[];
  domain: string;
  unreadable: number;
}

export interface ShoppingView {
  namedRate: number | null;
  genericAnswers: number;
  unreadable: number;
  considered: number;
  caveat: string;
  products: Array<{ name: string; isTarget: boolean; appearances: number; shareOfAnswers: number | null; merchants: string[] }>;
  merchants: Array<{ name: string; appearances: number; products: string[] }>;
}

export interface ExplorationRow {
  id: string; query: string; matched: number; related: number; uncovered: number;
  shareOfCorpus: number | null; caveat: string;
  byIntent: Array<{ intent: string; questions: number; share: number }>;
  questions: Array<{ text: string; intent: string; coveredBy: string | null }>;
}

export interface EntityView {
  domain: string;
  corroborated: number;
  anchors: Array<{ kind: string; value: string; independent: boolean }>;
  missing: string[];
  risks: string[];
}

function share(value: number | null): string {
  return value === null ? '<span class="state-flag">not comparable</span>' : `<strong>${Math.round(value * 100)}%</strong>`;
}

function empty(what: string): string {
  return `<p class="subtle">${html(what)}</p>`;
}

/** The memo. Every cause shows the observation under it, so a reader can
 * disagree with the conclusion and still check the fact. */
export function marketerView(memo: AimMemo | null): string {
  if (!memo) return section({ title: "Marketer", body: empty("Nothing has been measured yet, so there is nothing to report on.") });

  const movement = memo.movement
    ? tiles([
      { label: "Visibility", value: memo.movement.after, note: `was ${memo.movement.before}`, fraction: null },
      { label: "Direction", value: memo.movement.direction === "up" ? "Up" : "Down", note: memo.movement.field, fraction: null },
    ])
    : "";

  const causes = memo.causes.length
    ? table({
      layout: "mcols-cause",
      columns: ["What may have moved it", "What was observed"],
      rows: memo.causes.map((cause) => row("mcols-cause", [
        nameCell(html(cause.statement)),
        cell(`<span class="subtle">${html(cause.evidence)}</span>`),
      ])),
    })
    : empty("Nothing recorded points at a cause.");

  const tasks = memo.tasks.length
    ? table({
      layout: "mcols-task",
      columns: ["What to do", "Runs as"],
      rows: memo.tasks.map((task) => row("mcols-task", [
        nameCell(html(task.title), html(task.detail)),
        // A task no workflow can do says so rather than offering the nearest.
        cell(task.workflow
          ? button({ label: "Draft it", on: { "data-aim-run": task.workflow } })
          : '<span class="state-flag">a change to the site, not a draft</span>'),
      ])),
    })
    : empty("Nothing outstanding.");

  return join([
    section({
      title: "What moved",
      blurb: memo.headline,
      body: join([movement, memo.unexplained ? `<div class="warning-box">${html(memo.unexplained)}</div>` : ""]),
      wide: true,
    }),
    section({ title: "Why", body: causes }),
    section({ title: "What to do about it", body: tasks }),
  ]);
}

/** Workflows, and the drafts they produced, each awaiting a decision. */
export function draftsView(input: { offers: TemplateOffer[]; drafts: DraftRow[] } | null): string {
  if (!input) return section({ title: "Drafts", body: empty("Loading.") });

  const offers = table({
    layout: "mcols-offer",
    columns: ["Workflow", "State", ""],
    empty: "No workflow is defined.",
    rows: input.offers.map((offer) => row("mcols-offer", [
      nameCell(html(offer.label), html(offer.purpose)),
      // Blocked says what is missing rather than failing when it is asked for.
      cell(offer.blocked
        ? `<span class="state-flag">${html(offer.blocked)}</span>`
        : `<span class="state-ok">${html(offer.rationale || "Ready")}</span>`),
      cell(offer.blocked ? "" : join([
        button({ label: "Draft one", on: { "data-draft": offer.id } }),
        button({ label: "Draft every gap", kind: "quiet", on: { "data-draft-batch": offer.id } }),
      ])),
    ])),
  });

  const drafts = table({
    layout: "mcols-draft",
    columns: ["Draft", "From", "State"],
    empty: "Nothing drafted yet. Every draft waits for a decision before it is anything.",
    rows: input.drafts.map((draft) => row("mcols-draft", [
      nameCell(html(draft.title), html(draft.rationale)),
      cell(`<span class="subtle">${html(String(draft.sources.length))} source(s)</span>`),
      cell(join([
        draft.status === "awaiting_review"
          ? join([
            button({ label: "Approve", on: { "data-review": `${draft.id}:approved` } }),
            button({ label: "Reject", kind: "quiet", tone: "danger", on: { "data-review": `${draft.id}:rejected` } }),
          ])
          : `<span class="${draft.status === "approved" ? "state-ok" : "state-flag"}">${html(draft.status)}</span>`,
        button({ label: "Copy", kind: "quiet", on: { "data-copy-draft": draft.id } }),
      ])),
    ], { clickable: true, attrs: `data-open-draft="${html(draft.id)}"` })),
  });

  return join([
    section({ title: "Workflows", blurb: "Each one drafts from a gap that was measured, never from an idea about what to say.", body: offers, wide: true }),
    section({ title: "Drafts", blurb: "Nothing here is published. A draft is written, and a person decides what happens to it.", body: drafts, wide: true }),
  ]);
}

/** Claims the answers made about the brand, settled against the brand's pages. */
const CHECK_CLAIMS = button({ label: "Check claims now", on: { "data-run-factcheck": true } });

export function claimsView(report: FactCheckView | null): string {
  if (!report) {
    return section({
      title: "Claims",
      blurb: "Reads what the archived answers assert about you and settles each against your own pages.",
      body: join([empty("No claim check has been run for this project yet."), `<div class="inline-actions">${CHECK_CLAIMS}</div>`]),
    });
  }
  const group = (rows: ClaimGroup[], what: string) => table({
    layout: "mcols-claim",
    columns: ["Claim", "Said by", "What the pages say"],
    empty: what,
    rows: rows.map((entry) => row("mcols-claim", [
      nameCell(html(entry.claim), html(entry.occurrences[0]?.quote || "")),
      cell(`<span class="subtle">${html(entry.models.join(", "))}</span>`),
      cell(entry.occurrences[0]?.sourceQuote
        ? `<span class="subtle">${html(entry.occurrences[0]?.sourceQuote || "")}</span>`
        : '<span class="state-flag">the pages do not address it</span>'),
    ])),
  });

  return join([
    section({
      title: "Claims",
      blurb: `Settled against the pages at ${report.domain}. Nothing here calls a claim false; it reports disagreement with those pages.`,
      aside: CHECK_CLAIMS,
      body: tiles([
        { label: "Supported", value: String(report.tally.supported), note: "the pages say it", fraction: null },
        { label: "Contradicted", value: String(report.tally.contradicted), note: "the pages say otherwise", fraction: null },
        { label: "Unsupported", value: String(report.tally.unsupported), note: "the pages do not address it", fraction: null },
      ]),
      wide: true,
    }),
    section({ title: "Contradicted by your own pages", body: group(report.contradicted, "Nothing an answer said contradicts your pages."), wide: true }),
    section({ title: "Said, and your pages do not address it", body: group(report.unsupported, "Every claim was addressed one way or the other."), wide: true }),
  ]);
}

/** What a buying answer named, with the limit of the reading stated. */
const READ_BUYING = button({ label: "Read buying answers", on: { "data-run-shopping": true } });

export function buyingView(report: ShoppingView | null): string {
  if (!report) {
    return section({
      title: "Buying",
      blurb: "Reads which products, brands and retailers your archived buying answers actually named.",
      body: join([empty("No buying answer has been read for this project yet."), `<div class="inline-actions">${READ_BUYING}</div>`]),
    });
  }

  const products = table({
    layout: "mcols-product",
    columns: ["Product", "Named in", "Sold by"],
    empty: "No answer named a product at all, which is the finding rather than a gap in the reading.",
    rows: report.products.map((product) => row("mcols-product", [
      nameCell(html(product.name), product.isTarget ? "yours" : ""),
      cell(`${product.appearances} · ${share(product.shareOfAnswers)}`),
      cell(`<span class="subtle">${html(product.merchants.join(", ") || "not said")}</span>`),
    ])),
  });

  const merchants = table({
    layout: "mcols-merchant",
    columns: ["Merchant", "Pointed at by", "For"],
    empty: "No answer pointed a buyer at a retailer.",
    rows: report.merchants.map((merchant) => row("mcols-merchant", [
      nameCell(html(merchant.name)),
      cell(String(merchant.appearances)),
      cell(`<span class="subtle">${html(merchant.products.slice(0, 4).join(", "))}</span>`),
    ])),
  });

  return join([
    section({
      title: "Buying",
      blurb: report.caveat,
      aside: READ_BUYING,
      body: tiles([
        { label: "Answers naming you", value: report.namedRate === null ? "not asked" : `${Math.round(report.namedRate * 100)}%`, note: "of buying answers", fraction: report.namedRate },
        { label: "Named nothing", value: String(report.genericAnswers), note: "stayed generic", fraction: null },
        { label: "Could not be read", value: String(report.unreadable), note: `of ${report.considered} considered`, fraction: null },
      ]),
      wide: true,
    }),
    section({ title: "Products", body: products, wide: true }),
    section({ title: "Merchants", body: merchants, wide: true }),
  ]);
}

/** Real demand, and which of it nothing here measures. */
export function conversationsView(rows: ExplorationRow[]): string {
  if (!rows.length) {
    return section({
      title: "Conversations",
      body: empty("Nothing has been explored yet. Run npm run demand:explore against a corpus."),
    });
  }
  return join(rows.map((exploration) => section({
    title: exploration.query,
    blurb: `${exploration.matched} question(s) carry every word of it. ${exploration.uncovered} are measured by nothing you track.`,
    body: join([
      tiles([
        { label: "Matched", value: String(exploration.matched), note: "carry every word", fraction: null },
        { label: "Related", value: String(exploration.related), note: "carry most of them", fraction: null },
        { label: "Not tracked", value: String(exploration.uncovered), note: "no prompt measures these", fraction: null },
      ]),
      table({
        layout: "mcols-question",
        columns: ["Asked", "Trying to", "Tracked"],
        empty: "No question to show.",
        rows: exploration.questions.map((question) => row("mcols-question", [
          nameCell(html(question.text)),
          cell(`<span class="subtle">${html(question.intent.split("_").join(" "))}</span>`),
          cell(question.coveredBy ? '<span class="state-ok">yes</span>' : '<span class="state-flag">no</span>'),
        ])),
      }),
      `<p class="field-help">${html(exploration.caveat)}</p>`,
    ]),
    wide: true,
  })));
}

/** What corroborates this brand from outside its own control. */
export function entityView(alignment: EntityView | null, llms: { text: string; listed: number } | null): string {
  const probe = button({ label: "Probe the site now", on: { "data-probe-signals": true } });
  if (!alignment) {
    return section({
      title: "Entity",
      blurb: "Reads what the live site publishes about who owns it.",
      body: join([empty("This project's site has not been probed yet, so nothing is known about what resolves it."), `<div class="inline-actions">${probe}</div>`]),
    });
  }
  const anchors = table({
    layout: "mcols-anchor",
    columns: ["Anchor", "Kind", "Corroborates"],
    empty: "Nothing anchors this domain to an entity at all.",
    rows: alignment.anchors.map((anchor) => row("mcols-anchor", [
      nameCell(html(anchor.value)),
      cell(`<span class="subtle">${html(anchor.kind.split("_").join(" "))}</span>`),
      // A profile the brand publishes about itself corroborates nothing.
      cell(anchor.independent ? '<span class="state-ok">yes</span>' : '<span class="state-flag">the brand controls it</span>'),
    ])),
  });

  return join([
    section({
      title: "Entity",
      blurb: `Whether a model can resolve ${alignment.domain} to a stable entity.`,
      aside: probe,
      body: tiles([
        { label: "Corroborated by", value: String(alignment.corroborated), note: "anchors outside your control", fraction: null },
        { label: "Anchors in total", value: String(alignment.anchors.length), note: "most of them your own", fraction: null },
      ]),
      wide: true,
    }),
    section({ title: "Anchors", body: anchors, wide: true }),
    section({
      title: "What is missing",
      body: alignment.missing.length
        ? `<ul class="protocol-list">${alignment.missing.map((line) => `<li>${html(line)}</li>`).join("")}</ul>`
        : empty("Nothing is missing."),
    }),
    section({
      title: "Risks",
      body: alignment.risks.length
        ? `<ul class="protocol-list">${alignment.risks.map((line) => `<li>${html(line)}</li>`).join("")}</ul>`
        : empty("Nothing here resolves to the wrong entity."),
    }),
    section({
      title: "llms.txt",
      blurb: llms ? `A map of the ${llms.listed} page(s) this site already serves. It is not a second version of the site.` : "",
      aside: llms ? button({ label: "Copy llms.txt", kind: "quiet", on: { "data-copy-llms": true } }) : "",
      body: llms ? `<pre class="llms-draft" data-llms-text>${html(llms.text)}</pre>` : empty("Not drafted yet."),
      wide: true,
    }),
  ]);
}
