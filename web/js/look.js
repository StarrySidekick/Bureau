import { S, K, defaultLook, PANELS, PANEL_SLOTS, KNOBS, KNOB_SLOTS,
  BINDINGS, BINDING_SLOTS, BORDER_SLOTS, TEXTURE_SLOTS, STOCKS, STOCK_SLOTS,
  slotKey, slotRaw, slotSrc, borderOf, textureOf, panelOf, knobOf, bindingOf, stockOf,
  shelfDepth, bookDepth, shelfTurn, faceCue } from './model.js';
import { save } from './persist.js';
import { render } from './views.js';

/* Light or dark is the *style's* answer now, not a separate switch: a style
   carries the background it is drawn on, so asking for Walnut on top of
   Victoria was asking for dark shadows under parchment. It is still reported
   as paper/walnut, because the theme block owns the shadows and because the
   custom colours below are stored against one or the other. See decision 33. */
const themeNow = ()=> isDark(palNow()[0]) ? 'walnut' : 'paper';
/* Custom colours are stored per theme. They used to be single values written
   inline on <html>, which beat both theme blocks — so a background chosen in
   Paper stayed put when you switched to Walnut and the theme looked broken. */
function lookVal(key){
  const v=(S.look||{})[key];
  if(v && typeof v==='object') return v[themeNow()]||null;
  // a plain string is the old single-value shape: it was chosen under Paper,
  // so it applies there and nowhere else
  return (typeof v==='string' && themeNow()==='paper') ? v : null;
}
function setLookVal(key, val){
  const cur=(S.look||{})[key];
  const obj = (cur && typeof cur==='object') ? cur : {};
  if(cur && typeof cur==='string') obj.paper=cur;   // migrate on first write
  obj[themeNow()] = val || null;
  S.look[key]=obj;
}

/* ---- the five that dress the app -------------------------------------
   Slots 0–4 are not object colours; they are what the app itself is made of.
   Every other token is *derived* from them, so a style supplies five hexes and
   gets a complete set of chrome — which is what stops a new style being forty
   hand-tuned rgba values, and what makes the second, third and fourth tints of
   a colour agree with the first by construction. */
