/* ============================================================
   boot — load, wire, render, register the service worker
   ============================================================ */
import { $ } from './util.js';
import { S, KINDS, SHAPES, childrenOf, container, relate } from './model.js';
import { create, togglePin, del, delMany, delDrawer, undo, toggleDone } from './mutations.js';
import { applyLook } from './look.js';
import { render, settingsPanel } from './views.js';
import { overlayHTML, objectPanel } from './panels.js';
import { wire } from './wire.js';
import { load, writeNow, save, hydrateAssets, pasteObjects } from './persist.js';
import { renderSheet, openWriter, openRead } from './sheet.js';

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
  paste: pasteObjects, relate, pin: togglePin, renderSheet,
  // the three things an object opens onto: its settings, its words, its paper
  panel: objectPanel, write: openWriter, read: openRead,
  del, delMany, delDrawer, undo, toggleDone,
  kids: id => childrenOf(container(id)).map(o=>o.id)
};
