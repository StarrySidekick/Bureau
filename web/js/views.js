import { $, esc, ic, D, md, ROOT } from './util.js';
import { S, K, T, byId, has, isContainer, containers, childrenOf, chainOf,
  deskTitle, rootObj, pinnedDrawers, isPinned, allTags, dev,
  layoutOf, takesTyping, genKindOf, CALVIEWS, calViewOf, calCols } from './model.js';
import { CELL, gridOf, cellW } from './grid.js';
import { themeNow, applyLook, lookVal, STYLES, PALETTES, paletteNow, BACKDROPS } from './look.js';
import { gridOfContainer, listTile, scrollEntry, bookView, calSpan } from './tiles.js';
import { openPanel, closePanel, panelKey, repositionPanel } from './panels.js';
import { APP_VERSION, save, storeSize, install } from './persist.js';

/* The desk is nothing but the grid. There is no toolbar: New, Arrange and
   Settings are control objects sitting on it, so the grid is the whole page. */
/* The bar every grid gets: where you are on the left, three icon buttons on the
   right. View, sort, settings — nothing else, and no labels. */
function gridBar(c){
  const trail = c.id===ROOT ? [] : chainOf(c.id);
  const view = c.layout || 'grid';
  const views = {grid:'grid', list:'list', scroll:'feather'};
  return `<div class="gridbar">
    <div class="where">
      ${c.id===ROOT ? `<span class="here">${esc(deskTitle())}</span>` :
        `<button class="iconbtn" data-act="back" title="Back">${ic('chevL',17)}</button>
         <span class="trail"><b data-view="desk">Desk</b>${
           trail.map((x,i)=>` ${ic('chevR',9)} ${i===trail.length-1
             ? `<span class="here">${esc(x.title)}</span>`
             : `<b data-drawer="${x.id}">${esc(x.title)}</b>`}`).join('')}</span>`}
      ${has(c,'magic')?`<span class="magicmark big" title="Collects by rule">${ic('sparkle',14)}</span>`:''}
      ${c.locked?`<span class="lockmark" title="Locked — nothing moves">${ic('lock',13)}</span>`:''}
    </div>
    ${S.device==='desk' ? pinbar('bar') : ''}
    <div class="bartools">
      <button class="sqbtn" data-act="cycleview" data-id="${c.id}" title="View: ${view}">${ic(views[view]||'grid',16)}</button>
      <button class="sqbtn" data-act="sortmenu" data-id="${c.id}" title="Sort">${ic('sort',16)}</button>
      <button class="sqbtn" data-act="randomone" data-id="${c.id}" title="Add something at random (testing)">${ic('sparkle',16)}</button>
      ${c.id===ROOT?'':`<button class="sqbtn${isPinned(c.id)?' on':''}" data-act="pin" data-id="${c.id}"
        title="${isPinned(c.id)?'Take off the bar':'Pin to the bar'}">${ic('star',16)}</button>`}
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
      ${list.slice(0,cap).map(x=>`<span class="mitem${x.done?' done':''}" style="--k:${K(x.kind).c}"
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
        style="left:${p.x}px;top:${p.lane*44+46}px;--k:${K(p.o.kind).c}">
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
      ${kinds.map(k=>`<button class="fchip${S.kindFilter===k?' on':''}" data-kind="${k}" style="--k:${K(k).c}">${K(k).nm}</button>`).join('')}
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
    <div class="section-h"><h2>Appearance</h2><div class="rule"></div></div>
    <div class="filterbar">
      ${[['auto','Match system'],['paper','Paper'],['walnut','Walnut']].map(([v,n])=>
        `<button class="fchip${S.theme===v?' on':''}" data-theme2="${v}">${n}</button>`).join('')}
    </div>

    <div class="field" style="margin-top:14px"><label>Background</label>
      <div class="pickgrid sw" style="margin-top:6px">${BACKDROPS.map(([c,nm])=>
        `<button data-look="bg" data-val="${c}" title="${nm}" class="${(lookVal('bg')||'')===c?'on':''}" style="background:${c}"></button>`).join('')}</div>
      <label class="custcol"><input type="color" data-lookinput="bg" value="${lookVal('bg')||'#E9E1CC'}"><span>Custom background</span></label>
      ${lookVal('bg')?`<button class="pill" style="margin-left:6px" data-look="bg" data-val="">Reset</button>`:''}
    </div>

    <div class="field" style="margin-top:14px"><label>Style</label>
      <div class="stylegrid">${Object.entries(STYLES).map(([k,st])=>
        `<button class="styletile${(S.look.style||'victorian')===k?' on':''}" data-style3="${k}">
          <span class="stpv st-${k}"></span><b>${st.nm}</b><i>${st.ds}</i></button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">A style sets everything at once — palette, board, knobs, borders, type. Every control below still works afterwards.</div>
    </div>

    <div class="field" style="margin-top:12px"><label>Palette</label>
      <div class="filterbar" style="flex-wrap:wrap;padding-top:6px">${Object.entries(PALETTES).map(([k,p])=>
        `<button class="fchip${((S.look.palette||'workshop')===k)?' on':''}" data-palette="${k}">${p.nm}</button>`).join('')}</div>
      <div class="pickgrid sw" style="margin-top:8px;pointer-events:none">${paletteNow().cols.map(c=>
        `<button style="background:${c}"></button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Every colour choice and every random one comes from here.</div>
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
/* `where` is 'bar' — riding in the grid bar beside the desk name, on a Mac —
   or 'foot', the bottom bar on a phone. Exactly one is rendered. */
function pinbar(where){
  const pins=pinnedDrawers();
  if(!pins.length) return '';
  const here = id => S.view==='drawer' && S.drawerId===id;
  /* Each pin is a little drawer front: a rectangle in the drawer's own colour,
     light text on it, and a knob — the same language as the tiles on the desk,
     so what's on the bar reads as the thing it opens. The desk itself isn't a
     drawer and doesn't pretend to be one. */
  return `<nav class="pinbar pin-${where}">
    <button class="pinbtn home${S.view==='desk'?' on':''}" data-view="desk" title="${esc(deskTitle())}">
      <i class="pinface">${ic('grid',12)}</i><span>Desk</span></button>
    ${pins.map(d=>`<button class="pinbtn${here(d.id)?' on':''}${has(d,'magic')?' magic':''}"
        data-drawer="${d.id}" style="--c:${d.c||K(d.kind).c}" title="${esc(d.title||'Untitled')}">
      <i class="pinface">${has(d,'magic')?ic('sparkle',11):'<b class="pinknob"></b>'}</i>
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

function render(){
  const frame=$('#frame');
  const wasKey=SCROLL.key, wasEl=$('#app .scroll');
  if(wasEl) SCROLL.top=wasEl.scrollTop;
  frame.className = S.device==='desk' ? 'is-desk' : 'is-phone';
  document.documentElement.dataset.theme = themeNow();
  applyLook();          // the custom colours are per theme, so repaint them
  // settings stopped being a view in v35; an old snapshot may still name it
  if(S.view==='settings') S.view='desk';
  const body = S.view==='drawer' ? viewDrawer()
             : viewDesk();          // the desk is the only other place there is
  // No sidebar and no tabs: the desk is the navigation. Drawers are on it, the
  // pinned ones are one tap away, ⌘K finds anything, the breadcrumb walks up.
  // On a Mac the pins ride in the grid bar (see gridBar); on a phone they get
  // the bottom bar, which is the one place a thumb reaches.
  $('#app').innerHTML = `<div class="main">${body}${S.device==='phone'?pinbar('foot'):''}</div>`;
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

export { render, sizeGrid, settingsPanel, toggleSettings };
