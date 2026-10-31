// tests/diagtools.test.js — thông tin phần cứng đúng thực tế và lệnh chẩn đoán: show inventory, debug ip packet,
// packet-tracer (ASA), diagnose sniffer / debug flow (FortiGate), show system info (Palo Alto), tcpdump, nmap... (Linux).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lab/net.js';
import * as S from '../lab/sandbox.js';
import { createCli, runScript } from '../lab/ios.js';
import { compileBpf } from '../lab/sniff.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
const add = (net, kind, o = {}) => S.addDevice(net, kind, 100, 100, { off: false, ...o });
const out = (cli, dev, cmd) => cli.exec(dev, cmd).out.join('\n');

test('show version đúng model theo số cổng, image đúng dòng switch', () => {
  const net = S.emptySandbox();
  const s8 = add(net, 'sw2960', { ports: 8 }), s48 = add(net, 'sw2960', { ports: 48 }), l3 = add(net, 'sw3560', { ports: 8 }), l48 = add(net, 'sw3560', { ports: 48 });
  const cli = createCli(net);
  const ver = (d) => { cli.exec(d, 'enable'); return out(cli, d, 'show version'); };
  assert.match(ver(s8), /WS-C2960-8TT-L/);
  assert.match(ver(s48), /WS-C2960-48TT-L/);
  assert.match(ver(l48), /WS-C3560-48TS-S/);
  const v3 = ver(l3);
  assert.match(v3, /WS-C3560-8PC-S/);
  assert.match(v3, /flash:c3560-ipbasek9-mz\.150-2\.SE4\.bin/);
  assert.doesNotMatch(v3, /c2960|LANBASE/);
  assert.match(out(cli, l3, 'show inventory'), /PID: WS-C3560-8PC-S/);
});

test('show running-config cùng phiên bản với show version, kể cả chưa có flash', () => {
  const net = S.emptySandbox();
  const r = add(net, 'router'), sw = add(net, 'sw2960');
  const cli = createCli(net);
  runScript(cli, r, ['enable']); runScript(cli, sw, ['enable']);
  assert.match(out(cli, r, 'show running-config'), /^version 15\.1$/m);
  assert.match(out(cli, sw, 'show running-config'), /^version 15\.0$/m);
  net.devices[r].version = '15.7(3)M8';
  assert.match(out(cli, r, 'show running-config'), /^version 15\.7$/m);
});

test('cổng Serial không dùng ARP; cổng Ethernet vẫn dùng', () => {
  const net = S.emptySandbox();
  const r1 = add(net, 'router'), r2 = add(net, 'router'), pc = add(net, 'pc'), sw = add(net, 'sw2960');
  S.connect(net, r1, 's0/0/0', r2, 's0/0/0');
  S.connect(net, r1, 'g0/0', sw, 'g0/1');
  S.connect(net, pc, 'fa0', sw, 'fa0/1');
  const cli = createCli(net);
  runScript(cli, r1, cfg('interface s0/0/0', 'ip address 10.9.9.1 255.255.255.252', 'clock rate 64000', 'no shutdown', 'interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown'));
  runScript(cli, r2, cfg('interface s0/0/0', 'ip address 10.9.9.2 255.255.255.252', 'no shutdown'));
  cli.exec(pc, 'ip 10.0.0.10/24 10.0.0.1');
  cli.exec(r1, 'enable');
  assert.match(out(cli, r1, 'ping 10.9.9.2'), /^!!!!!$/m);
  assert.match(out(cli, r1, 'ping 10.0.0.10'), /^\.!!!!$/m);
  const arp = out(cli, r1, 'show arp');
  assert.doesNotMatch(arp, /Serial/);
  assert.match(arp, /10\.0\.0\.10/);
  assert.deepEqual(Object.keys(net.devices[r2].arp), []);
  assert.match(out(cli, r1, 'show controllers s0/0/0'), /DCE V\.35, clock rate 64000/);
  cli.exec(r2, 'enable');
  assert.match(out(cli, r2, 'show controllers s0/0/0'), /DTE V\.35/);
  assert.match(out(cli, r2, 'show controllers s0/0/1'), /No serial cable attached/);
});

