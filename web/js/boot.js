/* ============================================================
   boot — load, wire, render, register the service worker
   ============================================================ */
import { $ } from './util.js';
import { S, KINDS, SHAPES, SORTS, childrenOf, container, relate, deskOf, has, lateOn, isLate, knobOf,
  isContainer, faceOf,
  prioOf, repeatOf, repeatSaid, nextRepeat, boardLocked, BINDINGS, bindingOf, PANELS, panelOf } from './model.js';
import { pageRows, freeSpot, boxOk } from './grid.js';
import { create, setPin, togglePin, del, delMany, delDrawer, undo, redo, toggleDone, spawnNext, setGridSize } from './mutations.js';
import { applyLook, applyStyle, STYLES, panelSlots, borderSlots, knobSlots, textureSlots,
  bindingSlots, stockSlots, famSlots, famAll, dress, styleKey, stockNow, randomLook,
  palNow, CHECKS } from './look.js';
import { render, sizeGrid, viewHTML, reveal, settingsPanel, pageAt, pageCount, pageTop, goPage } from './views.js';
import { overlayHTML, objectPanel, modalNewObject, schedulePanel, closePanel,
  sampleObject, sampleTile } from './panels.js';
import { wire } from './wire.js';
import { openingFor, stepDrawer, spray, sprayAt, sprayCount, sprayNow, sprayMark, SPRAYS } from './motion.js';
import { load, writeNow, save, saveIfDirty, hydrateAssets, pasteObjects, migrate } from './persist.js';
import { renderSheet, openWriter, openRead, openViewer, closeSheet, asMarkdown } from './sheet.js';
import { DECOR, DECOR_KEYS, decorSVG, decorSuits, decorFor, decorRest } from './decor.js';

/* ---- the keyboard is not a resize — decision 84 ------------------------
   `100vh` on iOS is the *large* viewport and deliberately ignores the software
   keyboard: a surface sized in vh stays full height while half the screen is a
   keyboard, and Safari then shoves the whole thing upward to get the caret on
   screen — which is how the page you were typing on ended up above the top of
   it. `dvh` does not help; it tracks the browser's own chrome, not the
   keyboard. `visualViewport` is the only honest number there is.

   One custom property on the root, written the way sizeGrid() writes what it
   measures, so the stylesheet does the rest and nothing has to be told. The
   fallback in the CSS is `100vh`, so a browser without visualViewport gets
   exactly what it got before. */
function watchViewport(){
  const vv = window.visualViewport;
  if(!vv) return;
  /* Both numbers: the height it has left, and how far down the layout viewport
     that window has slid. Safari scrolls the page under a fixed shell to chase
     a caret, so a surface anchored at `top:0` can end up above the screen even
     when it is the right height. */
  const write = ()=>{
    const el=document.documentElement.style;
    el.setProperty('--vvh', vv.height+'px');
    el.setProperty('--vvt', (vv.offsetTop||0)+'px');
  };
  vv.addEventListener('resize', write);
  vv.addEventListener('scroll', write);
  write();
}

const restored = load();
const hash = (location.hash||'').replace('#','');
if(hash==='desk') S.view = hash;
$('#frame').insertAdjacentHTML('beforeend', overlayHTML());
wire();
watchViewport();
applyLook();
render();
// settings is a sheet over the desk now, not a place you navigate to
if(hash==='settings') settingsPanel();
hydrateAssets();
if(!restored) writeNow();
save();

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{ /* file:// or unsupported */ });
  });
}

// The console/test surface. `kids` answers "what does this container show?",
// which is the membership question the magic-drawer rules decide.
window.BUREAU = {
  get state(){ return S; }, render, create, save: writeNow, saveSoon: save,
  get K(){ return KINDS; },
  get shapes(){ return SHAPES; },
  // every aesthetic there is, so a test can walk them all rather than
  // hardcode a list that goes stale the moment one is added or dropped
  get styles(){ return STYLES; },
  // picking one is more than writing the key: it carries the board, the
  // alpha and the defaults new drawers are born with
  setStyle: applyStyle,
  // the five workings, named by whichever aesthetic is showing
  panelSlots, borderSlots, knobSlots, textureSlots, bindingSlots, stockSlots, famSlots, famAll,
  dress, styleKey, stockNow, knobOf, isContainer, faceOf,
  // a decoration is tagged rather than dressed — decision 100
  get decorKeys(){ return DECOR_KEYS; }, decorSuits, decorFor, decorRest,
  // the roll a new drawer's look comes from, so a test can sample the
  // generator rather than infer its weighting from twenty objects
  randomLook,
  /* Run the migration chain over a fixture and hand it back. A departed
     aesthetic is the dangerous kind of removal — the fallback hides it — so a
     test has to be able to load an old desk rather than trust the list. */
  migrated(d){ migrate(d); return d; },
  paste: pasteObjects, relate, pin: togglePin, setPin, renderSheet,
  // small | extra | large — the three phone grids, for trying on
  setGrid: setGridSize,
  // the four things an object opens onto: its editor, its words, its paper,
  // and — for something made of an image — the picture
  panel: objectPanel, closePanel, write: openWriter, read: openRead, view: openViewer,
  /* A thing drawn as the thing it makes — the type picker's own primitive
     (decision 51). Exposed so anything outside the app that wants to *show* a
     tile draws the real one rather than a copy of it: `scripts/catalogue.mjs`
     builds the specimen book from these, and a copy would drift the first
     time a slot gained a rule. */
  sampleObject, sampleTile,
  del, delMany, delDrawer, undo, redo, toggleDone, spawnNext,
  // the little calendar, and how a thing comes round — decisions 72, 73, 78
  schedule: schedulePanel, applyLook, palNow,
  get CHECKS(){ return CHECKS; }, decorSVG,
  get sorts(){ return SORTS; },
  prioOf, repeatOf, repeatSaid, nextRepeat, boardLocked,
  closeSheet,
  // the type picker, so a test can open the thing rather than the gesture
  pick: modalNewObject,
  // what an object looks like on its way out — see decision 68
  asMarkdown,
  // the two questions a date can be asked: which day it sits on, and whether
  // it is late — see decision 62
  has, lateOn, isLate,
  // which movement a thing has decided on, for a test that would otherwise
  // have to reimplement the size rule to know what it is looking at
  openingFor,
  // walking the row of desks, for measuring what a swipe actually costs
  /* Walking the desks, building one board as a string, and the measurement
     after layout — the three seams a performance pass needs to time separately,
     because "the swipe feels slow" is three different costs in a trench coat. */
  step: stepDrawer, viewHTML, sizeGrid,
  // the spray, so a test can watch the physics rather than the class — and
  // the reveal, which is now the only thing in the app that sets one off
  spray, sprayAt, sprayCount, sprayNow, sprayMark, reveal,
  get SPRAYS(){ return SPRAYS; },
  // the ten that ship, so a test can walk them without importing the module
  get decor(){ return DECOR; }, boxOk,
  // how a book is bound — decision 87
  get BINDINGS(){ return BINDINGS; }, bindingOf,
  // …and how a drawer front is worked — decision 88
  get PANELS(){ return PANELS; }, panelOf,
  kids: id => childrenOf(container(id)).map(o=>o.id),
  // which desk something is on — the dots by the title answer with it
  deskOf,
  // paging, for the smoke test: how tall a page is and which one you are on
  get pageRows(){ return pageRows(); }, pageAt, pageCount, pageTop, goPage,
  // somewhere free to put a fixture, so a test needn't hardcode a coordinate
  free: (w,h,parent)=> freeSpot(w,h,S.device,parent||'root')
};
