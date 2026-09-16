// What has to agree before a change to web/ ships, checked rather than
// remembered. CLAUDE.md calls the cache bump the easiest thing in the project
// to forget; the commit hook in .claude/settings.json runs this first, so a
// commit that forgot is refused with the reason rather than deployed.
//   node test/version.mjs          (no server, no browser, no dependencies)
//
// Four things, and each one has already cost a session:
//  1. CACHE in web/sw.js is 'bureau-v' + APP_VERSION with the dot taken out.
//  2. SHELL in web/sw.js names exactly the js/ and css/ files on disk. A new
//     file left off it works online and is missing offline.
//  3. Anything under web/ changed against HEAD means CACHE changed too, or
//     every installed copy keeps serving the version before this one.
//  4. APP_VERSION only goes up. It is the commit count, and in a shallow
//     clone `git log | wc -l` is a small number: taken at face value it walked
//     1.70 back to 0.56. The count is only the answer in a full clone.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => readFileSync(resolve(ROOT, f), 'utf8');
const git = cmd => {
  try { return execSync('git ' + cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); }
  catch { return null; }
};

const cacheOf   = src => (src.match(/const CACHE\s*=\s*'([^']+)'/) || [])[1];
const versionOf = src => (src.match(/const APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
const shellOf   = src => {
  const m = src.match(/const SHELL\s*=\s*\[([\s\S]*?)\]/);
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : [];
};
// '1.70' is the 170th commit; compare and count as that number, never as a float.
const num = v => +String(v).replace('.', '');
const fmt = n => `${Math.floor(n / 100)}.${String(n % 100).padStart(2, '0')}`;

const bad = [];
const sw = rd('web/sw.js'), persist = rd('web/js/persist.js');
const cache = cacheOf(sw), version = versionOf(persist);
if (!cache || !version) { console.error('could not read CACHE or APP_VERSION'); process.exit(1); }

// 1 — the two travel together
const want = 'bureau-v' + version.replace('.', '');
if (cache !== want) bad.push(`CACHE is '${cache}' and APP_VERSION ${version} says it should be '${want}'`);

// 2 — everything on disk is in the shell, and everything in the shell is on disk
const shell = shellOf(sw);
const onDisk = ['js', 'css'].flatMap(d => readdirSync(resolve(ROOT, 'web', d)).map(f => `./${d}/${f}`));
for (const f of onDisk) if (!shell.includes(f)) bad.push(`${f} is on disk and not in SHELL, so it will not work offline`);
for (const f of shell) if (f !== './' && !existsSync(resolve(ROOT, 'web', f))) bad.push(`SHELL lists ${f} and there is no such file`);

// 3 and 4 — against what HEAD says, when there is a HEAD to ask
const headSw = git('show HEAD:web/sw.js'), headPersist = git('show HEAD:web/js/persist.js');
const shallow = (git('rev-parse --is-shallow-repository') || '').trim() === 'true';
if (headSw && headPersist) {
  const headCache = cacheOf(headSw), headVersion = versionOf(headPersist);
  const changed = [
    ...(git('diff HEAD --name-only') || '').split('\n'),
    ...(git('ls-files --others --exclude-standard web') || '').split('\n'),
  ].filter(f => f.startsWith('web/') && !f.startsWith('web/activinator/'));
  // The next number: the commit count plus this one in a full clone; in a
  // shallow one the count is a lie, so it is whatever HEAD says plus one.
  const next = shallow ? fmt(num(headVersion) + 1) : fmt(+(git('rev-list --count HEAD') || 0) + 1);
  if (changed.length && cache === headCache)
    bad.push(`web/ has changed (${[...new Set(changed)].join(', ')}) and CACHE is still '${cache}'.\n` +
             `  Set APP_VERSION to '${next}' in web/js/persist.js and CACHE to 'bureau-v${next.replace('.', '')}' in web/sw.js.`);
  if (version !== headVersion && num(version) <= num(headVersion))
    bad.push(`APP_VERSION went from ${headVersion} to ${version}, and it only goes up.` +
             (shallow ? ` This is a shallow clone, so the commit count is a lie: the next is ${next}.` : ''));
}

if (bad.length) {
  console.log(bad.map(b => '✗ ' + b).join('\n'));
  process.exit(1);
}
console.log(`APP_VERSION ${version}, CACHE ${cache}, ${shell.length} in SHELL: consistent${shallow ? ' (shallow clone)' : ''}`);
