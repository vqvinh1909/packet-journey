// lab/wlc.js — Wireless LAN Controller giả lập, cấu hình bằng giao diện web (ui/wlc.js). Mọi thao tác trên
// form sinh ra "lệnh thao tác" dưới đây, nên nhật ký, khôi phục và lời giải lab dùng chung một đường.
//
//   mgmt ip=<a.b.c.d/nn> gw=<ip>                     — management interface (untagged trên native VLAN của trunk)
//   if add <tên> vlan=<n> ip=<a.b.c.d/nn> gw=<ip>    — dynamic interface · if del <tên>
//   radius add <ip> secret=<chuỗi> · radius del <ip>
//   wlan add <id> ssid=.. iface=<tên> sec=open|wpa2-psk|wpa3-sae|wpa2-ent [psk=..] [radius=<ip>] [qos=..] [isolation=yes|no]
//   wlan set <id> ... · wlan on|off|del <id>         — WLAN mới tạo ở trạng thái TẮT, giống WLC thật
//   ap <id-AP> [channel=1..13] [mode=local|flexconnect]
//   client ssid=.. [psk=..] [user=..] [pass=..]      — thử kết nối bằng một máy khách
//   show wlan|ap|if|radius

import * as N from './net.js';

export const WLC_QOS = { platinum: 'Thoại', gold: 'Video', silver: 'Mặc định (best effort)', bronze: 'Nền (background)' };
export const WLC_SEC = { open: 'Open', 'wpa2-psk': 'WPA2-PSK', 'wpa3-sae': 'WPA3-SAE', 'wpa2-ent': 'WPA2-Enterprise (802.1X)' };
const isPsk = (sec) => sec === 'wpa2-psk' || sec === 'wpa3-sae';

/** Thiết bị WLC: server có IP quản trị, thêm cấu hình `wlc`. */
export function wlcDevice(id, name, x, y) {
  const d = N.server(id, name, x, y, { services: [5246] });
  d.os = 'wlc';
  d.wlc = { ifs: {}, radius: {}, wlans: {}, aps: {} };
  return d;
}
/** Máy chủ RADIUS: secret dùng chung với WLC và danh sách tài khoản. */
export function radiusServer(id, name, x, y, o) {
  const d = N.server(id, name, x, y, { ip: o.ip, gw: o.gw, services: [1812] });
  d.radius = { secret: o.secret, users: o.users };
  return d;
}
const apsOf = (net, d) => Object.values(net.devices).filter((x) => x.isAp).map((ap) => ({ ap, ...(d.wlc.aps[ap.id] || {}) }));
export const apConfig = (d, apId) => ({ channel: null, mode: 'local', ...d.wlc.aps[apId] });

/** AP join khi tới được IP quản trị của WLC (CAPWAP UDP 5246). */
export function apJoined(net, d, apId) { return !!d.ip && N.sendPacket(net, { src: apId, dst: d.ip }).ok; }

/** Đường từ WLC qua switch tới gateway có mang VLAN này không; trả lý do lỗi, null nếu thông.
 *  shortcut: chỉ hiểu gateway là SVI của switch nối trực tiếp với WLC, khi cần router-on-a-stick thì đi theo net.js. */
function vlanPathError(net, d, f) {
  const l = net.links.find((x) => x.a === d.id || x.b === d.id);
  const swId = l && (l.a === d.id ? l.b : l.a), port = l && (l.a === d.id ? l.bp : l.ap), s = net.devices[swId];
  if (s?.type !== 'switch') return 'WLC chưa nối vào switch';
  const p = s.ports[port];
  if (p.shutdown) return `cổng ${port} trên ${s.name} đang shutdown`;
  if (N.effPort(net, s, port).mode !== 'trunk') return `cổng ${port} trên ${s.name} không phải trunk, VLAN ${f.vlan} không đi được`;
  if (p.allowed && !p.allowed.includes(f.vlan)) return `trunk ${port} trên ${s.name} chưa cho phép VLAN ${f.vlan}`;
  if (!s.vlans[f.vlan]) return `VLAN ${f.vlan} chưa có trên ${s.name}`;
  const svi = s.svis[`vlan${f.vlan}`];
  if (!svi?.ip || svi.shutdown || svi.ip !== f.gw) return `gateway ${f.gw} của VLAN ${f.vlan} không có trên ${s.name}`;
  return null;
}

