import { esc, ic, clamp, D, md, strip } from './util.js';
import { S, K, T, byId, has, isContainer, faceOf, shapeOf, readOf, spreadOf, childrenOf, container,
  rollup, streak, goalPct, projectStat, tlSpan, dev, spawnByOf, genKindOf, takesTyping,
  knobSizeOf, answered, sortOf, spanOf, coversDay, iconOf, textSizeOf, isPicture,
  calViewOf, weekStartOf, calCols } from './model.js';
import { CELL, COLW, gridOf, lay, overlaps, boxOk, freeSpot, gridRows, sizeOfKind, ensureBox,
  pageRows } from './grid.js';
import { create, toast, toggleDone } from './mutations.js';
import { hexOf, objColour } from './look.js';
import { render, pageAt } from './views.js';
import { openObj, openWriter, openRead, openViewer, renderSheet } from './sheet.js';
import { objectPanel } from './panels.js';
import { openTile, openingFor } from './motion.js';
import { save } from './persist.js';

/* ============================================================
   7 · rendering — drawers
   ============================================================ */
function drawerPreview(d, items){
  const c=objColour(d), f=d.filter||{};
  if(d.pv==='big'){
    const n=items.length;
    const cap = f.done ? 'accomplishments on record' : 'due today';
    return `<div class="pv-big"><div class="num">${n}</div><div class="cap">${cap}</div></div>`;
  }
  if(d.pv==='stack'){
    return `<div class="pv-stack">${items.slice(0,3).map((o,i)=>
      `<div class="card" style="--k:${objColour(o)};--rot:${(i-1)*0.8}deg;top:${i*34}px;z-index:${3-i}">${esc(o.title||'Untitled')}</div>`).join('')}</div>`;
  }
  if(d.pv==='thumbs'){
    return `<div class="pv-thumbs">${items.slice(0,6).map(o=>`<i style="--k:${objColour(o)}"></i>`).join('')||'<i style="--k:'+c+'"></i>'}</div>`;
  }
  if(d.pv==='bars'){
    return `<div class="pv-bars">${items.slice(0,4).map(o=>{
      const p = has(o,'progress') ? goalPct(o) : clamp(streak(o)*14,6,100);
      return `<div class="b" style="--k:${objColour(o)}"><i style="width:${p}%"></i></div>`;}).join('')}</div>`;
  }
  return `<div class="pv-list">${items.slice(0,5).map(o=>
    `<div class="r${o.done?' done':''}" style="--k:${objColour(o)}"><span class="dot"></span><span class="lbl">${esc(o.title||'Untitled')}</span></div>`).join('')}</div>`;
}
/* A number as a stack of wheels: each column holds 0–9 and is slid to the
   digit it should show, so changing the count spins them like a slot machine. */
function digitWheel(n){
  return String(n).split('').map(d=>
    /\d/.test(d)
      ? `<i class="wheel"><b style="transform:translateY(${-d}em)">${
          [0,1,2,3,4,5,6,7,8,9].map(x=>`<u>${x}</u>`).join('')}</b></i>`
      : `<i class="wheel plain">${esc(d)}</i>`).join('');
}

/* Move the existing wheels rather than replacing them — a fresh element starts
   at its final transform, which is why rebuilding never animated. */
function spinTo(el, n){
  const digits=String(n).split('');
  const wheels=[...el.querySelectorAll('.wheel')];
  if(wheels.length!==digits.length){ el.innerHTML=digitWheel(n); return; }
  digits.forEach((d,i)=>{
    const b=wheels[i].querySelector('b');
    if(b && /\d/.test(d)) b.style.transform=`translateY(-${d}em)`;
  });
}

/* A date, said the way the object means it. One day is "Tomorrow"; a week is
   "4 – 11 Sep", because "Tomorrow" for something that runs for a week answers
   a question nobody asked. */
const dateSaid = o => { const sp=spanOf(o);
  return sp ? `${D.short(sp.from)} – ${D.short(sp.to)}` : D.human(o.due); };

const HANDLES = ['nw','ne','se','sw'];   // corners only — any corner resizes

/* How much of a body is printed on a tile's face. Enough to fill the tallest
   one there is: it was 220 characters against a four-line clamp, which is where
   a note that stopped halfway down its own paper came from. The tile hides
   whatever runs past its own height, so the only job of a number here is to be
   larger than any face can show. Cut the text *then* escape it — slicing the
   escaped string cuts through an `&amp;` and prints the entity. */
const BODY_ON_FACE = 1200;

/* The face of a calendar container: the span it is set to, with a mark on any
   day something it collects is due. Sized in em so it shrinks with the tile.
   Which days it draws — and in what order — is calCols(), so the week-start and
   weekend settings reach the front as well as the opened view. A month is the
   weeks its month falls in, a week is one row, a day is one square. */
const DOWMARK = ['S','M','T','W','T','F','S'];
function calFace(o){
  const view = calViewOf(o), cols = calCols(o);
  const anchor = D.parse(o.month||T) || D.today();
  const {from, to, month} = calSpan(o, anchor, view);
  // a thing that lasts marks every day it covers, the same as it does inside
  const kids=childrenOf(o), byDay={};
  for(let dt=new Date(from); dt<=to; dt=D.add(dt,1)){
    const iso=D.iso(dt);
    byDay[iso]=kids.filter(x=>coversDay(x, iso)).length;
  }
  const cells=[];
  for(let dt=new Date(from); dt<=to; dt=D.add(dt,1)){
    if(!cols.includes(dt.getDay())) continue;
    const iso=D.iso(dt), n=byDay[iso]||0;
    cells.push(`<i class="cday${iso===T?' today':''}${n?' has':''}${
        month!=null&&dt.getMonth()!==month?' out':''}" data-calday="${o.id}:${iso}">
      <b>${dt.getDate()}</b>${n?`<u>${n>3?'•••':'•'.repeat(n)}</u>`:''}</i>`);
  }
  const wide = view==='day' ? 1 : cols.length;
  return `<div class="calgrid cal-${view}" style="--dcols:${wide}">
    ${view==='day' ? '' : cols.map(n=>`<i class="dow">${DOWMARK[n]}</i>`).join('')}
    ${cells.join('')}</div>`;
}
/* The first and last day one screen of a calendar covers. A month runs from the
   start of the week its 1st falls in to the end of the week its last day falls
   in, so every row is a full week and the days either side are real days you
   can still drop on — they are only drawn dimmer. */
