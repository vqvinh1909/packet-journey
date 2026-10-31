// tests/n200.test.js — lệnh bổ sung theo CCNA 200-301: LLDP, OSPF network type, static route name, SNMP v2c/v3,
// ACL IPv6, VLAN mở rộng, config-register + khôi phục mật khẩu qua ROMMON.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli, runScript } from '../lab/ios.js';
import * as S from '../lab/sandbox.js';
import * as N from '../lab/net.js';
import * as V6 from '../lab/net6.js';
import { linuxDevice } from '../lab/linux.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
function mk(kinds, links) {
  const net = S.emptySandbox();
  const ids = kinds.map(([k, x]) => S.addDevice(net, k, x, 100));
  for (const id of ids) net.devices[id].off = false;
  for (const [a, ap, b, bp] of links) S.connect(net, ids[a], ap, ids[b], bp);
  return { net, ids, cli: createCli(net) };
}
const out = (cli, id, c) => { cli.session(id).mode = 'priv'; return cli.exec(id, c).out.join('\n'); };

test('LLDP: mặc định tắt; cần lldp run 2 đầu; no lldp transmit ẩn mình khỏi láng giềng; running-config', () => {
  const { ids: [r, s], cli } = mk([['router', 100], ['sw2960', 300]], [[0, 'g0/0', 1, 'g0/1']]);
  runScript(cli, r, cfg('interface g0/0', 'no shutdown'));
  assert.match(out(cli, s, 'show lldp neighbors'), /LLDP is not enabled/);
  runScript(cli, s, cfg('lldp run'));
  assert.match(out(cli, s, 'show lldp neighbors'), /Total entries displayed: 0/, 'đầu kia chưa bật');
  runScript(cli, r, cfg('lldp run'));
  assert.match(out(cli, s, 'show lldp neighbors'), /R1\s+Gi0\/1\s+120\s+R\s+Gi0\/0[\s\S]*Total entries displayed: 1/);
  runScript(cli, r, cfg('interface g0/0', 'no lldp transmit'));
  assert.match(out(cli, s, 'show lldp neighbors'), /Total entries displayed: 0/);
  const run = out(cli, r, 'show running-config');
  assert.match(run, /interface GigabitEthernet0\/0\n no ip address\n no lldp transmit/);
  assert.match(run, /\nlldp run\n/);
});

