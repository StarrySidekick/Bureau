import { $, $$, esc, ic, uid, D, ROOT } from './util.js';
import { S, K, KINDS, KEYS, refreshKinds, ATTRS, USER_ATTRS, attrsOf, has, SHAPES,
  FACES, SORTS, MANUAL, sortOf, nextSort, byId, container, cfgOf, isContainer, isAncestor, relate,
  unrelate, sensedDevice, reset, T, dz, dev, calViewOf } from './model.js';
import { gridOf, lay, boxOk, freeSpot, toPhoneSize } from './grid.js';
import { applyLook, applyStyle, setLookVal, lookVal, STYLES, randomFront,
  setSlot, palNow, objColour } from './look.js';
import { toast, toggleDone, del, delMany, delDrawer, undo, setPin, togglePin, drawerForTag, create, quickAdd, spawnInto, randomThing } from './mutations.js';
import { spinTo, pending, placeAtPending, tileTap, turnPage, clearPages } from './tiles.js';
import { render, sizeGrid, toggleSettings, reveal, goPage } from './views.js';
import { openObj, openWriter, openRead, closeSheet, renderSheet, words } from './sheet.js';
import { openPanel, closePanel, refreshPanel, panelKey, draft, openMenu,
  modalNewObject, modalNewKind, modalMove, renderPreview,
  drawerPanel, objectPanel,
  drawerFromSelection, openCtx, closeCtx, openCmd, closeCmd, cmdList, runCmd } from './panels.js';
import { onDown, onMove, onUp, onCancel, onTouchStart, onTouchMove, onTouchEnd,
  gestureFlags, dragArmed } from './gestures.js';
import { enter, askTilt, pagerOn } from './motion.js';
import { save, writeNow, exportBackup, importBackup, importImage, imgFor, pasteObjects, install } from './persist.js';

/* Mark one chip in a group as the chosen one. The selector is deliberately
   class-agnostic — the chips in these groups have changed class twice. */
function only(el, sel){ $$(sel).forEach(b=>b.classList.remove('on')); el.classList.add('on'); }

/* A type's starting size is a preset *and* a pair of sliders, so whichever one
   you move has to drag the other with it. The phone pair follows the derived
   size until you touch it — that is the whole meaning of "Work it out for me",
   and it has to keep following while you are still changing the Mac size. */
function syncSize(){
  const d=draft(); if(!d) return;
  const put=(p,[w,h])=>{
    const wi=$(`[data-${p}szw]`), hi=$(`[data-${p}szh]`), out=$(`#${p}szout`);
    if(wi) wi.value=w;
    if(hi) hi.value=h;
    if(out) out.textContent=`${w} × ${h}`;
  };
  put('k', d.size);
  put('kp', d.phoneSize || toPhoneSize(d.size[0], d.size[1], d.attrs.includes('container')));
  $$('#ksize button').forEach(b=>b.classList.toggle('on', b.dataset.ksz===d.size.join('x')));
  const auto=$('[data-kphauto]'); if(auto) auto.classList.toggle('on', !d.phoneSize);
}

/* A swatch carries either a slot number or a literal hex. The DOM only has
   strings, so this is where the two are told apart again. */
const slotVal = v => /^\d+$/.test(v) ? +v : v;

/* ---- one writer for the whole object settings panel --------------------
   `data-oset` is "<id>:<key>". Where the write lands is cfgOf(), which is the
   desk's own settings for the desk and the object itself for everything else —
   so the desk is a container without a tile rather than a branch. A dotted key
   is nested: `rule.f` is filter.rule.f, `roll.fn` is the rollup's function.
   Everything else is the field of that name, with '' meaning "unset". */