function weekStartOn(date, sun){ return D.add(date, -(sun ? date.getDay() : (date.getDay()+6)%7)); }
function calSpan(c, anchor, view){
  const sun = weekStartOf(c)==='sun';
  if(view==='day') return {from:anchor, to:anchor, month:null};
  if(view==='week'){ const s=weekStartOn(anchor, sun); return {from:s, to:D.add(s,6), month:null}; }
  const y=anchor.getFullYear(), m=anchor.getMonth();
  return {from:weekStartOn(new Date(y,m,1), sun),
          to:D.add(weekStartOn(new Date(y,m+1,0), sun), 6), month:m};
}

/* What a click on an object does. The editor is no longer the default — it
   lives on the context menu. `onclick` is per-object, falling back to the
   kind's, and 'read' opens the body full-width with nothing to edit. */
const CLICKS = {
  none:     'Nothing',
  read:     'Open it to read',
  edit:     'Open it to write',
  check:    'Tick it off',
  settings: 'Open its settings',
  generate: 'Make a new object'
};
const clickOf = o => o.onclick || K(o.kind).onclick || 'none';
/* A generator presses out a new object beside itself, in whichever direction
   it is set to. `random` drops it wherever there is room. */
function dispense(g){
  const kind=genKindOf(g), dir=g.genDir||'down';
  const o=create(kind,{parent:g.parent});
  const dv=dev(), b=lay(g), [w,h]=sizeOfKind(kind, dv);
  const spots={
    down:  {x:b.x,        y:b.y+b.h, w, h},
    up:    {x:b.x,        y:Math.max(1,b.y-h), w, h},
    right: {x:b.x+b.w,    y:b.y,     w, h},
    left:  {x:Math.max(1,b.x-w), y:b.y, w, h}
  };
  const want=spots[dir];
  o[dv] = (dir!=='random' && want && boxOk(want,o.id,dv,g.parent)) ? want : freeSpot(w,h,dv,g.parent);
  save(); render();
  const el=document.querySelector(`[data-row="${g.id}"]`);
  if(el){ el.classList.add('swallow'); setTimeout(()=>el.classList.remove('swallow'),420); }
  toast(`Made a ${K(kind).nm.toLowerCase()}`);
}
function fireButton(o){
  const tg=o.link&&o.link.target;
  if(!tg){ objectPanel(o.id); return; }
  if(/^https?:/.test(tg)){ window.open(tg,'_blank','noopener'); return; }
  const dest=byId(tg);
  if(dest && isContainer(dest)){ S.view='drawer'; S.drawerId=tg; render(); }
  else if(dest) openObj(tg);
}
/* Everything that opens goes through openTile(), which plays the movement the
   object's `opening` asks for and then does the thing — in that order, and
   without waiting: the state change is immediate and the animation is a copy
   drawn over the result. See motion.js. */
function tileTap(id){
  const o=byId(id); if(!o) return;
  if(isContainer(o)){
    openTile(id, ()=>{ S.view='drawer'; S.drawerId=id; S.kindFilter=null; render(); });
    return;
  }
  switch(clickOf(o)){
    // a press is not an opening: a generator already has its own movement
    case 'generate': dispense(o); return;
    /* Which of the three it opens as is the object's own business — readOf().
       Unless there is nothing to read: a picture opens onto the picture, which
       is its own surface. Reading is what you do to words, and an image object
       sent to the book surface got a blank sheet of paper with a photograph
       pasted at the top of it. */
    case 'read':  openTile(id, ()=> isPicture(o) ? openViewer(id) : openRead(id)); break;
    // the editor is the writing surface now: the body, full screen, and nothing
    // else on it. Every *setting* is in the object's own panel.
    case 'edit':  openTile(id, ()=>openWriter(id)); break;
    // a streak has no checkbox but is very much tickable, and since the Today
    // tab went this is the one-tap way to mark a habit off from the board.
    // Ticking has a movement of its own — the pop — so it isn't an opening.
    case 'check': if(has(o,'check')||has(o,'streak')) toggleDone(id); else openTile(id, ()=>openObj(id)); break;
    case 'settings': openTile(id, ()=>objectPanel(id)); break;
    default: break;                      // 'none' — a task just sits there
  }
}
/* Where a click on bare grid happened, so the next new object lands there. */
const pending={cell:null};   // a holder, because three modules write it
function placeAtPending(o){
  const dv=dev();
  if(!pending.cell){ const [w,h]=sizeOfKind(o.kind, dv); o[dv]=o[dv]||freeSpot(w,h,dv,o.parent); return; }
  // a sketched box wins over the kind's own size
  const [kw,kh]=sizeOfKind(o.kind, dv);
  const w=pending.cell.w||kw, h=pending.cell.h||kh;
  const g=gridOf(), box={x:clamp(pending.cell.x,1,g.cols-w+1), y:Math.max(1,pending.cell.y), w, h};
  o[dv] = boxOk(box, o.id, dv, o.parent) ? box : freeSpot(w,h,dv,o.parent);
  // The other device has no box yet. Leaving it null means ensureBox() picks
  // one the first time that layout is opened, rather than inheriting a
  // coordinate that means nothing over there.
  pending.cell=null;
}

/* How much a tile can honestly say depends on how big it is. These classes are
   the stylesheet's handle on that: `sz-short` has no room for a body, `sz-narrow`
   none for a meta line. `sz-mini` — one cell square — has room for nothing at
   all, and is drawn by gridTile() as its mark and nothing else. Text at that
   size is three letters and an ellipsis, which reads as a bug. */
function sizeClass(box){
  const c=[];
  if(box.w<=1 && box.h<=1) c.push('sz-mini');
  if(box.h<=1) c.push('sz-short');
  // one cell of width, however tall. A name set down a column one letter wide
  // is not a name, so a front this thin shows its mark instead — the same
  // answer sz-short reaches for at one cell of height.
  if(box.w<=1) c.push('sz-thin');
  if(box.w<=3) c.push('sz-narrow');
  return c.join(' ');
}

