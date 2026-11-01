// ui/lab.js — "🧪 Lab CLI": chọn lab theo giáo trình, xem topology, gõ lệnh IOS trên console
// từng thiết bị, nhiệm vụ tự chấm sau mỗi lệnh. Ping/traceroute/telnet/DHCP trả về timeline
// byte-thật → nút "▶ Xem gói tin" mở trong màn hình chính (cây trường, hex, .pcap).
// Thêm: câu hỏi trắc nghiệm trong nhiệm vụ, "🧭 Cách giải chi tiết" (lab có guide), nối dây
// (lab edit:'wire'). Chế độ "🧱 Tự dựng mạng riêng" là workspace toàn màn hình riêng (ui/workspace.js).

import { LABS, LAB_GROUPS, getLab, buildLab, checkLab, solutionOf, applySolution, labMatch, examMinutes, examResult } from '../lab/labs.js';
import { createCli } from '../lab/ios.js';
import * as N from '../lab/net.js';
import { SANDBOX_LAB, freePorts, connect, disconnect } from '../lab/sandbox.js';
import { openWorkspace } from './workspace.js';
import { diagramFromSandbox, sandboxFromDiagram } from '../lab/diagram-bridge.js';
import { openDiagram } from './diagram.js';
import { GUI_VENDORS } from '../lab/guifw.js';
import { renderGuiFw } from './guifw.js';
import { load, save, remove } from './store.js';
import { isBreakId, breakLab, breakId, randomSeed, addBreakResult, breakScore } from '../lab/breaker.js';
import { openBreakDialog } from './breakui.js';
import { trackCmd, trackLab } from './weak.js';
import { clockStep, afterCommand, pullLogs as pullClockLogs, renderClockBar, TICK_MS } from './clock.js';
import { cmdError } from '../lab/weak.js';
import { miniMd } from '../lab/cheat.js';
import { diagnose } from '../lab/diagnose.js';
import { diffLab } from '../lab/cfgdiff.js';
import { lessonHref } from './i18n.js';
import { SVG, el, esc, isHost, drawGlyph, adminUp, classifyLine, stpBlocked, linkEnd, layoutPortLabels, portText } from './topo.js';

const live = new Map(); // labId -> phiên đang làm (giữ nguyên khi đóng/mở lại modal)
const MAX_LINES = 800;
const SBX = SANDBOX_LAB.id;
/** Lab theo id — kể cả đề "🎲 Phá mạng" (id "RB:<lab>:<số lỗi>:<seed>", dựng lại tất định). */
const anyLab = (id) => (isBreakId(id) ? breakLab(id) : getLab(id));
const IOS_MODES_OK = ['user', 'priv'];
const STP_STS = { BLK: 'BLOCKING', LSN: 'LISTENING (đang hội tụ, chưa chuyển frame)', LRN: 'LEARNING (đang hội tụ, học MAC, chưa chuyển frame)' };

