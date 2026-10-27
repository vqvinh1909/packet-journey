// ui/explain.js — tab "Giải thích": chuyện gì đang xảy ra & vì sao, link bài học,
// trường vừa đổi. Hỗ trợ "Đoán bước tiếp theo": nếu bước có `decision` và đang bật
// chế độ đoán mà CHƯA trả lời → hiện câu hỏi + nút chọn, giấu phần giải thích tới khi đoán.

import { lessonHref } from './i18n.js';

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}

// Phần "lộ đáp án": đoạn giải thích + trường đổi + link bài học.
function appendReveal(wrap, step, t) {
  const p = document.createElement('p');
  p.textContent = step.explanationVi || '';
  wrap.appendChild(p);

  if (step.changedFields && step.changedFields.length) {
    const cf = document.createElement('div');
    cf.className = 'changed-tags';
    cf.innerHTML = `<b>${esc(t('changedFields'))}</b> ` +
      step.changedFields.map((n) => `<span class="tag">${esc(n)}</span>`).join('');
    wrap.appendChild(cf);
  }
  if (step.lesson) {
    const a = document.createElement('a');
    a.className = 'lesson';
    a.href = lessonHref(step.lesson.path);
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `📖 ${esc(t('readMore'))}: ${esc(step.lesson.label)}`;
    wrap.appendChild(a);
  }
}

export function renderExplain(container, step, t, opts = {}) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'explain';
  container.appendChild(wrap);

  const d = step.decision;
  const asking = d && opts.guessMode && !opts.answered;

  if (!asking) {
    appendReveal(wrap, step, t);
    return;
  }

  // Chế độ đoán: hỏi trước, lộ giải thích sau khi chọn (giữ nguyên dấu đúng/sai).
  const box = document.createElement('div');
  box.className = 'decision';
  box.innerHTML = `<div class="decision-q">🤔 ${esc(d.question)}</div>`;
  const optWrap = document.createElement('div');
  optWrap.className = 'decision-opts';
  d.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'decision-opt';
    b.textContent = opt;
    b.onclick = () => {
      const ok = i === d.correct;
      optWrap.querySelectorAll('.decision-opt').forEach((x, j) => {
        x.disabled = true;
        if (j === d.correct) x.classList.add('right');
        else if (j === i) x.classList.add('wrong');
      });
      const fb = document.createElement('div');
      fb.className = 'decision-fb ' + (ok ? 'ok' : 'no');
      fb.textContent = ok ? '✓ Chính xác!' : '✗ Chưa đúng — đáp án đúng được tô xanh.';
      box.appendChild(fb);
      appendReveal(wrap, step, t); // lộ giải thích ngay dưới câu hỏi
      opts.onAnswer?.(ok);          // ghi nhận đã đoán (không vẽ lại)
    };
    optWrap.appendChild(b);
  });
  box.appendChild(optWrap);
  wrap.appendChild(box);
}
