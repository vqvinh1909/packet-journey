// lab/net6.js — IPv6 cho Lab CLI (dual-stack trên router + PC): địa chỉ global/link-local trên cổng,
// bảng định tuyến (C/L/S/O/OI), OSPFv3, ping IPv6 đi thật 2 chiều qua L2 (dùng flood VLAN/trunk/STP
// của net.js — tương đương NDP tìm láng giềng), và SLAAC cho PC (RA từ router có ipv6 unicast-routing).

import { flood, ifUp, epMac, longIf, linkAt, peerOf, isPrivAs } from './net.js';
import { parse6, norm6, in6, net6, eui64, linkLocal, isLinkLocal } from './ip6.js';
import { acl6Eval } from './acl6.js';

const isHost = (d) => d.type === 'pc' || d.type === 'server';
/** Cổng router có bật IPv6 không (có địa chỉ IPv6 hoặc "ipv6 enable"). */
export function v6On(f) { return !!f && ((f.ipv6 || []).length > 0 || !!f.ipv6Enable); }
/** Link-local của cổng: khai tay ("ipv6 address FE80::1 link-local") hoặc sinh từ MAC (EUI-64). */
export function llOf(net, devId, ifn) {
  const d = net.devices[devId];
  if (isHost(d)) return d.ip6 || d.slaac ? linkLocal(epMac(net, { dev: devId, ifn: 'fa0' })) : null;
  const f = d.ifaces?.[ifn];
  if (!v6On(f)) return null;
  return f.ll || linkLocal(epMac(net, { dev: devId, ifn }));
}
/** Mọi địa chỉ IPv6 (global + link-local) của 1 endpoint L3. */
export function addrs6(net, devId, ifn) {
  const d = net.devices[devId];
  const ll = llOf(net, devId, ifn);
  const g = isHost(d) ? (d.ip6 ? [d.ip6] : []) : (d.ifaces?.[ifn]?.ipv6 || []).map((a) => a.ip);
  return ll ? [...g, ll] : g;
}
function owns6(net, d, ip) {
  if (isHost(d)) return addrs6(net, d.id, 'fa0').includes(ip);
  return Object.keys(d.ifaces || {}).some((n) => ifUp(net, d.id, n) && addrs6(net, d.id, n).includes(ip));
}
const cost6 = (ifn) => (ifn.startsWith('s') ? 64 : 1); // OSPFv3 tham chiếu 100 Mbps: Fa/Gi = 1, Serial = 64

