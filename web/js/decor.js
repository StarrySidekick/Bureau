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
  plant: { c:6, nm:'Aspidistra', vb:'3.5 2.5 81 97.5', size:[4,5], svg:`
    <path d="M44 74C44 52 32 34 6 24c-6 26 12 48 38 52Z" fill="currentColor"/>
    <path d="M44 74C44 52 32 34 6 24c14 22 26 34 38 50Z" fill="#000" opacity=".13"/>
    <path d="M44 72c0-24 12-42 38-52 6 26-12 48-38 52Z" fill="currentColor" opacity=".86"/>
    <path d="M44 72c0-24 12-42 38-52-14 22-26 34-38 52Z" fill="#000" opacity=".1"/>
    <path d="M44 66C44 44 38 22 26 8c-8 22-2 46 18 58Z" fill="currentColor" opacity=".72"/>
    <path d="M44 64c0-24 6-44 18-58 8 22 2 46-18 58Z" fill="currentColor" opacity=".64"/>
    <path d="M20 66h48l-5 30a5 5 0 0 1-5 4H30a5 5 0 0 1-5-4Z" fill="var(--brass)"/>
    <path d="M20 66h14l-3 34h-1a5 5 0 0 1-5-4Z" fill="#fff" opacity=".2"/>
    <path d="M16 60h56v8H16Z" fill="var(--brass)"/>
    <path d="M16 60h56v3H16Z" fill="#fff" opacity=".3"/>
    <path d="M23 78h42M24 86h40" stroke="var(--glow)" stroke-width="1.6" opacity=".55"/>
    <path d="M25 96h38l-.6 4H25.6Z" fill="#000" opacity=".22"/>` },

  fern: { c:7, nm:'Fern', vb:'5 1.5 82 98.5', size:[4,5], svg:`
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
    <path d="M26 62h11c-2 12-2 26 0 38h-7a5 5 0 0 1-4-4c-3-10-3-22 0-34Z" fill="#fff" opacity=".22"/>
    <path d="M22 58h48v7H22Z" fill="var(--brass)"/>
    <path d="M22 58h48v2.6H22Z" fill="#fff" opacity=".32"/>
    <path d="M29 96h34l-.5 4H29.5Z" fill="#000" opacity=".2"/>` },

  palm: { c:8, nm:'Parlour palm', vb:'2.5 -1.5 79 101.5', size:[3,4], svg:`
    <g stroke="var(--brass)" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".8">
      <path d="M42 64V22"/><path d="M42 46C38 34 30 26 16 22"/><path d="M42 42c4-12 12-20 26-24"/>
    </g>
    <path d="M42 24C34 12 20 6 4 8c6 14 22 20 38 16Z" fill="currentColor"/>
    <path d="M42 24C50 12 64 6 80 8c-6 14-22 20-38 16Z" fill="currentColor" opacity=".84"/>
    <path d="M42 22C38 8 28 0 14 0c0 12 12 22 28 22Z" fill="currentColor" opacity=".7"/>
    <path d="M42 22C46 8 56 0 70 0c0 12-12 22-28 22Z" fill="currentColor" opacity=".62"/>
    <path d="M42 26c-4-8-2-18 2-26 6 8 6 18 0 26Z" fill="currentColor" opacity=".9"/>
    <path d="M24 62h36l-4 34a4 4 0 0 1-4 4H32a4 4 0 0 1-4-4Z" fill="var(--brass)"/>
    <path d="M24 62h11l-3 38h-1a4 4 0 0 1-4-4Z" fill="#fff" opacity=".22"/>
    <path d="M20 56h44v7H20Z" fill="var(--brass)"/>
    <path d="M20 56h44v2.4H20Z" fill="#fff" opacity=".34"/>
    <path d="M22 66h40M25 82h34" stroke="var(--glow)" stroke-width="1.5" opacity=".5"/>
    <path d="M29 96h26l-.4 4H29.4Z" fill="#000" opacity=".22"/>` },

  /* ---- clocks ---------------------------------------------------------- */
  clock: { c:5, nm:'Mantel clock', vb:'-1 0.5 78 99.5', size:[3,4], svg:`
    <path d="M38 2c2 0 3 1 3 3s-1 3-3 3-3-1-3-3 1-3 3-3Z" fill="var(--brass)"/>
    <path d="M37 8h2v6h-2Z" fill="var(--brass)"/>
    <path d="M10 40a28 28 0 0 1 56 0v46H10Z" fill="currentColor"/>
    <path d="M10 40a28 28 0 0 1 28-28v74H10Z" fill="#fff" opacity=".1"/>
    <path d="M10 40a28 28 0 0 1 56 0v4H10Z" fill="#000" opacity=".12"/>
    <circle cx="38" cy="44" r="21" fill="var(--paper-2, #F1EBDA)"/>
    <circle cx="38" cy="44" r="21" fill="none" stroke="var(--brass)" stroke-width="2.8"/>
    <circle cx="38" cy="44" r="17" fill="none" stroke="var(--brass)" stroke-width="1" opacity=".5"/>
    <g stroke="var(--ink, #2A2118)" stroke-width="1.4" opacity=".55">
      <path d="M38 27v3M38 58v3M21 44h3M52 44h3M50 32l2-2M24 58l2-2M50 56l2 2M24 30l2 2"/>
    </g>
    <path d="M38 44V32M38 44l8 5" stroke="var(--ink, #2A2118)" stroke-width="2.2"
      fill="none" stroke-linecap="round"/>
    <circle cx="38" cy="44" r="1.8" fill="var(--brass)"/>
    <path d="M38 70v12" stroke="var(--brass)" stroke-width="2"/>
    <circle cx="38" cy="84" r="5" fill="var(--brass)"/>
    <circle cx="38" cy="84" r="5" fill="#fff" opacity=".22"/>
    <path d="M4 86h68v8H4Z" fill="var(--brass)"/>
    <path d="M4 86h68v2.6H4Z" fill="#fff" opacity=".34"/>
    <path d="M0 94h76v6H0Z" fill="var(--brass)"/>
    <path d="M0 94h76v6H0Z" fill="#000" opacity=".2"/>` },

  carriage: { c:13, nm:'Carriage clock', vb:'0.5 -1.7 71 101.7', size:[3,4], svg:`
    <path d="M22 12c0-8 6-12 14-12s14 4 14 12" stroke="var(--brass)" stroke-width="3.4"
      fill="none" stroke-linecap="round"/>
    <path d="M8 16h56v6H8Z" fill="var(--brass)"/>
    <path d="M8 16h56v2.2H8Z" fill="#fff" opacity=".34"/>
    <path d="M12 22h48v62H12Z" fill="currentColor"/>
    <path d="M12 22h13v62H12Z" fill="#fff" opacity=".12"/>
    <g fill="var(--brass)">
      <path d="M12 22h4v62h-4ZM56 22h4v62h-4Z"/>
    </g>
    <rect x="19" y="30" width="34" height="34" rx="2" fill="var(--paper-2, #F1EBDA)"/>
    <rect x="19" y="30" width="34" height="34" rx="2" fill="none" stroke="var(--brass)" stroke-width="2"/>
    <circle cx="36" cy="47" r="13" fill="none" stroke="var(--brass)" stroke-width="1.2" opacity=".6"/>
    <path d="M36 47V38M36 47l7 4" stroke="var(--ink, #2A2118)" stroke-width="1.9"
      fill="none" stroke-linecap="round"/>
    <circle cx="36" cy="47" r="1.5" fill="var(--ink, #2A2118)"/>
    <path d="M22 70h28M24 76h24" stroke="var(--glow)" stroke-width="1.6" opacity=".55"/>
    <path d="M6 84h60v8H6Z" fill="var(--brass)"/>
    <path d="M6 84h60v2.4H6Z" fill="#fff" opacity=".32"/>
    <path d="M2 92h68v8H2Z" fill="var(--brass)"/>
    <path d="M2 92h68v8H2Z" fill="#000" opacity=".18"/>` },

  dome: { c:11, nm:'Under glass', vb:'-1 8.5 72 91.5', size:[3,4], svg:`
    <path d="M35 40c0-9 6-15 6-22" stroke="var(--brass)" stroke-width="2" fill="none" opacity=".7"/>
    <path d="M27 56h9c1 8 2 16 1 22H26c-1-6 0-14 1-22Z" fill="var(--brass)"/>
    <path d="M27 56h3.4c-.6 8-1.2 16-.6 22H26c-1-6 0-14 1-22Z" fill="#fff" opacity=".28"/>
    <path d="M14 58c0-12 8-20 17.5-20S49 46 49 58c0 2-35 2-35 0Z" fill="currentColor"/>
    <circle cx="24" cy="49" r="3.4" fill="var(--paper-2,#F1EBDA)" opacity=".85"/>
    <circle cx="38" cy="46" r="2.6" fill="var(--paper-2,#F1EBDA)" opacity=".85"/>
    <circle cx="43" cy="53" r="2" fill="var(--paper-2,#F1EBDA)" opacity=".85"/>
    ${/* the glass, over it */''}
    <path d="M8 84V44a27 27 0 0 1 54 0v40Z" fill="#fff" opacity=".2"/>
    <path d="M8 84V44a27 27 0 0 1 54 0v40" fill="none" stroke="var(--ink, #2A2118)"
      stroke-width="1.6" opacity=".3"/>
    <path d="M8 84V44a27 27 0 0 1 54 0v40" fill="none" stroke="#fff"
      stroke-width="1" opacity=".5" transform="translate(1.4 1.4)"/>
    <path d="M17 82V47a18 18 0 0 1 7-14c-3 4-4 9-4 14v35Z" fill="#fff" opacity=".55"/>
    <path d="M52 78V50" stroke="#fff" stroke-width="2" opacity=".3" stroke-linecap="round"/>
    <path d="M35 12h1v6h-1Z" fill="var(--brass)"/>
    <circle cx="35" cy="11" r="4.2" fill="var(--brass)"/>
    <circle cx="34" cy="10" r="1.6" fill="#fff" opacity=".5"/>
    <path d="M4 84h62v8H4Z" fill="var(--brass)"/>
    <path d="M4 84h62v2.4H4Z" fill="#fff" opacity=".34"/>
    <path d="M0 92h70v8H0Z" fill="var(--brass)"/>
    <path d="M0 92h70v8H0Z" fill="#000" opacity=".2"/>` },

  /* ---- figures --------------------------------------------------------- */
  bust: { c:15, nm:'Bust', vb:'0.5 5.5 61 94.5', size:[2,3], svg:`
    <path d="M31 8c8 0 13 6 13 15 0 7-2 12-5 15 4 2 7 5 8 9H15c1-4 4-7 8-9-3-3-5-8-5-15 0-9 5-15 13-15Z" fill="currentColor"/>
    <path d="M31 8c-8 0-13 6-13 15 0 7 2 12 5 15-4 2-7 5-8 9h8V8Z" fill="#fff" opacity=".14"/>
    <path d="M18 21c0-9 5-14 13-14 4 0 7 1 9 4-3 6-13 9-22 10Z" fill="#000" opacity=".12"/>
    <path d="M12 47h38c4 8 6 16 6 25H6c0-9 2-17 6-25Z" fill="currentColor"/>
    <path d="M12 47h9c-3 8-4 16-4 25H6c0-9 2-17 6-25Z" fill="#fff" opacity=".13"/>
    <path d="M6 72h50v6H6Z" fill="var(--brass)"/>
    <path d="M6 72h50v2H6Z" fill="#fff" opacity=".34"/>
    <path d="M11 78h40v14H11Z" fill="currentColor" opacity=".9"/>
    <path d="M11 78h11v14H11Z" fill="#fff" opacity=".12"/>
    <path d="M17 84h28" stroke="var(--glow)" stroke-width="1.6" opacity=".5"/>
    <path d="M2 92h58v8H2Z" fill="var(--brass)"/>
    <path d="M2 92h58v2.4H2Z" fill="#fff" opacity=".3"/>
    <path d="M2 96h58v4H2Z" fill="#000" opacity=".2"/>` },

  figurine: { c:14, nm:'Figurine', vb:'0.5 0.8 53 99.2', size:[2,4], svg:`
    <circle cx="27" cy="12" r="8" fill="currentColor"/>
    <circle cx="27" cy="12" r="8" fill="#fff" opacity=".16"/>
    <path d="M22 6c2-4 8-5 11-2 2 2 2 5 1 7-3-3-8-5-12-5Z" fill="#000" opacity=".14"/>
    <path d="M27 20c5 0 9 4 10 9l2 13c-4 2-20 2-24 0l2-13c1-5 5-9 10-9Z" fill="currentColor"/>
    <path d="M27 20c-5 0-9 4-10 9l-2 13c2 1 6 1.6 9 1.8L27 20Z" fill="#fff" opacity=".15"/>
    <path d="M37 30c5 2 8 6 9 12" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M17 30c-5 2-8 6-9 12" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M15 42c8 2 16 2 24 0 6 14 9 28 9 42H6c0-14 3-28 9-42Z" fill="currentColor"/>
    <path d="M15 42c3 .8 6 1.3 9 1.6C20 58 18 72 18 84H6c0-14 3-28 9-42Z" fill="#fff" opacity=".15"/>
    <g stroke="var(--glow)" stroke-width="1.3" opacity=".45" fill="none">
      <path d="M24 46c-3 12-4 25-4 38M31 46c3 12 4 25 4 38"/>
    </g>
    <path d="M6 84h42v8H6Z" fill="var(--brass)"/>
    <path d="M6 84h42v2.4H6Z" fill="#fff" opacity=".34"/>
    <path d="M2 92h50v8H2Z" fill="var(--brass)"/>
    <path d="M2 92h50v8H2Z" fill="#000" opacity=".2"/>` },

  /* ---- light and vessels ----------------------------------------------- */
  candle: { c:3, nm:'Candlestick', vb:'3.5 2.5 35 97.5', size:[2,5], svg:`
    <path d="M22 4c3 4 4.5 7 4.5 9.5A4.5 4.5 0 0 1 22 18a4.5 4.5 0 0 1-4.5-4.5C17.5 11 19 8 22 4Z" fill="var(--glow)"/>
    <path d="M22 8c1.4 2 2 3.4 2 4.6A2 2 0 0 1 22 15a2 2 0 0 1-2-2.4c0-1.2.6-2.6 2-4.6Z" fill="#fff" opacity=".7"/>
    <path d="M22 19v3" stroke="#000" stroke-width="1.6" opacity=".45"/>
    <path d="M16 22h12v30H16Z" fill="currentColor"/>
    <path d="M16 22h4v30h-4Z" fill="#fff" opacity=".3"/>
    <path d="M16 22c2 1.6 10 1.6 12 0v3c-2 1.6-10 1.6-12 0Z" fill="#000" opacity=".14"/>
    <path d="M11 52h22c1 4-1 7-4 8H15c-3-1-5-4-4-8Z" fill="var(--brass)"/>
    <path d="M11 52h6c-.6 4 .2 7 1.6 8H15c-3-1-5-4-4-8Z" fill="#fff" opacity=".28"/>
    <path d="M20 60h4v16h-4Z" fill="var(--brass)"/>
    <ellipse cx="22" cy="66" rx="6" ry="3.4" fill="var(--brass)"/>
    <ellipse cx="22" cy="66" rx="6" ry="3.4" fill="#fff" opacity=".2"/>
    <path d="M18 76h8v8h-8Z" fill="var(--brass)"/>
    <path d="M8 84h28c2 5 3 10 3 16H5c0-6 1-11 3-16Z" fill="var(--brass)"/>
    <path d="M8 84h7c-1.4 5-2 10-2 16H5c0-6 1-11 3-16Z" fill="#fff" opacity=".26"/>
    <path d="M5 96h34v4H5Z" fill="#000" opacity=".2"/>` },

  lamp: { c:12, nm:'Oil lamp', vb:'3.5 6.5 49 93.5', size:[2,4], svg:`
    ${/* the chimney: a narrow throat that flares at the lip, the way a duplex
          burner's does — a bulb reads as a light bulb */''}
    <path d="M20 42c0-6 1.5-10 3-13-2-4-2.5-8 0-12 1.5-2.5 4-4 6-5 2 1 4.5 2.5 6 5
      2.5 4 2 8 0 12 1.5 3 3 7 3 13Z" fill="#fff" opacity=".22"/>
    <path d="M20 42c0-6 1.5-10 3-13-2-4-2.5-8 0-12 1.5-2.5 4-4 6-5 2 1 4.5 2.5 6 5
      2.5 4 2 8 0 12 1.5 3 3 7 3 13" fill="none" stroke="var(--ink, #2A2118)"
      stroke-width="1.4" opacity=".28"/>
    <path d="M23.5 40c0-5 1-9 2.4-12-1.6-3.4-2-7 0-10.6-2.6 3.6-2.6 7.6-1.4 11
      -1.6 3.4-2.6 7.4-2.6 11.6Z" fill="#fff" opacity=".55"/>
    <path d="M29 14c3.4 4.6 5 8 5 11a5 5 0 0 1-10 0c0-3 1.6-6.4 5-11Z" fill="var(--glow)"/>
    <path d="M29 19c1.7 2.4 2.5 4.2 2.5 5.8a2.5 2.5 0 0 1-5 0c0-1.6.8-3.4 2.5-5.8Z"
      fill="#fff" opacity=".7"/>
    <path d="M12 42h34v6H12Z" fill="var(--brass)"/>
    <path d="M12 42h34v2H12Z" fill="#fff" opacity=".34"/>
    <path d="M15 48h28c4 8 5 16 3 22H12c-2-6-1-14 3-22Z" fill="currentColor"/>
    <path d="M15 48h8c-3 8-4 16-3 22h-8c-2-6-1-14 3-22Z" fill="#fff" opacity=".18"/>
    <path d="M13 62h32" stroke="var(--glow)" stroke-width="1.6" opacity=".5"/>
    <path d="M20 70h18v10H20Z" fill="var(--brass)"/>
    <path d="M20 70h5v10h-5Z" fill="#fff" opacity=".24"/>
    <path d="M8 80h42c2 6 3 13 3 20H5c0-7 1-14 3-20Z" fill="var(--brass)"/>
    <path d="M8 80h8c-1.6 6-2.4 13-2.4 20H5c0-7 1-14 3-20Z" fill="#fff" opacity=".26"/>
    <path d="M5 96h48v4H5Z" fill="#000" opacity=".2"/>` },

  vase: { c:9, nm:'Dried stems', vb:'12.5 -3 51 103', size:[2,4], svg:`
    <g stroke="var(--brass)" stroke-width="2" fill="none" stroke-linecap="round" opacity=".85">
      <path d="M38 56V14"/><path d="M38 34c0-9 6-16 15-19"/><path d="M38 42c0-9-6-16-15-19"/>
      <path d="M38 26c0-6 4-12 9-15"/>
    </g>
    <g fill="currentColor">
      <ellipse cx="55" cy="13" rx="4.6" ry="8" transform="rotate(28 55 13)"/>
      <ellipse cx="21" cy="21" rx="4.2" ry="7.4" transform="rotate(-28 21 21)"/>
      <ellipse cx="49" cy="8" rx="3.8" ry="6.6" transform="rotate(20 49 8)"/>
      <ellipse cx="38" cy="6" rx="4.4" ry="8"/>
      <ellipse cx="30" cy="12" rx="3.4" ry="6" transform="rotate(-18 30 12)"/>
    </g>
    <path d="M26 54h24l3 6H23Z" fill="var(--brass)"/>
    <path d="M26 54h7l-4 6h-6Z" fill="#fff" opacity=".26"/>
    <path d="M23 60h30c8 12 9 26 4 34a8 8 0 0 1-6 3H25a8 8 0 0 1-6-3c-5-8-4-22 4-34Z" fill="currentColor"/>
    <path d="M23 60h9c-6 12-7 26-3 37h-4a8 8 0 0 1-6-3c-5-8-4-22 4-34Z" fill="#fff" opacity=".2"/>
    <g stroke="var(--glow)" stroke-width="1.3" opacity=".4" fill="none">
      <path d="M31 64c-4 10-5 22-3 33M45 64c4 10 5 22 3 33"/>
    </g>
    <path d="M25 97h26l-.4 3H25.4Z" fill="#000" opacity=".22"/>
    <path d="M20 92h36v4H20Z" fill="var(--brass)" opacity=".8"/>` },

  /* Carca's half of the story: the war is over and the machines tinker now.
     A gear is the one ornament here whose geometry has to be *right* — teeth
     eyeballed as a dozen little rectangles read as a cartoon sun — so the two
     wheels are generated: twelve teeth on the great one and nine on the pinion,
     each tooth a trapezoid struck between a root circle and a tip circle, and
     the two meshed at the pitch line rather than merely placed near each other.
     See decision 92. */
  cog: { c:12, nm:'Gearwork', vb:'8 8 92 88', size:[4,4], svg:`
    ${/* the pinion goes behind, so the great wheel reads as the near one */''}
    <path d="M88.9 71.3 L92.6 73.5 L91.0 78.0 L86.7 77.3 L85.1 79.3 L86.5 83.4 L82.4 85.8 L79.5 82.5 L77.0 83.0 L75.4 87.0 L70.7 86.2 L70.6 81.8 L68.4 80.6 L64.6 82.6 L61.6 79.0 L64.3 75.6 L63.4 73.2 L59.2 72.4 L59.2 67.6 L63.4 66.8 L64.3 64.4 L61.6 61.0 L64.6 57.4 L68.4 59.4 L70.6 58.2 L70.7 53.8 L75.4 53.0 L77.0 57.0 L79.5 57.5 L82.4 54.2 L86.5 56.6 L85.1 60.7 L86.7 62.7 L91.0 62.0 L92.6 66.5 L88.9 68.7 Z" fill="var(--brass)" opacity=".82"/>
    <circle cx="76" cy="70" r="9" fill="currentColor" opacity=".5"/>
    <circle cx="76" cy="70" r="3.4" fill="var(--brass)" opacity=".7"/>
    <path d="M73.9 43.8 L79.6 46.7 L78.0 52.8 L71.6 52.4 L69.8 55.5 L73.3 60.9 L68.9 65.3 L63.5 61.8 L60.4 63.6 L60.8 70.0 L54.7 71.6 L51.8 65.9 L48.2 65.9 L45.3 71.6 L39.2 70.0 L39.6 63.6 L36.5 61.8 L31.1 65.3 L26.7 60.9 L30.2 55.5 L28.4 52.4 L22.0 52.8 L20.4 46.7 L26.1 43.8 L26.1 40.2 L20.4 37.3 L22.0 31.2 L28.4 31.6 L30.2 28.5 L26.7 23.1 L31.1 18.7 L36.5 22.2 L39.6 20.4 L39.2 14.0 L45.3 12.4 L48.2 18.1 L51.8 18.1 L54.7 12.4 L60.8 14.0 L60.4 20.4 L63.5 22.2 L68.9 18.7 L73.3 23.1 L69.8 28.5 L71.6 31.6 L78.0 31.2 L79.6 37.3 L73.9 40.2 Z" fill="currentColor"/>
    <path d="M73.9 43.8 L79.6 46.7 L78.0 52.8 L71.6 52.4 L69.8 55.5 L73.3 60.9 L68.9 65.3 L63.5 61.8 L60.4 63.6 L60.8 70.0 L54.7 71.6 L51.8 65.9 L48.2 65.9 L45.3 71.6 L39.2 70.0 L39.6 63.6 L36.5 61.8 L31.1 65.3 L26.7 60.9 L30.2 55.5 L28.4 52.4 L22.0 52.8 L20.4 46.7 L26.1 43.8 L26.1 40.2 L20.4 37.3 L22.0 31.2 L28.4 31.6 L30.2 28.5 L26.7 23.1 L31.1 18.7 L36.5 22.2 L39.6 20.4 L39.2 14.0 L45.3 12.4 L48.2 18.1 L51.8 18.1 L54.7 12.4 L60.8 14.0 L60.4 20.4 L63.5 22.2 L68.9 18.7 L73.3 23.1 L69.8 28.5 L71.6 31.6 L78.0 31.2 L79.6 37.3 L73.9 40.2 Z" fill="none" stroke="var(--brass)" stroke-width="1.5" opacity=".55"/>
    ${/* the web of the wheel: a hub, a rim and four spokes, which is how one
         is cast and the only reason a gear reads as machined rather than as a
         cut-out star */''}
    <circle cx="50" cy="42" r="19" fill="var(--brass)" opacity=".22"/>
    <circle cx="50" cy="42" r="19" fill="none" stroke="var(--brass)" stroke-width="1.6" opacity=".6"/>
    <g stroke="var(--brass)" stroke-width="5" opacity=".85" stroke-linecap="round">
      <path d="M50 27v30M35 42h30M39.6 31.6 60.4 52.4M60.4 31.6 39.6 52.4"/>
    </g>
    <circle cx="50" cy="42" r="8" fill="var(--brass)"/>
    <circle cx="50" cy="42" r="8" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1"/>
    <circle cx="50" cy="42" r="3.6" fill="#000" opacity=".42"/>
    <circle cx="46.5" cy="38.5" r="2.6" fill="#fff" opacity=".34"/>
    ${/* a bench block, so the works stand on the shelf rather than float */''}
    <path d="M30 88h40l-3-6H33Z" fill="currentColor" opacity=".85"/>
    <path d="M30 88h40v6H30Z" fill="var(--brass)" opacity=".5"/>
    <path d="M30 92h40v2H30Z" fill="#000" opacity=".3"/>` },
  /* Girando's, and the core motif of it: a volute — but a volute is not a
     spiral on a post, it is the top of a **console bracket**, which is the
     thing actually holding up a Sicilian balcony. So the scroll sits on a
     flared S-profile body with an acanthus down its face and a plinth under
     it. The spiral itself is struck as an archimedean path of two and a half
     turns whose radius tapers as it goes — even turns, tightening to the eye —
     because a hand-drawn coil reads as wire. See decision 92. */
  volute: { c:12, nm:'Volute', vb:'20 6 64 92', size:[3,5], svg:`
    ${/* the plinth it stands on */''}
    <path d="M30 98h44v-9H30Z" fill="currentColor" opacity=".92"/>
    <path d="M30 89h44v2.4H30Z" fill="#fff" opacity=".18"/>
    <path d="M32 89h40v-4H32Z" fill="currentColor" opacity=".7"/>
    ${/* the bracket: flared at the top, gathered at the waist, flared again */''}
    <path d="M38 85C38 68 34 58 40 46L64 46C70 58 66 68 66 85Z"
      fill="currentColor" opacity=".62"/>
    <path d="M40 46C34 58 38 68 38 85h4C42 68 38 59 44 46Z" fill="#fff" opacity=".13"/>
    ${/* acanthus down the face of it, which is what a bare bracket lacks */''}
    <g fill="none" stroke="var(--glow)" stroke-width="1.9" opacity=".5" stroke-linecap="round">
      <path d="M52 50v32M52 58c-4-3-7-3-9-1M52 58c4-3 7-3 9-1
               M52 68c-4-3-7-3-9-1M52 68c4-3 7-3 9-1
               M52 78c-3-3-6-3-8-1M52 78c3-3 6-3 8-1"/>
    </g>
    ${/* and the scroll on top */''}
    <path d="M52.0 10.0 L54.2 10.3 L56.4 10.8 L58.5 11.5 L60.5 12.4 L62.3 13.6 L64.0 15.0 L65.5 16.5 L66.8 18.2 L68.0 20.0 L68.9 21.9 L69.5 23.9 L70.0 25.9 L70.2 27.9 L70.2 30.0 L70.0 32.0 L69.5 34.0 L68.8 35.9 L67.9 37.7 L66.9 39.3 L65.6 40.9 L64.2 42.2 L62.7 43.4 L61.1 44.4 L59.3 45.2 L57.5 45.8 L55.7 46.2 L53.9 46.4 L52.0 46.4 L50.2 46.2 L48.4 45.7 L46.7 45.1 L45.1 44.3 L43.6 43.3 L42.3 42.2 L41.0 41.0 L40.0 39.6 L39.1 38.1 L38.4 36.6 L37.9 34.9 L37.5 33.3 L37.4 31.6 L37.4 30.0 L37.6 28.4 L38.0 26.8 L38.6 25.3 L39.3 23.9 L40.2 22.6 L41.2 21.4 L42.3 20.3 L43.5 19.4 L44.8 18.6 L46.2 18.0 L47.6 17.6 L49.1 17.3 L50.6 17.2 L52.0 17.2 L53.4 17.4 L54.8 17.8 L56.1 18.3 L57.3 18.9 L58.5 19.7 L59.5 20.6 L60.4 21.6 L61.2 22.7 L61.9 23.8 L62.4 25.0 L62.7 26.2 L63.0 27.5 L63.1 28.8 L63.0 30.0 L62.8 31.2 L62.5 32.4 L62.0 33.5 L61.4 34.5 L60.8 35.5 L60.0 36.4 L59.1 37.1 L58.2 37.8 L57.2 38.3 L56.2 38.8 L55.2 39.0 L54.1 39.2 L53.0 39.3 L52.0 39.2 L51.0 39.0 L50.0 38.7 L49.1 38.3 L48.2 37.8 L47.4 37.2 L46.7 36.6 L46.1 35.9 L45.6 35.1 L45.2 34.3 L44.9 33.4 L44.7 32.6 L44.5 31.7 L44.5 30.8 L44.6 30.0 L44.8 29.2 L45.0 28.4 L45.4 27.7 L45.8 27.0 L46.3 26.4 L46.8 25.9 L47.4 25.4 L48.0 25.0 L48.7 24.7 L49.3 24.5 L50.0 24.4 L50.7 24.3 L51.4 24.3 L52.0 24.4 L52.6 24.6 L53.2 24.8 L53.7 25.1 L54.2 25.4 L54.6 25.8 L55.0 26.2 L55.3 26.7 L55.6 27.1 L55.8 27.6 L55.9 28.1 L56.0 28.6 L56.0 29.1 L55.9 29.6 L55.8 30.0 L55.6 30.4 L55.5 30.8 L55.2 31.1 L55.0 31.4 L54.7 31.7 L54.4 31.9 L54.1 32.1 L53.7 32.2 L53.4 32.2 L53.1 32.3 L52.8 32.3 L52.5 32.2 L52.2 32.1 L52.0 32.0" fill="none" stroke="currentColor" stroke-width="10"
      stroke-linecap="round" opacity=".95"/>
    <path d="M52.0 10.0 L54.2 10.3 L56.4 10.8 L58.5 11.5 L60.5 12.4 L62.3 13.6 L64.0 15.0 L65.5 16.5 L66.8 18.2 L68.0 20.0 L68.9 21.9 L69.5 23.9 L70.0 25.9 L70.2 27.9 L70.2 30.0 L70.0 32.0 L69.5 34.0 L68.8 35.9 L67.9 37.7 L66.9 39.3 L65.6 40.9 L64.2 42.2 L62.7 43.4 L61.1 44.4 L59.3 45.2 L57.5 45.8 L55.7 46.2 L53.9 46.4 L52.0 46.4 L50.2 46.2 L48.4 45.7 L46.7 45.1 L45.1 44.3 L43.6 43.3 L42.3 42.2 L41.0 41.0 L40.0 39.6 L39.1 38.1 L38.4 36.6 L37.9 34.9 L37.5 33.3 L37.4 31.6 L37.4 30.0 L37.6 28.4 L38.0 26.8 L38.6 25.3 L39.3 23.9 L40.2 22.6 L41.2 21.4 L42.3 20.3 L43.5 19.4 L44.8 18.6 L46.2 18.0 L47.6 17.6 L49.1 17.3 L50.6 17.2 L52.0 17.2 L53.4 17.4 L54.8 17.8 L56.1 18.3 L57.3 18.9 L58.5 19.7 L59.5 20.6 L60.4 21.6 L61.2 22.7 L61.9 23.8 L62.4 25.0 L62.7 26.2 L63.0 27.5 L63.1 28.8 L63.0 30.0 L62.8 31.2 L62.5 32.4 L62.0 33.5 L61.4 34.5 L60.8 35.5 L60.0 36.4 L59.1 37.1 L58.2 37.8 L57.2 38.3 L56.2 38.8 L55.2 39.0 L54.1 39.2 L53.0 39.3 L52.0 39.2 L51.0 39.0 L50.0 38.7 L49.1 38.3 L48.2 37.8 L47.4 37.2 L46.7 36.6 L46.1 35.9 L45.6 35.1 L45.2 34.3 L44.9 33.4 L44.7 32.6 L44.5 31.7 L44.5 30.8 L44.6 30.0 L44.8 29.2 L45.0 28.4 L45.4 27.7 L45.8 27.0 L46.3 26.4 L46.8 25.9 L47.4 25.4 L48.0 25.0 L48.7 24.7 L49.3 24.5 L50.0 24.4 L50.7 24.3 L51.4 24.3 L52.0 24.4 L52.6 24.6 L53.2 24.8 L53.7 25.1 L54.2 25.4 L54.6 25.8 L55.0 26.2 L55.3 26.7 L55.6 27.1 L55.8 27.6 L55.9 28.1 L56.0 28.6 L56.0 29.1 L55.9 29.6 L55.8 30.0 L55.6 30.4 L55.5 30.8 L55.2 31.1 L55.0 31.4 L54.7 31.7 L54.4 31.9 L54.1 32.1 L53.7 32.2 L53.4 32.2 L53.1 32.3 L52.8 32.3 L52.5 32.2 L52.2 32.1 L52.0 32.0" fill="none" stroke="var(--glow)" stroke-width="2.4"
      stroke-linecap="round" opacity=".72"/>
    <circle cx="52" cy="30" r="2.6" fill="var(--glow)" opacity=".85"/>` },
  bookend: { c:11, nm:'Bookend', vb:'2.5 11.5 93 88.5', size:[4,4], svg:`
    <path d="M12 34h8v58h-8Z" fill="var(--brass)"/>
    <path d="M12 34h3v58h-3Z" fill="#fff" opacity=".34"/>
    <path d="M12 84h46v8H12Z" fill="var(--brass)"/>
    <path d="M12 84h46v2.4H12Z" fill="#fff" opacity=".3"/>
    ${/* a scrolled finial, which is the Victorian half of a bookend */''}
    <path d="M16 34c0-7 1-11 4-13 4-2 8 0 8 4 0 3-2 5-5 5-2 0-3-1-3-2.5s1-2.5 2.5-2.5"
      fill="none" stroke="var(--brass)" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M27 40h11v44H27Z" fill="currentColor"/>
    <path d="M27 40h3.4v44H27Z" fill="#fff" opacity=".22"/>
    <path d="M40 34h9v50h-9Z" fill="currentColor" opacity=".78"/>
    <path d="M40 34h3v50h-3Z" fill="#fff" opacity=".2"/>
    <path d="M51 44h12v40H51Z" fill="currentColor" opacity=".9"/>
    <path d="M51 44h3.6v40H51Z" fill="#fff" opacity=".22"/>
    <path d="M65 38h10v46H65Z" fill="currentColor" opacity=".7"/>
    <path d="M65 38h3v46h-3Z" fill="#fff" opacity=".2"/>
    <path d="M77 46h9v38h-9Z" fill="currentColor" opacity=".84"/>
    <g stroke="var(--glow)" stroke-width="1.6" opacity=".7">
      <path d="M29 50h7M42 44h5M53 54h8M67 48h6M79 56h5M29 58h7M42 52h5M53 62h8"/>
    </g>
    <path d="M60 84h32v8H60Z" fill="#000" opacity=".1"/>
    <path d="M4 92h92v8H4Z" fill="var(--brass)"/>
    <path d="M4 92h92v2.4H4Z" fill="#fff" opacity=".3"/>
    <path d="M4 96h92v4H4Z" fill="#000" opacity=".2"/>` }
};

const DECOR_KEYS = Object.keys(DECOR);
const decorOf = o => (DECOR[o && o.decor] ? o.decor : 'plant');
/* The artwork, as markup. Each states its own viewBox, tight to itself, and
   `xMidYMax` stands it on the floor of whatever box it is drawn into — so a
   row of them lines up along one shelf however differently proportioned they
   are. A built-in is inlined so it can read the style; an uploaded file is an
   <img>, because a picture somebody chose has no business being repainted. */
function decorSVG(name){
  const d = DECOR[name] || DECOR.plant;
  return `<svg class="decart" viewBox="${d.vb}" preserveAspectRatio="xMidYMax meet"
    aria-hidden="true">${d.svg}</svg>`;
}

export { DECOR, DECOR_KEYS, decorOf, decorSVG };
