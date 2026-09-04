/* ============================================================
   0 · tiny helpers
   ============================================================ */
const $  = (s,r)=> (r||document).querySelector(s);
const $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));
const esc = s => String(s==null?"":s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Ids must be unique across sessions, not just within one. The old counter
   restarted at 0 on every load, so the Nth object made today collided with the
   Nth object made yesterday — and byId() returns the first match, so dragging
   the newer tile moved the older object, drew the older object's outline, and
   left the new one immovable. Time + counter + noise. */
const uid = (()=>{let n=0;return p=>
  `${p||'o'}${Date.now().toString(36)}${(++n).toString(36)}${Math.floor(Math.random()*1679616).toString(36)}`})();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ROOT = 'root';   // the desk: the container every other object descends from
/* The holding space: the drawer along the bottom of a phone, which is the one
   container that is furniture rather than somewhere on a board. An object
   parented here is *out of the desk* — off every grid, invisible to every
   magic drawer — and waiting to be put down somewhere else. It is a reserved
   id rather than a real object, exactly as ROOT is, so nothing has to be
   seeded, migrated, exported or tidied up after. See decision 107. */
const HOLD = '__hold';

const D = {
  today(){ const d=new Date(); d.setHours(0,0,0,0); return d; },
  iso(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
  parse(s){ if(!s) return null; const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); },
  add(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; },
  addISO(s,n){ return D.iso(D.add(D.parse(s),n)); },
  human(s){
    if(!s) return "";
    const t=D.today(), d=D.parse(s), diff=Math.round((d-t)/86400000);
    if(diff===0) return "Today"; if(diff===1) return "Tomorrow"; if(diff===-1) return "Yesterday";
    if(diff<0) return `${-diff}d overdue`;
    if(diff<7) return d.toLocaleDateString(undefined,{weekday:'long'});
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  },
  short(s){ const d=D.parse(s); return d? d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) : ""; },
  /* For dropping a date into the middle of a sentence — "scheduled today" wants
     lowercasing, "Scheduled Sep 4" does not, and the difference is whether the
     phrase is a word or a date. */
  said(s){ const h=D.human(s); return /\d/.test(h) ? h : h.toLowerCase(); },
  overdue(s){ return s && D.parse(s) < D.today(); }
};

/* ============================================================
   1 · icons
   ============================================================ */
const P = {
  check:'M20 6 9 17l-5-5', plus:'M12 5v14M5 12h14', x:'M18 6 6 18M6 6l12 12',
  trash:'M3 6h18M8 6V4h8v2M19 6l-1.2 14H6.2L5 6M10 10v6M14 10v6',
  tag:'M20.6 13.4 12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8M7 7h.01',
  search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20.5 20.5 16.6 16.6',
  calendar:'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
  repeat:'M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  target:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 11.3a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4',
  flag:'M4 21V4h10l-1 3h7v9h-8l-1-3H4',
  image:'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M8.5 9.5a1 1 0 1 0 .01 0',
  film:'M3 4h18v16H3zM7 4v16M17 4v16M3 12h18',
  music:'M9 18V5l11-2v13M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M17 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  note:'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h4',
  bulb:'M9.4 18h5.2M10.5 21h3M12 3a6 6 0 0 1 3.5 10.9c-.6.5-.9 1.2-.9 1.9M8.5 15.8c0-.7-.3-1.4-.9-1.9A6 6 0 0 1 12 3',
  list:'M8 6h13M8 12h13M8 18h13M3.6 6h.01M3.6 12h.01M3.6 18h.01',
  pot:'M4 9h16v3a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7zM2 11h2M20 11h2M8.5 6c0-1.5 1-1.5 1-3M12 6c0-1.5 1-1.5 1-3M15.5 6c0-1.5 1-1.5 1-3',
  clapper:'M3 8h18v12H3zM3 8l2.5-4h13L21 8M8.5 4 6.5 8M13.5 4l-2 4M18.5 4l-2 4',
  help:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9.5 9.4a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.1-2.5 3.6M12 17.6h.01',
  feather:'M20.2 4a5.5 5.5 0 0 0-7.8 0L4 12.4V20h7.6l8.6-8.5a5.5 5.5 0 0 0 0-7.5M16 8 4.5 19.5M15 12H9',
  grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  inbox:'M3 13h5l2 3h4l2-3h5M3 13 6 4h12l3 9v7H3z',
  chevL:'M15 5l-7 7 7 7', chevR:'M9 5l7 7-7 7',
  more:'M12 6h.01M12 12h.01M12 18h.01',
  grip:'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  archive:'M3 4h18v4H3zM5 8v12h14V8M9.5 12h5',
  star:'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l3.5 2',
  trophy:'M7 4h10v5a5 5 0 0 1-10 0zM7 6.5H4v1a3 3 0 0 0 3 3M17 6.5h3v1a3 3 0 0 1-3 3M9 20h6M12 14.2V20',
  book:'M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z',
  sliders:'M4 8h10M18 8h2M4 16h4M12 16h8M14 5.5v5M8 13.5v5',
  folder:'M3 6h6l2 3h10v11H3z',
  sparkle:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
  edit:'M4 20h4L20 8l-4-4L4 16z',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  arrow:'M7 17 17 7M9 7h8v8',
  chev:'M15 6l-6 6 6 6',
  undo:'M3 9a9 9 0 1 1 1.2 6.6M3 4v5h5',
  sun:'M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  resize:'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  // two arrows running opposite ways: which way round a thing answers your eye
  swap:'M4 9h15M15 5l4 4-4 4M20 15H5M9 11l-4 4 4 4',
  // a plant in a pot: the leaves, the stem, the rim and the taper
  plant:'M9 21h6l1-6H8zM7 15h10M12 15V9M12 10C12 6 9.5 4 6 4c0 3.5 2.5 6 6 6M12 9c0-3 2-5 5-5 0 3-2 5-5 5',
  // two sheets, one behind the other — the universal copy mark
  copy:'M9 9h11v11H9zM5 15H4V4h11v1',
  // a thumbtack, head on: the bar, the tapered body, the needle
  pin:'M12 16v6M8.5 3.5h7l-1.2 6.2 2.7 2.8v1.5H7v-1.5l2.7-2.8z',
  gear:'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  sort:'M4 6h13M4 12h9M4 18h5M17 14l3 3 3-3M20 17V7',
  /* The object editor's mark. A round brush held at an angle: ferrule, handle,
     and the loaded tip that says it changes how a thing looks rather than what
     it does — which is the difference between it and the gear. */
  brush:'M15.5 3.5a2.1 2.1 0 0 1 3 3L11 14l-3.5.5L8 11zM6.5 14.5c-1.7 0-3 1.3-3 3 0 .9-.3 1.7-1 2.3 1 .5 2 .7 3 .7 2.2 0 4-1.8 4-4 0-1.1-1.3-2-3-2',
  lock:'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  // the shackle swung open and clear of the body, so the two read apart at 16px
  unlock:'M6 11h12v9H6zM9 11V8a3 3 0 0 1 5.6-1.6',
  arrowU:'M12 19V5M6 11l6-6 6 6',
  arrowD:'M12 5v14M6 13l6 6 6-6',
  arrowL:'M19 12H5M11 6l-6 6 6 6',
  arrowR:'M5 12h14M13 6l6 6-6 6',
  book:'M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-7a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h7z'
};
function ic(n,s){ s=s||16; return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n]||P.note}"/></svg>`; }

