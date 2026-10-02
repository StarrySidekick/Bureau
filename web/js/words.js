import { S, K, has, isContainer, setting, setSetting } from './model.js';
import { hexOf, bestInk } from './look.js';

/* ============================================================
   the words · how a thing that is written is set
   ============================================================
   An object's colour, shape, stock and edge say what the *sheet* is. These
   say what is printed on it: the typeface, the ink, the paper's own colour,
   the weight, the size on the face and the size on the page, the spacing, the
   alignment, and how a long piece is laid out when it is read. Before this a
   note's type was the aesthetic's and nothing else, the reader was 14.5px
   whatever you were reading, and ink could not be chosen at all.

   **Four layers, first answer wins:** the object's own field, then what you
   said for every object of its type (`setting('words')[kind]`), then what you said
   for every written thing on the desk (`setting('words')['*']`), then the type's
   built-in table (`words` on a kind). Kept in `S.look` rather than as a copy
   of the kind in `S.kinds`, because an overridden kind moves to *Yours* in the
   picker and takes every other field of the type with it.

   Everything is drawn from **one** place — `wordStyle()` — and the tile, the
   reading surface and the offscreen ruler that measures the pages all ask it.
   A ruler set in a different face from the page it measures for is how a book
   comes out with its last lines cut off. See decision 247. */

