import { uid, clamp, D, ROOT, HOLD } from './util.js';

/* ============================================================
   2 · ATTRIBUTES and KINDS — the heart of Bureau
   ============================================================
   An attribute is a capability. A kind is a named set of attributes. Nothing
   below this line may branch on a kind's *name* — ask has(o,'check'), never
   o.kind==='task'. That rule is what keeps a new kind a data change.
   See docs/SYSTEM.md.                                                 */
const ATTRS = {
  text:     {nm:'Text',       ds:'A markdown body'},
  check:    {nm:'Checkbox',   ds:'A box on the left that completes it'},
  date:     {nm:'Date',       ds:'Can be scheduled, and shows up in Today'},
  /* When you will do it and when it is actually late are two different facts,
     and an app that stores one makes you lie about the other. `date` is the day
     a thing *sits* on — what a calendar draws it on and what Today collects.
     `deadline` is the day it is *late*. Opt-in, so nothing already on the desk
     changes and a thing merely scheduled for Friday stays a different thing
     from a thing owed on Friday. See decision 62. */
  deadline: {nm:'Deadline',   ds:'The day it is late — separate from the day you have put it on'},
  span:     {nm:'Lasts',      ds:'Runs from its date to another one — a trip, a shoot, a term'},
  repeat:   {nm:'Repeats',    ds:'Completing it spawns the next one'},
  button:   {nm:'Button',     ds:'A button that opens an object, a drawer, or a link'},
  container:{nm:'Container',  ds:'Holds other objects — this is what makes a drawer'},
  magic:    {nm:'Magic',      ds:'Collects by rule instead of by hand, like a smart folder'},
  streak:   {nm:'Streak',     ds:'A daily cadence with a history, and no overdue'},
  progress: {nm:'Milestones', ds:'Ordered steps with a progress bar'},
  media:    {nm:'Media',      ds:'An image, video, or audio file'},
  link:     {nm:'Link',       ds:'A web address it points at'},
  count:    {nm:'Count',      ds:'A tally you add to'},
  rating:   {nm:'Rating',     ds:'Out of five'},
  location: {nm:'Location',   ds:'Where it is'},
  duration: {nm:'Duration',   ds:'How long it takes'},
  priority: {nm:'Priority',   ds:'How much it matters to you — 0 to 5, not how urgent it is'},
  price:    {nm:'Price',      ds:'What it costs'},
  answer:   {nm:'Answerable', ds:'A box to answer it in — filled means answered'},
  relates:  {nm:'Related',    ds:'Points at other objects, both ways'},
  total:    {nm:'Total',      ds:'Adds up a field across what it holds'},
  spawn:    {nm:'Spawns',     ds:'Makes new objects — on a press, or as you type into it'},
  /* Two ways out of a locked board, one object at a time. A lock is which
     mode you are in (decision 74) and these do not change that — they are a
     standing exception for the handful of things you fiddle with constantly,
     and each says so on its own tile. See decision 81. */
  /* The one thing on the board that is *not* information. A decoration holds
     nothing and says nothing — it is the plant in front of the books — so it
     is also the one thing allowed to overlap, and the one nothing has to make
     room for. See decision 86. */
  decor:    {nm:'Decoration', ds:'Stands above the board rather than in it — it may overlap anything, and nothing makes room for it'},
  movable:  {nm:'Movable when locked',   ds:'Can be picked up on a locked board — wears a pin'},
  resizable:{nm:'Resizable when locked', ds:'Corners still work on a locked board — wears a bracket'}
};
/* An attribute is a trait — what an object can do and how it is drawn. Some
   traits also carry a *field*: a named, typed value. Only fields can be sorted
   or filtered on, which is what lets a magic drawer match anything at all
   rather than the four things it used to know about. */
const FIELDS = {
  check:    {key:'done',   type:'bool',   nm:'Done'},
  date:     {key:'due',    type:'date',   nm:'On'},
  deadline: {key:'dead',   type:'date',   nm:'Due by'},
  span:     {key:'till',   type:'date',   nm:'Runs until'},
  repeat:   {key:'repeat', type:'repeat', nm:'Repeats'},
  link:     {key:'url',    type:'text',   nm:'Link'},
  count:    {key:'count',  type:'number', nm:'Count'},
  rating:   {key:'rating', type:'number', nm:'Rating'},
  location: {key:'loc',    type:'text',   nm:'Location'},
  duration: {key:'dur',    type:'number', nm:'Duration'},
  priority: {key:'prio',   type:'level',  nm:'Priority', opts:[0,1,2,3,4,5]},
  price:    {key:'price',  type:'money',  nm:'Price'},
  answer:   {key:'answer', type:'text',   nm:'Answer'},
  relates:  {key:'rel',    type:'refs',   nm:'Related'}
};
const fieldOf = a => FIELDS[a] || null;
// every field an object actually carries, for filters and rollups
const fieldsOf = o => attrsOf(o).map(fieldOf).filter(Boolean);
const valOf = (o,key)=>{
  const v=o[key];
  if(v==null||v==='') return null;
  return v;
};
const numOf = (o,key)=>{ const v=parseFloat(String(valOf(o,key)??'').replace(/[^0-9.\-]/g,'')); return isNaN(v)?null:v; };

const ATTRKEYS = Object.keys(ATTRS);
/* Everything is an object and containing is an attribute like any other — but
   these two are the ones that decide whether a thing has children at all, and
   toggling them by accident turns a note into a drawer and orphans whatever was
   inside. They are edited through the drawer settings and the type builder,
   which ask the question deliberately, and kept out of the attribute picker,
   which is a row of chips you brush past. Structural means dangerous, not
   different. */
const STRUCTURAL = ['container','magic'];
const USER_ATTRS = ATTRKEYS.filter(a=>!STRUCTURAL.includes(a));

