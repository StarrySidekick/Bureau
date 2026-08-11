import { S, defaultLook } from './model.js';
import { save } from './persist.js';
import { render } from './views.js';

/* Which theme is actually showing right now. */
const themeNow = ()=> S.theme==='auto'
  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'walnut' : 'paper')
  : S.theme;
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

/* Appearance: custom background, accent and drawer outline, applied as inline
   custom properties on <html> for whichever theme is showing. */
function applyLook(){
  const el=document.documentElement, L=S.look||defaultLook();
  L.bg=lookVal('bg'); L.accent=lookVal('accent'); L.line=lookVal('line'); L.board=lookVal('board');
  if(L.bg){
    el.style.setProperty('--paper', L.bg);
    el.style.setProperty('--paper-2', `color-mix(in srgb, ${L.bg} 84%, #fff)`);
    el.style.setProperty('--paper-3', `color-mix(in srgb, ${L.bg} 90%, #000)`);
  } else ['--paper','--paper-2','--paper-3'].forEach(p=>el.style.removeProperty(p));
  el.style.setProperty('--board-alpha', L.boardAlpha==null?1:L.boardAlpha);
  if(L.board){ const [a,b]=String(L.board).split('|');
    el.style.setProperty('--board-1', a); el.style.setProperty('--board-2', b||a); }
  else { el.style.removeProperty('--board-1'); el.style.removeProperty('--board-2'); }
  if(L.accent) el.style.setProperty('--brass', L.accent); else el.style.removeProperty('--brass');
  if(L.line) el.style.setProperty('--line', L.line); else el.style.removeProperty('--line');
  // The style's tokens go on last. A custom colour the user chose still wins
  // — those slots are skipped — but everything else is the style's to set.
  const st=STYLES[L.style]||null;
  el.dataset.style = L.style||'victorian';
  ['--radius','--radius-d','--serif','--ink','--ink-2','--ink-3','--rule','--rule-2']
    .forEach(v=>el.style.removeProperty(v));
  if(st) Object.entries(st.vars).forEach(([k,v])=>{
    if(L.bg && k.startsWith('--paper')) return;
    if(L.accent && k==='--brass') return;
    el.style.setProperty(k,v);
  });
}

/* A board for a new drawer: one hue, two lightnesses, low saturation. Picking
   from a hue wheel rather than at random keeps it mild — nothing neon, and the
   two squares always belong to each other. */
function randomFront(){
  const c=paletteNow().cols; return c[Math.floor(Math.random()*c.length)];
}
function randomBoard(){
  const hue = Math.floor(Math.random()*360);
  const sat = 12 + Math.floor(Math.random()*10);          // 12–21%, never garish
  const lightA = 88 + Math.floor(Math.random()*4);        // the pale square
  const lightB = lightA - (7 + Math.floor(Math.random()*5));
  const hsl=(l)=>`hsl(${hue} ${sat}% ${l}%)`;
  return `${hsl(lightA)}|${hsl(lightB)}`;
}

/* A palette is sixteen colours chosen to sit together. Everything that offers
   a colour — drawer fronts, kind colours, the random generator — draws from
   whichever one is selected, so a desk can't drift into a jumble. */
const PALETTES = {
  workshop: {nm:'Workshop', cols:[
    '#6F5137','#7E5A38','#8A6A3C','#A0703F','#5A4130',
    '#4A7C59','#3D6B4A','#5C7148','#6E8B4E','#3E7A6B',
    '#3F5F7A','#4A6E8F','#2F4A5E','#5D7E99','#A55A3E','#9A7B2F']},
  seaside: {nm:'Seaside', cols:[
    '#2F4A5E','#37687A','#4E8395','#6FA3AE','#8FB9BE',
    '#3E6B63','#517F6F','#6E9B7E','#93B39A','#B7C9AE',
    '#8C7A5E','#A69375','#C2B08C','#7A6A55','#4A4238','#D6C9A8']},
  orchard: {nm:'Orchard', cols:[
    '#7A3B3C','#9A4F42','#B4674C','#C68A5E','#D8A97A',
    '#6B7A3F','#849453','#9DAE6B','#5E6B47','#47533A',
    '#8A5A3F','#A0703F','#6F5137','#5A4130','#3F3128','#C9A66B']},
  aero: {nm:'Aero', cols:[
    '#18A6C4','#2FBCD8','#54CFE6','#8ADFEF','#B7ECF5',
    '#1B8FA8','#27788C','#3FAE9C','#63C6B0','#93D9C6',
    '#4C89C8','#6FA6DB','#9BC4EA','#2B6B99','#0E4B62','#7ED4A0']},
  ink: {nm:'Ink', cols:[
    '#2A2E33','#3A4048','#4B535D','#5D6772','#707B87',
    '#3B4A52','#4C5F68','#5E747E','#718A94','#89A1A9',
    '#4A4A55','#5B5B68','#6C6C7A','#7E7E8C','#38383F','#9A9AA6']}
};
/* A Style is a whole aesthetic at once: tokens, palette, board, and the
   defaults new drawers are born with. Choosing one sets the stage; every
   individual control still works afterwards, so a style is a starting point
   rather than a cage. See docs/STYLES.md for the guides. */
