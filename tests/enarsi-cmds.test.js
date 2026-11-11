// tests/enarsi-cmds.test.js — lệnh xử lý sự cố OSPF, BGP cho ENARSI 1.10, 1.11: LSDB, bảng BGP chi tiết, community, MTU, xác thực virtual link.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli, runScript } from '../lab/ios.js';
import { LABS, buildLab, applySolution } from '../lab/labs.js';

const solved = (id) => {
  const lab = LABS.find((l) => l.id === id), net = buildLab(lab), cli = createCli(net);
  applySolution(lab, net, cli);
  return { net, cli };
};
const conf = (cli, dev, ...cmds) => runScript(cli, dev, ['end', 'enable', 'configure terminal', ...cmds, 'end']);
const show = (cli, dev, cmd) => { runScript(cli, dev, ['end', 'enable']); return cli.exec(dev, cmd).out.join('\n'); };

test('show ip ospf database: có LSA theo area, ABR tạo Type 3', () => {
  const { cli } = solved('R04');
  const db = show(cli, 'r1', 'show ip ospf database');
  assert.match(db, /OSPF Router with ID \(1\.1\.1\.1\)/);
  assert.match(db, /Router Link States \(Area 0\)/);
  assert.match(db, /Summary Net Link States \(Area 0\)/);
  assert.match(db, /10\.4\.0\.0/); // prefix ở area 2 đi qua virtual link
  assert.match(show(cli, 'r1', 'show ip ospf database router'), /Link connected to/);
  assert.match(show(cli, 'r1', 'show ip ospf database summary'), /Network Mask: \/\d+/);
});

test('show ip ospf database: totally stubby chỉ còn default Type 3', () => {
  const { cli } = solved('R03');
  const dbs = ['r1', 'r2', 'r3', 'r4'].map((d) => show(cli, d, 'show ip ospf database summary'));
  assert.ok(dbs.some((t) => /Link State ID: 0\.0\.0\.0/.test(t)));
});

test('distribute-list in chặn route vào RIB nhưng LSA vẫn trong database', () => {
  const { cli } = solved('R04');
  assert.match(show(cli, 'r1', 'show ip route ospf'), /10\.4\.0\.0/);
  conf(cli, 'r1', 'ip prefix-list CHAN seq 5 deny 10.4.0.0/24', 'ip prefix-list CHAN seq 10 permit 0.0.0.0/0 le 32', 'router ospf 1', 'distribute-list prefix CHAN in');
  assert.doesNotMatch(show(cli, 'r1', 'show ip route ospf'), /10\.4\.0\.0/);
  assert.match(show(cli, 'r1', 'show ip ospf database'), /10\.4\.0\.0/);
  assert.match(show(cli, 'r1', 'show ip ospf rib'), /10\.4\.0\.0/);
});

test('lệch MTU kẹt EXSTART và mất route; đầu MTU nhỏ đặt mtu-ignore thì FULL', () => {
  const { cli } = solved('R04');
  conf(cli, 'r1', 'interface g0/0', 'ip mtu 1400');
  assert.match(show(cli, 'r1', 'show ip ospf neighbor'), /EXSTART/);
  assert.doesNotMatch(show(cli, 'r1', 'show ip route ospf'), /10\.0\.23\.0/);
  conf(cli, 'r2', 'interface g0/0', 'ip ospf mtu-ignore'); // sai đầu: R2 MTU lớn hơn
  assert.match(show(cli, 'r1', 'show ip ospf neighbor'), /EXSTART/);
  conf(cli, 'r1', 'interface g0/0', 'ip ospf mtu-ignore');
  assert.match(show(cli, 'r1', 'show ip ospf neighbor'), /FULL/);
});

