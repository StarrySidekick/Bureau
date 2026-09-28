// The outline each photographed decoration is pressed by (decision 241).
//
// A cut-out PNG is hit-tested as its whole rectangle, so its transparent
// corners swallowed the taps meant for whatever it stood in front of. This
// reads each PNG's alpha in the browser, walks it in horizontal bands, and
// writes the silhouette (left edges down, right edges back up) into decor.js as
// `hit`, in the entry's own viewBox units. decorSVG() lays it over the picture
// as an invisible polygon, and that polygon is the only part that takes a
// press. Run it after adding or replacing a decoration's picture:
//
//   scripts/serve.sh &   node scripts/decor-hits.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'web/js/decor.js');
const src = readFileSync(FILE, 'utf8');
const BANDS = 28, ALPHA = 48, PAD = 0.02;

// every entry with a png, by its key, with its viewBox
const entries = [...src.matchAll(/^  (\w+): \{[^\n]*?png:'([^']+)', vb:'([^']+)'/gm)]
  .map(m => ({ key: m[1], png: m[2], vb: m[3].split(' ').map(Number) }));

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME }
  : { executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.goto('http://localhost:8000/');
const hits = await page.evaluate(async ({ entries, BANDS, ALPHA, PAD }) => {
  const out = {};
  for (const e of entries) {
    const img = new Image(); img.src = e.png;
    await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const a = cx.getImageData(0, 0, W, H).data;
    const [, , vw, vh] = e.vb, sx = vw / W, sy = vh / H, pad = vw * PAD;
    const left = [], right = [];
    for (let b = 0; b < BANDS; b++) {
      const y0 = Math.floor(b * H / BANDS), y1 = Math.floor((b + 1) * H / BANDS);
      let lo = W, hi = -1;
      for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++)
        if (a[(y * W + x) * 4 + 3] > ALPHA) { if (x < lo) lo = x; if (x > hi) hi = x; }
      if (hi < 0) continue;
      const top = y0 * sy, bot = y1 * sy;
      const l = Math.max(0, lo * sx - pad), r = Math.min(vw, (hi + 1) * sx + pad);
      left.push([l, top], [l, bot]); right.push([r, top], [r, bot]);
    }
    const pts = left.concat(right.reverse()).map(([x, y]) => `${Math.round(x)},${Math.round(y)}`);
    // consecutive repeats say nothing
    out[e.key] = pts.filter((p, i) => p !== pts[i - 1]).join(' ');
  }
  return out;
}, { entries, BANDS, ALPHA, PAD });
await browser.close();

let next = src;
for (const e of entries) {
  const re = new RegExp(`^(  ${e.key}: \\{[^\\n]*?vb:'[^']+')(, hit:'[^']*')?`, 'm');
  next = next.replace(re, `$1, hit:'${hits[e.key]}'`);
}
writeFileSync(FILE, next);
console.log(`${entries.length} outlines written to web/js/decor.js`);
