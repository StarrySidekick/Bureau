# The grammar: how to build in Bureau

For Claude, or anything else outside Bureau that writes boards for Timothy.
Read it before writing a single object. The rules (§1 to §7) are written by
hand; the words they use (§8: every type, field, bench, face and shape) are
generated from the running app by `node scripts/grammar.mjs`, so they are what
the app actually accepts today.

Asked for 2026-10-01 (`docs/USES.md`, first in the build order): *so Claude
builds boards reliably.* The flat-pack, when it comes, is this grammar
delivered as an object.

---

## 1. Bureau in eight sentences

1. **Everything is an object** in one list, and every object names its
   `parent`: the desk (`root`) or a container.
2. An object's **type** (`kind` in the code) is a named preset of
   **attributes**, and what an object can do is its attributes, never its
   type's name.
3. Some attributes carry a **field**, a value stored under a key: `check`
   stores `done`, `date` stores `due`, `rating` stores `rating` (§8).
4. A **container** (a drawer, a project, a list, a jar, a calendar) holds
   other objects and opens onto a **board** of its own.
5. A board is a grid of square **cells**, eight across on a phone; a phone
   shows about **8 × 14** at once, and a board can grow in any direction.
6. Every object has a box on its board **per device**: `phone:{x,y,w,h}` and
   `desk:{x,y,w,h}`, 1-based, and nothing may overlap except decorations and
   backgrounds.
7. A **bench** (`plan` in the code, once called a flow) is a saved board: a container's whole
   arrangement, stamped out when the container is made.
8. A container's **face** is how its contents show on its outside (a front,
   a checklist, a calendar, a spine); a thing's **shape** is its outline.

## 2. Two ways in, and which to use

| | How Timothy does it | What it does | Use it for |
| --- | --- | --- | --- |
| **Paste** | Settings → *Paste an Object*, paste JSON, press the button | **Adds** to the desk. Every object goes through `create()`, so nothing can arrive that the app would not make itself. One undo takes the whole paste back. | **Everything you build.** |
| **Backup** | Settings → import a backup file | **Replaces the whole desk.** | Never, for building. It erases what is there. |

A paste lands on the **desk**, at the first free spot big enough, on whichever
device it is pasted on (the other device places it on its first render). It
cannot yet say *where*, or put something into a drawer that already exists.
§5 is the full list of what it cannot do.

## 3. A paste, field by field

