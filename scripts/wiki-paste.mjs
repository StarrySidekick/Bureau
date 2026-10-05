// Writes docs/examples/wiki.json from the shipped project dashboards
// (web/js/dashboards.js, decision 304), so the same boards can be pasted by
// hand: Settings → Paste an Object. The app lays these itself (Settings →
// About → Project dashboards); this file is for a desk that wants them as a
// paste, or for reading the grammar by example. Run: node scripts/wiki-paste.mjs
import { writeFileSync } from 'node:fs';
import { DASHBOARDS } from '../web/js/dashboards.js';

const out = DASHBOARDS.map(d => Object.assign({}, d, { update: true }, Array.isArray(d.children) ? { arrange: 'rows', status: true } : {}));
writeFileSync(new URL('../docs/examples/wiki.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('wrote docs/examples/wiki.json,', out.length, 'boards,', JSON.stringify(out).length, 'chars');
