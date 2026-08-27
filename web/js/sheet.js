import { $, $$, esc, ic, md, D, ROOT } from './util.js';
import { S, K, byId, has, isContainer, READS, readOf, isPicture, isMedia, isPlayable,
  mediaTypeOf, iconOf } from './model.js';
import { bookOf } from './tiles.js';
import { closePanel, objectPanel } from './panels.js';
import { toast } from './mutations.js';
import { render } from './views.js';

/* ============================================================
   15 · the two surfaces an object opens onto
   ============================================================
   There used to be three: a reading surface, a half-screen read panel, and a
   detail *sheet* — a scrolling form of every field the object had, with the
   body at the bottom of it. The sheet was the app's second settings screen and
   its only writing surface at the same time, which is why it was neither:
   every setting on it also lives in the object's own panel, and the one thing
   you actually came for — the words — got a textarea eight fields down.

   Three now, and each is one job:

     read   — the body as paper. A spread, a page, or a column you scroll.
     write  — the same body, full screen, with nothing else on it.
     view   — the picture, as big as the screen allows, and the way to put one
              there. Reading is what you do to words; an object whose content is
              an image was being sent to the paper surface, which drew a blank
              page with a photograph gummed to the top of it and offered no way
              at all to choose the photograph.

   Everything that was a *setting* on the old sheet is in the object editor,
   which is one panel for objects and containers alike. See decision 36. */

function openWriter(id){
  const o=byId(id); if(!o) return;
  S.writeId=id; S.readId=null; S.viewId=null; S.editId=null;
  renderSheet();
}
function openRead(id){
  const o=byId(id); if(!o) return;
  S.readId=id; S.writeId=null; S.viewId=null; S.editId=null; S.bookAt=0; S.readEdit=false;
  renderSheet();
}
function openViewer(id){
  const o=byId(id); if(!o) return;
  S.viewId=id; S.readId=null; S.writeId=null; S.editId=null;
  renderSheet();
}
/* What "open this one" means when nothing has said which way: a picture opens
   as the picture, something with a body opens to be read, and something with
   neither has nothing to look at, so it opens its editor. Used by the palette
   and by a button pointing at an object — both of which mean "take me to it",
   not "change it". */
function openObj(id){
  const o=byId(id); if(!o) return;
  if(isContainer(o)){ S.view='drawer'; S.drawerId=id; render(); return; }
  if(isMedia(o)) openViewer(id);
  else if(has(o,'text')) openRead(id);
  else objectPanel(id);
}
function closeSheet(){
  S.writeId=null; S.readId=null; S.viewId=null; S.editId=null; S.readEdit=false;
  clearFocus(); renderSheet(); render();
}
function clearFocus(){
  $$('.drawer.focused').forEach(e=>e.classList.remove('focused'));
  $('#frame').classList.remove('sheet-left');
}

const words = s => (s||'').split(/\s+/).filter(Boolean).length;

/* ============================================================
   15b · making the textarea behave
   ============================================================
   Bear's feel comes from the document being the interface: the `#` stays
   visible and the heading is already a heading. There are three ways to chase
   that on the web and only one of them is worth having.

   An **overlay** — a coloured `<pre>` under a transparent textarea — cannot
   work, and not for fiddly reasons: it has to share the textarea's metrics
   exactly, and a textarea has one font at one size for all of its text. So an
   overlay can change colour and can never change size or weight, which is
   most of what makes a heading look like one. A **contenteditable** can do it
   properly, is real work, is famously bad on iOS, and is the first step down
   the road to a block editor, which is on the never list.

   The third way is to leave the paper alone and make the *typing* good, which
   is what people actually miss: Return continues the list you are in, ⌘B wraps
   what you selected, and an empty bullet ends the list rather than making
   another one. Bureau already has the other half — the reading surface, which
   is better paper than any editor's preview and is one tap away. See
   decision 68.

   Everything here goes through `insertText` where the browser has it, because
   that is what keeps the textarea's *own* undo working. Rewriting `.value`
   would give us the right characters and take ⌘Z inside the field away, and
   ⌘Z inside a field is the browser's to answer (see wire.js). */
const LIST_RE = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)([.)]) )/;