/* One tile, for anything. A container gets the drawer front and a preview of
   what is inside it; everything else gets its attributes rendered directly.
   This is the only place that decides how an object looks on a grid, at any
   depth — the desk and a drawer three levels down both come through here.

   The size classes are stamped on afterwards rather than threaded through
   fifteen branches: every branch below returns one element, and its own class
   list is the first `class="` in the string. */
/* How far up the page being drawn has pushed the board. A holder rather than an
   argument because gridTile() is also called by the type picker's samples, which
   are on no page at all. Only the CSS placement uses it. */
const PAGESHIFT = {n:0};
function gridTile(o, arr, parentId){
  let box;
  if(FLOW.has(o.id)){ box=FLOW.get(o.id); FLOW.delete(o.id); }
  else { ensureBox(o, dev(), parentId); box=lay(o); }
  if(PAGESHIFT.n) box={...box, y:box.y-PAGESHIFT.n};
  const sz=sizeClass(box);
  const html=drawTile(o, arr, box);
  return sz ? html.replace('class="', `class="${sz} `) : html;
}
function drawTile(o, arr, box){
  const cont=isContainer(o);
  const colour = objColour(o);
  const handles = arr ? HANDLES.map(h=>`<i class="rz ${h}" data-rz="${h}"></i>`).join('') : '';
  const chips='';   // no size chip, no delete cross — the menu does both
  /* How big this one's words are, folded into the placement so every branch
     below carries it without being told: `place` is the tail of every tile's
     style attribute. The stylesheet multiplies its own sizes by it, so a tile
     that already shrinks its name at three cells wide still does — smaller,
     larger, and narrow are three separate facts about the same line. */
  const ts = textSizeOf(o);
  const place = `${ts!==1?`--tscale:${ts};`:''}grid-column:${box.x} / span ${box.w};grid-row:${box.y} / span ${box.h}`;
  const sel = S.sel.includes(o.id) ? ' selected' : '';

  /* One cell square: the mark, and nothing else. Every shape below this line
     assumes there is room for a name, and at 40px there isn't — a drawer front
     shrunk to a stamp printed "Untit…" across its own knob. A mini tile keeps
     the thing's colour and its type's mark, which is enough to recognise it,
     and the title is the tooltip. It is still a drawer or still an object, so
     the front styling and the drop target come along unchanged. */
  if(box.w<=1 && box.h<=1){
    const mark = cont && has(o,'magic') ? 'sparkle' : iconOf(o);
    return `<button class="drawer ${cont?`dtile bd-${o.border||'panel'}`:'otile'} minitile${sel}${
        cont&&has(o,'magic')?' magicdrawer':''}"
      ${cont?`data-drawer="${o.id}"`:`data-row="${o.id}"`} title="${esc(o.title||'Untitled')}"
      style="--c:${colour};${place}">
      <span class="minimark">${ic(mark,17)}</span>
      ${has(o,'check')&&o.done?`<span class="minidone">${ic('check',11)}</span>`:''}
      ${handles}
    </button>`;
  }

  // A control is a Bureau button that lives on the desk like anything else.
  if(false){
    return `<button class="drawer ctile${sel}" data-ctl="${esc(o.ctl||'')}" data-id="${o.id}" style="--c:${colour};${place}">
      ${chips}<span class="cico">${ic(K(o.kind).ic==='sliders'&&o.ic?o.ic:(o.ic||'sliders'),20)}</span>
      <span class="clabel">${esc(o.title||'')}</span>
      ${handles}
    </button>`;
  }

  /* A story is a book seen spine-on, and it is also a container — the scenes
     are inside it. Every other container face draws what it holds; a spine
     deliberately doesn't, because a shelf shows you titles.

     **And so is any container one cell wide.** A name set down a column one
     letter wide is not a name, so a front that thin used to drop its name and
     wear its mark instead — which told you it was a drawer and nothing about
     *which* drawer. A spine is the shape that already solved this: the title
     runs up the tile, and it is a book on a shelf rather than a drawer that has
     run out of room. One cell square is still the mark and nothing else, above:
     at 40px a spine has no length to set a name along either. */
  if(cont && (faceOf(o)==='spine' || box.w<=1)){
    return `<button class="drawer dtile spinetile bd-none${sel}${
        has(o,'magic')?' magicspine':''}" data-drawer="${o.id}" style="--c:${colour};${place}">
      <span class="spinetop"></span>
      <span class="spinetitle">${esc(o.title||'Untitled')}</span>
      <span class="spinefoot"></span>
      ${handles}
    </button>`;
  }

  /* A checklist is a container that wears its contents on the outside: you can
     see, tick, add to and take from it without opening it. That is the whole
     difference between it and a drawer.

     It is a <div> rather than a <button> when it takes typing, because an input
     inside a button is invalid and unfocusable — the same reason the text field
     tile is a div. Clicking it still opens it: wire.js goes by [data-drawer]
     and the .drawer class, not by the tag. */
  if(cont && faceOf(o)==='checklist'){
    const items=childrenOf(o);
    const adds=takesTyping(o);
    const made=K(genKindOf(o)).nm.toLowerCase();
    return `<${adds?'div':'button'} class="drawer dtile cltile bd-${o.border||'panel'}${sel}" data-drawer="${o.id}"
        ${adds?'role="button" tabindex="0"':''} style="--c:${colour};${place}">
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        <span class="clcount">${rollup(o) || (items.filter(x=>x.done).length+'/'+items.length)}</span></div>
      ${adds?`<label class="cladd">${ic('plus',11)}
        <input data-contadd="${o.id}" placeholder="Add a ${esc(made)}…"></label>`:''}
      <div class="dbody"><div class="clist">${items.slice(0,14).map(x=>
        `<span class="cline${x.done?' done':''}" data-check="${x.id}" data-pluck="${x.id}"
           title="${esc(x.title||'Untitled')} — hold to take it out">
           <i class="clbox">${x.done?ic('check',10):''}</i>${esc(x.title||'Untitled')}</span>`).join('')
        || `<span class="clempty">${adds?'Nothing yet — type above':'Nothing yet — open it to add'}</span>`}</div></div>
      ${handles}
    </${adds?'div':'button'}>`;
  }

  /* A project is a drawer with a front page. Every other container's face
     either lists what it holds or hides it; a project *reports* on it —
     how far along, how much is left, what is next, and what it is made of —
     because the question you ask a project from across the desk is "where is
     this up to", and no list of the first fourteen things answers that.

     All of it is read off one walk of everything underneath, so a project made
     of checklists counts the ticks inside them rather than counting four
     checklists as four undone things. */
  if(cont && faceOf(o)==='project'){
    const st=projectStat(o);
    const late = o.due && st.pct<100 && D.overdue(o.due);
    return `<${takesTyping(o)?'div':'button'} class="drawer dtile projtile bd-${o.border||'panel'}${sel}"
        data-drawer="${o.id}" ${takesTyping(o)?'role="button" tabindex="0"':''}
        style="--c:${colour};--pct:${st.pct}%;${place}">
      ${st.cover?`<span class="projcover" style="background-image:url('${esc(st.cover)}')"></span>`:''}
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        ${o.due?`<span class="projdue${late?' late':''}">${esc(dateSaid(o))}</span>`:''}</div>
      <div class="projbar"><i></i><b>${st.pct}%</b></div>
      <div class="projline">
        ${st.ticks?`<span>${st.done}/${st.ticks} done</span>`:`<span>${st.n||'Nothing'} inside</span>`}
        ${st.next?`<span class="projnext">next ${esc(D.short(st.next))}</span>`:''}
      </div>
      <div class="projkinds">${st.kinds.slice(0,6).map(([k,n])=>
        `<span class="projkind" style="--k:${hexOf(K(k).c)}" title="${esc(K(k).nm)}">
          ${ic(K(k).ic,11)}<u>${n}</u></span>`).join('')
        || '<span class="clempty">Open it and start filling it</span>'}</div>
      <div class="projsoon">${st.soon.slice(0,3).map(x=>
        `<span class="projitem${D.overdue(x.due)?' late':''}" data-row="${x.id}"
           title="${esc(x.title||'Untitled')}">
          <i style="--k:${objColour(x)}">${ic(K(x.kind).ic,10)}</i>
          <b>${esc(x.title||'Untitled')}</b><u>${esc(D.short(x.due))}</u></span>`).join('')}</div>
      ${takesTyping(o)?`<label class="cladd">${ic('plus',11)}
        <input data-contadd="${o.id}" placeholder="Add a ${esc(K(genKindOf(o)).nm.toLowerCase())}…"></label>`:''}
      ${handles}
    </${takesTyping(o)?'div':'button'}>`;
  }

  /* A trip is a ticket: a stub torn off down the right, and where to. */
  if(cont && shapeOf(o)==='ticket'){
    return `<button class="drawer dtile triptile bd-${o.border||'panel'}${sel}" data-drawer="${o.id}" style="--c:${colour};${place}">
      <div class="tkmain">
        <span class="tklabel">${o.due?esc(dateSaid(o)):'Some day'}</span>
        <span class="dname">${esc(o.title||'Untitled')}</span>
        ${o.loc?`<span class="tkloc">${ic('flag',11)} ${esc(o.loc)}</span>`:''}
      </div>
      <div class="tkstub">${(o.title||'??').slice(0,3).toUpperCase()}</div>
      ${handles}
    </button>`;
  }

  /* A timeline lays its children along a real date axis — spacing used to be
     the array index, which drew a straight line through unequal gaps and meant
     nothing you could read a date off. Now `data-tlspan` says which two dates
     the ends are, so a drop anywhere along it is arithmetic. Labels alternate
     above and below the rule, because on a true axis a busy fortnight puts
     three of them in the same inch. */
  if(cont && faceOf(o)==='timeline'){
    const sp=tlSpan(o), lo=D.parse(sp.min);
    const pc = iso => ((D.parse(iso)-lo)/864e5)/Math.max(1,sp.days)*100;
    const kids=childrenOf(o).filter(x=>x.due||x.created)
      .sort((a,b)=>(a.due||a.created).localeCompare(b.due||b.created)).slice(0,10);
    const runOf = x => { const sp=spanOf(x);
      return sp ? Math.max(1, pc(sp.to)-pc(sp.from)) : 0; };
    const nowPc = (T>=sp.min && T<=sp.max) ? pc(T) : null;
    return `<button class="drawer dtile tltile bd-${o.border||'panel'}${sel}" data-drawer="${o.id}"
      data-tlspan="${o.id}:${sp.min}:${sp.max}" style="--c:${colour};${place}">
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        <span class="clcount">${esc(D.short(sp.min))} – ${esc(D.short(sp.max))}</span></div>
      <div class="tlwrap"><i class="tlrule"></i>
        ${nowPc!=null?`<i class="tlnowmark" style="left:${nowPc}%"></i>`:''}
        ${kids.map((x,i)=>{
          const iso=x.due||x.created, run=runOf(x);
          return `<span class="tlnode ${i%2?'below':'above'}${run?' lasts':''}"
            style="left:${pc(iso)}%${run?`;--run:${run}%`:''}">
            <i></i><b>${esc((x.title||'Untitled').slice(0,18))}</b><u>${esc(D.short(iso))}</u></span>`;
        }).join('')}
      </div>
      ${handles}
    </button>`;
  }

  /* A moodboard shows its pictures on the front, tiled. */
  if(cont && faceOf(o)==='moodboard'){
    const pics=childrenOf(o).filter(x=>x.media&&x.media.src).slice(0,12);
    return `<button class="drawer dtile mbtile bd-${o.border||'panel'}${sel}" data-drawer="${o.id}" style="--c:${colour};${place}">
      <div class="mbwall">${pics.map(x=>`<i style="background-image:url('${esc(x.media.src)}')"></i>`).join('')
        || '<span class="clempty">Open it and add pictures</span>'}</div>
      <span class="mbname">${esc(o.title||'Untitled')}</span>
      ${handles}
    </button>`;
  }

  /* A calendar is a container drawing what it collects on the day each thing
     falls. It is usually a magic drawer, so the sparkle belongs on it like any
     other — the days are what it shows, collecting is how it filled them. */
  if(cont && faceOf(o)==='calendar'){
    const at=D.parse(o.month||T)||D.today(), view=calViewOf(o);
    const cap = view==='day' ? at.toLocaleDateString(undefined,{weekday:'long',day:'numeric'})
      : at.toLocaleDateString(undefined, view==='week'?{month:'short',day:'numeric'}:{month:'long'});
    return `<button class="drawer dtile caltile bd-${o.border||'panel'}${sel}${has(o,'magic')?' magicdrawer':''}"
      data-drawer="${o.id}" style="--c:${colour};${place}">
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        <span class="clcount">${esc(cap)}</span></div>
      <div class="dbody">${calFace(o)}</div>
      ${handles}
    </button>`;
  }

  /* A drawer on a grid is just a front with a name. What is inside is behind
     it, not printed on it — you open a drawer to find out what it holds.

     Two things the front has to admit to. A container that **swings** open is a
     cabinet, so it wears two knobs either side of the seam rather than one in
     the middle: the front says which movement it is about to make, the way a
     real one does. And a front with no room for a name — one cell tall or one
     cell wide — drops the name and wears its mark over the knob instead, which
     is the same answer the 1×1 tile already gives, arrived at from the other
     side. The mark is rendered always and revealed by the size classes, so
     nothing here has to know which threshold it crossed. */
  if(cont){
    const bd=o.border||'panel', kn=o.knob||'round', tx=o.texture||'none';
    const doors = openingFor(o, box)==='cabinet';
    /* A knob is turned out of the same wood as the front, so unless it has been
       told otherwise it *is* the front's colour — what makes it a knob is the
       light on it, not a lighter shade painted where it sits. Lighter and
       darker are still a choice, and so is a colour outright; the shading is in
       the stylesheet, on `--knob`, so all three get it. */
    const knob = o.knobc ? esc(o.knobc)
      : o.knobtone==='dark' ? `color-mix(in srgb, ${colour} 78%, #000)`
      : o.knobtone==='light' ? `color-mix(in srgb, ${colour} 74%, #fff)`
      : colour;
    return `<button class="drawer dtile bd-${bd} tx-${tx} ks-${knobSizeOf(o)} knb-${o.knobpos||'centre'}${
        doors?' cabinet':''}${sel}${has(o,'magic')?' magicdrawer':''}" data-drawer="${o.id}"
      style="--c:${colour};--knob:${knob};${place}">
      ${chips}
      ${/* The seam is the tile's, not the knob strip's: two doors meet down the
           whole front and the gap between them runs past the border at both
           ends, the way it does on a real one. */''}
      ${doors?`<i class="dseam"></i>`:''}
      <span class="dmark">${ic(has(o,'magic')?'sparkle':iconOf(o),18)}</span>
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        ${has(o,'magic')?`<span class="magicmark" title="Collects by rule">${ic('sparkle',11)}</span>`:''}
        ${rollup(o)?`<span class="rollup">${esc(rollup(o))}</span>`:''}</div>
      <div class="dfoot${doors?' doors':''}"><span class="pull kn-${kn}"></span>${
        doors?`<span class="pull kn-${kn}"></span>`:''}</div>
      ${handles}
    </button>`;
  }

  // An image sits on the grid like something stuck in a scrapbook.
  const img = has(o,'media') && o.media && o.media.src;
  if(img){
    return `<button class="drawer otile imgtile sh-image${o.media.alpha?'':' opaque'} fr-${o.frame||'none'}${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <img class="tileimg" src="${esc(o.media.src)}" alt="${esc(o.title||'')}" draggable="false">
      ${handles}
    </button>`;
  }
  /* …and a picture with nothing in it yet is an empty mount, not a card with a
     title and a blank body. It said "Untitled" and did nothing, which is how a
     new Image object came to look broken rather than unfilled. Tapping it opens
     the picture surface, which is where a file is chosen. */
  if(isPicture(o) && !has(o,'text')){
    return `<button class="drawer otile imgtile empty fr-${o.frame||'none'}${sel}" data-row="${o.id}"
      title="${esc(o.title||'')} — tap to add a picture" style="--c:${colour};${place}">
      ${chips}
      <span class="imgempty">${ic('image',24)}<b>${esc(o.title||'Add a picture')}</b></span>
      ${handles}
    </button>`;
  }

  // a button object is the button: it fills its tile rather than sitting in it
  if(has(o,'button')){
    return `<button class="drawer otile sh-button btntile bs-${o.btnshape||'rounded'}${sel}" data-row="${o.id}"
      style="--c:${colour};${place}">
      ${chips}
      <span class="btnface" data-fire="${o.id}">${esc((o.link&&o.link.label)||o.title||'Open')}</span>
      ${handles}
    </button>`;
  }

  /* A counter is its number, not a title and a body. */
  if(shapeOf(o)==='tally'){
    return `<button class="drawer otile sh-tally cnttile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <span class="cntlabel">${esc(o.title||'Untitled')}</span>
      <span class="cntnum" data-act="countup" data-id="${o.id}">${digitWheel(o.count||0)}</span>
      ${handles}
    </button>`;
  }
  if(has(o,'spawn') && spawnByOf(o)==='click'){
    const made=K(genKindOf(o));
    return `<button class="drawer otile sh-press gentile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <span class="genico">${ic(made.ic,20)}</span>
      <span class="genlabel">${esc(o.title||('New '+made.nm.toLowerCase()))}</span>
      <span class="genarrow">${ic('plus',15)}</span>
      ${handles}
    </button>`;
  }
  if(has(o,'spawn') && spawnByOf(o)==='type'){
    return `<div class="drawer otile sh-band fieldtile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <input class="fieldin" data-fieldfor="${o.id}" placeholder="${esc(o.title||'Type and press return…')}">
      ${handles}
    </div>`;
  }
  if(shapeOf(o)==='spine'){
    return `<button class="drawer otile sh-spine spinetile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <span class="spinetop"></span>
      <span class="spinetitle">${esc(o.title||'Untitled')}</span>
      <span class="spinefoot"></span>
      ${handles}
    </button>`;
  }
  if(shapeOf(o)==='quote'){
    return `<button class="drawer otile sh-quote quotetile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <span class="qmark">"</span>
      <span class="qbody">${esc(strip(o.body||o.title||'').replace(/^[>\s—]+/,'')).slice(0,180)}</span>
      ${has(o,'rating')&&o.rating?`<span class="tilestars">${'★'.repeat(o.rating)}</span>`:''}
      ${handles}
    </button>`;
  }
  if(shapeOf(o)==='portrait'){
    const img=o.media&&o.media.src;
    return `<button class="drawer otile sh-portrait chartile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <span class="charface">${img?`<img src="${esc(img)}" alt="">`:ic('star',22)}</span>
      <span class="charname">${esc(o.title||'Untitled')}</span>
      ${handles}
    </button>`;
  }

  const bits=[];
  if(has(o,'streak')) bits.push(`${streak(o)}-day streak`);
  if(has(o,'progress')) bits.push(`${goalPct(o)}%`);
  if(has(o,'count')) bits.push(`${o.count||0}`);
  if(has(o,'duration')&&o.dur) bits.push(`${o.dur} min`);
  if(has(o,'price')&&o.price) bits.push(esc(o.price));
  if(has(o,'location')&&o.loc) bits.push(esc(o.loc));

  const asks = has(o,'answer');
  /* Double-tapped: the name becomes a field where it sits, and an object that
     carries text gets its body under it. That is the whole of "simple text
     editing" — a task and a note are a line and a paragraph, and neither is
     worth a screen. A tile being typed in has to be a <div>, because an input
     inside a <button> is unfocusable — the same reason the answer box does. */
  const edit = S.editId===o.id;
  const raw = asks || edit;
  return `<${raw?'div':'button'} class="drawer otile sh-${shapeOf(o)}${o.edge?' edge':''}${sel}${
      edit?' editing':''}${
      asks?(answered(o)?' answered':' unanswered'):''}${has(o,'priority')&&o.prio?' prio-'+o.prio:''}" data-row="${o.id}"
    style="--c:${colour};${has(o,'progress')?`--pct:${goalPct(o)}%;`:''}${place}">
    ${chips}
    <div class="dtop">
      ${has(o,'check')?`<span class="check tilecheck${o.done?' on':''}" data-check="${o.id}">${ic('check',12)}</span>`:''}
      ${edit
        ? `<input class="inlinename" data-inline="${o.id}:title" value="${esc(o.title||'')}"
             placeholder="Untitled" autocomplete="off" enterkeyhint="done">`
        : `<span class="dname${o.done?' done':''}">${esc(o.title||'Untitled')}</span>`}
    </div>
    ${has(o,'rating')&&o.rating?`<div class="tilestars">${'★'.repeat(o.rating)}<span>${'★'.repeat(5-o.rating)}</span></div>`:''}
    ${edit && has(o,'text')
      ? `<div class="dbody"><textarea class="inlinebody" data-inline="${o.id}:body"
           placeholder="Anything else…">${esc(o.body||'')}</textarea></div>`
      : has(o,'text')&&o.body?`<div class="dbody"><div class="tiletext">${esc(String(o.body).slice(0,BODY_ON_FACE))}</div></div>`:'<div class="dbody"></div>'}
    ${bits.length?`<div class="dfoot"><span class="tilemeta">${bits.join(' · ')}</span></div>`:''}
    ${asks?`<label class="ansbox">
      <i>${answered(o)?ic('check',11):ic('help',11)}</i>
      <input data-answer="${o.id}" value="${esc(o.answer||'')}"
        placeholder="${answered(o)?'':'Write the answer…'}"></label>`:''}
    ${handles}
  </${raw?'div':'button'}>`;
}

