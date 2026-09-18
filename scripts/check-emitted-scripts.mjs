// The unit suite asserts on HTML strings and never runs them, so an unescaped
// quote inside an emitted script passes every test and still leaves the page
// blank in a browser. This parses what the shells actually emit.
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

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
const pageFiles = [];
let checked = 0;

// TypeScript cannot see inside the template literals these shells are built
// from, and `node --check` only parses, so a variable that is never defined
// passes both and throws in the browser. Scripts on one page share a global
// scope, so each shell's blocks are checked together.
// One program per page: a script file with no imports is global to its program,
// so checking them together would report every page's globals as duplicates.
const checkIdentifiers = (file) => {
  const program = ts.createProgram([file], {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  });
  const wanted = new Set([2304, 2451]);
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    if (!wanted.has(diagnostic.code) || !diagnostic.file) continue;
    const at = diagnostic.start === undefined
      ? ''
      : ' line ' + String(diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1);
    const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
    failures.push(basename(diagnostic.file.fileName) + at + ': ' + text);
  }
};

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
    const blocks = scriptBlocks(render());
    const pagePath = join(workDir, `page-${exportName}.js`);
    writeFileSync(pagePath, blocks.join('\n;\n'));
    pageFiles.push(pagePath);
    blocks.forEach((body, index) => {
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
  for (const pageFile of pageFiles) checkIdentifiers(pageFile);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`${failures.length} problem(s) in the emitted scripts:`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`${checked} emitted script block(s) parse, with no undefined or redeclared names.`);
