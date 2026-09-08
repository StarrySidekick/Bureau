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
  deadline: {nm:'Hard deadline', ds:'The day missing it costs something — separate from the day you have put it on'},
  /* The other half of the same fact. A hard deadline is imposed and has
     consequences; a soft one is a day you give *yourself* so the work gets done
     reasonably, and nothing happens if it slips. Both at once is the ordinary
     case — aim for Friday, owed on Monday — which is why they are two fields
     and not one field with a switch. See decision 120. */
  softdeadline:{nm:'Soft deadline', ds:'The day you mean to be done — a date you set yourself, with no consequence attached'},
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
  duration: {nm:'Duration',   ds:'How long it will probably take, in minutes — half of what makes it urgent'},
  /* The third axis, and the one neither of the others can stand in for. A
     thing can be quick and hard (a difficult phone call) or long and easy
     (painting a fence), and importance says nothing about either. It feeds
     nothing automatically — urgency is time against time — because how hard a
     thing is changes whether you *start* it, not when it is owed. */
  difficulty:{nm:'Difficulty', ds:'How hard it is, 1 to 5 — not how long it takes and not how much it matters'},
  priority: {nm:'Priority',   ds:'How much it matters to you — 0 to 5, not how urgent it is'},
  price:    {nm:'Price',      ds:'What it costs'},
  answer:   {nm:'Answerable', ds:'A box to answer it in — filled means answered'},
  /* The margin. A paper file accumulates by having things added to it: you do
     not rewrite the letter, you write in the margin and date it. `text` is the
     document and is edited; this is the running note beside it and is only ever
     appended to. Two different things, which is why it is a second attribute
     rather than more room in the body. Kept as a list so the order and the days
     survive; nothing here is editable once written, because a margin you can go
     back and tidy is just the body again. */
  margin:   {nm:'Margin',     ds:'A running note you add to, each entry dated — never rewritten'},
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
  /* The one thing on the board that is about the *desk* rather than about
     anything on it. A control is a switch for one of the desk's own settings —
     the lock, the shadows, the aesthetic — sitting on the grid like a light
     switch on a wall rather than three doors deep in Settings. It was an
     attribute once, was stripped out by migration 14 because nothing drew it,
     and comes back here with a table behind it (`CONTROLS` in mutations.js).
     See decision 132. */
  control:  {nm:'Control',    ds:'A switch on the board for one of the desk\'s own settings'},
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
  softdeadline:{key:'soft', type:'date',  nm:'Aim for'},
  span:     {key:'till',   type:'date',   nm:'Runs until'},
  repeat:   {key:'repeat', type:'repeat', nm:'Repeats'},
  link:     {key:'url',    type:'text',   nm:'Link'},
  count:    {key:'count',  type:'number', nm:'Count'},
  rating:   {key:'rating', type:'number', nm:'Rating'},
  location: {key:'loc',    type:'text',   nm:'Location'},
  duration: {key:'dur',    type:'number', nm:'Duration'},
  priority: {key:'prio',   type:'level',  nm:'Priority', opts:[0,1,2,3,4,5], get:o=>prioOf(o)},
  difficulty:{key:'diff',  type:'level',  nm:'Difficulty', opts:[1,2,3,4,5], get:o=>diffOf(o)},
  price:    {key:'price',  type:'money',  nm:'Price'},
  answer:   {key:'answer', type:'text',   nm:'Answer'},
  relates:  {key:'rel',    type:'refs',   nm:'Related'},
  /* The one field nothing stores. Urgency is a deadline and an estimate put
     together, so it is *derived* — there is no `urg` on any object and no way
     to set one, and `derived` is what tells matchRule to skip the "has it got
     that trait" test and ask the reader instead. It is in this table rather
     than beside it so a magic drawer's field picker gets it for nothing.
     See decision 120. */
  urgency:  {key:'urg',    type:'level',  nm:'Urgency', opts:[0,1,2,3,4], derived:true, get:o=>urgeRank(o)},
  /* ---- what a thing *is*, as against what it carries -------------------
     Everything above is a **trait's field**: a rule about `duration` only ever
     answers for something carrying `duration`, which is right for a field and
     useless for the questions you actually ask a sorting drawer. "Tasks due
     this week that are inside the film" is three clauses and two of them are
     not fields at all — one is the type and one is where the thing lives.

     So: **meta fields**, marked `meta`. They are read off every object rather
     than gated on a trait (the same exemption `derived` already has), they are
     named with an `@` so they can never collide with an attribute, and they
     carry `pick` so the rule builder knows to offer a list rather than a box
     to type in. Adding another is one row here and nothing anywhere else.

     `@under` is the one that makes the example work: a chain of parents rather
     than one, so "anywhere inside the film" collects a task filed in a
     checklist filed in a shot list filed in the film. It walks `parent` by
     hand rather than asking childrenOf(), because childrenOf() runs magic
     rules and a rule that ran rules would be a rule calling itself.
     See decision 151. */
  '@kind':  {key:'kind',   type:'text', nm:'Type',              meta:true, pick:'kinds',  get:o=>o.kind},
  '@in':    {key:'parent', type:'text', nm:'Filed in',          meta:true, pick:'conts',  get:o=>o.parent||ROOT},
  '@under': {key:'parent', type:'text', nm:'Anywhere inside',   meta:true, pick:'conts',  list:true, get:o=>ancestorIds(o)},
  '@tag':   {key:'tags',   type:'text', nm:'Tag',               meta:true, pick:'tags',   list:true, get:o=>o.tags||[]},
  '@trait': {key:'attrs',  type:'text', nm:'Carries the trait', meta:true, pick:'attrs',  list:true, get:o=>attrsOf(o)},
  '@title': {key:'title',  type:'text', nm:'Name',              meta:true, get:o=>o.title||''},
  '@body':  {key:'body',   type:'text', nm:'Words',             meta:true, get:o=>o.body||''},
  '@done':  {key:'done',   type:'bool', nm:'Finished',          meta:true, pick:'yesno',  get:o=>!!o.done},
  '@made':  {key:'created',type:'date', nm:'Made on',           meta:true, get:o=>o.created||null},
  '@holds': {key:'holds',  type:'number', nm:'Things filed in it', meta:true,
             get:o=>S.objects.filter(x=>x.parent===o.id).length},
  '@colour':{key:'c',      type:'text', nm:'Colour slot',       meta:true, get:o=>o.c==null?'':String(o.c)}
};
/* Every container a thing is inside, innermost first. Bounded, because a
   filing cycle would otherwise hang the app on the first render. */
