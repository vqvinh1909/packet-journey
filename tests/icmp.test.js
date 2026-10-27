// tests/icmp.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, findField } from '../packet/serialize.js';
import { internetChecksum } from '../packet/checksum.js';
import { echoFrame, ICMP_TYPE, pingData } from '../scenarios/_common.js';

function echo(type) {
  return serialize(echoFrame({
    ethDst: '00:1a:2b:00:00:02', ethSrc: '00:1a:2b:00:00:01',
    srcIp: '192.168.1.10', dstIp: '192.168.1.20', ttl: 64, ipId: 0x4d2a,
    identifier: 1, seq: 1, type, data: pingData(32),
  }));
}

test('ICMP Echo Request có type = 8 tại đúng offset', () => {
  const { bytes, tree } = echo(ICMP_TYPE.ECHO_REQUEST);
  const off = findField(tree, 'icmp.type').byteOffset;
  assert.equal(bytes[off], 8);
});

test('ICMP Echo Reply có type = 0', () => {
  const { bytes, tree } = echo(ICMP_TYPE.ECHO_REPLY);
  const off = findField(tree, 'icmp.type').byteOffset;
  assert.equal(bytes[off], 0);
});

test('ICMP checksum tính thật: tính lại trên toàn ICMP = 0', () => {
  const { bytes, tree } = echo(ICMP_TYPE.ECHO_REQUEST);
  const icmp = tree.find((l) => l.layer === 'icmp');
  const seg = bytes.slice(icmp.byteOffset, icmp.byteOffset + icmp.byteLength);
  assert.equal(internetChecksum(seg), 0);
});

test('Đổi TTL thì IPv4 checksum đổi theo (được tính lại)', () => {
  const a = serialize(echoFrame({
    ethDst: '00:1a:2b:00:00:02', ethSrc: '00:1a:2b:00:00:01', srcIp: '192.168.1.10',
    dstIp: '192.168.1.20', ttl: 64, ipId: 1, identifier: 1, seq: 1, type: 8, data: [],
  }));
  const b = serialize(echoFrame({
    ethDst: '00:1a:2b:00:00:02', ethSrc: '00:1a:2b:00:00:01', srcIp: '192.168.1.10',
    dstIp: '192.168.1.20', ttl: 63, ipId: 1, identifier: 1, seq: 1, type: 8, data: [],
  }));
  const ca = findField(a.tree, 'ip.checksum').display;
  const cb = findField(b.tree, 'ip.checksum').display;
  assert.notEqual(ca, cb);
});
