// Writes docs/examples/wiki.json: three projects laid out as wikis, for a
// paste (Settings → Paste an Object). A paste places things first-fit in the
// order given, so the order below *is* the layout: every row is planned to
// fill the board's eight columns. Run: node scripts/wiki-paste.mjs
import { writeFileSync } from 'node:fs';

const H = t => ({ type: 'label', title: t, w: 8, h: 1 });            // a section heading across the board
const page = (title, body, w = 4, h = 3) => ({ type: 'note', title, body, w, h });
const card = (title, body) => ({ type: 'card', title, body });
const q = (title, body) => ({ type: 'question', title, body, w: 4, h: 3 });
const portal = (title, url) => ({ type: 'outlink', title, url });
const todo = title => ({ type: 'task', title, due: null });
const inOrder = a => [...a].reverse();   // a list or checklist shows its newest first
const ev = (title, due, body) => ({ type: 'appt', title, due, body });

/* ---------------------------------------------------------------- Bureau */
const bureau = {
  type: 'project', title: 'Bureau', color: 7,
  children: [
    page('What it is',
`Bureau is a personal to-do, note, idea and writing app for one person. **Everything sits on a grid**: drawers are containers on that grid and open onto grids of their own; objects are everything else, and what an object can do is defined by its attributes.

| | |
| --- | --- |
| **Version** | 2.98 |
| **Where** | iPhone, installed Safari PWA first |
| **Stack** | Hand-written HTML, CSS, ES modules. No build, no dependencies |
| **Storage** | Local only. Export and import JSON is the bridge |`, 8, 4),
    portal('Open Bureau', 'https://starrysidekick.github.io/Bureau/'),
    portal('The repository', 'https://github.com/StarrySidekick/Bureau'),
    portal('The Workshop', 'https://claude.ai/artifact/4TjyQZ5xcuxCYFgfnRm76k'),
    portal('The Scope', 'https://claude.ai/artifact/MjuzPyN2CXcdYmN4MRxqJY'),

    H('The idea'),
    { type: 'quote', title: 'The organizing idea', w: 4, h: 3,
      body: '>> The desk *is* the app. There is no toolbar and no sidebar, only the grid.' },
    page('Comparables',
`**Things 3 —** for how a task feels
**Bear —** for how writing feels
**Obsidian —** for what to avoid: infinite nesting and file soup`),
    page('Not a product', 'Bureau is not for other people. Every design decision is made for **one user**. It is used, for now, to fiddle with rather than live in, and the gap is a layout that fits an actual life.'),
    page('The axis now: functions', 'What a paper desk lets you *do*: file, annotate, cross-reference, clip, stamp, copy, tear out, pin, date, archive. Fifteen of them are scoped in `docs/FUNCTIONS.md`. Look work is no longer the default answer to "what now".'),

    H('Vocabulary'),
    { type: 'deck', title: 'Glossary', seed: false, children: [
      card('Desk', 'The home board. Free: as big as what is on it, plus eight empty cells each side.'),
      card('Board', 'What a container opens onto. A grid of square cells, eight across on a phone.'),
      card('Tile', 'A stretch of a board, 8 × 14 in a container by default. More are laid by holding the wood beside it.'),
      card('Drawer', 'A container. In the code, anything carrying the `container` attribute.'),
      card('Bench', 'A container set up so one activity is easier in it than anywhere else. Once called a flow; `plan` in the code.'),
      card('Face', 'How a container shows its contents on the outside: a front, a checklist, a calendar, a spine.'),
      card('Shape', 'A thing\'s outline: card, note, page, plaque, postcard and the rest.'),
      card('Drawer front', 'The rail across the bottom on a phone: glass, letter block, knob, padlock. Six places hold any object.'),
      card('Top lip', 'The board\'s name, big and on the left, with the gear at its right.'),
      card('Carcass', 'The wood around the boards.'),
      card('Notepad', 'A ruled line. Write and press return: it becomes what it reads as.'),
      card('Inbox', 'A container that makes whatever it reads as. Copper pipes tied to it carry each kind away.'),
      card('Rubber stamp', 'Press it, then press things: each carries an impression and today\'s date.'),
      card('Spool', 'Press it, then two things, and they are tied with string.'),
      card('Spiral coin', 'Toss it and it makes one of anything, somewhere on the board.'),
      card('Garbage bin', 'Where a delete goes. Hold one to put it back.'),
    ] },
    page('The fifteen',
`Timothy's master categories, which lead the picker:

Drawer · List · Calendar · Tag · Text · Collage · Jar · Card · Paper · Picture · Video · Audio · Decoration · Doodad · Portal`, 3, 3),
    page('Ready benches',
`Brain Dump · Prioritizer · Short Film · Feature Film · Brainstorm · Story Builder · Journal

Every other stock bench is shelved, not deleted. Add a key to \`BENCH_READY\` to bring one back.`, 3, 3),

    H('How it is built'),
    page('Five rules',
`1. **Rendering is full re-render.** \`render()\` rebuilds \`#app\` from \`S\`.
2. **An animation never holds anything up.**
3. **Events are delegated**, through \`data-act\` and one listener set.
4. **Everything is an object; containing is an attribute.**
5. **Never branch on a type's name.** Ask \`has(o,'check')\`.`),
    page('The modules',
`| Module | Holds |
| --- | --- |
| model.js | ATTRS, KINDS, the heart |
| grid.js | Cells, boxes, free spots |
| tiles.js | How a thing looks |
| views.js | The desk and a drawer |
| gestures.js | Drag, hold, swipe |
| motion.js | Every movement |
| persist.js | Storage, migrations, paste |
| wire.js | The one listener |`),
    page('Shipping a change',
`- Check it in WebKit first: \`node test/safari.mjs\`
- The smoke suite is the gate
- Bump \`CACHE\` and \`APP_VERSION\` together
- A new file goes in \`SHELL\`
- Pushing to main deploys to Pages`),
    page('Invariants that bite',
`- Layouts are stored **per device**
- Cells are square and measured, never assumed
- Never round the cell size
- \`byId(ROOT)\` is undefined: ask \`container()\`
- Image bytes live in IndexedDB, never in the JSON
- Anything that changes a field pushes an undo`),

    H('Open questions'),
    q('Edges closed or open?', 'On a bench\'s board, closed by default and open on a drawer you made? Or always open unless a bench says so? (NAVIGATION §9)'),
    q('Name the tiles?', 'Stations: worth naming tiles? The biggest new idea in the navigation scope, and the one Film and Story Builder most want.'),
    q('Story Builder as five stations?', 'An act per tile, or keep the journey on one tile and make it bigger?'),
    q('Which tools to make?', 'The compass, the loupe, the ribbon, the pencil ledge: which, if any?'),

    H('History'),
    { type: 'timeline', title: 'How it got here', w: 8, h: 3, children: [
      ev('Merge and push without asking', '2026-08-27', 'The standing instruction: once tested, finished work goes to main.'),
      ev('Intent recorded', '2026-09-06', 'Functions are the axis. The margin ships first.'),
      ev('Things that sit on a desk', '2026-09-21', 'Jar, nameplate, string, metronome, hourglass, candle, bell, clock, die.'),
      ev('The camera tabled', '2026-09-23', 'A note scales up into its surface instead.'),
      ev('Scope artifact', '2026-09-28', 'Knobs for each aspect of life, verbs for each bench.'),
      ev('Safari first, American English', '2026-09-30', 'The phone is the primary test.'),
      ev('The grammar', '2026-10-01', 'How Claude builds boards reliably.'),
      ev('Navigation scoped', '2026-10-03', 'Gear on the top lip; the bench skill. v2.98.'),
    ] },
  ],
};

