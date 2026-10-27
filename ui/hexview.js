// ui/hexview.js — hex + ASCII view. Mỗi byte và ký tự ASCII đều mang data-index để
// highlight hai chiều với cây trường. Byte thuộc trường vừa đổi được tô màu.

const BYTES_PER_ROW = 16;

export function renderHex(container, bytes, changedRanges, handlers) {
  container.innerHTML = '';
  const changed = new Set();
  for (const [start, len] of changedRanges || []) {
    for (let i = start; i < start + len; i++) changed.add(i);
  }

  for (let off = 0; off < bytes.length; off += BYTES_PER_ROW) {
    const row = document.createElement('div');
    row.className = 'hex-row';

    const offLabel = document.createElement('span');
    offLabel.className = 'hex-off';
    offLabel.textContent = '0x' + off.toString(16).padStart(4, '0');
    row.appendChild(offLabel);

    const hexWrap = document.createElement('span');
    hexWrap.className = 'hex-bytes';
    const asciiWrap = document.createElement('span');
    asciiWrap.className = 'hex-ascii';

    for (let i = 0; i < BYTES_PER_ROW; i++) {
      const idx = off + i;
      const hb = document.createElement('span');
      hb.className = 'hex-byte';
      if (idx < bytes.length) {
        hb.dataset.index = idx;
        hb.textContent = bytes[idx].toString(16).padStart(2, '0');
        if (changed.has(idx)) hb.classList.add('changed');
        attachHover(hb, idx, handlers);

        const ac = document.createElement('span');
        ac.className = 'hex-byte';
        ac.dataset.index = idx;
        const code = bytes[idx];
        ac.textContent = code >= 0x20 && code < 0x7f ? String.fromCharCode(code) : '.';
        if (changed.has(idx)) ac.classList.add('changed');
        attachHover(ac, idx, handlers);
        asciiWrap.appendChild(ac);
      } else {
        hb.textContent = '  ';
      }
      hexWrap.appendChild(hb);
    }
    row.appendChild(hexWrap);
    row.appendChild(asciiWrap);
    container.appendChild(row);
  }
}

function attachHover(elm, idx, handlers) {
  elm.addEventListener('mouseenter', () => handlers?.onByteHover?.(idx));
  elm.addEventListener('mouseleave', () => handlers?.onByteLeave?.());
}

export function highlightRange(container, start, len) {
  clearHexHighlight(container);
  for (let i = start; i < start + len; i++) {
    container.querySelectorAll(`.hex-byte[data-index="${i}"]`).forEach((c) => c.classList.add('hl'));
  }
}
export function clearHexHighlight(container) {
  container.querySelectorAll('.hex-byte.hl').forEach((c) => c.classList.remove('hl'));
}
