// tests/quiz.test.js — quiz kịch bản: câu viết tay hợp lệ, câu sinh có đáp án đúng, mỗi lượt 40 câu và ít trùng lượt trước.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUIZZES, QUIZ_LEN, buildQuiz } from '../scenarios/quizzes.js';
import { QGEN, SC_GENS, DSCP } from '../scenarios/quiz-gen.js';

const seeded = (s) => () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);

test('câu viết tay: 4 đáp án khác nhau, chỉ số đáp án đúng hợp lệ', () => {
  for (const [id, qs] of Object.entries(QUIZZES)) for (const q of qs) {
    assert.equal(new Set(q.options).size, 4, `${id}: ${q.q}`);
    assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4, `${id}: ${q.q}`);
  }
});

test('câu sinh: đáp án tính lại độc lập khớp với đáp án đúng', () => {
  const r = seeded(7);
  const ok = (name, check) => { let n = 0; for (let i = 0; i < 400; i++) { const q = QGEN[name](r); if (!q) continue; n++; assert.equal(new Set(q.options).size, 4, q.q); assert.ok(check(q, q.options[q.correct]), `${name}: ${q.q} → ${q.options[q.correct]}`); } assert.ok(n > 100, name); };
  ok('tcpAck', (q, a) => { const [, s, l] = q.q.match(/Seq = (\d+), mang (\d+)/); return +a === +s + +l; });
  ok('srLabel', (q, a) => { const [, b, i] = q.q.match(/từ (\d+), Prefix-SID index (\d+)/); return +a === +b + +i; });
  ok('natPat', (q, a) => { const [, h, c] = q.q.match(/^(\d+) máy nội bộ, mỗi máy mở (\d+)/); return +a === h * c; });
  ok('hsrpMac', (q, a) => a === `0000.0c07.ac${Number(q.q.match(/nhóm (\d+)/)[1]).toString(16).padStart(2, '0')}`);
  ok('mcastMac', (q, a) => { const o = q.q.match(/multicast (\d+)\.(\d+)\.(\d+)\.(\d+)/).slice(1).map(Number); return a === ['01', '00', '5e', (o[1] & 127), o[2], o[3]].map((x) => (typeof x === 'string' ? x : x.toString(16).padStart(2, '0'))).join(':'); });
  ok('solicited', (q, a) => { const p = q.q.match(/::([0-9a-f]+):([0-9a-f]+) là/); const b = parseInt(p[1], 16), c = parseInt(p[2], 16); return a === `ff02::1:ff${(b & 255).toString(16).padStart(2, '0')}:${c.toString(16)}`; });
  ok('frag', (q, a) => { const [, d, m] = q.q.match(/mang (\d+) byte dữ liệu.*MTU (\d+)/).map(Number); const per = Math.floor((m - 20) / 8) * 8; return /mấy mảnh/.test(q.q) ? +a === Math.ceil(d / per) : +a === per / 8; });
  ok('dscp', (q, a) => (/thập phân/.test(q.q) ? +a === DSCP[q.q.match(/DSCP (\w+) có/)[1]] : DSCP[a] === +q.q.match(/DSCP (\d+)/)[1]));
  ok('stpRoot', (q, a) => { const sw = [...q.q.matchAll(/(SW\d) priority (\d+) MAC ([0-9a-f.]+)/g)].map((m) => ({ n: m[1], p: +m[2], mac: m[3] })); sw.sort((x, y) => x.p - y.p || (x.mac < y.mac ? -1 : 1)); return a === sw[0].n; });
  ok('eigrpFs', (q, a) => { const nb = [...q.q.matchAll(/qua (R\d) FD (\d+) \(RD (\d+)\)/g)].map((m) => ({ n: m[1], fd: +m[2], rd: +m[3] })); const s = nb.reduce((x, y) => (y.fd < x.fd ? y : x)); const fs = nb.filter((x) => x !== s && x.rd < s.fd); return a === (fs[0]?.n || 'Không có feasible successor'); });
  ok('dnsTtl', (q, a) => { const [, t, x] = q.q.match(/TTL (\d+) giây\. (\d+) giây/).map(Number); return x < t ? a === `Trả từ cache, TTL còn ${t - x} giây` : /hết hạn/.test(a); });
  for (const gs of Object.values(SC_GENS)) for (const g of gs) assert.ok(QGEN[g], g);
});

test('mỗi lượt đủ 40 câu không trùng, giữ đúng đáp án sau khi trộn, có đủ câu của kịch bản', () => {
  for (const id of Object.keys(QUIZZES)) {
    const qs = buildQuiz(id, seeded(id.length * 31 + 1));
    assert.equal(qs.length, QUIZ_LEN, id);
    assert.equal(new Set(qs.map((q) => q.q)).size, QUIZ_LEN, id);
    for (const q of QUIZZES[id]) {
      const got = qs.find((x) => x.q === q.q);
      assert.ok(got, `${id} thiếu câu của chính kịch bản: ${q.q}`);
      assert.equal(got.options[got.correct], q.options[q.correct], q.q);
    }
  }
});

test('lượt sau ưu tiên câu chưa gặp ở lượt trước', () => {
  for (const id of ['s01-ping-same-subnet', 's07-ospf-adjacency', 's11-nat-pat', 's35-lisp']) {
    const r = seeded(99), a = buildQuiz(id, r), seen = new Set(a.map((q) => q.q));
    const again = buildQuiz(id, r, QUIZ_LEN, seen).filter((q) => q.from && seen.has(q.q));
    assert.ok(again.length <= 10, `${id}: ${again.length} câu trùng`);
  }
});

test('mọi kịch bản có ít nhất một câu Đoán bước, gắn vào bước có thật', async () => {
  const { GUESS } = await import('../scenarios/guess.js');
  const { SCENARIOS } = await import('../scenarios/index.js');
  for (const s of SCENARIOS) {
    const ev = s.build().events;
    const g = GUESS[s.meta.id] || {};
    for (const [i, d] of Object.entries(g)) {
      assert.ok(ev[i], `${s.meta.id}: không có bước ${i}`);
      assert.equal(d.options.length, 4, s.meta.id);
      assert.ok(Number.isInteger(d.correct) && d.options[d.correct], s.meta.id);
    }
    assert.ok(ev.some((e) => e.decision) || Object.keys(g).length, `${s.meta.id}: chưa có câu đoán`);
  }
});
