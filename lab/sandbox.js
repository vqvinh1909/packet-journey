// lab/sandbox.js — chế độ "🧱 Tự dựng mạng riêng": thêm/xoá thiết bị, nối/gỡ dây, xuất/nhập
// JSON và vài nhiệm vụ hướng dẫn chấm tự động trên mạng bất kỳ. Phần giao diện ở ui/lab.js.

import * as N from './net.js';
import { fa } from './kit.js';

/** Loại thiết bị được thêm: nhãn nút, tiền tố tên, hàm tạo. */
export const SANDBOX_KINDS = {
  pc: { label: '🖥 PC', prefix: 'PC', make: (id, name, x, y) => N.pc(id, name, x, y) },
  server: { label: '🗄 Server', prefix: 'SRV', make: (id, name, x, y) => N.server(id, name, x, y) },
  sw2960: { label: '⇄ Switch 2960', prefix: 'SW', make: (id, name, x, y) => N.sw(id, name, x, y, fa(24, ['g0/1', 'g0/2'])) },
  sw3560: { label: '⇶ Switch L3 3560', prefix: 'L3SW', make: (id, name, x, y) => { const d = N.sw(id, name, x, y, fa(24, ['g0/1', 'g0/2'])); d.model = '3560'; return d; } },
  router: { label: '⛁ Router', prefix: 'R', make: (id, name, x, y) => N.router(id, name, x, y, ['g0/0', 'g0/1', 'g0/2', 's0/0/0', 's0/0/1']) },
};
const TYPES = ['pc', 'server', 'switch', 'router'];
export const SANDBOX_VIEW = { w: 1000, h: 440 };

export function emptySandbox() { return N.makeNet([], []); }

/** Thêm thiết bị loại `kind` tại (x, y) — tự đặt id/tên không trùng. Trả id. */
export function addDevice(net, kind, x, y) {
  const k = SANDBOX_KINDS[kind];
  if (!k) throw new Error('Loại thiết bị không hợp lệ: ' + kind);
  let i = 1;
  const names = new Set(Object.values(net.devices).map((d) => d.name.toUpperCase()));
  while (net.devices[k.prefix.toLowerCase() + i] || names.has(k.prefix + i)) i++;
  const id = k.prefix.toLowerCase() + i;
  net.devices[id] = k.make(id, k.prefix + i, clamp(x, 40, SANDBOX_VIEW.w - 40), clamp(y, 40, SANDBOX_VIEW.h - 50));
  return id;
}
/** Vị trí trống gợi ý cho thiết bị mới (lưới, tránh chồng lên thiết bị có sẵn). */
export function freeSpot(net) {
  const ds = Object.values(net.devices);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 90 + col * 115, y = 70 + row * 85;
      if (ds.every((d) => Math.hypot(d.x - x, d.y - y) > 70)) return { x, y };
    }
  }
  return { x: 500, y: 220 };
}
export function moveDevice(net, id, x, y) {
  const d = net.devices[id];
  if (!d) return;
  d.x = Math.round(clamp(x, 40, SANDBOX_VIEW.w - 40));
  d.y = Math.round(clamp(y, 40, SANDBOX_VIEW.h - 50));
}
export function removeDevice(net, id) {
  delete net.devices[id];
  net.links = net.links.filter((l) => l.a !== id && l.b !== id);
}

/** Cổng vật lý của thiết bị (không tính port-channel / subinterface / loopback / tunnel). */
export function physPorts(d) {
  if (!d) return [];
  if (d.type === 'pc' || d.type === 'server') return ['fa0'];
  const all = Object.keys(d.type === 'switch' ? d.ports : d.ifaces);
  return all.filter((p) => !/^(po|lo|tu)/.test(p) && !p.includes('.')).sort(N.ifSort);
}
export function freePorts(net, id) { return physPorts(net.devices[id]).filter((p) => !N.linkAt(net, id, p)); }

/** Nối dây a:ap ↔ b:bp. Trả null nếu thành công, hoặc chuỗi lỗi. */
export function connect(net, a, ap, b, bp) {
  if (!net.devices[a] || !net.devices[b]) return 'Thiết bị không tồn tại';
  if (a === b) return 'Không nối một thiết bị với chính nó';
  if (!physPorts(net.devices[a]).includes(ap) || !physPorts(net.devices[b]).includes(bp)) return 'Cổng không tồn tại';
  if (N.linkAt(net, a, ap)) return `${net.devices[a].name} ${N.shortIf(ap)} đã có dây`;
  if (N.linkAt(net, b, bp)) return `${net.devices[b].name} ${N.shortIf(bp)} đã có dây`;
  if (ap.startsWith('s') !== bp.startsWith('s')) return 'Cổng Serial chỉ nối được với cổng Serial';
  net.links.push(N.mkLink(a, ap, b, bp));
  return null;
}
export function disconnect(net, linkId) { net.links = net.links.filter((l) => l.id !== linkId); }

