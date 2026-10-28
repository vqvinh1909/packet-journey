// tests/exam.test.js — 🎓 thi thử CCNA (lab/ccna-exam.js): ngân hàng đúng tỉ lệ 6 mảng, xáo phương án vẫn giữ đáp án,
// đề rút gọn, chấm thang 1000, câu lab mô phỏng chấm được bằng checkLab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../lab/ccna-exam.js';
import { BANK_EN } from '../lab/ccna-exam-en.js';
import { GENS, genQuestions } from '../lab/ccna-gen.js';
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
  assert.equal(ex.qs.filter((q) => !q.gen && q.kind !== 'sim').length, 100, '100 câu ngân hàng');
  assert.equal(ex.qs.filter((q) => q.gen).length, 12, '12 câu sinh tự động');
  assert.equal(ex.qs.filter((q) => q.kind === 'sim').length, 4);
  for (const q of ex.qs) {
    if (q.kind === 'sim' || q.gen) continue;
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
  const mcq = ex.qs.filter((q) => q.kind !== 'sim' && !q.gen);
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

test('bản tiếng Anh khớp bản tiếng Việt: cùng số câu, số phương án, số cặp ghép; đề mang cả hai ngôn ngữ cùng thứ tự', () => {
  assert.equal(BANK_EN.length, E.BANK.length);
  E.BANK.forEach(([, text, opts], k) => {
    const [t, o, ex] = BANK_EN[k];
    assert.ok(t && ex, 'thiếu bản dịch câu ' + (k + 1));
    if (opts.pairs) { assert.equal(o.pairs.length, opts.pairs.length, text); assert.equal(o.pairs[0][0], opts.pairs[0][0].replace(/Inside local/, 'Inside local'), 'cột trái giữ thuật ngữ: ' + text); }
    else { assert.equal(o.length, opts.length, text); assert.equal(Array.isArray(E.BANK[k][3]), /Choose \d/.test(t), 'câu nhiều đáp án phải ghi "Choose N": ' + t); }
  });
  for (const q of E.makeExam(5, 'full').qs) {
    if (q.gen) continue;
    if (q.kind === 'one') assert.equal(q.optionsEn[q.answer], BANK_EN[q.i][1][E.BANK[q.i][3]]);
    if (q.kind === 'match') q.left.forEach((l, j) => assert.equal(q.rightEn[q.rightAns[j]], BANK_EN[q.i][1].pairs[j][1]));
  }
});

// ---- câu sinh tự động: tính lại đáp án theo cách ĐỘC LẬP (chuỗi bit) và kiểm chỉ đúng 1 phương án đúng
const bits = (ip) => ip.split('.').map((x) => (+x).toString(2).padStart(8, '0')).join('');
const fromBits = (b) => [0, 8, 16, 24].map((i) => parseInt(b.slice(i, i + 8), 2)).join('.');
const seeded = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0) / 4294967296); };
const num = (re, t, i = 1) => t.match(re)[i];
const CHECK = {
  broadcast: (q) => { const [, ip, p] = q.textEn.match(/containing ([\d.]+)\/(\d+)/); const b = bits(ip).slice(0, +p) + '1'.repeat(32 - p); return (o) => o === fromBits(b); },
  hosts: (q) => { const p = +num(/a \/(\d+) subnet/, q.textEn); return (o) => +o === 2 ** (32 - p) - 2; },
  validHost: (q) => { const [, ip, p] = q.textEn.match(/subnet ([\d.]+)\/(\d+)/); const pre = bits(ip).slice(0, +p); return (o) => { const b = bits(o); return b.startsWith(pre) && !/^0+$/.test(b.slice(+p)) && !/^1+$/.test(b.slice(+p)); }; },
  wildcard: (q) => { const p = +num(/a \/(\d+) prefix/, q.textEn); return (o) => o === fromBits('0'.repeat(p) + '1'.repeat(32 - p)); },
  summary: (q) => { const [, a, b] = q.textEn.match(/networks ([\d.]+)\/24 through ([\d.]+)\/24/); let k = 0; while (bits(a).slice(0, 24 - k) !== bits(b).slice(0, 24 - k)) k++; return (o) => o === `${fromBits(bits(a).slice(0, 24 - k) + '0'.repeat(8 + k))}/${24 - k}`; },
  lpm: (q) => { const dst = num(/packet to ([\d.]+) use/, q.textEn); const rows = [...q.textEn.matchAll(/([\d.]+)\/(\d+) → (R-\w)/g)].map((m) => ({ net: m[1], p: +m[2], s: `${m[1]}/${m[2]} → ${m[3]}` })); const best = rows.filter((x) => bits(dst).slice(0, x.p) === bits(x.net).slice(0, x.p)).sort((x, y) => y.p - x.p)[0]; return (o) => o === best.s; },
  ad: (q) => { const AD = { Static: 1, eBGP: 20, EIGRP: 90, OSPF: 110, RIP: 120 }; const [, x, y] = q.textEn.match(/from both (\w+) and (\w+)/); const w = AD[x] < AD[y] ? x : y; return (o) => o === `${w} (AD ${AD[w]})`; },
  acl: (q) => { const [, deny, n3] = q.textEn.match(/deny host ([\d.]+) ; access-list 10 permit 192\.168\.(\d+)\.0/); const src = num(/source ([\d.]+)/, q.textEn); const want = src === deny ? 'Denied by line 1' : src.startsWith(`192.168.${n3}.`) ? 'Permitted by line 2' : 'Denied by the implicit deny'; return (o) => o.startsWith(want); },
  dhcp: (q) => { const p = +num(/\/(\d+)" with/, q.textEn); const x = +num(/excluded-address [\d.]+ 192\.168\.\d+\.(\d+)/, q.textEn); return (o) => +o === 2 ** (32 - p) - 2 - x; },
};
test('câu sinh tự động: mỗi dạng × 400 seed — đáp án đúng tính lại độc lập, đúng 1 phương án đúng, 4 phương án khác nhau, có song ngữ', () => {
  for (const [name, gen] of Object.entries(GENS)) {
    let made = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const g = gen(seeded(seed));
      if (!g) continue;
      made++;
      assert.equal(new Set(g.opts).size, g.opts.length, `${name}#${seed}: phương án trùng`);
      assert.ok(g.opts.length >= 4 && g.text && g.textEn && g.explain && g.explainEn, `${name}#${seed}`);
      const ok = CHECK[name](g);
      const enOpts = g.optsEn || g.opts;
      const right = enOpts.map((o, k) => (ok(o) ? k : -1)).filter((k) => k >= 0);
      assert.deepEqual(right, [g.ans], `${name}#${seed}: ${g.textEn} | ${enOpts.join(' | ')}`);
    }
    assert.ok(made >= 380, `${name}: tạo được ${made}/400`);
  }
});
test('đề có câu sinh tự động khác nhau giữa các seed, giống nhau khi cùng seed (làm tiếp / chấm lại đúng)', () => {
  const t = (seed) => E.makeExam(seed, 'full').qs.filter((q) => q.gen).map((q) => q.text);
  assert.deepEqual(t(9), t(9));
  assert.notDeepEqual(t(9), t(10));
  assert.equal(E.makeExam(3, 'quick').qs.filter((q) => q.gen).length, 4);
  for (const q of E.makeExam(77, 'full').qs.filter((x) => x.gen)) assert.equal(q.optionsEn.length, q.options.length);
});
