/* ---- ranking a deck — decision 299 ---------------------------------------
   Timothy: "every priority in a deck of cards we can swipe left and right to
   rank… tap to pull up full screen style and do the swiping, then someplace
   you can then read the priority list from most to least."

   **One card against one other.** The card being placed is big; above it is
   a card already placed, and the question is whether the big one matters
   more. Swipe right for more, left for less. Each answer halves where it can
   go (a binary insertion), so a card takes about log₂ of the deck in swipes:
   four for a dozen. Insertion rather than Counterweight's merge sort (the
   artifact this is modelled on) because a deck of priorities is alive: a card
   added next week is asked about by itself, and nothing already settled is
   asked again.

   **The order is the deck's.** `ranked` on the deck is the ids, most
   important first, and `rankAt` the card being placed and the window it can
   still land in, so stopping half way loses nothing. Each card's `ord`
   follows the ranking, so the deck in a list reads in order, and `top` is
   the first, so the deck on the board shows your first priority.

   The surface is `#rank`, beside `#app` the way the setup card is, so
   `render()` behind it leaves it alone. It answers its own pointer and its
   own clicks (the painter's arrangement, decision 271), stopping them there
   so nothing on the board under it arms. */
import { S, byId } from './model.js';
import { $, esc, ic } from './util.js';
import { pushSet, toast } from './mutations.js';
import { save } from './persist.js';
import { render } from './views.js';
import { cardFace, deckCards } from './active.js';
import { objColour } from './look.js';

const RK = {id:null, view:'swipe', hist:[]};
const rankOpen = ()=> !!RK.id;

// placed, most important first: only cards still in the deck and not done
const rankedOf = d => (Array.isArray(d.ranked) ? d.ranked : [])
  .filter((id, i, a)=>{ const x = byId(id); return x && x.parent===d.id && !x.done && a.indexOf(id)===i; });
// waiting to be placed, in the deck's own order
const waitingOf = d => { const r = new Set(rankedOf(d));
  return deckCards(d).filter(x=>!x.done && !r.has(x.id)).sort((a,b)=>(a.ord??0)-(b.ord??0)); };

/* The card being placed and the window it may still land in, made good
   against whatever changed since (a card taken out, one added). A window
   that has closed is a place: the card goes in there, and the next one up.
   The first card has nothing to be weighed against and is placed at once. */
function settle(d){
  for(let guard=0; guard<500; guard++){
    const ranked = rankedOf(d), wait = waitingOf(d);
    if(!wait.length){ d.ranked = ranked; delete d.rankAt; return null; }
    let at = d.rankAt;
    if(!at || at.id!==wait[0].id || !(at.lo>=0 && at.hi<=ranked.length && at.lo<=at.hi))
      at = d.rankAt = {id:wait[0].id, lo:0, hi:ranked.length};
    if(at.lo < at.hi){ d.ranked = ranked; return {card:byId(at.id), pivot:byId(ranked[(at.lo+at.hi)>>1])}; }
    ranked.splice(at.lo, 0, at.id);
    d.ranked = ranked; delete d.rankAt;
  }
  return null;
}
// the ranking written where the rest of Bureau reads an order
function writeOrder(d){
  const ranked = rankedOf(d), wait = waitingOf(d);
  ranked.forEach((id, i)=>{ byId(id).ord = i; });
  wait.forEach((x, j)=>{ x.ord = ranked.length + j; });
  if(ranked.length) d.top = ranked[0];
}
const snap = d => ({ranked:rankedOf(d).slice(), rankAt:d.rankAt ? {...d.rankAt} : null});
function remember(d){
  RK.hist.push(snap(d)); if(RK.hist.length>60) RK.hist.shift();
  pushSet('Ranked', d.id, 'ranked', d.ranked ? d.ranked.slice() : d.ranked);
}