// ---------------------------------------------------------------- xuất / nhập JSON
export const SANDBOX_FORMAT = 'packet-journey-sandbox';
export function exportSandbox(net) { return { format: SANDBOX_FORMAT, version: 1, net: N.cloneNet(net) }; }
/** Đọc lại file đã xuất (hoặc object net trần). Ném lỗi tiếng Việt nếu sai định dạng. */
export function importSandbox(obj) {
  const net = obj?.format === SANDBOX_FORMAT ? obj.net : obj;
  if (!net || typeof net.devices !== 'object' || !Array.isArray(net.links)) throw new Error('File không phải mạng Packet Journey (thiếu devices/links)');
  for (const [id, d] of Object.entries(net.devices)) {
    if (!d || d.id !== id || !TYPES.includes(d.type) || typeof d.name !== 'string') throw new Error(`Thiết bị "${id}" không hợp lệ`);
    if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) throw new Error(`Thiết bị "${id}" thiếu toạ độ`);
    if (d.type === 'switch' && typeof d.ports !== 'object') throw new Error(`Switch "${id}" thiếu danh sách cổng`);
    if (d.type === 'router' && typeof d.ifaces !== 'object') throw new Error(`Router "${id}" thiếu danh sách cổng`);
  }
  for (const l of net.links) {
    if (!net.devices[l.a] || !net.devices[l.b]) throw new Error(`Dây "${l.id}" nối tới thiết bị không tồn tại`);
  }
  return N.cloneNet({ devices: net.devices, links: net.links.map((l) => N.mkLink(l.a, l.ap, l.b, l.bp)) });
}

// ---------------------------------------------------------------- nhiệm vụ hướng dẫn
const hostsOf = (net) => Object.values(net.devices).filter((d) => (d.type === 'pc' || d.type === 'server') && d.ip && !d.ip.startsWith('169.254')).slice(0, 12);
function pairs(a, pred) {
  const H = hostsOf(a.net);
  for (const x of H) for (const y of H) if (x !== y && pred(x, y) && a.ping(x.id, y.ip)) return true;
  return false;
}
const sameNet = (x, y) => x.prefix === y.prefix && N.netOf(x.ip, x.prefix) === N.netOf(y.ip, y.prefix);

export const SANDBOX_LAB = {
  id: 'SBX', group: 'sbx', kind: 'sandbox', level: 1, lesson: 'Chế độ tự do',
  title: 'Tự dựng mạng riêng (sandbox)',
  story: 'Thêm PC / Server / Switch 2960 / Switch L3 3560 / Router bằng thanh công cụ, kéo thả để sắp xếp, 🔗 Nối dây (chọn 2 thiết bị rồi chọn cổng), bấm vào thiết bị để mở console và cấu hình như IOS thật. Mạng được tự lưu trong trình duyệt; dùng ⬇ Xuất / ⬆ Nhập JSON để chia sẻ. Các nhiệm vụ bên phải chỉ là gợi ý lộ trình — mạng của bạn, luật của bạn.',
  build: emptySandbox,
  tasks: [
    { text: 'Thêm ít nhất 2 PC và 1 switch, mọi PC đều đã cắm dây', verify: 'Thanh công cụ: 🖥 PC, ⇄ Switch, 🔗 Nối dây', check: (a) => { const ds = Object.values(a.net.devices); const pcs = ds.filter((d) => d.type === 'pc'); return pcs.length >= 2 && ds.some((d) => d.type === 'switch') && pcs.every((d) => N.linkAt(a.net, d.id, 'fa0')); } },
    { text: 'Đặt IP cho 2 máy cùng subnet và ping được nhau', verify: 'PC: ipconfig <IP> <mask> <gateway> → ping <IP>', check: (a) => pairs(a, sameNet) },
    { text: 'Có VLAN khác VLAN 1 trên switch và ít nhất 1 cổng access (đang cắm dây) thuộc VLAN đó', verify: 'show vlan brief', check: (a) => Object.values(a.net.devices).some((d) => d.type === 'switch' && Object.entries(d.ports).some(([p, c]) => c.modeSet && c.mode === 'access' && c.vlan !== 1 && d.vlans[c.vlan] && N.linkAt(a.net, d.id, p))) },
    { text: 'Định tuyến: một máy ping được máy ở subnet KHÁC (qua router hoặc switch L3)', verify: 'ping ; tracert', check: (a) => pairs(a, (x, y) => !sameNet(x, y)) },
    { text: 'Có máy nhận IP bằng DHCP (ipconfig /renew) từ router/switch L3', verify: 'ipconfig /renew ; show ip dhcp binding', check: (a) => Object.values(a.net.devices).some((d) => d.type === 'pc' && d.dhcp && d.ip && !d.ip.startsWith('169.254')) },
    { text: 'Định tuyến động: có ít nhất 1 cặp láng giềng OSPF hoặc EIGRP', verify: 'show ip ospf neighbor / show ip eigrp neighbors', check: (a) => Object.values(a.net.devices).some((d) => N.isL3(d) && (a.nbrs(d.id).length > 0 || a.eigrpNbrs(d.id).length > 0)) },
  ],
  hints: [
    'Gợi ý mạng đầu tiên: 2 PC — 1 switch. PC1: ipconfig 192.168.1.10 255.255.255.0 192.168.1.1 ; PC2: ipconfig 192.168.1.11 255.255.255.0 192.168.1.1 → ping.',
    'Thêm router, nối G0/0 vào switch: enable → conf t → interface g0/0 → ip address 192.168.1.1 255.255.255.0 → no shutdown. Thêm subnet thứ 2 trên G0/1.',
    'DHCP trên router: ip dhcp pool LAN → network 192.168.1.0 255.255.255.0 → default-router 192.168.1.1 ; PC: ipconfig /renew',
    'Hai router nối nhau qua G0/2 (hoặc Serial) rồi: router ospf 1 → network 0.0.0.0 255.255.255.255 area 0',
    'Kéo thiết bị để sắp xếp; chọn thiết bị rồi bấm 🗑 để xoá; ✂ Gỡ dây rồi bấm vào dây cần gỡ.',
  ],
  solution: [],
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, Number.isFinite(v) ? v : a)); }
