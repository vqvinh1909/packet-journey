// lab/panos.js — CLI Palo Alto (PAN-OS) rút gọn cho Lab.
// Hai chế độ: vận hành "admin@PA-VM>" và cấu hình "admin@PA-VM#" (configure). Mọi "set" chỉ sửa
// CANDIDATE config — chưa có tác dụng cho tới khi "commit" (bẫy kinh điển của Palo Alto).
// Hỗ trợ: interface layer3, zone, virtual-router (interface + static-route), address object,
// rulebase security (from/to/source/destination/application/service/action), rulebase nat
// (source-translation dynamic-ip-and-port interface-address; destination-translation), move,
// delete, show config diff; vận hành: show session all, show running security-policy, show routing
// route, show interface all, test security-policy-match, ping host.
// Engine (d.fw kind 'policy', preNatDst) dựng từ RUNNING config sau mỗi commit.

import * as N from './net.js';

const APPS = {
  'web-browsing': [{ proto: 'tcp', port: 80 }], ssl: [{ proto: 'tcp', port: 443 }], dns: [{ proto: 'udp', port: 53 }, { proto: 'tcp', port: 53 }],
  ping: [{ proto: 'icmp' }], ssh: [{ proto: 'tcp', port: 22 }], 'ms-rdp': [{ proto: 'tcp', port: 3389 }], mysql: [{ proto: 'tcp', port: 3306 }], smtp: [{ proto: 'tcp', port: 25 }],
};
const SERVICES = { 'service-http': [{ proto: 'tcp', port: 80 }, { proto: 'tcp', port: 8080 }], 'service-https': [{ proto: 'tcp', port: 443 }] };
const pn = (x) => { const m = String(x).match(/^ethernet(\d+\/\d+)$/i); return m ? 'e' + m[1] : null; };
const dn = (k) => 'ethernet' + k.slice(1);
const clone = (o) => JSON.parse(JSON.stringify(o));
/** Tách dòng: "[ a b ]" thành mảng, phần còn lại là từ đơn. */
function toks(line) {
  const out = [];
  const re = /\[([^\]]*)\]|"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] != null ? m[1].trim().split(/\s+/).filter(Boolean) : m[2] ?? m[3]);
  return out;
}
const arr = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const cidr = (v) => { const m = String(v).match(/^(\d+\.\d+\.\d+\.\d+)(?:\/(\d+))?$/); return m && N.isIp(m[1]) ? { ip: m[1], prefix: m[2] != null ? +m[2] : 32 } : null; };

function emptyCfg(name) { return { hostname: name, ifs: {}, zones: {}, vr: { ifs: [], routes: {} }, addr: {}, sec: [], nat: [] }; }

