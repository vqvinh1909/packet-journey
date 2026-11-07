// tests/builder.test.js — bài ngẫu nhiên của Builder: chấm điểm khớp với mô phỏng thật, tính lại bằng phép mask độc lập.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustom, predictOutcome, randomBuilder } from '../scenarios/builder.js';

const toInt = (ip) => ip.split('.').reduce((a, o) => a * 256 + Number(o), 0);
const net = (ip, pfx) => Math.floor(toInt(ip) / 2 ** (32 - pfx));
function seeded(seed) { return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); }

test('Builder: bài ngẫu nhiên đủ 3 loại, đáp án khớp phép tính mask và kết cục mô phỏng', () => {
  const rnd = seeded(7), seen = new Set();
  for (let i = 0; i < 600; i++) {
    const p = randomBuilder(rnd);
    const same = net(p.pc1Ip, p.pc1Prefix) === net(p.pc2Ip, p.pc1Prefix);
    const gwOk = p.pc1Gw && net(p.pc1Gw, p.pc1Prefix) === net(p.pc1Ip, p.pc1Prefix) && p.pc1Gw === p.routerIp;
    const want = same ? 'same' : gwOk ? 'cross' : 'fail';
    const r = predictOutcome(p);
    assert.equal(r.kind, want, JSON.stringify(p));
    assert.ok(r.why.includes(p.pc2Ip));
    const last = buildCustom(p).events.at(-1).titleVi;
    assert.match(last, want === 'fail' ? /HỎNG/ : /thành công/, JSON.stringify(p));
    assert.ok(![p.pc2Ip, p.pc1Gw].includes(p.pc1Ip), 'PC1 không trùng địa chỉ khác');
    seen.add(want);
  }
  assert.equal(seen.size, 3);
});
