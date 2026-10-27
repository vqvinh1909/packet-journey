// tests/advanced6.test.js — IPv6, ICMPv6 (NDP), OSPFv3, MSTP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, findField } from '../packet/serialize.js';
import { internetChecksum, pseudoHeaderV6 } from '../packet/checksum.js';
import { parseIpv6, ipv6ToString } from '../packet/addr.js';

test('IPv6 parse/format: rút gọn :: đúng', () => {
  assert.equal(parseIpv6('fe80::1').length, 16);
  assert.equal(ipv6ToString(parseIpv6('2001:db8::1')), '2001:db8::1');
  assert.equal(ipv6ToString(parseIpv6('fe80::2')), 'fe80::2');
});

function icmp6Echo() {
  return serialize([
    { proto: 'ethernet', fields: { dst: '33:33:00:00:00:01', src: '00:1a:2b:00:00:01', etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src: 'fe80::1', dst: 'fe80::2', nextHeader: 58, hopLimit: 64 } },
    { proto: 'icmpv6', fields: { type: 128, code: 0, identifier: 1, seq: 1, data: [1, 2, 3, 4] } },
  ]);
}

test('IPv6 header: 40 byte, version 6, Next Header 58, Hop Limit 64', () => {
  const { bytes, tree } = icmp6Echo();
  const ip6 = tree.find((l) => l.layer === 'ipv6');
  assert.equal(ip6.byteLength, 40);
  assert.equal(bytes[ip6.byteOffset] >> 4, 6);
  assert.equal(bytes[findField(tree, 'ip6.nh').byteOffset], 58);
  assert.equal(bytes[findField(tree, 'ip6.hop').byteOffset], 64);
});

test('ICMPv6 checksum hợp lệ (pseudo-header IPv6)', () => {
  const { bytes, tree } = icmp6Echo();
  const ic = tree.find((l) => l.layer === 'icmpv6');
  const seg = Array.from(bytes.slice(ic.byteOffset));
  const ph = pseudoHeaderV6(parseIpv6('fe80::1'), parseIpv6('fe80::2'), 58, seg.length);
  assert.equal(internetChecksum(ph.concat(seg)), 0);
});

test('NDP Neighbor Solicitation (135): có Target + option Source LLA', () => {
  const { tree } = serialize([
    { proto: 'ethernet', fields: { dst: '33:33:ff:00:00:02', src: '00:1a:2b:00:00:01', etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src: 'fe80::1', dst: 'ff02::1:ff00:2', nextHeader: 58, hopLimit: 255 } },
    { proto: 'icmpv6', fields: { type: 135, target: 'fe80::2', lladdr: '00:1a:2b:00:00:01' } },
  ]);
  assert.equal(findField(tree, 'icmp6.target').display, 'fe80::2');
  assert.ok(findField(tree, 'icmp6.opt'));
});

test('OSPFv3 Hello: version 3, checksum v6 hợp lệ', () => {
  const { bytes, tree } = serialize([
    { proto: 'ethernet', fields: { dst: '33:33:00:00:00:05', src: '00:1a:2b:00:00:01', etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src: 'fe80::1', dst: 'ff02::5', nextHeader: 89, hopLimit: 1 } },
    { proto: 'ospfv3', fields: { routerId: '1.1.1.1', areaId: '0.0.0.0', instanceId: 0 } },
  ]);
  assert.equal(bytes[findField(tree, 'ospf6.version').byteOffset], 3);
  const o = tree.find((l) => l.layer === 'ospfv3');
  const seg = Array.from(bytes.slice(o.byteOffset));
  const ph = pseudoHeaderV6(parseIpv6('fe80::1'), parseIpv6('ff02::5'), 89, seg.length);
  assert.equal(internetChecksum(ph.concat(seg)), 0);
});

test('MSTP: BPDU version 3 + phần mở rộng, V3 Length đúng', () => {
  const { tree } = serialize([
    { proto: 'ethernet', fields: { dst: '01:80:c2:00:00:00', src: '00:00:0c:aa:00:01', mode: '802.3' } },
    { proto: 'llc', fields: {} },
    { proto: 'stp', fields: { version: 3, type: 2, rootPriority: 4096, rootMac: '00:00:0c:aa:00:01', rootPathCost: 0, bridgePriority: 4096, bridgeMac: '00:00:0c:aa:00:01', portNumber: 1 } },
    { proto: 'mstp', fields: { regionName: 'REGION1', revision: 1, cistMac: '00:00:0c:aa:00:01',
      mstis: [{ instance: 1, rootPrio: 4096, rootMac: '00:00:0c:aa:00:01' }, { instance: 2, rootPrio: 4096, rootMac: '00:00:0c:aa:00:02' }] } },
  ]);
  assert.equal(findField(tree, 'mstp.v3len').display, '96 byte'); // 64 + 16*2
  assert.equal(findField(tree, 'mstp.region').display, 'REGION1');
  assert.ok(findField(tree, 'mstp.msti1.root'));
  assert.ok(findField(tree, 'mstp.msti2.root'));
});
