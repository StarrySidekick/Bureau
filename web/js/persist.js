import { D, uid, clamp, ROOT } from './util.js';
import { S, K, KINDS, KEYS, kindHas, isContainer, refreshKinds, defaultLook, dev } from './model.js';
import { GRID, overlaps, gridOf, freeSpot, sizeOfKind } from './grid.js';
import { toast, create, pushUndo } from './mutations.js';
import { render } from './views.js';
import { renderSheet } from './sheet.js';
import { closePanel } from './panels.js';

/* ============================================================
   19b · persistence — everything stays on this device
   ============================================================ */
const APP_VERSION = '1.0';
const KEY = 'bureau.v1';
const install = {deferred:null};   // the browser's install prompt, when one is on offer
let saveTimer = null;

function snapshot(){
  // image bytes live in IndexedDB — keep them out of the JSON
  const objects = S.objects.map(o=>{
    if(!o.media || !o.media.src) return o;
    const m=Object.assign({},o.media); delete m.src;
    return Object.assign({},o,{media:m});
  });
  // a pin whose drawer has gone is dropped here rather than in every delete
  // path; in memory it survives so undo can bring the drawer back pinned
  const pins=(S.pins||[]).filter(id=>S.objects.some(o=>o.id===id));
  return {v:DATA_V, savedAt:new Date().toISOString(), theme:S.theme, pins,
          look:S.look, kinds:S.kinds, deskCfg:S.deskCfg, objects};
}
function writeNow(){
  try{ localStorage.setItem(KEY, JSON.stringify(snapshot())); }
  catch(e){ console.warn('Bureau could not save:', e.message); }
}
function save(){ clearTimeout(saveTimer); saveTimer = setTimeout(writeNow, 250); }
function storeSize(){ try{ return (localStorage.getItem(KEY)||'').length; }catch(e){ return 0; } }

/* v1 → v2: drawers carried only {w,h} and were laid out by flow order. Replay
   that same dense flow once to give every drawer real x/y coordinates, so an
   existing desk comes back looking exactly as its owner left it. */
function flowToCoords(drawers, device){
  const g=GRID[device], taken=[];
  const free=(box)=> box.x+box.w-1<=g.cols && !taken.some(t=>overlaps(box,t));
  drawers.forEach(d=>{
    const b=d[device]||{}, w=clamp(b.w||2,1,g.cols), h=clamp(b.h||1,1,40);
    if(b.x&&b.y){ taken.push({x:b.x,y:b.y,w,h}); d[device]={x:b.x,y:b.y,w,h}; return; }
    let placed=null;
    for(let y=1;y<400&&!placed;y++) for(let x=1;x<=g.cols-w+1;x++){
      const box={x,y,w,h};
      if(free(box)){ placed=box; break; }
    }
    placed=placed||{x:1,y:1,w,h};
    taken.push(placed); d[device]=placed;
  });
}
/* v2 → v3: drawers and objects were two arrays and a drawer could not live
   inside anything. Fold the drawers into the object list as kind 'drawer', and
   turn each object's `drawer` pointer into a `parent`. Ids are preserved, so
   anything that referenced an object by id still resolves. */
function foldDrawers(d){
  const drawers=(d.drawers||[]).map(x=>Object.assign({
    kind:'drawer', parent:ROOT, layout:'list', tags:[], body:'', ord:0,
    filter:{}, pv:'list'
  }, x, {title: x.title || x.nm || 'Untitled'}));
  drawers.forEach(x=>{ delete x.nm; });
  flowToCoords(drawers,'desk');
  flowToCoords(drawers,'phone');
  const known=new Set(drawers.map(x=>x.id));
  const objects=(d.objects||[]).map(o=>{
    const n=Object.assign({tags:[],history:[],milestones:[],ord:0,desk:null,phone:null},o);
    n.parent = (o.parent && (known.has(o.parent)||o.parent===ROOT)) ? o.parent
             : (known.has(o.drawer) ? o.drawer : ROOT);
    delete n.drawer;
    return n;
  });
  return drawers.concat(objects);
}
/* v3 → v4: the grid went from 6 columns of 104px rows to 12 square columns, so
   every cell is half the width it was. Doubling each box keeps a desk looking
   the way it was arranged — a tile twice as wide as tall stays twice as wide
   as tall — which matters more than matching the old pixel height exactly. */