const BUILTIN_KINDS = {
  /* A drawer is a knob and a name. Two cells square is the smallest it can be
     and still read as a drawer front rather than a stamp — and at that size a
     row of them along the top of the desk is a rack of pigeonholes, which is
     what a desk full of drawers ought to look like. The phone size is stated
     outright: the derivation halves a container, and half of two is one, which
     is the mini tile that has no room for a name. */
  drawer:  {nm:'Drawer',  ic:'folder',  c:5, key:'D', ds:'A container on the grid',   attrs:['container'], layout:'grid', size:[2,2], phoneSize:[2,2], body:'' },
  magic:   {nm:'Magic drawer', ic:'sparkle', c:10, key:'Q', ds:'The same drawer, filled by a rule instead of by hand', attrs:['container','magic'], layout:'grid', size:[2,2], phoneSize:[2,2], body:'' },
  /* A checklist wears its contents on the outside, so it also takes dictation:
     `spawn` gives it a box at the top, and `genKind` says a line you type into
     it is a task. Both are ordinary attributes — a type you invent gets the
     same box by ticking the same trait. */
  checklist:{face:'checklist', nm:'Checklist', ic:'list', c:6, key:'K', ds:'Tasks you can tick and add to without opening it', attrs:['container','spawn'], spawnBy:'type', genKind:'task', layout:'list', size:[4,6], phoneSize:[4,6], body:'' },
  /* A calendar is a magic drawer wearing a calendar layout: it collects by rule
     like any other, and then draws what it collected on the day each thing is
     due. It holds nothing — the day is the `due` field on the object, not a
     container — so its default rule is "anything with a date". */
  calendar:{face:'calendar', nm:'Calendar', ic:'calendar', c:7, key:'C', ds:'Whatever it collects, on the day it falls', attrs:['container','magic'], filter:{rule:{f:'date',op:'any'}}, calview:'month', layout:'calendar', size:[4,4], phoneSize:[4,4], body:'' },
  control: {nm:'Control',  ic:'sliders', c:15, key:'', ds:'A Bureau button on the desk', attrs:['control'], size:[4,4], body:'' },
  task:    {shape:'sliver', nm:'Task',    ic:'check',   c:6, key:'T', ds:'A thing to do',             attrs:['text','check','date','repeat'], size:[4,1], onclick:'none', gathers:'checklist', body:'' },
  note:    {shape:'note', nm:'Note',    ic:'note',    c:10, key:'O', ds:'Something to remember',     attrs:['text'], size:[4,4], onclick:'read', body:'' },
  idea:    {shape:'idea', nm:'Idea',    ic:'bulb',    c:12, key:'I', ds:'A spark, unformed',         size:[4,4], onclick:'read', attrs:['text'], body:'**The spark —** \n\n**Why it might work —** \n\n**What it needs —** ' },
  outline: {nm:'Outline', ic:'list',    c:14, key:'L', ds:'Structure before prose',    size:[4,4], onclick:'read', attrs:['text'], body:'## I.\n- \n- \n\n## II.\n- \n- \n\n## III.\n- ' },
  // A recipe holds its ingredients rather than listing them in prose, so they
  // can be ticked while you cook and totalled before you shop. The method stays
  // in the body, which a container with `text` shows above what it holds.
  recipe:  {face:'checklist', cooking:true, nm:'Recipe',  ic:'pot',     c:11, key:'R', ds:'Ingredients you can tick, and a method',    size:[6,7], attrs:['text','container'], layout:'list', body:'**Serves** 2 · **Time** 30 min\n\n## Method\n1. \n2. \n3. ' },
  script:  {shape:'page', nm:'Script',  ic:'clapper', c:9, key:'S', ds:'Scenes and dialogue',       size:[4,4], onclick:'read', attrs:['text'], body:'### INT. LOCATION — DAY\n\nAction line.\n\n**CHARACTER**\nDialogue.' },
  /* Open until answered — and answering it is writing the answer down, not
     ticking a box. A tick says "dealt with"; a question wants the thing you
     worked out, and having it on the front is the whole value of keeping one. */
  question:{shape:'bubble', nm:'Question',ic:'help',    c:10, key:'?', ds:'Open until you have written the answer', size:[4,4], onclick:'read', attrs:['text','answer'], body:'**What I know —** \n\n' },
  essay:   {shape:'note', nm:'Essay',   ic:'feather', c:7, key:'Y', ds:'Long-form writing',         size:[4,4], onclick:'read', attrs:['text'], body:'> Working thesis.\n\n' },
  habit:   {shape:'habit', nm:'Habit',   ic:'repeat',  c:8, key:'A', ds:'Repeats, tracks a streak',  size:[4,4], onclick:'read', attrs:['text','streak'], body:'**Why —** ' },
  goal:    {shape:'goal', nm:'Goal',    ic:'target',  c:13, key:'J', ds:'Long-term, has milestones', size:[4,4], onclick:'read', attrs:['text','progress'], body:'**Definition of done —** ' },
  image:   {nm:'Image',   ic:'image',   c:15, key:'G', ds:'A picture on the board',   size:[6,4], onclick:'read', attrs:['media'], body:'' },
  /* Something standing on the shelf rather than filed on it. It carries
     `media` like a picture — you can put your own cut-out PNG or SVG on the
     desk — and ships with ten of its own, drawn in the style's colours. */
  decoration:{shape:'decor', nm:'Decoration', ic:'plant', c:6, key:'', ds:'Something to stand on the shelf — a plant, a bookend, a little figure', attrs:['decor','media'], size:[4,5], phoneSize:[2,3], mediaType:'image', onclick:'none', decor:'plant', body:'' },
  audio:   {film:true, nm:'Audio',   ic:'music',   c:10, key:'U', ds:'Something to listen to',    size:[6,2], onclick:'read', attrs:['text','media','duration'], mediaType:'audio', body:'' },
  video:   {film:true, nm:'Video',   ic:'film',    c:9, key:'&', ds:'Something to watch',        size:[6,4], onclick:'read', attrs:['text','media','duration'], mediaType:'video', body:'' },
  trip:    {shape:'ticket', nm:'Trip',    ic:'flag',    c:9, key:'P', ds:'Somewhere you are going',   size:[8,6], attrs:['container','date','span','location'], layout:'grid', body:'' },
  moodboard:{face:'moodboard', nm:'Moodboard', ic:'image', c:13, key:'B', ds:'Pictures, pinned together', size:[8,8], attrs:['container'], layout:'moodboard', body:'' },
  quote:   {shape:'quote', nm:'Quote',   ic:'book',    c:5, key:'Z', ds:'Someone else\'s words',      size:[6,4], onclick:'read', attrs:['text','link','rating'],
            body:'> \n\n— ' },
  /* A story holds its scenes and reads as a book; a world holds the people,
     places and things the stories are set in. The distinction is the whole
     reason there are two: a character outlives the book they first appeared in.
     Both readings of "opens as a book" apply — `layout:'book'` pages through
     the scenes it holds, `read:'book'` pages through its own body — and they
     are different properties, so it carries both rather than choosing. */
  story:   {face:'spine', binding:'ribbed', narrative:true, nm:'Story',   ic:'book',    c:5, key:'M', ds:'Scenes, bound in order', size:[3,9], attrs:['text','container','relates'], layout:'book', read:'book',
            body:'' },
  world:   {narrative:true, nm:'World',   ic:'star',    c:9, key:'F', ds:'The people, places and things a story is set in', size:[8,8], attrs:['text','container'], layout:'grid', body:'' },
  /* Four things that are made of other things, and were being kept as notes
     because no type could hold anything. A film is a piece of work with a date
     and a shape, so it reports like a project; a novel and a short story are
     bound, so they wear a spine and open as a book; an album is a running
     order, so it is a list you can dictate tracks into. None of them needed new
     machinery — they are four rows of attributes, which is the whole argument
     for attributes. */
  film:    {face:'project', film:true, nm:'Film', ic:'clapper', c:9, key:'!', ds:'A film, and everything it is made of',
     attrs:['text','container','date','progress','media','relates'],
     seed:[{kind:'field', title:'Add to this film…'}],
     layout:'grid', size:[5,5], phoneSize:[5,5], body:'' },
  novel:   {face:'spine', binding:'tooled', narrative:true, nm:'Novel', ic:'book', c:11, key:'#', ds:'Chapters, bound in order',
     attrs:['text','container','relates'], layout:'book', read:'book', size:[3,9], phoneSize:[2,6], body:'' },
  shortstory:{face:'spine', binding:'label', narrative:true, nm:'Short story', ic:'feather', c:14, key:'$', ds:'One story, its scenes in order',
     attrs:['text','container','relates'], layout:'book', read:'book', size:[3,7], phoneSize:[2,5], body:'' },
  album:   {film:true, nm:'Album', ic:'music', c:10, key:'%', ds:'Tracks, in the order they play',
     attrs:['text','container','media','spawn'], spawnBy:'type', genKind:'audio',
     layout:'list', size:[4,6], phoneSize:[4,5], body:'' },
  scene:   {shape:'page', narrative:true, film:true, nm:'Scene',   ic:'clapper', c:9, key:'N', ds:'One scene, for writing',     size:[6,5], onclick:'read', attrs:['text','location','duration','relates'], gathers:'story',
            body:'**Where —** \n\n**Who —** \n\n**What changes —** ' },
  character:{shape:'portrait', narrative:true, nm:'Character', ic:'star', c:13, key:'H', ds:'Someone in the story',       size:[4,6], onclick:'read', attrs:['text','media','relates'], gathers:'world',
            body:'**Wants —** \n\n**Fears —** \n\n**Voice —** ' },
  field:   {shape:'band', nm:'Text field', ic:'edit', c:15, key:'/', ds:'Type in it and a task appears below', size:[8,2], onclick:'none', attrs:['spawn'], spawnBy:'type', body:'' },
  poem:    {shape:'verse', parchment:true, nm:'Poem',    ic:'feather', c:10, key:'"', ds:'Lines, kept as written', size:[5,7], onclick:'read', attrs:['text'], body:'' },
  place:   {shape:'card', nm:'Place',   ic:'flag',    c:7, key:'1', ds:'Somewhere in the story',  size:[5,6], onclick:'read', attrs:['text','media','relates'], narrative:true, gathers:'world',
            body:'**Feels like —** \n\n**Who is there —** \n\n**What happened here —** ' },
  event:   {shape:'card', nm:'Event',   ic:'clock',   c:11, key:'2', ds:'Something that happens',  size:[6,4], onclick:'read', attrs:['text','date','relates'], narrative:true, gathers:'world',
            body:'**Before —** \n\n**The turn —** \n\n**After —** ' },
  item:    {shape:'card', nm:'Item',    ic:'star',    c:12, key:'3', ds:'A thing that matters',    size:[4,4], onclick:'read', attrs:['text','media','relates'], narrative:true, gathers:'world',
            body:'**What it is —** \n\n**Who wants it —** ' },
  ingredient:{shape:'index', cooking:true, nm:'Ingredient', ic:'pot', c:11, key:'4', ds:'One line of a recipe',   size:[5,1], onclick:'check', attrs:['check','count','price'], gathers:'recipe', body:'' },
  shot:    {shape:'sliver', film:true, nm:'Shot',    ic:'clapper', c:9, key:'5', ds:'One shot, for a shoot',   size:[6,1], onclick:'check', attrs:['text','check','duration','location'], gathers:'shotlist', body:'' },
  shotlist:{face:'checklist', film:true, nm:'Shot list', ic:'clapper', c:9, key:';', ds:'Shots for a shoot, in order', attrs:['container'], layout:'list', size:[7,8], body:'' },
  generator:{shape:'press', nm:'Generator', ic:'plus', c:13, key:'6', ds:'Press it and it makes one of something', size:[4,4], onclick:'generate', attrs:['spawn'], spawnBy:'click', body:'' },
  shopping:{cooking:true, face:'checklist', nm:'Shopping list', ic:'inbox', c:11, key:'7', ds:'Things to buy, with a total', attrs:['container'], layout:'list', size:[6,8], body:'' },
  counter: {nm:'Counter',  ic:'target', c:8, key:'X', ds:'A number, and what it counts', size:[4,4], onclick:'none', attrs:['count'], body:'' },
  link:    {shape:'card', nm:'Button',  ic:'arrow',   c:9, key:'E', ds:'A button that opens something', attrs:['button'], body:'' },
  achievement:{shape:'plaque', nm:'Achievement', ic:'trophy', c:12, key:'W', ds:'Something you actually did', size:[6,3], onclick:'read', attrs:['text','date'], body:'' },
  /* A project is a drawer with a front page. It holds everything a piece of
     work is made of — tasks, events, goals, pictures, notes — so it opens onto
     a board of its own rather than a list, and its front reports on what is
     inside instead of listing the first fourteen things. `media` gives it a
     cover; `spawn` lets you throw a task at it without opening it. */
  project: {face:'project', nm:'Project', ic:'flag',    c:7, key:'8', ds:'A whole piece of work, and everything it is made of',
     attrs:['text','container','date','progress','media','relates'],
     // born with a text field inside it rather than a box bolted to its front:
     // the type that makes tasks out of typing already exists, so a project
     // gets one put in it instead of growing a second one of its own
     seed:[{kind:'field', title:'Add to this project…'}],
     layout:'grid', size:[5,5], phoneSize:[4,4], body:'' },
  dream:   {shape:'dream', nm:'Dream',   ic:'star',    c:10, key:'9', ds:'Far off, and probably daft',   size:[5,5], onclick:'read', attrs:['text','media'], body:'**Why it pulls at me —** ' },
  timeline:{face:'timeline', nm:'Timeline',ic:'clock',   c:5, key:'0', ds:'Things in the order they happened', attrs:['container'], layout:'timeline', size:[10,6], body:'' },
  appt:    {shape:'sliver', nm:'Event',   ic:'calendar',c:8, key:'V', ds:'Something at a time and place', size:[6,2], onclick:'read', attrs:['text','date','duration','location'], body:'' }
};
// Kinds you invent live in state alongside these; both are read through KINDS.
let KINDS = Object.assign({}, BUILTIN_KINDS);
let KEYS = Object.keys(KINDS);
function refreshKinds(){
  KINDS = Object.assign({}, BUILTIN_KINDS, (S&&S.kinds)||{});
  KEYS = Object.keys(KINDS);
}
const K = k => KINDS[k] || KINDS.note;
// An object may override its kind's attributes; otherwise it inherits them.
const attrsOf = o => (o && o.attrs) || K(o&&o.kind).attrs || ['text'];
const has = (o,a) => attrsOf(o).includes(a);
const kindHas = (k,a) => (K(k).attrs||[]).includes(a);

/* ============================================================
   3 · seed data
   ============================================================ */
const T = D.iso(D.today());
const dz = n => D.addISO(T,n);

