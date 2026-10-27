// tests/capture.test.js — bắt gói trên dây (lab/capture.js): gói ghi đúng dây, ping lặp, ARP chỉ lần đầu,
// tag 802.1Q trên trunk, gói định kỳ (OSPF/EIGRP/HSRP/STP), bộ lọc hiển thị, file .pcap hợp lệ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../lab/sandbox.js';
import * as C from '../lab/capture.js';
import { createCli, runScript } from '../lab/ios.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
/** Mẫu "Hai mạng qua router": PC1 — SW1 — R1 — SW2 — PC2. */
function twonet() {
  const net = S.SANDBOX_TEMPLATES.find((t) => t.id === 'twonet').build();
  const cli = createCli(net);
  runScript(cli, 'r1', cfg('interface g0/0', 'ip address 10.1.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.2.2.1 255.255.255.0', 'no shutdown'));
  runScript(cli, 'pc1', ['ipconfig 10.1.1.10 255.255.255.0 10.1.1.1']);
  runScript(cli, 'pc2', ['ipconfig 10.2.2.10 255.255.255.0 10.2.2.1']);
  const link = (a, ap) => net.links.find((l) => (l.a === a && l.ap === ap) || (l.b === a && l.bp === ap)).id;
  return { net, cli, link };
}
const sum = (pkts) => pkts.map((p) => C.summarize(p));

test('gói của lệnh ping chỉ ghi vào dây đang bắt; ping lặp 4 lượt; ARP chỉ có ở lần đầu', () => {
  const { net, cli, link } = twonet();
  const cap = C.createCapture();
  const l1 = link('pc1', 'fa0'), l2 = link('pc2', 'fa0'), lr = link('r1', 'g0/0');
  C.startCapture(cap, l1, 0);
  C.startCapture(cap, l2, 0);
  C.recordSim(cap, cli.exec('pc1', 'ping 10.2.2.10').sim, 1, { repeat: 4 });
  assert.equal(cap.links[lr], undefined, 'dây không bắt thì không có gói');
  const a = sum(cap.links[l1].pkts);
  assert.deepEqual(a.slice(0, 2).map((x) => x.info), ['Who has 10.1.1.1? Tell 10.1.1.10', '10.1.1.1 is at ' + cap.links[l1].pkts[1].layers[0].fields.src]);
  assert.equal(a.filter((x) => x.proto === 'ICMP').length, 8, '4 request + 4 reply');
  assert.deepEqual(a.filter((x) => x.info.startsWith('Echo (ping) request')).map((x) => x.info.match(/seq=(\d+)/)[1]), ['1', '2', '3', '4']);
  assert.ok(a.every((x, i) => i === 0 || x.time >= a[i - 1].time), 'thời gian tăng dần');
  assert.ok(cap.links[l1].pkts.every((p) => [p.from, p.to].sort().join() === ['pc1', 'sw1'].join()), 'gói đúng 2 đầu dây');
  const b = sum(cap.links[l2].pkts);
  assert.equal(b[0].info, 'Who has 10.2.2.10? Tell 10.2.2.1', 'dây phía PC2: R1 hỏi ARP');
  assert.ok(b.some((x) => x.info.includes('reply') && x.src === '10.2.2.10'));
  // lần 2: bảng ARP đã có → không bắt lại ARP; Stop capture → không ghi thêm
  const n1 = cap.links[l1].pkts.length;
  C.recordSim(cap, cli.exec('pc1', 'ping 10.2.2.10').sim, 9, { repeat: 4 });
  assert.equal(sum(cap.links[l1].pkts.slice(n1)).filter((x) => x.proto === 'ARP').length, 0);
  C.stopCapture(cap, l1);
  const n2 = cap.links[l1].pkts.length;
  C.recordSim(cap, cli.exec('pc1', 'ping 10.2.2.10').sim, 20, { repeat: 4 });
  assert.equal(cap.links[l1].pkts.length, n2);
});

