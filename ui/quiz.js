// ui/quiz.js — hộp Quiz cuối bài (modal). Câu hỏi sinh từ chính kịch bản.
// Lưu điểm cao nhất vào localStorage theo scenarioId.

import { esc } from './topo.js';
import { save, load } from './store.js';
import { trackLab } from './weak.js';


export function openQuiz(scenarioId, titleVi, quiz) {
  // gỡ modal cũ nếu có
  document.querySelector('.modal-backdrop')?.remove();

  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  back.appendChild(modal);

  const best = load(`quiz_${scenarioId}`, null);
  modal.innerHTML =
    `<div class="modal-h"><span>🎯 Quiz — ${esc(titleVi)}</span>` +
    `<button class="modal-x" aria-label="đóng">✕</button></div>` +
    `<div class="modal-score" id="q-score">0 / ${quiz.length}${best != null ? ` · kỷ lục ${best}/${quiz.length}` : ''}</div>` +
    `<div class="modal-b" id="q-body"></div>`;
  const body = modal.querySelector('#q-body');

  let answered = 0;
  let correct = 0;

  quiz.forEach((item, qi) => {
    const q = document.createElement('div');
    q.className = 'quiz-q';
    q.innerHTML = `<div class="quiz-qt"><b>Câu ${qi + 1}.</b> ${esc(item.q)}${item.from ? ` <span class="quiz-from">${esc(item.from)}</span>` : ''}</div>`;
    const opts = document.createElement('div');
    opts.className = 'quiz-opts';
    item.options.forEach((opt, oi) => {
      const b = document.createElement('button');
      b.className = 'quiz-opt';
      b.textContent = opt;
      b.onclick = () => {
        if (q.dataset.done) return;
        q.dataset.done = '1';
        const ok = oi === item.correct;
        trackLab('quiz', { id: 'scn:' + scenarioId, title: titleVi }, { ok, task: { text: item.q } });
        answered += 1;
        if (ok) correct += 1;
        opts.querySelectorAll('.quiz-opt').forEach((x, j) => {
          x.disabled = true;
          if (j === item.correct) x.classList.add('right');
          else if (j === oi) x.classList.add('wrong');
        });
        if (item.explainVi) {
          const ex = document.createElement('div');
          ex.className = 'quiz-ex';
          ex.textContent = (ok ? '✓ ' : '✗ ') + item.explainVi;
          q.appendChild(ex);
        }
        modal.querySelector('#q-score').textContent =
          `${correct} / ${quiz.length}` + (best != null ? ` · kỷ lục ${best}/${quiz.length}` : '');
        if (answered === quiz.length) {
          const prevBest = load(`quiz_${scenarioId}`, 0);
          if (correct > prevBest) save(`quiz_${scenarioId}`, correct);
          const done = document.createElement('div');
          done.className = 'quiz-done';
          done.textContent = `Hoàn thành: ${correct}/${quiz.length} đúng.` + (correct === quiz.length ? ' 🎉' : '');
          body.appendChild(done);
          done.scrollIntoView({ block: 'nearest' });
        }
      };
      opts.appendChild(b);
    });
    q.appendChild(opts);
    body.appendChild(q);
  });

  const close = () => back.remove();
  modal.querySelector('.modal-x').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  document.body.appendChild(back);
}