test('IOS: lệnh xem phần cứng ghi rõ số liệu mẫu; debug ip packet in gói thật', () => {
  const net = S.emptySandbox();
  const r = add(net, 'router'), pc = add(net, 'pc');
  S.connect(net, r, 'g0/0', pc, 'fa0');
  N.attachClock(net);
  const cli = createCli(net);
  runScript(cli, r, cfg('interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown'));
  cli.exec(pc, 'ip 10.0.0.10/24 10.0.0.1');
  for (const c of ['show processes cpu', 'show memory', 'show environment']) assert.match(out(cli, r, c), /số liệu mẫu/, c);
  cli.exec(r, 'debug ip packet');
  assert.match(out(cli, r, 'show debugging'), /IP packet debugging is on/);
  cli.exec(pc, 'ping 10.0.0.1');
  const logs = N.drainLogs(net, r).join('\n');
  assert.match(logs, /IP: s=10\.0\.0\.10, d=10\.0\.0\.1, len \d+, rcvd 3/);
  assert.match(logs, /IP: s=10\.0\.0\.1, d=10\.0\.0\.10, len \d+, sending/);
  cli.exec(r, 'undebug ip packet');
  cli.exec(pc, 'ping 10.0.0.1');
  assert.deepEqual(N.drainLogs(net, r), []);
});

test('ASA packet-tracer: theo đúng security-level, ACL, route và NAT tĩnh', () => {
  const net = S.emptySandbox();
  const asa = add(net, 'asa');
  const cli = createCli(net);
  const f = net.devices[asa];
  const [g1, g2] = S.physPorts(f);
  S.connect(net, asa, g1, add(net, 'pc'), 'fa0');
  S.connect(net, asa, g2, add(net, 'pc'), 'fa0');
  runScript(cli, asa, cfg(`interface ${g1}`, 'nameif inside', 'security-level 100', 'ip address 10.1.1.1 255.255.255.0', 'no shutdown', `interface ${g2}`, 'nameif outside', 'security-level 0', 'ip address 203.0.113.2 255.255.255.0', 'no shutdown'));
  const pt = (s) => out(cli, asa, `packet-tracer input ${s}`);
  const ok = pt('inside tcp 10.1.1.10 1000 203.0.113.9 80');
  assert.match(ok, /Type: ROUTE-LOOKUP/);
  assert.match(ok, /Action: allow/);
  assert.match(ok, /output-interface: outside/);
  const denied = pt('outside tcp 203.0.113.9 1000 10.1.1.10 80');
  assert.match(denied, /Action: drop/);
  assert.match(denied, /Drop-reason: \(acl-drop\)/);
  assert.match(pt('inside icmp 10.1.1.10 8 0 203.0.113.9'), /Action: allow/);
  assert.match(pt('inside tcp 10.1.1.10 1000 8.8.8.8 80'), /Drop-reason: \(no-route\)/);
  assert.match(pt('dmz tcp 10.1.1.10 1000 8.8.8.8 80'), /không tồn tại/);
  // ACL mở chiều vào → cho qua; packet-tracer không được ghi phiên hay tăng bộ đếm
  runScript(cli, asa, ['configure terminal', 'access-list OUT extended permit tcp any host 10.1.1.10 eq 80', 'access-group OUT in interface outside', 'end']);
  assert.match(pt('outside tcp 203.0.113.9 1000 10.1.1.10 80'), /Action: allow/);
  assert.match(pt('outside tcp 203.0.113.9 1000 10.1.1.10 22'), /Drop-reason: \(acl-drop\)/);
  assert.equal((f.fw.conns || []).length, 0);
  assert.equal(f.acls.OUT.entries[0].matches || 0, 0);
  // NAT tĩnh: đích là IP mapped được dịch về IP thật trước khi tra route và ACL
  runScript(cli, asa, ['configure terminal', 'object network WEB', 'host 10.1.1.10', 'nat (inside,outside) static 203.0.113.50', 'end']);
  assert.match(pt('inside tcp 10.1.1.10 1000 203.0.113.9 80'), /Type: NAT[\s\S]*Static translate 10\.1\.1\.10\/?\d* to 203\.0\.113\.50/);
  runScript(cli, asa, ['configure terminal', 'object network LAN', 'subnet 10.1.1.0 255.255.255.0', 'nat (inside,outside) dynamic interface', 'end']);
  assert.match(pt('inside tcp 10.1.1.20 1000 203.0.113.9 80'), /Type: NAT[\s\S]*Dynamic translate 10\.1\.1\.20\/1000 to 203\.0\.113\.2/);
  const nat = pt('outside tcp 203.0.113.9 1000 203.0.113.50 80');
  assert.match(nat, /Type: UN-NAT/);
  assert.match(nat, /Action: allow/);
  assert.match(out(cli, asa, 'show failover'), /Failover Off/);
});

