import { $, $$, esc, ic, uid, D, ROOT } from './util.js';
import { S, K, KINDS, KEYS, refreshKinds, ATTRS, USER_ATTRS, attrsOf, has, SHAPES,
  FACES, SORTS, byId, container, cfgOf, isContainer, isAncestor, relate,
  unrelate, sensedDevice, reset, T, dz, dev } from './model.js';
import { gridOf, lay, boxOk, freeSpot } from './grid.js';
import { applyLook, applyStyle, setLookVal, lookVal, STYLES, PALETTES, randomFront } from './look.js';
import { toast, toggleDone, del, undo, setPin, togglePin, drawerForTag, create, quickAdd, randomThing } from './mutations.js';
import { spinTo, pending, placeAtPending, tileTap } from './tiles.js';
import { render, sizeGrid, toggleSettings } from './views.js';
import { openObj, closeSheet, renderSheet } from './sheet.js';
import { openPanel, closePanel, refreshPanel, panelKey, draft, openMenu,
  modalNewObject, modalDrawer, modalNewKind, modalMove, renderPreview,
  drawerPanel, objectPanel,
  drawerFromSelection, openCtx, closeCtx, openCmd, closeCmd, cmdList, runCmd } from './panels.js';
import { onDown, onMove, onUp, onCancel, gestureFlags } from './gestures.js';
import { save, writeNow, exportBackup, importBackup, importImage, pasteObjects, install } from './persist.js';

/* Mark one chip in a group as the chosen one. The selector is deliberately
   class-agnostic — the chips in these groups have changed class twice. */
function only(el, sel){ $$(sel).forEach(b=>b.classList.remove('on')); el.classList.add('on'); }