test('virtual link thuộc area 0: bật area 0 authentication thì thiếu khoá sẽ down, thêm khoá hai đầu thì up', () => {
  const { cli } = solved('R04');
  const up = (d) => /is up/.test(show(cli, d, 'show ip ospf virtual-links'));
  assert.ok(up('r2'));
  conf(cli, 'r2', 'router ospf 1', 'area 0 authentication message-digest');
  conf(cli, 'r3', 'router ospf 1', 'area 0 authentication message-digest');
  assert.ok(!up('r2'));
  conf(cli, 'r2', 'router ospf 1', 'area 1 virtual-link 3.3.3.3 message-digest-key 1 md5 K1');
  conf(cli, 'r3', 'router ospf 1', 'area 1 virtual-link 2.2.2.2 message-digest-key 1 md5 K2');
  assert.ok(!up('r2'), 'khác khoá');
  conf(cli, 'r3', 'router ospf 1', 'area 1 virtual-link 2.2.2.2 message-digest-key 1 md5 K1');
  assert.ok(up('r2'));
  assert.match(show(cli, 'r2', 'show running-config'), /area 1 virtual-link 3\.3\.3\.3 message-digest-key 1 md5 K1/);
});

test('OSPF: distance ospf đổi AD theo loại, auto-cost đổi cost, key-chain phải khớp', () => {
  const { cli } = solved('R04');
  conf(cli, 'r1', 'router ospf 1', 'distance ospf intra-area 95 inter-area 96 external 97');
  assert.match(show(cli, 'r1', 'show ip route ospf'), /\[96\/\d+\]/);
  conf(cli, 'r1', 'router ospf 1', 'auto-cost reference-bandwidth 100000');
  assert.match(show(cli, 'r1', 'show ip ospf interface brief'), /Gi0\/0.*\s100\s/);
  conf(cli, 'r1', 'key chain A', 'key 1', 'key-string K1', 'exit', 'exit', 'interface g0/0', 'no ip ospf authentication', 'ip ospf authentication key-chain A');
  assert.doesNotMatch(show(cli, 'r1', 'show ip ospf neighbor'), /FULL/);
  assert.match(show(cli, 'r1', 'debug ip ospf hello'), /OSPF hello debugging is on/);
});

test('OSPFv3: show database có LSA 8 và 9; xác thực lệch thì mất láng giềng', () => {
  const { cli } = solved('R18');
  const db = show(cli, 'r1', 'show ospfv3 database');
  assert.match(db, /Router Link States/);
  assert.match(db, /Link \(Type-8\) Link States/);
  assert.match(db, /Intra Area Prefix Link States/);
  assert.match(show(cli, 'r1', 'show ospfv3 neighbor'), /FULL/);
  conf(cli, 'r1', 'interface g0/0', 'ospfv3 authentication ipsec spi 256 sha1 0123456789012345678901234567890123456789');
  assert.doesNotMatch(show(cli, 'r1', 'show ospfv3 neighbor').split('\n').filter((l) => /Gig.*0\/0|g0\/0/i.test(l)).join('\n'), /FULL/);
});

