// tests/clock.test.js — ⏱ đồng hồ mô phỏng (N.attachClock/clockTick/clockConverge): STP listening → learning →
// forwarding (PortFast ngay, RSTP nhanh), OSPF INIT → … → FULL, EIGRP/BGP/HSRP có thời gian, log IOS đúng lúc,
// show logging, debug ip ospf adj / debug ip icmp, chấm điểm luôn coi như đã hội tụ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lab/net.js';
import { getLab, buildLab, applySolution, checkLab } from '../lab/labs.js';
import { createCli } from '../lab/ios.js';

function solved(id) {
  const lab = getLab(id);
  const net = buildLab(lab);
  const cli = createCli(net);
  applySolution(lab, net, cli);
  return { lab, net, cli };
}
const run = (cli, dev, ...cmds) => cmds.map((c) => cli.exec(dev, c).out.join('\n')).join('\n');
const cfg = (cli, dev, ...l) => run(cli, dev, 'enable', 'configure terminal', ...l, 'end');
const tick = (net, secs) => { for (let i = 0; i < secs * 4; i++) N.clockTick(net, 0.25); };
const drain = (net, dev) => N.drainLogs(net, dev).join('\n');
const ping = (cli, dev, ip) => /Success rate is [1-9]|Received = [1-9]/.test(run(cli, dev, `ping ${ip}`));

test('gắn đồng hồ: mạng đang chạy coi như đã hội tụ, không log, không còn mục chờ', () => {
  const { net, cli } = solved('L10');
  N.attachClock(net);
  assert.equal(N.clockPending(net), 0);
  assert.match(run(cli, 'r1', 'show ip ospf neighbor'), /FULL/);
  assert.equal(drain(net, 'r1'), '');
});

