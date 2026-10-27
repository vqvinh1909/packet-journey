// lab/fortios.js — CLI FortiGate (FortiOS) rút gọn cho Lab: cấu hình phân cấp
//   config <bảng> → edit <tên/id> → set <khoá> <giá trị...> → next → end
// Bảng hỗ trợ: system global, system interface, router static, firewall address, firewall vip,
// firewall service custom, firewall policy (move ... before/after). Lệnh xem: show <bảng>,
// get system status, get router info routing-table all, get system session list, execute ping <ip>.
// "?" liệt kê lệnh / từ tiếp theo theo ngữ cảnh (config → edit), Tab hoàn thành lệnh (lab/vhelp.js).
// Mọi thay đổi được dựng lại vào engine (d.fw kind 'policy', NAT, route) ngay sau mỗi lệnh.

import * as N from './net.js';
import { nextChoices, completeLine } from './vhelp.js';

const BUILTIN_SVC = {
  ALL: 'any', HTTP: [{ proto: 'tcp', port: 80 }], HTTPS: [{ proto: 'tcp', port: 443 }], DNS: [{ proto: 'udp', port: 53 }, { proto: 'tcp', port: 53 }],
  PING: [{ proto: 'icmp' }], ALL_ICMP: [{ proto: 'icmp' }], SSH: [{ proto: 'tcp', port: 22 }], TELNET: [{ proto: 'tcp', port: 23 }], RDP: [{ proto: 'tcp', port: 3389 }],
  SMTP: [{ proto: 'tcp', port: 25 }], FTP: [{ proto: 'tcp', port: 21 }], MYSQL: [{ proto: 'tcp', port: 3306 }],
};
const TABLES = ['system global', 'system interface', 'router static', 'firewall address', 'firewall vip', 'firewall service custom', 'firewall policy'];
/** Tách dòng lệnh, giữ chuỗi trong ngoặc kép: set srcaddr "LAN NET" "all" → ['set','srcaddr','LAN NET','all']. */
function words(line) { return [...line.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]); }
// khoá "set" theo bảng (dùng cho "?" / Tab)
const KEYS = {
  'system global': [['hostname', 'FortiGate host name.']],
  'system interface': [['ip', 'Interface IPv4 address and subnet mask.'], ['allowaccess', 'Permitted types of management access to this interface.'], ['alias', 'Alias will be displayed with the interface name.'], ['role', 'Interface role.'], ['description', 'Description.'], ['status', 'Bring the interface up or shut the interface down.']],
  'router static': [['dst', 'Destination IP and mask for this route.'], ['gateway', 'Gateway IP for this route.'], ['device', 'Gateway out interface or tunnel.']],
  'firewall address': [['subnet', 'IP address and subnet mask of address.'], ['type', 'Type of address.'], ['start-ip', 'First IP address (inclusive) in the range.'], ['end-ip', 'Final IP address (inclusive) in the range.']],
  'firewall vip': [['extip', 'IP address or address range on the external interface.'], ['mappedip', 'IP address or address range on the destination network.'], ['extintf', 'Interface connected to the source network.'], ['portforward', 'Enable/disable port forwarding.'], ['protocol', 'Protocol to use when forwarding packets.'], ['extport', 'Incoming port number range.'], ['mappedport', 'Port number range on the destination network.']],
  'firewall service custom': [['tcp-portrange', 'Multiple TCP port ranges.'], ['udp-portrange', 'Multiple UDP port ranges.']],
  'firewall policy': [['name', 'Policy name.'], ['srcintf', 'Incoming (ingress) interface.'], ['dstintf', 'Outgoing (egress) interface.'], ['srcaddr', 'Source IPv4 address and address group names.'], ['dstaddr', 'Destination IPv4 address and address group names.'], ['service', 'Service and service group names.'], ['action', 'Policy action (accept/deny).'], ['nat', 'Enable/disable source NAT.'], ['schedule', 'Schedule name.'], ['status', 'Enable or disable this policy.'], ['logtraffic', 'Enable or disable logging.'], ['comments', 'Comment.']],
};
const WORDS = {
  config: 'Configure object.', get: 'Get dynamic and system information.', show: 'Show configuration.', execute: 'Execute static commands.',
  system: 'Configure system.', router: 'Configure router.', firewall: 'Configure firewall.', info: 'Show routing information.', 'routing-table': 'Routing table.',
  service: 'Configure service.', set: 'Modify value.', unset: 'Set to default value.', move: 'Move this entry.',
  'get system': 'Show system information.', 'get router': 'Show router information.', 'get router info': 'Show routing information.', 'execute ping': 'PING command.',
  'show system': 'Show system configuration.', 'show router': 'Show router configuration.', 'show firewall': 'Show firewall configuration.',
};
const q = (v) => (/^\d+$/.test(v) ? v : `"${v}"`);

