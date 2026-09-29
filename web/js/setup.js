import { $, esc, ic, D, ROOT, outURL } from './util.js';
import { S, K, KINDS, T, dz, byId, has, isContainer, childrenOf, familyList, everyTag, faceOf, genKindOf, ASPECT_KINDS, WORKFLOW_KINDS } from './model.js';
import { becomeKind, create, pushSet, toast, seedInto, CONTROLS, CTL_KEYS } from './mutations.js';
import { plans, planById, planTop, stampPlan, planForKind } from './plans.js';
import { sampleTile, kindSample, closePanel } from './panels.js';
import { render } from './views.js';
import { openTile } from './motion.js';
import { LIFE_ART } from './decor.js';
import { hexOf } from './look.js';
import { save } from './persist.js';

/* ============================================================
   setting a thing up — decision 229
   ============================================================
   Timothy: making a drawer should make a plain drawer, and the first time
   you tap it a card fills the screen and asks what it is for — a project, an
   aspect of your life — as a short run of questions ("what are you trying
   to make?") with the pickers in them. The same for every object where the
   big choices are worth asking.

   **What is asked is the major settings, as questions.** Nothing here is a
   setting of its own: every answer writes a field the editor already has
   (`kind` through `becomeKind()`, `dead`, `filter.tag`, `calview`, a flow
   laid out with `stampPlan()`), so the card is a way in and the editor is
   still where anything is changed later.

   **It waits for the first tap.** An object made from the picker or the
   shape ring carries `setup` (a key in SETUPS) and is drawn plain, with a
   small mark; `tileTap()` asks `needsSetup()` before anything else and opens
   the card instead of the drawer or the reader. Seed data, flows, the coin
   and anything made by a rule never carry it — they already know what they
   are. "Leave it as it is" finishes the setup with nothing chosen; the cross
   puts the card away and it asks again next time.

   **A step is a question and what an answer does.** `ask(o)` draws the
   choices; `answer(o, v)` writes and returns the name of the next step, or
   null when that is the last. Branches are just a different next name, so a
   drawer that is for a project walks into the project's questions. The card
   is `#setup`, beside `#app` the way a panel is, so `render()` behind it
   leaves it alone and the tile under it changes as you answer. */

const SU = {id:null, step:null, trail:[]};
const setupOpen = ()=> !!SU.id;
const needsSetup = o => !!(o && o.setup && SETUPS[o.setup]);

/* ---- the pieces a question is made of --------------------------------- */
const typeArt = k => sampleTile(kindSample(k), 120, 84).replace(/<(\/?)button\b/g, '<$1span')
  .replace(/<input\b[^>]*>|<textarea\b[^>]*>[\s\S]*?<\/textarea>/g, '');
const planArt = p => {
  const top = planTop(p);
  const far = (k, s)=> top.reduce((m,o)=>{const b=o.desk||{}; return Math.max(m,(b[k]||1)+(b[s]||1)-1)},0);
  const rows = Math.max(6, far('y','h')), cols = Math.max(8, far('x','w'));
  return `<span class="deskmini sumini" style="--dcols:${cols};--drows:${rows}">${top.map(o=>{
    const b=o.desk||{x:1,y:1,w:2,h:2};
    return `<i style="--k:${hexOf(o.c!=null?o.c:K(o.kind).c)};grid-column:${b.x||1}/span ${b.w||1};grid-row:${b.y||1}/span ${b.h||1}"></i>`;
  }).join('')}</span>`;
};
const swatch = (bg, fg, txt) => `<span class="suswatch" style="background:${bg};color:${fg}">${esc(txt||'')}</span>`;
/* A choice: `v` is what `answer()` is handed. */
const choice = (v, label, note, art) => ({v, label, note, art});
const WHENS = [
  ['30', 'In a month'], ['90', 'In three months'], ['182', 'In six months'],
  ['year', 'By the end of the year'], ['', 'No date — someday']];
const whenOf = v => v==='year' ? `${new Date().getFullYear()}-12-31` : v ? dz(+v) : null;
/* Laying a flow into something that was only just made: the band a
   container is born with goes, because the flow brings its own way in. */
/* Only what a type is born holding, matched by its kind and its title, and
   taken out directly rather than through `del()`: it was put there a moment
   ago by the same answer, so an undo step for it would be one nobody meant. */
function clearSeed(o){
  const seeds = [].concat(...Object.keys(KINDS).map(k=>K(k).seed||[]));
  const isSeed = x => x.parent===o.id && seeds.some(sp=>sp.kind===x.kind && (sp.title||'')===(x.title||''));
  S.objects = S.objects.filter(x=>!isSeed(x));
}
/* Becoming a type the way being made one would: a type that opens onto its
   own board (a Film, a Song — decision 195) is laid out, as `create()` does
   and `becomeKind()` on its own does not. */
function becomeFresh(o, k){
  if(k!==o.kind) becomeKind(o.id, k);
  /* An aspect of life comes with its own front (decision 236): a drawer
     that was plain a moment ago takes it whole, since it had not been
     given one by anybody yet. */
  const look = K(k).look;
  if(look){ Object.assign(o, JSON.parse(JSON.stringify(look))); delete o.kshape; delete o.knobc; delete o.face; }
  if(K(k).nm && (!o.title || o.title===K(o.kind).nm)) o.title = K(k).nm;
  const pid = planForKind(k);
  if(pid && !o.flowSet){ clearSeed(o); if(stampPlan(pid, o.id).length) o.flowSet = true; }
}
/* **What a flow's setup card writes into** (decision 237): the things in the
   laid-out flow marked `sref`, anywhere inside this drawer. */
