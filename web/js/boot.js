/* ============================================================
   boot — load, wire, render, register the service worker
   ============================================================ */
import { $ } from './util.js';
import { plans, planFrom, stampPlan, planById, planSize, delPlan } from './plans.js';
import { refreshKinds , groupTogether, groupMates, travelWith, countOf, inFront } from './model.js';
import { S, KINDS, SHAPES, shapeChoices, SORTS, childrenOf, container, relate, deskOf, has, lateOn, isLate, knobOf,
  urgencyOf, urgeSaid, workday,
  isContainer, faceOf, PRIMARY, SECONDARY, MASTERS, inMaster, isCut, isPrimary, inFamily, barPct, marginOf, marginPlus,
  prioOf, repeatOf, repeatSaid, nextRepeat, boardLocked, BINDINGS, bindingOf, PANELS, panelOf,
  isHeld, heldObjects, tiltMode, READS, dz, ASPECT_KINDS } from './model.js';
import { shelfRows, shelvesOf, shelfAt, setShelf, freeSpot, anySpot, roomFor, boxOk, innerOf, colsOf,
  isBoard, boardsOf, addBoard, removeBoard, dimsOf, rangeOfKind, randomSizeOf, inRange, TILE, viewRows, flows, zoomOf, zoomRange, setZoom, startOf, snapZoom, boardHolds, fitAll, fitBoard, MARGIN } from './grid.js';
import { create, setBoardDims, setPin, togglePin, del, delMany, delDrawer, undo, redo, toggleDone, spawnNext, setGridSize,
  CONTROLS, ctlSaid, ctlIsOn, ctlPress,
  holdIt, unholdIt , toast, someKind, furnish, loadTexts } from './mutations.js';
import { applyLook, applyStyle, STYLES, panelSlots, borderSlots, knobSlots, plateSlots, textureSlots,
  bindingSlots, stockSlots, famSlots, famAll, dress, styleKey, stockNow, randomLook,
  palNow, CHECKS } from './look.js';
import { render, sizeGrid, viewHTML, reveal, settingsPanel, goShelf, goShelfTo, shelfShift, openOverview, closeOverview, overviewOn, zoomCommit } from './views.js';
import { openSetup, setupOpen, SETUPS, setupAnswer, closeSetup } from './setup.js';
import { tileTap } from './tiles.js';
import { setMinuteHandler, mindTheTime, checkAlarms, guttered,
  activeTap, actOf, isActive, metroGoing, stopAllMetros, activeFlame } from './active.js';
import { overlayHTML, objectPanel, modalNewObject, holdPanel, schedulePanel, closePanel,
  sampleObject, sampleTile, openCtx, tagFirstPanel } from './panels.js';
import { wire, newOfKind } from './wire.js';
import { openingFor, stepDrawer, spray, sprayAt, sprayCount, sprayNow, sprayMark, SPRAYS,
  applyTilt, tiltTo, tiltRecentre } from './motion.js';
import { gravityReport, gravitySettle, gravityApply, gravityWake,
  gravityGrab, gravityDrag, gravityDrop } from './gravity.js';
import { load, writeNow, save, hydrateAssets, pasteObjects, migrate } from './persist.js';
import { renderSheet, openWriter, openRead, openViewer, closeSheet, asMarkdown , openZoom, openCard } from './sheet.js';
import { openPaint, closePaint, paintOpen, PT, artLayer } from './paint.js';
import { gather } from './mutations.js';
import { tugOf } from './model.js';
import { DECOR, DECOR_KEYS, decorSVG, decorSuits, decorFor, decorRest } from './decor.js';

/* ---- the keyboard is not a resize — decision 84 ------------------------
   `100vh` on iOS is the *large* viewport and deliberately ignores the software
   keyboard: a surface sized in vh stays full height while half the screen is a
   keyboard, and Safari then shoves the whole thing upward to get the caret on
   screen — which is how the page you were typing on ended up above the top of
   it. `dvh` does not help; it tracks the browser's own chrome, not the
   keyboard. `visualViewport` is the only honest number there is.

   One custom property on the root, written the way sizeGrid() writes what it
   measures, so the stylesheet does the rest and nothing has to be told. The
   fallback in the CSS is `100vh`, so a browser without visualViewport gets
   exactly what it got before. */
