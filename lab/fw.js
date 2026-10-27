// lab/fw.js — lõi FIREWALL STATEFUL dùng chung cho mọi "hãng" trong Lab CLI.
//
// Thiết bị firewall là router (định tuyến, ARP, NAT dùng lại của net.js) có thêm `d.fw`:
//   d.fw.kind = 'asa'    → Cisco ASA: nameif + security-level trên cổng, ACL "access-group ... in interface"
//                          ghi đè security-level, mặc định KHÔNG inspect ICMP (ping ra ngoài không có reply).
//               'zbf'    → Cisco IOS Zone-Based Firewall: zone trên cổng, zone-pair + policy-map type inspect
//                          (inspect = stateful, pass = 1 chiều, drop), cổng ngoài zone không nói chuyện với zone.
//               'policy' → firewall "rule base" (FortiGate, Palo Alto, Sophos, Check Point, pfSense...):
//                          danh sách rule theo thứ tự (vùng/cổng nguồn-đích, địa chỉ, dịch vụ, accept/deny,
//                          NAT nguồn theo rule), deny ngầm định cuối.
// Stateful: lượt ĐI được phép → ghi phiên; gói TRẢ LỜI khớp phiên được qua mà không xét rule (kể cả ACL
// chiều vào của cổng ngoài). Bảng phiên sống trong 1 lần gửi gói (ctx) và được lưu lại để "show conn".

import { aclEval, inNet } from './net.js';

const L4 = (p) => p.proto === 'tcp' || p.proto === 'udp';
const key = (d, proto, src, dst, port) => `${d.id}|${proto}|${src}|${dst}|${port ?? ''}`;
const fwdKey = (d, p) => key(d, p.proto, p.src, p.dst, L4(p) ? p.dport : null);
const revKey = (d, p) => key(d, p.proto, p.dst, p.src, L4(p) ? p.sport : null);
export const zoneOf = (d, ifn) => (d.fw?.kind === 'asa' ? d.ifaces[ifn]?.nameif : d.ifaces[ifn]?.zone) || null;

/** Gói trả lời thuộc 1 phiên đã được firewall cho đi (stateful) không. */
export function fwEstablished(ctx, d, pkt) {
  return !!pkt.reply && !!ctx.fwSess?.has(revKey(d, pkt));
}

// ---------------------------------------------------------------- khớp địa chỉ / dịch vụ (rule base)
/** spec: 'any' | { any } | { net, prefix } | { host } | { from, to } (dải) | mảng các spec. */
export function addrIn(ip, spec) {
  if (spec == null || spec === 'any' || spec.any) return true;
  if (Array.isArray(spec)) return spec.length === 0 || spec.some((s) => addrIn(ip, s));
  if (spec.host) return ip === spec.host;
  if (spec.net) return inNet(ip, spec.net, spec.prefix);
  if (spec.from) { const n = (x) => x.split('.').reduce((a, b) => a * 256 + +b, 0); return n(ip) >= n(spec.from) && n(ip) <= n(spec.to); }
  return false;
}
/** svc: 'any' | { proto, port?, port2? } | mảng. proto 'ip' = mọi giao thức. */
export function svcIn(p, svc) {
  if (svc == null || svc === 'any') return true;
  if (Array.isArray(svc)) return svc.length === 0 || svc.some((s) => svcIn(p, s));
  if (svc.proto && svc.proto !== 'ip' && svc.proto !== p.proto) return false;
  if (svc.port == null) return true;
  if (!L4(p)) return false;
  return svc.port2 != null ? p.dport >= svc.port && p.dport <= svc.port2 : p.dport === svc.port;
}
const inList = (v, list) => list == null || list === 'any' || (Array.isArray(list) ? list.length === 0 || list.includes('any') || list.includes(v) : list === v);

