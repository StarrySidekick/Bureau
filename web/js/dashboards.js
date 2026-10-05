/* ---- the project dashboards — decision 304 ------------------------------
   Timothy's three projects as dashboards that ship with the app: Bureau,
   Composer's Key and EveryPark. Pure data in the paste grammar
   (docs/GRAMMAR.md), so nothing here imports anything and a script can read
   it too (scripts/wiki-paste.mjs writes docs/examples/wiki.json from it).

   **The first screen is the dashboard; below it is the reference.** Portals
   into the real thing, a Contents, what is next, the open questions and a
   short About, then a section per subject, each a heading and a pair of
   lists whose lines open pages. The repos' own docs stay the reference:
   these pages are summaries with portals to them, not copies.

   Shipped by `shipDashboards()` in persist.js: laid on an existing desk once
   (migration 63), then **brought up to date** whenever `DASH_V` moves, by the
   paste's update rules: a page you have written on, a check, an answer and
   anything you moved or deleted are left as you left them. To change a
   dashboard, edit it here and bump `DASH_V`. To rename a thing, give it a
   `key` equal to its old key (the title, lowercased, after the project's
   key and a colon) or it arrives as a new thing beside the old one. */

const DASH_V = 1;

const H = title => ({type:'label', title, w:8, h:1});
const page = (title, body) => ({type:'note', title, body});
const ask = (title, body) => ({type:'question', title, body});
const go = (title, url) => ({type:'outlink', title, url});
const todo = title => ({type:'task', title, due:null});
/* A list shows its newest first, so its lines are written last to first
   to read in the order given. */
const list = (title, kids, w=4, h=5) => ({type:'list', title, w, h, children:[...kids].reverse()});
const check = (title, kids, w=4, h=5) => ({type:'checklist', title, w, h, children:[...kids].reverse()});
const about = body => ({type:'note', title:'About', body, w:4, h:5});
const contents = () => ({type:'contents', title:'Contents', w:4, h:5});
const GH = 'https://github.com/StarrySidekick/';

