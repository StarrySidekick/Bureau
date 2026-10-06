/* ---- the Showroom — decision 309 -----------------------------------------
   Timothy, 2026-10-05: *"create a bunch of example boards to illustrate all
   the different aspects of Bureau and all these new things that we've made
   so I can kind of see them and have that be something that I can just sort
   of easily access it so that when we test I can see these big spreads and
   everything. And that includes the wikis that we've made, of course."*

   One drawer on the desk, **the Showroom**, and inside it a room per part of
   Bureau, each a full board laid out in reading order with real things on
   it: every kind of paper, the Words door, lists and tasks, drawers and
   their faces, the doodads and tools, pictures and decor, sections and
   links, string and stamps and zones, paper on paper, Claude, the desk that
   helps, the benches, and doors into the three project wikis.

   Pure data in the paste grammar (docs/GRAMMAR.md), with decision 309's
   additions: `look` (any field the Look and Behavior doors write), `dress`
   (a picture, a painting, a record or a clip, by name), `ref`/`tie` (string,
   by local name), `group`, and `pile`/`fan` (a stack, laid as one). The
   names `dash:bureau`, `dash:composerskey` and `dash:everypark` are the three
   dashboards, filled in by `shipShowroom()` in persist.js.

   **The Showroom keeps to itself** (`sample`, `sampleOf()` in model.js): its
   dated tasks and open projects are collected only by the sorting drawers in
   it, so nothing here reaches the real Now, Today or a calendar on the desk.

   Shipped by `shipShowroom()`: laid on an existing desk once (migration 64),
   and laid again, fresh, when `SHOW_V` moves or Settings → About asks; the
   one it replaces goes to the bin. It is a place to look and to try things,
   so nothing in it is kept across a new version. */

const SHOW_V = 1;

const H = title => ({type:'label', title, w:8, h:1});
const about = (body, h=5) => ({type:'note', title:'What this room shows', body, w:4, h});
const contents = (h=5) => ({type:'contents', title:'Contents', w:4, h});
const note = (title, body, w=4, h=3, more) => Object.assign({type:'note', title, body, w, h}, more||{});
const todo = (title, more) => Object.assign({type:'task', title, due:null}, more||{});
/* A list shows its newest first, so its lines are written last to first
   to read in the order given. */
const list = (title, kids, w=4, h=5, more) => Object.assign({type:'list', title, w, h, children:[...kids].reverse()}, more||{});
const check = (title, kids, w=4, h=5, more) => Object.assign({type:'checklist', title, w, h, children:[...kids].reverse()}, more||{});
const room = (title, color, knob, kids, more) => Object.assign({type:'drawer', title, w:4, h:2, arrange:'rows',
  look:{c:color, kshape:knob}, children:kids}, more||{});
const LINE = 'The quick brown fox jumps over the lazy dog.';

