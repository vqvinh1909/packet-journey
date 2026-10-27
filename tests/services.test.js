// tests/services.test.js — CCNA Services: UDP checksum, DHCP, DNS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, findField } from '../packet/serialize.js';
import { internetChecksum, pseudoHeaderV4 } from '../packet/checksum.js';
import { parseIp } from '../packet/addr.js';
import { DHCP_MSG } from '../protocols/dhcp.js';

function dnsQuery() {
  return serialize([
    { proto: 'ethernet', fields: { dst: '00:1a:2b:00:00:ff', src: '00:1a:2b:00:00:01', etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '192.168.1.10', dst: '8.8.8.8', ttl: 64, id: 1, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 50000, dstPort: 53 } },
    { proto: 'dns', fields: { id: 0x1234, response: false, qname: 'www.example.com', qtype: 1 } },
  ]);
}

test('UDP checksum (pseudo-header) hợp lệ: tính lại = 0', () => {
  const { bytes, tree } = dnsQuery();
  const udp = tree.find((l) => l.layer === 'udp');
  const seg = Array.from(bytes.slice(udp.byteOffset)); // UDP header + DNS payload
  const ph = pseudoHeaderV4(parseIp('192.168.1.10'), parseIp('8.8.8.8'), 17, seg.length);
  assert.equal(internetChecksum(ph.concat(seg)), 0);
});

test('UDP: cổng đích 53 (DNS), Length = 8 + payload', () => {
  const { tree } = dnsQuery();
  assert.equal(findField(tree, 'udp.dst').display, '53 — DNS');
  const dns = tree.find((l) => l.layer === 'dns');
  assert.equal(findField(tree, 'udp.len').display, `${8 + dns.byteLength} byte`);
});

test('DNS: QNAME mã hóa nhãn đúng (3 www 7 example 3 com 0) + flags query 0x0100', () => {
  const { bytes, tree } = dnsQuery();
  const q = findField(tree, 'dns.qname');
  const name = Array.from(bytes.slice(q.byteOffset, q.byteOffset + q.byteLength));
  assert.deepEqual(name.slice(0, 5), [3, 0x77, 0x77, 0x77, 7]); // 3,'w','w','w',7
  assert.equal(name[name.length - 1], 0); // kết thúc
  assert.equal(findField(tree, 'dns.flags').display, '0x0100 — Query');
});

test('DNS response: con trỏ nén 0xC00C + địa chỉ A', () => {
  const { bytes, tree } = serialize([
    { proto: 'ethernet', fields: { dst: '00:1a:2b:00:00:01', src: '00:1a:2b:00:00:ff', etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '8.8.8.8', dst: '192.168.1.10', ttl: 64, id: 1, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 53, dstPort: 50000 } },
    { proto: 'dns', fields: { id: 0x1234, response: true, qname: 'www.example.com', answers: [{ ip: '93.184.216.34', ttl: 300 }] } },
  ]);
  const nm = findField(tree, 'dns.ans0.name');
  assert.equal(bytes[nm.byteOffset], 0xc0);
  assert.equal(bytes[nm.byteOffset + 1], 0x0c);
  assert.equal(findField(tree, 'dns.ans0.rdata').display, '93.184.216.34');
});

function dhcpDiscover() {
  return serialize([
    { proto: 'ethernet', fields: { dst: 'ff:ff:ff:ff:ff:ff', src: '00:1a:2b:00:00:01', etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '0.0.0.0', dst: '255.255.255.255', ttl: 64, id: 1, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 68, dstPort: 67 } },
    { proto: 'dhcp', fields: { op: 1, xid: 0x3903f326, flags: 0x8000, chaddr: '00:1a:2b:00:00:01',
      options: [{ code: 53, data: [DHCP_MSG.DISCOVER] }] } },
  ]);
}

test('DHCP Discover: op=1, magic cookie, Opt53=DISCOVER, kết thúc 0xFF, cổng 68→67', () => {
  const { bytes, tree } = dhcpDiscover();
  assert.equal(findField(tree, 'dhcp.op').display, '1 — Request');
  const cookie = findField(tree, 'dhcp.cookie');
  assert.deepEqual(Array.from(bytes.slice(cookie.byteOffset, cookie.byteOffset + 4)), [0x63, 0x82, 0x53, 0x63]);
  assert.equal(findField(tree, 'dhcp.opt53').display, '1 — DISCOVER');
  assert.equal(bytes[bytes.length - 1], 0xff); // Opt 255 End
  assert.equal(findField(tree, 'udp.src').display, '68 — DHCP client');
  assert.equal(findField(tree, 'udp.dst').display, '67 — DHCP server');
});

test('DHCP: UDP checksum hợp lệ qua broadcast', () => {
  const { bytes, tree } = dhcpDiscover();
  const udp = tree.find((l) => l.layer === 'udp');
  const seg = Array.from(bytes.slice(udp.byteOffset));
  const ph = pseudoHeaderV4(parseIp('0.0.0.0'), parseIp('255.255.255.255'), 17, seg.length);
  assert.equal(internetChecksum(ph.concat(seg)), 0);
});