function ancestorIds(o){
  const out=[]; let at=o && o.parent;
  for(let i=0;i<32 && at && at!==ROOT;i++){ out.push(at); const p=upOf(at); at = p && p.parent; }
  out.push(ROOT);
  return out;
}
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
  /* The drawer that collects instead of holding. It was called a *magic*
     drawer, which named the mechanism rather than the job — what you actually
     reach for it to do is sort the desk by a tag, so it is a **sorting
     drawer** in the interface and `magic` in the code, exactly as a container
     is a "drawer" in the interface and `container` in the code. The stored
     kind key does not change, so nothing needs migrating.

     `asksTag` is the other half: a sorting drawer with no rule collects
     nothing and reads as broken, so placing one asks which tag it is for
     *before* it exists rather than leaving you to find the rule builder.
     See decision 131. */
  magic:   {nm:'Sorting drawer', ic:'sparkle', c:10, key:'Q', ds:'Collects by a rule instead of holding — pick the tag it sorts for', attrs:['container','magic'], layout:'grid', size:[2,2], phoneSize:[2,2], asksTag:true, body:'' },
  /* The third drawer. A project is a piece of work and it finishes; a **life
     drawer** is an area of your life and it does not — money, health, the
     people in it — so it reports what is in it and what is next and draws no
     percentage, because a bar at 60% against "Family" is a nonsense. Same
     machinery as a project with the one thing taken off that would lie.
     See decision 131. */
  life:    {face:'life', nm:'Life drawer', ic:'target', c:12, key:'L', ds:'A part of your life rather than a piece of work — it is never finished',
     attrs:['text','container','relates'], asksLife:true,
     seed:[{kind:'generator', title:'Add to this…', sz:[8,2]}],
     layout:'grid', size:[5,5], phoneSize:[4,4], body:'' },
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
  /* **Book** is the category for anything made of words that you would keep
     rather than read once: a story, a novel, a notebook, a list you read.
     Story, Novel and Short story are still here behind the dropdown — they are
     this with a binding and a body template — but a book you just want is a
     book, and having to decide whether the thing you are starting is a novel
     is a decision nobody has at that moment. It is a container, so it holds
     the pieces it is made of, and it opens as a book both ways round:
     `layout:'book'` pages through what it holds and `read:'book'` pages
     through its own body. See decision 130. */
  book:    {face:'spine', binding:'banded', nm:'Prose & Poetry', ic:'book', c:11, key:'B',
     ds:'Anything made of words — press it and say which',
     family:['book','poem','novel','shortstory','essay','script'], famSub:'What are you writing?',
     attrs:['text','container','relates'], layout:'book', read:'book',
     size:[3,9], phoneSize:[2,6], body:'' },
  /* A control is a switch for one of the desk's own settings, on the board.
     `ctl` names which setting; CONTROLS in mutations.js is the table of them
     and the only thing that knows how each is read and flipped. Pressing it is
     a click action like any other (`toggle`), not a branch on a kind's name.
     See decision 132. */
  control: {shape:'switch', nm:'Control',  ic:'sliders', c:15, key:'-', ds:'A switch on the board for one of the desk\'s own settings', attrs:['control'], ctl:'lock', onclick:'toggle', size:[4,2], phoneSize:[4,2], body:'' },
  /* A task opens onto **When** — the dates, the estimate, the ranks, the
     repeat and the tags. It was `none` for a long time and that was right when
     tapping meant the object editor, which is a page of look and structure a
     task has no use for. It is not right once there is a page that answers
     the question you have every single time you look at one. See decision 123. */
  /* `repeat` came off the default set: it is offered in the When page beside
     the deadlines, the estimate and the ranks, and a Repeats section standing
     open on every task that will never repeat is six rows of furniture. Every
     task that *has* a rule keeps the trait — migration 25 puts it on their own
     attrs, because the ability to repeat is not something to take away from a
     thing that is already doing it. */
  task:    {shape:'sliver', nm:'Task',    ic:'check',   c:6, key:'T', ds:'A thing to do',             attrs:['text','check','date'], size:[4,1], onclick:'when', gathers:'checklist', body:'' },
  note:    {shape:'note', nm:'Note',    ic:'note',    c:10, key:'O', ds:'Something to remember — press it and say which',
     /* Quote is one of these: it is somebody's words written down, which is the
        same act as the other five with the authorship changed. */
     family:['note','idea','thought','problem','question','quote'], famSub:'What sort of thing is it?',
     attrs:['text'], size:[4,4], onclick:'read', body:'' },
  idea:    {shape:'idea', nm:'Idea',    ic:'bulb',    c:12, key:'I', ds:'A spark, unformed',         size:[4,4], onclick:'read', attrs:['text'], body:'**The spark —** \n\n**Why it might work —** \n\n**What it needs —** ' },
  /* The smallest of the writing types, and deliberately so. An idea is a
     spark you might build on and has three prompts to fill in; a **thought**
     is the thing that crossed your mind on the stairs, and the whole value of
     one is that writing it down costs nothing. So it is a torn chit two cells
     tall with an empty body and no template to fill in — anything more and you
     stop bothering, which is the only way this type fails. See decision 130. */
  thought: {shape:'rounded', nm:'Thought',  ic:'bulb',    c:14, key:'+', ds:'Something that crossed your mind, before it goes', size:[4,2], onclick:'read', attrs:['text'], body:'' },
  /* A question is open until you have *written* the answer; a **problem** is
     open until you have done something about it. Same `answer` machinery —
     the box on the front, `answered()` — because both are resolved by writing
     rather than by ticking, and a problem ticked off with nothing said about
     it teaches you nothing the next time. It carries `difficulty` and
     `priority` because how hard a problem is to start, and how much it
     actually matters, are between them most of what decides whether you ever
     get to it. See decision 130. */
  problem: {shape:'index', nm:'Problem', ic:'help',    c:8,  key:'*', ds:'Something in the way — open until you have written what you did about it', size:[5,4], onclick:'read', attrs:['text','answer','difficulty','priority'],
            body:'**What is wrong —** \n\n**Why it matters —** \n\n**What I have tried —** ' },
  outline: {narrative:true, nm:'Outline', ic:'list',    c:14, ds:'Structure before prose',    size:[4,4], onclick:'read', attrs:['text'], body:'## I.\n- \n- \n\n## II.\n- \n- \n\n## III.\n- ' },
  // A recipe holds its ingredients rather than listing them in prose, so they
  // can be ticked while you cook and totalled before you shop. The method stays
  // in the body, which a container with `text` shows above what it holds.
  /* A **recipe is an index card**, and it holds nothing. It was a container
     with a checklist face whose only member type was Ingredient — and with
     Ingredient gone there is nothing for it to hold, so what is left is the
     card you write the thing on: three by two, ruled, with the method on it.
     Anything you want to tick off it is a task, like everything else. */
  recipe:  {shape:'index', nm:'Recipe',  ic:'pot',     c:11, key:'R', ds:'What goes in it, and how',    size:[3,2], onclick:'read', attrs:['text'], body:'**Serves** 2 · **Time** 30 min\n\n## Method\n1. \n2. \n3. ' },
  script:  {shape:'page', nm:'Script',  ic:'clapper', c:9, key:'S', ds:'Scenes and dialogue',       size:[4,4], onclick:'read', attrs:['text'], body:'### INT. LOCATION — DAY\n\nAction line.\n\n**CHARACTER**\nDialogue.' },
  /* Open until answered — and answering it is writing the answer down, not
     ticking a box. A tick says "dealt with"; a question wants the thing you
     worked out, and having it on the front is the whole value of keeping one. */
  question:{shape:'bubble', nm:'Question',ic:'help',    c:10, key:'?', ds:'Open until you have written the answer', size:[4,4], onclick:'read', attrs:['text','answer'], body:'**What I know —** \n\n' },
  essay:   {shape:'note', nm:'Essay',   ic:'feather', c:7, key:'Y', ds:'Long-form writing',         size:[4,4], onclick:'read', attrs:['text'], body:'> Working thesis.\n\n' },
  /* A **goal** is a thing you are trying to reach, and it is made of the work
     that gets you there — so it holds that work rather than describing it. Its
     front is a drawer with the knob taken off and the name set as large as the
     frame allows, because on a goal the name *is* the face: "Lose 25 pounds"
     needs nothing else printed on it.

     What it is *called* is read off the time on it rather than stored — no
     deadline and it is a **dream**, barely enough time and it is a
     **challenge**, and the same object walks between the three as its dates
     move. Three stored types would have made you re-declare a dream as a goal
     the day you finally put a date on it. See decision 135. */
  goal:    {face:'goal', nm:'Goal', ic:'target', c:13, key:'E',
     ds:'Something you are trying to reach, and the work that gets you there',
     attrs:['text','container','date','deadline','progress','relates'],
     seed:[{kind:'generator', title:'What gets you there…', sz:[8,2]}],
     /* **A playing card, laid on its side.** Three by two is the proportion a
        card has when you put it down on a table rather than hold it, which is
        what a goal on a desk is. See the goal tile in tiles.js. */
     layout:'grid', size:[6,4], phoneSize:[3,2], body:'' },
  /* A **progress bar** is a goal with the goal taken out of it. A goal is a
     thing you are trying to reach and its milestones belong to it; a progress
     bar is a *readout*, and the thing it reads is very often somewhere else —
     the project two desks over, the habit you have been keeping. `tracks`
     names that object and `barPct()` reads it: a container reports how much of
     it is ticked, a habit reports its streak against `target` days, and with
     nothing tracked it falls back to its own milestones and is a goal again.
     Two cells tall, because a bar with a name over it is all there is to draw.
     See decision 133. */
  progressbar:{shape:'bar', nm:'Progress bar', ic:'bar', c:13, key:'J', ds:'How far along something is — its own milestones, or another object\'s',
     attrs:['text','progress'], size:[5,1], phoneSize:[5,1], onclick:'read', target:30, steps:10, body:'' },
  image:   {nm:'Image',   ic:'image',   c:15, key:'G', ds:'A picture on the board',   size:[6,4], onclick:'read', attrs:['media'], body:'' },
  /* A window is an Image that admits there is somewhere on the other side of
     it. Same attribute, same surface, same file — what differs is that the
     frame is *in front of* the picture rather than around it, so the view
     behind it moves when you tilt the phone and the frame does not. See
     decision 113. */
  window:  {nm:'Window',  ic:'image',   c:9,  ds:'A view, framed',          size:[5,4], onclick:'read', attrs:['media'], mediaType:'image', frame:'cross', body:'' },
  /* Something standing on the shelf rather than filed on it. It carries
     `media` like a picture — you can put your own cut-out PNG or SVG on the
     desk — and ships with ten of its own, drawn in the style's colours. */
  /* A **window** is a decoration: it is a thing you hang on the wall of the
     shelf, and its whole difference from an ornament is that you can see
     through it. One press in from Decoration rather than a tile of its own in
     a list that is already long. */
  decoration:{shape:'decor', nm:'Decoration', ic:'plant', c:6, key:'', ds:'Something to stand on the shelf — a plant, a bookend, a little figure', attrs:['decor','media'], size:[4,5], phoneSize:[2,3], mediaType:'image', onclick:'none', decor:'plant',
     family:['decoration','window'], famSub:'What is standing there?', body:'' },
  /* Sound and moving pictures are things you put on a desk, not a corner of
     film-making — so they are majors, and pressing one plays it rather than
     opening a page about it. See decision 144. */
  audio:   {nm:'Audio',   ic:'music',   c:10, key:'U', ds:'Something to listen to',    size:[4,4], phoneSize:[3,3], onclick:'play', attrs:['text','media','duration'], mediaType:'audio', body:'' },
  video:   {nm:'Video',   ic:'film',    c:9, key:'&', ds:'Something to watch',        size:[6,4], onclick:'play', attrs:['text','media','duration'], mediaType:'video', body:'' },
  trip:    {shape:'ticket', proj:'trip', nm:'Trip',    ic:'flag',    c:9, key:'P', ds:'Somewhere you are going',   size:[8,6], attrs:['container','date','span','location'], layout:'grid', body:'' },
  /* A **collage** is a container whose face is the board inside it, drawn
     small — not a separate wall of thumbnails that had to be kept in step with
     what the drawer actually holds. So it is a *face* any container can wear,
     and this is the type that wears it by default. See decision 134. */
  moodboard:{face:'collage', nm:'Collage', ic:'image', c:13, ds:'Pictures, arranged — the board inside it, seen from outside', size:[8,8], attrs:['container'], layout:'grid', body:'' },
  quote:   {shape:'quote', nm:'Quote',   ic:'book',    c:5, key:'Z', ds:'Someone else\'s words',      size:[6,4], onclick:'read', attrs:['text','link','rating'],
            body:'> \n\n— ' },
  /* **Story is gone.** It was Prose & Poetry with a different binding: a
     container of text that reads as a book both ways round, which is the
     category's own description. Two tiles for one object is the "decide twice"
     decision 130 exists to remove, and the one that had to go is the one whose
     name is a guess about what you are writing. Migration 29 turns any story
     already on a desk into a text and keeps its binding, so nothing that
     exists changes shape. A pile of scenes gathers into one.

     A world holds the people, places and things the stories are set in, and
     that distinction is why it stays: a character outlives the book they first
     appeared in. */
  world:   {narrative:true, nm:'World',   ic:'star',    c:9, key:'F', ds:'The people, places and things a story is set in', size:[8,8], attrs:['text','container'], layout:'grid', body:'' },
  /* Four things that are made of other things, and were being kept as notes
     because no type could hold anything. A film is a piece of work with a date
     and a shape, so it reports like a project; a novel and a short story are
     bound, so they wear a spine and open as a book; an album is a running
     order, so it is a list you can dictate tracks into. None of them needed new
     machinery — they are four rows of attributes, which is the whole argument
     for attributes. */
  /* ---- what a project *is*, drawn as the thing it will become ------------
     A piece of work has a shape you know before it exists: a film is a poster,
     an album is a sleeve, a game is a boxed case, an app is an icon, a novel
     is a spine. So `proj` names which cover the project face wears — one
     property and one stylesheet block, rather than eight container types with
     eight blocks of markup that would drift apart the first time the project
     face learned anything. A cover with no picture in it yet draws the
     placeholder for its kind, which is what makes an empty one recognisable.
     See decision 135. */
  film:    {face:'project', proj:'film', film:true, nm:'Film', ic:'clapper', c:9, key:'!', ds:'A film, and everything it is made of',
     attrs:['text','container','date','progress','media','relates'],
     seed:[{kind:'generator', title:'Add to this film…', sz:[8,2]}],
     layout:'grid', size:[6,9], phoneSize:[4,6], body:'' },
  game:    {face:'project', proj:'game', nm:'Game', ic:'grid', c:9, key:'5',
     ds:'A game, and everything it is made of',
     attrs:['text','container','date','progress','media','relates'],
     seed:[{kind:'generator', title:'Add to this game…', sz:[8,2]}],
     layout:'grid', size:[6,8], phoneSize:[5,7], body:'' },
  song:    {face:'project', proj:'song', film:true, nm:'Song', ic:'music', c:10, key:';',
     ds:'A song, and everything it is made of',
     attrs:['text','container','date','progress','media','relates'],
     layout:'grid', size:[5,5], phoneSize:[4,4], body:'' },
  app:     {face:'project', proj:'app', nm:'App', ic:'grid', c:14, key:'7',
     ds:'Software, and everything it is made of',
     attrs:['text','container','date','progress','media','relates'],
     seed:[{kind:'generator', title:'Add to this app…', sz:[8,2]}],
     layout:'grid', size:[5,5], phoneSize:[4,4], body:'' },
  artpiece:{face:'project', proj:'art', nm:'Art piece', ic:'image', c:12, key:'3',
     ds:'A painting, a print, a drawing — and the work behind it',
     attrs:['text','container','date','progress','media','relates'],
     layout:'grid', size:[6,6], phoneSize:[5,5], body:'' },
  novel:   {face:'spine', proj:'novel', binding:'ribbed', narrative:true, nm:'Novel', ic:'book', c:11, key:'#', ds:'Chapters, bound in order',
     attrs:['text','container','relates'], layout:'book', read:'book', size:[3,9], phoneSize:[2,6], body:'' },
  shortstory:{face:'spine', binding:'flat', narrative:true, nm:'Short story', ic:'feather', c:14, key:'$', ds:'One story, its scenes in order',
     attrs:['text','container','relates'], layout:'book', read:'book', size:[3,7], phoneSize:[2,5], body:'' },
  album:   {face:'project', proj:'album', film:true, nm:'Album', ic:'music', c:10, key:'%', ds:'Tracks, in the order they play',
     attrs:['text','container','media','spawn'], spawnBy:'type', genKind:'audio',
     layout:'list', size:[5,5], phoneSize:[4,4], body:'' },
  scene:   {shape:'page', narrative:true, film:true, nm:'Scene',   ic:'clapper', c:9, key:'N', ds:'One scene, for writing',     size:[6,5], onclick:'read', attrs:['text','location','duration','relates'], gathers:'book',
            body:'**Where —** \n\n**Who —** \n\n**What changes —** ' },
  character:{shape:'portrait', narrative:true, nm:'Character', ic:'star', c:13, key:'H', ds:'Someone in the story',       size:[4,6], onclick:'read', attrs:['text','media','relates'], gathers:'world',
            body:'**Wants —** \n\n**Fears —** \n\n**Voice —** ' },
  poem:    {shape:'verse', parchment:true, nm:'Poem',    ic:'feather', c:10, key:'"', ds:'Lines, kept as written', size:[5,7], onclick:'read', attrs:['text'], body:'' },
  place:   {shape:'card', nm:'Place',   ic:'flag',    c:7, key:'1', ds:'Somewhere in the story',  size:[5,6], onclick:'read', attrs:['text','media','relates'], narrative:true, gathers:'world',
            body:'**Feels like —** \n\n**Who is there —** \n\n**What happened here —** ' },
  /* ---- a fragment: one piece of a world -----------------------------------
     Ten types that only ever come up when you are building a world or telling
     a story, behind one press. Underneath they are nearly the same object — a
     card with a body and relations — differing in what they prompt you to
     write, which is exactly the case for a category rather than ten majors
     cluttering the board you are trying to put a task on.

     `fragment` is the only kind in the app carrying `cat`: there is no generic
     fragment to make, so pressing it always asks which. See decision 135. */
  fragment:{cat:true, shape:'card', narrative:true, nm:'Fragment', ic:'star', c:9, key:'2',
     ds:'A piece of a world or a story — press it and say which',
     family:['world','character','place','artifact','creature','histevent','scene','outline','law','group'],
     famSub:'What piece of it?',
     attrs:['text','relates'], size:[4,4], onclick:'read', body:'' },
  artifact:{shape:'card', narrative:true, nm:'Artifact', ic:'star', c:12, ds:'A thing that matters', size:[4,4], onclick:'read', attrs:['text','media','relates'], gathers:'world',
            body:'**What it is —** \n\n**Who wants it —** ' },
  creature:{shape:'card', narrative:true, nm:'Creature', ic:'star', c:6, ds:'Something alive that is not a person', size:[4,5], onclick:'read', attrs:['text','media','relates'], gathers:'world',
            body:'**What it is —** \n\n**Where it lives —** \n\n**What it wants —** ' },
  histevent:{shape:'card', narrative:true, nm:'Historical event', ic:'clock', c:11, ds:'Something that happened, before the story starts', size:[6,4], onclick:'read', attrs:['text','date','relates'], gathers:'world',
            body:'**Before —** \n\n**The turn —** \n\n**After —** ' },
  law:     {shape:'index', narrative:true, nm:'Law', ic:'help', c:8, ds:'A rule the world keeps — magic, physics, custom', size:[5,4], onclick:'read', attrs:['text','relates'], gathers:'world',
            body:'**The rule —** \n\n**What it costs —** \n\n**Where it breaks —** ' },
  group:   {shape:'card', narrative:true, nm:'Group', ic:'flag', c:5, ds:'A nation, a race, an order, a guild', size:[5,5], onclick:'read', attrs:['text','media','relates'], gathers:'world',
            body:'**Who they are —** \n\n**What they want —** \n\n**Who opposes them —** ' },
  /* Press it and something appears beside it. It was the *Generator*, which
     named the machinery; it is the **Spawner**, which names what it does. Its
     one new answer is `genKind:'random'` — a spawner that makes one of
     *anything*, which is the thing you want on a desk you are trying to fill
     rather than a desk you are running. See decision 133. */
  generator:{shape:'press', nm:'Spawner', ic:'spiral', c:13, key:'6',
     ds:'Press it and it makes one of something — or one of anything. Bigger, you name what it makes.',
     size:[1,1], phoneSize:[1,1], onclick:'generate', attrs:['spawn'], spawnBy:'click', body:'' },
  /* A counter is its number. It carried no `shape` at all, so shapeOf() fell
     through to `card` and drew it as a titled note with the tally in the
     footer — the one thing a counter must never be, and invisible as a bug
     because the tile rendered perfectly well. `count` is the click, because
     going up is the whole of what a counter is for. */
  /* ---- a label: what a stretch of board is called ------------------------
     Not a note, though it is made of the same paper. A label is a **caption on
     the grid**: you put one over a run of tiles to say what they are, so it is
     four cells by one, its words are set large because they are read across
     the desk rather than up close, and it wears the gilt frame — the one edge
     in the app that says "this is a heading" rather than "this is a thing".

     It ships with `tsize` and `border`, which are ordinary per-type look
     values, so every one of them can be argued with in the object editor the
     moment it lands. */
  label:   {shape:'band', nm:'Label',   ic:'tag',     c:12, key:'M', ds:'A name for a stretch of board',
     size:[4,1], phoneSize:[4,1], onclick:'none', attrs:['text'],
     tsize:'1.6', border:'gilt', body:'' },
  counter: {shape:'tally', nm:'Counter',  ic:'target', c:8, key:'X', ds:'A number you tap to add to', size:[3,3], phoneSize:[3,3], onclick:'count', attrs:['count'], body:'' },
  /* You do not write an achievement, you *pick* one: the goal, project or task
     you finished. So placing one asks which, out of what is actually done, and
     prints it in the past tense — "Lost 25 pounds" rather than "Lose 25
     pounds", because a plaque saying what you still intend to do is a to-do
     with a frame round it. See decision 135. */
  achievement:{shape:'plaque', nm:'Achievement', ic:'trophy', c:12, key:'W', asksDone:true, ds:'Something you actually did', size:[6,3], onclick:'read', attrs:['text','date'], body:'' },
  /* A project is a drawer with a front page. It holds everything a piece of
     work is made of — tasks, events, goals, pictures, notes — so it opens onto
     a board of its own rather than a list, and its front reports on what is
     inside instead of listing the first fourteen things. `media` gives it a
     cover; `spawn` lets you throw a task at it without opening it. */
  /* **A project is a drawer.** Its default face is the front it is filed
     behind, with the knob turned into a dial — how far along it is, read off
     the one part of a drawer your eye already goes to. The named kinds of work
     below keep their covers, because a film knows it is a poster before it
     exists; a project that is only a project does not, and a drawer is what
     everything on this desk is until it says otherwise. See ringFor() in
     tiles.js. */
  project: {face:'front', nm:'Project', ic:'flag',    c:7, key:'8', ds:'A whole piece of work, and everything it is made of',
     /* A **script** is here as well as under Prose & Poetry, and that is not a
        type drawn twice on one screen: both are families, so it is one press
        in from either, and it honestly is both — a thing you write and a piece
        of work you are making. `inFamily()` keeps it out of the flat list. */
     family:['project','film','novel','game','song','album','app','artpiece','trip','script'],
     famSub:'What is the work?',
     attrs:['text','container','date','progress','media','relates'],
     // born with a spawner inside it rather than a box bolted to its front:
     // the type that makes tasks out of typing already exists, so a project
     // gets one put in it instead of growing a second one of its own
     seed:[{kind:'generator', title:'Add to this project…', sz:[8,2]}],
     layout:'grid', size:[5,5], phoneSize:[4,4], body:'' },
  timeline:{face:'timeline', nm:'Timeline',ic:'clock',   c:5, key:'0', ds:'Things in the order they happened', attrs:['container'], layout:'timeline', size:[10,6], body:'' },
  /* An **event** is a thing on a day, and it is the one type whose subject is
     *when*. It wore `sliver` — the task's shape — so the type that is about a
     date looked exactly like the type that is about a job of work. It has a
     face of its own now (`sh-event` in tiles.js): a torn-off diary leaf, the
     name beside it, and under the name how long it runs.

     `span` is new on it and is the reason a trip and a meeting are the same
     type: an event either lasts a run of days or takes a duration, and both
     are fields it can already carry. Three by two, which is the leaf plus a
     name that fits. */
  appt:    {shape:'event', nm:'Event',   ic:'calendar',c:8, key:'V', ds:'Something on a day — a meeting, a shoot, a trip',
     size:[6,2], phoneSize:[5,2], onclick:'when', attrs:['text','date','span','duration','location'], body:'' }
};
/* ---- the major categories ----------------------------------------------
   Forty types is an inventory, not a choice. These are the twenty that answer
   "what am I putting down" nearly every time, and the picker leads with them;
   everything else is one disclosure further in and is reachable by name, by
   shortcut and by the type builder exactly as before. Nothing is hidden and
   nothing is deleted — this is an ordering, not a hierarchy, and the hierarchy
   underneath it (attributes, then kinds, then objects) is untouched.

   The order is the order they are drawn in, and it is not alphabetical: the
   four drawers lead, because what you are usually doing on a bare board is
   making somewhere to put things. See decision 130. */