/* ---------------------------------------------------------------- Paper */
const paper = room('Paper', 3, 'note', [
  about('Everything written down, in the shape paper comes in. Each type has its own silhouette, and every sheet can wear a different border, stock, seal and size of type (hold one, **Edit Look**).\n\nPress any of them to read it.'),
  contents(),
  H('Notes and thoughts'),
  note('A note', 'Something to remember. The plain sheet: a title and the words under it.'),
  {type:'idea', title:'An idea', body:'A spark, unformed. Folded at the corner so it reads as not finished.', w:4, h:3},
  {type:'thought', title:'A thought', body:'Something that crossed your mind, before it goes.', w:4, h:3},
  {type:'quote', title:'Annie Dillard', body:'How we spend our days is, of course, how we spend our lives.', w:4, h:3, rating:5},
  {type:'poem', title:'Fog', body:'The fog comes\non little cat feet.\n\nIt sits looking\nover harbor and city\non silent haunches\nand then moves on.', w:4, h:5},
  {type:'essay', title:'An essay', body:'> Working thesis: a desk is a better index than a folder.\n\nLong-form writing starts here.', w:4, h:5},
  H('Questions and problems'),
  {type:'question', title:'Black and white or color?', body:'It decides the stock and the grade.', answer:'Black and white. The lighthouse is the only light in the film.', w:4, h:3},
  {type:'question', title:'Who plays the keeper?', body:'Open until the answer is written in its box.', w:4, h:3},
  {type:'problem', title:'The van is booked twice', body:'Saturday, both shoots.', prio:4, w:4, h:3},
  {type:'outline', title:'An outline', body:'1. The radio goes quiet\n2. The supply boat\n3. The storm\n4. The light comes back on', w:4, h:3},
  H('Letters and pages'),
  {type:'letter', title:'Dear Sam', body:'Thank you for the loan of the lens. It is coming back on Friday, cleaned.', w:4, h:3},
  {type:'postcard', title:'From Lisbon', body:'The trams are yellow and the hills are steeper than they look.', w:4, h:4, dress:'p05'},
  {type:'script', title:'Scene 12', body:'INT. LIGHTHOUSE - NIGHT\n\nThe radio crackles. ELENA does not answer it.', w:4, h:3},
  {type:'review', title:'Paris, Texas', body:'The long phone booth scene, and the color.', rating:5, w:4, h:3},
  H('The same sheet, dressed'),
  note('Gilt', 'border: gilt', 2, 2, {look:{border:'gilt'}}),
  note('Heavy', 'border: heavy', 2, 2, {look:{border:'heavy'}}),
  note('Gloss', 'border: gloss', 2, 2, {look:{border:'gloss'}}),
  note('None', 'border: none', 2, 2, {look:{border:'none'}}),
  note('Laid', 'stock: laid', 2, 2, {look:{stock:'laid'}}),
  note('Card', 'stock: card', 2, 2, {look:{stock:'card'}}),
  note('Aged', 'stock: aged', 2, 2, {look:{stock:'aged'}}),
  note('Wove', 'stock: wove', 2, 2, {look:{stock:'wove'}}),
  note('Sealed', 'A wax blob.', 2, 2, {look:{seal:'blob'}}),
  note('Star', 'A star seal.', 2, 2, {look:{seal:'star'}}),
  note('Crest', 'A crest.', 2, 2, {look:{seal:'crest'}}),
  note('Bee', 'A bee.', 2, 2, {look:{seal:'bee'}}),
  note('Torn note', 'shape: torn note', 4, 2, {look:{shape:'tornnote'}}),
  note('Index card', 'shape: index', 4, 2, {look:{shape:'index'}}),
  note('Bubble', 'shape: bubble', 4, 2, {look:{shape:'bubble'}}),
  note('Big type', 'tsize 1.6', 4, 2, {look:{tsize:'1.6'}}),
  H('Cards'),
  {type:'card', title:'The Lovers', body:'A choice.', w:2, h:3, look:{suit:'heart'}},
  {type:'card', title:'The Tower', body:'Sudden change.', w:2, h:3, look:{suit:'spade'}},
  {type:'card', title:'The Star', body:'Hope.', w:2, h:3, look:{suit:'star'}},
  {type:'card', title:'Face down', body:'Press it to turn it over.', w:2, h:3, look:{down:true, back:'rider'}},
  {type:'deck', title:'Deck', w:2, h:3, seed:false, children:[
    {type:'card', title:'Write the logline', look:{suit:'diamond'}}, {type:'card', title:'Cast the keeper', look:{suit:'club'}},
    {type:'card', title:'Find the lighthouse', look:{suit:'heart'}}]},
  {type:'achievement', title:'Finished the first draft', w:3, h:1},
  {type:'achievement', title:'Ran five kilometers', w:3, h:1},
  H('A story world'),
  {type:'character', title:'Elena', body:'The keeper. Forty, careful, stops answering the radio in week three.', w:4, h:5},
  {type:'place', title:'Skerry Light', body:'A granite tower on a rock a mile out. One room per floor.', w:4, h:5},
  {type:'artifact', title:'The radio', body:'Valve set, 1951. Still works.', w:4, h:4},
  {type:'law', title:'The light stays on', body:'Whatever happens, the lamp is lit at dusk.', w:4, h:4},
], {key:'show:paper'});

