// lab/guifw.js — firewall cấu hình bằng GIAO DIỆN WEB: Sophos XG (SFOS), Check Point (SmartConsole),
// pfSense. Trang quản trị giả lập (ui/guifw.js) sinh ra các "lệnh thao tác" dưới đây; lời giải lab,
// nhật ký và khôi phục dùng chung đúng các lệnh này. Engine: d.fw kind 'policy' (lab/fw.js).
//
//   if <cổng> ip=<a.b.c.d/nn> zone=<ZONE>          — gán IP + zone/vai trò cho cổng
//   gw <ip>                                         — default gateway
//   obj <tên> <ip | ip/nn>                          — đối tượng host / network
//   svc <tên> <tcp|udp> <port>                      — dịch vụ tự định nghĩa
//   rule add <tên> from=.. to=.. src=.. dst=.. svc=.. action=accept|drop [nat=masq] [pos=top|before:<tên>]
//   rule del|toggle <tên> · rule move <tên> top|bottom|before <tên>|after <tên>
//   nat add <tên> type=snat from=.. to=.. src=..    — NAT nguồn (MASQ / Hide / Outbound)
//   nat add <tên> type=dnat ext=<ip|wan> int=<ip|obj> [proto=tcp ext_port=8080 int_port=80] [rule=yes]
//   nat del <tên> · outbound manual|automatic (pfSense)
//   install (Check Point) · apply (pfSense) · show rules|nat|ifaces|sessions
// Danh sách nhiều giá trị ngăn bằng dấu phẩy; "any" = mọi thứ.

import * as N from './net.js';

export const GUI_VENDORS = {
  sophos: { name: 'Sophos Firewall', commit: null, zones: ['LAN', 'WAN', 'DMZ'], ruleWord: 'firewall rule', implicit: 'không rule nào khớp → DROP mặc định (Sophos chặn mọi traffic chưa được cho phép)' },
  checkpoint: { name: 'Check Point', commit: 'install', zones: ['internal', 'external', 'dmz'], ruleWord: 'rule', implicit: 'Cleanup rule (Any → Any → Drop) ở cuối rulebase' },
  pfsense: { name: 'pfSense', commit: 'apply', zones: ['WAN', 'LAN', 'OPT1'], ruleWord: 'rule', implicit: 'mặc định CHẶN (Default deny rule) trên cổng nhận gói' },
  wlc: { name: 'Wireless LAN Controller', commit: null }, // không phải firewall: dùng chung cơ chế trang web, xem lab/wlc.js
};
export const GUI_SVC = {
  any: 'any', HTTP: [{ proto: 'tcp', port: 80 }], HTTPS: [{ proto: 'tcp', port: 443 }], DNS: [{ proto: 'udp', port: 53 }, { proto: 'tcp', port: 53 }],
  PING: [{ proto: 'icmp' }], SSH: [{ proto: 'tcp', port: 22 }], TELNET: [{ proto: 'tcp', port: 23 }], RDP: [{ proto: 'tcp', port: 3389 }], MYSQL: [{ proto: 'tcp', port: 3306 }],
};
const clone = (o) => JSON.parse(JSON.stringify(o));
const list = (v) => (v == null || v === '' ? ['any'] : String(v).split(',').map((x) => x.trim()).filter(Boolean));
const cidr = (v) => { const m = String(v).match(/^(\d+\.\d+\.\d+\.\d+)(?:\/(\d+))?$/); return m && N.isIp(m[1]) ? { ip: m[1], prefix: m[2] != null ? +m[2] : 32 } : null; };
/** "a=b c=d" → { a: 'b', c: 'd' } (giữ nguyên phần không có dấu =). */
function kv(ws) { const o = {}, rest = []; for (const w of ws) { const i = w.indexOf('='); if (i > 0) o[w.slice(0, i)] = w.slice(i + 1); else rest.push(w); } return [o, rest]; }

