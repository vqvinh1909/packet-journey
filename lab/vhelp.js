// lab/vhelp.js — trợ giúp "?" và Tab hoàn thành lệnh cho CLI các hãng (FortiOS, PAN-OS).
// Cây lệnh khai báo bằng danh sách [mẫu, mô tả]; mẫu là các từ cách nhau bởi dấu cách:
//   từ khoá   — phải gõ đúng (không phân biệt hoa thường; Tab/"?" gợi ý theo tiền tố)
//   <tên>     — tham số bất kỳ (1 từ), vd <ip> <name>
//   <tên...>  — tham số nhận mọi từ còn lại

const isArg = (t) => t.startsWith('<');
const isRest = (t) => t.endsWith('...>');

/** Từ đã gõ khớp `n` từ đầu của mẫu không? (tham số "..." nuốt hết phần còn lại) */
function matchHead(toks, typed) {
  for (let i = 0; i < typed.length; i++) {
    const t = toks[i];
    if (t == null) return false;
    if (isRest(t)) return true;
    if (!isArg(t) && t.toLowerCase() !== typed[i].toLowerCase()) return false;
  }
  return true;
}

/**
 * Các lựa chọn tiếp theo cho dòng `text` (chưa có "?"): [{ word, desc }]; word '<Enter>' = lệnh đã đủ.
 * `words` = mô tả cho từ khoá trung gian, theo cả đường lệnh hoặc theo từ (vd { 'get system': '…', get: '…' }).
 */
export function nextChoices(entries, text, words = {}) {
  const parts = text.trim() ? text.trim().split(/\s+/) : [];
  const partial = /\s$/.test(text) || !parts.length ? '' : parts.pop();
  const out = new Map();
  for (const [pat, desc] of entries) {
    const toks = pat.split(' ');
    if (!matchHead(toks, parts)) continue;
    const n = parts.length;
    if (toks.slice(0, n).some(isRest)) { if (!partial) out.set('<Enter>', 'Finish input'); continue; }
    const t = toks[n];
    if (t == null) { if (!partial) out.set('<Enter>', 'Finish input'); continue; }
    if (partial && (isArg(t) || !t.toLowerCase().startsWith(partial.toLowerCase()))) continue;
    // từ cuối (hoặc chỉ còn tham số phía sau) → mô tả của lệnh; từ trung gian → mô tả theo đường lệnh / theo từ
    const leaf = toks.slice(n + 1).every(isArg);
    if (!out.has(t)) out.set(t, leaf ? desc : words[[...parts, t].join(' ').toLowerCase()] || words[t] || desc);
  }
  const list = [...out].map(([word, desc]) => ({ word, desc }));
  return list.sort((a, b) => (a.word === '<Enter>') - (b.word === '<Enter>') || isArg(a.word) - isArg(b.word) || a.word.localeCompare(b.word));
}

/** Tab: hoàn thành từ đang gõ dở nếu chỉ có 1 khả năng (hoặc kéo tới tiền tố chung dài nhất). null = không đổi. */
export function completeLine(entries, line) {
  const m = String(line).match(/^(.*?)(\S+)$/);
  if (!m) return null;
  const words = nextChoices(entries, line).map((c) => c.word).filter((w) => w !== '<Enter>' && !isArg(w));
  if (!words.length) return null;
  if (words.length === 1) return m[1] + words[0] + ' ';
  let p = words[0];
  for (const w of words) while (!w.toLowerCase().startsWith(p.toLowerCase())) p = p.slice(0, -1);
  return p.length > m[2].length ? m[1] + p : null;
}