// ---------------------------------------------------------------- OSPFv3
/** Router-ID của giao thức IPv6: khai tay hoặc IPv4 cao nhất (loopback trước). Không có IPv4 → không chạy được. */
function pickRid(net, d, manual) {
  if (manual) return manual;
  const ifs = Object.entries(d.ifaces || {});
  const lo = ifs.filter(([n, f]) => n.startsWith('lo') && f.ip && !f.shutdown).map(([, f]) => f.ip);
  const pool = lo.length ? lo : ifs.filter(([n, f]) => f.ip && ifUp(net, d.id, n)).map(([, f]) => f.ip);
  return pool.sort((a, b) => b.split('.').reduce((x, y) => x * 256 + +y, 0) - a.split('.').reduce((x, y) => x * 256 + +y, 0))[0] || null;
}
export const ospf6Rid = (net, d) => pickRid(net, d, d.ospf6?.rid);
/** Láng giềng hai chiều trên cùng đoạn L2, hai đầu thoả `same` và khác router-id. */
function adj6(net, rs, en, ridOf, same) {
  const adj = {};
  for (const r of rs) {
    adj[r.id] = [];
    for (const e of en[r.id]) {
      if (e.passive) continue;
      for (const t of flood(net, { dev: r.id, ifn: e.ifn }).values()) {
        const s = net.devices[t.dev];
        if (s?.type !== 'router' || s.id === r.id || !en[s.id]) continue;
        const e2 = en[s.id].find((x) => x.ifn === t.ifn);
        if (!e2 || e2.passive || !same(e, e2) || ridOf(s) === ridOf(r)) continue;
        adj[r.id].push({ to: s.id, outIf: e.ifn, theirIf: t.ifn, nh: llOf(net, s.id, t.ifn), cost: e.cost, area: e.area });
      }
    }
  }
  for (const r of rs) adj[r.id] = adj[r.id].filter((a) => adj[a.to]?.some((b) => b.to === r.id));
  return adj;
}
/** Chạy SPF từ r rồi gom prefix của mọi router tới được; `mk` điền code, ad, metric cho từng route. */
function spfRoutes6(r, rs, en, adj, mk) {
  const dist = { [r.id]: 0 }, first = {}, done = new Set();
  for (;;) {
    let u = null;
    for (const k of Object.keys(dist)) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k;
    if (u === null) break;
    done.add(u);
    for (const a of adj[u] || []) {
      const nd = dist[u] + a.cost;
      if (dist[a.to] == null || nd < dist[a.to]) { dist[a.to] = nd; first[a.to] = u === r.id ? { nh: a.nh, iface: a.outIf } : first[u]; }
    }
  }
  const mine = new Set(Object.values(r.ifaces).flatMap((f) => (f.ipv6 || []).map((a) => net6(a.ip, a.prefix) + '/' + a.prefix)));
  const best = new Map();
  for (const s of rs) {
    if (s.id === r.id || dist[s.id] == null) continue;
    for (const e of en[s.id]) for (const p of e.prefixes) {
      const k = p.net + '/' + p.prefix;
      if (mine.has(k)) continue;
      const row = mk(e, dist[s.id] + e.cost);
      if (!best.has(k) || row.metric < best.get(k).metric) best.set(k, { ...row, net: p.net, prefix: p.prefix, nextHop: first[s.id].nh, iface: first[s.id].iface });
    }
  }
  return [...best.values()];
}
/** Các cổng chạy OSPFv3 của router (đã bật IPv6, up, có "ipv6 ospf <pid> area <a>"). */
export function ospf6Ifaces(net, d) {
  if (d.type !== 'router' || !d.ipv6Routing || !d.ospf6) return [];
  return Object.entries(d.ifaces).filter(([n, f]) => f.ospf6 && f.ospf6.pid === d.ospf6.pid && v6On(f) && ifUp(net, d.id, n))
    .map(([n, f]) => ({ ifn: n, area: String(f.ospf6.area), auth: f.ospf6Auth || '', passive: (d.ospf6.passive || []).includes(n), cost: cost6(n), prefixes: (f.ipv6 || []).map((a) => ({ net: net6(a.ip, a.prefix), prefix: a.prefix })) }));
}
/** Láng giềng + route OSPFv3 của toàn mạng: { adj: {rid: [...]}, routes: {rid: [...]}, issues }. */
export function ospf6All(net) {
  const rs = Object.values(net.devices).filter((d) => d.type === 'router' && d.ospf6 && d.ipv6Routing && ospf6Rid(net, d));
  const en = {}, routes = {};
  for (const r of rs) en[r.id] = ospf6Ifaces(net, r);
  const adj = adj6(net, rs, en, (d) => ospf6Rid(net, d), (a, b) => a.area === b.area && a.auth === b.auth);
  for (const r of rs) {
    const myAreas = new Set(en[r.id].map((e) => e.area));
    routes[r.id] = spfRoutes6(r, rs, en, adj, (e, m) => ({ code: myAreas.has(e.area) ? 'O' : 'OI', ad: 110, metric: m }));
  }
  return { adj, en, routes, rid: Object.fromEntries(rs.map((r) => [r.id, ospf6Rid(net, r)])) };
}

// ---------------------------------------------------------------- EIGRP cho IPv6
export const eigrp6Rid = (net, d) => pickRid(net, d, d.eigrp6?.rid);
/** Kiểu cũ cần "ipv6 eigrp <as>" trên từng cổng; named mode tự chạy trên mọi cổng có IPv6. */
function eigrp6Ifaces(net, d) {
  const e = d.eigrp6;
  return Object.entries(d.ifaces).filter(([n, f]) => (e.named || f.eigrp6 === e.as) && v6On(f) && ifUp(net, d.id, n))
    .map(([n, f]) => ({ ifn: n, as: e.as, passive: (e.passive || []).includes(n), cost: 1, prefixes: (f.ipv6 || []).map((a) => ({ net: net6(a.ip, a.prefix), prefix: a.prefix })) }));
}
export function eigrp6All(net) {
  const rs = Object.values(net.devices).filter((d) => d.type === 'router' && d.eigrp6 && !d.eigrp6.shutdown && d.ipv6Routing && eigrp6Rid(net, d));
  const en = {}, routes = {};
  for (const r of rs) en[r.id] = eigrp6Ifaces(net, r);
  const adj = adj6(net, rs, en, (d) => eigrp6Rid(net, d), (a, b) => a.as === b.as);
  // shortcut: metric coi mọi cổng là Gigabit nên chỉ tăng theo số chặng và chưa có feasible successor, cần so băng thông thì tính như eigrpAll của IPv4
  for (const r of rs) routes[r.id] = spfRoutes6(r, rs, en, adj, (e, m) => ({ code: 'D', ad: 90, metric: 256 * (10 + m) }));
  return { adj, routes, rid: Object.fromEntries(rs.map((r) => [r.id, eigrp6Rid(net, r)])) };
}

