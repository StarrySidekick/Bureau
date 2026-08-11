import { esc, ic, clamp, D, md, strip } from './util.js';
import { S, K, T, byId, has, isContainer, faceOf, shapeOf, childrenOf, container,
  rollup, streak, goalPct, dev } from './model.js';
import { CELL, gridOf, lay, overlaps, boxOk, freeSpot, gridRows, sizeOfKind, ensureBox } from './grid.js';
import { create, toast, toggleDone } from './mutations.js';
import { render } from './views.js';
import { openObj, renderSheet } from './sheet.js';
import { objectPanel } from './panels.js';
import { save } from './persist.js';

/* ============================================================
   7 · rendering — drawers
   ============================================================ */
function drawerPreview(d, items){
  const c=d.c, f=d.filter||{};
  if(d.pv==='big'){
    const n=items.length;
    const cap = f.done ? 'accomplishments on record' : 'due today';
    return `<div class="pv-big"><div class="num">${n}</div><div class="cap">${cap}</div></div>`;
  }
  if(d.pv==='stack'){
    return `<div class="pv-stack">${items.slice(0,3).map((o,i)=>
      `<div class="card" style="--k:${K(o.kind).c};--rot:${(i-1)*0.8}deg;top:${i*34}px;z-index:${3-i}">${esc(o.title||'Untitled')}</div>`).join('')}</div>`;
  }
  if(d.pv==='thumbs'){
    return `<div class="pv-thumbs">${items.slice(0,6).map(o=>`<i style="--k:${K(o.kind).c}"></i>`).join('')||'<i style="--k:'+c+'"></i>'}</div>`;
  }
  if(d.pv==='bars'){
    return `<div class="pv-bars">${items.slice(0,4).map(o=>{
      const p = has(o,'progress') ? goalPct(o) : clamp(streak(o)*14,6,100);
      return `<div class="b" style="--k:${K(o.kind).c}"><i style="width:${p}%"></i></div>`;}).join('')}</div>`;
  }
  return `<div class="pv-list">${items.slice(0,5).map(o=>
    `<div class="r${o.done?' done':''}" style="--k:${K(o.kind).c}"><span class="dot"></span><span class="lbl">${esc(o.title||'Untitled')}</span></div>`).join('')}</div>`;
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

const HANDLES = ['nw','ne','se','sw'];   // corners only — any corner resizes

/* A month for a calendar container: the weeks of `o.month`, with a mark on any
   day something in it is due. Sized in em so it shrinks with the tile. */
function monthGrid(o){
  const anchor = D.parse(o.month||T) || D.today();
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lead = (first.getDay()+6)%7;                 // weeks start Monday
  const days = new Date(anchor.getFullYear(), anchor.getMonth()+1, 0).getDate();
  const mine = childrenOf(o);
  const byDay = {};
  mine.forEach(x=>{ if(x.due) byDay[x.due]=(byDay[x.due]||0)+1; });
  const cells=[];
  for(let i=0;i<lead;i++) cells.push('<i class="pad"></i>');
  for(let d=1;d<=days;d++){
    const iso=D.iso(new Date(anchor.getFullYear(), anchor.getMonth(), d));
    const n=byDay[iso]||0;
    cells.push(`<i class="cday${iso===T?' today':''}${n?' has':''}" data-calday="${o.id}:${iso}">
      <b>${d}</b>${n?`<u>${n>3?'•••':'•'.repeat(n)}</u>`:''}</i>`);
  }
  return `<div class="calgrid">
    ${['M','T','W','T','F','S','S'].map(d=>`<i class="dow">${d}</i>`).join('')}
    ${cells.join('')}</div>`;
}

/* What a click on an object does. The editor is no longer the default — it
   lives on the context menu. `onclick` is per-object, falling back to the
   kind's, and 'read' opens the body full-width with nothing to edit. */
const CLICKS = {
  none:     'Nothing',
  read:     'Open it to read',
  edit:     'Open the editor',
  check:    'Tick it off',
  book:     'Open it as a book',
  generate: 'Make a new object'
};
const clickOf = o => o.onclick || K(o.kind).onclick || 'none';
const spawnBy = o => o.spawnBy || K(o.kind).spawnBy || 'click';
/* A generator presses out a new object beside itself, in whichever direction
   it is set to. `random` drops it wherever there is room. */
function dispense(g){
  const kind=g.genKind||'task', dir=g.genDir||'down';
  const o=create(kind,{parent:g.parent});
  const b=lay(g), [w,h]=sizeOfKind(kind), dv=dev();
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
function tileTap(id){
  const o=byId(id); if(!o) return;
  if(isContainer(o)){ S.view='drawer'; S.drawerId=id; S.kindFilter=null; render(); return; }
  if(false){ if(o.ctl==='settings'){ S.view='settings'; render(); } return; }
  switch(clickOf(o)){
    case 'generate': dispense(o); return;
    case 'book': S.readId=id; S.openId=null; S.bookMode=true; S.bookAt=0; renderSheet(); return;
    case 'read':  S.readId=id; S.openId=null; renderSheet(); break;
    case 'edit':  openObj(id); break;
    case 'check': if(has(o,'check')) toggleDone(id); else openObj(id); break;
    default: break;                      // 'none' — a task just sits there
  }
}
/* Where a click on bare grid happened, so the next new object lands there. */
const pending={cell:null};   // a holder, because three modules write it
function placeAtPending(o){
  const dv=dev();
  if(!pending.cell){ const [w,h]=sizeOfKind(o.kind); o[dv]=o[dv]||freeSpot(w,h,dv,o.parent); return; }
  // a sketched box wins over the kind's own size
  const [kw,kh]=sizeOfKind(o.kind);
  const w=pending.cell.w||kw, h=pending.cell.h||kh;
  const g=gridOf(), box={x:clamp(pending.cell.x,1,g.cols-w+1), y:Math.max(1,pending.cell.y), w, h};
  o[dv] = boxOk(box, o.id, dv, o.parent) ? box : freeSpot(w,h,dv,o.parent);
  // The other device has no box yet. Leaving it null means ensureBox() picks
  // one the first time that layout is opened, rather than inheriting a
  // coordinate that means nothing over there.
  pending.cell=null;
}

/* One tile, for anything. A container gets the drawer front and a preview of
   what is inside it; everything else gets its attributes rendered directly.
   This is the only place that decides how an object looks on a grid, at any
   depth — the desk and a drawer three levels down both come through here. */
function gridTile(o, arr, parentId){
  const cont=isContainer(o);
  let box;
  if(FLOW.has(o.id)){ box=FLOW.get(o.id); FLOW.delete(o.id); }
  else { ensureBox(o, dev(), parentId); box=lay(o); }
  const colour = o.c || K(o.kind).c;
  const handles = arr ? HANDLES.map(h=>`<i class="rz ${h}" data-rz="${h}"></i>`).join('') : '';
  const chips='';   // no size chip, no delete cross — the menu does both
  const place = `grid-column:${box.x} / span ${box.w};grid-row:${box.y} / span ${box.h}`;
  const sel = S.sel.includes(o.id) ? ' selected' : '';

  // A control is a Bureau button that lives on the desk like anything else.
  if(false){
    return `<button class="drawer ctile${sel}" data-ctl="${esc(o.ctl||'')}" data-id="${o.id}" style="--c:${colour};${place}">
      ${chips}<span class="cico">${ic(K(o.kind).ic==='sliders'&&o.ic?o.ic:(o.ic||'sliders'),20)}</span>
      <span class="clabel">${esc(o.title||'')}</span>
      ${handles}
    </button>`;
  }

  /* A checklist is a container that wears its contents on the outside: you can
     see and tick what's in it without opening it. That is the whole difference
     between it and a drawer. */
  if(cont && faceOf(o)==='checklist'){
    const items=childrenOf(o);
    return `<button class="drawer dtile cltile bd-${o.border||'panel'}${sel}" data-drawer="${o.id}" style="--c:${colour};${place}">
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        <span class="clcount">${rollup(o) || (items.filter(x=>x.done).length+'/'+items.length)}</span></div>
      <div class="dbody"><div class="clist">${items.slice(0,14).map(x=>
        `<span class="cline${x.done?' done':''}" data-check="${x.id}">
           <i class="clbox">${x.done?ic('check',10):''}</i>${esc(x.title||'Untitled')}</span>`).join('')
        || '<span class="clempty">Nothing yet — open it to add</span>'}</div></div>
      ${handles}
    </button>`;
  }

  /* A trip is a ticket: a stub torn off down the right, and where to. */
  if(cont && shapeOf(o)==='ticket'){
    return `<button class="drawer dtile triptile bd-${o.border||'panel'}${sel}" data-drawer="${o.id}" style="--c:${colour};${place}">
      <div class="tkmain">
        <span class="tklabel">${o.due?esc(D.human(o.due)):'Some day'}</span>
        <span class="dname">${esc(o.title||'Untitled')}</span>
        ${o.loc?`<span class="tkloc">${ic('flag',11)} ${esc(o.loc)}</span>`:''}
      </div>
      <div class="tkstub">${(o.title||'??').slice(0,3).toUpperCase()}</div>
      ${handles}
    </button>`;
  }

  /* A timeline lays its children along a rule, in date order. */
  if(cont && faceOf(o)==='timeline'){
    const kids=childrenOf(o).slice().sort((a,b)=>(a.due||a.created||'').localeCompare(b.due||b.created||''));
    return `<button class="drawer dtile tltile bd-${o.border||'panel'}${sel}" data-drawer="${o.id}" style="--c:${colour};${place}">
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span></div>
      <div class="tlwrap"><i class="tlrule"></i>
        ${kids.slice(0,8).map((x,i)=>`<span class="tlnode" style="left:${kids.length<2?50:(i/(Math.min(kids.length,8)-1))*100}%">
          <i></i><b>${esc((x.title||'').slice(0,18))}</b><u>${x.due?esc(D.short(x.due)):''}</u></span>`).join('')}
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

  /* A calendar is a container showing the month its children fall in. */
  if(cont && faceOf(o)==='calendar'){
    return `<button class="drawer dtile caltile bd-${o.border||'panel'}${sel}" data-drawer="${o.id}" style="--c:${colour};${place}">
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        <span class="clcount">${D.parse(o.month||T).toLocaleDateString(undefined,{month:'long'})}</span></div>
      <div class="dbody">${monthGrid(o)}</div>
      ${handles}
    </button>`;
  }

  // A drawer on a grid is just a front with a name. What is inside is behind
  // it, not printed on it — you open a drawer to find out what it holds.
  if(cont){
    const bd=o.border||'panel', kn=o.knob||'round', tx=o.texture||'none';
    return `<button class="drawer dtile bd-${bd} tx-${tx} knb-${o.knobpos||'centre'}${sel}${has(o,'magic')?' magicdrawer':''}" data-drawer="${o.id}"
      style="--c:${colour};${o.knobc?`--knob:${esc(o.knobc)};`
        :`--knob:color-mix(in srgb, ${colour} ${o.knobtone==='dark'?'62% , #000':'58% , #fff'});`}${place}">
      ${chips}
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        ${has(o,'magic')?`<span class="magicmark" title="Collects by rule">${ic('sparkle',11)}</span>`:''}
        ${rollup(o)?`<span class="rollup">${esc(rollup(o))}</span>`:''}</div>
      <div class="dfoot"><span class="pull kn-${kn}"></span></div>
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
  if(has(o,'spawn') && spawnBy(o)==='click'){
    const made=K(o.genKind||'task');
    return `<button class="drawer otile sh-press gentile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <span class="genico">${ic(made.ic,20)}</span>
      <span class="genlabel">${esc(o.title||('New '+made.nm.toLowerCase()))}</span>
      <span class="genarrow">${ic('plus',15)}</span>
      ${handles}
    </button>`;
  }
  if(has(o,'spawn') && spawnBy(o)==='type'){
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

  return `<button class="drawer otile sh-${shapeOf(o)}${o.edge?' edge':''}${sel}${has(o,'priority')&&o.prio?' prio-'+o.prio:''}" data-row="${o.id}"
    style="--c:${colour};${has(o,'progress')?`--pct:${goalPct(o)}%;`:''}${place}">
    ${chips}
    <div class="dtop">
      ${has(o,'check')?`<span class="check tilecheck${o.done?' on':''}" data-check="${o.id}">${ic('check',12)}</span>`:''}
      <span class="dname${o.done?' done':''}">${esc(o.title||'Untitled')}</span>
    </div>
    ${has(o,'rating')&&o.rating?`<div class="tilestars">${'★'.repeat(o.rating)}<span>${'★'.repeat(5-o.rating)}</span></div>`:''}
    ${has(o,'text')&&o.body?`<div class="dbody"><div class="tiletext">${esc(o.body).slice(0,220)}</div></div>`:'<div class="dbody"></div>'}
    ${bits.length?`<div class="dfoot"><span class="tilemeta">${bits.join(' · ')}</span></div>`:''}
    ${handles}
  </button>`;
}

/* When a drawer is sorted, its grid is packed in that order rather than read
   from each object's stored box — otherwise choosing "A–Z" would change nothing
   you can see. The stored boxes are left alone, so switching back to Custom
   restores the arrangement you made. */
const FLOW = new Map();   // id -> box, for one render of a sorted grid
function flowSorted(kids, cid){
  const g=gridOf(), dv=dev(), taken=[];
  const free=(b)=> b.x+b.w-1<=g.cols && !taken.some(t=>overlaps(b,t));
  kids.forEach(o=>{
    const [w,h]=(o[dv]&&o[dv].w) ? [o[dv].w,o[dv].h] : sizeOfKind(o.kind);
    let put=null;
    for(let y=1;y<600&&!put;y++) for(let x=1;x<=g.cols-w+1;x++){
      const b={x,y,w,h}; if(free(b)){ put=b; break; }
    }
    put=put||{x:1,y:1,w,h};
    taken.push(put);
    FLOW.set(o.id, put);                      // render-only; never persisted
  });
}

/* The grid for one container. `id` is ROOT for the desk. */
function gridOfContainer(cid){
  const c=container(cid), g=gridOf();
  // You are always arranging. A drawer can be locked to opt out of it.
  const arr=!c.locked;
  const kids=childrenOf(c);
  FLOW.clear();
  if(c.sort) flowSorted(kids, c.id);          // a sort overrides hand placement
  else kids.forEach(o=>ensureBox(o, dev(), c.id));
  const tiles=kids.map(o=>gridTile(o,arr,c.id)).join('');
  // never a two-row sliver: a drawer's board is at least a screenful
  const minRows=Math.max(12, Math.ceil((window.innerHeight-140)/Math.max(1,CELL[dev()])));
  const rows=Math.max(gridRows(dev(),c.id)+(arr?2:0), minRows);

  // a drawer may carry its own board, which overrides the global one
  const bd = c.board ? String(c.board).split('|') : null;
  let boardVars = bd ? `--board-1:${esc(bd[0])};--board-2:${esc(bd[1]||bd[0])};` : '';
  if(c.boardAlpha!=null) boardVars += `--board-alpha:${c.boardAlpha};`;
  return `<div class="grid g-${dev()}${arr?' arranging':''}${c.locked?' locked':''}${c.sort?' sorted':''}"
       id="drawergrid" data-gridfor="${c.id}"
       style="${boardVars}--cols:${g.cols};--rowh:${g.rowh}px;grid-template-rows:repeat(${Math.max(rows,1)},${g.rowh}px)">${tiles}
  </div>`;
}

/* ============================================================
   8 · rendering — rows & cards
   ============================================================ */
function row(o){
  const k=K(o.kind);
  const late=!o.done&&D.overdue(o.due);
  const meta=[];
  meta.push(`<span class="mchip k">${k.nm.toLowerCase()}</span>`);
  if(o.due&&!has(o,'streak')) meta.push(`<span class="mchip${late?' late':''}">${ic('calendar',11)} ${D.human(o.due)}</span>`);
  if(o.repeat&&!has(o,'streak')) meta.push(`<span class="mchip">${ic('repeat',11)} ${o.repeat}</span>`);
  if(has(o,'streak')) meta.push(`<span class="mchip">${ic('repeat',11)} ${streak(o)}-day streak</span>`);
  if(has(o,'progress')) meta.push(`<span class="mchip">${ic('target',11)} ${goalPct(o)}%</span>`);
  if(o.media) meta.push(`<span class="mchip">${ic(o.media.type==='audio'?'music':o.media.type==='video'?'film':'image',11)} ${esc(o.media.label)}</span>`);
  (o.tags||[]).slice(0,3).forEach(t=>meta.push(`<span class="mchip tag">${esc(t)}</span>`));
  const snip=strip(o.body).slice(0,90);
  const lead = has(o,'check')||has(o,'streak')
    ? `<span class="check${(has(o,'streak')? (o.history||[]).includes(T) : o.done)?' on':''}" data-check="${o.id}">${ic('check',13)}</span>`
    : `<span class="kindmark">${ic(k.ic,13)}</span>`;
  return `<div class="rowwrap" data-wrap="${o.id}">
    <div class="swipebg"><span>${ic('check',13)} File</span><span>Delete ${ic('trash',13)}</span></div>
    <div class="row${o.done?' done':''}" data-row="${o.id}" style="--k:${k.c}">
      <span class="grip" data-grip="1">${ic('grip',14)}</span>
      ${lead}
      <div class="body">
        <div class="title">${esc(o.title||'Untitled')}</div>
        ${snip?`<div class="snip">${esc(snip)}</div>`:''}
        <div class="meta">${meta.join('')}</div>
      </div>
      <div class="rowacts">
        <button data-menu="${o.id}" title="More">${ic('more',15)}</button>
        <button data-del="${o.id}" title="Delete">${ic('trash',15)}</button>
      </div>
    </div></div>`;
}
function card(o){
  const k=K(o.kind);
  return `<div class="ocard" data-row="${o.id}" style="--k:${k.c}">
    ${o.media?`<div class="media">${ic(o.media.type==='audio'?'music':o.media.type==='video'?'film':'image',22)}</div>`:''}
    <div style="display:flex;align-items:center;gap:6px"><span style="color:${k.c}">${ic(k.ic,13)}</span>
      <span style="font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);font-weight:600">${k.nm}</span></div>
    <div class="t">${esc(o.title||'Untitled')}</div>
    <div class="s">${esc(strip(o.body).slice(0,110))}</div>
    <div class="meta">${(o.tags||[]).slice(0,2).map(t=>`<span class="mchip tag">${esc(t)}</span>`).join('')}
      ${o.due?`<span class="mchip">${D.human(o.due)}</span>`:''}</div>
  </div>`;
}

/* List view is the same tile, stretched into a band. Same silhouettes, same
   colours — a drawer still looks like a drawer, a task still comes to a point. */
function listTile(o){
  const colour=o.c||K(o.kind).c;
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
      ${o.due?`<span class="mchip">${D.human(o.due)}</span>`:''}
      ${cont?`<span class="pull kn-${o.knob||'round'}"${o.knobc?` style="--knob:${esc(o.knobc)}"`:''}></span>`:''}
    </div>
  </button>`;
}

/* Book view: the drawer's writing set as a two-page spread you turn through.
   Everything is concatenated, then split by how much fits on a page. */
/* One object's writing, paginated into a spread. */
function bookOf(o){
  const words=(o.body||'').split(/\n\n+/).filter(x=>x.trim());
  const per=Math.max(1,Math.ceil(words.length/Math.max(1,Math.ceil(words.length/3))));
  const pages=[]; for(let i=0;i<words.length;i+=per) pages.push(md(words.slice(i,i+per).join('\n\n')));
  if(!pages.length) pages.push('<p class="thin">Nothing written yet.</p>');
  const at=Math.min(S.bookAt||0, Math.max(0,pages.length-1));
  return `<div class="book"><div class="spread">
      <div class="page">${pages[at]||''}<span class="pno">${at+1}</span></div>
      <div class="page">${pages[at+1]||''}${pages[at+1]?`<span class="pno">${at+2}</span>`:''}</div>
    </div>
    <div class="bookbar">
      <button class="pill" data-act="bookprev"${at<=0?' disabled':''}>${ic('chevL',14)}</button>
      <span class="bookcount">${at+1}–${Math.min(at+2,pages.length)} of ${pages.length}</span>
      <button class="pill" data-act="booknext"${at+2>=pages.length?' disabled':''}>${ic('chevR',14)}</button>
    </div></div>`;
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
  return `<article class="scrollentry" data-row="${o.id}" style="--k:${k.c}">
    <header>
      ${has(o,'check')?`<span class="check${o.done?' on':''}" data-check="${o.id}">${ic('check',12)}</span>`:`<span class="kindmark">${ic(k.ic,13)}</span>`}
      <h3${o.done?' class="done"':''}>${esc(o.title||'Untitled')}</h3>
      ${o.due?`<span class="mchip">${D.human(o.due)}</span>`:''}
      ${(o.tags||[]).map(t=>`<span class="mchip tag">${esc(t)}</span>`).join('')}
    </header>
    ${has(o,'media')&&o.media&&o.media.src?`<img class="scrollimg" src="${esc(o.media.src)}" alt="${esc(o.title||'')}">`:''}
    ${o.body?`<div class="prose">${md(o.body)}</div>`:''}
  </article>`;
}

export { spinTo, CLICKS, clickOf, fireButton, tileTap, pending, placeAtPending,
  gridTile, gridOfContainer, row, card, listTile, scrollEntry, bookOf, bookView };
