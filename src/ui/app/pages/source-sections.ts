import { html } from "../dom.js";
import { button } from "../components/button.js";
import { kindWords } from "../labels.js";
import { bar, creditRows, outreachRow, searchDemandRow, shapeRow, type CreditRow, type OutreachTarget, type SearchDemandRow } from "./metric-cells.js";
import type { LoadState } from "../types.js";

export interface InterferenceReport {
  runs: number;
  arrivals: Array<{ host: string; sudden: boolean; arrivedAt: string; questionsAtArrival: number; questionsInRun: number; breadth: number }>;
  arrivedOnce: number;
  shifts: Array<{ host: string; url: string; changed: number; previousAt: string }>;
  caveat: string;
}

export interface ConcentrationReport {
  hosts: Array<{ host: string; isYours: boolean; answers: number; share: number }>;
  halfHeldBy: number | null;
  verdict: string;
  yourRank: number | null;
  topShares: Array<{ share: number; rank: number }>;
  answersWithCitations: number;
  gini: number | null;
  caveat: string;
}

interface PageSide {
  pages: number;
  headingsPerThousand: number | null;
  listItemsPerThousand: number | null;
  tablesPerThousand: number | null;
}

export interface ShapeReport {
  theirs: PageSide;
  yours: PageSide;
  behindOnAll: boolean | null;
  minimum: number;
  effect: string;
  caveat: string;
}

export interface CreditReport {
  comparable: number;
  meanGap: number;
  rows: number;
  tooFewRead: number;
  overCredited: CreditRow[];
  underCredited: CreditRow[];
  finding: string;
  caveat: string;
}

interface KindRow { kind: string; pages: number; share: number }
interface ShareRange { low: number | null; high: number }

export interface KindsReport {
  pages: number;
  cited: number;
  listicleShare: number | null;
  corporateShare: number | null;
  ownedShare: number | null;
  listicleInterval?: ShareRange | null | undefined;
  corporateInterval?: ShareRange | null | undefined;
  listicleBaseline: number;
  corporateBaseline: number;
  ownedBaselineLow: number;
  ownedBaselineHigh: number;
  tooFewToCompare: boolean;
  formats: KindRow[];
  sources: KindRow[];
  caveat: string;
}

export interface OutreachPlan {
  unavailable?: boolean | undefined;
  freshness: { fresh: number; ageing: number; stale: number; undated: number; medianAgeDays: number | null; datedPages: number; caveat: string };
  cited: number;
  answersWithCitations: number;
  answersConsidered: number;
  read: number;
  targets: OutreachTarget[];
}

export interface SearchDemandData {
  configured: boolean;
  siteUrl?: string | null | undefined;
  detail: string;
  report?: { queries: number; totalImpressions: number; window: { from: string; to: string }; prompts: SearchDemandRow[] } | null | undefined;
}

export interface ReferralsData {
  configured: boolean;
  propertyId?: string | null | undefined;
  detail: string;
  report?: { empty: boolean; totalSessions: number; assistants: Array<{ source: string; engaged: number | null; sessions: number }> } | null | undefined;
}

/** The loaders these sections call while idle. Each must be a hoisted function declaration that reads live state. */
export interface SourceActions {
  loadInterference(): void;
  loadConcentration(): void;
  loadShape(): void;
  loadCredit(): void;
  loadKinds(): void;
  loadOutreach(): void;
  loadSearchDemand(): void;
  loadReferrals(): void;
}

function kindRows(rows: KindRow[]): string {
  return rows.map((row) => '<div class="mrow mcols-kind"><div class="mname"><strong>' + html(kindWords(row.kind)) + '</strong></div>'
    + '<span class="mcell">' + row.pages + '</span>'
    + '<span class="mcell">' + Math.round(row.share * 100) + '%</span>'
    + '<span class="mcell">' + bar(row.share) + '</span></div>').join("");
}

