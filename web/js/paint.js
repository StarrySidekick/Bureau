import { $, esc, ic } from './util.js';
import { S, K, byId, isContainer, faceOf, shapeOf, KNOBSIZES, knobSizeOf } from './model.js';
import { pushSet, pushSets, toast } from './mutations.js';
import { save } from './persist.js';
import { render } from './views.js';
import { sampleTile, closePanel } from './panels.js';
import { KSHAPES, kshapeOf } from './tiles.js';
import { isActive, CARDART, backHTML } from './active.js';
import { hexOf, objColour } from './look.js';
import { lay } from './grid.js';

/* ============================================================
   a custom look, drawn by hand — decision 271
   ============================================================
   Timothy: Edit Look has a button, *Draw a custom look*, that opens a painter
   with the drawer front, the book spine or the card face large in the view,
   to draw on with a finger. Zoom in for detail; a mirror makes things look
   good fast; a pencil in the palette colours with a sketchy line, gold or
   silver embossing, a pen and paint; a few filigree decals made in advance;
   and on a spine the curvature is applied afterwards so the design sits on
   the round of the back.

   **What is stored is strokes, not pixels.** `o.art` is `{w, h, s}`: a
   coordinate space of 250 units to a cell of the face as it was when it was
   drawn, and a list of strokes, each `{t, c, w, m, p}` — the tool, its
   colour (a hex, or a metal for the emboss), its width in those units, which
   mirror was on, and the points as one flat list of whole numbers. That is
   what lets every one of the asks above be cheap:

   - **A drawing is sharp at any size**, on a 2×3 card on the desk and on the
     same card full screen, because it is one SVG in the tile scaled to fit.
   - **The mirror is kept per stroke** and applied when drawn, so turning it
     off does not unmirror what you already drew with it on.
   - **A decal is strokes too.** The filigree is generated as polylines, so a
     stamped scroll is drawn in whatever the tool is — a gold emboss scroll, a
     pencilled one — and mirrors and bends with everything else.
   - **The spine's curve is a mapping of the points**, not a filter: across
     the width of a standing spine (down the height of a lying one) a point is
     put where it would land on a half-cylinder seen face on, so the design
     crowds towards the edges the way print on a round back does. The painter
     draws it flat, because that is how you draw on it; Preview shows it bent.

   **No bytes anywhere but the JSON.** A picture goes to IndexedDB (decision
   42) because a photograph is megabytes; a drawing is a few hundred numbers
   a stroke and stays in the object, where undo, export and the flows already
   carry everything else about it.

   The painter is its own host, `#paint`, beside `#app` the way the setup card
   is, so the board behind it is untouched and a stroke redraws only the
   drawing. Pointer events are claimed on the stage, which is outside every
   `.grid`, so gestures.js never sees them. */

/* A cell of the face is 250 units, so a stroke's width means the same thing
   on a one-cell spine and an eight-cell front: it is a fraction of a cell,
   not of whatever the face happens to measure across. */
const CELL_U = 250;

/* Which of the three a thing is, or null when it is none of them. A card is
   the playing-card shape on paper; a spine is the face; a front is a
   container wearing the plain drawer face that is not an instrument. */
function paintTarget(o){
  if(!o) return null;
  if(!isContainer(o)) return shapeOf(o)==='playcard' ? 'card' : null;
  if(isActive(o)) return null;
  const f = faceOf(o);
  return f==='spine' ? 'spine' : f==='front' ? 'front' : null;
}
const hasArt = o => !!(o && o.art && Array.isArray(o.art.s) && o.art.s.length);

/* ---- the tools ----------------------------------------------------------
   Four that draw and one that takes away. Each is a width (in art units,
   250 to a cell), how it is stroked and which filter from
   index.html it is drawn through — one filter per **run** of strokes with
   the same tool, never one per stroke, because a filter is a fixed cost per
   element per repaint (decision 101's finding). */
const TOOLS = {
  pencil:{nm:'Pencil', ic:'edit',    w:6,  sizes:[3,6,10,16]},
  pen:   {nm:'Pen',    ic:'feather', w:8,  sizes:[4,8,14,22]},
  paint: {nm:'Paint',  ic:'drop',    w:34, sizes:[16,34,60,100]},
  emboss:{nm:'Emboss', ic:'star',    w:14, sizes:[8,14,24,40]},
  erase: {nm:'Eraser', ic:'cut',     w:30, sizes:[14,30,60,110]},
  decal: {nm:'Filigree', ic:'sparkle', w:8, sizes:[5,8,12,18]}
};
/* The metals. Each is a gradient in index.html in user space and reflected,
   so it bands across the drawing the way light runs over foil — and one
   gradient serves every drawing, because every drawing is measured in the
   same units. */
const METALS = {gold:'Gold', silver:'Silver', copper:'Copper', rose:'Rose gold'};
const MIRRORS = {'':'Mirror off', v:'Left and right', h:'Top and bottom', vh:'Four ways'};

/* ---- the filigree -------------------------------------------------------
   Every decal is a list of polylines in a box from -1 to 1, generated rather
   than drawn, so each is a few lines of arithmetic and scales to any size
   without a single stored point. Stamped, they become ordinary strokes. */
const TAU = Math.PI*2;
function spiral(cx, cy, r0, turns, dir, a0){
  const pts = [], n = Math.max(12, Math.round(turns*40));
  for(let i=0;i<=n;i++){
    const f = i/n, a = a0 + dir*f*turns*TAU, r = r0*(1-f*.92);
    pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]);
  }
  return pts;
}
const bez = (p0,p1,p2,p3,n=24)=>Array.from({length:n+1},(_,i)=>{ const t=i/n, u=1-t;
  return [u*u*u*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0], u*u*u*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]]; });
const ring = (cx,cy,rx,ry,n=48)=>Array.from({length:n+1},(_,i)=>[cx+Math.cos(i/n*TAU)*rx, cy+Math.sin(i/n*TAU)*ry]);
const leaf = (x,y,a,l,wd)=>{ const c=Math.cos(a), s=Math.sin(a), px=-s, py=c;
  const tip=[x+c*l, y+s*l];
  return [...bez([x,y],[x+c*l*.3+px*wd,y+s*l*.3+py*wd],[x+c*l*.7+px*wd,y+s*l*.7+py*wd],tip,12),
          ...bez(tip,[x+c*l*.7-px*wd,y+s*l*.7-py*wd],[x+c*l*.3-px*wd,y+s*l*.3-py*wd],[x,y],12)]; };