const PRIMARY = ['drawer','magic','project','life','goal',
                 'book','checklist','calendar','moodboard','timeline',
                 'note','fragment','label','recipe','achievement',
                 'task','progressbar','counter','appt',
                 'image','audio','video','decoration','control','generator'];
const isPrimary = k => PRIMARY.includes(k);

/* ---- a category is a type you press to be *asked which* -----------------
   Twenty majors was already an ordering rather than a hierarchy, and five
   kinds of note sitting side by side in it made you decide twice: once that
   you were writing something down, and again about what sort of writing-down
   it was. A category collapses that into one tile — press Note and the five
   are one press further in, with the plain one leading.

   `family` is the list, on the category's own kind, and it leads with that
   kind wherever it is a real thing you can make. `cat` marks the one that is
   only a question: there is no generic Fragment, so pressing it always asks.

   The map back is *derived* rather than written, because a type named in two
   families (a novel is both a text and a project) would otherwise have to be
   remembered in two places and would fall out of one of them. First family
   named wins, which is only used to decide where a type is *listed*, never
   what it can do. See decision 135. */
const familyOf = k => K(k).family || null;
const isCategory = k => !!(K(k).family);
const FAMILY_OF = (()=>{ const m={};
  Object.entries(BUILTIN_KINDS).forEach(([cat,d])=>(d.family||[]).forEach(k=>{
    if(k!==cat && !m[k]) m[k]=cat; }));
  return m; })();
