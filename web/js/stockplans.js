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
    if(s.b){
      const box = {x:s.b[0], y:s.b[1], w:s.b[2], h:s.b[3]};
      o.desk = box; o.phone = Object.assign({}, box);
    }
    objects.push(o);
    (s.kids||[]).forEach(k=>add(k, id));
  };
  (spec.on||[]).forEach(s=>add(s, PLAN_ROOT));
  objects.forEach(o=>{
    if(typeof o.tracks==='string' && o.tracks[0]==='@') o.tracks = refs[o.tracks.slice(1)] || null;
  });
  return {
    id: `pl_stock_${spec.key}`,
    stock: spec.key,
    nm: spec.nm, ic: spec.ic, c: spec.c,
    of: spec.of || 'drawer',
    made: D.iso(D.today()),
    cols: 8,
    objects
  };
}

/* Shorthands for the things that recur, so a rule reads as the sentence the
   builder would have written. */
const LABEL = (t, b, c)=>({k:'label', t, b, set:{c}});
const SORTS = (t, filter, b, set)=>({k:'magic', t, b, set:Object.assign({filter}, set||{})});
const MAKES = (t, kind, b, c)=>({k:'generator', t, b, set:{genKind:kind, c}});
/* **This board**, as a rule. `@under` the plan's own root is re-pointed at the
   board it is put down on (`repointRules()` in plans.js), so a calendar or a
   sorting drawer in one of these collects what is inside *this* project and
   not everything on the desk. That is the whole difference between a board
   that is a base station and one that is a window onto the rest. */
const HERE = {f:'@under', op:'is', v:PLAN_ROOT};
const CAL = (t, b, c, view)=>({k:'calendar', t, b,
  set:{c, calview:view||'month', filter:{rules:[{f:'date', op:'any'}, HERE]}}});
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
   furniture can honestly build today. Authored eight by twelve, and meant for
   a Project or a Life drawer, whose board is twenty by twenty: the rest of
   that board is the room new things land in. See decision 194. */
const SPECS = [

  /* ---- a part of your life ------------------------------------------ */

  /* Health is mostly remembering: when the next appointment is, what you meant
     to ask, and the checkups that come round once a year and are forgotten for
     three. The checkups repeat from the day they were *done*, because the next
     cleaning is six months after the last one and not six months after the
     day it was meant to be. */
  {key:'health', nm:'Health', ic:'drop', c:8, of:'life', on:[
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
  {key:'money', nm:'Finances', ic:'bar', c:13, of:'life', on:[
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
  {key:'exercise', nm:'Exercise', ic:'star', c:6, of:'life', on:[
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
    CAL('The month', [1,8,4,4], 7),
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
  {key:'nutrition', nm:'Nutrition', ic:'pot', c:11, of:'life', on:[
    LABEL('Eating', [1,1,8,1], 11),
    CAL('This week', [1,2,8,3], 7, 'week'),
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
     and what you want to see — and it is meant to be laid out inside a Trip,
     which already carries the dates and the place. */
  {key:'travel', nm:'Travel', ic:'flag', c:9, of:'trip', on:[
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
  {key:'films', nm:'Films', ic:'film', c:9, of:'drawer', on:[
    LABEL('Films', [1,1,8,1], 9),
    {k:'checklist', t:'Watchlist', b:[1,2,5,5], set:{c:9}},
    {k:'deck', t:'Pick for me', b:[6,2,3,4], set:{c:10}, kids:CARDS([
      'The one you have meant to see for a year', 'Something from before 1970',
      'Not in English', 'A documentary', 'A director you love, one you have not seen',
      'The one a friend keeps recommending'
    ])},
    MAKES('Just watched…', 'review', [1,7,8,1], 13),
    SORTS('Seen', {kinds:['review'], rules:[HERE]}, [1,8,4,4], {c:5, layout:'list'}),
    LINK('Letterboxd', 'https://letterboxd.com', [5,8,4,1], 9),
    LINK('Where to stream it', 'https://www.justwatch.com', [5,9,4,1], 9),
    LINK('Showtimes', 'https://www.fandango.com', [5,10,4,1], 9)
  ]},

  /* Books: how far into this one, what is next, and two things you take out
     of a book — the lines worth keeping and what you made of it — each with a
     drawer that collects it off this board. */
  {key:'books', nm:'Books', ic:'book', c:11, of:'drawer', on:[
    LABEL('Reading', [1,1,8,1], 11),
    {k:'progressbar', t:'How far into it', b:[1,2,8,1], set:{c:11}},
    {k:'checklist', t:'To read', b:[1,3,5,4], set:{c:11}},
    {k:'deck', t:'What next?', b:[6,3,3,4], set:{c:10}, kids:CARDS([
      'Something somebody gave you', 'A classic you pretend to have read',
      'Under two hundred pages', 'Something you know nothing about',
      'A reread', 'Poems'
    ])},
    MAKES('A line worth keeping…', 'quote', [1,7,4,1], 5),
    MAKES('Just finished…', 'review', [5,7,4,1], 13),
    SORTS('Quotes', {kinds:['quote'], rules:[HERE]}, [1,8,4,3], {c:5}),
    SORTS('Finished', {kinds:['review'], rules:[HERE]}, [5,8,4,3], {c:13, layout:'list'}),
    LINK('Library', 'https://www.libbyapp.com', [1,11,4,1], 9),
    LINK('The StoryGraph', 'https://app.thestorygraph.com', [5,11,4,1], 9)
  ]},

  /* ---- a piece of work ---------------------------------------------- */

  /* A short film is a run of stages from a logline to a festival, and the bar
     reads the list of them, so the number on it is the work and nothing you
     maintain. The question comes first because it is the one a short film
     most often never answers. */
  {key:'shortfilm', nm:'Short Film', ic:'clapper', c:9, of:'film', on:[
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
    {k:'question', t:'What is it about?', b:[5,3,4,2], set:{c:10,
      body:'**The logline —** \n\n**Why now —** '}},
    {k:'script', t:'Script', b:[5,5,4,3], set:{c:9, onclick:'write'}},
    {k:'outline', t:'Beats', b:[1,8,4,2], set:{c:14}},
    {k:'moodboard', t:'Look book', b:[5,8,4,2], set:{c:13}},
    CAL('Shoot days', [1,10,4,3], 7),
    LINK('Call sheets', 'https://www.studiobinder.com', [5,10,4,1], 9),
    LINK('Festivals', 'https://filmfreeway.com', [5,11,4,1], 9)
  ]},

  /* A song is written against a tempo, so the metronome sits beside the words;
     the deck is for being stuck, and the voice memo is where the tune is
     before it is anywhere else. */
  {key:'song', nm:'Song', ic:'music', c:10, of:'song', on:[
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
  {key:'essay', nm:'Essay', ic:'feather', c:7, of:'project', on:[
    LABEL('The essay', [1,1,8,1], 7),
    {k:'question', t:'What am I arguing?', b:[1,2,6,2], set:{c:10}},
    {k:'candle', t:'Sprint', b:[7,2,2,5], set:{c:3, burn:25}},
    {k:'outline', t:'Outline', b:[1,4,3,4], set:{c:14}},
    {k:'essay', t:'Draft', b:[4,4,3,4], set:{c:7, onclick:'write'}},
    MAKES('A source…', 'quote', [1,8,8,1], 5),
    SORTS('Sources', {kinds:['quote'], rules:[HERE]}, [1,9,4,3], {c:5}),
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
  ]}
];

const stockPlans = ()=> SPECS.map(build);
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
