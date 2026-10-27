// tests/sandbox.test.js — chế độ "Tự dựng mạng riêng": thêm/xoá/nối dây, xuất-nhập JSON, nhiệm vụ hướng dẫn,
// workspace kiểu EVE-NG (mẫu theo hãng, Add node, Start/Stop/Wipe, JSON cũ).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli, runScript } from '../lab/ios.js';
import { checkLab } from '../lab/labs.js';
import * as S from '../lab/sandbox.js';
import * as N from '../lab/net.js';

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

test('sandbox: thêm firewall các hãng (CLI + web), nhân bản đúng loại, xuất/nhập giữ cấu hình', () => {
  const net = S.emptySandbox();
  const ids = ['asa', 'fortios', 'panos', 'sophos', 'checkpoint', 'pfsense'].map((k) => S.addDevice(net, k, 100, 100));
  assert.deepEqual(ids, ['asa1', 'fgt1', 'pa1', 'xg1', 'cp1', 'pfs1']);
  for (const id of ids) assert.ok(net.devices[id].fw && net.devices[id].os, id);
  // PC — pfSense — SRV: cấu hình qua "lệnh thao tác" của trang web, rule mặc định LAN cho qua
  const pc = S.addDevice(net, 'pc', 0, 0), srv = S.addDevice(net, 'server', 0, 0);
  S.connect(net, pc, 'fa0', 'pfs1', 'em1');
  S.connect(net, 'pfs1', 'em0', srv, 'fa0');
  const cli = createCli(net);
  runScript(cli, pc, ['ipconfig 10.1.1.10 255.255.255.0 10.1.1.1']);
  runScript(cli, srv, ['ipconfig 203.0.113.10 255.255.255.0 203.0.113.2']);
  for (const c of ['if em0 ip=203.0.113.2/24 zone=WAN', 'if em1 ip=10.1.1.1/24 zone=LAN', 'apply']) assert.ok(!cli.exec('pfs1', c).out.some((l) => l.startsWith('ERROR')), c);
  const ok = (n) => checkLab({ tasks: [{ check: (a) => a.ping(pc, '203.0.113.10') }] }, n, [])[0];
  assert.ok(ok(net), 'PC ping qua pfSense');
  const back = S.importSandbox(JSON.parse(JSON.stringify(S.exportSandbox(net))));
  assert.ok(ok(back), 'sau xuất/nhập vẫn ping được');
  const dup = S.duplicateDevice(net, 'pfs1');
  assert.equal(net.devices[dup].os, 'pfsense');
  assert.equal(net.devices[dup].gfw, undefined, 'bản sao firewall web không chép cấu hình (tránh trùng IP)');
  assert.equal(net.devices[S.duplicateDevice(net, 'asa1')].name, 'ASA2');
});