const DECALS = {
  scroll:{nm:'Scroll', make:()=>[
    [...spiral(-.55,.05,.42,1.6,-1,Math.PI*.5).reverse(), ...bez([-.55,.47],[-.1,.5],[.1,-.5],[.55,-.47]), ...spiral(.55,-.05,.42,1.6,-1,-Math.PI*.5)]]},
  curl:{nm:'Curl', make:()=>[[...bez([-1,.8],[-.6,.9],[-.1,.7],[.2,.2]), ...spiral(.35,-.1,.36,1.8,-1,Math.PI*.75)]]},
  corner:{nm:'Corner', make:()=>[
    [...bez([-1,-.2],[-1,-.8],[-.8,-1],[-.2,-1])],
    [...bez([-.2,-1],[.3,-1],[.55,-.85],[.55,-.55]), ...spiral(.4,-.55,.16,1.3,1,0)],
    [...bez([-1,-.2],[-1,.3],[-.85,.55],[-.55,.55]), ...spiral(-.55,.4,.16,1.3,-1,Math.PI*.5)],
    leaf(-.8,-.8,Math.PI/4,.75,.16)]},
  rosette:{nm:'Rosette', make:()=>{
    const petals = Array.from({length:161},(_,i)=>{ const a=i/160*TAU, r=.35+.6*Math.abs(Math.cos(4*a)); return [Math.cos(a)*r, Math.sin(a)*r]; });
    return [petals, ring(0,0,.3,.3), ring(0,0,.12,.12,24)]; }},
  vine:{nm:'Vine', make:()=>{
    const stem = Array.from({length:81},(_,i)=>{ const x=-1+i/40; return [x, Math.sin(x*Math.PI*1.5)*.22]; });
    const out=[stem];
    [-.66,0,.66].forEach((x,k)=>{ const y=Math.sin(x*Math.PI*1.5)*.22, up=k%2?1:-1;
      out.push(leaf(x,y,up*Math.PI/2.6,.5,.13)); out.push(spiral(x+.2,y-up*.35,.14,1.2,up,0)); });
    return out; }},
  fleur:{nm:'Fleur', make:()=>[
    [...bez([0,.35],[-.28,.05],[-.16,-.6],[0,-1]), ...bez([0,-1],[.16,-.6],[.28,.05],[0,.35])],
    [...bez([-.08,.2],[-.5,.1],[-.9,-.4],[-.6,-.6]), ...spiral(-.5,-.42,.16,1.1,1,Math.PI*1.2)],
    [...bez([.08,.2],[.5,.1],[.9,-.4],[.6,-.6]), ...spiral(.5,-.42,.16,1.1,-1,-Math.PI*.2)],
    [[-.4,.35],[.4,.35]], [[-.36,.48],[.36,.48]],
    [...bez([0,.48],[-.05,.7],[-.3,.85],[-.45,1])], [...bez([0,.48],[.05,.7],[.3,.85],[.45,1])]]},
  laurel:{nm:'Laurel', make:()=>{
    const stem = bez([-.1,1],[-.9,.4],[-.8,-.5],[-.1,-1]);
    const out=[stem];
    for(let i=2;i<stem.length-1;i+=3){ const [x,y]=stem[i], [nx,ny]=stem[i+1], a=Math.atan2(ny-y,nx-x);
      out.push(leaf(x,y,a-.9,.28,.07)); out.push(leaf(x,y,a+.9,.28,.07)); }
    return out; }},
  star:{nm:'Star', make:()=>[Array.from({length:17},(_,i)=>{ const a=i/16*TAU-Math.PI/2, r=i%2?.42:1; return [Math.cos(a)*r, Math.sin(a)*r]; })]},
  /* The one that ignores where you pressed: a border round the whole face,
     inset, with a loop at each corner — the frame a hand-decorated card has. */
  border:{nm:'Border', fits:true, make:(W,H)=>{
    const i = Math.min(W,H)*.07, r = Math.min(W,H)*.05;
    const box = [[i+r,i],[W-i-r,i]], out=[box, [[W-i,i+r],[W-i,H-i-r]], [[W-i-r,H-i],[i+r,H-i]], [[i,H-i-r],[i,i+r]]];
    [[i,i,1,1],[W-i,i,-1,1],[W-i,H-i,-1,-1],[i,H-i,1,-1]].forEach(([x,y,sx,sy])=>{
      out.push(ring(x+sx*r*.2,y+sy*r*.2,r*.9,r*.9,28));
      out.push(bez([x+sx*r,y],[x+sx*r*2,y+sy*r*.2],[x+sx*r*2,y+sy*r*1.4],[x+sx*r*1.1,y+sy*r*1.9],10));
    });
    return out; }}
};

/* ---- drawing it ---------------------------------------------------------
   A stroke's points, and its mirrored copies, and the warp — all as point
   lists, then one smoothed path each. */
const pairs = p => { const out=[]; for(let i=0;i+1<p.length;i+=2) out.push([p[i],p[i+1]]); return out; };
function copies(st, W, H){
  const base = pairs(st.p), out=[base];
  const m = st.m || '';
  if(m.includes('v')) out.push(base.map(([x,y])=>[W-x,y]));
  if(m.includes('h')) out.push(base.map(([x,y])=>[x,H-y]));
  if(m==='vh') out.push(base.map(([x,y])=>[W-x,H-y]));
  return out;
}
/* A half-cylinder seen face on. `A` is how much of the round shows — about
   a hundred and thirty degrees, which is what a bound back shows you — and a
   point at `u` across it lands at the sine of its angle. */