// ---------------------------------------------------------------- 3 kiểu firewall
function asaCheck(d, pkt, inIf, outIf) {
  const fi = d.ifaces[inIf], fo = d.ifaces[outIf];
  if (!fi.nameif || !fo.nameif) return { allow: false, why: `ASA chỉ chuyển gói giữa các cổng đã có "nameif" (${!fi.nameif ? inIf : outIf} chưa đặt tên) → bỏ` };
  const stateful = L4(pkt) || (pkt.proto === 'icmp' && !!d.fw.inspectIcmp);
  if (fi.aclIn) return { allow: true, stateful, why: `ACL "${fi.aclIn}" (access-group in interface ${fi.nameif}) cho phép` }; // ACL đã xét (deny thì walk đã hủy)
  const a = fi.secLevel ?? 0, b = fo.secLevel ?? 0;
  if (a > b) return { allow: true, stateful, why: `${fi.nameif} (security-level ${a}) → ${fo.nameif} (${b}): từ mức CAO xuống THẤP được phép mặc định` };
  if (a === b && d.fw.sameSec) return { allow: true, stateful, why: `cùng security-level ${a}, đã "same-security-traffic permit inter-interface"` };
  return { allow: false, why: `${fi.nameif} (security-level ${a}) → ${fo.nameif} (${b}): ${a === b ? 'CÙNG mức — mặc định bị chặn (cần same-security-traffic permit inter-interface)' : 'từ mức THẤP lên CAO bị chặn'} và cổng ${fi.nameif} chưa có ACL cho phép (access-group ... in interface ${fi.nameif})` };
}
function zbfCheck(d, pkt, inIf, outIf) {
  const zi = zoneOf(d, inIf), zo = zoneOf(d, outIf);
  if (!zi && !zo) return { allow: true, why: 'cả 2 cổng không thuộc zone nào' };
  if (!zi || !zo) return { allow: false, why: `${!zi ? inIf : outIf} KHÔNG thuộc zone nào còn ${!zi ? outIf : inIf} thuộc zone "${zi || zo}" → ZBF chặn mọi gói giữa cổng có zone và cổng không zone` };
  if (zi === zo) return { allow: true, why: `cùng zone "${zi}" — được phép mặc định` };
  const z = d.zbf || {};
  const pair = (z.pairs || []).find((p) => p.src === zi && p.dst === zo);
  if (!pair || !pair.policy) return { allow: false, why: `không có zone-pair ${zi} → ${zo} (hoặc chưa service-policy) → mặc định DROP` };
  const pm = z.policyMaps?.[pair.policy];
  if (!pm) return { allow: false, why: `policy-map "${pair.policy}" chưa tồn tại` };
  for (const e of pm) {
    if (e.cls !== 'class-default' && !cmMatch(d, z.classMaps?.[e.cls], pkt)) continue;
    const act = e.action || (e.cls === 'class-default' ? 'drop' : 'drop');
    if (act === 'drop') return { allow: false, why: `zone-pair ${pair.name}: class ${e.cls} → drop` };
    return { allow: true, stateful: act === 'inspect', why: `zone-pair ${pair.name}: class ${e.cls} → ${act}${act === 'pass' ? ' (KHÔNG stateful — chiều về cần rule pass riêng)' : ''}` };
  }
  return { allow: false, why: `zone-pair ${pair.name}: không class nào khớp → class-default drop` };
}
const PROTO_SVC = { icmp: { proto: 'icmp' }, tcp: { proto: 'tcp' }, udp: { proto: 'udp' }, http: { proto: 'tcp', port: 80 }, https: { proto: 'tcp', port: 443 }, dns: { proto: 'udp', port: 53 }, ssh: { proto: 'tcp', port: 22 }, telnet: { proto: 'tcp', port: 23 }, ftp: { proto: 'tcp', port: 21 }, smtp: { proto: 'tcp', port: 25 } };
function cmMatch(d, cm, pkt) {
  if (!cm || !cm.matches.length) return false;
  const one = (m) => (m.protocol ? svcIn(pkt, PROTO_SVC[m.protocol] || { proto: m.protocol }) : m.acl ? aclEval(d, m.acl, pkt, false).action === 'permit' : false);
  return cm.all ? cm.matches.every(one) : cm.matches.some(one);
}
function policyCheck(d, pkt, inIf, outIf) {
  const zi = zoneOf(d, inIf) || inIf, zo = zoneOf(d, outIf) || outIf;
  for (const r of d.fw.rules || []) {
    if (r.disabled) continue;
    if (!inList(zi, r.from) || !inList(zo, r.to)) continue;
    if (!addrIn(pkt.src, r.src) || !addrIn(pkt.dst, r.dst) || !svcIn(pkt, r.svc)) continue;
    const label = `${d.fw.ruleWord || 'rule'} "${r.name ?? r.id}"`;
    if (r.action === 'deny' || r.action === 'drop' || r.action === 'reject') return { allow: false, rule: r, why: `${label} (${zi} → ${zo}) → ${r.action.toUpperCase()}` };
    return { allow: true, stateful: true, rule: r, snat: r.nat ? r.natIp || 'iface' : null, why: `${label} (${zi} → ${zo}) → ACCEPT${r.nat ? ' + NAT nguồn' : ''}` };
  }
  return { allow: false, why: `không ${d.fw.ruleWord || 'rule'} nào khớp ${zi} → ${zo} ${pkt.src} → ${pkt.dst}${L4(pkt) ? ':' + pkt.dport : ''} → ${d.fw.implicitWord || 'deny ngầm định (implicit deny)'}` };
}

