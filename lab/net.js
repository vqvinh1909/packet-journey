// lab/net.js — "máy mô phỏng mạng" cho Lab CLI.
//
// Khác các kịch bản dựng sẵn (scripted), ở đây mạng được TÍNH từ cấu hình người học gõ:
//   - Lớp 2: VLAN, access/trunk (allowed/native), DTP (auto/desirable), VTP (domain/revision),
//            EtherChannel, port-security (vi phạm → restrict/err-disable), BPDU Guard,
//            Protected Port, Private VLAN, VACL, SVI.
//   - Lớp 3: bảng định tuyến = connected + static (kể cả floating) + OSPF + EIGRP tự tính
//            (adjacency thật: subnet/area/hello/passive/priority/router-id), switch Layer 3
//            (ip routing + SVI), proxy-ARP, PPP/HDLC trên serial.
//   - Dịch vụ: ACL (standard/extended/named, thứ tự dòng, deny ngầm định, access-class VTY),
//            NAT (PAT, NAT tĩnh, static PAT, NAT pool), HSRP (+track) / VRRP, DHCP + relay
//            + DHCP snooping, VPN IPsec site-to-site (ISAKMP/transform-set/crypto map).
//   - Gói tin đi THẬT: ARP trong miền quảng bá, router tra longest-prefix, TTL−1, NAT,
//            ACL in/out, mã hoá ESP, chiều về cũng phải có route → ping thành công mới tính.
// Mọi hàm đều thuần (không DOM). Khi cần animation, gói được dựng thành BYTE THẬT qua
// serialize() của engine sẵn có → xem được cây trường/hex và xuất .pcap như các kịch bản.

import { plEval, rmEval, rmPacket, asPathOk, ribPolicy, timeActive, qosEval } from './policy.js';
import { Sim, diffFields } from '../engine/simulate.js';
import { ipToInt, intToIp, parseIp } from '../packet/addr.js';
import { pingData } from '../scenarios/_common.js';

// Đang chạy thao tác "thật" của người học (ghi lại vi phạm port-security, MAC học được...)
import { fwCheck, fwEstablished, persistFw, fwSnat } from './fw.js';
import { sniffRecord, flowRecord } from './sniff.js';
let RECORDING = false;

// ======================================================================
// Địa chỉ
// ======================================================================
export const ip2n = (s) => ipToInt(s);
export const n2ip = (n) => intToIp(n >>> 0);
export const maskN = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
export const netOf = (ip, p) => n2ip((ip2n(ip) & maskN(p)) >>> 0);
export const prefixToMask = (p) => n2ip(maskN(p));
export function inNet(ip, net, p) {
  if (!ip || !net || p == null) return false;
  return ((ip2n(ip) & maskN(p)) >>> 0) === ((ip2n(net) & maskN(p)) >>> 0);
}
export function isIp(s) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(s || '') && s.split('.').every((x) => +x <= 255);
}
/** "255.255.255.0" -> 24; ném lỗi nếu mask không liền. */
export function maskToPrefix(m) {
  if (!isIp(m)) throw new Error(`Mask không hợp lệ: ${m}`);
  const n = ip2n(m);
  let p = 0, zero = false;
  for (let b = 31; b >= 0; b--) {
    if ((n >>> b) & 1) { if (zero) throw new Error(`Mask không liền: ${m}`); p++; } else zero = true;
  }
  return p;
}
/** ip khớp (base, wildcard)? (wildcard: bit 1 = bỏ qua) */
export function wildMatch(ip, base, wild) {
  const w = ip2n(wild);
  return ((ip2n(ip) & ~w) >>> 0) === ((ip2n(base) & ~w) >>> 0);
}
function bitCount(n) { let c = 0; n >>>= 0; while (n) { c += n & 1; n >>>= 1; } return c; }
function classfulPrefix(ip) { const a = +ip.split('.')[0]; return a < 128 ? 8 : a < 192 ? 16 : 24; }

// ======================================================================
// Tên cổng: chuẩn hoá "Gi0/0", "gigabitEthernet 0/0", "g0/0.10" -> 'g0/0' / 'g0/0.10'
// ======================================================================
const IF_KINDS = [
  ['g', 'gigabitethernet', 'GigabitEthernet', 'Gi'],
  ['fa', 'fastethernet', 'FastEthernet', 'Fa'],
  ['e', 'ethernet', 'Ethernet', 'Et'],
  ['s', 'serial', 'Serial', 'Se'],
  ['po', 'port-channel', 'Port-channel', 'Po'],
  ['lo', 'loopback', 'Loopback', 'Lo'],
  ['vlan', 'vlan', 'Vlan', 'Vl'],
  ['tu', 'tunnel', 'Tunnel', 'Tu'],
];
export function normIf(str) {
  const s = String(str || '').toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^([a-z-]+)(\d[\d/.]*)$/);
  if (!m) return null;
  const cand = IF_KINDS.filter(([sh, full]) => sh === m[1] || full.startsWith(m[1]));
  if (cand.length !== 1) return null;
  const sh = cand[0][0];
  const num = m[2];
  if (['po', 'lo', 'vlan', 'tu'].includes(sh)) { if (!/^\d+$/.test(num)) return null; }
  else if (!/^\d+\/\d+(\/\d+)?(\.\d+)?$/.test(num)) return null;
  return sh + num;
}
function kindOf(ifn) { const m = String(ifn).match(/^[a-z]+/); return m ? m[0] : ''; }
/** 'g0/0' -> 'GigabitEthernet0/0' */
export function longIf(ifn) {
  const k = IF_KINDS.find((x) => x[0] === kindOf(ifn));
  return k ? k[2] + ifn.slice(k[0].length) : ifn;
}
/** 'g0/0' -> 'Gi0/0' */
export function shortIf(ifn) {
  const k = IF_KINDS.find((x) => x[0] === kindOf(ifn));
  return k ? k[3] + ifn.slice(k[0].length) : ifn;
}
/** Sắp xếp tên cổng theo số tự nhiên (fa0/2 trước fa0/10). */
export function ifSort(a, b) {
  const pa = a.match(/\d+/g) || [], pb = b.match(/\d+/g) || [];
  if (kindOf(a) !== kindOf(b)) return kindOf(a) < kindOf(b) ? -1 : 1;
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (+(pa[i] ?? -1)) - (+(pb[i] ?? -1));
    if (d) return d;
  }
  return 0;
}

// ======================================================================
// Tạo thiết bị (dùng trong lab/labs*.js và chế độ tự dựng mạng)
// ======================================================================
function common(id, type, name, x, y) {
  return {
    id, type, name, x, y,
    enableSecret: null, enablePassword: null, servicePwEnc: false, banner: null,
    domain: null, rsa: 0, users: {}, cdpRun: true,
    lines: { con: { password: null, login: false, loginLocal: false }, vty: { password: null, login: true, loginLocal: false, transport: 'all', accessClass: null } },
    ntp: { master: null, servers: [] }, logging: [], arp: {},
    // hệ điều hành / flash / cấu hình đã lưu (NVRAM)
    flash: null, flashSize: 0, image: null, version: null, bootSystem: [], startupCfg: null,
  };
}
export function pc(id, name, x, y, o = {}) {
  return { ...common(id, 'pc', name, x, y), ip: o.ip || '', prefix: o.prefix ?? 24, gateway: o.gw || '', dns: o.dns || '', dhcp: !!o.dhcp, services: o.services || [], files: o.files || [], ip6: o.ip6 || '', prefix6: o.prefix6 ?? 64, gw6: o.gw6 || '', slaac: false };
}
export function server(id, name, x, y, o = {}) {
  const d = pc(id, name, x, y, o);
  d.type = 'server';
  d.services = o.services || [80, 443];
  // cloud: chỉ đổi HÌNH VẼ thành đám mây (vẫn là server giả lập) — mặc định bật cho tên chứa "INTERNET"
  d.cloud = !!(o.cloud ?? CLOUD_NAME.test(name));
  return d;
}
const CLOUD_NAME = /internet/i;
/** Thiết bị vẽ thành đám mây "Internet"? (file JSON cũ chưa có cờ "cloud" → nhận theo tên) */
export function isCloud(d) { return d?.type === 'server' && (d.cloud ?? CLOUD_NAME.test(d.name || '')); }
export function newPort() {
  // modeSet=false: chưa gõ "switchport mode" → cổng DTP "dynamic auto" (mặc định của switch Cisco)
  return { mode: 'access', modeSet: false, dyn: 'auto', vlan: 1, allowed: null, native: 1, shutdown: false, errdis: false, desc: '', group: null, chMode: null, portfast: false, bpduguard: false, ps: null, trust: false, daiTrust: false, ipsg: false, dhcpRate: null, nonegotiate: false, protected: false, cdp: true, pv: null };
}
export function newIf(name) {
  return { ip: null, prefix: null, shutdown: !name.startsWith('lo') && !name.startsWith('tu'), tunSrc: null, tunDst: null, desc: '', encap: null, native: false, nat: null, aclIn: null, aclOut: null, standby: {}, vrrp: {}, helper: [], ospfCost: null, ospfArea: null, ospfPid: null, ospfHello: null, ospfPrio: null, bw: null, clock: null, l2enc: name.startsWith('s') ? 'hdlc' : null, cdp: true, proxyArp: true, cryptoMap: null, ipv6: [], ipv6Enable: false, ll: null, ospf6: null };
}
export function newSubIf(name) { const f = newIf(name); f.shutdown = false; return f; }
function l3Common(d) {
  d.routes = [];
  d.ospf = null;
  d.eigrp = null;
  d.acls = {};
  d.dhcp = { pools: {}, excluded: [], bindings: [] };
  return d;
}
export function sw(id, name, x, y, ports, o = {}) {
  const d = l3Common(common(id, 'switch', name, x, y));
  d.ports = {};
  for (const p of ports) d.ports[p] = newPort();
  d.vlans = { 1: 'default' };
  d.vtpMode = o.vtp || 'server';
  d.vtpDomain = '';
  d.vtpRev = 0;
  d.vtpPw = '';
  d.stp = { mode: 'pvst', prio: {} };
  d.svis = { vlan1: newIf('vlan1') }; // VLAN 1 mặc định shutdown
  d.defaultGateway = '';
  d.ipRouting = !!o.l3;
  d.macTable = [];
  d.snoop = { enabled: false, vlans: [], bindings: [], statics: [] }; // bindings: { mac, ip, vlan, port } học từ DHCP ACK
  d.dai = [];
  d.daiStats = {};                    // vlan -> { fwd, drop }
  d.pvlan = {};                       // vlanId -> { type: primary|isolated|community, assoc: [...] }
  d.vacl = { maps: {}, filters: {} }; // VLAN access-map
  d.model = o.l3 ? '3560' : '2960';
  return d;
}
export function router(id, name, x, y, ifs) {
  const d = l3Common(common(id, 'router', name, x, y));
  d.ifaces = {};
  for (const n of ifs) d.ifaces[n] = newIf(n);
  d.nat = { dyn: [], statics: [], pools: {} };
  d.natTable = [];
  d.crypto = { isakmp: {}, keys: {}, tsets: {}, maps: {} };
  d.ipv6Routing = false;
  d.routes6 = [];
  d.ospf6 = null;
  return d;
}
/**
 * Firewall: router + `fw` (xem lab/fw.js). os = 'asa' | 'fortios' | 'panos' | 'ios-zbf' ... chọn bộ CLI;
 * kind = 'asa' | 'zbf' | 'policy' chọn cách xét gói.
 */
export function firewall(id, name, x, y, ifs, os = 'asa') {
  const d = router(id, name, x, y, ifs);
  d.os = os;
  d.fw = { kind: os === 'asa' ? 'asa' : 'policy', inspectIcmp: false, sameSec: false, rules: [], conns: [] };
  for (const f of Object.values(d.ifaces)) { f.nameif = null; f.secLevel = null; f.zone = null; }
  return d;
}
export function newOspf(pid) { return { pid, rid: null, networks: [], passive: [], noPassive: [], passiveDefault: false, defaultOriginate: false, defaultAlways: false }; }
export function newEigrp(as) { return { as, networks: [], passive: [], autoSummary: false, rid: null }; }

/** Interface lớp 3 của thiết bị: router → cổng/subif/loopback; switch → SVI. */
export function l3ifs(d) { return d.type === 'router' ? d.ifaces : d.type === 'switch' ? d.svis : {}; }
/** Thiết bị có định tuyến không (router, hoặc switch Layer 3 đã "ip routing"). */
export function isL3(d) { return d.type === 'router' || (d.type === 'switch' && !!d.ipRouting); }

/** links: [[a, ap, b, bp], ...] */
export function makeNet(devs, links) {
  const devices = {};
  for (const d of devs) devices[d.id] = d;
  return { devices, links: links.map(([a, ap, b, bp]) => mkLink(a, ap, b, bp)) };
}
export function mkLink(a, ap, b, bp) { return { id: `${a}:${ap}~${b}:${bp}`, a, ap, b, bp }; }
export function cloneNet(net) {
  const { clock, ...rest } = net; // ⏱ đồng hồ mô phỏng thuộc phiên đang chạy, không sao chép / xuất ra file
  return JSON.parse(JSON.stringify(rest));
}

// ======================================================================
// MAC (tất định theo vị trí thiết bị/cổng)
// ======================================================================
const hx = (n) => (n & 0xff).toString(16).padStart(2, '0');
function devIndex(net, id) { return Object.keys(net.devices).indexOf(id) + 1; }
export function epMac(net, ep) {
  const d = net.devices[ep.dev];
  const i = devIndex(net, ep.dev);
  if (d.type === 'pc' || d.type === 'server') return `00:50:79:66:${hx(i)}:01`;
  if (d.type === 'switch') return `00:d0:ba:${hx(i)}:00:${ep.ifn && ep.ifn.startsWith('vlan') ? 'fe' : '01'}`;
  const phys = (ep.ifn || '').split('.')[0];
  const pi = Object.keys(d.ifaces).filter((n) => !n.includes('.')).indexOf(phys) + 1;
  return `00:1a:2f:${hx(i)}:${hx(pi)}:01`;
}
export function switchMac(net, id) { return `00:d0:ba:${hx(devIndex(net, id))}:00:00`; }
export const hsrpMac = (g) => `00:00:0c:07:ac:${hx(+g)}`;
const vrrpMac = (g) => `00:00:5e:00:01:${hx(+g)}`;
/** "aabb.ccdd.eeff" (kiểu Cisco) hoặc "aa:bb:…" → "aa:bb:cc:dd:ee:ff"; sai định dạng → null. */
export function parseCiscoMac(w) { const h = String(w).toLowerCase().replace(/[.:-]/g, ''); return /^[0-9a-f]{12}$/.test(h) ? h.match(/../g).join(':') : null; }
/** "00:50:79:66:01:01" -> "0050.7966.0101" (kiểu Cisco) */
export function ciscoMac(m) { const h = m.replace(/:/g, ''); return `${h.slice(0, 4)}.${h.slice(4, 8)}.${h.slice(8)}`; }

// ======================================================================
// Lớp 1–2: trạng thái cổng, DTP, EtherChannel, flooding theo VLAN
// ======================================================================
export function linkAt(net, dev, port) {
  return net.links.find((l) => (l.a === dev && l.ap === port) || (l.b === dev && l.bp === port)) || null;
}
export function peerOf(l, dev, port) {
  return l.a === dev && l.ap === port ? { dev: l.b, port: l.bp } : { dev: l.a, port: l.ap };
}
function peerDev(net, devId, port) {
  const l = linkAt(net, devId, port);
  return l ? net.devices[peerOf(l, devId, port).dev] : null;
}
/** Mức broadcast hiện tại (%) trên cổng: máy đầu kia đang phát bão thì có d.stormPct, không thì coi như 0. */
export function stormNow(net, d, port) { return peerDev(net, d.id, port)?.stormPct ?? 0; }
/** Cổng switch đang err-disabled (port-security shutdown, hoặc BPDU Guard gặp switch khác). */
export function errDisabled(net, d, port) {
  const p = d.ports?.[port];
  if (!p) return false;
  if (p.errdis) return true;
  const guard = p.bpduguard || (p.portfast && d.stp?.bpduDefault);
  if (guard && !p.shutdown && peerDev(net, d.id, port)?.type === 'switch') return true;
  return !!(p.storm?.action === 'shutdown' && p.storm.level != null && stormNow(net, d, port) > p.storm.level);
}
function physAdminUp(net, devId, port) {
  const d = net.devices[devId];
  if (!d || d.off) return false; // thiết bị đang tắt (sandbox: Stop) → mọi cổng xuống
  if (d.type === 'pc' || d.type === 'server') return true;
  if (d.type === 'switch') { const p = d.ports[port]; return !!p && !p.shutdown && !errDisabled(net, d, port); }
  const f = d.ifaces[port];
  return !!f && !f.shutdown;
}
/** Tầng 1 up (cổng bật + có dây + đầu kia bật) — cột "Status". */
export function statusUp(net, devId, port) {
  const d = net.devices[devId];
  if (d.type === 'router' && port.startsWith('lo')) return !d.ifaces[port].shutdown;
  if (!physAdminUp(net, devId, port)) return false;
  const l = linkAt(net, devId, port);
  if (!l) return false;
  const p = peerOf(l, devId, port);
  if (!physAdminUp(net, p.dev, p.port)) return false;
  return !unpowered(d, port, net.devices[p.dev], p.port) && !ethMode(net, devId, port).down;
}
/** Module quang tương thích: cùng loại SFP, đúng loại sợi và trong cự ly. SX: multimode 550 m; LX: singlemode 10 km. */
const SFP = { SX: { fiber: 'MMF', max: 550 }, LX: { fiber: 'SMF', max: 10000 } };
export function sfpOk(a, b) {
  if (!a?.sfp && !b?.sfp) return true;
  if (a?.sfp !== b?.sfp) return false;
  const m = SFP[a.sfp];
  return (a.fiber ?? m.fiber) === m.fiber && (a.fiberM ?? 0) <= m.max;
}
const unpowered = (d1, p1, d2, p2) => (d2.phone && d1.ports?.[p1]?.power === 'never') || (d1.phone && d2.ports?.[p2]?.power === 'never');
/**
 * Kết quả thương lượng Ethernet của một cổng. Đặt cứng CẢ speed và duplex thì cổng tắt autonegotiation:
 * đầu auto còn lại vẫn dò được tốc độ, nhưng duplex rơi về half (10/100) hoặc full (1000).
 * Trả { speed, duplex, autoSpeed, autoDuplex, mismatch, down }; down = hai đầu không cùng tốc độ.
 */
export function ethMode(net, devId, port) {
  const side = (id, n) => { const c = net.devices[id].ports?.[n] || net.devices[id].ifaces?.[n] || {}; return { speed: c.speed ?? null, duplex: c.duplex ?? null, cap: n.startsWith('g') ? 1000 : 100 }; };
  const me = side(devId, port), l = linkAt(net, devId, port);
  if (!l) return { speed: me.speed ?? me.cap, duplex: me.duplex ?? 'full', autoSpeed: !me.speed, autoDuplex: !me.duplex, mismatch: false, down: false };
  const pe = peerOf(l, devId, port), o = side(pe.dev, pe.port);
  if (!sfpOk(net.devices[devId].ports?.[port], net.devices[pe.dev].ports?.[pe.port])) return { speed: me.cap, duplex: 'full', autoSpeed: !me.speed, autoDuplex: !me.duplex, mismatch: false, down: true };
  const speed = me.speed ?? o.speed ?? Math.min(me.cap, o.cap), neg = !(me.speed && me.duplex) && !(o.speed && o.duplex);
  const dup = (x, y) => x.duplex ?? (neg ? y.duplex ?? 'full' : speed >= 1000 ? 'full' : 'half');
  const duplex = dup(me, o);
  return { speed, duplex, autoSpeed: !me.speed, autoDuplex: !me.duplex, mismatch: duplex !== dup(o, me), down: (!!me.speed && !!o.speed && me.speed !== o.speed) || speed > Math.min(me.cap, o.cap) };
}
/** Up/up: thêm tầng 2 — serial 2 đầu phải cùng đóng gói (HDLC/PPP) — cột "Protocol". */
export function lineUp(net, devId, port) {
  if (!statusUp(net, devId, port)) return false;
  const d = net.devices[devId];
  if (d.type === 'router' && port.startsWith('s')) {
    const l = linkAt(net, devId, port);
    if (!l) return true;
    const p = peerOf(l, devId, port);
    const d2 = net.devices[p.dev];
    const f1 = d.ifaces[port], f2 = d2.ifaces?.[p.port];
    if (d2.type === 'router' && f2) {
      if ((f1.l2enc || 'hdlc') !== (f2.l2enc || 'hdlc')) return false;
      if (f1.l2enc === 'ppp' && !pppAuthOk(d, f1, d2, f2)) return false;
    }
  }
  return true;
}
/**
 * PPP CHAP/PAP: bên nào bật "ppp authentication" thì đòi bên kia chứng minh mật khẩu chung.
 * CHAP: mỗi router cần "username <hostname-bên-kia> password <X>" và X hai bên phải GIỐNG nhau.
 */
function pppAuthOk(d1, f1, d2, f2) {
  if (!f1.pppAuth && !f2.pppAuth) return true;
  const u1 = d1.users[d2.name], u2 = d2.users[d1.name];
  return !!u1 && !!u2 && u1.pw === u2.pw;
}
const CH_OK = { on: ['on'], active: ['active', 'passive'], passive: ['active'], desirable: ['desirable', 'auto'], auto: ['desirable'] };
/** Thông tin bundle của 1 cổng switch: { po, formed, proto } hoặc null. */
export function bundleOf(net, d, p) {
  const c = d.ports[p];
  if (!c || c.group == null) return null;
  const po = 'po' + c.group;
  const l = linkAt(net, d.id, p);
  let formed = false;
  if (l && lineUp(net, d.id, p)) {
    const pe = peerOf(l, d.id, p);
    const pd = net.devices[pe.dev];
    const pc2 = pd.type === 'switch' ? pd.ports[pe.port] : null;
    if (pc2 && pc2.group != null) formed = (CH_OK[c.chMode] || []).includes(pc2.chMode);
  }
  const proto = ['active', 'passive'].includes(c.chMode) ? 'LACP' : ['desirable', 'auto'].includes(c.chMode) ? 'PAgP' : '-';
  return { po, formed, proto };
}
/** DTP: chế độ hoạt động thực tế của cổng (access/trunk) sau khi thương lượng với đầu kia. */
export function operMode(net, d, p, c) {
  if (c.modeSet) return c.mode;
  const l = linkAt(net, d.id, p);
  if (!l) return 'access';
  const pe = peerOf(l, d.id, p);
  const pd = net.devices[pe.dev];
  if (pd.type !== 'switch') return 'access';
  const pc2 = pd.ports[pe.port];
  if (!pc2) return 'access';
  const peer = pc2.modeSet ? pc2.mode : (pc2.dyn || 'auto');
  const mine = c.dyn || 'auto';
  if (peer === 'access' || peer === 'private-vlan') return 'access';
  if (peer === 'trunk') return pc2.nonegotiate ? 'access' : 'trunk';
  return mine === 'desirable' || peer === 'desirable' ? 'trunk' : 'access';
}
/** Cấu hình hiệu lực của cổng (thành viên bundle dùng cấu hình Port-channel; DTP đã thương lượng). */
export function effPort(net, d, p) {
  const c = d.ports[p];
  const b = bundleOf(net, d, p);
  if (b && b.formed && d.ports[b.po]) {
    const po = d.ports[b.po];
    return { ...po, mode: po.modeSet ? po.mode : 'access', shutdown: po.shutdown || c.shutdown, bundle: b.po };
  }
  return { ...c, mode: operMode(net, d, p, c), bundle: null };
}
export function allowedHas(e, v) { return e.allowed == null ? v >= 1 && v <= 4094 : e.allowed.includes(v); }
/** Cổng PVLAN có mang VLAN v không (host: primary + community của mình; promiscuous: primary + mapping). */
function pvCarries(d, pv, v) {
  if (!pv) return false;
  if (pv.mode === 'promiscuous') return v === pv.primary || (pv.mapping || []).includes(v);
  return v === pv.primary || (v === pv.secondary && d.pvlan[pv.secondary]?.type === 'community');
}
export function portCarries(net, d, p, v) {
  const e = effPort(net, d, p);
  if (e.mode === 'private-vlan') return pvCarries(d, e.pv, v);
  return e.mode === 'access' ? e.vlan === v || e.voiceVlan === v : allowedHas(e, v);
}

/** Interface L3 (router: cổng/subif/loopback; switch: SVI) có up/up không. */
export function ifUp(net, devId, ifn) {
  const d = net.devices[devId];
  if (!d || d.off) return false;
  if (d.type === 'pc' || d.type === 'server') return true;
  if (d.type === 'switch') {
    const s = d.svis[ifn];
    if (!s || s.shutdown) return false;
    const v = +ifn.slice(4);
    if (!d.vlans[v]) return false;
    return Object.keys(d.ports).some((p) => !p.startsWith('po') && lineUp(net, devId, p) && portCarries(net, d, p, v));
  }
  const f = d.ifaces[ifn];
  if (!f) return false;
  if (ifn.startsWith('tu')) return tunnelUp(net, d, ifn);
  if (ifn.includes('.')) return !f.shutdown && f.encap != null && lineUp(net, devId, ifn.split('.')[0]);
  return lineUp(net, devId, ifn);
}

