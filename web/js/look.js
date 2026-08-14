import { S, K, defaultLook } from './model.js';
import { save } from './persist.js';
import { render } from './views.js';

/* Light or dark is the *style's* answer now, not a separate switch: a style
   carries the background it is drawn on, so asking for Walnut on top of
   Victorian was asking for dark shadows under parchment. It is still reported
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

/* Appearance: the style's five, then whatever the user overrode on top. */
function applyLook(){
  const el=document.documentElement, L=S.look||defaultLook();
  const cols=palNow();
  el.dataset.style = L.style||'victorian';
  // the style writes the whole chrome set; a stale override from a style that
  // is no longer showing must not survive the swap
  CHROME_VARS.forEach(v=>el.style.removeProperty(v));
  ['--radius','--radius-d','--serif'].forEach(v=>el.style.removeProperty(v));
  Object.entries(chromeTokens(cols)).forEach(([k,v])=>el.style.setProperty(k,v));
  const st=STYLES[L.style];
  if(st && st.vars) Object.entries(st.vars).forEach(([k,v])=>el.style.setProperty(k,v));

  // and then the hand overrides, which still beat the style — a style is a
  // starting point, not a cage
  L.bg=lookVal('bg'); L.accent=lookVal('accent'); L.line=lookVal('line'); L.board=lookVal('board');
  if(L.bg){
    el.style.setProperty('--paper', L.bg);
    el.style.setProperty('--paper-2', mix(L.bg, 91, '#fff'));
    el.style.setProperty('--paper-3', isDark(L.bg) ? mix(L.bg, 84, '#fff') : mix(L.bg, 92, '#000'));
  }
  el.style.setProperty('--board-alpha', L.boardAlpha==null?1:L.boardAlpha);
  if(L.board){ const [a,b]=String(L.board).split('|');
    el.style.setProperty('--board-1', a); el.style.setProperty('--board-2', b||a); }
  else { el.style.removeProperty('--board-1'); el.style.removeProperty('--board-2'); }
  if(L.accent) el.style.setProperty('--brass', L.accent);
  if(L.line) el.style.setProperty('--line', L.line);
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
   number**. Slot 11 is a regal red on Victorian, a grey on Pseudochromo and a
   deep harbour blue on Aero — the slot is a position in the sixteen and
   nothing more. Switching style repaints every tile in the new style's answer
   for whatever slot it holds; switching back puts every one of them exactly
   where it was, because nothing is converted, only looked up.

   That mapping is deliberately *not* by hue. A style is allowed to be about
   four colours or about eleven, and forcing Aero to own a red so it could
   receive Victorian's reds would have wrecked Aero to preserve a
   correspondence nobody asked for. So each style names its own eleven, and
   there is no universal family list to answer to. See decision 33.

   The first five are the exception, because they *do* have universal jobs:
   the page, the text on it, the lines, the accent and the highlight.
   chromeTokens() derives the whole CSS token set from them. */
// short, because they are labels under a 60px swatch; what each one does is
// the sentence above them in Settings and the comment above chromeTokens()
const ROLES = ['Page','Text','Lines','Accent','Glow'];
const SLOTS = 16;
const OBJ0 = ROLES.length;          // the first slot an object may be painted in
const OBJN = SLOTS - OBJ0;          // eleven

/* A Style is a whole aesthetic at once: sixteen colours and the names it gives
   the eleven, a board, a typeface, and the defaults new drawers are born with.
   See docs/STYLES.md. */
const STYLES = {
  /* Sage and Victorian greens, natural woods, creams, washed royal blues,
     jewel greens, regal reds. Nothing pure white and nothing pure black. */
  victorian: {nm:'Victorian', ds:'An old desk: baize, brass, sage and claret',
    board:'#EFEADA|#DDE5CE', boardAlpha:1,
    defaults:{knob:'round', border:'panel', texture:'none', knobtone:'light'},
    cols:['#E9E1CC','#2A241C','#4A4034','#A9793F','#D9B57C',
          '#6F5137','#4A7C59','#6E7F63','#2E6B52','#4A6382','#5A7A9E',
          '#8E3B38','#9A7B2F','#8A6A3C','#5E4A72','#6E7075'],
    names:['Walnut','Baize','Sage','Emerald','Royal','Delft',
           'Claret','Gilt','Oak','Regal','Pewter'],
    vars:{}},
  /* Near-monochrome and deliberately unexciting: greys, blacks, whites, sharp
     corners. The one style where a drawer is told apart by weight rather than
     by hue, so the eleven are a lightness ramp with barely a tint in them. */
  pseudochromo: {nm:'Pseudochromo', ds:'Near-monochrome, desaturated, sharp',
    board:'#F6F6F7|#EDEEF0', boardAlpha:.6,
    defaults:{knob:'bar', border:'plain', texture:'none', knobtone:'dark'},
    cols:['#FBFBFC','#16181C','#9AA0A8','#4A5058','#8C97A3',
          '#22252A','#2E3238','#3A3F46','#464C54','#535A63','#616872',
          '#42474C','#4C4A46','#3D4650','#4A4550','#70777F'],
    names:['Carbon','Graphite','Iron','Steel','Ash','Nickel',
           'Basalt','Clay','Payne','Mauve','Silver'],
    vars:{'--radius':'2px','--radius-d':'0px',
      '--serif':'-apple-system,BlinkMacSystemFont,"SF Pro Display",Inter,system-ui,sans-serif'}},
  /* Parked: the whole idea is materials that look real, and materials are
     images, not hexes. Left coherent — wood, leather, brass — until there are
     assets to hang on it. */
  skeuo: {nm:'Skeuomorphic', ds:'Wood, leather, and things that look like things',
    board:'#E8DCC4|#D9C9A8', boardAlpha:1,
    defaults:{knob:'ring', border:'heavy', texture:'weave2', knobtone:'dark'},
    cols:['#EFE4CC','#33261A','#8A7350','#8A5A2B','#C89B54',
          '#6B4A2A','#4C6B42','#6B7238','#3B6E63','#42566B','#55708C',
          '#9A4F42','#A87C2E','#8A5A3F','#6D5476','#6E6559'],
    names:['Mahogany','Moss','Olive','Verdigris','Denim','Chambray',
           'Leather','Brass','Tan','Velvet','Slate'],
    vars:{}},
  /* Black and white, drawn in white pencil. The line slot is white, so every
     front is outlined rather than filled — the eleven are near-blacks that
     differ by a whisper of blue or green, which is all a wireframe needs. */
  starry: {nm:'Starry Sidekick', ds:'White pencil on a night sky, hand-drawn',
    board:'#07080C|#0B0D13', boardAlpha:1,
    defaults:{knob:'round', border:'plain', texture:'stars', knobtone:'light'},
    cols:['#07080C','#F4F6F8','#F4F6F8','#6FD3F5','#7DE8B0',
          '#14161C','#1B1E25','#23262E','#0E2733','#123544','#16443F',
          '#1A3B2C','#2B2F38','#191D2A','#101820','#33383F'],
    names:['Ink','Slate night','Charcoal','Deep blue','Harbour','Pine',
           'Fern night','Graphite','Midnight','Pitch','Ash'],
    vars:{'--serif':'"Chalkboard SE","Comic Sans MS","Segoe Print",cursive',
      // drawn, not printed: the outline is the whole front, so it is nearly
      // opaque rather than the 72% every other style derives
      '--line':'rgba(244,246,248,.92)'}},
  /* Teal, ocean, that screen green, steel and grey. Nothing warm: no reds, no
     browns, no golds. Slots that hold a terracotta elsewhere hold a harbour
     blue here, and that is the point of the slots being positions. */
  aero: {nm:'Aero', ds:'Teal gloss and clear skies, straight from 2006',
    board:'#D8F0F4|#C2E6EC', boardAlpha:.85,
    defaults:{knob:'orb', border:'aqua', texture:'sheen', knobtone:'light'},
    cols:['#EAF4F7','#0D3541','#5B8C9B','#18A6C4','#7EE8F5',
          '#1E9AAE','#2FA39A','#3F8F63','#6FA83C','#2B6B99','#4C89C8',
          '#14607A','#5E7A8A','#44515C','#33414D','#8A98A3'],
    names:['Aqua','Lagoon','Meadow','Bliss','Harbour','Sky',
           'Deep sea','Steel','Slate','Storm','Silver'],
    vars:{'--radius':'12px','--radius-d':'10px',
      '--serif':'"Trebuchet MS","Segoe UI",Verdana,sans-serif'}}
};
const styleNow = ()=> STYLES[(S.look&&S.look.style)] || STYLES.victorian;
/* The sixteen showing right now. A slot the user repainted is stored per style
   in `S.look.slots`, so overriding Victorian's rust doesn't follow you to Aero
   — the override belongs to the style, exactly as the colour it replaces does. */
function palNow(){
  const st=styleNow(), own=((S.look&&S.look.slots)||{})[(S.look&&S.look.style)||'victorian'];
  if(!own) return st.cols;
  return st.cols.map((c,i)=> own[i] || c);
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
const styleDefaults = ()=> (S.look&&S.look.styleDefaults)||STYLES.victorian.defaults;
const BACKDROPS = [
  ['#E9E1CC','Parchment'],['#EFE8D6','Vellum'],['#E2D9C0','Manila'],
  ['#DED3B6','Kraft'],['#F1EDE0','Chalk'],['#D9D2BE','Linen']
];

export { themeNow, lookVal, setLookVal, applyLook, applyStyle, styleDefaults,
  randomFront, randomBoard, STYLES, BACKDROPS,
  SLOTS, OBJ0, OBJN, ROLES, slotName, styleNow, palNow, setSlot,
  hexOf, objColour, objSlots, isDark };