function seed(){
  // Drawers are objects like everything else — kind 'drawer', parent 'root'.
  // x/y are 1-based grid cells, packed by hand, because a desk is arranged and
  // not flowed. The desk grid is 24 columns wide, the phone's is 8.
  /* Locked, all of them. A desk you have arranged is a desk you want to look at
     rather than one you want to nudge every time your thumb lands on a front —
     and on a locked board one finger walks the boards, which is the gesture the
     phone is actually for. A drawer you make yourself starts unlocked, because
     you made it in order to arrange it. */
  const DR = (o)=> Object.assign({kind:'drawer', parent:ROOT, title:'', body:'',
    tags:[], layout:'grid', ord:0, created:dz(-40)}, o);
  // The drawers whose whole job is a rule are magic drawers — they collect and
  // never hold. The rest are ordinary containers you file into.
  const MG = (o)=> DR(Object.assign({kind:'magic'}, o));
  /* Ten drawer fronts in a rack along the top, at the size a drawer now starts
     at. The rest of the desk is left clear on purpose: what a drawer holds is
     behind it, so a wall of them is the whole point and takes one row.
     The first three are the ones that start out pinned — see below. */
  /* A desk has no box and no parent: it *is* somewhere, so it is not also a
     front sitting on somebody else's board. See decision 40. */
  const DESK = (o)=> DR(Object.assign({parent:null, desk:null, phone:null}, o));
  const drawers = [
    MG({id:'d_today', title:'Today',        c:6, layout:'list', filter:{due:'today', scope:'all'},      desk:{x:1,y:1,w:2,h:2},  phone:{x:1,y:1,w:2,h:2}}),
    /* The inbox **collects**; it does not hold. Everything loose on a desk —
       made and not yet put away — shows up in it, and stays exactly where it
       was made. A drawer that took what you made would be filing your desk for
       you, which is the one thing the desk is for. See decision 45. */
    MG({id:'d_in',    title:'Inbox',        c:5, layout:'list', filter:{loose:true, scope:'all'}, desk:{x:3,y:1,w:2,h:2},  phone:{x:3,y:1,w:2,h:2}}),
    // everything still to do, wherever it lives — the drawer that answers "what
    // is outstanding" without caring which desk or project it is outstanding on
    MG({id:'d_all',   title:'Everything',   c:9, layout:'list', filter:{kinds:['task'], scope:'all'},   desk:{x:5,y:1,w:2,h:2},  phone:{x:5,y:1,w:2,h:2}}),
    DR({id:'d_ideas', title:'Idea Bin',     c:12, desk:{x:7,y:1,w:2,h:2},  phone:{x:7,y:1,w:2,h:2}}),
    DR({id:'d_studio',title:'Studio',       c:9, desk:{x:9,y:1,w:2,h:2},  phone:{x:1,y:3,w:2,h:2}}),
    MG({id:'d_open',  title:'Open Questions',c:10,filter:{kinds:['question'], rule:{f:'answer',op:'is',v:''}},              desk:{x:11,y:1,w:2,h:2},  phone:{x:3,y:3,w:2,h:2}}),
    DR({id:'d_keep',  title:'Keeping Up',   c:8, desk:{x:13,y:1,w:2,h:2},  phone:{x:5,y:3,w:2,h:2}}),
    MG({id:'d_done',  title:'Done & Dusted',c:5, filter:{done:true, scope:'all'},                       desk:{x:15,y:1,w:2,h:2},  phone:{x:7,y:3,w:2,h:2}}),
    DESK({id:'d_write', title:'Writing Desk', c:7}),
    DESK({id:'d_kitch', title:'Kitchen',      c:11})
  ];

  // The app's own buttons live on the desk, on the grid, and move like anything
  // else. `ctl` names the action; section 20 dispatches it.
  const controls = [];   // no chrome on the board — the bar has the gear

  let n=0;
  const O = (o)=> Object.assign({
    id:uid('o'), kind:'note', title:'', body:'', tags:[], parent:ROOT, done:false, doneAt:null,
    due:null, repeat:null, history:[], milestones:[], media:null, ord:n++, created:dz(-30),
    desk:null, phone:null   // filled the first time it lands in a grid
  }, o);

  const objects = [
    O({kind:'task', title:'Draft the Bureau data model', due:T, parent:ROOT, tags:['bureau'], body:'Objects, kinds, drawers. One table, one enum, one join.'}),
    O({kind:'task', title:'Buy walnut oil + a proper straightedge', due:T, parent:ROOT, tags:['errand']}),
    O({kind:'task', title:'Call Mom back', due:dz(-1), parent:ROOT, tags:['personal']}),
    O({kind:'task', title:'Ship the drawer-resize gesture', due:dz(1), parent:ROOT, tags:['bureau']}),
    O({kind:'task', title:'Water the fig', repeat:{every:1, unit:'week', days:[], from:'date', ends:null, paused:false, made:0}, due:dz(2), parent:ROOT, tags:['home']}),
    O({kind:'task', title:'Pay the storage unit', repeat:{every:1, unit:'month', days:[], from:'date', ends:null, paused:false, made:0}, due:dz(4), parent:ROOT, tags:['admin']}),
    O({kind:'task', title:'Reply to Dana about the September shoot', due:dz(-2), parent:'d_studio', tags:['work']}),
    O({kind:'task', title:'Export the reel at 4K', done:true, doneAt:dz(-1), parent:'d_studio', tags:['work']}),

    O({kind:'idea', title:'A drawer that only opens on Sundays', parent:'d_ideas', tags:['bureau'],
       body:'**The spark —** Some things should be unavailable most of the week.\n\n**Why it might work —** Scarcity makes a container feel like a place, not a list.\n\n**What it needs —** A schedule field on the drawer, and a lovely locked state.'}),
    O({kind:'idea', title:'Objects that age — paper yellows if untouched', parent:'d_ideas', tags:['bureau','visual']}),
    O({kind:'idea', title:'Short film: the last video store', parent:'d_ideas', tags:['film']}),
    O({kind:'idea', title:'Newsletter about small tools', parent:'d_ideas', tags:['writing']}),

    O({kind:'essay', title:'Why software forgot about furniture', parent:'d_write', tags:['writing','bureau'],
       body:'> Every app is a feed. Almost nothing is a *place*.\n\nA desk is not a better list. A desk is a room-sized argument about what deserves to be within reach.\n\n## The drawer as an idea\n\nA drawer is a promise: this is finite, and you decided what goes in it.\n\n- Finite space forces a judgment\n- Position encodes priority without a number\n- Opening one is a small, satisfying act\n\n## What we lost\n\nInfinite scroll removed the cost of keeping something. When keeping is free, keeping means nothing.'}),
    O({kind:'outline', title:'Essay outline — "Furniture"', parent:'d_write', tags:['writing'],
       body:'## I. The feed ate the room\n- Everything is chronological now\n- Chronology is not memory\n\n## II. Containers as arguments\n- The drawer, the shelf, the box\n- Finitude as a feature\n\n## III. What an app could borrow\n- Position, weight, wear\n- Opening as ritual'}),
    O({kind:'note', title:'Reading notes — *The Design of Everyday Things*', parent:'d_write', tags:['reading'],
       body:'Affordances are relationships, not properties. A handle affords pulling **for a hand**.\n\n- Signifiers > affordances for screens\n- Feedback must be immediate or it reads as failure'}),
    O({kind:'note', title:'Names considered before "Bureau"', parent:'d_write', tags:['bureau'],
       body:'- Cabinet — too governmental\n- Sideboard — too English\n- Escritoire — unpronounceable, briefly perfect\n- **Bureau** — desk *and* office. Wins.'}),

    O({kind:'question', title:'Should a drawer be able to contain another drawer?', parent:'d_open', tags:['bureau'],
       body:'**Question —** Nesting is powerful and also how Obsidian becomes a swamp.\n\n**What I know —** Two levels feels safe. Infinite depth always rots.\n\n**Answer —** '}),
    O({kind:'question', title:'What happens to an object with no drawer?', parent:'d_open', tags:['bureau']}),
    O({kind:'question', title:'Is a habit a kind, or a property of a task?', parent:'d_open', tags:['bureau']}),

    // A recipe holds its ingredients now, so the seed has to show one that does
    // — an empty checklist front is what a recipe looks like when it's wrong.
    O({id:'o_braise', kind:'recipe', title:'Sunday braise', parent:'d_kitch', tags:['cooking'],
       body:'**Serves** 4 · **Time** 3 hr\n\n## Method\n1. Salt the meat the night before.\n2. Brown hard, in batches, no crowding.\n3. Wine in, scrape, reduce by half.\n4. 150°C, lid on, 3 hours. Do not peek.'}),
    O({kind:'ingredient', title:'1.4 kg chuck, in big pieces', parent:'o_braise', price:'18.40'}),
    O({kind:'ingredient', title:'2 onions, halved', parent:'o_braise', price:'0.80'}),
    O({kind:'ingredient', title:'1 head garlic, topped', parent:'o_braise', price:'0.60'}),
    O({kind:'ingredient', title:'400 ml red', parent:'o_braise', price:'7.00'}),
    O({kind:'ingredient', title:'Bay, thyme, a strip of orange peel', parent:'o_braise', price:'1.20'}),
    O({kind:'recipe', title:'The only pancakes', parent:'d_kitch', tags:['cooking']}),
    O({kind:'recipe', title:'Cold-brew ratio that finally worked', parent:'d_kitch', tags:['cooking']}),

    O({kind:'script', title:'THE LAST VIDEO STORE — cold open', parent:'d_studio', tags:['film'],
       body:'### INT. VIDEO STORE — NIGHT\n\nFluorescent hum. Shelves half empty. MARGO, 60s, alphabetizes a section that no longer needs it.\n\n**MARGO**\nWe close at nine. We closed at nine for thirty-one years.\n\nShe puts a tape back anyway.'}),
    // One 'media' kind became image/audio/video in migration 7; the seed kept
    // naming the old one, so these three came back as plain notes on first run.
    O({kind:'image', title:'Reference — brass drawer pulls', parent:'d_studio', tags:['visual','bureau'], media:{type:'image', label:'12 photographs · Kodak Gold'}}),
    O({kind:'audio', title:'Room tone — kitchen, 4am', parent:'d_studio', tags:['film'], media:{type:'audio', label:'02:14 · WAV'}}),
    O({kind:'video', title:'Drawer-open animation test v3', parent:'d_studio', tags:['bureau','visual'], media:{type:'video', label:'00:06 · ProRes'}}),

    O({kind:'habit', title:'Write 500 words', parent:'d_keep', tags:['writing'], repeat:{every:1, unit:'day', days:[], from:'date', ends:null, paused:false, made:0},
       history:[dz(-1),dz(-2),dz(-3),dz(-4),dz(-6),dz(-7),dz(-8),dz(-11)], body:'**Why —** The essay only exists on the days I show up.'}),
    O({kind:'habit', title:'Walk before screens', parent:'d_keep', tags:['health'], repeat:{every:1, unit:'day', days:[], from:'date', ends:null, paused:false, made:0},
       history:[dz(-1),dz(-2),dz(-3),dz(-5),dz(-6),dz(-9),dz(-10),dz(-12),dz(-13)]}),
    O({kind:'habit', title:'Close the laptop by 10', parent:'d_keep', tags:['health'], repeat:{every:1, unit:'week', days:[1,2,3,4,5], from:'date', ends:null, paused:false, made:0},
       history:[dz(-2),dz(-3),dz(-4),dz(-7)]}),

    O({kind:'goal', title:'Ship Bureau 1.0 to the App Store', parent:'d_keep', tags:['bureau'], due:dz(120),
       milestones:[{t:'Object model settled',done:true,d:dz(-20)},{t:'Drawers grid, both layouts',done:true,d:dz(-6)},
                   {t:'Sync working across devices',done:false,d:dz(30)},{t:'Beta with 10 people',done:false,d:dz(70)},
                   {t:'Submit for review',done:false,d:dz(110)}],
       body:'**Definition of done —** My own to-dos live in it for a month and I never open Things.'}),
    O({kind:'goal', title:'Finish the essay collection', parent:'d_keep', tags:['writing'], due:dz(240),
       milestones:[{t:'Six essays drafted',done:true,d:dz(-40)},{t:'Ten essays drafted',done:false,d:dz(60)},
                   {t:'Full read-through',done:false,d:dz(150)},{t:'Send to three readers',done:false,d:dz(200)}]}),

    // A timeline, so a fresh desk shows one — its face is a real date axis, and
    // an axis with nothing on it demonstrates nothing.
    O({id:'o_reel', kind:'timeline', title:'The video store shoot', parent:'d_studio', tags:['film']}),
    O({kind:'appt', title:'Location recce', parent:'o_reel', due:dz(-9)}),
    O({kind:'appt', title:'Shoot days', parent:'o_reel', due:dz(3)}),
    O({kind:'appt', title:'First assembly', parent:'o_reel', due:dz(17)}),
    O({kind:'appt', title:'Colour and sound', parent:'o_reel', due:dz(34)}),

    O({kind:'achievement', title:'Cut the reel from 6 min to 2:40', parent:'d_done', done:true, doneAt:dz(-2), tags:['work']}),
    O({kind:'achievement', title:'Read *Understanding Comics* cover to cover', parent:'d_done', done:true, doneAt:dz(-5), tags:['reading']}),
    O({kind:'achievement', title:'30-day streak: walk before screens', parent:'d_done', done:true, doneAt:dz(-9), tags:['health']}),
    O({kind:'achievement', title:'Named the app', parent:'d_done', done:true, doneAt:dz(-14), tags:['bureau']})
  ];

  /* ---- one of everything, on the desk -------------------------------------
     A sample of every built-in type, named after itself, laid out in a block
     under the drawer rack. It is the fastest way to see a change across the
     whole app at once — a border, a shape, a size class, a style — and it is
     generated from KEYS rather than written out, so a type added tomorrow
     appears here without anyone remembering to add it.

     Placed left to right, wrapping when the row runs out, on the desk grid;
     the phone box is left null so ensureBox() lays them out in phone
     coordinates the first time that layout is opened. Containers are given a
     child apiece, because an empty checklist is a picture of a checklist that
     is wrong. */
  // the desk grid's width. Not imported from grid.js on purpose: grid.js
  // imports this file, and a cycle evaluated at load time is a real one.
  const GRID_COLS = 24;
  /* Row 10 down. The rack is rows 1–2 and the six rows under it are left
     clear on purpose — a desk you can put something on, and the space every
     test fixture and every hand-made object lands in first. */
  const museum=[]; let mx=1, my=10, rowH=0;
  KEYS.filter(k=>k!=='control').forEach(k=>{
    const d=KINDS[k], [w,h]=d.size||[4,4];
    if(mx+w-1 > GRID_COLS){ mx=1; my+=rowH; rowH=0; }
    rowH=Math.max(rowH,h);
    const id='k_'+k;
    museum.push(O({id, kind:k, title:d.nm, parent:ROOT, tags:['sampler'],
      body: kindHas(k,'text') ? (d.body||'A sample '+d.nm.toLowerCase()+', so you can see one.') : '',
      desk:{x:mx, y:my, w, h}, phone:null}));
    if(kindHas(k,'container') && !kindHas(k,'magic'))
      // the kind's own answer, read straight off the table: genKindOf() is
      // declared further down this file and seed() runs before it exists
      ['One','Two','Three'].forEach(t=>museum.push(O({kind:d.genKind||'task', title:t, parent:id})));
    mx+=w;
  });

  /* Three drawers on the shelf, and they are the three every desk wants:
     what is due today, where things land when you don't say, and everything
     still outstanding anywhere. A first desk should show what pinning is for,
     and these are the ones worth reaching in one tap. */
  return {objects: drawers.concat(controls, objects, museum),
          /* Two of the drawers start as desks of their own, because one desk
             holding a life is exactly the thing desks exist to stop — and a
             sample desk that never demonstrates the master space is a sample
             of the old app. A desk is not on the shelf: it is somewhere you
             walk to, and the title at the top left lays them all out. */
          desks: [ROOT, 'd_write', 'd_kitch'],
          pins: ['d_today','d_in','d_all']};
}

