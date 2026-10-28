// lab/capture.js — bắt gói trên dây (Capture) cho workspace tự dựng mạng, kiểu EVE-NG + Wireshark.
//   • Gói lấy từ CHÍNH engine: mỗi sự kiện "transit" (frame đi qua 1 dây, byte thật từ packet/serialize.js)
//     của ping / traceroute / telnet / ssh / DHCP / ARP được ghi vào dây đang bắt (kể cả tag 802.1Q trên trunk).
//   • Gói định kỳ sinh theo cấu hình đang chạy: STP BPDU (2 s), HSRP Hello (3 s), EIGRP Hello (5 s), OSPF Hello (10 s).
//   • Tóm tắt kiểu Wireshark (Source, Destination, Protocol, Length, Info), bộ lọc hiển thị đơn giản, xuất .pcap.
// Thuần logic (không DOM) để kiểm bằng node --test; giao diện ở ui/workspace.js.

import * as N from './net.js';
import { serialize } from '../packet/serialize.js';
import { buildPcap } from '../packet/pcap.js';

// ---------------------------------------------------------------- trạng thái bắt gói
/** cap.links: linkId → { on, t0, pkts: [], last: { khoá gói định kỳ: giây } }. Thời gian tính bằng giây. */
export function createCapture() { return { links: {} }; }
export function startCapture(cap, linkId, now) {
  const c = (cap.links[linkId] ||= { on: false, t0: now, pkts: [], last: {} });
  c.on = true;
  return c;
}
export function stopCapture(cap, linkId) { if (cap.links[linkId]) cap.links[linkId].on = false; }
export const isCapturing = (cap, linkId) => !!cap.links[linkId]?.on;
/** Dây đã bị xoá → bỏ luôn phần bắt gói của nó. */
export function pruneCapture(cap, net) { for (const id of Object.keys(cap.links)) if (!net.links.some((l) => l.id === id)) delete cap.links[id]; }

function push(c, pkt, t) {
  t = Math.max(t, c.lastT ?? -Infinity); // thời gian trong bảng luôn tăng dần (ping lặp 1 s/lượt có thể "vượt" đồng hồ)
  c.lastT = t;
  c.pkts.push({ no: (c.pkts.at(-1)?.no ?? 0) + 1, t: Math.max(0, t - c.t0), ...pkt });
  if (c.pkts.length > 5000) c.pkts.splice(0, c.pkts.length - 5000);
}

/**
 * Ghi các frame của một lần mô phỏng (sim.result()) vào những dây đang bắt.
 * o.repeat = số lần lặp gói ICMP Echo (lệnh ping của PC gửi 4, router gửi 5 — engine chỉ mô phỏng 1 lượt).
 */
export function recordSim(cap, sim, now, o = {}) {
  if (!sim?.events) return 0;
  const by = {};
  for (const ev of sim.events) {
    if (ev.kind !== 'transit' || !ev.packet?.bytes || ev.capSkip || !isCapturing(cap, ev.link)) continue;
    (by[ev.link] ||= []).push({ from: ev.fromDevice, to: ev.toDevice, layers: ev.packet.layers, bytes: ev.packet.bytes, tree: ev.packet.tree });
  }
  let n = 0;
  for (const [lid, frames] of Object.entries(by)) {
    const c = cap.links[lid];
    let t = now;
    for (const f of frames) { push(c, f, t); t += 0.0003; n++; }
    const echo = frames.filter((f) => f.layers.some((l) => l.proto === 'icmp' && (l.fields.type === 8 || l.fields.type === 0)));
    for (let k = 2; k <= (o.repeat || 1); k++) {
      t = now + (k - 1);
      for (const f of echo) { push(c, reseq(f, k), t); t += 0.0003; n++; }
    }
  }
  return n;
}
/** Bản sao gói ICMP Echo với số thứ tự k (IP ID tăng theo) — dựng lại byte thật. */
function reseq(f, k) {
  const layers = f.layers.map((l) => (l.proto === 'icmp' ? { ...l, fields: { ...l.fields, seq: k } } : l.proto === 'ipv4' ? { ...l, fields: { ...l.fields, id: ((l.fields.id || 0) + k - 1) & 0xffff } } : l));
  const { bytes, tree } = serialize(layers);
  return { from: f.from, to: f.to, layers, bytes, tree };
}

