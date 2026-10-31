// lab/ios.js — dòng lệnh giả lập Cisco IOS (router/switch) + cmd của PC kiểu Packet Tracer.
//
// Giống IOS thật ở những điểm người học hay gặp:
//   - Viết tắt từ khoá: "sh ip int br", "conf t", "int g0/0", "no shut", "sw mode acc".
//   - Báo lỗi đúng kiểu: "% Invalid input detected at '^' marker." (kèm dấu ^ đúng vị trí),
//     "% Incomplete command.", "% Ambiguous command".
//   - "?" trợ giúp theo ngữ cảnh; các chế độ (config-if, config-subif, config-router,
//     dhcp-config, config-ext-nacl, config-line, config-vlan, config-isakmp, config-crypto-map...);
//     gõ lệnh global ngay trong chế độ con (IOS tự thoát ra); "do show ..."; lọc "| include/section".
//   - Hỏi đáp tương tác như thật: enable secret, copy tftp: flash:, delete, reload, erase.
//   - Thông báo %LINK/%LINEPROTO/%OSPF-5-ADJCHG/%DUAL/%HSRP/%VRRP/%CDP-4-NATIVE_VLAN_MISMATCH.
// Mọi thay đổi ghi trực tiếp vào model `net` (lab/net.js) → mạng được tính lại thật.

import * as SN from './snmp.js';
import * as ACL6 from './acl6.js';
import * as N from './net.js';
import * as A6 from './ip6.js';
import * as V6 from './net6.js';
import { makeAsa } from './asa.js';
import { makeForti } from './fortios.js';
import { makePan } from './panos.js';
import { makeGuiFw } from './guifw.js';
import { makeWlc } from './wlc.js';
import { makeLinux, DNS_TYPES } from './linux.js';
import { makeNp } from './np.js';

const { longIf, shortIf, normIf, isIp, maskToPrefix, prefixToMask, netOf, ifSort } = N;

// ----------------------------------------------------------------------
// Tiện ích
// ----------------------------------------------------------------------
const pad = (s, n) => String(s ?? '').padEnd(n);
const lpad = (s, n) => String(s ?? '').padStart(n);
const R = (out, extra = {}) => ({ out, ...extra });
const IFS = (d) => N.l3ifs(d);

export function parseVlist(s) {
  const out = [];
  for (const part of String(s).split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return null;
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a < 1 || b > 4094 || b < a) return null;
    for (let v = a; v <= b; v++) if (!out.includes(v)) out.push(v);
  }
  return out.sort((x, y) => x - y);
}
export function fmtVlist(arr) {
  if (arr == null) return '1-4094';
  if (!arr.length) return 'none';
  const s = [...arr].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(j > i + 1 ? `${s[i]}-${s[j]}` : j === i + 1 ? `${s[i]},${s[j]}` : `${s[i]}`);
    i = j;
  }
  return parts.join(',');
}
// "Mật khẩu" hiển thị trong running-config
const XLAT = 'dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87';
function type7(pw) {
  const seed = 8;
  let s = String(seed).padStart(2, '0');
  for (let i = 0; i < pw.length; i++) s += (pw.charCodeAt(i) ^ XLAT.charCodeAt((seed + i) % XLAT.length)).toString(16).toUpperCase().padStart(2, '0');
  return s;
}
/** Giải mã mật khẩu type 7 (Cisco "mã hoá" yếu — chỉ là XOR, ai cũng giải được). */
function untype7(h) {
  const seed = parseInt(h.slice(0, 2), 10);
  let s = '';
  for (let i = 2; i + 1 < h.length; i += 2) s += String.fromCharCode(parseInt(h.slice(i, i + 2), 16) ^ XLAT.charCodeAt((seed + (i - 2) / 2) % XLAT.length));
  return s;
}
function md5ish(pw) {
  const al = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let h = 2166136261 >>> 0, s = '';
  for (let i = 0; i < 22; i++) { h = Math.imul(h ^ pw.charCodeAt(i % pw.length) ^ i, 16777619) >>> 0; s += al[h % 64]; }
  return `$1$mERr$${s}`;
}
/** Dán lại "secret 5 <hash>": nếu hash khớp mật khẩu hiện có thì giữ nguyên (không đảo ngược được MD5). */
const unhash = (hash, cur) => (cur && md5ish(cur) === hash ? cur : hash);
const pwShow = (d, p) => (d.servicePwEnc ? `7 ${type7(p)}` : p);
function parseIfRange(s) {
  const out = [];
  for (const part of s.replace(/\s+/g, '').split(',')) {
    const m = part.toLowerCase().match(/^([a-z-]+)(\d+\/(?:\d+\/)?)(\d+)(?:-(\d+))?$/);
    if (!m) return null;
    const a = +m[3], b = m[4] ? +m[4] : a;
    if (b < a) return null;
    for (let i = a; i <= b; i++) { const n = normIf(m[1] + m[2] + i); if (!n) return null; out.push(n); }
  }
  return out;
}
const flashName = (w) => String(w).replace(/^flash:\/?/i, '');

// ----------------------------------------------------------------------
// Bộ so khớp lệnh (grammar) — hỗ trợ viết tắt + phát hiện mơ hồ như IOS
// ----------------------------------------------------------------------
// Token: 'keyword' | '{a|b|c}' | '<ip>' '<ip6>' '<ip6p>' (IPv6/prefix) '<mask>' '<wild>' '<num>' '<word>' '<if>' '<vlist>' '<rest>'
function c(spec, fn) { return { toks: spec.split(' '), fn, spec }; }

function tok(t, words, wi) {
  const w = words[wi];
  const lw = w.toLowerCase();
  if (t[0] === '{') {
    const opts = t.slice(1, -1).split('|');
    if (opts.includes(lw)) return { kw: lw, val: lw, used: 1, exact: true };
    const m = opts.filter((o) => o.startsWith(lw));
    if (m.length === 1) return { kw: m[0], val: m[0], used: 1 };
    if (m.length > 1) return { amb: true };
    return null;
  }
  if (t[0] !== '<') {
    if (t === lw) return { kw: t, used: 1, exact: true };
    if (t.startsWith(lw)) return { kw: t, used: 1 };
    return null;
  }
  switch (t) {
    case '<ip>': case '<wild>': return isIp(w) ? { val: w, used: 1 } : null;
    case '<ip6>': { const v = A6.norm6(w); return v ? { val: v, used: 1 } : null; }
    case '<ip6p>': { const v = A6.parsePrefix6(w); return v ? { val: v, used: 1 } : null; }
    case '<mask>': try { maskToPrefix(w); return { val: w, used: 1 }; } catch { return null; }
    case '<num>': return /^\d+$/.test(w) ? { val: +w, used: 1 } : null;
    case '<word>': return { val: w, used: 1 };
    case '<vlist>': { const v = parseVlist(w); return v ? { val: v, used: 1 } : null; }
    case '<if>': {
      let n = normIf(w);
      if (n) return { val: n, used: 1 };
      if (words[wi + 1] != null && /^[a-z-]+$/i.test(w)) { n = normIf(w + words[wi + 1]); if (n) return { val: n, used: 2 }; }
      return null;
    }
    default: return null;
  }
}
function matchOne(toks, words) {
  const args = [], kwAt = {};
  let wi = 0, score = 0;
  for (let ti = 0; ti < toks.length; ti++) {
    const t = toks[ti];
    if (t === '<rest>') {
      if (wi >= words.length) return { inc: true, wi, kwAt };
      args.push(words.slice(wi).join(' '));
      wi = words.length;
      continue;
    }
    if (wi >= words.length) return { inc: true, wi, kwAt, next: t };
    const r = tok(t, words, wi);
    if (!r) return { fail: wi, kwAt };
    if (r.amb) return { amb: wi, kwAt };
    if (r.kw) { kwAt[wi] = r.kw; score += r.exact ? 2 : 1; }
    if ('val' in r) args.push(r.val);
    wi += r.used;
  }
  if (wi < words.length) return { fail: wi, kwAt };
  return { ok: true, args, score, kwAt };
}
function editDist(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return dp[b.length];
}
function parse(table, words) {
  const res = table.map((entry) => ({ entry, r: matchOne(entry.toks, words) }));
  const oks = res.filter((x) => x.r.ok).sort((a, b) => b.r.score - a.r.score);
  if (oks.length) {
    const hit = oks[0];
    // mơ hồ: một từ viết tắt khớp 2 từ khoá khác nhau ở cùng vị trí
    for (const [wiS, kw] of Object.entries(hit.r.kwAt)) {
      const wi = +wiS;
      if (words[wi].toLowerCase() === kw) continue;
      for (const o of res) {
        if (o === hit) continue;
        const k2 = o.r.kwAt[wi];
        if (!k2 || k2 === kw) continue;
        let samePrefix = true;
        for (let j = 0; j < wi; j++) if ((o.r.kwAt[j] || null) !== (hit.r.kwAt[j] || null)) { samePrefix = false; break; }
        if (samePrefix) return { err: 'amb' };
      }
    }
    return { hit: hit.entry, args: hit.r.args };
  }
  if (res.some((x) => x.r.amb != null)) return { err: 'amb' };
  if (res.some((x) => x.r.inc)) return { err: 'inc' };
  const at = Math.max(0, ...res.map((x) => x.r.fail ?? 0));
  return { err: 'inv', at };
}
function prefixMatch(toks, words) {
  let wi = 0;
  for (let ti = 0; ti < toks.length; ti++) {
    if (wi >= words.length) return { next: toks[ti] };
    if (toks[ti] === '<rest>') return { complete: true };
    const r = tok(toks[ti], words, wi);
    if (!r || r.amb) return null;
    wi += r.used;
  }
  return wi >= words.length ? { complete: true } : null;
}

// Mô tả tiếng Việt cho "?" (giúp người mới)
export const DESC = {
  show: 'Xem thông tin/trạng thái', configure: 'Vào chế độ cấu hình', ping: 'Gửi ICMP Echo kiểm tra thông mạng', traceroute: 'Dò đường đi từng chặng',
  enable: 'Vào chế độ đặc quyền (#) / đặt mật khẩu enable', disable: 'Về chế độ user (>)', exit: 'Thoát về chế độ trước', end: 'Về thẳng chế độ # (privileged EXEC)',
  interface: 'Chọn cổng để cấu hình', hostname: 'Đặt tên thiết bị', ip: 'Các lệnh IP', no: 'Phủ định / xoá một lệnh', router: 'Bật giao thức định tuyến',
  vlan: 'Tạo / cấu hình VLAN', switchport: 'Cấu hình cổng switch lớp 2', shutdown: 'Tắt cổng (administratively down)', description: 'Ghi chú cho cổng',
  access: 'Chế độ access / VLAN access', trunk: 'Chế độ trunk 802.1Q', mode: 'Đặt chế độ cổng', address: 'Gán địa chỉ IP', route: 'Định tuyến tĩnh / bảng định tuyến',
  network: 'Khai báo mạng tham gia định tuyến / mạng của pool DHCP', 'access-list': 'Tạo ACL đánh số', 'access-group': 'Áp ACL lên cổng', nat: 'Cấu hình NAT', standby: 'HSRP', vrrp: 'VRRP',
  telnet: 'Mở phiên Telnet', ssh: 'Mở phiên SSH', copy: 'Sao chép cấu hình / IOS', write: 'Ghi cấu hình vào NVRAM', 'running-config': 'Cấu hình đang chạy', brief: 'Dạng tóm tắt',
  'spanning-tree': 'Cấu hình STP', 'channel-group': 'Gộp cổng EtherChannel', encapsulation: 'Đóng gói (802.1Q / PPP / HDLC)', 'helper-address': 'DHCP relay',
  line: 'Cấu hình đường console/vty', username: 'Tạo tài khoản local', 'default-information': 'Quảng bá default route vào OSPF', 'passive-interface': 'Không gửi hello ra cổng này',
  'router-id': 'Đặt router ID', password: 'Đặt mật khẩu', login: 'Bắt đăng nhập', transport: 'Giao thức cho phép vào VTY', banner: 'Thông điệp đăng nhập', service: 'Dịch vụ hệ thống',
  crypto: 'Mã hoá: SSH (RSA) / VPN IPsec', 'domain-name': 'Tên miền (cần cho SSH)', clear: 'Xoá bảng/bộ đếm', vtp: 'VLAN Trunking Protocol', 'port-security': 'Giới hạn MAC trên cổng',
  'default-router': 'Gateway cấp cho client DHCP', 'dns-server': 'DNS cấp cho client DHCP', 'excluded-address': 'Dải không cấp qua DHCP', pool: 'Pool (DHCP / NAT)', do: 'Chạy lệnh EXEC trong chế độ cấu hình',
  'snmp-server': 'Cấu hình SNMP agent (giám sát thiết bị)', community: 'Chuỗi community SNMP v1/v2c', traps: 'Bản tin cảnh báo SNMP gửi tới NMS', cdp: 'Cisco Discovery Protocol', lldp: 'Link Layer Discovery Protocol (chuẩn mở IEEE 802.1AB)', transmit: 'Gửi bản tin LLDP ra cổng', receive: 'Nhận bản tin LLDP từ cổng', name: 'Đặt tên / ghi chú', 'private-vlan': 'Private VLAN', protected: 'Protected port (cổng cách ly)', boot: 'Chọn file IOS khi khởi động', reload: 'Khởi động lại thiết bị',
  dir: 'Liệt kê file', verify: 'Kiểm tra file (MD5)', delete: 'Xoá file', 'access-class': 'Giới hạn nguồn được vào VTY', ppp: 'Point-to-Point Protocol',
};
const PH = { '<ip>': 'A.B.C.D', '<wild>': 'A.B.C.D  (wildcard)', '<mask>': 'A.B.C.D  (subnet mask)', '<num>': '<0-4294967295>', '<word>': 'WORD', '<if>': '<interface>  vd g0/0, fa0/1, s0/0/0, g0/0.10', '<vlist>': 'WORD  danh sách VLAN (vd 10,20,30-35)', '<rest>': 'LINE' };

// ----------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------
export function createCli(net) {
  const sessions = {};
  const sess = (id) => (sessions[id] ||= { mode: 'user', ifs: [], vlans: [], acl: null, pool: null, line: null, rp: null, pw: null, tries: 0, loggedOut: false, user: null, ask: null, shown: {} });
  const ctxOf = () => N.makeCtx(net);
  const isRouter = (d) => d.type === 'router';
  const isL3 = (d) => N.isL3(d);

  // ================== Bảng lệnh: SHOW ==================
  const SHOW_COMMON = [
    c('show login', (x) => R(showLogin(x.d))),
    c('show logging', (x) => {
      const buf = [...(x.d.secLog || []), ...(x.d.logBuf || [])];
      return R(['Syslog logging: enabled (0 messages dropped, 0 messages rate-limited, 0 flushes, 0 overruns, xml disabled, filtering disabled)', '', 'No Active Message Discriminator.', '', '', 'No Inactive Message Discriminator.', '', '', `    Console logging: level debugging, ${buf.length} messages logged, xml disabled,`, '                     filtering disabled', `    Buffer logging:  level debugging, ${buf.length} messages logged, xml disabled,`, '                    filtering disabled', '', `    Trap logging: level informational, ${buf.length} message lines logged${x.d.logging.length ? '' : ''}`, ...x.d.logging.map((h) => `        Logging to ${h}  (udp port 514, audit disabled,`), '', 'Log Buffer (8192 bytes):', '', ...buf]);
    }),
    c('debug ip ospf adj', (x) => { (x.d.debug ||= {}).ospfAdj = true; return R(['OSPF adjacency debugging is on']); }),
    c('debug ip ospf adjacency', (x) => { (x.d.debug ||= {}).ospfAdj = true; return R(['OSPF adjacency debugging is on']); }),
    c('debug ip icmp', (x) => { (x.d.debug ||= {}).icmp = true; return R(['ICMP packet debugging is on']); }),
    c('debug ip packet', (x) => { (x.d.debug ||= {}).ipPacket = true; return R(['IP packet debugging is on']); }),
    c('no debug ip packet', (x) => { (x.d.debug ||= {}).ipPacket = false; return R(['IP packet debugging is off']); }),
    c('undebug ip packet', (x) => { (x.d.debug ||= {}).ipPacket = false; return R(['IP packet debugging is off']); }),
    c('no debug ip ospf adj', (x) => { (x.d.debug ||= {}).ospfAdj = false; return R(['OSPF adjacency debugging is off']); }),
    c('no debug ip icmp', (x) => { (x.d.debug ||= {}).icmp = false; return R(['ICMP packet debugging is off']); }),
    c('undebug all', (x) => { x.d.debug = {}; return R(['All possible debugging has been turned off']); }),
    c('no debug all', (x) => { x.d.debug = {}; return R(['All possible debugging has been turned off']); }),
    c('undebug ip icmp', (x) => { (x.d.debug ||= {}).icmp = false; return R(['ICMP packet debugging is off']); }),
    c('undebug ip ospf adj', (x) => { (x.d.debug ||= {}).ospfAdj = false; return R(['OSPF adjacency debugging is off']); }),
    c('show debugging', (x) => { const g = x.d.debug || {}; const L = []; if (g.ospfAdj) L.push('OSPF:', '  OSPF adjacency debugging is on'); if (g.icmp) L.push('IP:', '  ICMP packet debugging is on'); if (g.ipPacket) L.push('Generic IP:', '  IP packet debugging is on'); return R(L); }),
    c('clear logging', (x) => { x.d.logBuf = []; return R(['Clear logging buffer [confirm]', '']); }),
    c('show running-config', (x) => R(runningConfig(x.d))),
    c('show running-config interface <if>', (x) => R(runIfBlock(x.d, x.a[0]))),
    c('show startup-config', (x) => R(showStartup(x.d))),
    c('show version', (x) => R(showVersion(x.d))),
    c('show inventory', (x) => R(showInventory(x.d))),
    c('show processes cpu', () => R(showCpu())),
    c('show processes cpu sorted', () => R(showCpu())),
    c('show memory', () => R(showMemory())),
    c('show memory statistics', () => R(showMemory())),
    c('show environment', (x) => R(showEnvironment(x.d))),
    c('show environment all', (x) => R(showEnvironment(x.d))),
    c('show controllers <if>', (x) => R(showControllers(x.d, x.a[0]))),
    c('show flash:', (x) => R(showFlash(x.d))),
    c('show flash', (x) => R(showFlash(x.d))),
    c('dir', (x) => R(showFlash(x.d))),
    c('dir flash:', (x) => R(showFlash(x.d))),
    c('show clock', (x) => R([clockLine(x.d)])),
    c('show cdp neighbors', (x) => R(showCdp(x.d, false))),
    c('show cdp neighbors detail', (x) => R(showCdp(x.d, true))),
    c('show lldp', (x) => R(showLldpGlobal(x.d))),
    c('show snmp', (x) => R(SN.showSnmp(x.d))),
    c('show ipv6 access-list', (x) => R(ACL6.showAcl6(x.d.acls6))),
    c('show ipv6 access-list <word>', (x) => R(ACL6.showAcl6(x.d.acls6, x.a[0]))),
    c('show snmp {community|user|group|host}', (x) => R(SN.showSnmp(x.d, x.a[0]))),
    c('show lldp neighbors', (x) => R(showLldp(x.d, false))),
    c('show lldp neighbors detail', (x) => R(showLldp(x.d, true))),
    c('show lldp interface', (x) => R(showLldpIf(x.d))),
    c('show ip ssh', (x) => R(showSsh(x.d))),
    c('show ntp status', (x) => R(showNtp(x.d))),
    c('show ntp associations', (x) => R(showNtpAssoc(x.d))),
    c('show arp', (x) => R(showArp(x.d))),
    c('show ip arp', (x) => R(showArp(x.d))),
    c('show history', (x) => R((x.s.hist || []).slice(-10).map((h) => '  ' + h))),
    c('show users', () => R(['    Line       User       Host(s)              Idle       Location', '*  0 con 0                idle                 00:00:00'])),
  ];
  const SHOW_ROUTING = [
    c('show ip route', (x) => R(showIpRoute(x.d, null))),
    c('show ip route {ospf|static|connected|eigrp|bgp}', (x) => R(showIpRoute(x.d, x.a[0]))),
    c('show ip ospf neighbor', (x) => R(showOspfNei(x.d))),
    c('show ip ospf interface brief', (x) => R(showOspfIntBr(x.d))),
    c('show ip ospf interface', (x) => R(showOspfIf(x.d, null))),
    c('show ip ospf interface <if>', (x) => R(showOspfIf(x.d, x.a[0]))),
    c('show ip ospf', (x) => R(showOspf(x.d))),
    c('show ip protocols', (x) => R(showProtocols(x.d))),
    c('show ip eigrp neighbors', (x) => R(showEigrpNei(x.d))),
    c('show access-lists', (x) => R(showAcl(x.d, null))),
    c('show access-lists <word>', (x) => R(showAcl(x.d, x.a[0]))),
    c('show ip access-lists', (x) => R(showAcl(x.d, null))),
    c('show ip access-lists <word>', (x) => R(showAcl(x.d, x.a[0]))),
    c('show ip dhcp binding', (x) => R(showDhcpBind(x.d))),
    c('show ip dhcp pool', (x) => R(showDhcpPool(x.d))),
    c('show standby brief', (x) => R(showStandbyBrief(x.d))),
    c('show standby', (x) => R(showStandby(x.d))),
    c('show vrrp brief', (x) => R(showVrrpBrief(x.d))),
    c('show vrrp', (x) => R(showVrrp(x.d))),
  ];
  const SHOW_ROUTER = [
    c('show ip interface brief', (x) => R(showIpIntBriefRouter(x.d))),
    c('show ipv6 interface brief', (x) => R(showIpv6IntBr(x.d))),
    c('show ipv6 route', (x) => R(showIpv6Route(x.d, null))),
    c('show ipv6 route {ospf|static|connected|local}', (x) => R(showIpv6Route(x.d, x.a[0]))),
    c('show ipv6 ospf neighbor', (x) => R(showOspf6Nei(x.d))),
    c('show zone security', (x) => R(showZones(x.d))),
    c('show zone-pair security', (x) => R(showZonePairs(x.d))),
    c('show class-map type inspect', (x) => R(showCmapI(x.d))),
    c('show policy-map type inspect zone-pair sessions', (x) => R(showZbfSessions(x.d))),
    ...SHOW_ROUTING,
    c('show ip nat translations', (x) => R(showNatTr(x.d))),
    c('show ip nat statistics', (x) => R(showNatStat(x.d))),
    c('show interfaces <if>', (x) => R(showIfRouter(x.d, x.a[0]))),
    c('show ip bgp summary', (x) => R(showBgpSum(x.d))),
    c('show ip bgp', (x) => R(showBgp(x.d))),
    c('show interfaces tunnel <num>', (x) => R(showIfRouter(x.d, 'tu' + x.a[0]))),
    c('show crypto isakmp sa', (x) => R(showIsakmpSa(x.d))),
    c('show crypto isakmp policy', (x) => R(showIsakmpPolicy(x.d))),
    c('show crypto ipsec sa', (x) => R(showIpsecSa(x.d))),
    c('show crypto map', (x) => R(showCryptoMap(x.d))),
  ];
  const SHOW_SWITCH = [
    c('show ip interface brief', (x) => R(showIpIntBriefSwitch(x.d))),
    ...SHOW_ROUTING,
    c('show vlan brief', (x) => R(showVlanBrief(x.d))),
    c('show vlan', (x) => R(showVlanBrief(x.d))),
    c('show vlan private-vlan', (x) => R(showPvlan(x.d))),
    c('show vlan access-map', (x) => R(showVaclMap(x.d))),
    c('show vlan filter', (x) => R(showVaclFilter(x.d))),
    c('show interfaces trunk', (x) => R(showTrunk(x.d))),
    c('show interfaces status', (x) => R(showIfStatus(x.d, false))),
    c('show power inline', (x) => R(showPower(x.d))),
    c('show storm-control', (x) => R(showStorm(x.d))),
    c('show spanning-tree inconsistentports', (x) => R(showStpInc(x.d))),
    c('show ipv6 nd raguard policy', (x) => R(Object.entries(x.d.raPolicies || {}).flatMap(([n, p]) => [`Policy ${n} configuration:`, `  device-role ${p.role}`, ...Object.entries(x.d.ports).filter(([, q]) => q.raGuard === n).map(([q]) => `  Target ${shortIf(q)} PORT`)]))),
    c('show interfaces transceiver', (x) => R(showSfp(x.d))),
    c('show interfaces status err-disabled', (x) => R(showIfStatus(x.d, true))),
    c('show interfaces <if> switchport', (x) => R(showSwitchport(x.d, x.a[0]))),
    c('show interfaces <if>', (x) => R(showIfSwitch(x.d, x.a[0]))),
    c('show dtp interface <if>', (x) => R(showDtp(x.d, x.a[0]))),
    c('show etherchannel summary', (x) => R(showEtherSummary(x.d))),
    c('show spanning-tree', (x) => R(showStpAll(x.d))),
    c('show spanning-tree vlan <num>', (x) => R(showStp(x.d, x.a[0]))),
    c('show spanning-tree summary', (x) => R(showStpSummary(x.d))),
    c('show spanning-tree mst', (x) => R(showMst(x.d))),
    c('show spanning-tree mst configuration', (x) => R(mstShow(x.d))),
    c('show mac address-table', (x) => R(showMac(x.d))),
    c('show mac-address-table', (x) => R(showMac(x.d))),
    c('show ethernet-switching table', (x) => R(showJunosMac(x.d))),
    c('show port-security', (x) => R(showPsAll(x.d))),
    c('show port-security interface <if>', (x) => R(showPsIf(x.d, x.a[0]))),
    c('show vtp status', (x) => R(showVtp(x.d))),
    c('show ip dhcp snooping', (x) => R(showSnoop(x.d))),
    c('show ip dhcp snooping binding', (x) => R(showSnoopBind(x.d))),
    c('show ip source binding', (x) => R(showSnoopBind(x.d, true))),
    c('show ip arp inspection', (x) => R(showDai(x.d, x.d.dai))),
    c('show ip arp inspection vlan <vlist>', (x) => R(showDai(x.d, x.a[0]))),
    c('show ip arp inspection statistics', (x) => R(showDaiStats(x.d))),
    c('show ip arp inspection interfaces', (x) => R(showDaiIfs(x.d))),
    c('show ip verify source', (x) => R(showIpsg(x.d))),
    c('clear ip dhcp snooping binding', (x) => { x.d.snoop.bindings = []; return R([]); }),
    c('clear ip arp inspection statistics', (x) => { x.d.daiStats = {}; return R([]); }),
  ];

  // ================== EXEC ==================
  const EXEC_COMMON = [
    c('ping <ip>', (x) => iosPing(x.d, x.a[0])),
    c('ping <ip6>', (x) => iosPing6(x.d, x.a[0])),
    c('ping ipv6 <ip6>', (x) => iosPing6(x.d, x.a[0])),
    c('traceroute <ip>', (x) => iosTrace(x.d, x.a[0])),
    c('telnet <ip>', (x) => tcpConnect(x.d, x.a[0], 23, 'ios')),
    c('telnet <ip> <num>', (x) => tcpConnect(x.d, x.a[0], x.a[1], 'ios')),
    c('ssh -l <word> <ip>', (x) => sshConnect(x.d, x.a[1], x.a[0], x.s)),
    c('exit', (x) => logout(x)),
    c('logout', (x) => logout(x)),
  ];
  const EXEC_USER = [c('enable', (x) => enable(x)), ...EXEC_COMMON];
  const saveCfg = (x) => { x.d.startupCfg = cfgSnap(x.d); };
  const EXEC_PRIV = [
    c('enable', () => R([])),
    c('disable', (x) => { x.s.mode = 'user'; return R([]); }),
    c('configure terminal', (x) => { x.s.mode = 'config'; return R(['Enter configuration commands, one per line.  End with CNTL/Z.']); }),
    c('configure', (x) => { x.s.mode = 'config'; return R(['Configuring from terminal, memory, or network [terminal]? ', 'Enter configuration commands, one per line.  End with CNTL/Z.']); }),
    c('copy startup-config running-config', (x) => ask(x, [{ p: 'Destination filename [running-config]? ', k: 'f' }], () => copyStartRun(x))),
    c('copy running-config startup-config', (x) => ask(x, [{ p: 'Destination filename [startup-config]? ', k: 'f' }], () => { saveCfg(x); return R(['Building configuration...', '[OK]']); })),
    c('copy running-config tftp:', (x) => ask(x, [{ p: 'Address or name of remote host []? ', k: 'host' }, { p: () => `Destination filename [${x.d.name.toLowerCase()}-confg]? `, k: 'dst', def: () => `${x.d.name.toLowerCase()}-confg` }], (dt) => tftpPut(x.d, dt))),
    c('copy running-config {scp:|sftp:}', (x) => securePutAsk(x, x.a[0].slice(0, -1))),
    c('copy {scp:|sftp:} flash:', (x) => secureGetAsk(x, x.a[0].slice(0, -1))),
    c('test aaa group {tacacs+|radius} <word> <word> new-code', (x) => { const r = aaaMethods(x.d, ['group', x.a[0]], x.a[1], x.a[2]); return R([r === true ? 'User successfully authenticated' : r === false ? 'User rejected' : 'No authoritative response from any server.']); }),
    c('show aaa servers', (x) => R(Object.entries(x.d.aaa?.servers || {}).flatMap(([n, s]) => [`Server ${n}: ${s.proto === 'radius' ? 'RADIUS' : 'TACACS+'} ${s.ip || '(chưa có address)'}${s.proto === 'radius' ? ' auth-port 1812' : ' port 49'}`, `  key ${s.key ? 'đã đặt' : 'chưa đặt'}`, `  ${aaaSrvUp(x.d, s) ? 'State: current UP' : 'State: current DEAD'}`]))),
    c('copy tftp: flash:', (x) => copyTftpAsk(x)),
    c('copy tftp flash', (x) => copyTftpAsk(x)),
    c('write memory', (x) => { saveCfg(x); return R(['Building configuration...', '[OK]']); }),
    c('write', (x) => { saveCfg(x); return R(['Building configuration...', '[OK]']); }),
    c('write erase', (x) => eraseAsk(x)),
    c('erase startup-config', (x) => eraseAsk(x)),
    c('verify /md5 <word>', (x) => verifyMd5(x.d, flashName(x.a[0]))),
    c('delete <word>', (x) => deleteAsk(x, flashName(x.a[0]))),
    c('delete flash: <word>', (x) => deleteAsk(x, flashName(x.a[0]))),
    c('reload', (x) => reloadAsk(x)),
    c('clear ip nat translation *', (x) => { if (x.d.natTable) x.d.natTable = []; return R([]); }),
    c('clear arp-cache', (x) => { x.d.arp = {}; return R([]); }),
    c('clear mac address-table dynamic', (x) => { if (x.d.macTable) x.d.macTable = []; return R([]); }),
    c('clear access-list counters', (x) => { for (const a of Object.values(x.d.acls || {})) for (const e of a.entries) e.matches = 0; return R([]); }),
    c('clear port-security all', (x) => { for (const p of Object.values(x.d.ports || {})) if (p.ps) p.ps.macs = []; return R([]); }),
    c('clear crypto isakmp', () => R([])),
    c('clear crypto sa', () => R([])),
    ...EXEC_COMMON,
  ];

  // ================== CẤU HÌNH GLOBAL ==================
  const CFG_COMMON = [
    c('hostname <word>', (x) => { x.d.name = x.a[0]; return R([]); }),
    c('enable secret <word>', (x) => pwShort(x, x.a[0]) || ((x.d.enableSecret = x.a[0]), R([]))),
    c('enable secret 5 <word>', (x) => { x.d.enableSecret = unhash(x.a[0], x.d.enableSecret); return R([]); }),
    c('enable password <word>', (x) => pwShort(x, x.a[0]) || ((x.d.enablePassword = x.a[0]), R([]))),
    c('enable password 7 <word>', (x) => { x.d.enablePassword = untype7(x.a[0]); return R([]); }),
    c('no enable secret', (x) => { x.d.enableSecret = null; return R([]); }),
    c('no enable password', (x) => { x.d.enablePassword = null; return R([]); }),
    c('service password-encryption', (x) => { x.d.servicePwEnc = true; return R([]); }),
    c('no service password-encryption', (x) => { x.d.servicePwEnc = false; return R([]); }),
    // các dòng xuất hiện trong "show running-config" → dán lại không báo lỗi
    c('version <rest>', () => R([])),
    c('service timestamps <rest>', () => R([])),
    c('no service timestamps <rest>', () => R([])),
    c('ip classless', () => R([])),
    c('ip flow-export <rest>', () => R([])),
    c('boot-start-marker', () => R([])),
    c('boot-end-marker', () => R([])),
    c('spanning-tree mode {pvst|rapid-pvst|mst}', (x) => { if (x.d.stp) x.d.stp.mode = x.a[0]; return R([]); }),
    c('line aux <num>', (x) => { x.d.lines.aux ||= { password: null, login: false, loginLocal: false }; x.s.mode = 'line'; x.s.line = 'aux'; return R([]); }),
    c('banner motd <rest>', (x) => bannerSet(x)),
    c('no banner motd', (x) => { x.d.banner = null; return R([]); }),
    c('ip domain-name <word>', (x) => { x.d.domain = x.a[0]; return R([]); }),
    c('ip domain name <word>', (x) => { x.d.domain = x.a[0]; return R([]); }),
    c('no ip domain-lookup', () => R([])),
    c('ip domain-lookup', () => R([])),
    c('crypto key generate rsa', (x) => rsaGen(x, 512)),
    c('crypto key generate rsa modulus <num>', (x) => rsaGen(x, x.a[0])),
    c('crypto key generate rsa general-keys modulus <num>', (x) => rsaGen(x, x.a[0])),
    c('ip scp server enable', (x) => { x.d.scpServer = true; return R([]); }),
    c('ip ssh version {1|2}', (x) => { x.d.sshVer = +x.a[0]; return R([]); }),
    c('ip ssh time-out <num>', (x) => { x.d.sshTimeout = x.a[0]; return R([]); }),
    c('ip ssh authentication-retries <num>', (x) => { x.d.sshRetries = x.a[0]; return R([]); }),
    c('login block-for <num> attempts <num> within <num>', (x) => loginBlock(x)),
    c('no login block-for', (x) => { if (x.d.loginSec) Object.assign(x.d.loginSec, { blockFor: 0, quietUntil: 0, fails: [] }); return R([]); }),
    c('login quiet-mode access-class <word>', (x) => { (x.d.loginSec ||= {}).quietAcl = x.a[0]; return R([]); }),
    c('no login quiet-mode access-class', (x) => { if (x.d.loginSec) x.d.loginSec.quietAcl = null; return R([]); }),
    c('login on-failure log', (x) => { (x.d.loginSec ||= {}).logFail = true; return R([]); }),
    c('login on-success log', (x) => { (x.d.loginSec ||= {}).logOk = true; return R([]); }),
    c('login delay <num>', (x) => { (x.d.loginSec ||= {}).delay = x.a[0]; return R([]); }),
    c('security passwords min-length <num>', (x) => { if (x.a[0] < 1 || x.a[0] > 16) return R(['% Invalid input: 1-16']); x.d.pwMin = x.a[0]; return R([]); }),
    c('no security passwords min-length', (x) => { x.d.pwMin = 0; return R([]); }),
    c('aaa new-model', (x) => { (x.d.aaa ||= { lists: {} }).newModel = true; return R([]); }),
    c('no aaa new-model', (x) => { if (x.d.aaa) x.d.aaa.newModel = false; return R([]); }),
    c('aaa authentication login <word> <rest>', (x) => aaaList(x)),
    c('tacacs server <word>', (x) => aaaSrv(x, 'tacacs+')),
    c('no tacacs server <word>', (x) => { delete x.d.aaa?.servers?.[x.a[0]]; return R([]); }),
    c('radius server <word>', (x) => aaaSrv(x, 'radius')),
    c('no radius server <word>', (x) => { delete x.d.aaa?.servers?.[x.a[0]]; return R([]); }),
    c('no aaa authentication login <word>', (x) => { if (x.d.aaa) delete x.d.aaa.lists[x.a[0]]; return R([]); }),
    c('aaa authentication enable default <rest>', (x) => { if (!x.d.aaa?.newModel) return R(['% AAA chưa bật — gõ "aaa new-model" trước']); x.d.aaa.enable = x.a[0]; return R([]); }),
    c('ip http server', (x) => { x.d.httpServer = true; return R([]); }),
    c('no ip http server', (x) => { x.d.httpServer = false; return R([]); }),
    c('ip http secure-server', (x) => { x.d.httpsServer = true; return R([]); }),
    c('no ip http secure-server', (x) => { x.d.httpsServer = false; return R([]); }),
    c('username <word> secret <word>', (x) => userSet(x, x.a[0], x.a[1], 1, 'secret')),
    c('username <word> password <word>', (x) => userSet(x, x.a[0], x.a[1], 1, 'password')),
    c('username <word> privilege <num> secret <word>', (x) => userSet(x, x.a[0], x.a[2], x.a[1], 'secret')),
    c('username <word> privilege <num> password <word>', (x) => userSet(x, x.a[0], x.a[2], x.a[1], 'password')),
    c('username <word> secret 5 <word>', (x) => userSet(x, x.a[0], unhash(x.a[1], x.d.users[x.a[0]]?.pw), 1, 'secret')),
    c('username <word> privilege <num> secret 5 <word>', (x) => userSet(x, x.a[0], unhash(x.a[2], x.d.users[x.a[0]]?.pw), x.a[1], 'secret')),
    c('username <word> password 7 <word>', (x) => userSet(x, x.a[0], untype7(x.a[1]), 1, 'password')),
    c('username <word> privilege <num> password 7 <word>', (x) => userSet(x, x.a[0], untype7(x.a[2]), x.a[1], 'password')),
    c('no username <word>', (x) => { delete x.d.users[x.a[0]]; return R([]); }),
    c('line console <num>', (x) => { x.s.mode = 'line'; x.s.line = 'con'; return R([]); }),
    c('line vty <num> <num>', (x) => { x.s.mode = 'line'; x.s.line = 'vty'; return R([]); }),
    c('interface <if>', (x) => enterIf(x, x.a[0])),
    c('interface range <rest>', (x) => enterRange(x, x.a[0])),
    c('ntp server <ip>', (x) => { if (!x.d.ntp.servers.includes(x.a[0])) x.d.ntp.servers.push(x.a[0]); return R([]); }),
    c('no ntp server <ip>', (x) => { x.d.ntp.servers = x.d.ntp.servers.filter((s) => s !== x.a[0]); return R([]); }),
    c('ntp master', (x) => { x.d.ntp.master = 8; return R([]); }),
    c('ntp master <num>', (x) => { x.d.ntp.master = x.a[0]; return R([]); }),
    c('no ntp master', (x) => { x.d.ntp.master = null; return R([]); }),
    c('logging host <ip>', (x) => { if (!x.d.logging.includes(x.a[0])) x.d.logging.push(x.a[0]); return R([]); }),
    c('logging <ip>', (x) => { if (!x.d.logging.includes(x.a[0])) x.d.logging.push(x.a[0]); return R([]); }),
    c('no logging host <ip>', (x) => { x.d.logging = x.d.logging.filter((s) => s !== x.a[0]); return R([]); }),
    c('cdp run', (x) => { x.d.cdpRun = true; return R([]); }),
    c('lldp run', (x) => { x.d.lldpRun = true; return R([]); }),
    c('config-register <word>', (x) => confregSet(x, x.a[0])),
    c('ipv6 access-list <word>', (x) => { (x.d.acls6 ||= {})[x.a[0]] ||= { entries: [] }; x.s.mode = 'acl6'; x.s.acl6 = x.a[0]; return R([]); }),
    c('no ipv6 access-list <word>', (x) => { delete (x.d.acls6 ||= {})[x.a[0]]; return R([]); }),
    c('snmp-server community <word>', (x) => { SN.setCommunity(x.d, x.a[0], false, null); return R([]); }),
    c('snmp-server community <word> {ro|rw}', (x) => { SN.setCommunity(x.d, x.a[0], x.a[1] === 'rw', null); return R([]); }),
    c('snmp-server community <word> {ro|rw} <word>', (x) => { SN.setCommunity(x.d, x.a[0], x.a[1] === 'rw', x.a[2]); return R([]); }),
    c('no snmp-server community <word>', (x) => { delete SN.snmpOf(x.d).comm[x.a[0]]; return R([]); }),
    c('snmp-server location <rest>', (x) => { SN.snmpOf(x.d).location = x.a[0]; return R([]); }),
    c('snmp-server contact <rest>', (x) => { SN.snmpOf(x.d).contact = x.a[0]; return R([]); }),
    c('snmp-server enable traps', (x) => { SN.snmpOf(x.d).traps = true; return R([]); }),
    c('snmp-server enable traps <rest>', (x) => { SN.snmpOf(x.d).traps = true; return R([]); }),
    c('no snmp-server enable traps', (x) => { SN.snmpOf(x.d).traps = false; return R([]); }),
    c('snmp-server host <ip> <word>', (x) => snmpHost(x, x.a[0], '1', null, x.a[1])),
    c('snmp-server host <ip> version {1|2c} <word>', (x) => snmpHost(x, x.a[0], x.a[1], null, x.a[2])),
    c('snmp-server host <ip> version 3 {noauth|auth|priv} <word>', (x) => snmpHost(x, x.a[0], '3', x.a[1], x.a[2])),
    c('no snmp-server host <ip>', (x) => { const s0 = SN.snmpOf(x.d); s0.hosts = s0.hosts.filter((h) => h.ip !== x.a[0]); return R([]); }),
    c('snmp-server group <word> v3 {noauth|auth|priv}', (x) => { SN.setGroup(x.d, x.a[0], x.a[1]); return R([]); }),
    c('snmp-server group <word> v3 {noauth|auth|priv} <rest>', (x) => { SN.setGroup(x.d, x.a[0], x.a[1], x.a[2]); return R([]); }),
    c('no snmp-server group <word> v3 {noauth|auth|priv}', (x) => { delete SN.snmpOf(x.d).groups[x.a[0]]; return R([]); }),
    c('snmp-server user <word> <word> v3', (x) => snmpUser(x, null, null, null, null)),
    c('snmp-server user <word> <word> v3 auth {md5|sha} <word>', (x) => snmpUser(x, x.a[2], x.a[3], null, null)),
    c('snmp-server user <word> <word> v3 auth {md5|sha} <word> priv {des|3des} <word>', (x) => snmpUser(x, x.a[2], x.a[3], x.a[4], x.a[5])),
    c('snmp-server user <word> <word> v3 auth {md5|sha} <word> priv aes {128|192|256} <word>', (x) => snmpUser(x, x.a[2], x.a[3], 'aes ' + x.a[4], x.a[5])),
    c('no snmp-server user <word> <word> v3', (x) => { delete SN.snmpOf(x.d).users[x.a[0]]; return R([]); }),
    c('no lldp run', (x) => { x.d.lldpRun = false; return R([]); }),
    c('lldp timer <num>', (x) => { x.d.lldpTimer = x.a[0]; return R([]); }),
    c('lldp holdtime <num>', (x) => { x.d.lldpHold = x.a[0]; return R([]); }),
    c('no cdp run', (x) => { x.d.cdpRun = false; return R([]); }),
    c('boot system <word>', (x) => bootSet(x, flashName(x.a[0]))),
    c('boot system flash <word>', (x) => bootSet(x, flashName(x.a[0]))),
    c('no boot system', (x) => { x.d.bootSystem = []; return R([]); }),
    c('no boot system <word>', (x) => { x.d.bootSystem = x.d.bootSystem.filter((b) => b !== flashName(x.a[0])); return R([]); }),
    c('errdisable recovery cause <word>', () => R([])),
    c('end', (x) => toPriv(x)),
    c('exit', (x) => { x.s.mode = 'priv'; return R([]); }),
    c('do <rest>', (x) => doExec(x)),
  ];
  // lệnh định tuyến/dịch vụ dùng chung cho router và switch Layer 3
  const CFG_ROUTING = [
    c('ip route <ip> <mask> <ip>', (x) => routeAdd(x, x.a[0], x.a[1], x.a[2], null, 1)),
    c('ip route <ip> <mask> <ip> <num>', (x) => routeAdd(x, x.a[0], x.a[1], x.a[2], null, x.a[3])),
    c('ip route <ip> <mask> <if>', (x) => routeAdd(x, x.a[0], x.a[1], null, x.a[2], 1)),
    c('ip route <ip> <mask> <if> <num>', (x) => routeAdd(x, x.a[0], x.a[1], null, x.a[2], x.a[3])),
    c('ip route <ip> <mask> <if> <ip>', (x) => routeAdd(x, x.a[0], x.a[1], x.a[3], x.a[2], 1)),
    c('ip route <ip> <mask> <ip> name <word>', (x) => routeAdd(x, x.a[0], x.a[1], x.a[2], null, 1, x.a[3])),
    c('ip route <ip> <mask> <ip> <num> name <word>', (x) => routeAdd(x, x.a[0], x.a[1], x.a[2], null, x.a[3], x.a[4])),
    c('ip route <ip> <mask> <if> name <word>', (x) => routeAdd(x, x.a[0], x.a[1], null, x.a[2], 1, x.a[3])),
    c('ip route <ip> <mask> <if> <ip> name <word>', (x) => routeAdd(x, x.a[0], x.a[1], x.a[3], x.a[2], 1, x.a[4])),
    c('no ip route <ip> <mask> <ip>', (x) => routeDel(x, x.a[0], x.a[1], x.a[2])),
    c('no ip route <ip> <mask> <ip> <num>', (x) => routeDel(x, x.a[0], x.a[1], x.a[2])),
    c('no ip route <ip> <mask> <if>', (x) => routeDel(x, x.a[0], x.a[1], x.a[2])),
    c('no ip route <ip> <mask> <if> <ip>', (x) => routeDel(x, x.a[0], x.a[1], x.a[3])),
    c('no ip route <ip> <mask>', (x) => routeDel(x, x.a[0], x.a[1], null)),
    c('router ospf <num>', (x) => routerOspf(x)),
    c('no router ospf <num>', (x) => { if (x.d.ospf?.pid === x.a[0]) x.d.ospf = null; return R([]); }),
    c('router eigrp <num>', (x) => routerEigrp(x)),
    c('no router eigrp <num>', (x) => { if (x.d.eigrp?.as === x.a[0]) x.d.eigrp = null; return R([]); }),
    c('access-list <num> remark <rest>', (x) => numberedAcl(x, x.a[0], null, x.a[1])),
    c('access-list <num> <rest>', (x) => numberedAcl(x, x.a[0], x.a[1], null)),
    c('no access-list <num>', (x) => { delete x.d.acls[String(x.a[0])]; return R([]); }),
    c('ip access-list {standard|extended} <word>', (x) => namedAcl(x, x.a[0], x.a[1])),
    c('no ip access-list {standard|extended} <word>', (x) => { delete x.d.acls[x.a[1]]; return R([]); }),
    c('ip dhcp pool <word>', (x) => { x.d.dhcp.pools[x.a[0]] ||= { net: null, prefix: null, router: null, dns: null, domain: null }; x.s.mode = 'pool'; x.s.pool = x.a[0]; return R([]); }),
    c('no ip dhcp pool <word>', (x) => { delete x.d.dhcp.pools[x.a[0]]; return R([]); }),
    c('ip dhcp excluded-address <ip>', (x) => { x.d.dhcp.excluded.push([x.a[0], x.a[0]]); return R([]); }),
    c('ip dhcp excluded-address <ip> <ip>', (x) => { x.d.dhcp.excluded.push([x.a[0], x.a[1]]); return R([]); }),
    c('no ip dhcp excluded-address <ip>', (x) => { x.d.dhcp.excluded = x.d.dhcp.excluded.filter(([a]) => a !== x.a[0]); return R([]); }),
    c('no ip dhcp excluded-address <ip> <ip>', (x) => { x.d.dhcp.excluded = x.d.dhcp.excluded.filter(([a, b]) => !(a === x.a[0] && b === x.a[1])); return R([]); }),
    c('ipv6 unicast-routing', (x) => { x.d.ipv6Routing = true; return R([]); }),
    c('no ipv6 unicast-routing', (x) => { x.d.ipv6Routing = false; return R([]); }),
    c('ipv6 route <ip6p> <ip6>', (x) => route6(x, x.a[0], { nh: x.a[1] })),
    c('ipv6 route <ip6p> <ip6> <num>', (x) => route6(x, x.a[0], { nh: x.a[1], ad: x.a[2] })),
    c('ipv6 route <ip6p> <if>', (x) => route6(x, x.a[0], { iface: x.a[1] })),
    c('ipv6 route <ip6p> <if> <ip6>', (x) => route6(x, x.a[0], { iface: x.a[1], nh: x.a[2] })),
    c('no ipv6 route <ip6p>', (x) => route6(x, x.a[0], null)),
    c('no ipv6 route <ip6p> <ip6>', (x) => route6(x, x.a[0], null)),
    c('ipv6 router ospf <num>', (x) => routerOspf6(x)),
    // ---- Zone-Based Firewall ----
    c('zone security <word>', (x) => { zbf(x.d).zones[x.a[0]] ||= { desc: '' }; x.s.mode = 'zone'; x.s.zone = x.a[0]; return R([]); }),
    c('no zone security <word>', (x) => { const z = zbf(x.d); delete z.zones[x.a[0]]; for (const f of Object.values(x.d.ifaces)) if (f.zone === x.a[0]) f.zone = null; z.pairs = z.pairs.filter((p) => p.src !== x.a[0] && p.dst !== x.a[0]); return R([]); }),
    c('class-map type inspect match-any <word>', (x) => cmapI(x, x.a[0], false)),
    c('class-map type inspect match-all <word>', (x) => cmapI(x, x.a[0], true)),
    c('class-map type inspect <word>', (x) => cmapI(x, x.a[0], true)),
    c('policy-map type inspect <word>', (x) => { const z = zbf(x.d); z.policyMaps[x.a[0]] ||= [{ cls: 'class-default', action: 'drop' }]; x.s.mode = 'pmapi'; x.s.pm = x.a[0]; return R([]); }),
    c('zone-pair security <word> source <word> destination <word>', (x) => zpair(x)),
    c('no zone-pair security <word>', (x) => { const z = zbf(x.d); z.pairs = z.pairs.filter((p) => p.name !== x.a[0]); return R([]); }),
    c('no ipv6 router ospf <num>', (x) => { if (x.d.ospf6?.pid === x.a[0]) x.d.ospf6 = null; return R([]); }),
  ];
  const CFG_ROUTER = [
    ...CFG_COMMON,
    ...CFG_ROUTING,
    c('ip routing', () => R([])),
    c('ip nat inside source list <word> interface <if> overload', (x) => natDyn(x, { acl: x.a[0], iface: x.a[1], overload: true })),
    c('no ip nat inside source list <word> interface <if> overload', (x) => { x.d.nat.dyn = x.d.nat.dyn.filter((r) => !(r.acl === x.a[0] && r.iface === x.a[1])); return R([]); }),
    c('ip nat inside source list <word> pool <word>', (x) => natDyn(x, { acl: x.a[0], pool: x.a[1], overload: false })),
    c('ip nat inside source list <word> pool <word> overload', (x) => natDyn(x, { acl: x.a[0], pool: x.a[1], overload: true })),
    c('no ip nat inside source list <word> pool <word>', (x) => { x.d.nat.dyn = x.d.nat.dyn.filter((r) => !(r.acl === x.a[0] && r.pool === x.a[1])); return R([]); }),
    c('no ip nat inside source list <word> pool <word> overload', (x) => { x.d.nat.dyn = x.d.nat.dyn.filter((r) => !(r.acl === x.a[0] && r.pool === x.a[1])); return R([]); }),
    c('ip nat pool <word> <ip> <ip> netmask <mask>', (x) => natPool(x, x.a[0], x.a[1], x.a[2], maskToPrefix(x.a[3]))),
    c('ip nat pool <word> <ip> <ip> prefix-length <num>', (x) => natPool(x, x.a[0], x.a[1], x.a[2], x.a[3])),
    c('no ip nat pool <word>', (x) => { delete x.d.nat.pools[x.a[0]]; return R([]); }),
    c('ip nat inside source static <ip> <ip>', (x) => { if (!x.d.nat.statics.some((s) => !s.proto && s.local === x.a[0])) x.d.nat.statics.push({ local: x.a[0], global: x.a[1] }); return R([]); }),
    c('no ip nat inside source static <ip> <ip>', (x) => { x.d.nat.statics = x.d.nat.statics.filter((s) => !(!s.proto && s.local === x.a[0])); return R([]); }),
    c('ip nat inside source static {tcp|udp} <ip> <num> <ip> <num>', (x) => { x.d.nat.statics.push({ proto: x.a[0], local: x.a[1], lport: x.a[2], global: x.a[3], gport: x.a[4] }); return R([]); }),
    c('no ip nat inside source static {tcp|udp} <ip> <num> <ip> <num>', (x) => { x.d.nat.statics = x.d.nat.statics.filter((s) => !(s.proto === x.a[0] && s.local === x.a[1] && s.lport === x.a[2])); return R([]); }),
    c('router bgp <num>', (x) => { if (!x.d.bgp) x.d.bgp = { as: x.a[0], rid: null, neighbors: {}, networks: [] }; else if (x.d.bgp.as !== x.a[0]) return R([`% BGP is already running; AS is ${x.d.bgp.as}`]); x.s.mode = 'bgp'; return R([]); }),
    c('no router bgp <num>', (x) => { if (x.d.bgp?.as === x.a[0]) x.d.bgp = null; return R([]); }),
    c('crypto isakmp policy <num>', (x) => { x.d.crypto.isakmp[x.a[0]] ||= { encr: 'des', hash: 'sha', auth: 'rsa-sig', group: 1, lifetime: 86400 }; x.s.mode = 'isakmp'; x.s.isakmp = x.a[0]; return R([]); }),
    c('no crypto isakmp policy <num>', (x) => { delete x.d.crypto.isakmp[x.a[0]]; return R([]); }),
    c('crypto isakmp key <word> address <ip>', (x) => { x.d.crypto.keys[x.a[1]] = x.a[0]; return R([]); }),
    c('no crypto isakmp key <word> address <ip>', (x) => { delete x.d.crypto.keys[x.a[1]]; return R([]); }),
    c('crypto ipsec transform-set <word> <rest>', (x) => tsetSet(x, x.a[0], x.a[1])),
    c('no crypto ipsec transform-set <word>', (x) => { delete x.d.crypto.tsets[x.a[0]]; return R([]); }),
    c('crypto map <word> <num> ipsec-isakmp', (x) => cmapEnter(x, x.a[0], x.a[1])),
    c('no crypto map <word> <num>', (x) => { if (x.d.crypto.maps[x.a[0]]) delete x.d.crypto.maps[x.a[0]][x.a[1]]; return R([]); }),
  ];
  const CFG_SWITCH = [
    ...CFG_COMMON,
    ...CFG_ROUTING,
    c('ip routing', (x) => { if (x.d.model !== '3560') return R(['% Invalid input detected.', '(Lab: switch 2960 là Layer 2 — cần switch Layer 3 như 3560 mới "ip routing" được)']); x.d.ipRouting = true; return R([]); }),
    c('no ip routing', (x) => { x.d.ipRouting = false; return R([]); }),
    c('vlan <vlist>', (x) => vlanEnter(x, x.a[0])),
    c('no vlan <vlist>', (x) => vlanDel(x, x.a[0])),
    c('vlan access-map <word>', (x) => vamapEnter(x, x.a[0], 10)),
    c('vlan access-map <word> <num>', (x) => vamapEnter(x, x.a[0], x.a[1])),
    c('no vlan access-map <word>', (x) => { delete x.d.vacl.maps[x.a[0]]; return R([]); }),
    c('vlan filter <word> vlan-list <vlist>', (x) => { x.d.vacl.filters[x.a[0]] = [...new Set([...(x.d.vacl.filters[x.a[0]] || []), ...x.a[1]])]; return R([]); }),
    c('no vlan filter <word> vlan-list <vlist>', (x) => { delete x.d.vacl.filters[x.a[0]]; return R([]); }),
    c('vtp mode {server|client|transparent}', (x) => vtpMode(x, x.a[0])),
    c('vtp domain <word>', (x) => { const old = x.d.vtpDomain; x.d.vtpDomain = x.a[0]; if (old !== x.a[0]) x.d.vtpRev = 0; return R([`Changing VTP domain name from ${old || 'NULL'} to ${x.a[0]}`]); }),
    c('vtp password <word>', (x) => { x.d.vtpPw = x.a[0]; return R([`Setting device VTP password to ${x.a[0]}`]); }),
    c('vtp version {1|2|3}', () => R([])),
    c('spanning-tree mst configuration', (x) => { mst(x); x.s.mode = 'mstcfg'; return R([]); }),
    c('spanning-tree mst <num> priority <num>', (x) => { if (x.a[1] % 4096) return R(['% Bridge Priority must be in increments of 4096.']); mst(x).prio[x.a[0]] = x.a[1]; return R([]); }),
    c('spanning-tree mst <num> root {primary|secondary}', (x) => { mst(x).prio[x.a[0]] = x.a[1] === 'primary' ? 24576 : 28672; return R([]); }),
    c('spanning-tree vlan <vlist> priority <num>', (x) => stpPrio(x, x.a[0], x.a[1])),
    c('spanning-tree vlan <vlist> root {primary|secondary}', (x) => { for (const v of x.a[0]) x.d.stp.prio[v] = x.a[1] === 'primary' ? 24576 : 28672; return R([]); }),
    c('no spanning-tree vlan <vlist> priority', (x) => { for (const v of x.a[0]) delete x.d.stp.prio[v]; return R([]); }),
    c('spanning-tree portfast default', (x) => { x.d.stp.portfastDefault = true; return R(['%Warning: this command enables portfast by default on all interfaces. You', ' should now disable portfast explicitly on switched ports leading to hubs,', ' switches and bridges as they may create temporary bridging loops.']); }),
    c('spanning-tree portfast bpduguard default', (x) => { x.d.stp.bpduDefault = true; return R([]); }),
    c('spanning-tree loopguard default', (x) => { x.d.stp.loopguardDefault = true; return R([]); }),
    c('no spanning-tree loopguard default', (x) => { x.d.stp.loopguardDefault = false; return R([]); }),
    c('ipv6 nd raguard policy <word>', (x) => { (x.d.raPolicies ||= {})[x.a[0]] ||= { role: 'host' }; x.s.mode = 'ragpol'; x.s.rag = x.a[0]; return R([]); }),
    c('no ipv6 nd raguard policy <word>', (x) => { delete x.d.raPolicies?.[x.a[0]]; return R([]); }),
    c('no spanning-tree portfast bpduguard default', (x) => { x.d.stp.bpduDefault = false; return R([]); }),
    c('ip default-gateway <ip>', (x) => { x.d.defaultGateway = x.a[0]; return R([]); }),
    c('no ip default-gateway', (x) => { x.d.defaultGateway = ''; return R([]); }),
    c('ip dhcp snooping', (x) => { x.d.snoop.enabled = true; return R([]); }),
    c('no ip dhcp snooping', (x) => { x.d.snoop.enabled = false; return R([]); }),
    c('ip dhcp snooping vlan <vlist>', (x) => { for (const v of x.a[0]) if (!x.d.snoop.vlans.includes(v)) x.d.snoop.vlans.push(v); return R([]); }),
    c('ip arp inspection vlan <vlist>', (x) => { for (const v of x.a[0]) if (!x.d.dai.includes(v)) x.d.dai.push(v); return R([]); }),
    c('no ip dhcp snooping vlan <vlist>', (x) => { x.d.snoop.vlans = x.d.snoop.vlans.filter((v) => !x.a[0].includes(v)); return R([]); }),
    c('no ip arp inspection vlan <vlist>', (x) => { x.d.dai = x.d.dai.filter((v) => !x.a[0].includes(v)); return R([]); }),
    c('ip arp inspection validate <rest>', (x) => { x.d.daiValidate = x.a[0]; return R([]); }),
    c('no ip arp inspection validate <rest>', (x) => { x.d.daiValidate = null; return R([]); }),
    c('ip dhcp snooping information option', (x) => { x.d.snoop.noOpt82 = false; return R([]); }),
    c('no ip dhcp snooping information option', (x) => { x.d.snoop.noOpt82 = true; return R([]); }),
    c('ip source binding <word> vlan <num> <ip> interface <if>', (x) => srcBinding(x, true)),
    c('no ip source binding <word> vlan <num> <ip> interface <if>', (x) => srcBinding(x, false)),
  ];

  // ================== CHẾ ĐỘ INTERFACE ==================
  const SUBMODE_TAIL = [
    c('exit', (x) => { x.s.mode = 'config'; x.s.ifs = []; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const IF_L3 = [
    c('ip address <ip> <mask>', (x) => ifAll(x, (f, n) => ipSet(x, f, n, x.a[0], x.a[1]))),
    c('no ip address', (x) => ifAll(x, (f) => { f.ip = null; f.prefix = null; })),
    c('shutdown', (x) => ifAll(x, (f, n) => adminSet(x, f, n, true))),
    c('no shutdown', (x) => ifAll(x, (f, n) => adminSet(x, f, n, false))),
    c('description <rest>', (x) => ifAll(x, (f) => { f.desc = x.a[0]; })),
    c('no description', (x) => ifAll(x, (f) => { f.desc = ''; })),
    c('ip access-group <word> {in|out}', (x) => ifAll(x, (f) => { f[x.a[1] === 'in' ? 'aclIn' : 'aclOut'] = x.a[0]; })),
    c('no ip access-group <word> {in|out}', (x) => ifAll(x, (f) => { f[x.a[1] === 'in' ? 'aclIn' : 'aclOut'] = null; })),
    c('standby <num> ip <ip>', (x) => ifAll(x, (f) => { (f.standby[x.a[0]] ||= {}).ip = x.a[1]; })),
    c('standby <num> priority <num>', (x) => ifAll(x, (f) => { (f.standby[x.a[0]] ||= {}).priority = x.a[1]; })),
    c('standby <num> preempt', (x) => ifAll(x, (f) => { (f.standby[x.a[0]] ||= {}).preempt = true; })),
    c('standby <num> track <if>', (x) => ifAll(x, (f) => trackSet(f, x.a[0], x.a[1], 10))),
    c('standby <num> track <if> <num>', (x) => ifAll(x, (f) => trackSet(f, x.a[0], x.a[1], x.a[2]))),
    c('standby <num> track <if> decrement <num>', (x) => ifAll(x, (f) => trackSet(f, x.a[0], x.a[1], x.a[2]))),
    c('no standby <num> track <if>', (x) => ifAll(x, (f) => { if (f.standby[x.a[0]]) f.standby[x.a[0]].track = (f.standby[x.a[0]].track || []).filter((t) => t.ifn !== x.a[1]); })),
    c('no standby <num> preempt', (x) => ifAll(x, (f) => { if (f.standby[x.a[0]]) f.standby[x.a[0]].preempt = false; })),
    c('no standby <num> ip', (x) => ifAll(x, (f) => { if (f.standby[x.a[0]]) f.standby[x.a[0]].ip = null; })),
    c('no standby <num> ip <ip>', (x) => ifAll(x, (f) => { if (f.standby[x.a[0]]) f.standby[x.a[0]].ip = null; })),
    c('no standby <num> priority', (x) => ifAll(x, (f) => { if (f.standby[x.a[0]]) delete f.standby[x.a[0]].priority; })),
    c('no standby <num>', (x) => ifAll(x, (f) => { delete f.standby[x.a[0]]; })),
    c('standby version {1|2}', () => R([])),
    c('vrrp <num> ip <ip>', (x) => ifAll(x, (f) => { (f.vrrp[x.a[0]] ||= {}).ip = x.a[1]; })),
    c('vrrp <num> priority <num>', (x) => ifAll(x, (f) => { (f.vrrp[x.a[0]] ||= {}).priority = x.a[1]; })),
    c('vrrp <num> preempt', (x) => ifAll(x, (f) => { (f.vrrp[x.a[0]] ||= {}).preempt = true; })),
    c('no vrrp <num> preempt', (x) => ifAll(x, (f) => { (f.vrrp[x.a[0]] ||= {}).preempt = false; })),
    c('no vrrp <num>', (x) => ifAll(x, (f) => { delete f.vrrp[x.a[0]]; })),
    c('ip helper-address <ip>', (x) => ifAll(x, (f) => { if (!f.helper.includes(x.a[0])) f.helper.push(x.a[0]); })),
    c('no ip helper-address <ip>', (x) => ifAll(x, (f) => { f.helper = f.helper.filter((h) => h !== x.a[0]); })),
    c('ip ospf cost <num>', (x) => ifAll(x, (f) => { f.ospfCost = x.a[0]; })),
    c('no ip ospf cost', (x) => ifAll(x, (f) => { f.ospfCost = null; })),
    c('ip ospf priority <num>', (x) => ifAll(x, (f) => { f.ospfPrio = x.a[0]; })),
    c('no ip ospf priority', (x) => ifAll(x, (f) => { f.ospfPrio = null; })),
    c('ip ospf network {point-to-point|broadcast}', (x) => ifAll(x, (f) => { f.ospfNet = x.a[0] === 'point-to-point' ? 'p2p' : 'broadcast'; })),
    c('no ip ospf network', (x) => ifAll(x, (f) => { f.ospfNet = null; })),
    c('ip ospf <num> area <num>', (x) => ifAll(x, (f) => { f.ospfPid = x.a[0]; f.ospfArea = x.a[1]; })),
    c('ip ospf hello-interval <num>', (x) => ifAll(x, (f) => { f.ospfHello = x.a[0]; })),
    c('no ip ospf hello-interval', (x) => ifAll(x, (f) => { f.ospfHello = null; })),
    c('ip ospf dead-interval <num>', () => R([])),
    c('ip proxy-arp', (x) => ifAll(x, (f) => { f.proxyArp = true; })),
    c('no ip proxy-arp', (x) => ifAll(x, (f) => { f.proxyArp = false; })),
    ...SUBMODE_TAIL,
  ];
  const IF_ROUTER = [
    ...IF_L3,
    c('ipv6 address <ip6p>', (x) => addr6(x, x.a[0], false)),
    c('ipv6 traffic-filter <word> {in|out}', (x) => ifAll(x, (f) => { (f.ipv6Filter ||= {})[x.a[1]] = x.a[0]; })),
    c('no ipv6 traffic-filter <word> {in|out}', (x) => ifAll(x, (f) => { if (f.ipv6Filter) delete f.ipv6Filter[x.a[1]]; })),
    c('ipv6 address <ip6p> eui-64', (x) => addr6(x, x.a[0], true)),
    c('ipv6 address <ip6> link-local', (x) => ifAll(x, (f) => { if (!A6.isLinkLocal(x.a[0])) return ['% Lab: địa chỉ link-local phải thuộc FE80::/10']; f.ll = x.a[0]; })),
    c('no ipv6 address', (x) => ifAll(x, (f) => { f.ipv6 = []; f.ll = null; })),
    c('no ipv6 address <ip6p>', (x) => ifAll(x, (f) => { f.ipv6 = (f.ipv6 || []).filter((a) => !(a.ip === x.a[0].ip && a.prefix === x.a[0].prefix)); })),
    c('ipv6 enable', (x) => ifAll(x, (f) => { f.ipv6Enable = true; })),
    c('zone-member security <word>', (x) => { if (!x.d.zbf?.zones[x.a[0]]) return R([`% Zone ${x.a[0]} chưa tồn tại — tạo bằng "zone security ${x.a[0]}" trước`]); return ifAll(x, (f) => { f.zone = x.a[0]; }); }),
    c('no zone-member security <word>', (x) => ifAll(x, (f) => { if (f.zone === x.a[0]) f.zone = null; })),
    c('no ipv6 enable', (x) => ifAll(x, (f) => { f.ipv6Enable = false; })),
    c('ipv6 ospf <num> area <num>', (x) => ospf6If(x, x.a[0], x.a[1])),
    c('no ipv6 ospf <num> area <num>', (x) => ifAll(x, (f) => { f.ospf6 = null; })),
    c('encapsulation dot1q <num>', (x) => encapSet(x, x.a[0], false)),
    c('encapsulation dot1q <num> native', (x) => encapSet(x, x.a[0], true)),
    c('encapsulation {ppp|hdlc}', (x) => l2encSet(x, x.a[0])),
    c('ppp authentication {chap|pap}', (x) => ifAll(x, (f) => { f.pppAuth = x.a[0]; })),
    c('no ppp authentication', (x) => ifAll(x, (f) => { f.pppAuth = null; })),
    c('ip nat {inside|outside}', (x) => ifAll(x, (f) => { f.nat = x.a[0]; })),
    c('no ip nat {inside|outside}', (x) => ifAll(x, (f) => { f.nat = null; })),
    c('crypto map <word>', (x) => ifAll(x, (f) => { f.cryptoMap = x.a[0]; return ['%CRYPTO-6-ISAKMP_ON_OFF: ISAKMP is ON']; })),
    c('no crypto map', (x) => ifAll(x, (f) => { f.cryptoMap = null; })),
    c('no crypto map <word>', (x) => ifAll(x, (f) => { f.cryptoMap = null; })),
    c('cdp enable', (x) => ifAll(x, (f) => { f.cdp = true; })),
    c('no cdp enable', (x) => ifAll(x, (f) => { f.cdp = false; })),
    c('lldp {transmit|receive}', (x) => ifAll(x, (f) => { f[x.a[0] === 'transmit' ? 'lldpTx' : 'lldpRx'] = true; })),
    c('no lldp {transmit|receive}', (x) => ifAll(x, (f) => { f[x.a[0] === 'transmit' ? 'lldpTx' : 'lldpRx'] = false; })),
    c('tunnel source <if>', (x) => tunSet(x, 'tunSrc', x.a[0])),
    c('tunnel source <ip>', (x) => tunSet(x, 'tunSrc', x.a[0])),
    c('tunnel destination <ip>', (x) => tunSet(x, 'tunDst', x.a[0])),
    c('no tunnel destination', (x) => tunSet(x, 'tunDst', null)),
    c('tunnel mode gre ip', () => R([])),
    c('bandwidth <num>', (x) => ifAll(x, (f) => { f.bw = x.a[0]; })),
    c('no bandwidth', (x) => ifAll(x, (f) => { f.bw = null; })),
    c('clock rate <num>', (x) => ifAll(x, (f) => { f.clock = x.a[0]; })),
    c('duplex {auto|full|half}', (x) => ifAll(x, (f) => { f.duplex = x.a[0] === 'auto' ? null : x.a[0]; })),
    c('speed {auto|10|100|1000}', (x) => ifAll(x, (f, n) => setSpeed(f, n, x.a[0]))),
  ];
  const IF_SWITCH = [
    c('switchport mode {access|trunk}', (x) => ports(x, (p) => { p.mode = x.a[0]; p.modeSet = true; })),
    c('switchport mode dynamic {auto|desirable}', (x) => ports(x, (p) => { if (p.nonegotiate) return ["Conflict between 'nonegotiate' and 'dynamic' status on this interface"]; p.mode = 'access'; p.modeSet = false; p.dyn = x.a[0]; })),
    c('switchport mode private-vlan {host|promiscuous}', (x) => ports(x, (p) => { p.mode = 'private-vlan'; p.modeSet = true; p.pv = { ...(p.pv || {}), mode: x.a[0] }; })),
    c('switchport private-vlan host-association <num> <num>', (x) => ports(x, (p) => { p.pv = { ...(p.pv || { mode: 'host' }), primary: x.a[0], secondary: x.a[1] }; })),
    c('switchport private-vlan mapping <num> <rest>', (x) => pvMapping(x, x.a[0], x.a[1])),
    c('switchport access vlan <num>', (x) => accessVlan(x, x.a[0])),
    c('no switchport access vlan', (x) => ports(x, (p) => { p.vlan = 1; })),
    c('switchport trunk allowed vlan <rest>', (x) => allowedSet(x, x.a[0])),
    c('no switchport trunk allowed vlan', (x) => ports(x, (p) => { p.allowed = null; })),
    c('switchport trunk native vlan <num>', (x) => ports(x, (p) => { p.native = x.a[0]; })),
    c('no switchport trunk native vlan', (x) => ports(x, (p) => { p.native = 1; })),
    c('switchport trunk encapsulation {dot1q|negotiate}', () => R([])),
    c('switchport nonegotiate', (x) => ports(x, (p) => { if (!p.modeSet) return ["Conflict between 'nonegotiate' and 'dynamic' status on this interface"]; p.nonegotiate = true; })),
    c('no switchport nonegotiate', (x) => ports(x, (p) => { p.nonegotiate = false; })),
    c('switchport protected', (x) => ports(x, (p) => { p.protected = true; })),
    c('no switchport protected', (x) => ports(x, (p) => { p.protected = false; })),
    c('switchport port-security', (x) => psSet(x, (ps) => ps)),
    c('no switchport port-security', (x) => ports(x, (p) => { p.ps = null; })),
    c('switchport port-security maximum <num>', (x) => psSet(x, (ps) => { ps.max = x.a[0]; }, true)),
    c('switchport port-security mac-address sticky', (x) => psSet(x, (ps) => { ps.sticky = true; }, true)),
    c('switchport port-security mac-address <word>', (x) => { const m = N.parseCiscoMac(x.a[0]); if (!m) return R(['% Invalid MAC address (dạng aaaa.bbbb.cccc)']); return psSet(x, (ps) => { if (!ps.macs.includes(m)) ps.macs.push(m); }, true); }),
    c('switchport port-security violation {protect|restrict|shutdown}', (x) => psSet(x, (ps) => { ps.violation = x.a[0]; }, true)),
    c('spanning-tree portfast', (x) => ports(x, (p) => { p.portfast = true; }, ['%Warning: portfast should only be enabled on ports connected to a single', ' host. Connecting hubs, concentrators, switches, bridges, etc... to this', ' interface  when portfast is enabled, can cause temporary bridging loops.', ' Use with CAUTION'])),
    c('no spanning-tree portfast', (x) => ports(x, (p) => { p.portfast = false; })),
    c('spanning-tree bpduguard enable', (x) => ports(x, (p) => { p.bpduguard = true; }, null, (n) => (N.errDisabled(net, x.d, n) ? [`%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port ${longIf(n)} with BPDU Guard enabled. Disabling port.`, `%PM-4-ERR_DISABLE: bpduguard error detected on ${shortIf(n)}, putting ${shortIf(n)} in err-disable state`] : []))),
    c('no spanning-tree bpduguard enable', (x) => ports(x, (p) => { p.bpduguard = false; })),
    c('spanning-tree bpduguard disable', (x) => ports(x, (p) => { p.bpduguard = false; })),
    c('channel-group <num> mode {active|passive|on|desirable|auto}', (x) => chGroup(x, x.a[0], x.a[1])),
    c('no channel-group', (x) => ports(x, (p) => { p.group = null; p.chMode = null; })),
    c('ip dhcp snooping trust', (x) => ports(x, (p) => { p.trust = true; })),
    c('no ip dhcp snooping trust', (x) => ports(x, (p) => { p.trust = false; })),
    c('ip arp inspection trust', (x) => ports(x, (p) => { p.daiTrust = true; })),
    c('no ip arp inspection trust', (x) => ports(x, (p) => { p.daiTrust = false; })),
    c('ip arp inspection limit rate <num>', (x) => ports(x, (p) => { p.daiRate = x.a[0]; })),
    c('ip dhcp snooping limit rate <num>', (x) => ports(x, (p) => { p.dhcpRate = x.a[0]; })),
    c('no ip dhcp snooping limit rate', (x) => ports(x, (p) => { p.dhcpRate = null; })),
    c('ip verify source', (x) => ports(x, (p) => { p.ipsg = true; })),
    c('ip verify source port-security', (x) => ports(x, (p) => { p.ipsg = true; })),
    c('no ip verify source', (x) => ports(x, (p) => { p.ipsg = false; })),
    c('cdp enable', (x) => ports(x, (p) => { p.cdp = true; })),
    c('no cdp enable', (x) => ports(x, (p) => { p.cdp = false; })),
    c('lldp {transmit|receive}', (x) => ports(x, (p) => { p[x.a[0] === 'transmit' ? 'lldpTx' : 'lldpRx'] = true; })),
    c('no lldp {transmit|receive}', (x) => ports(x, (p) => { p[x.a[0] === 'transmit' ? 'lldpTx' : 'lldpRx'] = false; })),
    c('shutdown', (x) => ports(x, (p) => { p.shutdown = true; }, null, (n) => [`%LINK-5-CHANGED: Interface ${longIf(n)}, changed state to administratively down`])),
    c('no shutdown', (x) => ports(x, (p) => { p.shutdown = false; p.errdis = false; }, null, (n) => (N.lineUp(net, x.d.id, n) ? [`%LINK-5-CHANGED: Interface ${longIf(n)}, changed state to up`, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longIf(n)}, changed state to up`] : N.errDisabled(net, x.d, n) ? [`%PM-4-ERR_DISABLE: bpduguard error detected on ${shortIf(n)}, putting ${shortIf(n)} in err-disable state`] : []))),
    c('description <rest>', (x) => ports(x, (p) => { p.desc = x.a[0]; })),
    c('no description', (x) => ports(x, (p) => { p.desc = ''; })),
    c('duplex {auto|full|half}', (x) => ports(x, (p) => { p.duplex = x.a[0] === 'auto' ? null : x.a[0]; })),
    c('speed {auto|10|100|1000}', (x) => ports(x, (p, n) => setSpeed(p, n, x.a[0]))),
    c('spanning-tree guard {root|loop|none}', (x) => ports(x, (p) => { p.rootGuard = x.a[0] === 'root'; p.loopGuard = x.a[0] === 'loop'; })),
    c('no spanning-tree guard', (x) => ports(x, (p) => { p.rootGuard = false; p.loopGuard = false; })),
    c('storm-control broadcast level <num>', (x) => ports(x, (p) => { (p.storm ||= {}).level = x.a[0]; })),
    c('no storm-control broadcast level', (x) => ports(x, (p) => { if (p.storm) p.storm.level = null; })),
    c('storm-control action {shutdown|trap}', (x) => ports(x, (p) => { (p.storm ||= {}).action = x.a[0]; })),
    c('no storm-control action', (x) => ports(x, (p) => { if (p.storm) p.storm.action = null; })),
    c('ipv6 nd raguard attach-policy <word>', (x) => { if (!x.d.raPolicies?.[x.a[0]]) return R([`% Policy ${x.a[0]} chưa tồn tại — tạo bằng "ipv6 nd raguard policy ${x.a[0]}" trước`]); return ports(x, (p) => { p.raGuard = x.a[0]; }); }),
    c('no ipv6 nd raguard attach-policy', (x) => ports(x, (p) => { p.raGuard = null; })),
    c('sfp-swap {sx|lx}', (x) => ports(x, (p, n) => { if (!p.sfp) return [`(Lab: ${longIf(n)} không có khe SFP)`]; p.sfp = x.a[0].toUpperCase(); return [`(Lab: đã thay module ${p.sfp} vào ${longIf(n)})`]; })),
    c('switchport voice vlan <num>', (x) => ports(x, (p) => { p.voiceVlan = x.a[0]; }, x.d.vlans[x.a[0]] ? null : voiceVlanNew(x))),
    c('no switchport voice vlan', (x) => ports(x, (p) => { p.voiceVlan = null; })),
    c('power inline {auto|never}', (x) => ports(x, (p) => { p.power = x.a[0]; })),
    ...SUBMODE_TAIL,
  ];
  const IF_SVI = IF_L3;
  const VLAN_MODE = [
    c('name <word>', (x) => { for (const v of x.s.vlans) x.d.vlans[v] = x.a[0]; vtpBump(x.d); return R([]); }),
    c('private-vlan {primary|isolated|community}', (x) => pvType(x, x.a[0])),
    c('no private-vlan {primary|isolated|community}', (x) => { for (const v of x.s.vlans) delete x.d.pvlan[v]; return R([]); }),
    c('private-vlan association <rest>', (x) => pvAssoc(x, x.a[0])),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const AAASRV_MODE = [c('address ipv4 <ip>', (x) => { x.d.aaa.servers[x.s.aaaSrv].ip = x.a[0]; return R([]); }), c('address ipv4 <ip> auth-port <num> acct-port <num>', (x) => { x.d.aaa.servers[x.s.aaaSrv].ip = x.a[0]; return R([]); }), c('key <word>', (x) => { x.d.aaa.servers[x.s.aaaSrv].key = x.a[0]; return R([]); }), c('exit', (x) => { x.s.mode = 'config'; return R([]); })];
  const RAGPOL_MODE = [c('device-role {host|router}', (x) => { x.d.raPolicies[x.s.rag].role = x.a[0]; return R([]); }), c('exit', (x) => { x.s.mode = 'config'; return R([]); })];
  const ZONE_MODE = [c('description <rest>', (x) => { x.d.zbf.zones[x.s.zone].desc = x.a[0]; return R([]); }), c('exit', (x) => { x.s.mode = 'config'; return R([]); })];
  const CMAPI_MODE = [
    c('match protocol <word>', (x) => { const m = x.d.zbf.classMaps[x.s.cm].matches; if (!m.some((e) => e.protocol === x.a[0].toLowerCase())) m.push({ protocol: x.a[0].toLowerCase() }); return R([]); }),
    c('no match protocol <word>', (x) => { const cm = x.d.zbf.classMaps[x.s.cm]; cm.matches = cm.matches.filter((e) => e.protocol !== x.a[0].toLowerCase()); return R([]); }),
    c('match access-group name <word>', (x) => { x.d.zbf.classMaps[x.s.cm].matches.push({ acl: x.a[0] }); return R([]); }),
    c('match access-group <num>', (x) => { x.d.zbf.classMaps[x.s.cm].matches.push({ acl: String(x.a[0]) }); return R([]); }),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
  ];
  const PMAPI_MODE = [
    c('class type inspect <word>', (x) => { if (!x.d.zbf.classMaps[x.a[0]]) return R([`% class-map ${x.a[0]} chưa tồn tại`]); pmClass(x, x.a[0]); return R([]); }),
    c('class class-default', (x) => { pmClass(x, 'class-default'); return R([]); }),
    c('no class type inspect <word>', (x) => { const z = x.d.zbf; z.policyMaps[x.s.pm] = z.policyMaps[x.s.pm].filter((e) => e.cls !== x.a[0]); return R([]); }),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
  ];
  const pmAct = (a) => (x) => { x.d.zbf.policyMaps[x.s.pm].find((e) => e.cls === x.s.pmc).action = a; return R([]); };
  const PMAPIC_MODE = [c('inspect', pmAct('inspect')), c('pass', pmAct('pass')), c('drop', pmAct('drop')), c('drop log', pmAct('drop')), c('exit', (x) => { x.s.mode = 'pmapi'; return R([]); })];
  const ZPAIR_MODE = [
    c('service-policy type inspect <word>', (x) => { if (!x.d.zbf.policyMaps[x.a[0]]) return R([`% policy-map ${x.a[0]} chưa tồn tại`]); x.d.zbf.pairs.find((p) => p.name === x.s.zp).policy = x.a[0]; return R([]); }),
    c('no service-policy type inspect <word>', (x) => { x.d.zbf.pairs.find((p) => p.name === x.s.zp).policy = null; return R([]); }),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
  ];
  const OSPF6_MODE = [
    c('router-id <ip>', (x) => { x.d.ospf6.rid = x.a[0]; return R([]); }),
    c('no router-id', (x) => { x.d.ospf6.rid = null; return R([]); }),
    c('passive-interface <if>', (x) => { const o = x.d.ospf6; if (!o.passive.includes(x.a[0])) o.passive.push(x.a[0]); return R([]); }),
    c('no passive-interface <if>', (x) => { x.d.ospf6.passive = x.d.ospf6.passive.filter((n) => n !== x.a[0]); return R([]); }),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
  ];
  const OSPF_MODE = [
    c('network <ip> <wild> area <num>', (x) => ospfNet(x, x.a[0], x.a[1], x.a[2], true)),
    c('network <ip> <wild> area <ip>', (x) => ospfNet(x, x.a[0], x.a[1], N.ip2n(x.a[2]), true)),
    c('no network <ip> <wild> area <num>', (x) => ospfNet(x, x.a[0], x.a[1], x.a[2], false)),
    c('router-id <ip>', (x) => { x.d.ospf.rid = x.a[0]; return R(['Reload or use "clear ip ospf process" command, for this to take effect']); }),
    c('no router-id', (x) => { x.d.ospf.rid = null; return R([]); }),
    c('passive-interface default', (x) => { x.d.ospf.passiveDefault = true; x.d.ospf.noPassive = []; return R([]); }),
    c('no passive-interface default', (x) => { x.d.ospf.passiveDefault = false; x.d.ospf.passive = []; return R([]); }),
    c('passive-interface <if>', (x) => { const o = x.d.ospf; if (o.passiveDefault) o.noPassive = o.noPassive.filter((n) => n !== x.a[0]); else if (!o.passive.includes(x.a[0])) o.passive.push(x.a[0]); return R([]); }),
    c('no passive-interface <if>', (x) => { const o = x.d.ospf; if (o.passiveDefault) { if (!o.noPassive.includes(x.a[0])) o.noPassive.push(x.a[0]); } else o.passive = o.passive.filter((n) => n !== x.a[0]); return R([]); }),
    c('default-information originate', (x) => { x.d.ospf.defaultOriginate = true; x.d.ospf.defaultAlways = false; return R([]); }),
    c('default-information originate always', (x) => { x.d.ospf.defaultOriginate = true; x.d.ospf.defaultAlways = true; return R([]); }),
    c('no default-information originate', (x) => { x.d.ospf.defaultOriginate = false; return R([]); }),
    c('redistribute {static|connected}', (x) => redist(x, 'ospf', x.a[0], { subnets: false })),
    c('redistribute {static|connected} subnets', (x) => redist(x, 'ospf', x.a[0], { subnets: true })),
    c('redistribute {static|connected} metric <num> subnets', (x) => redist(x, 'ospf', x.a[0], { subnets: true, metric: x.a[1] })),
    c('redistribute eigrp <num>', (x) => redist(x, 'ospf', 'eigrp', { as: x.a[0], subnets: false })),
    c('redistribute eigrp <num> subnets', (x) => redist(x, 'ospf', 'eigrp', { as: x.a[0], subnets: true })),
    c('redistribute eigrp <num> metric <num> subnets', (x) => redist(x, 'ospf', 'eigrp', { as: x.a[0], subnets: true, metric: x.a[1] })),
    c('redistribute bgp <num>', (x) => redist(x, 'ospf', 'bgp', { as: x.a[0], subnets: false })),
    c('redistribute bgp <num> subnets', (x) => redist(x, 'ospf', 'bgp', { as: x.a[0], subnets: true })),
    c('no redistribute {static|connected}', (x) => { delete x.d.ospf.redist?.[x.a[0]]; return R([]); }),
    c('no redistribute {eigrp|bgp} <num>', (x) => { delete x.d.ospf.redist?.[x.a[0]]; return R([]); }),
    c('auto-cost reference-bandwidth <num>', () => R(['% OSPF: Reference bandwidth is changed.', '        Please ensure reference bandwidth is consistent across all routers.'])),
    c('log-adjacency-changes', () => R([])),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const EIGRP_MODE = [
    c('network <ip>', (x) => eigrpNet(x, x.a[0], null, true)),
    c('network <ip> <wild>', (x) => eigrpNet(x, x.a[0], x.a[1], true)),
    c('no network <ip>', (x) => eigrpNet(x, x.a[0], null, false)),
    c('no network <ip> <wild>', (x) => eigrpNet(x, x.a[0], x.a[1], false)),
    c('no auto-summary', (x) => { x.d.eigrp.autoSummary = false; return R([]); }),
    c('auto-summary', (x) => { x.d.eigrp.autoSummary = true; return R([]); }),
    c('passive-interface <if>', (x) => { if (!x.d.eigrp.passive.includes(x.a[0])) x.d.eigrp.passive.push(x.a[0]); return R([]); }),
    c('no passive-interface <if>', (x) => { x.d.eigrp.passive = x.d.eigrp.passive.filter((n) => n !== x.a[0]); return R([]); }),
    c('eigrp router-id <ip>', (x) => { x.d.eigrp.rid = x.a[0]; return R([]); }),
    c('redistribute {static|connected}', (x) => redist(x, 'eigrp', x.a[0], {})),
    c('redistribute {static|connected} metric <num> <num> <num> <num> <num>', (x) => redist(x, 'eigrp', x.a[0], { metric: [x.a[1], x.a[2]] })),
    c('redistribute ospf <num>', (x) => redist(x, 'eigrp', 'ospf', { pid: x.a[0] })),
    c('redistribute ospf <num> metric <num> <num> <num> <num> <num>', (x) => redist(x, 'eigrp', 'ospf', { pid: x.a[0], metric: [x.a[1], x.a[2]] })),
    c('redistribute bgp <num>', (x) => redist(x, 'eigrp', 'bgp', { as: x.a[0] })),
    c('redistribute bgp <num> metric <num> <num> <num> <num> <num>', (x) => redist(x, 'eigrp', 'bgp', { as: x.a[0], metric: [x.a[1], x.a[2]] })),
    c('no redistribute {static|connected}', (x) => { delete x.d.eigrp.redist?.[x.a[0]]; return R([]); }),
    c('no redistribute {ospf|bgp} <num>', (x) => { delete x.d.eigrp.redist?.[x.a[0]]; return R([]); }),
    c('default-metric <num> <num> <num> <num> <num>', (x) => { x.d.eigrp.defaultMetric = [x.a[0], x.a[1]]; return R([]); }),
    c('no default-metric', (x) => { x.d.eigrp.defaultMetric = null; return R([]); }),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const POOL_MODE = [
    c('network <ip> <mask>', (x) => { const p = x.d.dhcp.pools[x.s.pool]; p.prefix = maskToPrefix(x.a[1]); p.net = netOf(x.a[0], p.prefix); return R([]); }),
    c('default-router <ip>', (x) => { x.d.dhcp.pools[x.s.pool].router = x.a[0]; return R([]); }),
    c('no default-router', (x) => { x.d.dhcp.pools[x.s.pool].router = null; return R([]); }),
    c('dns-server <ip>', (x) => { x.d.dhcp.pools[x.s.pool].dns = x.a[0]; return R([]); }),
    c('no dns-server', (x) => { x.d.dhcp.pools[x.s.pool].dns = null; return R([]); }),
    c('domain-name <word>', (x) => { x.d.dhcp.pools[x.s.pool].domain = x.a[0]; return R([]); }),
    c('lease <num>', () => R([])),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const ACL_MODE = [
    c('{permit|deny} <rest>', (x) => aclEntry(x, null, x.a[0] + ' ' + x.a[1])),
    c('<num> {permit|deny} <rest>', (x) => aclEntry(x, x.a[0], x.a[1] + ' ' + x.a[2])),
    c('remark <rest>', (x) => { const a = x.d.acls[x.s.acl]; aclPush(a, { remark: x.a[0] }, null); return R([]); }),
    c('no <num>', (x) => { const a = x.d.acls[x.s.acl]; a.entries = a.entries.filter((e) => e.seq !== x.a[0]); return R([]); }),
    c('no {permit|deny} <rest>', (x) => aclNoLine(x, x.a[0] + ' ' + x.a[1])),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const LINE_MODE = [
    c('password <word>', (x) => { line(x).password = x.a[0]; return R([]); }),
    c('password 7 <word>', (x) => { line(x).password = untype7(x.a[0]); return R([]); }),
    c('no password', (x) => { line(x).password = null; return R([]); }),
    c('login', (x) => { if (!line(x).password && x.s.line === 'con') { line(x).login = true; return R(['% Login disabled on line 0, until \'password\' is set']); } line(x).login = true; line(x).loginLocal = false; return R([]); }),
    c('login local', (x) => { line(x).loginLocal = true; line(x).login = false; return R([]); }),
    c('no login', (x) => { line(x).login = false; line(x).loginLocal = false; return R([]); }),
    c('transport input {ssh|telnet|all|none}', (x) => { line(x).transport = x.a[0]; return R([]); }),
    c('transport input telnet ssh', (x) => { line(x).transport = 'telnet ssh'; return R([]); }),
    c('transport input ssh telnet', (x) => { line(x).transport = 'telnet ssh'; return R([]); }),
    c('access-class <word> in', (x) => { line(x).accessClass = x.a[0]; return R([]); }),
    c('no access-class <word> in', (x) => { line(x).accessClass = null; return R([]); }),
    c('exec-timeout <num> <num>', (x) => { line(x).execTimeout = [x.a[0], x.a[1]]; return R([]); }),
    c('exec-timeout <num>', (x) => { line(x).execTimeout = [x.a[0], 0]; return R([]); }),
    c('no exec-timeout', (x) => { line(x).execTimeout = null; return R([]); }),
    c('login authentication <word>', (x) => { if (!x.d.aaa?.newModel) return R(['% AAA chưa bật — gõ "aaa new-model" trước']); line(x).authList = x.a[0]; return R([]); }),
    c('no login authentication', (x) => { line(x).authList = null; return R([]); }),
    c('logging synchronous', (x) => { line(x).logSync = true; return R([]); }),
    c('no logging synchronous', (x) => { line(x).logSync = false; return R([]); }),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const ISAKMP_MODE = [
    c('encryption {des|3des|aes}', (x) => { isak(x).encr = x.a[0]; return R([]); }),
    c('encryption aes <num>', (x) => { isak(x).encr = x.a[0] === 128 ? 'aes' : `aes ${x.a[0]}`; return R([]); }),
    c('hash {sha|md5|sha256}', (x) => { isak(x).hash = x.a[0]; return R([]); }),
    c('authentication {pre-share|rsa-sig}', (x) => { isak(x).auth = x.a[0]; return R([]); }),
    c('group <num>', (x) => { isak(x).group = x.a[0]; return R([]); }),
    c('lifetime <num>', (x) => { isak(x).lifetime = x.a[0]; return R([]); }),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const TSET_MODE = [
    c('mode {tunnel|transport}', () => R([])),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const CMAP_MODE = [
    c('set peer <ip>', (x) => { cmap(x).peer = x.a[0]; return R([]); }),
    c('no set peer <ip>', (x) => { cmap(x).peer = null; return R([]); }),
    c('set transform-set <word>', (x) => { cmap(x).tset = x.a[0]; return R([]); }),
    c('match address <word>', (x) => { cmap(x).acl = x.a[0]; return R([]); }),
    c('no match address <word>', (x) => { cmap(x).acl = null; return R([]); }),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const BGP_MODE = [
    c('bgp router-id <ip>', (x) => { x.d.bgp.rid = x.a[0]; return R([]); }),
    c('bgp log-neighbor-changes', () => R([])),
    c('neighbor <ip> remote-as <num>', (x) => { x.d.bgp.neighbors[x.a[0]] = { ...(x.d.bgp.neighbors[x.a[0]] || {}), remoteAs: x.a[1] }; return R([]); }),
    c('neighbor <ip> default-originate', (x) => nbr(x, (n) => { n.defaultOriginate = true; })),
    c('neighbor <ip> next-hop-self', (x) => nbr(x, (n) => { n.nextHopSelf = true; })),
    c('neighbor <ip> description <rest>', (x) => nbr(x, (n) => { n.desc = x.a[1]; })),
    c('neighbor <ip> update-source <if>', (x) => nbr(x, (n) => { n.updateSource = x.a[1]; })),
    c('no neighbor <ip>', (x) => { delete x.d.bgp.neighbors[x.a[0]]; return R([]); }),
    c('no neighbor <ip> default-originate', (x) => nbr(x, (n) => { n.defaultOriginate = false; })),
    c('no neighbor <ip> next-hop-self', (x) => nbr(x, (n) => { n.nextHopSelf = false; })),
    c('network <ip> mask <mask>', (x) => bgpNet(x, x.a[0], maskToPrefix(x.a[1]), true)),
    c('network <ip>', (x) => { const a = +x.a[0].split('.')[0]; return bgpNet(x, x.a[0], a < 128 ? 8 : a < 192 ? 16 : 24, true); }),
    c('no network <ip> mask <mask>', (x) => bgpNet(x, x.a[0], maskToPrefix(x.a[1]), false)),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const MST_MODE = [
    c('name <word>', (x) => { mst(x).name = x.a[0]; return R([]); }),
    c('revision <num>', (x) => { mst(x).rev = x.a[0]; return R([]); }),
    c('instance <num> vlan <vlist>', (x) => { mst(x).inst[x.a[0]] = [...new Set([...(mst(x).inst[x.a[0]] || []), ...x.a[1]])]; return R([]); }),
    c('no instance <num>', (x) => { delete mst(x).inst[x.a[0]]; return R([]); }),
    c('show current', (x) => R(mstShow(x.d))),
    c('show pending', (x) => R(mstShow(x.d))),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const VAMAP_MODE = [
    c('match ip address <word>', (x) => { vam(x).acl = x.a[0]; return R([]); }),
    c('action {forward|drop}', (x) => { vam(x).action = x.a[0]; return R([]); }),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];

  const showsFor = (d) => [...(isRouter(d) ? SHOW_ROUTER : SHOW_SWITCH), ...SHOW_COMMON];
  const userShows = (d) => showsFor(d).filter((e) => !['running-config', 'startup-config'].includes(e.toks[1]));
  // Cisco ASA: bộ lệnh riêng (lab/asa.js), dùng chung parser / ping / lưu cấu hình
  const ASA = makeAsa({
    c, R, net, iosPing: (d, ip) => iosPing(d, ip), iosTrace: (d, ip) => iosTrace(d, ip), toPriv: (x) => toPriv(x), saveCfg: (x) => saveCfg(x),
    doIn: (x, table) => { const words = x.a[0].split(/\s+/); const p = parse(table, words); return p.hit ? p.hit.fn({ ...x, a: p.args, words }) : errOut(p, { mode: 'config' }, x.a[0], words, 'do '); },
  });
  // Firewall các hãng có cú pháp riêng (không dùng bảng lệnh IOS): xử lý cả dòng lệnh
  const GUIFW = makeGuiFw({ R });
  const VENDOR = { fortios: makeForti({ net, R }), panos: makePan({ net, R }), sophos: GUIFW, checkpoint: GUIFW, pfsense: GUIFW, wlc: makeWlc({ net, R }) };
  const LINUX = makeLinux({ net, R, sshConnect: (d, ip, user, s) => sshConnect(d, ip, user, s), iosRun: (dev, cmds) => { const c = createCli(net); c.session(dev).mode = 'priv'; return cmds.map((l) => c.exec(dev, l).out); }, iosConfig: (dev) => { const { logBuf, ...rest } = net.devices[dev]; return JSON.stringify(rest); } });
  const NP = makeNp({ c, net, IFS, toPriv, doExec, ifAll, ctxOf, showIpRoute, iosPing, iosTrace, execLine: (id, line) => exec(id, line), sess, redistSet: redist, T: { CFG_ROUTER, CFG_SWITCH, IF_ROUTER, IF_SVI, OSPF_MODE, EIGRP_MODE, BGP_MODE, LINE_MODE, VLAN_MODE, SHOW_ROUTER, SHOW_SWITCH, EXEC_PRIV, routerEigrp, showEigrpNei } });
  function tableFor(d, s) {
    if (d.os === 'asa') return ASA.tableFor(d, s);
    switch (s.mode) {
      case 'user': return [...EXEC_USER, ...userShows(d)];
      case 'priv': return [...EXEC_PRIV, ...showsFor(d)];
      case 'config': return isRouter(d) ? CFG_ROUTER : CFG_SWITCH;
      case 'if': case 'subif': case 'range':
        if (isRouter(d)) return IF_ROUTER;
        return s.ifs[0]?.startsWith('vlan') ? IF_SVI : IF_SWITCH;
      case 'vlan': return VLAN_MODE;
      case 'router': return s.rp === 'eigrp' ? EIGRP_MODE : OSPF_MODE;
      case 'pool': return POOL_MODE;
      case 'acl-std': case 'acl-ext': return ACL_MODE;
      case 'acl6': return ACL6_MODE;
      case 'line': return LINE_MODE;
      case 'isakmp': return ISAKMP_MODE;
      case 'tset': return TSET_MODE;
      case 'cmap': return CMAP_MODE;
      case 'vamap': return VAMAP_MODE;
      case 'bgp': return BGP_MODE;
      case 'ospf6': return OSPF6_MODE;
      case 'zone': return ZONE_MODE;
      case 'aaasrv': return AAASRV_MODE;
      case 'ragpol': return RAGPOL_MODE;
      case 'cmapi': return CMAPI_MODE;
      case 'pmapi': return PMAPI_MODE;
      case 'pmapic': return PMAPIC_MODE;
      case 'zpair': return ZPAIR_MODE;
      case 'mstcfg': return MST_MODE;
      default: return NP.modes[s.mode] || [];
    }
  }
  const ace6 = (x, words, seq) => {
    const e = ACL6.parseAce6(words);
    if (e.error) return R([e.error]);
    ACL6.addAce6(x.d.acls6[x.s.acl6], e, seq);
    return R([]);
  };
  const ACL6_MODE = [
    c('{permit|deny} <rest>', (x) => ace6(x, [x.a[0], ...x.a[1].split(/\s+/)])),
    c('sequence <num> {permit|deny} <rest>', (x) => ace6(x, [x.a[1], ...x.a[2].split(/\s+/)], x.a[0])),
    c('no sequence <num>', (x) => { const a = x.d.acls6[x.s.acl6]; a.entries = a.entries.filter((e) => e.seq !== x.a[0]); return R([]); }),
    c('remark <rest>', (x) => { ACL6.addAce6(x.d.acls6[x.s.acl6], { remark: x.a[0] }); return R([]); }),
    c('exit', (x) => { x.s.mode = 'config'; return R([]); }),
    c('end', (x) => toPriv(x)),
    c('do <rest>', (x) => doExec(x)),
  ];
  const cfgTable = (d) => (d.os === 'asa' ? ASA.cfgTable() : isRouter(d) ? CFG_ROUTER : CFG_SWITCH);
  const SUB = new Set([...Object.keys(NP.prompts), 'acl6', 'if', 'subif', 'range', 'vlan', 'router', 'pool', 'acl-std', 'acl-ext', 'line', 'isakmp', 'tset', 'cmap', 'vamap', 'bgp', 'mstcfg', 'ospf6', 'asaobj', 'pmap', 'pmapc', 'zone', 'aaasrv', 'ragpol', 'cmapi', 'pmapi', 'pmapic', 'zpair']);

  // ================== Thực thi ==================
  function prompt(id) {
    const d = net.devices[id];
    const s = sess(id);
    if (d.type === 'pc' || d.type === 'server') return s.pw === 'ssh' ? 'Password: ' : d.shell === 'linux' ? LINUX.prompt(d) : d.shell === 'vpcs' || d.badge ? `${d.name}> ` : 'C:\\>';
    if (d.rommon) return `rommon ${d.rommonUser ? s.rmn || 1 : 1} > `;
    if (s.ask) { const st = s.ask.steps[s.ask.i]; return typeof st.p === 'function' ? st.p(s.ask.data) : st.p; }
    if (s.pw) return s.pwPrompt || 'Password: ';
    if (s.loggedOut) return '';
    if (d.os === 'asa') return ASA.prompt(d, s);
    if (VENDOR[d.os]) return VENDOR[d.os].prompt(d, s);
    const h = d.name;
    return ({ user: `${h}>`, priv: `${h}#`, config: `${h}(config)#`, if: `${h}(config-if)#`, subif: `${h}(config-subif)#`, range: `${h}(config-if-range)#`, vlan: `${h}(config-vlan)#`, router: `${h}(config-router)#`, pool: `${h}(dhcp-config)#`, 'acl-std': `${h}(config-std-nacl)#`, 'acl-ext': `${h}(config-ext-nacl)#`, line: `${h}(config-line)#`, isakmp: `${h}(config-isakmp)#`, tset: `${h}(cfg-crypto-trans)#`, cmap: `${h}(config-crypto-map)#`, vamap: `${h}(config-access-map)#`, bgp: `${h}(config-router)#`, mstcfg: `${h}(config-mst)#`, ospf6: `${h}(config-rtr)#`, acl6: `${h}(config-ipv6-acl)#`, zone: `${h}(config-sec-zone)#`, aaasrv: `${h}(config-server-${d.aaa?.servers?.[s.aaaSrv]?.proto === 'radius' ? 'radius' : 'tacacs'})#`, ragpol: `${h}(config-nd-raguard)#`, cmapi: `${h}(config-cmap)#`, pmapi: `${h}(config-pmap)#`, pmapic: `${h}(config-pmap-c)#`, zpair: `${h}(config-sec-zone-pair)#` })[s.mode] || (NP.prompts[s.mode] ? `${h}(${NP.prompts[s.mode]})#` : `${h}#`);
  }

  function exec(id, raw) {
    const d = net.devices[id];
    const s = sess(id);
    const line = String(raw ?? '');
    let res;
    const tl = line.trim().toLowerCase();
    if (d.off) res = R(['% Thiết bị đang TẮT — chuột phải → Start (hoặc ▶ Start all) để bật.']);
    else if (tl === 'power-cycle' && (d.type === 'router' || d.type === 'switch') && !VENDOR[d.os] && d.os !== 'asa') {
      Object.assign(s, { ask: null, pw: null, mode: 'user' });
      d.rommon = false; d.rommonUser = false;
      res = R(['(Lab: mô phỏng TẮT NGUỒN rồi BẬT lại — cấu hình chưa "copy run start" sẽ mất)', ...doReload(d, s)]);
    } else if (d.bootWin && (tl === 'send break' || tl === 'break')) {
      // nhấn Break trong ~60 giây đầu khi khởi động → bootstrap dừng nạp IOS, vào ROMMON
      d.bootWin = false; d.rommon = true; d.rommonUser = true; s.loggedOut = false; s.rmn = 1;
      res = R(['', 'monitor: command "boot" aborted due to user interrupt']);
    } else if (d.rommon && d.rommonUser) res = rommonExec(d, s, line.trim());
    else if ((d.type === 'pc' || d.type === 'server') && !VENDOR[d.os]) res = s.pw === 'ssh' ? sshPw(d, s, line) : d.shell === 'linux' ? LINUX.exec(d, s, line.trim()) : d.shell === 'vpcs' ? vpcsExec(d, line.trim()) : pcExec(d, line.trim());
    else if (VENDOR[d.os]) res = VENDOR[d.os].exec(d, s, line.trim());
    else if (d.rommon) res = R(['(Lab: thiết bị đang ở ROMMON vì không có file IOS khởi động được — bấm "↺ Làm lại" để khôi phục lab.)']);
    else if (s.ask) {
      const a = s.ask;
      const st = a.steps[a.i];
      const v = line.trim();
      a.data[st.k] = v === '' ? (typeof st.def === 'function' ? st.def(a.data) : st.def ?? '') : v;
      a.i++;
      if (a.i < a.steps.length) res = R([]);
      else { s.ask = null; res = a.done(a.data); }
    } else if (s.pw) res = pwInput(d, s, line);
    else if (s.loggedOut) { d.bootWin = false; res = consoleLogin(d, s); }
    else {
      const t = line.trim();
      if (!t || t.startsWith('!')) res = R([]); // "!" = dòng chú thích (như khi dán show run)
      else if (t.endsWith('?')) res = help(d, s, t);
      else {
        (s.hist ||= []).push(t);
        let cmd = t, pipe = null;
        const k = t.indexOf('|');
        if (k > 0) { cmd = t.slice(0, k).trim(); pipe = t.slice(k + 1).trim(); }
        const inCfg = SUB.has(s.mode) || s.mode === 'config';
        // có đồng hồ mô phỏng: log OSPF/EIGRP/BGP/HSRP do đồng hồ in đúng lúc hội tụ, không in ngay
        const before = inCfg && !net.clock ? snap(d) : null;
        res = dispatch(d, s, cmd.split(/\s+/), cmd, prompt(id));
        if (pipe && res.out) res.out = applyPipe(res.out, pipe);
        if (d.type === 'switch') N.vtpSync(net);
        if (before) res.out = (res.out || []).concat(diffSnap(d, before, snap(d)));
        if (d.type === 'switch') res.out = (res.out || []).concat(pendingLogs(d, s));
        if (inCfg && s.mode === 'priv' && d.os !== 'asa') res.out = (res.out || []).concat('%SYS-5-CONFIG_I: Configured from console by console');
      }
    }
    res.out = res.out || [];
    if (d.type === 'router' || d.type === 'switch') {
      // dòng log in ngay (%LINK, %LINEPROTO, %SYS…) cũng vào buffer "show logging"
      for (const l of res.out) if (/^%[A-Z0-9_]+-\d-[A-Z0-9_]+:/.test(l)) N.logPush(net, id, l, false, true);
    }
    res.out = res.out.concat(NP.eemTick(id));
    if (net.clock) {
      N.clockSync(net, id);
      if (d.type === 'router' || d.type === 'switch') res.out = res.out.concat(N.drainLogs(net, id));
    }
    res.prompt = prompt(id);
    res.password = !!s.pw;
    return res;
  }

  function dispatch(d, s, words, raw, pr) {
    const p = parse(tableFor(d, s), words);
    // spec = mẫu lệnh đã khớp (vd "switchport trunk allowed vlan <vlist>") — cho thống kê / cheat sheet
    const withSpec = (r, spec) => (r && typeof r === 'object' ? { ...r, spec } : r);
    if (p.hit) return withSpec(p.hit.fn({ d, s, a: p.args, words, raw }), p.hit.spec);
    if (SUB.has(s.mode)) {
      const g = parse(cfgTable(d), words);
      if (g.hit) { s.mode = 'config'; s.ifs = []; return withSpec(g.hit.fn({ d, s, a: g.args, words, raw }), g.hit.spec); }
    }
    return errOut(p, s, raw, words, pr);
  }
  function errOut(p, s, raw, words, pr) {
    if (p.err === 'amb') return R([`% Ambiguous command:  "${raw}"`]);
    if (p.err === 'inc') return R(['% Incomplete command.', '']);
    if (p.at === 0 && (s.mode === 'user' || s.mode === 'priv')) {
      return R([`Translating "${words[0]}"...domain server (255.255.255.255)`, '% Unknown command or computer name, or unable to find computer address']);
    }
    const pos = [...raw.matchAll(/\S+/g)][p.at]?.index ?? raw.length;
    return R([' '.repeat(pr.length + pos) + '^', "% Invalid input detected at '^' marker.", '']);
  }
  function applyPipe(lines, pipe) {
    const m = pipe.match(/^(\S+)\s+(.*)$/);
    if (!m) return ['% Incomplete command.'];
    const kind = m[1].toLowerCase(), pat = m[2];
    let re;
    try { re = new RegExp(pat); } catch { re = { test: (x) => x.includes(pat) }; }
    if ('include'.startsWith(kind)) return lines.filter((l) => re.test(l));
    if ('exclude'.startsWith(kind)) return lines.filter((l) => !re.test(l));
    if ('begin'.startsWith(kind)) { const i = lines.findIndex((l) => re.test(l)); return i < 0 ? [] : lines.slice(i); }
    if ('section'.startsWith(kind)) {
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith(' ') && re.test(lines[i])) {
          out.push(lines[i]);
          while (i + 1 < lines.length && lines[i + 1].startsWith(' ')) out.push(lines[++i]);
        }
      }
      return out;
    }
    return ['% Invalid input detected.'];
  }

  function help(d, s, t) {
    const spaceQ = t === '?' || /\s\?$/.test(t);
    const body = t.slice(0, -1).trim();
    const words = body ? body.split(/\s+/) : [];
    const table = tableFor(d, s);
    const items = new Map();
    const addTok = (tk) => {
      if (tk[0] === '{') { for (const o of tk.slice(1, -1).split('|')) items.set(o, DESC[o] || ''); }
      else if (tk[0] === '<') items.set(PH[tk] || tk, '');
      else items.set(tk, DESC[tk] || '');
    };
    if (spaceQ) {
      for (const e of table) {
        const r = prefixMatch(e.toks, words);
        if (!r) continue;
        if (r.next) addTok(r.next); else items.set('<cr>', '');
      }
    } else {
      const pre = (words.pop() || '').toLowerCase();
      for (const e of table) {
        const r = prefixMatch(e.toks, words);
        if (!r || !r.next) continue;
        const tk = r.next;
        const opts = tk[0] === '{' ? tk.slice(1, -1).split('|') : tk[0] === '<' ? [] : [tk];
        for (const o of opts) if (o.startsWith(pre)) items.set(o, DESC[o] || '');
      }
      if (!items.size) return R(['% Unrecognized command']);
      return R([[...items.keys()].sort().join('  '), '']);
    }
    if (!items.size) return R(['% Unrecognized command']);
    const keys = [...items.keys()].sort((a, b) => (a === '<cr>') - (b === '<cr>') || a.localeCompare(b));
    return R([...keys.map((k) => `  ${pad(k, 22)}${items.get(k)}`), '']);
  }

  // ---------- hỏi đáp tương tác ----------
  function ask(x, steps, done) { x.s.ask = { steps, i: 0, data: {}, done }; return R([]); }
  const yes = (v) => v === '' || /^y/i.test(v) || /^c/i.test(v);

  // ---------- đăng nhập / enable ----------
  function enable(x) {
    if (x.d.enableSecret || x.d.enablePassword) { x.s.pw = 'enable'; x.s.pwPrompt = 'Password: '; x.s.tries = 0; return R([]); }
    x.s.mode = 'priv';
    return R([]);
  }
  function pwInput(d, s, line) {
    if (s.pw === 'ssh') return sshPw(d, s, line);
    const pw = line.trim();
    if (s.pw === 'enable') {
      const good = d.enableSecret ? pw === d.enableSecret : pw === d.enablePassword;
      if (good) { s.pw = null; s.mode = 'priv'; return R([]); }
      if (++s.tries >= 3) { s.pw = null; return R(['% Bad secrets', '']); }
      return R([]);
    }
    if (s.pw === 'conuser') { s.user = pw; s.pw = 'conpw'; s.pwPrompt = 'Password: '; return R([]); }
    const con = d.lines.con;
    const good = s.pw === 'conpw' ? d.users[s.user] && d.users[s.user].pw === pw : pw === con.password;
    if (good) { s.pw = null; s.mode = 'user'; return R(['']); }
    if (++s.tries >= 3) { s.pw = null; s.loggedOut = true; return R(['% Bad passwords', '', `${d.name} con0 is now available`, '', 'Press RETURN to get started.']); }
    if (s.pw === 'conpw') { s.pw = 'conuser'; s.pwPrompt = 'Username: '; return R(['% Login invalid', '']); }
    return R([]);
  }
  function logout(x) {
    x.s.mode = 'user';
    x.s.loggedOut = true;
    return R(['', `${x.d.name} con0 is now available`, '', '', '', '', '', 'Press RETURN to get started.']);
  }
  function consoleLogin(d, s) {
    s.loggedOut = false;
    s.tries = 0;
    const out = [''];
    if (d.banner) out.push(d.banner, '');
    const con = d.lines.con;
    if (con.loginLocal && Object.keys(d.users).length) { out.push('', 'User Access Verification', ''); s.pw = 'conuser'; s.pwPrompt = 'Username: '; }
    else if (con.login && con.password) { out.push('', 'User Access Verification', ''); s.pw = 'con'; s.pwPrompt = 'Password: '; }
    s.mode = 'user';
    return R(out);
  }

  // ---------- cấu hình chung ----------
  function toPriv(x) { x.s.mode = 'priv'; x.s.ifs = []; return R([]); }
  function doExec(x) {
    const words = x.a[0].split(/\s+/);
    const p = parse([...EXEC_PRIV, ...showsFor(x.d)], words);
    if (p.hit) return p.hit.fn({ ...x, a: p.args, words });
    return errOut(p, { mode: 'config' }, x.a[0], words, 'do ');
  }
  function bannerSet(x) {
    const r = x.a[0];
    const dch = r[0];
    const end = r.indexOf(dch, 1);
    x.d.banner = end > 0 ? r.slice(1, end) : r.slice(1);
    return R([]);
  }
  function rsaGen(x, bits) {
    const errs = [];
    if (x.d.name === 'Router' || x.d.name === 'Switch') errs.push('% Please define a hostname other than Router.');
    if (!x.d.domain) errs.push('% Please define a domain-name first.');
    if (errs.length) return R(errs);
    x.d.rsa = bits;
    const out = [`The name for the keys will be: ${x.d.name}.${x.d.domain}`];
    if (bits === 512 && x.words.length <= 4) out.unshift('How many bits in the modulus [512]: 512 (mặc định — Lab: hãy dùng "modulus 1024" để có SSH v2)');
    out.push(`% Generating ${bits} bit RSA keys, keys will be non-exportable...[OK]`, '%SSH-5-ENABLED: SSH 1.99 has been enabled');
    if (bits < 768) out.push('% Lab: khoá dưới 768 bit KHÔNG đủ cho SSH version 2.');
    return R(out);
  }
  function userSet(x, u, p, priv, kind) { const e = pwShort(x, p); if (e) return e; x.d.users[u] = { pw: p, priv, kind }; return R([]); }
  /** "security passwords min-length N": từ chối mật khẩu mới ngắn hơn N ký tự. */
  function pwShort(x, p) { return x.d.pwMin && String(p).length < x.d.pwMin ? R([`% Password too short - must be at least ${x.d.pwMin} characters. Password configuration failed`]) : null; }
  function loginBlock(x) {
    const [blockFor, attempts, within] = x.a;
    if (!blockFor || !attempts || !within) return R(['% Invalid input: giá trị phải > 0']);
    x.d.loginSec = { ...(x.d.loginSec || {}), blockFor, attempts, within, fails: [], quietUntil: 0 };
    return R([]);
  }
  function aaaSrv(x, proto) {
    x.d.aaa ||= { lists: {} };
    (x.d.aaa.servers ||= {})[x.a[0]] ||= { proto, ip: null, key: null };
    x.s.mode = 'aaasrv'; x.s.aaaSrv = x.a[0];
    return R([]);
  }
  const AAA_PORT = { 'tacacs+': { proto: 'tcp', dport: 49 }, radius: { proto: 'udp', dport: 1812 } };
  /** Máy chủ AAA trả lời được chưa: có đường tới, mở cổng, đúng khoá chung. Trả thiết bị máy chủ hoặc null. */
  function aaaSrvUp(d, s) {
    if (!s.ip) return null;
    const r = N.sendPacket(net, { src: d.id, dst: s.ip, ...AAA_PORT[s.proto] });
    const t = r.ok && net.devices[r.at.dev], db = t && (s.proto === 'radius' ? t.radius : t.tacacs);
    return db && db.secret === s.key ? db : null;
  }
  /** Đi lần lượt các phương thức: máy chủ trả lời thì dừng ở đó (sai là từ chối); chỉ khi không ai trả lời mới sang phương thức sau. */
  function aaaMethods(d, m, user, pw) {
    for (let i = 0; i < m.length; i++) {
      if (m[i] === 'group') {
        const g = m[++i], proto = g === 'radius' ? 'radius' : 'tacacs+';
        for (const s of Object.values(d.aaa?.servers || {}).filter((z) => z.proto === proto)) {
          const db = aaaSrvUp(d, s);
          if (db) return db.users[user] === pw;
        }
      } else if (m[i] === 'local' || m[i] === 'local-case') return d.users[user]?.pw === pw;
      else if (m[i] === 'none') return true;
      else if (m[i] === 'enable') return !!d.enableSecret && d.enableSecret === pw;
    }
    return null;
  }
  function aaaList(x) {
    if (!x.d.aaa?.newModel) return R(['% AAA chưa bật — gõ "aaa new-model" trước']);
    const m = x.a[1].trim().split(/\s+/);
    if (!m.every((w, i) => ['local', 'local-case', 'enable', 'line', 'none'].includes(w) || (w === 'group' && /^(tacacs\+|radius|\S+)$/.test(m[i + 1] || '')) || m[i - 1] === 'group')) return R(['% Invalid input detected (method: local | group tacacs+ | group radius | enable | line | none)']);
    x.d.aaa.lists[x.a[0]] = m;
    return R([]);
  }
  function srcBinding(x, add) {
    const mac = N.parseCiscoMac(x.a[0]);
    if (!mac) return R(['% Invalid MAC address (dạng aaaa.bbbb.cccc)']);
    if (!x.d.ports[x.a[3]]) return R([`% Invalid interface ${x.a[3]}`]);
    const S = (x.d.snoop.statics ||= []);
    const i = S.findIndex((b) => b.mac === mac && b.vlan === x.a[1]);
    if (i >= 0) S.splice(i, 1);
    if (add) S.push({ mac, vlan: x.a[1], ip: x.a[2], port: x.a[3], static: true });
    return R([]);
  }
  function line(x) { return x.d.lines[x.s.line]; }
  // ---------- IPv6 ----------
  function route6(x, p, o) {
    const d = x.d;
    d.routes6 = (d.routes6 || []).filter((r) => !(r.net === A6.net6(p.ip, p.prefix) && r.prefix === p.prefix && (!o || (r.nh || null) === (o.nh || null))));
    if (o) d.routes6.push({ net: A6.net6(p.ip, p.prefix), prefix: p.prefix, nh: o.nh || null, iface: o.iface || null, ad: o.ad ?? 1 });
    return R([]);
  }
  function addr6(x, p, eui) {
    return ifAll(x, (f, n) => {
      let ip = p.ip;
      if (eui) {
        if (p.prefix !== 64) return ['% Lab: EUI-64 cần prefix /64'];
        ip = A6.eui64(A6.net6(p.ip, 64), N.epMac(net, { dev: x.d.id, ifn: n }));
      }
      f.ipv6 = (f.ipv6 || []).filter((a) => a.ip !== ip);
      f.ipv6.push({ ip, prefix: p.prefix, ...(eui ? { eui: true } : {}) });
    });
  }
  // ---------- Zone-Based Firewall ----------
  function zbf(d) {
    d.zbf ||= { zones: {}, classMaps: {}, policyMaps: {}, pairs: [] };
    d.fw ||= { kind: 'zbf', conns: [] };
    return d.zbf;
  }
  function cmapI(x, name, all) {
    const z = zbf(x.d);
    z.classMaps[name] ||= { all, matches: [] };
    z.classMaps[name].all = all;
    x.s.mode = 'cmapi'; x.s.cm = name;
    return R([]);
  }
  function pmClass(x, cls) {
    const pm = x.d.zbf.policyMaps[x.s.pm];
    if (!pm.some((e) => e.cls === cls)) pm.splice(pm.findIndex((e) => e.cls === 'class-default'), 0, { cls, action: null }); // class-default luôn đứng cuối
    x.s.mode = 'pmapic'; x.s.pmc = cls;
  }
  function zpair(x) {
    const z = zbf(x.d);
    const [name, src, dst] = x.a;
    for (const zn of [src, dst]) if (zn !== 'self' && !z.zones[zn]) return R([`% Zone ${zn} chưa tồn tại`]);
    z.pairs = z.pairs.filter((p) => p.name !== name);
    z.pairs.push({ name, src, dst, policy: null });
    x.s.mode = 'zpair'; x.s.zp = name;
    return R([]);
  }
  function showZones(d) {
    const z = d.zbf;
    const L = ['zone self', '  Description: System Defined Zone', ''];
    for (const [n, o] of Object.entries(z?.zones || {})) {
      L.push(`zone ${n}`, ...(o.desc ? [`  Description: ${o.desc}`] : []));
      const mem = Object.keys(d.ifaces).filter((i) => d.ifaces[i].zone === n);
      L.push(mem.length ? '  Member Interfaces:' : '  (Lab: chưa có cổng nào — interface ... → zone-member security ' + n + ')', ...mem.map((i) => `    ${longIf(i)}`), '');
    }
    return L;
  }
  function showZonePairs(d) {
    const L = [];
    for (const p of d.zbf?.pairs || []) L.push(`Zone-pair name ${p.name}`, `    Source-Zone ${p.src}  Destination-Zone ${p.dst}`, `    service-policy ${p.policy || '(chưa có — mọi gói bị DROP)'}`);
    return L.length ? L : ['(Lab: chưa có zone-pair nào)'];
  }
  function showCmapI(d) {
    const L = [];
    for (const [n, c0] of Object.entries(d.zbf?.classMaps || {})) L.push(` Class Map type inspect ${c0.all ? 'match-all' : 'match-any'} ${n} (id 1)`, ...c0.matches.map((m) => (m.protocol ? `   Match protocol ${m.protocol}` : `   Match access-group name ${m.acl}`)), '');
    return L;
  }
  function showZbfSessions(d) {
    const L = ['', 'policy exists on zp'];
    const zp = (c0) => (d.zbf?.pairs || []).find((p) => p.src === d.ifaces[c0.inIf]?.zone && p.dst === d.ifaces[c0.outIf]?.zone);
    for (const p of d.zbf?.pairs || []) {
      const ss = (d.fw?.conns || []).filter((c0) => zp(c0) === p);
      L.push(`  Zone-pair: ${p.name}`, '', `  Service-policy inspect : ${p.policy || '-'}`, '', '    Inspect', '', '      Established Sessions');
      ss.forEach((c0, i) => L.push(`       Session ${i + 1} (${c0.src}:${c0.sport ?? 8})=>(${c0.dst}:${c0.dport ?? 0}) ${c0.proto}:${c0.proto} SIS_OPEN`, '        Created 00:00:0' + (i % 9 + 1) + ', Last heard 00:00:00'));
      if (!ss.length) L.push('       (không có)');
      L.push('');
    }
    return L;
  }
  function routerOspf6(x) {
    if (!x.d.ipv6Routing) return R(['% IPv6 routing not enabled']);
    if (!x.d.ospf6) x.d.ospf6 = { pid: x.a[0], rid: null, passive: [] };
    else if (x.d.ospf6.pid !== x.a[0]) return R([`% Lab: router này đã chạy OSPFv3 process ${x.d.ospf6.pid}.`]);
    x.s.mode = 'ospf6';
    return R(V6.ospf6Rid(net, x.d) ? [] : ['%OSPFv3-4-NORTRID: Process OSPFv3-' + x.a[0] + '-IPv6 could not pick a router-id, please configure manually']);
  }
  function ospf6If(x, pid, area) {
    if (!x.d.ipv6Routing) return R(['% IPv6 routing not enabled']);
    if (!x.d.ospf6) x.d.ospf6 = { pid, rid: null, passive: [] };
    else if (x.d.ospf6.pid !== pid) return R([`% Lab: router này đã chạy OSPFv3 process ${x.d.ospf6.pid}.`]);
    const out = ifAll(x, (f) => { f.ospf6 = { pid, area }; });
    if (!V6.ospf6Rid(net, x.d)) out.out.push(`%OSPFv3-4-NORTRID: Process OSPFv3-${pid}-IPv6 could not pick a router-id, please configure manually`);
    return out;
  }
  function iosPing6(d, ip) {
    const r = V6.ping6(net, d.id, ip, { record: true });
    const marks = r.ok ? '!!!!!' : '.....';
    const okN = r.ok ? 5 : 0;
    return R(['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:`, marks, `Success rate is ${okN * 20} percent (${okN}/5)${okN ? ', round-trip min/avg/max = 0/1/1 ms' : ''}`], { why: r.ok ? null : r.fail?.why, ok: r.ok });
  }
  function showIpv6IntBr(d) {
    const L = [];
    for (const n of ifOrder(d)) {
      const f = d.ifaces[n];
      const [st, pr] = ifStatus(d, n);
      L.push(`${pad(longIf(n), 23)}[${st === 'administratively down' ? 'administratively down' : st}/${pr}]`);
      if (!V6.v6On(f)) { L.push('    unassigned'); continue; }
      L.push(`    ${V6.llOf(net, d.id, n)}`, ...(f.ipv6 || []).map((a) => `    ${a.ip}`));
    }
    return L;
  }
  function showIpv6Route(d, filter) {
    const code = { ospf: ['O', 'OI'], static: ['S'], connected: ['C'], local: ['L'] }[filter];
    const rows = V6.routeTable6(net, d.id).filter((r) => !code || code.includes(r.code));
    const L = [`IPv6 Routing Table - default - ${rows.length} entries`, 'Codes: C - Connected, L - Local, S - Static, O - OSPF Intra, OI - OSPF Inter', ''];
    if (!d.ipv6Routing) L.push('(Lab: "ipv6 unicast-routing" CHƯA bật — router có bảng nhưng KHÔNG chuyển tiếp gói IPv6)', '');
    for (const r of rows) {
      L.push(`${pad(r.code, 4)}${r.net}/${r.prefix} [${r.ad}/${r.metric}]`);
      if (r.code === 'C') L.push(`     via ${longIf(r.iface)}, directly connected`);
      else if (r.code === 'L') L.push(`     via ${longIf(r.iface)}, receive`);
      else L.push(`     via ${r.nextHop ? r.nextHop + (r.code !== 'S' || r.nextHop.startsWith('FE80') ? ', ' + longIf(r.iface) : '') : longIf(r.iface) + ', directly connected'}`);
    }
    return L;
  }
  function showOspf6Nei(d) {
    if (!d.ospf6) return [];
    const o = V6.ospf6All(net);
    const L = ['', '            OSPFv3 Router with ID (' + (o.rid[d.id] || '0.0.0.0') + ') (Process ID ' + d.ospf6.pid + ')', '', 'Neighbor ID     Pri   State           Dead Time   Interface ID    Interface'];
    for (const a of o.adj[d.id] || []) L.push(`${pad(o.rid[a.to], 16)}${pad(1, 6)}${pad('FULL/  -', 16)}00:00:3${a.to.length % 10}    ${pad(Object.keys(net.devices[a.to].ifaces).indexOf(a.theirIf) + 1, 16)}${longIf(a.outIf)}`);
    return L;
  }
  function routerOspf(x) {
    if (x.d.type === 'switch' && !x.d.ipRouting) return R(['% IP routing not enabled']);
    if (!x.d.ospf) x.d.ospf = N.newOspf(x.a[0]);
    else if (x.d.ospf.pid !== x.a[0]) return R([`% Lab: thiết bị này đã chạy OSPF process ${x.d.ospf.pid}.`]);
    x.s.mode = 'router'; x.s.rp = 'ospf';
    return R([]);
  }
  function routerEigrp(x) {
    if (x.d.type === 'switch' && !x.d.ipRouting) return R(['% IP routing not enabled']);
    if (!x.d.eigrp) x.d.eigrp = N.newEigrp(x.a[0]);
    else if (x.d.eigrp.as !== x.a[0]) return R([`% Lab: thiết bị này đã chạy EIGRP AS ${x.d.eigrp.as}.`]);
    x.s.mode = 'router'; x.s.rp = 'eigrp';
    return R([]);
  }

  function enterIf(x, ifn) {
    const d = x.d;
    const bad = () => errOut({ err: 'inv', at: 1 }, x.s, x.raw, x.words, prompt(d.id));
    if (isRouter(d)) {
      if (ifn.startsWith('vlan') || ifn.startsWith('po')) return bad();
      if (ifn.startsWith('lo') || ifn.startsWith('tu')) d.ifaces[ifn] ||= N.newSubIf(ifn);
      else if (ifn.includes('.')) {
        const p = ifn.split('.')[0];
        if (!d.ifaces[p]) return bad();
        d.ifaces[ifn] ||= N.newSubIf(ifn);
        x.s.mode = 'subif'; x.s.ifs = [ifn];
        return R([]);
      } else if (!d.ifaces[ifn]) return bad();
      x.s.mode = 'if'; x.s.ifs = [ifn];
      return R([]);
    }
    if (ifn.startsWith('vlan')) {
      const v = +ifn.slice(4);
      if (v < 1 || v > 4094) return bad();
      d.svis[ifn] ||= N.newSubIf(ifn);
    } else if (ifn.startsWith('po')) {
      d.ports[ifn] ||= N.newPort();
    } else if (!d.ports[ifn] || ifn.includes('.')) return bad();
    x.s.mode = 'if'; x.s.ifs = [ifn];
    return R([]);
  }
  function enterRange(x, rest) {
    const list = parseIfRange(rest);
    if (!list || !list.length || list.some((n) => !(isRouter(x.d) ? x.d.ifaces[n] : x.d.ports[n]))) return R(['% Invalid interface range', '']);
    x.s.mode = 'range'; x.s.ifs = list;
    return R([]);
  }
  function setSpeed(c, n, v) {
    if (v !== 'auto' && +v > (n.startsWith('g') ? 1000 : 100)) return ['% Invalid input detected: cổng này không hỗ trợ tốc độ đó'];
    c.speed = v === 'auto' ? null : +v;
    return null;
  }
  function voiceVlanNew(x) {
    x.d.vlans[x.a[0]] = 'VLAN' + String(x.a[0]).padStart(4, '0');
    return [`% Voice VLAN does not exist. Creating vlan ${x.a[0]}`];
  }
  function ifAll(x, fn) {
    const out = [];
    for (const n of x.s.ifs) { const f = IFS(x.d)[n]; if (!f) continue; const r = fn(f, n); if (Array.isArray(r)) out.push(...r); }
    return R(out);
  }
  function ipSet(x, f, n, ip, mask) {
    const pfx = maskToPrefix(mask);
    const nw = netOf(ip, pfx);
    const oct1 = +ip.split('.')[0];
    if (oct1 === 127 || oct1 >= 224) return [`Not a valid host address - ${ip}`];
    if (pfx < 31 && (ip === nw || ip === N.n2ip(N.ip2n(nw) + 2 ** (32 - pfx) - 1))) return [`Bad mask /${pfx} for address ${ip}`];
    for (const [m, g] of Object.entries(IFS(x.d))) {
      if (m !== n && g.ip && (g.vrf || null) === (f.vrf || null) && (N.inNet(ip, g.ip, g.prefix) || N.inNet(g.ip, ip, pfx))) return [`% ${netOf(ip, pfx)} overlaps with ${longIf(m)}`];
    }
    f.ip = ip; f.prefix = pfx;
    return [];
  }
  function adminSet(x, f, n, down) {
    f.shutdown = down;
    if (n.startsWith('vlan')) return down ? [`%LINK-5-CHANGED: Interface ${longIf(n)}, changed state to administratively down`] : N.ifUp(net, x.d.id, n) ? [`%LINK-5-CHANGED: Interface ${longIf(n)}, changed state to up`, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longIf(n)}, changed state to up`] : [`%LINK-5-CHANGED: Interface ${longIf(n)}, changed state to up`];
    if (down) return [`%LINK-5-CHANGED: Interface ${longIf(n)}, changed state to administratively down`, ...(n.includes('.') ? [] : [`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longIf(n)}, changed state to down`])];
    if (n.includes('.')) return [];
    if (N.lineUp(net, x.d.id, n)) return [`%LINK-5-CHANGED: Interface ${longIf(n)}, changed state to up`, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longIf(n)}, changed state to up`];
    if (N.statusUp(net, x.d.id, n)) return [`%LINK-5-CHANGED: Interface ${longIf(n)}, changed state to up`, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longIf(n)}, changed state to down`];
    return [`%LINK-5-CHANGED: Interface ${longIf(n)}, changed state to down`];
  }
  function encapSet(x, vid, native) {
    if (x.s.mode !== 'subif') return R(['% Configuring IEEE 802.1Q encapsulation on the main interface is not permitted', '  (Lab: hãy dùng subinterface, ví dụ "interface g0/0.10").']);
    if (vid < 1 || vid > 4094) return R(['% Invalid VLAN ID']);
    return ifAll(x, (f) => { f.encap = vid; f.native = native; });
  }
  function l2encSet(x, kind) {
    if (!x.s.ifs.every((n) => n.startsWith('s'))) return R([`% Lab: "encapsulation ${kind}" chỉ dùng trên cổng Serial.`]);
    return ifAll(x, (f, n) => {
      f.l2enc = kind;
      return N.statusUp(net, x.d.id, n) ? [`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longIf(n)}, changed state to ${N.lineUp(net, x.d.id, n) ? 'up' : 'down'}`] : [];
    });
  }
  function tunSet(x, k, v) {
    if (!x.s.ifs.every((n) => n.startsWith('tu'))) return R(['% Lab: lệnh "tunnel ..." chỉ dùng trong "interface tunnel <số>".']);
    return ifAll(x, (f, n) => {
      const was = N.ifUp(net, x.d.id, n);
      f[k] = v;
      const now = N.ifUp(net, x.d.id, n);
      return was === now ? [] : [`%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longIf(n)}, changed state to ${now ? 'up' : 'down'}`];
    });
  }
  function redist(x, proto, src, cfg) {
    const o = x.d[proto];
    o.redist ||= {};
    o.redist[src] = cfg;
    const out = [];
    if (proto === 'ospf' && !cfg.subnets && src !== 'connected-x') out.push('% Only classful networks will be redistributed');
    if (proto === 'eigrp' && !cfg.metric && !o.defaultMetric && (src === 'ospf' || src === 'bgp')) out.push('(Lab: chưa có "metric ..." hoặc "default-metric" → seed metric vô hạn, EIGRP sẽ KHÔNG quảng bá các route này)');
    return R(out);
  }
  function trackSet(f, g, ifn, dec) {
    const s = (f.standby[g] ||= {});
    s.track = (s.track || []).filter((t) => t.ifn !== ifn);
    s.track.push({ ifn, dec });
  }
  function snmpHost(x, ip, ver, sec, name) {
    const s0 = SN.snmpOf(x.d);
    s0.hosts = [...s0.hosts.filter((h) => h.ip !== ip), { ip, ver, sec, name }];
    return R([]);
  }
  function snmpUser(x, auth, authPw, priv, privPw) {
    if (auth && String(authPw).length < 8) return R(['% Lab: mật khẩu xác thực SNMPv3 nên dài ≥ 8 ký tự (nhiều bản IOS từ chối mật khẩu ngắn hơn).']);
    SN.setUser(x.d, x.a[0], x.a[1], auth, authPw, priv, privPw);
    const out = [];
    if (!SN.snmpOf(x.d).groups[x.a[1]]) out.push(`% Lab: nhóm "${x.a[1]}" chưa có — tạo bằng snmp-server group ${x.a[1]} v3 {noauth|auth|priv} thì user mới dùng được.`);
    return R(out);
  }
  function routeAdd(x, net0, mask, nh, iface, ad, name = null) {
    const prefix = maskToPrefix(mask);
    const nn = netOf(net0, prefix);
    if (nn !== net0) return R(['%Inconsistent address and mask']);
    if (iface && !IFS(x.d)[iface]) return R(['% Invalid interface']);
    x.d.routes = x.d.routes.filter((r) => !(r.net === nn && r.prefix === prefix && r.nh === nh && r.iface === iface));
    x.d.routes.push({ net: nn, prefix, nh, iface, ad, ...(name ? { name } : {}) });
    const out = [];
    if (iface && !nh && /^(g|fa|e|vlan)/.test(iface)) out.push('%Default route without gateway, if not a point-to-point interface, may impact performance');
    return R(out);
  }
  function routeDel(x, net0, mask, via) {
    const prefix = maskToPrefix(mask);
    const before = x.d.routes.length;
    x.d.routes = x.d.routes.filter((r) => !(r.net === net0 && r.prefix === prefix && (via == null || r.nh === via || r.iface === via)));
    return R(before === x.d.routes.length ? ['%No matching route to delete'] : []);
  }
  function natDyn(x, rule) {
    if (rule.iface && !x.d.ifaces[rule.iface]) return R(['% Invalid interface']);
    if (rule.pool && !x.d.nat.pools[rule.pool]) return R([`%Pool ${rule.pool} not found`]);
    x.d.nat.dyn = x.d.nat.dyn.filter((r) => !(r.acl === rule.acl && (r.iface || null) === (rule.iface || null) && (r.pool || null) === (rule.pool || null)));
    x.d.nat.dyn.push(rule);
    return R([]);
  }
  function natPool(x, name, a, b, prefix) {
    if (N.ip2n(b) < N.ip2n(a)) return R(['%End address less than start address']);
    if (!N.inNet(a, b, prefix)) return R(['%Start and end addresses on different subnets']);
    x.d.nat.pools[name] = { start: a, end: b, prefix };
    return R([]);
  }
  function ospfNet(x, ip, wild, area, add) {
    const o = x.d.ospf;
    if (add) { if (!o.networks.some((s) => s.net === ip && s.wild === wild)) o.networks.push({ net: ip, wild, area }); }
    else o.networks = o.networks.filter((s) => !(s.net === ip && s.wild === wild));
    return R([]);
  }
  function eigrpNet(x, ip, wild, add) {
    const e = x.d.eigrp;
    if (add) { if (!e.networks.some((s) => s.net === ip && s.wild === wild)) e.networks.push({ net: ip, wild }); }
    else e.networks = e.networks.filter((s) => !(s.net === ip && (wild == null || s.wild === wild)));
    return R([]);
  }
  // ---------- VPN IPsec ----------
  function nbr(x, fn) { const n = x.d.bgp.neighbors[x.a[0]]; if (!n) return R([`% Specify remote-as or peer-group commands first`]); fn(n); return R([]); }
  function bgpNet(x, ip, prefix, add) {
    const b = x.d.bgp;
    b.networks = b.networks.filter((n) => !(n.net === ip && n.prefix === prefix));
    if (add) b.networks.push({ net: ip, prefix });
    return R([]);
  }
  const mst = (x) => (x.d.stp.mst ||= { name: '', rev: 0, inst: {}, prio: {} });
  function mstShow(d) {
    const m = d.stp.mst || { name: '', rev: 0, inst: {} };
    return ['Current MST configuration', `Name      [${m.name}]`, `Revision  ${m.rev}     Instances configured ${Object.keys(m.inst).length + 1}`, '', 'Instance  Vlans mapped', '--------  ---------------------------------------------------------------------', `0         ${fmtVlist(Array.from({ length: 4094 }, (_, i) => i + 1).filter((v) => !Object.values(m.inst).some((l) => l.includes(v))))}`, ...Object.entries(m.inst).map(([i, l]) => `${pad(i, 10)}${fmtVlist(l)}`)];
  }
  const isak = (x) => x.d.crypto.isakmp[x.s.isakmp];
  const cmap = (x) => x.d.crypto.maps[x.s.cmap.name][x.s.cmap.seq];
  const vam = (x) => x.d.vacl.maps[x.s.vamap.name].find((e) => e.seq === x.s.vamap.seq);
  function tsetSet(x, name, rest) {
    const ok = ['esp-aes', 'esp-3des', 'esp-des', 'esp-sha-hmac', 'esp-md5-hmac', 'esp-sha256-hmac', 'ah-sha-hmac', 'ah-md5-hmac', '128', '192', '256'];
    const t = rest.toLowerCase().split(/\s+/);
    if (t.some((w) => !ok.includes(w))) return errOut({ err: 'inv', at: 3 + t.findIndex((w) => !ok.includes(w)) }, x.s, x.raw, x.words, prompt(x.d.id));
    x.d.crypto.tsets[name] = t;
    x.s.mode = 'tset';
    return R([]);
  }
  function cmapEnter(x, name, seq) {
    x.d.crypto.maps[name] ||= {};
    const fresh = !x.d.crypto.maps[name][seq];
    x.d.crypto.maps[name][seq] ||= { peer: null, tset: null, acl: null };
    x.s.mode = 'cmap';
    x.s.cmap = { name, seq };
    return R(fresh ? ['% NOTE: This new crypto map will remain disabled until a peer', '        and a valid access list have been configured.'] : []);
  }
  function vamapEnter(x, name, seq) {
    const m = (x.d.vacl.maps[name] ||= []);
    if (!m.some((e) => e.seq === seq)) m.push({ seq, acl: null, action: 'forward' });
    x.s.mode = 'vamap';
    x.s.vamap = { name, seq };
    return R([]);
  }

  // ---------- ACL ----------
  function aclPush(acl, e, seq) {
    if (seq == null) seq = (acl.entries.length ? Math.max(...acl.entries.map((z) => z.seq)) : 0) + 10;
    if (acl.entries.some((z) => z.seq === seq)) return '% Duplicate sequence number';
    e.seq = seq;
    e.matches = 0;
    acl.entries.push(e);
    acl.entries.sort((a, b) => a.seq - b.seq);
    return null;
  }
  function parseAce(type, ws) {
    let i = 0;
    const w = ws.map((s) => s.toLowerCase());
    const bad = () => { throw { at: i }; };
    const e = { action: w[i++] };
    if (!['permit', 'deny'].includes(e.action)) bad();
    const addr = () => {
      const a = w[i];
      if (a === 'any') { i++; return { any: true }; }
      if (a === 'host') { if (!isIp(w[i + 1])) { i++; bad(); } const ip = w[i + 1]; i += 2; return { ip, wild: '0.0.0.0' }; }
      if (isIp(a)) {
        if (w[i + 1] && isIp(w[i + 1])) { const r = { ip: a, wild: w[i + 1] }; i += 2; return r; }
        if (type === 'standard') { i++; return { ip: a, wild: '0.0.0.0' }; }
        i++; bad();
      }
      bad();
    };
    const pv = (s) => { if (/^\d+$/.test(s || '')) return +s; if (N.PORT_NAMES[s] != null) return N.PORT_NAMES[s]; bad(); };
    const port = () => {
      const op = w[i];
      if (!['eq', 'neq', 'gt', 'lt', 'range'].includes(op)) return null;
      i++;
      if (op === 'range') { const r = { op, port: pv(w[i]) }; i++; r.port2 = pv(w[i]); i++; return r; }
      const r = { op, port: pv(w[i]) }; i++;
      return r;
    };
    if (type === 'standard') {
      if (i >= w.length) throw { inc: true };
      e.src = addr();
      if (w[i] === 'log') { e.log = true; i++; }
      if (i < w.length) bad();
      return e;
    }
    const proto = w[i];
    if (!['ip', 'tcp', 'udp', 'icmp', 'eigrp', 'ospf', 'gre', 'esp', 'ahp'].includes(proto)) bad();
    i++;
    e.proto = proto;
    if (i >= w.length) throw { inc: true };
    e.src = addr();
    if (proto === 'tcp' || proto === 'udp') e.sport = port();
    if (i >= w.length) throw { inc: true };
    e.dst = addr();
    if (proto === 'tcp' || proto === 'udp') e.dport = port();
    while (i < w.length) {
      const k = w[i];
      if (k === 'log') e.log = true;
      else if (k === 'established' && proto === 'tcp') e.established = true;
      else if (k === 'time-range' && ws[i + 1]) e.timeRange = ws[++i];
      else if (proto === 'icmp' && ['echo', 'echo-reply', 'unreachable', 'time-exceeded'].includes(k)) e.icmpType = k;
      else bad();
      i++;
    }
    return e;
  }
  function aceErr(x, err, offsetWords) {
    if (err && err.inc) return R(['% Incomplete command.', '']);
    const at = (err?.at ?? 0) + offsetWords;
    return errOut({ err: 'inv', at }, x.s, x.raw, x.words, prompt(x.d.id));
  }
  function numberedAcl(x, num, rest, remark) {
    const type = (num >= 1 && num <= 99) || (num >= 1300 && num <= 1999) ? 'standard' : (num >= 100 && num <= 199) || (num >= 2000 && num <= 2699) ? 'extended' : null;
    if (!type) return errOut({ err: 'inv', at: 1 }, x.s, x.raw, x.words, prompt(x.d.id));
    const name = String(num);
    const acl = (x.d.acls[name] ||= { type, entries: [], numbered: true });
    if (remark != null) { aclPush(acl, { remark }, null); return R([]); }
    try {
      const e = parseAce(type, rest.split(/\s+/));
      const err = aclPush(acl, e, null);
      return R(err ? [err] : []);
    } catch (err) { return aceErr(x, err, 2); }
  }
  function namedAcl(x, kind, name) {
    const ex = x.d.acls[name];
    if (ex && ex.type !== kind) return R([`% A named ${ex.type} IP access list with this name already exists`]);
    x.d.acls[name] ||= { type: kind, entries: [], numbered: false };
    x.s.mode = kind === 'standard' ? 'acl-std' : 'acl-ext';
    x.s.acl = name;
    return R([]);
  }
  function aclEntry(x, seq, text) {
    const acl = x.d.acls[x.s.acl];
    try {
      const e = parseAce(acl.type, text.split(/\s+/));
      const err = aclPush(acl, e, seq);
      return R(err ? [err] : []);
    } catch (err) { return aceErr(x, err, seq == null ? 0 : 1); }
  }
  function aclNoLine(x, text) {
    const acl = x.d.acls[x.s.acl];
    try {
      const e = parseAce(acl.type, text.split(/\s+/));
      const t = N.aceText(acl.type, { ...e });
      acl.entries = acl.entries.filter((z) => z.remark != null || N.aceText(acl.type, z) !== t);
      return R([]);
    } catch (err) { return aceErr(x, err, 1); }
  }

  // ---------- switch ----------
  function ports(x, fn, extraOut, perOut) {
    const out = [];
    for (const n of x.s.ifs) {
      const p = x.d.ports[n];
      if (!p) continue;
      const r = fn(p, n);
      if (Array.isArray(r)) out.push(...r);
      if (perOut) out.push(...perOut(n));
    }
    if (extraOut) out.unshift(...extraOut);
    return R(out);
  }
  function vtpBump(d) { if (d.vtpMode === 'server') d.vtpRev += 1; }
  function vlanEnter(x, list) {
    if (x.d.vtpMode === 'client') return R(['VTP VLAN configuration not allowed when device is in CLIENT mode.']);
    // VLAN mở rộng 1006–4094: VTPv1/v2 chỉ cho tạo khi switch ở chế độ transparent
    const ext = list.filter((v) => v >= 1006 && !x.d.vlans[v]);
    if (ext.length && x.d.vtpMode !== 'transparent') return R([`% Failed to create VLANs ${ext.join(',')}`, 'Extended VLAN(s) not allowed in current VTP mode.', '%Failed to commit extended VLAN(s) changes.']);
    if (list.some((v) => v > 4094)) return R(['% Invalid input: VLAN 1–4094']);
    let created = false;
    for (const v of list) {
      if (v >= 1002 && v <= 1005) return R([`Default VLAN ${v} may not have its name changed.`]);
      if (!x.d.vlans[v]) { x.d.vlans[v] = 'VLAN' + String(v).padStart(4, '0'); created = true; }
    }
    if (created) vtpBump(x.d);
    x.s.mode = 'vlan';
    x.s.vlans = list;
    return R([]);
  }
  function vlanDel(x, list) {
    if (x.d.vtpMode === 'client') return R(['VTP VLAN configuration not allowed when device is in CLIENT mode.']);
    for (const v of list) if (v !== 1) { delete x.d.vlans[v]; delete x.d.pvlan[v]; }
    vtpBump(x.d);
    return R([]);
  }
  function vtpMode(x, m) {
    // VTPv1/v2 không quảng bá VLAN mở rộng 1006–4094 → không rời transparent được khi đang có VLAN mở rộng
    const ext = Object.keys(x.d.vlans).map(Number).filter((v) => v >= 1006);
    if (m !== 'transparent' && ext.length) return R([`Cannot set the device to VTP ${m.toUpperCase()} mode when extended VLANs exist (${ext.join(',')}).`, '(Lab: xoá VLAN mở rộng trước, hoặc giữ VTP transparent.)']);
    if (m === 'transparent' || x.d.vtpMode === 'transparent') x.d.vtpRev = 0;
    x.d.vtpMode = m;
    return R([`Setting device to VTP ${m.toUpperCase()} mode${m === 'transparent' ? '' : ' for VLANS'}.`]);
  }
  function pvType(x, t) {
    if (x.d.vtpMode !== 'transparent') return R(['%Private VLANs can only be configured when VTP is in transparent/off mode']);
    for (const v of x.s.vlans) x.d.pvlan[v] = { ...(x.d.pvlan[v] || {}), type: t, assoc: x.d.pvlan[v]?.assoc || [] };
    return R([]);
  }
  function pvAssoc(x, rest) {
    const w = rest.trim().split(/\s+/);
    const add = w[0].toLowerCase() === 'add';
    const l = parseVlist(add ? w[1] || '' : w[0]);
    if (!l) return R(['% Bad VLAN list']);
    for (const v of x.s.vlans) {
      if (x.d.pvlan[v]?.type !== 'primary') return R(['% Private VLAN association can only be configured on a primary VLAN']);
      x.d.pvlan[v].assoc = add ? [...new Set([...x.d.pvlan[v].assoc, ...l])] : l;
    }
    return R([]);
  }
  function pvMapping(x, prim, rest) {
    const w = rest.trim().split(/\s+/);
    const add = w[0].toLowerCase() === 'add';
    const l = parseVlist(add ? w[1] || '' : w[0]);
    if (!l) return R(['% Bad VLAN list']);
    return ports(x, (p) => { const cur = p.pv?.mapping || []; p.pv = { ...(p.pv || { mode: 'promiscuous' }), primary: prim, mapping: add ? [...new Set([...cur, ...l])] : l }; });
  }
  function accessVlan(x, v) {
    const out = [];
    if (v < 1 || v > 4094) return R(['% Bad VLAN list']);
    if (!x.d.vlans[v]) {
      if (x.d.vtpMode === 'client') out.push('% Access VLAN does not exist. Please create the VLAN before assigning it.');
      else { x.d.vlans[v] = 'VLAN' + String(v).padStart(4, '0'); vtpBump(x.d); out.push(`% Access VLAN does not exist. Creating vlan ${v}`); }
    }
    for (const n of x.s.ifs) if (x.d.ports[n]) x.d.ports[n].vlan = v;
    return R(out);
  }
  function allowedSet(x, rest) {
    const w = rest.trim().split(/\s+/);
    const k = w[0].toLowerCase();
    return ports(x, (p) => {
      const cur = p.allowed == null ? null : [...p.allowed];
      if (k === 'all') p.allowed = null;
      else if (k === 'none') p.allowed = [];
      else if (['add', 'remove', 'except'].includes(k)) {
        const l = parseVlist(w[1] || '');
        if (!l) return ['% Bad VLAN list'];
        if (k === 'add') p.allowed = cur == null ? null : [...new Set([...cur, ...l])].sort((a, b) => a - b);
        else if (k === 'remove') p.allowed = (cur == null ? range4094() : cur).filter((v) => !l.includes(v));
        else p.allowed = range4094().filter((v) => !l.includes(v));
      } else {
        const l = parseVlist(w[0]);
        if (!l) return ['% Bad VLAN list'];
        p.allowed = l;
      }
      return [];
    });
  }
  const range4094 = () => Array.from({ length: 4094 }, (_, i) => i + 1);
  function psSet(x, fn, needEnabled) {
    const out = [];
    for (const n of x.s.ifs) {
      const p = x.d.ports[n];
      if (!p) continue;
      if (p.mode === 'trunk' && p.modeSet) { out.push(`Command rejected: ${longIf(n)} is a trunk port.`); continue; }
      if (!p.modeSet) { out.push(`Command rejected: ${longIf(n)} is a dynamic port.`); continue; }
      if (!p.ps) p.ps = { enabled: !needEnabled, max: 1, sticky: false, violation: 'shutdown', macs: [], viol: 0 };
      if (!needEnabled) p.ps.enabled = true;
      fn(p.ps);
    }
    return R(out);
  }
  function chGroup(x, g, mode) {
    const out = [];
    const po = 'po' + g;
    if (!x.d.ports[po]) {
      const first = x.d.ports[x.s.ifs[0]];
      x.d.ports[po] = { ...N.newPort(), mode: first.mode, modeSet: first.modeSet, vlan: first.vlan, allowed: first.allowed, native: first.native };
      out.push(`Creating a port-channel interface Port-channel ${g}`);
    }
    for (const n of x.s.ifs) { const p = x.d.ports[n]; p.group = g; p.chMode = mode; }
    return R(out);
  }
  function stpPrio(x, list, prio) {
    if (prio % 4096 !== 0 || prio > 61440) return R(['% Bridge Priority must be in increments of 4096.', '% Allowed values are:', '  0     4096  8192  12288 16384 20480 24576 28672', '  32768 36864 40960 45056 49152 53248 57344 61440']);
    for (const v of list) x.d.stp.prio[v] = prio;
    return R([]);
  }

  // ---------- thông báo khi cấu hình làm đổi trạng thái (OSPF/EIGRP/HSRP/VRRP) ----------
  function snap(d) {
    if (!isL3(d)) return null;
    const ctx = ctxOf();
    const o = d.ospf ? N.ospfNeighbors(ctx, d.id).map((n) => `${n.rid}|${n.iface}`) : [];
    const e = d.eigrp ? (N.eigrpAll(ctx).adj[d.id] || []).map((a) => `${a.nh}|${a.outIf}`) : [];
    const h = {};
    for (const [n, f] of Object.entries(IFS(d))) {
      for (const [proto, grp] of [['hsrp', f.standby || {}], ['vrrp', f.vrrp || {}]]) {
        for (const g of Object.keys(grp)) {
          const k = `${proto}|${n}|${g}`;
          if (!grp[g].ip || !N.ifUp(net, d.id, n)) { h[k] = 'Init'; continue; }
          const a = N.hsrpView(net, d.id, n).find((z) => z.group === g && z.proto === proto);
          const me = a && a.ep.dev === d.id && a.ep.ifn === n;
          h[k] = !a ? 'Init' : me ? (proto === 'vrrp' ? 'Master' : 'Active') : proto === 'vrrp' ? 'Backup' : a.list[1]?.ep.dev === d.id ? 'Standby' : 'Listen';
        }
      }
    }
    const b = d.bgp ? (N.bgpAll(ctx).sessions[d.id] || []).filter((x) => x.state === 'Established').map((x) => x.ip) : [];
    return { o, e, h, b, pid: d.ospf?.pid, as: d.eigrp?.as };
  }
  function diffSnap(d, a, b) {
    if (!a || !b) return [];
    const out = [];
    for (const k of b.o) if (!a.o.includes(k)) { const [rid, ifn] = k.split('|'); out.push(`%OSPF-5-ADJCHG: Process ${b.pid}, Nbr ${rid} on ${longIf(ifn)} from LOADING to FULL, Loading Done`); }
    for (const k of a.o) if (!b.o.includes(k)) { const [rid, ifn] = k.split('|'); out.push(`%OSPF-5-ADJCHG: Process ${a.pid}, Nbr ${rid} on ${longIf(ifn)} from FULL to DOWN, Neighbor Down: Interface down or detached`); }
    for (const k of b.e) if (!a.e.includes(k)) { const [nh, ifn] = k.split('|'); out.push(`%DUAL-5-NBRCHANGE: EIGRP-IPv4 ${b.as}: Neighbor ${nh} (${longIf(ifn)}) is up: new adjacency`); }
    for (const k of a.e) if (!b.e.includes(k)) { const [nh, ifn] = k.split('|'); out.push(`%DUAL-5-NBRCHANGE: EIGRP-IPv4 ${a.as}: Neighbor ${nh} (${longIf(ifn)}) is down: interface down`); }
    for (const ip of b.b || []) if (!(a.b || []).includes(ip)) out.push(`%BGP-5-ADJCHANGE: neighbor ${ip} Up`);
    for (const ip of a.b || []) if (!(b.b || []).includes(ip)) out.push(`%BGP-5-ADJCHANGE: neighbor ${ip} Down`);
    for (const [k, st] of Object.entries(b.h)) {
      const old = a.h[k] || 'Init';
      if (old === st) continue;
      const [proto, ifn, g] = k.split('|');
      if (proto === 'vrrp') out.push(`%VRRP-6-STATECHANGE: ${shortIf(ifn)} Grp ${g} state ${old} -> ${st}`);
      else out.push(`%HSRP-6-STATECHANGE: ${longIf(ifn)} Grp ${g} state ${old === 'Init' ? 'Speak' : old} -> ${st}`);
    }
    return out;
  }
  /** Log bất đồng bộ của switch (vd CDP phát hiện lệch native VLAN) — hiện 1 lần mỗi phiên. */
  function pendingLogs(d, s) {
    const out = [];
    for (const p of Object.keys(d.ports).filter((n) => !n.startsWith('po'))) {
      if (!N.lineUp(net, d.id, p)) continue;
      const e = N.effPort(net, d, p);
      if (e.mode !== 'trunk') continue;
      const l = N.linkAt(net, d.id, p);
      const pe = N.peerOf(l, d.id, p);
      const pd = net.devices[pe.dev];
      if (pd.type !== 'switch' || !d.cdpRun || !pd.cdpRun) continue;
      const e2 = N.effPort(net, pd, pe.port);
      if (e2.mode !== 'trunk' || e2.native === e.native) continue;
      const k = `nv|${p}|${e.native}|${e2.native}`;
      if (s.shown[k]) continue;
      s.shown[k] = true;
      out.push(`%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on ${longIf(p)} (${e.native}), with ${pd.name} ${longIf(pe.port)} (${e2.native}).`);
    }
    return out;
  }

  // ---------- ping / traceroute / telnet / ssh ----------
  /** debug ip icmp: router nguồn in "echo reply rcvd", router đích in "echo reply sent" (qua hàng đợi log). */
  function icmpDebug(d, ip, r, n) {
    if (!r.ok) return;
    const ctx = ctxOf();
    const src = d.type === 'pc' || d.type === 'server' ? d.ip : IFS(d)[N.lookup(ctx, d.id, ip)?.iface]?.ip || '0.0.0.0';
    const tail = 'topology BASE, dscp 0 topoid 0';
    if (d.debug?.icmp) for (let i = 0; i < n; i++) N.logPush(net, d.id, `ICMP: echo reply rcvd, src ${ip}, dst ${src}, ${tail}`, true);
    const t = r.at && net.devices[r.at.dev];
    if (t && t !== d && t.debug?.icmp) for (let i = 0; i < n; i++) N.logPush(net, t.id, `ICMP: echo reply sent, src ${ip}, dst ${src}, ${tail}`, true);
  }
  function iosPing(d, ip, vrf) {
    const r = N.sendPacket(net, { src: d.id, dst: ip, vrf, record: true, anim: true });
    icmpDebug(d, ip, r, 5);
    const marks = r.ok ? (r.firstArp ? '.!!!!' : '!!!!!') : r.kind === 'unreach' ? 'U.U.U' : '.....';
    const okN = (marks.match(/!/g) || []).length;
    return R(['Type escape sequence to abort.', `Sending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:`, marks, `Success rate is ${okN * 20} percent (${okN}/5)${okN ? ', round-trip min/avg/max = 1/1/4 ms' : ''}`], { sim: r.sim, simLabel: `${d.name} ping ${ip}`, why: r.ok ? null : r.fail?.why, ok: r.ok });
  }
  function iosTrace(d, ip, vrf) {
    const r = N.sendPacket(net, { src: d.id, dst: ip, vrf, record: false, anim: true });
    const out = ['Type escape sequence to abort.', `Tracing the route to ${ip}`, 'VRF info: (vrf in name/id, vrf out name/id)'];
    let n = 0;
    for (const h of r.hops) out.push(`  ${++n} ${h.ip} 0 msec 1 msec 0 msec`);
    if (r.ok) { if (!r.hops.length || r.hops[r.hops.length - 1].ip !== ip) out.push(`  ${++n} ${ip} 1 msec 0 msec 1 msec`); }
    else for (let k = 0; k < 3; k++) out.push(`  ${++n}  *    *    *`);
    return R(out, { sim: r.sim, simLabel: `${d.name} traceroute ${ip}`, why: r.ok ? null : r.fail?.why, ok: r.ok });
  }
  function tcpConnect(d, ip, port) {
    const r = N.sendPacket(net, { src: d.id, dst: ip, proto: 'tcp', dport: port, record: true, anim: true });
    const out = [`Trying ${ip}${port !== 23 ? ' ' + port : ''} ...${r.ok ? 'Open' : ''}`];
    const target = r.at ? net.devices[r.at.dev] : null;
    if (r.ok) {
      if (target && target.type !== 'pc' && target.type !== 'server' && port === 23) {
        const v = target.lines.vty;
        if (v.loginLocal && !Object.keys(target.users).length) out.push('', '% Login invalid (chưa có username nào)', '', `[Connection to ${ip} closed by foreign host]`);
        else if (v.login && !v.password && !v.loginLocal) out.push('', 'Password required, but none set', '', `[Connection to ${ip} closed by foreign host]`);
        else out.push('', target.banner || '', 'User Access Verification', '', `[Lab] Đăng nhập Telnet vào ${target.name} thành công — lưu ý Telnet gửi mật khẩu dạng RÕ (cleartext), doanh nghiệp nên dùng SSH.`, `[Connection to ${ip} closed by foreign host]`);
      } else out.push(`[Lab] Kết nối TCP tới ${ip}:${port} thành công (bắt tay 3 bước hoàn tất).`, `[Connection to ${ip} closed by foreign host]`);
    } else if (r.kind === 'refused') out.push('% Connection refused by remote host');
    else out.push('% Connection timed out; remote host not responding');
    return R(out, { sim: r.sim, simLabel: `TCP ${ip}:${port}`, why: r.ok || r.kind === 'refused' ? null : r.fail?.why, ok: r.ok });
  }
  /** SSH: kết nối TCP 22 thật, rồi hỏi "Password:" (dòng gõ tiếp theo) — xem sshPw. */
  function sshConnect(d, ip, user, s) {
    const r = N.sendPacket(net, { src: d.id, dst: ip, proto: 'tcp', dport: 22, record: true, anim: true });
    const target = r.at ? net.devices[r.at.dev] : null;
    if (r.ok) {
      Object.assign(s, { pw: 'ssh', pwPrompt: 'Password: ', ssh: { target: target.id, user, ip } });
      return R([], { sim: r.sim, simLabel: `SSH ${ip}` });
    }
    const quiet = r.kind === 'refused' && target && N.loginQuiet(target);
    const out = r.kind === 'refused' ? ['% Connection refused by remote host'] : ['% Connection timed out; remote host not responding'];
    const why = r.kind === 'refused' ? (quiet ? `${target.name} đang ở QUIET MODE (login block-for) sau quá nhiều lần đăng nhập sai — mọi kết nối VTY bị từ chối tới khi hết thời gian chặn (trừ nguồn trong "login quiet-mode access-class").` : 'Cổng 22 đóng/bị từ chối: thiết bị chưa bật SSH (hostname, ip domain-name, crypto key ≥768 bit, line vty "login local" hoặc "aaa new-model" + "transport input ssh", có username) hoặc access-class trên VTY không cho nguồn này.') : r.fail?.why;
    return R(out, { sim: r.sim, simLabel: `SSH ${ip}`, why, ok: false });
  }
  function sshPw(d, s, line) {
    const { target, user, ip } = s.ssh;
    s.pw = null; s.ssh = null;
    const T = net.devices[target];
    const u = T?.users[user], methods = T?.aaa?.newModel && (T.aaa.lists[T.lines.vty.authList || 'default']);
    if (methods?.includes('group') ? aaaMethods(T, methods, user, line.trim()) === true : u && u.pw === line.trim()) {
      if (T.loginSec?.logOk) N.secLog(T, `%SEC_LOGIN-5-LOGIN_SUCCESS: Login Success [user: ${user}] [Source: ${epIpOf(d)}] [localport: 22]`);
      return R(['', T.banner || '', `[Lab] SSH v2 tới ${T.name} thành công với tài khoản "${user}" — phiên được MÃ HOÁ.`, `[Connection to ${ip} closed by foreign host]`], { ok: true });
    }
    if (T.loginSec?.logFail || T.loginSec?.blockFor) N.secLog(T, `%SEC_LOGIN-4-LOGIN_FAILED: Login failed [user: ${user}] [Source: ${epIpOf(d)}] [localport: 22] [Reason: Login Authentication Failed]`);
    const q = N.loginFailed(T);
    return R(['% Authentication failed.', '', `[Connection to ${ip} closed by foreign host]`, ...(q ? [`[Lab] ${T.name} vừa vào QUIET MODE ${T.loginSec.blockFor} giây (login block-for): ${T.loginSec.attempts} lần sai trong ${T.loginSec.within} giây → mọi kết nối SSH/Telnet mới bị từ chối.`] : [])], { ok: false, why: u ? 'Sai mật khẩu.' : `Không có username "${user}" trên ${T.name}.` });
  }
  const epIpOf = (d) => (d.type === 'pc' || d.type === 'server' ? d.ip : '');

  // ---------- IOS / flash / NVRAM ----------
  function cfgSnap(d) {
    const o = JSON.parse(JSON.stringify(d));
    for (const k of ['id', 'type', 'x', 'y', 'flash', 'flashSize', 'image', 'version', 'startupCfg', 'arp', 'macTable', 'natTable', 'rommon', 'rommonUser', 'bootWin', 'confreg', 'confregNext', 'logBuf', 'debug', 'off']) delete o[k];
    if (o.dhcp) o.dhcp.bindings = [];
    if (o.ports) for (const p of Object.values(o.ports)) p.errdis = false;
    for (const a of Object.values(o.acls || {})) for (const e of a.entries) e.matches = 0;
    if (o.crypto) for (const m of Object.values(o.crypto.maps)) for (const e of Object.values(m)) { delete e.encaps; delete e.decaps; delete e.tried; }
    return o;
  }
  /** config-register 0xNNNN — có hiệu lực ở lần khởi động sau (show version: "will be … at next reload"). */
  function confregSet(x, v) {
    if (!isRouter(x.d)) return R(['% Lab: config-register chỉ mô phỏng trên router']);
    if (!/^0x[0-9a-f]{1,4}$/i.test(v)) return R(['% Invalid input: config-register dạng hex, vd 0x2102']);
    x.d.confregNext = '0x' + v.slice(2).toLowerCase().padStart(4, '0');
    return R([]);
  }
  /** copy startup-config running-config = GỘP vào cấu hình đang chạy: cổng đang shutdown vẫn shutdown (startup không có lệnh "no shutdown"). */
  function copyStartRun(x) {
    const d = x.d;
    if (!d.startupCfg) return R(['%% Non-volatile configuration memory is not present']);
    const was = {};
    for (const [n, f] of Object.entries(isRouter(d) ? d.ifaces : d.ports)) was[n] = f.shutdown;
    const keepName = d.name;
    Object.assign(d, JSON.parse(JSON.stringify(d.startupCfg)));
    for (const [n, f] of Object.entries(isRouter(d) ? d.ifaces : d.ports)) if (was[n]) f.shutdown = true;
    return R([`${JSON.stringify(d.startupCfg).length} bytes copied in 0.312 secs`, ...(keepName !== d.name ? [] : []), ...(Object.values(was).some(Boolean) && isRouter(d) ? ['(Lab: lệnh copy chỉ GỘP — các cổng đang shutdown vẫn shutdown, nhớ "no shutdown" lại)'] : [])]);
  }
  /** ROMMON do người dùng vào bằng Break: confreg / reset / boot / dir / help. */
  function rommonExec(d, s, line) {
    s.rmn = (s.rmn || 1) + (line ? 1 : 0);
    const w = line.split(/\s+/).filter(Boolean);
    const cmd = (w[0] || '').toLowerCase();
    if (!cmd) return R([]);
    if (cmd === '?' || cmd === 'help' || /\?$/.test(line)) return R(['alias               set and display aliases command', 'boot                boot up an external process', 'confreg             configuration register utility', 'dir                 list files in file system', 'reset               system reset', 'set                 display the monitor variables', 'tftpdnld            tftp image download']);
    if (cmd === 'confreg' && !w[1]) return R(['', `Configuration Summary (Virtual Configuration Register: ${d.confregNext || d.confreg || '0x2102'})`, 'enabled are:', 'load rom after netboot fails', 'console baud: 9600', 'boot: image specified by the boot system commands', '      or default to: cisco2-C2900', '', '(Lab: gõ "confreg 0x2142" để lần khởi động sau BỎ QUA startup-config, rồi "reset")']);
    if (cmd === 'confreg') {
      if (!/^0x[0-9a-f]{1,4}$/i.test(w[1])) return R(['monitor: invalid configuration register value']);
      d.confregNext = '0x' + w[1].slice(2).toLowerCase().padStart(4, '0');
      return R(['', 'You must reset or power cycle for new config to take effect']);
    }
    if (cmd === 'dir') { N.ensureFlash(d); return R([`File size           Checksum   File name`, ...d.flash.map((f) => `${String(f.size).padStart(9)} bytes (0x${f.size.toString(16)})   0x${(f.md5 || '0000').slice(0, 4)}   ${f.name}`)]); }
    if (cmd === 'reset' || cmd === 'boot' || cmd === 'i') {
      d.rommon = false; d.rommonUser = false;
      return R(['', 'System Bootstrap, Version 15.0(1r)M15', ...doReload(d, s).slice(3)]);
    }
    return R([`monitor: command "${cmd}" not found`]);
  }
  function factory(d) {
    if (d.type === 'router') return N.router(d.id, 'Router', d.x, d.y, Object.keys(d.ifaces).filter((n) => !n.includes('.') && !n.startsWith('lo')));
    const f = N.sw(d.id, 'Switch', d.x, d.y, Object.keys(d.ports).filter((n) => !n.startsWith('po')));
    f.model = d.model;
    return f;
  }
  function showStartup(d) {
    if (!d.startupCfg) return ['startup-config is not present'];
    const tmp = Object.assign(factory(d), JSON.parse(JSON.stringify(d.startupCfg)), { id: d.id });
    const lines = runningConfig(tmp);
    return [`Using ${lines.join('\n').length} out of 262136 bytes`, ...lines.slice(3)];
  }
  function showFlash(d) {
    N.ensureFlash(d);
    const used = d.flash.reduce((s, f) => s + f.size, 0);
    return ['Directory of flash:/', '', ...d.flash.map((f, i) => `${lpad(i + 1, 5)}  -rw-  ${lpad(f.size, 12)}  <no date>  ${f.name}`), '', `${d.flashSize} bytes total (${d.flashSize - used} bytes free)`];
  }
  function bootSet(x, file) {
    N.ensureFlash(x.d);
    x.d.bootSystem = x.d.bootSystem.filter((b) => b !== file);
    x.d.bootSystem.push(file);
    return R(x.d.flash.some((f) => f.name === file) ? [] : [`%Warning: flash:${file} không có trong flash — router sẽ bỏ qua dòng này khi khởi động`]);
  }
  function copyTftpAsk(x) {
    return ask(x, [{ p: 'Address or name of remote host []? ', k: 'host' }, { p: 'Source filename []? ', k: 'src' }, { p: (dt) => `Destination filename [${dt.src}]? `, k: 'dst', def: (dt) => dt.src }], (dt) => tftpGet(x.d, dt));
  }
  /** SCP/SFTP chạy trên SSH: cần TCP 22 mở và đúng tài khoản trên máy đích, khác TFTP không xác thực. */
  function secureServer(d, dt, proto) {
    const url = `${proto}://${dt.user}@${dt.host}/`;
    if (!isIp(dt.host)) return { err: `%Error opening ${url} (Bad IP address)` };
    const r = N.sendPacket(net, { src: d.id, dst: dt.host, proto: 'tcp', dport: 22 });
    if (!r.ok) return { err: `%Error opening ${url} (${r.kind === 'refused' ? 'Connection refused' : 'Timed out'})`, why: r.fail?.why };
    const srv = net.devices[r.at.dev];
    if (srv.users?.[dt.user]?.pw !== dt.pw) return { err: `%Error opening ${url} (Permission denied)` };
    return { srv };
  }
  const secureAsk = (x, proto, extra, done) => ask(x, [{ p: 'Address or name of remote host []? ', k: 'host' }, { p: 'Username []? ', k: 'user' }, ...extra, { p: 'Password: ', k: 'pw' }], done);
  function securePutAsk(x, proto) {
    const def = `${x.d.name.toLowerCase()}-confg`;
    return secureAsk(x, proto, [{ p: `Destination filename [${def}]? `, k: 'dst', def: () => def }], (dt) => {
      const t = secureServer(x.d, dt, proto);
      if (t.err) return R([t.err], { why: t.why });
      const lines = runningConfig(x.d);
      t.srv.files = (t.srv.files || []).filter((f) => f.name !== dt.dst);
      t.srv.files.push({ name: dt.dst, size: lines.join('\n').length, config: true, via: proto });
      return R([`Writing ${dt.dst} !`, `${lines.join('\n').length} bytes copied in 0.842 secs`]);
    });
  }
  function secureGetAsk(x, proto) {
    return secureAsk(x, proto, [{ p: 'Source filename []? ', k: 'src' }, { p: (dt) => `Destination filename [${dt.src}]? `, k: 'dst', def: (dt) => dt.src }], (dt) => {
      const t = secureServer(x.d, dt, proto);
      if (t.err) return R([t.err], { why: t.why });
      const file = (t.srv.files || []).find((f) => f.name === dt.src);
      if (!file) return R([`%Error opening ${proto}://${dt.host}/${dt.src} (No such file or directory)`]);
      N.ensureFlash(x.d);
      x.d.flash = x.d.flash.filter((f) => f.name !== flashName(dt.dst));
      x.d.flash.push({ name: flashName(dt.dst), size: file.size, md5: file.md5 });
      return R([`Reading ${dt.src} ${'!'.repeat(36)}`, `${file.size} bytes copied in 12.4 secs`]);
    });
  }
  function tftpServer(d, host) {
    if (!isIp(host)) return { err: `%Error opening tftp://${host}/ (Bad IP address)` };
    const r = N.sendPacket(net, { src: d.id, dst: host });
    if (!r.ok) return { err: `%Error opening tftp://${host}/ (Timed out)`, why: r.fail?.why };
    const srv = net.devices[r.at.dev];
    if (srv.type !== 'server') return { err: `%Error opening tftp://${host}/ (Socket error / không phải TFTP server)` };
    return { srv };
  }
  function tftpGet(d, dt) {
    N.ensureFlash(d);
    const t = tftpServer(d, dt.host);
    if (t.err) return R([`Accessing tftp://${dt.host}/${dt.src}...`, t.err], { why: t.why });
    const file = (t.srv.files || []).find((f) => f.name === dt.src);
    if (!file) return R([`Accessing tftp://${dt.host}/${dt.src}...`, `%Error opening tftp://${dt.host}/${dt.src} (No such file or directory)`]);
    const used = d.flash.filter((f) => f.name !== dt.dst).reduce((s, f) => s + f.size, 0);
    if (used + file.size > d.flashSize) return R([`Accessing tftp://${dt.host}/${dt.src}...`, `%Error copying tftp://${dt.host}/${dt.src} (Not enough space on device)`, `(Lab: flash còn ${d.flashSize - used} byte, file cần ${file.size} byte — xoá bớt file cũ bằng "delete flash:<tên>")`]);
    d.flash = d.flash.filter((f) => f.name !== dt.dst);
    d.flash.push({ name: flashName(dt.dst), size: file.size, md5: file.md5 });
    return R([`Accessing tftp://${dt.host}/${dt.src}...`, `Loading ${dt.src} from ${dt.host} (via ${longIf(N.lookup(ctxOf(), d.id, dt.host)?.iface || 'g0/0')}): ${'!'.repeat(36)}`, `[OK - ${file.size} bytes]`, '', `${file.size} bytes copied in 41.250 secs (${Math.round(file.size / 41.25)} bytes/sec)`]);
  }
  function tftpPut(d, dt) {
    const t = tftpServer(d, dt.host);
    if (t.err) return R(['!!', t.err], { why: t.why });
    const lines = runningConfig(d);
    t.srv.files = (t.srv.files || []).filter((f) => f.name !== dt.dst);
    t.srv.files.push({ name: dt.dst, size: lines.join('\n').length, config: true });
    return R(['!!', `${lines.join('\n').length} bytes copied in 0.312 secs`]);
  }
  function verifyMd5(d, file) {
    N.ensureFlash(d);
    const f = d.flash.find((z) => z.name === file);
    if (!f) return R([`%Error verifying flash:${file} (No such file or directory)`]);
    return R(['.'.repeat(40) + 'Done!', `verify /md5 (flash:${file}) = ${f.md5 || '00000000000000000000000000000000'}`]);
  }
  function deleteAsk(x, file) {
    N.ensureFlash(x.d);
    return ask(x, [{ p: `Delete filename [${file}]? `, k: 'f', def: file }, { p: (dt) => `Delete flash:/${dt.f}? [confirm]`, k: 'c' }], (dt) => {
      if (!yes(dt.c)) return R([]);
      const f = flashName(dt.f);
      if (!x.d.flash.some((z) => z.name === f)) return R([`%Error deleting flash:/${f} (No such file or directory)`]);
      x.d.flash = x.d.flash.filter((z) => z.name !== f);
      return R(f === x.d.image ? ['(Lab: CẢNH BÁO — bạn vừa xoá file IOS đang chạy. Nếu không còn IOS nào khác, reload sẽ rơi vào ROMMON!)'] : []);
    });
  }
  function eraseAsk(x) {
    return ask(x, [{ p: 'Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]', k: 'c' }], (dt) => {
      if (!yes(dt.c)) return R([]);
      x.d.startupCfg = null;
      return R(['[OK]', 'Erase of nvram: complete', '%SYS-7-NV_BLOCK_INIT: Initialized the geometry of nvram']);
    });
  }
  function reloadAsk(x) {
    const changed = JSON.stringify(cfgSnap(x.d)) !== JSON.stringify(x.d.startupCfg);
    const steps = [];
    if (changed) steps.push({ p: 'System configuration has been modified. Save? [yes/no]: ', k: 'save' });
    steps.push({ p: 'Proceed with reload? [confirm]', k: 'go' });
    return ask(x, steps, (dt) => {
      const out = [];
      if (changed) {
        const a = (dt.save || '').toLowerCase();
        if (a.startsWith('y')) { x.d.startupCfg = cfgSnap(x.d); out.push('Building configuration...', '[OK]'); }
        else if (!a.startsWith('n')) return R(["% Please answer 'yes' or 'no'."]);
      }
      if (!yes(dt.go)) return R(out);
      out.push(...doReload(x.d, x.s));
      return R(out);
    });
  }
  function doReload(d, s) {
    N.ensureFlash(d);
    const out = ['', '%SYS-5-RELOAD: Reload requested by console. Reload Reason: Reload Command.', ''];
    let img = null;
    for (const b of d.startupCfg?.bootSystem || []) { if (d.flash.some((f) => f.name === b)) { img = b; break; } out.push(`%Boot image flash:${b} not found`); }
    if (!img) img = d.flash.find((f) => /\.bin$/.test(f.name))?.name;
    if (!img) { d.rommon = true; out.push('System Bootstrap, Version 15.0(1r)M15', 'boot: cannot determine first file name on device "flash:"', '', 'rommon 1 > ', '(Lab: KHÔNG có IOS nào trong flash → thiết bị kẹt ở ROMMON. Bấm "↺ Làm lại" để khôi phục lab.)'); return out; }
    const reg = d.confregNext || d.confreg || (d.type === 'router' ? '0x2102' : null);
    const skipCfg = d.type === 'router' && (parseInt(reg, 16) & 0x40) !== 0; // bit 6 (0x2142): bỏ qua NVRAM khi khởi động
    const keep = { id: d.id, type: d.type, x: d.x, y: d.y, flash: d.flash, flashSize: d.flashSize, startupCfg: d.startupCfg, image: img, version: N.verOf(img) || d.version, ...(reg ? { confreg: reg } : {}), bootWin: d.type === 'router' };
    const fresh = factory(d);
    if (d.startupCfg && !skipCfg) Object.assign(fresh, JSON.parse(JSON.stringify(d.startupCfg)));
    Object.assign(fresh, keep);
    if (d.type === 'switch') Object.assign(fresh, { vlans: d.vlans, vtpMode: d.vtpMode, vtpDomain: d.vtpDomain, vtpRev: d.vtpRev, vtpPw: d.vtpPw, model: d.model }); // vlan.dat nằm trong flash, không mất
    for (const k of Object.keys(d)) delete d[k];
    Object.assign(d, fresh);
    out.push('System Bootstrap, Version 15.0(1r)M15, RELEASE SOFTWARE (fc1)', 'Technical Support: http://www.cisco.com/techsupport', ...(d.type === 'router' ? ['(Lab: trong ~60 giây đầu, gõ "send break" hoặc nhấn Ctrl+Break để dừng khởi động và vào ROMMON)'] : []), '', 'program load complete, entry point: 0x80803000, size: 0x1b340', `Self decompressing the image : ${'#'.repeat(46)} [OK]`, '', `Cisco IOS Software, ${d.type === 'router' ? 'C2900' : 'C2960'} Software, Version ${d.version}, RELEASE SOFTWARE`, `System image file is "flash:${img}"`, '', skipCfg && d.startupCfg ? `         --- System Configuration Dialog ---  (Lab: config-register ${reg} → BỎ QUA startup-config. Cấu hình cũ vẫn nằm trong NVRAM: "copy startup-config running-config" để nạp lại)` : d.startupCfg ? '' : '         --- System Configuration Dialog ---  (Lab: NVRAM trống — mọi cấu hình chưa "copy run start" đã MẤT)', '', 'Press RETURN to get started!');
    s.mode = 'user';
    s.loggedOut = true;
    return out;
  }

  // ---------- PC ----------
  const PC_HELP = ['Available Commands:', '?         Display the list of available commands', 'arp       Display the arp table (arp -a)', 'ipconfig  Display network configuration / ipconfig <IP> <mask> [<gateway>] / ipconfig /renew /release /all', 'ipv6config <IPv6>/<prefix> [<gateway>] | ipv6config autoconfig (SLAAC)', 'ping      Send echo messages', 'ssh       Ssh client (ssh -l <user> <ip>)', 'telnet    Telnet client (telnet <ip> [port])', 'curl      Gọi web (curl <url>)', 'tracert   Trace route to destination', 'snmpget   SNMP get (snmpget -v2c -c <community> <ip> sysName.0 | -v3 -u <user> -l authPriv -a SHA -A <pass> -x AES -X <pass> <ip> <oid>)', 'snmpwalk  SNMP walk nhóm system', 'snmpset   SNMP set (snmpset -v2c -c <community> <ip> sysLocation.0 s "<giá trị>")'];
  function ipconfigOut(d, all) {
    const L = ['', 'FastEthernet0 Connection:(default port)', '', '   Connection-specific DNS Suffix..: '];
    if (all) L.push(`   Physical Address................: ${N.ciscoMac(N.epMac(net, { dev: d.id, ifn: 'fa0' })).toUpperCase()}`, `   DHCP Enabled....................: ${d.dhcp ? 'Yes' : 'No'}`);
    const ll = V6.llOf(net, d.id, 'fa0');
    if (ll) L.push(`   Link-local IPv6 Address.........: ${ll}`);
    if (d.ip6) L.push(`   IPv6 Address....................: ${d.ip6}/${d.prefix6 ?? 64}`);
    L.push(`   IPv4 Address....................: ${d.ip || '0.0.0.0'}`, `   Subnet Mask.....................: ${d.ip ? prefixToMask(d.prefix) : '0.0.0.0'}`, ...(d.gw6 ? [`   Default Gateway.................: ${d.gw6}`, `                                     ${d.gateway || '0.0.0.0'}`] : [`   Default Gateway.................: ${d.gateway || '0.0.0.0'}`]));
    if (all) L.push(`   DNS Servers.....................: ${d.dns || '0.0.0.0'}`);
    L.push('');
    return L;
  }
  function pcPing(d, ip) {
    const r = N.sendPacket(net, { src: d.id, dst: ip, record: true, anim: true });
    icmpDebug(d, ip, r, 4);
    const L = ['', `Pinging ${ip} with 32 bytes of data:`, ''];
    let got = 0;
    for (let i = 0; i < 4; i++) {
      if (r.ok) { L.push(`Reply from ${ip}: bytes=32 time${i ? '<1ms' : '=1ms'} TTL=${r.ttl}`); got++; }
      else if (r.fail?.kind === 'nogw' || r.fail?.kind === 'noip') L.push('PING: transmit failed. General failure. ');
      else if (r.kind === 'unreach' && r.fail?.ip) L.push(`Reply from ${r.fail.ip}: Destination host unreachable.`);
      else L.push('Request timed out.');
    }
    L.push('', `Ping statistics for ${ip}:`, `    Packets: Sent = 4, Received = ${got}, Lost = ${4 - got} (${(4 - got) * 25}% loss),`);
    if (got) L.push('Approximate round trip times in milli-seconds:', '    Minimum = 0ms, Maximum = 1ms, Average = 0ms');
    L.push('');
    return R(L, { sim: r.sim, simLabel: `${d.name} ping ${ip}`, why: r.ok ? null : r.fail?.why, ok: r.ok });
  }
  function pcPing6(d, ip) {
    const r = V6.ping6(net, d.id, ip, { record: true });
    const L = ['', `Pinging ${ip} with 32 bytes of data:`, ''];
    for (let i = 0; i < 4; i++) L.push(r.ok ? `Reply from ${ip}: bytes=32 time${i ? '<1ms' : '=1ms'}` : 'Request timed out.');
    L.push('', `Ping statistics for ${ip}:`, `    Packets: Sent = 4, Received = ${r.ok ? 4 : 0}, Lost = ${r.ok ? 0 : 4} (${r.ok ? 0 : 100}% loss),`, '');
    return R(L, { why: r.ok ? null : r.fail?.why, ok: r.ok });
  }
  function pcTrace(d, ip) {
    const r = N.sendPacket(net, { src: d.id, dst: ip, record: false, anim: true });
    const L = ['', `Tracing route to ${ip} over a maximum of 30 hops: `, ''];
    let n = 0;
    for (const h of r.hops) L.push(`  ${lpad(++n, 2)}   0 ms      0 ms      0 ms      ${h.ip}`);
    if (r.ok) { if (!r.hops.length || r.hops[r.hops.length - 1].ip !== ip) L.push(`  ${lpad(++n, 2)}   1 ms      0 ms      1 ms      ${ip}`); }
    else for (let k = 0; k < 2; k++) L.push(`  ${lpad(++n, 2)}   *         *         *         Request timed out.`);
    L.push('', 'Trace complete.');
    return R(L, { sim: r.sim, simLabel: `${d.name} tracert ${ip}`, why: r.ok ? null : r.fail?.why, ok: r.ok });
  }
  // ---------- VPCS (Virtual PC Simulator — PC mặc định trong EVE-NG / GNS3) ----------
  const VPCS_HELP = [
    '?                        Print help',
    'arp                      Shortcut for: show arp. Show arp table',
    'clear ARG                Clear IPv4/IPv6, arp/neighbor cache, command history',
    'dhcp [OPTION]            Shortcut for: ip dhcp. Get IPv4 address via DHCP',
    'ip ARG ... [OPTION]      Configure the current VPC\'s IP settings. See ip ?',
    'ping HOST [OPTION ...]   Ping HOST with ICMP (default) or TCP/UDP. See ping ?',
    'save [FILENAME]          Save the configuration to the file FILENAME',
    'show [ARG]               Print the information of VPCs (default). See show ?',
    'trace HOST [OPTION ...]  Print the path packets take to network HOST',
    'version                  Print the version information',
  ];
  const VPCS_IP_HELP = ['ip ARG ... [OPTION]', 'Configure the current VPC\'s IP settings', '  ARG ...:', '  address [mask] [gateway]', '  address [gateway] [mask]', '                 Set the VPC\'s ip, default gateway ip and network mask', '                 Default IPv4 mask is /24, IPv6 is /64. Example:', '                 ip 10.1.1.70/26 10.1.1.65 set the VPC\'s ip to 10.1.1.70,', '                 the gateway to 10.1.1.65, the netmask to 255.255.255.192.', '                 In tap mode, the ip of the tapx is the maximum host ID', '                 of the subnet. In the example above,', '                 the tapx ip would be 10.1.1.126', '  auto           Attempt to obtain IPv6 address, mask and gateway using SLAAC', '  dhcp [OPTION]  Attempt to obtain IPv4 address, mask, gateway, DNS via DHCP', '  dns ip         Set DNS server ip, delete if ip is \'0\''];
  const vmac = (d) => N.epMac(net, { dev: d.id, ifn: 'fa0' });
  const vms = (i) => (0.5 + ((i * 37) % 70) / 100).toFixed(3);
  function vpcsShowIp(d) {
    return [
      '', `NAME        : ${d.name}[1]`, `IP/MASK     : ${d.ip ? `${d.ip}/${d.prefix}` : '0.0.0.0/0'}`, `GATEWAY     : ${d.gateway || '0.0.0.0'}`, `DNS         : ${d.dns || ''}`,
      ...(d.dhcp && d.ip ? [`DHCP SERVER : ${d.dhcpServer || d.gateway || ''}`, 'DHCP LEASE  : 86391, 86400/43200/75600'] : []),
      `MAC         : ${vmac(d)}`, 'LPORT       : 20000', 'RHOST:PORT  : 127.0.0.1:30000', 'MTU         : 1500', '',
    ];
  }
  function vpcsSetIp(d, w) {
    // ip A.B.C.D[/len] [gw] [mask]  |  ip A.B.C.D mask|len [gw]  — như VPCS: mask mặc định /24
    let [addr, len] = w[1].split('/');
    if (!isIp(addr)) return R(['Invalid address']);
    let pfx = len != null ? +len : null, gw = '';
    for (const x of w.slice(2)) {
      if (/^\d{1,2}$/.test(x) && pfx == null) pfx = +x;
      else if (isIp(x)) {
        let mp = null;
        try { mp = maskToPrefix(x); } catch { mp = null; }
        if (pfx == null && mp != null && /^255\./.test(x)) pfx = mp; else if (!gw) gw = x; else return R(['Invalid gateway']);
      } else return R(['Invalid options']);
    }
    pfx ??= 24;
    if (!(pfx >= 1 && pfx <= 32)) return R(['Invalid netmask']);
    if (gw && !N.inNet(gw, addr, pfx)) return R([`Gateway ${gw} is not in the subnet ${N.netOf(addr, pfx)}/${pfx}`]);
    // VPCS gửi gratuitous ARP kiểm tra trùng IP trước khi nhận địa chỉ
    const out = ['Checking for duplicate address...'];
    const old = { ip: d.ip, prefix: d.prefix };
    d.ip = addr; d.prefix = pfx;
    const dup = N.resolve(net, { dev: d.id, ifn: 'fa0' }, addr);
    if (!dup.fail && !dup.proxy && !dup.fhrp && dup.ep && dup.ep.dev !== d.id) {
      d.ip = old.ip; d.prefix = old.prefix;
      return R([...out, `${addr} is being used by MAC ${dup.mac}`, 'Address not changed']);
    }
    d.gateway = gw; d.dhcp = false;
    return R([...out, `${d.name} : ${addr} ${N.prefixToMask(pfx)}${gw ? ` gateway ${gw}` : ''}`]);
  }
  function vpcsDhcp(d) {
    const r = N.dhcpRequest(net, d.id, { record: true, anim: true });
    d.dhcp = true;
    if (r.ok) {
      d.ip = r.ip; d.prefix = r.prefix; d.gateway = r.gw; d.dns = r.dns; d.dhcpServer = r.gw || '';
      return R([`DDORA IP ${r.ip}/${r.prefix} GW ${r.gw || '0.0.0.0'}`], { sim: r.sim, simLabel: `${d.name} DHCP`, ok: true });
    }
    return R(['DDD', "Can't find dhcp server"], { sim: r.sim, simLabel: `${d.name} DHCP (thất bại)`, why: 'Không nhận được DHCP OFFER. ' + (r.why || ''), ok: false });
  }
  function vpcsPing(d, ip, n = 5) {
    const r = N.sendPacket(net, { src: d.id, dst: ip, record: true, anim: true });
    icmpDebug(d, ip, r, n);
    const L = [];
    if (r.fail?.kind === 'nogw' || r.fail?.kind === 'noip') return R([`host (${ip}) not reachable`], { why: r.fail?.why, ok: false });
    for (let i = 1; i <= n; i++) {
      if (r.ok) L.push(`84 bytes from ${ip} icmp_seq=${i} ttl=${r.ttl ?? 64} time=${vms(i)} ms`);
      else if (r.kind === 'unreach' && r.fail?.ip) L.push(`*${r.fail.ip} icmp_seq=${i} ttl=255 time=${vms(i)} ms (ICMP type:3, code:1, Destination host unreachable)`);
      else L.push(`${ip} icmp_seq=${i} timeout`);
    }
    return R(L, { sim: r.sim, simLabel: `${d.name} ping ${ip}`, why: r.ok ? null : r.fail?.why, ok: r.ok });
  }
  function vpcsTrace(d, ip) {
    const r = N.sendPacket(net, { src: d.id, dst: ip, record: false, anim: true });
    if (r.fail?.kind === 'nogw' || r.fail?.kind === 'noip') return R([`host (${ip}) not reachable`], { ok: false });
    const L = [`trace to ${ip}, 8 hops max, press Ctrl+C to stop`];
    let n = 0;
    for (const h of r.hops) if (h.ip !== ip) L.push(` ${++n}   ${pad(h.ip, 15)} ${vms(n)} ms  ${vms(n + 1)} ms  ${vms(n + 2)} ms`);
    if (r.ok) L.push(` ${++n}   *${ip}   ${vms(n)} ms (ICMP type:3, code:3, Destination port unreachable)`);
    else while (n < 8) L.push(` ${++n}   *  *  *`);
    return R(L, { sim: r.sim, simLabel: `${d.name} trace ${ip}`, why: r.ok ? null : r.fail?.why, ok: r.ok });
  }
  function vpcsArp(d) {
    const ent = Object.entries(d.arp || {});
    if (!ent.length) return R(['', 'arp table is empty', '']);
    return R(['', ...ent.map(([ip, e], i) => `${e.mac}  ${ip} expires in ${117 - ((i * 7) % 40)} seconds `), '']);
  }
  function vpcsExec(d, line) {
    const w = line.split(/\s+/).filter(Boolean);
    const cmd = (w[0] || '').toLowerCase();
    const is = (full, min = 2) => cmd.length >= Math.min(min, full.length) && full.startsWith(cmd);
    if (!cmd) return R([]);
    if (cmd === '?' || is('help', 1)) return R(VPCS_HELP);
    if (cmd === 'ip') {
      const a = (w[1] || '').toLowerCase();
      if (!a || a === '?') return R(VPCS_IP_HELP);
      if (a === 'dhcp') return vpcsDhcp(d);
      if (a === 'dns') {
        if (!w[2] || !isIp(w[2])) return R(['Invalid address']);
        d.dns = w[2] === '0' || w[2] === '0.0.0.0' ? '' : w[2];
        return R([]);
      }
      if (a === 'auto') {
        const r = V6.slaac(net, d.id);
        d.slaac = true;
        if (!r.ok) return R(['No router answered ICMPv6 Router Solicitation'], { why: r.why, ok: false });
        d.ip6 = r.ip; d.prefix6 = r.prefix; d.gw6 = r.gw;
        return R([`GLOBAL SCOPE      : ${r.ip}/${r.prefix}`, `ROUTER LINK-LAYER : ${r.router}`]);
      }
      return vpcsSetIp(d, w);
    }
    if (is('dhcp')) return vpcsDhcp(d);
    if (is('show', 2) || is('arp', 2)) {
      const a = cmd.startsWith('a') ? 'arp' : (w[1] || '').toLowerCase();
      if (!a) return R(['', `NAME   IP/MASK              GATEWAY           MAC                LPORT  RHOST:PORT`, `${pad(d.name, 7)}${pad(d.ip ? `${d.ip}/${d.prefix}` : '0.0.0.0/0', 21)}${pad(d.gateway || '0.0.0.0', 18)}${pad(vmac(d), 19)}20000  127.0.0.1:30000`, `       ${d.ip6 ? `${d.ip6}/${d.prefix6}` : 'fe80::250:79ff:fe66:6800/64'}`, '']);
      if ('ip'.startsWith(a)) return R(vpcsShowIp(d));
      if ('arp'.startsWith(a)) return vpcsArp(d);
      if (a === '?') return R(['show [ARG]', '  Show information of VPCs', '  ARG:', '    arp      Show arp table', '    ip       Show IPv4 details', '    ipv6     Show IPv6 details', '    history  List the command history', '    version  Show the version information']);
      if (a === 'ipv6') return R(['', `NAME              : ${d.name}[1]`, 'LINK-LOCAL SCOPE  : fe80::250:79ff:fe66:6800/64', `GLOBAL SCOPE      : ${d.ip6 ? `${d.ip6}/${d.prefix6}` : ''}`, `ROUTER LINK-LAYER : ${d.gw6 || ''}`, `MAC               : ${vmac(d)}`, '']);
      if (a === 'version' || a === 'history') return vpcsExec(d, a);
      return R(['Invalid arguments']);
    }
    if (is('ping', 1)) {
      const ip = w.slice(1).find(isIp);
      if (!ip) return R([w[1] ? `host (${w[1]}) not found` : 'Incomplete command']);
      const c = w.indexOf('-c');
      return vpcsPing(d, ip, c > 0 && /^\d+$/.test(w[c + 1] || '') ? Math.min(20, Math.max(1, +w[c + 1])) : 5);
    }
    if (is('trace', 2)) { const ip = w.slice(1).find(isIp); return ip ? vpcsTrace(d, ip) : R(['Incomplete command']); }
    if (is('save', 2)) {
      d.vpcsSaved = { ip: d.ip, prefix: d.prefix, gateway: d.gateway, dns: d.dns, dhcp: !!d.dhcp };
      return R([`Saving startup configuration to ${w[1] || 'startup.vpc'}`, '.  done']);
    }
    if (is('clear', 2)) {
      const a = (w[1] || '').toLowerCase();
      if (a === 'ip') { d.ip = ''; d.prefix = 24; d.gateway = ''; d.dns = ''; d.dhcp = false; return R(['IPv4 address/mask, gateway, DNS, and DHCP cleared']); }
      if (a === 'arp') { d.arp = {}; return R([]); }
      if (a === 'ipv6') { d.ip6 = ''; d.gw6 = ''; d.slaac = false; return R(['IPv6 address/mask and router link-layer address cleared']); }
      return R(['clear ARG', '  ARG:', '    ip       Clear IPv4 address/mask, gateway, DNS, and DHCP', '    ipv6     Clear IPv6 address/mask and router link-layer address', '    arp      Clear arp table', '    neighbor Clear IPv6 neighbor table', '    hist     Clear the command history']);
    }
    if (is('version', 2)) return R(['', 'Welcome to Virtual PC Simulator, version 0.6.2 (mô phỏng trong Packet Journey)', 'Dedicated to Daling.', 'Build time: Oct 27 2026', 'Copyright (c) 2007-2015, Paul Meng (mirnshi@gmail.com)', 'All rights reserved.', '', 'VPCS is free software, distributed under the terms of the "BSD" licence.', '']);
    if (cmd === 'history' || is('history', 2)) return R((sess(d.id).hist || []).map((h, i) => `${String(i + 1).padStart(4)}  ${h}`));
    if (cmd === 'ipconfig' || cmd === 'tracert') return R([`Bad command: "${line}". Use ? for help.`, `(Lab: đây là VPCS, không phải Windows — dùng "${cmd === 'ipconfig' ? 'ip 10.0.0.10/24 10.0.0.1 hoặc show ip' : 'trace'}". Chuột phải PC → đổi sang dòng lệnh Windows nếu muốn.)`]);
    return R([`Bad command: "${line}". Use ? for help.`]);
  }

  function pcExec(d, line) {
    const w = line.split(/\s+/).filter(Boolean);
    const cmd = (w[0] || '').toLowerCase();
    if (!cmd) return R([]);
    if (cmd === '?' || cmd === 'help') return R(d.radius || d.tacacs ? [...PC_HELP, `${d.radius ? 'radius' : 'tacacs'}    ${d.radius ? 'radius' : 'tacacs'} secret <chuỗi> | ${d.radius ? 'radius' : 'tacacs'} user <tên> <mật khẩu> | ${d.radius ? 'radius' : 'tacacs'} show`] : d.zone ? [...PC_HELP, 'dns       dns add <tên> <IP> | dns add <tên> AAAA|CNAME|MX|NS|PTR <giá trị> | dns del <tên> [kiểu] | dns show'] : PC_HELP);
    if (cmd === 'dns' && d.zone) {
      const a = (w[1] || '').toLowerCase(), name = (w[2] || '').toLowerCase().replace(/\.$/, '');
      const type = (w[3] || '').toUpperCase(), value = w.slice(4).join(' ').toLowerCase().replace(/\.$/, '');
      const usage = 'Cú pháp: dns add <tên> <IP> | dns add <tên> AAAA|CNAME|NS|PTR <giá trị> | dns add <tên> MX <ưu tiên> <máy chủ> | dns del <tên> [kiểu] | dns show';
      const drop = (ty) => { d.rr = (d.rr || []).filter((r) => !(r.name === name && (!ty || r.type === ty))); };
      if (a === 'add' && name && isIp(w[3])) { d.zone[name] = w[3]; return R([]); }
      if (a === 'add' && name && type === 'A' && isIp(w[4])) { d.zone[name] = w[4]; return R([]); }
      if (a === 'add' && name && value && DNS_TYPES.includes(type) && type !== 'A') {
        if (type === 'AAAA' ? !A6.isIp6(value) : type === 'MX' ? !/^\d+ \S+$/.test(value) : /\s/.test(value)) return R([usage]);
        drop(type); // shortcut: mỗi tên + kiểu giữ một bản ghi; cần nhiều MX/NS cùng tên thì bỏ dòng này với hai kiểu đó.
        d.rr.push({ name, type, value });
        return R([]);
      }
      if (a === 'del' && name) { if (!type || type === 'A') delete d.zone[name]; drop(type || null); return R([]); }
      if (a === 'show') return R([...Object.entries(d.zone).map(([n, ip]) => `${n}  A  ${ip}`), ...(d.rr || []).map((r) => `${r.name}  ${r.type}  ${r.value}`)]);
      return R([usage]);
    }
    if (cmd === 'tacacs' && d.tacacs) {
      const a = (w[1] || '').toLowerCase();
      if (a === 'secret' && w[2]) { d.tacacs.secret = w[2]; return R([]); }
      if (a === 'user' && w[2] && w[3]) { d.tacacs.users[w[2]] = w[3]; return R([]); }
      if (a === 'show') return R([`Shared secret: ${d.tacacs.secret ? 'đã đặt' : 'chưa đặt'}`, `Tài khoản: ${Object.keys(d.tacacs.users).join(', ') || '(chưa có)'}`]);
      return R(['Cú pháp: tacacs secret <chuỗi> | tacacs user <tên> <mật khẩu> | tacacs show']);
    }
    if (cmd === 'radius' && d.radius) {
      const a = (w[1] || '').toLowerCase();
      if (a === 'secret' && w[2]) { d.radius.secret = w[2]; return R([]); }
      if (a === 'user' && w[2] && w[3]) { d.radius.users[w[2]] = w[3]; return R([]); }
      if (a === 'show') return R([`Shared secret: ${d.radius.secret ? 'đã đặt' : 'chưa đặt'}`, `Tài khoản: ${Object.keys(d.radius.users).join(', ') || '(chưa có)'}`]);
      return R(['Cú pháp: radius secret <chuỗi> | radius user <tên> <mật khẩu> | radius show']);
    }
    if (cmd === 'ipconfig') {
      const a = (w[1] || '').toLowerCase();
      if (!a) return R(ipconfigOut(d, false));
      if (a === '/all') return R(ipconfigOut(d, true));
      if (a === '/renew') {
        const r = N.dhcpRequest(net, d.id, { record: true, anim: true });
        d.dhcp = true;
        if (r.ok) { d.ip = r.ip; d.prefix = r.prefix; d.gateway = r.gw; d.dns = r.dns; return R(ipconfigOut(d, false), { sim: r.sim, simLabel: `${d.name} DHCP`, ok: true }); }
        const m = N.epMac(net, { dev: d.id, ifn: 'fa0' }).split(':');
        d.ip = `169.254.${parseInt(m[4], 16)}.${parseInt(m[5], 16) || 1}`; d.prefix = 16; d.gateway = '';
        return R(['DHCP request failed. ', ...ipconfigOut(d, false)], { sim: r.sim, simLabel: `${d.name} DHCP (thất bại)`, why: 'Không nhận được DHCP OFFER. ' + (r.why || ''), ok: false });
      }
      if (a === '/release') {
        for (const x of Object.values(net.devices)) {
          if (x.dhcp?.bindings) x.dhcp.bindings = x.dhcp.bindings.filter((b) => b.ip !== d.ip);
          if (x.snoop?.bindings) x.snoop.bindings = x.snoop.bindings.filter((b) => b.ip !== d.ip); // DHCPRELEASE xoá binding snooping
        }
        d.ip = ''; d.gateway = ''; d.dns = '';
        return R(ipconfigOut(d, false));
      }
      if (isIp(w[1])) {
        let pfx;
        try { pfx = maskToPrefix(w[2] || ''); } catch { return R(['Invalid Command.']); }
        if (w[3] && !isIp(w[3])) return R(['Invalid Command.']);
        d.ip = w[1]; d.prefix = pfx; d.gateway = w[3] || ''; d.dhcp = false;
        return R([]);
      }
      return R(['Invalid Command.']);
    }
    if (cmd === 'ipv6config') {
      const a = (w[1] || '').toLowerCase();
      if (!a) return R(ipconfigOut(d, false));
      if (a === 'autoconfig') {
        const r = V6.slaac(net, d.id);
        d.slaac = true;
        if (!r.ok) { d.ip6 = ''; d.gw6 = ''; return R(['IPv6 autoconfig failed.', ...ipconfigOut(d, false)], { why: r.why, ok: false }); }
        d.ip6 = r.ip; d.prefix6 = r.prefix; d.gw6 = r.gw;
        return R([`(SLAAC: nhận Router Advertisement từ ${r.router} → prefix /64 + EUI-64)`, ...ipconfigOut(d, false)]);
      }
      const p = A6.parsePrefix6(w[1]);
      const gw = w[2] ? A6.norm6(w[2]) : '';
      if (!p || (w[2] && !gw)) return R(['Invalid Command.', 'Cú pháp: ipv6config <IPv6>/<prefix> [<gateway IPv6>] | ipv6config autoconfig']);
      d.ip6 = p.ip; d.prefix6 = p.prefix; d.gw6 = gw; d.slaac = false;
      return R([]);
    }
    if (cmd === 'ping' && w[1] && A6.isIp6(w[1])) return pcPing6(d, A6.norm6(w[1]));
    if (cmd === 'snmpget' || cmd === 'snmpwalk' || cmd === 'snmpset') return R(SN.snmpTool(net, d.id, line));
    if (cmd === 'ping') { const ip = w.slice(1).find(isIp); return ip ? pcPing(d, ip) : R(['Invalid Command.']); }
    if (cmd === 'tracert') { const ip = w.slice(1).find(isIp); return ip ? pcTrace(d, ip) : R(['Invalid Command.']); }
    if (cmd === 'telnet') { if (!isIp(w[1])) return R(['Invalid Command.']); return tcpConnect(d, w[1], w[2] ? +w[2] : 23); }
    if (cmd === 'curl') return LINUX.curl(d, w);
    if (cmd === 'ssh') { const i = w.indexOf('-l'); if (i < 0 || !w[i + 1] || !isIp(w[i + 2])) return R(['Invalid Command.', 'Cú pháp: ssh -l <username> <ip>']); return sshConnect(d, w[i + 2], w[i + 1], sess(d.id)); }
    if (cmd === 'arp' && (w[1] || '').toLowerCase() === '-a') {
      const ent = Object.entries(d.arp);
      if (!ent.length) return R(['No ARP Entries Found']);
      return R(['  Internet Address      Physical Address      Type', ...ent.map(([ip, e]) => `  ${pad(ip, 22)}${pad(N.ciscoMac(e.mac), 22)}dynamic`)]);
    }
    return R(['Invalid Command.']);
  }

  // ======================================================================
  // SHOW
  // ======================================================================
  function ifStatus(d, n) {
    const f = d.ifaces[n];
    if (n.startsWith('tu')) return f.shutdown ? ['administratively down', 'down'] : ['up', N.ifUp(net, d.id, n) ? 'up' : 'down'];
    if (n.includes('.')) {
      const p = n.split('.')[0];
      if (f.shutdown || d.ifaces[p].shutdown) return ['administratively down', 'down'];
      return N.ifUp(net, d.id, n) ? ['up', 'up'] : ['down', 'down'];
    }
    if (f.shutdown) return ['administratively down', 'down'];
    if (!N.statusUp(net, d.id, n)) return ['down', 'down'];
    return ['up', N.lineUp(net, d.id, n) ? 'up' : 'down'];
  }
  function ifOrder(d) {
    return Object.keys(IFS(d)).sort((a, b) => { const pa = a.split('.')[0], pb = b.split('.')[0]; return pa === pb ? (a.includes('.') ? 1 : 0) - (b.includes('.') ? 1 : 0) || ifSort(a, b) : ifSort(pa, pb); });
  }
  function showIpIntBriefRouter(d) {
    const L = ['Interface              IP-Address      OK? Method Status                Protocol '];
    for (const n of ifOrder(d)) {
      const f = d.ifaces[n];
      const [st, pr] = ifStatus(d, n);
      L.push(`${pad(longIf(n), 23)}${pad(f.ip || 'unassigned', 16)}YES ${pad(f.ip ? 'manual' : 'unset', 7)}${pad(st, 22)}${pr}`);
    }
    return L;
  }
  function swPortStatus(d, n) {
    const p = d.ports[n];
    if (n.startsWith('po')) {
      const mem = Object.keys(d.ports).filter((m) => d.ports[m].group === +n.slice(2));
      const up = mem.some((m) => N.bundleOf(net, d, m)?.formed);
      return p.shutdown ? ['administratively down', 'down'] : up ? ['up', 'up'] : ['down', 'down'];
    }
    if (p.shutdown) return ['administratively down', 'down'];
    return N.lineUp(net, d.id, n) ? ['up', 'up'] : ['down', 'down'];
  }
  function showIpIntBriefSwitch(d) {
    const L = ['Interface              IP-Address      OK? Method Status                Protocol '];
    for (const n of Object.keys(d.ports).sort(ifSort)) { const [st, pr] = swPortStatus(d, n); L.push(`${pad(longIf(n), 23)}${pad('unassigned', 16)}YES ${pad('unset', 7)}${pad(st, 22)}${pr}`); }
    for (const n of Object.keys(d.svis).sort(ifSort)) {
      const v = d.svis[n];
      const st = v.shutdown ? 'administratively down' : N.ifUp(net, d.id, n) ? 'up' : 'down';
      L.push(`${pad(longIf(n), 23)}${pad(v.ip || 'unassigned', 16)}YES ${pad(v.ip ? 'manual' : 'unset', 7)}${pad(st, 22)}${N.ifUp(net, d.id, n) ? 'up' : 'down'}`);
    }
    return L;
  }

  const CODES = [
    'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
    '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area ',
    '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2',
    '       E1 - OSPF external type 1, E2 - OSPF external type 2, E - EGP',
    '       i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2, ia - IS-IS inter area',
    '       * - candidate default, U - per-user static route, o - ODR',
    '       P - periodic downloaded static route',
    '',
  ];
  function routeText(r) {
    const nw = `${r.net}/${r.prefix}`;
    if (r.discard) return `${nw} is ${r.code[0] === 'S' ? 'directly connected' : 'a summary, 00:05:12'}, Null0`;
    if (r.alts?.length) return `${nw} [${r.ad}/${r.metric}] via ${r.nextHop}, 00:05:12, ${longIf(r.iface)}\n${r.alts.map((p) => `${' '.repeat(nw.length + 10)}[${r.ad}/${p.m}] via ${p.nh}, 00:05:12, ${longIf(p.outIf)}`).join('\n')}`;
    if (r.code === 'C' || r.code === 'L') return `${nw} is directly connected, ${longIf(r.iface)}`;
    if (r.code[0] === 'S') return r.nextHop ? `${nw} [${r.ad}/0] via ${r.nextHop}` : `${nw} is directly connected, ${longIf(r.iface)}`;
    return `${nw} [${r.ad}/${r.metric}] via ${r.nextHop}, 00:0${(r.metric % 5) + 1}:${String(10 + (r.metric % 49)).padStart(2, '0')}, ${longIf(r.iface)}`;
  }
  function showIpRoute(d, filter, vrf = null) {
    if (d.type === 'switch' && !d.ipRouting) return [`Default gateway is ${d.defaultGateway || 'not set'}`, '', 'Host               Gateway           Last Use    Total Uses  Interface', 'ICMP redirect cache is empty', '(Lab: switch Layer 2 không định tuyến — chỉ dùng ip default-gateway cho chính nó)'];
    const ctx = ctxOf();
    let rt = N.routeTable(ctx, d.id, vrf);
    const allRt = rt;
    if (filter === 'ospf') rt = rt.filter((r) => r.code[0] === 'O');
    if (filter === 'static') rt = rt.filter((r) => r.code[0] === 'S');
    if (filter === 'connected') rt = rt.filter((r) => r.code === 'C' || r.code === 'L');
    if (filter === 'eigrp') rt = rt.filter((r) => r.code[0] === 'D');
    if (filter === 'bgp') rt = rt.filter((r) => r.code === 'B');
    const L = [...(vrf ? [`Routing Table: ${vrf}`] : []), ...CODES];
    const def = allRt.find((r) => r.prefix === 0);
    L.push(def ? `Gateway of last resort is ${def.nextHop || '0.0.0.0'} to network 0.0.0.0` : 'Gateway of last resort is not set', '');
    const cp = (ip) => { const a = +ip.split('.')[0]; return a < 128 ? 8 : a < 192 ? 16 : 24; };
    const items = [];
    const groups = new Map();
    // IOS nhóm theo mạng classful: mạng chính nào có subnet dài hơn → tiêu đề "is (variably) subnetted"
    for (const r of rt) {
      const c0 = cp(r.net);
      if (r.prefix >= c0) {
        const k = netOf(r.net, c0) + '/' + c0;
        if (!groups.has(k)) { const g = { key: k, n: N.ip2n(netOf(r.net, c0)), list: [] }; groups.set(k, g); items.push({ g }); }
        groups.get(k).list.push(r);
      } else items.push({ r, n: N.ip2n(r.net) });
    }
    items.sort((a, b) => (a.g ? a.g.n : a.n) - (b.g ? b.g.n : b.n));
    for (const it of items) {
      if (it.r) { L.push(`${pad(it.r.code, 6)}${routeText(it.r)}`); continue; }
      const g = it.g;
      const c0 = +g.key.split('/')[1];
      if (g.list.length === 1 && g.list[0].prefix === c0) { L.push(`${pad(g.list[0].code, 6)}${routeText(g.list[0])}`); continue; }
      const masks = new Set(g.list.map((r) => r.prefix));
      L.push(masks.size > 1 ? `      ${g.key} is variably subnetted, ${g.list.length} subnets, ${masks.size} masks` : `      ${g.key.split('/')[0]}/${[...masks][0]} is subnetted, ${g.list.length} subnets`);
      for (const r of g.list) L.push(`${pad(r.code, 9)}${routeText(r)}`);
    }
    return L;
  }
  function showOspfNei(d) {
    if (!d.ospf) return [];
    const L = ['', 'Neighbor ID     Pri   State           Dead Time   Address         Interface'];
    for (const n of N.ospfNeighbors(ctxOf(), d.id)) L.push(`${pad(n.rid, 16)}${lpad(n.prio ?? 1, 3)}   ${pad(n.state, 16)}00:00:3${n.rid.length % 10}    ${pad(n.addr, 16)}${longIf(n.iface)}`);
    return L;
  }
  function showOspfIntBr(d) {
    if (!d.ospf) return [];
    const ctx = ctxOf();
    const nb = N.ospfNeighbors(ctx, d.id);
    const L = ['Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C'];
    for (const e of N.ospfIfaces(ctx, d.id)) {
      const cnt = nb.filter((n) => n.iface === e.ifn).length;
      let st = 'P2P';
      if (e.ntype !== 'p2p' && e.ntype !== 'p2mp') { const r = N.ospfRoles(ctx, d.id, e.ifn); st = r.dr === d.id ? 'DR' : r.bdr === d.id ? 'BDR' : e.prio === 0 ? 'DROTH' : cnt ? 'DROTH' : 'DR'; }
      L.push(`${pad(shortIf(e.ifn), 13)}${pad(d.ospf.pid, 6)}${pad(e.area, 16)}${pad(`${e.ip}/${e.prefix}`, 19)}${pad(e.cost, 6)}${pad(st, 6)}${cnt}/${cnt}`);
    }
    return L;
  }
  function showOspfIf(d, only) {
    if (!d.ospf) return [];
    const ctx = ctxOf();
    const o = N.ospfAll(ctx);
    const nb = N.ospfNeighbors(ctx, d.id);
    const L = [];
    for (const e of N.ospfIfaces(ctx, d.id)) {
      if (only && e.ifn !== only) continue;
      const p2p = e.ntype === 'p2p' || e.ntype === 'p2mp';
      const cnt = nb.filter((n) => n.iface === e.ifn), full = cnt.filter((n) => n.full);
      L.push(`${longIf(e.ifn)} is up, line protocol is up`, `  Internet Address ${e.ip}/${e.prefix}, Area ${e.area}, Attached via Network Statement`,
        `  Process ID ${d.ospf.pid}, Router ID ${o.rid[d.id]}, Network Type ${{ p2p: 'POINT_TO_POINT', p2mp: 'POINT_TO_MULTIPOINT', nbma: 'NON_BROADCAST', broadcast: 'BROADCAST' }[e.ntype]}, Cost: ${e.cost}`);
      if (e.authT !== 'null') L.push(`  ${e.authT === 'md5' ? 'Cryptographic' : 'Simple password'} authentication enabled`);
      if (p2p) L.push(`  Transmit Delay is 1 sec, State ${e.ntype === 'p2mp' ? 'POINT_TO_MULTIPOINT' : 'POINT_TO_POINT'}`);
      else {
        const r = N.ospfRoles(ctx, d.id, e.ifn);
        const ipOf = (id) => (id === d.id ? e.ip : nb.find((n) => n.dev === id)?.addr);
        L.push(`  Transmit Delay is 1 sec, State ${r.dr === d.id ? 'DR' : r.bdr === d.id ? 'BDR' : 'DROTHER'}, Priority ${e.prio}`);
        if (r.dr) L.push(`  Designated Router (ID) ${o.rid[r.dr]}, Interface address ${ipOf(r.dr)}`);
        if (r.bdr) L.push(`  Backup Designated router (ID) ${o.rid[r.bdr]}, Interface address ${ipOf(r.bdr)}`);
      }
      L.push(`  Timer intervals configured, Hello ${e.hello}, Dead ${e.hello * 4}, Wait ${e.hello * 4}, Retransmit 5`);
      if (e.passive) L.push('  No Hellos (Passive interface)');
      else L.push(`  Neighbor Count is ${cnt.length}, Adjacent neighbor count is ${full.length}`, ...full.map((n) => `    Adjacent with neighbor ${n.rid}${n.role === 'DR' ? '  (Designated Router)' : n.role === 'BDR' ? '  (Backup Designated Router)' : ''}`));
    }
    return L.length ? L : only ? [`%OSPF: OSPF not enabled on ${longIf(only)}`] : [];
  }
  function showOspf(d) {
    if (!d.ospf) return ['%OSPF: No router process is configured'];
    const o = N.ospfAll(ctxOf());
    const areas = [...new Set((o.en[d.id] || []).map((e) => e.area))];
    return [` Routing Process "ospf ${d.ospf.pid}" with ID ${o.rid[d.id]}`, ' Supports only single TOS(TOS0) routes', d.ospf.defaultOriginate ? ' It is an autonomous system boundary router' : ' Router is not originating router-LSAs with maximum metric', ` Number of areas in this router is ${areas.length}. ${areas.length} normal 0 stub 0 nssa`, ...areas.map((a) => `    Area ${a === '0' ? 'BACKBONE(0)' : a}`), ' Reference bandwidth unit is 100 mbps'];
  }
  function showProtocols(d) {
    const L = [];
    const ctx = ctxOf();
    if (d.ospf) {
      const o = N.ospfAll(ctx);
      L.push(`Routing Protocol is "ospf ${d.ospf.pid}"`, '  Outgoing update filter list for all interfaces is not set', '  Incoming update filter list for all interfaces is not set', `  Router ID ${o.rid[d.id]}`, '  Maximum path: 4', '  Routing for Networks:');
      for (const s of d.ospf.networks) L.push(`    ${s.net} ${s.wild} area ${s.area}`);
      const pas = (o.en[d.id] || []).filter((e) => e.passive);
      if (pas.length) { L.push('  Passive Interface(s):'); for (const e of pas) L.push(`    ${longIf(e.ifn)}`); }
      L.push('  Routing Information Sources:', '    Gateway         Distance      Last Update');
      for (const n of N.ospfNeighbors(ctx, d.id)) L.push(`    ${pad(n.rid, 16)}${lpad(110, 8)}      00:01:12`);
      L.push('  Distance: (default is 110)', '');
    }
    if (d.eigrp) {
      L.push(`Routing Protocol is "eigrp ${d.eigrp.as}"`, '  Default networks flagged in outgoing updates', '  EIGRP-IPv4 Protocol for AS(' + d.eigrp.as + ')', '    Metric weight K1=1, K2=0, K3=1, K4=0, K5=0', `  Automatic Summarization: ${d.eigrp.autoSummary ? 'enabled' : 'disabled'}`, '  Routing for Networks:');
      for (const s of d.eigrp.networks) L.push(`    ${s.net}${s.wild ? ' ' + s.wild : ''}`);
      L.push('  Distance: internal 90 external 170', '');
    }
    if (!L.length) L.push('*** IP Routing is NSF aware ***', '', '(Lab: chưa bật giao thức định tuyến động nào)');
    return L;
  }
  function showEigrpNei(d) {
    if (!d.eigrp) return [];
    const L = [`EIGRP-IPv4 Neighbors for AS(${d.eigrp.as})`, 'H   Address                 Interface              Hold Uptime   SRTT   RTO  Q  Seq', '                                                   (sec)         (ms)       Cnt Num'];
    (N.eigrpAll(ctxOf()).adj[d.id] || []).forEach((a, i) => L.push(`${pad(i, 4)}${pad(a.nh, 24)}${pad(shortIf(a.outIf), 23)}${lpad(13, 4)} 00:05:1${i}   40   240  0  ${12 + i}`));
    return L;
  }
  function showAcl(d, name) {
    const L = [];
    const names = Object.keys(d.acls || {}).filter((n) => !name || n === name);
    if (name && !names.length) return [];
    for (const n of names.sort()) {
      const a = d.acls[n];
      L.push(`${a.type === 'standard' ? 'Standard' : 'Extended'} IP access list ${n}`);
      for (const e of a.entries) L.push(`    ${e.seq} ${N.aceText(a.type, e)}${e.matches ? ` (${e.matches} match${e.matches > 1 ? 'es' : ''})` : ''}`);
    }
    return L;
  }
  function showNatTr(d) {
    const L = ['Pro  Inside global         Inside local          Outside local         Outside global'];
    const seen1 = new Set();
    for (const e of d.natTable) {
      if (e.port == null && !e.stat) {
        const k = e.il + '|' + e.ig;
        if (!seen1.has(k)) { seen1.add(k); L.push(`${pad('---', 5)}${pad(e.ig, 22)}${pad(e.il, 22)}${pad('---', 22)}---`); }
        continue;
      }
      const pt = e.port != null ? ':' + (e.gport ?? e.port) : '';
      const lt = e.port != null ? ':' + e.port : '';
      const ot = e.outside + (e.port != null && e.proto === 'icmp' ? ':' + e.port : '');
      L.push(`${pad(e.proto, 5)}${pad(e.ig + pt, 22)}${pad(e.il + lt, 22)}${pad(ot, 22)}${ot}`);
    }
    for (const s of d.nat.statics) {
      if (s.proto) L.push(`${pad(s.proto, 5)}${pad(`${s.global}:${s.gport}`, 22)}${pad(`${s.local}:${s.lport}`, 22)}${pad('---', 22)}---`);
      else L.push(`${pad('---', 5)}${pad(s.global, 22)}${pad(s.local, 22)}${pad('---', 22)}---`);
    }
    return L;
  }
  function showNatStat(d) {
    const ins = Object.keys(d.ifaces).filter((n) => d.ifaces[n].nat === 'inside').map(longIf);
    const outs = Object.keys(d.ifaces).filter((n) => d.ifaces[n].nat === 'outside').map(longIf);
    const L = [`Total active translations: ${d.natTable.length + d.nat.statics.length} (${d.nat.statics.length} static, ${d.natTable.length} dynamic; ${d.natTable.filter((e) => e.port != null).length} extended)`, 'Outside interfaces:', `  ${outs.join(', ') || '(none)'}`, 'Inside interfaces: ', `  ${ins.join(', ') || '(none)'}`, `Hits: ${d.natTable.length * 2}  Misses: 0`, 'Dynamic mappings:', '-- Inside Source'];
    d.nat.dyn.forEach((r, i) => {
      if (r.iface) L.push(`[Id: ${i + 1}] access-list ${r.acl} interface ${longIf(r.iface)} refcount ${d.natTable.length}`);
      else {
        const p = d.nat.pools[r.pool];
        const addrs = N.poolAddrs(p);
        const used = new Set(d.natTable.filter((e) => e.pool === r.pool).map((e) => e.ig)).size;
        L.push(`[Id: ${i + 1}] access-list ${r.acl} pool ${r.pool}${r.overload ? ' overload' : ''} refcount ${d.natTable.filter((e) => e.pool === r.pool).length}`, ` pool ${r.pool}: netmask ${prefixToMask(p?.prefix ?? 24)}`, `\tstart ${p?.start} end ${p?.end}`, `\ttype generic, total addresses ${addrs.length}, allocated ${used} (${addrs.length ? Math.round((used * 100) / addrs.length) : 0}%), misses 0`);
      }
    });
    return L;
  }
  function showDhcpBind(d) {
    const L = ['Bindings from all pools not associated with VRF:', 'IP address          Client-ID/              Lease expiration        Type', '                    Hardware address/', '                    User name'];
    for (const b of d.dhcp?.bindings || []) L.push(`${pad(b.ip, 20)}${pad('01' + N.ciscoMac(b.mac).replace(/\./g, '').replace(/(.{4})/g, '$1.').replace(/\.$/, ''), 24)}${pad('Mar 02 2026 12:00 AM', 24)}Automatic`);
    return L;
  }
  function showDhcpPool(d) {
    const L = [];
    for (const [n, p] of Object.entries(d.dhcp?.pools || {})) {
      const used = d.dhcp.bindings.filter((b) => b.pool === n).length;
      L.push('', `Pool ${n} :`, ' Utilization mark (high/low)    : 100 / 0', ' Subnet size (first/next)       : 0 / 0 ', ` Total addresses                : ${p.net ? 2 ** (32 - p.prefix) - 2 : 0}`, ` Leased addresses               : ${used}`, ' Excluded addresses             : ' + d.dhcp.excluded.length, ` Network                        : ${p.net ? p.net + ' ' + prefixToMask(p.prefix) : '(chưa khai báo network)'}`, ` Default router                 : ${p.router || '(chưa có)'}`, ` DNS server                     : ${p.dns || '(chưa có)'}`);
    }
    return L.length ? L : ['(Lab: chưa có pool DHCP nào)'];
  }
  function fhrpState(d, n, g, proto) {
    const f = IFS(d)[n];
    const cfg = (proto === 'vrrp' ? f.vrrp : f.standby)[g];
    if (!cfg?.ip || !N.ifUp(net, d.id, n)) return { st: 'Init', act: 'unknown', stby: 'unknown' };
    const a = N.hsrpView(net, d.id, n).find((z) => z.group === g && z.proto === proto);
    const ph = N.fhrpPhase(net, d.id, n, proto, g); // ⏱ đang Listen / Speak (chưa được bầu)
    if (ph) return { st: ph, act: a ? IFS(net.devices[a.list[0].ep.dev])[a.list[0].ep.ifn].ip : 'unknown', stby: a?.list[1] ? IFS(net.devices[a.list[1].ep.dev])[a.list[1].ep.ifn].ip : 'unknown', vip: cfg.ip, pri: cfg.priority ?? 100 };
    if (!a) return { st: 'Init', act: 'unknown', stby: 'unknown' };
    const ipOf = (m) => IFS(net.devices[m.ep.dev])[m.ep.ifn].ip;
    const me = a.ep.dev === d.id && a.ep.ifn === n;
    const second = a.list[1];
    const mine = a.list.find((m) => m.ep.dev === d.id && m.ep.ifn === n);
    if (me) return { st: proto === 'vrrp' ? 'Master' : 'Active', act: 'local', stby: second ? ipOf(second) : 'unknown', vip: cfg.ip, pri: mine?.pri };
    const isSecond = second && second.ep.dev === d.id;
    return { st: proto === 'vrrp' ? 'Backup' : isSecond ? 'Standby' : 'Listen', act: ipOf(a.list[0]), stby: isSecond ? 'local' : second ? ipOf(second) : 'unknown', vip: cfg.ip, activeVip: a.vip, pri: mine?.pri };
  }
  function showStandbyBrief(d) {
    const L = ['                     P indicates configured to preempt.', '                     |', 'Interface   Grp  Pri P State   Active          Standby         Virtual IP'];
    for (const n of ifOrder(d)) {
      for (const [g, s] of Object.entries(IFS(d)[n].standby || {})) {
        const h = fhrpState(d, n, g, 'hsrp');
        L.push(`${pad(shortIf(n), 12)}${pad(g, 5)}${pad(h.pri ?? s.priority ?? 100, 4)}${s.preempt ? 'P' : ' '} ${pad(h.st, 8)}${pad(h.act, 16)}${pad(h.stby, 16)}${s.ip || 'unknown'}`);
      }
    }
    return L;
  }
  function showStandby(d) {
    const L = [];
    for (const n of ifOrder(d)) {
      for (const [g, s] of Object.entries(IFS(d)[n].standby || {})) {
        const h = fhrpState(d, n, g, 'hsrp');
        L.push(`${longIf(n)} - Group ${g}`, `  State is ${h.st}`, `  Virtual IP address is ${s.ip || 'unknown'}`, `  Active virtual MAC address is 0000.0c07.ac${(+g).toString(16).padStart(2, '0')}`, '  Hello time 3 sec, hold time 10 sec', `  Preemption ${s.preempt ? 'enabled' : 'disabled'}`, `  Active router is ${h.act}`, `  Standby router is ${h.stby}`, `  Priority ${h.pri ?? s.priority ?? 100} (configured ${s.priority ?? 100})`);
        for (const t of s.track || []) L.push(`    Track interface ${longIf(t.ifn)} state ${N.ifUp(net, d.id, t.ifn) ? 'Up' : 'Down'} decrement ${t.dec}`);
        L.push(`  Group name is "hsrp-${shortIf(n)}-${g}" (default)`);
        if (h.activeVip && s.ip && h.activeVip !== s.ip) L.push(`%HSRP-4-DIFFVIP1: ${longIf(n)} Grp ${g} active routers virtual IP address ${h.activeVip} is different to the locally configured address ${s.ip}`);
      }
    }
    return L;
  }
  function showVrrpBrief(d) {
    const L = ['Interface          Grp Pri Time  Own Pre State   Master addr     Group addr'];
    for (const n of ifOrder(d)) {
      const f = IFS(d)[n];
      for (const [g, s] of Object.entries(f.vrrp || {})) {
        const h = fhrpState(d, n, g, 'vrrp');
        const own = s.ip === f.ip;
        L.push(`${pad(shortIf(n), 19)}${pad(g, 4)}${pad(own ? 255 : s.priority ?? 100, 4)}${pad(3609, 6)}${pad(own ? 'Y' : '', 4)}${pad(s.preempt === false ? '' : 'Y', 4)}${pad(h.st, 8)}${pad(h.act === 'local' ? f.ip : h.act, 16)}${s.ip || 'unknown'}`);
      }
    }
    return L;
  }
  function showVrrp(d) {
    const L = [];
    for (const n of ifOrder(d)) {
      const f = IFS(d)[n];
      for (const [g, s] of Object.entries(f.vrrp || {})) {
        const h = fhrpState(d, n, g, 'vrrp');
        L.push(`${longIf(n)} - Group ${g}`, `  State is ${h.st}`, `  Virtual IP address is ${s.ip || 'unknown'}`, `  Virtual MAC address is 0000.5e00.01${(+g).toString(16).padStart(2, '0')}`, '  Advertisement interval is 1.000 sec', `  Preemption ${s.preempt === false ? 'disabled' : 'enabled'}`, `  Priority is ${s.ip === f.ip ? 255 : s.priority ?? 100}${s.ip === f.ip ? ' (IP address owner)' : ''}`, `  Master Router is ${h.act === 'local' ? f.ip + ' (local)' : h.act}`);
      }
    }
    return L;
  }
  /** Thời gian chạy tính từ lúc CLI gặp thiết bị lần đầu (hoặc reload gần nhất), cộng đồng hồ thật. */
  const bootAt = new WeakMap();
  function uptime(d) {
    if (!bootAt.has(d) || bootAt.get(d).image !== d.image) bootAt.set(d, { t: N.clock.now(), image: d.image });
    const min = Math.floor((N.clock.now() - bootAt.get(d).t) / 60000);
    return min >= 60 ? `${Math.floor(min / 60)} hour, ${min % 60} minutes` : `${min} minutes`;
  }
  function showIfRouter(d, n) {
    const f = d.ifaces[n];
    if (!f) return ['% Invalid input detected.'];
    const [st, pr] = ifStatus(d, n);
    const L = [`${longIf(n)} is ${st}, line protocol is ${pr}`, `  Hardware is ${n.startsWith('s') ? 'WIC MBRD Serial' : 'CN Gigabit Ethernet'}, address is ${N.ciscoMac(N.epMac(net, { dev: d.id, ifn: n }))} (bia ${N.ciscoMac(N.epMac(net, { dev: d.id, ifn: n }))})`];
    if (f.desc) L.push(`  Description: ${f.desc}`);
    if (f.ip) L.push(`  Internet address is ${f.ip}/${f.prefix}`);
    const eth = n.startsWith('g') ? N.ethMode(net, d.id, n) : null;
    L.push(`  MTU 1500 bytes, BW ${f.bw ?? (eth ? eth.speed * 1000 : n.startsWith('s') ? 1544 : 1000000)} Kbit/sec, DLY ${n.startsWith('s') ? 20000 : 10} usec,`, '     reliability 255/255, txload 1/255, rxload 1/255');
    if (eth) L.push(...ethLines(eth));
    if (n.startsWith('tu')) {
      L.push('  Encapsulation TUNNEL, loopback not set', `  Tunnel source ${f.tunSrc ? (isIp(f.tunSrc) ? f.tunSrc : `${N.tunnelSrcIp(d, f) || 'unknown'} (${longIf(f.tunSrc)})`) : '(chưa đặt)'}, destination ${f.tunDst || '(chưa đặt)'}`, '  Tunnel protocol/transport GRE/IP', '    Key disabled, sequencing disabled', '  Tunnel TTL 255, Fast tunneling enabled');
      if (pr === 'down') L.push('  (Lab: tunnel down khi thiếu source/destination, cổng source down, hoặc KHÔNG có route tới destination qua underlay)');
      return L;
    }
    if (f.encap != null) L.push(`  Encapsulation 802.1Q Virtual LAN, Vlan ID  ${f.encap}.`);
    else if (n.startsWith('s')) { L.push(`  Encapsulation ${(f.l2enc || 'hdlc').toUpperCase()}, loopback not set${f.l2enc === 'ppp' ? `, LCP ${pr === 'up' ? 'Open' : 'Closed'}` : ', keepalive set (10 sec)'}`); if (st === 'up' && pr === 'down') L.push('  (Lab: tầng 1 up nhưng line protocol down → 2 đầu serial lệch encapsulation, hoặc PPP xác thực CHAP/PAP thất bại)'); }
    else L.push('  Encapsulation ARPA, loopback not set');
    return L;
  }

  // ---- BGP ----
  function showBgpSum(d) {
    if (!d.bgp) return ['% BGP not active'];
    const b = N.bgpAll(ctxOf());
    const L = [`BGP router identifier ${b.rid[d.id]}, local AS number ${d.bgp.as}`, 'BGP table version is 7, main routing table version 7', '', 'Neighbor        V           AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd'];
    for (const s of b.sessions[d.id] || []) {
      const rcv = Object.values(b.best[d.id] || {}).filter((p) => p.fromIp && s.peer && p.from === s.peer).length;
      L.push(`${pad(s.ip, 16)}4 ${lpad(s.remoteAs, 12)}${lpad(s.state === 'Established' ? 15 : 0, 8)}${lpad(s.state === 'Established' ? 14 : 0, 8)}${lpad(7, 9)}${lpad(0, 5)}${lpad(0, 5)} ${pad(s.state === 'Established' ? '00:05:12' : 'never', 9)}${s.state === 'Established' ? rcv : s.state}`);
    }
    return L;
  }
  function showBgp(d) {
    if (!d.bgp) return ['% BGP not active'];
    const b = N.bgpAll(ctxOf());
    const L = [`BGP table version is 7, local router ID is ${b.rid[d.id]}`, 'Status codes: s suppressed, d damped, h history, * valid, > best, i - internal,', 'Origin codes: i - IGP, e - EGP, ? - incomplete', '', '   Network          Next Hop            Metric LocPrf Weight Path'];
    const tbl = b.tables[d.id] || {};
    const best = b.best[d.id] || {};
    for (const k of Object.keys({ ...tbl, ...best }).sort((x, y) => N.ip2n(x.split('/')[0]) - N.ip2n(y.split('/')[0]))) {
      const list = tbl[k] || [best[k]];
      for (const p of list) {
        const isBest = best[k] === p || (best[k] && p.nh === best[k].nh && JSON.stringify(p.asPath) === JSON.stringify(best[k].asPath));
        L.push(`${isBest ? '*>' : '* '}${p.ibgp ? 'i' : ' '}${pad(p.prefix === 0 ? '0.0.0.0' : k, 17)}${pad(p.nh, 20)}${lpad(p.med || 0, 6)} ${lpad(p.ibgp || (p.lp ?? 100) !== 100 ? p.lp ?? 100 : '', 6)} ${lpad(p.weight || 0, 6)} ${[...p.asPath, p.origin || 'i'].join(' ')}`);
      }
    }
    return L;
  }
  function showMst(d) {
    if (d.stp.mode !== 'mst') return ['% Lab: switch chưa chạy "spanning-tree mode mst"'];
    const m = d.stp.mst || { inst: {} };
    const L = [];
    for (const i of ['0', ...Object.keys(m.inst)]) {
      const vl = i === '0' ? Object.keys(d.vlans).map(Number).filter((v) => !Object.values(m.inst).some((l) => l.includes(v))) : m.inst[i];
      const v0 = vl[0] ?? 1;
      const root = N.stpRoot(net, v0);
      const pr = N.stpPriority(d, v0);
      L.push(`##### MST${i}    vlans mapped:   ${fmtVlist(vl)}`, `Bridge        address ${N.ciscoMac(N.switchMac(net, d.id))}  priority      ${pr} (${pr - +i} sysid ${i})`, root?.id === d.id ? `Root          this switch for MST${i}` : `Root          address ${root ? N.ciscoMac(N.switchMac(net, root.id)) : '?'}  priority      ${root ? N.stpPriority(root, v0) : '?'}`, '');
    }
    return L;
  }

  // ---- crypto ----
  function cryptoEntries(d) {
    const out = [];
    for (const [ifn, f] of Object.entries(d.ifaces)) {
      if (!f.cryptoMap || !d.crypto.maps[f.cryptoMap]) continue;
      for (const [seq, e] of Object.entries(d.crypto.maps[f.cryptoMap])) out.push({ ifn, f, map: f.cryptoMap, seq, e });
    }
    return out;
  }
  function samplePkt(d, e) {
    const a = d.acls[e.acl]?.entries.find((z) => z.action === 'permit' && z.remark == null);
    if (!a) return null;
    const host = (s) => (!s || s.any ? '1.1.1.1' : s.wild === '0.0.0.0' ? s.ip : N.n2ip(N.ip2n(s.ip) + 1));
    return { src: host(a.src), dst: host(a.dst), proto: 'icmp' };
  }
  function tunnel(d, x) {
    const pkt = samplePkt(d, x.e);
    if (!pkt) return { up: false, why: 'crypto map chưa có ACL hợp lệ' };
    return N.vpnState(net, d, x.ifn, { map: x.map, seq: x.seq, e: x.e }, pkt);
  }
  function showIsakmpSa(d) {
    const L = ['IPv4 Crypto ISAKMP SA', 'dst             src             state          conn-id status'];
    for (const x of cryptoEntries(d)) {
      if (!x.e.tried || !x.e.peer) continue;
      const t = tunnel(d, x);
      L.push(`${pad(x.e.peer, 16)}${pad(x.f.ip, 16)}${pad(t.up || t.phase === 2 ? 'QM_IDLE' : 'MM_NO_STATE', 15)}${pad(1001, 8)}${t.up || t.phase === 2 ? 'ACTIVE' : 'ACTIVE (deleted)'}`);
    }
    L.push('', 'IPv6 Crypto ISAKMP SA');
    return L;
  }
  function showIsakmpPolicy(d) {
    const L = ['', 'Global IKE policy'];
    for (const [n, p] of Object.entries(d.crypto.isakmp)) L.push(`Protection suite of priority ${n}`, `\tencryption algorithm:\t${p.encr === 'aes' ? 'AES - Advanced Encryption Standard (128 bit keys).' : p.encr}`, `\thash algorithm:\t\t${p.hash === 'sha' ? 'Secure Hash Standard' : p.hash}`, `\tauthentication method:\t${p.auth === 'pre-share' ? 'Pre-Shared Key' : 'Rivest-Shamir-Adleman Signature'}`, `\tDiffie-Hellman group:\t#${p.group}`, `\tlifetime:\t\t${p.lifetime} seconds, no volume limit`);
    return L;
  }
  function showIpsecSa(d) {
    const L = [];
    for (const x of cryptoEntries(d)) {
      const a = d.acls[x.e.acl]?.entries.find((z) => z.action === 'permit' && z.remark == null);
      const id = (s) => (!s || s.any ? '0.0.0.0/0.0.0.0' : `${s.ip}/${N.n2ip(~N.ip2n(s.wild) >>> 0)}`);
      const t = x.e.tried ? tunnel(d, x) : { up: false };
      L.push('', `interface: ${longIf(x.ifn)}`, `    Crypto map tag: ${x.map}, local addr ${x.f.ip}`, '', '   protected vrf: (none)', `   local  ident (addr/mask/prot/port): (${id(a?.src)}/0/0)`, `   remote ident (addr/mask/prot/port): (${id(a?.dst)}/0/0)`, `   current_peer ${x.e.peer || '0.0.0.0'} port 500`, `     #pkts encaps: ${x.e.encaps || 0}, #pkts encrypt: ${x.e.encaps || 0}, #pkts digest: ${x.e.encaps || 0}`, `     #pkts decaps: ${x.e.decaps || 0}, #pkts decrypt: ${x.e.decaps || 0}, #pkts verify: ${x.e.decaps || 0}`, '', `     inbound esp sas:${t.up ? '\n      spi: 0x1A2B3C4D(439041101)\n        transform: ' + (d.crypto.tsets[x.e.tset] || []).join(' ') + ' ,\n        status: ACTIVE' : ''}`, `     outbound esp sas:${t.up ? '\n      spi: 0x5E6F7A8B(1584364171)\n        status: ACTIVE' : ''}`);
    }
    return L.join('\n').split('\n');
  }
  function showCryptoMap(d) {
    const L = [];
    for (const [m, seqs] of Object.entries(d.crypto.maps)) {
      for (const [seq, e] of Object.entries(seqs)) L.push(`Crypto Map IPv4 "${m}" ${seq} ipsec-isakmp`, `\tPeer = ${e.peer || '(chưa set)'}`, `\tExtended IP access list ${e.acl || '(chưa match address)'}`, `\tTransform sets={ ${e.tset ? `${e.tset}:  { ${(d.crypto.tsets[e.tset] || []).join(' ')} }` : ''} }`);
      L.push(`\tInterfaces using crypto map ${m}:`, ...Object.entries(d.ifaces).filter(([, f]) => f.cryptoMap === m).map(([n]) => `\t\t${longIf(n)}`));
    }
    return L;
  }

  // ---- switch shows ----
  function accessPortsOfVlan(d, v) {
    return Object.keys(d.ports).filter((n) => !n.startsWith('po')).sort(ifSort).filter((n) => { const e = N.effPort(net, d, n); return e.mode === 'access' && (e.vlan === v || d.ports[n].vlan === v || d.ports[n].voiceVlan === v) && !e.bundle; });
  }
  function showVlanBrief(d) {
    const L = ['', 'VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------'];
    for (const v of Object.keys(d.vlans).map(Number).sort((a, b) => a - b)) {
      const ps = accessPortsOfVlan(d, v).map(shortIf);
      const chunks = [];
      for (let i = 0; i < ps.length; i += 4) chunks.push(ps.slice(i, i + 4).join(', '));
      L.push(`${pad(v, 5)}${pad(d.vlans[v], 33)}${pad('active', 10)}${chunks[0] || ''}`);
      for (const ch of chunks.slice(1)) L.push(`${' '.repeat(48)}${ch}`);
    }
    L.push('1002 fddi-default                     act/unsup ', '1003 token-ring-default               act/unsup ', '1004 fddinet-default                  act/unsup ', '1005 trnet-default                    act/unsup ');
    return L;
  }
  function showPvlan(d) {
    const L = ['Primary Secondary Type              Ports', '------- --------- ----------------- ------------------------------------------'];
    for (const [p, x] of Object.entries(d.pvlan)) {
      if (x.type !== 'primary') continue;
      for (const s of x.assoc || []) {
        const ps = Object.keys(d.ports).sort(ifSort).filter((n) => { const pv = d.ports[n].pv; return d.ports[n].mode === 'private-vlan' && pv && pv.primary === +p && (pv.secondary === s || (pv.mapping || []).includes(s)); }).map(shortIf);
        L.push(`${pad(p, 8)}${pad(s, 10)}${pad(d.pvlan[s]?.type || 'non-operational', 18)}${ps.join(', ')}`);
      }
    }
    return L;
  }
  function showVaclMap(d) {
    const L = [];
    for (const [m, es] of Object.entries(d.vacl.maps)) for (const e of [...es].sort((a, b) => a.seq - b.seq)) L.push(`Vlan access-map "${m}"  ${e.seq}`, '  Match clauses:', `    ip  address: ${e.acl || '(không có — khớp mọi gói)'}`, '  Action:', `    ${e.action}`);
    return L.length ? L : ['(Lab: chưa có vlan access-map nào)'];
  }
  function showVaclFilter(d) {
    return Object.entries(d.vacl.filters).map(([m, vl]) => `VLAN Map ${m} is filtering VLANs:\n  ${fmtVlist(vl)}`).join('\n').split('\n').filter(Boolean);
  }
  function trunkPorts(d) {
    const out = [], seenPo = new Set();
    for (const n of Object.keys(d.ports).filter((p) => !p.startsWith('po')).sort(ifSort)) {
      const e = N.effPort(net, d, n);
      if (e.mode !== 'trunk' || !N.lineUp(net, d.id, n) || e.shutdown) continue;
      const name = e.bundle || n;
      if (seenPo.has(name)) continue;
      seenPo.add(name);
      out.push({ name, e, cfg: d.ports[name] || d.ports[n] });
    }
    return out;
  }
  function showTrunk(d) {
    const tp = trunkPorts(d);
    if (!tp.length) return [];
    const L = ['', 'Port        Mode             Encapsulation  Status        Native vlan'];
    for (const t of tp) L.push(`${pad(shortIf(t.name), 12)}${pad(t.cfg.modeSet ? (t.cfg.nonegotiate ? 'on' : 'on') : t.cfg.dyn || 'auto', 17)}${pad('802.1q', 15)}${pad('trunking', 14)}${t.e.native}`);
    L.push('', 'Port        Vlans allowed on trunk');
    for (const t of tp) L.push(`${pad(shortIf(t.name), 12)}${fmtVlist(t.e.allowed)}`);
    L.push('', 'Port        Vlans allowed and active in management domain');
    const act = (t) => fmtVlist(Object.keys(d.vlans).map(Number).filter((v) => N.allowedHas(t.e, v)));
    for (const t of tp) L.push(`${pad(shortIf(t.name), 12)}${act(t)}`);
    L.push('', 'Port        Vlans in spanning tree forwarding state and not pruned');
    for (const t of tp) L.push(`${pad(shortIf(t.name), 12)}${act(t)}`);
    return L;
  }
  function showIfStatus(d, onlyErr) {
    const L = ['', 'Port      Name               Status       Vlan       Duplex  Speed Type'];
    for (const n of Object.keys(d.ports).sort(ifSort)) {
      const p = d.ports[n];
      const e = N.effPort(net, d, n);
      const err = N.errDisabled(net, d, n);
      if (onlyErr && !err) continue;
      const st = p.shutdown ? 'disabled' : err ? 'err-disabled' : n.startsWith('po') ? (swPortStatus(d, n)[0] === 'up' ? 'connected' : 'notconnect') : N.lineUp(net, d.id, n) ? 'connected' : 'notconnect';
      const vl = e.mode === 'trunk' ? 'trunk' : e.mode === 'private-vlan' ? `${e.pv?.primary ?? '?'},${e.pv?.secondary ?? (e.pv?.mapping || []).join('')}` : d.vlans[e.vlan] ? e.vlan : `${e.vlan}*`;
      const m = N.ethMode(net, d.id, n), up = st === 'connected' && !n.startsWith('po');
      const dx = up ? `${m.autoDuplex ? 'a-' : ''}${m.duplex}` : p.duplex || 'auto', sp = up ? `${m.autoSpeed ? 'a-' : ''}${m.speed}` : p.speed || 'auto';
      L.push(`${pad(shortIf(n), 10)}${pad(p.desc.slice(0, 18), 19)}${pad(st, 13)}${pad(vl, 11)}${pad(dx, 8)}${pad(sp, 6)}${n.startsWith('g') ? '10/100/1000BaseTX' : n.startsWith('po') ? '' : '10/100BaseTX'}`);
    }
    if (!onlyErr && Object.values(d.ports).some((p) => !d.vlans[p.vlan] && p.mode === 'access')) L.push('', '(Lab: dấu * = VLAN được gán cho cổng nhưng CHƯA tồn tại trong VLAN database → cổng không chuyển frame)');
    return L;
  }
  function showSwitchport(d, n) {
    const p = d.ports[n];
    if (!p) return ['% Invalid input detected.'];
    const e = N.effPort(net, d, n);
    const oper = !N.lineUp(net, d.id, n) ? 'down' : e.mode === 'trunk' ? 'trunk' : e.mode === 'private-vlan' ? `private-vlan ${e.pv?.mode}` : 'static access';
    const admin = p.mode === 'private-vlan' ? `private-vlan ${p.pv?.mode}` : p.modeSet ? (p.mode === 'trunk' ? 'trunk' : 'static access') : `dynamic ${p.dyn || 'auto'}`;
    return [`Name: ${shortIf(n)}`, 'Switchport: Enabled', `Administrative Mode: ${admin}`, `Operational Mode: ${oper}`, 'Administrative Trunking Encapsulation: dot1q', `Operational Trunking Encapsulation: ${oper === 'trunk' ? 'dot1q' : 'native'}`, `Negotiation of Trunking: ${p.nonegotiate ? 'Off' : 'On'}`, `Access Mode VLAN: ${p.vlan} (${d.vlans[p.vlan] || 'Inactive'})`, `Trunking Native Mode VLAN: ${p.native} (${d.vlans[p.native] || 'Inactive'})`, `Protected: ${p.protected ? 'true' : 'false'}`, `Voice VLAN: ${p.voiceVlan ? `${p.voiceVlan} (${d.vlans[p.voiceVlan] || 'Inactive'})` : 'none'}`, `Trunking VLANs Enabled: ${p.allowed == null ? 'ALL' : fmtVlist(p.allowed)}`, ...(p.pv ? [`Administrative private-vlan host-association: ${p.pv.primary ?? 'none'} (${p.pv.secondary ?? 'none'})`, `Administrative private-vlan mapping: ${p.pv.primary ?? 'none'} (${(p.pv.mapping || []).join(',') || 'none'})`] : []), ...(e.bundle ? [`(Lab: cổng thuộc ${longIf(e.bundle)} — cấu hình trunk/VLAN lấy theo Port-channel)`] : [])];
  }
  function showDtp(d, n) {
    const p = d.ports[n];
    if (!p) return ['% Invalid input detected.'];
    const e = N.effPort(net, d, n);
    const tos = p.modeSet ? (p.mode === 'trunk' ? (p.nonegotiate ? 'TRUNK/ON (không gửi DTP)' : 'TRUNK/ON') : 'ACCESS/OFF') : p.dyn === 'desirable' ? 'DESIRABLE' : 'AUTO';
    return ['DTP information for ' + longIf(n) + ':', `  TOS/TAS/TNS:                              ${tos}/${e.mode === 'trunk' ? 'TRUNK' : 'ACCESS'}`, `  TOT/TAT/TNT:                              802.1Q/802.1Q/${e.mode === 'trunk' ? '802.1Q' : 'NATIVE'}`, `  Neighbor address 1:                       ${N.lineUp(net, d.id, n) ? '00D0BA00' : '000000000000'}`, '  Hello timer expiration (sec/state):       12/RUNNING', '  (Lab: AUTO + AUTO = không lên trunk; DESIRABLE + AUTO/DESIRABLE hoặc TRUNK + AUTO = lên trunk)'];
  }
  /** Dòng duplex/tốc độ và bộ đếm lỗi của show interfaces. Lệch duplex: đầu full đếm CRC, đầu half đếm late collision. */
  function ethLines(m) {
    const bad = m.mismatch && m.duplex === 'full', late = m.mismatch && m.duplex === 'half';
    return [`  ${m.duplex === 'full' ? 'Full' : 'Half'}-duplex, ${m.speed}Mb/s, media type is ${m.speed >= 1000 ? '10/100/1000BaseTX' : '10/100BaseTX'}`,
      `     ${bad ? 1842 : 0} input errors, ${bad ? 1842 : 0} CRC, 0 frame, 0 overrun, 0 ignored`, `     ${bad ? 913 : 0} runts, 0 giants, 0 throttles`,
      `     ${late ? 517 : 0} output errors, ${late ? 2204 : 0} collisions, 1 interface resets`, `     0 babbles, ${late ? 517 : 0} late collision, 0 deferred`,
      ...(m.mismatch ? ['  (Lab: số liệu mẫu, thể hiện lỗi do lệch duplex; ping vẫn qua nhưng thực tế rất chậm)'] : [])];
  }
  /** shortcut: công suất là số mẫu theo loại máy, không đo; cần giới hạn ngân sách PoE thì lưu công suất từng cổng. */
  function showPower(d) {
    const rows = Object.keys(d.ports).filter((n) => !n.startsWith('po')).sort(ifSort).map((n) => {
      const on = d.ports[n].power !== 'never' && N.statusUp(net, d.id, n) && net.devices[N.peerOf(N.linkAt(net, d.id, n), d.id, n).dev].phone;
      return { n, admin: d.ports[n].power || 'auto', on };
    });
    const used = rows.filter((r) => r.on).length * 6.3;
    return [`Available:370.0(w)  Used:${used.toFixed(1)}(w)  Remaining:${(370 - used).toFixed(1)}(w)`, '', 'Interface Admin  Oper       Power   Device              Class Max', '--------- ------ ---------- ------- ------------------- ----- ----',
      ...rows.map((r) => `${pad(shortIf(r.n), 10)}${pad(r.admin, 7)}${pad(r.on ? 'on' : 'off', 11)}${pad(r.on ? '6.3' : '0.0', 8)}${pad(r.on ? 'IP Phone' : 'n/a', 20)}${pad(r.on ? '2' : 'n/a', 6)}30.0`)];
  }
  function showStorm(d) {
    const rows = Object.entries(d.ports).filter(([, p]) => p.storm?.level != null).map(([n, p]) => {
      const now = N.stormNow(net, d, n), over = now > p.storm.level;
      return `${pad(shortIf(n), 10)}${pad(p.storm.action === 'shutdown' && over ? 'Shutdown' : over ? 'Blocking' : 'Forwarding', 12)}${pad(p.storm.level.toFixed(2) + '%', 8)}${pad(p.storm.level.toFixed(2) + '%', 8)}${now.toFixed(2)}%`;
    });
    return ['Interface  Filter State   Upper    Lower    Current', '---------  -------------  -------  -------  -------', ...rows];
  }
  function showStpInc(d) {
    const rows = [];
    for (const v of Object.keys(d.vlans).map(Number)) for (const [k, P] of Object.entries(N.stpState(net, v).ports)) if (P.inc && k.startsWith(d.id + '|')) rows.push(`VLAN${String(v).padStart(4, '0')}          ${pad(longIf(P.name), 25)}${P.inc} Inconsistent`);
    return ['Name                 Interface                Inconsistency', '-------------------- ------------------------ ------------------', ...rows, '', `Number of inconsistent ports (segments) in the system : ${rows.length}`];
  }
  function showSfp(d) {
    const rows = Object.entries(d.ports).filter(([, p]) => p.sfp).map(([n, p]) => {
      const l = N.linkAt(net, d.id, n), q = l && net.devices[N.peerOf(l, d.id, n).dev].ports?.[N.peerOf(l, d.id, n).port];
      const rx = !q ? '-40.0' : q.sfp !== p.sfp ? '-40.0' : N.sfpOk(p, q) ? '-4.2' : '-24.8';
      return `${pad(shortIf(n), 10)}${pad(p.sfp === 'SX' ? '1000BASE-SX' : '1000BASE-LX', 13)}${pad(p.fiber ?? '-', 7)}${pad(`${p.fiberM ?? 0} m`, 9)}${pad('-3.1', 8)}${rx}`;
    });
    return ['Port      Module       Fiber  Distance Tx(dBm) Rx(dBm)', '--------- ------------ ------ -------- ------- -------', ...rows, '(Lab: Rx dưới -18 dBm là tín hiệu quá yếu; số đo mẫu)'];
  }
  function showIfSwitch(d, n) {
    if (n.startsWith('vlan')) {
      const v = d.svis[n];
      if (!v) return ['% Invalid input detected.'];
      const up = N.ifUp(net, d.id, n);
      return [`${longIf(n)} is ${v.shutdown ? 'administratively down' : up ? 'up' : 'down'}, line protocol is ${up ? 'up' : 'down'}`, `  Hardware is CPU Interface, address is ${N.ciscoMac(N.epMac(net, { dev: d.id, ifn: n }))}`, ...(v.ip ? [`  Internet address is ${v.ip}/${v.prefix}`] : [])];
    }
    const p = d.ports[n];
    if (!p) return ['% Invalid input detected.'];
    const [st, pr] = swPortStatus(d, n);
    const err = N.errDisabled(net, d, n);
    return [`${longIf(n)} is ${err ? 'down' : st}, line protocol is ${pr} (${err ? 'err-disabled' : st === 'up' ? 'connected' : p.shutdown ? 'disabled' : 'notconnect'})`, `  Hardware is ${n.startsWith('g') ? 'Gigabit Ethernet' : 'Fast Ethernet'}, address is ${N.ciscoMac(N.switchMac(net, d.id))}`, ...(p.desc ? [`  Description: ${p.desc}`] : []), `  MTU 1500 bytes, BW ${(n.startsWith('po') ? 100 : N.ethMode(net, d.id, n).speed) * 1000} Kbit/sec, DLY 100 usec,`, '  Encapsulation ARPA, loopback not set', ...(n.startsWith('po') ? [] : ethLines(N.ethMode(net, d.id, n)))];
  }
  function showEtherSummary(d) {
    const groups = {};
    for (const n of Object.keys(d.ports).filter((p) => !p.startsWith('po')).sort(ifSort)) { const p = d.ports[n]; if (p.group != null) (groups[p.group] ||= []).push(n); }
    const L = ['Flags:  D - down        P - bundled in port-channel', '        I - stand-alone s - suspended', '        H - Hot-standby (LACP only)', '        R - Layer3      S - Layer2', '        U - in use      f - failed to allocate aggregator', '', '        M - not in use, minimum links not met', '        u - unsuitable for bundling', '        w - waiting to be aggregated', '        d - default port', '', '', `Number of channel-groups in use: ${Object.keys(groups).length}`, `Number of aggregators:           ${Object.keys(groups).length}`, '', 'Group  Port-channel  Protocol    Ports', '------+-------------+-----------+----------------------------------------------'];
    for (const [g, mem] of Object.entries(groups)) {
      const info = mem.map((n) => ({ n, b: N.bundleOf(net, d, n), up: N.lineUp(net, d.id, n) }));
      const any = info.some((i) => i.b.formed);
      const proto = info[0].b.proto;
      L.push(`${pad(g, 7)}${pad(`Po${g}(${any ? 'SU' : 'SD'})`, 14)}${pad(proto, 12)}${info.map((i) => `${shortIf(i.n)}(${i.b.formed ? 'P' : i.up ? 'I' : 'D'})`).join('  ')}`);
    }
    return L;
  }
  function stpView(d, v) {
    // dùng đúng kết quả STP mà engine dùng để chặn cổng khi chuyển frame (N.stpState)
    const st = N.stpState(net, v);
    const root = net.devices[st.root[d.id]] || d;
    const rows = [];
    for (const [k, P] of Object.entries(st.ports)) {
      if (!k.startsWith(d.id + '|')) continue;
      const first = P.members[0];
      const edge = !P.peer && (d.ports[first].portfast || d.stp.portfastDefault);
      rows.push({ name: P.name, role: P.role, sts: P.sts, cost: P.cost, prio: `128.${Object.keys(d.ports).indexOf(first) + 1}`, edge });
    }
    rows.sort((x, y) => ifSort(x.name, y.name));
    return { root, rows, dist: st.dist[d.id] ?? 0 };
  }
  function showStp(d, v) {
    if (!d.vlans[v]) return [`Spanning tree instance(s) for vlan ${v} does not exist.`];
    const { root, rows, dist } = stpView(d, v);
    const me = root.id === d.id;
    const L = [`VLAN${String(v).padStart(4, '0')}`, `  Spanning tree enabled protocol ${d.stp.mode === 'rapid-pvst' ? 'rstp' : 'ieee'}`, `  Root ID    Priority    ${N.stpPriority(root, v)}`, `             Address     ${N.ciscoMac(N.switchMac(net, root.id))}`];
    L.push(me ? '             This bridge is the root' : `             Cost        ${dist}`);
    if (!me) L.push(`             Port        ${rows.findIndex((r) => r.role === 'Root') + 1}(${longIf(rows.find((r) => r.role === 'Root')?.name || '')})`);
    L.push('             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec', '', `  Bridge ID  Priority    ${N.stpPriority(d, v)}  (priority ${d.stp.prio[v] ?? 32768} sys-id-ext ${v})`, `             Address     ${N.ciscoMac(N.switchMac(net, d.id))}`, '             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec', '             Aging Time  20', '', 'Interface        Role Sts Cost      Prio.Nbr Type', '---------------- ---- --- --------- -------- --------------------------------');
    for (const r of rows) L.push(`${pad(shortIf(r.name), 17)}${pad(r.role, 5)}${pad(r.sts, 4)}${pad(r.cost, 10)}${pad(r.prio, 9)}P2p${r.edge ? ' Edge' : ''}`);
    return L;
  }
  function showStpAll(d) {
    const L = [];
    for (const v of Object.keys(d.vlans).map(Number).sort((a, b) => a - b)) {
      if (!Object.keys(d.ports).some((n) => !n.startsWith('po') && N.lineUp(net, d.id, n) && N.portCarries(net, d, n, v))) continue;
      L.push(...showStp(d, v), '');
    }
    return L.length ? L : ['No spanning tree instance exists.'];
  }
  function showStpSummary(d) {
    const roots = Object.keys(d.vlans).map(Number).filter((v) => N.stpState(net, v).root[d.id] === d.id);
    return [`Switch is in ${d.stp.mode} mode`, `Root bridge for: ${roots.length ? roots.map((v) => 'VLAN' + String(v).padStart(4, '0')).join(', ') : 'none'}`, `Portfast Default             is ${d.stp.portfastDefault ? 'enabled' : 'disabled'}`, `PortFast BPDU Guard Default  is ${d.stp.bpduDefault ? 'enabled' : 'disabled'}`];
  }
  function showMac(d) {
    const L = ['          Mac Address Table', '-------------------------------------------', '', 'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----'];
    for (const e of d.macTable) L.push(`${lpad(e.vlan, 4)}    ${pad(N.ciscoMac(e.mac), 18)}${pad('DYNAMIC', 12)}${shortIf(e.port)}`);
    L.push(`Total Mac Addresses for this criterion: ${d.macTable.length}`);
    return L;
  }
  function showJunosMac(d) {
    const jn = (p) => { const m = p.match(/(\d+)$/); return `ge-0/0/${m ? m[1] : 0}.0`; };
    return ['(Lab: cú pháp Juniper JunOS — tương đương "show mac address-table" của Cisco)', '', `Ethernet-switching table: ${d.macTable.length} entries, ${d.macTable.length} learned`, '  VLAN              MAC address       Type         Age Interfaces', ...d.macTable.map((e) => `  ${pad(e.vlan === 1 ? 'default' : d.vlans[e.vlan] || 'v' + e.vlan, 18)}${pad(e.mac, 18)}${pad('Learn', 13)}${pad(0, 4)}${jn(e.port)}`)];
  }
  function showPsAll(d) {
    const L = ['Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action', '                (Count)       (Count)          (Count)', '---------------------------------------------------------------------------'];
    for (const n of Object.keys(d.ports).sort(ifSort)) {
      const ps = d.ports[n].ps;
      if (!ps || !ps.enabled) continue;
      L.push(`${lpad(shortIf(n), 11)}${lpad(ps.max, 15)}${lpad(ps.macs.length, 13)}${lpad(ps.viol || 0, 19)}${lpad(ps.violation[0].toUpperCase() + ps.violation.slice(1), 17)}`);
    }
    L.push('---------------------------------------------------------------------------');
    return L;
  }
  function showPsIf(d, n) {
    const p = d.ports[n];
    if (!p) return ['% Invalid input detected.'];
    const ps = p.ps;
    const en = !!(ps && ps.enabled);
    return [`Port Security              : ${en ? 'Enabled' : 'Disabled'}`, `Port Status                : ${!en ? 'Secure-down' : p.errdis ? 'Secure-shutdown' : N.lineUp(net, d.id, n) ? 'Secure-up' : 'Secure-down'}`, `Violation Mode             : ${ps ? ps.violation[0].toUpperCase() + ps.violation.slice(1) : 'Shutdown'}`, 'Aging Time                 : 0 mins', 'Aging Type                 : Absolute', 'SecureStatic Address Aging : Disabled', `Maximum MAC Addresses      : ${ps ? ps.max : 1}`, `Total MAC Addresses        : ${ps ? ps.macs.length : 0}`, 'Configured MAC Addresses   : 0', `Sticky MAC Addresses       : ${ps && ps.sticky ? ps.macs.length : 0}`, `Last Source Address:Vlan   : ${ps && ps.macs.length ? N.ciscoMac(ps.macs[ps.macs.length - 1]) + ':' + p.vlan : '0000.0000.0000:0'}`, `Security Violation Count   : ${ps ? ps.viol || 0 : 0}`];
  }
  function showVtp(d) {
    return ['VTP Version capable             : 1 to 3', 'VTP version running             : 1', `VTP Domain Name                 : ${d.vtpDomain}`, 'VTP Pruning Mode                : Disabled', 'VTP Traps Generation            : Disabled', `Device ID                       : ${N.ciscoMac(N.switchMac(net, d.id))}`, '', 'Feature VLAN:', '--------------', `VTP Operating Mode                : ${d.vtpMode[0].toUpperCase() + d.vtpMode.slice(1)}`, 'Maximum VLANs supported locally   : 255', `Number of existing VLANs          : ${Object.keys(d.vlans).length + 4}`, `Configuration Revision            : ${d.vtpRev}`];
  }
  function showSnoop(d) {
    return [`Switch DHCP snooping is ${d.snoop.enabled ? 'enabled' : 'disabled'}`, 'DHCP snooping is configured on following VLANs:', d.snoop.vlans.length ? fmtVlist(d.snoop.vlans) : 'none', `Insertion of option 82 is ${d.snoop.noOpt82 ? 'disabled' : 'enabled'}`, 'Interface                  Trusted    Rate limit (pps)', '-----------------------    -------    ----------------', ...Object.keys(d.ports).sort(ifSort).filter((n) => d.ports[n].trust || d.ports[n].dhcpRate).map((n) => `${pad(longIf(n), 27)}${pad(d.ports[n].trust ? 'yes' : 'no', 11)}${d.ports[n].dhcpRate || 'unlimited'}`)];
  }
  function showSnoopBind(d, withStatic) {
    const B = withStatic ? N.snoopBindings(d) : d.snoop.bindings || [];
    const L = ['MacAddress          IpAddress        Lease(sec)  Type           VLAN  Interface', '------------------  ---------------  ----------  -------------  ----  --------------------'];
    for (const b of B) L.push(`${pad(b.mac.toUpperCase(), 20)}${pad(b.ip, 17)}${pad(b.static ? 'infinite' : b.lease, 12)}${pad(b.static ? 'static' : 'dhcp-snooping', 15)}${pad(b.vlan, 6)}${longIf(b.port)}`);
    L.push(`Total number of bindings: ${B.length}`);
    return L;
  }
  function showDai(d, vlans) {
    const L = ['', `Source Mac Validation      : ${/src-mac/.test(d.daiValidate || '') ? 'Enabled' : 'Disabled'}`, `Destination Mac Validation : ${/dst-mac/.test(d.daiValidate || '') ? 'Enabled' : 'Disabled'}`, `IP Address Validation      : ${/\bip\b/.test(d.daiValidate || '') ? 'Enabled' : 'Disabled'}`, '', ' Vlan     Configuration    Operation   ACL Match          Static ACL', ' ----     -------------    ---------   ---------          ----------'];
    for (const v of vlans) L.push(` ${pad(v, 9)}${pad(d.dai.includes(v) ? 'Enabled' : 'Disabled', 17)}${pad(d.dai.includes(v) && d.vlans[v] ? 'Active' : 'Inactive', 12)}`);
    L.push('', ' Vlan      Forwarded        Dropped     DHCP Drops      ACL Drops', ' ----      ---------        -------     ----------      ---------');
    for (const v of vlans) { const st = d.daiStats?.[v] || { fwd: 0, drop: 0 }; L.push(` ${pad(v, 10)}${pad(st.fwd, 17)}${pad(st.drop, 12)}${pad(st.drop, 16)}0`); }
    return L;
  }
  function showDaiStats(d) { return showDai(d, d.dai).slice(9); }
  function showDaiIfs(d) {
    const L = [' Interface        Trust State     Rate (pps)    Burst Interval', ' ---------------  -----------     ----------    --------------'];
    for (const n of Object.keys(d.ports).filter((x) => !x.startsWith('po')).sort(ifSort)) { const p = d.ports[n]; L.push(` ${pad(shortIf(n), 17)}${pad(p.daiTrust ? 'Trusted' : 'Untrusted', 16)}${pad(p.daiTrust ? 'None' : p.daiRate ?? 15, 14)}${p.daiTrust ? 'N/A' : 1}`); }
    return L;
  }
  function showIpsg(d) {
    const L = ['Interface    Filter-type  Filter-mode  IP-address       Mac-address        Vlan', '---------    -----------  -----------  ---------------  -----------------  ----'];
    for (const n of Object.keys(d.ports).sort(ifSort).filter((x) => d.ports[x].ipsg)) {
      const bs = N.snoopBindings(d).filter((b) => b.port === n);
      if (!bs.length) L.push(`${pad(shortIf(n), 13)}${pad('ip', 13)}${pad('inactive-no-snooping-vlan', 13)}`.replace('inactive-no-snooping-vlan', d.snoop.enabled ? 'active       deny-all' : 'inactive-no-snooping-vlan'));
      for (const b of bs) L.push(`${pad(shortIf(n), 13)}${pad('ip', 13)}${pad('active', 13)}${pad(b.ip, 17)}${pad('', 19)}${b.vlan}`);
    }
    return L;
  }
  function showLogin(d) {
    const L = d.loginSec;
    if (!L?.blockFor) return ['     No login delay has been applied.', '     No Quiet-Mode access list has been configured.', '', '     Router NOT enabled to watch for login Attacks'];
    const q = N.loginQuiet(d);
    return [`     A default login delay of ${L.delay || 1} seconds is applied.`, L.quietAcl ? `     Quiet-Mode access list ${L.quietAcl} is applied.` : '     No Quiet-Mode access list has been configured.', '', '     Router enabled to watch for login Attacks.', `     If more than ${L.attempts} login failures occur in ${L.within} seconds or less,`, `     logins will be disabled for ${L.blockFor} seconds.`, '', q ? `     Router presently in Quiet-Mode.` : '     Router presently in Normal-Mode.', q ? `     Will remain in Quiet-Mode for ${Math.ceil((L.quietUntil - N.clock.now()) / 1000)} seconds.` : `     Current Watch Window remaining time ${L.within} seconds.`, `     Present login failure count ${(L.fails || []).length}.`];
  }

  // ---- chung ----
  /** Mã sản phẩm thật gần nhất theo số cổng FastEthernet. */
  function switchPid(d) {
    const n = Object.keys(d.ports).filter((p) => p.startsWith('fa')).length, size = n <= 8 ? 8 : n <= 24 ? 24 : 48;
    return d.model === '3560' ? `WS-C3560-${size}${size === 8 ? 'PC' : 'TS'}-S` : `WS-C2960-${size}TT-L`;
  }
  function showInventory(d) {
    const pid = isRouter(d) ? 'CISCO2911/K9' : switchPid(d);
    const sn = [...d.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7).toString(36).toUpperCase().padStart(8, '0').slice(-8);
    return [`NAME: "${isRouter(d) ? 'CISCO2911/K9 chassis' : '1'}", DESCR: "${pid}"`, `PID: ${pid}  , VID: V05  , SN: FOC${sn}`];
  }
  const SAMPLE = '(Lab: số liệu mẫu, không đo từ mô phỏng)';
  function showCpu() {
    return ['CPU utilization for five seconds: 1%/0%; one minute: 1%; five minutes: 1%', ' PID Runtime(ms)     Invoked      uSecs   5Sec   1Min   5Min TTY Process', '   1        3180        1412       2252  0.00%  0.00%  0.00%   0 Chunk Manager', '  45        8120       60231        134  0.15%  0.12%  0.10%   0 IP Input', '  61        2044       12078        169  0.07%  0.05%  0.05%   0 ARP Input', SAMPLE];
  }
  function showMemory() {
    return ['                Head    Total(b)     Used(b)     Free(b)   Lowest(b)  Largest(b)', 'Processor    21C2E100   401293056    62915840   338377216   337901568   337512448', '      I/O    1E000000    33554432     7340032    26214400    26214400    26148864', SAMPLE];
  }
  function showEnvironment(d) {
    return [...(isRouter(d) ? ['SYS PS1 is present', 'Fan 1 OK, Fan 2 OK, Fan 3 OK', 'SYSTEM INLET: Normal', 'SYSTEM OUTLET: Normal'] : ['FAN is OK', 'TEMPERATURE is OK', 'POWER is OK']), SAMPLE];
  }
  function showControllers(d, n) {
    const f = isRouter(d) ? d.ifaces[n] : null;
    if (!f) return ['% Invalid input detected.'];
    if (!n.startsWith('s')) return [`Interface ${longIf(n)}`, 'Hardware is CN Gigabit Ethernet'];
    if (!N.linkAt(net, d.id, n)) return [`Interface ${longIf(n)}`, 'Hardware is GT96K', 'No serial cable attached'];
    return [`Interface ${longIf(n)}`, 'Hardware is GT96K', f.clock ? `DCE V.35, clock rate ${f.clock}` : 'DTE V.35 TX and RX clocks detected.'];
  }
  function showVersion(d) {
    N.ensureFlash(d);
    return isRouter(d)
      ? [`Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version ${d.version}, RELEASE SOFTWARE (fc2)`, 'Technical Support: http://www.cisco.com/techsupport', '', `${d.name} uptime is ${uptime(d)}`, `System image file is "flash:${d.image}"`, '', 'Cisco CISCO2911/K9 (revision 1.0) with 491520K/32768K bytes of memory.', `${Object.keys(d.ifaces).filter((n) => !n.includes('.')).length} Gigabit Ethernet/Serial interfaces`, `${d.flashSize >> 10}K bytes of ATA System CompactFlash 0 (Read/Write)`, `Configuration register is ${d.confreg || '0x2102'}${d.confregNext && d.confregNext !== (d.confreg || '0x2102') ? ` (will be ${d.confregNext} at next reload)` : ''}`]
      : [`Cisco IOS Software, C${d.model} Software (C${d.model}-${d.model === '3560' ? 'IPBASEK9' : 'LANBASEK9'}-M), Version ${d.version}, RELEASE SOFTWARE (fc1)`, `${d.name} uptime is ${uptime(d)}`, `System image file is "flash:${d.image}"`, '', `cisco ${switchPid(d)} (PowerPC405) processor with 65536K bytes of memory.`, `${Object.keys(d.ports).filter((n) => !n.startsWith('po')).length} FastEthernet/GigabitEthernet interfaces`, `Base ethernet MAC Address       : ${N.ciscoMac(N.switchMac(net, d.id)).toUpperCase()}`, 'Configuration register is 0xF'];
  }
  function ntpState(d, depth = 0) {
    if (d.ntp.master != null) return { sync: true, stratum: d.ntp.master, ref: '127.127.1.1' };
    if (depth > 3) return { sync: false };
    for (const s of d.ntp.servers) {
      const r = N.sendPacket(net, { src: d.id, dst: s });
      if (!r.ok) continue;
      const sd = net.devices[r.at.dev];
      if (sd.type === 'server' && sd.services?.includes(123)) return { sync: true, stratum: 2, ref: s };
      if (sd.type !== 'router' && sd.type !== 'switch') continue;
      const st = ntpState(sd, depth + 1);
      if (st.sync) return { sync: true, stratum: st.stratum + 1, ref: s };
    }
    return { sync: false };
  }
  function showNtp(d) {
    const st = ntpState(d);
    return st.sync ? [`Clock is synchronized, stratum ${st.stratum}, reference is ${st.ref}`, 'nominal freq is 250.0000 Hz, actual freq is 249.9990 Hz, precision is 2**24', 'reference time is E6A1C3D2.0B020C68 (12:00:02.043 UTC Mon Mar 2 2026)'] : ['Clock is unsynchronized, stratum 16, no reference clock', 'nominal freq is 250.0000 Hz, actual freq is 249.9990 Hz, precision is 2**24'];
  }
  function showNtpAssoc(d) {
    const st = ntpState(d);
    return ['address         ref clock       st   when     poll    reach  delay          offset            disp', ...d.ntp.servers.map((s) => `${st.sync && st.ref === s ? '*~' : ' ~'}${pad(s, 16)}${pad(st.sync && st.ref === s ? '127.127.1.1' : '.INIT.', 16)}${pad(st.sync && st.ref === s ? st.stratum - 1 : 16, 5)}${pad(12, 9)}${pad(64, 8)}${pad(st.sync && st.ref === s ? 377 : 0, 7)}0.00           0.00              0.12`), ' * sys.peer, # selected, + candidate, - outlyer, x falseticker, ~ configured'];
  }
  function clockLine(d) { if (d.clockNow?.text) return d.clockNow.text; return ntpState(d).sync ? '12:00:02.043 UTC Mon Mar 2 2026' : '*0:12:34.567 UTC Mon Mar 1 1993'; }
  function cdpOn(d, p) { if (!d.cdpRun) return false; return d.type === 'router' ? d.ifaces[p]?.cdp !== false : d.ports[p]?.cdp !== false; }
  function showCdp(d, detail) {
    const L = detail ? [] : ['Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge', '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone', 'Device ID    Local Intrfce   Holdtme    Capability   Platform    Port ID'];
    if (!d.cdpRun) return ['% CDP is not enabled'];
    const names = isRouter(d) ? Object.keys(d.ifaces).filter((n) => !n.includes('.') && !n.startsWith('lo')) : Object.keys(d.ports).filter((n) => !n.startsWith('po'));
    for (const n of names.sort(ifSort)) {
      if (!N.lineUp(net, d.id, n) || !cdpOn(d, n)) continue;
      const l = N.linkAt(net, d.id, n);
      const pe = N.peerOf(l, d.id, n);
      const pd = net.devices[pe.dev];
      if ((pd.type !== 'router' && pd.type !== 'switch') || !cdpOn(pd, pe.port)) continue;
      const sh = (x) => shortIf(x).replace(/^Gi/, 'Gig ').replace(/^Fa/, 'Fas ').replace(/^Se/, 'Ser ');
      const plat = pd.type === 'router' ? 'CISCO2911' : `WS-C${pd.model}`;
      if (!detail) { L.push(`${pad(pd.name, 13)}${pad(sh(n), 16)}${pad(150, 11)}${pad(pd.type === 'router' ? 'R' : pd.ipRouting ? 'R S I' : 'S', 13)}${pad(plat, 12)}${sh(pe.port)}`); continue; }
      const ip = pd.type === 'router' ? pd.ifaces[pe.port]?.ip : Object.values(pd.svis).find((v) => v.ip)?.ip;
      N.ensureFlash(pd);
      L.push('-------------------------', `Device ID: ${pd.name}`, 'Entry address(es): ', `  IP address: ${ip || '(không có)'}`, `Platform: cisco ${plat},  Capabilities: ${pd.type === 'router' ? 'Router' : 'Switch IGMP'}`, `Interface: ${longIf(n)},  Port ID (outgoing port): ${longIf(pe.port)}`, 'Holdtime : 150 sec', '', 'Version :', `Cisco IOS Software, Version ${pd.version}`, '');
      if (pd.type === 'switch' && d.type === 'switch') { const e1 = N.effPort(net, d, n), e2 = N.effPort(net, pd, pe.port); if (e1.mode === 'trunk' && e2.mode === 'trunk') L.push(`Native VLAN: ${e2.native}`, ''); }
    }
    return L;
  }
  // ---- LLDP (IEEE 802.1AB): mặc định TẮT trên IOS, cần "lldp run"; mỗi cổng có transmit/receive riêng
  const lldpPort = (d, p) => (isRouter(d) ? d.ifaces[p] : d.ports[p]) || {};
  const lldpTx = (d, p) => !!d.lldpRun && lldpPort(d, p).lldpTx !== false;
  const lldpRx = (d, p) => !!d.lldpRun && lldpPort(d, p).lldpRx !== false;
  function showLldpGlobal(d) {
    if (!d.lldpRun) return ['% LLDP is not enabled'];
    return ['', 'Global LLDP Information:', '    Status: ACTIVE', `    LLDP advertisements are sent every ${d.lldpTimer || 30} seconds`, `    LLDP hold time advertised is ${d.lldpHold || 120} seconds`, '    LLDP interface reinitialisation delay is 2 seconds'];
  }
  function lldpNbrs(d) {
    const names = isRouter(d) ? Object.keys(d.ifaces).filter((n) => !n.includes('.') && !/^(lo|tu)\d/.test(n)) : Object.keys(d.ports).filter((n) => !/^po\d/.test(n));
    const out = [];
    for (const n of names.sort(ifSort)) {
      if (!N.lineUp(net, d.id, n) || !lldpRx(d, n)) continue;
      const pe = N.peerOf(N.linkAt(net, d.id, n), d.id, n);
      const pd = net.devices[pe.dev];
      if ((pd.type !== 'router' && pd.type !== 'switch') || !lldpTx(pd, pe.port)) continue;
      out.push({ n, pe, pd });
    }
    return out;
  }
  const lldpCap = (pd) => (pd.type === 'router' ? 'R' : pd.ipRouting ? 'B,R' : 'B');
  function showLldp(d, detail) {
    if (!d.lldpRun) return ['% LLDP is not enabled'];
    const nb = lldpNbrs(d);
    const sh = (x) => shortIf(x);
    if (!detail) return ['Capability codes:', '    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device', '    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other', '', 'Device ID           Local Intf     Hold-time  Capability      Port ID',
      ...nb.map(({ n, pe, pd }) => `${pad(pd.name, 20)}${pad(sh(n), 15)}${pad(pd.lldpHold || 120, 11)}${pad(lldpCap(pd), 16)}${sh(pe.port)}`), '', `Total entries displayed: ${nb.length}`];
    const L = [];
    for (const { n, pe, pd } of nb) {
      const ip = pd.type === 'router' ? pd.ifaces[pe.port]?.ip : Object.values(pd.svis).find((v) => v.ip)?.ip;
      const desc = (pd.type === 'router' ? pd.ifaces[pe.port]?.desc : pd.ports[pe.port]?.desc) || '';
      N.ensureFlash(pd);
      L.push('------------------------------------------------', `Local Intf: ${sh(n)}`, `Chassis id: ${N.ciscoMac(pd.type === 'switch' ? N.switchMac(net, pd.id) : N.epMac(net, { dev: pd.id, ifn: pe.port }))}`, `Port id: ${sh(pe.port)}`, `Port Description: ${desc || longIf(pe.port)}`, `System Name: ${pd.name}`, '', 'System Description: ', `Cisco IOS Software, ${pd.type === 'router' ? 'C2900' : `C${pd.model}`} Software, Version ${pd.version}`, '',
        `Time remaining: ${(pd.lldpHold || 120) - 12} seconds`, `System Capabilities: ${pd.type === 'router' ? 'R' : 'B,R'}`, `Enabled Capabilities: ${lldpCap(pd)}`, 'Management Addresses:', `    IP: ${ip || 'not advertised'}`, 'Auto Negotiation - supported, enabled', 'Physical media capabilities:', '    1000baseT(FD)', '    100base-TX(FD)', 'Media Attachment Unit type: 30', 'Vlan ID: - not advertised', '');
    }
    L.push(`Total entries displayed: ${nb.length}`);
    return L;
  }
  function showLldpIf(d) {
    if (!d.lldpRun) return ['% LLDP is not enabled'];
    const names = isRouter(d) ? Object.keys(d.ifaces).filter((n) => !n.includes('.') && !/^(lo|tu)\d/.test(n)) : Object.keys(d.ports).filter((n) => !/^po\d/.test(n));
    return names.sort(ifSort).flatMap((n) => [`${longIf(n)}:`, `    Tx: ${lldpTx(d, n) ? 'enabled' : 'disabled'}`, `    Rx: ${lldpRx(d, n) ? 'enabled' : 'disabled'}`, `    Tx state: ${lldpTx(d, n) ? 'IDLE' : 'INIT'}`, `    Rx state: ${lldpRx(d, n) ? 'WAIT FOR FRAME' : 'INIT'}`, '']);
  }
  function showSsh(d) {
    if (d.rsa >= 768) return [`SSH Enabled - version ${d.sshVer === 1 ? '1.5' : '2.0'}`, `Authentication timeout: ${d.sshTimeout || 120} secs; Authentication retries: ${d.sshRetries ?? 3}`];
    if (d.rsa > 0) return ['SSH Enabled - version 1.99', 'Authentication timeout: 120 secs; Authentication retries: 3', '(Lab: khoá RSA < 768 bit nên chưa chạy được SSH version 2)'];
    return ['SSH Disabled - version 1.99', '%Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2).'];
  }
  function showArp(d) {
    const L = ['Protocol  Address          Age (min)  Hardware Addr   Type   Interface'];
    if (isL3(d)) for (const n of ifOrder(d)) { const f = IFS(d)[n]; if (f.ip && !/^s\d/.test(n) && N.ifUp(net, d.id, n)) L.push(`Internet  ${pad(f.ip, 17)}${lpad('-', 9)}   ${pad(N.ciscoMac(N.epMac(net, { dev: d.id, ifn: n })), 16)}ARPA   ${longIf(n)}`); }
    for (const [ip, e] of Object.entries(d.arp)) L.push(`Internet  ${pad(ip, 17)}${lpad(0, 9)}   ${pad(N.ciscoMac(e.mac), 16)}ARPA   ${longIf(e.ifn)}`);
    return L;
  }

  // ---- running-config ----
  function aceCfg(type, e) {
    if (e.remark != null) return `remark ${e.remark}`;
    const a = (s) => (!s || s.any ? 'any' : s.wild === '0.0.0.0' ? (type === 'standard' ? s.ip : `host ${s.ip}`) : `${s.ip} ${s.wild}`);
    if (type === 'standard') return `${e.action} ${a(e.src)}${e.log ? ' log' : ''}`;
    return N.aceText(type, e);
  }
  function linesBlock(d) {
    const L = ['line con 0'];
    const c0 = d.lines.con, v = d.lines.vty;
    if (c0.password) L.push(` password ${pwShow(d, c0.password)}`);
    if (c0.execTimeout) L.push(` exec-timeout ${c0.execTimeout.join(' ')}`);
    if (c0.logSync) L.push(' logging synchronous');
    if (c0.authList) L.push(` login authentication ${c0.authList}`);
    if (c0.loginLocal) L.push(' login local'); else if (c0.login) L.push(' login');
    L.push('!', 'line aux 0', '!', 'line vty 0 4');
    if (v.accessClass) L.push(` access-class ${v.accessClass} in`);
    if (v.password) L.push(` password ${pwShow(d, v.password)}`);
    if (v.execTimeout) L.push(` exec-timeout ${v.execTimeout.join(' ')}`);
    if (v.logSync) L.push(' logging synchronous');
    if (v.authList) L.push(` login authentication ${v.authList}`);
    if (v.loginLocal) L.push(' login local'); else if (v.login) L.push(' login');
    if (v.transport && v.transport !== 'all') L.push(` transport input ${v.transport}`);
    L.push('!');
    return L;
  }
  function headBlock(d) {
    const L = ['!', `version ${(d.version || N.defaultVersion(d)).replace(/\(.*/, '')}`, 'no service timestamps log datetime msec', 'no service timestamps debug datetime msec', d.servicePwEnc ? 'service password-encryption' : 'no service password-encryption', '!', `hostname ${d.name}`, '!'];
    if (d.bootSystem?.length) L.push('boot-start-marker', ...d.bootSystem.map((b) => `boot system flash:${b}`), 'boot-end-marker', '!');
    if (d.enableSecret) L.push(`enable secret 5 ${md5ish(d.enableSecret)}`);
    if (d.enablePassword) L.push(`enable password ${pwShow(d, d.enablePassword)}`);
    if (d.enableSecret || d.enablePassword) L.push('!');
    for (const [n, s] of Object.entries(d.aaa?.servers || {})) L.push(`${s.proto === 'radius' ? 'radius' : 'tacacs'} server ${n}`, ...(s.ip ? [` address ipv4 ${s.ip}`] : []), ...(s.key ? [` key ${s.key}`] : []));
    if (d.aaa?.newModel) { L.push('aaa new-model', ...Object.entries(d.aaa.lists).map(([n, m]) => `aaa authentication login ${n} ${m.join(' ')}`), ...(d.aaa.enable ? [`aaa authentication enable default ${d.aaa.enable}`] : []), '!'); }
    if (d.pwMin) L.push(`security passwords min-length ${d.pwMin}`);
    const ls = d.loginSec;
    if (ls?.blockFor) L.push(`login block-for ${ls.blockFor} attempts ${ls.attempts} within ${ls.within}`);
    if (ls?.quietAcl) L.push(`login quiet-mode access-class ${ls.quietAcl}`);
    if (ls?.delay) L.push(`login delay ${ls.delay}`);
    if (ls?.logFail) L.push('login on-failure log');
    if (ls?.logOk) L.push('login on-success log');
    if (d.pwMin || ls?.blockFor || ls?.logFail) L.push('!');
    return L;
  }
  function tailBlock(d) {
    const L = [];
    if (!d.cdpRun) L.push('no cdp run');
    if (d.lldpRun) L.push('lldp run');
    if (d.lldpTimer) L.push(`lldp timer ${d.lldpTimer}`);
    if (d.lldpHold) L.push(`lldp holdtime ${d.lldpHold}`);
    for (const s of d.ntp.servers) L.push(`ntp server ${s}`);
    if (d.ntp.master != null) L.push(d.ntp.master === 8 ? 'ntp master' : `ntp master ${d.ntp.master}`);
    for (const h of d.logging) L.push(`logging ${h}`);
    L.push(...SN.snmpRunning(d));
    if (d.banner) L.push(`banner motd ^C${d.banner}^C`);
    L.push('!', ...linesBlock(d), 'end');
    return L;
  }
  function usersBlock(d) {
    const L = [];
    if (d.domain) L.push(`ip domain-name ${d.domain}`);
    if (d.sshVer) L.push(`ip ssh version ${d.sshVer}`);
    if (d.scpServer) L.push('ip scp server enable');
    if (d.sshTimeout) L.push(`ip ssh time-out ${d.sshTimeout}`);
    if (d.sshRetries) L.push(`ip ssh authentication-retries ${d.sshRetries}`);
    if (d.httpServer) L.push('ip http server');
    if (d.httpsServer) L.push('ip http secure-server');
    for (const [u, x] of Object.entries(d.users)) L.push(`username ${u}${x.priv !== 1 ? ` privilege ${x.priv}` : ''} ${x.kind === 'secret' ? `secret 5 ${md5ish(x.pw)}` : `password ${pwShow(d, x.pw)}`}`);
    if (L.length) L.push('!');
    return L;
  }
  function dhcpBlock(d) {
    const L = [];
    for (const [a, b] of d.dhcp.excluded) L.push(`ip dhcp excluded-address ${a}${b !== a ? ' ' + b : ''}`);
    if (d.dhcp.excluded.length) L.push('!');
    for (const [n, p] of Object.entries(d.dhcp.pools)) {
      L.push(`ip dhcp pool ${n}`);
      if (p.net) L.push(` network ${p.net} ${prefixToMask(p.prefix)}`);
      if (p.router) L.push(` default-router ${p.router}`);
      if (p.dns) L.push(` dns-server ${p.dns}`);
      if (p.domain) L.push(` domain-name ${p.domain}`);
      L.push('!');
    }
    return L;
  }
  function routingBlock(d) {
    const L = [];
    if (d.ospf) {
      const o = d.ospf;
      L.push(`router ospf ${o.pid}`);
      if (o.rid) L.push(` router-id ${o.rid}`);
      L.push(' log-adjacency-changes');
      if (o.passiveDefault) { L.push(' passive-interface default'); for (const n of o.noPassive) L.push(` no passive-interface ${longIf(n)}`); }
      else for (const n of o.passive) L.push(` passive-interface ${longIf(n)}`);
      for (const [src, c0] of Object.entries(o.redist || {})) L.push(` redistribute ${src}${c0.as ?? c0.pid ? ' ' + (c0.as ?? c0.pid) : ''}${c0.metric != null ? ' metric ' + c0.metric : ''}${c0.subnets ? ' subnets' : ''}`);
      L.push(...NP.ospfLines(o));
      for (const s of o.networks) L.push(` network ${s.net} ${s.wild} area ${s.area}`);
      if (o.defaultOriginate) L.push(` default-information originate${o.defaultAlways ? ' always' : ''}`);
      L.push('!');
    }
    if (d.bgp) {
      const b = d.bgp;
      L.push(`router bgp ${b.as}`);
      if (b.rid) L.push(` bgp router-id ${b.rid}`);
      L.push(' bgp log-neighbor-changes');
      for (const n of b.networks) L.push(` network ${n.net} mask ${prefixToMask(n.prefix)}`);
      L.push(...NP.bgpLines(b));
      for (const [ip, n] of Object.entries(b.neighbors)) {
        if (n.remoteAs != null) L.push(` neighbor ${ip} remote-as ${n.remoteAs}`);
        if (n.desc) L.push(` neighbor ${ip} description ${n.desc}`);
        if (n.updateSource) L.push(` neighbor ${ip} update-source ${longIf(n.updateSource)}`);
        if (n.nextHopSelf) L.push(` neighbor ${ip} next-hop-self`);
        if (n.defaultOriginate) L.push(` neighbor ${ip} default-originate`);
      }
      L.push('!');
    }
    if (d.eigrp?.named) L.push(...NP.eigrpNamed(d.eigrp));
    else if (d.eigrp) {
      const e = d.eigrp;
      L.push(`router eigrp ${e.as}`);
      if (e.rid) L.push(` eigrp router-id ${e.rid}`);
      for (const n of e.passive) L.push(` passive-interface ${longIf(n)}`);
      for (const [src, c0] of Object.entries(e.redist || {})) L.push(` redistribute ${src}${c0.as ?? c0.pid ? ' ' + (c0.as ?? c0.pid) : ''}${c0.metric ? ` metric ${c0.metric[0]} ${c0.metric[1]} 255 1 1500` : ''}`);
      if (e.defaultMetric) L.push(` default-metric ${e.defaultMetric[0]} ${e.defaultMetric[1]} 255 1 1500`);
      L.push(...NP.eigrpLines(e));
      for (const s of e.networks) L.push(` network ${s.net}${s.wild ? ' ' + s.wild : ''}`);
      if (!e.autoSummary) L.push(' no auto-summary');
      L.push('!');
    }
    return L;
  }
  function aclBlock(d) {
    const L = [];
    for (const [n, a] of Object.entries(d.acls)) if (a.numbered) for (const e of a.entries) L.push(`access-list ${n} ${aceCfg(a.type, e)}`);
    for (const [n, a] of Object.entries(d.acls)) if (!a.numbered) { L.push(`ip access-list ${a.type} ${n}`); for (const e of a.entries) L.push(` ${aceCfg(a.type, e)}`); }
    return L;
  }
  function runIfRouter(d, n) {
    const f = IFS(d)[n];
    const L = [`interface ${longIf(n)}`];
    if (f.desc) L.push(` description ${f.desc}`);
    if (f.vrf) L.push(` ip vrf forwarding ${f.vrf}`);
    if (f.encap != null) L.push(` encapsulation dot1Q ${f.encap}${f.native ? ' native' : ''}`);
    L.push(f.ip ? ` ip address ${f.ip} ${prefixToMask(f.prefix)}` : ' no ip address');
    for (const h of f.helper) L.push(` ip helper-address ${h}`);
    if (f.aclIn) L.push(` ip access-group ${f.aclIn} in`);
    if (f.aclOut) L.push(` ip access-group ${f.aclOut} out`);
    if (f.proxyArp === false) L.push(' no ip proxy-arp');
    if (f.nat) L.push(` ip nat ${f.nat}`);
    if (f.ospfCost != null) L.push(` ip ospf cost ${f.ospfCost}`);
    if (f.ospfPrio != null) L.push(` ip ospf priority ${f.ospfPrio}`);
    if (f.ospfNet) L.push(` ip ospf network ${{ p2p: 'point-to-point', p2mp: 'point-to-multipoint', nbma: 'non-broadcast', broadcast: 'broadcast' }[f.ospfNet]}`);
    if (f.ospfHello != null) L.push(` ip ospf hello-interval ${f.ospfHello}`);
    if (f.ospfPid != null) L.push(` ip ospf ${f.ospfPid} area ${f.ospfArea}`);
    if (f.ll) L.push(` ipv6 address ${f.ll} link-local`);
    L.push(...NP.ifLines(f));
    for (const a of f.ipv6 || []) L.push(a.dhcp ? ' ipv6 address dhcp' : a.eui ? ` ipv6 address ${A6.net6(a.ip, 64)}/64 eui-64` : ` ipv6 address ${a.ip}/${a.prefix}`);
    if (f.ipv6Enable) L.push(' ipv6 enable');
    for (const dir of ['in', 'out']) if (f.ipv6Filter?.[dir]) L.push(` ipv6 traffic-filter ${f.ipv6Filter[dir]} ${dir}`);
    if (f.ospf6) L.push(` ipv6 ospf ${f.ospf6.pid} area ${f.ospf6.area}`);
    if (f.zone) L.push(` zone-member security ${f.zone}`);
    if (f.bw != null) L.push(` bandwidth ${f.bw}`);
    if (n.startsWith('s') && f.l2enc === 'ppp') L.push(' encapsulation ppp');
    if (f.pppAuth) L.push(` ppp authentication ${f.pppAuth}`);
    for (const [g, s] of Object.entries(f.standby || {})) {
      if (s.ip) L.push(` standby ${g} ip ${s.ip}`);
      if (s.priority != null) L.push(` standby ${g} priority ${s.priority}`);
      if (s.preempt) L.push(` standby ${g} preempt`);
      for (const t of s.track || []) L.push(t.obj != null ? ` standby ${g} track ${t.obj} decrement ${t.dec}` : ` standby ${g} track ${longIf(t.ifn)} ${t.dec}`);
    }
    for (const [g, s] of Object.entries(f.vrrp || {})) {
      if (s.ip) L.push(` vrrp ${g} ip ${s.ip}`);
      if (s.priority != null) L.push(` vrrp ${g} priority ${s.priority}`);
      if (s.preempt === false) L.push(` no vrrp ${g} preempt`);
    }
    if (f.tunSrc) L.push(` tunnel source ${isIp(f.tunSrc) ? f.tunSrc : longIf(f.tunSrc)}`);
    if (f.tunDst) L.push(` tunnel destination ${f.tunDst}`);
    if (f.cryptoMap) L.push(` crypto map ${f.cryptoMap}`);
    if (f.cdp === false) L.push(' no cdp enable');
    if (f.lldpTx === false) L.push(' no lldp transmit');
    if (f.lldpRx === false) L.push(' no lldp receive');
    if (n.startsWith('s') && f.clock) L.push(` clock rate ${f.clock}`);
    if (!n.includes('.') && !n.startsWith('lo') && !n.startsWith('s') && !n.startsWith('vlan')) L.push(` duplex ${f.duplex || 'auto'}`, ` speed ${f.speed || 'auto'}`);
    if (f.shutdown) L.push(' shutdown');
    L.push('!');
    return L;
  }
  function runIfSwitch(d, n) {
    if (n.startsWith('vlan')) return runIfRouter(d, n);
    const L = [`interface ${longIf(n)}`];
    const p = d.ports[n];
    if (p.desc) L.push(` description ${p.desc}`);
    if (p.pv?.mode === 'host' && p.pv.primary) L.push(` switchport private-vlan host-association ${p.pv.primary} ${p.pv.secondary}`);
    if (p.pv?.mode === 'promiscuous' && p.pv.primary) L.push(` switchport private-vlan mapping ${p.pv.primary} ${fmtVlist(p.pv.mapping || [])}`);
    if (p.native !== 1) L.push(` switchport trunk native vlan ${p.native}`);
    if (p.allowed != null) L.push(` switchport trunk allowed vlan ${fmtVlist(p.allowed)}`);
    if (p.vlan !== 1) L.push(` switchport access vlan ${p.vlan}`);
    if (p.mode === 'private-vlan') L.push(` switchport mode private-vlan ${p.pv?.mode}`);
    else if (p.modeSet || p.mode === 'trunk') L.push(` switchport mode ${p.mode}`);
    else if (p.dyn === 'desirable') L.push(' switchport mode dynamic desirable');
    if (p.nonegotiate) L.push(' switchport nonegotiate');
    if (p.protected) L.push(' switchport protected');
    if (p.voiceVlan) L.push(` switchport voice vlan ${p.voiceVlan}`);
    if (p.rootGuard) L.push(' spanning-tree guard root');
    if (p.loopGuard) L.push(' spanning-tree guard loop');
    if (p.storm?.level != null) L.push(` storm-control broadcast level ${p.storm.level}`);
    if (p.storm?.action) L.push(` storm-control action ${p.storm.action}`);
    if (p.raGuard) L.push(` ipv6 nd raguard attach-policy ${p.raGuard}`);
    if (p.power === 'never') L.push(' power inline never');
    if (p.duplex) L.push(` duplex ${p.duplex}`);
    if (p.speed) L.push(` speed ${p.speed}`);
    if (p.ps) {
      if (p.ps.enabled) L.push(' switchport port-security');
      if (p.ps.max !== 1) L.push(` switchport port-security maximum ${p.ps.max}`);
      if (p.ps.sticky) { L.push(' switchport port-security mac-address sticky'); for (const m of p.ps.macs) L.push(` switchport port-security mac-address sticky ${N.ciscoMac(m)}`); }
      else for (const m of p.ps.macs) L.push(` switchport port-security mac-address ${N.ciscoMac(m)}`);
      if (p.ps.violation !== 'shutdown') L.push(` switchport port-security violation ${p.ps.violation}`);
    }
    if (p.trust) L.push(' ip dhcp snooping trust');
    if (p.dhcpRate) L.push(` ip dhcp snooping limit rate ${p.dhcpRate}`);
    if (p.daiTrust) L.push(' ip arp inspection trust');
    if (p.daiRate != null) L.push(` ip arp inspection limit rate ${p.daiRate}`);
    if (p.ipsg) L.push(' ip verify source');
    if (p.cdp === false) L.push(' no cdp enable');
    if (p.lldpTx === false) L.push(' no lldp transmit');
    if (p.lldpRx === false) L.push(' no lldp receive');
    if (p.group != null) L.push(` channel-group ${p.group} mode ${p.chMode}`);
    if (p.shutdown) L.push(' shutdown');
    if (p.portfast) L.push(' spanning-tree portfast');
    if (p.bpduguard) L.push(' spanning-tree bpduguard enable');
    L.push('!');
    return L;
  }
  function runIfBlock(d, n) {
    if (isRouter(d)) return d.ifaces[n] ? ['Building configuration...', '', 'Current configuration : 120 bytes', '!', ...runIfRouter(d, n), 'end'] : ['% Invalid input detected.'];
    return d.ports[n] || d.svis[n] ? ['Building configuration...', '', 'Current configuration : 120 bytes', '!', ...runIfSwitch(d, n), 'end'] : ['% Invalid input detected.'];
  }
  function runningConfig(d) {
    let L;
    if (isRouter(d)) {
      L = headBlock(d);
      L.push(...dhcpBlock(d));
      L.push(...usersBlock(d));
      for (const [n, p] of Object.entries(d.crypto.isakmp)) L.push(`crypto isakmp policy ${n}`, ` encr ${p.encr}`, ...(p.hash !== 'sha' ? [` hash ${p.hash}`] : []), ` authentication ${p.auth}`, ` group ${p.group}`, ...(p.lifetime !== 86400 ? [` lifetime ${p.lifetime}`] : []), '!');
      for (const [ip, k] of Object.entries(d.crypto.keys)) L.push(`crypto isakmp key ${k} address ${ip}`);
      for (const [n, t] of Object.entries(d.crypto.tsets)) L.push(`crypto ipsec transform-set ${n} ${t.join(' ')}`, ' mode tunnel');
      for (const [m, seqs] of Object.entries(d.crypto.maps)) for (const [seq, e] of Object.entries(seqs)) L.push(`crypto map ${m} ${seq} ipsec-isakmp`, ...(e.peer ? [` set peer ${e.peer}`] : []), ...(e.tset ? [` set transform-set ${e.tset}`] : []), ...(e.acl ? [` match address ${e.acl}`] : []), '!');
      if (d.zbf) {
        const z = d.zbf;
        for (const [n, c0] of Object.entries(z.classMaps)) L.push(`class-map type inspect ${c0.all ? 'match-all' : 'match-any'} ${n}`, ...c0.matches.map((m) => (m.protocol ? ` match protocol ${m.protocol}` : ` match access-group name ${m.acl}`)), '!');
        for (const [n, pm] of Object.entries(z.policyMaps)) L.push(`policy-map type inspect ${n}`, ...pm.flatMap((e) => [e.cls === 'class-default' ? ' class class-default' : ` class type inspect ${e.cls}`, ...(e.action ? [`  ${e.action}`] : [])]), '!');
        for (const [n, o] of Object.entries(z.zones)) L.push(`zone security ${n}`, ...(o.desc ? [` description ${o.desc}`] : []));
        for (const p of z.pairs) L.push(`zone-pair security ${p.name} source ${p.src} destination ${p.dst}`, ...(p.policy ? [` service-policy type inspect ${p.policy}`] : []));
        L.push('!');
      }
      for (const n of ifOrder(d)) L.push(...runIfRouter(d, n));
      L.push(...routingBlock(d));
      for (const r of d.nat.dyn) L.push(r.iface ? `ip nat inside source list ${r.acl} interface ${longIf(r.iface)} overload` : `ip nat inside source list ${r.acl} pool ${r.pool}${r.overload ? ' overload' : ''}`);
      for (const [n, p] of Object.entries(d.nat.pools)) L.push(`ip nat pool ${n} ${p.start} ${p.end} netmask ${prefixToMask(p.prefix)}`);
      for (const s of d.nat.statics) L.push(s.proto ? `ip nat inside source static ${s.proto} ${s.local} ${s.lport} ${s.global} ${s.gport}` : `ip nat inside source static ${s.local} ${s.global}`);
      L.push('ip classless');
      for (const r of d.routes) L.push(`ip route ${r.net} ${prefixToMask(r.prefix)} ${r.iface ? longIf(r.iface) + (r.nh ? ' ' + r.nh : '') : r.nh}${r.ad !== 1 ? ' ' + r.ad : ''}${r.name ? ' name ' + r.name : ''}`);
      if (d.ipv6Routing) L.push('ipv6 unicast-routing');
      for (const r of d.routes6 || []) L.push(`ipv6 route ${r.net}/${r.prefix} ${r.iface ? longIf(r.iface) + (r.nh ? ' ' + r.nh : '') : r.nh}${(r.ad ?? 1) !== 1 ? ' ' + r.ad : ''}`);
      if (d.ospf6) L.push(`ipv6 router ospf ${d.ospf6.pid}`, ...(d.ospf6.rid ? [` router-id ${d.ospf6.rid}`] : []), ...d.ospf6.passive.map((n) => ` passive-interface ${longIf(n)}`), '!');
      L.push('!', ...NP.running(d), '!', ...aclBlock(d), '!', ...ACL6.acl6Running(d.acls6));
    } else {
      L = headBlock(d);
      if (d.ipRouting) L.push('ip routing', '!');
      L.push(...dhcpBlock(d));
      if (d.snoop.vlans.length) L.push(`ip dhcp snooping vlan ${fmtVlist(d.snoop.vlans)}`);
      if (d.snoop.enabled) L.push('ip dhcp snooping');
      if (d.dai.length) L.push(`ip arp inspection vlan ${fmtVlist(d.dai)}`);
      if (d.daiValidate) L.push(`ip arp inspection validate ${d.daiValidate}`);
      if (d.snoop.noOpt82) L.push('no ip dhcp snooping information option');
      for (const b of d.snoop.statics || []) L.push(`ip source binding ${N.ciscoMac(b.mac)} vlan ${b.vlan} ${b.ip} interface ${longIf(b.port)}`);
      L.push(...usersBlock(d), `spanning-tree mode ${d.stp.mode}`);
      if (d.stp.portfastDefault) L.push('spanning-tree portfast default');
      if (d.stp.bpduDefault) L.push('spanning-tree portfast bpduguard default');
      if (d.stp.loopguardDefault) L.push('spanning-tree loopguard default');
      for (const [n, p] of Object.entries(d.raPolicies || {})) L.push(`ipv6 nd raguard policy ${n}`, ` device-role ${p.role}`);
      for (const [v, p] of Object.entries(d.stp.prio)) L.push(`spanning-tree vlan ${v} priority ${p}`);
      if (d.stp.mst) {
        const m = d.stp.mst;
        L.push('!', 'spanning-tree mst configuration', ...(m.name ? [` name ${m.name}`] : []), ...(m.rev ? [` revision ${m.rev}`] : []), ...Object.entries(m.inst).map(([i, l]) => ` instance ${i} vlan ${fmtVlist(l)}`));
        for (const [i, p] of Object.entries(m.prio)) L.push(`spanning-tree mst ${i} priority ${p}`);
      }
      L.push('!');
      if (d.vtpMode === 'transparent') {
        L.push('vtp mode transparent', '!');
        for (const v of Object.keys(d.vlans).map(Number).filter((v) => v !== 1)) {
          L.push(`vlan ${v}`, ` name ${d.vlans[v]}`);
          const pv = d.pvlan[v];
          if (pv) { L.push(` private-vlan ${pv.type}`); if (pv.type === 'primary' && pv.assoc?.length) L.push(` private-vlan association ${fmtVlist(pv.assoc)}`); }
          L.push('!');
        }
      }
      for (const n of Object.keys(d.ports).sort((a, b) => (a.startsWith('po') ? -1 : 0) - (b.startsWith('po') ? -1 : 0) || ifSort(a, b))) L.push(...runIfSwitch(d, n));
      for (const n of Object.keys(d.svis).sort(ifSort)) L.push(...runIfSwitch(d, n));
      L.push(...routingBlock(d));
      for (const r of d.routes) L.push(`ip route ${r.net} ${prefixToMask(r.prefix)} ${r.iface ? longIf(r.iface) + (r.nh ? ' ' + r.nh : '') : r.nh}${r.ad !== 1 ? ' ' + r.ad : ''}${r.name ? ' name ' + r.name : ''}`);
      if (d.defaultGateway) L.push(`ip default-gateway ${d.defaultGateway}`);
      L.push(...aclBlock(d));
      for (const [m, es] of Object.entries(d.vacl.maps)) for (const e of es) L.push(`vlan access-map ${m} ${e.seq}`, ...(e.acl ? [` match ip address ${e.acl}`] : []), ` action ${e.action}`);
      for (const [m, vl] of Object.entries(d.vacl.filters)) L.push(`vlan filter ${m} vlan-list ${fmtVlist(vl)}`);
      L.push('!');
    }
    L.push(...tailBlock(d));
    const bytes = L.join('\n').length;
    return ['Building configuration...', '', `Current configuration : ${bytes} bytes`, ...L];
  }

  /** Phím Tab: hoàn thành từ khoá đang gõ dở nếu chỉ có 1 khả năng (như IOS). */
  function complete(id, line0) {
    const d = net.devices[id];
    const s = sess(id);
    if (d.off) return null;
    if (VENDOR[d.os]) return VENDOR[d.os].complete?.(d, s, line0) ?? null; // FortiOS / PAN-OS có cây lệnh riêng
    const m = String(line0).match(/^(.*?)(\S*)$/);
    const head = m[1], part = m[2].toLowerCase();
    if (!part) return null;
    const words = head.trim() ? head.trim().split(/\s+/) : [];
    if (d.type === 'pc' || d.type === 'server') {
      if (words.length) return null;
      const hit = (d.shell === 'linux' ? ['ansible', 'ansible-playbook', 'apt', 'cat', 'curl', 'docker', 'echo', 'ls', 'dhclient', 'dig', 'help', 'hostname', 'ip', 'lb', 'nc', 'netstat', 'nslookup', 'ping', 'resolvectl', 'ss', 'ssh', 'systemctl', 'traceroute', 'ufw', 'uname', 'whoami'] : ['arp', 'curl', 'help', 'ipconfig', 'ipv6config', 'ping', 'ssh', 'telnet', 'tracert']).filter((c0) => c0.startsWith(part));
      return hit.length === 1 ? hit[0] + ' ' : null;
    }
    if (s.pw || s.loggedOut || s.ask) return null;
    const tables = [tableFor(d, s), ...(SUB.has(s.mode) ? [cfgTable(d)] : [])];
    const cands = new Set();
    for (const t of tables) {
      for (const e of t) {
        const r = prefixMatch(e.toks, words);
        if (!r || !r.next) continue;
        const tk = r.next;
        const opts = tk[0] === '{' ? tk.slice(1, -1).split('|') : tk[0] === '<' ? [] : [tk];
        for (const o of opts) if (o.startsWith(part)) cands.add(o);
      }
      if (cands.size) break;
    }
    return cands.size === 1 ? head + [...cands][0] + ' ' : null;
  }

  /**
   * Gợi ý cú pháp đúng cho một lệnh gõ sai (📊 Điểm yếu): xếp mẫu lệnh theo số từ khớp liên tiếp từ đầu, xét cả
   * chế độ hiện tại và các chế độ khác (lỗi hay gặp: gõ lệnh cổng ở (config)#). Từ đầu gõ sai chính tả (≤ 2 ký tự)
   * vẫn được nhận. Trả [{ spec, mode, here }] (tối đa `k`), mode là chế độ dùng được lệnh đó.
   */
  function suggest(id, line, k = 3) {
    const d = net.devices[id];
    if (!d || d.type === 'pc' || d.type === 'server' || VENDOR[d.os] || d.os === 'asa') return [];
    const cur = sess(id);
    let words = String(line).replace(/\?$/, '').trim().split(/\s+/).filter(Boolean);
    if (words[0]?.toLowerCase() === 'do' && words.length > 1) words = words.slice(1);
    if (!words.length) return [];
    const modes = [[cur.mode, cur]];
    const fake = (mode, extra = {}) => ({ mode, ifs: ['g0/0'], ...extra });
    for (const m of ['priv', 'config', 'if', 'vlan', 'line', 'pool', 'acl-ext', 'acl-std', 'bgp']) if (m !== cur.mode) modes.push([m, fake(m)]);
    for (const rp of ['ospf', 'eigrp']) modes.push(['router', fake('router', { rp })]);
    const rank = (ws) => {
      const out = [];
      for (const [mode, s] of modes) {
        for (const e of tableFor(d, s)) {
          const r = matchOne(e.toks, ws);
          const depth = r.ok ? ws.length : r.inc ? r.wi : r.fail ?? r.amb ?? 0;
          if (depth < Math.min(2, ws.length) && !(depth >= 1 && e.toks.length === 1)) continue;
          const score = depth * 10 + (r.ok || r.inc ? 5 : 0) + (mode === cur.mode ? 3 : 0) - e.toks.length * 0.3;
          out.push({ spec: e.spec, mode, here: mode === cur.mode, score });
        }
      }
      return out;
    };
    let cands = rank(words);
    if (!cands.length) {
      // từ đầu gõ sai chính tả: thay bằng từ khoá gần nhất (khoảng cách sửa ≤ 2)
      const firsts = new Set();
      for (const [, s] of modes) for (const e of tableFor(d, s)) if (e.toks[0][0] !== '<' && e.toks[0][0] !== '{') firsts.add(e.toks[0]);
      const w0 = words[0].toLowerCase();
      const best = [...firsts].map((f) => [f, editDist(w0, f)]).filter(([, x]) => x <= 2).sort((a, b) => a[1] - b[1])[0];
      if (best) cands = rank([best[0], ...words.slice(1)]);
    }
    const seen = new Set();
    return cands.sort((a, b) => b.score - a.score).filter((c0) => !seen.has(c0.spec + c0.mode) && seen.add(c0.spec + c0.mode)).slice(0, k).map(({ spec, mode, here }) => ({ spec, mode, here }));
  }

  return { exec, prompt, complete, suggest, session: sess, net, runningConfig };
}

/** Chạy một loạt lệnh trên 1 thiết bị (dùng cho cấu hình khởi tạo lab, lời giải, test). */
export function runScript(cli, devId, cmds) {
  const outs = [];
  for (const c0 of cmds) outs.push({ cmd: c0, ...cli.exec(devId, c0) });
  return outs;
}