// ---------- GRE tunnel ----------
/** IP nguồn của tunnel ("tunnel source" là tên cổng hoặc IP). */
export function tunnelSrcIp(d, f) {
  if (!f.tunSrc) return null;
  if (isIp(f.tunSrc)) return f.tunSrc;
  return d.ifaces[f.tunSrc]?.ip || null;
}
/** Underlay có đường tới IP đích không — chỉ xét connected + static qua cổng thật (tránh đệ quy qua tunnel). */
function underlayOk(net, d, dst) {
  const conn = Object.entries(d.ifaces).filter(([n, f]) => !n.startsWith('tu') && f.ip && ifUp(net, d.id, n));
  if (conn.some(([, f]) => inNet(dst, f.ip, f.prefix))) return true;
  return d.routes.some((r) => inNet(dst, r.net, r.prefix) && (r.iface ? !r.iface.startsWith('tu') && ifUp(net, d.id, r.iface) : conn.some(([, f]) => inNet(r.nh, f.ip, f.prefix))));
}
/** Tunnel up/up khi: không shutdown, có source (cổng up) + destination, và underlay tới được destination. */
export function tunnelUp(net, d, ifn) {
  const f = d.ifaces[ifn];
  if (!f || f.shutdown || (!f.tunDst && f.tunMode !== 'mgre')) return false;
  const src = tunnelSrcIp(d, f);
  if (!src) return false;
  const srcIf = isIp(f.tunSrc) ? Object.keys(d.ifaces).find((n) => d.ifaces[n].ip === src) : f.tunSrc;
  if (!srcIf || srcIf.startsWith('tu') || !ifUp(net, d.id, srcIf)) return false;
  return f.tunMode === 'mgre' || underlayOk(net, d, f.tunDst);
}
/** tunnel protection ipsec: hai đầu phải cùng bật, cùng transform-set, cùng khóa ISAKMP (theo IP đối phương hoặc 0.0.0.0). */
function tunIpsecOk(a, fa, b, fb) {
  if (!fa.tunProtect && !fb.tunProtect) return true;
  if (!fa.tunProtect || !fb.tunProtect) return false;
  const ts = (d, f) => d.crypto.tsets[d.crypto.profiles?.[f.tunProtect]?.tset];
  const key = (d, f, o) => d.crypto.keys[tunnelSrcIp(o, f)] ?? d.crypto.keys['0.0.0.0'];
  const ta = ts(a, fa), tb = ts(b, fb);
  return !!ta && !!tb && ta.join() === tb.join() && Object.keys(a.crypto.isakmp).length > 0 && Object.keys(b.crypto.isakmp).length > 0 && key(a, fb, b) != null && key(a, fb, b) === key(b, fa, a);
}
/** Spoke đã đăng ký NHRP với hub: khai đúng NHS, map đúng NBMA, cùng tunnel key và mật khẩu NHRP, underlay tới được hub. */
export function nhrpSpokes(net, hub, hubIf) {
  const h = hub.ifaces[hubIf], nbma = tunnelSrcIp(hub, h), out = [];
  if (h.tunMode !== 'mgre' || h.nhrp?.id == null || !nbma) return out;
  for (const P of Object.values(net.devices)) {
    if (P.type !== 'router' || P.id === hub.id) continue;
    for (const [n, g] of Object.entries(P.ifaces)) {
      if (!n.startsWith('tu') || !g.ip || g.nhrp?.id == null || !g.nhrp.nhs?.includes(h.ip) || !tunnelUp(net, P, n)) continue;
      if ((g.nhrp.map?.[h.ip] ?? g.tunDst) !== nbma || (g.tunKey ?? null) !== (h.tunKey ?? null) || (g.nhrp.auth ?? null) !== (h.nhrp.auth ?? null) || !underlayOk(net, P, nbma) || !tunIpsecOk(P, g, hub, h)) continue;
      out.push({ dev: P.id, ifn: n, ip: g.ip, nbma: tunnelSrcIp(P, g), mgre: g.tunMode === 'mgre' });
    }
  }
  return out;
}
const tunAt = (net, ip) => { for (const P of Object.values(net.devices)) if (P.type === 'router') for (const [n, g] of Object.entries(P.ifaces)) if (n.startsWith('tu') && g.ip === ip && tunnelUp(net, P, n)) return { P, n, g }; return null; };
/** Đổi IP tunnel kế tiếp thành đầu mGRE/GRE thật: cache shortcut (pha 3), map tĩnh, bảng đăng ký hub, hoặc hỏi NHS (pha 2). */
export function nhrpResolve(net, d, ifn, nh, dst) {
  const f = d.ifaces[ifn];
  for (const e of d.nhrpCache || []) {
    if (e.ifn === ifn && inNet(dst, e.net, e.prefix) && net.devices[e.peer] && tunnelUp(net, net.devices[e.peer], e.peerIf)) return { dev: e.peer, ifn: e.peerIf, nbma: e.nbma, ip: e.ip };
  }
  const t = tunAt(net, nh);
  if (!t || t.P.id === d.id) return null;
  const peer = { dev: t.P.id, ifn: t.n, nbma: tunnelSrcIp(t.P, t.g), ip: nh };
  if (f.nhrp?.map?.[nh] === peer.nbma && t.g.tunMode === 'mgre') return tunIpsecOk(d, f, t.P, t.g) ? peer : null;
  if (nhrpSpokes(net, d, ifn).some((s) => s.dev === t.P.id)) return peer;
  // spoke hỏi NHS: đối phương phải đăng ký cùng hub và cũng là mGRE thì mới đi thẳng được
  for (const hubIp of f.nhrp?.nhs || []) {
    const h = tunAt(net, hubIp);
    if (!h) continue;
    const reg = nhrpSpokes(net, h.P, h.n);
    if (reg.some((s) => s.dev === d.id) && reg.some((s) => s.dev === t.P.id && s.mgre) && tunIpsecOk(d, f, t.P, t.g)) return peer;
  }
  return null;
}
/** Đầu kia của tunnel: router có tunnel với source/destination đối xứng. */
export function tunnelPeer(net, d, ifn) {
  const f = d.ifaces[ifn];
  const src = tunnelSrcIp(d, f);
  for (const P of Object.values(net.devices)) {
    if (P.type !== 'router' || P.id === d.id) continue;
    for (const [n, g] of Object.entries(P.ifaces)) {
      if (!n.startsWith('tu') || tunnelSrcIp(P, g) !== f.tunDst) continue;
      if (g.tunMode === 'mgre') { if (nhrpSpokes(net, P, n).some((s) => s.dev === d.id && s.ifn === ifn)) return { dev: P.id, ifn: n }; continue; }
      if (g.tunDst !== src || !tunIpsecOk(d, f, P, g)) continue;
      if (tunnelUp(net, P, n)) return { dev: P.id, ifn: n };
    }
  }
  return null;
}

/**
 * Phát 1 frame broadcast từ endpoint L3 `src` ({dev, ifn}) và theo nó đi qua các switch
 * đúng luật VLAN/trunk/PVLAN/port-security. Trả Map 'dev|ifn' -> { dev, ifn, hops } của mọi
 * endpoint L3 nhận được (hops = các chặng dây, kèm tag 802.1Q). `diag` ghi lý do frame bị bỏ.
 */
export function flood(net, src, diag) {
  const out = new Map();
  const q = [];
  const seen = new Set();
  const note = (s) => { if (diag && !diag.includes(s)) diag.push(s); };
  const srcMac = epMac(net, src);
  const blocked = stpBlockedFn(net);
  const add = (dev, ifn, hops) => {
    const k = dev + '|' + ifn;
    if (dev === src.dev && ifn === src.ifn) return;
    if (!out.has(k)) out.set(k, { dev, ifn, hops });
  };
  const sendOut = (fromDev, port, tag, hops, vlan) => {
    const l = linkAt(net, fromDev, port);
    if (!l) return;
    const pe = peerOf(l, fromDev, port);
    q.push({ k: 'arr', dev: pe.dev, port: pe.port, tag, hops: hops.concat([{ from: fromDev, to: pe.dev, link: l.id, tag, vlan, fromPort: port, toPort: pe.port }]) });
  };

  const d0 = net.devices[src.dev];
  // Điện thoại IP: cổng fa0 ra switch (thoại gắn thẻ voice VLAN), cổng pc0 nối PC phía sau (dữ liệu không gắn thẻ)
  const voiceOf = (id) => { const l = linkAt(net, id, 'fa0'); return l ? net.devices[peerOf(l, id, 'fa0').dev].ports?.[peerOf(l, id, 'fa0').port]?.voiceVlan ?? null : null; };
  if (d0.phone && !statusUp(net, src.dev, 'fa0')) { note(`${d0.name} chưa có nguồn (cổng switch tắt PoE)`); return out; }
  if (d0.type === 'pc' || d0.type === 'server') sendOut(src.dev, 'fa0', d0.phone ? voiceOf(src.dev) : null, [], null);
  else if (d0.type === 'router') {
    if (!ifUp(net, src.dev, src.ifn)) { note(`${d0.name} ${longIf(src.ifn)} chưa up (shutdown/chưa cắm dây/chưa encapsulation/lệch đóng gói serial)`); return out; }
    const f = d0.ifaces[src.ifn];
    if (src.ifn.startsWith('tu')) {
      // tunnel = đường ảo điểm-điểm: "nhìn thấy" đúng router ở đầu kia (frame thật đi trong GRE)
      if (f.tunMode === 'mgre') {
        // mGRE: hub gửi multicast cho spoke đã đăng ký ("map multicast dynamic"), spoke gửi cho NHS đã map multicast
        if (f.nhrp?.mcastDyn) for (const s of nhrpSpokes(net, d0, src.ifn)) add(s.dev, s.ifn, []);
        for (const ip of f.nhrp?.nhs || []) {
          const h = tunAt(net, ip);
          if (h && f.nhrp.mcast?.includes(tunnelSrcIp(h.P, h.g)) && nhrpSpokes(net, h.P, h.n).some((s) => s.dev === src.dev && s.ifn === src.ifn)) add(h.P.id, h.n, []);
        }
        return out;
      }
      const p = tunnelPeer(net, d0, src.ifn);
      if (p) add(p.dev, p.ifn, []);
      return out;
    }
    if (src.ifn.includes('.')) sendOut(src.dev, src.ifn.split('.')[0], f.native ? null : f.encap, [], f.encap);
    else if (!src.ifn.startsWith('lo')) sendOut(src.dev, src.ifn, null, [], null);
  } else if (d0.type === 'switch') {
    q.push({ k: 'sw', dev: src.dev, vlan: +src.ifn.slice(4), inPort: null, inBundle: null, hops: [] });
  }

  while (q.length) {
    const it = q.shift();
    const d = net.devices[it.dev];
    if (it.k === 'arr') {
      if (!physAdminUp(net, it.dev, it.port)) { note(d.off ? `${d.name} đang TẮT (Stop) — thiết bị chưa được Start nên mọi cổng down` : `${d.name} ${longIf(it.port)} đang ${d.type === 'switch' && errDisabled(net, d, it.port) ? 'ERR-DISABLED' : 'shutdown'}`); continue; }
      if (d.phone) {
        if (!statusUp(net, it.dev, 'fa0')) { note(`${d.name} chưa có nguồn (cổng switch tắt PoE)`); continue; }
        if (it.port === 'pc0') { sendOut(it.dev, 'fa0', null, it.hops, null); continue; }
        if (it.tag != null || !voiceOf(it.dev)) add(it.dev, 'fa0', it.hops);
        if (it.tag == null) sendOut(it.dev, 'pc0', null, it.hops, null);
        continue;
      }
      if (d.type === 'pc' || d.type === 'server') {
        if (it.tag == null) add(it.dev, 'fa0', it.hops);
        else note(`${d.name} nhận frame có tag VLAN ${it.tag} (máy trạm không hiểu 802.1Q) → bỏ`);
        continue;
      }
      if (d.type === 'router') {
        if (it.tag == null) {
          const fi = d.ifaces[it.port];
          if (fi?.ip || fi?.ipv6?.length || fi?.ipv6Enable) add(it.dev, it.port, it.hops);
          for (const [n, f] of Object.entries(d.ifaces)) if (n.startsWith(it.port + '.') && f.native && f.encap != null && !f.shutdown) add(it.dev, n, it.hops);
        } else {
          const sub = Object.entries(d.ifaces).find(([n, f]) => n.startsWith(it.port + '.') && f.encap === it.tag && !f.native);
          if (sub && !sub[1].shutdown) add(it.dev, sub[0], it.hops);
          else note(`${d.name} không có subinterface "encapsulation dot1Q ${it.tag}" trên ${longIf(it.port)} → bỏ frame VLAN ${it.tag}`);
        }
        continue;
      }
      // ---- switch ----
      const c = d.ports[it.port];
      // Port-security: MAC lạ vượt "maximum" → vi phạm
      if (c.ps && c.ps.enabled && !c.ps.macs.includes(srcMac) && c.ps.macs.length >= (c.ps.max || 1)) {
        if (RECORDING) { c.ps.viol = (c.ps.viol || 0) + 1; if (c.ps.violation === 'shutdown') c.errdis = true; }
        note(`${d.name} ${longIf(it.port)}: PORT-SECURITY vi phạm — MAC ${ciscoMac(srcMac)} vượt quá maximum ${c.ps.max} (violation ${c.ps.violation}${c.ps.violation === 'shutdown' ? ' → cổng chuyển err-disabled' : ' → frame bị bỏ'})`);
        continue;
      }
      const e = effPort(net, d, it.port);
      if (e.shutdown) { note(`${d.name} ${longIf(it.port)} đang shutdown`); continue; }
      let vlan;
      if (e.mode === 'private-vlan') {
        const pv = e.pv;
        if (!pv || !pv.primary) { note(`${d.name} ${longIf(it.port)}: cổng private-vlan chưa association/mapping → bỏ`); continue; }
        if (pv.mode === 'host') {
          const ok = d.pvlan[pv.primary]?.type === 'primary' && (d.pvlan[pv.primary].assoc || []).includes(pv.secondary) && ['isolated', 'community'].includes(d.pvlan[pv.secondary]?.type);
          if (!ok) { note(`${d.name}: private-vlan ${pv.primary}/${pv.secondary} chưa khai báo primary/secondary/association đúng → cổng ${longIf(it.port)} không hoạt động`); continue; }
          vlan = pv.secondary;
        } else vlan = pv.primary;
      } else if (e.mode === 'access') {
        if (it.tag != null && it.tag !== e.voiceVlan) { note(`${d.name} ${longIf(it.port)} là cổng ACCESS nhưng nhận frame gắn tag VLAN ${it.tag} (đầu kia đang trunk?) → bỏ`); continue; }
        vlan = it.tag ?? e.vlan;
      } else {
        vlan = it.tag ?? e.native;
        if (!allowedHas(e, vlan)) { note(`${d.name} trunk ${longIf(e.bundle || it.port)} không cho phép VLAN ${vlan} (allowed vlan) → bỏ frame`); continue; }
      }
      if (!d.vlans[vlan]) { note(`${d.name}: VLAN ${vlan} không tồn tại trong VLAN database → bỏ frame`); continue; }
      const bst = blocked(it.dev, it.port, vlan);
      if (bst) {
        note(bst === 'BLK' ? `${d.name} ${longIf(e.bundle || it.port)} đang STP BLOCKING cho VLAN ${vlan} → bỏ frame (chống vòng lặp)`
          : `${d.name} ${longIf(e.bundle || it.port)} đang STP ${bst === 'LSN' ? 'LISTENING' : 'LEARNING'} cho VLAN ${vlan} (cổng vừa lên, STP cần ~30 s mới chuyển forwarding — bật PortFast cho cổng nối máy trạm, hoặc bấm ⚡ Hội tụ ngay) → chưa chuyển frame`);
        continue;
      }
      q.push({ k: 'sw', dev: it.dev, vlan, inPort: it.port, inBundle: e.bundle, hops: it.hops });
    } else {
      const key = it.dev + '#' + it.vlan;
      if (seen.has(key)) continue;
      seen.add(key);
      // VLAN thứ cấp của PVLAN → SVI/gateway nằm ở VLAN primary
      const pvPrim = Object.entries(d.pvlan || {}).find(([, x]) => x.type === 'primary' && (x.assoc || []).includes(it.vlan));
      const sviVlan = pvPrim ? +pvPrim[0] : it.vlan;
      const svi = 'vlan' + sviVlan;
      if (d.svis[svi] && d.svis[svi].ip && !d.svis[svi].shutdown) add(it.dev, svi, it.hops);
      const used = new Set(it.inBundle ? [it.inBundle] : []);
      const inProt = it.inPort != null && d.ports[it.inPort]?.protected;
      for (const p of Object.keys(d.ports).sort(ifSort)) {
        if (p.startsWith('po') || p === it.inPort) continue;
        const e = effPort(net, d, p);
        if (e.bundle && used.has(e.bundle)) continue;
        if (e.shutdown || !lineUp(net, it.dev, p)) continue;
        if (inProt && d.ports[p].protected) continue; // Protected Port: 2 cổng protected không nói chuyện trực tiếp
        if (e.mode !== 'private-vlan' && blocked(it.dev, p, it.vlan)) continue; // STP: không gửi ra cổng BLOCKING
        let tag;
        if (e.mode === 'private-vlan') {
          if (!pvCarries(d, e.pv, it.vlan)) continue;
          // host isolated/community nhận frame từ promiscuous (primary) hoặc cùng community
          if (e.pv.mode === 'host' && it.vlan !== e.pv.primary && it.vlan !== e.pv.secondary) continue;
          tag = null;
        } else if (e.mode === 'access') {
          if (e.vlan !== it.vlan && e.voiceVlan !== it.vlan) continue;
          tag = e.vlan === it.vlan ? null : it.vlan;
        }
        else {
          if (!allowedHas(e, it.vlan)) { note(`${d.name} trunk ${longIf(e.bundle || p)} không cho phép VLAN ${it.vlan} (allowed vlan) → không chuyển frame ra cổng này`); continue; }
          tag = it.vlan === e.native ? null : it.vlan;
        }
        if (e.bundle) used.add(e.bundle);
        sendOut(it.dev, p, tag, it.hops, it.vlan);
      }
    }
  }
  return out;
}

// ======================================================================
// Endpoint L3 & FHRP (HSRP/VRRP)
// ======================================================================
export function epIp(net, ep) {
  const d = net.devices[ep.dev];
  if (d.type === 'pc' || d.type === 'server') return d.ip || null;
  return l3ifs(d)[ep.ifn]?.ip || null;
}
/** Thông tin "máy trạm" của PC/server/switch L2 (switch dùng SVI quản lý + ip default-gateway). */
function hostInfo(net, d) {
  if (d.type === 'pc' || d.type === 'server') return { ifn: 'fa0', ip: d.ip, prefix: d.prefix, gw: d.gateway };
  const svi = Object.keys(d.svis).find((n) => d.svis[n].ip && ifUp(net, d.id, n));
  if (!svi) return { ifn: null, ip: null };
  return { ifn: svi, ip: d.svis[svi].ip, prefix: d.svis[svi].prefix, gw: d.defaultGateway };
}

/** Priority hiệu lực của HSRP (trừ điểm khi cổng được track bị down). */
function hsrpPri(net, d, s) {
  let p = s.priority ?? 100;
  for (const t of s.track || []) if (t.obj != null ? !trackUp(net, d, t.obj) : !ifUp(net, d.id, t.ifn)) p -= t.dec ?? 10;
  return p;
}
/** Thiết bị cấu hình theo mô hình riêng của hãng hoặc trang web, không theo lệnh IOS (ASA vẫn tính là kiểu IOS). */
export const isVendorOs = (d) => !!d.os && d.os !== 'asa';

/**
 * Bầu Active/Master cho các nhóm FHRP trong 1 miền L2.
 * "Incumbent" = router thắng theo priority cấu hình lúc khởi động; router khác chỉ giành quyền
 * khi có priority hiệu lực CAO HƠN và bật preempt (VRRP mặc định preempt) — đúng như thực tế.
 */
export function fhrpActives(net, members) {
  const groups = {};
  for (const m of members) {
    const d = net.devices[m.dev];
    if (!d || !isL3(d)) continue;
    const f = l3ifs(d)[m.ifn];
    if (!f || !f.ip || !ifUp(net, m.dev, m.ifn)) continue;
    // ⏱ thành viên mới: HSRP Listen → Speak (hết hold time 10 s) mới được bầu; VRRP Backup 3 s
    const ready = (proto, g) => !phaseOf(net, fhrpKey(m, proto, g), proto, { dev: m.dev, ifn: m.ifn, proto, group: g });
    for (const [g, s] of Object.entries(f.standby || {})) {
      if (!s.ip || !ready('hsrp', g)) continue;
      (groups['h' + g] ||= []).push({ proto: 'hsrp', group: g, ep: m, cfg: s.priority ?? 100, pri: hsrpPri(net, d, s), preempt: !!s.preempt, vip: s.ip, ipn: ip2n(f.ip) });
    }
    for (const [g, s] of Object.entries(f.vrrp || {})) {
      if (!s.ip || !ready('vrrp', g)) continue;
      const own = s.ip === f.ip;
      const pr = own ? 255 : s.priority ?? 100;
      (groups['v' + g] ||= []).push({ proto: 'vrrp', group: g, ep: m, cfg: pr, pri: pr, preempt: s.preempt !== false, vip: s.ip, ipn: ip2n(f.ip), owner: own });
    }
  }
  const act = [];
  for (const list of Object.values(groups)) {
    const byCfg = [...list].sort((a, b) => b.cfg - a.cfg || b.ipn - a.ipn);
    const byEff = [...list].sort((a, b) => b.pri - a.pri || b.ipn - a.ipn);
    let win = byCfg[0];
    const challenger = byEff[0];
    if (challenger !== win && challenger.pri > win.pri && challenger.preempt) win = challenger;
    const rest = byEff.filter((x) => x !== win);
    act.push({ proto: win.proto, group: win.group, ep: win.ep, vip: win.vip, list: [win, ...rest] });
    // ghi vai trò để đồng hồ báo log khi đổi (Standby -> Active khi failover / preempt)
    if (net.clock?.seen) [win, ...rest].forEach((x, i) => noteMeta(net, fhrpKey(x.ep, x.proto, x.group), { role: x.proto === 'vrrp' ? (i ? 'Backup' : 'Master') : i === 0 ? 'Active' : i === 1 ? 'Standby' : 'Listen' }));
  }
  return act;
}
const fhrpKey = (m, proto, g) => `fhrp|${m.dev}|${m.ifn}|${proto}|${g}`;
/** Pha hội tụ của 1 nhóm FHRP trên cổng (Listen/Speak/Backup) hoặc null — cho show standby / vrrp. */
export const fhrpPhase = (net, dev, ifn, proto, g) => peekPhase(net, fhrpKey({ dev, ifn }, proto, g), proto);
/** Thành viên FHRP cùng miền L2 với 1 interface (để show standby / vrrp / bầu chọn). */
export function hsrpView(net, devId, ifn) {
  const reach = flood(net, { dev: devId, ifn });
  const members = [...reach.values(), { dev: devId, ifn, hops: [] }];
  return fhrpActives(net, members);
}

/** ARP: tìm endpoint mang IP `ip` trong miền quảng bá của `src`. */
export function resolve(net, src, ip) {
  const diag = [];
  const reach = flood(net, src, diag);
  for (const r of reach.values()) {
    if (epIp(net, r) === ip && ifUp(net, r.dev, r.ifn)) return { ep: r, mac: epMac(net, r), hops: r.hops };
  }
  const members = [...reach.values(), { ...src, hops: [] }];
  for (const a of fhrpActives(net, members)) {
    if (a.vip === ip && !(a.ep.dev === src.dev && a.ep.ifn === src.ifn)) {
      const r = reach.get(a.ep.dev + '|' + a.ep.ifn);
      return { ep: r, mac: a.proto === 'vrrp' ? vrrpMac(a.group) : hsrpMac(a.group), hops: r.hops, fhrp: a.proto, hsrp: a.group };
    }
  }
  // Router trả ARP thay cho địa chỉ global của NAT tĩnh / NAT pool nằm trong subnet cổng outside
  for (const r of reach.values()) {
    const d = net.devices[r.dev];
    if (d.type !== 'router') continue;
    const f = d.ifaces[r.ifn];
    if (f?.nat !== 'outside' || !f.ip || !inNet(ip, f.ip, f.prefix)) continue;
    if (d.nat.statics.some((s) => s.global === ip) || Object.values(d.nat.pools || {}).some((p) => poolAddrs(p).includes(ip))) return { ep: r, mac: epMac(net, r), hops: r.hops };
  }
  // Proxy-ARP: router trả lời thay cho IP ở mạng KHÁC mà nó có route qua cổng khác
  const ctx = makeCtx(net);
  for (const r of reach.values()) {
    const d = net.devices[r.dev];
    if (!isL3(d)) continue;
    const f = l3ifs(d)[r.ifn];
    if (!f?.ip || f.proxyArp === false || inNet(ip, f.ip, f.prefix)) continue;
    const rt = lookup(ctx, d.id, ip);
    if (rt && rt.iface !== r.ifn) return { ep: r, mac: epMac(net, r), hops: r.hops, proxy: true };
  }
  if (!reach.size && !diag.length) diag.push('Không có thiết bị nào nhận được frame (chưa cắm dây/cổng down)');
  return { fail: true, diag };
}

// ======================================================================
// Định tuyến: connected + static + OSPF + EIGRP
// ======================================================================
export function makeCtx(net, record = false) {
  return { net, record, base: {}, full: {}, ospf: null, eigrp: null, nat: [], arpc: {}, firstArp: false };
}

export function baseRoutes(ctx, rid, vrf = null) {
  const key = rid + '|' + (vrf || '');
  if (ctx.base[key]) return ctx.base[key];
  const net = ctx.net, r = net.devices[rid], out = [];
  if (!isL3(r)) return (ctx.base[key] = out);
  for (const [n, f] of Object.entries(l3ifs(r))) {
    if ((f.vrf || null) !== vrf || !f.ip || !ifUp(net, rid, n)) continue;
    out.push({ code: 'C', net: netOf(f.ip, f.prefix), prefix: f.prefix, ad: 0, metric: 0, iface: n });
    out.push({ code: 'L', net: f.ip, prefix: 32, ad: 0, metric: 0, iface: n });
  }
  const conn = out.filter((x) => x.code === 'C');
  for (const s of r.routes) {
    if ((s.vrf || null) !== vrf || (s.track != null && !trackUp(net, r, s.track))) continue;
    if (s.discard) { out.push({ code: s.prefix === 0 ? 'S*' : 'S', net: s.net, prefix: s.prefix, ad: s.ad ?? 1, metric: 0, iface: 'null0', discard: true }); continue; }
    let iface = s.iface || null;
    const nh = s.nh || null;
    if (iface) {
      if (!ifUp(net, rid, iface)) continue;
      if (nh && !conn.some((x) => x.iface === iface && inNet(nh, x.net, x.prefix))) continue;
    } else {
      const c = conn.find((x) => inNet(nh, x.net, x.prefix));
      if (!c) continue;
      iface = c.iface;
    }
    out.push({ code: s.prefix === 0 ? 'S*' : 'S', net: s.net, prefix: s.prefix, ad: s.ad ?? 1, metric: 0, nextHop: nh, iface });
  }
  return (ctx.base[key] = out);
}

