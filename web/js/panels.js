import { $, $$, esc, ic, uid, clamp, ROOT } from './util.js';
import { S, K, KINDS, KEYS, T, ATTRS, USER_ATTRS, FIELDS, fieldOf, OPS, ROLLS,
  SORTS, FACES, SHAPES, READS, faceOf, layoutOf, shapeOf, readOf, byId, container, cfgOf, deskTitle,
  rootObj, containers, isContainer, isAncestor, childrenOf, has, kindHas,
  attrsOf, allTags, isPinned, dev, takesTyping, genKindOf,
  CALVIEWS, calViewOf, weekStartOf, showsWeekends } from './model.js';
import { GRID, lay, boxOk, freeSpot, sizeOfKind, toPhoneSize } from './grid.js';
import { SWATCHES, paletteNow, randomBoard, randomFront } from './look.js';
import { CLICKS, clickOf, gridTile, pending } from './tiles.js';
import { quickAdd, toast } from './mutations.js';
import { openObj, renderSheet } from './sheet.js';
import { render, settingsPanel } from './views.js';
import { save } from './persist.js';

/* ============================================================
   16 · overlays
   ============================================================ */
function overlayHTML(){
  return `
  <div class="scrim" id="cmdscrim"><div class="modal cmd">
    <input class="cmdinput" id="cmdinput" placeholder="Search objects, drawers, kinds…">
    <div class="cmdlist" id="cmdlist"></div></div></div>
  <div class="toast" id="toast"></div>
  <div class="ctxmenu" id="ctx"></div>
  <div id="sheetHost"></div>
  <input type="file" id="importer" accept="application/json,.json" class="hidden">
  <input type="file" id="imgpicker" accept="image/*" class="hidden">`;
}

/* ============================================================
   16b · the panel — the only shape a menu has
   ============================================================
   There are no modals left. Everything that used to be a card in the middle of
   a dimmed screen is a panel down the right instead, because every one of them
   asks a question about the desk and every one of them used to hide it. The
   desk stays visible and stays live behind a panel: you can watch a colour, a
   type or a drawer's rule land while you are still choosing it.

   One at a time — opening another replaces it. `spec.body` is a function, not
   a string, so refreshPanel() can redraw the panel from state without every
   caller remembering how; `spec.key` names which panel is up, for the handful
   of places that need to know. The draft a form is building lives here rather
   than on the element, so redrawing can't lose it. */
const PANEL = {spec:null, draft:null, anchor:null};

function openPanel(spec){
  PANEL.spec = spec;
  PANEL.draft = spec.draft || null;
  PANEL.anchor = spec.anchor || null;
  let el = $('#panel'), fresh=false;
  if(!el){
    $('#frame').insertAdjacentHTML('beforeend',
      `<aside class="panel" id="panel"><div class="ptop"></div><div class="pbody"></div></aside>`);
    el = $('#panel'); fresh=true;
  }
  /* Rebuild the class list rather than toggling, so a panel that was a bubble
     doesn't stay one — but keep `open`, or replacing one panel with another
     would slide the whole thing out and back in. */
  const wasOpen = !fresh && el.classList.contains('open');
  el.className = 'panel' + (spec.wide?' wide':'') + (wasOpen?' open':'');
  el.removeAttribute('style');
  el.dataset.panel = spec.key || '';
  bubbleAt(el, PANEL.anchor);
  // one frame late, or the transform has nothing to animate from
  if(fresh) requestAnimationFrame(()=>{ const p=$('#panel'); if(p) p.classList.add('open'); });
  drawPanel(true);
  return el;
}

/* ---- a panel that is about one object comes up out of it ----------------
   Settings is about the desk and belongs down the edge of it. A panel about
   one tile is a different question — "this one, what about it" — and asking it
   from the far side of the screen makes you look away from the thing you are
   changing. So it arrives beside the tile instead, on whichever side has room,
   with a tail pointing back at it. It is the same panel: same header, same
   body, same handlers. Only where it sits and how it arrives change.

   Below the breakpoint there is no room either side, and it falls back to the
   edge panel — which is the right shape on a phone anyway. */
const BUBBLE_W = 340, BUBBLE_GAP = 14;
const anchorEl = a => !a ? null
  : a.nodeType ? a
  : $(`.grid .drawer[data-drawer="${a}"], .grid .drawer[data-row="${a}"]`);

function bubbleAt(el, anchor){
  const at = anchorEl(anchor);
  if(!at || !document.body.contains(at)) return false;
  const fr = $('#frame').getBoundingClientRect(), a = at.getBoundingClientRect();
  const w = Math.min(BUBBLE_W, fr.width-24);
  const side = (fr.right-a.right) >= w+BUBBLE_GAP ? 'right'
             : (a.left-fr.left)   >= w+BUBBLE_GAP ? 'left' : null;
  if(!side) return false;
  const maxH = Math.min(fr.height-32, 540);
  const top = clamp(a.top-fr.top-10, 16, Math.max(16, fr.height-maxH-16));
  el.classList.add('bubble', 'from-'+side);
  el.style.width = w+'px';
  el.style.maxHeight = maxH+'px';
  el.style.left = (side==='right' ? a.right-fr.left+BUBBLE_GAP
                                  : a.left-fr.left-BUBBLE_GAP-w)+'px';
  el.style.top = top+'px';
  // the tail points at the middle of the tile, kept inside the bubble's edges
  el.style.setProperty('--tail', clamp(a.top+a.height/2-fr.top-top, 20, maxH-20)+'px');
  return true;
}
/* The tiles move on every render, and the bubble is pinned to one of them.
   Called from render(); does nothing when no panel is up or it isn't a bubble. */