/**
 * Firewall xét 1 gói đi qua (inIf → outIf, địa chỉ là địa chỉ THẬT — sau NAT chiều vào, trước NAT chiều ra).
 * Trả { allow, why, stateful, snat }. Gói trả lời của phiên đã mở luôn được qua.
 */
export function fwCheck(ctx, d, pkt, inIf, outIf) {
  if (fwEstablished(ctx, d, pkt)) return { allow: true, established: true, why: 'gói TRẢ LỜI thuộc phiên đã mở (stateful) → cho qua, không xét rule' };
  const k = d.fw.kind;
  const v = k === 'asa' ? asaCheck(d, pkt, inIf, outIf) : k === 'zbf' ? zbfCheck(d, pkt, inIf, outIf) : policyCheck(d, pkt, inIf, outIf);
  if (v.allow && v.stateful) {
    (ctx.fwSess ||= new Set()).add(fwdKey(d, pkt));
    if (ctx.record) (ctx.fwConns ||= []).push({ rid: d.id, proto: pkt.proto, src: pkt.src, dst: pkt.dst, dport: L4(pkt) ? pkt.dport : null, sport: L4(pkt) ? pkt.sport : null, inIf, outIf });
  }
  return v;
}
/** Lưu phiên (sau 1 lần gửi gói có record) vào d.fw.conns để "show conn" / "get system session list". */
export function persistFw(net, ctx) {
  for (const c of ctx.fwConns || []) {
    const d = net.devices[c.rid];
    if (!d?.fw) continue;
    const list = (d.fw.conns ||= []);
    const same = (x) => x.proto === c.proto && x.src === c.src && x.dst === c.dst && x.dport === c.dport;
    if (!list.some(same)) list.push({ proto: c.proto, src: c.src, dst: c.dst, dport: c.dport, sport: c.sport, inIf: c.inIf, outIf: c.outIf });
    if (list.length > 40) list.shift();
  }
}
/** NAT nguồn do rule firewall yêu cầu (FortiGate "set nat enable", Sophos MASQ...): PAT ra IP cổng ra / IP chỉ định. */
export function fwSnat(ctx, d, pkt, outIf, natIp) {
  const gip = natIp && natIp !== 'iface' ? natIp : d.ifaces[outIf]?.ip;
  if (!gip) return null;
  const port = pkt.proto === 'icmp' ? pkt.icmpId : pkt.sport;
  const e = { rid: d.id, proto: pkt.proto, il: pkt.src, ig: gip, port, outside: pkt.dst, stat: false, pool: null };
  ctx.nat.push(e);
  pkt.src = gip;
  return e;
}
