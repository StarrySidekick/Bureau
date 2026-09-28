import { $, esc, ic, D, ROOT, outURL } from './util.js';
import { S, K, KINDS, T, dz, byId, has, isContainer, childrenOf, familyList, everyTag, faceOf, genKindOf } from './model.js';
import { becomeKind, create, pushSet, toast, seedInto } from './mutations.js';
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
  const pid = planForKind(k);
  if(pid && !o.flowSet){ clearSeed(o); if(stampPlan(pid, o.id).length) o.flowSet = true; }
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
  calendar:{start:'cal.shows'},
  counter:{start:'count.what'},
  habit:  {start:'habit.what'},
  portal: {start:'portal.where'},
};
const STEPS = {
  'drawer.for': {
    q:'What is this drawer for?', sub:'The answer decides what it is. Anything here can be changed later in its editor.',
    ask:()=>[
      choice('work', 'Something I am making', 'a project — a film, a book, an app, a trip', typeArt('project')),
      choice('life', 'A part of my life', 'health, money, the people in it — it is never finished', typeArt('life')),
      choice('tag', 'Everything with a tag', 'it gathers by itself instead of holding', typeArt('magic')),
      choice('keep', 'A place to keep things', 'a plain drawer, nothing more', typeArt('drawer'))],
    answer:(o,v)=>{
      if(v==='work'){ becomeKind(o.id, 'project'); return 'project.what'; }
      if(v==='life'){ becomeKind(o.id, 'life'); return 'life.board'; }
      if(v==='tag'){ becomeKind(o.id, 'magic'); return 'tag.which'; }
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
    ask:()=>[['front','A drawer front','a knob and a name'],['checklist','A list','what is inside, on the front'],
      ['collage','A collage','the pictures inside, pinned up'],['spine','A book spine','standing on a shelf']]
      .map(([f,nm,n])=>choice(f, nm, n, typeArt(f==='front'?'drawer':f==='checklist'?'checklist':f==='collage'?'moodboard':'book'))),
    answer:(o,v)=>{ pushSet('Changed', o.id, 'face', o.face); o.face = v==='front' ? undefined : v; return 'name'; }},
  'project.what': {
    q:'What are you making?', sub:'A kind of work, or a flow laid out inside it ready to use.',
    ask:()=>familyList('project').filter(k=>KINDS[k]).map(k=>choice('kind:'+k, K(k).nm, K(k).ds||'', typeArt(k)))
      .concat(plans().filter(p=>p && p.sec==='project').map(p=>choice('plan:'+p.id, p.nm||'A flow', 'a flow, laid out inside', planArt(p)))),
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
  'life.board': {
    q:'What part of your life is it for?', sub:'Each is a board laid out inside it, with room beside it for what you add.',
    ask:()=>plans().filter(p=>p && (p.sec==='life' || p.sec==='experience'))
      .map(p=>choice('plan:'+p.id, p.nm||'A flow', p.sec==='experience'?'something you take in':'a part of your life', planArt(p)))
      .concat(choice('none', 'No board, just a drawer', 'you lay it out yourself')),
    group: v => v==='none' ? 'Or' : (planById(v.slice(5))||{}).sec==='experience' ? 'Something you take in' : 'A part of your life',
    answer:(o,v)=>{ if(v.startsWith('plan:')) layFlow(o, v.slice(5)); return 'name'; }},
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
  'name': {
    q:'What is it called?', sub:'Its name, on its front.',
    text:{ph:'A name', go:'Done', field:'title'},
    answer:(o,v)=>{ if(v && v!==o.title){ pushSet('Renamed', o.id, 'title', o.title); o.title=v; } return null; }},
};

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
  SU.id = id; SU.step = SETUPS[o.setup].start; SU.trail = [];
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