function repositionPanel(){
  const el=$('#panel');
  if(!el || !PANEL.anchor) return;
  el.classList.remove('bubble','from-left','from-right');
  el.removeAttribute('style');
  bubbleAt(el, PANEL.anchor);
}
function drawPanel(fresh){
  const s=PANEL.spec, el=$('#panel'); if(!s||!el) return;
  el.querySelector('.ptop').innerHTML =
    `<div class="pt"><b>${s.title}</b>${s.sub?`<i>${s.sub}</i>`:''}</div>
     ${s.act||''}<button class="iconbtn" data-act="panelclose" title="Close">${ic('x',15)}</button>`;
  const b=el.querySelector('.pbody'), at=fresh?0:b.scrollTop;
  b.innerHTML = typeof s.body==='function' ? s.body() : s.body;
  b.scrollTop = at;
}
/* Redraw what is open, from state. Safe to call when nothing is. */
function refreshPanel(){ if($('#panel')) drawPanel(false); }
const panelKey = ()=>{ const p=$('#panel'); return p ? p.dataset.panel : null; };
function closePanel(){
  const p=$('#panel'); if(p) p.remove();
  PANEL.spec=null; PANEL.draft=null; PANEL.anchor=null; pending.cell=null;
}
// what a form in a panel is building, before it is saved
const draft = ()=> PANEL.draft;

/* A small menu hung off the button that opened it, rather than a modal in the
   middle of the screen. It borrows the context menu's element and its styling,
   because a menu is a menu wherever it was summoned from. */
function openMenu(anchor, html){
  const el=$('#ctx');
  el.innerHTML=html;
  el.classList.add('open');                 // measurable only once it is shown
  const r=$('#frame').getBoundingClientRect(), a=anchor.getBoundingClientRect();
  el.style.left = clamp(a.right-r.left-el.offsetWidth, 6, Math.max(6, r.width-el.offsetWidth-6))+'px';
  el.style.top  = clamp(a.bottom-r.top+6,              6, Math.max(6, r.height-el.offsetHeight-6))+'px';
}

/* Every type falls in exactly one group. `scene` used to be listed under both
   Writing and Film, because the two filters were written independently. */
function pickGroups(){
  const g={Containers:[], Objects:[], Writing:[], Cooking:[], Film:[], Yours:[]};
  KEYS.forEach(k=>{
    // 'control' isn't offered — Bureau's own buttons are seeded, not made
    if(k==='control') return;
    const d=KINDS[k];
    if(S.kinds[k])                    g.Yours.push(k);
    else if(d.narrative)              g.Writing.push(k);
    else if(d.cooking)                g.Cooking.push(k);
    else if(d.film)                   g.Film.push(k);
    else if(kindHas(k,'container'))   g.Containers.push(k);
    else                              g.Objects.push(k);
  });
  const note={Containers:'hold other things', Objects:'hold nothing',
              Writing:'for a world you are making', Yours:'ones you made'};
  return Object.entries(g).filter(([,ks])=>ks.length)
    .map(([nm,ks])=>({nm, ks, note:note[nm]||''}));
}
/* A type is shown as the thing it makes, not as an icon standing in for it —
   the sample sits on the panel with nothing around it, and its name floats
   underneath, because a card drawn around a card reads as two objects.
   The dial in the corner opens the type editor — the right-click that used to
   be the only way in doesn't exist on a phone. */
function kindTile(k){
  const d=KINDS[k];
  return `<div class="kindtile" data-new="${k}" role="button" tabindex="0"
      style="--k:${d.c}" title="${esc(d.ds||'')}">
    <div class="kpv">${sampleTile(kindSample(k), 146, 82)}</div>
    <div class="krow"><span class="nm">${esc(d.nm)}</span>
      ${d.key?`<span class="kbd">${esc(d.key)}</span>`:''}</div>
    <button class="kedit" data-act="editkind" data-id="${k}" title="Edit ${esc(d.nm)}">${ic('sliders',12)}</button>
  </div>`;
}
function modalNewObject(){
  openPanel({
    key:'newobject', wide:true, title:'New object',
    sub:'Every type is drawn as the thing it makes',
    act:`<button class="pill" data-act="newkind">${ic('sparkle',13)} New type</button>`,
    body:()=> pickGroups().map(g=>`
      <div class="section-h"><h2>${g.nm}</h2><div class="rule"></div>${g.note?`<span class="n">${g.note}</span>`:''}</div>
      <div class="kindgrid">${g.ks.map(kindTile).join('')}</div>`).join('')
  });
}
/* The set colours, plus whatever custom colour is in use. Split into rows by
   family where there is room for it, and run together as one block where there
   isn't — five four-wide rows is a lot of height to spend on a colour. */
function swatchRows(cur, flat){
  const one=([c,nm])=>`<button data-col="${c}" title="${nm}" class="${cur===c?'on':''}" style="background:${c}"></button>`;
  const all=Object.values(SWATCHES).flat();
  const custom = all.some(([c])=>c===cur) ? '' : one([cur,'Custom']);
  if(flat) return `<div class="pickgrid sw">${all.map(one).join('')}${custom}</div>`;
  return Object.entries(SWATCHES).map(([fam,list])=>
    `<div class="pickgrid sw">${list.map(one).join('')}</div>`).join('')
    + (custom?`<div class="pickgrid sw">${custom}</div>`:'');
}
/* An object's settings: everything applies as you click it, so the object
   changes while you watch. The body is a function, so the marks follow a
   change without the handler having to rebuild the panel itself. */