/* ---------------------------------------------------------------- Bureau */
const bureau = {type:'project', key:'bureau', title:'Bureau', color:7, children:[
  go('Open Bureau', 'https://starrysidekick.github.io/Bureau/'),
  go('The repository', GH+'Bureau'),
  go('The Workshop', 'https://claude.ai/artifact/4TjyQZ5xcuxCYFgfnRm76k'),
  go('The Scope', 'https://claude.ai/artifact/MjuzPyN2CXcdYmN4MRxqJY'),
  contents(),
  check('Next', [
    todo('Answer the six navigation questions'),
    todo('Live in these dashboards for a week'),
    todo('Decide on stations: names for tiles'),
    todo('Pick the next bench to bring back'),
  ]),
  list('Open questions', [
    ask('Edges closed or open?', 'On a bench’s board, closed by default and open on a drawer you made? Or always open unless a bench says so? (NAVIGATION §9)'),
    ask('Name the tiles?', 'Stations: worth naming tiles? The biggest new idea in the navigation scope, and the one the Film and Story Builder benches most want.'),
    ask('Story Builder as five stations?', 'An act per tile, or keep the journey on one tile and make it bigger?'),
    ask('Which tools to make?', 'The compass, the loupe, the ribbon, the pencil ledge: which, if any?'),
    ask('Does the contents page earn its place?', 'On these three boards: is the Contents object, and the section name on the lip, how you want to move down a long board?'),
  ]),
  about('A to-do, note, idea and writing app for one person, where **everything sits on a grid**. Hand-written HTML, CSS and ES modules: no build, no dependencies, local only.\n\nUsed on an iPhone, in the installed Safari PWA, first.'),

  H('The idea'),
  list('About Bureau', [
    page('What it is', 'Drawers are containers on the grid and open onto grids of their own; objects are everything else, and what an object can do is its attributes. Not files, not a feed, not a database of items. The desk *is* the app: no toolbar, no sidebar, only the grid.\n\nSee [[Comparables]] and [[Not a product]].'),
    page('Not a product', 'Bureau is not for other people. Every design decision is made for **one user**. It is used, for now, to fiddle with rather than live in, and the gap is a layout that fits an actual life.'),
    page('The axis now: functions', 'What a paper desk lets you *do*: file, annotate, cross-reference, clip, stamp, copy, tear out, pin, date, archive. Fifteen are scoped in `docs/FUNCTIONS.md`. Look work is no longer the default answer to "what now".'),
    page('Comparables', '**Things 3:** how a task feels.\n**Bear:** how writing feels.\n**Obsidian:** what to avoid, infinite nesting and file soup.'),
    page('Where it is used', 'An iPhone, in the installed Safari PWA. WebKit is the engine a change is checked in first, at a phone’s size, with touch; the Mac and Chromium come second.'),
  ]),
  {type:'quote', title:'The organizing idea', w:4, h:5, body:'>> The desk *is* the app. There is no toolbar and no sidebar, only the grid.'},

  H('Words'),
  list('Glossary', [
    page('Desk', 'The home board. As big as what is on it, plus eight empty cells each side.'),
    page('Board', 'What a container opens onto: a grid of square cells, eight across on a phone.'),
    page('Tile', 'A stretch of a board, 8 × 14 in a container by default. More are laid by holding the wood beside it.'),
    page('Drawer', 'A container. In the code, anything carrying the `container` attribute.'),
    page('Bench', 'A container set up so one activity is easier in it than anywhere else. Once called a flow; `plan` in the code.'),
    page('Face', 'How a container shows what it holds on its outside: a front, a checklist, a calendar, a spine.'),
    page('Heading', 'Anything carrying `heading` (every Label) starts a section of its board. A [[Contents]] lists them; the top lip names the one you are in.'),
    page('Contents', 'The headings on its board, in order, with how many things sit under each. Press one to go there.'),
    page('Drawer front', 'The rail across the bottom on a phone: glass, letter block, knob, padlock. Six places hold any object.'),
    page('Notepad', 'A ruled line. Write and press return: it becomes what it reads as.'),
    page('Inbox', 'A container that makes whatever it reads as; copper pipes tied to it carry each kind away.'),
    page('Rubber stamp', 'Press it, then press things: each carries an impression and today’s date.'),
  ], 4, 6),
  list('The fifteen', [
    page('Drawer', 'A container on the grid.'), page('List', 'A list of anything, or of things to check off.'),
    page('Calendar', 'Things laid out along time.'), page('Tag', 'Everything that answers to a tag.'),
    page('Text', 'Anything made of words.'), page('Collage', 'Pictures pinned up, or a pigeonhole.'),
    page('Jar', 'Glass: what is in it shows without opening it.'), page('Card', 'A card, a deck of them, or something kept count of.'),
    page('Paper', 'Anything written down.'), page('Picture', 'A photograph, a drawing, anything you have.'),
    page('Video', 'Something to watch.'), page('Audio', 'Something to listen to.'),
    page('Decoration', 'A plant, an object, a painting, a window.'), page('Doodad', 'Things that run and tools you press.'),
    page('Portal', 'A way out of Bureau: a site, an app, a number to call.'),
  ], 4, 6),

  H('How it is built'),
  list('Under the hood', [
    page('Five rules', '1. **Rendering is full re-render.** `render()` rebuilds `#app` from `S`.\n2. **An animation never holds anything up.**\n3. **Events are delegated**, through `data-act` and one listener set.\n4. **Everything is an object; containing is an attribute.**\n5. **Never branch on a type’s name.** Ask `has(o,\'check\')`.'),
    page('The modules', '| Module | Holds |\n| --- | --- |\n| model.js | Attributes and types |\n| grid.js | Cells, boxes, sections |\n| tiles.js | How a thing looks |\n| views.js | The desk and a drawer |\n| gestures.js | Drag, hold, swipe |\n| persist.js | Storage, migrations, paste |\n| wire.js | The one listener |'),
    page('Shipping a change', '- Check it in WebKit first: `node test/safari.mjs`\n- The smoke suite is the gate\n- Bump `CACHE` and `APP_VERSION` together\n- A new file goes in `SHELL`\n- Pushing to main deploys to Pages'),
    page('Invariants that bite', '- Layouts are stored **per device**\n- Cells are square and measured, never assumed\n- Never round the cell size\n- `byId(ROOT)` is undefined: ask `container()`\n- Image bytes live in IndexedDB, never in the JSON\n- Anything that changes a field pushes an undo'),
    page('The paste', 'A JSON list of things, through Settings → Paste an Object, or shipped like these dashboards. It can lay a board out in reading order and come back later to update one without touching what you wrote. The whole vocabulary is `docs/GRAMMAR.md`.'),
  ]),
  list('Docs', [
    go('CLAUDE.md', GH+'Bureau/blob/main/CLAUDE.md'),
    go('INTENT.md', GH+'Bureau/blob/main/INTENT.md'),
    go('SYSTEM.md', GH+'Bureau/blob/main/docs/SYSTEM.md'),
    go('DECISIONS.md', GH+'Bureau/blob/main/docs/DECISIONS.md'),
    go('ROADMAP.md', GH+'Bureau/blob/main/docs/ROADMAP.md'),
    go('GRAMMAR.md', GH+'Bureau/blob/main/docs/GRAMMAR.md'),
    go('NAVIGATION.md', GH+'Bureau/blob/main/docs/NAVIGATION.md'),
    go('BENCHES.md', GH+'Bureau/blob/main/docs/BENCHES.md'),
  ]),

  H('History'),
  list('How it got here', [
    page('Aug 27 · Merge and push without asking', 'The standing instruction: once tested, finished work goes to main.'),
    page('Sep 6 · Intent recorded', 'Functions are the axis. The margin ships first.'),
    page('Sep 21 · Things that sit on a desk', 'Jar, nameplate, string, metronome, hourglass, candle, bell, clock, die.'),
    page('Sep 23 · The camera tabled', 'A note scales up into its surface instead.'),
    page('Sep 30 · Safari first', 'The phone is the primary test. American English in the interface.'),
    page('Oct 1 · The grammar', 'How Claude builds boards reliably.'),
    page('Oct 3 · Navigation scoped', 'The gear on the top lip; the bench skill.'),
    page('Oct 5 · Dashboards', 'Sections, the Contents, links between pages, and these three boards.'),
  ], 8, 5),
]};

