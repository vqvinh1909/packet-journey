// tests/graphsim.test.js — mô phỏng ping trên topology tự vẽ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateGraph } from '../scenarios/graphsim.js';

const H = (id, ip, prefix, gw) => ({ id, type: 'host', name: id.toUpperCase(), x: 0, y: 0, ip, prefix, gateway: gw });
const SW = (id) => ({ id, type: 'switch', name: id.toUpperCase(), x: 0, y: 0 });
const R = (id, rifaces) => ({ id, type: 'router', name: id.toUpperCase(), x: 0, y: 0, rifaces });
const L = (a, b) => ({ id: `${a}-${b}`, a, b });

test('Cùng mạng qua switch → ping OK', () => {
  const r = simulateGraph(
    [H('pc1', '192.168.1.10', 24), SW('sw'), H('pc2', '192.168.1.20', 24)],
    [L('pc1', 'sw'), L('sw', 'pc2')], 'pc1', 'pc2');
  assert.ok(!r.error, r.error);
  assert.ok(r.events.length > 0);
});

test('Khác mạng + gateway đúng → ping OK (qua router)', () => {
  const r = simulateGraph(
    [H('pc1', '192.168.1.10', 24, '192.168.1.1'),
      R('r1', { pc1: { ip: '192.168.1.1', prefix: 24 }, pc2: { ip: '192.168.2.1', prefix: 24 } }),
      H('pc2', '192.168.2.10', 24, '192.168.2.1')],
    [L('pc1', 'r1'), L('r1', 'pc2')], 'pc1', 'pc2');
  assert.ok(!r.error, r.error);
  // TTL phải giảm: có bước nào gói còn 63
  const ttls = r.events.filter((e) => e.packet).map((e) => {
    const f = e.packet.tree.find((l) => l.layer === 'ipv4');
    if (!f) return null;
    const ttl = f.fields.find((x) => x.name === 'ip.ttl');
    return ttl ? Number(ttl.display) : null;
  }).filter((x) => x !== null);
  assert.ok(ttls.includes(63), 'phải có TTL 63 sau router');
});

test('Khác mạng + gateway SAI → báo lỗi', () => {
  const r = simulateGraph(
    [H('pc1', '192.168.1.10', 24, '192.168.1.254'),
      R('r1', { pc1: { ip: '192.168.1.1', prefix: 24 }, pc2: { ip: '192.168.2.1', prefix: 24 } }),
      H('pc2', '192.168.2.10', 24, '192.168.2.1')],
    [L('pc1', 'r1'), L('r1', 'pc2')], 'pc1', 'pc2');
  assert.ok(r.error && r.error.includes('gateway'), r.error);
});

test('Không nối dây → báo lỗi không có đường', () => {
  const r = simulateGraph([H('pc1', '10.0.0.1', 24), H('pc2', '10.0.0.2', 24)], [], 'pc1', 'pc2');
  assert.ok(r.error && r.error.includes('Không có đường'));
});

test('Cùng đoạn L2 nhưng khác subnet → báo lỗi', () => {
  const r = simulateGraph(
    [H('pc1', '192.168.1.10', 24), SW('sw'), H('pc2', '10.0.0.5', 24)],
    [L('pc1', 'sw'), L('sw', 'pc2')], 'pc1', 'pc2');
  assert.ok(r.error && r.error.includes('subnet'), r.error);
});
