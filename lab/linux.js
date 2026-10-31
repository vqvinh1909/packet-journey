// lab/linux.js — dòng lệnh Linux giả lập cho máy chủ trong sandbox: chỉ gồm nhóm lệnh quản trị mạng hay dùng
// (ip, ss, curl, nc, dig, systemctl, ufw...). Mọi kết nối đều đi qua N.sendPacket nên ACL, NAT, firewall trên đường vẫn có tác dụng.

import * as N from './net.js';
import { compileBpf, sniffQuery, tcpdumpLine } from './sniff.js';

const UNITS = { ssh: { ports: [22], proc: 'sshd' }, nginx: { ports: [80, 443], proc: 'nginx' }, mysql: { ports: [3306], proc: 'mysqld' }, postgresql: { ports: [5432], proc: 'postgres' } };
const PORT_NAMES = { ssh: 22, http: 80, https: 443, dns: 53, domain: 53, mysql: 3306, postgresql: 5432 };

/** Máy chủ Linux: ban đầu chỉ có ssh chạy, ufw tắt, đăng nhập SSH bằng admin / admin. */
export function linuxDevice(id, name, x, y) {
  const d = N.server(id, name, x, y, { services: [22], cloud: false });
  d.shell = 'linux';
  d.badge = 'LNX';
  d.users = { admin: { pw: 'admin' } };
  d.units = Object.fromEntries(Object.keys(UNITS).map((u) => [u, { active: u === 'ssh', enabled: u === 'ssh' }]));
  d.ufw = { on: false, rules: [] };
  return d;
}
/** Load Balancer: máy Linux có thêm d.lb = { <cổng nghe>: { algo, next, backends: [{ ip, port }] } }. */
export function lbDevice(id, name, x, y) { return Object.assign(linuxDevice(id, name, x, y), { badge: 'LB', lb: {} }); }
const syncServices = (d) => { d.services = [...new Set([...Object.entries(d.units).flatMap(([u, s]) => (s.active ? UNITS[u].ports : [])), ...Object.keys(d.lb || {}).map(Number)])]; };

const parsePort = (v) => { const p = String(v ?? '').split('/')[0].toLowerCase(), n = PORT_NAMES[p] ?? +p; return n >= 1 && n <= 65535 ? n : null; };
const parseCidr = (v) => { const [ip, len] = String(v ?? '').split('/'); return N.isIp(ip) && (len == null || (+len >= 0 && +len <= 32)) ? (len == null ? ip : `${ip}/${+len}`) : null; };
const HELP = [
  'Lệnh được mô phỏng:',
  'ip a | ip addr add <IP>/<len> dev eth0 | ip addr flush dev eth0 | ip link | ip neigh',
  'ip route | ip route add default via <IP> | ip route del default',
  'dhclient                     Xin IP bằng DHCP',
  'ping [-c n] <đích>           traceroute <đích>',
  'ss -tulnp                    Xem cổng đang nghe (có thể dùng netstat -tulnp)',
  'curl <url>                   nc -zv <đích> <cổng>',
  'dig <tên> [@máy chủ]         nslookup <tên> [máy chủ]',
  'resolvectl dns eth0 <IP>     resolvectl status · cat /etc/resolv.conf',
  'systemctl status|start|stop|restart|enable|disable <dịch vụ> · systemctl list-units',
  '                             Dịch vụ: ' + Object.keys(UNITS).join(', '),
  'ufw status | enable | disable | reset',
  'ufw allow|deny <cổng> · ufw allow|deny from <IP[/len]> [to any port <cổng>] · ufw delete <số>',
  'tcpdump [-i eth0|any] [-c n] [icmp|arp|tcp|udp] [host <IP>] [port <n>]',
  'nmap [-p 22,80] <đích>       journalctl [-u <dịch vụ>] [-n số dòng]',
  'iptables -L                  ps aux · df -h · free -m',
  'ssh <user>@<IP> · hostname · uname -a · whoami',
];
const NMAP_PORTS = { 22: 'ssh', 23: 'telnet', 25: 'smtp', 49: 'tacacs', 53: 'domain', 80: 'http', 123: 'ntp', 161: 'snmp', 443: 'https', 514: 'syslog', 3000: 'ppp', 3306: 'mysql', 5432: 'postgresql' };
const SAMPLE = '(Lab: số liệu mẫu, không đo từ mô phỏng)';
const logTime = () => { const t = new Date(N.clock.now()); return `${t.toDateString().slice(4, 10)} ${t.toTimeString().slice(0, 8)}`; };
const LB_HELP = [
  'lb add <cổng> <IP>[:cổng]    Thêm backend (cổng nghe tự mở) · lb del <cổng> <IP>[:cổng]',
  'lb algo <cổng> roundrobin|source   Cách chia tải · lb show   Xem backend UP/DOWN',
];