/* -------------------------------------------------------- Composer's Key */
const areas = [
  ['The Atrium', 'C ionian · content · 104 bpm', 'The Metronome, First Breath, Crossroads, Crossing'],
  ['The Reed Gallery', 'F lydian · mysterious · 96 bpm', 'The Flute, The Reed Loft'],
  ['The Undercroft', 'A aeolian · sad · 88 bpm', 'The Kit, The Quiet Room, The Keyboard Floor'],
  ['The Cloister', 'D dorian · reflective · 100 bpm', 'The Valve, Left and Right, The Slide'],
  ['The Bell Tower', 'G mixolydian · confident · 100 bpm', 'The Triad, The Stand, The Stair'],
  ['The Discord', 'E phrygian · tense · 108 bpm', 'The Discord, The Coda, The Unresolved Chord'],
];
const rooms = [
  ['The Metronome', 'Silence until you press B on it; then [[The motif]] starts on the next beat.'],
  ['First Breath', 'Face right and press A. The wave travels one tile per sixteenth note.'],
  ['Crossroads', 'The tee divides the wave: half out of the bell below, half onward.'],
  ['Crossing', 'One wave, two locks, and a circuit that has to get past itself.'],
  ['The Flute', 'The note leaves by the first open hole. Cover holes to choose it.'],
  ['The Reed Loft', 'A reed keeps breathing: a wave every beat for a few beats.'],
  ['The Kit', 'Drums are mirrors, and only the head reflects.'],
  ['The Quiet Room', 'Three string runs, three lengths, three pitches.'],
  ['The Keyboard Floor', 'Step on K to swing the mallet; press B on the lock to hear its phrase.'],
  ['The Valve', 'One horn, two forks. Turn the valve, blow again.'],
  ['Left and Right', 'Find where to stand so the wave meets each head.'],
  ['The Slide', 'Every pull of the slide plays the horn’s new note.'],
  ['The Triad', 'Three horns, three forks: three waves in the air at once. The Burin is here.'],
  ['The Stand', 'Carry the reed from [[The Reed Loft]] and set it on the stand.'],
  ['The Stair', 'The lock wants A; the room is in G. Each step up raises the key. See [[Keys and modes]].'],
  ['The Discord', 'Dissonants walk on the beat. A wave resolves them. The score gate wants nine.'],
  ['The Coda', 'The last lock listens to the whole world for la-sol-mi-do.'],
  ['The Unresolved Chord', 'The boss: echo its call, resolve its swarm, answer with a chord.'],
];
const composers = {type:'project', key:'composerskey', title:'Composer’s Key', color:12, children:[
  go('Play it', 'https://starrysidekick.github.io/Composers-Prototype/'),
  go('The repository', GH+'Composers-Prototype'),
  go('Asset review', 'https://claude.ai/artifact/9WZenE4ds34khFiRf5TR91'),
  go('The world map', GH+'Composers-Prototype/blob/main/docs/WORLD.md'),
  contents(),
  check('Next', [
    todo('Play the dungeon on the phone and judge the timing'),
    todo('Listen to the motif and judge it by ear'),
    todo('Drop the GDD into docs/'),
    todo('Copy Unity’s Assets/Sprites across'),
    todo('Port the mirror drums to Unity'),
  ]),
  list('Open questions', [
    ask('Should dissonance matter?', 'A sour wave still lights every lock. Should note locks reject soured notes, or a sour wave fail to light a fork?'),
    ask('Is the boss fun on a phone?', 'Phase three wants the longest horn first and a beat to land all three. Fun or fiddly?'),
    ask('Does the tune work?', 'The motif was composed blind. Nobody has listened to it yet.'),
    ask('What do the hi-hat and strumentino do?', 'Both are in the game with no puzzle of their own.'),
    ask('Is the dissonant’s shove too soft?', 'It shoves Coda on contact. Enough to matter?'),
  ]),
  about('A top-down puzzle game where sound is the tool: Coda carries the Composer’s Key and fires waves through horns, strings, drums and flutes to play the phrase each lock wants.\n\nThis is the **browser prototype**, a fast harness for mechanics that port back into the **Unity** project.'),

  H('The world'),
  list('Areas and moods', areas.map(([t, m, r])=>page(t, `**${m}**\n\n${r}`))),
  list('Rooms, in order', rooms.map(([t, b])=>page(t, b))),

  H('Mechanics'),
  list('Instruments', [
    page('Horn', 'Mouthpiece in, bells out. Tees divide a wave; valves turn. Every tubing structure is a horn.'),
    page('Slide', 'An instrument on its own: every pull plays the horn’s new note.'),
    page('Strings', 'Three runs, three lengths, three pitches. Pegs face their string.'),
    page('Piano keys', 'Stepped on, they swing a mallet. They autotile, sixteen cases.'),
    page('Drums', 'Mirrors in 45° steps. Only the head reflects; the back swallows the wave.'),
    page('Flute', 'The fingering picks the note and the way out: the first open hole.'),
    page('Reed', 'Keeps breathing: a wave a beat for several beats.'),
    page('Hi-hat', 'Ticks. No puzzle yet.'),
    page('Strumentino', 'A blank per-face instrument. No puzzle yet.'),
    page('The Burin', 'Lifts drums and reeds into the satchel (L) and turns the one in hand (R).'),
    page('Overtones', 'An upgrade: more waves in the air at once.'),
    page('Dissonant', 'A sour note that walks on the beat and shoves Coda. Any wave resolves it.'),
  ]),
  list('How it plays', [
    page('Everything in time', 'The wave travels **one tile per sixteenth note** at the room’s bpm, and every sound is synchronized to it (`test/timing.mjs`). Waves carry on through open doors, and a lock can listen to the whole world. It all starts at [[The Metronome]].'),
    page('Keys and modes', 'Each area is one key, mode and tempo, with a title card on entry, and its floor is tinted by mode. Stairs climb: up raises the key. See [[Areas and moods]].'),
    page('The motif', 'A four-bar tune in scale degrees that gains a layer per solved room, ten in all, played in each area’s key and mode. The score gate before the end wants nine.'),
    page('How the rooms join', '**North:** Reed Loft, Flute\n**The Atrium row:** Metronome, Brass 01, 02, 03, Triad\n**Below it:** Keys 01, Strings 01, Percussion 01, Stand\n**The Cloister row:** Brass 04, Percussion 02, Brass 05, Stair\n**The Discord:** Unresolved Chord, Coda, Hall\n\nSolve a room and its door opens. A shortcut from the Reed Loft opens only from the far side.'),
  ]),

  H('Porting to Unity'),
  list('Porting', [
    page('The Y axis trap', 'The prototype is **+y down**; Unity 2D is **+y up**, so every rotation flips.\n\n| | here | Unity |\n| --- | --- | --- |\n| CW | (-y, x) | (y, -x) |\n| up | (0, -1) | (0, 1) |\n\nCopy the intent (`Redirect90CW`), not the arithmetic.'),
    page('File map', '| Prototype | Unity |\n| --- | --- |\n| sound-wave.js | SoundWaveState.cs |\n| music.js | MusicalState.cs |\n| beat-clock.js | Tempo Manager.cs |\n| doodad.js | IWaveInteractable.cs |'),
    page('Art protocol', 'Black and white. A **3 px** main line; ornament grows from the form. 51 × 51 tiles. Joined pieces change texture to show it. Real art exists for **15** slots; **41** are still placeholders.'),
    go('PORTING.md', GH+'Composers-Prototype/blob/main/docs/PORTING.md'),
    go('ART-PROTOCOL.md', GH+'Composers-Prototype/blob/main/docs/ART-PROTOCOL.md'),
    go('The boss scope', GH+'Composers-Prototype/blob/main/docs/SCOPE-ENEMIES-AND-BOSS.md'),
  ]),
  check('Port next', [
    todo('Mirror drums'), todo('Flute and reed'), todo('Overtones'), todo('The Burin and the satchel'),
    todo('Stairs that change the key'), todo('Waves through open doors'), todo('The dissonant'), todo('The Unresolved Chord'),
  ]),
]};

