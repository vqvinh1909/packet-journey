// tests/store.test.js — lưu khi bộ nhớ đầy và kiểm tra file nhập tiến độ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { save, load, importAll } from '../ui/store.js';

function fakeStorage(full = () => false) {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (full()) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); m.set(k, v); },
    removeItem: (k) => m.delete(k),
  };
  return m;
}

test('save: bộ nhớ đầy thì trả false và chỉ báo một lần', () => {
  let isFull = false, alerts = 0;
  fakeStorage(() => isFull);
  globalThis.alert = () => { alerts += 1; };
  assert.equal(save('a', 1), true);
  isFull = true;
  assert.equal(save('b', 2), false);
  assert.equal(save('c', 3), false);
  assert.equal(alerts, 1);
  assert.equal(load('a', 0), 1);
  assert.equal(load('b', 0), 0);
  delete globalThis.alert;
});

test('importAll: từ chối file không phải tiến độ và không ghi gì', () => {
  const m = fakeStorage();
  for (const bad of [null, 5, [1, 2], {}, { format: 'packet-journey-sandbox', version: 1, net: {} }, { 'labs-done': { L01: true }, 'break-history': 5 }, { quiz_x: 'nhiều' }]) {
    assert.throws(() => importAll(bad), undefined, JSON.stringify(bad));
  }
  assert.equal(m.size, 0);
  assert.equal(importAll({ 'labs-done': { L01: true }, 'exam-lang': 'en' }), 2);
  assert.deepEqual(load('labs-done', {}), { L01: true });
});
