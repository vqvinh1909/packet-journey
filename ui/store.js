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

let warnedFull = false;
/** Trả true nếu đã ghi được. Bộ nhớ đầy thì báo một lần, vì từ đó mọi thay đổi đều không được lưu. */
export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) {
    // chế độ riêng tư / bị chặn thì bỏ qua, app vẫn chạy
    if (!warnedFull && (e?.name === 'QuotaExceededError' || e?.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      warnedFull = true;
      globalThis.alert?.('Bộ nhớ trình duyệt đã đầy nên thay đổi mới KHÔNG được lưu. Hãy xuất dữ liệu ra file (💾 Tiến độ, ⬇ Xuất) rồi xoá bớt lab hoặc sơ đồ cũ.');
    }
    return false;
  }
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* bỏ qua */ }
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

// Các khoá mà giao diện đọc ngay khi mở: sai kiểu sẽ làm cửa sổ hỏng ở mọi lần mở sau.
const IMPORT_KINDS = {
  done: 'object', 'labs-done': 'object', weak: 'object', 'subnet-stats': 'object', 'roadmap-read': 'object', 'lab-star': 'object', 'labexam-best': 'object',
  'break-history': 'array', 'ccna-exam-hist': 'array', 'subnet-runs': 'array',
};
const kindOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
const isProgressKey = (k) => k in IMPORT_KINDS || /^(quiz_|lablog:|labnote:|labans:)/.test(k);

/** Nhập tiến độ từ object (ghi đè các key tương ứng). Ném lỗi và không ghi gì nếu file không phải tiến độ. */
export function importAll(obj) {
  if (kindOf(obj) !== 'object' || !Object.keys(obj).some(isProgressKey)) throw new Error('Không phải file tiến độ');
  for (const [k, kind] of Object.entries(IMPORT_KINDS)) if (k in obj && kindOf(obj[k]) !== kind) throw new Error(`Khoá ${k} sai kiểu`);
  for (const [k, v] of Object.entries(obj)) if (k.startsWith('quiz_') && !Number.isFinite(v)) throw new Error(`Khoá ${k} sai kiểu`);
  let n = 0;
  for (const [k, v] of Object.entries(obj)) { save(k, v); n += 1; }
  return n;
}
