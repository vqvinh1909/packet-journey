// lab/sandbox.js — chế độ "🧱 Tự dựng mạng riêng": thêm/xoá thiết bị, nối/gỡ dây, xuất/nhập
// JSON, bật/tắt/wipe thiết bị (kiểu EVE-NG) và vài nhiệm vụ hướng dẫn chấm tự động trên mạng bất kỳ.
// Phần giao diện (workspace toàn màn hình) ở ui/workspace.js.

import * as N from './net.js';
import { fa } from './kit.js';

const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
/**
 * Mẫu thiết bị (kiểu "template" của EVE-NG): hãng, nhãn, tiền tố tên, số cổng và cách đặt tên cổng, hàm tạo.
 * ports = null: số cổng cố định (PC/Server một cổng Fa0). make(id, name, x, y, danhSáchCổng).
 */
export const SANDBOX_KINDS = {
  router: { vendor: 'cisco', label: 'Router', prefix: 'R', ports: { def: 3, min: 1, max: 8, unit: 'cổng Gigabit (+ 2 Serial)', names: (n) => [...range(n, (i) => `g0/${i}`), 's0/0/0', 's0/0/1'] }, make: (id, name, x, y, ps) => N.router(id, name, x, y, ps) },
  sw2960: { vendor: 'cisco', label: 'Switch 2960', prefix: 'SW', ports: { def: 24, choices: [8, 16, 24, 48], unit: 'cổng FastEthernet (+ 2 Gigabit uplink)', names: (n) => fa(n, ['g0/1', 'g0/2']) }, make: (id, name, x, y, ps) => N.sw(id, name, x, y, ps) },
  sw3560: { vendor: 'cisco', label: 'Switch L3 3560', prefix: 'L3SW', ports: { def: 24, choices: [8, 16, 24, 48], unit: 'cổng FastEthernet (+ 2 Gigabit uplink)', names: (n) => fa(n, ['g0/1', 'g0/2']) }, make: (id, name, x, y, ps) => { const d = N.sw(id, name, x, y, ps); d.model = '3560'; return d; } },
  asa: { vendor: 'cisco', label: 'ASA Firewall', prefix: 'ASA', ports: { def: 4, min: 2, max: 8, unit: 'cổng Gigabit', names: (n) => range(n, (i) => `g1/${i + 1}`) }, make: (id, name, x, y, ps) => N.firewall(id, name, x, y, ps, 'asa') },
  fortios: { vendor: 'fortinet', label: 'FortiGate', prefix: 'FGT', ports: { def: 4, min: 2, max: 10, unit: 'cổng (port1…)', names: (n) => range(n, (i) => `port${i + 1}`) }, make: (id, name, x, y, ps) => N.firewall(id, name, x, y, ps, 'fortios') },
  panos: { vendor: 'paloalto', label: 'Palo Alto VM', prefix: 'PA', ports: { def: 4, min: 2, max: 10, unit: 'cổng (ethernet1/1…)', names: (n) => range(n, (i) => `e1/${i + 1}`) }, make: (id, name, x, y, ps) => N.firewall(id, name, x, y, ps, 'panos') },
  sophos: { vendor: 'sophos', label: 'Sophos Firewall', prefix: 'XG', ports: { def: 4, min: 2, max: 8, unit: 'cổng (Port1…)', names: (n) => range(n, (i) => `port${i + 1}`) }, make: (id, name, x, y, ps) => N.firewall(id, name, x, y, ps, 'sophos') },
  checkpoint: { vendor: 'checkpoint', label: 'Check Point Gateway', prefix: 'CP', ports: { def: 4, min: 2, max: 8, unit: 'cổng (eth1…)', names: (n) => range(n, (i) => `eth${i + 1}`) }, make: (id, name, x, y, ps) => N.firewall(id, name, x, y, ps, 'checkpoint') },
  pfsense: { vendor: 'pfsense', label: 'pfSense', prefix: 'PFS', ports: { def: 4, min: 2, max: 8, unit: 'cổng (em0…)', names: (n) => range(n, (i) => `em${i}`) }, make: (id, name, x, y, ps) => N.firewall(id, name, x, y, ps, 'pfsense') },
  cloud: { vendor: 'network', label: 'Cloud / Internet', prefix: 'INTERNET', ports: null, make: (id, name, x, y) => N.server(id, name, x, y, { cloud: true }) },
  // PC trong workspace mặc định là VPCS như EVE-NG (lab có sẵn giữ dòng lệnh kiểu Windows)
  pc: { vendor: 'host', label: 'PC (VPCS)', prefix: 'PC', ports: null, make: (id, name, x, y) => Object.assign(N.pc(id, name, x, y), { shell: 'vpcs' }) },
  server: { vendor: 'host', label: 'Server', prefix: 'SRV', ports: null, make: (id, name, x, y) => N.server(id, name, x, y) },
};
/** Bảng thiết bị chia theo hãng (thứ tự hiển thị). */
export const SANDBOX_VENDORS = [
  { id: 'cisco', name: 'Cisco', kinds: ['router', 'sw2960', 'sw3560', 'asa'] },
  { id: 'fortinet', name: 'Fortinet', kinds: ['fortios'] },
  { id: 'paloalto', name: 'Palo Alto', kinds: ['panos'] },
  { id: 'sophos', name: 'Sophos', kinds: ['sophos'] },
  { id: 'checkpoint', name: 'Check Point', kinds: ['checkpoint'] },
  { id: 'pfsense', name: 'pfSense', kinds: ['pfsense'] },
  { id: 'network', name: 'Network', kinds: ['cloud'] },
  { id: 'host', name: 'Host', kinds: ['pc', 'server'] },
];
const TYPES = ['pc', 'server', 'switch', 'router'];
/** Khung làm việc (toạ độ thế giới) — rộng để workspace cuộn/phóng to được. */
export const SANDBOX_VIEW = { w: 2400, h: 1600 };

