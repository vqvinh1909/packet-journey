// ui/cheat.js — modal "📋 Cheat sheet": các lệnh bạn đã gõ thành công trong Lab CLI, gom theo chủ đề và chế độ
// (lab/cheat.js), lọc theo chủ đề / tìm kiếm, in được (CSS @media print chỉ in bảng).
import { buildCheat, modeName, modePrompt } from '../lab/cheat.js';
import { DESC } from '../lab/ios.js';
import { TOPIC_NAMES } from '../lab/weak.js';
import { getWeak } from './weak.js';
import { load, save } from './store.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

export function openCheat() {
  document.querySelector('.modal-backdrop')?.remove();
  const back = document.createElement('div');
  back.className = 'modal-backdrop cs-back';
  const modal = document.createElement('div');
  modal.className = 'modal cs-modal';
  back.appendChild(modal);
  const close = () => { back.remove(); document.removeEventListener('keydown', onEsc); };
  function onEsc(e) { if (e.key === 'Escape') close(); }
  const opt = load('cheat-opt', { topic: 'all', ex: true });
  modal.innerHTML =
    `<div class="modal-h"><span>📋 Cheat sheet của tôi</span><button class="modal-x" aria-label="đóng">✕</button></div>` +
    `<div class="cs-bar"><select id="cs-topic"><option value="all">Mọi chủ đề</option>${TOPIC_NAMES.map((t) => `<option>${esc(t)}</option>`).join('')}<option>Khác</option></select>` +
    `<input id="cs-q" placeholder="Tìm lệnh…" autocomplete="off" spellcheck="false">` +
    `<label class="cs-ex"><input type="checkbox" id="cs-exb"> Hiện ví dụ đã gõ</label>` +
    `<button id="cs-print" title="In / lưu PDF (chỉ in bảng lệnh)">🖨 In</button></div>` +
    `<div class="modal-b cs-body" id="cs-body"></div>`;
  const $ = (s) => modal.querySelector(s);
  $('#cs-topic').value = opt.topic;
  $('#cs-exb').checked = opt.ex;
  function render() {
    const topic = $('#cs-topic').value, ex = $('#cs-exb').checked;
    save('cheat-opt', { topic, ex });
    const groups = buildCheat(getWeak().cmds, DESC, { topic, q: $('#cs-q').value });
    const total = groups.reduce((s, g) => s + g.n, 0);
    $('#cs-body').innerHTML = !total
      ? `<div class="cs-empty">${Object.keys(getWeak().cmds || {}).length ? 'Không có lệnh nào khớp bộ lọc.' : 'Chưa có lệnh nào. Cheat sheet tự sinh từ các lệnh bạn gõ <b>thành công</b> trong 🧪 Lab CLI — làm vài lab rồi quay lại nhé.'}</div>`
      : `<p class="cs-note">${total} mẫu lệnh bạn đã dùng, gom theo chủ đề → chế độ CLI (dấu nhắc cho biết gõ ở đâu). <code>&lt;ip&gt;</code>, <code>&lt;n&gt;</code>… là chỗ điền giá trị.</p>` +
        groups.map((g) => `<section class="cs-topic"><h4>${esc(g.topic)} <small>(${g.n})</small></h4>` +
          g.modes.map((m) => `<div class="cs-mode"><span class="cs-mode-h">${esc(modeName(m.mode))}</span>${modePrompt(m.mode) ? ` <code class="cs-pr">${esc(modePrompt(m.mode))}</code>` : ''}</div>` +
            `<table class="cs-tbl">${m.items.map((it) => `<tr><td><code>${esc(it.spec)}</code>${ex && it.ex !== it.spec ? `<div class="cs-eg">vd: <code>${esc(it.ex)}</code></div>` : ''}</td><td>${esc(it.desc)}</td><td class="cs-n" title="Số lần đã gõ">×${it.n}</td></tr>`).join('')}</table>`).join('') + `</section>`).join('');
  }
  $('#cs-topic').onchange = render;
  $('#cs-exb').onchange = render;
  $('#cs-q').oninput = render;
  $('#cs-print').onclick = () => { document.body.classList.add('cs-printing'); window.print(); setTimeout(() => document.body.classList.remove('cs-printing'), 500); };
  modal.querySelector('.modal-x').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
  document.addEventListener('keydown', onEsc);
  document.body.appendChild(back);
  render();
}
