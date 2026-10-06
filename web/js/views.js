import { $, $$, esc, ic, D, md, clamp, ROOT } from './util.js';
import { S, K, T, byId, has, isContainer, containers, container, childrenOf, chainOf, stepOf,
  deskTitle, rootObj, cfgOf, deskIds, deskHere, deskOf, isDesk, allTags, dev,
  beginPass, endPass, inFront,
  layoutOf, takesTyping, genSaid, makesAnything, CALVIEWS, calViewOf, calCols, CL_FITS, clFit,
  spanOf, coversDay, lastDay, boardLocked,
  TILT_MODES, tiltMode, tiltsDesk, tiltsWindows, tiltClasses, cueFlipped,
  GRAVITIES, gravityMode, gravityOn,
  URGES, workday, searchHits, sortOf, SORT_FACES, MANUAL, STAMP_WORDS, STAMP_INKS, stampOf, stampInk, setting, setSetting, unsetSetting, envSync, benchHere, decidedBy, isBench, ENV_KEYS, ENV_NAMES } from './model.js';
import { sectionsOf, GRID, PHONE_GRIDS, CELL, COLW, MEASURE, sideways, colsOf, gridKeyOf, SHELVES, PAGES_MAX, shelvesOf,
  shelfRows, viewRows, shelfOfBox, shelfAt, setShelf, shelfOrigin, SHELF, drawCols, drawRows,
  lay, gridOf, cellW, ensureBox, PLACED, flows, columnOnly, byTile, rigidOn, rigidSwipe, padded, zoomOf, zoomRange, setZoom,
  isBoard, boardsOf, reachable, boardHolds, removeBoard, SPAN, startOf, DIM_MIN, DIM_MAX, DIM_MAX_H, VIEW_COLS, TILE, fitBoard, MARGIN, formOf, tilesOf } from './grid.js';
import { themeNow, applyLook, lookVal, STYLES, BACKDROPS, SURFACES, DARKMODES, darkMode, hasDark,
  palNow, styleNow, hexOf, objColour, slotName, OBJ0, CHECKS, dressAs, LOOKSIG, lookSig } from './look.js';
import { gridOfContainer, gridTile, listTile, boardVarsOf, bookView, calSpan, calFront } from './tiles.js';
import { gravitySync } from './gravity.js';
import { openPanel, closePanel, panelKey, repositionPanel, plansPanel, boardRow, objectPanelBody, objBackTo, sampleTile } from './panels.js';
import { openGuide } from './guide.js';
/* Cyclic at *function* level only — motion.js imports render() from here and
   this imports sprayAt() from there, and neither is called while the modules
   are loading. That is the graph the app already has; keep it that way. */
import { sprayAt, SPRAYS, sprayNow, sprayMark, hopIntoCollector , applyZoom, zoomOut, zoomedIn, CAM_DIMS } from './motion.js';
import { APP_VERSION, DATA_V, save, saveIfDirty, storeSize, install, aiCfg } from './persist.js';
import { AI_MODELS, modelOf } from './ai.js';
import { TOOLART } from './active.js';
import { holdsFinger } from './gestures.js';

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
/* A Tag on the desk has no name of its own — its face prints the tag it
   collects (decision 202) — so an untitled board that collects a tag is
   called by it rather than "Untitled". */
const boardName = o => !o || o.id===ROOT ? deskTitle()
  : (o.title || ((o.filter||{}).tag ? '#'+o.filter.tag : '') || 'Untitled');

/* The name at the top left is the way to every other desk. Desks are not on
   the shelf any more — they are laid out in space, walked sideways with a
   swipe — so the one thing that has to exist is a way of seeing the whole row
   at once and jumping. That is this: press where you are, and every desk opens
   out, drawn small. See decision 41. */
/* **Inside a container the bar says which one, and nothing else.** It was a
   trail — a chevron back, then "Tombo's Desk › Untitled" — which restated the
   home desk on every board you were not on and spent a button on the way up
   that the knob along the bottom already is. So the name at the top left is
   the board you are standing on, in the place the desk's own name stands on
   the desk, and the knob is the way out. */
function gridBar(c){
  const sh = shelvesOf(c.id), at = shelfAt(c.id);
  /* The name is a name (decision 227): the map it opened is the zoom now. */
  const deskBtn = (label)=>`<b class="deskname">${esc(label)}</b>`;
  /* **The lip names the section you are in** (decision 304), and the name
     opens the board's contents. Decision 227 had it open nothing once the map
     became the zoom; a board with headings has a list worth opening, so on
     one it does, and on any other it still opens nothing. The section is
     patched in place as you scroll (`litSection()`), never rendered. */
  const secs = sectionsOf(c.id);
  const secAt = secs.length ? (LIPSEC.cid===c.id && LIPSEC.name) || '' : '';
  const secBtn = secs.length ? `<button class="lipsec" data-act="sections" data-id="${esc(c.id)}" title="Contents">${
      ic('chev',11)}<span class="secname">${esc(secAt)}</span></button>` : '';
  const where = `    <div class="where">
      ${/* A container is as many boards as you make of it now (decision
           219), so its name opens the same map the desk's does. */''}
      <span class="here"${secs.length?` data-act="sections" data-id="${esc(c.id)}"`:''}>${deskBtn(boardName(c))}</span>${secBtn}
      ${has(c,'magic')?`<span class="magicmark big" title="Collects by rule">${ic('sparkle',14)}</span>`:''}
      ${/* The dots are the **shelves of this board**, laid out the way they
           actually are, with the one you are standing on lit. A row of dots
           was right when the desks were a row; nine shelves are a square, and
           a square of nine dots is a map you can aim at rather than a count
           you have to translate. It only says anything when there is more than
           one shelf, which on a Mac — where the whole row is on the screen at
           once — means the two rows you are not looking at. Pressing one goes
           there. See decision 141. */''}
    </div>`;
  const lockBtn = `<button class="sqbtn${boardLocked()?' on locked':''}" data-act="togglelock"
        title="${boardLocked()?'Everything is locked — tap to unlock':'Everything is unlocked — tap to lock'}">${ic(boardLocked()?'lock':'unlock',16)}</button>`;
  const tools = `    <div class="bartools">
      ${/* The lock comes first, because it is the one that changes what every
           other gesture on the board means — and on a locked board it is the
           button you reach for before you can do anything else. A phone has no
           right button and no room for an arrange mode, so the lock is a
           button; locked refuses moves and resizes, and the long press still
           opens the menu either way. */''}
      ${/* One switch for every board there is, not one per board. See
           decision 74. */''}
      ${lockBtn}
      ${/* **Grid or list**, and only those two. How a board sorts itself is a
           thing you set once and live with — that is a row in its own editor —
           but which of the two ways of *looking* at it you want is something
           you change while you are working, which is what a tool is. It was a
           cycle through five layouts for a while and the third of them was
           Scroll, a list with nothing truncated: one more state to walk past
           to get back to the grid. Two states, one press. The other three
           (Book, Calendar, Timeline) are what a container *is* and stay in the
           editor. */''}
      <button class="sqbtn" data-act="togglelayout" data-id="${c.id}"
        title="${layoutOf(c)==='grid'?'On the grid — tap for a list':'A list — tap for the grid'}">${
        ic(layoutOf(c)==='grid'?'list':'grid',16)}</button>
      ${/* One of anything, wherever there is room. The spawner's own trick
           (`genKind: random`) with no spawner needed — which is what makes it
           worth a button: seeing what a type actually looks like on a board is
           the fastest way to find out that it doesn't. Same call either way,
           so the button and the tile cannot drift. */''}
      <button class="sqbtn" data-act="randomobject" data-id="${c.id}"
        title="Make one of anything, here">${ic('spiral',16)}</button>
      ${/* The star promoted a drawer into a desk of its own. There is one desk
           now and it is nine shelves wide, so what the star bought — room — is
           bought by putting the drawer on a shelf instead. See decision 141. */''}
      ${/* The brush was *this board's* editor, beside the gear. Since decision
           206 it is woven into the gear: the desk's editor is the first door
           of Settings, and a drawer's editor heads its Board settings. One
           button for "set this up", not two that had to be told apart. */''}
      ${/* …and the gear is the *app*, which is a different question. Inside a
           container the app has nothing to say that is not about the board,
           so there it opens Board settings directly. See decision 193. */''}
      <button class="sqbtn" data-act="appsettings" data-id="${c.id}"
        title="${c.id===ROOT?'Settings':'Board settings'}">${ic('gear',16)}</button>
    </div>`;
  /* **On a phone the bar is the drawer front** (decision 204). Everything that
     used to sit across the top of the screen rides in the rail along the
     bottom, either side of the knob, so the board starts under the status bar
     and the forty-odd pixels the bar took are a row of board instead: eight by
     fifteen on an installed iPhone where it was eight by fourteen. The bar is
     handed to `deskRail()` rather than drawn here, and the knob keeps the
     middle of the wood. */
  /* **The name is on the top lip** (decision 206): the strip of wood above
     the board carries where you are, and the drawer front keeps the tools.
     With *One more row* there is no strip to put it on, so it rides in the
     drawer front as it did. */
  if(S.device==='phone'){
    /* Tucked away (below), there is no lip: the board runs to the top. */
    const lip = S.look.rows !== 'fit' && !tucked();
    /* **Two a side round the knob, and each one is the thing it does**
       (decision 208, mirrored in 211). Left to right: a magnifying glass for
       the search, a letter block for the sort, the knob, the padlock, the
       gear. The list toggle went into the block's menu, because grid or list
       is a way of ordering what you look at; the spiral is on the Mac's bar
       and nowhere here. With *One more row* the name rides in the front ahead
       of the glass. */
    /* **Which tools, and which side, is the board's** (decision 220): up to
       three either side of the knob, from the six there are, and a flow can
       say. `railToolsOf()` is the one reader; the default is the four the
       front has carried since decision 211. */
    /* Brought here by a notepad in the front (decision 297): the way back,
       named for where you were. */
    const bt = S.backTo, back = bt && S.view==='drawer' && S.drawerId===bt.to
      ? `<button class="backpill" data-act="goback" title="Back to where you were">${ic('chevL',13)}<span>${
          esc(bt.view==='drawer' && bt.drawerId && byId(bt.drawerId) ? (byId(bt.drawerId).title||'Untitled') : boardName(rootObj()))}</span></button>` : '';
    /* **The gear is at the lip's right** (decision 302, Timothy: "the gear
       settings icon is just in the top right menu bar thing to make more room
       for other stuff in the void drawer"). The drawer front keeps its six
       places for the board's tools and things; the lip already says where
       you are, and what you can set about where you are sits beside it. With
       *One more row* there is no lip, so the gear rides in the front again,
       first on the right (`railSide()`). */
    const gear = lip ? `<span class="lipgear">${railObj('gear', 'appsettings', c.id, c.id===ROOT?'Settings':'Board settings')}</span>` : '';
    RAILBAR = {
      where: lip ? '' : where + back,
      left: railSide(c, 'left'),
      right: railSide(c, 'right', !lip)
    };
    return lip ? `<div class="toplip${UNTUCK.lip?' unfold':''}"${REVEAL.lip?` style="height:${REVEAL.lip}px"`:''}>${where}${back}${gear}</div>` : '';
  }
  return `<div class="gridbar shelf shelf-top">${where}${searchBtn(c)}${tools}</div>`;
}
/* ---- the tools in the drawer front — decision 220 ---------------------
   A board carries up to three each side of the knob, in the order it says.
   The glass, the block and the padlock are the front's own; the spool of
   thread, the spiral coin, the swipe switch and the stamp are there to be
   chosen, and each is also an object a board can hold (`TOOLART`, the tool
   rows of `ACTIVE`). **The gear is not one of them** since decision 302: it
   is on the top lip, on every board, so a `gear` still stored in a board's
   `rail` is passed over here rather than drawn twice. The Gear *object*
   (`tgear`) is still a thing you can put on a board. */
const RAIL_TOOLS = ['glass','block','lock','swipe','spool','stamp','pen','coin'];
const RAIL_NAMES = {glass:'Magnifying glass', block:'Letter block', lock:'Padlock',
  swipe:'Swipe switch', spool:'Spool of thread', stamp:'Rubber stamp', pen:'Fountain pen', coin:'Spiral coin'};
const RAIL_DEFAULT = {left:['glass','block'], right:['lock']};
function railToolsOf(cid){
  const r = (cfgOf(cid)||{}).rail;
  if(!r || typeof r!=='object') return {left:RAIL_DEFAULT.left.slice(), right:RAIL_DEFAULT.right.slice()};
  const seen = new Set();
  const side = list => (Array.isArray(list)?list:[]).filter(t=>RAIL_TOOLS.includes(t) && !seen.has(t) && seen.add(t)).slice(0,3);
  return {left:side(r.left), right:side(r.right)};
}
/* ---- six places, and anything can stand in one — decision 252 ---------
   Three either side of the knob. The board's tools come first, then whatever
   has been put there, each drawn as its one-by-one self; what is left over is
   an empty place, which is only shown while a tile is in your hand, because a
   drawer front with holes in it is a drawer front that looks unfinished. A
   thing always outranks a tool for a place: it is off the grid while it is
   there, and a front with no room left for it would lose it (the desk keeps
   its gear whatever, because it is the only way into Settings). */
const FRONT_SIDE = 3;
/* A thing in the desk's front marked `frontAll` stands in every board's
   front as well (decision 297), after that board's own. */
const frontThings = (cid, side)=> S.objects
  .filter(o=>o.front===side && inFront(o) && ((o.parent||ROOT)===cid || (o.frontAll && (o.parent||ROOT)===ROOT)))
  .sort((a,b)=>((a.frontAll?1:0)-(b.frontAll?1:0)) || (a.frontAt||0)-(b.frontAt||0));
function railSide(c, side, gearHere){
  /* No lip to stand on (*One more row*), so the gear comes back to the
     front, first on the right, and nothing standing there outranks it: it
     is the only way into Settings. */
  let tools = gearHere && side==='right' ? ['gear'].concat(railToolsOf(c.id)[side]) : railToolsOf(c.id)[side];
  /* A thing lent by the desk's front (`frontAll`, decision 297) takes only
     a place this board has left over: it never pushes out a board's own
     tool, or a drawer would lose its padlock to the desk's notepad. */
  const own = frontThings(c.id, side).filter(o=>(o.parent||ROOT)===c.id);
  const lent = frontThings(c.id, side).filter(o=>(o.parent||ROOT)!==c.id);
  const things = own.slice(0, FRONT_SIDE)
    .concat(lent.slice(0, Math.max(0, FRONT_SIDE - Math.min(FRONT_SIDE, own.length + tools.length))));
  if(tools.length + things.length > FRONT_SIDE){
    const keep = tools.includes('gear') ? ['gear'] : [];
    tools = keep.concat(tools.filter(t=>!keep.includes(t))).slice(0, Math.max(keep.length, FRONT_SIDE - things.length));
  }
  const free = Math.max(0, FRONT_SIDE - tools.length - things.length);
  return tools.map(t=>railTool(t, c)).join('') + things.map(railThing).join('')
    + `<span class="railslot" data-slot="${esc(c.id)}:${side}" aria-hidden="true"></span>`.repeat(free);
}
function railThing(o){
  const mini = Object.assign({}, o, {id:o.id+'~front', desk:{x:1,y:1,w:1,h:1}, phone:{x:1,y:1,w:1,h:1}});
  delete mini.front;
  const nm = o.title || K(o.kind).nm;
  // a span, not a button: a tile is very often a button itself, and a button
  // inside a button is closed early by the parser and spills the front apart
  return `<span class="railobj ro-thing" role="button" tabindex="0" data-act="frontpress" data-id="${esc(o.id)}"
    title="${esc(nm)} — tap as you would on the board, hold to take it out" aria-label="${esc(nm)}">${sampleTile(mini, 40, 40)}</span>`;
}
function railTool(t, c){
  if(t==='glass') return railObj('glass', 'searchopen', c.id, 'Search', searchOpen());
  if(t==='block') return railObj('block', 'sortcycle', c.id,
    `Sorted: ${(SORT_FACES[sortOf(c)||MANUAL]||SORT_FACES[MANUAL])[1]} — tap for the next, hold for line view`,
    false, sortOf(c)||MANUAL);
  if(t==='lock'){ const locked = boardLocked();
    return railObj(locked?'lock':'unlock', 'togglelock', '',
      locked?'Everything is locked — tap to unlock':'Everything is unlocked — tap to lock', locked); }
  if(t==='gear') return railObj('gear', 'appsettings', c.id, c.id===ROOT?'Settings':'Board settings');
  if(t==='spool') return railObj('spool', 'spool', c.id,
    S.threading ? 'Tying — press two things, or the spool to stop' : 'Spool of thread — press it, then two things to tie', !!S.threading);
  if(t==='coin') return railObj('coin', 'coinspin', c.id, 'Spiral coin — one of anything, anywhere on this board');
  // the pen asks Claude for this board (decision 306)
  if(t==='pen') return railObj('pen', 'askpen', c.id, c.id===ROOT ? 'Fountain pen: ask Claude to build a board' : 'Fountain pen: ask Claude to fill in this board');
  /* The stamp in a drawer front prints the board's word in the board's ink
     (`stampw`/`stampink` on the board, set beside this row). Decision 292. */
  if(t==='stamp'){ const st = stampOf(cfgOf(c.id)||{}), on = !!(S.stamping && S.stamping.from===c.id);
    return railObj('stamp', 'stamp', c.id, on ? `Inked: ${st.w}. Press things to stamp them, or the stamp to put it down`
      : `Rubber stamp: ${st.w}. Press it, then press things`, on, stampInk(st.ink)); }
  if(t==='swipe'){ const r = rigidOn();
    return railObj('swipe', 'swipetoggle', c.id, r ? 'Rigid swipe, a tile at a time — tap for a smooth scroll'
      : 'Smooth scroll — tap for a rigid swipe, a tile at a time', r, r); }
  return '';
}
/* The row in a board's settings that says which tools its drawer front
   carries: the six, once for each side, pressed on and off. A tool is on one
   side at most, so pressing it on one side takes it off the other. */
