// tests/ios-edge.test.js — đầu vào lạ trên CLI: không văng lỗi, từ chối như IOS thật.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli } from '../lab/ios.js';
import { LABS, buildLab } from '../lab/labs.js';
import * as S from '../lab/sandbox.js';

test('ip address: multicast và loopback không phải địa chỉ host', () => {
  const net = S.emptySandbox(), r = S.addDevice(net, 'router', 100, 100), cli = createCli(net);
  for (const c of ['enable', 'configure terminal', 'interface g0/0']) cli.exec(r, c);
  for (const c of ['ip address 224.0.0.1 255.255.255.0', 'ip address 127.0.0.1 255.0.0.0']) assert.match(cli.exec(r, c).out.join(' '), /Not a valid host address/);
  assert.ok(!net.devices[r].ifaces['g0/0'].ip);
  cli.exec(r, 'ip address 10.0.0.1 255.255.255.0');
  assert.equal(net.devices[r].ifaces['g0/0'].ip, '10.0.0.1');
});

test('vtp password __proto__ không làm lệnh văng lỗi', () => {
  const net = buildLab(LABS.find((l) => l.id === 'A11')), cli = createCli(net);
  for (const id of Object.keys(net.devices).filter((x) => net.devices[x].type === 'switch')) {
    for (const c of ['enable', 'configure terminal', 'vtp domain X', 'vtp password __proto__']) assert.doesNotThrow(() => cli.exec(id, c));
  }
});
