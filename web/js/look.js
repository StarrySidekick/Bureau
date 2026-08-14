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
  return OBJ0 + Math.floor(Math.random()*FAMILIES.length);
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
   Sixteen slots, and a slot means the same thing in every style
   ============================================================
   A palette used to be a separate choice from a style, and it only decided
   what *new* objects were painted — the colour itself was stored as a hex, so
   a desk built under one palette kept those hexes forever and changing the
   look changed nothing you could see.

   A palette belongs to a style now, and a colour is stored as the **slot
   number**, not the hex. Slot 9 is Slate in every style, so switching from
   Victorian to Aero repaints every slate drawer in Aero's slate, and switching
   back puts every one of them exactly where it was. Nothing is lost in the
   round trip because nothing was ever converted — only looked up.

   The first five are the app's own — background, ink, line, accent, highlight
   — and chromeTokens() derives the whole CSS token set from them. The other
   eleven are colour *families*, in the same order in every style, and they are
   what drawers and objects are painted in. See decision 33. */
// short, because they are labels under a 60px swatch; what each one does is
// the sentence above them in Settings and the comment above chromeTokens()
const ROLES = ['Page','Text','Lines','Accent','Glow'];
const FAMILIES = ['Umber','Fern','Olive','Teal','Slate','Steel','Rust','Ochre','Clay','Plum','Stone'];
const SLOTNAMES = ROLES.concat(FAMILIES);
const SLOTS = 16;
const OBJ0 = ROLES.length;          // the first slot an object may be painted in

/* A Style is a whole aesthetic at once: sixteen colours, two type choices, a
   board, and the defaults new drawers are born with. See docs/STYLES.md. */
const STYLES = {
  victorian: {nm:'Victorian', ds:'An old desk: baize, brass, serif',
    board:'#EFEADA|#DDE5CE', boardAlpha:1,
    defaults:{knob:'round', border:'panel', texture:'none', knobtone:'light'},
    cols:['#E9E1CC','#2A241C','#4A4034','#A9793F','#D9B57C',
          '#7E5A38','#4A7C59','#5C7148','#3E7A6B','#3F5F7A','#4A6E8F',
          '#A55A3E','#9A7B2F','#8A5A3F','#7A6AA0','#6E7075'],
    vars:{}},
  modern: {nm:'Modern', ds:'Flat, quiet, sans',
    board:'#F4F4F1|#EBEBE6', boardAlpha:.6,
    defaults:{knob:'bar', border:'none', texture:'none', knobtone:'dark'},
    cols:['#FAFAF8','#1C1F24','#8A9099','#3A6E68','#6FBFA8',
          '#5B5148','#4F7A63','#6B7A5A','#3E7E7A','#41586E','#5C7A99',
          '#B36A55','#A88B4A','#8A6B5C','#6E6790','#7A7E85'],
    vars:{'--radius':'8px','--radius-d':'8px',
      '--serif':'-apple-system,BlinkMacSystemFont,"SF Pro Display",Inter,system-ui,sans-serif'}},
  skeuo: {nm:'Skeuomorphic', ds:'Wood, leather, and things that look like things',
    board:'#E8DCC4|#D9C9A8', boardAlpha:1,
    defaults:{knob:'ring', border:'heavy', texture:'weave2', knobtone:'dark'},
    cols:['#EFE4CC','#33261A','#8A7350','#8A5A2B','#C89B54',
          '#6B4A2A','#4C6B42','#6B7238','#3B6E63','#42566B','#55708C',
          '#9A4F42','#A87C2E','#8A5A3F','#6D5476','#6E6559'],
    vars:{}},
  starry: {nm:'Starry Sidekick', ds:'A night sky with a hand-drawn heart',
    board:'#101422|#161B2E', boardAlpha:1,
    defaults:{knob:'round', border:'plain', texture:'stars', knobtone:'light'},
    cols:['#0B0E1A','#EFE9F7','#8A83A8','#F5D76E','#8FD8F0',
          '#4B3B63','#2E6B57','#4A6B45','#2C6E7A','#33487A','#47639E',
          '#9E4A5E','#B08A3C','#7A5A6E','#6A4E9E','#4A4E63'],
    vars:{'--serif':'"Chalkboard SE","Comic Sans MS","Segoe Print",cursive'}},
  aero: {nm:'Aero', ds:'Teal gloss and clear skies, straight from 2006',
    board:'#D8F0F4|#C2E6EC', boardAlpha:.85,
    defaults:{knob:'orb', border:'aqua', texture:'sheen', knobtone:'light'},
    cols:['#E9F6F8','#0E3A44','#5E93A0','#18A6C4','#7EE8F5',
          '#8C7A6B','#2FA37E','#5FA85E','#1E9AAE','#2B6B99','#4C89C8',
          '#D9704E','#D6A83C','#9A8272','#8A6FD1','#7E8A93'],
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
// The eleven an object may wear, as [slot, name] — the five are the app's.
const objSlots = ()=> FAMILIES.map((nm,i)=>[OBJ0+i, nm]);

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
  SLOTS, OBJ0, SLOTNAMES, ROLES, FAMILIES, styleNow, palNow, setSlot,
  hexOf, objColour, objSlots, isDark };
