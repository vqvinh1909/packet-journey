// ui/subnet.js — modal "🧮 Luyện subnet": đề ngẫu nhiên vô hạn (lab/subnet.js), chọn dạng & độ khó, đồng hồ bấm giờ,
// chế độ "10 câu tính giờ", sai thì hiện lời giải từng bước, thống kê theo dạng (localStorage "subnet-stats").
import { esc } from './topo.js';
import * as S from '../lab/subnet.js';
import { load, save } from './store.js';

const LEVELS = { 1: 'Dễ', 2: 'Vừa', 3: 'Khó' };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function openSubnet() {
  document.querySelector('.modal-backdrop')?.remove();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal sn-modal';
  back.appendChild(modal);
  const opt = load('subnet-opt', { kind: 'mix', level: 1 });
  modal.innerHTML =
    `<div class="modal-h"><span>🧮 Luyện subnet</span><button class="modal-x" aria-label="đóng">✕</button></div>` +
    `<div class="sn-bar">` +
    `<select id="sn-kind" title="Dạng đề"><option value="mix">🔀 Trộn mọi dạng</option>${Object.entries(S.KINDS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>` +
    `<select id="sn-level" title="Độ khó">${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>` +
    `<button id="sn-run" title="10 câu trộn dạng, tính tổng thời gian">⏱ 10 câu tính giờ</button>` +
    `<button id="sn-stats-btn">📈 Thống kê</button>` +
    `<span class="sn-clock" id="sn-clock">0:00</span></div>` +
    `<div class="modal-b sn-body" id="sn-body"></div>`;
  const $ = (sel) => modal.querySelector(sel);
  $('#sn-kind').value = opt.kind;
  $('#sn-level').value = String(opt.level);
  const body = $('#sn-body');

  let q = null, t0 = 0, graded = false, run = null, timer = 0;
  const elapsed = () => (performance.now() - t0) / 1000;
  const tick = () => {
    const base = run ? (performance.now() - run.t0) / 1000 : graded ? q?.secs ?? 0 : elapsed();
    $('#sn-clock').textContent = (run ? `Câu ${Math.min(run.i + 1, 10)}/10 · ` : '') + fmt(base);
  };
  timer = setInterval(tick, 250);

  function next() {
    const level = +$('#sn-level').value;
    q = run ? run.qs[run.i] : S.generate($('#sn-kind').value, level);
    graded = false;
    t0 = performance.now();
    const fieldHtml = q.fields.map(([k, label]) => {
      const input = k === 'same'
        ? `<select data-k="${k}"><option value="">—</option><option>có</option><option>không</option></select>`
        : `<input data-k="${k}" autocomplete="off" spellcheck="false" placeholder="${k === 'prefix' ? '/24' : k === 'hosts' ? 'số' : q.kind === 'vlsm' || k === 'summary' ? 'a.b.c.d/nn' : 'a.b.c.d'}" />`;
      return `<label class="sn-f"><span>${esc(label)}</span>${input}<b class="sn-mark" data-m="${k}"></b></label>`;
    }).join('');
    body.innerHTML =
      `<div class="sn-meta">${esc(S.KINDS[q.kind])} · ${LEVELS[q.level]}</div>` +
      `<div class="sn-q">${esc(q.text)}</div>` +
      `<form class="sn-form" id="sn-form">${fieldHtml}` +
      `<div class="sn-act"><button type="submit" class="btn-accent" id="sn-check">Kiểm tra (Enter)</button>` +
      `<button type="button" id="sn-skip">${run ? 'Bỏ qua' : 'Câu khác'}</button></div></form>` +
      `<div id="sn-result"></div>`;
    $('#sn-form').onsubmit = (e) => { e.preventDefault(); graded ? next() : check(); };
    $('#sn-skip').onclick = () => (graded ? next() : check(true));
    body.querySelector('[data-k]')?.focus();
  }

  function check(skip = false) {
    const input = {};
    body.querySelectorAll('[data-k]').forEach((el) => { input[el.dataset.k] = skip ? '' : el.value; });
    const g = S.grade(q, input);
    q.secs = elapsed();
    graded = true;
    save('subnet-stats', S.addStat(load('subnet-stats', {}), q.kind, g.ok, q.secs));
    for (const [k, ok] of Object.entries(g.fields)) {
      const m = body.querySelector(`[data-m="${k}"]`);
      m.textContent = ok ? '✓' : '✗';
      m.className = 'sn-mark ' + (ok ? 'ok' : 'bad');
      if (!ok) m.title = 'Đáp án mẫu: ' + q.ans[k];
    }
    body.querySelectorAll('[data-k]').forEach((el) => { el.disabled = true; });
    const ans = q.fields.map(([k, label]) => `<div><span>${esc(label)}:</span> <code>${esc(q.ans[k])}</code>${g.fields[k] ? '' : ' ✗'}</div>`).join('');
    $('#sn-result').innerHTML =
      `<div class="sn-verdict ${g.ok ? 'ok' : 'bad'}">${g.ok ? '✅ Đúng' : '❌ Chưa đúng'} · ${q.secs.toFixed(1)} giây${g.note ? ' — ' + esc(g.note) : ''}</div>` +
      (g.ok ? '' : `<div class="sn-ans"><b>Đáp án${q.kind === 'vlsm' ? ' mẫu (cách khác đúng luật vẫn được tính)' : ''}:</b>${ans}</div>` +
        `<div class="sn-steps"><b>Giải từng bước</b><pre>${esc(S.explain(q).join('\n'))}</pre></div>`);
    $('#sn-check').textContent = run && run.i === 9 ? 'Xem kết quả →' : 'Câu tiếp → (Enter)';
    $('#sn-skip').hidden = true;
    $('#sn-check').focus();
    if (run) {
      run.res.push({ kind: q.kind, ok: g.ok, secs: q.secs });
      run.i += 1;
      if (run.i === 10) { $('#sn-form').onsubmit = (e) => { e.preventDefault(); finishRun(); }; }
    }
  }

  function startRun() {
    run = { qs: S.makeRun(+$('#sn-level').value, (Math.random() * 2 ** 32) >>> 0), i: 0, res: [], t0: performance.now() };
    $('#sn-run').textContent = '⏹ Dừng bộ 10 câu';
    next();
  }
  function stopRun() { run = null; $('#sn-run').textContent = '⏱ 10 câu tính giờ'; }
  function finishRun() {
    const done = run;
    const secs = (performance.now() - done.t0) / 1000;
    const ok = done.res.filter((x) => x.ok).length;
    const hist = load('subnet-runs', []);
    const rec = { at: Date.now(), level: +$('#sn-level').value, ok, secs: Math.round(secs) };
    const best = hist.filter((h) => h.level === rec.level).sort((a, b) => b.ok - a.ok || a.secs - b.secs)[0];
    save('subnet-runs', [rec, ...hist].slice(0, 50));
    stopRun();
    body.innerHTML =
      `<div class="sn-verdict ${ok >= 8 ? 'ok' : 'bad'}">Hoàn thành 10 câu (${LEVELS[rec.level]}): đúng ${ok}/10 trong ${fmt(secs)}</div>` +
      (best ? `<div class="sn-meta">Kỷ lục trước ở mức này: ${best.ok}/10 trong ${fmt(best.secs)}${ok > best.ok || (ok === best.ok && rec.secs < best.secs) ? ' — 🏆 kỷ lục mới!' : ''}</div>` : '') +
      `<table class="sn-tbl"><tr><th>#</th><th>Dạng</th><th>Kết quả</th><th>Giây</th></tr>${done.res.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(S.KINDS[x.kind])}</td><td>${x.ok ? '✓' : '✗'}</td><td>${x.secs.toFixed(1)}</td></tr>`).join('')}</table>` +
      `<div class="sn-act"><button class="btn-accent" id="sn-again">⏱ Làm bộ khác</button><button id="sn-free">Luyện tự do</button></div>`;
    $('#sn-again').onclick = startRun;
    $('#sn-free').onclick = next;
  }
  function showStats() {
    stopRun();
    q = null; graded = true;
    const rows = S.statRows(load('subnet-stats', {}));
    const runs = load('subnet-runs', []);
    body.innerHTML =
      `<table class="sn-tbl"><tr><th>Dạng</th><th>Số câu</th><th>Tỉ lệ đúng</th><th>TB giây/câu</th></tr>` +
      rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.n}</td><td>${r.rate == null ? '—' : `<span class="sn-rate" style="--w:${Math.round(r.rate * 100)}%">${Math.round(r.rate * 100)}%</span>`}</td><td>${r.avg == null ? '—' : r.avg.toFixed(1)}</td></tr>`).join('') +
      `</table>` +
      `<div class="sn-meta">Bộ 10 câu gần đây: ${runs.length ? runs.slice(0, 5).map((h) => `${h.ok}/10 · ${fmt(h.secs)} (${LEVELS[h.level]})`).join(' · ') : 'chưa có'}</div>` +
      `<div class="sn-act"><button class="btn-accent" id="sn-free">Luyện tiếp</button><button id="sn-reset">Xoá thống kê</button></div>`;
    $('#sn-free').onclick = next;
    $('#sn-reset').onclick = () => { if (confirm('Xoá toàn bộ thống kê luyện subnet?')) { save('subnet-stats', {}); save('subnet-runs', []); showStats(); } };
  }

  const saveOpt = () => save('subnet-opt', { kind: $('#sn-kind').value, level: +$('#sn-level').value });
  $('#sn-kind').onchange = () => { saveOpt(); stopRun(); next(); };
  $('#sn-level').onchange = () => { saveOpt(); stopRun(); next(); };
  $('#sn-run').onclick = () => (run ? (stopRun(), next()) : startRun());
  $('#sn-stats-btn').onclick = showStats;

  const close = () => { clearInterval(timer); back.remove(); document.removeEventListener('keydown', onEsc); };
  function onEsc(e) { if (e.key === 'Escape') close(); }
  $('.modal-x').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
  document.addEventListener('keydown', onEsc);
  document.body.appendChild(back);
  next();
}
