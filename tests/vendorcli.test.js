// tests/vendorcli.test.js — FortiGate "get system status", trợ giúp "?" và Tab cho FortiOS / PAN-OS (lab/vhelp.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lab/net.js';
import { createCli } from '../lab/ios.js';

function setup() {
  const net = N.makeNet([N.firewall('fg', 'FGT', 0, 0, ['port1', 'port2'], 'fortios'), N.firewall('pa', 'PA-VM', 0, 0, ['e1/1', 'e1/2'], 'panos')], []);
  const cli = createCli(net);
  const run = (d, ...l) => l.map((c) => cli.exec(d, c).out.join('\n')).at(-1);
  return { cli, run };
}

test('FortiGate: get system status giống FortiOS, Hostname lấy từ config system global', () => {
  const { run } = setup();
  const out = run('fg', 'config system global', 'set hostname HN-FW01', 'end', 'get system status');
  assert.doesNotMatch(out, /Unknown action|Command fail/);
  assert.match(out, /^Version: FortiGate-VM64 v7\.4\.\d+,build\d+/m);
  assert.match(out, /^Serial-Number: FGVM\w+$/m);
  assert.match(out, /^Hostname: HN-FW01$/m);
  assert.match(out, /^Operation Mode: NAT$/m);
  assert.match(out, /^Current HA mode: standalone$/m);
  assert.match(out, /^System time: \w{3} \w{3} \d{2} \d{2}:\d{2}:\d{2} \d{4}$/m);
  assert.equal(run('fg', 'get system status'), out, 'Serial-Number cố định theo thiết bị');
});

test('FortiGate: "?" theo ngữ cảnh (gốc, config, edit) và Tab hoàn thành lệnh', () => {
  const { cli, run } = setup();
  assert.match(run('fg', '?'), /^config\s+Configure object\.$/m);
  assert.match(run('fg', 'get system ?'), /^status\s+System status\.$/m);
  assert.match(run('fg', 'get sys?'), /^system\s+/m);
  assert.equal(run('fg', 'get system status ?'), '<Enter>');
  assert.match(run('fg', 'xyz ?'), /Command fail/);
  run('fg', 'config firewall policy');
  assert.match(run('fg', '?'), /^edit\s+Create new table entry/m);
  run('fg', 'edit 1');
  assert.match(run('fg', 'set ?'), /^srcintf\s+Incoming \(ingress\) interface\.$/m);
  assert.doesNotMatch(run('fg', 'set ?'), /^config/m, 'trong edit chỉ gợi ý lệnh của bảng');
  run('fg', 'end');
  assert.equal(cli.complete('fg', 'get system st'), 'get system status ');
  assert.equal(cli.complete('fg', 'conf'), 'config ');
  assert.equal(cli.complete('fg', 'config fire'), 'config firewall ');
  assert.equal(cli.complete('fg', 'get system s'), null, 'session / status: chưa đủ để chọn');
  assert.ok(run('fg', 'get system status').startsWith('Version:'), '"?" không làm thay đổi trạng thái');
});

test('Palo Alto: "?" ở chế độ vận hành (>) và cấu hình (#), gõ dở rồi "?", Tab', () => {
  const { cli, run } = setup();
  const top = run('pa', '?');
  assert.doesNotMatch(top, /Unknown command/);
  assert.match(top, /^> configure\s+Manipulate software configuration information$/m);
  assert.match(top, /^> show\s+/m);
  assert.match(run('pa', 'show ?'), /^> session\s+Show session information$/m);
  assert.match(run('pa', 'sh?'), /^> show\s+/m);
  assert.match(run('pa', 'show session all ?'), /<Enter>\s+Finish input/);
  assert.match(run('pa', 'ping host ?'), /<ip>/);
  assert.match(run('pa', 'xyz ?'), /Unknown command: xyz/);
  assert.equal(cli.complete('pa', 'conf'), 'configure ');
  run('pa', 'configure');
  const cfgTop = run('pa', '?');
  assert.match(cfgTop, /^> commit\s+Commit the candidate configuration$/m);
  assert.doesNotMatch(cfgTop, /^> configure/m, 'chế độ cấu hình có danh sách lệnh riêng');
  assert.match(run('pa', 'set ?'), /^> rulebase\s+/m);
  assert.match(run('pa', 'set rulebase security rules R1 ?'), /^> action\s+Action \(allow, deny, drop\)$/m);
  assert.equal(cli.complete('pa', 'set rul'), 'set rulebase ');
  assert.equal(cli.complete('pa', 'set rulebase security rules R1 act'), 'set rulebase security rules R1 action ');
  assert.equal(cli.complete('pa', 'com'), 'commit ');
  assert.match(run('pa', 'set rulebase security rules R1 action allow', 'show config diff'), /\+ set rulebase security rules R1 action allow/, '"?" không phá lệnh thường');
});
