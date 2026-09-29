#!/usr/bin/env node
import { argv, exit } from "node:process";

function usage() {
  console.log(`
Reads an openly licensed corpus of real questions and reports how much of it
matches a query, what those people were trying to do, and which of those
questions no tracked prompt is measuring. See docs/prompt-demand.md.

  npm run demand:explore -- --project <id> --source <wildchat|lmsys> --path <file.jsonl> --query "..." [--limit N] [--questions N]

  --project    the project whose prompts decide what counts as already covered
  --source     which corpus the file is, so its caveat travels with the numbers
  --path       the corpus as JSON Lines
  --query      what to explore, in the words a buyer would use
  --limit      stop indexing after N questions, for a quick look at a large file
  --questions  how many matching questions to keep. Default 25, most 200
`);
}

const args = new Map();
for (let index = 2; index < argv.length; index += 2) {
  const key = argv[index];
  if (!key?.startsWith("--")) continue;
  args.set(key.slice(2), argv[index + 1]);
}
if (!args.get("project") || !args.get("source") || !args.get("path") || !args.get("query")) {
  usage();
  exit(1);
}

const { productDataDir, loadDotEnv } = await import("../dist/src/config/env.js");
loadDotEnv();
const { ProductProjectFileStore } = await import("../dist/src/product/projects/project-store.js");
const { TopicFileStore } = await import("../dist/src/product/topics/topic-store.js");
const { indexCorpus } = await import("../dist/src/product/demand/corpus-ingest.js");
const { exploreConversations } = await import("../dist/src/product/demand/conversation-explorer.js");
const { ExplorationFileStore, explorationId } = await import("../dist/src/product/demand/exploration-store.js");
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

console.log(`Reading ${args.get("path")}. A large corpus takes a few minutes.`);
const corpus = await indexCorpus({
  sourceId,
  path: args.get("path"),
  limit: args.get("limit") ? Number(args.get("limit")) : undefined,
});
console.log(`Indexed ${corpus.index.questions} questions, ${corpus.index.vocabulary} terms.`);

const query = args.get("query");
const report = exploreConversations({
  corpus,
  query,
  prompts,
  limit: args.get("questions") ? Number(args.get("questions")) : undefined,
});

const stored = {
  ...report,
  id: explorationId(query),
  projectId,
  sourceId,
  exploredAt: new Date().toISOString(),
};
await new ExplorationFileStore(projectStore).save(stored);

const share = report.shareOfCorpus === null ? "not comparable" : `${(report.shareOfCorpus * 100).toFixed(3)}% of the corpus`;
console.log(`\n"${query}"`);
console.log(`  ${report.matched} question(s) carry every word of it, ${report.related} carry most. ${share}.`);
console.log(`  ${report.uncovered} of them are measured by no prompt you track.`);
if (report.byIntent.length) {
  console.log("\nWhat those people were doing:");
  for (const row of report.byIntent) {
    console.log(`  ${String(row.intent).padEnd(13)} ${String(row.questions).padStart(4)}  ${(row.share * 100).toFixed(0)}%`);
  }
}
const missing = report.questions.filter((row) => !row.coveredBy);
if (missing.length) {
  console.log("\nAsked, and measured by nothing you track:");
  for (const row of missing.slice(0, 10)) console.log(`  ${row.text}`);
}
console.log(`\n${report.caveat}`);
