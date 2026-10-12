#!/usr/bin/env node
import { argv, exit } from "node:process";

function usage() {
  console.log(`
Reads an openly licensed corpus of real questions and reports how often anyone
asked something like each prompt you track. See docs/prompt-demand.md.

  npm run demand:index -- --project <id> --source <wildchat|lmsys> --path <file.jsonl> [--limit N] [--subject "..."]

  --project  the project to write for
  --source   which corpus the file is, so its caveat travels with the numbers
  --path     the corpus as JSON Lines
  --limit    stop after N questions, for a quick look at a large file
  --subject  what this company is about, for the questions a proposal is
             grounded in. Defaults to the category and description already
             known. A project with no prompts yet still gets this.
`);
}

const args = new Map();
for (let index = 2; index < argv.length; index += 2) {
  const key = argv[index];
  if (!key?.startsWith("--")) continue;
  args.set(key.slice(2), argv[index + 1]);
}
if (!args.get("project") || !args.get("source") || !args.get("path")) {
  usage();
  exit(1);
}

const { productDataDir, loadDotEnv } = await import("../dist/src/config/env.js");
loadDotEnv();
const { ProductProjectFileStore } = await import("../dist/src/product/projects/project-store.js");
const { TopicFileStore } = await import("../dist/src/product/topics/topic-store.js");
const { indexCorpus } = await import("../dist/src/product/demand/corpus-ingest.js");
const { buildDemandReport } = await import("../dist/src/product/demand/demand-match.js");
const { DemandReportFileStore } = await import("../dist/src/product/demand/demand-store.js");
const { corpusDigest } = await import("../dist/src/product/demand/corpus-digest.js");
const { ObservedDemandFileStore } = await import("../dist/src/product/demand/observed-store.js");
const { BrandProfileFileStore } = await import("../dist/src/product/discovery/brand-profile-service.js");
const { activePrompts } = await import("../dist/src/product/topics/topic-schema.js");
const { CORPUS_SOURCES } = await import("../dist/src/product/demand/corpus-schema.js");

const sourceId = args.get("source");
if (!CORPUS_SOURCES.some((row) => row.id === sourceId)) {
  console.error(`Unknown corpus "${sourceId}". Known: ${CORPUS_SOURCES.map((row) => row.id).join(", ")}.`);
  exit(1);
}

const projectStore = new ProductProjectFileStore(productDataDir());
const projectId = args.get("project");
const set = await new TopicFileStore(projectStore).load(projectId);
const prompts = activePrompts(set);

// A project with no prompts is exactly the one that needs grounding most, so
// the digest is written whether or not there is anything to score yet.
let subject = args.get("subject") || "";
if (!subject) {
  const profile = await new BrandProfileFileStore(projectStore).load(projectId).catch(() => null);
  subject = [profile?.productCategory, profile?.businessDescription].filter(Boolean).join(" ");
}
if (!subject) {
  console.error("Nothing is known about what this company does, so there is no subject to look up. Pass --subject, or describe the company on Setup.");
  exit(1);
}

console.log(`Reading ${args.get("path")}. A large corpus takes a few minutes.`);
const corpus = await indexCorpus({
  sourceId,
  path: args.get("path"),
  limit: args.get("limit") ? Number(args.get("limit")) : undefined,
});
console.log(`Indexed ${corpus.index.questions} questions, ${corpus.index.vocabulary} terms.`);

const caveat = CORPUS_SOURCES.find((row) => row.id === sourceId)?.caveat || "";
const digest = corpusDigest({ corpus, subject, caveat });
await new ObservedDemandFileStore(projectStore).save(projectId, digest);
console.log(`\nQuestions about "${subject}": ${digest.matched} matched, ${digest.questions.length} kept to ground a proposal.`);
for (const row of digest.questions.slice(0, 10)) {
  console.log(`  ${String(row.weight).padStart(5)} asked   ${row.text}`);
}

if (prompts.length) {
  const report = buildDemandReport({ corpus, prompts });
  await new DemandReportFileStore(projectStore).save(projectId, report);
  console.log("\nAgainst the prompts already tracked:");
  for (const row of report.prompts.slice(0, 10)) {
    console.log(`  ${String(row.match.exactTerms).padStart(6)} exact  ${String(row.match.relatedTerms).padStart(7)} related   ${row.text}`);
  }
} else {
  console.log("\nThis project tracks no active prompts yet, so there is nothing to score. Propose a set and it will be grounded in the questions above.");
}
console.log(`\nSaved. ${caveat}`);
