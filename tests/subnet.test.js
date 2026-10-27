// tests/subnet.test.js — "🧮 Luyện subnet vô hạn" (lab/subnet.js): sinh đề tất định, đáp án đúng toán,
// chấm chấp nhận nhiều cách gõ, VLSM chấm linh hoạt (prefix tối thiểu, không chồng lấn, trong khối), thống kê.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../lab/subnet.js';

const many = (kind, level, n = 300, seed = 1) => { const r = S.rng(seed); return Array.from({ length: n }, () => S.generate(kind, level, r)); };

test('tiện ích: mask/prefix/wildcard, số host, prefix cho N host', () => {
  assert.equal(S.prefixToMask(26), '255.255.255.192');
  assert.equal(S.wildcard(22), '0.0.3.255');
  assert.equal(S.maskToPrefix('255.255.240.0'), 20);
  assert.equal(S.maskToPrefix('0.0.0.0'), 0);
  assert.equal(S.maskToPrefix('255.0.255.0'), null);
  assert.equal(S.usable(30), 2);
  assert.equal(S.prefixForHosts(2), 30);
  assert.equal(S.prefixForHosts(62), 26);
  assert.equal(S.prefixForHosts(63), 25);
  assert.equal(S.prefixForHosts(500), 23);
});

test('sinh đề tất định theo seed, đủ mọi dạng, mix chọn dạng hợp lệ', () => {
  const a = many('mix', 2, 50, 42), b = many('mix', 2, 50, 42);
  assert.deepEqual(a.map((q) => q.text), b.map((q) => q.text));
  const kinds = new Set(many('mix', 1, 200).map((q) => q.kind));
  for (const k of Object.keys(S.KINDS)) assert.ok(kinds.has(k), k);
});

test('đáp án mẫu luôn chấm đúng ở mọi dạng và độ khó', () => {
  for (const k of Object.keys(S.KINDS)) for (const lv of [1, 2, 3]) for (const q of many(k, lv, 150, lv * 7)) {
    const g = S.grade(q, q.ans);
    assert.ok(g.ok, `${k}/${lv}: ${q.text} ${JSON.stringify(q.ans)} ${g.note}`);
    assert.ok(S.explain(q).length >= 3, 'có lời giải từng bước');
  }
});

test('dạng info: đáp án đúng toán (network & broadcast cùng khối, số host)', () => {
  for (const q of many('info', 3)) {
    const { ip, p } = q.data;
    const size = 2 ** (32 - p);
    assert.equal(S.ip2n(q.ans.broadcast) - S.ip2n(q.ans.network) + 1, size);
    assert.equal(S.netN(ip, p), S.ip2n(q.ans.network));
    assert.equal(+q.ans.hosts, size - 2);
  }
});

test('chấm chấp nhận nhiều cách gõ và bắt lỗi từng ô', () => {
  const q = { kind: 'info', fields: [['network'], ['broadcast'], ['first'], ['last'], ['hosts']], ans: { network: '10.1.1.64', broadcast: '10.1.1.127', first: '10.1.1.65', last: '10.1.1.126', hosts: '62' } };
  const g = S.grade(q, { network: ' 10.1.1.64 ', broadcast: '10.1.1.127', first: '10.1.1.65', last: '10.1.1.125', hosts: '62' });
  assert.equal(g.ok, false);
  assert.deepEqual(g.fields, { network: true, broadcast: true, first: true, last: false, hosts: true });
  const c = { kind: 'convert', fields: [['prefix'], ['wildcard']], ans: { prefix: '/27', wildcard: '0.0.0.31' } };
  assert.ok(S.grade(c, { prefix: '27', wildcard: '0.0.0.31' }).ok);
  assert.ok(S.grade(c, { prefix: '/ 27', wildcard: '0.0.0.31' }).ok);
  assert.ok(!S.grade(c, { prefix: '/28', wildcard: '0.0.0.31' }).ok);
  const s = { kind: 'same', fields: [['same']], ans: { same: 'không' } };
  for (const v of ['không', 'khong', 'K', 'no']) assert.ok(S.grade(s, { same: v }).ok, v);
  assert.ok(!S.grade(s, { same: 'có' }).ok);
  const h = { kind: 'hosts', fields: [['prefix']], ans: { prefix: '/23' } };
  assert.ok(S.grade(h, { prefix: '23' }).ok);
  const big = { kind: 'info', fields: [['hosts']], ans: { hosts: '1022' } };
  assert.ok(S.grade(big, { hosts: '1.022' }).ok, 'chấp nhận dấu chấm ngăn nghìn');
});

