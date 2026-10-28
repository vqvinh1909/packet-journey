// ui/diagram.js — "✏️ Vẽ mạng": trình vẽ sơ đồ topology kiểu draw.io (chỉ để vẽ; cấu hình & chạy thử ở Lab CLI).
//   • Thư viện hình (thiết bị mạng + hình cơ bản, có tìm kiếm): kéo vào khung vẽ hoặc bấm để thêm.
//   • Chọn (bấm, Shift+bấm, quét khung), kéo di chuyển (bắt lưới), 8 tay nắm đổi kích thước, sửa chữ tại chỗ (nháy đúp).
//   • Nối dây: rê chuột lên hình → kéo từ chấm xanh sang hình khác. Dây thẳng / gấp khúc / cong, nét, mũi tên, nhãn.
//   • Bảng Định dạng bên phải, menu chuột phải, phím tắt như draw.io, hoàn tác, nhóm, khoá, căn lề, dàn đều, thứ tự lớp.
//   • Tự lưu (localStorage "diagram"), mẫu sơ đồ, xuất PNG / SVG / JSON, mở lại JSON.
import * as D from '../lab/diagram.js';
import { load, save } from './store.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
let clipboard = null; // giữ qua các lần đóng/mở trong phiên

export function openDiagram() {
  document.querySelector('.dg')?.remove();
  let dg;
  try { dg = D.importJson(load('diagram', null) || ''); } catch { dg = D.TEMPLATES[0].build(); }
  const hist = D.createHistory();
  const st = { sel: [], view: load('diagram-view', null) || { x: 40, y: 30, k: 1 }, grid: load('diagram-grid', true), snap: load('diagram-snap', true), edgeStyle: load('diagram-edge', { style: 'straight', dash: 'solid', arrowB: false }), q: '' };
  const root = document.createElement('div');
  root.className = 'dg';
  root.innerHTML =
    `<div class="dg-top">` +
    `<span class="dg-title">✏️ Vẽ mạng</span>` +
    `<button data-act="new" title="Sơ đồ mới">📄 Mới</button><button data-act="open" title="Mở file sơ đồ (.json)">📂 Mở</button>` +
    `<select id="dg-tpl" title="Mẫu sơ đồ"><option value="">📐 Mẫu…</option>${D.TEMPLATES.map((t) => `<option value="${t.id}">${esc(t.vi)}</option>`).join('')}</select>` +
    `<select id="dg-exp" title="Xuất sơ đồ"><option value="">⬇ Xuất…</option><option value="png">Ảnh PNG</option><option value="svg">Ảnh SVG</option><option value="json">File sơ đồ (.json)</option></select>` +
    `<span class="dg-sep"></span>` +
    `<button data-act="undo" title="Hoàn tác (Ctrl+Z)">↶</button><button data-act="redo" title="Làm lại (Ctrl+Y)">↷</button>` +
    `<span class="dg-sep"></span>` +
    `<button data-act="copy" title="Sao chép (Ctrl+C)">⧉</button><button data-act="paste" title="Dán (Ctrl+V)">📋</button><button data-act="dup" title="Nhân bản (Ctrl+D)">⎘</button><button data-act="del" title="Xoá (Delete)">🗑</button>` +
    `<span class="dg-sep"></span>` +
    `<button data-act="front" title="Đưa lên trên cùng (Ctrl+Shift+])">⬆</button><button data-act="back" title="Đưa xuống dưới cùng (Ctrl+Shift+[)">⬇</button>` +
    `<select id="dg-align" title="Căn lề / dàn đều (chọn ≥ 2 hình)"><option value="">⫷ Căn…</option><option value="left">Căn trái</option><option value="center">Căn giữa (dọc)</option><option value="right">Căn phải</option><option value="top">Căn trên</option><option value="middle">Căn giữa (ngang)</option><option value="bottom">Căn dưới</option><option value="dh">Dàn đều ngang</option><option value="dv">Dàn đều dọc</option></select>` +
    `<button data-act="group" title="Nhóm (Ctrl+G)">▣ Nhóm</button><button data-act="ungroup" title="Bỏ nhóm (Ctrl+Shift+G)">▢</button><button data-act="lock" title="Khoá / mở khoá vị trí">🔒</button>` +
    `<span class="dg-sep"></span>` +
    `<label class="dg-chk"><input type="checkbox" id="dg-grid"> Lưới</label><label class="dg-chk"><input type="checkbox" id="dg-snap"> Bắt dính</label>` +
    `<span class="dg-grow"></span>` +
    `<button data-act="zout" title="Thu nhỏ (Ctrl −)">−</button><span id="dg-zl" class="dg-zl"></span><button data-act="zin" title="Phóng to (Ctrl +)">+</button><button data-act="fit" title="Vừa khung (Ctrl+Shift+H)">⤢</button>` +
    `<button data-act="close" class="dg-close" title="Đóng (sơ đồ tự lưu)">✕</button>` +
    `<input type="file" id="dg-file" accept=".json,application/json" hidden></div>` +
    `<div class="dg-body"><aside class="dg-lib"><input id="dg-q" placeholder="🔍 Tìm hình…" autocomplete="off"><div id="dg-libs"></div></aside>` +
    `<div class="dg-stage" id="dg-stage" tabindex="0"><svg class="dg-svg" id="dg-svg"><defs><pattern id="dg-gp" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" class="dg-g1"/></pattern><pattern id="dg-gp5" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#dg-gp)"/><path d="M50 0H0V50" class="dg-g2"/></pattern></defs>` +
    `<g id="dg-world"><rect id="dg-gridr" x="-4000" y="-4000" width="12000" height="12000" fill="url(#dg-gp5)"/><g id="dg-draw"></g><g id="dg-over"></g></g></svg>` +
    `<div class="dg-status" id="dg-status"></div></div>` +
    `<aside class="dg-fmt" id="dg-fmt"></aside></div>`;
  document.body.appendChild(root);
  const $ = (id) => root.querySelector('#' + id);
  const stage = $('dg-stage'), svg = $('dg-svg'), world = $('dg-world'), draw = $('dg-draw'), over = $('dg-over');
  const alive = () => document.body.contains(root);

  // ---------------------------------------------------------------- lưu / hoàn tác
  const persist = () => { clearTimeout(persist.t); persist.t = setTimeout(() => save('diagram', JSON.parse(D.exportJson(dg))), 200); };
  const mut = (fn) => { const r = hist.track(dg, fn); persist(); return r; };
  const sel = () => st.sel.map((id) => D.shapeOf(dg, id) || D.edgeOf(dg, id)).filter(Boolean);
  const selShapes = () => st.sel.map((id) => D.shapeOf(dg, id)).filter(Boolean);
  function setSel(ids, add = false) {
    const base = add ? [...st.sel] : [];
    for (const id of ids) { const i = base.indexOf(id); if (add && i >= 0) base.splice(i, 1); else if (!base.includes(id)) base.push(id); }
    st.sel = D.expandGroups(dg, base);
    render();
  }

  // ---------------------------------------------------------------- khung nhìn
  const applyView = () => { world.setAttribute('transform', `translate(${st.view.x} ${st.view.y}) scale(${st.view.k})`); $('dg-zl').textContent = Math.round(st.view.k * 100) + '%'; clearTimeout(applyView.t); applyView.t = setTimeout(() => save('diagram-view', st.view), 300); };
  const toWorld = (e) => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left - st.view.x) / st.view.k, y: (e.clientY - r.top - st.view.y) / st.view.k }; };
  const sn = (v) => (st.snap ? Math.round(v / D.GRID) * D.GRID : Math.round(v));
  function zoomAt(f, cx, cy) {
    const v = st.view, k = Math.max(0.2, Math.min(4, v.k * f));
    v.x = cx - ((cx - v.x) * k) / v.k; v.y = cy - ((cy - v.y) * k) / v.k; v.k = k;
    applyView();
  }
  function fit() {
    const r = stage.getBoundingClientRect(), b = D.bounds(dg, 40);
    const k = Math.max(0.2, Math.min(2, Math.min(r.width / b.w, r.height / b.h)));
    st.view = { k, x: (r.width - b.w * k) / 2 - b.x * k, y: (r.height - b.h * k) / 2 - b.y * k };
    applyView();
  }
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    else { st.view.x -= e.shiftKey ? e.deltaY : e.deltaX; st.view.y -= e.shiftKey ? 0 : e.deltaY; applyView(); }
  }, { passive: false });

  // ---------------------------------------------------------------- vẽ
  function render() {
    if (!alive()) return;
    const zones = dg.shapes.filter((s) => s.t === 'zone'), rest = dg.shapes.filter((s) => s.t !== 'zone');
    draw.innerHTML = zones.map(D.shapeSvg).join('') + dg.edges.map((e) => D.edgeSvg(dg, e)).join('') + rest.map(D.shapeSvg).join('');
    for (const s of dg.shapes) if (s.locked) draw.querySelector(`[data-id="${s.id}"]`)?.classList.add('locked');
    drawOverlay();
    $('dg-gridr').style.display = st.grid ? '' : 'none';
    root.querySelector('[data-act=undo]').disabled = !hist.canUndo;
    root.querySelector('[data-act=redo]').disabled = !hist.canRedo;
    renderFmt();
    status();
    applyView();
  }
  function drawOverlay() {
    over.innerHTML = '';
    const mk = (tag, a) => { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(a)) n.setAttribute(k, v); over.appendChild(n); return n; };
    for (const it of sel()) {
      if (it.a) { const p = D.edgePath(dg, it); if (p) { mk('path', { d: p.d, class: 'dg-esel' }); mk('circle', { cx: p.a.x, cy: p.a.y, r: 4, class: 'dg-eend' }); mk('circle', { cx: p.b.x, cy: p.b.y, r: 4, class: 'dg-eend' }); } continue; }
      mk('rect', { x: it.x - 4, y: it.y - 4, width: it.w + 8, height: it.h + 8, class: 'dg-sel' + (it.locked ? ' locked' : '') });
    }
    const ss = selShapes();
    if (ss.length === 1 && !ss[0].locked) {
      const s = ss[0], pos = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };
      for (const h of HANDLES) mk('rect', { x: s.x + s.w * pos[h][0] - 4, y: s.y + s.h * pos[h][1] - 4, width: 8, height: 8, class: 'dg-h', 'data-h': h });
    }
    if (st.hover && !st.drag) {
      const s = D.shapeOf(dg, st.hover);
      if (s) for (const [cx, cy] of [[s.x + s.w / 2, s.y], [s.x + s.w, s.y + s.h / 2], [s.x + s.w / 2, s.y + s.h], [s.x, s.y + s.h / 2]]) mk('circle', { cx, cy, r: 5, class: 'dg-port', 'data-port': s.id });
    }
    if (st.rubber) { const r = st.rubber; mk('rect', { x: Math.min(r.x0, r.x1), y: Math.min(r.y0, r.y1), width: Math.abs(r.x1 - r.x0), height: Math.abs(r.y1 - r.y0), class: 'dg-rubber' }); }
    if (st.wire) mk('line', { x1: st.wire.x0, y1: st.wire.y0, x2: st.wire.x1, y2: st.wire.y1, class: 'dg-wire' + (st.wire.to ? ' ok' : '') });
  }
  function status() {
    const n = dg.shapes.length, m = dg.edges.length, k = st.sel.length;
    $('dg-status').textContent = `${n} hình · ${m} dây${k ? ` · đang chọn ${k}` : ''} — Kéo hình từ thư viện · rê lên hình rồi kéo chấm xanh để nối dây · nháy đúp để sửa chữ · chuột phải: menu · Ctrl+lăn: phóng to`;
  }

  // ---------------------------------------------------------------- thư viện hình
  function renderLib() {
    const q = st.q.toLowerCase();
    const groups = [['net', 'Thiết bị mạng'], ['basic', 'Hình cơ bản']];
    $('dg-libs').innerHTML = groups.map(([g, title]) => {
      const items = Object.entries(D.SHAPES).filter(([t, S]) => S.group === g && (!q || (S.vi + ' ' + S.en + ' ' + t).toLowerCase().includes(q)));
      if (!items.length) return '';
      return `<div class="dg-lg"><div class="dg-lh">${title}</div><div class="dg-items">` + items.map(([t, S]) => {
        const tmp = D.addShape(D.emptyDiagram(), t, 0, 0, { label: '', sub: '' });
        const vw = Math.max(S.w, S.h) + 8;
        return `<button class="dg-li" data-t="${t}" draggable="true" title="${esc(S.vi)} — kéo vào khung vẽ hoặc bấm"><svg viewBox="${-4 - (vw - S.w - 8) / 2} ${-4 - (vw - S.h - 8) / 2} ${vw} ${vw}">${D.shapeSvg({ ...tmp, label: t === 'text' ? 'Aa' : t === 'zone' ? '' : '' })}</svg><span>${esc(S.vi)}</span></button>`;
      }).join('') + '</div></div>';
    }).join('') || '<div class="dg-none">Không có hình nào khớp.</div>';
    $('dg-libs').querySelectorAll('.dg-li').forEach((b) => {
      b.onclick = () => addAt(b.dataset.t, viewCenter());
      b.ondragstart = (e) => { e.dataTransfer.setData('text/x-dg', b.dataset.t); e.dataTransfer.effectAllowed = 'copy'; };
    });
  }
  const viewCenter = () => { const r = stage.getBoundingClientRect(); return { x: (r.width / 2 - st.view.x) / st.view.k, y: (r.height / 2 - st.view.y) / st.view.k }; };
  function addAt(t, p) {
    const S = D.SHAPES[t];
    const s = mut(() => D.addShape(dg, t, p.x - S.w / 2, p.y - S.h / 2));
    setSel([s.id]);
    if (t === 'text' || t === 'note') editText(s.id);
  }
  stage.ondragover = (e) => { if (e.dataTransfer.types.includes('text/x-dg')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
  stage.ondrop = (e) => { const t = e.dataTransfer.getData('text/x-dg'); if (!t) return; e.preventDefault(); addAt(t, toWorld(e)); };
  $('dg-q').oninput = (e) => { st.q = e.target.value; renderLib(); };

  // ---------------------------------------------------------------- chuột
  const hitId = (t) => t.closest?.('.dg-shape, .dg-edge')?.dataset.id || null;
  stage.addEventListener('pointerdown', (e) => {
    closeMenu();
    if (e.target.closest('.dg-edit')) return;
    stage.focus();
    const p = toWorld(e);
    if (e.button === 1 || (e.button === 0 && st.space)) return panStart(e);
    if (e.button !== 0) return;
    const port = e.target.dataset?.port, handle = e.target.dataset?.h;
    if (port) return wireStart(port, p);
    if (handle) return resizeStart(handle, p);
    const id = hitId(e.target);
    if (!id) { if (!e.shiftKey) st.sel = []; return rubberStart(p, e.shiftKey); }
    if (e.shiftKey) { setSel([id], true); return; }
    if (!st.sel.includes(id)) setSel([id]);
    if (D.shapeOf(dg, id)) dragStart(p);
  });
  stage.addEventListener('pointermove', (e) => {
    if (st.drag || st.rubber || st.wire) return;
    const id = hitId(e.target), port = e.target.dataset?.port;
    const h = port || (D.shapeOf(dg, id) ? id : null);
    if (h !== st.hover) { st.hover = h; drawOverlay(); }
  });
  stage.addEventListener('dblclick', (e) => {
    const id = hitId(e.target);
    if (D.shapeOf(dg, id)) editText(id);
    else if (D.edgeOf(dg, id)) editEdgeLabel(id, e);
    else addAt('text', toWorld(e));
  });
  function track(onMove, onUp) {
    const mv = (ev) => onMove(ev), up = (ev) => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); onUp(ev); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  }
  function panStart(e) {
    const x0 = st.view.x, y0 = st.view.y, sx = e.clientX, sy = e.clientY;
    stage.classList.add('panning');
    track((ev) => { st.view.x = x0 + ev.clientX - sx; st.view.y = y0 + ev.clientY - sy; applyView(); }, () => stage.classList.remove('panning'));
  }
  function rubberStart(p, add) {
    st.rubber = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    const keep = add ? [...st.sel] : [];
    track((ev) => { const q = toWorld(ev); st.rubber.x1 = q.x; st.rubber.y1 = q.y; drawOverlay(); }, () => {
      const r = st.rubber; st.rubber = null;
      const ids = Math.abs(r.x1 - r.x0) + Math.abs(r.y1 - r.y0) > 4 ? D.inRect(dg, r) : [];
      st.sel = D.expandGroups(dg, [...new Set([...keep, ...ids])]);
      render();
    });
  }
  function dragStart(p) {
    const ids = selShapes().filter((s) => !s.locked).map((s) => s.id);
    if (!ids.length) return;
    const before = hist.snapshot(dg), start = Object.fromEntries(ids.map((id) => { const s = D.shapeOf(dg, id); return [id, [s.x, s.y]]; }));
    const lead = D.shapeOf(dg, ids[0]);
    let moved = false, raf = 0;
    st.drag = true;
    track((ev) => {
      const q = toWorld(ev);
      let dx = q.x - p.x, dy = q.y - p.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      dx = sn(start[lead.id][0] + dx) - start[lead.id][0]; dy = sn(start[lead.id][1] + dy) - start[lead.id][1];
      for (const id of ids) { const s = D.shapeOf(dg, id); s.x = start[id][0] + dx; s.y = start[id][1] + dy; }
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
    }, () => { st.drag = false; if (moved) { hist.commit(dg, before); persist(); } render(); });
  }
  function resizeStart(h, p) {
    const s = selShapes()[0], o = { x: s.x, y: s.y, w: s.w, h: s.h }, before = hist.snapshot(dg);
    st.drag = true;
    track((ev) => {
      const q = toWorld(ev), dx = q.x - p.x, dy = q.y - p.y;
      let { x, y, w, h: hh } = o;
      if (h.includes('e')) w = sn(o.x + o.w + dx) - o.x;
      if (h.includes('s')) hh = sn(o.y + o.h + dy) - o.y;
      if (h.includes('w')) { x = Math.min(sn(o.x + dx), o.x + o.w - 20); w = o.x + o.w - x; }
      if (h.includes('n')) { y = Math.min(sn(o.y + dy), o.y + o.h - 16); hh = o.y + o.h - y; }
      if (ev.shiftKey && D.isDevice(s)) { const r = o.w / o.h; if (Math.abs(w - o.w) > Math.abs(hh - o.h)) hh = Math.round(w / r); else w = Math.round(hh * r); }
      Object.assign(s, { x, y, w: Math.max(20, w), h: Math.max(16, hh) });
      render();
    }, () => { st.drag = false; hist.commit(dg, before); persist(); render(); });
  }
  function wireStart(fromId, p) {
    const s = D.shapeOf(dg, fromId);
    st.wire = { from: fromId, x0: s.x + s.w / 2, y0: s.y + s.h / 2, x1: p.x, y1: p.y, to: null };
    st.drag = true;
    track((ev) => {
      const q = toWorld(ev);
      const t = document.elementFromPoint(ev.clientX, ev.clientY);
      const id = t && (t.dataset?.port || hitId(t));
      st.wire.to = id && id !== fromId && D.shapeOf(dg, id) ? id : null;
      Object.assign(st.wire, { x1: q.x, y1: q.y });
      drawOverlay();
    }, () => {
      const w = st.wire; st.wire = null; st.drag = false;
      if (w.to) { const e = mut(() => D.addEdge(dg, w.from, w.to, { ...st.edgeStyle })); if (e) { st.sel = [e.id]; } }
      render();
    });
  }

  // ---------------------------------------------------------------- sửa chữ tại chỗ
  function editText(id) {
    const s = D.shapeOf(dg, id);
    if (!s) return;
    const r = stage.getBoundingClientRect(), k = st.view.k;
    const dev = D.isDevice(s);
    const box = { x: s.x * k + st.view.x, y: (dev ? s.y + s.h + 2 : s.y) * k + st.view.y, w: Math.max(120, s.w * k), h: dev ? 52 : Math.max(30, s.h * k) };
    const ta = document.createElement('textarea');
    ta.className = 'dg-edit';
    ta.value = s.label;
    Object.assign(ta.style, { left: box.x - (box.w - s.w * k) / 2 + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px', fontSize: Math.max(11, s.fs * k) + 'px' });
    stage.appendChild(ta);
    ta.focus(); ta.select();
    let done = false;
    const finish = (ok) => { if (done) return; done = true; if (ok && ta.value !== s.label) mut(() => D.update(dg, id, { label: ta.value })); ta.remove(); render(); stage.focus(); };
    ta.onblur = () => finish(true);
    ta.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') finish(false); else if (e.key === 'Enter' && (e.ctrlKey || !e.shiftKey) && !(e.shiftKey)) { e.preventDefault(); finish(true); } };
    void r;
  }
  function editEdgeLabel(id) {
    const e = D.edgeOf(dg, id);
    const v = prompt('Nhãn của dây (để trống = không có nhãn):', e.label);
    if (v != null) mut(() => D.update(dg, id, { label: v }));
    render();
  }

  // ---------------------------------------------------------------- bảng định dạng
  function renderFmt() {
    const f = $('dg-fmt'), items = sel();
    if (document.activeElement && f.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return; // đang gõ trong bảng: không vẽ lại
    if (!items.length) {
      f.innerHTML = `<div class="dg-fh">Sơ đồ</div><p class="dg-fn">Chưa chọn gì. Bấm vào hình hoặc dây để chỉnh màu, nét, chữ…</p>` +
        `<div class="dg-fh">Kiểu dây mới</div>` + edgeStyleFields(st.edgeStyle, 'def') +
        `<div class="dg-fh">Phím tắt</div><ul class="dg-keys"><li><b>Delete</b> xoá · <b>Ctrl+Z / Y</b> hoàn tác / làm lại</li><li><b>Ctrl+C / X / V / D</b> chép / cắt / dán / nhân bản</li><li><b>Ctrl+A</b> chọn hết · <b>Ctrl+G</b> nhóm · <b>Ctrl+Shift+G</b> bỏ nhóm</li><li><b>Mũi tên</b> dời 1px (Shift: 10px) · <b>F2</b> sửa chữ</li><li><b>Space + kéo</b> / chuột giữa: kéo khung nhìn · <b>Ctrl+lăn</b> phóng to</li><li><b>Shift</b> khi kéo tay nắm thiết bị: giữ tỉ lệ</li></ul>`;
      bindEdgeStyle(f, st.edgeStyle, (patch) => { Object.assign(st.edgeStyle, patch); save('diagram-edge', st.edgeStyle); });
      return;
    }
    const edges = items.filter((x) => x.a), shapes = items.filter((x) => !x.a);
    let html = '';
    if (shapes.length) {
      const s = shapes[0], one = shapes.length === 1, dev = D.isDevice(s);
      html += `<div class="dg-fh">${one ? esc(D.SHAPES[s.t].vi) : `${shapes.length} hình`}</div>` +
        (one ? `<label>Chữ<textarea data-k="label" rows="2">${esc(s.label)}</textarea></label>` + (dev ? `<label>Dòng phụ (IP, vai trò…)<input data-k="sub" value="${esc(s.sub)}"></label>` : '') : '') +
        `<div class="dg-row"><label>Nền<input type="color" data-k="fill" value="${hex(s.fill)}"></label><label>Viền<input type="color" data-k="stroke" value="${hex(s.stroke)}"></label><label>Chữ<input type="color" data-k="color" value="${hex(s.color)}"></label></div>` +
        `<div class="dg-row"><label>Nét viền<select data-k="dash">${opt(['solid', 'Liền'], ['dash', 'Gạch'], ['dot', 'Chấm'])(s.dash)}</select></label><label>Dày<input type="number" min="0" max="10" data-k="sw" value="${s.sw ?? 2}"></label></div>` +
        `<div class="dg-row"><label>Cỡ chữ<input type="number" min="8" max="48" data-k="fs" value="${s.fs}"></label><label class="dg-chk"><input type="checkbox" data-k="bold"${s.bold !== false ? ' checked' : ''}> <b>Đậm</b></label><label class="dg-chk"><input type="checkbox" data-k="italic"${s.italic ? ' checked' : ''}> <i>Nghiêng</i></label></div>` +
        `<label>Độ mờ <input type="range" min="0.2" max="1" step="0.05" data-k="op" value="${s.op ?? 1}"></label>` +
        (one ? `<div class="dg-row"><label>X<input type="number" data-k="x" value="${s.x}"></label><label>Y<input type="number" data-k="y" value="${s.y}"></label><label>Rộng<input type="number" data-k="w" value="${s.w}"></label><label>Cao<input type="number" data-k="h" value="${s.h}"></label></div>` : '') +
        `<label class="dg-chk"><input type="checkbox" data-k="locked"${s.locked ? ' checked' : ''}> 🔒 Khoá vị trí</label>`;
    }
    if (edges.length) {
      const e = edges[0];
      html += `<div class="dg-fh">${edges.length === 1 ? 'Dây nối' : `${edges.length} dây`}</div>` + edgeStyleFields(e, 'edge') +
        (edges.length === 1 ? `<label>Nhãn giữa<input data-e="label" value="${esc(e.label)}" placeholder="vd: trunk, 1 Gbps, VPN"></label><div class="dg-row"><label>Nhãn đầu A (${esc(D.shapeOf(dg, e.a)?.label)})<input data-e="la" value="${esc(e.la)}" placeholder="vd: G0/0"></label><label>Nhãn đầu B (${esc(D.shapeOf(dg, e.b)?.label)})<input data-e="lb" value="${esc(e.lb)}" placeholder="vd: Fa0/1"></label></div>` : '') +
        `<button data-act="setdef" class="dg-wide">Dùng kiểu này cho dây mới</button>`;
    }
    f.innerHTML = html;
    const shapeIds = shapes.map((s) => s.id), edgeIds = edges.map((e) => e.id);
    f.querySelectorAll('[data-k]').forEach((inp) => {
      const k = inp.dataset.k;
      const val = () => (inp.type === 'checkbox' ? inp.checked : inp.type === 'number' || inp.type === 'range' ? +inp.value : inp.value);
      const apply = () => { mut(() => { for (const id of shapeIds) D.update(dg, id, { [k]: val() }); }); renderCanvasOnly(); };
      if (inp.type === 'text' || inp.tagName === 'TEXTAREA' || inp.type === 'number') { inp.oninput = apply; inp.onkeydown = (e) => e.stopPropagation(); } else inp.onchange = apply;
      if (inp.type === 'range' || inp.type === 'color') inp.oninput = apply;
    });
    f.querySelectorAll('[data-e]').forEach((inp) => { inp.onkeydown = (e) => e.stopPropagation(); inp.oninput = () => { mut(() => { for (const id of edgeIds) D.update(dg, id, { [inp.dataset.e]: inp.value }); }); renderCanvasOnly(); }; });
    if (edges.length) bindEdgeStyle(f, edges[0], (patch) => { mut(() => { for (const id of edgeIds) D.update(dg, id, patch); }); renderCanvasOnly(); });
    const sd = f.querySelector('[data-act=setdef]');
    if (sd) sd.onclick = () => { const e = edges[0]; st.edgeStyle = { style: e.style, dash: e.dash, arrowB: e.arrowB, arrowA: e.arrowA, color: e.color, width: e.width }; save('diagram-edge', st.edgeStyle); status(); };
  }
  const opt = (...os) => (v) => os.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${t}</option>`).join('');
  function edgeStyleFields(e, ns) {
    return `<div class="dg-row" data-ns="${ns}"><label>Kiểu<select data-es="style">${opt(['straight', 'Thẳng'], ['ortho', 'Gấp khúc'], ['curve', 'Cong'])(e.style)}</select></label><label>Nét<select data-es="dash">${opt(['solid', 'Liền'], ['dash', 'Gạch'], ['dot', 'Chấm'])(e.dash)}</select></label></div>` +
      `<div class="dg-row"><label>Màu<input type="color" data-es="color" value="${hex(e.color || '#4a6785')}"></label><label>Dày<input type="number" min="1" max="10" data-es="width" value="${e.width || 2}"></label><label class="dg-chk"><input type="checkbox" data-es="arrowA"${e.arrowA ? ' checked' : ''}> ◀ đầu A</label><label class="dg-chk"><input type="checkbox" data-es="arrowB"${e.arrowB ? ' checked' : ''}> đầu B ▶</label></div>`;
  }
  function bindEdgeStyle(f, e, cb) {
    f.querySelectorAll('[data-es]').forEach((inp) => {
      const k = inp.dataset.es;
      const h = () => cb({ [k]: inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? +inp.value : inp.value });
      inp.onchange = h;
      if (inp.type === 'color' || inp.type === 'number') inp.oninput = h;
      inp.onkeydown = (ev) => ev.stopPropagation();
    });
  }
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#ffffff');
  function renderCanvasOnly() { const f = $('dg-fmt'); const keep = f.contains(document.activeElement); if (keep) { const zones = dg.shapes.filter((s) => s.t === 'zone'), rest = dg.shapes.filter((s) => s.t !== 'zone'); draw.innerHTML = zones.map(D.shapeSvg).join('') + dg.edges.map((e) => D.edgeSvg(dg, e)).join('') + rest.map(D.shapeSvg).join(''); drawOverlay(); status(); } else render(); }

  // ---------------------------------------------------------------- lệnh
  const ACT = {
    new: () => { if (dg.shapes.length && !confirm('Tạo sơ đồ mới? Sơ đồ hiện tại sẽ bị thay (có thể ↶ Hoàn tác).')) return; mut(() => Object.assign(dg, D.emptyDiagram())); st.sel = []; render(); },
    open: () => $('dg-file').click(),
    undo: () => { if (hist.undo(dg)) { persist(); st.sel = st.sel.filter((id) => D.shapeOf(dg, id) || D.edgeOf(dg, id)); render(); } },
    redo: () => { if (hist.redo(dg)) { persist(); render(); } },
    copy: () => { if (selShapes().length) clipboard = D.copyOf(dg, st.sel); },
    cut: () => { if (!selShapes().length) return; clipboard = D.copyOf(dg, st.sel); ACT.del(); },
    paste: () => { if (!clipboard) return; const ids = mut(() => D.paste(dg, clipboard, 20, 20)); clipboard = D.copyOf(dg, ids); st.sel = ids; render(); },
    dup: () => { if (!selShapes().length) return; const ids = mut(() => D.duplicate(dg, selShapes().map((s) => s.id))); st.sel = ids; render(); },
    del: () => { if (!st.sel.length) return; mut(() => D.remove(dg, st.sel)); st.sel = st.sel.filter((id) => D.shapeOf(dg, id)); render(); },
    front: () => { mut(() => D.zOrder(dg, st.sel, true)); render(); },
    back: () => { mut(() => D.zOrder(dg, st.sel, false)); render(); },
    group: () => { if (selShapes().length < 2) return; mut(() => D.group(dg, st.sel)); render(); },
    ungroup: () => { mut(() => D.ungroup(dg, st.sel)); render(); },
    lock: () => { const ss = selShapes(); if (!ss.length) return; const v = !ss.every((s) => s.locked); mut(() => { for (const s of ss) D.update(dg, s.id, { locked: v }); }); render(); },
    all: () => { st.sel = dg.shapes.map((s) => s.id); render(); },
    zin: () => { const r = stage.getBoundingClientRect(); zoomAt(1.2, r.width / 2, r.height / 2); },
    zout: () => { const r = stage.getBoundingClientRect(); zoomAt(1 / 1.2, r.width / 2, r.height / 2); },
    z100: () => { st.view.k = 1; applyView(); },
    fit,
    close: () => { save('diagram', JSON.parse(D.exportJson(dg))); root.remove(); document.removeEventListener('keydown', onKey); },
  };
  root.querySelector('.dg-top').addEventListener('click', (e) => { const a = e.target.closest('[data-act]')?.dataset.act; if (a && ACT[a]) ACT[a](); });
  $('dg-tpl').onchange = (e) => { const t = D.TEMPLATES.find((x) => x.id === e.target.value); e.target.value = ''; if (!t || (dg.shapes.length && !confirm(`Thay sơ đồ hiện tại bằng mẫu "${t.vi}"? (Có thể ↶ Hoàn tác)`))) return; mut(() => Object.assign(dg, t.build())); st.sel = []; render(); fit(); };
  $('dg-align').onchange = (e) => {
    const v = e.target.value; e.target.value = '';
    const ids = selShapes().map((s) => s.id);
    if (!v || ids.length < 2) return;
    mut(() => (v === 'dh' ? D.distribute(dg, ids, 'h') : v === 'dv' ? D.distribute(dg, ids, 'v') : D.align(dg, ids, v)));
    render();
  };
  $('dg-exp').onchange = async (e) => { const v = e.target.value; e.target.value = ''; if (v) await exportAs(v); };
  $('dg-file').onchange = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { const n = D.importJson(await f.text()); mut(() => Object.assign(dg, n)); st.sel = []; render(); fit(); }
    catch (err) { alert('Không mở được file: ' + err.message); }
  };
  $('dg-grid').checked = st.grid; $('dg-snap').checked = st.snap;
  $('dg-grid').onchange = (e) => { st.grid = e.target.checked; save('diagram-grid', st.grid); render(); };
  $('dg-snap').onchange = (e) => { st.snap = e.target.checked; save('diagram-snap', st.snap); };

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function exportAs(kind) {
    if (kind === 'json') return download(new Blob([D.exportJson(dg)], { type: 'application/json' }), 'so-do-mang.json');
    const text = D.toSvg(dg);
    if (kind === 'svg') return download(new Blob([text], { type: 'image/svg+xml' }), 'so-do-mang.svg');
    const b = D.bounds(dg), scale = 2;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.ceil(b.w * scale); c.height = Math.ceil(b.h * scale);
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, b.w, b.h);
    c.toBlob((blob) => download(blob, 'so-do-mang.png'), 'image/png');
  }

  // ---------------------------------------------------------------- menu chuột phải
  function closeMenu() { root.querySelector('.dg-menu')?.remove(); }
  stage.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const id = hitId(e.target);
    if (id && !st.sel.includes(id)) setSel([id]);
    const shp = id && D.shapeOf(dg, id), edg = id && D.edgeOf(dg, id);
    const at = toWorld(e);
    const items = shp ? [
      ['✏ Sửa chữ (F2)', () => editText(id)], ['⧉ Sao chép', ACT.copy], ['✂ Cắt', ACT.cut], ['⎘ Nhân bản', ACT.dup], '-',
      ['⬆ Lên trên cùng', ACT.front], ['⬇ Xuống dưới cùng', ACT.back], '-',
      ...(selShapes().length > 1 ? [['▣ Nhóm', ACT.group]] : []), ...(shp.g ? [['▢ Bỏ nhóm', ACT.ungroup]] : []), [shp.locked ? '🔓 Mở khoá' : '🔒 Khoá', ACT.lock], '-', ['🗑 Xoá', ACT.del, 'danger'],
    ] : edg ? [
      ['✏ Sửa nhãn', () => editEdgeLabel(id)], ['Kiểu: thẳng', () => setEdge({ style: 'straight' })], ['Kiểu: gấp khúc', () => setEdge({ style: 'ortho' })], ['Kiểu: cong', () => setEdge({ style: 'curve' })],
      ['Nét: liền / gạch / chấm', () => setEdge({ dash: { solid: 'dash', dash: 'dot', dot: 'solid' }[edg.dash] })], ['⇄ Đảo chiều', () => setEdge({ a: edg.b, b: edg.a, la: edg.lb, lb: edg.la, arrowA: edg.arrowB, arrowB: edg.arrowA }, true)], '-', ['🗑 Xoá dây', ACT.del, 'danger'],
    ] : [
      ...(clipboard ? [['📋 Dán vào đây', () => { const c0 = clipboard.shapes; const mx = Math.min(...c0.map((s) => s.x)), my = Math.min(...c0.map((s) => s.y)); const ids = mut(() => D.paste(dg, clipboard, Math.round(at.x - mx), Math.round(at.y - my))); st.sel = ids; render(); }]] : []),
      ['＋ Thêm chữ', () => addAt('text', at)], ['＋ Thêm vùng / khung', () => addAt('zone', at)], '-', ['☐ Chọn tất cả (Ctrl+A)', ACT.all], ['⤢ Vừa khung', fit],
    ];
    const m = document.createElement('div');
    m.className = 'dg-menu';
    m.innerHTML = items.map((it, i) => (it === '-' ? '<hr>' : `<button data-i="${i}"${it[2] ? ' class="danger"' : ''}>${esc(it[0])}</button>`)).join('');
    root.appendChild(m);
    const r = root.getBoundingClientRect();
    m.style.left = Math.min(e.clientX - r.left, r.width - m.offsetWidth - 6) + 'px';
    m.style.top = Math.min(e.clientY - r.top, r.height - m.offsetHeight - 6) + 'px';
    m.onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; closeMenu(); items[+b.dataset.i][1](); };
  });
  function setEdge(patch, swap) {
    const es = sel().filter((x) => x.a);
    mut(() => { for (const e of es) { if (swap) Object.assign(e, patch); else D.update(dg, e.id, patch); } });
    render();
  }

  // ---------------------------------------------------------------- phím tắt
  const onKey = (e) => {
    if (!alive()) { document.removeEventListener('keydown', onKey); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === ' ') { st.space = true; stage.classList.add('space'); e.preventDefault(); return; }
    const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') { if (root.querySelector('.dg-menu')) closeMenu(); else { st.sel = []; render(); } return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); ACT.del(); return; }
    if (e.key === 'F2') { e.preventDefault(); const s = selShapes()[0]; if (s) editText(s.id); return; }
    if (e.key.startsWith('Arrow')) {
      const ss = selShapes(); if (!ss.length) return;
      e.preventDefault();
      const n = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
      mut(() => D.move(dg, ss.map((s) => s.id), dx, dy)); render(); return;
    }
    if (!c) return;
    const map = { z: e.shiftKey ? 'redo' : 'undo', y: 'redo', c: 'copy', x: 'cut', v: 'paste', d: 'dup', a: 'all', g: e.shiftKey ? 'ungroup' : 'group', '=': 'zin', '+': 'zin', '-': 'zout', '0': 'z100', ']': 'front', '[': 'back', s: 'save' };
    if (k === 'h' && e.shiftKey) { e.preventDefault(); fit(); return; }
    const a = map[k];
    if (!a) return;
    e.preventDefault();
    if (a === 'save') { save('diagram', JSON.parse(D.exportJson(dg))); $('dg-status').textContent = '💾 Đã lưu sơ đồ trong trình duyệt (tự lưu sau mỗi thay đổi; ⬇ Xuất để lưu ra file).'; return; }
    ACT[a]();
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', (e) => { if (e.key === ' ') { st.space = false; stage.classList.remove('space'); } });
  root.addEventListener('pointerdown', (e) => { if (!e.target.closest('.dg-menu')) closeMenu(); }, true);

  renderLib();
  render();
  if (!load('diagram-view', null)) fit();
}
