/* ============================================================
   22 · decorations — the things standing on the shelf
   ============================================================
   A decoration is not information. It is the aspidistra on the bookcase, the
   brass bookend, the little porcelain figure nobody remembers buying — it
   holds nothing, says nothing, and is there because the desk looks better with
   it. That is the whole type, and it is why it is the one thing on the board
   allowed to *overlap*: a plant standing in front of a row of books is what a
   shelf looks like, and a grid that refuses it is a spreadsheet. Decision 86.

   These ship with the app as **inline SVG**, not files, for three reasons:
   they cost nothing to cache because they are already in the shell, they stay
   crisp at any size a tile can be, and — the real one — being in the DOM lets
   them read the style's own custom properties. A decoration is drawn in
   `currentColor` (the object's own colour), `--brass` and `--glow`, so the
   same jardinière is terracotta and leaf on Victoria and pine and green
   shimmer on Starry, exactly like everything else that draws. Never hardcode
   a hue in here that isn't a genuine highlight or a shadow.

   ---- two rules about the box, and both are the difference between an
   ornament and a sticker ------------------------------------------------

   **Each one states its own viewBox, tight to its own artwork**, and its own
   `size` — the tile shape it wants. They used to share a 100×100 square, so a
   narrow candlestick was drawn down the middle of it with a third of the box
   empty either side; a tight viewBox fixes the artwork, and the size fixes the
   *tile*, which is where the rest of that empty space was coming from. A
   candlestick is tall and narrow, a bookend is wide and low, and both numbers
   say so. Picking one re-proportions the tile, because choosing a different
   ornament is choosing a different shape.

   **The artwork touches the bottom edge.** No ground-shadow ellipse below the
   object, no rounding-up of the numbers: the base of the thing is at the
   bottom of the box, so with `xMidYMax` it stands on the floor of its tile and
   a row of them lines up along one shelf. Where a piece wants a contact
   shadow it gets a dark band on its own underside, which is part of the
   object rather than space beneath it.

   Victorian rather than cartoon: turned profiles, finials, fluting and
   beading; brass and gilt as thin highlights rather than slabs; tone built out
   of layered opacity rather than outlines.                                  */

