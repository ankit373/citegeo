// Writes the marketing page to site/, with the brand assets it references, so
// the folder is self-contained and can be served from any static host. The page
// carries no script, so it cannot fail in a way the product would notice.
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { renderMarketingHtml } = await import(join(root, 'dist/src/site/marketing-page.js'));

const out = join(root, 'site');
await mkdir(join(out, 'assets', 'brand'), { recursive: true });

const html = renderMarketingHtml();
await writeFile(join(out, 'index.html'), html, 'utf8');

// Referenced by the page. Copied rather than linked, because a static host
// serves this directory and nothing above it.
const assets = ['citegeo-emblem.svg', 'citegeo-lockup.svg'];
for (const asset of assets) {
  await copyFile(join(root, 'assets', 'brand', asset), join(out, 'assets', 'brand', asset));
}

console.log(`site/index.html written, ${html.length.toLocaleString()} bytes, with ${assets.length} brand asset(s).`);