/* When a drawer is sorted, its grid is packed in that order rather than read
   from each object's stored box — otherwise choosing "A–Z" would change nothing
   you can see. The stored boxes are left alone, so switching back to Custom
   restores the arrangement you made. */
const FLOW = new Map();   // id -> box, for one render of a sorted grid
function flowSorted(kids, cid){
  const g=gridOf(), dv=dev(), taken=[], per=pageRows(dv);
  const free=(b)=> b.x+b.w-1<=g.cols && !taken.some(t=>overlaps(b,t))
    // a packed board respects the page break too, or the sort would produce
    // the straddling tiles the drag is not allowed to make
    && (!per || Math.floor((b.y-1)/per)===Math.floor((b.y+b.h-2)/per));
  kids.forEach(o=>{
    let [w,h]=(o[dv]&&o[dv].w) ? [o[dv].w,o[dv].h] : sizeOfKind(o.kind, dv);
    if(per) h=Math.min(h,per);
    let put=null;
    for(let y=1;y<600&&!put;y++) for(let x=1;x<=g.cols-w+1;x++){
      const b={x,y,w,h}; if(free(b)){ put=b; break; }
    }
    put=put||{x:1,y:1,w,h};
    taken.push(put);
    FLOW.set(o.id, put);                      // render-only; never persisted
  });
}

