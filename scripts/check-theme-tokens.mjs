// Every colour token needs a dark value under both names. Tailwind compiles a
// utility to var(--color-x), so a name missing from a dark block paints light.
import { readFile } from 'node:fs/promises';

const path = 'src/ui/theme.css';
const css = await readFile(path, 'utf8');

function body(marker, from = 0) {
  const at = css.indexOf(marker, from);
  if (at < 0) throw new Error(`${path}: no block for ${marker}`);
  const open = css.indexOf('{', at);
  let depth = 0;
  let cursor = open;
  for (;;) {
    if (css[cursor] === '{') depth += 1;
    else if (css[cursor] === '}' && --depth === 0) break;
    cursor += 1;
  }
  return { text: css.slice(open + 1, cursor), end: cursor };
}

function declarations(text) {
  const found = new Map();
  for (const line of text.split(';')) {
    const colon = line.indexOf(':');
    const name = line.slice(0, colon + 1).trim().replace(':', '').trim();
    if (!name.startsWith('--')) continue;
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

if (problems.length) {
  console.error(`${path}: the two dark palettes disagree.\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

console.log(`Both dark palettes carry the same ${system.size} tokens, covering every colour in the scale.`);
