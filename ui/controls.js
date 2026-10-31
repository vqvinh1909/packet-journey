// ui/controls.js — thanh điều khiển timeline: ⏮ ◀ ▶/⏸ ▶ ⏭, tốc độ, thanh trượt,
// và danh sách bước bấm để nhảy tới.
import { esc } from './topo.js';

export function renderControls(container, cbs, t) {
  container.innerHTML = '';

  const bar = document.createElement('div');
  bar.className = 'controls';
  bar.innerHTML =
    `<button id="c-first" title="${t('first')}">⏮</button>` +
    `<button id="c-prev" title="${t('prev')}">◀</button>` +
    `<button id="c-play" class="play" title="${t('playPause')}">▶</button>` +
    `<button id="c-next" title="${t('next')}">▶▌</button>` +
    `<button id="c-last" title="${t('last')}">⏭</button>` +
    `<span class="step-count"><span id="c-cur">1</span> ${t('of')} <span id="c-total">1</span></span>` +
    `<span class="speed">${t('speed')} <input id="c-speed" type="range" min="0.5" max="3" step="0.5" value="1"></span>`;
  container.appendChild(bar);

  const scrub = document.createElement('div');
  scrub.className = 'scrubber';
  scrub.innerHTML = `<input id="c-scrub" type="range" min="0" value="0">`;
  container.appendChild(scrub);

  const title = document.createElement('div');
  title.className = 'step-title';
  title.id = 'c-title';
  container.appendChild(title);

  const list = document.createElement('div');
  list.className = 'step-list';
  list.id = 'c-list';
  container.appendChild(list);

  const $ = (id) => container.querySelector(id);
  $('#c-first').onclick = cbs.onFirst;
  $('#c-prev').onclick = cbs.onPrev;
  $('#c-play').onclick = cbs.onPlayPause;
  $('#c-next').onclick = cbs.onNext;
  $('#c-last').onclick = cbs.onLast;
  $('#c-scrub').oninput = (e) => cbs.onSeek(Number(e.target.value));
  $('#c-speed').oninput = (e) => cbs.onSpeed(Number(e.target.value));

  return {
    /** Dựng lại danh sách bước cho 1 kịch bản. */
    setEvents(events) {
      $('#c-total').textContent = events.length;
      $('#c-scrub').max = String(events.length - 1);
      list.innerHTML = events.map((ev, i) =>
        `<div class="step-item" data-i="${i}">` +
        `<span class="n">${i + 1}</span>` +
        `<span class="k">${ev.kind === 'transit' ? '→' : '•'}</span>` +
        `<span class="tt">${esc(ev.titleVi)}</span></div>`,
      ).join('');
      list.querySelectorAll('.step-item').forEach((item) => {
        item.onclick = () => cbs.onSeek(Number(item.dataset.i));
      });
    },
    /** Cập nhật trạng thái hiển thị theo bước hiện tại. */
    setStep(i, step, playing) {
      $('#c-cur').textContent = i + 1;
      $('#c-scrub').value = String(i);
      $('#c-play').textContent = playing ? '⏸' : '▶';
      title.innerHTML = `<span class="seq">#${i + 1}</span>${esc(step.titleVi)}`;
      list.querySelectorAll('.step-item').forEach((item) => {
        item.classList.toggle('current', Number(item.dataset.i) === i);
      });
      // Cuộn TRONG danh sách (không cuộn cả trang) để thấy bước hiện tại.
      const cur = list.querySelector('.step-item.current');
      if (cur) {
        const r = cur.getBoundingClientRect();
        const lr = list.getBoundingClientRect();
        if (r.top < lr.top) list.scrollTop -= lr.top - r.top + 8;
        else if (r.bottom > lr.bottom) list.scrollTop += r.bottom - lr.bottom + 8;
      }
    },
  };
}

