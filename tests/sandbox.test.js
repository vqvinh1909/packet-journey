// tests/sandbox.test.js — chế độ "Tự dựng mạng riêng": thêm/xoá/nối dây, xuất-nhập JSON, nhiệm vụ hướng dẫn,
// workspace kiểu EVE-NG (mẫu theo hãng, Add node, Start/Stop/Wipe, JSON cũ).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli, runScript } from '../lab/ios.js';
import { checkLab } from '../lab/labs.js';
import * as S from '../lab/sandbox.js';
import * as N from '../lab/net.js';
import { apJoined, clientTest } from '../lab/wlc.js';
import { sandboxToUnl } from '../lab/unl.js';
import { diagramFromSandbox, sandboxFromDiagram } from '../lab/diagram-bridge.js';

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
  runScript(cli, 'pc1', ['ip 192.168.1.20/24 192.168.1.1']);
  runScript(cli, 'pc2', ['ip dhcp']);
  runScript(cli, 'pc3', ['ip 192.168.2.20/24 192.168.2.1']);
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
  runScript(cli, pc, ['ip 10.1.1.10/24 10.1.1.1']);
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
  assert.deepEqual(S.SANDBOX_VENDORS.map((v) => v.name), ['Cisco', 'Fortinet', 'Palo Alto', 'Sophos', 'Check Point', 'pfSense', 'Network', 'Host', 'Máy chủ dịch vụ', 'Quản trị mạng', 'Wi-Fi']);
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
  runScript(cli, pc, ['ip 10.0.0.10/24 10.0.0.1']);
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
  runScript(cli, 'pc1', ['ip 10.0.0.10/24 10.0.0.1']);
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
  runScript(cli, pc, ['ip 8.8.8.20/24 8.8.8.1']);
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

test('TTL gốc như thiết bị thật: VPCS 64 (qua 1 router còn 63), PC kiểu Windows 128 (còn 127)', () => {
  const net = S.emptySandbox();
  const r = S.addDevice(net, 'router', 300, 100), a = S.addDevice(net, 'pc', 100, 300), b = S.addDevice(net, 'pc', 500, 300);
  S.connect(net, a, 'fa0', r, 'g0/0');
  S.connect(net, b, 'fa0', r, 'g0/1');
  const cli = createCli(net);
  runScript(cli, r, ['enable', 'configure terminal', 'interface g0/0', 'ip address 10.1.0.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.2.0.1 255.255.255.0', 'no shutdown', 'end']);
  cli.exec(a, 'ip 10.1.0.10/24 10.1.0.1');
  cli.exec(b, 'ip 10.2.0.10/24 10.2.0.1');
  assert.match(cli.exec(a, 'ping 10.2.0.10').out.join('\n'), /ttl=63/);
  delete net.devices[b].shell; // PC2 kiểu Windows trả lời với TTL gốc 128
  assert.match(cli.exec(a, 'ping 10.2.0.10').out.join('\n'), /ttl=127/);
});