export function routeTable(ctx, rid, vrf = null) {
  const key = rid + '|' + (vrf || '');
  if (ctx.full[key]) return ctx.full[key];
  const o = ospfAll(ctx), d = ctx.net.devices[rid], same = (p) => (p?.vrf || null) === vrf;
  const dyn = [...(same(d.ospf) ? o.routes[rid] || [] : []), ...(same(d.eigrp) ? [...(eigrpAll(ctx).routes[rid] || []), ...(eigrpExt(ctx)[rid] || [])] : []), ...(same(d.bgp) ? bgpAll(ctx).routes[rid] || [] : [])];
  const all = [...baseRoutes(ctx, rid, vrf), ...dyn.map((r) => ribPolicy(d, r)).filter(Boolean)];
  const best = new Map();
  for (const r of all) {
    const k = r.code === 'L' ? 'L' + r.net : r.net + '/' + r.prefix;
    const b = best.get(k);
    if (!b || r.ad < b.ad || (r.ad === b.ad && r.metric < b.metric)) best.set(k, r);
  }
  const res = [...best.values()].sort((a, b) => ip2n(a.net) - ip2n(b.net) || a.prefix - b.prefix);
  return (ctx.full[key] = res);
}
/** Longest-prefix match. */
export function lookup(ctx, rid, dst, vrf = null) {
  let best = null;
  for (const r of routeTable(ctx, rid, vrf)) if (inNet(dst, r.net, r.prefix) && (!best || r.prefix > best.prefix)) best = r;
  return best;
}

export const timeRangeOn = timeActive;
// ---------- Track, IP SLA ----------
let TRACKING = false;
/** Object track: cổng hoặc IP SLA. SLA ping thật ra mạng. Khi đang đo, route có track coi như up để gói đo đi đúng đường chính. */
export function trackUp(net, d, id) {
  const t = d.tracks?.[id];
  if (!t) return false;
  if (t.ifn) return ifUp(net, d.id, t.ifn);
  if (TRACKING) return true;
  TRACKING = true;
  try { return slaUp(net, d, d.slas?.[t.sla]); } finally { TRACKING = false; }
}
/** Thao tác IP SLA có đo được không. udp-jitter còn cần "ip sla responder" ở đầu kia. */
export function slaUp(net, d, s) {
  if (!s?.target || !s.scheduled) return false;
  const r = sendPacket(net, { src: d.id, dst: s.target });
  return r.ok && (s.type !== 'udp-jitter' || !!net.devices[r.at?.dev]?.slaResponder);
}
export const isPrivAs = (a) => (a >= 64512 && a <= 65534) || (a >= 4200000000 && a <= 4294967294);

// ---------- OSPF ----------
function ospfCost(ifn, f, refMbps) {
  if (f.ospfCost != null) return f.ospfCost;
  const k = kindOf(ifn);
  if (k !== 'lo' && (refMbps != null || f.bw != null)) return Math.max(1, Math.floor(((refMbps ?? 100) * 1000) / ifBw(ifn, f)));
  return k === 's' ? 64 : k === 'e' || f.speed === 10 ? 10 : 1;
}
export function ospfIfaces(ctx, rid) {
  const net = ctx.net, r = net.devices[rid];
  if (!r.ospf || !isL3(r)) return [];
  const res = [];
  for (const [n, f] of Object.entries(l3ifs(r))) {
    if ((f.vrf || null) !== (r.ospf.vrf || null) || !f.ip || !ifUp(net, rid, n)) continue;
    let area = null;
    if (f.ospfPid != null && f.ospfPid === r.ospf.pid) area = f.ospfArea;
    else {
      const st = r.ospf.networks.filter((s) => wildMatch(f.ip, s.net, s.wild)).sort((a, b) => bitCount(ip2n(a.wild)) - bitCount(ip2n(b.wild)))[0];
      if (st) area = st.area;
    }
    if (area == null) continue;
    const passive = r.ospf.passiveDefault ? !r.ospf.noPassive.includes(n) : r.ospf.passive.includes(n);
    // kiểu mạng OSPF: Serial / tunnel mặc định point-to-point, Ethernet mặc định broadcast (đổi bằng "ip ospf network")
    const ntype = f.ospfNet || (kindOf(n) === 's' || n.startsWith('tu') ? 'p2p' : 'broadcast');
    const ac = r.ospf.areas?.[area] || {};
    const authT = f.ospfAuth ?? ac.auth ?? 'null';
    const auth = authT === 'md5' ? `md5:${f.ospfMd5?.id}:${f.ospfMd5?.key}` : authT === 'plain' ? `plain:${f.ospfKey}` : authT === 'chain' ? `chain:${Object.values(r.keyChains?.[f.ospfChain] || {})[0]?.str}` : 'null';
    res.push({ ifn: n, ip: f.ip, prefix: f.prefix, area: String(area), cost: ospfCost(n, f, r.ospf.refBw), passive, hello: f.ospfHello ?? (['p2mp', 'p2mpnb', 'nbma'].includes(ntype) ? 30 : 10), prio: f.ospfPrio ?? 1, ntype, auth, authT, areaType: ac.type || '', mtu: f.ipMtu ?? 1500, mtuIgnore: !!f.ospfMtuIgnore });
  }
  return res;
}
function ospfRid(net, r) {
  if (r.ospf.rid) return r.ospf.rid;
  const ifs = l3ifs(r);
  const lo = Object.entries(ifs).filter(([n, f]) => n.startsWith('lo') && f.ip && !f.shutdown).map(([, f]) => f.ip);
  const pool = lo.length ? lo : Object.entries(ifs).filter(([n, f]) => f.ip && ifUp(net, r.id, n)).map(([, f]) => f.ip);
  return pool.sort((a, b) => ip2n(b) - ip2n(a))[0] || '0.0.0.0';
}
export function ospfAll(ctx) {
  if (ctx.ospf) return ctx.ospf;
  const net = ctx.net;
  const rs = Object.values(net.devices).filter((d) => isL3(d) && d.ospf);
  const en = {}, rid = {}, adj = {}, ads = {}, routes = {}, issues = {};
  ctx.ospf = { en, rid, adj, routes, issues };
  for (const r of rs) { en[r.id] = ospfIfaces(ctx, r.id); rid[r.id] = ospfRid(net, r); issues[r.id] = []; }
  for (const r of rs) {
    adj[r.id] = [];
    for (const e of en[r.id]) {
      if (e.passive) continue;
      const reach = flood(net, { dev: r.id, ifn: e.ifn });
      for (const t of reach.values()) {
        const s = net.devices[t.dev];
        if (!s || !isL3(s) || s.id === r.id || !s.ospf) continue;
        const e2 = (en[s.id] || []).find((x) => x.ifn === t.ifn);
        if (!e2 || e2.passive) continue;
        if (netOf(e.ip, e.prefix) !== netOf(e2.ip, e2.prefix) || e.prefix !== e2.prefix) { issues[r.id].push(`${longIf(e.ifn)}: khác subnet với ${s.name}`); continue; }
        if (e.area !== e2.area) { issues[r.id].push(`${longIf(e.ifn)}: area ${e.area} ≠ area ${e2.area} của ${s.name} (mismatch area)`); continue; }
        if (e.hello !== e2.hello) { issues[r.id].push(`${longIf(e.ifn)}: hello ${e.hello}s ≠ ${e2.hello}s của ${s.name}`); continue; }
        if (rid[s.id] === rid[r.id]) { issues[r.id].push(`Trùng router-id ${rid[r.id]} với ${s.name}`); continue; }
        if (e.areaType !== e2.areaType) { issues[r.id].push(`${longIf(e.ifn)}: cờ stub/NSSA của area ${e.area} lệch với ${s.name}`); continue; }
        if (e.auth !== e2.auth) { issues[r.id].push(`${longIf(e.ifn)}: xác thực OSPF lệch với ${s.name} (${e.authT} ≠ ${e2.authT} hoặc khác key)`); continue; }
        if ((e.ntype === 'nbma' || e.ntype === 'p2mpnb') && !r.ospf.nbrs?.includes(e2.ip) && !s.ospf.nbrs?.includes(e.ip)) { issues[r.id].push(`${longIf(e.ifn)}: non-broadcast không gửi multicast, cần lệnh neighbor ${e2.ip}`); continue; }
        // lệch kiểu mạng (point-to-point ↔ broadcast): hello cùng 10 s nên vẫn lên láng giềng, nhưng LSA hai bên mô tả
        // link khác nhau → SPF không dùng được link này (route bị thiếu) — lỗi kinh điển khi chỉ đổi một đầu
        const mismatch = e.ntype !== e2.ntype;
        if (mismatch) issues[r.id].push(`${longIf(e.ifn)}: network type ${OSPF_NT[e.ntype]} ≠ ${OSPF_NT[e2.ntype]} của ${s.name} → láng giềng lên nhưng không có route qua link này`);
        // lệch MTU: đầu MTU nhỏ từ chối DBD nên kẹt EXSTART, trừ khi chính đầu đó đặt mtu-ignore
        const low = e.mtu < e2.mtu ? e : e2, stuck = e.mtu !== e2.mtu && !low.mtuIgnore;
        if (stuck) issues[r.id].push(`${longIf(e.ifn)}: MTU ${e.mtu} ≠ ${e2.mtu} của ${s.name} → kẹt EXSTART`);
        adj[r.id].push({ to: s.id, cost: e.cost, nh: e2.ip, outIf: e.ifn, theirIf: t.ifn, area: e.area, serial: kindOf(e.ifn) === 's', p2p: ['p2p', 'p2mp', 'p2mpnb'].includes(e.ntype), mismatch: mismatch || stuck, stuck, prio: e2.prio, myPrio: e.prio });
      }
    }
  }
  for (const r of rs) adj[r.id] = adj[r.id].filter((a) => (adj[a.to] || []).some((b) => b.to === r.id));
  // ⏱ láng giềng chưa xong INIT → … → LOADING thì chưa dùng để tính route (adj vẫn giữ để show neighbor)
  const adjUp = {};
  for (const r of rs) adjUp[r.id] = adj[r.id].filter((a) => !a.mismatch && !phaseOf(net, ospfKey(r.id, a), 'ospf', { dev: r.id, ifn: a.outIf, nbr: rid[a.to], pid: r.ospf.pid }));
  for (const s of rs) ads[s.id] = en[s.id].map((e) => ({ net: netOf(e.ip, e.prefix), prefix: e.prefix, cost: e.cost, area: e.area }));
  const spf = {}, intRoutes = {}, myNetsOf = {};
  Object.assign(ctx.ospf, { spf, intRoutes });
  // virtual link nối area xa về area 0: hai đầu cùng cấu hình, cùng có mặt trong area transit, area đó không được là stub
  const vlinks = (ctx.ospf.vlinks = {}), areasOf = {}, areaInfo = {};
  for (const r of rs) {
    areasOf[r.id] = new Set(en[r.id].map((e) => e.area));
    for (const [a, c0] of Object.entries(r.ospf.areas || {})) { const i = (areaInfo[a] ||= {}); if (c0.type) i.type = c0.type; if (c0.noSummary) i.noSummary = true; if (c0.nssaDefault) i.nssaDefault = true; }
  }
  // virtual link thuộc area 0: không khai riêng thì theo xác thực của area 0, và khoá phải đặt trên chính virtual link
  const vlAuth = (o, v) => { const t = v.auth ?? o.areas?.['0']?.auth ?? 'null'; return t === 'md5' ? (v.md5 ? `md5:${v.md5.id}:${v.md5.key}` : null) : t === 'plain' ? (v.key ? `plain:${v.key}` : null) : 'null'; };
  for (const r of rs) {
    vlinks[r.id] = (r.ospf.vlinks || []).map((v) => {
      const s = rs.find((x) => rid[x.id] === v.rid);
      const w = s?.ospf.vlinks?.find((o) => o.rid === rid[r.id] && o.area === v.area);
      const authOk = !!w && vlAuth(r.ospf, v) !== null && vlAuth(r.ospf, v) === vlAuth(s.ospf, w);
      const up = !!s && !areaInfo[v.area]?.type && areasOf[r.id].has(String(v.area)) && areasOf[s.id].has(String(v.area)) && authOk;
      return { rid: v.rid, area: v.area, peer: s?.id || null, up };
    });
  }
  for (const r of rs) if (vlinks[r.id].some((v) => v.up)) areasOf[r.id].add('0');
  const has0 = rs.some((r) => areasOf[r.id].has('0'));
  const attached = (a) => a === '0' || rs.some((x) => areasOf[x.id].has(a) && areasOf[x.id].has('0'));
  // area không chạm area 0 thì không trao đổi route liên vùng, trừ khi mạng không dùng area 0
  const visible = (mine, a) => mine.has(a) || !has0 || (attached(a) && [...mine].some(attached));
  const rangeOf = (a, p) => { for (const s of rs) for (const g of s.ospf.areas?.[a]?.ranges || []) if (areasOf[s.id].has(a) && areasOf[s.id].size > 1 && p.prefix >= g.prefix && netOf(p.net, g.prefix) === g.net) return g; return null; };
  const filteredIA = (a, mine, p) => rs.some((s) => areasOf[s.id].size > 1 && ((s.ospf.areas?.[a]?.flOut && !plEval(s, s.ospf.areas[a].flOut, p.net, p.prefix)) || [...mine].some((m) => s.ospf.areas?.[m]?.flIn && !plEval(s, s.ospf.areas[m].flIn, p.net, p.prefix))));
  // ---- pha 1: route nội bộ OSPF (O / O IA) ----
  for (const r of rs) {
    const dist = { [r.id]: 0 }, first = {}, done = new Set();
    for (;;) {
      let u = null;
      for (const k of Object.keys(dist)) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k;
      if (u === null) break;
      done.add(u);
      for (const a of adjUp[u] || []) {
        const nd = dist[u] + a.cost;
        if (dist[a.to] == null || nd < dist[a.to]) { dist[a.to] = nd; first[a.to] = u === r.id ? { nh: a.nh, outIf: a.outIf } : first[u]; }
      }
    }
    spf[r.id] = { dist, first };
    const myNets = (myNetsOf[r.id] = new Set(Object.entries(l3ifs(r)).filter(([n, f]) => f.ip && ifUp(net, r.id, n)).map(([, f]) => netOf(f.ip, f.prefix) + '/' + f.prefix)));
    const myAreas = areasOf[r.id];
    const best = new Map();
    const stubOnly = myAreas.size > 0 && [...myAreas].every((a) => areaInfo[a]?.type);
    const totally = stubOnly && [...myAreas].every((a) => areaInfo[a].noSummary);
    for (const s of rs) {
      if (s.id === r.id || dist[s.id] == null) continue;
      for (const ad of ads[s.id]) {
        if (!visible(myAreas, ad.area)) continue;
        const inter = !myAreas.has(ad.area);
        if (inter && (totally || filteredIA(ad.area, myAreas, ad))) continue;
        const g = inter ? rangeOf(ad.area, ad) : null;
        if (g?.hide) continue;
        const k = g ? g.net + '/' + g.prefix : ad.net + '/' + ad.prefix;
        if (myNets.has(k)) continue;
        const cost = dist[s.id] + ad.cost;
        const cur = best.get(k);
        // đường trong area luôn thắng đường liên vùng, bất kể cost
        if (!cur || (!inter && cur.code !== 'O') || (inter === (cur.code !== 'O') && cost < cur.metric)) best.set(k, { code: inter ? 'O IA' : 'O', net: g ? g.net : ad.net, prefix: g ? g.prefix : ad.prefix, ad: 110, metric: cost, nextHop: first[s.id].nh, iface: first[s.id].outIf });
      }
    }
    // ABR tự tạo route Null0 cho dải đã tóm tắt để chống lặp
    for (const a of myAreas) if (myAreas.size > 1) for (const g of r.ospf.areas?.[a]?.ranges || []) if (!g.hide && ads[r.id].concat(...rs.map((s) => ads[s.id])).some((p) => p.area === a && p.prefix > g.prefix && netOf(p.net, g.prefix) === g.net)) best.set(g.net + '/' + g.prefix, { code: 'O', net: g.net, prefix: g.prefix, ad: 110, metric: 0, iface: 'null0', discard: true });
    // area stub/NSSA: ABR gần nhất đưa default route vào thay cho route bị cắt
    if (stubOnly && !best.has('0.0.0.0/0')) {
      let abr = null;
      for (const s of rs) if (s.id !== r.id && dist[s.id] != null && areasOf[s.id].has('0') && [...myAreas].some((a) => areasOf[s.id].has(a) && (areaInfo[a].type === 'stub' || areaInfo[a].noSummary || areaInfo[a].nssaDefault)) && (!abr || dist[s.id] < dist[abr.id])) abr = s;
      if (abr) best.set('0.0.0.0/0', { code: 'O*IA', net: '0.0.0.0', prefix: 0, ad: 110, metric: dist[abr.id] + 1, nextHop: first[abr.id].nh, iface: first[abr.id].outIf });
    }
    intRoutes[r.id] = [...best.values()];
    routes[r.id] = [...intRoutes[r.id]];
  }
  // ---- pha 2: route external (redistribute) + default-information originate (O E2 / O*E2) ----
  const ext = {};
  for (const s of rs) ext[s.id] = ospfExternals(ctx, s);
  Object.assign(ctx.ospf, { ads, ext, areasOf, areaInfo, visible, rangeOf, filteredIA });
  for (const r of rs) {
    const { dist, first } = spf[r.id];
    const have = new Set([...myNetsOf[r.id], ...intRoutes[r.id].map((x) => x.net + '/' + x.prefix)]);
    const best = new Map();
    const mine = areasOf[r.id], rStub = mine.size > 0 && [...mine].every((a) => areaInfo[a]?.type);
    for (const s of rs) {
      if (s.id === r.id || dist[s.id] == null) continue;
      const sA = [...areasOf[s.id]];
      if (sA.length && sA.every((a) => areaInfo[a]?.type === 'stub')) continue; // router trong area stub không tạo LSA external
      if (!sA.some((a) => visible(mine, a))) continue;
      const nssa = sA.find((a) => areaInfo[a]?.type === 'nssa' && mine.has(a));
      if (rStub && !nssa) continue;
      for (const e of ext[s.id]) {
        const k = e.def ? '0.0.0.0/0' : e.net + '/' + e.prefix;
        if (have.has(k)) continue;
        const t1 = e.type === 1, m = t1 ? e.metric + dist[s.id] : e.metric;
        const code = (e.def ? 'O*' : 'O ') + (nssa ? 'N' : 'E') + (t1 ? '1' : '2');
        const cur = best.get(k);
        // E1 thắng E2; cùng loại thì metric nhỏ hơn, rồi tới ASBR gần hơn
        if (!cur || (t1 && !cur.t1) || (t1 === cur.t1 && (m < cur.metric || (m === cur.metric && dist[s.id] < cur.fwd)))) best.set(k, { code, t1, net: e.def ? '0.0.0.0' : e.net, prefix: e.def ? 0 : e.prefix, ad: 110, metric: m, fwd: dist[s.id], nextHop: first[s.id].nh, iface: first[s.id].outIf, tag: e.tag });
      }
    }
    routes[r.id].push(...best.values());
  }
  return ctx.ospf;
}
/**
 * LSDB mà router thấy, suy ra từ trạng thái OSPF theo đúng phạm vi tràn của từng loại LSA.
 * Không đổi theo distribute-list vì lệnh đó chỉ chặn route vào RIB, còn LSA vẫn nằm trong database.
 * shortcut: tính lại từ cấu hình chứ không flood từng LSA nên không có tuổi, số thứ tự thật; cần mô phỏng flooding thì tách LSA thành trạng thái riêng.
 */
export function ospfLsdb(ctx, id) {
  const o = ospfAll(ctx), rs = Object.keys(o.en), rid = o.rid;
  const res = { rid: rid[id], areas: [], external: [] };
  const mine = o.areasOf?.[id];
  if (!mine) return res;
  const reach = (x) => o.spf[id]?.dist[x] != null;
  const typeOf = (a) => o.areaInfo[a]?.type || '';
  const asbrs = rs.filter((x) => reach(x) && o.ext[x]?.length);
  for (const a of [...mine].sort((p, q) => +p - +q)) {
    const info = o.areaInfo[a] || {}, inA = rs.filter((x) => reach(x) && o.areasOf[x].has(a));
    const abrs = inA.filter((x) => o.areasOf[x].size > 1);
    const L = { area: a, router: [], network: [], summary: [], asbr: [], nssa: [] };
    for (const x of inA) {
      const links = [];
      for (const e of o.en[x].filter((f) => f.area === a)) {
        const nb = (o.adj[x] || []).filter((n) => n.outIf === e.ifn && !n.stuck);
        const roles = ospfRoles(ctx, x, e.ifn);
        if (!nb.length || e.passive) links.push({ kind: 'stub', id: netOf(e.ip, e.prefix), data: prefixToMask(e.prefix), metric: e.cost });
        else if (roles.dr) links.push({ kind: 'transit', id: roles.dr === x ? e.ip : nb.find((n) => n.to === roles.dr)?.nh, data: e.ip, metric: e.cost });
        else { for (const n of nb) links.push({ kind: 'p2p', id: rid[n.to], data: e.ip, metric: e.cost }); links.push({ kind: 'stub', id: netOf(e.ip, e.prefix), data: prefixToMask(e.prefix), metric: e.cost }); }
        if (nb.length && roles.dr === x) L.network.push({ id: e.ip, adv: rid[x], prefix: e.prefix, attached: [rid[x], ...nb.map((n) => rid[n.to])] });
      }
      L.router.push({ id: rid[x], adv: rid[x], links });
    }
    const sum = new Map();
    const addSum = (k, s) => { const c0 = sum.get(k); if (!c0 || s.metric > c0.metric) sum.set(k, s); };
    for (const s of abrs) {
      if (info.type === 'stub' || info.noSummary) addSum(`0.0.0.0/0|${s}`, { id: '0.0.0.0', adv: rid[s], prefix: 0, metric: 1 });
      if (info.noSummary) continue;
      const here = new Set(rs.flatMap((x) => o.ads[x].filter((p) => p.area === a).map((p) => p.net + '/' + p.prefix)));
      for (const x of rs) for (const p of o.ads[x]) {
        const d0 = o.spf[s].dist[x];
        if (d0 == null || p.area === a || here.has(p.net + '/' + p.prefix) || !o.visible(new Set([a]), p.area) || o.filteredIA(p.area, new Set([a]), p)) continue;
        const g = o.rangeOf(p.area, p);
        if (g?.hide) continue;
        const n0 = g ? g.net : p.net, pl = g ? g.prefix : p.prefix;
        addSum(`${n0}/${pl}|${s}`, { id: n0, adv: rid[s], prefix: pl, metric: d0 + p.cost }); // tóm tắt lấy cost lớn nhất trong các prefix con
      }
    }
    L.summary = [...sum.values()];
    if (!info.type) for (const x of asbrs) if (!o.areasOf[x].has(a) && [...o.areasOf[x]].some((b) => !typeOf(b))) for (const s of abrs) if (s !== x && o.spf[s].dist[x] != null) L.asbr.push({ id: rid[x], adv: rid[s], metric: o.spf[s].dist[x] });
    if (info.type === 'nssa') {
      for (const x of asbrs) if (o.areasOf[x].has(a)) for (const e of o.ext[x]) L.nssa.push({ id: e.def ? '0.0.0.0' : e.net, adv: rid[x], prefix: e.def ? 0 : e.prefix, metric: e.metric, etype: e.type ?? 2, tag: e.tag ?? 0 });
      if (info.nssaDefault) for (const s of abrs) L.nssa.push({ id: '0.0.0.0', adv: rid[s], prefix: 0, metric: 1, etype: 2, tag: 0 });
    }
    res.areas.push(L);
  }
  // Type 5 tràn toàn domain trừ stub, NSSA; route trong NSSA được ABR có router-id cao nhất đổi Type 7 thành Type 5
  if ([...mine].some((a) => !typeOf(a))) for (const x of asbrs) {
    const areas = [...o.areasOf[x]];
    if (areas.length && areas.every((a) => typeOf(a) === 'stub')) continue;
    const n7 = areas.length && areas.every((a) => typeOf(a) === 'nssa');
    const abr = n7 ? rs.filter((y) => o.areasOf[y].size > 1 && areas.some((a) => o.areasOf[y].has(a))).sort((p, q) => ip2n(rid[q]) - ip2n(rid[p]))[0] : x;
    if (!abr) continue;
    for (const e of o.ext[x]) if (!(n7 && e.def)) res.external.push({ id: e.def ? '0.0.0.0' : e.net, adv: rid[abr], prefix: e.def ? 0 : e.prefix, metric: e.metric, etype: e.type ?? 2, tag: e.tag ?? 0 });
  }
  return res;
}
/** Route mà ASBR `s` đưa vào OSPF dưới dạng external (Type-5): redistribute + default-information originate. */
function ospfExternals(ctx, s) {
  const o = s.ospf, out = [];
  const base = baseRoutes(ctx, s.id);
  const own = new Set(ctx.ospf.en[s.id].map((e) => netOf(e.ip, e.prefix) + '/' + e.prefix));
  const seen = new Set();
  const take = (r, cfg) => {
    if (r.prefix === 0 || r.code === 'L') return;
    if (!cfg.subnets && r.prefix > classfulPrefix(r.net)) return; // thiếu "subnets" → chỉ mạng classful
    const k = r.net + '/' + r.prefix;
    if (own.has(k) || seen.has(k)) return;
    const set = cfg.routeMap ? rmEval(s, cfg.routeMap, r, ctx.record) : {};
    if (!set) return;
    seen.add(k);
    out.push({ net: r.net, prefix: r.prefix, metric: set.metric ?? cfg.metric ?? 20, tag: set.tag ?? cfg.tag ?? r.tag, type: set.metricType ?? cfg.metricType ?? 2 });
  };
  for (const [src, cfg] of Object.entries(o.redist || {})) {
    if (src === 'connected') base.filter((r) => r.code === 'C').forEach((r) => take(r, cfg));
    if (src === 'static') base.filter((r) => r.code[0] === 'S').forEach((r) => take(r, cfg));
    if (src === 'eigrp' && s.eigrp && s.eigrp.as === cfg.as) {
      (eigrpAll(ctx).routes[s.id] || []).forEach((r) => take(r, cfg));
      eigrpIfaces(ctx, s.id).forEach((e) => take({ code: 'C', net: netOf(e.ip, e.prefix), prefix: e.prefix }, cfg));
    }
    if (src === 'bgp' && s.bgp && s.bgp.as === cfg.as) (bgpAll(ctx).routes[s.id] || []).forEach((r) => take(r, cfg));
  }
  if (o.defaultOriginate) {
    const hasDef = base.some((x) => x.prefix === 0) || (bgpAll(ctx).routes[s.id] || []).some((x) => x.prefix === 0);
    if (hasDef || o.defaultAlways) out.push({ def: true, metric: 1 });
  }
  // summary-address trên ASBR: thay các route external con bằng một route tóm tắt
  for (const g of o.summaries || []) {
    const kids = out.filter((e) => !e.def && e.prefix > g.prefix && netOf(e.net, g.prefix) === g.net);
    if (!kids.length) continue;
    for (const e of kids) out.splice(out.indexOf(e), 1);
    if (!g.hide) out.push({ net: g.net, prefix: g.prefix, metric: Math.min(...kids.map((e) => e.metric)), type: kids[0].type });
  }
  return out;
}
/** Bầu DR/BDR trên 1 segment: priority cao nhất (0 = không bao giờ làm DR), rồi router-id cao nhất. */
const ospfKey = (rid, a) => `ospf|${rid}|${a.outIf}|${a.to}`;
export function ospfRoles(ctx, rid, ifn) {
  const o = ospfAll(ctx);
  const me = (o.en[rid] || []).find((e) => e.ifn === ifn);
  if (['p2p', 'p2mp', 'p2mpnb'].includes(me?.ntype)) return { dr: null, bdr: null }; // point-to-point: không bầu DR/BDR
  const seg = [{ id: rid, prio: me ? me.prio : 1 }, ...(o.adj[rid] || []).filter((x) => x.outIf === ifn).map((x) => ({ id: x.to, prio: x.prio }))];
  const cand = seg.filter((x) => x.prio > 0).sort((a, b) => b.prio - a.prio || ip2n(o.rid[b.id]) - ip2n(o.rid[a.id]));
  return { dr: cand[0]?.id || null, bdr: cand[1]?.id || null };
}
/** Danh sách láng giềng OSPF của router (để show ip ospf neighbor). */
export function ospfNeighbors(ctx, rid) {
  const o = ospfAll(ctx);
  const net = ctx.net;
  return (o.adj[rid] || []).map((a) => {
    let role = '-', full = true;
    if (!a.p2p) {
      const r = ospfRoles(ctx, rid, a.outIf);
      role = r.dr === a.to ? 'DR' : r.bdr === a.to ? 'BDR' : 'DROTHER';
      // 2 router đều là DROTHER chỉ dừng ở 2-WAY (chỉ trao đổi LSDB với DR/BDR)
      full = role !== 'DROTHER' || r.dr === rid || r.bdr === rid;
    }
    // ⏱ đang hình thành adjacency: INIT → 2WAY → EXSTART → EXCHANGE → LOADING (cặp DROTHER dừng ở 2WAY)
    let ph = phaseOf(net, ospfKey(rid, a), 'ospf', { dev: rid, ifn: a.outIf, nbr: o.rid[a.to], pid: net.devices[rid].ospf.pid, full });
    if (ph && !full && ph !== 'INIT') ph = null;
    const st = a.stuck ? 'EXSTART' : ph || (full ? 'FULL' : '2WAY');
    return { rid: o.rid[a.to], name: net.devices[a.to].name, state: st + '/' + (role === '-' ? ' -' : role), addr: a.nh, iface: a.outIf, dev: a.to, prio: a.prio, role, full: full && !ph && !a.stuck, phase: ph };
  });
}