/* ============================================================
   4 · state
   ============================================================ */
let S;
const sensedDevice = ()=> window.matchMedia('(min-width: 900px)').matches ? 'desk' : 'phone';
function reset(){
  const s = seed();
  S = {
    objects:s.objects, kinds:{}, desks:s.desks.slice(),
    // one shelf, one list: anything at all may be kept on it, and it is the
    // same list wherever you are standing
    pins:s.pins.slice(),
    // Light or dark comes from the aesthetic now — Victoria is a parchment desk,
    // Starry Sidekick is a night one — so there is no theme to store.
    device:sensedDevice(), layoutEdit:null,
    view:'desk', drawerId:null, openId:null,
    arrange:false, kindFilter:null, calDay:null,
    // editId is the tile being typed in on the board — a double tap turns a
    // name into a field in place. writeId is the full-screen writing surface.
    // viewId is the picture surface: what an object made of an image opens onto
    undo:[], redo:[], editing:false, sel:[], readId:null, writeId:null, viewId:null, editId:null, bookAt:0,
    // a desk you have arranged is one you want to look at, so it starts locked
    deskCfg:{layout:'grid', sort:null},
    look:defaultLook()
  };
  refreshKinds();
}
function defaultLook(){
  return {bg:null, accent:null, line:null, board:null, boardAlpha:1, owner:'',
          // light or dark follows the device unless you insist otherwise
          dark:'auto',
          // small | extra | large — how many columns a phone board has
          grid:'small', style:'victorian', slots:{}, styleDefaults:null,
          // things on a surface cast a shadow onto it; false lays them flat
          shadows:true,
          /* One lock for every board there is — see decision 74. Locked by
             default, because a desk you have arranged is one you want to look
             at, and on a locked board one finger walks the boards. */
          locked:true,
          /* Pinned to a board rather than laid flat on one: a little air around
             each tile and a degree or two of tilt. Off by default — see
             decision 75. */
          pinned:false};
}
reset();

// which drawer layout we are looking at — the real device, unless you have
// deliberately opened the other one to arrange it
const dev = ()=> S.layoutEdit || S.device;
const byId = id => S.objects.find(o=>o.id===id);

/* The desk is the root container. It is never drawn as a tile — it is the grid
   everything else starts on. Giving it a real object keeps every code path that
   walks containers identical at the top level. */
const deskTitle = ()=>{ const n=((S.look&&S.look.owner)||'').trim();
  return n ? `${n}${/s$/i.test(n)?"'":"'s"} Desk` : 'Desk'; };
const rootObj = ()=> Object.assign({id:ROOT, kind:'drawer', title:deskTitle(), c:5,
                       pv:'list', filter:{}, layout:'grid', parent:null},
                       S.deskCfg||{});
const container = id => (id===ROOT||!id) ? rootObj() : byId(id);
// The desk's own settings aren't on an object, so writes have to go to deskCfg.
const cfgOf = id => (id===ROOT||!id) ? S.deskCfg : (byId(id)||{});
const isContainer = o => !!o && has(o,'container');
/* A face is how a container draws itself on its parent's board. A layout is
   how it arranges its children once opened. They used to be one property,
   which meant a checklist could not also be sorted when you opened it. */
/* ---- a slot may name the aesthetic it came from ------------------------
   Every look slot — border, panelling, knob, texture, binding — stores a
   *position*, and what a position is made of is the aesthetic's business.
   That is the whole point of the system (decision 33) and it is also its one
   sharp edge: a Golf 97 group box you liked becomes a Victorian raised panel
   the moment you switch, and there was no way at all to say "not that one,
   keep it as it is".

   So a stored value may be **pinned** to the aesthetic it was borrowed from,
   written `golf97/fielded`. A bare value follows the desk and re-dresses on
   every switch, which stays the default and is what nearly everything holds;
   a pinned one is dressed by the aesthetic it names, wherever you are.

   No migration: every value written before this is bare, and a bare value
   means exactly what it always meant. See decision 98. */
const slotKey  = v => { const s=String(v==null?'':v), i=s.indexOf('/'); return i<0?s:s.slice(i+1); };
const slotFrom = v => { const s=String(v==null?'':v), i=s.indexOf('/'); return i<0?null:s.slice(0,i); };
/* The stored value of one look slot, per object then per type, pin and all —
   the raw thing, before the key is taken off it. */
const slotRaw = (o, prop) => (o && o[prop]) || K(o&&o.kind)[prop] || '';
// which aesthetic dresses this object's slot, or null for "whichever is showing"
const slotSrc = (o, prop) => slotFrom(slotRaw(o, prop));

/* ---- how a book is bound ----------------------------------------------
   A spine is the one face that is a *made object* rather than a layout — it
   is the outside of a book, and the outside of a book is the binder's work.
   Five, in the order a shelf acquires them: the plain cloth case, the gilt
   rules a publisher put on it, the raised hubs of a hand-sewn leather back,
   the full tooled panel, and the paper label somebody pasted on. Per object
   then per type, like a border or a knob — ask `bindingOf(o)`. See
   decision 87. */
const BINDINGS = {
  plain:  'Plain cloth',
  banded: 'Gilt rules',
  ribbed: 'Raised bands',
  tooled: 'Tooled and gilt',
  label:  'Paper label'
};
const BINDING_SLOTS = Object.keys(BINDINGS);
/* A name that isn't one of the five falls back rather than being stamped onto
   the tile: `bn-` plus whatever was stored styles nothing, so a typo in an
   imported backup would silently give a spine no binding at all. */
const bindingOf = o => {
  const b = slotKey(slotRaw(o,'binding'));
  return BINDINGS[b] ? b : 'banded';
};

/* ---- how a drawer front is worked ------------------------------------
   The cabinetmaker's half of the same idea as a binding. A drawer front is a
   piece of shaped wood, and what makes it read as one is not its colour but
   the *light on its edges* — so all five are mouldings, and every one of them
   is lit from the **upper left**, which is where `.pull` puts its highlight.
   A front lit from somewhere else is a knob sitting on somebody else's wood.

   Five, in the order a workshop adds them: the flat board, the cockbead round
   its rim, the raised-and-fielded panel, a reeded face, and the sunk ogee
   panel with gilt. Per object then per type, like a knob or a border — ask
   `panelOf(o)`. See decision 88. */
/* **These five are positions, not descriptions** — the same arrangement the
   border slots have had all along (decision 33). What you store is the slot,
   and what a slot is *made of* is the aesthetic's business: position 2 is
   Victoria's raised-and-fielded panel, Carca's ashlar block, Golf 97's group
   box and Stelaine's floating slab. The names below are the fallback and
   happen to be Victoria's, because it was the only aesthetic when panelling
   was written; `panelSlots()` in look.js overlays whichever is showing.
   See decision 93. */
const PANELS = {
  plain:    'Flat front',
  cockbead: 'Cockbead',
  fielded:  'Raised panel',
  reeded:   'Reeded',
  ogee:     'Ogee panel'
};
const PANEL_SLOTS = Object.keys(PANELS);
/* A knob is a slot too, and for the same reason: what you store is the
   *position*, and what position 0 is made of is the aesthetic's business — a
   turned Victorian knob, a Carca gear, a Golf 97 button, a Girando volute.
   `orb` used to be offered in the picker and had no CSS at all, so picking it
   quietly gave you a plain round one; it is not a position and `knobOf()`
   falls back rather than stamping a class nothing styles. See decision 96. */
