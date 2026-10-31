// tests/n200.test.js — lệnh bổ sung theo CCNA 200-301: LLDP, OSPF network type, static route name, SNMP v2c/v3,
// ACL IPv6, VLAN mở rộng, config-register + khôi phục mật khẩu qua ROMMON.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli, runScript } from '../lab/ios.js';
import * as S from '../lab/sandbox.js';
import * as N from '../lab/net.js';
import * as V6 from '../lab/net6.js';
import { linuxDevice, macDevice } from '../lab/linux.js';
import { wlcDevice, rfStatus, apConfig } from '../lab/wlc.js';

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

test('Voice VLAN và PoE: điện thoại gắn thẻ VLAN thoại, PC sau điện thoại ở VLAN dữ liệu, tắt PoE thì cả hai mất mạng', () => {
  const net = N.makeNet([
    N.sw('s', 'S', 0, 0, ['fa0/1', 'fa0/2', 'fa0/3']),
    Object.assign(N.server('ph', 'PH', 0, 0, { ip: '10.0.0.1', services: [], cloud: false }), { phone: true }),
    N.pc('pc', 'PC', 0, 0, { ip: '10.0.0.2' }),
    N.server('c', 'C', 0, 0, { ip: '10.0.0.3' }),
    N.server('dt', 'DT', 0, 0, { ip: '10.0.0.4' }),
  ], [['ph', 'fa0', 's', 'fa0/1'], ['pc', 'fa0', 'ph', 'pc0'], ['c', 'fa0', 's', 'fa0/2'], ['dt', 'fa0', 's', 'fa0/3']]);
  const cli = createCli(net), ping = (from, ip) => N.sendPacket(net, { src: from, dst: ip }).ok;
  const r = runScript(cli, 's', cfg('vlan 10', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'switchport voice vlan 20', 'interface fa0/2', 'switchport access vlan 20', 'interface fa0/3', 'switchport access vlan 10'));
  assert.match(r.map((o) => o.out.join(' ')).join(' '), /Voice VLAN does not exist/);
  assert.ok(ping('ph', '10.0.0.3'), 'điện thoại tới máy VLAN thoại');
  assert.ok(!ping('ph', '10.0.0.4'), 'điện thoại không vào VLAN dữ liệu');
  assert.ok(ping('pc', '10.0.0.4'), 'PC tới máy VLAN dữ liệu');
  assert.ok(!ping('pc', '10.0.0.3'), 'PC không vào VLAN thoại');
  assert.match(out(cli, 's', 'show interfaces fa0/1 switchport'), /Voice VLAN: 20/);
  assert.match(out(cli, 's', 'show running-config'), /switchport voice vlan 20/);
  assert.match(out(cli, 's', 'show power inline'), /Fa0\/1\s+auto\s+on\s+6\.3/);
  runScript(cli, 's', cfg('interface fa0/1', 'power inline never'));
  assert.ok(!N.statusUp(net, 's', 'fa0/1'), 'điện thoại mất nguồn');
  assert.ok(!ping('ph', '10.0.0.3') && !ping('pc', '10.0.0.4'), 'mất nguồn thì cả điện thoại lẫn PC phía sau mất mạng');
  assert.match(out(cli, 's', 'show running-config'), /power inline never/);
});

const trio = () => {
  const net = N.makeNet([N.sw('a', 'A', 0, 0, ['g0/1', 'g0/2']), N.sw('b', 'B', 0, 0, ['g0/1', 'g0/2']), N.sw('c', 'C', 0, 0, ['g0/1', 'g0/2'])], [['a', 'g0/1', 'b', 'g0/1'], ['a', 'g0/2', 'c', 'g0/1'], ['b', 'g0/2', 'c', 'g0/2']]);
  return { net, cli: createCli(net) };
};

test('Root Guard: BPDU tốt hơn bị chặn, gỡ guard thì root đổi lại; cổng không vi phạm vẫn chạy', () => {
  const { net, cli } = trio();
  runScript(cli, 'a', cfg('spanning-tree vlan 1 priority 4096'));
  runScript(cli, 'b', cfg('interface g0/2', 'spanning-tree guard root'));
  assert.equal(N.stpState(net, 1).root.b, 'a', 'chưa có BPDU tốt hơn');
  assert.ok(!N.stpState(net, 1).ports['b|g0/2'].inc);
  runScript(cli, 'c', cfg('spanning-tree vlan 1 priority 0'));
  const st = N.stpState(net, 1);
  assert.equal(st.ports['b|g0/2'].inc, 'Root');
  assert.equal(st.ports['b|g0/2'].sts, 'BLK');
  assert.match(out(cli, 'b', 'show spanning-tree inconsistentports'), /GigabitEthernet0\/2\s+Root Inconsistent/);
  assert.match(out(cli, 'b', 'show running-config'), /spanning-tree guard root/);
  runScript(cli, 'b', cfg('interface g0/2', 'no spanning-tree guard'));
  assert.ok(!N.stpState(net, 1).ports['b|g0/2'].inc);
});