const OSPF_NT = { p2p: 'POINT_TO_POINT', broadcast: 'BROADCAST', p2mp: 'POINT_TO_MULTIPOINT', p2mpnb: 'POINT_TO_MULTIPOINT_NON_BROADCAST', nbma: 'NON_BROADCAST' };
// ---------- EIGRP ----------
const EBW = { g: 1000000, fa: 100000, e: 10000, s: 1544, lo: 8000000, vlan: 1000000 };
const EDLY = { g: 1, fa: 10, e: 100, s: 2000, lo: 500, vlan: 1 };
function ifBw(ifn, f) { return f.bw ?? EBW[kindOf(ifn)] ?? 100000; }
function ifDly(ifn, f) { return f.dly ?? EDLY[kindOf(ifn)] ?? 10; }
export function eigrpIfaces(ctx, rid) {
  const net = ctx.net, r = net.devices[rid];
  if (!r.eigrp || !isL3(r)) return [];
  const res = [];
  for (const [n, f] of Object.entries(l3ifs(r))) {
    if ((f.vrf || null) !== (r.eigrp.vrf || null) || !f.ip || !ifUp(net, rid, n)) continue;
    const ok = r.eigrp.networks.some((s) => (s.wild ? wildMatch(f.ip, s.net, s.wild) : netOf(f.ip, classfulPrefix(s.net)) === netOf(s.net, classfulPrefix(s.net))));
    if (!ok) continue;
    const af = { ...r.eigrp.afIf?.default, ...r.eigrp.afIf?.[n] }, au = af.auth || f.eigrpAuth, keys = au?.chain ? Object.values(r.keyChains?.[au.chain] || {}).map((k) => k.str).filter(Boolean) : [];
    res.push({ ifn: n, ip: f.ip, prefix: f.prefix, passive: r.eigrp.passive.includes(n) || !!af.passive, bw: ifBw(n, f), dly: ifDly(n, f), authMode: au?.mode || null, keys, sh: f.eigrpNoSH !== true && af.noSH !== true, nhSelf: f.eigrpNoNhs !== true && af.noNhs !== true, summaries: af.summaries || f.eigrpSummaries || [] });
  }
  return res;
}
export function eigrpAll(ctx) {
  if (ctx.eigrp) return ctx.eigrp;
  const net = ctx.net;
  const rs = Object.values(net.devices).filter((d) => isL3(d) && d.eigrp);
  const en = {}, adj = {}, routes = {}, issues = {};
  ctx.eigrp = { en, adj, routes, issues };
  for (const r of rs) en[r.id] = eigrpIfaces(ctx, r.id);
  for (const r of rs) {
    adj[r.id] = [];
    issues[r.id] = [];
    for (const e of en[r.id]) {
      if (e.passive) continue;
      for (const t of flood(net, { dev: r.id, ifn: e.ifn }).values()) {
        const s = net.devices[t.dev];
        if (!s || !isL3(s) || !s.eigrp || s.id === r.id || s.eigrp.as !== r.eigrp.as) continue;
        const e2 = (en[s.id] || []).find((x) => x.ifn === t.ifn);
        if (!e2 || e2.passive) continue;
        if (netOf(e.ip, e.prefix) !== netOf(e2.ip, e2.prefix)) continue;
        if ((r.eigrp.k || '') !== (s.eigrp.k || '')) { issues[r.id].push(`${longIf(e.ifn)}: K-value lệch với ${s.name}`); continue; }
        if (e.authMode !== e2.authMode || (e.authMode && !e.keys.some((k) => e2.keys.includes(k)))) { issues[r.id].push(`${longIf(e.ifn)}: xác thực EIGRP lệch với ${s.name}`); continue; }
        adj[r.id].push({ to: s.id, nh: e2.ip, outIf: e.ifn, theirIf: t.ifn, bw: e.bw, dly: e.dly });
      }
    }
  }
  for (const r of rs) adj[r.id] = adj[r.id].filter((a) => (adj[a.to] || []).some((b) => b.to === r.id));
  // ⏱ láng giềng EIGRP lên sau hello đầu tiên (5 giây)
  for (const r of rs) adj[r.id] = adj[r.id].filter((a) => !phaseOf(net, `eigrp|${r.id}|${a.outIf}|${a.to}`, 'eigrp', { dev: r.id, ifn: a.outIf, nh: a.nh, as: r.eigrp.as }));
  const comp = eigrpComp;
  ctx.eigrp.paths = {};
  for (const r of rs) {
    const st = { [r.id]: { bw: Infinity, dly: 0, m: 0 } }, first = {}, done = new Set(), arr = {};
    ctx.eigrp.paths[r.id] = { st, first };
    for (;;) {
      let u = null;
      for (const k of Object.keys(st)) if (!done.has(k) && (u === null || st[k].m < st[u].m)) u = k;
      if (u === null) break;
      done.add(u);
      if (u !== r.id && net.devices[u].eigrp.stub) continue; // router stub không làm đường trung chuyển
      for (const a of adj[u] || []) {
        // hub DMVPN: split horizon chặn route spoke này gửi sang spoke khác trên cùng cổng mGRE
        const same = u !== r.id && arr[u] === a.outIf, hubIf = same && a.outIf.startsWith('tu') ? en[u].find((e) => e.ifn === a.outIf) : null;
        if (hubIf?.sh) continue;
        const bw = Math.min(st[u].bw, a.bw), dly = st[u].dly + a.dly, m = comp(bw, dly);
        if (!st[a.to] || m < st[a.to].m) { st[a.to] = { bw, dly, m }; arr[a.to] = a.theirIf; first[a.to] = u === r.id ? { nh: a.nh, outIf: a.outIf } : hubIf && !hubIf.nhSelf ? { nh: a.nh, outIf: first[u].outIf } : first[u]; }
      }
    }
    const myNets = new Set(Object.entries(l3ifs(r)).filter(([n, f]) => f.ip && ifUp(net, r.id, n)).map(([, f]) => netOf(f.ip, f.prefix) + '/' + f.prefix));
    const best = new Map();
    for (const s of rs) {
      if (s.id === r.id || !st[s.id]) continue;
      if (s.eigrp.stub && !s.eigrp.stub.includes('connected')) continue;
      for (const e of en[s.id]) {
        const k = netOf(e.ip, e.prefix) + '/' + e.prefix;
        if (myNets.has(k)) continue;
        const rbw = Math.min(st[s.id].bw, e.bw), rdly = st[s.id].dly + e.dly, m = comp(rbw, rdly);
        const cur = best.get(k);
        if (!cur || m < cur.metric) best.set(k, { code: 'D', net: netOf(e.ip, e.prefix), prefix: e.prefix, ad: 90, metric: m, nextHop: first[s.id].nh, iface: first[s.id].outIf, origin: s.id, rbw, rdly });
      }
    }
    routes[r.id] = [...best.values()];
  }
  // summary trên cổng: láng giềng phía sau cổng đó chỉ nhận route tóm tắt, router tóm tắt có route Null0 chống lặp
  for (const s of rs) {
    for (const e of en[s.id]) {
      for (const g of e.summaries) {
        for (const r of rs) {
          if (r.id === s.id || ctx.eigrp.paths[s.id].first[r.id]?.outIf !== e.ifn) continue;
          const P = ctx.eigrp.paths, kids = routes[r.id].filter((x) => x.prefix > g.prefix && netOf(x.net, g.prefix) === g.net && (x.origin === s.id || (P[s.id].st[x.origin] && P[r.id].st[s.id] && P[r.id].st[s.id].dly + P[s.id].st[x.origin].dly === P[r.id].st[x.origin]?.dly)));
          if (!kids.length) continue;
          const low = kids.reduce((a, b) => (b.metric < a.metric ? b : a));
          routes[r.id] = routes[r.id].filter((x) => !kids.includes(x));
          routes[r.id].push({ ...low, net: g.net, prefix: g.prefix });
        }
        if (routes[s.id].some((x) => x.prefix > g.prefix && netOf(x.net, g.prefix) === g.net) || en[s.id].some((x) => x.prefix > g.prefix && netOf(x.ip, g.prefix) === g.net)) routes[s.id].push({ code: 'D', net: g.net, prefix: g.prefix, ad: 5, metric: 0, iface: 'null0', discard: true });
      }
    }
  }
  for (const r of rs) for (const rt of routes[r.id]) if (!rt.discard) rt.alts = eigrpPaths(ctx, r, rt).filter((p) => p.inRib && p.nh !== rt.nextHop);
  return ctx.eigrp;
}
/** Bảng topology EIGRP của một route: mọi láng giềng quảng bá nó, kèm RD, FD, successor, feasible successor. */
export function eigrpPaths(ctx, r, rt) {
  const E = ctx.eigrp, out = [];
  for (const a of E.adj[r.id] || []) {
    const n = ctx.net.devices[a.to], k = rt.net + '/' + rt.prefix;
    const own = !n.eigrp.stub || n.eigrp.stub.includes('connected') ? E.en[a.to].find((e) => netOf(e.ip, e.prefix) + '/' + e.prefix === k) : null;
    const got = !own && !n.eigrp.stub ? E.routes[a.to]?.find((x) => x.net + '/' + x.prefix === k && !x.discard) : null;
    if (!own && !got) continue;
    if (got && got.iface === a.theirIf && E.en[a.to].find((e) => e.ifn === a.theirIf)?.sh !== false) continue; // split horizon
    if (got?.origin === r.id) continue;
    const rbw = own ? own.bw : got.rbw, rdly = own ? own.dly : got.rdly;
    out.push({ nh: a.nh, outIf: a.outIf, rd: eigrpComp(rbw, rdly), m: eigrpComp(Math.min(a.bw, rbw), a.dly + rdly) });
  }
  const fd = Math.min(rt.metric, ...out.map((p) => p.m)), v = r.eigrp.variance || 1;
  for (const p of out) { p.fd = fd; p.succ = p.m === fd; p.fs = !p.succ && p.rd < fd; p.inRib = p.succ || (p.fs && p.m <= fd * v); }
  return out.sort((a, b) => a.m - b.m);
}
function eigrpComp(bw, dly) { return 256 * (Math.floor(1e7 / bw) + dly); }
/**
 * EIGRP external (D EX, AD 170): route redistribute vào EIGRP. Bẫy thật: redistribute OSPF/BGP
 * mà KHÔNG có "metric ..." hoặc "default-metric" → seed metric vô hạn → không quảng bá gì cả.
 */
export function eigrpExt(ctx) {
  if (ctx.eigrpX) return ctx.eigrpX;
  const net = ctx.net;
  const E = eigrpAll(ctx);
  const o = ospfAll(ctx);
  const res = (ctx.eigrpX = {});
  const rs = Object.values(net.devices).filter((d) => isL3(d) && d.eigrp);
  const ext = {};
  for (const s of rs) {
    const list = [];
    const seen = new Set();
    const own = new Set((E.en[s.id] || []).map((e) => netOf(e.ip, e.prefix) + '/' + e.prefix));
    for (const [src, cfg] of Object.entries(s.eigrp.redist || {})) {
      const m = cfg.metric || s.eigrp.defaultMetric;
      if (!m && src !== 'static' && src !== 'connected') continue;
      const seed = m || [100000, 100]; // static/connected có metric mặc định từ cổng
      const take = (r) => {
        if (r.code === 'L') return;
        const k = r.net + '/' + r.prefix;
        if (own.has(k) || seen.has(k)) return;
        const set = cfg.routeMap ? rmEval(s, cfg.routeMap, r, ctx.record) : {};
        if (!set) return;
        seen.add(k);
        list.push({ net: r.net, prefix: r.prefix, bw: seed[0], dly: seed[1], tag: set.tag ?? cfg.tag ?? r.tag });
      };
      const base = baseRoutes(ctx, s.id);
      if (src === 'connected') base.filter((r) => r.code === 'C').forEach(take);
      if (src === 'static') base.filter((r) => r.code[0] === 'S').forEach(take);
      if (src === 'ospf' && s.ospf && s.ospf.pid === cfg.pid) {
        // mọi route OSPF trong bảng (O, O IA, O E2 và cả default O*E2) — như IOS thật
        (o.routes[s.id] || []).forEach(take);
        (o.en[s.id] || []).forEach((e) => take({ code: 'C', net: netOf(e.ip, e.prefix), prefix: e.prefix }));
      }
      if (src === 'bgp' && s.bgp && s.bgp.as === cfg.as) (bgpAll(ctx).routes[s.id] || []).forEach(take);
    }
    ext[s.id] = list;
  }
  for (const r of rs) {
    const { st, first } = E.paths[r.id] || { st: {}, first: {} };
    const have = new Set([...Object.entries(l3ifs(r)).filter(([n, f]) => f.ip && ifUp(net, r.id, n)).map(([, f]) => netOf(f.ip, f.prefix) + '/' + f.prefix), ...(E.routes[r.id] || []).map((x) => x.net + '/' + x.prefix)]);
    const best = new Map();
    for (const s of rs) {
      if (s.id === r.id || !st[s.id] || s.eigrp.as !== r.eigrp.as) continue;
      if (s.eigrp.stub && !s.eigrp.stub.includes('redistributed')) continue;
      for (const e of ext[s.id]) {
        const k = e.net + '/' + e.prefix;
        if (have.has(k)) continue;
        const m = eigrpComp(Math.min(st[s.id].bw, e.bw), st[s.id].dly + e.dly);
        const cur = best.get(k);
        if (!cur || m < cur.metric) best.set(k, { code: 'D EX', net: e.net, prefix: e.prefix, ad: 170, metric: m, nextHop: first[s.id].nh, iface: first[s.id].outIf, tag: e.tag });
      }
    }
    res[r.id] = [...best.values()];
  }
  return res;
}

// ---------- BGP ----------
/** Cấu hình hiệu lực của một neighbor: peer-group rồi tới lệnh riêng của neighbor. */
export const bgpCfg = (r, ip) => { const n = r.bgp?.neighbors?.[ip]; return n && { ...(n.group ? r.bgp.groups?.[n.group] : null), ...n }; };
/**
 * BGP (path-vector): phiên eBGP cần neighbor nối TRỰC TIẾP (TTL 1), iBGP chỉ cần IGP tới được.
 * "network" chỉ quảng bá khi prefix có ĐÚNG trong bảng định tuyến; chống lặp bằng AS-path;
 * iBGP không chuyển tiếp route học từ iBGP; next-hop iBGP giữ nguyên trừ khi "next-hop-self".
 */
export function bgpAll(ctx) {
  if (ctx.bgp) return ctx.bgp;
  if (!ctx.ospf) ospfAll(ctx);
  if (ctx.bgp) return ctx.bgp;
  const net = ctx.net;
  const rs = Object.values(net.devices).filter((d) => d.type === 'router' && d.bgp);
  const sessions = {}, tables = {}, routes = {}, rid = {};
  const res = (ctx.bgp = { sessions, tables, routes, rid });
  const igp = (id) => [...baseRoutes(ctx, id, net.devices[id].bgp?.vrf || null), ...(ctx.ospf.intRoutes?.[id] || []), ...(eigrpAll(ctx).routes[id] || [])];
  const igpLookup = (id, ip) => { let b = null; for (const r of igp(id)) if (inNet(ip, r.net, r.prefix) && (!b || r.prefix > b.prefix)) b = r; return b; };
  for (const r of rs) {
    const ips = Object.entries(r.ifaces).filter(([n, f]) => f.ip && ifUp(net, r.id, n)).map(([, f]) => f.ip);
    rid[r.id] = r.bgp.rid || ips.sort((a, b) => ip2n(b) - ip2n(a))[0] || '0.0.0.0';
  }
  for (const r of rs) {
    sessions[r.id] = [];
    for (const [nip, n0] of Object.entries(r.bgp.neighbors || {})) {
      const ncfg = bgpCfg(r, nip) || n0;
      const P = rs.find((x) => Object.entries(x.ifaces).some(([n, f]) => f.ip === nip && ifUp(net, x.id, n)));
      const rt = igpLookup(r.id, nip);
      let state = 'Idle';
      let myIp = null;
      if (rt) {
        // "neighbor X update-source lo0": phiên BGP mang IP của cổng đó (iBGP qua loopback)
        const us = ncfg.updateSource && r.ifaces[ncfg.updateSource];
        myIp = us?.ip && ifUp(net, r.id, ncfg.updateSource) ? us.ip : r.ifaces[rt.iface]?.ip;
        state = 'Active';
        if (P && P.bgp.as === ncfg.remoteAs) {
          const back = bgpCfg(P, myIp);
          const ebgp = r.bgp.as !== P.bgp.as;
          // eBGP mặc định TTL 1 nên phải nối trực tiếp; qua loopback cần ebgp-multihop ở cả hai đầu. Lệch mật khẩu MD5 thì TCP không lên.
          // disable-connected-check chỉ bỏ kiểm tra "nối trực tiếp", gói vẫn TTL 1 nên láng giềng phải cách đúng một chặng
          const oneHop = !rt.nextHop || Object.values(P.ifaces).some((f) => f.ip === rt.nextHop);
          if (back && back.remoteAs === r.bgp.as && !ncfg.shutdown && !back.shutdown && (ncfg.password || '') === (back.password || '') && (!ebgp || rt.code === 'C' || (ncfg.multihop && back.multihop) || (ncfg.ttlSec && back.ttlSec) || (ncfg.noConnCheck && back.noConnCheck && oneHop)) && igpLookup(P.id, myIp)) state = 'Established';
        }
      }
      // ⏱ phiên BGP: Active → OpenSent → OpenConfirm → Established
      if (state === 'Established') state = phaseOf(net, `bgp|${r.id}|${nip}`, 'bgp', { dev: r.id, ip: nip }) || state;
      sessions[r.id].push({ peer: P?.id || null, ip: nip, myIp, ebgp: P ? r.bgp.as !== P.bgp.as : ncfg.remoteAs !== r.bgp.as, cfg: ncfg, state, remoteAs: ncfg.remoteAs });
    }
  }
  // route tự quảng bá (network)
  const local = {};
  for (const r of rs) {
    local[r.id] = [];
    const tbl = igp(r.id);
    for (const n of r.bgp.networks || []) if (tbl.some((x) => x.net === n.net && x.prefix === n.prefix && x.code !== 'L')) local[r.id].push({ net: n.net, prefix: n.prefix, asPath: [], nh: '0.0.0.0', local: true, from: null, ebgp: false, weight: 32768, origin: 'i' });
    for (const [src, cfg] of Object.entries(r.bgp.redist || {})) {
      const pre = { connected: 'C', static: 'S', ospf: 'O', eigrp: 'D' }[src];
      for (const x of tbl) {
        if (x.code === 'L' || x.code[0] !== pre || x.prefix === 0 || local[r.id].some((l) => l.net === x.net && l.prefix === x.prefix)) continue;
        const set = cfg.routeMap ? rmEval(r, cfg.routeMap, x, ctx.record) : {};
        if (set) local[r.id].push({ net: x.net, prefix: x.prefix, asPath: [], nh: '0.0.0.0', local: true, from: null, ebgp: false, weight: 32768, origin: '?', med: set.metric ?? 0, lp: set.localPref, tag: set.tag });
      }
    }
  }
  const igpM = (id, b) => (b.local ? 0 : igpLookup(id, b.nh)?.metric ?? 1e9);
  const ORG = { i: 0, e: 1, '?': 2 };
  const nhOk = (id, p) => !!p.local || p.nh === '0.0.0.0' || !!igpLookup(id, p.nh);
  res.nhOk = nhOk;
  // MED chỉ so giữa các đường từ cùng AS kề bên, trừ khi bật always-compare-med
  const medCmp = (o, a, b) => { if (!o.alwaysMed && a.asPath[0] !== b.asPath[0]) return 0; const m = (p) => p.med ?? (o.medWorst ? 4294967295 : 0); return m(a) - m(b); };
  // thứ tự chọn đường BGP: next-hop tới được, weight, local-pref, tự sinh, AS-path, origin, MED, eBGP trước iBGP, IGP tới next-hop, router-id
  const pick = (list, id) => { const o = net.devices[id].bgp; return list.filter((p) => nhOk(id, p)).sort((a, b) => (b.weight || 0) - (a.weight || 0) || (b.lp ?? 100) - (a.lp ?? 100) || (b.local ? 1 : 0) - (a.local ? 1 : 0) || (o.asPathIgnore ? 0 : a.asPath.length - b.asPath.length) || ORG[a.origin || 'i'] - ORG[b.origin || 'i'] || medCmp(o, a, b) || (b.ebgp ? 1 : 0) - (a.ebgp ? 1 : 0) || igpM(id, a) - igpM(id, b) || ip2n(a.fromRid || '0.0.0.0') - ip2n(b.fromRid || '0.0.0.0') || ip2n(a.fromIp || '0.0.0.0') - ip2n(b.fromIp || '0.0.0.0'))[0]; };
  const within = (b, g) => b.prefix > g.prefix && netOf(b.net, g.prefix) === g.net;
  const suppressed = (r, b) => (r.bgp.aggregates || []).some((g) => g.summaryOnly && within(b, g));
  let best = {};
  for (const r of rs) { best[r.id] = {}; for (const p of local[r.id]) best[r.id][p.net + '/' + p.prefix] = p; }
  for (let round = 0; round < rs.length + 3; round++) {
    const cand = {};
    for (const r of rs) {
      cand[r.id] = {};
      for (const p of local[r.id]) (cand[r.id][p.net + '/' + p.prefix] ||= []).push(p);
      for (const g of r.bgp.aggregates || []) if (Object.values(best[r.id]).some((b) => within(b, g))) (cand[r.id][g.net + '/' + g.prefix] ||= []).push({ net: g.net, prefix: g.prefix, asPath: [], nh: '0.0.0.0', local: true, agg: true, from: null, ebgp: false, weight: 32768, origin: 'i' });
    }
    for (const r of rs) {
      for (const s of sessions[r.id]) {
        if (s.state !== 'Established') continue;
        const P = net.devices[s.peer];
        const rx = sessions[P.id].find((x) => x.peer === r.id && x.state === 'Established');
        // iBGP không chuyển tiếp route học từ iBGP, trừ route reflector: route từ client đi tới mọi nơi, route từ non-client chỉ tới client
        const out = Object.values(best[r.id]).filter((b) => b.from !== P.id && !suppressed(r, b) && (s.ebgp || !b.ibgp || b.fromClient || s.cfg.rrClient) && !b.comm?.includes('no-advertise') && !(s.ebgp && (b.comm?.includes('no-export') || b.comm?.includes('local-AS'))));
        if (s.cfg.defaultOriginate) out.push({ net: '0.0.0.0', prefix: 0, asPath: [], nh: '0.0.0.0', orig: true });
        const accepted = [];
        for (const b of out) {
          let path0 = b.asPath;
          // không có "all": chỉ xoá khi AS_PATH toàn AS riêng
          if (s.ebgp && s.cfg.removePrivate) path0 = s.cfg.removePrivate === 'all' ? path0.filter((a) => !isPrivAs(a)) : path0.every(isPrivAs) ? [] : path0;
          if (s.ebgp && s.cfg.asOverride) path0 = path0.map((a) => (a === s.remoteAs ? r.bgp.as : a));
          const nh = s.ebgp || b.nh === '0.0.0.0' || s.cfg.nextHopSelf ? s.myIp : b.nh;
          // route phản chiếu qua RR mang thêm cluster của RR; cluster ID mặc định là router-id của RR
          let e = { net: b.net, prefix: b.prefix, asPath: s.ebgp ? [r.bgp.as, ...path0] : path0, nh, from: r.id, fromIp: s.myIp, fromRid: rid[r.id], ebgp: s.ebgp, ibgp: !s.ebgp, origin: b.origin || 'i', med: b.med, lp: s.ebgp ? 100 : b.lp ?? 100, tag: b.tag, comm: b.comm, originator: s.ebgp ? null : b.originator ?? (b.ibgp ? b.fromRid : rid[r.id]), cluster: !s.ebgp && b.ibgp ? [rid[r.id], ...(b.cluster || [])] : undefined };
          if (e.originator && e.originator === rid[P.id]) continue; // route do chính mình phát qua RR quay về
          const policy = (dev, c0, dir) => {
            if (c0[`pl${dir}`] && !plEval(dev, c0[`pl${dir}`], e.net, e.prefix)) return false;
            if (c0[`fl${dir}`] && !asPathOk(dev, c0[`fl${dir}`], e.asPath)) return false;
            if (!c0[`rm${dir}`]) return true;
            const st = rmEval(dev, c0[`rm${dir}`], { ...e, metric: e.med }, false);
            if (!st) return false;
            const cm = st.community;
            e = { ...e, lp: st.localPref ?? e.lp, med: st.metric ?? e.med, weight: st.weight ?? e.weight, tag: st.tag ?? e.tag, asPath: st.prepend ? [...st.prepend, ...e.asPath] : e.asPath, comm: !cm ? e.comm : cm.additive ? [...new Set([...(e.comm || []), ...cm.vals])] : cm.vals };
            return true;
          };
          if (!policy(r, s.cfg, 'Out')) continue;
          if (!s.cfg.sendCommunity) e.comm = undefined; // community chỉ đi kèm khi có send-community
          // chống lặp AS-path; allowas-in cho phép AS của mình xuất hiện tối đa n lần
          if (e.asPath.filter((a) => a === P.bgp.as).length > (rx?.cfg.allowasIn ?? 0)) continue;
          if (rx) {
            e.weight = rx.cfg.weight ?? 0;
            if (!policy(P, rx.cfg, 'In')) continue;
            if (rx.cfg.rrClient) e.fromClient = true;
          }
          accepted.push(e);
        }
        const lim = rx?.cfg.maxPrefix;
        if (lim && accepted.length > lim.max && !lim.warnOnly) { rx.state = 'Idle (PfxCt)'; s.state = 'Idle'; continue; }
        for (const e of accepted) (cand[P.id][e.net + '/' + e.prefix] ||= []).push(e);
      }
    }
    const nb = {};
    for (const r of rs) { nb[r.id] = {}; for (const [k, l] of Object.entries(cand[r.id])) { const p = pick(l, r.id); if (p) nb[r.id][k] = p; } }
    const same = JSON.stringify(nb) === JSON.stringify(best);
    best = nb;
    Object.assign(tables, Object.fromEntries(rs.map((r) => [r.id, cand[r.id]])));
    if (same) break;
  }
  for (const r of rs) {
    tables[r.id] ||= {};
    routes[r.id] = [];
    for (const b of Object.values(best[r.id])) {
      if (b.agg) routes[r.id].push({ code: 'B', net: b.net, prefix: b.prefix, ad: 200, metric: 0, iface: 'null0', discard: true });
      if (b.local) continue;
      const via = igpLookup(r.id, b.nh);
      if (!via) continue; // next-hop không tới được → route không vào RIB
      routes[r.id].push({ code: 'B', net: b.net, prefix: b.prefix, ad: b.ebgp ? 20 : 200, metric: b.med || 0, nextHop: b.nh, fwdNh: via.nextHop, iface: via.iface, asPath: b.asPath, tag: b.tag });
    }
  }
  res.best = best;
  return res;
}