const KNOBS = {
  round:   'Round',
  diamond: 'Diamond',
  bar:     'Bar',
  ring:    'Ring',
  square:  'Square'
};
const KNOB_SLOTS = Object.keys(KNOBS);
const knobOf = o => {
  const k = slotKey(slotRaw(o,'knob'));
  return KNOBS[k] ? k : 'round';
};
/* ---- the edge, and what the front is made of --------------------------
   Two more slot families, read the same way as the three above so a pin
   works on all five. `BORDER_SLOTS` used to live in look.js, which was the
   wrong side of the wall: the *positions* are the model's vocabulary and only
   what each is called is the aesthetic's. Seven, with gilt among them since
   decision 94 and plain and none last because they mean the same thing
   everywhere. */
const BORDER_SLOTS = ['panel','heavy','bar','gloss','gilt','plain','none'];
/* A front with nothing said about it is *panelled* — a drawer is a piece of
   worked wood and a flat rectangle is the thing all this exists to stop being.
   An object is a piece of paper, and a moulding round a note is a mount round
   a note, so it starts plain: this is the one place the two halves of the
   system honestly want different defaults, and it is structural rather than a
   branch on a type's name. See decision 99. */
const borderOf = o => {
  const b = slotKey(slotRaw(o,'border'));
  return BORDER_SLOTS.includes(b) ? b : (isContainer(o) ? 'panel' : 'plain');
};
/* ---- what the sheet is made of ----------------------------------------
   A drawer is wood: colour, edge, panelling, knob, grain. An object is
   **paper**, and the same five minus the hardware — with one of its own,
   because what a sheet *is* is not a pattern printed on it. A texture is
   the grain of the surface; a stock is the body of it: how it takes the
   light, how thick it is, how its edge is cut.

   Five positions, and 0 is the flat sheet the app has always drawn, so
   nothing changes for an object that hasn't asked. The names below are
   Victoria's and the fallback; each aesthetic answers for its own — Golf
   97's window and dialog, Stelaine's starcloth, Aeros' frosted acrylic.
   See decision 99. */
const STOCKS = {
  plain: 'Plain',
  laid:  'Laid',
  wove:  'Wove',
  card:  'Card',
  aged:  'Aged'
};
const STOCK_SLOTS = Object.keys(STOCKS);
const stockOf = o => {
  const st = slotKey(slotRaw(o,'stock'));
  return STOCKS[st] ? st : 'plain';
};
/* Six positions of grain: nothing, the fine tooth of the surface, a weave, a
   ruling, a scatter, and an outright pattern. Eleven global names became six
   slots in migration 24 — a texture is what a *surface* is made of, and stone,
   glass, cathedral paper and a 1997 dialog do not share one. */
const TEXTURE_SLOTS = ['none','fine','weave','ruled','speckle','pattern'];
const textureOf = o => {
  const t = slotKey(slotRaw(o,'texture'));
  return TEXTURE_SLOTS.includes(t) ? t : 'none';
};
/* Cockbead is the default rather than flat: it is on very nearly every drawer
   of the period, it is one moulding rather than an ornament, and a flat
   rectangle is the thing this exists to stop being. Unknown names fall back,
   the same way a binding does. */
const panelOf = o => {
  const p = slotKey(slotRaw(o,'panel'));
  return PANELS[p] ? p : 'cockbead';
};

const FACES = {front:'Drawer front', checklist:'Checklist', project:'Project',
               calendar:'Calendar', moodboard:'Moodboard', timeline:'Timeline',
               spine:'Book spine'};
const faceOf = o => (o && o.face) || K(o&&o.kind).face || 'front';
// How a container arranges what it holds, once opened. The kind's is the
// fallback, so a type that says it opens as a calendar does even when nothing
// has written `layout` onto the object itself.
const layoutOf = o => (o && o.layout) || K(o&&o.kind).layout || 'grid';

/* `spawn` covers two things that make objects: a press, and a box you type
   into. Which one, and what comes out, are per object then per type — so a
   checklist that takes dictation and a generator that presses out scenes are
   the same trait wearing two settings, not two branches. */
const spawnByOf = o => (o && o.spawnBy) || K(o&&o.kind).spawnBy || 'click';
const genKindOf = o => (o && o.genKind) || K(o&&o.kind).genKind || 'task';
// A container that takes dictation: a box at the top of it, on its front and
// inside it, making one of whatever it collects.
const takesTyping = c => has(c,'spawn') && spawnByOf(c)==='type';

/* How much of time one screen of a calendar covers, and the two questions
   every calendar has ever asked. Per object then per type, like everything
   else — a calendar layout on an ordinary drawer gets them too. */
const CALVIEWS = {month:'Month', week:'Week', day:'Day'};
const calViewOf = o => (o && o.calview) || K(o&&o.kind).calview || 'month';
const weekStartOf = o => (o && o.weekStart) || K(o&&o.kind).weekStart || 'mon';
const showsWeekends = o => ((o && o.weekends) ?? K(o&&o.kind).weekends) !== false;
/* The days of the week a calendar draws, in the order it draws them. 0 is
   Sunday, JavaScript's own numbering, so nothing has to translate. */
function calCols(c){
  const order = weekStartOf(c)==='sun' ? [0,1,2,3,4,5,6] : [1,2,3,4,5,6,0];
  return showsWeekends(c) ? order : order.filter(n=>n!==0 && n!==6);
}

/* Completed things leave their drawer (decision 2) — that is the whole
   argument for drawers, because it is what keeps one finite. Four faces are
   exempt, and for one reason: their job is to show what has already happened.
   A checklist that empties itself as you tick is not a checklist, and a
   calendar whose days clear behind you is not a record of anything. (The
   checklist *face* prints only the undone — decision 79 — but that is what
   the front shows, not what the drawer holds: the ticked ones stay inside.) */
const DONE_FACES = ['checklist','project','calendar','timeline'];
const keepsDone = c => DONE_FACES.includes(faceOf(c));
// laid out along time rather than in a grid — by face, or by how it opens
const TIME_FACES = ['calendar','timeline'];
const showsContainers = c => TIME_FACES.includes(faceOf(c)) || TIME_FACES.includes(layoutOf(c));

/* What a pile of these becomes. Dropping one object on another is only a
   gesture if both agree what they add up to — two tasks are a checklist, two
   ingredients are a recipe — so the answer is a property of the type rather
   than six branches on a type's name. A type you invent gets it by filling in
   one field, which is the whole point of keeping it here. */
const gathersOf = o => (o && o.gathers) || K(o&&o.kind).gathers || null;
function gatherKind(a, b){
  if(!a || !b || a.id===b.id) return null;
  if(isContainer(a) || isContainer(b)) return null;   // a container is filed into, not piled
  const g=gathersOf(a);
  return g && g===gathersOf(b) && KINDS[g] ? g : null;
}

/* How a non-container object draws itself. This used to be read off the type's
   *name* in both the renderer and the stylesheet, which is exactly what
   CLAUDE.md forbids — an invented type could never look like anything. It is a
   property now, defaulting to the type's, and settable per object. */
/* How big the pull is. A drawer front is mostly knob at 2×2 and mostly name at
   8×8, so the one size that suited both was a compromise at each. */
const KNOBSIZES = {sm:'Small', md:'Medium', lg:'Large'};
// medium: a front is mostly knob at 2x2 and mostly name at 8x8, and small
// was the compromise that read as neither
const knobSizeOf = o => (o && o.knobsize) || 'md';
// Answered is "there is something written in the box", not a flag of its own.
const answered = o => !!String((o&&o.answer)||'').trim();

/* An object's mark. A type carries one; an object may insist on another —
   the same object-then-type shape as its colour and its shape, so the icon on
   a tile is never read straight off K(o.kind).ic again. */
const iconOf = o => (o && o.ic) || K(o&&o.kind).ic || 'note';

/* How big the words on a face are: a multiplier, not a size. A tile's type is
   already measured against the tile, so 1.4 is the same note read from closer
   rather than a second design — and every rule that sets a size keeps its own
   answer, multiplied. Per object, then per type, then 1. */
const TSIZES = [['0.8','Smaller'],['1','Normal'],['1.25','Larger'],
                ['1.6','Large'],['2','Largest']];
const textSizeOf = o => +(((o && o.tsize) || K(o&&o.kind).tsize || 1)) || 1;

/* Which sort of media a thing holds. The object's own answer first, then the
   type's — an Audio object with nothing in it yet is still for audio, and
   guessing "image" from an empty field is how an empty sound file came to be
   drawn as a missing photograph. */
const mediaTypeOf = o => (o && o.media && o.media.type) || K(o&&o.kind).mediaType || 'image';
/* A picture: something that carries media, and whose media is an image. This is
   what opens onto the picture surface rather than onto paper. */
const isPicture = o => has(o,'media') && mediaTypeOf(o)==='image';
/* A decoration is above the board rather than in it: it may overlap anything,
   nothing makes room for it, and it wears no tile chrome at all. Ask this,
   never the kind's name — a type you invent that ticks the trait is a
   decoration too. See decision 86. */
const isDecor = o => has(o,'decor');
/* …and the other two. Audio and Video were real types with a mark, a size and a
   place in the picker, and the file input was `accept="image/*"` — so they
   existed in order to tell you they were not implemented, which is a promise
   the desk makes and does not keep. `isMedia(o)` is anything that carries a
   file at all, and it is what decides which things open onto the media surface
   rather than onto paper. See decision 71. */
const isMedia = o => has(o,'media');
const isPlayable = o => isMedia(o) && mediaTypeOf(o)!=='image';
/* What the file picker should be willing to show for it. */
const acceptFor = o => ({image:'image/*', audio:'audio/*', video:'video/*'})[mediaTypeOf(o)] || 'image/*';

/* The four at the end are the newer answers to "what does a task look like",
   which is a question a plain sliver only ever answered by not being anything.
   They are ordinary shapes: any type can wear one, and a task is a `sliver`
   until you say otherwise. */
const SHAPES = {
  card:'Card', habit:'Streak', goal:'Progress bar', dream:'Dashed', image:'Picture', note:'Torn note', idea:'Folded corner', bubble:'Speech bubble',
  page:'Punched page', index:'Index card', spine:'Book spine', portrait:'Portrait',
  ticket:'Ticket', plaque:'Plaque', tally:'Tally', quote:'Quotation',
  verse:'Verse', sliver:'Sliver', press:'Press', band:'Band',
  tab:'Filing tab', ruled:'Ruled line', chit:'Torn chit', pill:'Pill'
};
const shapeOf = o => (o && o.shape) || K(o&&o.kind).shape || 'card';

/* How an object opens to be read. Three ways of looking at the same body, so
   the choice is one property rather than three click actions: a spread you
   turn through, a single page you turn through, or one uninterrupted column.
   Per object, falling back to its type, which is what the type builder sets.
   A type that says nothing opens as a page. */
const READS = {book:'Book', page:'Page', scroll:'Scroll'};
const readOf = o => (o && o.read) || K(o&&o.kind).read || 'page';

/* How a thing opens — the movement, not the destination. Same shape as
   readOf() and clickOf(): the object's own answer, then its type's, then
   `auto`, which asks the object what it *is* rather than what it is called.
   Resolving auto needs the object's box and its shape, so it lives in
   motion.js next to the animations it chooses between; this is the vocabulary
   and the stored value, which is what the settings panel needs. */