/* ---------------------------------------------------------------- Words */
const set = (title, words, body, w=4, h=3) => ({type:'note', title, body: body || LINE, w, h, words});
const MARKDOWN = `# Everything a page can say

A paragraph with **bold**, *italic*, ~~struck~~, ==highlighted== and ++underlined++ words, and a link to [[Typefaces]].

- a list
- with items
  - and one inside

1. numbered
2. in order

| Department | Lead | Days |
| --- | --- | --- |
| Camera | Ana | 6 |
| Sound | Ben | 4 |

\`\`\`
code, set in mono
\`\`\`

> A quotation, set apart.

>> A pull quote, large in the middle of the page.

!!! A callout: something to notice.

+++

## A second page

The three plus signs above break the page here.`;
const words = room('Words', 9, 'paint', [
  about('The **Words door** (hold a written thing, **Edit Look**, Words): the typeface, the ink, the paper, the weight, the case, the spacing, the alignment, a drop capital and ten page layouts. Each sheet here is one setting changed.\n\nOpen the long page at the bottom to see everything a page can draw.'),
  contents(),
  H('Typefaces'),
  set('Garamond', {tfont:'garamond'}), set('Futura', {tfont:'futura'}),
  set('Didot', {tfont:'didot'}), set('Typewriter', {tfont:'typewriter'}),
  set('Hand', {tfont:'hand'}), set('Marker', {tfont:'marker'}),
  set('Chalk', {tfont:'chalk', paperc:'#233A2E', ink:'#FBF7EE'}), set('Script', {tfont:'script'}),
  H('Ink and paper'),
  set('Night', {paperc:'#1E2A44', ink:'#E9D9A6'}), set('Legal pad', {paperc:'#F6E36B', ink:'#1F2F4A'}),
  set('Rose', {paperc:'#F4D6D2', ink:'#8E2B25'}), set('Straight on the board', {paperc:'none', halo:'soft'}),
  H('Setting'),
  set('Capitals, spaced', {tcase:'upper', track:'wide'}), set('Centered', {talign:'centre'}),
  set('Heavy', {tweight:'900'}), set('Double spaced', {lead:'double'}),
  set('A drop capital', {dropcap:'on'}, 'Once upon a time the keeper climbed the hundred and four steps to the lamp, as she had every evening for eleven years, and lit it.', 8, 3),
  H('Page layouts'),
  set('Manuscript', {doc:'manuscript'}, 'Chapter One\n\nThe radio had been quiet for three days.'),
  set('Screenplay', {doc:'screenplay'}, 'EXT. SKERRY LIGHT - DUSK\n\nThe lamp turns. Nobody answers the radio.'),
  set('Letter', {doc:'letter'}, 'Dear Sam,\n\nThe lens is coming back on Friday.\n\nYours,\nTimothy'),
  set('Magazine', {doc:'magazine'}, 'The keepers are gone from every light on this coast but one.'),
  set('Poem', {doc:'poem'}, 'The fog comes\non little cat feet.'),
  set('Typewritten', {doc:'typewritten'}, 'Memo: the boat is late again.'),
  set('Notebook', {doc:'notebook'}, 'Tuesday. Rain. Fixed the radio, did not use it.'),
  set('Broadsheet', {doc:'broadsheet'}, 'LIGHT STAYS ON THROUGH STORM'),
  H('Markdown'),
  {type:'note', title:'Typefaces', body:'This page is linked from the long one beside it, and says so at its foot.', w:4, h:4},
  {type:'note', title:'Everything a page can say', body:MARKDOWN, w:4, h:4},
], {key:'show:words'});

