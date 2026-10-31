// tests/breaker.test.js — "🎲 Phá mạng ngẫu nhiên" (lab/breaker.js): gài lỗi thật sự làm hỏng nhiệm vụ,
// lệnh sửa đưa mọi nhiệm vụ đạt lại, tất định theo seed, đủ loại lỗi, lab giả "RB:…", điểm & lịch sử.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lab/net.js';
import { LABS, checkLab, solutionOf } from '../lab/labs.js';
import * as B from '../lab/breaker.js';

const fails = (tasks, net) => checkLab({ tasks }, net, {}).filter((x) => !x).length;
// lab chỉ chấm cấu hình (description/CDP, priority STP) file đã chép xong (SCP/SFTP), kết quả playbook, số đo RF — không loại lỗi nào trong thư viện làm hỏng được
const UNBREAKABLE = ['A07', 'A12', 'N18', 'N22', 'W05', 'E03', 'E04', 'E05', 'E08', 'E10', 'E11'];

test('mọi lab có lời giải: gài lỗi → ≥ 1 nhiệm vụ trượt; áp lệnh sửa → mọi nhiệm vụ đạt', () => {
  let n = 0;
  for (const lab of LABS.filter((l) => solutionOf(l).length)) {
    for (const k of [1, 3]) {
      const br = B.makeBreak(lab, k, 2026 + k);
      if (!br) { assert.ok(UNBREAKABLE.includes(lab.id), `${lab.id} không gài được lỗi`); continue; }
      assert.ok(br.n >= 1 && br.n <= k);
      assert.ok(fails(br.tasks, br.net) >= 1, `${lab.id} (${k} lỗi): phải có nhiệm vụ trượt`);
      assert.equal(fails(br.tasks, B.applyFixes(br, N.cloneNet(br.net))), 0, `${lab.id} (${k} lỗi): sửa xong phải đạt hết — ${br.faults.map((f) => f.kind)}`);
      n++;
    }
  }
  assert.ok(n >= 180, `đủ nhiều đề (${n})`);
});

test('thư viện lỗi đủ loại; mỗi lỗi chỉ gài trên thiết bị/tính năng có thật trong lab', () => {
  const kinds = new Set();
  for (const lab of LABS) {
    const net = B.solvedNet(lab);
    if (!net) continue;
    for (const f of B.faultCandidates(net)) {
      kinds.add(f.kind);
      assert.ok(net.devices[f.dev], f.key);
      assert.ok(f.brk.length && f.fix.length && f.title && f.detail && f.layer, f.key);
    }
  }
  for (const k of ['shutdown', 'access-vlan', 'allowed', 'native', 'pc-ip', 'pc-gw', 'ospf-net', 'ospf-area', 'static', 'acl', 'nat', 'hsrp', 'port-security', 'dot1q']) assert.ok(kinds.has(k), `thiếu loại lỗi ${k}`);
});

test('tất định theo seed; lab giả "RB:…" dựng lại được, gợi ý 3 mức, đáp án đủ lệnh sửa', () => {
  const lab = LABS.find((l) => l.id === 'L13') || LABS.find((l) => solutionOf(l).length && !UNBREAKABLE.includes(l.id));
  const a = B.makeBreak(lab, 2, 777), b = B.makeBreak(lab, 2, 777);
  assert.deepEqual(a.faults.map((f) => f.key), b.faults.map((f) => f.key));
  const seeds = new Set(Array.from({ length: 8 }, (_, i) => B.makeBreak(lab, 1, 100 + i).faults[0].key));
  assert.ok(seeds.size > 1, 'seed khác → lỗi khác');
  const id = B.breakId(lab.id, 2, 777);
  assert.ok(B.isBreakId(id));
  const r = B.breakLab(id);
  assert.equal(r.id, id);
  assert.equal(r.kind, 'ticket');
  assert.deepEqual(r.tasks, lab.tasks.filter((t) => !t.quiz));
  assert.equal(r.hints.length, 3 * a.n);
  assert.match(r.hints[0], /^Lỗi 1: nằm ở Lớp/);
  assert.equal(r.breakInfo.faults.length, a.n);
  assert.equal(r.solution.length, a.n);
  assert.ok(fails(r.tasks, r.build()) >= 1, 'mạng của đề đang hỏng');
  assert.equal(B.breakLab('RB:KHONG-CO:1:5'), null);
  assert.equal(B.breakLab('RB:A07:1:5'), null, 'lab không phá được → null');
});

test('điểm & lịch sử', () => {
  assert.equal(B.breakScore({ n: 2, secs: 60, hints: 0 }), 990);
  assert.equal(B.breakScore({ n: 1, secs: 0, hints: 1 }), 547);
  assert.equal(B.breakScore({ n: 3, secs: 30, hints: 0, revealed: true }), 0);
  let h = [];
  for (let i = 0; i < 105; i++) h = B.addBreakResult(h, { id: 'RB:x:1:' + i, secs: i });
  assert.equal(h.length, 100);
  assert.equal(h[0].id, 'RB:x:1:104', 'mới nhất lên đầu');
  h = B.addBreakResult(h, { id: 'RB:x:1:104', secs: 1 });
  assert.equal(h.filter((x) => x.id === 'RB:x:1:104').length, 1, 'chơi lại cùng đề → thay lượt cũ');
  assert.ok(B.pickBreakLab({ L01: true }, () => 0).id === 'L01', 'ưu tiên lab đã xong');
});