function act(name, el){
  switch(name){
    case 'new': modalNewObject(); break;
    case 'newdrawer': modalDrawer(null); break;
    case 'back': S.view='desk'; S.drawerId=null; S.kindFilter=null; render(); break;
    case 'pin': togglePin(el.dataset.id); break;
    case 'monthstep': {
      const d=byId(el.dataset.id); if(!d) return;
      const a=D.parse(d.month||T)||D.today();
      a.setMonth(a.getMonth()+ (+el.dataset.step||0));
      d.month=D.iso(new Date(a.getFullYear(), a.getMonth(), 1));
      save(); render(); break;
    }
    case 'monthtoday': {
      const d=byId(el.dataset.id); if(!d) return;
      d.month=T; S.calDay=T; save(); render(); break;
    }
    case 'cancel': closePanel(); break;
    case 'savedrawer': {
      const id=el.dataset.id, dr=draft()||{};
      const title=$('#dnm').value.trim()||'Untitled drawer';
      if(id){ const d=byId(id);
        Object.assign(d,{title,c:dr.c,pv:dr.pv,layout:dr.layout,locked:!!dr.locked,
          border:dr.border,knob:dr.knob,knobc:dr.knobc||null});
        d.filter=Object.assign({},d.filter,{kinds:dr.kinds,tag:dr.tag||undefined,
          rule: $('#rf').value ? {f:$('#rf').value, op:$('#rop').value, v:$('#rv').value} : undefined});
        d.roll = $('#rlfn').value ? {fn:$('#rlfn').value, f:$('#rlf').value||undefined} : undefined;
      } else {
        // a new drawer lands inside whatever container you are looking at
        const home=(S.view==='drawer'&&S.drawerId)||ROOT;
        S.objects.push({id:uid('d'), kind:'drawer', title, body:'', tags:[],
          parent:home, c:dr.c||randomFront(), pv:dr.pv, layout:dr.layout||'list',
          filter:{kinds:dr.kinds,tag:dr.tag||undefined}, ord:0, created:T,
          desk:freeSpot(2,2,'desk',home), phone:freeSpot(2,2,'phone',home)});
      }
      closePanel(); save(); render(); toast(id?'Drawer updated':'Drawer added');
      break;
    }
    case 'deldrawer': {
      const id=el.dataset.id;
      // its children are kept — they fall back to wherever it lived
      const d=byId(id), up=(d&&d.parent)||ROOT;
      S.objects.forEach(o=>{ if(o.parent===id) o.parent=up; });
      S.objects=S.objects.filter(o=>o.id!==id);
      if(S.drawerId===id){ S.drawerId=up===ROOT?null:up; S.view=up===ROOT?'desk':'drawer'; }
      closePanel(); save(); render(); toast('Drawer removed — its contents kept');
      break;
    }
    case 'countup': { const o=byId(el.dataset.id); o.count=(o.count||0)+1; save();
      // spin in place when it's a tile, so the wheels animate instead of blinking
      const w=el.closest('.cntnum'); if(w){ spinTo(w, o.count); renderSheet(); }
      else { renderSheet(); render(); }
      break; }
    case 'countdown': { const o=byId(el.dataset.id); o.count=Math.max(0,(o.count||0)-1); save(); renderSheet(); render(); break; }
    case 'addrel': {
      const me=el.dataset.id;
      openPanel({key:'addrel', title:'Link to',
        sub:'Relations point both ways',
        body:()=>`<div class="rows">${S.objects.filter(x=>x.id!==me).slice(0,120).map(x=>
          `<div class="row" data-dorel="${me}:${x.id}" style="--k:${K(x.kind).c}">
            <span class="kindmark">${ic(K(x.kind).ic,13)}</span>
            <div class="body"><div class="title">${esc(x.title||'Untitled')}</div>
              <div class="snip">${esc(K(x.kind).nm)}</div></div></div>`).join('')}</div>`});
      break;
    }
    case 'attrsheet': {
      const id=el.dataset.id; if(!byId(id)) return;
      openPanel({key:'attrs:'+id, title:'Attributes',
        sub:'What this one object can do',
        body:()=>{
          const o=byId(id); if(!o) return '';
          const mine=attrsOf(o), own=!!o.attrs;
          return `<div class="mini" style="--k:var(--brass)">${own?'It has its own set.'
              :'It follows the '+esc(K(o.kind).nm.toLowerCase())+' type.'}</div>
            <div class="prow"><div>${USER_ATTRS.map(a=>
              `<button class="pchip${mine.includes(a)?' on':''}" data-attr="${a}" data-id="${id}" title="${esc(ATTRS[a].ds)}">${ATTRS[a].nm}</button>`).join('')}</div></div>
            ${own?`<div class="pfoot"><button class="subtle-btn" data-act="attrreset" data-id="${id}">${ic('undo',12)} Follow the ${esc(K(o.kind).nm.toLowerCase())} type again</button></div>`:''}`;
        }});
      break;
    }
    case 'attrreset': {
      const o=byId(el.dataset.id||S.openId); if(!o) return;
      o.attrs=null; save(); refreshPanel(); renderSheet(); render();
      toast(`Following the ${K(o.kind).nm.toLowerCase()} type again`);
      break;
    }
    case 'kindfromobj': modalNewKind(byId(S.openId)); break;
    case 'savekind': {
      const dk=draft()||{};
      const nm=$('#knm').value.trim();
      if(!nm){ toast('Give the kind a name'); return; }
      const key = dk.editKey || nm.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,20) || ('kind'+Date.now());
      const base = dk.editKey ? K(dk.editKey) : {};
      S.kinds[key]=Object.assign({}, base, {
        nm, ic:dk.ic||base.ic||'note', c:dk.c,
        key: base.key || (()=>{ const used=new Set(KEYS.map(k=>K(k).key));
          for(const ch of (nm.toUpperCase()+'ABCDEFGHIJKLMNOPQRSTUVWXYZ')) if(ch.trim()&&!used.has(ch)) return ch;
          return ''; })(),
        ds:$('#kds').value.trim()||base.ds||'A kind you made',
        attrs:dk.attrs.slice(), size:dk.size||[4,4],
        onclick:dk.onclick||'read', body:base.body||'',
        shape: dk.sort==='object' ? (dk.shape||'card') : undefined,
        face:  dk.sort==='object' ? undefined : (dk.face||'front'),
        layout: dk.sort==='object' ? undefined : (base.layout||'grid'),
        spawnBy: dk.attrs.includes('spawn') ? (dk.spawnBy||'click') : undefined});
      refreshKinds();
      // the object that inspired it now simply *is* that kind
      if(dk.fromId){ const o=byId(dk.fromId); if(o){ o.kind=key; o.attrs=null; } }
      closePanel(); save(); render(); renderSheet(); toast(`“${nm}” is now a type`);
      break;
    }
    case 'resetkind': {
      delete S.kinds[el.dataset.id]; refreshKinds(); closePanel(); save(); render();
      toast('Back to the built-in'); break;
    }
    case 'editkind': modalNewKind(null, el.dataset.id); break;
    case 'delkind': {
      const key=el.dataset.id;
      if(S.objects.some(o=>o.kind===key)){ toast('Something still uses that type'); return; }
      delete S.kinds[key]; refreshKinds(); closePanel(); save(); render(); toast('Type removed');
      break;
    }
    case 'addtag': {
      const o=byId(S.openId); if(!o) return;
      const t=prompt('Tag'); if(t){ o.tags=o.tags||[]; if(!o.tags.includes(t.trim())) o.tags.push(t.trim().replace(/^#/,'')); renderSheet(); render(); }
      break;
    }
    case 'addmile': { const o=byId(S.openId); o.milestones.push({t:'New milestone',done:false,d:dz(30)}); renderSheet(); break; }
    case 'attach': { const o=byId(S.openId); o.media={type:'image',label:'photo-2026-08.heic · 4.2 MB'}; renderSheet(); render(); toast('Media attached'); break; }
    case 'dupe': { const o=byId(S.openId); const c=Object.assign({},o,{id:uid('o'),title:o.title+' (copy)',ord:o.ord+0.1}); S.objects.push(c); openObj(c.id); render(); break; }
    case 'sched': { const o=byId(S.openId); o.due=T; renderSheet(); render(); toast('Scheduled for today'); break; }
    case 'stopedit': S.layoutEdit=null; render(); break;
    case 'export': exportBackup(); break;
    case 'import': $('#importer').click(); break;
    case 'pickimage': $('#imgpicker').click(); break;
    case 'drawersettings': drawerPanel(el.dataset.id); break;
    case 'panelclose': closePanel(); break;
    case 'panelmore': closePanel(); modalDrawer(el.dataset.id); break;
    case 'appsettings': toggleSettings(); break;
    case 'editthis': S.readId=null; openObj(el.dataset.id); break;
    case 'bookmode': S.bookMode=!S.bookMode; S.bookAt=0; renderSheet(); break;
    case 'bookprev': S.bookAt=Math.max(0,(S.bookAt||0)-2); renderSheet(); break;
    case 'booknext': S.bookAt=(S.bookAt||0)+2; renderSheet(); break;
    case 'cycleview': {
      const c=cfgOf(el.dataset.id), order=['grid','list','scroll'];
      c.layout = order[(order.indexOf(c.layout||'grid')+1)%order.length];
      save(); render(); toast(c.layout+' view');
      break;
    }
    // a menu hung off the button, not a modal in the middle of the screen
    case 'sortmenu': {
      const id=el.dataset.id, cur=cfgOf(id).sort||'';
      openMenu(el, `<div class="ctxhead">Sort</div>
        <button class="${!cur?'on':''}" data-sortby="${id}:">Custom</button>
        ${Object.entries(SORTS).map(([k,[nm]])=>
          `<button class="${cur===k?'on':''}" data-sortby="${id}:${k}">${nm}</button>`).join('')}`);
      break;
    }
    case 'newkind': modalNewKind(null); break;
    case 'install': if(install.deferred){ install.deferred.prompt(); install.deferred=null; } break;
    case 'pastego': { const b=$('#pastebox'); pasteObjects(b&&b.value, ROOT); if(b) b.value=''; break; }
    case 'pasteschema': {
      openPanel({key:'pasteschema', wide:true, title:'What the paste box accepts',
        sub:'An array of objects — only <b>title</b> really matters',
        body:`
        <div class="prose"><pre>[
  {
    "type": "drawer",          // any type name: task, note, recipe, magic drawer…
    "title": "Lisbon",
    "face": "checklist",       // drawer front | checklist | calendar | moodboard | timeline
    "w": 8, "h": 6,            // in grid cells; omit for the type's own size
    "colour": "#3F5F7A",
    "children": [              // only containers keep children
      { "type": "task", "title": "Book the flight", "due": "2026-09-02" },
      { "type": "task", "title": "Renew passport", "done": true }
    ]
  },
  { "type": "note", "title": "Pastéis de Belém", "body": "Queue is worth it.",
    "tags": ["food"] },
  "Milk"                       // a bare string is a task
]</pre>
        <p>Fields follow the attributes: <code>due, done, count, rating, price, prio, loc, dur, url, repeat</code>. Anything a type hasn't got is ignored rather than breaking.</p>
        <p>Give a child list to something that can't hold children and it becomes a drawer instead.</p></div>`});
      break;
    }
    case 'randomone': randomThing(el.dataset.id); save(); render(); toast('One at random'); break;
    case 'randomten': { for(let i=0;i<10;i++) randomThing(); save(); render(); toast('Ten at random'); break; }
    case 'reseed': { const th=S.theme, lk=S.look; reset(); S.theme=th; S.look=lk; applyLook(); writeNow(); render(); toast('Sample desk restored'); break; }
    case 'wipe': {
      if(!confirm('Erase every object and drawer on this device? This cannot be undone.')) return;
      // keep three empty drawers so the desk isn't a blank rectangle
      const th=S.theme, lk=S.look; reset(); S.theme=th; S.look=lk;
      S.objects = S.objects.filter(isContainer).slice(0,3);
      applyLook(); writeNow(); render(); toast('Desk cleared'); break;
    }
  }
}

function wire(){
  const frame=$('#frame');

  frame.addEventListener('pointerdown', onDown);
  frame.addEventListener('pointermove', onMove);
  frame.addEventListener('pointerup', onUp);
  frame.addEventListener('pointercancel', onCancel);

  frame.addEventListener('contextmenu', e=>{
    const kt=e.target.closest('[data-new]');
    if(kt){ e.preventDefault(); modalNewKind(null, kt.dataset.new); return; }
    const tile=e.target.closest('.grid .drawer');
    if(tile){
      const id=tile.dataset.drawer||tile.dataset.row||tile.dataset.id;
      if(id){ e.preventDefault(); openCtx(e.clientX,e.clientY,id); }
      return;
    }
    const r=e.target.closest('[data-row]'); if(!r) return;
    e.preventDefault(); openCtx(e.clientX,e.clientY,r.dataset.row);
  });

  frame.addEventListener('click', e=>{
    // a gesture that ended in a drag leaves one click behind; drop it
    if(gestureFlags.suppressClick){ gestureFlags.suppressClick=false; return; }
    const t=e.target;
    if(!t.closest('#ctx')) closeCtx();

    const undoEl=t.closest('[data-undo]'); if(undoEl){ undo(); return; }
    const c=t.closest('[data-c]');
    if(c){ const [cmd,id]=c.dataset.c.split(':'); closeCtx();
      if(cmd==='open') openObj(id);
      else if(cmd==='read'){ S.readId=id; S.openId=null; renderSheet(); }
      else if(cmd==='drawerset') drawerPanel(id);
      else if(cmd==='objset') objectPanel(id);
      else if(cmd==='opendrawer'){ S.view='drawer'; S.drawerId=id; render(); }
      else if(cmd==='pin') togglePin(id);
      else if(cmd==='done') toggleDone(id);
      else if(cmd==='today'){ byId(id).due=T; render(); toast('Scheduled today'); }
      else if(cmd==='tom'){ byId(id).due=dz(1); render(); toast('Scheduled tomorrow'); }
      else if(cmd==='move') modalMove(id);
      else if(cmd==='dupe'){ const o=byId(id); S.objects.push(Object.assign({},o,{id:uid('o'),title:o.title+' (copy)',ord:o.ord+0.1})); render(); }
      else if(cmd==='intodrawer') drawerFromSelection(id);
      else if(cmd==='del'){
        const sel = S.sel.includes(id) ? S.sel.slice() : [id];
        if(sel.length>1){ sel.forEach(x=>{ const i=S.objects.findIndex(o=>o.id===x); if(i>=0) S.objects.splice(i,1); });
          S.sel=[]; save(); render(); toast(`Deleted ${sel.length}`); }
        else del(id);
      }
      return; }

    const dr2=t.closest('[data-dorel]');
    if(dr2){ const [a,b]=dr2.dataset.dorel.split(':'); relate(a,b); closePanel(); save(); renderSheet(); render(); return; }
    const ur=t.closest('[data-unrel]');
    if(ur){ const [a,b]=ur.dataset.unrel.split(':'); unrelate(a,b); save(); renderSheet(); render(); return; }
    const or2=t.closest('[data-openrel]');
    if(or2){ openObj(or2.dataset.openrel); return; }

    const st=t.closest('[data-star]');
    if(st){ const [id,n]=st.dataset.star.split(':'); const o=byId(id);
      o.rating = (o.rating===+n) ? 0 : +n; save(); renderSheet(); render(); return; }

    const st3=t.closest('[data-style3]');
    if(st3){ applyStyle(st3.dataset.style3); toast(STYLES[st3.dataset.style3].nm); return; }
    const pl=t.closest('[data-palette]');
    if(pl){ S.look.palette=pl.dataset.palette; save(); render(); toast(PALETTES[pl.dataset.palette].nm); return; }

    const sb=t.closest('[data-sortby]');
    if(sb){ const i=sb.dataset.sortby.indexOf(':');
      cfgOf(sb.dataset.sortby.slice(0,i)).sort = sb.dataset.sortby.slice(i+1) || null;
      closeCtx(); save(); render(); return; }

    const mv=t.closest('[data-moveto]');
    if(mv){ const [oid,did]=mv.dataset.moveto.split(':');
      byId(oid).parent=did; closePanel(); save(); render(); renderSheet();
      toast('Filed in '+(did===ROOT?'The Desk':byId(did).title)); return; }

    // the dial in a type tile's corner edits the type rather than making one
    const nk=t.closest('[data-new]');
    if(nk && !t.closest('[data-act]')){
      const at=pending.cell;            // closePanel clears it, so keep it first
      closePanel();
      pending.cell=at;
      const kind=nk.dataset.new;
      if(K(kind).picksFile){ pending.cell=at; $('#imgpicker').click(); return; }
      const o=create(kind, at?{parent:at.parent}:undefined);
      placeAtPending(o);
      save(); render();
      // it lands on the board and stays there — open it when you want it
      return; }

    const cd=t.closest('[data-calday]');
    if(cd){
      const [did,iso]=cd.dataset.calday.split(':');
      S.calDay = S.calDay===iso ? null : iso;
      // from a tile on the board this also opens the drawer it belongs to
      if(S.view!=='drawer' || S.drawerId!==did){ S.view='drawer'; S.drawerId=did; S.calDay=iso; }
      render(); return;
    }

    const ck=t.closest('[data-check]'); if(ck){ toggleDone(ck.dataset.check); return; }

    const ml=t.closest('[data-mile]');
    if(ml){ const [gid,i]=ml.dataset.mile.split(':'); const g=byId(gid); const m=g.milestones[+i];
      m.done=!m.done; if(m.done) toast('Milestone passed · '+m.t);
      render(); if(S.openId) renderSheet(); return; }
    const mdel=t.closest('[data-mdel]');
    if(mdel){ byId(S.openId).milestones.splice(+mdel.dataset.mdel,1); renderSheet(); render(); return; }

    const hd=t.closest('[data-hday]');
    if(hd){ const o=byId(S.openId); const ds=hd.dataset.hday; const i=o.history.indexOf(ds);
      if(i>=0) o.history.splice(i,1); else o.history.push(ds); renderSheet(); render(); return; }

    const ut=t.closest('[data-untag]');
    if(ut){ const o=byId(S.openId); o.tags=o.tags.filter(x=>x!==ut.dataset.untag); renderSheet(); render(); return; }

    // a tag opens the magic drawer that collects it, making one if need be
    const tgd=t.closest('[data-tagdrawer]');
    if(tgd){ closeSheet(); drawerForTag(tgd.dataset.tagdrawer); return; }

    const sh=t.closest('[data-sheet]');
    if(sh){ const v=sh.dataset.sheet;
      if(v==='close') closeSheet();
      else if(v==='del') del(S.openId);
      else if(v==='done'){ toggleDone(S.openId); renderSheet(); }
      else { S.editing = v==='write'; renderSheet(); }
      return; }

    const a=t.closest('[data-act]'); if(a){ act(a.dataset.act,a); return; }

    const vw=t.closest('[data-view]');
    if(vw){ S.view=vw.dataset.view; S.drawerId=null; S.kindFilter=null; render(); return; }

    // a control object on the desk
    const ctl=t.closest('[data-ctl]');

    // shift/⌘ click builds a selection, Finder-style, instead of opening
    const tile=t.closest('.grid .drawer');
    if(tile && (e.shiftKey||e.metaKey||e.ctrlKey)){
      const id=tile.dataset.drawer||tile.dataset.row||tile.dataset.id;
      if(id){ const i=S.sel.indexOf(id);
        if(i>=0) S.sel.splice(i,1); else S.sel.push(id);
        render(); }
      return;
    }
    // a plain click anywhere clears the selection before doing anything else
    if(S.sel.length && !t.closest('#ctx')) S.sel=[];

    // a breadcrumb, a tile, or a button on the pin bar — all open the drawer
    const dr=t.closest('[data-drawer]');
    if(dr && (dr.tagName==='B' || dr.classList.contains('drawer') || dr.classList.contains('pinbtn'))){
      S.view='drawer'; S.drawerId=dr.dataset.drawer; S.kindFilter=null; render(); return; }

    // anything else carrying an id — a tile on a grid, or a mini row in a panel
    const ro=t.closest('[data-row]');
    if(ro && !ro.classList.contains('row')){
      // a tile on a grid obeys the object's own click behaviour; everything
      // else (cards, timeline rows) still opens the editor
      if(ro.closest('.grid')) tileTap(ro.dataset.row); else openObj(ro.dataset.row);
      return;
    }

    const kf=t.closest('[data-kind]');
    if(kf && kf.classList.contains('fchip')){ S.kindFilter=kf.dataset.kind||null; render(); return; }
    const kk=t.closest('[data-kk]');
    if(kk){ const d=draft(), k=kk.dataset.kk, i=d.kinds.indexOf(k);
      if(i>=0) d.kinds.splice(i,1); else d.kinds.push(k);
      kk.classList.toggle('on'); return; }
    const pv=t.closest('[data-pv]');
    if(pv){ draft().pv=pv.dataset.pv; only(pv,'#dpv button'); return; }
    const col=t.closest('[data-col]');
    if(col){ draft().c=col.dataset.col; only(col,'#dcol button'); renderPreview(); return; }

    const dtg=t.closest('[data-dtag]');
    if(dtg){ draft().tag=dtg.dataset.dtag; only(dtg,'#dtag button'); return; }

    const pn=t.closest('[data-pview],[data-pface],[data-psort],[data-plock],[data-ppin],[data-pborder],[data-pknob],[data-pcolour],[data-pboard],[data-pknobc],[data-pknobtone],[data-pknobpos],[data-ptexture],[data-otype],[data-oclick],[data-oshape],[data-oedge],[data-ocolour],[data-oframe],[data-obtn],[data-ogen],[data-ogendir]');
    if(pn){
      const id=pn.dataset.id, c=cfgOf(id), o=byId(id);
      if(pn.dataset.pview!=null) c.layout=pn.dataset.pview;
      else if(pn.dataset.ppin!=null) setPin(id, !!pn.dataset.ppin);   // S.pins, not the object

      else if(o && pn.dataset.pface!=null) o.face=pn.dataset.pface;
      else if(pn.dataset.psort!=null) c.sort=pn.dataset.psort||null;
      else if(pn.dataset.plock!=null) c.locked=!!pn.dataset.plock;
      else if(o && pn.dataset.pborder!=null) o.border=pn.dataset.pborder;
      else if(o && pn.dataset.pknob!=null) o.knob=pn.dataset.pknob;
      else if(o && pn.dataset.pcolour!=null) o.c=pn.dataset.pcolour;
      else if(o && pn.dataset.pboard!=null) o.board=pn.dataset.pboard||null;
      else if(o && pn.dataset.pknobc!=null){ o.knobc=pn.dataset.pknobc; o.knobtone=null; }
      else if(o && pn.dataset.pknobtone!=null){ o.knobtone=pn.dataset.pknobtone; o.knobc=null; }
      else if(o && pn.dataset.pknobpos!=null) o.knobpos=pn.dataset.pknobpos;
      else if(o && pn.dataset.ptexture!=null) o.texture=pn.dataset.ptexture;
      else if(o && pn.dataset.otype!=null){ o.kind=pn.dataset.otype; o.attrs=null; }
      else if(o && pn.dataset.oclick!=null) o.onclick=pn.dataset.oclick;
      else if(o && pn.dataset.oshape!=null) o.shape=pn.dataset.oshape;
      else if(o && pn.dataset.oedge!=null) o.edge=!!pn.dataset.oedge;
      else if(o && pn.dataset.ocolour!=null) o.c=pn.dataset.ocolour;
      else if(o && pn.dataset.oframe!=null) o.frame=pn.dataset.oframe;
      else if(o && pn.dataset.obtn!=null) o.btnshape=pn.dataset.obtn;
      else if(o && pn.dataset.ogen!=null) o.genKind=pn.dataset.ogen;
      else if(o && pn.dataset.ogendir!=null) o.genDir=pn.dataset.ogendir;
      save(); render();
      refreshPanel();          // rebuild from state, so the marks follow
      return;
    }

    // attributes, in the new-kind modal
    // what sort of thing it is decides which structural traits it carries
    const ks=t.closest('[data-ksort]');
    if(ks){ const d=draft(), v=ks.dataset.ksort; d.sort=v;
      d.attrs=d.attrs.filter(a=>a!=='container'&&a!=='magic');
      if(v!=='object') d.attrs.push('container');
      if(v==='magic') d.attrs.push('magic');
      only(ks,'#ksort button');
      // the Look row swaps between shapes and faces
      const list = v==='object' ? Object.entries(SHAPES) : Object.entries(FACES);
      const cur  = v==='object' ? d.shape : d.face;
      $('#klookn').textContent = v==='object' ? 'shape' : 'face';
      $('#klook').innerHTML = list.map(([val,nm])=>
        `<button class="pchip${cur===val?' on':''}" data-klook="${val}">${nm}</button>`).join('');
      renderPreview(); return; }
    const kl=t.closest('[data-klook]');
    if(kl){ const d=draft();
      if(d.sort==='object') d.shape=kl.dataset.klook; else d.face=kl.dataset.klook;
      only(kl,'#klook button'); renderPreview(); return; }
    const kic=t.closest('[data-kic]');
    if(kic){ draft().ic=kic.dataset.kic; only(kic,'#kicon button'); renderPreview(); return; }
    const ksp=t.closest('[data-kspawn]');
    if(ksp){ draft().spawnBy=ksp.dataset.kspawn;
      only(ksp,'[data-kspawn]'); renderPreview(); return; }

    const ksz=t.closest('[data-ksz]');
    if(ksz){ const [w,h]=ksz.dataset.ksz.split('x').map(Number);
      draft().size=[w,h]; only(ksz,'#ksize button'); renderPreview(); return; }
    const kcl=t.closest('[data-kclick]');
    if(kcl){ draft().onclick=kcl.dataset.kclick; only(kcl,'#kclick button'); renderPreview(); return; }

    const ka=t.closest('[data-ka]');
    if(ka){ const d=draft(), a=ka.dataset.ka, i=d.attrs.indexOf(a);
      if(i>=0) d.attrs.splice(i,1); else d.attrs.push(a);
      ka.classList.toggle('on');
      const sp=$('#kspawnrow'); if(sp) sp.style.display = d.attrs.includes('spawn') ? '' : 'none';
      $('#kattrsds').textContent = d.attrs.map(x=>ATTRS[x]&&ATTRS[x].ds).filter(Boolean).join(' · ') || 'Nothing yet';
      renderPreview(); return; }

    // attributes, on one object — from its panel or from the detail sheet
    const at=t.closest('[data-attr]');
    if(at){ const o=byId(at.dataset.id||S.openId); if(!o) return;
      const cur=attrsOf(o).slice(), a=at.dataset.attr, i=cur.indexOf(a);
      if(i>=0) cur.splice(i,1); else cur.push(a);
      o.attrs=cur;
      save(); refreshPanel(); renderSheet(); render(); return; }

    // how a drawer lays its contents out, from the drawer's own toolbar
    const lm=t.closest('[data-layoutmode]');
    if(lm){ const d=byId(S.drawerId); if(d){ d.layout=lm.dataset.layoutmode; save(); render(); } return; }

    // a button object's button


    const lk=t.closest('[data-look]');
    if(lk){ setLookVal(lk.dataset.look, lk.dataset.val||null);
      applyLook(); save(); render(); return; }

    const th=t.closest('[data-theme2]'); if(th){ S.theme=th.dataset.theme2; applyLook(); save(); render(); return; }
    const ly=t.closest('[data-layout]');
    // you chose a layout to go and arrange, so get the sheet out of the way
    if(ly){ S.layoutEdit = ly.dataset.layout || null; S.view='desk'; closePanel(); render(); return; }

    // the size chip still cycles presets — quicker than dragging on a phone.
    // It keeps the drawer where it is and skips any preset that would collide.
    const sz=t.closest('[data-size]');
    if(sz){ const d=byId(sz.dataset.size), g=gridOf(), cur=lay(d);
      const P = dev()==='desk' ? [[2,2],[4,4],[6,6],[8,6],[12,8],[6,12],[24,8]]
                               : [[2,2],[4,4],[8,6],[8,8],[16,6],[16,12]];
      const i=P.findIndex(p=>p[0]===cur.w&&p[1]===cur.h);
      for(let n=1;n<=P.length;n++){
        const [w,h]=P[(i+n)%P.length];
        const box={x:Math.min(cur.x, g.cols-w+1), y:cur.y, w, h};
        if(boxOk(box,d.id,dev(),d.parent)){ d[dev()]=box; save(); render(); return; }
      }
      toast('No room to resize — move it first'); return; }
    const dd=t.closest('[data-delDrawer]');
    if(dd){ const id=dd.dataset.deldrawer, o=byId(id), up=(o&&o.parent)||ROOT;
      S.objects.forEach(x=>{ if(x.parent===id) x.parent=up; });
      S.objects=S.objects.filter(x=>x.id!==id); save(); render(); return; }

    const cr=t.closest('[data-cmd]'); if(cr){ runCmd(+cr.dataset.cmd); return; }

    if(t.id==='cmdscrim') closeCmd();
  });

  /* Settings shows state it can also change, so anything pressed inside it
     leaves it stale. Rebuilding here rather than in a dozen handlers keeps its
     controls out of act() — and this listener runs after the main one above, so
     the change has already happened. Settings only: every other panel either
     doesn't display what it changes, or refreshes itself where it does. */
  frame.addEventListener('click', e=>{
    if(panelKey()!=='settings' || !e.target.closest('#panel')) return;
    if(e.target.closest('[data-look],[data-theme2],[data-palette],[data-style3],[data-act]'))
      refreshPanel();
  });

  // inline field edits
  frame.addEventListener('input', e=>{
    // colour pickers: live preview while dragging, committed on 'change'
    if(e.target.dataset.tlzoom!=null){
      const o=byId(e.target.dataset.id); if(o){ o.tlzoom=+e.target.value; save(); render(); }
      return;
    }
    if(e.target.dataset.palpha!=null){
      const o=byId(e.target.dataset.id); if(o){ o.boardAlpha=(+e.target.value)/100; save(); render(); }
      return;
    }
    const lr=e.target.dataset.lookrange;
    if(lr){ S.look[lr]=(+e.target.value)/100; applyLook();
      const b=e.target.parentElement.querySelector('b'); if(b) b.textContent=e.target.value+'%'; return; }
    const li=e.target.dataset.lookinput;
    if(li==='board1'||li==='board2'){
      const cur=(lookVal('board')||'#EFEADA|#DDE5CE').split('|');
      cur[li==='board1'?0:1]=e.target.value; setLookVal('board', cur.join('|'));
      applyLook(); return;
    }
    if(li==='owner'){ S.look.owner=e.target.value; save(); return; }
    if(li){ setLookVal(li, e.target.value); applyLook(); return; }
    if(e.target.dataset.colinput!=null){
      const d=draft(); if(d){ d.c=e.target.value;
        $$('#dcol button').forEach(b=>b.classList.remove('on')); renderPreview(); }
      return;
    }
    if(e.target.id==='knm'){ renderPreview(); return; }
    const f=e.target.dataset.f;
    if(f){
      const o=byId(S.openId); if(!o) return;
      if(f==='title'){ o.title=e.target.value; e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }
      else if(f==='body') o.body=e.target.value;
      else if(f==='due') o.due=e.target.value||null;
      else if(f==='repeat') o.repeat=e.target.value||null;
      else if(f==='parent'){
        const v=e.target.value;
        if(v!==o.id && !isAncestor(o.id, container(v))) o.parent=v;
        else toast('A drawer cannot go inside itself');
      }
      else if(f==='layout'){ o.layout=e.target.value; render(); }
      else if(f==='onclick'){ o.onclick=e.target.value; save(); render(); }
      else if(f==='url') o.url=e.target.value;
      else if(f==='loc') o.loc=e.target.value;
      else if(f==='dur') o.dur=e.target.value?+e.target.value:null;
      else if(f==='price') o.price=e.target.value;
      else if(f==='prio'){ o.prio=e.target.value||null; render(); }
      else if(f==='btnshape'){ o.btnshape=e.target.value; render(); }
      else if(f==='frame'){ o.frame=e.target.value; save(); render(); }
      else if(f==='linklabel'){ o.link=o.link||{}; o.link.label=e.target.value; }
      else if(f==='linktarget'){ o.link=o.link||{}; o.link.target=e.target.value; }
      else if(f==='linkurl'){ o.link=o.link||{}; if(e.target.value) o.link.target=e.target.value; }
      else if(f==='mtype'){ o.media=o.media||{label:'untitled'}; o.media.type=e.target.value; renderSheet(); }
      else if(f==='kind'){ o.kind=e.target.value; if(has(o,'progress')&&!o.milestones.length) o.milestones=[{t:'First milestone',done:false,d:dz(30)}]; renderSheet(); }
      return;
    }
    if(e.target.dataset.mtext!=null){ byId(S.openId).milestones[+e.target.dataset.mtext].t=e.target.value; return; }
    if(e.target.dataset.mdate!=null){ byId(S.openId).milestones[+e.target.dataset.mdate].d=e.target.value; return; }
    if(e.target.id==='cmdinput'){ cmdList(e.target.value); return; }
  });

  frame.addEventListener('change', e=>{
    if(e.target.id==='imgpicker' && e.target.files && e.target.files[0]){
      importImage(e.target.files[0]); e.target.value='';
    }
    if(e.target.id==='importer' && e.target.files && e.target.files[0]){
      importBackup(e.target.files[0]); e.target.value='';
    }
    // re-render only once the picker closes, so it doesn't die mid-drag
    if(e.target.dataset.lookinput){ save(); render(); refreshPanel(); }
    if(e.target.dataset.lookrange){ save(); render(); refreshPanel(); }
  });

  frame.addEventListener('keydown', e=>{
    if(e.target.dataset.fieldfor && e.key==='Enter'){
      const src=byId(e.target.dataset.fieldfor), text=e.target.value.trim();
      if(!text) return;
      const t=create('task',{parent:src.parent, title:text});
      // land it directly beneath the field that made it
      const b=lay(src), g=gridOf();
      const want={x:b.x, y:b.y+b.h, w:b.w, h:1};
      t[dev()] = boxOk(want,t.id,dev(),src.parent) ? want : freeSpot(b.w,1,dev(),src.parent);
      e.target.value=''; save(); render();
      const el=document.querySelector(`[data-fieldfor="${src.id}"]`); el&&el.focus();
      return;
    }
    if(e.target.dataset.dayadd && e.key==='Enter'){
      const [did,iso]=e.target.dataset.dayadd.split(':');
      const o=quickAdd(e.target.value, 'task', did);
      if(o){ o.due=iso; e.target.value=''; save(); render();
        const el=document.querySelector(`[data-dayadd="${did}:${iso}"]`); el&&el.focus(); }
      return;
    }
    if(e.target.id==='qa' && e.key==='Enter'){
      const o=quickAdd(e.target.value, e.target.dataset.kind, e.target.dataset.drawer);
      e.target.value=''; if(o){ render(); setTimeout(()=>{const q=$('#qa'); q&&q.focus();},0); toast('Added'); }
      return;
    }
    if(e.target.id==='cmdinput'){
      if(e.key==='Enter'){ runCmd(0); }
      if(e.key==='Escape'){ closeCmd(); }
    }
  });

  document.addEventListener('keydown', e=>{
    const typing = /input|textarea/i.test(document.activeElement.tagName);
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); openCmd(); return; }
    if(e.key==='Escape'){ closeCtx(); closeCmd(); closePanel();
      if(S.openId||S.readId) closeSheet(); return; }
    if(typing) return;
    if(e.key==='n'||e.key==='N'){ e.preventDefault(); modalNewObject(); return; }
    if(panelKey()==='newobject'){
      const k=KEYS.find(x=>KINDS[x].key.toLowerCase()===e.key.toLowerCase());
      if(k){ closePanel(); const o=create(k); render(); openObj(o.id); S.editing=true; renderSheet(); }
    }
  });

  // the device decides which layout you see; the OS decides the default theme
  const wide = window.matchMedia('(min-width: 900px)');
  const addML = (mq, fn)=> mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn);
  addML(wide, ()=>{ S.device = sensedDevice(); render(); });
  addML(window.matchMedia('(prefers-color-scheme: dark)'), ()=>{ if(S.theme==='auto') render(); });

  // Device is sensed once at parse time, when the window may not be laid out
  // yet (a background tab reports zero width and reads as a phone). Re-sense on
  // resize so the desk layout appears as soon as there is a real width.
  window.addEventListener('resize', ()=>{
    const d=sensedDevice();
    if(d!==S.device && !S.layoutEdit){ S.device=d; render(); }
    else sizeGrid();
  });
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); install.deferred=e; refreshPanel(); });
  window.addEventListener('beforeunload', writeNow);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) writeNow(); });
}

export { wire };
