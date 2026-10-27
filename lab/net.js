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

import { Sim, diffFields } from '../engine/simulate.js';
import { ipToInt, intToIp, parseIp } from '../packet/addr.js';
import { pingData } from '../scenarios/_common.js';

// Đang chạy thao tác "thật" của người học (ghi lại vi phạm port-security, MAC học được...)
import { fwCheck, fwEstablished, persistFw, fwSnat } from './fw.js';
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
  return d;
}
export function newPort() {
  // modeSet=false: chưa gõ "switchport mode" → cổng DTP "dynamic auto" (mặc định của switch Cisco)
  return { mode: 'access', modeSet: false, dyn: 'auto', vlan: 1, allowed: null, native: 1, shutdown: false, errdis: false, desc: '', group: null, chMode: null, portfast: false, bpduguard: false, ps: null, trust: false, daiTrust: false, ipsg: false, dhcpRate: null, nonegotiate: false, protected: false, cdp: true, pv: null };
}
function newIf(name) {
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
export function cloneNet(net) { return JSON.parse(JSON.stringify(net)); }

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
const hsrpMac = (g) => `00:00:0c:07:ac:${hx(+g)}`;
const vrrpMac = (g) => `00:00:5e:00:01:${hx(+g)}`;
/** "00:50:79:66:01:01" -> "0050.7966.0101" (kiểu Cisco) */
/** "aabb.ccdd.eeff" (kiểu Cisco) hoặc "aa:bb:…" → "aa:bb:cc:dd:ee:ff"; sai định dạng → null. */
export function parseCiscoMac(w) { const h = String(w).toLowerCase().replace(/[.:-]/g, ''); return /^[0-9a-f]{12}$/.test(h) ? h.match(/../g).join(':') : null; }
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
/** Cổng switch đang err-disabled (port-security shutdown, hoặc BPDU Guard gặp switch khác). */
export function errDisabled(net, d, port) {
  const p = d.ports?.[port];
  if (!p) return false;
  if (p.errdis) return true;
  const guard = p.bpduguard || (p.portfast && d.stp?.bpduDefault);
  return !!(guard && !p.shutdown && peerDev(net, d.id, port)?.type === 'switch');
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
  return physAdminUp(net, p.dev, p.port);
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
  return e.mode === 'access' ? e.vlan === v : allowedHas(e, v);
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
  if (!f || f.shutdown || !f.tunDst) return false;
  const src = tunnelSrcIp(d, f);
  if (!src) return false;
  const srcIf = isIp(f.tunSrc) ? Object.keys(d.ifaces).find((n) => d.ifaces[n].ip === src) : f.tunSrc;
  if (!srcIf || srcIf.startsWith('tu') || !ifUp(net, d.id, srcIf)) return false;
  return underlayOk(net, d, f.tunDst);
}
/** Đầu kia của tunnel: router có tunnel với source/destination đối xứng. */
export function tunnelPeer(net, d, ifn) {
  const f = d.ifaces[ifn];
  const src = tunnelSrcIp(d, f);
  for (const P of Object.values(net.devices)) {
    if (P.type !== 'router' || P.id === d.id) continue;
    for (const [n, g] of Object.entries(P.ifaces)) {
      if (!n.startsWith('tu') || g.tunDst !== src || tunnelSrcIp(P, g) !== f.tunDst) continue;
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
  if (d0.type === 'pc' || d0.type === 'server') sendOut(src.dev, 'fa0', null, [], null);
  else if (d0.type === 'router') {
    if (!ifUp(net, src.dev, src.ifn)) { note(`${d0.name} ${longIf(src.ifn)} chưa up (shutdown/chưa cắm dây/chưa encapsulation/lệch đóng gói serial)`); return out; }
    const f = d0.ifaces[src.ifn];
    if (src.ifn.startsWith('tu')) {
      // tunnel = đường ảo điểm-điểm: "nhìn thấy" đúng router ở đầu kia (frame thật đi trong GRE)
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
        if (it.tag != null) { note(`${d.name} ${longIf(it.port)} là cổng ACCESS nhưng nhận frame gắn tag VLAN ${it.tag} (đầu kia đang trunk?) → bỏ`); continue; }
        vlan = e.vlan;
      } else {
        vlan = it.tag ?? e.native;
        if (!allowedHas(e, vlan)) { note(`${d.name} trunk ${longIf(e.bundle || it.port)} không cho phép VLAN ${vlan} (allowed vlan) → bỏ frame`); continue; }
      }
      if (!d.vlans[vlan]) { note(`${d.name}: VLAN ${vlan} không tồn tại trong VLAN database → bỏ frame`); continue; }
      if (blocked(it.dev, it.port, vlan)) { note(`${d.name} ${longIf(e.bundle || it.port)} đang STP BLOCKING cho VLAN ${vlan} → bỏ frame (chống vòng lặp)`); continue; }
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
        } else if (e.mode === 'access') { if (e.vlan !== it.vlan) continue; tag = null; }
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
  for (const t of s.track || []) if (!ifUp(net, d.id, t.ifn)) p -= t.dec ?? 10;
  return p;
}
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
    for (const [g, s] of Object.entries(f.standby || {})) {
      if (!s.ip) continue;
      (groups['h' + g] ||= []).push({ proto: 'hsrp', group: g, ep: m, cfg: s.priority ?? 100, pri: hsrpPri(net, d, s), preempt: !!s.preempt, vip: s.ip, ipn: ip2n(f.ip) });
    }
    for (const [g, s] of Object.entries(f.vrrp || {})) {
      if (!s.ip) continue;
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
  }
  return act;
}
export const hsrpActives = fhrpActives;
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

export function baseRoutes(ctx, rid) {
  if (ctx.base[rid]) return ctx.base[rid];
  const net = ctx.net, r = net.devices[rid], out = [];
  if (!isL3(r)) return (ctx.base[rid] = out);
  for (const [n, f] of Object.entries(l3ifs(r))) {
    if (!f.ip || !ifUp(net, rid, n)) continue;
    out.push({ code: 'C', net: netOf(f.ip, f.prefix), prefix: f.prefix, ad: 0, metric: 0, iface: n });
    out.push({ code: 'L', net: f.ip, prefix: 32, ad: 0, metric: 0, iface: n });
  }
  const conn = out.filter((x) => x.code === 'C');
  for (const s of r.routes) {
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
  return (ctx.base[rid] = out);
}

export function routeTable(ctx, rid) {
  if (ctx.full[rid]) return ctx.full[rid];
  const o = ospfAll(ctx);
  const all = [...baseRoutes(ctx, rid), ...(o.routes[rid] || []), ...(eigrpAll(ctx).routes[rid] || []), ...(eigrpExt(ctx)[rid] || []), ...(bgpAll(ctx).routes[rid] || [])];
  const best = new Map();
  for (const r of all) {
    const k = r.code === 'L' ? 'L' + r.net : r.net + '/' + r.prefix;
    const b = best.get(k);
    if (!b || r.ad < b.ad || (r.ad === b.ad && r.metric < b.metric)) best.set(k, r);
  }
  const res = [...best.values()].sort((a, b) => ip2n(a.net) - ip2n(b.net) || a.prefix - b.prefix);
  return (ctx.full[rid] = res);
}
/** Longest-prefix match. */
export function lookup(ctx, rid, dst) {
  let best = null;
  for (const r of routeTable(ctx, rid)) if (inNet(dst, r.net, r.prefix) && (!best || r.prefix > best.prefix)) best = r;
  return best;
}

// ---------- OSPF ----------
function ospfCost(ifn, f) { if (f.ospfCost != null) return f.ospfCost; const k = kindOf(ifn); return k === 's' ? 64 : k === 'e' ? 10 : 1; }
export function ospfIfaces(ctx, rid) {
  const net = ctx.net, r = net.devices[rid];
  if (!r.ospf || !isL3(r)) return [];
  const res = [];
  for (const [n, f] of Object.entries(l3ifs(r))) {
    if (!f.ip || !ifUp(net, rid, n)) continue;
    let area = null;
    if (f.ospfPid != null && f.ospfPid === r.ospf.pid) area = f.ospfArea;
    else {
      const st = r.ospf.networks.filter((s) => wildMatch(f.ip, s.net, s.wild)).sort((a, b) => bitCount(ip2n(a.wild)) - bitCount(ip2n(b.wild)))[0];
      if (st) area = st.area;
    }
    if (area == null) continue;
    const passive = r.ospf.passiveDefault ? !r.ospf.noPassive.includes(n) : r.ospf.passive.includes(n);
    res.push({ ifn: n, ip: f.ip, prefix: f.prefix, area: String(area), cost: ospfCost(n, f), passive, hello: f.ospfHello ?? 10, prio: f.ospfPrio ?? 1 });
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
        adj[r.id].push({ to: s.id, cost: e.cost, nh: e2.ip, outIf: e.ifn, theirIf: t.ifn, area: e.area, serial: kindOf(e.ifn) === 's', prio: e2.prio, myPrio: e.prio });
      }
    }
  }
  for (const r of rs) adj[r.id] = adj[r.id].filter((a) => (adj[a.to] || []).some((b) => b.to === r.id));
  for (const s of rs) ads[s.id] = en[s.id].map((e) => ({ net: netOf(e.ip, e.prefix), prefix: e.prefix, cost: e.cost, area: e.area }));
  const spf = {}, intRoutes = {}, myNetsOf = {};
  Object.assign(ctx.ospf, { spf, intRoutes });
  // ---- pha 1: route nội bộ OSPF (O / O IA) ----
  for (const r of rs) {
    const dist = { [r.id]: 0 }, first = {}, done = new Set();
    for (;;) {
      let u = null;
      for (const k of Object.keys(dist)) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k;
      if (u === null) break;
      done.add(u);
      for (const a of adj[u] || []) {
        const nd = dist[u] + a.cost;
        if (dist[a.to] == null || nd < dist[a.to]) { dist[a.to] = nd; first[a.to] = u === r.id ? { nh: a.nh, outIf: a.outIf } : first[u]; }
      }
    }
    spf[r.id] = { dist, first };
    const myNets = (myNetsOf[r.id] = new Set(Object.entries(l3ifs(r)).filter(([n, f]) => f.ip && ifUp(net, r.id, n)).map(([, f]) => netOf(f.ip, f.prefix) + '/' + f.prefix)));
    const myAreas = new Set(en[r.id].map((e) => e.area));
    const best = new Map();
    for (const s of rs) {
      if (s.id === r.id || dist[s.id] == null) continue;
      for (const ad of ads[s.id]) {
        const k = ad.net + '/' + ad.prefix;
        if (myNets.has(k)) continue;
        const cost = dist[s.id] + ad.cost;
        const cur = best.get(k);
        if (!cur || cost < cur.metric) best.set(k, { code: myAreas.has(ad.area) ? 'O' : 'O IA', net: ad.net, prefix: ad.prefix, ad: 110, metric: cost, nextHop: first[s.id].nh, iface: first[s.id].outIf });
      }
    }
    intRoutes[r.id] = [...best.values()];
    routes[r.id] = [...intRoutes[r.id]];
  }
  // ---- pha 2: route external (redistribute) + default-information originate (O E2 / O*E2) ----
  const ext = {};
  for (const s of rs) ext[s.id] = ospfExternals(ctx, s);
  for (const r of rs) {
    const { dist, first } = spf[r.id];
    const have = new Set([...myNetsOf[r.id], ...intRoutes[r.id].map((x) => x.net + '/' + x.prefix)]);
    const best = new Map();
    for (const s of rs) {
      if (s.id === r.id || dist[s.id] == null) continue;
      for (const e of ext[s.id]) {
        const k = e.def ? '0.0.0.0/0' : e.net + '/' + e.prefix;
        if (have.has(k)) continue;
        const cur = best.get(k);
        if (!cur || dist[s.id] < cur.fwd) best.set(k, { code: e.def ? 'O*E2' : 'O E2', net: e.def ? '0.0.0.0' : e.net, prefix: e.def ? 0 : e.prefix, ad: 110, metric: e.metric, fwd: dist[s.id], nextHop: first[s.id].nh, iface: first[s.id].outIf });
      }
    }
    routes[r.id].push(...best.values());
  }
  return ctx.ospf;
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
    seen.add(k);
    out.push({ net: r.net, prefix: r.prefix, metric: cfg.metric ?? 20 });
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
  return out;
}
/** Bầu DR/BDR trên 1 segment: priority cao nhất (0 = không bao giờ làm DR), rồi router-id cao nhất. */
export function ospfRoles(ctx, rid, ifn) {
  const o = ospfAll(ctx);
  const me = (o.en[rid] || []).find((e) => e.ifn === ifn);
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
    if (!a.serial && !a.outIf.startsWith('tu')) {
      const r = ospfRoles(ctx, rid, a.outIf);
      role = r.dr === a.to ? 'DR' : r.bdr === a.to ? 'BDR' : 'DROTHER';
      // 2 router đều là DROTHER chỉ dừng ở 2-WAY (chỉ trao đổi LSDB với DR/BDR)
      full = role !== 'DROTHER' || r.dr === rid || r.bdr === rid;
    }
    return { rid: o.rid[a.to], name: net.devices[a.to].name, state: (full ? 'FULL/' : '2WAY/') + (role === '-' ? ' -' : role), addr: a.nh, iface: a.outIf, dev: a.to, prio: a.prio, role, full };
  });
}