A paste is a JSON **array of specs** (a single spec also works). Fences
(` ```json `) are tolerated. A bare string is a task: `"Call the dentist"`.

```json
[
  {
    "type": "drawer",
    "title": "Low Tide",
    "color": 7,
    "children": [
      { "type": "task", "title": "Lock the beach location", "due": "2026-10-12", "prio": 4 },
      { "type": "note", "title": "Logline", "body": "A lifeguard who can't swim..." },
      "Call the sound recordist"
    ]
  }
]
```

| Key | What it sets | Notes |
| --- | --- | --- |
| `type` | The type | A key from §8 (`task`, `drawer`, `pj_novel`). Names and near spellings also resolve, and anything unknown becomes a `note`, silently. Write the key. A project or life type (`pj_*`, `lf_*`) arrives with its bench already laid out inside, as it does when made in the app. |
| `title` | The name | Plain, specific, American English, sentence case. |
| `children` | Things inside it | Specs or bare strings. A type that cannot hold things is **made a drawer** if it is given children. |
| `body` | The words | Markdown, §6. |
| `tags` | Tags | An array of strings. |
| `color` | Its color slot | A number from **5 to 15** (the eleven object slots; 0 to 4 are the board's own roles). What each looks like depends on the aesthetic. |
| `w`, `h` | Size in cells | Leave them out: every type's default is Timothy's own choice from the Workshop. Set them only for a reason. Width is held to the board. |
| `shape`, `face`, `layout`, `onclick` | Look and behavior | Values from §8. `onclick` is `none`, `read`, `edit` or `tick`. |
| `due` | The day it sits on | `YYYY-MM-DD`, local. **A type with a date is born dated today** (tasks, and some containers), so it shows in Today; write `"due": null` for an undated thing. |
| `dead` | Hard deadline | `YYYY-MM-DD` |
| `soft` | Soft deadline | `YYYY-MM-DD` |
| `till` | Runs until | `YYYY-MM-DD`, for something with a span |
| `done` | Finished | `true` sends it to the archive. |
| `repeat` | Repeats | `daily`, `weekdays`, `weekly`, `monthly`, `yearly`, or `{"every":2,"unit":"week"}` |
| `prio` | Priority | 0 to 5 |
| `count`, `rating`, `price`, `dur` | Numbers | `dur` is minutes; `rating` is out of five |
| `loc` | Location | Text |
| `url` | A web address | On a Button or Portal it becomes where the press goes. |
| `answer` | An answer | For a Question. |

Anything else in a spec is **ignored**, including `x`/`y`, `rel`, `milestones`,
`media` and every look field. Not an error: it simply does not arrive.

## 4. Building on a bench: `plan`, `fill`, `children`

The strongest thing a paste can do. A spec with `plan` makes a container
**already laid out as that bench**, then fills it in, so Timothy gets a board
that looks lived in rather than a heap of objects beside an empty one
(decision 197; `docs/examples/lived-in.json` is eleven of these).

```json
{
  "plan": "shortfilm",
  "title": "Low Tide",
  "fill": {
    "What is it about?": "A lifeguard who can't swim has one summer to learn.",
    "Stages": { "tick": ["Logline"] },
    "Shot list": ["Wide: empty beach at dawn", "Close: whistle in the sand"],
    "First shoot day": { "due": "2026-10-18" },
    "Characters": [ { "type": "character", "title": "Mara", "body": "Nineteen. Lies well." } ]
  },
  "children": [ { "type": "task", "title": "Ask Sam about the drone", "due": "2026-10-03" } ]
}
```

- **`plan`** names a bench by its key, its name or its id (§8, *Benches*).
- **`type`**, if it names a container, is what gets made; otherwise the bench's
  own type is used.
- **`fill`** addresses things already on the bench **by their title** (the
  *things on it* column in §8, which includes things inside its drawers).
  Where a title appears twice, the one lying on the board wins over one
  inside a drawer (Short Film has a *Shot list* checklist on the board and a
  *Shot list* step inside *Stages*). Each value is one of:
  - **an array**: more things to put inside it (it must be a container);
  - **a string**: its answer, if it is a Question;
  - **an object** that sets `title`, `body`, `answer`, `due`, `dead`, `soft`,
    `till`, `dur`, `prio`, `rating`, `count`, `done`, `bpm`, `mins`, `burn`,
    `sides`, `at`, `target`, `calview`, `calshow`, `loc`, `url`, and three
    special ones: **`tick`** (titles of the things inside to check off),
    **`milestones`** (titles of its milestones to mark done) and **`dates`**
    (`{"title": "YYYY-MM-DD"}` for the things inside).
- **`children`** adds more things inside, beyond the bench's own.

`fill` **cannot rearrange** a bench. Its layout is the bench's.

**Prefer a bench to building by hand** whenever one fits. Timothy has rebuilt
the benches several times and they are his arrangement. Building a board out of
loose `children` is the fallback for when nothing fits.

## 5. What a paste cannot do yet

This is the gap between the grammar and the flat-pack, and the list of what
the flat-pack format has to add. Each is a real limit today, not a convention.

1. **Place.** No `x`/`y`: things land at the first free spot.
2. **Put things into an existing drawer.** A paste always starts on the desk.
3. **Tie with string.** `rel` holds ids, and a paste has no way to name
   another object in the same paste. Compounds do this already, with local
   names (`ref:'list'`, `rel:['@list']`, `tracks:'@list'` in `COMPOUNDS`);
   the flat-pack should use the same idea.
4. **Group.** `grp` is not written.
5. **Compounds need room.** A compound (`cp_*`) is made whole, its parts
   grouped and tied, but only where its full footprint is clear; on a crowded
   board nothing is made. Its parts keep their own titles.
6. **Define milestones.** `fill` can tick existing ones; a spec cannot make
   them.
7. **Look.** Words (`words`), knobs, panels, papers, paintings, drawn art,
   the drawer front's six places (`front`): none.
8. **Pictures, sound, video.** Bytes live in IndexedDB; a paste carries none.
9. **A new board shape.** A container is made at its type's size; a bench's
   `boards`/`dims` come only from the bench.

When Timothy asks for something on this list, say it cannot be pasted yet and
either build the nearest thing that can, or propose the change to the paste
bridge (`addSpec()` in `persist.js`).

## 6. Words: the markdown a body understands

`md()` in `util.js`. Blank lines separate paragraphs; a second blank line is
kept as space.

| Write | Get |
| --- | --- |
| `# Heading` to `####` | Headings (one level down from what you write) |
| `**bold**`, `*italic*`, `~~struck~~`, `==highlight==`, `++underline++` | Inline styles |
| `` `code` `` and fenced blocks | Code |
| `[words](https://…)` | A link |
| `![alt](https://…)` | A picture from a web address |
| `- item`, `1. item` | Lists |
| `- [ ] item`, `- [x] item` | Check boxes in the words (not objects) |
| `> quote` | A quotation |
| `>> words` | A pull quote |
| `!!! words` | A callout |
| `-> words <-` | Centered |
| `-> words ->` | Right-aligned |
| `\| a \| b \|` rows | A table; a row of dashes under the first is its rule |
| `---` | A rule |
| `+++` | A page break in book view |

**The house pattern for a prompt in a body** is a bold label, a spaced em dash,
and room to answer, one per paragraph: `**Bring —** insurance card`. The stock
benches use it throughout, so a filled one reads like them.

## 7. How to build a good board

These are Timothy's standing preferences, gathered from `INTENT.md`,
`CLAUDE.md` and the decisions. A paste that ignores them works and is wrong.

- **One board, one thing.** A board is the base station for one activity,
  project or part of life (2026-09-23). Don't mix a film and a budget.
- **Design for the phone.** Eight cells across, about fourteen tall in view.
  Most of what matters should sit in the first screenful.
- **Use the type that says what the thing is.** A question is a `question`,
  not a note with a question mark. Types carry behavior: a Question has an
  answer box, a Task checks off, an Event sits on a day.
- **Fewer, real things.** Fill a board with what Timothy would actually
  write, specific and dated, never placeholder ("Task 1", "Lorem").
  `lived-in.json` is the standard: real names, real-sounding dates, short.
- **Plain copy, American English.** "Filed in Kitchen", not "Successfully
  moved item!". Color, behavior, center, check. No exclamation marks.
- **Dates are local `YYYY-MM-DD`.** Use today's date to make them sensible:
  things due this week and next, not in 2019.
- **Don't set sizes, colors or looks without a reason.** The defaults are his
  choices from the Workshop and the aesthetic.
- **Never use a cut type** (§8 lists them) or invent a type key, and never
  make a `bin`: there is one garbage bin, made by the first delete.
- **An inbox comes with its pipes from a bench.** A paste can make an `inbox`
  and a `pipe`, but cannot tie them (§5), and an untied pipe leads nowhere.
  Paste the inbox and say which pipes to lay by hand. A **brain dump** needs
  no pipes: `{"plan": "braindump"}` is an inbox you write into, and its lines
  are carried to drawers by hand (decision 296), so give it `children`, not
  `fill` (a bare string there is a task; say the type for anything else).
- **Say what could not be pasted.** If the board needs strings, positions or
  pictures (§5), hand over the paste and say plainly what he will have to do
  by hand, or what the paste bridge would need.

### Before handing a paste over

1. It parses as JSON (no trailing commas, no comments).
2. Every `type` and `plan` is a key in §8.
3. Every `fill` title is on that bench's list in §8, spelled the same.
4. Dates are `YYYY-MM-DD`; numbers are numbers, not strings.
5. Nothing relies on a field §3 says is ignored.

## 8. The vocabulary

<!-- vocabulary:start -->

*Made by `node scripts/grammar.mjs` from the running app. Do not edit by hand; rerun it after changing a type, a field or a bench.*

### The fifteen, and the types inside each

The `type` to write is the key in `code`. A name or a near spelling also works (`kindFromName()`), but the key is never ambiguous. Sizes are the phone default, wide × tall, in cells.

**Drawer** (`drawer`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `drawer` | Drawer | 2×2 | yes | A container on the grid |

**List** (`m_list`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `list` | List | 4×6 | yes | Whatever is inside it, one line each, on the front |
| `checklist` | Checklist | 4×6 | yes | Tasks you can check off and add to without opening it |
| `inbox` | Inbox | 4×5 | yes | Write anything. It becomes what it reads as, and copper pipes tied to it carry each kind to its drawer |

**Calendar** (`m_calendar`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `calendar` | Calendar | 4×4 | yes | Whatever it collects, on the day it falls |
| `timeline` | Timeline | 8×3 | yes | Things in the order they happened |
| `appt` | Event | 3×1 |  | Something on a day — a meeting, a shoot, a trip |

**Tag** (`tag`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `tag` | Tag | 2×1 | yes | Everything that answers to a tag — a tag of yours, or one a thing has by being what it is |

**Text** (`book`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `book` | Text | 1×3 | yes | Anything made of words — press it and say which |
| `poem` | Poem | 5×7 |  | Lines, kept as written |
| `novel` | Novel | 1×3 | yes | Chapters, bound in order |
| `shortstory` | Short story | 1×3 | yes | One story, its scenes in order |
| `essay` | Essay | 3×3 |  | Long-form writing |
| `script` | Script | 3×3 |  | Scenes and dialogue |

**Collage** (`m_collage`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `moodboard` | Collage | 3×3 | yes | Pictures, arranged — the board inside it, seen from outside |
| `pigeonhole` | Pigeonhole | 2×3 | yes | A drawer with no front — what is in it shows, small, where it stands |

**Jar** (`jar`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `jar` | Jar | 2×3 | yes | Glass — what is in it shows without opening it |

**Card** (`m_card`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `card` | Card | 2×3 |  | Words on a card. Two dropped together make a deck |
| `deck` | Deck | 2×3 | yes | Cards you cut to. Face up a press cuts it; face down a press deals the top card onto the board |
| `cp_habit` | Habit tracker *(compound)* | 6×2 |  | A habit you check off each day, a ticker of the days in a row, and a bar toward the run you want |
| `achievement` | Achievement | 3×1 |  | Something you actually did |

**Paper** (`m_paper`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `note` | Note | 3×3 |  | Something to remember — press it and say which |
| `task` | Task | 4×1 |  | A thing to do |
| `notepad` | Notepad | 4×1 |  | Write a line and press return: it becomes a note, a task, a thought, whatever it reads as |
| `thought` | Thought | 3×3 |  | Something that crossed your mind, before it goes |
| `idea` | Idea | 3×3 |  | A spark, unformed |
| `question` | Question | 3×3 |  | Open until you have written the answer |
| `problem` | Problem | 3×3 |  | Something in the way — open until you have written what you did about it |
| `quote` | Quote | 4×3 |  | Someone else's words |
| `review` | Review | 5×3 |  | Something you watched, read, heard or played, and what you made of it |
| `label` | Label | 4×1 |  | A name for a stretch of board |
| `poem` | Poem | 5×7 |  | Lines, kept as written |
| `essay` | Essay | 3×3 |  | Long-form writing |
| `script` | Script | 3×3 |  | Scenes and dialogue |
| `outline` | Outline | 3×3 |  | Structure before prose |
| `scene` | Scene | 6×5 |  | One scene, for writing |
| `letter` | Letter | 3×2 |  | A sheet that was folded and sent |
| `postcard` | Postcard | 5×4 |  | A picture one side, the writing the other |
| `character` | Character | 4×6 |  | Someone in the story |
| `place` | Place | 5×6 |  | Somewhere in the story |
| `artifact` | Artifact | 4×4 |  | A thing that matters |
| `creature` | Creature | 4×5 |  | Something alive that is not a person |
| `histevent` | Historical event | 6×4 |  | Something that happened, before the story starts |
| `law` | Law | 5×4 |  | A rule the world keeps — magic, physics, custom |
| `group` | Group | 5×5 |  | A nation, a race, an order, a guild |

**Picture** (`image`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `image` | Picture | 3×3 |  | A picture on the board: a photograph, a drawing, anything you have |

**Video** (`video`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `video` | Video | 3×3 |  | Something to watch |

**Audio** (`audio`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `audio` | Audio | 2×2 |  | Something to listen to |

**Decoration** (`decoration`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `plant` | Plant | 2×3 |  | Something green on the shelf |
| `ornament` | Physical Object | 2×2 |  | A clock, a bust, a globe, a teapot — something that stands there |
| `painting` | Painting | 3×3 |  | An Impressionist painting, framed |
| `window` | Window | 2×2 |  | A view, framed |
| `background` | Background | 4×4 |  | A color, a check or a weave laid under other things |
| `mat` | Board | 8×8 |  | A board on the board: things go on it and move with it |
| `zone` | Zone | 4×4 |  | A place on the board that means something: what you put in it is given its priority, its effort or its tag |

**Doodad** (`instrument`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `button` | Button | 1×1 |  | Press it and something happens: it makes a thing, opens one, or flips a switch |
| `m_counter` | Counter | 4×4 |  | An amount, and how you want to see it |
| `metronome` | Metronome | 2×4 |  | Keeps time, and you can hear it |
| `hourglass` | Hourglass | 2×4 |  | Tip it over and watch it run |
| `candle` | Candle | 2×4 |  | Burns down while you work |
| `bell` | Desk bell | 2×4 |  | Press it and it rings. That is all |
| `clock` | Clock | 2×2 |  | The time, and one alarm |
| `die` | Die | 2×2 |  | Press it and it rolls |
| `deck` | Deck | 2×3 | yes | Cards you cut to. Face up a press cuts it; face down a press deals the top card onto the board |
| `tglass` | Magnifying glass | 7×1 |  | Searches the board it lies on |
| `tblock` | Letter block | 1×1 |  | Turns the board it lies on to its next sort |
| `tlock` | Padlock | 1×1 |  | Locks and unlocks every board |
| `tgear` | Gear | 1×1 |  | Opens the settings of the board it lies on |
| `tswipe` | Swipe switch | 1×1 |  | Flips every board between a smooth scroll and a rigid swipe, a tile at a time |
| `spool` | Spool of thread | 1×1 |  | Press it, then two things, and they are tied with string |
| `tstamp` | Rubber stamp | 1×1 |  | Press it, then press things: each is stamped with its word and today’s date |
| `pipe` | Copper pipe | 1×1 |  | Tie it to a drawer with string: what goes in comes out there |
| `coin` | Spiral coin | 1×1 |  | Toss it and it makes one of anything, somewhere on the board |

**Portal** (`outlink`)

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `outlink` | Portal | 2×2 |  | A way out of Bureau — a site, an app, a number to call |

### Types outside the fifteen

Still made, still valid in a paste, never offered by a picker: what benches and older desks use.

| type | name | size | holds | what it is |
| --- | --- | --- | --- | --- |
| `life` | Aspect of Life | 2×2 | yes | A part of your life rather than a piece of work — it is never finished |
| `progressbar` | Progress bar | 4×1 |  | How far along something is — its own milestones, or another object's |
| `trip` | Trip | 3×2 | yes | Somewhere you are going |
| `writing` | Essay | 3×3 | yes | An essay, an article or a blog post, and the work around it |
| `bin` | Garbage bin | 2×2 | yes | Where deleted things go. Open it to sift through them; hold one to put it back |
| `world` | World | 8×8 | yes | The people, places and things a story is set in |
| `film` | Film | 2×2 | yes | A film, and everything it is made of |
| `game` | Game | 2×4 | yes | A game, and everything it is made of |
| `song` | Song | 2×2 | yes | A song, and everything it is made of |
| `app` | App | 2×2 | yes | Software, and everything it is made of |
| `artpiece` | Artwork | 2×2 | yes | A painting, a print, a drawing — and the work behind it |
| `post` | Post | 4×4 |  | Something that came in the post — press it and say which |
| `tool` | Tool | 1×1 |  | The drawer front’s tools, as things you can put on a board |
| `fragment` | Fragment | 4×4 |  | A piece of a world or a story — press it and say which |
| `counter` | Ticker | 2×2 |  | A number on turning wheels: tap it to add one |
| `project` | Project | 2×2 | yes | A whole piece of work, and everything it is made of |
| `lf_health` | Health | 2×2 | yes | Appointments, and keeping up with sleep, water and the rest |
| `lf_money` | Finances | 2×2 | yes | Every account in one place, what you have, and what you are saving for |
| `lf_exercise` | Exercise | 2×2 | yes | A routine, the goals it is for, and the app you train with |
| `lf_nutrition` | Nutrition | 2×2 | yes | What is good for you, what is not, and what to avoid |
| `lf_partner` | Partner | 2×2 | yes | Dates, gifts, and the things you want to tell her |
| `lf_family` | Family | 2×2 | yes | Keeping light tabs on everyone, and times to see them |
| `lf_friends` | Friends | 2×2 | yes | Time with friends, how they are, and where you wish you had more |
| `lf_communities` | Communities | 2×2 | yes | The groups you are in, the ones you would like to be, and when they meet |
| `lf_home` | Home | 2×2 | yes | The chores, room by room |
| `lf_things` | Things | 2×2 | yes | What you own that needs looking after: the car, the laptop, the rest |
| `lf_travel` | Travel | 2×2 | yes | Places you want to go, finding new ones, and the next trip |
| `lf_films` | Films | 2×2 | yes | Favorites by genre, with Letterboxd doing the rest |
| `lf_books` | Books | 1×3 | yes | What to read, favorites, notes, the shelf you own, and libraries |
| `lf_music` | Music | 2×2 | yes | Favorite songs, artists and what inspires you |
| `lf_visual` | Artwork | 3×3 | yes | Art to see, museums, and favorite artists |
| `lf_games` | Games | 4×4 | yes | Games to play and favorite games |
| `lf_food` | Food | 2×2 | yes | Restaurants, foods and recipes to try |
| `pj_featurefilm` | Feature Film | 2×2 | yes | A feature, department by department |
| `pj_tvshow` | TV Show | 2×2 | yes | A series: the bible, the pilot and the episodes |
| `pj_videoessay` | Video Essay | 2×3 | yes | An argument made with footage, from research to publishing |
| `pj_play` | Play | 2×2 | yes | A play, from the first draft to opening night |
| `pj_musical` | Musical | 2×2 | yes | The book, the songs and the staging |
| `pj_script` | Screenplay | 2×2 | yes | A script on its own, beat by beat |
| `pj_novel` | Novel | 2×2 | yes | A novel, and everything around the manuscript |
| `pj_shortstory` | Short Story | 2×2 | yes | One story, drafted and sent out |
| `pj_poem` | Poem | 2×2 | yes | A poem, its drafts and a way in |
| `pj_blogpost` | Blog Post | 2×2 | yes | A post, from the idea to sharing it |
| `pj_website` | Website | 2×2 | yes | A site: its pages, its look and its launch |
| `pj_album` | Album | 2×2 | yes | A record, track by track |
| `pj_handmade` | Handmade Object | 2×2 | yes | Something made by hand, materials to finish |
| `pj_device` | Device | 2×2 | yes | A thing with parts, wiring and code |
| `workflow` | Bench | 2×2 | yes | A room set up for one way of working, with its own look and tools |
| `wf_brainstorming` | Brainstorm | 2×2 | yes | Ideas out fast, timed, with prompts to push on |
| `wf_braindump` | Brain Dump | 8×6 | yes | Everything out of your head, sorted later |
| `wf_projectmgmt` | Project Management | 2×2 | yes | Several projects at once: what is next and when |
| `wf_prioritizer` | Prioritizer | 2×2 | yes | What matters, decided by where you put it |
| `cp_labelled` | Labeled drawer | 4×4 |  | A drawer with a label over it saying what it is for |
| `cp_quick` | Quick list | 4×7 |  | A list with a notepad on top: write a line, and it goes into the list |
| `cp_left` | Counted list | 6×6 |  | A checklist with a notepad on top and a counter saying how many are left |
| `cp_barlist` | Checklist with a bar | 4×6 |  | A checklist with a notepad on top and a progress bar under it filling as you check things off |
| `cp_draft` | Draft with a word count | 6×4 |  | A page to write on and a counter keeping its word count |
| `cp_spread` | Spread | 8×6 |  | A heading across two facing pages |

**Cut, never write these:** `magic`, `recipe`, `control`, `generator`, `tracker`, `anything`, `telegram`, `album`.

### Benches (stock boards)

Name one in `plan`. Its things are what `fill` can address by title. *Offered* is whether Timothy can make it from the app now; a shelved one (decision 295) is hidden from every picker for the time being but can still be pasted, so build on an offered one unless he asks for another.

| plan | name | offered | list | type it makes | things on it, by title |
| --- | --- | --- | --- | --- | --- |
| `health` | Health | shelved | life | `lf_health` | Appointments, Next appointment, Book these, Physical, Dentist cleaning, Eye exam, Skin check, Ask the doctor, Records, Medications and doses, Allergies and history, Insurance, Results, Patient portal, Find a doctor, Add to this…, Water, Sleep, Steps, Vitamins, Numbers |
| `money` | Finances | shelved | life | `lf_money` | What there is, Your bank, Credit card, Investments, Budget, Savings, A first cushion, One month of expenses, Three months, Financial goals, Three months put by, Pay off the card, Put something into retirement every month, Bills, Rent, Phone, Card, Look over the month, When it is owed, Add to this… |
| `exercise` | Exercise | shelved | life | `lf_exercise` | Your fitness app, The routine, Strength, A run, Strength again, A long walk, Moved today, What it is for, Three sessions a week, a month running, A first milestone of your own, Sessions, Rest, Cadence, Apple Fitness, Nike Run Club, Add to this… |
| `nutrition` | Nutrition | shelved | life | `lf_nutrition` | Good for me, Go easy on, Allergies and intolerances, Water, Reflux: easier on it, Reflux: triggers, Look a food up, Eat right, Add to this… |
| `partner` | Partner | shelved | life | `lf_partner` | Dates, Date ideas, Date night, Somewhere neither of us has been, Cook something new together, Gift ideas, Things to tell her, Anniversary, Pick a date, Go back to where you met, A walk somewhere new, Board games and takeout, A show, a museum or a gig, Breakfast out, phones away, Cook her favorite, Book a table, Things to do, Flowers, Add to this… |
| `family` | Family | shelved | life | `lf_family` | Everyone, Check in, Call home, Message someone you have not in a while, Birthdays and visits, Next time we are together, Plan the next visit, Something to do together, Photographs, Video call, Send a card, Add to this… |
| `friends` | Friends | shelved | life | `lf_friends` | Friends, Check in, Text someone you have not in a while, Plan something for everyone, Plans, Something to do, Dinner at somebody’s place, A walk and a coffee, Game night, See a show, Go somewhere for the day, Just call, Where do I wish I had friends?, Meetups, Something on, Split the bill, Add to this… |
| `communities` | Communities | shelved | life | `lf_communities` | Part of, Would like to join, Gatherings, Show up, Go to the next one, Offer to help with something, What could I give?, Meetups, Volunteer, Local events, Add to this… |
| `home` | Home | shelved | life | `lf_home` | Kitchen, Wipe down, Clean the fridge, Bins out, Bathroom, Clean the sink and mirror, Scrub the shower, New towels, Bedroom, Change the sheets, Laundry, Living room, Vacuum, Dust, Ten minutes of tidying, This month, Find a pro, Add to this…, Fix and maintain, Replace the air filter, Test the smoke alarms, The thing that drips, Shopping, Light bulbs, Batteries, Bin bags, Manuals and warranties, Hardware |
| `things` | Things | shelved | life | `lf_things` | The car, Oil change, Rotate the tires, Registration, Inspection, Insurance, VIN and plate, The laptop, Back it up, Install the updates, Serial, warranty and where it was bought, The phone, Serial and plan, Everything else, Due, Warranties and receipts, Find a mechanic, Apple support, Add to this… |
| `travel` | Travel | shelved | experience | `lf_travel` | Want to go, Been, Somewhere new, A city you know one thing about, Somewhere a train can take you, Where a book you loved is set, The coast in winter, A friend’s home town, A country whose food you love, Find somewhere new, Map, Next trip, Trips, Packing, Passport or ID, Chargers, Medication, Add to this…, Bookings, Getting there, Where we are staying, Getting around, While we are there, Eat, See, Do, Flights, Somewhere to stay, Day by day |
| `films` | Films | shelved | experience | `lf_films` | Letterboxd, Drama, Comedy, Horror and thrillers, Science fiction, Animation, Documentary, Add to this… |
| `books` | Books | shelved | experience | `lf_books` | To read, Favorites, A note on a book…, Book notes, On my shelves, Libby, Find a library, The StoryGraph, Bookshop, Add to this… |
| `music` | Music | shelved | experience | `lf_music` | Favorite songs, Artists, Inspirations, Put something on, An album start to finish, Something from the year you were born, A genre you never play, What you loved at sixteen, A live recording, Something a friend sent you, Spotify, Bandcamp, Gigs near me, Add to this… |
| `visual` | Artwork | shelved | experience | `lf_visual` | Favorite works, Artists, Museums to visit, Shows and openings, Look closer, Draw what you see for five minutes, What is the light doing?, Stand where the artist stood, What would you take home?, Read nothing, then read the label, Find the oldest thing in the room, Find new art, Find a museum, The Met, Add to this… |
| `games` | Games | shelved | experience | `lf_games` | To play, Favorites, How far into this one, What to play, The one you stopped halfway, Something short, Co-op with a friend, A board game night, A classic, The newest thing you own, Roll, Just finished…, Finished, Backloggd, BoardGameGeek, Add to this… |
| `food` | Food | shelved | experience | `lf_food` | Restaurants to try, Foods to try, Recipes to try, Tonight, Somewhere you have walked past a hundred times, A cuisine you have never had, Cook the recipe you saved last month, Breakfast for dinner, The place a friend keeps mentioning, Something with one ingredient you have never used, Book a table, Recipes, Near me, Add to this… |
| `shortfilm` | Short Film | **yes** | project | `film` | Where it stands, Stages, Logline, Script locked, Cast, Crew, Locations, Shot list, Shoot, Picture lock, Sound and color, Festivals, What is it about?, Script, Beats, Shoot days, First shoot day, Call sheets, Add to this…, Roles to cast, Characters, The lead, Who is in the way, Auditions, Contacts and agents, Casting days, Post a casting call, Find crew, Storyboard, The look, Props, Wardrobe, References, Scouting photos, Permits and permissions, Map, Find a location, Notes from the scout, Written, Prepped, Shot, Cut, Scene 1, Scene 2, Scene 3, New scene |
| `featurefilm` | Feature Film | **yes** | project | `pj_featurefilm` | Where it stands, Stages, Treatment, First draft, Rewrite, Financing, Casting, Crew, Locations, Schedule, Shoot, Edit, Sound and music, Color, Festivals and distribution, What is it about?, Screenplay, Production, First shoot day, Schedule and budget, Festivals, Add to this…, Roles to cast, Characters, The lead, Who is in the way, Auditions, Contacts and agents, Casting days, Post a casting call, Find crew, Storyboard, Shot list, The look, Props, Wardrobe, References, Scouting photos, Permits and permissions, Map, Find a location, Notes from the scout, Written, Prepped, Shot, Cut, Scene 1, Scene 2, Scene 3, New scene |
| `tvshow` | TV Show | shelved | project | `pj_tvshow` | What is the show?, The bible, Characters, The lead, Who is in the way, The friend, Pilot, Stages, Pitch, Bible, Pilot rewrite, Episodes broken, Series pitch, Where it stands, Screenplay, Add to this…, Episode 1, Beats, Episode 2, Episode 3, Episode 4, Episode 5, Episode 6, The season |
| `videoessay` | Video Essay | shelved | project | `pj_videoessay` | Where it stands, What is the argument?, Stages, Research, Outline, Script, Record the voice, Gather footage, Edit, Sound, Thumbnail and title, Publish, Words a day, Publishing, Your channel, Footage, Add to this…, Sources, Clips, Look, Edit notes |
| `song` | Song | shelved | project | `song` | Lyrics, Chords and structure, Tempo, Takes, Voice memo, Stages, Idea, Demo, Arrangement, Record, Mix, Master, Release, Where it stands, Distribute it, Add to this… |
| `album` | Album | shelved | project | `pj_album` | Where it stands, What is the record about?, Stages, Songs written, Demos, Tracklist, Recording, Mixing, Mastering, Artwork, Release, Sessions and release, Tempo, Distribute it, Bandcamp, Add to this…, Track 1, Track 2, Track 3, Track 4, Track 5, Track 6 |
| `musical` | Musical | shelved | project | `pj_musical` | What is it about?, Book, Characters, The lead, Who is in the way, Scenes and songs, Stages, Story, Song list, Book draft, Songs demoed, Table read, Workshop, Staging, Where it stands, Tempo, Rehearsal space, Add to this…, Opening number, The I want song, Act one finale, Eleven o’clock number, Demos |
| `play` | Play | shelved | project | `pj_play` | What is it about?, The play, Characters, The lead, Who is in the way, Scenes, Stages, Idea, First draft, Reading, Rewrite, Casting, Rehearsals, Tech, Opening, Where it stands, Rehearsals and shows, Schedule rehearsals, Add to this… |
| `script` | Screenplay | shelved | project | `pj_script` | What is it about?, The script, Beats, Pages a day, Stages, Logline, Treatment, Beat sheet, First draft, Notes, Rewrite, Polish, Where it stands, Characters, Write it, Add to this… |
| `novel` | Novel | shelved | project | `pj_novel` | What is it about?, Words a day, Write until it burns down, Sprint, Stages, Premise, Outline, First draft, Second draft, Readers, Final draft, Query or publish, Chapters, Where it stands, The manuscript, Find an agent, Write it, Add to this…, Characters, The lead, Who is in the way, The one who helps, The world, Places, Where it starts, Research, Look and feel |
| `shortstory` | Short Story | shelved | project | `pj_shortstory` | What is it about?, The story, Characters, The lead, Words a day, Stages, Idea, Draft, Rest it, Rewrite, Readers, Submit, Where it stands, Write until it burns down, Where to send it, Add to this… |
| `poem` | Poem | shelved | project | `pj_poem` | The poem, A way in, Begin with an object on the table, Write it as a letter, Only questions, Fourteen lines, The weather, and something else, Steal a first line, Ten minutes, Drafts, Lines worth keeping, Where to send it, Add to this… |
| `essay` | Essay | shelved | project | `writing` | What is the argument?, The essay, Outline, Words a day, Sources, Stages, Research, Draft, Cut, Edit, Publish, Look it up, Where it stands, Add to this… |
| `blogpost` | Blog Post | shelved | project | `pj_blogpost` | Who is it for, and what will they get?, The post, Headings, Publish on, Stages, Idea, Draft, Pictures, Edit, Title and summary, Publish, Share it, Your blog, Where it stands, Add to this… |
| `application` | Application | shelved | project | `app` | What does it do, for whom?, This release, Stages, Sketch, Prototype, Core feature, Test with someone, Polish, Ship, Screens, Bugs, The hard part, The repository, Design, Add to this… |
| `website` | Website | shelved | project | `pj_website` | Who is it for, and what should they do?, Pages, Look, Stages, Pages and words, Build, Content in, Test on a phone, Launch, The words, Where it stands, The site, Hosting, Add to this… |
| `game` | Game | shelved | project | `game` | What does the player do?, The rules, Test roll, Cards to try, A card, Another card, Stages, Core loop, Paper prototype, First playtest, Rules rewrite, Art, Second playtest, Release, Mechanics, Where it stands, Playtest notes, Print and play, Engine, Add to this… |
| `world` | Fantasy World | shelved | project | `world` | What makes it different?, History, Places, The capital, The edge of the map, Peoples and groups, Those in power, Laws of the world, How magic works, What it costs, Roll for it, What if…, A war nobody remembers, A god who left, A trade route, A forbidden word, Characters, Make a map, Add to this… |
| `device` | Device | shelved | project | `pj_device` | What does it do?, Parts, Sketches and wiring, Stages, Sketch, Parts ordered, Breadboard, Firmware, Enclosure, Test, Done, What is not working, Where it stands, Code, Add to this… |
| `handmade` | Handmade Object | shelved | project | `pj_handmade` | What is it, and who is it for?, Materials, References, Stages, Design, Make a test, Make it, Finish, Give it or keep it, Hours at the bench, One session, Where it stands, Supplies, Add to this… |
| `artwork` | Artwork | shelved | project | `artpiece` | What is it about?, Studies, References, Hours making, Stages, Sketches, Materials, Underpainting, The work, Finish, Photograph it, Where it stands, A timed study, Supplies, Add to this… |
| `braindump` | Brain Dump | **yes** | work | `wf_braindump` |  |
| `prioritizer` | Prioritizer | **yes** | work | `wf_prioritizer` | Do now, Plan it, Squeeze in, Let it go, Ask it, Will this matter in a year?, What happens if it never gets done?, Who is waiting on it?, Is there a smaller version?, What would make the rest easier?, Is it yours to do?, Ten minutes, How it works, Give it a time, Add to this… |
| `projectmgmt` | Project Management | shelved | work | `wf_projectmgmt` | Now, three at most, Next, Waiting on someone, Paused, Deadlines, Google Calendar, Focus, What one thing moves it most?, What can you drop?, What is blocked, and by whom?, Finish before you start, What is due first?, Ship the smallest version, Deep work, Add to this…, Someday, maybe…, Someday, Ideas for projects, Picking the next one, Can’t choose, The rule, Finished, Shipped this year, Looking back, Weekly review, Review, What did you finish?, What stalled, and why?, What should stop?, Who needs an update?, What is next week’s one thing?, This month |
| `brainstorming` | Brainstorm | shelved | work | `wf_brainstorming` | The question, Another idea…, Everything, no judging, The best three, Five minutes, Pick one at random, Oblique turns, Reverse it, Make it absurd, What would a child do?, Steal from another field, Make it free, Make it ten times bigger, Next step, Are.na, Add to this… |

### Compounds

Several objects made as one, grouped and tied. Make one with its key as the `type`. It needs its whole footprint clear, see §5.

| type | name | parts |
| --- | --- | --- |
| `cp_labelled` | Labeled drawer | label "What it is for" · drawer "Drawer" |
| `cp_quick` | Quick list | notepad "Notepad" · list "Quick list" |
| `cp_left` | Counted list | notepad "Notepad" · checklist "To do" · counter "Left to do" |
| `cp_barlist` | Checklist with a bar | notepad "Notepad" · checklist "Steps" · progressbar "How far" |
| `cp_habit` | Habit tracker | task "Every day" · counter "Days in a row" · progressbar "Toward thirty days" |
| `cp_draft` | Draft with a word count | note "Draft" · counter "Words" |
| `cp_spread` | Spread | label "A spread" · note "Left" · note "Right" |

### Attributes and their fields

An attribute is a trait; some carry a field, which is the key a value is written under.

| attribute | name | field | value | what it is |
| --- | --- | --- | --- | --- |
| `text` | Text |  |  | A markdown body |
| `check` | Checkbox | `done` | bool | A box on the left that completes it |
| `date` | Date | `due` | date | Can be scheduled, and shows up in Today |
| `deadline` | Hard deadline | `dead` | date | The day missing it costs something — separate from the day you have put it on |
| `softdeadline` | Soft deadline | `soft` | date | The day you mean to be done — a date you set yourself, with no consequence attached |
| `span` | Lasts | `till` | date | Runs from its date to another one — a trip, a shoot, a term |
| `repeat` | Repeats | `repeat` | repeat | Completing it spawns the next one |
| `button` | Button |  |  | A button that opens an object, a drawer, or a link |
| `container` | Container |  |  | Holds other objects — this is what makes a drawer |
| `magic` | Magic |  |  | Collects by rule instead of by hand, like a smart folder |
| `streak` | Streak |  |  | A daily cadence with a history, and no overdue |
| `progress` | Milestones |  |  | Ordered steps with a progress bar |
| `media` | Media |  |  | An image, video, or audio file |
| `link` | Link | `url` | text | A web address it points at |
| `count` | Count | `count` | number | A tally you add to |
| `rating` | Rating | `rating` | number | Out of five |
| `location` | Location | `loc` | text | Where it is |
| `duration` | Duration | `dur` | number | How long it will probably take, in minutes — half of what makes it urgent |
| `difficulty` | Difficulty | `diff` | level | How hard it is, 1 to 5 — not how long it takes and not how much it matters |
| `priority` | Priority | `prio` | level | How much it matters to you — 0 to 5, not how urgent it is |
| `price` | Price | `price` | money | What it costs |
| `answer` | Answerable | `answer` | text | A box to answer it in — filled means answered |
| `margin` | Margin |  |  | A running note you add to, each entry dated — never rewritten |
| `relates` | Related | `rel` | refs | Points at other objects, both ways |
| `total` | Total |  |  | Adds up a field across what it holds |
| `spawn` | Spawns |  |  | Makes new objects — on a press, or as you type into it |
| `decor` | Decoration |  |  | Stands above the board rather than in it — it may overlap anything, and nothing makes room for it |
| `backdrop` | Background |  |  | Lies under the board’s other things: they may stand on it, and it makes room for nothing |
| `control` | Control |  |  | A switch on the board for one of the desk's own settings |
| `movable` | Movable when locked |  |  | Can be picked up on a locked board — wears a pin |
| `resizable` | Resizable when locked |  |  | Corners still work on a locked board — wears a bracket |

Structural, never set by hand: `container`, `magic`.

### Faces and shapes

**Faces** (`face`, a container's outside): `front`, `checklist`, `list`, `project`, `life`, `calendar`, `collage`, `timeline`, `spine`, `pigeonhole`, `tag`.

**Shapes** (`shape`, a thing's outline): `card`, `rounded`, `note`, `tornnote`, `idea`, `page`, `index`, `verse`, `quote`, `bubble`, `plaque`, `portrait`, `band`, `tally`, `press`, `image`, `event`, `letter`, `postcard`, `telegram`, `torn`, `dream`, `none`.

<!-- vocabulary:end -->
