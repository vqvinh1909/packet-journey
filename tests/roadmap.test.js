// tests/roadmap.test.js — lộ trình CCNA v2.0: không sót, không trùng, tính tiến độ đúng.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { scenarioPorts } from '../ui/topo.js';
import { serialize } from '../packet/serialize.js';
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

test('nhãn cổng kịch bản: đủ hai đầu dây, không trùng cổng trừ mạng chung, khớp tên cổng trong lời giải thích', () => {
  const files = readdirSync(new URL('../scenarios/', import.meta.url));
  for (const s of SCENARIOS) {
    const t = s.build().topology, names = scenarioPorts(t), id = s.meta.id;
    const labels = new Set(Object.values(names).flat());
    assert.equal(Object.keys(names).length, t.links.length, id);
    if (t.ports === false) { assert.ok([...labels].every((x) => x === ''), id); continue; }
    const src = readFileSync(new URL(`../scenarios/${files.find((f) => f.startsWith(id))}`, import.meta.url), 'utf8');
    for (const m of src.match(/\b(?:Gi|Fa)\d+\/\d+\b/g) || []) assert.ok(labels.has(m), `${id}: nói tới ${m} nhưng sơ đồ không có`);
    const seen = new Map();
    t.links.forEach((l) => [[l.a, names[l.id][0]], [l.b, names[l.id][1]]].forEach(([d, p]) => {
      const dev = t.devices.find((x) => x.id === d);
      if (!p || dev.type !== 'switch') return;
      assert.ok(!seen.has(d + p), `${id}: ${dev.name} ${p} trùng`);
      seen.set(d + p, 1);
    }));
  }
});

test('BGP EVPN: UPDATE type 2 đúng khuôn RFC 7432, độ dài khớp, VNI nằm ở 3 byte cuối', () => {
  const { bytes } = serialize([{ proto: 'bgp', fields: { type: 2, evpn: { rd: '10.0.0.1', mac: '00:aa:00:00:00:01', ip: '192.168.50.10', vni: 5000, nextHop: '10.0.0.1', rt: [65000, 5000] } } }]);
  const b = [...bytes];
  assert.equal((b[16] << 8) | b[17], b.length, 'BGP Length');
  assert.equal(b[18], 2);
  assert.equal(((b[21] << 8) | b[22]) + 23, b.length, 'Path Attr Len');
  const at = b.findIndex((x, i) => x === 0x90 && b[i + 1] === 14);
  assert.deepEqual(b.slice(at + 4, at + 7), [0, 25, 70], 'AFI 25, SAFI 70');
  const r = at + 4 + 9;
  assert.equal(b[r], 2, 'route type 2');
  assert.equal(b[r + 1], 37, 'độ dài route');
  assert.deepEqual(b.slice(-3), [0, 0x13, 0x88], 'VNI 5000');
});

test('SR-MPLS: nhãn đỉnh S=0, nhãn đáy S=1, nhãn giữ nguyên qua P1, PHP gỡ dần', () => {
  const stacks = SCENARIOS.find((s) => s.meta.id === 's32-sr-mpls').build().events.filter((e) => e.kind === 'transit').map((e) => e.packet.layers.filter((l) => l.proto === 'mpls').map((l) => [l.fields.label, l.fields.s]));
  assert.deepEqual(stacks, [[], [[16004, 0], [16005, 1]], [[16004, 0], [16005, 1]], [[16005, 1]], [], []]);
});

test('lộ trình: link tới mọi bài, Mini Lab, Lab tổng hợp trong các giáo trình HTML trên máy và không link hỏng', async (t) => {
  const { lessonHref } = await import('../ui/i18n.js');
  const { B } = await import('../lab/kit.js');
  const byFile = {};
  const add = (h) => { const [f, a] = decodeURI(h).split('#'); (byFile[f] ||= new Set()).add(a); };
  for (const tp of topics) {
    for (const n of tp.lessons) add(lessonHref(`${B}x/Bai-${String(n).padStart(2, '0')}_x.md`));
    for (const d of tp.docs || []) add(lessonHref(d.path));
  }
  const files = Object.keys(byFile).filter((f) => f.endsWith('.html') && existsSync(new URL(f, import.meta.url.replace(/tests\/[^/]*$/, ''))));
  if (!files.length) return t.skip('máy này không có giáo trình HTML');
  for (const f of files) {
    const html = readFileSync(new URL(f, import.meta.url.replace(/tests\/[^/]*$/, '')), 'utf8');
    const groups = new Map();
    for (const [, id, g] of html.matchAll(/id="(b\d+-s\d+)" data-group="([^"]*)"/g)) if (!groups.has(g)) groups.set(g, id);
    const linked = byFile[f];
    assert.deepEqual([...linked].filter((a) => a && !html.includes(`id="${a}"`)), [], `${f}: link hỏng`);
    if (![...linked].some(Boolean)) continue; // link cả file (thư viện giáo trình): không đòi từng bài
    assert.deepEqual([...groups].filter(([, id]) => !linked.has(id)).map(([g]) => g), [], `${f}: bài chưa có trong lộ trình`);
  }
});

test('lộ trình: lab dùng chung (shared) phải là lab có thật và đã có chỗ chính ở chặng khác', () => {
  const placed = new Set(topics.flatMap((t) => [...t.core, ...t.more]));
  for (const t of topics) for (const id of t.shared || []) assert.ok(placed.has(id) && LABS.some((l) => l.id === id), `${t.ref}: ${id}`);
});
