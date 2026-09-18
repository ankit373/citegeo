// The unit suite asserts on HTML strings and never runs them, so an unescaped
// quote inside an emitted script passes every test and still leaves the page
// blank in a browser. This parses what the shells actually emit.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const shells = [
  ['product-phase4-app.js', 'renderProductPhase4AppHtml'],
  ['product-phase5-app.js', 'renderProductPhase5AppHtml'],
  ['product-project-app.js', 'renderProductProjectAppHtml'],
  ['app-html.js', 'renderAppHtml'],
];

const scriptBlocks = (html) => {
  const blocks = [];
  let cursor = 0;
  for (;;) {
    const open = html.indexOf('<script', cursor);
    if (open === -1) break;
    const bodyStart = html.indexOf('>', open);
    if (bodyStart === -1) break;
    const close = html.indexOf('</script>', bodyStart);
    if (close === -1) break;
    const body = html.slice(bodyStart + 1, close);
    if (body.trim()) blocks.push(body);
    cursor = close + 9;
  }
  return blocks;
};

const workDir = mkdtempSync(join(tmpdir(), 'citegeo-scripts-'));
const failures = [];
let checked = 0;

try {
  for (const [file, exportName] of shells) {
    let module;
    try {
      module = await import(`../dist/src/ui/${file}`);
    } catch (error) {
      failures.push(`${file}: could not import (${error.message})`);
      continue;
    }
    const render = module[exportName];
    if (typeof render !== 'function') {
      failures.push(`${file}: ${exportName} is not exported`);
      continue;
    }
    scriptBlocks(render()).forEach((body, index) => {
      const path = join(workDir, `${exportName}-${index}.js`);
      writeFileSync(path, body);
      checked += 1;
      try {
        execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
      } catch (error) {
        const detail = String(error.stderr || '').split('\n').find((line) => line.includes('Error')) || 'parse failed';
        failures.push(`${exportName} block ${index}: ${detail.trim()}`);
      }
    });
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`${failures.length} emitted script(s) do not parse:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`${checked} emitted script block(s) parse.`);
