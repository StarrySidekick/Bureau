import { $, esc, ic, D, md, clamp, ROOT } from './util.js';
import { S, K, T, byId, has, isContainer, containers, container, childrenOf, chainOf,
  deskTitle, rootObj, cfgOf, deskIds, deskHere, deskOf, isDesk, allTags, dev,
  beginPass, endPass,
  layoutOf, takesTyping, genKindOf, CALVIEWS, calViewOf, calCols,
  spanOf, coversDay, lastDay, boardLocked,
  TILT_MODES, tiltMode, tiltsDesk, tiltsWindows, tiltClasses } from './model.js';
import { GRID, PHONE_GRIDS, CELL, COLW, MEASURE, colsOf, gridKeyOf,
  pageRows, pageOfBox, lastPage,
  lay, gridOf, cellW, ensureBox, PLACED } from './grid.js';
import { themeNow, applyLook, lookVal, STYLES, BACKDROPS, DARKMODES, darkMode, hasDark,
  palNow, setSlot, styleNow, hexOf, objColour, slotName, OBJ0, CHECKS, dressAs } from './look.js';
import { gridOfContainer, gridTile, listTile, scrollEntry, bookView, calSpan } from './tiles.js';
import { openPanel, closePanel, panelKey, repositionPanel } from './panels.js';
/* Cyclic at *function* level only — motion.js imports render() from here and
   this imports sprayAt() from there, and neither is called while the modules
   are loading. That is the graph the app already has; keep it that way. */
import { sprayAt, SPRAYS, sprayNow, sprayMark } from './motion.js';
import { APP_VERSION, DATA_V, save, saveIfDirty, storeSize, install } from './persist.js';

/* The desk is nothing but the grid. There is no toolbar: New, Arrange and
   Settings are control objects sitting on it, so the grid is the whole page. */
/* ---- the top shelf ------------------------------------------------------
   Where you are on the left, the tools on the right. Every tool is a toggle you
   press rather than a menu you open: the lock is a lock that is open or shut,
   and the star is a place or not a place. A phone has no room for a popup that
   asks a question you could have answered by pressing the button again — and no
   room for a tool that isn't one. How a board sorts itself is a thing you set
   once and then live with, so it is the "Sorted by" row of the board's own
   editor now and the bar is shorter for it. */
/* What a container is called at the top of its own board. Home has no title of
   its own — it is whoever's desk this is. */
const boardName = o => !o || o.id===ROOT ? deskTitle() : (o.title||'Untitled');

/* The breadcrumb runs from the desk you are on, not from home: "Finance ›
   Bills" is where you are, and "Desk › Finance › Bills" is a path back to a
   house nobody has lived in since there was more than one of them. chainOf()
   already stops at a desk; a drawer on the *home* desk stops short of it,
   because home is not an object, so it is put back on the front here. */
/* The name at the top left is the way to every other desk. Desks are not on
   the shelf any more — they are laid out in space, walked sideways with a
   swipe — so the one thing that has to exist is a way of seeing the whole row
   at once and jumping. That is this: press where you are, and every desk opens
   out, drawn small. See decision 41. */
function gridBar(c){
  let trail = chainOf(c.id);
  if(!(trail[0] && isDesk(trail[0].id))) trail = [container(deskOf(c.id)), ...trail];
  const atDesk = trail.length<=1;
  const pages = pageCount(c.id);
  const desks = deskIds(), here = deskHere();
  const deskBtn = (label)=>`<b class="deskname" data-act="deskmap"
    title="Every desk, laid out">${esc(label)}</b>`;
  return `<div class="gridbar shelf shelf-top">
    <div class="where">
      ${atDesk ? `<span class="here">${deskBtn(boardName(trail[0]))}</span>` :
        `<button class="iconbtn" data-act="back" data-id="${c.id}" title="Back">${ic('chevL',17)}</button>
         <span class="trail">${
           trail.map((x,i)=>`${i?` ${ic('chevR',9)} `:''}${i===trail.length-1
             ? `<span class="here">${esc(boardName(x))}</span>`
             : i===0 ? deskBtn(x.id===ROOT ? deskTitle() : boardName(x))
             : `<b data-drawer="${x.id}">${esc(boardName(x))}</b>`}`).join('')}</span>`}
      ${has(c,'magic')?`<span class="magicmark big" title="Collects by rule">${ic('sparkle',14)}</span>`:''}
      ${/* The dots are the **desks**, in the order they sit in the master
           space, with the one you are standing on lit. A row you walk sideways
           is a row you can be lost in, and "third of five" is the one thing a
           strip of dots says better than anything else — which is what they are
           for on every home screen ever made. They used to count the pages of
           this board, which is a fact about how far down you have scrolled and
           reads as position in exactly the wrong axis. Pressing one goes there.

           Dots while they fit; a count once they don't — nine is already more
           than you can aim at, and thirty is a texture. */''}
      ${desks.length>1?`<span class="deskmark" title="Which desk you are on — swipe sideways to walk them">${
        desks.length<=9
          ? desks.map(id=>`<i class="${id===here?'on':''}" data-deskgo="${id}"
              title="${esc(boardName(container(id)))}"></i>`).join('')
          : `<b>${desks.indexOf(here)+1}<u>/${desks.length}</u></b>`}</span>`:''}
      ${/* …and the page, which is a number rather than a place. It only says
           anything when there is more than one. */''}
      ${pages>1?`<span class="pagemark" title="Two fingers up and down turn the page"
        ><b>${pageAt(c.id)+1}<u>/${pages}</u></b></span>`:''}
    </div>
    <div class="bartools">
      ${/* The lock comes first, because it is the one that changes what every
           other gesture on the board means — and on a locked board it is the
           button you reach for before you can do anything else. A phone has no
           right button and no room for an arrange mode, so the lock is a
           button; locked refuses moves and resizes, and the long press still
           opens the menu either way. */''}
      ${/* One switch for every board there is, not one per board. See
           decision 74. */''}
      <button class="sqbtn${boardLocked()?' on locked':''}" data-act="togglelock"
        title="${boardLocked()?'Everything is locked — tap to unlock':'Everything is unlocked — tap to lock'}">${ic(boardLocked()?'lock':'unlock',16)}</button>
      ${/* How a board is laid out and how it sorts itself are things you set
           once and then live with, which is a settings question and not a
           tool. Both are rows in the board's own editor now. */''}
      ${/* The star promotes: a drawer becomes a desk of its own, out in the
           master space, and stops being on the board it was on at all. */''}
      ${c.id===ROOT?'':`<button class="sqbtn${isDesk(c.id)?' on':''}" data-act="pin" data-id="${c.id}"
        title="${isDesk(c.id)?'Make it an ordinary drawer again':'Give it a place of its own'}">${ic('star',16)}</button>`}
      ${/* The brush is *this board*, whichever board it is. A drawer is an
           object and opens its object editor; a desk is a container without a
           tile and opens the same editor for itself — how it is laid out, what
           it sorts by, what colour its board is. It used to be that the desk
           had no editor at all and the gear stood in for one, which meant the
           only way to repaint one desk was a setting that repainted them all.
           A brush, because what it mostly changes is how the thing looks. */''}
      <button class="sqbtn" data-act="drawersettings" data-id="${c.id}"
        title="${c.id===ROOT?'This desk':'Object editor'}">${ic('brush',16)}</button>
      ${/* …and the gear is the *app*, which is a different question and only
           worth asking from a desk. Two icons rather than one standing for
           both. */''}
      ${c.id===ROOT?`<button class="sqbtn" data-act="appsettings" data-id="${c.id}"
        title="Settings">${ic('gear',16)}</button>`:''}
    </div>
  </div>`;
}

/* ---- the reveal, from the last measurement ----------------------------
   How far the board sits below the bar, and how deep the drawer under it is.
   Both are computed by sizeGrid() *after* layout, and both used to be written
   onto the elements only then — which is fine for the board you are looking at
   and wrong for the one being slid in beside it. The pager builds its
   neighbours from previewHTML(), so they arrived at the CSS floor (a 7px gap
   and the rail's own minimum), sat a little high, and clicked down to position
   the moment the swipe committed and render() measured them.

   So the numbers are held here and written into the markup as it is built, the
   same way gridOfContainer() writes the checker squares from the last measured
   cell. A board drawn off-screen is drawn at the size it will be. */