const ARC = 2.3;
function bend(pts, W, H, axis){
  const S2 = 2*Math.sin(ARC/2);
  return pts.map(([x,y])=> axis==='y'
    ? [x, H*(.5 + Math.sin((y/H-.5)*ARC)/S2)]
    : [W*(.5 + Math.sin((x/W-.5)*ARC)/S2), y]);
}
// the points as a path, through the midpoints, so a finger's line is a curve
function pathOf(pts){
  if(!pts.length) return '';
  const f = n => Math.round(n*10)/10;
  if(pts.length<3) return `M${f(pts[0][0])} ${f(pts[0][1])}` + pts.slice(1).map(p=>`L${f(p[0])} ${f(p[1])}`).join('')
    + (pts.length===1 ? `l.1 0` : '');
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for(let i=1;i<pts.length-1;i++){
    const [x,y]=pts[i], [nx,ny]=pts[i+1];
    d += `Q${f(x)} ${f(y)} ${f((x+nx)/2)} ${f((y+ny)/2)}`;
  }
  const l = pts[pts.length-1];
  return d + `L${f(l[0])} ${f(l[1])}`;
}
const inkOf = st => st.t==='emboss' ? `url(#pt-${METALS[st.c]?st.c:'gold'})` : esc(st.c||'#241E16');
/* One stroke as SVG. A pencil stroke is drawn twice, the second a hair off
   and fainter, which is what makes it read as sketched rather than ruled. */
function strokeSVG(st, W, H, warp){
  const lines = copies(st, W, H).map(p => warp ? bend(p, W, H, warp) : p);
  const w = +st.w || TOOLS[st.t].w;
  const ink = inkOf(st);
  return lines.map(p=>{
    const d = pathOf(p);
    if(st.t==='pencil') return `<path d="${d}" stroke="${ink}" stroke-width="${w}" opacity=".82"/>`
      + `<path d="${d}" stroke="${ink}" stroke-width="${(w*.55).toFixed(1)}" opacity=".4" transform="translate(${(w*.35).toFixed(1)} ${(-w*.25).toFixed(1)})"/>`;
    if(st.t==='paint') return `<path d="${d}" stroke="${ink}" stroke-width="${w}" opacity=".86"/>`;
    return `<path d="${d}" stroke="${ink}" stroke-width="${w}"/>`;
  }).join('');
}
// consecutive strokes of one tool share a group, and so one filter
function strokesSVG(list, W, H, warp){
  let out = '', run = null, buf = '';
  const flush = ()=>{ if(run) out += `<g class="pt-${run}"${run==='pen' ? '' : ` filter="url(#pt-f-${run})"`}>${buf}</g>`; buf=''; };
  list.forEach(st=>{
    if(!TOOLS[st.t] || st.t==='erase' || st.t==='decal') return;
    if(st.t!==run){ flush(); run = st.t; }
    buf += strokeSVG(st, W, H, warp);
  });
  flush();
  return out;
}
/* The layer a tile carries. `where` is the target; a spine standing up bends
   across its width, and one lying down (wider than it is tall, decision 124)
   down its height. */
function artLayer(o, where, box){
  if(!hasArt(o)) return '';
  const a = o.art, W = a.w || CELL_U, H = a.h || CELL_U;
  const warp = where==='spine' ? ((box && box.w > box.h) ? 'y' : 'x') : null;
  const body = strokesSVG(a.s, W, H, warp);
  /* On the round, the drawing also **turns away** at the edges: a mask that
     fades it towards both sides of the back, on the same axis as the bend,
     so where the binding's own shading goes dark the drawing goes with it.
     Its ids are the object's, so two drawings never share one. */
  const round = warp ? (()=>{ const id = 'ar'+String(o.id).replace(/[^\w-]/g,'');
    const [x2, y2] = warp==='y' ? [0, H] : [W, 0];
    return {defs:`<defs><linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${x2}" y2="${y2}">
        <stop offset="0" stop-color="#333"/><stop offset=".14" stop-color="#B4B4B4"/><stop offset=".36" stop-color="#FFF"/>
        <stop offset=".62" stop-color="#F0F0F0"/><stop offset=".86" stop-color="#9A9A9A"/><stop offset="1" stop-color="#2A2A2A"/></linearGradient>
      <mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
        <rect width="${W}" height="${H}" fill="url(#${id}g)"/></mask></defs>`, mask:` mask="url(#${id}m)"`}; })() : null;
  return `<svg class="artlayer art-${where}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
    aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">${
      round ? `${round.defs}<g${round.mask}>${body}</g>` : body}</svg>`;
}

/* ============================================================
   the painter
   ============================================================ */
const PT = {id:null};
const paintOpen = ()=> !!PT.id;
// the palette: the sixteen slots of this aesthetic, and black and white
const inks = ()=> ['#1B1712', '#FFFFFF', ...Array.from({length:16},(_,i)=>hexOf(i))]
  .filter((c,i,a)=>a.indexOf(c)===i);

function openPaint(id){
  const o = byId(id), where = paintTarget(o);
  if(!o || !where) return;
  closePanel();
  // a thing made a moment ago has no box yet, and the face is drawn from one
  if(!o.desk && !o.phone) render();
  const b = lay(o), W = CELL_U * Math.max(1, b.w), H = CELL_U * Math.max(1, b.h);
  // a drawing made at another aspect is kept in its own space and stretched
  // to the face, which is what the tile does with it too
  const a = hasArt(o) ? JSON.parse(JSON.stringify(o.art)) : {w:W, h:H, s:[]};
  Object.assign(PT, {id, where, box:{w:b.w, h:b.h}, W:a.w||W, H:a.h||H, strokes:a.s, redo:[],
    tool:PT.tool||'pencil', ink:PT.ink||'#1B1712', metal:PT.metal||'gold', sizeAt:PT.sizeAt||{},
    mirror:PT.mirror||'', decal:PT.decal||'scroll', preview:false, z:1, x:0, y:0, was:o.art||null,
    mode:'draw', face:{}, ang:-28, tilt:-14, spin:true});
  let host = $('#paint');
  if(!host){ $('#frame').insertAdjacentHTML('beforeend', '<div id="paint" class="paint"></div>'); host = $('#paint'); }
  drawPainter();
}
function closePaint(keep){
  const o = byId(PT.id);
  const faced = Object.keys(PT.face||{});
  if(keep && o){
    const clone = v => v==null ? v : JSON.parse(JSON.stringify(v));
    pushSets(faced.length ? 'Changed its look' : 'Drew on it',
      [[o.id, 'art', clone(PT.was)], ...faced.map(k=>[o.id, k, clone(o[k])])]);
    if(PT.strokes.length) o.art = {w:PT.W, h:PT.H, s:PT.strokes};
    else delete o.art;
    // what the Face mode changed (decision 300); null means back to the type's
    faced.forEach(k=>{ const v = PT.face[k]; if(v==null || v==='') delete o[k]; else o[k] = clone(v); });
    save();
  }
  spinStop();
  PT.id = null;
  const host = $('#paint'); if(host) host.remove();
  render();
  if(keep && o) toast(faced.length ? 'Look kept' : PT.strokes.length ? 'Drawn on' : 'Drawing taken off', true);
}
const widthOf = t => { const i = PT.sizeAt[t]; const s = TOOLS[t].sizes; return s[i!=null ? i : 1]; };