function watchViewport(){
  const vv = window.visualViewport;
  if(!vv) return;
  /* Both numbers: the height it has left, and how far down the layout viewport
     that window has slid. Safari scrolls the page under a fixed shell to chase
     a caret, so a surface anchored at `top:0` can end up above the screen even
     when it is the right height. */
  /* And a third: the height with **no keyboard**, which is the tallest the
     visual viewport has been at this width. The phone's reading surface is
     sized from it, so the keyboard comes up over the page rather than the page
     shrinking to fit above it — Timothy's call, 2026-09-28 — and `--kbh`, what
     the keyboard is taking, is room the field keeps at its foot so the last
     lines can still be scrolled above it. A new width is a turned phone, and
     starts the tallest over. */
  let tall = 0, wide = innerWidth;
  const write = ()=>{
    const el=document.documentElement.style;
    if(innerWidth !== wide){ wide = innerWidth; tall = 0; }
    tall = Math.max(tall, vv.height);
    el.setProperty('--vvh', vv.height+'px');
    el.setProperty('--vvt', (vv.offsetTop||0)+'px');
    el.setProperty('--rvh', tall+'px');
    el.setProperty('--kbh', Math.max(0, tall - vv.height)+'px');
  };
  vv.addEventListener('resize', write);
  vv.addEventListener('scroll', write);
  write();
}

const restored = load();
// every board as big as what is on it before anything is drawn (decision 286)
fitAll();
const hash = (location.hash||'').replace('#','');
if(hash==='desk') S.view = hash;
$('#frame').insertAdjacentHTML('beforeend', overlayHTML());
wire();
watchViewport();
applyLook();
render();
/* The shelf follows its setting from the first frame. It starts nothing unless
   the setting is on, and iOS will already have been asked — permission is
   remembered per origin, so a granted desk picks the sensor back up on launch
   without prompting again. See decision 108. */
applyTilt();
/* Away and back: wherever you are holding the phone *now* is the new neutral.
   Without this you return to a shelf shoved into a corner and it eases out of
   it over several seconds, which reads as a bug. */
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) tiltRecentre(); });
// settings is a sheet over the desk now, not a place you navigate to
if(hash==='settings') settingsPanel();
hydrateAssets();
if(!restored) writeNow();
save();

/* The words a random thing is born with (decision 244), fetched once the
   desk is up rather than parsed on the way to it. */
setTimeout(loadTexts, 1200);

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{ /* file:// or unsupported */ });
  });
}

// The console/test surface. `kids` answers "what does this container show?",
// which is the membership question the magic-drawer rules decide.
/* ---- the one tick the instruments share — decision 182 ------------------
   `active.js` owns *when* to look (one interval, started only while something
   needs watching); this owns what to do about it, because the answer is a
   render and that module deliberately does not render. An alarm rings and
   says so; a candle that has guttered out changes only what its tile draws,
   so the board is redrawn and nothing is stored. */
setMinuteHandler(()=>{
  const rang = checkAlarms();
  if(rang || guttered()) render();
  if(rang) toast(`${rang.title || 'Alarm'} \u00b7 ${rang.alarm}`);
  mindTheTime();
});
mindTheTime();