// ---------- EIGRP ----------
const EBW = { g: 1000000, fa: 100000, e: 10000, s: 1544, lo: 8000000, vlan: 1000000 };
const EDLY = { g: 1, fa: 10, e: 100, s: 2000, lo: 500, vlan: 1 };
function ifBw(ifn, f) { return f.bw ?? EBW[kindOf(ifn)] ?? 100000; }
function ifDly(ifn) { return EDLY[kindOf(ifn)] ?? 10; }
export function eigrpIfaces(ctx, rid) {
  const net = ctx.net, r = net.devices[rid];
  if (!r.eigrp || !isL3(r)) return [];
  const res = [];
  for (const [n, f] of Object.entries(l3ifs(r))) {
    if (!f.ip || !ifUp(net, rid, n)) continue;
    const ok = r.eigrp.networks.some((s) => (s.wild ? wildMatch(f.ip, s.net, s.wild) : netOf(f.ip, classfulPrefix(s.net)) === netOf(s.net, classfulPrefix(s.net))));
    if (!ok) continue;
    res.push({ ifn: n, ip: f.ip, prefix: f.prefix, passive: r.eigrp.passive.includes(n), bw: ifBw(n, f), dly: ifDly(n) });
  }
  return res;
}
export function eigrpAll(ctx) {
  if (ctx.eigrp) return ctx.eigrp;
  const net = ctx.net;
  const rs = Object.values(net.devices).filter((d) => isL3(d) && d.eigrp);
  const en = {}, adj = {}, routes = {};
  ctx.eigrp = { en, adj, routes };
  for (const r of rs) en[r.id] = eigrpIfaces(ctx, r.id);
  for (const r of rs) {
    adj[r.id] = [];
    for (const e of en[r.id]) {
      if (e.passive) continue;
      for (const t of flood(net, { dev: r.id, ifn: e.ifn }).values()) {
        const s = net.devices[t.dev];
        if (!s || !isL3(s) || !s.eigrp || s.id === r.id || s.eigrp.as !== r.eigrp.as) continue;
        const e2 = (en[s.id] || []).find((x) => x.ifn === t.ifn);
        if (!e2 || e2.passive) continue;
        if (netOf(e.ip, e.prefix) !== netOf(e2.ip, e2.prefix)) continue;
        adj[r.id].push({ to: s.id, nh: e2.ip, outIf: e.ifn, bw: e.bw, dly: e.dly });
      }
    }
  }
  for (const r of rs) adj[r.id] = adj[r.id].filter((a) => (adj[a.to] || []).some((b) => b.to === r.id));
  const comp = eigrpComp;
  ctx.eigrp.paths = {};
  for (const r of rs) {
    const st = { [r.id]: { bw: Infinity, dly: 0, m: 0 } }, first = {}, done = new Set();
    ctx.eigrp.paths[r.id] = { st, first };
    for (;;) {
      let u = null;
      for (const k of Object.keys(st)) if (!done.has(k) && (u === null || st[k].m < st[u].m)) u = k;
      if (u === null) break;
      done.add(u);
      for (const a of adj[u] || []) {
        const bw = Math.min(st[u].bw, a.bw), dly = st[u].dly + a.dly, m = comp(bw, dly);
        if (!st[a.to] || m < st[a.to].m) { st[a.to] = { bw, dly, m }; first[a.to] = u === r.id ? { nh: a.nh, outIf: a.outIf } : first[u]; }
      }
    }
    const myNets = new Set(Object.entries(l3ifs(r)).filter(([n, f]) => f.ip && ifUp(net, r.id, n)).map(([, f]) => netOf(f.ip, f.prefix) + '/' + f.prefix));
    const best = new Map();
    for (const s of rs) {
      if (s.id === r.id || !st[s.id]) continue;
      for (const e of en[s.id]) {
        const k = netOf(e.ip, e.prefix) + '/' + e.prefix;
        if (myNets.has(k)) continue;
        const m = comp(Math.min(st[s.id].bw, e.bw), st[s.id].dly + e.dly);
        const cur = best.get(k);
        if (!cur || m < cur.metric) best.set(k, { code: 'D', net: netOf(e.ip, e.prefix), prefix: e.prefix, ad: 90, metric: m, nextHop: first[s.id].nh, iface: first[s.id].outIf });
      }
    }
    routes[r.id] = [...best.values()];
  }
  return ctx.eigrp;
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
        seen.add(k);
        list.push({ net: r.net, prefix: r.prefix, bw: seed[0], dly: seed[1] });
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
      for (const e of ext[s.id]) {
        const k = e.net + '/' + e.prefix;
        if (have.has(k)) continue;
        const m = eigrpComp(Math.min(st[s.id].bw, e.bw), st[s.id].dly + e.dly);
        const cur = best.get(k);
        if (!cur || m < cur.metric) best.set(k, { code: 'D EX', net: e.net, prefix: e.prefix, ad: 170, metric: m, nextHop: first[s.id].nh, iface: first[s.id].outIf });
      }
    }
    res[r.id] = [...best.values()];
  }
  return res;
}