/* -------------------------------------------------------- Composer's Key */
const areas = [
  ['The Atrium', 'C ionian · content · 104 bpm', 'Metronome, First Breath, Crossroads, Crossing'],
  ['The Reed Gallery', 'F lydian · mysterious · 96 bpm', 'The Flute, The Reed Loft'],
  ['The Undercroft', 'A aeolian · sad · 88 bpm', 'The Kit, The Quiet Room, The Keyboard Floor'],
  ['The Cloister', 'D dorian · reflective · 100 bpm', 'The Valve, Left and Right, The Slide'],
  ['The Bell Tower', 'G mixolydian · confident · 100 bpm', 'The Triad, The Stand, The Stair'],
  ['The Discord', 'E phrygian · tense · 108 bpm', 'The Discord, The Coda, The Unresolved Chord'],
];
const rooms = [
  ['The Metronome', 'Silence until you press B on it; then the tune starts on the next beat.'],
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
  ['The Slide', 'Every pull of the slide plays the horn\'s new note.'],
  ['The Triad', 'Three horns, three forks. Needs three waves in the air at once. The Burin is here.'],
  ['The Stand', 'Carry the reed from the Reed Loft and set it on the stand.'],
  ['The Stair', 'The lock wants A; the room is in G. Each step up raises the key.'],
  ['The Discord', 'Dissonants walk on the beat. A wave resolves them. The score gate wants nine.'],
  ['The Coda', 'The last lock listens to the whole world for la-sol-mi-do.'],
  ['The Unresolved Chord', 'The boss: echo its call, resolve its swarm, answer with a chord.'],
];
const composers = {
  type: 'project', title: 'Composer\'s Key', color: 12,
  children: [
    page('What it is',
`A top-down puzzle game where sound is the tool. Coda carries the Composer's Key and fires sound waves through horns, strings, drums and flutes to play the phrase each lock wants.

This repo is the **browser prototype**: a fast-iteration harness for mechanics, which port back into the **Unity** project. No build, no engine. Open a page, paint a room, hear it.

| | |
| --- | --- |
| **World** | 18 rooms in six areas, 13 × 13 each |
| **Look** | Black and white, sketchy white line-work |
| **Tiles** | 51 × 51 px |`, 8, 5),
    portal('Play it', 'https://starrysidekick.github.io/Composers-Prototype/'),
    portal('The repository', 'https://github.com/StarrySidekick/Composers-Prototype'),
    portal('Asset review', 'https://claude.ai/artifact/9WZenE4ds34khFiRf5TR91'),
    { type: 'metronome', title: 'The Atrium\'s tempo' },

    H('The world'),
    { type: 'list', title: 'Areas and moods', w: 4, h: 6,
      children: [...areas].reverse().map(([t, m, r]) => ({ type: 'note', title: t, body: `**${m}**\n\n${r}` })) },
    { type: 'list', title: 'Rooms, in order', w: 4, h: 6,
      children: [...rooms].reverse().map(([t, b]) => ({ type: 'note', title: t, body: b })) },
    page('How the rooms join',
`Rooms sit on a grid, north to south. Solve a room and its door opens.

**North —** Reed Loft, Flute
**The Atrium row —** Metronome, Brass 01, Brass 02, Brass 03, Triad
**Below it —** Keys 01, Strings 01, Percussion 01, Stand
**The Cloister row —** Brass 04, Percussion 02, Brass 05, Stair
**The Discord —** Unresolved Chord, Coda, Hall

A shortcut from the Reed Loft back to Brass 01 opens only from the far side.`, 8, 4),

    H('Mechanics'),
    { type: 'deck', title: 'Instruments', seed: false, children: [
      card('Horn', 'Mouthpiece in, bells out. Tees divide a wave; valves turn; every tubing structure is a horn.'),
      card('Slide', 'An instrument on its own: every pull plays the horn\'s new note.'),
      card('Strings', 'Three runs, three lengths, three pitches. Pegs face their string.'),
      card('Piano keys', 'Stepped on, they swing a mallet. They autotile, sixteen cases.'),
      card('Drums', 'Mirrors in 45° steps. Only the head reflects; the back swallows the wave.'),
      card('Flute', 'The fingering picks the note and the way out: the first open hole.'),
      card('Reed', 'Keeps breathing: a wave a beat for several beats.'),
      card('Hi-hat', 'Ticks. No puzzle yet.'),
      card('Strumentino', 'A blank per-face instrument. No puzzle yet.'),
      card('The Burin', 'Lifts drums and reeds into the satchel (L) and turns the one in hand (R).'),
      card('Overtones', 'An upgrade: more waves in the air at once.'),
      card('Dissonant', 'A sour note that walks on the beat and shoves Coda. Any wave resolves it.'),
    ] },
    page('Everything in time', 'The wave travels **one tile per sixteenth note** at the room\'s bpm, and every sound is synchronized to it. `test/timing.mjs` checks it. Waves carry on through open doors, and a lock can listen to the whole world.', 3, 3),
    page('Keys, modes, motif', 'Each area is one key, mode and tempo, with a title card. Stairs climb: up raises the key. A four-bar motif gains a layer per solved room, ten in all, played in each area\'s mode.', 3, 3),

    H('Open questions'),
    q('Should dissonance matter?', 'A sour wave still lights every lock. Should note locks reject soured notes, or a sour wave fail to light a fork?'),
    q('Is the boss fun on a phone?', 'Phase three wants the longest horn first and a beat to land all three. Fun or fiddly?'),
    q('Does the tune work?', 'The motif was composed blind. Nobody has listened to it yet: judge it by ear.'),
    q('Hi-hat and strumentino?', 'Both are in the game with no puzzle of their own. What should each one do?'),

    H('Porting to Unity'),
    page('The Y axis trap',
`The prototype is **+y down**. Unity 2D is **+y up**, so every rotation flips.

| | here | Unity |
| --- | --- | --- |
| CW | (-y, x) | (y, -x) |
| up | (0, -1) | (0, 1) |

Copy the intent (\`Redirect90CW\`), not the arithmetic.`),
    page('File map',
`| Prototype | Unity |
| --- | --- |
| sound-wave.js | SoundWaveState.cs |
| music.js | MusicalState.cs |
| beat-clock.js | Tempo Manager.cs |
| doodad.js | IWaveInteractable.cs |`),
    { type: 'checklist', title: 'Port next', w: 4, h: 6, children: inOrder([
      todo('Mirror drums'), todo('Flute and reed'), todo('Overtones'), todo('The Burin and the satchel'),
      todo('Stairs that change the key'), todo('Waves through open doors'), todo('The dissonant'), todo('The Unresolved Chord'),
    ]) },
    page('Art protocol',
`Black and white. A **3 px** main line. Ornament grows from the form. 51 × 51 tiles. Joined pieces change texture to show it.

Real art exists for **15** slots; **41** are still placeholders.`, 4, 4),
    todo('Drop the GDD into docs/'),
    todo('Copy Unity\'s Assets/Sprites across'),

    H('History'),
    { type: 'timeline', title: 'How it got here', w: 8, h: 3, children: [
      ev('Room report', '2026-09-06', 'Says what a room does: its pitch range, the piece that carries it, the piece nothing reaches.'),
      ev('Art parity', '2026-10-01', 'Black and white line-work; square rooms; doors lead to rooms.'),
      ev('The play screen', '2026-10-02', 'Zelda-style bars, movable controls, Coda moves like Link.'),
      ev('The dungeon pass', '2026-10-03', 'Sixteen interconnected rooms, woodwinds, the Burin, a motif that grows.'),
      ev('After playing it', '2026-10-04', 'The boss, the metronome room, typing that sings, floors tinted by mode.'),
    ] },
  ],
};