/* ------------------------------------------------------- Lists and tasks */
const lists = room('Lists and tasks', 6, 'plus', [
  about('Tasks, and the things that hold them. The tasks below were typed the way you would type them, **"call the venue friday !!"**, and read for their day and priority.\n\nThe Now and the calendar here collect only from the Showroom.'),
  {type:'now', title:'Now', w:4, h:5},
  H('Tasks'),
  'Water the fig tomorrow',
  'Call the venue friday !!',
  'Pay the storage unit next week',
  'Send the invoice !!!',
  todo('Back up the card'),
  'Book the rehearsal room in 3 days',
  H('Checklists and lists'),
  check('Packing for the shoot', [todo('Tripod'), todo('Spare batteries'), todo('Gaffer tape'), todo('Lunch for six'), todo('The release forms')], 4, 6),
  list('Reading pile', [{type:'note', title:'On Writing', body:'King.'}, {type:'quote', title:'Dillard', body:'How we spend our days.'},
    {type:'idea', title:'A film about a radio'}, {type:'question', title:'Is the bridge open on Sunday?'}], 4, 6),
  H('Writing it down'),
  {type:'notepad', title:'Write a line and press return', w:8, h:1, ref:'pad', tie:'jot'},
  list('Jotted', [{type:'thought', title:'The notepad above is tied to this list with string'}], 4, 4, {ref:'jot'}),
  {type:'cp_barlist', title:'Checklist with a bar'},
  H('In time'),
  {type:'calendar', title:'This month', w:4, h:4},
  {type:'progressbar', title:'Draft two', w:4, h:1, look:{milestones:[{t:'Act one', done:true}, {t:'Act two', done:true},
    {t:'Act three', done:true}, {t:'Polish', done:false}, {t:'Table read', done:false}]}},
  {type:'timeline', title:'The shoot', w:8, h:3, children:[
    {type:'appt', title:'Scout', due:'+3'}, {type:'appt', title:'Rehearse', due:'+10'}, {type:'appt', title:'Shoot day', due:'+17'}, {type:'appt', title:'Picture lock', due:'+40'}]},
], {key:'show:lists'});

/* -------------------------------------------------- Drawers and faces */
const inside = (t='Something inside') => [note(t, 'A drawer holds things on a board of its own. Press the front to open it.')];
const drawer = (title, look, w=2, h=2, kids) => ({type:'drawer', title, w, h, look, children: kids || inside()});
const drawers = room('Drawers and faces', 11, 'doorknob', [
  about('A **drawer** is a container on the grid that opens onto a board of its own. Its front can be any color, its knob any shape, its panel and plate any style. Some containers have a face that shows what is inside without opening it.'),
  contents(),
  H('Knobs'),
  drawer('Heart', {c:11, kshape:'heart'}), drawer('Apple', {c:6, kshape:'apple'}),
  drawer('Compass', {c:4, kshape:'compass'}), drawer('Bell', {c:9, kshape:'bell'}),
  drawer('Reel', {c:13, kshape:'reel'}), drawer('Coin', {c:8, kshape:'coin'}),
  drawer('Die', {c:2, kshape:'die'}), drawer('Fist', {c:14, kshape:'fist'}),
  H('Panels and plates'),
  drawer('Fielded', {c:7, panel:'fielded'}, 4, 2), drawer('Reeded', {c:5, panel:'reeded'}, 4, 2),
  drawer('Ogee, engraved', {c:12, panel:'ogee', plate:'engraved'}, 4, 2), drawer('Cockbead, tag', {c:3, panel:'cockbead', plate:'tag'}, 4, 2),
  H('Faces that show inside'),
  {type:'jar', title:'Buttons', w:2, h:3, children:[note('A button', ''), note('Another', ''), note('A third', '')]},
  {type:'pigeonhole', title:'Letters', w:2, h:3, children:[{type:'letter', title:'From the bank'}, {type:'letter', title:'From Sam'}]},
  {type:'novel', title:'The Keeper', w:1, h:3, look:{binding:'ribbed'}, children:[{type:'scene', title:'The radio'}, {type:'scene', title:'The boat'}]},
  {type:'shortstory', title:'Fog', w:1, h:3, look:{binding:'banded'}, children:[{type:'scene', title:'Harbor'}]},
  {type:'moodboard', title:'Mood', w:2, h:3, dress:true},
  {type:'project', title:'A project', w:2, h:2, status:true, children:[todo('Write the treatment'), todo('Budget'), {type:'question', title:'Which festival first?'}]},
  {type:'film', title:'A film', w:2, h:2},
  H('A drawer as a list'),
  {type:'drawer', title:'Line view', w:4, h:4, layout:'list', children:[note('First', ''), note('Second', ''), todo('A task in a list')]},
  {type:'calendar', title:'This week', w:4, h:4, look:{calview:'week', calshow:'titles'}},
], {key:'show:drawers'});

