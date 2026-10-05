/* ============================================================
   Claude in Bureau — decision 306
   ============================================================
   Timothy, 2026-10-05: physical objects in digital space, *"paired with AI
   possibilities to scope and build quickly but rooted in that physicality
   that gives one personal structure and clarity."* So Claude here never
   writes prose into a chat. It writes **objects**, in the same grammar a
   paste uses (docs/GRAMMAR.md), and they arrive where you asked:

     · a whole board comes as a **flat-pack** (USES.md §2, approved): a
       parcel on the desk that you unfold when you choose, and throw in the
       bin if you do not want it;
     · a task **opens into its steps** (it becomes a checklist, in place);
     · a question gets a **draft answer** in its own box;
     · a board, or a box drawn on one with the Magic Selector, **fills in**
       with what it is missing.

   Opt-in and explicit. Nothing is sent until a key is set in Settings →
   Claude, and nothing is sent except by a press that says what it will do.
   What is sent is the thing asked about and the board it is on: titles,
   pages and answers there, never the whole desk. The key is the person's
   own (an Anthropic API key) and is kept apart from the desk, so a backup or
   an export never carries it (persist.js, `aiCfg()`).

   Raw `fetch` to the Messages API rather than the SDK: Bureau takes no
   dependencies and has no build step (CLAUDE.md). The browser is allowed by
   the header the SDK itself sends for `dangerouslyAllowBrowser`. JSON comes
   back through **structured outputs** (`output_config.format`), because
   Claude Opus 5.5 and Sonnet 5.5 refuse a forced tool call; the schemas are
   flat (no recursion) with every field required (an empty string or 0 means
   none), which keeps them inside the limits on optional and union fields. */
import { $, esc, ic, D, ROOT, BIN } from './util.js';
import { S, K, KINDS, KEYS, byId, has, isContainer, childrenOf, container, isCut, isShelved, kindHas, answered, dev, homeFor, faceOf } from './model.js';
import { aiCfg, setAiCfg, addSpec, backupBefore, save } from './persist.js';
import { create, toast, pushUndo, pushSet, becomeKind, binMany } from './mutations.js';
import { anySpot, boxOk, sizeOfKind } from './grid.js';
import { openPanel, closePanel, refreshPanel } from './panels.js';
import { render, reveal, settingsPanel } from './views.js';
import { renderSheet } from './sheet.js';

const AI_URL = 'https://api.anthropic.com/v1/messages';
/* The models offered, the most capable first and the default (the skill's
   rule: Opus unless the person chooses otherwise). */
