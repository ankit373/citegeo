import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOWS = join(".github", "workflows");

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function valueAfter(line: string, key: string): string {
  const value = line.trim().slice(key.length).trim();
  return value.startsWith('"') || value.startsWith("'") ? value.slice(1, -1) : value;
}

// Job ids and display names under `jobs:`, with a matrix name expanded per value.
function workflowJobs(text: string): { id: string; names: string[] }[] {
  const lines = text.split("\n");
  const jobs: { id: string; names: string[] }[] = [];
  let inJobs = false;
  for (const line of lines) {
    if (line === "jobs:") inJobs = true;
    else if (inJobs && indentOf(line) === 2 && line.trim().endsWith(":")) {
      const id = line.trim().slice(0, -1);
      jobs.push({ id, names: [id] });
    } else if (inJobs && indentOf(line) === 4 && line.trim().startsWith("name:") && jobs.length > 0) {
      jobs[jobs.length - 1]!.names = expandMatrix(valueAfter(line, "name:"), lines);
    }
  }
  return jobs;
}

function expandMatrix(name: string, lines: string[]): string[] {
  const open = name.indexOf("${{ matrix.");
  if (open < 0) return [name];
  const close = name.indexOf("}}", open);
  const key = name.slice(open + "${{ matrix.".length, close).trim();
  const row = lines.find((line) => line.trim().startsWith(`${key}: [`));
  assert.ok(row, `matrix key ${key} has no inline list to expand`);
  const values = row.trim().slice(key.length + 3, -1).split(",").map((value) => value.trim());
  return values.map((value) => name.slice(0, open) + value + name.slice(close + 2));
}

function reportedCheckNames(): Set<string> {
  const names = new Set<string>();
  for (const file of readdirSync(WORKFLOWS).filter((entry) => entry.endsWith(".yml"))) {
    for (const job of workflowJobs(readFileSync(join(WORKFLOWS, file), "utf8"))) {
      for (const name of job.names) names.add(name);
    }
  }
  return names;
}

test("every check the merge queue waits on is one a workflow reports", () => {
  const reported = reportedCheckNames();
  const required = readFileSync(".mergify.yml", "utf8")
    .split("\n")
    .map((line) => line.trim())
    .map((line) => (line.startsWith("- ") ? line.slice(2) : line))
    .filter((line) => line.startsWith("check-success"))
    .map((line) => line.slice(line.indexOf("=") + 1).trim());
  assert.ok(required.length > 0, "found no check-success condition; the parser no longer matches the file");
  assert.deepEqual(required.filter((name) => !reported.has(name)), []);
});

test("PR Gate waits on every other CI job", () => {
  const jobs = workflowJobs(readFileSync(join(WORKFLOWS, "ci.yml"), "utf8")).map((job) => job.id);
  const needsLine = readFileSync(join(WORKFLOWS, "ci.yml"), "utf8")
    .split("\n")
    .find((line) => line.trim().startsWith("needs: ["));
  assert.ok(needsLine, "the gate job has no inline needs list");
  const needs = needsLine.trim().slice("needs: [".length, -1).split(",").map((id) => id.trim());
  assert.deepEqual(jobs.filter((id) => id !== "gate" && !needs.includes(id)), []);
});