/* The face, drawn by the same `sampleTile()` every preview is, from a copy
   with the drawing taken off — the live strokes are the overlay above it —
   or, previewing, with the drawing on and bent the way the tile bends it.
   Buttons become spans so nothing on the face answers a press. */
function faceHTML(o, fw, fh){
  // at the corner of a board of its own, as the setup card draws one
  const at1 = b => b ? Object.assign({}, b, {x:1, y:1}) : b;
  const c = Object.assign({}, o, PT.face || {}, {desk:at1(o.desk), phone:at1(o.phone), setup:null,
    art: PT.preview || PT.mode!=='draw' ? {w:PT.W, h:PT.H, s:PT.strokes} : null});
  Object.keys(PT.face || {}).forEach(k=>{ if(PT.face[k]==null || PT.face[k]==='') delete c[k]; });
  return sampleTile(c, fw, fh, 40).replace(/<(\/?)button\b/g, '<$1span')
    .replace(/\sdata-(drawer|row|fieldfor)="[^"]*"/g, '')
    .replace(/<input\b[^>]*>|<textarea\b[^>]*>[\s\S]*?<\/textarea>/g, '');
}
function fitSize(){
  const st = $('#paint .ptstage');
  const sw = st ? st.clientWidth : innerWidth, sh = st ? st.clientHeight : innerHeight*.6;
  const k = Math.min((sw-32)/PT.box.w, (sh-32)/PT.box.h);
  return [PT.box.w*k, PT.box.h*k];
}
function drawPainter(){
  const host = $('#paint'), o = byId(PT.id); if(!host || !o) return;
  const t = PT.tool;
  const chip = (attr, v, label, on, extra) => `<button class="ptchip${on?' on':''}" data-${attr}="${esc(v)}"${extra||''}>${label}</button>`;
  host.innerHTML = `<div class="pthead">
      <button class="iconbtn" data-pt="cancel" title="Put it down without keeping it">${ic('x',16)}</button>
      <span class="ptmodes">${MODES.filter(([k])=>k!=='face' || PT.where==='front').map(([k, nm])=>
        `<button class="ptmode${PT.mode===k?' on':''}" data-ptmode="${k}">${nm}</button>`).join('')}</span>
      <div style="flex:1"></div>
      ${PT.mode==='draw' ? `<button class="iconbtn" data-pt="undo" title="Undo a stroke"${PT.strokes.length?'':' disabled'}>${ic('undo',15)}</button>
      <button class="iconbtn ptredo" data-pt="redo" title="Redo"${PT.redo.length?'':' disabled'}>${ic('undo',15)}</button>
      <button class="iconbtn${PT.preview?' on':''}" data-pt="preview" title="See it as it will be on the desk">${ic('eye',15)}</button>
      <button class="iconbtn" data-pt="clear" title="Take everything off">${ic('trash',15)}</button>` : ''}
      <button class="pill ptdone" data-pt="done">${ic('check',13)}<span>Done</span></button>
    </div>
    <div class="ptstage${PT.mode==='3d' ? ' pt3dstage' : PT.mode==='face' ? ' ptfacestage' : ''}">
      ${PT.mode==='3d' ? '<div class="p3scene"></div>' : '<div class="ptcan"></div>'}
      <div class="ptzoom"${PT.mode==='draw' ? '' : ' hidden'}>
        <button class="iconbtn" data-pt="zin" title="Closer">+</button>
        <button class="iconbtn" data-pt="zfit" title="The whole face">${ic('expand',13)}</button>
        <button class="iconbtn" data-pt="zout" title="Further">&minus;</button>
      </div>
    </div>
    ${PT.mode!=='draw' ? faceTools(o) : `<div class="pttools">
      <div class="ptrow">${Object.entries(TOOLS).map(([k,d])=>chip('pttool', k, `${ic(d.ic,14)}<span>${d.nm}</span>`, k===t)).join('')}</div>
      <div class="ptrow">
        <span class="ptsizes">${TOOLS[t].sizes.map((s,i)=>chip('ptsize', i, `<i style="--d:${Math.max(3, Math.min(22, s/3))}px"></i>`, widthOf(t)===s, ` title="Size ${i+1}"`)).join('')}</span>
        ${chip('ptmirror', PT.mirror, `${ic('swap',14)}<span>${MIRRORS[PT.mirror]}</span>`, !!PT.mirror)}
      </div>
      <div class="ptrow ptinks">${t==='emboss'
        ? Object.entries(METALS).map(([k,n])=>chip('ptmetal', k, `<i class="ptmetal m-${k}"></i><span>${n}</span>`, PT.metal===k)).join('')
        : t==='erase' ? `<span class="ptsay">Drag over a stroke to take it off</span>`
        : inks().map(c=>`<button class="ptink${PT.ink===c?' on':''}" data-ptink="${c}" style="--k:${c}" title="${c}"></button>`).join('')}</div>
      ${t==='decal' ? `<div class="ptrow ptdecals">${Object.entries(DECALS).map(([k,d])=>
          chip('ptdecal', k, `<svg viewBox="-1.2 -1.2 2.4 2.4" fill="none" stroke="currentColor" stroke-width=".09" stroke-linecap="round">${
            (d.fits ? d.make(2,2).map(p=>p.map(([x,y])=>[x-1,y-1])) : d.make()).map(p=>`<path d="${pathOf(p)}"/>`).join('')}</svg><span>${d.nm}</span>`, PT.decal===k)).join('')}
        </div>
        <div class="ptrow"><span class="ptsay">Press the face to stamp it, in ${PT.ink==='#FFFFFF'?'white':'the ink above'}${''}. Pick Emboss first for a gold one.</span></div>` : ''}
    </div>`}`;
  if(PT.mode==='3d'){ draw3d(); spinGo(); } else { spinStop(); drawCanvas(); }
}
const MODES = [['draw','Draw'], ['face','Face'], ['3d','3D']];
/* ---- the face's own settings — decision 300 ---------------------------
   Timothy: "edit the text and knob and face settings in that visual mode as
   well, and move the knob and text wherever." The rows the editor's Look
   door has for a front, drawn here over the face so a change is seen on it
   at once, in Face mode flat and in 3D turning. They write a **draft**
   (`PT.face`), kept on Done and thrown away on Cancel, like the strokes. */
