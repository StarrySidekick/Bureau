// Some of test/smoke.mjs rather than all of it. The full run is 129 blocks
// and about five minutes, and it stays the gate: nothing is done until it
// passes. This is for the loop before that, when one block is the one you are
// working on and five minutes a turn is the whole afternoon.
//
// smoke.mjs itself is never touched. This reads it, keeps the blocks you name
// plus every block that declares something a kept block reads, cuts the rest
// out of the text, and runs what is left. A block that quietly stood on page
// state a cut block left behind fails loudly (an assertion goes false, or a
// name is not defined) rather than passing; that is the design, not a gap.
//
//   node test/smoke-only.mjs --list          every block, numbered
//   node test/smoke-only.mjs gravity         blocks whose title contains it
//   node test/smoke-only.mjs 7 118           by number; the two mix
//   node test/smoke-only.mjs --all           the whole file, as a self-check
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'test/smoke.mjs');
const L = readFileSync(SRC, 'utf8').split('\n');

// A block starts at a top-level `// ---` or `/* ---` comment and runs to the
// next one; the last runs to the console.log that prints every result.
const marks = L.map((l, i) => /^  (\/\/|\/\*) ---/.test(l) ? i : -1).filter(i => i >= 0);
const finalAt = L.findIndex(l => l.includes('console.log(JSON.stringify({'));
const finalEnd = L.findIndex((l, i) => i > finalAt && l.includes('}, null, 2));'));
if (!marks.length || finalAt < 0 || finalEnd < 0) { console.error('smoke.mjs is not shaped the way this expects'); process.exit(2); }
const blocks = marks.map((s, k) => ({
  k, s, e: k + 1 < marks.length ? marks[k + 1] : finalAt,
  title: L[s].replace(/^  (\/\/|\/\*) -+\s*/, '').replace(/[-\s*/]+$/, '').trim(),
}));

const args = process.argv.slice(2);
if (!args.length || args.includes('--list')) {
  for (const b of blocks) console.log(`${String(b.k).padStart(3)}  ${b.title}   (lines ${b.s + 1}-${b.e})`);
  if (!args.length) console.log('\nname some, by number or by a word from the title');
  process.exit(0);
}

// What each block declares at top level, and what it reads. Comments are
// stripped before the read scan so an English "before" in a note does not
// pull in the block that declares a `before`.
const declOf = lines => {
  const out = new Set();
  for (const l of lines) {
    const m = /^  (?:const|let|var)\s+(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))/.exec(l);
    if (!m) continue;
    if (m[1]) m[1].split(',').forEach(x => { const n = x.split(':').pop().trim(); if (n) out.add(n); });
    else out.add(m[2]);
  }
  return out;
};
const readsOf = lines => new Set(
  lines.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').match(/[A-Za-z_$][\w$]*/g) || []);
for (const b of blocks) { b.decl = declOf(L.slice(b.s, b.e)); b.reads = readsOf(L.slice(b.s, b.e)); }

// Selection, then the closure: anything a kept block reads that an earlier
// block declared keeps that block too, until nothing changes. Block 0 is the
// page and the helpers, and is always kept.
const keep = new Set([0]);
const why = new Map();
if (args.includes('--all')) blocks.forEach(b => keep.add(b.k));
for (const a of args) {
  if (a.startsWith('--')) continue;
  if (/^\d+$/.test(a)) { if (blocks[+a]) { keep.add(+a); why.set(+a, 'asked for'); } else console.error(`no block ${a}`); }
  else for (const b of blocks) if (b.title.toLowerCase().includes(a.toLowerCase())) { keep.add(b.k); why.set(b.k, `"${a}"`); }
}
if (keep.size === 1) { console.error('nothing matched; --list shows the names'); process.exit(2); }
let grew = true;
while (grew) {
  grew = false;
  for (const b of blocks) if (keep.has(b.k))
    for (const p of blocks) if (p.k < b.k && !keep.has(p.k) && [...p.decl].some(n => b.reads.has(n))) {
      keep.add(p.k); why.set(p.k, `#${b.k} reads ${[...p.decl].filter(n => b.reads.has(n)).join(', ')}`); grew = true;
    }
}

// The text: everything before the first block, the kept blocks, and the
// final print with only the names that still exist.
const kept = blocks.filter(b => keep.has(b.k));
const declared = new Set([...declOf(L.slice(0, marks[0])), ...kept.flatMap(b => [...b.decl])]);
const printed = L.slice(finalAt, finalEnd + 1).join('\n');
const inner = printed.slice(printed.indexOf('{') + 1, printed.lastIndexOf('}'));
const entries = inner.split(',').map(s => s.trim()).filter(Boolean)
  .filter(e => declared.has(e.includes(':') ? e.split(':')[1].trim() : e));
const out = [
  ...L.slice(0, marks[0]),
  ...kept.flatMap(b => L.slice(b.s, b.e)),
  `  console.log(JSON.stringify({ ${entries.join(', ')} }, null, 2));`,
  ...L.slice(finalEnd + 1),
].join('\n');

console.error(`smoke-only: ${kept.length} of ${blocks.length} blocks`);
for (const b of kept) console.error(`  #${String(b.k).padStart(3)} ${b.title.slice(0, 60).padEnd(60)} ${b.k === 0 ? 'setup' : why.get(b.k) || ''}`);
const t0 = Date.now();
const r = spawnSync(process.execPath, ['--input-type=module', '-'], { input: out, stdio: ['pipe', 'inherit', 'inherit'], cwd: ROOT });
console.error(`smoke-only: ${((Date.now() - t0) / 1000).toFixed(0)}s, exit ${r.status}`);
process.exit(r.status ?? 1);