export function renderInterference(status: LoadState, report: InterferenceReport | null | undefined, actions: Pick<SourceActions, "loadInterference">): string {
  if (status === "idle") { actions.loadInterference(); }
  if (status !== "ready" || !report) {
    return '<p class="subtle">' + (status === "error" ? "Could not read the shape of the sources." : "Reading how the sources arrived.") + '</p>';
  }
  const sudden = report.arrivals.filter((row: any) => row.sudden);
  if (report.runs < 2) {
    return '<p class="subtle">' + report.runs + ' run(s) have cited anything. A source that arrived everywhere at once can only be told from one that was always there by comparing runs, so this needs a second one.</p>';
  }
  // "Everything grew in over more than one run" was false for 107 of this
  // project's 122 hosts, which were cited in exactly one run and never again.
  const lead = sudden.length
    ? sudden.length + ' source(s) arrived across most of the questions in a single run rather than growing into them.'
    : 'No source arrived across most of the questions in a run that was not the first.'
      + (report.arrivedOnce ? ' ' + report.arrivedOnce + ' of the ' + report.arrivals.length + ' host(s) cited here appear in one run only, which is neither shape.' : '');
  const shifts = report.shifts.length
    ? '<p>' + report.shifts.length + ' cited page(s) changed materially since they were last read.</p>'
      + '<div class="mtable"><div class="mhead mcols-shift"><span>Page</span><span>Changed</span><span>Last read</span></div>'
      + report.shifts.slice(0, 6).map((row: any) => '<div class="mrow mcols-shift"><div class="mname"><strong>' + html(row.host) + '</strong><span class="mono">' + html(row.url.slice(0, 70)) + '</span></div>'
        + '<span class="mcell state-flag">' + Math.round(row.changed * 100) + '%</span>'
        + '<span class="mcell mono">' + html(row.previousAt.slice(0, 10)) + '</span></div>').join("") + '</div>'
    : '<p class="subtle">No cited page has been read twice, so none can be seen to have changed. Re-read them to start that comparison.</p>';
  const rows = sudden.slice(0, 6).map((row: any) => '<div class="mrow mcols-arrival"><div class="mname"><strong>' + html(row.host) + '</strong>'
    + '<span class="subtle">first cited ' + html(row.arrivedAt.slice(0, 10)) + '</span></div>'
    + '<span class="mcell state-flag">' + row.questionsAtArrival + ' of ' + row.questionsInRun + '</span>'
    + '<span class="mcell">' + Math.round(row.breadth * 100) + '%</span></div>').join("");
  return '<p>' + html(lead) + '</p>'
    + (rows ? '<div class="mtable"><div class="mhead mcols-arrival"><span>Source</span><span>Arrived across</span><span>Breadth</span></div>' + rows + '</div>' : '')
    + shifts
    + '<div class="inline-actions">' + button({ label: "Re-read the cited pages", kind: "quiet", on: { "data-refresh-pages": "true" } }) + '</div>'
    + '<p class="mlegend">' + html(report.caveat) + '</p>';
}

export function renderConcentration(status: LoadState, report: ConcentrationReport | null | undefined, actions: Pick<SourceActions, "loadConcentration">): string {
  if (status === "idle") { actions.loadConcentration(); }
  if (status !== "ready" || !report) {
    return '<p class="subtle">' + (status === "error" ? "Could not read who supplies these answers." : "Reading who supplies these answers.") + '</p>';
  }
  if (!report.hosts.length) return '<p class="subtle">No answer carried a citation, so there is nobody supplying them to count.</p>';
  const half = report.halfHeldBy === null ? '' : report.halfHeldBy + ' of ' + report.hosts.length + ' domain(s) supply half of every citation here.';
  // The header offers the reader two worlds and the figures decide which
  // one this is, so the panel says it rather than leaving it as homework.
  const which = report.verdict === "concentrated"
    ? ' A handful of them own the category, so getting onto those is the game.'
    : report.verdict === "spread"
      ? ' The tail is long enough that a new page can still get in.'
      : '';
  const where = report.yourRank === null
    ? ' Your own domain is not among them.'
    : ' Yours is ranked ' + report.yourRank + ' of ' + report.hosts.length + '.';
  const curve = report.topShares.map((row: any) => '<span class="count"><strong>' + Math.round(row.share * 100) + '%</strong>top ' + row.rank + '</span>').join("");
  // Both readings of the row. One count beside one share left a reader
  // dividing the count by the answers and getting a third number.
  const rows = report.hosts.slice(0, 10).map((row: any, index: number) => '<div class="mrow mcols-concentration"><div class="mname"><strong>' + html(row.host) + (row.isYours ? ' <span class="tag">yours</span>' : '') + '</strong></div>'
    + '<span class="mcell mono">' + (index + 1) + '</span>'
    + '<span class="mcell">' + row.answers + ' of ' + report.answersWithCitations + '</span>'
    + '<span class="mcell">' + Math.round(row.share * 100) + '%</span></div>').join("");
  return '<p>' + html(half + which + where) + '</p>'
    + '<div class="countstrip">' + curve + '<span class="count"><strong>' + (report.gini === null ? "Not measurable" : (Math.round(report.gini * 100) / 100)) + '</strong>concentration</span></div>'
    + '<div class="mtable"><div class="mhead mcols-concentration"><span>Domain</span><span>Rank</span><span>Cited in</span><span>Share of citations</span></div>' + rows + '</div>'
    + '<p class="mlegend">' + html(report.caveat) + '</p>';
}