// the typefaces. System stacks only: no font files, nothing to cache, and on
// a Mac or an iPhone every first name in these lists is really there
const FONTS = {
  '':          ['The aesthetic’s', ''],
  serif:       ['Book serif',   'var(--serif)'],
  sans:        ['Plain sans',   'var(--sans)'],
  mono:        ['Monospace',    'var(--mono)'],
  garamond:    ['Garamond',     "'EB Garamond', Garamond, 'Apple Garamond', 'Hoefler Text', Georgia, serif"],
  baskerville: ['Baskerville',  "Baskerville, 'Baskerville Old Face', 'Libre Baskerville', Georgia, serif"],
  palatino:    ['Palatino',     "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif"],
  georgia:     ['Georgia',      "Georgia, 'Times New Roman', serif"],
  times:       ['Times',        "'Times New Roman', Times, serif"],
  didot:       ['Didot',        "Didot, 'Bodoni 72', 'Bodoni MT', 'Playfair Display', serif"],
  charter:     ['Charter',      "Charter, 'Bitstream Charter', 'Iowan Old Style', Georgia, serif"],
  iowan:       ['Iowan',        "'Iowan Old Style', Palatino, Georgia, serif"],
  optima:      ['Optima',       "Optima, Candara, 'Segoe UI', sans-serif"],
  gill:        ['Gill Sans',    "'Gill Sans', 'Gill Sans MT', Seravek, Calibri, sans-serif"],
  avenir:      ['Avenir',       "'Avenir Next', Avenir, 'Century Gothic', sans-serif"],
  futura:      ['Futura',       "Futura, 'Century Gothic', 'Trebuchet MS', sans-serif"],
  helvetica:   ['Helvetica',    "'Helvetica Neue', Helvetica, Arial, sans-serif"],
  system:      ['System',       "system-ui, -apple-system, 'Segoe UI', sans-serif"],
  rounded:     ['Rounded',      "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Varela Round', sans-serif"],
  condensed:   ['Condensed',    "'Avenir Next Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif"],
  poster:      ['Poster',       "Impact, 'Haettenschweiler', 'Arial Black', sans-serif"],
  copperplate: ['Copperplate',  "Copperplate, 'Copperplate Gothic Light', 'Engravers MT', serif"],
  typewriter:  ['Typewriter',   "'American Typewriter', 'Courier Prime', 'Courier New', Courier, monospace"],
  courier:     ['Courier',      "Courier, 'Courier Prime', 'Courier New', monospace"],
  menlo:       ['Menlo',        "Menlo, Monaco, Consolas, monospace"],
  hand:        ['Handwriting',  "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive"],
  noteworthy:  ['Noteworthy',   "Noteworthy, 'Bradley Hand', 'Segoe Print', cursive"],
  marker:      ['Marker',       "'Marker Felt', 'Chalkboard SE', 'Comic Sans MS', fantasy"],
  chalk:       ['Chalk',        "Chalkduster, 'Chalkboard SE', 'Comic Sans MS', fantasy"],
  script:      ['Script',       "'Snell Roundhand', 'Apple Chancery', 'Brush Script MT', cursive"],
  chancery:    ['Chancery',     "'Apple Chancery', 'Lucida Calligraphy', 'Monotype Corsiva', cursive"],
  papyrus:     ['Papyrus',      "Papyrus, fantasy"],
};
// inks, as literal colours: an ink does not change when the aesthetic does
const INKS = [
  ['', 'Follow the paper'], ['#1D1A16','Black'], ['#3B342B','Soft black'], ['#5B4A36','Sepia'],
  ['#1F2F4A','Blue-black'], ['#2B4C8C','Royal blue'], ['#8E2B25','Red'], ['#2E5E43','Green'],
  ['#5A3A6E','Violet'], ['#7A6A55','Pencil'], ['#9A7B2F','Gold'], ['#FBF7EE','White'], ['#E9D9A6','Cream'],
];
// papers, likewise; `none` is no paper at all — the words on the board
const PAPERS = [
  ['', 'The stock’s'], ['none','No paper'], ['#FFFDF8','White'], ['#F7F0DC','Cream'],
  ['#F3E7C5','Ivory'], ['#E9DDB8','Manila'], ['#CDB38B','Kraft'], ['#F6E36B','Yellow'],
  ['#F4D6D2','Blush'], ['#D7E8D2','Mint'], ['#D6E3EF','Sky'], ['#E4DDF0','Lilac'],
  ['#3A3A38','Slate'], ['#2A2B2E','Charcoal'], ['#121212','Black'], ['#233A2E','Blackboard'], ['#1E2A44','Navy'],
];
const WEIGHTS = {'':'Regular', 300:'Light', 500:'Medium', 600:'Semibold', 700:'Bold', 900:'Black'};
const CASES = {'':'As written', upper:'Capitals', lower:'Lower case', caps:'Small capitals', title:'Title Case'};
const TRACKS = {'':'Normal', tight:'Tight', open:'Open', wide:'Wide', spaced:'Spaced out'};
const TRACK_EM = {tight:'-0.02em', open:'0.04em', wide:'0.1em', spaced:'0.22em'};
const ALIGNS = {'':'The type’s', left:'Left', centre:'Centered', right:'Right', justify:'Justified'};
const VALIGNS = {'':'Top', middle:'Middle', bottom:'Bottom'};
const LEADS = {'':'Normal', tight:'Tight', snug:'Snug', open:'Open', double:'Double'};
const LEAD_X = {tight:.8, snug:.9, open:1.2, double:1.45};
const SHOWS = {'':'Name and words', title:'Only the name', body:'Only the words'};
const HALOS = {'':'None', soft:'Soft glow', light:'Light glow', dark:'Dark glow', shadow:'Drop shadow', outline:'Outline'};
const LAYERS = {'':'With the others', above:'Over the others'};
const FACEMD = {'':'Plain words', md:'Formatted'};
const RSIZES = ['0.7','0.8','0.9','1','1.15','1.3','1.5','1.75','2','2.5'];
const MEASURES = {'':'Normal', narrow:'Narrow', wide:'Wide', full:'Edge to edge'};
const MEASURE_CH = {'':68, narrow:52, wide:86, full:0};
const MARGIN_X = {'':1, narrow:1.6, wide:.6, full:.3};
const PARAS = {'':'The layout’s', gap:'Space between', indent:'Indented'};
const DROPS = {'':'The layout’s', on:'Drop capital', off:'None'};
// how a long piece is set when it is read — decision 247
const DOCS = {
  '':          'Plain',
  manuscript:  'Manuscript',
  essay:       'Essay',
  magazine:    'Magazine',
  letter:      'Letter',
  screenplay:  'Screenplay',
  poem:        'Poem',
  notebook:    'Notebook',
  typewritten: 'Typewritten',
  broadsheet:  'Broadsheet',
};