/** o = { labId (mở thẳng lab này), breakLab (mở luôn hộp thoại 🎲 với lab gợi ý) } — dùng từ 📊 Điểm yếu. */
export function openLab(onRun, o = {}) {
  document.querySelector('.modal-backdrop')?.remove();
  let lab = anyLab(o.labId || load('lab-cur', 'L01')) || LABS[0];
  let s = null;

  const back = document.createElement('div');
  back.className = 'modal-backdrop lab-back';
  const modal = document.createElement('div');
  modal.className = 'modal lab-modal';
  back.appendChild(modal);
  modal.innerHTML =
    `<div class="modal-h"><span>🧪 Lab thực hành CLI — Cisco IOS <span class="lab-count" id="lab-count"></span></span><span class="lab-hbtns"><button class="lab-sbx-btn" id="lab-topo-full" title="Cho sơ đồ chiếm cả màn hình, bấm lại để quay về làm lab">⛶ Phóng to sơ đồ</button><button class="lab-sbx-btn" id="lab-draw-open" title="Chỉnh topology hiện tại trong trình vẽ sơ đồ">✏️ Mở trong trình vẽ</button><button class="lab-sbx-btn" id="lab-brk-open" title="Lab xử lý sự cố vô hạn: gài lỗi ngẫu nhiên vào mạng đang chạy tốt">🎲 Phá mạng ngẫu nhiên</button><button class="lab-sbx-btn" id="lab-sbx-open" title="Tự thêm thiết bị, nối dây, cấu hình tự do">🧱 Tự dựng mạng riêng</button><button class="modal-x" title="Đóng (lab vẫn được giữ nguyên)">✕</button></span></div>` +
    `<div class="lab-body">` +
    `<aside class="lab-list" id="lab-list"><div class="lab-find"><input type="search" id="lab-q" placeholder="🔎 Tìm lab: ospf, nat, vlan, X0…" aria-label="Tìm lab">` +
    `<div class="lab-filt" id="lab-filt"><button data-f="all">Tất cả</button><button data-f="todo">Chưa xong</button><button data-f="done">Đã xong</button><button data-f="star" title="Lab đã đánh dấu ⭐ cần làm lại">⭐</button></div></div><div id="lab-items"></div></aside>` +
    `<main class="lab-main">` +
    `<select class="lab-select" id="lab-select" aria-label="Chọn lab"></select>` +
    `<div class="lab-head" id="lab-head"></div>` +
    `<div class="lab-tools" id="lab-tools"></div>` +
    `<div class="lab-wire" id="lab-wire" hidden></div>` +
    `<svg class="lab-topo" id="lab-topo" viewBox="0 0 1000 440" role="img" aria-label="topology"></svg>` +
    `<div class="lab-tabs" id="lab-tabs"></div>` +
    `<div class="lab-clock" id="lab-clock"></div>` +
    `<div class="lab-gui" id="lab-gui" hidden></div>` +
    `<div class="lab-term" id="lab-term"><div class="lab-out" id="lab-out"></div>` +
    `<div class="lab-inrow"><span class="lab-prompt" id="lab-prompt"></span><input class="lab-in" id="lab-in" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Nhập lệnh"></div></div>` +
    `</main>` +
    `<aside class="lab-side" id="lab-side"></aside>` +
    `</div>`;
  document.body.appendChild(back);

  const $ = (id) => modal.querySelector('#' + id);
  const input = $('lab-in');
  // 📊 Điểm yếu: thời gian làm lab (cộng dồn khi đổi lab / đóng), lệnh của đề phá mạng tính vào chủ đề lab gốc
  let tIn = Date.now();
  function flushTime() { if (lab && !lab.breakInfo) trackLab('time', lab, { secs: (Date.now() - tIn) / 1000 }); tIn = Date.now(); }
  const srcLab = () => (lab.breakInfo ? getLab(lab.breakInfo.src) : lab);
  modal.querySelector('.modal-x').onclick = () => { flushTime(); back.remove(); };
  // Tự dựng mạng: workspace toàn màn hình đè lên modal lab; "▶ Xem gói tin" trong đó đóng cả hai
  const openWs = () => openWorkspace({ onRun: (sim, label) => { flushTime(); back.remove(); onRun(sim, label); } });
  $('lab-sbx-open').onclick = openWs;
  $('lab-topo-full').onclick = (e) => { e.currentTarget.textContent = modal.classList.toggle('topo-full') ? '⛶ Thu nhỏ sơ đồ' : '⛶ Phóng to sơ đồ'; };
  $('lab-draw-open').onclick = () => openDiagram(diagramFromSandbox(s.net), (json) => openWorkspace({ onRun: (sim, label) => { flushTime(); back.remove(); onRun(sim, label); }, initialNet: sandboxFromDiagram(json) }));
  const openBreak = (o = {}) => openBreakDialog(modal, { labId: lab.breakInfo?.src ?? (load('labs-done', {})[lab.id] ? lab.id : ''), n: lab.breakInfo?.n, ...o, onStart: startBreak });
  $('lab-brk-open').onclick = () => openBreak();
  /** Bắt đầu một đề phá mạng: dọn nhật ký đề cũ, bấm giờ lại từ đầu. */
  function startBreak(id) {
    const old = load('break-cur', null);
    if (old && old.id !== id) remove('lablog:' + old.id);
    live.delete(id);
    remove('lablog:' + id);
    save('break-cur', { id, t0: Date.now(), hints: 0, revealed: false, done: false });
    selectLab(id);
  }
  $('lab-q').oninput = (e) => { query = e.target.value; renderList(); };
  $('lab-filt').onclick = (e) => { const f = e.target.dataset?.f; if (!f) return; filt = f; save('lab-filter', f); renderList(); };

  // ---------------------------------------------------------------- danh sách lab
  let query = '';
  let filt = load('lab-filter', 'all');
  function renderList() {
    const done = load('labs-done', {});
    $('lab-count').textContent = `· ${LABS.length} lab · đã xong ${LABS.filter((l) => done[l.id]).length}`;
    const star = load('lab-star', {});
    const show = (l) => labMatch(l, query) && (filt === 'all' || (filt === 'star' ? !!star[l.id] : (filt === 'done') === !!done[l.id]));
    let html = query || filt !== 'all' ? '' : `<div class="lab-grp">🧱 Chế độ tự do</div>` +
      `<button class="lab-item" data-id="${SBX}"><span class="lab-id">🧱</span><span class="lab-t">Tự dựng mạng riêng (workspace)</span><span></span></button>`;
    let shown = 0;
    for (const g of LAB_GROUPS) {
      const all = LABS.filter((l) => l.group === g.id);
      const items = all.filter(show);
      if (!items.length) continue;
      shown += items.length;
      const nd = all.filter((l) => done[l.id]).length;
      html += `<div class="lab-grp"><span>${esc(g.title)}</span><span class="lab-gp${nd === all.length ? ' all' : ''}" title="Đã xong ${nd}/${all.length}">${nd}/${all.length}</span></div>` +
        `<div class="lab-gbar"><div style="width:${Math.round((nd / all.length) * 100)}%"></div></div>`;
      for (const l of items) {
        html += `<button class="lab-item${l.id === lab.id ? ' active' : ''}${done[l.id] ? ' done' : ''}" data-id="${l.id}">` +
          `<span class="lab-id">${done[l.id] ? '✓' : l.id}</span><span class="lab-t">${star[l.id] ? '⭐ ' : ''}${esc(l.title)}</span><span class="lab-lv" title="Độ khó">${'●'.repeat(l.level)}${'○'.repeat(3 - l.level)}</span></button>`;
      }
    }
    if (!shown && (query || filt !== 'all')) html += `<div class="lab-none">Không có lab nào khớp${query ? ` "${esc(query)}"` : ''}.</div>`;
    $('lab-items').innerHTML = html;
    $('lab-items').querySelectorAll('.lab-item').forEach((b) => (b.onclick = () => selectLab(b.dataset.id)));
    $('lab-filt').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.f === filt));
    $('lab-select').innerHTML = `<option value="${SBX}">🧱 Tự dựng mạng riêng (workspace)</option>` +
      LAB_GROUPS.map((g) => `<optgroup label="${esc(g.title)}">${LABS.filter((l) => l.group === g.id).map((l) => `<option value="${l.id}"${l.id === lab.id ? ' selected' : ''}>${done[l.id] ? '✓ ' : ''}${l.id} — ${esc(l.title)}</option>`).join('')}</optgroup>`).join('');
    $('lab-select').onchange = (e) => selectLab(e.target.value);
  }

  function selectLab(id) {
    if (id === SBX) { $('lab-select').value = lab.id; openWs(); return; }
    flushTime();
    lab = anyLab(id) || LABS[0];
    save('lab-cur', lab.id);
    s = session(lab);
    renderList();
    renderHead();
    renderAll();
    input.focus();
  }

  // ---------------------------------------------------------------- phiên lab
  const canWire = () => lab.edit === 'wire';
  function session(l) {
    let x = live.get(l.id);
    if (x) return x;
    const net = buildLab(l);
    const cli = createCli(net);
    const first = solutionOf(l).find(([d]) => net.devices[d]);
    x = { lab: l, net, cli, dev: first?.[0] || Object.keys(net.devices)[0] || null, term: {}, hist: {}, hpos: -1, log: [], hintN: 0, showSol: false, guideOpen: false, results: [], password: false, answers: load('labans:' + l.id, {}), tool: null, pick: [], drag: null, stepGain: {}, gainMsg: null, exam: null, examRes: null }; // hist = lịch sử lệnh ↑/↓
    if (l.breakInfo) {
      // đề phá mạng: thời gian / số gợi ý / đã xem đáp án giữ qua lần đóng-mở (không "reset" để né tính điểm)
      const cur = load('break-cur', null);
      x.brk = cur?.id === l.id ? cur : { id: l.id, t0: Date.now(), hints: 0, revealed: false, done: false };
      x.hintN = x.brk.hints;
      x.showSol = x.brk.revealed;
      save('break-cur', x.brk);
    }
    const old = load('lablog:' + l.id, null);
    if (Array.isArray(old) && old.length) {
      for (const [dev, cmd] of old) {
        try {
          if (dev === '@link') connect(net, ...cmd);
          else if (dev === '@unlink') disconnect(net, cmd);
          else cli.exec(dev, cmd);
        } catch { /* bỏ qua lệnh lỗi cũ */ }
      }
      x.log = old.slice();
      for (const id of Object.keys(net.devices)) termOf(x, id).push({ t: `(Đã khôi phục ${old.length} thao tác bạn làm lần trước — bấm "↺ Làm lại" để bắt đầu sạch)`, c: 'sys' });
    }
    // ⏱ đồng hồ mô phỏng: trạng thái lúc mở lab coi như đã hội tụ; thay đổi sau đó mới tính giờ
    N.attachClock(net);
    live.set(l.id, x);
    return x;
  }
  function termOf(x, id) {
    if (!x.term[id]) {
      const d = x.net.devices[id];
      x.term[id] = [{ t: d.shell === 'linux' ? 'Linux (mô phỏng), gõ ? để xem lệnh' : isHost(d) ? 'Packet Tracer PC Command Line 1.0  (gõ ? để xem lệnh)' : `${d.name} con0 — gõ ? để trợ giúp, Tab hoàn thành lệnh, ↑/↓ lịch sử, Ctrl+Z = end, Ctrl+V dán nhiều dòng cấu hình`, c: 'sys' }];
    }
    return x.term[id];
  }
  /** Ghi lại thao tác (lệnh / nối dây) để khôi phục khi mở lại. */
  function logAct(dev, what) {
    s.log.push([dev, what]);
    if (s.log.length > 3000) s.log.shift();
    save('lablog:' + lab.id, s.log);
  }
  // ---------------------------------------------------------------- phần đầu (đề bài)
  function renderHead() {
    const kind = { ticket: '🎫 Ticket sự cố', project: '🏢 Dự án tổng hợp', config: '🛠️ Lab cấu hình' }[lab.kind] || '🛠️ Lab cấu hình';
    const best = load('labexam-best', {})[lab.id];
    const meta = [kind, (lab.lesson ? esc(lab.lesson) : '') + (lab.lessonPath ? ` <a href="${lessonHref(lab.lessonPath)}" target="_blank" rel="noopener">📖 Đọc bài trong giáo trình</a>` : ''), `Độ khó ${'●'.repeat(lab.level)}${'○'.repeat(3 - lab.level)}`, best ? `<span class="lab-best${best.score >= 800 ? ' pass' : ''}">🏅 Thi thử tốt nhất: ${best.score}/1000 (${fmtTime(best.secs)})</span>` : ''].filter(Boolean).join(' · ');
    $('lab-head').innerHTML =
      `<div class="lab-title"><span class="lab-badge">${lab.breakInfo ? '🎲' : lab.id}</span> ${esc(lab.title)}</div>` +
      `<div class="lab-meta">${meta}</div>` +
      `<div class="lab-story${lab.kind === 'ticket' ? ' ticket' : ''}">${esc(lab.story)}</div>`;
  }

  // ---------------------------------------------------------------- thanh công cụ: nối dây (lab kéo-thả)
  function renderTools() {
    const box = $('lab-tools');
    if (!canWire()) { box.hidden = true; box.innerHTML = ''; $('lab-wire').hidden = true; return; }
    box.hidden = false;
    const b = (id, label, title, on) => `<button id="${id}" class="${on ? 'on' : ''}" title="${esc(title)}">${label}</button>`;
    let html = b('lab-t-wire', '🔗 Nối dây', 'Chọn thiết bị 1 rồi thiết bị 2, sau đó chọn cổng', s.tool === 'wire') + b('lab-t-cut', '✂ Gỡ dây', 'Bấm vào sợi dây cần gỡ', s.tool === 'cut');
    const st = s.tool === 'wire' ? (s.pick.length === 2 ? 'Chọn cổng 2 đầu rồi bấm "Nối"' : s.pick.length ? `Đã chọn ${esc(s.net.devices[s.pick[0]]?.name)} — chọn thiết bị thứ 2` : 'Chọn thiết bị thứ nhất (bấm lại 🔗 để thoát)') : s.tool === 'cut' ? 'Bấm vào dây cần gỡ' : '';
    html += `<span class="lab-tstat">${st}</span>`;
    box.innerHTML = html;
    $('lab-t-wire').onclick = () => setTool(s.tool === 'wire' ? null : 'wire');
    $('lab-t-cut').onclick = () => setTool(s.tool === 'cut' ? null : 'cut');
  }
  function setTool(t) { s.tool = t; s.pick = []; $('lab-wire').hidden = true; renderTools(); drawTopo(); }

  /** Đã chọn đủ 2 thiết bị → hiện ô chọn cổng. */
  function showWirePanel() {
    const [a, b] = s.pick;
    const A = s.net.devices[a], B = s.net.devices[b];
    const fa = freePorts(s.net, a), fb = freePorts(s.net, b);
    const box = $('lab-wire');
    box.hidden = false;
    const opt = (d, list) => list.map((p) => `<option value="${p}">${isHost(d) ? 'Fa0' : N.longIf(p)}</option>`).join('');
    if (!fa.length || !fb.length) {
      box.innerHTML = `<span class="lab-werr">${esc(!fa.length ? A.name : B.name)} không còn cổng trống.</span> <button id="lab-w-x">Đóng</button>`;
    } else {
      box.innerHTML = `<b>${esc(A.name)}</b> <select id="lab-w-a">${opt(A, fa)}</select> ⟷ <b>${esc(B.name)}</b> <select id="lab-w-b">${opt(B, fb)}</select> <button id="lab-w-ok" class="btn-accent">Nối</button> <button id="lab-w-x">Huỷ</button> <span class="lab-werr" id="lab-w-err"></span>`;
      $('lab-w-ok').onclick = () => {
        const ap = $('lab-w-a').value, bp = $('lab-w-b').value;
        const err = connect(s.net, a, ap, b, bp);
        if (err) { $('lab-w-err').textContent = err; return; }
        logAct('@link', [a, ap, b, bp]);
        s.pick = [];
        box.hidden = true;
        renderAll();
      };
    }
    $('lab-w-x').onclick = () => { s.pick = []; box.hidden = true; renderTools(); drawTopo(); };
  }
  function nodeClicked(id) {
    if (s.tool === 'wire') {
      if (s.pick[0] === id) return;
      s.pick = s.pick.length >= 2 ? [id] : [...s.pick, id];
      if (s.pick.length === 2) showWirePanel(); else $('lab-wire').hidden = true;
      renderTools();
      drawTopo();
      return;
    }
    pickDev(id);
  }

  // ---------------------------------------------------------------- topology
  function drawTopo() {
    const svg = $('lab-topo');
    const net = s.net;
    svg.innerHTML = '';
    svg.classList.toggle('tool', !!s.tool);
    const ds = Object.values(net.devices);
    // khung nhìn ôm sát các thiết bị → icon/chữ to nhất có thể trong ô topology
    const xs = ds.map((d) => d.x), ys = ds.map((d) => d.y);
    const x0 = Math.min(...xs) - 80, y0 = Math.min(...ys) - 45, x1 = Math.max(...xs) + 80, y1 = Math.max(...ys) + 68;
    svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    const pairN = {}, pairI = {};
    for (const l of net.links) { const k = [l.a, l.b].sort().join('|'); pairN[k] = (pairN[k] || 0) + 1; }
    const blk = stpBlocked(net);
    const layerLinks = el('g', {}), layerLabels = el('g', {}), layerNodes = el('g', {});
    svg.append(layerLinks, layerNodes, layerLabels);
    const spots = layoutPortLabels(net, (D, port) => portText(blk, D, port));
    for (const l of net.links) {
      const A = net.devices[l.a], B = net.devices[l.b];
      const k = [l.a, l.b].sort().join('|');
      const i = (pairI[k] = (pairI[k] ?? -1) + 1);
      const off = (i - (pairN[k] - 1) / 2) * 16;
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * off, oy = (dx / len) * off;
      // đám mây "Internet": đầu dây cắm vào mép đám mây thay vì tâm
      const PA = linkEnd(A, B.x, B.y), PB = linkEnd(B, A.x, A.y);
      const upA = N.lineUp(net, l.a, l.ap), upB = N.lineUp(net, l.b, l.bp);
      const adminDown = !adminUp(net, l.a, l.ap) || !adminUp(net, l.b, l.bp);
      const cls = upA && upB ? 'up' : adminDown ? 'admin' : 'down';
      const geo = { x1: PA.x + ox, y1: PA.y + oy, x2: PB.x + ox, y2: PB.y + oy };
      layerLinks.appendChild(el('line', { ...geo, class: 'lab-link ' + cls }));
      if (s.tool === 'cut') {
        const hit = el('line', { ...geo, class: 'lab-link-hit' });
        const tt = el('title', {});
        tt.textContent = `Gỡ dây ${A.name} ${N.shortIf(l.ap)} ↔ ${B.name} ${N.shortIf(l.bp)}`;
        hit.appendChild(tt);
        hit.onclick = () => { disconnect(net, l.id); logAct('@unlink', l.id); renderAll(); };
        layerLinks.appendChild(hit);
      }
      for (const [D, port, spot] of [[A, l.ap, spots[l.id][0]], [B, l.bp, spots[l.id][1]]]) {
        const { x: px, y: py, w } = spot;
        const bv = blk.get(D.id + '|' + port);
        const tr = bv && bv.sts !== 'BLK';
        const label = portText(blk, D, port);
        const bg = el('rect', { x: px - w / 2, y: py - 8, width: w, height: 15, rx: 4, class: 'lab-port-bg' + (bv ? ' blk' : '') + (tr ? ' lsn' : '') });
        if (bv) { const tt = el('title', {}); tt.textContent = `STP ${STP_STS[bv.sts]} — VLAN ${bv.join(', ')}`; bg.appendChild(tt); }
        layerLabels.appendChild(bg);
        const tx = el('text', { x: px, y: py + 3.5, 'text-anchor': 'middle', class: 'lab-port' + (bv ? ' blk' : '') + (tr ? ' lsn' : '') });
        tx.textContent = label;
        layerLabels.appendChild(tx);
      }
    }
    for (const d of ds) {
      const picked = s.pick.includes(d.id);
      const g = el('g', { class: 'lab-node' + (d.id === s.dev && !s.tool ? ' sel' : '') + (picked ? ' pick' : ''), tabindex: 0, role: 'button', 'aria-label': d.name });
      g.appendChild(el('circle', { cx: d.x, cy: d.y, r: 33, class: 'lab-halo' }));
      drawGlyph(g, d);
      const nm = el('text', { x: d.x, y: d.y + 44, 'text-anchor': 'middle', class: 'lab-name' });
      nm.textContent = d.name + (d.type === 'switch' && d.model === '3560' ? ' (L3)' : '');
      g.appendChild(nm);
      if (isHost(d)) {
        const ip = el('text', { x: d.x, y: d.y + 58, 'text-anchor': 'middle', class: 'lab-ip' });
        ip.textContent = d.ip ? `${d.ip}/${d.prefix}` : d.ip6 ? `${d.ip6}/${d.prefix6}` : d.dhcp ? 'DHCP (chưa có IP)' : '(chưa có IP)';
        g.appendChild(ip);
      }
      g.onclick = () => nodeClicked(d.id);
      g.onkeydown = (e) => { if (e.key === 'Enter') nodeClicked(d.id); };
      layerNodes.appendChild(g);
    }
  }

  // ---------------------------------------------------------------- tab thiết bị + console
  function renderTabs() {
    const ico = { router: '⛁', switch: '⇄', pc: '🖥', server: '🗄' };
    $('lab-tabs').innerHTML = Object.values(s.net.devices).map((d) => `<button class="lab-tab${d.id === s.dev ? ' active' : ''}" data-id="${d.id}"><span class="lab-ti">${d.fw && d.os ? '🛡' : ico[d.type]}</span>${esc(d.name)}</button>`).join('');
    $('lab-tabs').querySelectorAll('.lab-tab').forEach((b) => (b.onclick = () => pickDev(b.dataset.id)));
  }
  function pickDev(id) {
    s.dev = id;
    s.hpos = -1;
    s.password = !!id && s.cli.session(id).pw != null && !!s.cli.session(id).pw;
    if (s.tool) { s.tool = null; s.pick = []; $('lab-wire').hidden = true; renderTools(); }
    drawTopo();
    renderTabs();
    renderTerm();
    input.focus();
  }
  function renderTerm() {
    const out = $('lab-out');
    out.innerHTML = '';
    // Firewall cấu hình bằng web (Sophos / Check Point / pfSense): hiện trang quản trị thay cho console
    const gd = s.dev && s.net.devices[s.dev];
    const isGui = !!(gd && GUI_VENDORS[gd.os]);
    $('lab-gui').hidden = !isGui;
    $('lab-term').hidden = isGui;
    if (isGui) { renderGui(gd); return; }
    if (!s.dev || !s.net.devices[s.dev]) {
      s.dev = null;
      out.innerHTML = '<div class="lab-ln sys">Chưa có thiết bị nào — thêm thiết bị rồi bấm vào nó để mở console.</div>';
      $('lab-prompt').textContent = '';
      input.disabled = true;
      return;
    }
    input.disabled = false;
    for (const ln of termOf(s, s.dev)) {
      if (ln.sim) {
        const b = document.createElement('button');
        b.className = 'lab-simbtn' + (ln.ok ? ' ok' : ' fail');
        b.textContent = `▶ Xem gói tin đi từng bước (${ln.sim.events.length} bước, byte-thật) — ${ln.label}`;
        b.onclick = () => { back.remove(); onRun(ln.sim, `🧪 Lab ${lab.id}: ${ln.label}. Mở lại "🧪 Lab CLI" để làm tiếp (cấu hình vẫn giữ nguyên).`); };
        out.appendChild(b);
        continue;
      }
      const div = document.createElement('div');
      div.className = 'lab-ln ' + (ln.c || '');
      div.textContent = ln.t === '' ? ' ' : ln.t;
      out.appendChild(div);
    }
    $('lab-prompt').textContent = s.cli.prompt(s.dev);
    input.type = s.password ? 'password' : 'text';
    out.scrollTop = out.scrollHeight;
  }

  /** Ghi 1 lệnh + kết quả vào console của thiết bị `dev`. */
  function pushOut(dev, line, res, pr, hidden) {
    const T = termOf(s, dev);
    T.push({ t: pr + (hidden ? '' : line), c: 'cmd' });
    for (const l of res.out) T.push({ t: l, c: classifyLine(l) });
    if (res.why && explainOn()) T.push({ t: '💡 Mô phỏng cho biết: ' + res.why, c: 'why' });
    if (res.sim) T.push({ sim: res.sim, label: res.simLabel || 'gói tin', ok: res.ok !== false });
    if (T.length > MAX_LINES) T.splice(1, T.length - MAX_LINES);
  }
  function exec(dev, line, opts = {}) {
    const pr = s.cli.prompt(dev);
    const wasPw = dev === s.dev && s.password;
    let res;
    try { res = s.cli.exec(dev, line); } catch (e) { res = { out: ['% Lỗi mô phỏng: ' + e.message], prompt: pr }; }
    pushOut(dev, line, res, pr, wasPw);
    if (dev === s.dev) s.password = !!res.password;
    if (!opts.noLog) {
      logAct(dev, line);
      if (!wasPw && line.trim()) (s.hist[dev] ||= []).push(line);
    }
    return res;
  }
  function run(line, opts = {}) {
    if (!s.dev) return;
    s.gainMsg = null;
    const dev = s.dev, d = s.net.devices[dev], pw = s.password, mode = s.cli.session(dev)?.mode;
    const res = exec(dev, line, opts);
    afterCommand(s.net);
    pullLogs();
    // 📊 Điểm yếu: chỉ lệnh người học tự gõ/dán trên router/switch IOS (không ghi mật khẩu, "?", lệnh mẫu)
    if (!opts.noLog && !pw && !isHost(d) && !N.isVendorOs(d)) {
      trackCmd({ cmd: line, out: res.out, spec: res.spec, mode, lab: srcLab(), sug: cmdError(res.out) ? s.cli.suggest(dev, line) : [] });
    }
    s.hpos = -1;
    renderAll(false);
  }
  /** Trang quản trị web: mỗi thao tác = 1 lệnh chạy qua exec() (ghi nhật ký, khôi phục được). */
  function renderGui(d) {
    const g = (s.gui ||= {});
    const T = termOf(s, d.id);
    renderGuiFw($('lab-gui'), d, {
      net: s.net, tab: g.tab, ruleIf: g.ruleIf, addOpen: g.addOpen, lastErr: g.err,
      history: T.filter((l) => l.c === 'cmd').map((l) => l.t.replace(/^\[[^\]]*\]\s*/, '')),
      setTab: (t) => { g.tab = t; g.err = null; renderGui(d); },
      setRuleIf: (z) => { g.ruleIf = z; renderGui(d); },
      run: (cmd, o = {}) => {
        const res = exec(d.id, cmd);
        g.err = res.out.find((l) => l.startsWith('ERROR:')) || null;
        g.addOpen = !!(g.err && o.keepAdd);
        renderAll(false);
      },
    });
  }
  /** Đưa console thiết bị IOS về EXEC trước khi gõ chuỗi lệnh mẫu (bắt đầu bằng enable). */
  function toExec(dev) {
    const d = s.net.devices[dev];
    if (!d || isHost(d)) return;
    if (!IOS_MODES_OK.includes(s.cli.session(dev).mode)) exec(dev, 'end');
  }
  /** Chạy danh sách bước [[dev, cmds]] (cùng định dạng solutionOf) vào console, kể cả bước '@link'. */
  /** Chạy `fn` rồi ghi lại những nhiệm vụ vừa chuyển sang đạt (để báo "bước này làm được gì"). */
  function withGain(title, fn) {
    const before = checkLab(lab, s.net, s.answers);
    fn();
    const after = checkLab(lab, s.net, s.answers);
    const gained = after.map((x, i) => (x && !before[i] ? i : -1)).filter((i) => i >= 0);
    s.gainMsg = { title, gained };
    return gained;
  }
  function runSteps(steps, gi) {
    const gained = withGain(gi != null ? `Bước ${gi + 1}` : 'Các lệnh mẫu', () => runStepsRaw(steps));
    if (gi != null) s.stepGain[gi] = gained;
    renderAll();
  }
  function runStepsRaw(steps) {
    for (const [dev, cmds] of steps) {
      if (dev === '@link') {
        for (const w of cmds) if (!connect(s.net, ...w)) logAct('@link', w);
        continue;
      }
      if (!s.net.devices[dev]) continue;
      toExec(dev);
      if (isHost(s.net.devices[dev]) && s.net.clock) N.clockConverge(s.net); // máy trạm thử sau khi mạng đã hội tụ
      for (const c of cmds) exec(dev, c);
      s.dev = dev;
    }
    s.password = false;
  }

  input.addEventListener('keydown', (e) => {
    if (!s.dev) return;
    const h = s.hist[s.dev] || [];
    if (e.key === 'Enter') { const v = input.value; input.value = ''; run(v); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (!h.length || s.password) return; s.hpos = s.hpos < 0 ? h.length - 1 : Math.max(0, s.hpos - 1); input.value = h[s.hpos]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (s.hpos < 0) return; s.hpos += 1; if (s.hpos >= h.length) { s.hpos = -1; input.value = ''; } else input.value = h[s.hpos]; }
    else if (e.key === 'Tab') { e.preventDefault(); const c = s.cli.complete(s.dev, input.value); if (c) input.value = c; }
    else if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey) { e.preventDefault(); input.value = ''; run('end'); }
    else if ((e.key === 'Pause' || e.key === 'Cancel') && e.ctrlKey) { e.preventDefault(); input.value = ''; run('send break'); } // Ctrl+Break lúc khởi động → ROMMON
    else if (e.key === '?' && !s.password) {
      const d = s.net.devices[s.dev];
      if (d.type === 'router' || d.type === 'switch') {
        // IOS hiện trợ giúp NGAY khi gõ "?" và giữ nguyên dòng đang gõ
        e.preventDefault();
        const v = input.value;
        run(v + '?', { noLog: true });
        input.value = v;
      }
    }
  });

  // Dán cả khối cấu hình (soạn sẵn trong Notepad / copy từ show run) → chạy từng dòng như gõ Enter
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

  // ---------------------------------------------------------------- nhiệm vụ / quiz / gợi ý / cách giải / lời giải
  const devName = (id) => (id === '@link' ? '🔗 Nối dây' : s.net.devices[id]?.name || id);
  const linkText = ([a, ap, b, bp]) => `${devName(a)} ${N.shortIf(ap)} ⟷ ${devName(b)} ${N.shortIf(bp)}`;
  /** Gom các bước guide liên tiếp: bước không có title là phần tiếp của bước trước (thiết bị khác). */
  function guideGroups() {
    const out = [];
    for (const g of lab.guide || []) {
      if (g.title || !out.length) out.push({ title: g.title || 'Bước', why: g.why || '', items: [g] });
      else out[out.length - 1].items.push(g);
    }
    return out;
  }
  const stepOf = (g) => [g.dev, g.raw || g.dev === '@link' ? g.cmds : ['enable', 'configure terminal', ...g.cmds, 'end']];

  function taskHtml(t, i, ok, fresh) {
    if (s.exam) {
      // đang thi: không lộ đạt/chưa đạt, quiz chỉ hiện lựa chọn của mình
      if (!t.quiz) return `<li class="exam"><span class="lab-mk">○</span><div><div class="lab-tt">${esc(t.text)}</div></div></li>`;
      return `<li class="exam quiz"><span class="lab-mk">?</span><div><div class="lab-tt">❓ ${esc(t.text)}</div><div class="lab-qopts">${t.quiz.options.map((o, j) => `<button class="lab-qopt${s.answers[i] === j ? ' sel' : ''}" data-q="${i}" data-o="${j}" aria-pressed="${s.answers[i] === j}">${String.fromCharCode(65 + j)}. ${esc(o)}</button>`).join('')}</div></div></li>`;
    }
    if (!t.quiz) return `<li class="${ok ? 'ok' : 'no'}${fresh ? ' new' : ''}"><span class="lab-mk">${ok ? '✓' : '○'}</span><div><div class="lab-tt">${esc(t.text)}</div><div class="lab-vf">Kiểm tra: <code>${esc(t.verify)}</code></div></div></li>`;
    const ans = s.answers[i];
    const picked = ans != null;
    const opts = t.quiz.options.map((o, j) => {
      const cls = ans === j ? (j === t.quiz.correct ? ' right' : ' wrong') : '';
      return `<button class="lab-qopt${cls}" data-q="${i}" data-o="${j}" aria-pressed="${ans === j}">${String.fromCharCode(65 + j)}. ${esc(o)}</button>`;
    }).join('');
    const fb = !picked ? '' : ok ? `<div class="lab-qfb right">✓ Chính xác!${t.quiz.explain ? ' ' + esc(t.quiz.explain) : ''}</div>` : '<div class="lab-qfb wrong">✗ Chưa đúng — chọn lại đáp án khác.</div>';
    return `<li class="${ok ? 'ok' : 'no'} quiz"><span class="lab-mk">${ok ? '✓' : '?'}</span><div><div class="lab-tt">❓ ${esc(t.text)}</div><div class="lab-qopts">${opts}</div>${fb}</div></li>`;
  }

  // ---------------------------------------------------------------- 🩺 chẩn đoán ping + 🔍 so sánh cấu hình
  const LAYER_ICON = { l1: '🔌', host: '🖥', l2: '🔀', l3: '🧭', filter: '🛡', nat: '🔁', vpn: '🔒', other: '❔' };
  function defaultSrc() { return (Object.values(s.net.devices).find((d) => isHost(d)) || Object.values(s.net.devices)[0])?.id; }
  function diagHtml() {
    if (!s.dg) return '';
    const ds = Object.values(s.net.devices).filter((d) => isHost(d) || N.isL3(d));
    const ips = [...new Set(Object.values(s.net.devices).flatMap((d) => (isHost(d) ? [d.ip] : Object.values(N.l3ifs(d)).map((f) => f.ip))).filter((x) => x && !x.startsWith('169.254')))];
    const r = s.dg.res;
    let out = '';
    if (r) {
      const passed = r.steps.filter((x) => x.ok);
      out = `<ul class="dg-steps">${passed.map((x) => `<li class="ok">${LAYER_ICON[x.layer] || '✓'} ✓ ${esc(x.text)}</li>`).join('')}</ul>`;
      if (r.ok) out += `<div class="dg-ok">✓ Ping ${esc(s.dg.dst)} từ ${esc(s.net.devices[s.dg.src]?.name)} thông — không có lỗi.</div>`;
      else {
        const P = r.problem;
        out += `<div class="dg-bad">✗ Có lỗi phía sau các bước trên. Thử tự tìm trước — mở gợi ý khi cần:</div>` +
          `<ol class="dg-hints">${P.hints.slice(0, s.dg.lvl).map((h, i) => `<li>${i === 0 ? LAYER_ICON[P.layer] + ' ' : ''}${esc(h)}</li>`).join('')}</ol>` +
          (s.dg.lvl < P.hints.length ? `<button id="dg-more">💡 ${['Lỗi ở lớp nào?', 'Xem thiết bị / lệnh show nào?', 'Chi tiết lỗi'][s.dg.lvl]}</button>` : '');
      }
    }
    return `<div class="lab-dg"><div class="lab-dg-h">🩺 Vì sao không ping được?</div>` +
      `<div class="dg-form"><label>Từ <select id="dg-src">${ds.map((d) => `<option value="${d.id}"${d.id === s.dg.src ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select></label>` +
      `<label>tới IP <input id="dg-dst" list="dg-ips" value="${esc(s.dg.dst)}" placeholder="vd 192.168.1.10" autocomplete="off"></label><datalist id="dg-ips">${ips.map((x) => `<option value="${x}">`).join('')}</datalist>` +
      `<button id="dg-go" class="btn-accent">Dò</button></div><div class="ws-err" id="dg-err"></div>${out}</div>`;
  }
  function diffHtml(all) {
    const d = s.diff;
    if (!d) return '';
    const head = !d.devices.length ? '<div class="dg-ok">✓ Cấu hình của bạn giống lời giải mẫu.</div>'
      : all ? '<div class="dg-ok">✓ Bạn đạt mọi nhiệm vụ bằng cách khác lời giải — cả hai đều đúng. Dưới đây là chỗ khác để tham khảo.</div>'
        : '<div class="dg-bad">Còn nhiệm vụ chưa đạt — xem các dòng lời giải có mà bạn chưa có (+).</div>';
    return `<div class="lab-diff"><div class="lab-dg-h">🔍 So sánh với lời giải <button id="diff-x" title="Đóng">✕</button></div>${head}` +
      d.devices.map((x) => `<div class="df-dev"><b>${esc(x.name)}</b>` +
        (x.mine.length ? `<div class="df-l">Chỉ có ở bạn:</div><pre class="df-mine">${esc(x.mine.map((l) => '− ' + l).join('\n'))}</pre>` : '') +
        (x.sol.length ? `<div class="df-l">Chỉ có ở lời giải:</div><pre class="df-sol">${esc(x.sol.map((l) => '+ ' + l).join('\n'))}</pre>` : '') +
        x.notes.map((n) => `<div class="df-note">💬 ${esc(n)}</div>`).join('') + `</div>`).join('') +
      (d.same ? `<div class="df-same">${d.same} thiết bị giống hệt lời giải.</div>` : '') + `</div>`;
  }

  function renderSide() {
    const res = checkLab(lab, s.net, s.answers);
    const prev = s.results;
    // nhiệm vụ vừa chuyển sang đạt (so với lần chấm trước) → nháy sáng
    const fresh = res.map((x, i) => x && prev.length === res.length && !prev[i]);
    s.results = res;
    if (s.exam) { renderExamSide(); return; } // đang thi: không lộ tiến độ (kể cả dấu ✓ ở danh sách lab)
    const ok = res.filter(Boolean).length;
    const all = ok === res.length;
    const done = load('labs-done', {});
    if (all && !lab.breakInfo && !done[lab.id]) { done[lab.id] = true; save('labs-done', done); flushTime(); trackLab('done', lab); renderList(); }
    if (all && s.brk && !s.brk.done) finishBreak();
    const pct = Math.round((ok / res.length) * 100);
    let html = examResHtml() + breakHead() + `<div class="lab-side-h">Nhiệm vụ <span class="lab-score${all ? ' all' : ''}">${ok}/${res.length}</span></div>` +
      `<div class="lab-bar"><div style="width:${pct}%"></div></div>`;
    if (all) html += s.brk ? breakWin() : `<div class="lab-win">🎉 Hoàn thành ${lab.id}! Mọi "Kết quả kiểm tra" đều đạt.</div>`;
    if (s.gainMsg) {
      const g = s.gainMsg;
      html += `<div class="lab-gain${g.gained.length ? '' : ' none'}">${g.gained.length ? `✓ ${esc(g.title)} vừa làm đạt: ${g.gained.map((i) => `<b>#${i + 1}</b> ${esc(lab.tasks[i].text)}`).join(' · ')}` : `${esc(g.title)} chưa làm đạt nhiệm vụ mới — thường là bước chuẩn bị cho bước sau.`}</div>`;
    }
    html += `<ol class="lab-tasks">${lab.tasks.map((t, i) => taskHtml(t, i, res[i], fresh[i])).join('')}</ol>`;
    html += `<label class="lab-explain"><input type="checkbox" id="lab-exp"${explainOn() ? ' checked' : ''}> 🔍 Giải thích lý do khi gói bị rớt${lab.kind === 'ticket' ? ' (ticket: mặc định tắt — tự chẩn đoán bằng show)' : ''}</label>`;
    const hasSol = solutionOf(lab).length > 0;
    html += `<div class="lab-acts"><button id="lab-hint">💡 Gợi ý (${s.hintN}/${lab.hints.length})</button>${hasSol ? `<button id="lab-sol">🔑 ${s.brk ? 'Xem đáp án' : 'Lời giải'}</button>` : ''}<button id="lab-reset">↺ Làm lại</button><button id="lab-dg" title="Dò lỗi theo từng lớp L1 → L2 → L3 → ACL, gợi ý mở dần">🩺 Vì sao không ping được?</button>${hasSol && !s.brk ? '<button id="lab-diff" title="So running-config của bạn với cấu hình sau khi chạy lời giải">🔍 So sánh với lời giải</button>' : ''}${s.brk ? '<button id="lab-brk-new" title="Đề mới, cùng lab, cùng số lỗi">🎲 Phá tiếp</button>' : '<button id="lab-exam" title="Làm lại từ đầu, có giờ, không gợi ý — chấm thang 1000">⏱ Thi thử</button>'}</div>`;
    if (s.hintN) html += `<ul class="lab-hints">${lab.hints.slice(0, s.hintN).map((h) => `<li>${esc(h)}</li>`).join('')}</ul>`;
    html += diagHtml() + diffHtml(all);
    if (!lab.breakInfo) {
      // 📝 ghi chú riêng + ⭐ cần làm lại (localStorage "labnote:<id>", "lab-star")
      const note = load('labnote:' + lab.id, '');
      const starred = !!load('lab-star', {})[lab.id];
      html += `<details class="lab-note" id="lab-note"${s.noteOpen ?? !!note ? ' open' : ''}><summary>📝 Ghi chú của tôi${note ? ' •' : ''}${starred ? ' · ⭐' : ''}</summary>` +
        `<textarea id="lab-note-t" rows="4" spellcheck="false" placeholder="Chỗ hay nhầm, lệnh cần nhớ… Hỗ trợ **đậm**, \`lệnh\`, dòng bắt đầu bằng - ">${esc(note)}</textarea>` +
        `<div class="lab-note-md" id="lab-note-md">${miniMd(note)}</div>` +
        `<label class="lab-star"><input type="checkbox" id="lab-star"${starred ? ' checked' : ''}> ⭐ Cần làm lại (lọc bằng nút ⭐ ở danh sách lab)</label></details>`;
    }
    if (lab.guide?.length) {
      const groups = guideGroups();
      html += `<details class="lab-guide" id="lab-guide"${s.guideOpen ? ' open' : ''}><summary>🧭 Cách giải chi tiết (${groups.length} bước)</summary>` +
        `<div class="lab-guide-note">Mỗi khối lệnh thiết bị mạng đã được bọc sẵn <code>enable → configure terminal … end</code> khi bấm "▶ Gõ".</div>` +
        groups.map((g, gi) => `<div class="lab-gstep"><div class="lab-gtitle">${esc(g.title)}</div>${g.why ? `<div class="lab-gwhy">${esc(g.why)}</div>` : ''}` +
          g.items.map((it) => `<div class="lab-sol-dev">${esc(devName(it.dev))}</div><pre>${esc(it.dev === '@link' ? it.cmds.map(linkText).join('\n') : it.cmds.join('\n'))}</pre>`).join('') +
          `<button class="lab-grun" data-g="${gi}">▶ Gõ bước này vào console</button>` +
          (s.stepGain[gi] ? `<div class="lab-sgain">${s.stepGain[gi].length ? '✓ Bước này làm đạt nhiệm vụ ' + s.stepGain[gi].map((i) => '#' + (i + 1)).join(', ') : '• Bước chuẩn bị (chưa đạt nhiệm vụ mới)'}</div>` : '') + `</div>`).join('') +
        `</details>`;
    }
    if (s.showSol && s.brk) {
      html += `<div class="lab-sol"><div class="lab-sol-h">Đáp án — ${lab.breakInfo.faults.length} lỗi đã gài</div>` +
        lab.breakInfo.faults.map((f, i) => `<div class="lab-sol-dev">${i + 1}. ${esc(f.title)}</div><div class="lab-brk-det">${esc(f.detail)}</div><pre>${esc(f.fix.join('\n'))}</pre>`).join('') +
        `<button id="lab-runsol" class="btn-accent">▶ Gõ lệnh sửa vào console</button></div>`;
    } else if (s.showSol) {
      const qs = lab.tasks.map((t, i) => [t, i]).filter(([t]) => t.quiz);
      html += `<div class="lab-sol"><div class="lab-sol-h">Lời giải mẫu (một cách làm đúng)</div>` +
        solutionOf(lab).map(([dev, cmds]) => `<div class="lab-sol-dev">${esc(devName(dev))}</div><pre>${esc(dev === '@link' ? cmds.map(linkText).join('\n') : cmds.join('\n'))}</pre>`).join('') +
        (qs.length ? `<div class="lab-sol-dev">Đáp án trắc nghiệm</div><pre>${esc(qs.map(([t, i]) => `Câu ${i + 1}: ${String.fromCharCode(65 + t.quiz.correct)}. ${t.quiz.options[t.quiz.correct]}`).join('\n'))}</pre>` : '') +
        `<button id="lab-runsol" class="btn-accent">▶ Gõ lời giải vào console (xem từng lệnh)</button></div>`;
    }
    const scroll = $('lab-side').scrollTop;
    const ta = document.activeElement?.id === 'lab-note-t' ? document.activeElement : null; // đang gõ ghi chú: giữ con trỏ
    const caret = ta && [ta.selectionStart, ta.selectionEnd];
    $('lab-side').innerHTML = html;
    $('lab-side').scrollTop = scroll;
    if (caret && $('lab-note-t')) { $('lab-note-t').focus(); $('lab-note-t').setSelectionRange(...caret); }
    const nt = $('lab-note-t');
    if (nt) {
      $('lab-note').ontoggle = () => { s.noteOpen = $('lab-note').open; };
      nt.oninput = () => { save('labnote:' + lab.id, nt.value); $('lab-note-md').innerHTML = miniMd(nt.value); };
      nt.onkeydown = (e) => e.stopPropagation(); // phím trong ô ghi chú không lọt sang console
      $('lab-star').onchange = (e) => { const st = load('lab-star', {}); if (e.target.checked) st[lab.id] = true; else delete st[lab.id]; save('lab-star', st); renderList(); };
    }
    $('lab-exp').onchange = (e) => save(explainKey(), e.target.checked);
    $('lab-hint').onclick = () => { if (s.hintN < lab.hints.length) { s.hintN += 1; if (!s.brk) trackLab('hint', lab); } if (s.brk && !s.brk.done) { s.brk.hints = s.hintN; save('break-cur', s.brk); } renderSide(); };
    $('lab-side').querySelectorAll('.lab-qopt').forEach((b) => (b.onclick = () => {
      const qi = +b.dataset.q;
      if (s.answers[qi] == null) trackLab('quiz', srcLab(), { ok: +b.dataset.o === lab.tasks[qi].quiz.correct, task: lab.tasks[qi] });
      s.answers[qi] = +b.dataset.o;
      save('labans:' + lab.id, s.answers);
      renderSide();
    }));
    const gd = $('lab-guide');
    if (gd) {
      gd.ontoggle = () => {
        if (gd.open && !s.guideOpen && lab.kind !== 'config' && !confirm('Mở cách giải ngay? Thử tự làm/chẩn đoán trước sẽ học được nhiều hơn.')) { gd.open = false; return; }
        s.guideOpen = gd.open;
      };
      gd.querySelectorAll('.lab-grun').forEach((b) => (b.onclick = () => runSteps(guideGroups()[+b.dataset.g].items.map(stepOf), +b.dataset.g)));
    }
    const sol = $('lab-sol');
    if (sol) sol.onclick = () => {
      if (!s.showSol && lab.kind !== 'config' && !confirm(s.brk ? 'Xem đáp án? Lượt này sẽ không được tính điểm.' : 'Xem lời giải ticket/dự án ngay? Thử tự chẩn đoán bằng lệnh show trước sẽ học được nhiều hơn.')) return;
      s.showSol = !s.showSol;
      if (s.brk && s.showSol && !s.brk.done) { s.brk.revealed = true; save('break-cur', s.brk); }
      if (!s.brk && s.showSol && !s.solTracked) {
        // mở lời giải khi còn nhiệm vụ chưa đạt → tính là "nhiệm vụ trượt" cho chủ đề của từng nhiệm vụ
        s.solTracked = true;
        trackLab('sol', lab);
        const r = checkLab(lab, s.net, s.answers);
        trackLab('fail', lab, { tasks: lab.tasks.filter((t, i) => !r[i] && !t.quiz) });
      }
      renderSide();
    };
    const bn = $('lab-brk-new');
    if (bn) bn.onclick = () => startBreak(breakId(lab.breakInfo.src, lab.breakInfo.n, randomSeed()));
    const bd = $('lab-brk-other');
    if (bd) bd.onclick = () => openBreak({ labId: '' });
    const rst = $('lab-reset');
    if (rst && s.brk) rst.onclick = () => { if (confirm('Làm lại đề này từ đầu (cùng lỗi)? Cấu hình đã gõ bị xoá, đồng hồ chạy lại.')) startBreak(lab.id); };
    else if (rst) rst.onclick = () => {
      if (!confirm(`Làm lại ${lab.id} từ đầu? Mọi cấu hình bạn đã gõ và đáp án trắc nghiệm trong lab này sẽ bị xoá.`)) return;
      live.delete(lab.id);
      save('lablog:' + lab.id, []);
      save('labans:' + lab.id, {});
      s = session(lab);
      renderAll();
    };
    const rs = $('lab-runsol');
    if (rs) rs.onclick = typeSolution;
    $('lab-dg').onclick = () => { s.dg = s.dg ? null : { src: s.dg?.src || defaultSrc(), dst: '', res: null, lvl: 0 }; renderSide(); };
    if (s.dg) {
      $('dg-src').onchange = (e) => { s.dg.src = e.target.value; s.dg.res = null; };
      $('dg-dst').oninput = (e) => { s.dg.dst = e.target.value.trim(); };
      $('dg-dst').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') $('dg-go').click(); };
      $('dg-go').onclick = () => {
        const dst = $('dg-dst').value.trim();
        if (!N.isIp?.(dst) && !/^\d+\.\d+\.\d+\.\d+$/.test(dst)) { $('dg-err').textContent = 'Nhập IP đích, vd 192.168.1.10'; return; }
        s.dg = { src: $('dg-src').value, dst, res: diagnose(s.net, $('dg-src').value, dst), lvl: 0 };
        renderSide();
      };
      const more = $('dg-more');
      if (more) more.onclick = () => { s.dg.lvl += 1; renderSide(); };
    }
    const df = $('lab-diff');
    if (df) df.onclick = () => {
      if (s.diff) { s.diff = null; renderSide(); return; }
      if (!all && !confirm('Chưa đạt hết nhiệm vụ — so sánh sẽ lộ một phần lời giải (tính như đã mở lời giải). Vẫn xem?')) return;
      if (!all && !s.solTracked) { s.solTracked = true; trackLab('sol', lab); }
      s.diff = diffLab(lab, s.net, s.cli);
      renderSide();
    };
    const dfx = $('diff-x');
    if (dfx) dfx.onclick = () => { s.diff = null; renderSide(); };
    const ex = $('lab-exam');
    if (ex) ex.onclick = startExam;
    const exx = $('lab-exres-x');
    if (exx) exx.onclick = () => { s.examRes = null; renderSide(); };
  }

  // ---------------------------------------------------------------- đề "🎲 Phá mạng ngẫu nhiên"
  const breakSecs = () => Math.round(((s.brk.done ? s.brk.end : Date.now()) - s.brk.t0) / 1000);
  function breakHead() {
    if (!s.brk) return '';
    const b = lab.breakInfo;
    return `<div class="lab-brk"><span>🎲 Lab gốc <b>${esc(b.src)}</b> · ${b.n} lỗi · seed ${b.seed}</span><span class="lab-timer" id="lab-brk-timer">${fmtTime(breakSecs())}</span></div>`;
  }
  function finishBreak() {
    const b = lab.breakInfo;
    Object.assign(s.brk, { done: true, end: Date.now(), hints: s.hintN });
    save('break-cur', s.brk);
    const rec = { id: lab.id, src: b.src, n: b.n, seed: b.seed, secs: breakSecs(), hints: s.brk.hints, revealed: !!s.brk.revealed, at: Date.now() };
    save('break-history', addBreakResult(load('break-history', []), rec));
  }
  function breakWin() {
    const h = { n: lab.breakInfo.n, secs: breakSecs(), hints: s.brk.hints, revealed: s.brk.revealed };
    return `<div class="lab-win">🎉 Đã sửa xong ${h.n} lỗi trong ${fmtTime(h.secs)} · ${h.hints} gợi ý${h.revealed ? ' · đã xem đáp án (không tính điểm)' : ` · điểm ${breakScore(h)}/1000`}` +
      `<div class="lab-brk-acts"><button id="lab-brk-other">🎲 Đề khác…</button></div></div>`;
  }

  // ---------------------------------------------------------------- ⏱ đồng hồ mô phỏng (hội tụ theo thời gian)
  /** Log/debug đang chờ → console từng thiết bị; trả true nếu console đang xem có dòng mới. */
  function pullLogs() {
    return pullClockLogs(s.net, (id, lines) => {
      const T = termOf(s, id);
      T.push(...lines);
      if (T.length > MAX_LINES) T.splice(1, T.length - MAX_LINES);
    }).includes(s.dev);
  }
  const renderClock = () => renderClockBar($('lab-clock'), s?.net, convergeNow);
  function convergeNow() {
    N.clockConverge(s.net);
    pullLogs();
    renderTerm();
    drawTopo();
    renderClock();
  }
  const clockTimer = setInterval(() => {
    if (!document.body.contains(back)) { clearInterval(clockTimer); return; }
    if (!s?.net) return;
    const changed = clockStep(s.net);
    if (pullLogs()) renderTerm();
    if (changed) {
      drawTopo();
      // STP hội tụ xong thì AP mới join; chỉ vẽ lại tab không có ô nhập để khỏi mất chữ đang gõ
      if (s.net.devices[s.dev]?.os === 'wlc' && s.gui?.tab === 'Wireless') renderGui(s.net.devices[s.dev]);
    }
    renderClock();
  }, TICK_MS);

  // ---------------------------------------------------------------- chế độ thi thử
  function startExam() {
    const min = examMinutes(lab);
    if (!confirm(`⏱ Thi thử ${lab.id} trong ${min} phút?\n\n• Lab được làm lại TỪ ĐẦU (cấu hình đang gõ sẽ bị xoá)\n• Ẩn gợi ý, lời giải, cách giải, giải thích lỗi và trạng thái từng nhiệm vụ\n• Nộp bài (hoặc hết giờ) → chấm thang 1000, đạt từ 800`)) return;
    live.delete(lab.id);
    save('lablog:' + lab.id, []);
    save('labans:' + lab.id, {});
    s = session(lab);
    s.exam = { start: Date.now(), end: Date.now() + min * 60000 };
    renderAll();
    input.focus();
  }
  function submitExam(auto) {
    if (!s.exam) return;
    if (!auto && !confirm('Nộp bài và chấm điểm ngay?')) return;
    const res = checkLab(lab, s.net, s.answers);
    const secs = Math.min(Math.round((Date.now() - s.exam.start) / 1000), Math.round((s.exam.end - s.exam.start) / 1000));
    const r = { ...examResult(res), secs, auto, failed: res.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0) };
    trackLab('fail', lab, { tasks: r.failed.map((i) => lab.tasks[i]) });
    const best = load('labexam-best', {});
    const b = best[lab.id];
    if (!b || r.score > b.score || (r.score === b.score && r.secs < b.secs)) { best[lab.id] = { score: r.score, secs: r.secs }; save('labexam-best', best); }
    s.exam = null;
    s.examRes = r;
    s.results = res; // không nháy cả loạt nhiệm vụ khi vừa nộp
    renderHead();
    renderAll();
  }
  function renderExamSide() {
    const left = Math.max(0, Math.round((s.exam.end - Date.now()) / 1000));
    let html = `<div class="lab-exam-h"><span>⏱ Đang thi thử ${esc(lab.id)}</span><span class="lab-timer${left < 120 ? ' low' : ''}" id="lab-timer">${fmtTime(left)}</span></div>` +
      `<div class="lab-exam-note">Không có gợi ý / kết quả từng nhiệm vụ. Tự kiểm tra bằng show/ping như thi thật.</div>` +
      `<ol class="lab-tasks">${lab.tasks.map((t, i) => taskHtml(t, i, false, false)).join('')}</ol>` +
      `<div class="lab-acts"><button id="lab-submit" class="btn-accent">📝 Nộp bài</button><button id="lab-quit">✖ Huỷ thi</button></div>`;
    $('lab-side').innerHTML = html;
    $('lab-submit').onclick = () => submitExam(false);
    $('lab-quit').onclick = () => { if (confirm('Huỷ bài thi? Cấu hình đã gõ vẫn giữ, không tính điểm.')) { s.exam = null; renderAll(); } };
    $('lab-side').querySelectorAll('.lab-qopt').forEach((b) => (b.onclick = () => {
      const qi = +b.dataset.q;
      if (s.answers[qi] == null) trackLab('quiz', srcLab(), { ok: +b.dataset.o === lab.tasks[qi].quiz.correct, task: lab.tasks[qi] });
      s.answers[qi] = +b.dataset.o;
      save('labans:' + lab.id, s.answers);
      renderSide();
    }));
  }
  function examResHtml() {
    const r = s.examRes;
    if (!r) return '';
    return `<div class="lab-exres ${r.pass ? 'pass' : 'fail'}"><button class="lab-exres-x" id="lab-exres-x" title="Đóng">✕</button>` +
      `<div class="lab-exres-score">${r.score}<small>/1000</small> — ${r.pass ? 'ĐẠT ✅' : 'CHƯA ĐẠT ❌'}</div>` +
      `<div>${r.ok}/${r.total} nhiệm vụ · thời gian ${fmtTime(r.secs)}${r.auto ? ' (hết giờ, tự nộp)' : ''}</div>` +
      (r.failed.length ? `<div class="lab-exres-f">Chưa đạt: ${r.failed.map((i) => '#' + (i + 1)).join(', ')} — bật Gợi ý / Cách giải để xem lại.</div>` : '') + `</div>`;
  }
  // đồng hồ thi: cập nhật mỗi giây, hết giờ thì tự nộp; dừng khi đóng modal
  const timer = setInterval(() => {
    if (!document.body.contains(back)) { clearInterval(timer); return; }
    if (s?.brk && !s.brk.done) { const bt = $('lab-brk-timer'); if (bt) bt.textContent = fmtTime(breakSecs()); }
    if (!s?.exam) return;
    const left = Math.round((s.exam.end - Date.now()) / 1000);
    if (left <= 0) { submitExam(true); return; }
    const t = $('lab-timer');
    if (t) { t.textContent = fmtTime(left); t.classList.toggle('low', left < 120); }
  }, 1000);

  /** "Gõ lời giải": chạy applySolution trên mạng hiện tại rồi đổ từng lệnh + kết quả vào console. */
  function typeSolution() { withGain('Lời giải mẫu', typeSolutionRaw); renderAll(); }
  function typeSolutionRaw() {
    const steps = solutionOf(lab);
    for (const [dev] of steps) if (dev !== '@link') toExec(dev);
    const before = new Set(s.net.links.map((l) => l.id));
    // bọc cli để ghi lại prompt trước mỗi lệnh → console hiện giống như gõ tay
    // trước lệnh của máy trạm (ipconfig /renew, ping…) coi như đã chờ mạng hội tụ — như người thật gõ xong cấu hình rồi mới thử
    const waitHost = (dev) => { const d = s.net.devices[dev]; if (d && isHost(d) && s.net.clock) N.clockConverge(s.net); };
    const outs = applySolution(lab, s.net, { exec: (dev, cmd) => { waitHost(dev); return { pr0: s.cli.prompt(dev), ...s.cli.exec(dev, cmd) }; } });
    for (const l of s.net.links) if (!before.has(l.id)) logAct('@link', [l.a, l.ap, l.b, l.bp]);
    for (const o of outs) {
      pushOut(o.dev, o.cmd, o, o.pr0, false);
      logAct(o.dev, o.cmd);
      s.dev = o.dev;
    }
    s.password = false;
  }

  // Ticket sự cố: mặc định KHÔNG giải thích (như ngoài đời, phải tự show/ping để chẩn đoán)
  function explainKey() { return lab.kind === 'ticket' ? 'lab-explain-ticket' : 'lab-explain'; }
  function explainOn() { return !s?.exam && load(explainKey(), lab.kind !== 'ticket'); }

  function renderAll(full = true) {
    renderTools();
    renderClock();
    drawTopo();
    renderTabs();
    renderTerm();
    if (full) renderSide();
    else { clearTimeout(renderAll.t); renderAll.t = setTimeout(renderSide, 30); }
  }

  $('lab-term').addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON' && !window.getSelection()?.toString()) input.focus(); });

  selectLab(lab.id);
  if (o.breakLab) openBreak({ labId: o.breakLab });
}

function fmtTime(sec) { const m = Math.floor(sec / 60), x = sec % 60; return `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; }