test('workspace: mẫu thiết bị theo hãng, Add node (số lượng, tiền tố, số cổng, tên cổng theo mẫu)', () => {
  for (const v of S.SANDBOX_VENDORS) for (const k of v.kinds) assert.equal(S.SANDBOX_KINDS[k].vendor, v.id, k);
  assert.deepEqual(S.SANDBOX_VENDORS.map((v) => v.name), ['Cisco', 'Fortinet', 'Palo Alto', 'Sophos', 'Check Point', 'pfSense', 'Network', 'Host']);
  assert.deepEqual(S.portNames('router', 2), ['g0/0', 'g0/1', 's0/0/0', 's0/0/1']);
  assert.deepEqual(S.portNames('fortios', 3), ['port1', 'port2', 'port3']);
  assert.deepEqual(S.portNames('panos', 2), ['e1/1', 'e1/2']);
  assert.deepEqual(S.portNames('pfsense', 2), ['em0', 'em1']);
  assert.deepEqual(S.portNames('checkpoint', 2), ['eth1', 'eth2']);
  assert.equal(S.portNames('sw2960', 8).length, 10, '8 FastEthernet + 2 uplink');
  assert.equal(S.portCount('sw2960', 13), 24, 'switch chỉ nhận 8/16/24/48');
  assert.equal(S.portCount('asa', 99), 8, 'kẹp trong min–max');
  const net = S.emptySandbox();
  const r = S.addNodes(net, 'router', { count: 3, prefix: 'HN-R', ports: 2 }, 100, 100);
  assert.deepEqual(r.ids, ['hn-r1', 'hn-r2', 'hn-r3']);
  assert.deepEqual(r.ids.map((id) => net.devices[id].name), ['HN-R1', 'HN-R2', 'HN-R3']);
  assert.deepEqual(Object.keys(net.devices['hn-r1'].ifaces), ['g0/0', 'g0/1', 's0/0/0', 's0/0/1']);
  assert.ok(r.ids.every((id) => S.isOff(net.devices[id]) && net.devices[id].kind === 'router'), 'node mới thêm ở trạng thái TẮT');
  assert.equal(S.addNodes(net, 'router', { count: 1, prefix: 'HN-R' }).ids[0], 'hn-r4', 'không trùng tên');
  assert.match(S.addNodes(net, 'pc', { count: 0 }).error, /1 đến 20/);
  assert.match(S.addNodes(net, 'pc', { prefix: '1abc' }).error, /Tiền tố/);
  assert.match(S.addNodes(net, 'nope').error, /mẫu/);
  const fg = S.addNodes(net, 'fortios', { ports: 6 }).ids[0];
  assert.deepEqual(Object.keys(net.devices[fg].ifaces), ['port1', 'port2', 'port3', 'port4', 'port5', 'port6']);
  const dup = S.duplicateDevice(net, 'hn-r1');
  assert.equal(net.devices[dup].kind, 'router');
  assert.deepEqual(Object.keys(net.devices[dup].ifaces), ['g0/0', 'g0/1', 's0/0/0', 's0/0/1'], 'nhân bản giữ số cổng');
});

test('workspace: Start / Stop / Wipe — thiết bị tắt thì link down, không gõ được lệnh; bật lại vẫn giữ cấu hình', () => {
  const net = S.emptySandbox();
  const [r1] = S.addNodes(net, 'router', {}).ids;
  const [pc] = S.addNodes(net, 'pc', {}).ids;
  S.connect(net, pc, 'fa0', r1, 'g0/0');
  const cli = createCli(net);
  assert.match(cli.exec(r1, 'enable').out.join('\n'), /TẮT/, 'thiết bị tắt không nhận lệnh');
  assert.equal(cli.complete(r1, 'conf'), null);
  assert.ok(!N.lineUp(net, pc, 'fa0'), 'đầu kia tắt → link down');
  const boot = S.startDevice(net, r1);
  assert.ok(boot.length >= 3 && boot.some((l) => /RESTART|Press RETURN/.test(l)), 'có log khởi động');
  assert.ok(!N.lineUp(net, r1, 'g0/0'), 'PC vẫn tắt → link vẫn down');
  assert.deepEqual(S.powerAll(net, true), [pc], 'Start all chỉ bật máy đang tắt');
  runScript(cli, r1, cfg('interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown'));
  runScript(cli, pc, ['ipconfig 10.0.0.10 255.255.255.0 10.0.0.1']);
  assert.ok(N.lineUp(net, pc, 'fa0') && N.sendPacket(net, { src: pc, dst: '10.0.0.1' }).ok);
  S.stopDevice(net, r1);
  assert.ok(!N.lineUp(net, pc, 'fa0'), 'Stop → link xuống');
  assert.ok(!N.sendPacket(net, { src: pc, dst: '10.0.0.1' }).ok, 'Stop → mất kết nối');
  S.startDevice(net, r1);
  assert.ok(N.sendPacket(net, { src: pc, dst: '10.0.0.1' }).ok, 'Start lại: cấu hình đang chạy được giữ');
  assert.deepEqual(S.powerAll(net, false).sort(), [pc, r1].sort(), 'Stop all');
  assert.ok(S.wipeDevice(net, r1));
  const w = net.devices[r1];
  assert.ok(S.isOff(w) && w.name === 'R1' && w.ifaces['g0/0'].ip === null, 'Wipe: cấu hình trống, giữ tên, để tắt');
  assert.ok(N.linkAt(net, r1, 'g0/0'), 'Wipe giữ dây');
  S.powerAll(net, true);
  assert.ok(!N.sendPacket(net, { src: pc, dst: '10.0.0.1' }).ok, 'sau Wipe phải cấu hình lại');
});