const faceVal = (o, k) => (PT.face && k in PT.face) ? PT.face[k] : o[k];
function faceTools(o){
  const front = PT.where==='front';
  const chip = (k, v, label, on, extra) => `<button class="ptchip${on?' on':''}" data-ptface="${k}" data-v="${esc(String(v))}"${extra||''}>${label}</button>`;
  const ks = faceVal(o, 'kshape') || kshapeOf(o) || 'round', sz = faceVal(o, 'knobsize') || knobSizeOf(o);
  const tone = faceVal(o, 'knobtone') || '', c = faceVal(o, 'c');
  const say = PT.mode==='3d' ? 'Drag it to turn it.' : front ? 'Drag the knob or the name to put it anywhere.' : '';
  return `<div class="pttools ptfacetools">
    <div class="ptrow"><input class="ptname" data-ptname value="${esc(faceVal(o, 'title') || '')}" placeholder="Its name" autocomplete="off"></div>
    <div class="ptrow ptinks">${Array.from({length:16}, (_, i)=>`<button class="ptink${+c===i?' on':''}" data-ptface="c" data-v="${i}"
      style="--k:${hexOf(i)}" title="Color ${i+1}"></button>`).join('')}</div>
    ${front ? `<div class="ptrow ptscroll">${Object.entries(KSHAPES).map(([k, n])=>chip('kshape', k, `<span>${esc(n.replace(/\s*\(.*\)/, ''))}</span>`, ks===k)).join('')}</div>
    <div class="ptrow">${Object.entries(KNOBSIZES).map(([k, n])=>chip('knobsize', k, `<span>${n}</span>`, sz===k)).join('')}
      <span class="ptgap"></span>${[['','Wood'],['light','Lighter'],['dark','Darker']].map(([k, n])=>chip('knobtone', k, `<span>${n}</span>`, tone===k)).join('')}</div>` : ''}
    <div class="ptrow"><span class="ptsay">${say}</span>${front && PT.mode==='face' ? `<span class="ptgap"></span>${
      chip('reset', 'knobAt', '<span>Knob back</span>', false)}${chip('reset', 'nameAt', '<span>Name back</span>', false)}` : ''}
      ${PT.mode==='3d' ? `<span class="ptgap"></span>${chip('spin', '', `<span>${PT.spin ? 'Stop turning' : 'Turn'}</span>`, PT.spin)}` : ''}</div>
  </div>`;
}

/* ---- the turning model — decision 300 ---------------------------------
   Timothy: "see the drawer in 3d like a [cute] nintendo 64 model rotating."
   A box of flat-shaded faces in CSS 3D (no library): each side is one colour
   a step darker than the last, the way a low-poly model is lit, on a checked
   floor under a sky, with a round shadow. A drawer is its front, a slab with
   edges, on a box narrower than it with the top open; a card is a thin slab
   with its back on the back; a spine is a book, covers either side and the
   pages on top, bottom and fore-edge. The face is the face, drawing and all.
   It turns by itself (one transform a frame on one element, never a
   render) until a finger takes it. */
