// tests/sandbox.test.js — chế độ "Tự dựng mạng riêng": thêm/xoá/nối dây, xuất-nhập JSON, nhiệm vụ hướng dẫn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli, runScript } from '../lab/ios.js';
import { checkLab } from '../lab/labs.js';
import * as S from '../lab/sandbox.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];

test('thêm thiết bị tự đặt tên không trùng, nối/gỡ dây, xoá thiết bị', () => {
  const net = S.emptySandbox();
  const a = S.addDevice(net, 'pc', 100, 100), b = S.addDevice(net, 'pc', 200, 100), sw = S.addDevice(net, 'sw2960', 150, 250);
  assert.deepEqual([a, b, sw], ['pc1', 'pc2', 'sw1']);
  assert.equal(net.devices.pc2.name, 'PC2');
  assert.equal(S.connect(net, a, 'fa0', sw, 'fa0/1'), null);
  assert.match(S.connect(net, b, 'fa0', sw, 'fa0/1'), /đã có dây/);
  assert.ok(!S.freePorts(net, sw).includes('fa0/1'));
  const r = S.addDevice(net, 'router', 300, 300);
  assert.match(S.connect(net, r, 's0/0/0', sw, 'fa0/2'), /Serial/);
  S.disconnect(net, net.links[0].id);
  assert.equal(net.links.length, 0);
  S.connect(net, a, 'fa0', sw, 'fa0/1');
  S.removeDevice(net, sw);
  assert.equal(net.links.length, 0);
  assert.equal(net.devices.sw1, undefined);
  assert.equal(S.addDevice(net, 'sw3560', 0, 0), 'l3sw1');
  assert.equal(net.devices.l3sw1.model, '3560');
});

test('xuất/nhập JSON giữ nguyên cấu hình; file sai báo lỗi', () => {
  const net = S.emptySandbox();
  S.addDevice(net, 'router', 100, 100);
  runScript(createCli(net), 'r1', cfg('hostname EDGE', 'interface g0/0', 'ip address 10.0.0.1 255.255.255.0'));
  const back = S.importSandbox(JSON.parse(JSON.stringify(S.exportSandbox(net))));
  assert.equal(back.devices.r1.name, 'EDGE');
  assert.equal(back.devices.r1.ifaces['g0/0'].ip, '10.0.0.1');
  assert.throws(() => S.importSandbox({ foo: 1 }), /devices/);
  assert.throws(() => S.importSandbox({ devices: { x: { id: 'x', type: 'toaster', name: 'X', x: 0, y: 0 } }, links: [] }), /không hợp lệ/);
});

test('nhiệm vụ sandbox chấm được trên mạng tự dựng', () => {
  const net = S.emptySandbox();
  const lab = S.SANDBOX_LAB;
  assert.ok(checkLab(lab, net).every((x) => !x));
  for (const k of ['pc', 'pc', 'pc', 'sw2960', 'router', 'router']) S.addDevice(net, k, 0, 0);
  S.connect(net, 'pc1', 'fa0', 'sw1', 'fa0/1');
  S.connect(net, 'pc2', 'fa0', 'sw1', 'fa0/2');
  S.connect(net, 'r1', 'g0/0', 'sw1', 'g0/1');
  S.connect(net, 'r1', 'g0/1', 'r2', 'g0/1');
  S.connect(net, 'pc3', 'fa0', 'r2', 'g0/0');
  const cli = createCli(net);
  runScript(cli, 'sw1', cfg('vlan 10', 'interface range fa0/1 - 2', 'switchport mode access', 'switchport access vlan 10', 'interface g0/1', 'switchport mode access', 'switchport access vlan 10'));
  runScript(cli, 'r1', cfg('interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.1 255.255.255.252', 'no shutdown', 'exit', 'ip dhcp excluded-address 192.168.1.1 192.168.1.10', 'ip dhcp pool LAN', 'network 192.168.1.0 255.255.255.0', 'default-router 192.168.1.1', 'exit', 'router ospf 1', 'network 0.0.0.0 255.255.255.255 area 0'));
  runScript(cli, 'r2', cfg('interface g0/0', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.2 255.255.255.252', 'no shutdown', 'exit', 'router ospf 1', 'network 0.0.0.0 255.255.255.255 area 0'));
  runScript(cli, 'pc1', ['ipconfig 192.168.1.20 255.255.255.0 192.168.1.1']);
  runScript(cli, 'pc2', ['ipconfig /renew']);
  runScript(cli, 'pc3', ['ipconfig 192.168.2.20 255.255.255.0 192.168.2.1']);
  const r = checkLab(lab, net);
  assert.deepEqual(lab.tasks.filter((_, i) => !r[i]).map((t) => t.text), []);
});

test('đổi tên, nhân bản giữ cấu hình nhưng bỏ IP', () => {
  const net = S.emptySandbox();
  S.addDevice(net, 'router', 100, 100); S.addDevice(net, 'pc', 200, 100);
  runScript(createCli(net), 'r1', cfg('interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown', 'exit', 'router ospf 1', 'network 10.0.0.0 0.0.0.255 area 0'));
  assert.equal(S.renameDevice(net, 'r1', 'HQ-EDGE'), null);
  assert.equal(net.devices.r1.name, 'HQ-EDGE');
  assert.match(S.renameDevice(net, 'r1', 'co dau cach'), /Hostname/);
  assert.match(S.renameDevice(net, 'pc1', 'hq-edge'), /Đã có/);
  assert.equal(S.renameDevice(net, 'pc1', 'Máy kế toán'), null); // PC được đặt tên tự do
  const id = S.duplicateDevice(net, 'r1');
  const d = net.devices[id];
  assert.equal(d.ifaces['g0/0'].ip, null);
  assert.equal(d.ospf.pid, 1);
  assert.notEqual(d.name, 'HQ-EDGE');
  assert.equal(net.devices.r1.ifaces['g0/0'].ip, '10.0.0.1'); // bản gốc không bị ảnh hưởng
});

test('hoàn tác / làm lại', () => {
  const net = S.emptySandbox();
  const h = S.createHistory();
  h.track(net, () => S.addDevice(net, 'pc', 0, 0));
  h.track(net, () => S.addDevice(net, 'sw2960', 0, 0));
  h.track(net, () => S.connect(net, 'pc1', 'fa0', 'sw1', 'fa0/1'));
  h.track(net, () => null); // không đổi gì → không ghi lịch sử
  assert.equal(net.links.length, 1);
  assert.ok(h.undo(net));
  assert.equal(net.links.length, 0);
  assert.ok(h.undo(net));
  assert.deepEqual(Object.keys(net.devices), ['pc1']);
  assert.ok(h.redo(net));
  assert.deepEqual(Object.keys(net.devices), ['pc1', 'sw1']);
  h.track(net, () => S.addDevice(net, 'router', 0, 0)); // thay đổi mới xoá nhánh redo
  assert.equal(h.canRedo, false);
});

test('mẫu mạng dựng sẵn hợp lệ (xuất/nhập được, mọi dây đúng cổng)', () => {
  for (const t of S.SANDBOX_TEMPLATES) {
    const net = t.build();
    assert.ok(Object.keys(net.devices).length >= 3, t.id);
    assert.ok(net.links.length >= 3, t.id + ' thiếu dây');
    S.importSandbox(S.exportSandbox(net));
  }
});
