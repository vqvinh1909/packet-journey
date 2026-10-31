// ui/weak.js — "📊 Điểm yếu của tôi": biểu đồ điểm theo chủ đề (SVG), lệnh gõ sai nhiều nhất kèm cú pháp đúng,
// 3–5 lab nên làm, nút "🎲 Phá mạng" cho chủ đề yếu nhất. Dữ liệu ở localStorage "weak" (lab/weak.js) — ghi bởi
// trackCmd / trackLab (gọi từ ui/lab.js, ui/quiz.js), cộng thêm "break-history" và "subnet-stats".
import { esc } from './topo.js';
import * as W from '../lab/weak.js';
import { LABS, getLab, solutionOf } from '../lab/labs.js';
import { load, save } from './store.js';

const WEAK_BELOW = 50;

export const getWeak = () => load('weak', null) || W.emptyWeak();
/** Ghi 1 lệnh gõ trong Lab CLI (xem W.recordCmd). */
export function trackCmd(e) { save('weak', W.recordCmd(getWeak(), e)); }
/** Ghi sự kiện lab: hint / sol / fail / quiz / done / time (xem W.recordLab). */
export function trackLab(type, lab, x) { save('weak', W.recordLab(getWeak(), type, lab, x)); }

/** Tính toàn bộ số liệu cho trang (dùng lại được ở chỗ khác). */
export function weakReport() {
  const w = getWeak();
  const scores = W.topicScores(w, { subnet: load('subnet-stats', {}), breaks: load('break-history', []), labOf: getLab });
  const done = load('labs-done', {});
  return { w, scores, done, errors: W.topErrors(w, 8), recs: W.recommend(scores, LABS, done, 5) };
}

/** Biểu đồ thanh ngang: 1 dãy (điểm 0–100), 1 màu; chủ đề yếu có ⚠ + nhãn, chưa đủ dữ liệu thì nét đứt. */
function chartSvg(scores) {
  const rowH = 22, top = 22, left = 128, barW = 250, H = top + scores.length * rowH + 6, Wd = left + barW + 44;
  const x = (v) => left + (barW * v) / 100;
  let g = `<svg class="wk-chart" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Điểm theo chủ đề, thang 0–100">`;
  for (const v of [0, 50, 70, 100]) g += `<line class="wk-grid${v === WEAK_BELOW ? ' mid' : ''}" x1="${x(v)}" x2="${x(v)}" y1="${top - 6}" y2="${H - 4}"/><text class="wk-axis" x="${x(v)}" y="${top - 10}" text-anchor="middle">${v}</text>`;
  scores.forEach((s, i) => {
    const y = top + i * rowH, weak = s.score != null && s.score < WEAK_BELOW;
    const p = s.parts;
    const tip = s.score == null ? `${s.topic}: chưa đủ dữ liệu` :
      `${s.topic}: ${s.score}/100 — lệnh đúng ${p.ok}, lệnh sai ${p.err}, gợi ý ${p.hint}, xem lời giải ${p.sol}, nhiệm vụ trượt ${p.fail}, quiz đúng/sai ${p.qok}/${p.qbad}, lab xong ${p.done}${p.brkOk + p.brkBad ? `, phá mạng tự sửa/xem đáp án ${p.brkOk}/${p.brkBad}` : ''}${p.snOk + p.snBad ? `, câu subnet đúng/sai ${p.snOk}/${p.snBad}` : ''}`;
    g += `<g class="wk-row${weak ? ' weak' : ''}" data-topic="${esc(s.topic)}"><title>${esc(tip)}</title>` +
      `<rect class="wk-hit" x="0" y="${y}" width="${Wd}" height="${rowH}"/>` +
      `<text class="wk-name" x="${left - 8}" y="${y + rowH / 2 + 4}" text-anchor="end">${weak ? '⚠ ' : ''}${esc(s.topic)}</text>`;
    if (s.score == null) g += `<line class="wk-none" x1="${left}" x2="${left + 40}" y1="${y + rowH / 2}" y2="${y + rowH / 2}"/><text class="wk-val muted" x="${left + 48}" y="${y + rowH / 2 + 4}">chưa đủ dữ liệu</text>`;
    else {
      const w = Math.max(4, x(s.score) - left);
      g += `<path class="wk-bar" d="M${left},${y + 5}h${w - 4}a4,4 0 0 1 4,4v${rowH - 18}a4,4 0 0 1 -4,4h${-(w - 4)}z"/>` +
        `<text class="wk-val" x="${left + w + 6}" y="${y + rowH / 2 + 4}">${s.score}${weak ? ' yếu' : ''}</text>`;
    }
    g += `</g>`;
  });
  return g + `</svg>`;
}

