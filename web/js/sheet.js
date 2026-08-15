import { $, $$, esc, ic, md, D, ROOT } from './util.js';
import { S, K, byId, has, isContainer, READS, readOf } from './model.js';
import { bookOf } from './tiles.js';
import { closePanel, objectPanel } from './panels.js';
import { render } from './views.js';

/* ============================================================
   15 · the two surfaces an object opens onto
   ============================================================
   There used to be three: a reading surface, a half-screen read panel, and a
   detail *sheet* — a scrolling form of every field the object had, with the
   body at the bottom of it. The sheet was the app's second settings screen and
   its only writing surface at the same time, which is why it was neither:
   every setting on it also lives in the object's own panel, and the one thing
   you actually came for — the words — got a textarea eight fields down.

   Two now, and each is one job:

     read   — the body as paper. A spread, a page, or a column you scroll.
     write  — the same body, full screen, with nothing else on it.

   Everything that was a *setting* on the old sheet is in the object settings
   panel, which is one panel for objects and containers alike. See decision 36. */

function openWriter(id){
  const o=byId(id); if(!o) return;
  S.writeId=id; S.readId=null; S.editId=null;
  renderSheet();
}
function openRead(id){
  const o=byId(id); if(!o) return;
  S.readId=id; S.writeId=null; S.editId=null; S.bookAt=0;
  renderSheet();
}
/* What "open this one" means when nothing has said which way: something with a
   body opens to be read, and something without one has nothing to read, so it
   opens its settings. Used by the palette and by a button pointing at an
   object — both of which mean "take me to it", not "edit it". */
function openObj(id){
  const o=byId(id); if(!o) return;
  if(isContainer(o)){ S.view='drawer'; S.drawerId=id; render(); return; }
  if(has(o,'text')) openRead(id); else objectPanel(id);
}
function closeSheet(){
  S.writeId=null; S.readId=null; S.editId=null;
  clearFocus(); renderSheet(); render();
}
function clearFocus(){
  $$('.drawer.focused').forEach(e=>e.classList.remove('focused'));
  $('#frame').classList.remove('sheet-left');
}

const words = s => (s||'').split(/\s+/).filter(Boolean).length;

function renderSheet(){
  const host=$('#sheetHost');
  // A surface and a panel both take the screen; only one at a time, and a
  // surface is the bigger claim.
  if(S.writeId || S.readId) closePanel();

  /* Writing. Full screen, over a dimmed desk: a title and a body, and the two
     buttons that take you to the other two things you can do with an object.
     No render() while you type — the textarea is the thing being typed in —
     so the word count is the one thing that updates, in place. */
  if(S.writeId){
    const o=byId(S.writeId);
    if(!o){ S.writeId=null; host.innerHTML=''; return; }
    const k=K(o.kind);
    host.innerHTML=`<div class="writescrim" data-sheet="close"></div>
      <div class="writestage" style="--k:${k.c}">
        <div class="writehead">
          <span class="kindbadge">${ic(k.ic,12)} ${esc(k.nm)}</span>
          <span class="wcount" id="wcount">${words(o.body)} words</span>
          <div style="flex:1"></div>
          ${has(o,'text')?`<button class="pill" data-act="readthis" data-id="${o.id}">${ic('eye',13)} Read</button>`:''}
          <button class="pill" data-act="objset" data-id="${o.id}">${ic('sliders',13)} Settings</button>
          <button class="iconbtn" data-sheet="close" title="Done">${ic('x',16)}</button>
        </div>
        <div class="writepaper">
          <textarea class="writetitle" rows="1" data-w="title"
            placeholder="Untitled ${esc(k.nm.toLowerCase())}">${esc(o.title||'')}</textarea>
          <textarea class="writebody" data-w="body"
            placeholder="Write.">${esc(o.body||'')}</textarea>
        </div>
      </div>`;
    const t=$('.writetitle',host);
    if(t){ t.style.height='auto'; t.style.height=t.scrollHeight+'px'; }
    const b=$('.writebody',host); if(b) setTimeout(()=>b.focus(),20);
    return;
  }

  /* Reading. One surface, three modes — a spread, a single page, or a column
     you scroll. Edit opens the writing surface, which is the same body with
     the paper taken away. */
  if(S.readId){
    const r=byId(S.readId);
    if(!r){ S.readId=null; host.innerHTML=''; return; }
    const mode=readOf(r);
    host.innerHTML=`<div class="bookscrim" data-sheet="close"></div>
      <div class="bookstage rm-${mode}">
        <div class="bookhead"><b>${esc(r.title||'Untitled')}</b>
          <div class="readmodes">${Object.entries(READS).map(([v,n])=>
            `<button class="pchip${mode===v?' on':''}" data-oread="${v}" data-id="${r.id}">${n}</button>`).join('')}</div>
          <button class="pill" data-act="editthis" data-id="${r.id}">${ic('edit',13)} Edit</button>
          <button class="iconbtn" data-sheet="close">${ic('x',16)}</button></div>
        ${bookOf(r)}
      </div>`;
    return;
  }
  host.innerHTML=''; clearFocus();
}

export { openObj, openWriter, openRead, closeSheet, renderSheet, words };
