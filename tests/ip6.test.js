// tests/ip6.test.js — địa chỉ IPv6: phân tích, nén, prefix, EUI-64.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../lab/ip6.js';

test('phân tích và nén địa chỉ IPv6 (RFC 5952, in hoa kiểu Cisco)', () => {
  assert.equal(A.norm6('2001:0db8:0000:0000:0000:0000:0000:0001'), '2001:DB8::1');
  assert.equal(A.norm6('2001:db8:0:1:0:0:0:1'), '2001:DB8:0:1::1');
  assert.equal(A.norm6('::'), '::');
  assert.equal(A.norm6('fe80::1'), 'FE80::1');
  assert.equal(A.norm6('2001:db8:0:0:1:0:0:1'), '2001:DB8::1:0:0:1'); // chuỗi 0 đầu tiên khi bằng nhau
  for (const bad of ['2001:db8::1::2', '2001:db8:1', '12345::1', 'g::1', '1.2.3.4', '2001:db8::/64', '1:2:3:4:5:6:7:8:9']) assert.equal(A.parse6(bad), null, bad);
});

test('prefix, mạng, thuộc mạng, link-local', () => {
  assert.deepEqual(A.parsePrefix6('2001:DB8:A:1::1/64'), { ip: '2001:DB8:A:1::1', prefix: 64 });
  assert.equal(A.parsePrefix6('2001:db8::1/129'), null);
  assert.equal(A.net6('2001:db8:a:1::1', 64), '2001:DB8:A:1::');
  assert.equal(A.net6('2001:db8:a:1ff::1', 56), '2001:DB8:A:100::');
  assert.ok(A.in6('2001:db8:a:1::99', '2001:db8:a:1::', 64));
  assert.ok(!A.in6('2001:db8:a:2::1', '2001:db8:a:1::', 64));
  assert.ok(A.isLinkLocal('fe80::1') && !A.isLinkLocal('2001:db8::1'));
});

test('EUI-64 đảo bit U/L và chèn FFFE', () => {
  assert.equal(A.eui64('2001:db8:1::', '00:50:79:66:01:01'), '2001:DB8:1:0:250:79FF:FE66:101');
  assert.equal(A.linkLocal('00:d0:ba:03:00:01'), 'FE80::2D0:BAFF:FE03:1');
});
