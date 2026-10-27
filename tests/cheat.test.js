// tests/cheat.test.js — 📋 cheat sheet tự sinh từ lệnh đã gõ (lab/cheat.js) và markdown gọn cho ghi chú lab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, buildCheat, miniMd } from '../lab/cheat.js';
import { DESC } from '../lab/ios.js';
import * as W from '../lab/weak.js';

test('mô tả lệnh: từ khoá cụ thể nhất, show → "Xem …", no → "Gỡ / phủ định"', () => {
  assert.equal(describe('ip address <ip> <mask>', DESC), DESC.address);
  assert.equal(describe('switchport mode access', DESC), DESC.access);
  assert.equal(describe('show ip interface brief', DESC), 'Xem ip interface brief');
  assert.match(describe('no shutdown', DESC), /^Gỡ \/ phủ định: tắt cổng/);
  assert.equal(describe('<ip>', DESC), '');
});

test('cheat sheet: gom theo chủ đề → chế độ, dùng nhiều trước, lọc chủ đề và tìm kiếm', () => {
  let w = W.emptyWeak();
  const rec = (cmd, spec, mode, n = 1) => { for (let i = 0; i < n; i++) w = W.recordCmd(w, { cmd, spec, mode, out: [], at: i }); };
  rec('router ospf 1', 'router ospf <n>', 'config');
  rec('network 10.0.0.0 0.0.0.255 area 0', 'network <ip> <wild> area <n>', 'router', 3);
  rec('switchport access vlan 10', 'switchport access vlan <n>', 'if', 2);
  rec('vlan 10', 'vlan <vlist>', 'config');
  w = W.recordCmd(w, { cmd: 'swtchport', out: ['% Invalid input detected at \'^\' marker.'], at: 9 }); // lệnh sai không vào cheat sheet
  const all = buildCheat(w.cmds, DESC);
  const topics = all.map((g) => g.topic);
  assert.ok(topics.includes('OSPF') && topics.includes('VLAN/Trunk'), topics.join());
  assert.equal(all.reduce((s, g) => s + g.n, 0), 4);
  const ospf = all.find((g) => g.topic === 'OSPF');
  assert.deepEqual(ospf.modes.map((m) => m.mode), ['config', 'router'], 'config trước router');
  assert.equal(ospf.modes[1].items[0].n, 3);
  assert.equal(ospf.modes[1].items[0].ex, 'network 10.0.0.0 0.0.0.255 area 0');
  assert.deepEqual(buildCheat(w.cmds, DESC, { topic: 'OSPF' }).map((g) => g.topic), ['OSPF']);
  assert.equal(buildCheat(w.cmds, DESC, { q: 'access vlan' }).reduce((s, g) => s + g.n, 0), 1);
  assert.deepEqual(buildCheat({}, DESC), []);
});

test('markdown ghi chú: thoát HTML, **đậm**, `mã`, gạch đầu dòng', () => {
  assert.equal(miniMd('Nhớ **no shutdown**\n- `show ip ospf neighbor`\n- <b>x</b>'), '<p>Nhớ <b>no shutdown</b></p><ul><li><code>show ip ospf neighbor</code></li><li>&lt;b&gt;x&lt;/b&gt;</li></ul>');
  assert.equal(miniMd(''), '');
});
