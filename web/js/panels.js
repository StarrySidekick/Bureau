import { $, $$, esc, ic, uid, clamp, ROOT } from './util.js';
import { S, K, KINDS, KEYS, T, ATTRS, USER_ATTRS, FIELDS, fieldOf, OPS, ROLLS,
  SORTS, FACES, SHAPES, faceOf, shapeOf, byId, container, cfgOf, deskTitle,
  rootObj, containers, isContainer, isAncestor, childrenOf, has, kindHas,
  attrsOf, allTags, dev } from './model.js';
import { lay, boxOk, freeSpot } from './grid.js';
import { SWATCHES, paletteNow, randomBoard, randomFront } from './look.js';
import { CLICKS, clickOf, gridTile, pending } from './tiles.js';
import { quickAdd, toast } from './mutations.js';
import { openObj, renderSheet } from './sheet.js';
import { render } from './views.js';
import { save } from './persist.js';

/* ============================================================
   16 · overlays
   ============================================================ */
function overlayHTML(){
  return `
  <div class="scrim" id="scrim"><div class="modal" id="modal"></div></div>
  <div class="scrim" id="cmdscrim"><div class="modal cmd">
    <input class="cmdinput" id="cmdinput" placeholder="Search objects, drawers, kinds…">
    <div class="cmdlist" id="cmdlist"></div></div></div>
  <div class="toast" id="toast"></div>
  <div class="ctxmenu" id="ctx"></div>
  <div id="sheetHost"></div>
  <input type="file" id="importer" accept="application/json,.json" class="hidden">
  <input type="file" id="imgpicker" accept="image/*" class="hidden">`;
}
function showModal(html){ $('#modal').innerHTML=html; $('#scrim').classList.add('open'); }
function hideModal(){ $('#scrim').classList.remove('open'); pending.cell=null; }