/** PC1 — FGT — PC2, chỉ cho phép port1 → port2 dịch vụ HTTP và PING tới một máy. */
function fgtNet() {
  const net = S.emptySandbox();
  const fgt = add(net, 'fortios'), a = add(net, 'linux'), b = add(net, 'linux');
  S.connect(net, a, 'fa0', fgt, 'port1');
  S.connect(net, b, 'fa0', fgt, 'port2');
  const cli = createCli(net);
  runScript(cli, fgt, ['config system interface', 'edit port1', 'set ip 10.1.1.1 255.255.255.0', 'next', 'edit port2', 'set ip 10.2.2.1 255.255.255.0', 'next', 'end', 'config firewall policy', 'edit 1', 'set srcintf port1', 'set dstintf port2', 'set srcaddr all', 'set dstaddr all', 'set action accept', 'set service PING', 'set schedule always', 'next', 'end']);
  runScript(cli, a, ['ip addr add 10.1.1.10/24 dev eth0', 'ip route add default via 10.1.1.1']);
  runScript(cli, b, ['ip addr add 10.2.2.10/24 dev eth0', 'ip route add default via 10.2.2.1']);
  return { net, cli, fgt, a, b };
}

test('FortiGate: diagnose sniffer packet thấy gói thật, lọc được theo cổng và biểu thức', () => {
  const { cli, fgt, a } = fgtNet();
  assert.match(out(cli, fgt, "diagnose sniffer packet any 'icmp' 1 10"), /0 packets received by filter/);
  assert.match(out(cli, a, 'ping -c 1 10.2.2.10'), /1 received/);
  const s = out(cli, fgt, "diagnose sniffer packet any 'icmp' 1 10");
  assert.match(s, /10\.1\.1\.10 -> 10\.2\.2\.10: icmp: echo request/);
  assert.match(s, /interfaces=\[any\]/);
  assert.match(out(cli, fgt, 'diag sniffer packet port1 none 4 10'), /10\.1\.1\.10 -> 10\.2\.2\.10/);
  assert.match(out(cli, fgt, "diagnose sniffer packet any 'host 9.9.9.9'"), /0 packets received/);
  assert.match(out(cli, fgt, "diagnose sniffer packet any 'khong hop le'"), /Invalid filter/);
  assert.match(out(cli, fgt, 'diagnose sniffer packet port9'), /Command fail/);
});