export function renderShape(status: LoadState, report: ShapeReport | null | undefined, actions: Pick<SourceActions, "loadShape">): string {
  if (status === "idle") { actions.loadShape(); }
  if (status !== "ready" || !report) {
    return '<p class="subtle">' + (status === "error" ? "Could not read how these pages are laid out." : "Reading how these pages are laid out.") + '</p>';
  }
  if (!report.theirs.pages) return '<p class="subtle">No page cited on a question you lose has been read back, so there is nothing to compare a layout against.</p>';
  // A verdict off one page of yours is a verdict about that page. The side
  // that is short is named, because "nothing to compare" and "three pages
  // short of a comparison" are different things to do something about.
  const lead = report.behindOnAll !== null
    ? report.behindOnAll
      ? 'The pages cited instead of you carry more structure than yours on every count below.'
      : 'Your pages are not behind on every count.'
    : !report.yours.pages
      ? 'None of your own pages has been cited and read back, so there is nothing of yours to compare. The figures on the left are what is already winning here.'
      : 'Each side needs ' + report.minimum + ' pages read back before this is a comparison between two kinds of page rather than between two pages. '
        + report.yours.pages + ' of yours and ' + report.theirs.pages + ' of theirs have been read, so the figures stand and the verdict does not.';
  return '<p>' + html(lead) + '</p>'
    + '<div class="mtable"><div class="mhead mcols-shape"><span>Per thousand words</span><span>Cited instead of you</span><span>Yours</span></div>'
    + shapeRow("Headings", report.theirs.headingsPerThousand, report.yours.headingsPerThousand)
    + shapeRow("List items", report.theirs.listItemsPerThousand, report.yours.listItemsPerThousand)
    + shapeRow("Tables", report.theirs.tablesPerThousand, report.yours.tablesPerThousand)
    + '</div>'
    + '<p class="subtle">' + html(report.effect) + '</p>'
    + '<p class="mlegend">' + html(report.caveat) + '</p>';
}

export function renderCredit(status: LoadState, report: CreditReport | null | undefined, actions: Pick<SourceActions, "loadCredit">): string {
  if (status === "idle") { actions.loadCredit(); }
  if (status !== "ready" || !report) {
    return '<p class="subtle">' + (status === "error" ? "Could not compare credit against contribution." : "Comparing where pages were cited against what the answers took from them.") + '</p>';
  }
  if (!report.comparable) {
    return '<p class="subtle">No answer cited two pages that could both be read back, so there is no citation list to rank within. Read the cited pages and this fills.</p>';
  }
  const lead = 'Across ' + report.comparable + ' answer(s) citing more than one page that could be read, a page sits ' + report.meanGap + ' place(s) from where its contribution would put it on average, over ' + report.rows + ' page(s) ranked.'
    + (report.tooFewRead ? ' ' + report.tooFewRead + ' more answer(s) cited something, with fewer than two of their pages read back, so nothing could be ranked inside them.' : '');
  const over = report.overCredited.length
    ? '<p><strong>Cited early, barely used.</strong></p><div class="mtable"><div class="mhead mcols-credit"><span>Page</span><span>Cited</span><span>Used</span><span>Gap</span></div>' + creditRows(report.overCredited, "state-flag") + '</div>'
    : '';
  const under = report.underCredited.length
    ? '<p><strong>Used heavily, cited late.</strong></p><div class="mtable"><div class="mhead mcols-credit"><span>Page</span><span>Cited</span><span>Used</span><span>Gap</span></div>' + creditRows(report.underCredited, "state-ok") + '</div>'
    : '';
  const none = !over && !under ? '<p class="subtle">No page sits far from where its contribution would put it.</p>' : '';
  return '<p>' + html(lead) + '</p>' + over + under + none
    + '<p class="subtle">' + html(report.finding) + '</p>'
    + '<p class="mlegend">' + html(report.caveat) + '</p>';
}