const REVEAL = {gap:7, rail:30};
const revealStyle = ()=> S.device==='phone' ? ` style="margin-top:${REVEAL.gap}px"` : '';

function viewDesk(){
  const c=rootObj(), view=c.layout||'grid';
  if(view!=='grid'){
    const items=childrenOf(c);
    return `
    ${gridBar(c)}
    <div class="scroll">
      ${!items.length ? `<div class="empty"><div class="big">Nothing on the desk</div>Click a bare cell in grid view to make something.</div>`
        : view==='scroll' ? `<div class="scrollview">${items.map(scrollEntry).join('')}</div>`
        : view==='book'   ? bookView(c, items)
        : `<div class="listgrid" data-listfor="${c.id}">${items.map(listTile).join('')}</div>`}
    </div>`;
  }
  // the bar sits above the scroller, not inside it — it carries the pins now,
  // and navigation that scrolls away is navigation you can't reach
  return `
  ${gridBar(c)}
  <div class="scroll deskscroll"${revealStyle()}>
    ${cavityWalls()}
    ${S.layoutEdit?`<div class="banner">${ic('resize',14)} You are arranging the <b style="margin:0 3px">${S.layoutEdit==='desk'?'Mac':'iPhone'}</b> layout.
      <button data-act="stopedit">Back to this device</button></div>`:''}
    ${gridOfContainer(ROOT)}
  </div>`;
}

/* ============================================================
   8b · rendering — the time layer
   ============================================================
   A calendar face on the board shows a month at tile size; opening the drawer
   gives you the same month at full size, with what is on each day and a way to
   add to it. A timeline drawer lays its contents along a real axis, scaled by
   however many pixels a day is worth. Both are layouts, so any container can
   wear one — nothing here knows what a "calendar" is. */
const DOWNAME = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const CAPS = {month:6, week:9, day:24};   // items a cell has room for, per span

/* One day of a calendar, opened: what is on it, and a box to add to it. Also
   the whole of the day view, which is this and nothing else. */
function dayPanel(d, iso, list, named){
  return `<div class="dayp">
    <div class="section-h"><h2>${named?'':esc(D.parse(iso).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'}))}</h2>
      <div class="rule"></div><span class="n">${list.length}</span></div>
    ${list.length?`<div class="listgrid">${list.map(listTile).join('')}</div>`
      :`<div class="mini" style="--k:var(--brass)">Nothing on this day yet.</div>`}
    <div class="quickadd" style="margin-top:9px">${ic('plus',14)}
      <input data-dayadd="${d.id}:${iso}" placeholder="Add something on this day…">
      <span class="k">return</span></div>
  </div>`;
}

/* A calendar shows a month, a week or a day of whatever it collects. All three
   are the same cells over a different span, so a drop target, a mark and a
   quick-add cannot drift between them — calSpan() says which days, calCols()
   says which of them are drawn and in what order. */
function viewCalendar(d, items){
  const view=calViewOf(d), cols=calCols(d), cap=CAPS[view]||6;
  const anchor = D.parse(d.month||T) || D.today();
  const {from, to, month} = calSpan(d, anchor, view);
  /* A thing that lasts is on every day it covers, not only the one it starts
     on — a trip you can't see on the Thursday is a trip you'd double-book. It
     is named on its first visible day and drawn as a continuing bar after
     that, which is how a week reads as one thing rather than seven. */
  const byDay={};
  for(let dt=new Date(from); dt<=to; dt=D.add(dt,1)){
    const iso=D.iso(dt);
    items.forEach(x=>{ if(coversDay(x, iso)){
      const s=spanOf(x);
      (byDay[iso]=byDay[iso]||[]).push({o:x, run:!!s, head:!s || x.due===iso});
    }});
  }
  const label = view==='day'
      ? anchor.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})
    : view==='week'
      ? `${from.toLocaleDateString(undefined,{day:'numeric',month:'short'})} – ${to.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}`
      : anchor.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const head = `
  <div class="monthhead">
    <button class="sqbtn" data-act="monthstep" data-id="${d.id}" data-step="-1" title="Back">${ic('chevL',15)}</button>
    <b>${esc(label)}</b>
    <button class="sqbtn" data-act="monthstep" data-id="${d.id}" data-step="1" title="Forward">${ic('chevR',15)}</button>
    <button class="pill" data-act="monthtoday" data-id="${d.id}">Today</button>
    <div class="filterbar calviews">${Object.entries(CALVIEWS).map(([v,n])=>
      `<button class="fchip${view===v?' on':''}" data-calview="${d.id}:${v}">${n}</button>`).join('')}</div>
    <span class="mhint">Drop a dated object on a day to schedule it</span>
  </div>`;
  // The day view is the day panel and nothing above it — a one-square grid is
  // a border round a list.
  if(view==='day'){
    const iso=D.iso(anchor);
    // the head already says which day it is, so the panel doesn't say it again
    return head + dayPanel(d, iso, (byDay[iso]||[]).map(x=>x.o), true);
  }
  const cells=[];
  for(let dt=new Date(from); dt<=to; dt=D.add(dt,1)){
    if(!cols.includes(dt.getDay())) continue;
    const iso=D.iso(dt), list=byDay[iso]||[];
    cells.push(`<div class="mcell${month!=null&&dt.getMonth()!==month?' out':''}${
        iso===T?' today':''}${iso===S.calDay?' sel':''}" data-calday="${d.id}:${iso}">
      <b>${dt.getDate()}</b>
      ${list.slice(0,cap).map(({o,run,head})=>`<span class="mitem${o.done?' done':''}${
          run?(head?' runs':' runs cont'):''}" style="--k:${objColour(o)}"
        data-row="${o.id}" title="${esc(o.title||'Untitled')}">${
          head?esc(o.title||'Untitled'):''}</span>`).join('')}
      ${list.length>cap?`<u>+${list.length-cap} more</u>`:''}
    </div>`);
  }
  const sel=S.calDay;
  return `${head}
  <div class="monthgrid cal-${view}" style="--dcols:${cols.length}">
    ${cols.map(n=>`<i class="dow">${DOWNAME[n]}</i>`).join('')}
    ${cells.join('')}
  </div>
  ${sel?dayPanel(d, sel, (byDay[sel]||[]).map(x=>x.o)):''}`;
}

/* One day is `zoom` pixels wide. Labels would sit on top of each other at any
   useful zoom, so each is dropped into the first lane where it clears the one
   before it — the same trick a Gantt chart uses, and the reason this stays
   readable when six things happen in one week. */