// every key this file owns, for "make these the type's" and "put it back"
const WORD_KEYS = ['tfont','hfont','ink','paperc','tweight','titalic','tcase','track','talign','lead',
  'tvalign','shows','halo','layer','nsize','facemd','tsize','rsize','measure','doc','dropcap','paras'];

const set = v => v!=null && v!=='';
/* The layer under the object: your type default, then your desk default. */
function layerOf(o, key){
  const w = S.look && setting('words');
  if(!w || !o) return null;
  if(w[o.kind] && set(w[o.kind][key])) return w[o.kind][key];
  if(w['*'] && set(w['*'][key])) return w['*'][key];
  return null;
}
function wordOf(o, key){
  if(!o) return '';
  if(set(o[key])) return o[key];
  const l = layerOf(o, key); if(l!=null) return l;
  const k = K(o.kind).words;
  return k && set(k[key]) ? k[key] : '';
}
// what the answer is being inherited from, said under the row
function wordFrom(o, key){
  if(!o) return '';
  if(set(o[key])) return 'its own';
  const w = S.look && setting('words');
  if(w && w[o.kind] && set(w[o.kind][key])) return 'every '+K(o.kind).nm.toLowerCase();
  if(w && w['*'] && set(w['*'][key])) return 'every written thing';
  const k = K(o.kind).words;
  return k && set(k[key]) ? 'the type' : '';
}
// who gets a Words door and is set by it: anything written that is not a drawer
const isWritten = o => !!o && has(o,'text') && !isContainer(o);

/* A colour that may be a slot number or a literal. */
const colourOf = v => /^\d+$/.test(String(v)) ? hexOf(+v) : String(v);

/* The ink an object is written in, if anything says. With a paper colour and
   no ink, the ink is *chosen*: whichever of a dark and a light reads better on
   it, by contrast ratio — the same rule the spine's lettering follows, take
   the best rather than the first that passes. */
/* `-` is an answer that means "the plain default": what an object says when
   its type or the desk has a setting and this one should not have it. It
   stops the layers like any answer and then draws as nothing. */
const plainOf = (o,k) => { const v=wordOf(o,k); return v==='-' ? '' : v; };
function inkOf(o){
  const ink = plainOf(o,'ink'), p = plainOf(o,'paperc');
  if(set(ink)) return colourOf(ink);
  if(set(p) && p!=='none') return bestInk(colourOf(p), ['#1D1A16','#FBF7EE']);
  return '';
}

