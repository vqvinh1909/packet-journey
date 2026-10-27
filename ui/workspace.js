// ui/workspace.js — "🧱 Tự dựng mạng riêng": workspace toàn màn hình kiểu EVE-NG.
//   • Canvas lớn: kéo thả thiết bị, kéo nền để cuộn, Ctrl + lăn chuột (hoặc nút −/+) để phóng to/thu nhỏ.
//   • Bảng thiết bị chia theo hãng; hộp thoại "Add node" (mẫu, số lượng, tiền tố tên, số cổng, xem trước tên cổng).
//   • Thiết bị mới ở trạng thái TẮT (xám); Start → log khởi động rồi mới gõ lệnh (xanh); Stop → link xuống.
//   • Chuột phải: thiết bị (Start/Stop/Wipe/Console/Đổi tên/Nhân bản/Xoá), dây (Xoá dây), nền (Add node…).
//   • Nhiều cửa sổ console nổi cùng lúc (kéo, đổi kích thước, thu nhỏ, đóng) — lịch sử ↑/↓, Tab, "?", dán nhiều dòng.
// Logic mạng/thiết bị ở lab/sandbox.js; mạng tự lưu vào localStorage ("sandbox-net"), xuất/nhập JSON.

import { createCli } from '../lab/ios.js';
import * as N from '../lab/net.js';
import { checkLab } from '../lab/labs.js';
import * as S from '../lab/sandbox.js';
import { GUI_VENDORS } from '../lab/guifw.js';
import { renderGuiFw } from './guifw.js';
import { load, save } from './store.js';
import { el, esc, isHost, drawGlyph, adminUp, classifyLine, stpBlocked } from './topo.js';

const MAX_LINES = 800;
const BOOT_MS = 160; // mỗi dòng log khởi động
const LAB = S.SANDBOX_LAB;
let W = null; // trạng thái workspace — giữ nguyên khi đóng / mở lại trong cùng phiên trình duyệt

function freshState() {
  let net;
  try { net = S.importSandbox(load('sandbox-net', null)); } catch { net = S.emptySandbox(); }
  return { net, cli: createCli(net), undo: S.createHistory(), term: {}, hist: {}, gui: {}, wins: [], z: 20, view: load('sandbox-view', null), sel: null, tool: null, pick: [], boot: {}, side: false, hintN: 0, pal: typeof window === 'undefined' || window.innerWidth > 760 };
}

