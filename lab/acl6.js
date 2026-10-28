// lab/acl6.js — ACL IPv6 (ipv6 access-list NAME + ipv6 traffic-filter NAME in|out): luôn đặt tên, mỗi dòng có
// sequence, cuối danh sách có ngầm định "permit icmp any any nd-na / nd-ns" và "deny ipv6 any any".
// Engine IPv6 (lab/net6.js) gọi acl6Eval khi gói đi vào / ra cổng router.
import { parse6, norm6, in6, net6, parsePrefix6 } from './ip6.js';

const PORTS = { www: 80, http: 80, telnet: 23, ssh: 22, ftp: 21, smtp: 25, domain: 53, https: 443, snmp: 161 };
const ICMP6 = ['echo-request', 'echo-reply', 'nd-na', 'nd-ns', 'router-advertisement', 'router-solicitation', 'unreachable', 'packet-too-big', 'time-exceeded'];
const up = (s) => String(s).toUpperCase();

/** Đọc địa chỉ ở words[i]: any | host X | X/len. Trả [addr, số từ đã dùng] hoặc null. */
function addr(words, i) {
  const w = words[i];
  if (w === 'any') return [{ any: true }, 1];
  if (w === 'host' && parse6(words[i + 1] || '')) return [{ ip: norm6(words[i + 1]), len: 128 }, 2];
  const p = parsePrefix6(w || '');
  if (p) return [{ ip: net6(p.ip, p.prefix), len: p.prefix }, 1];
  return null;
}
/**
 * Một dòng ACE: [action, proto, src, dst, (icmp-type | eq <port>)?, log?]. Trả ACE hoặc { error }.
 * proto: ipv6 | icmp | tcp | udp.
 */
export function parseAce6(words) {
  const [action, proto0] = words;
  if (action !== 'permit' && action !== 'deny') return { error: '% Invalid input: cần permit hoặc deny' };
  const proto = proto0 === 'icmpv6' ? 'icmp' : proto0;
  if (!['ipv6', 'icmp', 'tcp', 'udp'].includes(proto)) return { error: '% Invalid input: giao thức ipv6 | icmp | tcp | udp' };
  let i = 2;
  const s = addr(words, i); if (!s) return { error: '% Invalid input: nguồn phải là any | host <IPv6> | <prefix>/<len>' };
  i += s[1];
  const d = addr(words, i); if (!d) return { error: '% Invalid input: đích phải là any | host <IPv6> | <prefix>/<len>' };
  i += d[1];
  const e = { action, proto, src: s[0], dst: d[0] };
  for (; i < words.length; i++) {
    const w = words[i];
    if (w === 'log') e.log = true;
    else if (proto === 'icmp' && ICMP6.includes(w)) e.icmp = w;
    else if ((proto === 'tcp' || proto === 'udp') && w === 'eq' && words[i + 1]) { const p = PORTS[words[i + 1]] ?? +words[i + 1]; if (!(p > 0)) return { error: '% Invalid input: số port' }; e.port = p; e.portName = words[i + 1]; i++; }
    else return { error: `% Invalid input detected at '${w}'` };
  }
  return e;
}
const addrText = (a) => (a.any ? 'any' : a.len === 128 ? `host ${up(a.ip)}` : `${up(a.ip)}/${a.len}`);
export function ace6Text(e) {
  if (e.remark != null) return `remark ${e.remark}`;
  return `${e.action} ${e.proto} ${addrText(e.src)} ${addrText(e.dst)}${e.icmp ? ' ' + e.icmp : ''}${e.port ? ' eq ' + (e.portName || e.port) : ''}${e.log ? ' log' : ''}`;
}
const match = (a, ip) => a.any || (ip && in6(ip, a.ip, a.len));
/** pkt = { src, dst, proto: 'icmp'|'tcp'|'udp', icmp?: 'echo-request'|…, port? }. Trả { action, entry, implicit? }. */
export function acl6Eval(acl, pkt, record) {
  if (!acl) return { action: 'permit', missing: true }; // filter trỏ tới ACL chưa tạo = cho qua (như IOS)
  for (const e of acl.entries) {
    if (e.remark != null) continue;
    if (e.proto !== 'ipv6' && e.proto !== pkt.proto) continue;
    if (!match(e.src, pkt.src) || !match(e.dst, pkt.dst)) continue;
    if (e.icmp && e.icmp !== pkt.icmp) continue;
    if (e.port && e.port !== pkt.port) continue;
    if (record) e.matches = (e.matches || 0) + 1;
    return { action: e.action, entry: e };
  }
  return { action: 'deny', implicit: true };
}
/** Thêm / thay dòng theo sequence (mặc định = dòng cuối + 10). */
export function addAce6(acl, e, seq) {
  const last = acl.entries.reduce((m, x) => Math.max(m, x.seq || 0), 0);
  e.seq = seq ?? last + 10;
  acl.entries = [...acl.entries.filter((x) => x.seq !== e.seq), e].sort((a, b) => a.seq - b.seq);
}
export function showAcl6(acls, only) {
  const L = [];
  for (const [n, a] of Object.entries(acls || {})) {
    if (only && n !== only) continue;
    L.push(`IPv6 access list ${n}`, ...a.entries.map((e) => `    ${ace6Text(e)}${e.matches ? ` (${e.matches} match${e.matches > 1 ? 'es' : ''})` : ''} sequence ${e.seq}`));
  }
  return L;
}
export function acl6Running(acls) {
  return Object.entries(acls || {}).flatMap(([n, a]) => [`ipv6 access-list ${n}`, ...a.entries.map((e) => ` ${ace6Text(e)}`), '!']);
}
