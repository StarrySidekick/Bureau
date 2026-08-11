import { $, $$, esc, ic, md, D, ROOT } from './util.js';
import { S, K, KINDS, KEYS, T, byId, has, isContainer, containers, isAncestor,
  streak, goalPct } from './model.js';
import { CLICKS, clickOf, bookOf } from './tiles.js';
import { render } from './views.js';

/* ============================================================
   15 · detail sheet
   ============================================================ */
function openObj(id){ S.openId=id; S.readId=null; S.editing=false; renderSheet(); }
function closeSheet(){ S.openId=null; S.readId=null; clearFocus(); renderSheet(); render(); }

/* Centre the object being looked at in the half of the screen the sheet
   doesn't cover, so you keep sight of where it lives. */
function focusTile(id){
  clearFocus();
  // put the sheet on the far side from the object, so it never covers it
  const t=document.querySelector(`.grid .drawer[data-row="${id}"],.grid .drawer[data-drawer="${id}"]`);
  const frame=$('#frame');
  if(t && frame.classList.contains('is-desk')){
    const mid=t.getBoundingClientRect().left + t.getBoundingClientRect().width/2;
    frame.classList.toggle('sheet-left', mid > window.innerWidth/2);
  }
  const el=t;
  if(!el) return;
  el.classList.add('focused');
  const scroller=el.closest('.scroll'); if(!scroller) return;
  const er=el.getBoundingClientRect(), sr=scroller.getBoundingClientRect();
  scroller.scrollTop += (er.top - sr.top) - (sr.height/2 - er.height/2);
  if($('#frame').classList.contains('is-desk')){
    const half=window.innerWidth/2;
    scroller.scrollLeft += (er.left - sr.left) - (half/2 - er.width/2);
  }
}
function clearFocus(){ $$('.drawer.focused').forEach(e=>e.classList.remove('focused')); $('#frame').classList.remove('sheet-left'); }

