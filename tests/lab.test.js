// tests/lab.test.js — Lab CLI: engine mạng, dòng lệnh IOS và toàn bộ bộ lab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lab/net.js';
import { createCli, runScript, parseVlist, fmtVlist } from '../lab/ios.js';
import { LABS, buildLab, checkLab, applySolution, quizAnswers } from '../lab/labs.js';

// ---------- mọi lab: ban đầu chưa đạt, chạy lời giải thì đạt hết ----------
for (const lab of LABS) {
  test(`${lab.id} — ${lab.title}: lời giải làm đạt mọi nhiệm vụ`, () => {
    const net = buildLab(lab);
    // Chấm "trước" với đáp án quiz đúng → buộc phải có ít nhất 1 nhiệm vụ cấu hình trượt (không tính quiz)
    const before = checkLab(lab, net, quizAnswers(lab));
    assert.ok(lab.tasks.some((t, i) => !t.quiz && !before[i]), `${lab.id}: ngay từ đầu đã đạt hết — lab không có gì để làm`);
    const cli = createCli(net);
    const errs = [];
    for (const o of applySolution(lab, net, cli)) {
      if (o.out.some((l) => /^% (Invalid|Incomplete|Ambiguous|Unknown)/.test(l) || /^ERROR:/.test(l) || l.includes("'^' marker"))) errs.push(`${o.dev}: "${o.cmd}" → ${o.out.join(' | ')}`);
    }
    assert.deepEqual(errs, [], 'Lệnh trong lời giải bị CLI từ chối');
    const after = checkLab(lab, net, quizAnswers(lab));
    const failed = lab.tasks.filter((_, i) => !after[i]).map((t) => t.text);
    assert.deepEqual(failed, [], `${lab.id}: còn nhiệm vụ chưa đạt sau lời giải`);
  });
}

test('id lab là duy nhất và đủ trường bắt buộc', () => {
  const ids = new Set();
  for (const l of LABS) {
    assert.ok(!ids.has(l.id), 'trùng id ' + l.id);
    ids.add(l.id);
    for (const k of ['group', 'title', 'story', 'build', 'tasks', 'hints']) assert.ok(l[k], `${l.id} thiếu ${k}`);
    assert.ok(l.solution || l.guide, `${l.id} thiếu solution/guide`);
  }
  assert.ok(LABS.length >= 101);
});

// ---------- CLI giống IOS ----------
function tiny() {
  const net = N.makeNet([
    N.pc('p1', 'PC1', 0, 0, { ip: '192.168.1.10', gw: '192.168.1.1' }),
    N.router('r1', 'R1', 0, 0, ['g0/0', 'g0/1']),
  ], [['p1', 'fa0', 'r1', 'g0/0']]);
  return { net, cli: createCli(net) };
}

test('viết tắt lệnh, chế độ và prompt như IOS', () => {
  const { cli } = tiny();
  assert.equal(cli.prompt('r1'), 'R1>');
  cli.exec('r1', 'en');
  assert.equal(cli.prompt('r1'), 'R1#');
  cli.exec('r1', 'conf t');
  assert.equal(cli.prompt('r1'), 'R1(config)#');
  cli.exec('r1', 'int g0/0');
  assert.equal(cli.prompt('r1'), 'R1(config-if)#');
  cli.exec('r1', 'ip add 192.168.1.1 255.255.255.0');
  const r = cli.exec('r1', 'no shut');
  assert.ok(r.out.some((l) => l.includes('changed state to up')));
  cli.exec('r1', 'router ospf 1'); // lệnh global ngay trong config-if → tự thoát ra
  assert.equal(cli.prompt('r1'), 'R1(config-router)#');
  cli.exec('r1', 'end');
  assert.ok(cli.exec('r1', 'sh ip int br').out.some((l) => /GigabitEthernet0\/0\s+192\.168\.1\.1/.test(l)));
});

test('báo lỗi kiểu IOS: dấu ^, incomplete, ambiguous', () => {
  const { cli } = tiny();
  cli.exec('r1', 'enable');
  cli.exec('r1', 'configure terminal');
  const bad = cli.exec('r1', 'ip adress 1.1.1.1');
  assert.ok(bad.out.includes("% Invalid input detected at '^' marker."));
  assert.equal(bad.out[0].indexOf('^'), 'R1(config)#'.length + 3); // dưới chữ "adress"
  assert.deepEqual(cli.exec('r1', 'hostname').out[0], '% Incomplete command.');
  assert.ok(cli.exec('r1', 'en').out[0].startsWith('% Ambiguous command')); // enable / end
});

test('enable secret hỏi mật khẩu', () => {
  const { cli } = tiny();
  runScript(cli, 'r1', ['en', 'conf t', 'enable secret Cisco123', 'end', 'disable']);
  const r = cli.exec('r1', 'enable');
  assert.equal(r.password, true);
  cli.exec('r1', 'sai');
  assert.equal(cli.prompt('r1'), 'Password: ');
  cli.exec('r1', 'Cisco123');
  assert.equal(cli.prompt('r1'), 'R1#');
});