export function renderKinds(status: LoadState, report: KindsReport | null | undefined, actions: Pick<SourceActions, "loadKinds">): string {
  if (status === "idle") { actions.loadKinds(); }
  if (status !== "ready" || !report) {
    return '<p class="subtle">' + (status === "error" ? "Could not read what kind of pages are cited." : "Reading what kind of pages are cited.") + '</p>';
  }
  if (!report.pages) return '<p class="subtle">No cited page has been read back, so there is nothing to say about what kind of page wins here.</p>';
  // A share off thirteen pages has a range wider than its distance from the
  // published figure, so the range travels with it and the comparison is
  // withheld rather than printed as a finding.
  const over = report.pages + ' of the ' + report.cited + ' page(s) these answers cited have been read back. ';
  const span = (interval: any) => interval && interval.low !== null
    ? ' (' + Math.round(interval.low * 100) + ' to ' + Math.round(interval.high * 100) + '%)'
    : '';
  const listicle = 'Ranked best-of pages are ' + Math.round((report.listicleShare || 0) * 100) + '%' + span(report.listicleInterval)
    + ' of what has been read here, against ' + Math.round(report.listicleBaseline * 100) + '% published.';
  const corporate = ' A site belonging to a company in this category accounts for ' + Math.round((report.corporateShare || 0) * 100) + '%'
    + span(report.corporateInterval) + ', against ' + Math.round(report.corporateBaseline * 100) + '%.';
  const thin = report.tooFewToCompare
    ? '<p class="subtle">' + html(over + 'That is too few for either share to be set against a published one: the range each is consistent with is wider than its distance from the baseline. Read the rest of the cited pages to close it.') + '</p>'
    : '';
  // Being absent from your own citations is what usually happens, so the
  // figure is given with the band rather than as nought out of ten.
  const ownedPercent = Math.round((report.ownedShare || 0) * 100);
  const band = Math.round(report.ownedBaselineLow * 100) + ' to ' + Math.round(report.ownedBaselineHigh * 100) + '%';
  const owned = report.ownedShare === null ? '' : report.ownedShare >= report.ownedBaselineLow
    ? 'Your own pages are ' + ownedPercent + '% of what was cited, inside the ' + band + ' a brand\u2019s own domain usually gets.'
    : 'Your own pages are ' + ownedPercent + '% of what was cited. Published work puts a brand\u2019s own domain at ' + band + ' of its citations, so the work is on the pages you do not own.';
  return '<p>' + html(listicle + corporate) + '</p>' + thin
    + (owned ? '<p>' + html(owned) + '</p>' : '')
    + '<div class="mtable"><div class="mhead mcols-kind"><span>Format</span><span>Pages</span><span>Share</span><span></span></div>' + kindRows(report.formats) + '</div>'
    + '<div class="mtable" style="margin-top:14px"><div class="mhead mcols-kind"><span>Belongs to</span><span>Pages</span><span>Share</span><span></span></div>' + kindRows(report.sources) + '</div>'
    + '<p class="mlegend">' + html(report.caveat) + '</p>';
}

export function renderOutreach(status: LoadState, plan: OutreachPlan | null | undefined, harvesting: boolean, actions: Pick<SourceActions, "loadOutreach">): string {
  if (status === "idle") { actions.loadOutreach(); }
  if (status !== "ready" || !plan) {
    return '<p class="subtle">' + (status === "error" ? "Could not read the cited pages." : "Reading which pages the answers cited.") + '</p>';
  }
  const harvestAction = button({ label: (harvesting ? "Reading…" : "Read the cited pages"), disabled: harvesting, on: { "data-harvest-pages": true } });
  if (plan.unavailable) {
    return '<p class="subtle">No archived answer carried a source, so there is no page to read. That is a property of the models and surfaces that ran, not evidence that nobody cites you. Turn on a grounded provider or an answer surface and run again.</p>';
  }
  const age = plan.freshness;
  const aged = age.fresh + age.ageing + age.stale;
  const freshLine = aged || age.undated
    ? '<p class="subtle">Of the pages read back, ' + age.fresh + ' fresh, ' + age.ageing + ' ageing and ' + age.stale + ' stale'
      + (age.undated ? ', and ' + age.undated + ' state no date at all' : '')
      + (age.medianAgeDays === null ? '. None of them gave a date to take a median of.' : '. Median age ' + age.medianAgeDays + ' days, over the ' + age.datedPages + ' that state one.')
      + ' ' + html(age.caveat) + '</p>'
    : '';
  return '<p class="subtle">' + plan.cited + ' page(s) cited across ' + plan.answersWithCitations + ' of ' + plan.answersConsidered + ' answer(s). ' + plan.read + ' read back.</p>'
    + freshLine
    + '<div class="inline-actions">' + harvestAction + '</div>'
    + '<div class="mtable"><div class="mhead mcols-source"><span>Page</span><span>You</span><span>Cited</span><span>Page age</span></div>'
    + plan.targets.slice(0, 20).map(outreachRow).join("") + '</div>';
}