test('OSPF network type: point-to-point không bầu DR; lệch 2 đầu → láng giềng lên nhưng mất route', () => {
  const { net, ids: [a, b, pa, pb], cli } = mk([['router', 100], ['router', 300], ['pc', 100], ['pc', 300]], [[0, 'g0/1', 1, 'g0/1'], [2, 'fa0', 0, 'g0/0'], [3, 'fa0', 1, 'g0/0']]);
  delete net.devices[pa].shell; delete net.devices[pb].shell;
  runScript(cli, a, cfg('interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.0.1 255.255.255.252', 'ip ospf network point-to-point', 'no shutdown', 'router ospf 1', 'network 0.0.0.0 255.255.255.255 area 0'));
  runScript(cli, b, cfg('interface g0/0', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.0.2 255.255.255.252', 'no shutdown', 'router ospf 1', 'network 0.0.0.0 255.255.255.255 area 0'));
  cli.exec(pa, 'ipconfig 192.168.1.10 255.255.255.0 192.168.1.1');
  cli.exec(pb, 'ipconfig 192.168.2.10 255.255.255.0 192.168.2.1');
  const ctx = () => N.makeCtx(net);
  assert.equal(N.ospfNeighbors(ctx(), a).length, 1, 'vẫn lên láng giềng');
  assert.ok(!N.sendPacket(net, { src: pa, dst: '192.168.2.10' }).ok, 'lệch network type → không có route');
  runScript(cli, b, cfg('interface g0/1', 'ip ospf network point-to-point'));
  const nb = N.ospfNeighbors(ctx(), a)[0];
  assert.equal(nb.state, 'FULL/ -');
  assert.ok(N.sendPacket(net, { src: pa, dst: '192.168.2.10' }).ok);
  assert.match(out(cli, a, 'show ip ospf interface g0/1'), /Network Type POINT_TO_POINT[\s\S]*State POINT_TO_POINT/);
  assert.match(out(cli, a, 'show ip ospf interface brief'), /Gi0\/1.*P2P/);
  assert.match(out(cli, a, 'show running-config interface g0/1'), / ip ospf network point-to-point/);
});

test('static route có name: lưu, hiện trong running-config, xoá được', () => {
  const { ids: [r], cli } = mk([['router', 100]], []);
  runScript(cli, r, cfg('ip route 8.8.8.0 255.255.255.0 10.0.0.9 200 name DU-PHONG'));
  assert.match(out(cli, r, 'show running-config'), /ip route 8\.8\.8\.0 255\.255\.255\.0 10\.0\.0\.9 200 name DU-PHONG/);
  runScript(cli, r, cfg('no ip route 8.8.8.0 255.255.255.0 10.0.0.9'));
  assert.doesNotMatch(out(cli, r, 'show running-config'), /DU-PHONG/);
});

test('SNMP: v2c community + ACL, snmpset cần RW, v3 sai user / sai mật khẩu / thiếu mức bảo mật; user không hiện trong running-config', () => {
  const { net, ids: [r, nms, pc], cli } = mk([['router', 100], ['server', 300], ['server', 500]], [[1, 'fa0', 0, 'g0/0'], [2, 'fa0', 0, 'g0/1']]);
  runScript(cli, r, cfg('interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.1.0.1 255.255.255.0', 'no shutdown', 'exit', 'access-list 10 permit host 10.0.0.50',
    'snmp-server community RO1 ro 10', 'snmp-server community RW1 rw 10', 'snmp-server location DC1', 'snmp-server group G3 v3 priv', 'snmp-server user u1 G3 v3 auth sha Auth@1234 priv aes 128 Priv@1234'));
  cli.exec(nms, 'ipconfig 10.0.0.50 255.255.255.0 10.0.0.1');
  cli.exec(pc, 'ipconfig 10.1.0.10 255.255.255.0 10.1.0.1');
  const q = (id, c) => cli.exec(id, c).out.join('\n');
  assert.match(q(nms, 'snmpget -v2c -c RO1 10.0.0.1 sysName.0 sysLocation.0'), /sysName\.0 = STRING: R1\n.*sysLocation\.0 = STRING: DC1/);
  assert.match(q(nms, 'snmpget -v2c -c sai 10.0.0.1 sysName.0'), /Timeout: No Response/);
  assert.match(q(pc, 'snmpget -v2c -c RO1 10.1.0.1 sysName.0'), /Timeout/, 'ACL chặn máy khác');
  assert.match(q(nms, 'snmpset -v2c -c RO1 10.0.0.1 sysLocation.0 s "X"'), /noAccess/);
  assert.match(q(nms, 'snmpset -v2c -c RW1 10.0.0.1 sysLocation.0 s "Tang 3"'), /STRING: Tang 3/);
  const v3 = (extra) => q(nms, `snmpget -v3 ${extra} 10.0.0.1 sysName.0`);
  assert.match(v3('-u u1 -l authPriv -a SHA -A Auth@1234 -x AES -X Priv@1234'), /STRING: R1/);
  assert.match(v3('-u ai -l authPriv -a SHA -A Auth@1234 -x AES -X Priv@1234'), /Unknown user name/);
  assert.match(v3('-u u1 -l authPriv -a SHA -A sai -x AES -X Priv@1234'), /Authentication failure/);
  assert.match(v3('-u u1 -l authPriv -a SHA -A Auth@1234 -x AES -X sai'), /Decryption error/);
  assert.match(v3('-u u1 -l authNoPriv -a SHA -A Auth@1234'), /authorizationError/);
  const run = out(cli, r, 'show running-config');
  assert.match(run, /snmp-server community RO1 RO 10\nsnmp-server community RW1 RW 10\nsnmp-server location Tang 3\nsnmp-server group G3 v3 priv/);
  assert.doesNotMatch(run, /snmp-server user/);
  assert.match(out(cli, r, 'show snmp user'), /User name: u1[\s\S]*Authentication Protocol: SHA\nPrivacy Protocol: AES128\nGroup-name: G3/);
  assert.equal(net.devices[r].snmp.stats.altered, 1);
});

test('ACL IPv6: deny theo prefix, permit còn lại, deny ngầm định, đếm match, running-config', () => {
  const { ids: [r, a, b], cli } = mk([['router', 100], ['server', 300], ['server', 500]], [[1, 'fa0', 0, 'g0/0'], [2, 'fa0', 0, 'g0/1']]);
  runScript(cli, r, cfg('ipv6 unicast-routing', 'interface g0/0', 'ipv6 address 2001:db8:10::1/64', 'no shutdown', 'interface g0/1', 'ipv6 address 2001:db8:20::1/64', 'no shutdown'));
  cli.exec(a, 'ipv6config 2001:db8:10::10/64 2001:db8:10::1');
  cli.exec(b, 'ipv6config 2001:db8:20::20/64 2001:db8:20::1');
  const net = cli.net;
  assert.ok(V6.ping6(net, b, '2001:db8:10::10').ok);
  runScript(cli, r, cfg('ipv6 access-list G-IN', 'deny icmp 2001:db8:20::/64 host 2001:db8:10::10 echo-request', 'interface g0/1', 'ipv6 traffic-filter G-IN in'));
  assert.ok(!V6.ping6(net, b, '2001:db8:20::1').ok, 'chỉ có 1 dòng deny → mọi thứ khác bị deny ngầm định');
  runScript(cli, r, cfg('ipv6 access-list G-IN', 'permit ipv6 any any'));
  assert.ok(!V6.ping6(net, b, '2001:DB8:10::10').ok);
  assert.ok(V6.ping6(net, b, '2001:db8:20::1').ok);
  assert.ok(V6.ping6(net, a, '2001:db8:20::20').ok, 'chiều ngược lại (echo-reply) không bị dòng deny echo-request chặn');
  cli.exec(b, 'ping 2001:db8:10::10');
  assert.match(out(cli, r, 'show ipv6 access-list'), /IPv6 access list G-IN\n    deny icmp 2001:DB8:20::\/64 host 2001:DB8:10::10 echo-request \(1 match\) sequence 10\n    permit ipv6 any any.*sequence 20/);
  const run = out(cli, r, 'show running-config');
  assert.match(run, /ipv6 traffic-filter G-IN in/);
  assert.match(run, /ipv6 access-list G-IN\n deny icmp 2001:DB8:20::\/64 host 2001:DB8:10::10 echo-request\n permit ipv6 any any/);
  assert.match(cli.exec(r, 'configure terminal') && cli.exec(r, 'ipv6 access-list X').out.join('') + cli.exec(r, 'permit tcp any').out.join(''), /Invalid input/);
});

test('VLAN mở rộng 1006–4094 chỉ tạo được khi VTP transparent; còn VLAN mở rộng thì không về server được', () => {
  const { net, ids: [s], cli } = mk([['sw2960', 100]], []);
  const o = runScript(cli, s, cfg('vlan 2000')).map((x) => x.out.join('\n')).join('\n');
  assert.match(o, /Extended VLAN\(s\) not allowed in current VTP mode/);
  assert.ok(!net.devices[s].vlans[2000]);
  runScript(cli, s, cfg('vtp mode transparent', 'vlan 2000', 'name CAM'));
  assert.equal(net.devices[s].vlans[2000], 'CAM');
  assert.match(runScript(cli, s, cfg('vtp mode server')).map((x) => x.out.join('\n')).join('\n'), /extended VLANs exist/);
  assert.equal(net.devices[s].vtpMode, 'transparent');
});

test('khôi phục mật khẩu: power-cycle → send break → ROMMON confreg 0x2142 → reset → copy start run → đổi secret → 0x2102', () => {
  const { net, ids: [r], cli } = mk([['router', 100]], []);
  runScript(cli, r, [...cfg('enable secret QuenRoi', 'interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown'), 'copy running-config startup-config', '']);
  const s = cli.session(r);
  Object.assign(s, { mode: 'user' });
  assert.match(cli.exec(r, 'enable').out.join('') + cli.prompt(r), /Password/);
  cli.exec(r, 'x'); s.pw = null; s.mode = 'user';
  cli.exec(r, 'power-cycle');
  cli.exec(r, 'send break');
  assert.equal(cli.prompt(r), 'rommon 1 > ');
  assert.match(cli.exec(r, 'confreg 0x2142').out.join('\n'), /reset or power cycle/);
  assert.equal(cli.prompt(r), 'rommon 2 > ');
  assert.match(cli.exec(r, 'reset').out.join('\n'), /BỎ QUA startup-config/);
  cli.exec(r, '');
  cli.exec(r, 'enable');
  assert.equal(cli.prompt(r), 'Router#', 'không hỏi mật khẩu: startup-config bị bỏ qua');
  assert.match(cli.exec(r, 'show version').out.join('\n'), /Configuration register is 0x2142/);
  runScript(cli, r, ['copy startup-config running-config', '']);
  assert.ok(net.devices[r].ifaces['g0/0'].shutdown, 'copy chỉ gộp → cổng vẫn shutdown');
  assert.equal(net.devices[r].ifaces['g0/0'].ip, '10.0.0.1');
  runScript(cli, r, ['configure terminal', 'enable secret Moi@123', 'interface g0/0', 'no shutdown', 'exit', 'config-register 0x2102', 'end']);
  assert.match(cli.exec(r, 'show version').out.join('\n'), /Configuration register is 0x2142 \(will be 0x2102 at next reload\)/);
  runScript(cli, r, ['copy running-config startup-config', '']);
  cli.exec(r, 'power-cycle'); cli.exec(r, '');
  assert.equal(net.devices[r].enableSecret, 'Moi@123', 'lần khởi động sau đọc lại startup-config');
  assert.equal(net.devices[r].confreg, '0x2102');
  assert.ok(!net.devices[r].ifaces['g0/0'].shutdown);
});

const dnsNet = () => {
  const net = N.makeNet([
    N.sw('sw', 'SW', 0, 0, ['fa0/1', 'fa0/2']),
    Object.assign(linuxDevice('c', 'C', 0, 0), { ip: '10.0.0.5', dns: '10.0.0.1' }),
    Object.assign(N.server('d', 'D', 0, 0, { ip: '10.0.0.1', services: [53] }), { zone: {} }),
  ], [['c', 'fa0', 'sw', 'fa0/1'], ['d', 'fa0', 'sw', 'fa0/2']]);
  return { net, cli: createCli(net) };
};
const lines = (cli, id, c) => cli.exec(id, c).out;

test('DNS: đủ 6 kiểu bản ghi, đi theo CNAME, tra ngược, NXDOMAIN và NODATA', () => {
  const { cli } = dnsNet();
  for (const c of ['dns add a.x 10.0.0.9', 'dns add w.x CNAME a.x', 'dns add a.x AAAA 2001:db8::9', 'dns add x MX 10 a.x', 'dns add x NS a.x', 'dns add 9.0.0.10.in-addr.arpa PTR a.x']) assert.deepEqual(lines(cli, 'd', c), [], c);
  assert.deepEqual(lines(cli, 'c', 'dig w.x +short'), ['a.x', '10.0.0.9']);
  assert.deepEqual(lines(cli, 'c', 'dig a.x AAAA +short'), ['2001:db8::9']);
  assert.deepEqual(lines(cli, 'c', 'dig MX x +short'), ['10 a.x']);
  assert.deepEqual(lines(cli, 'c', 'dig x NS +short'), ['a.x']);
  assert.deepEqual(lines(cli, 'c', 'dig -x 10.0.0.9 +short'), ['a.x']);
  assert.ok(lines(cli, 'c', 'nslookup 10.0.0.9').some((l) => l.includes('name = a.x')));
  assert.ok(lines(cli, 'c', 'nslookup -type=mx x').some((l) => l.includes('mail exchanger = 10 a.x')));
  assert.match(lines(cli, 'c', 'dig none.x').join('\n'), /NXDOMAIN/);
  const nodata = lines(cli, 'c', 'dig a.x MX').join('\n');
  assert.match(nodata, /NOERROR/);
  assert.doesNotMatch(nodata, /ANSWER/);
  // dữ liệu sai bị từ chối, xoá theo kiểu không đụng kiểu khác
  assert.match(lines(cli, 'd', 'dns add a.x AAAA 10.0.0.9')[0], /Cú pháp/);
  lines(cli, 'd', 'dns del a.x AAAA');
  assert.deepEqual(lines(cli, 'c', 'dig a.x +short'), ['10.0.0.9']);
  assert.deepEqual(lines(cli, 'c', 'dig a.x AAAA +short'), []);
});

test('DNS: CNAME vòng tròn không treo; CNAME treo báo NXDOMAIN và curl báo lỗi tên', () => {
  const { cli } = dnsNet();
  lines(cli, 'd', 'dns add a.x CNAME b.x');
  lines(cli, 'd', 'dns add b.x CNAME a.x');
  assert.ok(lines(cli, 'c', 'dig a.x +short').length <= 8);
  lines(cli, 'd', 'dns add z.x CNAME gone.x');
  assert.match(lines(cli, 'c', 'dig z.x').join('\n'), /NXDOMAIN[\s\S]*CNAME/);
  const c = cli.exec('c', 'curl http://z.x');
  assert.ok(c.out.length && c.why !== '', 'curl báo lỗi');
  assert.match([...c.out, c.why].join(' '), /z\.x/);
});

const swPair = (pa = 'g0/1', pb = 'g0/1') => {
  const net = N.makeNet([N.sw('a', 'A', 0, 0, [pa]), N.sw('b', 'B', 0, 0, [pb])], [['a', pa, 'b', pb]]);
  return { net, cli: createCli(net) };
};

test('Ethernet: auto hai đầu, lệch tốc độ thì down, đặt cứng một đầu thì đầu kia rơi về half', () => {
  const { net, cli } = swPair();
  assert.deepEqual([N.ethMode(net, 'a', 'g0/1').speed, N.ethMode(net, 'a', 'g0/1').duplex], [1000, 'full']);
  assert.match(out(cli, 'a', 'show interfaces status'), /a-full\s+a-1000/);

  runScript(cli, 'a', cfg('interface g0/1', 'speed 100', 'duplex full'));
  assert.equal(N.ethMode(net, 'b', 'g0/1').duplex, 'half');
  assert.equal(N.ethMode(net, 'b', 'g0/1').speed, 100);
  assert.ok(N.ethMode(net, 'a', 'g0/1').mismatch && N.lineUp(net, 'a', 'g0/1'), 'lệch duplex: link vẫn lên');
  assert.match(out(cli, 'a', 'show interfaces g0/1'), /1842 CRC/);
  assert.match(out(cli, 'b', 'show interfaces g0/1'), /517 late collision/);
  assert.match(out(cli, 'a', 'show running-config'), / speed 100/);

  runScript(cli, 'b', cfg('interface g0/1', 'speed 1000'));
  assert.ok(!N.statusUp(net, 'a', 'g0/1') && !N.statusUp(net, 'b', 'g0/1'), 'lệch tốc độ: link xuống');
  runScript(cli, 'a', cfg('interface g0/1', 'speed auto', 'duplex auto'));
  runScript(cli, 'b', cfg('interface g0/1', 'speed auto'));
  assert.ok(N.statusUp(net, 'a', 'g0/1') && !N.ethMode(net, 'a', 'g0/1').mismatch);
});

test('Ethernet: cổng Fa từ chối speed 1000, Gi nối Fa chạy theo Fa, 1000 auto không rơi về half', () => {
  const { net, cli } = swPair('fa0/1', 'g0/1');
  const r = runScript(cli, 'a', cfg('interface fa0/1', 'speed 1000')).map((o) => o.out.join(' ')).join(' ');
  assert.match(r, /không hỗ trợ/);
  assert.equal(N.ethMode(net, 'b', 'g0/1').speed, 100);
  const p = swPair();
  runScript(p.cli, 'a', cfg('interface g0/1', 'speed 1000', 'duplex full'));
  assert.equal(N.ethMode(p.net, 'b', 'g0/1').duplex, 'full');
});

test('Voice VLAN và PoE: điện thoại vào VLAN thoại, PC cùng cấu hình ở VLAN dữ liệu, tắt PoE thì mất link', () => {
  const net = N.makeNet([
    N.sw('s', 'S', 0, 0, ['fa0/1', 'fa0/2', 'fa0/3']),
    Object.assign(N.server('ph', 'PH', 0, 0, { ip: '10.0.0.1', services: [], cloud: false }), { phone: true }),
    N.pc('pc', 'PC', 0, 0, { ip: '10.0.0.2' }),
    N.server('c', 'C', 0, 0, { ip: '10.0.0.3' }),
  ], [['ph', 'fa0', 's', 'fa0/1'], ['pc', 'fa0', 's', 'fa0/2'], ['c', 'fa0', 's', 'fa0/3']]);
  const cli = createCli(net), set = 'switchport voice vlan 20';
  const r = runScript(cli, 's', cfg('vlan 10', 'exit', 'interface range fa0/1 - 2', 'switchport mode access', 'switchport access vlan 10', set, 'interface fa0/3', 'switchport access vlan 20'));
  assert.match(r.map((o) => o.out.join(' ')).join(' '), /Voice VLAN does not exist/);
  assert.equal(N.effPort(net, net.devices.s, 'fa0/1').vlan, 20, 'điện thoại');
  assert.equal(N.effPort(net, net.devices.s, 'fa0/2').vlan, 10, 'PC không gắn thẻ');
  assert.match(out(cli, 's', 'show interfaces fa0/1 switchport'), /Voice VLAN: 20/);
  assert.match(out(cli, 's', 'show running-config'), /switchport voice vlan 20/);
  assert.match(out(cli, 's', 'show power inline'), /Fa0\/1\s+auto\s+on\s+6\.3/);
  assert.match(out(cli, 's', 'show power inline'), /Fa0\/2\s+auto\s+off/);
  assert.equal(cli.exec('ph', 'ping 10.0.0.3').out.some((l) => /Reply from 10\.0\.0\.3/.test(l)), true);
  runScript(cli, 's', cfg('interface fa0/1', 'power inline never'));
  assert.ok(!N.statusUp(net, 's', 'fa0/1'), 'điện thoại mất nguồn');
  assert.ok(N.statusUp(net, 's', 'fa0/2'), 'PC không cần PoE');
  assert.match(out(cli, 's', 'show running-config'), /power inline never/);
});