function viewTimeline(d, items){
  const zoom = d.tlzoom || 14;
  const dated = items.map(o=>({o, iso:o.due||o.created})).filter(x=>x.iso)
    .sort((a,b)=>a.iso.localeCompare(b.iso));
  const slider = `<div class="tlbar">
    <span class="s">A day is</span>
    <input class="pslide" type="range" min="3" max="60" step="1" value="${zoom}" data-tlzoom data-id="${d.id}">
    <b>${zoom}px</b></div>`;
  if(!dated.length) return `${slider}
    <div class="empty"><div class="big">Nothing to lay out</div>Objects need a date before they can sit on a timeline.</div>`;
  const min=D.parse(dated[0].iso);
  // the axis has to reach the *end* of the last thing, not the start of it
  const maxIso=dated.map(x=>lastDay(x.o)||x.iso).sort().pop();
  const max=D.parse(maxIso);
  const at = iso => Math.round((D.parse(iso)-min)/86400000)*zoom;
  const LANE=136, laneEnd=[];
  const placed=dated.map(({o,iso})=>{
    const x=at(iso), sp=spanOf(o);
    // a bar is as wide as it is long, so it reserves its own lane for that far
    const w=Math.max(LANE, sp ? (sp.days-1)*zoom + LANE : 0);
    let lane=0; while(laneEnd[lane]!=null && x<laneEnd[lane]) lane++;
    laneEnd[lane]=x+w;
    return {o,iso,x,lane};
  });
  /* Ticks by week when the whole span is a couple of months, by month when it
     is longer — monthly ticks on a fortnight's worth of objects drew nothing
     at all, because the range never crossed a month boundary. */
  const spanDays=Math.max(1, Math.round((max-min)/86400000));
  const byWeek=spanDays<=70;
  const fmt=dt=>dt.toLocaleDateString(undefined, byWeek?{day:'numeric',month:'short'}:{month:'short',year:'2-digit'});
  const ticks=[{x:0, label:fmt(min)}];
  const cur=new Date(min);
  if(byWeek){ do{ cur.setDate(cur.getDate()+1); }while(((cur.getDay()+6)%7)!==0); }
  else cur.setMonth(cur.getMonth()+1, 1);
  while(cur<=max){
    const x=at(D.iso(cur));
    if(x>6) ticks.push({x, label:fmt(cur)});
    if(byWeek) cur.setDate(cur.getDate()+7); else cur.setMonth(cur.getMonth()+1);
  }
  const width=at(D.iso(max))+LANE+40;
  const height=laneEnd.length*44+70;
  const todayX = (D.today()>=min && D.today()<=max) ? at(T) : null;
  return `${slider}
  <div class="tlscroll"><div class="tlcanvas" style="width:${width}px;height:${height}px">
    ${ticks.map(k=>`<i class="tltick" style="left:${k.x}px"><u>${k.label}</u></i>`).join('')}
    ${todayX!=null?`<i class="tlnow" style="left:${todayX}px"><u>today</u></i>`:''}
    <i class="tlaxis"></i>
    ${placed.map(p=>{
      const sp=spanOf(p.o), w=sp ? Math.max(6,(sp.days-1)*zoom) : 0;
      return `<span class="tlitem${p.o.done?' done':''}${sp?' lasts':''}" data-row="${p.o.id}"
        style="left:${p.x}px;top:${p.lane*44+46}px;--k:${objColour(p.o)}${sp?`;--run:${w}px`:''}">
        ${sp?'<i class="tlbar"></i>':'<i class="tldot"></i>'}
        <b>${esc(p.o.title||'Untitled')}</b>
        <u>${esc(sp?`${D.short(sp.from)} – ${D.short(sp.to)}`:D.short(p.iso))}</u></span>`;}).join('')}
  </div></div>`;
}

/* ============================================================
   9 · rendering — drawer view
   ============================================================ */
function viewDrawer(){
  const d=byId(S.drawerId);
  if(!d || !isContainer(d)) return viewDesk();
  const all=childrenOf(d);
  let items=all;
  if(S.kindFilter) items=items.filter(o=>o.kind===S.kindFilter);
  const kinds=[...new Set(all.map(o=>o.kind))];
  /* grid | list | scroll | book | calendar | timeline — the object's own choice
     first, then its type's. Falling straight to 'grid' meant a type that says
     it opens as a calendar only did so if something had written `layout` onto
     the object, which create() does and the seed doesn't. */
  const view = layoutOf(d);
  return `
  ${gridBar(d)}
  <div class="scroll${view==='grid'?' deskscroll':''}"${view==='grid'?revealStyle():''}>
    ${view==='grid'?cavityWalls():''}
    ${kinds.length>1&&view!=='grid'?`<div class="filterbar">
      <button class="fchip${!S.kindFilter?' on':''}" data-kind="">All</button>
      ${kinds.map(k=>`<button class="fchip${S.kindFilter===k?' on':''}" data-kind="${k}" style="--k:${hexOf(K(k).c)}">${K(k).nm}</button>`).join('')}
    </div>`:''}
    ${has(d,'text')&&(d.body||'').trim()
      ? `<div class="contbody">${md(d.body)}</div>` : ''}
    ${takesTyping(d)&&view!=='calendar' ? `<div class="quickadd">${ic('plus',14)}
      <input data-contadd="${d.id}" placeholder="Add a ${esc(K(genKindOf(d)).nm.toLowerCase())}…">
      <span class="k">return</span></div>` : ''}
    ${view==='grid'
      ? gridOfContainer(d.id)
      : view==='calendar'
      ? viewCalendar(d, items)
      : view==='timeline'
      ? viewTimeline(d, items)
      : !items.length
        ? `<div class="empty"><div class="big">This drawer is empty</div>${
            has(d,'magic') ? 'Nothing matches its rule yet.'
            : takesTyping(d) ? 'Type in the box above to start it off.'
            : 'Drag something in, or click a bare cell on the desk.'}</div>`
        : view==='book'
        ? bookView(d, items)
        : view==='scroll'
          ? `<div class="scrollview">${items.map(scrollEntry).join('')}</div>`
          : `<div class="listgrid" data-listfor="${d.id}">${items.map(o=>listTile(o)).join('')}</div>`}
  </div>`;
}

/* ============================================================
   12b · settings — a panel, not a screen
   ============================================================
   Settings used to be one of three views and took the whole window with it.
   It is an ordinary panel now, like every other menu in the app: the board
   stays visible and live behind it, so a colour or a board texture lands where
   you can see it while you are still choosing. It is the one panel that shows
   state it can also change, so wire() rebuilds it through refreshPanel() when
   one of its own controls fires. */
function bytes(n){ return n<1024? n+' B' : n<1048576? (n/1024).toFixed(1)+' KB' : (n/1048576).toFixed(2)+' MB'; }

/* ---- how many columns a board has -------------------------------------
   Three sizes to try on, and the only number that changes is the column count —
   the width is the width, so the columns set the cell and the cell sets
   everything else. Switching rescales the boxes on that board, the way a
   migration would. See decisions 48 and 60.

   `cid` names the board. Left out it is the **app's default**: what every board
   follows until it is asked directly, which is where a drawer you have never
   thought about gets its answer from. The two readings live in the same field
   because they are the same question at two scopes, and the copy says which. */
function gridSizeField(cid){
  const app = cid==null;
  const now = app ? (S.look.grid||'small') : gridKeyOf(cid);
  const own = app ? null : (cfgOf(cid)||{}).grid;
  return `<div class="field" style="margin-top:12px"><label>${app?'iPhone grid':'This board'}</label>
      <div class="filterbar">${Object.entries(PHONE_GRIDS).map(([k,n])=>
        `<button class="fchip${now===k?' on':''}${!app&&own!==k?' inherited':''}"
          data-gridsize="${k}"${app?'':` data-gridfor="${cid}"`}>${
          k[0].toUpperCase()+k.slice(1)} · ${n} across</button>`).join('')}
        ${app||!own?'':`<button class="fchip" data-gridsize="" data-gridfor="${cid}">Follow the desk</button>`}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Fewer columns, bigger cells. The rows are whatever fits — a cell is square, so the columns decide both. ${
        app ? 'Every board that has not been asked this question itself.'
            : (own ? 'This board only.' : 'Following the desk — pick one to give this board its own.')}${
        S.device==='phone' ? ` Right now: <b>${colsOf(app?null:cid, 'phone')} × ${pageRows('phone', app?null:cid)}</b>.` : ''}</div>
    </div>`;
}
const installed = ()=> window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone;

/* ---- settings, in the shape of the questions it asks ------------------
   Seventeen sections in one column, with a *Testing* button among them and
   "erase everything" three scrolls below the thing you came for. Same argument
   as the object editor and the same shape of answer: the top is a short list of
   doors, each one is the same panel under the same key, and `spec.back` is the
   way out. See decision 66. */
const SETSECS = {
  style:  ['Aesthetics', 'palette', 'the sixteen colours, light and dark'],
  look:   ['Appearance', 'brush',   'the board, the shadows, the grid'],
  things: ['Your things','archive', 'how much there is, and getting it out'],
  paste:  ['Paste in',   'plus',    'objects described as JSON'],
  about:  ['About',      'help',    'which Bureau this is, and starting over']
};
function settingsPanel(sec){
  const s = SETSECS[sec] ? sec : null;
  openPanel({key:'settings', title: s ? SETSECS[s][0] : 'Settings',
    sub: s ? 'Settings' : `Bureau ${APP_VERSION} · ${installed()?'installed':'in a browser tab'}`,
    back: s ? (()=>settingsPanel()) : null,
    body:()=>settingsBody(s)});
}
function toggleSettings(){ panelKey()==='settings' ? closePanel() : settingsPanel(); }