function railToolsField(cid){
  const rt = railToolsOf(cid);
  const side = (k, nm) => `<div class="railpick"><span class="mini" style="--k:var(--brass)">${nm}</span>
    <div class="filterbar">${RAIL_TOOLS.map(t=>
      `<button class="fchip railchip${rt[k].includes(t)?' on':''}" data-railtool="${cid}:${k}:${t}"
        title="${esc(RAIL_NAMES[t])}"><svg viewBox="0 0 40 40" aria-hidden="true">${
        (t==='lock'?TOOLART.lock(false):TOOLART[t](t==='block'?MANUAL:t==='swipe'?rigidOn():undefined))}</svg></button>`).join('')}</div></div>`;
  // what stands there besides the tools, each a press away from the board
  const things = ['left','right'].flatMap(k=>frontThings(cid, k)).filter(o=>(o.parent||ROOT)===cid);
  const stood = things.length ? `<div class="railpick"><span class="mini" style="--k:var(--brass)">Standing in it</span>
    <div class="filterbar">${things.map(o=>`<button class="fchip" data-act="frontout" data-id="${esc(o.id)}"
      title="Put it back on the board">${esc(o.title||K(o.kind).nm)} ${ic('x',11)}</button>`).join('')}</div></div>` : '';
  // the front's stamp says the board's word, chosen here (decision 292)
  const st = stampOf(cfgOf(cid)||{});
  const stamp = rt.left.concat(rt.right).includes('stamp') ? `<div class="railpick"><span class="mini" style="--k:var(--brass)">The stamp says</span>
    <div class="filterbar">${STAMP_WORDS.map(w=>`<button class="fchip${st.w===w?' on':''}" data-railstamp="${esc(cid)}:stampw:${w}">${w}</button>`).join('')}</div>
    <div class="filterbar">${Object.entries(STAMP_INKS).map(([k,[n,hex]])=>`<button class="fchip${st.ink===k?' on':''}" data-railstamp="${esc(cid)}:stampink:${k}"
      ><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${hex};margin-right:5px"></i>${n}</button>`).join('')}</div></div>` : '';
  return `<div class="field" style="margin-top:12px"><label>Drawer Front</label>
    ${side('left','Left of the knob')}${side('right','Right of the knob')}${stamp}${stood}
    <div class="mini" style="--k:var(--brass);margin-top:6px">Six places on a phone, three either side, and the knob stays in the middle whatever is beside it. Carry anything on the board onto an empty place to stand it there; hold it there to take it out. Every tool here is also an object you can put on a board. The gear is on the top lip, at the right, on every board.</div>
  </div>`;
}
/* What `gridBar()` left for the rail to draw on a phone, reset by viewHTML()
   before every build so a board with no bar (a panel preview) draws a plain
   drawer front rather than the last board's tools. */
let RAILBAR = null;
/* ---- tucked away: the whole screen is board -------------------------------
   On a phone the top lip and the drawer front can be put away (2026-09-30:
   "a more full screen view"). A flick down on the front pushes both off the
   screen and leaves the knob floating, faint, where the front was, because the
   knob is still the way home and into the Void Drawer. A flick down on that
   knob, or holding it, brings the furniture back. `setting('tuck')`, one setting
   for every board, kept across launches; a Mac has no furniture to put away.
   `UNTUCK` is one render's worth of "this just came back", so the lip and the
   front slide in rather than appear; it is cleared as soon as it is drawn and
   never holds anything up. */
const tucked = () => S.device==='phone' && !!(S.look && setting('tuck'));
const UNTUCK = {lip:false, rail:false};
function setTuck(on){
  if(!!(S.look && setting('tuck')) === !!on) return;
  setSetting('tuck', on ? true : null); if(!on) UNTUCK.lip = UNTUCK.rail = true;
  save(); render();
  UNTUCK.lip = UNTUCK.rail = false;
}

/* ---- the things in the drawer front — decision 208 ----------------------
   The knob is a turned sphere of the desk's own wood, and the buttons either
   side of it were the same sphere with a glyph pressed in: five knobs, four
   of which you had to read. Now each is the object it stands for, drawn in
   its own material under the same lamp (lit from the upper left, a shadow
   under it), so you find the search by looking for a magnifying glass, not
   for a circle with a circle in it.

   Materials rather than the style's colours, on purpose: a brass padlock is
   brass on every aesthetic the way the photographed tools are. The gradients
   are declared inside each drawing with a fixed id; a pager pane can put a
   second copy on the screen, and a duplicate id resolving to an identical
   gradient draws the same thing. */
/* Which way the block turns on its next draw (decision 215): set by the tap
   that changed the sort, read once by the build, so only the render that
   shows the new letter plays the turn. */
let BLOCKFLIP = '';
const flipBlock = axis => { BLOCKFLIP = axis; };
/* The drawings are in active.js since decision 220, where every tool that is
   also an object on a board is drawn from the same table (`TOOLART`). */
const RAILART = TOOLART;

const railObj = (art, act, id, title, on, arg)=>{
  const flip = art==='block' && BLOCKFLIP ? ` flip-${BLOCKFLIP}` : '';
  if(flip) BLOCKFLIP = '';
  return `<button class="railobj ro-${art}${flip}${on?' on':''}${act==='togglelock'&&on?' locked':''}" data-act="${act}"${
    id?` data-id="${esc(id)}"`:''} title="${esc(title)}" aria-label="${esc(title)}">
    <svg viewBox="0 0 40 40" aria-hidden="true">${RAILART[art](arg)}</svg></button>`; };

/* ---- the search is a button, and pressing it is a place ----------------
   It was a field in the bar, and a field in the bar is a field a third of the
   width of the screen with a placeholder cut off at "Search th". So the bar
   carries a magnifier in a ring, and pressing it puts the field along the top
   of the screen, full width and a size you can read, with the matches under
   it running edge to edge the way a row of eight-wide tiles does. Done, or
   Escape, or clearing it and pressing Done, gives the board back. `S.searchOn`
   is **not saved**, for the reason `S.q` is not: a search is where you are
   looking, not something the desk is. */
const searchOpen = ()=> !!S.searchOn || !!String(S.q||'').trim();
const searchBtn = c => `<button class="sqbtn searchbtn${searchOpen()?' on':''}"
    data-act="searchopen" data-id="${c.id}" title="Search" aria-label="Search">${ic('search',16)}</button>`;
