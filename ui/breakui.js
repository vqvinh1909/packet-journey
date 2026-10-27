// ui/breakui.js — hộp thoại "🎲 Phá mạng ngẫu nhiên": chọn lab (ưu tiên lab đã xong), số lỗi 1–3, seed (để
// tái hiện), xem lịch sử các lượt đã chơi. Logic gài lỗi ở lab/breaker.js; đề chạy trong Lab CLI như một ticket.
import { LABS, LAB_GROUPS, solutionOf } from '../lab/labs.js';
import { breakId, breakLab, pickBreakLab, randomSeed, rng, breakScore } from '../lab/breaker.js';
import { load } from './store.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

/** Mở hộp thoại trong `host` (modal Lab CLI). o = { labId (gợi ý chọn sẵn), n, onStart(id) }. */
export function openBreakDialog(host, o) {
  host.querySelector('.brk-back')?.remove();
  const done = load('labs-done', {});
  const hist = load('break-history', []);
  const back = document.createElement('div');
  back.className = 'brk-back';
  const opts = LAB_GROUPS.map((g) => {
    const ls = LABS.filter((l) => l.group === g.id && solutionOf(l).length);
    return ls.length ? `<optgroup label="${esc(g.title)}">${ls.map((l) => `<option value="${l.id}"${l.id === o.labId ? ' selected' : ''}>${done[l.id] ? '✓ ' : ''}${l.id} — ${esc(l.title)}</option>`).join('')}</optgroup>` : '';
  }).join('');
  const solved = hist.filter((h) => !h.revealed);
  const avg = solved.length ? Math.round(solved.reduce((a, h) => a + breakScore(h), 0) / solved.length) : null;
  back.innerHTML = `<div class="brk-dlg" role="dialog" aria-label="Phá mạng ngẫu nhiên">` +
    `<h3>🎲 Phá mạng ngẫu nhiên</h3>` +
    `<p class="brk-note">Mạng của lab được dựng đúng (chạy lời giải) rồi bị gài lỗi ngẫu nhiên — bạn không biết lỗi gì. Chẩn đoán bằng show / ping và sửa cho mọi nhiệm vụ gốc đạt lại. Cùng seed → cùng đề (gửi bạn bè thử cùng đề).</p>` +
    `<label>Lab <select id="brk-lab"><option value="">🎲 Ngẫu nhiên (ưu tiên lab đã xong)</option>${opts}</select></label>` +
    `<div class="brk-row"><fieldset><legend>Độ khó</legend>${[1, 2, 3].map((n) => `<label class="brk-n"><input type="radio" name="brk-n" value="${n}"${n === (o.n || 1) ? ' checked' : ''}> ${n} lỗi</label>`).join('')}</fieldset>` +
    `<label>Seed <input id="brk-seed" inputmode="numeric" placeholder="để trống = ngẫu nhiên" autocomplete="off"></label></div>` +
    `<div class="brk-err" id="brk-err"></div>` +
    `<div class="brk-b"><button id="brk-go" class="btn-accent">🎲 Gài lỗi và bắt đầu</button><button id="brk-x">Đóng</button></div>` +
    `<div class="brk-hist"><div class="brk-hh">Lịch sử (${hist.length} lượt${avg != null ? ` · điểm TB ${avg}` : ''})</div>` +
    (hist.length ? `<table><tr><th>Lab</th><th>Lỗi</th><th>Thời gian</th><th>Gợi ý</th><th>Điểm</th><th>Seed</th></tr>${hist.slice(0, 8).map((h) => `<tr><td>${esc(h.src)}</td><td>${h.n}</td><td>${fmt(h.secs)}</td><td>${h.hints}</td><td>${h.revealed ? 'xem đáp án' : breakScore(h)}</td><td><button class="brk-again" data-id="${esc(h.id)}" title="Chơi lại đúng đề này">${h.seed}</button></td></tr>`).join('')}</table>` : '<div class="brk-none">Chưa có lượt nào.</div>') +
    `</div></div>`;
  host.appendChild(back);
  const $ = (id) => back.querySelector('#' + id);
  const close = () => back.remove();
  $('brk-x').onclick = close;
  back.onpointerdown = (e) => { if (e.target === back) close(); };
  back.querySelectorAll('.brk-again').forEach((b) => (b.onclick = () => { close(); o.onStart(b.dataset.id); }));
  $('brk-go').onclick = () => {
    const n = +back.querySelector('input[name="brk-n"]:checked').value;
    const seedTxt = $('brk-seed').value.trim();
    if (seedTxt && !/^\d{1,10}$/.test(seedTxt)) { $('brk-err').textContent = 'Seed là số nguyên dương.'; return; }
    const seed = seedTxt ? +seedTxt >>> 0 || 1 : randomSeed();
    const fixed = $('brk-lab').value;
    $('brk-go').disabled = true;
    $('brk-go').textContent = 'Đang gài lỗi…';
    setTimeout(() => {
      const r = rng(seed);
      // lab ngẫu nhiên: thử vài lab tới khi gài được lỗi (vài lab chỉ chấm cấu hình nên không phá được)
      for (let k = 0; k < (fixed ? 1 : 12); k++) {
        const lab = fixed ? LABS.find((l) => l.id === fixed) : pickBreakLab(done, r);
        const id = breakId(lab.id, n, seed);
        if (breakLab(id)) { close(); o.onStart(id); return; }
      }
      $('brk-go').disabled = false;
      $('brk-go').textContent = '🎲 Gài lỗi và bắt đầu';
      $('brk-err').textContent = fixed ? 'Lab này chỉ chấm cấu hình (mô tả, CDP, STP…) nên không gài được lỗi làm hỏng nhiệm vụ — chọn lab khác.' : 'Không gài được lỗi — thử lại.';
    }, 20);
  };
  $('brk-go').focus();
}
