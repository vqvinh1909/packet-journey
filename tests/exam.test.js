// tests/exam.test.js — 🎓 thi thử CCNA (lab/ccna-exam.js): ngân hàng đúng tỉ lệ 6 mảng, xáo phương án vẫn giữ đáp án,
// đề rút gọn, chấm thang 1000, câu lab mô phỏng chấm được bằng checkLab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../lab/ccna-exam.js';
import { getLab, buildLab, applySolution, checkLab } from '../lab/labs.js';
import { createCli } from '../lab/ios.js';

test('ngân hàng: 100 câu chia đúng tỉ lệ đề 200-301, đáp án hợp lệ, không trùng đề', () => {
  assert.equal(E.BANK.length, 100);
  for (const d of E.DOMAINS) assert.equal(E.BANK.filter((q) => q[0] === d.id).length, d.w, d.id);
  assert.equal(E.DOMAINS.reduce((s, d) => s + d.w, 0), 100);
  for (const [dom, text, opts, ans, ex] of E.BANK) {
    assert.ok(E.DOMAINS.some((d) => d.id === dom), text);
    assert.ok(ex && ex.length > 10, 'có giải thích: ' + text);
    if (opts.pairs) { assert.equal(ans, null); assert.ok(opts.pairs.length >= 3); continue; }
    assert.ok(opts.length >= 3 && new Set(opts).size === opts.length, text);
    for (const a of [].concat(ans)) assert.ok(Number.isInteger(a) && a >= 0 && a < opts.length, text);
    if (Array.isArray(ans)) assert.match(text, /Chọn \d/, 'câu nhiều đáp án phải ghi rõ số đáp án: ' + text);
  }
  assert.equal(new Set(E.BANK.map((q) => q[1])).size, 100);
});

test('đề đầy đủ: xáo câu + phương án nhưng đáp án vẫn trỏ đúng nội dung; cùng seed ra cùng đề', () => {
  const ex = E.makeExam(42, 'full');
  assert.equal(ex.minutes, 120);
  assert.equal(ex.qs.length, 104);
  assert.equal(ex.qs.filter((q) => q.kind === 'sim').length, 4);
  for (const q of ex.qs) {
    if (q.kind === 'sim') continue;
    const [, , opts, ans] = E.BANK[q.i];
    if (q.kind === 'match') { q.left.forEach((l, k) => assert.equal(q.right[q.rightAns[k]], opts.pairs.find((p) => p[0] === l)[1])); continue; }
    if (q.kind === 'one') assert.equal(q.options[q.answer], opts[ans]);
    else assert.deepEqual(q.answer.map((k) => q.options[k]).sort(), ans.map((k) => opts[k]).sort());
  }
  assert.deepEqual(E.makeExam(42, 'full'), ex);
  assert.notDeepEqual(E.makeExam(43, 'full').qs.map((q) => q.i), ex.qs.map((q) => q.i));
});

test('đề rút gọn 30 câu giữ tỉ lệ mảng + 1 câu lab, 40 phút', () => {
  const ex = E.makeExam(7, 'quick');
  assert.equal(ex.minutes, 40);
  const mcq = ex.qs.filter((q) => q.kind !== 'sim');
  assert.equal(mcq.length, 30);
  assert.equal(mcq.filter((q) => q.domain === 'ipc').length, 8);
  assert.equal(ex.qs.filter((q) => q.kind === 'sim').length, 1);
});

test('chấm điểm: đúng hết = 1000 đạt, bỏ trống = 300, ghép cặp tính theo tỉ lệ, báo điểm từng mảng', () => {
  const ex = E.makeExam(1, 'full');
  const perfect = ex.qs.map((q) => (q.kind === 'one' || q.kind === 'multi' ? q.answer : q.kind === 'match' ? q.rightAns : 1));
  let g = E.gradeExam(ex, perfect);
  assert.equal(g.score, 1000);
  assert.ok(g.pass);
  assert.deepEqual(g.wrong, []);
  g = E.gradeExam(ex, []);
  assert.equal(g.score, 300);
  assert.ok(!g.pass);
  assert.equal(g.wrong.length, ex.qs.length);
  const m = ex.qs.find((q) => q.kind === 'match');
  const half = [...m.rightAns];
  [half[0], half[1]] = [half[1], half[0]];
  assert.equal(E.scoreQ(m, half), (m.rightAns.length - 2) / m.rightAns.length);
  const mu = ex.qs.find((q) => q.kind === 'multi');
  assert.equal(E.scoreQ(mu, [mu.answer[0]]), 0, 'chọn thiếu đáp án = 0 điểm');
  assert.equal(E.scoreQ(mu, [...mu.answer].reverse()), 1, 'thứ tự chọn không quan trọng');
  g = E.gradeExam(ex, perfect.map((a, k) => (ex.qs[k].domain === 'sec' ? null : a)));
  assert.equal(g.domains.find((d) => d.id === 'sec').pct, 0);
  assert.equal(g.domains.find((d) => d.id === 'nf').pct, 1);
  assert.ok(g.score < 1000 && g.score > 825);
});

test('câu lab mô phỏng: lab tồn tại, nhiệm vụ cấu hình trượt khi chưa làm và đạt hết sau lời giải', () => {
  for (const s of E.SIMS) {
    const lab = getLab(s.lab);
    assert.ok(lab, s.lab);
    const real = lab.tasks.map((t, i) => [t, i]).filter(([t]) => !t.quiz).map(([, i]) => i);
    assert.ok(real.length >= 2, s.lab);
    const net = buildLab(lab);
    assert.ok(real.some((i) => !checkLab(lab, net)[i]), 'chưa làm thì trượt: ' + s.lab);
    applySolution(lab, net, createCli(net));
    const r = checkLab(lab, net);
    assert.ok(real.every((i) => r[i]), 'lời giải đạt: ' + s.lab);
  }
});
