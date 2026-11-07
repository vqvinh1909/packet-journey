// lab/np.js — lệnh IOS cho phần CCNP (ENCOR, ENARSI): VRF, route-map, prefix-list, PBR, OSPF/EIGRP/BGP nâng cao, DMVPN,
// uRPF, time-range, DHCPv6, QoS MQC, CoPP, AAA authorization, NetFlow, SPAN, IP SLA, track, EEM, BFD, NETCONF, RESTCONF.
// Hàm makeNp nhận các bảng lệnh của ios.js rồi bổ sung vào đó, đồng thời khai báo các chế độ cấu hình mới.
import * as N from './net.js';
import * as A6 from './ip6.js';
import * as V6 from './net6.js';
import { hm, asPathOk, plEval, rmEval, commOk, iosRegex } from './policy.js';

const { longIf, shortIf, maskToPrefix, prefixToMask, netOf } = N;
const pad = (s, n) => String(s ?? '').padEnd(n);
const R = (out, extra = {}) => ({ out, ...extra });
const areaKey = (w) => (N.isIp(w) ? String(N.ip2n(w)) : w);

export function makeNp({ c, net, IFS, toPriv, doExec, ifAll, ctxOf, showIpRoute, iosPing, iosTrace, execLine, sess, redistSet, T }) {
  const tail = (parent = 'config') => [
    c('exit', (x) => { x.s.mode = parent; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const go = (mode, set) => (x) => { const r = set?.(x); if (r) return r; x.s.mode = mode; return R([]); };

  // ---------- VRF ----------
  const vrfSet = (x, name) => {
    const vr = (x.d.vrfs ||= {});
    vr[name] ||= { rd: null };
  };
  const ifVrf = (x, name) => {
    if (name && !x.d.vrfs?.[name]) return R([`% VRF ${name} not configured`]);
    return ifAll(x, (f, n) => {
      if ((f.vrf || null) === name) return [];
      const had = !!f.ip;
      f.vrf = name; f.ip = null; f.prefix = null; // IOS xóa IP khi đổi VRF
      return had ? [`% Interface ${longIf(n)} IPv4 disabled and address(es) removed due to ${name ? `enabling VRF ${name}` : 'disabling VRF'}`] : [];
    });
  };
  const vrfRoute = (x, vrf, ip, mask, nh, iface) => {
    if (!x.d.vrfs?.[vrf]) return R([`% VRF ${vrf} not configured`]);
    const prefix = maskToPrefix(mask);
    if (netOf(ip, prefix) !== ip) return R(['%Inconsistent address and mask']);
    x.d.routes = x.d.routes.filter((r) => !(r.vrf === vrf && r.net === ip && r.prefix === prefix));
    x.d.routes.push({ net: ip, prefix, nh: nh || null, iface: iface || null, ad: 1, vrf });
    return R([]);
  };
  const staticX = (x, ip, mask, extra) => {
    const prefix = maskToPrefix(mask);
    if (netOf(ip, prefix) !== ip) return R(['%Inconsistent address and mask']);
    x.d.routes = x.d.routes.filter((r) => !(r.net === ip && r.prefix === prefix && r.nh === (extra.nh ?? null) && (r.iface ?? null) === null));
    x.d.routes.push({ net: ip, prefix, nh: null, iface: null, ad: 1, ...extra });
    return R([]);
  };

  // ---------- prefix-list, route-map ----------
  const plAdd = (x, name, rest) => {
    const w = rest.split(/\s+/);
    let i = 0, seq = null;
    if (w[i] === 'seq') { seq = +w[i + 1]; i += 2; }
    const action = w[i++], m = String(w[i++] || '').match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
    if (!['permit', 'deny'].includes(action) || !m) return R(["% Invalid input detected at '^' marker."]);
    const e = { action, net: netOf(m[1], +m[2]), prefix: +m[2] };
    for (; i < w.length; i += 2) { if (w[i] === 'ge') e.ge = +w[i + 1]; else if (w[i] === 'le') e.le = +w[i + 1]; else return R(["% Invalid input detected at '^' marker."]); }
    const list = ((x.d.prefixLists ||= {})[name] ||= []);
    e.seq = seq ?? (list.length ? list[list.length - 1].seq + 5 : 5);
    list.splice(0, list.length, ...list.filter((o) => o.seq !== e.seq), e);
    list.sort((a, b) => a.seq - b.seq);
    return R([]);
  };
  const rmOpen = (x, name, action, seq) => {
    const list = ((x.d.routeMaps ||= {})[name] ||= []);
    let e = list.find((o) => o.seq === seq);
    if (!e) { e = { seq, action, matches: [], sets: {} }; list.push(e); list.sort((a, b) => a.seq - b.seq); }
    e.action = action;
    x.s.rm = e;
    x.s.mode = 'rmap';
    return R([]);
  };
  const rmMatch = (x, k, vals) => { x.s.rm.matches = x.s.rm.matches.filter((m) => m.k !== k); x.s.rm.matches.push({ k, vals }); return R([]); };
  const rmSet = (x, k, v) => { x.s.rm.sets[k] = v; return R([]); };
  const words = (s) => s.trim().split(/\s+/);
  const RMAP_MODE = [
    c('match ip address prefix-list <rest>', (x) => rmMatch(x, 'pl', words(x.a[0]))),
    c('match ip address <rest>', (x) => rmMatch(x, 'acl', words(x.a[0]))),
    c('match tag <rest>', (x) => rmMatch(x, 'tag', words(x.a[0]).map(Number))),
    c('match metric <rest>', (x) => rmMatch(x, 'metric', words(x.a[0]).map(Number))),
    c('match as-path <rest>', (x) => rmMatch(x, 'aspath', words(x.a[0]))),
    c('match community <rest>', (x) => rmMatch(x, 'comm', words(x.a[0]))),
    c('set community <rest>', (x) => { const w = words(x.a[0]), additive = w.includes('additive'); return rmSet(x, 'community', { vals: w.includes('none') ? [] : w.filter((v) => v !== 'additive'), additive }); }),
    c('no set community', (x) => { delete x.s.rm.sets.community; return R([]); }),
    c('no match {tag|metric}', (x) => { x.s.rm.matches = x.s.rm.matches.filter((m) => m.k !== x.a[0]); return R([]); }),
    c('set metric <num>', (x) => rmSet(x, 'metric', x.a[0])),
    c('set tag <num>', (x) => rmSet(x, 'tag', x.a[0])),
    c('set local-preference <num>', (x) => rmSet(x, 'localPref', x.a[0])),
    c('set weight <num>', (x) => rmSet(x, 'weight', x.a[0])),
    c('set as-path prepend <rest>', (x) => rmSet(x, 'prepend', words(x.a[0]).map(Number))),
    c('set metric-type {type-1|type-2}', (x) => rmSet(x, 'metricType', x.a[0] === 'type-1' ? 1 : 2)),
    c('set ip next-hop <ip>', (x) => rmSet(x, 'nextHop', x.a[0])),
    c('no set {metric|tag|weight}', (x) => { delete x.s.rm.sets[x.a[0]]; return R([]); }),
    c('description <rest>', () => R([])),
    ...tail(),
  ];

  // ---------- redistribute dạng chung: [as|pid] [metric ...] [metric-type n] [subnets] [route-map X] [tag n] ----------
  const redistGen = (proto, x) => {
    const src = x.a[0], w = words(x.a[1]), cfg = {};
    let i = 0;
    if (/^\d+$/.test(w[0])) { if (src === 'ospf') cfg.pid = +w[0]; else cfg.as = +w[0]; i = 1; }
    while (i < w.length) {
      const k = w[i++];
      if (k === 'subnets') cfg.subnets = true;
      else if (k === 'route-map') cfg.routeMap = w[i++];
      else if (k === 'tag') cfg.tag = +w[i++];
      else if (k === 'metric-type') cfg.metricType = +w[i++];
      else if (k === 'metric') { if (proto === 'eigrp') { cfg.metric = [+w[i], +w[i + 1]]; i += 5; } else cfg.metric = +w[i++]; }
      else return R(["% Invalid input detected at '^' marker."]);
    }
    return redistSet(x, proto, src, cfg);
  };
  const distList = (proto) => [
    c('distribute-list prefix <word> in', (x) => { x.d[proto].distList = { pl: x.a[0] }; return R([]); }),
    c('distribute-list route-map <word> in', (x) => { x.d[proto].distList = { rm: x.a[0] }; return R([]); }),
    c('distribute-list <word> in', (x) => { x.d[proto].distList = { acl: x.a[0] }; return R([]); }),
    c('no distribute-list <rest>', (x) => { x.d[proto].distList = null; return R([]); }),
  ];

  // ---------- OSPF ----------
  const area = (x, w) => ((x.d.ospf.areas ||= {})[areaKey(w)] ||= {});
  const vl = (x) => {
    const list = (x.d.ospf.vlinks ||= []), a = areaKey(x.a[0]);
    if (a === '0') return {};
    let v = list.find((o) => o.area === a && o.rid === x.a[1]);
    if (!v) { v = { area: a, rid: x.a[1] }; list.push(v); }
    return v;
  };
  const OSPF_X = [
    c('area <word> stub', (x) => { Object.assign(area(x, x.a[0]), { type: 'stub', noSummary: false }); return R([]); }),
    c('area <word> stub no-summary', (x) => { Object.assign(area(x, x.a[0]), { type: 'stub', noSummary: true }); return R([]); }),
    c('area <word> nssa', (x) => { Object.assign(area(x, x.a[0]), { type: 'nssa', noSummary: false, nssaDefault: false }); return R([]); }),
    c('area <word> nssa no-summary', (x) => { Object.assign(area(x, x.a[0]), { type: 'nssa', noSummary: true }); return R([]); }),
    c('area <word> nssa default-information-originate', (x) => { Object.assign(area(x, x.a[0]), { type: 'nssa', nssaDefault: true }); return R([]); }),
    c('no area <word> {stub|nssa}', (x) => { Object.assign(area(x, x.a[0]), { type: '', noSummary: false, nssaDefault: false }); return R([]); }),
    c('area <word> range <ip> <mask>', (x) => { const a = area(x, x.a[0]), prefix = maskToPrefix(x.a[2]); (a.ranges ||= []).push({ net: netOf(x.a[1], prefix), prefix }); return R([]); }),
    c('area <word> range <ip> <mask> not-advertise', (x) => { const a = area(x, x.a[0]), prefix = maskToPrefix(x.a[2]); (a.ranges ||= []).push({ net: netOf(x.a[1], prefix), prefix, hide: true }); return R([]); }),
    c('no area <word> range <ip> <mask>', (x) => { const a = area(x, x.a[0]); a.ranges = (a.ranges || []).filter((g) => g.net !== x.a[1]); return R([]); }),
    c('area <word> virtual-link <ip>', (x) => { vl(x); return areaKey(x.a[0]) === '0' ? R(['% OSPF: Area 0 cannot be a transit area']) : R([]); }),
    c('area <word> virtual-link <ip> authentication', (x) => { vl(x).auth = 'plain'; return R([]); }),
    c('area <word> virtual-link <ip> authentication message-digest', (x) => { vl(x).auth = 'md5'; return R([]); }),
    c('area <word> virtual-link <ip> authentication null', (x) => { vl(x).auth = 'null'; return R([]); }),
    c('area <word> virtual-link <ip> authentication-key <word>', (x) => { vl(x).key = x.a[2]; return R([]); }),
    c('area <word> virtual-link <ip> message-digest-key <num> md5 <word>', (x) => { vl(x).md5 = { id: x.a[2], key: x.a[3] }; return R([]); }),
    c('no area <word> virtual-link <ip>', (x) => { x.d.ospf.vlinks = (x.d.ospf.vlinks || []).filter((v) => v.rid !== x.a[1]); return R([]); }),
    c('area <word> authentication', (x) => { area(x, x.a[0]).auth = 'plain'; return R([]); }),
    c('area <word> authentication message-digest', (x) => { area(x, x.a[0]).auth = 'md5'; return R([]); }),
    c('no area <word> authentication', (x) => { delete area(x, x.a[0]).auth; return R([]); }),
    c('area <word> filter-list prefix <word> in', (x) => { area(x, x.a[0]).flIn = x.a[1]; return R([]); }),
    c('area <word> filter-list prefix <word> out', (x) => { area(x, x.a[0]).flOut = x.a[1]; return R([]); }),
    c('summary-address <ip> <mask>', (x) => { const prefix = maskToPrefix(x.a[1]); (x.d.ospf.summaries ||= []).push({ net: netOf(x.a[0], prefix), prefix }); return R([]); }),
    c('summary-address <ip> <mask> not-advertise', (x) => { const prefix = maskToPrefix(x.a[1]); (x.d.ospf.summaries ||= []).push({ net: netOf(x.a[0], prefix), prefix, hide: true }); return R([]); }),
    c('neighbor <ip>', (x) => { (x.d.ospf.nbrs ||= []).push(x.a[0]); return R([]); }),
    c('distance <num>', (x) => { x.d.ospf.distance = x.a[0]; return R([]); }),
    c('no distance', (x) => { x.d.ospf.distance = null; return R([]); }),
    c('distance ospf <rest>', (x) => { const w = words(x.a[0]), by = {}; for (let i = 0; i < w.length; i += 2) { if (!['intra-area', 'inter-area', 'external'].includes(w[i]) || !(+w[i + 1] > 0)) return R(["% Invalid input detected at '^' marker."]); by[w[i]] = +w[i + 1]; } x.d.ospf.distanceBy = by; return R([]); }),
    c('no distance ospf', (x) => { x.d.ospf.distanceBy = null; return R([]); }),
    c('redistribute {static|connected|eigrp|bgp} <rest>', (x) => redistGen('ospf', x)),
    c('bfd all-interfaces', (x) => { x.d.ospf.bfd = true; return R([]); }),
    c('no bfd all-interfaces', (x) => { x.d.ospf.bfd = false; return R([]); }),
    ...distList('ospf'),
  ];

  // ---------- EIGRP ----------
  const EIGRP_X = [
    c('eigrp stub', (x) => { x.d.eigrp.stub = ['connected', 'summary']; return R([]); }),
    c('eigrp stub <rest>', (x) => { x.d.eigrp.stub = words(x.a[0]); return R([]); }),
    c('no eigrp stub', (x) => { x.d.eigrp.stub = null; return R([]); }),
    c('variance <num>', (x) => { x.d.eigrp.variance = x.a[0]; return R([]); }),
    c('no variance', (x) => { x.d.eigrp.variance = 1; return R([]); }),
    c('maximum-paths <num>', () => R([])),
    c('metric weights <rest>', (x) => { x.d.eigrp.k = x.a[0] === '0 1 0 1 0 0' ? '' : x.a[0]; return R([]); }),
    c('distance eigrp <num> <num>', (x) => { x.d.eigrp.distanceInt = x.a[0]; x.d.eigrp.distanceExt = x.a[1]; return R([]); }),
    c('redistribute {static|connected|ospf|bgp} <rest>', (x) => redistGen('eigrp', x)),
    c('bfd all-interfaces', (x) => { x.d.eigrp.bfd = true; return R([]); }),
    ...distList('eigrp'),
  ];
  const afIf = (x) => { const e = x.d.eigrp; return ((e.afIf ||= {})[x.s.afIf] ||= {}); };
  const EAF_MODE = () => [
    ...T.EIGRP_MODE.filter((e) => !['exit', 'end', 'do <rest>'].includes(e.spec)),
    c('af-interface default', go('eafif', (x) => { x.s.afIf = 'default'; })),
    c('af-interface <if>', go('eafif', (x) => { x.s.afIf = x.a[0]; })),
    c('topology base', go('etopo')),
    c('exit-address-family', go('enamed')),
    ...tail('enamed'),
  ];
  const EAFIF_MODE = [
    c('passive-interface', (x) => { afIf(x).passive = true; return R([]); }),
    c('no passive-interface', (x) => { afIf(x).passive = false; return R([]); }),
    c('authentication mode {md5|hmac-sha-256}', (x) => { (afIf(x).auth ||= {}).mode = x.a[0]; return R([]); }),
    c('authentication key-chain <word>', (x) => { (afIf(x).auth ||= {}).chain = x.a[0]; return R([]); }),
    c('summary-address <ip> <mask>', (x) => { const prefix = maskToPrefix(x.a[1]); (afIf(x).summaries ||= []).push({ net: netOf(x.a[0], prefix), prefix }); return R([]); }),
    c('no split-horizon', (x) => { afIf(x).noSH = true; return R([]); }),
    c('no next-hop-self', (x) => { afIf(x).noNhs = true; return R([]); }),
    c('hello-interval <num>', () => R([])),
    c('hold-time <num>', () => R([])),
    c('bfd', () => R([])),
    c('exit-af-interface', go('eaf')),
    ...tail('eaf'),
  ];
  const ETOPO_MODE = [
    ...EIGRP_X.filter((e) => /^(variance|no variance|maximum-paths|distance|redistribute|distribute-list|no distribute-list)/.test(e.spec)),
    c('exit-af-topology', go('eaf')),
    ...tail('eaf'),
  ];
  const namedAf = (x, as, vrf) => {
    if (!x.d.eigrp) x.d.eigrp = N.newEigrp(as);
    else if (x.d.eigrp.as !== as) return R([`% Lab: thiết bị này đã chạy EIGRP AS ${x.d.eigrp.as}.`]);
    x.d.eigrp.named = x.s.eName;
    if (vrf) x.d.eigrp.vrf = vrf;
    x.s.mode = 'eaf';
    return R([]);
  };
  const ENAMED_MODE = [
    c('address-family ipv4 autonomous-system <num>', (x) => namedAf(x, x.a[0])),
    c('address-family ipv4 unicast autonomous-system <num>', (x) => namedAf(x, x.a[0])),
    // shortcut: mỗi router chỉ một tiến trình EIGRP nên một VRF, cần nhiều VRF thì tách d.eigrp theo VRF
    c('address-family ipv4 vrf <word> autonomous-system <num>', (x) => namedAf(x, x.a[1], x.a[0])),
    c('address-family ipv6 autonomous-system <num>', go('eaf6', (x) => e6Open(x, x.a[0], x.s.eName))),
    c('address-family ipv6 unicast autonomous-system <num>', go('eaf6', (x) => e6Open(x, x.a[0], x.s.eName))),
    ...tail(),
  ];
  // ---------- EIGRP cho IPv6 ----------
  const e6Open = (x, as, named = null) => {
    if (!x.d.ipv6Routing) return R(['% IPv6 routing not enabled']);
    if (x.d.eigrp6 && x.d.eigrp6.as !== as) return R([`% Lab: thiết bị này đã chạy EIGRP IPv6 AS ${x.d.eigrp6.as}.`]);
    x.d.eigrp6 ||= { as, named, rid: null, passive: [], shutdown: false };
    x.d.eigrp6.named = named;
    return null;
  };
  const e6Common = [
    c('eigrp router-id <ip>', (x) => { x.d.eigrp6.rid = x.a[0]; return R([]); }),
    c('no eigrp router-id', (x) => { x.d.eigrp6.rid = null; return R([]); }),
  ];
  const E6_MODE = [
    ...e6Common,
    c('passive-interface <if>', (x) => { x.d.eigrp6.passive = [...new Set([...x.d.eigrp6.passive, x.a[0]])]; return R([]); }),
    c('no passive-interface <if>', (x) => { x.d.eigrp6.passive = x.d.eigrp6.passive.filter((n) => n !== x.a[0]); return R([]); }),
    c('shutdown', (x) => { x.d.eigrp6.shutdown = true; return R([]); }),
    c('no shutdown', (x) => { x.d.eigrp6.shutdown = false; return R([]); }),
    ...tail(),
  ];
  const EAF6_MODE = [
    ...e6Common,
    c('af-interface <if>', go('eaf6if', (x) => { x.s.afIf = x.a[0]; })),
    c('exit-address-family', go('enamed')),
    ...tail('enamed'),
  ];
  const EAF6IF_MODE = [
    c('passive-interface', (x) => { x.d.eigrp6.passive = [...new Set([...x.d.eigrp6.passive, x.s.afIf])]; return R([]); }),
    c('no passive-interface', (x) => { x.d.eigrp6.passive = x.d.eigrp6.passive.filter((n) => n !== x.s.afIf); return R([]); }),
    c('exit-af-interface', go('eaf6')),
    ...tail('eaf6'),
  ];

  // ---------- BGP ----------
  const bn = (x) => {
    const b = x.d.bgp, k = x.a[0];
    if (N.isIp(k)) return (b.neighbors[k] ||= {});
    return ((b.groups ||= {})[k] ||= {});
  };
  const bset = (fn) => (x) => { const n = bn(x); const r = fn(n, x); return r || R([]); };
  const bopt = (k, v) => (x) => { x.d.bgp[k] = v; return R([]); };
  const BGP_X = [
    c('neighbor <word> peer-group', (x) => { (x.d.bgp.groups ||= {})[x.a[0]] ||= {}; return R([]); }),
    c('neighbor <ip> peer-group <word>', (x) => { if (!x.d.bgp.groups?.[x.a[1]]) return R([`% Create the peer-group ${x.a[1]} first`]); bn(x).group = x.a[1]; return R([]); }),
    c('neighbor <word> remote-as <num>', bset((n, x) => { n.remoteAs = x.a[1]; })),
    c('neighbor <word> update-source <if>', bset((n, x) => { n.updateSource = x.a[1]; })),
    c('neighbor <word> next-hop-self', bset((n) => { n.nextHopSelf = true; })),
    c('no neighbor <word> next-hop-self', bset((n) => { n.nextHopSelf = false; })),
    c('neighbor <word> route-reflector-client', bset((n) => { n.rrClient = true; })),
    c('no neighbor <word> route-reflector-client', bset((n) => { n.rrClient = false; })),
    c('neighbor <word> route-map <word> {in|out}', bset((n, x) => { n[x.a[2] === 'in' ? 'rmIn' : 'rmOut'] = x.a[1]; })),
    c('no neighbor <word> route-map <word> {in|out}', bset((n, x) => { delete n[x.a[2] === 'in' ? 'rmIn' : 'rmOut']; })),
    c('neighbor <word> prefix-list <word> {in|out}', bset((n, x) => { n[x.a[2] === 'in' ? 'plIn' : 'plOut'] = x.a[1]; })),
    c('no neighbor <word> prefix-list <word> {in|out}', bset((n, x) => { delete n[x.a[2] === 'in' ? 'plIn' : 'plOut']; })),
    c('neighbor <word> filter-list <word> {in|out}', bset((n, x) => { n[x.a[2] === 'in' ? 'flIn' : 'flOut'] = x.a[1]; })),
    c('neighbor <word> weight <num>', bset((n, x) => { n.weight = x.a[1]; })),
    c('neighbor <word> ebgp-multihop', bset((n) => { n.multihop = 255; })),
    c('neighbor <word> ebgp-multihop <num>', bset((n, x) => { n.multihop = x.a[1]; })),
    c('no neighbor <word> ebgp-multihop', bset((n) => { n.multihop = null; })),
    c('neighbor <word> password <word>', bset((n, x) => { n.password = x.a[1]; })),
    c('no neighbor <word> password', bset((n) => { n.password = null; })),
    c('neighbor <word> timers <num> <num>', bset((n, x) => { n.timers = [x.a[1], x.a[2]]; })),
    c('neighbor <word> remove-private-as', bset((n) => { n.removePrivate = true; })),
    c('neighbor <word> remove-private-as all', bset((n) => { n.removePrivate = 'all'; })),
    c('no neighbor <word> remove-private-as', bset((n) => { n.removePrivate = false; })),
    c('neighbor <word> disable-connected-check', bset((n) => { n.noConnCheck = true; })),
    c('no neighbor <word> disable-connected-check', bset((n) => { n.noConnCheck = false; })),
    c('neighbor <word> ttl-security hops <num>', bset((n, x) => { if (n.multihop) return R(['% Lab: ttl-security không dùng chung với ebgp-multihop']); n.ttlSec = x.a[1]; })),
    c('no neighbor <word> ttl-security', bset((n) => { n.ttlSec = null; })),
    c('neighbor <word> allowas-in', bset((n) => { n.allowasIn = 3; })),
    c('neighbor <word> allowas-in <num>', bset((n, x) => { n.allowasIn = x.a[1]; })),
    c('no neighbor <word> allowas-in', bset((n) => { n.allowasIn = null; })),
    c('neighbor <word> as-override', bset((n) => { n.asOverride = true; })),
    c('no neighbor <word> as-override', bset((n) => { n.asOverride = false; })),
    c('neighbor <word> maximum-prefix <num>', bset((n, x) => { n.maxPrefix = { max: x.a[1] }; })),
    c('neighbor <word> maximum-prefix <num> warning-only', bset((n, x) => { n.maxPrefix = { max: x.a[1], warnOnly: true }; })),
    c('neighbor <word> maximum-prefix <num> <num>', bset((n, x) => { n.maxPrefix = { max: x.a[1], thr: x.a[2] }; })),
    c('neighbor <word> maximum-prefix <num> <num> warning-only', bset((n, x) => { n.maxPrefix = { max: x.a[1], thr: x.a[2], warnOnly: true }; })),
    c('no neighbor <word> maximum-prefix', bset((n) => { n.maxPrefix = null; })),
    c('bgp always-compare-med', bopt('alwaysMed', true)),
    c('no bgp always-compare-med', bopt('alwaysMed', false)),
    c('bgp bestpath as-path ignore', bopt('asPathIgnore', true)),
    c('no bgp bestpath as-path ignore', bopt('asPathIgnore', false)),
    c('bgp bestpath med missing-as-worst', bopt('medWorst', true)),
    c('no bgp bestpath med missing-as-worst', bopt('medWorst', false)),
    // shortcut: Lab không tính tuổi đường eBGP nên luôn so router-id, lệnh này chỉ được lưu; cần phân biệt thì thêm thời điểm học route
    c('bgp bestpath compare-routerid', bopt('cmpRid', true)),
    c('no bgp bestpath compare-routerid', bopt('cmpRid', false)),
    // shortcut: asdot chỉ đổi cách hiển thị, chưa nhận "remote-as 1.0"; cần nhập kiểu chấm thì thêm kiểu token cho AS
    c('bgp asnotation dot', bopt('asDot', true)),
    c('no bgp asnotation dot', bopt('asDot', false)),
    c('neighbor <word> soft-reconfiguration inbound', bset((n) => { n.softIn = true; })),
    c('neighbor <word> shutdown', bset((n) => { n.shutdown = true; })),
    c('no neighbor <word> shutdown', bset((n) => { n.shutdown = false; })),
    c('neighbor <word> activate', () => R([])),
    c('neighbor <word> send-community', bset((n) => { n.sendCommunity = true; })),
    c('neighbor <word> send-community {standard|both}', bset((n) => { n.sendCommunity = true; })),
    c('no neighbor <word> send-community', bset((n) => { n.sendCommunity = false; })),
    c('neighbor <word> fall-over bfd', bset((n) => { n.bfd = true; })),
    c('address-family ipv4', () => R([])),
    c('address-family ipv4 unicast', () => R([])),
    // shortcut: mỗi router chỉ một tiến trình BGP nên một VRF, cần nhiều VRF thì tách d.bgp theo VRF
    c('address-family ipv4 vrf <word>', (x) => { if (!x.d.vrfs?.[x.a[0]]) return R([`% VRF ${x.a[0]} not configured`]); x.d.bgp.vrf = x.a[0]; return R([]); }),
    c('exit-address-family', () => R([])),
    c('synchronization', () => R(['(Lab: synchronization chỉ còn ý nghĩa lịch sử, IOS hiện tại mặc định tắt)'])),
    c('no synchronization', () => R([])),
    c('timers bgp <num> <num>', (x) => { x.d.bgp.timers = [x.a[0], x.a[1]]; return R([]); }),
    c('maximum-paths <num>', () => R([])),
    c('aggregate-address <ip> <mask>', (x) => { const prefix = maskToPrefix(x.a[1]); (x.d.bgp.aggregates ||= []).push({ net: netOf(x.a[0], prefix), prefix }); return R([]); }),
    c('aggregate-address <ip> <mask> summary-only', (x) => { const prefix = maskToPrefix(x.a[1]); (x.d.bgp.aggregates ||= []).push({ net: netOf(x.a[0], prefix), prefix, summaryOnly: true }); return R([]); }),
    c('no aggregate-address <ip> <mask>', (x) => { x.d.bgp.aggregates = (x.d.bgp.aggregates || []).filter((g) => g.net !== x.a[0]); return R([]); }),
    c('distance bgp <num> <num> <num>', (x) => { Object.assign(x.d.bgp, { distanceE: x.a[0], distanceI: x.a[1] }); return R([]); }),
    c('redistribute {connected|static}', (x) => { (x.d.bgp.redist ||= {})[x.a[0]] = {}; return R([]); }),
    c('redistribute {connected|static} route-map <word>', (x) => { (x.d.bgp.redist ||= {})[x.a[0]] = { routeMap: x.a[1] }; return R([]); }),
    c('redistribute {ospf|eigrp} <num>', (x) => { (x.d.bgp.redist ||= {})[x.a[0]] = { id: x.a[1] }; return R([]); }),
    c('redistribute {ospf|eigrp} <num> route-map <word>', (x) => { (x.d.bgp.redist ||= {})[x.a[0]] = { id: x.a[1], routeMap: x.a[2] }; return R([]); }),
    c('no redistribute {connected|static|ospf|eigrp} <rest>', (x) => { delete x.d.bgp.redist?.[x.a[0]]; return R([]); }),
    ...distList('bgp'),
  ];
  // ---------- BGP cho IPv6: láng giềng khai chung, phải activate trong address-family ----------
  const b6 = (x) => (x.d.bgp.v6 ||= { neighbors: {}, networks: [] });
  const b6n = (x, fn) => { const n = b6(x).neighbors[x.a[0]]; if (!n) return R([`% Specify remote-as or peer-group commands first`]); fn(n); return R([]); };
  const b6Af = go('bgpaf6', (x) => { b6(x); });
  const BGP6_X = [
    c('neighbor <ip6> remote-as <num>', (x) => { (b6(x).neighbors[x.a[0]] ||= {}).remoteAs = x.a[1]; return R([]); }),
    c('no neighbor <ip6>', (x) => { delete b6(x).neighbors[x.a[0]]; return R([]); }),
    c('no bgp default ipv4-unicast', () => R([])),
    c('address-family ipv6', b6Af),
    c('address-family ipv6 unicast', b6Af),
  ];
  const BGPAF6_MODE = [
    c('neighbor <ip6> activate', (x) => b6n(x, (n) => { n.active = true; })),
    c('no neighbor <ip6> activate', (x) => b6n(x, (n) => { n.active = false; })),
    c('neighbor <ip6> next-hop-self', (x) => b6n(x, (n) => { n.nextHopSelf = true; })),
    c('no neighbor <ip6> next-hop-self', (x) => b6n(x, (n) => { n.nextHopSelf = false; })),
    c('neighbor <ip6> remove-private-as', (x) => b6n(x, (n) => { n.removePrivate = true; })),
    c('network <ip6p>', (x) => { const v = b6(x), net0 = A6.net6(x.a[0].ip, x.a[0].prefix); if (!v.networks.some((p) => p.net === net0 && p.prefix === x.a[0].prefix)) v.networks.push({ net: net0, prefix: x.a[0].prefix }); return R([]); }),
    c('no network <ip6p>', (x) => { const v = b6(x), net0 = A6.net6(x.a[0].ip, x.a[0].prefix); v.networks = v.networks.filter((p) => !(p.net === net0 && p.prefix === x.a[0].prefix)); return R([]); }),
    c('exit-address-family', go('bgp')),
    ...tail('bgp'),
  ];

  // ---------- QoS, CoPP ----------
  const qos = (d) => (d.qos ||= { classes: {}, policies: {} });
  const QCMAP_MODE = [
    c('match access-group name <word>', (x) => { x.s.qc.matches.push({ k: 'acl', v: x.a[0] }); return R([]); }),
    c('match access-group <word>', (x) => { x.s.qc.matches.push({ k: 'acl', v: x.a[0] }); return R([]); }),
    c('match ip dscp <word>', (x) => { x.s.qc.matches.push({ k: 'dscp', v: x.a[0].toLowerCase() }); return R([]); }),
    c('match dscp <word>', (x) => { x.s.qc.matches.push({ k: 'dscp', v: x.a[0].toLowerCase() }); return R([]); }),
    c('match any', (x) => { x.s.qc.matches.push({ k: 'any' }); return R([]); }),
    c('description <rest>', () => R([])),
    ...tail(),
  ];
  const pclass = (x) => x.s.qe;
  const QPMAPC_MODE = [
    c('police <num>', (x) => { pclass(x).police = x.a[0]; return R([]); }),
    c('police <num> <rest>', (x) => { pclass(x).police = x.a[0]; return R([]); }),
    c('police cir <num>', (x) => { pclass(x).police = x.a[0]; return R([]); }),
    c('police cir <num> <rest>', (x) => { pclass(x).police = x.a[0]; return R([]); }),
    c('drop', (x) => { pclass(x).drop = true; return R([]); }),
    c('no drop', (x) => { pclass(x).drop = false; return R([]); }),
    c('priority <num>', (x) => { pclass(x).priority = `${x.a[0]} kbps`; return R([]); }),
    c('priority percent <num>', (x) => { pclass(x).priority = `${x.a[0]}%`; return R([]); }),
    c('priority level <num>', (x) => { pclass(x).priority = `level ${x.a[0]}`; return R([]); }),
    c('bandwidth <num>', (x) => { pclass(x).bw = `${x.a[0]} kbps`; return R([]); }),
    c('bandwidth percent <num>', (x) => { pclass(x).bw = `${x.a[0]}%`; return R([]); }),
    c('bandwidth remaining percent <num>', (x) => { pclass(x).bw = `còn lại ${x.a[0]}%`; return R([]); }),
    c('shape average <num>', (x) => { pclass(x).shape = x.a[0]; return R([]); }),
    c('set dscp <word>', (x) => { pclass(x).dscp = x.a[0].toLowerCase(); return R([]); }),
    c('set ip dscp <word>', (x) => { pclass(x).dscp = x.a[0].toLowerCase(); return R([]); }),
    c('random-detect', (x) => { pclass(x).wred = true; return R([]); }),
    c('random-detect dscp-based', (x) => { pclass(x).wred = true; return R([]); }),
    c('fair-queue', (x) => { pclass(x).fq = true; return R([]); }),
    c('service-policy <word>', (x) => { pclass(x).child = x.a[0]; return R([]); }),
    ...tail('qpmap'),
  ];
  const QPMAP_MODE = [
    c('class <word>', (x) => { const pm = qos(x.d).policies[x.s.qp]; let e = pm.find((o) => o.cls === x.a[0]); if (!e) { e = { cls: x.a[0] }; pm.push(e); } x.s.qe = e; x.s.mode = 'qpmapc'; return R([]); }),
    c('description <rest>', () => R([])),
    ...tail(),
  ];
  const CPP_MODE = [
    c('service-policy input <word>', (x) => { (x.d.copp ||= {}).input = x.a[0]; return R([]); }),
    c('no service-policy input <word>', (x) => { if (x.d.copp) x.d.copp.input = null; return R([]); }),
    ...tail(),
  ];
  const qosLines = (d, name, ind = '  ') => (d.qos?.policies?.[name] || []).flatMap((e) => [
    `${ind}Class-map: ${e.cls} (${d.qos.classes[e.cls]?.all === false ? 'match-any' : 'match-all'})`,
    `${ind}  ${e.pkts || 0} packets`,
    ...(d.qos.classes[e.cls]?.matches || []).map((m) => `${ind}  Match: ${m.k === 'acl' ? `access-group name ${m.v}` : m.k === 'dscp' ? `dscp ${m.v}` : 'any'}`),
    ...(e.priority ? [`${ind}  Priority: ${e.priority}`] : []),
    ...(e.bw ? [`${ind}  Bandwidth ${e.bw}`] : []),
    ...(e.shape ? [`${ind}  Shape average ${e.shape} bps`] : []),
    ...(e.police != null ? [`${ind}  police: cir ${e.police} bps`] : []),
    ...(e.dscp ? [`${ind}  QoS Set: dscp ${e.dscp}`] : []),
    ...(e.wred ? [`${ind}  Random-detect (WRED)`] : []),
    ...(e.drop ? [`${ind}  drop`] : []),
    ...(e.child ? [`${ind}  Service-policy: ${e.child}`, ...qosLines(d, e.child, ind + '    ')] : []),
  ]);

  // ---------- DHCPv6 ----------
  const dh6 = (d) => (d.dhcp6 ||= { pools: {}, bindings: [] });
  const DHCP6_MODE = [
    c('address prefix <ip6p>', (x) => { dh6(x.d).pools[x.s.dh6].addr = x.a[0]; return R([]); }),
    c('dns-server <ip6>', (x) => { dh6(x.d).pools[x.s.dh6].dns = x.a[0]; return R([]); }),
    c('domain-name <word>', (x) => { dh6(x.d).pools[x.s.dh6].domain = x.a[0]; return R([]); }),
    ...tail(),
  ];
  const dhcp6Client = (x) => ifAll(x, (f, n) => {
    if (!N.ifUp(net, x.d.id, n)) return ['% Lab: cổng chưa up nên không gửi được DHCPv6 Solicit'];
    for (const t of N.flood(net, { dev: x.d.id, ifn: n }).values()) {
      const P = net.devices[t.dev], g = N.isL3(P) ? IFS(P)[t.ifn] : null;
      if (!g) continue;
      let srv = g.dhcp6Server ? { P, name: g.dhcp6Server } : null;
      // shortcut: relay chỉ kiểm tra có máy chủ mang địa chỉ đích, chưa ping thử IPv6 tới đó; đủ cho một chặng relay
      if (!srv && g.dhcp6Relay) for (const Q of Object.values(net.devices)) if (N.isL3(Q)) for (const h of Object.values(IFS(Q))) if ((h.ipv6 || []).some((a) => a.ip === g.dhcp6Relay) && h.dhcp6Server) srv = { P: Q, name: h.dhcp6Server };
      const pool = srv && srv.P.dhcp6?.pools[srv.name];
      if (!pool?.addr) continue;
      const base = A6.parse6(A6.net6(pool.addr.ip, pool.addr.prefix));
      base[7] = 0x10 + (pool.next = (pool.next || 0) + 1);
      const ip = A6.fmt6(base);
      f.ipv6 = [...(f.ipv6 || []).filter((a) => !a.dhcp), { ip, prefix: pool.addr.prefix, dhcp: true }];
      dh6(srv.P).bindings.push({ client: x.d.name, ip, pool: srv.name, via: g.dhcp6Relay ? 'relay' : 'link' });
      return [`(Lab: DHCPv6 SOLICIT → ADVERTISE → REQUEST → REPLY, nhận ${ip} từ ${srv.P.name}${g.dhcp6Relay ? ` qua relay ${P.name}` : ''})`];
    }
    return ['(Lab: không có máy chủ DHCPv6 trả lời: kiểm tra ipv6 dhcp server trên cổng hoặc ipv6 dhcp relay destination)'];
  });

  // ---------- NetFlow, SPAN, SLA, EEM ----------
  const flows = (d) => (d.flow ||= { records: {}, exporters: {}, monitors: {} });
  const FREC_MODE = [c('match <rest>', (x) => { flows(x.d).records[x.s.fl].match.push(x.a[0]); return R([]); }), c('collect <rest>', (x) => { flows(x.d).records[x.s.fl].collect.push(x.a[0]); return R([]); }), c('description <rest>', () => R([])), ...tail()];
  const FEXP_MODE = [
    c('destination <ip>', (x) => { flows(x.d).exporters[x.s.fl].dst = x.a[0]; return R([]); }),
    c('source <if>', (x) => { flows(x.d).exporters[x.s.fl].src = x.a[0]; return R([]); }),
    c('transport udp <num>', (x) => { flows(x.d).exporters[x.s.fl].port = x.a[0]; return R([]); }),
    c('export-protocol {netflow-v5|netflow-v9|ipfix}', (x) => { flows(x.d).exporters[x.s.fl].proto = x.a[0]; return R([]); }),
    c('description <rest>', () => R([])),
    ...tail(),
  ];
  const FMON_MODE = [
    c('record <word>', (x) => { if (!flows(x.d).records[x.a[0]] && !x.a[0].startsWith('netflow')) return R([`% Flow Monitor: Flow Record "${x.a[0]}" does not exist`]); flows(x.d).monitors[x.s.fl].record = x.a[0]; return R([]); }),
    c('exporter <word>', (x) => { if (!flows(x.d).exporters[x.a[0]]) return R([`% Flow Monitor: Flow Exporter "${x.a[0]}" does not exist`]); flows(x.d).monitors[x.s.fl].exporter = x.a[0]; return R([]); }),
    c('cache <rest>', () => R([])),
    c('description <rest>', () => R([])),
    ...tail(),
  ];
  const flowIf = (x, dir, v) => ifAll(x, (f) => { (f.flow ||= {})[dir] = v; });
  const mon = (x) => { const m = (x.d.monitor ||= {}); return (m[x.a[0]] ||= {}); };
  const portCheck = (x, n) => (x.d.type === 'switch' ? x.d.ports[n] : x.d.ifaces?.[n]) ? null : R(['% Invalid interface']);
  const monSrc = (x, dir) => { const e = portCheck(x, x.a[1]); if (e) return e; const s = mon(x); (s.srcPorts ||= []).push(x.a[1]); s.dir = dir; return R([]); };
  const ERSPAN_MODE = [
    c('description <rest>', () => R([])),
    c('source interface <if>', (x) => { const s = x.d.monitor[x.s.mon]; (s.srcPorts ||= []).push(x.a[0]); return R([]); }),
    c('source interface <if> {both|rx|tx}', (x) => { const s = x.d.monitor[x.s.mon]; (s.srcPorts ||= []).push(x.a[0]); s.dir = x.a[1]; return R([]); }),
    c('destination interface <if>', (x) => { x.d.monitor[x.s.mon].dst = x.a[0]; return R([]); }),
    c('destination', go('erspand')),
    c('source', go('erspand')),
    c('shutdown', (x) => { x.d.monitor[x.s.mon].off = true; return R([]); }),
    c('no shutdown', (x) => { x.d.monitor[x.s.mon].off = false; return R([]); }),
    ...tail(),
  ];
  const ERSPAND_MODE = [
    c('erspan-id <num>', (x) => { x.d.monitor[x.s.mon].erspanId = x.a[0]; return R([]); }),
    c('ip address <ip>', (x) => { const s = x.d.monitor[x.s.mon]; if (s.kind === 'erspan-source') s.erspanDst = x.a[0]; else s.erspanIp = x.a[0]; return R([]); }),
    c('origin ip address <ip>', (x) => { x.d.monitor[x.s.mon].origin = x.a[0]; return R([]); }),
    ...tail('erspan'),
  ];
  const sla = (d, id) => ((d.slas ||= {})[id] ||= { freq: 60 });
  const SLA_MODE = [
    c('icmp-echo <ip>', (x) => { sla(x.d, x.s.sla).target = x.a[0]; return R([]); }),
    c('icmp-echo <ip> source-interface <if>', (x) => { Object.assign(sla(x.d, x.s.sla), { target: x.a[0], srcIf: x.a[1] }); return R([]); }),
    c('udp-jitter <ip> <num>', (x) => { Object.assign(sla(x.d, x.s.sla), { type: 'udp-jitter', target: x.a[0], port: x.a[1], codec: null }); return R([]); }),
    c('udp-jitter <ip> <num> codec <word>', (x) => { Object.assign(sla(x.d, x.s.sla), { type: 'udp-jitter', target: x.a[0], port: x.a[1], codec: x.a[2] }); return R([]); }),
    c('icmp-jitter <ip>', (x) => { Object.assign(sla(x.d, x.s.sla), { type: 'icmp-jitter', target: x.a[0] }); return R([]); }),
    c('frequency <num>', (x) => { sla(x.d, x.s.sla).freq = x.a[0]; return R([]); }),
    c('threshold <num>', () => R([])),
    c('timeout <num>', () => R([])),
    ...tail(),
  ];
  const TRACK_MODE = [c('delay <rest>', () => R([])), ...tail()];
  // shortcut: telemetry chỉ kiểm tra cấu hình đăng ký và collector tới được, không phát dữ liệu thật; cần mô phỏng luồng dữ liệu thì thêm cache như NetFlow
  const mdt = (x) => x.d.mdt[x.s.mdt];
  const MDT_MODE = [
    c('stream yang-push', (x) => { mdt(x).stream = 'yang-push'; return R([]); }),
    c('encoding encode-kvgpb', (x) => { mdt(x).encoding = 'encode-kvgpb'; return R([]); }),
    c('filter xpath <rest>', (x) => { mdt(x).xpath = x.a[0]; return R([]); }),
    c('update-policy periodic <num>', (x) => { mdt(x).policy = `periodic ${x.a[0]}`; return R([]); }),
    c('update-policy on-change', (x) => { mdt(x).policy = 'on-change'; return R([]); }),
    c('source-address <ip>', (x) => { mdt(x).source = x.a[0]; return R([]); }),
    c('receiver ip address <ip> <num> protocol grpc-tcp', (x) => { mdt(x).receiver = { ip: x.a[0], port: x.a[1] }; return R([]); }),
    ...tail(),
  ];
  const mdtValid = (s) => !!(s.stream && s.encoding && s.xpath && s.policy && s.receiver);
  function showMdt(d, only) {
    return Object.entries(d.mdt || {}).filter(([id]) => only == null || +id === only).flatMap(([id, s]) => [
      `Subscription ID: ${id}`, `  Type: Configured`, `  State: ${mdtValid(s) ? 'Valid' : 'Invalid (thiếu stream, filter, encoding, update-policy hoặc receiver)'}`,
      `  Stream: ${s.stream || 'not set'}`, `  Filter: ${s.xpath || 'not set'}`, `  Update policy: ${s.policy || 'not set'}`, `  Encoding: ${s.encoding || 'not set'}`,
      ...(s.receiver ? [`  Receiver: ${s.receiver.ip}:${s.receiver.port} grpc-tcp, ${N.sendPacket(net, { src: d.id, dst: s.receiver.ip }).ok ? 'Connected' : 'Connecting'}`] : []), '',
    ]);
  }
  const eem = (x) => x.d.eem[x.s.eem];
  const unq = (s) => s.replace(/^"|"$/g, '');
  const EEM_MODE = [
    c('description <rest>', () => R([])),
    c('event none', (x) => { eem(x).event = { k: 'none' }; return R([]); }),
    c('event syslog pattern <rest>', (x) => { eem(x).event = { k: 'syslog', pat: unq(x.a[0]) }; return R([]); }),
    c('event track <num> state {up|down}', (x) => { eem(x).event = { k: 'track', id: x.a[0], state: x.a[1] }; return R([]); }),
    c('action <word> cli command <rest>', (x) => { eem(x).actions.push({ id: x.a[0], cli: unq(x.a[1]) }); return R([]); }),
    c('action <word> syslog msg <rest>', (x) => { eem(x).actions.push({ id: x.a[0], msg: unq(x.a[1]) }); return R([]); }),
    ...tail(),
  ];
  let eemBusy = false;
  function eemRun(d, name, a) {
    const out = [];
    const s = sess(d.id), keep = { ...s };
    eemBusy = true;
    Object.assign(s, { mode: 'priv', ifs: [], ask: null, pw: null, loggedOut: false });
    try {
      for (const ac of [...a.actions].sort((p, q) => parseFloat(p.id) - parseFloat(q.id))) {
        if (ac.msg != null) { const l = `%HA_EM-6-LOG: ${name}: ${ac.msg}`; N.logPush(net, d.id, l, false, true); out.push(l); }
        else if (!/^enable$/i.test(ac.cli)) execLine(d.id, ac.cli);
      }
    } finally { Object.keys(s).forEach((k) => delete s[k]); Object.assign(s, keep); eemBusy = false; }
    a.runs = (a.runs || 0) + 1;
    return out;
  }
  /** Sau mỗi lệnh: applet syslog xét dòng log mới, applet track xét object đổi trạng thái. */
  function eemTick(cur) {
    if (eemBusy) return [];
    const out = [];
    for (const d of Object.values(net.devices)) {
      if (!d.eem) continue;
      const logs = d.logBuf || [], fresh = logs.slice(d.eemSeen ?? logs.length);
      d.eemSeen = logs.length;
      for (const [name, a] of Object.entries(d.eem)) {
        const ev = a.event;
        let fire = false;
        if (ev?.k === 'syslog') { let re; try { re = new RegExp(ev.pat); } catch { re = null; } fire = !!re && fresh.some((l) => re.test(l) && !l.includes('%HA_EM')); }
        if (ev?.k === 'track') { const st = N.trackUp(net, d, ev.id) ? 'up' : 'down'; fire = a.lastSt != null && a.lastSt !== st && st === ev.state; a.lastSt = st; }
        if (fire) { const r = eemRun(d, name, a); if (d.id === cur) out.push(...r); d.eemSeen = (d.logBuf || []).length; }
      }
    }
    return out;
  }

  // ---------- cấu hình: bổ sung vào bảng có sẵn ----------
  const commAdd = (x, name, action, rest, expanded) => {
    const vals = words(rest);
    if (expanded ? !iosRegex(vals.join(' ')) : !vals.every((v) => /^\d+:\d+$|^(no-export|no-advertise|local-AS|internet)$/.test(v))) return R(["% Invalid input detected at '^' marker."]);
    ((x.d.commLists ||= {})[name] ||= []).push({ action, vals, expanded });
    return R([]);
  };
  const CFG_X = [
    c('ip vrf <word>', go('vrf', (x) => { vrfSet(x, x.a[0]); x.s.vrfName = x.a[0]; })),
    c('no ip vrf <word>', (x) => { if (x.d.vrfs) delete x.d.vrfs[x.a[0]]; return R([]); }),
    c('vrf definition <word>', go('vrf', (x) => { vrfSet(x, x.a[0]); x.s.vrfName = x.a[0]; })),
    c('no vrf definition <word>', (x) => { if (x.d.vrfs) delete x.d.vrfs[x.a[0]]; return R([]); }),
    c('ip route vrf <word> <ip> <mask> <ip>', (x) => vrfRoute(x, x.a[0], x.a[1], x.a[2], x.a[3])),
    c('ip route vrf <word> <ip> <mask> <if>', (x) => vrfRoute(x, x.a[0], x.a[1], x.a[2], null, x.a[3])),
    c('ip route <ip> <mask> <ip> track <num>', (x) => staticX(x, x.a[0], x.a[1], { nh: x.a[2], track: x.a[3] })),
    c('ip route <ip> <mask> <ip> <num> track <num>', (x) => staticX(x, x.a[0], x.a[1], { nh: x.a[2], ad: x.a[3], track: x.a[4] })),
    c('ip route <ip> <mask> null0', (x) => staticX(x, x.a[0], x.a[1], { discard: true })),
    c('ip route <ip> <mask> null 0', (x) => staticX(x, x.a[0], x.a[1], { discard: true })),
    c('ip prefix-list <word> <rest>', (x) => plAdd(x, x.a[0], x.a[1])),
    c('no ip prefix-list <word>', (x) => { if (x.d.prefixLists) delete x.d.prefixLists[x.a[0]]; return R([]); }),
    c('route-map <word>', (x) => rmOpen(x, x.a[0], 'permit', 10)),
    c('route-map <word> {permit|deny}', (x) => rmOpen(x, x.a[0], x.a[1], 10)),
    c('route-map <word> {permit|deny} <num>', (x) => rmOpen(x, x.a[0], x.a[1], x.a[2])),
    c('no route-map <word>', (x) => { if (x.d.routeMaps) delete x.d.routeMaps[x.a[0]]; return R([]); }),
    c('ip as-path access-list <word> {permit|deny} <word>', (x) => { if (!iosRegex(x.a[2])) return R(["% Invalid input detected at '^' marker."]); ((x.d.asPathAcls ||= {})[x.a[0]] ||= []).push({ action: x.a[1], re: x.a[2] }); return R([]); }),
    c('ip bgp-community new-format', (x) => { x.d.commNew = true; return R([]); }),
    c('no ip bgp-community new-format', (x) => { x.d.commNew = false; return R([]); }),
    c('ip community-list {standard|expanded} <word> {permit|deny} <rest>', (x) => commAdd(x, x.a[1], x.a[2], x.a[3], x.a[0] === 'expanded')),
    c('ip community-list <num> {permit|deny} <rest>', (x) => commAdd(x, String(x.a[0]), x.a[1], x.a[2], x.a[0] > 99)),
    c('no ip community-list {standard|expanded} <word>', (x) => { delete x.d.commLists?.[x.a[1]]; return R([]); }),
    c('key chain <word>', go('keychain', (x) => { ((x.d.keyChains ||= {})[x.a[0]] ||= {}); x.s.kc = x.a[0]; })),
    c('time-range <word>', go('trange', (x) => { ((x.d.timeRanges ||= {})[x.a[0]] ||= []); x.s.tr = x.a[0]; })),
    c('class-map <word>', go('qcmap', (x) => { x.s.qc = (qos(x.d).classes[x.a[0]] ||= { all: true, matches: [] }); })),
    c('class-map match-all <word>', go('qcmap', (x) => { x.s.qc = (qos(x.d).classes[x.a[0]] ||= { all: true, matches: [] }); })),
    c('class-map match-any <word>', go('qcmap', (x) => { x.s.qc = (qos(x.d).classes[x.a[0]] ||= { all: false, matches: [] }); })),
    c('policy-map <word>', go('qpmap', (x) => { qos(x.d).policies[x.a[0]] ||= []; x.s.qp = x.a[0]; })),
    c('control-plane', go('cpp')),
    c('ipv6 dhcp pool <word>', go('dhcp6', (x) => { dh6(x.d).pools[x.a[0]] ||= {}; x.s.dh6 = x.a[0]; })),
    c('flow record <word>', go('frec', (x) => { flows(x.d).records[x.a[0]] ||= { match: [], collect: [] }; x.s.fl = x.a[0]; })),
    c('flow exporter <word>', go('fexp', (x) => { flows(x.d).exporters[x.a[0]] ||= { port: 9995 }; x.s.fl = x.a[0]; })),
    c('flow monitor <word>', go('fmon', (x) => { flows(x.d).monitors[x.a[0]] ||= {}; x.s.fl = x.a[0]; })),
    c('ip flow-export destination <ip> <num>', (x) => { flows(x.d).legacy = { ...flows(x.d).legacy, dst: x.a[0], port: x.a[1] }; return R([]); }),
    c('ip flow-export version <num>', (x) => { flows(x.d).legacy = { ...flows(x.d).legacy, version: x.a[0] }; return R([]); }),
    c('ip flow-export source <if>', (x) => { flows(x.d).legacy = { ...flows(x.d).legacy, src: x.a[0] }; return R([]); }),
    c('monitor session <num> source interface <if>', (x) => monSrc(x, 'both')),
    c('monitor session <num> source interface <if> {both|rx|tx}', (x) => monSrc(x, x.a[2])),
    c('monitor session <num> source vlan <num>', (x) => { (mon(x).srcVlans ||= []).push(x.a[1]); return R([]); }),
    c('monitor session <num> source remote vlan <num>', (x) => { mon(x).srcRemote = x.a[1]; return R([]); }),
    c('monitor session <num> destination interface <if>', (x) => { const e = portCheck(x, x.a[1]); if (e) return e; mon(x).dst = x.a[1]; return R([]); }),
    c('monitor session <num> destination remote vlan <num>', (x) => { mon(x).dstRemote = x.a[1]; return R([]); }),
    c('no monitor session <num>', (x) => { if (x.d.monitor) delete x.d.monitor[x.a[0]]; return R([]); }),
    c('monitor session <num> type {erspan-source|erspan-destination}', (x) => { mon(x).kind = x.a[1]; x.s.mon = x.a[0]; x.s.mode = 'erspan'; return R([]); }),
    c('ip sla <num>', go('sla', (x) => { sla(x.d, x.a[0]); x.s.sla = x.a[0]; })),
    c('no ip sla <num>', (x) => { if (x.d.slas) delete x.d.slas[x.a[0]]; return R([]); }),
    c('ip sla responder', (x) => { x.d.slaResponder = true; return R([]); }),
    c('no ip sla responder', (x) => { x.d.slaResponder = false; return R([]); }),
    c('telemetry ietf subscription <num>', go('mdt', (x) => { ((x.d.mdt ||= {})[x.a[0]] ||= {}); x.s.mdt = x.a[0]; })),
    c('no telemetry ietf subscription <num>', (x) => { if (x.d.mdt) delete x.d.mdt[x.a[0]]; return R([]); }),
    c('ip sla schedule <num> <rest>', (x) => { if (!x.d.slas?.[x.a[0]]) return R([`% Lab: chưa có ip sla ${x.a[0]}`]); x.d.slas[x.a[0]].scheduled = /start-time now/.test(x.a[1]) || /start-time/.test(x.a[1]); return R([]); }),
    c('track <num> ip sla <num>', go('track', (x) => { (x.d.tracks ||= {})[x.a[0]] = { sla: x.a[1] }; })),
    c('track <num> ip sla <num> {reachability|state}', go('track', (x) => { (x.d.tracks ||= {})[x.a[0]] = { sla: x.a[1], kind: x.a[2] }; })),
    c('track <num> interface <if> line-protocol', go('track', (x) => { (x.d.tracks ||= {})[x.a[0]] = { ifn: x.a[1] }; })),
    c('no track <num>', (x) => { if (x.d.tracks) delete x.d.tracks[x.a[0]]; return R([]); }),
    c('event manager applet <word>', go('eem', (x) => { ((x.d.eem ||= {})[x.a[0]] ||= { actions: [] }); x.s.eem = x.a[0]; x.d.eemSeen = (x.d.logBuf || []).length; })),
    c('no event manager applet <word>', (x) => { if (x.d.eem) delete x.d.eem[x.a[0]]; return R([]); }),
    c('netconf-yang', (x) => { x.d.netconf = true; return R([]); }),
    c('no netconf-yang', (x) => { x.d.netconf = false; return R([]); }),
    c('restconf', (x) => { x.d.restconf = true; return R([]); }),
    c('no restconf', (x) => { x.d.restconf = false; return R([]); }),
    c('crypto ipsec profile <word>', go('ipsecp', (x) => { ((x.d.crypto.profiles ||= {})[x.a[0]] ||= {}); x.s.ipp = x.a[0]; })),
    // shortcut: authorization, accounting lưu cấu hình và hiện trong show run, chưa chặn lệnh theo privilege; cần chặn thật thì kiểm tra ở dispatch
    c('aaa authorization {exec|network|config-commands} <word> <rest>', (x) => aaaAdd(x, 'authz', x.a[0], x.a[1], x.a[2])),
    c('aaa authorization commands <num> <word> <rest>', (x) => aaaAdd(x, 'authz', `commands ${x.a[0]}`, x.a[1], x.a[2])),
    c('aaa accounting {exec|network|connection} <word> <rest>', (x) => aaaAdd(x, 'acct', x.a[0], x.a[1], x.a[2])),
    c('aaa accounting commands <num> <word> <rest>', (x) => aaaAdd(x, 'acct', `commands ${x.a[0]}`, x.a[1], x.a[2])),
    c('privilege exec level <num> <rest>', (x) => { (x.d.privCmds ||= []).push({ level: x.a[0], cmd: x.a[1] }); return R([]); }),
  ];
  function aaaAdd(x, kind, what, list, methods) {
    if (!x.d.aaa?.newModel) return R(['% AAA chưa bật — gõ "aaa new-model" trước']);
    ((x.d.aaa[kind] ||= {}))[what] = { list, methods };
    return R([]);
  }
  const VRF_MODE = [
    c('rd <word>', (x) => { x.d.vrfs[x.s.vrfName].rd = x.a[0]; return R([]); }),
    c('description <rest>', () => R([])),
    c('address-family ipv4', () => R([])),
    c('address-family ipv6', () => R([])),
    c('exit-address-family', () => R([])),
    c('route-target <rest>', () => R([])),
    ...tail(),
  ];
  const KEYCHAIN_MODE = [c('key <num>', go('key', (x) => { x.d.keyChains[x.s.kc][x.a[0]] ||= {}; x.s.kid = x.a[0]; })), ...tail()];
  const KEY_MODE = [c('key-string <word>', (x) => { x.d.keyChains[x.s.kc][x.s.kid].str = x.a[0]; return R([]); }), c('cryptographic-algorithm <word>', () => R([])), c('key <num>', go('key', (x) => { x.d.keyChains[x.s.kc][x.a[0]] ||= {}; x.s.kid = x.a[0]; })), ...tail('keychain')];
  const TR_MODE = [
    c('periodic <word> <word> to <word>', (x) => { x.d.timeRanges[x.s.tr].push({ days: [x.a[0].toLowerCase()], from: hm(x.a[1]), to: hm(x.a[2]), text: `periodic ${x.a[0]} ${x.a[1]} to ${x.a[2]}` }); return R([]); }),
    ...tail(),
  ];
  const IPSECP_MODE = [c('set transform-set <word>', (x) => { x.d.crypto.profiles[x.s.ipp].tset = x.a[0]; return R([]); }), ...tail()];

  const nhrp = (f) => (f.nhrp ||= {});
  const IF_X = [
    c('ip vrf forwarding <word>', (x) => ifVrf(x, x.a[0])),
    c('vrf forwarding <word>', (x) => ifVrf(x, x.a[0])),
    c('no ip vrf forwarding', (x) => ifVrf(x, null)),
    c('no vrf forwarding', (x) => ifVrf(x, null)),
    c('ip policy route-map <word>', (x) => ifAll(x, (f) => { f.policy = x.a[0]; })),
    c('no ip policy route-map', (x) => ifAll(x, (f) => { f.policy = null; })),
    c('no ip policy route-map <word>', (x) => ifAll(x, (f) => { f.policy = null; })),
    c('delay <num>', (x) => ifAll(x, (f) => { f.dly = x.a[0]; })),
    c('no delay', (x) => ifAll(x, (f) => { f.dly = null; })),
    c('ip ospf authentication', (x) => ifAll(x, (f) => { f.ospfAuth = 'plain'; })),
    c('ip ospf authentication message-digest', (x) => ifAll(x, (f) => { f.ospfAuth = 'md5'; })),
    c('ip ospf authentication null', (x) => ifAll(x, (f) => { f.ospfAuth = 'null'; })),
    c('ip ospf authentication key-chain <word>', (x) => ifAll(x, (f) => { f.ospfAuth = 'chain'; f.ospfChain = x.a[0]; })),
    c('ip ospf mtu-ignore', (x) => ifAll(x, (f) => { f.ospfMtuIgnore = true; })),
    c('no ip ospf mtu-ignore', (x) => ifAll(x, (f) => { f.ospfMtuIgnore = false; })),
    c('ip ospf network point-to-multipoint non-broadcast', (x) => ifAll(x, (f) => { f.ospfNet = 'p2mpnb'; })),
    c('ospfv3 authentication <rest>', (x) => ifAll(x, (f) => { f.ospf6Auth = x.a[0]; })),
    c('no ospfv3 authentication', (x) => ifAll(x, (f) => { f.ospf6Auth = null; })),
    c('ipv6 ospf authentication <rest>', (x) => ifAll(x, (f) => { f.ospf6Auth = x.a[0]; })),
    c('no ipv6 ospf authentication', (x) => ifAll(x, (f) => { f.ospf6Auth = null; })),
    c('no ip ospf authentication', (x) => ifAll(x, (f) => { f.ospfAuth = null; })),
    c('ip ospf authentication-key <word>', (x) => ifAll(x, (f) => { f.ospfKey = x.a[0]; })),
    c('ip ospf message-digest-key <num> md5 <word>', (x) => ifAll(x, (f) => { f.ospfMd5 = { id: x.a[0], key: x.a[1] }; })),
    c('no ip ospf message-digest-key <num>', (x) => ifAll(x, (f) => { f.ospfMd5 = null; })),
    c('ip ospf network point-to-multipoint', (x) => ifAll(x, (f) => { f.ospfNet = 'p2mp'; })),
    c('ip ospf network non-broadcast', (x) => ifAll(x, (f) => { f.ospfNet = 'nbma'; })),
    c('ip ospf bfd', () => R([])),
    c('ipv6 eigrp <num>', (x) => { const e = e6Open(x, x.a[0]); if (e) return e; return ifAll(x, (f) => { f.eigrp6 = x.a[0]; }); }),
    c('no ipv6 eigrp <num>', (x) => ifAll(x, (f) => { f.eigrp6 = null; })),
    c('ip authentication mode eigrp <num> md5', (x) => ifAll(x, (f) => { Object.assign((f.eigrpAuth ||= {}), { mode: 'md5', as: x.a[0] }); })),
    c('no ip authentication mode eigrp <num> md5', (x) => ifAll(x, (f) => { if (f.eigrpAuth) f.eigrpAuth.mode = null; })),
    c('ip authentication key-chain eigrp <num> <word>', (x) => ifAll(x, (f) => { (f.eigrpAuth ||= {}).chain = x.a[1]; })),
    c('ip summary-address eigrp <num> <ip> <mask>', (x) => ifAll(x, (f) => { const prefix = maskToPrefix(x.a[2]); f.eigrpSumAs = x.a[0]; (f.eigrpSummaries ||= []).push({ net: netOf(x.a[1], prefix), prefix }); })),
    c('no ip summary-address eigrp <num> <ip> <mask>', (x) => ifAll(x, (f) => { f.eigrpSummaries = (f.eigrpSummaries || []).filter((g) => g.net !== x.a[1]); })),
    c('no ip split-horizon eigrp <num>', (x) => ifAll(x, (f) => { f.eigrpNoSH = true; f.eigrpShAs = x.a[0]; })),
    c('ip split-horizon eigrp <num>', (x) => ifAll(x, (f) => { f.eigrpNoSH = false; })),
    c('no ip next-hop-self eigrp <num>', (x) => ifAll(x, (f) => { f.eigrpNoNhs = true; f.eigrpShAs = x.a[0]; })),
    c('ip next-hop-self eigrp <num>', (x) => ifAll(x, (f) => { f.eigrpNoNhs = false; })),
    c('service-policy {input|output} <word>', (x) => ifAll(x, (f) => { f[x.a[0] === 'input' ? 'qosIn' : 'qosOut'] = x.a[1]; })),
    c('no service-policy {input|output} <word>', (x) => ifAll(x, (f) => { f[x.a[0] === 'input' ? 'qosIn' : 'qosOut'] = null; })),
    c('ip verify unicast source reachable-via {rx|any}', (x) => ifAll(x, (f) => { f.urpf = { mode: x.a[0] }; })),
    c('ip verify unicast source reachable-via {rx|any} allow-default', (x) => ifAll(x, (f) => { f.urpf = { mode: x.a[0], allowDefault: true }; })),
    c('ip verify unicast reverse-path', (x) => ifAll(x, (f) => { f.urpf = { mode: 'rx' }; })),
    c('no ip verify unicast', (x) => ifAll(x, (f) => { f.urpf = null; })),
    c('no ip verify unicast source reachable-via {rx|any}', (x) => ifAll(x, (f) => { f.urpf = null; })),
    c('ipv6 dhcp server <word>', (x) => ifAll(x, (f) => { f.dhcp6Server = x.a[0]; })),
    c('no ipv6 dhcp server', (x) => ifAll(x, (f) => { f.dhcp6Server = null; })),
    c('ipv6 dhcp relay destination <ip6>', (x) => ifAll(x, (f) => { f.dhcp6Relay = x.a[0]; })),
    c('ipv6 address dhcp', (x) => dhcp6Client(x)),
    c('ip flow ingress', (x) => flowIf(x, 'in', 'legacy')),
    c('ip flow egress', (x) => flowIf(x, 'out', 'legacy')),
    c('no ip flow {ingress|egress}', (x) => flowIf(x, x.a[0] === 'ingress' ? 'in' : 'out', null)),
    c('ip flow monitor <word> input', (x) => { if (!x.d.flow?.monitors?.[x.a[0]]) return R([`% Flow Monitor: Flow Monitor "${x.a[0]}" does not exist`]); return flowIf(x, 'in', x.a[0]); }),
    c('ip flow monitor <word> output', (x) => { if (!x.d.flow?.monitors?.[x.a[0]]) return R([`% Flow Monitor: Flow Monitor "${x.a[0]}" does not exist`]); return flowIf(x, 'out', x.a[0]); }),
    c('no ip flow monitor <word> {input|output}', (x) => flowIf(x, x.a[1] === 'input' ? 'in' : 'out', null)),
    c('bfd interval <num> min_rx <num> multiplier <num>', (x) => ifAll(x, (f) => { f.bfd = { tx: x.a[0], rx: x.a[1], mult: x.a[2] }; })),
    c('no bfd interval', (x) => ifAll(x, (f) => { f.bfd = null; })),
    c('standby <num> track <num> decrement <num>', (x) => ifAll(x, (f) => { const s = ((f.standby ||= {})[x.a[0]] ||= {}); s.track = [...(s.track || []).filter((t) => t.obj !== x.a[1]), { obj: x.a[1], dec: x.a[2] }]; })),
    c('tunnel mode gre multipoint', (x) => ifAll(x, (f) => { f.tunMode = 'mgre'; f.tunDst = null; })),
    c('tunnel key <num>', (x) => ifAll(x, (f) => { f.tunKey = x.a[0]; })),
    c('tunnel protection ipsec profile <word>', (x) => ifAll(x, (f) => { f.tunProtect = x.a[0]; })),
    c('no tunnel protection ipsec profile <word>', (x) => ifAll(x, (f) => { f.tunProtect = null; })),
    c('ip nhrp network-id <num>', (x) => ifAll(x, (f) => { nhrp(f).id = x.a[0]; })),
    c('ip nhrp nhs <ip>', (x) => ifAll(x, (f) => { const h = nhrp(f); h.nhs = [...new Set([...(h.nhs || []), x.a[0]])]; })),
    c('ip nhrp map multicast dynamic', (x) => ifAll(x, (f) => { nhrp(f).mcastDyn = true; })),
    c('ip nhrp map multicast <ip>', (x) => ifAll(x, (f) => { const h = nhrp(f); h.mcast = [...new Set([...(h.mcast || []), x.a[0]])]; })),
    c('ip nhrp map <ip> <ip>', (x) => ifAll(x, (f) => { (nhrp(f).map ||= {})[x.a[0]] = x.a[1]; })),
    c('ip nhrp redirect', (x) => ifAll(x, (f) => { nhrp(f).redirect = true; })),
    c('no ip nhrp redirect', (x) => ifAll(x, (f) => { nhrp(f).redirect = false; })),
    c('ip nhrp shortcut', (x) => ifAll(x, (f) => { nhrp(f).shortcut = true; })),
    c('no ip nhrp shortcut', (x) => ifAll(x, (f) => { nhrp(f).shortcut = false; })),
    c('ip nhrp authentication <word>', (x) => ifAll(x, (f) => { nhrp(f).auth = x.a[0]; })),
    c('ip nhrp holdtime <num>', () => R([])),
    c('ip nhrp registration <rest>', () => R([])),
    c('ip mtu <num>', (x) => ifAll(x, (f) => { f.ipMtu = x.a[0]; })),
    c('no ip mtu', (x) => ifAll(x, (f) => { f.ipMtu = null; })),
    c('ip tcp adjust-mss <num>', () => R([])),
  ];
  const LINE_X = [
    c('authorization {exec|commands} <rest>', (x) => { (x.d.lines.vty.authz ||= {})[x.a[0]] = x.a[1]; return R([]); }),
    c('accounting {exec|commands} <rest>', (x) => { (x.d.lines.vty.acct ||= {})[x.a[0]] = x.a[1]; return R([]); }),
  ];

  // ---------- show ----------
  function showVrf(d) {
    const L = ['  Name                             Default RD            Interfaces'];
    for (const [n, v] of Object.entries(d.vrfs || {})) {
      const ifs = Object.entries(IFS(d)).filter(([, f]) => f.vrf === n).map(([i]) => shortIf(i));
      L.push(`  ${pad(n, 33)}${pad(v.rd || '<not set>', 22)}${ifs[0] || ''}`, ...ifs.slice(1).map((i) => `${' '.repeat(57)}${i}`));
    }
    return L;
  }
  function showPl(d, only) {
    return Object.entries(d.prefixLists || {}).filter(([n]) => !only || n === only).flatMap(([n, l]) => [`ip prefix-list ${n}: ${l.length} entries`, ...l.map((e) => `   seq ${e.seq} ${e.action} ${e.net}/${e.prefix}${e.ge != null ? ` ge ${e.ge}` : ''}${e.le != null ? ` le ${e.le}` : ''}`)]);
  }
  const commSet = (v) => `${v.vals.join(' ') || 'none'}${v.additive ? ' additive' : ''}`;
  function showRm(d, only) {
    const L = [];
    for (const [n, list] of Object.entries(d.routeMaps || {})) {
      if (only && n !== only) continue;
      for (const e of list) {
        L.push(`route-map ${n}, ${e.action}, sequence ${e.seq}`, '  Match clauses:', ...e.matches.map((m) => `    ${{ pl: 'ip address prefix-lists:', acl: 'ip address (access-lists):', tag: 'tag', metric: 'metric', aspath: 'as-path (as-path filter):', comm: 'community (community-list filter):' }[m.k]} ${m.vals.join(' ')}`), '  Set clauses:', ...Object.entries(e.sets).map(([k, v]) => `    ${{ metric: 'metric', tag: 'tag', localPref: 'local-preference', weight: 'weight', prepend: 'as-path prepend', metricType: 'metric-type', nextHop: 'ip next-hop', community: 'community' }[k]} ${k === 'community' ? commSet(v) : Array.isArray(v) ? v.join(' ') : v}`),`  Policy routing matches: ${e.pkts || 0} packets, ${(e.pkts || 0) * 100} bytes`);
      }
    }
    return L;
  }
  function showTopo(d, all) {
    if (!d.eigrp) return ['% EIGRP not active'];
    const ctx = ctxOf(), E = N.eigrpAll(ctx);
    const L = [`EIGRP-IPv4 Topology Table for AS(${d.eigrp.as})/ID(${d.eigrp.rid || E.en[d.id]?.[0]?.ip || '0.0.0.0'})`, 'Codes: P - Passive, A - Active, U - Update, Q - Query, R - Reply,', '       r - reply Status, s - sia Status', ''];
    for (const e of E.en[d.id] || []) L.push(`P ${netOf(e.ip, e.prefix)}/${e.prefix}, 1 successors, FD is ${256 * (Math.floor(1e7 / e.bw) + e.dly)}`, `        via Connected, ${longIf(e.ifn)}`);
    for (const rt of E.routes[d.id] || []) {
      if (rt.discard) { L.push(`P ${rt.net}/${rt.prefix}, 1 successors, FD is 0`, '        via Summary, Null0'); continue; }
      const ps = N.eigrpPaths(ctx, d, rt), fd = ps[0]?.fd ?? rt.metric, succ = ps.filter((p) => p.succ);
      L.push(`P ${rt.net}/${rt.prefix}, ${succ.length || 1} successors, FD is ${fd}`);
      for (const p of ps) if (all || p.succ || p.fs) L.push(`        via ${p.nh} (${p.m}/${p.rd}), ${longIf(p.outIf)}${p.fs ? '   <-- feasible successor' : ''}`);
    }
    return L;
  }
  function showBgpNbr(d, ip) {
    if (!d.bgp) return ['% BGP not active'];
    const b = N.bgpAll(ctxOf());
    return (b.sessions[d.id] || []).filter((s) => !ip || s.ip === ip).flatMap((s) => [
      `BGP neighbor is ${s.ip},  remote AS ${s.remoteAs}, ${s.ebgp ? 'external' : 'internal'} link`,
      ...(s.cfg.group ? [`  Member of peer-group ${s.cfg.group} for session parameters`] : []),
      `  BGP version 4, remote router ID ${s.peer ? b.rid[s.peer] : '0.0.0.0'}`,
      `  BGP state = ${s.state}`,
      `  Last read 00:00:10, hold time is ${(s.cfg.timers || d.bgp.timers || [60, 180])[1]}, keepalive interval is ${(s.cfg.timers || d.bgp.timers || [60, 180])[0]} seconds`,
      ...(s.cfg.rrClient ? ['  Route-Reflector Client'] : []),
      ...(s.cfg.password ? ['  Password configured (MD5)'] : []),
      ...(s.cfg.multihop ? [`  External BGP neighbor may be up to ${s.cfg.multihop} hops away.`] : []),
      ...(s.cfg.rmIn ? [`  Route map for incoming advertisements is ${s.cfg.rmIn}`] : []),
      ...(s.cfg.rmOut ? [`  Route map for outgoing advertisements is ${s.cfg.rmOut}`] : []),
      ...(s.cfg.plIn ? [`  Incoming update prefix filter list is ${s.cfg.plIn}`] : []),
      ...(s.cfg.plOut ? [`  Outgoing update prefix filter list is ${s.cfg.plOut}`] : []),
      '',
    ]);
  }
  const bgpLine = (p, k, best) => `${best ? '*>' : '* '}${p.ibgp ? 'i' : ' '}${pad(k, 17)}${pad(p.nh, 20)}${String(p.med || 0).padStart(6)} ${String(p.ibgp ? p.lp ?? 100 : p.lp != null && p.lp !== 100 ? p.lp : '').padStart(6)} ${String(p.weight ?? (p.local ? 32768 : 0)).padStart(6)} ${[...p.asPath, p.origin || 'i'].join(' ')}`;
  const BGP_HEAD = '   Network          Next Hop            Metric LocPrf Weight Path';
  /** Bảng BGP chỉ giữ các đường thoả `keep` (regexp, filter-list, prefix-list, route-map, community). */
  function bgpFiltered(d, keep) {
    if (!d.bgp) return ['% BGP not active'];
    const b = N.bgpAll(ctxOf()), L = [BGP_HEAD];
    for (const [k, l] of Object.entries(b.tables[d.id] || {})) for (const p of l) if (keep(p)) L.push(bgpLine(p, k, b.best[d.id][k] === p));
    return L;
  }
  const commText = (d, c0) => c0.map((v) => (d.commNew || !/^\d+:\d+$/.test(v) ? v : String(+v.split(':')[0] * 65536 + +v.split(':')[1]))).join(' ');
  /** "show ip bgp <prefix>": mọi đường của prefix, đường nào best, next-hop có tới được không. */
  function showBgpEntry(d, ip, prefix) {
    if (!d.bgp) return ['% BGP not active'];
    const b = N.bgpAll(ctxOf()), tbl = b.tables[d.id] || {};
    const k = prefix != null ? `${netOf(ip, prefix)}/${prefix}` : Object.keys(tbl).filter((o) => { const [n, p] = o.split('/'); return netOf(ip, +p) === n; }).sort((x, y) => +y.split('/')[1] - +x.split('/')[1])[0];
    const list = tbl[k];
    if (!list?.length) return ['% Network not in table'];
    const best = b.best[d.id][k], ix = list.indexOf(best);
    const L = [`BGP routing table entry for ${k}, version 7`, `Paths: (${list.length} available, ${ix >= 0 ? `best #${ix + 1}` : 'no best path'}, table ${d.bgp.vrf || 'default'})`];
    for (const p of list) {
      const ok = b.nhOk(d.id, p);
      L.push(`  ${p.asPath.length ? p.asPath.join(' ') : 'Local'}`);
      L.push(`    ${p.nh}${ok ? '' : ' (inaccessible)'} from ${p.fromIp || '0.0.0.0'} (${p.fromRid || b.rid[d.id]})`);
      L.push(`      Origin ${{ i: 'IGP', e: 'EGP', '?': 'incomplete' }[p.origin || 'i']}, metric ${p.med || 0}, localpref ${p.lp ?? 100}, weight ${p.weight ?? (p.local ? 32768 : 0)}${ok ? ', valid' : ''}, ${p.local ? 'sourced, local' : p.ebgp ? 'external' : 'internal'}${p === best ? ', best' : ''}`);
      if (p.comm?.length) L.push(`      Community: ${commText(d, p.comm)}`);
      if (p.cluster) L.push(`      Originator: ${p.originator}, Cluster list: ${p.cluster.join(' ')}`);
    }
    return L;
  }
  /** RIB-failure: route BGP best nhưng RIB đã dùng nguồn khác có AD thấp hơn. */
  function showRibFail(d) {
    if (!d.bgp) return ['% BGP not active'];
    const ctx = ctxOf(), b = N.bgpAll(ctx), rib = N.routeTable(ctx, d.id, d.bgp.vrf || null);
    const L = ['Network            Next Hop                      RIB-failure   RIB-NH Matches'];
    for (const [k, p] of Object.entries(b.best[d.id] || {})) {
      if (p.local) continue;
      const r = rib.find((o) => `${o.net}/${o.prefix}` === k);
      if (r && r.code !== 'B') L.push(`${pad(k, 19)}${pad(p.nh, 30)}Higher admin distance  n/a`);
    }
    return L;
  }
  const lsaAge = 300, lsaSeq = '0x80000002';
  const lsaCk = (s) => `0x${[...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 0xffffff, 7).toString(16).toUpperCase().padStart(6, '0')}`;
  const lsaRow = (l, extra = '') => `${pad(l.id, 16)}${pad(l.adv, 16)}${pad(lsaAge, 12)}${pad(lsaSeq, 11)}${pad(lsaCk(l.id + l.adv), 9)}${extra}`;
  const LSA_KIND = { router: 'Router Links', network: 'Network Links', summary: 'Summary Links(Network)', asbr: 'Summary Links(AS Boundary Router)', nssa: 'AS External Link', external: 'AS External Link' };
  function lsaDetail(l, kind) {
    const L = [`  LS age: ${lsaAge}`, '  Options: (No TOS-capability, DC)', `  LS Type: ${LSA_KIND[kind]}`, `  Link State ID: ${l.id}`, `  Advertising Router: ${l.adv}`, `  LS Seq Number: ${lsaSeq.slice(2)}`, `  Checksum: ${lsaCk(l.id + l.adv)}`];
    if (kind === 'router') {
      L.push(`  Number of Links: ${l.links.length}`, '');
      for (const k of l.links) L.push(`    Link connected to: ${{ stub: 'a Stub Network', transit: 'a Transit Network', p2p: 'another Router (point-to-point)' }[k.kind]}`, `     (Link ID) ${{ stub: 'Network/subnet number', transit: 'Designated Router address', p2p: 'Neighboring Router ID' }[k.kind]}: ${k.id}`, `     (Link Data) ${k.kind === 'stub' ? 'Network Mask' : 'Router Interface address'}: ${k.data}`, `      TOS 0 Metrics: ${k.metric}`, '');
    } else if (kind === 'network') {
      L.push(`  Network Mask: /${l.prefix}`, ...l.attached.map((a) => `        Attached Router: ${a}`), '');
    } else {
      if (l.prefix != null) L.push(`  Network Mask: /${l.prefix}`);
      if (l.etype) L.push(`        Metric Type: ${l.etype} (${l.etype === 1 ? 'Comparable directly to link state metric' : 'Larger than any link state path'})`);
      L.push(`        TOS: 0  Metric: ${l.metric}`, ...(l.etype ? [`        External Route Tag: ${l.tag}`] : []), '');
    }
    return L;
  }
  function showLsdb(d, only) {
    if (!d.ospf) return ['% OSPF not active'];
    const db = N.ospfLsdb(ctxOf(), d.id), L = ['', `            OSPF Router with ID (${db.rid}) (Process ID ${d.ospf.pid})`];
    const part = (kind, title, list, rowHead, row) => {
      if (only && only !== kind) return;
      if (!list.length) return;
      L.push('', `                ${title}`, '');
      if (only) { for (const l of list) L.push(...lsaDetail(l, kind)); return; }
      L.push(rowHead);
      for (const l of list) L.push(row(l));
    };
    const HEAD = 'Link ID         ADV Router      Age         Seq#       Checksum';
    for (const a of db.areas) {
      const nm = a.area;
      part('router', `Router Link States (Area ${nm})`, a.router, `${HEAD} Link count`, (l) => lsaRow(l, l.links.length));
      part('network', `Net Link States (Area ${nm})`, a.network, HEAD, (l) => lsaRow(l));
      part('summary', `Summary Net Link States (Area ${nm})`, a.summary, HEAD, (l) => lsaRow(l));
      part('asbr', `Summary ASB Link States (Area ${nm})`, a.asbr, HEAD, (l) => lsaRow(l));
      part('nssa', `Type-7 AS External Link States (Area ${nm})`, a.nssa, `${HEAD} Tag`, (l) => lsaRow(l, l.tag));
    }
    part('external', 'Type-5 AS External Link States', db.external, `${HEAD} Tag`, (l) => lsaRow(l, l.tag));
    return L;
  }
  /** shortcut: LSDB OSPFv3 suy từ láng giềng và prefix hiện có, không có tuổi, số thứ tự thật; cột Prefix của LSA 9 thêm cho dễ đọc. */
  function showLsdb6(d) {
    if (!d.ospf6) return ['% OSPFv3 not active'];
    const o = V6.ospf6All(net), rid = o.rid;
    if (!o.en[d.id]) return ['% OSPFv3 not active'];
    const seen = new Set([d.id]), q = [d.id];
    while (q.length) for (const a of o.adj[q.shift()] || []) if (!seen.has(a.to)) { seen.add(a.to); q.push(a.to); }
    const rs = [...seen], L = ['', `            OSPFv3 Router with ID (${rid[d.id]}) (Process ID ${d.ospf6.pid})`];
    for (const a of [...new Set(o.en[d.id].map((e) => e.area))]) {
      const inA = rs.filter((x) => o.en[x].some((e) => e.area === a));
      L.push('', `                Router Link States (Area ${a})`, '', 'ADV Router      Age         Seq#        Fragment ID  Link count');
      for (const x of inA) L.push(`${pad(rid[x], 16)}${pad(lsaAge, 12)}${pad(lsaSeq, 12)}${pad(0, 13)}${(o.adj[x] || []).filter((n) => n.area === a).length}`);
      const inter = rs.filter((x) => o.en[x].some((e) => e.area === a) && new Set(o.en[x].map((e) => e.area)).size > 1).flatMap((abr) => rs.flatMap((x) => o.en[x].filter((e) => e.area !== a).flatMap((e) => e.prefixes.map((p) => `${pad(rid[abr], 16)}${pad(lsaAge, 12)}${pad(lsaSeq, 12)}${p.net}/${p.prefix}`))));
      if (inter.length) L.push('', `                Inter Area Prefix Link States (Area ${a})`, '', 'ADV Router      Age         Seq#        Prefix', ...new Set(inter));
      L.push('', `                Link (Type-8) Link States (Area ${a})`, '', 'ADV Router      Age         Seq#        Interface');
      for (const e of o.en[d.id].filter((f) => f.area === a)) for (const x of [d.id, ...(o.adj[d.id] || []).filter((n) => n.outIf === e.ifn).map((n) => n.to)]) L.push(`${pad(rid[x], 16)}${pad(lsaAge, 12)}${pad(lsaSeq, 12)}${shortIf(e.ifn)}`);
      L.push('', `                Intra Area Prefix Link States (Area ${a})`, '', 'ADV Router      Age         Seq#        Prefix');
      for (const x of inA) for (const e of o.en[x].filter((f) => f.area === a)) for (const p of e.prefixes) L.push(`${pad(rid[x], 16)}${pad(lsaAge, 12)}${pad(lsaSeq, 12)}${p.net}/${p.prefix}`);
    }
    return L;
  }
  const inVrf = (x, fn) => { if (!x.d.bgp) return R(['% BGP not active']); if (x.d.bgp.vrf !== x.a[0]) return R([`% VRF ${x.a[0]} chưa chạy BGP`]); return R(fn()); };
  /** shortcut: chỉ liệt kê phiên BGP vì Lab không có bảng TCP riêng; cần thêm SSH, HTTP thì đưa phiên quản trị vào đây. */
  function showTcpBrief(d) {
    const L = ['TCB       Local Address               Foreign Address             (state)'];
    if (d.bgp) (N.bgpAll(ctxOf()).sessions[d.id] || []).forEach((s, i) => { if (s.state === 'Established') L.push(`${(0x6f000 + i).toString(16).toUpperCase().padStart(8, '0')}  ${pad(`${s.myIp}.179`, 28)}${pad(`${s.ip}.${49152 + i}`, 28)}ESTAB`); });
    return L;
  }
  function showAdv(d, ip, recv) {
    if (!d.bgp) return ['% BGP not active'];
    const b = N.bgpAll(ctxOf()), s = (b.sessions[d.id] || []).find((o) => o.ip === ip);
    if (!s) return [`% No such neighbor or address-family`];
    const L = [BGP_HEAD];
    if (recv) for (const [k, l] of Object.entries(b.tables[d.id] || {})) for (const p of l) if (p.from === s.peer) L.push(bgpLine(p, k, b.best[d.id][k] === p));
    if (!recv && s.peer) for (const [k, l] of Object.entries(b.tables[s.peer] || {})) for (const p of l) if (p.from === d.id) L.push(bgpLine({ ...p, weight: 0 }, k, false));
    L.push('', `Total number of prefixes ${L.length - 1}`);
    return L;
  }
  function showDmvpn(d) {
    const L = ['Legend: Attrb --> S - Static, D - Dynamic, I - Incomplete', '        N - NATed, L - Local, X - No Socket', '        T1 - Route Installed, T2 - Nexthop-override', '', '=========================================================================='];
    for (const [n, f] of Object.entries(d.ifaces || {})) {
      if (!n.startsWith('tu') || !f.nhrp) continue;
      const peers = peersOf(d, n);
      L.push('', `Interface: ${longIf(n)}, IPv4 NHRP Details`, `Type:${f.nhrp.mcastDyn ? 'Hub' : 'Spoke'}, NHRP Peers:${peers.length},`, '', ' # Ent  Peer NBMA Addr Peer Tunnel Add State  UpDn Tm Attrb', ' ----- --------------- --------------- ----- -------- -----');
      for (const p of peers) L.push(`     1 ${pad(p.nbma, 15)} ${pad(p.ip, 15)}    UP 00:05:12     ${p.attr}`);
    }
    return L;
  }
  function peersOf(d, n) {
    const f = d.ifaces[n], out = [];
    for (const s of N.nhrpSpokes(net, d, n)) out.push({ ...s, attr: 'D' });
    for (const ip of f.nhrp?.nhs || []) { const nb = f.nhrp.map?.[ip] ?? f.tunDst; if (nb && !out.some((o) => o.ip === ip)) out.push({ ip, nbma: nb, attr: 'S' }); }
    for (const e of d.nhrpCache || []) if (e.ifn === n) out.push({ ip: e.ip, nbma: e.nbma, attr: 'DT1', net: e.net, prefix: e.prefix });
    return out;
  }
  function showNhrp(d) {
    const L = [];
    for (const n of Object.keys(d.ifaces || {})) {
      if (!n.startsWith('tu') || !d.ifaces[n].nhrp) continue;
      for (const p of peersOf(d, n)) L.push(`${p.net ? `${p.net}/${p.prefix} via ${p.ip}` : `${p.ip}/32`}`, `   ${longIf(n)} created 00:05:12, ${p.attr.includes('D') ? 'dynamic' : 'static'}${p.net ? ' (shortcut)' : ''}`, `   NBMA address: ${p.nbma}`);
    }
    return L;
  }
  function showMon(d, only) {
    return Object.entries(d.monitor || {}).filter(([n]) => only == null || +n === only).flatMap(([n, s]) => [
      `Session ${n}`, '---------',
      `Type                   : ${s.kind === 'erspan-source' ? 'ERSPAN Source Session' : s.kind === 'erspan-destination' ? 'ERSPAN Destination Session' : s.srcRemote != null ? 'Remote Destination Session' : s.dstRemote != null ? 'Remote Source Session' : 'Local Session'}`,
      ...(s.srcPorts?.length ? [`Source Ports            : ${s.dir || 'both'}: ${s.srcPorts.map(shortIf).join(',')}`] : []),
      ...(s.srcVlans?.length ? [`Source VLANs            : ${s.srcVlans.join(',')}`] : []),
      ...(s.srcRemote != null ? [`Source RSPAN VLAN       : ${s.srcRemote}`] : []),
      ...(s.dst ? [`Destination Ports       : ${shortIf(s.dst)}`] : []),
      ...(s.dstRemote != null ? [`Dest RSPAN VLAN         : ${s.dstRemote}`] : []),
      ...(s.erspanId != null ? [`ERSPAN ID               : ${s.erspanId}`] : []),
      ...(s.erspanDst ? [`Destination IP Address  : ${s.erspanDst}`] : []),
      ...(s.erspanIp ? [`Source IP Address       : ${s.erspanIp}`] : []),
      '',
    ]);
  }
  function showFlowCache(d, name) {
    const rows = Object.values(d.flowCache || {}).filter((f) => (name ? f.monitor === name : f.monitor === 'legacy'));
    if (name) return [`Cache type:                               Normal`, `  Current entries:                       ${rows.length}`, '', 'IPV4 SRC ADDR    IPV4 DST ADDR    TRNS SRC PORT  TRNS DST PORT  IP PROT  INTF INPUT  pkts', ...rows.map((f) => `${pad(f.src, 17)}${pad(f.dst, 17)}${pad(f.sport ?? 0, 15)}${pad(f.dport ?? 0, 15)}${pad({ icmp: 1, tcp: 6, udp: 17 }[f.proto] ?? 0, 9)}${pad(shortIf(f.ifn), 12)}${f.pkts}`)];
    return ['IP packet size distribution', '', `Total Flows: ${rows.length}`, '', 'SrcIf         SrcIPaddress    DstIf     DstIPaddress    Pr SrcP DstP  Pkts', ...rows.map((f) => `${pad(shortIf(f.ifn), 14)}${pad(f.src, 16)}${pad('', 10)}${pad(f.dst, 16)}${pad(({ icmp: '01', tcp: '06', udp: '11' })[f.proto] || '00', 3)}${pad((f.sport ?? 0).toString(16), 5)}${pad((f.dport ?? 0).toString(16), 6)}${f.pkts}`)];
  }
  function showSla(d, cfgOnly) {
    return Object.entries(d.slas || {}).flatMap(([id, s]) => {
      if (cfgOnly) return [`IP SLAs Infrastructure Engine-III`, `Entry number: ${id}`, `Type of operation to perform: ${s.type || 'icmp-echo'}`, `Target address/Source address: ${s.target || '0.0.0.0'}/${s.srcIf ? IFS(d)[s.srcIf]?.ip : '0.0.0.0'}`, ...(s.port ? [`Target port: ${s.port}`] : []), ...(s.codec ? [`Codec Type: ${s.codec}`] : []), `Frequency (seconds): ${s.freq}`, `Schedule:`, `   Operation frequency (seconds): ${s.freq}`, `   Life (seconds): ${s.scheduled ? 'Forever' : 'not scheduled'}`];
      const ok = N.slaUp(net, d, s);
      // shortcut: mạng Lab không có trễ thật nên RTT, jitter, MOS là số minh hoạ khi đo thành công
      const jitter = s.type && ok ? ['Latest RTT detail:', '\tRTT Values: Min 1 ms, Avg 1 ms, Max 2 ms', '\tJitter Time: Source to Destination 0 ms, Destination to Source 0 ms', '\tPacket Loss: Source to Destination 0, Destination to Source 0, Out of sequence 0', ...(s.codec ? ['\tVoice Scores: MOS 4.34, ICPIF 1'] : []), '(Lab: số đo chỉ minh hoạ)'] : [];
      return [`IPSLAs Latest Operation Statistics`, '', `IPSLA operation id: ${id}`, `Type of operation: ${s.type || 'icmp-echo'}`, `\tLatest RTT: ${ok ? '1 milliseconds' : 'NoConnection/Busy/Timeout'}`, `Latest operation return code: ${!s.scheduled ? 'Unknown (chưa schedule)' : ok ? 'OK' : s.type === 'udp-jitter' ? 'Timeout (đầu kia có "ip sla responder" chưa?)' : 'Timeout'}`, ...jitter, `Number of successes: ${ok ? 5 : 0}`, `Number of failures: ${ok ? 0 : 5}`, ''];
    });
  }
  function showTrack(d, only) {
    return Object.entries(d.tracks || {}).filter(([n]) => only == null || +n === only).flatMap(([n, t]) => {
      const up = N.trackUp(net, d, +n);
      return [`Track ${n}`, t.ifn ? `  Interface ${longIf(t.ifn)} line-protocol` : `  IP SLA ${t.sla} ${t.kind || 'state'}`, `  ${t.ifn ? 'Line protocol' : t.kind === 'reachability' ? 'Reachability' : 'State'} is ${up ? (t.kind === 'reachability' || t.ifn ? 'Up' : 'Up') : 'Down'}`, '    1 change, last change 00:00:30', ...(d.routes.some((r) => r.track === +n) ? ['  Tracked by:', '    Static IP Routing 0'] : [])];
    });
  }
  function showBfd(d) {
    const ctx = ctxOf(), L = ['IPv4 Sessions', 'NeighAddr                              LD/RD         RH/RS     State     Int'];
    let i = 1;
    const add = (ip, ifn) => { const f = IFS(d)[ifn]; if (f?.bfd) L.push(`${pad(ip, 39)}${pad(`${i}/${i}`, 14)}${pad('Up', 10)}${pad('Up', 10)}${shortIf(ifn)}`), i++; };
    if (d.ospf?.bfd) for (const a of N.ospfAll(ctx).adj[d.id] || []) if (IFS(net.devices[a.to])[a.theirIf]?.bfd) add(a.nh, a.outIf);
    if (d.eigrp?.bfd) for (const a of N.eigrpAll(ctx).adj[d.id] || []) if (IFS(net.devices[a.to])[a.theirIf]?.bfd) add(a.nh, a.outIf);
    if (d.bgp) for (const s of N.bgpAll(ctx).sessions[d.id] || []) if (s.cfg.bfd && s.state === 'Established' && s.peer) { const ifn = N.lookup(ctx, d.id, s.ip)?.iface; if (ifn) add(s.ip, ifn); }
    return L;
  }
  const SHOW_X = [
    c('show ip vrf', (x) => R(showVrf(x.d))),
    c('show vrf', (x) => R(showVrf(x.d))),
    c('show ip vrf interfaces', (x) => R(['Interface              IP-Address      VRF                              Protocol', ...Object.entries(IFS(x.d)).filter(([, f]) => f.vrf).map(([n, f]) => `${pad(shortIf(n), 23)}${pad(f.ip || 'unassigned', 16)}${pad(f.vrf, 33)}${N.ifUp(net, x.d.id, n) ? 'up' : 'down'}`)])),
    c('show ip route vrf <word>', (x) => (x.d.vrfs?.[x.a[0]] ? R(showIpRoute(x.d, null, x.a[0])) : R([`% IP routing table ${x.a[0]} does not exist`]))),
    c('show ip route vrf <word> {ospf|static|connected|eigrp|bgp}', (x) => (x.d.vrfs?.[x.a[0]] ? R(showIpRoute(x.d, x.a[1], x.a[0])) : R([`% IP routing table ${x.a[0]} does not exist`]))),
    c('show ip prefix-list', (x) => R(showPl(x.d))),
    c('show ip prefix-list <word>', (x) => R(showPl(x.d, x.a[0]))),
    c('show route-map', (x) => R(showRm(x.d))),
    c('show route-map <word>', (x) => R(showRm(x.d, x.a[0]))),
    c('show ip policy', (x) => R(['Interface      Route map', ...Object.entries(IFS(x.d)).filter(([, f]) => f.policy).map(([n, f]) => `${pad(shortIf(n), 15)}${f.policy}`)])),
    c('show ip as-path-access-list', (x) => R(Object.entries(x.d.asPathAcls || {}).flatMap(([n, l]) => [`AS path access list ${n}`, ...l.map((e) => `    ${e.action} ${e.re}`)]))),
    c('show ip ospf virtual-links', (x) => { const o = N.ospfAll(ctxOf()); return R((o.vlinks?.[x.d.id] || []).flatMap((v) => [`Virtual Link OSPF_VL0 to router ${v.rid} is ${v.up ? 'up' : 'down'}`, `  Transit area ${v.area}, Cost of using 1`, `  Adjacency State ${v.up ? 'FULL' : 'DOWN'}`])); }),
    c('show ip ospf border-routers', (x) => {
      const o = N.ospfAll(ctxOf()), L = ['OSPF Router with ID (' + (o.rid[x.d.id] || '0.0.0.0') + ')', '', 'Base Topology (MTID 0)', '', 'Internal Router Routing Table', ''];
      const sp = o.spf?.[x.d.id];
      if (sp) for (const id of Object.keys(sp.dist)) {
        if (id === x.d.id) continue;
        const a = new Set((o.en[id] || []).map((e) => e.area)), asbr = !!net.devices[id].ospf?.redist && Object.keys(net.devices[id].ospf.redist).length;
        if (a.size > 1 || asbr) L.push(`i ${o.rid[id]} [${sp.dist[id]}] via ${sp.first[id].nh}, ${longIf(sp.first[id].outIf)}, ${[a.size > 1 && 'ABR', asbr && 'ASBR'].filter(Boolean).join('/')}`);
      }
      return R(L);
    }),
    c('show ip eigrp topology', (x) => R(showTopo(x.d, false))),
    c('show ip eigrp topology all-links', (x) => R(showTopo(x.d, true))),
    c('show eigrp address-family ipv4 topology', (x) => R(showTopo(x.d, false))),
    c('show eigrp address-family ipv4 neighbors', (x) => R(T.showEigrpNei(x.d))),
    c('show key chain', (x) => R(Object.entries(x.d.keyChains || {}).flatMap(([n, ks]) => [`Key-chain ${n}:`, ...Object.entries(ks).flatMap(([id, k]) => [`    key ${id} -- text "${k.str || ''}"`, '        accept lifetime (always valid) - (always valid) [valid now]', '        send lifetime (always valid) - (always valid) [valid now]'])]))),
    c('show ip bgp neighbors', (x) => R(showBgpNbr(x.d, null))),
    c('show ip bgp neighbors <ip>', (x) => R(showBgpNbr(x.d, x.a[0]))),
    c('show ip bgp neighbors <ip> advertised-routes', (x) => R(showAdv(x.d, x.a[0], false))),
    c('show ip bgp neighbors <ip> routes', (x) => R(showAdv(x.d, x.a[0], true))),
    c('show ip bgp neighbors <ip> received-routes', (x) => { const n = N.bgpCfg(x.d, x.a[0]); return R(n && !n.softIn ? [`% Inbound soft reconfiguration not enabled on ${x.a[0]}`] : showAdv(x.d, x.a[0], true)); }),
    c('show ip ospf database', (x) => R(showLsdb(x.d))),
    c('show ip ospf database {router|network|summary|asbr-summary|external|nssa-external}', (x) => R(showLsdb(x.d, { 'asbr-summary': 'asbr', 'nssa-external': 'nssa' }[x.a[0]] || x.a[0]))),
    c('show ip ospf rib', (x) => { if (!x.d.ospf) return R(['% OSPF not active']); const o = N.ospfAll(ctxOf()); return R([`OSPF Router with ID (${o.rid[x.d.id]}) (Process ID ${x.d.ospf.pid})`, '', ...(o.routes[x.d.id] || []).flatMap((r) => [`*>  ${r.net}/${r.prefix}, ${r.code}, cost ${r.metric}`, `      via ${r.nextHop || 'Null0'}${r.iface ? `, ${longIf(r.iface)}` : ''}`])]); }),
    // shortcut: Lab không làm hỏng LSA nên bảng này luôn trống; cần tập lỗi LOADING thì thêm trạng thái LSA lỗi
    c('show ip ospf bad-checksum', (x) => R(x.d.ospf ? [`OSPF Router with ID (${N.ospfAll(ctxOf()).rid[x.d.id]}) (Process ID ${x.d.ospf.pid})`, '', 'Bad checksum LSAs: 0'] : ['% OSPF not active'])),
    c('show ospfv3 database', (x) => R(showLsdb6(x.d))),
    c('show ipv6 ospf database', (x) => R(showLsdb6(x.d))),
    c('show ip bgp <ip>', (x) => R(showBgpEntry(x.d, x.a[0]))),
    c('show ip bgp <ip> <mask>', (x) => R(showBgpEntry(x.d, x.a[0], maskToPrefix(x.a[1])))),
    c('show ip bgp regexp <rest>', (x) => { const re = iosRegex(x.a[0]); return R(re ? bgpFiltered(x.d, (p) => re.test(p.asPath.join(' '))) : ["% Invalid input detected at '^' marker."]); }),
    c('show ip bgp filter-list <word>', (x) => R(bgpFiltered(x.d, (p) => asPathOk(x.d, x.a[0], p.asPath)))),
    c('show ip bgp prefix-list <word>', (x) => R(bgpFiltered(x.d, (p) => plEval(x.d, x.a[0], p.net, p.prefix)))),
    c('show ip bgp route-map <word>', (x) => R(bgpFiltered(x.d, (p) => !!rmEval(x.d, x.a[0], { ...p, metric: p.med })))),
    c('show ip bgp community <rest>', (x) => R(bgpFiltered(x.d, (p) => x.a[0].trim().split(/\s+/).every((v) => p.comm?.includes(v))))),
    c('show ip bgp community-list <word>', (x) => R(bgpFiltered(x.d, (p) => commOk(x.d, x.a[0], p.comm)))),
    c('show ip bgp rib-failure', (x) => R(showRibFail(x.d))),
    c('show ip bgp vpnv4 vrf <word>', (x) => inVrf(x, () => T.showBgp(x.d, true))),
    c('show ip bgp vpnv4 vrf <word> summary', (x) => inVrf(x, () => T.showBgpSum(x.d, true))),
    c('show bgp vpnv4 unicast vrf <word>', (x) => inVrf(x, () => T.showBgp(x.d, true))),
    c('show bgp vpnv4 unicast vrf <word> summary', (x) => inVrf(x, () => T.showBgpSum(x.d, true))),
    c('show ip community-list', (x) => R(Object.entries(x.d.commLists || {}).flatMap(([n, l]) => [`Community ${l[0]?.expanded ? 'expanded' : 'standard'} list ${n}`, ...l.map((e) => `    ${e.action} ${e.vals.join(' ')}`)]))),
    c('show tcp brief', (x) => R(showTcpBrief(x.d))),
    c('show ip bgp peer-group', (x) => R(Object.entries(x.d.bgp?.groups || {}).flatMap(([n, g]) => [`BGP peer-group is ${n}, remote AS ${g.remoteAs ?? 'not set'}`, ...Object.entries(x.d.bgp.neighbors).filter(([, o]) => o.group === n).map(([ip]) => `  Peer-group member: ${ip}`)]))),
    c('show dmvpn', (x) => R(showDmvpn(x.d))),
    c('show ip nhrp', (x) => R(showNhrp(x.d))),
    c('show ip nhrp nhs', (x) => R(Object.entries(x.d.ifaces || {}).filter(([n, f]) => n.startsWith('tu') && f.nhrp?.nhs).flatMap(([n, f]) => [`${longIf(n)}:`, ...f.nhrp.nhs.map((ip) => `${ip}  RE priority = 0 cluster = 0`)]))),
    c('show time-range', (x) => R(Object.entries(x.d.timeRanges || {}).flatMap(([n, l]) => [`time-range entry: ${n} (${N.timeRangeOn(x.d, n) ? 'active' : 'inactive'})`, ...l.map((p) => `   ${p.text}`)]))),
    c('show class-map', (x) => R(Object.entries(x.d.qos?.classes || {}).flatMap(([n, q]) => [` Class Map ${q.all ? 'match-all' : 'match-any'} ${n}`, ...q.matches.map((m) => `   Match ${m.k === 'acl' ? `access-group name ${m.v}` : m.k === 'dscp' ? `dscp ${m.v}` : 'any'}`)]))),
    c('show policy-map', (x) => R(Object.keys(x.d.qos?.policies || {}).flatMap((n) => [`  Policy Map ${n}`, ...qosLines(x.d, n, '    ')]))),
    c('show policy-map <word>', (x) => R([`  Policy Map ${x.a[0]}`, ...qosLines(x.d, x.a[0], '    ')])),
    c('show policy-map interface', (x) => R(Object.entries(IFS(x.d)).filter(([, f]) => f.qosIn || f.qosOut).flatMap(([n, f]) => [` ${longIf(n)}`, ...(f.qosIn ? [`  Service-policy input: ${f.qosIn}`, ...qosLines(x.d, f.qosIn, '    ')] : []), ...(f.qosOut ? [`  Service-policy output: ${f.qosOut}`, ...qosLines(x.d, f.qosOut, '    ')] : [])]))),
    c('show policy-map interface <if>', (x) => { const f = IFS(x.d)[x.a[0]]; return R(f ? [` ${longIf(x.a[0])}`, ...(f.qosIn ? [`  Service-policy input: ${f.qosIn}`, ...qosLines(x.d, f.qosIn, '    ')] : []), ...(f.qosOut ? [`  Service-policy output: ${f.qosOut}`, ...qosLines(x.d, f.qosOut, '    ')] : [])] : ['% Invalid interface']); }),
    c('show policy-map control-plane', (x) => R(x.d.copp?.input ? [' Control Plane', '', `  Service-policy input: ${x.d.copp.input}`, ...qosLines(x.d, x.d.copp.input, '    ')] : [' Control Plane', '  (Lab: chưa gắn service-policy)'])),
    c('show ip cache flow', (x) => R(showFlowCache(x.d, null))),
    c('show ip flow interface', (x) => R(Object.entries(IFS(x.d)).filter(([, f]) => f.flow?.in === 'legacy' || f.flow?.out === 'legacy').flatMap(([n, f]) => [longIf(n), ...(f.flow.in ? ['  ip flow ingress'] : []), ...(f.flow.out ? ['  ip flow egress'] : [])]))),
    c('show ip flow export', (x) => { const l = x.d.flow?.legacy; return R(l ? [`Flow export v${l.version || 1} is enabled for main cache`, `  Export source and destination details :`, `  VRF ID : Default`, `    Destination(1)  ${l.dst || 'not set'} (${l.port || 0})`] : ['Flow export is disabled']); }),
    c('show flow record', (x) => R(Object.entries(x.d.flow?.records || {}).flatMap(([n, r]) => [`flow record ${n}:`, ...r.match.map((m) => `  match ${m}`), ...r.collect.map((m) => `  collect ${m}`)]))),
    c('show flow exporter', (x) => R(Object.entries(x.d.flow?.exporters || {}).flatMap(([n, e]) => [`Flow Exporter ${n}:`, `  Export protocol:           ${e.proto || 'NetFlow Version 9'}`, `  Transport Configuration:`, `    Destination IP address:  ${e.dst || 'not set'}`, `    Transport Protocol:      UDP`, `    Destination Port:        ${e.port}`]))),
    c('show flow monitor', (x) => R(Object.entries(x.d.flow?.monitors || {}).flatMap(([n, m]) => [`Flow Monitor ${n}:`, `  Status:            ${Object.values(IFS(x.d)).some((f) => f.flow?.in === n || f.flow?.out === n) ? 'allocated' : 'not allocated'}`, `  Flow Record:       ${m.record || 'not set'}`, `  Flow Exporter:     ${m.exporter || 'not set'}`]))),
    c('show flow monitor <word> cache', (x) => R(x.d.flow?.monitors?.[x.a[0]] ? showFlowCache(x.d, x.a[0]) : [`% Flow Monitor: Flow Monitor '${x.a[0]}' does not exist`])),
    c('show flow interface', (x) => R(Object.entries(IFS(x.d)).filter(([, f]) => f.flow).flatMap(([n, f]) => [`Interface ${longIf(n)}`, ...(f.flow.in ? [`  FNF: monitor: ${f.flow.in}, direction: Input`] : []), ...(f.flow.out ? [`  FNF: monitor: ${f.flow.out}, direction: Output`] : [])]))),
    c('show monitor', (x) => R(showMon(x.d))),
    c('show monitor session all', (x) => R(showMon(x.d))),
    c('show monitor session <num>', (x) => R(showMon(x.d, x.a[0]))),
    c('show ip sla configuration', (x) => R(showSla(x.d, true))),
    c('show ip sla statistics', (x) => R(showSla(x.d, false))),
    c('show ip sla responder', (x) => R([`IP SLAs Responder is: ${x.d.slaResponder ? 'Enabled' : 'Disabled'}`])),
    c('show telemetry ietf subscription all', (x) => R(showMdt(x.d))),
    c('show telemetry ietf subscription <num> detail', (x) => R(showMdt(x.d, x.a[0]))),
    c('show ipv6 eigrp neighbors', (x) => { const o = V6.eigrp6All(net); return R(x.d.eigrp6 ? [`EIGRP-IPv6 Neighbors for AS(${x.d.eigrp6.as})`, 'H   Address                 Interface', ...(o.adj[x.d.id] || []).flatMap((a, i) => [`${pad(i, 4)}Link-local address:     ${shortIf(a.outIf)}`, `    ${a.nh}`])] : ['% EIGRP IPv6 not active']); }),
    c('show ipv6 protocols', (x) => { const e = x.d.eigrp6, o = x.d.ospf6, b = x.d.bgp?.v6; return R([...(e ? [`IPv6 Routing Protocol is "eigrp ${e.as}"`, `  Router-ID: ${V6.eigrp6Rid(net, x.d) || 'chưa có (cần eigrp router-id)'}`, ...(e.shutdown ? ['  Process is shutdown'] : []), ...(e.passive.length ? [`  Passive interfaces: ${e.passive.map(shortIf).join(', ')}`] : [])] : []), ...(o ? [`IPv6 Routing Protocol is "ospf ${o.pid}"`] : []), ...(b ? [`IPv6 Routing Protocol is "bgp ${x.d.bgp.as}"`] : [])]); }),
    c('show bgp ipv6 unicast', (x) => { if (!x.d.bgp?.v6) return R(['% BGP IPv6 not active']); const t = V6.bgp6All(net).best[x.d.id]; return R([BGP_HEAD, ...[...(t?.values() || [])].flatMap((b) => [`*>${b.ibgp ? 'i' : ' '}${b.net}/${b.prefix}`, `                    ${pad(b.nh || '::', 28)}${[...b.asPath, 'i'].join(' ')}`])]); }),
    c('show bgp ipv6 unicast summary', (x) => { if (!x.d.bgp?.v6) return R(['% BGP IPv6 not active']); const b = V6.bgp6All(net); return R([`BGP router identifier ${x.d.bgp.rid || 'tự chọn'}, local AS number ${x.d.bgp.as}`, '', `${pad('Neighbor', 42)}${pad('AS', 12)}State/PfxRcd`, ...(b.sessions[x.d.id] || []).map((s) => `${pad(s.ip, 42)}${pad(s.remoteAs, 12)}${s.state === 'Established' ? [...b.best[x.d.id].values()].filter((p) => p.nh === s.ip).length : s.cfg.active ? 'Idle' : 'Idle (chưa activate)'}`)]); }),
    c('show track', (x) => R(showTrack(x.d))),
    c('show track <num>', (x) => R(showTrack(x.d, x.a[0]))),
    c('show event manager policy registered', (x) => R(['No.  Class     Type    Event Type          Trap  Time Registered           Name', ...Object.entries(x.d.eem || {}).map(([n, a], i) => `${pad(i + 1, 5)}applet    user    ${pad(a.event?.k || 'none', 20)}Off   Mon Mar 2 12:00:00 2026   ${n}`)])),
    c('show event manager history events', (x) => R(['No.  Job Id Proc Status Time of Event            Event Type   Name', ...Object.entries(x.d.eem || {}).filter(([, a]) => a.runs).map(([n, a], i) => `${pad(i + 1, 5)}${pad(i + 1, 7)}Actv ${pad('success', 7)}Mon Mar 2 12:00:00 2026  ${pad(a.event?.k, 13)}applet: ${n} (${a.runs} lần)`)])),
    c('show bfd neighbors', (x) => R(showBfd(x.d))),
    c('show netconf-yang status', (x) => R([`netconf-yang: ${x.d.netconf ? 'enabled' : 'disabled'}`, `netconf-yang ssh port: 830`, `netconf-yang candidate-datastore: disabled`])),
    c('show netconf-yang sessions', (x) => R(['Number of sessions : 0'])),
    c('show ipv6 dhcp pool', (x) => R(Object.entries(x.d.dhcp6?.pools || {}).flatMap(([n, p]) => [`DHCPv6 pool: ${n}`, ...(p.addr ? [`  Address allocation prefix: ${p.addr.ip}/${p.addr.prefix}`] : []), ...(p.dns ? [`  DNS server: ${p.dns}`] : []), ...(p.domain ? [`  Domain name: ${p.domain}`] : []), `  Active clients: ${x.d.dhcp6.bindings.filter((b) => b.pool === n).length}`]))),
    c('show ipv6 dhcp binding', (x) => R((x.d.dhcp6?.bindings || []).flatMap((b) => [`Client: ${b.client}`, `  IA NA: IA ID 0x00030001, T1 43200, T2 69120`, `    Address: ${b.ip}`, `    preferred lifetime 86400, valid lifetime 172800`, `  (${b.pool}, ${b.via === 'relay' ? 'qua relay' : 'cùng link'})`]))),
    c('show ipv6 dhcp interface', (x) => R(Object.entries(IFS(x.d)).filter(([, f]) => f.dhcp6Server || f.dhcp6Relay || (f.ipv6 || []).some((a) => a.dhcp)).flatMap(([n, f]) => [`${longIf(n)} is in ${f.dhcp6Server ? 'server' : f.dhcp6Relay ? 'relay' : 'client'} mode`, ...(f.dhcp6Server ? [`  Using pool: ${f.dhcp6Server}`] : []), ...(f.dhcp6Relay ? [`  Relay destinations: ${f.dhcp6Relay}`] : [])]))),
    c('show ip verify source', (x) => R(Object.entries(IFS(x.d)).filter(([, f]) => f.urpf).map(([n, f]) => `${shortIf(n)}  uRPF ${f.urpf.mode}${f.urpf.allowDefault ? ' allow-default' : ''}  drops ${f.urpfDrops || 0}`))),
    c('show aaa method-lists', (x) => R(['authen queue=AAA_ML_AUTHEN_LOGIN', ...Object.entries(x.d.aaa?.lists || {}).map(([n, m]) => `  name=${n} valid=TRUE ${m.join(' ')}`), 'permanent lists', ...Object.entries(x.d.aaa?.authz || {}).map(([k, v]) => `  author ${k} name=${v.list} ${v.methods}`), ...Object.entries(x.d.aaa?.acct || {}).map(([k, v]) => `  account ${k} name=${v.list} ${v.methods}`)])),
  ];
  const EXEC_X = [
    c('ping vrf <word> <ip>', (x) => (x.d.vrfs?.[x.a[0]] ? iosPing(x.d, x.a[1], x.a[0]) : R([`% VRF ${x.a[0]} does not have a usable source address`]))),
    c('traceroute vrf <word> <ip>', (x) => (x.d.vrfs?.[x.a[0]] ? iosTrace(x.d, x.a[1], x.a[0]) : R([`% VRF ${x.a[0]} not found`]))),
    // shortcut: BGP tính lại ngay sau mỗi lệnh nên clear chỉ để giống thao tác thật, chưa mô phỏng thời gian chờ
    c('clear ip bgp <word>', () => R([])),
    c('clear ip bgp <word> soft', () => R([])),
    c('clear ip bgp <word> soft {in|out}', () => R([])),
    c('clear ip bgp <word> {in|out}', () => R([])),
    c('clear ip nhrp', (x) => { x.d.nhrpCache = []; return R([]); }),
    c('clear ip flow stats', (x) => { x.d.flowCache = {}; return R([]); }),
    c('clear ip ospf process', () => R(['Reset ALL OSPF processes? [no]: yes'])),
    c('clear policy-map counters', (x) => { for (const p of Object.values(x.d.qos?.policies || {})) for (const e of p) e.pkts = 0; return R([]); }),
    c('event manager run <word>', (x) => { const a = x.d.eem?.[x.a[0]]; if (!a) return R([`EEM policy ${x.a[0]} not registered`]); if (a.event?.k !== 'none') return R([`EEM policy ${x.a[0]} not registered with event none Event Detector`]); return R(eemRun(x.d, x.a[0], a)); }),
    c('clock set <word> <num> <word> <num>', (x) => {
      const dt = new Date(`${x.a[2]} ${x.a[1]} ${x.a[3]} ${x.a[0]}`);
      if (Number.isNaN(+dt)) return R(['% Invalid input detected']);
      x.d.clockNow = { day: dt.toString().slice(0, 3), min: dt.getHours() * 60 + dt.getMinutes(), text: `${x.a[0]}.000 UTC ${dt.toString().slice(0, 3)} ${x.a[2]} ${x.a[1]} ${x.a[3]}` };
      return R([]);
    }),
    c('debug condition ip <ip>', (x) => { ((x.d.debug ||= {}).cond ||= {}).ip = x.a[0]; return R([`Condition 1 set`]); }),
    c('debug condition interface <if>', (x) => { ((x.d.debug ||= {}).cond ||= {}).ifn = x.a[0]; return R([`Condition 1 set`]); }),
    c('undebug condition all', (x) => { if (x.d.debug) x.d.debug.cond = null; return R(['All conditions removed']); }),
    c('no debug condition all', (x) => { if (x.d.debug) x.d.debug.cond = null; return R(['All conditions removed']); }),
    c('show debugging condition', (x) => { const q = x.d.debug?.cond; return R(q ? [...(q.ip ? [`Condition 1: ip ${q.ip} (1 flags triggered)`] : []), ...(q.ifn ? [`Condition 2: interface ${longIf(q.ifn)} (1 flags triggered)`] : [])] : ['No conditions set']); }),
  ];

  // ---------- show running-config ----------
  function running(d) {
    const L = [];
    for (const [n, v] of Object.entries(d.vrfs || {})) L.push(`ip vrf ${n}`, ...(v.rd ? [` rd ${v.rd}`] : []), '!');
    if (d.commNew) L.push('ip bgp-community new-format');
    for (const [n, l] of Object.entries(d.commLists || {})) for (const e of l) L.push(`ip community-list ${/^\d+$/.test(n) ? n : `${e.expanded ? 'expanded' : 'standard'} ${n}`} ${e.action} ${e.vals.join(' ')}`);
    for (const [n, ks] of Object.entries(d.keyChains || {})) L.push(`key chain ${n}`, ...Object.entries(ks).flatMap(([id, k]) => [` key ${id}`, ...(k.str ? [`  key-string ${k.str}`] : [])]), '!');
    for (const [n, l] of Object.entries(d.timeRanges || {})) L.push(`time-range ${n}`, ...l.map((p) => ` ${p.text}`), '!');
    for (const [n, q] of Object.entries(d.qos?.classes || {})) L.push(`class-map ${q.all ? 'match-all' : 'match-any'} ${n}`, ...q.matches.map((m) => ` match ${m.k === 'acl' ? `access-group name ${m.v}` : m.k === 'dscp' ? `ip dscp ${m.v}` : 'any'}`), '!');
    for (const [n, p] of Object.entries(d.qos?.policies || {})) {
      L.push(`policy-map ${n}`);
      for (const e of p) L.push(` class ${e.cls}`, ...(e.priority ? [`  priority ${/%/.test(e.priority) ? `percent ${parseInt(e.priority, 10)}` : parseInt(e.priority, 10)}`] : []), ...(e.bw ? [`  bandwidth ${/%/.test(e.bw) ? `percent ${parseInt(e.bw, 10)}` : parseInt(e.bw, 10)}`] : []), ...(e.shape ? [`  shape average ${e.shape}`] : []), ...(e.police != null ? [`  police ${e.police}`] : []), ...(e.dscp ? [`  set dscp ${e.dscp}`] : []), ...(e.wred ? ['  random-detect'] : []), ...(e.drop ? ['  drop'] : []), ...(e.child ? [`  service-policy ${e.child}`] : []));
      L.push('!');
    }
    if (d.copp?.input) L.push('control-plane', ` service-policy input ${d.copp.input}`, '!');
    for (const [n, p] of Object.entries(d.crypto?.profiles || {})) L.push(`crypto ipsec profile ${n}`, ...(p.tset ? [` set transform-set ${p.tset}`] : []), '!');
    for (const [n, p] of Object.entries(d.dhcp6?.pools || {})) L.push(`ipv6 dhcp pool ${n}`, ...(p.addr ? [` address prefix ${p.addr.ip}/${p.addr.prefix}`] : []), ...(p.dns ? [` dns-server ${p.dns}`] : []), ...(p.domain ? [` domain-name ${p.domain}`] : []), '!');
    for (const [n, r] of Object.entries(d.flow?.records || {})) L.push(`flow record ${n}`, ...r.match.map((m) => ` match ${m}`), ...r.collect.map((m) => ` collect ${m}`), '!');
    for (const [n, e] of Object.entries(d.flow?.exporters || {})) L.push(`flow exporter ${n}`, ...(e.dst ? [` destination ${e.dst}`] : []), ...(e.src ? [` source ${longIf(e.src)}`] : []), ` transport udp ${e.port}`, ...(e.proto ? [` export-protocol ${e.proto}`] : []), '!');
    for (const [n, m] of Object.entries(d.flow?.monitors || {})) L.push(`flow monitor ${n}`, ...(m.record ? [` record ${m.record}`] : []), ...(m.exporter ? [` exporter ${m.exporter}`] : []), '!');
    if (d.flow?.legacy) { const l = d.flow.legacy; if (l.version) L.push(`ip flow-export version ${l.version}`); if (l.src) L.push(`ip flow-export source ${longIf(l.src)}`); if (l.dst) L.push(`ip flow-export destination ${l.dst} ${l.port}`); }
    for (const [n, list] of Object.entries(d.prefixLists || {})) for (const e of list) L.push(`ip prefix-list ${n} seq ${e.seq} ${e.action} ${e.net}/${e.prefix}${e.ge != null ? ` ge ${e.ge}` : ''}${e.le != null ? ` le ${e.le}` : ''}`);
    for (const [n, l] of Object.entries(d.asPathAcls || {})) for (const e of l) L.push(`ip as-path access-list ${n} ${e.action} ${e.re}`);
    for (const [n, list] of Object.entries(d.routeMaps || {})) {
      for (const e of list) {
        L.push(`route-map ${n} ${e.action} ${e.seq}`);
        for (const m of e.matches) L.push(` match ${{ pl: 'ip address prefix-list', acl: 'ip address', tag: 'tag', metric: 'metric', aspath: 'as-path' }[m.k]} ${m.vals.join(' ')}`);
        for (const [k, v] of Object.entries(e.sets)) L.push(` set ${{ metric: 'metric', tag: 'tag', localPref: 'local-preference', weight: 'weight', prepend: 'as-path prepend', metricType: 'metric-type', nextHop: 'ip next-hop', community: 'community' }[k]} ${k === 'community' ? commSet(v) : k === 'metricType' ? `type-${v}` : Array.isArray(v) ? v.join(' ') : v}`);
        L.push('!');
      }
    }
    for (const [id, s] of Object.entries(d.slas || {})) L.push(`ip sla ${id}`, ...(s.target ? [s.type === 'udp-jitter' ? ` udp-jitter ${s.target} ${s.port}${s.codec ? ` codec ${s.codec}` : ''}` : s.type ? ` icmp-jitter ${s.target}` : ` icmp-echo ${s.target}${s.srcIf ? ` source-interface ${longIf(s.srcIf)}` : ''}`] : []), ` frequency ${s.freq}`, ...(s.scheduled ? [`ip sla schedule ${id} life forever start-time now`] : []), '!');
    if (d.slaResponder) L.push('ip sla responder');
    for (const [id, s] of Object.entries(d.mdt || {})) L.push(`telemetry ietf subscription ${id}`, ...(s.encoding ? [` encoding ${s.encoding}`] : []), ...(s.xpath ? [` filter xpath ${s.xpath}`] : []), ...(s.source ? [` source-address ${s.source}`] : []), ...(s.stream ? [` stream ${s.stream}`] : []), ...(s.policy ? [` update-policy ${s.policy}`] : []), ...(s.receiver ? [` receiver ip address ${s.receiver.ip} ${s.receiver.port} protocol grpc-tcp`] : []), '!');
    const e6 = d.eigrp6;
    if (e6?.named) L.push(`router eigrp ${e6.named}`, ` address-family ipv6 unicast autonomous-system ${e6.as}`, ...(e6.rid ? [`  eigrp router-id ${e6.rid}`] : []), ...e6.passive.flatMap((n) => [`  af-interface ${longIf(n)}`, '   passive-interface', '  exit-af-interface']), ' exit-address-family', '!');
    else if (e6) L.push(`ipv6 router eigrp ${e6.as}`, ...(e6.rid ? [` eigrp router-id ${e6.rid}`] : []), ...e6.passive.map((n) => ` passive-interface ${longIf(n)}`), ...(e6.shutdown ? [' shutdown'] : []), '!');
    for (const [id, t] of Object.entries(d.tracks || {})) L.push(t.ifn ? `track ${id} interface ${longIf(t.ifn)} line-protocol` : `track ${id} ip sla ${t.sla}${t.kind ? ` ${t.kind}` : ''}`);
    for (const [n, s] of Object.entries(d.monitor || {})) {
      if (s.kind) { L.push(`monitor session ${n} type ${s.kind}`, ...(s.srcPorts || []).map((p) => ` source interface ${longIf(p)}`), ...(s.dst ? [` destination interface ${longIf(s.dst)}`] : []), s.kind === 'erspan-source' ? ' destination' : ' source', ...(s.erspanId != null ? [`  erspan-id ${s.erspanId}`] : []), ...(s.erspanDst || s.erspanIp ? [`  ip address ${s.erspanDst || s.erspanIp}`] : []), ...(s.origin ? [`  origin ip address ${s.origin}`] : []), '!'); continue; }
      for (const p of s.srcPorts || []) L.push(`monitor session ${n} source interface ${longIf(p)}${s.dir && s.dir !== 'both' ? ` ${s.dir}` : ''}`);
      for (const v of s.srcVlans || []) L.push(`monitor session ${n} source vlan ${v}`);
      if (s.srcRemote != null) L.push(`monitor session ${n} source remote vlan ${s.srcRemote}`);
      if (s.dst) L.push(`monitor session ${n} destination interface ${longIf(s.dst)}`);
      if (s.dstRemote != null) L.push(`monitor session ${n} destination remote vlan ${s.dstRemote}`);
    }
    for (const [n, a] of Object.entries(d.eem || {})) {
      L.push(`event manager applet ${n}`, ...(a.event ? [` event ${a.event.k === 'none' ? 'none' : a.event.k === 'syslog' ? `syslog pattern "${a.event.pat}"` : `track ${a.event.id} state ${a.event.state}`}`] : []));
      for (const ac of a.actions) L.push(ac.msg != null ? ` action ${ac.id} syslog msg "${ac.msg}"` : ` action ${ac.id} cli command "${ac.cli}"`);
      L.push('!');
    }
    for (const [k, v] of Object.entries(d.aaa?.authz || {})) L.push(`aaa authorization ${k} ${v.list} ${v.methods}`);
    for (const [k, v] of Object.entries(d.aaa?.acct || {})) L.push(`aaa accounting ${k} ${v.list} ${v.methods}`);
    for (const p of d.privCmds || []) L.push(`privilege exec level ${p.level} ${p.cmd}`);
    if (d.netconf) L.push('netconf-yang');
    if (d.restconf) L.push('restconf');
    for (const r of d.routes || []) if (r.vrf) L.push(`ip route vrf ${r.vrf} ${r.net} ${prefixToMask(r.prefix)} ${r.iface ? longIf(r.iface) : r.nh}`);
    return L;
  }
  function ifLines(f) {
    const L = [];
    if (f.policy) L.push(` ip policy route-map ${f.policy}`);
    if (f.eigrp6) L.push(` ipv6 eigrp ${f.eigrp6}`);
    if (f.ospfAuth) L.push(` ip ospf authentication${f.ospfAuth === 'md5' ? ' message-digest' : f.ospfAuth === 'null' ? ' null' : f.ospfAuth === 'chain' ? ` key-chain ${f.ospfChain}` : ''}`);
    if (f.ospfMtuIgnore) L.push(' ip ospf mtu-ignore');
    if (f.ipMtu != null) L.push(` ip mtu ${f.ipMtu}`);
    if (f.ospf6Auth) L.push(` ospfv3 authentication ${f.ospf6Auth}`);
    if (f.ospfKey) L.push(` ip ospf authentication-key ${f.ospfKey}`);
    if (f.ospfMd5) L.push(` ip ospf message-digest-key ${f.ospfMd5.id} md5 ${f.ospfMd5.key}`);
    if (f.dly != null) L.push(` delay ${f.dly}`);
    if (f.eigrpAuth?.mode) L.push(` ip authentication mode eigrp ${f.eigrpAuth.as} md5`);
    if (f.eigrpAuth?.chain) L.push(` ip authentication key-chain eigrp ${f.eigrpAuth.as} ${f.eigrpAuth.chain}`);
    for (const g of f.eigrpSummaries || []) L.push(` ip summary-address eigrp ${f.eigrpSumAs} ${g.net} ${prefixToMask(g.prefix)}`);
    if (f.eigrpNoSH) L.push(` no ip split-horizon eigrp ${f.eigrpShAs}`);
    if (f.eigrpNoNhs) L.push(` no ip next-hop-self eigrp ${f.eigrpShAs}`);
    if (f.urpf) L.push(` ip verify unicast source reachable-via ${f.urpf.mode}${f.urpf.allowDefault ? ' allow-default' : ''}`);
    if (f.qosIn) L.push(` service-policy input ${f.qosIn}`);
    if (f.qosOut) L.push(` service-policy output ${f.qosOut}`);
    if (f.flow?.in) L.push(f.flow.in === 'legacy' ? ' ip flow ingress' : ` ip flow monitor ${f.flow.in} input`);
    if (f.flow?.out) L.push(f.flow.out === 'legacy' ? ' ip flow egress' : ` ip flow monitor ${f.flow.out} output`);
    if (f.bfd) L.push(` bfd interval ${f.bfd.tx} min_rx ${f.bfd.rx} multiplier ${f.bfd.mult}`);
    if (f.dhcp6Server) L.push(` ipv6 dhcp server ${f.dhcp6Server}`);
    if (f.dhcp6Relay) L.push(` ipv6 dhcp relay destination ${f.dhcp6Relay}`);
    if (f.tunMode === 'mgre') L.push(' tunnel mode gre multipoint');
    if (f.tunKey != null) L.push(` tunnel key ${f.tunKey}`);
    if (f.tunProtect) L.push(` tunnel protection ipsec profile ${f.tunProtect}`);
    const h = f.nhrp;
    if (h) {
      if (h.auth) L.push(` ip nhrp authentication ${h.auth}`);
      if (h.id != null) L.push(` ip nhrp network-id ${h.id}`);
      for (const ip of h.nhs || []) L.push(` ip nhrp nhs ${ip}`);
      for (const [k, v] of Object.entries(h.map || {})) L.push(` ip nhrp map ${k} ${v}`);
      for (const ip of h.mcast || []) L.push(` ip nhrp map multicast ${ip}`);
      if (h.mcastDyn) L.push(' ip nhrp map multicast dynamic');
      if (h.redirect) L.push(' ip nhrp redirect');
      if (h.shortcut) L.push(' ip nhrp shortcut');
    }
    return L;
  }
  function ospfLines(o) {
    const L = [];
    for (const [a, c0] of Object.entries(o.areas || {})) {
      if (c0.type) L.push(` area ${a} ${c0.type}${c0.noSummary ? ' no-summary' : c0.nssaDefault ? ' default-information-originate' : ''}`);
      if (c0.auth) L.push(` area ${a} authentication${c0.auth === 'md5' ? ' message-digest' : ''}`);
      for (const g of c0.ranges || []) L.push(` area ${a} range ${g.net} ${prefixToMask(g.prefix)}${g.hide ? ' not-advertise' : ''}`);
      if (c0.flIn) L.push(` area ${a} filter-list prefix ${c0.flIn} in`);
      if (c0.flOut) L.push(` area ${a} filter-list prefix ${c0.flOut} out`);
    }
    for (const v of o.vlinks || []) {
      L.push(` area ${v.area} virtual-link ${v.rid}`);
      if (v.auth) L.push(` area ${v.area} virtual-link ${v.rid} authentication${v.auth === 'md5' ? ' message-digest' : v.auth === 'null' ? ' null' : ''}`);
      if (v.key) L.push(` area ${v.area} virtual-link ${v.rid} authentication-key ${v.key}`);
      if (v.md5) L.push(` area ${v.area} virtual-link ${v.rid} message-digest-key ${v.md5.id} md5 ${v.md5.key}`);
    }
    for (const g of o.summaries || []) L.push(` summary-address ${g.net} ${prefixToMask(g.prefix)}${g.hide ? ' not-advertise' : ''}`);
    for (const n of o.nbrs || []) L.push(` neighbor ${n}`);
    if (o.refBw != null) L.push(` auto-cost reference-bandwidth ${o.refBw}`);
    if (o.distance != null) L.push(` distance ${o.distance}`);
    if (o.distanceBy) L.push(` distance ospf ${Object.entries(o.distanceBy).map(([k, v]) => `${k} ${v}`).join(' ')}`);
    if (o.distList) L.push(distText(o.distList));
    if (o.bfd) L.push(' bfd all-interfaces');
    return L;
  }
  const distText = (l) => ` distribute-list ${l.pl ? `prefix ${l.pl}` : l.rm ? `route-map ${l.rm}` : l.acl} in`;
  function eigrpLines(e) {
    const L = [];
    if (e.stub) L.push(` eigrp stub ${e.stub.join(' ')}`);
    if (e.variance > 1) L.push(` variance ${e.variance}`);
    if (e.k) L.push(` metric weights ${e.k}`);
    if (e.distanceInt != null) L.push(` distance eigrp ${e.distanceInt} ${e.distanceExt}`);
    if (e.distList) L.push(distText(e.distList));
    return L;
  }
  /** Named mode: khối af-interface, topology nằm trong address-family. */
  function eigrpNamed(e) {
    const L = [`router eigrp ${e.named}`, ` address-family ipv4${e.vrf ? ` vrf ${e.vrf}` : ' unicast'} autonomous-system ${e.as}`];
    for (const s of e.networks) L.push(`  network ${s.net}${s.wild ? ' ' + s.wild : ''}`);
    if (e.stub) L.push(`  eigrp stub ${e.stub.join(' ')}`);
    for (const [n, a] of Object.entries(e.afIf || {})) {
      L.push(`  af-interface ${n === 'default' ? 'default' : longIf(n)}`);
      if (a.passive) L.push('   passive-interface');
      if (a.auth?.mode) L.push(`   authentication mode ${a.auth.mode}`);
      if (a.auth?.chain) L.push(`   authentication key-chain ${a.auth.chain}`);
      for (const g of a.summaries || []) L.push(`   summary-address ${g.net} ${prefixToMask(g.prefix)}`);
      if (a.noSH) L.push('   no split-horizon');
      if (a.noNhs) L.push('   no next-hop-self');
      L.push('  exit-af-interface');
    }
    if (e.variance > 1) L.push('  topology base', `   variance ${e.variance}`, '  exit-af-topology');
    L.push(' exit-address-family', '!');
    return L;
  }
  function bgpLines(b) {
    const L = [];
    for (const [k, t] of [['asDot', 'bgp asnotation dot'], ['alwaysMed', 'bgp always-compare-med'], ['asPathIgnore', 'bgp bestpath as-path ignore'], ['medWorst', 'bgp bestpath med missing-as-worst'], ['cmpRid', 'bgp bestpath compare-routerid']]) if (b[k]) L.push(` ${t}`);
    for (const [g, o] of Object.entries(b.groups || {})) { L.push(` neighbor ${g} peer-group`); L.push(...nbrAttrs(g, o)); }
    for (const [ip, n] of Object.entries(b.neighbors)) { if (n.group) L.push(` neighbor ${ip} peer-group ${n.group}`); L.push(...nbrAttrs(ip, n, true)); }
    for (const g of b.aggregates || []) L.push(` aggregate-address ${g.net} ${prefixToMask(g.prefix)}${g.summaryOnly ? ' summary-only' : ''}`);
    for (const [k, v] of Object.entries(b.redist || {})) L.push(` redistribute ${k}${v.id != null ? ` ${v.id}` : ''}${v.routeMap ? ` route-map ${v.routeMap}` : ''}`);
    if (b.distanceE != null) L.push(` distance bgp ${b.distanceE} ${b.distanceI} 200`);
    if (b.v6) {
      for (const [ip, n] of Object.entries(b.v6.neighbors)) L.push(` neighbor ${ip} remote-as ${n.remoteAs}`);
      L.push(' address-family ipv6');
      for (const p of b.v6.networks) L.push(`  network ${p.net}/${p.prefix}`);
      for (const [ip, n] of Object.entries(b.v6.neighbors)) {
        if (n.active) L.push(`  neighbor ${ip} activate`);
        if (n.nextHopSelf) L.push(`  neighbor ${ip} next-hop-self`);
        if (n.removePrivate) L.push(`  neighbor ${ip} remove-private-as`);
      }
      L.push(' exit-address-family');
    }
    return L;
  }
  function nbrAttrs(k, n, memberOnly) {
    const L = [];
    if (!memberOnly && n.remoteAs != null) L.push(` neighbor ${k} remote-as ${n.remoteAs}`);
    if (!memberOnly && n.updateSource) L.push(` neighbor ${k} update-source ${longIf(n.updateSource)}`);
    if (!memberOnly && n.nextHopSelf) L.push(` neighbor ${k} next-hop-self`);
    if (n.rrClient) L.push(` neighbor ${k} route-reflector-client`);
    if (n.multihop) L.push(` neighbor ${k} ebgp-multihop ${n.multihop}`);
    if (n.password) L.push(` neighbor ${k} password ${n.password}`);
    if (n.timers) L.push(` neighbor ${k} timers ${n.timers.join(' ')}`);
    if (n.removePrivate) L.push(` neighbor ${k} remove-private-as${n.removePrivate === 'all' ? ' all' : ''}`);
    if (n.noConnCheck) L.push(` neighbor ${k} disable-connected-check`);
    if (n.ttlSec) L.push(` neighbor ${k} ttl-security hops ${n.ttlSec}`);
    if (n.allowasIn) L.push(` neighbor ${k} allowas-in ${n.allowasIn}`);
    if (n.asOverride) L.push(` neighbor ${k} as-override`);
    if (n.maxPrefix) L.push(` neighbor ${k} maximum-prefix ${n.maxPrefix.max}${n.maxPrefix.thr ? ` ${n.maxPrefix.thr}` : ''}${n.maxPrefix.warnOnly ? ' warning-only' : ''}`);
    if (n.sendCommunity) L.push(` neighbor ${k} send-community`);
    if (n.softIn) L.push(` neighbor ${k} soft-reconfiguration inbound`);
    if (n.shutdown) L.push(` neighbor ${k} shutdown`);
    if (n.weight != null) L.push(` neighbor ${k} weight ${n.weight}`);
    for (const [f, w, d] of [['rmIn', 'route-map', 'in'], ['rmOut', 'route-map', 'out'], ['plIn', 'prefix-list', 'in'], ['plOut', 'prefix-list', 'out'], ['flIn', 'filter-list', 'in'], ['flOut', 'filter-list', 'out']]) if (n[f]) L.push(` neighbor ${k} ${w} ${n[f]} ${d}`);
    return L;
  }

  // ---------- gắn vào bảng của ios.js ----------
  T.CFG_ROUTER.push(...CFG_X);
  T.CFG_SWITCH.push(...CFG_X);
  T.IF_ROUTER.push(...IF_X);
  T.IF_SVI.push(...IF_X.filter((e) => /^(no )?(ip (vrf|ospf|policy|verify|authentication|summary|split)|vrf|delay|standby|service-policy|bfd|ipv6 dhcp)/.test(e.spec)));
  T.OSPF_MODE.push(...OSPF_X);
  T.EIGRP_MODE.push(...EIGRP_X);
  T.BGP_MODE.push(...BGP6_X, ...BGP_X); // BGP6_X trước vì <word> của BGP_X cũng khớp địa chỉ IPv6
  T.LINE_MODE.push(...LINE_X);
  T.VLAN_MODE.push(c('remote-span', (x) => { x.d.rspanVlans = [...new Set([...(x.d.rspanVlans || []), ...x.s.vlans])]; return R([]); }));
  T.SHOW_ROUTER.push(...SHOW_X);
  T.SHOW_SWITCH.push(...SHOW_X);
  T.EXEC_PRIV.push(...EXEC_X);
  const CFG_RP = [
    c('router ospf <num> vrf <word>', (x) => {
      if (!x.d.vrfs?.[x.a[1]]) return R([`% VRF ${x.a[1]} not configured`]);
      // shortcut: mỗi router chỉ một tiến trình OSPF nên một VRF, cần nhiều VRF thì tách d.ospf theo VRF
      if (!x.d.ospf) x.d.ospf = N.newOspf(x.a[0]);
      else if (x.d.ospf.pid !== x.a[0]) return R([`% Lab: thiết bị này đã chạy OSPF process ${x.d.ospf.pid}.`]);
      x.d.ospf.vrf = x.a[1];
      x.s.mode = 'router'; x.s.rp = 'ospf';
      return R([]);
    }),
    c('router eigrp <word>', (x) => { if (/^\d+$/.test(x.a[0])) return T.routerEigrp(x); x.s.eName = x.a[0]; x.s.mode = 'enamed'; return R([]); }),
  ];
  T.CFG_ROUTER.push(...CFG_RP, c('ipv6 router eigrp <num>', go('eigrp6', (x) => e6Open(x, x.a[0]))));
  T.CFG_SWITCH.push(...CFG_RP);
  let eaf = null;
  return {
    running, ifLines, ospfLines, eigrpLines, eigrpNamed, bgpLines, eemTick,
    modes: {
      vrf: VRF_MODE, rmap: RMAP_MODE, keychain: KEYCHAIN_MODE, key: KEY_MODE, trange: TR_MODE, qcmap: QCMAP_MODE, qpmap: QPMAP_MODE, qpmapc: QPMAPC_MODE, cpp: CPP_MODE, dhcp6: DHCP6_MODE,
      frec: FREC_MODE, fexp: FEXP_MODE, fmon: FMON_MODE, erspan: ERSPAN_MODE, erspand: ERSPAND_MODE, sla: SLA_MODE, track: TRACK_MODE, eem: EEM_MODE, ipsecp: IPSECP_MODE,
      enamed: ENAMED_MODE, eafif: EAFIF_MODE, etopo: ETOPO_MODE, eigrp6: E6_MODE, eaf6: EAF6_MODE, eaf6if: EAF6IF_MODE, bgpaf6: BGPAF6_MODE, mdt: MDT_MODE,
      get eaf() { return (eaf ||= EAF_MODE()); },
    },
    prompts: { vrf: 'config-vrf', rmap: 'config-route-map', keychain: 'config-keychain', key: 'config-keychain-key', trange: 'config-time-range', qcmap: 'config-cmap', qpmap: 'config-pmap', qpmapc: 'config-pmap-c', cpp: 'config-cp', dhcp6: 'config-dhcpv6', frec: 'config-flow-record', fexp: 'config-flow-exporter', fmon: 'config-flow-monitor', erspan: 'config-mon-erspan-src', erspand: 'config-mon-erspan-src-dst', sla: 'config-ip-sla-echo', track: 'config-track', eem: 'config-applet', ipsecp: 'ipsec-profile', enamed: 'config-router', eaf: 'config-router-af', eafif: 'config-router-af-interface', etopo: 'config-router-af-topology', eigrp6: 'config-rtr', eaf6: 'config-router-af', eaf6if: 'config-router-af-interface', bgpaf6: 'config-router-af', mdt: 'config-mdt-subs' },
  };
}
