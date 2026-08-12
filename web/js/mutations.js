import { $, esc, uid, ROOT, D } from './util.js';
import { S, byId, K, KEYS, kindHas, has, isContainer, streak, T, dz, dev } from './model.js';
import { gridOf, freeSpot } from './grid.js';
import { randomFront, randomBoard, styleDefaults } from './look.js';
import { render } from './views.js';
import { closeSheet } from './sheet.js';
import { assetDel } from './persist.js';

/* ============================================================
   6 · mutations
   ============================================================ */
function toast(msg,undo){
  const t=$('#toast');
  t.innerHTML = esc(msg) + (undo?' <u data-undo="1">Undo</u>':'');
  t.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),3400);
}
function nextDue(o){
  if(!o.repeat||!o.due) return null;
  const r=o.repeat;
  if(r==='daily') return D.addISO(o.due,1);
  if(r==='weekly') return D.addISO(o.due,7);
  if(r==='monthly'){ const d=D.parse(o.due); d.setMonth(d.getMonth()+1); return D.iso(d); }
  if(r==='weekdays'){ let d=D.parse(o.due); do{ d=D.add(d,1);}while(d.getDay()===0||d.getDay()===6); return D.iso(d); }
  return null;
}
function toggleDone(id){
  const o=byId(id); if(!o) return;
  if(has(o,'streak')){ toggleHabit(id); return; }
  o.done=!o.done;
  if(o.done){
    o.doneAt=T;
    const nd=nextDue(o);
    if(nd){
      S.objects.push(Object.assign({},o,{id:uid('o'),done:false,doneAt:null,due:nd,ord:o.ord+0.5}));
      o.kind='achievement';   // the archive is a magic drawer; nothing needs moving
      toast(`Done · repeats ${D.human(nd).toLowerCase()}`);
    } else toast('Filed under Done & Dusted');
  } else { o.doneAt=null; }
  render();
}
function toggleHabit(id){
  const o=byId(id); if(!o) return;
  o.history=o.history||[];
  const i=o.history.indexOf(T);
  if(i>=0) o.history.splice(i,1); else { o.history.push(T); toast(`${o.title} · ${streak(o)+0} day streak`); }
  render();
}
// Anything still in the bin when the bin is emptied is gone for good, so that
// is the moment its picture can be freed — not the moment it was deleted,
// which would break undo.
function dropTrash(){
  const t=S.trash; S.trash=null;
  if(t && t.o && t.o.media && t.o.media.assetId) assetDel(t.o.media.assetId);
}
function del(id){
  const i=S.objects.findIndex(o=>o.id===id); if(i<0) return;
  dropTrash();
  S.trash={o:S.objects[i], i};
  S.objects.splice(i,1);
  if(S.openId===id) closeSheet();
  toast('Deleted', true); render();
}
function undo(){
  if(!S.trash) return;
  S.objects.splice(S.trash.i,0,S.trash.o); S.trash=null;
  $('#toast').classList.remove('show'); render();
}
/* Pinning is deliberately not a property of the drawer — see the note on
   `S.pins` in model.js. Pinning appends, so the bar fills left to right in the
   order you chose things, and unpinning leaves the rest where they were. */
function setPin(id, on){
  const o=byId(id); if(!o || !isContainer(o)) return;
  S.pins = (S.pins||[]).filter(x=>x!==id);
  if(on) S.pins.push(id);
  render();
}
function togglePin(id){
  const o=byId(id); if(!o || !isContainer(o)) return;
  const on = !(S.pins||[]).includes(id);
  setPin(id, on);
  toast(on ? `${o.title} pinned to the bar` : `${o.title} unpinned`);
}
/* Tag filtering has no mode and no filter bar on purpose. A tag you care about
   enough to filter by is a tag you care about enough to keep, and "everything
   matching this" is exactly what a magic drawer already says — so clicking a
   tag makes that drawer once and opens it every time after. One concept doing
   the work instead of two. */