export function renderSearchDemand(status: LoadState, data: SearchDemandData | null | undefined, pulling: boolean, actions: Pick<SourceActions, "loadSearchDemand">): string {
  if (status === "idle") { actions.loadSearchDemand(); }
  if (status !== "ready" || !data) {
    return '<p class="subtle">' + (status === "error" ? "Could not read the Search Console settings." : "Checking for a Search Console key.") + '</p>';
  }
  const pullAction = data.configured && data.siteUrl
    ? button({ label: (pulling ? "Reading…" : "Pull the last 90 days"), disabled: pulling, on: { "data-pull-search": true } })
    : button({ label: "Add the key in Setup", on: { "data-page": "setup" } });
  const head = '<p class="subtle">' + html(data.detail) + '</p><div class="inline-actions">' + pullAction + '</div>';
  const report = data.report;
  if (!report) return head;
  const gaps = report.prompts.filter((row: any) => row.earnedInSearchAbsentInAnswers).length;
  return head
    + '<p class="subtle">' + report.queries + ' query row(s), ' + report.totalImpressions + ' impression(s), ' + html(report.window.from) + ' to ' + html(report.window.to) + '. '
    + (gaps ? gaps + ' question(s) earn search impressions while no answer names you. Those are the clearest gaps here.' : 'No question earns search impressions while the answers leave you out.')
    + '</p>'
    + '<div class="mtable"><div class="mhead mcols-search"><span>Question, and the queries matching it</span><span>Impressions</span><span>Clicks</span><span>Position</span></div>'
    + report.prompts.slice(0, 20).map(searchDemandRow).join("") + '</div>'
    + '<p class="evidence-note">Search queries are not AI prompts and this does not pretend otherwise. It is measured demand for the same subject, from the one place that reports it.</p>';
}

export function renderReferrals(status: LoadState, data: ReferralsData | null | undefined, pullingReferrals: boolean, actions: Pick<SourceActions, "loadReferrals">): string {
  if (status === "idle") { actions.loadReferrals(); }
  if (status !== "ready" || !data) {
    return '<p class="subtle">' + (status === "error" ? "Could not read the Analytics settings." : "Checking for an Analytics property.") + '</p>';
  }
  const pullAction = data.configured && data.propertyId
    ? button({ label: (pullingReferrals ? "Reading…" : "Pull the last 90 days"), disabled: pullingReferrals, on: { "data-pull-referrals": true } })
    : button({ label: "Add it in Setup", on: { "data-page": "setup" } });
  const head = '<p class="subtle">' + html(data.detail) + '</p><div class="inline-actions">' + pullAction + '</div>';
  const report = data.report;
  if (!report) return head;
  if (report.empty) return head + '<p class="subtle">The property reported no row at all for this window, which is a property with nothing in it rather than a property where nobody arrived from an assistant.</p>';
  if (!report.assistants.length) return head + '<p class="subtle">' + report.totalSessions + ' session(s) in the window and none from an assistant this tool knows. Being named is not the same as being visited.</p>';
  return head + '<div class="mtable"><div class="mhead mcols-rank"><span>Assistant</span><span>Sessions</span><span>Share of all</span></div>'
    + report.assistants.map((row: any) => '<div class="mrow mcols-rank">'
      + '<div class="mname"><strong>' + html(row.source) + '</strong><span class="subtle">' + (row.engaged === null ? "engagement not reported" : row.engaged + ' engaged') + '</span></div>'
      + '<span class="mcell">' + row.sessions + '</span>'
      + '<span class="mcell">' + (report.totalSessions ? Math.round(row.sessions / report.totalSessions * 1000) / 10 + '%' : "Not measurable") + '</span></div>').join("")
    + '</div><p class="evidence-note">Arriving is a different claim from being named. A high score with no sessions means the answers name you and nobody clicks through, which is the normal case and not a fault in either number.</p>';
}