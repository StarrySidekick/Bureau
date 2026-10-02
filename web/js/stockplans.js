/* ============================================================
   22b · the plans the desk ships with
   ============================================================
   A plan is a board you can put down again (decision 121), and until now every
   one of them had to be built by hand first — which means the feature was
   available only to somebody who had already arranged the thing once. These
   are ten arrangements shipped with the app, one per job a paper system
   actually does, so the Plans door has something in it the first time it is
   opened. See `docs/FUNCTIONS.md`, which is where the ten come from.

   **They are ordinary user data, not a new category.** `BUILTIN_KINDS` is
   merged over `S.kinds` on read because a type is a *definition* and a desk
   left on an edited one still has to resolve; a plan is a *thing you have*,
   like the sample desk, and the honest way to ship one is to put it in the
   drawer and let go of it. So these arrive once — with the seed on a fresh
   desk, by migration 35 on an existing one — and after that they are yours:
   rename them, edit them, throw them away, and nothing puts them back.

   `stock` is the one marker they keep, and it is only there so a later
   migration can add an *eleventh* without duplicating the ten already sitting
   on the desk. It is not read anywhere else and nothing behaves differently
   for carrying it.

   **Built out of types that exist.** Every one of these could be arranged by
   hand today; none of them waits on a Daybook, a Log, a series or a matrix.
   That is deliberate — a plan is an arrangement of the furniture there is, and
   a stock plan that needed new machinery would be a mock-up rather than a
   board you can put down. Where the document's arrangement wanted a type
   Bureau has not got, the nearest real thing does the job and the difference is
   noted on the plan itself. */
import { D } from './util.js';

/* ---- the shorthand -----------------------------------------------------
   `b` is one box, [x, y, w, h], used for **both** devices — because the unit a
   plan is arranged in is a **shelf**, and a shelf is eight columns wide on
   every board there is. The desk's twenty-four are three shelves side by side
   and a drawer is exactly one, so a plan authored to the desk's full width is
   one that cannot be stamped into a drawer at all: columns nine to twenty-four
   are not there, every box fails `boxOk()`, and `anySpot()` re-flows the
   arrangement — which is the one thing a plan exists to preserve. Eight
   columns by at most **twelve** rows fits a phone shelf, a Mac shelf and the
   inside of any drawer, which is every place a plan can be put down. Twelve
   and not thirteen because a shelf is as tall as whatever fits on *this*
   screen: a tall handset gives thirteen rows at Small and a short one gives
   twelve, and a plan that overran would have its last row sent to `anySpot()`,
   which is the one place in the app allowed to write an overlap.

   Authored against eight and stamped through `cols` below, so a desk set to
   Extra or Large gets the arrangement rescaled rather than the same numbers
   meaning somewhere else — a column count is a coordinate space (decision 48).

   Only the **top level** carries boxes. What is inside a checklist is a list
   and what is inside a drawer is a handful, so those are left to
   `ensureBox()`, which is the same path anything else created without a box
   takes. The board is the plan; a drawer's contents are not an arrangement. */
const PLAN_ROOT = '__plan';

/* A `tracks` has to name an object that does not exist yet, so a spec says
   `tracks:'@ladder'` and `ref:'ladder'` on the thing meant, and the reference
   is resolved once every id has been handed out. Ids inside a plan are
   remapped again at stamping, and `stampPlan()` carries `tracks` across the
   same way it carries `rel`. */
function build(spec){
  const objects = [], refs = {};
  let n = 0;
  const add = (s, parent)=>{
    const id = `${spec.key}_${++n}`;
    if(s.ref) refs[s.ref] = id;
    const o = Object.assign({
      id, parent, kind:s.k, title:s.t||'', body:s.body||'',
      tags:[], milestones:[], history:[], ord:objects.length
    }, s.set||{});
    /* A list on one of these boards says what it is (decision 197): two
       unnamed checklists side by side are two lists you open to tell apart.
       Authoring shorthand — this is a spec being written out, not a type
       being asked what it can do. */
    if(s.k==='checklist' && parent===PLAN_ROOT && o.clhead==null) o.clhead='1';
    /* …and what you type into one has no day until you give it one: a stage,
       a film to watch and a part to buy are not due today, and a list whose
       every line reads overdue tomorrow is a list you stop looking at. */
    if(s.k==='checklist' && parent===PLAN_ROOT && o.undated==null) o.undated='1';
    if(s.b){
      const box = {x:s.b[0], y:s.b[1], w:s.b[2], h:s.b[3]};
      o.desk = box; o.phone = Object.assign({}, box);
    }
    objects.push(o);
    (s.kids||[]).forEach(k=>add(k, id));
  };
  /* **The bottom two rows are the way in** (decision 197). A board is eight
     by fourteen on the screens it is used on (a Mac a window high, and every
     iPhone since the X gives fourteen or fifteen), and the plans were authored
     to twelve, from when a short handset set the height, so two rows stood
     empty on every board. They hold the line a Project and a Life drawer used
     to be seeded with, which a board that is the base station for something
     needs most: somewhere to throw a thing before deciding where it goes. On a
     screen shorter than fourteen it goes to the next screenful by itself. */
  const inbox = spec.inbox===false ? [] :
    /* **A notepad, not the garden** (decision 294): the line you write on is
       the notepad, which makes what the line reads as unless the flow says
       one kind (`inbox`). The garden was the same line in a planter. */
    [{k:'notepad', t:'Add to this…', b:[1,13,8,2], set:spec.inbox ? {genKind:spec.inbox, c:spec.c} : {c:spec.c}}];
  /* **No title across the top** (decision 219). Every board opened with a
     label eight cells wide saying what it was, directly under the lip that
     already says it, so the first row of every flow was the name twice. It
     is dropped as the spec is read and everything below it moves up a row;
     `fillRows()` then gives the row back to what is on the board. */
  const untitled = list => {
    const top = (list||[]).filter(o=>!(o.k==='label' && o.b && o.b[1]===1 && o.b[2]===8 && o.b[3]===1));
    const cut = top.length < (list||[]).length;
    return top.map(o=> cut && o.b ? Object.assign({}, o, {b:[o.b[0], Math.max(1, o.b[1]-1), o.b[2], o.b[3]]}) : o);
  };
  const main = untitled(spec.on).concat(inbox);
  main.forEach(s=>add(s, PLAN_ROOT));
  if(!spec.raw) fillRows(objects.filter(o=>o.parent===PLAN_ROOT && o.desk && o.title!=='Add to this…'));
  /* **More than one board** (decision 219). `boards` is a list of the others,
     each at a step from this one — `at:[1,0]` is the board to the right,
     `[0,-1]` the one above — and each authored eight by fourteen on its own,
     the way the main one is. They are written into one coordinate space here,
     a board being `BOARD_W × BOARD_H` cells of it, and `stampPlan()` reads
     them back out board by board against whatever a board measures where the
     flow is put down. */
  let cells = null, start = null;
  if(Array.isArray(spec.boards) && spec.boards.length){
    const at = [{x:0, y:0}].concat(spec.boards.map(bd=>({x:bd.at[0], y:bd.at[1]})));
    const mx = Math.min(...at.map(c=>c.x)), my = Math.min(...at.map(c=>c.y));
    cells = at.map(c=>({x:c.x-mx, y:c.y-my}));
    start = cells[0];
    const move = (o, c)=>{ ['desk','phone'].forEach(dv=>{ const b=o[dv]; if(!b) return;
      o[dv] = Object.assign({}, b, {x:b.x + c.x*BOARD_W, y:b.y + c.y*BOARD_H}); }); };
    objects.filter(o=>o.parent===PLAN_ROOT).forEach(o=>move(o, start));
    spec.boards.forEach((bd, i)=>{
      const from = objects.length;
      untitled(bd.on).forEach(s=>add(s, PLAN_ROOT));
      const mine = objects.slice(from).filter(o=>o.parent===PLAN_ROOT);
      if(!spec.raw && !bd.raw) fillRows(mine.filter(o=>o.desk));
      mine.forEach(o=>move(o, cells[i+1]));
    });
  }
  /* A list the setup card writes into is named by its `ref` (decision 237):
     `sref:{fam:'people'}` on the spec marks the list made with ref `fam`. */
  Object.entries(spec.sref||{}).forEach(([ref, name])=>{
    const o = objects.find(x=>x.id===refs[ref]); if(o) o.sref = name; });
  objects.forEach(o=>{
    ['tracks','into','from'].forEach(k=>{
      if(typeof o[k]==='string' && o[k][0]==='@') o[k] = refs[o[k].slice(1)] || null; });
  });
  return {
    id: `pl_stock_${spec.key}`,
    stock: spec.key,
    nm: spec.nm, ic: spec.ic, c: spec.c,
    of: spec.of || 'drawer',
    /* Which part of a life it is the board for, by the drawing a Life drawer
       wears (decor.js). Choosing that part when making one lays this board
       out inside it; see decision 195. */
    life: spec.life || null,
    /* Which list it is drawn in: a part of a life, something you take in, or
       a piece of work. The Life drawer's question offers the first two and
       the Project question the third; the Plans door groups by it. */
    sec: spec.sec || null,
    /* What the Magic Selector makes on the board (decision 199), given to the
       container the plan is put down in. */
    makes: spec.makes || undefined,
    /* The tools in its drawer front, up to three each side of the knob
       (decision 220), given to the container the flow is put down in. */
    rail: spec.rail || undefined,
    /* **A bench's room** (decision 293): the settings that hold inside the
       container it is put down in, and what its drawer front's stamp says. */
    env: spec.env || undefined,
    stamp: spec.stamp || undefined,
    made: D.iso(D.today()),
    cols: 8,
    /* The boards it is laid out on, when there is more than one, the one it
       opens on, and how big a board was when its boxes were written. */
    boards: cells || undefined,
    start: start || undefined,
    dims: cells ? {desk:{w:BOARD_W, h:BOARD_H}, phone:{w:BOARD_W, h:BOARD_H}} : undefined,
    objects
  };
}
/* One board of a flow, as it is authored: eight across, twelve rows of board
   and the two-row way in under them. */
