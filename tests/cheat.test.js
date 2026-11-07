// tests/cheat.test.js — 📋 cheat sheet tự sinh từ lệnh đã gõ (lab/cheat.js) và markdown gọn cho ghi chú lab.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, buildCheat, miniMd } from '../lab/cheat.js';
import { CHEAT_REF, filterRef } from '../lab/cheat-ref.js';
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

test('bảng tra cứu: dữ liệu đủ cột, lọc theo chủ đề và từ khoá', () => {
  for (const s of CHEAT_REF) for (const r of s.rows) assert.equal(r.length, s.cols.length, `${s.title}: ${r[0]}`);
  assert.equal(new Set(CHEAT_REF.map((s) => s.title)).size, CHEAT_REF.length, 'tên mục không trùng');
  assert.equal(filterRef(CHEAT_REF).length, CHEAT_REF.length);
  assert.ok(filterRef(CHEAT_REF, { topic: 'Phỏng vấn' }).every((s) => s.topic === 'Phỏng vấn'));
  const byRow = filterRef(CHEAT_REF, { q: 'SET AS-PATH PREPEND' });
  assert.deepEqual(byRow.map((s) => s.rows.length), [1], 'chỉ giữ dòng khớp, không phân biệt hoa thường');
  const stp = CHEAT_REF.find((s) => s.title === 'Cấu hình STP');
  assert.equal(filterRef([stp], { q: 'cấu hình stp' })[0].rows.length, stp.rows.length, 'khớp tên mục thì giữ cả mục');
  assert.deepEqual(filterRef(CHEAT_REF, { q: 'zzz-khong-co' }), []);
});

test('bảng tra cứu: có đủ các chủ đề của CCNA v2.0 và lab CCNP', () => {
  const all = JSON.stringify(CHEAT_REF).toLowerCase();
  const need = ['container', 'eui-64', 'rssi', 'snr', 'power inline', 'root secondary', 'ipv6 router ospf', 'scp://', 'sftp://', 'cname', 'raguard', 'agentic', 'hạ tầng dưới dạng mã', 'facility', 'route-map', 'prefix-list', 'distribute-list', 'ip policy', 'virtual-link', 'route-reflector-client', 'peer-group', 'set community', 'eigrp stub', 'af-interface', 'spanning-tree mst', 'remote-span', 'erspan', 'control-plane', 'ip verify unicast', 'time-range', 'macsec', 'event manager', 'python', 'ipv6 dhcp relay', 'debug condition', 'flexconnect', 'flow monitor', 'private-vlan', 'access-map', 'uplinkfast', 'backbonefast', 'bpdufilter', 'udld', 'switchport backup', 'auto qos', 'glbp 1', 'adjacency', 'default-metric', 'seed metric', 'key chain', 'point-to-multipoint', 'originator_id', 'ipv6 rip', 'ipv6 router eigrp', 'general-prefix', '6to4', 'isatap', 'nat64', 'pppoe', 'frame relay', 'fcaps', 'ppdioo', 'show run | section', 'show processes cpu', 'show ip nat statistics', 'show ip dhcp conflict', 'g.729', 'telephony-service', 'dial-peer', 'nghe một chiều'];
  assert.deepEqual(need.filter((k) => !all.includes(k)), []);
});

test('markdown ghi chú: thoát HTML, **đậm**, `mã`, gạch đầu dòng', () => {
  assert.equal(miniMd('Nhớ **no shutdown**\n- `show ip ospf neighbor`\n- <b>x</b>'), '<p>Nhớ <b>no shutdown</b></p><ul><li><code>show ip ospf neighbor</code></li><li>&lt;b&gt;x&lt;/b&gt;</li></ul>');
  assert.equal(miniMd(''), '');
});

test('từ viết tắt trong Cheat sheet tra cứu đều có khung giải thích, trừ mã hex, mã lab và chữ trong log', async () => {
  const { abbrTip } = await import('../i18n/abbr.js');
  const { CHEAT_REF } = await import('../lab/cheat-ref.js');
  assert.match(abbrTip('OSPF'), /Open Shortest Path First/); // lấy từ Từ điển
  assert.match(abbrTip('LACP'), /Link Aggregation/);
  assert.match(abbrTip('IPv6'), /128 bit/);
  assert.equal(abbrTip('KHOA'), undefined);
  const miss = new Set();
  for (const s of CHEAT_REF) for (const r of s.rows) for (const c of [...r.slice(s.cols[0] === 'Lệnh' ? 1 : 0), s.title, s.note || '']) {
    for (const [w] of String(c).matchAll(/\b[A-Z][A-Z0-9]*[A-Z0-9](?:v\d)?\b/g)) if (!abbrTip(w) && !/^(F[CDEF][0-9A-F]*|[KW]0\d|KHOA|LINK|UP|UPDOWN|SU|SYS|PT|TOKEN|CISCO|CONTROLLER)$/.test(w)) miss.add(w);
  }
  assert.deepEqual([...miss], []);
});