/** Số cổng hợp lệ của mẫu (giá trị lạ → mặc định). */
export function portCount(kind, n) {
  const P = SANDBOX_KINDS[kind]?.ports;
  if (!P) return 1;
  n = Math.round(+n);
  if (P.choices) return P.choices.includes(n) ? n : P.def;
  return Number.isFinite(n) ? Math.max(P.min, Math.min(P.max, n)) : P.def;
}
/** Tên cổng của mẫu với n cổng (để xem trước trong hộp thoại Add node). */
export function portNames(kind, n) { const P = SANDBOX_KINDS[kind]?.ports; return P ? P.names(portCount(kind, n)) : ['fa0']; }
/** Số cổng theo nghĩa của mẫu (router: số cổng Gigabit, switch: số cổng FastEthernet — không tính 2 Serial / 2 uplink). */
export function portCountOf(d) { const k = kindOf(d), n = physPorts(d).length; return k === 'router' || k === 'sw2960' || k === 'sw3560' ? n - 2 : n; }
/** Mẫu của một thiết bị (kể cả thiết bị trong file JSON cũ chưa ghi "kind"). */
export function kindOf(d) {
  if (d.kind && SANDBOX_KINDS[d.kind]) return d.kind;
  if (d.type === 'switch') return d.model === '3560' ? 'sw3560' : 'sw2960';
  if (N.isCloud(d)) return 'cloud';
  return SANDBOX_KINDS[d.os] ? d.os : d.type;
}

export function emptySandbox() { return N.makeNet([], []); }

/**
 * Thêm thiết bị mẫu `kind` tại (x, y) — tự đặt id/tên không trùng (tiền tố + số). Trả id.
 * o = { prefix, ports (số cổng), off (true = mới thêm ở trạng thái TẮT, như node EVE-NG) }.
 */