const AI_MODELS = [
  ['claude-opus-5-5', 'Claude Opus 5.5', 'The most capable: the best boards'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5', 'Quicker and about half the cost'],
  ['claude-haiku-4-5', 'Claude Haiku 4.5', 'Quickest and cheapest, for small asks'],
];
const AI_DEFAULT = 'claude-opus-5-5';
const modelOf = () => { const m = (aiCfg() || {}).model; return AI_MODELS.some(x=>x[0]===m) ? m : AI_DEFAULT; };
const aiReady = () => !!AI.stub || !!((aiCfg() || {}).key);

/* A stand-in for the network, set by a test (`BUREAU.aiStub`): it is handed
   the request body and returns what the API would have. Never set in use. */
const AI = {stub:null, asking:new Set()};

class AIError extends Error {
  constructor(said, code){ super(said); this.code = code || 'error'; }
}

/* ---- the grammar, as Claude reads it ----------------------------------
   Built from the running app, the way `scripts/grammar.mjs` builds §8, so
   it is always the types Bureau has today. Stable for a whole session, so it
   is cached; today's date and the ask go in the message, never here. */
/* **The types Claude may write**, named rather than worked out: the ones
   that are whole from a title, a body and what they hold. Left out are the
   tools and instruments (a press, not a thing to write), anything that needs
   a file (pictures, sound, video), the sorting kinds that need a rule (tag,
   calendar, Now), the bin, pipes and benches. A type cut or shelved later
   drops out by itself. */
const AI_TYPES = ['project','drawer','list','checklist','label','contents','task','note','idea','thought','question',
  'problem','outline','essay','script','quote','letter','postcard','poem','review','appt','timeline','notepad',
  'deck','card','jar','film','novel','shortstory','scene','character','place','artifact','creature','histevent','law','group'];
const usable = k => !!KINDS[k] && AI_TYPES.includes(k) && !isCut(k) && !isShelved(k);
let GRAMMAR = null;
function grammarPrompt(){
  if(GRAMMAR) return GRAMMAR;
  const kinds = AI_TYPES.filter(usable);
  const line = k => `- ${k}: ${K(k).nm}${kindHas(k,'container') ? ' (holds things)' : ''}. ${
    String(K(k).ds||'').replace(/\s+/g,' ').replace(/\s*[—–]\s*/g, ': ')}`;
  GRAMMAR = `You build boards for Bureau, a personal desk app on an iPhone where everything is a physical object on a grid of square cells, eight cells across. You never write chat. You answer only with the JSON the schema asks for, and every object you write is put on the board as it is.

The person is Timothy. He uses Bureau for his own projects, writing, films and life. Write for him: plain, specific and real, never placeholder ("Task 1"), in American English, in sentence case, with no exclamation marks and no em dashes (use a colon or a comma). Short titles: a task is a verb and its object ("Book the rehearsal room"); a page is a noun ("The pitch").

The types you may use (the key is what goes in "type"):
${kinds.map(line).join('\n')}

How a board is read and laid out:
- Things are laid out in the order you give them, left to right and top to bottom, each at its own width and height in cells (w, h). Use 0 for the type's usual size.
- A "label" 8 wide and 1 tall is a section heading. A "contents" lists the board's headings. Start a section with a label and put its things after it.
- A project's next step is its first unchecked task in reading order, so put a "checklist" called "Next" near the top, its steps in the order they should be done.
- Pages that hold reading go inside a "list" (4 wide, 5 or 6 tall), one "note" per page, rather than loose on the board.
- A question is a "question" with the question as its title; its body may say why it matters.
- A "due" date is YYYY-MM-DD, or "" for none. Only date something that really falls on a day.
- A body is markdown: **bold**, lists, short tables, and [[Page title]] to link another page on the board.
- Fewer, real things beat many thin ones.`;
  return GRAMMAR;
}

/* ---- the schemas ------------------------------------------------------- */
const typeEnum = () => AI_TYPES.filter(usable);
const leafProps = () => ({
  type: {type:'string', enum: typeEnum()},
  title: {type:'string'}, body: {type:'string'}, due: {type:'string'},
  w: {type:'integer'}, h: {type:'integer'} });
const LEAF_REQ = ['type','title','body','due','w','h'];
function itemsSchema(){
  return {
    $defs: {
      leaf: {type:'object', properties: leafProps(), required: LEAF_REQ, additionalProperties:false},
      item: {type:'object', properties: Object.assign(leafProps(), {children: {type:'array', items: {$ref:'#/$defs/leaf'}}}),
        required: [...LEAF_REQ, 'children'], additionalProperties:false},
    },
    type:'object',
    properties: {said: {type:'string'}, children: {type:'array', items: {$ref:'#/$defs/item'}}},
    required: ['said','children'], additionalProperties:false };
}
function boardSchema(){
  const s = itemsSchema();
  s.properties = Object.assign({title: {type:'string'}, about: {type:'string'}}, s.properties);
  s.required = ['title','about','said','children'];
  return s;
}
const STEPS_SCHEMA = {type:'object', properties: {steps: {type:'array', items: {type:'string'}}, said: {type:'string'}},
  required: ['steps','said'], additionalProperties:false};
const ANSWER_SCHEMA = {type:'object', properties: {answer: {type:'string'}}, required: ['answer'], additionalProperties:false};

/* ---- the request -------------------------------------------------------
   One call, structured output, refusal fallbacks on (the API reroutes a
   declined request to a model it recommends), effort set explicitly: Opus
   5.5 defaults to medium, which is right for a board; Haiku takes no effort
   setting and thinks only when asked. */
async function askClaude(ask, schema, effort){
  const cfg = aiCfg() || {};
  if(!cfg.key && !AI.stub) throw new AIError('Add your Claude key in Settings → Claude first', 'nokey');
  const model = modelOf();
  const body = {
    model, max_tokens: 16000,
    system: [{type:'text', text: grammarPrompt(), cache_control: {type:'ephemeral'}}],
    messages: [{role:'user', content: ask}],
    output_config: {format: {type:'json_schema', schema}},
  };
  if(model!=='claude-haiku-4-5') body.output_config.effort = effort || 'medium';
  const headers = {'content-type':'application/json', 'x-api-key': cfg.key || '', 'anthropic-version':'2023-06-01',
    'anthropic-dangerous-direct-browser-access':'true'};
  if(model==='claude-opus-5-5' || model==='claude-sonnet-5-5'){ headers['anthropic-beta'] = 'server-side-fallback-2026-07-01'; body.fallbacks = 'default'; }
  let j;
  if(AI.stub) j = await AI.stub(body);
  else {
    const ctl = new AbortController(), timer = setTimeout(()=>ctl.abort(), 180000);
    let r;
    try{ r = await fetch(AI_URL, {method:'POST', headers, body: JSON.stringify(body), signal: ctl.signal}); }
    catch(e){ throw new AIError(e && e.name==='AbortError' ? 'Claude took too long. Try again, or ask for less' : 'Could not reach Claude. Are you online?', 'net'); }
    finally{ clearTimeout(timer); }
    try{ j = await r.json(); }catch(_){ j = null; }
    if(!r.ok){
      const said = j && j.error && j.error.message ? j.error.message : `Claude answered ${r.status}`;
      if(r.status===401) throw new AIError('Claude did not accept that key', 'key');
      if(r.status===429 || r.status===529) throw new AIError('Claude is busy. Try again in a minute', 'busy');
      throw new AIError(said, 'api');
    }
  }
  if(!j) throw new AIError('Claude sent nothing back', 'api');
  if(j.stop_reason==='refusal') throw new AIError('Claude would not make that', 'refusal');
  if(j.stop_reason==='max_tokens') throw new AIError('That came out too long. Ask for less at once', 'long');
  const text = (j.content||[]).filter(b=>b && b.type==='text').map(b=>b.text).join('');
  try{ return JSON.parse(text); }
  catch(_){ throw new AIError('Claude sent something Bureau could not read', 'parse'); }
}

/* ---- what is said about where you are ---------------------------------
   The board a thing is on, as its headings, its things and its About: enough
   for Claude to write in its voice and not repeat it. Capped, so a board of
   two hundred things sends its first two hundred lines, not a novel. */
function boardSaid(c, cap){
  if(!c) return '';
  const out = [`Board: "${c.title||'The desk'}"`];
  const lines = [];
  // in reading order: a list top to bottom (newest first), a board by where things lie
  const dv = dev();
  const inOrder = x => { const kids = childrenOf(x).slice();
    if(x.id!==ROOT && ['list','checklist'].includes(faceOf(x))) return kids.reverse();
    const at = o => o[dv] || o.desk || o.phone || {x:0, y:0};
    return kids.sort((a, b)=>(at(a).y - at(b).y) || (at(a).x - at(b).x)); };
  const walk = (x, depth) => inOrder(x).forEach(o=>{
    if(lines.length >= (cap||160)) return;
    const pad = '  '.repeat(depth);
    const what = has(o,'heading') ? `## ${o.title}` : `${pad}- ${K(o.kind).nm}: ${o.title||'Untitled'}${o.done?' (done)':''}${
      has(o,'answer') ? (answered(o) ? ` (answered: ${String(o.answer).slice(0,140)})` : ' (unanswered)') : ''}`;
    lines.push(what);
    const b = String(o.body||'').trim();
    if(b && !has(o,'heading') && depth < 2) lines.push(`${pad}  ${b.replace(/\s+/g,' ').slice(0, 280)}`);
    if(isContainer(o) && !has(o,'magic') && depth < 2) walk(o, depth+1);
  });
  walk(c, 0);
  return out.concat(lines).join('\n');
}
const today = () => `Today is ${new Date().toLocaleDateString('en-US', {weekday:'long', year:'numeric', month:'long', day:'numeric'})} (${D.iso(D.today())}).`;

/* ---- turning an answer into specs -------------------------------------- */
const clean = s => String(s||'').trim();
function toSpec(x){
  if(!x || !KINDS[x.type]) return null;
  const spec = {type: x.type, title: clean(x.title) || K(x.type).nm};
  if(clean(x.body)) spec.body = clean(x.body);
  spec.due = /^\d{4}-\d{2}-\d{2}$/.test(clean(x.due)) ? clean(x.due) : null;
  if(x.w > 0) spec.w = Math.min(8, x.w|0);
  if(x.h > 0) spec.h = Math.min(14, x.h|0);
  if(Array.isArray(x.children) && x.children.length){
    // a list shows its newest first, so its lines are given last to first
    const kids = x.children.map(toSpec).filter(Boolean);
    spec.children = kindHas(x.type,'container') && ['list','checklist'].includes(K(x.type).face) ? kids.reverse() : kids;
  }
  return spec;
}

/* ---- the four asks ----------------------------------------------------- */
// a whole board, from a sentence: the spec for a flat-pack
async function aiBoard(what){
  const r = await askClaude(`${today()}\n\nMake a board for this:\n${what}\n\nGive it a short title, a two-sentence About, and the things on it in reading order: first a contents, a "Next" checklist of the first real steps, and any open questions as a list of questions; then a section per part of it, each a label and what belongs there. "said" is one plain sentence about what you made.`, boardSchema(), 'medium');
  const kids = (r.children||[]).map(toSpec).filter(Boolean);
  // the About page sits with the head of the board, before its first section
  const sec = kids.findIndex(k=>k.type==='label');
  if(clean(r.about)) kids.splice(sec < 0 ? kids.length : sec, 0, {type:'note', title:'About', body:clean(r.about), w:4, h:5});
  return {spec: {type:'project', title: clean(r.title) || 'A new board', children: kids}, said: clean(r.said)};
}
// a task's steps, in the order they are done
async function aiSteps(o){
  const home = container(o.parent||ROOT);
  const r = await askClaude(`${today()}\n\nBreak this task into the steps it takes, in order: between three and seven, each a short task title, the first one something to do today.\n\nTask: ${o.title}${o.body?`\nNotes: ${o.body}`:''}\n\n${boardSaid(home, 80)}\n\n"said" is one plain sentence.`, STEPS_SCHEMA, 'low');
  return {steps: (r.steps||[]).map(clean).filter(Boolean).slice(0, 9), said: clean(r.said)};
}
// a first answer to a question, for him to keep or rewrite
async function aiAnswer(o){
  const home = container(o.parent||ROOT);
  const proj = home && home.id!==ROOT ? home : null;
  const r = await askClaude(`${today()}\n\nDraft an answer to this question from his board: a few plain sentences he could keep or rewrite, saying what you would do and why. If it is his to decide, give the options and your recommendation.\n\nQuestion: ${o.title}${o.body?`\nWhy it matters: ${o.body}`:''}\n\n${boardSaid(proj && proj.parent ? container(proj.parent) : home, 60)}\n\n${proj ? boardSaid(proj, 120) : ''}`, ANSWER_SCHEMA, 'medium');
  return clean(r.answer);
}
// what a board, or a box on it, is missing
async function aiFill(c, ask, room){
  const r = await askClaude(`${today()}\n\n${boardSaid(c, 160)}\n\n${room ? `Fill a space on this board ${room.w} cells wide and ${room.h} tall, so everything you give must fit inside it: ` : 'Add what this board is missing: '}${ask || 'the next useful things, in its voice, without repeating what is there'}.\n\n"said" is one plain sentence about what you added.`, itemsSchema(), 'medium');
  return {specs: (r.children||[]).map(toSpec).filter(Boolean), said: clean(r.said)};
}

/* ============================================================
   what a press does
   ============================================================
   Every ask follows decision 38: the thing it is about is marked at once
   (`AI.asking`, drawn as a glow, or a parcel that says it is packing) and the
   desk is free while Claude writes. The answer lands on the object when it
   comes, if the object is still there: an undo or a delete in the meantime
   wins, and the answer is dropped. */
const begin = id => { AI.asking.add(id); render(); };
const end = id => { AI.asking.delete(id); };
const still = id => { const o = byId(id); return o && o.parent!==BIN ? o : null; };
function needKey(){
  toast('Add your Claude key first: Settings → Claude');
  settingsPanel('claude');
}

/* How many things a pack holds, for its tag. */
function packCount(spec){
  let n = 0; const walk = list => (list||[]).forEach(c=>{ n++; if(c && Array.isArray(c.children)) walk(c.children); });
  walk(spec && spec.children);
  return n;
}

/* Where a new thing goes: beside the pen that was pressed, if there is room,
   else the first place on the board that takes it. */
function spotFor(w, h, cid, near){
  const dv = dev(), b = near && near.parent===cid ? near[dv] : null;
  if(b) for(const [x, y] of [[b.x+b.w, b.y], [b.x, b.y+b.h], [b.x-w, b.y], [b.x, b.y-h]]){
    const box = {x, y, w, h};
    if(x>=1 && y>=1 && boxOk(box, null, dv, cid)) return box;
  }
  return anySpot(w, h, dv, cid);
}

/* ---- the Ask card --------------------------------------------------------
   What the pen opens: a line to say what you want, and the one or two things
   Claude can do with it here. On the desk that is a new board; inside a
   container it is filling that board in, or a new board on it. */
function openAsk(cid, penId){
  const home = homeFor(cid || ROOT), c = home===ROOT ? null : byId(home);
  const where = c ? (c.title || 'this drawer') : 'the desk';
  openPanel({key:'ask', title:'Ask Claude', sub: c ? `In ${esc(where)}` : 'On the desk', body:()=>`
    ${aiReady() ? '' : `<div class="mini" style="--k:var(--brass);margin-bottom:8px">Claude needs your key first. It is kept on this device only.
      <div style="margin-top:6px"><button class="pill solid" data-ssec="claude">${ic('sparkle',13)} Add your key</button></div></div>`}
    <textarea id="askbox" class="editor" style="min-height:110px" enterkeyhint="send"
      placeholder="${c ? `What ${esc(where)} is missing, or a whole new board: “the shot list for Saturday”` :
        'What to build: “a short film about a lighthouse keeper, shooting in March”'}"></textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      ${c && isContainer(c) && !has(c,'magic') ? `<button class="pill solid" data-act="askgo" data-verb="fill" data-id="${esc(home)}"${penId?` data-pen="${esc(penId)}"`:''}>${ic('plus',13)} Fill in ${esc(where)}</button>` : ''}
      <button class="pill${c ? '' : ' solid'}" data-act="askgo" data-verb="build" data-id="${esc(home)}"${penId?` data-pen="${esc(penId)}"`:''}>${ic('archive',13)} ${c ? 'A new board, flat-packed' : 'Build it, flat-packed'}</button>
    </div>
    <div class="mini" style="--k:var(--brass);margin-top:8px">${c
      ? `Filling in adds to ${esc(where)} under what is there. A new board arrives as a parcel; press it to unfold it.`
      : 'It arrives as a parcel beside the pen. Keep working while Claude writes; press the parcel to unfold it.'}
      Only what you write here${c ? ` and what is on ${esc(where)}` : ''} is sent.</div>`});
  requestAnimationFrame(()=>{ const t = $('#askbox'); if(t) t.focus(); });
}
function askGo(verb, cid, penId){
  const t = $('#askbox'), what = clean(t && t.value);
  if(!aiReady()) return needKey();
  if(verb==='fill'){ closePanel(); return askFill(cid, what); }
  if(!what){ toast('Say what to build first'); if(t) t.focus(); return; }
  closePanel();
  askBuild(what, cid, penId ? byId(penId) : null);
}

/* ---- build: a parcel now, its contents when Claude has written them ------ */
function askBuild(what, cid, pen){
  const home = homeFor(cid || ROOT), dv = dev();
  const [w, h] = sizeOfKind('flatpack', dv, home);
  const p = create('flatpack', {parent:home, title: what.length > 60 ? what.slice(0, 57)+'…' : what});
  p.ask = what;
  p[dv] = spotFor(w, h, home, pen);
  pushUndo('Asked Claude', [{add:p.id}]);
  save();
  return packParcel(p.id, true);
}
async function packParcel(id, fresh){
  const p = still(id); if(!p || AI.asking.has(id)) return;
  delete p.err;
  begin(id);
  if(fresh) reveal(id);
  toast('Claude is packing it. Keep going; it lands here');
  try{
    const r = await aiBoard(p.ask);
    const q = still(id); if(!q) return;
    q.pack = r.spec; q.title = r.spec.title; q.said = r.said || '';
    save();
    toast(`“${r.spec.title}” is packed. Press it to unfold`);
  }catch(e){
    const q = still(id); if(q){ q.err = e.message; save(); }
    toast(e.message || 'Claude could not pack that');
  }finally{ end(id); render(); }
}
function parcelTap(id){
  const p = byId(id); if(!p) return;
  if(AI.asking.has(id)) return toast('Claude is still packing this one');
  if(p.pack) return unfold(id);
  if(!p.ask) return toast('This parcel is empty');
  if(!aiReady()) return needKey();
  packParcel(id);
}
/* **Unfolding**: a backup first (backupBefore, decision 305), then the
   board laid by the paste's rules where the parcel was, and the parcel in
   the bin. One move, so one Undo folds it back up. */
function unfold(id){
  const p = byId(id); if(!p || !p.pack) return;
  const dv = dev(), at = p[dv] ? Object.assign({}, p[dv]) : null, home = p.parent || ROOT;
  backupBefore(`unfolding ${p.title || 'a flat-pack'}`);
  const spec = Object.assign(JSON.parse(JSON.stringify(p.pack)), {arrange:'rows', status:true});
  delete spec.update; delete spec.key;
  const binned = binMany([id]);
  const tally = {drawers:0, objects:0, made:[], sets:[], updated:0};
  const b = addSpec(spec, home, tally);
  if(b && at && b[dv]){
    const want = {x:at.x, y:at.y, w:b[dv].w, h:b[dv].h};
    if(boxOk(want, b.id, dv, home)) b[dv] = want;
  }
  pushUndo('Unfolded', [...tally.made.map(x=>({add:x})), ...binned]);
  save(); render();
  if(!b) return;
  toast(`Unfolded ${b.title || 'it'}: ${tally.made.length - 1} things inside`, true);
  requestAnimationFrame(()=>{ const n = document.querySelector(`#app [data-drawer="${b.id}"]`);
    if(n){ n.classList.add('unfolded'); setTimeout(()=>n.classList.remove('unfolded'), 1200); } });
}

/* ---- a task into its steps ----------------------------------------------
   It becomes a checklist where it lies (becomeKind), holding the steps in
   order, first on top. One move: the conversion and every step. */
async function askSteps(id){
  if(!aiReady()) return needKey();
  const o = still(id); if(!o || AI.asking.has(id)) return;
  begin(id); toast('Claude is breaking it down');
  try{
    const r = await aiSteps(o);
    const q = still(id); if(!q || !r.steps.length) return;
    if(!isContainer(q) && !becomeKind(id, 'checklist')) return;
    const move = S.undo[S.undo.length-1];
    // a list shows its newest first, so the steps are made last to first
    r.steps.slice().reverse().forEach(t=>{
      const x = create('task', {parent:id, title:t, noSeed:true});
      x.due = null;
      if(move) move.steps.push({add:x.id});
    });
    save();
    toast(`${r.steps.length} steps, first on top`, true);
  }catch(e){ toast(e.message || 'Claude could not break that down'); }
  finally{ end(id); render(); }
}

/* ---- a question, drafted --------------------------------------------------
   Written into its answer and marked `drafted`, so it reads as Claude's
   until it is changed or kept, and the board still counts it as open. */
async function askAnswer(id){
  if(!aiReady()) return needKey();
  const o = still(id); if(!o || AI.asking.has(id)) return;
  begin(id); toast('Claude is drafting an answer');
  try{
    const a = await aiAnswer(o);
    const q = still(id); if(!q || !a) return;
    pushSet('Drafted an answer', id, 'answer', q.answer);
    q.answer = a; q.drafted = true;
    save();
    toast('A draft is in its answer: change it or keep it', true);
  }catch(e){ toast(e.message || 'Claude could not draft that'); }
  finally{ end(id); render(); renderSheet(); }
}
function keepDraft(id){
  const o = byId(id); if(!o || !o.drafted) return;
  pushSet('Kept the draft', id, 'drafted', true);
  delete o.drafted; save(); render(); renderSheet();
  toast('Kept as the answer', true);
}

/* ---- a board, filled in ----------------------------------------------------
   What Claude adds goes under what is there, in reading order (the paste's
   packing with its floor set below the last thing on the board), as one move. */
async function askFill(cid, ask){
  if(!aiReady()) return needKey();
  const c = still(cid); if(!c || !isContainer(c) || has(c,'magic') || AI.asking.has(cid)) return;
  begin(cid); toast(`Claude is filling in ${c.title || 'this drawer'}`);
  try{
    const r = await aiFill(c, ask);
    const q = still(cid); if(!q || !r.specs.length) return;
    const dv = dev();
    const floor = 1 + childrenOf(q).reduce((m, x)=>x[dv] ? Math.max(m, x[dv].y + x[dv].h - 1) : m, 0);
    const tally = {drawers:0, objects:0, made:[], sets:[], updated:0};
    r.specs.forEach(sp=>addSpec(sp, cid, tally, {pack:{floor}}));
    pushUndo('Filled in', tally.made.map(x=>({add:x})));
    save();
    toast(r.said || `${tally.made.length} things added to ${q.title || 'it'}`, true);
  }catch(e){ toast(e.message || 'Claude could not fill that in'); }
  finally{ end(cid); render(); }
}

/* ---- the key, tried -------------------------------------------------------
   The models list costs nothing and answers only to a good key, so it is
   what Try it asks. */
async function tryKey(){
  const cfg = aiCfg() || {};
  if(AI.stub) return toast('The key works');
  if(!cfg.key) return toast('No key yet');
  try{
    const r = await fetch('https://api.anthropic.com/v1/models?limit=1', {headers:{'x-api-key':cfg.key,
      'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true'}});
    toast(r.ok ? 'The key works' : r.status===401 ? 'Claude did not accept that key' : `Claude answered ${r.status}`);
  }catch(e){ toast('Could not reach Claude. Are you online?'); }
}
function keepKey(){
  const t = $('#aikey'), k = clean(t && t.value);
  if(!k) return toast('Paste your key first');
  if(!/^sk-ant-/.test(k)) return toast('That does not look like an Anthropic key: they start sk-ant-');
  setAiCfg({key:k, model: modelOf()});
  refreshPanel(); toast('Key kept on this device');
}
function forgetKey(){ setAiCfg({model:(aiCfg()||{}).model}); refreshPanel(); toast('Key taken away'); }
function chooseModel(m){ if(!AI_MODELS.some(x=>x[0]===m)) return;
  setAiCfg({key:(aiCfg()||{}).key, model:m}); refreshPanel(); }

// the four schemas, for the test that holds them to the API's limits
const aiSchemas = () => ({items: itemsSchema(), board: boardSchema(), steps: STEPS_SCHEMA, answer: ANSWER_SCHEMA});

export { aiSchemas, AI, AIError, AI_MODELS, AI_DEFAULT, aiReady, modelOf, askClaude, grammarPrompt, aiBoard, aiSteps, aiAnswer, aiFill, toSpec,
  openAsk, askGo, askBuild, packParcel, parcelTap, packCount, unfold, askSteps, askAnswer, keepDraft, askFill,
  tryKey, keepKey, forgetKey, chooseModel };