function objectPanel(id){
  const o=byId(id); if(!o) return;
  openPanel({key:'object:'+id, anchor:id, title:esc(o.title||'Untitled'),
    body:()=>objectPanelBody(id)});
}
function objectPanelBody(id){
  const o=byId(id); if(!o) return '';
  const row=(label,body)=>`<div class="prow"><label>${label}</label><div>${body}</div></div>`;
  return `
    ${row('Type', KEYS.filter(k=>!kindHas(k,'container')&&true).map(k=>
      `<button class="pchip${o.kind===k?' on':''}" data-otype="${k}" data-id="${id}">${KINDS[k].nm}</button>`).join(''))}
    ${row('Shape', Object.entries(SHAPES).map(([v,n])=>
      `<button class="pchip${shapeOf(o)===v?' on':''}" data-oshape="${v}" data-id="${id}">${n}</button>`).join(''))}
    ${row('Edge', [['','None'],['1','Coloured']].map(([v,n])=>
      `<button class="pchip${(!!o.edge===!!v)?' on':''}" data-oedge="${v}" data-id="${id}">${n}</button>`).join(''))}
    ${row('Clicking it', Object.entries(CLICKS).map(([v,n])=>
      `<button class="pchip${clickOf(o)===v?' on':''}" data-oclick="${v}" data-id="${id}">${n}</button>`).join(''))}
    ${row('Opens as', Object.entries(READS).map(([v,n])=>
      `<button class="pchip${readOf(o)===v?' on':''}" data-oread="${v}" data-id="${id}">${n}</button>`).join(''))}
    ${row('Colour', `<div class="pickgrid sw">${paletteNow().cols.map(c=>
      `<button data-ocolour="${c}" data-id="${id}" class="${o.c===c?'on':''}" style="background:${c}"></button>`).join('')}</div>`)}
    ${has(o,'media')&&o.media&&o.media.type==='image'
      ? row('Frame', [['none','None'],['mount','Mount'],['gilt','Gilt'],['walnut','Walnut'],['black','Lacquer'],['polaroid','Instant']].map(([v,n])=>
          `<button class="pchip${(o.frame||'none')===v?' on':''}" data-oframe="${v}" data-id="${id}">${n}</button>`).join('')) : ''}
    ${(has(o,'spawn')||clickOf(o)==='generate') ? row('Makes', KEYS.filter(k=>true&&!kindHas(k,'generator')).slice(0,14).map(k=>
        `<button class="pchip${genKindOf(o)===k?' on':''}" data-ogen="${k}" data-id="${id}">${KINDS[k].nm}</button>`).join('')) : ''}
    ${(has(o,'spawn')||clickOf(o)==='generate') ? row('Direction', [['down','Down'],['up','Up'],['left','Left'],['right','Right'],['random','Anywhere']].map(([v,n])=>
        `<button class="pchip${(o.genDir||'down')===v?' on':''}" data-ogendir="${v}" data-id="${id}">${n}</button>`).join('')) : ''}
    ${has(o,'button')
      ? row('Button shape', [['rounded','Rounded'],['round','Round'],['square','Square']].map(([v,n])=>
          `<button class="pchip${(o.btnshape||'rounded')===v?' on':''}" data-obtn="${v}" data-id="${id}">${n}</button>`).join('')) : ''}
    <div class="pfoot">
      <button class="pill" data-act="attrsheet" data-id="${id}">${ic('sliders',13)} Attributes</button>
      <button class="pill" data-act="editthis" data-id="${id}">${ic('edit',13)} Open editor</button>
    </div>`;
}

/* A drawer's own settings, beside the grid it arranges. */
/* The gear in the bar opens this for the drawer you are *inside*, whose tile is
   nowhere on screen — anchorEl() finds nothing and it falls back to the edge
   panel, which is right: that question is about the whole board. */
