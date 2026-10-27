// tests/lab.test.js — Lab CLI: engine mạng, dòng lệnh IOS và toàn bộ bộ lab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lab/net.js';
import { createCli, runScript, parseVlist, fmtVlist } from '../lab/ios.js';
import { LABS, buildLab, checkLab } from '../lab/labs.js';

// ---------- mọi lab: ban đầu chưa đạt, chạy lời giải thì đạt hết ----------
for (const lab of LABS) {
  test(`${lab.id} — ${lab.title}: lời giải làm đạt mọi nhiệm vụ`, () => {
    const net = buildLab(lab);
    const before = checkLab(lab, net);
    assert.ok(before.some((x) => !x), `${lab.id}: ngay từ đầu đã đạt hết — lab không có gì để làm`);
    const cli = createCli(net);
    const errs = [];
    for (const [dev, cmds] of lab.solution) {
      for (const o of runScript(cli, dev, cmds)) {
        if (o.out.some((l) => /^% (Invalid|Incomplete|Ambiguous|Unknown)/.test(l) || l.includes("'^' marker"))) errs.push(`${dev}: "${o.cmd}" → ${o.out.join(' | ')}`);
      }
    }
    assert.deepEqual(errs, [], 'Lệnh trong lời giải bị CLI từ chối');
    const after = checkLab(lab, net);
    const failed = lab.tasks.filter((_, i) => !after[i]).map((t) => t.text);
    assert.deepEqual(failed, [], `${lab.id}: còn nhiệm vụ chưa đạt sau lời giải`);
  });
}

test('id lab là duy nhất và đủ trường bắt buộc', () => {
  const ids = new Set();
  for (const l of LABS) {
    assert.ok(!ids.has(l.id), 'trùng id ' + l.id);
    ids.add(l.id);
    for (const k of ['group', 'title', 'story', 'build', 'tasks', 'hints', 'solution']) assert.ok(l[k], `${l.id} thiếu ${k}`);
  }
  assert.ok(LABS.length >= 25);
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