function settingsBody(sec){
  const standalone = installed();
  const at = s => sec===s;
  if(!sec) return `<div class="rows osecs">${Object.entries(SETSECS).map(([k,[nm,icon,note]])=>
      `<div class="row" data-ssec="${k}">
        <span class="kindmark">${ic(icon,13)}</span>
        <div class="body"><div class="title">${esc(nm)}</div><div class="snip">${esc(note)}</div></div>
        <span class="rowgo">${ic('chevR',13)}</span></div>`).join('')}</div>
    <div class="mini" style="--k:var(--brass);margin-top:10px">This board's own colour, layout and lock are in <b>its</b> editor — the brush in the bar — not here. See decision 53.</div>`;
  return [
    at('about') ? `

    <div class="section-h"><h2>Version</h2><div class="rule"></div></div>
    <div class="statline">
      <div class="s"><b>${esc(APP_VERSION)}</b>Bureau</div>
      <div class="s"><b>${DATA_V}</b>data format</div>
      <div class="s"><b>${standalone?'Installed':'Browser'}</b>running as</div>
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">An installed copy serves itself from its own cache, so it can be a version behind until its second launch. This is the one that is running right now.</div>` : '',
    at('style') ? `
    <div class="section-h"><h2>Aesthetics</h2><div class="rule"></div></div>
    <div class="stylegrid">${Object.entries(STYLES).map(([k,st])=>
      `<button class="styletile${(S.look.style||'victorian')===k?' on':''}" data-style3="${k}">
        <span class="stpv" style="background:${st.cols[0]};border-color:${st.cols[2]}">${
          [3,5,6,9,11,12].map(i=>`<i style="background:${st.cols[i]}"></i>`).join('')}</span>
        <b>${st.nm}</b><i>${st.ds}</i></button>`).join('')}</div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">An aesthetic is sixteen colours, a board, a typeface, and the defaults new drawers are born with. Everything below still works afterwards.</div>

    ${/* Light or dark is still not a second axis: it is a second set of
         sixteen that an aesthetic may carry, and Victoria is the one that does.
         The default follows the phone, because the desk should already be
         dark when you pick it up at night. */''}
    <div class="field" style="margin-top:12px"><label>Light and dark</label>
      <select class="psel" data-darkmode>${Object.entries(DARKMODES).map(([v,n])=>
        `<option value="${v}"${darkMode()===v?' selected':''}>${n}</option>`).join('')}</select>
      <div class="mini" style="--k:var(--brass);margin-top:6px">${hasDark()
        ? `${esc(styleNow().nm)} has a walnut set of its own — the same sixteen slots after dark, so every drawer keeps the colour you gave it.`
        : `${esc(styleNow().nm)} is one light and has no dark set, so this changes nothing here. Victoria does.`}</div>
    </div>

    <div class="field" style="margin-top:14px"><label>What ${esc(styleNow().nm)} is made of</label>
      <div class="mini" style="--k:var(--brass);margin:2px 0 8px">The first five dress the app itself. The other eleven are what drawers and objects are painted in. A slot is a <b>position</b>, not a colour: a drawer holds slot 11, and slot 11 is a claret here and a deep sea blue in Aeros. Changing aesthetic swaps every tile to that aesthetic's answer; changing back puts each one exactly where it was.</div>
      ${[[0,OBJ0,'chrome'],[OBJ0,16,'']].map(([a,b,cls])=>
        `<div class="slotgrid ${cls}">${palNow().slice(a,b).map((c,n)=>{
          const i=a+n;
          return `<label class="slot${cls?' chrome':''}" title="${slotName(i)}">
            <b style="background:${c}"><input type="color" data-slot="${i}" value="${c}"></b>
            <span>${slotName(i)}</span></label>`;}).join('')}</div>`).join('')}
      ${(S.look.slots&&S.look.slots[S.look.style||'victorian'])
        ? `<button class="pill" style="margin-top:8px" data-act="resetslots">${ic('undo',13)} Back to ${esc(styleNow().nm)}&rsquo;s own sixteen</button>` : ''}
    </div>` : '',
    at('look') ? `
    <div class="section-h"><h2>Appearance</h2><div class="rule"></div></div>
    <div class="field"><label>Background</label>
      <div class="pickgrid sw" style="margin-top:6px">${BACKDROPS.map(([c,nm])=>
        `<button data-look="bg" data-val="${c}" title="${nm}" class="${(lookVal('bg')||'')===c?'on':''}" style="background:${c}"></button>`).join('')}</div>
      <label class="custcol"><input type="color" data-lookinput="bg" value="${lookVal('bg')||palNow()[0]}"><span>Custom background</span></label>
      ${lookVal('bg')?`<button class="pill" style="margin-left:6px" data-look="bg" data-val="">Reset</button>`:''}
    </div>

    <div class="field" style="margin-top:12px"><label>Board</label>
      <div class="pickgrid sw" style="margin-top:6px">${
        [['#EFEADA|#DDE5CE','Green baize'],['#EFEADA|#E4DCC6','Sand'],['#EDE6D4|#D9E2E4','Slate'],
         ['#F0EBDC|#E8DAD2','Clay'],['#EEE9DA|#E2E2DA','Ash'],['#EFEADA|#EFEADA','Plain']].map(([v,nm])=>{
        const [a,b]=v.split('|');
        /* `lookVal`, not `S.look.board`: a board is stored per theme as
           {paper, walnut}, and comparing the object to a string marks nothing
           as chosen. This read only ever worked because applyLook() used to
           collapse the object on its way past — see decision 91. */
        return `<button data-look="board" data-val="${v}" title="${nm}" class="${(lookVal('board')||'')===v?'on':''}"
          style="background:linear-gradient(135deg,${a} 0 50%,${b} 50% 100%)"></button>`;}).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
        <label class="custcol"><input type="color" data-lookinput="board1" value="${(lookVal('board')||'#EFEADA|#DDE5CE').split('|')[0]}"><span>Light square</span></label>
        <label class="custcol"><input type="color" data-lookinput="board2" value="${(lookVal('board')||'#EFEADA|#DDE5CE').split('|')[1]}"><span>Dark square</span></label>
      </div>
      <label class="rangerow"><span>Board strength</span>
        <input type="range" min="0" max="100" step="5" data-lookrange="boardAlpha"
               value="${Math.round((S.look.boardAlpha==null?1:S.look.boardAlpha)*100)}">
        <b>${Math.round((S.look.boardAlpha==null?1:S.look.boardAlpha)*100)}%</b></label>
      ${lookVal('board')?`<button class="pill" style="margin-top:6px" data-look="board" data-val="">Reset</button>`:''}
    </div>

    ${/* Every tile casts a shadow onto whatever is under it, which is most of
         what makes a board read as things lying *on* a surface rather than as
         coloured rectangles. It is also the single loudest thing in the app, so
         it is worth being able to see the desk with it off. */''}
    ${/* Pinned rather than laid flat — a little air and a degree or two of
         tilt, off a hash of each object's id so it never changes. It is the one
         setting in the app that is purely about mood, which is reason enough to
         have it. See decision 75. */''}
    <div class="field" style="margin-top:12px"><label>How things sit</label>
      <div class="filterbar">${[['','Laid flat on the board'],['1','Pinned to it']].map(([v,n])=>
        `<button class="fchip${(S.look.pinned?'1':'')===v?' on':''}" data-pinned="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Pinned gives every tile a little room around it and tilts it a degree or two, as though a pin went through one of its top corners. The angle comes from the object itself, so nothing moves between renders — and a tile straightens while you carry it.</div>
    </div>

    ${/* Six tick boxes, each drawn as itself — ticked, because what a box
          looks like when it is ticked is the half you actually live with. */''}
    <div class="field" style="margin-top:12px"><label>Tick boxes</label>
      <div class="checkpick">${[['','However the aesthetic ticks'], ...Object.entries(CHECKS)].map(([v,n])=>
        `<button class="checkopt${(S.look.check||'')===v?' on':''}" data-checks="${v}" title="${n}">
          <span data-checks="${v||(styleNow().check||'square')}"><i class="check on" style="--k:var(--brass)">${ic('check',12)}</i></span>
          <u>${n}</u></button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Everywhere a box is drawn — a task on the board, a row in a list, a line on a checklist front. Tasks and checklists follow the desk rather than each carrying their own. The first follows the aesthetic and changes with it; the rest stay where you put them.</div>
    </div>

    ${/* Things that come out of a tile when a new one lands. Real physics
          rather than a keyframe — see decision 85 — so it is a flavour rather
          than a switch: how many, how big, and which shapes. */''}
    <div class="field" style="margin-top:12px"><label>When something new arrives</label>
      <div class="checkpick">${(()=>{
        const cs=getComputedStyle(document.documentElement);
        const ink=cs.getPropertyValue('--brass').trim()||'#A9793F';
        const line=cs.getPropertyValue('--ink').trim();
        const here=sprayNow();
        /* The first chip is the way back: an unset preference follows the
           aesthetic, and once you have picked one there has to be a way to
           stop. It draws the shape the current aesthetic suggests, so it is
           still a picture of what you would get. */
        const auto = !SPRAYS[S.look.spray];
        const rows = [[ '', ['Follows ' + styleNow().nm, 0, 0, SPRAYS[here][3]] ],
                      ...Object.entries(SPRAYS)];
        return rows.map(([v,[nm,,,kinds]])=>
          `<button class="checkopt sprayopt${v==='' ? (auto?' on':'') : (!auto&&here===v?' on':'')}" data-spray="${v}" title="${esc(nm)}">
            <span>${kinds.length
              ? [...new Set(kinds)].slice(0,3).map(k=>
                  `<img src="${sprayMark(k, ink, 20, line)}" alt="" width="20" height="20">`).join('')
              : `<i class="spraynone"></i>`}</span>
            <u>${esc(nm)}</u></button>`).join('');
      })()}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Thrown out of a new object as it lands on the board, and then pulled down. They take its colour and the aesthetic's own accent, so a burst belongs to the desk it happened on.</div>
    </div>

    <div class="field" style="margin-top:12px"><label>Shadows</label>
      <div class="filterbar">${[['1','Things cast a shadow'],['','Laid flat']].map(([v,n])=>
        `<button class="fchip${(S.look.shadows===false?'':'1')===v?' on':''}" data-shadows="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Off, a tile is the colour and the border and nothing else — flatter, quieter, and easier to read a crowded board off.</div>
    </div>

    ${S.device!=='desk'?(()=>{
      const px=(k,d)=>S.look[k]==null?d:S.look[k];
      return `
    <div class="field" style="margin-top:12px"><label>Looking in</label>
      <div class="filterbar">${Object.entries(TILT_MODES).map(([v,n])=>
        `<button class="fchip${tiltMode()===v?' on':''}" data-parallax="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Tilting the phone can move two different things, and they are worth having apart. <b>The desk</b> sets the board into the carcass and slides it behind the opening. <b>Windows</b> leave the desk still and move the view behind a window's frame, which is the same idea with a frame you can actually see. It asks iPhone for the motion sensor the first time you switch either on, and both stand still while you are carrying a tile or reading.</div>
      ${tiltsDesk()?`
      <label class="rangerow" style="margin-top:12px"><span>How deep the desk sits</span>
        <input type="range" min="0" max="34" step="1" data-lookpx="tiltdesk" value="${px('tiltdesk',16)}">
        <b>${px('tiltdesk',16)}px</b></label>
      <label class="rangerow" style="margin-top:8px"><span>Room around it</span>
        <input type="range" min="0" max="24" step="1" data-lookpx="deskinset" value="${px('deskinset',8)}">
        <b>${px('deskinset',8)}px</b></label>
      <div class="mini" style="--k:var(--brass);margin-top:6px">How far the board slides, and how much room it has around it. The board is the back of the slot and the four walls join it to the opening, so it is never cut off — which means the room is always at least the slide, and this slider only adds more on top of that.</div>`:''}
      ${tiltMode()!=='off'?`
      <label style="display:block;margin-top:12px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)">Which way it moves</label>
      <div class="filterbar" style="margin-top:5px">${[['','Against the tilt'],['1','With the tilt']].map(([v,n])=>
        `<button class="fchip${(S.look.tiltflip?'1':'')===v?' on':''}" data-tiltflip="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">A thing sitting in a recess hangs back when you turn the phone rather than chasing it, which is why it runs against the tilt. The other way round is here to be compared rather than because it is right.</div>`:''}
      ${tiltsWindows()?`
      <label class="rangerow" style="margin-top:12px"><span>How far back a view is</span>
        <input type="range" min="0" max="30" step="1" data-lookpx="tiltwin" value="${px('tiltwin',11)}">
        <b>${px('tiltwin',11)}px</b></label>
      <div class="mini" style="--k:var(--brass);margin-top:6px">How far behind its frame a window's view sits. Further back is more movement for the same tilt, which is what depth actually is.</div>`:''}
      <label class="rangerow" style="margin-top:12px"><span>How far things stand out</span>
        <input type="range" min="0" max="18" step="1" data-lookpx="depth" value="${px('depth',11)}">
        <b>${px('depth',11)}px</b></label>
      <div class="mini" style="--k:var(--brass);margin-top:6px">How thick the things standing on the shelf are. You see the right-hand side of everything left of the middle and the left-hand side of everything right of it, the way you do standing in front of a bookcase — so it is set by where a thing is rather than by the phone, and it reads with the desk sitting still. Its own setting for that reason: have it without the tilt, or the tilt without it. Zero is off.</div>
    </div>`;})():''}

    ${gridSizeField(null)}

    <div class="field" style="margin-top:12px"><label>Whose desk this is</label>
      <input data-lookinput="owner" value="${esc(S.look.owner||'')}" placeholder="Your name">
      <div class="mini" style="--k:var(--brass);margin-top:6px">Used for the title at the top of the desk.</div>
    </div>

    <div class="field" style="margin-top:12px"><label>Accent</label>
      <div class="pickgrid sw" style="margin-top:6px">${
        [['#A9793F','Brass'],['#8A5A3F','Leather'],['#4A7C59','Fern'],['#3F5F7A','Slate'],['#8C4A38','Rust'],['#5C7148','Olive']].map(([c,nm])=>
        `<button data-look="accent" data-val="${c}" title="${nm}" class="${(lookVal('accent')||'')===c?'on':''}" style="background:${c}"></button>`).join('')}</div>
      <label class="custcol"><input type="color" data-lookinput="accent" value="${lookVal('accent')||'#A9793F'}"><span>Custom accent</span></label>
      ${lookVal('accent')?`<button class="pill" style="margin-left:6px" data-look="accent" data-val="">Reset</button>`:''}
    </div>

    <div class="field" style="margin-top:12px"><label>Drawer outline</label>
      <div class="pickgrid sw" style="margin-top:6px">${
        [['rgba(0,0,0,.28)','Shadow'],['rgba(0,0,0,.55)','Ink'],['rgba(255,255,255,.28)','Chalk'],['#2A241C','Solid dark'],['#E9E1CC','Parchment']].map(([c,nm])=>
        `<button data-look="line" data-val="${c}" title="${nm}" class="${(lookVal('line')||'')===c?'on':''}" style="background:${c}"></button>`).join('')}</div>
      <label class="custcol"><input type="color" data-lookinput="line" value="#2A241C"><span>Custom outline</span></label>
      ${lookVal('line')?`<button class="pill" style="margin-left:6px" data-look="line" data-val="">Reset</button>`:''}
    </div>


    <div class="section-h"><h2>Drawer layouts</h2><div class="rule"></div></div>
    <div class="mini" style="--k:var(--brass)">Each device keeps its own arrangement. You can open the other one to tidy it from here.</div>
    <div class="filterbar">
      ${[['','This device ('+(S.device==='desk'?'Mac':'iPhone')+')'],['desk','Arrange Mac layout'],['phone','Arrange iPhone layout']].map(([v,n])=>
        `<button class="fchip${(S.layoutEdit||'')===v?' on':''}" data-layout="${v}">${n}</button>`).join('')}
    </div>` : '',
    at('things') ? `
    <div class="section-h"><h2>Your things</h2><div class="rule"></div></div>
    <div class="statline">
      <div class="s"><b>${S.objects.length}</b>objects</div>
      <div class="s"><b>${containers().length}</b>drawers</div>
      <div class="s"><b>${allTags().length}</b>tags</div>
      <div class="s"><b>${bytes(storeSize())}</b>on this device</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="pill" data-act="export">${ic('archive',13)} Export a backup</button>
      <button class="pill" data-act="import">${ic('undo',13)} Restore from a backup</button>
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">Everything lives on this device only. Export moves a desk between devices by hand — real sync comes later.</div>` : '',
    at('about') ? `
    ${install.deferred?`<div class="section-h"><h2>Install</h2><div class="rule"></div></div>
      <button class="pill solid" data-act="install">${ic('plus',13)} Install Bureau</button>`:''}
    ${(!standalone && /iPad|iPhone|iPod/.test(navigator.userAgent))?`
      <div class="section-h"><h2>Install</h2><div class="rule"></div></div>
      <div class="mini" style="--k:var(--brass)">Share → <b style="margin:0 3px">Add to Home Screen</b> to keep Bureau in your dock and run it full screen.</div>`:''}` : '',
    at('paste') ? `
    <div class="section-h"><h2>Paste objects</h2><div class="rule"></div></div>
    <div class="mini" style="--k:var(--brass)">Describe what you want somewhere that can write JSON, paste it here, and it lands on the desk. Types are matched by name, anything missing gets a sensible default, and a container's <b>children</b> go inside it.</div>
    <textarea id="pastebox" class="editor" style="min-height:130px;margin-top:8px"
      placeholder='[{"type":"drawer","title":"Lisbon","children":[{"type":"task","title":"Book the flight","due":"2026-09-02"}]}]'></textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="pill solid" data-act="pastego">${ic('plus',13)} Add to the desk</button>
      <button class="pill" data-act="pasteschema">${ic('help',13)} What it accepts</button>
    </div>` : '',
    at('about') ? `
    <div class="section-h"><h2>Testing</h2><div class="rule"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pill" data-act="randomten">${ic('sparkle',13)} Add ten at random</button>
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">Objects of random kinds, sizes and colours, for seeing how the grid copes. It used to have a twin in the grid bar, which was a testing button on the furniture.</div>

    <div class="section-h"><h2>Start over</h2><div class="rule"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pill" data-act="reseed">Reset to the sample desk</button>
      <button class="pill" data-act="wipe" style="color:#C0563F">Erase everything</button>
    </div>` : '',
    `<div style="height:20px"></div>`
  ].join('');
}

/* ============================================================
   13 · the shelf — taken out, for now
   ============================================================
   There used to be four fixed tabs here: Desk, Today, Keeping Up, Everything.
   Three of them were aggregations, which is precisely what a magic drawer
   does, so they were three hard-coded answers to a question the app already
   lets you ask yourself (decision 22). What replaced them was the shelf: one
   global row of whatever you kept to hand, drawn as the last row of the phone
   grid (decision 46).

   That row is gone too. It cost a row of every board on every desk for a
   navigation the app already has three of — the desks are walked sideways and
   laid out by the title, a magic drawer collects anything you can describe,
   and ⌘K finds the rest. The board it was taking a row from is the app. So it
   comes out and the row goes back to the grid, which is what makes the three
   sizes 8×13, 9×14 and 10×15 rather than a row less each.

   `S.pins` is still read and written by storage, and `placeOf()` still knows
   the word — nothing about anyone's data changes, and putting the shelf back
   means putting these two functions back. See decision 53. */

/* ---- every desk, laid out ---------------------------------------------
   The row of desks is a space you walk, and a space you walk needs a map. The
   name at the top left opens it: each desk drawn small — its own board colour,
   its name, and the boxes on it at a fiftieth of the size — in the order they
   sit in the row, with the one you are on lit. Press one and you are there.

   The miniature is drawn from the boxes rather than from tiles, on purpose: a
   desk map is about *shape* — where the rack is, how full the board is — and
   forty real tiles at 3% would be a smear that costs a render. */
function deskCard(id){
  const c=container(id), on=deskHere()===id;
  const g=gridOf('desk'), kids=childrenOf(c);
  /* Anything that has never been on this layout has no box, and lay() answers
     1,1 for all of them — which drew every unvisited desk as one square. Place
     them, which is exactly what opening the desk would do a moment later. */
  kids.forEach(o=>ensureBox(o, 'desk', id));
  const rows=Math.max(8, kids.reduce((m,o)=>{const b=lay(o,'desk');return Math.max(m,b.y+b.h-1)},0));
  const bd=c.board ? String(c.board).split('|') : null;
  return `<button class="deskcard${on?' on':''}" data-deskgo="${id}">
    <span class="deskmini" style="--dcols:${g.cols};--drows:${rows}${
        bd?`;--board-1:${esc(bd[0])};--board-2:${esc(bd[1]||bd[0])}`:''}">
      ${kids.map(o=>{ const b=lay(o,'desk');
        return `<i style="--k:${objColour(o)};grid-column:${b.x}/span ${b.w};grid-row:${b.y}/span ${b.h}"></i>`;
      }).join('')}</span>
    <b>${esc(id===ROOT?deskTitle():(c.title||'Untitled'))}</b>
    <u>${on?'you are here · ':''}${kids.length} on it</u>
  </button>`;
}
function deskMap(){
  openPanel({key:'deskmap', wide:true, title:'Desks',
    sub:'Swipe sideways to walk them — or jump',
    body:()=>`<div class="deskmapgrid">${deskIds().map(deskCard).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:10px">A desk is somewhere you can be. Promote any drawer with the star in its bar and it leaves the board it was on and joins this row.</div>`});
}

/* ============================================================
   14 · main render
   ============================================================ */
function bindSortables(){ /* delegation handles it; keep quick-add focused */ }

/* Where the board was scrolled to. render() replaces #app wholesale, so the
   scroller is a brand-new element every time and starts at the top — which
   meant moving a tile two rows down on a long desk threw you back to the first
   screen, mid-gesture. Remembered per place, so *navigating* still starts at
   the top: going into a drawer and coming back is a new view, not a redraw. */
const SCROLL = {key:null, top:0};
const viewKey = ()=> S.view==='drawer' ? 'drawer:'+S.drawerId : 'desk';

/* ---- which page of a board you are on ---------------------------------
   Remembered per container, in memory, so walking into a drawer and back
   doesn't lose your place — and never stored, because which screen of a board
   you happened to be looking at is not a fact about the desk.

   A board always offers one page past the last thing on it, so there is
   somewhere to drag to and somewhere for a new object to land. */
const PAGE = {};
const pageCount = cid => lastPage(dev(), cid) + (pageRows(dev(), cid) ? 2 : 1);
const pageAt = cid => Math.min(PAGE[cid]||0, pageCount(cid)-1);
/* How many rows this board is scrolled down by, right now.

   **A box in the model is in board rows and a cell on the screen is in page
   rows, and the two are only the same on page one.** `gridTile()` subtracts
   this as it draws (`PAGESHIFT` in tiles.js), which is the whole of paging —
   but anything that reads a cell *off* the screen, or writes a box *onto* it,
   has to make the same conversion or it is a page out. Three gestures did
   not: sketching a new object read a screen row and stored it as a board row,
   so on page two it collided with whatever was at that row on page one and
   refused to make anything; and the move ghost and the live resize wrote a
   board row straight into `grid-row`, which on page two is off the end of the
   page — so a tile being resized vanished until you let go and a render put
   it back. See decision 102. */
const pageTop = cid => pageAt(cid) * pageRows(dev(), cid);
function goPage(cid, n, soon){
  const p = clamp(n, 0, pageCount(cid)-1);
  if(p === pageAt(cid)) return false;
  PAGE[cid]=p;
  if(soon) renderSoon(); else render();
  return true;
}

/* ---- show me the thing I just made -----------------------------------
   A board is a coordinate space, so a new object goes in the first free room
   scanning from the top. On a phone an object is full width, which means the
   first free room is *always* below everything already there — so making
   something inside a drawer put it a screen and a half down and looked exactly
   like nothing had happened. It landed correctly and was never seen.

   Scrolling to it is the fix, not placing it differently: a board is arranged,
   and quietly shuffling what is on it to make room at the top would move things
   you put where they are. SCROLL is updated too, or the next render — which
   restores the remembered offset — would undo this. */
function reveal(id){
  const o=byId(id);
  // paged boards don't scroll — the thing to do is turn to the page it is on
  const home = o && (o.parent||ROOT);
  if(o && pageRows(dev(), home)){
    if(S.view==='drawer' ? S.drawerId===home : home===ROOT)
      goPage(home, pageOfBox(lay(o), dev(), home));
  }
  const el=document.querySelector(`#app .grid .drawer[data-row="${id}"],#app .grid .drawer[data-drawer="${id}"]`);
  const sc=$('#app .scroll');
  if(el){
    el.classList.add('justmade'); setTimeout(()=>el.classList.remove('justmade'), 1200);
    /* …and it throws a handful of things out when it lands. 46% of the 1s
       `justmade` keyframe is the moment it touches down — the one number here
       that tracks a keyframe, so the two have to move together. See
       decisions 81 and 85. */
    setTimeout(()=>sprayAt(id, 1.15), 450);
  }
  if(!el || !sc) return;
  const er=el.getBoundingClientRect(), sr=sc.getBoundingClientRect();
  if(er.top < sr.top+8 || er.bottom > sr.bottom-8){
    sc.scrollTop += (er.top - sr.top) - Math.max(12, (sr.height - er.height)/3);
    SCROLL.top = sc.scrollTop;
  }
}

/* ---- the desk's own drawer --------------------------------------------
   The strip along the bottom of a phone. It is not a shelf and holds nothing:
   it is the front of the desk itself, the carcass the board is set into, in
   the wood the app is made of rather than in the style's paper.

   It does the two things a drawer front does. **Tap the knob** and it takes you
   out — out of a drawer to the desk it is on, and from a desk to the home desk.
   **Pull it up** and the new-object picker comes out of it, which is the
   gesture the shelf used to carry (decision 43) and the reason it is worth
   having a piece of furniture down there at all rather than a margin.

   Its height is set by sizeGrid(), because it is also where the leftover goes:
   a board is a whole number of square cells and the few pixels the screen has
   over are the drawer being a little deeper, not a gap. */
/* What the desk's drawer is made of, read off the desk you are standing on —
   so it is the same question, and the same panel, as what colour that desk's
   board is. The keys are prefixed because for every desk but home `cfgOf()` is
   the drawer's own object, which already has a `knob` and a `texture` of its
   own for the tile it draws on its parent's board. */
function railCfg(){
  const c = cfgOf(deskHere()) || {};
  return {knob:c.railknob||'round', size:c.railknobsize||'sm',
          tex:c.railtexture||'none', knobc:c.railknobc||''};
}
/* ---- the four walls of the slot ---------------------------------------
   How you draw the inside of a box in two dimensions: an outer rectangle (the
   opening, which is the screen), an inner one (the back panel, which is the
   board), and four lines joining their corners. Those lines are the walls seen
   in perspective, and the whole trick is that **they follow the board**: it
   moves with the tilt and they stretch to stay joined to it, so you see more of
   one wall and less of the opposite one. That is what looking into a bookshelf
   slot actually looks like.

   Four elements rather than one, because each wall is a different quadrilateral
   and takes a different amount of light — and the joins have to land exactly on
   the corners, which a single gradient centred anywhere cannot promise once the
   inner rectangle stops being concentric with the outer one.

   The board is drawn **over** them. It is inset from the opening rather than
   clipped by it, so it never runs out past the edge and is never cut off; the
   walls take up the slack. See decision 116. */
const cavityWalls = ()=> S.device==='phone'
  ? '<i class="cavwall cw-top"></i><i class="cavwall cw-right"></i>'
   +'<i class="cavwall cw-bottom"></i><i class="cavwall cw-left"></i>' : '';

function deskRail(){
  const r=railCfg();
  return `<nav class="deskrail ${dressAs('tx',r.tex)} ks-${r.size}" data-rail style="height:${REVEAL.rail}px">
    <i class="dgrain"></i>
    <i class="pull railknob ${dressAs('kn',r.knob)}" data-act="railout"
      ${r.knobc?`style="--knob:${esc(r.knobc)}"`:''}
      title="Back — and pull up to make something"></i>
  </nav>`;
}

/* The whole of what `#app` holds, as a string, for wherever S says you are.
   No sidebar, no tabs and no shelf: the desk is the navigation. Drawers are on
   it, a sideways swipe walks the desks, the title lays them all out, ⌘K finds
   anything, and the breadcrumb walks up. */
function viewHTML(){
  /* One pass, so the boards and every container drawn on them share one answer
     to "what is in this?" rather than each walking the whole desk again. It is
     opened and closed around the string build and nothing else — see
     childrenOf() in model.js. */
  beginPass();
  try{
    const body = S.view==='drawer' ? viewDrawer()
               : viewDesk();        // the desk is the only other place there is
    return `<div class="main">${body}${S.device==='phone'?deskRail():''}</div>`;
  } finally { endPass(); }
}

/* The same thing, for somewhere you are *not*. The pager slides the board you
   are on off the screen and the neighbouring one on, so it needs that
   neighbour drawn before you have gone there — which means building it with S
   pointed somewhere else for the length of one string, and putting S back.
   `at` is {view, drawerId} and optionally {page}.

   Two things it must not leave behind: the id on the grid, because there would
   momentarily be two elements called #drawergrid and sizeGrid() measures the
   first one it finds; and the remembered page, which is per container and not
   the pager's to change until the swipe is committed. */
function previewHTML(at){
  const was={view:S.view, drawerId:S.drawerId, kindFilter:S.kindFilter};
  const cid = at.drawerId || ROOT, wasPage = PAGE[cid];
  S.view=at.view; S.drawerId=at.drawerId||null; S.kindFilter=null;
  if(at.page!=null) PAGE[cid]=at.page;
  let html='';
  try{ html=viewHTML(); }
  finally{
    S.view=was.view; S.drawerId=was.drawerId; S.kindFilter=was.kindFilter;
    if(at.page!=null){ if(wasPage==null) delete PAGE[cid]; else PAGE[cid]=wasPage; }
  }
  return html.replace(/ id="drawergrid"/g, '');
}

/* ---- rendering one frame later, on purpose -----------------------------
   The rule in motion.js is that nothing delays a **state change** — a tap files
   or navigates the instant it lands. This does not delay one: it moves the
   *rebuild* to the next frame while the state has already changed.

   It exists for the pager. Letting go of a sideways swipe changed which desk
   you are on and rebuilt the board in the same instant — fifteen milliseconds
   of string, parse and layout landing on exactly the frame the settle
   transition was supposed to start on, so the strip stuttered as it came to
   rest. The strip is opaque and it is already drawing the board you are
   arriving at, so there is nothing to see underneath it for that one frame.

   A direct render() supersedes a pending one, so nothing can render twice. */
let soonId=0;
function renderSoon(){
  if(soonId) return;
  soonId = requestAnimationFrame(()=>{ soonId=0; render(); });
}
/* ---- the status bar is the top of the carcass -------------------------
   In an installed app the strip the clock and the battery sit in is painted by
   the *system*, from `theme-color`, and nothing in CSS can reach it — so it is
   the one piece of the furniture that has to be told separately. It is the
   wood: the carcass runs from there down to the drawer along the bottom, and a
   cream strip above a walnut bar reads as the app starting an inch below the
   top of the screen.

   The head states the default, so a cold launch is right before any of this
   runs. This keeps it in step with a desk that names its own wood, and with a
   style that overrules the token in its own `vars`. The computed value is read
   only when neither of those can answer — a desk with its own wood hands over
   a hex directly — and the result is cached on both, so an ordinary render
   does no work at all. Never duplicate the default as a constant here: the
   stylesheet owns it, and two copies drift. */
let BARKEY = null, BARMETA;
function paintStatusBar(frame, wood){
  const key = (wood||'') + '|' + ((S.look&&S.look.style)||'');
  if(key === BARKEY) return;
  BARKEY = key;
  const c = (wood || getComputedStyle(frame).getPropertyValue('--wood') || '').trim();
  if(!c) return;
  BARMETA = BARMETA || document.querySelector('meta[name="theme-color"]');
  if(BARMETA) BARMETA.setAttribute('content', c);
}

function render(){
  if(soonId){ cancelAnimationFrame(soonId); soonId=0; }
  const frame=$('#frame');
  const wasKey=SCROLL.key, wasEl=$('#app .scroll');
  if(wasEl) SCROLL.top=wasEl.scrollTop;
  /* Written wholesale, so anything else living on this element has to be
     restated here or it is wiped by the next render — which for `tilting` meant
     the cavity worked until you ticked something and then silently stopped.
     It is stated off `S.look` rather than asked of motion.js, because a class
     on the frame is a fact about the desk and not about the sensor's mood.
     See decision 108. */
  frame.className = (S.device==='desk' ? 'is-desk' : 'is-phone')
    + (S.device==='desk' ? '' : tiltClasses());
  document.documentElement.dataset.theme = themeNow();
  applyLook();          // the custom colours are per theme, so repaint them
  /* The wood is per desk, and it is the whole carcass rather than the rail: the
     strip above the bar, the bar, the reveal and the drawer are one piece of
     furniture, so the token goes on the frame and everything made of it
     follows. `--wood-2` derives from it in CSS, so the shaded edge comes too. */
  const wood = (cfgOf(deskHere())||{}).wood;
  if(wood) frame.style.setProperty('--wood', wood); else frame.style.removeProperty('--wood');
  paintStatusBar(frame, wood);
  // settings stopped being a view in v35; an old snapshot may still name it
  if(S.view==='settings') S.view='desk';
  const placed = PLACED.n;      // ensureBox() may invent boxes as this builds
  $('#app').innerHTML = viewHTML();
  const key=viewKey(), now=$('#app .scroll');
  if(key!==wasKey) SCROLL.top=0;
  /* Only when there is something to restore. Writing `scrollTop` on an element
     that was inserted a moment ago forces the browser to lay the whole board
     out then and there so it can work out the scroll range — nine milliseconds
     of every render, to put a scroller back to the top it already starts at. A
     phone board never scrolls at all (`overflow:hidden`, and the pages are the
     scrolling), and a board you have just navigated to starts at zero, so the
     write is skipped in both of the common cases and the layout happens once,
     where it belongs: at paint. */
  if(now && SCROLL.top) now.scrollTop=SCROLL.top;
  SCROLL.key=key;
  bindSortables();
  sizeGrid();
  repositionPanel();   // a bubble is pinned to a tile, and the tiles just moved
  /* A render is not a change. Every mutation already says `save()` for itself,
     so all this has to catch is the one thing a *render* writes — a box
     invented by ensureBox() for an object seen in a layout for the first time.
     It used to save unconditionally, which at three thousand objects meant
     35ms of serialising an unchanged desk every 250ms while you dragged.
     See decision 64. */
  if(PLACED.n!==placed) save(); else saveIfDirty();
}

/* The graph-paper backdrop in arrange mode has to match the real column width,
   which is fluid — so measure it after layout rather than assuming it. */
/* Measure the real column width and make the rows match it, so every cell is a
   square. Runs after each render and on resize; if the measurement changes the
   cached cell size, re-render so row counts and drag maths agree with it. */
let sizing=false;
function sizeGrid(){
  const grid=$('#drawergrid'); if(!grid) return;
  const g=gridOf(), w=cellW(grid,g);
  if(!(w>0)) return;
  /* The cell is **square**: the row height is the measured column width, on
     both devices. It was briefly the board divided by a stated fourteen rows,
     which made a page the same shape on every handset and a cell a third taller
     than it was wide — the wrong trade, because a square cell is what makes a
     stated size mean anything.

     So the free number is the row *count*, and it is a floor: however many
     whole cells fit between the bar and the shelf. `ceil` was what made the
     bottom row hang half a cell past the shelf and forced the board to scroll
     to reach it. Zero on a Mac: a desk scrolls. */
  /* How many rows fit, measured from the room the board actually has: the whole
     column, less the bar, less the gap that lets the bar breathe, less the rail
     along the bottom. It used to divide the scroller's own height, which worked
     only while the scroller was the thing absorbing the leftover — and that put
     the spare pixels *above* the board, which is a dead strip under the title.
     The scroller is the height of its rows now (`flex:0 0 auto`).

     Both the gap and the rail have a **minimum**, and the pixels the whole rows
     leave over are split between them — so the board is a surface set into the
     carcass with an even reveal above and below, and the column adds up exactly:
     bar + gap + rows×cell + rail = the screen. Giving the whole leftover to one
     of them was tried both ways round and neither survives a screen whose height
     divides badly: all of it below is a drawer front the depth of two rows, and
     all of it above is the dead strip under the title that decision 44 spent a
     version getting rid of. Half each is at most half a cell of either.

     The safe-area inset rides inside the rail's own minimum, which is what
     keeps the last row of the board clear of the curve of the screen. */
  /* Two numbers are measured and everything else is derived from them: how wide
     a board is, and how much vertical room it has. Boards differ from one
     another only in how many columns they cut that width into, so the cell and
     the row count of a board that is nowhere near the screen — a pager pane, the
     drawer you are about to drop something into — are arithmetic rather than
     another measurement. See decision 60. */
  const sc=grid.parentElement, main=grid.closest('.main');
  const cid = grid.dataset.gridfor || ROOT;
  if(dev()==='phone' && main){
    const bar=main.querySelector('.gridbar'), rail=main.querySelector('.deskrail');
    const barH = bar ? bar.getBoundingClientRect().height : 0;
    // read the floor, not the margin — the margin is what this writes
    const gapMin = parseFloat(getComputedStyle(sc).getPropertyValue('--gapmin'))||0;
    const railMin = rail ? (parseFloat(getComputedStyle(rail).minHeight)||0) : 0;
    const room = main.clientHeight - barH - gapMin - railMin;
    const boardW = w * g.cols;
    const was = pageRows('phone', cid);
    if(MEASURE.phone.room!==room || Math.abs(MEASURE.phone.w-boardW)>0.5){
      MEASURE.phone.room=room; MEASURE.phone.w=boardW;
    }
    const rows=pageRows('phone', cid);
    if(rows!==was && !sizing){ sizing=true; try{ render(); } finally { sizing=false; } return; }
    /* Written only when they have actually changed. The markup already carries
       last render's numbers (see REVEAL), so on an ordinary render these agree
       and nothing is touched — and a style write that changes nothing is still
       a style write, which dirties layout and buys the board a second one
       before it can be painted. Rendering was doing two layouts to draw one
       screen. */
    const over = Math.max(0, room - rows*w);
    const gap = gapMin + Math.floor(over/2), deep = railMin + Math.ceil(over/2);
    if(gap!==REVEAL.gap){ REVEAL.gap=gap; sc.style.marginTop = gap+'px'; }
    if(rail && deep!==REVEAL.rail){ REVEAL.rail=deep; rail.style.height = deep+'px'; }

  } else if(dev()!=='phone'){ MEASURE.desk.room=0; MEASURE.desk.w=w*g.cols; }
  /* Do NOT round. Columns are `1fr` and therefore fractional; rounding the row
     height to a whole pixel made rows and columns different sizes, and the
     error accumulated across the grid — a tile at column 16 sat ~7px from
     where the drag maths thought it was, which is why things far to the
     bottom-right were hardest to pick up. */
  const cell = w;
  /* Same again, and this is the one that mattered: gridOfContainer() builds the
     board from the *last* measurement, so on any render where the window has
     not moved the measurement agrees with what is already on the element and
     there is nothing to write. `--cellw` and `--cellstep` used to be written
     here too and were read by nobody — two style writes per render for a value
     no rule has ever asked for. */
  const same = CELL[dev()]===cell && COLW[dev()]===w;
  const changed = !sizing && Math.abs(CELL[dev()]-cell) > 0.25;
  if(!same){
    CELL[dev()]=cell; COLW[dev()]=w;
    grid.style.setProperty('--rowh', cell+'px');
    // a checker square is two cells each way — the same number now, but written
    // as two, because the two are measured separately and one may drift first
    grid.style.setProperty('--checkerx', 2*(w+g.gap)+'px');
    grid.style.setProperty('--checkery', 2*(cell+g.gap)+'px');
    grid.style.gridAutoRows = cell+'px';
    const rr=(grid.style.gridTemplateRows.match(/repeat\((\d+)/)||[])[1];
    if(rr) grid.style.gridTemplateRows=`repeat(${rr},${cell}px)`;
  }
  if(changed){ sizing=true; try{ render(); } finally { sizing=false; } }
}

export { render, renderSoon, sizeGrid, pageTop, reveal, deskMap, viewHTML, previewHTML,
  pageAt, pageCount, goPage, gridSizeField,
  settingsPanel, toggleSettings };