/* The grid for one container. `id` is ROOT for the desk.

   On a paged board (a phone) this draws **one page**: the objects whose boxes
   fall in this window of rows, shifted up so the page starts at row 1. The
   boxes are untouched — `y` is still one continuous coordinate space, and a
   page is only which slice of it you are looking at. Everything that does
   arithmetic on a box — the drag, the drop, freeSpot() — carries on in the
   real coordinates and needs to know nothing about pages. */
function gridOfContainer(cid){
  const c=container(cid), g=gridOf();
  // You are always arranging. A container can be locked to opt out of it.
  const arr=!c.locked;
  const sorted=sortOf(c);
  const per=pageRows(), pg=per?pageAt(c.id):0, from=pg*per;
  let kids=childrenOf(c);
  FLOW.clear();
  if(sorted) flowSorted(kids, c.id);          // a sort overrides hand placement
  else kids.forEach(o=>ensureBox(o, dev(), c.id));
  if(per){
    /* A box from before this board had pages — or from a phone whose pages
       were a different height — can straddle a break, and half a tile on each
       of two screens is a tile you can read neither half of. Re-place it, once:
       the same licence ensureBox() takes to place an object that has never been
       in a grid. boxOk() stops any *new* box from straddling. */
    const dv=dev();
    if(!sorted) kids.forEach(o=>{
      const b=lay(o);
      if(b.h<=per && Math.floor((b.y-1)/per)===Math.floor((b.y+b.h-2)/per)) return;
      o[dv]=null;
      o[dv]=freeSpot(b.w, Math.min(b.h,per), dv, c.id);
    });
    kids = kids.filter(o=>{ const b=FLOW.get(o.id)||lay(o); return b.y>from && b.y<=from+per; });
    PAGESHIFT.n = from;                       // gridTile subtracts it as it draws
  } else PAGESHIFT.n = 0;
  const tiles=kids.map(o=>gridTile(o,arr,c.id)).join('');
  PAGESHIFT.n = 0;
  // a page is exactly the rows that fit; a scrolling board is at least a screen
  const minRows=Math.max(12, Math.ceil((window.innerHeight-140)/Math.max(1,CELL[dev()])));
  const rows = per ? per : Math.max(gridRows(dev(),c.id)+(arr?2:0), minRows);

  // a drawer may carry its own board, which overrides the global one
  const bd = c.board ? String(c.board).split('|') : null;
  let boardVars = bd ? `--board-1:${esc(bd[0])};--board-2:${esc(bd[1]||bd[0])};` : '';
  if(c.boardAlpha!=null) boardVars += `--board-alpha:${c.boardAlpha};`;
  /* The checker squares are written here, from the cell size measured last
     time, rather than left to sizeGrid() after layout. They were: the CSS
     fallback is 160px and every new board drew one frame of enormous squares
     before snapping back — which is what "the background grid gets bigger for a
     second" was. A board is a coordinate space, so the last measurement is
     always the right first guess, and sizeGrid() corrects it in the same frame
     if the window has changed underneath. */
  const colw = COLW[dev()];   // last measured; cellW() re-measures after layout
  return `<div class="grid g-${dev()}${arr?' arranging':''}${c.locked?' locked':''}${sorted?' sorted':''}"
       id="drawergrid" data-gridfor="${c.id}"
       style="${boardVars}--cols:${g.cols};--rowh:${g.rowh}px;--checkerx:${2*colw}px;--checkery:${2*g.rowh}px;grid-template-rows:repeat(${Math.max(rows,1)},${g.rowh}px)">${tiles}
  </div>`;
}