const OPENINGS = {auto:'However it suits', dive:'You go in',
  drawer:'Pulls out of the shelf',
  cabinet:'Swings open', curl:'Curls up', lift:'Lifts', none:'Nothing'};
const openingOf = o => (o && o.opening) || K(o&&o.kind).opening || 'auto';
// A phone has no room for a spread, so book reads as page there and the page
// step follows — otherwise turning would skip one every time.
const spreadOf = o => readOf(o)==='book' && S.device==='desk';
const containers = ()=> S.objects.filter(isContainer);

/* ---- desks, and the master space they sit in --------------------------
   There used to be one desk and everything was under it. That works until the
   desk is asked to be a life: finances, a screenplay, what to eat, who to ring
   — all of it landing on one board, all of it visible from everywhere at once.

   So a **desk** is a drawer that has been given a place in the master space: an
   ordered row, with home in it like everything else, that you walk left and
   right. A drawer that has not been given a place is an ordinary drawer, and
   the difference between the two is only that one is somewhere you can *be*
   and the other is somewhere you *went into*. That is why the breadcrumb roots
   at the nearest desk, why the top shelf belongs to the desk you are on, and
   why a magic drawer collects from its own desk unless told otherwise.

   `S.desks` is that row, ids in order, ROOT among them. It is resolved on read
   — a desk whose drawer has been deleted simply stops appearing, so no delete
   path has to tidy up after itself. The row does not wrap: a space you can walk
   off the end of is a space you can learn, and a loop with a seam in it is not
   spatial. See decision 39. */
const deskIds = ()=> (S.desks||[ROOT]).filter(id=>id===ROOT || (byId(id)&&isContainer(byId(id))));
const deskList = ()=> deskIds().map(container).filter(Boolean);
const isDesk = id => deskIds().includes(id||ROOT);
/* Which desk something is on — the nearest ancestor that is one. ROOT is always
   a desk, so this always terminates somewhere. */
function deskOf(o){
  let x = typeof o==='string' ? container(o) : o, n=0;
  while(x && n++ < 100){
    if(isDesk(x.id)) return x.id;
    x = x.parent ? container(x.parent) : null;
  }
  return ROOT;
}
// which desk you are looking at, whichever board of it you are on
const deskHere = ()=> deskOf(S.view==='drawer' && S.drawerId ? S.drawerId : ROOT);

/* ---- where a container is kept -----------------------------------------
   There was a shelf: one global row along the bottom of a phone, holding
   whatever you wanted to hand from wherever you were standing. It is out for
   now — it cost a row of every board on every desk for a navigation the desks,
   the magic drawers and ⌘K already do between them. See decision 53.

   So there is one answer left. A container is either a **desk** — somewhere in
   the master space you can stand — or it is on the board it lives on, like
   everything else. `S.pins` is still loaded and saved untouched, so nothing
   anybody put on the shelf is lost and putting it back is putting these few
   lines back. */
// 'desk' | null — how this container is kept, if at all
const placeOf = id => isDesk(id) && id!==ROOT ? 'desk' : null;

/* ---- the holding space --------------------------------------------------
   A drawer along the bottom of a phone that holds things while you carry them
   somewhere else — the desk's own hand. An object put in it is parented to
   HOLD, which is a reserved id and not an object: nothing draws it, nothing
   collides in it, and there are no coordinates to keep, because it is not a
   board. That is the whole of the state, so it exports, imports, migrates and
   reloads with everything else and needed none of them told about it.

   Its order is arrival order, `ord` ascending, because the drawer is a queue
   of things you meant to move rather than a board you arranged. See decision
   107. */
const isHeld = o => !!o && o.parent===HOLD;
const heldObjects = ()=> S.objects.filter(isHeld).sort((a,b)=>(a.ord||0)-(b.ord||0));
const heldCount = ()=> S.objects.reduce((n,o)=>n+(isHeld(o)?1:0), 0);

/* A drawer holds. A magic drawer collects. Nothing does both.
   An object lives in exactly one drawer — its `parent` — and that is the only
   thing an ordinary drawer shows. A magic drawer ignores parentage entirely and
   shows whatever matches its rule, which is the one way an object appears in
   more than one place at once. */
/* How far a magic drawer can see. A rule with nothing bounding it matches
   across every desk there is, which is right for an inbox and wrong for
   everything else: "anything due this week" on the Exercise desk should not
   answer with a screenplay scene. So a magic drawer collects from its own desk
   unless it says otherwise, and saying otherwise is two values —

     desk   the desk this drawer is on (the default)
     all    every desk there is, which is what an inbox or a Today wants
     some   the desks named in `scopeDesks`

   For a desk that has never been split up this changes nothing: everything is
   on the home desk, so "this desk" and "everywhere" are the same answer. It
   starts mattering the moment you promote a drawer, which is the moment you
   wanted it to. See decision 39. */
function inScope(c, o){
  const f=c.filter||{};
  if(f.scope==='all') return true;
  const want = (f.scope==='some' && (f.scopeDesks||[]).length) ? f.scopeDesks : [deskOf(c)];
  return want.includes(deskOf(o));
}
function inContainer(c,o){
  if(!c || o.id===c.id) return false;
  if(has(c,'magic')){
    const f=c.filter||{};
    /* Before scope, before the archive, before anything: a thing in the
       holding space is off the desk. A magic drawer that collected one would
       put it back on a board it has been deliberately taken off, and then it
       would be in two places — which is the one thing containment promises it
       cannot be. See decision 107. */
    if(isHeld(o)) return false;
    if(!inScope(c,o)) return false;    // before anything else: it cannot see it
    if(f.done) return !!o.done;        // the archive
    if(o.done && !keepsDone(c)) return false;   // finished things leave elsewhere
    // A magic drawer collects objects, not drawers: a rack of drawers appearing
    // inside another drawer is a desk with two of everything on it. The one
    // exception is a face that lays things out in *time*, because a thing that
    // happens on a day is very often a container — a trip holds its plan, a
    // shoot holds its shots — and a calendar that can show neither is a
    // calendar that cannot answer "what is happening that week".
    if(isContainer(o) && !showsContainers(c)) return false;
    if(f.due==='today') return !!o.due && D.parse(o.due)<=D.today();
    /* Loose: on a desk rather than filed in anything. This is what an inbox
       actually is — the things you have made and not yet put away — and it is
       a *rule*, so the inbox collects them where they lie rather than taking
       them. A drawer that swallowed everything you made would file your desk
       for you, which is the one thing the desk is for. */
    if(f.loose && !isDesk(o.parent||ROOT)) return false;
    if(f.tag && !(o.tags||[]).includes(f.tag)) return false;
    if(f.kinds && f.kinds.length && !f.kinds.includes(o.kind)) return false;
    const rs=rulesOf(f);
    if(rs.length && !rs.every(r=>matchRule(o,r))) return false;
    return !!(f.tag || (f.kinds&&f.kinds.length) || rs.length || f.loose);
  }
  if(o.done && !keepsDone(c)) return false;
  return o.parent===c.id;              // an ordinary drawer holds what is filed in it
}
/* ---- clauses ----------------------------------------------------------
   A magic drawer used to carry exactly one `filter.rule`. The shorthands
   already stacked — kinds AND tag AND loose AND the rule — but the *free*
   clause was one, so "due after Monday and before Friday" could not be said,
   and neither could "high priority and has a duration".

   `filter.rules` is an array now, ANDed, capped at RULE_MAX. There is no OR
   and there is not going to be one: an OR needs groups, groups need a rule
   builder, and a rule builder is a query UI — which is the thing
   tags-become-drawers exists to avoid. Two clauses covers what a desk asks.

   `rule` is still read so an old snapshot works before migration 18 runs, and
   so does anything that writes one by hand. See decision 63. */
const RULE_MAX = 3;
const rulesOf = f => {
  const rs = (f && f.rules) || (f && f.rule ? [f.rule] : []);
  return rs.filter(r=>r && r.f);
};
/* One clause: a field, a comparison, a value. Everything a magic drawer can
   ask about an object goes through here. */
const OPS = {is:'is', not:'is not', has:'contains', gt:'after / more than', lt:'before / less than', any:'has any'};
/* A date written into a rule as a fixed day goes stale the morning after, so
   "due this week" would have to be rewritten every Monday. These five words
   are resolved when the rule is *matched* rather than when it is written, so a
   drawer that says "before next week" keeps meaning it. Anything else is read
   as the ISO date it looks like. */
const WHENS = {today:'today', tomorrow:'tomorrow', week:'in a week', month:'in a month', year:'in a year'};
const whenISO = v => {
  const s=String(v??'').trim().toLowerCase();
  if(s==='today') return T;
  if(s==='tomorrow') return D.addISO(T,1);
  if(s==='week') return D.addISO(T,7);
  if(s==='month') return D.addISO(T,30);
  if(s==='year') return D.addISO(T,365);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};
function matchRule(o, r){
  if(!r || !r.f) return true;
  const fld=fieldOf(r.f); if(!fld) return true;
  if(!attrsOf(o).includes(r.f)) return false;      // it hasn't got that field
  /* A repeat is an object, so "contains week" has to compare against how it
     would be *said*; a level is a number, so 0 is a value and not an absence.
     See decisions 72 and 73. */
  const v = fld.type==='repeat' ? (repeatSaid(o)||null)
          : fld.type==='level'  ? prioOf(o)
          : valOf(o, fld.key);
  /* A date is compared as a date. `numOf` strips everything but digits, dots
     and minus signs, so "2026-08-19" came out of it as 2026 — which made every
     "due before" rule an assertion about the year. ISO dates sort as strings,
     which is the whole reason they are stored as strings. */
  if(fld.type==='date' && (r.op==='gt' || r.op==='lt')){
    const a=whenISO(v), b=whenISO(r.v);
    if(!a || !b) return false;
    return r.op==='gt' ? a>b : a<b;
  }
  switch(r.op){
    case 'any':  return Array.isArray(v) ? v.length>0 : v!=null && v!==false;
    case 'is':   return String(v??'')===String(fld.type==='date' ? (whenISO(r.v)??r.v) : r.v ?? '');
    case 'not':  return String(v??'')!==String(fld.type==='date' ? (whenISO(r.v)??r.v) : r.v ?? '');
    case 'has':  return Array.isArray(v) ? v.includes(r.v) : String(v??'').toLowerCase().includes(String(r.v??'').toLowerCase());
    case 'gt':   { const n = fld.type==='level' ? v : numOf(o,fld.key);
                   return n!=null && n>parseFloat(r.v); }
    case 'lt':   { const n = fld.type==='level' ? v : numOf(o,fld.key);
                   return n!=null && n<parseFloat(r.v); }
    default: return true;
  }
}

/* A container can total something across its children — Notion's rollup, kept
   to the handful that answer a real question. */
