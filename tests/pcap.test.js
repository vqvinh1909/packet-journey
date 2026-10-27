// tests/pcap.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPcap } from '../packet/pcap.js';
import { serialize } from '../packet/serialize.js';
import { arpFrame, ARP_OP, BROADCAST_MAC } from '../scenarios/_common.js';

function read32LE(buf, off) {
  return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
}

test('Global header: magic little-endian + linktype Ethernet(1)', () => {
  const out = buildPcap([]);
  assert.equal(out.length, 24); // chỉ global header
  // magic 0xa1b2c3d4 ghi little-endian -> d4 c3 b2 a1
  assert.deepEqual(Array.from(out.slice(0, 4)), [0xd4, 0xc3, 0xb2, 0xa1]);
  assert.equal(out[4], 2); // version major (LE)
  assert.equal(out[6], 4); // version minor (LE)
  assert.equal(read32LE(out, 20), 1); // network = LINKTYPE_ETHERNET
});

test('Một frame: record header 16 byte + đúng incl_len/orig_len', () => {
  const frame = serialize(arpFrame({
    op: ARP_OP.REQUEST, senderMac: '00:1a:2b:00:00:01', senderIp: '192.168.1.10',
    targetMac: '00:00:00:00:00:00', targetIp: '192.168.1.20', ethDst: BROADCAST_MAC,
  })).bytes; // 42 byte
  const out = buildPcap([{ bytes: frame }]);
  assert.equal(out.length, 24 + 16 + 42);
  assert.equal(read32LE(out, 24 + 8), 42);  // incl_len
  assert.equal(read32LE(out, 24 + 12), 42); // orig_len
  // byte đầu của frame (sau record header) là broadcast 0xff
  assert.equal(out[24 + 16], 0xff);
});

test('Nhiều frame nối tiếp đúng tổng độ dài', () => {
  const f = Uint8Array.from([1, 2, 3, 4]);
  const out = buildPcap([{ bytes: f }, { bytes: f }, { bytes: f }]);
  assert.equal(out.length, 24 + 3 * (16 + 4));
});
