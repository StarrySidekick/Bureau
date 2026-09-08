import { esc, ic, clamp, D, md, plain, oneline } from './util.js';
import { S, K, T, byId, has, isContainer, faceOf, shapeOf, readOf, spreadOf, childrenOf, container,
  clPerCell,
  rollup, streak, barPct, barSteps, barFilled, barGrid, projectStat, progressOf, tlSpan,
  dev, spawnByOf, genKindOf, genSaid,
  projCoverOf, lifeArtOf, goalStanding, GOAL_STANDINGS,
  makesAnything, ctlOf, takesTyping, showsAddBox,
  knobSizeOf, answered, sortOf, spanOf, coversDay, lateOn, isLate, iconOf, textSizeOf,
  isPicture, isMedia, isPlayable, isDecor, mediaTypeOf, frameOf, isWindow,
  boardLocked, prioOf, repeatSaid, urgencyOf, urgeSaid, durSaid, standsProud, shelfDepth, bookDepth, faceCue, anyFaceCue,
  calViewOf, weekStartOf, calCols, borderOf, textureOf, marginOf, isFragmentKind } from './model.js';
import { CELL, gridOf, drawCols, drawRows, lay, overlaps, boxOk, freeSpot, anySpot, roomFor, gridRows, sizeOfKind,
  ensureBox, shelfRows, shelfOrigin, shelfAt, colsOf } from './grid.js';
import { create, toast, fits, toggleDone, someKind, ctlSpec, ctlSaid, ctlIsOn,
  ctlForm, ctlNum, ctlIndex, ctlPress } from './mutations.js';
import { DECOR, decorOf, decorSVG, LIFE_ART, lifeSVG } from './decor.js';
import { hexOf, objColour, dress, dressAs, OBJ0, OBJN, CHECKS } from './look.js';
import { render } from './views.js';
import { openObj, openWriter, openRead, openViewer } from './sheet.js';
import { objectPanel, schedulePanel } from './panels.js';
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
      const p = has(o,'progress') ? barPct(o) : clamp(streak(o)*14,6,100);
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

/* The deadline, said as a deadline. Only for something carrying one and only
   when it is set — the day a thing *sits* on is already said by dateSaid(), and
   printing both when they agree is the same fact twice. */
/* Both deadlines say themselves on the face, in the order they are read: what
   is owed beats what you aimed for, and a thing with only an aim says so in a
   different word so the two cannot be mistaken for each other. See decision
   120. */
const deadSaid = o => has(o,'deadline') && o.dead ? `due ${D.said(o.dead)}`
  : has(o,'softdeadline') && o.soft ? `aim ${D.said(o.soft)}` : '';

/* Every face can show what it totals. It used to be two of them — a drawer
   front and a checklist — so whether a container told you what it was worth
   depended on which coat it had on. `rollup()` answers null unless the
   container asked for one, so this is safe to hang on anything. */
const rollTag = c => { const r=rollup(c);
  return r ? `<span class="rollup">${esc(r)}</span>` : ''; };

/* ---- pinned to a board, rather than laid flat on one ------------------
   A setting, off by default. It gives every tile a little air around it and
   tilts it a degree or two, as though a pin went through one of its top
   corners — which is what a real board of things looks like and what a grid of
   flush rectangles deliberately does not.

   Three things make it work rather than look like a bug:

   - **the tilt is small.** One to three degrees. Past about four it stops
     reading as "pinned" and starts reading as "broken".
   - **it never changes.** The angle is derived from the object's own id, so a
     tile tilts the same way every render, on every device, forever. A random
     number would jitter on every rebuild, which is the thing that would make
     this unbearable.
   - **the origin is a top corner**, alternating left and right off the same
     hash, because a pin goes through the top of a piece of paper and the sheet
     hangs from it.

   The gap is a **margin on the tile**, not a `gap` on the grid: the grid is a
   coordinate space and `cellW()` measures it, so changing its geometry would
   move every tile out from under the drag maths. A margin shrinks the tile
   inside a cell that has not moved.

   During a drag the inline transform wins and the tile straightens, which is
   the right thing — you are holding it. See decision 75. */
const tiltOf = id => {
  let h=0;
  for(let i=0;i<id.length;i++) h=(h*31 + id.charCodeAt(i)) >>> 0;
  // 1.0° to 3.0°, either way, off a corner chosen by the same hash
  const deg = 1 + (h % 21) / 10;
  return {deg: (h & 1) ? deg : -deg, right: !!(h & 2)};
};

const HANDLES = ['nw','ne','se','sw'];   // corners only — any corner resizes

/* An object let out of a locked board says so on its own tile: a pin at the
   top left for one you can still pick up, a bracket at the bottom right for
   one you can still resize. They ride along with the resize handles, which is
   the one thing every branch of drawTile() already renders — so a face nobody
   has thought about gets them without being told, the same way `place` carries
   the tilt. See decision 81. */
const freeMarks = o =>
  (has(o,'movable')   ? `<i class="freepin" title="Movable on a locked board">${ic('pin',11)}</i>` : '')
+ (has(o,'resizable') ? `<i class="freegrip" title="Resizable on a locked board"></i>` : '');

/* How much of a body is printed on a tile's face. Enough to fill the tallest
   one there is: it was 220 characters against a four-line clamp, which is where
   a note that stopped halfway down its own paper came from. The tile hides
   whatever runs past its own height, so the only job of a number here is to be
   larger than any face can show. Cut the text *then* escape it — slicing the
   escaped string cuts through an `&amp;` and prints the entity. */
const BODY_ON_FACE = 1200;

/* ---- a name is a thing you can tap ------------------------------------
   On an unlocked board, tapping the words *is* how you change them. It was a
   double tap on the whole tile, which is a gesture you have to be told about
   and which a phone spends on zooming; the words are the obvious target and
   they are the only part of a tile that means anything to edit.

   `data-edit` is the whole of the wiring — wire.js turns it into `S.editId`
   after checking the board is unlocked, so a locked board still opens what you
   tap and nothing has to know where it was tapped from. `nameField()` is the
   other half: wherever a name is drawn, it becomes a field when it is the one
   being edited, which is what lets a checklist line and a list band be typed
   in without either of them being a tile on a board. See decision 61. */
function nameField(o, cls, extra){
  const t=o.title||'';
  if(S.editId===o.id)
    return `<input class="inlinename ${cls||''}" data-inline="${o.id}:title" value="${esc(t)}"
      placeholder="Untitled" autocomplete="off" enterkeyhint="done">`;
  return `<span class="${cls||'dname'}${o.done?' done':''}" data-edit="${o.id}">${esc(t||'Untitled')}</span>`;
}

/* The face of a calendar container: the span it is set to, with a mark on any
   day something it collects is due. Sized in em so it shrinks with the tile.
   Which days it draws — and in what order — is calCols(), so the week-start and
   weekend settings reach the front as well as the opened view. A month is the
   weeks its month falls in, a week is one row, a day is one square. */
