// lab/diagram.js — lõi trình vẽ sơ đồ mạng kiểu draw.io (✏️ Vẽ mạng — CHỈ để vẽ; cấu hình & chạy thử nằm ở Lab CLI /
// workspace): hình (thiết bị mạng + hình cơ bản), dây nối (thẳng / gấp khúc / cong, nét liền / gạch / chấm, mũi tên,
// nhãn giữa + nhãn cổng 2 đầu), nhóm, khoá, căn lề, dàn đều, thứ tự lớp, hoàn tác, xuất SVG (chuỗi — dùng cho cả vẽ
// trên màn hình và tải file / chuyển PNG), nhập/xuất JSON, mẫu sơ đồ. Hàm thuần, không đụng DOM — giao diện ở ui/diagram.js.

export const FORMAT = 'packet-journey-diagram';
export const GRID = 10;
const DASH = { solid: '', dash: '8 6', dot: '2 5' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// ---------------------------------------------------------------- thư viện hình
export const SHAPES = {
  router: { group: 'net', vi: 'Router', en: 'Router', w: 64, h: 52, fill: '#e8f1fb', stroke: '#2f6fde', prefix: 'R' },
  switch: { group: 'net', vi: 'Switch', en: 'Switch', w: 72, h: 44, fill: '#e9f7ef', stroke: '#2e9e57', prefix: 'SW' },
  l3switch: { group: 'net', vi: 'Switch Layer 3', en: 'Layer 3 switch', w: 72, h: 50, fill: '#e6f4f1', stroke: '#16857a', prefix: 'L3SW' },
  firewall: { group: 'net', vi: 'Firewall', en: 'Firewall', w: 60, h: 52, fill: '#fdecea', stroke: '#d64545', prefix: 'FW' },
  server: { group: 'net', vi: 'Server', en: 'Server', w: 44, h: 60, fill: '#eef0f3', stroke: '#5b6573', prefix: 'SRV' },
  pc: { group: 'net', vi: 'PC', en: 'PC', w: 60, h: 52, fill: '#ffffff', stroke: '#2b4a6f', prefix: 'PC' },
  laptop: { group: 'net', vi: 'Laptop', en: 'Laptop', w: 64, h: 46, fill: '#ffffff', stroke: '#2b4a6f', prefix: 'LT' },
  phone: { group: 'net', vi: 'Điện thoại IP', en: 'IP phone', w: 44, h: 52, fill: '#ffffff', stroke: '#6c4bb6', prefix: 'IPP' },
  ap: { group: 'net', vi: 'Access Point', en: 'Access point', w: 56, h: 48, fill: '#fff6e8', stroke: '#e67e22', prefix: 'AP' },
  wlc: { group: 'net', vi: 'WLC', en: 'WLC', w: 72, h: 40, fill: '#fff6e8', stroke: '#c0661a', prefix: 'WLC' },
  printer: { group: 'net', vi: 'Máy in', en: 'Printer', w: 56, h: 48, fill: '#ffffff', stroke: '#5b6573', prefix: 'PRN' },
  cloud: { group: 'net', vi: 'Internet / Cloud', en: 'Internet / cloud', w: 110, h: 64, fill: '#eef5ff', stroke: '#6b8fc7', prefix: 'INTERNET' },
  rect: { group: 'basic', vi: 'Chữ nhật', en: 'Rectangle', w: 140, h: 70, fill: '#ffffff', stroke: '#2b4a6f' },
  round: { group: 'basic', vi: 'Bo góc', en: 'Rounded', w: 140, h: 70, fill: '#ffffff', stroke: '#2b4a6f' },
  ellipse: { group: 'basic', vi: 'Elip', en: 'Ellipse', w: 120, h: 80, fill: '#ffffff', stroke: '#2b4a6f' },
  text: { group: 'basic', vi: 'Chữ', en: 'Text', w: 120, h: 30, fill: 'none', stroke: 'none' },
  zone: { group: 'basic', vi: 'Vùng / khung', en: 'Zone', w: 320, h: 200, fill: '#2f6fde', stroke: '#2f6fde' },
  note: { group: 'basic', vi: 'Ghi chú', en: 'Note', w: 150, h: 80, fill: '#fff8c5', stroke: '#d4b106' },
};
export const isDevice = (s) => SHAPES[s.t]?.group === 'net';

// ---------------------------------------------------------------- tạo sơ đồ / hình / dây
export const emptyDiagram = () => ({ format: FORMAT, version: 1, shapes: [], edges: [], seq: 0 });
const snap = (v, on = true) => (on ? Math.round(v / GRID) * GRID : v);
const nextId = (d, p) => { d.seq = (d.seq || 0) + 1; return p + d.seq; };
/** Tên thiết bị không trùng theo tiền tố: R1, R2… (đám mây: INTERNET, INTERNET2…). */
export function uniqueLabel(d, prefix) {
  const used = new Set(d.shapes.map((s) => s.label));
  for (let i = 1; ; i++) { const n = prefix + (prefix === 'INTERNET' && i === 1 ? '' : i); if (!used.has(n)) return n; }
}

/** Thêm hình loại t tại (x, y) (góc trên trái). Thiết bị được đặt tên không trùng theo tiền tố (R1, SW2…). Trả hình. */
export function addShape(d, t, x, y, o = {}) {
  const S = SHAPES[t];
  if (!S) throw new Error('Loại hình không hợp lệ: ' + t);
  const label = o.label ?? (S.prefix ? uniqueLabel(d, S.prefix) : t === 'text' ? 'Văn bản' : t === 'zone' ? 'Vùng' : t === 'note' ? 'Ghi chú' : '');
  const sh = { id: nextId(d, 's'), t, x: snap(x), y: snap(y), w: o.w ?? S.w, h: o.h ?? S.h, label, sub: o.sub ?? '', fill: o.fill ?? S.fill, stroke: o.stroke ?? S.stroke, sw: o.sw ?? 2, dash: o.dash ?? (t === 'zone' ? 'dash' : 'solid'), color: o.color ?? '#1f2933', fs: o.fs ?? (t === 'zone' ? 14 : 12), bold: o.bold ?? t !== 'note', italic: !!o.italic };
  d.shapes.push(sh);
  return sh;
}
/** Nối 2 hình. Trả dây, hoặc null nếu trùng / nối chính nó. */
export function addEdge(d, a, b, o = {}) {
  if (a === b || !shapeOf(d, a) || !shapeOf(d, b)) return null;
  const e = { id: nextId(d, 'e'), a, b, style: o.style || 'straight', dash: o.dash || 'solid', color: o.color || '#4a6785', width: o.width || 2, arrowA: !!o.arrowA, arrowB: !!o.arrowB, label: o.label || '', la: o.la || '', lb: o.lb || '' };
  d.edges.push(e);
  return e;
}
export const shapeOf = (d, id) => d.shapes.find((s) => s.id === id) || null;
export const edgeOf = (d, id) => d.edges.find((e) => e.id === id) || null;
export function update(d, id, patch) {
  const o = shapeOf(d, id) || edgeOf(d, id);
  if (!o) return false;
  for (const [k, v] of Object.entries(patch)) if (!['id', 't', 'a', 'b'].includes(k)) o[k] = v;
  if (o.w != null) { o.w = Math.max(20, o.w); o.h = Math.max(16, o.h); }
  return true;
}
/** Xoá hình/dây theo danh sách id (xoá hình thì xoá luôn dây nối với nó). Hình đang khoá không bị xoá. */
export function remove(d, ids) {
  const set = new Set(ids.filter((id) => !shapeOf(d, id)?.locked));
  d.shapes = d.shapes.filter((s) => !set.has(s.id));
  d.edges = d.edges.filter((e) => !set.has(e.id) && !set.has(e.a) && !set.has(e.b));
}
/** Dời các hình (bỏ qua hình đang khoá). */
export function move(d, ids, dx, dy) { for (const s of d.shapes) if (ids.includes(s.id) && !s.locked) { s.x += dx; s.y += dy; } }
/** Mở rộng vùng chọn: chọn 1 hình trong nhóm = chọn cả nhóm (như draw.io). */
export function expandGroups(d, ids) {
  const gs = new Set(d.shapes.filter((s) => ids.includes(s.id) && s.g).map((s) => s.g));
  return [...new Set([...ids, ...d.shapes.filter((s) => s.g && gs.has(s.g)).map((s) => s.id)])];
}
/** Nhóm các hình (≥ 2) — trả id nhóm; bỏ nhóm thì xoá trường g. */
export function group(d, ids) {
  const ss = d.shapes.filter((s) => ids.includes(s.id));
  if (ss.length < 2) return null;
  const g = nextId(d, 'g');
  for (const s of ss) s.g = g;
  return g;
}
export function ungroup(d, ids) { for (const s of d.shapes) if (ids.includes(s.id)) delete s.g; }
/** Nhân bản các hình (và dây nằm giữa chúng), lệch (dx, dy). Trả id các hình mới. */
export function duplicate(d, ids, dx = 20, dy = 20) {
  const map = {};
  for (const s of d.shapes.filter((x) => ids.includes(x.id))) {
    const c = JSON.parse(JSON.stringify(s));
    c.id = nextId(d, 's'); c.x += dx; c.y += dy; delete c.locked;
    if (SHAPES[c.t].prefix && c.label.startsWith(SHAPES[c.t].prefix)) c.label = uniqueLabel(d, SHAPES[c.t].prefix);
    map[s.id] = c.id;
    d.shapes.push(c);
  }
  for (const e of d.edges.filter((x) => map[x.a] && map[x.b])) d.edges.push({ ...JSON.parse(JSON.stringify(e)), id: nextId(d, 'e'), a: map[e.a], b: map[e.b] });
  // nhóm được nhân bản thành nhóm MỚI
  const gmap = {};
  for (const id of Object.values(map)) { const c = shapeOf(d, id); if (c.g) c.g = gmap[c.g] ||= nextId(d, 'g'); }
  return Object.values(map);
}
/** Bản sao vùng chọn để dán (Ctrl+C / Ctrl+X): các hình + dây nằm giữa chúng. */
export function copyOf(d, ids) {
  const shapes = d.shapes.filter((s) => ids.includes(s.id));
  const set = new Set(shapes.map((s) => s.id));
  return JSON.parse(JSON.stringify({ shapes, edges: d.edges.filter((e) => set.has(e.a) && set.has(e.b)) }));
}
/** Dán bản sao (lệch dx, dy) với id mới, tên thiết bị mới, nhóm mới. Trả id các hình đã dán. */
export function paste(d, clip, dx = 20, dy = 20) {
  const map = {}, gmap = {};
  for (const s of clip?.shapes || []) {
    if (!SHAPES[s.t]) continue;
    const c = { ...JSON.parse(JSON.stringify(s)), id: nextId(d, 's'), x: s.x + dx, y: s.y + dy };
    delete c.locked;
    if (SHAPES[c.t].prefix && d.shapes.some((x) => x.label === c.label)) c.label = uniqueLabel(d, SHAPES[c.t].prefix);
    if (c.g) c.g = gmap[c.g] ||= nextId(d, 'g');
    map[s.id] = c.id;
    d.shapes.push(c);
  }
  for (const e of clip?.edges || []) if (map[e.a] && map[e.b]) d.edges.push({ ...JSON.parse(JSON.stringify(e)), id: nextId(d, 'e'), a: map[e.a], b: map[e.b] });
  return Object.values(map);
}
/** Đưa lên trên cùng / xuống dưới cùng (thứ tự vẽ = thứ tự mảng). */
export function zOrder(d, ids, front) {
  const sel = d.shapes.filter((s) => ids.includes(s.id)), rest = d.shapes.filter((s) => !ids.includes(s.id));
  d.shapes = front ? [...rest, ...sel] : [...sel, ...rest];
}
/** Căn lề: left | center | right | top | middle | bottom (theo khung bao của vùng chọn). */
export function align(d, ids, how) {
  const ss = d.shapes.filter((s) => ids.includes(s.id));
  if (ss.length < 2) return;
  const x0 = Math.min(...ss.map((s) => s.x)), x1 = Math.max(...ss.map((s) => s.x + s.w)), y0 = Math.min(...ss.map((s) => s.y)), y1 = Math.max(...ss.map((s) => s.y + s.h));
  for (const s of ss) {
    if (how === 'left') s.x = x0; else if (how === 'right') s.x = x1 - s.w; else if (how === 'center') s.x = Math.round((x0 + x1) / 2 - s.w / 2);
    else if (how === 'top') s.y = y0; else if (how === 'bottom') s.y = y1 - s.h; else if (how === 'middle') s.y = Math.round((y0 + y1) / 2 - s.h / 2);
  }
}
/** Dàn đều khoảng cách giữa các hình theo chiều ngang (h) hoặc dọc (v). */
export function distribute(d, ids, axis) {
  const ss = d.shapes.filter((s) => ids.includes(s.id));
  if (ss.length < 3) return;
  const k = axis === 'h' ? 'x' : 'y', sz = axis === 'h' ? 'w' : 'h';
  ss.sort((a, b) => a[k] - b[k]);
  const span = ss.at(-1)[k] + ss.at(-1)[sz] - ss[0][k];
  const gap = (span - ss.reduce((t, s) => t + s[sz], 0)) / (ss.length - 1);
  let pos = ss[0][k];
  for (const s of ss) { s[k] = Math.round(pos); pos += s[sz] + gap; }
}
/** Hình có giao với khung chọn (quét chuột) — trả id. */
export function inRect(d, r) {
  const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1), y0 = Math.min(r.y0, r.y1), y1 = Math.max(r.y0, r.y1);
  return d.shapes.filter((s) => s.x >= x0 && s.y >= y0 && s.x + s.w <= x1 && s.y + s.h <= y1).map((s) => s.id);
}