const BOOLSET = ['locked','edge','weekends'];
function setField(el){
  const raw=el.dataset.oset||'', i=raw.indexOf(':');
  const id=raw.slice(0,i), key=raw.slice(i+1);
  const o=byId(id), t=cfgOf(id);
  if(!t) return;
  const v=el.value;
  switch(key){
    case 'pin': setPin(id, v||null); break;   // '', 'top' or 'bottom'
    case 'kind':
      if(!o || !KINDS[v]) break;
      o.kind=v; o.attrs=null;
      if(has(o,'progress') && !(o.milestones||[]).length)
        o.milestones=[{t:'First milestone',done:false,d:dz(30)}];
      break;
    // a new container is a new coordinate space, so the boxes go with the move
    case 'parent':
      if(!o) break;
      if(v===id || isAncestor(id, container(v))){ toast('A drawer cannot go inside itself'); break; }
      if(o.parent!==v){ o.parent=v; o.desk=null; o.phone=null; }
      break;
    case 'knobtone': t.knobtone=v; t.knobc=null; break;
    case 'dur': t.dur = v===''?null:+v; break;
    case 'mtype': if(o) o.media=Object.assign({label:'untitled'}, o.media, {type:v}); break;
    case 'linklabel': case 'linktarget': case 'linkurl': {
      if(!o) break;
      o.link=Object.assign({label:'Open',target:''}, o.link);
      if(key==='linklabel') o.link.label=v;
      else if(key==='linktarget'){ if(v) o.link.target=v; }
      else if(v) o.link.target=v;
      break;
    }
    case 'rule.f': case 'rule.op': case 'rule.v': {
      if(!o) break;
      o.filter=Object.assign({}, o.filter);
      const r=Object.assign({op:'is'}, o.filter.rule);
      r[key.slice(5)]=v;
      o.filter.rule = r.f ? r : undefined;
      break;
    }
    case 'filter.tag': if(o) o.filter=Object.assign({}, o.filter, {tag:v||undefined}); break;
    // how far a magic drawer can see — its own desk, all of them, or a chosen few
    case 'filter.scope': if(o) o.filter=Object.assign({}, o.filter, {scope:v||undefined}); break;
    case 'roll.fn': case 'roll.f': {
      if(!o) break;
      const r=Object.assign({}, o.roll);
      r[key.slice(5)] = v||undefined;
      o.roll = r.fn ? r : undefined;
      break;
    }
    default:
      if(BOOLSET.includes(key)) t[key] = !!v;
      else t[key] = v==='' ? null : v;
  }
  save();
}

