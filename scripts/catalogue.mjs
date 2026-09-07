/* The specimen book, written to a file.
 *
 *   scripts/serve.sh &  node scripts/catalogue.mjs [out.html]
 *
 * There is no page-building in here any more, and that is the point. The book
 * is `web/js/guide.js`, which the app itself opens from Settings; this script
 * loads the app in a headless browser, asks it for the same string, and writes
 * it down. One generator, two destinations — the old version built the page
 * out here from data it extracted, which meant the file on disk and the page
 * in the app were two books that agreed until somebody edited one.
 *
 * So: nothing to keep in step, and a check that fails loudly rather than
 * quietly, because whatever the app draws is what lands in the file.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const OUT = process.argv[2] || 'catalogue.html';
const URL = process.env.SITE_URL || 'http://localhost:8000/';

// the same escape hatch the smoke test has, for somewhere Playwright did not
// download a Chromium of its own
const b = await chromium.launch(process.env.BUREAU_CHROME
  ? { executablePath: process.env.BUREAU_CHROME } : {});
const p = await b.newPage({ viewport:{ width:1400, height:900 } });
p.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
await p.goto(URL, { waitUntil:'networkidle' });

const doc = await p.evaluate(async () => {
  const g = await import('./js/guide.js');
  return g.guideDoc();
});
await b.close();

writeFileSync(OUT, doc);
const specimens = (doc.match(/class="pvscale"/g) || []).length;
console.log(`${OUT} - ${(doc.length/1024).toFixed(0)}KB, ${specimens} tiles`);
