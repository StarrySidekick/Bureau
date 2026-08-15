import { $, esc, ic, D, md, clamp, ROOT } from './util.js';
import { S, K, T, byId, has, isContainer, containers, childrenOf, chainOf,
  deskTitle, rootObj, shelfDrawers, pinnedDrawers, isPinned, allTags, dev,
  sortOf, SORTS, MANUAL, sortMark,
  layoutOf, takesTyping, genKindOf, CALVIEWS, calViewOf, calCols } from './model.js';
import { CELL, PAGEROWS, pageRows, pageOfBox, lastPage, lay, gridOf, cellW } from './grid.js';
import { themeNow, applyLook, lookVal, STYLES, BACKDROPS,
  palNow, setSlot, styleNow, hexOf, objColour, slotName, OBJ0 } from './look.js';
import { gridOfContainer, listTile, scrollEntry, bookView, calSpan } from './tiles.js';
import { openPanel, closePanel, panelKey, repositionPanel } from './panels.js';
import { tiltOn } from './motion.js';
import { APP_VERSION, DATA_V, save, storeSize, install } from './persist.js';

/* The desk is nothing but the grid. There is no toolbar: New, Arrange and
   Settings are control objects sitting on it, so the grid is the whole page. */
/* ---- the top shelf ------------------------------------------------------
   Where you are on the left, the tools on the right, and on a Mac whatever is
   pinned in between. Every tool is a toggle you press rather than a menu you
   open: the view cycles, the sort cycles through its seven and *says which one*
   in one glyph, and the lock is a lock that is open or shut. A phone has no
   room for a popup that asks a question you could have answered by pressing
   the button again. */