function srefs(o, name){
  const inside = new Set([o.id]), out = [];
  let grew = true;
  while(grew){ grew = false;
    S.objects.forEach(x=>{ if(x && !inside.has(x.id) && inside.has(x.parent)){ inside.add(x.id); grew = true; } }); }
  S.objects.forEach(x=>{ if(x && x.sref===name && inside.has(x.parent)) out.push(x); });
  return out;
}
const sref = (o, name) => srefs(o, name)[0] || null;
const lines = v => String(v||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0, 40);
// things typed a line each, made in the list the flow marked for them
function fillList(o, name, v, kind){
  const list = sref(o, name); if(!list) return 0;
  const ls = lines(v);
  ls.forEach(t=>create(kind || 'note', {parent:list.id, title:t, due:null}));
  return ls.length;
}
// an address typed as "chase.com" names its portal "Chase"
function pointPortal(p, v, label){
  if(!p || !v) return true;
  const u = outURL(v); if(!u){ toast('That is not an address'); return false; }
  pushSet('Changed', p.id, 'link', p.link);
  p.link = Object.assign({label:'Open'}, p.link, {target:u});
  if(label){ const host = u.replace(/^https?:\/\//,'').replace(/^www\./,'').split(/[\/.]/)[0];
    if(host) p.title = host[0].toUpperCase() + host.slice(1); }
  return true;
}
function layFlow(o, pid){
  const pl = planById(pid); if(!pl) return;
  if(pl.of && KINDS[pl.of] && pl.of!==o.kind && !has({kind:pl.of},'magic')) becomeKind(o.id, pl.of);
  clearSeed(o);
  if(pl.nm) o.title = pl.nm;
  if(pl.c!=null) o.c = pl.c;
  if(pl.life && LIFE_ART[pl.life]) o.lifeart = pl.life;
  stampPlan(pl.id, o.id);
  o.flowSet = true;
}
const tagChoices = () => everyTag().slice(0, 24).map(x=>choice('tag:'+x.t, '#'+x.t, x.n+' on the desk'));

/* ---- the questions ---------------------------------------------------- */
const SETUPS = {
  drawer: {start:'drawer.for'},
  project:{start:'project.what'},
  life:   {start:'life.board'},
  tag:    {start:'tag.which'},
  text:   {start:'text.what'},
  goal:   {start:'goal.what'},
  checklist:{start:'list.what'},
  list:   {start:'list.what'},
  calendar:{start:'cal.shows'},
  counter:{start:'count.what'},
  habit:  {start:'habit.what'},
  portal: {start:'portal.where'},
  button: {start:'button.does'},
  // an aspect made outright, and a workflow (decision 237)
  aspect: {start: o => aspectStart(o.kind)},
  workflow: {start:'workflow.which'},
};
/* The first of an aspect's own questions, by its key: `a.health.1`. */
const aspectStart = k => { const a = K(k).aspect; return a && STEPS['a.'+a+'.1'] ? 'a.'+a+'.1' : null; };
// which list a stock flow is drawn in, for grouping the aspects on the card
const PLAN_SEC = {health:'life', money:'life', exercise:'life', nutrition:'life', partner:'life', family:'life',
  friends:'life', communities:'life', home:'life', things:'life', travel:'experience', films:'experience',
  books:'experience', music:'experience', visual:'experience', games:'experience', food:'experience'};
const ROUTINES = {
  running:['Easy run','Intervals','Easy run','Long run'], gym:['Push','Pull','Legs','Full body'],
  yoga:['Flow','Strength','Stretch','Long practice'], cycling:['Easy ride','Hills','Easy ride','Long ride'],
  swimming:['Technique','Intervals','Easy swim','Long swim']};
const APPS = {strava:['Strava','https://www.strava.com'], apple:['Apple Fitness','https://www.apple.com/apple-fitness-plus/'],
  nrc:['Nike Run Club','https://www.nike.com/nrc-app'], peloton:['Peloton','https://www.onepeloton.com'],
  garmin:['Garmin Connect','https://connect.garmin.com']};
const PLAYERS = {spotify:['Spotify','https://open.spotify.com'], apple:['Apple Music','https://music.apple.com'],
  youtube:['YouTube Music','https://music.youtube.com'], tidal:['Tidal','https://tidal.com']};
// "64", "8", a goal written onto a measured habit the flow marked
function setGoal(o, name, v){
  const h = sref(o, name); if(!h) return;
  pushSet('Changed', h.id, 'measure', h.measure);
  if(v==='none'){ delete h.measure; return; }
  h.measure = Object.assign({}, h.measure, {goal:+v});
}
/* ---- each aspect's own questions — decision 237 ------------------------
   Written from what Timothy said each is for, and each answer filling in
   something already laid out in the flow. The last of them returns null and
   the drawer opens. */
const ASPECT_STEPS = {
  'a.health.1': {q:'How much water a day?', sub:'The tracker fills a glass at a time, eight ounces a tap.',
    ask:()=>[['48','48 oz'],['64','64 oz'],['80','80 oz'],['100','100 oz'],['none','Not tracking water']].map(([v,n])=>choice(v,n)),
    answer:(o,v)=>{ setGoal(o,'water',v); return 'a.health.2'; }},
  'a.health.2': {q:'How much sleep are you after?', sub:'A night logged an hour a tap.',
    ask:()=>[['6','6 hours'],['7','7 hours'],['8','8 hours'],['9','9 hours'],['none','Not tracking sleep']].map(([v,n])=>choice(v,n)),
    answer:(o,v)=>{ setGoal(o,'sleep',v); return 'a.health.3'; }},
  'a.health.3': {q:'Where is your patient portal?', sub:'The address you book appointments and see results at.',
    text:{ph:'mychart.example.org', go:'Done', skip:'Later'},
    answer:(o,v)=> pointPortal(sref(o,'portal'), v) ? null : 'a.health.3'},
  'a.money.1': {q:'Where do you bank?', sub:'It becomes the first way out of this drawer.',
    text:{ph:'chase.com', go:'Next', skip:'Later'},
    answer:(o,v)=> pointPortal(sref(o,'bank'), v, true) ? 'a.money.2' : 'a.money.1'},
  'a.money.2': {q:'What are you saving for?', sub:'The savings goal is named for it, and the bar under it fills as you tick its steps.',
    text:{ph:'Three months of expenses', go:'Done', skip:'Later'},
    answer:(o,v)=>{ const g = sref(o,'savings'); if(g && v){ pushSet('Renamed', g.id, 'title', g.title); g.title = v; } return null; }},
  'a.exercise.1': {q:'What do you train with?', sub:'The big portal at the top opens it.',
    ask:()=>Object.entries(APPS).map(([k,[n]])=>choice(k,n)).concat(choice('none','Nothing yet')),
    answer:(o,v)=>{ const p = sref(o,'app'), a = APPS[v];
      if(p && a){ p.title = a[0]; p.link = Object.assign({}, p.link, {label:a[0], target:a[1]}); }
      return 'a.exercise.2'; }},
  'a.exercise.2': {q:'What is the routine?', sub:'Four sessions a week to start, each coming back weekly.',
    ask:()=>[['running','Running'],['gym','The gym'],['yoga','Yoga'],['cycling','Cycling'],['swimming','Swimming'],['mixed','A bit of everything']].map(([v,n])=>choice(v,n)),
    answer:(o,v)=>{ const r = sref(o,'routine'), names = ROUTINES[v];
      if(r && names) S.objects.filter(x=>x.parent===r.id).forEach((x,i)=>{ if(names[i]) x.title = names[i]; });
      return 'a.exercise.3'; }},
  'a.exercise.3': {q:'How long a day?', sub:'Counted ten minutes a tap.',
    ask:()=>[['15','15 minutes'],['30','30 minutes'],['45','45 minutes'],['60','An hour']].map(([v,n])=>choice(v,n)),
    answer:(o,v)=>{ setGoal(o,'minutes',v); return null; }},
  'a.nutrition.1': {q:'Any allergies or intolerances?', sub:'One a line. Leave it empty if there are none.',
    area:{ph:'Peanuts\nLactose', go:'Next'},
    answer:(o,v)=>{ const n = sref(o,'allergies'); if(n && lines(v).length){ pushSet('Changed', n.id, 'body', n.body); n.body = lines(v).join('\n\n'); } return 'a.nutrition.2'; }},
  'a.nutrition.2': {q:'Keep the lists for reflux?', sub:'What is easier on it and what sets it off, to edit as you learn yours.',
    ask:()=>[choice('yes','Yes, keep them'), choice('no','No, take them off')],
    answer:(o,v)=>{ if(v==='no'){ const gone = new Set(srefs(o,'gerdgood').concat(srefs(o,'gerdbad')).map(x=>x.id));
      S.objects = S.objects.filter(x=>!gone.has(x.id)); } return null; }},
  'a.partner.1': {q:'What is her name?', sub:'The drawer is named for her, and so is the note of things to tell her.',
    text:{ph:'Her name', go:'Done', skip:'Leave it as Partner'},
    answer:(o,v)=>{ if(v){ pushSet('Renamed', o.id, 'title', o.title); o.title = v;
      const n = sref(o,'say'); if(n) n.title = 'Things to tell ' + v; } return null; }},
  'a.family.1': {q:'Who is in your family?', sub:'One a line. Each gets a card, and a monthly reminder to check in.',
    area:{ph:'Mom\nDad\nSam', go:'Done'},
    answer:(o,v)=>{ fillList(o,'people',v);
      const c = sref(o,'checkin'); if(c) lines(v).forEach(t=>create('task', {parent:c.id, title:'Check in with '+t,
        attrs:['text','check','date','repeat'], repeat:{every:1, unit:'month', days:[], from:'done', ends:null, paused:false, made:0}}));
      return null; }},
  'a.friends.1': {q:'Who are your friends?', sub:'One a line. The ones you would like to keep closer.',
    area:{ph:'Alex\nJordan', go:'Done'},
    answer:(o,v)=>{ fillList(o,'people',v); return null; }},
  'a.communities.1': {q:'What would you like to be part of?', sub:'One a line: a club, a group, a scene, a cause.',
    area:{ph:'A running club\nA film society', go:'Done'},
    answer:(o,v)=>{ fillList(o,'want',v,'task'); return null; }},
  'a.home.1': {q:'Which rooms?', sub:'One a line. Each gets its own list of chores.',
    area:{ph:'Kitchen\nBathroom\nBedroom\nLiving room', go:'Done'},
    answer:(o,v)=>{ const rooms = srefs(o,'room'), names = lines(v);
      if(!names.length) return null;
      rooms.forEach((r,i)=>{ if(names[i]) r.title = names[i]; });
      const gone = new Set(rooms.slice(names.length).map(r=>r.id));
      S.objects = S.objects.filter(x=>!gone.has(x.id) && !gone.has(x.parent));
      names.slice(rooms.length).forEach(t=>create('checklist', {parent:o.id, title:t, clhead:'1'}));
      return null; }},
  'a.things.1': {q:'What else needs looking after?', sub:'The car, the laptop and the phone are there already. One a line for the rest.',
    area:{ph:'The bike\nThe camera', go:'Done'},
    answer:(o,v)=>{ fillList(o,'things',v); return null; }},
  'a.travel.1': {q:'Where do you want to go?', sub:'One a line. Tick one off when you have been.',
    area:{ph:'Lisbon\nThe Lake District', go:'Done'},
    answer:(o,v)=>{ fillList(o,'want',v,'task'); return null; }},
  'a.films.1': {q:'What is your Letterboxd name?', sub:'The portal at the top goes to your own page.',
    text:{ph:'username', go:'Done', skip:'I do not use it'},
    answer:(o,v)=>{ const n = String(v||'').trim().replace(/^@/,''); const p = sref(o,'letterboxd');
      if(p && n && /^[\w.-]+$/.test(n)) p.link = Object.assign({}, p.link, {target:'https://letterboxd.com/'+n+'/'});
      return null; }},
  'a.books.1': {q:'What do you want to read next?', sub:'One a line. Tick one off when you have read it.',
    area:{ph:'Middlemarch\nThe Remains of the Day', go:'Done'},
    answer:(o,v)=>{ fillList(o,'toread',v,'task'); return null; }},
  'a.music.1': {q:'Where do you listen?', sub:'',
    ask:()=>Object.entries(PLAYERS).map(([k,[n]])=>choice(k,n)),
    answer:(o,v)=>{ const p = sref(o,'player'), a = PLAYERS[v];
      if(p && a){ p.title = a[0]; p.link = Object.assign({}, p.link, {label:a[0], target:a[1]}); }
      return 'a.music.2'; }},
  'a.music.2': {q:'Who are you listening to?', sub:'One a line.',
    area:{ph:'An artist\nAnother', go:'Done'},
    answer:(o,v)=>{ fillList(o,'artists',v); return null; }},
  'a.visual.1': {q:'Which museums would you like to visit?', sub:'One a line. Tick one off when you have been.',
    area:{ph:'The Met\nThe Rijksmuseum', go:'Done'},
    answer:(o,v)=>{ fillList(o,'museums',v,'task'); return null; }},
  'a.games.1': {q:'What do you want to play?', sub:'One a line. Tick one off when you finish it.',
    area:{ph:'A game\nAnother', go:'Done'},
    answer:(o,v)=>{ fillList(o,'toplay',v,'task'); return null; }},
  'a.food.1': {q:'Restaurants you want to try?', sub:'One a line. Tick one off when you have been.',
    area:{ph:'A place\nAnother', go:'Done'},
    answer:(o,v)=>{ fillList(o,'restaurants',v,'task'); return null; }},
};
const STEPS = {
  'drawer.for': {
    q:'What is this drawer for?', sub:'The answer decides what it is. Anything here can be changed later in its editor.',
    ask:()=>[
      choice('work', 'Something I am making', 'a project — a film, a book, an app, a trip', typeArt('project')),
      choice('life', 'A part of my life', 'health, money, the people in it — it is never finished', typeArt('life')),
      choice('tag', 'Everything with a tag', 'it gathers by itself instead of holding', typeArt('magic')),
      choice('flow', 'A way of working', 'a brainstorm, a brain dump, several projects at once', typeArt('workflow')),
      choice('keep', 'A place to keep things', 'a plain drawer, nothing more', typeArt('drawer'))],
    answer:(o,v)=>{
      if(v==='work'){ becomeKind(o.id, 'project'); return 'project.what'; }
      if(v==='life'){ becomeKind(o.id, 'life'); return 'life.board'; }
      if(v==='tag'){ becomeKind(o.id, 'magic'); return 'tag.which'; }
      if(v==='flow'){ becomeKind(o.id, 'workflow'); return 'workflow.which'; }
      return 'drawer.keeps';
    }},
  'drawer.keeps': {
    q:'What will you mostly keep in it?', sub:'Its picker leads with that, and the rest is one press further.',
    ask:()=>[['note','Notes'],['task','Things to do'],['image','Pictures'],['book','Writing'],['link','Links']]
      .filter(([k])=>KINDS[k] || k==='link').map(([k,nm])=>{
        const kk = k==='link' ? 'outlink' : k;
        return KINDS[kk] ? choice(kk, nm, '', typeArt(kk)) : null; }).filter(Boolean)
      .concat(choice('', 'A bit of everything', 'the whole picker')),
    answer:(o,v)=>{ pushSet('Changed', o.id, 'makes', o.makes);
      if(v) o.makes = {only:[v], sizes:[]}; else delete o.makes; return 'drawer.face'; }},
  'drawer.face': {
    q:'How should it look on the board?', sub:'Its face — what you see before you open it.',
    ask:()=>[['front','A drawer front','a knob and a name'],['checklist','A checklist','the tasks inside, to tick on the front'],
      ['list','A list','everything inside, one line each'],
      ['collage','A collage','the pictures inside, pinned up'],['spine','A book spine','standing on a shelf']]
      .map(([f,nm,n])=>choice(f, nm, n, typeArt(f==='front'?'drawer':f==='checklist'||f==='list'?f:f==='collage'?'moodboard':'book'))),
    answer:(o,v)=>{ pushSet('Changed', o.id, 'face', o.face); o.face = v==='front' ? undefined : v; return 'name'; }},
  'project.what': {
    q:'What are you making?', sub:'A kind of work, or a flow laid out inside it ready to use.',
    /* Every kind of work is a type with its flow now (decision 238), so the
       flows are only offered here when they are one you saved yourself. */
    ask:()=>{ const typed = new Set(Object.values(KINDS).map(d=>d.plan).filter(Boolean));
      return familyList('project').filter(k=>KINDS[k]).map(k=>choice('kind:'+k, K(k).nm, K(k).ds||'', typeArt(k)))
        .concat(plans().filter(p=>p && p.sec==='project' && !typed.has(p.id))
          .map(p=>choice('plan:'+p.id, p.nm||'A flow', 'a flow you saved, laid out inside', planArt(p)))); },
    group: v => v.startsWith('plan:') ? 'Or start from a flow' : 'A kind of work',
    answer:(o,v)=>{
      if(v.startsWith('plan:')) layFlow(o, v.slice(5));
      else becomeFresh(o, v.slice(5));
      return 'project.when';
    }},
  'project.when': {
    q:'When do you want it finished?', sub:'The day it is due. It shows on its front and on every calendar.',
    ask:()=>WHENS.map(([v,nm])=>choice('d'+v, nm)),
    answer:(o,v)=>{ pushSet('Changed', o.id, 'due', o.due); const d=whenOf(v.slice(1)); if(d) o.due=d; else delete o.due; return 'name'; }},
  /* **Which part of your life, shown as their knobs** (decision 236). Each is
     a type now, and choosing one makes this drawer it: its front, its flow
     laid out inside, and then its own questions. */
  'life.board': {
    q:'What part of your life is it for?', sub:'Each comes laid out for what it is for. Its knob is how you will know it.',
    ask:()=>ASPECT_KINDS.filter(k=>KINDS[k]).map(k=>choice(k, K(k).nm, K(k).ds||'', typeArt(k)))
      .concat(choice('none', 'No board, just a drawer', 'you lay it out yourself')),
    group: v => v==='none' ? 'Or' : (PLAN_SEC[(K(v).plan||'').replace('pl_stock_','')]==='experience' ? 'Something you take in' : 'A part of your life'),
    answer:(o,v)=>{
      if(v==='none') return 'name';
      becomeFresh(o, v);
      return aspectStart(v) || null;
    }},
  'workflow.which': {
    q:'Which way of working?', sub:'Each is a board laid out for it.',
    ask:()=>WORKFLOW_KINDS.filter(k=>KINDS[k]).map(k=>choice(k, K(k).nm, K(k).ds||'', typeArt(k))),
    answer:(o,v)=>{ becomeFresh(o, v); return null; }},
  'tag.which': {
    q:'What should it gather?', sub:'Everything carrying this tag, wherever it lives. Two or more with & between.',
    text:{ph:'e.g. kitchen, or task & due-week', go:'Gather these'},
    ask:()=>tagChoices(),
    answer:(o,v)=>{
      const tag = String(v||'').replace(/^tag:/,'').trim().replace(/^#/,'');
      if(!tag) return 'tag.which';
      pushSet('Changed', o.id, 'filter', o.filter ? JSON.parse(JSON.stringify(o.filter)) : o.filter);
      o.filter = Object.assign({}, o.filter, {tag});
      if(faceOf(o)!=='tag' && !o.title) o.title = '#'+tag;
      return faceOf(o)==='tag' ? null : 'name';
    }},
  'text.what': {
    q:'What are you writing?', sub:'It changes the binding and how it opens. The words are the same either way.',
    ask:()=>familyList('book').filter(k=>KINDS[k]).map(k=>choice(k, K(k).nm, K(k).ds||'', typeArt(k))),
    answer:(o,v)=>{ becomeFresh(o, v); return 'name'; }},
  'goal.what': {
    q:'What are you trying to accomplish?', sub:'Say it the way you would say it out loud.',
    text:{ph:'Run a half marathon', go:'Next', field:'title'},
    answer:(o,v)=>{ if(v){ pushSet('Renamed', o.id, 'title', o.title); o.title=v; } return 'goal.when'; }},
  'goal.when': {
    q:'By when?', sub:'The day it is late. Leave it open if it is a someday.',
    ask:()=>WHENS.map(([v,nm])=>choice('d'+v, nm)),
    answer:(o,v)=>{ pushSet('Changed', o.id, 'dead', o.dead); const d=whenOf(v.slice(1)); if(d) o.dead=d; else delete o.dead; return 'goal.steps'; }},
  'goal.steps': {
    q:'What are the steps to get there?', sub:'One a line. They become its milestones, and the bar fills as you tick them.',
    area:{ph:'Run 5k without stopping\nRun 10k\nSign up for a race', go:'Done'},
    answer:(o,v)=>{
      const lines = String(v||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0, 20);
      if(lines.length){ pushSet('Changed', o.id, 'milestones', o.milestones);
        o.milestones = lines.map(t=>({t, done:false})); }
      return null;
    }},
  'list.what': {
    q:'What is this list for?', sub:'Its name, printed at the top.',
    text:{ph:'Groceries', go:'Next', field:'title'},
    answer:(o,v)=>{ if(v){ pushSet('Renamed', o.id, 'title', o.title); o.title=v; } return 'list.items'; }},
  'list.items': {
    q:'What goes on it?', sub:'One a line. You can keep adding from its front.',
    area:{ph:'Eggs\nBread\nCoffee', go:'Done'},
    answer:(o,v)=>{
      String(v||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0, 60)
        .forEach(t=>create(genKindOf(o), {parent:o.id, title:t}));
      return null;
    }},
  'cal.shows': {
    q:'What should it show?', sub:'A calendar gathers what has a day and draws it on that day.',
    ask:()=>[choice('all', 'Everything with a date', 'the whole desk'),
             choice('tag', 'Only things with a tag', 'one part of it')],
    answer:(o,v)=> v==='tag' ? 'cal.tag' : 'cal.span'},
  'cal.tag': {
    q:'Which tag?', sub:'Only things carrying it are drawn.',
    text:{ph:'e.g. work', go:'Next'},
    ask:()=>tagChoices(),
    answer:(o,v)=>{
      const tag = String(v||'').replace(/^tag:/,'').trim().replace(/^#/,'');
      if(!tag) return 'cal.tag';
      pushSet('Changed', o.id, 'filter', o.filter ? JSON.parse(JSON.stringify(o.filter)) : o.filter);
      o.filter = Object.assign({}, o.filter || K(o.kind).filter, {tag});
      return 'cal.span';
    }},
  'cal.span': {
    q:'How much at once?', sub:'What one face of it covers.',
    ask:()=>[choice('month','A month'), choice('week','A week'), choice('day','A day')],
    answer:(o,v)=>{ pushSet('Changed', o.id, 'calview', o.calview); o.calview=v; return 'name'; }},
  'count.what': {
    q:'What are you counting?', sub:'A tap adds one. It is its name, shown when you hover or hold.',
    text:{ph:'Glasses of water', go:'Next', field:'title'},
    answer:(o,v)=>{ if(v){ pushSet('Renamed', o.id, 'title', o.title); o.title=v; } return 'count.look'; }},
  'count.look': {
    q:'What should the wheels look like?', sub:'The typeface and each colour are in its editor, under Look.',
    ask:()=>[['|','Black and cream'],['#E9E1CC|#16120E','Ivory and black'],['#8E3B38|#E2B85C','Red and gold'],
      ['#2E4A6B|#FFFFFF','Navy and white'],['#16120E|#8FE39A','Lamp green'],['#9A7B2F|#16120E','Brass']]
      .map(([v,nm])=>{ const [bg,fg]=v.split('|'); return choice(v, nm, '', swatch(bg||'#3C352B', fg||'#EFE7D2', '07')); }),
    answer:(o,v)=>{ const [bg,fg]=v.split('|');
      pushSet('Changed', o.id, 'wheelc', o.wheelc); pushSet('Changed', o.id, 'wink', o.wink);
      if(bg) o.wheelc=bg; else delete o.wheelc; if(fg) o.wink=fg; else delete o.wink; return null; }},
  'habit.what': {
    q:'What do you want to do?', sub:'Something you mean to keep doing.',
    text:{ph:'Stretch', go:'Next', field:'title'},
    answer:(o,v)=>{ if(v){ pushSet('Renamed', o.id, 'title', o.title); o.title=v; } return 'habit.often'; }},
  'habit.often': {
    q:'How often?', sub:'It keeps a square for every time it is owed.',
    ask:()=>[choice('day','Every day'), choice('twice','Twice a day'), choice('weekdays','On weekdays'),
             choice('mwf','Monday, Wednesday and Friday'), choice('week','Once a week'), choice('week3','Three times a week')],
    answer:(o,v)=>{
      pushSet('Changed', o.id, 'repeat', o.repeat); pushSet('Changed', o.id, 'times', o.times);
      const R = (unit, days) => ({every:1, unit, days:days||[], from:'date', ends:null, paused:false, made:0});
      const map = {day:[R('day'),1], twice:[R('day'),2], weekdays:[R('week',[1,2,3,4,5]),1],
        mwf:[R('week',[1,3,5]),1], week:[R('week'),1], week3:[R('week'),3]};
      const [r, n] = map[v] || map.day;
      o.repeat = r; if(n>1) o.times = n; else delete o.times;
      return 'habit.amount';
    }},
  /* An amount rather than a count (decision 232). The presets are the ones
     that come up; anything else is said in words, "64 oz, 8 at a time". */
  'habit.amount': {
    q:'Is it an amount?', sub:'Each tap can stand for some of it, and the tracker fills as you go.',
    text:{ph:'64 oz, 8 at a time', go:'Measure it'},
    ask:()=>[choice('none', 'No \u2014 just whether I did it'),
             choice('water', 'Water', '64 oz a day, a glass of 8 a tap'),
             choice('pages', 'Pages', '20 a day, 5 a tap'),
             choice('minutes', 'Minutes', '30 a day, 5 a tap')],
    answer:(o,v)=>{
      const PRESET = {water:{unit:'oz', goal:64, step:8}, pages:{unit:'pages', goal:20, step:5},
                      minutes:{unit:'min', goal:30, step:5}};
      let m = PRESET[v] || null;
      if(!m && v && v!=='none'){
        // "64 oz, 8 at a time" · "10000 steps 1000" · "3 litres"
        const nums = String(v).match(/\d+(?:\.\d+)?/g) || [];
        const unit = (String(v).replace(/\d+(?:\.\d+)?/g,' ').replace(/,|\bat a time\b|\ba tap\b|\beach\b|\bper\b/gi,' ')
          .trim().split(/\s+/)[0]) || '';
        if(!nums.length){ toast('Say how much, like 64 oz'); return 'habit.amount'; }
        m = {unit, goal:+nums[0], step: nums[1] ? +nums[1] : 1};
      }
      pushSet('Changed', o.id, 'measure', o.measure);
      if(m){ o.measure = m; delete o.times; } else delete o.measure;
      return null;
    }},
  'portal.where': {
    q:'Where does it go?', sub:'A web address, or leave it for now.',
    text:{ph:'example.com', go:'Next', skip:'Not yet'},
    answer:(o,v)=>{
      if(v){ const u = outURL(v); if(!u){ toast('That is not an address'); return 'portal.where'; }
        pushSet('Changed', o.id, 'link', o.link); o.link = Object.assign({label:'Open'}, o.link, {target:u}); }
      return 'portal.shape';
    }},
  'portal.shape': {
    q:'What shape is the way through?', sub:'',
    ask:()=>[choice('circle','A circle'), choice('square','A square'), choice('arch','An arch')],
    answer:(o,v)=>{ pushSet('Changed', o.id, 'pshape', o.pshape); o.pshape=v; return 'portal.inside'; }},
  'portal.inside': {
    q:'What do you see in it?', sub:'',
    ask:o=>[choice('vortex','A vortex'), choice('drift','Stars drifting past'), choice('rings','A tunnel')]
      .concat(o.link && o.link.target ? [choice('glimpse','A glimpse of the page')] : []),
    answer:(o,v)=>{ pushSet('Changed', o.id, 'pstyle', o.pstyle); o.pstyle=v; return null; }},
  /* **The Button** (decision 243): one question, "what happens when you tap
     it?", and then the one thing that answer needs. */
  'button.does': {
    q:'What happens when you tap it?', sub:'Anything here can be changed later in its editor.',
    ask:()=>[choice('make', 'It makes something', 'a note, a task, a thought, one of anything'),
             choice('open', 'It opens something', 'a drawer, a site, a number to call'),
             choice('switch', 'It flips a switch', 'the lock, the shadows, the aesthetic')],
    answer:(o,v)=>{ pushSet('Changed', o.id, 'does', o.does); o.does = v; return 'button.'+v; }},
  'button.make': {
    q:'What does it make?', sub:'One each press. To name things as you make them, use a notepad.',
    ask:()=>['note','task','thought','idea','question','image'].filter(k=>KINDS[k])
      .map(k=>choice(k, K(k).nm, '', typeArt(k))).concat(choice('random', 'One of anything', 'a different thing each time')),
    answer:(o,v)=>{ pushSet('Changed', o.id, 'genKind', o.genKind); o.genKind = v; return 'makes.where'; }},
  /* Where it goes (decision 258): beside it, or into a drawer on the same
     board. Tying it to one with the spool later says the same thing. */
  'makes.where': {
    q:'Where does it go?', sub:'Or tie it to a drawer with string later, and it goes there.',
    ask:o=>[choice('here', 'Beside the button', 'on the board')].concat(
      S.objects.filter(x=>x.id!==o.id && x.parent===o.parent && isContainer(x) && !has(x,'magic')).slice(0, 11)
        .map(x=>choice(x.id, 'Into '+(x.title||'Untitled'), K(x.kind).nm))),
    answer:(o,v)=>{ pushSet('Changed', o.id, 'into', o.into); if(v && v!=='here') o.into = v; else delete o.into; return 'name'; }},
  'button.open': {
    q:'What does it open?', sub:'A drawer on the desk, or an address.',
    text:{ph:'example.com, or tel:…', go:'Next'},
    ask:()=>S.objects.filter(x=>isContainer(x) && x.parent===ROOT).slice(0, 12)
      .map(x=>choice('id:'+x.id, x.title||'Untitled', K(x.kind).nm)),
    answer:(o,v)=>{ const t = String(v||'').trim(); if(!t) return 'button.open';
      pushSet('Changed', o.id, 'opens', o.opens);
      o.opens = t.startsWith('id:') ? t.slice(3) : (outURL(t) || /^[a-z]+:/i.test(t) ? t : 'https://'+t);
      return 'name'; }},
  'button.switch': {
    q:'Which switch?', sub:'One of the desk’s own settings, flipped or turned a step each press.',
    ask:()=>CTL_KEYS.map(k=>choice(k, CONTROLS[k].nm, CONTROLS[k].ds||'')),
    answer:(o,v)=>{ pushSet('Changed', o.id, 'ctl', o.ctl); o.ctl = v; return null; }},
  'name': {
    q:'What is it called?', sub:'Its name, on its front.',
    text:{ph:'A name', go:'Done', field:'title'},
    answer:(o,v)=>{ if(v && v!==o.title){ pushSet('Renamed', o.id, 'title', o.title); o.title=v; } return null; }},
};

Object.assign(STEPS, ASPECT_STEPS);

/* ---- drawing the card ------------------------------------------------- */
function cardHTML(o, st){
  const list = st.ask ? st.ask(o) : [];
  const groups = [];
  list.forEach(c=>{
    const g = st.group ? st.group(c.v) : '';
    let at = groups.find(x=>x.g===g); if(!at) groups.push(at={g, cs:[]});
    at.cs.push(c);
  });
  /* The object as it stands, drawn at the corner of a board of its own: its
     box keeps its size and loses its place, and it takes another id so the
     board behind and this picture never answer the same query. */
  const at1 = b => b ? Object.assign({}, b, {x:1, y:1}) : b;
  const pic = Object.assign({}, o, {id:'__setup', desk:at1(o.desk), phone:at1(o.phone), setup:null});
  const tile = sampleTile(pic, 220, 150).replace(/<(\/?)button\b/g, '<$1span')
    .replace(/<input\b[^>]*>|<textarea\b[^>]*>[\s\S]*?<\/textarea>/g, '');
  const field = st.text || st.area;
  const pre = field && field.field ? (o[field.field]||'') : '';
  const n = SU.trail.length + 1;
  return `<div class="sucard">
    <div class="sutop">
      <span class="sustep">${Array.from({length:n}, (_,i)=>`<i class="${i===n-1?'on':''}"></i>`).join('')}</span>
      <button class="suclose" data-act="setupclose" title="Put it away — it will ask again" aria-label="Close">${ic('x',16)}</button>
    </div>
    <div class="suwhat">${tile}</div>
    <h2 class="suq">${esc(st.q)}</h2>
    ${st.sub ? `<p class="susub">${esc(st.sub)}</p>` : ''}
    ${field ? `<div class="sufield">${st.area
        ? `<textarea id="setupin" rows="5" placeholder="${esc(field.ph||'')}">${esc(pre)}</textarea>`
        : `<input id="setupin" placeholder="${esc(field.ph||'')}" value="${esc(pre)}" autocomplete="off">`}
        <button class="pill suon" data-act="setupnext">${esc(field.go||'Next')}</button>
        ${field.skip ? `<button class="subtle-btn" data-act="setupnext" data-empty="1">${esc(field.skip)}</button>` : ''}</div>` : ''}
    ${groups.map(g=>`${g.g ? `<div class="sugroup">${esc(g.g)}</div>` : ''}
      <div class="suchoices${g.cs.some(c=>c.art) ? ' witharts' : ''}">${g.cs.map(c=>
        `<button class="suchoice" data-setupv="${esc(c.v)}">${c.art ? `<span class="suart">${c.art}</span>` : ''}
          <b>${esc(c.label)}</b>${c.note ? `<u>${esc(c.note)}</u>` : ''}</button>`).join('')}</div>`).join('')}
    <div class="sufoot">
      ${SU.trail.length ? `<button class="subtle-btn" data-act="setupback">${ic('chevL',12)} Back</button>` : '<span></span>'}
      <button class="subtle-btn" data-act="setupskip">Leave it as it is</button>
    </div>
  </div>`;
}
function draw(){
  const o = byId(SU.id), st = STEPS[SU.step];
  if(!o || !st){ closeSetup(); return; }
  let host = $('#setup');
  if(!host){ $('#frame').insertAdjacentHTML('beforeend', '<div id="setup" class="setup"></div>'); host = $('#setup');
    requestAnimationFrame(()=> host.classList.add('open')); }
  host.innerHTML = cardHTML(o, st);
  host.scrollTop = 0;
  const f = $('#setupin');
  // a phone raises its keyboard over the choices, so only a Mac is given the caret
  if(f && S.device==='desk') f.focus();
}

/* ---- the moves -------------------------------------------------------- */
function openSetup(id){
  const o = byId(id); if(!needsSetup(o)) return false;
  closePanel();
  const st = SETUPS[o.setup].start;
  SU.id = id; SU.step = typeof st==='function' ? st(o) : st; SU.trail = [];
  if(!STEPS[SU.step]){ SU.id = null; finish(o); return true; }
  draw();
  return true;
}
function closeSetup(){
  SU.id = null; SU.step = null; SU.trail = [];
  const host = $('#setup'); if(!host) return;
  host.id = 'setup-leaving'; host.classList.remove('open');
  setTimeout(()=> host.remove(), 260);
}
function setupAnswer(v){
  const o = byId(SU.id), st = STEPS[SU.step]; if(!o || !st) return;
  const next = st.answer(o, v);
  save(); render();
  if(next === SU.step){ draw(); return; }
  if(next){ SU.trail.push(SU.step); SU.step = next; draw(); return; }
  finish(o);
}
function setupNext(empty){
  const f = $('#setupin');
  setupAnswer(empty ? '' : (f ? f.value.trim() : ''));
}
function setupBack(){
  if(!SU.trail.length) return;
  SU.step = SU.trail.pop(); draw();
}
/* Finishing, with answers or without. A container that was born empty is
   given the band its type is seeded with, unless a flow already brought its
   own; and a container is then walked into, because that tap was a tap to
   go in. */
function finish(o, skipped){
  delete o.setup;
  if(isContainer(o) && !o.flowSet && !S.objects.some(x=>x.parent===o.id)) seedInto(o, o.kind);
  delete o.flowSet;
  save();
  const id = o.id;
  closeSetup();
  render();
  if(!skipped) toast(`${o.title || K(o.kind).nm} is set up`);
  if(isContainer(o) && !has(o,'magic')) openTile(id, ()=>{ S.view='drawer'; S.drawerId=id; S.kindFilter=null; render(); });
}
function setupSkip(){ const o = byId(SU.id); if(o) finish(o, true); else closeSetup(); }

export { SETUPS, needsSetup, setupOpen, openSetup, closeSetup, setupAnswer, setupNext, setupBack, setupSkip };
