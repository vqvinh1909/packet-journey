// ui/topology.js — vẽ sơ đồ mạng bằng SVG + animation gói tin chạy trên dây.

import { cloudPath, esc, layoutPortLabels, nodeBoxes, scenarioPorts } from './topo.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let svg = null;
let dot = null;
const coords = new Map(); // id -> {x, y}
const linkEls = new Map(); // linkId -> { line, label }
const nodeEls = new Map(); // devId -> { group, badge }

function el(name, attrs = {}, children = []) {
  const n = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const c of children) n.appendChild(c);
  return n;
}

/** Vẽ toàn bộ topology vào <svg id="topology-svg">. */
export function renderTopology(svgEl, topology) {
  svg = svgEl;
  svg.innerHTML = '';
  coords.clear();
  linkEls.clear();
  nodeEls.clear();
  svg.setAttribute('viewBox', topology.viewBox || '0 0 1000 300');

  for (const d of topology.devices) coords.set(d.id, { x: d.x, y: d.y });

  // links trước (nằm dưới node)
  for (const link of topology.links) {
    const a = coords.get(link.a);
    const b = coords.get(link.b);
    const line = el('line', { class: 'link-line', x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    svg.appendChild(line);
    const mx = (a.x + b.x) / 2;
    const ly = (a.y + b.y) / 2 - 6;
    const base = link.labelMid || '';
    const labelBg = el('rect', { class: 'link-label-bg', rx: 4, opacity: 0 });
    const label = el('text', { class: 'link-label', x: mx, y: ly, 'text-anchor': 'middle' }, [txt(base)]);
    svg.appendChild(labelBg);
    svg.appendChild(label);
    const entry = { line, label, labelBg, mx, ly, base };
    sizeLabelBg(entry);
    linkEls.set(link.id, entry);
  }

  // node
  for (const d of topology.devices) drawNode(d);
  drawPorts(topology);
  fitView();

  // dot gói tin (ẩn ban đầu)
  dot = el('circle', { class: 'pkt-dot', r: 9, cx: 0, cy: 0, opacity: 0 });
  svg.appendChild(dot);
}

/** Khung nhìn ôm sát các thiết bị để sơ đồ to nhất trong cột; sơ đồ ít máy vẫn giữ tối thiểu 600 đơn vị cho khỏi phóng quá to. */
function fitView() {
  let b;
  try { b = svg.getBBox(); } catch { return; } // svg đang ẩn thì giữ viewBox gốc
  if (!b.width) return;
  const w = Math.max(b.width + 48, 600), h = b.height + 60;
  svg.setAttribute('viewBox', `${Math.round(b.x + b.width / 2 - w / 2)} ${Math.round(b.y - 34)} ${Math.round(w)} ${Math.round(h)}`);
}

/** Nhãn tên cổng ở hai đầu dây, vẽ sau thiết bị để nền của thiết bị không che mất. */
function drawPorts(topology) {
  const names = scenarioPorts(topology), lineW = (d) => Math.max(0, ...(d.lines || []).map((s) => s.length * 6.2));
  const devices = Object.fromEntries(topology.devices.map((d) => {
    const [icon] = nodeBoxes(d, false), w = Math.max(d.name.length * 8, lineW(d)) + 8;
    return [d.id, { ...d, boxes: [icon, { l: d.x - w / 2, r: d.x + w / 2, t: d.y + 22, b: d.y + 40 + (d.lines || []).length * 13 }] }];
  }));
  const links = topology.links.map((l) => ({ ...l, ap: names[l.id][0], bp: names[l.id][1] }));
  const pos = layoutPortLabels({ devices, links }, (d, port) => port);
  for (const l of links) [l.ap, l.bp].forEach((text, i) => {
    if (!text) return;
    const p = pos[l.id][i];
    svg.appendChild(el('rect', { class: 'lab-port-bg', x: p.x - p.w / 2, y: p.y - 8, width: p.w, height: 15, rx: 4 }));
    svg.appendChild(el('text', { class: 'lab-port', x: p.x, y: p.y + 3.5, 'text-anchor': 'middle' }, [txt(text)]));
  });
}

function txt(s) { return document.createTextNode(s); }

// Chỉnh nền (chip) phía sau nhãn link cho dễ đọc; ẩn khi nhãn rỗng.
function sizeLabelBg(entry) {
  const s = entry.label.textContent || '';
  if (!s) { entry.labelBg.setAttribute('opacity', 0); return; }
  const w = s.length * 6.0 + 12;
  entry.labelBg.setAttribute('x', entry.mx - w / 2);
  entry.labelBg.setAttribute('y', entry.ly - 11);
  entry.labelBg.setAttribute('width', w);
  entry.labelBg.setAttribute('height', 16);
  entry.labelBg.setAttribute('opacity', 1);
}

// Mũi tên nhỏ: đoạn thẳng + đầu nhọn tại (x2,y2).
function arrow(x1, y1, x2, y2) {
  const g = el('g', {});
  g.appendChild(el('line', { class: 'glyph-line', x1, y1, x2, y2 }));
  const a = Math.atan2(y2 - y1, x2 - x1);
  const s = 5;
  const p = (ang, w) => `${x2 - s * Math.cos(a) + w * Math.sin(a)},${y2 - s * Math.sin(a) - w * Math.cos(a)}`;
  g.appendChild(el('polygon', { class: 'glyph-arrow', points: `${x2},${y2} ${p(a, 3.4)} ${p(a, -3.4)}` }));
  return g;
}

function drawIcon(d) {
  const { x, y } = d;
  const parts = [];
  if (d.type === 'cloud') {
    // Đám mây "Internet" (vẫn là server giả lập, chỉ đổi hình vẽ)
    parts.push(el('path', { class: 'glyph-body glyph-cloud', d: cloudPath(x, y) }));
  } else if (d.type === 'host') {
    // Màn hình + chân đế
    parts.push(el('rect', { class: 'glyph-body', x: x - 22, y: y - 22, width: 44, height: 30, rx: 3 }));
    parts.push(el('rect', { class: 'glyph-screen', x: x - 18, y: y - 18, width: 36, height: 22, rx: 1 }));
    parts.push(el('rect', { class: 'glyph-fill', x: x - 5, y: y + 8, width: 10, height: 5 }));
    parts.push(el('rect', { class: 'glyph-fill', x: x - 13, y: y + 13, width: 26, height: 3, rx: 1 }));
  } else if (d.type === 'switch') {
    // Hộp dẹt + 2 mũi tên ngược chiều (⇄)
    parts.push(el('rect', { class: 'glyph-body', x: x - 34, y: y - 17, width: 68, height: 32, rx: 4 }));
    parts.push(arrow(x + 16, y - 7, x - 16, y - 7));
    parts.push(arrow(x - 16, y + 7, x + 16, y + 7));
  } else {
    // Router: hình tròn + 4 mũi tên toả ra
    parts.push(el('circle', { class: 'glyph-body', cx: x, cy: y, r: 24 }));
    parts.push(arrow(x, y, x + 15, y));
    parts.push(arrow(x, y, x - 15, y));
    parts.push(arrow(x, y, x, y + 15));
    parts.push(arrow(x, y, x, y - 15));
  }
  if (d.color) {
    for (const p of parts) {
      const body = p.classList && p.classList.contains('glyph-body');
      if (body) p.setAttribute('stroke', d.color);
    }
  }
  return parts;
}

function drawNode(d) {
  const g = el('g', { class: 'dev-node', 'data-id': d.id });
  // nền bo tròn: vừa highlight khi active, vừa che đường link chạy phía sau để chữ không chồng lên line
  const nLines = (d.lines || []).length;
  const bgH = 70 + nLines * 14;
  g.appendChild(el('rect', { class: 'node-bg', x: d.x - 74, y: d.y - 30, width: 148, height: bgH, rx: 10 }));
  for (const p of drawIcon(d)) g.appendChild(p);
  // tên thiết bị dưới icon
  g.appendChild(el('text', { class: 'dev-name', x: d.x, y: d.y + 34, 'text-anchor': 'middle' }, [txt(d.name)]));
  // badge phía trên (vd ★ ROOT), ẩn ban đầu
  const badge = el('text', { class: 'dev-badge', x: d.x, y: d.y - 34, 'text-anchor': 'middle', opacity: 0 }, [txt('')]);
  g.appendChild(badge);
  // chú thích dưới tên
  (d.lines || []).forEach((line, i) => {
    g.appendChild(el('text', { class: 'dev-line', x: d.x, y: d.y + 50 + i * 13, 'text-anchor': 'middle' }, [txt(line)]));
  });
  svg.appendChild(g);
  nodeEls.set(d.id, { group: g, badge });
}

/** Làm sáng thiết bị đang xử lý. */
export function setActiveDevice(id) {
  svg.querySelectorAll('.dev-node').forEach((n) => {
    n.classList.toggle('active', n.getAttribute('data-id') === id);
  });
}

/**
 * Áp lớp phủ theo bước: trạng thái/nhãn từng link + badge thiết bị.
 * overlay = { links: { linkId: { cls, label } }, badges: { devId: 'ROOT' } }
 */
export function applyOverlay(overlay) {
  // reset về trạng thái gốc
  for (const entry of linkEls.values()) {
    entry.line.setAttribute('class', 'link-line');
    entry.label.textContent = entry.base;
    sizeLabelBg(entry);
  }
  for (const { badge } of nodeEls.values()) badge.setAttribute('opacity', 0);
  if (!overlay) return;

  for (const [id, cfg] of Object.entries(overlay.links || {})) {
    const le = linkEls.get(id);
    if (!le) continue;
    le.line.setAttribute('class', 'link-line ' + (cfg.cls || ''));
    if (cfg.label != null) { le.label.textContent = cfg.label; sizeLabelBg(le); }
  }
  for (const [id, text] of Object.entries(overlay.badges || {})) {
    const ne = nodeEls.get(id);
    if (!ne) continue;
    ne.badge.textContent = text;
    ne.badge.setAttribute('opacity', 1);
  }
}

function setDot(id, arp) {
  const c = coords.get(id);
  if (!c) return;
  dot.classList.toggle('arp', !!arp);
  dot.style.transition = 'none';
  dot.setAttribute('cx', c.x);
  dot.setAttribute('cy', c.y);
  dot.setAttribute('opacity', 1);
}

export function hideDot() {
  if (dot) dot.setAttribute('opacity', 0);
}

/** Đặt gói tại một thiết bị ngay lập tức (dùng khi tua tay, không animation). */
export function placeDot(id, arp) { setDot(id, arp); }

/**
 * Cho gói chạy từ thiết bị này sang thiết bị khác. Trả về Promise khi xong.
 * Dùng cx/cy transition. Nếu from === to (host tự nhận) thì chỉ nhấp nháy tại chỗ.
 */
/** Vẽ các bảng (ARP/MAC/routing) của thiết bị trong bước hiện tại. */
export function renderTables(container, tables, t) {
  container.innerHTML = '';
  const defs = [
    ['arp', t('colArp')],
    ['mac', t('colMac')],
    ['routing', t('colRoute')],
    ['nat', t('colNat')],
    ['list', null], // bảng tự đặt cột: { title, cols, rows:[[...]] }
  ];
  let any = false;
  for (const [kind, cols] of defs) {
    const data = tables?.[kind];
    if (!data) continue;
    any = true;
    const head = cols || data.cols;
    const box = document.createElement('div');
    box.className = 'dev-table';
    const rowsHtml = (data.rows || []).map((r) => {
      let cells;
      if (kind === 'list') cells = r;
      else if (kind === 'arp') cells = [r.ip, r.mac];
      else if (kind === 'mac') cells = [r.mac, r.port];
      else if (kind === 'nat') cells = [r.insideLocal, r.insideGlobal, r.outside, r.proto];
      else cells = [r.network, '/' + r.prefix, r.nextHop, r.iface, r.kind];
      const key = kind === 'routing' ? `${r.network}/${r.prefix}` : '';
      const hl = data.highlight && data.highlight.startsWith(key) && key ? ' class="hl"' : '';
      return `<tr${hl}>${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`;
    }).join('');
    box.innerHTML = `<h4>${esc(data.title)}</h4><table>` +
      `<thead><tr>${head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` +
      `<tbody>${rowsHtml || `<tr><td colspan="${head.length}" class="empty">(trống)</td></tr>`}</tbody></table>`;
    container.appendChild(box);
  }
  container.style.display = any ? 'flex' : 'none';
}


export function animateDot(fromId, toId, durationMs, arp) {
  return new Promise((resolve) => {
    const from = coords.get(fromId);
    const to = coords.get(toId);
    if (!from || !to) { resolve(); return; }
    dot.classList.toggle('arp', !!arp);
    // đặt tại điểm đầu, không transition
    dot.style.transition = 'none';
    dot.setAttribute('cx', from.x);
    dot.setAttribute('cy', from.y);
    dot.setAttribute('opacity', 1);
    // ép trình duyệt áp dụng vị trí đầu trước khi bật transition
    void dot.getBBox();
    requestAnimationFrame(() => {
      dot.style.transition = `cx ${durationMs}ms ease-in-out, cy ${durationMs}ms ease-in-out`;
      dot.setAttribute('cx', to.x);
      dot.setAttribute('cy', to.y);
      let done = false;
      const finish = () => { if (done) return; done = true; dot.removeEventListener('transitionend', finish); resolve(); };
      dot.addEventListener('transitionend', finish);
      setTimeout(finish, durationMs + 120); // phòng khi transitionend không bắn
    });
  });
}
