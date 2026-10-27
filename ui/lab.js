// ui/lab.js — "🧪 Lab CLI": chọn lab theo giáo trình, xem topology, gõ lệnh IOS trên console
// từng thiết bị, nhiệm vụ tự chấm sau mỗi lệnh. Ping/traceroute/telnet/DHCP trả về timeline
// byte-thật → nút "▶ Xem gói tin" mở trong màn hình chính (cây trường, hex, .pcap).

import { LABS, LAB_GROUPS, getLab, buildLab, checkLab } from '../lab/labs.js';
import { createCli } from '../lab/ios.js';
import * as N from '../lab/net.js';
import { load, save } from './store.js';
import { lessonHref } from './i18n.js';

const SVG = 'http://www.w3.org/2000/svg';
const live = new Map(); // labId -> phiên đang làm (giữ nguyên khi đóng/mở lại modal)
const MAX_LINES = 800;

export function openLab(onRun) {
  document.querySelector('.modal-backdrop')?.remove();
  let lab = getLab(load('lab-cur', 'L01')) || LABS[0];
  let s = null;

  const back = document.createElement('div');
  back.className = 'modal-backdrop lab-back';
  const modal = document.createElement('div');
  modal.className = 'modal lab-modal';
  back.appendChild(modal);
  modal.innerHTML =
    `<div class="modal-h"><span>🧪 Lab thực hành CLI — Cisco IOS <span class="lab-count" id="lab-count"></span></span><button class="modal-x" title="Đóng (lab vẫn được giữ nguyên)">✕</button></div>` +
    `<div class="lab-body">` +
    `<aside class="lab-list" id="lab-list"></aside>` +
    `<main class="lab-main">` +
    `<select class="lab-select" id="lab-select" aria-label="Chọn lab"></select>` +
    `<div class="lab-head" id="lab-head"></div>` +
    `<svg class="lab-topo" id="lab-topo" viewBox="0 0 1000 440" role="img" aria-label="topology"></svg>` +
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

  // ---------------------------------------------------------------- danh sách lab
  function renderList() {
    const done = load('labs-done', {});
    $('lab-count').textContent = `· ${LABS.length} lab · đã xong ${LABS.filter((l) => done[l.id]).length}`;
    let html = '';
    for (const g of LAB_GROUPS) {
      const items = LABS.filter((l) => l.group === g.id);
      if (!items.length) continue;
      html += `<div class="lab-grp">${esc(g.title)}</div>`;
      for (const l of items) {
        html += `<button class="lab-item${l.id === lab.id ? ' active' : ''}${done[l.id] ? ' done' : ''}" data-id="${l.id}">` +
          `<span class="lab-id">${done[l.id] ? '✓' : l.id}</span><span class="lab-t">${esc(l.title)}</span><span class="lab-lv" title="Độ khó">${'●'.repeat(l.level)}${'○'.repeat(3 - l.level)}</span></button>`;
      }
    }
    $('lab-list').innerHTML = html;
    $('lab-list').querySelectorAll('.lab-item').forEach((b) => (b.onclick = () => selectLab(b.dataset.id)));
    $('lab-select').innerHTML = LAB_GROUPS.map((g) => `<optgroup label="${esc(g.title)}">${LABS.filter((l) => l.group === g.id).map((l) => `<option value="${l.id}"${l.id === lab.id ? ' selected' : ''}>${done[l.id] ? '✓ ' : ''}${l.id} — ${esc(l.title)}</option>`).join('')}</optgroup>`).join('');
    $('lab-select').onchange = (e) => selectLab(e.target.value);
  }

  function selectLab(id) {
    lab = getLab(id);
    save('lab-cur', id);
    s = session(lab);
    renderList();
    renderHead();
    renderAll();
    input.focus();
  }

  // ---------------------------------------------------------------- phiên lab
  function session(l) {
    let x = live.get(l.id);
    if (x) return x;
    const net = buildLab(l);
    const cli = createCli(net);
    x = { lab: l, net, cli, dev: l.solution[0]?.[0] || Object.keys(net.devices)[0], term: {}, hist: {}, hpos: -1, log: [], hintN: 0, showSol: false, results: [], password: false };
    const old = load('lablog:' + l.id, null);
    if (Array.isArray(old) && old.length) {
      for (const [dev, cmd] of old) { try { cli.exec(dev, cmd); } catch { /* bỏ qua lệnh lỗi cũ */ } }
      x.log = old.slice();
      for (const id of Object.keys(net.devices)) termOf(x, id).push({ t: `(Đã khôi phục ${old.length} lệnh bạn gõ lần trước — bấm "↺ Làm lại" để bắt đầu sạch)`, c: 'sys' });
    }
    live.set(l.id, x);
    return x;
  }
  function termOf(x, id) {
    if (!x.term[id]) {
      const d = x.net.devices[id];
      x.term[id] = [{ t: d.type === 'pc' || d.type === 'server' ? 'Packet Tracer PC Command Line 1.0  (gõ ? để xem lệnh)' : `${d.name} con0 — gõ ? để trợ giúp, Tab hoàn thành lệnh, ↑/↓ lịch sử, Ctrl+Z = end, Ctrl+V dán nhiều dòng cấu hình`, c: 'sys' }];
    }
    return x.term[id];
  }

  // ---------------------------------------------------------------- phần đầu (đề bài)
  function renderHead() {
    const kind = lab.kind === 'ticket' ? '🎫 Ticket sự cố' : lab.kind === 'project' ? '🏢 Dự án tổng hợp' : '🛠️ Lab cấu hình';
    $('lab-head').innerHTML =
      `<div class="lab-title"><span class="lab-badge">${lab.id}</span> ${esc(lab.title)}</div>` +
      `<div class="lab-meta">${kind} · ${esc(lab.lesson)} · Độ khó ${'●'.repeat(lab.level)}${'○'.repeat(3 - lab.level)} · <a href="${lessonHref(lab.lessonPath)}" target="_blank" rel="noopener">📖 Đọc bài trong giáo trình</a></div>` +
      `<div class="lab-story${lab.kind === 'ticket' ? ' ticket' : ''}">${esc(lab.story)}</div>`;
  }

  // ---------------------------------------------------------------- topology
  function drawTopo() {
    const svg = $('lab-topo');
    const net = s.net;
    svg.innerHTML = '';
    // khung nhìn ôm sát các thiết bị → icon/chữ to nhất có thể trong ô topology
    const ds = Object.values(net.devices);
    const xs = ds.map((d) => d.x), ys = ds.map((d) => d.y);
    const x0 = Math.min(...xs) - 80, y0 = Math.min(...ys) - 45, x1 = Math.max(...xs) + 80, y1 = Math.max(...ys) + 68;
    svg.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
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
      layerLinks.appendChild(el('line', { x1: A.x + ox, y1: A.y + oy, x2: B.x + ox, y2: B.y + oy, class: 'lab-link ' + cls }));
      for (const [D, port, t] of [[A, l.ap, 0.24], [B, l.bp, 0.76]]) {
        const px = A.x + dx * t + ox, py = A.y + dy * t + oy;
        const label = D.type === 'pc' || D.type === 'server' ? 'Fa0' : N.shortIf(port);
        const w = label.length * 6.6 + 8;
        layerLabels.appendChild(el('rect', { x: px - w / 2, y: py - 8, width: w, height: 15, rx: 4, class: 'lab-port-bg' }));
        const tx = el('text', { x: px, y: py + 3.5, 'text-anchor': 'middle', class: 'lab-port' });
        tx.textContent = label;
        layerLabels.appendChild(tx);
      }
    }
    for (const d of Object.values(net.devices)) {
      const g = el('g', { class: 'lab-node' + (d.id === s.dev ? ' sel' : ''), tabindex: 0, role: 'button', 'aria-label': d.name });
      g.appendChild(el('circle', { cx: d.x, cy: d.y, r: 33, class: 'lab-halo' }));
      glyph(g, d);
      const nm = el('text', { x: d.x, y: d.y + 44, 'text-anchor': 'middle', class: 'lab-name' });
      nm.textContent = d.name;
      g.appendChild(nm);
      if (d.type === 'pc' || d.type === 'server') {
        const ip = el('text', { x: d.x, y: d.y + 58, 'text-anchor': 'middle', class: 'lab-ip' });
        ip.textContent = d.ip ? `${d.ip}/${d.prefix}` : d.dhcp ? 'DHCP (chưa có IP)' : '(chưa có IP)';
        g.appendChild(ip);
      }
      g.onclick = () => pickDev(d.id);
      g.onkeydown = (e) => { if (e.key === 'Enter') pickDev(d.id); };
      layerNodes.appendChild(g);
    }
  }
  function glyph(g, d) {
    const { x, y } = d;
    if (d.type === 'router') {
      g.appendChild(el('circle', { cx: x, cy: y, r: 22, class: 'lab-g router' }));
      for (const [ax, ay, bx, by] of [[-11, -11, 11, 11], [11, -11, -11, 11]]) g.appendChild(el('line', { x1: x + ax, y1: y + ay, x2: x + bx, y2: y + by, class: 'lab-gl' }));
      for (const [px, py] of [[-11, -11], [11, 11], [11, -11], [-11, 11]]) g.appendChild(el('circle', { cx: x + px, cy: y + py, r: 2.6, class: 'lab-gd' }));
    } else if (d.type === 'switch') {
      g.appendChild(el('rect', { x: x - 28, y: y - 16, width: 56, height: 32, rx: 6, class: 'lab-g switch' }));
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
    if (d.type === 'pc' || d.type === 'server') return true;
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
    s.password = s.cli.session(id).pw != null && !!s.cli.session(id).pw;
    drawTopo();
    renderTabs();
    renderTerm();
    input.focus();
  }
  function renderTerm() {
    const out = $('lab-out');
    const lines = termOf(s, s.dev);
    out.innerHTML = '';
    for (const ln of lines) {
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
      div.textContent = ln.t === '' ? ' ' : ln.t;
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

  function run(line, opts = {}) {
    const dev = s.dev;
    const T = termOf(s, dev);
    const pr = s.cli.prompt(dev);
    const wasPw = s.password;
    T.push({ t: pr + (wasPw ? '' : line), c: 'cmd' });
    let res;
    try { res = s.cli.exec(dev, line); } catch (e) { res = { out: ['% Lỗi mô phỏng: ' + e.message], prompt: pr }; }
    for (const l of res.out) T.push({ t: l, c: classify(l) });
    if (res.why && explainOn()) T.push({ t: '💡 Mô phỏng cho biết: ' + res.why, c: 'why' });
    if (res.sim) T.push({ sim: res.sim, label: res.simLabel || 'gói tin', ok: res.ok !== false });
    if (T.length > MAX_LINES) T.splice(1, T.length - MAX_LINES);
    s.password = !!res.password;
    if (!opts.noLog) {
      s.log.push([dev, line]);
      if (s.log.length > 3000) s.log.shift();
      save('lablog:' + lab.id, s.log);
      if (!wasPw && line.trim()) { (s.hist[dev] ||= []).push(line); }
    }
    s.hpos = -1;
    renderAll(false);
  }

  input.addEventListener('keydown', (e) => {
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

  // ---------------------------------------------------------------- nhiệm vụ / gợi ý / lời giải
  function renderSide() {
    const res = checkLab(lab, s.net);
    s.results = res;
    const ok = res.filter(Boolean).length;
    const done = load('labs-done', {});
    const all = ok === res.length;
    if (all && !done[lab.id]) { done[lab.id] = true; save('labs-done', done); renderList(); }
    const pct = Math.round((ok / res.length) * 100);
    let html = `<div class="lab-side-h">Nhiệm vụ <span class="lab-score${all ? ' all' : ''}">${ok}/${res.length}</span></div>` +
      `<div class="lab-bar"><div style="width:${pct}%"></div></div>`;
    if (all) html += `<div class="lab-win">🎉 Hoàn thành ${lab.id}! Mọi "Kết quả kiểm tra" đều đạt.</div>`;
    html += `<ol class="lab-tasks">${lab.tasks.map((t, i) => `<li class="${res[i] ? 'ok' : 'no'}"><span class="lab-mk">${res[i] ? '✓' : '○'}</span><div><div class="lab-tt">${esc(t.text)}</div><div class="lab-vf">Kiểm tra: <code>${esc(t.verify)}</code></div></div></li>`).join('')}</ol>`;
    html += `<label class="lab-explain"><input type="checkbox" id="lab-exp"${explainOn() ? ' checked' : ''}> 🔍 Giải thích lý do khi gói bị rớt${lab.kind === 'ticket' ? ' (ticket: mặc định tắt — tự chẩn đoán bằng show)' : ''}</label>`;
    html += `<div class="lab-acts"><button id="lab-hint">💡 Gợi ý (${s.hintN}/${lab.hints.length})</button><button id="lab-sol">🔑 Lời giải</button><button id="lab-reset">↺ Làm lại</button></div>`;
    if (s.hintN) html += `<ul class="lab-hints">${lab.hints.slice(0, s.hintN).map((h) => `<li>${esc(h)}</li>`).join('')}</ul>`;
    if (s.showSol) {
      html += `<div class="lab-sol"><div class="lab-sol-h">Lời giải mẫu (một cách làm đúng)</div>` +
        lab.solution.map(([dev, cmds]) => `<div class="lab-sol-dev">${esc(s.net.devices[dev].name)}</div><pre>${esc(cmds.join('\n'))}</pre>`).join('') +
        `<button id="lab-runsol" class="btn-accent">▶ Gõ lời giải vào console (xem từng lệnh)</button></div>`;
    }
    $('lab-side').innerHTML = html;
    $('lab-exp').onchange = (e) => save(explainKey(), e.target.checked);
    $('lab-hint').onclick = () => { if (s.hintN < lab.hints.length) s.hintN += 1; renderSide(); };
    $('lab-sol').onclick = () => {
      if (!s.showSol && lab.kind !== 'config' && !confirm('Xem lời giải ticket/dự án ngay? Thử tự chẩn đoán bằng lệnh show trước sẽ học được nhiều hơn.')) return;
      s.showSol = !s.showSol;
      renderSide();
    };
    $('lab-reset').onclick = () => {
      if (!confirm(`Làm lại ${lab.id} từ đầu? Mọi cấu hình bạn đã gõ trong lab này sẽ bị xoá.`)) return;
      live.delete(lab.id);
      save('lablog:' + lab.id, []);
      s = session(lab);
      renderAll();
    };
    const rs = $('lab-runsol');
    if (rs) rs.onclick = () => {
      for (const [dev, cmds] of lab.solution) { s.dev = dev; for (const c of cmds) run(c); }
      renderAll();
    };
  }

  // Ticket sự cố: mặc định KHÔNG giải thích (như ngoài đời, phải tự show/ping để chẩn đoán)
  function explainKey() { return lab.kind === 'ticket' ? 'lab-explain-ticket' : 'lab-explain'; }
  function explainOn() { return load(explainKey(), lab.kind !== 'ticket'); }

  function renderAll(full = true) {
    drawTopo();
    renderTabs();
    renderTerm();
    if (full) renderSide();
    else { clearTimeout(renderAll.t); renderAll.t = setTimeout(renderSide, 30); }
  }

  $('lab-term').addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON' && !window.getSelection()?.toString()) input.focus(); });

  selectLab(lab.id);
}

function el(name, attrs) { const n = document.createElementNS(SVG, name); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
