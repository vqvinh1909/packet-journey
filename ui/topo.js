// ui/topo.js — phần vẽ dùng chung cho Lab CLI (ui/lab.js) và workspace tự dựng mạng (ui/workspace.js):
// biểu tượng thiết bị SVG tự vẽ, cổng STP BLOCKING, trạng thái cổng, phân loại dòng console để tô màu.

import * as N from '../lab/net.js';

export const SVG = 'http://www.w3.org/2000/svg';
export const isHost = (d) => d.type === 'pc' || d.type === 'server';
export function el(name, attrs) { const n = document.createElementNS(SVG, name); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
export function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

/** Vẽ biểu tượng thiết bị d (toạ độ d.x, d.y) vào nhóm SVG g. */
export function drawGlyph(g, d) {
  const { x, y } = d;
  if (N.isCloud(d)) {
    g.appendChild(el('path', { d: cloudPath(x, y), class: 'lab-g cloud' })); // đám mây "Internet" (vẫn là server giả lập)
  } else if (d.fw && d.os) {
    // firewall: bức tường gạch (router chạy Zone-Based Firewall vẫn vẽ như router)
    g.appendChild(el('rect', { x: x - 24, y: y - 18, width: 48, height: 36, rx: 4, class: 'lab-g fw' }));
    g.appendChild(el('path', { d: `M${x - 24} ${y - 6}h48 M${x - 24} ${y + 6}h48 M${x - 8} ${y - 18}v12 M${x + 10} ${y - 18}v12 M${x} ${y - 6}v12 M${x - 16} ${y - 6}v12 M${x + 16} ${y - 6}v12 M${x - 8} ${y + 6}v12 M${x + 10} ${y + 6}v12`, class: 'lab-gl fwl' }));
  } else if (d.type === 'router') {
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
/** Đường bao đám mây quanh (x, y): 4 cung tròn nối nhau + đáy phẳng; rộng ~70 (x−33…x+36), cao ~38 (y−22…y+16). */
export function cloudPath(x, y) {
  const P = (dx, dy) => `${x + dx} ${y + dy}`;
  return `M${P(-22, 16)} A11 11 0 0 1 ${P(-23, -6)} A15 15 0 0 1 ${P(3.9, -16.2)} A13 13 0 0 1 ${P(25, -6)} A11 11 0 0 1 ${P(25, 16)} Z`;
}
/**
 * Điểm đầu dây phía thiết bị d khi nối tới (tx, ty): đám mây thì cắm vào MÉP (xấp xỉ elip),
 * thiết bị khác giữ tâm (icon vẽ đè lên đầu dây). Trả { x, y }.
 */
export function linkEnd(d, tx, ty) {
  if (!N.isCloud(d)) return { x: d.x, y: d.y };
  const cx = d.x + 1.5, cy = d.y - 3, a = 35, b = 19;
  const dx = tx - cx, dy = ty - cy, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const r = Math.min(len, 1 / Math.hypot(ux / a, uy / b));
  return { x: cx + ux * r, y: cy + uy * r };
}
/** Cổng đang bật về mặt quản trị (không shutdown) — để tô dây "admin down". */
export function adminUp(net, dev, port) {
  const d = net.devices[dev];
  if (isHost(d)) return true;
  if (d.type === 'switch') return !d.ports[port]?.shutdown;
  return !d.ifaces[port]?.shutdown;
}
/** Lớp màu cho một dòng output console. */
export function classifyLine(l) {
  if (/^ERROR:/.test(l) || /^\s*\^$/.test(l) || /^% (Invalid|Incomplete|Ambiguous|Unknown|Bad|Login|Auth)/.test(l) || l.startsWith('Command rejected') || /^% (Access VLAN|Please|Connection)/.test(l) || l === 'Invalid Command.' || l.startsWith('VTP VLAN configuration not allowed')) return 'err';
  if (/^%[A-Z]+-\d-/.test(l) || /^\*\w{3}\s+\d+ [\d:.]+: /.test(l)) return 'log';
  if (/^(Reply from .* bytes=|!!!!!|\.!!!!|Success rate is [1-9])/.test(l) || l.includes('...Open')) return 'good';
  if (l.startsWith('[Lab]') || l.startsWith('(Lab:')) return 'note';
  return '';
}

/** Cổng switch đang STP BLOCKING (hoặc LISTENING/LEARNING khi đang hội tụ): Map 'dev|cổng vật lý' → [VLAN...] (để đánh dấu trên topology). */
export function stpBlocked(net) {
  const out = new Map();
  const vlans = new Set();
  for (const d of Object.values(net.devices)) if (d.type === 'switch') for (const v of Object.keys(d.vlans)) vlans.add(+v);
  if (vlans.size > 24) return out; // quá nhiều VLAN: bỏ qua phần trang trí này cho nhẹ
  for (const v of [...vlans].sort((x, y) => x - y)) {
    for (const [k, P] of Object.entries(N.stpState(net, v).ports)) {
      if (P.sts === 'FWD') continue;
      const dev = k.slice(0, k.indexOf('|'));
      // BLK = Alternate; LSN/LRN = đang hội tụ (⏱ đồng hồ mô phỏng) — mảng VLAN, .sts = trạng thái "nhẹ" nhất
      for (const m of P.members) {
        const key = dev + '|' + m;
        if (!out.has(key)) out.set(key, Object.assign([], { sts: P.sts }));
        const a = out.get(key);
        a.push(v);
        if (P.sts === 'BLK') a.sts = 'BLK';
      }
    }
  }
  return out;
}