const DECOR = {

  /* ---- plants ---------------------------------------------------------- */
  plant: { c:6, nm:'Potted plant', aes:['victorian','carca','girando','aero'], png:'img/decor/plant.png', vb:'0 0 360 273', size:[4,3] },
  jardiniere: { c:13, nm:'Jardinière', aes:['victorian','girando','stelaine'], png:'img/decor/jardiniere.png', vb:'0 0 264 360', size:[3,4] },

  fern: { c:7, nm:'Fern', aes:['victorian','carca','girando'], vb:'5 1.5 82 98.5', size:[4,5], svg:`
    <g stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round">
      <path d="M46 62C42 44 30 28 8 20"/><path d="M46 62c4-18 16-34 38-42"/>
      <path d="M46 58C44 40 36 20 24 6"/><path d="M46 58c2-18 10-38 22-52"/>
      <path d="M46 56c0-16 0-32 0-48"/>
    </g>
    <g fill="currentColor">
      <ellipse cx="14" cy="26" rx="7" ry="3.4" transform="rotate(24 14 26)"/>
      <ellipse cx="24" cy="34" rx="6.4" ry="3.2" transform="rotate(22 24 34)"/>
      <ellipse cx="34" cy="44" rx="5.6" ry="3" transform="rotate(20 34 44)"/>
      <ellipse cx="78" cy="26" rx="7" ry="3.4" transform="rotate(-24 78 26)"/>
      <ellipse cx="68" cy="34" rx="6.4" ry="3.2" transform="rotate(-22 68 34)"/>
      <ellipse cx="58" cy="44" rx="5.6" ry="3" transform="rotate(-20 58 44)"/>
      <ellipse cx="29" cy="13" rx="5.6" ry="3" transform="rotate(48 29 13)"/>
      <ellipse cx="63" cy="13" rx="5.6" ry="3" transform="rotate(-48 63 13)"/>
      <ellipse cx="46" cy="9" rx="4" ry="6"/>
    </g>
    <path d="M26 62h40c3 12 3 24 0 34a5 5 0 0 1-4 4H30a5 5 0 0 1-4-4c-3-10-3-22 0-34Z" fill="var(--brass)"/>
    <path d="M22 58h48v7H22Z" fill="var(--brass)"/>
    
    ` },

  palm: { c:8, nm:'Parlour palm', aes:['victorian','girando','aero'], vb:'2.5 -1.5 79 101.5', size:[3,4], svg:`
    <g stroke="var(--brass)" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".8">
      <path d="M42 64V22"/><path d="M42 46C38 34 30 26 16 22"/><path d="M42 42c4-12 12-20 26-24"/>
    </g>
    <path d="M42 24C34 12 20 6 4 8c6 14 22 20 38 16Z" fill="currentColor"/>
    <path d="M42 24C50 12 64 6 80 8c-6 14-22 20-38 16Z" fill="currentColor" opacity=".84"/>
    <path d="M42 22C38 8 28 0 14 0c0 12 12 22 28 22Z" fill="currentColor" opacity=".7"/>
    <path d="M42 22C46 8 56 0 70 0c0 12-12 22-28 22Z" fill="currentColor" opacity=".62"/>
    <path d="M42 26c-4-8-2-18 2-26 6 8 6 18 0 26Z" fill="currentColor" opacity=".9"/>
    <path d="M24 62h36l-4 34a4 4 0 0 1-4 4H32a4 4 0 0 1-4-4Z" fill="var(--brass)"/>
    <path d="M20 56h44v7H20Z" fill="var(--brass)"/>
    <path d="M22 66h40M25 82h34" stroke="var(--glow)" stroke-width="1.5" opacity=".5"/>
    ` },

  /* ---- clocks ---------------------------------------------------------- */
  clock: { c:5, nm:'Mantel clock', aes:['victorian','golf97'], png:'img/decor/clock.png', vb:'0 0 257 360', size:[3,4] },

  carriage: { c:13, nm:'Carriage clock', aes:['victorian','carca'], png:'img/decor/carriage.png', vb:'0 0 193 360', size:[2,4] },

  dome: { c:11, nm:'Under glass', aes:['victorian','stelaine','starry'], png:'img/decor/dome.png', vb:'0 0 233 360', size:[3,4] },

  /* ---- figures --------------------------------------------------------- */
  bust: { c:15, nm:'Bust', aes:['victorian','carca','girando'], png:'img/decor/bust.png', vb:'0 0 200 360', size:[2,4] },

  figurine: { c:14, nm:'Figurine', aes:['victorian','girando','carca'], png:'img/decor/figurine.png', vb:'0 0 181 360', size:[2,4] },

  /* ---- light and vessels ----------------------------------------------- */
  candle: { c:3, nm:'Candlestick', aes:['victorian','starry','stelaine'], png:'img/decor/candle.png', vb:'0 0 169 360', size:[2,4], emits:{x:84, y:2, reach:2.4} },

  lamp: { c:12, nm:'Oil lamp', aes:['victorian','starry','stelaine'], png:'img/decor/lamp.png', vb:'0 0 123 360', size:[2,5], emits:{x:61, y:80, reach:3.4} },

  vase: { c:9, nm:'Vase', aes:['victorian','girando','aero'], png:'img/decor/vase.png', vb:'0 0 197 360', size:[2,4] },

  /* Carca's half of the story: the war is over and the machines tinker now.
     A gear is the one ornament here whose geometry has to be *right* — teeth
     eyeballed as a dozen little rectangles read as a cartoon sun — so the two
     wheels are generated: twelve teeth on the great one and nine on the pinion,
     each tooth a trapezoid struck between a root circle and a tip circle, and
     the two meshed at the pitch line rather than merely placed near each other.
     See decision 92. */
  cog: { c:12, nm:'Watch movement', aes:['carca','golf97','girando'], png:'img/decor/cog.png', vb:'0 0 335 360', size:[4,4] },
  /* Girando's, and the core motif of it: a volute — but a volute is not a
     spiral on a post, it is the top of a **console bracket**, which is the
     thing actually holding up a Sicilian balcony. So the scroll sits on a
     flared S-profile body with an acanthus down its face and a plinth under
     it. The spiral itself is struck as an archimedean path of two and a half
     turns whose radius tapers as it goes — even turns, tightening to the eye —
     because a hand-drawn coil reads as wire. See decision 92. */
  volute: { c:12, nm:'Wall bracket', aes:['girando','victorian','carca'], png:'img/decor/volute.png', vb:'0 0 301 360', size:[3,4] },
  bookend: { c:11, nm:'Bookend', aes:['victorian','carca','golf97','starry'], png:'img/decor/bookend.png', vb:'0 0 360 331', size:[4,4] }
};

