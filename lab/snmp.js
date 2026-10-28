// lab/snmp.js — SNMP agent trên router/switch Cisco (v1/v2c community + ACL, v3 group/user auth/priv, location/contact,
// trap host) và công cụ quản trị kiểu net-snmp trên PC/server: snmpget / snmpwalk / snmpset.
// Mô phỏng hành vi thật: sai community hoặc bị ACL chặn → agent im lặng (Timeout); v3 sai user / sai mật khẩu báo lỗi
// riêng; "snmp-server user" KHÔNG hiện trong running-config (IOS lưu riêng) — chỉ xem bằng show snmp user.
import * as N from './net.js';

export const SEC = { noauth: 'noAuthNoPriv', auth: 'authNoPriv', priv: 'authPriv' };
const LEVEL_RANK = { noAuthNoPriv: 0, authNoPriv: 1, authPriv: 2 };
const isAgent = (d) => d && (d.type === 'router' || d.type === 'switch') && !['fortios', 'panos', 'sophos', 'checkpoint', 'pfsense'].includes(d.os);
export const snmpOf = (d) => (d.snmp ||= { comm: {}, location: '', contact: '', hosts: [], traps: false, groups: {}, users: {}, stats: { in: 0, badComm: 0, getReq: 0, setReq: 0, out: 0 } });

// ---------------------------------------------------------------- cấu hình (gọi từ lệnh CLI)
export function setCommunity(d, name, rw, acl) { snmpOf(d).comm[name] = { rw: !!rw, acl: acl || null }; }
export function setGroup(d, name, sec, rest = '') {
  const w = String(rest).split(/\s+/).filter(Boolean);
  const g = { sec, read: null, write: null };
  for (let i = 0; i < w.length - 1; i++) if (w[i] === 'read' || w[i] === 'write') g[w[i]] = w[i + 1];
  snmpOf(d).groups[name] = g;
}
export function setUser(d, name, group, auth, authPw, priv, privPw) {
  snmpOf(d).users[name] = { group, auth: auth || null, authPw: authPw || null, priv: priv || null, privPw: privPw || null };
}

/** Dòng running-config (KHÔNG có snmp-server user — như IOS thật). */
export function snmpRunning(d) {
  const s = d.snmp;
  if (!s) return [];
  const L = [];
  for (const [n, c] of Object.entries(s.comm)) L.push(`snmp-server community ${n} ${c.rw ? 'RW' : 'RO'}${c.acl ? ' ' + c.acl : ''}`);
  if (s.location) L.push(`snmp-server location ${s.location}`);
  if (s.contact) L.push(`snmp-server contact ${s.contact}`);
  for (const [n, g] of Object.entries(s.groups)) L.push(`snmp-server group ${n} v3 ${g.sec}${g.read ? ' read ' + g.read : ''}${g.write ? ' write ' + g.write : ''}`);
  if (s.traps) L.push('snmp-server enable traps snmp linkdown linkup coldstart warmstart');
  for (const h of s.hosts) L.push(`snmp-server host ${h.ip}${h.ver === '1' ? '' : ` version ${h.ver}${h.ver === '3' ? ' ' + h.sec : ''}`} ${h.name}`);
  return L;
}
const engineId = (d) => '800000090300' + [...String(d.id)].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').padEnd(12, '0').slice(0, 12).toUpperCase(); // tất định theo thiết bị
export function showSnmp(d, what) {
  const s = d.snmp;
  const on = s && (Object.keys(s.comm).length || Object.keys(s.users).length);
  if (!on) return ['%SNMP agent not enabled'];
  if (what === 'community') return Object.entries(s.comm).flatMap(([n, c]) => ['', `Community name: ${n}`, `Community Index: ${n}`, `Community SecurityName: ${n}`, `storage-type: nonvolatile        active${c.acl ? `      access-list: ${c.acl}` : ''}`]);
  if (what === 'user') {
    const us = Object.entries(s.users);
    return us.length ? us.flatMap(([n, u]) => ['', `User name: ${n}`, `Engine ID: ${engineId(d)}`, 'storage-type: nonvolatile        active', `Authentication Protocol: ${u.auth ? u.auth.toUpperCase() : 'None'}`, `Privacy Protocol: ${u.priv ? u.priv.replace(' ', '').toUpperCase() : 'None'}`, `Group-name: ${u.group}`]) : [];
  }
  if (what === 'group') {
    const L = [];
    for (const [n, c] of Object.entries(s.comm)) for (const m of ['v1', 'v2c']) L.push(`groupname: ${n.padEnd(33)}security model:${m}`, `readview : v1default${c.rw ? '                        writeview: v1default' : '                        writeview: <no writeview specified>'}`, '');
    for (const [n, g] of Object.entries(s.groups)) L.push(`groupname: ${n.padEnd(33)}security model:v3 ${g.sec}`, 'contextname: <no context specified>         storage-type: nonvolatile', `readview : ${g.read || 'v1default'}                        writeview: ${g.write || '<no writeview specified>'}`, 'notifyview: <no notifyview specified>', 'row status: active', '');
    return L;
  }
  if (what === 'host') return s.hosts.flatMap((h) => [`Notification host: ${h.ip}        udp-port: 162   type: trap`, `user: ${h.name}        security model: ${h.ver === '3' ? 'v3 ' + h.sec : h.ver === '1' ? 'v1' : 'v2c'}`, '']);
  const t = s.stats;
  return [`Chassis: ${d.type === 'router' ? 'FTX1628838P' : 'FOC1634Z2KH'}`, ...(s.contact ? [`Contact: ${s.contact}`] : []), ...(s.location ? [`Location: ${s.location}`] : []),
    `${t.in} SNMP packets input`, '    0 Bad SNMP version errors', `    ${t.badComm} Unknown community name`, '    0 Illegal operation for community name supplied', '    0 Encoding errors',
    `    ${t.getReq} Number of requested variables`, `    ${t.altered || 0} Number of altered variables`, `    ${t.getReq} Get-request PDUs`, '    0 Get-next PDUs', `    ${t.setReq} Set-request PDUs`, `${t.out} SNMP packets output`,
    ...(s.traps ? ['SNMP logging: enabled', ...s.hosts.map((h) => `    Logging to ${h.ip}.162, 0/10, 0 sent, 0 dropped.`)] : ['SNMP logging: disabled'])];
}

