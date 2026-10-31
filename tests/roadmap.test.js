// tests/roadmap.test.js — lộ trình CCNA v2.0: không sót, không trùng, tính tiến độ đúng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROADMAP, roadmapProgress, topicProgress } from '../lab/roadmap.js';
import { LABS } from '../lab/labs.js';
import { SCENARIOS } from '../scenarios/index.js';
import { QUIZZES } from '../scenarios/quizzes.js';

const topics = ROADMAP.flatMap((s) => s.topics);
const blank = () => ({ read: {}, labsDone: {}, quizBest: {}, quizSize: Object.fromEntries(SCENARIOS.map((s) => [s.meta.id.slice(0, 3), QUIZZES[s.meta.id]?.length || 0])) });

test('lộ trình: mọi lab và kịch bản có đúng một chỗ, không có mã lạ', () => {
  const labs = topics.flatMap((t) => [...t.core, ...t.more]);
  assert.deepEqual(labs.filter((id, i) => labs.indexOf(id) !== i), [], 'lab xuất hiện 2 lần');
  assert.deepEqual(LABS.map((l) => l.id).filter((id) => !labs.includes(id)), [], 'lab chưa có trong lộ trình');
  assert.deepEqual(labs.filter((id) => !LABS.some((l) => l.id === id)), [], 'lab không tồn tại');
  const scs = topics.flatMap((t) => t.sc), all = SCENARIOS.map((s) => s.meta.id.slice(0, 3));
  assert.deepEqual(all.filter((id) => !scs.includes(id)), [], 'kịch bản chưa có trong lộ trình');
  assert.deepEqual(scs.filter((id) => !all.includes(id)), [], 'kịch bản không tồn tại');
  assert.deepEqual(scs.filter((id, i) => scs.indexOf(id) !== i), [], 'kịch bản xuất hiện 2 lần');
});

test('lộ trình: 5 mảng đề thi cộng đủ 100%, chủ đề không thực hành phải ghi rõ', () => {
  assert.equal(ROADMAP.reduce((a, s) => a + s.weight, 0), 100);
  for (const s of ROADMAP.filter((x) => !x.optional)) for (const t of s.topics) {
    if (!t.core.length && !t.more.length) assert.ok(t.gap || t.sc.length, `${t.ref} không có lab mà không ghi gap`);
  }
});

test('tiến độ: chỉ tính việc bắt buộc; quiz cần 60%; học tiếp chỉ đúng chủ đề chưa xong', () => {
  const st = blank(), first = ROADMAP[0].topics[0], [s1, s2] = first.sc;
  assert.equal(roadmapProgress(st).next.topic, first);
  assert.equal(roadmapProgress(st).pct, 0);
  st.read[`${first.ref}:${first.title}`] = true;
  st.labsDone.A25 = true; // lab thêm không tính
  assert.equal(topicProgress(first, st).done, 1);
  st.quizSize[s1] = 5; st.quizBest[s1] = 2;
  assert.equal(topicProgress(first, st).done, 1, '2/5 chưa đạt 60%');
  st.quizBest[s1] = 3;
  st.quizBest[s2] = st.quizSize[s2];
  st.labsDone.A01 = true;
  assert.ok(topicProgress(first, st).complete);
  assert.equal(roadmapProgress(st).next.topic, ROADMAP[0].topics[1]);
  for (const s of ROADMAP) for (const t of s.topics) {
    st.read[`${t.ref}:${t.title}`] = true;
    for (const id of t.core) st.labsDone[id] = true;
    for (const id of t.sc) st.quizBest[id] = st.quizSize[id];
  }
  const done = roadmapProgress(st);
  assert.equal(done.next, null);
  assert.equal(done.pct, 100);
});