function drawerPanel(id){
  const d=container(id); if(!d) return;
  openPanel({key:'drawer:'+id, anchor:id===ROOT?null:id,
    title:esc(id===ROOT?deskTitle():(d.title||'Untitled')),
    body:()=>drawerPanelBody(id)});
}
function drawerPanelBody(id){
  const d=container(id), isRoot=id===ROOT;
  if(!d) return '';
  const cfg=cfgOf(id);
  const row=(label,body)=>`<div class="prow"><label>${label}</label><div>${body}</div></div>`;
  const chips=(name,val,list,cur)=>list.map(([v,n])=>
    `<button class="pchip${cur===v?' on':''}" data-p${name}="${v}" data-id="${id}">${n}</button>`).join('');
  // the desk has no type to fall back on, so it is the only one read from cfg alone
  const view = isRoot ? (cfg.layout||'grid') : layoutOf(d);
  return `
    ${row('View', chips('view', null, [['grid','Grid'],['list','List'],['scroll','Scroll'],
        ...(isRoot?[]:[['checklist','Checklist'],['book','Book'],['calendar','Calendar'],['timeline','Timeline']])], view))}
    ${isRoot?'':row('Face', chips('face', null, Object.entries(FACES), faceOf(d)))}
    ${/* only a calendar is asked what a calendar wants to know */''}
    ${(!isRoot && (view==='calendar' || faceOf(d)==='calendar')) ? `
      ${row('Shows', chips('calview', null, Object.entries(CALVIEWS), calViewOf(d)))}
      ${row('Week starts', chips('weekstart', null, [['mon','Monday'],['sun','Sunday']], weekStartOf(d)))}
      ${row('Weekends', chips('weekends', null, [['1','Shown'],['','Hidden']], showsWeekends(d)?'1':''))}` : ''}
    ${(!isRoot && takesTyping(d)) ? row('Typing in it makes',
      KEYS.filter(k=>!kindHas(k,'container')&&k!=='control').map(k=>
        `<button class="pchip${genKindOf(d)===k?' on':''}" data-pgen="${k}" data-id="${id}">${KINDS[k].nm}</button>`).join('')) : ''}
    ${row('Sort', chips('sort', null, [['','Custom'],...Object.entries(SORTS).map(([k,[nm]])=>[k,nm])], cfg.sort||''))}
    ${row('Locked', chips('lock', null, [['','Movable'],['1','Locked']], cfg.locked?'1':''))}
    ${isRoot?'':row('On the bar', chips('pin', null, [['','No'],['1','Pinned']], isPinned(id)?'1':''))}
    ${isRoot?'':`
      ${row('Border', chips('border', null, [['panel','Panelled'],['heavy','Heavy panel'],['bar','Bar'],['aqua','Aqua'],['plain','Plain'],['none','None']], d.border||'none'))}
      ${row('Knob', chips('knob', null, [['round','Round'],['diamond','Diamond'],['bar','Bar'],['ring','Ring'],['square','Square'],['orb','Orb']], d.knob||'round'))}
      ${row('Front', `<div class="pickgrid sw">${Object.values(SWATCHES).flat().slice(0,12).map(([c,nm])=>
          `<button data-pcolour="${c}" data-id="${id}" title="${nm}" class="${d.c===c?'on':''}" style="background:${c}"></button>`).join('')}</div>`)}
      ${row('Board', `<div class="pickgrid sw">${[0,1,2,3,4,5].map(()=>randomBoard()).map(b=>{
          const [a,z]=b.split('|');
          return `<button data-pboard="${b}" data-id="${id}" style="background:linear-gradient(135deg,${a} 0 50%,${z} 50% 100%)"></button>`;}).join('')}
          <button data-pboard="" data-id="${id}" title="Use the desk's board" class="${d.board?'':'on'}"
            style="background:var(--paper);border-style:dashed"></button></div>`)}
      ${row('Board strength', `<input class="pslide" type="range" min="0" max="100" step="5"
          value="${Math.round(((d.boardAlpha==null?1:d.boardAlpha))*100)}" data-palpha data-id="${id}">`)}
      ${row('Texture', chips('texture', null, [['none','None'],['dots','Dots'],['grid','Graph'],['weave','Weave'],['weave2','Wide weave'],['check','Checker'],['rule','Ruled'],['stars','Stars'],['sheen','Sheen']], d.texture||'none'))}
      ${row('Knob position', chips('knobpos', null, [['centre','Centre'],['bottom','Bottom']], d.knobpos||'centre'))}
      ${row('Knob colour', chips('knobtone', null, [['light','Lighter'],['dark','Darker']], d.knobtone||'light')
        + `<div class="pickgrid sw" style="margin-top:5px">${
          ['#F8F3E6','#A9793F','#2A241C','#C0563F','#3E7A6B','#5D7E99'].map(c=>
          `<button data-pknobc="${c}" data-id="${id}" class="${d.knobc===c?'on':''}" style="background:${c}"></button>`).join('')}</div>`)}
      <div class="pfoot"><button class="pill" data-act="panelmore" data-id="${id}">Name, rule and totals…</button></div>`}`;
}