// ---------------------------------------------------------------- BGP cho IPv6
// shortcut: chỉ láng giềng cùng đoạn mạng và next-hop phải nằm trên mạng connected, cần peer qua loopback thì thêm tra route đệ quy
export function bgp6All(net) {
  const rs = Object.values(net.devices).filter((d) => d.type === 'router' && d.bgp?.v6 && d.ipv6Routing);
  const ridOf = (d) => d.bgp.rid || pickRid(net, d);
  const sessions = {};
  for (const r of rs) {
    sessions[r.id] = Object.entries(r.bgp.v6.neighbors).map(([ip, n]) => {
      const s = { ip, cfg: n, remoteAs: n.remoteAs, state: 'Idle', ebgp: n.remoteAs !== r.bgp.as };
      for (const [ifn, f] of Object.entries(r.ifaces)) {
        if (!v6On(f) || !ifUp(net, r.id, ifn)) continue;
        for (const t of flood(net, { dev: r.id, ifn }).values()) {
          const P = net.devices[t.dev];
          if (!addrs6(net, t.dev, t.ifn).includes(ip) || !P.bgp?.v6) continue;
          const back = addrs6(net, r.id, ifn).map((a) => P.bgp.v6.neighbors[a]).find(Boolean);
          if (n.active && back?.active && n.remoteAs === P.bgp.as && back.remoteAs === r.bgp.as && ridOf(r) && ridOf(P) && P.ipv6Routing) Object.assign(s, { state: 'Established', peer: P.id, back });
        }
      }
      return s;
    });
  }
  const local = (r) => {
    const have = new Set([
      ...Object.entries(r.ifaces).filter(([n]) => ifUp(net, r.id, n)).flatMap(([, f]) => (f.ipv6 || []).map((a) => net6(a.ip, a.prefix) + '/' + a.prefix)),
      ...(r.routes6 || []).map((s) => s.net + '/' + s.prefix),
    ]);
    return new Map(r.bgp.v6.networks.filter((p) => have.has(p.net + '/' + p.prefix)).map((p) => [p.net + '/' + p.prefix, { ...p, asPath: [], nh: null, local: true }]));
  };
  let best = Object.fromEntries(rs.map((r) => [r.id, local(r)]));
  for (let round = 0; round <= rs.length; round++) {
    const next = {};
    for (const r of rs) {
      const tb = local(r);
      for (const s of sessions[r.id]) {
        if (s.state !== 'Established') continue;
        const P = net.devices[s.peer];
        for (const [k, b] of best[P.id]) {
          if (tb.get(k)?.local || (b.ibgp && !s.ebgp)) continue; // iBGP không chuyển tiếp route học từ iBGP
          const kept = s.back.removePrivate ? b.asPath.filter((a) => !isPrivAs(a)) : b.asPath;
          const asPath = s.ebgp ? [P.bgp.as, ...kept] : b.asPath;
          if (asPath.includes(r.bgp.as)) continue;
          const c = { net: b.net, prefix: b.prefix, asPath, nh: s.ebgp || b.local || s.back.nextHopSelf ? s.ip : b.nh, ibgp: !s.ebgp, rid: ridOf(P) };
          const o = tb.get(k);
          if (!o || c.asPath.length < o.asPath.length || (c.asPath.length === o.asPath.length && o.ibgp && !c.ibgp)) tb.set(k, c);
        }
      }
      next[r.id] = tb;
    }
    best = next;
  }
  const routes = {};
  for (const r of rs) {
    const conn = Object.entries(r.ifaces).filter(([n]) => ifUp(net, r.id, n)).flatMap(([n, f]) => (f.ipv6 || []).map((a) => ({ iface: n, net: net6(a.ip, a.prefix), prefix: a.prefix })));
    routes[r.id] = [...best[r.id].values()].flatMap((b) => {
      const c = !b.local && conn.find((x) => in6(b.nh, x.net, x.prefix));
      return c ? [{ code: 'B', net: b.net, prefix: b.prefix, ad: b.ibgp ? 200 : 20, metric: 0, nextHop: b.nh, iface: c.iface }] : [];
    });
  }
  return { sessions, best, routes };
}

