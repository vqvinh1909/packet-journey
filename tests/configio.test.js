// tests/configio.test.js — xuất tất cả cấu hình ra .txt, nạp lại (dán / file) tách theo thiết bị, "Đặt làm
// startup-config" cho cả mạng và Wipe quay về startup-config.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli, runScript } from '../lab/ios.js';
import * as S from '../lab/sandbox.js';
import * as N from '../lab/net.js';
import * as IO from '../lab/configio.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
function build() {
  const net = S.emptySandbox();
  const r1 = S.addDevice(net, 'router', 100, 100), sw = S.addDevice(net, 'sw2960', 200, 200);
  const pc1 = S.addDevice(net, 'pc', 100, 300), pc2 = S.addDevice(net, 'pc', 300, 300), fgt = S.addDevice(net, 'fortios', 400, 100);
  delete net.devices[pc2].shell; // PC kiểu Windows
  S.connect(net, r1, 'g0/0', sw, 'fa0/1');
  S.connect(net, pc1, 'fa0', sw, 'fa0/2');
  S.connect(net, pc2, 'fa0', sw, 'fa0/3');
  return { net, ids: { r1, sw, pc1, pc2, fgt } };
}
function configure(net) {
  const cli = createCli(net);
  runScript(cli, 'r1', cfg('interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown', 'exit', 'router ospf 1', 'network 10.0.0.0 0.0.0.255 area 0'));
  runScript(cli, 'sw1', cfg('interface fa0/2', 'description PC1-SALES', 'switchport mode access'));
  cli.exec('pc1', 'ip 10.0.0.10/24 10.0.0.1');
  cli.exec('pc1', 'ip dns 8.8.8.8');
  cli.exec('pc2', 'ipconfig 10.0.0.20 255.255.255.0 10.0.0.1');
  return cli;
}

test('xuất: mỗi thiết bị 1 khối có tiêu đề; IOS = running-config, VPCS = startup.vpc, PC Windows = ipconfig; hãng chưa hỗ trợ được ghi chú', () => {
  const { net } = build();
  const cli = configure(net);
  const { text, skipped } = IO.exportConfigs(net, cli);
  assert.match(text, /! ===== Thiết bị: R1 \(Cisco router\) =====\n[\s\S]*hostname R1[\s\S]*interface GigabitEthernet0\/0\n ip address 10\.0\.0\.1 255\.255\.255\.0[\s\S]*router ospf 1/);
  assert.match(text, /! ===== Thiết bị: SW1 \(Cisco switch\) =====[\s\S]*interface FastEthernet0\/2\n description PC1-SALES/);
  assert.match(text, /! ===== Thiết bị: PC1 \(VPCS\) =====\nset pcname PC1\nip 10\.0\.0\.10\/24 10\.0\.0\.1\nip dns 8\.8\.8\.8/);
  assert.match(text, /! ===== Thiết bị: PC2 \(PC\) =====\nipconfig 10\.0\.0\.20 255\.255\.255\.0 10\.0\.0\.1/);
  assert.deepEqual(skipped, ['FGT1']);
  assert.doesNotMatch(text, /Building configuration/);
});

test('nạp: file do app xuất nạp vào mạng mới (cùng tên thiết bị) → cấu hình giống hệt, ping được', () => {
  const a = build();
  const { text } = IO.exportConfigs(a.net, configure(a.net));
  const b = build();
  const cli = createCli(b.net);
  const rep = IO.importConfigs(b.net, cli, text);
  const by = Object.fromEntries(rep.map((r) => [r.name, r]));
  for (const n of ['R1', 'SW1', 'PC1', 'PC2']) assert.ok(by[n]?.ok, n + ' ' + JSON.stringify(by[n]));
  assert.ok(!by.FGT1, 'khối chỉ có chú thích thì bỏ qua');
  assert.equal(b.net.devices.r1.ifaces['g0/0'].ip, '10.0.0.1');
  assert.equal(b.net.devices.sw1.ports['fa0/2'].desc, 'PC1-SALES');
  assert.equal(b.net.devices.pc1.ip, '10.0.0.10');
  assert.equal(b.net.devices.pc2.gateway, '10.0.0.1');
  assert.ok(N.sendPacket(b.net, { src: 'pc1', dst: '10.0.0.1' }).ok);
  assert.deepEqual(IO.exportConfigs(b.net, cli).text, IO.exportConfigs(a.net, createCli(a.net)).text, 'xuất lại ra đúng file cũ');
  assert.equal(cli.session('r1').mode, 'user', 'nạp xong trả phiên console về như cũ');
});

test('nạp: dán nhiều show run liền nhau (tách theo hostname), báo dòng lỗi, thiết bị không có / đang tắt', () => {
  const { net } = build();
  const cli = createCli(net);
  const paste = [
    'R1#show running-config', 'Building configuration...', '', 'Current configuration : 1200 bytes', '!', 'version 15.5', 'hostname R1', '!',
    'interface GigabitEthernet0/0', ' description UPLINK', ' ip address 192.168.1.1 255.255.255.0', ' ip adress sai', '!', 'end',
    'hostname SW1', 'interface fa0/5', ' description KT', 'end',
    'hostname R9', 'interface g0/0', 'end',
  ].join('\n');
  assert.deepEqual(IO.splitConfigs(paste).map((b) => b.name), ['R1', 'SW1', 'R9']);
  S.stopDevice(net, 'sw1');
  const rep = IO.importConfigs(net, cli, paste);
  const by = Object.fromEntries(rep.map((r) => [r.name, r]));
  assert.equal(net.devices.r1.ifaces['g0/0'].ip, '192.168.1.1');
  assert.equal(net.devices.r1.ifaces['g0/0'].desc, 'UPLINK');
  assert.deepEqual(by.R1.errors, ['ip adress sai']);
  assert.equal(by.R1.ok, false);
  assert.match(by.SW1.note, /đang tắt/);
  assert.match(by.R9.note, /không có thiết bị/);
});

test('Đặt làm startup-config (cả mạng) → đổi tiếp → Wipe quay về startup-config; chưa lưu thì Wipe về trống', () => {
  const { net } = build();
  const cli = configure(net);
  assert.equal(IO.saveAllStartup(net, cli), 3, 'R1, SW1 (write memory) + PC1 (VPCS save)');
  runScript(cli, 'r1', cfg('interface g0/0', 'ip address 10.9.9.1 255.255.255.0', 'exit', 'hostname EDGE'));
  cli.exec('pc1', 'ip 10.0.0.99/24 10.0.0.1');
  S.wipeDevice(net, 'r1');
  S.wipeDevice(net, 'pc1');
  assert.equal(net.devices.r1.name, 'R1');
  assert.equal(net.devices.r1.ifaces['g0/0'].ip, '10.0.0.1', 'Wipe → cấu hình đã lưu');
  assert.ok(net.devices.r1.ospf, 'OSPF trong startup-config');
  assert.ok(net.devices.r1.off, 'Wipe xong thiết bị tắt như trước');
  assert.equal(net.devices.pc1.ip, '10.0.0.10');
  const r2 = S.addDevice(net, 'router', 500, 500);
  runScript(cli, r2, cfg('interface g0/0', 'ip address 1.1.1.1 255.255.255.0'));
  S.wipeDevice(net, r2);
  assert.equal(net.devices[r2].ifaces['g0/0'].ip, null, 'chưa lưu → Wipe về trống');
});