export function addDevice(net, kind, x, y, o = {}) {
  const k = SANDBOX_KINDS[kind];
  if (!k) throw new Error('Loại thiết bị không hợp lệ: ' + kind);
  const prefix = o.prefix || k.prefix;
  const idp = prefix.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'dev';
  let i = 1;
  const names = new Set(Object.values(net.devices).map((d) => d.name.toUpperCase()));
  while (net.devices[idp + i] || names.has((prefix + i).toUpperCase())) i++;
  const id = idp + i;
  const d = k.make(id, prefix + i, clamp(x, 40, SANDBOX_VIEW.w - 40), clamp(y, 40, SANDBOX_VIEW.h - 50), k.ports ? k.ports.names(portCount(kind, o.ports ?? k.ports.def)) : null);
  d.kind = kind;
  if (o.off) d.off = true;
  net.devices[id] = d;
  return id;
}
/** Hộp thoại "Add node": thêm `count` thiết bị cùng mẫu, xếp thành hàng từ (x, y). Trả { ids } hoặc { error }. */
export function addNodes(net, kind, o = {}, x = 120, y = 100) {
  if (!SANDBOX_KINDS[kind]) return { error: 'Chọn mẫu thiết bị' };
  const count = Math.round(+(o.count ?? 1));
  if (!(count >= 1 && count <= 20)) return { error: 'Số lượng từ 1 đến 20' };
  const prefix = String(o.prefix ?? '').trim() || SANDBOX_KINDS[kind].prefix;
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,19}$/.test(prefix)) return { error: 'Tiền tố tên: bắt đầu bằng chữ cái, chỉ gồm chữ, số, "-" hoặc "_" (tối đa 20 ký tự)' };
  const ids = [];
  for (let i = 0; i < count; i++) ids.push(addDevice(net, kind, x + (i % 6) * 120, y + Math.floor(i / 6) * 110, { prefix, ports: o.ports, off: o.off ?? true }));
  return { ids };
}
/** Vị trí trống gợi ý cho thiết bị mới (lưới, tránh chồng lên thiết bị có sẵn). */
export function freeSpot(net) {
  const ds = Object.values(net.devices);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 90 + col * 115, y = 70 + row * 85;
      if (ds.every((d) => Math.hypot(d.x - x, d.y - y) > 70)) return { x, y };
    }
  }
  return { x: 500, y: 220 };
}
/** Chỗ trống gần (x, y) đủ cho `count` thiết bị xếp hàng như addNodes (6 cột, cách 120 × 110). */
export function freeSpotNear(net, x, y, count = 1) {
  const ds = Object.values(net.devices);
  const free = (px, py) => ds.every((d) => Math.hypot(d.x - px, d.y - py) > 110);
  const fits = (px, py) => Array.from({ length: count }, (_, i) => [px + (i % 6) * 120, py + Math.floor(i / 6) * 110]).every(([a, b]) => free(a, b));
  for (let r = 0; r < 30; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of [-r, r]) { const px = x + dx * 60, py = y + dy * 55; if (fits(px, py)) return { x: px, y: py }; }
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) for (const dx of [-r, r]) { const px = x + dx * 60, py = y + dy * 55; if (fits(px, py)) return { x: px, y: py }; }
  }
  return { x, y };
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