const lum = hex => {
  const h=String(hex).replace('#','');
  const n = h.length===3 ? h.split('').map(c=>parseInt(c+c,16)) : [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
  return (0.2126*n[0] + 0.7152*n[1] + 0.0722*n[2]) / 255;
};
const isDark = hex => lum(hex) < 0.42;
const mix = (a,p,b) => `color-mix(in srgb, ${a} ${p}%, ${b})`;
function chromeTokens(cols){
  const [bg, ink, line, accent, glow] = cols;
  const dark = isDark(bg);
  return {
    '--paper':   bg,
    // toward white on both, because a raised surface is lighter either way;
    // the third goes back toward the page on a light desk and further from it
    // on a dark one, which is what the two theme blocks always did by hand
    '--paper-2': mix(bg, 91, '#fff'),
    '--paper-3': dark ? mix(bg, 84, '#fff') : mix(bg, 92, '#000'),
    '--felt':    dark ? mix(bg, 70, '#fff') : mix(bg, 78, '#000'),
    // the softer inks are the ink walked back toward the page it sits on, so
    // one rule serves a parchment desk and a midnight one
    '--ink':     ink,
    '--ink-2':   mix(ink, 62, bg),
    '--ink-3':   mix(ink, 42, bg),
    '--rule':    mix(line, 40, 'transparent'),
    '--rule-2':  mix(line, 18, 'transparent'),
    '--line':    mix(line, 72, 'transparent'),
    '--brass':   accent,
    '--brass-2': glow,
    '--glow':    glow
  };
}
const CHROME_VARS = Object.keys(chromeTokens(['#000','#fff','#888','#888','#888']));

/* ---- what a tick box looks like ---------------------------------------
   Six shapes, one of them the default. It is a fact about the whole desk
   rather than about a type, so it lives in `look` beside the shadows and the
   grid — a task ticked one way and a checklist line ticked another would be
   two apps sharing a board. The shapes themselves are in chrome.css off
   `[data-checks]`; this is the list the picker draws and the guard that stops
   an unknown value from leaving the desk with no boxes at all. */
const CHECKS = {
  square:  'Rounded square',
  circle:  'Circle',
  hard:    'Sharp square',
  fill:    'Fills in',
  ballot:  'Ballot box',
  dot:     'Dot'
};

/* Appearance: the style's five, then whatever the user overrode on top. */
function applyLook(){
  const el=document.documentElement, L=S.look||defaultLook();
  const cols=palNow();
  el.dataset.style = L.style||'victorian';
  // the style writes the whole chrome set; a stale override from a style that
  // is no longer showing must not survive the swap
  CHROME_VARS.forEach(v=>el.style.removeProperty(v));
  ['--radius','--radius-d','--serif','--wood','--wood-2'].forEach(v=>el.style.removeProperty(v));
  Object.entries(chromeTokens(cols)).forEach(([k,v])=>el.style.setProperty(k,v));
  const st=STYLES[L.style];
  if(st && st.vars) Object.entries(st.vars).forEach(([k,v])=>el.style.setProperty(k,v));
  // how deep the board sits in the carcass — read by the cavity rules, and on
  // the root so it inherits everywhere rather than needing a class to find
  el.style.setProperty('--deskinset', (L.deskinset==null?8:L.deskinset)+'px');
  /* How far each thing that answers a tilt actually moves. One number each,
     because the second axis is always the same fraction of the first — there is
     less room up and down than across. Written on the root so the rules read them
     wherever they are, and so a slider is one property rather than five. */
  const dp = L.tiltdesk==null ? 16 : L.tiltdesk, wp = L.tiltwin==null ? 11 : L.tiltwin;
  el.style.setProperty('--tiltpx', dp+'px');
  el.style.setProperty('--tiltpy', Math.round(dp*0.75)+'px');
  el.style.setProperty('--winpx', wp+'px');
  el.style.setProperty('--winpy', Math.round(wp*0.8)+'px');
  /* And how far the things standing on the shelf stick out of it — one number,
     because the band along a top or bottom edge is a fixed fraction of the
     flank down a side and the two must not be able to disagree. */
  const sd = shelfDepth();
  el.style.setProperty('--deep', sd+'px');
  el.style.setProperty('--deepy', (Math.round(sd*0.64*10)/10)+'px');
  /* A book's is its own number, for the reason model.js gives: a flank and a
     roll-off are two different things and one slider could only ever be right
     for one of them. A spine tile redeclares `--deep`/`--deepy` from these, so
     everything downstream — the head and tail bands, the specular that slides
     across the round back — goes on reading the one property it always read.
     `--bkshade` is the third: how dark the roll-off gets, as a share of what it
     is at eleven, because on a cylinder the *shade* is the depth cue and a
     width alone cannot say it. Worked out here rather than in CSS because calc
     cannot divide a length by a length. */
  const bd = bookDepth();
  el.style.setProperty('--deepbk', bd+'px');
  el.style.setProperty('--deepybk', (Math.round(bd*0.64*10)/10)+'px');
  el.style.setProperty('--bkshade', String(Math.round(Math.min(1.5, bd/11)*100)/100));
  el.style.setProperty('--turn', String(shelfTurn()/100));
  /* And the five drawn on the face. Each is one number, 0-100, and everything
     it needs is derived from it here — a strength, not a set of properties, so
     a cue cannot be bright in its highlight and flat in its shade. The ceilings
     were found on the bench; a slider at 100 is the most of each that still
     reads as furniture rather than as a filter. */
  const cue = k => faceCue(k) / 100;
  const w = cue('facelight');
  el.style.setProperty('--washhi', (w * 0.14).toFixed(3));
  el.style.setProperty('--washlo', (w * 0.28).toFixed(3));
  el.style.setProperty('--sweepamt', (cue('facesweep') * 0.17).toFixed(3));
  /* An arris is a fixed thickness at any size, like every moulding in the app,
     so the slider is the *light* on it and never the width. */
  const a = cue('arris');
  el.style.setProperty('--arw', '2px');
  el.style.setProperty('--arlit', (a * 0.24).toFixed(3));
  el.style.setProperty('--arshade', (a * 0.28).toFixed(3));
  el.style.setProperty('--areye', (a * 0.20).toFixed(3));
  const r = cue('recess');
  el.style.setProperty('--recthrow', (r * 10).toFixed(1) + 'px');
  el.style.setProperty('--recblur', '18px');
  el.style.setProperty('--recamt', (r * 0.36).toFixed(3));
  const kn = cue('knobturn');
  el.style.setProperty('--knobturn', (kn * 5).toFixed(1) + 'px');
  el.style.setProperty('--knobglow', (kn * 0.42).toFixed(3));
  el.style.setProperty('--fieldshift', (cue('fieldshift') * 2.4).toFixed(2) + 'px');

  /* And then the hand overrides, which still beat the aesthetic — one is a
     starting point, not a cage.

     **Read into locals, never back into `S.look`.** These are stored per theme
     as `{paper, walnut}` and `lookVal()` resolves one of them; writing the
     resolved string back collapses the object, and the *string* branch of
     `lookVal()` only answers for paper — so the next call returns null and the
     value is dropped. applyLook() runs twice on every style change (once
     itself, once from the render that follows), so the collapse always
     happened, and it cost every **dark** aesthetic its board: Starful Gothic
     has been falling back to the CSS default since the day it was written,
     because no one had put two dark ones side by side to notice. See
     decision 91. */
  const bg=lookVal('bg'), accent=lookVal('accent'), line=lookVal('line'), board=lookVal('board');
  if(bg){
    el.style.setProperty('--paper', bg);
    el.style.setProperty('--paper-2', mix(bg, 91, '#fff'));
    el.style.setProperty('--paper-3', isDark(bg) ? mix(bg, 84, '#fff') : mix(bg, 92, '#000'));
  }
  el.style.setProperty('--board-alpha', L.boardAlpha==null?1:L.boardAlpha);
  if(board){ const [a,b]=String(board).split('|');
    el.style.setProperty('--board-1', a); el.style.setProperty('--board-2', b||a); }
  else { el.style.removeProperty('--board-1'); el.style.removeProperty('--board-2'); }
  if(accent) el.style.setProperty('--brass', accent);
  if(line) el.style.setProperty('--line', line);
  /* Shadows off. Every tile in the app casts one onto whatever is under it,
     which is what makes the board read as things *on* a surface — and it is
     also the single biggest difference between "furniture" and "flat", so it
     is worth being able to see the desk without it.

     A **zero** shadow rather than `none`: half the border slots write
     `box-shadow: inset …, var(--shadow)`, and `none` is only legal as the sole
     value of the property — it would take the inset rings down with it. */
  if(L.shadows===false){
    el.style.setProperty('--shadow', '0 0 0 rgba(0,0,0,0)');
    el.style.setProperty('--shadow-lg', '0 0 0 rgba(0,0,0,0)');
  } else { el.style.removeProperty('--shadow'); el.style.removeProperty('--shadow-lg'); }
  /* What a tick box looks like, everywhere one is drawn — a tile, a row, a
     line on a checklist front. One attribute on the root and the stylesheet
     does the rest, the same trick `data-style` plays: the box is one shape in
     six places and it would be six rules to change otherwise. */
  /* A tick box is a fact about the desk and not about a type (decision 83),
     and it stays one — but an aesthetic gets to say what shape it starts as,
     the way it says what paper is made of. Unset follows the aesthetic and
     re-dresses on a switch; picked one stays picked, everywhere. See
     decision 100. */
  el.dataset.checks = CHECKS[L.check] ? L.check : (CHECKS[styleNow().check] ? styleNow().check : 'square');
  // the theme block still owns the shadows, and which one is showing is the
  // style's background rather than a switch of its own
  document.documentElement.dataset.theme = themeNow();
}

/* A board for a new drawer: one hue, two lightnesses, low saturation. Picking
   from a hue wheel rather than at random keeps it mild — nothing neon, and the
   two squares always belong to each other. */
// A slot, not a hex: a drawer made today has to follow the style tomorrow.
function randomFront(){
  return OBJ0 + Math.floor(Math.random()*OBJN);
}
/* ---- a new drawer is a new piece of furniture --------------------------
   Every drawer used to be born wearing the aesthetic's stated defaults, which
   made a desk a row of identical fronts in eleven colours. Real furniture is
   not like that: the drawers in one room came from different decades and
   different hands. So a new container picks its own knob, edge, grain and
   panelling as well as its colour.

   **Randomly, but from this aesthetic's vocabulary, and weighted to its own
   answer.** The stated default goes into the bag several times over, so a
   Victoria desk still reads as Victoria and a Golf 97 desk still reads as
   1997 — what varies is the individual piece, not the room. Uniform picks
   across every option would make every aesthetic look like the same jumble,
   which is the opposite of what an aesthetic is for.

   `none` is not in any bag: it is a deliberate "take the edge off this one"
   and not a thing to be handed at random. See decision 92. */
const pickOf = a => a[Math.floor(Math.random()*a.length)];
/* Three of the aesthetic's own to one of anything else, per property. The bag
   is the *family's* positions, read off the one table, so a family that gains
   a position is offered it here without being told. `none` is dropped from
   every bag: it is a deliberate "take the edge off this one" and not a thing
   to be handed out at random. */
/* A family says which of its positions are not handed out. `none` never is,
   in any family: it is a deliberate "take the edge off this one" rather than a
   thing to be given at random. **`gilt` is not either**, and for the same
   reason from the other direction — it is a statement, and a frame nobody
   chose is the thing decision 94 took off the magic drawer in the first place.
   That one came back the moment the bag was rebuilt from the family table
   rather than from the old hand-written list; the smoke test caught it as a
   magic drawer that had grown a frame again. */
const bagOf = fam => FAMS[fam].slots.filter(k=>!(FAMS[fam].never||['none']).includes(k));
const leaning = (mine, fam) => pickOf([mine, mine, mine, ...bagOf(fam)]);
function randomLook(){
  const sd = styleDefaults();
  return {
    knob:     leaning(sd.knob     || 'round',    'kn'),
    border:   leaning(sd.border   || 'panel',    'bd'),
    texture:  leaning(sd.texture  || 'none',     'tx'),
    panel:    leaning(sd.panel    || 'cockbead', 'pn'),
    // a knob turned out of the front's own wood is the default and stays the
    // commonest; lighter and darker are the occasional piece
    knobtone: pickOf([sd.knobtone, sd.knobtone, sd.knobtone, null, 'light', 'dark'])
  };
}
function randomBoard(){
  const hue = Math.floor(Math.random()*360);
  const sat = 12 + Math.floor(Math.random()*10);          // 12–21%, never garish
  // a board is drawn on the desk it sits on: a white checkerboard inside a
  // midnight style is a hole in the page
  const dark = isDark(palNow()[0]);
  const lightA = dark ? 11 + Math.floor(Math.random()*4) : 88 + Math.floor(Math.random()*4);
  const lightB = lightA + (dark ? 1 : -1)*(4 + Math.floor(Math.random()*4));
  const hsl=(l)=>`hsl(${hue} ${sat}% ${l}%)`;
  return `${hsl(lightA)}|${hsl(lightB)}`;
}

/* ============================================================
   Sixteen slots. A slot is a position, not a colour
   ============================================================
   A palette used to be a separate choice from a style, and it only decided
   what *new* objects were painted — the colour itself was stored as a hex, so
   a desk built under one palette kept those hexes forever and changing the
   look changed nothing you could see.

   A palette belongs to a style now, and a colour is stored as the **slot
   number**. Slot 11 is a regal red on Victoria and a
   deep harbour blue on Aeros — the slot is a position in the sixteen and
   nothing more. Switching style repaints every tile in the new style's answer
   for whatever slot it holds; switching back puts every one of them exactly
   where it was, because nothing is converted, only looked up.

   That mapping is deliberately *not* by hue. A style is allowed to be about
   four colours or about eleven, and forcing Aeros to own a red so it could
   receive Victoria's reds would have wrecked Aeros to preserve a
   correspondence nobody asked for. So each style names its own eleven, and
   there is no universal family list to answer to. See decision 33.

   The first five are the exception, because they *do* have universal jobs:
   the page, the text on it, the lines, the accent and the highlight.
   chromeTokens() derives the whole CSS token set from them. */
// short, because they are labels under a 60px swatch; what each one does is
// the sentence above them in Settings and the comment above chromeTokens()
const ROLES = ['Page','Text','Lines','Accent','Glow'];
/* ---- five families of slot, one table ---------------------------------
   An edge is a slot as much as a colour is, and so are a panelling, a knob, a
   grain and a binding. Every one works the same way: the *position* is stored
   and stable, the aesthetic says what the position is made of, and the class
   on the tile is the position — `bd-panel`, `pn-fielded`, `tx-weave`.

   The five were three separate near-identical pairs of functions and two
   hard-coded lists in panels.js. One table instead, because everything below
   this line — the pickers, the pins, the scope classes — wants to do the same
   thing to all five and had no way to say "all five".

   `prop`  what the object stores it under
   `slots` the positions, in order; the first is the fallback where it matters
   `words` the fallback names, which are Victoria's, because Victoria was the
           only aesthetic when most of this was written
   `says`  the key an aesthetic names its own under
   `read`  what the object is actually wearing, per object then per type */
const FAMS = {
  /* Seven edges. `gilt` was for a long time not a slot at all: it was the
     ruled leaf frame a *magic* drawer wore automatically, which made it the
     one ornament nobody could choose and nobody could decline. It is an edge
     like the others now — decision 94. `plain` and `none` stay last, because
     they mean the same thing in every aesthetic. */
  bd: {prop:'border',  slots:BORDER_SLOTS,  says:'borders',
       words:['Panelled','Heavy panel','Bar','Beaded','Gilt frame','Plain','None'],
       never:['gilt','none'], read:borderOf},
  /* Five workings of a front. The object stores position 2 and gets Victoria's
     fielded panel here, Carca's ashlar block there and Golf 97's group box in
     1997 — so a switch re-dresses every front you own while the choice you
     made about each survives. See decision 93. */
  pn: {prop:'panel',   slots:PANEL_SLOTS,   says:'panels',
       words:PANEL_SLOTS.map(k=>PANELS[k]), read:panelOf},
  kn: {prop:'knob',    slots:KNOB_SLOTS,    says:'knobs',
       words:KNOB_SLOTS.map(k=>KNOBS[k]),   read:knobOf},
  /* Six grains. A texture is what a *surface* is made of, and stone, glass,
     cathedral paper and a 1997 dialog do not share one — so the eleven global
     names became six positions each aesthetic answers for. Migration 24. */
  tx: {prop:'texture', slots:TEXTURE_SLOTS, says:'textures',
       words:['None','Grain','Weave','Ruled','Speckle','Damask'], read:textureOf},
  bn: {prop:'binding', slots:BINDING_SLOTS, says:'bindings',
       words:BINDING_SLOTS.map(k=>BINDINGS[k]), read:bindingOf},
  /* The object's half of a panelling: what the *sheet* is, as against what is
     printed on it. Five positions, and 0 is the flat paper the app has always
     drawn. See decision 99. */
  st: {prop:'stock',   slots:STOCK_SLOTS,   says:'stocks',
       words:STOCK_SLOTS.map(k=>STOCKS[k]), read:stockNow}
};
/* A drawer is *given* its look at birth — a roll from this aesthetic's
   vocabulary, written onto the object, because furniture in one room came from
   different decades and different hands (decision 92). A sheet of paper is not
   like that: it comes off one pad. So a stock is never rolled and never
   written; an object with nothing said about it wears whatever *this*
   aesthetic makes paper out of, and re-dresses the moment you switch. That
   asymmetry is the difference between wood and paper, and it is why `stock`
   is the one family whose fallback is the aesthetic's rather than the
   vocabulary's. See decision 99. */
function stockNow(o){
  if(slotKey(slotRaw(o,'stock'))) return stockOf(o);
  const said = (styleNow().defaults||{}).stock;
  return STOCKS[said] ? said : 'plain';
}
/* What one aesthetic calls a family's positions. Falls back word by word, so
   an aesthetic that names four of five still gets a name for the fifth. */
function famNames(fam, styleK){
  const f=FAMS[fam], st=(styleK && STYLES[styleK]) || styleNow();
  const said=st[f.says]||[];
  return f.slots.map((k,i)=> said[i] || f.words[i] || k);
}
/* The picker's list for a family, in whichever aesthetic — `[value, name]`. */
const famSlots = (fam, styleK)=> FAMS[fam].slots.map((k,i)=>[k, famNames(fam,styleK)[i]]);
const borderSlots = ()=> famSlots('bd');
const panelSlots  = ()=> famSlots('pn');
const knobSlots   = ()=> famSlots('kn');
const textureSlots= ()=> famSlots('tx');
const bindingSlots= ()=> famSlots('bn');
const stockSlots  = ()=> famSlots('st');

/* ---- who dresses this slot --------------------------------------------
   A stored value may be pinned to the aesthetic it was borrowed from
   (`golf97/fielded`, see model.js). Everything that draws asks here rather
   than assuming the desk's aesthetic, and writes the answer onto the element
   as `<fam>sty-<aesthetic>` — which is why the per-aesthetic tile rules are
   keyed on those classes and not on `html[data-style]`. Four families can
   then be dressed by four different aesthetics on one tile, which is exactly
   what a pin is for and what an `html[data-style]` selector cannot express.

   The chrome — panels, buttons, the bar, the typeface, the wood — stays on
   `html[data-style]`, because none of it is a slot and nothing about it can
   be pinned. See decision 98. */
const styleKey = ()=> STYLES[(S.look&&S.look.style)] ? S.look.style : 'victorian';
const styleFor = pin => (pin && STYLES[pin]) ? pin : styleKey();
// the class pair for one family on one object: `pn-fielded pnsty-carca`
const dress = (o, fam)=>
  `${fam}-${FAMS[fam].read(o)} ${fam}sty-${styleFor(slotSrc(o, FAMS[fam].prop))}`;
// …and for something that is furniture rather than an object: the desk's rail
const dressAs = (fam, key)=> `${fam}-${slotKey(key)} ${fam}sty-${styleKey()}`;

/* ---- the way out of your own aesthetic --------------------------------
   You pick a knob from the five your aesthetic has, and they re-dress when you
   switch: that is the whole system and it is what the picker shows. But
   sometimes you want *that* one — Golf 97's group box on a Victorian desk —
   and there was no way to say so. So under each of these rows is a second
   list holding every aesthetic's answers, grouped, writing a pinned value.

   It is deliberately the second list and not the first: seeing thirty-five
   knobs when you have five is the wall of chips decision 66 took out. */
const famAll = fam => Object.keys(STYLES).filter(k=>k!==styleKey())
  .map(k=>[STYLES[k].nm, famSlots(fam,k).map(([v,n])=>[`${k}/${v}`, n])]);
const SLOTS = 16;
const OBJ0 = ROLES.length;          // the first slot an object may be painted in
const OBJN = SLOTS - OBJ0;          // eleven

/* A Style is a whole aesthetic at once: sixteen colours and the names it gives
   the eleven, a board, a typeface, and the defaults new drawers are born with.
   See docs/STYLES.md. */
const STYLES = {
  /* Sage and Victorian greens, natural woods, creams, washed royal blues,
     jewel greens, regal reds. Nothing pure white and nothing pure black. */
  victorian: {nm:'Victoria', ds:'An old desk: baize, brass, sage and claret',
    board:'#EFEADA|#DDE5CE', boardAlpha:1,
    borders:['Panelled','Heavy panel','Bar','Beaded','Gilt frame','Plain','None'],
    panels:['Flat front','Cockbead','Raised panel','Reeded','Ogee panel'],
    knobs:['Round','Diamond','Bar','Ring','Square'],
    textures:['None','Grain','Weave','Ruled','Speckle','Damask'],
    stocks:['Plain','Laid','Wove','Card','Aged'],
    bindings:['Plain cloth','Gilt rules','Raised bands','Tooled and gilt','Paper label'],
    check:'square',
    defaults:{knob:'round', border:'panel', texture:'none', knobtone:'light', panel:'cockbead', stock:'laid'},
    cols:['#E9E1CC','#2A241C','#4A4034','#A9793F','#D9B57C',
          '#6F5137','#4A7C59','#6E7F63','#2E6B52','#4A6382','#5A7A9E',
          '#8E3B38','#9A7B2F','#8A6A3C','#5E4A72','#6E7075'],
    /* The same desk after dark: the parchment becomes the walnut it was always
       sitting on, and the eleven deepen rather than change. A slot is a
       position, so nothing is converted — slot 11 is Victoria's claret in
       both, one lit by a window and one by a lamp. */
    dark:['#241C14','#EDE3CE','#6B5942','#C89B54','#E4C68A',
          '#5A4130','#3D6B4A','#5A6B52','#265843','#3E5470','#4A6784',
          '#78302E','#836828','#755A33','#4F3E60','#5C5E63'],
    names:['Walnut','Baize','Sage','Emerald','Royal','Delft',
           'Claret','Gilt','Oak','Regal','Pewter'],
    spray:'stars',
    vars:{'--wood':'#3A2C1E'}},
  /* Carcassonne: a walled French city in tile-sized pieces — heraldic woad,
     limestone, meadow — with the war long over and its machines turned to
     tinkering. Flowers and overgrowth on the ramparts, brass and copper in the
     works. The board is a *checker* already, which is the one aesthetic where
     that reads as exactly what it is: a table of laid tiles. */
  carca: {nm:'Carca', ds:'A walled city in tiles, its war machines turned to tinkering',
    board:'#EAE5D4|#DBDCC6', boardAlpha:1,
    borders:['Ashlar','Rampart','Course','Vine','Inlay','Plain','None'],
    panels:['Dressed flat','Chamfer','Ashlar block','Fluting','Tracery'],
    knobs:['Boss','Faceted','Bar handle','Gear','Stud'],
    textures:['None','Ashlar','Basketweave','Coursing','Aggregate','Millefleur'],
    stocks:['Plain','Parchment','Linen','Slate','Weathered'],
    bindings:['Vellum','Ruled bands','Cords','Blind-tooled','Pasted label'],
    check:'hard',
    defaults:{knob:'ring', border:'panel', texture:'ruled', knobtone:'light', panel:'fielded', stock:'laid'},
    cols:['#E8E4D6','#22303F','#7E8B96','#A87A3C','#D4B872',
          '#77808A','#2E5B84','#5D82AE','#5E8B4C','#3C6B49','#7A6E9E',
          '#A8555C','#A6803C','#9A6440','#4E8478','#8C8574'],
    names:['Rampart','Woad','Cornflower','Meadow','Ivy','Wisteria',
           'Rose','Brass','Copper','Verdigris','Tufa'],
    // an old-style face with a French cut to it, and corners squarer than
    // Victoria's because this is masonry rather than cabinetwork
    spray:'spirals',
    vars:{'--radius':'6px','--radius-d':'2px','--wood':'#3E4A55',
      '--serif':'"Hoefler Text","Baskerville","Palatino Linotype",Palatino,Georgia,serif'}},
  /* A floating island under a sky that drops its stars as crystal. Violets and
     cosmic blues rather than black space, and elven gold on top of them —
     rich, not merely dark. The astronomers keep the tower and the information;
     everyone else mines what falls. */
  stelaine: {nm:'Stelaine', ds:'Crystal stars falling on a floating island, and who owns the sky',
    board:'#171233|#1D1740', boardAlpha:1,
    borders:['Filigree','Astral rule','Horizon','Facet','Sigil frame','Plain','None'],
    panels:['Unworked','Crystal rim','Floating slab','Ribbing','Astral inlay'],
    knobs:['Orb','Shard','Bar','Halo','Crystal'],
    textures:['None','Stardust','Nebula','Ley lines','Crystal dust','Constellation'],
    stocks:['Plain','Starcloth','Silk','Shard','Faded'],
    bindings:['Starcloth','Astral rules','Ribs','Sigil panel','Vellum label'],
    check:'circle',
    defaults:{knob:'round', border:'panel', texture:'speckle', knobtone:'light', panel:'ogee', stock:'laid'},
    cols:['#120E20','#EDE7FA','#6E5F96','#9A6BD8','#E3C98A',
          '#4C3A78','#6E4C9E','#2E2A55','#3A5A9E','#2F6E86','#3E8AA0',
          '#9A3F86','#9E4A3A','#8A6D2E','#3F7A5E','#5A5470'],
    names:['Nebula','Amethyst','Void','Astral','Aether','Starcrystal',
           'Arcane','Ember','Eldergold','Nether','Slate'],
    // a didone, because elven is high-contrast and thin-stroked rather than
    // blackletter — and the radii are generous, since nothing here was cut
    spray:'twinkles',
    vars:{'--radius':'11px','--radius-d':'4px','--wood':'#241C3E',
      '--serif':'"Didot","Bodoni 72","Playfair Display",Georgia,serif'}},
  /* The underside of a landmass that will not hold still: Sicilian baroque
     seen from below, in volcanic stone and majolica, with gold on the
     ornament and vines through everything. The motif is the **spiral** — the
     volute of a scroll, and the turn of the rock itself. */
  girando: {nm:'Girando', ds:'The turning underside of a Sicilian rock, in baroque and vine',
    board:'#262119|#2E2820', boardAlpha:1,
    borders:['Volute','Cartouche','Cornice','Vine','Gilt cartouche','Plain','None'],
    panels:['Uncarved','Bead','Cartouche','Rustication','Volute panel'],
    knobs:['Volute','Lozenge','Bar','Ring','Block'],
    textures:['None','Tufa','Cane','Rustication','Volcanic','Majolica'],
    stocks:['Plain','Fresco','Canvas','Terracotta','Sun-bleached'],
    bindings:['Buckram','Gilt fillets','Raised cords','Volute panel','Pasted title'],
    check:'circle',
    defaults:{knob:'round', border:'panel', texture:'speckle', knobtone:'dark', panel:'ogee', stock:'laid'},
    cols:['#211E1A','#EDE4D2','#7A6E5E','#B98846','#E0C782',
          '#3A342E','#8A7B63','#2F6E92','#3F7A5F','#5B7A46','#A65E3C',
          '#8A3A38','#A8823A','#3B4E86','#5E3D5C','#6B655C'],
    names:['Basalt','Tufa','Majolica','Verde','Acanthus','Terracotta',
           'Sangue','Ochre','Lapis','Aubergine','Cenere'],
    // Bodoni is Italian and it is the face baroque plates were re-set in;
    // the radii are the roundest here, because a volute has no corners
    spray:'spirals',
    vars:{'--radius':'14px','--radius-d':'5px','--wood':'#2C2620',
      '--serif':'"Bodoni 72","Didot","Baskerville",Georgia,serif'}},
  /* 1997, on a television: washed fairway greens, the beige of golf slacks,
     maroon polo, distressed leather, and the grey and teal of the desktop it
     was all running beside. The board's checker is the mown fairway, and the
     border slots are the outset and sunken bevels of that decade's chrome —
     which the panelling already knows how to light, from the upper left. */
  golf97: {nm:'Golf 97', ds:'Late-nineties fairway, distressed leather and desktop grey',
    board:'#CFD8B8|#C0CBA6', boardAlpha:1,
    borders:['Outset','Deep outset','Sunken','Groove','Marquee','Plain','None'],
    panels:['Flat','Plastic edge','Group box','Scanlines','CRT bezel'],
    knobs:['Button','Tee','Slider','Dial','Keycap'],
    textures:['None','Dither','Weave','Scanlines','Static','Argyle'],
    stocks:['Plain','Window','Dialog','Readout','Printout'],
    bindings:['Jewel case','Spine label','Ribbed case','Boxed art','Sticker'],
    check:'ballot',
    defaults:{knob:'square', border:'panel', texture:'fine', knobtone:'light', panel:'plain', stock:'wove'},
    cols:['#D6D3C4','#2A2A24','#8A8878','#12736E','#C8A63C',
          '#6E8F5A','#4F6B44','#A79A6E','#A89663','#8A3F42','#4A6B8A',
          '#2C7A76','#A88A32','#7A5334','#6E4A66','#8C8C84'],
    names:['Fairway','Rough','Khaki','Sand','Polo','Cadet',
           'Teal','Mustard','Leather','Plum','Silver'],
    // Tahoma and Verdana are the faces this actually happened in, and the
    // corners are square because nothing in 1997 had a radius
    spray:'squares',
    vars:{'--radius':'0px','--radius-d':'0px','--wood':'#8E8F80',
      '--serif':'Tahoma,Verdana,Geneva,"MS Sans Serif",sans-serif'}},
  /* Black and white, drawn in white pencil. The line slot is white, so every
     front is outlined rather than filled — the eleven are near-blacks that
     differ by a whisper of blue or green, which is all a wireframe needs. */
  starry: {nm:'Starful Gothic', ds:'White pencil on a night sky, hand-drawn',
    board:'#07080C|#0B0D13', boardAlpha:1,
    borders:['Ruled','Double rule','Underline','Sketched','Chalk frame','Plain','None'],
    panels:['Unlined','Pencil rim','Sketched panel','Hatching','Doodle frame'],
    knobs:['Circle','Diamond','Bar','Ring','Square'],
    textures:['None','Tooth','Crosshatch','Ruled','Stipple','Stars'],
    stocks:['Plain','Ruled leaf','Tracing','Board','Foxed'],
    bindings:['Cloth','Drawn rules','Drawn bands','Drawn panel','Pasted label'],
    check:'hard',
    defaults:{knob:'round', border:'plain', texture:'fine', knobtone:'light', panel:'plain', stock:'plain'},
    cols:['#07080C','#F4F6F8','#F4F6F8','#6FD3F5','#7DE8B0',
          '#14161C','#1B1E25','#23262E','#0E2733','#123544','#16443F',
          '#1A3B2C','#2B2F38','#191D2A','#101820','#33383F'],
    names:['Ink','Slate night','Charcoal','Deep blue','Harbour','Pine',
           'Fern night','Graphite','Midnight','Pitch','Ash'],
    // Illustration-coded but grown up. Comic Sans reads as a joke about
    // hand-drawn rather than the thing itself; Optima and Gill Sans are what
    // hand-lettered book jackets and map legends were actually set in.
    spray:'stars',
    vars:{'--wood':'#0C0E14',
      '--serif':'"Optima","Gill Sans","Gill Sans MT","Avenir Next","Trebuchet MS",sans-serif',
      // drawn, not printed: the outline is the whole front, so it is nearly
      // opaque rather than the 72% every other style derives
      '--line':'rgba(244,246,248,.92)'}},
  /* Teal, ocean, that screen green, steel and grey. Nothing warm: no reds, no
     browns, no golds. Slots that hold a terracotta elsewhere hold a harbour
     blue here, and that is the point of the slots being positions. */
  aero: {nm:'Aeros', ds:'Teal gloss and clear skies, straight from 2006',
    board:'#D8F0F4|#C2E6EC', boardAlpha:.85,
    borders:['Bevel','Deep bevel','Sill','Glass','Chrome frame','Plain','None'],
    panels:['Clear','Glass edge','Glass panel','Ribbed glass','Aqua inlay'],
    knobs:['Orb','Gem','Bar','Halo','Chiclet'],
    textures:['None','Frost','Brushed','Ripple','Bubbles','Sheen'],
    stocks:['Plain','Frosted','Satin','Acrylic','Sunlit'],
    bindings:['Frosted case','Chrome rules','Ribs','Etched panel','Label'],
    check:'fill',
    defaults:{knob:'round', border:'gloss', texture:'fine', knobtone:'light', panel:'plain', stock:'laid'},
    cols:['#EAF4F7','#0D3541','#5B8C9B','#18A6C4','#7EE8F5',
          '#1E9AAE','#2FA39A','#3F8F63','#6FA83C','#2B6B99','#4C89C8',
          '#14607A','#5E7A8A','#44515C','#33414D','#8A98A3'],
    names:['Aqua','Lagoon','Meadow','Bliss','Harbour','Sky',
           'Deep sea','Steel','Slate','Storm','Silver'],
    spray:'twinkles',
    vars:{'--radius':'12px','--radius-d':'10px','--wood':'#25505E',
      // Segoe UI is the face Aero actually shipped with; Lucida Grande is what
      // the other 2006 desktop was set in, and it is the better fallback here
      // than Trebuchet, which belongs to the version before this one.
      '--serif':'"Segoe UI","Lucida Grande","Lucida Sans Unicode",Tahoma,sans-serif'}}
};
const styleNow = ()=> STYLES[(S.look&&S.look.style)] || STYLES.victorian;

/* ---- light and dark ---------------------------------------------------
   There is still no theme switch in the old sense: light or dark is a fact
   about the style you are in, and a style that has only one answer keeps it.
   What an aesthetic *may* now carry is a second set of sixteen — Victoria's walnut
   — and which of the two is showing is `S.look.dark`:

     auto    whatever the phone is set to, which is the answer you want
     light   this style's daylight sixteen
     dark    its after-dark sixteen, if it has one

   `auto` is the default, and it is why this is a media query rather than a
   button: the desk should already be dark when you pick the phone up at night.
   A style with no dark set simply ignores all three. */
const DARKMODES = {auto:'Follow this device', light:'Always light', dark:'Always dark'};
const systemDark = ()=> window.matchMedia('(prefers-color-scheme: dark)').matches;
const darkMode = ()=> (S.look&&S.look.dark) || 'auto';
const wantsDark = ()=> { const m=darkMode(); return m==='dark' || (m==='auto' && systemDark()); };
// whether the choice means anything here — Starry is night and nothing else
const hasDark = ()=> !!styleNow().dark;
const darkNow = ()=> hasDark() && wantsDark();

/* The sixteen showing right now. A slot the user repainted is stored per style
   in `S.look.slots`, so overriding Victoria's rust doesn't follow you to Aeros
   — the override belongs to the style, exactly as the colour it replaces does.
   The override is per style and not per light-or-dark: a colour you insisted on
   is a colour you insisted on. */
function palNow(){
  const st=styleNow(), own=((S.look&&S.look.slots)||{})[(S.look&&S.look.style)||'victorian'];
  const base = darkNow() ? st.dark : st.cols;
  if(!own) return base;
  return base.map((c,i)=> own[i] || c);
}
function setSlot(i, hex){
  const key=(S.look&&S.look.style)||'victorian';
  S.look.slots = S.look.slots || {};
  const own = S.look.slots[key] = S.look.slots[key] || {};
  if(hex) own[i]=hex; else delete own[i];
}
/* A stored colour is a slot number or a literal hex. Numbers travel between
   styles; literals are somebody insisting, and stay put. */
function hexOf(c){
  if(typeof c==='number' && c>=0 && c<SLOTS) return palNow()[c];
  if(typeof c==='string' && c) return c;
  return palNow()[OBJ0];
}
// What an object is actually drawn in: its own colour, else its type's.
const objColour = o => hexOf(o && o.c!=null ? o.c : K(o&&o.kind).c);
/* What this style calls slot `i`. The five have universal jobs and universal
   names; the eleven are the style's own to name, because they are not the same
   colour from one style to the next and pretending otherwise would put "Rust"
   under a blue swatch. */
const slotName = i => i<OBJ0 ? ROLES[i] : ((styleNow().names||[])[i-OBJ0] || ('Colour '+(i-OBJ0+1)));
// The eleven an object may wear, as [slot, name] — the five are the app's.
const objSlots = ()=> Array.from({length:OBJN}, (_,i)=>[OBJ0+i, slotName(OBJ0+i)]);

function applyStyle(key){
  const st=STYLES[key]; if(!st) return;
  S.look.style=key;
  setLookVal('board', st.board); S.look.boardAlpha=st.boardAlpha;
  S.look.styleDefaults=st.defaults;
  applyLook(); save(); render();
}
/* Read live rather than from `S.look.styleDefaults`. That cache was only ever
   written by applyStyle(), so an aesthetic that *gained* a default — as all
   seven just did with `stock` — went unheard on any desk that had not switched
   aesthetic since. The cache is still written, because a backup carries it and
   migration 24 reads it, but nothing reads it to decide anything. */
const styleDefaults = ()=> styleNow().defaults || STYLES.victorian.defaults;
const BACKDROPS = [
  ['#E9E1CC','Parchment'],['#EFE8D6','Vellum'],['#E2D9C0','Manila'],
  ['#DED3B6','Kraft'],['#F1EDE0','Chalk'],['#D9D2BE','Linen']
];

export { themeNow, lookVal, setLookVal, applyLook, applyStyle, styleDefaults,
  DARKMODES, darkMode, hasDark, darkNow, systemDark,
  randomFront, randomBoard, randomLook, STYLES, BACKDROPS,
  SLOTS, OBJ0, OBJN, ROLES, slotName, styleNow, palNow, setSlot,
  BORDER_SLOTS, borderSlots, panelSlots, knobSlots, textureSlots, bindingSlots, stockSlots, stockNow,
  FAMS, famSlots, famNames, famAll, styleKey, styleFor, dress, dressAs, CHECKS,
  hexOf, objColour, objSlots, isDark };
