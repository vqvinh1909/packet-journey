// tests/np-proto.test.js
// Các giao thức CCNP: độ dài khai báo khớp số byte thật, checksum đúng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize } from '../packet/serialize.js';
import { internetChecksum } from '../packet/checksum.js';

const bytes = (proto, fields) => [...serialize([{ proto, fields }]).bytes];
const u16 = (b, i) => (b[i] << 8) | b[i + 1];

test('IGMP và PIM: checksum Internet trên toàn bản tin bằng 0', () => {
  for (const [p, f] of [
    ['igmp', { type: 0x16, group: '239.1.1.1' }],
    ['igmp', { type: 0x22, group: '232.1.1.1', recType: 1, sources: ['10.1.1.10'] }],
    ['pim', { type: 'hello' }],
    ['pim', { type: 'join', upstream: '10.0.23.2', group: '239.1.1.1', joins: [{ addr: '10.0.0.100', flags: 7 }] }],
  ]) assert.equal(internetChecksum(bytes(p, f)), 0, p);
});

test('PIM Join: đúng khuôn RFC 7761, số nguồn khớp danh sách', () => {
  const b = bytes('pim', { type: 'join', upstream: '10.0.23.2', group: '239.1.1.1', joins: [{ addr: '10.1.1.10', flags: 4 }], prunes: [{ addr: '10.1.1.20', flags: 5 }] });
  assert.equal(b[0], 0x23);
  assert.equal(b.length, 4 + 6 + 4 + 8 + 4 + 8 + 8);
  assert.equal(u16(b, 22), 1);
  assert.equal(u16(b, 24), 1);
});

test('NHRP: Packet Size bằng số byte thật, có và không có CIE', () => {
  const base = { op: 3, srcNbma: '20.0.0.1', srcProto: '172.16.0.1', dstProto: '172.16.0.254', reqId: 1 };
  for (const f of [base, { ...base, op: 2, cie: { nbma: '30.0.0.2', proto: '192.168.2.0', prefix: 24 } }]) {
    const b = bytes('nhrp', f);
    assert.equal(u16(b, 10), b.length);
    assert.equal(internetChecksum(b), 0);
  }
});

test('LDP: PDU Length và Message Length khớp số byte thật', () => {
  const hello = bytes('ldp', { lsrId: '2.2.2.2', hello: true });
  assert.equal(u16(hello, 2) + 4, hello.length);
  assert.equal(u16(hello, 12) + 14, hello.length);
  const map = bytes('ldp', { lsrId: '3.3.3.3', fec: '3.3.3.3', prefix: 32, label: 3 });
  assert.equal(u16(map, 2) + 4, map.length);
  assert.equal(u16(map, 10), 0x0400);
  assert.equal(u16(map, 12) + 14, map.length);
});

test('BFD 24 byte, LISP Map-Register có độ dài bản ghi đúng', () => {
  const b = bytes('bfd', { state: 3, myDisc: 1, yourDisc: 2, tx: 50000, rx: 50000, mult: 3 });
  assert.equal(b.length, 24);
  assert.equal(b[1] >> 6, 3);
  assert.equal(bytes('lisp', { type: 'register', eid: '192.168.2.0', mask: 24, rloc: '30.0.0.2' }).length, 4 + 8 + 16 + 10 + 6 + 12);
});

test('BGP VPNv4: AFI 1, SAFI 128, nhãn và độ dài NLRI đúng RFC 4364', () => {
  const b = bytes('bgp', { type: 2, vpnv4: { rd: [65000, 1], prefix: '192.168.2.0', len: 24, label: 100, nextHop: '3.3.3.3', rt: [65000, 1] } });
  assert.equal(u16(b, 16), b.length);
  assert.equal(u16(b, 21) + 23, b.length);
  const at = b.findIndex((x, i) => x === 0x90 && b[i + 1] === 14);
  assert.deepEqual(b.slice(at + 4, at + 7), [0, 1, 128]);
  const nlri = at + 4 + 3 + 1 + 12 + 1;
  assert.equal(b[nlri], 24 + 64 + 24);
  assert.equal(((b[nlri + 1] << 16) | (b[nlri + 2] << 8) | b[nlri + 3]) >> 4, 100);
});

test('VXLAN-GPO: cờ G bật và SGT nằm trong header, thiếu sgt thì như cũ', () => {
  assert.deepEqual(bytes('vxlan', { vni: 8190, sgt: 10 }).slice(0, 4), [0x88, 0, 0, 10]);
  assert.deepEqual(bytes('vxlan', { vni: 8190 }).slice(0, 4), [0x08, 0, 0, 0]);
});
