// ui/fieldtree.js — cây trường kiểu Wireshark. Mỗi trường mang data-start/len để
// highlight hai chiều với hex view. Trường vừa đổi (changedFields) được tô màu.

function layerClass(osi) {
  return osi === 2.5 ? 'l25' : 'l' + Math.floor(osi);
}

export function renderFieldTree(container, tree, changedFields, handlers) {
  container.innerHTML = '';
  const changed = new Set(changedFields || []);

  for (const layer of tree) {
    const det = document.createElement('details');
    det.className = 'flayer ' + layerClass(layer.osiLayer);
    det.open = true;
    const sum = document.createElement('summary');
    sum.innerHTML = `${esc(layer.nameVi)} <span style="opacity:.8">(${esc(layer.name)}, ${esc(layer.rfc)})</span>`;
    det.appendChild(sum);

    for (const f of layer.fields) {
      const row = document.createElement('div');
      row.className = 'frow' + (changed.has(f.name) ? ' changed' : '');
      row.dataset.start = f.byteOffset;
      row.dataset.len = f.byteLength;
      row.dataset.field = f.name;
      row.innerHTML =
        `<span class="fname">${esc(f.nameVi)} <span class="frfc">${esc(f.rfc || '')}</span></span>` +
        `<span class="fval">${esc(f.display)}</span>`;
      row.addEventListener('mouseenter', () => handlers?.onFieldHover?.(f.byteOffset, f.byteLength, f.name));
      row.addEventListener('mouseleave', () => handlers?.onFieldLeave?.());
      det.appendChild(row);

      if (f.descriptionVi) {
        const desc = document.createElement('div');
        desc.className = 'fdesc';
        desc.textContent = f.descriptionVi;
        det.appendChild(desc);
      }
    }
    container.appendChild(det);
  }
}

/** Tô sáng đúng hàng trường theo name (dùng khi rê chuột trên hex view). */
export function highlightFieldRow(container, name) {
  container.querySelectorAll('.frow').forEach((r) => {
    r.classList.toggle('hl', r.dataset.field === name);
  });
}
export function clearFieldHighlight(container) {
  container.querySelectorAll('.frow.hl').forEach((r) => r.classList.remove('hl'));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
}
