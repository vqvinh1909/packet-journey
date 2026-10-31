// lab/asa.js — bộ lệnh Cisco ASA (dialect riêng, gắn vào CLI của lab/ios.js khi thiết bị có os = 'asa').
// Mô phỏng tập lệnh cốt lõi để học firewall: nameif / security-level, route <nameif>, ACL kiểu ASA
// (dùng subnet MASK, "any", "host", "object"), access-group, object network + nat (dynamic interface /
// static / static service), policy-map global_policy → inspect icmp, same-security-traffic,
// show conn / xlate / nat / route / nameif / interface ip brief / access-list / running-config.
// Việc xét gói (stateful) nằm ở lab/fw.js; NAT/định tuyến dùng chung engine lab/net.js.

import * as N from './net.js';
import { fwCheck } from './fw.js';

const { longIf, prefixToMask, maskToPrefix, isIp, netOf, PORT_NAMES } = N;
const ASA_PORT = { 80: 'www', 443: 'https', 22: 'ssh', 23: 'telnet', 21: 'ftp', 53: 'domain', 25: 'smtp' };
const pad = (s, n) => String(s ?? '').padEnd(n);
const wildOf = (mask) => mask.split('.').map((o) => 255 - +o).join('.');
const maskOf = (wild) => wild.split('.').map((o) => 255 - +o).join('.');

