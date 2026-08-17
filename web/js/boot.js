/* ============================================================
   boot — load, wire, render, register the service worker
   ============================================================ */
import { $ } from './util.js';
import { S, KINDS, SHAPES, childrenOf, container, relate } from './model.js';
import { pageRows, freeSpot } from './grid.js';
import { create, setPin, togglePin, del, delMany, delDrawer, undo, toggleDone, setGridSize } from './mutations.js';
import { applyLook } from './look.js';
import { render, settingsPanel, pageAt, pageCount, goPage } from './views.js';
import { overlayHTML, objectPanel } from './panels.js';
import { wire } from './wire.js';
import { openingFor } from './motion.js';
import { load, writeNow, save, hydrateAssets, pasteObjects } from './persist.js';
import { renderSheet, openWriter, openRead, openViewer } from './sheet.js';

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
  get state(){ return S; }, render, create, save: writeNow,
  get K(){ return KINDS; },
  get shapes(){ return SHAPES; },
  paste: pasteObjects, relate, pin: togglePin, setPin, renderSheet,
  // small | extra | large — the three phone grids, for trying on
  setGrid: setGridSize,
  // the four things an object opens onto: its editor, its words, its paper,
  // and — for something made of an image — the picture
  panel: objectPanel, write: openWriter, read: openRead, view: openViewer,
  del, delMany, delDrawer, undo, toggleDone,
  // which movement a thing has decided on, for a test that would otherwise
  // have to reimplement the size rule to know what it is looking at
  openingFor,
  kids: id => childrenOf(container(id)).map(o=>o.id),
  // paging, for the smoke test: how tall a page is and which one you are on
  get pageRows(){ return pageRows(); }, pageAt, pageCount, goPage,
  // somewhere free to put a fixture, so a test needn't hardcode a coordinate
  free: (w,h,parent)=> freeSpot(w,h,S.device,parent||'root')
};
