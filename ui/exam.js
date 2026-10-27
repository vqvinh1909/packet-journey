// ui/exam.js — "🎓 Thi thử CCNA": màn hình bắt đầu (lịch sử các lần thi), phòng thi (đồng hồ đếm ngược, lưới câu
// hỏi, đánh dấu ⚑, câu lab có console thu nhỏ), nộp bài → điểm thang 1000, điểm từng mảng, xem lại câu sai.
// Bài đang làm lưu trong localStorage ("ccna-exam-cur") nên tải lại trang vẫn làm tiếp được.
import * as E from '../lab/ccna-exam.js';
import { getLab, buildLab, checkLab } from '../lab/labs.js';
import { createCli } from '../lab/ios.js';
import { load, save } from './store.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const isHost = (d) => d.type === 'pc' || d.type === 'server';

export function openExam() {
  document.querySelector('.modal-backdrop')?.remove();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal ex-modal';
  back.appendChild(modal);
  document.body.appendChild(back);
  let timer = 0, cur = null, exam = null, k = 0, sims = {};
  const close = () => { clearInterval(timer); back.remove(); document.removeEventListener('keydown', onEsc); };
  function onEsc(e) { if (e.key === 'Escape' && !cur) close(); }
  document.addEventListener('keydown', onEsc);

  // ---------------------------------------------------------------- màn hình bắt đầu
  function home() {
    clearInterval(timer);
    cur = load('ccna-exam-cur', null);
    const hist = load('ccna-exam-hist', []);
    const full = E.makeExam(1, 'full'), quick = E.makeExam(1, 'quick');
    modal.innerHTML = `<div class="modal-h"><span>🎓 Thi thử CCNA 200-301</span><button class="modal-x" aria-label="đóng">✕</button></div>` +
      `<div class="modal-b ex-home"><p>Đề tự soạn theo 6 mảng kiến thức của CCNA 200-301 (không phải đề thật): trắc nghiệm một / nhiều đáp án, ghép cặp và câu <b>lab mô phỏng</b> gõ lệnh như Lab CLI. Chấm thang <b>300–1000</b>, đạt từ <b>${E.PASS}</b>. Không xem được đáp án cho tới khi nộp bài.</p>` +
      `<table class="ex-dom"><tr><th>Mảng kiến thức</th><th>Tỉ trọng</th></tr>${E.DOMAINS.map((d) => `<tr><td>${esc(d.name)} — ${esc(d.vi)}</td><td>${d.w}%</td></tr>`).join('')}</table>` +
      (cur ? `<div class="ex-resume">Bạn đang làm dở một đề (${cur.mode === 'quick' ? 'rút gọn' : 'đầy đủ'}). <button id="ex-cont" class="btn-accent">▶ Làm tiếp</button> <button id="ex-drop">Bỏ bài này</button></div>` : '') +
      `<div class="ex-start"><button id="ex-full" class="btn-accent">Đề đầy đủ — ${full.qs.length} câu · ${full.minutes} phút</button><button id="ex-quick">Đề rút gọn — ${quick.qs.length} câu · ${quick.minutes} phút</button></div>` +
      (hist.length ? `<h4>Lịch sử thi</h4><table class="ex-hist"><tr><th>Ngày</th><th>Đề</th><th>Điểm</th><th>Thời gian</th><th>Mảng yếu nhất</th></tr>${hist.slice(0, 10).map((h) => `<tr><td>${new Date(h.at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${h.mode === 'quick' ? 'Rút gọn' : 'Đầy đủ'}</td><td class="${h.pass ? 'ok' : 'bad'}">${h.score}${h.pass ? ' ✓' : ''}</td><td>${fmt(h.secs)}</td><td>${esc(h.weak || '—')}</td></tr>`).join('')}</table>` : '') +
      `</div>`;
    modal.querySelector('.modal-x').onclick = close;
    const start = (mode) => { if (cur && !confirm('Bỏ bài đang làm dở và bắt đầu đề mới?')) return; begin({ seed: (Math.random() * 0x7fffffff) >>> 0 || 1, mode, t0: Date.now(), answers: {}, flags: {}, simlog: {} }); };
    modal.querySelector('#ex-full').onclick = () => start('full');
    modal.querySelector('#ex-quick').onclick = () => start('quick');
    if (cur) {
      modal.querySelector('#ex-cont').onclick = () => begin(cur);
      modal.querySelector('#ex-drop').onclick = () => { if (confirm('Bỏ bài đang làm? Bài này không được tính điểm.')) { save('ccna-exam-cur', null); home(); } };
    }
  }

  // ---------------------------------------------------------------- phòng thi
  function begin(state) {
    cur = state;
    save('ccna-exam-cur', cur);
    exam = E.makeExam(cur.seed, cur.mode);
    sims = {};
    k = Math.min(cur.k || 0, exam.qs.length - 1);
    modal.innerHTML = `<div class="modal-h ex-h"><span>🎓 Thi thử CCNA — ${cur.mode === 'quick' ? 'đề rút gọn' : 'đề đầy đủ'}</span><span class="ex-clock" id="ex-clock"></span><button id="ex-submit" class="btn-accent">📝 Nộp bài</button></div>` +
      `<div class="ex-body"><nav class="ex-nav" id="ex-nav"></nav><section class="ex-q" id="ex-q"></section></div>` +
      `<div class="ex-foot"><button id="ex-prev">← Câu trước</button><button id="ex-flag">⚑ Đánh dấu xem lại</button><button id="ex-next">Câu sau →</button></div>`;
    modal.querySelector('#ex-submit').onclick = () => { const left = exam.qs.filter((q, i) => !answered(i)).length; if (confirm(left ? `Còn ${left} câu chưa trả lời. Nộp bài?` : 'Nộp bài?')) submit(); };
    modal.querySelector('#ex-prev').onclick = () => go(k - 1);
    modal.querySelector('#ex-next').onclick = () => go(k + 1);
    modal.querySelector('#ex-flag').onclick = () => { cur.flags[k] = !cur.flags[k]; persist(); renderNav(); renderQ(); };
    const tick = () => {
      const left = cur.t0 + exam.minutes * 60000 - Date.now();
      const el = modal.querySelector('#ex-clock');
      if (!el) return;
      el.textContent = '⏱ ' + fmt(Math.max(0, left / 1000));
      el.classList.toggle('low', left < 5 * 60000);
      if (left <= 0) { alert('Hết giờ — bài được nộp tự động.'); submit(); }
    };
    tick();
    timer = setInterval(tick, 1000);
    renderNav();
    renderQ();
  }
  const persist = () => { cur.k = k; save('ccna-exam-cur', cur); };
  const answered = (i) => { const q = exam.qs[i], a = cur.answers[i]; return q.kind === 'sim' ? !!(cur.simlog[i]?.length) : q.kind === 'match' ? Array.isArray(a) && a.every((x) => x != null && x !== '') : q.kind === 'multi' ? Array.isArray(a) && a.length > 0 : a != null; };
  function go(i) { if (i < 0 || i >= exam.qs.length) return; k = i; persist(); renderNav(); renderQ(); }
  function renderNav() {
    const nav = modal.querySelector('#ex-nav');
    nav.innerHTML = `<div class="ex-nav-h">${exam.qs.filter((q, i) => answered(i)).length}/${exam.qs.length} đã làm</div><div class="ex-grid">` +
      exam.qs.map((q, i) => `<button data-i="${i}" class="${i === k ? 'cur ' : ''}${answered(i) ? 'done ' : ''}${cur.flags[i] ? 'flag' : ''}" title="${q.kind === 'sim' ? 'Câu lab mô phỏng' : ''}">${i + 1}${q.kind === 'sim' ? '🧪' : ''}</button>`).join('') + '</div>';
    nav.querySelectorAll('button').forEach((b) => (b.onclick = () => go(+b.dataset.i)));
  }
  function renderQ() {
    const q = exam.qs[k], box = modal.querySelector('#ex-q');
    modal.querySelector('#ex-flag').classList.toggle('on', !!cur.flags[k]);
    const head = `<div class="ex-qh">Câu ${k + 1}/${exam.qs.length} · ${esc(E.DOMAINS.find((d) => d.id === q.domain).name)}${q.kind === 'multi' ? ` · <b>chọn ${q.answer.length} đáp án</b>` : ''}${q.kind === 'match' ? ' · ghép cặp' : ''}</div>`;
    const a = cur.answers[k];
    if (q.kind === 'one' || q.kind === 'multi') {
      box.innerHTML = head + `<div class="ex-text">${esc(q.text)}</div><div class="ex-opts">` +
        q.options.map((o, j) => `<label class="ex-opt"><input type="${q.kind === 'one' ? 'radio' : 'checkbox'}" name="exo" value="${j}"${(q.kind === 'one' ? a === j : (a || []).includes(j)) ? ' checked' : ''}> <span>${String.fromCharCode(65 + j)}. ${esc(o)}</span></label>`).join('') + '</div>';
      box.querySelectorAll('input').forEach((inp) => (inp.onchange = () => {
        cur.answers[k] = q.kind === 'one' ? +inp.value : [...box.querySelectorAll('input:checked')].map((x) => +x.value);
        persist(); renderNav();
      }));
    } else if (q.kind === 'match') {
      box.innerHTML = head + `<div class="ex-text">${esc(q.text)}</div><table class="ex-match">` +
        q.left.map((l, j) => `<tr><td>${esc(l)}</td><td>→</td><td><select data-j="${j}"><option value="">— chọn —</option>${q.right.map((r, x) => `<option value="${x}"${a?.[j] === x ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></td></tr>`).join('') + '</table>';
      box.querySelectorAll('select').forEach((s) => (s.onchange = () => {
        const arr = Array.isArray(cur.answers[k]) ? [...cur.answers[k]] : q.left.map(() => null);
        arr[+s.dataset.j] = s.value === '' ? null : +s.value;
        cur.answers[k] = arr;
        persist(); renderNav();
      }));
    } else renderSim(q, box, head);
  }
  /** Phiên CLI của câu lab k (dựng lại từ nhật ký lệnh đã gõ). */
  function simOf(i) {
    if (sims[i]) return sims[i];
    const lab = getLab(exam.qs[i].lab);
    const net = buildLab(lab), cli = createCli(net);
    const out = {};
    for (const [dev, cmd] of cur.simlog[i] || []) { try { (out[dev] ||= []).push({ t: cli.prompt(dev) + cmd, c: 'cmd' }, ...cli.exec(dev, cmd).out.map((t) => ({ t }))); } catch { /* bỏ qua */ } }
    const first = Object.values(net.devices).find((d) => !isHost(d)) || Object.values(net.devices)[0];
    return (sims[i] = { lab, net, cli, out, dev: first.id });
  }
  function renderSim(q, box, head) {
    const S = simOf(k);
    const tasks = S.lab.tasks.filter((t) => !t.quiz);
    const ds = Object.values(S.net.devices);
    box.innerHTML = head + `<div class="ex-text"><b>Câu lab mô phỏng:</b> ${esc(S.lab.title)}</div><div class="ex-story">${esc(S.lab.story)}</div>` +
      `<div class="ex-tasks"><b>Yêu cầu (chấm khi nộp bài):</b><ol>${tasks.map((t) => `<li>${esc(t.text)}</li>`).join('')}</ol></div>` +
      `<div class="ex-devs">${ds.map((d) => `<button data-d="${d.id}" class="${d.id === S.dev ? 'on' : ''}">${esc(d.name)}</button>`).join('')}</div>` +
      `<pre class="ex-term" id="ex-term"></pre><div class="ex-in"><span id="ex-pr"></span><input id="ex-cmd" autocomplete="off" spellcheck="false" placeholder="gõ lệnh, Enter (Tab hoàn thành lệnh)"></div>`;
    const term = box.querySelector('#ex-term'), inp = box.querySelector('#ex-cmd');
    const paint = () => {
      const lines = S.out[S.dev] || [];
      term.innerHTML = lines.slice(-300).map((l) => `<span class="${l.c || ''}">${esc(l.t)}</span>`).join('\n');
      term.scrollTop = term.scrollHeight;
      box.querySelector('#ex-pr').textContent = S.cli.prompt(S.dev);
    };
    box.querySelectorAll('.ex-devs button').forEach((b) => (b.onclick = () => { S.dev = b.dataset.d; renderQ(); }));
    inp.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Tab') { e.preventDefault(); const c = S.cli.complete?.(S.dev, inp.value); if (typeof c === 'string') inp.value = c; else if (c?.line) inp.value = c.line; return; }
      if (e.key !== 'Enter') return;
      const cmd = inp.value;
      inp.value = '';
      const o = (S.out[S.dev] ||= []);
      o.push({ t: S.cli.prompt(S.dev) + cmd, c: 'cmd' });
      try { o.push(...S.cli.exec(S.dev, cmd).out.map((t) => ({ t }))); } catch (err) { o.push({ t: '% ' + err.message }); }
      (cur.simlog[k] ||= []).push([S.dev, cmd]);
      persist(); renderNav(); paint();
    };
    paint();
    inp.focus();
  }

  // ---------------------------------------------------------------- nộp bài + kết quả
  function submit() {
    clearInterval(timer);
    const answers = exam.qs.map((q, i) => {
      if (q.kind !== 'sim') return cur.answers[i];
      const S = simOf(i);
      const r = checkLab(S.lab, S.net, {});
      const real = S.lab.tasks.map((t, j) => [t, j]).filter(([t]) => !t.quiz).map(([, j]) => j);
      return real.filter((j) => r[j]).length / real.length;
    });
    const g = E.gradeExam(exam, answers);
    const secs = Math.min(exam.minutes * 60, Math.round((Date.now() - cur.t0) / 1000));
    const weak = g.domains.filter((d) => d.pct != null).sort((a, b) => a.pct - b.pct)[0];
    save('ccna-exam-hist', [{ at: Date.now(), mode: cur.mode, score: g.score, pass: g.pass, secs, weak: weak && weak.pct < 1 ? weak.name : '' }, ...load('ccna-exam-hist', [])].slice(0, 50));
    save('ccna-exam-cur', null);
    const done = cur;
    cur = null;
    showResult(g, answers, done, secs);
  }
  function ansText(q, a) {
    if (a == null || (Array.isArray(a) && !a.length)) return '<i>(bỏ trống)</i>';
    if (q.kind === 'one') return esc(q.options[a]);
    if (q.kind === 'multi') return a.map((x) => esc(q.options[x])).join(' + ');
    if (q.kind === 'match') return q.left.map((l, j) => `${esc(l)} → ${a[j] == null ? '?' : esc(q.right[a[j]])}`).join('<br>');
    return `${Math.round(a * 100)}% nhiệm vụ đạt`;
  }
  function rightText(q) {
    if (q.kind === 'one') return esc(q.options[q.answer]);
    if (q.kind === 'multi') return q.answer.map((x) => esc(q.options[x])).join(' + ');
    if (q.kind === 'match') return q.left.map((l, j) => `${esc(l)} → ${esc(q.right[q.rightAns[j]])}`).join('<br>');
    return 'Đạt mọi nhiệm vụ của lab (mở lab ' + esc(q.lab) + ' trong 🧪 Lab CLI để xem lời giải)';
  }
  function showResult(g, answers, st, secs) {
    modal.innerHTML = `<div class="modal-h"><span>🎓 Kết quả thi thử</span><button class="modal-x" aria-label="đóng">✕</button></div>` +
      `<div class="modal-b ex-res"><div class="ex-score ${g.pass ? 'ok' : 'bad'}"><b>${g.score}</b>/1000 · ${g.pass ? '✓ ĐẠT' : '✗ CHƯA ĐẠT'} (cần ${E.PASS}) · ${fmt(secs)}</div>` +
      `<div class="ex-bars">${g.domains.filter((d) => d.max).map((d) => `<div class="ex-bar"><span>${esc(d.name)}</span><div class="ex-track"><div style="width:${Math.round(d.pct * 100)}%" class="${d.pct >= 0.8 ? 'ok' : d.pct >= 0.6 ? 'mid' : 'bad'}"></div></div><b>${Math.round(d.pct * 100)}%</b></div>`).join('')}</div>` +
      `<h4>Xem lại ${g.wrong.length} câu chưa đạt trọn</h4>` +
      (g.wrong.length ? `<ol class="ex-review">${g.wrong.map((i) => { const q = exam.qs[i]; return `<li value="${i + 1}"><div class="ex-text">${q.kind === 'sim' ? '🧪 Lab: ' + esc(getLab(q.lab).title) : esc(q.text)}</div><div class="ex-ra">Bạn: ${ansText(q, answers[i])}</div><div class="ex-rr">Đúng: ${rightText(q)}</div>${q.explain ? `<div class="ex-re">💬 ${esc(q.explain)}</div>` : ''}</li>`; }).join('')}</ol>` : '<p>Không sai câu nào 🎉</p>') +
      `</div><div class="pg-foot"><button id="ex-again" class="btn-accent">Làm đề mới</button><button id="ex-home">Về trang đầu</button></div>`;
    modal.querySelector('.modal-x').onclick = close;
    modal.querySelector('#ex-home').onclick = home;
    modal.querySelector('#ex-again').onclick = () => begin({ seed: (Math.random() * 0x7fffffff) >>> 0 || 1, mode: st.mode, t0: Date.now(), answers: {}, flags: {}, simlog: {} });
  }
  home();
}
