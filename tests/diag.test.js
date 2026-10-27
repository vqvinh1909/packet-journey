// tests/diag.test.js — 🩺 "Vì sao không ping được?" (lab/diagnose.js) và 🔍 so sánh cấu hình với lời giải (lab/cfgdiff.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnose } from '../lab/diagnose.js';
import { diffLab, cfgItems } from '../lab/cfgdiff.js';
import { getLab, buildLab, applySolution } from '../lab/labs.js';
import { createCli, runScript } from '../lab/ios.js';
import * as S from '../lab/sandbox.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
const fresh = (id) => { const lab = getLab(id); const net = buildLab(lab); return { lab, net, cli: createCli(net) }; };
const solved = (id) => { const x = fresh(id); applySolution(x.lab, x.net, x.cli); return x; };

test('chẩn đoán theo lớp: L1 chưa cắm dây, cấu hình IP máy, lớp 2 (cổng tắt giữa đường), lọc ACL; đã sửa thì ok', () => {
  const sb = S.emptySandbox();
  const pc = S.addDevice(sb, 'pc', 100, 100);
  let r = diagnose(sb, pc, '10.0.0.1');
  assert.equal(r.problem.layer, 'l1');
  assert.equal(r.problem.hints.length, 3, 'gợi ý 3 mức: lớp → thiết bị/lệnh show → chi tiết');

  const a02 = fresh('A02');
  r = diagnose(a02.net, 'p4', '172.16.20.130');
  assert.equal(r.problem.layer, 'host');
  assert.match(r.problem.detail, /Gateway 172\.16\.20\.1 không thuộc subnet/);
  assert.ok(r.steps.find((x) => x.layer === 'l1').ok, 'lớp 1 đã kiểm và ổn');

  const c03 = fresh('C03');
  r = diagnose(c03.net, 'p1', '172.16.0.10');
  assert.equal(r.problem.layer, 'l2', JSON.stringify(r.problem));
  assert.equal(r.problem.devName, 'SW1', 'chỉ vào switch, không chỉ vào chính PC');
  assert.ok(!r.ok);

  const a10 = solved('A10');
  r = diagnose(a10.net, 'user', '172.16.0.10');
  assert.equal(r.problem.layer, 'filter', JSON.stringify(r.problem));
  assert.equal(r.problem.devName, 'R1');
  assert.ok(diagnose(a10.net, 'noc', '172.16.0.10').ok);

  assert.ok(diagnose(solved('C03').net, 'p1', '172.16.0.10').ok);
});

test('so sánh cấu hình: giống lời giải → không khác biệt; cách khác vẫn đúng → có ghi chú tương đương', () => {
  assert.deepEqual(cfgItems(['!', 'hostname R1', 'interface Gi0/0', ' ip address 1.1.1.1 255.0.0.0', ' no shutdown', 'end']), ['hostname R1', 'interface Gi0/0', 'interface Gi0/0 › ip address 1.1.1.1 255.0.0.0', 'interface Gi0/0 › no shutdown']);
  const s = solved('A17');
  assert.deepEqual(diffLab(s.lab, s.net, s.cli).devices, []);
  const u = fresh('A17');
  runScript(u.cli, 'rhq', cfg('ip route 10.1.0.0 255.255.252.0 s0/0/0'));
  runScript(u.cli, 'rbr', cfg('ip route 0.0.0.0 0.0.0.0 172.16.0.1'));
  const d = diffLab(u.lab, u.net, u.cli);
  const hq = d.devices.find((x) => x.id === 'rhq');
  assert.ok(hq.mine.some((x) => /s0\/0\/0|Serial0\/0\/0/i.test(x)), hq.mine.join('|'));
  assert.ok(hq.sol.some((x) => /172\.16\.0\.2/.test(x)));
  assert.ok(hq.notes.some((n) => /next-hop/.test(n)));
  assert.ok(!d.devices.find((x) => x.id === 'rbr'), 'R-BR giống hệt lời giải');
  assert.equal(diffLab({ ...u.lab, solution: [], guide: undefined }, u.net, u.cli), null);
});