function box3(w, h, d, fill, cls){
  const f = (cl, fw, fh, tf, bg) => `<i class="p3f ${cl}" style="width:${fw}px;height:${fh}px;margin:${-fh/2}px 0 0 ${-fw/2}px;
    transform:${tf};${bg}"></i>`;
  return `<b class="p3box ${cls||''}">`
    + f('p3r', d, h, `rotateY(90deg) translateZ(${w/2}px)`, fill.r)
    + f('p3l', d, h, `rotateY(-90deg) translateZ(${w/2}px)`, fill.l)
    + f('p3t', w, d, `rotateX(90deg) translateZ(${h/2}px)`, fill.t)
    + f('p3b', w, d, `rotateX(-90deg) translateZ(${h/2}px)`, fill.b)
    + (fill.k ? f('p3k', w, h, `rotateY(180deg) translateZ(${d/2}px)`, fill.k) : '')
    + (fill.f ? f('p3n', w, h, `translateZ(${d/2}px)`, fill.f) : '')
    + `</b>`;
}
const shade = (c, k) => `background:color-mix(in srgb, ${c} ${Math.round(k*100)}%, #000)`;
function draw3d(){
  const sc = $('#paint .p3scene'), o = byId(PT.id); if(!sc || !o) return;
  const st = $('#paint .ptstage'), sw = st ? st.clientWidth : innerWidth, sh = st ? st.clientHeight : innerHeight*.6;
  const k = Math.min(sw*.38/PT.box.w, sh*.36/PT.box.h), W = PT.box.w*k, H = PT.box.h*k;
  let mid = 0;   // how far forward the whole model moves so it turns about its middle
  const c = objColour(Object.assign({}, o, PT.face && 'c' in PT.face ? {c:PT.face.c} : {}));
  const face = `<div class="p3face" style="width:${W}px;height:${H}px;margin:${-H/2}px 0 0 ${-W/2}px">${faceHTML(o, W, H)}</div>`;
  let model;
  if(PT.where==='front'){
    const D = Math.min(W, H) * .9, T = Math.max(6, Math.min(W, H) * .07);
    mid = D/2;
    const bw = W*.88, bh = H*.84;
    // the box behind the front, open at the top: its top face is the inside, seen down into
    model = `<b class="p3drawer" style="transform:translateZ(${-D/2 - T/2}px)">${box3(bw, bh, D, {
        r:shade(c, .62), l:shade(c, .5), b:shade(c, .4), k:shade(c, .55),
        t:`background:color-mix(in srgb, ${c} 30%, #000);box-shadow:inset 0 0 0 ${Math.max(3, T*.6)}px color-mix(in srgb, ${c} 80%, #000)`}, 'p3open')}</b>`
      + `<b class="p3slab">${box3(W, H, T, {r:shade(c, .7), l:shade(c, .6), t:shade(c, .9), b:shade(c, .45), k:shade(c, .5)})}</b>`
      + `<b class="p3front" style="transform:translateZ(${T/2 + .5}px)">${face}</b>`;
  } else if(PT.where==='card'){
    const T = Math.max(3, W * .025);
    model = `<b class="p3slab">${box3(W, H, T, {r:'background:#E8E1CF', l:'background:#D9D1BC', t:'background:#F1EBDC', b:'background:#CFC6AE',
        // no back face: the printed back is it, and two planes that close fight
        k:null})}</b>`
      + `<b class="p3front" style="transform:translateZ(${T/2 + .5}px)">${face}</b>`
      + `<b class="p3back" style="transform:rotateY(180deg) translateZ(${T/2 + .5}px)"><div class="p3face" style="width:${W}px;height:${H}px;margin:${-H/2}px 0 0 ${-W/2}px">
          <div class="dkcard down" style="--c:${c};width:100%;height:100%">${backHTML(o.back || K(o.kind).back)}</div></div></b>`;
  } else {
    // a book standing: the spine is the face, the covers its sides, the pages the rest
    const D = Math.min(H * .72, W * 5);
    mid = 0;
    const pages = 'background:#EFE7D2;background-image:repeating-linear-gradient(90deg, rgba(0,0,0,.07) 0 1px, transparent 1px 3px)';
    model = `<b class="p3slab">${box3(W, H, D, {r:shade(c, .62), l:shade(c, .5), t:pages, b:pages,
        k:'background:#E9E0C8;background-image:repeating-linear-gradient(0deg, rgba(0,0,0,.06) 0 1px, transparent 1px 3px)'})}</b>`
      + `<b class="p3front" style="transform:translateZ(${D/2 + .5}px)">${face}</b>`;
  }
  sc.innerHTML = `<div class="p3sky"></div><div class="p3floor"></div>
    <div class="p3stand"><i class="p3shadow" style="width:${Math.max(W, H*.6)*1.3}px;top:${H/2 + Math.min(W, H)*.35}px"></i>
      <div class="p3obj" style="transform:rotateX(${PT.tilt}deg) rotateY(${PT.ang}deg)"><b style="transform:translateZ(${mid}px)">${model}</b></div></div>`;
}
const S3 = {raf:0, at:0, drag:null};
function turn(){
  const ob = $('#paint .p3obj'); if(ob) ob.style.transform = `rotateX(${PT.tilt}deg) rotateY(${PT.ang}deg)`;
}
function spinGo(){
  if(S3.raf) return;
  S3.at = performance.now();
  const step = now => {
    if(!PT.id || PT.mode!=='3d'){ S3.raf = 0; return; }
    const dt = Math.min(64, now - S3.at); S3.at = now;
    if(PT.spin && !S3.drag){ PT.ang = (PT.ang + dt * .03) % 360; turn(); }
    S3.raf = requestAnimationFrame(step);
  };
  S3.raf = requestAnimationFrame(step);
}
function spinStop(){ if(S3.raf) cancelAnimationFrame(S3.raf); S3.raf = 0; S3.drag = null; }
// the face and the strokes, without the tools round them
function drawCanvas(){
  const can = $('#paint .ptcan'), o = byId(PT.id); if(!can || !o) return;
  const [fw, fh] = fitSize();
  can.style.width = fw+'px'; can.style.height = fh+'px';
  can.style.transform = `translate(${PT.x}px, ${PT.y}px) scale(${PT.z})`;
  can.innerHTML = `<div class="ptface">${faceHTML(o, fw, fh)}</div>
    <svg class="ptart${PT.preview || PT.mode!=='draw' ?' off':''}" viewBox="0 0 ${PT.W} ${PT.H}" preserveAspectRatio="none"
      fill="none" stroke-linecap="round" stroke-linejoin="round">
      <g class="ptstrokes">${PT.preview || PT.mode!=='draw' ? '' : strokesSVG(PT.strokes, PT.W, PT.H, null)}</g><g class="ptlive"></g>
      ${PT.mirror ? `<g class="ptguide">${PT.mirror.includes('v')?`<path d="M${PT.W/2} 0V${PT.H}"/>`:''}${
        PT.mirror.includes('h')?`<path d="M0 ${PT.H/2}H${PT.W}"/>`:''}</g>` : ''}
    </svg>`;
}
function setView(z, x, y){
  PT.z = Math.max(.5, Math.min(12, z)); PT.x = x; PT.y = y;
  const can = $('#paint .ptcan');
  if(can) can.style.transform = `translate(${PT.x}px, ${PT.y}px) scale(${PT.z})`;
}
// zoom about a point on the screen, so what is under the finger stays there
function zoomAt(k, cx, cy){
  const can = $('#paint .ptcan'); if(!can) return;
  const r = can.getBoundingClientRect();
  const z = Math.max(.5, Math.min(12, PT.z*k)), f = z/PT.z;
  // the canvas' own origin (untransformed) is r.left - PT.x … scaled about its centre
  const ox = r.left + r.width/2, oy = r.top + r.height/2;
  setView(z, PT.x + (cx-ox)*(1-f), PT.y + (cy-oy)*(1-f));
}

/* ---- the pointer ------------------------------------------------------ */
const P = {pts:new Map(), stroke:null, pinch:null};
const toArt = (e)=>{ const sv = $('#paint .ptart'); if(!sv) return null;
  const r = sv.getBoundingClientRect();
  return [Math.round((e.clientX-r.left)/r.width*PT.W), Math.round((e.clientY-r.top)/r.height*PT.H)]; };
function liveDraw(){
  const g = $('#paint .ptlive'); if(!g || !P.stroke) return;
  g.innerHTML = strokesSVG([P.stroke], PT.W, PT.H, null);
}
function eraseAt(pt){
  const r = widthOf('erase');
  const near = st => copies(st, PT.W, PT.H).some(p=>p.some(([x,y])=>Math.hypot(x-pt[0], y-pt[1]) < r + (+st.w||8)/2));
  const was = PT.strokes.length;
  PT.strokes = PT.strokes.filter(st=>!near(st));
  if(PT.strokes.length !== was){ PT.redo = []; const g=$('#paint .ptstrokes'); if(g) g.innerHTML = strokesSVG(PT.strokes, PT.W, PT.H, null); }
}
function stamp(pt){
  const d = DECALS[PT.decal]; if(!d) return;
  const t = PT.lastInk || 'pencil';
  const size = Math.min(PT.W, PT.H) * .16 * (1 + (PT.sizeAt.decal!=null ? PT.sizeAt.decal : 1) * .45);
  const lines = d.fits ? d.make(PT.W, PT.H) : d.make().map(p=>p.map(([x,y])=>[pt[0]+x*size, pt[1]+y*size]));
  const w = widthOf('decal') * (t==='paint' ? 1.6 : 1);
  lines.forEach(p=>{
    const flat = []; p.forEach(([x,y])=>flat.push(Math.round(x), Math.round(y)));
    PT.strokes.push({t, c: t==='emboss' ? PT.metal : PT.ink, w, m: d.fits ? '' : PT.mirror, p:flat});
  });
  PT.redo = [];
  drawPainter();
}
function onDown(e){
  if(!PT.id) return;
  const stage = e.target.closest('#paint .ptstage'); if(!stage || e.target.closest('.ptzoom')) return;
  e.preventDefault();
  /* 3D: the finger turns the model; Face: it carries the knob or the name
     (decision 300). Neither draws. */
  if(PT.mode==='3d'){
    try{ stage.setPointerCapture(e.pointerId); }catch(_){}
    P.pts.set(e.pointerId, [e.clientX, e.clientY]);
    S3.drag = {x:e.clientX, y:e.clientY, ang:PT.ang, tilt:PT.tilt};
    return;
  }
  if(PT.mode==='face'){
    /* by where they are, not by what is under the finger: the face is a
       sample and its insides take no pointer */
    const near = sel => { const el = $('#paint .ptface ' + sel); if(!el) return false;
      const r = el.getBoundingClientRect(), m = 12;
      return e.clientX >= r.left-m && e.clientX <= r.right+m && e.clientY >= r.top-m && e.clientY <= r.bottom+m; };
    const what = near('.pull') ? 'knobAt' : near('.dname') ? 'nameAt' : null;
    if(!what) return;
    try{ stage.setPointerCapture(e.pointerId); }catch(_){}
    P.pts.set(e.pointerId, [e.clientX, e.clientY]);
    P.carry = what;
    return;
  }
  // a synthetic pointer has nothing to capture, and nothing here needs it to
  try{ stage.setPointerCapture(e.pointerId); }catch(_){}
  P.pts.set(e.pointerId, [e.clientX, e.clientY]);
  if(P.pts.size===2){
    // a second finger: whatever the first began is a pinch, not a line
    P.stroke = null; const g=$('#paint .ptlive'); if(g) g.innerHTML='';
    const [a,b] = [...P.pts.values()];
    P.pinch = {d:Math.hypot(a[0]-b[0], a[1]-b[1]), cx:(a[0]+b[0])/2, cy:(a[1]+b[1])/2};
    return;
  }
  if(P.pts.size>2) return;
  const pt = toArt(e); if(!pt) return;
  if(PT.tool==='decal'){ stamp(pt); P.pts.delete(e.pointerId); return; }
  if(PT.tool==='erase'){ P.erasing = true; eraseAt(pt); return; }
  if(PT.preview){ PT.preview = false; drawPainter(); }
  P.stroke = {t:PT.tool, c: PT.tool==='emboss' ? PT.metal : PT.ink, w:widthOf(PT.tool), m:PT.mirror, p:[pt[0], pt[1]]};
  liveDraw();
}
function onMove(e){
  if(!PT.id || !P.pts.has(e.pointerId)) return;
  P.pts.set(e.pointerId, [e.clientX, e.clientY]);
  if(S3.drag){
    PT.ang = S3.drag.ang + (e.clientX - S3.drag.x) * .5;
    PT.tilt = Math.max(-70, Math.min(30, S3.drag.tilt - (e.clientY - S3.drag.y) * .3));
    turn(); return;
  }
  if(P.carry){
    const tile = $('#paint .ptface .drawer'); if(!tile) return;
    const r = tile.getBoundingClientRect(), cl = v => Math.round(Math.max(.04, Math.min(.96, v))*1000)/1000;
    PT.face[P.carry] = {x:cl((e.clientX - r.left)/r.width), y:cl((e.clientY - r.top)/r.height)};
    drawCanvas(); return;
  }
  if(P.pinch && P.pts.size===2){
    const [a,b] = [...P.pts.values()];
    const d = Math.hypot(a[0]-b[0], a[1]-b[1]), cx = (a[0]+b[0])/2, cy = (a[1]+b[1])/2;
    zoomAt(d/Math.max(1,P.pinch.d), P.pinch.cx, P.pinch.cy);
    setView(PT.z, PT.x + cx-P.pinch.cx, PT.y + cy-P.pinch.cy);
    P.pinch = {d, cx, cy};
    return;
  }
  const pt = toArt(e); if(!pt) return;
  if(P.erasing){ eraseAt(pt); return; }
  if(!P.stroke) return;
  const p = P.stroke.p, lx = p[p.length-2], ly = p[p.length-1];
  // a point every couple of units at the zoom you are drawing at, no closer
  if(Math.hypot(pt[0]-lx, pt[1]-ly) < 2.5/PT.z) return;
  p.push(pt[0], pt[1]);
  liveDraw();
}
function onUp(e){
  if(!PT.id || !P.pts.has(e.pointerId)) return;
  P.pts.delete(e.pointerId);
  if(S3.drag){ S3.drag = null; return; }
  if(P.carry){ P.carry = null; drawPainter(); return; }
  if(P.pts.size < 2) P.pinch = null;
  if(P.erasing && !P.pts.size){ P.erasing = false; drawPainter(); return; }
  if(P.stroke && !P.pts.size){
    PT.strokes.push(P.stroke); PT.redo = [];
    if(P.stroke.t!=='erase') PT.lastInk = P.stroke.t;
    P.stroke = null;
    drawPainter();
  }
}
function onWheel(e){
  if(!PT.id || !e.target.closest('#paint .ptstage')) return;
  e.preventDefault();
  // a trackpad pinch arrives as a wheel with ctrl held; two fingers is a pan
  if(e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY/120), e.clientX, e.clientY);
  else setView(PT.z, PT.x - e.deltaX, PT.y - e.deltaY);
}
/* The presses in the painter's own bars. Its own listener rather than cases
   in wire.js's `act()`: the painter is a surface of its own, like the setup
   card, and everything it answers is here. */