test('máy chủ dịch vụ: đúng cổng mở, SSH đăng nhập được, NTP đồng bộ, giữ nguyên qua wipe và xuất/nhập', () => {
  const net = S.emptySandbox();
  const r = S.addDevice(net, 'router', 100, 100), sw = S.addDevice(net, 'sw2960', 300, 100);
  const web = S.addDevice(net, 'web', 500, 100), ssh = S.addDevice(net, 'ssh', 600, 100), ntp = S.addDevice(net, 'ntp', 700, 100);
  assert.equal(S.connect(net, r, 'g0/0', sw, 'g0/1'), null);
  [web, ssh, ntp].forEach((id, i) => assert.equal(S.connect(net, id, 'fa0', sw, `fa0/${i + 1}`), null));
  const cli = createCli(net);
  runScript(cli, r, cfg('interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown', 'exit', 'ntp server 10.0.0.12'));
  [web, ssh, ntp].forEach((id, i) => cli.exec(id, `ipconfig 10.0.0.${10 + i} 255.255.255.0 10.0.0.1`));
  assert.match(cli.exec(r, 'telnet 10.0.0.10 443').out.join('\n'), /Open/);
  assert.match(cli.exec(r, 'telnet 10.0.0.10 22').out.join('\n'), /refused/);
  assert.match(cli.exec(web, 'ssh -l admin 10.0.0.11').simLabel, /SSH/);
  assert.match(cli.exec(web, 'admin').out.join('\n'), /thành công/);
  cli.exec(web, 'ssh -l admin 10.0.0.11');
  assert.match(cli.exec(web, 'sai').out.join('\n'), /Authentication failed/);
  assert.match(cli.exec(r, 'show ntp status').out.join('\n'), /(?<!un)synchronized/i);
  assert.deepEqual(S.bootLog(net.devices[web]), S.SANDBOX_KINDS.web.note);
  S.wipeDevice(net, web);
  assert.deepEqual(net.devices[web].services, [80, 443]);
  assert.equal(net.devices[web].ip, '');
  const back = S.importSandbox(JSON.parse(JSON.stringify(S.exportSandbox(net))));
  assert.equal(S.kindOf(back.devices[web]), 'web');
  assert.equal(back.devices[web].badge, 'WEB');
  assert.match(sandboxToUnl(net), /template="linux"/, 'máy chủ dịch vụ xuất EVE-NG là Linux, không phải router');
});

test('Wi-Fi trong sandbox: dựng WLC, AP, RADIUS từ đầu, máy khách 802.1X vào đúng VLAN', () => {
  const net = S.emptySandbox();
  const sw = S.addDevice(net, 'sw3560', 400, 100), wlc = S.addDevice(net, 'wlc', 100, 100), rad = S.addDevice(net, 'radius', 700, 100), ap = S.addDevice(net, 'ap', 400, 300);
  S.connect(net, sw, 'g0/1', wlc, 'fa0'); S.connect(net, sw, 'g0/2', rad, 'fa0'); S.connect(net, sw, 'fa0/1', ap, 'fa0');
  assert.ok(net.devices[ap].isAp && net.devices[wlc].os === 'wlc');
  const svi = (v, ip) => [`vlan ${v}`, 'exit', `interface vlan ${v}`, `ip address ${ip} 255.255.255.0`, 'no shutdown', 'exit'];
  const cli = createCli(net);
  runScript(cli, sw, cfg('ip routing', ...svi(10, '10.10.0.1'), ...svi(20, '10.20.0.1'), ...svi(40, '10.40.0.1'), ...svi(99, '10.99.0.1'),
    'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'exit',
    'interface g0/2', 'switchport mode access', 'switchport access vlan 40', 'exit',
    'interface g0/1', 'switchport trunk encapsulation dot1q', 'switchport mode trunk', 'switchport trunk native vlan 99', 'exit'));
  N.clockConverge?.(net);
  cli.exec(ap, 'ip 10.10.0.11/24 10.10.0.1');
  cli.exec(rad, 'ipconfig 10.40.0.50 255.255.255.0 10.40.0.1');
  cli.exec(rad, 'radius secret BiMat#1');
  cli.exec(rad, 'radius user nv01 MatKhau1');
  assert.match(cli.exec(rad, 'radius show').out.join('\n'), /đã đặt[\s\S]*nv01/);
  assert.doesNotMatch(cli.exec(rad, 'radius show').out.join('\n'), /BiMat|MatKhau1/, 'không in lộ bí mật');
  for (const c of ['mgmt ip=10.99.0.10/24 gw=10.99.0.1', 'if add vlan20 vlan=20 ip=10.20.0.5/24 gw=10.20.0.1', 'radius add 10.40.0.50 secret=BiMat#1', 'wlan add 1 ssid=NV iface=vlan20 sec=wpa2-ent radius=10.40.0.50', 'wlan on 1']) assert.doesNotMatch(cli.exec(wlc, c).out.join('\n'), /ERROR/, c);
  assert.ok(apJoined(net, net.devices[wlc], ap), 'AP join WLC');
  assert.equal(clientTest(net, net.devices[wlc], { ssid: 'NV', user: 'nv01', pass: 'sai' }).step, 'auth');
  const ok = clientTest(net, net.devices[wlc], { ssid: 'NV', user: 'nv01', pass: 'MatKhau1' });
  assert.ok(ok.ok && ok.vlan === 20, ok.why);
  const back = S.importSandbox(JSON.parse(JSON.stringify(S.exportSandbox(net))));
  assert.ok(clientTest(back, back.devices[wlc], { ssid: 'NV', user: 'nv01', pass: 'MatKhau1' }).ok, 'xuất/nhập giữ cấu hình Wi-Fi');
  const dup = S.duplicateDevice(net, wlc);
  assert.deepEqual(net.devices[dup].wlc.wlans, {}, 'nhân bản WLC để trống');
  S.wipeDevice(net, ap);
  assert.ok(net.devices[ap].isAp && net.devices[ap].shell === 'vpcs' && !net.devices[ap].ip);
  S.wipeDevice(net, rad);
  assert.equal(net.devices[rad].radius.secret, '');
  S.wipeDevice(net, wlc);
  assert.equal(net.devices[wlc].os, 'wlc');
  assert.deepEqual(net.devices[wlc].wlc.wlans, {});
});

