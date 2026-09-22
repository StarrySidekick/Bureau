import { esc } from './util.js';
import { S, byId } from './model.js';
import { save } from './persist.js';

/* ============================================================
   23 · things that run — decision 182
   ============================================================
   Six objects that are not information. Everything else on this desk is
   something you wrote down; a metronome, an hourglass, a candle, a bell, a
   clock and a die are **instruments** — you press them and they do something,
   and what they know is a setting rather than a note.

   One table, `ACTIVE`, keyed on `act`, exactly the way `DECOR` and `CONTROLS`
   are keyed: the artwork, the tap, the settings the zoom offers, and the
   sound. Nothing outside this file knows what a metronome is, so a seventh
   instrument is a row here and a kind in model.js and nothing else anywhere.

   ---- the discipline, which is the whole of why this is safe ----------------

   **Nothing ticks by re-rendering.** `render()` rebuilds the board from `S`
   (decision 64) and an animation never holds a state change up (decision 38),
   so an instrument that redrew itself sixty times a second would be fighting
   both. Three answers, in order of preference:

   1. **A CSS animation with a negative `animation-delay`.** A clock's hands
      and an hourglass's sand are written as one infinite animation started
      *in the past* by however much has already elapsed — so they are correct
      on the first frame, need no timer at all, and cost the compositor and
      nothing else. This is the answer wherever the thing moves continuously.
   2. **A timestamp, read at render.** A candle stores when it was lit and how
      long it burns; how much wax is left is arithmetic done while the tile is
      being built. Nothing counts down; the number is derived.
   3. **A timer, and only where there is no other answer.** A metronome has to
      make a noise on the beat, which nothing can derive. `RUNNING` holds
      those intervals in a module map **outside the DOM**, the same shape
      decision 71 uses for a playing sound, so an unrelated render cannot
      silence one.

   `MINUTE` is the single shared tick for the two things that have to *finish*
   — an alarm going off and a candle guttering out. One interval for the whole
   app rather than one per object, and it stops itself when nothing needs it.

   **The sound is synthesised.** Web Audio, a few oscillators, no files in
   `SHELL` and no dependency — which is what a click and a ding need and all
   they need. The context is made on the first press, never at load, because a
   browser will not start one before a gesture and a suspended context that
   nobody asked for is a warning in the console on every launch. */

/* ---- the noise ---------------------------------------------------------- */
let AC = null;
function audio(){
  try{
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if(AC.state === 'suspended') AC.resume();
    return AC;
  }catch(e){ return null; }
}
/* One voice. `exponentialRampToValueAtTime` rather than a linear fade because
   loudness is logarithmic and a linear ramp on a short click audibly steps. It
   cannot reach zero, hence the small floor. */