test('Loop Guard: cổng Alternate mất BPDU tự mở nếu không có guard, có guard thì bị chặn', () => {
  const { net, cli } = trio();
  runScript(cli, 'a', cfg('spanning-tree vlan 1 priority 4096'));
  runScript(cli, 'b', cfg('spanning-tree vlan 1 priority 8192'));
  assert.equal(N.stpState(net, 1).ports['c|g0/2'].sts, 'BLK', 'Alternate bình thường');
  net.devices.c.ports['g0/2'].noBpduRx = true;
  assert.equal(N.stpState(net, 1).ports['c|g0/2'].sts, 'FWD', 'mất BPDU: tự mở, nguy cơ loop');
  runScript(cli, 'c', cfg('interface g0/2', 'spanning-tree guard loop'));
  assert.equal(N.stpState(net, 1).ports['c|g0/2'].inc, 'Loop');
  assert.equal(N.stpState(net, 1).ports['c|g0/2'].sts, 'BLK');
});

test('Storm Control: dưới ngưỡng forward, vượt ngưỡng Blocking; action shutdown thì err-disabled', () => {
  const net = N.makeNet([N.sw('s', 'S', 0, 0, ['fa0/1']), Object.assign(N.pc('p', 'P', 0, 0), { stormPct: 40 })], [['p', 'fa0', 's', 'fa0/1']]);
  const cli = createCli(net);
  runScript(cli, 's', cfg('interface fa0/1', 'storm-control broadcast level 50'));
  assert.match(out(cli, 's', 'show storm-control'), /Fa0\/1\s+Forwarding/);
  runScript(cli, 's', cfg('interface fa0/1', 'storm-control broadcast level 10'));
  assert.match(out(cli, 's', 'show storm-control'), /Fa0\/1\s+Blocking/);
  assert.ok(N.statusUp(net, 's', 'fa0/1'));
  runScript(cli, 's', cfg('interface fa0/1', 'storm-control action shutdown'));
  assert.ok(N.errDisabled(net, net.devices.s, 'fa0/1'));
});

test('RA Guard: policy host chặn RA, role router cho qua', () => {
  const net = N.makeNet([N.sw('s', 'S', 0, 0, ['fa0/1', 'fa0/2']), N.router('r', 'R', 0, 0, ['g0/0']), N.pc('p', 'P', 0, 0)], [['r', 'g0/0', 's', 'fa0/1'], ['p', 'fa0', 's', 'fa0/2']]);
  const cli = createCli(net);
  runScript(cli, 'r', cfg('ipv6 unicast-routing', 'interface g0/0', 'ipv6 address 2001:db8::1/64', 'no shutdown'));
  assert.ok(V6.slaac(net, 'p').ok);
  runScript(cli, 's', cfg('ipv6 nd raguard policy H', 'device-role host', 'exit', 'interface fa0/1', 'ipv6 nd raguard attach-policy H'));
  assert.ok(!V6.slaac(net, 'p').ok);
  runScript(cli, 's', cfg('ipv6 nd raguard policy H', 'device-role router'));
  assert.ok(V6.slaac(net, 'p').ok);
});

const aaaNet = () => {
  const net = N.makeNet([
    N.sw('s', 'S', 0, 0, ['fa0/1', 'fa0/2', 'fa0/3']), N.router('r', 'R', 0, 0, ['g0/0']),
    Object.assign(N.server('t', 'T', 0, 0, { ip: '10.0.0.9', services: [49] }), { tacacs: { secret: 'K', users: { u: 'p' } } }),
    Object.assign(N.pc('a', 'A', 0, 0, { ip: '10.0.0.5' }), {}),
  ], [['r', 'g0/0', 's', 'fa0/1'], ['t', 'fa0', 's', 'fa0/2'], ['a', 'fa0', 's', 'fa0/3']]);
  const cli = createCli(net);
  runScript(cli, 'r', cfg('hostname R', 'interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown', 'exit', 'ip domain-name x.vn', 'crypto key generate rsa modulus 2048', 'username admin privilege 15 secret L', 'line vty 0 4', 'login local', 'transport input ssh', 'exit', 'aaa new-model', 'tacacs server T1', 'address ipv4 10.0.0.9', 'key K', 'exit', 'aaa authentication login default group tacacs+ local'));
  return { net, cli };
};
const sshTry = (cli, user, pw) => { cli.exec('a', `ssh -l ${user} 10.0.0.1`); return cli.exec('a', pw).out.join(' '); };