function modalDrawer(id){
  const d = id? byId(id) : {id:'', title:'', c:'#4A7C59', pv:'list', layout:'list', filter:{kinds:[]}};
  const ks=((d.filter||{}).kinds||[]);
  openPanel({
    key:'drawerform', title:id?'Edit drawer':'New drawer',
    sub:`What it collects, and what it prints on its front`,
    draft:{c:d.c, pv:d.pv, kinds:ks.slice(), layout:d.layout||'grid', tag:(d.filter||{}).tag||'',
           locked:!!d.locked, border:d.border||'panel', knob:d.knob||'round', knobc:d.knobc||''},
    body:`
    <div class="field" style="margin-bottom:10px"><label>Name</label><input id="dnm" value="${esc(d.title||'')}" placeholder="Reading Pile"></div>
    <div class="field" style="margin-bottom:10px"><label>Colour</label>
      <div id="dcol" style="margin-top:6px">${swatchRows(d.c)}
        <label class="custcol"><input type="color" data-colinput value="${d.c}">
          <span>Custom colour</span></label>
      </div></div>
    <div class="field" style="margin-bottom:10px"><label>Automatically collects these types</label>
      <div class="filterbar" id="dkinds" style="flex-wrap:wrap;padding-top:6px">${KEYS.map(k=>
        `<button class="fchip${ks.includes(k)?' on':''}" data-kk="${k}" style="--k:${KINDS[k].c}">${KINDS[k].nm}</button>`).join('')}</div></div>
    <div class="field" style="margin-bottom:10px"><label>…and matching</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px">
        <select id="rf"><option value="">Any field</option>${Object.keys(FIELDS).map(a=>
          `<option value="${a}"${(d.filter&&d.filter.rule&&d.filter.rule.f)===a?' selected':''}>${FIELDS[a].nm}</option>`).join('')}</select>
        <select id="rop">${Object.entries(OPS).map(([v,n])=>
          `<option value="${v}"${(d.filter&&d.filter.rule&&d.filter.rule.op)===v?' selected':''}>${n}</option>`).join('')}</select>
        <input id="rv" placeholder="value" value="${esc((d.filter&&d.filter.rule&&d.filter.rule.v)||'')}" style="flex:1;min-width:90px">
      </div></div>
    <div class="field" style="margin-bottom:10px"><label>Show a total</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px">
        <select id="rlfn"><option value="">Nothing</option>${Object.entries(ROLLS).map(([v,n])=>
          `<option value="${v}"${(d.roll&&d.roll.fn)===v?' selected':''}>${n}</option>`).join('')}</select>
        <select id="rlf"><option value="">—</option>${Object.keys(FIELDS).map(a=>
          `<option value="${a}"${(d.roll&&d.roll.f)===a?' selected':''}>${FIELDS[a].nm}</option>`).join('')}</select>
      </div></div>
    <div class="field" style="margin-bottom:10px"><label>…and anything tagged</label>
      <div class="filterbar" id="dtag" style="flex-wrap:wrap;padding-top:6px">
        <button class="fchip${!(d.filter||{}).tag?' on':''}" data-dtag="">Any tag</button>
        ${allTags().slice(0,14).map(([t])=>
          `<button class="fchip${(d.filter||{}).tag===t?' on':''}" data-dtag="${esc(t)}">#${esc(t)}</button>`).join('')}</div></div>
    <div class="field"><label>Preview style</label>
      <div class="filterbar" id="dpv" style="padding-top:6px">${[['list','List'],['stack','Card stack'],['thumbs','Thumbnails'],['bars','Progress bars'],['big','Big number']].map(([v,n])=>
        `<button class="fchip${d.pv===v?' on':''}" data-pv="${v}">${n}</button>`).join('')}</div></div>
    <div class="pfoot" style="display:flex;gap:8px">
      <button class="pill solid" data-act="savedrawer" data-id="${id||''}">${id?'Save':'Create drawer'}</button>
      <button class="pill" data-act="cancel">Cancel</button>
      ${id?`<button class="pill" data-act="deldrawer" data-id="${id}" style="margin-left:auto;color:#C0563F">Delete</button>`:''}
    </div>`
  });
}
/* Make a kind by choosing attributes. `from` is an object whose attributes seed
   the picker — "save these attributes as a new kind" from the detail sheet. */
/* Also the kind *editor*. `editKey` names an existing kind — built-in or one of
   yours — and saving writes an override into S.kinds, so a built-in can be
   changed without touching the source. */
/* A throwaway object, drawn through the same gridTile() the board uses, so a
   preview cannot drift from what you will actually get — if it renders wrong
   here it renders wrong there. It never enters S; only the renderer sees it. */
function sampleObject(spec){
  const a=(spec.attrs||['text']).slice();
  const [w,h]=spec.size||[4,4];
  return {
    id:spec.id||'__sample', kind:spec.kind||'note',
    title:spec.title||'Untitled',
    body:spec.body!=null?spec.body:'A line or two of whatever it holds, so you can see how it sits.',
    attrs:a, shape:spec.shape, face:spec.face,
    c:spec.c, parent:ROOT, tags:[], ord:0, created:T,
    /* Both layouts, or lay() reads the empty one on a phone-width window and
       ensureBox quietly fills it from the fallback kind's size instead — and
       the phone one goes through the same mapping a real object would, so the
       sample stays a picture of what you are actually about to get. */
    desk:{x:1,y:1,w,h},
    phone:(([pw,ph])=>({x:1,y:1,w:pw,h:ph}))(spec.phoneSize || toPhoneSize(w, h, a.includes('container'))),
    onclick:spec.onclick, spawnBy:spec.spawnBy, genKind:'task', genDir:'down',
    ...(a.includes('date')     ? {due:T} : {}),
    ...(a.includes('count')    ? {count:12} : {}),
    ...(a.includes('rating')   ? {rating:4} : {}),
    ...(a.includes('priority') ? {prio:'high'} : {}),
    ...(a.includes('price')    ? {price:'12.50'} : {}),
    ...(a.includes('duration') ? {dur:45} : {}),
    ...(a.includes('location') ? {loc:'The shed'} : {}),
    ...(a.includes('streak')   ? {history:[T]} : {history:[]}),
    ...(a.includes('progress') ? {milestones:[{t:'One',done:true},{t:'Two',done:false}]} : {milestones:[]}),
    done:false,
    link:{label:spec.title||'Press', target:''},
    knob:'round', border:'panel', texture:'none', layout:'list'
  };
}
/* A tile is drawn at desk scale and then shrunk to fit the box it is given,
   rather than drawn small. Type sizes inside a tile are in px, so building it
   at 11px a cell wrapped "Drawer" onto two lines — a miniature has to be the
   real thing seen from further away, or it isn't a preview of anything. */
const PV_CELL = 40;
function sampleTile(o, maxW, maxH){
  const b=o[dev()]||o.desk, w=b.w*PV_CELL, h=b.h*PV_CELL;
  const k=Math.min(maxW/w, maxH/h, 1);
  // the geometry is inline because it is computed here, not chosen
  return `<div class="pvscale" aria-hidden="true" style="width:${w*k}px;height:${h*k}px;overflow:hidden">
    <div style="width:${w}px;height:${h}px;transform:scale(${k});transform-origin:top left">
      <div class="grid g-desk pvgrid"
        style="--cols:${b.w};--rowh:${PV_CELL}px;--checker:${2*PV_CELL}px;
               grid-template-rows:repeat(${b.h},${PV_CELL}px);width:${w}px">
        ${gridTile(o,false,ROOT)}</div></div></div>`;
}
// One built-in or invented type, as an object of that type.
const kindSample = k => { const d=K(k); return sampleObject({
  id:'__k_'+k, kind:k, title:d.nm, attrs:d.attrs, shape:d.shape, face:d.face,
  c:d.c, size:d.size, phoneSize:d.phoneSize, onclick:d.onclick, spawnBy:d.spawnBy}); };

/* A live sample of the type being built, from the draft rather than a kind —
   the kind doesn't exist until you press Create. */
function previewObject(){
  const d=draft(); if(!d) return null;
  const nameEl=$('#knm');
  const cont = d.sort!=='object';
  return sampleObject({
    id:'__preview', kind:'note', title:(nameEl&&nameEl.value.trim())||'Untitled',
    attrs:d.attrs, c:d.c, size:d.size, phoneSize:d.phoneSize, onclick:d.onclick, spawnBy:d.spawnBy,
    shape: cont?undefined:(d.shape||'card'),
    face:  cont?(d.face||'front'):undefined
  });
}
function renderPreview(){
  const host=$('#kpreview'); if(!host) return;
  const o=previewObject(); if(!o) return;
  host.innerHTML=sampleTile(o, 230, 170);
}
/* Two sliders and a readout, for a size the presets don't happen to contain.
   `p` prefixes the data attributes so the same markup serves both grids — the
   Mac's 24 columns and the phone's 16, which are different coordinate spaces
   and were never one number. */
function sizeSliders(p, [w,h], cols){
  return `<div class="szrow">
    <span class="s">W</span><input class="pslide" type="range" min="1" max="${cols}" step="1" value="${w}" data-${p}szw>
    <span class="s">H</span><input class="pslide" type="range" min="1" max="20" step="1" value="${h}" data-${p}szh>
    <b id="${p}szout">${w} × ${h}</b></div>`;
}
function modalNewKind(from, editKey){
  const ex = editKey ? K(editKey) : null;
  const base = ex || (from ? K(from.kind) : null);
  const seedAttrs = ex ? (ex.attrs||['text']).slice() : from ? attrsOf(from).slice() : ['text'];
  const c = (base && base.c) || '#5F7A93';
  const isCont = seedAttrs.includes('container');
  const sort = isCont ? (seedAttrs.includes('magic') ? 'magic' : 'drawer') : 'object';
  const size = (base && base.size) || [4,4];
  const phoneSize = (base && base.phoneSize) || null;
  const gathersNow = (base && base.gathers) || '';
  const chip=(on,attrs,label,title)=>`<button class="pchip${on?' on':''}" ${attrs}${title?` title="${esc(title)}"`:''}>${label}</button>`;
  // the id lands on the *inner* div, because that is what the wiring rebuilds
  const row=(label,note,body,id,extra)=>`<div class="prow"${extra||''}>
    <label>${label}${note?`<i>${note}</i>`:''}</label><div${id?` id="${id}"`:''}>${body}</div></div>`;
  // traits that carry a typed value are worth separating: only these can be
  // sorted, filtered or totalled
  const plain = USER_ATTRS.filter(a=>!fieldOf(a));
  const bearing = USER_ATTRS.filter(a=>fieldOf(a));

  openPanel({
    key:'kindform', wide:true, title:ex?'Edit '+esc(ex.nm):'New type',
    sub:'A type is a name for a set of traits',
    draft:{c, attrs:seedAttrs, ic:(base&&base.ic)||'note', ds:'',
           fromId:from&&from.id, editKey:editKey||null,
           size, phoneSize, onclick:(base&&base.onclick)||'read',
           read:(base&&base.read)||'page',
           sort, shape:(base&&base.shape)||'card', face:(base&&base.face)||'front',
           gathers:gathersNow, spawnBy:(base&&base.spawnBy)||'click'},
    body:`
  <div class="kbuild">
    <div class="kleft">
      <div class="pvwrap"><div id="kpreview"></div></div>
      <div class="field"><label>Name</label>
        <input id="knm" value="${ex?esc(ex.nm):(from?esc(K(from.kind).nm)+' variant':'')}" placeholder="Reading note"></div>
      <div class="field"><label>Description</label>
        <input id="kds" value="${ex?esc(ex.ds||''):''}" placeholder="What it's for, in a few words"></div>
      <div class="kacts">
        <button class="pill solid" data-act="savekind" data-id="${editKey||''}">${ex?'Save':'Create type'}</button>
        <button class="pill" data-act="cancel">Cancel</button>
        ${ex&&S.kinds[editKey]?`<button class="pill" data-act="delkind" data-id="${editKey}" style="color:#C0563F">Delete</button>`:''}
        ${ex&&!S.kinds[editKey]?`<button class="pill" data-act="resetkind" data-id="${editKey}">Reset to default</button>`:''}
      </div>
    </div>

    <div class="kright">
      ${row('What it is','',
        chip(sort==='object','data-ksort="object"','Object','Holds nothing')+
        chip(sort==='drawer','data-ksort="drawer"','Drawer','Holds what you file in it')+
        chip(sort==='magic','data-ksort="magic"','Magic drawer','Collects by rule; holds nothing'),
        'ksort')}
      ${row('Look','<span id="klookn">'+(sort==='object'?'shape':'face')+'</span>',
        (sort==='object'?Object.entries(SHAPES):Object.entries(FACES)).map(([v,n])=>
          chip(((base&&(sort==='object'?base.shape:base.face))||(sort==='object'?'card':'front'))===v,
               `data-klook="${v}"`, n)).join(''), 'klook')}
      ${row('Traits','what it can do',
        plain.map(a=>chip(seedAttrs.includes(a),`data-ka="${a}"`,ATTRS[a].nm,ATTRS[a].ds)).join(''), 'kattrs')}
      ${row('Fields','typed, so they sort and total',
        bearing.map(a=>chip(seedAttrs.includes(a),`data-ka="${a}"`,
          `${ATTRS[a].nm} <i>${fieldOf(a).type}</i>`,ATTRS[a].ds)).join(''), 'kfields')}
      <div class="mini" style="--k:var(--brass)" id="kattrsds">${
        esc(seedAttrs.map(a=>ATTRS[a]&&ATTRS[a].ds).filter(Boolean).join(' · '))||'Nothing yet'}</div>

      ${row('Clicking one','',
        Object.entries(CLICKS).map(([v,n])=>chip(((base&&base.onclick)||'read')===v,`data-kclick="${v}"`,n)).join(''),
        'kclick')}
      ${row('Opens as','how one reads',
        Object.entries(READS).map(([v,n])=>chip(((base&&base.read)||'page')===v,`data-kread="${v}"`,n)).join(''),
        'kread', ` id="kreadrow"${sort==='object'?'':' style="display:none"'}`)}
      ${row('Two of them make','dropped on each other',
        chip(!gathersNow,'data-kgather=""','Nothing')+
        KEYS.filter(k=>kindHas(k,'container')&&!kindHas(k,'magic')).map(k=>
          chip(gathersNow===k,`data-kgather="${k}"`,esc(KINDS[k].nm))).join(''),
        'kgather', ` id="kgatherrow"${sort==='object'?'':' style="display:none"'}`)}
      ${row('It spawns','',
        chip(((base&&base.spawnBy)||'click')==='click','data-kspawn="click"','When pressed')+
        chip(((base&&base.spawnBy)||'click')==='type','data-kspawn="type"','As you type in it'),
        'kspawn', ` id="kspawnrow"${seedAttrs.includes('spawn')?'':' style="display:none"'}`)}
      ${row('Starts at','on the Mac grid, 24 columns',
        [[1,1],[4,1],[6,1],[2,2],[4,4],[6,4],[6,6],[8,6],[12,8]].map(([w,h])=>
          chip(size.join('x')===w+'x'+h,`data-ksz="${w}x${h}"`,`${w}×${h}`)).join('')
        + sizeSliders('k', size, GRID.desk.cols), 'ksize')}
      ${row('On a phone','8 columns, and a cell about the same size',
        chip(!phoneSize,'data-kphauto=""','Work it out for me',
             'Objects go full width; containers keep the size they have')
        + sizeSliders('kp', phoneSize||toPhoneSize(size[0],size[1],isCont), GRID.phone.cols), 'kphone')}
      ${row('Colour','',
        `${swatchRows(c,true)}<label class="custcol"><input type="color" data-colinput value="${c}"><span>Custom</span></label>`,
        'dcol')}
      ${row('Mark','',
        ['note','check','list','bulb','feather','book','star','flag','clock','target','image','film','music',
         'pot','clapper','help','folder','sparkle','trophy','archive','tag','plus','edit','inbox'].map(i=>
          `<button class="pchip iconchip${((base&&base.ic)||'note')===i?' on':''}" data-kic="${i}" title="${i}">${ic(i,15)}</button>`).join(''),
        'kicon')}
    </div>
  </div>`
  });
  renderPreview();
}
// Anywhere this object may legally go: any container that is not itself, and
// not inside itself — otherwise a drawer can swallow its own ancestor.
function moveTargets(objId){
  const o=byId(objId);
  return [rootObj()].concat(containers().filter(c=>c.id!==objId && !has(c,'magic') && !(o&&isAncestor(objId,c))));
}
function modalMove(objId){
  openPanel({key:'move', title:'Move to drawer',
    sub:'Filing by hand always wins over a drawer&rsquo;s rule',
    body:()=>`<div class="rows">${moveTargets(objId).map(d=>
      `<div class="row" data-moveto="${objId}:${d.id}" style="--k:${d.c||K(d.kind).c}"><span class="kindmark">${ic('folder',13)}</span>
        <div class="body"><div class="title">${esc(d.title)}</div><div class="snip">${childrenOf(d).length} objects</div></div></div>`).join('')}</div>`});
}

/* ============================================================
   17 · command palette
   ============================================================ */
function openCmd(){ $('#cmdscrim').classList.add('open'); $('#cmdinput').value=''; cmdList(''); setTimeout(()=>$('#cmdinput').focus(),30); }
function closeCmd(){ $('#cmdscrim').classList.remove('open'); if(document.activeElement&&document.activeElement.blur) document.activeElement.blur(); }
function cmdList(q){
  q=q.trim().toLowerCase();
  const res=[];
  // The desk is the only place. Settings is a sheet over it, not somewhere
  // you go; Today, Keeping Up and Everything were aggregations, so make a
  // magic drawer if you want one of those back.
  if(!q||'the desk'.includes(q))
    res.push({t:'The Desk',s:'view',c:'var(--brass)',i:'grid',go:()=>{S.view='desk';S.drawerId=null;}});
  if(!q||'settings'.includes(q))
    res.push({t:'Settings',s:'panel',c:'var(--brass)',i:'sliders',go:()=>settingsPanel()});
  containers().forEach(d=>{ if(!q||(d.title||'').toLowerCase().includes(q)) res.push({t:d.title,s:'drawer',c:d.c||K(d.kind).c,i:'folder',go:()=>{S.view='drawer';S.drawerId=d.id;}}); });
  S.objects.forEach(o=>{ if(q&&((o.title||'').toLowerCase().includes(q)||(o.body||'').toLowerCase().includes(q)))
    res.push({t:o.title||'Untitled',s:K(o.kind).nm,c:K(o.kind).c,i:K(o.kind).ic,go:()=>openObj(o.id)}); });
  if(q) res.unshift({t:`Create task “${q}”`,s:'new',c:KINDS.task.c,i:'plus',go:()=>{const o=quickAdd(q,'task');openObj(o.id);}});
  cmdList._res=res.slice(0,40);
  $('#cmdlist').innerHTML = cmdList._res.map((r,i)=>
    `<div class="cmdrow${i===0?' on':''}" data-cmd="${i}" style="--k:${r.c}"><span class="ic">${ic(r.i,13)}</span>${esc(r.t)}<span class="sub">${r.s}</span></div>`).join('')
    || `<div class="cmdrow">No matches</div>`;
}
function runCmd(i){ const r=(cmdList._res||[])[i]; if(!r) return; closeCmd(); r.go(); render(); renderSheet(); }

/* ============================================================
   18 · context menu
   ============================================================ */
/* Sweep the selection (or one object) into a brand-new drawer, made where they
   already are. The drawer takes the place of the first one, which is the least
   surprising spot for it to appear. */
function drawerFromSelection(id){
  const sel = S.sel.includes(id) ? S.sel.slice() : [id];
  const objs = sel.map(byId).filter(Boolean);
  if(!objs.length) return;
  const home = objs[0].parent || ROOT;
  const spot = lay(objs[0]);
  const d = {
    id:uid('d'), kind:'drawer', title:'New drawer', body:'', tags:[],
    parent:home, c:randomFront(), pv:'list', layout:'grid', filter:{}, board:randomBoard(),
    ord:0, created:T,
    desk:null, phone:null
  };
  S.objects.push(d);
  objs.forEach(o=>{ o.parent=d.id; o.desk=null; o.phone=null; });
  // now that its contents have moved out, the first object's old spot is free —
  // and the drawer arrives at the size a drawer starts at, not a hardcoded one
  const [dw,dh]=sizeOfKind('drawer', dev());
  d[dev()] = boxOk({x:spot.x,y:spot.y,w:dw,h:dh}, d.id, dev(), home)
    ? {x:spot.x,y:spot.y,w:dw,h:dh} : freeSpot(dw,dh,dev(),home);
  S.sel=[];
  save(); render();
  toast(`${objs.length} filed in a new drawer`);
  modalDrawer(d.id);
}

function openCtx(x,y,id){
  const o=byId(id); if(!o) return;
  const el=$('#ctx');
  // If a selection is open and this object is part of it, the menu acts on all
  // of them — the same way a Finder context menu does.
  const sel = S.sel.includes(id) ? S.sel.slice() : [id];
  const many = sel.length>1;
  el.innerHTML=`
    ${many?`<div class="ctxhead">${sel.length} objects</div>` : ''}
    ${many?'' : (isContainer(o)
      ? `<button data-c="drawerset:${id}">${ic('sliders',14)} Drawer settings</button>
         <button data-c="opendrawer:${id}">${ic('eye',14)} Open</button>
         <button data-c="pin:${id}">${ic('star',14)} ${isPinned(id)?'Take off the bar':'Pin to the bar'}</button>`
      : `<button data-c="objset:${id}">${ic('sliders',14)} Object settings</button>
         <button data-c="read:${id}">${ic('eye',14)} Read</button>
         <button data-c="open:${id}">${ic('edit',14)} Edit…</button>`)}
    ${(!many&&(has(o,'check')||has(o,'streak')))?`<button data-c="done:${id}">${ic('check',14)} ${has(o,'streak')?'Mark today':'Complete'}</button>`:''}
    <button data-c="intodrawer:${id}">${ic('folder',14)} ${many?`Put these ${sel.length} in a new drawer`:'Put this in a new drawer'}</button>
    <button data-c="move:${id}">${ic('folder',14)} Move to drawer…</button>
    ${many?'':`<button data-c="today:${id}">${ic('calendar',14)} Schedule today</button>
    <button data-c="dupe:${id}">${ic('archive',14)} Duplicate</button>`}
    <div class="div"></div>
    <button class="danger" data-c="del:${id}">${ic('trash',14)} ${many?`Delete ${sel.length}`:'Delete'}</button>`;
  const r=$('#frame').getBoundingClientRect();
  el.classList.add('open');
  const w=el.offsetWidth,h=el.offsetHeight;
  el.style.left = clamp(x-r.left, 6, r.width-w-6)+'px';
  el.style.top  = clamp(y-r.top,  6, r.height-h-6)+'px';
}
const closeCtx = ()=> $('#ctx').classList.remove('open');

export { overlayHTML, openPanel, closePanel, refreshPanel, repositionPanel, panelKey, draft,
  openMenu, modalNewObject, objectPanel, drawerPanel, modalDrawer, modalNewKind,
  renderPreview, modalMove, sampleObject, sampleTile, kindSample,
  openCmd, closeCmd, cmdList, runCmd, drawerFromSelection, openCtx, closeCtx };
