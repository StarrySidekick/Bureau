/* ============================================================
   boot — load, wire, render, register the service worker
   ============================================================ */
import { $ } from './util.js';
import { S, KINDS, FACES, SORTS, L, LAYOUTS, refreshKinds, childrenOf, container, relate, deskOf, has, lateOn, isLate,
  prioOf, repeatOf, repeatSaid, nextRepeat, boardLocked } from './model.js';
import { pageRows, freeSpot } from './grid.js';
import { create, setPin, togglePin, del, delMany, delDrawer, undo, redo, toggleDone, spawnNext, setGridSize,
  applyLayout, layoutFromBoard, delLayout } from './mutations.js';
import { applyLook } from './look.js';
import { render, sizeGrid, viewHTML, settingsPanel, pageAt, pageCount, goPage } from './views.js';
import { overlayHTML, objectPanel, modalNewObject, schedulePanel } from './panels.js';
import { wire } from './wire.js';
import { openingFor, stepDrawer } from './motion.js';
import { load, writeNow, save, saveIfDirty, hydrateAssets, pasteObjects } from './persist.js';
import { renderSheet, openWriter, openRead, openViewer, closeSheet, asMarkdown } from './sheet.js';

const restored = load();
const hash = (location.hash||'').replace('#','');
if(hash==='desk') S.view = hash;
$('#frame').insertAdjacentHTML('beforeend', overlayHTML());
wire();
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
  get faces(){ return FACES; },
  // layouts: a saved board, and the two directions it travels
  get layouts(){ return LAYOUTS; }, L, applyLayout, layoutFromBoard, delLayout, refreshKinds,
  paste: pasteObjects, relate, pin: togglePin, setPin, renderSheet,
  // small | extra | large — the three phone grids, for trying on
  setGrid: setGridSize,
  // the four things an object opens onto: its editor, its words, its paper,
  // and — for something made of an image — the picture
  panel: objectPanel, write: openWriter, read: openRead, view: openViewer,
  del, delMany, delDrawer, undo, redo, toggleDone, spawnNext,
  // the little calendar, and how a thing comes round — decisions 72, 73, 78
  schedule: schedulePanel, applyLook,
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
  kids: id => childrenOf(container(id)).map(o=>o.id),
  // which desk something is on — the dots by the title answer with it
  deskOf,
  // paging, for the smoke test: how tall a page is and which one you are on
  get pageRows(){ return pageRows(); }, pageAt, pageCount, goPage,
  // somewhere free to put a fixture, so a test needn't hardcode a coordinate
  free: (w,h,parent)=> freeSpot(w,h,S.device,parent||'root')
};
