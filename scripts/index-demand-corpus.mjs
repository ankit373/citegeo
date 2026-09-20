#!/usr/bin/env node
import { argv, exit } from "node:process";

function usage() {
  console.log(`
Reads an openly licensed corpus of real questions and reports how often anyone
asked something like each prompt you track. See docs/prompt-demand.md.

  npm run demand:index -- --project <id> --source <wildchat|lmsys> --path <file.jsonl> [--limit N]

  --project  the project whose active prompts to report on
  --source   which corpus the file is, so its caveat travels with the numbers
  --path     the corpus as JSON Lines
  --limit    stop after N questions, for a quick look at a large file
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
if (!prompts.length) {
  console.error("This project tracks no active prompts, so there is nothing to look up.");
  exit(1);
}

console.log(`Reading ${args.get("path")}. A large corpus takes a few minutes.`);
const corpus = await indexCorpus({
  sourceId,
  path: args.get("path"),
  limit: args.get("limit") ? Number(args.get("limit")) : undefined,
});
console.log(`Indexed ${corpus.index.questions} questions, ${corpus.index.vocabulary} terms.`);

const report = buildDemandReport({ corpus, prompts });
await new DemandReportFileStore(projectStore).save(projectId, report);

for (const row of report.prompts.slice(0, 10)) {
  console.log(`  ${String(row.match.exactTerms).padStart(6)} exact  ${String(row.match.relatedTerms).padStart(7)} related   ${row.text}`);
}
console.log(`\nSaved. ${report.caveat}`);
