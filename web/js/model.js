import { uid, D, ROOT } from './util.js';

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
  priority: {nm:'Priority',   ds:'How much it matters'},
  price:    {nm:'Price',      ds:'What it costs'},
  relates:  {nm:'Related',    ds:'Points at other objects, both ways'},
  total:    {nm:'Total',      ds:'Adds up a field across what it holds'},
  spawn:    {nm:'Spawns',     ds:'Makes new objects — on a press, or as you type into it'}
};
/* An attribute is a trait — what an object can do and how it is drawn. Some
   traits also carry a *field*: a named, typed value. Only fields can be sorted
   or filtered on, which is what lets a magic drawer match anything at all
   rather than the four things it used to know about. */
const FIELDS = {
  check:    {key:'done',   type:'bool',   nm:'Done'},
  date:     {key:'due',    type:'date',   nm:'Due'},
  repeat:   {key:'repeat', type:'text',   nm:'Repeats'},
  link:     {key:'url',    type:'text',   nm:'Link'},
  count:    {key:'count',  type:'number', nm:'Count'},
  rating:   {key:'rating', type:'number', nm:'Rating'},
  location: {key:'loc',    type:'text',   nm:'Location'},
  duration: {key:'dur',    type:'number', nm:'Duration'},
  priority: {key:'prio',   type:'enum',   nm:'Priority', opts:['low','mid','high']},
  price:    {key:'price',  type:'money',  nm:'Price'},
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
  drawer:  {nm:'Drawer',  ic:'folder',  c:'#7E5A38', key:'D', ds:'A container on the grid',   attrs:['container'], layout:'grid', size:[6,6], body:'' },
  magic:   {nm:'Magic drawer', ic:'sparkle', c:'#4A6E8F', key:'Q', ds:'Collects by rule, like a smart folder', attrs:['container','magic'], layout:'grid', size:[6,6], body:'' },
  checklist:{face:'checklist', nm:'Checklist', ic:'list', c:'#4A7C59', key:'K', ds:'A list of things to tick, right on the board', attrs:['container'], layout:'list', size:[6,8], body:'' },
  calendar:{face:'calendar', nm:'Calendar', ic:'calendar', c:'#5C7148', key:'C', ds:'A month, with what is due on it', attrs:['container'], layout:'calendar', size:[8,8], body:'' },
  control: {nm:'Control',  ic:'sliders', c:'#6B6152', key:'', ds:'A Bureau button on the desk', attrs:['control'], size:[4,4], body:'' },
  task:    {shape:'sliver', nm:'Task',    ic:'check',   c:'#4A7C59', key:'T', ds:'A thing to do',             attrs:['text','check','date','repeat'], size:[4,1], onclick:'none', gathers:'checklist', body:'' },
  note:    {shape:'note', nm:'Note',    ic:'note',    c:'#5F7A93', key:'O', ds:'Something to remember',     attrs:['text'], size:[4,4], onclick:'read', body:'' },
  idea:    {shape:'idea', nm:'Idea',    ic:'bulb',    c:'#96652F', key:'I', ds:'A spark, unformed',         size:[4,4], onclick:'read', attrs:['text'], body:'**The spark —** \n\n**Why it might work —** \n\n**What it needs —** ' },
  outline: {nm:'Outline', ic:'list',    c:'#7A6AA0', key:'L', ds:'Structure before prose',    size:[4,4], onclick:'read', attrs:['text'], body:'## I.\n- \n- \n\n## II.\n- \n- \n\n## III.\n- ' },
  // A recipe holds its ingredients rather than listing them in prose, so they
  // can be ticked while you cook and totalled before you shop. The method stays
  // in the body, which a container with `text` shows above what it holds.
  recipe:  {face:'checklist', cooking:true, nm:'Recipe',  ic:'pot',     c:'#A55A3E', key:'R', ds:'Ingredients you can tick, and a method',    size:[6,7], attrs:['text','container'], layout:'list', body:'**Serves** 2 · **Time** 30 min\n\n## Method\n1. \n2. \n3. ' },
  script:  {shape:'page', nm:'Script',  ic:'clapper', c:'#3F5F7A', key:'S', ds:'Scenes and dialogue',       size:[4,4], onclick:'read', attrs:['text'], body:'### INT. LOCATION — DAY\n\nAction line.\n\n**CHARACTER**\nDialogue.' },
  question:{shape:'bubble', nm:'Question',ic:'help',    c:'#4A6E8F', key:'?', ds:'Open until answered',       size:[4,4], onclick:'read', attrs:['text','check'], body:'**Question —** \n\n**What I know —** \n\n**Answer —** ' },
  essay:   {shape:'note', nm:'Essay',   ic:'feather', c:'#5C7148', key:'Y', ds:'Long-form writing',         size:[4,4], onclick:'read', attrs:['text'], body:'> Working thesis.\n\n' },
  habit:   {shape:'habit', nm:'Habit',   ic:'repeat',  c:'#3E7A6B', key:'A', ds:'Repeats, tracks a streak',  size:[4,4], onclick:'read', attrs:['text','streak'], body:'**Why —** ' },
  goal:    {shape:'goal', nm:'Goal',    ic:'target',  c:'#8A5A3F', key:'J', ds:'Long-term, has milestones', size:[4,4], onclick:'read', attrs:['text','progress'], body:'**Definition of done —** ' },
  image:   {nm:'Image',   ic:'image',   c:'#6E7075', key:'G', ds:'A picture on the board',   size:[6,4], onclick:'read', attrs:['media'], body:'' },
  audio:   {film:true, nm:'Audio',   ic:'music',   c:'#5D7E99', key:'U', ds:'Something to listen to',    size:[6,2], onclick:'read', attrs:['text','media','duration'], body:'' },
  video:   {film:true, nm:'Video',   ic:'film',    c:'#3F5F7A', key:'&', ds:'Something to watch',        size:[6,4], onclick:'read', attrs:['text','media','duration'], body:'' },
  trip:    {shape:'ticket', nm:'Trip',    ic:'flag',    c:'#37687A', key:'P', ds:'Somewhere you are going',   size:[8,6], attrs:['container','date','duration','location'], layout:'grid', body:'' },
  moodboard:{face:'moodboard', nm:'Moodboard', ic:'image', c:'#6B4A4A', key:'B', ds:'Pictures, pinned together', size:[8,8], attrs:['container'], layout:'moodboard', body:'' },
  quote:   {shape:'quote', nm:'Quote',   ic:'book',    c:'#6F5137', key:'Z', ds:'Someone else\'s words',      size:[6,4], onclick:'read', attrs:['text','link','rating'],
            body:'> \n\n— ' },
  /* A story holds its scenes and reads as a book; a world holds the people,
     places and things the stories are set in. The distinction is the whole
     reason there are two: a character outlives the book they first appeared in.
     Both readings of "opens as a book" apply — `layout:'book'` pages through
     the scenes it holds, `read:'book'` pages through its own body — and they
     are different properties, so it carries both rather than choosing. */
  story:   {face:'spine', narrative:true, nm:'Story',   ic:'book',    c:'#5A4130', key:'M', ds:'Scenes, bound in order', size:[3,9], attrs:['text','container','relates'], layout:'book', read:'book',
            body:'' },
  world:   {narrative:true, nm:'World',   ic:'star',    c:'#4A5E7A', key:'F', ds:'The people, places and things a story is set in', size:[8,8], attrs:['text','container'], layout:'grid', body:'' },
  scene:   {shape:'page', narrative:true, film:true, nm:'Scene',   ic:'clapper', c:'#2F4A5E', key:'N', ds:'One scene, for writing',     size:[6,5], onclick:'read', attrs:['text','location','duration','relates'], gathers:'story',
            body:'**Where —** \n\n**Who —** \n\n**What changes —** ' },
  character:{shape:'portrait', narrative:true, nm:'Character', ic:'star', c:'#A0703F', key:'H', ds:'Someone in the story',       size:[4,6], onclick:'read', attrs:['text','media','relates'], gathers:'world',
            body:'**Wants —** \n\n**Fears —** \n\n**Voice —** ' },
  field:   {shape:'band', nm:'Text field', ic:'edit', c:'#6B6152', key:'/', ds:'Type in it and a task appears below', size:[8,2], onclick:'none', attrs:['spawn'], spawnBy:'type', body:'' },
  poem:    {shape:'verse', parchment:true, nm:'Poem',    ic:'feather', c:'#5D7E99', key:'"', ds:'Lines, kept as written', size:[5,7], onclick:'read', attrs:['text'], body:'' },
  place:   {shape:'card', nm:'Place',   ic:'flag',    c:'#6B7A3F', key:'1', ds:'Somewhere in the story',  size:[5,6], onclick:'read', attrs:['text','media','relates'], narrative:true, gathers:'world',
            body:'**Feels like —** \n\n**Who is there —** \n\n**What happened here —** ' },
  event:   {shape:'card', nm:'Event',   ic:'clock',   c:'#8C4A38', key:'2', ds:'Something that happens',  size:[6,4], onclick:'read', attrs:['text','date','relates'], narrative:true, gathers:'world',
            body:'**Before —** \n\n**The turn —** \n\n**After —** ' },
  item:    {shape:'card', nm:'Item',    ic:'star',    c:'#9A7B2F', key:'3', ds:'A thing that matters',    size:[4,4], onclick:'read', attrs:['text','media','relates'], narrative:true, gathers:'world',
            body:'**What it is —** \n\n**Who wants it —** ' },
  ingredient:{shape:'index', cooking:true, nm:'Ingredient', ic:'pot', c:'#A55A3E', key:'4', ds:'One line of a recipe',   size:[5,1], onclick:'check', attrs:['check','count','price'], gathers:'recipe', body:'' },
  shot:    {shape:'sliver', film:true, nm:'Shot',    ic:'clapper', c:'#2F4A5E', key:'5', ds:'One shot, for a shoot',   size:[6,1], onclick:'check', attrs:['text','check','duration','location'], gathers:'shotlist', body:'' },
  shotlist:{face:'checklist', film:true, nm:'Shot list', ic:'clapper', c:'#37687A', key:';', ds:'Shots for a shoot, in order', attrs:['container'], layout:'list', size:[7,8], body:'' },
  generator:{shape:'press', nm:'Generator', ic:'plus', c:'#8A5A3F', key:'6', ds:'Press it and it makes one of something', size:[4,4], onclick:'generate', attrs:['spawn'], spawnBy:'click', body:'' },
  shopping:{cooking:true, face:'checklist', nm:'Shopping list', ic:'inbox', c:'#A55A3E', key:'7', ds:'Things to buy, with a total', attrs:['container'], layout:'list', size:[6,8], body:'' },
  counter: {nm:'Counter',  ic:'target', c:'#3E7A6B', key:'X', ds:'A number, and what it counts', size:[4,4], onclick:'none', attrs:['count'], body:'' },
  link:    {shape:'card', nm:'Button',  ic:'arrow',   c:'#37687A', key:'E', ds:'A button that opens something', attrs:['button'], body:'' },
  achievement:{shape:'plaque', nm:'Achievement', ic:'trophy', c:'#9A7B2F', key:'W', ds:'Something you actually did', size:[6,3], onclick:'read', attrs:['text','date'], body:'' },
  project: {face:'checklist', nm:'Project', ic:'flag',    c:'#5C7148', key:'8', ds:'A big thing, made of tasks',   attrs:['container','date','progress'], layout:'list', size:[7,8], body:'' },
  dream:   {shape:'dream', nm:'Dream',   ic:'star',    c:'#5D7E99', key:'9', ds:'Far off, and probably daft',   size:[5,5], onclick:'read', attrs:['text','media'], body:'**Why it pulls at me —** ' },
  timeline:{face:'timeline', nm:'Timeline',ic:'clock',   c:'#6F5137', key:'0', ds:'Things in the order they happened', attrs:['container'], layout:'timeline', size:[10,6], body:'' },
  appt:    {shape:'sliver', nm:'Event',   ic:'calendar',c:'#3E7A6B', key:'V', ds:'Something at a time and place', size:[6,2], onclick:'read', attrs:['text','date','duration','location'], body:'' }
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
  const DR = (o)=> Object.assign({kind:'drawer', parent:ROOT, title:'', body:'',
    tags:[], layout:'grid', ord:0, created:dz(-40)}, o);
  // The three drawers whose whole job is a rule are magic drawers — they
  // collect and never hold. The rest are ordinary containers you file into.
  const MG = (o)=> DR(Object.assign({kind:'magic'}, o));
  const drawers = [
    MG({id:'d_today', title:'Today',        c:'#4A7C59', filter:{due:'today'},                     desk:{x:1,y:1,w:6,h:6},  phone:{x:1,y:1,w:4,h:3}}),
    DR({id:'d_in',    title:'Inbox',        c:'#7E5A38', desk:{x:7,y:1,w:6,h:6},  phone:{x:5,y:1,w:4,h:3}}),
    DR({id:'d_write', title:'Writing Desk', c:'#5C7148', desk:{x:13,y:1,w:6,h:6},  phone:{x:1,y:4,w:4,h:3}}),
    DR({id:'d_ideas', title:'Idea Bin',     c:'#96652F', desk:{x:19,y:1,w:6,h:6},  phone:{x:5,y:4,w:4,h:3}}),
    DR({id:'d_studio',title:'Studio',       c:'#3F5F7A', desk:{x:1,y:7,w:6,h:6},  phone:{x:1,y:7,w:4,h:3}}),
    DR({id:'d_kitch', title:'Kitchen',      c:'#A55A3E', desk:{x:7,y:7,w:6,h:6},  phone:{x:5,y:7,w:4,h:3}}),
    MG({id:'d_open',  title:'Open Questions',c:'#4A6E8F',filter:{kinds:['question']},              desk:{x:13,y:7,w:6,h:6},  phone:{x:1,y:10,w:4,h:3}}),
    DR({id:'d_keep',  title:'Keeping Up',   c:'#3E7A6B', desk:{x:19,y:7,w:6,h:6},  phone:{x:5,y:10,w:4,h:3}}),
    MG({id:'d_done',  title:'Done & Dusted',c:'#6F5137', filter:{done:true},                       desk:{x:1,y:13,w:6,h:6},  phone:{x:1,y:13,w:4,h:3}})
  ];

  // The app's own buttons live on the desk, on the grid, and move like anything
  // else. `ctl` names the action; section 20 dispatches it.
  const controls = [];   // no chrome on the board — the bar has the gear

  let n=0;
  const O = (o)=> Object.assign({
    id:uid('o'), kind:'note', title:'', body:'', tags:[], parent:'d_in', done:false, doneAt:null,
    due:null, repeat:null, history:[], milestones:[], media:null, ord:n++, created:dz(-30),
    desk:null, phone:null   // filled the first time it lands in a grid
  }, o);

  const objects = [
    O({kind:'task', title:'Draft the Bureau data model', due:T, parent:'d_in', tags:['bureau'], body:'Objects, kinds, drawers. One table, one enum, one join.'}),
    O({kind:'task', title:'Buy walnut oil + a proper straightedge', due:T, parent:'d_in', tags:['errand']}),
    O({kind:'task', title:'Call Mom back', due:dz(-1), parent:'d_in', tags:['personal']}),
    O({kind:'task', title:'Ship the drawer-resize gesture', due:dz(1), parent:'d_in', tags:['bureau']}),
    O({kind:'task', title:'Water the fig', repeat:'weekly', due:dz(2), parent:'d_in', tags:['home']}),
    O({kind:'task', title:'Pay the storage unit', repeat:'monthly', due:dz(4), parent:'d_in', tags:['admin']}),
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

    O({kind:'habit', title:'Write 500 words', parent:'d_keep', tags:['writing'], repeat:'daily',
       history:[dz(-1),dz(-2),dz(-3),dz(-4),dz(-6),dz(-7),dz(-8),dz(-11)], body:'**Why —** The essay only exists on the days I show up.'}),
    O({kind:'habit', title:'Walk before screens', parent:'d_keep', tags:['health'], repeat:'daily',
       history:[dz(-1),dz(-2),dz(-3),dz(-5),dz(-6),dz(-9),dz(-10),dz(-12),dz(-13)]}),
    O({kind:'habit', title:'Close the laptop by 10', parent:'d_keep', tags:['health'], repeat:'weekdays',
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
  // The drawers that start out on the bar. A first desk should show what
  // pinning is for, and these four are the ones worth reaching in one tap.
  return {objects: drawers.concat(controls, objects),
          pins: ['d_today','d_in','d_keep','d_done']};
}

/* ============================================================
   4 · state
   ============================================================ */
let S;
const sensedDevice = ()=> window.matchMedia('(min-width: 900px)').matches ? 'desk' : 'phone';
function reset(){
  const s = seed();
  S = {
    objects:s.objects, kinds:{}, pins:s.pins.slice(),
    // Paper, not auto: the parchment desk is the intended look, so a Mac in
    // dark mode shouldn't silently serve Walnut on first run.
    device:sensedDevice(), layoutEdit:null, theme:'paper',
    view:'desk', drawerId:null, openId:null,
    arrange:false, kindFilter:null, calDay:null,
    undo:[], editing:false, sel:[], readId:null, bookAt:0,
    deskCfg:{layout:'grid', locked:false, sort:null},
    look:defaultLook()
  };
  refreshKinds();
}
function defaultLook(){
  return {bg:null, accent:null, line:null, board:null, boardAlpha:1, owner:'', palette:'workshop'};
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
const rootObj = ()=> Object.assign({id:ROOT, kind:'drawer', title:deskTitle(), c:'#7E5A38',
                       pv:'list', filter:{}, layout:'grid', parent:null},
                       S.deskCfg||{});
const container = id => (id===ROOT||!id) ? rootObj() : byId(id);
// The desk's own settings aren't on an object, so writes have to go to deskCfg.
const cfgOf = id => (id===ROOT||!id) ? S.deskCfg : (byId(id)||{});
const isContainer = o => !!o && has(o,'container');
/* A face is how a container draws itself on its parent's board. A layout is
   how it arranges its children once opened. They used to be one property,
   which meant a checklist could not also be sorted when you opened it. */
const FACES = {front:'Drawer front', checklist:'Checklist', calendar:'Calendar',
               moodboard:'Moodboard', timeline:'Timeline', spine:'Book spine'};
const faceOf = o => (o && o.face) || K(o&&o.kind).face || 'front';

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
const SHAPES = {
  card:'Card', habit:'Streak', goal:'Progress bar', dream:'Dashed', image:'Picture', note:'Torn note', idea:'Folded corner', bubble:'Speech bubble',
  page:'Punched page', index:'Index card', spine:'Book spine', portrait:'Portrait',
  ticket:'Ticket', plaque:'Plaque', tally:'Tally', quote:'Quotation',
  verse:'Verse', sliver:'Sliver', press:'Press', band:'Band'
};
const shapeOf = o => (o && o.shape) || K(o&&o.kind).shape || 'card';

/* How an object opens to be read. Three ways of looking at the same body, so
   the choice is one property rather than three click actions: a spread you
   turn through, a single page you turn through, or one uninterrupted column.
   Per object, falling back to its type, which is what the type builder sets.
   A type that says nothing opens as a page. */
const READS = {book:'Book', page:'Page', scroll:'Scroll'};
const readOf = o => (o && o.read) || K(o&&o.kind).read || 'page';
// A phone has no room for a spread, so book reads as page there and the page
// step follows — otherwise turning would skip one every time.
const spreadOf = o => readOf(o)==='book' && S.device==='desk';
const containers = ()=> S.objects.filter(isContainer);

/* Pinned drawers are the app's whole navigation — the strip along the top on a
   Mac, the bar along the bottom on a phone. `S.pins` is an ordered list of ids
   rather than a flag on the drawer, because the order things sit in a nav bar
   is its own decision and has nothing to do with where they sit on the desk.
   It is resolved on read, so a pin whose drawer has been deleted simply stops
   appearing — no delete path has to remember to tidy up after itself. */
const isPinned = id => (S.pins||[]).includes(id);
const pinnedDrawers = ()=> (S.pins||[]).map(byId).filter(o=>o && isContainer(o));

/* A drawer holds. A magic drawer collects. Nothing does both.
   An object lives in exactly one drawer — its `parent` — and that is the only
   thing an ordinary drawer shows. A magic drawer ignores parentage entirely and
   shows whatever matches its rule, which is the one way an object appears in
   more than one place at once. */
function inContainer(c,o){
  if(!c || o.id===c.id) return false;
  if(has(c,'magic')){
    const f=c.filter||{};
    if(f.done) return !!o.done;        // the archive
    if(o.done) return false;           // finished things leave everywhere else
    if(isContainer(o)) return false;   // magic drawers collect objects, not drawers
    if(f.due==='today') return !!o.due && D.parse(o.due)<=D.today();
    if(f.tag && !(o.tags||[]).includes(f.tag)) return false;
    if(f.kinds && f.kinds.length && !f.kinds.includes(o.kind)) return false;
    if(f.rule && !matchRule(o, f.rule)) return false;
    return !!(f.tag || (f.kinds&&f.kinds.length) || f.rule);
  }
  // Completed things leave a drawer (decision 2) — but not a checklist, where
  // seeing what you've ticked is the entire point of the thing.
  if(o.done && faceOf(c)!=='checklist') return false;
  return o.parent===c.id;              // an ordinary drawer holds what is filed in it
}
/* One clause: a field, a comparison, a value. Everything a magic drawer can
   ask about an object goes through here. */
const OPS = {is:'is', not:'is not', has:'contains', gt:'more than', lt:'less than', any:'has any'};
function matchRule(o, r){
  if(!r || !r.f) return true;
  const fld=fieldOf(r.f); if(!fld) return true;
  if(!attrsOf(o).includes(r.f)) return false;      // it hasn't got that field
  const v=valOf(o, fld.key);
  switch(r.op){
    case 'any':  return Array.isArray(v) ? v.length>0 : v!=null && v!==false;
    case 'is':   return String(v??'')===String(r.v??'');
    case 'not':  return String(v??'')!==String(r.v??'');
    case 'has':  return Array.isArray(v) ? v.includes(r.v) : String(v??'').toLowerCase().includes(String(r.v??'').toLowerCase());
    case 'gt':   { const n=numOf(o,fld.key); return n!=null && n>parseFloat(r.v); }
    case 'lt':   { const n=numOf(o,fld.key); return n!=null && n<parseFloat(r.v); }
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

/* Children, in whatever order the drawer is sorted by. `sort` is null for the
   manual order you arranged yourself, which is the default. */
const SORTS = {
  made:   ['Date made, newest',    (a,b)=>(b.created||'').localeCompare(a.created||'')],
  madeup: ['Date made, oldest',    (a,b)=>(a.created||'').localeCompare(b.created||'')],
  edited: ['Date modified',        (a,b)=>(b.edited||b.created||'').localeCompare(a.edited||a.created||'')],
  az:     ['Alphabetical, A–Z',    (a,b)=>(a.title||'').localeCompare(b.title||'')],
  za:     ['Alphabetical, Z–A',    (a,b)=>(b.title||'').localeCompare(a.title||'')]
};
function childrenOf(c){
  const list = S.objects.filter(o=>inContainer(c,o));
  const s = c && c.sort && SORTS[c.sort];
  return list.sort(s ? s[1] : (a,b)=>(a.ord||0)-(b.ord||0));
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
function chainOf(id){
  const out=[]; let o=byId(id), n=0;
  while(o && n++ < 100){ out.unshift(o); o = o.parent&&o.parent!==ROOT ? byId(o.parent) : null; }
  return out;
}

/* A timeline's axis, as two dates. Read from what it holds — but an empty
   timeline, or one where everything happened on a Tuesday, has no span to
   measure a drop against, so it opens out to four weeks either side. A timeline
   you cannot drop anything on is a timeline you could never have started. */
const TL_MIN_DAYS = 28;
function tlSpan(c){
  const ds=childrenOf(c).map(x=>x.due||x.created).filter(Boolean).sort();
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
const allTags = ()=>{ const m={}; S.objects.forEach(o=>(o.tags||[]).forEach(t=>m[t]=(m[t]||0)+1)); return Object.entries(m).sort((a,b)=>b[1]-a[1]); };

export { ATTRS, FIELDS, fieldOf, USER_ATTRS, KINDS, KEYS, refreshKinds, K,
  attrsOf, has, kindHas, T, dz, S, sensedDevice, reset, defaultLook, dev, byId,
  deskTitle, rootObj, container, cfgOf, isContainer, FACES, faceOf, SHAPES,
  shapeOf, READS, readOf, spreadOf, gathersOf, gatherKind, containers, isPinned, pinnedDrawers,
  OPS, ROLLS, rollup, SORTS, childrenOf, isAncestor,
  relatedTo, backlinksTo, relate, unrelate, chainOf, tlSpan, streak, goalPct, allTags };
