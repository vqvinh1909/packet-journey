// tests/advanced.test.js — CCNA/CCNP: TCP, HSRP, BGP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, findField } from '../packet/serialize.js';
import { internetChecksum, pseudoHeaderV4 } from '../packet/checksum.js';
import { parseIp } from '../packet/addr.js';

// ---- TCP ----
function tcpSyn() {
  return serialize([
    { proto: 'ethernet', fields: { dst: '00:1a:2b:00:00:02', src: '00:1a:2b:00:00:01', etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '192.168.1.10', dst: '93.184.216.34', ttl: 64, id: 1, protocol: 6 } },
    { proto: 'tcp', fields: { srcPort: 50000, dstPort: 80, seq: 1000, ack: 0, flags: { syn: true }, window: 64240, mss: 1460 } },
  ]);
}

test('TCP SYN: cờ = 0x02, Data Offset 6 (24 byte, có MSS), checksum pseudo-header hợp lệ', () => {
  const { bytes, tree } = tcpSyn();
  assert.equal(bytes[findField(tree, 'tcp.flags').byteOffset], 0x02);
  assert.equal(findField(tree, 'tcp.off').display, '6 (24 byte)');
  assert.equal(findField(tree, 'tcp.mss').display, '1460 byte');
  const tcp = tree.find((l) => l.layer === 'tcp');
  const seg = Array.from(bytes.slice(tcp.byteOffset));
  const ph = pseudoHeaderV4(parseIp('192.168.1.10'), parseIp('93.184.216.34'), 6, seg.length);
  assert.equal(internetChecksum(ph.concat(seg)), 0);
});

test('TCP SYN-ACK: cờ SYN+ACK = 0x12, ack = seq+1', () => {
  const { bytes, tree } = serialize([
    { proto: 'ethernet', fields: { dst: '00:1a:2b:00:00:01', src: '00:1a:2b:00:00:02', etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '93.184.216.34', dst: '192.168.1.10', ttl: 64, id: 1, protocol: 6 } },
    { proto: 'tcp', fields: { srcPort: 80, dstPort: 50000, seq: 5000, ack: 1001, flags: { syn: true, ack: true }, mss: 1460 } },
  ]);
  assert.equal(bytes[findField(tree, 'tcp.flags').byteOffset], 0x12);
  assert.equal(findField(tree, 'tcp.ack').display, '1001');
});

// ---- HSRP ----
function hsrpHello() {
  return serialize([
    { proto: 'ethernet', fields: { dst: '01:00:5e:00:00:02', src: '00:00:0c:07:ac:01', etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '192.168.1.252', dst: '224.0.0.2', ttl: 1, id: 0, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 1985, dstPort: 1985 } },
    { proto: 'hsrp', fields: { opcode: 0, state: 16, priority: 110, group: 1, virtualIp: '192.168.1.1' } },
  ]);
}

test('HSRP: 20 byte, State = Active(16), Priority 110, Virtual IP', () => {
  const { bytes, tree } = hsrpHello();
  const h = tree.find((l) => l.layer === 'hsrp');
  assert.equal(h.byteLength, 20);
  assert.equal(bytes[findField(tree, 'hsrp.state').byteOffset], 16);
  assert.equal(bytes[findField(tree, 'hsrp.prio').byteOffset], 110);
  assert.equal(findField(tree, 'hsrp.vip').display, '192.168.1.1');
});

// ---- BGP ----
function bgp(fields) {
  return serialize([
    { proto: 'ethernet', fields: { dst: '00:1a:2b:00:00:02', src: '00:1a:2b:00:00:01', etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '10.0.0.1', dst: '10.0.0.2', ttl: 1, id: 1, protocol: 6 } },
    { proto: 'tcp', fields: { srcPort: 179, dstPort: 50000, seq: 1, ack: 1, flags: { ack: true, psh: true } } },
    { proto: 'bgp', fields },
  ]);
}

test('BGP OPEN: Marker 16×0xFF, Length 29, Type 1, My AS', () => {
  const { bytes, tree } = bgp({ type: 1, myAs: 65001, holdTime: 180, bgpId: '1.1.1.1' });
  const m = findField(tree, 'bgp.marker');
  assert.deepEqual(Array.from(bytes.slice(m.byteOffset, m.byteOffset + 16)), new Array(16).fill(0xff));
  assert.equal(findField(tree, 'bgp.length').display, '29 byte');
  assert.equal(findField(tree, 'bgp.myas').display, '65001');
});

test('BGP KEEPALIVE: Length = 19 (chỉ header)', () => {
  const { tree } = bgp({ type: 4 });
  assert.equal(findField(tree, 'bgp.length').display, '19 byte');
});

test('BGP UPDATE: AS_PATH chứa đúng chuỗi AS', () => {
  const { tree } = bgp({ type: 2, origin: 0, asPath: [65001, 65002], nextHop: '10.0.0.1', nlri: { prefix: '192.168.9.0', len: 24 } });
  assert.equal(findField(tree, 'bgp.aspath').display, 'AS_SEQ [65001 65002]');
  assert.equal(findField(tree, 'bgp.nlri').display, '192.168.9.0/24');
});