test('FortiGate: diagnose debug flow báo đúng policy cho qua hay chặn', () => {
  const { cli, fgt, a } = fgtNet();
  assert.match(out(cli, a, 'ping -c 1 10.2.2.10'), /1 received/);
  assert.doesNotMatch(out(cli, a, 'nc -zv 10.2.2.10 80'), /succeeded/);
  assert.match(out(cli, fgt, 'diagnose debug flow trace start 10'), /chưa bật debug/);
  cli.exec(fgt, 'diagnose debug enable');
  cli.exec(fgt, 'diagnose debug flow filter addr 10.2.2.10');
  const t = out(cli, fgt, 'diagnose debug flow trace start 10');
  assert.match(t, /received a packet\(proto=1, 10\.1\.1\.10/);
  assert.match(t, /Allowed by Policy-1:/);
  assert.match(t, /received a packet\(proto=6, 10\.1\.1\.10/);
  assert.match(t, /Denied by forward policy check \(policy 0\)/);
  cli.exec(fgt, 'diagnose debug flow filter addr 9.9.9.9');
  assert.match(out(cli, fgt, 'diagnose debug flow trace start 10'), /chưa có gói nào/);
  cli.exec(fgt, 'diagnose debug reset');
  assert.match(out(cli, fgt, 'diagnose debug flow trace start 10'), /chưa bật debug/);
});

test('Palo Alto: show system info lấy đúng tên máy', () => {
  const net = S.emptySandbox();
  const pa = add(net, 'panos');
  const cli = createCli(net);
  const s = out(cli, pa, 'show system info');
  assert.match(s, new RegExp(`hostname: ${net.devices[pa].name}`));
  assert.match(s, /sw-version:/);
});

function linuxPair() {
  const net = S.emptySandbox();
  const a = add(net, 'linux'), b = add(net, 'linux'), sw = add(net, 'sw2960');
  S.connect(net, a, 'fa0', sw, 'fa0/1');
  S.connect(net, b, 'fa0', sw, 'fa0/2');
  const cli = createCli(net);
  cli.exec(a, 'ip addr add 10.0.0.1/24 dev eth0');
  cli.exec(b, 'ip addr add 10.0.0.2/24 dev eth0');
  return { net, cli, a, b };
}

test('Linux tcpdump: chỉ thấy gói qua máy mình, lọc được, kiểm tra ngầm không lọt vào', () => {
  const { net, cli, a, b } = linuxPair();
  assert.match(out(cli, a, 'tcpdump -i eth0'), /0 packets captured/);
  cli.exec(a, 'ping -c 1 10.0.0.2');
  const all = out(cli, b, 'tcpdump -n');
  assert.match(all, /ARP, Request who-has 10\.0\.0\.2 tell 10\.0\.0\.1/);
  assert.match(all, /IP 10\.0\.0\.1 > 10\.0\.0\.2: ICMP echo request/);
  assert.match(all, /IP 10\.0\.0\.2 > 10\.0\.0\.1: ICMP echo reply/);
  assert.doesNotMatch(out(cli, b, 'tcpdump arp'), /ICMP/);
  assert.match(out(cli, b, 'tcpdump icmp -c 1'), /1 packets captured/);
  assert.match(out(cli, b, 'tcpdump not icmp and not arp'), /0 packets captured/);
  assert.match(out(cli, b, 'tcpdump host 10.0.0.9 or icmp'), /ICMP/);
  assert.match(out(cli, b, 'tcpdump -i eth5'), /No such device/);
  assert.match(out(cli, b, 'tcpdump bogus'), /syntax error/);
  cli.exec(a, 'curl 10.0.0.2:22');
  assert.match(out(cli, b, 'tcpdump tcp port 22'), /IP 10\.0\.0\.1\.\d+ > 10\.0\.0\.2\.22: Flags \[S\]/);
  const before = out(cli, b, 'tcpdump');
  N.sendPacket(net, { src: a, dst: '10.0.0.2' });
  assert.equal(out(cli, b, 'tcpdump').replace(/\d\d:\d\d:\d\d\.\d+/g, ''), before.replace(/\d\d:\d\d:\d\d\.\d+/g, ''));
  assert.ok(!JSON.stringify(S.exportSandbox(net)).includes('ICMP echo'), 'nhật ký gói không vào file xuất');
});

test('Linux nmap: open/closed/filtered theo dịch vụ và firewall thật', () => {
  const { cli, a, b } = linuxPair();
  const scan = out(cli, a, 'nmap 10.0.0.2');
  assert.match(scan, /22\/tcp\s+open\s+ssh/);
  assert.match(scan, /Not shown: \d+ closed/);
  assert.match(out(cli, a, 'nmap -p 80,22 10.0.0.2'), /80\/tcp\s+closed/);
  cli.exec(b, 'systemctl start nginx');
  assert.match(out(cli, a, 'nmap 10.0.0.2'), /80\/tcp\s+open\s+http/);
  cli.exec(b, 'ufw enable');
  assert.match(out(cli, a, 'nmap -p 22 10.0.0.2'), /Host seems down or every port is filtered/);
  assert.match(out(cli, a, 'nmap 10.0.0.99'), /Host seems down/);
  assert.match(out(cli, a, 'nmap -p abc 10.0.0.2'), /illegal/);
});

test('Linux journalctl, iptables, ps theo trạng thái thật; df, free ghi rõ số liệu mẫu', () => {
  const { cli, a } = linuxPair();
  assert.match(out(cli, a, 'journalctl -u ssh'), /Started ssh\.service\./);
  assert.match(out(cli, a, 'journalctl -u nginx'), /No entries/);
  cli.exec(a, 'systemctl start nginx');
  cli.exec(a, 'systemctl stop nginx');
  const j = out(cli, a, 'journalctl -u nginx');
  assert.match(j, /Started nginx\.service\.[\s\S]*Stopped nginx\.service\./);
  assert.match(out(cli, a, 'journalctl -u nginx -n 1'), /^(?![\s\S]*Started)[\s\S]*Stopped/);
  assert.match(out(cli, a, 'iptables -L'), /Chain INPUT \(policy ACCEPT\)/);
  cli.exec(a, 'ufw allow from 10.0.0.0/24 to any port 22');
  cli.exec(a, 'ufw enable');
  const ipt = out(cli, a, 'iptables -L -n');
  assert.match(ipt, /Chain INPUT \(policy DROP\)/);
  assert.match(ipt, /ACCEPT.*10\.0\.0\.0\/24.*dpt:22/);
  assert.match(out(cli, a, 'iptables -A INPUT -j DROP'), /chỉ mô phỏng iptables -L/);
  assert.match(out(cli, a, 'ps aux'), /sshd/);
  assert.doesNotMatch(out(cli, a, 'ps aux'), /nginx/);
  assert.match(out(cli, a, 'df -h'), /số liệu mẫu/);
  assert.match(out(cli, a, 'free -m'), /số liệu mẫu/);
});

test('bộ lọc gói: cú pháp sai trả null, rỗng thì nhận mọi gói', () => {
  assert.equal(compileBpf(['port', 'abc']), null);
  assert.equal(compileBpf(['tcp', 'or']), null);
  assert.equal(compileBpf(['src', 'icmp']), null);
  assert.equal(compileBpf(['host']), null);
  assert.equal(compileBpf([])({ layers: [] }), true);
});