function put(ta, text){
  ta.focus();
  if(document.execCommand && document.execCommand('insertText', false, text)) return true;
  const {selectionStart:a, selectionEnd:b} = ta;
  ta.setRangeText(text, a, b, 'end');
  ta.dispatchEvent(new Event('input', {bubbles:true}));
  return true;
}
/* Wrap what is selected, or unwrap it if it is already wrapped — a toggle,
   which is what ⌘B means everywhere else. With nothing selected it opens the
   pair and puts the caret between them. */
function wrapSel(ta, mark){
  const v=ta.value, a=ta.selectionStart, b=ta.selectionEnd;
  const n=mark.length;
  const inside = v.slice(a,b);
  const around = v.slice(a-n, a)===mark && v.slice(b, b+n)===mark;
  if(around){
    ta.setSelectionRange(a-n, b+n);
    put(ta, inside);
    ta.setSelectionRange(a-n, b-n);
    return true;
  }
  if(inside.startsWith(mark) && inside.endsWith(mark) && inside.length>2*n){
    put(ta, inside.slice(n, -n));
    ta.setSelectionRange(a, b-2*n);
    return true;
  }
  put(ta, mark+inside+mark);
  if(a===b) ta.setSelectionRange(a+n, a+n);
  else ta.setSelectionRange(a+n, b+n);
  return true;
}
/* Return, inside a list. The next line starts the same way this one did —
   a bullet, a ticked box emptied, or the next number. An item with nothing in
   it means you are done: the marker is taken off instead, which is how every
   editor that does this at all behaves, and it is why you never have to reach
   for the mouse to end a list. */
function listReturn(ta){
  const v=ta.value, a=ta.selectionStart;
  if(a!==ta.selectionEnd) return false;
  const from=v.lastIndexOf('\n', a-1)+1;
  const line=v.slice(from, a);
  const m=line.match(LIST_RE);
  if(!m) return false;
  if(line.length===m[0].length){          // an empty item: end the list
    ta.setSelectionRange(from, a);
    put(ta, '');
    return true;
  }
  const next = m[3]
    ? `${m[1]}${+m[3]+1}${m[4]} `
    : `${m[1]}${m[2].replace(/\[[xX]\]/,'[ ]')}`;
  put(ta, '\n'+next);
  return true;
}
/* One keystroke's worth of "this is a markdown editor". Returns true when it
   has answered, so wire.js knows to keep the browser out of it. */
function mdKey(e, ta){
  const meta = e.metaKey || e.ctrlKey;
  if(meta && !e.altKey && !e.shiftKey){
    const k=(e.key||'').toLowerCase();
    if(k==='b') return wrapSel(ta, '**');
    if(k==='i') return wrapSel(ta, '*');
    return false;                     // ⌘K is the palette, ⌘Z is the browser's
  }
  if(e.key==='Enter' && !e.shiftKey && !meta) return listReturn(ta);
  return false;
}

/* ---- one object, out as words -----------------------------------------
   Export is a whole-desk JSON button in Settings, which is the right shape for
   a backup and no shape at all for "send me that note". Obsidian earns its
   trust by being inspectable; a store you can only get out of all at once is a
   store you hope about. So: the title as a heading, the body underneath, its
   tags at the foot — the markdown it was written in, which is the only format
   that loses nothing. See decision 68. */
