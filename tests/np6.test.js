// tests/np6.test.js — EIGRP, BGP cho IPv6, OSPFv3 AF, IP SLA jitter, telemetry: bắt các lỗi cấu hình hay gặp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli, runScript } from '../lab/ios.js';
import * as V6 from '../lab/net6.js';
import { LABS, buildLab, applySolution, checkLab, quizAnswers } from '../lab/labs.js';
import { isPrivAs } from '../lab/net.js';
import * as N from '../lab/net.js';

const solved = (id) => {
  const lab = LABS.find((l) => l.id === id), net = buildLab(lab), cli = createCli(net);
  applySolution(lab, net, cli);
  return { net, cli };
};
const conf = (cli, dev, ...cmds) => runScript(cli, dev, ['enable', 'configure terminal', ...cmds, 'end']);
const show = (cli, dev, cmd) => { runScript(cli, dev, ['end']); return cli.exec(dev, cmd).out.join('\n'); };
const code6 = (net, dev, re) => V6.routeTable6(net, dev).find((r) => re.test(r.net))?.code;

test('BGP IPv6: bỏ activate thì phiên Idle và mất route', () => {
  const { net, cli } = solved('R15');
  assert.equal(code6(net, 'r1', /^2001:db8:3::$/i), 'B');
  conf(cli, 'r1', 'router bgp 65001', 'address-family ipv6', 'no neighbor 2001:db8:12::2 activate');
  assert.equal(V6.bgp6All(net).sessions.r1[0].state, 'Idle');
  assert.equal(code6(net, 'r1', /^2001:db8:3::$/i), undefined);
  assert.match(show(cli, 'r1', 'show bgp ipv6 unicast summary'), /chưa activate/);
});

test('BGP IPv6: thiếu next-hop-self thì iBGP có đường nhưng không vào bảng route; lệch AS thì không lên phiên', () => {
  const { net, cli } = solved('R15');
  assert.equal(code6(net, 'r3', /^2001:db8:1::$/i), 'B');
  conf(cli, 'r2', 'router bgp 4200000002', 'address-family ipv6', 'no neighbor 2001:db8:23::3 next-hop-self');
  assert.ok([...V6.bgp6All(net).best.r3.keys()].some((k) => /^2001:db8:1::\/64$/i.test(k)));
  assert.equal(code6(net, 'r3', /^2001:db8:1::$/i), undefined);
  conf(cli, 'r1', 'router bgp 65001', 'neighbor 2001:db8:12::2 remote-as 200');
  assert.equal(V6.bgp6All(net).sessions.r1[0].state, 'Idle');
});

test('BGP IPv6: network chỉ quảng bá prefix có trong bảng route; không tự học lại route của mình', () => {
  const { net, cli } = solved('R15');
  conf(cli, 'r1', 'router bgp 65001', 'address-family ipv6', 'network 2001:db8:99::/64');
  assert.equal(code6(net, 'r2', /^2001:db8:99::$/i), undefined);
  assert.equal(V6.routeTable6(net, 'r1').find((r) => /^2001:db8:1::$/i.test(r.net)).code, 'C');
});

test('EIGRP IPv6: thiếu router-id, lệch AS, shutdown hay passive đều làm mất láng giềng', () => {
  let { net, cli } = solved('R14');
  assert.equal(V6.eigrp6All(net).adj.r2.length, 2);
  conf(cli, 'r1', 'ipv6 router eigrp 100', 'no eigrp router-id');
  assert.equal(V6.eigrp6All(net).adj.r2.length, 1, 'không có IPv4 thì không tự chọn được router-id');
  ({ net, cli } = solved('R14'));
  conf(cli, 'r1', 'ipv6 router eigrp 100', 'shutdown');
  assert.equal(V6.eigrp6All(net).adj.r2.length, 1);
  ({ net, cli } = solved('R14'));
  conf(cli, 'r3', 'ipv6 router eigrp 100', 'passive-interface g0/0');
  assert.equal(V6.eigrp6All(net).adj.r2.length, 1);
  assert.equal(code6(net, 'r1', /^2001:db8:3::$/i), undefined);
  const lab = LABS.find((l) => l.id === 'R14'), n2 = buildLab(lab), c2 = createCli(n2);
  conf(c2, 'r1', 'no ipv6 unicast-routing');
  assert.ok(conf(c2, 'r1', 'ipv6 router eigrp 100').some((o) => /IPv6 routing not enabled/.test(o.out?.join?.('\n') ?? '')));
});

test('OSPFv3 AF: cấu hình hiện đúng dạng mới, address-family ipv4 báo rõ là chưa mô phỏng', () => {
  const { cli } = solved('R18');
  const run = show(cli, 'r2', 'show running-config');
  assert.match(run, /router ospfv3 1/);
  assert.match(run, /ospfv3 1 ipv6 area 0/);
  assert.doesNotMatch(run, /ipv6 router ospf/);
  const r = conf(cli, 'r2', 'router ospfv3 1', 'address-family ipv4 unicast');
  assert.ok(r.some((o) => /chỉ mô phỏng/.test(o.out?.join?.('\n') ?? '')));
});

test('IP SLA jitter: thiếu responder là Timeout; dùng được với track', () => {
  const { net, cli } = solved('R19');
  assert.match(show(cli, 'r1', 'show ip sla statistics'), /return code: OK/);
  conf(cli, 'r1', 'track 1 ip sla 10 reachability');
  assert.match(show(cli, 'r1', 'show track 1'), /Reachability is Up/);
  conf(cli, 'r2', 'no ip sla responder');
  assert.match(show(cli, 'r1', 'show ip sla statistics'), /Timeout/);
  assert.match(show(cli, 'r1', 'show track 1'), /Reachability is Down/);
  assert.ok(net.devices.r1.slas[10].type === 'udp-jitter');
});

