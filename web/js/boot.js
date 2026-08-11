/* ============================================================
   boot — load, wire, render, register the service worker
   ============================================================ */
import { $ } from './util.js';
import { S, KINDS, childrenOf, container, relate } from './model.js';
import { create, togglePin } from './mutations.js';
import { applyLook } from './look.js';
import { render } from './views.js';
import { overlayHTML } from './panels.js';
import { wire } from './wire.js';
import { load, writeNow, save, hydrateAssets, pasteObjects } from './persist.js';

const restored = load();
const hash = (location.hash||'').replace('#','');
if(['desk','settings'].includes(hash)) S.view = hash;
$('#frame').insertAdjacentHTML('beforeend', overlayHTML());
wire();
applyLook();
render();
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
  paste: pasteObjects, relate, pin: togglePin,
  kids: id => childrenOf(container(id)).map(o=>o.id)
};
