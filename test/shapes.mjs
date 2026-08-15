// A picture of what a task could look like. Renders the current sliver beside
// the four new shapes, on a real desk, in two styles — the tiles are the real
// gridTile(), so this cannot drift from what you would actually get.
//   node test/shapes.mjs      (needs the server running)
import { chromium } from 'playwright';
const URL = process.env.BUREAU_URL || 'http://127.0.0.1:8000/index.html';
const CHROME = process.env.BUREAU_CHROME;

const SHAPES = [
  ['sliver', 'Sliver — what a task is today'],
  ['tab',    'Filing tab — a cut corner and a coloured tab'],
  ['ruled',  'Ruled line — no box at all, a rule under the words'],
  ['chit',   'Torn chit — perforated at both ends'],
  ['pill',   'Pill — an outline, no fill']
];

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1080, height: 760 } });
const page = await ctx.newPage();
await page.goto(URL);
await page.waitForTimeout(700);

for (const style of ['victorian', 'starry']) {
  await page.evaluate(([shapes, style]) => {
    const S = BUREAU.state;
    S.look.style = style;
    S.objects = S.objects.filter(o => o.id === 'root');
    S.pins = []; S.view = 'desk'; S.drawerId = null; S.deskCfg.layout = 'grid';
    shapes.forEach(([sh, label], i) => {
      const o = BUREAU.create('task', { parent: 'root', title: label });
      o.shape = sh;
      o.desk = { x: 2, y: 2 + i * 3, w: 11, h: 1 };
      // the same shape narrow, since a task is often half a desk wide
      const n = BUREAU.create('task', { parent: 'root', title: 'Water the fig' });
      n.shape = sh; n.c = 6 + i;
      n.desk = { x: 15, y: 2 + i * 3, w: 6, h: 1 };
    });
    BUREAU.render();
  }, [SHAPES, style]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test/shots/shapes-${style}.png` });
  console.log('test/shots/shapes-' + style + '.png');
}
await browser.close();