// ======================================================================
// ACL & NAT
// ======================================================================
export const PORT_NAMES = { www: 80, http: 80, https: 443, telnet: 23, ssh: 22, ftp: 21, 'ftp-data': 20, smtp: 25, domain: 53, pop3: 110, bootps: 67, bootpc: 68, ntp: 123, snmp: 161, tftp: 69 };
function addrMatch(ip, spec) {
  if (!spec || spec.any) return true;
  return wildMatch(ip, spec.ip, spec.wild);
}
function portMatch(p, spec) {
  if (!spec) return true;
  if (spec.op === 'eq') return p === spec.port;
  if (spec.op === 'neq') return p !== spec.port;
  if (spec.op === 'gt') return p > spec.port;
  if (spec.op === 'lt') return p < spec.port;
  if (spec.op === 'range') return p >= spec.port && p <= spec.port2;
  return true;
}
function aceMatch(type, e, p) {
  if (type === 'standard') return addrMatch(p.src, e.src);
  if (e.proto !== 'ip' && e.proto !== p.proto) return false;
  if (!addrMatch(p.src, e.src) || !addrMatch(p.dst, e.dst)) return false;
  const isL4 = p.proto === 'tcp' || p.proto === 'udp';
  if (e.sport && !(isL4 && portMatch(p.sport, e.sport))) return false;
  if (e.dport && !(isL4 && portMatch(p.dport, e.dport))) return false;
  if (e.established && !(p.proto === 'tcp' && p.flags && (p.flags.ack || p.flags.rst))) return false;
  if (e.icmpType && p.proto === 'icmp' && e.icmpType !== (p.reply ? 'echo-reply' : 'echo')) return false;
  return true;
}
/** Đánh giá ACL theo thứ tự dòng, dừng ở dòng khớp đầu tiên; không khớp dòng nào → deny ngầm định. */
export function aclEval(dev, name, pkt, record) {
  const acl = dev.acls?.[name];
  if (!acl) return { action: 'permit', missing: true }; // IOS: ACL chưa định nghĩa = permit all
  for (const e of acl.entries) {
    if (e.remark != null || (e.timeRange && !timeActive(dev, e.timeRange))) continue;
    if (aceMatch(acl.type, e, pkt)) {
      if (record) e.matches = (e.matches || 0) + 1;
      return { action: e.action, entry: e };
    }
  }
  return { action: 'deny', implicit: true };
}
function addrText(a) { return !a || a.any ? 'any' : a.wild === '0.0.0.0' ? `host ${a.ip}` : `${a.ip} ${a.wild}`; }
function portText(p) { return !p ? '' : p.op === 'range' ? ` range ${p.port} ${p.port2}` : ` ${p.op} ${Object.keys(PORT_NAMES).find((k) => PORT_NAMES[k] === p.port && ['www', 'telnet', 'ftp', 'smtp', 'domain', 'pop3'].includes(k)) || p.port}`; }
export function aceText(type, e) {
  if (e.remark != null) return `remark ${e.remark}`;
  if (type === 'standard') return `${e.action} ${e.src.any ? 'any' : e.src.wild === '0.0.0.0' ? e.src.ip : `${e.src.ip}, wildcard bits ${e.src.wild}`}`;
  return `${e.action} ${e.proto} ${addrText(e.src)}${portText(e.sport)} ${addrText(e.dst)}${portText(e.dport)}${e.icmpType ? ' ' + e.icmpType : ''}${e.established ? ' established' : ''}${e.timeRange ? ' time-range ' + e.timeRange : ''}${e.log ? ' log' : ''}`;
}

export function poolAddrs(p) {
  const out = [];
  if (!p || !p.start || !p.end) return out;
  for (let n = ip2n(p.start); n <= ip2n(p.end) && out.length < 256; n++) out.push(n2ip(n));
  return out;
}
function natIn2Out(ctx, r, pkt, outIf) {
  const L4 = pkt.proto === 'tcp' || pkt.proto === 'udp';
  // NAT tĩnh: static PAT (port forwarding) trước, rồi 1:1
  const sp = r.nat.statics.find((s) => s.proto && s.local === pkt.src && s.proto === pkt.proto && L4 && s.lport === pkt.sport);
  if (sp) {
    const e = { rid: r.id, proto: pkt.proto, il: pkt.src, ig: sp.global, port: pkt.sport, gport: sp.gport, outside: pkt.dst, stat: true };
    pkt.src = sp.global; pkt.sport = sp.gport;
    return e;
  }
  const st = r.nat.statics.find((s) => !s.proto && s.local === pkt.src);
  if (st) {
    const e = { rid: r.id, proto: pkt.proto, il: pkt.src, ig: st.global, port: null, outside: pkt.dst, stat: true };
    pkt.src = st.global;
    return e;
  }
  for (const rule of r.nat.dyn) {
    if (rule.iface && rule.iface !== outIf) continue;
    const a = aclEval(r, rule.acl, { src: pkt.src, dst: pkt.dst, proto: pkt.proto }, false);
    if (a.missing || a.action !== 'permit') continue;
    const port = pkt.proto === 'icmp' ? pkt.icmpId : pkt.sport;
    let gip, ePort = port;
    if (rule.iface) {
      gip = r.ifaces[rule.iface]?.ip;
      if (!gip) continue;
    } else {
      const addrs = poolAddrs(r.nat.pools[rule.pool]);
      if (!addrs.length) continue;
      if (rule.overload) gip = addrs[0];
      else {
        // NAT pool 1:1 — mỗi máy trong chiếm riêng 1 IP public cho tới khi xoá translation
        const all = [...r.natTable, ...ctx.nat].filter((x) => x.rid === r.id && x.pool === rule.pool);
        gip = all.find((x) => x.il === pkt.src)?.ig || addrs.find((ip) => !all.some((x) => x.ig === ip && x.il !== pkt.src));
        if (!gip) return { exhausted: true, pool: rule.pool };
        ePort = null;
      }
    }
    const e = { rid: r.id, proto: pkt.proto, il: pkt.src, ig: gip, port: ePort, outside: pkt.dst, stat: false, pool: rule.pool || null };
    ctx.nat.push(e);
    pkt.src = gip;
    return e;
  }
  return null;
}
function natOut2In(ctx, r, pkt) {
  const L4 = pkt.proto === 'tcp' || pkt.proto === 'udp';
  const sp = r.nat.statics.find((s) => s.proto && s.global === pkt.dst && s.proto === pkt.proto && L4 && s.gport === pkt.dport);
  if (sp) { pkt.dst = sp.local; pkt.dport = sp.lport; return { stat: true, il: sp.local, ig: sp.global }; }
  const st = r.nat.statics.find((s) => !s.proto && s.global === pkt.dst);
  if (st) { pkt.dst = st.local; return { stat: true, il: st.local, ig: st.global }; }
  const port = pkt.proto === 'icmp' ? pkt.icmpId : pkt.dport;
  const match = (x) => x.rid === r.id && x.ig === pkt.dst && x.proto === pkt.proto && (x.port == null || x.port === port);
  const e = ctx.nat.find(match) || r.natTable.find(match);
  if (e) { pkt.dst = e.il; return e; }
  return null;
}

// ======================================================================
// VPN IPsec site-to-site
// ======================================================================
function routerOwning(net, ip) {
  return Object.values(net.devices).find((x) => x.type === 'router' && Object.values(x.ifaces).some((f) => f.ip === ip)) || null;
}
function tsetKey(t) { return [...(t || [])].sort().join(' '); }
/** Các crypto map entry trên cổng `ifn` khớp gói `pkt` (interesting traffic). */
function cryptoMatch(r, ifn, pkt) {
  const m = r.ifaces[ifn]?.cryptoMap;
  if (!m || !r.crypto.maps[m]) return null;
  for (const [seq, e] of Object.entries(r.crypto.maps[m]).sort((a, b) => +a[0] - +b[0])) {
    if (!e.acl) continue;
    if (aclEval(r, e.acl, { src: pkt.src, dst: pkt.dst, proto: pkt.proto, sport: pkt.sport, dport: pkt.dport }, false).action === 'permit') return { map: m, seq, e };
  }
  return null;
}
/** Kiểm tra đường hầm IPsec giữa router `r` (cổng `ifn`) và peer cho gói `pkt`: {up, why, peer, peerIfn}. */
export function vpnState(net, r, ifn, hit, pkt) {
  const e = hit.e;
  const localIp = r.ifaces[ifn].ip;
  if (!e.peer) return { up: false, why: `crypto map ${hit.map} ${hit.seq} chưa "set peer"` };
  if (!e.tset || !r.crypto.tsets[e.tset]) return { up: false, why: `crypto map ${hit.map} ${hit.seq} chưa "set transform-set" hợp lệ` };
  const P = routerOwning(net, e.peer);
  if (!P) return { up: false, why: `không có thiết bị nào mang IP peer ${e.peer}` };
  const pIfn = Object.keys(P.ifaces).find((n) => P.ifaces[n].ip === e.peer);
  const under = sendPacket(net, { src: r.id, dst: e.peer, noCrypto: true });
  if (!under.ok) return { up: false, why: `${r.name} không tới được peer ${e.peer} qua Internet (underlay): ${under.fail?.why || ''}` };
  // Phase 1 (ISAKMP)
  const pol = (a) => Object.values(a.crypto.isakmp || {}).map((p) => `${p.encr || 'des'}|${p.hash || 'sha'}|${p.auth || 'rsa-sig'}|${p.group || 1}`);
  const mine = pol(r), theirs = pol(P);
  const common = mine.filter((x) => theirs.includes(x));
  if (!mine.length || !theirs.length) return { up: false, why: 'Phase 1: thiếu "crypto isakmp policy" ở một đầu', phase: 1 };
  if (!common.length) return { up: false, why: `Phase 1 thất bại: không có ISAKMP policy nào khớp (encryption/hash/authentication/group) giữa ${r.name} và ${P.name}`, phase: 1 };
  if (!common.some((x) => x.split('|')[2] === 'pre-share')) return { up: false, why: 'Phase 1: policy khớp nhưng không dùng "authentication pre-share"', phase: 1 };
  const k1 = r.crypto.keys[e.peer], k2 = P.crypto.keys[localIp];
  if (!k1 || !k2) return { up: false, why: `Phase 1: thiếu "crypto isakmp key ... address" (${!k1 ? r.name + ' chưa có key cho ' + e.peer : P.name + ' chưa có key cho ' + localIp})`, phase: 1 };
  if (k1 !== k2) return { up: false, why: 'Phase 1 thất bại: pre-shared key 2 đầu KHÔNG giống nhau', phase: 1 };
  // Phase 2 (IPsec)
  const pm = P.ifaces[pIfn]?.cryptoMap;
  if (!pm || !P.crypto.maps[pm]) return { up: false, why: `Phase 2: ${P.name} chưa áp crypto map lên cổng ${longIf(pIfn)}`, phase: 2 };
  const rev = { ...pkt, src: pkt.dst, dst: pkt.src, sport: pkt.dport, dport: pkt.sport };
  const pe = Object.values(P.crypto.maps[pm]).find((x) => x.peer === localIp);
  if (!pe) return { up: false, why: `Phase 2: crypto map của ${P.name} không có "set peer ${localIp}"`, phase: 2 };
  if (tsetKey(P.crypto.tsets[pe.tset]) !== tsetKey(r.crypto.tsets[e.tset])) return { up: false, why: `Phase 2 thất bại: transform-set 2 đầu khác nhau (${tsetKey(r.crypto.tsets[e.tset])} ≠ ${tsetKey(P.crypto.tsets[pe.tset]) || 'chưa có'})`, phase: 2 };
  if (!pe.acl || aclEval(P, pe.acl, rev, false).action !== 'permit') return { up: false, why: `Phase 2 thất bại: ACL "interesting traffic" 2 đầu không đối xứng (mirror) — ${P.name} không khớp chiều ${rev.src} → ${rev.dst}`, phase: 2 };
  return { up: true, peer: P, peerIfn: pIfn, localIp };
}

