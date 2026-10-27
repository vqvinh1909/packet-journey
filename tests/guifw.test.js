// tests/guifw.test.js — firewall cấu hình bằng web (lab/guifw.js): Sophos, Check Point, pfSense.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lab/net.js';
import { createCli, runScript } from '../lab/ios.js';
import { pending } from '../lab/guifw.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
/** PC-IN — FW(lan, wan, dmz) — ISP — SRV 8.8.8.8 ; WEB ở DMZ. ISP không có route về LAN (phải NAT). */
function net3(os, [lan, wan, dmz]) {
  const net = N.makeNet([
    N.firewall('fw', 'FW', 0, 0, [lan, wan, dmz], os), N.router('isp', 'ISP', 0, 0, ['g0/0', 'g0/1']),
    N.pc('pin', 'PC-IN', 0, 0, { ip: '10.1.1.10', gw: '10.1.1.1' }),
    N.server('web', 'WEB', 0, 0, { ip: '172.16.1.10', gw: '172.16.1.1', services: [22, 80] }),
    N.server('srv', 'SRV', 0, 0, { ip: '8.8.8.8', gw: '8.8.8.1', services: [23, 80] }),
  ], [['pin', 'fa0', 'fw', lan], ['fw', wan, 'isp', 'g0/0'], ['fw', dmz, 'web', 'fa0'], ['isp', 'g0/1', 'srv', 'fa0']]);
  const cli = createCli(net);
  runScript(cli, 'isp', cfg('interface g0/0', 'ip address 203.0.113.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown'));
  const run = (...l) => l.map((c) => cli.exec('fw', c).out.join('\n'));
  return { net, run, fw: net.devices.fw };
}
const tcp = (net, s, d, p) => N.sendPacket(net, { src: s, dst: d, proto: 'tcp', dport: p }).ok;

test('Sophos: thay đổi có hiệu lực ngay; rule theo zone + MASQ; không rule → chặn', () => {
  const { net, run, fw } = net3('sophos', ['port1', 'port2', 'port3']);
  run('if port1 ip=10.1.1.1/24 zone=LAN', 'if port2 ip=203.0.113.2/24 zone=WAN', 'if port3 ip=172.16.1.1/24 zone=DMZ', 'gw 203.0.113.1');
  assert.ok(!tcp(net, 'pin', '8.8.8.8', 80), 'chưa có rule → chặn');
  const out = run('rule add Out from=LAN to=WAN src=10.1.1.0/24 svc=HTTP action=accept nat=masq');
  assert.deepEqual(out, ['']);
  assert.ok(!pending(fw));
  assert.ok(tcp(net, 'pin', '8.8.8.8', 80), 'web ra ngoài qua MASQ');
  assert.ok(!tcp(net, 'pin', '8.8.8.8', 23), 'telnet không có trong rule');
  assert.ok(!tcp(net, 'pin', '172.16.1.10', 80), 'LAN → DMZ chưa có rule');
  assert.match(run('rule add Bad from=LAN svc=NOPE')[0], /^ERROR: dịch vụ "NOPE"/);
});

test('Check Point: sửa rulebase chỉ có hiệu lực sau Install Policy', () => {
  const { net, run, fw } = net3('checkpoint', ['eth2', 'eth1', 'eth3']);
  run('if eth2 ip=10.1.1.1/24 zone=internal', 'if eth1 ip=203.0.113.2/24 zone=external', 'if eth3 ip=172.16.1.1/24 zone=dmz', 'gw 203.0.113.1', 'install');
  run('obj LAN 10.1.1.0/24', 'rule add Out src=LAN svc=HTTP action=accept', 'nat add HIDE type=snat from=any to=external src=LAN');
  assert.ok(pending(fw));
  assert.ok(!tcp(net, 'pin', '8.8.8.8', 80), 'chưa install → gateway chạy policy cũ');
  run('install');
  assert.ok(!pending(fw));
  assert.ok(tcp(net, 'pin', '8.8.8.8', 80), 'sau install: Hide NAT + rule');
});

test('pfSense: rule mặc định LAN, rule theo cổng nhận gói, port forward + associated rule', () => {
  const { net, run } = net3('pfsense', ['em1', 'em0', 'em2']);
  run('if em0 ip=203.0.113.2/24 zone=WAN', 'if em1 ip=10.1.1.1/24 zone=LAN', 'if em2 ip=172.16.1.1/24 zone=OPT1', 'gw 203.0.113.1', 'apply');
  assert.ok(tcp(net, 'pin', '8.8.8.8', 23), '"Default allow LAN to any" + automatic outbound NAT');
  run('rule add Web from=LAN to=any src="LAN net" svc=HTTP action=accept', 'rule del "Default allow LAN to any"', 'apply');
  assert.ok(tcp(net, 'pin', '8.8.8.8', 80) && !tcp(net, 'pin', '8.8.8.8', 23), 'token key="a b" giữ nguyên "LAN net"');
  run('rule add Sai from=OPT1 dst=172.16.1.10 svc=HTTP action=accept', 'apply');
  assert.ok(!tcp(net, 'srv', '203.0.113.2', 8080), 'rule ở tab OPT1 không mở cho khách từ WAN');
  run('obj WEB 172.16.1.10', 'nat add PF type=dnat ext=wan int=WEB proto=tcp ext_port=8080 int_port=80 rule=yes', 'apply');
  assert.ok(tcp(net, 'srv', '203.0.113.2', 8080), 'port forward 8080 → WEB:80');
  assert.ok(!tcp(net, 'srv', '203.0.113.2', 22));
});