/* ------------------------------------------------------------- EveryPark */
const everypark = {
  type: 'project', title: 'EveryPark', color: 10,
  children: [
    page('What it is',
`An interactive map of **every publicly accessible outdoor place** in Connecticut and New York, built to be released.

Everything is precomputed. The site fetches no live data and does no classification in the browser: a visit costs about **290 KB and a third of a second**.

>> Find a park near me, verified that it's a good park, go there and get all the info.`, 8, 5),
    { type: 'counter', title: 'Places', count: 24202, w: 5, h: 1 },
    { type: 'label', title: 'places', w: 3, h: 1 },
    portal('Open the map', 'https://everypark.starrysidekick.com'),
    portal('The repository', 'https://github.com/StarrySidekick/EveryPark'),
    portal('Icons to draw', 'https://github.com/StarrySidekick/EveryPark/blob/main/docs/ASSETS-NEEDED.md'),
    portal('Start here', 'https://github.com/StarrySidekick/EveryPark/blob/main/docs/START-HERE.md'),

    H('What the map answers'),
    card('Can I go there?', 'Green fill is public land. The popup says whether by right or by the owner\'s permission.'),
    card('Who runs it?', 'Border color: state green, federal brown, town blue, land trust teal, cemetery purple.'),
    card('What kind of place?', 'The pin\'s icon, plus chips for trails, water, sports, playground, historic and parking.'),
    card('How do I get there?', 'Every road both states record, drawn at every zoom: 617,634 of them, with footpaths.'),

    H('How it works'),
    page('The data files',
`| File | Size | Holds |
| --- | --- | --- |
| places.json | ~2 MB | Every place, classified |
| everypark.pmtiles | 13.6 MB | Boundaries and trails, zooms 6–14 |
| roads.pmtiles | 65 MB | 617,634 roads, none dropped at any zoom |`),
    page('Publishing: one rule', '!!! Data flows only through the Actions.\n\nEdit `data/verified.json` or code, commit, push. `publish.yml` applies it and deploys in about ninety seconds. A local deploy must never touch `data/`.'),
    page('How sure is it?', 'CT is **72%** verified, NY **60%**, and the two do not rest on the same kind of evidence. The app shows a binary today where the data supports a gradient: `researched`, `sources`, `checked`.', 4, 3),
    page('The 3D view', 'An isometric island per park, elevation mapped onto the polygon, season and time of day changing the palette. **The centerpiece**, not a novelty beside the map.', 4, 3),

    H('What is next'),
    { type: 'checklist', title: 'In order', w: 4, h: 6, children: inOrder([
      todo('Depth on land that can be verified'), todo('Show how sure the data is'), todo('More detail in the 3D view'), todo('Population centers on the roads'),
    ]) },
    { type: 'checklist', title: 'Icons to draw', w: 4, h: 6, children: inOrder([
      todo('The four verdict glyphs'), todo('Trail, water, wooded, field, parking'), todo('Grouped buildings for the 3D view'),
      todo('The rest of the card icons'), todo('Sports sprites, isometric'),
    ]) },
    q('A gradient, but how?', 'Which signals make a place "sure": a cited source, a site visit, an official list? And how should a pin show it?'),
    q('Easements: hide or dim?', 'Shaky-provenance spots are deprioritized, not deleted. Should they look different on the map?'),
    page('Not next', '**More states.** New York and Connecticut only for now; New England eventually. Each state costs a rules audit, not just a fetch.', 8, 2),
  ],
};