test('AAA: máy chủ trả lời thì theo máy chủ (sai là từ chối, không rơi về local); máy chủ chết hoặc sai khoá mới dùng local', () => {
  const { net, cli } = aaaNet();
  assert.equal(out(cli, 'r', 'test aaa group tacacs+ u p new-code'), 'User successfully authenticated');
  assert.equal(out(cli, 'r', 'test aaa group tacacs+ u sai new-code'), 'User rejected');
  assert.match(sshTry(cli, 'u', 'p'), /thành công/);
  assert.match(sshTry(cli, 'admin', 'L'), /Authentication failed/, 'máy chủ không biết admin: từ chối');
  runScript(cli, 'r', cfg('tacacs server T1', 'key SAI'));
  assert.equal(out(cli, 'r', 'test aaa group tacacs+ u p new-code'), 'No authoritative response from any server.');
  assert.match(sshTry(cli, 'admin', 'L'), /thành công/, 'sai khoá: coi như không trả lời, dùng local');
  runScript(cli, 'r', cfg('tacacs server T1', 'key K'));
  net.devices.t.services = [];
  assert.match(sshTry(cli, 'admin', 'L'), /thành công/, 'máy chủ chết: dùng local');
  assert.match(out(cli, 'r', 'show running-config'), /tacacs server T1[\s\S]*address ipv4 10\.0\.0\.9/);
});

test('SCP/SFTP: sai mật khẩu hoặc không có SSH thì từ chối, đúng thì có file', () => {
  const net = N.makeNet([N.router('r', 'R', 0, 0, ['g0/0']), Object.assign(N.server('f', 'F', 0, 0, { ip: '10.0.0.5', services: [22] }), { users: { b: { pw: 'x' } } })], [['r', 'g0/0', 'f', 'fa0']]);
  const cli = createCli(net), run = (...c) => runScript(cli, 'r', ['enable', ...c]).map((o) => o.out.join(' ')).join(' ');
  runScript(cli, 'r', cfg('hostname R', 'interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown'));
  assert.match(run('copy running-config sftp:', '10.0.0.5', 'b', 'c1', 'sai'), /Permission denied/);
  assert.ok(!(net.devices.f.files || []).some((x) => x.name === 'c1'));
  assert.match(run('copy running-config sftp:', '10.0.0.5', 'b', 'c1', 'x'), /bytes copied/);
  assert.equal(net.devices.f.files.find((x) => x.name === 'c1').via, 'sftp');
  net.devices.f.services = [];
  assert.match(run('copy running-config scp:', '10.0.0.5', 'b', 'c2', 'x'), /Connection refused|Timed out/);
});

test('SFP: khác module hoặc sai sợi, quá cự ly thì down; đúng thì up', () => {
  const mk2 = (a, b) => { const net = N.makeNet([N.sw('a', 'A', 0, 0, ['g0/1']), N.sw('b', 'B', 0, 0, ['g0/1'])], [['a', 'g0/1', 'b', 'g0/1']]); Object.assign(net.devices.a.ports['g0/1'], a); Object.assign(net.devices.b.ports['g0/1'], b); return N.statusUp(net, 'a', 'g0/1'); };
  assert.ok(mk2({ sfp: 'LX', fiber: 'SMF', fiberM: 2000 }, { sfp: 'LX', fiber: 'SMF', fiberM: 2000 }));
  assert.ok(!mk2({ sfp: 'SX', fiber: 'SMF', fiberM: 100 }, { sfp: 'SX', fiber: 'SMF', fiberM: 100 }), 'sai sợi');
  assert.ok(!mk2({ sfp: 'SX', fiber: 'MMF', fiberM: 900 }, { sfp: 'SX', fiber: 'MMF', fiberM: 900 }), 'quá cự ly');
  assert.ok(!mk2({ sfp: 'SX' }, { sfp: 'LX' }), 'khác module');
  assert.ok(!mk2({ sfp: 'SX' }, {}), 'một đầu không có module');
});