/* ------------------------------------------------------------- Doodads */
const doodads = room('Doodads and tools', 8, 'reel', [
  about('Things that do something when pressed. The **instruments** keep time or chance; the **counters** count; a **button** makes, opens or flips; the **tools** are the drawer front\'s, as objects you can put on any board.\n\nHold one to see its settings.'),
  contents(),
  H('Instruments'),
  {type:'metronome', title:'Metronome', w:2, h:4, look:{bpm:96}},
  {type:'hourglass', title:'Five minutes', w:2, h:4, look:{mins:5}},
  {type:'candle', title:'An hour', w:2, h:4, look:{burn:60}},
  {type:'bell', title:'Desk bell', w:2, h:4},
  {type:'clock', title:'Table', w:2, h:2, look:{clock:'table'}}, {type:'clock', title:'Wall', w:2, h:2, look:{clock:'wall'}},
  {type:'clock', title:'Alarm', w:2, h:2, look:{clock:'alarm'}}, {type:'clock', title:'Cuckoo', w:2, h:2, look:{clock:'cuckoo'}},
  {type:'die', title:'Six', w:2, h:2, look:{sides:6}}, {type:'die', title:'Twenty', w:2, h:2, look:{sides:20}},
  H('Counters'),
  {type:'counter', title:'Pages written', count:1284, w:8, h:2, look:{wheelc:'#2E4A6B', wink:'#FFFFFF', wfont:'typewriter'}},
  {type:'counter', title:'Cups', count:7, w:2, h:2, look:{wheelc:'#8E3B38', wink:'#E2B85C', wfont:'didone'}},
  {type:'counter', title:'Days', count:41, w:2, h:2, look:{wheelc:'#E9E1CC', wink:'#16120E', wfont:'slab'}},
  {type:'cp_habit', title:'Habit tracker'},
  H('Buttons'),
  {type:'button', title:'Make an idea', w:1, h:1, look:{does:'make', genKind:'idea', bimg:'b03'}},
  {type:'button', title:'Lights', w:1, h:1, look:{does:'switch', ctl:'dark', bimg:'b07'}},
  {type:'button', title:'Make a task', w:4, h:1, look:{does:'make', genKind:'task', bimg:'b01'}},
  H('Tools'),
  {type:'tglass', w:1, h:1}, {type:'tblock', w:1, h:1}, {type:'tlock', w:1, h:1}, {type:'tswipe', w:1, h:1},
  {type:'spool', w:1, h:1}, {type:'tstamp', w:1, h:1, look:{stampw:'Paid'}}, {type:'tpen', w:1, h:1}, {type:'coin', w:1, h:1},
  note('What each tool does', 'Glass: search this board. Block: the next sort. Padlock: lock everything. Switch: smooth or rigid. Spool: tie two things. Stamp: stamp things. Pen: ask Claude. Coin: one of anything.', 8, 2),
], {key:'show:doodads'});

/* -------------------------------------------------- Pictures and decor */
const decor = room('Pictures and decor', 13, 'compass', [
  about('Pictures, paintings, sound and film, portals out of Bureau, and the things that only decorate: plants, objects, and what lies under everything else.'),
  contents(),
  H('Pictures'),
  {type:'image', title:'', w:4, h:3, dress:'p01', look:{frame:'gilt'}},
  {type:'image', title:'', w:4, h:3, dress:'p04', look:{frame:'polaroid'}},
  {type:'painting', title:'', w:4, h:3, dress:'a07'},
  {type:'painting', title:'', w:4, h:3, dress:'a12'},
  {type:'window', title:'A view', w:4, h:3, dress:'p02'},
  {type:'moodboard', title:'A collage', w:4, h:3, dress:true},
  H('Sound and film'),
  {type:'audio', title:'', w:2, h:2, dress:'s01', look:{vinyl:'#8E2B2B'}},
  {type:'audio', title:'', w:2, h:2, dress:'s02', look:{vinyl:'#23456E'}},
  {type:'video', title:'', w:4, h:3, dress:'v01'},
  {type:'video', title:'', w:4, h:3, dress:'v05'},
  H('Portals'),
  {type:'outlink', title:'The Met', url:'https://www.metmuseum.org/art/collection', w:3, h:3, look:{pshape:'arch', pstyle:'glimpse', pedge:'vines', c:6}},
  {type:'outlink', title:'Wikipedia', url:'https://en.wikipedia.org/wiki/Special:Random', w:2, h:2, look:{pshape:'circle', pstyle:'vortex', pedge:'glow', c:4}},
  {type:'outlink', title:'NASA', url:'https://www.nasa.gov/image-of-the-day/', w:3, h:3, look:{pshape:'square', pstyle:'drift', pedge:'none', c:9}},
  H('Plants and objects'),
  {type:'plant', title:'Jardiniere', w:2, h:3, look:{decor:'jardiniere'}},
  {type:'plant', title:'Pansy', w:2, h:3, look:{decor:'pansy'}},
  {type:'plant', title:'Lily', w:2, h:3, look:{decor:'lily'}},
  {type:'ornament', title:'Globe', w:2, h:2, look:{decor:'globe'}},
  {type:'ornament', title:'Inkstand', w:2, h:2, look:{decor:'inkstand'}},
  {type:'ornament', title:'Teapot', w:2, h:2, look:{decor:'teapot'}},
  {type:'ornament', title:'Lamp', w:2, h:2, look:{decor:'lamp'}},
  H('Under things'),
  {type:'background', title:'Gingham', w:4, h:3, look:{fill:'gingham'}},
  {type:'background', title:'Cork', w:4, h:3, look:{fill:'cork'}},
  {type:'mat', title:'A board on the board', w:8, h:4},
], {key:'show:decor'});

