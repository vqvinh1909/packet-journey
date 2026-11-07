// ui/progress.js — modal Tiến độ học: kịch bản đã xem, điểm quiz, và xuất/nhập tiến độ.
import { esc } from './topo.js';
import { SCENARIOS } from '../scenarios/index.js';
import { quizFor, QUIZ_LEN } from '../scenarios/quizzes.js';
import { getDone, load, exportAll, importAll } from './store.js';


export function openProgress() {
  document.querySelector('.modal-backdrop')?.remove();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  back.appendChild(modal);
  modal.innerHTML =
    `<div class="modal-h"><span>💾 Tiến độ học</span><button class="modal-x" aria-label="đóng">✕</button></div>` +
    `<div class="modal-score" id="pg-sum"></div>` +
    `<div class="modal-b" id="pg-body"></div>` +
    `<div class="pg-foot"><button id="pg-export" class="btn-accent">⬇ Xuất tiến độ (.json)</button>` +
    `<button id="pg-import">⬆ Nhập tiến độ</button><input id="pg-file" type="file" accept="application/json" hidden /></div>`;
  const body = modal.querySelector('#pg-body');

  function render() {
    const done = getDone();
    let nDone = 0;
    const rows = SCENARIOS.map((s) => {
      const id = s.meta.id;
      const isDone = !!done[id];
      if (isDone) nDone += 1;
      const quiz = quizFor(id);
      const best = load(`quiz_${id}`, null);
      const quizTxt = quiz ? `quiz ${best ?? 0}/${QUIZ_LEN}` : '—';
      return `<div class="pg-row"><span class="pg-chk">${isDone ? '✓' : '○'}</span>` +
        `<span class="pg-name">${esc(s.meta.titleVi)}</span><span class="pg-quiz">${quizTxt}</span></div>`;
    }).join('');
    // Lab CLI + 🎲 Phá mạng ngẫu nhiên (lịch sử lưu ở "break-history", cũng nằm trong file xuất tiến độ)
    const labsDone = Object.keys(load('labs-done', {})).length;
    const brk = load('break-history', []);
    const brkOk = brk.filter((h) => !h.revealed);
    const extra = `<div class="pg-row"><span class="pg-chk">🧪</span><span class="pg-name">Lab CLI đã xong</span><span class="pg-quiz">${labsDone} lab</span></div>` +
      `<div class="pg-row"><span class="pg-chk">🎲</span><span class="pg-name">Phá mạng ngẫu nhiên: ${brk.length} lượt (tự sửa không xem đáp án ${brkOk.length})</span><span class="pg-quiz">${brk[0] ? 'gần nhất ' + esc(brk[0].src) : '—'}</span></div>`;
    const sn = Object.values(load('subnet-stats', {})).reduce((a, x) => ({ n: a.n + x.n, ok: a.ok + x.ok }), { n: 0, ok: 0 });
    const snRuns = load('subnet-runs', []);
    const subnet = `<div class="pg-row"><span class="pg-chk">🧮</span><span class="pg-name">Luyện subnet: ${sn.n} câu, đúng ${sn.n ? Math.round((sn.ok / sn.n) * 100) : 0}%</span><span class="pg-quiz">${snRuns.length} bộ 10 câu</span></div>`;
    body.innerHTML = extra + subnet + rows;
    modal.querySelector('#pg-sum').textContent = `Đã xem ${nDone}/${SCENARIOS.length} kịch bản`;
  }
  render();

  modal.querySelector('#pg-export').onclick = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'packet-journey-tiendo.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  modal.querySelector('#pg-import').onclick = () => modal.querySelector('#pg-file').click();
  modal.querySelector('#pg-file').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const n = importAll(JSON.parse(reader.result));
        render();
        modal.querySelector('#pg-sum').textContent += ` · đã nhập ${n} mục (tải lại trang để áp dụng đầy đủ)`;
      } catch (err) { alert(`File không hợp lệ: ${err.message}.`); }
    };
    reader.readAsText(file);
  };

  const close = () => back.remove();
  modal.querySelector('.modal-x').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });
  document.body.appendChild(back);
}