const ROLLS = {count:'How many', sum:'Total', avg:'Average', min:'Lowest', max:'Highest', done:'Done'};
function rollup(c){
  if(!has(c,'total') && !(c.roll&&c.roll.fn)) return null;
  const r=c.roll; if(!r || !r.fn) return null;
  const kids=childrenOf(c);
  if(r.fn==='count') return String(kids.length);
  if(r.fn==='done'){ const d=kids.filter(x=>x.done).length; return `${d}/${kids.length}`; }
  const fld=fieldOf(r.f); if(!fld) return null;
  const nums=kids.map(x=>numOf(x, fld.key)).filter(n=>n!=null);
  if(!nums.length) return null;
  const money = fld.type==='money';
  const n = r.fn==='sum' ? nums.reduce((a,b)=>a+b,0)
          : r.fn==='avg' ? nums.reduce((a,b)=>a+b,0)/nums.length
          : r.fn==='min' ? Math.min(...nums) : Math.max(...nums);
  const out = Math.round(n*100)/100;
  return money ? (String(kids.find(x=>valOf(x,fld.key))?.[fld.key]||'').replace(/[\d.,\s-]/g,'')||'') + out : String(out);
}

/* Children, in whatever order the container is sorted by. */
/* Each also carries the mark the shelf button wears, because the sort is a
   toggle you cycle rather than a menu you open — so the button has to say which
   of the seven it is on in one glyph. A letter where a letter is the answer
   (Manual, A–Z, Z–A) and an arrow where a direction is (made and modified,
   each way). SORT_CYCLE is the order the button steps through. */
const SORTS = {
  az:       ['Alphabetical, A–Z',      (a,b)=>(a.title||'').localeCompare(b.title||''),                                 'A'],
  za:       ['Alphabetical, Z–A',      (a,b)=>(b.title||'').localeCompare(a.title||''),                                 'Z'],
  /* Most important first, which is the sort a ranking exists for. Anything
     without a priority sorts to the bottom rather than to zero — "not ranked"
     and "not now" are different answers and 0 is a real one. */
  prio:     ['Most important first', (a,b)=>((prioOf(b)??-1)-(prioOf(a)??-1)),                          'arrowU'],
  prioup:   ['Least important first',(a,b)=>((prioOf(a)??99)-(prioOf(b)??99)),                          'arrowD'],
  made:     ['Newest made first',      (a,b)=>(b.created||'').localeCompare(a.created||''),                             'arrowR'],
  madeup:   ['Oldest made first',      (a,b)=>(a.created||'').localeCompare(b.created||''),                             'arrowL'],
  edited:   ['Newest changed first',   (a,b)=>(b.edited||b.created||'').localeCompare(a.edited||a.created||''),         'arrowU'],
  editedup: ['Oldest changed first',   (a,b)=>(a.edited||a.created||'').localeCompare(b.edited||b.created||''),         'arrowD']
};
/* A sort is per object then per type, exactly like a face, a layout or a
   colour — so a Shopping list can be born alphabetical while the Drawer type
   stays as you arranged it. `manual` is an explicit "leave it where I put it",
   which is what lets one container refuse a type that sorts; a container that
   says nothing follows its type, and a type that says nothing is manual.
   Manual is the answer for a drawer, and deliberately so: a grid is a place. */
const MANUAL = 'manual';
const sortOf = c => { const v=(c && c.sort) || K(c&&c.kind).sort || MANUAL;
  return SORTS[v] ? v : null; };
/* ---- what a container shows, and the one place it is worth remembering ----
   `childrenOf()` walks **every object in the desk** and asks inContainer() about
   each — which for a magic drawer means running its rule — and then sorts what
   is left. That is the right shape for a question that has to be able to change
   its mind, and it is fine once. Drawing one board asks it once for the board
   and then again for every container on it: a checklist lists its lines, a
   moodboard its pictures, a calendar walks its days, and `projectStat()` walks
   an entire subtree calling it at every level. Fifty calls over two hundred
   objects is ten thousand rule evaluations to draw one screen, and the pager
   draws three of them.

   So a **pass** may remember. `beginPass()` opens the memo and `endPass()`
   closes it, and it is only ever open for the length of one synchronous string
   build — viewHTML() and previewHTML() are the two, and nothing mutates
   membership inside either. Outside a pass the map is null and every call is
   the honest walk it always was, which is what keeps this from being a cache
   that can be wrong. Placing a box during a pass is fine: ensureBox() changes
   where a thing sits, never which container it is in. */
let KIDS = null;
const beginPass = ()=>{ KIDS = new Map(); };
const endPass   = ()=>{ KIDS = null; };
function childrenOf(c){
  if(!c) return [];
  if(KIDS){ const hit=KIDS.get(c.id); if(hit) return hit; }
  const list = S.objects.filter(o=>inContainer(c,o));
  const s = SORTS[sortOf(c)];
  list.sort(s ? s[1] : (a,b)=>(a.ord||0)-(b.ord||0));
  if(KIDS) KIDS.set(c.id, list);
  return list;
}
// Guard against a container being dragged inside itself — with recursion this
// is a real way to lose a subtree, not a theoretical one.
function isAncestor(maybeAncestor, o){
  let p = o && o.parent, n = 0;
  while(p && p!==ROOT && n++ < 100){
    if(p===maybeAncestor) return true;
    const up = byId(p); p = up && up.parent;
  }
  return false;
}
// Breadcrumb chain from the desk down to this container.
/* Relations point both ways without being stored twice: A lists B, and B's
   backlinks are found by asking who points at B. */
const relatedTo = o => (o&&o.rel||[]).map(byId).filter(Boolean);
const backlinksTo = id => S.objects.filter(o=>(o.rel||[]).includes(id));
function relate(aId,bId){
  const a=byId(aId); if(!a||aId===bId) return;
  a.rel=a.rel||[]; if(!a.rel.includes(bId)) a.rel.push(bId);
}
function unrelate(aId,bId){
  const a=byId(aId); if(!a||!a.rel) return;
  a.rel=a.rel.filter(x=>x!==bId);
}
/* The breadcrumb, from the desk you are on down to here. It stops at the desk
   rather than walking all the way to the root, because a desk is somewhere you
   *are*: "Finance › Bills" is where you are, and "Desk › Finance › Bills" is a
   path back to a house you have not lived in since there was more than one. */
function chainOf(id){
  const out=[]; let o=byId(id), n=0;
  while(o && n++ < 100){
    out.unshift(o);
    if(isDesk(o.id)) break;
    o = o.parent&&o.parent!==ROOT ? byId(o.parent) : null;
  }
  return out;
}

/* ---- a thing that lasts more than a day -------------------------------
   `date` is the day something falls on. A trip, a shoot week or a term does
   not fall on a day, it *occupies* days — and the difference is not cosmetic:
   a calendar has to mark all of them, a timeline has to draw a bar rather than
   a dot, and dragging one to a new day has to carry its length with it.

   So `span` is an attribute of its own rather than a second meaning for
   `date`: it needs a date to start from, everything dated does not last, and
   an attribute is the only thing in Bureau that a type can be given without
   anything being told about it. `till` is the last day, inclusive — a trip
   from the 4th to the 11th is on the desk on the 11th. */
function spanOf(o){
  if(!o || !has(o,'span') || !o.due || !o.till) return null;
  if(o.till < o.due) return null;               // ISO strings sort as dates
  return {from:o.due, to:o.till,
          days:Math.round((D.parse(o.till)-D.parse(o.due))/864e5)+1};
}
// every day a thing sits on: the span if it has one, otherwise the one day
const coversDay = (o, iso) => { const s=spanOf(o);
  return s ? (iso>=s.from && iso<=s.to) : o.due===iso; };
const lastDay = o => { const s=spanOf(o); return s ? s.to : (o&&o.due)||null; };

/* ---- when it sits, and when it is late --------------------------------
   Two different facts, and for a long time `due` was carrying both. It still
   answers the first — the day a thing is drawn on, the day Today collects it,
   the day a drag onto a calendar cell writes. `dead` answers the second, and
   only for something carrying the attribute.

   `lateOn(o)` is which of them decides lateness: the deadline when there is
   one, otherwise the day it sits on, which is what everything did before this
   existed. So nothing already on a desk changes, and the moment you give
   something a deadline the two questions come apart: a task put on Monday with
   a deadline of Friday is not late on Tuesday, and it used to be.

   A thing that is finished is never late. See decision 62. */
const lateOn = o => {
  if(!o || o.done) return null;
  if(has(o,'deadline') && o.dead) return o.dead;
  return lastDay(o);
};
const isLate = o => { const d=lateOn(o); return !!d && D.overdue(d); };

/* ---- locked is one switch, not one per board --------------------------
   Every container carried its own `locked`, and the padlock in the bar toggled
   whichever board you were standing on. In principle that is the same shape as
   every other setting in Bureau — per object, then per type. In practice a lock
   is not a property of a board, it is a **mode you are in**: you are either
   reading your desks or arranging them, and having to unlock each drawer as you
   walk into it is the arrange-mode-by-another-name that decision 19 refused.

   So it is one switch. `S.look.locked`, default locked, because a desk you have
   arranged is one you want to look at — and on a locked board one finger walks
   the boards, which is the gesture a phone is actually for.

   Per-board `locked` is deleted by migration 22 and read by nothing.
   See decision 74. */
const boardLocked = ()=> S.look.locked !== false;

/* ---- the box at the top of a container that takes dictation ------------
   `takesTyping(c)` says a container *can* be typed into; `showsAddBox(c, box)`
   says whether the box is drawn on its **front**. It is off unless asked for:
   a checklist face spends a whole task-sized line on the box (decision 79),
   so the default is every line showing a task and `addbox:'show'` is the
   opt-in. Even asked for, it goes by itself at two cells tall or less — there
   the line is worth more as an item. Automatic, so nobody has to notice.

   Inside the container the box is always there — that board has room, and it is
   the only way in for a magic one. See decision 77. */
const showsAddBox = (c, box)=>
  takesTyping(c) && c.addbox==='show' && !(box && box.h<=2);

/* ---- how much it matters, 0 to 5 --------------------------------------
   Priority was three words — low, mid, high — which is a shape you outgrow the
   moment you have more than a handful of important things, because "high" stops
   telling you which high thing to do. A ranking does: six levels, and what each
   one means is stated rather than left to the reader.

   It is about **how much it matters to you**, not how urgent it is. Urgency is
   a deadline coming up, and that is `deadline`'s job (decision 62) — the two
   are different questions and an app that folds them together makes you answer
   neither. 0 is the interesting end: a thing you want to keep but do not want
   to act on, which every list app makes you either delete or feel bad about.

   Stored as a **number**, and 0 is a real answer, so read it with `prioOf(o)`
   and check for `null` — `o.prio || 5` would turn "not now" into "the one".
   See decision 72. */
const PRIOS = [
  [0, 'Not now',      'a dream — nothing to act on yet'],
  [1, 'Barely',       'barely a task; the least of it'],
  [2, 'Taking hold',  'starting to take precedence'],
  [3, 'Decent',       'worth an afternoon'],
  [4, 'Important',    'solidly important'],
  [5, 'The one',      'the most important thing in the docket']
];
const prioOf = o => {
  if(!o || !has(o,'priority')) return null;
  const v = o.prio;
  if(v==null || v==='') return null;
  const n = Number(v);
  return isNaN(n) ? null : clamp(Math.round(n), 0, 5);
};
const prioName = n => (PRIOS.find(p=>p[0]===n)||[])[1] || '';