function emptyCfg(d) {
  const v = d.os;
  const cfg = { ifs: {}, gw: null, objs: {}, svcs: {}, rules: [], nat: [], outbound: 'automatic' };
  // pfSense xuất xưởng: LAN có sẵn rule "Default allow LAN to any"
  if (v === 'pfsense') cfg.rules.push({ name: 'Default allow LAN to any', from: ['LAN'], to: ['any'], src: ['LAN net'], dst: ['any'], svc: ['any'], action: 'accept', builtin: true });
  return cfg;
}
export function gfwOf(d) {
  if (!d.gfw) { const c = emptyCfg(d); d.gfw = { cand: c, live: clone(c) }; }
  return d.gfw;
}
/** Cấu hình đang hiệu lực: Sophos áp ngay; Check Point / pfSense chỉ sau install / apply. */
const activeOf = (d) => (GUI_VENDORS[d.os].commit ? gfwOf(d).live : gfwOf(d).cand);
export const pending = (d) => !!GUI_VENDORS[d.os]?.commit && JSON.stringify(gfwOf(d).cand) !== JSON.stringify(gfwOf(d).live);

// ---------------------------------------------------------------- dựng engine
export function rebuild(d) {
  const V = GUI_VENDORS[d.os];
  const C = activeOf(d);
  const ifs = gfwOf(d).cand.ifs; // IP/cổng áp ngay (như cấu hình interface qua wizard)
  for (const [k, f] of Object.entries(d.ifaces)) {
    const i = ifs[k];
    f.ip = i?.ip || null; f.prefix = i ? i.prefix : null; f.shutdown = !i; f.zone = i?.zone || null; f.nat = null;
  }
  const g = gfwOf(d).cand.gw;
  d.routes = g ? [{ net: '0.0.0.0', prefix: 0, nh: g, iface: null, ad: 1 }] : [];
  const netOfZone = (z) => Object.values(ifs).filter((i) => i.zone === z && i.ip).map((i) => ({ net: N.netOf(i.ip, i.prefix), prefix: i.prefix }));
  const spec = (names) => {
    if (names.includes('any')) return 'any';
    return names.flatMap((n) => {
      if (/ net$/.test(n)) return netOfZone(n.replace(/ net$/, '')); // pfSense "LAN net"
      if (/ address$/.test(n)) { const z = n.replace(/ address$/, ''); return Object.values(ifs).filter((i) => i.zone === z && i.ip).map((i) => ({ host: i.ip })); }
      const o = C.objs[n] || cidr(n);
      return o ? [{ net: N.netOf(o.ip, o.prefix), prefix: o.prefix }] : [{ host: 'none' }];
    });
  };
  const svc = (names) => (names.includes('any') ? 'any' : names.flatMap((n) => (GUI_SVC[n] && GUI_SVC[n] !== 'any' ? GUI_SVC[n] : C.svcs[n] ? [C.svcs[n]] : [])));
  d.fw.ruleWord = V.ruleWord;
  d.fw.implicitWord = V.implicit;
  d.fw.rules = C.rules.map((r) => ({ name: r.name, disabled: !!r.disabled, from: r.from, to: r.to, src: spec(r.src), dst: spec(r.dst), svc: svc(r.svc), action: r.action === 'accept' ? 'accept' : 'drop', nat: r.nat === 'masq' }));
  // NAT nguồn: rule NAT riêng; pfSense "Automatic outbound NAT" = mọi mạng nội bộ ra WAN tự NAT
  const sn = C.nat.filter((n) => n.type === 'snat').map((n) => ({ name: n.name, from: n.from, to: n.to, src: spec(n.src), dst: 'any', natIp: 'iface' }));
  if (d.os === 'pfsense' && C.outbound === 'automatic') sn.push({ name: 'Auto created rule', from: 'any', to: ['WAN'], src: Object.values(ifs).filter((i) => i.zone !== 'WAN' && i.ip).map((i) => ({ net: N.netOf(i.ip, i.prefix), prefix: i.prefix })), dst: 'any', natIp: 'iface' });
  d.fw.natRules = sn;
  d.nat.statics = [];
  for (const n of C.nat.filter((x) => x.type === 'dnat')) {
    const wanK = Object.keys(ifs).find((k) => ['WAN', 'external'].includes(ifs[k].zone));
    const ext = n.ext === 'wan' || n.ext === 'interface' ? ifs[wanK]?.ip : n.ext;
    const loc = C.objs[n.int]?.ip || n.int;
    if (!ext || !N.isIp(loc)) continue;
    if (wanK) d.ifaces[wanK].nat = 'outside';
    d.nat.statics.push(n.proto ? { proto: n.proto, local: loc, lport: +n.int_port, global: ext, gport: +n.ext_port } : { local: loc, global: ext });
  }
}