/** Route động IPv6 của toàn mạng, tính một lần rồi dùng cho cả lượt ping. */
export function all6(net) {
  const parts = [ospf6All(net), eigrp6All(net), bgp6All(net)], routes = {};
  for (const p of parts) for (const [id, l] of Object.entries(p.routes)) (routes[id] ||= []).push(...l);
  return { routes };
}

// ---------------------------------------------------------------- bảng định tuyến
/** Bảng định tuyến IPv6 của router (C, L, S, O, OI) — chọn theo AD rồi metric. */
export function routeTable6(net, rid, o6 = null) {
  const d = net.devices[rid];
  if (d?.type !== 'router') return [];
  const out = [];
  for (const [n, f] of Object.entries(d.ifaces)) {
    if (!v6On(f) || !ifUp(net, rid, n)) continue;
    for (const a of f.ipv6 || []) {
      out.push({ code: 'C', net: net6(a.ip, a.prefix), prefix: a.prefix, ad: 0, metric: 0, iface: n });
      out.push({ code: 'L', net: a.ip, prefix: 128, ad: 0, metric: 0, iface: n });
    }
  }
  const conn = out.filter((x) => x.code === 'C');
  for (const s of d.routes6 || []) {
    let iface = s.iface || null;
    if (iface) { if (!ifUp(net, rid, iface)) continue; }
    else {
      const c = conn.find((x) => in6(s.nh, x.net, x.prefix));
      if (!c) continue;
      iface = c.iface;
    }
    out.push({ code: 'S', net: s.net, prefix: s.prefix, ad: s.ad ?? 1, metric: 0, nextHop: s.nh || null, iface });
  }
  out.push(...((o6 || all6(net)).routes[rid] || []));
  const best = new Map();
  for (const r of out) {
    const k = r.code === 'L' ? 'L' + r.net : r.net + '/' + r.prefix;
    const b = best.get(k);
    if (!b || r.ad < b.ad || (r.ad === b.ad && r.metric < b.metric)) best.set(k, r);
  }
  return [...best.values()].sort((a, b) => (a.net < b.net ? -1 : a.net > b.net ? 1 : a.prefix - b.prefix));
}
export function lookup6(net, rid, dst, o6) {
  let best = null;
  for (const r of routeTable6(net, rid, o6)) if (in6(dst, r.net, r.prefix) && (!best || r.prefix > best.prefix)) best = r;
  return best;
}