function drawerForTag(tag){
  const t=String(tag||'').replace(/^#/,'').trim();
  if(!t) return null;
  let d=S.objects.find(o=>isContainer(o)&&has(o,'magic')&&(o.filter||{}).tag===t);
  if(!d){
    d=create('magic',{title:'#'+t, parent:ROOT});
    d.filter={tag:t};
    toast(`Made a drawer for #${t}`);
  }
  S.view='drawer'; S.drawerId=d.id; S.kindFilter=null;
  render();
  return d;
}
function create(kind, patch){
  const k=K(kind);
  const o = Object.assign({
    id:uid(kindHas(kind,'container')?'d':'o'), kind, title:'', body:k.body||'', tags:[],
    parent:(S.view==='drawer'&&S.drawerId)||ROOT,
    done:false, doneAt:null, due:kindHas(kind,'date')?T:null,
    repeat:kindHas(kind,'streak')?'daily':null,
    history:[], milestones:kindHas(kind,'progress')?[{t:'First milestone',done:false,d:dz(30)}]:[],
    media:kindHas(kind,'media')?{type:'image',label:'Attach a file'}:null,
    link:kindHas(kind,'button')?{label:'Open',target:''}:null,
    desk:null, phone:null,
    ord:Math.min(0,...S.objects.map(o=>o.ord||0))-1, created:T
  }, patch||{});
  if(kindHas(kind,'container')){
    o.board = o.board || randomBoard();
    o.c = o.c || randomFront();
    const sd=styleDefaults();
    o.knob=o.knob||sd.knob; o.border=o.border||sd.border;
    o.texture=o.texture||sd.texture; o.knobtone=o.knobtone||sd.knobtone; o.pv = o.pv || 'list';
    o.layout = o.layout || k.layout || 'list';
    o.filter = o.filter || {};
  }
  /* No auto-routing. It made sense when ordinary drawers had rules; now the
     only drawers with rules are magic ones, which hold nothing — so routing a
     new object into one filed it somewhere it could never appear, and it
     vanished from the drawer you made it in. */
  S.objects.push(o);
  return o;
}
function quickAdd(text, kind, drawerId){
  let t=text.trim(); if(!t) return null;
  let k=kind||'task', due=null; const tags=[];
  const slash=t.match(/^\/(\w+)\s+/);
  if(slash){ const found=KEYS.find(x=>x.startsWith(slash[1].toLowerCase())); if(found){ k=found; t=t.slice(slash[0].length); } }
  t=t.replace(/#([\w-]+)/g,(m,g)=>{tags.push(g);return '';});
  if(/!today\b/i.test(t)){ due=T; t=t.replace(/!today\b/i,''); }
  if(/!tomorrow\b/i.test(t)){ due=dz(1); t=t.replace(/!tomorrow\b/i,''); }
  if(/!week\b/i.test(t)){ due=dz(7); t=t.replace(/!week\b/i,''); }
  t=t.replace(/\s+/g,' ').trim();
  const o=create(k,{title:t, tags, parent:drawerId||undefined, body:''});
  if(due) o.due=due; else if(!kindHas(k,'date')) o.due=null;
  return o;
}

/* Testing aid: drop something arbitrary onto the desk. Random kind, random
   size within what the grid allows, random colour — the point is to see how
   placement and the board cope with shapes nobody designed for. */
const WORDS='brass ledger cedar tide quarry lantern vellum thistle harbour ember slate poppy compass juniper marrow'.split(' ');
function randomThing(parentId){
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const kinds=KEYS.filter(k=>!kindHas(k,'control'));
  const kind=pick(kinds);
  const home=parentId||(S.view==='drawer'&&S.drawerId)||ROOT;
  const o=create(kind,{parent:home,
    title:`${pick(WORDS)} ${pick(WORDS)}`.replace(/^./,c=>c.toUpperCase())});
  if(has(o,'text')) o.body=Array.from({length:2+Math.floor(Math.random()*4)},()=>pick(WORDS)).join(' ')+'.';
  if(has(o,'date')&&Math.random()<0.6) o.due=dz(Math.floor(Math.random()*14)-3);
  if(has(o,'check')&&Math.random()<0.3) { o.done=true; o.doneAt=T; }
  if(isContainer(o)){ o.c=randomFront(); o.board=randomBoard();
    o.knob=pick(['round','diamond','bar','ring','square']);
    o.border=pick(['panel','panel','heavy','bar','plain','none']); }
  const g=gridOf(), dv=dev();
  const w=1+Math.floor(Math.random()*8), h=1+Math.floor(Math.random()*8);
  o[dv]=freeSpot(Math.min(w,g.cols), h, dv, home);
  return o;
}

// toggleHabit isn't exported — a streak reaches it through toggleDone, which is
// the one door, so nothing outside has to know a habit ticks differently.
export { toast, toggleDone, del, undo, setPin, togglePin, drawerForTag, create, quickAdd, randomThing };