// ---------------------------------------------------------------- lệnh thao tác
function rulePos(rules, r, pos) {
  if (!pos || pos === 'bottom') {
    // pfSense / Check Point: rule mới thêm vào cuối (nhưng trước rule mặc định nếu có)
    rules.push(r); return null;
  }
  if (pos === 'top') { rules.unshift(r); return null; }
  const m = pos.match(/^(before|after):(.+)$/);
  if (!m) return 'vị trí không hợp lệ (top | bottom | before:<tên> | after:<tên>)';
  const j = rules.findIndex((x) => x.name === m[2]);
  if (j < 0) return `không có rule "${m[2]}"`;
  rules.splice(j + (m[1] === 'after' ? 1 : 0), 0, r);
  return null;
}
export function makeGuiFw(h) {
  const { R } = h;
  function exec(d, s, line) {
    const V = GUI_VENDORS[d.os];
    const G = gfwOf(d);
    const C = G.cand;
    const w = line.match(/(?:[^\s"]|"[^"]*")+/g)?.map((x) => x.replace(/"/g, '')) || []; // key="a b" giữ 1 từ
    if (!w.length) return R([]);
    const ok = (msg) => { rebuild(d); return R(msg ? [msg] : []); };
    const err = (m) => R([`ERROR: ${m}`]);
    const [cmd, sub] = w;
    if (cmd === 'if') {
      const k = w[1];
      if (!d.ifaces[k]) return err(`cổng "${k}" không tồn tại (có: ${Object.keys(d.ifaces).join(', ')})`);
      const [o] = kv(w.slice(2));
      const c = cidr(o.ip);
      if (!c || !String(o.ip).includes('/')) return err('ip=a.b.c.d/nn');
      C.ifs[k] = { ip: c.ip, prefix: c.prefix, zone: o.zone || V.zones[0] };
      return ok();
    }
    if (cmd === 'gw') { if (!N.isIp(w[1])) return err('gw <ip>'); C.gw = w[1]; return ok(); }
    if (cmd === 'obj') { const c = cidr(w[2]); if (!w[1] || !c) return err('obj <tên> <ip | ip/nn>'); C.objs[w[1]] = c; return ok(); }
    if (cmd === 'svc') { if (!w[1] || !['tcp', 'udp'].includes(w[2]) || !/^\d+$/.test(w[3] || '')) return err('svc <tên> tcp|udp <port>'); C.svcs[w[1]] = { proto: w[2], port: +w[3] }; return ok(); }
    if (cmd === 'rule') {
      const name = w[2];
      const r = C.rules.find((x) => x.name === name);
      if (sub === 'add' || sub === 'set') {
        if (!name) return err('rule add <tên> ...');
        if (sub === 'add' && r) return err(`rule "${name}" đã tồn tại`);
        if (sub === 'set' && !r) return err(`không có rule "${name}"`);
        const [o] = kv(w.slice(3));
        const t = r || { name, from: ['any'], to: ['any'], src: ['any'], dst: ['any'], svc: ['any'], action: 'drop' };
        for (const k of ['from', 'to', 'src', 'dst', 'svc']) if (o[k] != null) t[k] = list(o[k]);
        if (o.action) { if (!['accept', 'drop'].includes(o.action)) return err('action=accept|drop'); t.action = o.action; }
        if (o.nat != null) t.nat = o.nat === 'masq' ? 'masq' : null;
        for (const sv of t.svc) if (sv !== 'any' && !GUI_SVC[sv] && !C.svcs[sv]) return err(`dịch vụ "${sv}" không tồn tại`);
        for (const a of [...t.src, ...t.dst]) if (a !== 'any' && !C.objs[a] && !cidr(a) && !/ (net|address)$/.test(a)) return err(`đối tượng "${a}" không tồn tại`);
        if (!r) { const e = rulePos(C.rules, t, o.pos); if (e) return err(e); }
        return ok();
      }
      if (!r) return err(`không có rule "${name}"`);
      if (sub === 'del') { C.rules = C.rules.filter((x) => x !== r); return ok(); }
      if (sub === 'toggle') { r.disabled = !r.disabled; return ok(); }
      if (sub === 'move') {
        C.rules = C.rules.filter((x) => x !== r);
        const e = rulePos(C.rules, r, w[3] === 'top' || w[3] === 'bottom' ? w[3] : `${w[3]}:${w[4]}`);
        if (e) { C.rules.push(r); return err(e); }
        return ok();
      }
      return err('rule add|set|del|toggle|move');
    }
    if (cmd === 'nat') {
      const name = w[2];
      if (sub === 'del') { if (!C.nat.some((x) => x.name === name)) return err(`không có NAT "${name}"`); C.nat = C.nat.filter((x) => x.name !== name); C.rules = C.rules.filter((x) => x.autoFor !== name); return ok(); }
      if (sub !== 'add' || !name) return err('nat add <tên> type=snat|dnat ...');
      if (C.nat.some((x) => x.name === name)) return err(`NAT "${name}" đã tồn tại`);
      const [o] = kv(w.slice(3));
      if (o.type === 'snat') C.nat.push({ name, type: 'snat', from: list(o.from), to: list(o.to), src: list(o.src) });
      else if (o.type === 'dnat') {
        if (!o.ext || !o.int) return err('dnat cần ext=<ip|wan> int=<ip|obj>');
        const n = { name, type: 'dnat', ext: o.ext, int: o.int };
        if (o.proto) { if (!/^\d+$/.test(o.ext_port || '') || !/^\d+$/.test(o.int_port || '')) return err('port forward cần ext_port=<n> int_port=<n>'); Object.assign(n, { proto: o.proto, ext_port: o.ext_port, int_port: o.int_port }); }
        C.nat.push(n);
        // pfSense: "Filter rule association" → tự tạo rule cho phép trên WAN tới IP thật
        if (o.rule === 'yes') {
          const svcName = o.proto ? `PF_${name}` : 'any';
          if (o.proto) C.svcs[svcName] = { proto: o.proto, port: +o.int_port };
          C.rules.push({ name: `NAT ${name}`, from: ['WAN'], to: ['any'], src: ['any'], dst: [o.int], svc: [svcName], action: 'accept', autoFor: name });
        }
      } else return err('type=snat|dnat');
      return ok();
    }
    if (cmd === 'outbound' && d.os === 'pfsense' && ['manual', 'automatic'].includes(sub)) { C.outbound = sub; return ok(); }
    if (cmd === V.commit) {
      G.live = clone(C);
      rebuild(d);
      return R([d.os === 'checkpoint' ? 'Install Policy: Standard → gateway ' + d.name + ' … Succeeded' : 'The changes have been applied successfully.']);
    }
    if (cmd === 'show') return R(showTxt(d, sub));
    return R([`ERROR: thao tác không hợp lệ: ${cmd}`, '(Lab: thiết bị này cấu hình bằng giao diện web — dùng các nút trên trang quản trị)']);
  }
  function showTxt(d, what) {
    const G = gfwOf(d), A = activeOf(d);
    if (what === 'rules') return [...A.rules.map((r, i) => `${i + 1}. ${r.disabled ? '(tắt) ' : ''}${r.name}: ${r.from.join(',')} → ${r.to.join(',')} | ${r.src.join(',')} → ${r.dst.join(',')} | ${r.svc.join(',')} | ${r.action.toUpperCase()}${r.nat ? ' + MASQ' : ''}`), `—. ${GUI_VENDORS[d.os].implicit}`, ...(pending(d) ? ['(có thay đổi CHƯA ' + (d.os === 'checkpoint' ? 'Install Policy' : 'Apply') + ')'] : [])];
    if (what === 'nat') return A.nat.map((n) => (n.type === 'snat' ? `SNAT ${n.name}: ${n.from} → ${n.to} src ${n.src}` : `DNAT ${n.name}: ${n.ext}${n.proto ? ':' + n.ext_port : ''} → ${n.int}${n.proto ? ':' + n.int_port : ''}`));
    if (what === 'ifaces') return Object.entries(G.cand.ifs).map(([k, i]) => `${k}: ${i.ip}/${i.prefix} (${i.zone})`);
    if (what === 'sessions') return (d.fw.conns || []).map((c) => `${c.proto} ${c.src}:${c.sport ?? 8} → ${c.dst}:${c.dport ?? 0}`);
    return ['show rules | nat | ifaces | sessions'];
  }
  const prompt = (d) => `[${GUI_VENDORS[d.os].name} — trang quản trị web] `;
  return { exec, prompt, rebuild };
}