/* ------------------------------------------------- Sections and links */
const sections = room('Sections and links', 4, 'compass', [
  contents(4),
  about('How the wikis work. A **Label** 8 wide is a section heading; the **Contents** lists them and goes to one; the board\'s name on the lip says which section you are in, and opens the same list.\n\nA page names another as **[[The keeper]]**, and the page named says so at its foot.', 4),
  H('Pages that link'),
  list('Pages', [
    {type:'note', title:'The keeper', body:'Elena, forty. See [[The light]] and [[The radio]].'},
    {type:'note', title:'The light', body:'Lit at dusk, every night. Kept by [[The keeper]].'},
    {type:'note', title:'The radio', body:'A valve set. [[The keeper]] stops answering it.'},
  ], 4, 5),
  note('Try it', 'Open **The keeper**, press a link, then look at the foot of the page it opens: *Linked from*.', 4, 5),
  H('A front that reports'),
  {type:'project', title:'The Lighthouse', w:4, h:3, status:true, children:[
    todo('Write the logline'), todo('Scout the rock'), todo('Cast the keeper'),
    {type:'question', title:'Black and white or color?'}]},
  note('The status line', 'A project whose front says what is open: things to do and questions to answer, counted from inside it.', 4, 3),
  H('A section further down'),
  note('Keep scrolling', 'The lip at the top names this section now. Press it for the contents.', 8, 2),
  H('And one more'),
  note('The end of the board', 'A long board is moved through by its sections rather than by scrolling.', 8, 2),
], {key:'show:sections'});

/* ------------------------------------------- String, stamps and zones */
const string = room('String, stamps and zones', 14, 'bell', [
  about('Ways things refer to each other on a board. **String** ties one thing to another (the spool). A **stamp** leaves a dated impression. A **zone** gives what is put in it a priority or a tag. A **group** moves as one. A **copper pipe** sends what is dropped in it to a drawer.'),
  contents(),
  H('String'),
  note('Tied', 'This sheet is tied to the one beside it.', 4, 3, {ref:'a', tie:'b'}),
  note('To this', 'Use the spool: press it, then two things.', 4, 3, {ref:'b'}),
  {type:'card', title:'Into the archive', body:'Tied to a drawer with tug set to open: pressing it goes in.', w:2, h:3, look:{tug:'open'}, tie:'arch'},
  {type:'drawer', title:'Archive', w:2, h:2, ref:'arch', children:[note('Filed', 'You came here through the card.')]},
  {type:'pipe', title:'Ideas', w:1, h:1, look:{takes:'idea'}, tie:'ideas'},
  {type:'drawer', title:'Ideas drawer', w:2, h:2, ref:'ideas', children:[{type:'idea', title:'Dropped down the pipe'}]},
  H('Stamps'),
  {type:'tstamp', w:1, h:1, look:{stampw:'Received', stampink:'red'}},
  {type:'letter', title:'The lease', body:'Signed and returned.', w:3, h:3, look:{stamps:[{w:'Received', d:'2026-10-01', ink:'red'}, {w:'Paid', d:'2026-10-03', ink:'blue'}]}},
  {type:'note', title:'Invoice 14', body:'Six days of camera.', w:4, h:3, look:{stamps:[{w:'Approved', d:'2026-10-04', ink:'green'}]}},
  H('Zones'),
  {type:'zone', title:'Urgent', w:4, h:4, look:{writes:{prio:5}}},
  {type:'zone', title:'Someday', w:4, h:4, look:{writes:{prio:1}}},
  H('A group'),
  note('These two', 'Grouped: carry one and both come.', 4, 2, {group:'pair'}),
  note('Move as one', 'Hold either, **Ungroup** to part them.', 4, 2, {group:'pair'}),
], {key:'show:string'});