/* Which category a type is listed under, or null. Only a *major* category
   counts: a family whose own tile is not on the picker's front page would hide
   its members behind a door nobody can open. */
const inFamily = k => { const c=FAMILY_OF[k]; return (c && isPrimary(c)) ? c : null; };
/* Whether a type is a **piece of something bigger** — a fragment. Asked of the
   category table rather than of a name: the Fragment category's own `family`
   list is what says which types these are, so a type you invent that names
   itself a fragment gets the torn edge for free and nothing here has to be
   kept in step with a list somewhere else. `world` and `character` are members
   with shapes of their own, and they are torn too: what makes a fragment is
   that it came out of something, not what it is drawn on. See decision 145. */
const isFragmentKind = k => FAMILY_OF[k]==='fragment' || k==='fragment' ||
  (S.kinds && S.kinds[k] && S.kinds[k].family1==='fragment');
/* The members worth drawing, which is not quite the stored list: a family may
   name a type that has since been deleted from KINDS, and a type you invented
   may say it belongs to one. */
const familyList = cat => {
  const own = (familyOf(cat)||[]).filter(k=>KINDS[k]);
  const mine = KEYS.filter(k=>S.kinds && S.kinds[k] && S.kinds[k].family1===cat && !own.includes(k));
  return own.concat(mine);
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
  /* Ten drawer fronts in a rack, at the size a drawer starts at, packed four
     across and three down — which is **one shelf** on either device, because a
     shelf is eight columns on both now (decision 141). The rest of the shelf is
     left clear on purpose: what a drawer holds is behind it, so a wall of them
     is the whole point and it takes a corner.

     Authored on the *first* shelf and moved to the middle one at first render
     by centreDesk(), for the reason it exists: a shelf is as tall as whatever
     fits on this particular screen, and nothing knows that number until the
     board has been measured once.

     `shelves` is the "add another shelf" the drawer editor writes. The five
     that actually hold things get a second one side by side — a drawer is one
     shelf until you say otherwise, and a sample desk that demonstrates saying
     otherwise is worth more than one that quietly never needs to. */
  const drawers = [
    MG({id:'d_today', title:'Today',        c:6, layout:'list', filter:{due:'today', scope:'all'},      desk:{x:1,y:1,w:2,h:2},  phone:{x:1,y:1,w:2,h:2}}),
    /* The inbox **collects**; it does not hold. Everything loose on a desk —
       made and not yet put away — shows up in it, and stays exactly where it
       was made. A drawer that took what you made would be filing your desk for
       you, which is the one thing the desk is for. See decision 45. */
    MG({id:'d_in',    title:'Inbox',        c:5, layout:'list', filter:{loose:true, scope:'all'}, desk:{x:3,y:1,w:2,h:2},  phone:{x:3,y:1,w:2,h:2}}),
    // everything still to do, wherever it lives — the drawer that answers "what
    // is outstanding" without caring which project it is outstanding in
    MG({id:'d_all',   title:'Everything',   c:9, layout:'list', filter:{kinds:['task'], scope:'all'},   desk:{x:5,y:1,w:2,h:2},  phone:{x:5,y:1,w:2,h:2}}),
    DR({id:'d_ideas', title:'Idea Bin',     c:12, shelves:{w:2,h:1}, desk:{x:7,y:1,w:2,h:2},  phone:{x:7,y:1,w:2,h:2}}),
    DR({id:'d_studio',title:'Studio',       c:9,  shelves:{w:2,h:1}, desk:{x:1,y:3,w:2,h:2},  phone:{x:1,y:3,w:2,h:2}}),
    MG({id:'d_open',  title:'Open Questions',c:10,filter:{kinds:['question'], rule:{f:'answer',op:'is',v:''}},              desk:{x:3,y:3,w:2,h:2},  phone:{x:3,y:3,w:2,h:2}}),
    DR({id:'d_keep',  title:'Keeping Up',   c:8,  shelves:{w:2,h:1}, desk:{x:5,y:3,w:2,h:2},  phone:{x:5,y:3,w:2,h:2}}),
    MG({id:'d_done',  title:'Done & Dusted',c:5, filter:{done:true, scope:'all'},                       desk:{x:7,y:3,w:2,h:2},  phone:{x:7,y:3,w:2,h:2}}),
    /* These two were **desks** — drawers promoted out into a row of their own.
       There is one desk now and it is nine shelves, so they are drawers on it
       like everything else. See decision 141. */
    DR({id:'d_write', title:'Writing Desk', c:7,  shelves:{w:2,h:1}, desk:{x:1,y:5,w:2,h:2},  phone:{x:1,y:5,w:2,h:2}}),
    DR({id:'d_kitch', title:'Kitchen',      c:11, shelves:{w:2,h:1}, desk:{x:3,y:5,w:2,h:2},  phone:{x:3,y:5,w:2,h:2}}),
    /* One of every type there is, in two drawers rather than on the desk.
       They used to lie on the desk itself in a column that ran to row 102,
       which was fine when a board was as tall as whatever was on it and is
       nonsense now that it is nine shelves: fifty-six tiles were clamped into
       the bottom of the board and drawn on top of each other. A first desk is
       supposed to feel like a desk, and what the sampler is *for* — eyeballing
       a change across every kind at once — is better served by a board of its
       own. Nine shelves each, which is a thousand cells against the six
       hundred they need. See decision 141. */
    DR({id:'d_alldr', title:'Every drawer', c:14, shelves:{w:3,h:3}, desk:{x:5,y:5,w:2,h:2}, phone:{x:5,y:5,w:2,h:2}}),
    DR({id:'d_allob', title:'Every object', c:15, shelves:{w:3,h:3}, desk:{x:7,y:5,w:2,h:2}, phone:{x:7,y:5,w:2,h:2}})
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
    O({kind:'question', title:'Is a habit a kind, or a property of a task?', parent:'d_open', tags:['bureau'], body:'**Answer —** A property. It is a task with a repeat rule on it, and the type is gone.'}),

    // A recipe is a card you write on, so the seed writes on one: what goes in
    // it and how, on the card rather than in a drawer behind it.
    O({id:'o_braise', kind:'recipe', title:'Sunday braise', parent:'d_kitch', tags:['cooking'],
       body:'**Serves** 4 · **Time** 3 hr\n\n1.4 kg chuck, in big pieces\n2 onions, halved\n1 head garlic, topped\n400 ml red\nBay, thyme, a strip of orange peel\n\n## Method\n1. Salt the meat the night before.\n2. Brown hard, in batches, no crowding.\n3. Wine in, scrape, reduce by half.\n4. 150°C, lid on, 3 hours. Do not peek.'}),
    O({kind:'recipe', title:'The only pancakes', parent:'d_kitch', tags:['cooking']}),
    O({kind:'recipe', title:'Cold-brew ratio that finally worked', parent:'d_kitch', tags:['cooking']}),

    O({kind:'script', title:'THE LAST VIDEO STORE — cold open', parent:'d_studio', tags:['film'],
       body:'### INT. VIDEO STORE — NIGHT\n\nFluorescent hum. Shelves half empty. MARGO, 60s, alphabetizes a section that no longer needs it.\n\n**MARGO**\nWe close at nine. We closed at nine for thirty-one years.\n\nShe puts a tape back anyway.'}),
    // One 'media' kind became image/audio/video in migration 7; the seed kept
    // naming the old one, so these three came back as plain notes on first run.
    O({kind:'image', title:'Reference — brass drawer pulls', parent:'d_studio', tags:['visual','bureau'], media:{type:'image', label:'12 photographs · Kodak Gold'}}),
    O({kind:'audio', title:'Room tone — kitchen, 4am', parent:'d_studio', tags:['film'], media:{type:'audio', label:'02:14 · WAV'}}),
    O({kind:'video', title:'Drawer-open animation test v3', parent:'d_studio', tags:['bureau','visual'], media:{type:'video', label:'00:06 · ProRes'}}),

    /* A habit is a **task that repeats** — there is no Habit type any more, and
       the seed says so by keeping the three that were habits as exactly that:
       the repeat rule they always carried, and the trait that reads it. */
    O({kind:'task', title:'Write 500 words', parent:'d_keep', tags:['writing'],
       attrs:['text','check','date','repeat'], due:T,
       repeat:{every:1, unit:'day', days:[], from:'date', ends:null, paused:false, made:0},
       history:[dz(-1),dz(-2),dz(-3),dz(-4),dz(-6),dz(-7),dz(-8),dz(-11)], body:'**Why —** The essay only exists on the days I show up.'}),
    O({kind:'task', title:'Walk before screens', parent:'d_keep', tags:['health'],
       attrs:['text','check','date','repeat'], due:T,
       repeat:{every:1, unit:'day', days:[], from:'date', ends:null, paused:false, made:0},
       history:[dz(-1),dz(-2),dz(-3),dz(-5),dz(-6),dz(-9),dz(-10),dz(-12),dz(-13)]}),
    O({kind:'task', title:'Close the laptop by 10', parent:'d_keep', tags:['health'],
       attrs:['text','check','date','repeat'], due:T,
       repeat:{every:1, unit:'week', days:[1,2,3,4,5], from:'date', ends:null, paused:false, made:0},
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
  /* Every type there is, control included — it was excluded for as long as it
     was a dead kind nothing drew (decision 132 brings it back), and a sampler
     that skips a type is a sampler you cannot check a type against.

     **No box, on either device.** It used to author `desk:{x,y}` by wrapping
     at the desk's twenty-four columns, which is a coordinate the seed cannot
     know any more: a shelf is as tall as whatever fits on *this* screen, so
     the number of rows a board has is measured rather than declared. Leaving
     both null hands the placing to `ensureBox()`, which packs shelf by shelf
     on the board the tile is actually drawn on, at whatever height that turns
     out to be — the first time you open the drawer. See decision 141. */
  const museum=[];
  KEYS.forEach(k=>{
    const d=KINDS[k];
    const id='k_'+k;
    museum.push(O({id, kind:k, title:d.nm, tags:['sampler'],
      parent: kindHas(k,'container') ? 'd_alldr' : 'd_allob',
      body: kindHas(k,'text') ? (d.body||'A sample '+d.nm.toLowerCase()+', so you can see one.') : '',
      desk:null, phone:null}));
    if(kindHas(k,'container') && !kindHas(k,'magic'))
      // the kind's own answer, read straight off the table: genKindOf() is
      // declared further down this file and seed() runs before it exists
      ['One','Two','Three'].forEach(t=>museum.push(O({kind:d.genKind||'task', title:t, parent:id})));
  });

  /* Three drawers on the shelf, and they are the three every desk wants:
     what is due today, where things land when you don't say, and everything
     still outstanding anywhere. A first desk should show what pinning is for,
     and these are the ones worth reaching in one tap. */
  return {objects: drawers.concat(controls, objects, museum),
          /* One desk, nine shelves. The row is kept as a one-element list
             rather than deleted, because a backup carries it and every reader
             of it now answers with a constant. See decision 141. */
          desks: [ROOT],
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
    objects:s.objects, kinds:{}, plans:[], desks:s.desks.slice(),
    /* Which devices have had what is on the desk moved to the middle shelf.
       Empty on a fresh desk too: the seed is authored on the *first* shelf,
       because a shelf is as tall as whatever fits on this screen and nothing
       knows that number until the board has been measured. See centreDesk(). */
    centred:{},
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
          /* `workday` — how many hours of real work a day holds, which is the
             one number the urgency ladder is scaled by — is deliberately *not*
             here. It is unwritten until the slider is moved, and `workday()`
             answers WORKDAY for a desk that has never said, the same way a
             stock falls back to the aesthetic's paper. Declaring it here would
             also have put it in front of its own constant, which is where this
             started. See decision 120. */
          /* Pinned to a board rather than laid flat on one: a little air around
             each tile and a degree or two of tilt. Off by default — see
             decision 75. */
          pinned:false,
          /* The shelf is inset behind the opening, and tilting the phone looks
             into that cavity. Off by default: switching it on asks iOS for
             permission, and a phone feature only — a Mac has no gyroscope.
             See decision 108. */
          /* Which surfaces answer the phone being tilted — see tiltMode().
             `off` by default, because switching it on asks iOS for the motion
             sensor and an app that prompts on first launch is a rude app. */
          parallax:'off',
          // how far each of them moves, in px, from the sliders beside it
          tiltdesk:16, tiltwin:11,
          /* Which way round the tilt runs. A thing in a recess lags the
             movement rather than chasing it, so the sensor is negated by
             default — but that was settled by holding it once, and it is worth
             being able to hold it the other way. See decision 108. */
          tiltflip:false,
          /* How far the board is set into the carcass while the cavity is on,
             in px a side. It is what the shelf slides *behind* — with the
             board flush to the screen the occluder is the bezel, which is not
             drawn, so a tile leaving the board reads as an image cut off
             rather than as something going behind wood. See decision 111. */
          deskinset:8, depth:11, turn:100};
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
/* ---- what a picture is framed in --------------------------------------
   Two families in one slot, because they are the same question — what is
   around the image — asked of two different things.

   A **picture frame** surrounds a photograph: it is furniture holding a flat
   object, and what is inside it is a picture of somewhere else. A **window
   frame** is not around the image at all, it is *in front of* it: muntins
   crossing the glass, with a view behind them. That difference is the whole
   reason the second group exists, and it is what earns them the parallax — a
   window has something on the other side, and a photograph in a gilt frame
   does not. See decision 113. */
const FRAMES = {
  none:     'None',
  mount:    'Mount',
  gilt:     'Gilt',
  walnut:   'Walnut',
  black:    'Lacquer',
  polaroid: 'Instant',
  cross:    'Window — four lights',
  six:      'Window — six lights',
  arch:     'Window — round headed',
  lattice:  'Window — leaded'
};
const FRAME_SLOTS = Object.keys(FRAMES);
// the ones with a view behind them rather than a picture inside them
const WINDOW_FRAMES = ['cross','six','arch','lattice'];
/* Per object, then per type — never `o.frame`, or a type that states its own
   frame is a type nothing wears. A name that is not one of the ten falls back
   rather than being stamped onto the tile, the way a binding does. */
const frameOf = o => {
  const f = (o && o.frame) || (o && K(o.kind).frame) || 'none';
  return FRAMES[f] ? f : 'none';
};
const isWindow = o => WINDOW_FRAMES.includes(frameOf(o));

/* Positions 3 and 4 were **Tooled and gilt** and **Paper label**, and both
   were drawings of a rectangle: an empty double rule running the whole spine,
   and a cream sticker covering three quarters of it. Neither read as a
   binding, in any aesthetic — what they read as was a border and a blank.

   They are the **back** now, which is the one thing about a bound book that
   the first three positions all leave alone: plain, gilt-ruled and raised-band
   spines are all *rounded*, because that is what a sewn book does. A flat back
   and a chamfered one are the two other real answers, and they change the
   whole silhouette rather than adding another ornament to it — which is what a
   fourth and fifth position should do. Migration 30 carries the stored values
   across. See decision 152. */
const BINDINGS = {
  plain:  'Plain cloth',
  banded: 'Gilt rules',
  ribbed: 'Raised bands',
  flat:   'Flat back',
  chamfer:'Chamfered'
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
               life:'Life area', goal:'Goal',
               calendar:'Calendar', collage:'Collage', timeline:'Timeline',
               spine:'Book spine'};

/* ---- which cover a project wears ---------------------------------------
   A project face is a report; `proj` says what the thing being reported on
   *is*, and the stylesheet draws the cover to match — a poster, a sleeve, a
   boxed case, an icon. It is a slot like any other: per object, then per type,
   so a plain Project can be told it is a film without becoming one. `plain` is
   the report with no cover, which is what a Project has always been. */
const PROJ_COVERS = {plain:'No cover', film:'Film poster', album:'Album sleeve',
  song:'Record', game:'Game case', app:'App icon', art:'Artwork',
  novel:'Book spine', trip:'Ticket'};
const projCoverOf = o => { const p = (o && o.proj) || K(o&&o.kind).proj;
  return PROJ_COVERS[p] ? p : 'plain'; };

/* ---- which object a life drawer is ------------------------------------
   A life drawer wears a *thing* rather than a label — a stack of coins, a
   suitcase, a dumbbell. The drawings are in decor.js beside the decorations,
   because that is where anything hand-drawn lives; this only reads which one,
   per object then per type, so nothing here has to import the artwork. An
   unknown name and an unset one both come back null, and the face falls back
   to the report a life drawer has always drawn.

   A **picture beats the drawing**: an object carrying `media` is wearing a
   photograph or a drawing of its own, which is the way this is meant to end
   up. See decision 136. */
const lifeArtOf = o => (o && o.lifeart) || K(o&&o.kind).lifeart || null;

/* ---- what a goal is called depends on the time on it -------------------
   The same object, read three ways. No deadline at all and it is a **dream**
   — something you want with nothing yet holding it to a day. A deadline with
   barely enough room and it is a **challenge**. Anything else is a goal.

   Derived rather than stored, and that is the whole point: putting a date on
   a dream should make it a goal without you having to re-declare it as one,
   and letting the date slip past should not leave a Challenge sitting there
   lying about itself. A finished goal is none of the three. */
const CHALLENGE_DAYS = 30;
function goalStanding(o){
  if(!o) return 'goal';
  const day = (has(o,'deadline') && o.dead) || (has(o,'softdeadline') && o.soft) || null;
  if(!day) return 'dream';
  const left = D.until(day);
  return (left!=null && left <= CHALLENGE_DAYS) ? 'challenge' : 'goal';
}
const GOAL_STANDINGS = {goal:'Goal', challenge:'Challenge', dream:'Dream'};
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
/* A spawner may be set to make one of *anything*. `random` is not a kind — it
   is the absence of one — so it must never be handed to K(), which answers
   `note` for anything it does not know and would draw the tile as a note
   factory. Ask makesAnything() before naming what comes out. */
const ANY = 'random';
const makesAnything = o => genKindOf(o)===ANY;
const genSaid = o => makesAnything(o) ? 'anything' : K(genKindOf(o)).nm.toLowerCase();

/* Which of the desk's own settings a control is a switch for — per object,
   then per type, like every other slot. The table of what each one *is* lives
   in mutations.js beside the code that flips it. */
const ctlOf = o => (o && o.ctl) || K(o&&o.kind).ctl || 'lock';
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
/* ---- how much a checklist front shows -----------------------------------
   A checklist face is a stack of task-sized lines, one per cell of height —
   which made a checklist front hold exactly as much as the same box filled
   with task tiles. That was the right rule while a task tile was the unit; in
   practice a checklist is the one face you *want* dense, because the whole
   point of wearing your contents on the outside is seeing more of them than
   you would by opening it. **Two to a cell** is the default now.

   It is a fact about the desk rather than about one drawer, the same way a
   tick box is (decision 83) — a checklist packed one way sitting beside one
   packed the other is two apps sharing a board. One switch, in Settings.
   See decision 140. */
const CL_FITS = {dense:'Twice as many', roomy:'One per cell of height'};
const CL_PER_CELL = {dense:2, roomy:1};
/* **And it is answered per device**, which is the amendment decision 140 needed.
   Two lines to a cell is a good Mac front and a bad phone one: a phone cell is
   about fifty pixels, so a packed line is a twenty-four pixel task — a tick box,
   a clipped word, and no room for the second line the words wrap onto. The
   board is the same size on both and the *screen* is not, which is the same
   reason a box is stored per device in the first place.
   So the fallback is per device and the switch writes per device. A bare word
   is what every desk saved before this stored, and it still means both. */
const CL_FIT_DEF = {desk:'dense', phone:'roomy'};
function clFit(d){
  const at = d || dev(), v = S.look.clfit;
  const one = typeof v === 'string' ? v : (v && v[at]);
  return CL_FITS[one] ? one : (CL_FIT_DEF[at] || 'dense');
}
function setClFit(v, d){
  const at = d || dev();
  const was = S.look.clfit;
  // widen a bare word into the pair it always meant before writing one half
  const pair = typeof was === 'string'
    ? {desk:was, phone:was}
    : Object.assign({}, was);
  pair[at] = v;
  S.look.clfit = pair;
}
const clPerCell = ()=> CL_PER_CELL[clFit()];

const DONE_FACES = ['checklist','project','calendar','timeline'];
/* **And anything that reports a fraction keeps them too.** `DONE_FACES` was the
   whole test, which was right while the only containers that showed what had
   already happened wore one of those four faces. A project is a drawer front
   now (decision 148) and it still reports how far along it is — and a
   percentage whose numerator has been thrown out of the drawer is not a
   percentage.

   So the test is the **trait**: a container carrying `progress` counts what is
   under it, and the things that count them are the things that keep them. That
   catches a **goal** as well, which never wore a `DONE_FACES` face and has been
   quietly reporting the wrong number for as long as it has had a run along its
   bottom edge — tick three of four things inside one and its numerator walked
   out of the drawer, leaving 0 of 1. Widening the rule to the honest predicate
   is what fixes both. See decision 148. */
const keepsDone = c => DONE_FACES.includes(faceOf(c)) || (isContainer(c) && has(c,'progress'));
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
/* **Extensions as well as the wildcard, because a wildcard is not a list.**
   `accept="audio/*"` is a request the picker has to translate, and the
   translation is the platform's: a `.wav` came back greyed out and unpickable
   while every `.m4a` beside it went through, because the file's own type is
   `audio/wave` or `audio/x-wav` or — off some cameras and recorders — the
   empty string, and none of those are what the picker matched the wildcard to.
   Naming the extensions costs a line and cannot be wrong; `importMedia()` reads
   the extension too, for the file that arrives claiming nothing at all. */
const MEDIA_EXT = {
  image:'image/*,.png,.jpg,.jpeg,.gif,.webp,.avif,.heic,.heif,.svg',
  audio:'audio/*,.wav,.wave,.mp3,.m4a,.aac,.aiff,.aif,.caf,.flac,.ogg,.oga,.opus,.weba',
  video:'video/*,.mp4,.m4v,.mov,.webm,.ogv,.avi,.mkv,.3gp,.qt'
};
const acceptFor = o => MEDIA_EXT[mediaTypeOf(o)] || MEDIA_EXT.image;
const acceptAny = () => Object.values(MEDIA_EXT).join(',');

/* The four at the end are the newer answers to "what does a task look like",
   which is a question a plain sliver only ever answered by not being anything.
   They are ordinary shapes: any type can wear one, and a task is a `sliver`
   until you say otherwise. */
const SHAPES = {
  card:'Card', habit:'Streak', goal:'Progress bar', dream:'Dashed', image:'Picture',
  event:'Diary leaf',
  /* **Torn** is the fragment's crease-tear, offered to everything. It was a
     fact about the *category* — a scene and a character wore it and nothing
     else could — and it is the best-looking edge in the app, so it is a shape
     now like every other. A fragment still wears it without being asked: see
     `tornOf()` in tiles.js, which answers for the shape *or* the family. */
  torn:'Torn edge',
  note:'Plain sheet', tornnote:'Torn note', idea:'Ruled sheet', bubble:'Speech bubble',
  page:'Punched page', index:'Index card', spine:'Book spine', portrait:'Portrait',
  ticket:'Ticket', plaque:'Plaque', tally:'Tally', quote:'Quotation',
  verse:'Verse', sliver:'Sliver', press:'Press', band:'Band', rounded:'Rounded card',
  tab:'Filing tab', ruled:'Ruled line', chit:'Torn chit', pill:'Pill',
  switch:'Switch', bar:'Bar'
};
const shapeOf = o => (o && o.shape) || K(o&&o.kind).shape || 'card';

/* How an object opens to be read. Three ways of looking at the same body, so
   the choice is one property rather than three click actions: a spread you
   turn through, a single page you turn through, or one uninterrupted column.
   Per object, falling back to its type, which is what the type builder sets.
   A type that says nothing opens as a page. */
/* **Two, not three.** `page` was a book showing one page — the same sheet, the
   same pagination, the same turn — with the second half of the spread taken
   away, which is what `book` already does on a phone. So it was never a mode:
   it was the desk's book seen on a smaller screen, offered as a choice that
   made no difference on the device where it was the only option. Removed; a
   desk that stored it reads as a book (migration 31). */
const READS = {book:'Book', scroll:'Scroll'};
const readOf = o => { const v=(o && o.read) || K(o&&o.kind).read;
  return READS[v] ? v : 'book'; };

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
/* ---- …and then there was one -------------------------------------------
   All of that was right about the problem and wrong about the answer. What a
   row of desks bought was **room**: somewhere to put a whole area of your life
   without it landing on the same board as everything else. But it bought the
   room by making some drawers a different *kind of thing* from the rest — a
   drawer you could stand on rather than go into — and that is a second concept
   for a spatial problem that space itself can solve.

   The Desk is nine screens now (decision 141). A drawer is a drawer again,
   whatever is in it, and you get your Finance board by putting a drawer on the
   shelf to the left rather than by promoting one out of the world.

   So there is exactly one desk and these four readers collapse to constants.
   They are kept rather than deleted because everything that asks "which desk
   am I on" is asking a question that still has an answer — it is just always
   the same one — and because a magic drawer's `scope:'desk'`, the breadcrumb's
   root and `gridKeyOf()`'s middle step all read them. `S.desks` is still
   loaded and saved so an old backup survives a round trip. See decision 141. */
const deskIds = ()=> [ROOT];
const deskList = ()=> [rootObj()];
const isDesk = id => (id||ROOT)===ROOT;
const deskOf = ()=> ROOT;
const deskHere = ()=> ROOT;

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
// 'desk' | null — how this container is kept, if at all. Always null now:
// there is one desk and nothing is promoted into it. See decision 141.
const placeOf = ()=> null;

/* ---- what answers a phone being tilted --------------------------------
   Two surfaces can, and they are worth having separately: the **desk**, whose
   board slides behind the opening (decision 108), and a **window**, whose view
   moves behind its frame (decision 113). They are the same sensor and the same
   two numbers on `#frame`, but they are not the same effect — a window has a
   drawn frame to be behind and the desk has to imply one — so which of them is
   on is a choice rather than a switch.

   It **was** a boolean, and `true` meant everything. A desk still carrying the
   old value reads as `both` rather than needing a migration for one key, which
   is the tolerance `repeatOf()` gives the four old repeat words and `rulesOf()`
   gives the pre-migration filter shape. */
const TILT_MODES = {off:'Still', desk:'The desk', window:'Windows', both:'Both'};
const tiltMode = ()=>{
  const p = S.look && S.look.parallax;
  if(p===true) return 'both';
  if(!p) return 'off';
  return TILT_MODES[p] ? p : 'off';
};
const tiltsDesk = ()=> ['desk','both'].includes(tiltMode());
/* How far a thing standing on the shelf sticks out of it, in pixels, and its
   own setting rather than a consequence of the tilt: the perspective is a fact
   about where a thing stands and reads with the phone flat on a table (decision
   117), so it is worth having with the board still — and worth turning off
   while the board moves. Zero is off, and off costs nothing at all: no numbers
   on any tile and no layer drawn. */
const shelfDepth = ()=> { const d = S.look && S.look.depth; return d==null ? 11 : +d || 0; };
/* And books are the other half of the same idea, and they are **not** the same
   number. A drawer is a box: what it shows from the side is a flat flank, and
   the whole of the effect is how thick it is. A book is a cylinder: what it
   shows is its round back turning away, which is shade rather than a face, and
   it reads at a depth that makes a drawer look like a brick. They were one
   slider for exactly as long as it took to look at a board with both on it. */
const bookDepth = ()=> { const d = S.look && S.look.bookdepth; return d==null ? 11 : +d || 0; };
/* Either one is enough to want the perspective: `--px`/`--py` are written per
   tile and the `shelf-deep` class turns the faces on, and a desk with the
   drawers flat and the books turning still needs both. Which *tiles* get a
   layer is asked per tile, in `standsOut()`. */
/* ---- and the five that are drawn on the face instead ------------------
   The flank is honest geometry and it is nearly invisible: a drawer front's
   character is the moulding and the knob, and a sliver of grey down one edge is
   not part of it. These say the same thing on the surface the front has. Each
   is **one number, 0-100**, and `applyLook()` derives every property it needs
   from that — the same arrangement the tilt's own sliders have, and for the
   same reason: four properties that could disagree about one cue is four
   chances to be wrong. Zero is off, and off costs no element. See decision 118. */
const FACE_CUES = {
  facelight:  'Light across the face',
  facesweep:  'A sweep of light',
  arris:      'A chamfered edge',
  recess:     'Set into the carcass',
  knobturn:   'The knob turns with you',
  fieldshift: 'The field shifts in its frame'
};
const faceCue = k => { const v = S.look && S.look[k]; return Math.max(0, Math.min(100, +v || 0)); };
/* ---- and which way round each cue runs --------------------------------
   There is no single right sign for all of them. A flank and a roll-off are
   opposite by geometry (a box shows a new surface where a cylinder turns one
   away); a field set back behind its moulding slides against the frame in
   front of it; a specular follows your eye while a shadow runs from it. Get
   one wrong and it is invisible until it sits beside one that is right, which
   is how a board came to have the shading coming from one side and the shadow
   from the other.

   So the direction is a setting, and the baseline below is only where the
   toggle starts. `CUE_DIR` is every cue that has a direction worth reversing —
   the board's own slide is not in it, because `tiltflip` has said the same
   thing for the board since decision 114 and two switches for one idea is one
   too many. See decision 119. */
const CUE_DIR = {
  depth:      -1,   // the flank, reversed from how it was first written
  bookdepth:   1,   // a book, which is the one that already looked right
  facelight:   1,
  facesweep:   1,
  arris:       1,
  recess:      1,
  knobturn:    1,
  fieldshift: -1    // the field slides the other way from how it was written
};
const cueFlipped = k => !!(S.look && S.look[k + 'flip']);
const cueSign = k => (CUE_DIR[k] || 1) * (cueFlipped(k) ? -1 : 1);
const anyFaceCue = ()=> Object.keys(FACE_CUES).some(k => faceCue(k) > 0);
/* Any one of them is reason enough to write `--px`/`--py` and stamp the class:
   a desk with the drawers flat and the light on their faces still needs to know
   which way each thing is standing. Which *tiles* get which layer is asked per
   tile, in `faceLayers()`. */
const standsProud = ()=> shelfDepth() > 0 || bookDepth() > 0 || anyFaceCue();
/* And how much of that follows the phone, 0–100. Where a thing stands is the
   resting answer; this is how far your eye moving adds to it. At zero the faces
   are still true and never move, which is the 1.34 shelf. */
const shelfTurn = ()=> { const t = S.look && S.look.turn; return t==null ? 100 : Math.max(0, Math.min(100, +t || 0)); };
const tiltsWindows = ()=> ['window','both'].includes(tiltMode());
/* What `render()` stamps on `#frame`. Stated here rather than asked of
   motion.js, because it is a fact about the desk and not about the sensor —
   and because render() writes that className wholesale, so anything living on
   it has to be restated there (decision 108). */
const tiltClasses = ()=> (tiltsDesk()?' tilt-desk':'') + (tiltsWindows()?' tilt-win':'')
  + (standsProud()?' shelf-deep':'');

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
/* ---- where a thing made "in" a drawer actually goes --------------------
   A magic drawer **collects; it does not hold** — `inContainer()` ignores
   `parent` for one and matches its rule instead. So an object whose parent is
   a magic drawer is in no board at all: the drawer will not list it unless the
   rule happens to match, and nothing else lists it either, because nothing
   else asks about that parent. It is made, it is saved, and it is nowhere.

   That is exactly what "some drawers don't propagate new objects" was: the
   picker, the sketch and every other maker took the board you were standing on
   as the parent, and standing on a sorting drawer is standing on a rule.

   `homeFor()` is the one answer: the nearest ancestor that actually **holds**.
   `spawnInto()` has said the same thing about typing since the add box existed
   — this is that rule applied to every way of making something, in one place
   so the next maker gets it for free. The loop is bounded because a filed
   cycle would otherwise hang the app. */
function homeFor(id){
  let at = id || ROOT;
  for(let i=0;i<32;i++){
    const c = byId(at);
    if(!c || !has(c,'magic')) return at;
    at = c.parent || ROOT;
  }
  return ROOT;
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
/* Five, not three. Three was "two clauses covers what a desk asks", which was
   true of the fields the rule could ask about at the time; with the meta
   fields (type, where it lives, its tags, its traits) the ordinary useful
   question is now three or four — "a task, due this week, anywhere inside the
   film, not finished" is four. Still ANDed and still no OR: an OR needs
   groups, groups need a builder, and a builder is a query UI. See decision
   151, which extends 63 rather than reversing it. */
const RULE_MAX = 5;
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
  /* A derived field is not a trait an object carries — there is no `urg` on
     anything — so it is read off every object and answers null for the ones it
     cannot speak for, which the ops below already handle. */
  // a derived or meta field is not a trait, so it is read off every object
  if(!fld.derived && !fld.meta && !attrsOf(o).includes(r.f)) return false;
  /* A repeat is an object, so "contains week" has to compare against how it
     would be *said*; a level is a number, so 0 is a value and not an absence.
     See decisions 72 and 73. */
  const v = fld.type==='repeat' ? (repeatSaid(o)||null)
          : fld.get             ? fld.get(o)
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
  /* A **list** field holds several answers at once — the tags a thing carries,
     the traits it has, the containers it is inside — so "is" means "is one of
     them". Without this, `@under is <film>` compared the film's id against a
     comma-joined chain and matched nothing, which is the quietest way for a
     rule to be wrong. */
  if(fld.list && (r.op==='is' || r.op==='not' || r.op==='has')){
    const inIt = Array.isArray(v) && v.includes(String(r.v??''));
    return r.op==='not' ? !inIt : inIt;
  }
  switch(r.op){
    case 'any':  return Array.isArray(v) ? v.length>0 : v!=null && v!==false && v!=='';
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
  const fld=fieldOf(r.f); if(!fld || fld.derived) return null;
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
  /* The sort urgency exists for, and there is deliberately no reverse of it:
     "least urgent first" is not an order anyone wants a board in. Anything
     without a deadline sorts to the bottom rather than to Room — no urgency
     and no slack are different answers, the same way unranked is not 0. */
  urgent:   ['Most urgent first',    (a,b)=>((urgeRank(b)??-1)-(urgeRank(a)??-1)),                      'clock'],
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
/* ---- and the index the `@under` clause needs -------------------------
   `byId()` is a linear scan of every object, which is fine for the handful of
   calls the app makes and ruinous inside a **rule**: `@under` walks a chain of
   parents, `childrenOf()` runs the rule for every object on the desk, and a
   board asks childrenOf() fifty times. Three thousand objects at depth three
   is twenty-seven million comparisons to draw one screen.

   So a pass may remember this too, on the same terms as KIDS: built on first
   use rather than at `beginPass()`, because most passes never ask; **null
   outside a pass**, where every lookup is the honest scan and there is no
   invalidation to get wrong. See decisions 59 and 151. */
let PARENTS = null;
const upOf = id => {
  if(!KIDS) return byId(id);
  if(!PARENTS){ PARENTS = new Map(); S.objects.forEach(o=>PARENTS.set(o.id, o)); }
  return PARENTS.get(id);
};
const beginPass = ()=>{ KIDS = new Map(); PARENTS = null; };
const endPass   = ()=>{ KIDS = null; PARENTS = null; };
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

/* ---- how hard it is, 1 to 5 -------------------------------------------
   The third axis and the one the other two cannot stand in for. A difficult
   phone call is five minutes and unbearable; painting a fence is a whole
   afternoon and needs nothing of you. Priority says how much it matters and
   duration says how long it is; neither says how much it will cost you to
   start, which is the thing that actually decides what gets put off.

   It starts at **1**, not 0, and that is deliberate: an unranked thing has no
   difficulty (null, the same as priority), but there is no such thing as a
   task that is zero hard — if it takes no effort at all it is already done. */
const DIFFS = [
  [1, 'Trivial',   'no resistance at all'],
  [2, 'Easy',      'you could do it now without thinking'],
  [3, 'Real work', 'wants your attention for a while'],
  [4, 'Hard',      'needs a good run at it'],
  [5, 'Punishing', 'the one you keep not starting']
];
const diffOf = o => {
  if(!o || !has(o,'difficulty')) return null;
  const v = o.diff;
  if(v==null || v==='') return null;
  const n = Number(v);
  return isNaN(n) ? null : clamp(Math.round(n), 1, 5);
};
const diffName = n => (DIFFS.find(d=>d[0]===n)||[])[1] || '';

/* ---- urgency: what a deadline and an estimate come to together ---------
   Priority says how much a thing matters to your life. A deadline says when
   it is owed. Neither one on its own tells you what to do this afternoon,
   because **three hours' work due tomorrow and three weeks' work due tomorrow
   are not the same situation** — and every list app that sorts by date treats
   them as if they were.

   So urgency is a subtraction: the days you have, less the days the work will
   take. What is left is **slack**, and the less of it there is the more urgent
   the thing is. Nothing stores it; it is read off a deadline, a duration and
   today, so it is right every morning without anything being rewritten — the
   same argument the five resolving date words in a rule make (decision 63).

   Two rules fall out of the two kinds of deadline. A **hard** one has
   consequences, so it can reach the top of the ladder. A **soft** one is a day
   you gave yourself, so it is always **one step less urgent than the same hard
   one would be** — which is the whole of "more given" in one line, rather than
   a second weighting to keep in step. A thing carrying both is read as
   whichever is more pressing, which is nearly always the hard one and is
   allowed to be the soft one when it is much closer.

   A thing with **no deadline has no urgency at all** — null, not 0, exactly as
   an unranked thing has no priority (decision 72). "Nothing is owed" and "it is
   owed in a year" are different answers and folding them together is how a
   sort ends up lying. And the day a thing merely *sits* on does not count: a
   task scheduled for tomorrow is scheduled, not urgent, which is the whole of
   decision 62 and would be undone by reading `due` here.

   Duration is optional and its absence costs nothing: with no estimate the
   need is zero and slack is simply the days left, which is the answer a plain
   deadline deserves. See decision 120. */
/* How much real work a day holds. It has to be a number — with the twenty-four
   hours a day nominally has, three hours due tomorrow is never urgent and the
   ladder never leaves its bottom rung. Three is the honest figure for work you
   do around a life; it is a setting because it sets the feel of the whole
   ladder and is the one number worth turning. */
const WORKDAY = 3;
const workday = ()=>{ const n=Number((S.look||{}).workday); return n>0 ? n : WORKDAY; };
// the estimate, in days of that capacity — no estimate is no time needed
const workDays = o => { const m = has(o,'duration') ? Number(o.dur) : 0;
  return m>0 ? (m/60)/workday() : 0; };
/* Five rungs, and each says what it means. `slack` is days spare after the
   work is taken out of the time left. */
const URGES = [
  [0, 'Room',    'more time than the work needs'],
  [1, 'Ahead',   'a week or so of slack'],
  [2, 'Soon',    'a few days of slack'],
  [3, 'Tight',   'about a day of slack'],
  [4, 'Behind',  'not enough time left to do it in']
];
const urgeStep = slack => slack < 0 ? 4 : slack < 1 ? 3 : slack < 3 ? 2 : slack < 7 ? 1 : 0;
/* The whole answer, not just the rung: the day it is measured against, whether
   that day is hard, and the arithmetic behind it — because the row in the
   editor has to be able to say *why*, and a number that cannot explain itself
   is a number you stop trusting. Null when there is nothing to measure. */
function urgencyOf(o){
  if(!o || o.done) return null;               // a finished thing is never urgent
  const days = [];
  if(has(o,'deadline') && o.dead)     days.push([o.dead, true]);
  if(has(o,'softdeadline') && o.soft) days.push([o.soft, false]);
  if(!days.length) return null;
  const need = workDays(o);
  let best = null;
  for(const [iso, hard] of days){
    const left = D.until(iso);
    if(left==null) continue;
    const slack = left - need;
    // a soft deadline is one rung down, and so can never reach Behind
    const rank = hard ? urgeStep(slack) : Math.max(0, urgeStep(slack) - 1);
    if(!best || rank > best.rank) best = {iso, hard, left, need, slack, rank};
  }
  return best;
}
const urgeRank = o => { const u=urgencyOf(o); return u ? u.rank : null; };
/* Minutes are what an estimate is stored in and hours are what it is read in:
   "1200 min" is a number you have to convert before it means anything, and the
   whole argument for the estimate is that it is legible next to a date. */
const durSaid = m => { const n=Number(m); if(!(n>0)) return '';
  if(n<60) return `${Math.round(n)} min`;
  const h=Math.floor(n/60), r=Math.round(n%60);
  return r ? `${h}h ${r}` : `${h}h`; };
const urgeName = n => (URGES.find(u=>u[0]===n)||[])[1] || '';
/* Said in English, for the editor row and the tile's title. It states the
   arithmetic rather than the rung alone — "Tight" tells you nothing you can
   argue with; "1h30 of work, 2 days left" does. */
function urgeSaid(o){
  const u = urgencyOf(o); if(!u) return '';
  const hrs = u.need>0 ? `${Math.round(u.need*workday()*10)/10}h of work, ` : '';
  const when = u.left < 0 ? `${-u.left} days past ${u.hard?'a hard':'a soft'} deadline`
             : u.left === 0 ? `${u.hard?'hard':'soft'} deadline today`
             : `${u.left} day${u.left===1?'':'s'} to a ${u.hard?'hard':'soft'} deadline`;
  return `${urgeName(u.rank)} — ${hrs}${when}`;
}

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
/* What a bar is actually drawn at. `goalPct` is an object's own milestones and
   nothing else; **anything drawn as a bar asks this instead**, because a
   progress bar may be a readout of a different object entirely — the project
   on the other desk, the habit you are keeping. `tracks` names it:

     · a container reports how much of everything under it is ticked
     · a streak reports its run against `target` days (thirty unless said)
     · anything else reports its own milestones

   With nothing tracked, or a target that has been deleted, it falls back to
   its own milestones and is a goal again — so a bar can never be blank because
   of something that happened somewhere else. See decision 133. */
function barPct(o){
  if(!o) return 0;
  const t = o.tracks ? byId(o.tracks) : null;
  if(t){
    if(has(t,'streak')) return clamp(Math.round(100*streak(t)/(o.target||K(o.kind).target||30)),0,100);
    return progressOf(t);
  }
  /* Nothing tracked and no milestones: the increments *are* the thing, and
     pressing one is how it moves. A bar like that used to read 0% forever —
     goalPct answers off milestones and a progress bar has none unless you go
     and make some, which is three doors in for a readout whose whole job is to
     be moved from the board. See decision 138. */
  if(!(o.milestones||[]).length) return clamp(Math.round(100*(o.at||0)/barSteps(o)),0,100);
  return goalPct(o);
}
/* ---- a bar moves in increments, not in percentages ---------------------
   A progress bar is drawn as *blocks*, and how many blocks there are is the
   thing being counted: eight chapters, five rehearsals, ten pounds. A
   continuous fill can say 63% and mean nothing you can point at; ten blocks
   with six lit says six of ten, which is what you actually know.

   Its own number where it has one, then the milestones it is made of, then
   ten — a default rather than a rule, and the one number the type builder
   exposes. */
const BAR_STEPS = 10;
const barSteps = o => Math.max(1, Math.min(60,
  (o && o.steps) || K(o&&o.kind).steps || ((o && o.milestones||[]).length) || BAR_STEPS));
// how many of them are lit, which is the percentage quantised to the blocks
const barFilled = o => Math.round(barPct(o)/100 * barSteps(o));
/* How the blocks are laid out in the box the tile was given. **Two to a cell
   of width** is the natural density — an increment is half a cell wide and a
   whole cell tall, which is what makes a ten-step bar five cells long without
   anybody being told. Made narrower than that it wraps rather than shrinking
   the blocks to slivers, so one cell can hold four (two rows of two), then
   six, and the bar stays readable at any width it is dragged to. The columns
   are evened out across the rows, because a last row half empty reads as a
   bar that has broken rather than one that has wrapped. */
const BAR_PER_CELL = 2;
function barGrid(o, box){
  const n = barSteps(o);
  const per = Math.max(1, (box && box.w || 1) * BAR_PER_CELL);
  const rows = Math.max(1, Math.ceil(n / per));
  return {n, rows, cols: Math.ceil(n / rows)};
}
// What the bar is about, said in words — the tracked object's name, or nothing.
const barOf = o => (o && o.tracks) ? byId(o.tracks) : null;

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
/* ---- what is actually finished ----------------------------------------
   An achievement is a thing you *did*, so it is picked rather than written:
   this is the list to pick from. Two ways a thing can be finished, and they
   are different questions — a tickable object is finished when it is ticked,
   and a goal or a project is finished when everything under it is.

   `st.length>0` is the part that matters: every tickable thing under an empty
   container is done, vacuously, so without it a project you have not started
   would be offered as an achievement. Newest first, because the thing you just
   finished is the one you are making a plaque for. See decision 135. */
function finishedThings(){
  return S.objects.filter(o=>{
    if(!o || isHeld(o)) return false;
    if(has(o,'check')) return !!o.done;
    if(isContainer(o)){
      /* A piece of work that is finished — a goal reached, a project done.
         Asked of the **trait** rather than of the face, because a project is a
         drawer front now (decision 148) and "does this thing have an end to
         reach" is what `progress` means, not what a face is called. */
      if(!has(o,'progress')) return false;
      const st = allUnder(o).filter(x=>has(x,'check'));
      return st.length>0 && st.every(x=>x.done);
    }
    return false;
  }).sort((a,b)=>String(b.doneAt||b.due||b.created||'')
    .localeCompare(String(a.doneAt||a.due||a.created||'')));
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

/* Every entry in the margin, oldest first, defensive about the shape because
   this is a list on an object and a hand-edited backup could carry anything. */
function marginOf(o){
  if(!o || !Array.isArray(o.margin)) return [];
  return o.margin.filter(m=>m && typeof m.t==='string' && m.t.trim());
}
/* Appending is the only write. Returns the new list rather than mutating, so
   the caller can hand the old one to pushSet and undo works like every other
   field. */
function marginPlus(o, text){
  const t=String(text||'').trim();
  return t ? marginOf(o).concat({d:D.iso(D.today()), t}) : marginOf(o);
}

export { homeFor, ATTRS, FIELDS, fieldOf, USER_ATTRS, KINDS, KEYS, refreshKinds, K,
  attrsOf, has, kindHas, T, dz, S, sensedDevice, reset, defaultLook, dev, byId,
  deskTitle, rootObj, container, cfgOf, isContainer, FACES, faceOf, layoutOf, SHAPES,
  shapeOf, READS, readOf, spreadOf, OPENINGS, openingOf, gathersOf, gatherKind, containers,
  deskIds, deskList, isDesk, deskOf, deskHere,
  placeOf, isHeld, heldObjects, heldCount,
  TILT_MODES, tiltMode, tiltsDesk, tiltsWindows, tiltClasses, shelfDepth, bookDepth, standsProud, shelfTurn, FACE_CUES, faceCue, anyFaceCue, CUE_DIR, cueFlipped, cueSign,
  spanOf, coversDay, lastDay, lateOn, isLate,
  boardLocked,
  PRIOS, prioOf, prioName, DIFFS, diffOf, diffName,
  REPEAT_UNITS, repeatOf, repeats, repeatSaid, repeatSpent, nextRepeat,
  slotKey, slotFrom, slotRaw, slotSrc,
  BINDINGS, BINDING_SLOTS, bindingOf, FRAMES, FRAME_SLOTS, frameOf, isWindow,
  PANELS, PANEL_SLOTS, panelOf, KNOBS, KNOB_SLOTS, knobOf,
  BORDER_SLOTS, borderOf, TEXTURE_SLOTS, textureOf, STOCKS, STOCK_SLOTS, stockOf,
  KNOBSIZES, knobSizeOf, answered, marginOf, marginPlus, iconOf, TSIZES, textSizeOf, mediaTypeOf, isPicture,
  isMedia, isPlayable, acceptFor, acceptAny, MEDIA_EXT, isDecor,
  spawnByOf, genKindOf, takesTyping, showsAddBox, keepsDone, showsContainers,
  CALVIEWS, calViewOf, weekStartOf, showsWeekends, calCols,
  CL_FITS, clFit, setClFit, clPerCell,
  OPS, WHENS, whenISO, RULE_MAX, rulesOf, matchRule,
  ROLLS, rollup, SORTS, MANUAL, sortOf, childrenOf, beginPass, endPass, isAncestor,
  URGES, WORKDAY, workday, urgencyOf, urgeRank, urgeName, urgeSaid, durSaid,
  relatedTo, backlinksTo, relate, unrelate, chainOf, tlSpan, streak, goalPct,
  allUnder, progressOf, projectStat, finishedThings, allTags,
  PRIMARY, isPrimary, ANY, makesAnything, genSaid, ctlOf, barPct, barOf,
  BAR_STEPS, barSteps, barFilled, barGrid,
  familyOf, isCategory, inFamily, isFragmentKind, familyList,
  PROJ_COVERS, projCoverOf, lifeArtOf,
  goalStanding, GOAL_STANDINGS, CHALLENGE_DAYS };