// ---------------------------------------------------------------- gửi gói IPv6
/** NDP: tìm endpoint mang IPv6 `ip` cùng đoạn L2 với cổng `src`. */
function resolve6(net, src, ip) {
  for (const t of flood(net, src).values()) if (addrs6(net, t.dev, t.ifn).includes(ip) && ifUp(net, t.dev, t.ifn)) return t;
  return null;
}
function walk6(net, srcId, dst, o6, pkt = null, record = false) {
  const fail = (dev, why, kind) => ({ ok: false, fail: { dev, why, kind }, hops });
  // ACL IPv6 (ipv6 traffic-filter) trên cổng router: lọc gói đi vào (in) và đi ra (out); gói router tự phát không lọc out
  const filt = (d, ifn, dir) => {
    const name = d.ifaces?.[ifn]?.ipv6Filter?.[dir];
    if (!name || !pkt) return null;
    const r = acl6Eval(d.acls6?.[name], { ...pkt, dst }, record);
    return r.action === 'permit' ? null : fail(d.id, `${d.name}: ACL IPv6 "${name}" (${dir} trên ${longIf(ifn)}) ${r.implicit ? 'chặn bằng dòng ngầm định "deny ipv6 any any" ở cuối' : 'chặn bởi dòng "' + r.entry.action + ' ' + r.entry.proto + ' …"'} → hủy gói ${pkt.icmp || pkt.proto}.`, 'acl');
  };
  const hops = [];
  let node = { dev: srcId, ifn: null, origin: true };
  for (let guard = 0; guard < 32; guard++) {
    const d = net.devices[node.dev];
    if (!node.origin && d.type === 'router') { const f = filt(d, node.ifn, 'in'); if (f) return f; }
    if (!node.origin && owns6(net, d, dst)) return { ok: true, at: node, hops };
    let out, nh;
    if (isHost(d)) {
      if (!node.origin) return fail(d.id, `${d.name} nhận gói IPv6 không phải của mình → bỏ.`);
      if (!d.ip6) return fail(d.id, `${d.name} chưa có địa chỉ IPv6 global (ipv6config <IPv6>/<prefix> <gateway> hoặc ipv6config autoconfig).`);
      if (in6(dst, d.ip6, d.prefix6 ?? 64) || isLinkLocal(dst)) nh = dst;
      else {
        if (!d.gw6) return fail(d.id, `${d.name}: ${dst} khác mạng nhưng CHƯA có default gateway IPv6.`);
        nh = d.gw6;
      }
      out = { dev: d.id, ifn: 'fa0' };
    } else if (d.type === 'router') {
      if (node.origin && owns6(net, d, dst)) return { ok: true, at: node, hops };
      if (!node.origin) {
        if (!d.ipv6Routing) return fail(d.id, `${d.name} nhận gói IPv6 cần chuyển tiếp nhưng CHƯA "ipv6 unicast-routing" → router IPv6 mặc định không định tuyến.`);
        hops.push({ dev: d.id, ip: (d.ifaces[node.ifn].ipv6 || [])[0]?.ip || llOf(net, d.id, node.ifn) });
      }
      const rt = lookup6(net, d.id, dst, o6);
      if (!rt) return fail(d.id, `${d.name}: KHÔNG có route IPv6 nào khớp ${dst} → hủy gói (ICMPv6 Destination Unreachable).`);
      out = { dev: d.id, ifn: rt.iface };
      nh = rt.nextHop || dst;
      if (!node.origin) { const f = filt(d, rt.iface, 'out'); if (f) return f; }
    } else return fail(d.id, `${d.name} không định tuyến IPv6.`);
    const t = resolve6(net, out, nh);
    if (!t) return fail(out.dev, `${net.devices[out.dev].name}: không tìm được láng giềng ${nh} (NDP Neighbor Solicitation không ai trả lời) trên ${out.ifn}.`);
    node = { dev: t.dev, ifn: t.ifn };
  }
  return fail(node.dev, 'Vòng lặp định tuyến IPv6 (hop limit về 0).');
}
/** Nguồn IPv6 mà thiết bị dùng khi gửi tới dst (PC: địa chỉ global; router: global của cổng ra). */
function srcAddr6(net, d, dst, o6) {
  if (isHost(d)) return d.ip6;
  const rt = lookup6(net, d.id, dst, o6);
  return rt ? ((d.ifaces[rt.iface].ipv6 || [])[0]?.ip || llOf(net, d.id, rt.iface)) : null;
}
/** Ping IPv6 2 chiều: { ok, fail, hops }. */
export function ping6(net, srcId, dst, opts = {}) {
  dst = norm6(dst) || dst; // 2001:db8::1 và 2001:DB8::1 là một địa chỉ
  const o6 = all6(net);
  const src = srcAddr6(net, net.devices[srcId], dst, o6);
  const go = walk6(net, srcId, dst, o6, { src, proto: 'icmp', icmp: 'echo-request' }, opts.record);
  if (!go.ok) return go;
  const back = walk6(net, go.at.dev, src, o6, { src: dst, proto: 'icmp', icmp: 'echo-reply' }, opts.record);
  if (!back.ok) return { ok: false, fail: { ...back.fail, why: '(chiều VỀ) ' + back.fail.why }, hops: go.hops };
  return { ok: true, hops: go.hops };
}

// ---------------------------------------------------------------- SLAAC
/** RA Guard: router cắm vào cổng switch gắn policy device-role host thì RA của nó bị bỏ. */
function raGuarded(net, dev, ifn) {
  const l = linkAt(net, dev, ifn);
  if (!l) return false;
  const pe = peerOf(l, dev, ifn), sw = net.devices[pe.dev];
  const name = sw.ports?.[pe.port]?.raGuard;
  return !!name && (sw.raPolicies?.[name]?.role ?? 'host') === 'host';
}
/** PC xin địa chỉ bằng SLAAC: router gửi RA (cần ipv6 unicast-routing + cổng có prefix /64) → PC tự ghép EUI-64. */
export function slaac(net, pcId) {
  const mac = epMac(net, { dev: pcId, ifn: 'fa0' });
  for (const t of flood(net, { dev: pcId, ifn: 'fa0' }).values()) {
    const d = net.devices[t.dev];
    if (d.type !== 'router' || !d.ipv6Routing || !ifUp(net, d.id, t.ifn)) continue;
    const a = (d.ifaces[t.ifn].ipv6 || []).find((x) => x.prefix === 64);
    if (!a || raGuarded(net, t.dev, t.ifn)) continue;
    return { ok: true, ip: eui64(net6(a.ip, 64), mac), prefix: 64, gw: llOf(net, d.id, t.ifn), router: d.name };
  }
  return { ok: false, why: 'Không nhận được Router Advertisement (router chưa "ipv6 unicast-routing" hoặc cổng chưa có prefix /64).' };
}
