// ui/lab.js — "🧪 Lab CLI": chọn lab theo giáo trình, xem topology, gõ lệnh IOS trên console
// từng thiết bị, nhiệm vụ tự chấm sau mỗi lệnh. Ping/traceroute/telnet/DHCP trả về timeline
// byte-thật → nút "▶ Xem gói tin" mở trong màn hình chính (cây trường, hex, .pcap).
// Thêm: câu hỏi trắc nghiệm trong nhiệm vụ, "🧭 Cách giải chi tiết" (lab có guide), nối dây
// (lab edit:'wire') và chế độ "🧱 Tự dựng mạng riêng" (lab/sandbox.js).

import { LABS, LAB_GROUPS, getLab, buildLab, checkLab, solutionOf, applySolution, labMatch, examMinutes, examResult } from '../lab/labs.js';
import { createCli } from '../lab/ios.js';
import * as N from '../lab/net.js';
import { SANDBOX_LAB, SANDBOX_KINDS, SANDBOX_VIEW, SANDBOX_TEMPLATES, emptySandbox, addDevice, freeSpot, moveDevice, removeDevice, renameDevice, duplicateDevice, createHistory, freePorts, connect, disconnect, exportSandbox, importSandbox } from '../lab/sandbox.js';
import { load, save } from './store.js';
import { lessonHref } from './i18n.js';

const SVG = 'http://www.w3.org/2000/svg';
const live = new Map(); // labId -> phiên đang làm (giữ nguyên khi đóng/mở lại modal)
const MAX_LINES = 800;
const SBX = SANDBOX_LAB.id;
const anyLab = (id) => (id === SBX ? SANDBOX_LAB : getLab(id));
const isHost = (d) => d.type === 'pc' || d.type === 'server';
const IOS_MODES_OK = ['user', 'priv'];

