// ui/cheat.js — modal "📋 Cheat sheet": bảng tra cứu (lab/cheat-ref.js) và các lệnh bạn đã gõ thành công trong Lab CLI,
// gom theo chủ đề và chế độ (lab/cheat.js), lọc theo chủ đề / tìm kiếm, in được (CSS @media print chỉ in bảng).
import { esc } from './topo.js';
import { buildCheat, modeName, modePrompt } from '../lab/cheat.js';
import { CHEAT_REF, REF_TOPICS, REF_IMAGES, filterRef } from '../lab/cheat-ref.js';
import { DESC } from '../lab/ios.js';
import { TOPIC_NAMES } from '../lab/weak.js';
import { getWeak } from './weak.js';
import { lessonHref } from './i18n.js';
import { load, save } from './store.js';
import { abbrTip } from '../i18n/abbr.js';

/** Chữ đã escape, từ viết tắt có giải thích thì bọc để trỏ chuột hoặc Tab tới là hiện khung. */
const tips = (html) => html.replace(/\b[A-Z][A-Z0-9]*[A-Z0-9](?:v\d)?\b/g, (w) => { const t = abbrTip(w); return t ? `<abbr class="cs-ab" tabindex="0" data-tip="${esc(t)}">${w}</abbr>` : w; });

function refHtml(sections) {
  if (!sections.length) return '<div class="cs-empty">Không có mục nào khớp bộ lọc.</div>';
  let topic = '';
  return sections.map((s) => {
    const h = s.topic !== topic ? `<h4>${esc(s.topic)}</h4>` : '';
    topic = s.topic;
    const cell = (c, i) => `<td>${i === 0 && s.cols[0] === 'Lệnh' ? `<code>${esc(c)}</code>` : tips(esc(c))}</td>`;
    return `<section class="cs-topic">${h}<div class="cs-mode"><span class="cs-mode-h">${tips(esc(s.title))}</span></div>` +
      `<table class="cs-tbl cs-ref"><thead><tr>${s.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>` +
      `<tbody>${s.rows.map((r) => `<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody></table>` +
      (s.note ? `<p class="cs-note">${tips(esc(s.note))}</p>` : '') + `</section>`;
  }).join('');
}

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
  let tab = opt.tab === 'mine' ? 'mine' : 'ref';
  modal.innerHTML =
    `<div class="modal-h"><span>📋 Cheat sheet</span><button class="modal-x" aria-label="đóng">✕</button></div>` +
    `<div class="cs-bar"><button id="cs-tab-ref">📘 Tra cứu</button><button id="cs-tab-mine">✍️ Lệnh của tôi</button><select id="cs-topic"></select>` +
    `<input id="cs-q" placeholder="Tìm…" autocomplete="off" spellcheck="false">` +
    `<label class="cs-ex"><input type="checkbox" id="cs-exb"> Hiện ví dụ đã gõ</label>` +
    `<button id="cs-print" title="In / lưu PDF (chỉ in bảng)">🖨 In</button></div>` +
    `<div class="modal-b cs-body"><details class="cs-imgs"><summary>🖼 Ảnh gốc (${REF_IMAGES.length})</summary><div class="cs-img-grid">` +
    REF_IMAGES.map((im) => `<a href="${lessonHref(im.path)}" target="_blank" rel="noopener"><img src="${lessonHref(im.path)}" alt="${esc(im.label)}" loading="lazy"><span>${esc(im.label)}</span></a>`).join('') +
    `</div></details><div id="cs-body"></div></div>`;
  const $ = (s) => modal.querySelector(s);
  function setTab(next, topic) {
    tab = next;
    const topics = tab === 'ref' ? REF_TOPICS : [...TOPIC_NAMES, 'Khác'];
    $('#cs-topic').innerHTML = `<option value="all">Mọi chủ đề</option>${topics.map((t) => `<option>${esc(t)}</option>`).join('')}`;
    $('#cs-topic').value = topics.includes(topic) ? topic : 'all';
    $('#cs-tab-ref').classList.toggle('active', tab === 'ref');
    $('#cs-tab-mine').classList.toggle('active', tab === 'mine');
    $('.cs-ex').hidden = tab === 'ref';
    $('.cs-imgs').hidden = tab !== 'ref';
    render();
  }
  $('#cs-exb').checked = opt.ex;
  function render() {
    const topic = $('#cs-topic').value, ex = $('#cs-exb').checked;
    save('cheat-opt', { tab, topic, ex });
    if (tab === 'ref') { $('#cs-body').innerHTML = refHtml(filterRef(CHEAT_REF, { topic, q: $('#cs-q').value })); return; }
    const groups = buildCheat(getWeak().cmds, DESC, { topic, q: $('#cs-q').value });
    const total = groups.reduce((s, g) => s + g.n, 0);
    $('#cs-body').innerHTML = !total
      ? `<div class="cs-empty">${Object.keys(getWeak().cmds || {}).length ? 'Không có lệnh nào khớp bộ lọc.' : 'Chưa có lệnh nào. Cheat sheet tự sinh từ các lệnh bạn gõ <b>thành công</b> trong 🧪 Lab CLI — làm vài lab rồi quay lại nhé.'}</div>`
      : `<p class="cs-note">${total} mẫu lệnh bạn đã dùng, gom theo chủ đề → chế độ CLI (dấu nhắc cho biết gõ ở đâu). <code>&lt;ip&gt;</code>, <code>&lt;n&gt;</code>… là chỗ điền giá trị.</p>` +
        groups.map((g) => `<section class="cs-topic"><h4>${esc(g.topic)} <small>(${g.n})</small></h4>` +
          g.modes.map((m) => `<div class="cs-mode"><span class="cs-mode-h">${esc(modeName(m.mode))}</span>${modePrompt(m.mode) ? ` <code class="cs-pr">${esc(modePrompt(m.mode))}</code>` : ''}</div>` +
            `<table class="cs-tbl">${m.items.map((it) => `<tr><td><code>${esc(it.spec)}</code>${ex && it.ex !== it.spec ? `<div class="cs-eg">vd: <code>${esc(it.ex)}</code></div>` : ''}</td><td>${tips(esc(it.desc))}</td><td class="cs-n" title="Số lần đã gõ">×${it.n}</td></tr>`).join('')}</table>`).join('') + `</section>`).join('');
  }
  $('#cs-tab-ref').onclick = () => setTab('ref');
  $('#cs-tab-mine').onclick = () => setTab('mine');
  $('#cs-topic').onchange = render;
  $('#cs-exb').onchange = render;
  $('#cs-q').oninput = render;
  $('#cs-print').onclick = () => { document.body.classList.add('cs-printing'); window.print(); setTimeout(() => document.body.classList.remove('cs-printing'), 500); };
  modal.querySelector('.modal-x').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
  document.addEventListener('keydown', onEsc);
  document.body.appendChild(back);
  setTab(tab, opt.topic);
}
