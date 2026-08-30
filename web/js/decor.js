/* ============================================================
   22 · decorations — the things standing on the shelf
   ============================================================
   A decoration is not information. It is the plant on the bookcase, the brass
   bookend, the little cat nobody remembers buying — it holds nothing, says
   nothing, and is there because the desk looks better with it. That is the
   whole type, and it is why it is the one thing on the board allowed to
   *overlap*: a plant standing in front of a row of books is what a shelf
   looks like, and a grid that refuses it is a spreadsheet. See decision 86.

   These ten ship with the app. They are **inline SVG**, not files, for three
   reasons: they cost nothing to cache because they are already in the shell,
   they stay crisp at any size a tile can be, and — the real one — being in the
   DOM lets them read the style's own custom properties. A decoration is drawn
   in `currentColor` (the object's own colour), `--brass` and `--glow`, so the
   same plant is terracotta and leaf on Victorian and pine and green shimmer on
   Starry, exactly like everything else that draws. Never hardcode a hue in
   here that isn't a genuine highlight or a shadow.

   Every one is authored in a 100×100 box standing on the floor of it, so a
   row of them on a shelf lines up along the bottom rather than floating at
   assorted heights. `preserveAspectRatio` keeps them upright in any box.   */

const DECOR = {
  plant: { c:6, nm:'Plant', svg:`
    <path d="M50 96V56" stroke="var(--brass)" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M50 60C50 44 38 34 24 32c-2 15 10 27 26 28Z" fill="currentColor"/>
    <path d="M50 58c0-15 11-26 25-28 2 15-9 26-25 28Z" fill="currentColor" opacity=".82"/>
    <path d="M50 44c0-13 6-24 14-30 6 11 2 25-14 30Z" fill="currentColor" opacity=".64"/>
    <path d="M50 46c0-12-5-22-12-27-6 10-3 22 12 27Z" fill="currentColor" opacity=".7"/>
    <path d="M32 68h36l-4 26a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4Z" fill="var(--brass)"/>
    <path d="M30 62h40v8H30Z" fill="var(--brass)"/>
    <path d="M30 62h40v8H30Z" fill="#fff" opacity=".18"/>
    <path d="M40 74v18" stroke="#000" stroke-width="2" opacity=".12" stroke-linecap="round"/>` },

  bookend: { c:11, nm:'Bookend', svg:`
    <path d="M22 92h56v6H22Z" fill="#000" opacity=".14"/>
    <path d="M30 26h12v66H30Z" fill="var(--brass)"/>
    <path d="M30 84h44v8H30Z" fill="var(--brass)"/>
    <path d="M30 26h12v66H30Z" fill="#fff" opacity=".2"/>
    <path d="M46 40h9v44h-9Z" fill="currentColor"/>
    <path d="M57 46h8v38h-8Z" fill="currentColor" opacity=".72"/>
    <path d="M67 36h9v48h-9Z" fill="currentColor" opacity=".85"/>
    <path d="M48 50h5M59 55h4M69 46h5" stroke="var(--glow)" stroke-width="2" stroke-linecap="round"/>` },

  cat: { c:5, nm:'Cat', svg:`
    <ellipse cx="50" cy="94" rx="24" ry="4" fill="#000" opacity=".14"/>
    <path d="M34 92c-4-16-2-30 4-38 5-7 19-7 24 0 6 8 8 22 4 38Z" fill="currentColor"/>
    <path d="M40 54a12 12 0 0 1 20 0c3 5 2 12-3 15a15 15 0 0 1-14 0c-5-3-6-10-3-15Z" fill="currentColor"/>
    <path d="M39 46l-3-13 12 7Zm22 0 3-13-12 7Z" fill="currentColor"/>
    <path d="M70 92c8-4 10-14 6-22" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="44" cy="57" r="2.4" fill="var(--glow)"/>
    <circle cx="56" cy="57" r="2.4" fill="var(--glow)"/>
    <path d="M48 63h4l-2 3Z" fill="var(--brass)"/>` },

  candle: { c:13, nm:'Candle', svg:`
    <path d="M50 20c5 5 7 9 7 13a7 7 0 0 1-14 0c0-4 2-8 7-13Z" fill="var(--glow)"/>
    <path d="M50 27c2 3 3 5 3 7a3 3 0 0 1-6 0c0-2 1-4 3-7Z" fill="#fff" opacity=".65"/>
    <path d="M50 36v4" stroke="#000" stroke-width="2" opacity=".4"/>
    <path d="M40 40h20v38H40Z" fill="currentColor"/>
    <path d="M40 40h6v38h-6Z" fill="#fff" opacity=".22"/>
    <path d="M40 40c4 3 16 3 20 0v4c-4 3-16 3-20 0Z" fill="#fff" opacity=".3"/>
    <path d="M32 78h36l-3 8a5 5 0 0 1-5 4H40a5 5 0 0 1-5-4Z" fill="var(--brass)"/>
    <path d="M28 90h44v5H28Z" fill="var(--brass)"/>
    <path d="M28 90h44v5H28Z" fill="#000" opacity=".16"/>` },

  books: { c:11, nm:'Books', svg:`
    <path d="M20 92h60v5H20Z" fill="#000" opacity=".14"/>
    <path d="M24 74h54v18H24Z" fill="currentColor"/>
    <path d="M24 74h54v4H24Z" fill="#fff" opacity=".22"/>
    <path d="M28 56h48v18H28Z" fill="var(--brass)"/>
    <path d="M28 56h48v4H28Z" fill="#fff" opacity=".22"/>
    <path d="M32 38h40v18H32Z" fill="currentColor" opacity=".75"/>
    <path d="M32 38h40v4H32Z" fill="#fff" opacity=".22"/>
    <path d="M34 82h20M38 64h18M40 46h16" stroke="var(--glow)" stroke-width="2.4" stroke-linecap="round"/>` },

  mushroom: { c:11, nm:'Toadstool', svg:`
    <ellipse cx="50" cy="94" rx="20" ry="4" fill="#000" opacity=".14"/>
    <path d="M42 60h16c2 12 4 22 2 32H40c-2-10 0-20 2-32Z" fill="var(--brass)"/>
    <path d="M42 60h6c-1 12-2 22-1 32h-7c-2-10 0-20 2-32Z" fill="#fff" opacity=".26"/>
    <path d="M18 62c0-20 14-34 32-34s32 14 32 34c0 4-64 4-64 0Z" fill="currentColor"/>
    <circle cx="36" cy="46" r="6" fill="#fff" opacity=".8"/>
    <circle cx="60" cy="42" r="4.5" fill="#fff" opacity=".8"/>
    <circle cx="68" cy="55" r="3.5" fill="#fff" opacity=".8"/>
    <circle cx="46" cy="56" r="3" fill="#fff" opacity=".8"/>` },

  vase: { c:12, nm:'Dried stems', svg:`
    <path d="M50 62V26M50 40c0-8 6-14 13-16M50 48c0-8-6-14-13-16" stroke="var(--brass)"
      stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="63" cy="19" rx="5" ry="8" fill="currentColor" transform="rotate(24 63 19)"/>
    <ellipse cx="37" cy="27" rx="4.5" ry="7" fill="currentColor" opacity=".78" transform="rotate(-24 37 27)"/>
    <ellipse cx="50" cy="16" rx="5" ry="9" fill="currentColor" opacity=".9"/>
    <path d="M38 60h24c4 10 4 22 0 30a6 6 0 0 1-5 3H43a6 6 0 0 1-5-3c-4-8-4-20 0-30Z" fill="var(--brass)"/>
    <path d="M38 60h7c-3 10-3 22 0 33h-2a6 6 0 0 1-5-3c-4-8-4-20 0-30Z" fill="#fff" opacity=".24"/>
    <path d="M35 58h30v5H35Z" fill="var(--brass)"/>` },

  clock: { c:5, nm:'Clock', svg:`
    <path d="M24 88h52v8H24Z" fill="var(--brass)"/>
    <path d="M24 88h52v8H24Z" fill="#000" opacity=".18"/>
    <path d="M26 34a24 24 0 0 1 48 0v54H26Z" fill="currentColor"/>
    <path d="M26 34a24 24 0 0 1 24-24v78H26Z" fill="#fff" opacity=".14"/>
    <circle cx="50" cy="42" r="19" fill="var(--paper-2, #F3EDDD)"/>
    <circle cx="50" cy="42" r="19" fill="none" stroke="var(--brass)" stroke-width="2.5"/>
    <path d="M50 42V30M50 42l9 6" stroke="var(--ink, #2A2118)" stroke-width="2.6"
      fill="none" stroke-linecap="round"/>
    <circle cx="50" cy="42" r="2" fill="var(--ink, #2A2118)"/>
    <path d="M50 68v14" stroke="var(--glow)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="50" cy="84" r="5" fill="var(--glow)"/>` },

  crystal: { c:14, nm:'Crystals', svg:`
    <ellipse cx="50" cy="92" rx="26" ry="5" fill="#000" opacity=".14"/>
    <path d="M50 14 66 52 58 90H42L34 52Z" fill="currentColor"/>
    <path d="M50 14 66 52 58 90 50 52Z" fill="#000" opacity=".16"/>
    <path d="M50 14 34 52l16 38Z" fill="#fff" opacity=".2"/>
    <path d="M26 44 36 66 32 90H22L18 66Z" fill="currentColor" opacity=".78"/>
    <path d="M26 44 36 66 32 90 26 66Z" fill="#000" opacity=".14"/>
    <path d="M76 52 84 70 81 90H71L68 70Z" fill="currentColor" opacity=".66"/>
    <path d="M76 52 84 70 81 90 76 70Z" fill="#000" opacity=".14"/>
    <path d="M34 52h32M18 66h18M68 70h16" stroke="var(--glow)" stroke-width="1.6" opacity=".8"/>` },

  bird: { c:10, nm:'Bird', svg:`
    <ellipse cx="52" cy="93" rx="20" ry="4" fill="#000" opacity=".14"/>
    <path d="M36 62c0-14 10-24 22-24s24 10 24 24c0 12-8 20-20 22-14 2-26-8-26-22Z" fill="currentColor"/>
    <path d="M46 46a15 15 0 0 1 21 3c3 5 2 12-4 15-8 4-18 0-20-7-1-4 0-8 3-11Z" fill="currentColor" opacity=".82"/>
    <path d="M52 68c8-2 16 2 22 10-8 6-18 6-24 0Z" fill="#000" opacity=".14"/>
    <path d="M40 34a12 12 0 0 1 20 8c1 6-4 11-10 11a11 11 0 0 1-10-19Z" fill="currentColor"/>
    <path d="M39 42 26 46l13 5Z" fill="var(--glow)"/>
    <circle cx="48" cy="41" r="2.4" fill="var(--ink, #2A2118)"/>
    <path d="M46 84v9M58 84v9" stroke="var(--brass)" stroke-width="3" stroke-linecap="round"/>` }
};

/* Each one names the **slot** it looks best in — a fern-green plant, a claret
   toadstool, a walnut cat. A slot rather than a hex, so it is still the
   style's colour and a decoration repaints when you change style like
   everything else (decision 33). It is a starting point, not a cage: picking a
   built-in only takes the suggestion when the object has never been given a
   colour of its own. */
const DECOR_KEYS = Object.keys(DECOR);
const decorOf = o => (o && o.decor) || 'plant';
/* The artwork, as markup. A built-in is inlined so it can read the style; an
   uploaded file is an <img>, because a picture somebody chose is a picture and
   has no business being repainted by a stylesheet. */
function decorSVG(name){
  const d = DECOR[name] || DECOR.plant;
  return `<svg class="decart" viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet"
    aria-hidden="true">${d.svg}</svg>`;
}

export { DECOR, DECOR_KEYS, decorOf, decorSVG };
