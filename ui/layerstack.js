import { esc } from './topo.js';
// ui/layerstack.js — ngăn xếp tầng OSI; tầng đang xử lý sáng lên, kèm hướng đóng/bóc.

const ROWS = [
  { osi: 7, key: 7 },
  { osi: 4, key: 4 },
  { osi: 3, key: 3 },
  { osi: 2, key: 2 },
  { osi: 1, key: 1 },
];
// Tầng 5, 6 không có hàng riêng: gộp vào Application như mô hình TCP/IP (RTP, BFD).
const rowOf = (layer) => (layer >= 5 ? 7 : Math.floor(layer));

export function renderLayerStack(container, step, t) {
  container.innerHTML = '';
  const tree = step.packet?.tree || [];
  const active = step.activeLayer;

  // Gom protocol theo tầng hiển thị (2.5 xếp vào hàng L2 với ghi chú).
  const byRow = { 7: [], 4: [], 3: [], 2: [], 1: [] };
  for (const l of tree) {
    const row = l.osiLayer === 2.5 ? 2 : rowOf(l.osiLayer);
    if (byRow[row]) byRow[row].push(l.osiLayer === 2.5 ? `${l.name} (L2↔L3)` : l.name);
  }
  byRow[1].push('Bits trên dây (đồng/quang/sóng)');

  for (const r of ROWS) {
    const div = document.createElement('div');
    const isActive = active != null && rowOf(active) === r.key;
    div.className = 'layer' + (isActive ? ' active' : '');
    const protos = byRow[r.key];
    div.innerHTML =
      `<div class="ly-osi">${esc(t('osi.' + r.osi) || 'L' + r.osi)}</div>` +
      `<div class="ly-name">${protos.length ? esc(protos.join(' · ')) : '—'}</div>`;
    if (isActive && step.side) {
      const badge = document.createElement('span');
      const cls = step.side === 'decap' ? 'decap' : step.side === 'forward' ? 'forward' : '';
      badge.className = 'encap-badge ' + cls;
      badge.textContent = t(step.side) || step.side;
      div.querySelector('.ly-name').appendChild(document.createTextNode(' '));
      div.querySelector('.ly-name').appendChild(badge);
    }
    container.appendChild(div);
  }
}

