// tests/library-quiz.test.js — bài tập Wireshark và quiz của chặng thư viện giáo trình.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libQuiz, libCount, packetList, LIB_QUIZ_REFS } from '../lab/library-quiz.js';
import { ROADMAP } from '../lab/roadmap.js';

const seeded = (s) => () => ((s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0) / 4294967296);

test('thư viện: mọi chủ đề có quiz, câu nào cũng có đáp án hợp lệ và lựa chọn không trùng', () => {
  const lib = ROADMAP.find((s) => s.id === 'library').topics;
  assert.deepEqual(lib.map((t) => t.quiz), LIB_QUIZ_REFS);
  for (const ref of LIB_QUIZ_REFS) for (const seed of [1, 2, 3]) {
    const qs = libQuiz(ref, seeded(seed));
    assert.equal(qs.length, 15, ref);
    assert.equal(new Set(qs.map((q) => q.q)).size, 15, `${ref}: câu trùng trong một lượt`);
    for (const q of qs) {
      assert.ok(q.options.length >= 3 && new Set(q.options).size === q.options.length, `${ref}: ${q.q}`);
      assert.ok(q.correct >= 0 && q.correct < q.options.length && q.explainVi, `${ref}: ${q.q}`);
    }
  }
  assert.equal(libQuiz('không có'), null);
});

test('Wireshark: danh sách gói đúng kiểu, câu chọn gói trỏ đúng dòng', () => {
  const arp = packetList('s41');
  assert.deepEqual(arp.map((r) => r.proto), ['ARP', 'ARP', 'ICMP', 'ICMP']);
  assert.equal(arp[0].info, '192.168.1.1 is at 00:de:ad:00:00:66');
  assert.match(packetList('s46')[0].info, /VLAN 1, VLAN 20/);
  assert.deepEqual(packetList('s47').map((r) => r.info).slice(0, 3), ['Client Hello', 'Server Hello', 'Application Data']);
  assert.match(packetList('s44').find((r) => /SYN, ACK/.test(r.info)).info, /443 → 40001 \[SYN, ACK\] Seq=5000 Ack=9001/);
  const qs = libQuiz('Wireshark', seeded(5), 99);
  const pick = (re) => { const q = qs.find((x) => re.test(x.q)); return q.table.rows[Number(q.options[q.correct].slice(4)) - 1]; };
  assert.equal(pick(/hai nhãn 802\.1Q/)[0], 1);
  assert.equal(pick(/vào tên miền nào/)[4], 'Client Hello');
  assert.equal(pick(/OFFER của DHCP server giả/)[1], '192.168.1.66');
  assert.equal(pick(/đã được mã hoá trong đường hầm/)[3], 'ESP');
  assert.equal(pick(/được chấp nhận và vào VLAN/)[4], 'Access-Accept');
});

test('thư viện: ngân hàng đủ lớn, lượt sau ra câu chưa gặp, câu sinh số liệu luôn có đáp án đúng duy nhất', () => {
  for (const ref of LIB_QUIZ_REFS) {
    assert.ok(libCount(ref) >= (ref === 'Wireshark' ? 22 : 30), `${ref}: ${libCount(ref)} câu`);
    const first = libQuiz(ref, seeded(1)), second = libQuiz(ref, seeded(2), 15, new Set(first.map((q) => q.q)));
    const again = second.filter((q) => first.some((f) => f.q === q.q)).length;
    assert.ok(again <= (ref === 'Wireshark' ? 8 : 0), `${ref}: lượt hai lặp ${again} câu`);
  }
  // 300 lượt mỗi mảng: mọi câu (kể cả câu sinh) có 3–4 lựa chọn khác nhau và đáp án nằm trong đó
  for (const ref of LIB_QUIZ_REFS.slice(1)) for (let s = 1; s <= 300; s++) for (const q of libQuiz(ref, seeded(s))) {
    assert.ok(q.options.length >= 3 && new Set(q.options).size === q.options.length, `${ref} seed ${s}: ${q.q} → ${q.options}`);
    assert.ok(!q.options.some((o) => /NaN|undefined/.test(o)) && q.correct >= 0, `${ref} seed ${s}: ${q.q}`);
  }
});

test('thư viện: không có câu hỏi trùng nhau trong ngân hàng, mỗi câu đủ 4 lựa chọn khác nhau', async () => {
  const { MORE } = await import('../lab/library-bank.js'), { MORE2 } = await import('../lab/library-bank2.js');
  for (const ref of Object.keys(MORE)) {
    const all = [...MORE[ref], ...MORE2[ref]];
    assert.equal(new Set(all.map((q) => q[0])).size, all.length, `${ref}: có câu trùng`);
    for (const [q, o, ex] of all) assert.ok(o.length === 4 && new Set(o).size === 4 && ex, `${ref}: ${q}`);
    assert.ok(libCount(ref) >= 50, `${ref}: ${libCount(ref)} câu`);
  }
});