function answer(more){
  const d = byId(RK.id); if(!d) return;
  const at = d.rankAt; if(!at || at.lo>=at.hi) return;
  remember(d);
  const mid = (at.lo+at.hi)>>1;
  if(more) at.hi = mid; else at.lo = mid+1;
  settle(d); writeOrder(d); save();
  if(!d.rankAt) RK.view = 'order';
  draw();
}
function undoAnswer(){
  const d = byId(RK.id); if(!d) return;
  const was = RK.hist.pop();
  if(!was){ toast('Nothing to take back'); return; }
  d.ranked = was.ranked; if(was.rankAt) d.rankAt = was.rankAt; else delete d.rankAt;
  writeOrder(d); save(); RK.view = 'swipe'; draw();
}
// one card back into the pile, asked about next
function rankAgain(id){
  const d = byId(RK.id), x = byId(id); if(!d || !x) return;
  remember(d);
  d.ranked = rankedOf(d).filter(r=>r!==id); delete d.rankAt;
  x.ord = -1; settle(d); writeOrder(d); save();
  RK.view = 'swipe'; draw();
}
function startOver(){
  const d = byId(RK.id); if(!d) return;
  remember(d);
  d.ranked = []; delete d.rankAt; settle(d); writeOrder(d); save();
  RK.view = 'swipe'; draw();
}

/* ---- the surface ------------------------------------------------------- */
const face = (o, cls) => `<div class="dkcard up ${cls}" style="--c:${objColour(o)}">${cardFace(o)}</div>`;
const two = n => String(n).padStart(2, '0');
function swipeHTML(d, q){
  const done = rankedOf(d).length, all = done + waitingOf(d).length;
  const left = Math.max(1, Math.ceil(Math.log2((d.rankAt.hi - d.rankAt.lo) + 1)));
  return `<p class="rkq">Does this matter more than</p>
    <div class="rkvs">${face(q.pivot, 'rkpivot')}</div>
    <div class="rkpile">
      <div class="rkcard" data-rkdrag>${face(q.card, 'rkface')}
        <i class="rklab rkmore">More</i><i class="rklab rkless">Less</i></div>
    </div>
    <div class="rkbtns">
      <button class="rkbtn" data-rk="less">${ic('chevL',14)} Less</button>
      <button class="rkbtn rksmall" data-rk="undo">Undo</button>
      <button class="rkbtn" data-rk="more">More ${ic('chevR',14)}</button>
    </div>
    <p class="rkhint">${done} of ${all} placed · about ${left} more for this one</p>`;
}
function orderHTML(d){
  const ranked = rankedOf(d).map(byId), wait = waitingOf(d);
  if(!ranked.length && !wait.length) return `<p class="rkempty">Nothing in this deck yet. Write your priorities on
    the line under it, then come back and swipe.</p>`;
  return `<h2 class="rkh">Your priorities, in order</h2>
    <ol class="rklist">${ranked.map((x, i)=>`<li class="${i<3?'rktop':''}"><span class="rkn">${two(i+1)}</span>
      <b>${esc(x.title||'Untitled')}</b>
      <button class="rkagain" data-rk="again" data-id="${esc(x.id)}" title="Rank this one again">${ic('undo',13)}</button></li>`).join('')}</ol>
    ${wait.length ? `<p class="rkwait">${wait.length} not placed yet</p>
      <button class="rkbtn rkgo" data-rk="swipe">Keep ranking</button>` : ''}
    ${ranked.length>1 ? `<button class="rkbtn rksmall rkover" data-rk="over">Start over</button>` : ''}`;
}
function draw(){
  const d = byId(RK.id); if(!d){ closeRank(); return; }
  let host = $('#rank');
  if(!host){
    $('#frame').insertAdjacentHTML('beforeend', '<div id="rank" class="rank"></div>');
    host = $('#rank'); wireHost(host);
    requestAnimationFrame(()=> host.classList.add('open'));
  }
  const q = settle(d);
  if(!q) RK.view = 'order';
  host.innerHTML = `<div class="rkstage">
    <div class="rkhead">
      <b class="rktitle">${esc(d.title||'Deck')}</b>
      ${RK.view==='swipe' ? `<button class="rkbtn rksmall" data-rk="order">The order</button>` : ''}
      <button class="rkbtn rksmall" data-rk="close">Done</button>
    </div>
    ${RK.view==='swipe' && q ? swipeHTML(d, q) : orderHTML(d)}
  </div>`;
}
function openRank(id){
  const d = byId(id); if(!d) return;
  RK.id = id; RK.hist = []; RK.view = 'swipe';
  draw();
}
function closeRank(){
  RK.id = null; RK.hist = [];
  const host = $('#rank');
  if(host){ host.id = 'rank-leaving'; host.classList.remove('open'); setTimeout(()=> host.remove(), 260); }
  render();
}
const ACTS = {less:()=>answer(false), more:()=>answer(true), undo:undoAnswer, close:closeRank, over:startOver,
  order:()=>{ RK.view='order'; draw(); }, swipe:()=>{ RK.view='swipe'; draw(); }};