export function makeLinux({ net, R, sshConnect }) {
  /** Hỏi DNS qua UDP 53: { ok, ip?, nx?, server? }. Máy đích phải mở cổng 53 và có bảng tên miền. */
  function dnsQuery(d, name, server) {
    const srv = server || d.dns;
    if (!srv) return { ok: false, why: 'Máy chưa có DNS: resolvectl dns eth0 <IP>' };
    const r = N.sendPacket(net, { src: d.id, dst: srv, proto: 'udp', dport: 53 });
    const t = r.ok && net.devices[r.at.dev];
    if (!t || !t.services?.includes(53)) return { ok: false, server: srv, why: r.ok ? `${srv} không chạy dịch vụ DNS` : r.fail?.why };
    const ip = t.zone?.[name.toLowerCase().replace(/\.$/, '')];
    return ip ? { ok: true, ip, server: srv } : { ok: false, nx: true, server: srv };
  }
  /** Tên hoặc IP → IP. Trả { ip } hoặc { err }. */
  function resolveHost(d, host) {
    if (host === 'localhost') return { ip: '127.0.0.1' };
    if (N.isIp(host)) return { ip: host };
    const r = dnsQuery(d, host);
    return r.ok ? { ip: r.ip } : { err: r.nx ? `${host} không có trong DNS ${r.server}` : r.why || 'DNS không trả lời' };
  }
  // Tới chính máy mình đi qua loopback: không ra dây, không qua ufw, chỉ phụ thuộc dịch vụ có chạy hay không.
  const isLocal = (d, ip) => ip.startsWith('127.') || ip === d.ip;
  const tcp = (d, ip, port) => {
    if (!isLocal(d, ip)) return N.sendPacket(net, { src: d.id, dst: ip, proto: 'tcp', dport: port, record: true, anim: true });
    const ok = d.services.includes(port);
    return { ok, kind: ok ? 'open' : 'refused', at: { dev: d.id } };
  };
  // Health check: LB tự mở TCP tới backend, nên dây đứt, dịch vụ tắt, ufw hay ACL đều làm backend DOWN.
  const backendUp = (d, b) => N.sendPacket(net, { src: d.id, dst: b.ip, proto: 'tcp', dport: b.port }).ok;
  /** Trả lời của LB cho client: chọn backend còn sống, không còn backend nào thì 503. */
  function lbReply(t, port, clientIp) {
    const f = t.lb[port], alive = f.backends.filter((b) => backendUp(t, b));
    if (!alive.length) return { lines: ['HTTP/1.1 503 Service Unavailable', `Server: ${t.name}`, '', '<h1>No backend available</h1>'], ok: false, why: `${t.name} nhận được kết nối nhưng không còn backend nào sống. Xem: lb show` };
    const b = f.algo === 'source' ? alive[[...clientIp].reduce((s, c) => s + c.charCodeAt(0), 0) % alive.length] : alive[f.next++ % alive.length];
    const be = net.devices[N.sendPacket(net, { src: t.id, dst: b.ip, proto: 'tcp', dport: b.port }).at.dev];
    return { lines: ['HTTP/1.1 200 OK', `Server: ${be.name}`, `Via: ${t.name}`, `X-Forwarded-For: ${clientIp}`, '', `<h1>It works: ${be.name} (${b.ip}:${b.port})</h1>`], ok: true };
  }
  function lbCmd(d, w) {
    const act = (w[1] || 'show').toLowerCase(), port = parsePort(w[2]), f = d.lb[port];
    if (act === 'show') {
      const L = Object.entries(d.lb).flatMap(([p, x]) => [`Frontend :${p} (${x.algo})`, ...x.backends.map((b) => `  ${b.ip}:${b.port}  ${backendUp(d, b) ? 'UP' : 'DOWN'}`)]);
      return R(L.length ? L : ['Chưa có frontend. Thêm: lb add 80 10.0.2.11']);
    }
    if (act === 'algo') {
      if (!f || !['roundrobin', 'source'].includes(w[3])) return R(['Cú pháp: lb algo <cổng đã có> roundrobin|source']);
      f.algo = w[3];
      return R([]);
    }
    if (act === 'add' || act === 'del') {
      const [ip, bp] = String(w[3] || '').split(':'), bport = bp == null ? port : parsePort(bp);
      if (!port || !N.isIp(ip) || !bport) return R([`Cú pháp: lb ${act} <cổng> <IP>[:cổng]`]);
      if (act === 'add') {
        const x = (d.lb[port] ||= { algo: 'roundrobin', next: 0, backends: [] });
        if (!x.backends.some((b) => b.ip === ip && b.port === bport)) x.backends.push({ ip, port: bport });
      } else if (f) {
        f.backends = f.backends.filter((b) => !(b.ip === ip && b.port === bport));
        if (!f.backends.length) delete d.lb[port];
      }
      syncServices(d);
      return R([]);
    }
    return R(LB_HELP);
  }
  function ipCmd(d, w) {
    const sub = (w[1] || 'a').toLowerCase();
    const dev = w.indexOf('dev') > 0 ? w[w.indexOf('dev') + 1] : 'eth0';
    if (dev !== 'eth0') return R([`Cannot find device "${dev}"`]);
    if (['a', 'addr', 'address'].includes(sub)) {
      const act = (w[2] || 'show').toLowerCase();
      if (act === 'show') return R(['1: lo: <LOOPBACK,UP> mtu 65536 state UNKNOWN', '    inet 127.0.0.1/8 scope host lo', `2: eth0: <BROADCAST,MULTICAST${up(d) ? ',UP,LOWER_UP' : ''}> mtu 1500 state ${up(d) ? 'UP' : 'DOWN'}`, `    link/ether ${N.epMac(net, { dev: d.id, ifn: 'fa0' })} brd ff:ff:ff:ff:ff:ff`, ...(d.ip ? [`    inet ${d.ip}/${d.prefix} scope global ${d.dhcp ? 'dynamic ' : ''}eth0`] : [])]);
      if (act === 'add') {
        const [ip, len] = String(w[3] || '').split('/');
        if (!N.isIp(ip) || !(+len >= 1 && +len <= 32)) return R(['Error: any valid prefix is expected, vd: ip addr add 10.0.0.10/24 dev eth0']);
        if (d.ip) return R(['Error: lab chỉ giữ 1 địa chỉ, gõ ip addr flush dev eth0 trước.']);
        d.ip = ip; d.prefix = +len; d.dhcp = false;
        return R([]);
      }
      if (act === 'flush' || act === 'del') { d.ip = ''; d.gateway = ''; d.dhcp = false; return R([]); }
      return R(['Cú pháp: ip addr [show | add <IP>/<len> dev eth0 | flush dev eth0]']);
    }
    if (sub === 'link' || sub === 'l') return R([`2: eth0: <BROADCAST,MULTICAST${up(d) ? ',UP,LOWER_UP' : ''}> mtu 1500 state ${up(d) ? 'UP' : 'DOWN'}`, `    link/ether ${N.epMac(net, { dev: d.id, ifn: 'fa0' })} brd ff:ff:ff:ff:ff:ff`]);
    if (sub === 'neigh' || sub === 'n') return R(Object.entries(d.arp || {}).map(([ip, e]) => `${ip} dev eth0 lladdr ${e.mac} REACHABLE`));
    if (sub === 'route' || sub === 'r') {
      const act = (w[2] || 'show').toLowerCase();
      if (act === 'show') return R([...(d.gateway ? [`default via ${d.gateway} dev eth0`] : []), ...(d.ip ? [`${N.netOf(d.ip, d.prefix)}/${d.prefix} dev eth0 proto kernel scope link src ${d.ip}`] : [])]);
      if (act === 'add' && w[3] === 'default' && w[4] === 'via' && N.isIp(w[5])) {
        if (!d.ip || !N.inNet(w[5], d.ip, d.prefix)) return R(['Error: Nexthop has invalid gateway.'], { why: `Gateway ${w[5]} phải cùng subnet với eth0 (${d.ip ? `${d.ip}/${d.prefix}` : 'chưa có IP'}).` });
        if (d.gateway) return R(['RTNETLINK answers: File exists'], { why: 'Đã có default route: ip route del default trước.' });
        d.gateway = w[5];
        return R([]);
      }
      if (act === 'del' && w[3] === 'default') { if (!d.gateway) return R(['RTNETLINK answers: No such process']); d.gateway = ''; return R([]); }
      return R(['Cú pháp: ip route [show | add default via <IP> | del default]']);
    }
    return R([`Object "${w[1]}" is unknown, try "ip help".`]);
  }
  const up = (d) => !!N.linkAt(net, d.id, 'fa0');
  function ping(d, w) {
    const c = w.indexOf('-c'), n = c > 0 && /^\d+$/.test(w[c + 1] || '') ? Math.min(20, Math.max(1, +w[c + 1])) : 4;
    const host = w.slice(1).find((x, i) => !x.startsWith('-') && !(c > 0 && i + 1 === c + 1));
    if (!host) return R(['ping: usage error: Destination address required']);
    const h = resolveHost(d, host);
    if (h.err) return R([`ping: ${host}: Name or service not known`], { why: h.err, ok: false });
    const r = isLocal(d, h.ip) ? { ok: true, ttl: 64 } : N.sendPacket(net, { src: d.id, dst: h.ip, record: true, anim: true });
    if (r.fail?.kind === 'nogw' || r.fail?.kind === 'noip') return R(['ping: connect: Network is unreachable'], { why: r.fail.why, ok: false });
    const L = [`PING ${host} (${h.ip}) 56(84) bytes of data.`];
    for (let i = 1; i <= n && r.ok; i++) L.push(`64 bytes from ${h.ip}: icmp_seq=${i} ttl=${r.ttl ?? 64} time=${(0.5 + i / 10).toFixed(2)} ms`);
    L.push('', `--- ${host} ping statistics ---`, `${n} packets transmitted, ${r.ok ? n : 0} received, ${r.ok ? 0 : 100}% packet loss`);
    return R(L, { sim: r.sim, simLabel: `${d.name} ping ${h.ip}`, why: r.ok ? null : r.fail?.why, ok: r.ok });
  }
  function traceroute(d, w) {
    if (!w[1]) return R(['Usage: traceroute <đích>']);
    const h = resolveHost(d, w[1]);
    if (h.err) return R([`${w[1]}: Name or service not known`], { why: h.err, ok: false });
    const r = N.sendPacket(net, { src: d.id, dst: h.ip, anim: true });
    if (r.fail?.kind === 'nogw' || r.fail?.kind === 'noip') return R(['connect: Network is unreachable'], { why: r.fail.why, ok: false });
    const L = [`traceroute to ${w[1]} (${h.ip}), 30 hops max, 60 byte packets`];
    let n = 0;
    for (const x of r.hops) if (x.ip !== h.ip) L.push(` ${++n}  ${x.ip}  ${n}.0 ms`);
    L.push(` ${++n}  ${r.ok ? `${h.ip}  ${n}.0 ms` : '* * *'}`);
    return R(L, { sim: r.sim, simLabel: `${d.name} traceroute ${h.ip}`, why: r.ok ? null : r.fail?.why, ok: r.ok });
  }
  function curl(d, w) {
    const url = w.slice(1).find((x) => !x.startsWith('-'));
    const m = String(url || '').match(/^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?/i);
    if (!m) return R(['curl: try \'curl <url>\'']);
    const host = m[2], port = m[3] ? +m[3] : m[1]?.toLowerCase() === 'https' ? 443 : 80;
    const h = resolveHost(d, host);
    if (h.err) return R([`curl: (6) Could not resolve host: ${host}`], { why: h.err, ok: false });
    const r = tcp(d, h.ip, port);
    const x = { sim: r.sim, simLabel: `curl ${h.ip}:${port}`, ok: r.ok };
    if (r.kind === 'refused') return R([`curl: (7) Failed to connect to ${host} port ${port}: Connection refused`], { ...x, why: 'Mạng thông nhưng không có dịch vụ nghe cổng này.' });
    if (!r.ok) return R([`curl: (28) Failed to connect to ${host} port ${port}: Connection timed out`], { ...x, why: r.fail?.why });
    const t = net.devices[r.at.dev];
    if (t.lb?.[port]) { const a = lbReply(t, port, d.ip); return R(a.lines, { ...x, ok: a.ok, why: a.why }); }
    return R(port === 80 || port === 443 ? ['HTTP/1.1 200 OK', `Server: ${net.devices[r.at.dev].name}`, '', '<h1>It works</h1>'] : [`curl: (52) Empty reply from server (cổng ${port} mở nhưng không phải web)`], x);
  }
  function nc(d, w) {
    const a = w.slice(1).filter((x) => !x.startsWith('-')), port = parsePort(a[1]);
    if (!a[0] || !port) return R(['Cú pháp: nc -zv <đích> <cổng>']);
    const h = resolveHost(d, a[0]);
    if (h.err) return R([`nc: getaddrinfo for host "${a[0]}" port ${port}: Name or service not known`], { why: h.err, ok: false });
    const r = tcp(d, h.ip, port);
    const x = { sim: r.sim, simLabel: `nc ${h.ip}:${port}`, ok: r.ok };
    if (r.ok) return R([`Connection to ${a[0]} ${port} port [tcp/*] succeeded!`], x);
    return R([`nc: connect to ${a[0]} port ${port} (tcp) ${r.kind === 'refused' ? 'failed: Connection refused' : 'timed out: Operation now in progress'}`], { ...x, why: r.kind === 'refused' ? 'Mạng thông nhưng không có dịch vụ nghe cổng này.' : r.fail?.why });
  }
  function dig(d, w, style) {
    const a = w.slice(1).filter((x) => !x.startsWith('+'));
    const name = a.find((x) => !x.startsWith('@')), at = a.find((x) => x.startsWith('@'))?.slice(1) || (style === 'nslookup' ? a[1] : null);
    if (!name) return R([style === 'nslookup' ? 'Cú pháp: nslookup <tên> [máy chủ]' : 'Cú pháp: dig <tên> [@máy chủ]']);
    const r = dnsQuery(d, name, at);
    if (!r.ok && !r.nx) return R([';; connection timed out; no servers could be reached'], { why: r.why, ok: false });
    if (style === 'nslookup') return R([`Server:\t\t${r.server}`, '', ...(r.ok ? [`Name:\t${name}`, `Address: ${r.ip}`] : [`** server can't find ${name}: NXDOMAIN`])], { ok: r.ok });
    if (w.includes('+short')) return R(r.ok ? [r.ip] : []);
    return R([`;; ->>HEADER<<- opcode: QUERY, status: ${r.ok ? 'NOERROR' : 'NXDOMAIN'}`, ...(r.ok ? [';; ANSWER SECTION:', `${name}.\t300\tIN\tA\t${r.ip}`] : []), `;; SERVER: ${r.server}#53(${r.server})`], { ok: r.ok });
  }
  function systemctl(d, w) {
    const act = (w[1] || 'list-units').toLowerCase();
    if (act === 'list-units') return R(Object.entries(d.units).map(([u, s]) => `${u}.service  ${s.active ? 'active (running)' : 'inactive (dead)'}  ${s.enabled ? 'enabled' : 'disabled'}`));
    const u = String(w[2] || '').replace(/\.service$/, '').replace(/^sshd$/, 'ssh');
    if (!w[2]) return R([`Cú pháp: systemctl ${act} <dịch vụ>`]);
    const s = d.units[u];
    if (!s) return R([`Unit ${w[2]}.service could not be found.`], { why: `Lab có các dịch vụ: ${Object.keys(UNITS).join(', ')}.` });
    if (act === 'status') return R([`● ${u}.service`, `     Loaded: loaded (${s.enabled ? 'enabled' : 'disabled'})`, `     Active: ${s.active ? 'active (running)' : 'inactive (dead)'}`, ...(s.active ? [`     Listen: ${UNITS[u].ports.join(', ')}/tcp`] : [])]);
    if (act === 'start' || act === 'restart') s.active = true;
    else if (act === 'stop') s.active = false;
    else if (act === 'enable') s.enabled = true;
    else if (act === 'disable') s.enabled = false;
    else return R([`Unknown command verb ${act}.`]);
    syncServices(d);
    const verb = { start: 'Started', restart: 'Restarted', stop: 'Stopped', enable: 'Enabled', disable: 'Disabled' }[act];
    (d.journal ||= []).push({ u, line: `${logTime()} ${d.name} systemd[1]: ${verb} ${u}.service.` });
    if (d.journal.length > 100) d.journal.shift();
    return R([]);
  }
  function journalctl(d, w) {
    const iu = w.indexOf('-u'), inn = w.indexOf('-n');
    const u = iu > 0 ? String(w[iu + 1] || '').replace(/\.service$/, '').replace(/^sshd$/, 'ssh') : null;
    if (u && !d.units[u]) return R(['-- No entries --']);
    const boot = Object.entries(d.units).filter(([k, s]) => s.enabled && (!u || k === u)).map(([k]) => `${logTime()} ${d.name} systemd[1]: Started ${k}.service.`);
    const L = [...boot, ...(d.journal || []).filter((e) => !u || e.u === u).map((e) => e.line)];
    const n = inn > 0 && /^\d+$/.test(w[inn + 1] || '') ? +w[inn + 1] : L.length;
    return R(L.length ? (n ? L.slice(-n) : []) : ['-- No entries --']);
  }
  function tcpdump(d, w) {
    const pick = (flag) => { const i = w.indexOf(flag); return i > 0 ? w.splice(i, 2)[1] : null; };
    w = [...w];
    const ifn = pick('-i') || 'eth0', count = pick('-c');
    if (ifn !== 'eth0' && ifn !== 'any') return R([`tcpdump: ${ifn}: No such device exists`]);
    const fn = compileBpf(w.slice(1).filter((x) => !x.startsWith('-')));
    if (!fn) return R(['tcpdump: can\'t parse filter expression: syntax error']);
    const pkts = sniffQuery(net, d.id, null, fn, /^\d+$/.test(count || '') ? +count : 30);
    return R(['tcpdump: verbose output suppressed, use -v[v]... for full protocol decode', `listening on ${ifn}, link-type EN10MB (Ethernet), snapshot length 262144 bytes`, ...pkts.map(tcpdumpLine), '', `${pkts.length} packets captured`, `${pkts.length} packets received by filter`, '0 packets dropped by kernel', '(Lab: in lại các gói gần đây qua máy này; tạo lưu lượng rồi gõ lại)']);
  }
  function nmap(d, w) {
    w = [...w];
    const ip = w.indexOf('-p'), list = ip > 0 ? w.splice(ip, 2)[1] : null;
    const host = w.slice(1).find((x) => !x.startsWith('-'));
    if (!host) return R(['Cú pháp: nmap [-p 22,80] <đích>']);
    const h = resolveHost(d, host);
    if (h.err) return R([`Failed to resolve "${host}".`, 'WARNING: No targets were specified, so 0 hosts scanned.'], { why: h.err, ok: false });
    const ports = list ? list.split(',').map(parsePort) : Object.keys(NMAP_PORTS).map(Number);
    if (ports.some((p) => !p)) return R(['Error #485: Your port specifications are illegal.']);
    const res = ports.map((port) => ({ port, ...(isLocal(d, h.ip) ? tcp(d, h.ip, port) : N.sendPacket(net, { src: d.id, dst: h.ip, proto: 'tcp', dport: port })) }));
    const st = (r) => (r.ok ? 'open' : r.kind === 'refused' ? 'closed' : 'filtered');
    if (res.every((r) => st(r) === 'filtered')) return R([`Starting Nmap 7.94 ( https://nmap.org )`, 'Note: Host seems down or every port is filtered.', 'Nmap done: 1 IP address (0 hosts up) scanned'], { why: res[0].fail?.why, ok: false });
    const shown = res.filter((r) => list || st(r) !== 'closed');
    const hidden = res.length - shown.length;
    return R(['Starting Nmap 7.94 ( https://nmap.org )', `Nmap scan report for ${host}${host === h.ip ? '' : ` (${h.ip})`}`, 'Host is up.', ...(hidden ? [`Not shown: ${hidden} closed tcp ports (conn-refused)`] : []), 'PORT     STATE    SERVICE', ...shown.map((r) => `${`${r.port}/tcp`.padEnd(9)}${st(r).padEnd(9)}${NMAP_PORTS[r.port] || 'unknown'}`), '', 'Nmap done: 1 IP address (1 host up) scanned']);
  }
  function iptables(d, w) {
    if (!w.some((x) => /^-\w*L/.test(x))) return R(['(Lab: chỉ mô phỏng iptables -L để xem; đổi luật bằng ufw)']);
    const rows = d.ufw.on ? d.ufw.rules.map((r) => `${r.action === 'allow' ? 'ACCEPT' : 'DROP'.padEnd(6)}  ${r.port ? 'tcp ' : 'all '} --  ${(r.from || 'anywhere').padEnd(19)} anywhere${r.port ? `   tcp dpt:${r.port}` : ''}`) : [];
    return R([`Chain INPUT (policy ${d.ufw.on ? 'DROP' : 'ACCEPT'})`, 'target  prot opt source              destination', ...rows, '', 'Chain FORWARD (policy ACCEPT)', 'target  prot opt source              destination', '', 'Chain OUTPUT (policy ACCEPT)', 'target  prot opt source              destination']);
  }
  function ps(d) {
    const procs = Object.entries(d.units).filter(([, s]) => s.active).map(([u], i) => `root      ${String(412 + i * 37).padStart(5)}  0.0  0.4  ${UNITS[u].proc}`);
    return R(['USER        PID %CPU %MEM COMMAND', 'root          1  0.0  0.3  /sbin/init', ...procs, SAMPLE]);
  }
  const df = () => R(['Filesystem      Size  Used Avail Use% Mounted on', '/dev/sda1        20G  4.2G   15G  22% /', 'tmpfs           2.0G     0  2.0G   0% /run', SAMPLE]);
  const free = () => R(['               total        used        free      shared  buff/cache   available', 'Mem:            2048         312        1402           1         334        1610', 'Swap:           1024           0        1024', SAMPLE]);
  function ss(d) {
    const row = (p, proc) => `tcp   LISTEN 0.0.0.0:${p}${' '.repeat(Math.max(1, 14 - String(p).length))}users:(("${proc}"))`;
    return R(['Netid State  Local Address:Port  Process', ...Object.entries(d.units).filter(([, s]) => s.active).flatMap(([u]) => UNITS[u].ports.map((p) => row(p, UNITS[u].proc))), ...Object.keys(d.lb || {}).map((p) => row(p, 'lb'))]);
  }
  function ufw(d, w) {
    const F = d.ufw, act = (w[1] || '').toLowerCase();
    const show = (r) => `${r.port ?? 'Anywhere'}  ${r.action.toUpperCase()} IN  ${r.from || 'Anywhere'}`;
    if (act === 'status') {
      if (!F.on) return R(['Status: inactive']);
      return R(['Status: active', ...(w[2] === 'verbose' ? ['Default: deny (incoming), allow (outgoing)'] : []), '', 'To  Action  From', '--  ------  ----', ...F.rules.map((r, i) => (w[2] === 'numbered' ? `[${i + 1}] ` : '') + show(r))]);
    }
    if (act === 'enable') { F.on = true; return R(['Firewall is active and enabled on system startup'], F.rules.some((r) => r.action === 'allow' && (r.port === 22 || r.port == null)) ? {} : { why: 'Mặc định chặn mọi kết nối vào. Chưa có luật cho phép cổng 22 thì SSH vào máy này sẽ bị chặn.' }); }
    if (act === 'disable') { F.on = false; return R(['Firewall stopped and disabled on system startup']); }
    if (act === 'reset') { d.ufw = { on: false, rules: [] }; return R(['Resetting all rules to installed defaults.']); }
    if (act === 'delete') {
      const i = +w[2] - 1;
      if (!F.rules[i]) return R(['ERROR: Could not find rule']);
      F.rules.splice(i, 1);
      return R(['Rule deleted']);
    }
    if (act === 'allow' || act === 'deny') {
      let port = null, from = null;
      if (w[2] === 'from') {
        from = parseCidr(w[3]);
        if (!from) return R(['ERROR: Bad source address']);
        if (w[4]) { if (w[4] !== 'to' || w[5] !== 'any' || w[6] !== 'port') return R(['ERROR: Wrong number of arguments']); port = parsePort(w[7]); if (!port) return R(['ERROR: Bad port']); }
      } else { port = parsePort(w[2]); if (!port) return R(['ERROR: Bad port']); }
      F.rules.push({ action: act, port, from });
      return R(['Rules updated']);
    }
    return R(['Cú pháp: ufw status | enable | disable | reset | allow|deny <cổng> | allow|deny from <IP[/len]> [to any port <cổng>] | delete <số>']);
  }
  function exec(d, s, line) {
    const w = line.replace(/^sudo\s+/, '').split(/\s+/).filter(Boolean);
    const cmd = (w[0] || '').toLowerCase();
    if (!cmd) return R([]);
    if (cmd === '?' || cmd === 'help') return R(d.lb ? [...HELP, ...LB_HELP] : HELP);
    if (cmd === 'lb' && d.lb) return lbCmd(d, w);
    if (cmd === 'ip') return ipCmd(d, w);
    if (cmd === 'ping') return ping(d, w);
    if (cmd === 'traceroute') return traceroute(d, w);
    if (cmd === 'curl') return curl(d, w);
    if (cmd === 'nc') return nc(d, w);
    if (cmd === 'dig' || cmd === 'nslookup') return dig(d, w, cmd);
    if (cmd === 'systemctl') return systemctl(d, w);
    if (cmd === 'ss' || cmd === 'netstat') return ss(d);
    if (cmd === 'ufw') return ufw(d, w);
    if (cmd === 'tcpdump') return tcpdump(d, w);
    if (cmd === 'journalctl') return journalctl(d, w);
    if (cmd === 'nmap') return nmap(d, w);
    if (cmd === 'iptables') return iptables(d, w);
    if (cmd === 'ps') return ps(d);
    if (cmd === 'df') return df();
    if (cmd === 'free') return free();
    if (cmd === 'hostname') return R([d.name]);
    if (cmd === 'whoami') return R(['root']);
    if (cmd === 'uname') return R([`Linux ${d.name} (mô phỏng)`]);
    if (cmd === 'dhclient') {
      const r = N.dhcpRequest(net, d.id, { record: true, anim: true });
      d.dhcp = true;
      if (!r.ok) return R(['No DHCPOFFERS received.'], { sim: r.sim, simLabel: `${d.name} DHCP (thất bại)`, why: r.why, ok: false });
      d.ip = r.ip; d.prefix = r.prefix; d.gateway = r.gw; d.dns = r.dns;
      return R([`bound to ${r.ip} -- renewal in 43200 seconds.`], { sim: r.sim, simLabel: `${d.name} DHCP`, ok: true });
    }
    if (cmd === 'resolvectl') {
      if (w[1] === 'dns' && w[2] === 'eth0' && N.isIp(w[3])) { d.dns = w[3]; return R([]); }
      if (w[1] === 'status' || !w[1]) return R([`Link 2 (eth0)`, `  Current DNS Server: ${d.dns || '(chưa có)'}`]);
      return R(['Cú pháp: resolvectl dns eth0 <IP> | resolvectl status']);
    }
    if (cmd === 'cat') return R(w[1] === '/etc/resolv.conf' ? (d.dns ? [`nameserver ${d.dns}`] : ['# chưa có DNS']) : [`cat: ${w[1] || ''}: lab chỉ mô phỏng /etc/resolv.conf`]);
    if (cmd === 'ssh') {
      const m = String(w[1] || '').match(/^([^@\s]+)@(\S+)$/);
      if (!m || !N.isIp(m[2])) return R(['Cú pháp: ssh <user>@<IP>']);
      return sshConnect(d, m[2], m[1], s);
    }
    return R([`${w[0]}: command not found`], { why: 'Đây là Linux mô phỏng, gõ ? để xem các lệnh có sẵn.' });
  }
  return { exec, curl, prompt: (d) => `root@${d.name}:~# ` };
}
