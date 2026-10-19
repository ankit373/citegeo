// Every colour token needs a dark value under both names. Tailwind compiles a
// utility to var(--color-x), so a name missing from a dark block paints light.
import { readFile } from 'node:fs/promises';

const path = 'src/ui/theme.css';
const css = await readFile(path, 'utf8');

function blockIn(source, where, marker, from = 0) {
  const at = source.indexOf(marker, from);
  if (at < 0) throw new Error(`${where}: no block for ${marker}`);
  const open = source.indexOf('{', at);
  let depth = 0;
  let cursor = open;
  for (;;) {
    if (source[cursor] === '{') depth += 1;
    else if (source[cursor] === '}' && --depth === 0) break;
    cursor += 1;
  }
  return { text: source.slice(open + 1, cursor), end: cursor };
}

function body(marker, from = 0) {
  return blockIn(css, path, marker, from);
}

function declarations(text) {
  const found = new Map();
  for (const line of text.split(';')) {
    const colon = line.indexOf(':');
    const name = line.slice(0, colon + 1).trim().replace(':', '').trim();
      if (!name.startsWith('--') && name !== 'color-scheme') continue;
    // Last one wins, the same way the cascade resolves it.
    found.set(name, line.slice(colon + 1).trim());
  }
  return found;
}

const scale = declarations(body('@theme {').text);
const media = body('@media (prefers-color-scheme: dark)');
const system = declarations(body(':root:not([data-theme="light"]) {', media.end - media.text.length).text);
const chosen = declarations(body(':root[data-theme="dark"]').text);

const problems = [];
for (const name of scale.keys()) {
  if (!name.startsWith('--color-')) continue;
  const alias = `--${name.slice('--color-'.length)}`;
  for (const [label, block] of [['system dark', system], ['data-theme="dark"', chosen]]) {
    if (!block.has(name)) problems.push(`${name} has no value under ${label}`);
    if (!block.has(alias)) problems.push(`${alias} has no value under ${label}`);
  }
}

for (const [name, value] of system) {
  if (chosen.get(name) !== value) {
    problems.push(`${name} is "${value}" under system dark and "${chosen.get(name) ?? 'unset'}" under data-theme="dark"`);
  }
}

// A browser told nothing assumes light and paints dialogs and form controls
// with black ink, so each dark block has to say what it is.
for (const [label, block] of [['system dark', system], ['data-theme="dark"', chosen]]) {
  if (block.get('color-scheme') !== 'dark') problems.push(`${label} does not declare color-scheme: dark`);
}

if (problems.length) {
  console.error(`${path}: the two dark palettes disagree.\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

console.log(`Both dark palettes carry the same ${system.size} declarations, covering every colour in the scale.`);

// The surfaces that carry their own palette are in a file this check did not
// read, which is the drift it exists to catch, one directory over.
const shellPath = 'src/ui/theme.ts';
const shell = await readFile(shellPath, 'utf8');
const shellLight = declarations(blockIn(shell, shellPath, ':root {').text);
const shellMedia = blockIn(shell, shellPath, '@media (prefers-color-scheme: dark)');
const shellSystem = declarations(blockIn(shell, shellPath, ':root:not([data-theme="light"]) {', shellMedia.end - shellMedia.text.length).text);
const shellChosen = declarations(blockIn(shell, shellPath, ':root[data-theme="dark"]').text);

function isColour(value) {
  const head = value.toLowerCase();
  return head.startsWith('#') || head.startsWith('rgb') || head.startsWith('hsl') || head.startsWith('color-mix');
}

const shellColours = [...shellLight].filter(([, value]) => isColour(value)).map(([name]) => name);
const shellProblems = [];
for (const name of shellColours) {
  for (const [label, block] of [['system dark', shellSystem], ['data-theme="dark"', shellChosen]]) {
    if (!block.has(name)) shellProblems.push(`${name} has no value under ${label}`);
  }
}
for (const [name, value] of shellSystem) {
  if (shellChosen.get(name) !== value) {
    shellProblems.push(`${name} is "${value}" under system dark and "${shellChosen.get(name) ?? 'unset'}" under data-theme="dark"`);
  }
}

if (shellProblems.length) {
  console.error(`${shellPath}: the two dark palettes disagree.\n  ${shellProblems.join('\n  ')}`);
  process.exit(1);
}

console.log(`${shellPath}: every one of its ${shellColours.length} colours has a value under both dark palettes.`);