const STYLES = {
  victorian: {nm:'Victorian', ds:'An old desk: baize, brass, serif',
    theme:'paper', palette:'workshop',
    board:'#EFEADA|#DDE5CE', boardAlpha:1,
    defaults:{knob:'round', border:'panel', texture:'none', knobtone:'light'},
    vars:{}},
  modern: {nm:'Modern', ds:'Flat, quiet, sans',
    theme:'paper', palette:'ink',
    board:'#F4F4F1|#EBEBE6', boardAlpha:.6,
    defaults:{knob:'bar', border:'none', texture:'none', knobtone:'dark'},
    vars:{'--radius':'8px','--radius-d':'8px',
      '--serif':'-apple-system,BlinkMacSystemFont,"SF Pro Display",Inter,system-ui,sans-serif',
      '--paper':'#FAFAF8','--paper-2':'#FFFFFF','--paper-3':'#EFEFEA','--brass':'#3A6E68'}},
  skeuo: {nm:'Skeuomorphic', ds:'Wood, leather, and things that look like things',
    theme:'paper', palette:'orchard',
    board:'#E8DCC4|#D9C9A8', boardAlpha:1,
    defaults:{knob:'ring', border:'heavy', texture:'weave2', knobtone:'dark'},
    vars:{'--paper':'#EFE4CC','--paper-2':'#F7EEDA','--paper-3':'#E2D4B4','--brass':'#8A5A2B'}},
  starry: {nm:'Starry Sidekick', ds:'A night sky with a hand-drawn heart',
    theme:'walnut', palette:'seaside',
    board:'#101422|#161B2E', boardAlpha:1,
    defaults:{knob:'round', border:'plain', texture:'stars', knobtone:'light'},
    vars:{'--paper':'#0B0E1A','--paper-2':'#141829','--paper-3':'#1D2338',
      '--ink':'#EFE9F7','--ink-2':'#A9A3C2','--ink-3':'#6F6A8A',
      '--brass':'#F5D76E','--rule':'rgba(239,233,247,.16)','--rule-2':'rgba(239,233,247,.08)',
      '--serif':'"Chalkboard SE","Comic Sans MS","Segoe Print",cursive'}},
  aero: {nm:'Aero', ds:'Teal gloss and clear skies, straight from 2006',
    theme:'paper', palette:'aero',
    board:'#D8F0F4|#C2E6EC', boardAlpha:.85,
    defaults:{knob:'orb', border:'aqua', texture:'sheen', knobtone:'light'},
    vars:{'--radius':'12px','--radius-d':'10px',
      '--paper':'#E9F6F8','--paper-2':'#F6FCFD','--paper-3':'#D6EDF1',
      '--ink':'#0E3A44','--ink-2':'#3E6B77','--ink-3':'#6F98A2',
      '--brass':'#18A6C4','--rule':'rgba(14,58,68,.18)','--rule-2':'rgba(14,58,68,.09)',
      '--serif':'"Trebuchet MS","Segoe UI",Verdana,sans-serif'}}
};
function applyStyle(key){
  const st=STYLES[key]; if(!st) return;
  S.look.style=key;
  S.theme=st.theme;
  S.look.palette=st.palette;
  setLookVal('board', st.board); S.look.boardAlpha=st.boardAlpha;
  S.look.styleDefaults=st.defaults;
  applyLook(); save(); render();
}
const styleDefaults = ()=> (S.look&&S.look.styleDefaults)||STYLES.victorian.defaults;
const paletteNow = ()=> PALETTES[(S.look&&S.look.palette)||'workshop']||PALETTES.workshop;
// kept as a grouped map because the pickers render it in rows
const SWATCHES = new Proxy({}, {
  ownKeys(){ return ['a','b','c','d']; },
  getOwnPropertyDescriptor(){ return {enumerable:true, configurable:true}; },
  get(_,k){
    const c=paletteNow().cols, i={a:0,b:4,c:8,d:12}[k];
    return i==null ? undefined : c.slice(i,i+4).map(x=>[x,x]);
  }
});
const BACKDROPS = [
  ['#E9E1CC','Parchment'],['#EFE8D6','Vellum'],['#E2D9C0','Manila'],
  ['#DED3B6','Kraft'],['#F1EDE0','Chalk'],['#D9D2BE','Linen']
];

export { themeNow, lookVal, setLookVal, applyLook, applyStyle, styleDefaults,
  paletteNow, randomFront, randomBoard, PALETTES, STYLES, SWATCHES, BACKDROPS };