/* The whole answer, as a class list and a style string, for any surface. */
function wordStyle(o){
  if(!isWritten(o)) return {cls:'', vars:''};
  const c=[], v=[];
  const f = plainOf(o,'tfont'), h = plainOf(o,'hfont');
  if(FONTS[f] && f){ c.push('w-font'); v.push(`--tfam:${FONTS[f][1]}`); }
  if(FONTS[h] && h){ c.push('w-hfont'); v.push(`--thfam:${FONTS[h][1]}`); }
  else if(FONTS[f] && f){ v.push(`--thfam:${FONTS[f][1]}`); c.push('w-hfont'); }
  const ink = inkOf(o);
  if(ink){ c.push('w-ink'); v.push(`--ink:${ink};--ink-2:color-mix(in srgb, ${ink} 82%, transparent);--ink-3:color-mix(in srgb, ${ink} 70%, transparent);--tink:${ink}`); }
  const p = plainOf(o,'paperc');
  if(p==='none') c.push('w-clear');
  else if(set(p)){ const hex=colourOf(p); c.push('w-paper');
    v.push(`--tpaper:${hex};--paper-2:${hex}`); }
  const wt = plainOf(o,'tweight'); if(WEIGHTS[wt] && wt){ c.push('w-weight'); v.push(`--tweight:${wt}`); }
  if(String(plainOf(o,'titalic'))==='true' || plainOf(o,'titalic')===true) c.push('w-italic');
  const cs = plainOf(o,'tcase'); if(CASES[cs] && cs) c.push('w-case-'+cs);
  const tr = plainOf(o,'track'); if(TRACK_EM[tr]){ c.push('w-track'); v.push(`--track:${TRACK_EM[tr]}`); }
  const al = plainOf(o,'talign'); if(ALIGNS[al] && al) c.push('w-al-'+al);
  const ld = plainOf(o,'lead'); if(LEAD_X[ld]){ c.push('w-lead'); v.push(`--tlead:${LEAD_X[ld]}`); }
  const va = plainOf(o,'tvalign'); if(VALIGNS[va] && va) c.push('w-v-'+va);
  const sh = plainOf(o,'shows'); if(SHOWS[sh] && sh) c.push('w-only-'+sh);
  const ha = plainOf(o,'halo'); if(HALOS[ha] && ha) c.push('w-halo-'+ha);
  if(plainOf(o,'layer')==='above') c.push('w-above');
  if(plainOf(o,'facemd')==='md') c.push('w-md');
  const ns = +plainOf(o,'nsize'); if(ns>0 && ns!==1){ c.push('w-ns'); v.push(`--tnscale:${ns}`); }
  const rs = +plainOf(o,'rsize'); if(rs>0 && rs!==1){ c.push('w-rs'); v.push(`--rscale:${rs}`); }
  const me = plainOf(o,'measure'); if(MEASURES[me] && me){ c.push('w-me-'+me);
    v.push(`--measure:${MEASURE_CH[me]||999}ch;--margx:${MARGIN_X[me]}`); }
  const dc = plainOf(o,'doc'); if(DOCS[dc] && dc) c.push('doc-'+dc);
  const dp = plainOf(o,'dropcap'); if(dp==='on') c.push('w-drop'); else if(dp==='off') c.push('w-nodrop');
  const pa = plainOf(o,'paras'); if(pa==='gap') c.push('w-gap'); else if(pa==='indent') c.push('w-indent');
  return {cls:c.join(' '), vars:v.join(';')+(v.length?';':'')};
}
// the part of the answer that changes where a page breaks, for the ruler's cache
const wordKey = o => { const w=wordStyle(o); return w.cls+'|'+w.vars; };

/* Saving what one object says as the default for its type, or for every
   written thing, and taking it off again. Only keys the object actually sets
   travel — a type default is what you chose, not a snapshot of every blank. */
function wordsToType(o, scope){
  if(!o) return 0;
  const key = scope==='*' ? '*' : o.kind;
  // a copy written back whole, so a bench's defaults stay the bench's (293)
  const all = Object.assign({}, setting('words') || {});
  const into = Object.assign({}, all[key]);
  let n=0;
  WORD_KEYS.forEach(k=>{ if(set(o[k])){ into[k]=o[k]; n++; } });
  all[key]=into;
  setSetting('words', all);
  return n;
}
function clearTypeWords(kind){
  if(setting('words')){ const all = Object.assign({}, setting('words')); delete all[kind]; setSetting('words', all); }
}
function clearOwnWords(o){
  const was={}; WORD_KEYS.forEach(k=>{ if(o[k]!==undefined){ was[k]=o[k]; delete o[k]; } });
  return was;
}
const typeHasWords = kind => !!(setting('words') && setting('words')[kind] && Object.keys(setting('words')[kind]).length);
const ownWords = o => !!o && WORD_KEYS.some(k=>set(o[k]));

export { FONTS, INKS, PAPERS, WEIGHTS, CASES, TRACKS, ALIGNS, VALIGNS, LEADS, SHOWS, HALOS, LAYERS,
  FACEMD, RSIZES, MEASURES, PARAS, DROPS, DOCS, WORD_KEYS, wordOf, wordFrom, wordStyle, wordKey,
  inkOf, isWritten, wordsToType, clearTypeWords, clearOwnWords, typeHasWords, ownWords, colourOf };
