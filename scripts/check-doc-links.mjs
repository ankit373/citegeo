// A relative link in a Markdown file must resolve to something that exists and
// is tracked. An untracked local file must never make a published link look fine.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const tracked = new Set(
  execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter(Boolean),
);

const directories = new Set(['.']);
for (const file of tracked) {
  for (let dir = path.posix.dirname(file); dir !== '.' && dir !== '/'; dir = path.posix.dirname(dir)) {
    directories.add(dir);
  }
}

const isExternal = (target) =>
  target.startsWith('http://') || target.startsWith('https://') ||
  target.startsWith('mailto:') || target.startsWith('//') || target.startsWith('#');

// Markdown inline links and images, found without a regular expression.
function linkTargets(source) {
  const targets = [];
  let cursor = 0;
  for (;;) {
    const open = source.indexOf('](', cursor);
    if (open === -1) break;
    const close = source.indexOf(')', open);
    if (close === -1) break;
    const raw = source.slice(open + 2, close).trim();
    if (raw && !raw.includes(' ')) targets.push(raw);
    cursor = close + 1;
  }
  return targets;
}

const failures = [];
let checked = 0;

for (const file of [...tracked].filter((name) => name.endsWith('.md'))) {
  const source = await readFile(file, 'utf8');
  for (const raw of linkTargets(source)) {
    if (isExternal(raw)) continue;
    const withoutAnchor = raw.split('#')[0].split('?')[0];
    if (!withoutAnchor) continue;
    checked += 1;
    let decoded;
    try {
      decoded = decodeURIComponent(withoutAnchor);
    } catch {
      failures.push(`${file} -> ${raw} (invalid URL encoding)`);
      continue;
    }
    const target = decoded.startsWith('/')
      ? path.posix.normalize(decoded.slice(1))
      : path.posix.normalize(path.posix.join(path.posix.dirname(file), decoded));
    if (tracked.has(target) || directories.has(target)) continue;
    failures.push(`${file} -> ${raw}${existsSync(target) ? ' (exists but untracked)' : ' (missing)'}`);
  }
}

if (failures.length) {
  console.error(`${failures.length} broken documentation link(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log(`${checked} relative documentation link(s) resolve.`);