function onClick(e){
  if(!PT.id) return;
  const t = e.target;
  const b = t.closest('#paint [data-pt],#paint [data-pttool],#paint [data-ptsize],#paint [data-ptmirror],#paint [data-ptink],#paint [data-ptmetal],#paint [data-ptdecal],#paint [data-ptmode],#paint [data-ptface]');
  if(!b) return;
  const d = b.dataset;
  if(d.ptmode){ PT.mode = d.ptmode; PT.preview = false; }
  else if(d.ptface){
    const o = byId(PT.id);
    if(d.ptface==='spin') PT.spin = !PT.spin;
    else if(d.ptface==='reset') PT.face[d.v] = null;
    else if(d.ptface==='c') PT.face.c = +d.v;
    else PT.face[d.ptface] = d.v || null;
    // a choice that is what it already was is no change at all
    if(o && d.ptface!=='spin' && d.ptface!=='reset' && String(o[d.ptface] ?? '')===String(PT.face[d.ptface] ?? '')) delete PT.face[d.ptface];
  }
  else if(d.pttool){ PT.tool = d.pttool; if(d.pttool!=='erase' && d.pttool!=='decal') PT.lastInk = d.pttool; }
  else if(d.ptsize!=null) PT.sizeAt[PT.tool] = +d.ptsize;
  else if(d.ptmirror!=null){ const ks = Object.keys(MIRRORS); PT.mirror = ks[(ks.indexOf(PT.mirror)+1)%ks.length]; }
  else if(d.ptink) PT.ink = d.ptink;
  else if(d.ptmetal){ PT.metal = d.ptmetal; PT.lastInk = 'emboss'; }
  else if(d.ptdecal) PT.decal = d.ptdecal;
  else switch(d.pt){
    case 'cancel': closePaint(false); return;
    case 'done': closePaint(true); return;
    case 'undo': if(PT.strokes.length) PT.redo.push(PT.strokes.pop()); break;
    case 'redo': if(PT.redo.length) PT.strokes.push(PT.redo.pop()); break;
    case 'clear': if(PT.strokes.length){ PT.redo = PT.strokes.slice().reverse(); PT.strokes = []; } break;
    case 'preview': PT.preview = !PT.preview; break;
    case 'zin': { const r=$('#paint .ptstage').getBoundingClientRect(); zoomAt(1.5, r.left+r.width/2, r.top+r.height/2); return; }
    case 'zout': { const r=$('#paint .ptstage').getBoundingClientRect(); zoomAt(1/1.5, r.left+r.width/2, r.top+r.height/2); return; }
    case 'zfit': setView(1, 0, 0); return;
  }
  drawPainter();
}
function onKey(e){
  if(!PT.id) return false;
  if(e.key==='Escape'){ closePaint(false); return true; }
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='z'){
    e.preventDefault();
    if(e.shiftKey){ if(PT.redo.length) PT.strokes.push(PT.redo.pop()); }
    else if(PT.strokes.length) PT.redo.push(PT.strokes.pop());
    drawPainter(); return true;
  }
  return false;
}
/* Wired once from boot, on the document: the painter comes and goes, and a
   listener on it would be one more thing to take down. */
