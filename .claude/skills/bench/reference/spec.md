# Writing a bench into the code

## 1. The spec (`SPECS` in `web/js/stockplans.js`)

```js
/* **The Darkroom bench** (decision NNN). Timothy: *"…his words…"*. What it
   is for, the moments as tiles and why, why this room, why this front. */
{key:'darkroom',               // the plan key; `pl_stock_darkroom` is its id
 nm:'Darkroom', ic:'image', c:12,   // name, icon, color slot (5 to 15)
 sec:'work',                   // which list: 'work', 'project', 'life', 'experience'
 of:'wf_darkroom',             // the type it makes, and that makes it
 raw:true,                     // lay out to the row; no stretching to twelve
 inbox:false,                  // no automatic "Add to this…" line (or a kind: 'note')
 rail:{left:['glass','stamp'], right:['block','lock']},
 env:{style:'starry', flow:'rigid', gravity:false},
 stamp:{w:'Keep', ink:'green'},
 makes:{only:['image','note','task'], sizes:[]},
 on:[                          // the first tile, where it opens
   {k:'question', t:'What is the roll for?', b:[1,1,8,2], set:{c:10}, body:'**Shot on —** '},
   NEWEST(LIST('Contact sheet', 'sheet', [1,3,5,9], 12)),
   {k:'hourglass', t:'Develop', b:[6,3,3,4], set:{c:12, mins:8}},
   LINK('Lightroom', 'https://lightroom.adobe.com', [6,7,3,1], 9),
   MAKES('A frame…', 'image', [1,13,8,2], 12, '@sheet')
 ],
 boards:[                      // more tiles, each at a step from the first
   {at:[1,0], raw:true, on:[ … ]}
 ]},
```

| Key | Means |
| --- | --- |
| `key`, `nm`, `ic`, `c` | the plan's key, name, icon, color slot |
| `sec` | the list it is shown in |
| `of` | the type that makes it (and that it makes when pressed on the desk) |
| `raw` | rows left empty stay empty; without it `fillRows()` stretches things to twelve rows |
| `inbox` | `false`: no way-in line added; a kind: the line makes only that kind |
| `rail`, `env`, `stamp`, `makes`, `quick` | the front, the room, the stamp, the Magic Selector, the quick add (`dials.md`) |
| `on` | the first tile's things: `{k, t, b:[x,y,w,h], set:{…}, body, ref, kids}` |
| `boards` | the other tiles: `{at:[x,y], raw, on}`, `[1,0]` right, `[0,1]` below |
| `sref` | `{ref:'name'}`: marks a thing a setup card writes into |
| `ref` and `'@ref'` | a local name, resolved in `tracks`, `into`, `from` |

Shorthands, all in `stockplans.js`: `LABEL`, `LIST`, `MAKES`, `LINK`, `CAL`,
`AGAIN` (a repeating task), `CARDS`, `ZONE`, `STAGES` (a checklist of steps),
`WITH` (a list with things already in it), `NEWEST`, `HERE` (a sorting rule
meaning "on this bench"), `PIPE`.

Rules for the things on it:

- Every `k` is a type key from GRAMMAR §8, never a cut type.
- Nothing overlaps on a tile (zones and backgrounds may lie under things).
- Width at most 8, the bottom at most row 14; rows 13 and 14 hold the line.
- Containers' contents (`kids`) get no box; they are placed when opened.

## 2. Wiring it in

1. **The type.** For a way of working: a row in `WORKFLOWS` in model.js
   (`[key, name, color, icon, description]`), which makes `wf_<key>` with
   `plan:'pl_stock_<key>'`. For a project or a part of life, the type in
   `PROJECT_TYPES` or `LIFE_ASPECTS` names the plan.
2. **Offered.** Add the key to `BENCH_READY` in model.js. A stock bench not in
   it is shelved: hidden from pickers, setup cards, the coin and the Benches
   door, but still pasteable.
3. **Existing desks.** Stock benches are user data, copied once. Add a
   migration at the end of `MIGRATIONS` in persist.js and raise `DATA_V`:

   ```js
   {v:NN, up(d){
     d.plans = d.plans || [];
     const fresh = {}; stockPlans().forEach(p=>{ fresh[p.stock] = p; });
     // a reworked bench: replace the stored plan's fields, never a bench put down
     d.plans.forEach(p=>{ if(!p || p.stock!=='darkroom' || !fresh.darkroom) return;
       ['objects','of','sec','boards','start','dims','makes','life','rail','env','stamp','quick'].forEach(k=>{
         if(fresh.darkroom[k]!==undefined) p[k] = JSON.parse(JSON.stringify(fresh.darkroom[k])); else delete p[k]; }); });
     // a new bench: add it by key
     const have = new Set(d.plans.map(p=>p && p.stock).filter(Boolean));
     if(!have.has('darkroom') && fresh.darkroom) d.plans.push(fresh.darkroom);
   }},
   ```

4. **Words.** Rerun `node scripts/grammar.mjs` so GRAMMAR §8 lists it and its
   things by title (that is what a paste's `fill` addresses).

## 3. Testing it

1. `scripts/serve.sh` running, then a block in `test/safari.mjs` near the
   other benches, using its `bench(kind, title)` and `write(pad, text)`
   helpers. Assert what makes it *this* bench (its room, its tiles, its line
   writing into the right list, its stamp or deck doing its job), and
   `await shot('NN-darkroom')` for **every tile** (scroll each into view).
2. `node test/safari.mjs`, then **look at every screenshot**. A passing
   assertion does not mean it looks right.
3. `node test/smoke-only.mjs <number>` for the smoke blocks it touches
   (`--list` names them by number); the full `node test/smoke.mjs` before
   saying it is done.
4. Bump `CACHE` in `web/sw.js` and `APP_VERSION` in `web/js/persist.js`
   together (in a shallow clone, the current `APP_VERSION` plus one);
   `node test/version.mjs` checks them.

## 4. Writing it down

- A decision in `docs/DECISIONS.md`: Timothy's words, what was built, what was
  chosen and why, what it still wants, the migration, what was tested.
- `docs/BENCHES.md`: the bench under *Built*, and any new ledger rows.
- A line in CLAUDE.md's *Current state*, and INTENT.md if he said something
  new about what he wants.
