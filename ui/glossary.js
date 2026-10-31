// ui/glossary.js — modal Từ điển thuật ngữ + bảng tra nhanh (port, OSI↔TCP/IP).
import { esc } from './topo.js';
import { GLOSSARY, PORTS, OSI_MAP } from '../i18n/glossary.js';


export function openGlossary() {
  document.querySelector('.modal-backdrop')?.remove();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  back.appendChild(modal);

  modal.innerHTML =
    `<div class="modal-h"><span>📘 Từ điển & tra nhanh</span><button class="modal-x" aria-label="đóng">✕</button></div>` +
    `<div class="modal-score"><input id="gl-search" class="gl-search" type="search" placeholder="Tìm thuật ngữ…" /></div>` +
    `<div class="modal-b" id="gl-body"></div>`;
  const body = modal.querySelector('#gl-body');

  function renderList(filter = '') {
    const f = filter.trim().toLowerCase();
    const items = GLOSSARY.filter((g) =>
      !f || g.term.toLowerCase().includes(f) || g.en.toLowerCase().includes(f) || g.def.toLowerCase().includes(f));
    const terms = items.map((g) =>
      `<div class="gl-item"><div class="gl-term">${esc(g.term)} <span class="gl-en">(${esc(g.en)})</span></div>` +
      `<div class="gl-def">${esc(g.def)}</div></div>`).join('') || '<div class="gl-def">Không tìm thấy.</div>';

    const portsRows = PORTS.map((p) => `<tr><td>${esc(p.port)}</td><td>${esc(p.proto)}</td><td>${esc(p.name)}</td></tr>`).join('');
    const osiRows = OSI_MAP.map((o) => `<tr><td>${esc(o.osi)}</td><td>${esc(o.tcpip)}</td><td>${esc(o.ex)}</td></tr>`).join('');

    body.innerHTML =
      `<div class="gl-list">${terms}</div>` +
      (f ? '' :
        `<h4 class="gl-h">Cổng phổ biến</h4>` +
        `<table class="gl-table"><thead><tr><th>Port</th><th>Proto</th><th>Dịch vụ</th></tr></thead><tbody>${portsRows}</tbody></table>` +
        `<h4 class="gl-h">OSI ↔ TCP/IP</h4>` +
        `<table class="gl-table"><thead><tr><th>OSI</th><th>TCP/IP</th><th>Ví dụ</th></tr></thead><tbody>${osiRows}</tbody></table>`);
  }
  renderList();
  modal.querySelector('#gl-search').addEventListener('input', (e) => renderList(e.target.value));

  const close = () => back.remove();
  modal.querySelector('.modal-x').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });
  document.body.appendChild(back);
  modal.querySelector('#gl-search').focus();
}