test('workspace: nhập JSON cũ (chưa có "kind"/"off") — thiết bị coi như đang chạy, dùng được ngay', () => {
  const net = S.emptySandbox();
  S.addDevice(net, 'router', 100, 100);
  S.addDevice(net, 'pc', 200, 100);
  S.connect(net, 'pc1', 'fa0', 'r1', 'g0/0');
  const old = JSON.parse(JSON.stringify(S.exportSandbox(net)));
  for (const d of Object.values(old.net.devices)) { delete d.kind; delete d.off; }
  const back = S.importSandbox(old);
  assert.ok(Object.values(back.devices).every((d) => !S.isOff(d)));
  assert.equal(S.kindOf(back.devices.r1), 'router');
  const cli = createCli(back);
  runScript(cli, 'r1', cfg('interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown'));
  runScript(cli, 'pc1', ['ipconfig 10.0.0.10 255.255.255.0 10.0.0.1']);
  assert.ok(N.sendPacket(back, { src: 'pc1', dst: '10.0.0.1' }).ok);
  // trạng thái tắt được lưu qua xuất / nhập
  S.stopDevice(back, 'r1');
  assert.ok(S.isOff(S.importSandbox(JSON.parse(JSON.stringify(S.exportSandbox(back)))).devices.r1));
});

test('Cloud / Internet: vẽ đám mây nhưng vẫn là server; tự nhận theo tên; JSON giữ cờ cloud (JSON cũ nhận theo tên)', () => {
  assert.equal(N.server('a', 'INTERNET 8.8.8.8', 0, 0).cloud, true);
  assert.equal(N.server('b', 'SRV-WEB', 0, 0).cloud, false);
  assert.equal(N.server('c', 'TFTP', 0, 0, { cloud: true }).cloud, true, 'cờ cloud đặt tay');
  assert.equal(N.isCloud(N.server('d', 'Internet-GW', 0, 0, { cloud: false })), false, 'cờ false thắng tên');
  assert.equal(N.isCloud(N.pc('e', 'INTERNET-PC', 0, 0)), false, 'chỉ server mới thành đám mây');
  const net = S.emptySandbox();
  const [cl] = S.addNodes(net, 'cloud', {}, 100, 100).ids;
  const [sw] = S.addNodes(net, 'sw2960', {}, 300, 100).ids;
  const [pc] = S.addNodes(net, 'pc', {}, 500, 100).ids;
  const d = net.devices[cl];
  assert.ok(d.type === 'server' && d.cloud && d.name === 'INTERNET1' && S.kindOf(d) === 'cloud');
  assert.deepEqual(S.physPorts(d), ['fa0'], 'đám mây có sẵn 1 cổng');
  assert.equal(N.topologyOf(net).devices.find((x) => x.id === cl).type, 'cloud', 'sơ đồ "Xem gói tin" vẽ đám mây');
  S.connect(net, cl, 'fa0', sw, 'fa0/1');
  S.connect(net, pc, 'fa0', sw, 'fa0/2');
  S.powerAll(net, true);
  const cli = createCli(net);
  runScript(cli, cl, ['ipconfig 8.8.8.8 255.255.255.0 8.8.8.1']);
  runScript(cli, pc, ['ipconfig 8.8.8.20 255.255.255.0 8.8.8.1']);
  assert.ok(N.sendPacket(net, { src: pc, dst: '8.8.8.8' }).ok, 'đặt IP/gateway và ping như server');
  assert.ok(N.sendPacket(net, { src: pc, dst: '8.8.8.8', proto: 'tcp', dport: 80 }).ok, 'vẫn mở dịch vụ web như server');
  const back = S.importSandbox(JSON.parse(JSON.stringify(S.exportSandbox(net))));
  assert.equal(back.devices[cl].cloud, true, 'JSON giữ cờ cloud');
  assert.equal(back.devices[pc].cloud, undefined);
  const old = JSON.parse(JSON.stringify(S.exportSandbox(net)));
  delete old.net.devices[cl].cloud;
  assert.ok(N.isCloud(S.importSandbox(old).devices[cl]), 'JSON cũ (chưa có cờ): tên chứa INTERNET → đám mây');
  S.wipeDevice(net, cl);
  assert.ok(net.devices[cl].cloud && !net.devices[cl].ip, 'Wipe giữ hình đám mây');
});
