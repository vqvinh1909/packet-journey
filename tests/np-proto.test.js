// tests/np-proto.test.js
// Các giao thức CCNP: độ dài khai báo khớp số byte thật, checksum đúng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize } from '../packet/serialize.js';
import { internetChecksum } from '../packet/checksum.js';
import { getScenario } from '../scenarios/index.js';

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

test('SIP: Content-Length đúng số byte SDP, dòng trống ngăn phần thân', () => {
  const text = (fields) => new TextDecoder().decode(new Uint8Array(bytes('sip', fields)));
  const msg = text({ start: 'INVITE sip:2002@10.0.0.5 SIP/2.0', headers: [['CSeq', '1 INVITE']], sdp: { user: '2001', sess: 1, ip: '10.0.0.1', port: 16384, pts: [0, 18] } });
  const [head, body] = msg.split('\r\n\r\n');
  assert.equal(Number(/Content-Length: (\d+)/.exec(head)[1]), body.length);
  assert.match(body, /m=audio 16384 RTP\/AVP 0 18\r\n/);
  assert.match(body, /a=rtpmap:18 G729\/8000/);
  assert.match(text({ start: 'SIP/2.0 180 Ringing', headers: [] }), /^SIP\/2\.0 180 Ringing\r\nContent-Length: 0\r\n\r\n$/);
});

test('RTP và RTCP: đúng khuôn RFC 3550, độ dài khớp số byte thật', () => {
  const r = bytes('rtp', { pt: 0, seq: 258, ts: 160, ssrc: 0x01020304, marker: true });
  assert.equal(r.length, 12 + 160);
  assert.equal(r[0] >> 6, 2);
  assert.equal(r[1], 0x80);
  assert.equal(u16(r, 2), 258);
  assert.deepEqual(r.slice(8, 12), [1, 2, 3, 4]);
  const c = bytes('rtcp', { ssrc: 1, ntp: [1, 2], ts: 3, packets: 4, octets: 5, peer: 6, lost8: 2, lostTotal: 8, extSeq: 9, jitter: 80, lsr: 0, dlsr: 0 });
  assert.equal((u16(c, 2) + 1) * 4, c.length);
  assert.equal(c[1], 200);
  assert.equal(c[0] & 0x1f, 1);
});

test('Kịch bản VoIP: RTP đi thẳng và đúng cổng đã chốt trong SDP', () => {
  const ev = getScenario('s40-voip-call').build().events.filter((e) => e.packet);
  const layer = (e, p) => e.packet.layers.find((l) => l.proto === p);
  const flow = ev.filter((e) => layer(e, 'sip')).map((e) => layer(e, 'sip').fields.start.split(' ')[0] === 'SIP/2.0' ? layer(e, 'sip').fields.start.split(' ')[1] : layer(e, 'sip').fields.start.split(' ')[0]);
  assert.deepEqual(flow, ['REGISTER', '200', 'INVITE', '100', 'INVITE', '180', '200', 'ACK', 'BYE', '200']);
  const answer = ev.find((e) => layer(e, 'sip')?.fields.sdp?.pts.length === 1);
  const offer = ev.find((e) => layer(e, 'sip')?.fields.sdp?.pts.length > 1);
  const media = ev.find((e) => layer(e, 'rtp'));
  assert.equal(layer(media, 'ipv4').fields.dst, layer(answer, 'sip').fields.sdp.ip, 'RTP tới thẳng IP trong SDP trả lời');
  assert.equal(layer(media, 'udp').fields.dstPort, layer(answer, 'sip').fields.sdp.port);
  assert.equal(layer(media, 'udp').fields.srcPort, layer(offer, 'sip').fields.sdp.port);
  assert.equal(layer(media, 'ipv4').fields.dscp, 46);
});

test('VXLAN-GPO: cờ G bật và SGT nằm trong header, thiếu sgt thì như cũ', () => {
  assert.deepEqual(bytes('vxlan', { vni: 8190, sgt: 10 }).slice(0, 4), [0x88, 0, 0, 10]);
  assert.deepEqual(bytes('vxlan', { vni: 8190 }).slice(0, 4), [0x08, 0, 0, 0]);
});