function asMarkdown(o){
  if(!o) return '';
  const out=[];
  if(o.title) out.push('# '+o.title, '');
  if((o.body||'').trim()) out.push(o.body.trim(), '');
  if((o.tags||[]).length) out.push((o.tags||[]).map(t=>'#'+t).join(' '));
  return out.join('\n').trim()+'\n';
}
function copyObject(id){
  const o=byId(id); if(!o) return;
  const text=asMarkdown(o);
  const done=()=>toast('Copied as markdown');
  if(navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(text).then(done, ()=>fallback(text, done));
  else fallback(text, done);
}
/* A clipboard write can be refused — an insecure origin, a browser that wants
   a gesture it does not think it had. The old trick still works everywhere. */
function fallback(text, done){
  const ta=document.createElement('textarea');
  ta.value=text; ta.setAttribute('readonly','');
  ta.style.cssText='position:fixed;left:-9999px;top:0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); done(); }
  catch(e){ toast('Could not copy'); }
  ta.remove();
}

function renderSheet(){
  const host=$('#sheetHost');
  // A surface and a panel both take the screen; only one at a time, and a
  // surface is the bigger claim.
  if(S.writeId || S.readId || S.viewId) closePanel();

  /* The picture. Full screen over a dimmed desk, the image as large as the
     stage allows, and — when there isn't one yet — the mount itself is the
     button that chooses a file. Replace and Remove are here rather than only in
     the editor, because this is where you are looking at the thing you want to
     change. The file arrives on the picker's own change event long after the
     button was pressed (see imgFor in persist.js), and importImage() calls
     renderSheet() when it lands, so the surface fills itself in. */
  if(S.viewId){
    const o=byId(S.viewId);
    if(!o){ S.viewId=null; host.innerHTML=''; return; }
    const k=K(o.kind), m=o.media||{}, src=m.src, kind=mediaTypeOf(o);
    const size = m.w && m.h ? `${m.w} × ${m.h}`
      : m.size ? `${Math.max(1,Math.round(m.size/1048576*10)/10)} MB` : '';
    host.innerHTML=`<div class="viewscrim" data-sheet="close"></div>
      <div class="viewstage" style="--k:${k.c}">
        <div class="viewhead">
          <span class="kindbadge">${ic(iconOf(o),12)} ${esc(o.title||k.nm)}</span>
          <div style="flex:1"></div>
          ${/* The labels come off on a phone rather than wrapping the head onto
               a second line — four pills, a badge and a close button do not fit
               across 390px, and a head that reflows under the thing it is the
               head of reads as a mistake. The title above them says what this
               is; the marks are the same ones the editor uses. */''}
          ${src?`<button class="pill" data-act="pickimage" data-id="${o.id}" title="Replace">${ic(kind==='audio'?'music':kind==='video'?'film':'image',13)}<span>Replace</span></button>
                 <button class="pill" data-act="dropimage" data-id="${o.id}" title="Remove">${ic('trash',13)}<span>Remove</span></button>`:''}
          ${has(o,'text')?`<button class="pill" data-act="readthis" data-id="${o.id}" title="Read">${ic('eye',13)}<span>Read</span></button>`:''}
          <button class="pill" data-act="objset" data-id="${o.id}" title="Object editor">${ic('brush',13)}<span>Edit</span></button>
          <button class="iconbtn" data-sheet="close" title="Done">${ic('x',16)}</button>
        </div>
        <div class="viewpaper">
          ${/* Three sorts of file, one surface. A picture is looked at; a sound
                and a video are *played*, so they get the browser's own controls
                rather than a still frame of nothing. See decision 71. */''}
          ${src
            ? (kind==='audio'
                ? `<div class="viewsound"><span class="vdmark">${ic('music',40)}</span>
                     <audio class="viewplayer" src="${esc(src)}" controls preload="metadata"></audio></div>`
              : kind==='video'
                ? `<video class="viewimg" src="${esc(src)}" controls preload="metadata" playsinline></video>`
                : `<img class="viewimg" src="${esc(src)}" alt="${esc(o.title||'')}" draggable="false">`)
            : `<button class="viewdrop" data-act="pickimage" data-id="${o.id}">
                 <span class="vdmark">${ic(kind==='audio'?'music':kind==='video'?'film':'image',40)}</span>
                 <b>Add ${kind==='audio'?'a sound':kind==='video'?'a video':'an image'}</b>
                 <i>Choose ${kind==='image'?'a picture':'a file'} from this ${S.device==='phone'?'phone':'computer'}</i>
               </button>`}
        </div>
        <div class="viewfoot">${src
          ? `<span>${esc(m.label||'Untitled')}</span>${size?`<span class="dim">${size}</span>`:''}`
          : `<span class="dim">Nothing in it yet</span>`}</div>
      </div>`;
    return;
  }

  /* Writing. Full screen, over a dimmed desk: a title and a body, and the two
     buttons that take you to the other two things you can do with an object.
     No render() while you type — the textarea is the thing being typed in —
     so the word count is the one thing that updates, in place. */
  if(S.writeId){
    const o=byId(S.writeId);
    if(!o){ S.writeId=null; host.innerHTML=''; return; }
    const k=K(o.kind);
    host.innerHTML=`<div class="writescrim" data-sheet="close"></div>
      <div class="writestage" style="--k:${k.c}">
        <div class="writehead">
          <span class="kindbadge">${ic(k.ic,12)} ${esc(k.nm)}</span>
          <span class="wcount" id="wcount">${words(o.body)} words</span>
          <div style="flex:1"></div>
          ${has(o,'text')?`<button class="pill" data-act="readthis" data-id="${o.id}">${ic('eye',13)} Read</button>`:''}
          ${/* Out as words, not as a backup. See decision 68. */''}
          <button class="pill" data-act="copymd" data-id="${o.id}" title="Copy as markdown">${ic('archive',13)} Copy</button>
          <button class="pill" data-act="objset" data-id="${o.id}">${ic('brush',13)} Edit</button>
          <button class="iconbtn" data-sheet="close" title="Done">${ic('x',16)}</button>
        </div>
        <div class="writepaper">
          <textarea class="writetitle" rows="1" data-w="title"
            placeholder="Untitled ${esc(k.nm.toLowerCase())}">${esc(o.title||'')}</textarea>
          <textarea class="writebody" data-w="body"
            placeholder="Write.">${esc(o.body||'')}</textarea>
        </div>
      </div>`;
    const t=$('.writetitle',host);
    if(t){ t.style.height='auto'; t.style.height=t.scrollHeight+'px'; }
    const b=$('.writebody',host); if(b) setTimeout(()=>b.focus(),20);
    return;
  }

  /* Reading, and writing on the page you are reading. One surface, three
     modes — a spread, a single page, or a column you scroll.

     **The page is the field.** Tapping the paper puts a caret in it, in the
     page's own typography, rather than sending you to a second screen that
     holds the same words in a different face: a note is a line and a
     paragraph, and crossing a surface to change one word was the long way
     round. The whole body is the field however the page is broken up, because
     a page is where a paragraph *landed* and not a thing you edit one of —
     the breaks are re-measured (`clearPages()`) when you put it down.

     That frees the head. Three buttons: the mode, as one button that cycles
     rather than three chips of which two are always wrong; copy, which is a
     glyph because it is the same verb everywhere; and Edit, which now means
     the object editor — everything about the thing that isn't its words.
     See decision 82. */
  if(S.readId){
    const r=byId(S.readId);
    if(!r){ S.readId=null; host.innerHTML=''; return; }
    const mode=readOf(r), modes=Object.keys(READS);
    const next=modes[(modes.indexOf(mode)+1)%modes.length];
    const editing=!!S.readEdit;
    host.innerHTML=`<div class="bookscrim" data-sheet="close"></div>
      <div class="bookstage rm-${mode}${editing?' writingon':''}">
        <div class="bookhead"><b>${esc(r.title||'Untitled')}</b>
          <button class="pchip readmode" data-oread="${next}" data-id="${r.id}"
            title="Reading as a ${READS[mode].toLowerCase()} — tap for ${READS[next].toLowerCase()}">
            ${ic(mode==='scroll'?'feather':'book',13)}<span>${READS[mode]}</span></button>
          <button class="iconbtn" data-act="copymd" data-id="${r.id}" title="Copy as markdown">${ic('copy',15)}</button>
          <button class="pill" data-act="objset" data-id="${r.id}" title="Everything about it but the words">${ic('brush',13)} Edit</button>
          <button class="iconbtn" data-sheet="close">${ic('x',16)}</button></div>
        ${editing
          ? `<div class="book"><div class="spread"><div class="page">
              <textarea class="pagebody" data-w="body"
                placeholder="Write.">${esc(r.body||'')}</textarea></div></div>
             <div class="bookbar"><button class="pill" data-act="pagedone">${ic('check',13)} Done</button></div></div>`
          : bookOf(r)}
      </div>`;
    if(editing){ const b=$('.pagebody',host); if(b) setTimeout(()=>b.focus(),20); }
    return;
  }
  host.innerHTML=''; clearFocus();
}

export { openObj, openWriter, openRead, openViewer, closeSheet, renderSheet, words,
  mdKey, asMarkdown, copyObject };