test('OSPF: shutdown → log FULL to DOWN ngay; no shutdown → INIT/2WAY/EXSTART… rồi FULL sau ~11 giây, route chỉ có khi FULL', () => {
  const { net, cli } = solved('L10');
  N.attachClock(net);
  const down = cfg(cli, 'r1', 'interface g0/1', 'shutdown');
  assert.match(down, /%OSPF-5-ADJCHG: Process \d+, Nbr \S+ on GigabitEthernet0\/1 from FULL to DOWN/);
  assert.match(down, /%SYS-5-CONFIG_I: Configured from console by console/);
  const up = cfg(cli, 'r1', 'interface g0/1', 'no shutdown');
  assert.doesNotMatch(up, /LOADING to FULL/, 'chưa FULL ngay khi vừa bật cổng');
  assert.match(run(cli, 'r1', 'show ip ospf neighbor'), /INIT\//);
  tick(net, 4);
  assert.match(run(cli, 'r1', 'show ip ospf neighbor'), /2WAY\//);
  tick(net, 3);
  assert.match(run(cli, 'r1', 'show ip ospf neighbor'), /EXSTART\/|EXCHANGE\//);
  const r2net = '10.0.2.0'; // LAN của R2 — đường ngắn nhất qua g0/1 chưa dùng được
  const viaG01 = () => N.routeTable(N.makeCtx(net), 'r1').some((r) => r.code === 'O' && r.iface === 'g0/1');
  assert.equal(viaG01(), false, 'đang EXSTART: chưa có route qua láng giềng ' + r2net);
  tick(net, 5);
  assert.equal(N.clockPending(net), 0);
  assert.ok(viaG01(), 'FULL rồi: có route OSPF qua g0/1');
  const logs = drain(net, 'r1');
  assert.match(logs, /^\*Mar  1 00:00:\d\d\.\d{3}: %OSPF-5-ADJCHG: .* from LOADING to FULL, Loading Done/m);
  assert.match(drain(net, 'r2'), /%LINK-3-UPDOWN: Interface GigabitEthernet0\/1, changed state to up/, 'đầu bên kia cũng có log LINK');
  assert.match(run(cli, 'r1', 'show logging'), /from FULL to DOWN[\s\S]*from LOADING to FULL/);
});

test('debug ip ospf adj in từng bước; undebug all tắt; "⚡ Hội tụ ngay" in đủ log', () => {
  const { net, cli } = solved('L10');
  N.attachClock(net);
  assert.match(run(cli, 'r1', 'enable', 'debug ip ospf adj'), /OSPF adjacency debugging is on/);
  cfg(cli, 'r1', 'interface g0/2', 'shutdown');
  cfg(cli, 'r1', 'interface g0/2', 'no shutdown');
  drain(net, 'r1');
  N.clockConverge(net);
  const d = drain(net, 'r1');
  for (const s of ['2 Way Communication', 'Prepare dbase exchange', 'Exchange Done', 'Synchronized with', 'LOADING to FULL']) assert.match(d, new RegExp(s), s);
  assert.equal(N.clockPending(net), 0);
  assert.match(run(cli, 'r1', 'show debugging'), /OSPF adjacency debugging is on/);
  assert.match(run(cli, 'r1', 'undebug all'), /All possible debugging has been turned off/);
  assert.equal(run(cli, 'r1', 'show debugging').trim(), '');
});

test('STP: cổng trunk mới bật đi listening → learning → forwarding (30 s), ping chỉ qua được khi forwarding', () => {
  const { net, cli } = solved('L04');
  N.attachClock(net);
  const target = net.devices.s4;
  assert.ok(ping(cli, 's3', target.ip), 'trước khi tắt cổng: ping được');
  cfg(cli, 't3', 'interface g0/1', 'shutdown');
  cfg(cli, 't3', 'interface g0/1', 'no shutdown');
  const stp = () => run(cli, 't3', 'show spanning-tree');
  assert.match(stp(), /Gi0\/1\s+\S+\s+LSN/);
  assert.equal(ping(cli, 's3', target.ip), false, 'listening: chưa chuyển frame');
  tick(net, 16);
  assert.match(stp(), /Gi0\/1\s+\S+\s+LRN/);
  assert.equal(ping(cli, 's3', target.ip), false, 'learning: vẫn chưa chuyển frame');
  tick(net, 15);
  assert.match(stp(), /Gi0\/1\s+\S+\s+FWD/);
  assert.ok(ping(cli, 's3', target.ip), 'forwarding: ping được');
});

test('STP: PortFast lên forwarding ngay; rapid-pvst chỉ ~2 giây', () => {
  const { net, cli } = solved('L04');
  N.attachClock(net);
  cfg(cli, 't3', 'interface fa0/1', 'spanning-tree portfast', 'shutdown');
  cfg(cli, 't3', 'interface fa0/1', 'no shutdown');
  assert.match(run(cli, 't3', 'show spanning-tree'), /Fa0\/1\s+\S+\s+FWD/);
  cfg(cli, 't3', 'spanning-tree mode rapid-pvst');
  cfg(cli, 't4', 'spanning-tree mode rapid-pvst');
  cfg(cli, 't3', 'interface g0/1', 'shutdown');
  cfg(cli, 't3', 'interface g0/1', 'no shutdown');
  assert.match(run(cli, 't3', 'show spanning-tree'), /Gi0\/1\s+\S+\s+LRN/);
  tick(net, 2.5);
  assert.match(run(cli, 't3', 'show spanning-tree'), /Gi0\/1\s+\S+\s+FWD/);
});

test('HSRP: router mới vào nhóm đi Listen → Speak → Standby/Active, có log %HSRP-5-STATECHANGE', () => {
  const { net, cli } = solved('L19');
  N.attachClock(net);
  cfg(cli, 'h1', 'interface g0/0', 'shutdown');
  const h2 = drain(net, 'h2');
  assert.match(h2, /%HSRP-5-STATECHANGE: GigabitEthernet0\/0 Grp \d+ state Standby -> Active/, 'H2 lên Active khi H1 mất');
  cfg(cli, 'h1', 'interface g0/0', 'no shutdown');
  assert.match(run(cli, 'h1', 'show standby'), /State is (Listen|Speak)/);
  tick(net, 4);
  assert.match(run(cli, 'h1', 'show standby'), /State is Speak/);
  tick(net, 8);
  assert.match(run(cli, 'h1', 'show standby'), /State is (Active|Standby)/);
  assert.match(run(cli, 'h1', 'show logging'), /state Init -> Listen[\s\S]*state Listen -> Speak[\s\S]*state Speak -> (Standby|Active)/, 'show logging giữ đủ chuỗi trạng thái');
});

test('EIGRP lên sau 5 giây; BGP qua Active/OpenSent/OpenConfirm rồi Established', () => {
  const e = solved('L12');
  N.attachClock(e.net);
  cfg(e.cli, 'r1', 'interface g0/1', 'shutdown');
  assert.match(drain(e.net, 'r1') + '', /DUAL-5-NBRCHANGE|^$/);
  cfg(e.cli, 'r1', 'interface g0/1', 'no shutdown');
  assert.doesNotMatch(run(e.cli, 'r1', 'show ip eigrp neighbors'), /\d+\.\d+\.\d+\.\d+\s+Gi0\/1/);
  tick(e.net, 6);
  assert.match(drain(e.net, 'r1'), /%DUAL-5-NBRCHANGE: EIGRP-IPv4 100: Neighbor \S+ \(GigabitEthernet0\/1\) is up: new adjacency/);
  const b = solved('D04');
  N.attachClock(b.net);
  cfg(b.cli, 'r1', 'interface g0/0', 'shutdown');
  cfg(b.cli, 'r1', 'interface g0/0', 'no shutdown');
  assert.match(run(b.cli, 'r1', 'show ip bgp summary'), /Active|Idle|OpenSent/);
  tick(b.net, 10);
  assert.match(drain(b.net, 'r1'), /%BGP-5-ADJCHANGE: neighbor \S+ Up/);
});

test('chấm điểm coi như đã hội tụ (đang hội tụ vẫn đạt); debug ip icmp in echo reply', () => {
  const { lab, net, cli } = solved('L10');
  N.attachClock(net);
  cfg(cli, 'r1', 'interface g0/1', 'shutdown');
  cfg(cli, 'r1', 'interface g0/1', 'no shutdown');
  assert.ok(N.clockPending(net) > 0);
  assert.ok(checkLab(lab, net, {}).every(Boolean), 'checkLab chạy ở trạng thái đã hội tụ');
  assert.ok(N.clockPending(net) > 0, 'chấm không làm mất trạng thái đang hội tụ');
  N.clockConverge(net);
  run(cli, 'r2', 'enable', 'debug ip icmp');
  drain(net, 'r2');
  const ip2 = net.devices.r2.ifaces['g0/1'].ip;
  run(cli, 'r1', `ping ${ip2}`);
  assert.match(drain(net, 'r2'), /ICMP: echo reply sent, src \S+, dst \S+, topology BASE/);
  assert.match(cfg(cli, 'r1', 'line con 0', 'logging synchronous') + run(cli, 'r1', 'show running-config'), /line con 0[\s\S]* logging synchronous/);
});