function searchTop(c){
  return `<div class="searchtop">
    ${ic('search',20)}
    <input class="searchin" type="search" data-search="${c.id}"
      value="${esc(S.q||'')}" autocomplete="off" enterkeyhint="done"
      placeholder="${c.id===ROOT?'Search the desk\u2026':'Search in '+esc(boardName(c))+'\u2026'}"
      aria-label="Search">
    <button class="searchdone" data-act="searchclose">Done</button>
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
/* `h` is the viewport of a phone board that scrolls (decision 209): one
   shelf tall, however many rows are drawn inside it. Zero until measured, and
   then only written while the phone is scrolling rather than paging. `lip` is
   the top lip's height (decision 208). */
const REVEAL = {gap:7, rail:30, lip:0, h:0};
const revealStyle = ()=> S.device!=='phone' ? ''
  : ` style="margin-top:${REVEAL.gap}px${flows() && REVEAL.h ? `;height:${REVEAL.h}px;--flowh:${REVEAL.h}px` : ''}"`;

/* ---- a list is a column of eight-by-ones -------------------------------
   A list exists to look at things one after another, so a row of one is a
   **task-sized strip**: the shape a task tile has on a grid at eight cells by
   one, at exactly that height, standing flush against the one above it. It was
   a 46px minimum with six pixels of air between, which is a card list — a
   different thing, and the wrong one for working down a list of jobs.

   `--listrow` is the cell, written into the markup from the last measurement
   the same way gridOfContainer() writes the checker squares: a list is not a
   grid, so sizeGrid() never reaches it, and the number it needs is the same
   number. It goes on the **scroller** rather than on the list, because the add
   box at the top stands in the same column and has to be the same width.
   See decision 168. */
const listStyle = ()=> ` style="--listrow:${CELL[dev()]}px"`;

/* ---- a list is a view of *this board*, so it is windowed where the board is
   ----------------------------------------------------------------------
   A row in a list is the strip the same object would be on a grid at eight
   cells by one (decision 168) — which is what makes the list a second way of
   looking at the board rather than a second place. The desk is nine shelves,
   and the list was showing all nine in one column: things that are not on the
   board you are looking at, in an order that has nothing to do with where they
   are, while the dots in the bar went on saying you were on the middle one.

   So the list shows the shelf the grid would. It is windowed **exactly where
   the grid is windowed** — one shelf on a phone, the whole board on a Mac,
   where all twenty-four columns are drawn and the rows above and below are up
   and down the same scroller — because a list that disagreed with the grid
   about what "this board" means would be the same bug from the other side.
   `shelfShift()` is the grid's own gate and this asks it the same question.

   Walking shelves still works: the dots in the bar are drawn above the list
   too, and pressing one moves the window. Anything **never placed** has no
   shelf to be on, so it is always shown rather than hidden until it is given
   a box by the next render. */
function onThisShelf(cid, items){
  /* A tile of one cell (decision 283) would window a list to the things
     whose corner is in one column of cells: the whole board, as its grid is. */
  return items;
}
/* Which layouts the window applies to: the **list** and nothing else. A grid
   is the board itself and `gridOfContainer()` already windows it; a book, a
   calendar and a timeline arrange by sequence or by date, which is not a fact
   about where anything sits. Named once so the desk and a drawer cannot answer
   it differently. */
const isListView = v => v!=='grid' && v!=='book' && v!=='calendar' && v!=='timeline';

/* What a board shows while the field has something in it: the matches, as a
   list, in the order `searchHits()` ranked them. A **list** rather than a grid
   because the answers have no places — they come from all over the desk, and
   putting them on a grid would invent coordinates that mean nothing. Pressing
   one does whatever pressing it anywhere does. */
function searchBoard(c){
  const q = String(S.q||'').trim();
  if(!q) return `<div class="scroll flushlist searchlist"><div class="searchsaid">${
    c.id===ROOT ? 'Everything in Bureau' : 'Everything in '+esc(boardName(c))}: a name, a tag, or a word from inside it.</div></div>`;
  const hits = searchHits(q, c.id);
  return `<div class="scroll flushlist searchlist">
    <div class="searchsaid">${hits.length
      ? `${hits.length} ${hits.length===1?'thing':'things'} matching \u201c${esc(q)}\u201d`
      : `Nothing matching \u201c${esc(q)}\u201d`}${
      c.id===ROOT ? '' : ` in ${esc(boardName(c))}`}</div>
    ${hits.length
      ? `<div class="listgrid">${hits.map(listTile).join('')}</div>`
      : `<div class="empty"><div class="big">No matches</div>Try part of a name, a tag, or a word from inside it.</div>`}
  </div>`;
}

/* Standing on an empty slot (decision 219): a phone one step off the edge of
   the boards, in a way of looking at the board that is windowed to one — the
   grid or the list. There is nothing to list, so both draw the slot. */
const onSlot = (cid, view) => dev()==='phone' && (view==='grid' || isListView(view))
  && (()=>{ const at=shelfAt(cid); return !isBoard(cid, at.x, at.y); })();
function viewDesk(){
  const c=rootObj(), view=c.layout||'grid';
  if(searchOpen()) return `${gridBar(c)}${searchTop(c)}${searchBoard(c)}`;
  if(view!=='grid' && !onSlot(c.id, view)){
    const all=childrenOf(c);
    const items = isListView(view) ? onThisShelf(c.id, all) : all;
    const elsewhere = !items.length && all.length;
    return `
    ${gridBar(c)}
    <div class="scroll${view==='book'?'':' flushlist'}"${listStyle()}>
      ${!items.length ? `<div class="empty"><div class="big">${
          elsewhere ? 'Nothing on this shelf' : 'Nothing on the desk'}</div>${
          elsewhere ? `There ${all.length===1?'is one thing':`are ${all.length} things`} on the other shelves — the dots in the bar walk between them.`
                    : 'Hold a bare cell — that is the Magic Selector — and drag out the size you want.'}</div>`
        : view==='book'   ? bookView(c, items)
        : `<div class="listgrid" data-listfor="${c.id}" style="${boardVarsOf(c)}">${items.map(listTile).join('')}</div>`}
    </div>`;
  }
  // the bar sits above the scroller, not inside it — it carries the pins now,
  // and navigation that scrolls away is navigation you can't reach
  return `
  ${gridBar(c)}
  <div class="scroll deskscroll${columnOnly(dev(), ROOT)?' colonly':''}"${revealStyle()}>
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
    ${/* The same add box as the one at the top of a drawer, aimed at a day —
         `.addline`, the spawner's mark, the line and the word. See decision
         167. */''}
    <div class="quickadd addline" style="margin-top:9px">
      <button class="addpress" data-daynew="${d.id}:${iso}"
        title="Make a ${esc(genSaid(d))} on this day">${ic(makesAnything(d)?'sparkle':'spiral',15)}</button>
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
  /* The head is the face's name row grown a pair of hands: the calendar's own
     name over the span it shows — the face's `.dname` and `.clcount` — with
     the steps either side and the span chooser, all drawn on the front's
     colour rather than as paper chrome beside it. See decision 200. */
  const head = `
  <div class="dtop calohead">
    <span class="calonav">
      <button class="calobtn" data-act="monthstep" data-id="${d.id}" data-step="-1" title="Back">${ic('chevL',15)}</button>
      <button class="calobtn" data-act="monthstep" data-id="${d.id}" data-step="1" title="Forward">${ic('chevR',15)}</button>
      <button class="calobtn" data-act="monthtoday" data-id="${d.id}">Today</button></span>
    <span class="caloname"><span class="dname">${esc(d.title||'Untitled')}</span>
      <span class="clcount">${esc(label)}</span></span>
    <span class="calviews">${Object.entries(CALVIEWS).map(([v,n])=>
      `<button class="calobtn${view===v?' on':''}" data-calview="${d.id}:${v}">${n}</button>`).join('')}</span>
  </div>`;
  const hint = 'Drop a dated object on a day to schedule it';
  /* The day view is the face's one-square day, full size — the pad a small
     face wears, still a drop target — with the day's own list under the front,
     where the list for a picked day sits in the other two spans. */
  if(view==='day'){
    const iso=D.iso(anchor);
    const pad = `<div class="dbody"><div class="calopday${iso===T?' today':''}" data-calday="${d.id}:${iso}" title="${hint}">
      <u>${esc(anchor.toLocaleDateString(undefined,{month:'long'}))}</u>
      <b>${anchor.getDate()}</b>
      <i>${esc(anchor.toLocaleDateString(undefined,{weekday:'long'}))}</i></div></div>`;
    // the head already says which day it is, so the panel doesn't say it again
    return calFront(d, head + pad) + dayPanel(d, iso, (byDay[iso]||[]).map(x=>x.o), true);
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
  return `${calFront(d, `${head}
  <div class="dbody"><div class="monthgrid cal-${view}" style="--dcols:${cols.length}" title="${hint}">
    ${cols.map(n=>`<i class="dow">${DOWNAME[n]}</i>`).join('')}
    ${cells.join('')}
  </div></div>`)}
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
  // the field in the bar replaces the board, exactly as it does on a desk
  if(searchOpen()) return `${gridBar(d)}${searchTop(d)}${searchBoard(d)}`;
  const all=childrenOf(d);
  let items=all;
  if(S.kindFilter) items=items.filter(o=>o.kind===S.kindFilter);
  const kinds=[...new Set(all.map(o=>o.kind))];
  const held=items.length;
  /* grid | list | scroll | book | calendar | timeline — the object's own choice
     first, then its type's. Falling straight to 'grid' meant a type that says
     it opens as a calendar only did so if something had written `layout` onto
     the object, which create() does and the seed doesn't. */
  const slot = onSlot(d.id, layoutOf(d));
  const view = slot ? 'grid' : layoutOf(d);
  // a drawer is one shelf unless it says otherwise, so this is usually a no-op
  if(isListView(view)) items = onThisShelf(d.id, items);
  const elsewhere = !items.length && held;
  return `
  ${gridBar(d)}
  ${/* A column of eight-by-ones stands where the board stands, so the
       scroller gives up its own side padding for the grid's — see `.flushlist`
       in board.css. Only for a list: a book, a calendar and a timeline are not
       columns of tiles and keep the reading inset. */''}
  <div class="scroll${view==='grid'?' deskscroll':''}${view==='grid'&&columnOnly(dev(), d.id)?' colonly':''}${view==='list'?' flushlist':''}"${
      view==='grid'?revealStyle():listStyle()}>
    ${view==='grid'?cavityWalls():''}
    ${kinds.length>1&&view!=='grid'?`<div class="filterbar">
      <button class="fchip${!S.kindFilter?' on':''}" data-kind="">All</button>
      ${kinds.map(k=>`<button class="fchip${S.kindFilter===k?' on':''}" data-kind="${k}" style="--k:${hexOf(K(k).c)}">${K(k).nm}</button>`).join('')}
    </div>`:''}
    ${!slot&&has(d,'text')&&(d.body||'').trim()
      ? `<div class="contbody">${md(d.body)}</div>` : ''}
    ${/* The box at the top of a drawer **is a spawner**, and now says so: the
         same dashed rule, the same spiral, the same field and the same
         `return` a spawner tile with its line showing wears (`.addline`), and
         the mark presses out one of what the drawer collects exactly as a
         spawner's does. It was a plus in a dashed box doing the identical job
         a scroll away from a tile that looked like a control. One machine,
         one look. See decision 167. */''}
    ${!slot&&takesTyping(d)&&view!=='calendar' ? `<div class="quickadd addline">
      <button class="addpress" data-contnew="${d.id}"
        title="Make a ${esc(genSaid(d))}">${ic(makesAnything(d)?'sparkle':'spiral',15)}</button>
      <input data-contadd="${d.id}" placeholder="Add a ${esc(genSaid(d))}…">
      <span class="k">return</span></div>` : ''}
    ${view==='grid'
      ? gridOfContainer(d.id)
      : view==='calendar'
      ? viewCalendar(d, items)
      : view==='timeline'
      ? viewTimeline(d, items)
      : !items.length
        ? `<div class="empty"><div class="big">${
            elsewhere ? 'Nothing on this shelf' : 'This drawer is empty'}</div>${
            elsewhere ? `There ${held===1?'is one thing':`are ${held} things`} on its other shelves — the dots in the bar walk between them.`
            : has(d,'magic') ? 'Nothing matches its rule yet.'
            : takesTyping(d) ? 'Type in the box above to start it off.'
            : 'Drag something in, or hold a bare cell with the Magic Selector.'}</div>`
        : view==='book'
        ? bookView(d, items)
        : `<div class="listgrid" data-listfor="${d.id}" style="${boardVarsOf(d)}">${items.map(o=>listTile(o)).join('')}</div>`}
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
/* **A container no longer gets one of these.** Since decision 188 its board is
   its own tile, four cells to a cell, and a second control that could make a
   2×2 drawer hold ten columns instead of eight would muddy the one rule
   Timothy actually asked for. The setting still decides the **desk's** columns
   and how wide a shelf is — which is how much of a big drawer you see at once
   — so it has not lost its job, only its reach into a coordinate space that is
   now derived. The drawer's own size, which is the thing that decides, is the
   field below this one. */
/* A board's own width and height (decision 235) is **retired by decision
   272**: every tile is eight by eight, and a board is as many tiles as you
   add. The row is gone from Board settings; the name stays so its callers
   need not change. */
function boardDimsField(){ return ''; }
/* ---- how many shelves a board is --------------------------------------
   The Desk is three by three and every other container is one, with the option
   of more — this is the option. Drawn as the grid it makes rather than as two
   numbers: you are choosing a *shape*, and a picture of the shape is the one
   thing a pair of steppers cannot show you.

   Shrinking is allowed and is not destructive: nothing is deleted, and
   anything left outside the smaller board is re-placed the next time the board
   is drawn — the same licence `ensureBox()` takes with an object that has
   never been in a grid. The desk's own row is fixed at three by three: it is
   the room everything else is in, and a desk you can shrink to one shelf is
   the app before this. See decision 141. */
function shelfCountField(cid){
  /* **A free board is as big as what is on it** (decision 287), so for one
     this only says how big that is and how it got so. */
  {
    const sh = shelvesOf(cid);
    const magic = cid!==ROOT && has(container(cid),'magic');
    /* **Which kind of board** (decision 288): free, tiled or fixed, with the
       tile's size and what a full one does under the two that have tiles. */
    const f = formOf(cid), where = cid===ROOT ? 'The desk' : 'This board';
    const chip = (k, nm) => `<button class="fchip${f.form===k?' on':''}" data-act="boardform" data-id="${esc(cid)}" data-form="${k}">${nm}</button>`;
    const step = (part, n, mn, mx) => `<span class="tilestep"><button class="fchip" data-act="tiledim" data-id="${esc(cid)}" data-part="${part}" data-d="-1"${n<=mn?' disabled':''} aria-label="Smaller">−</button><b>${n}</b><button class="fchip" data-act="tiledim" data-id="${esc(cid)}" data-part="${part}" data-d="1"${n>=mx?' disabled':''} aria-label="Bigger">+</button></span>`;
    const kinds = `<div class="field" style="margin-top:12px"><label>Kind of board</label>
      <div class="filterbar" style="margin-top:6px">${chip('free','Free')}${chip('tiled','Tiled')}${chip('fixed','Fixed')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">${
        f.form==='free' ? 'Grows round whatever is put on it, with room to spare. Scroll and pinch to move around it.'
        : f.form==='tiled' ? 'A tile of a set size. Hold the wood beside it to add another tile the same size; hold a tile’s middle to take an empty one away.'
        : 'One tile of a set size, and no more. Things that will not fit are refused.'}</div></div>`;
    if(f.form!=='free'){
      const nt = tilesOf(cid).length;
      return kinds + `<div class="field" style="margin-top:12px"><label>${f.form==='tiled'?'Each tile':'Size'}</label>
        <div class="tilesize" style="margin-top:6px">${step('w', f.w, DIM_MIN, DIM_MAX)}<span>×</span>${step('h', f.h, DIM_MIN, DIM_MAX_H)}<span class="mini">cells${
          f.form==='tiled' ? `, ${nt} tile${nt===1?'':'s'}` : ''}</span></div></div>${f.form==='tiled' ? `
        <div class="field" style="margin-top:12px"><label>When it is full</label>
        <div class="filterbar" style="margin-top:6px"><button class="fchip${f.full==='add'?' on':''}" data-act="boardfull" data-id="${esc(cid)}" data-full="add">Add a tile</button><button class="fchip${f.full==='stop'?' on':''}" data-act="boardfull" data-id="${esc(cid)}" data-full="stop">Say no</button></div></div>` : ''}`;
    }
    return kinds + `<div class="field" style="margin-top:12px"><label>Size</label>
      <div class="mini" style="--k:var(--brass);margin-top:6px">${cid===ROOT?'The desk':'This drawer'} is <b>${sh.w} × ${sh.h}</b> cells${magic
        ? '. A sorting drawer packs what it collects into the room it has.'
        : `: everything on it with ${MARGIN.w} empty cells round it, and it grows when something is put in that margin.`}${
        cid===ROOT ? '' : ' Two fingers sideways goes to the drawer beside this one.'}
        <button class="fchip" data-act="zoomfit" data-id="${cid}" style="margin-left:4px">See all of it</button></div>
    </div>`;
  }
}
const installed = ()=> window.matchMedia('(display-mode: standalone)').matches || !!window.navigator.standalone;

/* ---- settings, in the shape of the questions it asks ------------------
   Seventeen sections in one column, with a *Testing* button among them and
   "erase everything" three scrolls below the thing you came for. Same argument
   as the object editor and the same shape of answer: the top is a short list of
   doors, each one is the same panel under the same key, and `spec.back` is the
   way out. See decision 66. */
const SETSECS = {
  /* **Board settings** — decision 193. Everything about the surface you are
     standing on, in one door: which aesthetic dresses it, the colour of its
     squares, what it is made of, whether it lets go, and how big it is. They
     were scattered across Aesthetics and Appearance, and they are the one set
     of settings that means something inside a container too — so inside one,
     the gear opens straight onto this door and nothing else. */
  board:  ['Board settings', 'grid', 'this desk: how it is laid out, sorted and painted, its color, grid size and pages'],
  /* **Global Settings** (decision 213, Timothy's own arrangement in the
     Workshop): the aesthetic, its palette and light or dark, and what is left
     of Appearance, in one door. Aesthetics was its own door and is gone; a
     desk that asks for it by its old key is given this one. */
  look:   ['Global Settings', 'palette', 'aesthetic, palette, light and dark, and the rest'],
  /* Depth was four rows at the foot of Appearance and is now eleven, because a
     drawer wants a different answer from a book and both wanted trying out. A
     panel asks one question, and "how solid does this desk look" is not the
     same question as "what colour is the board" — so it is a door, the way the
     object editor's Look is. See decisions 66 and 118. */
  /* …and is folded into Global Settings now (decision 255), under the rest
     of how the desk looks. `depth` still answers, opening that door. */
  /* Urgency is scaled by one number — how much work a day holds — and it is
     not a look, a board or a backup, so it is its own door rather than a row
     wedged into someone else's. See decisions 66 and 120. */
  /* Time was cut in the Workshop (decision 218); the workday is back at its
     default (migration 44) and the ladder is explained where urgency is set. */
  /* Not a setting at all: a door out to the specimen book, which is every
     aesthetic and everything each one dresses, generated out of the desk that
     is running. It sits among the look doors because that is what you are
     looking at when you want it. See decision 143. */
  guide:  ['Specimen Book','book', 'every aesthetic, and everything it dresses'],
  plans:  ['Benches',    'grid',    'boards set up for one kind of work, to lay out again'],
  /* Your Things is the head of About (decision 255). */
  paste:  ['Paste an Object', 'plus',    'objects described as JSON'],
  /* Claude (decision 306): the person's own key and which model, kept on
     this device and never in the desk. */
  claude: ['Claude', 'sparkle', 'your key, and which Claude builds boards for you'],
  about:  ['About',      'help',    'how much there is, getting it out, which Bureau this is, and starting over']
};
function settingsPanel(sec, cid){
  /* Plans is a door in this list and a **panel of its own** — it is wide, it
     draws boards rather than rows, and it is reached from the picker as well
     as from here. So the row hands over rather than rendering in place. */
  if(sec==='plans') return plansPanel();
  /* And the specimen book is not a panel either: it is a document, so it takes
     the screen the way a surface does rather than a column down the edge. */
  if(sec==='guide'){ closePanel(); return openGuide(); }
  if(sec==='style') sec = 'look';          // Aesthetics was folded in (213)
  if(sec==='depth') sec = 'look';          // …and Depth and light (255)
  if(sec==='things') sec = 'about';        // Your Things heads About (255)
  const s = SETSECS[sec] ? sec : null;
  /* Inside a container there is no app to set — the aesthetic, the gravity and
     the board are all there is — so the door is the whole panel and there is
     no way back to a list of doors that would all be about somewhere else. */
  const inside = !!(cid && cid!==ROOT && byId(cid));
  /* Inside a container the drawer's own editor is woven in above its Board
     settings (decision 206), so its fields write to it and its doors come back
     here; the panel's title is the drawer's name, pressable to rename, the way
     the editor's own is. */
  if(inside){ S.openId = cid; objBackTo(()=>settingsPanel('board', cid), cid); }
  /* **…and on the desk too** (decision 233). "This desk" was a row of its own
     at the top of Settings, opening the desk's editor, beside a Board settings
     door that was the desk's board; they were two halves of one thing. So the
     desk's editor is woven into its Board settings the way a drawer's is. */
  else if(s==='board') objBackTo(()=>settingsPanel('board'), ROOT);
  openPanel({key:'settings',
    title: inside ? `<span class="pheadname" data-headname="${cid}" tabindex="0"
      title="Press to rename">${esc(byId(cid).title||'Untitled')}</span>` : s ? SETSECS[s][0] : 'Settings',
    sub: inside ? 'Settings for this drawer' : s ? 'Settings' : `Bureau ${APP_VERSION} · ${installed()?'installed':'in a browser tab'}`,
    back: (s && !inside) ? (()=>settingsPanel()) : null,
    body:()=>settingsBody(s, inside ? cid : null)});
}
/* The gear: the whole of settings from the desk, and the board you are in
   from anywhere else. */
function toggleSettings(){
  if(panelKey()==='settings') return closePanel();
  const here = S.view==='drawer' && S.drawerId;
  here ? settingsPanel('board', S.drawerId) : settingsPanel();
}

/* ---- a bench's room, in its Board settings — decision 293 ---------------
   What the bench you are in decides, each with the way back to the desk's
   (*Desk's*) and the way to make it the desk's too (*Everywhere*). Inside a
   bench every setting below writes the bench, so this list is how you see
   what it has taken over. The aesthetic is here as well as in Global
   Settings, because walking into a bench may change it. */
const ENV_SAID = {
  style: v => (STYLES[v]||{}).nm || v, flow: v => v==='rigid' ? 'Rigid swipe' : 'Smooth scroll',
  tuck: v => v ? 'Tucked away' : 'Showing', gravity: v => GRAVITIES[v] || 'Off',
  surface: v => SURFACES[v] || SURFACES.grid, dark: v => DARKMODES[v] || v,
  pinned: v => v ? 'Pinned' : 'Laid flat', gravitytilt: v => v ? 'Wherever the phone leans' : 'Down the board',
  boardAlpha: v => Math.round((v==null?1:v)*100)+'%'};
function benchSection(cid){
  const c = byId(cid); if(!c) return '';
  const b = benchHere();
  const head = `<div class="section-h" style="margin-top:18px"><h2>Bench</h2><div class="rule"></div></div>`;
  if(!b) return head + `<div class="field" style="margin-top:8px">
      <button class="pill" data-bench="make:${esc(cid)}">${ic('sparkle',13)} Make this a bench</button>
      <div class="mini" style="--k:var(--brass);margin-top:6px">A bench has a room of its own: its aesthetic, its board, how you move down it, its bars and its gravity. Once it is a bench, the settings you change in here stay in here, and the desk keeps its own.</div></div>`;
  const keys = ENV_KEYS.filter(k=>decidedBy(k));
  const rows = keys.map(k=>{ const by = decidedBy(k), v = setting(k);
    return `<div class="benchrow"><span><b>${esc(ENV_NAMES[k])}</b> ${esc(ENV_SAID[k] ? ENV_SAID[k](v) : 'its own')}${
      by.id!==b.id ? ` <i>from ${esc(by.title||'the bench')}</i>` : ''}</span>
      <button class="fchip" data-bench="unset:${k}" title="Let the desk decide this again">Desk's</button>
      <button class="fchip" data-bench="every:${k}" title="Make this the desk's too">Everywhere</button></div>`; }).join('');
  return head + `<div class="field" style="margin-top:8px">
    <div class="mini" style="--k:var(--brass);margin-bottom:6px">${b.id===cid
      ? `This is a bench. What you change in here stays in here.`
      : `Inside the ${esc(b.title||'')} bench: what you change in here changes the bench.`}</div>
    ${rows || `<div class="mini" style="--k:var(--brass)">It decides nothing yet: everything is the desk's.</div>`}
    <label style="display:block;margin-top:12px">Aesthetic in this bench</label>${stylePicker()}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${b.id===cid
      ? `<button class="pill" data-bench="drop:${esc(cid)}">Stop being a bench</button>`
      : `<button class="pill" data-bench="make:${esc(cid)}">Make this its own bench</button>`}</div></div>`;
}
/* Every aesthetic, as a swatch of itself, at the head of Global Settings
   (decision 213). It was in two doors, Board settings and Aesthetics; it is
   the whole desk's, so it is in the one door that is about the whole desk. */
const stylePicker = ()=> `<div class="stylegrid">${Object.entries(STYLES).map(([k,st])=>
      `<button class="styletile${(setting('style')||'victorian')===k?' on':''}" data-style3="${k}">
        <span class="stpv" style="background:${st.cols[0]};border-color:${st.cols[2]}">${
          [3,5,6,9,11,12].map(i=>`<i style="background:${st.cols[i]}"></i>`).join('')}</span>
        <b>${st.nm}</b><i>${st.ds}</i></button>`).join('')}</div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">An aesthetic is sixteen colors, a board, a typeface, and the defaults new drawers are born with. It is the whole desk's, in here as much as out there.</div>`;

function settingsBody(sec, cid){
  const standalone = installed();
  // Depth and light is part of Global Settings, Your Things of About (255)
  const at = s => sec===s || (s==='depth' && sec==='look') || (s==='things' && sec==='about');
  const inside = !!cid;
  /* **The desk's own editor is the first door** (decision 206). It was the
     brush in the bar: how this desk is laid out, sorted and painted. */
  if(!sec) return `<div class="rows osecs">
      ${Object.entries(SETSECS).map(([k,[nm,icon,note]])=>
      `<div class="row" data-ssec="${k}">
        <span class="kindmark">${ic(icon,13)}</span>
        <div class="body"><div class="title">${esc(nm)}</div><div class="snip">${esc(note)}</div></div>
        <span class="rowgo">${ic('chevR',13)}</span></div>`).join('')}</div>
    <div class="mini" style="--k:var(--brass);margin-top:10px">Board settings is the board you are on: on the desk, the desk's own editor and then its board; inside a drawer the gear opens that drawer's. See decisions 206 and 233.</div>`;
  return [
    at('things') ? `
    <div class="section-h"><h2>Statistics</h2><div class="rule"></div></div>
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
    ${/* The automatic backups (decision 305): listed on a press, because
          they are read out of IndexedDB and a panel is drawn at once. */''}
    <div class="section-h" style="margin-top:18px"><h2>Backups</h2><div class="rule"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pill" data-act="backups">${ic('undo',13)} Go back to an earlier desk</button>
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">Bureau keeps the desk as each of the last seven days began, and a copy before anything that changes a lot at once. Going back keeps the desk you had as a backup too.</div>
    ${/* The project dashboards (decision 304): on the desk once, by itself,
          on a desk that already had things on it; here for a fresh desk, or
          to bring back one that was thrown away. Nothing is pasted. */''}
    <div class="section-h" style="margin-top:18px"><h2>Project dashboards</h2><div class="rule"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pill" data-act="dashboards">${ic('grid',13)} Put them on the desk</button>
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">Bureau, Composer’s Key and EveryPark, each a board of what is next, the open questions, and pages about it. One already on the desk is brought up to date, and anything you wrote on it stays.</div>
    ${/* The Showroom (decision 309): a room for each part of Bureau, laid
          fresh, the last one to the bin. */''}
    <div class="section-h" style="margin-top:18px"><h2>Showroom</h2><div class="rule"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pill" data-act="showroom">${ic('grid',13)} Lay out a fresh Showroom</button>
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">A drawer on the desk with a room for each part of Bureau, every kind of thing in it, to look at and to try. A fresh one replaces the last, which goes to the bin; nothing in it reaches your real Now or calendars.</div>` : '',
    at('about') ? `

    <div class="section-h"><h2>Version</h2><div class="rule"></div></div>
    <div class="statline">
      <div class="s"><b>${esc(APP_VERSION)}</b>Bureau</div>
      <div class="s"><b>${DATA_V}</b>data format</div>
      <div class="s"><b>${standalone?'Installed':'Browser'}</b>running as</div>
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">An installed copy serves itself from its own cache, so it can be a version behind until its second launch. This is the one that is running right now.</div>` : '',
    at('board') ? `<div class="woven">${objectPanelBody(inside ? cid : ROOT, null)}</div>
    ${/* Everything on this board as words, for somewhere else (decision 304) */''}
    ${inside ? `<div class="field" style="margin-top:12px"><button class="pill" data-act="copymd" data-id="${esc(cid)}">${
      ic('copy',13)} Copy this board as text</button>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Everything on it, checks and answers included, as text you can paste to Claude or anywhere else.</div></div>` : ''}
    ${inside ? benchSection(cid) : ''}
    <div class="section-h" style="margin-top:18px"><h2>Board settings</h2><div class="rule"></div></div>
    <div class="section-h"><h2>The board</h2><div class="rule"></div></div>
    ${inside ? boardRow(cid, byId(cid), false) : `
    <div class="field" style="margin-top:12px"><label>Board Color</label>
      <div class="pickgrid sw" style="margin-top:6px">${
        [['#EFEADA|#DDE5CE','Green baize'],['#EFEADA|#E4DCC6','Sand'],['#EDE6D4|#D9E2E4','Slate'],
         ['#F0EBDC|#E8DAD2','Clay'],['#EEE9DA|#E2E2DA','Ash'],['#EFEADA|#EFEADA','Plain']].map(([v,nm])=>{
        const [a,b]=v.split('|');
        /* `lookVal`, not `setting('board')`: a board is stored per theme as
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
               value="${Math.round((setting('boardAlpha')==null?1:setting('boardAlpha'))*100)}">
        <b>${Math.round((setting('boardAlpha')==null?1:setting('boardAlpha'))*100)}%</b></label>
      ${lookVal('board')?`<button class="pill" style="margin-top:6px" data-look="board" data-val="">Reset</button>`:''}
    </div>

`}
    ${/* What the board is made of. It was tied to the lock for one version —
          graph paper unlocked, the carcass locked — and that made the surface
          you look at all day change under a switch you flick all day. It is a
          thing you set once, so it is a row. See decision 192. */''}
    ${/* Every tile the same squares, or each its own (decision 274). The
          board's own, so a desk and a drawer can answer differently. */''}
    <div class="field" style="margin-top:12px"><label>Tile Colors</label>
      <div class="filterbar">${[['','The same on every tile'],['each','Each tile its own']].map(([v,n])=>
        `<button class="fchip${((cfgOf(inside ? cid : ROOT)||{}).tilepaper==='each'?'each':'')===v?' on':''}" data-tilepaper="${v}" data-id="${inside ? cid : ROOT}">${n}</button>`).join('')}
        ${(cfgOf(inside ? cid : ROOT)||{}).tilepaper==='each' ? `<button class="fchip" data-tilepaper="reroll" data-id="${inside ? cid : ROOT}">${ic('spiral',12)} Roll again</button>` : ''}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px"><b>The same on every tile</b> is one checkerboard running through the whole board. <b>Each tile its own</b> gives every tile its own two quiet colors, picked at random and kept; <b>Roll again</b> picks a new set.</div>
    </div>

    <div class="field" style="margin-top:12px"><label>Board Background Type</label>
      <div class="filterbar">${Object.entries(SURFACES).map(([v,n])=>
        `<button class="fchip${(setting('surface')||'grid')===v?' on':''}" data-surface="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px"><b>Graph paper</b> is the checkerboard, two cells to a square, and it is what arranging is done on. <b>Plain</b> is the same color with nothing drawn on it. <b>The carcass</b> is the wood the bar above and the drawer along the bottom are made of, so the whole screen reads as one piece of furniture. The board's own color is still the board's own color — this only says what is drawn on it.</div>
    </div>

    ${/* How a phone gets down a board (decision 209): since decision 272
          scrolling is the default, and snaps to the cells when it stops. */''}
    <div class="field" style="margin-top:12px"><label>Moving Down a Board</label>
      <div class="filterbar">${[['','Smooth scroll'],['rigid','Rigid swipe']].map(([v,n])=>
        `<button class="fchip${(['page','rigid'].includes(setting('flow'))?setting('flow'):'')===v?' on':''}" data-flow="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px"><b>Smooth scroll</b> moves every way, and when you stop it settles on the nearest row of cells. <b>Rigid swipe</b> does not scroll at all: the board follows your finger and a swipe moves exactly one screenful, up, down or sideways. The swipe switch, a tool for the drawer front or the board, flips between smooth and rigid.</div>
    </div>

    ${/* Full screen on a phone (2026-09-30): the lip and the front put away. */''}
    <div class="field" style="margin-top:12px"><label>Top and Bottom Bars</label>
      <div class="filterbar">${[['','Showing'],['tuck','Tucked away']].map(([v,n])=>
        `<button class="fchip${(setting('tuck')?'tuck':'')===v?' on':''}" data-tuck="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px"><b>Tucked away</b> takes the name off the top and the drawer front off the bottom, so the board fills the phone's screen. The knob stays, faint, at the bottom: tap it for home and pull it up as before. Flick the drawer front down to tuck it away; flick the knob down, or hold it, to bring it back.</div>
    </div>

    ${/* *How big a drawer is inside* was a row here (decisions 188 and 195)
          and is cut (213): every drawer is screenfuls. The mode is still in
          the code behind `S.look.proportional`, which nothing sets now. */''}
    ${/* The board lets go. It is an experiment and the note says so — but it
          is a real solver rather than a keyframe, because the interesting half
          is what a pile *does* when you throw another drawer into it. Nothing
          moves in the model: the boxes stay exactly where they are and the
          whole fall is a transform over the top, so switching it off is the
          arrangement you had. See decision 166. */''}
    <div class="field" style="margin-top:12px"><label>Gravity</label>
      <div class="filterbar">${Object.entries(GRAVITIES).map(([v,n])=>
        `<button class="fchip${gravityMode()===v?' on':''}" data-gravity="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Everything on the board you are looking at stops being on the grid and falls into a heap at the bottom of it. <b>Sand</b> is the plain answer: nothing turns, so a thing drops straight down and sits on what is under it. <b>Tumbling</b> gives each one real weight, so it lands on a corner, leans, and the pile finds its own angle. You can pick one out of the heap and throw it, and tapping one still opens it.</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Nothing here changes the desk. Every tile keeps the cell you put it in and the fall is drawn over the top, so switching it off puts the board back exactly as it was.</div>
      ${gravityOn() && S.device!=='desk' ? `
      <label class="rangerow" style="margin-top:12px"><span>Which way is down</span><b></b></label>
      <div class="filterbar">${[['','Down the board'],['1','Wherever the phone leans']].map(([v,n])=>
        `<button class="fchip${(setting('gravitytilt')?'1':'')===v?' on':''}" data-gravitytilt="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass);margin-top:6px">Where down actually is, the whole circle of it. Roll the phone and the heap runs to the low edge; turn it right over and everything falls to the top of the screen; lay it flat on a table and nothing moves at all, because a tray held level is not tipping anything anywhere. Half a tilt is half the pull. It asks iPhone for the motion sensor the first time, and it is the same one the cavity reads.</div>` : ''}
    </div>

    ${/* the tiles' map on the desk too (2026-09-30): it is where a tile with
         things on it is taken away */''}${inside ? shelfCountField(cid)+railToolsField(cid) : shelfCountField(ROOT)}` : '',
    at('look') ? `
    ${/* Timothy's order (decision 213): the aesthetic and its colours first,
         then the room it sits in. How things sit, what a checklist front shows,
         the tick boxes and the shadows were cut: each is left at its default
         (migration 43) rather than stuck on an answer nobody can reach. */''}
    <div class="section-h"><h2>Aesthetic</h2><div class="rule"></div></div>
    ${stylePicker()}
    ${/* Light or dark is still not a second axis: it is a second set of
         sixteen that an aesthetic may carry, and Victoria is the one that does.
         The default follows the phone, because the desk should already be
         dark when you pick it up at night. */''}
    <div class="field" style="margin-top:12px"><label>Light and dark</label>
      <select class="psel" data-darkmode>${Object.entries(DARKMODES).map(([v,n])=>
        `<option value="${v}"${darkMode()===v?' selected':''}>${n}</option>`).join('')}</select>
      <div class="mini" style="--k:var(--brass);margin-top:6px">${hasDark()
        ? `${esc(styleNow().nm)} has a walnut set of its own — the same sixteen slots after dark, so every drawer keeps the color you gave it.`
        : `${esc(styleNow().nm)} is one light and has no dark set, so this changes nothing here. Victoria does.`}</div>
    </div>

    <div class="field" style="margin-top:14px"><label>Palette</label>
      <div class="mini" style="--k:var(--brass);margin:2px 0 8px">The first five dress the app itself. The other eleven are what drawers and objects are painted in. A slot is a <b>position</b>, not a color: a drawer holds slot 11, and slot 11 is a claret here and a deep sea blue in Aeros. Changing aesthetic swaps every tile to that aesthetic's answer; changing back puts each one exactly where it was.</div>
      ${[[0,OBJ0,'chrome'],[OBJ0,16,'']].map(([a,b,cls])=>
        `<div class="slotgrid ${cls}">${palNow().slice(a,b).map((c,n)=>{
          const i=a+n;
          return `<label class="slot${cls?' chrome':''}" title="${slotName(i)}">
            <b style="background:${c}"><input type="color" data-slot="${i}" value="${c}"></b>
            <span>${slotName(i)}</span></label>`;}).join('')}</div>`).join('')}
      ${(setting('slots')&&setting('slots')[setting('style')||'victorian'])
        ? `<button class="pill" style="margin-top:8px" data-act="resetslots">${ic('undo',13)} Back to ${esc(styleNow().nm)}&rsquo;s own sixteen</button>` : ''}
    </div>
    <div class="section-h"><h2>The room</h2><div class="rule"></div></div>
    <div class="field" style="margin-top:12px"><label>Background</label>
      <div class="pickgrid sw" style="margin-top:6px">${BACKDROPS.map(([c,nm])=>
        `<button data-look="bg" data-val="${c}" title="${nm}" class="${(lookVal('bg')||'')===c?'on':''}" style="background:${c}"></button>`).join('')}</div>
      <label class="custcol"><input type="color" data-lookinput="bg" value="${lookVal('bg')||palNow()[0]}"><span>Custom background</span></label>
      ${lookVal('bg')?`<button class="pill" style="margin-left:6px" data-look="bg" data-val="">Reset</button>`:''}
    </div>

    ${/* Things that come out of a tile when a new one lands. Real physics
          rather than a keyframe — see decision 85 — so it is a flavour rather
          than a switch: how many, how big, and which shapes. */''}
    <div class="field" style="margin-top:12px"><label>Default Confetti Type</label>
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
      <div class="mini" style="--k:var(--brass);margin-top:6px">Thrown out of a new object as it lands on the board, and then pulled down. They take its color and the aesthetic's own accent, so a burst belongs to the desk it happened on.</div>
    </div>

    <div class="field" style="margin-top:12px"><label>Desk Owner</label>
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
    at('depth') ? (()=>{
      const px=(k,d)=>S.look[k]==null?d:S.look[k];
      /* One slider is one row and one note. The cues below differ only in what
         they are called and what they claim, so they are a table rather than
         eleven copies of the same markup — add one here and it arrives in the
         panel, and `applyLook()` is the only other place that has to know. */
      /* Every cue that answers the eye can answer it the other way round, and
         which way is right is a thing to be looked at rather than argued about
         — so the flip sits on the row it belongs to rather than in a list of
         its own. A button, not a pair of chips: it is one bit, and eight pairs
         of chips is more furniture than the eight sliders they belong to. */
      const flip=key=>`<button type="button" class="dirflip${cueFlipped(key)?' on':''}"
        data-act="lookflip" data-lookflip="${key}"
        title="Which way round it runs" aria-pressed="${cueFlipped(key)}">${ic('swap',12)}</button>`;
      const cue=(key, name, note, dflt)=>`
      <label class="rangerow"><span>${name}</span>
        <input type="range" min="0" max="100" step="5" data-lookpct="${key}" value="${px(key,dflt)}">
        <b>${px(key,dflt)}%</b>${flip(key)}</label>
      <div class="mini" style="--k:var(--brass)">${note}</div>`;
      if(S.device==='desk') return `
    <div class="section-h"><h2>Depth and light</h2><div class="rule"></div></div>
    <div class="mini" style="--k:var(--brass)">All of this is the phone's: it is about a board you tilt and hold, and a Mac sits still on a desk. Open the iPhone layout to set it.</div>`;
      return `
    ${/* ---- what the desk does while you are in something — decision 188 --
         Three answers rather than one. Fading the neighbours says "this is the
         thing", darkening the room says "the light is here" and leaving it
         alone says "you have simply come closer", which is the most honest
         reading of a camera and is why it is offered at all. It lives in Depth
         and light because it is about how solid the desk looks, which is what
         that door is for. */''}
    <div class="section-h"><h2>Zooming in</h2><div class="rule"></div></div>
    <div class="mini" style="--k:var(--brass)">Tapping something zooms the board into it where it sits. This is what the <b>rest</b> of the desk does while you are in there.</div>
    <div class="field" style="margin-top:10px">
      <div class="filterbar">${Object.entries(CAM_DIMS).map(([v,n])=>
        `<button class="fchip${(S.look.camdim||'fade')===v?' on':''}" data-camdim="${v}">${n}</button>`).join('')}</div>
    </div>
    <div class="section-h"><h2>Looking in</h2><div class="rule"></div></div>
    <div class="mini" style="--k:var(--brass)">Tilting the phone can move two different things, and they are worth having apart. <b>The desk</b> sets the board into the carcass and slides it behind the opening. <b>Windows</b> leave the desk still and move the view behind a window's frame, which is the same idea with a frame you can actually see. It asks iPhone for the motion sensor the first time you switch either on, and both stand still while you are carrying a tile or reading.</div>
    <div class="field" style="margin-top:10px">
      <div class="filterbar">${Object.entries(TILT_MODES).map(([v,n])=>
        `<button class="fchip${tiltMode()===v?' on':''}" data-parallax="${v}">${n}</button>`).join('')}</div>
      ${tiltsDesk()?`
      <label class="rangerow"><span>How deep the desk sits</span>
        <input type="range" min="0" max="34" step="1" data-lookpx="tiltdesk" value="${px('tiltdesk',16)}">
        <b>${px('tiltdesk',16)}px</b></label>
      <label class="rangerow"><span>Room around it</span>
        <input type="range" min="0" max="24" step="1" data-lookpx="deskinset" value="${px('deskinset',8)}">
        <b>${px('deskinset',8)}px</b></label>
      <div class="mini" style="--k:var(--brass)">How far the board slides, and how much room it has around it. The board is the back of the slot and the four walls join it to the opening, so it is never cut off — which means the room is always at least the slide, and this slider only adds more on top of that.</div>`:''}
      ${tiltsWindows()?`
      <label class="rangerow"><span>How far back a view is</span>
        <input type="range" min="0" max="30" step="1" data-lookpx="tiltwin" value="${px('tiltwin',11)}">
        <b>${px('tiltwin',11)}px</b></label>
      <div class="mini" style="--k:var(--brass)">How far behind its frame a window's view sits. Further back is more movement for the same tilt, which is what depth actually is.</div>`:''}
      ${tiltMode()!=='off'?`
      <label class="rangerow" style="margin-top:14px"><span>Which way it moves</span><b></b></label>
      <div class="filterbar">${[['','Against the tilt'],['1','With the tilt']].map(([v,n])=>
        `<button class="fchip${(S.look.tiltflip?'1':'')===v?' on':''}" data-tiltflip="${v}">${n}</button>`).join('')}</div>
      <div class="mini" style="--k:var(--brass)">A thing sitting in a recess hangs back when you turn the phone rather than chasing it, which is why it runs against the tilt. The other way round is here to be compared rather than because it is right.</div>`:''}
    </div>

    <div class="section-h"><h2>Books</h2><div class="rule"></div></div>
    <div class="field">
      <label class="rangerow"><span>How far a book turns</span>
        <input type="range" min="0" max="18" step="1" data-lookpx="bookdepth" value="${px('bookdepth',11)}">
        <b>${px('bookdepth',11)}px</b>${flip('bookdepth')}</label>
      <div class="mini" style="--k:var(--brass)">A book is a cylinder, not a box: it shows no flank, its round back simply turns away into shade. That is the cue working on the surface it suits, and it reads at a depth that would make a drawer look like a brick — which is why it is its own number. Zero is off, and ⇄ turns it the other way.</div>
    </div>

    <div class="section-h"><h2>Drawer fronts</h2><div class="rule"></div></div>
    <div class="mini" style="--k:var(--brass)">A drawer is a box, and the honest thing to show from the side is a flank. It is also nearly invisible: a front's whole character is the molding and the knob, and turned up far enough to read, a flank stops being a side and becomes a gray stripe. So the rest of these are drawn on the face the front actually has. They cost no width, which is what lets them survive at the size a drawer is really drawn. Each is off at zero, and <b>⇄ runs it the other way round</b> — there is no single right sign for all of them, and one pointing the wrong way is invisible until it sits beside one that is right.</div>
    <div class="field" style="margin-top:10px">
      <label class="rangerow"><span>How far a drawer stands out</span>
        <input type="range" min="0" max="18" step="1" data-lookpx="depth" value="${px('depth',11)}">
        <b>${px('depth',11)}px</b>${flip('depth')}</label>
      <div class="mini" style="--k:var(--brass)">The flank, in pixels — the side of the box you can see from where you are standing. Cards and pictures stand under this one too.</div>
      ${cue('arris', 'A chamfered edge', 'Two pixels of eased edge, brightening on the side turning towards you — the first thing in a room to catch light.', 0)}
      ${cue('facelight', 'Light across the face', 'The face itself lighter on the edge turning towards you and falling away on the other — what a spine does, on a flat surface.', 0)}
      ${cue('facesweep', 'A sweep of light', 'One broad band of light traveling across the front. Faint is varnish on wood; bright is glass, which this desk has been through once.', 0)}
      ${cue('recess', 'Set into the carcass', 'The lip of the desk laying a shadow across the front from the side you moved away from — the opening\'s depth rather than the drawer\'s.', 0)}
      ${cue('knobturn', 'The knob turns with you', 'The one part of a front that is already solid. The wood does not move; only the light on it does.', 0)}
      ${cue('fieldshift', 'The field shifts in its frame', 'A paneled field is set back inside its molding, so it slides against the frame. Real parallax rather than painted light, and the easiest to overdo.', 0)}
    </div>

    <div class="section-h"><h2>Both</h2><div class="rule"></div></div>
    <div class="field">
      <label class="rangerow"><span>How much they turn with the phone</span>
        <input type="range" min="0" max="100" step="5" data-lookpct="turn" value="${px('turn',100)}">
        <b>${px('turn',100)}%</b></label>
      <div class="mini" style="--k:var(--brass)">Tilting moves your eye, and everything above turns to follow it — tilt right and you see more of every left-hand side. This is how far that goes on top of where a thing already stands. At zero they are all still true, just still: the perspective reads with the phone flat on a table, so you can have it without the movement or the board sliding without it.</div>
    </div>`;})() : '',

    at('time') ? `
    <div class="section-h"><h2>A day's work</h2><div class="rule"></div></div>
    <div class="field">
      <label class="rangerow"><span>Hours of real work in a day</span>
        <input type="range" min="1" max="12" step="0.5" data-looknum="workday" data-unit="h" value="${workday()}">
        <b>${workday()}h</b></label>
      <div class="mini" style="--k:var(--brass)">Urgency is a subtraction: the days you have, less the days the work will take. This is what turns an estimate in minutes into days — at ${workday()} hours, something that will take three hours needs ${Math.round((3/workday())*100)/100} of a day. Set it low and more things read as urgent; set it to what you actually get done and the ladder tells the truth.</div>
    </div>

    <div class="section-h"><h2>The ladder</h2><div class="rule"></div></div>
    <div class="rows">${URGES.map(([n,nm,ds])=>
      `<div class="row"><span class="urgebtn u${n} on">${esc(nm)}</span>
        <div class="body"><div class="snip">${esc(ds)}</div></div></div>`).join('')}</div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">A <b>hard</b> deadline can reach every rung — missing it costs something. A <b>soft</b> one is a day you gave yourself, so it always reads one rung lower and never reaches Behind. A thing with no deadline has no urgency at all, which is a different answer from Room.</div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">Give a drawer <b>Sorted by → Most urgent first</b>, or a magic drawer the rule <b>Urgency is more than 2</b>, and this becomes a board.</div>` : '',
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
    at('claude') ? claudeSection() : '',
    at('about') ? `
    <div class="section-h"><h2>Start over</h2><div class="rule"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pill" data-act="reseed">Reset to the sample desk</button>
      <button class="pill" data-act="wipe" style="color:#C0563F">Erase everything</button>
    </div>` : '',
    `<div style="height:20px"></div>`
  ].join('');
}

/* ---- Settings → Claude — decision 306 ------------------------------------
   The key is a password field that is never filled back in: once kept, the
   door says it is kept and shows its last four characters, and Take it away
   removes it. What is sent, and when, is said here in plain words, because
   it is the one place Bureau talks to anything but the device it is on. */
function claudeSection(){
  const cfg = aiCfg() || {}, has = !!cfg.key, model = modelOf();
  return `
    <div class="section-h"><h2>Your key</h2><div class="rule"></div></div>
    ${has ? `<div class="mini" style="--k:var(--brass)">A key ending <b>${esc(cfg.key.slice(-4))}</b> is kept on this device.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="pill" data-act="aitest">${ic('check',13)} Try it</button>
        <button class="pill" data-act="aiforget" style="color:#C0563F">Take it away</button></div>`
    : `<div class="mini" style="--k:var(--brass)">An Anthropic API key, from <b>console.anthropic.com</b>, lets the fountain pen ask Claude. Each ask is billed to that account.</div>
      <input id="aikey" class="pfield" type="password" autocomplete="off" spellcheck="false"
        placeholder="sk-ant-…" style="width:100%;margin-top:8px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <button class="pill solid" data-act="aikeep">${ic('check',13)} Keep it</button></div>`}
    <div class="section-h" style="margin-top:18px"><h2>Which Claude</h2><div class="rule"></div></div>
    <div class="rows">${AI_MODELS.map(([id, nm, ds])=>
      `<div class="row${id===model?' on':''}" data-aimodel="${id}" role="button" tabindex="0">
        <span class="kindmark">${ic(id===model?'check':'sparkle',13)}</span>
        <div class="body"><div class="title">${esc(nm)}</div><div class="snip">${esc(ds)}</div></div></div>`).join('')}</div>
    <div class="section-h" style="margin-top:18px"><h2>What is sent</h2><div class="rule"></div></div>
    <div class="mini" style="--k:var(--brass)">Nothing, until you press something that asks. Then only what the ask is about goes to Anthropic: what you typed, and the board it is for (its names, pages and answers), never the whole desk. The key stays on this device, outside the desk, so a backup or an export never carries it.</div>
    <div class="mini" style="--k:var(--brass);margin-top:6px">Put the <b>fountain pen</b> on a board (Doodad → Tool) or in a drawer front. On the desk it builds a board, which arrives as a flat-pack to unfold; in a drawer it fills that drawer in. Hold a task for <b>Break Down</b>, a question for <b>Draft Answer</b>.</div>`;
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

/* ---- every board, zoomed out — decision 227 --------------------------
   **Pinch out on the desk and you see all of it.** The name at the top left
   used to open a panel with the boards drawn in it; Timothy asked for the
   zoom instead, and for it to be where boards are added and taken away. So
   it is a surface of its own over the desk (`#overview`, beside `#app` the
   way a panel is, so `render()` leaves it alone): every board laid out as
   it actually sits, each drawn small in the board's own checkerboard and
   framed in the carcass's wood, with what is on it at its real place and
   size, and a plus on every empty slot one step off the edge.

   **It is a picture, not a second board.** The boxes are drawn from the
   layout rather than as tiles, for the reason the old map gave: this is
   about shape — where things are, how full a board is — and thirty real
   tiles at five per cent would be a smear that costs a render.

   **The home board stays.** It is where the desk opens (`start`), it is
   drawn with a ring, and it has no cross: every other board can be taken
   away from here once it is empty on both devices. The home board is pinned
   the first time the zoom opens so adding a board to the left, which moves
   every number over by one, cannot move which one it is.

   The movement never holds anything up: going in, the board is navigated
   to and rendered at once, and the zoomed picture grows into it on top and
   is taken away when it has. */
const OVER = {on:false, cid:ROOT, ask:null};
const overviewOn = ()=> OVER.on;
function homeBoard(cid){
  const cfg = cid===ROOT ? (S.deskCfg || (S.deskCfg = {layout:'grid', sort:null})) : byId(cid);
  if(!cfg) return {x:0, y:0};
  if(!(cfg.start && isBoard(cid, cfg.start.x, cfg.start.y))) cfg.start = startOf(cid);
  return cfg.start;
}
function overCard(cid, x, y, home){
  const dv=dev(), g=gridOf(dv, cid), at=shelfAt(cid);
  const on = at.x===x && at.y===y, isHome = home.x===x && home.y===y;
  const x0=x*g.shelfW, y0=y*g.shelfH;
  const kids=childrenOf(container(cid)).filter(o=>!!ensureBox(o, dv, cid));
  const here=kids.map(o=>[o, lay(o, dv, cid)])
    .filter(([,b])=> b.x>x0 && b.x<=x0+g.shelfW && b.y>y0 && b.y<=y0+g.shelfH);
  /* Any board but the home one and the last, full or empty (decision 234):
     a board with things on it asks where they go before it goes. */
  const canGo = !isHome && boardsOf(cid).length>1;
  return `<button class="ovcard${on?' on':''}${isHome?' home':''}" data-shelfgo="${cid}:${x}:${y}"
      title="${isHome?'The tile the desk opens on':'Go to this tile'}">
    <span class="ovboard" style="--dcols:${g.shelfW};--drows:${g.shelfH}">
      ${here.map(([o,b])=>
        `<i style="--k:${objColour(o)};grid-column:${b.x-x0}/span ${Math.min(b.w, g.shelfW-(b.x-x0)+1)};grid-row:${b.y-y0}/span ${Math.min(b.h, g.shelfH-(b.y-y0)+1)}"></i>`
      ).join('')}</span>
    <u>${isHome ? 'home' : on ? 'here' : here.length ? here.length+' on it' : 'empty'}</u>
    ${canGo ? `<span class="ovgo" role="button" data-boardremove="${cid}:${x}:${y}"
      title="Take this tile away" aria-label="Take this tile away">${ic('x',12)}</span>` : ''}
  </button>`;
}
function overviewHTML(){
  const cid = OVER.cid;
  const sh = shelvesOf(cid), home = homeBoard(cid);
  const grows = !(cid!==ROOT && has(container(cid),'magic'));
  const pad = grows ? 1 : 0, W = sh.w + 2*pad, H = sh.h + 2*pad;
  /* The cards are sized to the screen: as big as they can be with every
     slot in view, in the proportions of one board on this device. */
  const g = gridOf(dev(), cid), aspect = g.shelfW / g.shelfH;
  const gap = 10, availW = Math.max(200, innerWidth - 32), availH = Math.max(200, innerHeight - 150);
  const cw = Math.floor(Math.min((availW - gap*(W-1))/W, ((availH - gap*(H-1) - 22*H)/H)*aspect));
  const cards = [];
  for(let j=0; j<H; j++) for(let i=0; i<W; i++){
    const x = i-pad, y = j-pad;
    if(isBoard(cid, x, y)) cards.push(overCard(cid, x, y, home));
    else if(grows && reachable(cid, x, y))
      cards.push(`<button class="ovcard ovadd" data-addboard="${cid}:${x}:${y}"
        title="Add a tile here"><span class="ovboard">${ic('plus',18)}</span><u>add</u></button>`);
    else cards.push(`<span class="ovgap"></span>`);
  }
  const n = boardsOf(cid).length;
  /* The question a full board asks before it goes, over the boards. */
  const a = OVER.ask;
  const ask = a ? `<div class="ovask" role="dialog">
      <b>${a.n} thing${a.n===1?' is':'s are'} on this tile</b>
      <i>Taking it away takes ${a.n===1?'it':'them'} too, unless ${a.n===1?'it goes':'they go'} somewhere first.</i>
      <button class="pill" data-act="ovremove" data-at="${a.cid}:${a.x}:${a.y}" data-mode="hold">${ic('archive',13)} Put ${a.n===1?'it':'them'} in the Void Drawer</button>
      <button class="pill ovdanger" data-act="ovremove" data-at="${a.cid}:${a.x}:${a.y}" data-mode="del">${ic('x',12)} Delete ${a.n===1?'it':'them'} with the tile</button>
      <button class="subtle-btn" data-act="ovkeep">Keep the tile</button>
    </div>` : '';
  return `${ask}<div class="ovhead"><b>${esc(cid===ROOT ? deskTitle() : boardName(container(cid)))}</b>
      <i>${n} tile${n>1?'s':''} · press one to go there, a plus to add one</i>
      <button class="ovclose" data-act="overclose" title="Back to the board" aria-label="Back to the board">${ic('x',16)}</button></div>
    <div class="ovgrid" style="--sw:${W};--cw:${cw}px;--gap:${gap}px;--ar:${aspect};${boardVarsOf(cfgOf(cid))}">${cards.join('')}</div>`;
}
function drawOverview(){
  let host = $('#overview');
  if(!host){ $('#frame').insertAdjacentHTML('beforeend', '<div id="overview" class="overview"></div>'); host = $('#overview'); }
  host.innerHTML = overviewHTML();
  return host;
}
/* Scale the grid so one card fills the screen — the picture of standing on
   that board — or back to nothing, which is the picture of all of them. */
function overFocus(host, card){
  const grid = host.querySelector('.ovgrid'); if(!grid || !card) return '';
  const r = card.querySelector('.ovboard').getBoundingClientRect(), gr = grid.getBoundingClientRect();
  const k = Math.max(innerWidth / r.width, innerHeight / r.height);
  const ox = r.left + r.width/2 - gr.left, oy = r.top + r.height/2 - gr.top;
  grid.style.transformOrigin = `${ox}px ${oy}px`;
  return `translate(${innerWidth/2 - (r.left + r.width/2)}px, ${innerHeight/2 - (r.top + r.height/2)}px) scale(${k.toFixed(3)})`;
}
function openOverview(cid){
  if(S.readId || S.writeId || S.viewId) return false;
  OVER.on = true; OVER.cid = cid || ROOT; OVER.ask = null;
  closePanel();
  const host = drawOverview();
  const grid = host.querySelector('.ovgrid'), card = host.querySelector('.ovcard.on');
  const from = overFocus(host, card);
  if(grid && from && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    grid.style.transition = 'none'; grid.style.transform = from; host.style.opacity = '0';
    grid.getBoundingClientRect();
    grid.style.transition = ''; grid.style.transform = ''; host.style.opacity = '';
  }
  host.classList.add('open');
  if(navigator.vibrate) navigator.vibrate(6);
  save();                         // pinning the home board is a write
  return true;
}
function refreshOverview(){ if(OVER.on) drawOverview().classList.add('open'); }
/* The question a full tile asks (decision 234). Since decision 274 it is
   asked from the board itself, zoomed out, so with no zoom out to ask it
   over it stands on its own over the board. */
function overAsk(a){
  OVER.ask = a;
  if(a) OVER.cid = a.cid;
  if(OVER.on) return refreshOverview();
  let host = $('#overview');
  if(!a){ if(host) host.remove(); return; }
  if(!host){ $('#frame').insertAdjacentHTML('beforeend', '<div id="overview" class="overview askonly open"></div>'); host = $('#overview'); }
  host.innerHTML = overviewHTML().replace(/<div class="ovhead">[\s\S]*$/, '');
}
const overCid = ()=> OVER.cid;
function closeOverview(to){
  const host = $('#overview');
  OVER.on = false; OVER.ask = null;
  if(!host) return;
  if(to) goShelfTo(to.cid, to.x, to.y);
  const card = to ? host.querySelector(`.ovcard[data-shelfgo="${to.cid}:${to.x}:${to.y}"]`) : host.querySelector('.ovcard.on');
  const grid = host.querySelector('.ovgrid');
  host.style.pointerEvents = 'none';
  host.id = 'overview-leaving';
  if(grid && card) grid.style.transform = overFocus(host, card);
  host.classList.remove('open');
  setTimeout(()=> host.remove(), 320);
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
const SCROLL = {key:null, top:0, left:0, flow:false};
const viewKey = ()=> S.view==='drawer' ? 'drawer:'+S.drawerId : 'desk';

/* ---- which shelf of a board you are on --------------------------------
   The state lives in grid.js beside the geometry that reads it; this is the
   half that renders. `goShelf()` is the one writer, and it takes a *step* —
   one shelf in one direction — because that is what every way of moving
   between them does: a swipe, an arrow key, a press on the map.

   Nothing here is stored. Which screen of a board you happened to be looking
   at is not a fact about the desk, and a desk should open on its middle shelf
   in the morning whatever you were doing at midnight. */
function goShelf(cid, dx, dy, soon){
  const at = shelfAt(cid);
  return goShelfTo(cid, at.x+dx, at.y+dy, soon);
}
/* ---- the drawer beside this one ----------------------------------------
   **Inside a container, sideways is the next container over** (2026-09-23).
   Up and down walks the pages of the board you are in; left and right walks
   the board it sits *on*, so a drawer is somewhere — "Kitchen is to the right
   of Garden" is something a thumb can learn.

   The order is **reading order in lanes**. A lane is a band of the parent
   board as tall as the first container in it: anything whose top edge starts
   inside that band is in the lane, ordered left to right. At the end of a lane
   the next one down carries on, and backwards the lane above — the way a line
   of text wraps, which is the only way "the one to the right" still has an
   answer at the right-hand edge. A container never placed on this device has
   no position to be beside anything and is left out. Undefined at either end,
   which is what makes the strip give rather than carry you round. */
function sideDrawer(cid, dir){
  const o = byId(cid); if(!o) return null;
  const up = o.parent || ROOT, dv = dev();
  const boxes = childrenOf(container(up))
    .filter(c=>isContainer(c) && c[dv] && c[dv].x && c[dv].w)
    .map(c=>({id:c.id, b:lay(c, dv, up)}))
    .sort((a,b)=> a.b.y-b.b.y || a.b.x-b.b.x);
  const lanes = [];
  boxes.forEach(it=>{
    const lane = lanes[lanes.length-1];
    if(lane && it.b.y < lane.bottom) lane.items.push(it);
    else lanes.push({bottom: it.b.y + it.b.h, items:[it]});
  });
  const order = lanes.flatMap(l=>l.items.sort((a,b)=> a.b.x-b.b.x || a.b.y-b.b.y)).map(it=>it.id);
  const i = order.indexOf(cid);
  return i<0 ? null : (order[i+dir] || null);
}
/* Going there. The parent board's shelf follows, so the way back out lands on
   the screenful the new drawer is on rather than the one you went in from. */
function goSideDrawer(id, soon){
  const d = byId(id); if(!d || !isContainer(d)) return false;
  const up = d.parent || ROOT, b = d[dev()];
  if(b && b.x) setShelf(up, shelfOfBox(b, dev(), up).x, shelfOfBox(b, dev(), up).y);
  S.view='drawer'; S.drawerId=id; S.kindFilter=null;
  if(soon) renderSoon(); else render();
  return true;
}
function goShelfTo(cid, x, y, soon){
  const was = shelfAt(cid);
  if(!setShelf(cid, x, y)) return false;
  /* **On a phone that scrolls, down is a scroll and not a render** (decision
     209). The whole column is already drawn, so a new row of shelves is a
     place further down the same scroller; only a new column is a new window. */
  /* …and across is a scroll too, since the phone scrolls every way. */
  if(flows()){
    const at = shelfAt(cid);
    if(at.x!==was.x || at.y!==was.y){ scrollToShelf(cid, at.y, at.x); litDots(cid); }
    return true;
  }
  if(soon) renderSoon(); else render();
  return true;
}
/* Scroll the live board to the top of a row of shelves — smoothly, unless
   asked not to move. SCROLL follows at once, so a render landing mid-glide
   puts the board where it is going rather than where it was. */
/* A glide the app started already knows where it is going, so the tiles it
   passes on the way are not where you are, until a finger takes over. */
const GLIDE = {at:0};
const GLIDE_MS = 900;
function scrollToShelf(cid, y, x, jump){
  const sc = $('#app .scroll.deskscroll'), grid = sc && sc.querySelector('#drawergrid');
  if(!sc || !grid || (grid.dataset.gridfor||ROOT)!==cid) return;
  const top = tileTop(cid, y, sc, grid);
  const across = x!=null && dev()==='phone' && flows();
  const left = across ? tileLeft(cid, x, sc, grid) : sc.scrollLeft;
  SCROLL.top = top; SCROLL.left = left; GLIDE.at = Date.now();
  const still = jump || matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{ sc.scrollTo({top, left, behavior: still ? 'auto' : 'smooth'}); }
  catch(_){ sc.scrollTop = top; sc.scrollLeft = left; }
}
/* **Settle a zoom** (decision 274): the new cell is laid out by a render,
   and the point that was under the fingers (`bx`,`by`, in board cells) is
   put back under them, at `sx`,`sy` in the scroller's own box. Then which tile you are on is the
   one in the middle of the screen, as after any scroll. Returns the zoom it
   settled on, which the board's range may have held back. */
const g0gap = cid => gridOf(dev(), cid).gap;
function zoomCommit(cid, z, at){
  const got = setZoom(cid, z);
  render();
  const sc = $('#app .scroll.deskscroll'), grid = sc && sc.querySelector('#drawergrid');
  if(!sc || !grid || (grid.dataset.gridfor||ROOT)!==cid) return got;
  /* The point is carried in board cells, not the grid's pixels: a Mac grows
     its pad as it zooms out, which moves the grid's corner under it. */
  if(at){
    const sh = shelfShift(cid), cell = CELL[dev()] + g0gap(cid);
    sc.scrollLeft = grid.offsetLeft + (at.bx - sh.x)*cell - at.sx;
    sc.scrollTop  = grid.offsetTop  + (at.by - sh.y)*cell - at.sy;
    /* **The settle is drawn, never waited for** (decision 38): the board is
       already at the zoom it settled on, and is drawn from the size the
       fingers left it at to this one, about the same point. */
    if(at.from && Math.abs(at.from/got - 1) > 0.004 && !matchMedia('(prefers-reduced-motion: reduce)').matches){
      const ox = (at.bx - sh.x)*cell, oy = (at.by - sh.y)*cell;
      grid.style.transformOrigin = `${ox}px ${oy}px`;
      grid.style.transition = 'none';
      grid.style.transform = `scale(${(at.from/got).toFixed(4)})`;
      void grid.offsetWidth;
      grid.style.transition = 'transform .24s cubic-bezier(.2,.8,.3,1)';
      grid.style.transform = '';
      setTimeout(()=>{ if(grid.isConnected){ grid.style.transition=''; grid.style.transformOrigin=''; } }, 280);
    }
  }
  SCROLL.left = sc.scrollLeft; SCROLL.top = sc.scrollTop; GLIDE.at = Date.now();
  const g = gridOf(dev(), cid), t = tileUnder(sc, grid, g);
  if(isBoard(cid, t.x, t.y)) setShelf(cid, t.x, t.y);
  litDots(cid);
  // …and the scroll settles on the cells, once the settle has been drawn
  if(at) setTimeout(()=>snapCells(sc), 250);
  return got;
}
/* **The view held still after a tile is added to the left or above**,
   which moves every box a tile along in the numbers and so the grid under a
   kept scroll: the scroll moves with it. A phone only; a Mac's board is
   centred in its window and finds its own place. */
function holdView(cid, left, up){
  if(dev()!=='phone' || !flows()) return;
  const sc = $('#app .scroll.deskscroll'); if(!sc) return;
  const g = gridOf(dev(), cid), cell = CELL[dev()] + g.gap;
  if(left) sc.scrollLeft += g.shelfW*cell;
  if(up) sc.scrollTop += g.shelfH*cell;
  SCROLL.left = sc.scrollLeft; SCROLL.top = sc.scrollTop; GLIDE.at = Date.now();
}
/* Out as far as the whole board goes: what "See every tile" in a
   container's Board settings does now there is no zoom out of its own. */
function zoomFit(cid){
  const id = cid || ROOT;
  if(id!==((S.view==='drawer' && S.drawerId) || ROOT)){
    S.view = id===ROOT ? 'desk' : 'drawer'; S.drawerId = id===ROOT ? null : id; render(); }
  zoomCommit(id, zoomRange(id).min);
}
/* Stand on the tile you are on, now: after a render that moved the numbers
   under the scroll (a tile added to the left or above), the kept offset is
   somewhere else. A no-op on a board that does not scroll. */
function landOnShelf(cid){
  if(dev()!=='phone' || !flows()) return;
  const at = shelfAt(cid);
  scrollToShelf(cid, at.y, at.x, true);
}
/* How far the shelf you are on is from the board's origin, in cells.

   **A box in the model is in board cells and a cell on the screen is in shelf
   cells, and the two are only the same on the first shelf.** `gridTile()`
   subtracts this as it draws (`SHELFSHIFT` in tiles.js), which is the whole of
   the shelf system — but anything that reads a cell *off* the screen, or
   writes a box *onto* it, has to make the same conversion or it is a shelf
   out. On a Mac it is always zero: the whole board is drawn and scrolled
   rather than windowed, so there is nothing to shift. See decisions 102, 141. */
/* …and on a Mac zoomed out since decision 274, which is drawn with the pad
   of empty slots round it the way a phone is: the shift is the pad. */
const shelfShift = cid => (S.device==='phone' || padded(undefined, cid)) ? shelfOrigin(cid) : {x:0, y:0};
const shelfTop  = cid => shelfShift(cid).y;
const shelfLeft = cid => shelfShift(cid).x;

/* ---- putting what is already here onto the middle shelf ----------------
   Every box on the desk was written when a board was one screen wide and as
   tall as it needed to be. Under the shelves that is the **top-left** of nine,
   and you start on the middle one — so a desk that has been used would open on
   an empty shelf with everything you own one swipe up and to the left.

   It cannot be done in the migration: a shelf is as tall as whatever fits on
   *this* screen, and nothing knows that number until the board has been
   measured once. So it happens on the first render per device that has a
   measurement, and says so in `S.centred` — which is stored, because it must
   happen exactly once and a second pass would push everything off the desk.

   Only the desk's own board, and only the objects on it: a drawer is one shelf
   and its contents are already on it. */
function centreDesk(){
  const dv = dev();
  S.centred = S.centred || {};
  if(S.centred[dv]) return false;
  /* A desk carved a cell at a time (decision 283) has no middle tile to move
     anything down to: what was written at the corner stays at the corner. */
  S.centred[dv] = true;
  return false;
}

/* ---- the desk down to the boards it uses — decision 220 ----------------
   Migration 46 marks a desk from before boards were added one at a time, and
   this does the work the first time there is a measurement to do it with:
   every board with nothing on it, on either device, is taken away, one at a
   time so the rectangle can close up behind each, and never the last. Where
   you are standing is forgotten, so the desk opens on what is left. */
function trimDesk(){
  const cfg = S.deskCfg;
  if(!cfg || !cfg.trim) return false;
  const dv = dev();
  if(!MEASURE[dv].w || !MEASURE[dv].room) return false;
  delete cfg.trim;
  /* A tile of one cell (decision 283) would be trimmed to the outline of what
     stands on it, which is not a desk: the flag is spent and nothing goes. */
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
  /* A board is nine screens, so the thing to do first is **go to the shelf it
     landed on** — otherwise a new object made while a shelf was full lands on
     the one next door and it looks exactly like nothing happened. On a Mac
     nothing is windowed and the scroll below does the work. */
  const home = o && (o.parent||ROOT);
  if(o && dev()==='phone' && (S.view==='drawer' ? S.drawerId===home : home===ROOT)){
    const s = shelfOfBox(lay(o, dev(), home), dev(), home);
    /* A phone that scrolls only has to change column; the scroll below
       brings the row into view, and a glide to the shelf's top would fight
       it (decision 209). */
    goShelfTo(home, s.x, flows() ? shelfAt(home).y : s.y);
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
    /* …and if a sorting drawer on this board caught it, say so. After the
       drop has landed and the burst has gone, so the two read as "it arrives,
       and a copy hops in there" rather than as two things at once. */
    setTimeout(()=>hopIntoCollector(id), 620);
  }
  if(!el || !sc) return;
  const er=el.getBoundingClientRect(), sr=sc.getBoundingClientRect();
  if(er.top < sr.top+8 || er.bottom > sr.bottom-8){
    sc.scrollTop += (er.top - sr.top) - Math.max(12, (sr.height - er.height)/3);
    SCROLL.top = sc.scrollTop;
  }
  // …and across, on a phone that scrolls that way too (273)
  if(er.left < sr.left-1 || er.right > sr.right+1){
    sc.scrollLeft += (er.left - sr.left) - Math.max(0, (sr.width - er.width)/2);
    SCROLL.left = sc.scrollLeft;
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
  const r=railCfg(), b=RAILBAR;
  /* Tucked, the front is only its knob, floating where the front was. It is
     still `.deskrail`, so the pull, the tap home and the Void Drawer are the
     same gestures on the same element; sizeGrid() leaves a tucked one out of
     the arithmetic. */
  if(tucked()) return `<nav class="deskrail tucked ks-${r.size}" data-rail>
    <i class="pull railknob ${dressAs('kn',r.knob)}" data-act="railout"
      ${r.knobc?`style="--knob:${esc(r.knobc)}"`:''}
      title="Home Knob — tap for home, pull up to make something, flick down or hold to bring the drawer front back"></i>
  </nav>`;
  /* With the bar in it (decision 204) the front is three columns: where you
     are and the search on the left, the knob in the middle where it always
     was, and the tools on the right. The two sides are equal columns so the
     knob stays on the centre line whatever the board is called. It is still
     a `.gridbar`, with `inrail` to say where, so everything that looks for
     the bar finds it; what measures the room above the board asks for a bar
     that is a *child* of `.main`, which this is not. */
  return `<nav class="deskrail${b?' withbar':''}${UNTUCK.rail?' unfold':''} ${dressAs('tx',r.tex)} ks-${r.size}" data-rail style="height:${REVEAL.rail}px">
    <i class="dgrain"></i>
    ${b?`<div class="gridbar inrail${b.where?' named':''}"><div class="railside railleft">${b.where}${b.left}</div>`:''}
    <i class="pull railknob ${dressAs('kn',r.knob)}" data-act="railout"
      ${r.knobc?`style="--knob:${esc(r.knobc)}"`:''}
      title="Home Knob — tap for home, pull up to make something"></i>
    ${b?`<div class="railside railright">${b.right}</div></div>`:''}
  </nav>`;
}

/* ---- the Home Knob, on a Mac -------------------------------------------
   A phone gets the whole drawer front along the bottom of the carcass, because
   a phone screen has a bottom: a strip below the board that is not board and
   never can be. A Mac window has no such strip — the board fills it and
   scrolls — so the same piece of furniture is a **knob on its own**, turned out
   of the same wood, floating in the bottom right corner and staying there
   however far the board scrolls under it.

   It answers the same three things the rail's knob does, in the shapes a mouse
   has rather than the ones a thumb has:

     tap                  home, or up one drawer
     drag a little        the Void Drawer opens
     drag onto bare board make something in that cell

   …and it is a drop target for the fourth: carry a tile onto it and the object
   goes into the Void Drawer, which is the Mac's half of decision 107.

   Same `railCfg()` as the rail, so the shape, the size and the colour set in
   the desk's own editor dress both — there is one knob in this app and this is
   where it stands when there is no rail to stand on. */
function deskKnob(){
  const r=railCfg();
  return `<nav class="deskknob ks-${r.size}" data-rail>
    <i class="pull railknob ${dressAs('kn',r.knob)}" data-act="railout"
      ${r.knobc?`style="--knob:${esc(r.knobc)}"`:''}
      title="Home Knob — tap for home, drag off for the Void Drawer, drag onto a bare cell to make something"></i>
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
  RAILBAR = null;
  try{
    const body = S.view==='drawer' ? viewDrawer()
               : viewDesk();        // the desk is the only other place there is
    return `<div class="main">${body}${S.device==='phone'?deskRail():deskKnob()}</div>`;
  } finally { endPass(); }
}

/* The same thing, for somewhere you are *not*. The pager slides the board you
   are on off the screen and the neighbouring one on, so it needs that
   neighbour drawn before you have gone there — which means building it with S
   pointed somewhere else for the length of one string, and putting S back.
   `at` is {view, drawerId} and optionally {page}.

   Two things it must not leave behind: the id on the grid, because there would
   momentarily be two elements called #drawergrid and sizeGrid() measures the
   first one it finds; and the remembered **shelf**, which is per container and
   not the pager's to change until the swipe is committed. */
function previewHTML(at){
  const was={view:S.view, drawerId:S.drawerId, kindFilter:S.kindFilter};
  const cid = at.drawerId || ROOT, wasShelf = SHELF[cid];
  S.view=at.view; S.drawerId=at.drawerId||null; S.kindFilter=null;
  if(at.shelf) SHELF[cid]=at.shelf;
  let html='';
  try{ html=viewHTML(); }
  finally{
    S.view=was.view; S.drawerId=was.drawerId; S.kindFilter=was.kindFilter;
    if(at.shelf){ if(wasShelf==null) delete SHELF[cid]; else SHELF[cid]=wasShelf; }
  }
  /* Two things it must not leave behind, and now three: the **Home Knob**, which
     is `position:fixed` and so would draw a second one over the first for the
     length of a swipe. It has no nesting, so a non-greedy match is exact. */
  return html.replace(/ id="drawergrid"/g, '')
             .replace(/<nav class="deskknob[\s\S]*?<\/nav>/g, '');
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
  const key = (wood||'') + '|' + ((S.look&&setting('style'))||'');
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
  if(wasEl){ SCROLL.top=wasEl.scrollTop; SCROLL.left=wasEl.scrollLeft; }
  /* The room you are standing in (decision 293), worked out before anything
     reads a setting; walking into or out of a bench that looks different
     repaints the root first, so the board is built in its own aesthetic. */
  envSync();
  if(lookSig() !== LOOKSIG.v) applyLook();
  // the way back is only for the drawer a front notepad brought you to (297)
  if(S.backTo && !(S.view==='drawer' && S.drawerId===S.backTo.to)) S.backTo = null;
  /* Written wholesale, so anything else living on this element has to be
     restated here or it is wiped by the next render — which for `tilting` meant
     the cavity worked until you ticked something and then silently stopped.
     It is stated off `S.look` rather than asked of motion.js, because a class
     on the frame is a fact about the desk and not about the sensor's mood.
     See decision 108. */
  frame.className = (S.device==='desk' ? 'is-desk' : 'is-phone')
    + (S.device==='desk' ? '' : tiltClasses())
    + (S.device!=='desk' && flows() ? ' flowscroll' : '')
    + (S.device!=='desk' && rigidSwipe() ? ' rigid' : '');
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
  /* Put what is already on the desk onto the **middle** shelf, once per
     device. It needs a measurement, so on the very first render it does
     nothing and sizeGrid's re-render picks it up. See centreDesk(). */
  const trimmed = trimDesk();
  const centred = centreDesk() || trimmed;
  /* The board as big as what is on it (decision 287), before anything is
     drawn on it. A shift of its left or top edge moved every box under the
     kept scroll, so the scroll moves with it below. */
  const fitId = (S.view==='drawer' && S.drawerId) || ROOT;
  let fit = (S.view==='desk' || S.view==='drawer') ? fitBoard(fitId) : null;
  const placed = PLACED.n;      // ensureBox() may invent boxes as this builds
  $('#app').innerHTML = viewHTML();
  /* A thing placed by this build (ensureBox) can be what the board has to
     grow round; fitted again now, and built once more if it did, so the
     numbers settle in the render that put it there and not in some later
     one while you are holding something. */
  if(fit!==undefined && PLACED.n!==placed && (S.view==='desk' || S.view==='drawer')){
    const again = fitBoard(fitId);
    if(again){
      fit = fit ? {x:fit.x + again.x, y:fit.y + again.y} : again;
      $('#app').innerHTML = viewHTML();
    }
  }
  const key=viewKey(), now=$('#app .scroll');
  /* Turning the phone's scroll on or off is arriving somewhere as well: the
     scroller changes from a window to a column, and the offset it had means
     nothing in the other one (decision 209). */
  const flowed = flows(), moved = key!==wasKey || flowed!==SCROLL.flow;
  SCROLL.flow = flowed;
  if(moved){ SCROLL.top=0; SCROLL.left=0; }
  /* On a Mac nothing is windowed: the whole board is drawn and the shelf-rows
     you are not on are above and below in the scroller. So arriving at a board
     means scrolling to the row you are on — which for the desk is the middle
     one, and is what "you start in the centre" means on a device that can see
     three shelves at once.

     Asked for here and **done in sizeGrid()**, after the measurement: a row is
     as tall as the cell and the cell is not known until the board has been
     laid out once, so doing it here scrolls to a guess and then never corrects
     it. See wantScroll below. */
  /* A phone that scrolls is drawn the way a Mac is, up and down, so it
     arrives the same way. */
  if(moved && (S.device!=='phone' || flowed)) SHELFSCROLL.want = true;
  /* A phone scrolls sideways too (273), and a scroller that comes back with
     nothing to restore across sits at its left edge — the empty pad — which
     the scroll handler would then read as where you are. So it is put back on
     the tile you are on, the way arriving does. */
  if(S.device==='phone' && flowed && !SCROLL.left && $('#app #drawergrid')) SHELFSCROLL.want = true;
  /* Only when there is something to restore. Writing `scrollTop` on an element
     that was inserted a moment ago forces the browser to lay the whole board
     out then and there so it can work out the scroll range — nine milliseconds
     of every render, to put a scroller back to the top it already starts at. A
     paging phone board never scrolls at all (`overflow:hidden`, and the pages
     are the scrolling), and a board you have just navigated to starts at zero,
     so the write is skipped in both of the common cases and the layout
     happens once, where it belongs: at paint. A phone that scrolls (decision
     209) keeps its offset across a render the way a Mac does. */
  if(fit && !moved){
    const g = gridOf(dev(), fitId), cell = g.rowh + g.gap;
    SCROLL.left = Math.max(0, SCROLL.left + fit.x*cell);
    SCROLL.top = Math.max(0, SCROLL.top + fit.y*cell);
  }
  if(now && SCROLL.top) now.scrollTop=SCROLL.top;
  if(now && SCROLL.left) now.scrollLeft=SCROLL.left;
  SCROLL.key=key;
  /* …and on a Mac the shelf you are on **is where you have scrolled to**. The
     scroller is a brand-new element every render, so this cannot leak; it
     patches the dots in place rather than rendering, because re-laying a board
     out on every scroll event is the one thing a scroll must never do. */
  if(now && (S.device!=='phone' || flowed)) now.addEventListener('scroll', onBoardScroll, {passive:true});
  litSection(now);
  bindSortables();
  sizeGrid();
  repositionPanel();   // a bubble is pinned to a tile, and the tiles just moved
  /* The camera, re-applied. `render()` replaces `#app`, so the element
     carrying the transform goes with it — exactly why the bubble above has to
     be repositioned here too, and the precedent for doing it here at all.
     See decision 187. */
  applyZoom();
  /* The heap, re-bound to the tiles that have just been built. `render()`
     replaces `#app` wholesale, so a body's element is detached a moment later —
     bodies are kept by **id**, so a render in the middle of a fall is invisible
     and the pile carries on where it was. Off, it costs one function call and a
     read of `S.look`. See decision 166. */
  gravitySync();
  /* A render is not a change. Every mutation already says `save()` for itself,
     so all this has to catch is the one thing a *render* writes — a box
     invented by ensureBox() for an object seen in a layout for the first time.
     It used to save unconditionally, which at three thousand objects meant
     35ms of serialising an unchanged desk every 250ms while you dragged.
     See decision 64. */
  if(centred || PLACED.n!==placed) save(); else saveIfDirty();
}

/* ---- the scroll and the shelf, on a Mac -------------------------------
   Two directions, and they are the same fact. Arriving at a board scrolls to
   the shelf-row you are on (`want`), which has to wait for the measurement —
   a row is as tall as the cell and the cell is not known until the board has
   been laid out once. And scrolling *changes* which shelf you are on, because
   on a Mac there is nothing else it could mean.

   The dots are patched in place rather than re-rendered: laying a board out on
   every scroll event is the one thing a scroller must never make you do. */
const SHELFSCROLL = {want:false};
/* **Where a tile sits when you arrive at it** (decision 272): in the middle
   of the screen, with as many rows of the tiles above and below it as the
   screen has left over — three each on an iPhone, which shows fourteen. In
   scroller pixels, from the grid's own top. */
function tileTop(cid, y, sc, grid){
  const g = gridOf(dev(), cid), cell = CELL[dev()] + g.gap;
  const shows = sc ? Math.floor(sc.clientHeight / Math.max(1, cell)) : viewRows();
  const above = Math.max(0, Math.floor((shows - g.shelfH)/2));
  /* A board no taller than the screen is centred as a whole (decision 283):
     a tile is one cell, and centring one cell put the board off-centre by
     however far that cell was from its middle. */
  const row = g.rows <= shows ? (g.rows - shows)/2 + (g.pad||0)
    : y*g.shelfH - above + (g.pad||0);
  return Math.max(0, (grid ? grid.offsetTop : 0) + row*cell);
}
/* **A board wider than the screen is not left half off it** (decision
   274): a tile of five centred on a screen eight wide showed a cell and a
   half of the pad beside the desk's first tile. Where the board is wider
   than the screen, arriving stays inside it; the slots off its edge are
   still a scroll away, and a slot off the edge is arrived at plainly. Only
   sideways: up and down a board is barely taller than the screen, and held
   inside it the middle of the screen was in the next tile, which the snap
   then walked to. In cells from the board's corner. */
function inBoard(at, shows, span){
  return span > shows ? Math.max(0, Math.min(span - shows, at)) : at;
}
/* …and across (2026-09-29): a phone scrolls sideways too, and a tile is the
   screen's width, so the tile you arrive at fills it edge to edge. */
function tileLeft(cid, x, sc, grid){
  const g = gridOf(dev(), cid), cell = CELL[dev()] + g.gap;
  // centred exactly: a tile inset by the cavity leaves the same wood either side
  const spare = sc ? Math.max(0, sc.clientWidth - g.shelfW*cell)/2 : 0;
  const shows = sc ? sc.clientWidth / Math.max(1, cell) : VIEW_COLS;
  const col = g.cols <= shows ? (g.cols - shows)/2 : x*g.shelfW - spare/cell;
  const c0 = x>=0 && x<g.shelves.w ? inBoard(col, shows, g.cols) : col;
  // on whole cells, since centring one cell on an even screen is half of one (283)
  const c = Math.round(c0);
  return Math.max(0, (grid ? grid.offsetLeft : 0) + (c + (g.padX||0))*cell);
}
// which tile the middle of the screen is over, each way
function tileUnder(sc, grid, g){
  const cell = CELL[dev()] + g.gap;
  const midY = (sc.scrollTop - grid.offsetTop + sc.clientHeight/2) / cell - (g.pad||0);
  const midX = (sc.scrollLeft - grid.offsetLeft + sc.clientWidth/2) / cell - (g.padX||0);
  return {x: Math.floor(midX / g.shelfW), y: Math.floor(midY / g.shelfH)};
}
/* Which tile you are on **is where the middle of the screen is**, on a Mac
   and on a phone that scrolls. The dots are patched in place rather than
   re-rendered: laying a board out on every scroll event is the one thing a
   scroller must never make you do. */
/* ---- sections — decision 304 -------------------------------------------
   Which heading you are under is the last one whose top has gone past the
   top third of the screen: a heading half way down is what you are about to
   read, not what you are reading. Asked of the elements rather than the
   boxes, so a zoom, a pad or a list view all answer the same way. */
const LIPSEC = {cid:null, name:''};
const GOING = {at:0};
const GOING_MS = 1600;
function litSection(sc){
  sc = sc || $('#app .scroll'); if(!sc) return;
  const cid=(S.view==='drawer'&&S.drawerId)||ROOT, el=$('#app .lipsec .secname');
  if(!el) return;
  const top = sc.getBoundingClientRect().top + sc.clientHeight/3;
  let name = '';
  sectionsOf(cid).forEach(x=>{ const t = sc.querySelector(`[data-row="${x.o.id}"]`);
    if(t && t.getBoundingClientRect().top <= top) name = x.o.title || 'Untitled'; });
  LIPSEC.cid = cid; LIPSEC.name = name;
  if(el.textContent !== name) el.textContent = name;
}
/* Go to a heading: its top at the top of the screen, and on a phone its left
   edge at the screen's left, so the section reads from its first line. A
   scroll the app makes, so the snap leaves it where it lands. */
function goSection(id){
  const sc=$('#app .scroll'), t=sc && sc.querySelector(`[data-row="${id}"], [data-drawer="${id}"]`);
  if(!t) return false;
  const a=sc.getBoundingClientRect(), b=t.getBoundingClientRect();
  const to = {top: Math.max(0, sc.scrollTop + b.top - a.top), behavior:'smooth'};
  /* On a phone the board's own left edge goes to the screen's, so the
     columns sit where they always do and a thing half way across stays half
     way across; on a wider board than the screen, the thing's left edge. */
  if(S.device==='phone'){
    const o = byId(id), cid = (S.view==='drawer' && S.drawerId) || ROOT;
    const box = o && lay(o, dev(), cid), gap = gridOf(dev(), cid).gap || 0;
    // the board's first column, worked back from the thing's own edge and
    // column, since the grid element carries a pad of empty cells either side
    const step = box && box.w ? (b.width + gap)/box.w : 0;
    const first = box && box.x && step ? b.left - (box.x-1)*step : b.left;
    to.left = Math.max(0, sc.scrollLeft + first - a.left);
  }
  /* The press that asked for this was a finger, and the snap answers a
     finger's scroll by easing to the nearest cell as soon as the scroll
     pauses: in WebKit that was a few cells into the glide, and the board
     stopped there. The scroll is the app's, so the snap stands back while
     it glides (`GOING`; the finger's own listeners run after this one, so
     forgetting the finger here would be undone at once). */
  GOING.at = GLIDE.at = Date.now();
  SCROLL.top = to.top; if(to.left!=null) SCROLL.left = to.left;
  try{ sc.scrollTo(to); }catch(_){ sc.scrollTop = to.top; if(to.left!=null) sc.scrollLeft = to.left; }
  return true;
}
/* **Go to a thing where it lives** (decision 305): the board it is on,
   scrolled to it, and it lit a moment. A step inside a list or checklist is
   shown by the list it is in, on the board of the project it belongs to;
   anything else by its own container. */
function goThere(id){
  const o = byId(id); if(!o) return false;
  let board = stepOf(o) || null, at = o;
  if(board){ while(at.parent && at.parent!==board.id){ const up = byId(at.parent); if(!up) break; at = up; } }
  else { board = byId(o.parent) || null; }
  const cid = board ? board.id : ROOT;
  S.view = cid===ROOT ? 'desk' : 'drawer'; S.drawerId = cid===ROOT ? null : cid;
  render();
  requestAnimationFrame(()=>{
    goSection(at.id);
    const el = document.querySelector(`#app .grid [data-row="${at.id}"], #app .grid [data-drawer="${at.id}"]`);
    if(el){ el.classList.add('wanted'); setTimeout(()=>el.classList.remove('wanted'), 1600); }
  });
  return true;
}
function onBoardScroll(e){
  const sc=e.currentTarget;
  const cid=(S.view==='drawer'&&S.drawerId)||ROOT;
  SCROLL.top = sc.scrollTop; SCROLL.left = sc.scrollLeft;
  litSection(sc);
  snapSoon(sc);
  const g=gridOf(dev(), cid), grid=sc.querySelector('#drawergrid');
  const cell=CELL[dev()]+g.gap;
  if(!(cell>0) || !grid) return;
  if(Date.now() - GLIDE.at < GLIDE_MS && FINGER.at < GLIDE.at) return;
  const t = tileUnder(sc, grid, g);
  /* A scroll the app made (a restore clamped by a narrower board, a turn of
     the phone) can leave the screen over the empty pad. Only a person walks
     onto a slot; anything else keeps you where you were. */
  if(!isBoard(cid, t.x, t.y) && Date.now() - FINGER.at > USER_SCROLL_MS) return;
  // a Mac draws its whole row of tiles at once, so only down moves you there
  const x = dev()==='phone' && flows() ? t.x : shelfAt(cid).x;
  if(!setShelf(cid, x, t.y)) return;
  litDots(cid);
}
// the dot for the tile you are on, patched in place rather than rendered
function litDots(cid){
  const at=shelfAt(cid);
  $$('#app .shelfmark i').forEach(el=>{
    const p=(el.dataset.shelfgo||'').split(':');
    el.classList.toggle('on', +p[1]===at.x && +p[2]===at.y);
  });
}
/* ---- the snap — decision 272 -----------------------------------------
   Timothy: scrolling is smooth, and when it stops the edges of the screen
   line up with the edges of the grid, so it looks organised. So when the
   scroller has been still a moment — the momentum spent and no finger on
   it — it is eased the rest of the way to the nearest whole cell, both ways.
   Never while a finger is down (it would pull the board out from under it),
   never while a tile is being carried, whose own pan is moving it, and only
   after a scroll a person made — a wheel, a touch or a key in the last
   moment. A scroll the app made (arriving centred, `reveal()`, a thing
   brought into view) already put the board where it meant to. */
const FINGER = {n:0, wired:false, sc:null, at:0};
const USER_SCROLL_MS = 1500;
let SNAPT = 0;
/* Wired once from wire(), so the first touch of the first scroll is felt. */
function wireSnap(){
  if(FINGER.wired) return;
  FINGER.wired = true;
  document.addEventListener('touchstart', e=>{ FINGER.n = e.touches.length; FINGER.at = Date.now(); }, {passive:true, capture:true});
  const felt = ()=>{ FINGER.at = Date.now(); };
  document.addEventListener('wheel', felt, {passive:true, capture:true});
  document.addEventListener('keydown', felt, {passive:true, capture:true});
  const up = e=>{ FINGER.n = e.touches.length; FINGER.at = Date.now(); if(!FINGER.n && FINGER.sc) snapSoon(FINGER.sc); };
  document.addEventListener('touchend', up, {passive:true, capture:true});
  document.addEventListener('touchcancel', up, {passive:true, capture:true});
  document.addEventListener('touchstart', rigidStart, {passive:true});
  document.addEventListener('touchmove', rigidMove, {passive:false});
  document.addEventListener('touchend', rigidEnd, {passive:true});
  document.addEventListener('touchcancel', rigidBack, {passive:true});
}
/* ---- the rigid swipe — decision 274 ------------------------------------
   With `setting('flow')==='rigid'` the phone's scroller does not pan (its
   overflow is hidden and the grid refuses the touch, in chrome.css), and one
   finger is read here instead: the board follows it along whichever axis it
   set off on, and on letting go it glides to the next tile that way — past a
   fifth of a tile, or thrown — or back to the one it left. Exactly one tile
   per swipe, onto a slot too, where the plus is. Anything that is a Bureau
   gesture first (a carried tile, a held cell, a menu) keeps the finger, and a
   thing that scrolls inside a tile keeps its own scroll. */
const RIGID = {on:false};
function rigidStart(e){
  RIGID.on = false;
  if(!rigidSwipe() || !e.touches || e.touches.length!==1) return;
  const sc = e.target.closest && e.target.closest('#app .scroll.deskscroll');
  const grid = sc && sc.querySelector('#drawergrid');
  if(!sc || !grid) return;
  for(let n=e.target; n && n!==sc; n=n.parentElement){
    if(n.scrollHeight > n.clientHeight+1 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return;
  }
  const t = e.touches[0], cid = grid.dataset.gridfor || ROOT;
  Object.assign(RIGID, {on:true, sc, cid, x0:t.clientX, y0:t.clientY, t0:Date.now(),
    top:sc.scrollTop, left:sc.scrollLeft, axis:null, at:shelfAt(cid), d:0});
}
function rigidMove(e){
  if(!RIGID.on) return;
  if(!e.touches || e.touches.length!==1 || holdsFinger()){ rigidBack(); return; }
  const t = e.touches[0], dx = t.clientX - RIGID.x0, dy = t.clientY - RIGID.y0;
  if(!RIGID.axis){
    if(Math.hypot(dx, dy) < 8) return;
    RIGID.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
  }
  if(e.cancelable) e.preventDefault();
  RIGID.d = RIGID.axis==='x' ? dx : dy;
  GLIDE.at = Date.now();               // the tiles it passes are not where you are
  if(RIGID.axis==='x') RIGID.sc.scrollLeft = RIGID.left - dx;
  else RIGID.sc.scrollTop = RIGID.top - dy;
}
function rigidEnd(){
  if(!RIGID.on) return;
  RIGID.on = false;
  if(!RIGID.axis || !RIGID.sc.isConnected) return;
  const g = gridOf(dev(), RIGID.cid), cell = CELL[dev()] + g.gap;
  /* A screenful of whole cells, since a tile is one cell (decision 283) and
     a swipe that moved one would be a nudge. */
  const tile = Math.max(1, Math.floor((RIGID.axis==='x' ? RIGID.sc.clientWidth : RIGID.sc.clientHeight) / cell)) * cell;
  const v = RIGID.d / Math.max(1, Date.now() - RIGID.t0);
  // past a fifth of a tile, or thrown, and a throw has to have gone somewhere
  const go = Math.abs(RIGID.d) > tile/5 || (Math.abs(v) > 0.35 && Math.abs(RIGID.d) > cell/2);
  const step = go ? (RIGID.d < 0 ? 1 : -1) : 0;
  /* Exactly one tile's width or height from where it set off, never a
     centring: a board that fits the screen but for a row would otherwise
     arrive at the next tile without moving. What is under the middle of the
     screen then is the tile you are on, if there is one to be on. */
  const sc = RIGID.sc, gr = sc.querySelector('#drawergrid');
  const x = RIGID.axis==='x', from = x ? RIGID.left : RIGID.top;
  const max = x ? sc.scrollWidth - sc.clientWidth : sc.scrollHeight - sc.clientHeight;
  const want = Math.max(0, Math.min(max, from + step*tile));
  const top = x ? RIGID.top : want, left = x ? want : RIGID.left;
  SCROLL.top = top; SCROLL.left = left; GLIDE.at = Date.now();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{ sc.scrollTo({top, left, behavior: still ? 'auto' : 'smooth'}); }
  catch(_){ sc.scrollTop = top; sc.scrollLeft = left; }
  // `tileUnder()`'s sum, for where the glide is going rather than where it is
  const t = gr ? {
    x: Math.floor(((left - gr.offsetLeft + sc.clientWidth/2)/cell - (g.padX||0)) / g.shelfW),
    y: Math.floor(((top - gr.offsetTop + sc.clientHeight/2)/cell - (g.pad||0)) / g.shelfH)} : RIGID.at;
  if(reachable(RIGID.cid, t.x, t.y)) setShelf(RIGID.cid, t.x, t.y);
  litDots(RIGID.cid);
  if(step && want!==from && navigator.vibrate) navigator.vibrate(4);
}
function rigidBack(){
  if(!RIGID.on) return;
  const moved = !!RIGID.axis;
  RIGID.on = false;
  if(moved && RIGID.sc.isConnected){ RIGID.sc.scrollTop = RIGID.top; RIGID.sc.scrollLeft = RIGID.left; }
}
function snapSoon(sc){
  // a scroller a render has since replaced is nothing to snap, and must not
  // take the place of the one that replaced it (a zoom settling, 2026-09-30)
  if(!sc || !sc.isConnected) return;
  FINGER.sc = sc;
  clearTimeout(SNAPT);
  SNAPT = setTimeout(()=>snapBoard(sc), 170);
}
/* The scroll eased to the nearest whole cell both ways, whoever moved it:
   what a zoom settling asks for, and the plain half of `snapBoard()`. */
function snapCells(sc){
  if(!sc || !sc.isConnected || rigidSwipe()) return;
  const grid = sc.querySelector('#drawergrid'); if(!grid) return;
  const g = gridOf(dev(), grid.dataset.gridfor||ROOT), cell = CELL[dev()] + g.gap;
  if(!(cell > 4)) return;
  const near = (v, o, max) => Math.max(0, Math.min(max, Math.round((v - o)/cell)*cell + o));
  const top = near(sc.scrollTop, grid.offsetTop, sc.scrollHeight - sc.clientHeight);
  const left = near(sc.scrollLeft, grid.offsetLeft, sc.scrollWidth - sc.clientWidth);
  if(Math.abs(top - sc.scrollTop) < 0.75 && Math.abs(left - sc.scrollLeft) < 0.75) return;
  SCROLL.top = top; SCROLL.left = left; GLIDE.at = Date.now();
  try{ sc.scrollTo({top, left, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); }
  catch(_){ sc.scrollTop = top; sc.scrollLeft = left; }
}
function snapBoard(sc){
  if(!sc || !sc.isConnected || FINGER.n || $('#app .lifted, .pluckchip')) return;
  if(rigidSwipe()) return;            // the rigid swipe lands on its own tile
  if(Date.now() - FINGER.at > USER_SCROLL_MS) return;
  if(Date.now() - GOING.at < GOING_MS) return;      // going to a heading (304)
  const grid = sc.querySelector('#drawergrid'); if(!grid) return;
  const g = gridOf(dev(), grid.dataset.gridfor||ROOT), cell = CELL[dev()] + g.gap;
  if(!(cell > 4)) return;
  const near = (v, o, max) => Math.max(0, Math.min(max, Math.round((v - o)/cell)*cell + o));
  /* *A tile at a time* settles on the nearest whole tile, centred, rather
     than the nearest row: the same scroll, a coarser rest. */
  const cid = grid.dataset.gridfor||ROOT;
  const whole = dev()==='phone' && byTile();
  const t = whole ? tileUnder(sc, grid, g) : null;
  const ok = t && reachable(cid, t.x, t.y), at = ok ? t : shelfAt(cid);
  const top = whole ? Math.min(sc.scrollHeight - sc.clientHeight, tileTop(cid, at.y, sc, grid))
    : near(sc.scrollTop, grid.offsetTop, sc.scrollHeight - sc.clientHeight);
  const left = whole ? Math.min(sc.scrollWidth - sc.clientWidth, tileLeft(cid, at.x, sc, grid))
    : near(sc.scrollLeft, grid.offsetLeft, sc.scrollWidth - sc.clientWidth);
  if(Math.abs(top - sc.scrollTop) < 0.75 && Math.abs(left - sc.scrollLeft) < 0.75) return;
  SCROLL.top = top; SCROLL.left = left;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{ sc.scrollTo({top, left, behavior: still ? 'auto' : 'smooth'}); }
  catch(_){ sc.scrollTop = top; sc.scrollLeft = left; }
}

/* The graph-paper backdrop in arrange mode has to match the real column width,
   which is fluid — so measure it after layout rather than assuming it. */
/* Measure the real column width and make the rows match it, so every cell is a
   square. Runs after each render and on resize; if the measurement changes the
   cached cell size, re-render so row counts and drag maths agree with it. */
let sizing=false;
function sizeGrid(){
  const grid=$('#drawergrid'); if(!grid) return;
  /* **A phone on its side measures nothing.** Landscape has about a quarter of
     the vertical room, so measuring it cut the shelf from fifteen rows to four
     — and the shelf is the unit the window is cut from, so the one you were
     standing on became a slice of the board with nothing on it and the desk
     went blank until you turned the phone back. Holding the portrait geometry
     costs a letterboxed board while it is sideways and gives it back exactly as
     it was. See `sideways()` in grid.js. */
  if(sideways()) return;
  const g=gridOf();
  let w=cellW(grid,g);
  if(!(w>0)) return;
  const deskCell = ()=> MEASURE.desk.w ? MEASURE.desk.w/GRID.desk.cols : CELL.desk;
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
    // the bar rides in the rail on a phone (decision 204); only a bar that is
    // still standing above the board takes room from it
    const bar=main.querySelector(':scope > .gridbar, :scope > .searchtop, :scope > .toplip'), rail=main.querySelector('.deskrail:not(.tucked)');
    /* The lip is measured at its floor, because its height is what this
       writes: it takes the top half of the leftover (below). */
    const lip = bar && bar.classList.contains('toplip') ? bar : null;
    const barH = lip ? (parseFloat(getComputedStyle(lip).minHeight)||0)
               : bar ? bar.getBoundingClientRect().height : 0;
    // read the floor, not the margin — the margin is what this writes
    const gapMin = tucked() ? 0 : parseFloat(getComputedStyle(sc).getPropertyValue('--gapmin'))||0;
    const railMin = rail ? (parseFloat(getComputedStyle(rail).minHeight)||0) : 0;
    const room = main.clientHeight - barH - gapMin - railMin;
    /* **One shelf's width, not the drawn board's.** They were the same number
       until a container's board became its own tile times four, and then a
       drawer narrower than a shelf started measuring itself: the grid is
       `cols × rowh` wide, `rowh` is derived from this, and feeding the drawn
       width back in shrank the board by the same fraction on every render
       until there was nothing left of it. A shelf is the unit; what is drawn
       is a window onto it. See decision 188. */
    /* A board with a stated shape may be drawn narrower than the screen
       (decision 235), so its own width is no measure of the screen's: the
       scroller's content box is. Every other board still measures itself,
       which is the same number when it fills the width. */
    const cs = getComputedStyle(sc);
    /* …and a phone that scrolls sideways draws a board wider than the
       screen (2026-09-29), so it is never its own measure: the screen is. */
    /* The cavity's inset is a margin on the grid, so a tile that is to sit
       inside the opening is the screen less that margin either side. */
    const gm = flows('phone') ? 2*(parseFloat(getComputedStyle(grid).marginLeft)||0) : 0;
    /* The scroller's side padding on a phone that scrolls is only ever the
       zoom's centring (below), so it is not taken off the screen's width. */
    const boardW = flows('phone') ? sc.clientWidth - gm
      : w * VIEW_COLS;
    /* The rows the **screen** shows (decision 272), which since a tile is
       eight is not a tile's height: fourteen on an iPhone, one tile and three
       rows of each neighbour. */
    const was = viewRows('phone');
    if(MEASURE.phone.room!==room || Math.abs(MEASURE.phone.w-boardW)>0.5){
      MEASURE.phone.room=room; MEASURE.phone.w=boardW;
    }
    const rows=viewRows('phone');
    /* A phone that scrolls sideways draws its grid as wide as its columns
       times the cell (2026-09-29), so the grid measures back whatever cell it
       was given: the cell is the screen's width over a tile's eight. */
    /* …times the zoom (decision 274). `base` is the cell at no zoom, which
       is what the furniture round the board is sized from, so zooming moves
       the board and never the lip or the drawer front. */
    const base = MEASURE.phone.w > 0 ? MEASURE.phone.w / VIEW_COLS : w;
    if(flows('phone') && MEASURE.phone.w > 0) w = base * zoomOf(cid);
    if(rows!==was && !sizing){ sizing=true; try{ render(); } finally { sizing=false; } return; }
    /* Written only when they have actually changed. The markup already carries
       last render's numbers (see REVEAL), so on an ordinary render these agree
       and nothing is touched — and a style write that changes nothing is still
       a style write, which dirties layout and buys the board a second one
       before it can be painted. Rendering was doing two layouts to draw one
       screen. */
    /* **A board smaller than the screen sits in the middle of it.** A
       container's board is its own tile times four (decision 190), so it is
       very often shorter than a shelf — and the desk's way of taking up the
       slack is to split it between the reveal above and the drawer front
       below, which grows the *rail* by as much as it lowers the board and
       leaves the thing you came to look at below the middle of the opening.
       So a short board takes neither: the furniture stays at its minimum, the
       scroller is given the whole room, and the grid is centred inside it. The
       width centres itself (`narrowboard` in board.css); this is the other
       axis.

       **A container's board only.** A desk is nine shelves and is always
       taller than one, so it can never honestly be short — but the desk drawn
       on a *Mac window* in `is-phone` (which is what editing the phone layout
       from a Mac is) has 160px cells and five rows of them in 850px, and
       measured short. The scroller then centred its children, which on a
       scroller means the first one overflows the **top** and cannot be
       scrolled back to: the "You are arranging the iPhone layout" banner went
       behind the bar and the way out of that mode with it. */
    const drawn = Math.min(rows, drawRows(g, 'phone'));
    /* **A board of a stated shape is not short** (decision 249). It was
       centred in the whole room like a short drawer (decision 235), which took
       the lip down to its floor and the drawer front to its minimum: a board
       set to 8×14 sat lower than the same board unstated, the front thin and
       pushed to the bottom of the screen. It takes the leftover the way the
       default board does now, the top half on the lip and the rest in the
       front, so 8×14 stated and 8×14 by default are the same picture and a
       smaller board still has its name on top. */
    // the window is the screen's rows at no zoom, whatever the zoom draws in it
    /* Tucked away, the window is the whole room, not whole rows of it: with
       nothing above or below to take the leftover, a part row of board is
       better than a strip of nothing at the bottom of the screen. */
    const viewH = flows('phone') ? (tucked() ? room : rows*base) : drawn*w;
    const over = Math.max(0, room - viewH);
    /* With the name on the lip, the top half of the leftover is the lip's
       rather than a reveal under it: the wood above the board is one strip
       either way, and this way the name is in the middle of it (decision
       208). Since the board stopped at fourteen rows that leftover can be a
       cell or more, and a name sitting on top of an empty band of wood reads
       as a name that slipped. */
    /* **The lip is one height on every board** (decision 211): what a full
       shelf would leave above it, whether or not this board is short. A
       short board takes none of the leftover, and a lip sized off *its*
       leftover shrank on the way into a small drawer, so the board jumped
       by the difference the moment it opened. A short board's scroller gives
       the lip its share instead. */
    const lipTop = lip ? Math.floor(Math.max(0, room - rows*base)/2) : 0;
    const top = Math.floor(over/2), deep = railMin + Math.ceil(over/2);
    const gap = gapMin + (lip ? 0 : top), lipH = lip ? Math.round(barH + lipTop) : 0;
    if(lip && lipH!==REVEAL.lip){ REVEAL.lip=lipH; }
    if(lip && lip.style.height !== lipH+'px') lip.style.height = lipH+'px';
    if(gap!==REVEAL.gap){ REVEAL.gap=gap; sc.style.marginTop = gap+'px'; }
    if(rail && deep!==REVEAL.rail){ REVEAL.rail=deep; rail.style.height = deep+'px'; }
    /* **A phone that scrolls is given a viewport** (decision 209): exactly the
       height the shelf would have been, with every row of the column drawn
       inside it. Compared as numbers, because the style hands a length back
       as a string of its own and a string that differs by how it prints is a
       write, and a write is a second layout. `--flowh` is the same number for
       the sticky rim shading in chrome.css. */
    const flowH = flows('phone') ? viewH : 0;
    /* **A board zoomed out smaller than the window sits in the middle of
       it** (decision 274), by the scroller's padding, which `tileTop()` and
       `tileLeft()` read through the grid's own offset. */
    if(flowH){
      const zx = Math.max(0, Math.floor((boardW - drawCols(g, 'phone')*w)/2));
      const zy = Math.max(0, Math.floor((flowH - drawRows(g, 'phone')*w)/2));
      const px = zx ? zx+'px' : '', py = zy ? zy+'px' : '';
      if(sc.style.paddingLeft !== px){ sc.style.paddingLeft = px; sc.style.paddingRight = px;
        sc.style.setProperty('--padx', px || '0px'); }
      if(sc.style.paddingTop !== py){ sc.style.paddingTop = py; sc.style.paddingBottom = py; }
      // a board shorter than the screen has no viewport to stick the rim to
      sc.classList.toggle('midboard', !!zy);
    }
    if(flowH && Math.abs(flowH-REVEAL.h)>0.01) REVEAL.h = flowH;
    const tall = flowH ? flowH+'px' : '';
    const hNow = parseFloat(sc.style.height)||0, hWant = parseFloat(tall)||0;
    if(Math.abs(hNow-hWant)>0.01 || (!tall && sc.style.height)) sc.style.height = tall;
    if(flowH){
      if(Math.abs((parseFloat(sc.style.getPropertyValue('--flowh'))||0)-flowH)>0.01)
        sc.style.setProperty('--flowh', flowH+'px');
    } else if(sc.style.getPropertyValue('--flowh')) sc.style.removeProperty('--flowh');

  } else if(dev()!=='phone'){
    /* A Mac measures the same two numbers now, because a shelf is the
       coordinate unit on both devices and something has to say how tall one
       is. The **width** is the desk's full twenty-four columns whatever board
       is showing — the grid element itself is only as wide as its own columns
       (a drawer is one shelf, so a third of it, centred), so measuring the
       element would make a drawer's cell three times a desk's. The room is the
       scroller's own height, which is one shelf-row: the desk's other two rows
       are above and below it and you scroll to them. */
    /* The scroller's **content** box, not its client width. `clientWidth`
       includes the padding, and `.deskscroll` carries fourteen pixels of it
       either side — so the cell came out a whole twenty-eight pixels' worth
       too wide, `.grid`'s `max-width:100%` then clamped the element back to
       the honest width, and the columns and the row height disagreed by that
       much. The tiles are laid out by the grid and were right; the
       **checkerboard** is drawn from `--checkerx`, which is derived from the
       cell — so every square was a little too wide and the board drifted left
       under its own tiles, a couple of pixels at column two and most of a cell
       by column twenty-four. Measure what the grid actually gets. */
    const main2 = grid.closest('.main');
    const scs = sc ? getComputedStyle(sc) : null;
    const sidePad = scs ? (parseFloat(scs.paddingLeft)||0) + (parseFloat(scs.paddingRight)||0) : 0;
    const avail = sc ? Math.max(1, sc.clientWidth - sidePad) : w*drawCols(g);
    const room = sc ? sc.clientHeight : 0;
    const wasR = viewRows('desk');
    MEASURE.desk.w = avail;
    MEASURE.desk.room = room;
    if(viewRows('desk')!==wasR && !sizing){
      sizing=true; try{ render(); } finally { sizing=false; } return;
    }
  }
  /* Do NOT round. Columns are `1fr` and therefore fractional; rounding the row
     height to a whole pixel made rows and columns different sizes, and the
     error accumulated across the grid — a tile at column 16 sat ~7px from
     where the drag maths thought it was, which is why things far to the
     bottom-right were hardest to pick up. */
  /* On a Mac the cell is the **desk's** width over its twenty-four columns,
     not this board's width over its own — a drawer is one shelf, so its
     element is a third as wide, and measuring the element would make its cells
     three times the size of the desk's. The element is then given that width
     explicitly (`.grid` is `width:calc(var(--cols)*var(--rowh))` on a Mac), so
     the measurement above agrees with it once the first pass has settled. */
  const cell = dev()==='phone' ? w : deskCell() * zoomOf(cid);
  /* Same again, and this is the one that mattered: gridOfContainer() builds the
     board from the *last* measurement, so on any render where the window has
     not moved the measurement agrees with what is already on the element and
     there is nothing to write. `--cellw` and `--cellstep` used to be written
     here too and were read by nobody — two style writes per render for a value
     no rule has ever asked for. */
  const same = CELL[dev()]===cell && COLW[dev()]===cell;
  const changed = !sizing && Math.abs(CELL[dev()]-cell) > 0.25;
  /* A scroll is in pixels and the board is in cells, so a cell that comes out
     a different size than last time (the first measurement after a guess, a
     rotation back) carries the scroll with it, or the tile you were centred on
     slides by the difference times every cell above and beside it. */
  if(changed && CELL[dev()] > 0){
    const k = cell / CELL[dev()];
    SCROLL.top *= k; SCROLL.left *= k;
  }
  if(!same){
    CELL[dev()]=cell; COLW[dev()]=cell;
    grid.style.setProperty('--rowh', cell+'px');
    // a checker square is two cells each way — the same number now, but written
    // as two, because the two are measured separately and one may drift first
    grid.style.setProperty('--checkerx', 2*(cell+g.gap)+'px');
    grid.style.setProperty('--checkery', 2*(cell+g.gap)+'px');
    grid.style.gridAutoRows = cell+'px';
    const rr=(grid.style.gridTemplateRows.match(/repeat\((\d+)/)||[])[1];
    if(rr) grid.style.gridTemplateRows=`repeat(${rr},${cell}px)`;
  }
  if(changed){ sizing=true; try{ render(); } finally { sizing=false; } return; }
  /* The scroll the last render asked for, now that a row's height is known. */
  // …on a Mac, and on a phone that scrolls rather than pages (decision 209)
  /* …and a board the screen has come to rest off, over a slot you are not
     standing on, is put back on the tile you are (273). */
  if(!SHELFSCROLL.want && sc && dev()==='phone' && flows()){
    const cid = grid.dataset.gridfor || ROOT, at = shelfAt(cid), t = tileUnder(sc, grid, g);
    if(isBoard(cid, at.x, at.y) && (t.x!==at.x || t.y!==at.y) && !isBoard(cid, t.x, t.y)) SHELFSCROLL.want = true;
  }
  if(SHELFSCROLL.want && (dev()!=='phone' || flows())){
    SHELFSCROLL.want=false;
    const cid = grid.dataset.gridfor || ROOT;
    if(sc){
      const at = shelfAt(cid);
      SCROLL.top = tileTop(cid, at.y, sc, grid);
      sc.scrollTop = SCROLL.top;
      if(dev()!=='phone' || flows()){ SCROLL.left = tileLeft(cid, at.x, sc, grid); sc.scrollLeft = SCROLL.left; }
    }
  }
}

export { goThere, goSection, litSection, holdView, zoomCommit, zoomFit, landOnShelf, wireSnap, render, renderSoon, sizeGrid, shelfTop, shelfLeft, shelfShift, centreDesk,
  reveal, openOverview, closeOverview, refreshOverview, overviewOn, overAsk, overCid, viewHTML, previewHTML,
  goShelf, goShelfTo, sideDrawer, goSideDrawer, boardDimsField, shelfCountField, railToolsField, railToolsOf, RAIL_TOOLS,
  settingsPanel, toggleSettings, railObj, flipBlock, setTuck, tucked };
