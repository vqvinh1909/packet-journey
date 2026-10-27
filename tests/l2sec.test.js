// tests/l2sec.test.js — bảo mật L2 + thiết bị: DHCP snooping chặn DHCP giả + bảng binding, DAI, IP Source Guard,
// login block-for (quiet mode), AAA, security passwords, ip http server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lab/net.js';
import { createCli, runScript } from '../lab/ios.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
/** R1 (DHCP server thật, g0/0) — SW g0/1 ; PC1 fa0/1, PC2 fa0/2 (DHCP), PRN fa0/3 (IP tĩnh), ROGUE fa0/4 (router lạ có pool). */
function lan() {
  const net = N.makeNet([
    N.router('r1', 'R1', 0, 0, ['g0/0', 'g0/1']), N.router('rogue', 'WIFI-LA', 0, 0, ['g0/0']),
    N.sw('sw', 'SW', 0, 0, ['fa0/1', 'fa0/2', 'fa0/3', 'fa0/4', 'g0/1']),
    N.pc('pc1', 'PC1', 0, 0, { dhcp: true }), N.pc('pc2', 'PC2', 0, 0, { dhcp: true }),
    N.pc('prn', 'PRN', 0, 0, { ip: '10.1.1.50', gw: '10.1.1.1' }),
  ], [['r1', 'g0/0', 'sw', 'g0/1'], ['pc1', 'fa0', 'sw', 'fa0/1'], ['pc2', 'fa0', 'sw', 'fa0/2'], ['prn', 'fa0', 'sw', 'fa0/3'], ['rogue', 'g0/0', 'sw', 'fa0/4']]);
  const cli = createCli(net);
  runScript(cli, 'r1', cfg('interface g0/0', 'ip address 10.1.1.1 255.255.255.0', 'no shutdown', 'ip dhcp excluded-address 10.1.1.1 10.1.1.99', 'ip dhcp pool LAN', 'network 10.1.1.0 255.255.255.0', 'default-router 10.1.1.1'));
  runScript(cli, 'rogue', cfg('interface g0/0', 'ip address 192.168.0.1 255.255.255.0', 'no shutdown', 'ip dhcp pool HOME', 'network 192.168.0.0 255.255.255.0', 'default-router 192.168.0.1'));
  const run = (dev, ...l) => l.map((c) => cli.exec(dev, c).out.join('\n')).join('\n');
  return { net, cli, run, sw: net.devices.sw };
}
const ping = (net, s, d) => N.sendPacket(net, { src: s, dst: d, record: true }).ok;

test('DHCP giả gần hơn thắng server thật; DHCP snooping chặn OFFER từ cổng untrusted + ghi binding', () => {
  const { net, run, sw } = lan();
  run('pc1', 'ipconfig /renew');
  assert.match(net.devices.pc1.ip, /^192\.168\.0\./, 'không snooping: PC nhận IP của router lạ (gần hơn)');
  run('sw', ...cfg('ip dhcp snooping', 'ip dhcp snooping vlan 1'));
  run('pc1', 'ipconfig /renew');
  assert.match(net.devices.pc1.ip, /^169\.254\./, 'bật snooping mà chưa trust uplink → mọi OFFER bị chặn');
  run('sw', ...cfg('interface g0/1', 'ip dhcp snooping trust'));
  run('pc1', 'ipconfig /release', 'ipconfig /renew');
  run('pc2', 'ipconfig /renew');
  assert.equal(net.devices.pc1.ip, '10.1.1.100');
  assert.equal(net.devices.pc2.ip, '10.1.1.101');
  assert.deepEqual(sw.snoop.bindings.map((b) => [b.ip, b.port, b.vlan]), [['10.1.1.100', 'fa0/1', 1], ['10.1.1.101', 'fa0/2', 1]]);
  assert.match(run('sw', 'show ip dhcp snooping binding'), /10\.1\.1\.100\s+86400\s+dhcp-snooping\s+1\s+FastEthernet0\/1/);
  assert.match(run('sw', 'show logging'), /DHCP_SNOOPING_UNTRUSTED_PORT/);
  run('pc1', 'ipconfig /release');
  assert.equal(sw.snoop.bindings.length, 1, 'DHCPRELEASE xoá binding');
});