// ---------------------------------------------------------------- hoàn tác
export function createHistory(limit = 80) {
  const undo = [], redo = [];
  const snapS = (d) => JSON.stringify({ shapes: d.shapes, edges: d.edges, seq: d.seq });
  const restore = (d, s) => Object.assign(d, JSON.parse(s));
  return {
    snapshot: snapS,
    commit(d, before) { if (snapS(d) === before) return false; undo.push(before); if (undo.length > limit) undo.shift(); redo.length = 0; return true; },
    track(d, fn) { const b = snapS(d); const r = fn(); this.commit(d, b); return r; },
    undo(d) { if (!undo.length) return false; redo.push(snapS(d)); restore(d, undo.pop()); return true; },
    redo(d) { if (!redo.length) return false; undo.push(snapS(d)); restore(d, redo.pop()); return true; },
    get canUndo() { return undo.length > 0; },
    get canRedo() { return redo.length > 0; },
  };
}

// ---------------------------------------------------------------- hình học dây nối
const center = (s) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
/** Khung dùng để đặt đầu dây: thiết bị tính cả phần chữ bên dưới icon để dây không đè lên tên / IP. */
export function wireBox(s) {
  if (!isDevice(s)) return s;
  const extra = (s.label ? s.fs + 6 : 0) + (s.sub ? s.fs + 4 : 0);
  return { ...s, h: s.h + extra };
}
/** Điểm trên mép khung hình s theo hướng tới (tx, ty). */
export function edgePoint(s, tx, ty) {
  const c = center(s), dx = tx - c.x, dy = ty - c.y;
  if (!dx && !dy) return c;
  if (s.t === 'ellipse' || s.t === 'cloud') { const a = s.w / 2, b = s.h / 2, k = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b)); return { x: c.x + dx * k, y: c.y + dy * k }; }
  const k = Math.min(Math.abs(dx) > 0 ? s.w / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 0 ? s.h / 2 / Math.abs(dy) : Infinity);
  return { x: c.x + dx * k, y: c.y + dy * k };
}
/** Đường đi của dây: { d (path SVG), pts (điểm đầu/cuối), mid (điểm đặt nhãn), ang (góc cuối để vẽ mũi tên) }. */
export function edgePath(d, e) {
  const A0 = shapeOf(d, e.a), B0 = shapeOf(d, e.b);
  if (!A0 || !B0) return null;
  const A = wireBox(A0), B = wireBox(B0);
  const ca = center(A), cb = center(B);
  if (e.style === 'ortho') {
    // gấp khúc 1 lần: đi theo trục chênh lệch lớn hơn trước
    const horiz = Math.abs(cb.x - ca.x) >= Math.abs(cb.y - ca.y);
    const p1 = horiz ? { x: cb.x > ca.x ? A.x + A.w : A.x, y: ca.y } : { x: ca.x, y: cb.y > ca.y ? A.y + A.h : A.y };
    const p2 = horiz ? { x: cb.x, y: cb.y > ca.y ? B.y : B.y + B.h } : { x: cb.x > ca.x ? B.x : B.x + B.w, y: cb.y };
    const k = horiz ? { x: cb.x, y: ca.y } : { x: ca.x, y: cb.y };
    if ((horiz && Math.abs(cb.y - ca.y) < 1) || (!horiz && Math.abs(cb.x - ca.x) < 1)) {
      const q = edgePoint(B, ca.x, ca.y);
      return { d: `M${p1.x} ${p1.y}L${q.x} ${q.y}`, a: p1, b: q, mid: { x: (p1.x + q.x) / 2, y: (p1.y + q.y) / 2 }, ang: Math.atan2(q.y - p1.y, q.x - p1.x), ang0: Math.atan2(p1.y - q.y, p1.x - q.x) };
    }
    return { d: `M${p1.x} ${p1.y}L${k.x} ${k.y}L${p2.x} ${p2.y}`, a: p1, b: p2, mid: k, ang: Math.atan2(p2.y - k.y, p2.x - k.x), ang0: Math.atan2(p1.y - k.y, p1.x - k.x) };
  }
  const pa = edgePoint(A, cb.x, cb.y), pb = edgePoint(B, ca.x, ca.y);
  if (e.style === 'curve') {
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2, nx = -(pb.y - pa.y) * 0.25, ny = (pb.x - pa.x) * 0.25;
    const cx = mx + nx, cy = my + ny;
    return { d: `M${pa.x} ${pa.y}Q${cx} ${cy} ${pb.x} ${pb.y}`, a: pa, b: pb, mid: { x: (pa.x + 2 * cx + pb.x) / 4, y: (pa.y + 2 * cy + pb.y) / 4 }, ang: Math.atan2(pb.y - cy, pb.x - cx), ang0: Math.atan2(pa.y - cy, pa.x - cx) };
  }
  return { d: `M${pa.x} ${pa.y}L${pb.x} ${pb.y}`, a: pa, b: pb, mid: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, ang: Math.atan2(pb.y - pa.y, pb.x - pa.x), ang0: Math.atan2(pa.y - pb.y, pa.x - pb.x) };
}