/* List view is the same tile, stretched into a band. Same silhouettes, same
   colours — a drawer still looks like a drawer, a task still comes to a point. */
function listTile(o){
  const colour=objColour(o);
  const cont=isContainer(o);
  const img = has(o,'media') && o.media && o.media.src;
  const attr = cont ? `data-drawer="${o.id}"` : `data-row="${o.id}"`;
  return `<button class="drawer ${cont?'dtile':'otile'} sh-${cont?'front':shapeOf(o)} listband${S.sel.includes(o.id)?' selected':''}${
      cont&&has(o,'magic')?' magicdrawer':''}" ${attr} style="--c:${colour}">
    <div class="dtop">
      ${has(o,'check')?`<span class="check tilecheck${o.done?' on':''}" data-check="${o.id}">${ic('check',12)}</span>`:''}
      ${img?`<img class="bandimg" src="${esc(o.media.src)}" alt="">`:''}
      <span class="dname${o.done?' done':''}">${esc(o.title||'Untitled')}</span>
      ${o.body?`<span class="bandsnip">${esc(strip(o.body).slice(0,120))}</span>`:''}
      ${o.due?`<span class="mchip">${esc(dateSaid(o))}</span>`:''}
      ${cont?`<span class="pull kn-${o.knob||'round'}"${o.knobc?` style="--knob:${esc(o.knobc)}"`:''}></span>`:''}
    </div>
  </button>`;
}