/** o.openLab(id, { breakLab }) — mở Lab CLI ở lab `id` (hoặc mở hộp thoại 🎲 phá mạng với lab gợi ý). */
export function openWeak(o = {}) {
  document.querySelector('.modal-backdrop')?.remove();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal wk-modal';
  back.appendChild(modal);
  const close = () => { back.remove(); document.removeEventListener('keydown', onEsc); };
  function onEsc(e) { if (e.key === 'Escape') close(); }

  function render() {
    const { w, scores, done, errors, recs } = weakReport();
    const known = scores.filter((s) => s.score != null).sort((a, b) => a.score - b.score);
    const weakest = known[0];
    const brkId = weakest ? W.breakLabFor(weakest.topic, LABS, done, (l) => solutionOf(l).length > 0) : null;
    const nCmd = Object.values(w.topics).reduce((a, t) => a + t.ok + t.err, 0);
    const nErr = Object.values(w.errs).reduce((a, e) => a + e.n, 0);
    modal.innerHTML =
      `<div class="modal-h"><span>📊 Điểm yếu của tôi</span><button class="modal-x" aria-label="đóng">✕</button></div>` +
      `<div class="modal-b wk-body">` +
      `<p class="wk-note">Tổng hợp từ Lab CLI (lệnh gõ sai, nhiệm vụ trượt, gợi ý / lời giải đã mở, quiz, thời gian), 🎲 Phá mạng và 🧮 Luyện subnet. ` +
      `Đã ghi ${nCmd} lệnh (${nErr} lệnh lỗi) · ${Object.keys(done).length} lab xong. Rê chuột lên từng thanh để xem chi tiết.</p>` +
      chartSvg(scores) +
      (weakest ? `<div class="wk-focus">Chủ đề yếu nhất: <b>${esc(weakest.topic)}</b> (${weakest.score}/100)` +
        (brkId ? ` <button class="btn-accent" id="wk-break" data-id="${brkId}" title="Gài lỗi ngẫu nhiên vào lab ${brkId} để luyện xử lý sự cố">🎲 Phá mạng chủ đề ${esc(weakest.topic)}</button>` : '') + `</div>`
        : `<div class="wk-focus">Chưa đủ dữ liệu để chấm — làm vài lab, luyện subnet hoặc chơi 🎲 Phá mạng rồi quay lại.</div>`) +
      `<h4>🧭 Nên làm tiếp</h4><ol class="wk-recs">${recs.map((r) => `<li><button class="wk-open" data-id="${r.id}">${esc(r.id)}</button> ${esc(r.title)}${done[r.id] ? ' <span class="wk-done">✓ đã xong</span>' : ''}<div class="wk-why">${esc(r.why)}</div></li>`).join('')}</ol>` +
      `<h4>⌨️ Lệnh gõ sai nhiều nhất</h4>` +
      (errors.length ? `<table class="wk-tbl"><tr><th>Bạn gõ</th><th>Lỗi</th><th>Lần</th><th>Cú pháp đúng</th></tr>${errors.map((e) => `<tr><td><code>${esc(e.cmd)}</code>${e.lab ? `<div class="wk-why">${esc(e.lab)}${e.topic ? ' · ' + esc(e.topic) : ''}</div>` : ''}</td><td>${esc(W.ERR_LABEL[e.kind])}</td><td>${e.n}</td>` +
        `<td>${e.sug?.length ? e.sug.slice(0, 2).map((x) => `<div><code>${esc(x.spec)}</code> <span class="wk-mode${x.here === false ? ' other' : ''}" title="${x.here === false ? 'Lệnh này dùng ở chế độ khác — bạn đang gõ sai chế độ' : 'Chế độ dùng lệnh'}">${esc(W.MODE_PROMPT[x.mode] || x.mode)}</span></div>`).join('') : '<span class="wk-why">gõ <code>?</code> để xem lệnh hợp lệ</span>'}</td></tr>`).join('')}</table>` : '<div class="wk-why">Chưa có lệnh gõ sai nào được ghi nhận.</div>') +
      `<details class="wk-table"><summary>Xem dạng bảng</summary><table class="wk-tbl"><tr><th>Chủ đề</th><th>Điểm</th><th>Tốt</th><th>Chưa tốt</th></tr>${scores.map((s) => `<tr><td>${esc(s.topic)}</td><td>${s.score ?? '—'}</td><td>${s.good}</td><td>${s.bad}</td></tr>`).join('')}</table></details>` +
      `</div><div class="pg-foot"><button id="wk-reset">Xoá dữ liệu điểm yếu</button></div>`;
    modal.querySelector('.modal-x').onclick = close;
    modal.querySelectorAll('.wk-open').forEach((b) => (b.onclick = () => { close(); o.openLab?.(b.dataset.id); }));
    const bk = modal.querySelector('#wk-break');
    if (bk) bk.onclick = () => { close(); o.openLab?.(bk.dataset.id, { breakLab: bk.dataset.id }); };
    modal.querySelector('#wk-reset').onclick = () => { if (confirm('Xoá dữ liệu điểm yếu (lệnh sai, gợi ý, thời gian…)? Tiến độ lab, lịch sử phá mạng và thống kê subnet vẫn giữ.')) { save('weak', W.emptyWeak()); render(); } };
  }
  render();
  back.onclick = (e) => { if (e.target === back) close(); };
  document.addEventListener('keydown', onEsc);
  document.body.appendChild(back);
}