/** Tạo bảng lệnh ASA. h = các tiện ích của ios.js: { c, R, net, iosPing, iosTrace, toPriv, saveCfg, enterIfAsa }. */
export function makeAsa(h) {
  const { c, R, net } = h;
  const ifByName = (d, name) => Object.keys(d.ifaces).find((n) => d.ifaces[n].nameif === name) || null;
  const objs = (d) => (d.objects ||= {});

  // ---------------------------------------------------------------- ACL kiểu ASA
  function addr(d, w, i) {
    const t = (w[i] || '').toLowerCase();
    if (t === 'any' || t === 'any4') return [{ any: true }, i + 1];
    if (t === 'host' && isIp(w[i + 1])) return [{ ip: w[i + 1], wild: '0.0.0.0' }, i + 2];
    if (t === 'object') {
      const o = objs(d)[w[i + 1]];
      if (!o) return [null, i, `ERROR: object (${w[i + 1]}) does not exist`];
      if (o.host) return [{ ip: o.host, wild: '0.0.0.0', obj: w[i + 1] }, i + 2];
      if (o.subnet) return [{ ip: o.subnet.ip, wild: wildOf(o.subnet.mask), obj: w[i + 1] }, i + 2];
      return [null, i, `ERROR: object ${w[i + 1]} chưa có host/subnet`];
    }
    if (isIp(w[i]) && isIp(w[i + 1])) {
      try { maskToPrefix(w[i + 1]); } catch { return [null, i + 1, 'ERROR: Lab — ASA dùng SUBNET MASK (vd 255.255.255.0), không dùng wildcard như IOS']; }
      return [{ ip: w[i], wild: wildOf(w[i + 1]) }, i + 2];
    }
    return [null, i];
  }
  function port(w, i) {
    const op = (w[i] || '').toLowerCase();
    const num = (x) => (/^\d+$/.test(x || '') ? +x : PORT_NAMES[(x || '').toLowerCase()]);
    if (['eq', 'gt', 'lt', 'neq'].includes(op) && num(w[i + 1]) != null) return [{ op, port: num(w[i + 1]) }, i + 2];
    if (op === 'range' && num(w[i + 1]) != null && num(w[i + 2]) != null) return [{ op: 'range', port: num(w[i + 1]), port2: num(w[i + 2]) }, i + 3];
    return [null, i];
  }
  /** "permit tcp any host 1.1.1.1 eq www" → entry (cùng định dạng ACL IOS của engine). */
  function parseAce(d, rest) {
    const w = rest.split(/\s+/);
    const action = w[0];
    const proto = (w[1] || '').toLowerCase();
    if (!['permit', 'deny'].includes(action) || !['ip', 'tcp', 'udp', 'icmp'].includes(proto)) return { err: 'ERROR: % Invalid input detected — cú pháp: access-list <tên> extended {permit|deny} {ip|tcp|udp|icmp} <nguồn> <đích> [eq <port>]' };
    const e = { action, proto };
    let i = 2, x;
    [e.src, i, x] = addr(d, w, i); if (!e.src) return { err: x || 'ERROR: địa chỉ nguồn không hợp lệ' };
    if (proto === 'tcp' || proto === 'udp') { const [p, j] = port(w, i); if (p) { e.sport = p; i = j; } }
    [e.dst, i, x] = addr(d, w, i); if (!e.dst) return { err: x || 'ERROR: địa chỉ đích không hợp lệ' };
    if (proto === 'tcp' || proto === 'udp') { const [p, j] = port(w, i); if (p) { e.dport = p; i = j; } }
    if (proto === 'icmp' && ['echo', 'echo-reply'].includes((w[i] || '').toLowerCase())) { e.icmpType = w[i].toLowerCase(); i++; }
    if (i < w.length) return { err: `ERROR: % Invalid input detected at "${w[i]}"` };
    return { e };
  }
  const addrTxt = (a) => (a.any ? 'any' : a.obj ? `object ${a.obj}` : a.wild === '0.0.0.0' ? `host ${a.ip}` : `${a.ip} ${maskOf(a.wild)}`);
  const portTxt = (p) => (!p ? '' : p.op === 'range' ? ` range ${p.port} ${p.port2}` : ` ${p.op} ${ASA_PORT[p.port] || p.port}`);
  const aceTxt = (e) => `extended ${e.action} ${e.proto} ${addrTxt(e.src)}${portTxt(e.sport)} ${addrTxt(e.dst)}${portTxt(e.dport)}${e.icmpType ? ' ' + e.icmpType : ''}`;
  function acl(x) {
    const d = x.d, name = x.a[0];
    const r = parseAce(d, x.a[1]);
    if (r.err) return R([r.err]);
    const a = (d.acls[name] ||= { type: 'extended', entries: [], asa: true });
    a.entries.push({ seq: (a.entries.length + 1) * 10, ...r.e });
    return R([]);
  }

  // ---------------------------------------------------------------- object network + NAT
  /** Dựng lại cấu hình NAT của engine từ các object network (gọi sau mỗi thay đổi). */
  function rebuildNat(d) {
    d.nat.dyn = d.nat.dyn.filter((r) => !r.asaObj);
    d.nat.statics = d.nat.statics.filter((r) => !r.asaObj);
    for (const n of Object.keys(d.acls)) if (n.startsWith('__obj_')) delete d.acls[n];
    for (const [name, o] of Object.entries(objs(d))) {
      if (!o.nat) continue;
      const fi = ifByName(d, o.nat.from), fo = ifByName(d, o.nat.to);
      if (!fi || !fo) continue;
      d.ifaces[fi].nat ||= 'inside';
      d.ifaces[fo].nat = 'outside';
      if (o.nat.type === 'dynamic') {
        const src = o.host ? { ip: o.host, wild: '0.0.0.0' } : o.subnet ? { ip: o.subnet.ip, wild: wildOf(o.subnet.mask) } : null;
        if (!src) continue;
        d.acls['__obj_' + name] = { type: 'standard', entries: [{ seq: 10, action: 'permit', src }], hidden: true };
        d.nat.dyn.push({ acl: '__obj_' + name, iface: fo, overload: true, asaObj: name });
      } else if (o.host) {
        const gip = o.nat.ip === 'interface' ? d.ifaces[fo].ip : o.nat.ip; // "static interface" = dùng IP cổng ra
        if (!gip) continue;
        d.nat.statics.push(o.nat.svc ? { proto: o.nat.svc.proto, local: o.host, lport: o.nat.svc.real, global: gip, gport: o.nat.svc.mapped, asaObj: name } : { local: o.host, global: gip, asaObj: name });
      }
    }
  }
  function objNat(x) {
    const d = x.d, o = objs(d)[x.s.obj];
    const m = x.a[0].match(/^\(([\w-]+),([\w-]+)\)$/);
    if (!m) return R(['ERROR: cú pháp: nat (<nameif-thật>,<nameif-map>) dynamic interface | static <IP> [service tcp <port-thật> <port-map>]']);
    if (!ifByName(d, m[1]) || !ifByName(d, m[2])) return R([`ERROR: interface "${!ifByName(d, m[1]) ? m[1] : m[2]}" chưa có nameif`]);
    const w = x.a[1].split(/\s+/);
    if (w[0] === 'dynamic' && w[1] === 'interface' && w.length === 2) o.nat = { from: m[1], to: m[2], type: 'dynamic' };
    else if (w[0] === 'static' && (isIp(w[1]) || w[1] === 'interface')) {
      if (w[1] === 'interface' && w[2] !== 'service') return R(['ERROR: Lab — "static interface" cần kèm "service tcp <port-thật> <port-map>" (port forwarding)']);
      if (!o.host) return R(['ERROR: Lab — static NAT trong lab chỉ hỗ trợ object "host"']);
      let svc = null;
      if (w[2] === 'service') {
        const pn = (v) => (/^\d+$/.test(v || '') ? +v : PORT_NAMES[v]);
        if (!['tcp', 'udp'].includes(w[3]) || pn(w[4]) == null || pn(w[5]) == null) return R(['ERROR: cú pháp: static <IP> service tcp <port-thật> <port-map>']);
        svc = { proto: w[3], real: pn(w[4]), mapped: pn(w[5]) };
      } else if (w.length > 2) return R([`ERROR: % Invalid input detected at "${w[2]}"`]);
      o.nat = { from: m[1], to: m[2], type: 'static', ip: w[1], svc };
    } else return R(['ERROR: cú pháp: nat (<real>,<mapped>) dynamic interface | static <IP>']);
    rebuildNat(d);
    return R([]);
  }

  // ---------------------------------------------------------------- show
  const ifState = (d, n) => { const f = d.ifaces[n]; return f.shutdown ? ['administratively down', 'down'] : [N.statusUp(net, d.id, n) ? 'up' : 'down', N.lineUp(net, d.id, n) ? 'up' : 'down']; };
  const order = (d) => Object.keys(d.ifaces).sort(N.ifSort);
  function showIpBrief(d) {
    const L = ['Interface                  IP-Address      OK? Method Status                Protocol'];
    for (const n of order(d)) { const f = d.ifaces[n]; const [st, pr] = ifState(d, n); L.push(`${pad(longIf(n), 27)}${pad(f.ip || 'unassigned', 16)}YES ${pad(f.ip ? 'manual' : 'unset', 7)}${pad(st, 22)}${pr}`); }
    return L;
  }
  function showNameif(d) {
    return ['Interface                Name                     Security', ...order(d).filter((n) => d.ifaces[n].nameif).map((n) => `${pad(longIf(n), 25)}${pad(d.ifaces[n].nameif, 25)}${d.ifaces[n].secLevel ?? 0}`)];
  }
  function showRoute(d) {
    const rt = N.routeTable(N.makeCtx(net), d.id);
    const nm = (n) => d.ifaces[n]?.nameif || longIf(n);
    const def = rt.find((r) => r.prefix === 0);
    const L = ['Codes: L - local, C - connected, S - static, * - candidate default', '', def ? `Gateway of last resort is ${def.nextHop} to network 0.0.0.0` : 'Gateway of last resort is not set', ''];
    for (const r of rt) {
      const net0 = `${r.net} ${prefixToMask(r.prefix)}`;
      if (r.code === 'C' || r.code === 'L') L.push(`${pad(r.code, 9)}${net0} is directly connected, ${nm(r.iface)}`);
      else L.push(`${pad(r.code, 9)}${net0} [${r.ad}/${r.metric}] via ${r.nextHop}, ${nm(r.iface)}`);
    }
    return L;
  }
  function showConn(d) {
    const cs = d.fw?.conns || [];
    const nm = (n) => d.ifaces[n]?.nameif || n;
    const L = [`${cs.length} in use, ${cs.length} most used`];
    for (const x of cs) {
      const P = x.proto.toUpperCase();
      const flags = x.proto === 'tcp' ? 'UIO' : x.proto === 'udp' ? '-' : '';
      L.push(`${P} ${nm(x.outIf)} ${x.dst}:${x.dport ?? 0} ${nm(x.inIf)} ${x.src}:${x.sport ?? 1}, idle 0:00:0${cs.indexOf(x) % 9 + 1}, bytes ${x.proto === 'icmp' ? 64 : 1240}, flags ${flags}`);
    }
    return L;
  }
  function showXlate(d) {
    const nm = (ip, side) => { const n = Object.keys(d.ifaces).find((k) => d.ifaces[k].nameif && d.ifaces[k].ip && N.inNet(ip, d.ifaces[k].ip, d.ifaces[k].prefix)); return n ? d.ifaces[n].nameif : side; };
    const rows = [];
    for (const s of d.nat.statics.filter((x) => x.asaObj)) rows.push(s.proto ? `${s.proto.toUpperCase()} PAT from ${nm(s.local, 'inside')}:${s.local} ${s.lport}-${s.lport} to ${nm(s.global, 'outside')}:${s.global} ${s.gport}-${s.gport} flags sr idle 0:00:12 timeout 0:00:00` : `NAT from ${nm(s.local, 'inside')}:${s.local} to ${nm(s.global, 'outside')}:${s.global} flags s idle 0:00:12 timeout 0:00:00`);
    for (const e of d.natTable || []) rows.push(`${e.proto.toUpperCase()} PAT from ${nm(e.il, 'inside')}:${e.il}/${e.port} to ${nm(e.ig, 'outside')}:${e.ig}/${e.gport ?? e.port} flags ri idle 0:00:05 timeout 0:00:30`);
    return [`${rows.length} in use, ${rows.length} most used`, 'Flags: D - DNS, e - extended, I - identity, i - dynamic, r - portmap,', '       s - static, T - twice, N - net-to-net', ...rows];
  }
  function showNat(d) {
    const L = ['', 'Auto NAT Policies (Section 2)'];
    let i = 0;
    for (const [name, o] of Object.entries(objs(d))) {
      if (!o.nat) continue;
      L.push(`${++i} (${o.nat.from}) to (${o.nat.to}) source ${o.nat.type} ${name} ${o.nat.type === 'dynamic' ? 'interface' : o.nat.ip}${o.nat.svc ? ` service ${o.nat.svc.proto} ${o.nat.svc.real} ${o.nat.svc.mapped}` : ''}`, '    translate_hits = 0, untranslate_hits = 0');
    }
    return i ? L : ['(Lab: chưa có NAT nào — object network ... → nat (inside,outside) dynamic interface)'];
  }
  function showAcl(d) {
    const L = [];
    for (const [n, a] of Object.entries(d.acls)) {
      if (a.hidden || !a.asa) continue;
      L.push(`access-list ${n}; ${a.entries.length} elements; name hash: 0x${(n.length * 2654435761 >>> 0).toString(16).slice(0, 8)}`);
      a.entries.forEach((e, i) => L.push(`access-list ${n} line ${i + 1} ${aceTxt(e)} (hitcnt=${e.matches || 0})`));
    }
    return L.length ? L : ['(Lab: chưa có access-list nào)'];
  }
  function runCfg(d) {
    const L = [': Saved', ':', 'ASA Version 9.8(4)', '!', `hostname ${d.name}`, '!'];
    for (const n of order(d)) {
      const f = d.ifaces[n];
      L.push(`interface ${longIf(n)}`, ...(f.desc ? [` description ${f.desc}`] : []), ...(f.shutdown ? [' shutdown'] : []), f.nameif ? ` nameif ${f.nameif}` : ' no nameif', f.secLevel != null ? ` security-level ${f.secLevel}` : ' no security-level', f.ip ? ` ip address ${f.ip} ${prefixToMask(f.prefix)}` : ' no ip address', '!');
    }
    if (d.fw.sameSec) L.push('same-security-traffic permit inter-interface');
    for (const [name, o] of Object.entries(objs(d))) L.push(`object network ${name}`, ...(o.host ? [` host ${o.host}`] : o.subnet ? [` subnet ${o.subnet.ip} ${o.subnet.mask}`] : []));
    for (const [n, a] of Object.entries(d.acls)) if (a.asa) for (const e of a.entries) L.push(`access-list ${n} ${aceTxt(e)}`);
    for (const [name, o] of Object.entries(objs(d))) if (o.nat) L.push(`object network ${name}`, ` nat (${o.nat.from},${o.nat.to}) ${o.nat.type} ${o.nat.type === 'dynamic' ? 'interface' : o.nat.ip}${o.nat.svc ? ` service ${o.nat.svc.proto} ${o.nat.svc.real} ${o.nat.svc.mapped}` : ''}`);
    for (const n of order(d)) { const f = d.ifaces[n]; if (f.nameif && f.aclIn) L.push(`access-group ${f.aclIn} in interface ${f.nameif}`); if (f.nameif && f.aclOut) L.push(`access-group ${f.aclOut} out interface ${f.nameif}`); }
    for (const r of d.routes) L.push(`route ${d.ifaces[r.iface]?.nameif || '?'} ${r.net} ${prefixToMask(r.prefix)} ${r.nh} ${r.ad ?? 1}`);
    L.push('!', 'policy-map global_policy', ' class inspection_default', '  inspect dns', '  inspect ftp', '  inspect http', ...(d.fw.inspectIcmp ? ['  inspect icmp'] : []), '!', 'service-policy global_policy global', ': end');
    return L;
  }

  /** packet-tracer: xét gói giả định theo đúng cấu hình đang chạy (un-NAT → route → ACL → firewall), không gửi gói thật. */
  function packetTracer(d, nameif, proto, src, sport, dst, dport) {
    const inIf = ifByName(d, nameif);
    if (!inIf) return R([`ERROR: interface "${nameif}" không tồn tại (dùng tên nameif, vd inside)`]);
    const L = [];
    let n = 0, outIf = null, realDst = dst, realPort = dport;
    const phase = (type, sub, ok, info) => L.push(`Phase: ${++n}`, `Type: ${type}`, `Subtype: ${sub}`, `Result: ${ok ? 'ALLOW' : 'DROP'}`, 'Additional Information:', ...(info ? [info] : []), '');
    const finish = (reason) => {
      const st = (ifn) => { const up = N.ifUp(net, d.id, ifn); return [`status: ${up ? 'up' : 'down'}`, `line-status: ${up ? 'up' : 'down'}`]; };
      L.push('Result:', `input-interface: ${nameif}`, ...st(inIf).map((x) => `input-${x}`), ...(outIf ? [`output-interface: ${d.ifaces[outIf].nameif || outIf}`, ...st(outIf).map((x) => `output-${x}`)] : []), `Action: ${reason ? 'drop' : 'allow'}`, ...(reason ? [`Drop-reason: ${reason}`] : []));
      return R(L);
    };
    if (!N.ifUp(net, d.id, inIf)) return finish('(interface-down) Interface is down');
    const st = d.nat.statics.find((s) => s.asaObj && s.global === dst && (!s.proto || (s.proto === proto && s.gport === dport)));
    if (st) {
      realDst = st.local;
      if (st.proto) realPort = st.lport;
      phase('UN-NAT', 'static', true, `NAT divert to egress: ${dst} → ${realDst}`);
    }
    const ctx = N.makeCtx(net);
    const rt = N.lookup(ctx, d.id, realDst);
    if (!rt) { phase('ROUTE-LOOKUP', 'input', false, `Không có route tới ${realDst}`); return finish(`(no-route) No route to host ${realDst}`); }
    outIf = rt.iface;
    phase('ROUTE-LOOKUP', 'input', true, `found next-hop ${rt.nextHop || realDst} using egress ifc ${d.ifaces[outIf].nameif || outIf}`);
    const pkt = { proto, src, dst: realDst, sport, dport: realPort };
    for (const [acl, dir] of [[d.ifaces[inIf].aclIn, 'in'], [d.ifaces[outIf].aclOut, 'out']]) {
      if (!acl) continue;
      const ok = N.aclEval(d, acl, pkt, false).action === 'permit';
      phase('ACCESS-LIST', 'log', ok, `access-group ${acl} ${dir} interface ${d.ifaces[dir === 'in' ? inIf : outIf].nameif}`);
      if (!ok) return finish('(acl-drop) Flow is denied by configured rule');
    }
    const v = fwCheck(ctx, d, pkt, inIf, outIf);
    if (!v.allow) { phase('ACCESS-LIST', '', false, v.why); return finish('(acl-drop) Flow is denied by configured rule'); }
    const sn = !st && d.nat.dyn.find((r) => r.asaObj && r.iface === outIf && N.aclEval(d, r.acl, pkt, false).action === 'permit');
    const si = !st && d.nat.statics.find((s) => s.asaObj && s.local === src);
    if (si) phase('NAT', 'static', true, `Static translate ${src}${si.lport ? `/${si.lport}` : ''} to ${si.global}${si.gport ? `/${si.gport}` : ''}`);
    else if (sn) phase('NAT', 'per-session', true, `Dynamic translate ${src}${sport ? `/${sport}` : ''} to ${d.ifaces[outIf].ip}/${sport || 1024}`);
    phase('FLOW-CREATION', '', true, `${v.why}. New flow created`);
    return finish(null);
  }

  // ---------------------------------------------------------------- bảng lệnh theo mode
  const SHOWS = [
    c('show running-config', (x) => R(runCfg(x.d))),
    c('show interface ip brief', (x) => R(showIpBrief(x.d))),
    c('show ip address', (x) => R(showIpBrief(x.d))),
    c('show nameif', (x) => R(showNameif(x.d))),
    c('show route', (x) => R(showRoute(x.d))),
    c('show conn', (x) => R(showConn(x.d))),
    c('show conn all', (x) => R(showConn(x.d))),
    c('show xlate', (x) => R(showXlate(x.d))),
    c('show nat', (x) => R(showNat(x.d))),
    c('show access-list', (x) => R(showAcl(x.d))),
    c('show failover', () => R(['Failover Off', 'Failover unit Primary', 'Failover LAN Interface: not Configured', '(Lab: chưa mô phỏng failover)'])),
    c('show version', (x) => R([`Cisco Adaptive Security Appliance Software Version 9.8(4)`, '', `${x.d.name} up 2 hours 13 mins`, 'Hardware:   ASA5506, 4096 MB RAM', '(Lab: mô phỏng tập lệnh cốt lõi của ASA)'])),
  ];
  const EXEC = [
    c('ping <ip>', (x) => h.iosPing(x.d, x.a[0])),
    c('ping <word> <ip>', (x) => h.iosPing(x.d, x.a[1])),
    c('traceroute <ip>', (x) => h.iosTrace(x.d, x.a[0])),
    c('exit', (x) => { x.s.mode = 'user'; return R(['', 'Logoff']); }),
  ];
  const USER = [c('enable', (x) => { x.s.mode = 'priv'; return R([]); }), ...EXEC, ...SHOWS.filter((e) => e.toks[1] !== 'running-config')];
  const PRIV = [
    c('enable', () => R([])),
    c('configure terminal', (x) => { x.s.mode = 'config'; return R([]); }),
    c('disable', (x) => { x.s.mode = 'user'; return R([]); }),
    c('write memory', (x) => { h.saveCfg(x); return R(['Building configuration...', 'Cryptochecksum: 3f2a1b9c 7e4d5a6b 0c1d2e3f 4a5b6c7d', '[OK]']); }),
    c('copy running-config startup-config', (x) => { h.saveCfg(x); return R(['Cryptochecksum: 3f2a1b9c 7e4d5a6b 0c1d2e3f 4a5b6c7d', '[OK]']); }),
    c('packet-tracer input <word> {tcp|udp} <ip> <num> <ip> <num>', (x) => packetTracer(x.d, x.a[0], x.a[1], x.a[2], +x.a[3], x.a[4], +x.a[5])),
    c('packet-tracer input <word> icmp <ip> <num> <num> <ip>', (x) => packetTracer(x.d, x.a[0], 'icmp', x.a[1], undefined, x.a[4], undefined)),
    c('clear xlate', (x) => { x.d.natTable = []; return R([]); }),
    c('clear conn', (x) => { x.d.fw.conns = []; return R([]); }),
    c('clear access-list <word> counters', (x) => { for (const e of x.d.acls[x.a[0]]?.entries || []) e.matches = 0; return R([]); }),
    ...EXEC, ...SHOWS,
  ];
  const tail = [c('exit', (x) => { x.s.mode = x.s.mode === 'pmapc' ? 'pmap' : 'config'; x.s.ifs = []; return R([]); }), c('end', (x) => h.toPriv(x))];
  const CFG = [
    c('hostname <word>', (x) => { x.d.name = x.a[0]; return R([]); }),
    c('interface <if>', (x) => { if (!x.d.ifaces[x.a[0]] || x.a[0].includes('.')) return R(['ERROR: % Invalid interface']); x.s.mode = 'if'; x.s.ifs = [x.a[0]]; return R([]); }),
    c('route <word> <ip> <mask> <ip>', (x) => route(x, 1)),
    c('route <word> <ip> <mask> <ip> <num>', (x) => route(x, x.a[4])),
    c('no route <word> <ip> <mask> <ip>', (x) => { x.d.routes = x.d.routes.filter((r) => !(r.net === netOf(x.a[1], maskToPrefix(x.a[2])) && r.nh === x.a[3])); return R([]); }),
    c('access-list <word> extended <rest>', (x) => acl(x)),
    c('access-list <word> remark <rest>', () => R([])),
    c('no access-list <word>', (x) => { delete x.d.acls[x.a[0]]; return R([]); }),
    c('access-group <word> {in|out} interface <word>', (x) => accessGroup(x, true)),
    c('no access-group <word> {in|out} interface <word>', (x) => accessGroup(x, false)),
    c('object network <word>', (x) => { objs(x.d)[x.a[0]] ||= {}; x.s.mode = 'asaobj'; x.s.obj = x.a[0]; return R([]); }),
    c('no object network <word>', (x) => { delete objs(x.d)[x.a[0]]; rebuildNat(x.d); return R([]); }),
    c('same-security-traffic permit inter-interface', (x) => { x.d.fw.sameSec = true; return R([]); }),
    c('no same-security-traffic permit inter-interface', (x) => { x.d.fw.sameSec = false; return R([]); }),
    c('policy-map global_policy', (x) => { x.s.mode = 'pmap'; return R([]); }),
    c('fixup protocol icmp', (x) => { x.d.fw.inspectIcmp = true; return R(['WARNING: lệnh cũ — tương đương "inspect icmp" trong policy-map global_policy']); }),
    c('enable password <word>', (x) => { x.d.enablePassword = x.a[0]; return R([]); }),
    c('username <word> password <word>', (x) => { x.d.users[x.a[0]] = { pw: x.a[1], priv: 1 }; return R([]); }),
    ...tail,
    c('do <rest>', (x) => h.doIn(x, PRIV)),
  ];
  function route(x, ad) {
    const n = ifByName(x.d, x.a[0]);
    if (!n) return R([`ERROR: Interface "${x.a[0]}" chưa có (route <nameif> ... dùng TÊN cổng, vd outside)`]);
    const prefix = maskToPrefix(x.a[2]);
    x.d.routes = x.d.routes.filter((r) => !(r.net === netOf(x.a[1], prefix) && r.prefix === prefix && r.nh === x.a[3]));
    x.d.routes.push({ net: netOf(x.a[1], prefix), prefix, nh: x.a[3], iface: n, ad });
    return R([]);
  }
  function accessGroup(x, add) {
    const n = ifByName(x.d, x.a[2]);
    if (!n) return R([`ERROR: Interface "${x.a[2]}" chưa có nameif`]);
    if (add && !x.d.acls[x.a[0]]) return R([`ERROR: access-list <${x.a[0]}> does not exist`]);
    x.d.ifaces[n][x.a[1] === 'in' ? 'aclIn' : 'aclOut'] = add ? x.a[0] : null;
    return R([]);
  }
  const IF = [
    c('nameif <word>', (x) => {
      const f = x.d.ifaces[x.s.ifs[0]];
      if (ifByName(x.d, x.a[0]) && ifByName(x.d, x.a[0]) !== x.s.ifs[0]) return R([`ERROR: nameif "${x.a[0]}" đã dùng cho cổng khác`]);
      f.nameif = x.a[0];
      f.secLevel = x.a[0] === 'inside' ? 100 : 0;
      return R([`INFO: Security level for "${x.a[0]}" set to ${f.secLevel} by default.`]);
    }),
    c('no nameif', (x) => { const f = x.d.ifaces[x.s.ifs[0]]; f.nameif = null; f.secLevel = null; return R([]); }),
    c('security-level <num>', (x) => { if (x.a[0] > 100) return R(['ERROR: security-level 0–100']); x.d.ifaces[x.s.ifs[0]].secLevel = x.a[0]; return R([]); }),
    c('ip address <ip> <mask>', (x) => { const f = x.d.ifaces[x.s.ifs[0]]; f.ip = x.a[0]; f.prefix = maskToPrefix(x.a[1]); rebuildNat(x.d); return R([]); }),
    c('no ip address', (x) => { const f = x.d.ifaces[x.s.ifs[0]]; f.ip = null; f.prefix = null; return R([]); }),
    c('shutdown', (x) => { x.d.ifaces[x.s.ifs[0]].shutdown = true; return R([]); }),
    c('no shutdown', (x) => { x.d.ifaces[x.s.ifs[0]].shutdown = false; return R([]); }),
    c('description <rest>', (x) => { x.d.ifaces[x.s.ifs[0]].desc = x.a[0]; return R([]); }),
    ...tail,
    c('do <rest>', (x) => h.doIn(x, PRIV)),
  ];
  const OBJ = [
    c('host <ip>', (x) => { const o = objs(x.d)[x.s.obj]; o.host = x.a[0]; delete o.subnet; rebuildNat(x.d); return R([]); }),
    c('subnet <ip> <mask>', (x) => { const o = objs(x.d)[x.s.obj]; o.subnet = { ip: netOf(x.a[0], maskToPrefix(x.a[1])), mask: x.a[1] }; delete o.host; rebuildNat(x.d); return R([]); }),
    c('nat <word> <rest>', (x) => objNat(x)),
    c('no nat', (x) => { delete objs(x.d)[x.s.obj].nat; rebuildNat(x.d); return R([]); }),
    ...tail,
  ];
  const PMAP = [c('class inspection_default', (x) => { x.s.mode = 'pmapc'; return R([]); }), ...tail];
  const PMAPC = [
    c('inspect icmp', (x) => { x.d.fw.inspectIcmp = true; return R([]); }),
    c('no inspect icmp', (x) => { x.d.fw.inspectIcmp = false; return R([]); }),
    c('inspect <word>', () => R([])),
    ...tail,
  ];
  const TABLES = { user: USER, priv: PRIV, config: CFG, if: IF, asaobj: OBJ, pmap: PMAP, pmapc: PMAPC };
  const PROMPT = { user: '>', priv: '#', config: '(config)#', if: '(config-if)#', asaobj: '(config-network-object)#', pmap: '(config-pmap)#', pmapc: '(config-pmap-c)#' };
  return {
    tableFor: (d, s) => TABLES[s.mode] || [],
    cfgTable: () => CFG,
    prompt: (d, s) => d.name + (PROMPT[s.mode] || '#'),
    modes: ['asaobj', 'pmap', 'pmapc'],
    runCfg,
  };
}