test('sơ đồ ↔ sandbox: giữ loại máy chủ dịch vụ và thiết bị Wi-Fi', () => {
  const net = S.emptySandbox();
  for (const k of ['web', 'dns', 'db', 'syslog', 'nms', 'wlc', 'ap', 'lb']) S.addDevice(net, k, 100, 100);
  const kinds = Object.values(sandboxFromDiagram(diagramFromSandbox(net)).devices).map(S.kindOf);
  assert.deepEqual(kinds.sort(), ['ap', 'db', 'dns', 'lb', 'nms', 'syslog', 'web', 'wlc']);
});

const linuxLan = () => {
  const net = S.emptySandbox();
  const r = S.addDevice(net, 'router', 100, 100), sw1 = S.addDevice(net, 'sw2960', 300, 100), sw2 = S.addDevice(net, 'sw2960', 300, 300);
  const a = S.addDevice(net, 'linux', 500, 100), b = S.addDevice(net, 'linux', 500, 300), dns = S.addDevice(net, 'dns', 600, 100);
  S.connect(net, r, 'g0/0', sw1, 'g0/1'); S.connect(net, r, 'g0/1', sw2, 'g0/1');
  S.connect(net, a, 'fa0', sw1, 'fa0/1'); S.connect(net, dns, 'fa0', sw1, 'fa0/2'); S.connect(net, b, 'fa0', sw2, 'fa0/1');
  const cli = createCli(net);
  runScript(cli, r, cfg('interface g0/0', 'ip address 10.0.1.1 255.255.255.0', 'no shutdown', 'exit', 'interface g0/1', 'ip address 10.0.2.1 255.255.255.0', 'no shutdown'));
  for (const [id, ip, gw] of [[a, '10.0.1.10/24', '10.0.1.1'], [b, '10.0.2.10/24', '10.0.2.1']]) {
    assert.deepEqual(cli.exec(id, `ip addr add ${ip} dev eth0`).out, []);
    assert.deepEqual(cli.exec(id, `ip route add default via ${gw}`).out, []);
  }
  cli.exec(dns, 'ipconfig 10.0.1.53 255.255.255.0 10.0.1.1');
  return { net, cli, r, a, b, dns };
};
const say = (cli, id, line) => cli.exec(id, line).out.join('\n');

