// The vocabulary half of docs/GRAMMAR.md, read out of the running app.
//
// GRAMMAR.md is how Claude (or anything else outside Bureau) builds in Bureau:
// the rules are written by hand, and the words those rules use (every type,
// field, face, shape, bench and compound) are made here, from the app itself,
// the way the specimen book and the Workshop snapshot are (decisions 143 and
// 246). One generator, so the list cannot drift from the app it describes.
//
//   scripts/serve.sh &   node scripts/grammar.mjs        rewrites the section
//   node scripts/grammar.mjs --check                     exits 1 if it is stale
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const DOC = new URL('../docs/GRAMMAR.md', import.meta.url);
const START = '<!-- vocabulary:start -->', END = '<!-- vocabulary:end -->';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium';

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await page.goto('http://localhost:8000/'); await page.waitForTimeout(1500);
const V = await page.evaluate(async () => {
  const M = await import('./js/model.js'), G = await import('./js/grid.js'), P = await import('./js/plans.js');
  const kindRow = k => {
    const d = M.K(k);
    const [w, h] = G.sizeOfKind(k, 'phone');
    return { k, nm: d.nm, ds: d.ds || '', attrs: (d.attrs || []).filter(a => a !== 'container' || true),
      w, h, face: d.face || '', shape: d.shape || '', fam: (d.family || []).length ? d.family.filter(x => M.KINDS[x] && !M.isCut(x)) : null,
      holds: M.kindHas(k, 'container'), compound: !!d.parts };
  };
  const masters = M.MASTERS.map(([m]) => ({ m, nm: M.K(m).nm, members: M.familyList(m).length ? M.familyList(m) : [m] }));
  const listed = new Set(masters.flatMap(x => [x.m, ...x.members]));
  const kinds = {}; M.KEYS.forEach(k => { kinds[k] = kindRow(k); });
  const others = M.KEYS.filter(k => !listed.has(k) && !M.isCut(k) && !(M.S.kinds && M.S.kinds[k]));
  const fields = Object.entries(M.FIELDS).map(([a, f]) => ({ a, key: f.key, type: f.type, nm: f.nm, derived: !!f.derived, meta: !!f.meta }));
  const attrs = Object.entries(M.ATTRS).map(([a, d]) => ({ a, nm: d.nm, ds: d.ds }));
  const flows = P.plans().filter(p => p && p.stock).map(p => ({ nm: p.nm, stock: p.stock, shelved: M.isShelvedPlan(p), sec: p.sec || '', of: p.of || '',
    things: [...new Set((p.objects || []).map(o => String(o.title || '').trim()).filter(Boolean))] }));
  const compounds = Object.entries(M.COMPOUNDS).map(([k, d]) => ({ k, nm: d.nm, ds: d.ds, parts: d.parts.map(p => p.k + ' "' + (p.t || '') + '"') }));
  return { masters, kinds, others, cut: M.CUT_KINDS, fields, attrs, flows, compounds,
    faces: Object.keys(M.FACES), shapes: Object.keys(M.SHAPES), structural: M.STRUCTURAL || ['container', 'magic'] };
});
await browser.close();

const cell = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const out = [];
out.push(START, '', '*Made by `node scripts/grammar.mjs` from the running app. Do not edit by hand; rerun it after changing a type, a field or a bench.*', '');

out.push('### The fifteen, and the types inside each', '',
  'The `type` to write is the key in `code`. A name or a near spelling also works (`kindFromName()`), but the key is never ambiguous. Sizes are the phone default, wide × tall, in cells.', '');
for (const m of V.masters) {
  out.push(`**${m.nm}** (\`${m.m}\`)`, '', '| type | name | size | holds | what it is |', '| --- | --- | --- | --- | --- |');
  for (const k of m.members) {
    const r = V.kinds[k]; if (!r) continue;
    out.push(`| \`${k}\` | ${cell(r.nm)}${r.compound ? ' *(compound)*' : ''} | ${r.w}×${r.h} | ${r.holds ? 'yes' : ''} | ${cell(r.ds)} |`);
  }
  out.push('');
}
out.push('### Types outside the fifteen', '', 'Still made, still valid in a paste, never offered by a picker: what benches and older desks use.', '',
  '| type | name | size | holds | what it is |', '| --- | --- | --- | --- | --- |');
for (const k of V.others) { const r = V.kinds[k]; out.push(`| \`${k}\` | ${cell(r.nm)} | ${r.w}×${r.h} | ${r.holds ? 'yes' : ''} | ${cell(r.ds)} |`); }
out.push('', `**Cut, never write these:** ${V.cut.map(k => '`' + k + '`').join(', ')}.`, '');

out.push('### Benches (stock boards)', '', 'Name one in `plan`. Its things are what `fill` can address by title. *Offered* is whether Timothy can make it from the app now; a shelved one (decision 295) is hidden from every picker for the time being but can still be pasted, so build on an offered one unless he asks for another.', '',
  '| plan | name | offered | list | type it makes | things on it, by title |', '| --- | --- | --- | --- | --- | --- |');
for (const f of V.flows) out.push(`| \`${f.stock}\` | ${cell(f.nm)} | ${f.shelved ? 'shelved' : '**yes**'} | ${f.sec} | \`${f.of}\` | ${cell(f.things.join(', '))} |`);
out.push('');

out.push('### Compounds', '', 'Several objects made as one, grouped and tied. Make one with its key as the `type`. It needs its whole footprint clear, see §5.', '',
  '| type | name | parts |', '| --- | --- | --- |');
for (const c of V.compounds) out.push(`| \`${c.k}\` | ${cell(c.nm)} | ${cell(c.parts.join(' · '))} |`);
out.push('');

out.push('### Attributes and their fields', '', 'An attribute is a trait; some carry a field, which is the key a value is written under.', '',
  '| attribute | name | field | value | what it is |', '| --- | --- | --- | --- | --- |');
const fByA = Object.fromEntries(V.fields.filter(f => !f.meta && !f.derived).map(f => [f.a, f]));
for (const a of V.attrs) { const f = fByA[a.a]; out.push(`| \`${a.a}\` | ${cell(a.nm)} | ${f ? '`' + f.key + '`' : ''} | ${f ? f.type : ''} | ${cell(a.ds)} |`); }
out.push('', `Structural, never set by hand: ${V.structural.map(a => '`' + a + '`').join(', ')}.`, '');

out.push('### Faces and shapes', '', `**Faces** (\`face\`, a container's outside): ${V.faces.map(x => '`' + x + '`').join(', ')}.`, '',
  `**Shapes** (\`shape\`, a thing's outline): ${V.shapes.map(x => '`' + x + '`').join(', ')}.`, '', END);

const doc = readFileSync(DOC, 'utf8');
const a = doc.indexOf(START), b = doc.indexOf(END);
if (a < 0 || b < 0) { console.error('GRAMMAR.md has no vocabulary markers'); process.exit(1); }
const next = doc.slice(0, a) + out.join('\n') + doc.slice(b + END.length);
if (process.argv.includes('--check')) {
  if (next !== doc) { console.error('GRAMMAR.md vocabulary is stale: run node scripts/grammar.mjs'); process.exit(1); }
  console.log('GRAMMAR.md vocabulary is current');
} else { writeFileSync(DOC, next); console.log(`GRAMMAR.md: ${Object.keys(V.kinds).length} types, ${V.flows.length} benches, ${V.compounds.length} compounds`); }