// ---------------------------------------------------------------- MIB nhóm system
const OIDS = [
  ['sysDescr', '1.3.6.1.2.1.1.1.0', 'SNMPv2-MIB::sysDescr.0', (d) => `STRING: Cisco IOS Software, ${d.type === 'router' ? 'C2900' : 'C' + (d.model || '2960')} Software, Version ${d.version || '15.1(4)M4'}, RELEASE SOFTWARE`],
  ['sysObjectID', '1.3.6.1.2.1.1.2.0', 'SNMPv2-MIB::sysObjectID.0', (d) => `OID: SNMPv2-SMI::enterprises.9.1.${d.type === 'router' ? '1045' : '1208'}`],
  ['sysUpTime', '1.3.6.1.2.1.1.3.0', 'DISMAN-EVENT-MIB::sysUpTimeInstance', () => 'Timeticks: (436000) 1:12:40.00'],
  ['sysContact', '1.3.6.1.2.1.1.4.0', 'SNMPv2-MIB::sysContact.0', (d) => `STRING: ${d.snmp?.contact || ''}`, 'contact'],
  ['sysName', '1.3.6.1.2.1.1.5.0', 'SNMPv2-MIB::sysName.0', (d) => `STRING: ${d.name}`],
  ['sysLocation', '1.3.6.1.2.1.1.6.0', 'SNMPv2-MIB::sysLocation.0', (d) => `STRING: ${d.snmp?.location || ''}`, 'location'],
];
function oidOf(s) {
  const k = String(s).replace(/^(SNMPv2-MIB::|\.?iso\.)/, '').replace(/^\./, '');
  return OIDS.find(([n, num, full]) => k === n + '.0' || k === n || k === num || k === full.split('::')[1]);
}

/** Tách tham số kiểu shell (giữ chuỗi trong ngoặc kép). */
export function argv(line) { return (String(line).match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, '')); }

/**
 * Chạy snmpget / snmpwalk / snmpset từ máy `pcId`. Trả mảng dòng kết quả.
 * Cú pháp như net-snmp: snmpget -v2c -c <community> <ip> <oid>…; -v3 -u <user> -l <noAuthNoPriv|authNoPriv|authPriv>
 * -a <MD5|SHA> -A <pass> -x <DES|AES> -X <pass>; snmpset … <oid> s "<giá trị>".
 */