const DOWMARK = ['S','M','T','W','T','F','S'];
function calFace(o, titles){
  const view = calViewOf(o), cols = calCols(o);
  const anchor = D.parse(o.month||T) || D.today();
  const {from, to, month} = calSpan(o, anchor, view);
  // a thing that lasts marks every day it covers, the same as it does inside
  const kids=childrenOf(o), byDay={};
  for(let dt=new Date(from); dt<=to; dt=D.add(dt,1)){
    const iso=D.iso(dt);
    byDay[iso]=kids.filter(x=>coversDay(x, iso));
  }
  const cells=[];
  for(let dt=new Date(from); dt<=to; dt=D.add(dt,1)){
    if(!cols.includes(dt.getDay())) continue;
    const iso=D.iso(dt), on=byDay[iso]||[], n=on.length;
    /* A big face earns words: the planner prints the first titles in the cell
       the way a wall calendar does, and sums the rest. See decision 80. */
    const said = titles
      ? on.slice(0,2).map(x=>`<em>${esc(x.title||'Untitled')}</em>`).join('')
        + (n>2?`<u>+${n-2}</u>`:'')
      : n?`<u>${n>3?'•••':'•'.repeat(n)}</u>`:'';
    cells.push(`<i class="cday${iso===T?' today':''}${n?' has':''}${
        month!=null&&dt.getMonth()!==month?' out':''}" data-calday="${o.id}:${iso}">
      <b>${dt.getDate()}</b>${said}</i>`);
  }
  const wide = view==='day' ? 1 : cols.length;
  return `<div class="calgrid cal-${view}${titles?' cal-titles':''}" style="--dcols:${wide}">
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

/* ---- the small calendar faces — decision 80 ---------------------------
   Below the month a calendar face is a desk calendar: the tear-off day pad,
   then as much of the agenda as the box affords. The pad is always *today* —
   paging months is the month face's job — and it carries today's data-calday,
   so a drop on a small calendar still dates the thing. */
function calPad(o){
  const now=D.today();
  return `<span class="calpad" data-calday="${o.id}:${T}">
    <u>${esc(now.toLocaleDateString(undefined,{month:'short'}))}</u>
    <b>${now.getDate()}</b></span>`;
}
/* What a small face lists: the things it collects that still want doing —
   the late ones first, then today's, then the next by date. */
function calSoon(o, n){
  const kids=childrenOf(o).filter(x=>!x.done);
  const due=x=>x.due||'';
  const byDue=(a,b)=>due(a).localeCompare(due(b));
  const today=kids.filter(x=>coversDay(x,T));
  const late=kids.filter(x=>isLate(x) && !coversDay(x,T)).sort(byDue);
  const later=kids.filter(x=>due(x)>T).sort(byDue);
  return [...late, ...today, ...later].slice(0,n);
}
/* A small calendar face wears its border at the **edge**, the way a checklist
   does: the gilt held off by five pixels is five pixels taken out of every row
   of an agenda, and on a tile this size a ruled frame sitting inside a
   moulding ring reads as two borders, the inner one grey. So up to three cells
   a side the frame goes to the rim and the border slot sits out — on a magic
   calendar, which is nearly all of them, the gilt *is* the border there. Every
   face below the month gets it whatever its height, because a two-by-six
   agenda is the same edge-to-edge rows a two-by-two one is; the month keeps
   both once it is bigger than three cells a side, where there is room for
   them. See decisions 79 and 80. */
/* The three families an object wears. A drawer is wood — colour, edge,
   panelling, knob, grain; an object is paper, which is the same list minus
   the hardware and with a **stock** in the panelling's place: what the sheet
   is, as against what is printed on it. One call, so a tile that grows a new
   shape gets all three without being told. See decision 99. */
/* Which of the three tears a fragment wears — a hash of its own id, so it is
   the same one on every render forever and two fragments side by side are not
   the same piece of paper twice. Exactly `tiltOf()`'s trick, for exactly its
   reason. See decision 145. */
function tornOf(o){
  if(!isFragmentKind(o.kind)) return '';
  let h=0; const id=String(o.id);
  for(let i=0;i<id.length;i++) h=(h*31 + id.charCodeAt(i)) >>> 0;
  return ` tornedge torn${h%3}`;
}
/* An object's three look families, plus the torn edge if it is a piece of
   something. Every object tile goes through here, so a branch nobody has
   thought about gets the edge without being told — the same argument the size
   classes make. */
const paper = o => `${dress(o,'bd')} ${dress(o,'tx')} ${dress(o,'st')}${tornOf(o)}`;

/* **The page you read something on is a sheet of its own paper.** A note that
   is ruled on the board is ruled when you open it, and a note on aged stock
   opens onto a foxed sheet — same slot, same aesthetic, drawn larger. It was
   the one place an object stopped looking like itself: the tile carried a
   stock and a grain and the letter-sized page was flat `--paper-2` whatever
   the thing was made of.

   Two of the three families, not all three. A **stock** is what the sheet is
   and a **grain** is what is printed on it, so both scale up. An **edge** is
   the tile's frame on the board — a mount round a postcard — and a page has
   its own border and its own radius; a double rule inside that would be two
   frames on one sheet, which is decision 88's picture-frame shop again.

   It goes on the **spread** rather than on each page, because the spread is
   the sheet: two pages side by side are one leaf, and in scroll mode the
   paper is what the column moves over rather than something that moves with
   it — a grain inside a scrolling page is an absolute box against the padding
   box, so it would cover the first screenful and stop. */
const sheetOf = o => `bookpaper ${dress(o,'tx')} ${dress(o,'st')}`;

const calBorder = (o, snug) => `${snug?' calsnug':''}${
  snug && has(o,'magic') ? '' : ` ${dress(o,'bd')}`}`;

/* An agenda row: when first, then what — a calendar's own order of asking. */
const calRow = x => `<span class="calrow${isLate(x)&&!coversDay(x,T)?' late':''}" data-row="${x.id}"
  title="${esc(x.title||'Untitled')}">
  <u>${coversDay(x,T)?'Today':esc(D.short(x.due))}</u><b>${esc(x.title||'Untitled')}</b></span>`;

/* What a click on an object does. The editor is no longer the default — it
   lives on the context menu. `onclick` is per-object, falling back to the
   kind's, and 'read' opens the body full-width with nothing to edit. */
const CLICKS = {
  none:     'Nothing',
  read:     'Open it to read',
  edit:     'Open it to write',
  check:    'Tick it off',
  /* The When page: dates, both deadlines, the estimate, the ranks, the repeat
     and the tags. The default for a task, because a task is the one type where
     "what is this worth and when" is the question you have every time you look
     at it. See decision 123. */
  when:     'Open it to schedule',
  settings: 'Open its settings',
  generate: 'Make a new object',
  // a counter's whole job is to go up, so that is what pressing one does
  count:    'Add one to it',
  // a control is a switch, and pressing a switch flips it — nothing opens
  toggle:   'Flip the switch',
  // a sound or a video: press to start it, press again to stop — decision 144
  play:     'Play it, and press again to stop'
};
const clickOf = o => o.onclick || K(o.kind).onclick || 'none';
/* A generator presses out a new object beside itself, in whichever direction
   it is set to. `random` drops it wherever there is room. */
function dispense(g){
  /* `random` is not a kind, so it is resolved *here* and once — asking again
     further down would place the box for one type and make another. */
  const kind = makesAnything(g) ? someKind() : genKindOf(g);
  // a press on a full shelf makes nothing and says why — decision 141
  if(!fits(kind, g.parent)) return;
  const dir=g.genDir||'down';
  const o=create(kind,{parent:g.parent});
  const dv=dev(), b=lay(g), [w,h]=sizeOfKind(kind, dv, g.parent);
  const spots={
    down:  {x:b.x,        y:b.y+b.h, w, h},
    up:    {x:b.x,        y:Math.max(1,b.y-h), w, h},
    right: {x:b.x+b.w,    y:b.y,     w, h},
    left:  {x:Math.max(1,b.x-w), y:b.y, w, h}
  };
  const want=spots[dir];
  o[dv] = (dir!=='random' && want && boxOk(want,o.id,dv,g.parent)) ? want : anySpot(w,h,dv,g.parent);
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
/* ---- playing a sound, and a moving picture -----------------------------
   One at a time, and the audio element is kept **outside the DOM**. `render()`
   replaces `#app` wholesale, so a `<audio>` written into a tile would be torn
   out and silenced by any unrelated re-render — ticking a task on the far side
   of the board would stop the music. Held in a module map keyed by object id
   instead, which survives every render there is, and named by `src` so
   changing the file behind an object does not go on playing the old one.

   A video cannot be kept out of the DOM: you have to see it. So its element is
   in the tile, a render does stop it, and that is stated rather than worked
   around — the same bargain an inline edit makes.

   Nothing here renders. `.sounding` is written onto the tile by hand, because
   the whole point of holding the element outside `#app` is that playing must
   not be at the mercy of a render. */
const SOUNDS = new Map();
let SOUNDING = null;
const isSounding = id => SOUNDING===id;
function markSounding(id, on){
  SOUNDING = on ? id : (SOUNDING===id ? null : SOUNDING);
  document.querySelectorAll('.sounding').forEach(el=>{
    if(el.dataset.row!==SOUNDING) el.classList.remove('sounding'); });
  const el = document.querySelector(`[data-row="${id}"]`);
  if(!el) return;
  el.classList.toggle('sounding', !!on);
  // a sound's button is in the spindle and says which way the press goes; a
  // video has no button to rewrite, because the picture is the control
  const btn = el.querySelector('.medbtn:not(.blank)');
  if(btn) btn.innerHTML = ic(on?'pause':'play',20);
}
/* Whatever is playing, stopped — a desk plays one thing at a time, the way a
   room does. Both kinds, because a video starting while a record is spinning
   is two things at once just as much as two records would be. */
function stopSounds(){
  SOUNDS.forEach((a,id)=>{ if(!a.paused){ a.pause(); markSounding(id,false); } });
  document.querySelectorAll('.vidtile video').forEach(v=>{
    if(!v.paused){ v.pause(); const t=v.closest('[data-row]'); if(t) markSounding(t.dataset.row,false); } });
  SOUNDING = null;
}
function playPress(id){
  const o=byId(id); if(!o) return;
  const src = o.media && o.media.src;
  // nothing chosen yet: the press is "let me pick a file", which is the surface
  if(!src){ openTile(id, ()=>openViewer(id)); return; }
  if(mediaTypeOf(o)==='video'){
    const v = document.querySelector(`[data-row="${id}"] video`);
    if(!v) return;
    if(v.paused){ stopSounds(); v.muted=false; v.play().then(()=>markSounding(id,true)).catch(()=>{}); }
    else { v.pause(); markSounding(id,false); }
    return;
  }
  let a = SOUNDS.get(id);
  if(a && a.forSrc !== src){ a.pause(); a=null; }
  if(!a){
    a = new Audio(src); a.forSrc = src; a.preload='none';
    a.addEventListener('ended', ()=>markSounding(id,false));
    SOUNDS.set(id, a);
  }
  if(a.paused){ stopSounds(); a.play().then(()=>markSounding(id,true)).catch(()=>{}); }
  else { a.pause(); markSounding(id,false); }
}

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
    case 'read':  openTile(id, ()=> isMedia(o) ? openViewer(id) : openRead(id)); break;
    // the editor is the writing surface now: the body, full screen, and nothing
    // else on it. Every *setting* is in the object's own panel.
    case 'edit':  openTile(id, ()=>openWriter(id)); break;
    // a streak has no checkbox but is very much tickable, and since the Today
    // tab went this is the one-tap way to mark a habit off from the board.
    // Ticking has a movement of its own — the pop — so it isn't an opening.
    case 'check': if(has(o,'check')||has(o,'streak')) toggleDone(id); else openTile(id, ()=>openObj(id)); break;
    case 'settings': openTile(id, ()=>objectPanel(id)); break;
    /* Pressing a control is not an opening either: the thing that answers is
       the board, which is already behind it. */
    case 'toggle': ctlPress(id); return;
    /* A press starts it and a press stops it, and neither is an opening —
       what answers is the tile itself. See playPress(). */
    case 'play': playPress(id); return;
    /* Neither is adding one to a counter. The wheels are spun in place rather
       than re-rendered, because a fresh element starts at its final transform
       and the count would blink from 7 to 8 instead of rolling. */
    case 'count': {
      o.count=(o.count||0)+1; save();
      const w=document.querySelector(`[data-row="${id}"] .cntnum`);
      if(w) spinTo(w, o.count); else render();
      return; }
    /* One destination, two ways in: this and *When…* on the long press. The
       whole page rather than a bubble, because it holds a month and nine rows
       — see decision 123. */
    case 'when': openTile(id, ()=>schedulePanel(id)); break;
    default: break;                      // 'none' — it just sits there
  }
}
/* Where a click on bare grid happened, so the next new object lands there. */
const pending={cell:null};   // a holder, because three modules write it
function placeAtPending(o){
  const dv=dev();
  /* No cell, or a cell that named a board but no square on it — which is what
     a sketch on a sorting drawer leaves behind, because that drawer holds
     nothing and the coordinate was measured somewhere the object is not going.
     See homeFor() in model.js. */
  if(!pending.cell || pending.cell.x==null){
    pending.cell=null;
    const [w,h]=sizeOfKind(o.kind, dv, o.parent); o[dv]=o[dv]||anySpot(w,h,dv,o.parent); return;
  }
  // a sketched box wins over the kind's own size
  const [kw,kh]=sizeOfKind(o.kind, dv, pending.cell.parent);
  const w=pending.cell.w||kw, h=pending.cell.h||kh;
  const g=gridOf(undefined, pending.cell.parent), box={x:clamp(pending.cell.x,1,g.cols-w+1), y:Math.max(1,pending.cell.y), w, h};
  o[dv] = boxOk(box, o.id, dv, o.parent) ? box : anySpot(w,h,dv,o.parent);
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
/* How far the shelf being drawn has pushed the board, in cells, in **both**
   directions. A holder rather than an argument because gridTile() is also
   called by the type picker's samples, which are on no shelf at all. Only the
   CSS placement uses it — a box is never rewritten, exactly as it never was
   for a page. See decision 141. */
const SHELFSHIFT = {x:0, y:0};
function gridTile(o, arr, parentId){
  let box;
  if(FLOW.has(o.id)){ box=FLOW.get(o.id); FLOW.delete(o.id); }
  else { ensureBox(o, dev(), parentId); box=lay(o); }
  if(SHELFSHIFT.x || SHELFSHIFT.y) box={...box, x:box.x-SHELFSHIFT.x, y:box.y-SHELFSHIFT.y};
  /* Stamped on the same way the size classes are — the first `class="` of
     whatever drawTile() returns — so the two traits that let an object out of
     a locked board reach every face without one of them being told. */
  const sz=[sizeClass(box),
    /* A tick box of its own, spliced in with the size classes for the same
       reason they are: every branch below returns one element and a class list
       written here reaches all of them, including the ones nobody has thought
       about. The desk's answer needs no class — it is the `:where()`-weighted
       rule on the root. See decision 149. */
    o.check && CHECKS[o.check] ? 'ck-'+o.check : '',
    has(o,'movable')   ? 'freemovable' : '',
    has(o,'resizable') ? 'freesizable' : ''].filter(Boolean).join(' ');
  /* Samples are on no board at all, so they get no perspective — a type drawn
     in the picker is a specimen, not a thing standing somewhere. */
  const persp = arr===false ? null : perspOf(box);
  const html=drawTile(o, arr, box, persp);
  return sz ? html.replace('class="', `class="${sz} `) : html;
}
/* ---- the two layers under everything ----------------------------------
   A tile's own `::before` and `::after` are spoken for several times over —
   the gilt frame takes one, and half the object *shapes* take the other (the
   index card's margin, the habit's bar, the idea's fold, the tab, the chit).
   So the two things that have to sit under the contents and hold no text of
   their own are **real elements**, spliced in the same way the size classes
   are: into whatever `drawTile()` returned, so a branch nobody has thought
   about gets them too.

   `.dpanel` is the moulding on a drawer front (decision 88) and the mount on
   an object; `.dgrain` is the grain, which used to be the drawer tile's own
   `::after` and could not be, on an object, for the reason above. Both are
   the only surfaces the drawn-line filter may touch — displacing a name is
   smudging the label rather than drawing the box. See decisions 96 and 99. */
/* Thickness, as a multiplier on everything the slot draws: how much flank you
   see from the side, and how far the shadow reaches. One number, so a thing
   cannot be thick in its shadow and thin in its side. Derived from what a thing
   *is* rather than from what it is called, so a type invented at runtime gets a
   sensible answer without being told. */
const depthOf = o =>
    isDecor(o)      ? 0           /* a cut-out with no box to have sides — see below */
  : isContainer(o)  ? 1           // furniture, standing on the shelf
  : shapeOf(o)==='spine' ? 0.9    // a book is nearly as deep as the drawer beside it
  : has(o,'media')  ? 0.55        // a framed thing has a frame's thickness
  : 0.18;                         // paper, lying on it
/* Where this tile sits relative to the middle of the board, −1..1 on each axis.
   That is the whole of the perspective: standing in front of the middle of a
   bookshelf you see the *right* side of everything to your left and the left
   side of everything to your right, and nothing at all of the thing dead
   centre. It is a fact about the board rather than about the phone, so it is
   written once per render and never again — the shelf's depth costs nothing
   per frame, which is why it can be on every tile while decision 108's board
   slide stays the only thing that moves. See decision 117. */
/* A holder rather than an argument, for the reason SHELFSHIFT is one — and
   because the answer is a fact about the *board*, not about the tile. Working
   it out per tile meant `colsOf()` and `pageRows()` fifty times a board, and
   each of those walks the parent chain and scans S.objects to find out what
   grid the desk is set to: the same lookup, fifty times, growing with the desk.
   `gridOfContainer()` fills it in once. Zero rows means a Mac or a board that
   has not been measured yet, and no perspective either way. */
const PERSP = {cols:0, rows:0};
function perspOf(box){
  if(!PERSP.rows || !PERSP.cols) return null;
  const px = ((box.x - 1 + box.w/2) / PERSP.cols) * 2 - 1;
  const py = ((box.y - 1 + box.h/2) / PERSP.rows) * 2 - 1;
  return { x:+clamp(px,-1,1).toFixed(3), y:+clamp(py,-1,1).toFixed(3) };
}
/* Only something with real thickness gets the extra element. Paper on the
   shelf has no flank to show, and two hundred empty layers on a full board is
   a render cost with nothing drawn on it.

   A **decoration** is the one thing that is thick and still gets none. It
   stands on the board rather than in it and wears no tile at all — no paper,
   no border, no shadow, no name (decision 86) — so there is no box for a side
   face to be a side *of*, and drawing one put a hard grey rectangle round a
   cut-out plant. Thickness is not the test; having a box is. */
const FLANKED = 0.5;
/* Whether this tile is drawn as a book, which is a question about the *box* and
   not about the type: a container one cell wide is a spine whatever face it
   asked for (decision 50), and an object is one when its shape says so. Both
   branches of drawTile() below reach the same answer, and this has to agree
   with them — a tile told it is a book and then drawn as a drawer would be
   shaded by a slider that isn't showing it. */
const drawsAsSpine = (o, box) => isContainer(o)
  ? (faceOf(o)==='spine' || box.w<=1)
  : shapeOf(o)==='spine';
/* One condition for the layer and for the numbers that dress it, so a tile can
   never carry one without the other — and now it asks *which* of the two
   sliders it stands under, so a desk with the books turning and the drawers
   flat draws a layer on the books and none at all on the drawers. Zero still
   costs nothing: no element and no numbers, per tile rather than per desk. */
const standsOut = (o, persp, box) => !!persp && depthOf(o) >= FLANKED
  && (drawsAsSpine(o, box) ? bookDepth() : shelfDepth()) > 0;
/* The five drawn on the face go to things with a face to draw them on: a
   drawer, a card, a picture. Not a book — a spine is a cylinder and has its own
   answer already — and not paper, which lies on the shelf rather than standing
   in it, the same `FLANKED` line the flank is drawn at. Each layer is emitted
   only when its own slider is up, because two extra elements on every tile cost
   about a fifth of a render at three thousand objects and a layer with nothing
   painted on it is the worst kind. See decision 118. */
const FACE_LAYERS = [
  ['facelight',  '<i class="dwash"></i>'],
  ['facesweep',  '<i class="dsweep"></i>'],
  ['arris',      '<i class="darris"><i class="artop"></i><i class="arbot"></i></i>'],
  ['recess',     '<i class="drecess"></i>']
];
/* `knobturn` and `fieldshift` are in FACE_CUES too but need no element — the
   first rides on `.pull`'s own pseudo and the second on `.dpanel`, which has
   been there since decision 88. They still count towards `takesFace()`, or a
   desk with only those two on would carry no `--px` for them to read. */
const takesFace = (o, persp, box) =>
  !!persp && depthOf(o) >= FLANKED && !drawsAsSpine(o, box);
const faceLayers = (o, persp, box) => !takesFace(o, persp, box) ? ''
  : FACE_LAYERS.reduce((h,[k,html])=> h + (faceCue(k) > 0 ? html : ''), '');
/* One condition for every layer and for the numbers that dress them all, so a
   tile can never carry a cue without the eye it reads. */
const hasPersp = (o, persp, box) => standsOut(o, persp, box)
  || (takesFace(o, persp, box) && anyFaceCue());
const SIDE_LAYER = '<i class="dside"><i class="dtop"></i><i class="dbot"></i></i>';
/* How many children a collage will draw. A face is a miniature and sixty
   boxes is already more than one reads as an arrangement; past that it is a
   texture, and it is a texture that costs a render. */
const COLLAGE_MAX = 60;

/* ---- the cover a project wears ------------------------------------------
   A piece of work has a shape you know before it exists — a film is a poster,
   an album is a sleeve, a game is a boxed case, an app is an icon — and the
   project face wears it. A picture you have put on it is always the cover;
   with none yet, each kind of work draws its own **placeholder**, which is
   what makes an empty one recognisable as the thing it is going to be rather
   than as a project that has not been filled in.

   One function and one class per cover, so the report underneath is the same
   markup for all of them: eight faces that report the same walk must not be
   eight blocks of markup, which is decision 131's rule from the other side.
   See decision 135. */
/* One disc, drawn once. A record cover and a sound object are the same
   object seen twice — silver, a label in the thing's own colour, and the name
   printed round it — so they share this rather than each carrying a copy that
   would drift the first time the lettering changed. */
function discHTML(o){
  const t = (o.title||'').trim().slice(0, 42);
  const pid = 'cdp_'+o.id;
  return `<i class="cd"><b></b>${t?`
    <svg class="cdtext" viewBox="0 0 100 100" aria-hidden="true">
      <defs><path id="${esc(pid)}" fill="none"
        d="M 13 50 A 37 37 0 0 1 87 50 A 37 37 0 0 1 13 50"></path></defs>
      <text><textPath href="#${esc(pid)}" startOffset="25%"
        text-anchor="middle">${esc(t)}</textPath></text>
    </svg>`:''}</i>`;
}
function projCover(o, cov, st){
  if(cov==='plain') return st.cover
    ? `<span class="projcover" style="background-image:url('${esc(st.cover)}')"></span>` : '';
  if(st.cover) return `<span class="projcover" style="background-image:url('${esc(st.cover)}')"></span>`;
  const mark = ic(iconOf(o), 26);
  switch(cov){
    /* **A record is the whole tile.** The disc fills the box it is in, there
       is no sleeve behind it, and the name runs round the label the way it is
       printed on one — which is the one place on this desk where curved type
       is the honest drawing rather than a trick, because a record's lettering
       really does follow the groove.

       Curved text is the one thing CSS cannot do, so the ring of lettering is
       an inline SVG `textPath` over the CSS disc: the disc keeps its gradients
       and its sheen, and the SVG carries nothing but the words. `id` is per
       object because two records on one board would otherwise share a path.

       **Two half-arcs, never one nearly-closed one.** A circle written as a
       single arc back to a point a hundredth away from where it started makes
       the renderer choose between two candidate centres, and with
       large-arc + sweep both set it picks the one *below* the disc — so the
       lettering came out on a circle of the right size in the wrong place,
       under the tile, silently. Left point, over the top to the right point,
       and round the bottom back: the top half is the first quarter of the
       path, which is why the title is offset a quarter along and reads left to
       right where a record's lettering is. */
    case 'album': case 'song':
      return `<span class="projcover projdisc">${discHTML(o)}</span>`;
    // an icon, on the squircle the whole tile has become
    case 'app':   return `<span class="projcover projapp">${mark}</span>`;
    /* A boxed game: the cover, with the platform's strip down the left the way
       a case has it. The strip is drawn whether or not the platform is named —
       it is what says "game" — and the mark stands in for the artwork. */
    case 'game':  return `<span class="projcover projgame">
        <i class="gspine"><u>${esc(o.platform||'')}</u></i><em>${mark}</em></span>`;
    // a poster with nothing on it yet is its own title, set large
    case 'film':  return `<span class="projcover projposter"><b>${esc(o.title||'Untitled')}</b></span>`;
    // a painting is itself, so an empty one is the stretcher and the mount
    case 'art':   return `<span class="projcover projart">${mark}</span>`;
    default:      return '';
  }
}

/* ---- a switch is a piece of hardware, and hardware comes in sizes -------
   One cell is a **push button**: a disc you press, because at 40px a lever has
   no throw to read. One cell in either direction is a **light switch**: a
   plate on the wall with a bat thrown up or down, which is the shape a switch
   has when it is tall and thin. Two cells each way and up it is a **knife
   switch**: two poles hinged at one end and closing into their jaws, which is
   what a switch looks like when it is big enough to see the mechanism.

   All three say their state by **position**, never by colour: the button is
   proud or sunk, the bat is up or down, the blades are open or closed. A
   colour is a thing you have to have learnt; a lever is a thing you can see.

   Drawn as inline SVG rather than stacked boxes, because a blade at an angle
   and a tapered bat are shapes, and the CSS version of them was six nested
   pseudo-elements that never quite lined up. Nothing here names a colour: the
   metal is `--brass`, the body is the object's own `--c`, and the plate is the
   one light this app has, at the upper left. */
const switchShape = box =>
  (box.w<=1 && box.h<=1) ? 'push' : (box.w>=2 && box.h>=2) ? 'knife' : 'light';

function ctlSwitch(box, on){
  const shape = switchShape(box);
  if(shape==='push') return `<span class="cpush" aria-hidden="true"><i></i></span>`;
  if(shape==='light') return `<svg class="ctlart artlight" viewBox="0 0 44 72" aria-hidden="true">
      <rect class="plate" x="1.5" y="1.5" width="41" height="69" rx="5"/>
      <circle class="screw" cx="22" cy="8" r="2.2"/>
      <circle class="screw" cx="22" cy="64" r="2.2"/>
      <rect class="well" x="13" y="17" width="18" height="38" rx="3"/>
      <g class="bat"><path d="M16.5 36 L27.5 36 L25.5 17.5 Q22 14.5 18.5 17.5 Z"/></g>
    </svg>`;
  /* The viewBox leaves room **above** the slate for the blades to stand open
     in: a knife switch open is a thing sticking up out of its base, and a box
     drawn tight to the closed position clips the only state that is not the
     default. Nothing may leave the viewBox — the SVG scales to `meet`, so what
     fits the box fits the tile at every size. */
  return `<svg class="ctlart artknife" viewBox="0 0 100 76" aria-hidden="true">
      <rect class="base" x="4" y="26" width="92" height="46" rx="5"/>
      ${/* the jaws the blades close into, and the posts they hinge on */''}
      <g class="jaw"><rect x="74" y="36" width="6" height="12" rx="1.5"/>
        <rect x="74" y="54" width="6" height="12" rx="1.5"/></g>
      <g class="post"><circle cx="22" cy="42" r="5"/><circle cx="22" cy="60" r="5"/></g>
      <g class="blades">
        <rect class="blade" x="20" y="39" width="60" height="6" rx="2"/>
        <rect class="blade" x="20" y="57" width="60" height="6" rx="2"/>
        <rect class="grip" x="70" y="34" width="11" height="34" rx="4"/>
      </g>
    </svg>`;
}

/* ---- the knob, and the one that is also a dial --------------------------
   Every drawer front's knob goes through here, so a front that reports and a
   front that does not are one piece of markup with one extra class. The ring
   is a conic sweep round the outside of the knob — burnt into the wood rather
   than laid over it — and it is written as a custom property so the stylesheet
   owns every colour, which is the rule everywhere else on a tile.

   `ringFor()` is the test, and it is about the object rather than its type: a
   container that carries `progress` is one you have asked to report, so it
   gets the dial. Everything else gets the knob it has always had. */
function ringFor(o){
  if(!isContainer(o) || !has(o,'progress')) return null;
  return clamp(Math.round(barPct(o)), 0, 100);
}
function knobHTML(o, ring){
  return `<span class="pull ${dress(o,'kn')}${ring==null?'':' pullring'}"${
    ring==null?'':` style="--ring:${ring}%" title="${ring}% done"`}></span>`;
}

const GRAIN_LAYER = '<i class="dgrain"></i>';
const PANEL_LAYER = '<i class="dpanel"></i>';
function drawTile(o, arr, box, persp){
  const html = drawTileFace(o, arr, box, persp);
  const i = html.indexOf('>');          // esc() escapes `>`, so this is the tag
  if(i < 0) return html;
  /* The grain layer only when there is a grain. Most things on a desk have
     none, and two extra elements on every tile cost about a fifth of a render
     at three thousand objects — measurable, and worth not paying for a layer
     with nothing on it. The moulding layer is unconditional, because *which*
     aesthetics put something on it is the stylesheet's business and encoding
     that list here is the silent-failure coupling decision 98 exists to
     avoid. */
  const layers = (html.includes('class="dpanel"') ? '' : PANEL_LAYER)
    + (textureOf(o)==='none' ? '' : GRAIN_LAYER)
    + (standsOut(o, persp, box) ? SIDE_LAYER : '')
    + faceLayers(o, persp, box);
  return html.slice(0, i+1) + layers + html.slice(i+1);
}
function drawTileFace(o, arr, box, persp){
  const cont=isContainer(o);
  const colour = objColour(o);
  /* Grips are for arranging, so an unlocked board has them on everything and
     a locked one only on an object whose corners the lock has let out. The
     marks are a different question — they say what this tile will still do —
     so they show on any real board, locked or not, and on no sample. */
  const grips = arr===true || (arr && has(o,'resizable'));
  const handles = (grips ? HANDLES.map(h=>`<i class="rz ${h}" data-rz="${h}"></i>`).join('') : '')
    + (arr ? freeMarks(o) : '');
  const chips='';   // no size chip, no delete cross — the menu does both
  /* How big this one's words are, folded into the placement so every branch
     below carries it without being told: `place` is the tail of every tile's
     style attribute. The stylesheet multiplies its own sizes by it, so a tile
     that already shrinks its name at three cells wide still does — smaller,
     larger, and narrow are three separate facts about the same line. */
  const ts = textSizeOf(o);
  /* The tilt rides in `place`, which is the tail of every tile's style
     attribute — so a branch of drawTile() nobody has thought about gets it too,
     the same way --tscale does. The stylesheet only uses it under `.pinboard`;
     off, the two custom properties sit there costing nothing. */
  const tilt = S.look.pinned ? tiltOf(o.id) : null;
  /* The slot's three numbers, folded into `place` for the same reason
     `--tscale` is: it is the tail of every tile's style attribute, so a branch
     of drawTile() nobody has thought about gets them too. They are written only
     while the shelf is on, and they never change again until the next render —
     the flank you see, the shadow you throw and the light on a curved spine are
     facts about where a thing stands, not about what the phone is doing.
     See decision 117. */
  const place = `${ts!==1?`--tscale:${ts};`:''}${
    tilt?`--tilt:${tilt.deg}deg;--pinx:${tilt.right?'100%':'0%'};`:''
  }${hasPersp(o, persp, box) ? `--px:${persp.x};--py:${persp.y};--depth:${depthOf(o)};` : ''
  }grid-column:${box.x} / span ${box.w};grid-row:${box.y} / span ${box.h}`;
  const sel = S.sel.includes(o.id) ? ' selected' : '';

  /* ---- a spawner is a spiral -------------------------------------------
     One cell square is its natural size, and at that size the spiral *is* the
     tile — a press, drawn as the thing a press makes. It sits above the 1×1
     branch deliberately: a spawner shrunk to a stamp is still the press it has
     always been, and the anonymous mini tile would have taken that away.

     Made **bigger** it grows the box you type into, and what you type is the
     name of the thing it presses out. That is the whole of what the Text field
     type was, which is why there is no longer a Text field type: pressing and
     typing are two sizes of one machine, not two machines. The spiral keeps
     the press, so both are still reachable on one tile. See decision 135. */
  if(has(o,'spawn') && spawnByOf(o)==='click'){
    /* `random` is not a kind, so the mark and the label come off the spawner
       itself rather than off K() — which answers `note` for anything it does
       not know and would draw a machine for making notes. */
    const any=makesAnything(o);
    const big = box.w>1 || box.h>1;
    const made = genSaid(o);
    /* One cell square, the spiral **is** the tile: no ground, no edge, no
       shadow, drawn in the object's own colour and filling the cell. A
       coloured square with a small mark on it is a button carrying a picture
       of a button, which is one thing too many at 40px — the same argument the
       mini tile makes one branch below. So no `paper()` either: a stock is
       what a sheet is made of, and there is no sheet here.

       Bigger, it is a **pill**: the press at the head and the line you type
       into filling the rest, which is the shape a thing you press and a thing
       you type into share. */
    return `<${big?'div':'button'} class="drawer ${
        big?`otile ${paper(o)} genbig`:'gensolo bd-none'} sh-press gentile${
        any?' genany':''}${sel}" data-row="${o.id}"
        ${big?'role="button" tabindex="0"':''}
        title="${esc(o.title||('New '+made))}" style="--c:${colour};${place}">
      ${chips}
      <span class="genico">${ic(any?'sparkle':'spiral', big?22:26)}</span>
      ${big?`<input class="fieldin" data-fieldfor="${o.id}"
          placeholder="${esc(o.title||('New '+made+'…'))}">`:''}
      ${handles}
    </${big?'div':'button'}>`;
  }

  /* One cell square: the mark, and nothing else. Every shape below this line
     assumes there is room for a name, and at 40px there isn't — a drawer front
     shrunk to a stamp printed "Untit…" across its own knob. A mini tile keeps
     the thing's colour and its type's mark, which is enough to recognise it,
     and the title is the tooltip. It is still a drawer or still an object, so
     the front styling and the drop target come along unchanged. */
  /* …with two exceptions, both for the same reason the spawner sits above this
     line: a **control** at one cell is a push button, which is already a mark
     and already says its own state, and an anonymous disc would take the state
     away. See ctlSwitch(). */
  if(box.w<=1 && box.h<=1 && !has(o,'control')){
    /* A calendar at one cell is still a calendar: the tear-off day pad — the
       month small, today big — not an anonymous mark. See decision 80. */
    if(cont && faceOf(o)==='calendar'){
      return `<button class="drawer dtile caltile calpad1${sel}${calBorder(o,true)}"
        data-drawer="${o.id}" title="${esc(o.title||'Untitled')}"
        style="--c:${colour};--crows:1;${place}">
        ${calPad(o)}
        ${handles}
      </button>`;
    }
    const mark = cont && has(o,'magic') ? 'sparkle' : iconOf(o);
    return `<button class="drawer ${cont?`dtile ${dress(o,'bd')}`:`otile ${paper(o)}`} minitile${sel}${
        ''}"
      ${cont?`data-drawer="${o.id}"`:`data-row="${o.id}"`} title="${esc(o.title||'Untitled')}"
      style="--c:${colour};${place}">
      <span class="minimark">${ic(mark,17)}</span>
      ${has(o,'check')&&o.done?`<span class="minidone">${ic('check',11)}</span>`:''}
      ${handles}
    </button>`;
  }

  /* A control is a switch for one of the desk's own settings, standing on the
     board like a light switch on a wall. Two shapes, and the table decides
     which: a **dial** walks a list and prints where it is, a **switch** is on
     or off and is drawn as a switch rather than printed — the state has to be
     readable across the desk, and "Shadows: On" is a label where a lever is a
     glance. Its own name if it has one, the setting's if it has not, which is
     what makes one usable the moment it lands. See decision 132. */
  if(has(o,'control')){
    const spec=ctlSpec(o), form=ctlForm(o), on=ctlIsOn(o);
    const num=ctlNum(o);
    /* The pointer's angle. 270° of sweep, from seven o'clock round to five —
       a full circle has no stop, and a pointer that can sit at twelve meaning
       both nothing and everything is a dial you cannot read. */
    const ang = num ? (num.pct*270 - 135) : 0;
    /* A **button** changes colour as it walks: the face is the aesthetic's own
       eleven, stepped by where the list is, so pressing it is visibly a
       different indicator rather than the same square with different words.
       The other two keep the object's colour, because a lever and a dial say
       where they are by their own position. */
    const face = form==='button' ? hexOf(OBJ0 + (ctlIndex(o) % OBJN)) : colour;
    return `<button class="drawer otile sh-switch ctltile ctl-${form} csw-${
        switchShape(box)}${on?' on':''}${sel}" data-row="${o.id}" data-ctl="${esc(ctlOf(o))}"
        title="${esc(spec.ds||'')}" style="--c:${face};${
        num?`--dial:${ang.toFixed(1)}deg;`:''}${place}">
      ${chips}
      <span class="cico">${ic(o.ic || spec.ic, 18)}</span>
      <span class="clabel">${esc(o.title||spec.nm)}</span>
      ${form==='switch'
        ? ctlSwitch(box, on)
        : form==='dial'
        ? `<span class="cdialwrap" aria-hidden="true"><i class="cdial"></i></span>
           <span class="cval">${esc(ctlSaid(o))}</span>`
        : `<span class="cval">${esc(ctlSaid(o))}</span>`}
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
    /* **A book wider than it is tall is lying down**, and that is the same test
       a cabinet answers from the other side (decision 54): which way round it
       is, never how big. A 4×1 or a 3×1 asked to be a spine is a book laid
       flat on the desk seen from above — the round back along the bottom, the
       bands across the ends, the title running left to right. One class, and
       the whole grammar turns ninety degrees in CSS; the markup is the same
       three elements, because a lying book is not a different thing. The
       one-cell-wide fallback above cannot reach this: a 1×n is never wider
       than it is tall. See decision 124. */
    const lying = box.w > box.h;
    /* How it is bound is a property, the way a border or a knob is — five
       answers, all of them CSS off one class. The three elements below are
       what every binding has to work with: a head band, the title, and a tail
       band; a binding that doesn't want a band hides it rather than the tile
       rendering something different. See decision 87. */
    return `<button class="drawer dtile spinetile${lying?' lying':''} ${dress(o,'bn')} ${
        borderOf(o)==='gilt' ? dress(o,'bd') : 'bd-none'}${sel}" data-drawer="${o.id}"
      style="--c:${colour};${place}">
      <span class="spinetop"></span>
      <span class="spinetitle"><b>${esc(o.title||'Untitled')}</b></span>
      ${/* A spine has no width for a chip, so what it totals is set at the foot
           the way a volume number is on a real one. */''}
      <span class="spinefoot">${rollup(o)?`<u class="spineroll">${esc(rollup(o))}</u>`:''}</span>
      ${handles}
    </button>`;
  }

  /* A checklist is a container that wears its contents on the outside: you can
     see, tick, add to and take from it without opening it. That is the whole
     difference between it and a drawer.

     The face is a **stack of task-sized lines**: one line per cell of height,
     counted out by `--clrows` from the box being drawn, so a checklist three
     cells tall shows three tasks the way three task tiles would. Each line is
     drawn the way the task tile is — paper and ink, the same 38px box, the
     same name type — and what says the stack is one thing rather than three
     loose tasks is the magic drawer's gilt frame, worn here because a face
     that refills itself has earned it. Done lines don't print: the front is
     the next few things to do, not a record, so ticking one refills the face
     from the drawer below it — the lines under the gap move up a row and the
     next thing inside steps onto the bottom (clRefill() in motion.js draws
     that shuffle, after the render). The name rides on the tooltip and inside
     the drawer; a front spending a line on a label is a front showing one
     less task. See decision 79.

     It is a <div> rather than a <button> when it takes typing, because an input
     inside a button is invalid and unfocusable — the same reason the text field
     tile is a div. Clicking it still opens it: wire.js goes by [data-drawer]
     and the .drawer class, not by the tag. */
  if(cont && faceOf(o)==='checklist'){
    const items=childrenOf(o);
    /* Whether the *box* is drawn, which is not the same question as whether the
       container takes typing: it is opt-in now — every line of this front is a
       task you could have seen — and off regardless when the front is too short
       to spare a line for it. See decisions 77 and 79. */
    const adds=showsAddBox(o, box);
    const made=genSaid(o);
    /* Two lines to a cell of height unless the desk says otherwise. `--clrows`
       is the divisor every line's flex-basis is calculated from, so the count
       and the row height cannot disagree — and `.dense` is what shrinks the
       type and the box to suit. See decision 140. */
    const per=clPerCell();
    const rows=Math.max(1, (box.h|0) * per);
    const shown=items.filter(x=>!x.done).slice(0, Math.max(1, rows-(adds?1:0)));
    /* With nothing to show the front is a label again: a stack of zero lines
       is an anonymous coloured square — and so is the picker's sample. */
    if(!shown.length && !adds){
      return `<button class="drawer dtile cltile clidle ${dressAs('bd','gilt')}${sel}" data-drawer="${o.id}"
          style="--c:${colour};${place}">
        <div class="dtop">${nameField(o)}</div>
        <div class="dbody"><span class="clempty">${items.length?'All done':'Nothing yet — open it to add'}</span></div>
        ${handles}
      </button>`;
    }
    return `<${adds?'div':'button'} class="drawer dtile cltile${per>1?' cldense':''} ${dressAs('bd','gilt')}${sel}" data-drawer="${o.id}"
        ${adds?'role="button" tabindex="0"':''} title="${esc(o.title||'Untitled')}"
        style="--c:${colour};--clrows:${rows};${place}">
      ${/* The **box** ticks it and the **words** change it. Tapping anywhere on
            the line used to tick it, which left no way to fix a typo without
            opening the drawer — and a checklist you cannot correct in place is
            a checklist you stop trusting. Holding it still plucks it out. */''}
      <div class="dbody"><div class="clist">
        ${adds?`<label class="cladd">${ic('plus',11)}
          <input data-contadd="${o.id}" placeholder="Add a ${esc(made)}…"></label>`:''}
        ${shown.map(x=>
        `<span class="cline" data-pluck="${x.id}"
           title="${esc(x.title||'Untitled')} — hold to take it out">
           <i class="clbox" data-check="${x.id}"></i>${
           nameField(x, 'cltext')}</span>`).join('')
        || `<span class="clempty">Nothing yet — type above</span>`}</div></div>
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
    const late = st.pct<100 && isLate(o);
    const cov = projCoverOf(o);
    /* A record has no card behind it (see `.pcov-song` in chrome.css), so it
       takes no edge either — `bd-none` rather than the object's own slot,
       because a border round a disc is the sleeve this cover just lost. */
    const disc = (cov==='song'||cov==='album') && !st.cover;
    return `<${takesTyping(o)?'div':'button'} class="drawer dtile projtile pcov-${cov}${
        cov!=='plain'?' hascover':''}${st.cover?' haspic':''}${disc?' bare':''} ${
        disc?'bd-none':dress(o,'bd')}${sel}"
        data-drawer="${o.id}" ${takesTyping(o)?'role="button" tabindex="0"':''}
        style="--c:${colour};--pct:${st.pct}%;${place}">
      ${projCover(o, cov, st)}
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        ${rollTag(o)}
        ${lateOn(o)?`<span class="projdue${late?' late':''}">${esc(deadSaid(o)||dateSaid(o))}</span>`:''}</div>
      ${/* **No bar.** A project's percentage was a bar and a number on every
           face, and it is neither the question you ask a project across the
           desk nor an honest answer to it — half the ticks under a project are
           in checklists that mean nothing on their own. What it is made of and
           what is next are what the face says now. The walk still computes the
           number: `projectStat()` feeds the knob-ring on a project's drawer
           front, and `barPct()` still reads it. */''}
      <div class="projline">
        ${st.ticks?`<span>${st.done}/${st.ticks} done</span>`:`<span>${st.n||'Nothing'} inside</span>`}
        ${st.next?`<span class="projnext">next ${esc(D.short(st.next))}</span>`:''}
      </div>
      <div class="projkinds">${st.kinds.slice(0,6).map(([k,n])=>
        `<span class="projkind" style="--k:${hexOf(K(k).c)}" title="${esc(K(k).nm)}">
          ${ic(K(k).ic,11)}<u>${n}</u></span>`).join('')
        || '<span class="clempty">Open it and start filling it</span>'}</div>
      <div class="projsoon">${st.soon.slice(0,3).map(x=>
        `<span class="projitem${isLate(x)?' late':''}" data-row="${x.id}"
           title="${esc(x.title||'Untitled')}">
          <i style="--k:${objColour(x)}">${ic(K(x.kind).ic,10)}</i>
          <b>${esc(x.title||'Untitled')}</b><u>${esc(D.short(x.due))}</u></span>`).join('')}</div>
      ${showsAddBox(o, box)?`<label class="cladd">${ic('plus',11)}
        <input data-contadd="${o.id}" placeholder="Add a ${esc(genSaid(o))}…"></label>`:''}
      ${handles}
    </${takesTyping(o)?'div':'button'}>`;
  }

  /* A **life drawer** reports like a project with the one thing taken off that
     would be a lie. A project has an end and a percentage is the answer to
     "where is this up to"; an area of your life has neither, and a bar reading
     62% against Health is worse than no bar at all — it invites you to finish
     something that does not finish.

     So: what it is made of, what is next, and how much is outstanding. Read
     off the same single walk `projectStat()` already does, and drawn with the
     project's own classes plus `.lifetile`, which is what takes the bar's row
     out — two faces that report the same walk should not be two blocks of
     markup that drift. See decision 131. */
  if(cont && faceOf(o)==='life'){
    const st=projectStat(o), left=st.ticks-st.done;
    /* A life drawer wears an **object**: a stack of coins, a suitcase, a
       dumbbell, lying on the desk with its name on a label under it. That is
       what makes one recognisable across a board, which a coloured rectangle
       reading "Health" never was. A picture you put on it wins over the
       drawing, because that is where this is meant to end up.

       With neither, it falls back to the report below — the same walk of what
       it holds a project makes, minus the percentage that would be a lie about
       an area of your life. See decision 136. */
    const art = lifeArtOf(o), pic = o.media && o.media.src;
    if(art || pic){
      return `<button class="drawer dtile lifething${sel}" data-drawer="${o.id}"
          title="${esc(o.title||'Untitled')}" style="--c:${colour};${place}">
        <span class="lifepic">${pic
          ? `<img src="${esc(pic)}" alt="" draggable="false">`
          : lifeSVG(art)}</span>
        <span class="lifelabel">${esc(o.title||'Untitled')}</span>
        ${left?`<span class="lifeleft" title="${left} outstanding">${left}</span>`:''}
        ${handles}
      </button>`;
    }
    return `<${takesTyping(o)?'div':'button'} class="drawer dtile projtile lifetile ${dress(o,'bd')}${sel}"
        data-drawer="${o.id}" ${takesTyping(o)?'role="button" tabindex="0"':''}
        style="--c:${colour};${place}">
      ${st.cover?`<span class="projcover" style="background-image:url('${esc(st.cover)}')"></span>`:''}
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>${rollTag(o)}</div>
      <div class="projline">
        ${left?`<span>${left} outstanding</span>`:`<span>${st.n||'Nothing'} inside</span>`}
        ${st.next?`<span class="projnext">next ${esc(D.short(st.next))}</span>`:''}
      </div>
      <div class="projkinds">${st.kinds.slice(0,6).map(([k,n])=>
        `<span class="projkind" style="--k:${hexOf(K(k).c)}" title="${esc(K(k).nm)}">
          ${ic(K(k).ic,11)}<u>${n}</u></span>`).join('')
        || '<span class="clempty">Open it and start filling it</span>'}</div>
      <div class="projsoon">${st.soon.slice(0,3).map(x=>
        `<span class="projitem${isLate(x)?' late':''}" data-row="${x.id}"
           title="${esc(x.title||'Untitled')}">
          <i style="--k:${objColour(x)}">${ic(K(x.kind).ic,10)}</i>
          <b>${esc(x.title||'Untitled')}</b><u>${esc(D.short(x.due))}</u></span>`).join('')}</div>
      ${showsAddBox(o, box)?`<label class="cladd">${ic('plus',11)}
        <input data-contadd="${o.id}" placeholder="Add a ${esc(genSaid(o))}…"></label>`:''}
      ${handles}
    </${takesTyping(o)?'div':'button'}>`;
  }

  /* A trip is a ticket: a stub torn off down the right, and where to. */
  if(cont && shapeOf(o)==='ticket'){
    return `<button class="drawer dtile triptile ${dress(o,'bd')}${sel}" data-drawer="${o.id}" style="--c:${colour};${place}">
      <div class="tkmain">
        <span class="tklabel">${o.due?esc(dateSaid(o)):'Some day'}${rollTag(o)}</span>
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
    return `<button class="drawer dtile tltile ${dress(o,'bd')}${sel}" data-drawer="${o.id}"
      data-tlspan="${o.id}:${sp.min}:${sp.max}" style="--c:${colour};${place}">
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        ${rollTag(o)}
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

  /* A **collage** shows the board inside it, small — every child at the box
     it actually occupies, not a separate wall of thumbnails packed three to a
     row. The difference matters: a moodboard is an *arrangement*, and a front
     that re-packs what you arranged is showing you a different picture from
     the one you made. It is a face rather than a type, so any container can
     wear it. See decision 134.

     A child that has never been placed has no box to draw at — it gets a
     synthetic one in flow order rather than being dropped, because a collage
     you have just filled by dictation should not look empty until you open
     it. Nothing is written: `ensureBox()` is a mutation and a face is not
     allowed one. */
  if(cont && faceOf(o)==='collage'){
    const dv=dev(), g=gridOf(undefined, o.id), kids=childrenOf(o).slice(0, COLLAGE_MAX);
    const per=Math.max(1, g.cols>>1);
    let rows=1, flow=0;
    const cells=kids.map(x=>{
      const own = x[dv] && x[dv].w ? x[dv] : null;
      const b = own || {x:(flow%per)*2+1, y:Math.floor(flow/per)*2+1, w:2, h:2};
      if(!own) flow++;
      rows = Math.max(rows, b.y+b.h-1);
      const img = x.media && x.media.src;
      return `<i class="${img?'mbpic':'mbthing'}" title="${esc(x.title||'')}"
        style="grid-column:${b.x}/span ${b.w};grid-row:${b.y}/span ${b.h};${
        img?`background-image:url('${esc(img)}')`:`--k:${objColour(x)}`}"></i>`;
    });
    return `<button class="drawer dtile mbtile ${dress(o,'bd')}${sel}" data-drawer="${o.id}" style="--c:${colour};${place}">
      <div class="mbwall" style="--mbcols:${g.cols};--mbrows:${rows}">${cells.join('')
        || '<span class="clempty">Open it and arrange some pictures</span>'}</div>
      <span class="mbname">${esc(o.title||'Untitled')}${rollTag(o)}</span>
      ${handles}
    </button>`;
  }

  /* ---- a goal: a drawer with the knob taken off ------------------------
     The name *is* the face. "Lose 25 pounds" needs nothing printed beside it,
     so it is set as large as the frame allows and everything else is small
     and at the foot — and the knob comes off, because a goal is not a thing
     you pull open to rummage in, it is a thing you are walking towards.

     What it is called is read off the time on it rather than stored: no
     deadline and it is a **dream**, barely enough time and it is a
     **challenge**. See decision 135. */
  if(cont && faceOf(o)==='goal'){
    const st=projectStat(o), pct=progressOf(o), stand=goalStanding(o);
    const late = pct<100 && isLate(o);
    /* **A playing card.** A goal is the one thing on this desk that is not
       furniture and not paper: it is a thing you are holding, and a card is
       what a held thing looks like. Everything a Bicycle card has and nothing
       it hasn't — a heavy corner radius, a white face, the linen tooth, a
       ruled panel inset from the edge, and an **index in two opposite
       corners**, the second one turned round, which is the detail that makes a
       rectangle read as a card rather than as a rounded tile.

       The index is the standing (`Goal`, `Challenge`, `Dream`) over the mark;
       the middle is the name, because the name is still the face. The count
       is the pip line at the foot, and the run is the hairline it always was.
       See decision 146. */
    const mark = ic(iconOf(o), 13);
    const idx = `<span class="cardidx"><u>${esc(GOAL_STANDINGS[stand][0])}</u>${mark}</span>`;
    return `<${takesTyping(o)?'div':'button'} class="drawer dtile goaltile playcard stand-${stand} bd-none${sel}"
        data-drawer="${o.id}" ${takesTyping(o)?'role="button" tabindex="0"':''}
        title="${esc(o.title||'Untitled')}" style="--c:${colour};--pct:${pct}%;${place}">
      <i class="cardrule" aria-hidden="true"></i>
      ${idx}${idx.replace('cardidx','cardidx flip')}
      <span class="goalstand">${esc(GOAL_STANDINGS[stand])}</span>
      <span class="goalname">${esc(o.title||'Untitled')}</span>
      <span class="goalfoot">
        ${lateOn(o)?`<u class="${late?'late':''}">${esc(deadSaid(o)||dateSaid(o))}</u>`:''}
        ${st.ticks?`<b>${st.done}/${st.ticks}</b>`:''}</span>
      <i class="goalbar" aria-hidden="true"></i>
      ${handles}
    </${takesTyping(o)?'div':'button'}>`;
  }

  /* A calendar is a container drawing what it collects on the day each thing
     falls. It is usually a magic drawer, so the sparkle belongs on it like any
     other — the days are what it shows, collecting is how it filled them.

     The face is adaptive (decision 80). Below the month it is a desk calendar
     — the day pad, then as much of the agenda as the box affords — because a
     month squeezed under three cells a side is marks nobody can read. The
     month is earned at three cells a side, with calview still deciding what
     it spans, and a big face earns words in its cells: the planner prints
     titles the way a wall calendar does. Below the month the name rides on
     the tooltip, the same as the checklist's. */
  if(cont && faceOf(o)==='calendar'){
    // one cell tall: the pad, and the next thing or two beside it
    if(box.h<=1){
      const soon=calSoon(o, box.w>=3?2:1);
      return `<button class="drawer dtile caltile calstrip${sel}${calBorder(o,true)}"
          data-drawer="${o.id}" title="${esc(o.title||'Untitled')}" style="--c:${colour};--crows:1;${place}">
        ${calPad(o)}
        <span class="calnext">${soon.map(calRow).join('') || '<span class="calquiet">Nothing coming up</span>'}</span>
        ${handles}
      </button>`;
    }
    // two wide or two tall: the pad on top, the agenda under it. The count is
    // what whole rows fit under the pad — a half row is worse than a blank.
    if(box.w<3 || box.h<3){
      const soon=calSoon(o, Math.max(1, Math.floor((box.h-1)*2.2)));
      return `<button class="drawer dtile caltile calagenda${sel}${calBorder(o,true)}"
          data-drawer="${o.id}" title="${esc(o.title||'Untitled')}" style="--c:${colour};--crows:${box.h};${place}">
        <div class="calagtop">${calPad(o)}
          <span class="calagcap">${esc(D.today().toLocaleDateString(undefined,{weekday:'long'}))}</span></div>
        <div class="calnext">${soon.map(calRow).join('') || '<span class="calquiet">Nothing coming up</span>'}</div>
        ${handles}
      </button>`;
    }
    /* Words need a day cell about 90px wide: twelve desk cells across seven
       days. A phone board is at most ten columns, so the planner is a desk
       face by arithmetic rather than by rule. */
    const planner = box.w>=12 && box.h>=6;
    const at=D.parse(o.month||T)||D.today(), view=calViewOf(o);
    const cap = view==='day' ? at.toLocaleDateString(undefined,{weekday:'long',day:'numeric'})
      : at.toLocaleDateString(undefined, view==='week'?{month:'short',day:'numeric'}:{month:'long'});
    return `<button class="drawer dtile caltile${sel}${calBorder(o, box.w<=3 && box.h<=3)}"
      data-drawer="${o.id}" style="--c:${colour};${place}">
      <div class="dtop"><span class="dname">${esc(o.title||'Untitled')}</span>
        ${rollTag(o)}
        <span class="clcount">${esc(cap)}</span></div>
      <div class="dbody">${calFace(o, planner)}</div>
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
    const doors = openingFor(o, box)==='cabinet';
    /* **A project is a drawer whose knob is the dial.** The default look for a
       piece of work is the front it is filed behind, and how far along it is
       reads off the one thing every drawer already has — a turned knob with a
       ring burnt round it. It says the same number the face used to print
       twice, in the place your eye already goes, and it costs no row.

       `ringFor()` answers null for anything that is not reporting, and a null
       ring draws exactly the knob that has always been drawn. */
    const ring = ringFor(o);
    /* A knob is turned out of the same wood as the front, so unless it has been
       told otherwise it *is* the front's colour — what makes it a knob is the
       light on it, not a lighter shade painted where it sits. Lighter and
       darker are still a choice, and so is a colour outright; the shading is in
       the stylesheet, on `--knob`, so all three get it. */
    const knob = o.knobc ? esc(o.knobc)
      : o.knobtone==='dark' ? `color-mix(in srgb, ${colour} 78%, #000)`
      : o.knobtone==='light' ? `color-mix(in srgb, ${colour} 74%, #fff)`
      : colour;
    /* Four slot families on one tile, each stamped with its position *and* the
       aesthetic that dresses it — a bare value names the desk's, a pinned one
       names the aesthetic it was borrowed from. The stylesheet keys on those
       scope classes rather than on `html[data-style]`, which is what lets a
       Victorian front wear a 1997 group box. See decision 98. */
    return `<button class="drawer dtile ${dress(o,'bd')} ${dress(o,'tx')} ks-${
        knobSizeOf(o)} knb-${o.knobpos||'centre'}${
        doors?' cabinet':''} ${dress(o,'pn')}${sel}" data-drawer="${o.id}"
      style="--c:${colour};--knob:${knob};${place}">
      ${chips}
      ${/* The wood the front is cut from. Both pseudo-elements are spoken for
           on a drawer tile — the magic frame is `::before` and the texture is
           `::after` — so the moulding is a real element, which gives it two of
           its own. It sits under the texture on purpose: grain is printed on
           shaped wood, not the other way round. */''}
      <i class="dpanel"></i>
      ${/* The seam is the tile's, not the knob strip's: two doors meet down the
           whole front and the gap between them runs past the border at both
           ends, the way it does on a real one. */''}
      ${doors?`<i class="dseam"></i>`:''}
      <span class="dmark">${ic(has(o,'magic')?'sparkle':iconOf(o),18)}</span>
      <div class="dtop">${nameField(o)}
        ${has(o,'magic')?`<span class="magicmark" title="Collects by rule">${ic('sparkle',11)}</span>`:''}
        ${rollup(o)?`<span class="rollup">${esc(rollup(o))}</span>`:''}</div>
      <div class="dfoot${doors?' doors':''}">${knobHTML(o, ring)}${
        doors?knobHTML(o, ring):''}</div>
      ${handles}
    </button>`;
  }

  /* ---- a decoration ------------------------------------------------------
     No tile at all: no paper, no border, no shadow, no name — the artwork and
     nothing else, standing on the floor of its box the way an ornament stands
     on a shelf. It is the one thing on the board drawn *above* the tiles, and
     the one thing that may overlap them; both of those are what make it read
     as an object on the desk rather than a card in the grid.

     A built-in is inlined so it can take the style's own colours; a file you
     chose is an <img>, because a picture somebody picked has no business
     being repainted. See decision 86. */
  if(isDecor(o)){
    const own = o.media && o.media.src;
    return `<button class="drawer otile dectile${sel}" data-row="${o.id}"
      title="${esc(o.title||DECOR[decorOf(o)]?.nm||'Decoration')}"
      style="--c:${colour};${place}">
      ${own
        ? `<img class="decart" src="${esc(own)}" alt="${esc(o.title||'')}" draggable="false">`
        : decorSVG(decorOf(o))}
      ${handles}
    </button>`;
  }

  /* An image sits on the grid like something stuck in a scrapbook. `isPicture`
     rather than "carries media", or a sound with a file in it matched here and
     was drawn as a photograph of nothing — which is the same mistake decision 49
     fixed at the *tap* and this branch was still making at the tile. */
  const img = isPicture(o) && o.media && o.media.src;
  if(img){
    /* A window's bars are drawn *over* the view rather than around it, so they
       are their own element — the tile's two pseudo-elements are spoken for
       (decision 99) and a muntin has to sit above the image, which nothing a
       picture frame does ever has to. `winview` is what puts the view behind
       the glass and lets it move; the bars never do. See decision 113. */
    const fr=frameOf(o), win=isWindow(o);
    return `<button class="drawer otile ${paper(o)} imgtile sh-image${o.media.alpha?'':' opaque'} fr-${fr}${win?' winview':''}${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <img class="tileimg" src="${esc(o.media.src)}" alt="${esc(o.title||'')}" draggable="false">
      ${win?'<i class="wbars"></i>':''}
      ${handles}
    </button>`;
  }
  /* ---- a sound, and a moving picture ------------------------------------
     **A sound is a record with a play button in the middle of it**, and a
     video is the video, filling whatever box it is in. Pressing either starts
     it and pressing again stops it — see `playPress()`, which is where the
     one-at-a-time rule and the cost of keeping an element around both live.

     This is a deliberate reversal of decision 71's "never a player on the
     board". That rule was written to stop forty decoded media elements
     appearing on one desk, and it still holds where it matters: a **sound**
     draws no element at all until it is pressed, so a board of a hundred of
     them costs a hundred discs and nothing else. A **video** has to show a
     frame to be a video, so it does carry an element, at `preload="metadata"`
     — which fetches the header and the first frame rather than the file. The
     honest cost of that is that a re-render stops it, the same way a re-render
     ends an inline edit. See decision 144.

     `.sounding` is toggled on the tile by hand rather than by re-rendering,
     because the whole point of keeping the audio element outside the DOM is
     that playing music must not be at the mercy of an unrelated render. */
  if(isPlayable(o)){
    const kind=mediaTypeOf(o);
    const on = isSounding(o.id);
    const src = (o.media && o.media.src) || '';
    if(kind==='video'){
      /* **A video wears no button at all.** It had a play mark in the middle of
         it, hidden only while it ran — so a board of videos was a board of
         screenshots-of-a-player, and the one frame you most wanted to see was
         the one with a disc over it. The whole tile is the control: press it to
         start, press it again to stop, which is what pressing a thing on this
         desk means everywhere else. Nothing to hide, nothing to glitch, and
         nothing between you and the picture.

         **And it shows a frame rather than a black rectangle.** `preload` at
         `metadata` fetches the header, which is enough to know the size and
         nothing else — so until it had been played once a video was a black
         box with a play mark on it. `#t=0.1` asks for a tenth of a second in,
         which makes the browser decode and paint that frame; `wire.js` seeks
         once more on `loadedmetadata` for the players that ignore the fragment.
         Two goes at the same small thing, because a video that looks broken
         until you press it is a video you do not press. */
      return `<div class="drawer otile vidtile bd-none${on?' sounding':''}${sel}"
          data-row="${o.id}" role="button" tabindex="0"
          title="${esc(o.title||'Untitled')} — press to play" style="--c:${colour};${place}">
        ${chips}
        ${src?`<video class="tilevid" src="${esc(src)}#t=0.1" preload="metadata"
          playsinline tabindex="-1"></video>`
        :`<span class="vidempty">${ic('film',22)}<b>${esc(o.title||'Add a video')}</b></span>
          <span class="medbtn blank" aria-hidden="true">${ic('plus',20)}</span>`}
        ${handles}
      </div>`;
    }
    return `<button class="drawer otile sndtile bd-none${on?' sounding':''}${sel}"
        data-row="${o.id}"
        title="${esc(o.title||'Untitled')} — press to play" style="--c:${colour};${place}">
      ${chips}
      <span class="projdisc snddisc${src?'':' blank'}">${discHTML(o)}</span>
      <span class="medbtn${src?'':' blank'}">${ic(src?(on?'pause':'play'):'plus',20)}</span>
      ${handles}
    </button>`;
  }

  /* …and a picture with nothing in it yet is an empty mount, not a card with a
     title and a blank body. It said "Untitled" and did nothing, which is how a
     new Image object came to look broken rather than unfilled. Tapping it opens
     the picture surface, which is where a file is chosen. */
  if(isMedia(o) && !has(o,'text')){
    const kind=mediaTypeOf(o);
    const mark=kind==='audio'?'music':kind==='video'?'film':'image';
    const say =kind==='audio'?'Add a sound':kind==='video'?'Add a video':'Add a picture';
    return `<button class="drawer otile ${paper(o)} imgtile empty fr-${frameOf(o)}${isWindow(o)?' winview':''}${sel}" data-row="${o.id}"
      title="${esc(o.title||'')} — tap to choose a file" style="--c:${colour};${place}">
      ${chips}
      <span class="imgempty">${ic(mark,24)}<b>${esc(o.title||say)}</b></span>
      ${isWindow(o)?'<i class="wbars"></i>':''}
      ${handles}
    </button>`;
  }
  // a button object is the button: it fills its tile rather than sitting in it
  if(has(o,'button')){
    return `<button class="drawer otile ${paper(o)} sh-button btntile bs-${o.btnshape||'rounded'}${sel}" data-row="${o.id}"
      style="--c:${colour};${place}">
      ${chips}
      <span class="btnface" data-fire="${o.id}">${esc((o.link&&o.link.label)||o.title||'Open')}</span>
      ${handles}
    </button>`;
  }

  /* ---- a progress bar is a row of blocks -------------------------------
     Not a fill. A continuous bar can read 63% and mean nothing you can point
     at; ten blocks with six lit says six of ten, which is what you actually
     know about a thing you are counting. Each block is a **whole cell tall and
     half a cell wide**, so a ten-step bar is five cells long without anybody
     being told — and made narrower than that it wraps into a second row rather
     than shrinking its blocks to slivers.

     Pressing a block sets the bar to it, and pressing the one it is already on
     steps back — which is the only way a readout that owns its own number can
     be moved from the board. A bar that is *tracking* something else is a
     readout of that thing and refuses the press: what happened somewhere else
     is not the bar's to change. See decision 138. */
  if(shapeOf(o)==='bar'){
    const g=barGrid(o, box), lit=barFilled(o);
    const own = !o.tracks && !(o.milestones||[]).length;
    return `<div class="drawer otile ${paper(o)} sh-bar bartile${own?' ownbar':''}${sel}"
        data-row="${o.id}" role="button" tabindex="0"
        title="${esc(o.title||'Untitled')} — ${lit} of ${g.n}"
        style="--c:${colour};--barcols:${g.cols};--barrows:${g.rows};${place}">
      ${chips}
      <div class="dtop">${nameField(o)}<span class="barcount">${lit}/${g.n}</span></div>
      <div class="barblocks">${Array.from({length:g.n}, (_,i)=>
        `<i class="barblock${i<lit?' on':''}"${own?` data-barset="${o.id}:${i+1}"`:''}></i>`).join('')}</div>
      ${handles}
    </div>`;
  }

  /* A counter is its number, not a title and a body. */
  if(shapeOf(o)==='tally'){
    return `<button class="drawer otile ${paper(o)} sh-tally cnttile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <span class="cntlabel">${esc(o.title||'Untitled')}</span>
      <span class="cntnum" data-act="countup" data-id="${o.id}">${digitWheel(o.count||0)}</span>
      ${handles}
    </button>`;
  }
  /* A non-container that takes dictation rather than a press — the old Text
     field's setting, kept because a type you invent may still want it. */
  if(has(o,'spawn') && spawnByOf(o)==='type'){
    return `<div class="drawer otile ${paper(o)} sh-band fieldtile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <input class="fieldin" data-fieldfor="${o.id}" placeholder="${esc(o.title||'Type and press return…')}">
      ${handles}
    </div>`;
  }
  if(shapeOf(o)==='spine'){
    /* The `<b>` is the measuring frame, the same as on a container's spine —
       the vertical writing mode lives on it, so a spine without one prints its
       title across the book. A binding is a container's, so this one wears no
       `bn-` class and keeps the head and tail bands it has always had. */
    return `<button class="drawer otile ${paper(o)} sh-spine spinetile${sel}"
      data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <span class="spinetop"></span>
      <span class="spinetitle"><b>${esc(o.title||'Untitled')}</b></span>
      <span class="spinefoot"></span>
      ${handles}
    </button>`;
  }
  if(shapeOf(o)==='quote'){
    return `<button class="drawer otile ${paper(o)} sh-quote quotetile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <span class="qmark">"</span>
      <span class="qbody">${esc(oneline(o.body||o.title||'').replace(/^[—\s]+/,'')).slice(0,180)}</span>
      ${has(o,'rating')&&o.rating?`<span class="tilestars">${'★'.repeat(o.rating)}</span>`:''}
      ${handles}
    </button>`;
  }
  if(shapeOf(o)==='portrait'){
    const img=o.media&&o.media.src;
    return `<button class="drawer otile ${paper(o)} sh-portrait chartile${sel}" data-row="${o.id}" style="--c:${colour};${place}">
      ${chips}
      <span class="charface">${img?`<img src="${esc(img)}" alt="">`:ic('star',22)}</span>
      <span class="charname">${esc(o.title||'Untitled')}</span>
      ${handles}
    </button>`;
  }

  const bits=[];
  /* A deadline is said on the face, because the whole point of separating it
     from the day a thing sits on is that you can see both. It is only printed
     when it is set — an object that carries the trait and hasn't used it has
     nothing to say. */
  /* Urgency is drawn *on* the deadline rather than beside it: it is a fact
     about that date and an estimate, not a fourth thing to read. A stripe down
     the left is what priority means and urgency must never borrow it. */
  const urg = urgencyOf(o);
  if(deadSaid(o)) bits.push(`<span class="deadchip${urg?' u'+urg.rank:''}${
    !(has(o,'deadline')&&o.dead)?' soft':''}${isLate(o)?' late':''}"${
    urg?` title="${esc(urgeSaid(o))}"`:''}>${esc(deadSaid(o))}</span>`);
  if(has(o,'streak')) bits.push(`${streak(o)}-day streak`);
  if(has(o,'progress')) bits.push(`${barPct(o)}%`);
  if(has(o,'count')) bits.push(`${o.count||0}`);
  if(has(o,'duration')&&o.dur) bits.push(durSaid(o.dur));
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
  return `<${raw?'div':'button'} class="drawer otile ${paper(o)} sh-${shapeOf(o)}${o.edge?' edge':''}${sel}${
      edit?' editing':''}${
      asks?(answered(o)?' answered':' unanswered'):''}${prioOf(o)!=null?' prio-'+prioOf(o):''}" data-row="${o.id}"
    style="--c:${colour};${has(o,'progress')?`--pct:${barPct(o)}%;`:''}${place}">
    ${chips}
    <div class="dtop">
      ${has(o,'check')?`<span class="check tilecheck${o.done?' on':''}" data-check="${o.id}">${ic('check',12)}</span>`:''}
      ${nameField(o)}
      ${/* A copy a rule made, not a thing you wrote down — Things 3.23 puts the
           same small glyph on generated to-dos, and it is the difference between
           "I decided this" and "this comes round". See decision 73. */''}
      ${o.fromRepeat?`<span class="repeatmark" title="${esc(repeatSaid(o)||'made by a repeat')}">${ic('repeat',10)}</span>`:''}
      ${/* A file with something written in the margin looks different from one
           without, before you open it. The count and not the words: a margin
           entry is a sentence and a tile has no room for one. */''}
      ${marginOf(o).length?`<span class="margmark" title="${marginOf(o).length} in the margin">${marginOf(o).length}</span>`:''}
    </div>
    ${has(o,'rating')&&o.rating?`<div class="tilestars">${'★'.repeat(o.rating)}<span>${'★'.repeat(5-o.rating)}</span></div>`:''}
    ${edit && has(o,'text')
      ? `<div class="dbody"><textarea class="inlinebody" data-inline="${o.id}:body"
           placeholder="Anything else…">${esc(o.body||'')}</textarea></div>`
      : has(o,'text')&&o.body?`<div class="dbody"><div class="tiletext">${esc(plain(o.body).slice(0,BODY_ON_FACE))}</div></div>`:'<div class="dbody"></div>'}
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
  const g=gridOf(undefined, cid), dv=dev(), taken=[];
  /* A packed board fills its shelves in order and respects the seam between
     them, or the sort would produce the straddling tiles the drag is not
     allowed to make. Shelf by shelf, reading order, which is what a sorted
     board *is*: the first thing in the top-left corner of the first shelf. */
  const free=(b)=> !taken.some(t=>overlaps(b,t));
  const shelves=[];
  for(let sy=0;sy<g.shelves.h;sy++) for(let sx=0;sx<g.shelves.w;sx++) shelves.push([sx,sy]);
  kids.forEach(o=>{
    let [w,h]=(o[dv]&&o[dv].w) ? [o[dv].w,o[dv].h] : sizeOfKind(o.kind, dv, cid);
    w=Math.min(w, g.shelfW); h=Math.min(h, g.shelfH);
    let put=null;
    for(const [sx,sy] of shelves){
      const x0=sx*g.shelfW, y0=sy*g.shelfH;
      for(let y=1;y<=g.shelfH-h+1 && !put;y++) for(let x=1;x<=g.shelfW-w+1;x++){
        const b={x:x0+x, y:y0+y, w, h}; if(free(b)){ put=b; break; }
      }
      if(put) break;
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
  const c=container(cid);
  /* You are always arranging, unless the one lock says otherwise — see
     decision 74. It used to be `c.locked`, per board.

     Three answers, not two, since decision 81: `true` is an unlocked board,
     `'locked'` is a locked one, and `false` is not a board at all — a sample
     in the type picker or the stage in an editor. A locked board still draws
     the corner grips of an object carrying `resizable`, and still draws the
     marks that say which objects the lock has let out; a sample draws
     neither, because it is a picture of a tile rather than a tile. */
  const arr = boardLocked() ? 'locked' : true;
  const sorted=sortOf(c);
  const dv=dev(), g=gridOf(dv, c.id);
  /* On a phone the board is **windowed** to one shelf; on a Mac the whole
     thing is drawn and the scroller reaches the rows you cannot see. So the
     shift is zero on a Mac and everything below reads the same either way. */
  const shift = dv==='phone' ? shelfOrigin(c.id, dv) : {x:0, y:0};
  let kids=childrenOf(c);
  FLOW.clear();
  /* An object with no box yet is left off this frame rather than drawn at the
     origin: `ensureBox()` refuses to place anything before the board has been
     measured, because a shelf is as tall as whatever fits on this screen. The
     frame in question is the first one at launch. See decision 141. */
  if(sorted) flowSorted(kids, c.id);          // a sort overrides hand placement
  else kids = kids.filter(o=>!!ensureBox(o, dv, c.id));
  if(dv==='phone'){
    /* A box from before this board had shelves — or from a phone whose shelves
       were a different height — can straddle a seam, and half a tile on each
       of two screens is a tile you can read neither half of. Re-place it, once:
       the same licence ensureBox() takes to place an object that has never been
       in a grid. boxOk() stops any *new* box from straddling. */
    if(!sorted) kids.forEach(o=>{
      const b=lay(o, dv, c.id);
      if(b.w<=g.shelfW && b.h<=g.shelfH
         && Math.floor((b.x-1)/g.shelfW)===Math.floor((b.x+b.w-2)/g.shelfW)
         && Math.floor((b.y-1)/g.shelfH)===Math.floor((b.y+b.h-2)/g.shelfH)) return;
      const keep={w:Math.min(b.w,g.shelfW), h:Math.min(b.h,g.shelfH)};
      o[dv]=null;
      o[dv]=anySpot(keep.w, keep.h, dv, c.id);
    });
    kids = kids.filter(o=>{ const b=FLOW.get(o.id)||lay(o, dv, c.id);
      return b.x>shift.x && b.x<=shift.x+g.shelfW && b.y>shift.y && b.y<=shift.y+g.shelfH; });
  }
  SHELFSHIFT.x = shift.x; SHELFSHIFT.y = shift.y;
  /* Where the middle of this board is, for the shelf's perspective — once,
     here, rather than once per tile. Off at zero depth, which is what keeps the
     numbers off every tile's style attribute when nothing is standing proud —
     and that is its own setting, not the tilt's: the perspective reads with the
     phone flat on a table. See decision 117. */
  PERSP.cols = standsProud() ? g.shelfW : 0;
  PERSP.rows = standsProud() ? g.shelfH : 0;
  const tiles=kids.map(o=>gridTile(o,arr,c.id)).join('');
  SHELFSHIFT.x = SHELFSHIFT.y = 0; PERSP.cols = PERSP.rows = 0;
  /* Exactly the shelves there are. A board is a finite space now — one shelf
     or nine — so it is neither "as tall as the tallest thing on it" nor "at
     least a screen": it is the shelves, and running out of them is what "it
     won't fit" means. */
  const cols = drawCols(g, dv), rows = drawRows(g, dv);

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
  // this board's own cell, derived from the measured width and its columns —
  // not the cell of whichever board happened to be measured last
  const colw = g.rowh;
  /* The seams between shelves, drawn only where more than one is on the screen
     at once — a Mac, where the middle row of three is all visible. They are the
     one thing that says the board is *nine* rather than one wide one, and they
     are a background rather than elements: a gradient with a hard stop every
     `shelfW` columns costs nothing and cannot be dragged. */
  const seams = dv!=='phone' && (g.shelves.w>1 || g.shelves.h>1)
    ? `--seamx:${g.shelfW*g.rowh}px;--seamy:${g.shelfH*g.rowh}px;` : '';
  return `<div class="grid g-${dv}${arr===true?' arranging':''}${boardLocked()?' locked':''}${sorted?' sorted':''}${S.look.pinned?' pinboard':''}${seams?' shelved':''}"
       id="drawergrid" data-gridfor="${c.id}"
       style="${boardVars}${seams}--cols:${cols};--rowh:${g.rowh}px;--checkerx:${2*colw}px;--checkery:${2*g.rowh}px;grid-auto-rows:${g.rowh}px;grid-template-rows:repeat(${Math.max(rows,1)},${g.rowh}px)">${tiles}
  </div>`;
}

/* List view is the same tile, stretched into a band. Same silhouettes, same
   colours — a drawer still looks like a drawer, a task still comes to a point. */
/* One row of a list. The same tile stretched into a band — same silhouettes,
   same colours, so a drawer still looks like a drawer and a task still comes to
   a point — and, since decision 61, the same controls a tile on a grid has:

     tap the words      change them, on an unlocked board
     tap the box        tick it
     swipe left         delete it
     swipe right        put it on today, if it is the sort of thing that has a day
     hold, then move    reorder, under Manual sort
     hold still         the menu, which is everything else

   A list was a place you could look at things and not much else; that is the
   gap this closes. See gestures.js for the three that are gestures. */
function listTile(o){
  const colour=objColour(o);
  const cont=isContainer(o);
  const img = has(o,'media') && o.media && o.media.src;
  const attr = cont ? `data-drawer="${o.id}"` : `data-row="${o.id}"`;
  // a row being typed in is a div: an input inside a button is unfocusable
  const raw = S.editId===o.id;
  return `<${raw?'div':'button'} class="drawer ${cont?'dtile':'otile'} sh-${cont?'front':shapeOf(o)} listband${S.sel.includes(o.id)?' selected':''}${
      raw?' editing':''}" ${attr} style="--c:${colour}">
    <div class="dtop">
      ${has(o,'check')?`<span class="check tilecheck${o.done?' on':''}" data-check="${o.id}">${ic('check',12)}</span>`:''}
      ${img?`<img class="bandimg" src="${esc(o.media.src)}" alt="">`:''}
      ${nameField(o)}
      ${o.body?`<span class="bandsnip">${esc(oneline(o.body).slice(0,120))}</span>`:''}
      ${o.due?`<span class="mchip">${esc(dateSaid(o))}</span>`:''}
      ${deadSaid(o)?(u=>`<span class="mchip deadchip${u?' u'+u.rank:''}${
        !(has(o,'deadline')&&o.dead)?' soft':''}${isLate(o)?' late':''}"${
        u?` title="${esc(urgeSaid(o))}"`:''}>${esc(deadSaid(o))}</span>`)(urgencyOf(o)):''}
      ${cont&&rollup(o)?`<span class="mchip">${esc(rollup(o))}</span>`:''}
      ${cont?`<span class="pull ${dress(o,'kn')}"${o.knobc?` style="--knob:${esc(o.knobc)}"`:''}></span>`:''}
    </div>
  </${raw?'div':'button'}>`;
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
/* One bar under the paper, holding everything you can press.

   The sheet used to have controls at both ends: a header above it carrying the
   title and four buttons, and this bar below it carrying the page turns. The
   header was the half that broke — it was sized to a 560px floor rather than
   to the paper, so on a phone it was 605px wide on a 390px screen and hung off
   both edges, with Edit and the close button entirely off the screen. There
   was no way to shut the reader from its own header.

   So the header is the title and nothing else, and every control lives in this
   one row: the tools on the left, the page turns centred under the sheet where
   they belong, and the way out at the right. Three columns rather than a flex
   row, so the turns stay centred whatever the tools weigh — and the whole bar
   is the width of the paper, which is what stops any of it from drifting off.
   It is also the end of the sheet a thumb can actually reach. See decision 84.

   `left` and `right` are the slots the reading surface fills; scroll mode gets
   the bar too, with nothing in the middle, because the controls are not the
   page turns' guests any more. */
function bookOf(o, left, right){
  const mode=readOf(o);
  const bar = mid => `<div class="bookbar">
    <span class="bktools">${left||''}</span>
    <span class="bkturn">${mid}</span>
    <span class="bkout">${right||''}</span></div>`;
  if(mode==='scroll'){
    // the same sheet, the same size — the column inside it scrolls instead of
    // the paper growing to fit what is on it
    return `<div class="book"><div class="spread scrolling ${sheetOf(o)}"><i class="dgrain"></i>
      <div class="page">${headOf(o)}${o.body?md(o.body):'<p class="thin">Nothing written yet.</p>'}</div>
    </div>${bar('')}</div>`;
  }
  const pages=pagesOf(o), two=spreadOf(o), step=two?2:1;
  const at=Math.min(Math.max(0,S.bookAt||0), Math.max(0,pages.length-1));
  const last=Math.min(at+step, pages.length);
  // one page is not a book: nothing to turn, so nothing to press
  const turn = pages.length<=1 ? '' :
    `<button class="iconbtn" data-act="bookprev" title="Back"${at<=0?' disabled':''}>${ic('chevL',15)}</button>
     <span class="bookcount">${two&&last>at+1?`${at+1}–${last}`:at+1} of ${pages.length}</span>
     <button class="iconbtn" data-act="booknext" title="On"${at+step>=pages.length?' disabled':''}>${ic('chevR',15)}</button>`;
  return `<div class="book"><div class="spread ${sheetOf(o)}"><i class="dgrain"></i>
      <div class="page">${pages[at]||''}<span class="pno">${at+1}</span></div>
      ${two?`<div class="page">${pages[at+1]||''}${pages[at+1]?`<span class="pno">${at+2}</span>`:''}</div>`:''}
    </div>${bar(turn)}</div>`;
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
    ${/* a drawer read as a book is bound in its own paper, the same way an
         object opens onto its own — the sheet belongs to what you are
         reading, and here that is the container. */''}
    <div class="spread ${sheetOf(c)}"><i class="dgrain"></i>
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
      ${deadSaid(o)?(u=>`<span class="mchip deadchip${u?' u'+u.rank:''}${
        !(has(o,'deadline')&&o.dead)?' soft':''}${isLate(o)?' late':''}"${
        u?` title="${esc(urgeSaid(o))}"`:''}>${esc(deadSaid(o))}</span>`)(urgencyOf(o)):''}
      ${(o.tags||[]).map(t=>`<span class="mchip tag" data-tagdrawer="${esc(t)}">${esc(t)}</span>`).join('')}
    </header>
    ${has(o,'media')&&o.media&&o.media.src?`<img class="scrollimg" src="${esc(o.media.src)}" alt="${esc(o.title||'')}">`:''}
    ${o.body?`<div class="prose">${md(o.body)}</div>`:''}
  </article>`;
}

export { spinTo, CLICKS, clickOf, fireButton, tileTap, pending, placeAtPending, SHELFSHIFT,
  gridTile, gridOfContainer, listTile, scrollEntry, bookOf, bookView, sheetOf, turnPage, clearPages,
  calSpan };