function wirePaint(){
  CARDART.draw = artLayer;
  /* In the capture phase, and nothing inside the painter goes any further:
     the painter sits in `#frame`, whose own listeners are the board's
     gestures, and a stroke must never be read as a drag or a lasso. */
  const mine = f => e => { if(!PT.id || !e.target.closest || !e.target.closest('#paint')) return;
    e.stopPropagation(); f(e); };
  document.addEventListener('pointerdown', mine(onDown), {capture:true, passive:false});
  document.addEventListener('pointermove', e=>{ if(PT.id && P.pts.has(e.pointerId)){ e.stopPropagation(); onMove(e); } }, true);
  document.addEventListener('pointerup', e=>{ if(PT.id && P.pts.has(e.pointerId)){ e.stopPropagation(); onUp(e); } }, true);
  document.addEventListener('pointercancel', e=>{ if(PT.id && P.pts.has(e.pointerId)) onUp(e); }, true);
  document.addEventListener('wheel', mine(onWheel), {capture:true, passive:false});
  document.addEventListener('click', mine(onClick), true);
  // the name, typed: the face redraws under the field, the field stays put
  document.addEventListener('input', e=>{ if(!PT.id || !e.target.matches || !e.target.matches('#paint [data-ptname]')) return;
    PT.face.title = e.target.value; if(PT.mode==='3d') draw3d(); else drawCanvas(); }, true);
  addEventListener('resize', ()=>{ if(PT.id){ if(PT.mode==='3d') draw3d(); else drawCanvas(); } });
}

export { paintTarget, hasArt, artLayer, openPaint, closePaint, paintOpen, wirePaint, onKey as paintKey,
  TOOLS as PAINT_TOOLS, DECALS, METALS, MIRRORS, bend, PT };