const BOARD_W = 8, BOARD_H = 14;

/* ---- the rows above the way in are all used ----------------------------
   **Twelve rows of board, and every plan fills them** (2026-09-23). The boards
   were authored when twelve was the whole height and most came out at ten or
   eleven, so with the *Add to this…* line on thirteen and fourteen (decision
   197) nearly every board had an empty band across it just above the line.
   Timothy: "we still don't seem to be using the whole 14 tall grid space".

   Re-authoring thirty-three layouts by hand would be thirty-three chances to
   get one wrong, so the missing rows are **inserted**: one board row at a time
   is doubled, everything spanning it grows by one and everything below it
   moves down by one. Which row is chosen is the whole of the craft. A row is
   good when, across all eight columns, it runs through things that are
   already tall — a note or a checklist gains a line and nobody notices — and
   bad when it runs through a one-row thing, because a label or a link two
   rows tall is a different object, or through nothing, because that opens a
   gap. Nothing moves sideways and the order of edges never changes, so what
   touched still touches and nothing can come to overlap. */
const PLAN_ROWS = 12;
function fillRows(top){
  const bottom = () => top.reduce((m,o)=>Math.max(m, o.desk.y+o.desk.h-1), 0);
  for(let n = PLAN_ROWS - bottom(); n > 0; n--){
    const used = bottom();
    let best = 0, bestScore = -Infinity;
    for(let r=1; r<=used; r++){
      let score = 0;
      for(let x=1; x<=8; x++){
        const o = top.find(o=>o.desk.x<=x && x<=o.desk.x+o.desk.w-1
                            && o.desk.y<=r && r<=o.desk.y+o.desk.h-1);
        score += !o ? -3 : o.desk.h===1 ? -12 : o.desk.h===2 ? 1 : 2 + o.desk.h/8;
      }
      if(score > bestScore){ bestScore = score; best = r; }
    }
    if(!best) break;
    top.forEach(o=>{
      const b = o.desk;
      if(b.y > best) b.y++;
      else if(b.y + b.h - 1 >= best) b.h++;
      o.phone = Object.assign({}, b);
    });
  }
}

/* Shorthands for the things that recur, so a rule reads as the sentence the
   builder would have written. */
const LABEL = (t, b, c)=>({k:'label', t, b, set:{c}});
/* A copper pipe (decision 286) out of an inbox, carrying one kind (or, with
   no kind, anything the others do not) into a drawer, both said by ref. */
const PIPE = (kind, from, into, b)=>({k:'pipe', t:'', b, set:{takes:kind, from, into}});
const MAKES = (t, kind, b, c, into)=>({k:'notepad', t, b, set:into ? {genKind:kind, c, into} : {genKind:kind, c}});
/* A drawer that is a list with its name on it: where a spawner on the same
   board files what it makes (decision 197). It was a sorting drawer collecting
   by type from this board, which showed a knob and nothing else, and could not
   be filed into because a sorting drawer holds nothing. */
/* **Wears the list face** since there is one (decision 239): what a spawner
   files here is a note or an idea as often as a task, and the checklist face
   renamed a line on a tap where this one opens it. */
const LIST = (t, ref, b, c)=>({k:'drawer', t, ref, b, set:{c, face:'list', clhead:'1', undated:'1', layout:'list'}});
/* **This board**, as a rule. `@under` the plan's own root is re-pointed at the
   board it is put down on (`repointRules()` in plans.js), so a calendar or a
   sorting drawer in one of these collects what is inside *this* project and
   not everything on the desk. That is the whole difference between a board
   that is a base station and one that is a window onto the rest. */
const HERE = {f:'@under', op:'is', v:PLAN_ROOT};
/* Its face says what is coming by default (decision 197): a month of dots
   says a day is busy and never with what, and the next thing is often next
   month. `show` is `marks` where the month *is* the point (a habit's run),
   `titles` for a week, and `agenda` otherwise. */
const CAL = (t, b, c, view, show)=>({k:'calendar', t, b,
  set:{c, calview:view||'month', calshow:show||'agenda', filter:{rules:[{f:'date', op:'any'}, HERE]}}});
/* The way out: a Link to wherever the work actually happens. An https address
   opens the app itself on a phone that has it, which is why none of these
   use an app's own scheme. */
// `sref` marks it for the setup card of the aspect it belongs to (decision 237)
const LINK = (t, url, b, c, sref)=>({k:'outlink', t, b, set:Object.assign({c, link:{label:t, target:url}}, sref ? {sref} : {})});
// a task that comes back, which is what a checkup, a bill and a habit all are
const AGAIN = (t, every, unit, from)=>({k:'task', t,
  set:{attrs:['text','check','date','repeat'],
       repeat:{every, unit, days:[], from:from||'date', ends:null, paused:false, made:0}}});
// a card in a deck, which is a prompt when the deck is a generator
const CARDS = list => list.map(t=>({k:'note', t}));
/* The stages of a piece of work, a checklist its progress bar reads
   (decision 238): ticking a stage is the whole of keeping the bar true. */
/* A zone (decision 293): a place that gives what is put in it a priority,
   an effort or a tag. `w` is what it writes. */
const ZONE = (t, w, b, c)=>({k:'zone', t, b, set:{c, writes:w}});
/* ---- the Film bench (decision 293) ----------------------------------------
   A film's board in a screening room: the night-sky aesthetic, a rigid swipe
   from one department to the next, and a scene pipeline, four zones a scene
   card walks across, each giving its tag and taking the last one's. The
   front's stamp says Approved. Shared by the short and the feature. */
const FILM_BENCH = {env:{style:'starry', flow:'rigid'}, stamp:{w:'Approved', ink:'red'},
  rail:{left:['glass','stamp','spool'], right:['block','gear']},
  makes:{only:['scene','character','image','note','task','zone'], sizes:[]}};
const SCENE_PIPELINE = at => ({at, on:[
  ZONE('Written', {tag:'written'}, [1,1,2,12], 12),
  ZONE('Prepped', {tag:'prepped'}, [3,1,2,12], 8),
  ZONE('Shot',    {tag:'shot'},    [5,1,2,12], 6),
  ZONE('Cut',     {tag:'cut'},     [7,1,2,12], 13),
  {k:'scene', t:'Scene 1', b:[1,3,2,2], set:{c:9, tags:['written']}},
  {k:'scene', t:'Scene 2', b:[1,5,2,2], set:{c:9, tags:['written']}},
  {k:'scene', t:'Scene 3', b:[1,7,2,2], set:{c:9, tags:['written']}},
  {k:'notepad', t:'New scene', b:[1,13,8,2], set:{genKind:'scene', c:9}}
], raw:true});
const STAGES = (ref, list, b, c)=>({k:'checklist', t:'Stages', ref, b, set:{c}, kids:list.map(t=>({k:'task', t}))});
/* **A film is its departments** (Timothy: "casting, storyboard, props,
   locations, script"), a board each round the one the film opens on: casting
   and the storyboard to the right, props and wardrobe below, locations below
   and to the right. The script is on the first board, with the stages. */
const FILM_DEPARTMENTS = c => [
  {at:[1,0], on:[
    LIST('Roles to cast', 'roles', [1,1,4,5], c),
    {k:'drawer', t:'Characters', b:[5,1,4,4], set:{c:13}, kids:[
      {k:'character', t:'The lead'}, {k:'character', t:'Who is in the way'}]},
    {k:'checklist', t:'Auditions', b:[5,5,4,4], set:{c:6}},
    {k:'note', t:'Contacts and agents', b:[1,6,4,3], set:{c:12}},
    CAL('Casting days', [1,9,4,3], 7),
    LINK('Post a casting call', 'https://www.backstage.com', [5,9,4,1], 9),
    LINK('Find crew', 'https://www.staffmeup.com', [5,10,4,1], 9)
  ]},
  {at:[2,0], on:[
    {k:'moodboard', t:'Storyboard', b:[1,1,8,6], set:{c:13}},
    {k:'checklist', t:'Shot list', b:[1,7,5,5], set:{c:9}},
    {k:'note', t:'The look', b:[6,7,3,5], set:{c:12, body:'**Lenses —** \n\n**Light —** \n\n**Color —** '}}
  ]},
  {at:[0,1], on:[
    {k:'checklist', t:'Props', b:[1,1,4,6], set:{c:6}},
    {k:'checklist', t:'Wardrobe', b:[5,1,4,6], set:{c:10}},
    {k:'moodboard', t:'References', b:[1,7,8,5], set:{c:13}}
  ]},
  {at:[1,1], on:[
    LIST('Locations', 'locs', [1,1,4,5], c),
    {k:'moodboard', t:'Scouting photos', b:[5,1,4,5], set:{c:13}},
    {k:'checklist', t:'Permits and permissions', b:[1,6,4,4], set:{c:8}},
    LINK('Map', 'https://www.google.com/maps', [5,6,4,1], 9),
    LINK('Find a location', 'https://www.peerspace.com', [5,7,4,1], 9),
    {k:'note', t:'Notes from the scout', b:[5,8,4,3], set:{c:12}}
  ]}
];

/* ============================================================
   The ten
   ============================================================
   Each is **a board that is the base station for one thing** — a part of your
   life, something you take in, or a piece of work — and not a page about it.
   So each one carries the four things that make a board somewhere you go
   rather than somewhere you file: what to do next, when (a calendar of this
   board only), something that helps you do it (a timer, a deck to cut, a
   prompt), and the way out to the app or site where the thing itself
   happens. Chosen from Timothy's list of thirty-three as the ten Bureau's
   furniture can honestly build today. Authored eight by twelve, one screenful;
   the drawer they go into is given a second screen beside it as room for what
   you make there. A Life drawer made for Health, Money, Exercise, Nutrition,
   Travel, Films or Books is born holding its board, and so are a Film, a Song,
   a Trip and an Essay or post. See decisions 194 and 195. */