/* ------------------------------------------------------------- EveryPark */
const everypark = {type:'project', key:'everypark', title:'EveryPark', color:10, children:[
  go('Open the map', 'https://everypark.starrysidekick.com'),
  go('The repository', GH+'EveryPark'),
  go('Start here', GH+'EveryPark/blob/main/docs/START-HERE.md'),
  go('Icons to draw', GH+'EveryPark/blob/main/docs/ASSETS-NEEDED.md'),
  contents(),
  check('Next', [
    todo('Depth on land that can be verified'),
    todo('Show how sure the data is'),
    todo('More detail in the 3D view'),
    todo('Population centers on the roads'),
    todo('Draw the four verdict glyphs'),
  ]),
  list('Open questions', [
    ask('A gradient, but how?', 'Which signals make a place "sure": a cited source, a site visit, an official list? And how should a pin show it?'),
    ask('Easements: hide or dim?', 'Shaky-provenance spots are deprioritized, not deleted. Should they look different on the map?'),
    ask('Which buildings first?', 'The 3D viewer fetches sixteen kinds of public building and has nothing to draw for any of them. Which five or six are worth drawing first?'),
  ]),
  about('A map of **every publicly accessible outdoor place** in Connecticut and New York, built to be released: about 24,000 places.\n\n>> Find a park near me, verified that it’s a good park, go there and get all the info.'),

  H('The map'),
  list('What it answers', [
    page('Can I go there?', 'Green fill is public land. The popup says whether by right or by the owner’s permission.'),
    page('Who runs it?', 'Border color: state green, federal brown, town blue, land trust teal, cemetery purple.'),
    page('What kind of place?', 'The pin’s icon, plus chips for trails, water, sports, playground, historic and parking.'),
    page('How do I get there?', 'Every road both states record, drawn at every zoom: 617,634 of them, with footpaths.'),
  ]),
  list('How it works', [
    page('Everything is precomputed', 'The site fetches no live data and does no classification in the browser. A visit costs about **290 KB and a third of a second**. See [[The data files]].'),
    page('The data files', '| File | Size | Holds |\n| --- | --- | --- |\n| places.json | ~2 MB | Every place |\n| everypark.pmtiles | 13.6 MB | Boundaries and trails |\n| roads.pmtiles | 65 MB | Every road |'),
    page('Publishing: one rule', '!!! Data flows only through the Actions.\n\nEdit `data/verified.json` or code, commit, push; `publish.yml` deploys in about ninety seconds. A local deploy must never touch `data/`.'),
    page('How sure is it?', 'CT is **72%** verified, NY **60%**, and the two do not rest on the same kind of evidence. The app shows a binary where the data supports a gradient: `researched`, `sources`, `checked`.'),
    page('The 3D view', 'An isometric island per park, elevation mapped onto the polygon, season and time of day changing the palette. **The centerpiece**, not a novelty beside the map.'),
    page('Not next', '**More states.** New York and Connecticut only for now, New England eventually. Each state costs a rules audit, not just a fetch.'),
  ]),

  H('Art'),
  check('Icons to draw', [
    todo('The four verdict glyphs'), todo('Trail, water, wooded, field, parking'),
    todo('Grouped buildings for the 3D view'), todo('The rest of the card icons'), todo('Sports sprites, isometric'),
  ]),
  Object.assign(page('House rules for an icon', 'Drawn, not emoji. A 24-unit grid, stroke 2, `currentColor`, no color of its own. Drawn in Procreate; whether a file becomes a raster or a vector decides how it comes in.'), {w:4, h:5}),
]};

const DASHBOARDS = [bureau, composers, everypark];

export { DASH_V, DASHBOARDS };