/* Reading an object: three ways of looking at one body, chosen by readOf().
   A book is a spread you turn through, a page is the same thing one leaf at a
   time, and a scroll is the whole thing in one column — an article rather than
   a book. Only the first two paginate.

   A page is a fixed Letter-proportioned sheet, so how much goes on one is a
   question about height, not about paragraph count. Filling by count is what
   made a page grow or leave itself half empty depending on how long the
   paragraphs happened to be.

   So it is measured: the body goes into an offscreen twin of a real page and
   blocks are added until one doesn't fit, which starts the next page. The
   answer is cached against everything that could change it, so turning a page
   costs nothing and only the first look at a body measures at all. */
const PAGES = {key:null, list:null};
const clearPages = ()=>{ PAGES.key=null; PAGES.list=null; };
const headOf = o => o.media&&o.media.src
  ? `<img class="scrollimg" src="${esc(o.media.src)}" alt="${esc(o.title||'')}">` : '';

function pagesOf(o){
  const two=spreadOf(o);
  // the window is in the key because the sheet is sized from it, and a
  // narrower window means fewer lines to a page
  const key=[o.id, two?'two':'one', (o.body||'').length,
             (o.media&&o.media.assetId)||'', innerWidth, innerHeight].join('|');
  if(PAGES.key===key) return PAGES.list;

  const ruler=document.createElement('div');
  ruler.className='bookruler';
  ruler.innerHTML=`<div class="book"><div class="spread">
    <div class="page"></div>${two?'<div class="page"></div>':''}</div></div>`;
  document.getElementById('frame').appendChild(ruler);
  const cell=ruler.querySelector('.page');
  cell.innerHTML=headOf(o)+md(o.body||'');

  const blocks=[...cell.children];
  const pages=[]; let cur=[];
  cell.replaceChildren();
  blocks.forEach(b=>{
    cell.appendChild(b); cur.push(b);
    // one block always gets a page, however tall it is — the alternative is a
    // page that holds nothing and a body that never ends
    if(cur.length>1 && cell.scrollHeight > cell.clientHeight+1){
      cur.pop();
      pages.push(cur.map(x=>x.outerHTML).join(''));
      cur=[b]; cell.replaceChildren(b);
    }
  });
  if(cur.length) pages.push(cur.map(x=>x.outerHTML).join(''));
  ruler.remove();
  if(!pages.length) pages.push('<p class="thin">Nothing written yet.</p>');

  PAGES.key=key; PAGES.list=pages;
  return pages;
}
function bookOf(o){
  const mode=readOf(o);
  if(mode==='scroll'){
    // the same sheet, the same size — the column inside it scrolls instead of
    // the paper growing to fit what is on it
    return `<div class="book"><div class="spread scrolling">
      <div class="page">${headOf(o)}${o.body?md(o.body):'<p class="thin">Nothing written yet.</p>'}</div>
    </div></div>`;
  }
  const pages=pagesOf(o), two=spreadOf(o), step=two?2:1;
  const at=Math.min(Math.max(0,S.bookAt||0), Math.max(0,pages.length-1));
  const last=Math.min(at+step, pages.length);
  return `<div class="book"><div class="spread">
      <div class="page">${pages[at]||''}<span class="pno">${at+1}</span></div>
      ${two?`<div class="page">${pages[at+1]||''}${pages[at+1]?`<span class="pno">${at+2}</span>`:''}</div>`:''}
    </div>
    <div class="bookbar">
      <button class="pill" data-act="bookprev"${at<=0?' disabled':''}>${ic('chevL',14)}</button>
      <span class="bookcount">${two&&last>at+1?`${at+1}–${last}`:at+1} of ${pages.length}</span>
      <button class="pill" data-act="booknext"${at+step>=pages.length?' disabled':''}>${ic('chevR',14)}</button>
    </div></div>`;
}

