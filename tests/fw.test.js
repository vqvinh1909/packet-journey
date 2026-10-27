// tests/fw.test.js — lõi firewall stateful (lab/fw.js): ASA, Zone-Based Firewall, rule base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as N from '../lab/net.js';
import { createCli, runScript } from '../lab/ios.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
/** PC-IN — FW(g0/0 inside, g0/2 dmz, g0/1 outside) — ISP — SRV 8.8.8.8 ; WEB ở DMZ. */
function net3(os = 'asa') {
  const fw = os === 'zbf' ? N.router('fw', 'FW', 0, 0, ['g0/0', 'g0/1', 'g0/2']) : N.firewall('fw', 'FW', 0, 0, ['g0/0', 'g0/1', 'g0/2'], os);
  const net = N.makeNet([
    fw, N.router('isp', 'ISP', 0, 0, ['g0/0', 'g0/1']),
    N.pc('pin', 'PC-IN', 0, 0, { ip: '10.1.1.10', gw: '10.1.1.1' }),
    N.server('web', 'WEB', 0, 0, { ip: '172.16.1.10', gw: '172.16.1.1', services: [80] }),
    N.server('srv', 'SRV', 0, 0, { ip: '8.8.8.8', gw: '8.8.8.1', services: [80, 443] }),
  ], [['pin', 'fa0', 'fw', 'g0/0'], ['fw', 'g0/1', 'isp', 'g0/0'], ['fw', 'g0/2', 'web', 'fa0'], ['isp', 'g0/1', 'srv', 'fa0']]);
  const cli = createCli(net);
  // địa chỉ + định tuyến (dùng tạm CLI IOS: firewall là router trong engine)
  runScript(cli, 'fw', cfg('interface g0/0', 'ip address 10.1.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.2 255.255.255.0', 'no shutdown', 'interface g0/2', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown', 'exit', 'ip route 0.0.0.0 0.0.0.0 203.0.113.1'));
  runScript(cli, 'isp', cfg('interface g0/0', 'ip address 203.0.113.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown'));
  return { net, cli, fw: net.devices.fw };
}
const ping = (net, s, d) => N.sendPacket(net, { src: s, dst: d });
const tcp = (net, s, d, p) => N.sendPacket(net, { src: s, dst: d, proto: 'tcp', dport: p });
/** NAT kiểu ASA "nat (inside,outside) dynamic interface" dựng thẳng trên model. */
function asaPat(fw) {
  fw.acls.NAT = { type: 'standard', entries: [{ seq: 10, action: 'permit', src: { ip: '10.1.1.0', wild: '0.0.0.255' } }] };
  fw.nat.dyn.push({ acl: 'NAT', iface: 'g0/1', overload: true });
  fw.ifaces['g0/0'].nat = 'inside'; fw.ifaces['g0/2'].nat = 'inside'; fw.ifaces['g0/1'].nat = 'outside';
}

test('ASA: cao → thấp được phép + stateful; ICMP mặc định không inspect', () => {
  const { net, fw } = net3('asa');
  Object.assign(fw.ifaces['g0/0'], { nameif: 'inside', secLevel: 100 });
  Object.assign(fw.ifaces['g0/1'], { nameif: 'outside', secLevel: 0 });
  Object.assign(fw.ifaces['g0/2'], { nameif: 'dmz', secLevel: 50 });
  asaPat(fw);
  assert.ok(tcp(net, 'pin', '8.8.8.8', 80).ok, 'inside → outside web (stateful, có NAT)');
  const p = ping(net, 'pin', '8.8.8.8');
  assert.equal(p.ok, false, 'echo-reply bị chặn vì ASA không inspect ICMP');
  assert.match(p.fail.why, /THẤP lên CAO/);
  fw.fw.inspectIcmp = true;
  assert.ok(ping(net, 'pin', '8.8.8.8').ok, 'inspect icmp → reply về được');
  assert.equal(tcp(net, 'web', '10.1.1.10', 80).ok, false, 'dmz (50) → inside (100) bị chặn');
  assert.ok(tcp(net, 'pin', '172.16.1.10', 80).ok, 'inside → dmz được');
});

test('ASA: publish web DMZ bằng NAT tĩnh + ACL trên outside (ACL dùng IP thật)', () => {
  const { net, fw } = net3('asa');
  Object.assign(fw.ifaces['g0/0'], { nameif: 'inside', secLevel: 100 });
  Object.assign(fw.ifaces['g0/1'], { nameif: 'outside', secLevel: 0 });
  Object.assign(fw.ifaces['g0/2'], { nameif: 'dmz', secLevel: 50 });
  fw.ifaces['g0/1'].nat = 'outside';
  fw.nat.statics.push({ local: '172.16.1.10', global: '203.0.113.10' });
  assert.equal(tcp(net, 'srv', '203.0.113.10', 80).ok, false, 'chưa có ACL: outside (0) → dmz (50) bị chặn');
  fw.acls.OUTSIDE_IN = { type: 'extended', entries: [{ seq: 10, action: 'permit', proto: 'tcp', src: { any: true }, dst: { ip: '172.16.1.10', wild: '0.0.0.0' }, dport: { op: 'eq', port: 80 } }] };
  fw.ifaces['g0/1'].aclIn = 'OUTSIDE_IN';
  assert.ok(tcp(net, 'srv', '203.0.113.10', 80).ok, 'ACL permit IP thật 172.16.1.10 → vào được qua IP public');
  assert.equal(tcp(net, 'srv', '203.0.113.10', 443).ok, false, 'cổng khác vẫn bị deny ngầm định');
  // ACL trên outside KHÔNG chặn gói trả lời của phiên inside khởi tạo
  fw.acls.NAT = { type: 'standard', entries: [{ seq: 10, action: 'permit', src: { ip: '10.1.1.0', wild: '0.0.0.255' } }] };
  fw.nat.dyn.push({ acl: 'NAT', iface: 'g0/1', overload: true });
  fw.ifaces['g0/0'].nat = 'inside';
  assert.ok(tcp(net, 'pin', '8.8.8.8', 443).ok);
});

test('Zone-Based Firewall: zone-pair inspect / pass / drop, cổng không zone', () => {
  const { net, fw } = net3('zbf');
  fw.fw = { kind: 'zbf', conns: [] };
  fw.ifaces['g0/0'].zone = 'INSIDE'; fw.ifaces['g0/1'].zone = 'OUTSIDE';
  asaPat(fw);
  assert.equal(tcp(net, 'pin', '8.8.8.8', 80).ok, false, 'chưa có zone-pair → drop');
  fw.zbf = {
    classMaps: { WEB: { all: false, matches: [{ protocol: 'http' }, { protocol: 'icmp' }] } },
    policyMaps: { IN_OUT: [{ cls: 'WEB', action: 'inspect' }, { cls: 'class-default', action: 'drop' }] },
    pairs: [{ name: 'IN-OUT', src: 'INSIDE', dst: 'OUTSIDE', policy: 'IN_OUT' }],
  };
  assert.ok(tcp(net, 'pin', '8.8.8.8', 80).ok, 'inspect: http đi và về');
  assert.ok(ping(net, 'pin', '8.8.8.8').ok, 'inspect icmp');
  assert.equal(tcp(net, 'pin', '8.8.8.8', 443).ok, false, 'https rơi vào class-default drop');
  fw.zbf.policyMaps.IN_OUT[0].action = 'pass';
  assert.equal(tcp(net, 'pin', '8.8.8.8', 80).ok, false, 'pass không stateful → chiều về bị chặn');
  assert.equal(tcp(net, 'pin', '172.16.1.10', 80).ok, false, 'g0/2 không thuộc zone → bị chặn');
});

test('Rule base (kiểu FortiGate): thứ tự rule, NAT theo rule, deny ngầm định', () => {
  const { net, fw } = net3('fortios');
  fw.ifaces['g0/0'].zone = 'lan'; fw.ifaces['g0/1'].zone = 'wan1'; fw.ifaces['g0/2'].zone = 'dmz';
  fw.fw.rules = [
    { id: 1, name: 'chan-https', from: ['lan'], to: ['wan1'], src: 'any', dst: 'any', svc: [{ proto: 'tcp', port: 443 }], action: 'deny' },
    { id: 2, name: 'lan-ra-net', from: ['lan'], to: ['wan1'], src: [{ net: '10.1.1.0', prefix: 24 }], dst: 'any', svc: 'any', action: 'accept', nat: true },
  ];
  assert.ok(tcp(net, 'pin', '8.8.8.8', 80).ok, 'rule 2 accept + NAT nguồn (ISP không có route về 10.1.1.0)');
  assert.ok(ping(net, 'pin', '8.8.8.8').ok);
  assert.equal(tcp(net, 'pin', '8.8.8.8', 443).ok, false, 'rule 1 đứng trước → deny');
  assert.equal(tcp(net, 'pin', '172.16.1.10', 80).ok, false, 'lan → dmz: không rule nào → deny ngầm định');
  const r = N.sendPacket(net, { src: 'pin', dst: '8.8.8.8', proto: 'tcp', dport: 80, record: true });
  assert.ok(r.ok);
  assert.ok(fw.fw.conns.some((c) => c.src === '10.1.1.10' && c.dport === 80), 'bảng phiên được lưu (show session)');
});