test('DAI: ARP không khớp binding bị hủy; trust uplink + ip source binding cho máy IP tĩnh', () => {
  const { net, run, sw } = lan();
  run('sw', ...cfg('ip dhcp snooping', 'ip dhcp snooping vlan 1', 'interface g0/1', 'ip dhcp snooping trust', 'exit', 'interface fa0/4', 'shutdown'));
  run('pc1', 'ipconfig /renew');
  assert.ok(ping(net, 'pc1', '10.1.1.1') && ping(net, 'prn', '10.1.1.1'));
  run('sw', ...cfg('ip arp inspection vlan 1'));
  const r = N.sendPacket(net, { src: 'pc1', dst: '10.1.1.1' });
  assert.ok(!r.ok && /DAI/.test(r.fail.why), 'uplink chưa trust: ARP Reply của router bị hủy');
  run('sw', ...cfg('interface g0/1', 'ip arp inspection trust'));
  assert.ok(ping(net, 'pc1', '10.1.1.1'), 'PC DHCP có binding → ARP hợp lệ');
  assert.ok(!ping(net, 'prn', '10.1.1.1'), 'máy in IP tĩnh không có binding → bị DAI chặn');
  assert.match(run('sw', 'show ip arp inspection vlan 1'), / 1\s+\d+\s+[1-9]/);
  run('sw', ...cfg(`ip source binding ${N.ciscoMac(N.epMac(net, { dev: 'prn', ifn: 'fa0' }))} vlan 1 10.1.1.50 interface fa0/3`));
  assert.ok(ping(net, 'prn', '10.1.1.1'), 'binding tĩnh cho máy in');
  assert.match(run('sw', 'show running-config'), /ip source binding \w{4}\.\w{4}\.\w{4} vlan 1 10\.1\.1\.50 interface FastEthernet0\/3/);
  // PC1 tự đổi sang IP tĩnh khác (giả mạo) → ARP không khớp binding
  run('pc1', 'ipconfig 10.1.1.77 255.255.255.0 10.1.1.1');
  assert.ok(!ping(net, 'pc1', '10.1.1.1'));
});

test('IP Source Guard: gói có IP nguồn không khớp binding của cổng bị hủy', () => {
  const { net, run } = lan();
  run('sw', ...cfg('ip dhcp snooping', 'ip dhcp snooping vlan 1', 'interface g0/1', 'ip dhcp snooping trust', 'exit', 'interface range fa0/1 - 3', 'ip verify source'));
  run('pc1', 'ipconfig /renew');
  assert.ok(ping(net, 'pc1', '10.1.1.1'));
  const r = N.sendPacket(net, { src: 'prn', dst: '10.1.1.1' });
  assert.ok(!r.ok && /IP Source Guard/.test(r.fail.why));
  run('pc2', 'ipconfig 10.1.1.100 255.255.255.0 10.1.1.1'); // dùng trộm IP của PC1
  assert.ok(!ping(net, 'pc2', '10.1.1.1'), 'IP đúng nhưng sai cổng → bị chặn');
  assert.match(run('sw', 'show ip verify source'), /Fa0\/1\s+ip\s+active\s+10\.1\.1\.100/);
});

test('login block-for: sai mật khẩu đủ số lần → quiet mode từ chối cả mật khẩu đúng; quiet-mode access-class', () => {
  const { net, run } = lan();
  let now = 1_000_000;
  const old = N.clock.now;
  N.clock.now = () => now;
  try {
    run('pc1', 'ipconfig 10.1.1.10 255.255.255.0 10.1.1.1');
    run('pc2', 'ipconfig 10.1.1.20 255.255.255.0 10.1.1.1');
    run('r1', ...cfg('ip domain-name lab.vn', 'crypto key generate rsa modulus 1024', 'security passwords min-length 8', 'username admin secret 123', 'username admin secret Admin@123',
      'aaa new-model', 'aaa authentication login default local', 'login block-for 60 attempts 3 within 30', 'access-list 10 permit host 10.1.1.20', 'login quiet-mode access-class 10', 'line vty 0 4', 'transport input ssh'));
    assert.match(run('r1', ...cfg('username x secret 123')), /Password too short/);
    assert.match(run('pc1', 'ssh -l admin 10.1.1.1', 'Admin@123'), /thành công/, 'aaa new-model: SSH dùng user local, không cần "login local"');
    for (let i = 0; i < 2; i++) assert.match(run('pc1', 'ssh -l admin 10.1.1.1', 'sai'), /Authentication failed/);
    assert.match(run('pc1', 'ssh -l admin 10.1.1.1', 'sai'), /QUIET MODE/);
    assert.match(run('pc1', 'ssh -l admin 10.1.1.1'), /refused/, 'quiet mode: từ chối cả khi chưa nhập mật khẩu');
    assert.match(run('pc2', 'ssh -l admin 10.1.1.1', 'Admin@123'), /thành công/, 'nguồn trong quiet-mode access-class vẫn vào được');
    assert.match(run('r1', 'show login'), /presently in Quiet-Mode/);
    now += 61_000;
    assert.match(run('pc1', 'ssh -l admin 10.1.1.1', 'Admin@123'), /thành công/, 'hết block-for');
    assert.match(run('r1', 'show running-config'), /login block-for 60 attempts 3 within 30[\s\S]*aaa|aaa new-model/);
  } finally { N.clock.now = old; }
});

test('ip http server mở cổng 80 trên router; no ip http server đóng lại', () => {
  const { net, run } = lan();
  run('pc1', 'ipconfig 10.1.1.10 255.255.255.0 10.1.1.1');
  const tcp = (p) => N.sendPacket(net, { src: 'pc1', dst: '10.1.1.1', proto: 'tcp', dport: p }).ok;
  assert.ok(!tcp(80));
  run('r1', ...cfg('ip http server'));
  assert.ok(tcp(80));
  run('r1', ...cfg('no ip http server'));
  assert.ok(!tcp(80));
});