export function makePan(h) {
  const { net, R } = h;
  const P = (d) => (d.pan ||= { cand: emptyCfg(d.name), run: emptyCfg(d.name), jobs: 1 });

  // ---------------------------------------------------------------- dựng engine từ RUNNING config
  function rebuild(d) {
    const C = P(d).run;
    d.name = C.hostname || d.name;
    const inVr = new Set(C.vr.ifs);
    for (const [k, f] of Object.entries(d.ifaces)) {
      const i = C.ifs[k];
      f.zone = Object.entries(C.zones).find(([, z]) => z.ifs.includes(k))?.[0] || null;
      f.ip = i && inVr.has(k) ? i.ip : null; f.prefix = f.ip ? i.prefix : null; // cổng chưa vào virtual-router thì không định tuyến
      f.shutdown = !i; f.nat = null;
    }
    d.routes = Object.values(C.vr.routes).filter((r) => r.dst && r.nh).map((r) => ({ net: N.netOf(r.dst.ip, r.dst.prefix), prefix: r.dst.prefix, nh: r.nh, iface: null, ad: 10 }));
    const spec = (v) => { const a = arr(v); if (!a.length || a.includes('any')) return 'any'; return a.map((x) => { const o = C.addr[x] || cidr(x); return o ? { net: N.netOf(o.ip, o.prefix), prefix: o.prefix } : { host: 'none' }; }); };
    const svc = (r) => {
      const apps = arr(r.application), svs = arr(r.service);
      if (svs.includes('application-default')) return apps.includes('any') || !apps.length ? 'any' : apps.flatMap((a) => APPS[a] || []);
      if (!svs.length || svs.includes('any')) return apps.includes('any') || !apps.length ? 'any' : apps.flatMap((a) => APPS[a] || []);
      return svs.flatMap((x) => SERVICES[x] || []);
    };
    d.fw.preNatDst = true;
    d.fw.ruleWord = 'security rule';
    d.fw.implicitWord = 'rule mặc định "interzone-default" → DENY';
    d.fw.rules = [
      ...C.sec.map((r) => ({ name: r.name, disabled: r.disabled === 'yes', from: arr(r.from), to: arr(r.to), src: spec(r.source), dst: spec(r.destination), svc: svc(r), action: r.action === 'allow' ? 'allow' : 'deny' })),
      { name: 'intrazone-default', sameZone: true, from: 'any', to: 'any', src: 'any', dst: 'any', svc: 'any', action: 'allow' },
    ];
    d.fw.natRules = C.nat.filter((r) => r.snat).map((r) => ({ name: r.name, disabled: r.disabled === 'yes', from: arr(r.from), to: arr(r.to), src: spec(r.source), dst: spec(r.destination), natIp: 'iface' }));
    d.nat.statics = [];
    for (const r of C.nat.filter((x) => x.dnat)) {
      const g = C.addr[arr(r.destination)[0]] || cidr(arr(r.destination)[0]);
      const l = C.addr[r.dnat] || cidr(r.dnat);
      if (!g || !l) continue;
      d.nat.statics.push({ local: l.ip, global: g.ip });
      for (const z of arr(r.from)) for (const k of C.zones[z]?.ifs || []) if (d.ifaces[k]) d.ifaces[k].nat = 'outside'; // firewall trả ARP cho IP public
    }
  }

  // ---------------------------------------------------------------- "set" / "delete" trên candidate
  function setCmd(d, t) {
    const C = P(d).cand;
    const head = t.slice(0, 3).map(String).join(' ');
    if (t[0] === 'deviceconfig' && t[1] === 'system' && t[2] === 'hostname' && t[3]) { C.hostname = t[3]; return null; }
    if (t[0] === 'network' && t[1] === 'interface' && t[2] === 'ethernet') {
      const k = pn(t[3]);
      if (!k || !d.ifaces[k]) return `Invalid syntax. (cổng có trên thiết bị: ${Object.keys(d.ifaces).map(dn).join(', ')})`;
      if (t[4] === 'layer3' && t[5] === 'ip') { const c = cidr(t[6]); if (!c || String(t[6]).indexOf('/') < 0) return 'Invalid syntax. (vd: ip 10.1.1.1/24)'; C.ifs[k] = { ip: c.ip, prefix: c.prefix }; return null; }
      return 'Invalid syntax.';
    }
    if (t[0] === 'zone' && t[1] && t[2] === 'network' && t[3] === 'layer3') {
      const ks = arr(t[4]).map(pn);
      if (ks.some((k) => !k || !d.ifaces[k])) return 'Invalid syntax. (tên cổng dạng ethernet1/1)';
      for (const z of Object.values(C.zones)) z.ifs = z.ifs.filter((k) => !ks.includes(k)); // 1 cổng chỉ thuộc 1 zone
      (C.zones[t[1]] ||= { ifs: [] }).ifs.push(...ks.filter((k) => !C.zones[t[1]].ifs.includes(k)));
      return null;
    }
    if (head === 'network virtual-router default') {
      if (t[3] === 'interface') { const ks = arr(t[4]).map(pn); if (ks.some((k) => !k || !d.ifaces[k])) return 'Invalid syntax.'; for (const k of ks) if (!C.vr.ifs.includes(k)) C.vr.ifs.push(k); return null; }
      if (t[3] === 'routing-table' && t[4] === 'ip' && t[5] === 'static-route' && t[6]) {
        const r = (C.vr.routes[t[6]] ||= {});
        for (let i = 7; i < t.length; i += 2) {
          if (t[i] === 'destination') { const c = cidr(t[i + 1]); if (!c) return 'Invalid syntax.'; r.dst = c; }
          else if (t[i] === 'nexthop' && t[i + 1] === 'ip-address' && N.isIp(t[i + 2])) { r.nh = t[i + 2]; i++; }
          else if (t[i] === 'interface') { /* chấp nhận, không bắt buộc */ }
          else return 'Invalid syntax.';
        }
        return null;
      }
      return 'Invalid syntax.';
    }
    if (t[0] === 'address' && t[1] && t[2] === 'ip-netmask') { const c = cidr(t[3]); if (!c) return 'Invalid syntax.'; C.addr[t[1]] = c; return null; }
    if (t[0] === 'rulebase' && ['security', 'nat'].includes(t[1]) && t[2] === 'rules' && t[3]) {
      const list = t[1] === 'security' ? C.sec : C.nat;
      let r = list.find((x) => x.name === t[3]);
      if (!r) { r = { name: t[3] }; list.push(r); }
      const KEYS = t[1] === 'security' ? ['from', 'to', 'source', 'destination', 'application', 'service', 'action', 'disabled', 'description'] : ['from', 'to', 'source', 'destination', 'service', 'disabled', 'description'];
      for (let i = 4; i < t.length;) {
        const k = t[i];
        if (t[1] === 'nat' && k === 'source-translation') {
          if (t[i + 1] === 'dynamic-ip-and-port' && t[i + 2] === 'interface-address' && t[i + 3] === 'interface' && pn(t[i + 4])) { r.snat = pn(t[i + 4]); i += 5; continue; }
          return 'Invalid syntax. (source-translation dynamic-ip-and-port interface-address interface ethernet1/1)';
        }
        if (t[1] === 'nat' && k === 'destination-translation') {
          if (t[i + 1] === 'translated-address' && t[i + 2]) { r.dnat = t[i + 2]; i += 3; continue; }
          return 'Invalid syntax. (destination-translation translated-address <IP|address>)';
        }
        if (!KEYS.includes(k) || t[i + 1] == null) return `Invalid syntax. ("${k}" — thuộc tính hợp lệ: ${KEYS.join(', ')})`;
        if (k === 'action' && !['allow', 'deny', 'drop'].includes(t[i + 1])) return 'Invalid syntax. (action allow|deny|drop)';
        r[k] = t[i + 1];
        i += 2;
      }
      return null;
    }
    return 'Invalid syntax.';
  }
  function delCmd(d, t) {
    const C = P(d).cand;
    if (t[0] === 'rulebase' && ['security', 'nat'].includes(t[1]) && t[2] === 'rules' && t[3]) {
      const k = t[1] === 'security' ? 'sec' : 'nat';
      if (!C[k].some((x) => x.name === t[3])) return 'Object doesn\'t exist';
      C[k] = C[k].filter((x) => x.name !== t[3]);
      return null;
    }
    if (t[0] === 'address' && C.addr[t[1]]) { delete C.addr[t[1]]; return null; }
    if (t[0] === 'zone' && C.zones[t[1]]) { delete C.zones[t[1]]; return null; }
    return 'Object doesn\'t exist';
  }
  function moveCmd(d, t) {
    const C = P(d).cand;
    if (t[0] !== 'rulebase' || !['security', 'nat'].includes(t[1]) || t[2] !== 'rules') return 'Invalid syntax.';
    const k = t[1] === 'security' ? 'sec' : 'nat';
    const r = C[k].find((x) => x.name === t[3]);
    if (!r) return 'Object doesn\'t exist';
    const rest = C[k].filter((x) => x !== r);
    if (t[4] === 'top') rest.unshift(r);
    else if (t[4] === 'bottom') rest.push(r);
    else if (['before', 'after'].includes(t[4])) { const j = rest.findIndex((x) => x.name === t[5]); if (j < 0) return 'Object doesn\'t exist'; rest.splice(j + (t[4] === 'after' ? 1 : 0), 0, r); }
    else return 'Invalid syntax. (move rulebase security rules <tên> top|bottom|before <tên>|after <tên>)';
    C[k] = rest;
    return null;
  }
  /** Kiểm tra tham chiếu trước khi commit (zone / address phải tồn tại). */
  function validate(C) {
    const errs = [];
    const okAddr = (x) => x === 'any' || !!C.addr[x] || !!cidr(x);
    for (const [kind, list] of [['security', C.sec], ['nat', C.nat]]) {
      for (const r of list) {
        for (const z of [...arr(r.from), ...arr(r.to)]) if (z !== 'any' && !C.zones[z]) errs.push(`Validation Error: rulebase -> ${kind} -> rules -> ${r.name} -> zone '${z}' is not a valid reference`);
        for (const a of [...arr(r.source), ...arr(r.destination)]) if (!okAddr(a)) errs.push(`Validation Error: rulebase -> ${kind} -> rules -> ${r.name} -> '${a}' is not a valid reference`);
        if (kind === 'security' && !r.action) errs.push(`Validation Error: rulebase -> security -> rules -> ${r.name} -> action is missing`);
      }
    }
    return errs;
  }
  function commit(d) {
    const st = P(d);
    const errs = validate(st.cand);
    st.jobs += 1;
    if (errs.length) return R([`Commit job ${st.jobs} is in progress. Use Ctrl+C to return to command prompt`, '..........', ...errs, 'Configuration is invalid', '(Lab: commit THẤT BẠI — running config giữ nguyên)']);
    const warn = Object.keys(st.cand.ifs).filter((k) => !st.cand.vr.ifs.includes(k)).map((k) => `Warning: interface ${dn(k)} chưa thuộc virtual-router default → không định tuyến được`);
    st.run = clone(st.cand);
    rebuild(d);
    return R([`Commit job ${st.jobs} is in progress. Use Ctrl+C to return to command prompt`, '..............................55%..........100%', ...warn, 'Configuration committed successfully']);
  }

  // ---------------------------------------------------------------- hiển thị
  function setLines(C) {
    const L = [`set deviceconfig system hostname ${C.hostname}`];
    for (const [k, i] of Object.entries(C.ifs)) L.push(`set network interface ethernet ${dn(k)} layer3 ip ${i.ip}/${i.prefix}`);
    for (const [z, o] of Object.entries(C.zones)) L.push(`set zone ${z} network layer3 [ ${o.ifs.map(dn).join(' ')} ]`);
    if (C.vr.ifs.length) L.push(`set network virtual-router default interface [ ${C.vr.ifs.map(dn).join(' ')} ]`);
    for (const [n, r] of Object.entries(C.vr.routes)) L.push(`set network virtual-router default routing-table ip static-route ${n} destination ${r.dst ? `${r.dst.ip}/${r.dst.prefix}` : '?'} nexthop ip-address ${r.nh || '?'}`);
    for (const [n, a] of Object.entries(C.addr)) L.push(`set address ${n} ip-netmask ${a.ip}/${a.prefix}`);
    const v = (x) => (Array.isArray(x) ? `[ ${x.join(' ')} ]` : x);
    for (const r of C.sec) L.push(`set rulebase security rules ${r.name}` + ['from', 'to', 'source', 'destination', 'application', 'service', 'action', 'disabled'].filter((k) => r[k] != null).map((k) => ` ${k} ${v(r[k])}`).join(''));
    for (const r of C.nat) L.push(`set rulebase nat rules ${r.name}` + ['from', 'to', 'source', 'destination', 'service'].filter((k) => r[k] != null).map((k) => ` ${k} ${v(r[k])}`).join('') + (r.snat ? ` source-translation dynamic-ip-and-port interface-address interface ${dn(r.snat)}` : '') + (r.dnat ? ` destination-translation translated-address ${r.dnat}` : ''));
    return L;
  }
  function showSessions(d) {
    const L = ['--------------------------------------------------------------------------------', 'ID          Application    State   Type Flag  Src[Sport]/Zone/Proto (translated IP[Port])', 'Vsys                                          Dst[Dport]/Zone (translated IP[Port])', '--------------------------------------------------------------------------------'];
    const app = (c) => (c.proto === 'icmp' ? 'ping' : Object.entries(APPS).find(([, s]) => s.some((x) => x.proto === c.proto && x.port === c.dport))?.[0] || 'incomplete');
    (d.fw.conns || []).forEach((c, i) => {
      const sn = (d.natTable || []).find((e) => e.il === c.src && e.outside === c.dst && e.proto === c.proto);
      const dnat = d.nat.statics.find((x) => x.local === c.dst);
      const pr = { tcp: 6, udp: 17, icmp: 1 }[c.proto];
      L.push(`${String(1001 + i).padEnd(13)}${app(c).padEnd(15)}ACTIVE  FLOW  ${sn ? 'NS' : dnat ? 'ND' : '  '}   ${c.src}[${c.sport ?? 8}]/${d.ifaces[c.inIf]?.zone}/${pr}  (${sn ? sn.ig : c.src}[${sn ? sn.port : c.sport ?? 8}])`);
      L.push(`vsys1                                         ${dnat ? dnat.global : c.dst}[${c.dport ?? 0}]/${d.ifaces[c.outIf]?.zone}  (${c.dst}[${c.dport ?? 0}])`);
    });
    return L;
  }
  function testMatch(d, t) {
    const o = {};
    for (let i = 0; i < t.length; i += 2) o[t[i]] = t[i + 1];
    const pkt = { src: o.source, dst: o.destination, dst0: o.destination, proto: { 6: 'tcp', 17: 'udp', 1: 'icmp' }[o.protocol] || 'tcp', dport: o['destination-port'] ? +o['destination-port'] : undefined };
    const zi = o.from, zo = o.to;
    const C = P(d).run;
    const ifOf = (z) => C.zones[z]?.ifs[0];
    if (!ifOf(zi) || !ifOf(zo)) return R(['Server error : zone không tồn tại trong running config (đã commit chưa?)']);
    const r = d.fw.rules.find((x) => !x.disabled && (!x.sameZone || zi === zo) && [x.from].flat().some((z) => z === 'any' || z === zi) && [x.to].flat().some((z) => z === 'any' || z === zo) && fwAddr(pkt.src, x.src) && fwAddr(pkt.dst, x.dst) && fwSvc(pkt, x.svc));
    return R(r ? [`"${r.name}; index: ${d.fw.rules.indexOf(r) + 1}" {`, `        from ${zi};`, `        source ${pkt.src};`, `        to ${zo};`, `        destination ${pkt.dst};`, `        action ${r.action};`, '}'] : ['(không rule nào khớp → interzone-default: deny)']);
  }
  const fwAddr = (ip, spec) => spec === 'any' || (Array.isArray(spec) && spec.some((s0) => s0.net && N.inNet(ip, s0.net, s0.prefix)));
  const fwSvc = (p, svc) => svc === 'any' || (Array.isArray(svc) && svc.some((s0) => s0.proto === p.proto && (s0.port == null || s0.port === p.dport)));
  function showRoutes(d) {
    const rt = N.routeTable(N.makeCtx(net), d.id).filter((r) => r.code !== 'L');
    return ['VIRTUAL ROUTER: default (id 1)', '  ==========', 'destination                                 nexthop                                 metric flags      age   interface', ...rt.map((r) => `${`${r.net}/${r.prefix}`.padEnd(44)}${(r.nextHop || (d.ifaces[r.iface]?.ip ?? '')).padEnd(40)}${String(r.ad === 0 ? 0 : 10).padEnd(7)}${(r.code === 'C' ? 'A C' : 'A S').padEnd(11)}      ${r.code === 'C' ? dn(r.iface) : ''}`)];
  }
  function showIfs(d) {
    const C = P(d).run;
    return ['name                    id    vsys zone             forwarding               tag    address', '------------------- ----- ---- ---------------- ------------------------ ------ ------------------', ...Object.keys(d.ifaces).map((k, i) => `${dn(k).padEnd(20)}${String(16 + i).padEnd(6)}1    ${(d.ifaces[k].zone || '').padEnd(17)}${(C.vr.ifs.includes(k) ? 'vr:default' : 'N/A').padEnd(25)}0      ${C.ifs[k] ? `${C.ifs[k].ip}/${C.ifs[k].prefix}` : 'N/A'}`)];
  }

  // ---------------------------------------------------------------- thực thi 1 dòng
  function exec(d, s, line) {
    const st = P(d);
    const t = toks(line);
    if (!t.length) return R([]);
    const cmd = String(t[0]).toLowerCase();
    if (!s.panCfg) {
      if (cmd === 'configure') { s.panCfg = true; return R(['Entering configuration mode', '[edit]']); }
      if (cmd === 'show' && t[1] === 'session' && t[2] === 'all') return R(showSessions(d));
      if (cmd === 'show' && t[1] === 'running' && t[2] === 'security-policy') return R(setLines(st.run).filter((l) => l.includes('rulebase security')));
      if (cmd === 'show' && t[1] === 'routing' && t[2] === 'route') return R(showRoutes(d));
      if (cmd === 'show' && t[1] === 'interface' && t[2] === 'all') return R(showIfs(d));
      if (cmd === 'show' && t[1] === 'config' && t[2] === 'running') return R(setLines(st.run));
      if (cmd === 'test' && t[1] === 'security-policy-match') return testMatch(d, t.slice(2));
      if (cmd === 'ping' && t[1] === 'host' && N.isIp(t[2])) {
        const r = N.sendPacket(net, { src: d.id, dst: t[2], record: true });
        return R([`PING ${t[2]} (${t[2]}) 56(84) bytes of data.`, ...(r.ok ? [1, 2, 3].map((i) => `64 bytes from ${t[2]}: icmp_seq=${i} ttl=${r.ttl} time=0.${i + 3} ms`) : []), '', `--- ${t[2]} ping statistics ---`, `3 packets transmitted, ${r.ok ? 3 : 0} received, ${r.ok ? 0 : 100}% packet loss`], { why: r.ok ? null : r.fail?.why, ok: r.ok });
      }
      return R(['Unknown command: ' + t[0], '(Lab: chế độ vận hành — "configure" để cấu hình; show session all · show routing route · show interface all · test security-policy-match · ping host <ip>)']);
    }
    if (cmd === 'exit' || cmd === 'quit') {
      s.panCfg = false;
      const dirty = JSON.stringify(st.cand) !== JSON.stringify(st.run);
      return R(dirty ? ['Exiting configuration mode', '(Lab: CẢNH BÁO — còn thay đổi CHƯA commit, chưa có tác dụng!)'] : ['Exiting configuration mode']);
    }
    if (cmd === 'set') { const e = setCmd(d, t.slice(1)); return R(e ? [e] : []); }
    if (cmd === 'delete') { const e = delCmd(d, t.slice(1)); return R(e ? [e] : []); }
    if (cmd === 'move') { const e = moveCmd(d, t.slice(1)); return R(e ? [e] : []); }
    if (cmd === 'commit') return commit(d);
    if (cmd === 'show' && t[1] === 'config' && t[2] === 'diff') {
      const a = setLines(st.run), b = setLines(st.cand);
      const L = [...a.filter((x) => !b.includes(x)).map((x) => '- ' + x), ...b.filter((x) => !a.includes(x)).map((x) => '+ ' + x)];
      return R(L.length ? L : ['(không có thay đổi chưa commit)']);
    }
    if (cmd === 'show') return R(setLines(st.cand).filter((l) => !t[1] || l.includes(t.slice(1).flat().join(' '))));
    if (cmd === 'run') return exec(d, { ...s, panCfg: false }, line.replace(/^run\s+/, ''));
    return R(['Unknown command: ' + t[0]]);
  }
  function prompt(d, s) { return `admin@${P(d).run.hostname || d.name}${s.panCfg ? '#' : '>'} `; }
  return { exec, prompt, rebuild };
}