// ---------- BGP ----------
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
  const igp = (id) => [...baseRoutes(ctx, id), ...(ctx.ospf.intRoutes?.[id] || []), ...(eigrpAll(ctx).routes[id] || [])];
  const igpLookup = (id, ip) => { let b = null; for (const r of igp(id)) if (inNet(ip, r.net, r.prefix) && (!b || r.prefix > b.prefix)) b = r; return b; };
  for (const r of rs) {
    const ips = Object.entries(r.ifaces).filter(([n, f]) => f.ip && ifUp(net, r.id, n)).map(([, f]) => f.ip);
    rid[r.id] = r.bgp.rid || ips.sort((a, b) => ip2n(b) - ip2n(a))[0] || '0.0.0.0';
  }
  for (const r of rs) {
    sessions[r.id] = [];
    for (const [nip, ncfg] of Object.entries(r.bgp.neighbors || {})) {
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
          const back = P.bgp.neighbors?.[myIp];
          const ebgp = r.bgp.as !== P.bgp.as;
          if (back && back.remoteAs === r.bgp.as && (!ebgp || rt.code === 'C') && igpLookup(P.id, myIp)) state = 'Established';
        }
      }
      sessions[r.id].push({ peer: P?.id || null, ip: nip, myIp, ebgp: P ? r.bgp.as !== P.bgp.as : ncfg.remoteAs !== r.bgp.as, cfg: ncfg, state, remoteAs: ncfg.remoteAs });
    }
  }
  // route tự quảng bá (network)
  const local = {};
  for (const r of rs) {
    local[r.id] = [];
    const tbl = igp(r.id);
    for (const n of r.bgp.networks || []) if (tbl.some((x) => x.net === n.net && x.prefix === n.prefix && x.code !== 'L')) local[r.id].push({ net: n.net, prefix: n.prefix, asPath: [], nh: '0.0.0.0', local: true, from: null, ebgp: false });
  }
  const pick = (list) => [...list].sort((a, b) => (b.local ? 1 : 0) - (a.local ? 1 : 0) || a.asPath.length - b.asPath.length || (b.ebgp ? 1 : 0) - (a.ebgp ? 1 : 0) || ip2n(a.fromIp || '0.0.0.0') - ip2n(b.fromIp || '0.0.0.0'))[0];
  let best = {};
  for (const r of rs) { best[r.id] = {}; for (const p of local[r.id]) best[r.id][p.net + '/' + p.prefix] = p; }
  for (let round = 0; round < rs.length + 3; round++) {
    const cand = {};
    for (const r of rs) { cand[r.id] = {}; for (const p of local[r.id]) (cand[r.id][p.net + '/' + p.prefix] ||= []).push(p); }
    for (const r of rs) {
      for (const s of sessions[r.id]) {
        if (s.state !== 'Established') continue;
        const P = net.devices[s.peer];
        const out = Object.values(best[r.id]).filter((b) => !(b.from === P.id) && !(!s.ebgp && b.ibgp));
        if (s.cfg.defaultOriginate) out.push({ net: '0.0.0.0', prefix: 0, asPath: [], nh: '0.0.0.0', orig: true });
        for (const b of out) {
          const asPath = s.ebgp ? [r.bgp.as, ...b.asPath] : b.asPath;
          if (asPath.includes(P.bgp.as)) continue; // chống lặp AS-path
          const nh = s.ebgp || b.nh === '0.0.0.0' || s.cfg.nextHopSelf ? s.myIp : b.nh;
          (cand[P.id][b.net + '/' + b.prefix] ||= []).push({ net: b.net, prefix: b.prefix, asPath, nh, from: r.id, fromIp: s.myIp, ebgp: s.ebgp, ibgp: !s.ebgp });
        }
      }
    }
    const nb = {};
    for (const r of rs) { nb[r.id] = {}; for (const [k, l] of Object.entries(cand[r.id])) nb[r.id][k] = pick(l); }
    const same = JSON.stringify(nb) === JSON.stringify(best);
    best = nb;
    Object.assign(tables, Object.fromEntries(rs.map((r) => [r.id, cand[r.id]])));
    if (same) break;
  }
  for (const r of rs) {
    tables[r.id] ||= {};
    routes[r.id] = [];
    for (const b of Object.values(best[r.id])) {
      if (b.local) continue;
      const via = igpLookup(r.id, b.nh);
      if (!via) continue; // next-hop không tới được → route không vào RIB
      routes[r.id].push({ code: 'B', net: b.net, prefix: b.prefix, ad: b.ebgp ? 20 : 200, metric: 0, nextHop: b.nh, iface: via.iface, asPath: b.asPath });
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
    if (e.remark != null) continue;
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
  return `${e.action} ${e.proto} ${addrText(e.src)}${portText(e.sport)} ${addrText(e.dst)}${portText(e.dport)}${e.icmpType ? ' ' + e.icmpType : ''}${e.established ? ' established' : ''}${e.log ? ' log' : ''}`;
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
      type: d.type === 'pc' || d.type === 'server' ? 'host' : d.type,
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
    this.sim.emit({ kind: 'transit', fromDevice: h.from, toDevice: h.to, packet: f, activeLayer: o.l || 2, side: o.side || 'encap', titleVi: o.title, explanationVi: o.ex, changedFields: o.changed || [], overlay: { links: { [h.link]: { cls: h.tag != null ? 'trunk' : 'forwarding', label: lbl } } } });
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
function ownsIp(net, d, ip) {
  if (d.type === 'pc' || d.type === 'server') return d.ip === ip;
  for (const [n, f] of Object.entries(l3ifs(d))) {
    if (!ifUp(net, d.id, n)) continue;
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
    if (!net.devices[egress.dev].arp[nh]) ctx.firstArp = true;
    if (ctx.record) {
      net.devices[egress.dev].arp[nh] = { mac: res.mac, ifn: egress.ifn };
      const od = net.devices[res.ep.dev];
      if (srcIp) od.arp[srcIp] = { mac: srcMac, ifn: res.ep.ifn };
      learnMacs(net, res.hops, srcMac);
      learnMacs(net, [...res.hops].reverse().map((h) => ({ ...h, from: h.to, to: h.from, fromPort: h.toPort, toPort: h.fromPort })), res.mac);
    }
    if (R.on) {
      for (const h of res.hops) {
        const f = R.frame([...l2(h.tag, 0x0806, srcMac, 'ff:ff:ff:ff:ff:ff'), { proto: 'arp', fields: { opcode: 1, senderMac: srcMac, senderIp: srcIp, targetMac: '00:00:00:00:00:00', targetIp: nh } }]);
        if (h === res.hops[0]) R.cap(f, `ARP Who has ${nh}? Tell ${srcIp}`);
        R.transit(h, f, { l: 2, title: `ARP Request (broadcast): ai giữ ${nh}?`, ex: `${dname} chưa có MAC của ${nh} → phát broadcast FF:FF:FF:FF:FF:FF.${h.tag != null ? ` Trên đường trunk khung được gắn nhãn 802.1Q VLAN ${h.tag}.` : ''}` });
      }
      const back = [...res.hops].reverse();
      const fh = res.fhrp === 'vrrp' ? 'VRRP' : 'HSRP';
      for (const h of back) {
        const hh = { ...h, from: h.to, to: h.from };
        const f = R.frame([...l2(h.tag, 0x0806, res.mac, srcMac), { proto: 'arp', fields: { opcode: 2, senderMac: res.mac, senderIp: nh, targetMac: srcMac, targetIp: srcIp } }]);
        if (h === back[0]) R.cap(f, `ARP ${nh} is at ${res.mac}`);
        R.transit(hh, f, { l: 2, side: 'decap', title: `ARP Reply: ${nh} ở ${ciscoMac(res.mac)}${res.fhrp ? ` (MAC ảo ${fh})` : res.proxy ? ' (proxy-ARP)' : ''}`, ex: `${net.devices[res.ep.dev].name} trả lời unicast.${res.fhrp ? ` Đây là router ${res.fhrp === 'vrrp' ? 'MASTER' : 'ACTIVE'} của nhóm ${fh} ${res.hsrp} → trả MAC ảo ${ciscoMac(res.mac)}.` : ''}${res.proxy ? ' Router trả lời THAY cho một IP ở mạng khác (proxy-ARP) vì nó có route tới mạng đó.' : ''}` });
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
        if (ownsIp(net, d, pkt.dst)) return { ok: true, at: { dev: node.dev, ifn: inIf }, hops };
        pkt.ttl -= 1;
        hops.push({ dev: node.dev, ip: fi.ip });
        if (pkt.ttl <= 0) return fail(node.dev, 'ttl', `${d.name}: TTL về 0 → hủy gói (ICMP Time Exceeded). Có thể có vòng lặp định tuyến.`, '.');
      } else if (ownsIp(net, d, pkt.dst)) {
        return { ok: true, at: { dev: node.dev, ifn: null }, hops };
      }
      const rt = lookup(ctx, node.dev, pkt.dst);
      if (!rt) return fail(node.dev, 'noroute', `${d.name}: KHÔNG có route nào khớp ${pkt.dst} (kể cả default route) → hủy gói, báo ICMP Destination Unreachable.`, 'U', inIf ? IF[inIf].ip : null);
      const outIf = rt.iface;
      nh = rt.nextHop || pkt.dst;
      if (!pkt.src) pkt.src = IF[outIf].ip;
      R.proc(node.dev, { l: 3, side: 'forward', changed, title: `${d.name} tra bảng định tuyến: ${pkt.dst} → ${rt.code} ${rt.net}/${rt.prefix}`, ex: `Longest-prefix match chọn ${rt.code} ${rt.net}/${rt.prefix}${rt.nextHop ? ` via ${rt.nextHop}` : ' (mạng nối trực tiếp)'} ra ${longIf(outIf)}.${inIf ? ` TTL ${pkt.ttl + 1}→${pkt.ttl}, tính lại checksum IP.` : ''}`, tables: routeRows(ctx, node.dev, rt) });
      // Firewall stateful (ASA / ZBF / rule base): xét trên địa chỉ THẬT, trước NAT chiều ra
      let fwv = null;
      if (inIf && d.fw) {
        fwv = fwCheck(ctx, d, pkt, inIf, outIf);
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
      if (fo.aclOut && !(d.fw && fwEstablished(ctx, d, pkt))) {
        const a = aclEval(d, fo.aclOut, pkt, ctx.record);
        if (a.action === 'deny') return fail(node.dev, 'acl', `${d.name}: ACL "${fo.aclOut}" (chiều OUT trên ${longIf(outIf)}) chặn gói — ${a.implicit ? 'không khớp dòng permit nào → "deny any" NGẦM ĐỊNH' : 'khớp dòng: ' + aceText(d.acls[fo.aclOut].type, a.entry)}.`, 'U', inIf ? IF[inIf].ip : fo.ip);
      }
      // GRE: ra cổng tunnel → bọc gói gốc trong IP/GRE (proto 47) gửi qua underlay tới đầu kia
      if (d.type === 'router' && outIf.startsWith('tu')) {
        const peer = tunnelPeer(net, d, outIf);
        if (!peer) return fail(node.dev, 'tunnel', `${d.name}: ${longIf(outIf)} không có đầu kia khớp (tunnel source/destination 2 bên phải đối xứng) hoặc underlay không tới được ${fo.tunDst}.`, '.');
        const tsrc = tunnelSrcIp(d, fo);
        R.proc(node.dev, { l: 3, side: 'encap', title: `${d.name}: đóng gói GRE → ${fo.tunDst}`, ex: `Gói ${pkt.src} → ${pkt.dst} ra ${longIf(outIf)}: router thêm header GRE + IP mới ${tsrc} → ${fo.tunDst} (protocol 47). Internet chỉ định tuyến theo IP ngoài; gói gốc nằm nguyên bên trong (GRE KHÔNG mã hoá).` });
        const outer = { src: tsrc, dst: fo.tunDst, proto: 'gre', ttl: 255, ipId: 0x6e6e, inner: `${pkt.src} → ${pkt.dst}` };
        const tun = walk(ctx, R, outer, { dev: node.dev, ifn: null, origin: true }, opts);
        if (!tun.ok) return { ok: false, fail: { ...tun.fail, why: '(GRE underlay) ' + tun.fail.why }, hops };
        R.proc(peer.dev, { l: 3, side: 'decap', title: `${net.devices[peer.dev].name}: gỡ GRE → gói gốc ${pkt.src} → ${pkt.dst}`, ex: `Gói tới ${longIf(peer.ifn)} của đầu kia, bỏ header ngoài và định tuyến tiếp gói gốc.` });
        node = { dev: peer.dev, ifn: peer.ifn };
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
export function portOpen(d, port) {
  if (d.type === 'pc' || d.type === 'server') return (d.services || []).includes(port);
  const tr = d.lines.vty.transport || 'all';
  if (port === 23) return tr === 'all' || tr.includes('telnet');
  if (port === 22) return (tr === 'all' || tr.includes('ssh')) && sshReady(d);
  if (port === 80) return !!d.httpServer;
  if (port === 443) return !!d.httpsServer;
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
function sendPacketInner(net, o) {
  const ctx = makeCtx(net, !!o.record);
  const R = new Rec(net, !!o.anim);
  const srcDev = net.devices[o.src];
  const isHost = srcDev.type === 'pc' || srcDev.type === 'server';
  const proto = o.proto || 'icmp';
  // ICMP id / port nguồn: máy trạm dùng 1, router/switch tự phát dùng giá trị khác — như thiết bị thật, để gói
  // trả lời cho chính router không khớp nhầm entry PAT của máy bên trong (cùng IP global của cổng outside)
  const id0 = o.icmpId || (isHost ? 1 : 0x7a69);
  const pkt = { src: null, dst: o.dst, proto, ttl: isHost ? 128 : 255, ipId: 0x1a2b, icmpId: id0, seq: 1, reply: false, sport: 49152 + (id0 % 16384), dport: o.dport, flags: { syn: true }, tseq: 1000, tack: 0 };
  const wopts = { noCrypto: !!o.noCrypto };
  const done = (r) => {
    if (o.record) { persistNat(net, ctx); persistFw(net, ctx); }
    return { ...r, sim: R.on ? R.sim.result() : null, firstArp: ctx.firstArp };
  };
  const fwd = walk(ctx, R, pkt, { dev: o.src, ifn: null, origin: true }, wopts);
  if (!fwd.ok) return done({ ok: false, kind: fwd.fail.code === 'U' ? 'unreach' : 'timeout', fail: fwd.fail, hops: fwd.hops });
  const dd = net.devices[fwd.at.dev];
  let open = true;
  const reply = { ...pkt, dst0: undefined, src: pkt.dst, dst: pkt.src, reply: true, ttl: dd.type === 'router' || dd.type === 'switch' ? 255 : 128, ipId: 0x3c4d };
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
function stpCost(d, members) {
  const base = STP_COST[kindOf(members[0])] ?? 19;
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
    for (const [name, mem] of groups) ports[d.id + '|' + name] = { role: 'Desg', sts: 'FWD', cost: stpCost(d, mem), name, members: mem, peer: null };
  }
  // cạnh switch–switch (mỗi cổng logic chỉ có 1 láng giềng)
  for (const d of sws) {
    for (const [name, mem] of lports[d.id]) {
      const l = linkAt(net, d.id, mem[0]);
      const pe = peerOf(l, d.id, mem[0]);
      const pd = net.devices[pe.dev];
      if (pd?.type !== 'switch' || !lports[pd.id]) continue;
      const pn = effPort(net, pd, pe.port).bundle || pe.port;
      if (!ports[pd.id + '|' + pn]) continue;
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
  return { root, dist, ports };
}
/** Cổng (vật lý hoặc Port-channel) có đang BLOCKING cho VLAN v không — dùng trong flood. */
function stpBlockedFn(net) {
  const memo = {};
  return (dev, port, v) => {
    const st = (memo[v] ||= stpState(net, v));
    const d = net.devices[dev];
    const name = d.ports[port] ? (effPort(net, d, port).bundle || port) : port;
    return st.ports[dev + '|' + name]?.sts === 'BLK';
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
      const groups = {};
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
    d.flash = [{ name: 'c2960-lanbasek9-mz.150-2.SE4.bin', size: 11832978, md5: '1c2f8e4b7d0a3e9f5b6c7d8e9f0a1b2c' }, { name: 'vlan.dat', size: 616 }];
    d.flashSize = 64016384;
  } else return d;
  d.image ||= d.flash[0].name;
  d.version ||= verOf(d.image) || (d.type === 'router' ? '15.1(4)M4' : '15.0(2)SE4');
  return d;
}
