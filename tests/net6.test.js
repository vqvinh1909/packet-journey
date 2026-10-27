// tests/net6.test.js — IPv6 trong Lab CLI: SLAAC, OSPFv3 đa vùng, static, ipv6 unicast-routing, ping 2 chiều.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lab/net.js';
import * as V6 from '../lab/net6.js';
import { createCli, runScript } from '../lab/ios.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
function lab() {
  const net = N.makeNet([
    N.router('r1', 'R1', 0, 0, ['g0/0', 'g0/1']), N.router('r2', 'R2', 0, 0, ['g0/0', 'g0/1']),
    N.sw('s1', 'S1', 0, 0, ['fa0/1', 'g0/1']), N.pc('p1', 'P1', 0, 0), N.pc('p2', 'P2', 0, 0),
  ], [['r1', 'g0/0', 's1', 'g0/1'], ['p1', 'fa0', 's1', 'fa0/1'], ['r1', 'g0/1', 'r2', 'g0/1'], ['r2', 'g0/0', 'p2', 'fa0']]);
  const cli = createCli(net);
  const errs = [];
  const run = (dev, cmds) => { for (const o of runScript(cli, dev, cmds)) if (o.out.some((l) => /^% (Invalid|Incomplete|Ambiguous)/.test(l))) errs.push(`${dev}: ${o.cmd}`); };
  return { net, cli, run, errs };
}
const R1 = ['ipv6 unicast-routing', 'ipv6 router ospf 1', 'router-id 1.1.1.1', 'exit', 'interface g0/0', 'ipv6 address 2001:db8:1::1/64', 'ipv6 ospf 1 area 0', 'no shutdown', 'interface g0/1', 'ipv6 address 2001:db8:12::1/64', 'ipv6 ospf 1 area 0', 'no shutdown'];
const R2 = ['ipv6 unicast-routing', 'ipv6 router ospf 1', 'router-id 2.2.2.2', 'exit', 'interface g0/0', 'ipv6 address 2001:db8:2::/64 eui-64', 'ipv6 ospf 1 area 1', 'no shutdown', 'interface g0/1', 'ipv6 address 2001:db8:12::2/64', 'ipv6 ospf 1 area 0', 'no shutdown'];

test('OSPFv3 đa vùng + SLAAC: PC 2 site ping IPv6 được nhau', () => {
  const { net, cli, run, errs } = lab();
  run('r1', cfg(...R1)); run('r2', cfg(...R2));
  run('p1', ['ipv6config autoconfig']); run('p2', ['ipv6config autoconfig']);
  assert.deepEqual(errs, []);
  assert.equal(net.devices.p1.ip6, '2001:DB8:1:0:250:79FF:FE66:401'); // prefix RA + EUI-64 từ MAC
  assert.ok(net.devices.p1.gw6.startsWith('FE80::'), 'gateway SLAAC là link-local của router');
  const o6 = V6.ospf6All(net);
  assert.ok(o6.adj.r1.some((a) => a.to === 'r2'));
  const rt = V6.routeTable6(net, 'r1').find((r) => r.net === '2001:DB8:2::');
  assert.equal(rt.code, 'OI');
  assert.ok(rt.nextHop.startsWith('FE80::'));
  assert.ok(V6.ping6(net, 'p1', net.devices.p2.ip6).ok);
  assert.ok(cli.exec('p2', 'ping 2001:db8:1::1').out.some((l) => l.startsWith('Reply from 2001:DB8:1::1')));
  assert.ok(runScript(cli, 'r1', ['enable', 'show ipv6 ospf neighbor']).at(-1).out.some((l) => l.startsWith('2.2.2.2')));
});

test('thiếu ipv6 unicast-routing: không có RA, router không chuyển tiếp', () => {
  const { net, run } = lab();
  run('r1', cfg(...R1)); run('r2', cfg(...R2));
  run('p1', ['ipv6config 2001:db8:1::10/64 2001:db8:1::1']); run('p2', ['ipv6config autoconfig']);
  assert.ok(V6.ping6(net, 'p1', net.devices.p2.ip6).ok);
  run('r1', cfg('no ipv6 unicast-routing'));
  const r = V6.ping6(net, 'p1', net.devices.p2.ip6);
  assert.equal(r.ok, false);
  assert.match(r.fail.why, /unicast-routing/);
  assert.equal(V6.slaac(net, 'p1').ok, false);
});

test('static IPv6 thay OSPFv3; router không có router-id thì OSPFv3 không chạy', () => {
  const { net, run } = lab();
  const noOspf = (l) => l.filter((c) => !/ospf|router-id|^exit$/.test(c));
  run('r1', cfg(...noOspf(R1), 'ipv6 route 2001:db8:2::/64 2001:db8:12::2'));
  run('r2', cfg(...noOspf(R2), 'ipv6 route ::/0 g0/1 2001:db8:12::1'));
  run('p1', ['ipv6config 2001:db8:1::10/64 2001:db8:1::1']); run('p2', ['ipv6config autoconfig']);
  assert.equal(V6.routeTable6(net, 'r2').find((r) => r.prefix === 0)?.code, 'S');
  assert.ok(V6.ping6(net, 'p1', net.devices.p2.ip6).ok);
  // OSPFv3 không có IPv4 nào để làm router-id → không lên láng giềng
  run('r1', cfg('interface g0/1', 'ipv6 ospf 1 area 0')); run('r2', cfg('interface g0/1', 'ipv6 ospf 1 area 0'));
  assert.deepEqual(V6.ospf6All(net).adj, {});
});