// ---------------------------------------------------------------- gói định kỳ (theo cấu hình đang chạy)
const MCAST = { ospf: '01:00:5e:00:00:05', eigrp: '01:00:5e:00:00:0a', hsrp: '01:00:5e:00:00:02', stp: '01:80:c2:00:00:00' };
const areaDotted = (a) => (/^\d+$/.test(String(a)) ? N.n2ip(+a) : String(a));
const PERIOD = { stp: 2, hsrp: 3, eigrp: 5, ospf: 10 };

/** Các gói định kỳ mà đầu dây (dev, port) đang phát: [{ key, every, layers }]. */
export function periodicFrames(net, dev, port, ctx = N.makeCtx(net)) {
  const d = net.devices[dev];
  const out = [];
  if (!d || d.off || !N.lineUp(net, dev, port)) return out;
  if (d.type === 'switch') {
    const e = N.effPort(net, d, port);
    // BPDU cho VLAN không gắn tag trên cổng (access: VLAN của cổng; trunk: native VLAN) — chỉ Designated Port mới phát
    const v = e.mode === 'access' ? e.vlan : e.mode === 'trunk' ? e.native : null;
    if (v == null || !d.vlans[v] || !N.portCarries(net, d, port, v)) return out;
    const st = N.stpState(net, v);
    const P = st.ports[dev + '|' + (e.bundle || port)];
    if (!P || P.role !== 'Desg') return out;
    const root = net.devices[st.root[dev]] || d;
    const prio = (x) => (x.stp.prio[v] ?? 32768);
    const phys = Object.keys(d.ports).filter((x) => !x.startsWith('po')).sort(N.ifSort);
    out.push({ key: `stp|${dev}|${v}`, every: PERIOD.stp, layers: [
      { proto: 'ethernet', fields: { dst: MCAST.stp, src: N.epMac(net, { dev, ifn: port }), mode: '802.3' } },
      { proto: 'llc', fields: {} },
      { proto: 'stp', fields: { version: d.stp.mode === 'rapid-pvst' ? 2 : 0, type: d.stp.mode === 'rapid-pvst' ? 2 : 0, flags: d.stp.mode === 'rapid-pvst' ? 0x3c : 0, rootPriority: prio(root), rootSysId: v, rootMac: N.switchMac(net, root.id), rootPathCost: st.dist[dev] ?? 0, bridgePriority: prio(d), bridgeSysId: v, bridgeMac: N.switchMac(net, dev), portPriority: 128, portNumber: phys.indexOf(port) + 1, msgAge: st.dist[dev] ? 1 : 0, maxAge: 20, hello: 2, fwdDelay: 15 } },
    ] });
    return out;
  }
  if (!N.isL3(d)) return out;
  const f = N.l3ifs(d)[port];
  if (!f?.ip || !N.ifUp(net, dev, port)) return out;
  const mac = N.epMac(net, { dev, ifn: port });
  const ip4 = (dst, protocol) => ({ proto: 'ipv4', fields: { src: f.ip, dst, ttl: 1, id: 0, protocol } });
  const o = N.ospfIfaces(ctx, dev).find((x) => x.ifn === port && !x.passive);
  if (o) {
    const all = N.ospfAll(ctx);
    const adj = (all.adj[dev] || []).filter((a) => a.outIf === port);
    const roles = N.ospfRoles(ctx, dev, port);
    const ipOf = (id) => (id === dev ? f.ip : adj.find((a) => a.to === id)?.nh || '0.0.0.0');
    out.push({ key: `ospf|${dev}|${port}`, every: o.hello, layers: [
      { proto: 'ethernet', fields: { dst: MCAST.ospf, src: mac, etherType: 0x0800 } }, ip4('224.0.0.5', 89),
      { proto: 'ospf', fields: { type: 1, routerId: all.rid[dev], areaId: areaDotted(o.area), netmask: N.prefixToMask(f.prefix), helloInterval: o.hello, priority: o.prio, deadInterval: o.hello * 4, dr: roles.dr ? ipOf(roles.dr) : '0.0.0.0', bdr: roles.bdr ? ipOf(roles.bdr) : '0.0.0.0', neighbors: adj.map((a) => all.rid[a.to]) } },
    ] });
  }
  if (N.eigrpIfaces(ctx, dev).some((x) => x.ifn === port && !x.passive)) {
    out.push({ key: `eigrp|${dev}|${port}`, every: PERIOD.eigrp, layers: [
      { proto: 'ethernet', fields: { dst: MCAST.eigrp, src: mac, etherType: 0x0800 } }, ip4('224.0.0.10', 88),
      { proto: 'eigrp', fields: { opcode: 5, hello: true, asn: d.eigrp.as, k: [1, 0, 1, 0, 0, 0], hold: 15 } },
    ] });
  }
  const act = N.hsrpView(net, dev, port);
  for (const [g, s] of Object.entries(f.standby || {})) {
    if (!s.ip) continue;
    const active = act.some((a) => a.proto === 'hsrp' && String(a.group) === String(g) && a.ep.dev === dev && a.ep.ifn === port);
    out.push({ key: `hsrp|${dev}|${port}|${g}`, every: PERIOD.hsrp, layers: [
      { proto: 'ethernet', fields: { dst: MCAST.hsrp, src: active ? N.hsrpMac(g) : mac, etherType: 0x0800 } }, ip4('224.0.0.2', 17),
      { proto: 'udp', fields: { srcPort: 1985, dstPort: 1985 } },
      { proto: 'hsrp', fields: { opcode: 0, state: active ? 16 : 8, priority: s.priority ?? 100, group: +g, virtualIp: s.ip } },
    ] });
  }
  return out;
}

