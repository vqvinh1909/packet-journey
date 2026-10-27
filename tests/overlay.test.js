// tests/overlay.test.js — MPLS label stack + VXLAN overlay.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, findField } from '../packet/serialize.js';
import { internetChecksum, pseudoHeaderV4 } from '../packet/checksum.js';
import { parseIp } from '../packet/addr.js';

test('MPLS: EtherType 0x8847, nhãn 4 byte, S=1', () => {
  const { bytes, tree } = serialize([
    { proto: 'ethernet', fields: { dst: '00:1a:2b:00:00:02', src: '00:1a:2b:00:00:01', etherType: 0x8847 } },
    { proto: 'mpls', fields: { label: 100, tc: 0, s: 1, ttl: 255 } },
    { proto: 'ipv4', fields: { src: '10.0.0.1', dst: '10.0.0.2', ttl: 64, id: 1, protocol: 1 } },
    { proto: 'icmp', fields: { type: 8, code: 0, identifier: 1, seq: 1, data: [] } },
  ]);
  assert.equal(bytes[12], 0x88); assert.equal(bytes[13], 0x47);
  const m = tree.find((l) => l.layer === 'mpls');
  assert.equal(m.byteLength, 4);
  assert.equal(findField(tree, 'mpls.label').display, '100');
  assert.equal(findField(tree, 'mpls.s').display, '1 (đáy)');
});

test('MPLS stack 2 nhãn: nhãn ngoài S=0, nhãn trong S=1', () => {
  const { tree } = serialize([
    { proto: 'ethernet', fields: { dst: '00:1a:2b:00:00:02', src: '00:1a:2b:00:00:01', etherType: 0x8847 } },
    { proto: 'mpls', fields: { label: 16, s: 0, ttl: 255 } },
    { proto: 'mpls', fields: { label: 200, s: 1, ttl: 255 } },
    { proto: 'ipv4', fields: { src: '10.0.0.1', dst: '10.0.0.2', ttl: 64, id: 1, protocol: 1 } },
    { proto: 'icmp', fields: { type: 8, code: 0, identifier: 1, seq: 1, data: [] } },
  ]);
  const labels = tree.filter((l) => l.layer === 'mpls');
  assert.equal(labels.length, 2);
});

function vxlan() {
  return serialize([
    { proto: 'ethernet', fields: { dst: '00:1a:2b:00:0e:02', src: '00:1a:2b:00:0e:01', etherType: 0x0800 } }, // outer
    { proto: 'ipv4', fields: { src: '10.0.0.1', dst: '10.0.0.2', ttl: 64, id: 1, protocol: 17 } },          // underlay
    { proto: 'udp', fields: { srcPort: 50000, dstPort: 4789 } },
    { proto: 'vxlan', fields: { vni: 5000 } },
    { proto: 'ethernet', fields: { dst: '00:aa:00:00:00:02', src: '00:aa:00:00:00:01', etherType: 0x0800 } }, // inner
    { proto: 'ipv4', fields: { src: '192.168.1.1', dst: '192.168.1.2', ttl: 64, id: 9, protocol: 1 } },
    { proto: 'icmp', fields: { type: 8, code: 0, identifier: 1, seq: 1, data: [] } },
  ]);
}

test('VXLAN: UDP đích 4789, VNI 5000, có 2 lớp Ethernet (outer + inner)', () => {
  const { tree } = vxlan();
  assert.equal(findField(tree, 'udp.dst').display, '4789');
  assert.equal(findField(tree, 'vxlan.vni').display, '5000');
  assert.equal(tree.filter((l) => l.layer === 'ethernet').length, 2);
  assert.equal(tree.filter((l) => l.layer === 'ipv4').length, 2);
});

test('VXLAN: UDP checksum (bọc toàn bộ khung trong) hợp lệ', () => {
  const { bytes, tree } = vxlan();
  const udp = tree.find((l) => l.layer === 'udp');
  const seg = Array.from(bytes.slice(udp.byteOffset));
  const ph = pseudoHeaderV4(parseIp('10.0.0.1'), parseIp('10.0.0.2'), 17, seg.length);
  assert.equal(internetChecksum(ph.concat(seg)), 0);
});
