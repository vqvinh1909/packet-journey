// tests/dhcpv6.test.js — ICMPv6 RA/RS (SLAAC) + DHCPv6 (UDP trên IPv6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, findField } from '../packet/serialize.js';
import { internetChecksum, pseudoHeaderV6 } from '../packet/checksum.js';
import { parseIpv6 } from '../packet/addr.js';

test('ICMPv6 RA (134): có cờ M và Prefix Information', () => {
  const { bytes, tree } = serialize([
    { proto: 'ethernet', fields: { dst: '33:33:00:00:00:01', src: '00:1a:2b:00:00:ff', etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src: 'fe80::ff', dst: 'ff02::1', nextHeader: 58, hopLimit: 255 } },
    { proto: 'icmpv6', fields: { type: 134, raM: true, raO: false, prefix: '2001:db8:1::', prefixLen: 64 } },
  ]);
  assert.equal(bytes[findField(tree, 'icmp6.type').byteOffset], 134);
  const fl = findField(tree, 'icmp6.raflags');
  assert.equal(bytes[fl.byteOffset] & 0x80, 0x80); // M bit set
  assert.ok(findField(tree, 'icmp6.pio'));
});

test('ICMPv6 RS (133): type đúng', () => {
  const { bytes, tree } = serialize([
    { proto: 'ethernet', fields: { dst: '33:33:00:00:00:02', src: '00:1a:2b:00:00:01', etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src: 'fe80::1', dst: 'ff02::2', nextHeader: 58, hopLimit: 255 } },
    { proto: 'icmpv6', fields: { type: 133, lladdr: '00:1a:2b:00:00:01' } },
  ]);
  assert.equal(bytes[findField(tree, 'icmp6.type').byteOffset], 133);
});

function dhcp6Solicit() {
  return serialize([
    { proto: 'ethernet', fields: { dst: '33:33:00:01:00:02', src: '00:1a:2b:00:00:01', etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src: 'fe80::1', dst: 'ff02::1:2', nextHeader: 17, hopLimit: 1 } },
    { proto: 'udp', fields: { srcPort: 546, dstPort: 547 } },
    { proto: 'dhcpv6', fields: { msgType: 1, xid: 0xabcdef, options: [{ code: 1, data: [0, 1, 0, 1] }, { code: 3, data: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0] }] } },
  ]);
}

test('DHCPv6 SOLICIT: msg-type 1, xid, cổng 546→547', () => {
  const { tree } = dhcp6Solicit();
  assert.equal(findField(tree, 'dhcp6.type').display, '1 — SOLICIT');
  assert.equal(findField(tree, 'dhcp6.xid').display, '0xabcdef');
  assert.equal(findField(tree, 'udp.src').display, '546');
  assert.equal(findField(tree, 'udp.dst').display, '547');
});

test('UDP trên IPv6: checksum (pseudo-header v6) hợp lệ — tự nhận IPv6', () => {
  const { bytes, tree } = dhcp6Solicit();
  const udp = tree.find((l) => l.layer === 'udp');
  const seg = Array.from(bytes.slice(udp.byteOffset));
  const ph = pseudoHeaderV6(parseIpv6('fe80::1'), parseIpv6('ff02::1:2'), 17, seg.length);
  assert.equal(internetChecksum(ph.concat(seg)), 0);
});