export function snmpTool(net, pcId, line) {
  const a = argv(line);
  const tool = a[0];
  const usage = [`Cú pháp: ${tool} -v2c -c <community> <IP> <OID>   hoặc   ${tool} -v3 -u <user> -l authPriv -a SHA -A <pass> -x AES -X <pass> <IP> <OID>`, 'OID hỗ trợ (nhóm system): sysDescr.0 sysObjectID.0 sysUpTime.0 sysContact.0 sysName.0 sysLocation.0' + (tool === 'snmpset' ? '   — snmpset <…> sysLocation.0 s "Phòng máy chủ"' : '')];
  const o = { v: null, rest: [] };
  for (let i = 1; i < a.length; i++) {
    const t = a[i];
    if (/^-v/.test(t)) o.v = t.length > 2 ? t.slice(2) : a[++i];
    else if (t === '-c') o.c = a[++i];
    else if (t === '-u') o.u = a[++i];
    else if (t === '-l') o.l = a[++i];
    else if (t === '-a') o.a = (a[++i] || '').toLowerCase();
    else if (t === '-A') o.A = a[++i];
    else if (t === '-x') o.x = (a[++i] || '').toLowerCase();
    else if (t === '-X') o.X = a[++i];
    else o.rest.push(t);
  }
  const [host, ...oids] = o.rest;
  if (!o.v || !host || (tool !== 'snmpwalk' && !oids.length) || !N.isIp(host)) return usage;
  if (!['1', '2c', '3'].includes(o.v)) return [`Invalid version specified after -v flag: ${o.v}`];
  if (o.v !== '3' && !o.c) return ['No community name specified.'];
  const timeout = [`Timeout: No Response from ${host}`];
  const src = net.devices[pcId];
  const tgt = Object.values(net.devices).find((d) => isAgent(d) && Object.values(N.l3ifs(d)).some((f) => f.ip === host));
  // không tới được (định tuyến/ACL chặn) hoặc IP không phải thiết bị Cisco → không ai trả lời
  if (!tgt || tgt.off || !N.sendPacket(net, { src: pcId, dst: host }).ok) return timeout;
  const s = tgt.snmp;
  if (!s) return timeout;
  s.stats.in++;
  let canWrite = false;
  if (o.v !== '3') {
    const c = s.comm[o.c];
    if (!c) { s.stats.badComm++; return timeout; } // sai community: agent đếm lỗi rồi im lặng
    if (c.acl && N.aclEval(tgt, c.acl, { src: src.ip, dst: host, proto: 'udp', dport: 161 }).action !== 'permit') return timeout;
    canWrite = c.rw;
  } else {
    const u = s.users[o.u];
    if (!o.u || !u) return [`${tool}: Unknown user name`];
    const g = s.groups[u.group];
    const lvl = o.l || 'noAuthNoPriv';
    if (!(lvl in LEVEL_RANK)) return [`Invalid security level specified: ${lvl}`];
    if (lvl !== 'noAuthNoPriv' && (o.a !== u.auth || o.A !== u.authPw)) return [`${tool}: Authentication failure (incorrect password, community or key)`];
    if (lvl === 'authPriv' && (!u.priv || !String(o.x).startsWith(u.priv.split(' ')[0]) || o.X !== u.privPw)) return [`${tool}: Decryption error`];
    if (!g || LEVEL_RANK[lvl] < LEVEL_RANK[SEC[g.sec]]) return [`Error in packet`, `Reason: authorizationError (access denied to that object)`];
    canWrite = !!g.write;
  }
  s.stats.out++;
  if (tool === 'snmpwalk') { s.stats.getReq += OIDS.length; return OIDS.map(([, , full, f]) => `${full} = ${f(tgt)}`); }
  if (tool === 'snmpget') {
    s.stats.getReq += oids.length;
    return oids.map((x) => { const m = oidOf(x); return m ? `${m[2]} = ${m[3](tgt)}` : `${x} = No Such Object available on this agent at this OID`; });
  }
  // snmpset <oid> <type> <value>
  s.stats.setReq++;
  const [oid, type, ...val] = oids;
  const m = oidOf(oid);
  if (!m || !type || !val.length) return usage;
  if (!canWrite) return ['Error in packet.', 'Reason: noAccess', `Failed object: ${m[2]}`];
  if (!m[4] || type !== 's') return ['Error in packet.', 'Reason: notWritable (That object does not support modification)', `Failed object: ${m[2]}`];
  s[m[4]] = val.join(' ');
  s.stats.altered = (s.stats.altered || 0) + 1;
  return [`${m[2]} = ${m[3](tgt)}`];
}