/** Một máy khách thử vào SSID: { ok, step, why, vlan, ip? }. Đi đúng thứ tự thật: AP → SSID → xác thực → VLAN. */
export function clientTest(net, d, { ssid, psk, user, pass } = {}) {
  const fail = (step, why) => ({ ok: false, step, why });
  if (!apsOf(net, d).some(({ ap }) => apJoined(net, d, ap.id))) return fail('ap', 'Không có AP nào join WLC nên không phát được SSID');
  const w = Object.values(d.wlc.wlans).find((x) => x.ssid === ssid);
  if (!w) return fail('ssid', `Không có WLAN nào mang SSID "${ssid}"`);
  if (!w.enabled) return fail('ssid', `WLAN ${w.id} (${w.ssid}) đang tắt nên SSID không được phát`);
  if (isPsk(w.sec) && psk !== w.psk) return fail('auth', 'Sai mật khẩu Wi-Fi: bắt tay 4 bước (4-way handshake) thất bại');
  if (w.sec === 'wpa2-ent') {
    const srv = Object.values(net.devices).find((x) => x.radius && x.ip === w.radius);
    if (!d.wlc.radius[w.radius] || !srv) return fail('auth', 'WLAN chưa trỏ tới máy chủ RADIUS hợp lệ');
    if (!N.sendPacket(net, { src: d.id, dst: srv.ip, proto: 'udp', dport: 1812 }).ok) return fail('auth', `WLC không tới được RADIUS ${srv.ip}`);
    if (d.wlc.radius[w.radius].secret !== srv.radius.secret) return fail('auth', 'Shared secret giữa WLC và RADIUS không khớp nên RADIUS bỏ qua yêu cầu');
    if (!pass || srv.radius.users[user] !== pass) return fail('auth', 'RADIUS trả Access-Reject: sai tài khoản hoặc mật khẩu');
  }
  const f = d.wlc.ifs[w.iface];
  if (!f) return fail('vlan', `WLAN gắn vào interface "${w.iface}" không tồn tại`);
  const bad = vlanPathError(net, d, f);
  if (bad) return fail('vlan', `Xác thực xong nhưng không có đường ra: ${bad}`);
  return { ok: true, step: 'done', why: `Đã kết nối ${w.ssid}, vào VLAN ${f.vlan}, gateway ${f.gw}, QoS ${w.qos}`, vlan: f.vlan };
}
/** Các AP đã join dùng kênh 2.4 GHz không chồng lấn (1/6/11) và không trùng nhau. */
export function channelsClean(net, d) {
  const ch = apsOf(net, d).map(({ channel }) => channel);
  return ch.every((c) => [1, 6, 11].includes(c)) && new Set(ch).size === ch.length;
}

const cidr = (v) => { const m = String(v).match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/); return m && N.isIp(m[1]) && +m[2] <= 32 ? { ip: m[1], prefix: +m[2] } : null; };
function kv(ws) { const o = {}; for (const w of ws) { const i = w.indexOf('='); if (i > 0) o[w.slice(0, i)] = w.slice(i + 1); } return o; }