// ======================================================================
// Gửi gói (ping / TCP) — đi THẬT qua mạng, ghi lại timeline byte-thật nếu cần
// ======================================================================
export function topologyOf(net) {
  const ds = Object.values(net.devices);
  const x0 = Math.min(...ds.map((d) => d.x)) - 90, y0 = Math.min(...ds.map((d) => d.y)) - 55;
  const x1 = Math.max(...ds.map((d) => d.x)) + 90, y1 = Math.max(...ds.map((d) => d.y)) + 75;
  return {
    viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`,
    devices: ds.map((d) => ({
      id: d.id,
      type: isCloud(d) ? 'cloud' : d.type === 'pc' || d.type === 'server' ? 'host' : d.type,
      name: d.name, x: d.x, y: d.y,
      lines: d.type === 'pc' || d.type === 'server' ? [d.ip ? `${d.ip}/${d.prefix}` : (d.dhcp ? 'DHCP' : '(chưa IP)')] : [],
    })),
    links: net.links.map((l) => ({ id: l.id, a: l.a, b: l.b, labelMid: '' })),
  };
}

class Rec {
  constructor(net, on) { this.net = net; this.on = on; this.sim = on ? new Sim(topologyOf(net)) : null; }
  frame(layers) { return this.on ? this.sim.frame(layers) : null; }
  cap(f, label) { if (this.on && f) this.sim.capture(f, label); }
  transit(h, f, o) {
    if (!this.on) return;
    const lbl = h.tag != null ? `802.1Q VLAN ${h.tag}` : h.vlan != null ? `VLAN ${h.vlan}` : o.lbl || '';
    this.sim.emit({ kind: 'transit', fromDevice: h.from, toDevice: h.to, link: h.link, capSkip: !!o.capSkip, packet: f, activeLayer: o.l || 2, side: o.side || 'encap', titleVi: o.title, explanationVi: o.ex, changedFields: o.changed || [], overlay: { links: { [h.link]: { cls: h.tag != null ? 'trunk' : 'forwarding', label: lbl } } } });
  }
  proc(at, o) {
    if (!this.on) return;
    this.sim.emit({ kind: 'process', atDevice: at, packet: o.packet || null, activeLayer: o.l || 3, side: o.side || 'inspect', titleVi: o.title, explanationVi: o.ex, changedFields: o.changed || [], tables: o.tables || {} });
  }
}

function l2(tag, innerType, src, dst) {
  const L = [{ proto: 'ethernet', fields: { dst, src, etherType: tag != null ? 0x8100 : innerType } }];
  if (tag != null) L.push({ proto: 'dot1q', fields: { pcp: 0, dei: 0, vid: tag, innerType } });
  return L;
}
function ipLayers(p) {
  const protocol = p.proto === 'icmp' ? 1 : p.proto === 'esp' ? 50 : p.proto === 'gre' ? 47 : 6;
  const L = [{ proto: 'ipv4', fields: { src: p.src, dst: p.dst, ttl: p.ttl, id: p.ipId, protocol } }];
  if (p.proto === 'icmp') L.push({ proto: 'icmp', fields: { type: p.reply ? 0 : 8, code: 0, identifier: p.icmpId, seq: p.seq, data: pingData() } });
  else if (p.proto === 'gre') L.push({ proto: 'raw', fields: { data: [0x00, 0x00, 0x08, 0x00, 0x45, 0x00, 0x00, 0x3c, ...Array.from({ length: 52 }, (_, i) => (i * 29 + 7) & 0xff)], desc: `GRE header (flags 0x0000, protocol 0x0800 = IPv4) + gói gốc ${p.inner} (KHÔNG mã hoá — đọc được nếu bị bắt gói)` } });
  else if (p.proto === 'esp') L.push({ proto: 'raw', fields: { data: [0x1a, 0x2b, 0x3c, 0x4d, 0, 0, 0, 1, ...Array.from({ length: 56 }, (_, i) => (i * 73 + 41) & 0xff)], desc: `ESP: SPI 0x1A2B3C4D, seq 1 — bên trong là gói gốc ${p.inner} đã bị MÃ HOÁ (ISP không đọc được)` } });
  else L.push({ proto: 'tcp', fields: { srcPort: p.sport, dstPort: p.dport, seq: p.tseq, ack: p.tack, flags: p.flags, window: 64240, mss: p.flags.syn ? 1460 : undefined } });
  return L;
}
function pktLabel(p) {
  if (p.proto === 'icmp') return `ICMP Echo ${p.reply ? 'Reply' : 'Request'} ${p.src} → ${p.dst}`;
  if (p.proto === 'esp') return `ESP (IPsec) ${p.src} → ${p.dst}`;
  if (p.proto === 'gre') return `GRE ${p.src} → ${p.dst} (bên trong: ${p.inner})`;
  const f = Object.keys(p.flags).filter((k) => p.flags[k]).map((k) => k.toUpperCase()).join(',');
  return `TCP [${f}] ${p.src}:${p.sport} → ${p.dst}:${p.dport}`;
}
function routeRows(ctx, rid, hl) {
  return {
    routing: {
      title: `Bảng định tuyến ${ctx.net.devices[rid].name}`,
      rows: routeTable(ctx, rid).filter((r) => r.code !== 'L').map((r) => ({ network: r.net, prefix: r.prefix, nextHop: r.nextHop || 'trực tiếp', iface: longIf(r.iface), kind: r.code })),
      highlight: hl ? `${hl.net}/${hl.prefix}` : null,
    },
  };
}
/** Thiết bị L3 có sở hữu IP này không (kể cả VIP HSRP/VRRP đang active). */
function ownsIp(net, d, ip, vrf) {
  if (d.type === 'pc' || d.type === 'server') return d.ip === ip;
  for (const [n, f] of Object.entries(l3ifs(d))) {
    if ((vrf !== undefined && (f.vrf || null) !== vrf) || !ifUp(net, d.id, n)) continue;
    if (f.ip === ip) return true;
    for (const s of [...Object.values(f.standby || {}), ...Object.values(f.vrrp || {})]) {
      if (s.ip === ip && hsrpView(net, d.id, n).some((a) => a.vip === ip && a.ep.dev === d.id && a.ep.ifn === n)) return true;
    }
  }
  return false;
}

/** VLAN của frame đi VÀO switch qua cổng `port` (tag 802.1Q nếu có). */
export function inVlan(net, sd, port, tag) {
  const e = effPort(net, sd, port);
  if (e.mode === 'access') return e.vlan;
  if (e.mode === 'private-vlan') return e.pv?.mode === 'host' ? e.pv.secondary : e.pv?.primary;
  return tag ?? e.native;
}
/** Bảng binding switch dùng cho DAI / IP Source Guard: học từ DHCP snooping + "ip source binding" tĩnh. */
export function snoopBindings(sd) { return [...(sd.snoop?.bindings || []), ...(sd.snoop?.statics || [])]; }
/** Nhật ký bảo mật (DAI, DHCP snooping, login) — hiện trong "show logging", giữ 30 dòng mới nhất. */
export function secLog(d, msg) { const L = (d.secLog ||= []); L.push(msg); if (L.length > 30) L.shift(); }
const portFlag = (net, sd, port, k) => !!(sd.ports[port]?.[k] || sd.ports[effPort(net, sd, port).bundle]?.[k]);
/** DAI: ARP của (ip, mac) đi vào các switch theo danh sách cổng vào. Trả { at, why } nếu bị hủy. */
function daiCheck(net, ingress, ip, mac) {
  for (const g of ingress) {
    const sd = net.devices[g.dev];
    if (sd?.type !== 'switch' || !sd.dai?.length || !sd.ports[g.port]) continue;
    const vlan = inVlan(net, sd, g.port, g.tag);
    if (!sd.dai.includes(vlan)) continue;
    const st = ((sd.daiStats ||= {})[vlan] ||= { fwd: 0, drop: 0 });
    if (portFlag(net, sd, g.port, 'daiTrust') || snoopBindings(sd).some((b) => b.ip === ip && b.mac === mac && b.vlan === vlan)) { if (RECORDING) st.fwd++; continue; }
    if (RECORDING) { st.drop++; secLog(sd, `%SW_DAI-4-DHCP_SNOOPING_DENY: 1 Invalid ARPs (Req) on ${shortIf(g.port)}, vlan ${vlan}.([${ciscoMac(mac)}/${ip}])`); }
    return { at: sd.id, why: `DAI trên ${sd.name} (VLAN ${vlan}) hủy ARP vào cổng UNTRUSTED ${longIf(g.port)}: cặp ${ip} / ${ciscoMac(mac)} không có trong bảng DHCP snooping binding (máy đặt IP tĩnh, giả mạo ARP, hoặc cổng hướng về router/switch khác chưa "ip arp inspection trust")` };
  }
  return null;
}

/** Chuyển 1 gói qua đoạn L2 tới next-hop: ARP (lần đầu) rồi frame đi từng chặng (kiểm VACL). */
function deliverL2(ctx, R, egress, nh, pkt) {
  const net = ctx.net;
  const key = egress.dev + '|' + egress.ifn + '|' + nh;
  const srcMac = epMac(net, egress);
  const srcIp = epIp(net, egress) || pkt.src;
  let res = ctx.arpc[key];
  if (!res) {
    res = resolve(net, egress, nh);
    const dname = net.devices[egress.dev].name;
    if (res.fail) {
      if (R.on) {
        const f = R.frame([...l2(null, 0x0806, srcMac, 'ff:ff:ff:ff:ff:ff'), { proto: 'arp', fields: { opcode: 1, senderMac: srcMac, senderIp: srcIp, targetMac: '00:00:00:00:00:00', targetIp: nh } }]);
        R.cap(f, `ARP Who has ${nh}? (không ai trả lời)`);
        R.proc(egress.dev, { packet: f, l: 2, side: 'encap', title: `✗ ARP hỏi ${nh} — không ai trả lời`, ex: `${dname} phát ARP Request tìm MAC của ${nh} nhưng không thiết bị nào trong cùng miền quảng bá trả lời. ${res.diag.length ? 'Nguyên nhân dọc đường: ' + res.diag.join('; ') + '.' : 'Không có thiết bị nào mang IP này trong VLAN/đoạn mạng đó.'}` });
      }
      return { fail: true, why: `ARP cho ${nh} không có trả lời${res.diag.length ? ' — ' + res.diag.join('; ') : ''}` };
    }
    // DAI: switch kiểm ARP Request (của bên hỏi) và ARP Reply (của bên trả lời) đi vào cổng untrusted
    const dai = daiCheck(net, res.hops.map((h) => ({ dev: h.to, port: h.toPort, tag: h.tag })), srcIp, srcMac)
      || daiCheck(net, [...res.hops].reverse().map((h) => ({ dev: h.from, port: h.fromPort, tag: h.tag })), nh, res.mac);
    if (dai) {
      if (R.on) R.proc(dai.at, { l: 2, title: `✗ ${net.devices[dai.at].name}: DAI hủy ARP`, ex: dai.why + '.' });
      return { fail: true, at: dai.at, kind: 'dai', why: dai.why };
    }
    ctx.arpc[key] = res;
    // bảng ARP đã có MAC → thiết bị thật không hỏi lại: timeline vẫn minh hoạ ARP, nhưng capture trên dây bỏ qua
    const serial = /^s\d/.test(egress.ifn); // HDLC/PPP điểm-điểm không dùng ARP
    const arpKnown = !!net.devices[egress.dev].arp[nh];
    if (!arpKnown && !serial) ctx.firstArp = true;
    if (ctx.record) {
      if (!serial) {
        net.devices[egress.dev].arp[nh] = { mac: res.mac, ifn: egress.ifn };
        const od = net.devices[res.ep.dev];
        if (srcIp) od.arp[srcIp] = { mac: srcMac, ifn: res.ep.ifn };
      }
      learnMacs(net, res.hops, srcMac);
      learnMacs(net, [...res.hops].reverse().map((h) => ({ ...h, from: h.to, to: h.from, fromPort: h.toPort, toPort: h.fromPort })), res.mac);
    }
    if (R.on && !serial) {
      for (const h of res.hops) {
        const f = R.frame([...l2(h.tag, 0x0806, srcMac, 'ff:ff:ff:ff:ff:ff'), { proto: 'arp', fields: { opcode: 1, senderMac: srcMac, senderIp: srcIp, targetMac: '00:00:00:00:00:00', targetIp: nh } }]);
        if (h === res.hops[0]) R.cap(f, `ARP Who has ${nh}? Tell ${srcIp}`);
        R.transit(h, f, { l: 2, capSkip: arpKnown, title: `ARP Request (broadcast): ai giữ ${nh}?`, ex: `${dname} chưa có MAC của ${nh} → phát broadcast FF:FF:FF:FF:FF:FF.${h.tag != null ? ` Trên đường trunk khung được gắn nhãn 802.1Q VLAN ${h.tag}.` : ''}` });
      }
      const back = [...res.hops].reverse();
      const fh = res.fhrp === 'vrrp' ? 'VRRP' : 'HSRP';
      for (const h of back) {
        const hh = { ...h, from: h.to, to: h.from };
        const f = R.frame([...l2(h.tag, 0x0806, res.mac, srcMac), { proto: 'arp', fields: { opcode: 2, senderMac: res.mac, senderIp: nh, targetMac: srcMac, targetIp: srcIp } }]);
        if (h === back[0]) R.cap(f, `ARP ${nh} is at ${res.mac}`);
        R.transit(hh, f, { l: 2, side: 'decap', capSkip: arpKnown, title: `ARP Reply: ${nh} ở ${ciscoMac(res.mac)}${res.fhrp ? ` (MAC ảo ${fh})` : res.proxy ? ' (proxy-ARP)' : ''}`, ex: `${net.devices[res.ep.dev].name} trả lời unicast.${res.fhrp ? ` Đây là router ${res.fhrp === 'vrrp' ? 'MASTER' : 'ACTIVE'} của nhóm ${fh} ${res.hsrp} → trả MAC ảo ${ciscoMac(res.mac)}.` : ''}${res.proxy ? ' Router trả lời THAY cho một IP ở mạng khác (proxy-ARP) vì nó có route tới mạng đó.' : ''}` });
      }
    }
  }
  if (ctx.record) learnMacs(net, res.hops, srcMac);
  // VACL: switch lọc gói IP ngay TRONG VLAN (kể cả 2 máy cùng VLAN)
  for (const h of res.hops) {
    const sd = net.devices[h.from];
    if (sd.type !== 'switch' || h.vlan == null) continue;
    const filt = Object.entries(sd.vacl?.filters || {}).find(([, vl]) => vl.includes(h.vlan));
    if (!filt) continue;
    const map = sd.vacl.maps[filt[0]] || [];
    let act = 'drop';
    for (const en of [...map].sort((a, b) => a.seq - b.seq)) {
      if (!en.acl || aclEval(sd, en.acl, pkt, false).action === 'permit') { act = en.action || 'forward'; break; }
    }
    if (act === 'drop') return { fail: true, at: sd.id, why: `${sd.name}: VACL "${filt[0]}" trên VLAN ${h.vlan} hủy gói ${pktLabel(pkt)} (không khớp dòng forward nào → drop ngầm định, hoặc khớp "action drop")` };
  }
  // IP Source Guard: cổng "ip verify source" chỉ nhận gói IP có nguồn đúng binding của CHÍNH cổng đó
  for (const h of res.hops) {
    const sd = net.devices[h.to];
    if (sd?.type !== 'switch' || !sd.ports[h.toPort]?.ipsg) continue;
    const vlan = inVlan(net, sd, h.toPort, h.tag);
    if (snoopBindings(sd).some((b) => b.ip === pkt.src && b.port === h.toPort && b.vlan === vlan)) continue;
    const why = `${sd.name} ${longIf(h.toPort)}: IP Source Guard hủy gói nguồn ${pkt.src} — không có binding DHCP snooping / "ip source binding" nào cho IP này trên cổng (máy tự đặt IP tĩnh hoặc giả mạo IP)`;
    if (R.on) R.proc(sd.id, { l: 3, title: `✗ ${sd.name}: IP Source Guard hủy gói`, ex: why + '.' });
    return { fail: true, at: sd.id, kind: 'ipsg', why };
  }
  if (R.on) {
    let prev = null;
    for (const h of res.hops) {
      const f = R.frame([...l2(h.tag, 0x0800, srcMac, res.mac), ...ipLayers(pkt)]);
      if (h === res.hops[0]) R.cap(f, pktLabel(pkt));
      const isSw = net.devices[h.from].type === 'switch';
      R.transit(h, f, {
        l: isSw ? 2 : 3, side: isSw ? 'forward' : 'encap', changed: prev ? diffFields(prev.tree, f.tree) : [],
        title: `${pktLabel(pkt)}${h.tag != null ? ` [tag VLAN ${h.tag}]` : ''}`,
        ex: isSw ? `Switch ${net.devices[h.from].name} chuyển tiếp frame theo bảng MAC${h.tag != null ? `; ra cổng trunk nên gắn nhãn 802.1Q VLAN ${h.tag}` : h.vlan != null ? `; ra cổng access VLAN ${h.vlan} nên KHÔNG gắn tag` : ''}.` : `Frame: MAC nguồn ${ciscoMac(srcMac)} → MAC đích ${ciscoMac(res.mac)} (next-hop ${nh}). IP nguồn/đích giữ nguyên ${pkt.src} → ${pkt.dst}.`,
      });
      prev = f;
    }
  }
  return { dev: res.ep.dev, ifn: res.ep.ifn };
}
function learnMacs(net, hops, mac) {
  for (const h of hops) {
    const d = net.devices[h.to];
    if (d.type !== 'switch') continue;
    const e = effPort(net, d, h.toPort);
    const vlan = e.mode === 'access' ? e.vlan : e.mode === 'private-vlan' ? e.pv?.primary : (h.tag ?? e.native);
    const port = e.bundle || h.toPort;
    if (!d.macTable.some((x) => x.mac === mac && x.vlan === vlan)) d.macTable.push({ vlan, mac, port });
    const c = d.ports[h.toPort];
    if (c?.ps?.enabled && e.mode === 'access' && !c.ps.macs.includes(mac) && c.ps.macs.length < (c.ps.max || 1)) c.ps.macs.push(mac);
  }
}

/** Đi 1 chiều: trả { ok, at:{dev,ifn}, hops } hoặc { ok:false, fail:{dev, kind, why, code, ip} }. */
function walk(ctx, R, pkt, start, opts = {}) {
  const net = ctx.net;
  let node = start;
  const hops = [];
  const fail = (dev, kind, why, code, ip) => {
    R.proc(dev, { title: `✗ ${net.devices[dev].name}: gói bị hủy`, ex: why, side: 'inspect' });
    return { ok: false, fail: { dev, kind, why, code, ip }, hops };
  };
  for (let guard = 0; guard < 48; guard++) {
    const d = net.devices[node.dev];
    let egress, nh;
    if (!isL3(d)) {
      const hi = hostInfo(net, d);
      if (!node.origin) {
        if (pkt.dst === hi.ip || (d.type === 'switch' && ownsIp(net, d, pkt.dst))) return { ok: true, at: { dev: node.dev, ifn: node.ifn }, hops };
        return fail(node.dev, 'drop', `${d.name} nhận gói gửi cho ${pkt.dst} (không phải mình) → bỏ.`, '.');
      }
      if (!hi.ip) return fail(node.dev, 'noip', `${d.name} chưa có địa chỉ IP${d.type === 'switch' ? ' quản lý (SVI chưa có IP hoặc chưa up)' : ''}.`, 'X');
      if (!pkt.src) pkt.src = hi.ip;
      const same = inNet(pkt.dst, hi.ip, hi.prefix);
      if (same) nh = pkt.dst;
      else {
        if (!hi.gw) return fail(node.dev, 'nogw', `${d.name}: ${pkt.dst} khác mạng ${netOf(hi.ip, hi.prefix)}/${hi.prefix} nhưng CHƯA đặt default gateway → không biết gửi đi đâu.`, 'X');
        if (!inNet(hi.gw, hi.ip, hi.prefix)) return fail(node.dev, 'nogw', `${d.name}: gateway ${hi.gw} KHÔNG cùng mạng với ${hi.ip}/${hi.prefix} → không ARP được gateway.`, 'X');
        nh = hi.gw;
      }
      R.proc(node.dev, { l: 3, side: 'encap', title: same ? `${d.name}: ${pkt.dst} cùng mạng → gửi trực tiếp` : `${d.name}: ${pkt.dst} khác mạng → gửi cho gateway ${nh}`, ex: `AND IP đích với mask /${hi.prefix}: ${same ? 'trùng' : 'khác'} mạng ${netOf(hi.ip, hi.prefix)}. ${same ? 'Cần MAC của chính đích.' : 'Gói vẫn mang IP đích ' + pkt.dst + ', nhưng frame gửi tới MAC của gateway.'}` });
      egress = { dev: node.dev, ifn: hi.ifn };
    } else {
      const IF = l3ifs(d);
      const inIf = node.origin ? null : node.ifn;
      const vrf = inIf ? IF[inIf]?.vrf || null : pkt.vrf || null;
      let changed = [];
      if (inIf) {
        const fi = IF[inIf];
        // ACL chiều vào: router IOS xét TRƯỚC NAT (thấy IP global); firewall (ASA 8.3+...) xét SAU khi đã
        // đổi về IP thật; gói trả lời của phiên firewall đã mở thì không xét ACL.
        const aclIn = () => {
          if (!fi.aclIn || node.decrypted || (d.fw && fwEstablished(ctx, d, pkt))) return null;
          const a = aclEval(d, fi.aclIn, pkt, ctx.record);
          if (a.action === 'deny') return fail(node.dev, 'acl', `${d.name}: ACL "${fi.aclIn}" (chiều IN trên ${longIf(inIf)}) chặn gói — ${a.implicit ? 'không khớp dòng permit nào → "deny any" NGẦM ĐỊNH cuối ACL' : 'khớp dòng: ' + aceText(d.acls[fi.aclIn].type, a.entry)}.`, d.fw ? '.' : 'U', fi.ip);
          return null;
        };
        const aclAfterNat = !!d.fw && d.fw.kind !== 'zbf'; // ZBF chạy trên router IOS → ACL vẫn xét trước NAT
        if (!aclAfterNat) { const x = aclIn(); if (x) return x; }
        if (fi.nat === 'outside' || d.fw) {
          const before = pkt.dst;
          const t = natOut2In(ctx, d, pkt);
          if (t) pkt.dst0 = before; // địa chỉ đích TRƯỚC NAT (Palo Alto khớp security rule theo địa chỉ này)
          if (t) { changed = ['ip.dst', 'ip.checksum']; R.proc(node.dev, { l: 3, side: 'forward', title: `${d.name} NAT: đích ${before} → ${pkt.dst}`, ex: `Gói vào cổng "ip nat outside" mang địa chỉ inside global ${before}; tra bảng NAT${t.stat ? ' (NAT tĩnh)' : ''} → đổi về inside local ${pkt.dst} rồi mới định tuyến.`, tables: natRows(ctx, d) }); }
        }
        if (aclAfterNat) { const x = aclIn(); if (x) return x; }
        if (fi.qosIn) {
          const q = qosEval(d, fi.qosIn, pkt, ctx.record);
          if (q?.drop) return fail(node.dev, 'qos', `${d.name}: policy-map ${fi.qosIn} (chiều IN trên ${longIf(inIf)}) có class ${q.cls} với hành động drop.`, '.');
          if (q?.dscp) pkt.dscp = q.dscp;
        }
        // uRPF: route ngược về IP nguồn phải tồn tại (loose) và đi đúng cổng vừa nhận (strict)
        if (fi.urpf) {
          const b = lookup(ctx, node.dev, pkt.src, vrf);
          if (!b || b.discard || (b.prefix === 0 && !fi.urpf.allowDefault) || (fi.urpf.mode === 'rx' && b.iface !== inIf)) {
            if (ctx.record) fi.urpfDrops = (fi.urpfDrops || 0) + 1;
            return fail(node.dev, 'urpf', `${d.name}: uRPF ${fi.urpf.mode} trên ${longIf(inIf)} bỏ gói nguồn ${pkt.src}: ${!b ? 'không có route về nguồn' : `route về nguồn đi ra ${longIf(b.iface)}, không phải cổng nhận`}.`, '.');
          }
        }
        if (ctx.record) flowCount(d, pkt, inIf, 'in');
        if (ownsIp(net, d, pkt.dst, vrf)) {
          // CoPP: lưu lượng gửi cho chính router đi qua policy trên control-plane
          const q = d.copp?.input ? qosEval(d, d.copp.input, pkt, ctx.record) : null;
          if (q?.drop || (q?.police != null && q.police < 8000)) return fail(node.dev, 'copp', `${d.name}: CoPP (control-plane) class ${q.cls} ${q.drop ? 'drop' : `police ${q.police} bps`} bỏ gói gửi cho router.`, '.');
          return { ok: true, at: { dev: node.dev, ifn: inIf }, hops };
        }
        pkt.ttl -= 1;
        hops.push({ dev: node.dev, ip: fi.ip });
        if (pkt.ttl <= 0) return fail(node.dev, 'ttl', `${d.name}: TTL về 0 → hủy gói (ICMP Time Exceeded). Có thể có vòng lặp định tuyến.`, '.');
      } else if (ownsIp(net, d, pkt.dst, vrf)) {
        return { ok: true, at: { dev: node.dev, ifn: null }, hops };
      }
      // PBR: gói vào cổng có "ip policy route-map" khớp match thì đi theo set ip next-hop (next-hop phải nối trực tiếp)
      let rt = null;
      if (inIf && IF[inIf].policy) {
        const st = rmPacket(d, IF[inIf].policy, pkt, ctx.record);
        const conn = st?.nextHop ? lookup(ctx, node.dev, st.nextHop, vrf) : null;
        if (conn?.code === 'C') {
          rt = { code: 'PBR', net: pkt.dst, prefix: 32, nextHop: st.nextHop, iface: conn.iface };
          R.proc(node.dev, { l: 3, side: 'forward', title: `${d.name} PBR: route-map ${IF[inIf].policy} → next-hop ${st.nextHop}`, ex: 'Policy-based routing quyết định trước bảng định tuyến, dựa trên nguồn hoặc cổng trong ACL.' });
        }
      }
      rt ||= lookup(ctx, node.dev, pkt.dst, vrf);
      if (rt?.discard) return fail(node.dev, 'null0', `${d.name}: ${pkt.dst} khớp route ${rt.net}/${rt.prefix} trỏ về Null0 (route tóm tắt chống lặp) → hủy gói.`, 'U');
      if (!rt) return fail(node.dev, 'noroute', `${d.name}: KHÔNG có route nào khớp ${pkt.dst} (kể cả default route) → hủy gói, báo ICMP Destination Unreachable.`, 'U', inIf ? IF[inIf].ip : null);
      const outIf = rt.iface;
      nh = rt.fwdNh || rt.nextHop || pkt.dst; // BGP: next-hop xa đã phân giải đệ quy qua IGP
      if (!pkt.src) pkt.src = IF[outIf].ip;
      R.proc(node.dev, { l: 3, side: 'forward', changed, title: `${d.name} tra bảng định tuyến: ${pkt.dst} → ${rt.code} ${rt.net}/${rt.prefix}`, ex: `Longest-prefix match chọn ${rt.code} ${rt.net}/${rt.prefix}${rt.nextHop ? ` via ${rt.nextHop}` : ' (mạng nối trực tiếp)'} ra ${longIf(outIf)}.${inIf ? ` TTL ${pkt.ttl + 1}→${pkt.ttl}, tính lại checksum IP.` : ''}`, tables: routeRows(ctx, node.dev, rt) });
      // Firewall stateful (ASA / ZBF / rule base): xét trên địa chỉ THẬT, trước NAT chiều ra
      let fwv = null;
      if (inIf && d.fw) {
        fwv = fwCheck(ctx, d, pkt, inIf, outIf);
        if (R.on) flowRecord(ctx.net, d.id, pkt, inIf, outIf, fwv);
        if (!fwv.allow) return fail(node.dev, 'fw', `${d.name} (firewall) chặn gói ${pkt.src} → ${pkt.dst}${pkt.proto !== 'icmp' ? ' ' + pkt.proto + '/' + pkt.dport : ' (ICMP ' + (pkt.reply ? 'echo-reply' : 'echo') + ')'}: ${fwv.why}.`, '.', IF[inIf].ip);
        R.proc(node.dev, { l: 4, side: 'inspect', title: `${d.name} firewall: ${fwv.established ? 'phiên đã mở → cho qua' : 'cho qua'}`, ex: fwv.why + '.' });
        if (fwv.snat) {
          const before = pkt.src;
          const t = fwSnat(ctx, d, pkt, outIf, fwv.snat);
          if (t) R.proc(node.dev, { l: 3, side: 'forward', title: `${d.name} NAT nguồn: ${before} → ${pkt.src}`, ex: 'Rule firewall bật NAT nguồn: đổi IP nguồn sang IP cổng ra (PAT), phân biệt bằng port/ICMP id.', tables: natRows(ctx, d) });
        }
      }
      if (inIf && d.type === 'router' && IF[inIf].nat === 'inside' && IF[outIf].nat === 'outside') {
        const before = pkt.src;
        const t = natIn2Out(ctx, d, pkt, outIf);
        if (t && t.exhausted) return fail(node.dev, 'nat', `${d.name}: NAT pool "${t.pool}" đã HẾT địa chỉ (NAT động 1:1 — mỗi máy bên trong giữ riêng 1 IP public cho tới khi xoá translation) → hủy gói. Cách xử lý: "clear ip nat translation *", mở rộng pool, hoặc thêm "overload".`, 'U', IF[inIf].ip);
        if (t) R.proc(node.dev, { l: 3, side: 'forward', title: `${d.name} NAT: nguồn ${before} → ${pkt.src}`, ex: `Đi từ cổng "ip nat inside" ra "ip nat outside"${t.stat ? ' — NAT tĩnh' : t.pool ? ` — lấy IP từ NAT pool "${t.pool}"${t.port != null ? ' (overload)' : ' (1:1)'}` : ` — PAT (overload) dùng IP cổng ${longIf(outIf)}, phân biệt bằng ${pkt.proto === 'icmp' ? 'ICMP ID' : 'port'} ${t.port}`}.`, tables: natRows(ctx, d) });
        else R.proc(node.dev, { l: 3, side: 'forward', title: `${d.name}: KHÔNG NAT cho ${before}`, ex: `Gói đi inside → outside nhưng ${before} không khớp quy tắc NAT nào (ACL của "ip nat inside source list" không permit dải này) → đi ra với IP gốc.` });
      }
      const fo = IF[outIf];
      if (ctx.record) flowCount(d, pkt, outIf, 'out');
      if (fo.qosOut) {
        const q = qosEval(d, fo.qosOut, pkt, ctx.record);
        if (q?.drop) return fail(node.dev, 'qos', `${d.name}: policy-map ${fo.qosOut} (chiều OUT trên ${longIf(outIf)}) có class ${q.cls} với hành động drop.`, '.');
        if (q?.dscp) pkt.dscp = q.dscp;
      }
      if (fo.aclOut && !(d.fw && fwEstablished(ctx, d, pkt))) {
        const a = aclEval(d, fo.aclOut, pkt, ctx.record);
        if (a.action === 'deny') return fail(node.dev, 'acl', `${d.name}: ACL "${fo.aclOut}" (chiều OUT trên ${longIf(outIf)}) chặn gói — ${a.implicit ? 'không khớp dòng permit nào → "deny any" NGẦM ĐỊNH' : 'khớp dòng: ' + aceText(d.acls[fo.aclOut].type, a.entry)}.`, 'U', inIf ? IF[inIf].ip : fo.ip);
      }
      // GRE: ra cổng tunnel → bọc gói gốc trong IP/GRE (proto 47) gửi qua underlay tới đầu kia
      if (d.type === 'router' && outIf.startsWith('tu')) {
        const mg = fo.tunMode === 'mgre';
        const peer = mg ? nhrpResolve(net, d, outIf, nh, pkt.dst) : tunnelPeer(net, d, outIf);
        if (!peer) return fail(node.dev, 'tunnel', mg ? `${d.name}: NHRP không phân giải được ${nh} ra địa chỉ NBMA trên ${longIf(outIf)} (kiểm tra ip nhrp nhs, map, network-id).` : `${d.name}: ${longIf(outIf)} không có đầu kia khớp (tunnel source/destination 2 bên phải đối xứng) hoặc underlay không tới được ${fo.tunDst}.`, '.');
        const tsrc = tunnelSrcIp(d, fo), tdst = mg ? peer.nbma : fo.tunDst;
        // DMVPN pha 3: hub thấy gói vào và ra cùng cổng mGRE thì gửi NHRP redirect, spoke có shortcut lưu đường đi thẳng
        if (mg && inIf === outIf && fo.nhrp?.redirect && ctx.record && node.tunFrom) {
          const sp = net.devices[node.tunFrom];
          if (sp.ifaces[node.tunFromIf]?.nhrp?.shortcut && peer.dev !== sp.id) {
            sp.nhrpCache = (sp.nhrpCache || []).filter((e) => !(e.net === rt.net && e.prefix === rt.prefix));
            sp.nhrpCache.push({ ifn: node.tunFromIf, net: rt.net, prefix: rt.prefix, peer: peer.dev, peerIf: peer.ifn, nbma: peer.nbma, ip: peer.ip });
            R.proc(node.dev, { l: 3, side: 'forward', title: `${d.name}: NHRP redirect tới ${sp.name}`, ex: `Gói vào và ra cùng ${longIf(outIf)}. Hub báo cho ${sp.name} rằng ${rt.net}/${rt.prefix} nằm sau ${peer.nbma}, các gói sau sẽ đi thẳng.` });
          }
        }
        R.proc(node.dev, { l: 3, side: 'encap', title: `${d.name}: đóng gói GRE → ${tdst}`, ex: `Gói ${pkt.src} → ${pkt.dst} ra ${longIf(outIf)}: router thêm header GRE + IP mới ${tsrc} → ${fo.tunDst} (protocol 47). Internet chỉ định tuyến theo IP ngoài; gói gốc nằm nguyên bên trong (GRE KHÔNG mã hoá).` });
        const outer = { src: tsrc, dst: tdst, proto: fo.tunProtect ? 'esp' : 'gre', ttl: 255, ipId: 0x6e6e, inner: `${pkt.src} → ${pkt.dst}` };
        const tun = walk(ctx, R, outer, { dev: node.dev, ifn: null, origin: true }, opts);
        if (!tun.ok) return { ok: false, fail: { ...tun.fail, why: '(GRE underlay) ' + tun.fail.why }, hops };
        R.proc(peer.dev, { l: 3, side: 'decap', title: `${net.devices[peer.dev].name}: gỡ GRE → gói gốc ${pkt.src} → ${pkt.dst}`, ex: `Gói tới ${longIf(peer.ifn)} của đầu kia, bỏ header ngoài và định tuyến tiếp gói gốc.` });
        node = { dev: peer.dev, ifn: peer.ifn, tunFrom: node.dev, tunFromIf: outIf };
        continue;
      }
      // IPsec: gói "interesting" ra cổng có crypto map → mã hoá ESP, đi qua Internet tới peer
      if (d.type === 'router' && fo.cryptoMap && !opts.noCrypto) {
        const hit = cryptoMatch(d, outIf, pkt);
        if (hit) {
          if (ctx.record) hit.e.tried = true; // IOS chỉ dựng SA khi có "interesting traffic"
          const st = vpnState(net, d, outIf, hit, pkt);
          if (!st.up) return fail(node.dev, 'vpn', `${d.name}: gói ${pkt.src} → ${pkt.dst} là "interesting traffic" của crypto map ${hit.map} nhưng ĐƯỜNG HẦM IPsec CHƯA LÊN — ${st.why}.`, '.');
          if (ctx.record) { hit.e.encaps = (hit.e.encaps || 0) + 1; const pm = st.peer.crypto.maps[st.peer.ifaces[st.peerIfn].cryptoMap]; const pe = Object.values(pm).find((x) => x.peer === st.localIp); if (pe) pe.decaps = (pe.decaps || 0) + 1; }
          R.proc(node.dev, { l: 3, side: 'encap', title: `${d.name}: mã hoá IPsec (ESP) → gửi tới peer ${hit.e.peer}`, ex: `Gói ${pkt.src} → ${pkt.dst} khớp ACL "${hit.e.acl}" của crypto map ${hit.map} ${hit.seq}. Router bọc NGUYÊN gói vào ESP (đã mã hoá) với header IP mới ${st.localIp} → ${hit.e.peer}. Trên Internet chỉ thấy 2 IP public của 2 router.` });
          const outer = { src: st.localIp, dst: hit.e.peer, proto: 'esp', ttl: 255, ipId: 0x5e5e, inner: `${pkt.src} → ${pkt.dst}` };
          const tun = walk(ctx, R, outer, { dev: node.dev, ifn: null, origin: true }, { noCrypto: true });
          if (!tun.ok) return { ok: false, fail: { ...tun.fail, why: '(đường hầm) ' + tun.fail.why }, hops };
          R.proc(st.peer.id, { l: 3, side: 'decap', title: `${st.peer.name}: giải mã ESP → lấy lại gói gốc ${pkt.src} → ${pkt.dst}`, ex: 'Peer kiểm tra SA, giải mã rồi định tuyến tiếp gói gốc vào mạng LAN của mình.' });
          node = { dev: st.peer.id, ifn: st.peerIfn, decrypted: true };
          continue;
        }
      }
      egress = { dev: node.dev, ifn: outIf };
    }
    const arr = deliverL2(ctx, R, egress, nh, pkt);
    if (arr.fail) return fail(arr.at || egress.dev, arr.kind || (arr.at ? 'vacl' : 'arp'), `${arr.at ? '' : net.devices[egress.dev].name + ': '}${arr.why}.`, '.');
    node = { dev: arr.dev, ifn: arr.ifn };
  }
  return fail(node.dev, 'loop', 'Vòng lặp định tuyến — gói chạy vòng tới khi hết TTL.', '.');
}
function natRows(ctx, d) {
  const rows = ctx.nat.filter((e) => e.rid === d.id).map((e) => ({ insideLocal: e.il + (e.port != null ? ':' + e.port : ''), insideGlobal: e.ig + (e.port != null ? ':' + (e.gport ?? e.port) : ''), outside: e.outside, proto: e.proto }));
  return { nat: { title: `Bảng NAT ${d.name}`, rows } };
}
/** ufw: luật đầu tiên khớp quyết định, không khớp luật nào thì chặn (mặc định deny incoming). */
export function ufwAllows(d, port, src) {
  for (const r of d.ufw.rules) {
    const [ip, len] = String(r.from || '').split('/');
    if ((r.port == null || r.port === port) && (!r.from || inNet(src, ip, len == null ? 32 : +len))) return r.action === 'allow';
  }
  return false;
}
export function portOpen(d, port) {
  if (d.type === 'pc' || d.type === 'server') return (d.services || []).includes(port);
  const tr = d.lines.vty.transport || 'all';
  if (port === 23) return tr === 'all' || tr.includes('telnet');
  if (port === 22) return (tr === 'all' || tr.includes('ssh')) && sshReady(d);
  if (port === 80) return !!d.httpServer;
  if (port === 443) return !!d.httpsServer;
  if (port === 830) return !!d.netconf;
  return false;
}
export function sshReady(d) {
  // "aaa new-model": VTY xác thực theo method list (mặc định = local) thay cho "login local"
  return !!d.domain && d.rsa >= 768 && (!!d.lines.vty.loginLocal || !!d.aaa?.newModel) && Object.keys(d.users).length > 0;
}
/** Đồng hồ cho "login block-for" (thay được trong test). */
export const clock = { now: () => Date.now() };
/** Router/switch đang ở "quiet mode" sau quá nhiều lần đăng nhập sai (login block-for). */
export function loginQuiet(d) { return (d.loginSec?.quietUntil || 0) > clock.now(); }
/** Ghi 1 lần đăng nhập VTY sai; đủ "attempts" lần trong "within" giây → quiet mode "block-for" giây. */
export function loginFailed(d) {
  const L = d.loginSec;
  if (!L?.blockFor) return false;
  const now = clock.now();
  L.fails = (L.fails || []).filter((t) => now - t < L.within * 1000).concat(now);
  if (L.fails.length < L.attempts) return false;
  L.fails = [];
  L.quietUntil = now + L.blockFor * 1000;
  L.quietCount = (L.quietCount || 0) + 1;
  secLog(d, `%SEC_LOGIN-1-QUIET_MODE_ON: Still timeleft for watching failures is ${L.within} secs, [user: ] [Source: ] [localport: 22] [Reason: Login Authentication Failed] [ACL: ${L.quietAcl || 'sl_def_acl'}]`);
  return true;
}

/**
 * Gửi 1 gói từ thiết bị `src` tới IP `dst` và chờ trả lời.
 * o = { src, dst, proto:'icmp'|'tcp', dport, record, anim }
 * Trả { ok, kind, fail, hops, sim, firstArp, open, ttl }.
 */
export function sendPacket(net, o) {
  const prevRec = RECORDING;
  RECORDING = !!o.record;
  try { return sendPacketInner(net, o); } finally { RECORDING = prevRec; }
}
/** debug ip packet: router đang bật debug in từng gói IP mà nó gửi / nhận. */
function debugPackets(net, pkts) {
  for (const p of pkts) {
    const ip = p.layers.find((l) => l.proto === 'ipv4')?.fields;
    if (!ip) continue;
    for (const [id, act] of [[p.from, 'sending'], [p.to, 'rcvd 3']]) if (net.devices[id]?.debug?.ipPacket && debugCond(net, id, ip, p)) logPush(net, id, `IP: s=${ip.src}, d=${ip.dst}, len ${Math.max(0, p.len - 14)}, ${act}`, true);
  }
}
/** debug condition: chỉ in gói khớp IP hoặc đi qua cổng đã khai. */
function debugCond(net, id, ip, p) {
  const c = net.devices[id].debug.cond;
  if (!c) return true;
  if (c.ip && ip.src !== c.ip && ip.dst !== c.ip) return false;
  if (c.ifn) { const l = net.links.find((x) => x.id === p.link); if (!l || (l.a === id ? l.ap : l.b === id ? l.bp : null) !== c.ifn) return false; }
  return true;
}
/** NetFlow: gom gói theo 5-tuple trên cổng bật "ip flow" hoặc "ip flow monitor". */
function flowCount(d, pkt, ifn, dir) {
  const f = l3ifs(d)[ifn];
  if (!f?.flow?.[dir]) return;
  const k = [pkt.src, pkt.dst, pkt.proto, pkt.sport ?? 0, pkt.dport ?? 0, ifn, dir].join('|');
  const c = (d.flowCache ||= {});
  const n = pkt.proto === 'icmp' ? 5 : 1;
  (c[k] ||= { src: pkt.src, dst: pkt.dst, proto: pkt.proto, sport: pkt.proto === 'icmp' ? 0 : pkt.sport, dport: pkt.proto === 'icmp' ? 0 : pkt.dport, ifn, dir, pkts: 0, monitor: f.flow[dir] }).pkts += n;
}
function sendPacketInner(net, o) {
  const ctx = makeCtx(net, !!o.record);
  const R = new Rec(net, !!o.anim || !!o.record); // lệnh có record mới vào nhật ký gói (tcpdump...), kiểm tra ngầm thì không
  const srcDev = net.devices[o.src];
  const isHost = srcDev.type === 'pc' || srcDev.type === 'server';
  const proto = o.proto || 'icmp';
  // ICMP id / port nguồn: máy trạm dùng 1, router/switch tự phát dùng giá trị khác — như thiết bị thật, để gói
  // trả lời cho chính router không khớp nhầm entry PAT của máy bên trong (cùng IP global của cổng outside)
  const id0 = o.icmpId || (isHost ? 1 : 0x7a69);
  // TTL gốc: máy kiểu Windows / Packet Tracer 128, VPCS (EVE-NG/GNS3) 64, router/switch Cisco 255
  const hostTtl = (d) => (d.shell ? 64 : 128);
  const pkt = { src: o.srcIp || null, dst: o.dst, proto, ttl: isHost ? hostTtl(srcDev) : 255, ipId: 0x1a2b, icmpId: id0, seq: 1, reply: false, vrf: o.vrf || null, sport: 49152 + (id0 % 16384), dport: o.dport, flags: { syn: true }, tseq: 1000, tack: 0 };
  const wopts = { noCrypto: !!o.noCrypto };
  const done = (r) => {
    if (o.record) { persistNat(net, ctx); persistFw(net, ctx); }
    const sim = R.on ? R.sim.result() : null;
    if (sim) debugPackets(net, sniffRecord(net, sim.events));
    return { ...r, sim: o.anim ? sim : null, firstArp: ctx.firstArp };
  };
  const fwd = walk(ctx, R, pkt, { dev: o.src, ifn: null, origin: true }, wopts);
  if (!fwd.ok) return done({ ok: false, kind: fwd.fail.code === 'U' ? 'unreach' : 'timeout', fail: fwd.fail, hops: fwd.hops });
  const dd = net.devices[fwd.at.dev];
  if (proto !== 'icmp' && dd.ufw?.on && !ufwAllows(dd, pkt.dport, pkt.src)) {
    const why = `ufw trên ${dd.name} chặn cổng ${pkt.dport} từ ${pkt.src}: gói bị bỏ im lặng nên bên gửi chỉ thấy timeout, không thấy "refused".`;
    R.proc(fwd.at.dev, { l: 4, side: 'decap', title: `✗ ufw trên ${dd.name} bỏ gói tới cổng ${pkt.dport}`, ex: why });
    return done({ ok: false, kind: 'timeout', fail: { dev: dd.id, kind: 'hostfw', why, code: '.' }, hops: fwd.hops });
  }
  let open = true;
  const replyVrf = isL3(dd) && fwd.at.ifn ? l3ifs(dd)[fwd.at.ifn]?.vrf || null : pkt.vrf;
  const reply = { ...pkt, vrf: replyVrf, dst0: undefined, src: pkt.dst, dst: pkt.src, reply: true, ttl: dd.type === 'router' || dd.type === 'switch' ? 255 : hostTtl(dd), ipId: 0x3c4d };
  if (proto === 'tcp') {
    open = portOpen(dd, pkt.dport);
    // access-class trên VTY: chỉ cho phép nguồn nằm trong ACL quản trị
    if (open && (dd.type === 'router' || dd.type === 'switch') && (pkt.dport === 22 || pkt.dport === 23) && dd.lines.vty.accessClass && aclEval(dd, dd.lines.vty.accessClass, { src: pkt.src }, o.record).action !== 'permit') open = false;
    // quiet mode (login block-for): từ chối mọi kết nối VTY, trừ nguồn trong "login quiet-mode access-class"
    if (open && (pkt.dport === 22 || pkt.dport === 23) && dd.loginSec && loginQuiet(dd) && !(dd.loginSec.quietAcl && aclEval(dd, dd.loginSec.quietAcl, { src: pkt.src }, false).action === 'permit')) open = false;
    Object.assign(reply, { sport: pkt.dport, dport: pkt.sport, flags: open ? { syn: true, ack: true } : { rst: true, ack: true }, tseq: 5000, tack: 1001 });
  }
  R.proc(fwd.at.dev, { l: proto === 'icmp' ? 3 : 4, side: 'decap', title: `${dd.name} nhận gói → ${proto === 'icmp' ? 'trả ICMP Echo Reply' : open ? `cổng ${pkt.dport} MỞ → trả SYN-ACK` : `cổng ${pkt.dport} ĐÓNG/bị từ chối → trả RST`}`, ex: `Gói tới đúng đích ${pkt.dst} (nguồn nhìn thấy: ${pkt.src}). Chiều về cũng phải đi qua mạng: mỗi router trên đường về cần có route tới ${pkt.src}.` });
  const back = walk(ctx, R, reply, { dev: fwd.at.dev, ifn: null, origin: true }, wopts);
  if (!back.ok) return done({ ok: false, kind: 'timeout', fail: { ...back.fail, code: '.', why: '(chiều VỀ) ' + back.fail.why }, hops: fwd.hops, replyLeg: true });
  if (back.at.dev !== o.src) return done({ ok: false, kind: 'timeout', fail: { dev: back.at.dev, kind: 'misdeliver', why: 'Gói trả lời tới nhầm thiết bị.', code: '.' }, hops: fwd.hops });
  if (R.on) R.proc(o.src, { l: proto === 'icmp' ? 3 : 4, side: 'decap', title: proto === 'icmp' ? `✓ ${srcDev.name} nhận Echo Reply — ping thành công` : open ? `✓ Kết nối TCP tới ${pkt.dst}:${pkt.dport} mở được` : `✗ Cổng ${pkt.dport} bị từ chối (RST)`, ex: proto === 'icmp' ? 'Cả chiều đi và chiều về đều thông.' : open ? 'Bắt tay 3 bước: SYN → SYN-ACK → ACK.' : 'Đích trả RST: mạng thông nhưng dịch vụ không mở cổng này (hoặc access-class chặn).' });
  return done({ ok: proto === 'icmp' ? true : open, kind: proto === 'icmp' ? 'reply' : open ? 'open' : 'refused', hops: fwd.hops, open, at: fwd.at, ttl: reply.ttl });
}
function persistNat(net, ctx) {
  for (const e of ctx.nat) {
    const r = net.devices[e.rid];
    if (!r.natTable.some((x) => x.il === e.il && x.ig === e.ig && x.port === e.port && x.outside === e.outside && x.proto === e.proto)) r.natTable.push({ ...e });
  }
}

// ======================================================================
// DHCP (DORA, có relay ip helper-address, DHCP snooping)
// ======================================================================
function findPool(d, ip) { return Object.entries(d.dhcp?.pools || {}).find(([, p]) => p.net && inNet(ip, p.net, p.prefix)); }
function excluded(d, ip) { const n = ip2n(ip); return d.dhcp.excluded.some(([a, b]) => n >= ip2n(a) && n <= ip2n(b || a)); }
export function dhcpRequest(net, pcId, o = {}) {
  const prevRec = RECORDING;
  RECORDING = !!o.record;
  try { return dhcpInner(net, pcId, o); } finally { RECORDING = prevRec; }
}
function dhcpInner(net, pcId, o) {
  const ctx = makeCtx(net, !!o.record);
  const R = new Rec(net, !!o.anim);
  const pcd = net.devices[pcId];
  const mac = epMac(net, { dev: pcId, ifn: 'fa0' });
  const diag = [];
  const reach = flood(net, { dev: pcId, ifn: 'fa0' }, diag);
  // Mọi DHCP server (hoặc relay) trong miền quảng bá đều trả OFFER — máy trạm nhận OFFER đến TRƯỚC (gần nhất).
  // Vì vậy một router/Wi-Fi "lạ" cắm vào LAN có pool là thắng server thật → DHCP snooping để chặn.
  const cands = [];
  for (const t of reach.values()) {
    const d = net.devices[t.dev];
    if ((d.type !== 'router' && d.type !== 'switch') || !ifUp(net, t.dev, t.ifn)) continue;
    const f = l3ifs(d)[t.ifn];
    if (!f?.ip) continue;
    const local = findPool(d, f.ip);
    if (local) { cands.push({ dev: d, pool: local[1], name: local[0], t, gi: f.ip }); continue; }
    if (!isL3(d)) continue;
    for (const h of f.helper || []) {
      const S = Object.values(net.devices).find((x) => isL3(x) && Object.entries(l3ifs(x)).some(([n, ff]) => ff.ip === h && ifUp(net, x.id, n)));
      if (!S || (S.id !== d.id && !lookup(ctx, d.id, h))) continue;
      const pl = findPool(S, f.ip);
      if (pl) { cands.push({ dev: S, pool: pl[1], name: pl[0], t, gi: f.ip, relay: { dev: d, ifn: t.ifn, helper: h } }); break; }
    }
  }
  // DHCP snooping: OFFER/ACK (server → client) chỉ được vào switch qua cổng TRUSTED
  const snoopBlock = (c) => {
    for (const h of c.t.hops) {
      const sd = net.devices[h.from];
      if (sd.type !== 'switch' || !sd.snoop.enabled) continue;
      const e = effPort(net, sd, h.fromPort);
      const vlan = h.vlan ?? (e.mode === 'access' ? e.vlan : e.native);
      if (!sd.snoop.vlans.includes(vlan)) continue;
      if (sd.ports[h.fromPort].trust || (e.bundle && sd.ports[e.bundle]?.trust)) continue;
      if (o.record) secLog(sd, `%DHCP_SNOOPING-5-DHCP_SNOOPING_UNTRUSTED_PORT: DHCP_SNOOPING drop message on untrusted port, message type: DHCPOFFER, MAC sa: ${ciscoMac(epMac(net, c.t))}`);
      return { sd, why: `DHCP snooping trên ${sd.name} chặn DHCP OFFER của ${c.dev.name} đi vào từ cổng UNTRUSTED ${longIf(h.fromPort)} (cổng hướng về DHCP server hợp lệ phải "ip dhcp snooping trust")` };
    }
    return null;
  };
  let srv = null;
  const dropped = [];
  for (const c of cands) {
    const b = snoopBlock(c);
    if (b) { dropped.push(b); continue; }
    srv = c;
    break;
  }
  const xid = 0x3903f326;
  const disc = (hops) => {
    if (!R.on) return;
    for (const h of hops) {
      const f = R.frame([...l2(h.tag, 0x0800, mac, 'ff:ff:ff:ff:ff:ff'), { proto: 'ipv4', fields: { src: '0.0.0.0', dst: '255.255.255.255', ttl: 128, id: 0x11, protocol: 17 } }, { proto: 'udp', fields: { srcPort: 68, dstPort: 67 } }, { proto: 'dhcp', fields: { op: 1, xid, flags: 0x8000, chaddr: mac, options: [{ code: 53, data: [1] }, { code: 55, data: [1, 3, 6] }] } }]);
      if (h === hops[0]) R.cap(f, 'DHCP Discover');
      R.transit(h, f, { l: 7, title: 'DHCP DISCOVER (broadcast)', ex: `${pcd.name} chưa có IP → gửi từ 0.0.0.0 tới 255.255.255.255 (UDP 68→67) để tìm DHCP server.` });
    }
  };
  const showDropped = () => { for (const b of dropped) R.proc(b.sd.id, { l: 7, title: `✗ ${b.sd.name}: DHCP snooping chặn OFFER`, ex: b.why + '.' }); };
  if (!srv && dropped.length) {
    disc(cands[0].t.hops);
    showDropped();
    return { ok: false, why: dropped[0].why, sim: R.on ? R.sim.result() : null };
  }
  if (!srv) {
    disc([...reach.values()][0]?.hops || []);
    R.proc(pcId, { title: '✗ Không có DHCP server trả lời → APIPA 169.254.x.x', ex: `Không router nào trong miền quảng bá có pool phù hợp hoặc ip helper-address tới server có pool cho subnet này.${diag.length ? ' Dọc đường: ' + diag.join('; ') : ''}` });
    return { ok: false, why: diag.join('; '), sim: R.on ? R.sim.result() : null };
  }
  const { dev: S, pool } = srv;
  // chọn địa chỉ
  const used = new Set();
  for (const d of Object.values(net.devices)) {
    if ((d.type === 'pc' || d.type === 'server') && d.ip && d.id !== pcId) used.add(d.ip);
    if (d.type === 'router') for (const f of Object.values(d.ifaces)) if (f.ip) used.add(f.ip);
    if (d.type === 'switch') for (const s of Object.values(d.svis)) if (s.ip) used.add(s.ip);
  }
  let addr = S.dhcp.bindings.find((b) => b.mac === mac)?.ip || null;
  if (!addr) {
    const base = ip2n(pool.net), size = 2 ** (32 - pool.prefix);
    for (let n = base + 1; n < base + size - 1; n++) {
      const ip = n2ip(n);
      if (used.has(ip) || excluded(S, ip) || S.dhcp.bindings.some((b) => b.ip === ip)) continue;
      addr = ip;
      break;
    }
  }
  if (!addr) return { ok: false, why: `Pool ${srv.name} hết địa chỉ`, sim: R.on ? R.sim.result() : null };
  if (o.record && !S.dhcp.bindings.some((b) => b.mac === mac)) S.dhcp.bindings.push({ ip: addr, mac, pool: srv.name });
  // DHCP snooping: switch thấy ACK đi qua → ghi binding (MAC, IP, VLAN, cổng phía máy trạm)
  if (o.record) {
    for (const h of srv.t.hops) {
      const sd = net.devices[h.to];
      if (sd?.type !== 'switch' || !sd.snoop.enabled || !sd.ports[h.toPort]) continue;
      const vlan = inVlan(net, sd, h.toPort, h.tag);
      if (!sd.snoop.vlans.includes(vlan) || portFlag(net, sd, h.toPort, 'trust')) continue;
      const B = (sd.snoop.bindings ||= []);
      for (let i = B.length - 1; i >= 0; i--) if (B[i].mac === mac || (B[i].ip === addr && B[i].vlan === vlan)) B.splice(i, 1);
      B.push({ mac, ip: addr, vlan, port: h.toPort, lease: 86400 });
    }
  }
  if (R.on) {
    const sip = srv.relay ? srv.relay.helper : srv.gi;
    const opts = (t) => [{ code: 53, data: [t] }, { code: 1, data: parseIp(prefixToMask(pool.prefix)) }, ...(pool.router ? [{ code: 3, data: parseIp(pool.router) }] : []), ...(pool.dns ? [{ code: 6, data: parseIp(pool.dns) }] : []), { code: 51, data: [0, 1, 81, 128] }, { code: 54, data: parseIp(sip) }];
    const smac = epMac(net, srv.t);
    const reply = (t, label) => {
      for (const h of [...srv.t.hops].reverse()) {
        const f = R.frame([...l2(h.tag, 0x0800, smac, 'ff:ff:ff:ff:ff:ff'), { proto: 'ipv4', fields: { src: srv.gi, dst: '255.255.255.255', ttl: 255, id: 0x22, protocol: 17 } }, { proto: 'udp', fields: { srcPort: 67, dstPort: 68 } }, { proto: 'dhcp', fields: { op: 2, xid, flags: 0x8000, yiaddr: addr, siaddr: sip, giaddr: srv.relay ? srv.gi : '0.0.0.0', chaddr: mac, options: opts(t) } }]);
        if (h === srv.t.hops[srv.t.hops.length - 1]) R.cap(f, `DHCP ${label}`);
        R.transit({ ...h, from: h.to, to: h.from }, f, { l: 7, side: 'decap', title: `DHCP ${label}: ${addr}/${pool.prefix}`, ex: `Server ${S.name} (pool ${srv.name}) ${t === 2 ? 'đề nghị' : 'xác nhận'} IP ${addr}, gateway ${pool.router || '(chưa đặt default-router)'}, DNS ${pool.dns || '-'}.` });
      }
    };
    disc(srv.t.hops);
    showDropped();
    if (srv.relay) R.proc(srv.relay.dev.id, { l: 7, side: 'forward', title: `${srv.relay.dev.name} relay DHCP → ${srv.relay.helper}`, ex: `Router không chuyển broadcast, nhưng "ip helper-address ${srv.relay.helper}" trên ${longIf(srv.relay.ifn)} biến DISCOVER thành unicast gửi tới server, điền giaddr = ${srv.gi} để server chọn đúng pool.` });
    reply(2, 'OFFER');
    for (const h of srv.t.hops) {
      const f = R.frame([...l2(h.tag, 0x0800, mac, 'ff:ff:ff:ff:ff:ff'), { proto: 'ipv4', fields: { src: '0.0.0.0', dst: '255.255.255.255', ttl: 128, id: 0x12, protocol: 17 } }, { proto: 'udp', fields: { srcPort: 68, dstPort: 67 } }, { proto: 'dhcp', fields: { op: 1, xid, flags: 0x8000, chaddr: mac, options: [{ code: 53, data: [3] }, { code: 50, data: parseIp(addr) }, { code: 54, data: parseIp(sip) }] } }]);
      R.transit(h, f, { l: 7, title: 'DHCP REQUEST', ex: `${pcd.name} xin chính thức IP ${addr}.` });
    }
    reply(5, 'ACK');
  }
  return { ok: true, ip: addr, prefix: pool.prefix, gw: pool.router || '', dns: pool.dns || '', server: S.name, sim: R.on ? R.sim.result() : null };
}

// ======================================================================
// STP (Root Bridge theo priority/MAC) & VTP
// ======================================================================
/** Bridge priority + sys-id-ext (PVST: theo VLAN; MST: theo instance chứa VLAN). */
export function stpPriority(d, vlan) {
  if (d.stp.mode === 'mst' && d.stp.mst) {
    const inst = +(Object.entries(d.stp.mst.inst || {}).find(([, vl]) => vl.includes(vlan))?.[0] ?? 0);
    return (d.stp.mst.prio?.[inst] ?? 32768) + inst;
  }
  return (d.stp.prio[vlan] ?? 32768) + vlan;
}
export function stpRoot(net, vlan) {
  const sws = Object.values(net.devices).filter((d) => d.type === 'switch' && d.vlans[vlan]);
  sws.sort((a, b) => stpPriority(a, vlan) - stpPriority(b, vlan) || (switchMac(net, a.id) < switchMac(net, b.id) ? -1 : 1));
  return sws[0] || null;
}
const STP_COST = { g: 4, fa: 19, e: 100 };
/** Cost STP (short) của cổng logic: 1G = 4, 100M = 19; EtherChannel ≥ 2 sợi rẻ hơn (2×1G = 3, 2×100M = 12). */
function stpCost(net, d, members) {
  const base = { 10: 100, 100: 19, 1000: 4 }[ethMode(net, d.id, members[0]).speed] ?? STP_COST[kindOf(members[0])] ?? 19;
  return members.length >= 2 ? ({ 4: 3, 19: 12 }[base] ?? base) : base;
}
const bidCmp = (net, v) => (a, b) => stpPriority(a, v) - stpPriority(b, v) || (switchMac(net, a.id) < switchMac(net, b.id) ? -1 : switchMac(net, a.id) > switchMac(net, b.id) ? 1 : 0);
/**
 * STP (802.1D/PVST) cho 1 VLAN: mỗi miền switch liền nhau bầu Root Bridge (priority + MAC thấp nhất),
 * mỗi switch chọn Root Port (cost tới root thấp nhất → bridge ID láng giềng → cổng), mỗi đoạn dây
 * switch–switch có 1 Designated Port; cổng còn lại là Alternate/BLOCKING. EtherChannel = 1 cổng logic.
 * Trả { root: {devId: rootId}, dist: {devId: cost}, ports: {'dev|cổng': {role, sts, cost, peer}} }.
 */
export function stpState(net, v) {
  // Root Guard / Loop Guard: cổng vi phạm bị cắt khỏi cây rồi tính lại. Cổng mất BPDU mà không có Loop Guard thì tự mở (nguy cơ loop).
  const cut = new Map();
  for (;;) {
    const st = stpCompute(net, v, cut);
    const bad = Object.entries(st.ports).find(([k, P]) => {
      if (cut.has(k)) return false;
      const c = net.devices[k.slice(0, k.indexOf('|'))].ports[P.name];
      return (c?.rootGuard && P.role === 'Root') || (c?.noBpduRx && P.peer && P.role !== 'Desg');
    });
    if (!bad) {
      for (const [k, kind] of cut) if (kind && st.ports[k]) Object.assign(st.ports[k], { sts: 'BLK', inc: kind });
      return st;
    }
    const c = net.devices[bad[0].slice(0, bad[0].indexOf('|'))].ports[bad[1].name];
    const dev = net.devices[bad[0].slice(0, bad[0].indexOf('|'))];
    cut.set(bad[0], c.rootGuard && bad[1].role === 'Root' ? 'Root' : c.loopGuard || dev.stp.loopguardDefault ? 'Loop' : null);
  }
}
function stpCompute(net, v, cut) {
  const sws = Object.values(net.devices).filter((d) => d.type === 'switch' && d.vlans[v]);
  const cmp = bidCmp(net, v);
  const ports = {}, edges = [], lports = {};
  // cổng logic đang chở VLAN v (thành viên bundle gộp về Port-channel)
  for (const d of sws) {
    const groups = new Map();
    for (const p of Object.keys(d.ports).filter((x) => !x.startsWith('po')).sort(ifSort)) {
      const e = effPort(net, d, p);
      if (e.shutdown || !lineUp(net, d.id, p) || !portCarries(net, d, p, v)) continue;
      const name = e.bundle || p;
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(p);
    }
    lports[d.id] = groups;
    for (const [name, mem] of groups) ports[d.id + '|' + name] = { role: 'Desg', sts: 'FWD', cost: stpCost(net, d, mem), name, members: mem, peer: null };
  }
  // cạnh switch–switch (mỗi cổng logic chỉ có 1 láng giềng)
  for (const d of sws) {
    for (const [name, mem] of lports[d.id]) {
      const l = linkAt(net, d.id, mem[0]);
      const pe = peerOf(l, d.id, mem[0]);
      const pd = net.devices[pe.dev];
      if (pd?.type !== 'switch' || !lports[pd.id]) continue;
      const pn = effPort(net, pd, pe.port).bundle || pe.port;
      if (!ports[pd.id + '|' + pn] || cut.has(d.id + '|' + name) || cut.has(pd.id + '|' + pn)) continue;
      ports[d.id + '|' + name].peer = { dev: pd.id, port: pn };
      if (d.id < pd.id || (d.id === pd.id && name < pn)) edges.push({ a: d.id, ap: name, b: pd.id, bp: pn });
    }
  }
  // từng miền liền nhau: root + Dijkstra theo cost cổng NHẬN
  const root = {}, dist = {};
  const adj = {};
  for (const e of edges) { (adj[e.a] ||= []).push(e); (adj[e.b] ||= []).push(e); }
  for (const d of sws) {
    if (root[d.id]) continue;
    const comp = [d], seen = new Set([d.id]);
    for (let i = 0; i < comp.length; i++) for (const e of adj[comp[i].id] || []) { const o = e.a === comp[i].id ? e.b : e.a; if (!seen.has(o)) { seen.add(o); comp.push(net.devices[o]); } }
    const r = [...comp].sort(cmp)[0];
    for (const x of comp) root[x.id] = r.id;
    dist[r.id] = 0;
    const done = new Set();
    for (;;) {
      let u = null;
      for (const x of comp) if (!done.has(x.id) && dist[x.id] != null && (u === null || dist[x.id] < dist[u])) u = x.id;
      if (u === null) break;
      done.add(u);
      for (const e of adj[u] || []) {
        const [o, op] = e.a === u ? [e.b, e.bp] : [e.a, e.ap];
        const nd = dist[u] + ports[o + '|' + op].cost;
        if (dist[o] == null || nd < dist[o]) dist[o] = nd;
      }
    }
  }
  // Root Port của mỗi switch không phải root
  const key = (dev, port) => [dist[dev], dev, port];
  const less = (x, y) => x[0] - y[0] || cmp(net.devices[x[1]], net.devices[y[1]]) || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0);
  for (const d of sws) {
    if (root[d.id] === d.id) continue;
    let best = null;
    for (const [name] of lports[d.id]) {
      const P = ports[d.id + '|' + name];
      if (!P.peer) continue;
      const k = [dist[P.peer.dev] + P.cost, P.peer.dev, P.peer.port];
      if (!best || less(k, best.k) < 0) best = { k, name };
    }
    if (best) ports[d.id + '|' + best.name].role = 'Root';
  }
  // Designated trên mỗi đoạn: phía có (cost tới root, bridge ID, cổng) nhỏ hơn; phía kia nếu không phải Root Port → BLK
  for (const e of edges) {
    const A = ports[e.a + '|' + e.ap], B = ports[e.b + '|' + e.bp];
    const aWins = less(key(e.a, e.ap), key(e.b, e.bp)) < 0;
    const [W, L] = aWins ? [A, B] : [B, A];
    W.role = W.role === 'Root' ? 'Root' : 'Desg';
    if (L.role !== 'Root') { L.role = 'Altn'; L.sts = 'BLK'; }
  }
  // ⏱ đồng hồ mô phỏng: cổng sắp FORWARDING phải qua listening → learning (PortFast: ngay; RSTP/MST: nhanh)
  if (net.clock) {
    for (const [k, P] of Object.entries(ports)) {
      if (P.sts !== 'FWD') continue;
      const dev = k.slice(0, k.indexOf('|'));
      const d = net.devices[dev];
      if (d.ports[P.members[0]]?.routed || (!P.peer && (d.ports[P.members[0]]?.portfast || d.stp.portfastDefault))) continue;
      const ph = phaseOf(net, `stp|${k}|${v}`, d.stp.mode === 'pvst' || !d.stp.mode ? 'stp' : 'rstp', { dev, port: P.name, vlan: v });
      if (ph) P.sts = ph;
    }
  }
  return { root, dist, ports };
}
/** Cổng (vật lý hoặc Port-channel) có đang BLOCKING cho VLAN v không — dùng trong flood. */
function stpBlockedFn(net) {
  const memo = {};
  return (dev, port, v) => {
    const st = (memo[v] ||= stpState(net, v));
    const d = net.devices[dev];
    const name = d.ports[port] ? (effPort(net, d, port).bundle || port) : port;
    const sts = st.ports[dev + '|' + name]?.sts;
    return sts && sts !== 'FWD' ? sts : false; // 'BLK', hoặc 'LSN'/'LRN' khi đang hội tụ (đồng hồ mô phỏng) — truthy = bị chặn
  };
}
/**
 * VTP: đồng bộ VLAN database giữa các switch nối nhau bằng TRUNK, cùng domain + password.
 * Switch có revision CAO NHẤT thắng — kể cả client (sự cố kinh điển "cắm switch cũ → mất hết VLAN").
 * Switch domain trống (mới xuất xưởng) tự nhận domain từ quảng bá. Transparent chỉ chuyển tiếp.
 */
export function vtpSync(net) {
  const sws = Object.values(net.devices).filter((d) => d.type === 'switch');
  const seen = new Set();
  for (const s of sws) {
    if (seen.has(s.id)) continue;
    const comp = [];
    const q = [s.id];
    seen.add(s.id);
    while (q.length) {
      const u = q.shift();
      const du = net.devices[u];
      comp.push(du);
      for (const p of Object.keys(du.ports)) {
        if (p.startsWith('po') || !lineUp(net, u, p) || effPort(net, du, p).mode !== 'trunk') continue;
        const l = linkAt(net, u, p);
        const pe = peerOf(l, u, p);
        const pd = net.devices[pe.dev];
        if (pd.type !== 'switch' || seen.has(pd.id) || effPort(net, pd, pe.port).mode !== 'trunk') continue;
        seen.add(pd.id);
        q.push(pd.id);
      }
    }
    const doms = [...new Set(comp.filter((d) => d.vtpMode !== 'transparent' && d.vtpDomain).map((d) => d.vtpDomain))];
    if (doms.length === 1) for (const d of comp) if (!d.vtpDomain && d.vtpMode !== 'transparent') d.vtpDomain = doms[0];
    for (const dom of doms) {
      const parts = comp.filter((d) => d.vtpMode !== 'transparent' && d.vtpDomain === dom);
      const groups = Object.create(null); // khoá là mật khẩu người dùng gõ, có thể là "__proto__"
      for (const d of parts) (groups[d.vtpPw || ''] ||= []).push(d);
      for (const grp of Object.values(groups)) {
        const win = [...grp].sort((a, b) => b.vtpRev - a.vtpRev || (a.vtpMode === 'server' ? -1 : 1))[0];
        for (const d of grp) if (d !== win && win.vtpRev > d.vtpRev) { d.vlans = { ...win.vlans }; d.vtpRev = win.vtpRev; }
      }
    }
  }
}

// ======================================================================
// IOS / flash (dùng cho lab nâng cấp hệ điều hành)
// ======================================================================
/** "c2900-universalk9-mz.SPA.157-3.M8.bin" -> "15.7(3)M8" */
export function verOf(file) {
  const m = String(file).match(/(\d)(\d)(\d)-(\d+)\.([A-Za-z]+\d*)\.bin$/);
  return m ? `${m[1]}${m[2]}.${m[3]}(${m[4]})${m[5]}` : null;
}
export function ensureFlash(d) {
  if (d.flash) return d;
  if (d.type === 'router') {
    d.flash = [{ name: 'c2900-universalk9-mz.SPA.151-4.M4.bin', size: 74711824, md5: 'a2b11d57e0f3cd2e0e6f6b1e9e5f0b3c' }];
    d.flashSize = 256 * 1024 * 1024;
  } else if (d.type === 'switch') {
    d.flash = [{ name: `${d.model === '3560' ? 'c3560-ipbasek9' : 'c2960-lanbasek9'}-mz.150-2.SE4.bin`, size: 11832978, md5: '1c2f8e4b7d0a3e9f5b6c7d8e9f0a1b2c' }, { name: 'vlan.dat', size: 616 }];
    d.flashSize = 64016384;
  } else return d;
  d.image ||= d.flash[0].name;
  d.version ||= verOf(d.image) || defaultVersion(d);
  return d;
}
/** Phiên bản IOS khi thiết bị chưa có flash riêng. */
export const defaultVersion = (d) => (d.type === 'router' ? '15.1(4)M4' : '15.0(2)SE4');

// ======================================================================
// ⏱ Đồng hồ mô phỏng: hội tụ theo thời gian (tuỳ chọn, gắn bằng attachClock)
// ======================================================================
// Không có net.clock → mọi thứ hội tụ tức thì như trước (test, chấm điểm). Có đồng hồ → mỗi "mục" (cổng STP sắp
// forwarding, láng giềng OSPF/EIGRP, phiên BGP, thành viên HSRP/VRRP, cổng up) có thời điểm xuất hiện `since`;
// trạng thái hiển thị và khả năng chuyển gói tuỳ tuổi của mục. Mục được phát hiện bằng một lượt "quét" (sweep)
// tính lại toàn mạng; mục mới → since = t, mục mất → báo log down. Qua mốc pha → log IOS (+ debug nếu bật).
/** Pha theo tuổi (giây mô phỏng): [tên pha, hết pha lúc]. Sau mốc cuối = đã hội tụ. */
export const PHASES = {
  stp: [['LSN', 15], ['LRN', 30]], // 802.1D: listening 15 s → learning 15 s → forwarding
  rstp: [['LRN', 2]], // RSTP / MST: proposal–agreement, gần như tức thì
  ospf: [['INIT', 3], ['2WAY', 6], ['EXSTART', 8], ['EXCHANGE', 10], ['LOADING', 11]],
  eigrp: [['PENDING', 5]],
  bgp: [['Active', 3], ['OpenSent', 6], ['OpenConfirm', 8]],
  hsrp: [['Listen', 3], ['Speak', 10]],
  vrrp: [['Backup', 3]],
  link: [],
};
const phaseAt = (kind, age) => { for (const [n, until] of PHASES[kind] || []) if (age < until) return n; return null; };
function ageOf(net, key) { const s = net.clock.since[key]; return s == null ? 0 : net.clock.t - s; }
/** Pha hiện tại của mục (null = đã hội tụ hoặc không bật đồng hồ); trong lượt quét thì ghi nhận mục. */
export function phaseOf(net, key, kind, meta) {
  const c = net.clock;
  if (!c) return null;
  if (c.seen) c.seen.set(key, { ...(c.seen.get(key) || {}), kind, ...meta });
  return phaseAt(kind, ageOf(net, key));
}
export function peekPhase(net, key, kind) { return net.clock ? phaseAt(kind, ageOf(net, key)) : null; }
function noteMeta(net, key, extra) { const c = net.clock; if (c?.seen?.has(key)) Object.assign(c.seen.get(key), extra); }

/** Gắn đồng hồ vào mạng: mọi thứ hiện có coi như đã hội tụ (không log). */
export function attachClock(net) {
  net.clock = { t: 0, since: {}, meta: {}, queue: {}, seen: null };
  for (let i = 0; i < 8; i++) {
    const seen = clockSweep(net);
    let fresh = 0;
    for (const [k, m] of seen) { if (!(k in net.clock.since)) { net.clock.since[k] = -1e6; fresh++; } net.clock.meta[k] = m; }
    if (!fresh) break;
  }
  return net.clock;
}
/** Chạy fn như mạng đã hội tụ hết (chấm điểm), không đụng trạng thái đồng hồ. */
export function withoutClock(net, fn) {
  const c = net.clock;
  if (!c) return fn();
  delete net.clock;
  try { return fn(); } finally { net.clock = c; }
}
/** Một lượt tính lại toàn mạng, trả Map key → meta của mọi mục đang tồn tại. */
function clockSweep(net) {
  const c = net.clock;
  c.seen = new Map();
  try {
    const devs = Object.values(net.devices);
    for (const d of devs) {
      if (d.type !== 'router' && d.type !== 'switch') continue;
      const names = d.type === 'switch' ? Object.keys(d.ports).filter((p) => !p.startsWith('po')) : Object.keys(d.ifaces).filter((n) => !/^(lo|tu|vlan)/.test(n));
      for (const n of names) if (lineUp(net, d.id, n)) c.seen.set(`link|${d.id}|${n}`, { kind: 'link', dev: d.id, ifn: n });
    }
    const vlans = new Set();
    for (const d of devs) if (d.type === 'switch') for (const v of Object.keys(d.vlans)) vlans.add(+v);
    for (const v of vlans) stpState(net, v);
    const ctx = makeCtx(net);
    ospfAll(ctx);
    for (const d of devs) if (isL3(d) && d.ospf) ospfNeighbors(ctx, d.id);
    eigrpAll(ctx);
    bgpAll(ctx);
    for (const d of devs) {
      if (!isL3(d)) continue;
      for (const [n, f] of Object.entries(l3ifs(d))) if (f.ip && ifUp(net, d.id, n) && (Object.keys(f.standby || {}).length || Object.keys(f.vrrp || {}).length)) hsrpView(net, d.id, n);
    }
    return c.seen;
  } finally { c.seen = null; }
}
const TS = (t) => { const s = Math.max(0, t); const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60), ms = Math.floor((s % 1) * 1000); return `*Mar  1 ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(ms).padStart(3, '0')}`; };
/** Ghi 1 dòng log syslog (vào buffer "show logging" + hàng đợi console của thiết bị). debug=true: chỉ khi bật debug. */
export function logPush(net, devId, text, debug = false, bufOnly = false) {
  const d = net.devices[devId];
  if (!d) return;
  const line = `${TS(net.clock?.t ?? 0)}: ${text}`;
  if (!debug) { d.logBuf ||= []; d.logBuf.push(line); if (d.logBuf.length > 300) d.logBuf.shift(); }
  if (net.clock && !bufOnly) (net.clock.queue[devId] ||= []).push(line);
}
/** Lấy (và xoá) các dòng log/debug đang chờ hiện trên console của thiết bị. */
export function drainLogs(net, devId) {
  const q = net.clock?.queue?.[devId];
  if (!q?.length) return [];
  net.clock.queue[devId] = [];
  return q;
}
const LIF = (n) => longIf(n);
const SIF = (n) => shortIf(n);
/** Log khi mục chuyển pha a → b (null = hội tụ). */
function emitPhase(net, m, a, b) {
  const d = net.devices[m.dev];
  if (!d) return;
  const dbg = d.debug || {};
  if (m.kind === 'ospf') {
    const pre = `OSPF-${m.pid} ADJ   ${SIF(m.ifn)}:`;
    if (dbg.ospfAdj) {
      if (b === '2WAY') logPush(net, m.dev, `${pre} 2 Way Communication to ${m.nbr}, state 2WAY`, true);
      if (b === 'EXSTART') { logPush(net, m.dev, `${pre} Nbr ${m.nbr}: Prepare dbase exchange`, true); logPush(net, m.dev, `${pre} Send DBD to ${m.nbr} seq 0x${(0x1a2b + m.nbr.length * 97).toString(16)} opt 0x52 flag 0x7 len 32`, true); }
      if (b === 'EXCHANGE') logPush(net, m.dev, `${pre} NBR Negotiation Done. We are the ${m.nbr > (d.ospf?.rid || '') ? 'SLAVE' : 'MASTER'}`, true);
      if (b === 'LOADING') logPush(net, m.dev, `${pre} Exchange Done with ${m.nbr}`, true);
      if (b === null && m.full !== false) logPush(net, m.dev, `${pre} Synchronized with ${m.nbr}, state FULL`, true);
    }
    if (b === null && m.full !== false && a) logPush(net, m.dev, `%OSPF-5-ADJCHG: Process ${m.pid}, Nbr ${m.nbr} on ${LIF(m.ifn)} from LOADING to FULL, Loading Done`);
  } else if (m.kind === 'eigrp' && b === null) logPush(net, m.dev, `%DUAL-5-NBRCHANGE: EIGRP-IPv4 ${m.as}: Neighbor ${m.nh} (${LIF(m.ifn)}) is up: new adjacency`);
  else if (m.kind === 'bgp' && b === null) logPush(net, m.dev, `%BGP-5-ADJCHANGE: neighbor ${m.ip} Up`);
  else if (m.kind === 'hsrp' || m.kind === 'vrrp') {
    if (m.kind === 'hsrp' && b) logPush(net, m.dev, `%HSRP-5-STATECHANGE: ${LIF(m.ifn)} Grp ${m.group} state ${a || 'Init'} -> ${b}`);

  }
}
function fhrpRoleLog(net, m, from, to) {
  if (m.kind === 'vrrp') logPush(net, m.dev, `%VRRP-6-STATECHANGE: ${SIF(m.ifn)} Grp ${m.group} state ${from} -> ${to}`);
  else if (to === 'Active' && from !== 'Standby') { logPush(net, m.dev, `%HSRP-5-STATECHANGE: ${LIF(m.ifn)} Grp ${m.group} state ${from} -> Standby`); logPush(net, m.dev, `%HSRP-5-STATECHANGE: ${LIF(m.ifn)} Grp ${m.group} state Standby -> Active`); }
  else logPush(net, m.dev, `%HSRP-5-STATECHANGE: ${LIF(m.ifn)} Grp ${m.group} state ${from} -> ${to}`);
}
/** Mục biến mất (cổng down, xoá cấu hình…) → log down. */
function emitGone(net, m, ph) {
  if (m.kind === 'ospf') logPush(net, m.dev, `%OSPF-5-ADJCHG: Process ${m.pid}, Nbr ${m.nbr} on ${LIF(m.ifn)} from ${ph || (m.full === false ? '2WAY' : 'FULL')} to DOWN, Neighbor Down: Interface down or detached`);
  else if (m.kind === 'eigrp' && !ph) logPush(net, m.dev, `%DUAL-5-NBRCHANGE: EIGRP-IPv4 ${m.as}: Neighbor ${m.nh} (${LIF(m.ifn)}) is down: holding time expired`);
  else if (m.kind === 'bgp' && !ph) logPush(net, m.dev, `%BGP-5-ADJCHANGE: neighbor ${m.ip} Down Peer closed the session`);
  else if ((m.kind === 'hsrp' || m.kind === 'vrrp') && net.devices[m.dev]) fhrpRoleLog(net, m, ph || m.role || 'Listen', 'Init');
}
/**
 * Đồng bộ sau mỗi thay đổi (lệnh, nối dây) và mỗi tick: quét lại mạng, mục mới bắt đầu tính giờ, mục mất báo log.
 * `quiet` = id thiết bị vừa gõ lệnh: không lặp log LINK/LINEPROTO mà chính lệnh đó đã in.
 */
export function clockSync(net, quiet = null) {
  const c = net.clock;
  if (!c) return;
  const seen = clockSweep(net);
  for (const [k, m] of seen) {
    const old = c.meta[k];
    if (!(k in c.since)) {
      c.since[k] = c.t;
      if (m.kind === 'link' && m.dev !== quiet) { logPush(net, m.dev, `%LINK-3-UPDOWN: Interface ${LIF(m.ifn)}, changed state to up`); logPush(net, m.dev, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${LIF(m.ifn)}, changed state to up`); }
      if (m.kind === 'hsrp') logPush(net, m.dev, `%HSRP-5-STATECHANGE: ${LIF(m.ifn)} Grp ${m.group} state Init -> Listen`);
      if (m.kind === 'ospf' && net.devices[m.dev]?.debug?.ospfAdj) logPush(net, m.dev, `OSPF-${m.pid} ADJ   ${SIF(m.ifn)}: Rcv hello from ${m.nbr}, state INIT`, true);
    } else if (old && (m.kind === 'hsrp' || m.kind === 'vrrp') && m.role && !peekPhase(net, k, m.kind)) {
      // vai trò đổi (failover / preempt), hoặc lần bầu đầu tiên ngay sau khi hết Speak / Backup
      const from = old.role || (m.kind === 'hsrp' ? 'Speak' : 'Init');
      if (from !== m.role) fhrpRoleLog(net, m, from, m.role);
    }
    c.meta[k] = { ...(old || {}), ...m };
  }
  for (const k of Object.keys(c.since)) {
    if (seen.has(k)) continue;
    const m = c.meta[k];
    if (m) {
      if (m.kind === 'link' && m.dev !== quiet) { logPush(net, m.dev, `%LINK-3-UPDOWN: Interface ${LIF(m.ifn)}, changed state to down`); logPush(net, m.dev, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${LIF(m.ifn)}, changed state to down`); }
      else if (m.kind !== 'link') emitGone(net, m, phaseAt(m.kind, ageOf(net, k)));
    }
    delete c.since[k];
    delete c.meta[k];
  }
}
/** Tiến đồng hồ dt giây mô phỏng: báo log các mục qua mốc pha rồi đồng bộ (phát hiện mục mới nhờ mạng vừa hội tụ thêm). */
export function clockTick(net, dt) {
  const c = net.clock;
  if (!c) return;
  const t0 = c.t;
  c.t = Math.round((c.t + dt) * 1000) / 1000;
  crossings(net, t0);
  clockSync(net);
}
function crossings(net, t0) {
  const c = net.clock;
  for (const [k, s] of Object.entries(c.since)) {
    const m = c.meta[k];
    if (!m || !PHASES[m.kind]?.length) continue;
    // đi qua từng pha một (tick lớn ở ×20 vẫn in đủ các bước)
    const seq = [...PHASES[m.kind].map(([n]) => n), null];
    const a = phaseAt(m.kind, t0 - s), b = phaseAt(m.kind, c.t - s);
    if (a === b) continue;
    for (let i = seq.indexOf(a) + 1; i <= seq.indexOf(b); i++) emitPhase(net, m, seq[i - 1], seq[i]);
  }
}
/** "⚡ Hội tụ ngay": mọi mục đang chờ coi như hết giờ (in đủ log), lặp tới khi không còn mục mới. */
export function clockConverge(net) {
  const c = net.clock;
  if (!c) return;
  for (let i = 0; i < 8; i++) {
    clockSync(net);
    const pending = Object.keys(c.since).filter((k) => c.meta[k] && peekPhase(net, k, c.meta[k].kind));
    if (!pending.length) break;
    for (const k of pending) {
      const m = c.meta[k];
      const seq = [...PHASES[m.kind].map(([n]) => n), null];
      const a = phaseAt(m.kind, c.t - c.since[k]);
      c.since[k] = c.t - 1000;
      for (let j = seq.indexOf(a) + 1; j < seq.length; j++) emitPhase(net, m, seq[j - 1], seq[j]);
    }
  }
}
/** Còn mục nào đang hội tụ không (để UI hiện "đang hội tụ…"). */
export function clockPending(net) {
  const c = net.clock;
  if (!c) return 0;
  return Object.keys(c.since).filter((k) => c.meta[k] && peekPhase(net, k, c.meta[k].kind)).length;
}
