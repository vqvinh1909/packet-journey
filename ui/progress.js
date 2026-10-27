// ui/progress.js — modal Tiến độ học: kịch bản đã xem, điểm quiz, và xuất/nhập tiến độ.
import { SCENARIOS } from '../scenarios/index.js';
import { quizFor } from '../scenarios/quizzes.js';
import { getDone, load, exportAll, importAll } from './store.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

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
      const quizTxt = quiz ? (best != null ? `quiz ${best}/${quiz.length}` : `quiz 0/${quiz.length}`) : '—';
      return `<div class="pg-row"><span class="pg-chk">${isDone ? '✓' : '○'}</span>` +
        `<span class="pg-name">${esc(s.meta.titleVi)}</span><span class="pg-quiz">${quizTxt}</span></div>`;
    }).join('');
    body.innerHTML = rows;
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
      } catch { alert('File không hợp lệ.'); }
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
