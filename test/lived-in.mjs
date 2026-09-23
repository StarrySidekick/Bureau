// Lays the lived-in desk (docs/examples/lived-in.json) onto a fresh Bureau
// through Paste in, opens every board it made on a Mac and on a phone, and
// writes a screenshot of each to test/shots/lived-in/. Not a test, and nothing
// gates on it: it is how the stock boards are judged as somebody using them
// rather than as a layout (decision 197). Needs scripts/serve.sh running.
//   node test/lived-in.mjs
import { chromium } from 'playwright';
import fs from 'fs';
const CHROME = process.env.BUREAU_CHROME;
const URL = process.env.BUREAU_URL || 'http://localhost:8000/';
const out = 'test/shots/lived-in';
fs.mkdirSync(out, { recursive: true });
const json = fs.readFileSync('docs/examples/lived-in.json', 'utf8');
const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
for (const [name, vp] of [['mac', {width:1440, height:900}], ['phone', {width:390, height:844}]]) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: name === 'phone', deviceScaleFactor: name === 'phone' ? 2 : 1 });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(URL); await page.waitForTimeout(1200);
  const made = await page.evaluate(j => { const S = BUREAU.state, had = new Set(S.objects.map(o => o.id));
    BUREAU.paste(j, 'root');
    return S.objects.filter(o => !had.has(o.id) && o.parent === 'root').map(o => [o.id, o.title]); }, json);
  for (const [id, t] of made) {
    await page.evaluate(async id => { const S = BUREAU.state; S.view = 'drawer'; S.drawerId = id;
      BUREAU.render(); await new Promise(r => setTimeout(r, 600)); }, id);
    await page.screenshot({ path: `${out}/${name}-${t.replace(/\W+/g, '_')}.png` });
  }
  console.log(name, made.length, 'boards', errs.length ? errs.join(' | ') : 'no errors');
  await ctx.close();
}
await browser.close();