export function openWorkspace({ onRun }) {
  document.querySelector('.ws')?.remove();
  W ||= freshState();
  const root = document.createElement('div');
  root.className = 'ws';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Workspace tự dựng mạng');
  root.innerHTML =
    `<div class="ws-top">` +
    `<button id="ws-pal-t" title="Ẩn/hiện bảng thiết bị">☰</button><span class="ws-title">🧱 Tự dựng mạng</span>` +
    `<button id="ws-add" class="btn-accent" title="Thêm thiết bị (chuột phải vào nền cũng được)">＋ Add node</button>` +
    `<button id="ws-wire" title="Chọn 2 thiết bị rồi chọn cổng">🔗 Nối dây</button><span class="ws-sep"></span>` +
    `<button id="ws-start" class="ws-go" title="Bật mọi thiết bị đang tắt">▶ Start all</button><button id="ws-stop" class="ws-halt" title="Tắt mọi thiết bị">■ Stop all</button><span class="ws-sep"></span>` +
    `<button id="ws-undo" title="Hoàn tác (Ctrl+Z khi không gõ console)">↶</button><button id="ws-redo" title="Làm lại (Ctrl+Y)">↷</button>` +
    `<select id="ws-tpl" title="Nạp mạng mẫu (chỉ thiết bị + dây, bạn tự cấu hình)"><option value="">📐 Mạng mẫu…</option>${S.SANDBOX_TEMPLATES.map((t) => `<option value="${t.id}" title="${esc(t.desc)}">${esc(t.title)}</option>`).join('')}</select>` +
    `<button id="ws-exp" title="Tải mạng về máy">⬇ Xuất JSON</button><button id="ws-imp" title="Mở file mạng đã xuất (kể cả file cũ)">⬆ Nhập JSON</button><button id="ws-clr" title="Bắt đầu lại từ mạng trống">🧹 Xoá hết</button>` +
    `<span class="ws-grow"></span><button id="ws-side-t" title="Nhiệm vụ gợi ý lộ trình"></button><button id="ws-close" title="Đóng workspace (mạng vẫn được lưu)">✕ Đóng</button>` +
    `<input type="file" id="ws-file" accept=".json,application/json" hidden></div>` +
    `<div class="ws-body"><aside class="ws-pal" id="ws-pal"></aside>` +
    `<div class="ws-stage" id="ws-stage"><svg class="ws-svg" id="ws-svg" role="img" aria-label="topology"><defs><pattern id="ws-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="ws-gridl"/></pattern></defs><g id="ws-world"></g></svg>` +
    `<div class="ws-empty" id="ws-empty">Kéo thiết bị từ bảng bên trái vào đây — hoặc chuột phải vào nền → <b>Add node</b>.<br>Thiết bị mới ở trạng thái <b>tắt</b>: chuột phải → <b>Start</b> (hoặc ▶ Start all). Nháy đúp để mở console.</div>` +
    `<div class="ws-zoom"><button data-z="-" title="Thu nhỏ">−</button><span id="ws-zl"></span><button data-z="+" title="Phóng to">+</button><button data-z="fit" title="Vừa khung">⤢</button></div>` +
    `<div class="ws-stat" id="ws-stat"></div></div>` +
    `<aside class="ws-side" id="ws-side" hidden></aside></div>` +
    `<div class="ws-dock" id="ws-dock"></div>`;
  document.body.appendChild(root);
  const $ = (id) => root.querySelector('#' + id);
  const net = () => W.net;
  const stage = $('ws-stage'), svg = $('ws-svg'), world = $('ws-world');
  const alive = () => document.body.contains(root);

  // ---------------------------------------------------------------- lưu / hoàn tác
  const persist = () => { clearTimeout(persist.t); persist.t = setTimeout(() => save('sandbox-net', S.exportSandbox(W.net)), 150); };
  const saveView = () => { clearTimeout(saveView.t); saveView.t = setTimeout(() => save('sandbox-view', W.view), 300); };
  const mut = (fn) => W.undo.track(W.net, fn);
  function afterStructural() {
    for (const w of [...W.wins]) if (!net().devices[w.id]) closeWin(w.id);
    if (W.sel && !net().devices[W.sel]) W.sel = null;
    W.pick = W.pick.filter((id) => net().devices[id]);
    persist();
    draw();
    renderWins();
    scheduleSide();
  }
  function undoRedo(redo) {
    if (!(redo ? W.undo.redo(W.net) : W.undo.undo(W.net))) return;
    afterStructural();
  }

  // ---------------------------------------------------------------- bảng thiết bị theo hãng
  function renderPalette() {
    const pal = $('ws-pal');
    pal.hidden = !W.pal;
    pal.innerHTML = '<div class="ws-pal-h">Thiết bị <small>(kéo vào canvas hoặc bấm)</small></div>' + S.SANDBOX_VENDORS.map((v) => `<div class="ws-vg"><div class="ws-vh">${esc(v.name)}</div>` +
      v.kinds.map((k) => `<button class="ws-pi" data-kind="${k}" draggable="true" title="Add node: ${esc(S.SANDBOX_KINDS[k].label)}"><svg viewBox="-32 -26 64 52" class="ws-pic" aria-hidden="true"></svg><span>${esc(S.SANDBOX_KINDS[k].label)}</span></button>`).join('') + '</div>').join('');
    pal.querySelectorAll('.ws-pi').forEach((b) => {
      const k = b.dataset.kind;
      const K = S.SANDBOX_KINDS[k];
      const sample = K.make('x', 'x', 0, 0, K.ports ? K.ports.names(K.ports.def) : null);
      drawGlyph(b.querySelector('svg'), sample);
      b.onclick = () => openAddDialog(k, viewCenter());
      b.ondragstart = (e) => { e.dataTransfer.setData('text/x-pj-kind', k); e.dataTransfer.effectAllowed = 'copy'; };
    });
  }
  stage.ondragover = (e) => { if (e.dataTransfer.types.includes('text/x-pj-kind')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
  stage.ondrop = (e) => {
    const k = e.dataTransfer.getData('text/x-pj-kind');
    if (!k) return;
    e.preventDefault();
    openAddDialog(k, toWorld(e));
  };

  // ---------------------------------------------------------------- khung nhìn: cuộn / phóng to
  const clampK = (k) => Math.max(0.25, Math.min(3, k));
  function applyView() {
    const v = W.view;
    world.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.k})`);
    $('ws-zl').textContent = Math.round(v.k * 100) + '%';
    saveView();
  }
  function toWorld(e) {
    const r = stage.getBoundingClientRect(), v = W.view;
    return { x: (e.clientX - r.left - v.x) / v.k, y: (e.clientY - r.top - v.y) / v.k };
  }
  function viewCenter() {
    const r = stage.getBoundingClientRect(), v = W.view;
    return { x: (r.width / 2 - v.x) / v.k - 120, y: (r.height / 2 - v.y) / v.k - 40 };
  }
  function zoomAt(f, cx, cy) {
    const v = W.view, k = clampK(v.k * f);
    v.x = cx - ((cx - v.x) * k) / v.k;
    v.y = cy - ((cy - v.y) * k) / v.k;
    v.k = k;
    applyView();
  }
  function fit() {
    const r = stage.getBoundingClientRect();
    const ds = Object.values(net().devices);
    const box = ds.length ? { x0: Math.min(...ds.map((d) => d.x)) - 90, y0: Math.min(...ds.map((d) => d.y)) - 60, x1: Math.max(...ds.map((d) => d.x)) + 90, y1: Math.max(...ds.map((d) => d.y)) + 80 } : { x0: 0, y0: 0, x1: 1000, y1: 600 };
    const k = clampK(Math.min((r.width || 1000) / (box.x1 - box.x0), (r.height || 600) / (box.y1 - box.y0), 1.4));
    W.view = { k, x: ((r.width || 1000) - (box.x1 - box.x0) * k) / 2 - box.x0 * k, y: ((r.height || 600) - (box.y1 - box.y0) * k) / 2 - box.y0 * k };
    applyView();
  }
  root.querySelector('.ws-zoom').onclick = (e) => {
    const z = e.target.dataset?.z;
    if (!z) return;
    const r = stage.getBoundingClientRect();
    if (z === 'fit') fit(); else zoomAt(z === '+' ? 1.2 : 1 / 1.2, r.width / 2, r.height / 2);
  };
  stage.addEventListener('wheel', (e) => {
    if (e.target.closest('.ws-zoom')) return;
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    else { W.view.x -= e.shiftKey ? e.deltaY : e.deltaX; W.view.y -= e.shiftKey ? 0 : e.deltaY; applyView(); }
  }, { passive: false });

  // ---------------------------------------------------------------- vẽ topology
  const stateOf = (d) => (S.isOff(d) ? 'off' : W.boot[d.id] ? 'boot' : 'on');
  function draw() {
    if (!alive()) return;
    const n = net();
    world.innerHTML = '';
    world.appendChild(el('rect', { x: 0, y: 0, width: S.SANDBOX_VIEW.w, height: S.SANDBOX_VIEW.h, class: 'ws-paper' }));
    const ds = Object.values(n.devices);
    $('ws-empty').hidden = ds.length > 0;
    const pairN = {}, pairI = {};
    for (const l of n.links) { const k = [l.a, l.b].sort().join('|'); pairN[k] = (pairN[k] || 0) + 1; }
    const blk = ds.length ? stpBlocked(n) : new Map();
    const gL = el('g', {}), gT = el('g', {}), gN = el('g', {});
    world.append(gL, gT, gN);
    for (const l of n.links) {
      const A = n.devices[l.a], B = n.devices[l.b];
      const k = [l.a, l.b].sort().join('|');
      const i = (pairI[k] = (pairI[k] ?? -1) + 1);
      const off = (i - (pairN[k] - 1) / 2) * 16;
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * off, oy = (dx / len) * off;
      const up = N.lineUp(n, l.a, l.ap) && N.lineUp(n, l.b, l.bp);
      const cls = up ? 'up' : S.isOff(A) || S.isOff(B) ? 'down' : !adminUp(n, l.a, l.ap) || !adminUp(n, l.b, l.bp) ? 'admin' : 'down';
      const geo = { x1: A.x + ox, y1: A.y + oy, x2: B.x + ox, y2: B.y + oy };
      gL.appendChild(el('line', { ...geo, class: 'lab-link ' + cls }));
      const hit = el('line', { ...geo, class: 'ws-link-hit', 'data-link': l.id });
      const tt = el('title', {});
      tt.textContent = `${A.name} ${N.shortIf(l.ap)} ↔ ${B.name} ${N.shortIf(l.bp)} — chuột phải để xoá dây`;
      hit.appendChild(tt);
      gL.appendChild(hit);
      for (const [D, port, t] of [[A, l.ap, 0.24], [B, l.bp, 0.76]]) {
        const px = A.x + dx * t + ox, py = A.y + dy * t + oy;
        const bv = blk.get(D.id + '|' + port);
        const label = (isHost(D) ? 'Fa0' : N.shortIf(port)) + (bv ? ' ✕' : '');
        const w = label.length * 6.6 + 8;
        gT.appendChild(el('rect', { x: px - w / 2, y: py - 8, width: w, height: 15, rx: 4, class: 'lab-port-bg' + (bv ? ' blk' : '') }));
        const tx = el('text', { x: px, y: py + 3.5, 'text-anchor': 'middle', class: 'lab-port' + (bv ? ' blk' : '') });
        tx.textContent = label;
        gT.appendChild(tx);
      }
    }
    for (const d of ds) {
      const st = stateOf(d);
      const g = el('g', { class: `lab-node ws-node ${st}${d.id === W.sel ? ' sel' : ''}${W.pick.includes(d.id) ? ' pick' : ''}`, 'data-id': d.id, tabindex: 0, role: 'button', 'aria-label': d.name });
      g.appendChild(el('circle', { cx: d.x, cy: d.y, r: 33, class: 'lab-halo' }));
      const gg = el('g', { class: 'ws-glyph' });
      drawGlyph(gg, d);
      g.appendChild(gg);
      g.appendChild(el('circle', { cx: d.x + 27, cy: d.y - 22, r: 6, class: 'ws-dot ' + st }));
      const nm = el('text', { x: d.x, y: d.y + 44, 'text-anchor': 'middle', class: 'lab-name' });
      nm.textContent = d.name;
      g.appendChild(nm);
      const sub = el('text', { x: d.x, y: d.y + 58, 'text-anchor': 'middle', class: 'lab-ip' });
      sub.textContent = isHost(d) ? (d.ip ? `${d.ip}/${d.prefix}` : d.dhcp ? 'DHCP' : '') : S.SANDBOX_KINDS[S.kindOf(d)]?.label || '';
      g.appendChild(sub);
      const tt = el('title', {});
      tt.textContent = `${d.name} — ${st === 'off' ? 'đang tắt' : st === 'boot' ? 'đang khởi động' : 'đang chạy'} · nháy đúp: console · chuột phải: menu`;
      g.appendChild(tt);
      gN.appendChild(g);
    }
    applyView();
    renderStat();
    renderTopBtns();
  }
  function renderStat() {
    const ds = Object.values(net().devices);
    const on = ds.filter((d) => !S.isOff(d)).length;
    const tool = W.tool === 'wire' ? (W.pick.length ? ` · 🔗 Đã chọn ${esc(net().devices[W.pick[0]]?.name)} — chọn thiết bị thứ 2 (Esc để thoát)` : ' · 🔗 Chọn thiết bị thứ nhất (Esc để thoát)') : '';
    $('ws-stat').innerHTML = `${ds.length} thiết bị · <span class="ws-on">${on} đang chạy</span> · ${net().links.length} dây${tool}`;
  }
  function renderTopBtns() {
    $('ws-undo').disabled = !W.undo.canUndo;
    $('ws-redo').disabled = !W.undo.canRedo;
    $('ws-wire').classList.toggle('on', W.tool === 'wire');
  }
  function setSel(id) {
    W.sel = id;
    world.querySelectorAll('.ws-node').forEach((g) => g.classList.toggle('sel', g.dataset.id === id));
  }

  // ---------------------------------------------------------------- chuột trên canvas: chọn, kéo, cuộn, nháy đúp, chuột phải
  let lastClick = { id: null, t: 0 };
  stage.addEventListener('pointerdown', (e) => {
    closeMenu();
    if (e.target.closest('.ws-zoom, .ws-empty b')) return;
    const node = e.target.closest('.ws-node');
    if (e.button === 2) return;
    if (node && e.button === 0) { nodeDown(e, node.dataset.id); return; }
    if (e.button === 0 || e.button === 1) panStart(e);
  });
  function panStart(e) {
    const v = W.view, sx = e.clientX, sy = e.clientY, x0 = v.x, y0 = v.y;
    let moved = false;
    stage.classList.add('panning');
    const move = (ev) => { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 3) moved = true; v.x = x0 + ev.clientX - sx; v.y = y0 + ev.clientY - sy; applyView(); };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      stage.classList.remove('panning');
      if (!moved) setSel(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  function nodeDown(e, id) {
    if (W.tool === 'wire') { wirePick(id); return; }
    const d = net().devices[id], p0 = toWorld(e);
    const g = { dx: d.x - p0.x, dy: d.y - p0.y, sx: e.clientX, sy: e.clientY, moved: false, before: W.undo.snapshot(W.net), raf: 0 };
    setSel(id);
    const move = (ev) => {
      if (!g.moved && Math.hypot(ev.clientX - g.sx, ev.clientY - g.sy) < 4) return;
      g.moved = true;
      const p = toWorld(ev);
      S.moveDevice(W.net, id, p.x + g.dx, p.y + g.dy);
      if (!g.raf) g.raf = requestAnimationFrame(() => { g.raf = 0; draw(); });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (g.moved) { W.undo.commit(W.net, g.before); persist(); draw(); return; }
      const now = Date.now();
      if (lastClick.id === id && now - lastClick.t < 400) { lastClick = { id: null, t: 0 }; openConsole(id); }
      else lastClick = { id, t: now };
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  stage.addEventListener('keydown', (e) => {
    const node = e.target.closest?.('.ws-node');
    if (node && e.key === 'Enter') openConsole(node.dataset.id);
  });
  stage.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const node = e.target.closest('.ws-node');
    const link = e.target.closest('[data-link]');
    if (node) { setSel(node.dataset.id); nodeMenu(node.dataset.id, e); }
    else if (link) linkMenu(link.dataset.link, e);
    else bgMenu(e);
  });

  // ---------------------------------------------------------------- menu chuột phải
  function showMenu(items, e) {
    closeMenu();
    const m = document.createElement('div');
    m.className = 'ws-menu';
    m.setAttribute('role', 'menu');
    m.innerHTML = items.map((it, i) => (it === '-' ? '<hr>' : it.head ? `<div class="ws-mh">${esc(it.head)}</div>` : `<button role="menuitem" data-i="${i}"${it.disabled ? ' disabled' : ''}${it.danger ? ' class="danger"' : ''}>${esc(it.label)}</button>`)).join('');
    root.appendChild(m);
    const r = root.getBoundingClientRect();
    m.style.left = Math.min(e.clientX - r.left, r.width - m.offsetWidth - 6) + 'px';
    m.style.top = Math.min(e.clientY - r.top, r.height - m.offsetHeight - 6) + 'px';
    m.onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; closeMenu(); items[+b.dataset.i].act(); };
    m.querySelector('button:not([disabled])')?.focus();
  }
  function closeMenu() { root.querySelector('.ws-menu')?.remove(); }
  function nodeMenu(id, e) {
    const d = net().devices[id];
    const off = S.isOff(d);
    showMenu([
      { head: `${d.name} · ${S.SANDBOX_KINDS[S.kindOf(d)]?.label || d.type}` },
      { label: '▶ Start', act: () => startDev(id), disabled: !off },
      { label: '■ Stop', act: () => stopDev(id), disabled: off },
      { label: '⟲ Wipe (về cấu hình trống)', act: () => wipeDev(id) },
      '-',
      { label: '🖥 Console', act: () => openConsole(id) },
      { label: '🔗 Nối dây từ đây', act: () => { W.tool = 'wire'; W.pick = [id]; draw(); } },
      { label: '✏ Đổi tên', act: () => renameDev(id) },
      { label: '⧉ Nhân bản', act: () => { const nid = mut(() => S.duplicateDevice(W.net, id)); persist(); W.sel = nid; draw(); scheduleSide(); } },
      '-',
      { label: '🗑 Xoá', act: () => deleteDev(id), danger: true },
    ], e);
  }
  function linkMenu(lid, e) {
    const l = net().links.find((x) => x.id === lid);
    if (!l) return;
    const A = net().devices[l.a], B = net().devices[l.b];
    showMenu([{ head: `${A.name} ${N.shortIf(l.ap)} ↔ ${B.name} ${N.shortIf(l.bp)}` }, { label: '✂ Xoá dây', act: () => { mut(() => S.disconnect(W.net, lid)); afterStructural(); }, danger: true }], e);
  }
  function bgMenu(e) {
    const at = toWorld(e);
    showMenu([
      { label: '＋ Add node…', act: () => openAddDialog(null, at) },
      { label: '▶ Start all', act: () => powerAll(true) },
      { label: '■ Stop all', act: () => powerAll(false) },
      '-',
      { label: '⤢ Vừa khung', act: fit },
    ], e);
  }

  // ---------------------------------------------------------------- hộp thoại
  function dialog(html, onReady) {
    root.querySelector('.ws-dlg-back')?.remove();
    const back = document.createElement('div');
    back.className = 'ws-dlg-back';
    back.innerHTML = `<div class="ws-dlg" role="dialog">${html}</div>`;
    root.appendChild(back);
    const close = () => back.remove();
    back.onpointerdown = (e) => { if (e.target === back) close(); };
    onReady(back.querySelector('.ws-dlg'), close);
  }
  function openAddDialog(kind, at) {
    closeMenu();
    const kinds = S.SANDBOX_VENDORS.map((v) => `<optgroup label="${esc(v.name)}">${v.kinds.map((k) => `<option value="${k}">${esc(S.SANDBOX_KINDS[k].label)}</option>`).join('')}</optgroup>`).join('');
    dialog(`<h3>＋ Add node</h3>` +
      `<label>Mẫu thiết bị <select id="ad-kind">${kinds}</select></label>` +
      `<div class="ws-row"><label>Số lượng <input id="ad-n" type="number" min="1" max="20" value="1"></label><label>Tiền tố tên <input id="ad-pre" maxlength="20" autocomplete="off"></label></div>` +
      `<label id="ad-pl">Số cổng <span id="ad-pc"></span></label>` +
      `<div class="ws-ports" id="ad-prev"></div><div class="ws-err" id="ad-err"></div>` +
      `<div class="ws-dlg-b"><button id="ad-ok" class="btn-accent">Thêm</button><button id="ad-x">Huỷ</button></div>`, (dlg, close) => {
      const q = (id) => dlg.querySelector('#' + id);
      let preEdited = false;
      q('ad-kind').value = kind || 'router';
      const ports = () => q('ad-ports')?.value;
      const upd = (kindChanged) => {
        const k = q('ad-kind').value, K = S.SANDBOX_KINDS[k], P = K.ports;
        if (kindChanged && !preEdited) q('ad-pre').value = K.prefix;
        if (kindChanged) {
          q('ad-pl').hidden = !P;
          q('ad-pc').innerHTML = !P ? '' : P.choices ? `<select id="ad-ports">${P.choices.map((c) => `<option${c === P.def ? ' selected' : ''}>${c}</option>`).join('')}</select> ${esc(P.unit)}` : `<input id="ad-ports" type="number" min="${P.min}" max="${P.max}" value="${P.def}"> ${esc(P.unit)} (${P.min}–${P.max})`;
          q('ad-ports')?.addEventListener('input', () => upd(false));
        }
        const names = S.portNames(k, ports());
        q('ad-prev').textContent = 'Cổng: ' + (names.length > 14 ? [...names.slice(0, 6), '…', ...names.slice(-4)] : names).map((p) => (isHost({ type: k }) ? 'Fa0' : N.shortIf(p))).join(', ');
      };
      q('ad-kind').onchange = () => upd(true);
      q('ad-pre').oninput = () => { preEdited = true; };
      upd(true);
      q('ad-x').onclick = close;
      const ok = () => {
        const k = q('ad-kind').value;
        const pos = S.freeSpotNear(W.net, at.x, at.y, Math.max(1, Math.min(20, +q('ad-n').value || 1)));
        const r = mut(() => S.addNodes(W.net, k, { count: q('ad-n').value, prefix: q('ad-pre').value, ports: ports() }, pos.x, pos.y));
        if (r.error) { q('ad-err').textContent = r.error; return; }
        close();
        W.sel = r.ids[0];
        afterStructural();
      };
      q('ad-ok').onclick = ok;
      dlg.onkeydown = (e) => { if (e.key === 'Enter' && e.target.tagName !== 'SELECT') ok(); };
      q('ad-kind').focus();
    });
  }
  function wirePick(id) {
    if (W.pick[0] === id) return;
    W.pick = W.pick.length ? [W.pick[0], id] : [id];
    draw();
    if (W.pick.length < 2) return;
    const [a, b] = W.pick;
    const A = net().devices[a], B = net().devices[b];
    const fa = S.freePorts(W.net, a), fb = S.freePorts(W.net, b);
    const opt = (d, list) => list.map((p) => `<option value="${p}">${isHost(d) ? 'Fa0' : N.longIf(p)}</option>`).join('');
    dialog(`<h3>🔗 Nối dây</h3>` + (!fa.length || !fb.length ? `<div class="ws-err">${esc(!fa.length ? A.name : B.name)} không còn cổng trống.</div><div class="ws-dlg-b"><button id="w-x">Đóng</button></div>` :
      `<div class="ws-row"><label>${esc(A.name)} <select id="w-a">${opt(A, fa)}</select></label><label>${esc(B.name)} <select id="w-b">${opt(B, fb)}</select></label></div><div class="ws-err" id="w-err"></div><div class="ws-dlg-b"><button id="w-ok" class="btn-accent">Nối</button><button id="w-x">Huỷ</button></div>`), (dlg, close) => {
      const done = () => { close(); W.pick = []; W.tool = null; draw(); };
      dlg.querySelector('#w-x').onclick = done;
      const okb = dlg.querySelector('#w-ok');
      if (!okb) return;
      okb.onclick = () => {
        const err = mut(() => S.connect(W.net, a, dlg.querySelector('#w-a').value, b, dlg.querySelector('#w-b').value));
        if (err) { dlg.querySelector('#w-err').textContent = err; return; }
        done();
        afterStructural();
      };
      okb.focus();
    });
  }

  // ---------------------------------------------------------------- thao tác thiết bị
  function resetSession(id) {
    const se = W.cli.session(id);
    Object.assign(se, { mode: 'user', ifs: [], pw: null, ask: null, loggedOut: false, ssh: null, fz: null, panCfg: false });
  }
  function startDev(id) {
    const d = net().devices[id];
    if (!d || !S.isOff(d)) return;
    const lines = S.startDevice(W.net, id);
    resetSession(id);
    const T = termOf(id);
    T.push({ t: `— ▶ Start ${d.name} —`, c: 'sys' });
    W.boot[id] = true;
    let i = 0;
    const tick = () => {
      if (!W.boot[id]) return;
      if (i < lines.length) { T.push({ t: lines[i++], c: 'boot' }); refreshWin(id); setTimeout(tick, BOOT_MS); return; }
      delete W.boot[id];
      T.push({ t: isHost(d) || GUI_VENDORS[d.os] ? '(sẵn sàng)' : '(sẵn sàng — gõ lệnh)', c: 'sys' });
      refreshWin(id, true);
      draw();
      scheduleSide();
    };
    tick();
    persist();
    draw();
    scheduleSide();
  }
  function stopDev(id) {
    const d = net().devices[id];
    if (!d || S.isOff(d)) return;
    delete W.boot[id];
    S.stopDevice(W.net, id);
    resetSession(id);
    termOf(id).push({ t: `— ■ Stop ${d.name}: thiết bị đã tắt, mọi cổng down, console ngắt kết nối —`, c: 'sys' });
    refreshWin(id, true);
    persist();
    draw();
    scheduleSide();
  }
  function powerAll(on) {
    for (const d of Object.values(net().devices)) (on ? startDev : stopDev)(d.id);
  }
  function wipeDev(id) {
    const d = net().devices[id];
    if (!confirm(`Wipe ${d.name}? Toàn bộ cấu hình của thiết bị bị xoá về trống và thiết bị sẽ tắt (dây giữ nguyên). Có thể ↶ Hoàn tác.`)) return;
    delete W.boot[id];
    mut(() => S.wipeDevice(W.net, id));
    resetSession(id);
    delete W.gui[id];
    W.term[id] = [];
    termOf(id).push({ t: `— ⟲ Wipe ${d.name}: cấu hình đã về trống —`, c: 'sys' });
    refreshWin(id, true);
    afterStructural();
  }
  function renameDev(id) {
    const d = net().devices[id];
    const nm = prompt(`Tên mới cho ${d.name}:`, d.name);
    if (nm == null) return;
    const err = mut(() => S.renameDevice(W.net, id, nm));
    if (err) { alert(err); return; }
    afterStructural();
  }
  function deleteDev(id) {
    const d = net().devices[id];
    if (!confirm(`Xoá ${d.name} cùng mọi dây nối với nó? (Có thể ↶ Hoàn tác)`)) return;
    delete W.boot[id];
    mut(() => S.removeDevice(W.net, id));
    delete W.term[id];
    delete W.hist[id];
    afterStructural();
  }

  // ---------------------------------------------------------------- console nhiều cửa sổ
  function termOf(id) {
    if (!W.term[id]) {
      const d = net().devices[id];
      W.term[id] = [{ t: isHost(d) ? `${d.name} — dòng lệnh máy trạm (gõ ? để xem lệnh)` : `${d.name} console — ? trợ giúp, Tab hoàn thành lệnh, ↑/↓ lịch sử, Ctrl+Z = end, dán nhiều dòng cấu hình`, c: 'sys' }];
    }
    return W.term[id];
  }
  function openConsole(id) {
    if (!net().devices[id]) return;
    let w = W.wins.find((x) => x.id === id);
    if (w) { w.min = false; w.z = ++W.z; }
    else {
      const r = root.getBoundingClientRect();
      const n = W.wins.length;
      const top = root.querySelector('.ws-top').offsetHeight + 10;
      const ww = Math.min(560, r.width - 20), hh = Math.min(340, r.height - top - 60);
      w = { id, w: ww, h: hh, x: Math.max(10, r.width - ww - 30 - (n % 5) * 34), y: top + (n % 5) * 34, z: ++W.z, min: false };
      W.wins.push(w);
    }
    renderWins();
    focusWin(id);
  }
  function closeWin(id) {
    W.wins = W.wins.filter((x) => x.id !== id);
    root.querySelector(`.ws-win[data-id="${CSS.escape(id)}"]`)?.remove();
    renderDock();
  }
  function focusWin(id) {
    const w = W.wins.find((x) => x.id === id);
    const e = root.querySelector(`.ws-win[data-id="${CSS.escape(id)}"]`);
    if (!w || !e) return;
    w.z = ++W.z;
    e.style.zIndex = w.z;
    e.querySelector('.lab-in:not([disabled])')?.focus();
  }
  function renderWins() {
    if (!alive()) return;
    const have = new Set(W.wins.map((w) => w.id));
    root.querySelectorAll('.ws-win').forEach((e) => { if (!have.has(e.dataset.id)) e.remove(); });
    for (const w of W.wins) {
      let e = root.querySelector(`.ws-win[data-id="${CSS.escape(w.id)}"]`);
      const isNew = !e;
      if (isNew) e = buildWin(w);
      Object.assign(e.style, { left: w.x + 'px', top: w.y + 'px', width: w.w + 'px', height: w.h + 'px', zIndex: w.z });
      e.hidden = w.min;
      refreshWin(w.id, isNew);
    }
    renderDock();
  }
  function renderDock() {
    const dock = $('ws-dock');
    const mins = W.wins.filter((w) => w.min);
    dock.hidden = !mins.length;
    dock.innerHTML = mins.map((w) => `<button data-id="${esc(w.id)}" title="Mở lại console">🖥 ${esc(net().devices[w.id]?.name || w.id)}</button>`).join('');
    dock.querySelectorAll('button').forEach((b) => (b.onclick = () => openConsole(b.dataset.id)));
  }
  function buildWin(w) {
    const e = document.createElement('div');
    e.className = 'ws-win';
    e.dataset.id = w.id;
    e.innerHTML = `<div class="ws-wh"><i class="ws-wdot"></i><b class="ws-wn"></b><span class="ws-wk"></span><span class="ws-grow"></span><button data-w="min" title="Thu nhỏ xuống thanh dưới">▁</button><button data-w="close" title="Đóng console">✕</button></div><div class="ws-wbody"></div>`;
    root.appendChild(e);
    e.addEventListener('pointerdown', () => { if (w.z !== W.z) { w.z = ++W.z; e.style.zIndex = w.z; } });
    e.querySelector('[data-w="min"]').onclick = () => { w.min = true; e.hidden = true; renderDock(); };
    e.querySelector('[data-w="close"]').onclick = () => closeWin(w.id);
    // kéo cửa sổ bằng thanh tiêu đề
    e.querySelector('.ws-wh').addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('button') || ev.button !== 0) return;
      const sx = ev.clientX, sy = ev.clientY, x0 = w.x, y0 = w.y, r = root.getBoundingClientRect();
      const move = (m) => { w.x = Math.max(-w.w + 80, Math.min(r.width - 60, x0 + m.clientX - sx)); w.y = Math.max(0, Math.min(r.height - 30, y0 + m.clientY - sy)); e.style.left = w.x + 'px'; e.style.top = w.y + 'px'; };
      const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    // đổi kích thước (CSS resize) → nhớ lại khi vẽ lại
    new ResizeObserver(() => { if (!e.hidden && e.offsetWidth) { w.w = e.offsetWidth; w.h = e.offsetHeight; } }).observe(e);
    return e;
  }
  /** Vẽ lại nội dung 1 cửa sổ console (full = dựng lại cả thân: đổi giữa terminal và trang web). */
  function refreshWin(id, full) {
    const e = alive() && root.querySelector(`.ws-win[data-id="${CSS.escape(id)}"]`);
    const d = net().devices[id];
    if (!e || !d) return;
    const st = stateOf(d);
    e.querySelector('.ws-wdot').className = 'ws-wdot ' + st;
    e.querySelector('.ws-wn').textContent = d.name;
    e.querySelector('.ws-wk').textContent = `${S.SANDBOX_KINDS[S.kindOf(d)]?.label || ''} · ${st === 'off' ? 'tắt' : st === 'boot' ? 'đang khởi động…' : 'đang chạy'}`;
    const body = e.querySelector('.ws-wbody');
    const mode = st === 'on' && GUI_VENDORS[d.os] ? 'gui' : 'term';
    if (full || body.dataset.mode !== mode) {
      body.dataset.mode = mode;
      // trang quản trị web (renderGuiFw tự đặt className) nằm trong một khung con riêng
      if (mode === 'gui') { body.className = 'ws-wbody ws-guibody'; body.innerHTML = '<div class="ws-guihost"></div>'; renderGui(id, body.firstChild); return; }
      body.className = 'ws-wbody ws-term';
      body.innerHTML = `<div class="lab-out"></div><div class="ws-offbar" hidden>Thiết bị đang tắt. <button class="ws-go">▶ Start</button></div><div class="lab-inrow"><span class="lab-prompt"></span><input class="lab-in" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Nhập lệnh ${esc(d.name)}"></div>`;
      body.querySelector('.ws-offbar button').onclick = () => startDev(id);
      wireInput(id, body.querySelector('.lab-in'));
      body.querySelector('.lab-out').addEventListener('click', () => { if (!window.getSelection()?.toString()) body.querySelector('.lab-in:not([disabled])')?.focus(); });
    }
    if (mode === 'gui') { renderGui(id, body.firstChild); return; }
    const out = body.querySelector('.lab-out');
    out.innerHTML = '';
    for (const ln of termOf(id)) {
      if (ln.sim) {
        const b = document.createElement('button');
        b.className = 'lab-simbtn' + (ln.ok ? ' ok' : ' fail');
        b.textContent = `▶ Xem gói tin đi từng bước (${ln.sim.events.length} bước, byte-thật) — ${ln.label}`;
        b.onclick = () => { root.remove(); onRun(ln.sim, `🧱 Workspace: ${ln.label}. Mở lại "🧪 Lab CLI" → "Tự dựng mạng riêng" để làm tiếp (mạng vẫn giữ nguyên).`); };
        out.appendChild(b);
        continue;
      }
      const div = document.createElement('div');
      div.className = 'lab-ln ' + (ln.c || '');
      div.textContent = ln.t === '' ? ' ' : ln.t;
      out.appendChild(div);
    }
    out.scrollTop = out.scrollHeight;
    const inp = body.querySelector('.lab-in');
    const ready = st === 'on';
    inp.disabled = !ready;
    inp.placeholder = st === 'boot' ? 'đang khởi động…' : '';
    body.querySelector('.ws-offbar').hidden = st !== 'off';
    body.querySelector('.lab-prompt').textContent = ready ? W.cli.prompt(id) : '';
    const se = W.cli.session(id);
    inp.type = ready && se.pw ? 'password' : 'text';
  }
  function renderGui(id, body) {
    const d = net().devices[id];
    const g = (W.gui[id] ||= {});
    renderGuiFw(body, d, {
      tab: g.tab, ruleIf: g.ruleIf, addOpen: g.addOpen, lastErr: g.err,
      history: termOf(id).filter((l) => l.c === 'cmd').map((l) => l.t),
      setTab: (t) => { g.tab = t; g.err = null; renderGui(id, body); },
      setRuleIf: (z) => { g.ruleIf = z; renderGui(id, body); },
      run: (cmd, o = {}) => {
        const res = execDev(id, cmd);
        g.err = res?.out.find((l) => l.startsWith('ERROR:')) || null;
        g.addOpen = !!(g.err && o.keepAdd);
        renderGui(id, body);
      },
    });
  }
  function pushOut(id, line, res, pr, hidden) {
    const T = termOf(id);
    T.push({ t: pr + (hidden ? '' : line), c: 'cmd' });
    for (const l of res.out || []) T.push({ t: l, c: classifyLine(l) });
    if (res.why) T.push({ t: '💡 Mô phỏng cho biết: ' + res.why, c: 'why' });
    if (res.sim) T.push({ sim: res.sim, label: res.simLabel || 'gói tin', ok: res.ok !== false });
    if (T.length > MAX_LINES) T.splice(1, T.length - MAX_LINES);
  }
  function execDev(id, line, opts = {}) {
    const d = net().devices[id];
    if (!d) return null;
    if (W.boot[id]) { termOf(id).push({ t: '(đang khởi động — chờ log khởi động chạy xong)', c: 'sys' }); refreshWin(id); return null; }
    const pr = W.cli.prompt(id);
    const wasPw = !!W.cli.session(id).pw;
    let res;
    try { res = mut(() => W.cli.exec(id, line)); } catch (err) { res = { out: ['% Lỗi mô phỏng: ' + err.message] }; }
    pushOut(id, line, res, pr, wasPw);
    if (!opts.noHist && !wasPw && line.trim()) (W.hist[id] ||= []).push(line);
    persist();
    refreshWin(id);
    draw();
    scheduleSide();
    return res;
  }
  function wireInput(id, input) {
    let hpos = -1;
    const run = (v, o) => { execDev(id, v, o); hpos = -1; };
    input.addEventListener('focus', () => focusWin(id));
    input.addEventListener('keydown', (e) => {
      const h = W.hist[id] || [];
      const pw = !!W.cli.session(id).pw;
      if (e.key === 'Enter') { const v = input.value; input.value = ''; run(v); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (!h.length || pw) return; hpos = hpos < 0 ? h.length - 1 : Math.max(0, hpos - 1); input.value = h[hpos]; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (hpos < 0) return; hpos += 1; if (hpos >= h.length) { hpos = -1; input.value = ''; } else input.value = h[hpos]; }
      else if (e.key === 'Tab') { e.preventDefault(); const c = W.cli.complete(id, input.value); if (c) input.value = c; }
      else if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey) { e.preventDefault(); input.value = ''; run('end'); }
      else if (e.key === '?' && !pw) {
        const d = net().devices[id];
        if (d.type === 'router' || d.type === 'switch') {
          // như IOS: hiện trợ giúp ngay khi gõ "?" và giữ nguyên dòng đang gõ
          e.preventDefault();
          const v = input.value;
          run(v + '?', { noHist: true });
          input.value = v;
        }
      }
    });
    // dán cả khối cấu hình → chạy từng dòng như gõ Enter
    input.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      if (!/\r?\n/.test(text)) return;
      e.preventDefault();
      const pos = input.selectionStart ?? input.value.length;
      const lines = (input.value.slice(0, pos) + text + input.value.slice(input.selectionEnd ?? pos)).split(/\r?\n/);
      const rest = lines.pop();
      input.value = '';
      for (const l of lines) run(l.replace(/\t/g, ' '));
      input.value = rest;
    });
  }

  // ---------------------------------------------------------------- nhiệm vụ gợi ý lộ trình
  function scheduleSide() { clearTimeout(scheduleSide.t); scheduleSide.t = setTimeout(renderSide, 60); }
  function renderSide() {
    if (!alive()) return;
    const res = checkLab(LAB, W.net, {});
    const ok = res.filter(Boolean).length;
    $('ws-side-t').textContent = `🧭 Lộ trình ${ok}/${res.length}`;
    $('ws-side-t').classList.toggle('on', W.side);
    const side = $('ws-side');
    side.hidden = !W.side;
    if (!W.side) return;
    side.innerHTML = `<div class="lab-side-h">Lộ trình gợi ý <span class="lab-score${ok === res.length ? ' all' : ''}">${ok}/${res.length}</span></div>` +
      `<div class="lab-bar"><div style="width:${Math.round((ok / res.length) * 100)}%"></div></div>` +
      `<ol class="lab-tasks">${LAB.tasks.map((t, i) => `<li class="${res[i] ? 'ok' : 'no'}"><span class="lab-mk">${res[i] ? '✓' : '○'}</span><div><div class="lab-tt">${esc(t.text)}</div><div class="lab-vf">Kiểm tra: <code>${esc(t.verify)}</code></div></div></li>`).join('')}</ol>` +
      `<div class="lab-acts"><button id="ws-hint">💡 Gợi ý (${W.hintN}/${LAB.hints.length})</button></div>` +
      (W.hintN ? `<ul class="lab-hints">${LAB.hints.slice(0, W.hintN).map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : '');
    $('ws-hint').onclick = () => { if (W.hintN < LAB.hints.length) W.hintN += 1; renderSide(); };
  }

  // ---------------------------------------------------------------- thanh công cụ
  function replaceNet(n) {
    mut(() => { W.net.devices = n.devices; W.net.links = n.links; });
    W.term = {}; W.hist = {}; W.gui = {}; W.boot = {}; W.pick = []; W.sel = null;
    for (const id of Object.keys(n.devices)) resetSession(id);
    afterStructural();
    fit();
  }
  $('ws-pal-t').onclick = () => { W.pal = !W.pal; renderPalette(); };
  $('ws-add').onclick = () => openAddDialog(null, viewCenter());
  $('ws-wire').onclick = () => { W.tool = W.tool === 'wire' ? null : 'wire'; W.pick = []; draw(); };
  $('ws-start').onclick = () => powerAll(true);
  $('ws-stop').onclick = () => powerAll(false);
  $('ws-undo').onclick = () => undoRedo(false);
  $('ws-redo').onclick = () => undoRedo(true);
  $('ws-side-t').onclick = () => { W.side = !W.side; renderSide(); };
  $('ws-close').onclick = () => root.remove();
  $('ws-tpl').onchange = (e) => {
    const t = S.SANDBOX_TEMPLATES.find((x) => x.id === e.target.value);
    e.target.value = '';
    if (!t || (Object.keys(W.net.devices).length && !confirm(`Thay mạng hiện tại bằng mẫu "${t.title}"? (Có thể ↶ Hoàn tác)`))) return;
    replaceNet(t.build());
  };
  $('ws-exp').onclick = () => {
    const blob = new Blob([JSON.stringify(S.exportSandbox(W.net), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'packet-journey-mang.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('ws-imp').onclick = () => $('ws-file').click();
  $('ws-file').onchange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { replaceNet(S.importSandbox(JSON.parse(await f.text()))); }
    catch (err) { alert('Không nhập được file: ' + err.message); }
  };
  $('ws-clr').onclick = () => { if (confirm('Xoá toàn bộ mạng đang dựng? (Có thể ↶ Hoàn tác)')) replaceNet(S.emptySandbox()); };

  // phím tắt: Esc thoát công cụ / menu, Delete xoá thiết bị đang chọn, Ctrl+Z / Ctrl+Y hoàn tác (khi không gõ console)
  const onKey = (e) => {
    if (!alive()) { document.removeEventListener('keydown', onKey); return; }
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
    if (e.key === 'Escape') {
      if (root.querySelector('.ws-menu')) closeMenu();
      else if (root.querySelector('.ws-dlg-back')) { root.querySelector('.ws-dlg-back').remove(); W.pick = []; draw(); }
      else if (W.tool) { W.tool = null; W.pick = []; draw(); }
      return;
    }
    if (typing) return;
    if (e.key === 'Delete' && W.sel) { e.preventDefault(); deleteDev(W.sel); return; }
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'z' || k === 'y') { e.preventDefault(); undoRedo(k === 'y' || e.shiftKey); }
    }
  };
  document.addEventListener('keydown', onKey);
  root.addEventListener('pointerdown', (e) => { if (!e.target.closest('.ws-menu')) closeMenu(); }, true);

  renderPalette();
  if (!W.view) fit();
  draw();
  renderWins();
  renderSide();
}
