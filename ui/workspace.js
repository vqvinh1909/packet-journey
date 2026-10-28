// ui/workspace.js — "🧱 Tự dựng mạng riêng": workspace toàn màn hình kiểu EVE-NG.
//   • Canvas lớn: kéo thả thiết bị, kéo nền để cuộn, Ctrl + lăn chuột (hoặc nút −/+) để phóng to/thu nhỏ.
//   • Bảng thiết bị chia theo hãng; hộp thoại "Add node" (mẫu, số lượng, tiền tố tên, số cổng, xem trước tên cổng).
//   • Thiết bị mới ở trạng thái TẮT (xám); Start → log khởi động rồi mới gõ lệnh (xanh); Stop → link xuống.
//   • Chuột phải: thiết bị (Start/Stop/Wipe/Console/Đổi tên/Nhân bản/Xoá), dây (Xoá dây), nền (Add node…).
//   • Nhiều cửa sổ console nổi cùng lúc (kéo, đổi kích thước, thu nhỏ, đóng) — lịch sử ↑/↓, Tab, "?", dán nhiều dòng.
//   • Capture trên dây (chuột phải vào dây → Start capture): cửa sổ kiểu Wireshark — bảng gói, bộ lọc, cây trường +
//     hex dump (ui/fieldtree.js, ui/hexview.js), tải .pcap. Logic bắt gói ở lab/capture.js.
// Logic mạng/thiết bị ở lab/sandbox.js; mạng tự lưu vào localStorage ("sandbox-net"), xuất/nhập JSON.

import { createCli } from '../lab/ios.js';
import * as N from '../lab/net.js';
import { checkLab } from '../lab/labs.js';
import * as S from '../lab/sandbox.js';
import { GUI_VENDORS } from '../lab/guifw.js';
import { renderGuiFw } from './guifw.js';
import { load, save } from './store.js';
import { el, esc, isHost, drawGlyph, adminUp, classifyLine, stpBlocked, linkEnd } from './topo.js';
import { clockStep, afterCommand, pullLogs as pullClockLogs, renderClockBar, TICK_MS } from './clock.js';
import * as IO from '../lab/configio.js';
import * as LIB from '../lab/labstore.js';
import * as UNL from '../lab/unl.js';
import * as C from '../lab/capture.js';
import { flattenFields } from '../packet/serialize.js';
import { renderFieldTree, highlightFieldRow, clearFieldHighlight } from './fieldtree.js';
import { renderHex, highlightRange, clearHexHighlight } from './hexview.js';

const MAX_LINES = 800;
const BOOT_MS = 160; // mỗi dòng log khởi động
const LAB = S.SANDBOX_LAB;
const nowSec = () => Date.now() / 1000;
const CAP = 'cap:'; // id cửa sổ capture = 'cap:' + id dây (id thiết bị không chứa ":")
let W = null; // trạng thái workspace — giữ nguyên khi đóng / mở lại trong cùng phiên trình duyệt

