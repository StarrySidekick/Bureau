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
    [{k:'generator', t:'Add to this…', b:[1,13,8,2], set:{genKind:spec.inbox||'task', c:spec.c}}];
  (spec.on||[]).concat(inbox).forEach(s=>add(s, PLAN_ROOT));
  if(!spec.raw) fillRows(objects.filter(o=>o.parent===PLAN_ROOT && o.desk && o.title!=='Add to this…'));
  objects.forEach(o=>{
    ['tracks','into'].forEach(k=>{
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
    made: D.iso(D.today()),
    cols: 8,
    objects
  };
}

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
const MAKES = (t, kind, b, c, into)=>({k:'generator', t, b, set:into ? {genKind:kind, c, into} : {genKind:kind, c}});
/* A drawer that is a list with its name on it: where a spawner on the same
   board files what it makes (decision 197). It was a sorting drawer collecting
   by type from this board, which showed a knob and nothing else, and could not
   be filed into because a sorting drawer holds nothing. */
const LIST = (t, ref, b, c)=>({k:'drawer', t, ref, b, set:{c, face:'checklist', clhead:'1', undated:'1', layout:'list'}});
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
const LINK = (t, url, b, c)=>({k:'outlink', t, b, set:{c, link:{label:t, target:url}}});
// a task that comes back, which is what a checkup, a bill and a habit all are
const AGAIN = (t, every, unit, from)=>({k:'task', t,
  set:{attrs:['text','check','date','repeat'],
       repeat:{every, unit, days:[], from:from||'date', ends:null, paused:false, made:0}}});
// a card in a deck, which is a prompt when the deck is a generator
const CARDS = list => list.map(t=>({k:'note', t}));

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

  /* Health is mostly remembering: when the next appointment is, what you meant
     to ask, and the checkups that come round once a year and are forgotten for
     three. The checkups repeat from the day they were *done*, because the next
     cleaning is six months after the last one and not six months after the
     day it was meant to be. */
  {key:'health', sec:'life', nm:'Health', ic:'drop', c:8, of:'life', life:'health', on:[
    LABEL('Health', [1,1,8,1], 8),
    {k:'appt', t:'Next appointment', b:[1,2,4,3], set:{c:8,
      body:'**Who —** \n\n**Bring —** '}},
    CAL('Coming up', [5,2,4,3], 7),
    {k:'checklist', t:'Checkups', b:[1,5,4,4], set:{c:6}, kids:[
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
    LINK('Patient portal', 'https://www.mychart.org', [5,9,4,1], 9),
    LINK('Find a doctor', 'https://www.zocdoc.com', [5,10,4,1], 9)
  ]},

  /* Money is a list of things that come round, the days they are owed, and one
     number you are trying to move. The bar reads the goal's own milestones,
     so ticking a milestone is the whole of keeping it true. The bank is left
     without an address on purpose: pressing it opens its editor, which is the
     one place a Link teaches you that it can be pointed anywhere. */
  {key:'money', sec:'life', nm:'Finances', ic:'bar', c:13, of:'life', life:'money', on:[
    LABEL('Money', [1,1,8,1], 13),
    {k:'checklist', t:'Bills', b:[1,2,4,5], set:{c:6}, kids:[
      AGAIN('Rent', 1, 'month'),
      AGAIN('Phone', 1, 'month'),
      AGAIN('Internet', 1, 'month'),
      AGAIN('Credit card', 1, 'month'),
      AGAIN('Look over the month', 1, 'month')
    ]},
    CAL('When it is owed', [5,2,4,4], 7),
    {k:'goal', t:'Savings', ref:'save', b:[1,7,4,3], set:{c:13, milestones:[
      {t:'A first cushion', done:false},
      {t:'One month of expenses', done:false},
      {t:'Three months', done:false}
    ]}},
    {k:'progressbar', t:'', b:[5,6,4,1], set:{c:13, tracks:'@save'}},
    {k:'counter', t:'No-spend days', b:[5,7,4,3], set:{c:6}},
    {k:'drawer', t:'Statements', b:[1,10,4,2], set:{c:14}, kids:[
      {k:'note', t:'Budget'},
      {k:'note', t:'Where each account lives'}
    ]},
    LINK('Your bank', '', [5,10,4,1], 9),
    LINK('Credit report', 'https://www.annualcreditreport.com', [5,11,4,1], 9)
  ]},

  /* Moving, every day, and the bar is the run of it: thirty days, counted from
     the day you last moved rather than the day it was due, because you
     exercise the day after you last exercised. The deck is the one thing a
     training plan never has — what to do *today*, turned up rather than
     decided. The metronome is set to a running cadence. */
  {key:'exercise', sec:'life', nm:'Exercise', ic:'star', c:6, of:'life', life:'exercise', on:[
    LABEL('Moving', [1,1,8,1], 6),
    {k:'progressbar', t:'Thirty days', b:[1,2,8,1], set:{c:6, tracks:'@move', target:30}},
    {k:'task', t:'Move today', ref:'move', b:[1,3,8,1],
     set:{c:6, attrs:['text','check','date','repeat','streak'],
          repeat:{every:1, unit:'day', days:[], from:'done', ends:null, paused:false, made:0}}},
    {k:'deck', t:'Today', b:[1,4,3,4], set:{c:10}, kids:CARDS([
      'A run, easy pace', 'Push, pull, legs', 'Thirty minutes of yoga',
      'A long walk, no phone', 'Intervals: one hard, two easy', 'Rest, and stretch'
    ])},
    {k:'metronome', t:'Cadence', b:[4,4,3,4], set:{c:11, bpm:170}},
    {k:'hourglass', t:'Rest', b:[7,4,2,4], set:{c:12, mins:2}},
    CAL('The month', [1,8,4,4], 7, 'month', 'marks'),
    {k:'drawer', t:'Routines', b:[5,8,4,2], set:{c:14}, kids:[
      {k:'note', t:'Warm-up'},
      {k:'note', t:'Strength A'},
      {k:'note', t:'Strength B'}
    ]},
    LINK('Strava', 'https://www.strava.com', [5,10,4,1], 9),
    LINK('A stretch to follow', 'https://www.youtube.com/results?search_query=20+minute+full+body+stretch', [5,11,4,1], 9)
  ]},

  /* Eating is the week: what is for dinner on which day (typed straight into
     the week's days), what to buy for it, and a deck for the evening nobody
     can decide. Recipes live in a drawer and are cards you write on. */
  {key:'nutrition', sec:'life', nm:'Nutrition', ic:'pot', c:11, of:'life', life:'nutrition', on:[
    LABEL('Eating', [1,1,8,1], 11),
    CAL('This week', [1,2,8,3], 7, 'week', 'titles'),
    {k:'checklist', t:'Groceries', b:[1,5,4,5], set:{c:6}, kids:[
      {k:'task', t:'Greens'},
      {k:'task', t:'Fruit'},
      {k:'task', t:'Something for breakfast'},
      {k:'task', t:'Protein for three dinners'}
    ]},
    {k:'deck', t:'What is for dinner?', b:[5,5,4,3], set:{c:10}, kids:CARDS([
      'Stir-fry, whatever is in the fridge', 'Tacos', 'Pasta and greens',
      'Soup and bread', 'A grain bowl', 'Eggs, any way', 'Something new from the drawer'
    ])},
    {k:'drawer', t:'Recipes', b:[5,8,4,2], set:{c:11}, kids:[
      {k:'recipe', t:'The weeknight standby'},
      {k:'recipe', t:'One to try'}
    ]},
    {k:'counter', t:'Glasses of water', b:[1,10,4,2], set:{c:5}},
    LINK('Groceries delivered', 'https://www.instacart.com', [5,10,4,1], 9),
    LINK('Find a recipe', 'https://www.seriouseats.com', [5,11,4,1], 9)
  ]},

  /* ---- something you go and take in --------------------------------- */

  /* A trip is a span of days and three lists — what to pack, what is booked
     and what you want to see. A Trip is born holding it, and so is a Life
     drawer made for Travel. */
  {key:'travel', sec:'experience', nm:'Travel', ic:'flag', c:9, of:'life', life:'travel', on:[
    LABEL('The trip', [1,1,8,1], 9),
    {k:'appt', t:'Getting there', b:[1,2,8,2], set:{c:8}},
    {k:'checklist', t:'Packing', b:[1,4,4,5], set:{c:6}, kids:[
      {k:'task', t:'Passport or ID'},
      {k:'task', t:'Chargers'},
      {k:'task', t:'Toiletries'},
      {k:'task', t:'Clothes for each day'},
      {k:'task', t:'Something to read'},
      {k:'task', t:'Medication'}
    ]},
    CAL('Day by day', [5,4,4,3], 7),
    {k:'drawer', t:'Bookings', b:[5,7,4,2], set:{c:14}, kids:[
      {k:'note', t:'Flights'},
      {k:'note', t:'Where we are staying'},
      {k:'note', t:'Getting around'}
    ]},
    {k:'drawer', t:'Want to see', b:[1,9,4,3], set:{c:12}, kids:[
      {k:'note', t:'Eat'},
      {k:'note', t:'See'},
      {k:'note', t:'Do'}
    ]},
    LINK('Flights', 'https://www.google.com/travel/flights', [5,9,4,1], 9),
    LINK('Getting around', 'https://www.rome2rio.com', [5,10,4,1], 9),
    LINK('Map', 'https://www.google.com/maps', [5,11,4,1], 9)
  ]},

  /* Films: the list, a deck for the night you cannot pick, and a review for
     each one seen, which the Seen drawer collects off this board. */
  {key:'films', sec:'experience', inbox:'note', nm:'Films', ic:'film', c:9, of:'life', life:'films', on:[
    LABEL('Films', [1,1,8,1], 9),
    {k:'checklist', t:'Watchlist', b:[1,2,5,5], set:{c:9}},
    {k:'deck', t:'Pick for me', b:[6,2,3,4], set:{c:10}, kids:CARDS([
      'The one you have meant to see for a year', 'Something from before 1970',
      'Not in English', 'A documentary', 'A director you love, one you have not seen',
      'The one a friend keeps recommending'
    ])},
    MAKES('Just watched…', 'review', [1,7,8,1], 13, '@seen'),
    LIST('Seen', 'seen', [1,8,4,4], 5),
    LINK('Letterboxd', 'https://letterboxd.com', [5,8,4,1], 9),
    LINK('Where to stream it', 'https://www.justwatch.com', [5,9,4,1], 9),
    LINK('Showtimes', 'https://www.fandango.com', [5,10,4,1], 9)
  ]},

  /* Books: how far into this one, what is next, and two things you take out
     of a book — the lines worth keeping and what you made of it — each with a
     drawer that collects it off this board. */
  {key:'books', sec:'experience', inbox:'note', nm:'Books', ic:'book', c:11, of:'life', life:'books', on:[
    LABEL('Reading', [1,1,8,1], 11),
    {k:'progressbar', t:'How far into it', b:[1,2,8,1], set:{c:11}},
    {k:'checklist', t:'To read', b:[1,3,5,4], set:{c:11}},
    {k:'deck', t:'What next?', b:[6,3,3,4], set:{c:10}, kids:CARDS([
      'Something somebody gave you', 'A classic you pretend to have read',
      'Under two hundred pages', 'Something you know nothing about',
      'A reread', 'Poems'
    ])},
    MAKES('A line worth keeping…', 'quote', [1,7,4,1], 5, '@quotes'),
    MAKES('Just finished…', 'review', [5,7,4,1], 13, '@finished'),
    LIST('Quotes', 'quotes', [1,8,4,3], 5),
    LIST('Finished', 'finished', [5,8,4,3], 13),
    LINK('Library', 'https://www.libbyapp.com', [1,11,4,1], 9),
    LINK('The StoryGraph', 'https://app.thestorygraph.com', [5,11,4,1], 9)
  ]},

  /* ---- a piece of work ---------------------------------------------- */

  /* A short film is a run of stages from a logline to a festival, and the bar
     reads the list of them, so the number on it is the work and nothing you
     maintain. The question comes first because it is the one a short film
     most often never answers. */
  {key:'shortfilm', sec:'project', nm:'Short Film', ic:'clapper', c:9, of:'film', on:[
    LABEL('The film', [1,1,8,1], 9),
    {k:'progressbar', t:'Where it stands', b:[1,2,8,1], set:{c:13, tracks:'@stages'}},
    {k:'checklist', t:'Stages', ref:'stages', b:[1,3,4,5], set:{c:9}, kids:[
      {k:'task', t:'Logline'},
      {k:'task', t:'Script locked'},
      {k:'task', t:'Cast and crew'},
      {k:'task', t:'Locations'},
      {k:'task', t:'Shot list'},
      {k:'task', t:'Shoot'},
      {k:'task', t:'Picture lock'},
      {k:'task', t:'Sound and colour'},
      {k:'task', t:'Festivals and release'}
    ]},
    {k:'question', t:'What is it about?', b:[5,3,4,3], set:{c:10}},
    {k:'script', t:'Script', b:[5,6,4,2], set:{c:9, onclick:'write'}},
    {k:'outline', t:'Beats', b:[1,8,4,2], set:{c:14}},
    {k:'moodboard', t:'Look book', b:[5,8,4,2], set:{c:13}},
    CAL('Shoot days', [1,10,4,3], 7),
    LINK('Call sheets', 'https://www.studiobinder.com', [5,10,4,1], 9),
    LINK('Festivals', 'https://filmfreeway.com', [5,11,4,1], 9)
  ]},

  /* A song is written against a tempo, so the metronome sits beside the words;
     the deck is for being stuck, and the voice memo is where the tune is
     before it is anywhere else. */
  {key:'song', sec:'project', nm:'Song', ic:'music', c:10, of:'song', on:[
    LABEL('The song', [1,1,8,1], 10),
    {k:'poem', t:'Lyrics', b:[1,2,5,5], set:{c:10, onclick:'write'}},
    {k:'metronome', t:'Tempo', b:[6,2,3,4], set:{c:11, bpm:92}},
    {k:'deck', t:'Stuck?', b:[6,6,3,3], set:{c:12}, kids:CARDS([
      'Write the title first', 'Say it plainer', 'Change key for the chorus',
      'Swap the verse and the bridge', 'Half the tempo', 'Take a word out of every line',
      'Steal a rhythm from somebody talking'
    ])},
    {k:'note', t:'Chords and form', b:[1,7,5,2], set:{c:14,
      body:'**Verse —** \n\n**Chorus —** \n\n**Bridge —** '}},
    {k:'audio', t:'Voice memo', b:[1,9,3,3], set:{c:10}},
    {k:'checklist', t:'To finish it', b:[4,9,5,3], set:{c:6}, kids:[
      {k:'task', t:'Demo'},
      {k:'task', t:'Arrangement'},
      {k:'task', t:'Record'},
      {k:'task', t:'Mix and master'},
      {k:'task', t:'Release'}
    ]},
    LINK('Rhymes', 'https://www.rhymezone.com', [1,12,4,1], 9),
    LINK('Chords', 'https://www.hooktheory.com', [5,12,4,1], 9)
  ]},

  /* An essay is a claim, the structure that carries it, the draft and the
     sources, and the passes a draft goes through before it is finished. The
     candle is a writing sprint: light it and write until it is out. */
  {key:'essay', sec:'project', nm:'Essay', ic:'feather', c:7, of:'writing', on:[
    LABEL('The essay', [1,1,8,1], 7),
    {k:'question', t:'What am I arguing?', b:[1,2,6,2], set:{c:10}},
    {k:'candle', t:'Sprint', b:[7,2,2,5], set:{c:3, burn:25}},
    {k:'outline', t:'Outline', b:[1,4,3,4], set:{c:14}},
    {k:'essay', t:'Draft', b:[4,4,3,4], set:{c:7, onclick:'write'}},
    MAKES('A source…', 'quote', [1,8,8,1], 5, '@sources'),
    LIST('Sources', 'sources', [1,9,4,3], 5),
    {k:'checklist', t:'Passes', b:[5,9,4,3], set:{c:6}, kids:[
      {k:'task', t:'Zero draft, just get it down'},
      {k:'task', t:'Structure'},
      {k:'task', t:'Line edit'},
      {k:'task', t:'Read it out loud'},
      {k:'task', t:'Title and first line'},
      {k:'task', t:'Send it'}
    ]},
    LINK('Tighten a sentence', 'https://hemingwayapp.com', [1,12,4,1], 9),
    LINK('Thesaurus', 'https://www.thesaurus.com', [5,12,4,1], 9)
  ]},
  /* ============================================================
     The twenty-three that followed (decision 196)
     ============================================================
     The rest of Timothy's list, built the same way: what next, when, a thing
     that helps, and the way out. Five parts of a life, three things you take
     in, and fifteen pieces of work. */

  /* ---- a part of your life, continued -------------------------------- */

  {key:'partner', sec:'life', nm:'Partner', ic:'star', c:1, of:'life', life:'partner', on:[
    LABEL('Us', [1,1,8,1], 1),
    CAL('Our dates', [1,2,4,4], 7),
    {k:'checklist', t:'Plans together', b:[5,2,4,4], set:{c:1}, kids:[
      AGAIN('Date night', 1, 'week'),
      {k:'task', t:'A trip, just us'},
      {k:'task', t:'Something neither of us has done'}
    ]},
    {k:'deck', t:'Date ideas', b:[1,6,3,4], set:{c:10}, kids:CARDS([
      'Cook something neither of you has made', 'A walk somewhere new',
      'Go back to where you met', 'Board games and takeout',
      'A show, a museum or a gig', 'Breakfast out, phones away'
    ])},
    {k:'note', t:'Things they love', b:[4,6,5,2], set:{c:12,
      body:'**Gifts —** \n\n**Food —** \n\n**Small things —** '}},
    {k:'appt', t:'Anniversary', b:[4,8,5,2], set:{c:8}},
    LINK('Book a table', 'https://www.opentable.com', [1,10,4,1], 9),
    LINK('Something to do', 'https://www.eventbrite.com', [5,10,4,1], 9)
  ]},

  {key:'family', sec:'life', nm:'Family', ic:'star', c:12, of:'life', life:'family', on:[
    LABEL('Family', [1,1,8,1], 12),
    CAL('Birthdays and visits', [1,2,4,4], 7),
    {k:'checklist', t:'Keep in touch', b:[5,2,4,4], set:{c:6}, kids:[
      AGAIN('Call home', 1, 'week'),
      AGAIN('Write to someone', 1, 'month'),
      {k:'task', t:'Plan the next visit'}
    ]},
    {k:'drawer', t:'People', b:[1,6,4,3], set:{c:14}, kids:[
      {k:'note', t:'Parents', body:'**Birthdays —** \n\n**Sizes —** \n\n**Remember —** '},
      {k:'note', t:'Brothers and sisters'},
      {k:'note', t:'Everyone else'}
    ]},
    {k:'checklist', t:'Gifts', b:[5,6,4,3], set:{c:13}},
    {k:'moodboard', t:'Photographs', b:[1,9,4,3], set:{c:13}},
    LINK('Video call', 'https://meet.google.com', [5,9,4,1], 9),
    LINK('Send a card', 'https://www.paperlesspost.com', [5,10,4,1], 9)
  ]},

  {key:'friends', sec:'life', nm:'Friends', ic:'star', c:7, of:'life', life:'friends', on:[
    LABEL('Friends', [1,1,8,1], 7),
    {k:'checklist', t:'Reach out', b:[1,2,4,5], set:{c:6}, kids:[
      AGAIN('Text someone you have not in a while', 1, 'week'),
      AGAIN('Plan something for everyone', 1, 'month')
    ]},
    CAL('Plans', [5,2,4,3], 7),
    {k:'deck', t:'Something to do', b:[5,5,3,4], set:{c:10}, kids:CARDS([
      'Dinner at somebody’s place', 'A walk and a coffee', 'Game night',
      'See a show', 'Go somewhere for the day', 'Just call'
    ])},
    {k:'drawer', t:'People', b:[1,7,4,3], set:{c:14}, kids:[
      {k:'note', t:'Close'},
      {k:'note', t:'From a long time ago'},
      {k:'note', t:'New'}
    ]},
    LINK('Find something on', 'https://www.eventbrite.com', [5,9,4,1], 9),
    LINK('Split the bill', 'https://www.splitwise.com', [5,10,4,1], 9)
  ]},

  {key:'communities', sec:'life', nm:'Communities', ic:'flag', c:5, of:'life', on:[
    LABEL('Communities', [1,1,8,1], 5),
    {k:'drawer', t:'Groups I am in', b:[1,2,4,3], set:{c:14}, kids:[
      {k:'note', t:'A club'},
      {k:'note', t:'Online'},
      {k:'note', t:'The neighbourhood'}
    ]},
    CAL('Meetings and events', [5,2,4,4], 7),
    {k:'checklist', t:'Show up', b:[1,5,4,4], set:{c:6}, kids:[
      AGAIN('Go to the next meeting', 1, 'month'),
      {k:'task', t:'Offer to help with something'}
    ]},
    {k:'question', t:'What could I give?', b:[5,6,4,3], set:{c:10}},
    LINK('Meetups', 'https://www.meetup.com', [1,9,4,1], 9),
    LINK('Volunteer', 'https://www.volunteermatch.org', [1,10,4,1], 9),
    LINK('Local events', 'https://www.eventbrite.com', [5,9,4,1], 9)
  ]},

  {key:'home', sec:'life', nm:'Home', ic:'folder', c:5, of:'life', life:'home', on:[
    LABEL('Home', [1,1,8,1], 5),
    {k:'checklist', t:'Chores', b:[1,2,4,5], set:{c:6}, kids:[
      AGAIN('Laundry', 1, 'week'),
      AGAIN('Clean the kitchen', 1, 'week'),
      AGAIN('Bins out', 1, 'week'),
      AGAIN('Change the sheets', 2, 'week'),
      AGAIN('Deep clean one room', 1, 'month')
    ]},
    {k:'checklist', t:'Fix and maintain', b:[5,2,4,4], set:{c:8}, kids:[
      AGAIN('Replace the air filter', 3, 'month', 'done'),
      AGAIN('Test the smoke alarms', 6, 'month', 'done'),
      {k:'task', t:'The thing that drips'}
    ]},
    CAL('This month', [5,6,4,3], 7),
    {k:'drawer', t:'Manuals and warranties', b:[1,7,4,2], set:{c:14}},
    {k:'checklist', t:'Shopping', b:[1,9,4,3], set:{c:11}, kids:[
      {k:'task', t:'Light bulbs'},
      {k:'task', t:'Batteries'}
    ]},
    LINK('Find a pro', 'https://www.thumbtack.com', [5,9,4,1], 9),
    LINK('Hardware', 'https://www.homedepot.com', [5,10,4,1], 9)
  ]},

  /* ---- something you take in, continued ------------------------------- */

  {key:'music', sec:'experience', inbox:'note', nm:'Music', ic:'music', c:10, of:'life', on:[
    LABEL('Music', [1,1,8,1], 10),
    {k:'checklist', t:'To listen to', b:[1,2,5,4], set:{c:10}},
    {k:'deck', t:'Put something on', b:[6,2,3,4], set:{c:12}, kids:CARDS([
      'An album start to finish', 'Something from the year you were born',
      'A genre you never play', 'What you loved at sixteen',
      'A live recording', 'Something a friend sent you'
    ])},
    MAKES('Just heard…', 'review', [1,6,8,1], 13, '@heard'),
    LIST('Heard', 'heard', [1,7,4,4], 5),
    CAL('Gigs', [5,7,4,3], 7),
    LINK('Spotify', 'https://open.spotify.com', [5,10,4,1], 9),
    LINK('Gigs near me', 'https://www.songkick.com', [1,11,4,1], 9),
    LINK('Bandcamp', 'https://bandcamp.com', [5,11,4,1], 9)
  ]},

  {key:'visual', sec:'experience', inbox:'note', nm:'Visual Art', ic:'image', c:12, of:'life', on:[
    LABEL('Art', [1,1,8,1], 12),
    {k:'moodboard', t:'What stays with me', b:[1,2,5,4], set:{c:13}},
    {k:'deck', t:'Look closer', b:[6,2,3,4], set:{c:10}, kids:CARDS([
      'Draw what you see for five minutes', 'What is the light doing?',
      'Stand where the artist stood', 'What would you take home?',
      'Read nothing, then read the label', 'Find the oldest thing in the room'
    ])},
    {k:'checklist', t:'Shows to see', b:[1,6,4,4], set:{c:12}},
    CAL('Openings', [5,6,4,4], 7),
    MAKES('Just saw…', 'review', [1,10,8,1], 13),
    LINK('Arts and Culture', 'https://artsandculture.google.com', [1,11,4,1], 9),
    LINK('The Met', 'https://www.metmuseum.org/art/collection', [5,11,4,1], 9)
  ]},

  {key:'games', sec:'experience', inbox:'note', nm:'Games', ic:'grid', c:14, of:'life', on:[
    LABEL('Games', [1,1,8,1], 14),
    {k:'progressbar', t:'How far into it', b:[1,2,8,1], set:{c:14}},
    {k:'checklist', t:'Backlog', b:[1,3,5,4], set:{c:14}},
    {k:'deck', t:'What to play', b:[6,3,3,4], set:{c:10}, kids:CARDS([
      'The one you stopped halfway', 'Something short', 'Co-op with a friend',
      'A board game night', 'A classic', 'The newest thing you own'
    ])},
    MAKES('Just finished…', 'review', [1,7,5,1], 13, '@gfinished'),
    {k:'die', t:'Roll', b:[6,7,2,2], set:{c:14, sides:20}},
    LIST('Finished', 'gfinished', [1,8,5,3], 5),
    LINK('Backloggd', 'https://backloggd.com', [1,11,4,1], 9),
    LINK('BoardGameGeek', 'https://boardgamegeek.com', [5,11,4,1], 9)
  ]},

  /* ---- a piece of work, continued ------------------------------------ */

  {key:'featurefilm', sec:'project', nm:'Feature Film', ic:'clapper', c:9, of:'film', on:[
    LABEL('The film', [1,1,8,1], 9),
    {k:'progressbar', t:'Where it stands', b:[1,2,8,1], set:{c:13, tracks:'@ffstages'}},
    {k:'checklist', t:'Stages', ref:'ffstages', b:[1,3,4,5], set:{c:9}, kids:[
      {k:'task', t:'Treatment'}, {k:'task', t:'First draft'}, {k:'task', t:'Rewrite'},
      {k:'task', t:'Financing'}, {k:'task', t:'Casting'}, {k:'task', t:'Crew'},
      {k:'task', t:'Locations'}, {k:'task', t:'Schedule'}, {k:'task', t:'Shoot'},
      {k:'task', t:'Edit'}, {k:'task', t:'Sound and music'}, {k:'task', t:'Colour'},
      {k:'task', t:'Festivals and distribution'}
    ]},
    {k:'question', t:'What is it about?', b:[5,3,4,3], set:{c:10}},
    {k:'script', t:'Screenplay', b:[5,6,4,2], set:{c:9, onclick:'write'}},
    {k:'outline', t:'Treatment', b:[1,8,4,2], set:{c:14}},
    {k:'drawer', t:'Characters', b:[5,8,4,2], set:{c:13}, kids:[
      {k:'character', t:'The lead'}, {k:'character', t:'Who is in the way'}
    ]},
    CAL('Production', [1,10,4,3], 7),
    LINK('Schedule and budget', 'https://www.studiobinder.com', [5,10,4,1], 9),
    LINK('Write the screenplay', 'https://www.writerduet.com', [5,11,4,1], 9),
    LINK('Festivals', 'https://filmfreeway.com', [5,12,4,1], 9)
  ]},

  {key:'play', sec:'project', nm:'Play', ic:'feather', c:8, of:'project', on:[
    LABEL('The play', [1,1,8,1], 8),
    {k:'question', t:'What is it about?', b:[1,2,5,2], set:{c:10}},
    {k:'drawer', t:'Characters', b:[6,2,3,3], set:{c:13}, kids:[
      {k:'character', t:'Who it is about'}, {k:'character', t:'Who is in the way'}
    ]},
    {k:'script', t:'The script', b:[1,4,5,4], set:{c:9, onclick:'write'}},
    {k:'outline', t:'Acts and scenes', b:[6,5,3,3], set:{c:14}},
    {k:'checklist', t:'To the stage', b:[1,8,4,4], set:{c:6}, kids:[
      {k:'task', t:'First draft'}, {k:'task', t:'Table read'}, {k:'task', t:'Rewrite'},
      {k:'task', t:'Find a theatre'}, {k:'task', t:'Cast'}, {k:'task', t:'Rehearse'},
      {k:'task', t:'Opening night'}
    ]},
    CAL('Rehearsals', [5,8,4,3], 7),
    LINK('Share it with theatres', 'https://newplayexchange.org', [5,11,4,1], 9)
  ]},

  {key:'musical', sec:'project', nm:'Musical', ic:'music', c:12, of:'project', on:[
    LABEL('The musical', [1,1,8,1], 12),
    {k:'question', t:'What is it about?', b:[1,2,5,2], set:{c:10}},
    {k:'metronome', t:'Tempo', b:[6,2,3,4], set:{c:11, bpm:112}},
    {k:'script', t:'The book', b:[1,4,5,3], set:{c:9, onclick:'write'}},
    {k:'drawer', t:'Songs', b:[1,7,5,2], set:{c:10}, kids:[
      {k:'poem', t:'Opening number'}, {k:'poem', t:'The I want song'},
      {k:'poem', t:'Eleven o’clock number'}
    ]},
    {k:'outline', t:'Song list', b:[6,6,3,3], set:{c:14}},
    {k:'checklist', t:'To the stage', b:[1,9,4,3], set:{c:6}, kids:[
      {k:'task', t:'Book draft'}, {k:'task', t:'Score demos'}, {k:'task', t:'Workshop reading'},
      {k:'task', t:'Orchestration'}, {k:'task', t:'Cast'}, {k:'task', t:'Rehearse'},
      {k:'task', t:'Opening night'}
    ]},
    CAL('Workshops and rehearsals', [5,9,4,3], 7),
    LINK('Rhymes', 'https://www.rhymezone.com', [1,12,4,1], 9),
    LINK('Notation', 'https://musescore.com', [5,12,4,1], 9)
  ]},

  {key:'tvshow', sec:'project', nm:'TV Show', ic:'film', c:9, of:'project', on:[
    LABEL('The show', [1,1,8,1], 9),
    {k:'question', t:'What keeps it going?', b:[1,2,5,2], set:{c:10,
      body:'**The premise —** \n\n**Why it runs for seasons —** '}},
    {k:'note', t:'Show bible', b:[6,2,3,4], set:{c:14}},
    {k:'drawer', t:'Characters', b:[1,4,5,2], set:{c:13}, kids:[
      {k:'character', t:'The lead'}, {k:'character', t:'The ensemble'}
    ]},
    {k:'checklist', t:'Episodes', b:[1,6,4,5], set:{c:9}, kids:[
      {k:'task', t:'Pilot'}, {k:'task', t:'Episode two'}, {k:'task', t:'Episode three'},
      {k:'task', t:'Episode four'}, {k:'task', t:'Episode five'}, {k:'task', t:'Finale'}
    ]},
    {k:'script', t:'Pilot', b:[5,6,4,3], set:{c:9, onclick:'write'}},
    {k:'outline', t:'Season arc', b:[5,9,4,2], set:{c:14}},
    LINK('Write the scripts', 'https://www.writerduet.com', [1,11,4,1], 9),
    LINK('The Black List', 'https://blcklst.com', [5,11,4,1], 9)
  ]},

  {key:'shortstory', sec:'project', nm:'Short Story', ic:'feather', c:14, of:'project', on:[
    LABEL('The story', [1,1,8,1], 14),
    {k:'question', t:'What changes?', b:[1,2,6,2], set:{c:10}},
    {k:'candle', t:'Sprint', b:[7,2,2,5], set:{c:3, burn:25}},
    {k:'drawer', t:'People and places', b:[1,4,3,3], set:{c:13}, kids:[
      {k:'character', t:'Who it is about'}, {k:'place', t:'Where it happens'}
    ]},
    {k:'essay', t:'Draft', b:[4,4,3,4], set:{c:7, onclick:'write'}},
    {k:'outline', t:'Scenes', b:[1,7,3,2], set:{c:14}},
    {k:'checklist', t:'Passes', b:[1,9,4,3], set:{c:6}, kids:[
      {k:'task', t:'Draft'}, {k:'task', t:'Cut a third'}, {k:'task', t:'Read it aloud'},
      {k:'task', t:'Title'}, {k:'task', t:'Send it out'}
    ]},
    LINK('Submit it', 'https://www.submittable.com', [5,9,4,1], 9),
    LINK('Where to send it', 'https://duotrope.com', [5,10,4,1], 9),
    LINK('Thesaurus', 'https://www.thesaurus.com', [5,11,4,1], 9)
  ]},

  {key:'application', sec:'project', nm:'Application', ic:'grid', c:14, of:'app', on:[
    LABEL('The app', [1,1,8,1], 14),
    {k:'progressbar', t:'Where it stands', b:[1,2,8,1], set:{c:13, tracks:'@build'}},
    {k:'question', t:'Who is it for, and what does it do?', b:[1,3,5,2], set:{c:10}},
    {k:'moodboard', t:'Screens', b:[6,3,3,3], set:{c:13}},
    {k:'checklist', t:'Build', ref:'build', b:[1,5,5,5], set:{c:14}, kids:[
      {k:'task', t:'Sketch the screens'}, {k:'task', t:'Prototype'},
      {k:'task', t:'The one feature that matters'}, {k:'task', t:'Test it with someone'},
      {k:'task', t:'Fix what they found'}, {k:'task', t:'Ship it'}
    ]},
    {k:'problem', t:'What is broken', b:[6,6,3,4], set:{c:8}},
    LINK('Repository', 'https://github.com', [1,10,4,1], 9),
    LINK('Design', 'https://www.figma.com', [5,10,4,1], 9),
    LINK('Ask Claude', 'https://claude.ai', [1,11,4,1], 9)
  ]},

  {key:'blogpost', sec:'project', nm:'Blog Post', ic:'send', c:5, of:'writing', on:[
    LABEL('The post', [1,1,8,1], 5),
    {k:'question', t:'What is the one point?', b:[1,2,6,2], set:{c:10}},
    {k:'candle', t:'Sprint', b:[7,2,2,5], set:{c:3, burn:25}},
    {k:'essay', t:'Draft', b:[1,4,6,4], set:{c:7, onclick:'write'}},
    MAKES('A link to cite…', 'quote', [1,8,8,1], 5, '@bsources'),
    {k:'checklist', t:'Before it goes up', b:[1,9,4,3], set:{c:6}, kids:[
      {k:'task', t:'Headline'}, {k:'task', t:'First line'}, {k:'task', t:'Pictures'},
      {k:'task', t:'Every link works'}, {k:'task', t:'Read it once more'},
      {k:'task', t:'Publish'}, {k:'task', t:'Tell people'}
    ]},
    LIST('Sources', 'bsources', [5,9,4,3], 5),
    LINK('Publish', 'https://substack.com', [1,12,4,1], 9),
    LINK('Tighten a sentence', 'https://hemingwayapp.com', [5,12,4,1], 9)
  ]},

  {key:'website', sec:'project', nm:'Website', ic:'grid', c:13, of:'app', on:[
    LABEL('The site', [1,1,8,1], 13),
    {k:'question', t:'What is it for?', b:[1,2,5,2], set:{c:10}},
    {k:'outline', t:'Pages', b:[6,2,3,3], set:{c:14}},
    {k:'moodboard', t:'Look and feel', b:[1,4,5,3], set:{c:13}},
    {k:'checklist', t:'Launch', b:[1,7,4,5], set:{c:6}, kids:[
      {k:'task', t:'Domain'}, {k:'task', t:'Sitemap'}, {k:'task', t:'Words for each page'},
      {k:'task', t:'Design'}, {k:'task', t:'Build'}, {k:'task', t:'Test it on a phone'},
      {k:'task', t:'Launch'}
    ]},
    {k:'essay', t:'The words', b:[5,7,4,3], set:{c:7, onclick:'write'}},
    LINK('Domains', 'https://domains.squarespace.com', [5,10,4,1], 9),
    LINK('Free hosting', 'https://pages.github.com', [5,11,4,1], 9)
  ]},

  {key:'novel', sec:'project', nm:'Novel', ic:'book', c:11, of:'project', on:[
    LABEL('The novel', [1,1,8,1], 11),
    {k:'question', t:'What is it about?', b:[1,2,6,2], set:{c:10}},
    {k:'candle', t:'Sprint', b:[7,2,2,5], set:{c:3, burn:45}},
    {k:'world', t:'The world', b:[1,4,3,3], set:{c:9}},
    {k:'outline', t:'Chapters', b:[4,4,3,4], set:{c:14}},
    {k:'drawer', t:'Characters', b:[1,7,3,2], set:{c:13}, kids:[
      {k:'character', t:'Who it is about'}, {k:'character', t:'Who is in the way'}
    ]},
    {k:'counter', t:'Writing days', b:[5,8,4,2], set:{c:8}},
    {k:'checklist', t:'Drafts', b:[1,9,4,3], set:{c:6}, kids:[
      {k:'task', t:'Outline'}, {k:'task', t:'First draft'}, {k:'task', t:'Second draft'},
      {k:'task', t:'Beta readers'}, {k:'task', t:'Revise'}, {k:'task', t:'Query agents'}
    ]},
    LINK('Query agents', 'https://querytracker.net', [5,10,4,1], 9),
    LINK('Thesaurus', 'https://www.thesaurus.com', [5,11,4,1], 9)
  ]},

  {key:'poem', sec:'project', nm:'Poem', ic:'feather', c:10, of:'project', on:[
    LABEL('The poem', [1,1,8,1], 10),
    {k:'poem', t:'Draft', b:[1,2,5,6], set:{c:10, onclick:'write'}},
    {k:'deck', t:'A way in', b:[6,2,3,4], set:{c:12}, kids:CARDS([
      'Start with an object on your desk', 'Write it to someone who cannot answer',
      'One sentence, however long', 'Begin with a smell',
      'Say the opposite of what you mean', 'Only words of one syllable'
    ])},
    {k:'hourglass', t:'Ten minutes', b:[6,6,3,4], set:{c:12, mins:10}},
    {k:'checklist', t:'Before it is done', b:[1,8,5,3], set:{c:6}, kids:[
      {k:'task', t:'Read it aloud'}, {k:'task', t:'Cut the first line'},
      {k:'task', t:'Check every line break'}, {k:'task', t:'Title'}, {k:'task', t:'Send it'}
    ]},
    LINK('Rhymes', 'https://www.rhymezone.com', [1,11,4,1], 9),
    LINK('Poetry Foundation', 'https://www.poetryfoundation.org', [5,11,4,1], 9)
  ]},

  {key:'album', sec:'project', nm:'Album', ic:'music', c:10, of:'project', on:[
    LABEL('The album', [1,1,8,1], 10),
    {k:'progressbar', t:'Where it stands', b:[1,2,8,1], set:{c:13, tracks:'@tracks'}},
    {k:'checklist', t:'Tracks', ref:'tracks', b:[1,3,4,6], set:{c:10}, kids:[
      {k:'task', t:'The opener'}, {k:'task', t:'The single'},
      {k:'task', t:'The slow one'}, {k:'task', t:'The closer'}
    ]},
    {k:'metronome', t:'Tempo', b:[5,3,3,4], set:{c:11, bpm:100}},
    {k:'moodboard', t:'Artwork', b:[5,7,4,3], set:{c:13}},
    {k:'checklist', t:'Release', b:[1,9,4,3], set:{c:6}, kids:[
      {k:'task', t:'Mix'}, {k:'task', t:'Master'}, {k:'task', t:'Artwork'},
      {k:'task', t:'Distributor'}, {k:'task', t:'Release date'}, {k:'task', t:'Tell people'}
    ]},
    CAL('Sessions and release', [5,10,4,3], 7),
    LINK('Distribution', 'https://distrokid.com', [1,12,4,1], 9)
  ]},

  {key:'game', sec:'project', nm:'Game', ic:'grid', c:9, of:'game', on:[
    LABEL('The game', [1,1,8,1], 9),
    {k:'question', t:'What is the fun?', b:[1,2,5,2], set:{c:10,
      body:'**The core loop —** \n\n**What the player feels —** '}},
    {k:'die', t:'Test roll', b:[6,2,2,2], set:{c:14, sides:6}},
    {k:'deck', t:'Mechanics to try', b:[1,4,3,4], set:{c:12}, kids:CARDS([
      'Push your luck', 'Hidden information', 'Set collection',
      'Worker placement', 'Deck building', 'A timer'
    ])},
    {k:'outline', t:'Rules', b:[4,4,5,4], set:{c:14}},
    {k:'checklist', t:'Playtest', b:[1,8,4,4], set:{c:6}, kids:[
      {k:'task', t:'Paper prototype'}, {k:'task', t:'First playtest'},
      {k:'task', t:'Fix the rules'}, {k:'task', t:'Art'},
      {k:'task', t:'Second playtest'}, {k:'task', t:'Release'}
    ]},
    {k:'drawer', t:'Art and assets', b:[5,8,4,2], set:{c:13}},
    LINK('Put it out', 'https://itch.io', [5,10,4,1], 9),
    LINK('Engine', 'https://godotengine.org', [5,11,4,1], 9)
  ]},

  {key:'device', sec:'project', nm:'Device', ic:'sliders', c:15, of:'project', on:[
    LABEL('The device', [1,1,8,1], 15),
    {k:'question', t:'What does it do?', b:[1,2,5,2], set:{c:10}},
    {k:'checklist', t:'Parts', b:[6,2,3,5], set:{c:11}, kids:[
      {k:'task', t:'Microcontroller'}, {k:'task', t:'Power'}, {k:'task', t:'Enclosure'}
    ]},
    {k:'moodboard', t:'Sketches', b:[1,4,5,3], set:{c:13}},
    {k:'checklist', t:'Build', b:[1,7,4,5], set:{c:6}, kids:[
      {k:'task', t:'Breadboard it'}, {k:'task', t:'Firmware that blinks'},
      {k:'task', t:'Schematic'}, {k:'task', t:'Board'},
      {k:'task', t:'Enclosure'}, {k:'task', t:'Live with it for a week'}
    ]},
    {k:'problem', t:'What is not working', b:[5,7,4,3], set:{c:8}},
    LINK('Parts', 'https://www.digikey.com', [5,10,4,1], 9),
    LINK('Circuit boards', 'https://jlcpcb.com', [5,11,4,1], 9)
  ]},

  {key:'world', sec:'project', nm:'Fantasy World', ic:'star', c:9, of:'world', on:[
    LABEL('The world', [1,1,8,1], 9),
    {k:'question', t:'What is different here?', b:[1,2,5,2], set:{c:10}},
    {k:'die', t:'Fate', b:[6,2,2,2], set:{c:14, sides:20}},
    {k:'drawer', t:'People', b:[1,4,4,3], set:{c:13}, kids:[
      {k:'character', t:'Someone who matters'}, {k:'group', t:'A people or an order'}
    ]},
    {k:'drawer', t:'Places', b:[5,4,4,3], set:{c:7}, kids:[
      {k:'place', t:'Where it starts'}, {k:'place', t:'Where nobody goes'}
    ]},
    {k:'timeline', t:'History', b:[1,7,8,2], set:{c:5}},
    {k:'drawer', t:'Laws and magic', b:[1,9,4,3], set:{c:8}, kids:[
      {k:'law', t:'How magic works'}, {k:'law', t:'What it costs'}
    ]},
    {k:'deck', t:'What if', b:[5,9,3,4], set:{c:12}, kids:CARDS([
      'A war nobody remembers starting', 'A god that has gone quiet',
      'A trade route that just closed', 'A child with the wrong gift',
      'A map that is wrong on purpose', 'A festival everybody dreads'
    ])},
    LINK('Draw the map', 'https://inkarnate.com', [1,12,4,1], 9)
  ]},

  {key:'handmade', sec:'project', nm:'Handmade Object', ic:'star', c:6, of:'project', on:[
    LABEL('The object', [1,1,8,1], 6),
    {k:'question', t:'What is it, and who is it for?', b:[1,2,5,2], set:{c:10}},
    {k:'moodboard', t:'Sketches and references', b:[6,2,3,4], set:{c:13}},
    {k:'checklist', t:'Materials', b:[1,4,5,4], set:{c:11}, kids:[
      {k:'task', t:'The material'}, {k:'task', t:'Fixings'}, {k:'task', t:'Finish'}
    ]},
    {k:'hourglass', t:'Glue sets', b:[6,6,3,4], set:{c:12, mins:30}},
    {k:'checklist', t:'Steps', b:[1,8,4,4], set:{c:6}, kids:[
      {k:'task', t:'Sketch it'}, {k:'task', t:'Measure twice'}, {k:'task', t:'Rough it out'},
      {k:'task', t:'Refine'}, {k:'task', t:'Finish'}, {k:'task', t:'Photograph it'}
    ]},
    LINK('Materials', 'https://www.mcmaster.com', [5,10,4,1], 9),
    LINK('How others did it', 'https://www.instructables.com', [5,11,4,1], 9)
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

export { stockPlans, STOCK_KEYS, RETIRED_KEYS };