const SPECS = [

  /* ---- a part of your life ------------------------------------------ */

  /* ---- the aspects of life, rebuilt — decision 237 ------------------------
     Each of these was reworked from what Timothy wrote it is for on the Bureau
     Scope page (2026-09-28), and each is the flow of its own aspect type
     (`lf_…`, decision 236), laid out inside it the moment it is made. A thing
     marked `sref` is where that aspect's setup card writes an answer: the
     water goal, the Letterboxd name, the people in the family. */

  // "primarily for managing and scheduling appointments, while also
  // maintaining things like sleep, water consumption, and other bodily stuff"
  {key:'health', sec:'life', nm:'Health', ic:'drop', c:8, of:'lf_health', life:'health', on:[
    CAL('Appointments', [1,1,5,4], 7),
    {k:'appt', t:'Next appointment', b:[6,1,3,4], set:{c:8, sref:'nextappt',
      body:'**Who —** \n\n**Where —** \n\n**Bring —** '}},
    {k:'checklist', t:'Book these', b:[1,5,4,4], set:{c:6}, kids:[
      AGAIN('Physical', 1, 'year', 'done'),
      AGAIN('Dentist cleaning', 6, 'month', 'done'),
      AGAIN('Eye exam', 1, 'year', 'done'),
      AGAIN('Skin check', 1, 'year', 'done')
    ]},
    {k:'question', t:'Ask the doctor', b:[5,5,4,4], set:{c:10,
      body:'**Since last time —** \n\n**I want to ask —** '}},
    {k:'drawer', t:'Records', b:[1,9,4,3], set:{c:14}, kids:[
      {k:'note', t:'Medications and doses'},
      {k:'note', t:'Allergies and history'},
      {k:'note', t:'Insurance'},
      {k:'note', t:'Results'}
    ]},
    LINK('Patient portal', 'https://www.mychart.org', [5,9,4,1], 9, 'portal'),
    LINK('Find a doctor', 'https://www.zocdoc.com', [5,10,4,1], 9)
  ], boards:[{at:[1,0], on:[
    // the body, day by day: a measured habit each (decision 232)
    {k:'tracker', t:'Water', b:[1,1,8,2], set:{c:9, sref:'water', measure:{unit:'oz', goal:64, step:8}}},
    {k:'tracker', t:'Sleep', b:[1,3,8,2], set:{c:10, sref:'sleep', measure:{unit:'hours', goal:8, step:1}}},
    {k:'tracker', t:'Steps', b:[1,5,8,2], set:{c:6, sref:'steps', measure:{unit:'steps', goal:8000, step:1000}}},
    {k:'tracker', t:'Vitamins', b:[1,7,8,2], set:{c:13}},
    {k:'note', t:'Numbers', b:[1,9,8,3], set:{c:12,
      body:'**Weight —** \n\n**Blood pressure —** \n\n**Resting heart rate —** '}}
  ]}]},

  // "access to all my financial apps, knowing kind of how much money I have
  // in any given time, listing my financial goals, my savings goals"
  {key:'money', sec:'life', nm:'Finances', ic:'bar', c:13, of:'lf_money', life:'money', on:[
    {k:'note', t:'What there is', b:[1,1,4,4], set:{c:13, sref:'balances',
      body:'**Checking —** \n\n**Savings —** \n\n**Investments —** \n\n**Owed —** \n\n*As of —*'}},
    LINK('Your bank', '', [5,1,4,1], 9, 'bank'),
    LINK('Credit card', '', [5,2,4,1], 9, 'card'),
    LINK('Investments', '', [5,3,4,1], 9, 'invest'),
    LINK('Budget', 'https://www.ynab.com', [5,4,4,1], 9, 'budget'),
    {k:'checklist', t:'Savings', ref:'save', b:[1,5,4,3], set:{c:13, sref:'savings'}, kids:[
      {k:'task', t:'A first cushion'},
      {k:'task', t:'One month of expenses'},
      {k:'task', t:'Three months'}
    ]},
    {k:'checklist', t:'Financial goals', b:[5,5,4,4], set:{c:6, sref:'goals'}, kids:[
      {k:'task', t:'Three months put by'},
      {k:'task', t:'Pay off the card'},
      {k:'task', t:'Put something into retirement every month'}
    ]},
    {k:'progressbar', t:'', b:[1,8,4,1], set:{c:13, tracks:'@save'}},
    {k:'checklist', t:'Bills', b:[1,9,4,3], set:{c:6}, kids:[
      AGAIN('Rent', 1, 'month'),
      AGAIN('Phone', 1, 'month'),
      AGAIN('Card', 1, 'month'),
      AGAIN('Look over the month', 1, 'month')
    ]},
    CAL('When it is owed', [5,9,4,3], 7)
  ]},

  // "being able to link into another app meant for exercising, tracking my
  // fitness goals by routine"
  {key:'exercise', sec:'life', nm:'Exercise', ic:'star', c:6, of:'lf_exercise', life:'exercise', on:[
    LINK('Your fitness app', 'https://www.strava.com', [1,1,8,2], 9, 'app'),
    {k:'checklist', t:'The routine', b:[1,3,4,5], set:{c:6, sref:'routine'}, kids:[
      AGAIN('Strength', 1, 'week'),
      AGAIN('A run', 1, 'week'),
      AGAIN('Strength again', 1, 'week'),
      AGAIN('A long walk', 1, 'week')
    ]},
    {k:'tracker', t:'Moved today', b:[5,3,4,2], set:{c:6, sref:'minutes', measure:{unit:'min', goal:30, step:10}}},
    {k:'checklist', t:'What it is for', b:[5,5,4,3], set:{c:13, sref:'goal'}, kids:[
      {k:'task', t:'Three sessions a week, a month running'},
      {k:'task', t:'A first milestone of your own'}
    ]},
    CAL('Sessions', [1,8,4,4], 7),
    {k:'hourglass', t:'Rest', b:[5,8,2,2], set:{c:12, mins:1}},
    {k:'metronome', t:'Cadence', b:[7,8,2,2], set:{c:6, bpm:170}},
    LINK('Apple Fitness', 'https://www.apple.com/apple-fitness-plus/', [5,10,4,1], 9),
    LINK('Nike Run Club', 'https://www.nike.com/nrc-app', [5,11,4,1], 9)
  ]},

  // "identifying healthy foods and less healthy foods, identifying my
  // allergies if I were to have any, identifying things that are good for
  // GERD and bad for GERD"
  {key:'nutrition', sec:'life', nm:'Nutrition', ic:'pot', c:2, of:'lf_nutrition', life:'nutrition', on:[
    {k:'note', t:'Good for me', b:[1,1,4,4], set:{c:6, sref:'good',
      body:'Oats\n\nGreens\n\nBeans and lentils\n\nFish\n\nBerries'}},
    {k:'note', t:'Go easy on', b:[5,1,4,4], set:{c:1, sref:'bad',
      body:'Fried food\n\nSugary drinks\n\nProcessed meat'}},
    {k:'note', t:'Allergies and intolerances', b:[1,5,4,2], set:{c:8, sref:'allergies', body:'None known yet.'}},
    {k:'tracker', t:'Water', b:[5,5,4,2], set:{c:9, measure:{unit:'oz', goal:64, step:8}}},
    // the usual lists; what is true for one person is found by keeping these
    {k:'note', t:'Reflux: easier on it', b:[1,7,4,4], set:{c:6, sref:'gerdgood',
      body:'Oatmeal\n\nBananas and melon\n\nGinger\n\nLean protein\n\nGreen vegetables\n\n*Smaller meals, and nothing in the three hours before bed*'}},
    {k:'note', t:'Reflux: triggers', b:[5,7,4,4], set:{c:1, sref:'gerdbad',
      body:'Coffee\n\nAlcohol\n\nChocolate and mint\n\nTomatoes and citrus\n\nFried, fatty or spicy food\n\n*Big meals late*'}},
    LINK('Look a food up', 'https://fdc.nal.usda.gov', [1,11,4,1], 9),
    LINK('Eat right', 'https://www.eatright.org', [5,11,4,1], 9)
  ]},

  // "planning dates, buying gifts, identifying what I wanna say to her at any
  // given time"
  {key:'partner', sec:'life', nm:'Partner', ic:'star', c:1, of:'lf_partner', life:'partner', on:[
    CAL('Dates', [1,1,4,4], 7),
    {k:'checklist', t:'Date ideas', b:[5,1,4,4], set:{c:1, sref:'dates'}, kids:[
      AGAIN('Date night', 1, 'week'),
      {k:'task', t:'Somewhere neither of us has been'},
      {k:'task', t:'Cook something new together'}
    ]},
    {k:'checklist', t:'Gift ideas', b:[1,5,4,4], set:{c:13, sref:'gifts'}},
    {k:'note', t:'Things to tell her', b:[5,5,4,4], set:{c:12, sref:'say',
      body:'**Soon —** \n\n**When the time is right —** \n\n**Just because —** '}},
    {k:'appt', t:'Anniversary', b:[1,9,4,2], set:{c:8, sref:'anniv'}},
    {k:'deck', t:'Pick a date', b:[5,9,2,3], set:{c:10}, kids:CARDS([
      'Go back to where you met', 'A walk somewhere new', 'Board games and takeout',
      'A show, a museum or a gig', 'Breakfast out, phones away', 'Cook her favorite'
    ])},
    LINK('Book a table', 'https://www.opentable.com', [7,9,2,1], 9),
    LINK('Things to do', 'https://www.eventbrite.com', [7,10,2,1], 9),
    LINK('Flowers', 'https://www.bloomsybox.com', [1,11,4,1], 9)
  ]},

  // "keeping light tabs on all my family members to make sure they're OK and
  // planning opportunities to see them or do things with them"
  {key:'family', sec:'life', nm:'Family', ic:'star', c:12, of:'lf_family', life:'family', on:[
    LIST('Everyone', 'fam', [1,1,4,4], 12),
    {k:'checklist', t:'Check in', b:[5,1,4,4], set:{c:6, sref:'checkin'}, kids:[
      AGAIN('Call home', 1, 'week'),
      AGAIN('Message someone you have not in a while', 1, 'month')
    ]},
    CAL('Birthdays and visits', [1,5,4,4], 7),
    {k:'checklist', t:'Next time we are together', b:[5,5,4,4], set:{c:13}, kids:[
      {k:'task', t:'Plan the next visit'},
      {k:'task', t:'Something to do together'}
    ]},
    {k:'moodboard', t:'Photographs', b:[1,9,4,3], set:{c:13}},
    LINK('Video call', 'https://meet.google.com', [5,9,4,1], 9),
    LINK('Send a card', 'https://www.paperlesspost.com', [5,10,4,1], 9)
  ], sref:{fam:'people'}},

  // "finding opportunities to spend time with friends and keeping light tabs
  // on making sure that they're at least somewhat OK and identifying where I
  // might have gaps where I wish I had friends"
  {key:'friends', sec:'life', nm:'Friends', ic:'star', c:7, of:'lf_friends', life:'friends', on:[
    LIST('Friends', 'frd', [1,1,4,4], 7),
    {k:'checklist', t:'Check in', b:[5,1,4,4], set:{c:6, sref:'checkin'}, kids:[
      AGAIN('Text someone you have not in a while', 1, 'week'),
      AGAIN('Plan something for everyone', 1, 'month')
    ]},
    CAL('Plans', [1,5,4,3], 7),
    {k:'deck', t:'Something to do', b:[5,5,4,3], set:{c:10}, kids:CARDS([
      'Dinner at somebody’s place', 'A walk and a coffee', 'Game night',
      'See a show', 'Go somewhere for the day', 'Just call'
    ])},
    {k:'question', t:'Where do I wish I had friends?', b:[1,8,4,4], set:{c:10, sref:'gaps',
      body:'**Near home —** \n\n**Who like what I like —** \n\n**At work —** '}},
    LINK('Meetups', 'https://www.meetup.com', [5,8,4,1], 9),
    LINK('Something on', 'https://www.eventbrite.com', [5,9,4,1], 9),
    LINK('Split the bill', 'https://www.splitwise.com', [5,10,4,1], 9)
  ], sref:{frd:'people'}},

  // "identifying what communities I'd like to be a part of more, or keeping
  // track of social gatherings"
  {key:'communities', sec:'life', nm:'Communities', ic:'flag', c:4, of:'lf_communities', on:[
    LIST('Part of', 'cin', [1,1,4,4], 4),
    LIST('Would like to join', 'cwant', [5,1,4,4], 12),
    CAL('Gatherings', [1,5,5,4], 7),
    {k:'checklist', t:'Show up', b:[6,5,3,4], set:{c:6}, kids:[
      AGAIN('Go to the next one', 1, 'month'),
      {k:'task', t:'Offer to help with something'}
    ]},
    {k:'question', t:'What could I give?', b:[1,9,4,3], set:{c:10}},
    LINK('Meetups', 'https://www.meetup.com', [5,9,4,1], 9),
    LINK('Volunteer', 'https://www.volunteermatch.org', [5,10,4,1], 9),
    LINK('Local events', 'https://www.eventbrite.com', [5,11,4,1], 9)
  ], sref:{cwant:'want'}},

  // "managing chores mostly": a list per room, and the rest on a board beside
  {key:'home', sec:'life', nm:'Home', ic:'folder', c:5, of:'lf_home', life:'home', on:[
    {k:'checklist', t:'Kitchen', b:[1,1,4,4], set:{c:6, sref:'room'}, kids:[
      AGAIN('Wipe down', 1, 'day'), AGAIN('Clean the fridge', 1, 'month'), AGAIN('Bins out', 1, 'week')]},
    {k:'checklist', t:'Bathroom', b:[5,1,4,4], set:{c:9, sref:'room'}, kids:[
      AGAIN('Clean the sink and mirror', 1, 'week'), AGAIN('Scrub the shower', 2, 'week'), AGAIN('New towels', 1, 'week')]},
    {k:'checklist', t:'Bedroom', b:[1,5,4,4], set:{c:10, sref:'room'}, kids:[
      AGAIN('Change the sheets', 2, 'week'), AGAIN('Laundry', 1, 'week')]},
    {k:'checklist', t:'Living room', b:[5,5,4,4], set:{c:5, sref:'room'}, kids:[
      AGAIN('Vacuum', 1, 'week'), AGAIN('Dust', 2, 'week')]},
    {k:'tracker', t:'Ten minutes of tidying', b:[1,9,8,2], set:{c:6}},
    CAL('This month', [1,11,4,2], 7),
    LINK('Find a pro', 'https://www.thumbtack.com', [5,11,4,1], 9)
  ], boards:[{at:[1,0], on:[
    {k:'checklist', t:'Fix and maintain', b:[1,1,4,5], set:{c:8}, kids:[
      AGAIN('Replace the air filter', 3, 'month', 'done'),
      AGAIN('Test the smoke alarms', 6, 'month', 'done'),
      {k:'task', t:'The thing that drips'}
    ]},
    {k:'checklist', t:'Shopping', b:[5,1,4,5], set:{c:11}, kids:[
      {k:'task', t:'Light bulbs'}, {k:'task', t:'Batteries'}, {k:'task', t:'Bin bags'}
    ]},
    {k:'drawer', t:'Manuals and warranties', b:[1,6,4,3], set:{c:14}},
    LINK('Hardware', 'https://www.homedepot.com', [5,6,4,1], 9)
  ]}]},

  // new: "more about managing your stuff, like your car, laptop, all that stuff"
  {key:'things', sec:'life', nm:'Things', ic:'sliders', c:15, of:'lf_things', on:[
    {k:'drawer', t:'The car', b:[1,1,4,4], set:{c:15, face:'checklist', clhead:'1', layout:'list'}, kids:[
      AGAIN('Oil change', 6, 'month', 'done'),
      AGAIN('Rotate the tires', 6, 'month', 'done'),
      AGAIN('Registration', 1, 'year'),
      AGAIN('Inspection', 1, 'year'),
      {k:'note', t:'Insurance, VIN and plate'}
    ]},
    {k:'drawer', t:'The laptop', b:[5,1,4,4], set:{c:14, face:'checklist', clhead:'1', layout:'list'}, kids:[
      AGAIN('Back it up', 1, 'month', 'done'),
      AGAIN('Install the updates', 1, 'month', 'done'),
      {k:'note', t:'Serial, warranty and where it was bought'}
    ]},
    {k:'drawer', t:'The phone', b:[1,5,4,3], set:{c:9, face:'checklist', clhead:'1', layout:'list'}, kids:[
      AGAIN('Back it up', 1, 'month', 'done'),
      {k:'note', t:'Serial and plan'}
    ]},
    LIST('Everything else', 'more', [5,5,4,3], 12),
    CAL('Due', [1,8,4,4], 7),
    {k:'note', t:'Warranties and receipts', b:[5,8,4,2], set:{c:13}},
    LINK('Find a mechanic', 'https://repairpal.com', [5,10,4,1], 9),
    LINK('Apple support', 'https://support.apple.com', [5,11,4,1], 9)
  ], sref:{more:'things'}},

  /* ---- something you take in ------------------------------------------ */

  // "keeping track of all the places I'd like to visit and finding new places
  // to visit, and also some amount of trip planning"
  {key:'travel', sec:'experience', nm:'Travel', ic:'flag', c:9, of:'lf_travel', life:'travel', on:[
    LIST('Want to go', 'twant', [1,1,4,6], 9),
    LIST('Been', 'tbeen', [5,1,4,3], 5),
    {k:'deck', t:'Somewhere new', b:[5,4,4,3], set:{c:10}, kids:CARDS([
      'A city you know one thing about', 'Somewhere a train can take you',
      'Where a book you loved is set', 'The coast in winter',
      'A friend’s home town', 'A country whose food you love'
    ])},
    LINK('Find somewhere new', 'https://www.atlasobscura.com', [1,7,4,1], 9),
    LINK('Map', 'https://www.google.com/maps', [1,8,4,1], 9),
    {k:'appt', t:'Next trip', b:[5,7,4,2], set:{c:8, sref:'trip'}},
    CAL('Trips', [1,9,4,3], 7),
    {k:'checklist', t:'Packing', b:[5,9,4,3], set:{c:6}, kids:[
      {k:'task', t:'Passport or ID'}, {k:'task', t:'Chargers'}, {k:'task', t:'Medication'}
    ]}
  ], boards:[{at:[1,0], on:[
    {k:'drawer', t:'Bookings', b:[1,1,4,4], set:{c:14}, kids:[
      {k:'note', t:'Getting there'},
      {k:'note', t:'Where we are staying'},
      {k:'note', t:'Getting around'}
    ]},
    {k:'drawer', t:'While we are there', b:[5,1,4,4], set:{c:12}, kids:[
      {k:'note', t:'Eat'}, {k:'note', t:'See'}, {k:'note', t:'Do'}
    ]},
    LINK('Flights', 'https://www.google.com/travel/flights', [1,5,4,1], 9),
    LINK('Getting around', 'https://www.rome2rio.com', [5,5,4,1], 9),
    LINK('Somewhere to stay', 'https://www.airbnb.com', [1,6,4,1], 9),
    {k:'note', t:'Day by day', b:[1,7,8,5], set:{c:9}}
  ]}], sref:{twant:'want'}},

  // "keep track of my favorite movies in each genre, with a link to
  // Letterboxd so that I can do most of the organizing there"
  {key:'films', sec:'experience', inbox:'note', nm:'Films', ic:'film', c:9, of:'lf_films', life:'films', on:[
    LINK('Letterboxd', 'https://letterboxd.com', [1,1,8,2], 9, 'letterboxd'),
    LIST('Drama', 'fdrama', [1,3,4,3], 9),
    LIST('Comedy', 'fcomedy', [5,3,4,3], 13),
    LIST('Horror and thrillers', 'fhorror', [1,6,4,3], 1),
    LIST('Science fiction', 'fscifi', [5,6,4,3], 10),
    LIST('Animation', 'fanim', [1,9,4,3], 6),
    LIST('Documentary', 'fdoc', [5,9,4,3], 12)
  ]},

  // "keeping track of the books I want to read, my favorite books, recording
  // book notes, the physical books that I have, and some way to track down
  // libraries"
  {key:'books', sec:'experience', inbox:'note', nm:'Books', ic:'book', c:11, of:'lf_books', life:'books',
   makes:{only:null, sizes:[{w:[1,1], h:[2,null], kind:'book'}]}, on:[
    LIST('To read', 'bto', [1,1,4,4], 11),
    LIST('Favorites', 'bfav', [5,1,4,4], 13),
    MAKES('A note on a book…', 'note', [1,5,8,1], 5, '@bnotes'),
    LIST('Book notes', 'bnotes', [1,6,4,4], 5),
    LIST('On my shelves', 'bshelf', [5,6,4,4], 14),
    LINK('Libby', 'https://www.libbyapp.com', [1,10,4,1], 9),
    LINK('Find a library', 'https://www.worldcat.org/libraries', [5,10,4,1], 9, 'library'),
    LINK('The StoryGraph', 'https://app.thestorygraph.com', [1,11,4,1], 9),
    LINK('Bookshop', 'https://bookshop.org', [5,11,4,1], 9)
  ], sref:{bto:'toread'}},

  // "keeping track of my favorite songs, artists, musical inspirations"
  {key:'music', sec:'experience', inbox:'note', nm:'Music', ic:'music', c:10, of:'lf_music', on:[
    LIST('Favorite songs', 'msongs', [1,1,4,5], 10),
    LIST('Artists', 'martists', [5,1,4,5], 12),
    {k:'moodboard', t:'Inspirations', b:[1,6,5,4], set:{c:13}},
    {k:'deck', t:'Put something on', b:[6,6,3,4], set:{c:10}, kids:CARDS([
      'An album start to finish', 'Something from the year you were born',
      'A genre you never play', 'What you loved at sixteen',
      'A live recording', 'Something a friend sent you'
    ])},
    LINK('Spotify', 'https://open.spotify.com', [1,10,4,1], 9, 'player'),
    LINK('Bandcamp', 'https://bandcamp.com', [5,10,4,1], 9),
    LINK('Gigs near me', 'https://www.songkick.com', [1,11,8,1], 9)
  ], sref:{martists:'artists'}},

  // "finding new artwork to view, finding museums, keeping track of my
  // favorite artists and artwork"
  {key:'visual', sec:'experience', inbox:'note', nm:'Artwork', ic:'image', c:3, of:'lf_visual', on:[
    {k:'moodboard', t:'Favorite works', b:[1,1,5,4], set:{c:13}},
    LIST('Artists', 'aartists', [6,1,3,4], 12),
    LIST('Museums to visit', 'amuseums', [1,5,4,4], 3),
    CAL('Shows and openings', [5,5,4,4], 7),
    {k:'deck', t:'Look closer', b:[1,9,3,3], set:{c:10}, kids:CARDS([
      'Draw what you see for five minutes', 'What is the light doing?',
      'Stand where the artist stood', 'What would you take home?',
      'Read nothing, then read the label', 'Find the oldest thing in the room'
    ])},
    LINK('Find new art', 'https://artsandculture.google.com', [4,9,5,1], 9),
    LINK('Find a museum', 'https://www.artsy.net/institutions', [4,10,5,1], 9),
    LINK('The Met', 'https://www.metmuseum.org/art/collection', [4,11,5,1], 9)
  ], sref:{amuseums:'museums'}},

  // "keep track of games that I need to play; keep track of my favorite games"
  {key:'games', sec:'experience', inbox:'note', nm:'Games', ic:'grid', c:14, of:'lf_games', on:[
    LIST('To play', 'gto', [1,1,4,5], 14),
    LIST('Favorites', 'gfav', [5,1,4,5], 13),
    {k:'progressbar', t:'How far into this one', b:[1,6,8,1], set:{c:14}},
    {k:'deck', t:'What to play', b:[1,7,3,4], set:{c:10}, kids:CARDS([
      'The one you stopped halfway', 'Something short', 'Co-op with a friend',
      'A board game night', 'A classic', 'The newest thing you own'
    ])},
    {k:'die', t:'Roll', b:[4,7,2,2], set:{c:14, sides:20}},
    MAKES('Just finished…', 'review', [6,7,3,1], 13, '@gdone'),
    LIST('Finished', 'gdone', [6,8,3,3], 5),
    LINK('Backloggd', 'https://backloggd.com', [1,11,4,1], 9),
    LINK('BoardGameGeek', 'https://boardgamegeek.com', [5,11,4,1], 9)
  ], sref:{gto:'toplay'}},

  // "restaurants that I want to try, foods that I want to try, recipes that I
  // want to try"
  {key:'food', sec:'experience', inbox:'note', nm:'Food', ic:'pot', c:6, of:'lf_food', on:[
    LIST('Restaurants to try', 'frest', [1,1,4,5], 6),
    LIST('Foods to try', 'ffoods', [5,1,4,5], 13),
    LIST('Recipes to try', 'frecipes', [1,6,4,5], 2),
    {k:'deck', t:'Tonight', b:[5,6,4,3], set:{c:10}, kids:CARDS([
      'Somewhere you have walked past a hundred times', 'A cuisine you have never had',
      'Cook the recipe you saved last month', 'Breakfast for dinner',
      'The place a friend keeps mentioning', 'Something with one ingredient you have never used'
    ])},
    LINK('Book a table', 'https://www.opentable.com', [5,9,4,1], 9),
    LINK('Recipes', 'https://cooking.nytimes.com', [5,10,4,1], 9),
    LINK('Near me', 'https://www.google.com/maps/search/restaurants', [1,11,8,1], 9)
  ], sref:{frest:'restaurants'}},





  /* ---- something you go and take in --------------------------------- */




  /* ---- a piece of work ---------------------------------------------- */

  /* ---- a piece of work, rebuilt — decision 238 -----------------------------
     Timothy marked every project flow *rework* on the Bureau Scope page, and
     wrote for the two films: casting, storyboard, props, locations, script.
     So a film is its departments, a board each, and the rest were rebuilt
     from the verbs proposed there (plan, make, schedule, track, reference),
     each with somewhere to make the thing, somewhere to see how far along it
     is, and the way out to where the work is done. Each is the flow of its
     own type (decision 236). */

  {key:'shortfilm', ...FILM_BENCH, sec:'project', nm:'Short Film', ic:'clapper', c:9, of:'film', on:[
    {k:'progressbar', t:'Where it stands', b:[1,1,8,1], set:{c:13, tracks:'@sfstages'}},
    STAGES('sfstages', ['Logline','Script locked','Cast','Crew','Locations','Shot list','Shoot','Picture lock','Sound and color','Festivals'], [1,2,4,6], 9),
    {k:'question', t:'What is it about?', b:[5,2,4,3], set:{c:10, sref:'logline'}},
    {k:'script', t:'Script', b:[5,5,4,3], set:{c:9, onclick:'write'}},
    {k:'outline', t:'Beats', b:[1,8,4,2], set:{c:14}},
    CAL('Shoot days', [5,8,4,4], 7),
    {k:'appt', t:'First shoot day', b:[1,10,4,2], set:{c:8, sref:'shoot'}},
    LINK('Call sheets', 'https://www.studiobinder.com', [1,12,4,1], 9),
    LINK('Festivals', 'https://filmfreeway.com', [5,12,4,1], 9)
  ], boards: FILM_DEPARTMENTS(9).concat([SCENE_PIPELINE([2,1])])},

  {key:'featurefilm', ...FILM_BENCH, sec:'project', nm:'Feature Film', ic:'clapper', c:9, of:'pj_featurefilm', on:[
    {k:'progressbar', t:'Where it stands', b:[1,1,8,1], set:{c:13, tracks:'@ffstages'}},
    STAGES('ffstages', ['Treatment','First draft','Rewrite','Financing','Casting','Crew','Locations','Schedule','Shoot','Edit','Sound and music','Color','Festivals and distribution'], [1,2,4,7], 9),
    {k:'question', t:'What is it about?', b:[5,2,4,3], set:{c:10, sref:'logline'}},
    {k:'script', t:'Screenplay', b:[5,5,4,3], set:{c:9, onclick:'write'}},
    {k:'outline', t:'Treatment', b:[5,8,4,2], set:{c:14}},
    CAL('Production', [1,9,4,3], 7),
    {k:'appt', t:'First shoot day', b:[5,10,4,2], set:{c:8, sref:'shoot'}},
    LINK('Schedule and budget', 'https://www.studiobinder.com', [1,12,4,1], 9),
    LINK('Festivals', 'https://filmfreeway.com', [5,12,4,1], 9)
  ], boards: FILM_DEPARTMENTS(9).concat([SCENE_PIPELINE([2,1])])},

  {key:'tvshow', sec:'project', nm:'TV Show', ic:'film', c:9, of:'pj_tvshow', on:[
    {k:'question', t:'What is the show?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'note', t:'The bible', b:[5,1,4,5], set:{c:14, body:'**The world —** \n\n**The rules —** \n\n**The tone —** \n\n**Where it goes —** '}},
    {k:'drawer', t:'Characters', b:[1,4,4,3], set:{c:13}, kids:[
      {k:'character', t:'The lead'}, {k:'character', t:'Who is in the way'}, {k:'character', t:'The friend'}]},
    {k:'script', t:'Pilot', b:[5,6,4,3], set:{c:9, onclick:'write'}},
    STAGES('tvstages', ['Pitch','Bible','Pilot','Pilot rewrite','Episodes broken','Series pitch'], [1,7,4,5], 9),
    {k:'progressbar', t:'Where it stands', b:[5,9,4,1], set:{c:13, tracks:'@tvstages'}},
    LINK('Screenplay', 'https://www.writerduet.com', [5,10,4,1], 9)
  ], boards:[{at:[1,0], on:[
    {k:'drawer', t:'Episode 1', b:[1,1,4,3], set:{c:9, face:'checklist', clhead:'1', layout:'list'}, kids:[{k:'outline', t:'Beats'}]},
    {k:'drawer', t:'Episode 2', b:[5,1,4,3], set:{c:9, face:'checklist', clhead:'1', layout:'list'}, kids:[{k:'outline', t:'Beats'}]},
    {k:'drawer', t:'Episode 3', b:[1,4,4,3], set:{c:9, face:'checklist', clhead:'1', layout:'list'}, kids:[{k:'outline', t:'Beats'}]},
    {k:'drawer', t:'Episode 4', b:[5,4,4,3], set:{c:9, face:'checklist', clhead:'1', layout:'list'}, kids:[{k:'outline', t:'Beats'}]},
    {k:'drawer', t:'Episode 5', b:[1,7,4,3], set:{c:9, face:'checklist', clhead:'1', layout:'list'}, kids:[{k:'outline', t:'Beats'}]},
    {k:'drawer', t:'Episode 6', b:[5,7,4,3], set:{c:9, face:'checklist', clhead:'1', layout:'list'}, kids:[{k:'outline', t:'Beats'}]},
    {k:'outline', t:'The season', b:[1,10,8,3], set:{c:14}}
  ]}]},

  {key:'videoessay', sec:'project', nm:'Video Essay', ic:'film', c:13, of:'pj_videoessay', on:[
    {k:'progressbar', t:'Where it stands', b:[1,1,8,1], set:{c:13, tracks:'@vestages'}},
    {k:'question', t:'What is the argument?', b:[1,2,4,3], set:{c:10, sref:'logline'}},
    STAGES('vestages', ['Research','Outline','Script','Record the voice','Gather footage','Edit','Sound','Thumbnail and title','Publish'], [5,2,4,6], 13),
    {k:'essay', t:'Script', b:[1,5,4,4], set:{c:7, onclick:'write'}},
    {k:'tracker', t:'Words a day', b:[1,9,4,2], set:{c:13, measure:{unit:'words', goal:500, step:100}}},
    CAL('Publishing', [5,8,4,3], 7),
    LINK('Your channel', 'https://studio.youtube.com', [1,11,4,1], 9, 'channel'),
    LINK('Footage', 'https://archive.org/details/movies', [5,11,4,1], 9)
  ], boards:[{at:[1,0], on:[
    LIST('Sources', 'vesrc', [1,1,4,6], 12),
    {k:'drawer', t:'Clips', b:[5,1,4,6], set:{c:13}},
    {k:'moodboard', t:'Look', b:[1,7,4,5], set:{c:13}},
    {k:'note', t:'Edit notes', b:[5,7,4,5], set:{c:9}}
  ]}]},

  {key:'song', sec:'project', nm:'Song', ic:'music', c:10, of:'song', on:[
    {k:'poem', t:'Lyrics', b:[1,1,4,6], set:{c:10}},
    {k:'note', t:'Chords and structure', b:[5,1,4,4], set:{c:12, body:'**Key —** \n\n**Verse —** \n\n**Chorus —** \n\n**Bridge —** '}},
    {k:'metronome', t:'Tempo', b:[5,5,2,2], set:{c:10, bpm:92}},
    {k:'counter', t:'Takes', b:[7,5,2,2], set:{c:10}},
    {k:'audio', t:'Voice memo', b:[1,7,4,3], set:{c:10}},
    STAGES('sgstages', ['Idea','Lyrics','Demo','Arrangement','Record','Mix','Master','Release'], [5,7,4,5], 10),
    {k:'progressbar', t:'Where it stands', b:[1,10,4,1], set:{c:13, tracks:'@sgstages'}},
    LINK('Distribute it', 'https://distrokid.com', [1,11,4,1], 9)
  ]},

  {key:'album', sec:'project', nm:'Album', ic:'music', c:10, of:'pj_album', on:[
    {k:'progressbar', t:'Where it stands', b:[1,1,8,1], set:{c:13, tracks:'@alstages'}},
    {k:'question', t:'What is the record about?', b:[1,2,4,3], set:{c:10, sref:'logline'}},
    STAGES('alstages', ['Songs written','Demos','Tracklist','Recording','Mixing','Mastering','Artwork','Release'], [5,2,4,5], 10),
    {k:'moodboard', t:'Artwork', b:[1,5,4,4], set:{c:13}},
    CAL('Sessions and release', [5,7,4,4], 7),
    {k:'metronome', t:'Tempo', b:[1,9,2,2], set:{c:10, bpm:100}},
    LINK('Distribute it', 'https://distrokid.com', [3,9,2,1], 9),
    LINK('Bandcamp', 'https://bandcamp.com', [3,10,2,1], 9)
  ], boards:[{at:[1,0], on:[
    {k:'song', t:'Track 1', b:[1,1,4,3], set:{c:10}},
    {k:'song', t:'Track 2', b:[5,1,4,3], set:{c:10}},
    {k:'song', t:'Track 3', b:[1,4,4,3], set:{c:10}},
    {k:'song', t:'Track 4', b:[5,4,4,3], set:{c:10}},
    {k:'song', t:'Track 5', b:[1,7,4,3], set:{c:10}},
    {k:'song', t:'Track 6', b:[5,7,4,3], set:{c:10}},
    {k:'note', t:'Tracklist', b:[1,10,8,3], set:{c:12}}
  ]}]},

  {key:'musical', sec:'project', nm:'Musical', ic:'music', c:12, of:'pj_musical', on:[
    {k:'question', t:'What is it about?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'script', t:'Book', b:[5,1,4,3], set:{c:9, onclick:'write'}},
    {k:'drawer', t:'Characters', b:[1,4,4,3], set:{c:13}, kids:[
      {k:'character', t:'The lead'}, {k:'character', t:'Who is in the way'}]},
    {k:'outline', t:'Scenes and songs', b:[5,4,4,4], set:{c:14}},
    STAGES('mustages', ['Story','Song list','Book draft','Songs demoed','Table read','Workshop','Staging'], [1,7,4,5], 12),
    {k:'progressbar', t:'Where it stands', b:[5,8,4,1], set:{c:13, tracks:'@mustages'}},
    {k:'metronome', t:'Tempo', b:[5,9,2,2], set:{c:10, bpm:110}},
    LINK('Rehearsal space', 'https://www.peerspace.com', [7,9,2,1], 9)
  ], boards:[{at:[1,0], on:[
    {k:'poem', t:'Opening number', b:[1,1,4,4], set:{c:10}},
    {k:'poem', t:'The I want song', b:[5,1,4,4], set:{c:10}},
    {k:'poem', t:'Act one finale', b:[1,5,4,4], set:{c:10}},
    {k:'poem', t:'Eleven o’clock number', b:[5,5,4,4], set:{c:10}},
    {k:'audio', t:'Demos', b:[1,9,8,3], set:{c:10}}
  ]}]},

  {key:'play', sec:'project', nm:'Play', ic:'feather', c:8, of:'pj_play', on:[
    {k:'question', t:'What is it about?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'script', t:'The play', b:[5,1,4,4], set:{c:9, onclick:'write'}},
    {k:'drawer', t:'Characters', b:[1,4,4,3], set:{c:13}, kids:[
      {k:'character', t:'The lead'}, {k:'character', t:'Who is in the way'}]},
    {k:'outline', t:'Scenes', b:[5,5,4,3], set:{c:14}},
    STAGES('plstages', ['Idea','First draft','Reading','Rewrite','Casting','Rehearsals','Tech','Opening'], [1,7,4,5], 8),
    {k:'progressbar', t:'Where it stands', b:[5,8,4,1], set:{c:13, tracks:'@plstages'}},
    CAL('Rehearsals and shows', [5,9,4,3], 7),
    LINK('Schedule rehearsals', 'https://www.studiobinder.com', [1,12,8,1], 9)
  ]},

  {key:'script', sec:'project', nm:'Screenplay', ic:'clapper', c:9, of:'pj_script', on:[
    {k:'question', t:'What is it about?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'script', t:'The script', b:[5,1,4,5], set:{c:9, onclick:'write'}},
    {k:'outline', t:'Beats', b:[1,4,4,4], set:{c:14}},
    {k:'tracker', t:'Pages a day', b:[5,6,4,2], set:{c:9, measure:{unit:'pages', goal:3, step:1}}},
    STAGES('scstages', ['Logline','Treatment','Beat sheet','First draft','Notes','Rewrite','Polish'], [1,8,4,4], 9),
    {k:'progressbar', t:'Where it stands', b:[5,8,4,1], set:{c:13, tracks:'@scstages'}},
    {k:'drawer', t:'Characters', b:[5,9,4,2], set:{c:13}},
    LINK('Write it', 'https://www.writerduet.com', [5,11,4,1], 9)
  ]},

  {key:'novel', rail:{left:['glass'], right:['spool','gear']}, sec:'project', nm:'Novel', ic:'book', c:11, of:'pj_novel', on:[
    {k:'question', t:'What is it about?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'tracker', t:'Words a day', b:[5,1,4,2], set:{c:11, sref:'words', measure:{unit:'words', goal:1000, step:250}}},
    {k:'candle', t:'Write until it burns down', b:[5,3,2,2], set:{c:12}},
    {k:'hourglass', t:'Sprint', b:[7,3,2,2], set:{c:12, mins:25}},
    STAGES('nvstages', ['Premise','Outline','First draft','Second draft','Readers','Final draft','Query or publish'], [1,4,4,5], 11),
    {k:'outline', t:'Chapters', b:[5,5,4,4], set:{c:14}},
    {k:'progressbar', t:'Where it stands', b:[1,9,4,1], set:{c:13, tracks:'@nvstages'}},
    {k:'book', t:'The manuscript', b:[5,9,2,3], set:{c:11}},
    LINK('Find an agent', 'https://querytracker.net', [1,10,4,1], 9),
    LINK('Write it', 'https://www.literatureandlatte.com/scrivener', [1,11,4,1], 9)
  ], boards:[{at:[0,1], on:[
    {k:'drawer', t:'Characters', b:[1,1,4,4], set:{c:13}, kids:[
      {k:'character', t:'The lead'}, {k:'character', t:'Who is in the way'}, {k:'character', t:'The one who helps'}]},
    {k:'world', t:'The world', b:[5,1,4,4], set:{c:9}},
    {k:'drawer', t:'Places', b:[1,5,4,3], set:{c:12}, kids:[{k:'place', t:'Where it starts'}]},
    {k:'drawer', t:'Research', b:[5,5,4,3], set:{c:14}},
    {k:'moodboard', t:'Look and feel', b:[1,8,8,4], set:{c:13}}
  ]}]},

  {key:'shortstory', sec:'project', nm:'Short Story', ic:'feather', c:14, of:'pj_shortstory', on:[
    {k:'question', t:'What is it about?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'essay', t:'The story', b:[5,1,4,5], set:{c:14, onclick:'write'}},
    {k:'drawer', t:'Characters', b:[1,4,4,3], set:{c:13}, kids:[{k:'character', t:'The lead'}]},
    {k:'tracker', t:'Words a day', b:[5,6,4,2], set:{c:14, measure:{unit:'words', goal:500, step:100}}},
    STAGES('ssstages', ['Idea','Draft','Rest it','Rewrite','Readers','Submit'], [1,7,4,5], 14),
    {k:'progressbar', t:'Where it stands', b:[5,8,4,1], set:{c:13, tracks:'@ssstages'}},
    {k:'candle', t:'Write until it burns down', b:[5,9,2,2], set:{c:12}},
    LINK('Where to send it', 'https://chillsubs.com', [7,9,2,1], 9)
  ]},

  {key:'poem', sec:'project', nm:'Poem', ic:'feather', c:10, of:'pj_poem', on:[
    {k:'poem', t:'The poem', b:[1,1,5,6], set:{c:10}},
    {k:'deck', t:'A way in', b:[6,1,3,4], set:{c:10}, kids:CARDS([
      'Begin with an object on the table', 'Write it as a letter', 'Only questions',
      'Fourteen lines', 'The weather, and something else', 'Steal a first line'])},
    {k:'hourglass', t:'Ten minutes', b:[6,5,3,2], set:{c:12, mins:10}},
    {k:'drawer', t:'Drafts', b:[1,7,4,3], set:{c:14}},
    {k:'note', t:'Lines worth keeping', b:[5,7,4,3], set:{c:12}},
    LINK('Where to send it', 'https://chillsubs.com', [1,10,8,1], 9)
  ]},

  {key:'essay', sec:'project', nm:'Essay', ic:'feather', c:7, of:'writing', on:[
    {k:'question', t:'What is the argument?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'essay', t:'The essay', b:[5,1,4,5], set:{c:7, onclick:'write'}},
    {k:'outline', t:'Outline', b:[1,4,4,4], set:{c:14}},
    {k:'tracker', t:'Words a day', b:[5,6,4,2], set:{c:7, sref:'words', measure:{unit:'words', goal:500, step:100}}},
    LIST('Sources', 'esrc', [1,8,4,4], 12),
    STAGES('esstages', ['Research','Outline','Draft','Cut','Edit','Publish'], [5,8,4,4], 7),
    LINK('Look it up', 'https://scholar.google.com', [1,12,4,1], 9),
    {k:'progressbar', t:'Where it stands', b:[5,12,4,1], set:{c:13, tracks:'@esstages'}}
  ]},

  {key:'blogpost', sec:'project', nm:'Blog Post', ic:'send', c:5, of:'pj_blogpost', on:[
    {k:'question', t:'Who is it for, and what will they get?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'essay', t:'The post', b:[5,1,4,5], set:{c:5, onclick:'write'}},
    {k:'outline', t:'Headings', b:[1,4,4,3], set:{c:14}},
    {k:'appt', t:'Publish on', b:[1,7,4,2], set:{c:8, sref:'publish'}},
    STAGES('bpstages', ['Idea','Draft','Pictures','Edit','Title and summary','Publish','Share it'], [5,6,4,6], 5),
    {k:'moodboard', t:'Pictures', b:[1,9,4,3], set:{c:13}},
    LINK('Your blog', '', [1,12,4,1], 9, 'site'),
    {k:'progressbar', t:'Where it stands', b:[5,12,4,1], set:{c:13, tracks:'@bpstages'}}
  ]},

  {key:'application', sec:'project', nm:'Application', ic:'grid', c:14, of:'app', on:[
    {k:'question', t:'What does it do, for whom?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'progressbar', t:'This release', b:[5,1,4,1], set:{c:13, tracks:'@apstages'}},
    STAGES('apstages', ['Sketch','Prototype','Core feature','Test with someone','Polish','Ship'], [5,2,4,5], 14),
    {k:'moodboard', t:'Screens', b:[1,4,4,4], set:{c:13}},
    {k:'checklist', t:'Bugs', b:[5,7,4,4], set:{c:1}},
    {k:'problem', t:'The hard part', b:[1,8,4,3], set:{c:10}},
    LINK('The repository', 'https://github.com', [1,11,4,1], 9, 'repo'),
    LINK('Design', 'https://www.figma.com', [5,11,4,1], 9)
  ]},

  {key:'website', sec:'project', nm:'Website', ic:'grid', c:13, of:'pj_website', on:[
    {k:'question', t:'Who is it for, and what should they do?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'outline', t:'Pages', b:[5,1,4,4], set:{c:14}},
    {k:'moodboard', t:'Look', b:[1,4,4,4], set:{c:13}},
    STAGES('wbstages', ['Pages and words','Look','Build','Content in','Test on a phone','Launch'], [5,5,4,5], 13),
    {k:'essay', t:'The words', b:[1,8,4,3], set:{c:7, onclick:'write'}},
    {k:'progressbar', t:'Where it stands', b:[5,10,4,1], set:{c:13, tracks:'@wbstages'}},
    LINK('The site', '', [1,11,4,1], 9, 'site'),
    LINK('Hosting', 'https://pages.github.com', [5,11,4,1], 9)
  ]},

  {key:'game', sec:'project', nm:'Game', ic:'grid', c:9, of:'game', on:[
    {k:'question', t:'What does the player do?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'book', t:'The rules', b:[5,1,2,4], set:{c:9}},
    {k:'die', t:'Test roll', b:[7,1,2,2], set:{c:14, sides:6}},
    {k:'deck', t:'Cards to try', b:[7,3,2,2], set:{c:10}, kids:CARDS(['A card', 'Another card'])},
    STAGES('gmstages', ['Core loop','Paper prototype','First playtest','Rules rewrite','Art','Second playtest','Release'], [1,4,4,5], 9),
    {k:'outline', t:'Mechanics', b:[5,5,4,4], set:{c:14}},
    {k:'progressbar', t:'Where it stands', b:[1,9,4,1], set:{c:13, tracks:'@gmstages'}},
    {k:'note', t:'Playtest notes', b:[1,10,4,2], set:{c:12}},
    LINK('Print and play', 'https://www.thegamecrafter.com', [5,9,4,1], 9),
    LINK('Engine', 'https://godotengine.org', [5,10,4,1], 9)
  ]},

  {key:'world', sec:'project', nm:'Fantasy World', ic:'star', c:9, of:'world', on:[
    {k:'question', t:'What makes it different?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'timeline', t:'History', b:[5,1,4,3], set:{c:9}},
    {k:'drawer', t:'Places', b:[1,4,4,4], set:{c:12}, kids:[{k:'place', t:'The capital'}, {k:'place', t:'The edge of the map'}]},
    {k:'drawer', t:'Peoples and groups', b:[5,4,4,4], set:{c:13}, kids:[{k:'group', t:'Those in power'}]},
    {k:'drawer', t:'Laws of the world', b:[1,8,4,4], set:{c:14}, kids:[{k:'law', t:'How magic works'}, {k:'law', t:'What it costs'}]},
    {k:'die', t:'Roll for it', b:[5,8,2,2], set:{c:14, sides:20}},
    {k:'deck', t:'What if…', b:[7,8,2,2], set:{c:10}, kids:CARDS(['A war nobody remembers', 'A god who left', 'A trade route', 'A forbidden word'])},
    {k:'drawer', t:'Characters', b:[5,10,4,2], set:{c:13}},
    LINK('Make a map', 'https://inkarnate.com', [1,12,8,1], 9)
  ]},

  {key:'device', sec:'project', nm:'Device', ic:'sliders', c:15, of:'pj_device', on:[
    {k:'question', t:'What does it do?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'checklist', t:'Parts', b:[5,1,4,5], set:{c:15}},
    {k:'moodboard', t:'Sketches and wiring', b:[1,4,4,4], set:{c:13}},
    STAGES('dvstages', ['Sketch','Parts ordered','Breadboard','Firmware','Enclosure','Test','Done'], [5,6,4,5], 15),
    {k:'problem', t:'What is not working', b:[1,8,4,3], set:{c:1}},
    {k:'progressbar', t:'Where it stands', b:[1,11,4,1], set:{c:13, tracks:'@dvstages'}},
    LINK('Parts', 'https://www.digikey.com', [5,11,4,1], 9),
    LINK('Code', 'https://github.com', [5,12,4,1], 9)
  ]},

  {key:'handmade', sec:'project', nm:'Handmade Object', ic:'star', c:6, of:'pj_handmade', on:[
    {k:'question', t:'What is it, and who is it for?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'checklist', t:'Materials', b:[5,1,4,5], set:{c:6}},
    {k:'moodboard', t:'References', b:[1,4,4,4], set:{c:13}},
    STAGES('hmstages', ['Design','Materials','Make a test','Make it','Finish','Give it or keep it'], [5,6,4,5], 6),
    {k:'tracker', t:'Hours at the bench', b:[1,8,4,2], set:{c:6, measure:{unit:'hours', goal:1, step:0.5}}},
    {k:'hourglass', t:'One session', b:[1,10,2,2], set:{c:12, mins:45}},
    {k:'progressbar', t:'Where it stands', b:[3,10,2,1], set:{c:13, tracks:'@hmstages'}},
    LINK('Supplies', 'https://www.etsy.com', [5,11,4,1], 9)
  ]},

  {key:'artwork', sec:'project', inbox:'note', nm:'Artwork', ic:'image', c:12, of:'artpiece', on:[
    {k:'question', t:'What is it about?', b:[1,1,4,3], set:{c:10, sref:'logline'}},
    {k:'moodboard', t:'Studies', b:[5,1,4,5], set:{c:13}},
    {k:'moodboard', t:'References', b:[1,4,4,4], set:{c:13}},
    {k:'tracker', t:'Hours making', b:[5,6,4,2], set:{c:12, measure:{unit:'hours', goal:1, step:0.5}}},
    STAGES('awstages', ['Sketches','Studies','Materials','Underpainting','The work','Finish','Photograph it'], [1,8,4,4], 12),
    {k:'progressbar', t:'Where it stands', b:[5,8,4,1], set:{c:13, tracks:'@awstages'}},
    {k:'hourglass', t:'A timed study', b:[5,9,2,2], set:{c:12, mins:20}},
    LINK('Supplies', 'https://www.blickart.com', [7,9,2,1], 9)
  ]},



  /* ============================================================
     The twenty-three that followed (decision 196)
     ============================================================
     The rest of Timothy's list, built the same way: what next, when, a thing
     that helps, and the way out. Five parts of a life, three things you take
     in, and fifteen pieces of work. */

  /* ---- a part of your life, continued -------------------------------- */






  /* ---- something you take in, continued ------------------------------- */




  /* ---- a piece of work, continued ------------------------------------ */
















  /* ============================================================
     The flows Timothy added in the Workshop (decision 218)
     ============================================================
     Named there with a purpose and nothing on the board yet, so these are a
     first pass at each: the same four things every board carries (what to do
     next, when, something that helps, the way out), in his words where he
     gave any. `work` is a fourth list: flows for getting work done rather
     than for one part of a life or one piece of work. */






  // "Allows you to easily add anything to a bucket and helps you sort it."
  /* **The Brain Dump bench** (decision 293): clear skies (Aeros), nothing
     falling, the bars showing, and a selector that makes only the things a
     head empties into. The front's stamp says Filed, for marking what is
     dealt with as you go down the lists. */
  {key:'braindump', rail:{left:['glass','stamp','coin'], right:['spool','gear']}, sec:'work', inbox:'note', nm:'Brain Dump', ic:'inbox', c:5, of:'wf_braindump',
   env:{style:'aero', flow:false, gravity:false, tuck:false}, stamp:{w:'Filed', ink:'blue'},
   makes:{only:['notepad','task','idea','question','thought','note','pipe'], sizes:[]},
   /* **Nothing laid out in it** (decision 296): the Brain Dump is itself the
      inbox, in line view, so what is inside it is only what you wrote. The
      bench is its room, its front and its stamp. Its way out is the tray of
      drawers a held line can be dragged into. */
   inbox:false, raw:true, on:[]},

  /* **The Prioritizer bench** (decision 293): a matrix of four zones, how
     much it matters across the top and how hard it is down the side. Put a
     thing in a quadrant and that is its priority and its effort, written onto
     it, so every board's "most important first" agrees with the decision. The
     way in along the bottom is where things to weigh arrive; the deck asks
     the questions and the hourglass keeps it short. Golf 97, desktop gray.
     `raw`, so the two empty rows where new things arrive are not filled. */
  {key:'prioritizer', raw:true, rail:{left:['glass','block','stamp'], right:['lock','gear']}, sec:'work', inbox:'task', nm:'Prioritizer', ic:'grid', c:13, of:'wf_prioritizer',
   env:{style:'golf97', flow:false, gravity:false}, stamp:{w:'Done', ink:'green'},
   makes:{only:['task','note','card','zone'], sizes:[]}, on:[
    ZONE('Do now', {prio:5, diff:2}, [1,1,4,4], 6),
    ZONE('Plan it', {prio:4, diff:4}, [5,1,4,4], 9),
    ZONE('Squeeze in', {prio:2, diff:1}, [1,5,4,4], 12),
    ZONE('Let it go', {prio:0, diff:5}, [5,5,4,4], 11),
    // rows 9 and 10 are left empty: what is added arrives here, outside every zone
    {k:'deck', t:'Ask it', b:[1,11,2,2], set:{c:10}, kids:CARDS([
      'Will this matter in a year?', 'What happens if it never gets done?', 'Who is waiting on it?',
      'Is there a smaller version?', 'What would make the rest easier?', 'Is it yours to do?'])},
    {k:'hourglass', t:'Ten minutes', b:[3,11,1,2], set:{c:12, mins:10}},
    {k:'note', t:'How it works', b:[4,11,5,1], set:{c:13, body:'Drop a thing in a square: **Do now** matters and is easy, **Plan it** matters and is hard, **Squeeze in** is small, **Let it go** is not worth it.'}},
    // every board has a way out (decision 194): somewhere to give Do now a time
    LINK('Give it a time', 'https://calendar.google.com', [4,12,5,1], 9)
  ]},

  // "Helps me prioritize all my projects and focus."
  {key:'projectmgmt', rail:{left:['glass','block'], right:['spool','lock','gear']}, sec:'work', nm:'Project Management', ic:'target', c:13, of:'wf_projectmgmt', on:[
    LABEL('Projects', [1,1,8,1], 13),
    LIST('Now, three at most', 'pmnow', [1,2,4,4], 9),
    LIST('Next', 'pmnext', [5,2,4,4], 6),
    LIST('Waiting on someone', 'pmwait', [1,6,4,3], 12),
    LIST('Paused', 'pmpaused', [5,6,4,3], 5),
    CAL('Deadlines', [1,9,4,2], 7),
    LINK('Google Calendar', 'https://calendar.google.com', [1,11,4,1], 9),
    {k:'deck', t:'Focus', b:[5,9,2,3], set:{c:10}, kids:CARDS([
      'What one thing moves it most?', 'What can you drop?', 'What is blocked, and by whom?',
      'Finish before you start', 'What is due first?', 'Ship the smallest version'
    ])},
    {k:'hourglass', t:'Deep work', b:[7,9,2,3], set:{c:12, mins:50}}
  ],
  /* **Three boards across** (decision 219): what is on now in the middle,
     where it opens; everything not yet started to the left, which is where
     you reach for the next one; what is finished to the right, which is where
     you look back. */
  boards:[
    {at:[-1,0], on:[
      MAKES('Someday, maybe…', 'task', [1,1,8,1], 12, '@pmsome'),
      LIST('Someday', 'pmsome', [1,2,4,7], 12),
      LIST('Ideas for projects', 'pmideas', [5,2,4,5], 10),
      {k:'note', t:'Picking the next one', b:[5,7,4,2], set:{c:5,
        body:'**Why now —** \n\n**What it replaces —** \n\n**First step —** '}},
      {k:'die', t:'Can’t choose', b:[1,9,2,2], set:{c:14, sides:6}},
      {k:'note', t:'The rule', b:[3,9,6,2], set:{c:5}, body:'Nothing moves to Now until something in Now is finished.'}
    ]},
    {at:[1,0], on:[
      LIST('Finished', 'pmdone', [1,1,4,7], 6),
      {k:'counter', t:'Shipped this year', b:[5,1,4,2], set:{c:13}},
      {k:'note', t:'Looking back', b:[5,3,4,5], set:{c:12,
        body:'**What went well —** \n\n**What took longer —** \n\n**Next time —** '}},
      Object.assign(AGAIN('Weekly review', 1, 'week'), {b:[1,11,8,1]}),
      {k:'deck', t:'Review', b:[1,8,4,3], set:{c:10}, kids:CARDS([
        'What did you finish?', 'What stalled, and why?', 'What should stop?',
        'Who needs an update?', 'What is next week’s one thing?'
      ])},
      CAL('This month', [5,8,4,3], 7)
    ]}
  ]},

  {key:'brainstorming', rail:{left:['coin','glass'], right:['spool','gear']}, sec:'work', inbox:'idea', nm:'Brainstorm', ic:'sparkle', c:10, of:'wf_brainstorming', on:[
    LABEL('Brainstorm', [1,1,8,1], 10),
    {k:'note', t:'The question', b:[1,2,8,2], set:{c:12}, body:'What are we trying to solve?'},
    MAKES('Another idea…', 'idea', [1,4,8,1], 10, '@bsall'),
    LIST('Everything, no judging', 'bsall', [1,5,4,5], 10),
    LIST('The best three', 'bsbest', [5,5,4,3], 13),
    {k:'hourglass', t:'Five minutes', b:[5,8,2,2], set:{c:12, mins:5}},
    {k:'die', t:'Pick one at random', b:[7,8,2,2], set:{c:14, sides:6}},
    {k:'deck', t:'Oblique turns', b:[1,10,4,2], set:{c:10}, kids:CARDS([
      'Reverse it', 'Make it absurd', 'What would a child do?',
      'Steal from another field', 'Make it free', 'Make it ten times bigger'
    ])},
    {k:'note', t:'Next step', b:[5,10,4,1], set:{c:6}},
    LINK('Are.na', 'https://www.are.na', [5,11,4,1], 9)
  ]}

];

/* `raw` is the boards as authored, before `fillRows()` — only migration 40
   asks, to tell a stock plan nobody has touched from one somebody has. */
const stockPlans = raw => SPECS.map(sp=>build(raw ? Object.assign({}, sp, {raw:true}) : sp));
// which ten there are, for a migration that has to know what it already added
const STOCK_KEYS = SPECS.map(s=>s.key);

/* The ten that shipped first (decision 172), one per job a paper system does.
   Decision 194 replaced them with boards for a part of your life, a thing you
   take in and a piece of work; migration 37 takes these off a desk that still
   has them, by this list and only by this list, so a plan you saved yourself
   is never touched. */
const RETIRED_KEYS = ['morning','brainstorm','workbench','shootday','daylog',
                      'review','reading','tiers','goals','practice'];
/* Cut on the Bureau Scope page (2026-09-28): Ideas was Brain Dump and
   Brainstorm again. Migration 47 takes it off a desk by this list. */
const CUT_KEYS = ['ideas'];

export { stockPlans, STOCK_KEYS, RETIRED_KEYS, CUT_KEYS };