function freshState() {
  let net;
  try { net = S.importSandbox(load('sandbox-net', null)); } catch { net = S.emptySandbox(); }
  return { net, cli: createCli(net), undo: S.createHistory(), term: {}, hist: {}, gui: {}, wins: [], z: 20, view: load('sandbox-view', null), sel: null, tool: null, pick: [], boot: {}, side: false, hintN: 0, cap: C.createCapture(), capUi: {}, pal: typeof window === 'undefined' || window.innerWidth > 760, noPorts: load('sandbox-noports', false), selNote: null };
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
    `<select id="ws-note" title="Thêm chú thích lên sơ đồ (hoặc chuột phải vào nền)"><option value="">✎ Chú thích…</option>${Object.entries(S.NOTE_TYPES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>` +
    `<select id="ws-cfg" title="Lưu / nạp cả mạng (JSON) hoặc cấu hình dạng văn bản của mọi thiết bị"><option value="">📁 Lưu / Nạp…</option>` +
    `<optgroup label="Cả mạng (thiết bị + dây + cấu hình)"><option value="json-exp">⬇ Xuất mạng (.json)</option><option value="json-imp">⬆ Nhập mạng (.json, kể cả file cũ)…</option></optgroup>` +
    `<optgroup label="Cấu hình dạng văn bản"><option value="exp">⬇ Xuất tất cả cấu hình (.txt)</option><option value="imp">⬆ Nạp cấu hình (dán / file)…</option><option value="save">💾 Đặt làm startup-config (mọi thiết bị)</option></optgroup>` +
    `<optgroup label="EVE-NG"><option value="unl-exp">⬇ Xuất file .unl (EVE-NG)</option><option value="unl-imp">⬆ Nhập file .unl (EVE-NG)…</option></optgroup></select>` +
    `<button id="ws-lib" title="Thư viện lab: lưu nhiều mạng có tên, xếp theo thư mục, mở nhanh lab gần đây">📚 Thư viện</button>` +
    `<button id="ws-clr" title="Bắt đầu lại từ mạng trống">🧹 Xoá hết</button>` +
    `<span class="ws-grow"></span><button id="ws-side-t" title="Nhiệm vụ gợi ý lộ trình"></button><button id="ws-close" title="Đóng workspace (mạng vẫn được lưu)">✕ Đóng</button>` +
    `<input type="file" id="ws-file" accept=".json,application/json" hidden><input type="file" id="ws-unl" accept=".unl,.xml" hidden></div>` +
    `<div class="ws-body"><aside class="ws-pal" id="ws-pal"></aside>` +
    `<div class="ws-stage" id="ws-stage"><svg class="ws-svg" id="ws-svg" role="img" aria-label="topology"><defs><pattern id="ws-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" class="ws-gridl"/></pattern></defs><g id="ws-world"></g></svg>` +
    `<div class="ws-empty" id="ws-empty">Kéo thiết bị từ bảng bên trái vào đây — hoặc chuột phải vào nền → <b>Add node</b>.<br>Thiết bị mới ở trạng thái <b>tắt</b>: chuột phải → <b>Start</b> (hoặc ▶ Start all). Nháy đúp để mở console.</div>` +
    `<div class="ws-zoom"><button data-z="-" title="Thu nhỏ">−</button><span id="ws-zl"></span><button data-z="+" title="Phóng to">+</button><button data-z="fit" title="Vừa khung">⤢</button><button data-z="lbl" id="ws-lbl" title="Ẩn/hiện nhãn cổng trên dây">🏷</button></div>` +
    `<div class="ws-stat" id="ws-stat"></div><div class="ws-clock lab-clock" id="ws-clock"></div></div>` +
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
    C.pruneCapture(W.cap, W.net);
    for (const w of [...W.wins]) if (w.cap ? !net().links.some((l) => l.id === w.cap) : !net().devices[w.id]) closeWin(w.id);
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
    if (z === 'lbl') { W.noPorts = !W.noPorts; save('sandbox-noports', W.noPorts); draw(); return; }
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
    const gS = el('g', {}), gL = el('g', {}), gA = el('g', {}), gT = el('g', {}), gN = el('g', {});
    world.append(gS, gL, gA, gT, gN);
    drawNotes(gS, gA);
    for (const l of n.links) {
      const A = n.devices[l.a], B = n.devices[l.b];
      const k = [l.a, l.b].sort().join('|');
      const i = (pairI[k] = (pairI[k] ?? -1) + 1);
      const off = (i - (pairN[k] - 1) / 2) * 16;
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * off, oy = (dx / len) * off;
      // đám mây "Internet": đầu dây cắm vào mép đám mây thay vì tâm
      const PA = linkEnd(A, B.x, B.y), PB = linkEnd(B, A.x, A.y), ex = PB.x - PA.x, ey = PB.y - PA.y;
      const up = N.lineUp(n, l.a, l.ap) && N.lineUp(n, l.b, l.bp);
      // dây: lên = xanh; thiết bị tắt = xám; cổng shutdown = đỏ đứt nét; đã cắm nhưng chưa lên (sai encap, err-disabled…) = đỏ
      const cls = (up ? 'up' : S.isOff(A) || S.isOff(B) ? 'off' : !adminUp(n, l.a, l.ap) || !adminUp(n, l.b, l.bp) ? 'admin' : 'down') + (/^s/.test(l.ap) ? ' serial' : '');
      const geo = { x1: PA.x + ox, y1: PA.y + oy, x2: PB.x + ox, y2: PB.y + oy };
      gL.appendChild(el('line', { ...geo, class: 'lab-link ' + cls }));
      if (C.isCapturing(W.cap, l.id)) {
        // dây đang bắt gói: dải sáng chạy dọc dây + kính lúp ở giữa (tự vẽ)
        gL.appendChild(el('line', { ...geo, class: 'ws-cap-line' }));
        const mx = (geo.x1 + geo.x2) / 2, my = (geo.y1 + geo.y2) / 2;
        const ic = el('g', { class: 'ws-cap-ico', 'data-link': l.id });
        ic.append(el('circle', { cx: mx, cy: my, r: 11, class: 'ws-cap-bg' }), el('circle', { cx: mx - 2, cy: my - 2, r: 4.5, class: 'ws-cap-gl' }), el('line', { x1: mx + 1.5, y1: my + 1.5, x2: mx + 6, y2: my + 6, class: 'ws-cap-gl' }));
        const ct = el('title', {});
        ct.textContent = 'Đang bắt gói — nháy đúp để mở cửa sổ capture';
        ic.appendChild(ct);
        gT.appendChild(ic);
      }
      const hit = el('line', { ...geo, class: 'ws-link-hit', 'data-link': l.id });
      const tt = el('title', {});
      tt.textContent = `${A.name} ${N.shortIf(l.ap)} ↔ ${B.name} ${N.shortIf(l.bp)} — chuột phải để xoá dây`;
      hit.appendChild(tt);
      gL.appendChild(hit);
      for (const [D, port, t] of W.noPorts ? [] : [[A, l.ap, 0.24], [B, l.bp, 0.76]]) {
        const px = PA.x + ex * t + ox, py = PA.y + ey * t + oy;
        const bv = blk.get(D.id + '|' + port);
        const tr = bv && bv.sts !== 'BLK';
        const label = (isHost(D) ? 'Fa0' : N.shortIf(port)) + (bv ? (tr ? ' ' + bv.sts : ' ✕') : '');
        const w = label.length * 6.6 + 8;
        gT.appendChild(el('rect', { x: px - w / 2, y: py - 8, width: w, height: 15, rx: 4, class: 'lab-port-bg' + (bv ? ' blk' : '') + (tr ? ' lsn' : '') }));
        const tx = el('text', { x: px, y: py + 3.5, 'text-anchor': 'middle', class: 'lab-port' + (bv ? ' blk' : '') + (tr ? ' lsn' : '') });
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
      sub.textContent = isHost(d) ? (d.ip ? `${d.ip}/${d.prefix}` : d.ip6 ? `${d.ip6}/${d.prefix6}` : d.dhcp ? 'DHCP' : '') : S.SANDBOX_KINDS[S.kindOf(d)]?.label || '';
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
  // ---------------------------------------------------------------- chú thích: hộp chữ, khung, mũi tên (lab/sandbox.js)
  function drawNotes(gBack, gFront) {
    for (const n of net().notes || []) {
      const sel = n.id === W.selNote;
      const g = el('g', { class: `ws-note c-${n.color}${sel ? ' sel' : ''}`, 'data-note': n.id });
      const label = (x, y, anchor = 'start') => {
        if (!n.text) return;
        const t = el('text', { x, y, 'text-anchor': anchor, class: 'ws-nt-label' });
        n.text.split('\n').forEach((ln, i) => { const ts = el('tspan', { x, dy: i ? 16 : 0 }); ts.textContent = ln; t.appendChild(ts); });
        g.appendChild(t);
      };
      if (n.t === 'rect') { g.appendChild(el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 12, class: 'ws-nt-shape' })); label(n.x + 12, n.y + 20); }
      else if (n.t === 'ellipse') { g.appendChild(el('ellipse', { cx: n.x + n.w / 2, cy: n.y + n.h / 2, rx: n.w / 2, ry: n.h / 2, class: 'ws-nt-shape' })); label(n.x + n.w / 2, n.y + 22, 'middle'); }
      else if (n.t === 'text') { g.appendChild(el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 6, class: 'ws-nt-textbg' })); label(n.x + 9, n.y + 22); }
      else {
        const dx = n.x2 - n.x, dy = n.y2 - n.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        g.appendChild(el('line', { x1: n.x, y1: n.y, x2: n.x2 - ux * 10, y2: n.y2 - uy * 10, class: 'ws-nt-arrow' }));
        g.appendChild(el('path', { d: `M${n.x2} ${n.y2} L${n.x2 - ux * 14 - uy * 7} ${n.y2 - uy * 14 + ux * 7} L${n.x2 - ux * 14 + uy * 7} ${n.y2 - uy * 14 - ux * 7}Z`, class: 'ws-nt-head' }));
        g.appendChild(el('line', { x1: n.x, y1: n.y, x2: n.x2, y2: n.y2, class: 'ws-nt-hit' }));
        label((n.x + n.x2) / 2, (n.y + n.y2) / 2 - 8, 'middle');
      }
      if (sel) {
        const hs = n.t === 'arrow' ? [['p1', n.x, n.y], ['p2', n.x2, n.y2]] : [['se', n.x + n.w, n.y + n.h]];
        for (const [h, x, y] of hs) g.appendChild(el('rect', { x: x - 5, y: y - 5, width: 10, height: 10, class: 'ws-nt-handle', 'data-h': h }));
      }
      const tt = el('title', {});
      tt.textContent = 'Kéo để di chuyển · nháy đúp: sửa chữ · chuột phải: màu / xoá · Delete: xoá';
      g.appendChild(tt);
      (n.t === 'rect' || n.t === 'ellipse' ? gBack : gFront).appendChild(g);
    }
  }
  function noteDown(e, id, handle) {
    W.selNote = id;
    setSel(null);
    const n0 = net().notes.find((x) => x.id === id);
    if (!n0) return;
    const p0 = toWorld(e), o = { ...n0 }, before = W.undo.snapshot(W.net);
    let moved = false, raf = 0;
    const move = (ev) => {
      const p = toWorld(ev), dx = p.x - p0.x, dy = p.y - p0.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      const patch = handle === 'se' ? { w: Math.max(30, o.w + dx), h: Math.max(20, o.h + dy) } : handle === 'p1' ? { x: o.x + dx, y: o.y + dy } : handle === 'p2' ? { x2: o.x2 + dx, y2: o.y2 + dy } : { x: o.x + dx, y: o.y + dy, x2: o.x2 + dx, y2: o.y2 + dy };
      S.updateNote(W.net, id, patch);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) { W.undo.commit(W.net, before); persist(); }
      draw();
      const now = Date.now();
      if (!moved && lastClick.id === 'note:' + id && now - lastClick.t < 400) { lastClick = { id: null, t: 0 }; editNote(id); }
      else if (!moved) lastClick = { id: 'note:' + id, t: now };
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  function addNoteAt(t, at) {
    const id = mut(() => S.addNote(W.net, t, at.x, at.y));
    W.selNote = id;
    persist();
    draw();
    if (t !== 'arrow') editNote(id);
  }
  function editNote(id) {
    const n = net().notes.find((x) => x.id === id);
    if (!n) return;
    const v = prompt('Nội dung chú thích (gõ \\n để xuống dòng):', n.text.replace(/\n/g, '\\n'));
    if (v == null) return;
    mut(() => S.updateNote(W.net, id, { text: v.replace(/\\n/g, '\n') }));
    persist();
    draw();
  }
  function noteMenu(id, e) {
    const n = net().notes.find((x) => x.id === id);
    W.selNote = id;
    draw();
    const NAMES = { blue: 'Xanh dương', green: 'Xanh lá', orange: 'Cam', red: 'Đỏ', purple: 'Tím', gray: 'Xám' };
    showMenu([
      { head: S.NOTE_TYPES[n.t] },
      { label: '✏ Sửa chữ', act: () => editNote(id) },
      ...S.NOTE_COLORS.map((c) => ({ label: `${c === n.color ? '●' : '○'} Màu ${NAMES[c]}`, act: () => { mut(() => S.updateNote(W.net, id, { color: c })); persist(); draw(); } })),
      '-',
      { label: '🗑 Xoá chú thích', act: () => deleteNote(id), danger: true },
    ], e);
  }
  function deleteNote(id) { mut(() => S.removeNote(W.net, id)); W.selNote = null; persist(); draw(); }

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
    const note = e.target.closest('.ws-note');
    if (e.button === 2) return;
    if (node && e.button === 0) { W.selNote = null; nodeDown(e, node.dataset.id); return; }
    if (note && e.button === 0 && W.tool !== 'wire') { noteDown(e, note.dataset.note, e.target.dataset?.h); return; }
    if (W.selNote) { W.selNote = null; draw(); }
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
  stage.addEventListener('dblclick', (e) => { const ic = e.target.closest('.ws-cap-ico'); if (ic) openCapWin(ic.dataset.link); });
  stage.addEventListener('keydown', (e) => {
    const node = e.target.closest?.('.ws-node');
    if (node && e.key === 'Enter') openConsole(node.dataset.id);
  });
  stage.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const node = e.target.closest('.ws-node');
    const link = e.target.closest('[data-link]');
    const note = e.target.closest('.ws-note');
    if (node) { setSel(node.dataset.id); nodeMenu(node.dataset.id, e); }
    else if (note) noteMenu(note.dataset.note, e);
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
      ...(d.type === 'pc' ? [{ label: d.shell === 'vpcs' ? '🪟 Dòng lệnh kiểu Windows (ipconfig…)' : '🐧 Dòng lệnh VPCS (ip, show ip…)', act: () => toggleShell(id) }] : []),
      { label: '⧉ Nhân bản', act: () => { const nid = mut(() => S.duplicateDevice(W.net, id)); persist(); W.sel = nid; draw(); scheduleSide(); } },
      '-',
      { label: '🗑 Xoá', act: () => deleteDev(id), danger: true },
    ], e);
  }
  /** PC: đổi giữa VPCS (mặc định của workspace, như EVE-NG) và dòng lệnh kiểu Windows (như các lab). */
  function toggleShell(id) {
    mut(() => { const d = W.net.devices[id]; if (d.shell === 'vpcs') delete d.shell; else d.shell = 'vpcs'; });
    const d = net().devices[id];
    termOf(id).push({ t: d.shell === 'vpcs' ? `— Đã chuyển ${d.name} sang VPCS: ip 10.0.0.10/24 10.0.0.1 · ip dhcp · show ip · ping · trace · save (gõ ? để xem) —` : `— Đã chuyển ${d.name} sang dòng lệnh kiểu Windows: ipconfig · ping · tracert · arp -a —`, c: 'sys' });
    persist();
    refreshWin(id);
  }
  function linkMenu(lid, e) {
    const l = net().links.find((x) => x.id === lid);
    if (!l) return;
    const A = net().devices[l.a], B = net().devices[l.b];
    const on = C.isCapturing(W.cap, lid), n = W.cap.links[lid]?.pkts.length || 0;
    showMenu([
      { head: `${A.name} ${N.shortIf(l.ap)} ↔ ${B.name} ${N.shortIf(l.bp)}` },
      on ? { label: '■ Stop capture', act: () => { C.stopCapture(W.cap, lid); draw(); refreshWin(CAP + lid); } } : { label: '▶ Start capture', act: () => startCap(lid) },
      ...(on || n ? [{ label: `📡 Mở cửa sổ capture (${n} gói)`, act: () => openCapWin(lid) }] : []),
      '-',
      { label: '✂ Xoá dây', act: () => { mut(() => S.disconnect(W.net, lid)); afterStructural(); }, danger: true },
    ], e);
  }
  function bgMenu(e) {
    const at = toWorld(e);
    showMenu([
      { label: '＋ Add node…', act: () => openAddDialog(null, at) },
      ...Object.entries(S.NOTE_TYPES).map(([t, v]) => ({ label: `✎ ${v}`, act: () => addNoteAt(t, at) })),
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
      W.term[id] = [{ t: d.shell === 'vpcs' ? `${d.name} — VPCS: ip 10.0.0.10/24 10.0.0.1 · ip dhcp · show ip · ping · trace · save (gõ ? để xem lệnh)` : isHost(d) ? `${d.name} — dòng lệnh máy trạm (gõ ? để xem lệnh)` : `${d.name} console — ? trợ giúp, Tab hoàn thành lệnh, ↑/↓ lịch sử, Ctrl+Z = end, dán nhiều dòng cấu hình`, c: 'sys' }];
    }
    return W.term[id];
  }
  function openConsole(id) {
    if (id.startsWith(CAP)) { openCapWin(id.slice(CAP.length)); return; }
    if (!net().devices[id]) return;
    showWin(id, 560, 340);
  }
  /** Mở (hoặc đưa lên trên) cửa sổ nổi `id`; cửa sổ mới xếp so le từ góc phải. */
  function showWin(id, w0, h0, extra = {}) {
    let w = W.wins.find((x) => x.id === id);
    if (w) { w.min = false; w.z = ++W.z; }
    else {
      const r = root.getBoundingClientRect();
      const n = W.wins.length;
      const top = root.querySelector('.ws-top').offsetHeight + 10;
      const ww = Math.min(w0, r.width - 20), hh = Math.min(h0, r.height - top - 60);
      w = { id, w: ww, h: hh, x: Math.max(10, r.width - ww - 30 - (n % 5) * 34), y: top + (n % 5) * 34, z: ++W.z, min: false, ...extra };
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
    dock.innerHTML = mins.map((w) => `<button data-id="${esc(w.id)}" title="Mở lại cửa sổ">${w.cap ? '📡 ' + esc(linkName(w.cap)) : '🖥 ' + esc(net().devices[w.id]?.name || w.id)}</button>`).join('');
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
    if (id.startsWith(CAP)) { refreshCapWin(id.slice(CAP.length), full); return; }
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
  // ---------------------------------------------------------------- capture trên dây (kiểu Wireshark)
  const linkName = (lid) => {
    const l = net().links.find((x) => x.id === lid);
    if (!l) return lid;
    const nm = (dev, p) => `${net().devices[dev]?.name} ${isHost(net().devices[dev] || {}) ? 'Fa0' : N.shortIf(p)}`;
    return `${nm(l.a, l.ap)} ↔ ${nm(l.b, l.bp)}`;
  };
  function startCap(lid) {
    C.startCapture(W.cap, lid, nowSec());
    C.tickCapture(W.cap, W.net, nowSec());
    draw();
    openCapWin(lid);
  }
  function openCapWin(lid) { if (W.cap.links[lid]) showWin(CAP + lid, 900, 500, { cap: lid }); }
  function refreshCaps() { for (const w of W.wins) if (w.cap) refreshCapWin(w.cap); }
  function refreshCapWin(lid, full) {
    const e = alive() && root.querySelector(`.ws-win[data-id="${CSS.escape(CAP + lid)}"]`);
    const c = W.cap.links[lid];
    if (!e || !c) return;
    const ui = (W.capUi[lid] ||= { filter: '', sel: null });
    e.querySelector('.ws-wdot').className = 'ws-wdot ' + (c.on ? 'rec' : 'off');
    e.querySelector('.ws-wn').textContent = '📡 ' + linkName(lid);
    e.querySelector('.ws-wk').textContent = c.on ? 'đang bắt gói' : 'đã dừng';
    const body = e.querySelector('.ws-wbody');
    if (full || body.dataset.mode !== 'cap') {
      body.dataset.mode = 'cap';
      body.className = 'ws-wbody ws-capbody';
      body.innerHTML = `<div class="ws-cap-bar"><input class="ws-cap-f" spellcheck="false" autocomplete="off" aria-label="Bộ lọc hiển thị" placeholder="Lọc: icmp · arp · tcp · udp · ospf · ip.addr == 10.0.0.1 · tcp.port == 80 · vlan.id == 10"><button data-c="tog"></button><button data-c="clr" title="Xoá danh sách gói">🧹</button><button data-c="pcap" title="Tải file .pcap — mở được bằng Wireshark">⬇ .pcap</button></div>` +
        `<div class="ws-cap-err"></div><div class="ws-cap-list"><table class="ws-cap-t"><thead><tr><th>No.</th><th>Time</th><th>Source</th><th>Destination</th><th>Protocol</th><th>Length</th><th>Info</th></tr></thead><tbody></tbody></table></div>` +
        `<div class="ws-cap-det"><div class="ws-cap-tree ftree"></div><div class="ws-cap-hex hexview"></div></div><div class="ws-cap-foot"></div>`;
      const f = body.querySelector('.ws-cap-f');
      f.value = ui.filter;
      f.addEventListener('input', () => { ui.filter = f.value; clearTimeout(f.t); f.t = setTimeout(() => refreshCapWin(lid), 250); });
      f.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ui.filter = f.value; refreshCapWin(lid); } });
      body.querySelector('[data-c="tog"]').onclick = () => { if (c.on) C.stopCapture(W.cap, lid); else C.startCapture(W.cap, lid, nowSec()); draw(); refreshCapWin(lid); };
      body.querySelector('[data-c="clr"]').onclick = () => { c.pkts = []; ui.sel = null; refreshCapWin(lid); };
      body.querySelector('[data-c="pcap"]').onclick = () => {
        const blob = new Blob([C.capturePcap(c.pkts, c.t0)], { type: 'application/vnd.tcpdump.pcap' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `capture-${linkName(lid).replace(/[^A-Za-z0-9]+/g, '_')}.pcap`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      };
      body.querySelector('tbody').addEventListener('click', (ev) => { const tr = ev.target.closest('tr[data-no]'); if (tr) { ui.sel = +tr.dataset.no; refreshCapWin(lid); } });
    }
    body.querySelector('[data-c="tog"]').textContent = c.on ? '■ Stop' : '▶ Start';
    const cf = C.compileFilter(ui.filter);
    const err = body.querySelector('.ws-cap-err');
    err.textContent = cf.error ? `Bộ lọc chưa đúng: ${cf.error}` : '';
    body.querySelector('.ws-cap-f').classList.toggle('bad', !!cf.error);
    const shown = cf.error ? c.pkts : c.pkts.filter(cf.fn);
    const list = body.querySelector('.ws-cap-list');
    // chỉ tự cuộn xuống khi có gói mới và người xem đang ở cuối bảng (bấm chọn gói thì giữ nguyên vị trí)
    const grew = c.pkts.length !== ui.seen;
    ui.seen = c.pkts.length;
    const atEnd = grew && list.scrollTop + list.clientHeight >= list.scrollHeight - 30;
    body.querySelector('tbody').innerHTML = shown.map((p) => {
      const r = C.summarize(p);
      return `<tr data-no="${r.no}" class="pc-${r.cls}${r.no === ui.sel ? ' sel' : ''}"><td>${r.no}</td><td>${r.time.toFixed(6)}</td><td>${esc(r.src)}</td><td>${esc(r.dst)}</td><td>${esc(r.proto)}</td><td>${r.len}</td><td>${r.vlan != null ? `<span class="ws-vtag">VLAN ${r.vlan}</span> ` : ''}${esc(r.info)}</td></tr>`;
    }).join('');
    if (atEnd) list.scrollTop = list.scrollHeight;
    body.querySelector('.ws-cap-foot').textContent = `Đang hiển thị ${shown.length} / ${c.pkts.length} gói${c.on ? ' · đang bắt…' : ' · đã dừng'}`;
    const det = body.querySelector('.ws-cap-det');
    const pk = c.pkts.find((p) => p.no === ui.sel);
    det.hidden = !pk;
    if (pk && det.dataset.no !== String(pk.no)) {
      det.dataset.no = pk.no;
      const tree = det.querySelector('.ws-cap-tree'), hex = det.querySelector('.ws-cap-hex');
      const flat = flattenFields(pk.tree);
      renderFieldTree(tree, pk.tree, [], { onFieldHover: (st, len) => highlightRange(hex, st, len), onFieldLeave: () => clearHexHighlight(hex) });
      renderHex(hex, pk.bytes, [], {
        onByteHover: (i) => { const f = flat.filter((x) => i >= x.byteOffset && i < x.byteOffset + x.byteLength).sort((a, b) => a.byteLength - b.byteLength)[0]; if (f) highlightFieldRow(tree, f.name); },
        onByteLeave: () => clearFieldHighlight(tree),
      });
    }
  }
  // ⏱ đồng hồ mô phỏng: STP/OSPF/EIGRP/BGP/HSRP hội tụ theo thời gian, log IOS hiện dần trên console
  function pullLogs() {
    for (const id of pullClockLogs(net(), (did, lines) => { const T = termOf(did); T.push(...lines); if (T.length > MAX_LINES) T.splice(1, T.length - MAX_LINES); })) refreshWin(id);
  }
  function convergeNow() { N.clockConverge(net()); pullLogs(); draw(); renderClockBar(root.querySelector('#ws-clock'), net(), convergeNow); }
  const clockTimer = setInterval(() => {
    if (!alive()) { clearInterval(clockTimer); return; }
    const changed = clockStep(net());
    pullLogs();
    if (changed) draw();
    renderClockBar(root.querySelector('#ws-clock'), net(), convergeNow);
  }, TICK_MS);
  // gói định kỳ (OSPF/EIGRP/HSRP Hello, BPDU) theo đồng hồ thật khi đang có dây được bắt
  const capTimer = setInterval(() => {
    if (!alive()) { clearInterval(capTimer); return; }
    if (C.tickCapture(W.cap, W.net, nowSec())) refreshCaps();
  }, 1000);

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
    afterCommand(net());
    pullLogs();
    // capture: frame của lần mô phỏng này đi qua dây đang bắt (ping: PC gửi 4 lượt, router 5)
    if (res.sim && C.recordSim(W.cap, res.sim, nowSec(), { repeat: /^\s*ping\b/i.test(line) ? (isHost(d) && d.shell !== 'vpcs' ? 4 : 5) : 1 })) refreshCaps();
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
    mut(() => { W.net.devices = n.devices; W.net.links = n.links; W.net.notes = n.notes || []; });
    W.selNote = null;
    W.term = {}; W.hist = {}; W.gui = {}; W.boot = {}; W.pick = []; W.sel = null;
    W.cap = C.createCapture(); W.capUi = {};
    for (const w of [...W.wins]) if (w.cap) closeWin(w.id);
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
  $('ws-note').onchange = (e) => { const t = e.target.value; e.target.value = ''; if (t) addNoteAt(t, viewCenter()); };
  $('ws-tpl').onchange = (e) => {
    const t = S.SANDBOX_TEMPLATES.find((x) => x.id === e.target.value);
    e.target.value = '';
    if (!t || (Object.keys(W.net.devices).length && !confirm(`Thay mạng hiện tại bằng mẫu "${t.title}"? (Có thể ↶ Hoàn tác)`))) return;
    replaceNet(t.build());
  };
  function exportJson() {
    const blob = new Blob([JSON.stringify(S.exportSandbox(W.net), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'packet-journey-mang.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $('ws-file').onchange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { replaceNet(S.importSandbox(JSON.parse(await f.text()))); }
    catch (err) { alert('Không nhập được file: ' + err.message); }
  };
  // 📄 cấu hình dạng văn bản (lab/configio.js): xuất 1 file .txt, nạp lại theo tên thiết bị, lưu startup-config
  $('ws-cfg').onchange = (e) => {
    const v = e.target.value;
    e.target.value = '';
    if (v === 'json-exp') exportJson();
    else if (v === 'json-imp') $('ws-file').click();
    else if (v === 'exp') {
      const { text, skipped } = IO.exportConfigs(W.net, W.cli);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      a.download = 'packet-journey-cau-hinh.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      if (skipped.length) alert(`Đã xuất cấu hình. ${skipped.join(', ')}: hãng này chưa hỗ trợ dạng văn bản — dùng 📁 Lưu / Nạp… → ⬇ Xuất mạng (.json) để lưu cả mạng.`);
    } else if (v === 'imp') openCfgImport();
    else if (v === 'unl-exp') {
      const nm = (W.libId && getLib().labs[W.libId]?.name) || 'Packet Journey lab';
      const xml = UNL.sandboxToUnl(W.net, (id) => IO.deviceConfig(W.net, W.cli, id), nm);
      download(xml, (nm.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'lab') + '.unl', 'application/xml');
      alert('Đã xuất .unl. Khi mở trong EVE-NG: image của từng node là tên phổ biến (vios, viosl2, vpcs…) — đổi cho khớp image có trên máy EVE-NG của bạn (Edit node → Image).');
    } else if (v === 'unl-imp') $('ws-unl').click();
    else if (v === 'save') {
      const n = mut(() => IO.saveAllStartup(W.net, W.cli));
      persist();
      dialog(`<h3>💾 Đặt làm startup-config</h3><p class="ws-note">Đã lưu cấu hình đang chạy làm startup-config cho <b>${n}</b> thiết bị (Cisco: <code>write memory</code>, VPCS: <code>save</code>). Từ giờ <b>⟲ Wipe</b> đưa thiết bị về đúng cấu hình này; <code>show startup-config</code> xem lại.</p><div class="ws-dlg-b"><button id="cf-ok" class="btn-accent">OK</button></div>`, (dlg, close) => { dlg.querySelector('#cf-ok').onclick = close; });
    }
  };
  function openCfgImport() {
    dialog(`<h3>⬆ Nạp cấu hình</h3><p class="ws-note">Dán cấu hình (file .txt do app xuất, hoặc nhiều <code>show running-config</code> liền nhau) hoặc chọn file. App tách theo dòng <code>! ===== Thiết bị: …</code> / <code>hostname …</code> / <code>set pcname …</code> và gõ vào thiết bị cùng tên. Cổng không ghi <code>shutdown</code> sẽ được bật như khi nạp startup-config.</p>` +
      `<textarea id="cf-text" rows="10" spellcheck="false" placeholder="hostname R1&#10;interface g0/0&#10; ip address 10.0.0.1 255.255.255.0&#10;!&#10;hostname R2&#10;…"></textarea>` +
      `<label class="ws-file-l">hoặc chọn file <input type="file" id="cf-file" accept=".txt,.cfg,.conf,text/plain"></label><div class="ws-cf-rep" id="cf-rep"></div>` +
      `<div class="ws-dlg-b"><button id="cf-go" class="btn-accent">Nạp</button><button id="cf-x">Đóng</button></div>`, (dlg, close) => {
      const q = (id) => dlg.querySelector('#' + id);
      q('cf-x').onclick = close;
      q('cf-file').onchange = async (ev) => { const f = ev.target.files?.[0]; if (f) q('cf-text').value = await f.text(); };
      q('cf-go').onclick = () => {
        const text = q('cf-text').value;
        if (!IO.splitConfigs(text).length) { q('cf-rep').innerHTML = '<div class="ws-err">Không tìm thấy khối cấu hình nào (cần dòng <code>hostname …</code> hoặc tiêu đề <code>! ===== Thiết bị: …</code>).</div>'; return; }
        const rep = mut(() => IO.importConfigs(W.net, W.cli, text));
        for (const r of rep) if (r.id && r.lines) { termOf(r.id).push({ t: `— ⬆ Đã nạp ${r.lines} dòng cấu hình${r.errors.length ? `, ${r.errors.length} dòng lỗi` : ''} —`, c: 'sys' }); refreshWin(r.id); }
        persist();
        draw();
        scheduleSide();
        q('cf-rep').innerHTML = `<ul>${rep.map((r) => `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} <b>${esc(r.name)}</b>: ${r.note ? esc(r.note) : `${r.lines} dòng${r.errors.length ? ` — lỗi: ${r.errors.map((x) => `<code>${esc(x)}</code>`).join(', ')}` : ''}`}</li>`).join('')}</ul>`;
      };
    });
  }
  function download(text, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $('ws-unl').onchange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    let r;
    try { r = UNL.unlToSandbox(await f.text()); } catch (err) { alert('Không nhập được file .unl: ' + err.message); return; }
    if (Object.keys(W.net.devices).length && !confirm(`Thay mạng hiện tại bằng lab "${r.name}" (${Object.keys(r.net.devices).length} thiết bị) từ EVE-NG? (Có thể ↶ Hoàn tác)`)) return;
    const rep = UNL.applyUnlConfigs(r.net, createCli(r.net), r.configText);
    W.libId = null;
    replaceNet(r.net);
    const lines = [...r.report, ...rep.filter((x) => !x.ok).map((x) => `Cấu hình ${x.name}: ${x.note || 'lỗi ở ' + x.errors.join(' | ')}`)];
    dialog(`<h3>⬆ Đã nhập lab EVE-NG "${esc(r.name)}"</h3><p class="ws-note">${Object.keys(r.net.devices).length} thiết bị, ${r.net.links.length} dây${rep.length ? `, cấu hình của ${rep.filter((x) => x.ok).length} thiết bị đã thành startup-config` : ''}. Thiết bị đang <b>tắt</b> như khi mở lab trong EVE-NG — bấm <b>▶ Start all</b>.</p>` +
      (lines.length ? `<div class="ws-cf-rep"><ul>${lines.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '') +
      `<div class="ws-dlg-b"><button id="un-ok" class="btn-accent">OK</button></div>`, (dlg, close) => { dlg.querySelector('#un-ok').onclick = close; });
  };

  // 📚 thư viện lab theo thư mục (lab/labstore.js) — lưu trong localStorage "sandbox-lib"
  const getLib = () => LIB.normLib(load('sandbox-lib', null));
  const putLib = (lib) => save('sandbox-lib', lib);
  W.libId ??= load('sandbox-libcur', null);
  function openLibrary(msg = '') {
    const lib = getLib();
    if (W.libId && !lib.labs[W.libId]) W.libId = null;
    const cur = W.libId ? lib.labs[W.libId] : null;
    const fmtD = (t) => new Date(t).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
    const folderOpts = (sel) => lib.folders.map((f) => `<option${f === sel ? ' selected' : ''}>${esc(f)}</option>`).join('');
    dialog(`<h3>📚 Thư viện lab</h3>` +
      `<div class="ws-lib-save"><div class="ws-row"><label>Tên lab <input id="lb-name" maxlength="60" value="${esc(cur?.name || '')}" placeholder="vd: OSPF 3 router"></label><label>Thư mục <select id="lb-folder">${folderOpts(cur?.folder || LIB.ROOT)}</select></label></div>` +
      `<div class="ws-dlg-b ws-lib-acts">${cur ? `<button id="lb-over" class="btn-accent" title="Ghi đè lab đang mở">💾 Lưu (ghi đè "${esc(cur.name)}")</button><button id="lb-new">＋ Lưu thành lab mới</button>` : '<button id="lb-new" class="btn-accent">💾 Lưu mạng hiện tại</button>'}<button id="lb-fold">📁 Thư mục mới</button></div>` +
      `<div class="ws-err" id="lb-err">${esc(msg)}</div></div>` +
      (lib.recent.length ? `<div class="ws-lib-h">🕘 Gần đây</div><div class="ws-lib-recent">${lib.recent.map((id) => `<button data-open="${id}" title="${esc(lib.labs[id].folder)}">${esc(lib.labs[id].name)}</button>`).join('')}</div>` : '') +
      `<div class="ws-lib-tree">${LIB.tree(lib).map(({ folder, labs }) => `<details open><summary><b>📁 ${esc(folder)}</b> <small>(${labs.length})</small>${folder === LIB.ROOT ? '' : ` <button data-fren="${esc(folder)}" title="Đổi tên thư mục">✏</button><button data-fdel="${esc(folder)}" title="Xoá thư mục (lab bên trong về ${esc(LIB.ROOT)})">🗑</button>`}</summary>` +
        (labs.length ? `<ul>${labs.map((l) => `<li class="${l.id === W.libId ? 'cur' : ''}"><button class="ws-lib-open" data-open="${l.id}">${esc(l.name)}</button><small>${l.devices} thiết bị · ${fmtD(l.updated)}</small>` +
          `<span class="ws-lib-ops"><select data-move="${l.id}" title="Chuyển thư mục"><option value="">↦</option>${lib.folders.filter((f) => f !== folder).map((f) => `<option>${esc(f)}</option>`).join('')}</select><button data-ren="${l.id}" title="Đổi tên">✏</button><button data-del="${l.id}" title="Xoá lab">🗑</button></span></li>`).join('')}</ul>` : '<div class="ws-note">Trống</div>') + `</details>`).join('')}</div>` +
      `<div class="ws-dlg-b"><button id="lb-x">Đóng</button></div>`, (dlg, close) => {
      const q = (id) => dlg.querySelector('#' + id);
      const done = (r, okMsg) => { if (r.error) { q('lb-err').textContent = r.error; return false; } putLib(r.lib); close(); openLibrary(okMsg || ''); return true; };
      const doSave = (id) => {
        const r = LIB.saveLab(getLib(), { id, name: q('lb-name').value, folder: q('lb-folder').value, data: S.exportSandbox(W.net) });
        if (r.error) { q('lb-err').textContent = r.error; return; }
        W.libId = r.id;
        save('sandbox-libcur', r.id);
        done(r, `✓ Đã lưu "${r.lib.labs[r.id].name}"`);
      };
      q('lb-x').onclick = close;
      if (q('lb-over')) q('lb-over').onclick = () => doSave(W.libId);
      q('lb-new').onclick = () => doSave(null);
      q('lb-fold').onclick = () => { const nm = prompt('Tên thư mục mới:'); if (nm != null) done(LIB.addFolder(getLib(), nm)); };
      dlg.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => {
        const l = getLib().labs[b.dataset.open];
        if (!l) return;
        if (Object.keys(W.net.devices).length && b.dataset.open !== W.libId && !confirm(`Mở "${l.name}"? Mạng đang dựng sẽ được thay (hãy 💾 Lưu trước nếu cần; có thể ↶ Hoàn tác).`)) return;
        let n;
        try { n = S.importSandbox(l.data); } catch (err) { q('lb-err').textContent = 'Lab hỏng: ' + err.message; return; }
        putLib(LIB.openedLab(getLib(), b.dataset.open));
        W.libId = b.dataset.open;
        save('sandbox-libcur', W.libId);
        close();
        replaceNet(n);
      }));
      dlg.querySelectorAll('[data-ren]').forEach((b) => (b.onclick = () => { const l = getLib().labs[b.dataset.ren]; const nm = prompt('Tên mới:', l.name); if (nm != null) done(LIB.renameLab(getLib(), b.dataset.ren, nm)); }));
      dlg.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { const l = getLib().labs[b.dataset.del]; if (confirm(`Xoá lab "${l.name}" khỏi thư viện? (Không hoàn tác được)`)) { if (W.libId === b.dataset.del) W.libId = null; done(LIB.deleteLab(getLib(), b.dataset.del)); } }));
      dlg.querySelectorAll('[data-move]').forEach((s2) => (s2.onchange = () => { if (s2.value) done(LIB.moveLab(getLib(), s2.dataset.move, s2.value)); }));
      dlg.querySelectorAll('[data-fren]').forEach((b) => (b.onclick = (ev) => { ev.preventDefault(); const nm = prompt('Tên mới cho thư mục:', b.dataset.fren); if (nm != null) done(LIB.renameFolder(getLib(), b.dataset.fren, nm)); }));
      dlg.querySelectorAll('[data-fdel]').forEach((b) => (b.onclick = (ev) => { ev.preventDefault(); if (confirm(`Xoá thư mục "${b.dataset.fren || b.dataset.fdel}"? Các lab bên trong chuyển về "${LIB.ROOT}".`)) done(LIB.deleteFolder(getLib(), b.dataset.fdel)); }));
      q('lb-name').focus();
    });
  }
  $('ws-lib').onclick = () => openLibrary();

  $('ws-clr').onclick = () => { if (confirm('Xoá toàn bộ mạng đang dựng? (Có thể ↶ Hoàn tác)')) { W.libId = null; save('sandbox-libcur', null); replaceNet(S.emptySandbox()); } };

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
    if (e.key === 'Delete' && W.selNote) { e.preventDefault(); deleteNote(W.selNote); return; }
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