/* ============================================================
   5 · markdown (small, sufficient)
   ============================================================ */
function md(src){
  if(!src||!src.trim()) return '<p style="color:var(--ink-3)">Nothing written yet.</p>';
  const inline = t => esc(t)
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/(^|\W)\*([^*\n]+)\*/g,'$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
  const out=[]; let list=null;
  const close=()=>{ if(list){out.push(`</${list}>`); list=null;} };
  src.split(/\r?\n/).forEach(raw=>{
    const l=raw.trim();
    if(!l){ close(); return; }
    let m;
    if(/^---+$/.test(l)){ close(); out.push('<hr>'); return; }
    if((m=l.match(/^(#{1,4})\s+(.*)$/))){ close(); const n=Math.min(m[1].length+1,4); out.push(`<h${n}>${inline(m[2])}</h${n}>`); return; }
    if((m=l.match(/^>\s?(.*)$/))){ close(); out.push(`<blockquote>${inline(m[1])}</blockquote>`); return; }
    if((m=l.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/))){
      if(list!=='ul'){close(); out.push('<ul>'); list='ul';}
      const on=m[1].toLowerCase()==='x';
      out.push(`<li class="tick${on?' on':''}"><b></b>${inline(m[2])}</li>`); return;
    }
    if((m=l.match(/^[-*]\s+(.*)$/))){ if(list!=='ul'){close(); out.push('<ul>'); list='ul';} out.push(`<li>${inline(m[1])}</li>`); return; }
    if((m=l.match(/^\d+[.)]\s+(.*)$/))){ if(list!=='ol'){close(); out.push('<ol>'); list='ol';} out.push(`<li>${inline(m[1])}</li>`); return; }
    close(); out.push(`<p>${inline(l)}</p>`);
  });
  close();
  return out.join('');
}
/* ---- markdown as *words* ----------------------------------------------
   `md()` makes a page; a tile is a face. What a face wants is the writing with
   the marks taken off — no asterisks, no hashes, no bullet, and a link showing
   its words rather than its URL. Not `md()` cut short: headings and lists have
   no business inside a tile, and a `<ul>` in a 40px band is a bullet and half
   a word.

   Line structure survives, because a note printed on a tile is still a note
   with paragraphs in it — but a run of blank lines is one break, not four.
   `.tiletext` carries `white-space:pre-line` to honour that.

   `strip()` was the old answer and it was doing damage: it replaced every `-`
   with a space, so "twenty-one" printed as "twenty one" and a date came out in
   pieces. Nothing uses it now. */
function plain(src){
  if(!src) return '';
  const inline = t => String(t)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1')        // an image is its alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g,'$1')         // a link is its words
    .replace(/`([^`]+)`/g,'$1')
    .replace(/\*\*([^*]+)\*\*/g,'$1')
    .replace(/(^|\W)\*([^*\n]+)\*/g,'$1$2')
    // `_` only between non-word characters, or snake_case_names lose their spine
    .replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g,'$1$2');
  const out=[];
  String(src).split(/\r?\n/).forEach(raw=>{
    let l=raw.trim();
    if(!l){ if(out.length && out[out.length-1]!=='') out.push(''); return; }
    if(/^([-*_]\s*){3,}$/.test(l)) return;           // a rule is a mark, not words
    l = l.replace(/^#{1,6}\s+/,'')
         .replace(/^>\s?/,'')
         .replace(/^[-*+]\s+\[[ xX]\]\s+/,'')        // a task box
         .replace(/^[-*+]\s+/,'')                    // a bullet
         .replace(/^\d+[.)]\s+/,'');                 // a number
    l = inline(l).trim();
    if(l) out.push(l);
  });
  while(out.length && out[out.length-1]==='') out.pop();
  return out.join('\n');
}
/* The same thing on one line, for a band that has room for a sentence. */
const oneline = s => plain(s).replace(/\s+/g,' ').trim();

export { $, $$, esc, uid, clamp, ROOT, HOLD, D, ic, md, plain, oneline };
