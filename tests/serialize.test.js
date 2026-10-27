// tests/serialize.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, findField } from '../packet/serialize.js';
import { internetChecksum } from '../packet/checksum.js';
import { pingData } from '../scenarios/_common.js';

function echoPacket() {
  return serialize([
    { proto: 'ethernet', fields: { dst: '00:1a:2b:00:00:02', src: '00:1a:2b:00:00:01', etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '192.168.1.10', dst: '192.168.1.20', ttl: 64, id: 0x4d2a, protocol: 1 } },
    { proto: 'icmp', fields: { type: 8, code: 0, identifier: 1, seq: 1, data: pingData(32) } },
  ]);
}

test('Tổng độ dài gói = 14 (eth) + 20 (ip) + 40 (icmp 8+32) = 74 byte', () => {
  const { bytes } = echoPacket();
  assert.equal(bytes.length, 74);
});

test('IPv4 Total Length = 60 (20 header + 40 ICMP)', () => {
  const { tree } = echoPacket();
  const len = findField(tree, 'ip.len');
  assert.equal(len.display, '60 byte');
});

test('IPv4 header checksum hợp lệ (checksum trên 20 byte header = 0)', () => {
  const { bytes, tree } = echoPacket();
  const ip = tree.find((l) => l.layer === 'ipv4');
  const hdr = bytes.slice(ip.byteOffset, ip.byteOffset + ip.byteLength);
  assert.equal(internetChecksum(hdr), 0);
});

test('ICMP checksum hợp lệ (checksum trên toàn bộ ICMP = 0)', () => {
  const { bytes, tree } = echoPacket();
  const icmp = tree.find((l) => l.layer === 'icmp');
  const seg = bytes.slice(icmp.byteOffset, icmp.byteOffset + icmp.byteLength);
  assert.equal(internetChecksum(seg), 0);
});

test('Offset các trường đúng vị trí byte tuyệt đối', () => {
  const { tree } = echoPacket();
  assert.equal(findField(tree, 'eth.dst').byteOffset, 0);
  assert.equal(findField(tree, 'eth.src').byteOffset, 6);
  assert.equal(findField(tree, 'eth.type').byteOffset, 12);
  assert.equal(findField(tree, 'ip.version').byteOffset, 14);
  assert.equal(findField(tree, 'ip.ttl').byteOffset, 22);   // 14 + 8
  assert.equal(findField(tree, 'ip.src').byteOffset, 26);   // 14 + 12
  assert.equal(findField(tree, 'icmp.type').byteOffset, 34); // 14 + 20
});

test('EtherType của frame IPv4 = 0x0800', () => {
  const { bytes } = echoPacket();
  assert.equal(bytes[12], 0x08);
  assert.equal(bytes[13], 0x00);
});