test('show ip bgp <prefix>, regexp, tcp brief trên lab route reflector', () => {
  const { net, cli } = solved('R08');
  const devs = Object.keys(net.devices).filter((d) => net.devices[d].bgp);
  const texts = devs.map((d) => ({ d, t: show(cli, d, 'show ip bgp') }));
  const withRoute = texts.find((x) => /\*>?i/.test(x.t));
  assert.ok(withRoute, 'có route iBGP');
  const ip = withRoute.t.split('\n').find((l) => /\*>?i/.test(l)).match(/(\d+\.\d+\.\d+\.\d+)\/?/)[1];
  const entry = show(cli, withRoute.d, `show ip bgp ${ip}`);
  assert.match(entry, /BGP routing table entry for/);
  assert.match(entry, /Paths: \(\d+ available/);
  assert.match(show(cli, withRoute.d, 'show tcp brief'), /\.179/);
  assert.match(show(cli, withRoute.d, 'show ip bgp regexp .*'), /Network/);
  const rr = texts.map((x) => show(cli, x.d, `show ip bgp ${ip}`)).find((t) => /Cluster list/.test(t));
  assert.ok(rr, 'route phản chiếu có Originator, Cluster list');
});

// R16: R1 (AS 65010) - R2 (AS 100) - R3 (AS 200), R1 quảng bá 172.16.0.0/24
const P16 = 'show ip bgp 172.16.0.0';
const raw16 = () => {
  const lab = LABS.find((l) => l.id === 'R16'), net = buildLab(lab);
  return { net, cli: createCli(net) };
};

test('community: thiếu send-community thì không gửi; no-export không ra khỏi AS kề bên', () => {
  const { cli } = raw16();
  conf(cli, 'r1', 'ip bgp-community new-format', 'route-map RA permit 10', 'set community 65010:100 additive', 'exit', 'router bgp 65010', 'neighbor 10.0.12.2 route-map RA out');
  assert.doesNotMatch(show(cli, 'r2', P16), /Community/);
  conf(cli, 'r1', 'router bgp 65010', 'neighbor 10.0.12.2 send-community');
  assert.match(show(cli, 'r2', P16), /Community: \d+/); // R2 chưa bật new-format nên hiện số thập phân
  conf(cli, 'r2', 'ip bgp-community new-format', 'ip community-list standard KH permit 65010:100', 'ip community-list expanded KH2 permit ^65010:1.*$');
  assert.match(show(cli, 'r2', P16), /Community: 65010:100/);
  assert.match(show(cli, 'r2', 'show ip bgp community-list KH'), /172\.16\.0\.0/);
  assert.match(show(cli, 'r2', 'show ip bgp community-list KH2'), /172\.16\.0\.0/);
  assert.match(show(cli, 'r3', 'show ip bgp'), /172\.16\.0\.0/);
  conf(cli, 'r1', 'route-map RA permit 10', 'set community no-export');
  assert.match(show(cli, 'r2', 'show ip bgp'), /172\.16\.0\.0/);
  assert.doesNotMatch(show(cli, 'r3', 'show ip bgp'), /172\.16\.0\.0/);
  // route-map thiếu dòng permit cuối thì chặn route không khớp community
  conf(cli, 'r2', 'route-map CHAN deny 10', 'match community KH', 'exit', 'router bgp 100', 'neighbor 10.0.12.1 route-map CHAN in');
  assert.doesNotMatch(show(cli, 'r2', 'show ip bgp'), /172\.16\.0\.0/);
});

test('remove-private-as: không có all thì giữ khi AS_PATH lẫn AS công cộng', () => {
  const { cli } = raw16();
  conf(cli, 'r1', 'route-map PRE permit 10', 'set as-path prepend 300', 'exit', 'router bgp 65010', 'neighbor 10.0.12.2 route-map PRE out');
  conf(cli, 'r2', 'router bgp 100', 'neighbor 10.0.23.3 remove-private-as');
  assert.match(show(cli, 'r3', 'show ip bgp'), /100 300 65010 i/);
  conf(cli, 'r2', 'router bgp 100', 'neighbor 10.0.23.3 remove-private-as all');
  assert.match(show(cli, 'r3', 'show ip bgp'), /100 300 i/);
});

test('allowas-in và as-override vượt qua kiểm tra lặp AS', () => {
  const { cli } = raw16();
  conf(cli, 'r1', 'route-map PRE permit 10', 'set as-path prepend 200', 'exit', 'router bgp 65010', 'neighbor 10.0.12.2 route-map PRE out');
  assert.doesNotMatch(show(cli, 'r3', 'show ip bgp'), /172\.16\.0\.0/);
  conf(cli, 'r3', 'router bgp 200', 'neighbor 10.0.23.2 allowas-in');
  assert.match(show(cli, 'r3', 'show ip bgp'), /172\.16\.0\.0/);
  conf(cli, 'r3', 'router bgp 200', 'no neighbor 10.0.23.2 allowas-in');
  conf(cli, 'r2', 'router bgp 100', 'neighbor 10.0.23.3 as-override');
  assert.match(show(cli, 'r3', 'show ip bgp'), /172\.16\.0\.0.*100 100 65010 i/);
});

test('maximum-prefix: vượt ngưỡng thì Idle (PfxCt), warning-only vẫn giữ phiên', () => {
  const { cli } = raw16();
  conf(cli, 'r1', 'interface loopback 1', 'ip address 172.16.1.1 255.255.255.0', 'exit', 'router bgp 65010', 'network 172.16.1.0 mask 255.255.255.0');
  conf(cli, 'r2', 'router bgp 100', 'neighbor 10.0.12.1 maximum-prefix 1');
  assert.match(show(cli, 'r2', 'show ip bgp summary'), /Idle \(PfxCt\)/);
  assert.doesNotMatch(show(cli, 'r2', 'show ip bgp'), /172\.16\./);
  conf(cli, 'r2', 'router bgp 100', 'neighbor 10.0.12.1 maximum-prefix 1 warning-only');
  assert.match(show(cli, 'r2', 'show ip bgp'), /172\.16\.1\.0/);
  assert.match(show(cli, 'r2', 'show running-config'), /maximum-prefix 1 warning-only/);
});

test('eBGP qua loopback: disable-connected-check, ttl-security ở cả hai đầu thì lên phiên', () => {
  const { cli } = raw16();
  conf(cli, 'r2', 'interface loopback 5', 'ip address 5.5.5.2 255.255.255.255', 'exit', 'ip route 5.5.5.3 255.255.255.255 10.0.23.3', 'router bgp 100', 'neighbor 5.5.5.3 remote-as 200', 'neighbor 5.5.5.3 update-source lo5');
  conf(cli, 'r3', 'interface loopback 5', 'ip address 5.5.5.3 255.255.255.255', 'exit', 'ip route 5.5.5.2 255.255.255.255 10.0.23.2', 'router bgp 200', 'neighbor 5.5.5.2 remote-as 100', 'neighbor 5.5.5.2 update-source lo5');
  const line = () => show(cli, 'r2', 'show ip bgp summary').split('\n').find((l) => l.startsWith('5.5.5.3'));
  assert.match(line(), /Active/);
  conf(cli, 'r2', 'router bgp 100', 'neighbor 5.5.5.3 disable-connected-check');
  conf(cli, 'r3', 'router bgp 200', 'neighbor 5.5.5.2 disable-connected-check');
  assert.doesNotMatch(line(), /Active/);
  conf(cli, 'r2', 'router bgp 100', 'no neighbor 5.5.5.3 disable-connected-check', 'neighbor 5.5.5.3 ttl-security hops 2');
  conf(cli, 'r3', 'router bgp 200', 'no neighbor 5.5.5.2 disable-connected-check');
  assert.match(line(), /Active/);
  conf(cli, 'r3', 'router bgp 200', 'neighbor 5.5.5.2 ttl-security hops 2');
  assert.doesNotMatch(line(), /Active/);
});

test('rib-failure, received-routes cần soft-reconfiguration, VRF không hiện ở bảng toàn cục', () => {
  const { cli } = raw16();
  conf(cli, 'r3', 'ip route 172.16.0.0 255.255.255.0 null0');
  assert.match(show(cli, 'r3', 'show ip bgp rib-failure'), /172\.16\.0\.0\/24.*Higher admin distance/);
  assert.match(show(cli, 'r2', 'show ip bgp neighbors 10.0.12.1 received-routes'), /not enabled/);
  conf(cli, 'r2', 'router bgp 100', 'neighbor 10.0.12.1 soft-reconfiguration inbound');
  assert.match(show(cli, 'r2', 'show ip bgp neighbors 10.0.12.1 received-routes'), /172\.16\.0\.0/);
  assert.match(show(cli, 'r2', 'show ip bgp regexp ^65010_'), /172\.16\.0\.0/);
  assert.doesNotMatch(show(cli, 'r2', 'show ip bgp regexp ^6501_'), /172\.16\.0\.0/);
  conf(cli, 'r2', 'vrf definition KHACH-A', 'rd 100:1', 'address-family ipv4', 'exit-address-family', 'exit', 'router bgp 100', 'address-family ipv4 vrf KHACH-A');
  assert.doesNotMatch(show(cli, 'r2', 'show ip bgp summary'), /10\.0\.12\.1/);
  assert.match(show(cli, 'r2', 'show ip bgp vpnv4 vrf KHACH-A summary'), /10\.0\.12\.1/);
});

// R07: R1 (eBGP tới ISP-A) và R2 (eBGP tới ISP-B) cùng AS 65001; 8.8.8.0/24 xuất phát từ ISP-A
const raw07 = () => {
  const lab = LABS.find((l) => l.id === 'R07'), net = buildLab(lab);
  return { net, cli: createCli(net) };
};
const bestFrom = (cli, dev) => { const L = show(cli, dev, 'show ip bgp 8.8.8.0').split('\n'); const i = L.findIndex((l) => /, best$/.test(l)); return L[i - 2].trim(); };

test('MED chỉ so cùng AS kề bên, trừ khi bật always-compare-med', () => {
  const { cli } = raw07();
  conf(cli, 'r2', 'router bgp 65001', 'bgp bestpath as-path ignore'); // để R2 chọn đường qua ISP-B và gửi sang R1
  conf(cli, 'r1', 'route-map M50 permit 10', 'set metric 50', 'exit', 'router bgp 65001', 'bgp bestpath as-path ignore', 'neighbor 10.0.1.2 route-map M50 in');
  assert.equal(bestFrom(cli, 'r1'), '100'); // khác AS kề bên nên bỏ qua MED, eBGP thắng iBGP
  conf(cli, 'r1', 'router bgp 65001', 'bgp always-compare-med');
  assert.equal(bestFrom(cli, 'r1'), '200 100');
});

test('bgp bestpath as-path ignore bỏ qua độ dài AS_PATH', () => {
  const { cli } = raw07();
  assert.equal(bestFrom(cli, 'r2'), '100');
  conf(cli, 'r2', 'router bgp 65001', 'bgp bestpath as-path ignore');
  assert.equal(bestFrom(cli, 'r2'), '200 100');
});

test('next-hop không tới được: inaccessible, không có cờ * và không làm best', () => {
  const { cli } = raw07();
  conf(cli, 'r1', 'router bgp 65001', 'no neighbor 10.0.12.2 next-hop-self');
  const e = show(cli, 'r2', 'show ip bgp 8.8.8.0');
  assert.match(e, /10\.0\.1\.2 \(inaccessible\)/);
  assert.equal(bestFrom(cli, 'r2'), '200 100');
  assert.match(show(cli, 'r2', 'show ip bgp'), /^ {2}i.*10\.0\.1\.2/m);
});

test('regex sai: bị từ chối khi gõ, mẫu đã lưu từ trước cũng không làm kẹt thiết bị', () => {
  const { net, cli } = solved('R08');
  const d = Object.keys(net.devices)[0];
  runScript(cli, d, ['end', 'enable', 'configure terminal']);
  assert.match(cli.exec(d, 'ip as-path access-list 7 permit (').out.join('\n'), /Invalid input/);
  assert.match(cli.exec(d, 'ip community-list expanded K permit (').out.join('\n'), /Invalid input/);
  assert.equal(net.devices[d].asPathAcls?.['7'], undefined);
  assert.equal(net.devices[d].commLists?.K, undefined);
  assert.match(show(cli, d, 'show ip bgp regexp ('), /Invalid input/);
  // cấu hình lưu trước khi có kiểm tra
  net.devices[d].asPathAcls = { 7: [{ action: 'permit', re: '(' }] };
  net.devices[d].commLists = { K: [{ action: 'permit', vals: ['('], expanded: true }] };
  conf(cli, d, 'route-map RM permit 10', 'match as-path 7', 'exit', 'route-map RM permit 20', 'match community K', 'exit', 'router bgp 65000', 'neighbor 3.3.3.3 route-map RM in', 'no neighbor 3.3.3.3 route-map RM in', 'exit', 'no ip as-path access-list 7');
  for (const dev of Object.keys(net.devices)) assert.match(show(cli, dev, 'show ip route'), /Codes/);
});
