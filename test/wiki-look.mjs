// Pastes docs/examples/wiki.json into a fresh Bureau in WebKit at an iPhone's
// size and screenshots each board it made, scrolled down a screen at a time.
// Not a test: how the wiki boards are looked at. Needs scripts/serve.sh.
//   node test/wiki-look.mjs [outdir]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const URL = process.env.BUREAU_URL || 'http://127.0.0.1:8000/index.html';
const DIR = process.env.BUREAU_WEBKIT_DIR || `${process.env.HOME}/.cache/bureau-webkit`;
execFileSync('scripts/webkit.sh', { stdio: ['ignore', 'ignore', 'inherit'] });
process.env.PLAYWRIGHT_BROWSERS_PATH = DIR;
const { webkit } = await import('../node_modules/playwright/index.mjs');
const out = process.argv[2] || 'test/shots/wiki';
fs.mkdirSync(out, { recursive: true });
const json = fs.readFileSync('docs/examples/wiki.json', 'utf8');
const browser = await webkit.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', e => errs.push(String(e)));
await page.goto(URL); await page.waitForTimeout(1500);
const made = await page.evaluate(j => { const S = BUREAU.state, had = new Set(S.objects.map(o => o.id));
  BUREAU.paste(j, 'root');
  return S.objects.filter(o => !had.has(o.id) && o.parent === 'root').map(o => [o.id, o.title]); }, json);
await page.screenshot({ path: `${out}/0-desk.png` });
for (const [id, t] of made) {
  await page.evaluate(async id => { const S = BUREAU.state; S.view = 'drawer'; S.drawerId = id;
    BUREAU.render(); await new Promise(r => setTimeout(r, 700)); }, id);
  const name = t.replace(/\W+/g, '_');
  for (let i = 0; i < 6; i++) {
    await page.screenshot({ path: `${out}/${name}-${i}.png` });
    const moved = await page.evaluate(() => { const s = [...document.querySelectorAll('#app *')].find(e => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible' && getComputedStyle(e).overflowY !== 'hidden');
      if (!s) return false; const was = s.scrollTop; s.scrollTop += 560; return s.scrollTop !== was; });
    await page.waitForTimeout(500);
    if (!moved) break;
  }
}
console.log(made.length, 'boards', errs.length ? errs.join(' | ') : 'no errors');
await browser.close();