test('macOS và Linux: lệnh đúng theo hệ điều hành, tệp, apt, Ansible chạy qua SSH thật', () => {
  const net = N.makeNet([
    N.sw('s', 'S', 0, 0, ['fa0/1', 'fa0/2']),
    Object.assign(linuxDevice('l', 'L', 0, 0), { ip: '10.0.0.10' }),
    Object.assign(macDevice('m', 'M', 0, 0), { ip: '169.254.1.1', prefix: 16 }),
  ], [['l', 'fa0', 's', 'fa0/1'], ['m', 'fa0', 's', 'fa0/2']]);
  const cli = createCli(net), run = (d, c) => cli.exec(d, c).out.join('\n');
  assert.match(run('m', 'ifconfig en0'), /inet 169\.254\.1\.1/);
  assert.match(run('m', 'ip a'), /command not found/);
  assert.equal(run('m', 'networksetup -setmanual Wi-Fi 10.0.0.20 255.255.255.0 10.0.0.1'), '');
  assert.match(run('m', 'networksetup -getinfo Wi-Fi'), /IP address: 10\.0\.0\.20[\s\S]*Router: 10\.0\.0\.1/);
  assert.match(cli.prompt('m'), /admin\$ $/);
  assert.match(run('l', 'ansible all -m ping'), /command not found/);
  run('l', 'apt install ansible');
  run('l', 'echo "[sw]" >> /etc/ansible/hosts');
  run('l', 'echo "10.0.0.2 ansible_user=admin ansible_password=P" >> /etc/ansible/hosts');
  assert.match(run('l', 'cat /etc/ansible/hosts'), /\[sw\]\n10\.0\.0\.2/);
  assert.match(run('l', 'ls /etc/ansible'), /hosts/);
  assert.match(run('l', 'ansible sw -m ping'), /UNREACHABLE/, 'chưa có switch ở 10.0.0.2');
  runScript(cli, 's', cfg('interface vlan 1', 'ip address 10.0.0.2 255.255.255.0', 'no shutdown', 'exit', 'ip domain-name x.vn', 'crypto key generate rsa modulus 2048', 'username admin privilege 15 secret P', 'line vty 0 4', 'login local', 'transport input ssh'));
  assert.match(run('l', 'ansible sw -m ping'), /SUCCESS/);
  assert.match(run('l', `ansible sw -m cisco.ios.ios_config -a "lines='vlan 77'"`), /CHANGED/);
  assert.ok(net.devices.s.vlans[77]);
  assert.match(run('l', `ansible sw -m cisco.ios.ios_config -a "lines='vlan 77'"`), /SUCCESS/, 'chạy lại không đổi gì');
  assert.match(run('l', `ansible sw -m cisco.ios.ios_config -a "lines='lenh sai'"`), /FAILED/);
  assert.match(run('l', `ansible sw -m cisco.ios.ios_command -a "commands='show vlan brief'"`), /VLAN0077/);
});

test('RF: nhiễu chồng kênh hạ SNR, băng 5 GHz tránh được nhiễu 2.4 GHz; dữ liệu sai bị từ chối', () => {
  const net = N.makeNet([wlcDevice('w', 'W', 0, 0), Object.assign(N.pc('ap1', 'AP1', 0, 0), { isAp: true })], [['w', 'fa0', 'ap1', 'fa0']]);
  const cli = createCli(net), w = net.devices.w;
  w.wlc.rfEnv = [{ ch: 6, dbm: -55, src: 'x' }];
  cli.exec('w', 'ap ap1 channel=7');
  assert.equal(rfStatus(net, w)[0].noise, -55);
  cli.exec('w', 'ap ap1 channel=11');
  assert.equal(rfStatus(net, w)[0].noise, -95);
  cli.exec('w', 'ap ap1 channel=36 power=14');
  assert.deepEqual([rfStatus(net, w)[0].band, rfStatus(net, w)[0].rssi], [5, -59]);
  assert.match(cli.exec('w', 'ap ap1 channel=99').out.join(' '), /channel=/);
  assert.equal(apConfig(w, 'ap1').channel, 36);
});

test('tcpdump thấy DHCP do dhclient tạo; lệnh Linux thường dùng có kết quả, không bị báo lệnh lạ', () => {
  const net = N.makeNet([N.router('r', 'R', 0, 0, ['g0/0']), Object.assign(linuxDevice('l', 'L', 0, 0), { ip: null })], [['r', 'g0/0', 'l', 'fa0']]);
  const cli = createCli(net), run = (c) => cli.exec('l', c).out.join('\n');
  runScript(cli, 'r', cfg('interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown', 'exit', 'ip dhcp pool P', 'network 10.0.0.0 255.255.255.0', 'default-router 10.0.0.1'));
  run('dhclient');
  assert.ok(net.devices.l.ip, 'có IP');
  assert.match(run('tcpdump -i eth0 port 67'), /BOOTP\/DHCP/);
  assert.match(run('apt install docker.io'), /Setting up docker\.io/);
  assert.match(run('docker ps'), /CONTAINER ID/);
  assert.match(run('vi /etc/hosts'), /chưa mô phỏng trình soạn thảo/);
  run('echo "a" > x.txt');
  assert.equal(run('ls'), 'x.txt');
});
