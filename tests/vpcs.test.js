// tests/vpcs.test.js — PC kiểu VPCS (mặc định trong workspace như EVE-NG): ip …/len gw, ip … mask gw, ip dhcp,
// ip dns, show ip / show arp, ping (5 gói), trace, save → Wipe nạp lại, clear ip, ?; lab có sẵn giữ dòng lệnh Windows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli, runScript } from '../lab/ios.js';
import { getLab, buildLab } from '../lab/labs.js';
import * as S from '../lab/sandbox.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
function setup() {
  const net = S.emptySandbox();
  const r1 = S.addDevice(net, 'router', 100, 100);
  const sw = S.addDevice(net, 'sw2960', 200, 200);
  const pc1 = S.addDevice(net, 'pc', 100, 300), pc2 = S.addDevice(net, 'pc', 300, 300);
  S.connect(net, r1, 'g0/0', sw, 'fa0/1');
  S.connect(net, pc1, 'fa0', sw, 'fa0/2');
  S.connect(net, pc2, 'fa0', sw, 'fa0/3');
  const cli = createCli(net);
  runScript(cli, r1, cfg('interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown', 'exit', 'ip dhcp excluded-address 10.0.0.1 10.0.0.99', 'ip dhcp pool LAN', 'network 10.0.0.0 255.255.255.0', 'default-router 10.0.0.1', 'dns-server 8.8.8.8'));
  const run = (id, c) => cli.exec(id, c).out.join('\n');
  return { net, cli, run, r1, pc1, pc2 };
}

test('PC trong workspace mặc định là VPCS (dấu nhắc "PC1> "), PC của lab có sẵn vẫn là Windows', () => {
  const { net, cli, pc1 } = setup();
  assert.equal(net.devices[pc1].shell, 'vpcs');
  assert.equal(cli.prompt(pc1), 'PC1> ');
  const lab = buildLab(getLab('L01'));
  const pcId = Object.keys(lab.devices).find((k) => lab.devices[k].type === 'pc');
  assert.equal(lab.devices[pcId].shell, undefined);
  assert.equal(createCli(lab).prompt(pcId), 'C:\\>');
  assert.equal(net.devices[S.addDevice(net, 'server', 10, 10)].shell, undefined, 'server giữ dòng lệnh cũ');
});

test('ip: dạng /len + gateway, dạng mask, mặc định /24, gateway sai subnet, trùng IP', () => {
  const { net, run, pc1, pc2 } = setup();
  assert.match(run(pc1, 'ip 10.0.0.10/24 10.0.0.1'), /Checking for duplicate address\.\.\.\nPC1 : 10\.0\.0\.10 255\.255\.255\.0 gateway 10\.0\.0\.1/);
  assert.deepEqual([net.devices[pc1].ip, net.devices[pc1].prefix, net.devices[pc1].gateway], ['10.0.0.10', 24, '10.0.0.1']);
  run(pc2, 'ip 10.0.0.20 255.255.255.128 10.0.0.1');
  assert.equal(net.devices[pc2].prefix, 25);
  run(pc2, 'ip 10.0.0.21');
  assert.equal(net.devices[pc2].prefix, 24, 'mặc định /24');
  assert.match(run(pc2, 'ip 10.0.0.22/24 192.168.1.1'), /not in the subnet/);
  const dup = run(pc2, 'ip 10.0.0.10/24 10.0.0.1');
  assert.match(dup, /10\.0\.0\.10 is being used by MAC .*\nAddress not changed/);
  assert.equal(net.devices[pc2].ip, '10.0.0.21');
});

test('ip dhcp (DDORA), ip dns, show ip; DHCP thất bại → "Can\'t find dhcp server"', () => {
  const { net, run, pc1, r1 } = setup();
  assert.match(run(pc1, 'ip dhcp'), /^DDORA IP 10\.0\.0\.100\/24 GW 10\.0\.0\.1$/);
  const sh = run(pc1, 'show ip');
  for (const re of [/NAME {8}: PC1\[1\]/, /IP\/MASK {5}: 10\.0\.0\.100\/24/, /GATEWAY {5}: 10\.0\.0\.1/, /DNS {9}: 8\.8\.8\.8/, /DHCP SERVER : 10\.0\.0\.1/, /MAC {9}: 00:50:79:66:/]) assert.match(sh, re);
  run(pc1, 'ip dns 1.1.1.1');
  assert.equal(net.devices[pc1].dns, '1.1.1.1');
  assert.match(run(pc1, 'dhcp'), /DDORA/, 'lệnh tắt "dhcp"');
  run(r1, 'configure terminal'); run(r1, 'no ip dhcp pool LAN'); run(r1, 'end');
  assert.match(run(pc1, 'ip dhcp'), /DDD\nCan't find dhcp server/);
});

test('ping 5 gói kiểu VPCS, timeout, không có gateway; trace; show arp', () => {
  const { run, pc1, pc2 } = setup();
  run(pc1, 'ip 10.0.0.10/24 10.0.0.1');
  run(pc2, 'ip 10.0.0.20/24 10.0.0.1');
  const p = run(pc1, 'ping 10.0.0.20');
  assert.equal(p.split('\n').length, 5);
  assert.match(p, /^84 bytes from 10\.0\.0\.20 icmp_seq=1 ttl=\d+ time=[\d.]+ ms/);
  assert.equal(run(pc1, 'ping 10.0.0.20 -c 2').split('\n').length, 2);
  assert.match(run(pc1, 'ping 10.0.0.77'), /10\.0\.0\.77 icmp_seq=1 timeout/);
  assert.match(run(pc1, 'show arp'), /00:50:79:66:\S+ {2}10\.0\.0\.20 expires in \d+ seconds/);
  assert.match(run(pc1, 'trace 10.0.0.1'), /trace to 10\.0\.0\.1, 8 hops max[\s\S]*\*10\.0\.0\.1/);
  run(pc2, 'clear ip');
  assert.match(run(pc2, 'ping 10.0.0.10'), /not reachable/);
});

test('save → Wipe nạp lại cấu hình đã lưu; clear ip; ?; gõ lệnh Windows được nhắc', () => {
  const { net, run, pc1 } = setup();
  run(pc1, 'ip 10.0.0.10/24 10.0.0.1');
  assert.match(run(pc1, 'save'), /Saving startup configuration to startup\.vpc\n\.  done/);
  assert.match(run(pc1, 'clear ip'), /cleared/);
  assert.equal(net.devices[pc1].ip, '');
  S.wipeDevice(net, pc1);
  assert.equal(net.devices[pc1].shell, 'vpcs');
  assert.equal(net.devices[pc1].ip, '10.0.0.10', 'Wipe → nạp lại startup.vpc');
  assert.ok(S.bootLog(net.devices[pc1]).some((l) => /Virtual PC Simulator/.test(l)));
  S.startDevice(net, pc1);
  const h = run(pc1, '?');
  for (const c of ['ip ARG', 'ping HOST', 'trace HOST', 'save', 'show [ARG]', 'clear ARG']) assert.ok(h.includes(c), c);
  assert.match(run(pc1, 'ipconfig'), /Bad command[\s\S]*VPCS/);
  assert.match(run(pc1, 'ip ?'), /address \[mask\] \[gateway\]/);
});