/** Gọi đều đặn (vd mỗi giây): thêm gói định kỳ tới hạn vào các dây đang bắt. Trả số gói đã thêm. */
export function tickCapture(cap, net, now) {
  let n = 0;
  const ctx = N.makeCtx(net);
  for (const [lid, c] of Object.entries(cap.links)) {
    if (!c.on) continue;
    const l = net.links.find((x) => x.id === lid);
    if (!l) continue;
    for (const [dev, port, peer] of [[l.a, l.ap, l.b], [l.b, l.bp, l.a]]) {
      for (const fr of periodicFrames(net, dev, port, ctx)) {
        const last = c.last[fr.key];
        if (last != null && now - last < fr.every) continue;
        c.last[fr.key] = now;
        const { bytes, tree } = serialize(fr.layers);
        push(c, { from: dev, to: peer, layers: fr.layers, bytes, tree, periodic: true }, now);
        n++;
      }
    }
  }
  return n;
}

// ---------------------------------------------------------------- tóm tắt kiểu Wireshark
const L = (p, proto) => p.layers.find((x) => x.proto === proto)?.fields;
const ICMP_T = { 0: 'Echo (ping) reply', 3: 'Destination unreachable', 5: 'Redirect', 8: 'Echo (ping) request', 11: 'Time-to-live exceeded' };
const DHCP_T = { 1: 'Discover', 2: 'Offer', 3: 'Request', 4: 'Decline', 5: 'ACK', 6: 'NAK', 7: 'Release', 8: 'Inform' };
const HSRP_S = { 0: 'Initial', 1: 'Learn', 2: 'Listen', 4: 'Speak', 8: 'Standby', 16: 'Active' };
const OSPF_T = { 1: 'Hello Packet', 2: 'DB Description', 3: 'LS Request', 4: 'LS Update', 5: 'LS Acknowledge' };
const hex4 = (n) => '0x' + (n >>> 0).toString(16).padStart(4, '0');