// ---------------------------------------------------------------- bật / tắt / wipe (như node EVE-NG)
/** Thiết bị đang tắt? (file JSON cũ không có trường "off" → coi như đang chạy) */
export const isOff = (d) => !!d?.off;
/** Bật thiết bị; trả các dòng log khởi động để console hiện trước khi cho gõ lệnh. */
export function startDevice(net, id) {
  const d = net.devices[id];
  if (!d) return [];
  d.off = false;
  return bootLog(d);
}
/** Tắt thiết bị: mọi cổng xuống (dây nối tới nó cũng down), xoá bảng động; cấu hình đang chạy được giữ. */
export function stopDevice(net, id) {
  const d = net.devices[id];
  if (!d) return;
  d.off = true;
  d.arp = {};
  if (d.macTable) d.macTable = [];
  if (d.natTable) d.natTable = [];
  if (d.fw?.conns) d.fw.conns = [];
  if (d.snoop?.bindings) d.snoop.bindings = [];
  if (d.dhcp?.bindings) d.dhcp.bindings = [];
}
/** Start all / Stop all. Trả danh sách id đã đổi trạng thái. */
export function powerAll(net, on) {
  const ids = Object.values(net.devices).filter((d) => isOff(d) === on).map((d) => d.id);
  for (const id of ids) (on ? startDevice : stopDevice)(net, id);
  return ids;
}
/** Wipe: đưa thiết bị về cấu hình trống (giữ id, tên, vị trí, cổng nên dây vẫn còn) và để ở trạng thái TẮT. */
export function wipeDevice(net, id) {
  const d = net.devices[id];
  if (!d) return false;
  const kind = kindOf(d);
  const k = SANDBOX_KINDS[kind];
  const fresh = k.make(d.id, d.name, d.x, d.y, k.ports ? physPorts(d) : null);
  // đã "Đặt làm startup-config" (copy run start / write memory) → Wipe quay về đúng cấu hình đó, như reload
  if (d.startupCfg) Object.assign(fresh, JSON.parse(JSON.stringify(d.startupCfg)), { id: d.id, x: d.x, y: d.y, startupCfg: d.startupCfg });
  fresh.kind = kind;
  fresh.off = true;
  if (d.shell) fresh.shell = d.shell;
  // VPCS: Wipe nạp lại cấu hình đã "save" (startup.vpc)
  if (d.vpcsSaved) { fresh.vpcsSaved = d.vpcsSaved; Object.assign(fresh, d.vpcsSaved); }
  net.devices[id] = fresh;
  return true;
}
/** Log khởi động ngắn (tự soạn, mô phỏng) theo loại thiết bị. */
export function bootLog(d) {
  const ports = physPorts(d).length;
  switch (kindOf(d)) {
    case 'router': case 'sw2960': case 'sw3560':
      return ['Bootstrap: kiểm tra bộ nhớ ... OK', 'Nạp hệ điều hành từ flash ... ########## [OK]', `Phát hiện ${ports} cổng mạng`, 'Đọc startup-config từ NVRAM ... ' + (d.startupCfg ? 'có cấu hình' : 'trống'), '%SYS-5-RESTART: System restarted', '', 'Press RETURN to get started.'];
    case 'asa':
      return ['Bootstrap: kiểm tra bộ nhớ ... OK', 'Nạp hệ điều hành firewall ... ########## [OK]', `Phát hiện ${ports} cổng mạng`, 'Khởi động bảng phiên stateful ... OK', '', 'Type help or \'?\' for a list of available commands.'];
    case 'fortios':
      return ['FortiGate VM (mô phỏng) đang khởi động ...', 'Khởi tạo bảng phiên và chính sách firewall ... OK', `Phát hiện ${ports} cổng: port1 … port${ports}`, 'System is started.', '', `${d.name} login: admin (lab tự đăng nhập)`];
    case 'panos':
      return ['PAN-OS VM (mô phỏng) đang khởi động ...', 'Khởi động management plane ... OK', 'Khởi động data plane ... OK', 'Auto-commit running config ... OK', '', 'login: admin (lab tự đăng nhập)'];
    case 'sophos': case 'checkpoint': case 'pfsense':
      return [`${SANDBOX_KINDS[kindOf(d)].label} (mô phỏng) đang khởi động ...`, `Phát hiện ${ports} cổng mạng`, 'Dịch vụ firewall ... OK', 'Trang quản trị web sẵn sàng.'];
    default:
      if (d.shell === 'vpcs') return ['', 'Welcome to Virtual PC Simulator, version 0.6.2', 'Dedicated to Daling.', 'Build time: Oct 27 2026', 'Copyright (c) 2007-2015, Paul Meng (mirnshi@gmail.com)', 'All rights reserved.', '', 'VPCS is free software, distributed under the terms of the "BSD" licence.', 'Source code and license can be found at vpcs.sf.net.', 'For more information, please visit wiki.freecode.com.cn.', '', d.vpcsSaved ? 'Loading startup.vpc ... done' : '', 'Press \'?\' to get help.', '', 'Executing the startup file', ''];
      return ['Đang khởi động máy trạm ...', 'Card mạng Fa0 ... OK', 'Sẵn sàng.'];
  }
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

/** Đổi tên hiển thị (router/switch: chính là hostname). Trả null hoặc chuỗi lỗi. */
export function renameDevice(net, id, name) {
  const d = net.devices[id];
  const n = String(name ?? '').trim();
  if (!d) return 'Thiết bị không tồn tại';
  if (!n) return 'Tên không được để trống';
  if (n.length > 30) return 'Tên tối đa 30 ký tự';
  if (!isHostLike(d) && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(n)) return 'Hostname IOS: bắt đầu bằng chữ cái, chỉ gồm chữ, số, "-" hoặc "_" (không dấu cách)';
  if (Object.values(net.devices).some((x) => x.id !== id && x.name.toUpperCase() === n.toUpperCase())) return `Đã có thiết bị tên "${n}"`;
  d.name = n;
  return null;
}
/** Nhân bản thiết bị: giữ cấu hình (VLAN, cổng, routing...) nhưng bỏ địa chỉ IP, bảng động và dây. Trả id mới. */
export function duplicateDevice(net, id) {
  const src = net.devices[id];
  if (!src) return null;
  const kind = kindOf(src);
  const nid = addDevice(net, kind, src.x + 60, src.y + 50, { ports: portCountOf(src), off: isOff(src) });
  const fresh = net.devices[nid];
  // FortiGate / Palo Alto / firewall web giữ cấu hình (kể cả IP) trong model riêng của hãng → bản sao để trống
  if (src.os && src.os !== 'asa') return nid;
  const d = N.cloneNet({ devices: { x: src }, links: [] }).devices.x;
  Object.assign(d, { id: nid, name: fresh.name, x: fresh.x, y: fresh.y, arp: {}, kind, off: fresh.off });
  if (isHostLike(d)) { d.ip = ''; d.gateway = ''; }
  for (const f of Object.values(d.ifaces || {})) f.ip = null;
  for (const f of Object.values(d.svis || {})) f.ip = null;
  if (d.macTable) d.macTable = [];
  if (d.natTable) d.natTable = [];
  if (d.dhcp) d.dhcp.bindings = [];
  for (const p of Object.values(d.ports || {})) if (p.ps) p.ps.macs = [];
  net.devices[nid] = d;
  return nid;
}
const isHostLike = (d) => d.type === 'pc' || d.type === 'server';

/** Lịch sử hoàn tác / làm lại: lưu ảnh chụp JSON của mạng trước mỗi thay đổi. */
export function createHistory(limit = 60) {
  const undo = [], redo = [];
  const snap = (net) => JSON.stringify({ devices: net.devices, links: net.links });
  const restore = (net, str) => { const o = JSON.parse(str); net.devices = o.devices; net.links = o.links; };
  return {
    /** Chạy fn (thay đổi mạng); nếu mạng thật sự đổi thì ghi lại để hoàn tác được. Trả giá trị của fn. */
    track(net, fn) {
      const before = snap(net);
      const r = fn();
      this.commit(net, before);
      return r;
    },
    /** Dùng cho thao tác kéo dài (kéo thả): chụp trước, commit khi xong. */
    snapshot: snap,
    commit(net, before) {
      if (snap(net) === before) return false;
      undo.push(before);
      if (undo.length > limit) undo.shift();
      redo.length = 0;
      return true;
    },
    undo(net) { if (!undo.length) return false; redo.push(snap(net)); restore(net, undo.pop()); return true; },
    redo(net) { if (!redo.length) return false; undo.push(snap(net)); restore(net, redo.pop()); return true; },
    get canUndo() { return undo.length > 0; },
    get canRedo() { return redo.length > 0; },
    clear() { undo.length = 0; redo.length = 0; },
  };
}

// ---------------------------------------------------------------- mẫu mạng dựng sẵn (chỉ thiết bị + dây, chưa cấu hình)
const tpl = (devs, links) => () => {
  const net = emptySandbox();
  for (const [kind, x, y] of devs) addDevice(net, kind, x, y);
  for (const l of links) connect(net, ...l);
  return net;
};
export const SANDBOX_TEMPLATES = [
  { id: 'lan', title: 'LAN cơ bản', desc: '1 switch + 3 PC — luyện đặt IP, ping, bảng MAC', build: tpl([['sw2960', 500, 120], ['pc', 250, 320], ['pc', 500, 340], ['pc', 750, 320]], [['pc1', 'fa0', 'sw1', 'fa0/1'], ['pc2', 'fa0', 'sw1', 'fa0/2'], ['pc3', 'fa0', 'sw1', 'fa0/3']]) },
  { id: 'twonet', title: 'Hai mạng qua router', desc: 'R1 nối 2 switch, mỗi bên 1 PC — luyện gateway, định tuyến, DHCP', build: tpl([['router', 500, 80], ['sw2960', 250, 210], ['sw2960', 750, 210], ['pc', 250, 360], ['pc', 750, 360]], [['r1', 'g0/0', 'sw1', 'g0/1'], ['r1', 'g0/1', 'sw2', 'g0/1'], ['pc1', 'fa0', 'sw1', 'fa0/1'], ['pc2', 'fa0', 'sw2', 'fa0/1']]) },
  { id: 'roas', title: 'VLAN + router-on-a-stick', desc: 'Switch 4 PC (2 phòng) + router 1 cổng trunk — luyện VLAN, trunk, subinterface', build: tpl([['router', 500, 70], ['sw2960', 500, 200], ['pc', 170, 360], ['pc', 390, 380], ['pc', 610, 380], ['pc', 830, 360]], [['r1', 'g0/0', 'sw1', 'g0/1'], ['pc1', 'fa0', 'sw1', 'fa0/1'], ['pc2', 'fa0', 'sw1', 'fa0/2'], ['pc3', 'fa0', 'sw1', 'fa0/3'], ['pc4', 'fa0', 'sw1', 'fa0/4']]) },
  { id: 'ospf3', title: 'Tam giác 3 router', desc: '3 router nối vòng, mỗi router 1 LAN — luyện OSPF/EIGRP, static, redundancy', build: tpl([['router', 500, 70], ['router', 250, 260], ['router', 750, 260], ['pc', 500, 200], ['pc', 100, 380], ['pc', 900, 380]], [['r1', 'g0/1', 'r2', 'g0/1'], ['r1', 'g0/2', 'r3', 'g0/1'], ['r2', 'g0/2', 'r3', 'g0/2'], ['pc1', 'fa0', 'r1', 'g0/0'], ['pc2', 'fa0', 'r2', 'g0/0'], ['pc3', 'fa0', 'r3', 'g0/0']]) },
  { id: 'campus', title: 'Campus nhỏ có switch L3', desc: 'Switch L3 làm core + 2 switch access + router biên — luyện SVI, inter-VLAN, default route', build: tpl([['router', 500, 60], ['sw3560', 500, 170], ['sw2960', 270, 290], ['sw2960', 730, 290], ['pc', 170, 400], ['pc', 370, 400], ['pc', 630, 400], ['pc', 830, 400]], [['r1', 'g0/0', 'l3sw1', 'g0/1'], ['l3sw1', 'fa0/1', 'sw1', 'g0/1'], ['l3sw1', 'fa0/2', 'sw2', 'g0/1'], ['pc1', 'fa0', 'sw1', 'fa0/1'], ['pc2', 'fa0', 'sw1', 'fa0/2'], ['pc3', 'fa0', 'sw2', 'fa0/1'], ['pc4', 'fa0', 'sw2', 'fa0/2']]) },
];

// ---------------------------------------------------------------- xuất / nhập JSON
export const SANDBOX_FORMAT = 'packet-journey-sandbox';
export function exportSandbox(net) {
  const out = N.cloneNet(net);
  for (const d of Object.values(out.devices)) delete d.logBuf; // buffer "show logging" chỉ sống trong phiên
  return { format: SANDBOX_FORMAT, version: 1, net: out };
}
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
  story: 'Thêm thiết bị từ bảng bên trái (chia theo hãng) hoặc chuột phải vào nền → Add node; thiết bị mới ở trạng thái TẮT — chuột phải → Start (hoặc ▶ Start all). 🔗 Nối dây: chọn 2 thiết bị rồi chọn cổng. Nháy đúp thiết bị để mở console (nhiều console cùng lúc, kéo/đổi kích thước được); Sophos / Check Point / pfSense mở trang quản trị web. Mạng được tự lưu trong trình duyệt; ⬇ Xuất / ⬆ Nhập JSON để chia sẻ. Các nhiệm vụ chỉ là gợi ý lộ trình — mạng của bạn, luật của bạn.',
  build: emptySandbox,
  tasks: [
    { text: 'Thêm ít nhất 2 PC và 1 switch, mọi PC đều đã cắm dây', verify: 'Bảng thiết bị: Host → PC, Cisco → Switch; 🔗 Nối dây', check: (a) => { const ds = Object.values(a.net.devices); const pcs = ds.filter((d) => d.type === 'pc'); return pcs.length >= 2 && ds.some((d) => d.type === 'switch') && pcs.every((d) => N.linkAt(a.net, d.id, 'fa0')); } },
    { text: 'Đặt IP cho 2 máy cùng subnet và ping được nhau', verify: 'PC (VPCS): ip <IP>/<len> <gateway> → ping <IP>  (kiểu Windows: ipconfig <IP> <mask> <gw>)', check: (a) => pairs(a, sameNet) },
    { text: 'Có VLAN khác VLAN 1 trên switch và ít nhất 1 cổng access (đang cắm dây) thuộc VLAN đó', verify: 'show vlan brief', check: (a) => Object.values(a.net.devices).some((d) => d.type === 'switch' && Object.entries(d.ports).some(([p, c]) => c.modeSet && c.mode === 'access' && c.vlan !== 1 && d.vlans[c.vlan] && N.linkAt(a.net, d.id, p))) },
    { text: 'Định tuyến: một máy ping được máy ở subnet KHÁC (qua router hoặc switch L3)', verify: 'ping ; tracert', check: (a) => pairs(a, (x, y) => !sameNet(x, y)) },
    { text: 'Có máy nhận IP bằng DHCP (VPCS: ip dhcp) từ router/switch L3', verify: 'ip dhcp (hoặc ipconfig /renew) ; show ip dhcp binding', check: (a) => Object.values(a.net.devices).some((d) => d.type === 'pc' && d.dhcp && d.ip && !d.ip.startsWith('169.254')) },
    { text: 'Định tuyến động: có ít nhất 1 cặp láng giềng OSPF hoặc EIGRP', verify: 'show ip ospf neighbor / show ip eigrp neighbors', check: (a) => Object.values(a.net.devices).some((d) => N.isL3(d) && (a.nbrs(d.id).length > 0 || a.eigrpNbrs(d.id).length > 0)) },
  ],
  hints: [
    'Gợi ý mạng đầu tiên: 2 PC — 1 switch. PC1: ip 192.168.1.10/24 192.168.1.1 ; PC2: ip 192.168.1.11/24 192.168.1.1 → ping 192.168.1.11 (PC trong workspace là VPCS như EVE-NG; chuột phải PC để đổi sang kiểu Windows).',
    'Thêm router, nối G0/0 vào switch: enable → conf t → interface g0/0 → ip address 192.168.1.1 255.255.255.0 → no shutdown. Thêm subnet thứ 2 trên G0/1.',
    'DHCP trên router: ip dhcp pool LAN → network 192.168.1.0 255.255.255.0 → default-router 192.168.1.1 ; PC: ip dhcp',
    'Hai router nối nhau qua G0/2 (hoặc Serial) rồi: router ospf 1 → network 0.0.0.0 255.255.255.255 area 0',
    'Kéo thiết bị để sắp xếp; chuột phải vào thiết bị: Start / Stop / Wipe / Console / Đổi tên / Nhân bản / Xoá; chuột phải vào dây: Xoá dây.',
    'Thiết bị đang tắt thì mọi dây nối tới nó đều down — nhớ Start trước khi ping.',
  ],
  solution: [],
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, Number.isFinite(v) ? v : a)); }
