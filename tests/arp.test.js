// tests/arp.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, findField } from '../packet/serialize.js';
import { arpFrame, ARP_OP, BROADCAST_MAC } from '../scenarios/_common.js';
import { bytesToHex } from '../packet/bytes.js';

function arpRequest() {
  return serialize(arpFrame({
    op: ARP_OP.REQUEST, senderMac: '00:1a:2b:00:00:01', senderIp: '192.168.1.10',
    targetMac: '00:00:00:00:00:00', targetIp: '192.168.1.20', ethDst: BROADCAST_MAC,
  }));
}

test('Frame ARP Request = 14 (eth) + 28 (arp) = 42 byte', () => {
  const { bytes } = arpRequest();
  assert.equal(bytes.length, 42);
});

test('EtherType ARP = 0x0806', () => {
  const { bytes } = arpRequest();
  assert.equal(bytes[12], 0x08);
  assert.equal(bytes[13], 0x06);
});

test('So byte nguyên văn một gói ARP Request mẫu', () => {
  const { bytes } = arpRequest();
  // dst(broadcast) + src + type(0806) + htype(0001) ptype(0800) hlen(06) plen(04)
  // oper(0001) sha(mac PC1) spa(c0a80a? -> 192.168.1.10) tha(0) tpa(192.168.1.20)
  const expected =
    'ffffffffffff' + '001a2b000001' + '0806' +
    '0001' + '0800' + '06' + '04' + '0001' +
    '001a2b000001' + 'c0a8010a' +
    '000000000000' + 'c0a80114';
  assert.equal(bytesToHex(bytes), expected);
});

test('Trường arp.oper nằm ở byte 20 (14 + 6)', () => {
  const { tree } = arpRequest();
  assert.equal(findField(tree, 'arp.oper').byteOffset, 20);
});
