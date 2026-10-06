// The Showroom (decision 309), every room screenshotted in WebKit at an
// iPhone's size, a screen at a time down each board, plus the lobby, the time it took
// to lay and how many things it made. Not a gate: a way to look at it.
//   node test/showroom.mjs            # phone spreads into test/shots/showroom/
//   node test/showroom.mjs --mac      # and the Mac's, beside them
import { mkdirSync } from 'node:fs';
// WebKit lives beside the container's Chromium, where scripts/webkit.sh put it
process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.BUREAU_WEBKIT_DIR || `${process.env.HOME}/.cache/bureau-webkit`;
const { webkit } = await import('playwright');
const OUT = new URL('./shots/showroom/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const URL_ = process.env.BUREAU_URL || 'http://127.0.0.1:8000/index.html';
const mac = process.argv.includes('--mac');
const browser = await webkit.launch();

async function spreads(device) {
  const phone = device === 'phone';
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 1800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await page.goto(URL_); await page.waitForTimeout(1500);
  const laid = await page.evaluate(() => { const t0 = performance.now(); const r = BUREAU.showroom(true);
    const S = BUREAU.state, sh = r && r.box;
    const under = id => { let n = 0; const walk = p => S.objects.forEach(o => { if (o.parent === p) { n++; walk(o.id); } }); walk(id); return n; };
    const rooms = sh ? S.objects.filter(o => o.parent === sh.id && o.kind === 'drawer').map(o => ({ id: o.id, title: o.title, n: under(o.id) })) : [];
    return { ms: Math.round(performance.now() - t0), id: sh && sh.id, things: sh ? under(sh.id) : 0, rooms }; });
  console.log(`${device}: laid in ${laid.ms}ms, ${laid.things} things, ${laid.rooms.length} rooms`);
  /* Into the room the way a press goes in, so it arrives where it opens (its
     first tile); then a screen at a time down the board, each saved, until
     the scroll stops moving. A Mac draws a whole board, so one is enough. */
  const go = async (id, name) => {
    await page.evaluate(id => { const S = BUREAU.state; S.view = 'drawer'; S.drawerId = id; S.readId = null; BUREAU.render(); }, id);
    await page.waitForTimeout(800);
    for (let i = 1; i <= (phone ? 8 : 1); i++) {
      await page.screenshot({ path: `${OUT}${device}-${name}${phone ? '-' + i : ''}.png` });
      const moved = await page.evaluate(() => { const sc = document.querySelector('#app .scroll'); if (!sc) return false;
        const was = sc.scrollTop; sc.scrollTop = was + sc.clientHeight - 60; return sc.scrollTop > was + 4; });
      if (!moved) break;
      await page.waitForTimeout(700);
    }
  };
  await go(laid.id, '00-lobby');
  let i = 1;
  for (const r of laid.rooms) {
    await go(r.id, String(i++).padStart(2, '0') + '-' + r.title.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, ''));
    console.log(`  ${r.title}: ${r.n} things`);
  }
  console.log(errs.length ? errs.join('\n') : '  no errors');
  await ctx.close();
  return errs;
}

const errs = await spreads('phone');
if (mac) errs.push(...await spreads('desk'));
await browser.close();
if (errs.length) process.exit(1);