function act(name, el){
  switch(name){
    case 'new': modalNewObject(); break;
    // a drawer is made the way everything else is, and then talked to
    case 'newdrawer': { const d=create('drawer',{title:'New drawer'}); save(); render(); reveal(d.id); objectPanel(d.id); break; }
    /* Back goes up one, not all the way home. With more than one desk the top
       of the tree is wherever you are working, so walking to the root every
       time was walking past the thing you meant to get back to. */
    case 'back': {
      const o=byId(el.dataset.id), up=(o&&o.parent)||ROOT;
      S.view = up===ROOT ? 'desk' : 'drawer';
      S.drawerId = up===ROOT ? null : up;
      S.kindFilter=null; render(); enter('back'); break;
    }
    /* iOS hands over the motion sensors only from inside a real gesture, which
       is why the holographic foil is a button you press rather than something
       that simply happens. Pressing it again holds the light still. */
    case 'tilt': {
      const r=askTilt();
      toast(r==='off' ? 'The light holds still now'
        : r==='none' ? 'This device has no motion sensor'
        : r==='on'   ? 'Magic drawers follow how it moves'
        : 'Asked for motion access');
      break;
    }
    case 'pin': togglePin(el.dataset.id); break;
    // one step is one screenful, so it steps by whatever the calendar is showing
    case 'monthstep': {
      const d=byId(el.dataset.id); if(!d) return;
      const n=+el.dataset.step||0, v=calViewOf(d);
      const a=D.parse(d.month||T)||D.today();
      if(v==='day') a.setDate(a.getDate()+n);
      else if(v==='week') a.setDate(a.getDate()+7*n);
      else { a.setDate(1); a.setMonth(a.getMonth()+n); }
      d.month=D.iso(a);
      save(); render(); break;
    }
    case 'monthtoday': {
      const d=byId(el.dataset.id); if(!d) return;
      d.month=T; S.calDay=T; save(); render(); break;
    }
    case 'cancel': closePanel(); break;
    // one Delete, whatever it is: a container keeps its contents, everything
    // else is the ordinary undoable delete
    case 'delthis': {
      const id=el.dataset.id, o=byId(id); if(!o) return;
      closePanel();
      if(isContainer(o)) delDrawer(id); else del(id);
      save(); break;
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
          `<div class="row" data-dorel="${me}:${x.id}" style="--k:${objColour(x)}">
            <span class="kindmark">${ic(K(x.kind).ic,13)}</span>
            <div class="body"><div class="title">${esc(x.title||'Untitled')}</div>
              <div class="snip">${esc(K(x.kind).nm)}</div></div></div>`).join('')}</div>`});
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
        // null, not undefined: Object.assign over `base` has to be able to
        // *clear* an override an edited type used to carry
        phoneSize:dk.phoneSize||null,
        onclick:dk.onclick||'read', body:base.body||'',
        read: dk.sort==='object' ? (dk.read||'page') : undefined,
        shape: dk.sort==='object' ? (dk.shape||'card') : undefined,
        face:  dk.sort==='object' ? undefined : (dk.face||'front'),
        layout: dk.sort==='object' ? undefined : (base.layout||'grid'),
        // a container type says how its contents are ordered; manual is the
        // answer a drawer gives, and storing it as one keeps it a real choice
        sort: dk.sort==='object' ? undefined : (dk.sortBy||MANUAL),
        gathers: dk.sort==='object' ? (dk.gathers||undefined) : undefined,
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
      const o=byId(el.dataset.id||S.openId); if(!o) return;
      const t=prompt('Tag'); if(t){ o.tags=o.tags||[]; const v=t.trim().replace(/^#/,'');
        if(v && !o.tags.includes(v)) o.tags.push(v); save(); refreshPanel(); render(); }
      break;
    }
    case 'addmile': { const o=byId(el.dataset.id||S.openId); if(!o) return;
      o.milestones=o.milestones||[]; o.milestones.push({t:'New milestone',done:false,d:dz(30)});
      save(); refreshPanel(); render(); break; }
    case 'dupe': { const o=byId(el.dataset.id||S.openId); if(!o) return;
      const c=Object.assign({},o,{id:uid(isContainer(o)?'d':'o'),title:o.title+' (copy)',
        ord:(o.ord||0)+0.1, desk:null, phone:null});
      S.objects.push(c); closePanel(); save(); render(); reveal(c.id); break; }
    case 'resetslots': {
      const k=(S.look.style)||'victorian';
      if(S.look.slots) delete S.look.slots[k];
      applyLook(); save(); render(); refreshPanel(); toast('Back to the style\u2019s own colours'); break;
    }
    case 'stopedit': S.layoutEdit=null; render(); break;
    case 'export': exportBackup(); break;
    case 'import': $('#importer').click(); break;
    // from an object's Media row the file replaces *that* object's picture;
    // from anywhere else it makes a new one on the board you are looking at
    case 'pickimage': imgFor.id = el.dataset.id || null; $('#imgpicker').click(); break;
    case 'drawersettings': case 'objset': objectPanel(el.dataset.id); break;
    case 'panelclose': closePanel(); break;
    case 'appsettings': toggleSettings(); break;
    // the two surfaces an object opens onto, each reachable from the other
    case 'editthis': openWriter(el.dataset.id); break;
    case 'readthis': openRead(el.dataset.id); break;
    // the spread redraws inside the turn, so whichever surface is showing one
    // has to be the thing that gets redrawn
    case 'bookprev': turnPage(-1, S.readId?renderSheet:render); break;
    case 'booknext': turnPage( 1, S.readId?renderSheet:render); break;
    case 'cycleview': {
      const c=cfgOf(el.dataset.id), order=['grid','list','scroll'];
      c.layout = order[(order.indexOf(c.layout||'grid')+1)%order.length];
      save(); render(); toast(c.layout+' view');
      break;
    }
    // a menu hung off the button, not a modal in the middle of the screen
    /* Sort is a toggle, not a popup. Seven states and the button wears the one
       it is on — a letter where a letter is the answer, an arrow where a
       direction is — so pressing it again is both "change this" and "what is
       it now", which is the only shape that fits a phone's top shelf. */
    case 'sortnext': {
      const id=el.dataset.id, next=nextSort(container(id));
      cfgOf(id).sort = next;
      save(); render();
      toast(next===MANUAL ? 'As you arranged them' : SORTS[next][0]);
      break;
    }
    // locked refuses moves and resizes; the long press still opens the menu
    case 'togglelock': {
      const id=el.dataset.id, c=cfgOf(id);
      c.locked=!c.locked; save(); render();
      toast(c.locked?'Board locked':'Board unlocked');
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
    case 'reseed': { const lk=S.look; reset(); S.look=lk; applyLook(); writeNow(); render(); toast('Sample desk restored'); break; }
    case 'wipe': {
      if(!confirm('Erase every object and drawer on this device? This cannot be undone.')) return;
      // keep three empty drawers so the desk isn't a blank rectangle
      const lk=S.look; reset(); S.look=lk;
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

  /* A finger cannot scroll the page and carry a tile at once, and the browser
     picks which by the time the second touchmove lands. The hold keeps the
     finger still for 300ms, so no scroll has started yet — which is the only
     window in which preventDefault can stop one from starting. Once native
     scrolling is under way the call is ignored, and the listener has to be
     non-passive or it is ignored from the start. This is the whole reason
     dragging did nothing on a phone. */
  /* …and the same is true of a one-finger swipe on a locked board: once the
     strip is following the finger, a native scroll underneath it would be two
     things moving at once. */
  frame.addEventListener('touchmove', e=>{ if(dragArmed()||pagerOn()) e.preventDefault(); }, {passive:false});

  /* Two fingers: pages up and down, pinned drawers left and right. Non-passive
     because a two-finger swipe that also scrolls the page underneath reads as
     two things happening at once. */
  frame.addEventListener('touchstart', onTouchStart, {passive:true});
  frame.addEventListener('touchmove', e=>{
    if(e.touches && e.touches.length===2) e.preventDefault();
    onTouchMove(e);
  }, {passive:false});
  frame.addEventListener('touchend', onTouchEnd, {passive:true});
  frame.addEventListener('touchcancel', onTouchEnd, {passive:true});

  /* iOS reads a long press on ordinary text as "select this", and puts a
     magnifier over the tile you are trying to lift. `user-select:none` is
     supposed to stop it and demonstrably doesn't do so reliably — so refuse
     the selection outright, and let it through only where there is genuinely
     something to select: a field, a page of prose, the writing surface. */
  frame.addEventListener('selectstart', e=>{
    if(e.target.closest && e.target.closest(
      'input,textarea,[contenteditable],.prose,.contbody,.spread .page,.writepaper,.pbody'))
      return;
    e.preventDefault();
  });

  /* Double tap a tile and its name becomes a field where it sits. That is all
     "simple text editing" needs to be for a task or a note — a line and a
     paragraph, neither of which is worth a screen. A container keeps its old
     behaviour: two taps on a drawer opens it twice, which is what you meant.
     `dblclick` fires from two taps on iOS as well as from a mouse, and the
     tiles carry `touch-action:manipulation` so the second tap doesn't zoom. */
  frame.addEventListener('dblclick', e=>{
    if(e.target.closest('input,textarea,select')) return;
    const tile=e.target.closest('.grid .drawer[data-row]');
    if(!tile) return;
    const o=byId(tile.dataset.row);
    if(!o || isContainer(o)) return;
    e.preventDefault();
    S.editId=o.id; S.sel=[];
    render();
    const f=$(`.inlinename[data-inline="${o.id}:title"]`);
    if(f){ f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  });

  frame.addEventListener('contextmenu', e=>{
    // iOS fires this from the same long press that armed the drag
    if(dragArmed()){ e.preventDefault(); return; }
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
    /* Typing into a tile is not clicking the tile. A checklist front carries a
       real input inside a [data-drawer], so without this, reaching for the box
       opens the drawer out from under you. Every field in the app is driven by
       the input/change listeners below, so nothing here wants the click. */
    if(t.closest('input,textarea,select')) return;

    const undoEl=t.closest('[data-undo]'); if(undoEl){ undo(); return; }
    const c=t.closest('[data-c]');
    if(c){ const [cmd,id]=c.dataset.c.split(':'); closeCtx();
      if(cmd==='open'||cmd==='write') openWriter(id);
      else if(cmd==='read') openRead(id);
      else if(cmd==='drawerset'||cmd==='objset') objectPanel(id);
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
        if(sel.length>1) delMany(sel); else del(id);
        save();
      }
      return; }

    const dr2=t.closest('[data-dorel]');
    if(dr2){ const [a,b]=dr2.dataset.dorel.split(':'); relate(a,b); save(); render();
      objectPanel(a); return; }
    const ur=t.closest('[data-unrel]');
    if(ur){ const [a,b]=ur.dataset.unrel.split(':'); unrelate(a,b); save(); refreshPanel(); render(); return; }
    const or2=t.closest('[data-openrel]');
    if(or2){ openObj(or2.dataset.openrel); return; }

    const st=t.closest('[data-star]');
    if(st){ const [id,n]=st.dataset.star.split(':'); const o=byId(id);
      o.rating = (o.rating===+n) ? 0 : +n; save(); refreshPanel(); render(); return; }

    const st3=t.closest('[data-style3]');
    if(st3){ applyStyle(st3.dataset.style3); toast(STYLES[st3.dataset.style3].nm); return; }

    // the page dots in the top shelf: two fingers turn pages, and so do these
    const gp=t.closest('[data-gopage]');
    if(gp){ goPage(S.view==='drawer'?S.drawerId:ROOT, +gp.dataset.gopage); return; }

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
      /* …and then it is scrolled to. A board is a coordinate space, so a new
         object goes in the first free room from the top — which on a phone,
         where objects are full width, is always below everything you can see.
         It landed correctly and looked like nothing had happened. */
      reveal(o.id);
      return; }

    // month / week / day — the same calendar over a different span
    const cv=t.closest('[data-calview]');
    if(cv){ const [id,v]=cv.dataset.calview.split(':');
      const d=byId(id); if(d){ d.calview=v; S.calDay=null; save(); render(); } return; }

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
      save(); render(); refreshPanel(); return; }
    const mdel=t.closest('[data-mdel]');
    if(mdel){ const o=byId(S.openId); if(!o) return;
      o.milestones.splice(+mdel.dataset.mdel,1); save(); refreshPanel(); render(); return; }

    const hd=t.closest('[data-hday]');
    if(hd){ const o=byId(S.openId); if(!o) return;
      const ds=hd.dataset.hday, i=(o.history||[]).indexOf(ds);
      if(i>=0) o.history.splice(i,1); else (o.history=o.history||[]).push(ds);
      save(); refreshPanel(); render(); return; }

    const ut=t.closest('[data-untag]');
    if(ut){ const o=byId(S.openId); if(!o) return;
      o.tags=(o.tags||[]).filter(x=>x!==ut.dataset.untag); save(); refreshPanel(); render(); return; }

    // a tag opens the magic drawer that collects it, making one if need be
    // a tag takes you somewhere else, so what was open about the thing you
    // clicked it on goes with you — panel included, or a bubble is left
    // pointing at a tile that is no longer on the screen
    const tgd=t.closest('[data-tagdrawer]');
    if(tgd){ closePanel(); closeSheet(); drawerForTag(tgd.dataset.tagdrawer); return; }

    const sh=t.closest('[data-sheet]');
    if(sh){ const v=sh.dataset.sheet;
      if(v==='close') closeSheet();
      else if(v==='del') del(S.openId);
      else if(v==='done'){ toggleDone(S.openId); renderSheet(); }
      else { S.editing = v==='write'; renderSheet(); }
      return; }

    const a=t.closest('[data-act]'); if(a){ act(a.dataset.act,a); return; }

    const vw=t.closest('[data-view]');
    if(vw){ const back = S.view!=='desk';
      S.view=vw.dataset.view; S.drawerId=null; S.kindFilter=null; render();
      if(back) enter('back'); return; }

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
      /* A tap on a tile is answered on pointerup, by tileTap — which plays the
         opening and then navigates. The browser sends a click afterwards
         anyway, and it lands here; redrawing the board a second time is
         invisible except that it throws away the arriving board's animation
         with the element carrying it. So: if we are already there, we are
         already there. */
      if(S.view==='drawer' && S.drawerId===dr.dataset.drawer) return;
      // …and a tile that gets here without a tap behind it — the keyboard, or
      // anything synthetic — still opens the way a tile opens
      if(dr.closest('.grid')){ tileTap(dr.dataset.drawer); return; }
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
    if(col){ draft().c=slotVal(col.dataset.col); only(col,'#dcol button'); renderPreview(); return; }

    const dtg=t.closest('[data-dtag]');
    if(dtg){ draft().tag=dtg.dataset.dtag; only(dtg,'#dtag button'); return; }

    /* What is left of the panel's buttons once every one-of-many list became a
       select: swatches, the knob's own colours, and the read switch in the
       reading header — which is a header, not a panel. */
    const pn=t.closest('[data-ocolour],[data-pboard],[data-pknobc],[data-oread],[data-fkind],[data-fdesk]');
    if(pn){
      const id=pn.dataset.id, o=byId(id) || cfgOf(id);
      if(pn.dataset.ocolour!=null) o.c=slotVal(pn.dataset.ocolour);
      else if(pn.dataset.pboard!=null) o.board=pn.dataset.pboard||null;
      else if(pn.dataset.pknobc!=null){ o.knobc=pn.dataset.pknobc; o.knobtone=null; }
      // switching how it reads restarts it at the first page — page 7 of a
      // spread is not page 7 of a single page
      else if(pn.dataset.oread!=null){ o.read=pn.dataset.oread; S.bookAt=0; renderSheet(); }
      else if(pn.dataset.fdesk!=null){
        o.filter=Object.assign({}, o.filter);
        const ds=(o.filter.scopeDesks||[]).slice(), k=pn.dataset.fdesk, i=ds.indexOf(k);
        if(i>=0) ds.splice(i,1); else ds.push(k);
        o.filter.scopeDesks=ds;
      }
      else if(pn.dataset.fkind!=null){
        o.filter=Object.assign({}, o.filter);
        const ks=(o.filter.kinds||[]).slice(), k=pn.dataset.fkind, i=ks.indexOf(k);
        if(i>=0) ks.splice(i,1); else ks.push(k);
        o.filter.kinds=ks;
      }
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
      const rr=$('#kreadrow'); if(rr) rr.style.display = v==='object' ? '' : 'none';
      // the Look row swaps between shapes and faces
      const list = v==='object' ? Object.entries(SHAPES) : Object.entries(FACES);
      const cur  = v==='object' ? d.shape : d.face;
      $('#klookn').textContent = v==='object' ? 'shape' : 'face';
      $('#klook').innerHTML = list.map(([val,nm])=>
        `<button class="pchip${cur===val?' on':''}" data-klook="${val}">${nm}</button>`).join('');
      // only an object gathers — a container is filed into, never piled
      const gr=$('#kgatherrow'); if(gr) gr.style.display = v==='object' ? '' : 'none';
      // …and only a container has contents to put in an order
      const sr=$('#ksortrow'); if(sr) sr.style.display = v==='object' ? 'none' : '';
      renderPreview(); return; }
    const kg=t.closest('[data-kgather]');
    if(kg){ draft().gathers=kg.dataset.kgather; only(kg,'#kgather button'); return; }
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
      draft().size=[w,h]; only(ksz,'#ksize button'); syncSize(); renderPreview(); return; }
    // back to the derived phone size: the sliders go with it
    const kpa=t.closest('[data-kphauto]');
    if(kpa){ draft().phoneSize=null; only(kpa,'#kphone button'); syncSize(); renderPreview(); return; }
    const kcl=t.closest('[data-kclick]');
    if(kcl){ draft().onclick=kcl.dataset.kclick; only(kcl,'#kclick button'); renderPreview(); return; }
    const krd=t.closest('[data-kread]');
    if(krd){ draft().read=krd.dataset.kread; only(krd,'#kread button'); return; }

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

    const ly=t.closest('[data-layout]');
    // you chose a layout to go and arrange, so get the sheet out of the way
    if(ly){ S.layoutEdit = ly.dataset.layout || null; S.view='desk'; closePanel(); render(); return; }

    // the size chip still cycles presets — quicker than dragging on a phone.
    // It keeps the drawer where it is and skips any preset that would collide.
    const sz=t.closest('[data-size]');
    if(sz){ const d=byId(sz.dataset.size), g=gridOf(), cur=lay(d);
      const P = dev()==='desk' ? [[2,2],[4,4],[6,6],[8,6],[12,8],[6,12],[24,8]]
                               : [[1,1],[2,2],[4,3],[4,4],[8,3],[8,6],[8,10]];
      const i=P.findIndex(p=>p[0]===cur.w&&p[1]===cur.h);
      for(let n=1;n<=P.length;n++){
        const [w,h]=P[(i+n)%P.length];
        const box={x:Math.min(cur.x, g.cols-w+1), y:cur.y, w, h};
        if(boxOk(box,d.id,dev(),d.parent)){ d[dev()]=box; save(); render(); return; }
      }
      toast('No room to resize — move it first'); return; }
    const dd=t.closest('[data-delDrawer]');
    if(dd){ delDrawer(dd.dataset.deldrawer); save(); return; }

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
    if(e.target.closest('[data-look],[data-slot],[data-style3],[data-act]'))
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
    // the type builder's size sliders — the Mac pair, then the phone pair
    if(e.target.dataset.kszw!=null || e.target.dataset.kszh!=null){
      const d=draft(); if(!d) return;
      d.size=[+$('[data-kszw]').value, +$('[data-kszh]').value];
      syncSize(); renderPreview(); return;
    }
    if(e.target.dataset.kpszw!=null || e.target.dataset.kpszh!=null){
      const d=draft(); if(!d) return;
      d.phoneSize=[+$('[data-kpszw]').value, +$('[data-kpszh]').value];
      syncSize(); renderPreview(); return;
    }
    const lr=e.target.dataset.lookrange;
    if(lr){ S.look[lr]=(+e.target.value)/100; applyLook();
      const b=e.target.parentElement.querySelector('b'); if(b) b.textContent=e.target.value+'%'; return; }
    // repainting one slot of the style showing — it belongs to that style
    if(e.target.dataset.slot!=null){
      setSlot(+e.target.dataset.slot, e.target.value); applyLook(); render(); return;
    }
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
    /* The object settings panel. A select is answered on `change` below; a
       field is answered here, keystroke by keystroke, and deliberately does
       *not* refresh the panel — the input is the thing being typed in. render()
       rebuilds #app only, so the field survives it. */
    if(e.target.dataset.oset!=null && e.target.tagName!=='SELECT'){
      setField(e.target); render(); return;
    }
    /* Typing into a tile on the board. Same rule, one step further: no render()
       at all, because the input *is* the tile — rebuilding it would take the
       caret with it. The next ordinary render agrees. */
    if(e.target.dataset.inline!=null){
      const raw=e.target.dataset.inline, i=raw.indexOf(':');
      const o=byId(raw.slice(0,i)); if(!o) return;
      o[raw.slice(i+1)]=e.target.value;
      o.edited=new Date().toISOString().slice(0,10);
      save(); return;
    }
    /* Answering a question. No render() — the input is the thing being typed
       in, and rebuilding the board underneath would take the caret with it. The
       answered/unanswered class is toggled here instead, and the next ordinary
       render agrees with it. */
    if(e.target.dataset.answer!=null){
      const o=byId(e.target.dataset.answer); if(!o) return;
      o.answer=e.target.value;
      const tile=e.target.closest('.drawer');
      if(tile){ const on=!!o.answer.trim();
        tile.classList.toggle('answered', on); tile.classList.toggle('unanswered', !on); }
      save(); return;
    }
    /* The writing surface: a title and a body, and nothing else on the screen.
       No render() while you type — the board is behind a scrim and the word
       count is the only thing that has anything to say. */
    const w=e.target.dataset.w;
    if(w){
      const o=byId(S.writeId); if(!o) return;
      o[w]=e.target.value;
      o.edited=new Date().toISOString().slice(0,10);
      if(w==='title'){ e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }
      else { const c=$('#wcount'); if(c) c.textContent=words(o.body)+' words'; }
      save(); return;
    }
    if(e.target.dataset.mtext!=null){ const o=byId(S.openId);
      if(o) { o.milestones[+e.target.dataset.mtext].t=e.target.value; save(); } return; }
    if(e.target.dataset.mdate!=null){ const o=byId(S.openId);
      if(o) { o.milestones[+e.target.dataset.mdate].d=e.target.value; save(); } return; }
    if(e.target.id==='cmdinput'){ cmdList(e.target.value); return; }
  });

  frame.addEventListener('change', e=>{
    // a select answers once, on change — and then the panel agrees with itself,
    // because half its rows only exist depending on the answers above them
    if(e.target.dataset.oset!=null && e.target.tagName==='SELECT'){
      setField(e.target); render(); refreshPanel(); return;
    }
    if(e.target.dataset.ksort2!=null){ const d=draft(); if(d) d.sortBy=e.target.value; return; }
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
      const o=spawnInto(byId(did), e.target.value, {due:iso});
      if(o){ e.target.value=''; save(); render();
        const el=document.querySelector(`[data-dayadd="${did}:${iso}"]`); el&&el.focus(); }
      return;
    }
    /* The box at the top of a container that takes typing — on its front, and
       inside it. The input is rebuilt by the render, so focus goes back to
       whichever one is there afterwards: type, return, type, return. */
    if(e.target.dataset.contadd && e.key==='Enter'){
      const id=e.target.dataset.contadd, c=byId(id);
      const o=spawnInto(c, e.target.value);
      if(o){ e.target.value=''; save(); render();
        const el=document.querySelector(`[data-contadd="${id}"]`); el&&el.focus(); }
      return;
    }
    /* Finishing an inline edit. Return commits the name (and moves to the body
       if there is one); Escape puts the tile back. The value is already in the
       object — the input listener wrote it — so this only puts the tile down. */
    if(e.target.dataset.inline!=null){
      const body=$(`.inlinebody[data-inline="${S.editId}:body"]`);
      if(e.key==='Escape'){ e.preventDefault(); S.editId=null; render(); return; }
      if(e.key==='Enter' && e.target.classList.contains('inlinename')){
        e.preventDefault();
        // …but only if the tile is actually showing one. A sliver is a single
        // band with its body hidden, and you cannot focus what isn't drawn —
        // so on a task Return finishes, which is what it should mean there.
        if(body && body.offsetParent) body.focus();
        else { S.editId=null; render(); }
        return;
      }
      if(e.key==='Enter' && (e.metaKey||e.ctrlKey)){ e.preventDefault(); S.editId=null; render(); }
      return;
    }
    if(e.target.id==='cmdinput'){
      if(e.key==='Enter'){ runCmd(0); }
      if(e.key==='Escape'){ closeCmd(); }
    }
  });

  /* Tapping anywhere else puts an inline edit down. Not `blur`: moving from
     the name to the body is a blur, and so is the keyboard closing itself. */
  frame.addEventListener('pointerdown', e=>{
    if(!S.editId) return;
    if(e.target.closest(`[data-inline^="${S.editId}:"]`)) return;
    S.editId=null;
    setTimeout(render, 0);      // let the click that started this land first
  }, true);

  document.addEventListener('keydown', e=>{
    const typing = /input|textarea/i.test(document.activeElement.tagName);
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); openCmd(); return; }
    if(e.key==='Escape'){ closeCtx(); closeCmd(); closePanel();
      if(S.writeId||S.readId) closeSheet();
      else if(S.editId){ S.editId=null; render(); }
      return; }
    if(typing) return;   // in a field, ⌘Z is the browser's to answer, not ours
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); save(); return; }
    if(e.key==='n'||e.key==='N'){ e.preventDefault(); modalNewObject(); return; }
    if(panelKey()==='newobject'){
      const k=KEYS.find(x=>KINDS[x].key.toLowerCase()===e.key.toLowerCase());
      // it lands on the board and is scrolled to, the same as picking its tile
      if(k){ closePanel(); const o=create(k); save(); render(); reveal(o.id); }
    }
  });

  // the device decides which layout you see; the OS decides the default theme
  const wide = window.matchMedia('(min-width: 900px)');
  const addML = (mq, fn)=> mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn);
  addML(wide, ()=>{ S.device = sensedDevice(); render(); });

  // Device is sensed once at parse time, when the window may not be laid out
  // yet (a background tab reports zero width and reads as a phone). Re-sense on
  // resize so the desk layout appears as soon as there is a real width.
  window.addEventListener('resize', ()=>{
    const d=sensedDevice();
    // a resized window is a resized sheet, so where the pages break moves too
    clearPages();
    if(d!==S.device && !S.layoutEdit){ S.device=d; render(); }
    else { sizeGrid(); if(S.readId) renderSheet(); }
  });
  window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); install.deferred=e; refreshPanel(); });
  window.addEventListener('beforeunload', writeNow);
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) writeNow(); });
}

export { wire };