window.BUREAU = {
  someKind, furnish, loadTexts, rangeOfKind, randomSizeOf, inRange,
  get state(){ return S; }, render, create, save: writeNow, saveSoon: save,
  // making a type the way the picker does, pressing a tile the way a finger
  // does, the zoom out to every board and the setup card (decisions 227, 229)
  newOfKind, tap: tileTap, dz, setBoardDims, dimsOf, ASPECT_KINDS, openOverview, closeOverview, overviewOn, openSetup, setupOpen, SETUPS, setupAnswer, closeSetup,
  get K(){ return KINDS; },
  get shapes(){ return SHAPES; }, shapeChoices,
  // every aesthetic there is, so a test can walk them all rather than
  // hardcode a list that goes stale the moment one is added or dropped
  get styles(){ return STYLES; },
  // picking one is more than writing the key: it carries the board, the
  // alpha and the defaults new drawers are born with
  setStyle: applyStyle,
  /* What the board is made of is written onto the root by applyLook(), so a
     test that changes the setting has to ask the same function the settings
     panel asks rather than restating the rule. See decision 192. */
  applyLook,
  // the seven families, named by whichever aesthetic is showing
  panelSlots, borderSlots, knobSlots, plateSlots, textureSlots, bindingSlots, stockSlots, famSlots, famAll,
  dress, styleKey, stockNow, knobOf, isContainer, faceOf,
  // a decoration is tagged rather than dressed — decision 100
  get decorKeys(){ return DECOR_KEYS; }, decorSuits, decorFor, decorRest,
  // the roll a new drawer's look comes from, so a test can sample the
  // generator rather than infer its weighting from twenty objects
  randomLook,
  /* Run the migration chain over a fixture and hand it back. A departed
     aesthetic is the dangerous kind of removal — the fallback hides it — so a
     test has to be able to load an old desk rather than trust the list. */
  migrated(d){ migrate(d); return d; },
  // a counter's readout and a thing in the drawer front (decisions 252, 254)
  countOf, inFront,
  paste: pasteObjects, relate, pin: togglePin, setPin, renderSheet,
  /* The instruments, so a test can press one and read what it did rather than
     driving a gesture to find out. */
  activeTap, actOf, isActive, metroGoing, stopAllMetros, checkAlarms, zoom: openZoom,
  /* Where a lit flame is, in cells, so a test can ask the reader the light
     layer asks rather than eyeballing a glow in a screenshot. */
  activeFlame,
  /* Clip — objects that travel together. A group is *the set carrying the
     id* and there is no table anywhere, so a test has to ask the same reader
     the board asks rather than looking one up. See decision 180. */
  groupTogether, groupMates, travelWith,
  // small | extra | large — the three phone grids, for trying on
  setGrid: setGridSize,
  // the four things an object opens onto: its editor, its words, its paper,
  // and — for something made of an image — the picture
  panel: objectPanel, closePanel, write: openWriter, read: openRead, view: openViewer,
  /* A thing drawn as the thing it makes — the type picker's own primitive
     (decision 51). Exposed so anything outside the app that wants to *show* a
     tile draws the real one rather than a copy of it: `scripts/catalogue.mjs`
     builds the specimen book from these, and a copy would drift the first
     time a slot gained a rule. */
  sampleObject, sampleTile,
  del, delMany, delDrawer, undo, redo, toggleDone, spawnNext,
  // the little calendar, and how a thing comes round — decisions 72, 73, 78
  schedule: schedulePanel, applyLook, palNow,
  /* The context menu, so a test can ask what a long press actually offers —
     which is the question "is this reachable" and the one that went unasked. */
  ctx: openCtx,
  get CHECKS(){ return CHECKS; }, decorSVG,
  get sorts(){ return SORTS; },
  // the ways an object opens to be read — two of them, since decision 156
  get reads(){ return READS; },
  /* Urgency is derived, so there is nothing on an object for a test to read —
     it has to be able to ask the same question the sort and the rule ask. */
  urgency: urgencyOf, urgeSaid, workday,
  /* Plans: saved, put down, and the list itself. A plan is not an object, so
     nothing in `state.objects` answers for one and a test needs the module. */
  plans, planFrom, stampPlan, planById, planSize, delPlan,
  /* KINDS is BUILTIN_KINDS merged with S.kinds, and the merge is a step —
     writing a type into S.kinds without it leaves K() answering the fallback.
     The builder calls it; a test writing a type by hand needs to as well. */
  refreshKinds,
  prioOf, repeatOf, repeatSaid, nextRepeat, boardLocked,
  closeSheet,
  // the type picker, so a test can open the thing rather than the gesture
  pick: modalNewObject,
  /* The major categories the picker leads with, and the tag question a sorting
     drawer asks on the way in — decisions 130 and 131. Exposed so a test asks
     the app which types are majors rather than keeping a second copy of the
     list that goes stale the moment one is added. */
  get PRIMARY(){ return PRIMARY; }, get SECONDARY(){ return SECONDARY; }, MASTERS, inMaster, isCut, isPrimary, inFamily, tagFirst: tagFirstPanel,
  /* The switch table behind a control, and what one is showing — decision 132.
     A control's state is the desk's, not the object's, so there is nothing on
     the object for a test to read. */
  get CONTROLS(){ return CONTROLS; }, ctlSaid, ctlIsOn, ctlPress,
  // what a bar is actually drawn at, which may be about another object entirely
  barPct, marginOf, marginPlus,
  // …and the drawer along the bottom, which is the other thing that pull
  // opens — see decision 107
  holding: holdPanel, held: heldObjects, isHeld, hold: holdIt, unhold: unholdIt,
  // what an object looks like on its way out — see decision 68
  asMarkdown,
  // the two questions a date can be asked: which day it sits on, and whether
  // it is late — see decision 62
  has, lateOn, isLate,
  // which movement a thing has decided on, for a test that would otherwise
  // have to reimplement the size rule to know what it is looking at
  openingFor,
  // walking the row of desks, for measuring what a swipe actually costs
  /* Walking the desks, building one board as a string, and the measurement
     after layout — the three seams a performance pass needs to time separately,
     because "the swipe feels slow" is three different costs in a trench coat. */
  step: stepDrawer, viewHTML, sizeGrid,
  /* A container's board is its own tile times four (decision 188), and a test
     has to be able to ask the reader rather than re-derive the arithmetic. */
  innerOf,
  // how wide one shelf is on this board — the thing the per-board grain decides
  shelfW: (cid, dv) => colsOf(cid, dv || 'phone'),
  /* Putting the shelf somewhere by hand, without a phone to tilt: the smoke
     test drives this, and so does anyone tuning the throw. −1 to 1 on each
     axis. See decision 108. */
  tilt: tiltTo, applyTilt, tiltMode,
  /* The heap, for a test that has to watch physics rather than a class: how
     many bodies there are and where each has got to, in the board's own
     pixels, plus a way to run the fall to a standstill without waiting for it.
     See decision 166. */
  gravity: {report: gravityReport, settle: gravitySettle, apply: gravityApply,
            wake: gravityWake, grab: gravityGrab, drag: gravityDrag, drop: gravityDrop},
  // the spray, so a test can watch the physics rather than the class — and
  // the reveal, which is now the only thing in the app that sets one off
  spray, sprayAt, sprayCount, sprayNow, sprayMark, reveal,
  // cards, decks, strings and drawing by hand (decisions 269–271)
  gather, openCard, openPaint, closePaint, paintOpen, PT, tugOf, artLayer,
  get SPRAYS(){ return SPRAYS; },
  // the ten that ship, so a test can walk them without importing the module
  get decor(){ return DECOR; }, boxOk,
  // how a book is bound — decision 87
  get BINDINGS(){ return BINDINGS; }, bindingOf,
  // …and how a drawer front is worked — decision 88
  get PANELS(){ return PANELS; }, panelOf,
  kids: id => childrenOf(container(id)).map(o=>o.id),
  // which desk something is on — the dots by the title answer with it
  deskOf,
  /* The shelves, for the smoke test: how tall one is, how many a board has,
     which one you are on, and how to get to another. See decision 141. */
  get shelfRows(){ return shelfRows(); }, shelvesOf, shelfAt, setShelf,
  // a board is tiles, every one eight by eight (decision 272)
  TILE, viewRows, flows, colsOf,
  // the board's own zoom, and the tile a board opens on (decision 274)
  zoomOf, zoomRange, setZoom, zoomCommit, startOf, snapZoom, boardHolds, settingsPanel,
  shelfShift, goShelf, goShelfTo,
  // the boards a board is made of, and making or taking one (decision 219)
  isBoard, boardsOf, addBoard, removeBoard,
  // a board as big as what is on it (decision 286)
  fitBoard, MARGIN,
  // is there room for one of these here — the question "it won't fit" answers
  roomFor: (w,h,parent)=> roomFor(w,h,S.device,parent||'root'),
  // somewhere free to put a fixture, so a test needn't hardcode a coordinate
  free: (w,h,parent)=> anySpot(w,h,S.device,parent||'root')
};