/** Protocol (cột Protocol, viết hoa như Wireshark) của gói. */
export function protoOf(p) {
  const has = (x) => p.layers.some((l) => l.proto === x);
  for (const x of ['dhcp', 'dns', 'ospf', 'eigrp', 'hsrp', 'stp', 'arp', 'icmp', 'bgp']) if (has(x)) return x === 'stp' ? 'STP' : x.toUpperCase();
  const ip = L(p, 'ipv4');
  if (has('tcp')) { const t = L(p, 'tcp'); return t.srcPort === 23 || t.dstPort === 23 ? 'TELNET' : t.srcPort === 22 || t.dstPort === 22 ? 'SSH' : 'TCP'; }
  if (has('udp')) return 'UDP';
  if (ip?.protocol === 50) return 'ESP';
  if (ip?.protocol === 47) return 'GRE';
  return has('ipv4') ? 'IPv4' : 'Ethernet';
}
/** Một dòng bảng gói: { no, time, src, dst, proto, len, info, cls, vlan }. */
export function summarize(p) {
  const eth = L(p, 'ethernet'), ip = L(p, 'ipv4'), q = L(p, 'dot1q');
  const proto = protoOf(p);
  let info = '';
  const a = L(p, 'arp'), ic = L(p, 'icmp'), t = L(p, 'tcp'), u = L(p, 'udp');
  if (a) info = a.opcode === 2 ? `${a.senderIp} is at ${a.senderMac}` : `Who has ${a.targetIp}? Tell ${a.senderIp}`;
  else if (ic) info = (ICMP_T[ic.type] || `Type ${ic.type}`) + (ic.type === 8 || ic.type === 0 ? `  id=${hex4(ic.identifier ?? 0)}, seq=${ic.seq ?? 0}, ttl=${ip?.ttl ?? ''}` : '');
  else if (L(p, 'dhcp')) { const dh = L(p, 'dhcp'); const mt = dh.options?.find((o) => o.code === 53)?.data?.[0]; info = `DHCP ${DHCP_T[mt] || ''} - Transaction ID ${'0x' + (dh.xid >>> 0).toString(16)}`; }
  else if (L(p, 'ospf')) { const o = L(p, 'ospf'); info = OSPF_T[o.type] || 'OSPF'; }
  else if (L(p, 'eigrp')) { const e = L(p, 'eigrp'); info = e.hello || e.opcode === 5 ? 'Hello' : e.opcode === 1 ? 'Update' : `Opcode ${e.opcode}`; }
  else if (L(p, 'hsrp')) { const h = L(p, 'hsrp'); info = `Hello (state ${HSRP_S[h.state] || h.state})`; }
  else if (L(p, 'stp')) { const s = L(p, 'stp'); info = `Conf. Root = ${s.rootPriority}/${s.rootSysId || 0}/${s.rootMac}  Cost = ${s.rootPathCost}  Port = ${hex4(((s.portPriority ?? 128) << 8) | s.portNumber)}`; }
  else if (t) { const fl = Object.keys(t.flags || {}).filter((k) => t.flags[k]).map((k) => k.toUpperCase()).join(', '); info = `${t.srcPort} → ${t.dstPort} [${fl}] Seq=${t.seq ?? 0}${t.flags?.ack ? ` Ack=${t.ack ?? 0}` : ''} Win=${t.window ?? 0} Len=0${t.mss ? ` MSS=${t.mss}` : ''}`; }
  else if (u) info = `${u.srcPort} → ${u.dstPort} Len=${Math.max(0, p.bytes.length - 42)}`;
  else if (ip?.protocol === 50) info = 'ESP (SPI=0x1a2b3c4d)';
  else if (ip?.protocol === 47) info = 'Encapsulated IPv4 (GRE)';
  return {
    no: p.no, time: p.t, proto, len: p.bytes.length, info, vlan: q?.vid ?? null,
    src: ip && !a ? ip.src : eth?.src || '', dst: ip && !a ? ip.dst : eth?.dst === 'ff:ff:ff:ff:ff:ff' ? 'Broadcast' : eth?.dst || '',
    cls: { ICMP: 'icmp', ARP: 'arp', TCP: 'tcp', TELNET: 'tcp', SSH: 'tcp', UDP: 'udp', DHCP: 'udp', DNS: 'udp', OSPF: 'route', EIGRP: 'route', HSRP: 'route', BGP: 'route', STP: 'stp', ESP: 'vpn', GRE: 'vpn' }[proto] || 'other',
  };
}

// ---------------------------------------------------------------- bộ lọc hiển thị
const PROTO_WORDS = { icmp: ['icmp'], arp: ['arp'], tcp: ['tcp'], udp: ['udp'], ospf: ['ospf'], eigrp: ['eigrp'], hsrp: ['hsrp'], stp: ['stp'], dhcp: ['dhcp'], bootp: ['dhcp'], dns: ['dns'], vlan: ['dot1q'], ip: ['ipv4'], eth: ['ethernet'], esp: ['raw'], telnet: [], ssh: [] };
/**
 * Dịch biểu thức lọc → hàm (gói) → boolean. Hỗ trợ: tên giao thức (icmp, arp, tcp, udp, ospf, eigrp, hsrp, stp,
 * dhcp, dns, vlan, telnet, ssh, esp), ip.addr / ip.src / ip.dst == IP, tcp.port / udp.port / tcp.srcport /
 * tcp.dstport == số, vlan.id == số, eth.addr == MAC; ghép bằng && / and, || / or, ! / not, ngoặc ().
 * Trả { fn } hoặc { error }.
 */