export function makeWlc({ net, R }) {
  function applyWlan(C, w, o) {
    for (const k of ['ssid', 'iface', 'sec', 'psk', 'radius', 'qos']) if (o[k] != null) w[k] = o[k];
    if (o.isolation != null) w.isolation = o.isolation === 'yes';
    if (!w.ssid) return 'cần ssid=<tên>';
    if (!WLC_SEC[w.sec]) return 'sec=open|wpa2-psk|wpa3-sae|wpa2-ent';
    if (!WLC_QOS[w.qos]) return 'qos=platinum|gold|silver|bronze';
    if (!C.ifs[w.iface]) return `interface "${w.iface}" không tồn tại`;
    if (isPsk(w.sec) && String(w.psk || '').length < 8) return 'mật khẩu Wi-Fi cần ít nhất 8 ký tự';
    if (w.sec === 'wpa2-ent' && !C.radius[w.radius]) return `chưa khai báo RADIUS ${w.radius || ''} ở tab Security`;
    return null;
  }
  function exec(d, s, line) {
    const C = d.wlc;
    const w = line.match(/(?:[^\s"]|"[^"]*")+/g)?.map((x) => x.replace(/"/g, '')) || [];
    if (!w.length) return R([]);
    const err = (m) => R([`ERROR: ${m}`]);
    const [cmd, sub, name] = w;
    if (cmd === 'mgmt') {
      const o = kv(w.slice(1)), c = cidr(o.ip);
      if (!c || !N.isIp(o.gw)) return err('mgmt ip=a.b.c.d/nn gw=<ip>');
      d.ip = c.ip; d.prefix = c.prefix; d.gateway = o.gw;
      return R([]);
    }
    if (cmd === 'if') {
      if (sub === 'del') {
        if (Object.values(C.wlans).some((x) => x.iface === name)) return err(`interface "${name}" đang được WLAN sử dụng`);
        delete C.ifs[name];
        return R([]);
      }
      const o = kv(w.slice(3)), c = cidr(o.ip);
      if (sub !== 'add' || !name || !c || !N.isIp(o.gw) || !(+o.vlan >= 1 && +o.vlan <= 4094)) return err('if add <tên> vlan=<n> ip=a.b.c.d/nn gw=<ip>');
      C.ifs[name] = { name, vlan: +o.vlan, ip: c.ip, prefix: c.prefix, gw: o.gw };
      return R([]);
    }
    if (cmd === 'radius') {
      if (sub === 'del') { delete C.radius[name]; return R([]); }
      const o = kv(w.slice(3));
      if (sub !== 'add' || !N.isIp(name) || !o.secret) return err('radius add <ip> secret=<chuỗi>');
      C.radius[name] = { ip: name, secret: o.secret };
      return R([]);
    }
    if (cmd === 'wlan') {
      if (sub === 'add') {
        if (!/^\d+$/.test(name || '')) return err('wlan add <id> ssid=.. iface=.. sec=..');
        if (C.wlans[name]) return err(`WLAN ${name} đã tồn tại`);
        const n = { id: +name, ssid: '', iface: '', sec: 'open', psk: '', radius: '', qos: 'silver', isolation: false, enabled: false };
        const e = applyWlan(C, n, kv(w.slice(3)));
        if (e) return err(e);
        C.wlans[name] = n;
        return R([`WLAN ${name} đã tạo và đang TẮT, bật Status để phát SSID.`]);
      }
      const x = C.wlans[name];
      if (!x) return err(`không có WLAN ${name ?? ''}`);
      if (sub === 'del') { delete C.wlans[name]; return R([]); }
      if (sub === 'on' || sub === 'off') { x.enabled = sub === 'on'; return R([]); }
      if (sub === 'set') {
        const n = { ...x }, e = applyWlan(C, n, kv(w.slice(3)));
        if (e) return err(e);
        C.wlans[name] = n;
        return R([]);
      }
      return err('wlan add|set|on|off|del <id>');
    }
    if (cmd === 'ap') {
      if (!net.devices[sub]?.isAp) return err(`không có AP "${sub ?? ''}"`);
      const o = kv(w.slice(2)), c = { ...apConfig(d, sub) };
      if (o.channel != null) { if (!(+o.channel >= 1 && +o.channel <= 13)) return err('channel=1..13'); c.channel = +o.channel; }
      if (o.mode != null) { if (!['local', 'flexconnect'].includes(o.mode)) return err('mode=local|flexconnect'); c.mode = o.mode; }
      C.aps[sub] = c;
      return R([]);
    }
    if (cmd === 'client') {
      const r = clientTest(net, d, kv(w.slice(1)));
      C.lastClient = r;
      return R([r.ok ? `OK: ${r.why}` : `THẤT BẠI (${r.step}): ${r.why}`]);
    }
    if (cmd === 'show') {
      if (sub === 'wlan') return R(Object.values(C.wlans).map((x) => `${x.id} ${x.ssid} ${x.enabled ? 'BẬT' : 'TẮT'} ${WLC_SEC[x.sec]} ${x.iface} QoS ${x.qos}`));
      if (sub === 'ap') return R(apsOf(net, d).map(({ ap }) => { const c = apConfig(d, ap.id); return `${ap.name} ${apJoined(net, d, ap.id) ? 'JOINED' : 'chưa join'} kênh ${c.channel ?? '-'} ${c.mode}`; }));
      if (sub === 'if') return R([`management ${d.ip || '-'}/${d.prefix} gw ${d.gateway || '-'}`, ...Object.values(C.ifs).map((f) => `${f.name} VLAN ${f.vlan} ${f.ip}/${f.prefix} gw ${f.gw}`)]);
      if (sub === 'radius') return R(Object.keys(C.radius));
      return R(['show wlan | ap | if | radius']);
    }
    return R([`ERROR: thao tác không hợp lệ: ${cmd}`, '(Thiết bị này cấu hình bằng giao diện web, dùng các nút trên trang quản trị)']);
  }
  return { exec, prompt: () => '[WLC — trang quản trị web] ' };
}
