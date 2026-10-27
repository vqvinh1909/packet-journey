// ui/store.js — lưu/đọc tùy chọn nhẹ qua localStorage (có guard an toàn).
const PREFIX = 'pj_';

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* chế độ riêng tư / bị chặn — bỏ qua, app vẫn chạy */
  }
}

// ----- Tiến độ học -----

/** Đánh dấu một kịch bản đã xem hết. */
export function markDone(id) {
  const done = load('done', {});
  if (!done[id]) { done[id] = true; save('done', done); }
}
export function getDone() { return load('done', {}); }

/** Xuất toàn bộ tiến độ (mọi key pj_*) ra object để lưu file. */
export function exportAll() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k));
    }
  } catch { /* bỏ qua */ }
  return out;
}

/** Nhập tiến độ từ object (ghi đè các key tương ứng). */
export function importAll(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  let n = 0;
  for (const [k, v] of Object.entries(obj)) { save(k, v); n += 1; }
  return n;
}