/* --------------------------------------------------- Paper on paper */
const chapter = (t, b) => ({type:'note', title:t, body:b, w:6, h:5, fan:'book'});
const overlap = room('Paper on paper', 5, 'paint', [
  about('**New.** Drop one sheet on another and it lies on top, the way paper does. Hold a sheet in a stack for **Square Up** (a pile), **Fan Out** (every name showing) or **Spread Out**.\n\nTap a pile and its sheets drop down as slips: a dropdown. A fan is a contents made of the pages themselves.', 6),
  contents(),
  H('A pile: tap it'),
  {type:'note', title:'Call sheet', body:'Saturday. Crew at the harbor at six.', w:4, h:4, pile:'p'},
  {type:'note', title:'Shot list', body:'Wide of the rock, the stairs, the lamp room.', w:4, h:4, pile:'p'},
  {type:'note', title:'Release forms', body:'Six, signed.', w:4, h:4, pile:'p'},
  {type:'note', title:'Tide table', body:'Low water 11:42.', w:4, h:4, pile:'p'},
  note('How it works', 'The pile takes the room of one sheet. Its edges show at the lower right, one for each sheet under the top.', 4, 4),
  H('A fan: a contents'),
  chapter('1. The radio', 'For three days nobody has answered.'),
  chapter('2. The boat', 'The supply boat comes early.'),
  chapter('3. The storm', 'Wind from the southwest, then everything.'),
  chapter('4. The light', 'At dusk, as always, it comes on.'),
  note('Press a name', 'Each chapter is a whole page, fanned one row apart. Press a name to open it.', 2, 5),
  H('Index cards'),
  ...['Logline','Theme','Ending','Title'].map(t=>({type:'note', title:t, body:'An index card.', w:3, h:3, look:{shape:'index'}, fan:'cards'})),
], {key:'show:overlap'});

/* ------------------------------------------------------------- Claude */
const lisbon = {type:'project', title:'A weekend in Lisbon', children:[
  {type:'contents', title:'Contents'},
  {type:'checklist', title:'Next', w:4, h:4, children:[todo('Book the Alfama room'), todo('Reserve the tram tour'), todo('Find the miradouro for sunset')].reverse()},
  {type:'note', title:'About', body:'Three days in October, on foot, with a camera.', w:4, h:5},
  {type:'label', title:'Days', w:8, h:1},
  {type:'list', title:'The plan', w:4, h:5, children:[
    {type:'note', title:'Saturday', body:'Alfama in the morning, the castle, fado at night.'},
    {type:'note', title:'Sunday', body:'Belém: the tower, the monastery, the custard tarts.'},
    {type:'note', title:'Monday', body:'The 28 tram, then the flight at six.'}].reverse()},
  {type:'list', title:'Open questions', w:4, h:5, children:[{type:'question', title:'Rent a car for Sintra?'}]},
]};
const claude = room('Claude', 7, 'note', [
  about('**New.** Claude writes objects, never chat, once your key is in **Settings, Claude**. The fountain pen builds a board, which arrives as a **flat-pack**; hold a task for **Break Down**, a question for **Draft Answer**, a drawer for **Fill In**; draw a box with the Magic Selector and pick **Claude**.\n\nThe parcel here was packed in advance, so it unfolds without a key.', 6),
  contents(),
  H('Ask'),
  {type:'tpen', w:1, h:1},
  note('The pen', 'Press it and say what to build.', 3, 2),
  {type:'flatpack', title:'A weekend in Lisbon', w:2, h:2, pack:lisbon},
  note('A parcel', 'Press it to unfold.', 2, 2),
  H('What it writes'),
  {type:'question', title:'Which festival first?', body:'Sundance closes in September.', answer:'Start with Rotterdam: it takes shorts in October and premieres count for Sundance next year.', w:4, h:3, look:{drafted:true}},
  note('A draft', 'Claude\'s answers arrive as drafts, in italics, and the question still counts as open until you change a word or keep it.', 4, 3),
  todo('Plan the shoot day', {w:4, h:1}),
  note('Break it down', 'Hold the task above and choose Break Down: it becomes a checklist of its steps.', 4, 2),
], {key:'show:claude'});