// ---------------------------------------------------------------- vẽ (chuỗi SVG)
const r1 = (n) => Math.round(n * 10) / 10;
/** Biểu tượng thiết bị vẽ trong khung (x, y, w, h). Tự vẽ — không dùng icon của hãng. */
function icon(s) {
  const { x, y, w, h } = s, cx = x + w / 2, cy = y + h / 2, f = esc(s.fill), st = esc(s.stroke);
  const box = (rx = 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" stroke="${st}" stroke-width="2"/>`;
  switch (s.t) {
    case 'router': return `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${f}" stroke="${st}" stroke-width="2"/>` +
      `<path d="M${cx - w * 0.28} ${cy - h * 0.18}l${w * 0.16} ${h * 0.12}M${cx + w * 0.28} ${cy - h * 0.18}l${-w * 0.16} ${h * 0.12}M${cx - w * 0.28} ${cy + h * 0.18}l${w * 0.16} ${-h * 0.12}M${cx + w * 0.28} ${cy + h * 0.18}l${-w * 0.16} ${-h * 0.12}" stroke="${st}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'switch': case 'l3switch': return box(4) +
      `<path d="M${x + w * 0.22} ${cy - h * 0.14}h${w * 0.5}m-${w * 0.1} -${h * 0.1}l${w * 0.1} ${h * 0.1}l-${w * 0.1} ${h * 0.1}M${x + w * 0.78} ${cy + h * 0.14}h-${w * 0.5}m${w * 0.1} -${h * 0.1}l-${w * 0.1} ${h * 0.1}l${w * 0.1} ${h * 0.1}" fill="none" stroke="${st}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      (s.t === 'l3switch' ? `<text x="${x + w - 5}" y="${y + 11}" text-anchor="end" font-size="9" font-weight="700" fill="${st}">L3</text>` : '');
    case 'firewall': {
      let b = box(3);
      for (let i = 1; i < 4; i++) b += `<line x1="${x}" y1="${r1(y + (h * i) / 4)}" x2="${x + w}" y2="${r1(y + (h * i) / 4)}" stroke="${st}" stroke-width="1.4"/>`;
      for (let i = 0; i < 4; i++) { const xx = r1(x + (w * (i % 2 ? 0.66 : 0.33))); b += `<line x1="${xx}" y1="${r1(y + (h * i) / 4)}" x2="${xx}" y2="${r1(y + (h * (i + 1)) / 4)}" stroke="${st}" stroke-width="1.4"/>`; }
      return b;
    }
    case 'server': return box(4) + [0.22, 0.45, 0.68].map((k) => `<line x1="${x + 6}" y1="${r1(y + h * k)}" x2="${x + w - 6}" y2="${r1(y + h * k)}" stroke="${st}" stroke-width="1.6"/><circle cx="${x + w - 10}" cy="${r1(y + h * k - 4)}" r="1.8" fill="${st}"/>`).join('');
    case 'pc': return `<rect x="${x + 4}" y="${y}" width="${w - 8}" height="${h * 0.7}" rx="4" fill="${f}" stroke="${st}" stroke-width="2"/><rect x="${x + 10}" y="${y + 6}" width="${w - 20}" height="${r1(h * 0.7 - 12)}" fill="${st}" opacity="0.12"/><path d="M${cx} ${r1(y + h * 0.7)}v${r1(h * 0.16)}M${cx - w * 0.22} ${y + h - 2}h${w * 0.44}" stroke="${st}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'laptop': return `<rect x="${x + w * 0.12}" y="${y}" width="${w * 0.76}" height="${h * 0.68}" rx="3" fill="${f}" stroke="${st}" stroke-width="2"/><path d="M${x} ${y + h - 3}h${w}l-${w * 0.08} -${h * 0.22}h-${w * 0.84}z" fill="${f}" stroke="${st}" stroke-width="2" stroke-linejoin="round"/>`;
    case 'phone': return box(8) + `<rect x="${x + 8}" y="${y + 7}" width="${w - 16}" height="${r1(h * 0.3)}" fill="${st}" opacity="0.15"/>` + [0, 1, 2].map((r) => [0, 1, 2].map((c) => `<circle cx="${r1(x + w * (0.3 + c * 0.2))}" cy="${r1(y + h * (0.55 + r * 0.14))}" r="2" fill="${st}"/>`).join('')).join('');
    case 'ap': return `<circle cx="${cx}" cy="${y + h * 0.72}" r="4" fill="${st}"/>` + [0.22, 0.36, 0.5].map((k) => `<path d="M${r1(cx - w * k)} ${r1(y + h * 0.72 - w * k * 0.55)}A${r1(w * k)} ${r1(w * k)} 0 0 1 ${r1(cx + w * k)} ${r1(y + h * 0.72 - w * k * 0.55)}" fill="none" stroke="${st}" stroke-width="2.2" stroke-linecap="round"/>`).join('') + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/>`;
    case 'wlc': return box(4) + `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${st}">WLC</text>`;
    case 'printer': return `<rect x="${x + w * 0.2}" y="${y}" width="${w * 0.6}" height="${h * 0.3}" fill="#fff" stroke="${st}" stroke-width="1.6"/><rect x="${x}" y="${y + h * 0.28}" width="${w}" height="${h * 0.45}" rx="5" fill="${f}" stroke="${st}" stroke-width="2"/><rect x="${x + w * 0.2}" y="${y + h * 0.62}" width="${w * 0.6}" height="${h * 0.36}" fill="#fff" stroke="${st}" stroke-width="1.6"/>`;
    case 'cloud': return `<path d="M${r1(x + w * 0.25)} ${y + h * 0.85}h${w * 0.55}a${w * 0.17} ${h * 0.26} 0 0 0 0-${h * 0.52}a${w * 0.22} ${h * 0.32} 0 0 0-${w * 0.38}-${h * 0.14}a${w * 0.17} ${h * 0.26} 0 0 0-${w * 0.17} ${h * 0.66}z" fill="${f}" stroke="${st}" stroke-width="2" stroke-linejoin="round"/>`;
    default: return '';
  }
}
/** SVG của 1 hình (nhóm <g>). */
export function shapeSvg(s) {
  const S = SHAPES[s.t];
  const fw = s.bold === false ? 400 : null, fst = s.italic ? ' font-style="italic"' : '';
  const lab = (txt, tx, ty, anchor = 'middle', fs = s.fs, weight = 700, fill = s.color) => (txt ? String(txt).split('\n').map((ln, i) => `<text x="${r1(tx)}" y="${r1(ty + i * (fs + 3))}" text-anchor="${anchor}" font-size="${fs}" font-weight="${fw ?? weight}"${fst} fill="${esc(fill)}">${esc(ln)}</text>`).join('') : '');
  const stroke = `stroke="${esc(s.stroke)}" stroke-width="${s.sw ?? 2}"${DASH[s.dash] ? ` stroke-dasharray="${DASH[s.dash]}"` : ''}`;
  let body;
  if (S.group === 'net') {
    body = icon(s) + lab(s.label, s.x + s.w / 2, s.y + s.h + s.fs + 3) + lab(s.sub, s.x + s.w / 2, s.y + s.h + s.fs * 2 + 7, 'middle', s.fs - 2, 400, '#5b6573');
  } else if (s.t === 'zone') {
    body = `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="12" fill="${esc(s.fill)}" fill-opacity="0.06" ${stroke}/>` + lab(s.label, s.x + 12, s.y + s.fs + 8, 'start', s.fs, 700, s.stroke);
  } else if (s.t === 'text') {
    body = lab(s.label, s.x + s.w / 2, s.y + s.h / 2 + s.fs / 3, 'middle', s.fs, 600);
  } else {
    const shape = s.t === 'ellipse' ? `<ellipse cx="${s.x + s.w / 2}" cy="${s.y + s.h / 2}" rx="${s.w / 2}" ry="${s.h / 2}"` : s.t === 'note' ? `<path d="M${s.x} ${s.y}h${s.w - 14}l14 14v${s.h - 14}h-${s.w}z"` : `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.t === 'round' ? 14 : 2}"`;
    const lines = String(s.label || '').split('\n').length;
    body = `${shape} fill="${esc(s.fill)}" ${stroke}/>` + lab(s.label, s.x + s.w / 2, s.y + s.h / 2 - ((lines - 1) * (s.fs + 3)) / 2 + s.fs / 3, 'middle', s.fs, 600);
  }
  return `<g data-id="${s.id}" class="dg-shape"${s.op != null && s.op < 1 ? ` opacity="${s.op}"` : ''}>${body}</g>`;
}
/** SVG của 1 dây: đường, vùng bấm rộng, mũi tên, nhãn giữa, nhãn cổng 2 đầu. */
export function edgeSvg(d, e) {
  const p = edgePath(d, e);
  if (!p) return '';
  const col = esc(e.color);
  const arrow = (pt, ang) => { const a = 11, b = 5.5, c = Math.cos(ang), s = Math.sin(ang); return `<path d="M${r1(pt.x)} ${r1(pt.y)}L${r1(pt.x - a * c + b * s)} ${r1(pt.y - a * s - b * c)}L${r1(pt.x - a * c - b * s)} ${r1(pt.y - a * s + b * c)}Z" fill="${col}"/>`; };
  const tag = (txt, x, y, bold) => { if (!txt) return ''; const w = String(txt).length * 6.4 + 8; return `<rect x="${r1(x - w / 2)}" y="${r1(y - 8)}" width="${r1(w)}" height="15" rx="3" fill="#ffffff" fill-opacity="0.92" stroke="${col}" stroke-width="0.6"/><text x="${r1(x)}" y="${r1(y + 3.5)}" text-anchor="middle" font-size="10.5" font-weight="${bold ? 700 : 400}" fill="#1f2933">${esc(txt)}</text>`; };
  // nhãn cổng đặt cách đầu dây ~28px (dây ngắn thì 30% chiều dài) theo hướng đi của dây
  const toward = (from, to) => { const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1, k = Math.min(28, len * 0.3) / len; return { x: from.x + dx * k, y: from.y + dy * k }; };
  const nearA = toward(p.a, e.style === 'straight' ? p.b : p.mid), nearB = toward(p.b, e.style === 'straight' ? p.a : p.mid);
  return `<g data-id="${e.id}" class="dg-edge"><path d="${p.d}" fill="none" stroke="transparent" stroke-width="14" class="dg-hit"/>` +
    `<path d="${p.d}" fill="none" stroke="${col}" stroke-width="${e.width}"${DASH[e.dash] ? ` stroke-dasharray="${DASH[e.dash]}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>` +
    (e.arrowB ? arrow(p.b, p.ang) : '') + (e.arrowA ? arrow(p.a, p.ang0) : '') + tag(e.la, nearA.x, nearA.y) + tag(e.lb, nearB.x, nearB.y) + tag(e.label, p.mid.x, p.mid.y, true) + '</g>';
}
/** Khung bao toàn sơ đồ (kể cả chữ dưới thiết bị). */
export function bounds(d, pad = 30) {
  if (!d.shapes.length) return { x: 0, y: 0, w: 800, h: 500 };
  const x0 = Math.min(...d.shapes.map((s) => s.x)) - pad, y0 = Math.min(...d.shapes.map((s) => s.y)) - pad;
  const x1 = Math.max(...d.shapes.map((s) => s.x + s.w)) + pad, y1 = Math.max(...d.shapes.map((s) => s.y + s.h + (isDevice(s) ? s.fs * 2 + 12 : 0))) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** File SVG hoàn chỉnh (vùng/khung vẽ dưới cùng, rồi dây, rồi hình khác) — dùng cho tải về và chuyển PNG. */
export function toSvg(d, o = {}) {
  const b = bounds(d);
  const zones = d.shapes.filter((s) => s.t === 'zone'), rest = d.shapes.filter((s) => s.t !== 'zone');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(b.w)}" height="${Math.ceil(b.h)}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" font-family="Segoe UI, Arial, sans-serif">` +
    (o.background === false ? '' : `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#ffffff"/>`) +
    zones.map(shapeSvg).join('') + d.edges.map((e) => edgeSvg(d, e)).join('') + rest.map(shapeSvg).join('') + '</svg>';
}

// ---------------------------------------------------------------- nhập / xuất
export function exportJson(d) { return JSON.stringify({ format: FORMAT, version: 1, shapes: d.shapes, edges: d.edges, seq: d.seq }, null, 1); }
/** Đọc JSON đã xuất; ném lỗi tiếng Việt nếu sai định dạng. Bỏ dây trỏ tới hình không tồn tại. */
export function importJson(text) {
  const o = typeof text === 'string' ? JSON.parse(text) : text;
  if (!o || o.format !== FORMAT || !Array.isArray(o.shapes) || !Array.isArray(o.edges)) throw new Error('File không phải sơ đồ Packet Journey');
  const shapes = o.shapes.filter((s) => s && SHAPES[s.t] && typeof s.id === 'string' && [s.x, s.y, s.w, s.h].every(Number.isFinite));
  const ids = new Set(shapes.map((s) => s.id));
  const edges = o.edges.filter((e) => e && ids.has(e.a) && ids.has(e.b) && e.a !== e.b);
  const maxSeq = Math.max(0, ...[...shapes, ...edges].map((x) => +String(x.id).slice(1) || 0));
  return { format: FORMAT, version: 1, shapes, edges, seq: Math.max(o.seq || 0, maxSeq) };
}
// ---------------------------------------------------------------- mẫu
const T = (build) => () => { const d = emptyDiagram(); build(d); return d; };
const link = (d, a, b, o) => addEdge(d, a.id, b.id, o);
export const TEMPLATES = [
  { id: 'lan', vi: 'LAN văn phòng', en: 'Office LAN', build: T((d) => {
    const z = addShape(d, 'zone', 60, 40, { w: 560, h: 420, label: 'VĂN PHÒNG — 192.168.1.0/24' });
    const r = addShape(d, 'router', 300, 80, { sub: '192.168.1.1' }), s = addShape(d, 'switch', 296, 230);
    const p = [addShape(d, 'pc', 110, 360, { sub: '192.168.1.10' }), addShape(d, 'laptop', 230, 365, { sub: '192.168.1.11' }), addShape(d, 'printer', 370, 365, { sub: '192.168.1.50' }), addShape(d, 'phone', 500, 360, { sub: 'Voice VLAN' })];
    const c = addShape(d, 'cloud', 650, 60, { label: 'INTERNET' });
    link(d, c, r, { la: '', lb: 'G0/1', style: 'straight', dash: 'dash' });
    link(d, r, s, { la: 'G0/0', lb: 'G0/1' });
    p.forEach((x, i) => link(d, s, x, { la: `Fa0/${i + 1}` }));
    void z;
  }) },
  { id: 'campus', vi: 'Campus 3 lớp', en: 'Three-tier campus', build: T((d) => {
    addShape(d, 'zone', 40, 20, { w: 760, h: 110, label: 'CORE', stroke: '#d64545', fill: '#d64545' });
    addShape(d, 'zone', 40, 150, { w: 760, h: 110, label: 'DISTRIBUTION', stroke: '#e67e22', fill: '#e67e22' });
    addShape(d, 'zone', 40, 280, { w: 760, h: 210, label: 'ACCESS', stroke: '#2e9e57', fill: '#2e9e57' });
    const c1 = addShape(d, 'l3switch', 260, 45), c2 = addShape(d, 'l3switch', 520, 45);
    const d1 = addShape(d, 'l3switch', 180, 175), d2 = addShape(d, 'l3switch', 600, 175);
    const a = [addShape(d, 'switch', 90, 305), addShape(d, 'switch', 300, 305), addShape(d, 'switch', 520, 305), addShape(d, 'switch', 690, 305)];
    link(d, c1, c2, { label: 'Po1', width: 4 });
    for (const x of [c1, c2]) for (const y of [d1, d2]) link(d, x, y);
    for (const [i, x] of a.entries()) { link(d, i < 2 ? d1 : d2, x); link(d, i < 2 ? d2 : d1, x, { dash: 'dash' }); }
    a.forEach((x, i) => link(d, x, addShape(d, i % 2 ? 'laptop' : 'pc', x.x + 4, 410, { label: `VLAN ${10 * (i + 1)}` })));
  }) },
  { id: 'wan', vi: 'HQ – chi nhánh qua WAN', en: 'HQ – branch over WAN', build: T((d) => {
    addShape(d, 'zone', 30, 60, { w: 300, h: 320, label: 'HQ — 10.1.0.0/16' });
    addShape(d, 'zone', 620, 60, { w: 260, h: 320, label: 'CHI NHÁNH — 10.2.0.0/16', stroke: '#2e9e57', fill: '#2e9e57' });
    const fw = addShape(d, 'firewall', 220, 110), r1x = addShape(d, 'router', 640, 110, { label: 'R-CN' });
    const core = addShape(d, 'l3switch', 70, 200), srv = addShape(d, 'server', 90, 300, { label: 'SRV-AD' });
    const sw = addShape(d, 'switch', 650, 220), pc = addShape(d, 'pc', 660, 300);
    const net = addShape(d, 'cloud', 400, 90, { label: 'INTERNET / MPLS' });
    link(d, fw, net, { label: 'IPsec VPN', dash: 'dash', color: '#d64545', style: 'curve' });
    link(d, net, r1x, { dash: 'dash', color: '#d64545', style: 'curve' });
    link(d, core, fw, { style: 'ortho', la: 'G0/1', lb: 'inside' });
    link(d, core, srv);
    link(d, r1x, sw, { la: 'G0/0', lb: 'G0/1' });
    link(d, sw, pc, { la: 'Fa0/1' });
  }) },
];