export function makeForti(h) {
  const { net, R } = h;
  const cfgOf = (d) => (d.forti ||= { hostname: d.name, intf: {}, routes: {}, addr: {}, vip: {}, svc: {}, pol: {}, order: [] });

  // ---------------------------------------------------------------- dựng engine từ cấu hình FortiOS
  function rebuild(d) {
    const F = cfgOf(d);
    d.name = F.hostname || d.name;
    for (const [p, i] of Object.entries(F.intf)) {
      const f = d.ifaces[p];
      if (!f) continue;
      f.ip = i.ip || null; f.prefix = i.ip ? i.prefix : null; f.shutdown = i.status === 'down';
      f.nat = null;
    }
    d.routes = Object.values(F.routes).filter((r) => r.gateway && r.device).map((r) => ({ net: r.dst?.ip || '0.0.0.0', prefix: r.dst?.prefix ?? 0, nh: r.gateway, iface: r.device, ad: 10 }));
    // VIP = DNAT tĩnh (có thể kèm port forward); cổng extintf đánh dấu "outside" để FortiGate trả ARP cho IP VIP
    d.nat.statics = [];
    for (const v of Object.values(F.vip)) {
      if (!v.extip || !v.mappedip) continue;
      if (d.ifaces[v.extintf]) d.ifaces[v.extintf].nat = 'outside';
      d.nat.statics.push(v.portforward === 'enable' ? { proto: v.protocol || 'tcp', local: v.mappedip, lport: +v.mappedport, global: v.extip, gport: +v.extport } : { local: v.mappedip, global: v.extip });
    }
    d.fw.ruleWord = 'policy';
    d.fw.implicitWord = 'Implicit Deny (policy ID 0)';
    d.fw.rules = F.order.map((id) => F.pol[id]).filter(Boolean).map((p) => ({
      id: p.id, name: p.name || `ID ${p.id}`, disabled: p.status === 'disable',
      from: p.srcintf || [], to: p.dstintf || [],
      src: addrSpec(F, p.srcaddr), dst: addrSpec(F, p.dstaddr), svc: svcSpec(F, p.service),
      action: p.action === 'accept' ? 'accept' : 'deny', nat: p.nat === 'enable',
    }));
  }
  function addrSpec(F, names = []) {
    if (!names.length) return [{ host: '0.0.0.0/none' }]; // policy thiếu srcaddr/dstaddr không khớp gì
    if (names.includes('all')) return 'any';
    return names.flatMap((n) => {
      const a = F.addr[n];
      if (a) return a.type === 'iprange' ? [{ from: a.start, to: a.end }] : a.subnet ? [{ net: a.subnet.ip, prefix: a.subnet.prefix }] : [];
      const v = F.vip[n];
      if (v) return [{ host: v.mappedip }]; // VIP: FortiGate dịch đích TRƯỚC khi khớp policy
      return [];
    });
  }
  function svcSpec(F, names = []) {
    if (!names.length) return [{ proto: 'none' }];
    if (names.includes('ALL')) return 'any';
    return names.flatMap((n) => {
      if (BUILTIN_SVC[n]) return BUILTIN_SVC[n] === 'any' ? [{ proto: 'ip' }] : BUILTIN_SVC[n];
      const c = F.svc[n];
      if (!c) return [];
      const r = (txt, proto) => (txt ? txt.split(/\s+/).map((x) => { const [a, b] = x.split('-').map(Number); return { proto, port: a, ...(b ? { port2: b } : {}) }; }) : []);
      return [...r(c['tcp-portrange'], 'tcp'), ...r(c['udp-portrange'], 'udp')];
    });
  }

  // ---------------------------------------------------------------- set / unset theo bảng
  function setKey(d, table, obj, key, vals, F) {
    const v0 = vals[0];
    const need = (ok) => (ok ? null : 'entry not found in datasource');
    const ipm = () => { if (!N.isIp(vals[0]) || !N.isIp(vals[1])) return null; try { return { ip: N.netOf(vals[0], N.maskToPrefix(vals[1])), prefix: N.maskToPrefix(vals[1]), host: vals[0] }; } catch { return null; } };
    switch (table) {
      case 'system global': if (key === 'hostname' && v0) { F.hostname = v0; return null; } break;
      case 'system interface':
        if (key === 'ip') { const m = ipm(); if (!m) return 'invalid ip/netmask'; obj.ip = m.host; obj.prefix = m.prefix; return null; }
        if (['allowaccess', 'alias', 'role', 'description'].includes(key)) { obj[key] = vals.join(' '); return null; }
        if (key === 'status' && ['up', 'down'].includes(v0)) { obj.status = v0; return null; }
        break;
      case 'router static':
        if (key === 'gateway' && N.isIp(v0)) { obj.gateway = v0; return null; }
        if (key === 'device') return need(d.ifaces[v0]) || ((obj.device = v0), null);
        if (key === 'dst') { const m = ipm(); if (!m) return 'invalid ip/netmask'; obj.dst = m; return null; }
        break;
      case 'firewall address':
        if (key === 'subnet') { const m = ipm(); if (!m) return 'invalid ip/netmask'; obj.subnet = { ip: m.ip, prefix: m.prefix }; obj.type = 'ipmask'; return null; }
        if (key === 'type' && ['ipmask', 'iprange'].includes(v0)) { obj.type = v0; return null; }
        if (key === 'start-ip' && N.isIp(v0)) { obj.start = v0; return null; }
        if (key === 'end-ip' && N.isIp(v0)) { obj.end = v0; return null; }
        break;
      case 'firewall vip':
        if (['extip', 'mappedip'].includes(key) && N.isIp(v0)) { obj[key] = v0; return null; }
        if (key === 'extintf') return need(d.ifaces[v0]) || ((obj.extintf = v0), null);
        if (key === 'portforward' && ['enable', 'disable'].includes(v0)) { obj.portforward = v0; return null; }
        if (['extport', 'mappedport'].includes(key) && /^\d+$/.test(v0)) { obj[key] = v0; return null; }
        if (key === 'protocol' && ['tcp', 'udp'].includes(v0)) { obj.protocol = v0; return null; }
        break;
      case 'firewall service custom':
        if (['tcp-portrange', 'udp-portrange'].includes(key) && vals.every((x) => /^\d+(-\d+)?$/.test(x))) { obj[key] = vals.join(' '); return null; }
        break;
      case 'firewall policy':
        if (['srcintf', 'dstintf'].includes(key)) { const bad = vals.find((x) => !d.ifaces[x] && x !== 'any'); if (bad) return need(false); obj[key] = vals; return null; }
        if (['srcaddr', 'dstaddr'].includes(key)) { const bad = vals.find((x) => x !== 'all' && !F.addr[x] && !F.vip[x]); if (bad) return need(false); obj[key] = vals; return null; }
        if (key === 'service') { const bad = vals.find((x) => !BUILTIN_SVC[x] && !F.svc[x]); if (bad) return need(false); obj.service = vals; return null; }
        if (key === 'action' && ['accept', 'deny'].includes(v0)) { obj.action = v0; return null; }
        if (key === 'nat' && ['enable', 'disable'].includes(v0)) { obj.nat = v0; return null; }
        if (key === 'status' && ['enable', 'disable'].includes(v0)) { obj.status = v0; return null; }
        if (['name', 'schedule', 'logtraffic', 'comments'].includes(key)) { obj[key] = vals.join(' '); return null; }
        break;
      default:
    }
    return 'Command fail. Return code -61';
  }
  const tableOf = (F, t) => ({ 'system interface': F.intf, 'router static': F.routes, 'firewall address': F.addr, 'firewall vip': F.vip, 'firewall service custom': F.svc, 'firewall policy': F.pol }[t]);

  // ---------------------------------------------------------------- show
  function showTable(d, t) {
    const F = cfgOf(d);
    if (t === 'system global') return ['config system global', `    set hostname "${F.hostname}"`, 'end'];
    const tb = tableOf(F, t);
    if (!tb) return ['Command fail. Return code -61'];
    const ids = t === 'firewall policy' ? F.order : Object.keys(tb);
    const L = [`config ${t}`];
    for (const id of ids) {
      const o = tb[id];
      L.push(`    edit ${q(id)}`);
      for (const [k, v] of Object.entries(o)) {
        if (k === 'id' || v == null) continue;
        const txt = k === 'ip' && t === 'system interface' ? `${v} ${N.prefixToMask(o.prefix)}` : k === 'prefix' ? null : k === 'subnet' ? `${v.ip} ${N.prefixToMask(v.prefix)}` : k === 'dst' ? `${v.ip} ${N.prefixToMask(v.prefix)}` : Array.isArray(v) ? v.map((x) => `"${x}"`).join(' ') : k === 'start' || k === 'end' ? null : /^\d+$/.test(String(v)) || ['enable', 'disable', 'accept', 'deny', 'up', 'down', 'ipmask', 'iprange', 'tcp', 'udp'].includes(v) || N.isIp(String(v)) ? v : `"${v}"`;
        if (txt != null) L.push(`        set ${k === 'start' ? 'start-ip' : k === 'end' ? 'end-ip' : k} ${txt}`);
      }
      if (o.start) L.push(`        set start-ip ${o.start}`, `        set end-ip ${o.end}`);
      L.push('    next');
    }
    L.push('end');
    return L;
  }
  function showRoutes(d) {
    const rt = N.routeTable(N.makeCtx(net), d.id);
    const L = ['Routing table for VRF=0', 'Codes: K - kernel, C - connected, S - static, R - RIP, B - BGP, O - OSPF', '       * - candidate default', ''];
    for (const r of rt) {
      if (r.code === 'L') continue;
      L.push(r.code === 'C' ? `C       ${r.net}/${r.prefix} is directly connected, ${r.iface}` : `${r.prefix === 0 ? 'S*' : 'S '}      ${r.net}/${r.prefix} [${r.ad}/0] via ${r.nextHop}, ${r.iface}, [1/0]`);
    }
    return L;
  }
  function showSessions(d) {
    const col = (x, n) => String(x).padEnd(n - 1) + ' ';
    const L = [col('PROTO', 8) + col('EXPIRE', 7) + col('SOURCE', 20) + col('SOURCE-NAT', 20) + col('DESTINATION', 20) + 'DESTINATION-NAT'];
    for (const c of d.fw.conns || []) {
      const sn = (d.natTable || []).find((e) => e.il === c.src && e.outside === c.dst && e.proto === c.proto);
      const dn = d.nat.statics.find((x) => x.local === c.dst && (!x.proto || x.lport === c.dport));
      const sp = c.sport ?? 8;
      L.push(col(c.proto, 8) + col(c.proto === 'tcp' ? 3599 : 59, 7) + col(`${c.src}:${sp}`, 20) + col(sn ? `${sn.ig}:${sn.port}` : '-', 20) + col(`${dn ? dn.global : c.dst}:${dn?.gport ?? c.dport ?? 0}`, 20) + (dn ? `${c.dst}:${c.dport ?? 0}` : '-'));
    }
    return L;
  }
  function fortiPing(d, ip) {
    const r = N.sendPacket(net, { src: d.id, dst: ip, record: true });
    const L = [`PING ${ip} (${ip}): 56 data bytes`];
    if (r.ok) for (let i = 0; i < 5; i++) L.push(`64 bytes from ${ip}: icmp_seq=${i} ttl=${r.ttl} time=0.${4 + i} ms`);
    L.push('', `--- ${ip} ping statistics ---`, `5 packets transmitted, ${r.ok ? 5 : 0} packets received, ${r.ok ? 0 : 100}% packet loss`);
    return R(L, { why: r.ok ? null : r.fail?.why, ok: r.ok });
  }

  // ---------------------------------------------------------------- thực thi 1 dòng
  function exec(d, s, line) {
    if (line.endsWith('?')) return help(d, s, line.slice(0, -1));
    const F = cfgOf(d);
    const w = words(line);
    if (!w.length) return R([]);
    const st = (s.fz ||= { table: null, edit: null });
    const cmd = w[0].toLowerCase();
    const out = (lines) => { rebuild(d); return R(lines); };
    if (cmd === 'config') {
      const t = w.slice(1).join(' ');
      if (!TABLES.includes(t)) return R(['Command fail. Return code -61', `(Lab: bảng hỗ trợ: ${TABLES.join(' · ')})`]);
      st.table = t; st.edit = null;
      return R([]);
    }
    if (cmd === 'end') { st.table = null; st.edit = null; return out([]); }
    if (cmd === 'next') { if (!st.edit) return R(['Command fail. Return code -61']); st.edit = null; return out([]); }
    if (cmd === 'edit') {
      if (!st.table || st.table === 'system global') return R(['Command fail. Return code -61']);
      const tb = tableOf(F, st.table);
      const name = w[1];
      if (!name) return R(['Command fail. Return code -61']);
      if (st.table === 'system interface' && !d.ifaces[name]) return R(['entry not found in datasource', `(Lab: cổng có trên thiết bị: ${Object.keys(d.ifaces).join(', ')})`]);
      if (st.table === 'firewall policy') {
        let id = name;
        if (id === '0') id = String(Math.max(0, ...F.order.map(Number)) + 1); // edit 0 = tạo policy ID mới
        if (!/^\d+$/.test(id)) return R(['Command fail. Return code -61', '(Lab: policy dùng ID số, vd edit 1)']);
        if (!tb[id]) { tb[id] = { id, action: 'deny' }; F.order.push(id); }
        st.edit = id;
        return R(id !== name ? [`(Lab: tạo policy ID ${id})`] : []);
      }
      tb[name] ||= st.table === 'router static' ? {} : {};
      st.edit = name;
      return R([]);
    }
    if (cmd === 'set' || cmd === 'unset') {
      if (!st.table) return R(['Command fail. Return code -61']);
      const obj = st.table === 'system global' ? F : tableOf(F, st.table)?.[st.edit];
      if (!obj) return R(['Command fail. Return code -61', '(Lab: cần "edit <tên>" trước)']);
      if (cmd === 'unset') { delete obj[w[1]]; return out([]); }
      const err = setKey(d, st.table, obj, w[1], w.slice(2), F);
      if (err) return R([err, 'value parse error before \'' + (w[2] || '') + '\'', 'Command fail. Return code -61']);
      return out([]);
    }
    if (cmd === 'delete' && st.table && !st.edit) {
      const tb = tableOf(F, st.table);
      if (!tb?.[w[1]]) return R(['entry not found in datasource']);
      delete tb[w[1]];
      if (st.table === 'firewall policy') F.order = F.order.filter((x) => x !== w[1]);
      return out([]);
    }
    if (cmd === 'move' && st.table === 'firewall policy' && !st.edit) {
      const [, a, where, b] = w;
      if (!F.pol[a] || !F.pol[b] || !['before', 'after'].includes(where)) return R(['Command fail. Return code -61', '(Lab: move <ID> before|after <ID>)']);
      F.order = F.order.filter((x) => x !== a);
      F.order.splice(F.order.indexOf(b) + (where === 'after' ? 1 : 0), 0, a);
      return out([]);
    }
    if (cmd === 'show') {
      if (st.table && w.length === 1) return R(showTable(d, st.table));
      const t = w.slice(1).join(' ');
      if (TABLES.includes(t)) return R(showTable(d, t));
      return R(['Command fail. Return code -61']);
    }
    if (cmd === 'get' && /^router info routing-table( all)?$/.test(w.slice(1).join(' '))) return R(showRoutes(d));
    if (cmd === 'get' && w.slice(1).join(' ').toLowerCase() === 'system status') return R(sysStatus(d));
    if (cmd === 'get' && w.slice(1).join(' ') === 'system session list') return R(showSessions(d));
    if (cmd === 'execute' && w[1] === 'ping' && N.isIp(w[2])) return fortiPing(d, w[2]);
    if (cmd === 'abort' && st.edit) { st.edit = null; return R([]); }
    return R(['Unknown action 0', 'Command fail. Return code -61']);
  }
  // ---------------------------------------------------------------- get system status, "?" và Tab
  function sysStatus(d) {
    const sn = 'FGVMEV' + [...d.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36).toUpperCase().padStart(8, '0').slice(-8);
    const t = new Date(N.clock.now());
    const day = t.toUTCString().slice(0, 3), mon = t.toUTCString().slice(8, 11), two = (n) => String(n).padStart(2, '0');
    return ['Version: FortiGate-VM64 v7.4.4,build2662,240514 (GA.F)', 'Security Level: 1', 'Firmware Signature: certified', 'Virus-DB: 92.07160(2024-10-01 15:35)', 'IPS-DB: 6.00741(2015-12-01 02:30)',
      `Serial-Number: ${sn}`, 'License Status: Valid', 'VM Resources: 1 CPU/1 allowed, 2007 MB RAM', 'Log hard disk: Not available', `Hostname: ${cfgOf(d).hostname || d.name}`, 'Private Encryption: Disable',
      'Operation Mode: NAT', 'Current virtual domain: root', 'Max number of virtual domains: 1', 'Virtual domains status: 1 in NAT mode, 0 in TP mode', 'Virtual domain configuration: disable',
      'FIPS-CC mode: disable', 'Current HA mode: standalone', 'Branch point: 2662', 'Release Version Information: GA', 'FortiOS x86-64: Yes',
      `System time: ${day} ${mon} ${two(t.getUTCDate())} ${two(t.getUTCHours())}:${two(t.getUTCMinutes())}:${two(t.getUTCSeconds())} ${t.getUTCFullYear()}`, 'Last reboot reason: power cycle'];
  }
  /** Cây lệnh dùng được ở ngữ cảnh hiện tại (gốc / trong "config <bảng>" / trong "edit"). */
  function entries(s) {
    const st = s.fz || {};
    const keys = KEYS[st.table] || [];
    const setE = keys.flatMap(([k, ds]) => [[`set ${k} <value...>`, ds], [`unset ${k}`, ds]]);
    if (st.table && (st.edit || st.table === 'system global')) return [...setE, ['show', 'Show configuration.'], ['next', 'Configure next table entry.'], ['abort', 'End and discard last config.'], ['end', 'End and save last config.']];
    if (st.table) {
      const L = [['edit <name>', 'Create new table entry or edit existing one.'], ['delete <name>', 'Delete table entry.'], ['show', 'Show configuration.'], ['end', 'End and save last config.']];
      if (st.table === 'firewall policy') L.push(['move <id> before <id>', 'Move this entry.'], ['move <id> after <id>', 'Move this entry.'], ['edit 0', 'Create a new policy with the next free ID.']);
      return L;
    }
    return [...TABLES.map((t) => [`config ${t}`, `Configure ${t}.`]), ...TABLES.map((t) => [`show ${t}`, `Show ${t} configuration.`]),
      ['get system status', 'System status.'], ['get system session list', 'List system sessions.'], ['get router info routing-table all', 'Show all routing table entries.'], ['execute ping <ip>', 'Send ICMP ECHO_REQUEST packets to network hosts.']];
  }
  function help(d, s, text) {
    const L = nextChoices(entries(s), text, WORDS);
    if (!L.length) return R(['command parse error before \'' + (text.trim().split(/\s+/).pop() || '?') + '\'', 'Command fail. Return code -61']);
    const w = Math.max(...L.map((x) => x.word.length)) + 4;
    return R(L.map((x) => (x.word === '<Enter>' ? '<Enter>' : x.word.padEnd(w) + x.desc)));
  }
  function complete(d, s, line) { return completeLine(entries(s), line); }

  function prompt(d, s) {
    const st = s.fz || {};
    const h = cfgOf(d).hostname || d.name;
    if (st.edit) return `${h} (${st.edit}) # `;
    if (st.table) return `${h} (${st.table.split(' ').pop()}) # `;
    return `${h} # `;
  }
  return { exec, prompt, rebuild, complete };
}