/* --------------------------------------------------- A desk that helps */
const helps = room('A desk that helps', 2, 'plus', [
  about('**New.** Things the desk does for you. Every typed line is read for its day, its priority and its place. **Now** shows what is due and the next step of every project. A backup is kept every day, and before anything big.'),
  {type:'now', title:'Now', w:4, h:5},
  H('A line that is read'),
  {type:'notepad', title:'Try: call Sam friday !!', w:8, h:1},
  list('What it understands', [
    {type:'note', title:'A day', body:'today, tonight, tomorrow, friday, next friday, this weekend, next week, in 3 days, oct 12'},
    {type:'note', title:'A priority', body:'! to !!! at the end of a line'},
    {type:'note', title:'A place', body:'@kitchen files it in the first drawer whose name starts with that'},
    {type:'note', title:'A tag', body:'#film'}], 4, 5),
  note('Backups', 'Settings, About, Backups: go back to any day this week, or to just before something big. The desk you had is kept as a backup first.', 4, 5),
  H('A project with a next step'),
  {type:'project', title:'Short film', w:4, h:3, status:true, children:[
    {type:'checklist', title:'Next', w:4, h:4, children:[todo('Lock the script'), todo('Cast the keeper')].reverse()}]},
  note('Why it is in Now', 'Its first unchecked step is in the Now above. Check it off and the next one takes its place.', 4, 3),
  'Renew the lens insurance today',
], {key:'show:helps'});

/* ------------------------------------------------------------ Benches */
const benches = room('Benches', 12, 'die', [
  about('A **bench** is a drawer set up for one kind of work, bringing its own room: its look, its tools, its layout. These are the seven that are ready. Open one, use it, throw it away: the Showroom lays a fresh set each time.'),
  {plan:'braindump', title:'Brain Dump'},
  {plan:'prioritizer', title:'Prioritizer'},
  {plan:'brainstorming', title:'Brainstorm'},
  {plan:'storybuilder', title:'Story Builder'},
  {plan:'journal', title:'Journal'},
  {plan:'shortfilm', title:'Short Film'},
  {plan:'featurefilm', title:'Feature Film'},
], {key:'show:benches'});

/* ---------------------------------------------------- the Showroom itself */
const wiki = (title, key, color) => ({type:'card', title, body:'Your project wiki. Press to go there.', w:2, h:3,
  look:{tug:'open', suit:'none', c:color}, tie:'dash:'+key});
const SHOWROOM = {type:'drawer', key:'showroom', title:'Showroom', w:4, h:3, arrange:'rows',
  // `sample` first, so the benches laid inside it already know where they are
  look:{c:7, kshape:'compass', panel:'fielded', plate:'engraved', sample:true}, children:[
  {type:'note', title:'Read me first', body:'A room for each part of Bureau, each a full board with real things on it, to look at and to try. Open a room, press things, hold them, move them: nothing here is yours to keep, and a new version of the Showroom replaces this one (the old one goes to the bin).\n\nNothing in here reaches your real **Now**, **Today** or calendars.\n\nTo lay a fresh one: **Settings, About, Showroom**. Every type and every look side by side is the **Specimen book**, in Settings.', w:4, h:6},
  contents(6),
  H('The rooms'),
  paper, words, lists, drawers, doodads, decor, sections, string,
  H('New this week'),
  overlap, claude, helps, benches,
  H('Your wikis'),
  wiki('Bureau', 'bureau', 7), wiki('Composer’s Key', 'composerskey', 4), wiki('EveryPark', 'everypark', 6),
  note('The real ones', 'These three cards go to the project dashboards on your desk; they are not copies. Each is a wiki: contents, next steps, open questions, then a section per subject.', 2, 3),
]};

export { SHOW_V, SHOWROOM };