export function openLab(onRun) {
  document.querySelector('.modal-backdrop')?.remove();
  let lab = anyLab(load('lab-cur', 'L01')) || LABS[0];
  let s = null;

  const back = document.createElement('div');
  back.className = 'modal-backdrop lab-back';
  const modal = document.createElement('div');
  modal.className = 'modal lab-modal';
  back.appendChild(modal);
  modal.innerHTML =
    `<div class="modal-h"><span>🧪 Lab thực hành CLI — Cisco IOS <span class="lab-count" id="lab-count"></span></span><span class="lab-hbtns"><button class="lab-sbx-btn" id="lab-sbx-open" title="Tự thêm thiết bị, nối dây, cấu hình tự do">🧱 Tự dựng mạng riêng</button><button class="modal-x" title="Đóng (lab vẫn được giữ nguyên)">✕</button></span></div>` +
    `<div class="lab-body">` +
    `<aside class="lab-list" id="lab-list"><div class="lab-find"><input type="search" id="lab-q" placeholder="🔎 Tìm lab: ospf, nat, vlan, X0…" aria-label="Tìm lab">` +
    `<div class="lab-filt" id="lab-filt"><button data-f="all">Tất cả</button><button data-f="todo">Chưa xong</button><button data-f="done">Đã xong</button></div></div><div id="lab-items"></div></aside>` +
    `<main class="lab-main">` +
    `<select class="lab-select" id="lab-select" aria-label="Chọn lab"></select>` +
    `<div class="lab-head" id="lab-head"></div>` +
    `<div class="lab-tools" id="lab-tools"></div>` +
    `<div class="lab-wire" id="lab-wire" hidden></div>` +
    `<svg class="lab-topo" id="lab-topo" viewBox="0 0 1000 440" role="img" aria-label="topology"></svg>` +
    `<input type="file" id="lab-file" accept=".json,application/json" hidden>` +
    `<div class="lab-tabs" id="lab-tabs"></div>` +
    `<div class="lab-term" id="lab-term"><div class="lab-out" id="lab-out"></div>` +
    `<div class="lab-inrow"><span class="lab-prompt" id="lab-prompt"></span><input class="lab-in" id="lab-in" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Nhập lệnh"></div></div>` +
    `</main>` +
    `<aside class="lab-side" id="lab-side"></aside>` +
    `</div>`;
  document.body.appendChild(back);

  const $ = (id) => modal.querySelector('#' + id);
  const input = $('lab-in');
  modal.querySelector('.modal-x').onclick = () => back.remove();
  $('lab-sbx-open').onclick = () => selectLab(SBX);
  $('lab-q').oninput = (e) => { query = e.target.value; renderList(); };
  $('lab-filt').onclick = (e) => { const f = e.target.dataset?.f; if (!f) return; filt = f; save('lab-filter', f); renderList(); };

  // ---------------------------------------------------------------- danh sách lab
  let query = '';
  let filt = load('lab-filter', 'all');
  function renderList() {
    const done = load('labs-done', {});
    $('lab-count').textContent = `· ${LABS.length} lab · đã xong ${LABS.filter((l) => done[l.id]).length}`;
    const show = (l) => labMatch(l, query) && (filt === 'all' || (filt === 'done') === !!done[l.id]);
    let html = query || filt !== 'all' ? '' : `<div class="lab-grp">🧱 Chế độ tự do</div>` +
      `<button class="lab-item${lab.id === SBX ? ' active' : ''}" data-id="${SBX}"><span class="lab-id">🧱</span><span class="lab-t">Tự dựng mạng riêng (sandbox)</span><span></span></button>`;
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
          `<span class="lab-id">${done[l.id] ? '✓' : l.id}</span><span class="lab-t">${esc(l.title)}</span><span class="lab-lv" title="Độ khó">${'●'.repeat(l.level)}${'○'.repeat(3 - l.level)}</span></button>`;
      }
    }
    if (!shown && (query || filt !== 'all')) html += `<div class="lab-none">Không có lab nào khớp${query ? ` "${esc(query)}"` : ''}.</div>`;
    $('lab-items').innerHTML = html;
    $('lab-items').querySelectorAll('.lab-item').forEach((b) => (b.onclick = () => selectLab(b.dataset.id)));
    $('lab-filt').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.f === filt));
    $('lab-select').innerHTML = `<option value="${SBX}"${lab.id === SBX ? ' selected' : ''}>🧱 Tự dựng mạng riêng (sandbox)</option>` +
      LAB_GROUPS.map((g) => `<optgroup label="${esc(g.title)}">${LABS.filter((l) => l.group === g.id).map((l) => `<option value="${l.id}"${l.id === lab.id ? ' selected' : ''}>${done[l.id] ? '✓ ' : ''}${l.id} — ${esc(l.title)}</option>`).join('')}</optgroup>`).join('');
    $('lab-select').onchange = (e) => selectLab(e.target.value);
  }

  function selectLab(id) {
    lab = anyLab(id) || LABS[0];
    save('lab-cur', lab.id);
    s = session(lab);
    renderList();
    renderHead();
    renderAll();
    input.focus();
  }

  // ---------------------------------------------------------------- phiên lab
  const sandbox = () => lab.kind === 'sandbox';
  const canWire = () => sandbox() || lab.edit === 'wire';
  function session(l) {
    let x = live.get(l.id);
    if (x) return x;
    const sbx = l.kind === 'sandbox';
    let net;
    if (sbx) { try { net = importSandbox(load('sandbox-net', null)); } catch { net = emptySandbox(); } }
    else net = buildLab(l);
    const cli = createCli(net);
    const first = solutionOf(l).find(([d]) => net.devices[d]);
    x = { lab: l, net, cli, dev: first?.[0] || Object.keys(net.devices)[0] || null, term: {}, hist: {}, hpos: -1, log: [], hintN: 0, showSol: false, guideOpen: false, results: [], password: false, answers: load('labans:' + l.id, {}), tool: null, pick: [], drag: null, stepGain: {}, gainMsg: null, exam: null, examRes: null, hist: sbx ? createHistory() : null };
    const old = sbx ? null : load('lablog:' + l.id, null);
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
    live.set(l.id, x);
    return x;
  }
  function termOf(x, id) {
    if (!x.term[id]) {
      const d = x.net.devices[id];
      x.term[id] = [{ t: isHost(d) ? 'Packet Tracer PC Command Line 1.0  (gõ ? để xem lệnh)' : `${d.name} con0 — gõ ? để trợ giúp, Tab hoàn thành lệnh, ↑/↓ lịch sử, Ctrl+Z = end, Ctrl+V dán nhiều dòng cấu hình`, c: 'sys' }];
    }
    return x.term[id];
  }
  /** Ghi lại thao tác (lệnh / nối dây) để khôi phục khi mở lại; sandbox thì lưu nguyên mạng. */
  function logAct(dev, what) {
    if (sandbox()) { saveSandbox(); return; }
    s.log.push([dev, what]);
    if (s.log.length > 3000) s.log.shift();
    save('lablog:' + lab.id, s.log);
  }
  /** Thay đổi mạng sandbox có ghi lịch sử hoàn tác (lab thường thì chạy thẳng). */
  function mut(fn) { return s.hist ? s.hist.track(s.net, fn) : fn(); }
  function undoRedo(redo) {
    if (!s.hist || !(redo ? s.hist.redo(s.net) : s.hist.undo(s.net))) return;
    if (s.dev && !s.net.devices[s.dev]) s.dev = Object.keys(s.net.devices)[0] || null;
    s.pick = [];
    $('lab-wire').hidden = true;
    saveSandbox();
    renderAll();
  }
  function saveSandbox() {
    clearTimeout(saveSandbox.t);
    saveSandbox.t = setTimeout(() => save('sandbox-net', exportSandbox(s.net)), 150);
  }

  // ---------------------------------------------------------------- phần đầu (đề bài)
  function renderHead() {
    const kind = { ticket: '🎫 Ticket sự cố', project: '🏢 Dự án tổng hợp', sandbox: '🧱 Sandbox', config: '🛠️ Lab cấu hình' }[lab.kind] || '🛠️ Lab cấu hình';
    const best = load('labexam-best', {})[lab.id];
    const meta = [kind, lab.lesson ? esc(lab.lesson) : '', sandbox() ? '' : `Độ khó ${'●'.repeat(lab.level)}${'○'.repeat(3 - lab.level)}`, lab.lessonPath ? `<a href="${lessonHref(lab.lessonPath)}" target="_blank" rel="noopener">📖 Đọc bài trong giáo trình</a>` : '', best ? `<span class="lab-best${best.score >= 800 ? ' pass' : ''}">🏅 Thi thử tốt nhất: ${best.score}/1000 (${fmtTime(best.secs)})</span>` : ''].filter(Boolean).join(' · ');
    $('lab-head').innerHTML =
      `<div class="lab-title"><span class="lab-badge">${sandbox() ? '🧱' : lab.id}</span> ${esc(lab.title)}</div>` +
      `<div class="lab-meta">${meta}</div>` +
      `<div class="lab-story${lab.kind === 'ticket' ? ' ticket' : ''}">${esc(lab.story)}</div>`;
  }

  // ---------------------------------------------------------------- thanh công cụ: nối dây / sandbox
  function renderTools() {
    const box = $('lab-tools');
    if (!canWire()) { box.hidden = true; box.innerHTML = ''; $('lab-wire').hidden = true; return; }
    box.hidden = false;
    const b = (id, label, title, on) => `<button id="${id}" class="${on ? 'on' : ''}" title="${esc(title)}">${label}</button>`;
    let html = '';
    if (sandbox()) html += Object.entries(SANDBOX_KINDS).map(([k, v]) => `<button data-add="${k}" title="Thêm ${esc(v.label)}">＋ ${esc(v.label)}</button>`).join('') + '<span class="lab-tsep"></span>';
    html += b('lab-t-wire', '🔗 Nối dây', 'Chọn thiết bị 1 rồi thiết bị 2, sau đó chọn cổng', s.tool === 'wire') + b('lab-t-cut', '✂ Gỡ dây', 'Bấm vào sợi dây cần gỡ', s.tool === 'cut');
    if (sandbox()) {
      html += b('lab-t-del', '🗑 Xoá thiết bị', 'Xoá thiết bị đang chọn (cùng dây của nó)') + b('lab-t-ren', '✏ Đổi tên', 'Đổi tên thiết bị đang chọn') + b('lab-t-dup', '⧉ Nhân bản', 'Sao thiết bị đang chọn (giữ cấu hình, bỏ IP và dây)') +
        `<button id="lab-t-undo" title="Hoàn tác (Ctrl+Z khi không gõ console)"${s.hist.canUndo ? '' : ' disabled'}>↶ Hoàn tác</button><button id="lab-t-redo" title="Làm lại (Ctrl+Y)"${s.hist.canRedo ? '' : ' disabled'}>↷ Làm lại</button>` +
        `<select id="lab-t-tpl" title="Nạp mạng mẫu (chỉ thiết bị + dây, bạn tự cấu hình)"><option value="">📐 Mạng mẫu…</option>${SANDBOX_TEMPLATES.map((t) => `<option value="${t.id}" title="${esc(t.desc)}">${esc(t.title)}</option>`).join('')}</select>` + '<span class="lab-tsep"></span>' +
        b('lab-t-exp', '⬇ Xuất JSON', 'Tải mạng về máy') + b('lab-t-imp', '⬆ Nhập JSON', 'Mở file mạng đã xuất') + b('lab-t-clr', '🧹 Xoá hết', 'Bắt đầu lại từ mạng trống');
    }
    const st = s.tool === 'wire' ? (s.pick.length === 2 ? 'Chọn cổng 2 đầu rồi bấm "Nối"' : s.pick.length ? `Đã chọn ${esc(s.net.devices[s.pick[0]]?.name)} — chọn thiết bị thứ 2` : 'Chọn thiết bị thứ nhất (bấm lại 🔗 để thoát)') : s.tool === 'cut' ? 'Bấm vào dây cần gỡ' : sandbox() ? 'Kéo thiết bị để sắp xếp · bấm để mở console' : '';
    html += `<span class="lab-tstat">${st}</span>`;
    box.innerHTML = html;
    box.querySelectorAll('[data-add]').forEach((x) => (x.onclick = () => {
      const p = freeSpot(s.net);
      const id = mut(() => addDevice(s.net, x.dataset.add, p.x, p.y));
      saveSandbox();
      pickDev(id);
    }));
    $('lab-t-wire').onclick = () => setTool(s.tool === 'wire' ? null : 'wire');
    $('lab-t-cut').onclick = () => setTool(s.tool === 'cut' ? null : 'cut');
    if (!sandbox()) return;
    $('lab-t-del').onclick = () => {
      const d = s.net.devices[s.dev];
      if (!d || !confirm(`Xoá ${d.name} cùng mọi dây nối với nó?`)) return;
      mut(() => removeDevice(s.net, d.id));
      delete s.term[d.id];
      s.dev = Object.keys(s.net.devices)[0] || null;
      saveSandbox();
      renderAll();
    };
    $('lab-t-exp').onclick = () => {
      const blob = new Blob([JSON.stringify(exportSandbox(s.net), null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'packet-journey-mang.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('lab-t-imp').onclick = () => $('lab-file').click();
    $('lab-t-ren').onclick = () => {
      const d = s.net.devices[s.dev];
      if (!d) return alert('Bấm chọn một thiết bị trước.');
      const n = prompt(`Tên mới cho ${d.name}:`, d.name);
      if (n == null) return;
      const err = mut(() => renameDevice(s.net, d.id, n));
      if (err) return alert(err);
      saveSandbox();
      renderAll();
    };
    $('lab-t-dup').onclick = () => {
      if (!s.net.devices[s.dev]) return alert('Bấm chọn một thiết bị trước.');
      const id = mut(() => duplicateDevice(s.net, s.dev));
      saveSandbox();
      pickDev(id);
    };
    $('lab-t-undo').onclick = () => undoRedo(false);
    $('lab-t-redo').onclick = () => undoRedo(true);
    $('lab-t-tpl').onchange = (e) => {
      const t = SANDBOX_TEMPLATES.find((x) => x.id === e.target.value);
      e.target.value = '';
      if (!t || (Object.keys(s.net.devices).length && !confirm(`Thay mạng hiện tại bằng mẫu "${t.title}"? (Có thể ↶ Hoàn tác)`))) return;
      replaceSandbox(t.build());
    };
    $('lab-t-clr').onclick = () => { if (confirm('Xoá toàn bộ mạng đang dựng?')) replaceSandbox(emptySandbox()); };
  }
  $('lab-file').onchange = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try { replaceSandbox(importSandbox(JSON.parse(await f.text()))); }
    catch (err) { alert('Không nhập được file: ' + err.message); }
  };
  /** Thay toàn bộ mạng sandbox (mẫu / nhập file / xoá hết) — vẫn hoàn tác được. */
  function replaceSandbox(net) {
    mut(() => { s.net.devices = net.devices; s.net.links = net.links; });
    s.dev = Object.keys(s.net.devices)[0] || null;
    s.term = {};
    saveSandbox();
    renderAll();
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
        const err = mut(() => connect(s.net, a, ap, b, bp));
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
    svg.classList.toggle('big', sandbox());
    svg.classList.toggle('tool', !!s.tool);
    const ds = Object.values(net.devices);
    if (sandbox()) svg.setAttribute('viewBox', `0 0 ${SANDBOX_VIEW.w} ${SANDBOX_VIEW.h}`);
    else {
      // khung nhìn ôm sát các thiết bị → icon/chữ to nhất có thể trong ô topology
      const xs = ds.map((d) => d.x), ys = ds.map((d) => d.y);
      const x0 = Math.min(...xs) - 80, y0 = Math.min(...ys) - 45, x1 = Math.max(...xs) + 80, y1 = Math.max(...ys) + 68;
      svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    }
    if (!ds.length) {
      const t = el('text', { x: SANDBOX_VIEW.w / 2, y: SANDBOX_VIEW.h / 2, 'text-anchor': 'middle', class: 'lab-empty' });
      t.textContent = 'Mạng trống — dùng nút ＋ PC / Switch / Router ở trên để bắt đầu';
      svg.appendChild(t);
      return;
    }
    const pairN = {}, pairI = {};
    for (const l of net.links) { const k = [l.a, l.b].sort().join('|'); pairN[k] = (pairN[k] || 0) + 1; }
    const layerLinks = el('g', {}), layerLabels = el('g', {}), layerNodes = el('g', {});
    svg.append(layerLinks, layerLabels, layerNodes);
    for (const l of net.links) {
      const A = net.devices[l.a], B = net.devices[l.b];
      const k = [l.a, l.b].sort().join('|');
      const i = (pairI[k] = (pairI[k] ?? -1) + 1);
      const off = (i - (pairN[k] - 1) / 2) * 16;
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * off, oy = (dx / len) * off;
      const upA = N.lineUp(net, l.a, l.ap), upB = N.lineUp(net, l.b, l.bp);
      const adminDown = !adminUp(net, l.a, l.ap) || !adminUp(net, l.b, l.bp);
      const cls = upA && upB ? 'up' : adminDown ? 'admin' : 'down';
      const geo = { x1: A.x + ox, y1: A.y + oy, x2: B.x + ox, y2: B.y + oy };
      layerLinks.appendChild(el('line', { ...geo, class: 'lab-link ' + cls }));
      if (s.tool === 'cut') {
        const hit = el('line', { ...geo, class: 'lab-link-hit' });
        const tt = el('title', {});
        tt.textContent = `Gỡ dây ${A.name} ${N.shortIf(l.ap)} ↔ ${B.name} ${N.shortIf(l.bp)}`;
        hit.appendChild(tt);
        hit.onclick = () => { mut(() => disconnect(net, l.id)); logAct('@unlink', l.id); renderAll(); };
        layerLinks.appendChild(hit);
      }
      for (const [D, port, t] of [[A, l.ap, 0.24], [B, l.bp, 0.76]]) {
        const px = A.x + dx * t + ox, py = A.y + dy * t + oy;
        const label = isHost(D) ? 'Fa0' : N.shortIf(port);
        const w = label.length * 6.6 + 8;
        layerLabels.appendChild(el('rect', { x: px - w / 2, y: py - 8, width: w, height: 15, rx: 4, class: 'lab-port-bg' }));
        const tx = el('text', { x: px, y: py + 3.5, 'text-anchor': 'middle', class: 'lab-port' });
        tx.textContent = label;
        layerLabels.appendChild(tx);
      }
    }
    for (const d of ds) {
      const picked = s.pick.includes(d.id);
      const g = el('g', { class: 'lab-node' + (d.id === s.dev && !s.tool ? ' sel' : '') + (picked ? ' pick' : ''), tabindex: 0, role: 'button', 'aria-label': d.name });
      g.appendChild(el('circle', { cx: d.x, cy: d.y, r: 33, class: 'lab-halo' }));
      glyph(g, d);
      const nm = el('text', { x: d.x, y: d.y + 44, 'text-anchor': 'middle', class: 'lab-name' });
      nm.textContent = d.name + (d.type === 'switch' && d.model === '3560' ? ' (L3)' : '');
      g.appendChild(nm);
      if (isHost(d)) {
        const ip = el('text', { x: d.x, y: d.y + 58, 'text-anchor': 'middle', class: 'lab-ip' });
        ip.textContent = d.ip ? `${d.ip}/${d.prefix}` : d.dhcp ? 'DHCP (chưa có IP)' : '(chưa có IP)';
        g.appendChild(ip);
      }
      g.onclick = () => { if (s.drag?.moved) return; nodeClicked(d.id); };
      g.onkeydown = (e) => { if (e.key === 'Enter') nodeClicked(d.id); };
      if (sandbox()) g.onpointerdown = (e) => startDrag(e, d.id);
      layerNodes.appendChild(g);
    }
  }
  // Kéo thả thiết bị (sandbox): lắng nghe trên window vì topology được vẽ lại liên tục khi kéo
  function startDrag(e, id) {
    if (e.button !== 0 || s.tool) return;
    const svg = $('lab-topo');
    const toSvg = (ev) => { const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
    const d = s.net.devices[id], p0 = toSvg(e);
    s.drag = { id, dx: d.x - p0.x, dy: d.y - p0.y, moved: false, sx: e.clientX, sy: e.clientY, before: s.hist.snapshot(s.net) };
    const move = (ev) => {
      const g = s.drag;
      if (!g) return;
      if (!g.moved && Math.hypot(ev.clientX - g.sx, ev.clientY - g.sy) < 4) return;
      g.moved = true;
      const p = toSvg(ev);
      moveDevice(s.net, id, p.x + g.dx, p.y + g.dy);
      if (!g.raf) g.raf = requestAnimationFrame(() => { g.raf = 0; drawTopo(); });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (s.drag?.moved) { s.hist.commit(s.net, s.drag.before); saveSandbox(); renderTools(); drawTopo(); }
      setTimeout(() => { s.drag = null; }, 0); // để onclick ngay sau khi thả biết là vừa kéo
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  function glyph(g, d) {
    const { x, y } = d;
    if (d.type === 'router') {
      g.appendChild(el('circle', { cx: x, cy: y, r: 22, class: 'lab-g router' }));
      for (const [ax, ay, bx, by] of [[-11, -11, 11, 11], [11, -11, -11, 11]]) g.appendChild(el('line', { x1: x + ax, y1: y + ay, x2: x + bx, y2: y + by, class: 'lab-gl' }));
      for (const [px, py] of [[-11, -11], [11, 11], [11, -11], [-11, 11]]) g.appendChild(el('circle', { cx: x + px, cy: y + py, r: 2.6, class: 'lab-gd' }));
    } else if (d.type === 'switch') {
      g.appendChild(el('rect', { x: x - 28, y: y - 16, width: 56, height: 32, rx: 6, class: 'lab-g switch' + (d.model === '3560' ? ' l3' : '') }));
      g.appendChild(el('path', { d: `M${x - 16} ${y - 5}h28m-6 -5l6 5l-6 5 M${x + 16} ${y + 6}h-28m6 -5l-6 5l6 5`, class: 'lab-gl' }));
    } else if (d.type === 'server') {
      g.appendChild(el('rect', { x: x - 15, y: y - 22, width: 30, height: 44, rx: 4, class: 'lab-g host' }));
      for (const yy of [-12, -2, 8]) g.appendChild(el('line', { x1: x - 9, y1: y + yy, x2: x + 9, y2: y + yy, class: 'lab-gl' }));
    } else {
      g.appendChild(el('rect', { x: x - 20, y: y - 18, width: 40, height: 27, rx: 3, class: 'lab-g host' }));
      g.appendChild(el('path', { d: `M${x - 9} ${y + 17}h18 M${x} ${y + 9}v8`, class: 'lab-gl' }));
    }
  }
  function adminUp(net, dev, port) {
    const d = net.devices[dev];
    if (isHost(d)) return true;
    if (d.type === 'switch') return !d.ports[port]?.shutdown;
    return !d.ifaces[port]?.shutdown;
  }

  // ---------------------------------------------------------------- tab thiết bị + console
  function renderTabs() {
    const ico = { router: '⛁', switch: '⇄', pc: '🖥', server: '🗄' };
    $('lab-tabs').innerHTML = Object.values(s.net.devices).map((d) => `<button class="lab-tab${d.id === s.dev ? ' active' : ''}" data-id="${d.id}"><span class="lab-ti">${ico[d.type]}</span>${esc(d.name)}</button>`).join('');
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
  function classify(l) {
    if (/^\s*\^$/.test(l) || /^% (Invalid|Incomplete|Ambiguous|Unknown|Bad|Login|Auth)/.test(l) || l.startsWith('Command rejected') || /^% (Access VLAN|Please|Connection)/.test(l) || l === 'Invalid Command.' || l.startsWith('VTP VLAN configuration not allowed')) return 'err';
    if (/^%[A-Z]+-\d-/.test(l)) return 'log';
    if (/^(Reply from .* bytes=|!!!!!|\.!!!!|Success rate is [1-9])/.test(l) || l.includes('...Open')) return 'good';
    if (l.startsWith('[Lab]') || l.startsWith('(Lab:')) return 'note';
    return '';
  }

  /** Ghi 1 lệnh + kết quả vào console của thiết bị `dev`. */
  function pushOut(dev, line, res, pr, hidden) {
    const T = termOf(s, dev);
    T.push({ t: pr + (hidden ? '' : line), c: 'cmd' });
    for (const l of res.out) T.push({ t: l, c: classify(l) });
    if (res.why && explainOn()) T.push({ t: '💡 Mô phỏng cho biết: ' + res.why, c: 'why' });
    if (res.sim) T.push({ sim: res.sim, label: res.simLabel || 'gói tin', ok: res.ok !== false });
    if (T.length > MAX_LINES) T.splice(1, T.length - MAX_LINES);
  }
  function exec(dev, line, opts = {}) {
    const pr = s.cli.prompt(dev);
    const wasPw = dev === s.dev && s.password;
    let res;
    try { res = mut(() => s.cli.exec(dev, line)); } catch (e) { res = { out: ['% Lỗi mô phỏng: ' + e.message], prompt: pr }; }
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
    exec(s.dev, line, opts);
    s.hpos = -1;
    renderAll(false);
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

  function renderSide() {
    const res = checkLab(lab, s.net, s.answers);
    const prev = s.results;
    // nhiệm vụ vừa chuyển sang đạt (so với lần chấm trước) → nháy sáng
    const fresh = res.map((x, i) => x && prev.length === res.length && !prev[i]);
    s.results = res;
    if (s.exam) { renderExamSide(); return; } // đang thi: không lộ tiến độ (kể cả dấu ✓ ở danh sách lab)
    const ok = res.filter(Boolean).length;
    const all = ok === res.length;
    if (!sandbox()) {
      const done = load('labs-done', {});
      if (all && !done[lab.id]) { done[lab.id] = true; save('labs-done', done); renderList(); }
    }
    const pct = Math.round((ok / res.length) * 100);
    let html = examResHtml() + `<div class="lab-side-h">${sandbox() ? 'Lộ trình gợi ý' : 'Nhiệm vụ'} <span class="lab-score${all ? ' all' : ''}">${ok}/${res.length}</span></div>` +
      `<div class="lab-bar"><div style="width:${pct}%"></div></div>`;
    if (all) html += `<div class="lab-win">🎉 ${sandbox() ? 'Bạn đã tự dựng được một mạng hoàn chỉnh!' : `Hoàn thành ${lab.id}! Mọi "Kết quả kiểm tra" đều đạt.`}</div>`;
    if (s.gainMsg) {
      const g = s.gainMsg;
      html += `<div class="lab-gain${g.gained.length ? '' : ' none'}">${g.gained.length ? `✓ ${esc(g.title)} vừa làm đạt: ${g.gained.map((i) => `<b>#${i + 1}</b> ${esc(lab.tasks[i].text)}`).join(' · ')}` : `${esc(g.title)} chưa làm đạt nhiệm vụ mới — thường là bước chuẩn bị cho bước sau.`}</div>`;
    }
    html += `<ol class="lab-tasks">${lab.tasks.map((t, i) => taskHtml(t, i, res[i], fresh[i])).join('')}</ol>`;
    html += `<label class="lab-explain"><input type="checkbox" id="lab-exp"${explainOn() ? ' checked' : ''}> 🔍 Giải thích lý do khi gói bị rớt${lab.kind === 'ticket' ? ' (ticket: mặc định tắt — tự chẩn đoán bằng show)' : ''}</label>`;
    const hasSol = solutionOf(lab).length > 0;
    html += `<div class="lab-acts"><button id="lab-hint">💡 Gợi ý (${s.hintN}/${lab.hints.length})</button>${hasSol ? '<button id="lab-sol">🔑 Lời giải</button>' : ''}${sandbox() ? '' : '<button id="lab-reset">↺ Làm lại</button><button id="lab-exam" title="Làm lại từ đầu, có giờ, không gợi ý — chấm thang 1000">⏱ Thi thử</button>'}</div>`;
    if (s.hintN) html += `<ul class="lab-hints">${lab.hints.slice(0, s.hintN).map((h) => `<li>${esc(h)}</li>`).join('')}</ul>`;
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
    if (s.showSol) {
      const qs = lab.tasks.map((t, i) => [t, i]).filter(([t]) => t.quiz);
      html += `<div class="lab-sol"><div class="lab-sol-h">Lời giải mẫu (một cách làm đúng)</div>` +
        solutionOf(lab).map(([dev, cmds]) => `<div class="lab-sol-dev">${esc(devName(dev))}</div><pre>${esc(dev === '@link' ? cmds.map(linkText).join('\n') : cmds.join('\n'))}</pre>`).join('') +
        (qs.length ? `<div class="lab-sol-dev">Đáp án trắc nghiệm</div><pre>${esc(qs.map(([t, i]) => `Câu ${i + 1}: ${String.fromCharCode(65 + t.quiz.correct)}. ${t.quiz.options[t.quiz.correct]}`).join('\n'))}</pre>` : '') +
        `<button id="lab-runsol" class="btn-accent">▶ Gõ lời giải vào console (xem từng lệnh)</button></div>`;
    }
    const scroll = $('lab-side').scrollTop;
    $('lab-side').innerHTML = html;
    $('lab-side').scrollTop = scroll;
    $('lab-exp').onchange = (e) => save(explainKey(), e.target.checked);
    $('lab-hint').onclick = () => { if (s.hintN < lab.hints.length) s.hintN += 1; renderSide(); };
    $('lab-side').querySelectorAll('.lab-qopt').forEach((b) => (b.onclick = () => {
      s.answers[+b.dataset.q] = +b.dataset.o;
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
      if (!s.showSol && lab.kind !== 'config' && !confirm('Xem lời giải ticket/dự án ngay? Thử tự chẩn đoán bằng lệnh show trước sẽ học được nhiều hơn.')) return;
      s.showSol = !s.showSol;
      renderSide();
    };
    const rst = $('lab-reset');
    if (rst) rst.onclick = () => {
      if (!confirm(`Làm lại ${lab.id} từ đầu? Mọi cấu hình bạn đã gõ và đáp án trắc nghiệm trong lab này sẽ bị xoá.`)) return;
      live.delete(lab.id);
      save('lablog:' + lab.id, []);
      save('labans:' + lab.id, {});
      s = session(lab);
      renderAll();
    };
    const rs = $('lab-runsol');
    if (rs) rs.onclick = typeSolution;
    const ex = $('lab-exam');
    if (ex) ex.onclick = startExam;
    const exx = $('lab-exres-x');
    if (exx) exx.onclick = () => { s.examRes = null; renderSide(); };
  }

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
      s.answers[+b.dataset.q] = +b.dataset.o;
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
    const outs = applySolution(lab, s.net, { exec: (dev, cmd) => ({ pr0: s.cli.prompt(dev), ...s.cli.exec(dev, cmd) }) });
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
    drawTopo();
    renderTabs();
    renderTerm();
    if (full) renderSide();
    else { clearTimeout(renderAll.t); renderAll.t = setTimeout(renderSide, 30); }
  }

  // Ctrl+Z / Ctrl+Y trong sandbox (khi KHÔNG gõ ở console — ở console Ctrl+Z = "end" như IOS)
  const onKey = (e) => {
    if (!document.body.contains(back)) { document.removeEventListener('keydown', onKey); return; }
    if (!sandbox() || !e.ctrlKey || e.target === input || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' || k === 'y') { e.preventDefault(); undoRedo(k === 'y' || e.shiftKey); }
  };
  document.addEventListener('keydown', onKey);
  $('lab-term').addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON' && !window.getSelection()?.toString()) input.focus(); });

  selectLab(lab.id);
}

function fmtTime(sec) { const m = Math.floor(sec / 60), x = sec % 60; return `${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; }
function el(name, attrs) { const n = document.createElementNS(SVG, name); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