/* Reading order is layout: each top-level child goes to the first spot,
   left to right and top to bottom, where it fits on an eight-wide board. The
   first two rows are left for the notepad a project is born with. */
const SIZES = { note: [3, 3], outlink: [2, 2], deck: [2, 3], card: [2, 3], metronome: [2, 4], task: [4, 1], label: [4, 1] };
function pack(board) {
  const used = new Set(['notepad']), taken = new Set();
  for (let y = 1; y <= 2; y++) for (let x = 1; x <= 8; x++) taken.add(x + ',' + y);
  const fits = (x, y, w, h) => { if (x + w - 1 > 8) return false;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (taken.has((x + i) + ',' + (y + j))) return false; return true; };
  let floor = 1;
  for (const c of board.children) {
    const [w, h] = [c.w || SIZES[c.type][0], c.h || SIZES[c.type][1]];
    let spot = null;
    if (c.type === 'label' && w === 8) floor = Math.max(...[...taken].map(k => +k.split(',')[1])) + 1;
    for (let y = floor; !spot; y++) for (let x = 1; x <= 8 && !spot; x++) if (fits(x, y, w, h)) spot = [x, y];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) taken.add((spot[0] + i) + ',' + (spot[1] + j));
    c.x = spot[0]; c.y = spot[1];
    if (c.type === 'label' && w === 8) floor = spot[1];
  }
  return board;
}
const out = [bureau, composers, everypark].map(pack);
writeFileSync(new URL('../docs/examples/wiki.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('wrote docs/examples/wiki.json,', JSON.stringify(out).length, 'chars');
