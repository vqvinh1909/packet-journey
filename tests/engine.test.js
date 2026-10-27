// tests/engine.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameSubnet } from '../packet/addr.js';
import { RoutingTable } from '../engine/tables.js';
import { SCENARIOS } from '../scenarios/index.js';
import { findField } from '../packet/serialize.js';

test('sameSubnet: cùng/khác mạng theo prefix', () => {
  assert.equal(sameSubnet('192.168.1.10', '192.168.1.20', 24), true);
  assert.equal(sameSubnet('192.168.1.10', '192.168.2.10', 24), false);
  assert.equal(sameSubnet('10.0.0.1', '10.0.0.2', 30), true);
});

test('Routing: longest-prefix match chọn tuyến cụ thể nhất', () => {
  const rt = new RoutingTable([
    { network: '0.0.0.0', prefix: 0, nextHop: '1.1.1.1', iface: 'Gi0/0', kind: 'default' },
    { network: '192.168.0.0', prefix: 16, nextHop: '2.2.2.2', iface: 'Gi0/1' },
    { network: '192.168.2.0', prefix: 24, nextHop: '3.3.3.3', iface: 'Gi0/2' },
  ]);
  assert.equal(rt.lookup('192.168.2.10').prefix, 24);
  assert.equal(rt.lookup('192.168.5.10').prefix, 16);
  assert.equal(rt.lookup('8.8.8.8').prefix, 0);
});

test('Mọi kịch bản build() chạy được và có events + pcap', () => {
  for (const s of SCENARIOS) {
    const r = s.build();
    assert.ok(r.events.length > 0, `${s.meta.id} phải có events`);
    assert.ok(r.pcap.length > 0, `${s.meta.id} phải có frame pcap`);
    assert.ok(r.topology.devices.length > 0);
  }
});

test('Kịch bản 2: TTL giảm dần qua từng router (64 → 63 → 62)', () => {
  const s2 = SCENARIOS.find((s) => s.meta.id === 's02-ping-across-router').build();
  // Lấy các bước transit của Echo Request chiều đi có packet
  const ttls = s2.events
    .filter((e) => e.packet && e.packet.tree)
    .map((e) => {
      const f = findField(e.packet.tree, 'ip.ttl');
      return f ? Number(f.display) : null;
    })
    .filter((v) => v !== null);
  // Phải xuất hiện cả 64, 63, 62 trong hành trình
  assert.ok(ttls.includes(64));
  assert.ok(ttls.includes(63));
  assert.ok(ttls.includes(62));
});

test('Kịch bản 2: IP nguồn/đích GIỮ NGUYÊN khi qua router (chặng R1)', () => {
  const s2 = SCENARIOS.find((s) => s.meta.id === 's02-ping-across-router').build();
  const fwd = s2.events.find((e) => e.kind === 'process' && e.atDevice === 'r1' && e.changedFields.length);
  assert.ok(fwd, 'phải có bước R1 chuyển tiếp');
  // IP src/dst không nằm trong danh sách trường thay đổi; MAC + TTL + checksum thì có
  assert.ok(!fwd.changedFields.includes('ip.src'));
  assert.ok(!fwd.changedFields.includes('ip.dst'));
  assert.ok(fwd.changedFields.includes('ip.ttl'));
  assert.ok(fwd.changedFields.includes('ip.checksum'));
  assert.ok(fwd.changedFields.includes('eth.src'));
  assert.ok(fwd.changedFields.includes('eth.dst'));
});