function rankKey(e){
  if(!rankOpen()) return false;
  const k = e.key;
  if(k==='Escape'){ closeRank(); return true; }
  if(RK.view!=='swipe') return false;
  if(k==='ArrowRight'){ fling(1); return true; }
  if(k==='ArrowLeft'){ fling(-1); return true; }
  if(k==='z' || k==='Backspace'){ undoAnswer(); return true; }
  return false;
}

/* ---- the swipe ----------------------------------------------------------
   The card follows the finger and leans with it, and the word on the side it
   is going to comes up as it goes. Let go past a third of the card's width,
   or flicked, and it is answered: the state changes and the next card is
   drawn at once, and a copy of this one flies off over the result (an
   animation never holds anything up, decision 38). */
const FLING_AT = .34, FLICK = .6;   // of the card's width; px per ms
let DRAG = null;
function fling(dir){
  const card = $('#rank .rkcard');
  if(card){
    const r = card.getBoundingClientRect(), fly = card.cloneNode(true);
    fly.classList.add('rkfly'); fly.removeAttribute('data-rkdrag');
    Object.assign(fly.style, {left:r.left+'px', top:r.top+'px', width:r.width+'px', height:r.height+'px',
      transform:card.style.transform || 'none'});
    document.body.appendChild(fly);
    requestAnimationFrame(()=>{ fly.style.transform = `translateX(${dir*window.innerWidth}px) rotate(${dir*24}deg)`;
      fly.style.opacity = '0'; });
    setTimeout(()=> fly.remove(), 420);
  }
  answer(dir>0);
  const next = $('#rank .rkcard'); if(next) next.classList.add('rkin');
}
function lean(card, dx){
  card.style.transform = `translateX(${dx}px) rotate(${dx/18}deg)`;
  const w = card.offsetWidth || 1, t = Math.min(1, Math.abs(dx)/(w*FLING_AT));
  card.querySelector('.rkmore').style.opacity = dx>0 ? t : 0;
  card.querySelector('.rkless').style.opacity = dx<0 ? t : 0;
}
function wireHost(host){
  host.addEventListener('pointerdown', e=>{
    e.stopPropagation();
    const card = e.target.closest('[data-rkdrag]'); if(!card) return;
    DRAG = {card, x:e.clientX, t:performance.now(), vx:0, lx:e.clientX, lt:performance.now(), id:e.pointerId};
    card.classList.add('rkheld');
    try{ card.setPointerCapture(e.pointerId); }catch(err){}
  });
  host.addEventListener('pointermove', e=>{
    if(!DRAG || e.pointerId!==DRAG.id) return;
    const now = performance.now(), dt = Math.max(1, now - DRAG.lt);
    DRAG.vx = .7*DRAG.vx + .3*((e.clientX - DRAG.lx)/dt); DRAG.lx = e.clientX; DRAG.lt = now;
    lean(DRAG.card, e.clientX - DRAG.x);
  });
  const up = e=>{
    if(!DRAG || e.pointerId!==DRAG.id) return;
    const g = DRAG; DRAG = null;
    const dx = e.clientX - g.x, w = g.card.offsetWidth || 1;
    g.card.classList.remove('rkheld');
    if(Math.abs(dx) > w*FLING_AT || (Math.abs(g.vx) > FLICK && Math.abs(dx) > 24)){ fling(dx>0 ? 1 : -1); return; }
    lean(g.card, 0);
  };
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  host.addEventListener('click', e=>{
    e.stopPropagation();
    const b = e.target.closest('[data-rk]'); if(!b) return;
    if(b.dataset.rk==='again'){ rankAgain(b.dataset.id); return; }
    const f = ACTS[b.dataset.rk]; if(f) f();
  });
}

export { rankOpen, openRank, closeRank, rankKey, RK };
