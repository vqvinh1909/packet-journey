// lab/policy.js — chính sách định tuyến dùng chung: prefix-list, route-map, as-path ACL, time-range, QoS MQC.
import { aclEval } from './net.js';

const n32 = (ip) => ip.split('.').reduce((a, b) => a * 256 + +b, 0);
const inPfx = (ip, net, p) => p === 0 || Math.floor(n32(ip) / 2 ** (32 - p)) === Math.floor(n32(net) / 2 ** (32 - p));

/** Prefix-list: dòng đầu tiên khớp quyết định, không khớp dòng nào thì deny. List chưa có thì permit, như IOS. */
export function plEval(d, name, net, prefix) {
  const list = d.prefixLists?.[name];
  if (!list) return true;
  for (const e of list) {
    if (prefix < e.prefix || !inPfx(net, e.net, e.prefix)) continue;
    const lo = e.ge ?? e.prefix, hi = e.le ?? (e.ge != null ? 32 : e.prefix);
    if (prefix >= lo && prefix <= hi) return e.action === 'permit';
  }
  return false;
}
/** Regex kiểu IOS, "_" là ranh giới. Mẫu sai trả null: một mẫu đã lưu không được làm hỏng mọi lần tính BGP. */
export function iosRegex(s) {
  try { return new RegExp(s.replace(/_/g, '(^| |$)')); } catch { return null; }
}
function asPathOk(d, name, asPath) {
  const list = d.asPathAcls?.[name];
  if (!list) return true;
  const s = asPath.join(' ');
  for (const e of list) if (iosRegex(e.re)?.test(s)) return e.action === 'permit';
  return false;
}
/** Community-list: dòng đầu tiên khớp quyết định, không khớp thì deny. Standard cần đủ mọi giá trị, expanded là regex. */
export function commOk(d, name, comm) {
  const have = comm || [];
  for (const e of d.commLists?.[name] || []) {
    const hit = e.expanded ? iosRegex(e.vals.join(' '))?.test(have.join(' ')) : e.vals.every((v) => have.includes(v));
    if (hit) return e.action === 'permit';
  }
  return false;
}
const matchRoute = (d, m, r) => {
  if (m.k === 'comm') return m.vals.some((n) => commOk(d, n, r.comm));
  if (m.k === 'pl') return m.vals.some((n) => plEval(d, n, r.net, r.prefix));
  if (m.k === 'acl') return m.vals.some((n) => aclEval(d, n, { src: r.net, dst: r.net, proto: 'ip' }).action === 'permit');
  if (m.k === 'tag') return m.vals.includes(r.tag ?? 0);
  if (m.k === 'metric') return m.vals.includes(r.metric ?? 0);
  if (m.k === 'aspath') return m.vals.some((n) => asPathOk(d, n, r.asPath || []));
  return false;
};
/** Route-map áp lên route: trả các set (có thể rỗng) nếu được phép, null nếu bị chặn. Map chưa có thì chặn hết. */
export function rmEval(d, name, r, record) {
  for (const e of d.routeMaps?.[name] || []) {
    if (!e.matches.every((m) => matchRoute(d, m, r))) continue;
    if (record) e.hits = (e.hits || 0) + 1;
    return e.action === 'permit' ? e.sets : null;
  }
  return null;
}
/** PBR: route-map áp lên gói. Không khớp hoặc dòng deny thì gói đi theo bảng định tuyến thường. */
export function rmPacket(d, name, pkt, record) {
  for (const e of d.routeMaps?.[name] || []) {
    if (!e.matches.every((m) => m.k === 'acl' && m.vals.some((n) => aclEval(d, n, pkt).action === 'permit'))) continue;
    if (record) e.pkts = (e.pkts || 0) + 1;
    return e.action === 'permit' ? e.sets : null;
  }
  return null;
}
export { asPathOk };

const PROTO = { O: 'ospf', D: 'eigrp', B: 'bgp' };
/** distribute-list và distance của từng giao thức khi route vào RIB của router. */
export function ribPolicy(d, rt) {
  const p = d[PROTO[rt.code[0]]];
  if (!p) return rt;
  if (p.distList) {
    const l = p.distList;
    if (l.pl ? !plEval(d, l.pl, rt.net, rt.prefix) : l.rm ? !rmEval(d, l.rm, rt) : aclEval(d, l.acl, { src: rt.net, dst: rt.net, proto: 'ip' }).action !== 'permit') return null;
  }
  let ad = rt.ad;
  if (rt.code[0] === 'O' && p.distance != null) ad = p.distance;
  if (rt.code[0] === 'O' && p.distanceBy) ad = p.distanceBy[/[EN]\d/.test(rt.code) ? 'external' : rt.code.includes('IA') ? 'inter-area' : 'intra-area'] ?? ad;
  if (rt.code[0] === 'D' && p.distanceInt != null) ad = rt.code === 'D EX' ? p.distanceExt : p.distanceInt;
  if (rt.code === 'B' && p.distanceE != null) ad = rt.ad === 20 ? p.distanceE : p.distanceI;
  return ad === rt.ad ? rt : { ...rt, ad };
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SETS = { daily: DAYS, weekdays: DAYS.slice(1, 6), weekend: ['Sat', 'Sun'] };
export const hm = (s) => { const [h, m] = s.split(':'); return +h * 60 + +m; };
/** Đồng hồ thiết bị mặc định Mon 12:00, khớp "show clock". "clock set" đổi giá trị này. */
export function timeActive(d, name) {
  const list = d.timeRanges?.[name];
  if (!list) return true;
  const now = d.clockNow || { day: 'Mon', min: 720 };
  return list.some((p) => (SETS[p.days[0]] || p.days).some((x) => x.slice(0, 3).toLowerCase() === now.day.toLowerCase()) && now.min >= p.from && now.min <= p.to);
}

/** QoS MQC: tìm class đầu tiên khớp gói, cuối cùng là class-default. */
export function qosEval(d, pname, pkt, record) {
  const pm = d.qos?.policies?.[pname];
  if (!pm) return null;
  const hit = (cn) => {
    const c = d.qos.classes[cn];
    if (!c) return false;
    const t = (m) => (m.k === 'any' ? true : m.k === 'acl' ? aclEval(d, m.v, pkt).action === 'permit' : m.k === 'dscp' ? (pkt.dscp || 'default') === m.v : false);
    return c.all ? c.matches.every(t) : c.matches.some(t);
  };
  const e = pm.find((x) => x.cls !== 'class-default' && hit(x.cls)) || pm.find((x) => x.cls === 'class-default');
  if (e && record) e.pkts = (e.pkts || 0) + 1;
  return e || null;
}
