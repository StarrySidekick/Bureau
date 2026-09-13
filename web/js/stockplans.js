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

/* Shorthands for the three things that recur, so a rule reads as the sentence
   the builder would have written. */
const LABEL = (t, b, c)=>({k:'label', t, b, set:{c}});
const SORTS = (t, filter, b, set)=>({k:'magic', t, b, set:Object.assign({filter}, set||{})});
const MAKES = (t, kind, b)=>({k:'generator', t, b, set:{genKind:kind}});

/* ============================================================
   The ten
   ============================================================ */
const SPECS = [

  /* 1 · Self-expression, and the daily half of documentation. The sheet is the
     point, so it takes the top half outright and everything else is small and
     under it: a line to catch whatever surfaces while you are writing, three
     things to do, the month, and one question pointed at yesterday. */
  {key:'morning', nm:'Morning Page', ic:'feather', c:12, of:'note', on:[
    LABEL('Morning', [1,1,8,1], 12),
    {k:'essay', t:'Freewriting', b:[1,2,8,5], set:{c:12, onclick:'write'}},
    MAKES('Anything else…', 'thought', [1,7,8,1]),
    {k:'checklist', t:'Three things today', b:[1,8,8,3], set:{c:6}, kids:[
      {k:'task', t:'The one that matters'},
      {k:'task', t:'The one you are avoiding'},
      {k:'task', t:'The small one'}
    ]},
    {k:'calendar', t:'Today', b:[1,11,4,2], set:{c:7}},
    {k:'question', t:'How did yesterday go?', b:[5,11,4,2], set:{c:10}}
  ]},

  /* 2 · Brainstorming. The board is the feature, so everything it ships with
     goes up in one corner and the rest of the shelf is left bare — which is
     the one thing a brainstorm arrangement has to get right. Worth turning
     Gravity on for: a board you can shake is a different relationship to
     twenty ideas than a list of them. */
  {key:'brainstorm', nm:'Brainstorm Table', ic:'bulb', c:12, of:'drawer', on:[
    LABEL('What are we answering?', [1,1,8,1], 12),
    {k:'drawer', t:'Starters', b:[1,3,3,4], set:{c:13}, kids:[
      {k:'question', t:'What if the opposite were true?'},
      {k:'question', t:'What would this be at ten times the size?'},
      {k:'problem',  t:'What is actually in the way?'},
      {k:'thought',  t:'Who else has this problem?'},
      {k:'thought',  t:'What would make it unnecessary?'}
    ]},
    MAKES('Anything goes…', 'thought', [5,3,4,2]),
    {k:'drawer', t:'Keep', b:[1,8,3,3], set:{c:6}}
  ]},

  /* 3 · Development — the generic piece of work, and the arrangement
     `docs/FUNCTIONS.md` §4 describes. The bar reads the checklist rather than
     its own milestones, which is the one thing that makes the number on it
     true without anybody maintaining it. */
  {key:'workbench', nm:'The Workbench', ic:'flag', c:7, of:'project', on:[
    LABEL('The work', [1,1,8,1], 7),
    {k:'progressbar', t:'How far along', b:[1,2,8,2], set:{c:13, tracks:'@next'}},
    {k:'outline', t:'Outline', b:[1,4,4,3], set:{c:14}},
    {k:'checklist', t:'Next', ref:'next', b:[5,4,4,3], set:{c:6}, kids:[
      {k:'task', t:'Work out what done looks like'},
      {k:'task', t:'The first real piece of it'}
    ]},
    {k:'drawer', t:'Drafts', b:[1,7,4,3], set:{c:5}},
    {k:'moodboard', t:'References', b:[5,7,4,3], set:{c:13}},
    {k:'timeline', t:'How it went', b:[1,10,8,2], set:{c:5}},
    MAKES('Add to this…', 'task', [1,12,8,1])
  ]},

  /* 4 · The same function made concrete, because a film is a thing Timothy
     actually makes and a generic project board is not a shoot. The Event
     carries the day and how long it runs; everything else is what you are
     holding while it happens. */
  {key:'shootday', nm:'Shoot Day', ic:'clapper', c:9, of:'drawer', on:[
    LABEL('Shoot day', [1,1,8,1], 9),
    {k:'appt', t:'Call time', b:[1,2,8,3], set:{c:8}},
    {k:'checklist', t:'Shot list', b:[1,5,8,3], set:{c:9}, kids:[
      {k:'task', t:'Establisher'},
      {k:'task', t:'Coverage — wide'},
      {k:'task', t:'Coverage — close'},
      {k:'task', t:'Cutaways'}
    ]},
    {k:'checklist', t:'Kit', b:[1,8,4,3], set:{c:5}, kids:[
      {k:'task', t:'Batteries charged'},
      {k:'task', t:'Cards formatted'},
      {k:'task', t:'Sound kit'},
      {k:'task', t:'Tripod and sticks'}
    ]},
    {k:'drawer', t:'Paperwork', b:[5,8,4,3], set:{c:14}, kids:[
      {k:'note', t:'Call sheet'},
      {k:'note', t:'Release forms'}
    ]},
    {k:'timeline', t:'Running order', b:[1,11,8,2], set:{c:11}}
  ]},

  /* 5 · Documentation. The Log the document proposes is a container whose add
     box writes to its own margin, and that does not exist yet — so this is the
     nearest real thing: a spawner that presses out Events, a drawer they land
     in, and two ways of looking at what has accumulated. */
  {key:'daylog', nm:'Day Log', ic:'clock', c:5, of:'drawer', on:[
    LABEL('The log', [1,1,8,1], 5),
    MAKES('What happened…', 'appt', [1,2,8,2]),
    {k:'drawer', t:'Entries', b:[1,4,8,4], set:{c:5, layout:'list'}},
    {k:'calendar', t:'The month', b:[1,8,4,3], set:{c:7}},
    SORTS('Everything that happened', {kinds:['appt'], scope:'all'}, [5,8,4,3], {c:11}),
    {k:'timeline', t:'Along the axis', b:[1,11,8,2], set:{c:9}}
  ]},

  /* 6 · Reflection. Three questions answered by writing rather than ticked,
     the archive beside them so the week can be read off what actually
     finished, and the month. Stamp it into a drawer each week and the drawer
     becomes the run of them. */
  {key:'review', nm:'Week in Review', ic:'target', c:10, of:'drawer', on:[
    LABEL('Week in review', [1,1,8,1], 10),
    {k:'question', t:'What went well?', b:[1,2,8,2], set:{c:6}},
    {k:'question', t:'What got in the way?', b:[1,4,8,2], set:{c:8}},
    {k:'question', t:'What is next?', b:[1,6,8,2], set:{c:12}},
    SORTS('Finished', {done:true, scope:'all'}, [1,8,4,3], {c:5, layout:'list'}),
    {k:'drawer', t:'Pages', b:[5,8,4,3], set:{c:14}},
    {k:'calendar', t:'Coming up', b:[1,11,8,2], set:{c:7}}
  ]},

  /* 7 · Notetaking and cataloguing at once, because a source you are reading
     is both. The two sorting drawers are the catalogue: quotes collect by
     type, and a question is open until there is something in its answer box —
     which is the seeded desk's own rule, and the reason `answer` exists. */
  {key:'reading', nm:'Reading Desk', ic:'book', c:11, of:'drawer', on:[
    LABEL('Reading', [1,1,8,1], 11),
    {k:'drawer', t:'The source', b:[1,2,8,3], set:{c:11}, kids:[
      {k:'note', t:'Where it came from'}
    ]},
    MAKES('A quote…', 'quote', [1,5,8,2]),
    SORTS('Quotes', {kinds:['quote'], scope:'all'}, [1,7,4,3], {c:5}),
    SORTS('Open questions', {kinds:['question'], rules:[{f:'answer', op:'is', v:''}]},
          [5,7,4,3], {c:10}),
    {k:'moodboard', t:'Pictures', b:[1,10,8,3], set:{c:13}}
  ]},

  /* 8 · Value judgments, and the whole plan is four lines. A tier list is a
     Bureau board used correctly: Labels spanning the shelf, things arranged
     between them, and Manual sort so nothing rearranges itself. The rows are
     deliberately empty — what you put between the lines is the judgment, and
     the lines are all the structure there is. The four take four colour slots
     in descending warmth, so the board reads as a scale before you have read a
     word of it. */
  {key:'tiers', nm:'Tier Board', ic:'tag', c:13, of:'drawer', on:[
    LABEL('Best',      [1,1,8,1],  13),
    LABEL('Very good', [1,4,8,1],  12),
    LABEL('Good',      [1,7,8,1],   6),
    LABEL('Fine',      [1,10,8,1],  5)
  ]},

  /* 9 · Goal definition and goal deconstruction, which are one board: the card
     states what you want and the checklist under it is what breaking it down
     produces. Each bar reads its own goal rather than its own milestones, so
     the number is the work and not a second thing to maintain. Two goals and
     not three, because three cards and three bars is a shelf with nothing else
     on it. */
  {key:'goals', nm:'Goal Table', ic:'target', c:13, of:'drawer', on:[
    LABEL('This year', [1,1,8,1], 13),
    {k:'goal', t:'The first one', ref:'g1', b:[1,2,4,3], set:{c:13}},
    {k:'goal', t:'The second one', ref:'g2', b:[5,2,4,3], set:{c:12}},
    {k:'progressbar', t:'', b:[1,5,4,1], set:{c:13, tracks:'@g1'}},
    {k:'progressbar', t:'', b:[5,5,4,1], set:{c:12, tracks:'@g2'}},
    {k:'checklist', t:'What gets me there', b:[1,7,8,3], set:{c:6}},
    SORTS('Owed soon', {rules:[{f:'deadline', op:'lt', v:'month'}]},
          [1,10,8,2], {c:8, layout:'list'})
  ]},

  /* 10 · Skill development, which needed no new machinery and is the argument
     that it belongs on the list at all: a ladder, a run, and the record. The
     task carries `repeat` and `streak` as per-object traits — a habit is a task
     that repeats (decision 160) — counting from the day you finish rather than
     the day it was due, because you practise a day after you last practised.
     The bar reads that streak against thirty days. */
  {key:'practice', nm:'Practice Bench', ic:'star', c:14, of:'life', on:[
    LABEL('Practice', [1,1,8,1], 14),
    {k:'progressbar', t:'The ladder', b:[1,2,8,2],
     set:{c:14, tracks:'@practise', target:30}},
    {k:'task', t:'Practise', ref:'practise', b:[1,4,8,1],
     set:{c:6, attrs:['text','check','date','repeat','streak'],
          repeat:{every:1, unit:'day', from:'done'}}},
    {k:'counter', t:'Sessions', b:[1,5,4,3], set:{c:8}},
    {k:'calendar', t:'The month', b:[5,5,4,3], set:{c:7}},
    {k:'drawer', t:'Exercises', b:[1,8,4,3], set:{c:11}},
    {k:'drawer', t:'Notes', b:[5,8,4,3], set:{c:14}},
    SORTS('Done', {done:true, scope:'all'}, [1,11,8,2], {c:5, layout:'list'})
  ]}
];

const stockPlans = ()=> SPECS.map(build);
// which ten there are, for a migration that has to know what it already added
const STOCK_KEYS = SPECS.map(s=>s.key);

export { stockPlans, STOCK_KEYS };
