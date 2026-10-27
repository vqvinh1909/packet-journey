// ui/clock.js — thanh "⏱ đồng hồ mô phỏng" dùng chung cho Lab CLI và workspace: chọn tốc độ (Tức thì / ×1 / ×5 /
// ×20), nút "⚡ Hội tụ ngay", số mục đang hội tụ; mỗi nhịp 250 ms tiến đồng hồ (lab/net.js) và đổ log vào console.
import * as N from '../lab/net.js';
import { load, save } from './store.js';
import { classifyLine } from './topo.js';

export const SPEEDS = [[0, '⚡ Tức thì'], [1, '×1'], [5, '×5'], [20, '×20']];
export const TICK_MS = 250;
/** Tốc độ đang chọn (0 = hội tụ tức thì sau mỗi lệnh). Lưu chung "clock-speed". */
export const clockSpeed = () => load('clock-speed', 5);

/** Một nhịp: tiến đồng hồ theo tốc độ. Trả true nếu trạng thái hội tụ có thể đã đổi (cần vẽ lại sơ đồ). */
export function clockStep(net) {
  if (!net.clock) N.attachClock(net);
  const sp = clockSpeed();
  const before = N.clockPending(net);
  if (sp) N.clockTick(net, (TICK_MS / 1000) * sp);
  else if (before) N.clockConverge(net);
  else N.clockSync(net); // vẫn bắt thay đổi không qua CLI (nối / gỡ dây, Start / Stop)
  return before > 0 || N.clockPending(net) > 0;
}
/** Sau 1 lệnh: chế độ "Tức thì" thì hội tụ luôn. */
export function afterCommand(net) { if (net.clock && clockSpeed() === 0) N.clockConverge(net); }

/** Đổ log/debug đang chờ vào console: push(id, [{t, c}]). Trả danh sách id thiết bị có dòng mới. */
export function pullLogs(net, push) {
  const got = [];
  for (const id of Object.keys(net.devices)) {
    const L = N.drainLogs(net, id);
    if (!L.length) continue;
    push(id, L.map((t) => ({ t, c: classifyLine(t) || 'log' })));
    got.push(id);
  }
  return got;
}

const hms = (t) => `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
/** Vẽ thanh đồng hồ vào `box` (chỉ vẽ lại khi có thay đổi). onConverge: bấm "⚡ Hội tụ ngay". */
export function renderClockBar(box, net, onConverge) {
  const c = net?.clock;
  if (!c) { box.hidden = true; return; }
  box.hidden = false;
  const sp = clockSpeed();
  const n = N.clockPending(net);
  const tt = hms(Math.floor(c.t));
  const key = `${sp}|${n}|${tt}`;
  if (box.dataset.k === key) return;
  box.dataset.k = key;
  box.innerHTML = `<span class="lab-clock-t" title="Thời gian mô phỏng: STP 30 s (listening + learning), OSPF ~11 s, EIGRP 5 s, HSRP 10 s, BGP ~8 s — như thiết bị thật">⏱ ${tt}</span>` +
    `<span class="lab-clock-sp" role="group" aria-label="Tốc độ mô phỏng">${SPEEDS.map(([v, l]) => `<button data-sp="${v}" class="${v === sp ? 'on' : ''}" aria-pressed="${v === sp}" title="${v ? `Thời gian chạy nhanh ×${v}` : 'Hội tụ tức thì sau mỗi lệnh (không mô phỏng thời gian)'}">${l}</button>`).join('')}</span>` +
    (n ? `<span class="lab-clock-p">đang hội tụ: ${n} mục</span><button class="lab-conv" title="Bỏ qua thời gian chờ: STP lên forwarding, OSPF FULL, HSRP Active… ngay">⚡ Hội tụ ngay</button>` : '<span class="lab-clock-ok">✓ đã hội tụ</span>');
  box.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = () => { save('clock-speed', +b.dataset.sp); if (+b.dataset.sp === 0) onConverge(); else renderClockBar(box, net, onConverge); }));
  const cv = box.querySelector('.lab-conv');
  if (cv) cv.onclick = onConverge;
}
