// tests/switching.test.js — CCNA Switching: 802.1Q tag, 802.3+LLC+STP BPDU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, findField } from '../packet/serialize.js';
import { pingData } from '../scenarios/_common.js';

// ---- 802.1Q tagged frame ----
function taggedEcho() {
  return serialize([
    { proto: 'ethernet', fields: { dst: '00:10:10:bb:00:02', src: '00:10:10:aa:00:01', etherType: 0x8100 } },
    { proto: 'dot1q', fields: { pcp: 0, dei: 0, vid: 10, innerType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '192.168.10.1', dst: '192.168.10.2', ttl: 64, id: 1, protocol: 1 } },
    { proto: 'icmp', fields: { type: 8, code: 0, identifier: 4, seq: 1, data: pingData(32) } },
  ]);
}

test('802.1Q: TPID 0x8100 xuất hiện ĐÚNG MỘT LẦN (là eth.type), rồi TCI + EtherType thật', () => {
  const { bytes } = taggedEcho();
  assert.equal(bytes[12], 0x81); assert.equal(bytes[13], 0x00); // TPID (eth.type)
  assert.equal(bytes[14], 0x00); assert.equal(bytes[15], 0x0a); // TCI: vid 10
  assert.equal(bytes[16], 0x08); assert.equal(bytes[17], 0x00); // inner EtherType IPv4
});

test('802.1Q: frame dài thêm đúng 4 byte so với không tag', () => {
  const { bytes } = taggedEcho(); // 14 + 4(tag) + 20 + 40 = 78
  assert.equal(bytes.length, 78);
  assert.equal(findField(taggedEcho().tree, 'dot1q.vid').display, '10');
});

// ---- 802.3 + LLC + STP BPDU ----
function bpdu() {
  return serialize([
    { proto: 'ethernet', fields: { dst: '01:80:c2:00:00:00', src: '00:00:0c:aa:00:01', mode: '802.3' } },
    { proto: 'llc', fields: {} },
    { proto: 'stp', fields: {
      version: 0, type: 0, flags: 0,
      rootPriority: 4096, rootSysId: 0, rootMac: '00:00:0c:aa:00:01', rootPathCost: 0,
      bridgePriority: 4096, bridgeSysId: 0, bridgeMac: '00:00:0c:aa:00:01',
      portPriority: 128, portNumber: 1, msgAge: 0, maxAge: 20, hello: 2, fwdDelay: 15,
    } },
  ]);
}

test('BPDU: tổng dài 52 byte = eth(14) + llc(3) + stp(35)', () => {
  assert.equal(bpdu().bytes.length, 52);
});

test('Khung 802.3: trường Length = độ dài payload (38 byte), không phải EtherType', () => {
  const { bytes, tree } = bpdu();
  assert.equal(findField(tree, 'eth.len').display, '38 byte');
  assert.equal(bytes[12], 0x00); assert.equal(bytes[13], 0x26); // 38 = 0x26
});

test('LLC: DSAP/SSAP = 0x42 (STP), Control = 0x03', () => {
  const { bytes } = bpdu();
  assert.equal(bytes[14], 0x42); assert.equal(bytes[15], 0x42); assert.equal(bytes[16], 0x03);
});

test('STP: Root ID Priority = 4096 (0x1000), Max Age = 20s (0x1400)', () => {
  const { bytes, tree } = bpdu();
  const prio = findField(tree, 'stp.root.prio');
  assert.equal(bytes[prio.byteOffset], 0x10);
  assert.equal(bytes[prio.byteOffset + 1], 0x00);
  const maxage = findField(tree, 'stp.maxage');
  assert.equal(bytes[maxage.byteOffset], 0x14);
  assert.equal(bytes[maxage.byteOffset + 1], 0x00);
});
