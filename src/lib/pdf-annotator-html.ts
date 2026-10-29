/**
 * A self-contained PDF reader page with drawing tools, run inside a WebView (device) or an
 * iframe (web). Pages are rendered with pdf.js; every page gets an ink canvas on top for the
 * pencil, marker (highlighter) and eraser, behind one neutral tools button. Reading progress
 * is a percentage in the corner, and the reader reopens on the last page read.
 *
 * Messages in:  { type: 'load', base64, annotations, page, accent }
 * Messages out: { type: 'ready' } | { type: 'annotations', annotations } | { type: 'page', page, pages }
 *
 * Strokes are stored per page in normalized (0–1) page coordinates, so they line up at any size.
 */
export function pdfAnnotatorHtml() {
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin: 0; height: 100%; background: #2b2b2f; font-family: -apple-system, system-ui, Roboto, sans-serif; }
  #pages { position: absolute; inset: 0; overflow-y: auto; padding: 12px 10px 96px; -webkit-overflow-scrolling: touch; }
  .page { position: relative; margin: 0 auto 12px; background: #fff; box-shadow: 0 2px 10px rgba(0,0,0,.35); }
  .page canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .ink { touch-action: pan-y; }
  body.drawing .ink { touch-action: none; }
  /* Reading progress: just a percentage, bottom left. Tap it to jump to a page. */
  #pct { position: fixed; left: 14px; bottom: 18px; z-index: 5; padding: 6px 11px; border-radius: 14px;
    background: rgba(28,28,30,.78); color: #f2f2f2; font-size: 13px; font-weight: 600;
    font-variant-numeric: tabular-nums; letter-spacing: .2px; }
  /* Tools: one neutral circle that opens a vertical column of line icons. */
  .round { border: 0; padding: 0; width: 44px; height: 44px; border-radius: 22px; display: flex; align-items: center;
    justify-content: center; color: #e8e8ea; background: #2f2f33; box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 4px 12px rgba(0,0,0,.35); }
  .round svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .round.on { background: #e8e8ea; color: #1c1c1e; }
  #fab { position: fixed; right: 16px; bottom: 16px; width: 52px; height: 52px; border-radius: 26px; z-index: 6; background: #3a3a3e; }
  #menu { position: fixed; right: 20px; bottom: 80px; z-index: 6; display: flex; flex-direction: column; gap: 10px; pointer-events: none; }
  #menu .round { opacity: 0; transform: translateY(6px); transition: opacity .14s ease, transform .14s ease; }
  body.open #menu { pointer-events: auto; }
  body.open #menu .round { opacity: 1; transform: none; }
  #swatch { width: 16px; height: 16px; border-radius: 8px; box-shadow: 0 0 0 2px #e8e8ea; }
  #status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #bbb; font-size: 15px; text-align: center; padding: 24px; }
</style></head>
<body>
<div id="pages"><div id="status">Opening…</div></div>
<div id="pct">0%</div>
<div id="menu">
  <button class="round" id="t-undo" title="Undo"><svg viewBox="0 0 24 24"><path d="M9 14L4.5 9.5 9 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/></svg></button>
  <button class="round" id="t-color" title="Color"><span id="swatch"></span></button>
  <button class="round" id="t-eraser" title="Eraser"><svg viewBox="0 0 24 24"><path d="M15.5 4l5 5L11 18.5H6.5L3.5 15.5z"/><path d="M10 9.5l5 5"/><path d="M11 18.5h9.5"/></svg></button>
  <button class="round" id="t-marker" title="Highlight"><svg viewBox="0 0 24 24"><path d="M9.5 14.5l-3.5 3.5h4.5l1.5-1.5"/><path d="M8.5 13.5l7.5-7.5 3 3-7.5 7.5z"/><path d="M13.5 8.5l3 3"/><path d="M3.5 21h17"/></svg></button>
  <button class="round" id="t-pencil" title="Draw"><svg viewBox="0 0 24 24"><path d="M15 4.5l4.5 4.5L9 19.5l-5 1 1-5z"/><path d="M13 6.5l4.5 4.5"/><path d="M14 20.5c1.5 0 1.8-1.5 3.3-1.5s1.7 1.5 3.2 1.5"/></svg></button>
  <button class="round on" id="t-hand" title="Scroll"><svg viewBox="0 0 24 24"><path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v5.5M17 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.6a6 6 0 0 1-4.9-2.5L4.3 14.4a1.5 1.5 0 0 1 2.4-1.8L8 14.3"/></svg></button>
</div>
<button class="round" id="fab" title="Tools"></button>
<script>
(function () {
  var send = function (msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    else if (window.parent !== window) window.parent.postMessage(msg, '*');
  };
  var PENCIL = ['#1d1d1f', '#e5484d', '#3c87f7', '#2bb673'];
  var MARKER = ['#ffe14d', '#7cf0a0', '#7cc8ff', '#ff9ad5'];
  var state = { tool: 'hand', color: { pencil: PENCIL[0], marker: MARKER[0] }, ann: {}, history: [], pages: [], current: 1 };
  var pagesEl = document.getElementById('pages');

  var ICONS = {"hand": "<svg viewBox='0 0 24 24'><path d='M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v5.5M17 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.6a6 6 0 0 1-4.9-2.5L4.3 14.4a1.5 1.5 0 0 1 2.4-1.8L8 14.3'/></svg>", "pencil": "<svg viewBox='0 0 24 24'><path d='M15 4.5l4.5 4.5L9 19.5l-5 1 1-5z'/><path d='M13 6.5l4.5 4.5'/><path d='M14 20.5c1.5 0 1.8-1.5 3.3-1.5s1.7 1.5 3.2 1.5'/></svg>", "marker": "<svg viewBox='0 0 24 24'><path d='M9.5 14.5l-3.5 3.5h4.5l1.5-1.5'/><path d='M8.5 13.5l7.5-7.5 3 3-7.5 7.5z'/><path d='M13.5 8.5l3 3'/><path d='M3.5 21h17'/></svg>", "eraser": "<svg viewBox='0 0 24 24'><path d='M15.5 4l5 5L11 18.5H6.5L3.5 15.5z'/><path d='M10 9.5l5 5'/><path d='M11 18.5h9.5'/></svg>", "close": "<svg viewBox='0 0 24 24'><path d='M6 6l12 12M18 6L6 18'/></svg>"};
  var fab = document.getElementById('fab');
  // The closed button shows the active tool, so it's clear when drawing is on.
  function renderFab() {
    var open = document.body.classList.contains('open');
    fab.innerHTML = open ? ICONS.close : ICONS[state.tool];
    fab.classList.toggle('on', state.tool !== 'hand' && !open);
  }
  fab.onclick = function () { document.body.classList.toggle('open'); renderFab(); };

  function setTool(tool) {
    state.tool = tool;
    ['hand', 'pencil', 'marker', 'eraser'].forEach(function (t) {
      document.getElementById('t-' + t).classList.toggle('on', t === tool);
    });
    document.body.classList.toggle('drawing', tool !== 'hand');
    state.pages.forEach(function (p) { p.ink.style.pointerEvents = tool === 'hand' ? 'none' : 'auto'; });
    document.body.classList.remove('open');
    renderColors();
    renderFab();
  }
  function renderColors() {
    var kind = state.tool === 'marker' ? 'marker' : 'pencil';
    document.getElementById('swatch').style.background = state.color[kind];
  }
  // Tapping the color button cycles through the palette of the current tool.
  document.getElementById('t-color').onclick = function () {
    var kind = state.tool === 'marker' ? 'marker' : 'pencil';
    var list = kind === 'marker' ? MARKER : PENCIL;
    state.color[kind] = list[(list.indexOf(state.color[kind]) + 1) % list.length];
    renderColors();
  };
  ['hand', 'pencil', 'marker', 'eraser'].forEach(function (t) {
    document.getElementById('t-' + t).onclick = function () { setTool(t); };
  });
  document.getElementById('t-undo').onclick = function () {
    var last = state.history.pop();
    if (!last) return;
    var list = state.ann[last.page] = state.ann[last.page] || [];
    if (last.kind === 'add') list.splice(list.indexOf(last.stroke), 1);
    else list.push(last.stroke);
    drawInk(last.page);
    changed();
  };

  var saveTimer;
  function changed() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { send({ type: 'annotations', annotations: state.ann }); }, 400);
  }

  function drawStroke(ctx, s, w, h) {
    var pts = s.points;
    if (!pts.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = s.tool === 'marker' ? 0.38 : 1;
    ctx.globalCompositeOperation = s.tool === 'marker' ? 'multiply' : 'source-over';
    ctx.lineWidth = (s.tool === 'marker' ? 0.026 : 0.004) * w;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
    if (pts.length === 1) ctx.lineTo(pts[0][0] * w + 0.1, pts[0][1] * h);
    ctx.stroke();
    ctx.restore();
  }
  function drawInk(n) {
    var p = state.pages[n - 1];
    if (!p) return;
    var ctx = p.ink.getContext('2d');
    ctx.clearRect(0, 0, p.ink.width, p.ink.height);
    (state.ann[n] || []).forEach(function (s) { drawStroke(ctx, s, p.ink.width, p.ink.height); });
  }

  function attachInk(p) {
    var stroke = null;
    var pos = function (e) {
      var r = p.ink.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    };
    var erase = function (pt) {
      var list = state.ann[p.n] || [];
      for (var i = list.length - 1; i >= 0; i--) {
        var hit = list[i].points.some(function (q) { return Math.hypot(q[0] - pt[0], (q[1] - pt[1]) * p.aspect) < 0.03; });
        if (hit) { state.history.push({ kind: 'erase', page: p.n, stroke: list[i] }); list.splice(i, 1); drawInk(p.n); changed(); }
      }
    };
    p.ink.addEventListener('pointerdown', function (e) {
      if (state.tool === 'hand') return;
      e.preventDefault();
      p.ink.setPointerCapture(e.pointerId);
      if (state.tool === 'eraser') { erase(pos(e)); stroke = { eraser: true }; return; }
      stroke = { tool: state.tool, color: state.color[state.tool], points: [pos(e)] };
      (state.ann[p.n] = state.ann[p.n] || []).push(stroke);
      drawInk(p.n);
    });
    p.ink.addEventListener('pointermove', function (e) {
      if (!stroke) return;
      e.preventDefault();
      if (stroke.eraser) { erase(pos(e)); return; }
      var pt = pos(e);
      var prev = stroke.points[stroke.points.length - 1];
      // Markers draw straight-ish lines: keep the first point's height for a neat highlight.
      if (stroke.tool === 'marker' && stroke.points.length > 1) pt[1] = prev[1] + (pt[1] - prev[1]) * 0.25;
      stroke.points.push(pt);
      drawInk(p.n);
    });
    var end = function () {
      if (stroke && !stroke.eraser) { state.history.push({ kind: 'add', page: p.n, stroke: stroke }); changed(); }
      stroke = null;
    };
    p.ink.addEventListener('pointerup', end);
    p.ink.addEventListener('pointercancel', end);
  }

  var pageTimer;
  function track() {
    var mid = pagesEl.scrollTop + pagesEl.clientHeight / 3;
    var current = 1;
    state.pages.forEach(function (p) { if (p.el.offsetTop <= mid) current = p.n; });
    var total = state.pages.length;
    var max = pagesEl.scrollHeight - pagesEl.clientHeight;
    var pct = max > 0 ? Math.round((pagesEl.scrollTop / max) * 100) : 100;
    document.getElementById('pct').textContent = pct + '%';
    if (current !== state.current) {
      state.current = current;
      clearTimeout(pageTimer);
      pageTimer = setTimeout(function () { send({ type: 'page', page: current, pages: total }); }, 300);
    }
  }
  pagesEl.addEventListener('scroll', track, { passive: true });
  document.getElementById('pct').onclick = function () {
    var n = parseInt(prompt('Go to page (1–' + state.pages.length + ')', state.current), 10);
    if (n >= 1 && n <= state.pages.length) state.pages[n - 1].el.scrollIntoView();
  };

  async function load(msg) {
    document.documentElement.style.setProperty('--accent', msg.accent || '#3c87f7');
    state.ann = msg.annotations || {};
    if (!msg.base64) {
      pagesEl.innerHTML = '<div id="status">This PDF isn’t on this device anymore.<br/>Delete it from the list and import it again.</div>';
      return;
    }
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      var raw = atob(msg.base64);
      var bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      var pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      pagesEl.innerHTML = '';
      var width = Math.min(pagesEl.clientWidth - 20, 900);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (var n = 1; n <= pdf.numPages; n++) {
        var page = await pdf.getPage(n);
        var base = page.getViewport({ scale: 1 });
        var scale = width / base.width;
        var vp = page.getViewport({ scale: scale * dpr });
        var el = document.createElement('div');
        el.className = 'page';
        el.style.width = width + 'px';
        el.style.height = base.height * scale + 'px';
        var canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        var ink = document.createElement('canvas');
        ink.className = 'ink';
        ink.width = vp.width;
        ink.height = vp.height;
        ink.style.pointerEvents = 'none';
        el.appendChild(canvas);
        el.appendChild(ink);
        pagesEl.appendChild(el);
        var p = { n: n, el: el, ink: ink, aspect: base.height / base.width };
        state.pages.push(p);
        attachInk(p);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        drawInk(n);
        if (n === msg.page) el.scrollIntoView();
        if (n === 1 || n === msg.page) track();
      }
      track();
    } catch (err) {
      pagesEl.innerHTML = '<div id="status">Couldn’t open this PDF.<br/>' + (window.pdfjsLib ? '' : 'The reader needs an internet connection the first time.') + '</div>';
    }
  }

  var onMessage = function (e) {
    var msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (msg && msg.type === 'load') load(msg);
  };
  window.addEventListener('message', onMessage);
  document.addEventListener('message', onMessage);
  window.receive = function (msg) { load(msg); };
  renderColors();
  renderFab();
  send({ type: 'ready' });
})();
</script>
</body></html>`;
}
