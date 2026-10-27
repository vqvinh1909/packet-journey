// ui/canvas.js — Canvas kéo-thả tự vẽ mạng (M5): thêm PC/Switch/Router, nối dây,
// cấu hình IP/gateway, rồi chạy mô phỏng ping (dùng scenarios/graphsim.js).

import { simulateGraph } from '../scenarios/graphsim.js';

const SVG = 'http://www.w3.org/2000/svg';
let seq = 0;

export function openCanvas(onRun) {
  document.querySelector('.modal-backdrop')?.remove();
  const devices = [];
  const links = [];
  let mode = 'move';     // move | wire | config | delete
  let wireFrom = null;
  let dragId = null, dragDX = 0, dragDY = 0;
  let selected = null;

  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal cv-modal';
  back.appendChild(modal);
  modal.innerHTML =
    `<div class="modal-h"><span>✏️ Vẽ mạng (kéo-thả)</span><button class="modal-x">✕</button></div>` +
    `<div class="cv-tools">` +
    `<button data-add="host">➕ PC</button><button data-add="switch">➕ Switch</button><button data-add="router">➕ Router</button>` +
    `<span class="cv-sep"></span>` +
    `<button data-mode="move" class="cv-mode btn-accent">✋ Di chuyển</button>` +
    `<button data-mode="wire" class="cv-mode">🔗 Nối dây</button>` +
    `<button data-mode="config" class="cv-mode">⚙ Cấu hình</button>` +
    `<button data-mode="delete" class="cv-mode">🗑 Xoá</button>` +
    `<span class="cv-hint" id="cv-hint">Thêm thiết bị rồi kéo để sắp xếp.</span>` +
    `</div>` +
    `<div class="cv-main"><svg id="cv-svg" viewBox="0 0 1000 440"></svg><div class="cv-side" id="cv-side"></div></div>` +
    `<div class="cv-run"><label>Nguồn <select id="cv-src"></select></label>` +
    `<label>Đích <select id="cv-dst"></select></label>` +
    `<button id="cv-go" class="btn-accent">▶ Chạy ping</button>` +
    `<span class="cv-err" id="cv-err"></span></div>`;
  const svg = modal.querySelector('#cv-svg');
  const hint = modal.querySelector('#cv-hint');
  const HINTS = { move: 'Kéo thiết bị để sắp xếp. Nhấp đúp để cấu hình.', wire: 'Bấm lần lượt 2 thiết bị để nối dây.', config: 'Bấm một thiết bị để cấu hình IP/gateway.', delete: 'Bấm thiết bị/dây để xoá.' };

  function spawn(type) {
    const n = devices.filter((d) => d.type === type).length + 1;
    const id = `${type[0]}${++seq}`;
    const name = (type === 'host' ? 'PC' : type === 'switch' ? 'SW' : 'R') + n;
    const x = 130 + (devices.length % 5) * 170;
    const y = 90 + Math.floor(devices.length / 5) * 130;
    const d = { id, type, name, x, y };
    if (type === 'host') Object.assign(d, { ip: '', prefix: 24, gateway: '' });
    if (type === 'router') d.rifaces = {};
    devices.push(d);
    render();
  }

  function setMode(m) {
    mode = m; wireFrom = null;
    modal.querySelectorAll('.cv-mode').forEach((b) => b.classList.toggle('btn-accent', b.dataset.mode === m));
    hint.textContent = HINTS[m];
    render();
  }

  function center(d) { return { x: d.x, y: d.y }; }

  function render() {
    svg.innerHTML = '';
    // links
    for (const l of links) {
      const a = devices.find((d) => d.id === l.a), b = devices.find((d) => d.id === l.b);
      if (!a || !b) continue;
      const line = el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'cv-link' });
      if (mode === 'delete') { line.classList.add('cv-del'); line.onclick = () => { links.splice(links.indexOf(l), 1); render(); }; }
      svg.appendChild(line);
    }
    // devices
    for (const d of devices) {
      const g = el('g', { class: 'cv-node' + (wireFrom === d.id ? ' cv-sel' : ''), 'data-id': d.id });
      if (d.type === 'router') g.appendChild(el('circle', { cx: d.x, cy: d.y, r: 26, class: 'cv-shape ' + d.type }));
      else g.appendChild(el('rect', { x: d.x - 40, y: d.y - 26, width: 80, height: 52, rx: 8, class: 'cv-shape ' + d.type }));
      g.appendChild(txt(d.x, d.y - 2, d.name, 'cv-name'));
      const sub = d.type === 'host' ? (d.ip ? `${d.ip}/${d.prefix}` : '(chưa IP)') : d.type;
      g.appendChild(txt(d.x, d.y + 14, sub, 'cv-sub'));
      g.style.cursor = mode === 'move' ? 'grab' : 'pointer';
      g.addEventListener('pointerdown', (e) => onNodeDown(e, d));
      g.addEventListener('dblclick', () => { setMode('config'); openConfig(d); });
      svg.appendChild(g);
    }
    refreshSelects();
  }

  function onNodeDown(e, d) {
    e.preventDefault();
    if (mode === 'move') { dragId = d.id; const p = toSvg(e); dragDX = p.x - d.x; dragDY = p.y - d.y; }
    else if (mode === 'wire') {
      if (!wireFrom) { wireFrom = d.id; render(); }
      else if (wireFrom !== d.id) {
        if (!links.some((l) => (l.a === wireFrom && l.b === d.id) || (l.a === d.id && l.b === wireFrom)))
          links.push({ id: `${wireFrom}-${d.id}`, a: wireFrom, b: d.id });
        wireFrom = null; render();
      }
    } else if (mode === 'config') openConfig(d);
    else if (mode === 'delete') {
      const i = devices.indexOf(d); devices.splice(i, 1);
      for (let k = links.length - 1; k >= 0; k--) if (links[k].a === d.id || links[k].b === d.id) links.splice(k, 1);
      render();
    }
  }

  svg.addEventListener('pointermove', (e) => {
    if (!dragId) return;
    const d = devices.find((x) => x.id === dragId); if (!d) return;
    const p = toSvg(e);
    d.x = Math.max(44, Math.min(956, p.x - dragDX));
    d.y = Math.max(32, Math.min(408, p.y - dragDY));
    render();
  });
  svg.addEventListener('pointerup', () => { dragId = null; });
  svg.addEventListener('pointerleave', () => { dragId = null; });

  function openConfig(d) {
    selected = d.id;
    const side = modal.querySelector('#cv-side');
    let html = `<h4>${d.name} <span class="cv-type">(${d.type})</span></h4>`;
    html += `<label class="cv-f">Tên<input id="cf-name" value="${d.name}"></label>`;
    if (d.type === 'host') {
      html += `<label class="cv-f">IP<input id="cf-ip" value="${d.ip || ''}" placeholder="192.168.1.10"></label>`;
      html += `<label class="cv-f">Prefix<input id="cf-pfx" value="${d.prefix}"></label>`;
      html += `<label class="cv-f">Gateway<input id="cf-gw" value="${d.gateway || ''}" placeholder="để trống nếu cùng mạng"></label>`;
    } else if (d.type === 'router') {
      const neigh = links.filter((l) => l.a === d.id || l.b === d.id).map((l) => (l.a === d.id ? l.b : l.a));
      if (!neigh.length) html += `<div class="cv-note">Nối dây router trước để đặt IP từng cổng.</div>`;
      neigh.forEach((nid) => {
        const nb = devices.find((x) => x.id === nid);
        const rif = (d.rifaces[nid] || {});
        html += `<div class="cv-iface"><b>Cổng → ${nb ? nb.name : nid}</b>` +
          `<label class="cv-f">IP<input data-rif="${nid}" data-k="ip" value="${rif.ip || ''}" placeholder="192.168.1.1"></label>` +
          `<label class="cv-f">Prefix<input data-rif="${nid}" data-k="prefix" value="${rif.prefix || 24}"></label></div>`;
      });
    } else html += `<div class="cv-note">Switch tầng 2 — không cần IP.</div>`;
    html += `<button id="cf-save" class="btn-accent">Lưu</button>`;
    side.innerHTML = html;
    side.querySelector('#cf-save').onclick = () => {
      d.name = side.querySelector('#cf-name').value.trim() || d.name;
      if (d.type === 'host') {
        d.ip = side.querySelector('#cf-ip').value.trim();
        d.prefix = parseInt(side.querySelector('#cf-pfx').value, 10) || 24;
        d.gateway = side.querySelector('#cf-gw').value.trim();
      } else if (d.type === 'router') {
        side.querySelectorAll('[data-rif]').forEach((inp) => {
          const nid = inp.dataset.rif, k = inp.dataset.k;
          d.rifaces[nid] = d.rifaces[nid] || {};
          d.rifaces[nid][k] = k === 'prefix' ? (parseInt(inp.value, 10) || 24) : inp.value.trim();
        });
      }
      render();
    };
  }

  function refreshSelects() {
    const hosts = devices.filter((d) => d.type === 'host');
    for (const id of ['cv-src', 'cv-dst']) {
      const sel = modal.querySelector('#' + id);
      const cur = sel.value;
      sel.innerHTML = hosts.map((h) => `<option value="${h.id}">${h.name} ${h.ip || ''}</option>`).join('');
      if (hosts.some((h) => h.id === cur)) sel.value = cur;
    }
    if (hosts.length >= 2 && modal.querySelector('#cv-dst').selectedIndex === modal.querySelector('#cv-src').selectedIndex)
      modal.querySelector('#cv-dst').selectedIndex = 1;
  }

  function toSvg(e) {
    const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (1000 / r.width), y: (e.clientY - r.top) * (440 / r.height) };
  }
  function el(name, attrs) { const n = document.createElementNS(SVG, name); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function txt(x, y, s, cls) { const t = el('text', { x, y, 'text-anchor': 'middle', class: cls }); t.textContent = s; return t; }

  // toolbar
  modal.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => spawn(b.dataset.add)));
  modal.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  modal.querySelector('#cv-go').onclick = () => {
    const srcId = modal.querySelector('#cv-src').value, dstId = modal.querySelector('#cv-dst').value;
    const err = modal.querySelector('#cv-err');
    if (!srcId || !dstId || srcId === dstId) { err.textContent = 'Chọn 2 PC khác nhau.'; return; }
    const res = simulateGraph(devices, links, srcId, dstId);
    if (res.error) { err.textContent = res.error; return; }
    back.remove();
    onRun(res);
  };
  const close = () => back.remove();
  modal.querySelector('.modal-x').onclick = close;

  // seed sẵn 2 PC + 1 switch cho dễ bắt đầu
  spawn('host'); spawn('switch'); spawn('host');
  links.push({ id: 'seedA', a: devices[0].id, b: devices[1].id }, { id: 'seedB', a: devices[1].id, b: devices[2].id });
  setMode('move');
  document.body.appendChild(back);
}
