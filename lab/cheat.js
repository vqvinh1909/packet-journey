// lab/cheat.js — "📋 Cheat sheet" tự sinh: gom các lệnh người học đã gõ THÀNH CÔNG (weak.cmds, ghi ở ui/weak.js khi
// làm lab) theo chủ đề và chế độ CLI, kèm mô tả ngắn tiếng Việt (bảng DESC của lab/ios.js) và một ví dụ đã gõ.
import { TOPIC_NAMES, MODE_PROMPT } from './weak.js';

const MODE_ORDER = ['user', 'priv', 'config', 'if', 'subif', 'range', 'vlan', 'line', 'router', 'bgp', 'ospf6', 'pool', 'acl-std', 'acl-ext'];
const MODE_NAME = { user: 'User EXEC', priv: 'Privileged EXEC', config: 'Global config', if: 'Interface', subif: 'Subinterface', range: 'Interface range', vlan: 'VLAN', line: 'Line (console/vty)', router: 'Router (OSPF/EIGRP)', bgp: 'Router BGP', ospf6: 'OSPFv3', pool: 'DHCP pool', 'acl-std': 'ACL standard', 'acl-ext': 'ACL extended', isakmp: 'ISAKMP policy', tset: 'Transform-set', cmap: 'Crypto map', zone: 'Security zone', mstcfg: 'MST config' };
export const modeName = (m) => MODE_NAME[m] || m || 'Khác';
export const modePrompt = (m) => (MODE_PROMPT[m] ? 'R' + MODE_PROMPT[m] : '');
const GENERIC = new Set(['brief', 'mode', 'ip', 'no', 'detail', 'all', 'summary']);
const isArg = (t) => /^[<{[]/.test(t);

/** Mô tả ngắn cho 1 mẫu lệnh (spec như "ip address <ip> <mask>"), dựa trên bảng mô tả từ khoá. */
export function describe(spec, desc = {}) {
  const toks = String(spec || '').split(' ').filter((t) => t && !isArg(t));
  if (!toks.length) return '';
  if (toks[0] === 'show' || toks[0] === 'do') return 'Xem ' + toks.slice(toks[0] === 'do' ? 2 : 1).join(' ');
  const neg = toks[0] === 'no';
  const words = neg ? toks.slice(1) : toks;
  let d = '';
  for (let i = words.length - 1; i >= 0 && !d; i--) if (!GENERIC.has(words[i]) && desc[words[i]]) d = desc[words[i]];
  if (!d) d = desc[words[0]] || '';
  return neg ? (d ? 'Gỡ / phủ định: ' + d.charAt(0).toLowerCase() + d.slice(1) : 'Gỡ lệnh') : d;
}

/**
 * cmds = weak.cmds ({ "mode|spec": { spec, mode, topic, n, ex, at } }). Trả
 * [{ topic, n, modes: [{ mode, items: [{ spec, ex, n, desc }] }] }] — chủ đề theo thứ tự TOPIC_NAMES, lệnh dùng
 * nhiều trước. topic = 'all' hoặc tên chủ đề để lọc; q = chuỗi tìm (khớp spec / ví dụ / mô tả).
 */
export function buildCheat(cmds, desc = {}, o = {}) {
  const q = String(o.q || '').toLowerCase().trim();
  const byTopic = new Map();
  for (const c of Object.values(cmds || {})) {
    if (!c?.spec) continue;
    const topic = c.topic || 'Khác';
    if (o.topic && o.topic !== 'all' && o.topic !== topic) continue;
    const it = { spec: c.spec, ex: c.ex || c.spec, n: c.n || 1, desc: describe(c.spec, desc), mode: c.mode || '' };
    if (q && ![it.spec, it.ex, it.desc].some((x) => x.toLowerCase().includes(q))) continue;
    if (!byTopic.has(topic)) byTopic.set(topic, new Map());
    const modes = byTopic.get(topic);
    if (!modes.has(it.mode)) modes.set(it.mode, []);
    modes.get(it.mode).push(it);
  }
  const order = (t) => { const i = TOPIC_NAMES.indexOf(t); return i < 0 ? 999 : i; };
  const mOrder = (m) => { const i = MODE_ORDER.indexOf(m); return i < 0 ? 99 : i; };
  return [...byTopic.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0], 'vi')).map(([topic, modes]) => ({
    topic,
    n: [...modes.values()].reduce((s, l) => s + l.length, 0),
    modes: [...modes.entries()].sort((a, b) => mOrder(a[0]) - mOrder(b[0])).map(([mode, items]) => ({ mode, items: items.sort((a, b) => b.n - a.n || a.spec.localeCompare(b.spec)) })),
  }));
}

/** Markdown rất gọn cho ô ghi chú lab: **đậm**, `mã`, dòng "- " thành gạch đầu dòng, xuống dòng giữ nguyên. */
export function miniMd(text) {
  const esc = (s) => s.replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const out = [];
  let list = false;
  for (const ln of String(text || '').split(/\r?\n/)) {
    const m = /^\s*[-*]\s+(.*)$/.exec(ln);
    if (m) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    out.push(ln.trim() ? `<p>${inline(ln)}</p>` : '');
  }
  if (list) out.push('</ul>');
  return out.join('');
}