test('dạng same: cả hai đáp án có/không đều xuất hiện và khớp phép AND', () => {
  const qs = many('same', 2, 200);
  const seen = new Set(qs.map((q) => q.ans.same));
  assert.deepEqual([...seen].sort(), ['có', 'không']);
  for (const q of qs) assert.equal(q.ans.same === 'có', S.netN(q.data.a, q.data.p) === S.netN(q.data.b, q.data.p));
});

test('dạng summary: summary chứa đúng các mạng, prefix khớp số mạng', () => {
  for (const q of many('summary', 3)) {
    const [net, sp] = q.ans.summary.split('/');
    for (const n of q.data.nets) assert.equal(S.netN(n.split('/')[0], +sp), S.ip2n(net));
    assert.equal(2 ** (q.data.p - +sp), q.data.nets.length);
  }
});

test('VLSM chấm linh hoạt: phương án khác vẫn đúng; sai prefix / chồng lấn / ngoài khối / lệch biên bị bắt', () => {
  const needs = [{ name: 'A', hosts: 50 }, { name: 'B', hosts: 20 }, { name: 'WAN', hosts: 2 }];
  const q = { kind: 'vlsm', data: { block: '192.168.10.0', bp: 24, needs }, fields: needs.map((x, i) => ['s' + i, x.name]) };
  // phương án mẫu: A .0/26, B .64/27, WAN .96/30
  assert.ok(S.grade(q, { s0: '192.168.10.0/26', s1: '192.168.10.64/27', s2: '192.168.10.96/30' }).ok);
  // phương án khác vẫn đúng: đặt ngược từ cuối khối
  assert.ok(S.grade(q, { s0: '192.168.10.192/26', s1: '192.168.10.160/27', s2: '192.168.10.156/30' }).ok);
  let g = S.grade(q, { s0: '192.168.10.0/25', s1: '192.168.10.128/27', s2: '192.168.10.160/30' });
  assert.equal(g.fields.s0, false); assert.match(g.note, /cần \/26/);
  g = S.grade(q, { s0: '192.168.10.0/26', s1: '192.168.10.32/27', s2: '192.168.10.96/30' });
  assert.equal(g.fields.s0, false); assert.equal(g.fields.s1, false); assert.match(g.note, /chồng lấn/);
  g = S.grade(q, { s0: '192.168.11.0/26', s1: '192.168.10.64/27', s2: '192.168.10.96/30' });
  assert.equal(g.fields.s0, false, 'ngoài khối');
  g = S.grade(q, { s0: '192.168.10.0/26', s1: '192.168.10.80/27', s2: '192.168.10.96/30' });
  assert.equal(g.fields.s1, false, 'network không chia hết kích thước subnet');
  // đề sinh ra: phương án mẫu luôn nằm gọn trong khối
  for (const v of many('vlsm', 3, 100)) {
    const end = S.ip2n(v.data.block) + 2 ** (32 - v.data.bp);
    for (const x of S.vlsmPlan(v.data.block, v.data.bp, v.data.needs)) assert.ok(S.ip2n(x.net) + 2 ** (32 - x.p) <= end);
  }
});

test('độ khó: mức 1 chỉ prefix /24–/30, mức 3 có prefix ngắn hơn', () => {
  assert.ok(many('info', 1).every((q) => q.data.p >= 24));
  assert.ok(many('info', 3).some((q) => q.data.p < 16));
});

test('thống kê theo dạng: tỉ lệ đúng và thời gian trung bình; bộ 10 câu tính giờ', () => {
  let st = {};
  st = S.addStat(st, 'info', true, 20);
  st = S.addStat(st, 'info', false, 40);
  st = S.addStat(st, 'vlsm', true, 90);
  const rows = S.statRows(st);
  const info = rows.find((r) => r.kind === 'info');
  assert.equal(info.n, 2); assert.equal(info.rate, 0.5); assert.equal(info.avg, 30);
  assert.equal(rows.find((r) => r.kind === 'summary').rate, null);
  const run = S.makeRun(2, 99);
  assert.equal(run.length, 10);
  assert.equal(new Set(run.map((q) => q.kind)).size, Object.keys(S.KINDS).length);
  assert.deepEqual(S.makeRun(2, 99).map((q) => q.text), run.map((q) => q.text));
});