export function compileFilter(expr) {
  const src = String(expr ?? '').trim();
  if (!src) return { fn: () => true };
  const toks = src.match(/&&|\|\||==|!=|[()!]|[^\s()!=&|]+/g) || [];
  let i = 0;
  const peek = () => toks[i];
  const take = () => toks[i++];
  const word = (w) => (peek()?.toLowerCase() === w ? (i++, true) : false);
  function or() { let l = and(); while (peek() === '||' || peek()?.toLowerCase() === 'or') { take(); const r = and(); const a = l; l = (p) => a(p) || r(p); } return l; }
  function and() { let l = not(); while (peek() === '&&' || peek()?.toLowerCase() === 'and') { take(); const r = not(); const a = l; l = (p) => a(p) && r(p); } return l; }
  function not() { if (peek() === '!' || word('not')) { if (peek() === '!') take(); const x = not(); return (p) => !x(p); } return atom(); }
  function atom() {
    if (peek() === '(') { take(); const x = or(); if (take() !== ')') throw new Error('thiếu ")"'); return x; }
    const f = take()?.toLowerCase();
    if (!f) throw new Error('biểu thức chưa hoàn chỉnh');
    if (peek() === '==' || peek() === '!=') {
      const op = take(), v = take();
      if (v == null) throw new Error(`thiếu giá trị sau ${op}`);
      const test = fieldTest(f, v);
      return op === '==' ? test : (p) => !test(p);
    }
    if (f === 'telnet' || f === 'ssh') { const port = f === 'telnet' ? 23 : 22; return (p) => { const t = L(p, 'tcp'); return !!t && (t.srcPort === port || t.dstPort === port); }; }
    if (f === 'esp') return (p) => L(p, 'ipv4')?.protocol === 50;
    if (!PROTO_WORDS[f]) throw new Error(`không hiểu "${f}"`);
    return (p) => PROTO_WORDS[f].some((x) => p.layers.some((l) => l.proto === x));
  }
  function fieldTest(f, v) {
    const num = +v;
    switch (f) {
      case 'ip.addr': case 'ip.src': case 'ip.dst': {
        if (!N.isIp(v)) throw new Error(`"${v}" không phải địa chỉ IPv4`);
        const pick = (p) => { const ip = L(p, 'ipv4'), a = L(p, 'arp'); return ip ? [ip.src, ip.dst] : a ? [a.senderIp, a.targetIp] : []; };
        if (f === 'ip.src') return (p) => pick(p)[0] === v;
        if (f === 'ip.dst') return (p) => pick(p)[1] === v;
        return (p) => pick(p).includes(v);
      }
      case 'tcp.port': case 'udp.port': case 'tcp.srcport': case 'tcp.dstport': case 'udp.srcport': case 'udp.dstport': {
        if (!Number.isInteger(num)) throw new Error(`"${v}" không phải số cổng`);
        const [pr, k] = f.split('.');
        return (p) => { const x = L(p, pr); return !!x && (k === 'port' ? x.srcPort === num || x.dstPort === num : (k === 'srcport' ? x.srcPort : x.dstPort) === num); };
      }
      case 'vlan.id': if (!Number.isInteger(num)) throw new Error(`"${v}" không phải số VLAN`); return (p) => L(p, 'dot1q')?.vid === num;
      case 'eth.addr': { const m = N.parseCiscoMac(v); if (!m) throw new Error(`"${v}" không phải địa chỉ MAC`); return (p) => { const e = L(p, 'ethernet'); return !!e && (e.src === m || e.dst === m); }; }
      default: throw new Error(`không hỗ trợ trường "${f}"`);
    }
  }
  try {
    const fn = or();
    if (i < toks.length) throw new Error(`thừa "${toks[i]}"`);
    return { fn };
  } catch (e) { return { error: e.message }; }
}

/** File .pcap (libpcap, Ethernet) của danh sách gói — mở được bằng Wireshark. t0Sec = mốc thời gian (giây epoch). */
export function capturePcap(pkts, t0Sec = 0) {
  return buildPcap(pkts.map((p) => ({ bytes: p.bytes, tsSec: Math.floor(t0Sec + p.t), tsUsec: Math.round(((t0Sec + p.t) % 1) * 1e6) % 1e6 })));
}