/* ============================================================
   2c · repeating — a rule, not a word
   ============================================================
   `repeat` was one of four words: daily, weekdays, weekly, monthly. Anything
   else — every three days, the first Monday, three days *after I finish it* —
   could not be said at all.

   It is an object now:

     {every, unit, days, from, ends, paused, made}

     every   a number: every 2 weeks
     unit    day | week | month | year
     days    weekday numbers (0=Sun), `unit:'week'` only. Empty means "the
             weekday the date already falls on"
     from    'date' — a fixed schedule, counted from the day it was due
             'done' — counted from the day you actually finished it
     ends    null, {on:iso} or {after:n}
     paused  it keeps its rule and stops producing
     made    how many it has produced, for `ends.after`

   **`from` is the one that matters**, and it is the change Things 3.23 shipped
   after years of people asking. "Every week" and "a week after I finish it" are
   different promises: the bins go out on Tuesday whether or not you did it last
   Tuesday, and you water the plant a week after you last watered it. A single
   fixed schedule makes the second one a lie that accumulates.

   Bureau already had the better half of this and keeps it: completing a
   repeating thing **spawns a fresh object** at the next date and turns the
   original into a record, so eleven waterings are eleven dated things rather
   than one counter (decision 5). Which means "complete it early" needs no
   special case at all — the tick is the tick, and the next one is made from the
   rule from wherever you are.

   A string is still read, so nothing written before migration 22 breaks.
   See decision 73. */
const REPEAT_UNITS = [['day','days'],['week','weeks'],['month','months'],['year','years']];
const LEGACY_REPEAT = {
  daily:    {every:1, unit:'day',  from:'date'},
  weekly:   {every:1, unit:'week', from:'date'},
  monthly:  {every:1, unit:'month',from:'date'},
  yearly:   {every:1, unit:'year', from:'date'},
  weekdays: {every:1, unit:'week', days:[1,2,3,4,5], from:'date'}
};
function repeatOf(o){
  const r = o && o.repeat;
  if(!r) return null;
  if(typeof r === 'string'){
    const l = LEGACY_REPEAT[r];
    return l ? Object.assign({days:[], ends:null, paused:false, made:0}, l) : null;
  }
  if(typeof r !== 'object' || !r.unit) return null;
  return Object.assign({every:1, unit:'day', days:[], from:'date', ends:null,
                        paused:false, made:0}, r);
}
const repeats = o => !!repeatOf(o);
/* Said the way you would say it, which is also what a magic drawer matches on
   when it is asked whether something "contains week". */
function repeatSaid(o){
  const r=repeatOf(o); if(!r) return '';
  const DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const unit=(REPEAT_UNITS.find(u=>u[0]===r.unit)||['day','days']);
  const n = r.every>1 ? `every ${r.every} ${unit[1]}` : `every ${unit[0]}`;
  let out = r.from==='done' ? `${r.every||1} ${r.every>1?unit[1]:unit[0]} after it is done` : n;
  if(r.unit==='week' && (r.days||[]).length){
    const d=r.days.slice().sort();
    out = d.length===5 && d.join()==='1,2,3,4,5' ? (r.every>1?`${n}, weekdays`:'every weekday')
        : `${n} on ${d.map(x=>DOW[x]).join(', ')}`;
  }
  if(r.ends && r.ends.on) out += `, until ${r.ends.on}`;
  if(r.ends && r.ends.after) out += `, ${r.ends.after} times`;
  if(r.paused) out += ' (paused)';
  return out;
}
/* Has it produced everything it was going to? A rule that has run out keeps its
   shape — you can see what it was and start it again — it just stops making. */
function repeatSpent(r, madeNow){
  if(!r || !r.ends) return false;
  if(r.ends.after) return (madeNow!=null?madeNow:(r.made||0)) >= r.ends.after;
  return false;
}
/* The next day this should fall on. `from` decides what it counts from: a fixed
   schedule counts from the day it was due, so a week of not doing it does not
   push the bins to Thursday; an after-completion rule counts from today, which
   is the day you actually finished it. */
function nextRepeat(o, doneOn){
  const r=repeatOf(o); if(!r || r.paused) return null;
  if(repeatSpent(r)) return null;
  const base = r.from==='done' ? (doneOn || T) : (o.due || doneOn || T);
  const every = Math.max(1, Math.round(r.every||1));
  let iso;
  if(r.unit==='week' && (r.days||[]).length && r.from!=='done'){
    /* A set of weekdays: step one day at a time to the next one that is named,
       and only jump the extra weeks once the week itself has turned over. */
    const days=r.days.slice().sort((a,b)=>a-b);
    let d=D.add(D.parse(base), 1), guard=0;
    while(!days.includes(d.getDay()) && guard++ < 400) d=D.add(d,1);
    if(every>1 && d.getDay() <= days[0]) d=D.add(d, 7*(every-1));
    iso=D.iso(d);
  } else if(r.unit==='day'){
    iso = D.addISO(base, every);
  } else if(r.unit==='week'){
    iso = D.addISO(base, 7*every);
  } else {
    const d=D.parse(base), day=d.getDate();
    if(r.unit==='month') d.setMonth(d.getMonth()+every);
    else d.setFullYear(d.getFullYear()+every);
    // 31 January + one month is 28 February, not 3 March
    if(d.getDate()!==day) d.setDate(0);
    iso=D.iso(d);
  }
  if(r.ends && r.ends.on && iso > r.ends.on) return null;
  return iso;
}

/* A timeline's axis, as two dates. Read from what it holds — but an empty
   timeline, or one where everything happened on a Tuesday, has no span to
   measure a drop against, so it opens out to four weeks either side. A timeline
   you cannot drop anything on is a timeline you could never have started. */
const TL_MIN_DAYS = 28;
function tlSpan(c){
  // both ends of everything, so a trip's last day is inside the axis too
  const ds=childrenOf(c).flatMap(x=>[x.due||x.created, lastDay(x)]).filter(Boolean).sort();
  const lo=ds.length?D.parse(ds[0]):D.today(), hi=ds.length?D.parse(ds[ds.length-1]):D.today();
  const days=Math.round((hi-lo)/864e5);
  if(days>=TL_MIN_DAYS) return {min:D.iso(lo), max:D.iso(hi), days};
  const pad=Math.ceil((TL_MIN_DAYS-days)/2);
  return {min:D.iso(D.add(lo,-pad)), max:D.iso(D.add(hi,pad)), days:days+pad*2};
}

function streak(o){
  const set=new Set(o.history||[]); let n=0, d=D.today();
  if(!set.has(D.iso(d))) d=D.add(d,-1);
  while(set.has(D.iso(d))){ n++; d=D.add(d,-1); }
  return n;
}
const goalPct = o => !o.milestones||!o.milestones.length ? 0 : Math.round(100*o.milestones.filter(m=>m.done).length/o.milestones.length);

/* Everything under a container, however deep. A project is made of checklists
   as often as of loose tasks, so counting only its direct children would report
   a project of four full checklists as nothing done at all. Guarded against the
   cycle a reparenting bug could still introduce, and against a magic container
   collecting its own ancestor. */
function allUnder(c, seen){
  seen = seen || new Set([c && c.id]);
  const out=[];
  childrenOf(c).forEach(o=>{
    if(seen.has(o.id)) return;
    seen.add(o.id);
    out.push(o);
    if(isContainer(o)) out.push(...allUnder(o, seen));
  });
  return out;
}
/* How far along a thing is. An object with milestones is its milestones. A
   container is what it holds — every tickable thing under it — because that is
   the number you actually want off the front of a project, and it falls back to
   its own milestones when it holds nothing tickable yet. */
function progressOf(o){
  if(!o) return 0;
  if(isContainer(o)){
    const ticks = allUnder(o).filter(x=>has(x,'check'));
    if(ticks.length) return Math.round(100*ticks.filter(x=>x.done).length/ticks.length);
  }
  return goalPct(o);
}
/* What a container holds, counted by type, and the next thing due in it. Both
   are read off the same walk, because a project's front asks for both at once. */
function projectStat(c){
  const all = allUnder(c);
  const ticks = all.filter(x=>has(x,'check'));
  const byKind = {};
  all.forEach(x=>{ byKind[x.kind]=(byKind[x.kind]||0)+1; });
  /* What is coming up, soonest first. This is the question a project is asked
     from across the desk, and it is a different question from a checklist's
     "what is in here" — so the front shows the next few dated things rather
     than the first few things of any sort. Undated work is not *up next*, it is
     just work, and it stays in the count instead. */
  const soon = all.filter(x=>x.due && !x.done)
    .sort((a,b)=>a.due.localeCompare(b.due));
  const cover = (c.media&&c.media.src) || (all.find(x=>x.media&&x.media.src)||{}).media?.src || null;
  return {n:all.length, done:ticks.filter(x=>x.done).length, ticks:ticks.length,
          pct:progressOf(c), next:(soon[0]||{}).due||null, soon, cover,
          kinds:Object.entries(byKind).sort((a,b)=>b[1]-a[1])};
}
const allTags = ()=>{ const m={}; S.objects.forEach(o=>(o.tags||[]).forEach(t=>m[t]=(m[t]||0)+1)); return Object.entries(m).sort((a,b)=>b[1]-a[1]); };

export { ATTRS, FIELDS, fieldOf, USER_ATTRS, KINDS, KEYS, refreshKinds, K,
  attrsOf, has, kindHas, T, dz, S, sensedDevice, reset, defaultLook, dev, byId,
  deskTitle, rootObj, container, cfgOf, isContainer, FACES, faceOf, layoutOf, SHAPES,
  shapeOf, READS, readOf, spreadOf, OPENINGS, openingOf, gathersOf, gatherKind, containers,
  deskIds, deskList, isDesk, deskOf, deskHere,
  placeOf, isHeld, heldObjects, heldCount,
  spanOf, coversDay, lastDay, lateOn, isLate,
  boardLocked,
  PRIOS, prioOf, prioName,
  REPEAT_UNITS, repeatOf, repeats, repeatSaid, repeatSpent, nextRepeat,
  slotKey, slotFrom, slotRaw, slotSrc,
  BINDINGS, BINDING_SLOTS, bindingOf, PANELS, PANEL_SLOTS, panelOf, KNOBS, KNOB_SLOTS, knobOf,
  BORDER_SLOTS, borderOf, TEXTURE_SLOTS, textureOf, STOCKS, STOCK_SLOTS, stockOf,
  KNOBSIZES, knobSizeOf, answered, iconOf, TSIZES, textSizeOf, mediaTypeOf, isPicture,
  isMedia, isPlayable, acceptFor, isDecor,
  spawnByOf, genKindOf, takesTyping, showsAddBox, keepsDone, showsContainers,
  CALVIEWS, calViewOf, weekStartOf, showsWeekends, calCols,
  OPS, WHENS, whenISO, RULE_MAX, rulesOf, matchRule,
  ROLLS, rollup, SORTS, MANUAL, sortOf, childrenOf, beginPass, endPass, isAncestor,
  relatedTo, backlinksTo, relate, unrelate, chainOf, tlSpan, streak, goalPct,
  allUnder, progressOf, projectStat, allTags };