function voice(ac, {freq, type='sine', at=0, dur=0.08, gain=0.15, glide=0}){
  const o = ac.createOscillator(), g = ac.createGain();
  const t = ac.currentTime + at;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if(glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq*glide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
/* A metronome's click: a short woodblock, and the downbeat a fifth higher so
   you can hear where the bar starts without counting. */
function tick(strong){
  const ac = audio(); if(!ac) return;
  voice(ac, {freq: strong ? 1650 : 1100, type:'square', dur:0.035, gain:0.12, glide:0.55});
}
/* A desk bell is a struck bowl: a fundamental, a slightly detuned partial and
   a high strike tone that dies first. Three voices is the difference between a
   bell and a beep. */
function ding(){
  const ac = audio(); if(!ac) return;
  voice(ac, {freq:1244, type:'sine', dur:1.5,  gain:0.16});
  voice(ac, {freq:1867, type:'sine', dur:1.1,  gain:0.09});
  voice(ac, {freq:2489, type:'sine', dur:0.35, gain:0.05});
}

/* ---- the one timer, for the two things that have to finish --------------- */
const RUNNING = new Map();          // id -> interval handle, for metronomes
let MINUTE = null;                  // the shared once-a-minute check
/* Started when something needs watching and stopped when nothing does, so an
   idle desk holds no timer at all. `onMinute` is set by boot.js, because what
   to *do* about a finished candle is a render and this module does not render. */
let onMinute = null;
function setMinuteHandler(fn){ onMinute = fn; }
function mindTheTime(){
  const need = S.objects.some(o => actOf(o) === 'clock' ? !!o.alarm : burning(o));
  if(need && !MINUTE) MINUTE = setInterval(()=>{ if(onMinute) onMinute(); }, 20000);
  if(!need && MINUTE){ clearInterval(MINUTE); MINUTE = null; }
}

/* ---- what a thing is, and what it knows ---------------------------------- */
const actOf = o => (o && (o.act || (o.kind && ACT_KIND[o.kind]))) || null;
const isActive = o => !!ACTIVE[actOf(o)];

const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;
const bpmOf    = o => Math.min(240, Math.max(30, Math.round(num(o.bpm, 88))));
const minsOf   = o => Math.min(180, Math.max(1, Math.round(num(o.mins, 5))));
const burnOf   = o => Math.min(1440, Math.max(5, Math.round(num(o.burn, 120))));
const sidesOf  = o => (DICE.includes(o.sides) ? o.sides : 6);
const clockOf  = o => (CLOCKS[o.clock] ? o.clock : 'wall');
const DICE = [4, 6, 8, 10, 12, 20];
/* Five card backs, drawn rather than named colours: a back is a *pattern*, and
   the ink in all five is `--glow` so each aesthetic prints its own. */
const BACKS = {
  lattice:{nm:'Lattice', art:`<g stroke="var(--glow)" stroke-width="1" opacity=".55">${
    Array.from({length:9},(_,i)=>`<path d="M${20+i*10} 22 L${20+i*10} 142"/>`).join('')}${
    Array.from({length:13},(_,i)=>`<path d="M18 ${24+i*10} L102 ${24+i*10}"/>`).join('')}</g>`},
  rays:{nm:'Rays', art:`<g stroke="var(--glow)" stroke-width="1.2" opacity=".6">${
    Array.from({length:16},(_,i)=>{const a=i*22.5*Math.PI/180;
      return `<path d="M60 82 L${(60+Math.cos(a)*44).toFixed(1)} ${(82+Math.sin(a)*60).toFixed(1)}"/>`;
    }).join('')}</g><circle cx="60" cy="82" r="9" fill="var(--glow)" opacity=".7"/>`},
  dots:{nm:'Dots', art:`<g fill="var(--glow)" opacity=".55">${
    Array.from({length:7},(_,r)=>Array.from({length:5},(_,c)=>
      `<circle cx="${24+c*18}" cy="${28+r*18}" r="3"/>`).join('')).join('')}</g>`},
  chevron:{nm:'Chevron', art:`<g stroke="var(--glow)" stroke-width="2" fill="none" opacity=".5">${
    Array.from({length:8},(_,i)=>`<path d="M18 ${30+i*15} L60 ${20+i*15} L102 ${30+i*15}"/>`).join('')}</g>`},
  plain:{nm:'Plain', art:`<rect x="24" y="26" width="72" height="112" rx="4" fill="none"
    stroke="var(--glow)" stroke-width="1.4" opacity=".6"/>`}
};
const CLOCKS = { wall:'Wall clock', alarm:'Alarm clock', cuckoo:'Cuckoo clock' };

/* How far through it is, 0..1, read from a stamp rather than counted down —
   so a candle left burning while the app was shut has burned. */
function through(at, mins){
  if(!at) return 0;
  const done = (Date.now() - at) / (Math.max(1, mins) * 60000);
  return Math.max(0, Math.min(1, done));
}
/* What a deck holds, and which of it is on top. `childrenOf` would run a
   magic drawer's rule, which a deck has not got — and going through it would
   couple this module to the whole containment reader for a list of siblings.
   `parent` is the question and `parent` is the answer. */
const deckCards = o => (o ? S.objects.filter(x => x.parent === o.id) : []);
function deckTop(o){
  const kids = deckCards(o);
  if(!kids.length) return null;
  return kids.find(x => x.id === o.top) || kids[0];
}
/* **How long a candle burns for is how long a candle is.** The wax used to be
   a fraction of a fixed 84 units whatever the timer said, so a fifteen-minute
   candle and a four-hour one were the same taper and the only thing the setting
   changed was how fast it went down — which is the one thing you cannot see.
   The length is the setting now and the wax left is a fraction of *that*.

   The curve is gentle rather than linear (the default's own length to the power
   of a bit over a half) because a day-long candle at true proportion is
   seventeen times a fifteen-minute one and there is no tile that fits both. The
   viewBox follows it — `vb` may be a function — so the candle is drawn at
   whatever height it turns out to be rather than being letterboxed into a box
   sized for the longest one. */
const candleFull = o => Math.max(10, Math.min(150,
  Math.round(84 * Math.pow(burnOf(o)/120, 0.55))));
const burning = o => actOf(o) === 'candle' && !!o.litAt && through(o.litAt, burnOf(o)) < 1;
const waxLeft = o => o.litAt ? 1 - through(o.litAt, burnOf(o)) : 1;
const sandGone = o => o.flipAt ? through(o.flipAt, minsOf(o)) : 1;

/* ---- the drawings --------------------------------------------------------
   Inline SVG so each reads the aesthetic — `currentColor` is the object's own
   colour, plus `--brass` and `--glow`, exactly as `decor.js` does it. Each
   states a tight viewBox and is drawn `xMidYMid meet`, because an instrument
   sits in the middle of its box rather than standing on the floor of it the
   way an ornament does. */

/* A clock's three hands, started in the past by however far through the day
   it already is. One `animation-delay` each and no timer anywhere. */
function hands(){
  const d = new Date();
  const s = d.getSeconds() + d.getMilliseconds()/1000;
  const m = d.getMinutes()*60 + s;
  const h = (d.getHours() % 12)*3600 + m;
  return `
    <g class="clkhands">
      <line class="clkh" x1="50" y1="50" x2="50" y2="27" style="animation-delay:${-h}s"/>
      <line class="clkm" x1="50" y1="50" x2="50" y2="18" style="animation-delay:${-m}s"/>
      <line class="clks" x1="50" y1="56" x2="50" y2="16" style="animation-delay:${-s}s"/>
      <circle class="clkpin" cx="50" cy="50" r="2.6"/>
    </g>`;
}
// the twelve marks, four long
const dial = () => Array.from({length:12}, (_,i)=>{
  const a = i*30 * Math.PI/180, long = i % 3 === 0;
  const r1 = long ? 36 : 39, r2 = 42;
  return `<line x1="${(50+Math.sin(a)*r1).toFixed(1)}" y1="${(50-Math.cos(a)*r1).toFixed(1)}"
    x2="${(50+Math.sin(a)*r2).toFixed(1)}" y2="${(50-Math.cos(a)*r2).toFixed(1)}"
    stroke-width="${long?2.2:1.1}"/>`;
}).join('');

/* ---- what a zoom is made of --------------------------------------------
   Three controls and no more, because an instrument has two or three settings
   and a form would be a bigger thing than the instrument. A **ring** for a
   choice out of a stated few, a **stepper** for a number with a unit, and the
   browser's own time field for the one setting that is a time of day. Each
   writes through a `data-a*` attribute that wire.js dispatches, which is the
   same delegated-listener shape everything else on the desk uses. */
const azRing = (id, key, opts, cur) => `<div class="azrow">${opts.map(([v,n])=>
  `<button class="azchip${String(v)===String(cur)?' on':''}" data-aset="${id}:${key}:${esc(String(v))}"
    >${esc(n)}</button>`).join('')}</div>`;
const azStep = (id, key, val, unit, step) => `<div class="azrow azstep">
  <button class="azbtn" data-astep="${id}:${key}:${-step}" aria-label="Less">&minus;</button>
  <span class="aznum">${val}<i>${esc(unit)}</i></span>
  <button class="azbtn" data-astep="${id}:${key}:${step}" aria-label="More">+</button></div>`;
const azSay = t => `<p class="azsay">${esc(t)}</p>`;

const ACTIVE = {
  /* ---- the metronome ---------------------------------------------------
     A wedge with a scale up it and a bar that swings. The swing is a CSS
     animation whose duration is the beat, so the pendulum keeps time with the
     clicks without either being told about the other. */
  metro: {
    nm:'Metronome', vb:'0 0 100 132', kind:'metronome',
    art(o){
      const beat = 60 / bpmOf(o);
      const y = 104 - (bpmOf(o) - 30) / 210 * 66;     // the weight rides the scale
      return `<g class="mtBody">
        <path d="M50 4 88 124H12Z" fill="currentColor"/>
    <path d="M6 124h88v6H6Z" fill="var(--brass)"/>
    <g stroke="var(--glow)" stroke-width="1.2" opacity=".55">
          ${Array.from({length:9},(_,i)=>`<path d="M40 ${38+i*8}h20"/>`).join('')}
        </g>
        <g class="mtArm" style="--beat:${beat}s">
          <line x1="50" y1="112" x2="50" y2="14" stroke="var(--brass)" stroke-width="3"
            stroke-linecap="round"/>
          <rect class="mtWt" x="40" y="${y.toFixed(1)}" width="20" height="11" rx="2"
            fill="var(--brass)"/>
    </g>
        <circle cx="50" cy="112" r="4" fill="var(--brass)"/>
      </g>`;
    },
    tap(o){
      if(RUNNING.has(o.id)) return stopMetro(o.id);
      startMetro(o.id);
      return true;
    },
    say: o => `${bpmOf(o)} bpm`,
    /* The bar itself is the control — drag the weight up and it speeds up, the
       way the real one works — and the stepper underneath is for the times you
       want 120 exactly rather than about 120. Both write `bpm`, so neither can
       disagree with the other about what the metronome is set to. */
    zoom: o => azSay('Drag the weight up the arm, or step it')
      + azStep(o.id, 'bpm', bpmOf(o), 'bpm', 2)
      + azRing(o.id, 'bpm', [[60,'Largo'],[88,'Andante'],[120,'Moderato'],[168,'Presto']], bpmOf(o))
  },

  /* ---- the hourglass ---------------------------------------------------
     The sand is two `scaleY`s and a falling stream, all three one animation
     started in the past by however much has already run. Nothing counts. */
  glass: {
    nm:'Hourglass', vb:'0 0 100 130', kind:'hourglass',
    art(o){
      const mins = minsOf(o), gone = sandGone(o);
      const dur = mins*60, delay = -gone*dur;
      const run = o.flipAt && gone < 1;
      const sty = run ? `animation-duration:${dur}s;animation-delay:${delay}s`
                      : `animation:none`;
      // with nothing running the glass shows where it was left
      const top = run ? '' : `transform:scaleY(${(1-gone).toFixed(3)})`;
      const bot = run ? '' : `transform:scaleY(${gone.toFixed(3)})`;
      return `<g class="hgBody">
        <path d="M14 6h72v10H14Zm0 108h72v10H14Z" fill="var(--brass)"/>
    
    <path d="M20 16h60c0 24-22 40-22 49s22 25 22 49H20c0-24 22-40 22-49S20 40 20 16Z"
          fill="none" stroke="currentColor" stroke-width="2" opacity=".5"/>
        <clipPath id="hgT"><path d="M22 18h56c0 22-21 38-21 46H43c0-8-21-24-21-46Z"/></clipPath>
        <clipPath id="hgB"><path d="M43 66h14c0 8 21 24 21 46H22c0-22 21-38 21-46Z"/></clipPath>
        <g clip-path="url(#hgT)"><rect class="hgTop" x="20" y="16" width="60" height="50"
          fill="var(--glow)" style="${sty};${top}"/></g>
        <g clip-path="url(#hgB)"><rect class="hgBot" x="20" y="64" width="60" height="50"
          fill="var(--glow)" style="${sty};${bot}"/></g>
        ${run?`<rect class="hgRun" x="49" y="64" width="2" height="44" fill="var(--glow)"/>`:''}
    </g>`;
    },
    tap(o){ o.flipAt = Date.now(); return true; },
    say: o => o.flipAt && sandGone(o) < 1
      ? `${Math.max(1, Math.ceil(minsOf(o)*(1-sandGone(o))))} min left`
      : `${minsOf(o)} min`,
    zoom: o => azSay('How much sand is in it')
      + azStep(o.id, 'mins', minsOf(o), 'min', 1)
      + azRing(o.id, 'mins', [[1,'1'],[3,'3'],[5,'5'],[10,'10'],[25,'25'],[60,'60']], minsOf(o))
  },

  /* ---- the candle ------------------------------------------------------
     A timestamp and a length, and the wax is arithmetic. It goes out on its
     own because the shared minute tick asks whether it has, not because
     anything counted it down. */
  candle: {
    nm:'Candle', vb: o => { const t = 108 - candleFull(o) - 24;
                            return `0 ${t.toFixed(1)} 60 ${(140-t).toFixed(1)}`; },
    kind:'candle',
    art(o){
      const lit = burning(o), left = Math.max(0, Math.min(1, waxLeft(o)));
      const full = candleFull(o), h = Math.max(3, full*left), y = 108 - h;
      const wax = o.waxc || 'currentColor';
      return `<g class="cdBody">
        ${lit?`<g class="cdFlame" style="transform-origin:30px ${(y-6).toFixed(1)}px">
          <path d="M30 ${(y-20).toFixed(1)}c4.5 6 6.5 10 6.5 13.5A6.5 6.5 0 0 1 30 ${(y-1).toFixed(1)}
            a6.5 6.5 0 0 1-6.5-6.5C23.5 ${(y-10).toFixed(1)} 25.5 ${(y-14).toFixed(1)} 30 ${(y-20).toFixed(1)}Z"
            fill="var(--glow)"/>
    </g>`:''}
    <rect x="18" y="${y.toFixed(1)}" width="24" height="${h.toFixed(1)}" rx="1.5" fill="${wax}"/>
    
    <path d="M12 108h36c1.6 5-1 9-6 10H18c-5-1-7.6-5-6-10Z" fill="var(--brass)"/>
        <path d="M27 118h6v10h-6Z" fill="var(--brass)"/>
        <path d="M8 128h44c2 4 3 7 3 10H5c0-3 1-6 3-10Z" fill="var(--brass)"/>
    </g>`;
    },
    tap(o){
      if(burning(o)){ o.litAt = null; return false; }
      o.litAt = Date.now(); return true;
    },
    say: o => burning(o)
      ? `${Math.max(1, Math.ceil(burnOf(o)*waxLeft(o)))} min of wax`
      : (o.litAt ? 'Burned out' : `${burnOf(o)} min when lit`),
    zoom: o => azSay('How long it burns for, and what the wax is')
      + azStep(o.id, 'burn', burnOf(o), 'min', 15)
      + azRing(o.id, 'waxc', [['','Its own colour'],['#F2E6C8','Ivory'],['#C9483F','Red'],
          ['#3F6B57','Green'],['#2E3A55','Midnight'],['#E8A33D','Beeswax']], o.waxc || '')
  },

  /* ---- the desk bell ---------------------------------------------------
     The one instrument with no state at all. It rings, and that is the whole
     of it — there is nothing to store, so nothing is stored. */
  bell: {
    nm:'Desk bell', vb:'8 0 104 92', kind:'bell',
    art(){
      return `<g class="blBody">
        <path d="M60 10a34 34 0 0 1 34 34v22H26V44a34 34 0 0 1 34-34Z" fill="var(--brass)"/>
    
    <rect x="55" y="2" width="10" height="10" rx="3" fill="var(--brass)"/>
    <rect x="18" y="66" width="84" height="9" rx="3" fill="var(--brass)"/>
    <rect x="10" y="75" width="100" height="11" rx="4" fill="currentColor"/>
    
    </g>`;
    },
    tap(){ ding(); return 'ring'; },
    say: () => 'Press it',
    zoom: () => azSay('It rings. That is the whole of it.')
  },

  /* ---- the clock -------------------------------------------------------
     Three shapes of one movement. The hands are the same three animations in
     all of them; what changes is the case round them. */
  clock: {
    nm:'Clock', kind:'clock',
    /* Tight to each case: a disc, a disc with feet and a bell, a long case. */
    vb: o => ({wall:'2 10 96 96', alarm:'0 0 100 118', cuckoo:'0 0 100 118'})[clockOf(o)],
    art(o){
      const f = clockOf(o);
      const case_ = f === 'alarm'
        ? `<circle cx="26" cy="15" r="11" fill="var(--brass)"/>
           <circle cx="74" cy="15" r="11" fill="var(--brass)"/>
    <rect x="44" y="4" width="12" height="9" rx="3" fill="var(--brass)"/>
           <circle cx="50" cy="58" r="44" fill="currentColor"/>
           <circle cx="50" cy="58" r="44" fill="none" stroke="var(--brass)" stroke-width="5"/>
           <path d="M22 100l-8 14h20Zm56 0 8 14H66Z" fill="var(--brass)"/>`
        : f === 'cuckoo'
        ? `<path d="M50 2 96 34H4Z" fill="var(--brass)"/>
    <rect x="12" y="32" width="76" height="66" rx="4" fill="currentColor"/>
    <rect x="40" y="36" width="20" height="14" rx="2" fill="var(--brass)"/>
           <circle cx="50" cy="66" r="26" fill="var(--paper-2, #fff)" opacity=".92"/>
           <path d="M44 98h12v14H44Z" fill="var(--brass)"/>
           <circle class="ckPend" cx="50" cy="112" r="6" fill="var(--brass)"/>`
        : `<circle cx="50" cy="58" r="46" fill="var(--brass)"/>
           <circle cx="50" cy="58" r="40" fill="currentColor"/>
    `;
      // the cuckoo's dial is small and sits high; the other two fill the case
      const s = f === 'cuckoo' ? 0.56 : 1, cy = f === 'cuckoo' ? 66 : 58;
      return `<g class="clkBody">${case_}
        <g transform="translate(50 ${cy}) scale(${s}) translate(-50 -50)"
           class="clkFace" stroke="var(--glow)" stroke-linecap="round">
          ${dial()}${hands()}
        </g></g>`;
    },
    tap(){ return null; },        // a clock is looked at, not pressed
    say(o){ return o.alarm ? `Alarm ${o.alarm}` : CLOCKS[clockOf(o)]; },
    /* One alarm, like a real clock has one. A time of day and nothing else —
       no repeat, no days of the week, no snooze — because a clock that needed
       a schedule would be a task with a face painted on it, and this desk
       already has tasks. */
    zoom: o => azSay('Which clock it is')
      + azRing(o.id, 'clock', Object.entries(CLOCKS), clockOf(o))
      + azSay('One alarm, the way a real one has one')
      + `<div class="azrow"><input class="aztime" type="time" data-atime="${o.id}"
          value="${esc(o.alarm || '')}">${o.alarm
          ? `<button class="azchip" data-aset="${o.id}:alarm:">Clear</button>` : ''}</div>`
  },

  /* ---- the deck — decision 183 -----------------------------------------
     The one instrument that is a **container**. Everything else here knows a
     setting; a deck knows what is in it, and what is in it is ordinary
     objects — so "drag a card onto a deck" is the filing that already works
     and "take the top one off" is a reparent, neither of which needed a line
     of new machinery.

     What the deck itself stores is three things and they are all about the
     *top*: which child is showing (`top`), whether it is face up (`faceup`),
     and what the back looks like (`back`). Tapping cuts the deck — a new top,
     picked at random — which is what a deck of prompts is for and why the top
     is stored rather than derived from the order. */
  deck: {
    nm:'Deck', vb:'0 0 120 160', kind:'deck', holds:true,
    art(o){
      const kids = deckCards(o), n = kids.length;
      const top = deckTop(o), up = o.faceup !== false;
      const back = BACKS[o.back] ? o.back : 'lattice';
      /* Two cards peeking out from under the top one, so a deck reads as a
         stack rather than as one card. Offset and turned a little, by a hash
         of the deck's own id so the fan is the same on every render. */
      const under = Math.min(2, Math.max(0, n - 1));
      const pile = Array.from({length:under}, (_,i)=>
        `<rect x="${10 + (i+1)*2.5}" y="${12 - (i+1)*2.5}" width="100" height="140" rx="9"
          fill="var(--paper-2)" stroke="rgba(0,0,0,.22)" stroke-width="1.5"
          transform="rotate(${(i%2?1:-1)*(1.6+i)} 60 82)"/>`).join('');
      const faceArt = (!n)
        ? `<text x="60" y="86" text-anchor="middle" font-size="12" opacity=".55"
             fill="var(--ink, #2A2118)">Empty</text>`
        : up
        ? `<foreignObject x="16" y="18" width="88" height="128">
             <div xmlns="http://www.w3.org/1999/xhtml" class="dkword">${
               esc(String((top && top.title) || '').slice(0, 90))}</div>
           </foreignObject>`
        : BACKS[back].art;
      return `<g class="dkBody">${pile}
        <rect x="10" y="12" width="100" height="140" rx="9"
          fill="${up ? 'var(--paper-2)' : 'currentColor'}"
          stroke="rgba(0,0,0,.26)" stroke-width="1.5"/>
        ${up ? '' : `<rect x="16" y="18" width="88" height="128" rx="6" fill="none"
          stroke="var(--glow)" stroke-width="1.4" opacity=".7"/>`}
        ${faceArt}
        ${n ? `<text x="60" y="150" text-anchor="middle" font-size="9"
          fill="${up ? 'var(--ink, #2A2118)' : 'var(--glow)'}" opacity=".6">${n}</text>` : ''}
      </g>`;
    },
    /* A press **cuts the deck**: a different card on top, picked at random and
       never the one already showing, because a cut that changes nothing reads
       as a press that did nothing. */
    tap(o){
      const kids = deckCards(o);
      if(kids.length < 2) return null;
      let pick = kids[Math.floor(Math.random()*kids.length)];
      if(pick.id === o.top) pick = kids[(kids.indexOf(pick) + 1) % kids.length];
      o.top = pick.id;
      return 'cut';
    },
    say(o){
      const n = deckCards(o).length;
      return n ? `${n} card${n===1?'':'s'}` : 'Empty — add some';
    },
    zoom: o => azSay('Which way up the top card sits')
      + azRing(o.id, 'faceup', [[1,'Face up'],[0,'Face down']], o.faceup === false ? 0 : 1)
      + azSay('The back')
      + azRing(o.id, 'back', Object.entries(BACKS).map(([k,v])=>[k, v.nm]),
          BACKS[o.back] ? o.back : 'lattice')
      + `<div class="azrow" style="margin-top:14px">
          <button class="azchip azdo" data-adeck="add:${o.id}">Add a card</button>
          <button class="azchip azdo" data-adeck="deal:${o.id}">Deal the top one out</button>
          <button class="azchip azdo" data-adeck="open:${o.id}">Open it</button>
        </div>`
  },

  /* ---- the die ---------------------------------------------------------
     `sides` is the shape and `face` is what it is showing. A d6 gets pips
     because a d6 has pips; everything else gets its number, because a
     twenty-sided die with twenty dots on it is not a thing. */
  die: {
    nm:'Die', kind:'die',
    /* Each solid reaches a different distance into the box, so each states its
       own — a d6 fills a square cell and a d4 is a triangle with a flat foot. */
    vb: o => sidesOf(o)===6 ? '2 2 96 96' : sidesOf(o)===4 ? '4 2 92 90' : '4 2 92 96',
    art(o){
      const n = sidesOf(o), f = Math.min(n, Math.max(1, num(o.face, 1)));
      const body = n === 4
        ? `<path d="M50 6 94 88H6Z" fill="currentColor"/>
    `
        : n === 6
        ? `<rect x="3" y="3" width="94" height="94" rx="15" fill="currentColor"/>
    `
        : n === 8
        ? `<path d="M50 4 92 50 50 96 8 50Z" fill="currentColor"/>
    `
        : n === 10
        ? `<path d="M50 4 92 40 74 92H26L8 40Z" fill="currentColor"/>
    `
        : n === 12
        ? `<path d="M50 4 88 24l8 42-28 32H32L4 66l8-42Z" fill="currentColor"/>
    `
        : `<path d="M50 4 94 30v40L50 96 6 70V30Z" fill="currentColor"/>
    `;
      /* A d6's five pip positions, and which of them each face uses. Written
         out because a formula for this is longer than the list. */
      const P = {1:[[50,50]], 2:[[30,30],[70,70]], 3:[[30,30],[50,50],[70,70]],
        4:[[30,30],[70,30],[30,70],[70,70]],
        5:[[30,30],[70,30],[50,50],[30,70],[70,70]],
        6:[[30,28],[70,28],[30,50],[70,50],[30,72],[70,72]]};
      const mark = (n === 6 && P[f])
        ? P[f].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="7.5" fill="var(--glow)"/>`).join('')
        : `<text x="50" y="${n===4?68:n===10||n===12?58:54}" text-anchor="middle"
             font-size="${n===20?30:34}" font-weight="700" fill="var(--glow)"
             dominant-baseline="middle">${f}</text>`;
      return `<g class="dieBody">${body}${mark}</g>`;
    },
    tap(o){
      const n = sidesOf(o);
      let f = 1 + Math.floor(Math.random()*n);
      if(n > 1 && f === o.face) f = 1 + ((f) % n);   // a roll that changes nothing reads as broken
      o.face = f;
      return 'roll';
    },
    say: o => `d${sidesOf(o)}`,
    zoom: o => azSay('Which die')
      + azRing(o.id, 'sides', DICE.map(n=>[n, 'd'+n]), sidesOf(o))
  }
};

/* Which kind wears which machine. Read the other way round by `actOf()`, so a
   type you invent can carry `act:'die'` and be a die without being listed. */
const ACT_KIND = {};
Object.entries(ACTIVE).forEach(([k, a])=>{ if(a.kind) ACT_KIND[a.kind] = k; });

/* ---- the metronome's timer, outside the DOM ----------------------------- */
function startMetro(id){
  stopMetro(id);
  const o = byId(id); if(!o) return false;
  let beat = 0;
  tick(true);
  RUNNING.set(id, setInterval(()=>{
    beat = (beat + 1) % 4;
    tick(beat === 0);
  }, 60000 / bpmOf(o)));
  o.going = true;
  return true;
}
function stopMetro(id){
  const h = RUNNING.get(id);
  if(h){ clearInterval(h); RUNNING.delete(id); }
  const o = byId(id); if(o) o.going = false;
  return false;
}
const metroGoing = id => RUNNING.has(id);
/* Every metronome, stopped. Called when the desk is put away or the object is
   deleted — an interval whose object has gone is the leak this prevents. */
function stopAllMetros(){ [...RUNNING.keys()].forEach(stopMetro); }

/* ---- the tap ------------------------------------------------------------
   One entry point. Returns what happened so the caller can say it: `true` is
   "it started", `false` is "it stopped", a string is a one-off, and null is
   "this one is not pressed". The mutation is here and the render is not —
   an animation never holds a state change up, so the caller renders. */
function activeTap(id){
  const o = byId(id); if(!o) return null;
  const a = ACTIVE[actOf(o)]; if(!a || !a.tap) return null;
  const out = a.tap(o);
  save();
  mindTheTime();
  return out;
}

/* The artwork, as markup, at whatever size it is being drawn. `xMidYMid`
   because an instrument sits in the middle of its box — an ornament stands on
   the floor of one, which is `decor.js`'s answer and deliberately not this. */
/* **A viewBox may be a function of the object**, because a clock's case is not
   one shape: a wall clock is a disc and fills a square, an alarm clock has
   feet and a bell on top, and a cuckoo hangs a pendulum below itself. One
   viewBox big enough for all three letterboxes the wall clock inside a square
   tile and leaves a band of nothing top and bottom — which is what "it doesn't
   fill the space" was. Each states its own, tight to what it actually draws,
   and the kind's default box is that proportion, so an instrument put down at
   its own size fills its cell exactly. See decision 185. */
const vbOf = o => { const a = ACTIVE[actOf(o)];
  if(!a) return '0 0 100 100';
  return typeof a.vb === 'function' ? a.vb(o) : a.vb; };

function activeArt(o, cls){
  const a = ACTIVE[actOf(o)]; if(!a) return '';
  return `<svg class="actart ${cls||''}" viewBox="${vbOf(o)}"
    preserveAspectRatio="xMidYMid meet" aria-hidden="true">${a.art(o)}</svg>`;
}
/* Where a burning candle's flame is, in cells, inside a box of `w x h` — the
   same contract `flamePoint()` has in decor.js so one light layer serves both,
   and deliberately not the same arithmetic: an instrument is drawn
   `xMidYMid meet` and an ornament `xMidYMax meet`, so one is centred in its
   box and the other stands on the floor of it. Getting that wrong puts the
   light a cell below the wick and nothing says so. */
function activeFlame(o, w, h){
  if(!burning(o)) return null;
  const a = ACTIVE[actOf(o)]; if(!a) return null;
  const [vx, vy, vw, vh] = vbOf(o).split(/[\s,]+/).map(Number);
  const k = Math.min(w/vw, h/vh);
  const ox = (w - vw*k)/2, oy = (h - vh*k)/2;
  const wax = Math.max(6, 84*Math.max(0, Math.min(1, waxLeft(o))));
  const top = 24 + (84 - wax);              // the top of the wax, in viewBox units
  return { x: ox + (30 - vx)*k, y: oy + (top - 10 - vy)*k, r: 2.2 };
}
const activeSay = o => { const a = ACTIVE[actOf(o)]; return a && a.say ? a.say(o) : ''; };
const activeZoom = o => { const a = ACTIVE[actOf(o)]; return a && a.zoom ? a.zoom(o) : ''; };
const activeName = o => { const a = ACTIVE[actOf(o)]; return a ? a.nm : ''; };

/* An alarm is a time of day and a clock has one, the way a real one does.
   Checked on the shared minute tick against the minute it is now, and marked
   `rang` for that minute so a twenty-second tick cannot ring it three times. */
function checkAlarms(){
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  let rang = null;
  S.objects.forEach(o=>{
    if(actOf(o) !== 'clock' || !o.alarm) return;
    if(o.alarm !== hhmm){ if(o.rang) delete o.rang; return; }
    if(o.rang === hhmm) return;
    o.rang = hhmm; rang = o;
    ding(); setTimeout(ding, 700); setTimeout(ding, 1400);
  });
  return rang;
}
/* Any candle that has guttered out since the last look. The caller renders —
   what changed is what the tile draws, not anything stored. */
const guttered = () => S.objects.some(o =>
  actOf(o) === 'candle' && o.litAt && through(o.litAt, burnOf(o)) >= 1);

export { ACTIVE, ACT_KIND, DICE, CLOCKS, BACKS, deckCards, deckTop,
  actOf, isActive, activeArt, activeTap, activeSay, activeName, activeZoom,
  bpmOf, minsOf, burnOf, sidesOf, clockOf, burning, waxLeft, sandGone,
  activeFlame, metroGoing, startMetro, stopMetro, stopAllMetros,
  mindTheTime, setMinuteHandler, checkAlarms, guttered, ding };