/* Turning a page, for real. The leaf is built from the DOM rather than from
   the pagination, so this works for anything drawn as a spread — an object
   being read, or a drawer wearing the book layout.

   The order matters: advance and re-render first, so the destination is really
   there, then lay a two-faced leaf over the right-hand page and rotate it about
   the spine. One face is the page you are leaving and the other is the page
   arriving; backface-visibility does the swap halfway through, which is what
   makes it read as one sheet rather than two. */
const TURN_MS = 520;
let turning = false;
function turnPage(dir, after){
  const spread=document.querySelector('.book .spread');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = spread && spread.querySelectorAll('.page').length>1 ? 2 : 1;
  const at = Math.max(0, (S.bookAt||0) + dir*step);
  if(turning || !spread || still){ S.bookAt=at; after(); return; }

  const pages=[...spread.querySelectorAll('.page')];
  const leaving=(dir>0 ? pages[pages.length-1] : pages[0]).innerHTML;
  turning=true;
  S.bookAt=at; after();

  const spread2=document.querySelector('.book .spread');
  if(!spread2){ turning=false; return; }
  const pages2=[...spread2.querySelectorAll('.page')];
  const arriving=(dir>0 ? pages2[0] : pages2[pages2.length-1]).innerHTML;
  // the leaf always occupies the right-hand page — going forward that is where
  // it lifts from, coming back it is where it lands
  const seat=pages2[pages2.length-1].getBoundingClientRect();
  const box=spread2.getBoundingClientRect();
  const leaf=document.createElement('div');
  leaf.className='leaf '+(dir>0?'fwd':'back');
  leaf.style.cssText=`left:${seat.left-box.left}px;width:${seat.width}px`;
  leaf.innerHTML=`<div class="leafface front">${dir>0?leaving:arriving}</div>
    <div class="leafface back">${dir>0?arriving:leaving}</div>`;
  spread2.appendChild(leaf);
  setTimeout(()=>{ leaf.remove(); turning=false; }, TURN_MS);
}

function bookView(c, items){
  const pages=[];
  items.forEach(o=>{
    const body=(o.body||'').trim();
    pages.push(`<h2>${esc(o.title||'Untitled')}</h2>${body?md(body):'<p class="thin">—</p>'}`);
  });
  if(!pages.length) pages.push('<p class="thin">Nothing written yet.</p>');
  const at=Math.min(S.bookAt||0, Math.max(0,pages.length-1));
  const left=pages[at]||'', right=pages[at+1]||'';
  return `<div class="book">
    <div class="spread">
      <div class="page">${left}<span class="pno">${at+1}</span></div>
      <div class="page">${right}${right?`<span class="pno">${at+2}</span>`:''}</div>
    </div>
    <div class="bookbar">
      <button class="pill" data-act="bookprev"${at<=0?' disabled':''}>${ic('chevL',14)}</button>
      <span class="bookcount">${at+1}–${Math.min(at+2,pages.length)} of ${pages.length}</span>
      <button class="pill" data-act="booknext"${at+2>=pages.length?' disabled':''}>${ic('chevR',14)}</button>
    </div>
  </div>`;
}

/* Scroll view: the same list, but nothing is truncated. Every object's whole
   body, one after another, for reading a drawer rather than scanning it. */
function scrollEntry(o){
  const k=K(o.kind);
  return `<article class="scrollentry" data-row="${o.id}" style="--k:${objColour(o)}">
    <header>
      ${has(o,'check')?`<span class="check${o.done?' on':''}" data-check="${o.id}">${ic('check',12)}</span>`:`<span class="kindmark">${ic(k.ic,13)}</span>`}
      <h3${o.done?' class="done"':''}>${esc(o.title||'Untitled')}</h3>
      ${o.due?`<span class="mchip">${esc(dateSaid(o))}</span>`:''}
      ${(o.tags||[]).map(t=>`<span class="mchip tag" data-tagdrawer="${esc(t)}">${esc(t)}</span>`).join('')}
    </header>
    ${has(o,'media')&&o.media&&o.media.src?`<img class="scrollimg" src="${esc(o.media.src)}" alt="${esc(o.title||'')}">`:''}
    ${o.body?`<div class="prose">${md(o.body)}</div>`:''}
  </article>`;
}

export { spinTo, CLICKS, clickOf, fireButton, tileTap, pending, placeAtPending, PAGESHIFT,
  gridTile, gridOfContainer, listTile, scrollEntry, bookOf, bookView, turnPage, clearPages,
  calSpan };
