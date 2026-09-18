// Every commit in a pull request must carry a Signed-off-by trailer naming its
// author, which is how a contributor certifies the terms in the DCO file.
// Self-contained on purpose: no GitHub App to install and nothing to pay for.
// Usage: node scripts/check-dco.mjs <base-ref> <head-ref>
import { execFileSync } from 'node:child_process';

// Separators that cannot appear in a commit message field.
const RECORD = String.fromCharCode(1);
const FIELD = String.fromCharCode(2);

const [, , base, head] = process.argv;
if (!base || !head) {
  console.error('usage: node scripts/check-dco.mjs <base-ref> <head-ref>');
  process.exit(2);
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

// Merge commits author no change of their own, so they are not asked to sign.
let log;
try {
  log = git(['log', '--no-merges', `--format=%H${FIELD}%an${FIELD}%ae${FIELD}%B${RECORD}`, `${base}..${head}`]);
} catch (error) {
  console.error(`could not read the commit range ${base}..${head}`);
  console.error(String(error.stderr || error.message).trim());
  process.exit(2);
}

const signOffEmails = (message) => {
  const found = [];
  for (const raw of message.split('\n')) {
    const line = raw.trim();
    if (!line.toLowerCase().startsWith('signed-off-by:')) continue;
    const open = line.indexOf('<');
    const close = line.indexOf('>', open + 1);
    if (open === -1 || close === -1) continue;
    const email = line.slice(open + 1, close).trim().toLowerCase();
    if (email) found.push(email);
  }
  return found;
};

// Bots cannot agree to anything, and their commits are generated rather than
// authored, so they are not asked to sign. Dependabot commits as "dependabot[bot]".
const isBot = (name, email) => String(name).trim().toLowerCase().endsWith('[bot]')
  || String(email).trim().toLowerCase().includes('[bot]@');

const problems = [];
let checked = 0;
let skipped = 0;

for (const record of log.split(RECORD)) {
  const entry = record.trim();
  if (!entry) continue;
  const [sha, name, email, ...rest] = entry.split(FIELD);
  const message = rest.join(FIELD);
  if (isBot(name, email)) {
    skipped += 1;
    continue;
  }
  checked += 1;
  const signed = signOffEmails(message);
  const short = sha.slice(0, 8);
  if (!signed.length) {
    problems.push(`${short} has no Signed-off-by trailer (author ${name} <${email}>)`);
    continue;
  }
  if (!signed.includes(String(email).trim().toLowerCase())) {
    problems.push(`${short} is signed by ${signed.join(', ')} but authored by <${email}>`);
  }
}

if (problems.length) {
  console.error(`${problems.length} of ${checked} commit(s) do not satisfy the DCO:`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error('');
  console.error('Sign off by committing with -s, for example:');
  console.error('  git commit -s -m "your message"');
  console.error('To fix commits already pushed on this branch:');
  console.error(`  git rebase --signoff ${base}`);
  console.error('  git push --force-with-lease');
  console.error('');
  console.error('The certificate you are signing is in the DCO file at the repository root.');
  process.exit(1);
}

const note = skipped ? ` ${skipped} bot commit(s) skipped.` : '';
console.log(`${checked} commit(s) carry a matching Signed-off-by trailer.${note}`);