test('trunk 802.1Q: gói mang tag VLAN, DHCP + TCP được tóm tắt; lọc vlan.id / tcp.port / ip.addr', () => {
  const net = S.SANDBOX_TEMPLATES.find((t) => t.id === 'roas').build();
  const cli = createCli(net);
  runScript(cli, 'sw1', cfg('vlan 10', 'vlan 20', 'interface range fa0/1 - 2', 'switchport mode access', 'switchport access vlan 10', 'interface range fa0/3 - 4', 'switchport mode access', 'switchport access vlan 20', 'interface g0/1', 'switchport mode trunk'));
  runScript(cli, 'r1', cfg('interface g0/0', 'no shutdown', 'interface g0/0.10', 'encapsulation dot1Q 10', 'ip address 10.10.0.1 255.255.255.0', 'interface g0/0.20', 'encapsulation dot1Q 20', 'ip address 10.20.0.1 255.255.255.0', 'exit', 'ip dhcp pool V10', 'network 10.10.0.0 255.255.255.0', 'default-router 10.10.0.1'));
  runScript(cli, 'pc3', ['ipconfig 10.20.0.10 255.255.255.0 10.20.0.1']);
  const trunk = net.links.find((l) => l.a === 'r1' || l.b === 'r1').id;
  const cap = C.createCapture();
  C.startCapture(cap, trunk, 0);
  C.recordSim(cap, cli.exec('pc1', 'ipconfig /renew').sim, 1);
  C.recordSim(cap, cli.exec('pc1', 'ping 10.20.0.10').sim, 2, { repeat: 4 });
  C.recordSim(cap, cli.exec('pc1', 'telnet 10.10.0.1').sim, 3);
  const pk = cap.links[trunk].pkts;
  const s = sum(pk);
  assert.deepEqual(s.slice(0, 4).map((x) => x.info.split(' - ')[0]), ['DHCP Discover', 'DHCP Offer', 'DHCP Request', 'DHCP ACK']);
  assert.ok(s.every((x) => x.vlan === 10 || x.vlan === 20), 'mọi gói trên trunk có tag');
  assert.ok(s.some((x) => x.vlan === 20 && x.proto === 'ICMP') && s.some((x) => x.vlan === 10 && x.proto === 'ICMP'), 'ping liên VLAN đi qua trunk 2 lần');
  assert.match(s.find((x) => x.proto === 'TELNET').info, /→ 23 \[SYN\]/);
  const f = (e) => pk.filter(C.compileFilter(e).fn).length;
  assert.equal(f('vlan.id == 20'), s.filter((x) => x.vlan === 20).length);
  assert.equal(f('tcp.port == 23'), 2);
  assert.equal(f('icmp && ip.addr == 10.20.0.10'), 16);
  assert.equal(f('udp'), 4);
  assert.equal(f('arp || dhcp'), s.filter((x) => x.proto === 'ARP' || x.proto === 'DHCP').length);
  assert.equal(f('!icmp and not (arp or udp)'), 2);
  assert.equal(f(''), pk.length);
  for (const bad of ['ip.addr == 10.1', 'foo', 'icmp &&', 'tcp.port == x', '(icmp']) assert.ok(C.compileFilter(bad).error, bad);
});

test('gói định kỳ theo cấu hình: OSPF 10 s, EIGRP 5 s, HSRP 3 s, BPDU 2 s; thiết bị tắt thì im lặng', () => {
  const { net, cli, link } = twonet();
  runScript(cli, 'r1', cfg('interface g0/0', 'standby 1 ip 10.1.1.254', 'router ospf 1', 'network 10.0.0.0 0.255.255.255 area 0', 'router eigrp 10', 'network 10.0.0.0'));
  const lr = link('r1', 'g0/0');
  const cap = C.createCapture();
  C.startCapture(cap, lr, 0);
  for (let t = 0; t < 30; t++) C.tickCapture(cap, net, t);
  const n = (proto) => sum(cap.links[lr].pkts).filter((x) => x.proto === proto).length;
  assert.deepEqual([n('OSPF'), n('EIGRP'), n('HSRP'), n('STP')], [3, 6, 10, 15]);
  const ospf = cap.links[lr].pkts.find((p) => C.protoOf(p) === 'OSPF').layers;
  assert.equal(ospf[1].fields.dst, '224.0.0.5');
  assert.equal(ospf[2].fields.areaId, '0.0.0.0');
  assert.match(C.summarize(cap.links[lr].pkts.find((p) => C.protoOf(p) === 'HSRP')).info, /state Active/);
  S.stopDevice(net, 'r1');
  S.stopDevice(net, 'sw1');
  const k = cap.links[lr].pkts.length;
  for (let t = 30; t < 60; t++) C.tickCapture(cap, net, t);
  assert.equal(cap.links[lr].pkts.length, k, 'cả 2 đầu dây tắt → không còn gói định kỳ');
});

test('.pcap hợp lệ: magic libpcap, linktype Ethernet, đúng số record và độ dài từng gói', () => {
  const { cli, link } = twonet();
  const cap = C.createCapture();
  const l1 = link('pc1', 'fa0');
  C.startCapture(cap, l1, 0);
  C.recordSim(cap, cli.exec('pc1', 'ping 10.2.2.10').sim, 1, { repeat: 4 });
  const pk = cap.links[l1].pkts;
  const b = C.capturePcap(pk, 1761550000);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  assert.equal(dv.getUint32(0, true), 0xa1b2c3d4, 'magic');
  assert.equal(dv.getUint32(20, true), 1, 'LINKTYPE_ETHERNET');
  let off = 24, recs = 0, lastTs = 0;
  while (off < b.length) {
    const ts = dv.getUint32(off, true) + dv.getUint32(off + 4, true) / 1e6;
    const incl = dv.getUint32(off + 8, true), orig = dv.getUint32(off + 12, true);
    assert.equal(incl, pk[recs].bytes.length);
    assert.equal(orig, incl);
    assert.ok(ts >= lastTs && ts >= 1761550000);
    lastTs = ts;
    off += 16 + incl;
    recs++;
  }
  assert.equal(off, b.length, 'không thừa/thiếu byte');
  assert.equal(recs, pk.length);
});

test('dây bị xoá → bỏ phần bắt gói của dây đó', () => {
  const { net, link } = twonet();
  const cap = C.createCapture();
  const l1 = link('pc1', 'fa0');
  C.startCapture(cap, l1, 0);
  S.disconnect(net, l1);
  C.pruneCapture(cap, net);
  assert.equal(C.isCapturing(cap, l1), false);
  assert.deepEqual(Object.keys(cap.links), []);
});