function doubleBoxes(objects){
  objects.forEach(o=>['desk','phone'].forEach(dv=>{
    const b=o[dv]; if(!b || !b.w) return;
    o[dv]={x:(b.x-1)*2+1, y:(b.y-1)*2+1, w:b.w*2, h:b.h*2};
  }));
}
/* Repair, not migration: anything saved before ids were unique may hold
   collisions, and an old backup can reintroduce them at any time — so this
   runs on every load. Keep the first holder of an id and re-id the rest;
   children that pointed at the shared id stay with the first, which is the
   best that can be recovered. The smoke test guards this as `dupIds`. */
function dedupeIds(objects){
  const seen=new Set(); let fixed=0;
  objects.forEach(o=>{
    if(!o.id || seen.has(o.id)){ o.id=uid(isContainer(o)?'d':'o'); fixed++; }
    seen.add(o.id);
  });
  return fixed;
}
/* Migrations, ordered and versioned. The snapshot's `v` records the last step
   already applied, so each step runs exactly once per desk — a current desk
   skips all of them, an old backup replays only what it is missing. These
   used to be ad-hoc per-load mutations inside adopt(); a new repair that
   should run once belongs here, as the next numbered step. */
const DATA_V = 9;
const MIGRATIONS = [
  // Drawers and objects were two arrays and a drawer could not live inside
  // anything. foldDrawers also replays the old dense flow to give v1 drawers
  // real x/y coordinates.
  {v:3, up(d){ if(Array.isArray(d.drawers)){ d.objects=foldDrawers(d); delete d.drawers; } }},
  // 6 columns -> 12 square columns: double every box.
  {v:4, up(d){ doubleBoxes(d.objects); }},
  // 12 -> 24, so a half-cell exists.
  {v:5, up(d){ doubleBoxes(d.objects); }},
  // `layout` used to describe the face as well as the arrangement.
  {v:6, up(d){ d.objects.forEach(o=>{
      if(['checklist','calendar','moodboard','timeline'].includes(o.layout)){
        o.face=o.layout;
        o.layout = o.face==='moodboard' ? 'grid' : 'list';
      }
    }); }},
  // Renames, and the retirement of control objects: New is a click on bare
  // grid, Arrange is press-and-hold, Settings is the gear in the bar.
  {v:7, up(d){
      d.objects.forEach(o=>{
        if(Array.isArray(o.attrs)) o.attrs=o.attrs
          .map(a=>a==='generator'||a==='field'?'spawn':a).filter(a=>a!=='control');
        if(o.kind==='record') o.kind='achievement';
        if(o.kind==='media')
          o.kind = (o.media&&o.media.type==='audio') ? 'audio'
                 : (o.media&&o.media.type==='video') ? 'video' : 'image';
      });
      d.objects = d.objects.filter(o=>!o.ctl && o.kind!=='control');
    }},
  // The Today / Keeping Up / Everything tabs are gone — they were hard-coded
  // aggregations, which is the job a magic drawer already does. Pinned drawers
  // replace them. Put the four that did the tabs' work on the bar if this desk
  // still has them, so an existing desk keeps its one-tap routes; a desk built
  // by hand starts with an empty bar and nothing but grid.
  {v:8, up(d){
      if(Array.isArray(d.pins)) return;
      const live=new Set((d.objects||[]).map(o=>o.id));
      d.pins=['d_today','d_in','d_keep','d_done'].filter(id=>live.has(id));
    }},
  // Opening as a book stopped being one of the things a click can do and
  // became how the object reads — one property with three settings, so that
  // "open it" and "how it looks once open" are two questions again.
  {v:9, up(d){
      const fix=x=>{ if(x && x.onclick==='book'){ x.onclick='read'; x.read=x.read||'book'; } };
      (d.objects||[]).forEach(fix);
      Object.values(d.kinds||{}).forEach(fix);
    }},
];
function migrate(d){
  let v = d.v||0;
  MIGRATIONS.forEach(m=>{ if(v<m.v){ m.up(d); v=m.v; } });
  d.v = DATA_V;
}
function adopt(d){
  if(!d || !(Array.isArray(d.objects)||Array.isArray(d.drawers))) return false;
  migrate(d);
  S.objects = (d.objects||[]).map(o=>Object.assign({tags:[],history:[],milestones:[],ord:0},o));
  const fixedIds=dedupeIds(S.objects);
  if(fixedIds) setTimeout(()=>toast(`Repaired ${fixedIds} duplicated id${fixedIds>1?'s':''}`),400);
  S.kinds = d.kinds || {};
  if(d.deskCfg) S.deskCfg = Object.assign({layout:'grid',locked:false,sort:null}, d.deskCfg);
  S.look = Object.assign(defaultLook(), d.look||{});
  if(d.theme) S.theme = d.theme;
  S.pins = Array.isArray(d.pins) ? d.pins.slice() : [];
  S.undo = [];   // the moves on it referred to objects this desk has never had
  refreshKinds();
  return true;
}
function load(){
  try{
    const raw = localStorage.getItem(KEY);
    return raw ? adopt(JSON.parse(raw)) : false;
  }catch(e){ return false; }
}
function exportBackup(){
  const name = `bureau-${D.iso(D.today())}.json`;
  const blob = new Blob([JSON.stringify(snapshot(),null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast('Backup saved · ' + name);
}
function importBackup(file){
  const fr = new FileReader();
  fr.onload = ()=>{
    try{
      if(adopt(JSON.parse(fr.result))){ writeNow(); S.view='desk'; S.openId=null; render(); renderSheet(); toast('Desk restored'); }
      else toast('That file is not a Bureau backup');
    }catch(e){ toast('Could not read that file'); }
  };
  fr.readAsText(file);
}

/* ============================================================
   19c · assets — image bytes live in IndexedDB, never in the JSON
   ============================================================
   localStorage caps around 5MB and holds the whole desk, so pictures cannot go
   in it. Objects keep {assetId, w, h, label}; the bytes sit in IndexedDB and
   are hydrated onto `media.src` in memory after load. snapshot() strips `src`
   again on the way out, which is what keeps a backup small and readable.      */
const DBNAME='bureau-assets', STORE='assets';
let _db=null;
function db(){
  if(_db) return _db;
  _db = new Promise((res,rej)=>{
    const r=indexedDB.open(DBNAME,1);
    r.onupgradeneeded=()=>{ r.result.createObjectStore(STORE); };
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  }).catch(()=>null);
  return _db;
}
function assetPut(id,src){
  return db().then(d=>d&&new Promise(res=>{
    const tx=d.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(src,id);
    tx.oncomplete=()=>res(true); tx.onerror=()=>res(false);
  })).catch(()=>false);
}
function assetGet(id){
  return db().then(d=>d&&new Promise(res=>{
    const rq=d.transaction(STORE,'readonly').objectStore(STORE).get(id);
    rq.onsuccess=()=>res(rq.result||null); rq.onerror=()=>res(null);
  })).catch(()=>null);
}
function assetDel(id){
  return db().then(d=>d&&new Promise(res=>{
    const tx=d.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete=()=>res(true); tx.onerror=()=>res(false);
  })).catch(()=>false);
}
// After a load, put the pictures back on the objects that reference them.
function hydrateAssets(){
  const want=S.objects.filter(o=>o.media&&o.media.assetId&&!o.media.src);
  if(!want.length) return;
  Promise.all(want.map(o=>assetGet(o.media.assetId).then(src=>{ if(src) o.media.src=src; })))
    .then(()=>render());
}
/* Downscale on import: an untouched phone photo is several megabytes and
   nothing on this grid needs more than about 1400px on its long edge. */
/* Does any pixel have a non-opaque alpha? Sampled on a grid rather than every
   pixel — a 1400px image is two million reads and we only need a yes or no. */
function hasAlpha(cx, cv){
  try{
    const d=cx.getImageData(0,0,cv.width,cv.height).data;
    const step=Math.max(4, Math.floor(d.length/4/20000))*4;   // ~20k samples
    for(let i=3;i<d.length;i+=step) if(d[i]<250) return true;
    return false;
  }catch(e){ return true; }   // tainted canvas: assume alpha and keep PNG
}
function importImage(file){
  if(!/^image\//.test(file.type)){ toast('That is not an image'); return; }
  const fr=new FileReader();
  fr.onerror=()=>toast('Could not read that file');
  fr.onload=()=>{
    const im=new Image();
    im.onerror=()=>toast('Could not read that image');
    im.onload=()=>{
      const max=1400, s=Math.min(1, max/Math.max(im.width,im.height));
      const cv=document.createElement('canvas');
      cv.width=Math.max(1,Math.round(im.width*s)); cv.height=Math.max(1,Math.round(im.height*s));
      const cx=cv.getContext('2d');
      cx.drawImage(im,0,0,cv.width,cv.height);
      /* JPEG has no alpha, so anything see-through came back with a black or
         white box behind it. Keep the alpha channel when the source has one —
         that's what lets a cut-out PNG sit on the board as a cut-out. */
      const keepAlpha = /png|webp|gif|svg/i.test(file.type) && hasAlpha(cx, cv);
      let src;
      try{ src = keepAlpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg',0.82); }
      catch(e){ toast('Could not read that image'); return; }
      const assetId=uid('a');
      assetPut(assetId,src).then(ok=>{
        // an image is placed, not filed: it lands on the grid you are looking
        // at, rather than being routed to whatever drawer collects media
        const here=(S.view==='drawer'&&S.drawerId)||ROOT;
        const o=create('image',{title:file.name.replace(/\.[^.]+$/,''), parent:here});
        o.media={assetId, type:'image', w:cv.width, h:cv.height, label:file.name, src, alpha:keepAlpha};
        // pictures land square; you stretch them to the shape you want
        o.desk=null; o.phone=null;
        closePanel(); save(); render();
        toast(ok?'Image added':'Image added — it may not survive a reload');
      });
    };
    im.src=fr.result;
  };
  fr.readAsDataURL(file);
}

/* ============================================================
   19d · the paste bridge — objects written elsewhere, dropped in here
   ============================================================
   No API and no backend: you describe what you want somewhere that can write
   JSON, paste the result, and it lands on the board. Everything routes through
   create() so nothing can arrive that the model would not have made itself.  */

// "Magic drawer", "magic_drawer", "MAGICDRAWER" — all the same type.
function kindFromName(n){
  if(!n) return 'note';
  const t=String(n).toLowerCase().replace(/[^a-z]/g,'');
  if(KINDS[t]) return t;
  const byName=KEYS.find(k=>K(k).nm.toLowerCase().replace(/[^a-z]/g,'')===t);
  if(byName) return byName;
  const partial=KEYS.find(k=>k.startsWith(t)||t.startsWith(k));
  return partial||'note';
}
const SPEC_FIELDS=['body','due','done','count','rating','price','prio','loc','dur','url','repeat','rel'];

function addSpec(spec, parentId, tally){
  if(spec==null) return;
  if(typeof spec==='string') spec={type:'task', title:spec};   // a bare line is a task
  const asked=kindFromName(spec.type||spec.kind);
  const kids=Array.isArray(spec.children)?spec.children:[];
  // something with children has to be able to hold them
  const kind = (kids.length && !kindHas(asked,'container')) ? 'drawer' : asked;
  const o=create(kind,{parent:parentId, title:String(spec.title||spec.name||'Untitled')});
  if(spec.tags) o.tags=[].concat(spec.tags).map(String);
  SPEC_FIELDS.forEach(f=>{ if(spec[f]!=null) o[f]=spec[f]; });
  if(spec.colour||spec.color) o.c=spec.colour||spec.color;
  if(spec.shape) o.shape=spec.shape;
  if(spec.face)  o.face=spec.face;
  if(spec.layout) o.layout=spec.layout;
  if(spec.onclick) o.onclick=spec.onclick;
  const [dw,dh]=sizeOfKind(kind, dev());
  const w=clamp(parseInt(spec.w,10)||dw,1,gridOf().cols), h=Math.max(1,parseInt(spec.h,10)||dh);
  o[dev()]=freeSpot(w,h,dev(),parentId);
  tally[isContainer(o)?'drawers':'objects']++;
  tally.made.push(o.id);
  kids.forEach(c=>addSpec(c, o.id, tally));
  return o;
}

function pasteObjects(text, parentId){
  let raw=String(text||'').trim();
  raw=raw.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();   // tolerate fences
  if(!raw) return toast('Nothing to add');
  let data;
  try{ data=JSON.parse(raw); }
  catch(e){ toast('That is not valid JSON — check for a stray comma'); return; }
  const list=Array.isArray(data)?data:[data];
  if(!list.length) return toast('Nothing to add');
  const tally={drawers:0,objects:0,made:[]};
  try{ list.forEach(sp=>addSpec(sp, parentId||ROOT, tally)); }
  catch(e){ toast('Could not read that: '+e.message); return; }
  save(); render();
  const bits=[];
  if(tally.drawers) bits.push(`${tally.drawers} drawer${tally.drawers>1?'s':''}`);
  if(tally.objects) bits.push(`${tally.objects} object${tally.objects>1?'s':''}`);
  // a paste is one move, however many objects it made — undoing it should not
  // mean pressing undo forty times
  pushUndo('Paste', tally.made.map(id=>({add:id})));
  toast('Added '+(bits.join(' and ')||'nothing'), !!tally.made.length);
}

export { APP_VERSION, writeNow, save, storeSize, load, exportBackup,
  importBackup, assetDel, hydrateAssets, importImage, pasteObjects, install };