function modalNewObject(){
  // 'control' isn't offered here — Bureau's own buttons are seeded, not made.
  const offer=KEYS.filter(k=>true);
  showModal(`<div class="modal-h"><div class="t">New object</div>
    <div class="s">Pick a type — each comes with its own attributes and template. Right-click one to edit it.</div></div>
  <div class="modal-b">
    <div class="section-h"><h2>Containers</h2><div class="rule"></div><span class="n">hold other things</span></div>
    <div class="kindgrid">
    ${offer.filter(k=>kindHas(k,'container')&&!KINDS[k].cooking).map(k=>`<button class="kindtile" data-new="${k}" style="--k:${KINDS[k].c}">
      <div style="display:flex;align-items:center;width:100%;gap:6px"><span class="ic">${ic(KINDS[k].ic,15)}</span><span class="kbd">${KINDS[k].key||''}</span></div>
      <div class="nm">${KINDS[k].nm}</div><div class="ds">${KINDS[k].ds}</div></button>`).join('')}
    </div>
    <div class="section-h"><h2>Narrative</h2><div class="rule"></div><span class="n">for writing a world</span></div>
    <div class="kindgrid">
    ${offer.filter(k=>!kindHas(k,'container')&&KINDS[k].narrative).map(k=>`<button class="kindtile" data-new="${k}" style="--k:${KINDS[k].c}">
      <div style="display:flex;align-items:center;width:100%;gap:6px"><span class="ic">${ic(KINDS[k].ic,15)}</span><span class="kbd">${KINDS[k].key||''}</span></div>
      <div class="nm">${KINDS[k].nm}</div><div class="ds">${KINDS[k].ds}</div></button>`).join('')}
    </div>
    <div class="section-h"><h2>Cooking</h2><div class="rule"></div></div>
    <div class="kindgrid">
    ${offer.filter(k=>KINDS[k].cooking).map(k=>`<button class="kindtile" data-new="${k}" style="--k:${KINDS[k].c}">
      <div style="display:flex;align-items:center;width:100%;gap:6px"><span class="ic">${ic(KINDS[k].ic,15)}</span><span class="kbd">${KINDS[k].key||''}</span></div>
      <div class="nm">${KINDS[k].nm}</div><div class="ds">${KINDS[k].ds}</div></button>`).join('')}
    </div>
    <div class="section-h"><h2>Film</h2><div class="rule"></div></div>
    <div class="kindgrid">
    ${offer.filter(k=>KINDS[k].film).map(k=>`<button class="kindtile" data-new="${k}" style="--k:${KINDS[k].c}">
      <div style="display:flex;align-items:center;width:100%;gap:6px"><span class="ic">${ic(KINDS[k].ic,15)}</span><span class="kbd">${KINDS[k].key||''}</span></div>
      <div class="nm">${KINDS[k].nm}</div><div class="ds">${KINDS[k].ds}</div></button>`).join('')}
    </div>
    <div class="section-h"><h2>Objects</h2><div class="rule"></div><span class="n">hold nothing</span></div>
    <div class="kindgrid">
    ${offer.filter(k=>!kindHas(k,'container')&&!KINDS[k].narrative&&!KINDS[k].cooking&&!KINDS[k].film).map(k=>`<button class="kindtile" data-new="${k}" style="--k:${KINDS[k].c}">
      <div style="display:flex;align-items:center;width:100%;gap:6px"><span class="ic">${ic(KINDS[k].ic,15)}</span><span class="kbd">${KINDS[k].key||''}</span></div>
      <div class="nm">${KINDS[k].nm}</div><div class="ds">${KINDS[k].ds}</div></button>`).join('')}
    <button class="kindtile newkind" data-act="newkind" style="--k:var(--brass)">
      <div style="display:flex;align-items:center;width:100%;gap:6px"><span class="ic">${ic('sparkle',15)}</span></div>
      <div class="nm">New type…</div><div class="ds">Invent one by choosing attributes</div></button>
  </div>
  ${Object.keys(S.kinds).length?`<div class="section-h"><h2>Your types</h2><div class="rule"></div></div>
    <div class="filterbar" style="flex-wrap:wrap">${Object.keys(S.kinds).map(k=>
      `<button class="fchip" data-act="delkind" data-id="${k}" style="--k:${KINDS[k].c}">${esc(KINDS[k].nm)} ✕</button>`).join('')}</div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">Tap one to remove it. A type still in use can't be removed.</div>`:''}
  </div>`);
}
// The set colours, in rows by family, plus whatever custom colour is in use.
function swatchRows(cur){
  const known=Object.values(SWATCHES).flat().some(([c])=>c===cur);
  return Object.entries(SWATCHES).map(([fam,list])=>
    `<div class="pickgrid sw">${list.map(([c,nm])=>
      `<button data-col="${c}" title="${nm}" class="${cur===c?'on':''}" style="background:${c}"></button>`).join('')}</div>`
  ).join('') + (known?'':`<div class="pickgrid sw"><button data-col="${cur}" class="on" title="Custom" style="background:${cur}"></button></div>`);
}
/* The drawer's own settings, as a panel beside the grid rather than a sheet
   over it — everything applies as you click it, so the drawer changes while
   you watch. The full form is still a click away for the rule and the name. */
function closePanel(){ const p=$('#panel'); if(p) p.remove(); }
/* The same idea for an object: a panel beside it rather than a sheet over it,
   so a colour or a type change is visible the moment you click it. */
function objectPanel(id){
  closePanel();
  const o=byId(id); if(!o) return;
  const row=(label,body)=>`<div class="prow"><label>${label}</label><div>${body}</div></div>`;
  const html=`<div class="panel" id="panel">
    <div class="ptop"><b>${esc(o.title||'Untitled')}</b>
      <button class="iconbtn" data-act="panelclose" title="Close">${ic('x',15)}</button></div>
    ${row('Type', KEYS.filter(k=>!kindHas(k,'container')&&true).map(k=>
      `<button class="pchip${o.kind===k?' on':''}" data-otype="${k}" data-id="${id}">${KINDS[k].nm}</button>`).join(''))}
    ${row('Shape', Object.entries(SHAPES).map(([v,n])=>
      `<button class="pchip${shapeOf(o)===v?' on':''}" data-oshape="${v}" data-id="${id}">${n}</button>`).join(''))}
    ${row('Edge', [['','None'],['1','Coloured']].map(([v,n])=>
      `<button class="pchip${(!!o.edge===!!v)?' on':''}" data-oedge="${v}" data-id="${id}">${n}</button>`).join(''))}
    ${row('Clicking it', Object.entries(CLICKS).map(([v,n])=>
      `<button class="pchip${clickOf(o)===v?' on':''}" data-oclick="${v}" data-id="${id}">${n}</button>`).join(''))}
    ${row('Colour', `<div class="pickgrid sw">${paletteNow().cols.map(c=>
      `<button data-ocolour="${c}" data-id="${id}" class="${o.c===c?'on':''}" style="background:${c}"></button>`).join('')}</div>`)}
    ${has(o,'media')&&o.media&&o.media.type==='image'
      ? row('Frame', [['none','None'],['mount','Mount'],['gilt','Gilt'],['walnut','Walnut'],['black','Lacquer'],['polaroid','Instant']].map(([v,n])=>
          `<button class="pchip${(o.frame||'none')===v?' on':''}" data-oframe="${v}" data-id="${id}">${n}</button>`).join('')) : ''}
    ${(has(o,'spawn')||clickOf(o)==='generate') ? row('Makes', KEYS.filter(k=>true&&!kindHas(k,'generator')).slice(0,14).map(k=>
        `<button class="pchip${(o.genKind||'task')===k?' on':''}" data-ogen="${k}" data-id="${id}">${KINDS[k].nm}</button>`).join('')) : ''}
    ${(has(o,'spawn')||clickOf(o)==='generate') ? row('Direction', [['down','Down'],['up','Up'],['left','Left'],['right','Right'],['random','Anywhere']].map(([v,n])=>
        `<button class="pchip${(o.genDir||'down')===v?' on':''}" data-ogendir="${v}" data-id="${id}">${n}</button>`).join('')) : ''}
    ${has(o,'button')
      ? row('Button shape', [['rounded','Rounded'],['round','Round'],['square','Square']].map(([v,n])=>
          `<button class="pchip${(o.btnshape||'rounded')===v?' on':''}" data-obtn="${v}" data-id="${id}">${n}</button>`).join('')) : ''}
    <div class="pfoot">
      <button class="pill" data-act="attrsheet" data-id="${id}">${ic('sliders',13)} Attributes</button>
      <button class="pill" data-act="editthis" data-id="${id}">${ic('edit',13)} Open editor</button>
    </div>
  </div>`;
  $('#frame').insertAdjacentHTML('beforeend', html);
}

function drawerPanel(id){
  closePanel();
  const d=container(id), isRoot=id===ROOT;
  const cfg=cfgOf(id);
  const row=(label,body)=>`<div class="prow"><label>${label}</label><div>${body}</div></div>`;
  const chips=(name,val,list,cur)=>list.map(([v,n])=>
    `<button class="pchip${cur===v?' on':''}" data-p${name}="${v}" data-id="${id}">${n}</button>`).join('');
  const html=`<div class="panel" id="panel">
    <div class="ptop"><b>${esc(isRoot?deskTitle():d.title)}</b>
      <button class="iconbtn" data-act="panelclose" title="Close">${ic('x',15)}</button></div>
    ${row('View', chips('view', null, [['grid','Grid'],['list','List'],['scroll','Scroll'],
        ...(isRoot?[]:[['checklist','Checklist'],['calendar','Calendar']])], cfg.layout||'grid'))}
    ${isRoot?'':row('Face', chips('face', null, Object.entries(FACES), faceOf(d)))}
    ${row('Sort', chips('sort', null, [['','Custom'],...Object.entries(SORTS).map(([k,[nm]])=>[k,nm])], cfg.sort||''))}
    ${row('Locked', chips('lock', null, [['','Movable'],['1','Locked']], cfg.locked?'1':''))}
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
      <div class="pfoot"><button class="pill" data-act="panelmore" data-id="${id}">All settings…</button></div>`}
  </div>`;
  $('#frame').insertAdjacentHTML('beforeend', html);
}

function modalDrawer(id){
  const d = id? byId(id) : {id:'', title:'', c:'#4A7C59', pv:'list', layout:'list', filter:{kinds:[]}};
  const ks=((d.filter||{}).kinds||[]);
  showModal(`<div class="modal-h"><div class="t">${id?'Edit drawer':'New drawer'}</div>
    <div class="s">A drawer is an object that contains other objects. It shows anything you file in it by hand, plus anything matching its rule.</div></div>
  <div class="modal-b">
    <div class="field" style="margin-bottom:10px"><label>Name</label><input id="dnm" value="${esc(d.title||'')}" placeholder="Reading Pile"></div>
    <div class="field" style="margin-bottom:10px"><label>View</label>
      <div class="filterbar" id="dlayout" style="padding-top:6px">${
        [['grid','Grid'],['list','List'],['scroll','Scroll']].map(([v,n])=>
        `<button class="fchip${(d.layout||'grid')===v?' on':''}" data-dl="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Grid lays contents out on the grid · List is one line each · Scroll shows every word, top to bottom.</div></div>
    <div class="field" style="margin-bottom:10px"><label>Border</label>
      <div class="filterbar" id="dborder" style="flex-wrap:wrap;padding-top:6px">${
        [['panel','Panelled'],['heavy','Heavy panel'],['bar','Bar'],['aqua','Aqua'],['plain','Plain'],['none','None']].map(([v,n])=>
          `<button class="fchip${(d.border||'panel')===v?' on':''}" data-dbd="${v}">${n}</button>`).join('')}</div></div>
    <div class="field" style="margin-bottom:10px"><label>Knob</label>
      <div class="filterbar" id="dknob" style="flex-wrap:wrap;padding-top:6px">${
        [['round','Round'],['diamond','Diamond'],['bar','Bar'],['ring','Ring'],['square','Square'],['orb','Orb']].map(([v,n])=>
          `<button class="fchip${(d.knob||'round')===v?' on':''}" data-dkn="${v}">${n}</button>`).join('')}</div>
      <label class="custcol" style="margin-top:8px"><input type="color" data-knobinput value="${d.knobc&&d.knobc[0]==='#'?d.knobc:'#ffffff'}"><span>Knob colour</span></label>
      ${d.knobc?`<button class="pill" style="margin-left:6px" data-dkc="">Back to white</button>`:''}
    </div>
    <div class="field" style="margin-bottom:10px"><label>Locked</label>
      <div class="filterbar" id="dlock" style="padding-top:6px">
        <button class="fchip${d.locked?'':' on'}" data-dlock="">Movable</button>
        <button class="fchip${d.locked?' on':''}" data-dlock="1">Locked</button></div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">You are always arranging. Lock a drawer when you've got it how you want it and nothing should shift.</div></div>
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
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="pill solid" data-act="savedrawer" data-id="${id||''}">${id?'Save':'Create drawer'}</button>
      <button class="pill" data-act="cancel">Cancel</button>
      ${id?`<button class="pill" data-act="deldrawer" data-id="${id}" style="margin-left:auto;color:#C0563F">Delete</button>`:''}
    </div>
  </div>`);
  const m=$('#modal');
  m._draft={c:d.c, pv:d.pv, kinds:ks.slice(), layout:d.layout||'grid', tag:(d.filter||{}).tag||'', locked:!!d.locked,
            border:d.border||'panel', knob:d.knob||'round', knobc:d.knobc||''};
}
/* Make a kind by choosing attributes. `from` is an object whose attributes seed
   the picker — "save these attributes as a new kind" from the detail sheet. */
/* Also the kind *editor*. `editKey` names an existing kind — built-in or one of
   yours — and saving writes an override into S.kinds, so a built-in can be
   changed without touching the source. */
/* A live sample of the type being built. It goes through the same gridTile()
   the board uses, on a throwaway object, so the preview cannot drift from what
   you will actually get — if it renders wrong here it renders wrong there. */
function previewObject(){
  const d=$('#modal')&&$('#modal')._draft; if(!d) return null;
  const nameEl=$('#knm');
  const cont = d.sort!=='object';
  return {
    id:'__preview', kind:'note',
    title:(nameEl&&nameEl.value.trim())||'Untitled',
    body:'A line or two of whatever it holds, so you can see how it sits.',
    attrs:d.attrs.slice(),
    shape: cont?undefined:(d.shape||'card'),
    face:  cont?(d.face||'front'):undefined,
    c:d.c, parent:ROOT, tags:[], ord:0, created:T,
    // both layouts, or lay() reads the empty one on a phone-width window and
    // ensureBox quietly fills it from the fallback kind's size instead
    desk:{x:1,y:1,w:d.size[0],h:d.size[1]},
    phone:{x:1,y:1,w:d.size[0],h:d.size[1]},
    onclick:d.onclick, spawnBy:d.spawnBy, genKind:'task', genDir:'down',
    ...(d.attrs.includes('date')     ? {due:T} : {}),
    ...(d.attrs.includes('count')    ? {count:12} : {}),
    ...(d.attrs.includes('rating')   ? {rating:4} : {}),
    ...(d.attrs.includes('priority') ? {prio:'high'} : {}),
    ...(d.attrs.includes('price')    ? {price:'12.50'} : {}),
    ...(d.attrs.includes('duration') ? {dur:45} : {}),
    ...(d.attrs.includes('location') ? {loc:'The shed'} : {}),
    ...(d.attrs.includes('streak')   ? {history:[T]} : {history:[]}),
    ...(d.attrs.includes('progress') ? {milestones:[{t:'One',done:true},{t:'Two',done:false}]} : {milestones:[]}),
    done:false,
    link:{label:(nameEl&&nameEl.value.trim())||'Press', target:''},
    knob:'round', border:'panel', texture:'none', layout:'list'
  };
}
function renderPreview(){
  const host=$('#kpreview'); if(!host) return;
  const o=previewObject(); if(!o) return;
  const b=o[dev()]||o.desk, [w,h]=[b.w,b.h];
  const cell=Math.max(9, Math.min(300/w, 190/h));
  host.innerHTML=`<div class="grid g-desk pvgrid"
      style="--cols:${w};--rowh:${cell}px;--checker:${2*cell}px;
             grid-template-rows:repeat(${h},${cell}px);width:${w*cell}px">
      ${gridTile(o,false,ROOT)}</div>`;
}
function modalNewKind(from, editKey){
  const ex = editKey ? K(editKey) : null;
  const base = ex || (from ? K(from.kind) : null);
  const seedAttrs = ex ? (ex.attrs||['text']).slice() : from ? attrsOf(from).slice() : ['text'];
  const c = (base && base.c) || '#5F7A93';
  const isCont = seedAttrs.includes('container');
  const sort = isCont ? (seedAttrs.includes('magic') ? 'magic' : 'drawer') : 'object';
  const size = (base && base.size) || [4,4];
  const chip=(on,attrs,label,title)=>`<button class="fchip${on?' on':''}" ${attrs}${title?` title="${esc(title)}"`:''}>${label}</button>`;
  // traits that carry a typed value are worth separating: only these can be
  // sorted, filtered or totalled
  const plain = USER_ATTRS.filter(a=>!fieldOf(a));
  const bearing = USER_ATTRS.filter(a=>fieldOf(a));

  showModal(`<div class="modal-h"><div class="t">${ex?'Edit '+esc(ex.nm):'New type'}</div>
    <div class="s">A type is a name for a set of traits. Nothing here is special-cased — whatever you tick is what it can do.</div></div>
  <div class="modal-b">

    <div class="pvwrap"><div id="kpreview"></div></div>
    <div class="field" style="margin-bottom:10px"><label>Name</label>
      <input id="knm" value="${ex?esc(ex.nm):(from?esc(K(from.kind).nm)+' variant':'')}" placeholder="Reading note"></div>
    <div class="field" style="margin-bottom:12px"><label>Description</label>
      <input id="kds" value="${ex?esc(ex.ds||''):''}" placeholder="What it's for, in a few words"></div>

    <div class="section-h"><h2>What it is</h2><div class="rule"></div></div>
    <div class="filterbar" id="ksort" style="flex-wrap:wrap">
      ${chip(sort==='object','data-ksort="object"','Object','Holds nothing')}
      ${chip(sort==='drawer','data-ksort="drawer"','Drawer','Holds what you file in it')}
      ${chip(sort==='magic','data-ksort="magic"','Magic drawer','Collects by rule; holds nothing')}
    </div>

    <div class="section-h"><h2>Look</h2><div class="rule"></div>
      <span class="n" id="klookn">${sort==='object'?'shape':'face'}</span></div>
    <div class="filterbar" id="klook" style="flex-wrap:wrap">
      ${(sort==='object'?Object.entries(SHAPES):Object.entries(FACES)).map(([v,n])=>
        chip(((base&&(sort==='object'?base.shape:base.face))||(sort==='object'?'card':'front'))===v,
             `data-klook="${v}"`, n)).join('')}
    </div>

    <div class="section-h"><h2>Traits</h2><div class="rule"></div><span class="n">what it can do</span></div>
    <div class="filterbar" id="kattrs" style="flex-wrap:wrap">
      ${plain.map(a=>chip(seedAttrs.includes(a),`data-ka="${a}"`,ATTRS[a].nm,ATTRS[a].ds)).join('')}
    </div>

    <div class="section-h"><h2>Fields</h2><div class="rule"></div>
      <span class="n">typed values — sortable, filterable, totallable</span></div>
    <div class="filterbar" id="kfields" style="flex-wrap:wrap">
      ${bearing.map(a=>chip(seedAttrs.includes(a),`data-ka="${a}"`,
        `${ATTRS[a].nm} <i style="opacity:.55;font-style:normal">${fieldOf(a).type}</i>`,ATTRS[a].ds)).join('')}
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:6px" id="kattrsds">${
      esc(seedAttrs.map(a=>ATTRS[a]&&ATTRS[a].ds).filter(Boolean).join(' · '))||'Nothing yet'}</div>

    <div class="section-h"><h2>Behaviour</h2><div class="rule"></div></div>
    <div class="field" style="margin-bottom:10px"><label>Clicking one</label>
      <div class="filterbar" id="kclick" style="flex-wrap:wrap;padding-top:6px">
        ${Object.entries(CLICKS).map(([v,n])=>chip(((base&&base.onclick)||'read')===v,`data-kclick="${v}"`,n)).join('')}</div></div>
    <div class="field" id="kspawnrow" style="margin-bottom:10px;${seedAttrs.includes('spawn')?'':'display:none'}">
      <label>It spawns</label>
      <div class="filterbar" style="flex-wrap:wrap;padding-top:6px">
        ${chip(((base&&base.spawnBy)||'click')==='click','data-kspawn="click"','When pressed')}
        ${chip(((base&&base.spawnBy)||'click')==='type','data-kspawn="type"','As you type in it')}</div></div>
    <div class="field" style="margin-bottom:10px"><label>Starts at</label>
      <div class="filterbar" id="ksize" style="flex-wrap:wrap;padding-top:6px">${
        [[4,1],[6,1],[2,2],[4,4],[6,4],[6,6],[8,6],[12,8]].map(([w,h])=>
          chip(size.join('x')===w+'x'+h,`data-ksz="${w}x${h}"`,`${w}×${h}`)).join('')}</div></div>

    <div class="section-h"><h2>Colour and mark</h2><div class="rule"></div></div>
    <div class="field" style="margin-bottom:10px">
      <div id="dcol">${swatchRows(c)}
        <label class="custcol"><input type="color" data-colinput value="${c}"><span>Custom colour</span></label></div></div>
    <div class="filterbar" id="kicon" style="flex-wrap:wrap">${
      ['note','check','list','bulb','feather','book','star','flag','clock','target','image','film','music',
       'pot','clapper','help','folder','sparkle','trophy','archive','tag','plus','edit','inbox'].map(i=>
        `<button class="fchip iconchip${((base&&base.ic)||'note')===i?' on':''}" data-kic="${i}" title="${i}">${ic(i,15)}</button>`).join('')}</div>

    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="pill solid" data-act="savekind" data-id="${editKey||''}">${ex?'Save':'Create type'}</button>
      <button class="pill" data-act="cancel">Cancel</button>
      ${ex&&S.kinds[editKey]?`<button class="pill" data-act="delkind" data-id="${editKey}" style="margin-left:auto;color:#C0563F">Delete</button>`:''}
      ${ex&&!S.kinds[editKey]?`<button class="pill" data-act="resetkind" data-id="${editKey}" style="margin-left:auto">Reset to default</button>`:''}
    </div>
  </div>`);
  const m=$('#modal');
  m._draft={c, attrs:seedAttrs, ic:(base&&base.ic)||'note', ds:'',
            fromId:from&&from.id, editKey:editKey||null,
            size, onclick:(base&&base.onclick)||'read',
            sort, shape:(base&&base.shape)||'card', face:(base&&base.face)||'front',
            spawnBy:(base&&base.spawnBy)||'click'};
  renderPreview();
}
// Anywhere this object may legally go: any container that is not itself, and
// not inside itself — otherwise a drawer can swallow its own ancestor.
function moveTargets(objId){
  const o=byId(objId);
  return [rootObj()].concat(containers().filter(c=>c.id!==objId && !has(c,'magic') && !(o&&isAncestor(objId,c))));
}
function modalMove(objId){
  showModal(`<div class="modal-h"><div class="t">Move to drawer</div><div class="s">Filing by hand always wins over the drawer's rule.</div></div>
  <div class="modal-b"><div class="rows">${moveTargets(objId).map(d=>
    `<div class="row" data-moveto="${objId}:${d.id}" style="--k:${d.c||K(d.kind).c}"><span class="kindmark">${ic('folder',13)}</span>
      <div class="body"><div class="title">${esc(d.title)}</div><div class="snip">${childrenOf(d).length} objects</div></div></div>`).join('')}</div></div>`);
}

/* ============================================================
   17 · command palette
   ============================================================ */
function openCmd(){ $('#cmdscrim').classList.add('open'); $('#cmdinput').value=''; cmdList(''); setTimeout(()=>$('#cmdinput').focus(),30); }
function closeCmd(){ $('#cmdscrim').classList.remove('open'); if(document.activeElement&&document.activeElement.blur) document.activeElement.blur(); }
function cmdList(q){
  q=q.trim().toLowerCase();
  const res=[];
  [['today','Today','calendar'],['keep','Keeping Up','target'],['all','Everything','archive'],
   ['settings','Settings','sliders'],['desk','The Desk','grid']].forEach(([v,nm,icn])=>{
    if(!q||nm.toLowerCase().includes(q))
      res.push({t:nm,s:'view',c:'var(--brass)',i:icn,go:()=>{S.view=v;S.drawerId=null;}});
  });
  containers().forEach(d=>{ if(!q||(d.title||'').toLowerCase().includes(q)) res.push({t:d.title,s:'drawer',c:d.c||K(d.kind).c,i:'folder',go:()=>{S.view='drawer';S.drawerId=d.id;}}); });
  KEYS.forEach(k=>{ if(q&&KINDS[k].nm.toLowerCase().includes(q)) res.push({t:'All '+KINDS[k].nm.toLowerCase()+'s',s:'type',c:KINDS[k].c,i:KINDS[k].ic,go:()=>{S.view='all';S.kindFilter=k;}}); });
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
  // now that its contents have moved out, the first object's old spot is free
  d[dev()] = boxOk({x:spot.x,y:spot.y,w:6,h:6}, d.id, dev(), home)
    ? {x:spot.x,y:spot.y,w:6,h:6} : freeSpot(6,6,dev(),home);
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
         <button data-c="opendrawer:${id}">${ic('eye',14)} Open</button>`
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

export { overlayHTML, showModal, hideModal, modalNewObject, closePanel,
  objectPanel, drawerPanel, modalDrawer, modalNewKind, renderPreview, modalMove,
  openCmd, closeCmd, cmdList, runCmd, drawerFromSelection, openCtx, closeCtx };