/* ============================================================
   22b · the things a life is made of
   ============================================================
   A **life drawer** is an area of your life rather than a piece of work, and a
   coloured rectangle with "Health" written on it is the least memorable thing
   a desk could put that under. So it wears an **object** instead — a stack of
   coins for money, a dumbbell for exercise, a suitcase for travel — lying on
   the desk the way the real thing would, with the name on a small label under
   it. You recognise the drawer before you have read anything, which is the
   whole point of a desk over a list.

   Drawn rather than photographed, and for the same three reasons the
   decorations are (they are already in the shell, they stay crisp at any tile
   size, and being in the DOM they read the style's own colours) plus a fourth:
   a photograph found on the web carries a licence, and this app ships. A life
   drawer will also take an **uploaded picture** as its face — `media` on the
   object beats the drawing — so a photograph or a drawing of your own goes on
   without a line of code changing.

   Same two rules as the decorations about the box: each states its own
   viewBox, tight to its own artwork, and nothing is drawn outside it. Unlike a
   decoration these are centred rather than stood on the floor — a thing lying
   on a desk has no up. */
const LIFE_ART = {

  money: { nm:'Money', ds:'A stack of coins', c:13, vb:'2 6 96 88', svg:`
    <g>
      <path d="M14 74v-9h64v9a32 9 0 0 1-64 0Z" fill="var(--brass)"/>
      <ellipse cx="46" cy="65" rx="32" ry="9" fill="var(--brass)"/>
    
    </g>
    <g>
      <path d="M17 60v-9h60v9a30 8.4 0 0 1-60 0Z" fill="var(--brass)"/>
      <ellipse cx="47" cy="51" rx="30" ry="8.4" fill="var(--brass)"/>
    
    </g>
    <g>
      <path d="M20 46v-8h56v8a28 8 0 0 1-56 0Z" fill="var(--brass)"/>
      <ellipse cx="48" cy="38" rx="28" ry="8" fill="var(--brass)"/>
    
    </g>
    <g>
      <path d="M24 33v-7h48v7a24 7 0 0 1-48 0Z" fill="var(--brass)"/>
      <ellipse cx="48" cy="26" rx="24" ry="7" fill="var(--brass)"/>
    <ellipse cx="48" cy="26" rx="15" ry="4.2" fill="none" stroke="#000" stroke-width="1.2" opacity=".2"/>
    </g>
    <g transform="rotate(-16 84 62)">
      <ellipse cx="84" cy="62" rx="13" ry="20" fill="var(--brass)"/>
    <ellipse cx="84" cy="62" rx="8" ry="13" fill="none" stroke="#000" stroke-width="1.4" opacity=".22"/>
    </g>` },

  home: { nm:'Home', ds:'The front-door key', c:5, vb:'2 12 96 76', svg:`
    <g transform="rotate(-8 50 50)">
      <path d="M18 46h62v9H18Z" fill="var(--brass)"/>
    
    <path d="M72 55h6v10h-6Z" fill="var(--brass)"/>
    <path d="M62 55h5v7h-5Z" fill="var(--brass)"/>
    <circle cx="20" cy="50.5" r="17" fill="var(--brass)"/>
    
    <circle cx="20" cy="50.5" r="7.5" fill="none" stroke="#000" stroke-width="2.6" opacity=".3"/>
      <circle cx="20" cy="50.5" r="6.6" fill="var(--paper-2, #F1EBDA)" opacity=".55"/>
    </g>
    <g transform="rotate(12 76 34)">
      <path d="M62 22h28a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H62a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4Z" fill="currentColor"/>
    
    <circle cx="66" cy="30" r="2.6" fill="var(--brass)"/>
      <path d="M64 36h24M64 40h16" stroke="var(--glow)" stroke-width="1.6" opacity=".5"/>
    </g>` },

  exercise: { nm:'Exercise', ds:'A dumbbell', c:8, vb:'0 24 100 52', svg:`
    <path d="M28 46h44v10H28Z" fill="var(--brass)"/>
    
    <g>
      <rect x="14" y="34" width="12" height="34" rx="3" fill="currentColor"/>
    
    <rect x="2" y="38" width="12" height="26" rx="3" fill="currentColor"/>
    
    </g>
    <g>
      <rect x="74" y="34" width="12" height="34" rx="3" fill="currentColor"/>
    
    <rect x="86" y="38" width="12" height="26" rx="3" fill="currentColor"/>
    
    </g>
    <path d="M32 48h36" stroke="#000" stroke-width="1.2" opacity=".22"/>` },

  nutrition: { nm:'Nutrition', ds:'An apple', c:2, vb:'6 4 88 92', svg:`
    <path d="M50 26c9-8 24-7 30 3 7 12 3 34-7 51-5 9-11 13-15 9-4-3-9-3-13 0-5 4-11 0-16-9C19 63 15 41 22 29c6-10 21-11 28-3Z" fill="currentColor"/>
    
    <path d="M66 42c5 8 5 22 0 33" stroke="#000" stroke-width="3" opacity=".14" fill="none" stroke-linecap="round"/>
    <path d="M49 27c-1-9 1-17 4-22" stroke="var(--brass)" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M55 18c9-9 22-10 30-6-2 10-12 17-24 15-3 0-5-4-6-9Z" fill="var(--glow)"/>
    <path d="M58 20c7-4 15-5 22-4" stroke="#000" stroke-width="1.2" opacity=".18" fill="none"/>` },

  travel: { nm:'Travel', ds:'A suitcase', c:9, vb:'2 12 96 78', svg:`
    <path d="M40 20h20a4 4 0 0 1 4 4v8h-6v-6H42v6h-6v-8a4 4 0 0 1 4-4Z" fill="var(--brass)"/>
    <path d="M8 32h84a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V38a6 6 0 0 1 6-6Z" fill="currentColor"/>
    
    
    
    <g fill="var(--brass)">
      <path d="M22 32h9v52h-9Z"/><path d="M69 32h9v52h-9Z"/>
    </g>
    <g fill="#fff" opacity=".3"><path d="M22 32h3v52h-3Z"/><path d="M69 32h3v52h-3Z"/></g>
    <g fill="#000" opacity=".2"><path d="M28 32h3v52h-3Z"/><path d="M75 32h3v52h-3Z"/></g>
    <rect x="20" y="52" width="13" height="10" rx="2" fill="var(--brass)"/>
    <rect x="67" y="52" width="13" height="10" rx="2" fill="var(--brass)"/>
    
    <g transform="rotate(-14 88 44)">
      <path d="M80 36h17a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H80l-5-8Z" fill="var(--paper-2, #F1EBDA)"/>
    
    <path d="M87 41h10M87 45h8M87 49h10" stroke="var(--ink, #2A2118)" stroke-width="1.3" opacity=".4"/>
    </g>` },

  family: { nm:'Family', ds:'A framed photograph', c:12, vb:'4 6 92 88', svg:`
    <path d="M12 10h76a4 4 0 0 1 4 4v66a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z" fill="var(--brass)"/>
    
    
    <path d="M19 21h62v52H19Z" fill="var(--paper-2, #F1EBDA)"/>
    <path d="M19 21h62v52H19Z" fill="currentColor" opacity=".2"/>
    <circle cx="38" cy="40" r="9" fill="currentColor"/>
    <path d="M23 70c0-9 7-16 15-16s15 7 15 16Z" fill="currentColor"/>
    <circle cx="62" cy="43" r="7.5" fill="currentColor" opacity=".78"/>
    <path d="M49 70c0-8 6-14 13-14s13 6 13 14Z" fill="currentColor" opacity=".78"/>
    <circle cx="49" cy="52" r="5.5" fill="currentColor" opacity=".6"/>
    <path d="M40 70c0-6 4-11 9-11s9 5 9 11Z" fill="currentColor" opacity=".6"/>
    ` },

  partner: { nm:'Partner', ds:'Two rings', c:1, vb:'2 20 96 60', svg:`
    <g>
      <circle cx="36" cy="50" r="22" fill="none" stroke="var(--brass)" stroke-width="7"/>
      <path d="M15.3 42.5A22 22 0 0 1 43.5 29.3" fill="none" stroke="#fff" stroke-width="6" opacity=".34" stroke-linecap="round"/>
      <path d="M28.5 70.7A22 22 0 0 0 56.7 57.5" fill="none" stroke="#000" stroke-width="6" opacity=".16" stroke-linecap="round"/>
      <circle cx="36" cy="50" r="22" fill="none" stroke="#000" stroke-width="1.2" opacity=".18"/>
    </g>
    <g>
      <circle cx="64" cy="50" r="22" fill="none" stroke="currentColor" stroke-width="7"/>
      <path d="M43.3 42.5A22 22 0 0 1 71.5 29.3" fill="none" stroke="#fff" stroke-width="6" opacity=".3" stroke-linecap="round"/>
      <path d="M56.5 70.7A22 22 0 0 0 84.7 57.5" fill="none" stroke="#000" stroke-width="6" opacity=".16" stroke-linecap="round"/>
      <circle cx="64" cy="50" r="22" fill="none" stroke="#000" stroke-width="1.2" opacity=".18"/>
      ${/* the brass ring passing back in front, which is what makes them linked */''}
      <path d="M46.5 33.6A22 22 0 0 0 38.6 28.1" fill="none" stroke="var(--brass)" stroke-width="7"/>
    </g>
    <path d="M64 24l4 5-4 5-4-5Z" fill="var(--glow)"/>
    ` },

  friends: { nm:'Friends', ds:'Two cups', c:7, vb:'0 22 100 62', svg:`
    <g>
      <path d="M6 44h40v14a20 16 0 0 1-40 0Z" fill="var(--paper-2, #F1EBDA)"/>
      <path d="M6 44h40v14a20 16 0 0 1-40 0Z" fill="currentColor" opacity=".3"/>
    <ellipse cx="26" cy="44" rx="20" ry="6" fill="var(--paper-2, #F1EBDA)"/>
    <ellipse cx="26" cy="44" rx="16" ry="4.4" fill="currentColor" opacity=".55"/>
      <path d="M46 48c8-2 12 2 12 7s-4 9-12 8" fill="none" stroke="var(--paper-2, #F1EBDA)" stroke-width="5"/>
      <ellipse cx="26" cy="76" rx="26" ry="6" fill="var(--paper-2, #F1EBDA)"/>
    
    </g>
    <g>
      <path d="M56 40h38v13a19 15 0 0 1-38 0Z" fill="var(--paper-2, #F1EBDA)"/>
      <path d="M56 40h38v13a19 15 0 0 1-38 0Z" fill="currentColor" opacity=".22"/>
    <ellipse cx="75" cy="40" rx="19" ry="5.6" fill="var(--paper-2, #F1EBDA)"/>
    <ellipse cx="75" cy="40" rx="15" ry="4" fill="currentColor" opacity=".5"/>
      <path d="M68 28c-3-4 0-6 2-8M78 28c-3-4 0-6 2-8" stroke="var(--glow)" stroke-width="2.4"
        fill="none" opacity=".55" stroke-linecap="round"/>
      <ellipse cx="75" cy="72" rx="24" ry="5.6" fill="var(--paper-2, #F1EBDA)"/>
    </g>` },

  /* Three added with the boards (decision 195), each an object you would
     find lying on that part of a desk: a stethoscope, a reel and a pile of
     books. Same vocabulary as the nine — the type's colour for the body,
     brass for metal, glow for the light — so every aesthetic dresses them. */
  health: { nm:'Health', ds:'A stethoscope', c:8, vb:'4 6 92 88', svg:`
    <path d="M28 10v26a18 18 0 0 0 36 0V10" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
    <circle cx="28" cy="10" r="5" fill="var(--brass)"/>
    <circle cx="64" cy="10" r="5" fill="var(--brass)"/>
    <path d="M46 54v10a16 16 0 0 0 32 0V58" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <circle cx="78" cy="50" r="12" fill="var(--brass)"/>
    <circle cx="78" cy="50" r="7" fill="var(--glow)" opacity=".6"/>
    <circle cx="78" cy="50" r="12" fill="none" stroke="#fff" stroke-width="1.4" opacity=".25"/>` },

  films: { nm:'Films', ds:'A reel of film', c:9, vb:'4 4 92 92', svg:`
    <circle cx="46" cy="46" r="38" fill="currentColor"/>
    <circle cx="46" cy="46" r="38" fill="none" stroke="#000" stroke-width="2" opacity=".18"/>
    <circle cx="46" cy="24" r="9" fill="var(--ink, #2A2118)" opacity=".75"/>
    <circle cx="46" cy="68" r="9" fill="var(--ink, #2A2118)" opacity=".75"/>
    <circle cx="24" cy="46" r="9" fill="var(--ink, #2A2118)" opacity=".75"/>
    <circle cx="68" cy="46" r="9" fill="var(--ink, #2A2118)" opacity=".75"/>
    <circle cx="46" cy="46" r="6" fill="var(--brass)"/>
    <path d="M78 64c6 8 10 16 14 26" stroke="var(--ink, #2A2118)" stroke-width="7" opacity=".7" fill="none"/>` },

  books: { nm:'Books', ds:'A pile of books', c:11, vb:'2 14 96 74', svg:`
    <rect x="8" y="64" width="84" height="16" rx="2" fill="currentColor"/>
    <rect x="8" y="64" width="84" height="16" rx="2" fill="#000" opacity=".12"/>
    <rect x="14" y="46" width="72" height="16" rx="2" fill="currentColor"/>
    <rect x="20" y="28" width="62" height="16" rx="2" fill="currentColor"/>
    <rect x="20" y="28" width="62" height="16" rx="2" fill="#fff" opacity=".1"/>
    <path d="M88 66v12M82 48v12M78 30v12" stroke="var(--paper-2, #F1EBDA)" stroke-width="3" opacity=".8"/>
    <path d="M24 52h40M30 34h30M16 70h50" stroke="var(--brass)" stroke-width="2.4" stroke-linecap="round"/>` },

  experiences: { nm:'Experiences', ds:'A camera', c:15, vb:'2 14 96 72', svg:`
    <path d="M34 22h32l5 8H29Z" fill="currentColor"/>
    <path d="M6 30h88a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6Z" fill="currentColor"/>
    
    
    <circle cx="50" cy="53" r="21" fill="var(--brass)"/>
    <circle cx="50" cy="53" r="17" fill="var(--ink, #2A2118)" opacity=".8"/>
    <circle cx="50" cy="53" r="12" fill="var(--glow)" opacity=".5"/>
    
    <circle cx="50" cy="53" r="21" fill="none" stroke="#fff" stroke-width="1.6" opacity=".22"/>
    <rect x="8" y="36" width="16" height="9" rx="2" fill="var(--brass)"/>
    <circle cx="86" cy="41" r="4.5" fill="var(--glow)"/>
    
    ` }
};
const LIFE_KEYS = Object.keys(LIFE_ART);
/* The artwork for one, as markup. Centred rather than stood on a floor: a
   thing lying on a desk has no up, and these are the *face* of a tile rather
   than an ornament standing in front of one. */
