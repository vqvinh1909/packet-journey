// tests/routing.test.js — CCNA/CCNP Routing: OSPF Hello, EIGRP Hello.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, findField } from '../packet/serialize.js';
import { internetChecksum } from '../packet/checksum.js';

function ospfHello(neighbors = []) {
  return serialize([
    { proto: 'ethernet', fields: { dst: '01:00:5e:00:00:05', src: '00:00:00:00:00:a1', etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '10.0.0.1', dst: '224.0.0.5', ttl: 1, id: 0, protocol: 89 } },
    { proto: 'ospf', fields: { type: 1, routerId: '1.1.1.1', areaId: '0.0.0.0', neighbors } },
  ]);
}

test('OSPF: IP protocol = 89, version = 2, type = 1 (Hello)', () => {
  const { bytes, tree } = ospfHello();
  assert.equal(findField(tree, 'ip.proto').display, '89 — OSPF');
  assert.equal(bytes[findField(tree, 'ospf.version').byteOffset], 2);
  assert.equal(bytes[findField(tree, 'ospf.type').byteOffset], 1);
});

test('OSPF: Packet Length = 44 (0 neighbor) / 52 (2 neighbor)', () => {
  assert.equal(findField(ospfHello([]).tree, 'ospf.len').display, '44 byte');
  assert.equal(findField(ospfHello(['1.1.1.1', '2.2.2.2']).tree, 'ospf.len').display, '52 byte');
});

test('OSPF checksum hợp lệ, BỎ 8 byte Authentication (offset 16–23)', () => {
  const { bytes, tree } = ospfHello();
  const ospf = tree.find((l) => l.layer === 'ospf');
  const seg = Array.from(bytes.slice(ospf.byteOffset, ospf.byteOffset + ospf.byteLength));
  const part = seg.slice(0, 16).concat(seg.slice(24)); // bỏ Authentication
  assert.equal(internetChecksum(part), 0);
});

// ---- EIGRP ----
function eigrpHello() {
  return serialize([
    { proto: 'ethernet', fields: { dst: '01:00:5e:00:00:0a', src: '00:00:00:00:00:b1', etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '10.0.13.1', dst: '224.0.0.10', ttl: 1, id: 0, protocol: 88 } },
    { proto: 'eigrp', fields: { opcode: 5, hello: true, asn: 100, k: [1, 0, 1, 0, 0, 0], hold: 15 } },
  ]);
}

test('EIGRP: IP protocol = 88, version = 2, opcode = 5 (Hello)', () => {
  const { bytes, tree } = eigrpHello();
  assert.equal(findField(tree, 'ip.proto').display, '88 — EIGRP');
  assert.equal(bytes[findField(tree, 'eigrp.version').byteOffset], 2);
  assert.equal(bytes[findField(tree, 'eigrp.opcode').byteOffset], 5);
});

test('EIGRP checksum hợp lệ (tính trên toàn gói EIGRP = 0)', () => {
  const { bytes, tree } = eigrpHello();
  const e = tree.find((l) => l.layer === 'eigrp');
  const seg = bytes.slice(e.byteOffset, e.byteOffset + e.byteLength);
  assert.equal(internetChecksum(seg), 0);
});

test('EIGRP Hello: AS = 100, Parameters TLV type 0x0001, Hold = 15s', () => {
  const { tree } = eigrpHello();
  assert.equal(findField(tree, 'eigrp.asn').display, '100');
  assert.equal(findField(tree, 'eigrp.tlv.type').display, '0x0001');
  assert.equal(findField(tree, 'eigrp.hold').display, '15s');
});