const SORTLABEL = k => k===MANUAL ? 'As I arranged them' : SORTS[k][0];
function sortButton(c){
  const cur = sortOf(c) || MANUAL;
  const mark = cur===MANUAL
    ? `<b class="sortletter">M</b>`
    : /^arrow/.test(sortMark(cur)) ? ic(sortMark(cur),16) : `<b class="sortletter">${sortMark(cur)}</b>`;
  return `<button class="sqbtn${cur!==MANUAL?' on':''}" data-act="sortnext" data-id="${c.id}"
    title="Sorted: ${esc(SORTLABEL(cur))} — tap for the next">${mark}</button>`;
}
function gridBar(c){
  const trail = c.id===ROOT ? [] : chainOf(c.id);
  const view = c.layout || 'grid';
  const views = {grid:'grid', list:'list', scroll:'feather'};
  const pages = pageCount(c.id);
  return `<div class="gridbar shelf shelf-top">
    <div class="where">
      ${c.id===ROOT ? `<span class="here">${esc(deskTitle())}</span>` :
        `<button class="iconbtn" data-act="back" title="Back">${ic('chevL',17)}</button>
         <span class="trail"><b data-view="desk">Desk</b>${
           trail.map((x,i)=>` ${ic('chevR',9)} ${i===trail.length-1
             ? `<span class="here">${esc(x.title)}</span>`
             : `<b data-drawer="${x.id}">${esc(x.title)}</b>`}`).join('')}</span>`}
      ${has(c,'magic')?`<span class="magicmark big" title="Collects by rule">${ic('sparkle',14)}</span>`:''}
      ${/* Dots while they fit; a count once they don't — nine dots is already
           more than you can aim at, and thirty is a texture. */''}
      ${pages>1?`<span class="pagemark" title="Two fingers up and down turn the page">${
        pages<=9
          ? [...Array(pages)].map((_,i)=>`<i class="${i===pageAt(c.id)?'on':''}" data-gopage="${i}"></i>`).join('')
          : `<b>${pageAt(c.id)+1}<u>/${pages}</u></b>`}</span>`:''}
    </div>
    ${/* A Mac has no bottom edge worth reserving, so both shelves ride up here
         — the top one first, then whatever is pinned to the bottom. */''}
    ${shelfStrip('top')}${S.device==='desk' ? shelfStrip('bottom') : ''}
    <div class="bartools">
      <button class="sqbtn" data-act="cycleview" data-id="${c.id}" title="View: ${view}">${ic(views[view]||'grid',16)}</button>
      ${sortButton(c)}
      ${/* a phone has no right button and no room for an arrange mode, so the
           lock is a button. Locked refuses moves and resizes; the long press
           still opens the menu either way. */''}
      <button class="sqbtn${c.locked?' on locked':''}" data-act="togglelock" data-id="${c.id}"
        title="${c.locked?'Locked — tap to unlock':'Unlocked — tap to lock'}">${ic(c.locked?'lock':'unlock',16)}</button>
      <button class="sqbtn" data-act="randomone" data-id="${c.id}" title="Add something at random (testing)">${ic('sparkle',16)}</button>
      ${c.id===ROOT?'':`<button class="sqbtn${isPinned(c.id)?' on':''}" data-act="pin" data-id="${c.id}"
        title="${isPinned(c.id)?'Take off the shelf':'Pin to the bottom shelf'}">${ic('star',16)}</button>`}
      <button class="sqbtn" data-act="${c.id===ROOT?'appsettings':'drawersettings'}" data-id="${c.id}" title="Settings">${ic('gear',16)}</button>
    </div>
  </div>`;
}

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
        : `<div class="listgrid">${items.map(listTile).join('')}</div>`}
    </div>`;
  }
  // the bar sits above the scroller, not inside it — it carries the pins now,
  // and navigation that scrolls away is navigation you can't reach
  return `
  ${gridBar(c)}
  <div class="scroll deskscroll">
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
  const byDay={};
  items.forEach(x=>{ if(x.due) (byDay[x.due]=byDay[x.due]||[]).push(x); });
  const {from, to, month} = calSpan(d, anchor, view);
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
    return head + dayPanel(d, iso, byDay[iso]||[], true);
  }
  const cells=[];
  for(let dt=new Date(from); dt<=to; dt=D.add(dt,1)){
    if(!cols.includes(dt.getDay())) continue;
    const iso=D.iso(dt), list=byDay[iso]||[];
    cells.push(`<div class="mcell${month!=null&&dt.getMonth()!==month?' out':''}${
        iso===T?' today':''}${iso===S.calDay?' sel':''}" data-calday="${d.id}:${iso}">
      <b>${dt.getDate()}</b>
      ${list.slice(0,cap).map(x=>`<span class="mitem${x.done?' done':''}" style="--k:${objColour(x)}"
        data-row="${x.id}" title="${esc(x.title||'Untitled')}">${esc(x.title||'Untitled')}</span>`).join('')}
      ${list.length>cap?`<u>+${list.length-cap} more</u>`:''}
    </div>`);
  }
  const sel=S.calDay;
  return `${head}
  <div class="monthgrid cal-${view}" style="--dcols:${cols.length}">
    ${cols.map(n=>`<i class="dow">${DOWNAME[n]}</i>`).join('')}
    ${cells.join('')}
  </div>
  ${sel?dayPanel(d, sel, byDay[sel]||[]):''}`;
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
  const min=D.parse(dated[0].iso), max=D.parse(dated[dated.length-1].iso);
  const at = iso => Math.round((D.parse(iso)-min)/86400000)*zoom;
  const LANE=136, laneEnd=[];
  const placed=dated.map(({o,iso})=>{
    const x=at(iso);
    let lane=0; while(laneEnd[lane]!=null && x<laneEnd[lane]) lane++;
    laneEnd[lane]=x+LANE;
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
    ${placed.map(p=>`<span class="tlitem${p.o.done?' done':''}" data-row="${p.o.id}"
        style="left:${p.x}px;top:${p.lane*44+46}px;--k:${objColour(p.o)}">
        <i class="tldot"></i>
        <b>${esc(p.o.title||'Untitled')}</b>
        <u>${esc(D.short(p.iso))}</u></span>`).join('')}
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
  <div class="scroll${view==='grid'?' deskscroll':''}">
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
          : `<div class="listgrid">${items.map(o=>listTile(o)).join('')}</div>`}
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
const installed = ()=> window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone;

function settingsPanel(){
  openPanel({key:'settings', title:'Settings',
    sub:`Bureau ${APP_VERSION} · ${installed()?'installed':'in a browser tab'}`,
    body:settingsBody});
}
function toggleSettings(){ panelKey()==='settings' ? closePanel() : settingsPanel(); }

function settingsBody(){
  const standalone = installed();
  return `
    <div class="section-h"><h2>Version</h2><div class="rule"></div></div>
    <div class="statline">
      <div class="s"><b>${esc(APP_VERSION)}</b>Bureau</div>
      <div class="s"><b>${DATA_V}</b>data format</div>
      <div class="s"><b>${standalone?'Installed':'Browser'}</b>running as</div>
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">An installed copy serves itself from its own cache, so it can be a version behind until its second launch. This is the one that is running right now.</div>

    <div class="section-h"><h2>Style</h2><div class="rule"></div></div>
    <div class="stylegrid">${Object.entries(STYLES).map(([k,st])=>
      `<button class="styletile${(S.look.style||'victorian')===k?' on':''}" data-style3="${k}">
        <span class="stpv" style="background:${st.cols[0]};border-color:${st.cols[2]}">${
          [3,5,6,9,11,12].map(i=>`<i style="background:${st.cols[i]}"></i>`).join('')}</span>
        <b>${st.nm}</b><i>${st.ds}</i></button>`).join('')}</div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">A style is sixteen colours, a board, a typeface, and the defaults new drawers are born with — including whether the desk is light or dark. Everything below still works afterwards.</div>

    <div class="field" style="margin-top:14px"><label>What ${esc(styleNow().nm)} is made of</label>
      <div class="mini" style="--k:var(--brass);margin:2px 0 8px">The first five dress the app itself. The other eleven are what drawers and objects are painted in. A slot is a <b>position</b>, not a colour: a drawer holds slot 11, and slot 11 is a claret here and a deep sea blue in Aero. Changing style swaps every tile to that style's answer; changing back puts each one exactly where it was.</div>
      ${[[0,OBJ0,'chrome'],[OBJ0,16,'']].map(([a,b,cls])=>
        `<div class="slotgrid ${cls}">${palNow().slice(a,b).map((c,n)=>{
          const i=a+n;
          return `<label class="slot${cls?' chrome':''}" title="${slotName(i)}">
            <b style="background:${c}"><input type="color" data-slot="${i}" value="${c}"></b>
            <span>${slotName(i)}</span></label>`;}).join('')}</div>`).join('')}
      ${(S.look.slots&&S.look.slots[S.look.style||'victorian'])
        ? `<button class="pill" style="margin-top:8px" data-act="resetslots">${ic('undo',13)} Back to ${esc(styleNow().nm)}&rsquo;s own sixteen</button>` : ''}
    </div>

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
        return `<button data-look="board" data-val="${v}" title="${nm}" class="${((S.look.board||'')===v)?'on':''}"
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


    <div class="field" style="margin-top:12px"><label>Holographic light</label>
      <button class="pill${tiltOn()?' solid':''}" data-act="tilt">${ic('sparkle',13)} ${
        tiltOn() ? 'Following how this device moves' : 'Let Bureau feel the device move'}</button>
      <div class="mini" style="--k:var(--brass);margin-top:6px">A magic drawer is foil rather than paint, so it needs to know where the light is coming from. On a Mac that is wherever the pointer is and this button changes nothing. On an iPhone it is how you tilt it, which iOS will only tell an app that asks — and it will only let it ask from a button like this one.</div>
    </div>

    <div class="section-h"><h2>Drawer layouts</h2><div class="rule"></div></div>
    <div class="mini" style="--k:var(--brass)">Each device keeps its own arrangement. You can open the other one to tidy it from here.</div>
    <div class="filterbar">
      ${[['','This device ('+(S.device==='desk'?'Mac':'iPhone')+')'],['desk','Arrange Mac layout'],['phone','Arrange iPhone layout']].map(([v,n])=>
        `<button class="fchip${(S.layoutEdit||'')===v?' on':''}" data-layout="${v}">${n}</button>`).join('')}
    </div>

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
    <div class="mini" style="--k:var(--brass);margin-top:6px">Everything lives on this device only. Export moves a desk between devices by hand — real sync comes later.</div>

    ${install.deferred?`<div class="section-h"><h2>Install</h2><div class="rule"></div></div>
      <button class="pill solid" data-act="install">${ic('plus',13)} Install Bureau</button>`:''}
    ${(!standalone && /iPad|iPhone|iPod/.test(navigator.userAgent))?`
      <div class="section-h"><h2>Install</h2><div class="rule"></div></div>
      <div class="mini" style="--k:var(--brass)">Share → <b style="margin:0 3px">Add to Home Screen</b> to keep Bureau in your dock and run it full screen.</div>`:''}

    <div class="section-h"><h2>Paste objects</h2><div class="rule"></div></div>
    <div class="mini" style="--k:var(--brass)">Describe what you want somewhere that can write JSON, paste it here, and it lands on the desk. Types are matched by name, anything missing gets a sensible default, and a container's <b>children</b> go inside it.</div>
    <textarea id="pastebox" class="editor" style="min-height:130px;margin-top:8px"
      placeholder='[{"type":"drawer","title":"Lisbon","children":[{"type":"task","title":"Book the flight","due":"2026-09-02"}]}]'></textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button class="pill solid" data-act="pastego">${ic('plus',13)} Add to the desk</button>
      <button class="pill" data-act="pasteschema">${ic('help',13)} What it accepts</button>
    </div>

    <div class="section-h"><h2>Testing</h2><div class="rule"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pill" data-act="randomten">${ic('sparkle',13)} Add ten at random</button>
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">The sparkle in the bar adds one. Both drop objects of random kinds, sizes and colours, for seeing how the grid copes.</div>

    <div class="section-h"><h2>Start over</h2><div class="rule"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pill" data-act="reseed">Reset to the sample desk</button>
      <button class="pill" data-act="wipe" style="color:#C0563F">Erase everything</button>
    </div>
    <div style="height:20px"></div>`;
}

/* ============================================================
   13 · the pin bar — the only navigation there is
   ============================================================
   There used to be four fixed tabs here: Desk, Today, Keeping Up, Everything.
   Three of them were aggregations, which is precisely what a magic drawer
   does, so they were three hard-coded answers to a question the app already
   lets you ask yourself. They are gone. What is on the bar is now whatever
   drawers you pinned — the same strip on both devices, along the top on a Mac
   and along the bottom on a phone. See decision 22.

   With nothing pinned the bar isn't drawn at all, so a desk you haven't
   customised stays what decision 14 wanted: nothing but grid. */
/* One renderer for both shelves. `where` is 'top' or 'bottom'.

   On a Mac both are drawn inside the grid bar, because a desk has no bottom
   edge worth reserving; on a phone the top shelf rides in the grid bar and the
   bottom one is its own strip along the bottom, which is the half of the screen
   a thumb reaches.

   A pin is a **square** now, the same square as the tools above it, in the
   drawer's own colour with its mark on it. It used to be a little drawer front
   with a name under it, which meant five of them across a phone gave each one
   78px and "Done & Dusted" fitted in none of them. A square and a bigger mark
   say which drawer it is from further away than eight-point type ever did. */
function shelfStrip(where){
  const pins=shelfDrawers(where);
  const home = where==='bottom' || S.device==='desk';
  if(!pins.length && !(home && S.device!=='desk')) return '';
  const here = id => S.view==='drawer' && S.drawerId===id;
  return `<nav class="shelf shelf-${where} pinbar" data-shelf="${where}">
    ${home && S.device!=='desk'
      ? `<button class="pinbtn home${S.view==='desk'?' on':''}" data-view="desk" title="${esc(deskTitle())}">
           <i class="pinface">${ic('grid',20)}</i></button>` : ''}
    ${pins.map(d=>`<button class="pinbtn${here(d.id)?' on':''}${has(d,'magic')?' magic':''}"
        data-drawer="${d.id}" style="--c:${objColour(d)}" title="${esc(d.title||'Untitled')}">
      <i class="pinface">${ic(has(d,'magic')?'sparkle':K(d.kind).ic, 20)}</i>
      <span>${esc(d.title||'Untitled')}</span></button>`).join('')}
  </nav>`;
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
const pageCount = cid => lastPage(dev(), cid) + (pageRows() ? 2 : 1);
const pageAt = cid => Math.min(PAGE[cid]||0, pageCount(cid)-1);
function goPage(cid, n){
  const p = clamp(n, 0, pageCount(cid)-1);
  if(p === pageAt(cid)) return false;
  PAGE[cid]=p; render(); return true;
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
  if(o && pageRows()){
    const cid = o.parent||ROOT;
    if(S.view==='drawer' ? S.drawerId===cid : cid===ROOT) goPage(cid, pageOfBox(lay(o), dev()));
  }
  const el=document.querySelector(`#app .grid .drawer[data-row="${id}"],#app .grid .drawer[data-drawer="${id}"]`);
  const sc=$('#app .scroll');
  if(el){ el.classList.add('justmade'); setTimeout(()=>el.classList.remove('justmade'), 1200); }
  if(!el || !sc) return;
  const er=el.getBoundingClientRect(), sr=sc.getBoundingClientRect();
  if(er.top < sr.top+8 || er.bottom > sr.bottom-8){
    sc.scrollTop += (er.top - sr.top) - Math.max(12, (sr.height - er.height)/3);
    SCROLL.top = sc.scrollTop;
  }
}

/* The whole of what `#app` holds, as a string, for wherever S says you are.
   No sidebar and no tabs: the desk is the navigation. Drawers are on it, the
   pinned ones are one tap away, ⌘K finds anything, the breadcrumb walks up.
   On a Mac the pins ride in the grid bar (see gridBar); on a phone they get
   the bottom bar, which is the one place a thumb reaches — and there it is a
   real flex child of .main rather than something floating over the board,
   which is what makes the board end exactly where the shelf begins with
   nothing to scroll past. */
function viewHTML(){
  const body = S.view==='drawer' ? viewDrawer()
             : viewDesk();          // the desk is the only other place there is
  return `<div class="main">${body}${S.device==='phone'?shelfStrip('bottom'):''}</div>`;
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

function render(){
  const frame=$('#frame');
  const wasKey=SCROLL.key, wasEl=$('#app .scroll');
  if(wasEl) SCROLL.top=wasEl.scrollTop;
  frame.className = S.device==='desk' ? 'is-desk' : 'is-phone';
  document.documentElement.dataset.theme = themeNow();
  applyLook();          // the custom colours are per theme, so repaint them
  // settings stopped being a view in v35; an old snapshot may still name it
  if(S.view==='settings') S.view='desk';
  $('#app').innerHTML = viewHTML();
  const key=viewKey(), now=$('#app .scroll');
  if(key!==wasKey) SCROLL.top=0;
  if(now) now.scrollTop=SCROLL.top;
  SCROLL.key=key;
  bindSortables();
  sizeGrid();
  repositionPanel();   // a bubble is pinned to a tile, and the tiles just moved
  save();   // a save after every re-render, cheaply
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
  /* How many whole square cells fit between the two shelves. It has to be a
     *floor*: the old count was `ceil((innerHeight-140)/cell)`, which is why the
     bottom row hung half a cell past the bottom shelf and the board had to
     scroll to reach it. The cell is fixed by the width — eight fluid columns —
     so this is the only free number, and rounding it down is what makes the
     board end flush. Zero on a Mac: a desk scrolls. */
  const sc=grid.parentElement;
  if(dev()==='phone' && sc){
    const rows=Math.max(4, Math.floor(sc.clientHeight / Math.max(1,w)));
    if(rows!==PAGEROWS.phone){ PAGEROWS.phone=rows; if(!sizing){ sizing=true; try{ render(); } finally { sizing=false; } return; } }
  } else PAGEROWS.desk = 0;
  /* Do NOT round. Columns are `1fr` and therefore fractional; rounding the row
     height to a whole pixel made rows and columns different sizes, and the
     error accumulated across the grid — a tile at column 16 sat ~7px from
     where the drag maths thought it was, which is why things far to the
     bottom-right were hardest to pick up. */
  const cell=w;
  const changed = !sizing && Math.abs(CELL[dev()]-cell) > 0.25;
  CELL[dev()]=cell;
  grid.style.setProperty('--rowh', cell+'px');
  grid.style.setProperty('--cellw', (cell+g.gap)+'px');
  grid.style.setProperty('--cellstep', (cell+g.gap)+'px');
  // a checker square is two cells, so the board reads at the same scale
  grid.style.setProperty('--checker', 2*(cell+g.gap)+'px');
  grid.style.gridAutoRows = cell+'px';
  const rows=(grid.style.gridTemplateRows.match(/repeat\((\d+)/)||[])[1];
  if(rows) grid.style.gridTemplateRows=`repeat(${rows},${cell}px)`;
  if(changed){ sizing=true; try{ render(); } finally { sizing=false; } }
}

export { render, sizeGrid, reveal, shelfStrip, viewHTML, previewHTML,
  pageAt, pageCount, goPage,
  settingsPanel, toggleSettings };
