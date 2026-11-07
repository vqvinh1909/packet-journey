// ui/builder.js — form "Tự tạo kịch bản": nhập IP/mask/gateway rồi chạy mô phỏng.
import { parseIp } from '../packet/addr.js';
import { predictOutcome, randomBuilder } from '../scenarios/builder.js';

function field(id, label, value, hint) {
  return `<label class="bld-row"><span>${label}</span><input id="${id}" value="${value}" />` +
    (hint ? `<em>${hint}</em>` : '') + `</label>`;
}

export function openBuilder(onRun) {
  document.querySelector('.modal-backdrop')?.remove();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';
  back.appendChild(modal);

  modal.innerHTML =
    `<div class="modal-h"><span>🛠️ Tự tạo kịch bản — ping PC1 → PC2</span><button class="modal-x">✕</button></div>` +
    `<div class="modal-b">` +
    `<div class="bld-presets">Mẫu nhanh: <button data-preset="same">Cùng mạng</button> <button data-preset="cross">Khác mạng (đúng GW)</button> <button data-preset="badgw">Sai gateway</button> <button data-preset="rand" class="btn-accent">🎲 Bài ngẫu nhiên</button></div>` +
    `<h4 class="gl-h">PC1</h4>` +
    field('b-pc1ip', 'IP', '192.168.1.10') + field('b-pc1pfx', 'Prefix (/)', '24') + field('b-pc1gw', 'Gateway', '192.168.1.1', 'bỏ trống nếu cùng mạng') +
    `<h4 class="gl-h">PC2 (đích)</h4>` +
    field('b-pc2ip', 'IP', '192.168.2.10') + field('b-pc2pfx', 'Prefix (/)', '24') +
    `<h4 class="gl-h">Router (nếu khác mạng)</h4>` +
    field('b-rip', 'IP cổng R1 phía PC1', '192.168.1.1', 'phải khớp Gateway của PC1') +
    `<div class="bld-err" id="b-err"></div>` +
    `<div class="bld-guess">Ping PC1 → PC2 sẽ ra sao? <button data-k="same">Cùng mạng, ping OK</button> <button data-k="cross">Khác mạng, qua gateway, OK</button> <button data-k="fail">Ping hỏng</button> <span id="b-score"></span></div>` +
    `<div id="b-res" class="bld-res"></div>` +
    `</div>` +
    `<div class="pg-foot"><button id="b-run" class="btn-accent">▶ Chạy mô phỏng</button></div>`;

  const $ = (id) => modal.querySelector('#' + id);
  const presets = {
    same: { pc1ip: '192.168.1.10', pc1pfx: '24', pc1gw: '', pc2ip: '192.168.1.20', pc2pfx: '24', rip: '' },
    cross: { pc1ip: '192.168.1.10', pc1pfx: '24', pc1gw: '192.168.1.1', pc2ip: '192.168.2.10', pc2pfx: '24', rip: '192.168.1.1' },
    badgw: { pc1ip: '192.168.1.10', pc1pfx: '24', pc1gw: '192.168.1.254', pc2ip: '192.168.2.10', pc2pfx: '24', rip: '192.168.1.1' },
  };
  modal.querySelectorAll('.bld-presets button').forEach((b) => {
    b.onclick = () => {
      const r = b.dataset.preset === 'rand' && randomBuilder();
      const p = r ? { pc1ip: r.pc1Ip, pc1pfx: r.pc1Prefix, pc1gw: r.pc1Gw, pc2ip: r.pc2Ip, pc2pfx: r.pc2Prefix, rip: r.routerIp } : presets[b.dataset.preset];
      $('b-pc1ip').value = p.pc1ip; $('b-pc1pfx').value = p.pc1pfx; $('b-pc1gw').value = p.pc1gw;
      $('b-pc2ip').value = p.pc2ip; $('b-pc2pfx').value = p.pc2pfx; $('b-rip').value = p.rip;
      $('b-err').textContent = ''; $('b-res').textContent = ''; $('b-res').className = 'bld-res';
    };
  });

  // dự đoán trước khi chạy: tự chấm bằng đúng logic của mô phỏng
  const NAME = { same: 'Cùng mạng, ping OK', cross: 'Khác mạng, qua gateway, OK', fail: 'Ping hỏng' };
  let right = 0, total = 0;
  modal.querySelectorAll('.bld-guess button').forEach((b) => {
    b.onclick = () => {
      let p;
      try { p = read(); } catch (e) { $('b-err').textContent = 'Lỗi nhập liệu: ' + e.message; return; }
      const r = predictOutcome(p), ok = r.kind === b.dataset.k;
      total++; if (ok) right++;
      $('b-score').textContent = `Đúng ${right}/${total}`;
      $('b-res').className = 'bld-res ' + (ok ? 'ok' : 'no');
      $('b-res').textContent = (ok ? '✓ Đúng. ' : `✗ Chưa đúng, đáp án: ${NAME[r.kind]}. `) + r.why + ' Bấm Chạy mô phỏng để xem từng gói, hoặc 🎲 để làm bài khác.';
    };
  });

  const close = () => back.remove();
  modal.querySelector('.modal-x').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };

  function read() {
    const pfx1 = parseInt($('b-pc1pfx').value, 10);
    const pfx2 = parseInt($('b-pc2pfx').value, 10);
    if (!(pfx1 >= 0 && pfx1 <= 32) || !(pfx2 >= 0 && pfx2 <= 32)) throw new Error('Prefix phải trong 0–32');
    return {
      pc1Ip: ck($('b-pc1ip').value), pc1Prefix: pfx1, pc1Gw: $('b-pc1gw').value.trim() ? ck($('b-pc1gw').value) : '',
      pc2Ip: ck($('b-pc2ip').value), pc2Prefix: pfx2, routerIp: $('b-rip').value.trim() ? ck($('b-rip').value) : '',
    };
  }
  $('b-run').onclick = () => {
    try {
      const p = read();
      close();
      onRun(p);
    } catch (e) {
      $('b-err').textContent = 'Lỗi nhập liệu: ' + e.message;
    }
  };

  document.body.appendChild(back);
  function ck(v) { parseIp(v); return v.trim(); } // ném lỗi nếu IP sai
}