function renderSheet(){
  const host=$('#sheetHost');
  // Read view: the whole body, nothing to edit. What clicking a note does.
  if(S.readId && !S.openId){
    const r=byId(S.readId);
    if(!r){ S.readId=null; host.innerHTML=''; return; }
    if(S.bookMode){
      host.innerHTML=`<div class="bookscrim" data-sheet="close"></div>
        <div class="bookstage">
          <div class="bookhead"><b>${esc(r.title||'Untitled')}</b>
            <button class="pill" data-act="bookmode">${ic('list',13)} Plain</button>
            <button class="pill" data-act="editthis" data-id="${r.id}">${ic('edit',13)} Edit</button>
            <button class="iconbtn" data-sheet="close">${ic('x',16)}</button></div>
          ${bookOf(r)}
        </div>`;
      return;
    }
    host.innerHTML=`<div class="sheetveil on" data-sheet="close"></div>
    <div class="sheet open" id="sheet" style="--k:${K(r.kind).c}">
      <div class="sheet-h">
        <button class="iconbtn" data-sheet="close">${ic('chevL',18)}</button>
        <span class="kindbadge">${ic(K(r.kind).ic,12)} ${K(r.kind).nm}</span>
        <div style="flex:1"></div>
        <button class="pill${S.bookMode?' solid':''}" data-act="bookmode">${ic('book',13)} Book</button>
        <button class="pill" data-act="editthis" data-id="${r.id}">${ic('edit',13)} Edit</button>
      </div>
      <div class="sheet-b">
        <h1 class="readtitle">${esc(r.title||'Untitled')}</h1>
        ${(r.tags||[]).length?`<div class="meta" style="margin-bottom:14px">${(r.tags||[]).map(t=>`<span class="mchip tag">${esc(t)}</span>`).join('')}</div>`:''}
        ${r.media&&r.media.src?`<img class="scrollimg" src="${esc(r.media.src)}" alt="${esc(r.title||'')}">`:''}
        ${S.bookMode ? bookOf(r) : `<div class="prose read">${md(r.body)}</div>`}
      </div>
    </div>`;
    focusTile(r.id);
    return;
  }
  const o=S.openId?byId(S.openId):null;
  if(!o){ host.innerHTML=''; clearFocus(); return; }
  const k=K(o.kind);
  const drawerOpts=containers().filter(c=>c.id!==o.id&&!has(c,'magic')&&!isAncestor(o.id,c)).map(d=>`<option value="${d.id}"${o.parent===d.id?" selected":""}>${esc(d.title)}</option>`).join('');
  const kindOpts=KEYS.map(x=>`<option value="${x}"${o.kind===x?' selected':''}>${KINDS[x].nm}</option>`).join('');

  // Every field below is gated on an attribute, never on a kind name — that is
  // what lets an invented kind get the right fields for free.
  const fields=[];
  fields.push(`<div class="field"><label>Type</label><select data-f="kind">${kindOpts}</select></div>`);
  fields.push(`<div class="field"><label>Lives in</label><select data-f="parent">
    <option value="${ROOT}"${o.parent===ROOT?' selected':''}>The Desk</option>${drawerOpts}</select></div>`);
  if(has(o,'date')) fields.push(`<div class="field"><label>${has(o,'progress')?'Target date':'Scheduled'}</label><input type="date" data-f="due" value="${o.due||''}"></div>`);
  if(has(o,'repeat')||has(o,'streak')) fields.push(`<div class="field"><label>${has(o,'streak')?'Cadence':'Repeats'}</label><select data-f="repeat">
      ${['','daily','weekdays','weekly','monthly'].map(r=>`<option value="${r}"${(o.repeat||'')===r?' selected':''}>${r||'Never'}</option>`).join('')}
    </select></div>`);
  if(has(o,'link')) fields.push(`<div class="field"><label>Link</label><input data-f="url" value="${esc(o.url||'')}" placeholder="https://"></div>`);
  if(has(o,'location')) fields.push(`<div class="field"><label>Location</label><input data-f="loc" value="${esc(o.loc||'')}" placeholder="Where"></div>`);
  if(has(o,'duration')) fields.push(`<div class="field"><label>Duration (minutes)</label><input type="number" min="0" data-f="dur" value="${o.dur||''}"></div>`);
  if(has(o,'price')) fields.push(`<div class="field"><label>Price</label><input data-f="price" value="${esc(o.price||'')}" placeholder="12.50"></div>`);
  if(has(o,'priority')) fields.push(`<div class="field"><label>Priority</label><select data-f="prio">
      ${[['','—'],['low','Low'],['mid','Medium'],['high','High']].map(([v,n])=>`<option value="${v}"${(o.prio||'')===v?' selected':''}>${n}</option>`).join('')}</select></div>`);
  if(has(o,'count')) fields.push(`<div class="field"><label>Count</label>
      <div class="counter"><button data-act="countdown" data-id="${o.id}">−</button><b>${o.count||0}</b><button data-act="countup" data-id="${o.id}">+</button></div></div>`);
  if(has(o,'rating')) fields.push(`<div class="field"><label>Rating</label>
      <div class="stars">${[1,2,3,4,5].map(n=>`<button data-star="${o.id}:${n}" class="${(o.rating||0)>=n?'on':''}">${ic('star',17)}</button>`).join('')}</div></div>`);
  if(has(o,'media')&&o.media&&o.media.type==='image') fields.push(`<div class="field"><label>Frame</label><select data-f="frame">
      ${[['none','None'],['mount','Card mount'],['gilt','Gilt'],['walnut','Walnut'],['black','Black lacquer'],['polaroid','Instant photo']].map(([v,n])=>`<option value="${v}"${(o.frame||'none')===v?' selected':''}>${n}</option>`).join('')}</select></div>`);
  if(has(o,'button')) fields.push(`<div class="field"><label>Button shape</label><select data-f="btnshape">
      ${[['rounded','Rounded square'],['round','Round'],['square','Square']].map(([v,n])=>`<option value="${v}"${(o.btnshape||'rounded')===v?' selected':''}>${n}</option>`).join('')}</select></div>`);
  if(has(o,'media')) fields.push(`<div class="field"><label>Media type</label><select data-f="mtype">
      ${['image','video','audio'].map(t=>`<option value="${t}"${o.media&&o.media.type===t?' selected':''}>${t}</option>`).join('')}</select></div>`);
  if(!isContainer(o)) fields.push(`<div class="field"><label>Clicking it</label><select data-f="onclick">
      ${Object.entries(CLICKS).map(([v,n])=>`<option value="${v}"${clickOf(o)===v?' selected':''}>${n}</option>`).join('')}</select></div>`);
  if(has(o,'container')) fields.push(`<div class="field"><label>Contents laid out as</label><select data-f="layout">
      ${[['list','List'],['grid','Grid']].map(([v,n])=>`<option value="${v}"${(o.layout||'list')===v?' selected':''}>${n}</option>`).join('')}</select></div>`);

  let extra='';
  if(has(o,'button')){
    const L=o.link||{label:'Open',target:''};
    extra += `<div class="section-h"><h2>Button</h2><div class="rule"></div></div>
      <div class="field" style="margin-bottom:8px"><label>Label</label><input data-f="linklabel" value="${esc(L.label||'')}" placeholder="Open"></div>
      <div class="field"><label>Opens</label><select data-f="linktarget">
        <option value="">Nothing yet</option>
        <optgroup label="In Bureau">${containers().map(c=>`<option value="${c.id}"${L.target===c.id?' selected':''}>${esc(c.title)}</option>`).join('')}</optgroup>
      </select></div>
      <div class="field" style="margin-top:8px"><label>…or a link</label><input data-f="linkurl" value="${/^https?:/.test(L.target||'')?esc(L.target):''}" placeholder="https://"></div>`;
  }
  if(has(o,'streak')){
    extra += `<div class="section-h"><h2>Last 28 days</h2><div class="rule"></div><span class="n">${streak(o)}-day streak</span></div>
      <div class="dots" style="--k:${k.c};margin:0 0 6px;flex-wrap:wrap;gap:4px">
      ${[...Array(28)].map((_,i)=>{const ds=D.addISO(T,i-27);
        return `<i data-hday="${ds}" style="width:18px;height:26px;cursor:pointer" class="${(o.history||[]).includes(ds)?'on':''}${ds===T?' today':''}"></i>`}).join('')}</div>`;
  }
  if(has(o,'progress')){
    extra += `<div class="section-h"><h2>Milestones</h2><div class="rule"></div><span class="n">${goalPct(o)}%</span></div>
      <div class="bar" style="--k:${k.c}"><i style="width:${goalPct(o)}%"></i></div>
      <div class="miles">${(o.milestones||[]).map((m,i)=>`
        <div class="mile${m.done?' done':''}">
          <span class="check${m.done?' on':''}" style="--k:${k.c};width:16px;height:16px" data-mile="${o.id}:${i}">${ic('check',11)}</span>
          <input value="${esc(m.t)}" data-mtext="${i}" style="flex:1;border:0;background:none;outline:none;font-size:13px">
          <input type="date" value="${m.d||''}" data-mdate="${i}" style="border:0;background:none;outline:none;font-size:11px;color:var(--ink-3)">
          <button data-mdel="${i}" style="color:var(--ink-3)">${ic('x',13)}</button>
        </div>`).join('')}</div>
      <button class="subtle-btn" data-act="addmile" style="margin-top:8px">${ic('plus',12)} Add milestone</button>`;
  }
  if(o.media){
    extra += `<div class="mediablock" style="--k:${k.c}">
      <div class="art">${ic(o.media.type==='audio'?'music':o.media.type==='video'?'film':'image',34)}</div>
      <div class="cap">${ic('folder',12)} ${esc(o.media.label||'')} <span style="margin-left:auto;color:var(--ink-3)">tap to replace</span></div></div>`;
  }


  host.innerHTML = `<div class="sheetveil on" data-sheet="close"></div>
    <div class="sheet open" id="sheet" style="--k:${k.c}">
    <div class="sheet-h">
      <button class="iconbtn" data-sheet="close">${ic('chevL',18)}</button>
      <span class="kindbadge">${ic(k.ic,12)} ${k.nm}</span>
      <div style="flex:1"></div>
      ${(has(o,'check')||has(o,'streak'))?`<button class="pill" data-sheet="done">${ic('check',13)} ${has(o,'streak')?((o.history||[]).includes(T)?'Done today':'Mark today'):(o.done?'Completed':'Complete')}</button>`:''}
      <button class="pill" data-act="attrsheet" data-id="${o.id}">${ic('sliders',13)} Attributes</button>
      <button class="iconbtn" data-sheet="del">${ic('trash',16)}</button>
    </div>
    <div class="sheet-b"><div class="detail-wrap">
      <textarea class="titlefield" rows="1" data-f="title" placeholder="Untitled ${k.nm.toLowerCase()}">${esc(o.title)}</textarea>
      <div class="fieldgrid">${fields.join('')}</div>
      <div class="tagrow">${ic('tag',13)}
        ${(o.tags||[]).map(t=>`<span class="realtag">${esc(t)}<b data-untag="${esc(t)}">✕</b></span>`).join('')}
        <button class="add" data-act="addtag">+ tag</button></div>
      ${extra}
      <div class="section-h"><h2>${has(o,'progress')||has(o,'streak')?'Notes':'Body'}</h2><div class="rule"></div>
        <span class="n">${(o.body||'').split(/\s+/).filter(Boolean).length} words</span></div>
      <textarea class="editor" data-f="body">${esc(o.body)}</textarea>
      <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">
        <button class="subtle-btn" data-act="attach">${ic('image',12)} Attach media</button>
        <button class="subtle-btn" data-act="dupe">${ic('archive',12)} Duplicate</button>
        <button class="subtle-btn" data-act="sched">${ic('calendar',12)} Schedule today</button>
      </div>
      <div style="margin-top:22px;font-size:11px;color:var(--ink-3)">created ${D.short(o.created)} · id ${o.id}</div>
    </div></div>
  </div>`;
  const ta=$('.titlefield',host); if(ta){ ta.style.height='auto'; ta.style.height=ta.scrollHeight+'px'; }
}

export { openObj, closeSheet, renderSheet };