test('ping từ PC: chưa cấu hình router → timeout; xong → Reply + có timeline byte-thật', () => {
  const { cli } = tiny();
  let r = cli.exec('p1', 'ping 192.168.1.1');
  assert.ok(r.out.includes('Request timed out.'));
  runScript(cli, 'r1', ['en', 'conf t', 'int g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'end']);
  r = cli.exec('p1', 'ping 192.168.1.1');
  assert.ok(r.out.some((l) => l.startsWith('Reply from 192.168.1.1')));
  assert.ok(r.sim.events.length > 4 && r.sim.pcap.length >= 3);
});

test('router ping: lần đầu ".!!!!" (mất gói vì ARP), lần sau "!!!!!"', () => {
  const { cli } = tiny();
  runScript(cli, 'r1', ['en', 'conf t', 'int g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'end']);
  assert.ok(cli.exec('r1', 'ping 192.168.1.10').out.includes('.!!!!'));
  assert.ok(cli.exec('r1', 'ping 192.168.1.10').out.includes('!!!!!'));
});

test('show run | include lọc dòng', () => {
  const { cli } = tiny();
  runScript(cli, 'r1', ['en', 'conf t', 'hostname EDGE', 'end']);
  assert.deepEqual(cli.exec('r1', 'show running-config | include hostname').out, ['hostname EDGE']);
});

test('danh sách VLAN', () => {
  assert.deepEqual(parseVlist('10,20,30-32'), [10, 20, 30, 31, 32]);
  assert.equal(fmtVlist([10, 20, 30, 31, 32]), '10,20,30-32');
  assert.equal(fmtVlist(null), '1-4094');
});

test('ACL: thứ tự dòng + deny ngầm định', () => {
  const d = N.router('r', 'R', 0, 0, ['g0/0']);
  d.acls.X = { type: 'extended', entries: [
    { seq: 10, action: 'deny', proto: 'ip', src: { any: true }, dst: { any: true } },
    { seq: 20, action: 'permit', proto: 'tcp', src: { any: true }, dst: { ip: '10.0.0.1', wild: '0.0.0.0' }, dport: { op: 'eq', port: 80 } },
  ] };
  assert.equal(N.aclEval(d, 'X', { src: '1.1.1.1', dst: '10.0.0.1', proto: 'tcp', dport: 80 }).action, 'deny');
  d.acls.X.entries.reverse();
  assert.equal(N.aclEval(d, 'X', { src: '1.1.1.1', dst: '10.0.0.1', proto: 'tcp', dport: 80 }).action, 'permit');
  d.acls.Y = { type: 'standard', entries: [{ seq: 10, action: 'permit', src: { ip: '10.0.0.0', wild: '0.0.0.255' } }] };
  assert.equal(N.aclEval(d, 'Y', { src: '10.0.1.1' }).action, 'deny'); // implicit deny
});

test('5 lab tổng hợp doanh nghiệp (X01–X05) có cách giải chi tiết đầy đủ', async () => {
  const { CAP_LABS } = await import('../lab/labs-capstone.js');
  assert.deepEqual(CAP_LABS.map((l) => l.id), ['X01', 'X02', 'X03', 'X04', 'X05']);
  for (const l of CAP_LABS) {
    assert.equal(l.group, 'cap');
    assert.ok(Array.isArray(l.guide) && l.guide.length >= 5, `${l.id}: guide quá ngắn`);
    assert.ok(l.guide[0].title && l.guide[0].why, `${l.id}: bước đầu thiếu title/why`);
    for (const g of l.guide) assert.ok(g.dev && Array.isArray(g.cmds) && g.cmds.length, `${l.id}: bước "${g.title}" thiếu dev/cmds`);
  }
});

test('tìm lab không dấu, nhiều từ khoá', async () => {
  const { labMatch, fold } = await import('../lab/labs.js');
  assert.equal(fold('Định tuyến OSPF'), 'dinh tuyen ospf');
  const x03 = LABS.find((l) => l.id === 'X03');
  assert.ok(labMatch(x03, 'eigrp bgp'));
  assert.ok(labMatch(x03, 'sap nhap'));
  assert.ok(!labMatch(x03, 'eigrp vxlan'));
  assert.ok(labMatch(x03, '  '));
  assert.ok(LABS.filter((l) => labMatch(l, 'nat')).length >= 5);
});

test('thi thử: thời gian theo độ khó, chấm thang 1000 đạt từ 800', async () => {
  const { examMinutes, examResult } = await import('../lab/labs.js');
  assert.equal(examMinutes(LABS.find((l) => l.id === 'X01')), 60);
  assert.equal(examMinutes({ group: 'c1', level: 1 }), 10);
  assert.deepEqual(examResult([true, true, true, true, false]), { ok: 4, total: 5, score: 800, pass: true });
  assert.equal(examResult([true, false, false]).pass, false);
  assert.equal(examResult([]).score, 0);
});

test('lab có sẵn: server tên chứa "INTERNET" vẽ thành đám mây, server thật giữ icon server', () => {
  let clouds = 0;
  for (const lab of LABS) {
    for (const d of Object.values(lab.build().devices)) {
      if (d.type !== 'server') continue;
      const inet = /internet/i.test(d.name);
      assert.equal(N.isCloud(d), inet, `${lab.id} ${d.name}`);
      if (inet) clouds++;
    }
  }
  assert.ok(clouds >= 15, 'các lab có "INTERNET 8.8.8.8" đều thành đám mây');
});