function lifeSVG(name){
  const d = LIFE_ART[name];
  if(!d) return '';
  return `<svg class="lifeart" viewBox="${d.vb}" preserveAspectRatio="xMidYMid meet"
    aria-hidden="true">${d.svg}</svg>`;
}

const DECOR_KEYS = Object.keys(DECOR);
/* ---- which ones suit where — decision 100 ------------------------------
   A decoration is a *made object*, not a slot: a mantel clock cannot be
   re-dressed into a gearwork the way a knob is re-dressed into a boss, and
   pretending otherwise would mean fourteen drawings times seven aesthetics.
   So it is **tagged** instead — each says which aesthetics it belongs on, the
   picker leads with those, and the rest are behind the same "From other
   aesthetics" disclosure every slot family has. Nothing is hidden and nothing
   is converted; the order is the whole of it. */
const decorSuits = (k, sty) => (DECOR[k] && DECOR[k].aes || []).includes(sty);
const decorFor = sty => DECOR_KEYS.filter(k=>decorSuits(k, sty));
const decorRest = sty => DECOR_KEYS.filter(k=>!decorSuits(k, sty));
const decorOf = o => (DECOR[o && o.decor] ? o.decor : 'plant');
/* ---- the two that burn — decision 179 ----------------------------------
   A lamp and a candle are the only things in this catalogue that *do*
   something, and what they do is light the board round them. `emits` says
   where the flame is **in the artwork's own viewBox units** and how far the
   light reaches, in cells — not as a fraction of the tile, because an SVG
   drawn `xMidYMax meet` is letterboxed inside whatever box it is given and a
   fraction of the box would walk off the wick the moment anyone resized one.
   `flamePoint()` undoes that letterboxing, so the light sits on the flame at
   any size and any proportion.

   A property of the *drawing*, read off this table, so a decoration somebody
   adds later lights the room by saying so here and by changing nothing else. */