test('Telemetry: thiếu receiver là Invalid; collector không tới được thì Connecting', () => {
  const { cli } = solved('R19');
  assert.match(show(cli, 'r1', 'show telemetry ietf subscription all'), /State: Valid[\s\S]*Connected/);
  conf(cli, 'r1', 'telemetry ietf subscription 7', 'stream yang-push');
  assert.match(show(cli, 'r1', 'show telemetry ietf subscription 7 detail'), /State: Invalid/);
  conf(cli, 'r1', 'telemetry ietf subscription 101', 'receiver ip address 10.0.0.99 57000 protocol grpc-tcp');
  assert.match(show(cli, 'r1', 'show telemetry ietf subscription 101 detail'), /Connecting/);
});

test('remove-private-as gỡ cả AS riêng 4 byte', () => {
  for (const a of [64512, 65534, 4200000000, 4294967294]) assert.ok(isPrivAs(a), String(a));
  for (const a of [64511, 65535, 100, 4199999999, 4294967295]) assert.ok(!isPrivAs(a), String(a));
});

test('show running-config dán lại lên mạng mới cho kết quả như lời giải', () => {
  for (const id of ['R14', 'R15', 'R18', 'R19']) {
    const lab = LABS.find((l) => l.id === id), { net, cli } = solved(id), fresh = buildLab(lab), c2 = createCli(fresh);
    for (const d of Object.values(net.devices).filter((x) => x.type === 'router')) {
      const lines = show(cli, d.id, 'show running-config').split('\n').map((l) => l.trim()).filter((l) => l && l !== '!' && !/^(Building|Current|version|end$)/.test(l));
      for (const r of conf(c2, d.id, ...lines)) assert.ok(!/Invalid input|Incomplete/.test((r.out || []).join('\n')), `${id} ${d.id}: ${r.cmd}`);
    }
    assert.deepEqual(checkLab(lab, fresh, quizAnswers(lab)), checkLab(lab, net, quizAnswers(lab)), id);
  }
});

test('no switchport: chỉ có trên switch Layer 3, VLAN nội bộ không lộ ra và gõ switchport thì trả lại Layer 2', () => {
  const lab = LABS.find((l) => l.id === 'N23'), { net, cli } = solved('N23'), d = net.devices.s1, iv = d.ports['g0/1'].routed;
  assert.equal(iv, 1006);
  assert.doesNotMatch(show(cli, 's1', 'show vlan brief'), /internal/);
  const run = show(cli, 's1', 'show running-config');
  assert.match(run, /interface GigabitEthernet0\/1\n no switchport\n ip address 10\.0\.0\.2 255\.255\.255\.252/);
  assert.doesNotMatch(run, /Vlan1006|vlan 1006/);
  conf(cli, 's1', 'interface g0/1', 'switchport');
  assert.equal(d.ports['g0/1'].routed, null);
  assert.equal(d.svis.vlan1006, undefined);
  assert.equal(checkLab(lab, net, quizAnswers(lab))[2], false);
  const fresh = buildLab(lab), c2 = createCli(fresh);
  assert.ok(conf(c2, 's1', 'interface g0/1', 'ip address 10.0.0.2 255.255.255.252').some((o) => /no switchport/.test(o.out?.join?.('\n') ?? '')));
});

test('no switchport trên 2960 báo lỗi', () => {
  const net = buildLab(LABS.find((l) => l.id === 'L04')), id = Object.values(net.devices).find((x) => x.type === 'switch').id, cli = createCli(net), n = Object.keys(net.devices[id].ports)[0];
  assert.ok(conf(cli, id, `interface ${n}`, 'no switchport').some((o) => /Invalid input/.test(o.out?.join?.('\n') ?? '')));
});

test('no switchport: hai switch Layer 3 nối nhau bằng cổng định tuyến, số VLAN nội bộ khác nhau vẫn thông và chạy được OSPF', () => {
  const net = N.makeNet([N.pc('p', 'P', 0, 0, { ip: '192.168.1.10', gw: '192.168.1.1' }), N.sw('a', 'A', 0, 0, ['fa0/1', 'g0/1', 'g0/2'], { l3: true }), N.sw('b', 'B', 0, 0, ['g0/1'], { l3: true })], [['p', 'fa0', 'a', 'fa0/1'], ['a', 'g0/2', 'b', 'g0/1']]), cli = createCli(net);
  conf(cli, 'a', 'interface g0/1', 'no switchport', 'exit', 'interface g0/2', 'no switchport', 'ip address 10.0.0.1 255.255.255.252', 'exit', 'vlan 10', 'exit', 'interface fa0/1', 'switchport access vlan 10', 'exit', 'interface vlan 10', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'exit', 'ip routing', 'router ospf 1', 'network 0.0.0.0 255.255.255.255 area 0');
  conf(cli, 'b', 'interface g0/1', 'no switchport', 'ip address 10.0.0.2 255.255.255.252', 'exit', 'ip routing', 'router ospf 1', 'network 0.0.0.0 255.255.255.255 area 0');
  assert.deepEqual([net.devices.a.ports['g0/2'].routed, net.devices.b.ports['g0/1'].routed], [1007, 1006]);
  assert.match(show(cli, 'a', 'ping 10.0.0.2'), /Success rate is [1-9]/);
  assert.match(show(cli, 'b', 'show ip route'), /O\s+192\.168\.1\.0/);
  assert.match(show(cli, 'b', 'ping 192.168.1.10'), /Success rate is [1-9]/);
});