test('Linux: đặt IP, route, ping qua router; dấu nhắc và lỗi gateway sai subnet', () => {
  const { cli, a, b } = linuxLan();
  assert.match(cli.prompt(a), /^root@LNX1:~# $/);
  assert.match(say(cli, a, 'ip a'), /inet 10\.0\.1\.10\/24/);
  assert.match(say(cli, a, 'ip route'), /default via 10\.0\.1\.1 dev eth0/);
  assert.match(say(cli, a, 'ping -c 2 10.0.2.10'), /icmp_seq=2 ttl=63[\s\S]*2 received/);
  assert.match(say(cli, a, 'traceroute 10.0.2.10'), /10\.0\.1\.1/);
  cli.exec(a, 'ip route del default');
  assert.match(say(cli, a, 'ping 10.0.2.10'), /Network is unreachable/);
  assert.match(say(cli, a, 'ip route add default via 10.9.9.1'), /invalid gateway/);
  assert.match(say(cli, a, 'lenhla'), /command not found/);
  assert.match(say(cli, b, 'sudo whoami'), /root/);
  // tới chính mình đi qua loopback: ufw không chặn, chỉ phụ thuộc dịch vụ
  cli.exec(b, 'ufw enable');
  assert.match(say(cli, b, 'ping -c 1 localhost'), /1 received/);
  assert.match(say(cli, b, 'ping -c 1 10.0.2.10'), /1 received/);
  assert.match(say(cli, b, 'curl localhost'), /\(7\).*refused/);
  cli.exec(b, 'systemctl start nginx');
  assert.match(say(cli, b, 'curl http://127.0.0.1'), /200 OK/);
  assert.match(say(cli, b, 'nc -zv 10.0.2.10 22'), /succeeded/);
});

test('Linux: dịch vụ tắt thì refused, ufw chặn thì timeout, luật theo nguồn có hiệu lực', () => {
  const { net, cli, a, b } = linuxLan();
  assert.match(say(cli, a, 'curl http://10.0.2.10'), /\(7\).*refused/, 'nginx chưa chạy');
  cli.exec(b, 'systemctl start nginx');
  assert.match(say(cli, b, 'ss -tulnp'), /0\.0\.0\.0:80 .*nginx/);
  assert.match(say(cli, b, 'systemctl status nginx'), /active \(running\)/);
  assert.match(say(cli, a, 'curl 10.0.2.10'), /200 OK/);
  assert.match(say(cli, a, 'nc -zv 10.0.2.10 22'), /succeeded/);
  // bật ufw chưa có luật: mọi kết nối vào bị bỏ im lặng, ping vẫn qua
  assert.equal(cli.exec(b, 'ufw enable').why.includes('22'), true);
  const blocked = cli.exec(a, 'curl 10.0.2.10');
  assert.match(blocked.out.join('\n'), /\(28\).*timed out/);
  assert.match(blocked.why, /ufw/);
  assert.match(say(cli, a, 'ping -c 1 10.0.2.10'), /1 received/);
  cli.exec(b, 'ufw allow from 10.0.1.0/24 to any port 80');
  assert.match(say(cli, a, 'curl 10.0.2.10'), /200 OK/);
  assert.match(say(cli, a, 'nc -zv 10.0.2.10 22'), /timed out/, 'luật chỉ mở cổng 80');
  cli.exec(b, 'ufw deny from 10.0.1.10');
  assert.match(say(cli, b, 'ufw status numbered'), /\[2\] Anywhere  DENY IN  10\.0\.1\.10/);
  assert.match(say(cli, a, 'curl 10.0.2.10'), /200 OK/, 'luật đầu tiên khớp thắng');
  cli.exec(b, 'ufw delete 1');
  assert.match(say(cli, a, 'curl 10.0.2.10'), /\(28\)/);
  cli.exec(b, 'ufw disable');
  cli.exec(b, 'systemctl stop nginx');
  assert.match(say(cli, a, 'curl 10.0.2.10'), /\(7\)/);
  // SSH thật qua sshConnect
  cli.exec(a, 'ssh admin@10.0.2.10');
  assert.equal(cli.prompt(a), 'Password: ');
  assert.match(say(cli, a, 'admin'), /thành công/);
  assert.match(cli.prompt(a), /^root@/);
  // ufw và dịch vụ được giữ qua xuất/nhập, wipe về mặc định
  cli.exec(b, 'ufw enable');
  const back = S.importSandbox(JSON.parse(JSON.stringify(S.exportSandbox(net))));
  assert.equal(S.kindOf(back.devices[b]), 'linux');
  assert.equal(back.devices[b].ufw.on, true);
  S.wipeDevice(net, b);
  assert.equal(net.devices[b].ufw.on, false);
  assert.equal(net.devices[b].shell, 'linux');
  assert.deepEqual(net.devices[b].services, [22]);
});

test('Linux hỏi DNS: máy chủ DNS có bảng tên thật, curl theo tên, sai máy chủ thì timeout', () => {
  const { cli, a, b, dns } = linuxLan();
  cli.exec(b, 'systemctl start nginx');
  assert.match(say(cli, a, 'dig web.lab'), /no servers could be reached/);
  assert.match(cli.exec(a, 'curl web.lab').out.join('\n'), /\(6\) Could not resolve host/);
  cli.exec(a, 'resolvectl dns eth0 10.0.1.53');
  assert.match(say(cli, a, 'cat /etc/resolv.conf'), /nameserver 10\.0\.1\.53/);
  assert.match(say(cli, a, 'dig web.lab'), /NXDOMAIN/);
  cli.exec(dns, 'dns add web.lab 10.0.2.10');
  assert.match(say(cli, dns, 'dns show'), /web\.lab  A  10\.0\.2\.10/);
  assert.equal(say(cli, a, 'dig web.lab +short'), '10.0.2.10');
  assert.match(say(cli, a, 'nslookup WEB.lab'), /Address: 10\.0\.2\.10/);
  assert.match(say(cli, a, 'curl http://web.lab'), /200 OK/);
  assert.match(say(cli, a, 'ping -c 1 web.lab'), /1 received/);
  assert.match(say(cli, a, 'dig web.lab @10.0.2.10'), /no servers could be reached/, 'máy kia không chạy DNS');
  assert.match(say(cli, dns, 'ipconfig'), /10\.0\.1\.53/, 'máy DNS vẫn dùng dòng lệnh thường');
});

const lbLan = () => {
  const net = S.emptySandbox();
  const r = S.addDevice(net, 'router', 100, 100), sw1 = S.addDevice(net, 'sw2960', 300, 100), sw2 = S.addDevice(net, 'sw2960', 300, 300);
  const c = S.addDevice(net, 'linux', 500, 100), lb = S.addDevice(net, 'lb', 600, 100), w1 = S.addDevice(net, 'web', 500, 300), w2 = S.addDevice(net, 'linux', 600, 300);
  S.connect(net, r, 'g0/0', sw1, 'g0/1'); S.connect(net, r, 'g0/1', sw2, 'g0/1');
  S.connect(net, c, 'fa0', sw1, 'fa0/1'); S.connect(net, lb, 'fa0', sw1, 'fa0/2'); S.connect(net, w1, 'fa0', sw2, 'fa0/1'); S.connect(net, w2, 'fa0', sw2, 'fa0/2');
  const cli = createCli(net);
  runScript(cli, r, cfg('interface g0/0', 'ip address 10.0.1.1 255.255.255.0', 'no shutdown', 'exit', 'interface g0/1', 'ip address 10.0.2.1 255.255.255.0', 'no shutdown'));
  for (const [id, ip, gw] of [[c, '10.0.1.10/24', '10.0.1.1'], [lb, '10.0.1.100/24', '10.0.1.1'], [w2, '10.0.2.12/24', '10.0.2.1']]) { cli.exec(id, `ip addr add ${ip} dev eth0`); cli.exec(id, `ip route add default via ${gw}`); }
  cli.exec(w1, 'ipconfig 10.0.2.11 255.255.255.0 10.0.2.1');
  cli.exec(w2, 'systemctl start nginx');
  return { net, cli, c, lb, w1, w2 };
};

test('Load Balancer: chia đều, backend chết thì bỏ qua, hết backend thì 503, cấu hình được giữ lại', () => {
  const { net, cli, c, lb, w1, w2 } = lbLan();
  assert.match(say(cli, c, 'curl 10.0.1.100'), /\(7\).*refused/, 'chưa có frontend');
  assert.match(say(cli, lb, 'lb show'), /Chưa có frontend/);
  assert.match(say(cli, c, 'lb show'), /command not found/, 'máy Linux thường không có lệnh lb');
  cli.exec(lb, 'lb add 80 10.0.2.11');
  cli.exec(lb, 'lb add 80 10.0.2.12');
  assert.match(say(cli, lb, 'ss -tulnp'), /0\.0\.0\.0:80 .*"lb"/);
  assert.match(say(cli, lb, 'lb show'), /10\.0\.2\.11:80  UP[\s\S]*10\.0\.2\.12:80  UP/);
  const hit = () => say(cli, c, 'curl 10.0.1.100').match(/Server: (\S+)/)[1];
  assert.deepEqual([hit(), hit(), hit(), hit()], ['WEB1', 'LNX2', 'WEB1', 'LNX2'], 'round robin');
  assert.match(say(cli, c, 'curl 10.0.1.100'), /Via: LB1[\s\S]*X-Forwarded-For: 10\.0\.1\.10/);
  // dịch vụ tắt → health check DOWN → không chia vào nữa
  cli.exec(w2, 'systemctl stop nginx');
  assert.match(say(cli, lb, 'lb show'), /10\.0\.2\.12:80  DOWN/);
  assert.deepEqual([hit(), hit()], ['WEB1', 'WEB1']);
  // ufw trên backend chặn LB cũng thành DOWN; mở đúng nguồn LB thì sống lại
  cli.exec(w2, 'systemctl start nginx');
  cli.exec(w2, 'ufw enable');
  assert.match(say(cli, lb, 'lb show'), /10\.0\.2\.12:80  DOWN/);
  cli.exec(w2, 'ufw allow from 10.0.1.100 to any port 80');
  assert.match(say(cli, lb, 'lb show'), /10\.0\.2\.12:80  UP/);
  // chia theo nguồn: một client luôn vào một backend
  cli.exec(lb, 'lb algo 80 source');
  assert.equal(new Set([hit(), hit(), hit()]).size, 1);
  // tắt hết backend: LB vẫn nghe nhưng trả 503
  S.stopDevice(net, w1); S.stopDevice(net, w2);
  const dead = cli.exec(c, 'curl 10.0.1.100');
  assert.match(dead.out.join('\n'), /503/);
  assert.equal(dead.ok, false);
  assert.match(say(cli, c, 'nc -zv 10.0.1.100 80'), /succeeded/);
  // lưu / nhập lại, wipe
  S.startDevice(net, w1);
  const back = S.importSandbox(JSON.parse(JSON.stringify(S.exportSandbox(net))));
  assert.equal(S.kindOf(back.devices[lb]), 'lb');
  assert.equal(back.devices[lb].lb[80].backends.length, 2);
  assert.ok(say(createCli(back), c, 'curl 10.0.1.100').includes('Server: WEB1'));
  cli.exec(lb, 'lb del 80 10.0.2.11');
  cli.exec(lb, 'lb del 80 10.0.2.12');
  assert.match(say(cli, c, 'curl 10.0.1.100'), /\(7\)/, 'xoá hết backend thì đóng cổng nghe');
  S.wipeDevice(net, lb);
  assert.deepEqual(net.devices[lb].lb, {});
  assert.equal(S.bootLog(net.devices[lb]), S.SANDBOX_KINDS.lb.note);
});

test('curl cũng dùng được từ máy kiểu Windows và Server thường', () => {
  const { cli, lb, w1 } = lbLan();
  cli.exec(lb, 'lb add 8080 10.0.2.11:80');
  assert.match(say(cli, lb, 'lb show'), /Frontend :8080[\s\S]*10\.0\.2\.11:80  UP/);
  assert.match(say(cli, w1, 'curl http://10.0.1.100:8080'), /Server: WEB1/);
});