const emitsOf = k => (DECOR[k] || {}).emits || null;
const decorEmits = o => emitsOf(decorOf(o));
/* Where the flame actually lands inside a box of `w x h` cells, and how far
   its light reaches. `meet` scales to fit and `xMidYMax` centres it across and
   stands it on the floor, which is the whole of the arithmetic below. */
function flamePoint(o, w, h){
  const e = decorEmits(o); if(!e) return null;
  const [vx, vy, vw, vh] = String((DECOR[decorOf(o)]||{}).vb || '0 0 100 100')
    .split(/[\s,]+/).map(Number);
  const k = Math.min(w/vw, h/vh);
  return { x: (w - vw*k)/2 + (e.x - vx)*k,
           y: (h - vh*k)   + (e.y - vy)*k,
           r: e.reach };
}
/* The artwork, as markup. Each states its own viewBox, tight to itself, and
   `xMidYMax` stands it on the floor of whatever box it is drawn into — so a
   row of them lines up along one shelf however differently proportioned they
   are. A built-in is inlined so it can read the style; an uploaded file is an
   <img>, because a picture somebody chose has no business being repainted. */
/* **Most of them are photographs now** (decision 204): public-domain museum
   pictures cut out to PNG under `img/decor/` (docs/IMAGES.md says where each
   came from), which is what Timothy asked for in place of the drawings. A
   photograph is an `<image>` inside the same `<svg>`, with a viewBox of its
   own pixels, so standing on the floor of the tile, `flamePoint()` and the
   tile's shape all work as they did. It does not take the style's colours,
   which is the price. Where no clean photograph was found (the fern and the
   palm) the drawing stays. */
function decorSVG(name){
  const d = DECOR[name] || DECOR.plant;
  const [, , w, h] = d.vb.split(' ');
  const body = d.png ? `<image href="${d.png}" x="0" y="0" width="${w}" height="${h}"/>` : d.svg;
  return `<svg class="decart" viewBox="${d.vb}" preserveAspectRatio="xMidYMax meet"
    aria-hidden="true">${body}</svg>`;
}

export { DECOR, DECOR_KEYS, decorOf, decorEmits, flamePoint, decorSVG, decorSuits, decorFor, decorRest,
  LIFE_ART, LIFE_KEYS, lifeSVG };
