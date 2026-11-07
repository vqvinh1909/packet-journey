// tests/scenario-accuracy.test.js — rà byte thật của mọi gói trong 40 kịch bản, và giữ các chỗ đã sửa sau đợt rà nội dung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS } from '../scenarios/index.js';
import { findField, flattenFields } from '../packet/serialize.js';

const built = Object.fromEntries(SCENARIOS.map((s) => [s.meta.id, s.build()]));
const pk = (id) => built[id].events.filter((e) => e.packet?.tree).map((e) => e.packet);
const val = (p, name) => findField(p.tree, name)?.display;
const all = (p, name) => flattenFields(p.tree).filter((f) => f.name === name).map((f) => f.display);

const sum16 = (b, init = 0) => { let s = init; for (let i = 0; i < b.length; i += 2) s += (b[i] << 8) + (b[i + 1] ?? 0); while (s >> 16) s = (s & 0xffff) + (s >> 16); return s; };
const ok16 = (b, init = 0) => sum16(b, init) === 0xffff;
const hx = (n) => n.toString(16).padStart(2, '0');

test('mọi gói IPv4/IPv6 của 40 kịch bản: checksum, độ dài, MAC multicast đúng', () => {
  const bad = [];
  for (const s of SCENARIOS) for (const e of built[s.meta.id].events) {
    const b = e.packet?.bytes; if (!b?.length) continue;
    const at = `${s.meta.id} "${e.titleVi}"`;
    const dst = [...b.slice(0, 6)].map(hx).join(':');
    let off = 12, et = (b[off] << 8) | b[off + 1];
    while (et === 0x8100) { off += 4; et = (b[off] << 8) | b[off + 1]; }
    off += 2;
    if (et === 0x0800) {
      const ihl = (b[off] & 15) * 4, tot = (b[off + 2] << 8) | b[off + 3];
      if (!ok16(b.slice(off, off + ihl))) bad.push(`${at}: checksum IPv4`);
      if (tot !== b.length - off) bad.push(`${at}: total length`);
      const d = [...b.slice(off + 16, off + 20)];
      if (d[0] >= 224 && d[0] <= 239 && dst !== ['01', '00', '5e', hx(d[1] & 0x7f), hx(d[2]), hx(d[3])].join(':')) bad.push(`${at}: MAC multicast`);
      const frag = ((b[off + 6] & 0x3f) << 8) | b[off + 7]; // MF + offset
      const proto = b[off + 9], l4 = b.slice(off + ihl, off + tot), len = l4.length;
      const pseudo = sum16([...b.slice(off + 12, off + 20), 0, proto, len >> 8, len & 255]);
      if (!frag && proto === 1 && !ok16(l4)) bad.push(`${at}: checksum ICMP`);
      if (!frag && proto === 6 && !ok16(l4, pseudo)) bad.push(`${at}: checksum TCP`);
      if (!frag && proto === 17 && ((l4[6] << 8) | l4[7]) && !ok16(l4, pseudo)) bad.push(`${at}: checksum UDP`);
    } else if (et === 0x86dd) {
      if (((b[off + 4] << 8) | b[off + 5]) !== b.length - off - 40) bad.push(`${at}: payload length IPv6`);
      const d = b.slice(off + 24, off + 40);
      if (d[0] === 0xff && dst !== ['33', '33', ...[...d.slice(12)].map(hx)].join(':')) bad.push(`${at}: MAC multicast IPv6`);
    }
  }
  assert.deepEqual(bad, []);
});

test('DNS: resolver hỏi lặp với RD=0, authoritative trả AA=1, client nhận RA=1', () => {
  const p = pk('s10-dns-resolution').map((x) => val(x, 'dns.flags'));
  assert.match(p[0], /^0x0100/); // client → resolver: RD=1
  assert.ok(p.slice(1, 4).every((f) => f.startsWith('0x0000')), 'truy vấn lặp phải RD=0');
  assert.match(p[4], /^0x8400/); // authoritative: QR + AA
  assert.match(p[5], /^0x8180/); // resolver → client: QR + RD + RA
});

test('HSRP: Standby lên Active khi hết hold time gửi Hello (op 0), không phải Coup', () => {
  const last = pk('s13-hsrp-failover').at(-1);
  assert.match(val(last, 'hsrp.op'), /^0/);
  assert.match(val(last, 'hsrp.state'), /Active/);
});

test('EIGRP: số liệu thoả điều kiện khả thi RD < FD của Successor', () => {
  const ev = built['s08-eigrp-dual'].events.find((e) => /Feasible Successor/.test(e.titleVi));
  const [, fd] = ev.explanationVi.match(/= (\d+) \(nhỏ nhất\)/);
  const [, rd] = ev.explanationVi.match(/Reported Distance của R2 = (\d+)/);
  assert.ok(Number(rd) < Number(fd));
});

test('BGP: seq/ack TCP mỗi chiều tăng đúng số byte BGP đã gửi', () => {
  const [o1, o2, ka, up] = pk('s17-bgp-ebgp');
  assert.equal(Number(val(o2, 'tcp.ack')), Number(val(o1, 'tcp.seq')) + 29); // OPEN không option = 29 byte
  assert.equal(Number(val(ka, 'tcp.seq')), Number(val(o1, 'tcp.seq')) + 29);
  assert.equal(Number(val(up, 'tcp.ack')), Number(val(ka, 'tcp.seq')) + 19); // KEEPALIVE = 19 byte
});

test('MPLS/SR/L3VPN: chỉ nhãn đỉnh bị giảm TTL, router tra IP thì giảm TTL IP', () => {
  const sr = pk('s32-sr-mpls').find((p) => all(p, 'mpls.ttl')[0] === '254');
  assert.deepEqual(all(sr, 'mpls.ttl'), ['254', '255']);
  assert.equal(val(pk('s29-mpls').at(-1), 'ip.ttl'), '62');
  const vpn = pk('s34-l3vpn').find((p) => all(p, 'mpls.label').length === 2);
  assert.deepEqual(all(vpn, 'mpls.ttl'), ['255', '255']);
});

test('LDP: bên LSR ID lớn hơn mở TCP tới cổng 646; LISP Map-Reply trả về cổng nguồn của Map-Request', () => {
  const ldp = pk('s34-l3vpn').filter((p) => val(p, 'ldp.label'));
  assert.ok(ldp.every((p) => val(p, 'tcp.dst') === '646'));
  const lisp = pk('s35-lisp');
  const req = lisp.find((p) => /Map-Request/.test(val(p, 'lisp.type') || ''));
  const rep = lisp.find((p) => /Map-Reply/.test(val(p, 'lisp.type') || ''));
  assert.equal(val(rep, 'udp.src'), '4342');
  assert.equal(val(rep, 'udp.dst'), val(req, 'udp.src'));
});
