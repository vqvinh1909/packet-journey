// ui/exam.js — "🎓 Thi thử CCNA": màn hình bắt đầu (lịch sử các lần thi), phòng thi (đồng hồ đếm ngược, lưới câu
// hỏi, đánh dấu ⚑, câu lab có console thu nhỏ), nộp bài → điểm thang 1000, điểm từng mảng, xem lại câu sai.
// Ngôn ngữ đề: VI / EN / VI+EN (song ngữ) — chọn ở góc trên, lưu "exam-lang"; mặc định theo ngôn ngữ của app.
// Bài đang làm lưu trong localStorage ("ccna-exam-cur") nên tải lại trang vẫn làm tiếp được.
import * as E from '../lab/ccna-exam.js';
import { getLab, buildLab, checkLab } from '../lab/labs.js';
import { createCli } from '../lab/ios.js';
import { load, save } from './store.js';
import { getLang } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const isHost = (d) => d.type === 'pc' || d.type === 'server';
const LANGS = [['vi', 'VI'], ['en', 'EN'], ['both', 'VI + EN']];

export function openExam() {
  document.querySelector('.modal-backdrop')?.remove();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal ex-modal';
  back.appendChild(modal);
  document.body.appendChild(back);
  let timer = 0, cur = null, exam = null, k = 0, sims = {}, screen = null, last = null;
  let lang = load('exam-lang', getLang() === 'en' ? 'en' : 'vi');
  const close = () => { clearInterval(timer); back.remove(); document.removeEventListener('keydown', onEsc); };
  function onEsc(e) { if (e.key === 'Escape' && !cur) close(); }
  document.addEventListener('keydown', onEsc);

  // ---------------------------------------------------------------- song ngữ
  /** Chữ giao diện: tiếng Anh khi chọn EN, còn lại tiếng Việt. */
  const ui = (vi, en) => (lang === 'en' ? en : vi);
  /** Nội dung câu hỏi (HTML): VI, EN, hoặc VI rồi dòng EN bên dưới. */
  const tx = (vi, en) => (lang === 'en' ? esc(en ?? vi) : lang === 'both' && en && en !== vi ? `${esc(vi)}<span class="ex-en">${esc(en)}</span>` : esc(vi));
  /** Chữ thường (trong <option>): VI / EN trên cùng một dòng. */
  const tp = (vi, en) => (lang === 'en' ? en ?? vi : lang === 'both' && en && en !== vi ? `${vi} / ${en}` : vi);
  const dom = (id) => { const d = E.DOMAINS.find((x) => x.id === id); return lang === 'en' ? d.name : lang === 'both' ? `${d.vi} (${d.name})` : d.vi; };
  const langBar = () => `<span class="ex-lang" role="group" aria-label="Ngôn ngữ đề / Language">${LANGS.map(([l, t]) => `<button data-lang="${l}" class="${l === lang ? 'on' : ''}">${t}</button>`).join('')}</span>`;
  function bindLang() {
    modal.querySelectorAll('.ex-lang button').forEach((b) => (b.onclick = () => { lang = b.dataset.lang; save('exam-lang', lang); screen(); }));
  }

  // ---------------------------------------------------------------- màn hình bắt đầu
  function home() {
    screen = home;
    clearInterval(timer);
    cur = load('ccna-exam-cur', null);
    const hist = load('ccna-exam-hist', []);
    const full = E.makeExam(1, 'full'), quick = E.makeExam(1, 'quick');
    modal.innerHTML = `<div class="modal-h"><span>🎓 ${ui('Thi thử CCNA 200-301', 'CCNA 200-301 mock exam')}</span>${langBar()}<button class="modal-x" aria-label="đóng">✕</button></div>` +
      `<div class="modal-b ex-home"><p>${ui(`Đề tự soạn theo 6 mảng kiến thức của CCNA 200-301 (không phải đề thật): trắc nghiệm một / nhiều đáp án, ghép cặp và câu <b>lab mô phỏng</b> gõ lệnh như Lab CLI. Mỗi đề có thêm các câu <b>sinh tự động với số liệu mới</b> (subnet, wildcard, bảng định tuyến, ACL…). Chấm thang <b>300–1000</b>, đạt từ <b>${E.PASS}</b>. Không xem được đáp án cho tới khi nộp bài.`, `Self-written questions covering the 6 CCNA 200-301 domains (not real exam questions): single / multiple answer, drag-and-drop matching and <b>simulation labs</b> typed in a CLI. Every exam also gets <b>auto-generated questions with fresh numbers</b> (subnetting, wildcards, routing tables, ACLs…). Scored <b>300–1000</b>, passing <b>${E.PASS}</b>. Answers are revealed only after you submit.`)}</p>` +
      `<table class="ex-dom"><tr><th>${ui('Mảng kiến thức', 'Domain')}</th><th>${ui('Tỉ trọng', 'Weight')}</th></tr>${E.DOMAINS.map((d) => `<tr><td>${esc(dom(d.id))}</td><td>${d.w}%</td></tr>`).join('')}</table>` +
      (cur ? `<div class="ex-resume">${ui(`Bạn đang làm dở một đề (${cur.mode === 'quick' ? 'rút gọn' : 'đầy đủ'}).`, `You have an unfinished ${cur.mode === 'quick' ? 'short' : 'full'} exam.`)} <button id="ex-cont" class="btn-accent">▶ ${ui('Làm tiếp', 'Resume')}</button> <button id="ex-drop">${ui('Bỏ bài này', 'Discard')}</button></div>` : '') +
      `<div class="ex-start"><button id="ex-full" class="btn-accent">${ui('Đề đầy đủ', 'Full exam')} — ${full.qs.length} ${ui('câu', 'questions')} · ${full.minutes} ${ui('phút', 'min')}</button><button id="ex-quick">${ui('Đề rút gọn', 'Short exam')} — ${quick.qs.length} ${ui('câu', 'questions')} · ${quick.minutes} ${ui('phút', 'min')}</button></div>` +
      (hist.length ? `<h4>${ui('Lịch sử thi', 'History')}</h4><table class="ex-hist"><tr><th>${ui('Ngày', 'Date')}</th><th>${ui('Đề', 'Exam')}</th><th>${ui('Điểm', 'Score')}</th><th>${ui('Thời gian', 'Time')}</th><th>${ui('Mảng yếu nhất', 'Weakest domain')}</th></tr>${hist.slice(0, 10).map((h) => `<tr><td>${new Date(h.at).toLocaleString(lang === 'en' ? 'en-GB' : 'vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</td><td>${h.mode === 'quick' ? ui('Rút gọn', 'Short') : ui('Đầy đủ', 'Full')}</td><td class="${h.pass ? 'ok' : 'bad'}">${h.score}${h.pass ? ' ✓' : ''}</td><td>${fmt(h.secs)}</td><td>${esc(h.weakId ? dom(h.weakId) : h.weak || '—')}</td></tr>`).join('')}</table>` : '') +
      `</div>`;
    modal.querySelector('.modal-x').onclick = close;
    bindLang();
    const start = (mode) => { if (cur && !confirm(ui('Bỏ bài đang làm dở và bắt đầu đề mới?', 'Discard the unfinished exam and start a new one?'))) return; begin({ seed: (Math.random() * 0x7fffffff) >>> 0 || 1, mode, t0: Date.now(), answers: {}, flags: {}, simlog: {} }); };
    modal.querySelector('#ex-full').onclick = () => start('full');
    modal.querySelector('#ex-quick').onclick = () => start('quick');
    if (cur) {
      modal.querySelector('#ex-cont').onclick = () => begin(cur);
      modal.querySelector('#ex-drop').onclick = () => { if (confirm(ui('Bỏ bài đang làm? Bài này không được tính điểm.', 'Discard this exam? It will not be scored.'))) { save('ccna-exam-cur', null); home(); } };
    }
  }

  // ---------------------------------------------------------------- phòng thi
  function begin(state) {
    cur = state;
    save('ccna-exam-cur', cur);
    exam = E.makeExam(cur.seed, cur.mode);
    sims = {};
    k = Math.min(cur.k || 0, exam.qs.length - 1);
    room();
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    tick();
  }
  function tick() {
    if (!cur || !exam) return;
    const left = cur.t0 + exam.minutes * 60000 - Date.now();
    const el = modal.querySelector('#ex-clock');
    if (!el) return;
    el.textContent = '⏱ ' + fmt(Math.max(0, left / 1000));
    el.classList.toggle('low', left < 5 * 60000);
    if (left <= 0) { alert(ui('Hết giờ — bài được nộp tự động.', 'Time is up — the exam was submitted automatically.')); submit(); }
  }
  /** Khung phòng thi (vẽ lại khi đổi ngôn ngữ, không đụng đồng hồ / bài làm). */
  function room() {
    screen = room;
    modal.innerHTML = `<div class="modal-h ex-h"><span>🎓 ${ui('Thi thử CCNA', 'CCNA mock exam')} — ${cur.mode === 'quick' ? ui('đề rút gọn', 'short') : ui('đề đầy đủ', 'full')}</span>${langBar()}<span class="ex-clock" id="ex-clock"></span><button id="ex-submit" class="btn-accent">📝 ${ui('Nộp bài', 'Submit')}</button></div>` +
      `<div class="ex-body"><nav class="ex-nav" id="ex-nav"></nav><section class="ex-q" id="ex-q"></section></div>` +
      `<div class="ex-foot"><button id="ex-prev">← ${ui('Câu trước', 'Previous')}</button><button id="ex-flag">⚑ ${ui('Đánh dấu xem lại', 'Mark for review')}</button><button id="ex-next">${ui('Câu sau', 'Next')} →</button></div>`;
    bindLang();
    modal.querySelector('#ex-submit').onclick = () => { const left = exam.qs.filter((q, i) => !answered(i)).length; if (confirm(left ? ui(`Còn ${left} câu chưa trả lời. Nộp bài?`, `${left} questions are unanswered. Submit?`) : ui('Nộp bài?', 'Submit?'))) submit(); };
    modal.querySelector('#ex-prev').onclick = () => go(k - 1);
    modal.querySelector('#ex-next').onclick = () => go(k + 1);
    modal.querySelector('#ex-flag').onclick = () => { cur.flags[k] = !cur.flags[k]; persist(); renderNav(); renderQ(); };
    tick();
    renderNav();
    renderQ();
  }
  const persist = () => { cur.k = k; save('ccna-exam-cur', cur); };
  const answered = (i) => { const q = exam.qs[i], a = cur.answers[i]; return q.kind === 'sim' ? !!(cur.simlog[i]?.length) : q.kind === 'match' ? Array.isArray(a) && a.every((x) => x != null && x !== '') : q.kind === 'multi' ? Array.isArray(a) && a.length > 0 : a != null; };
  function go(i) { if (i < 0 || i >= exam.qs.length) return; k = i; persist(); renderNav(); renderQ(); }
  function renderNav() {
    const nav = modal.querySelector('#ex-nav');
    nav.innerHTML = `<div class="ex-nav-h">${exam.qs.filter((q, i) => answered(i)).length}/${exam.qs.length} ${ui('đã làm', 'answered')}</div><div class="ex-grid">` +
      exam.qs.map((q, i) => `<button data-i="${i}" class="${i === k ? 'cur ' : ''}${answered(i) ? 'done ' : ''}${cur.flags[i] ? 'flag' : ''}" title="${q.kind === 'sim' ? ui('Câu lab mô phỏng', 'Simulation lab') : q.gen ? ui('Câu sinh tự động', 'Auto-generated') : ''}">${i + 1}${q.kind === 'sim' ? '🧪' : ''}</button>`).join('') + '</div>';
    nav.querySelectorAll('button').forEach((b) => (b.onclick = () => go(+b.dataset.i)));
  }
  function renderQ() {
    const q = exam.qs[k], box = modal.querySelector('#ex-q');
    modal.querySelector('#ex-flag').classList.toggle('on', !!cur.flags[k]);
    const head = `<div class="ex-qh">${ui('Câu', 'Question')} ${k + 1}/${exam.qs.length} · ${esc(dom(q.domain))}${q.kind === 'multi' ? ` · <b>${ui(`chọn ${q.answer.length} đáp án`, `choose ${q.answer.length}`)}</b>` : ''}${q.kind === 'match' ? ` · ${ui('ghép cặp', 'matching')}` : ''}${q.gen ? ` · <span class="ex-gen">${ui('số liệu mới', 'fresh numbers')}</span>` : ''}</div>`;
    const a = cur.answers[k];
    if (q.kind === 'one' || q.kind === 'multi') {
      box.innerHTML = head + `<div class="ex-text">${tx(q.text, q.textEn)}</div><div class="ex-opts">` +
        q.options.map((o, j) => `<label class="ex-opt"><input type="${q.kind === 'one' ? 'radio' : 'checkbox'}" name="exo" value="${j}"${(q.kind === 'one' ? a === j : (a || []).includes(j)) ? ' checked' : ''}> <span>${String.fromCharCode(65 + j)}. ${tx(o, q.optionsEn?.[j])}</span></label>`).join('') + '</div>';
      box.querySelectorAll('input').forEach((inp) => (inp.onchange = () => {
        cur.answers[k] = q.kind === 'one' ? +inp.value : [...box.querySelectorAll('input:checked')].map((x) => +x.value);
        persist(); renderNav();
      }));
    } else if (q.kind === 'match') {
      box.innerHTML = head + `<div class="ex-text">${tx(q.text, q.textEn)}</div><table class="ex-match">` +
        q.left.map((l, j) => `<tr><td>${tx(l, q.leftEn?.[j])}</td><td>→</td><td><select data-j="${j}"><option value="">— ${ui('chọn', 'choose')} —</option>${q.right.map((r, x) => `<option value="${x}"${a?.[j] === x ? ' selected' : ''}>${esc(tp(r, q.rightEn?.[x]))}</option>`).join('')}</select></td></tr>`).join('') + '</table>';
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
    box.innerHTML = head + `<div class="ex-text"><b>${ui('Câu lab mô phỏng:', 'Simulation lab:')}</b> ${esc(S.lab.title)}</div>` + (lang !== 'vi' ? `<div class="ex-note">(${ui('Nội dung lab hiện chỉ có tiếng Việt; lệnh Cisco giống hệt đề thật.', 'Lab content is in Vietnamese only; the Cisco commands are the same as on the real exam.')})</div>` : '') + `<div class="ex-story">${esc(S.lab.story)}</div>` +
      `<div class="ex-tasks"><b>${ui('Yêu cầu (chấm khi nộp bài):', 'Tasks (graded on submit):')}</b><ol>${tasks.map((t) => `<li>${esc(t.text)}</li>`).join('')}</ol></div>` +
      `<div class="ex-devs">${ds.map((d) => `<button data-d="${d.id}" class="${d.id === S.dev ? 'on' : ''}">${esc(d.name)}</button>`).join('')}</div>` +
      `<pre class="ex-term" id="ex-term"></pre><div class="ex-in"><span id="ex-pr"></span><input id="ex-cmd" autocomplete="off" spellcheck="false" placeholder="${ui('gõ lệnh, Enter (Tab hoàn thành lệnh)', 'type a command, Enter (Tab to complete)')}"></div>`;
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
    save('ccna-exam-hist', [{ at: Date.now(), mode: cur.mode, score: g.score, pass: g.pass, secs, weakId: weak && weak.pct < 1 ? weak.id : null }, ...load('ccna-exam-hist', [])].slice(0, 50));
    save('ccna-exam-cur', null);
    last = { g, answers, st: cur, secs };
    cur = null;
    result();
  }
  function ansText(q, a) {
    if (a == null || (Array.isArray(a) && !a.length)) return `<i>(${ui('bỏ trống', 'blank')})</i>`;
    if (q.kind === 'one') return tx(q.options[a], q.optionsEn?.[a]);
    if (q.kind === 'multi') return a.map((x) => tx(q.options[x], q.optionsEn?.[x])).join(' + ');
    if (q.kind === 'match') return q.left.map((l, j) => `${esc(tp(l, q.leftEn?.[j]))} → ${a[j] == null ? '?' : esc(tp(q.right[a[j]], q.rightEn?.[a[j]]))}`).join('<br>');
    return `${Math.round(a * 100)}% ${ui('nhiệm vụ đạt', 'of tasks done')}`;
  }
  function rightText(q) {
    if (q.kind === 'one') return tx(q.options[q.answer], q.optionsEn?.[q.answer]);
    if (q.kind === 'multi') return q.answer.map((x) => tx(q.options[x], q.optionsEn?.[x])).join(' + ');
    if (q.kind === 'match') return q.left.map((l, j) => `${esc(tp(l, q.leftEn?.[j]))} → ${esc(tp(q.right[q.rightAns[j]], q.rightEn?.[q.rightAns[j]]))}`).join('<br>');
    return ui(`Đạt mọi nhiệm vụ của lab (mở lab ${esc(q.lab)} trong 🧪 Lab CLI để xem lời giải)`, `Complete every task of the lab (open lab ${esc(q.lab)} in 🧪 Lab CLI to see the solution)`);
  }
  function result() {
    screen = result;
    const { g, answers, st, secs } = last;
    modal.innerHTML = `<div class="modal-h"><span>🎓 ${ui('Kết quả thi thử', 'Exam result')}</span>${langBar()}<button class="modal-x" aria-label="đóng">✕</button></div>` +
      `<div class="modal-b ex-res"><div class="ex-score ${g.pass ? 'ok' : 'bad'}"><b>${g.score}</b>/1000 · ${g.pass ? ui('✓ ĐẠT', '✓ PASS') : ui('✗ CHƯA ĐẠT', '✗ FAIL')} (${ui('cần', 'need')} ${E.PASS}) · ${fmt(secs)}</div>` +
      `<div class="ex-bars">${g.domains.filter((d) => d.max).map((d) => `<div class="ex-bar"><span>${esc(dom(d.id))}</span><div class="ex-track"><div style="width:${Math.round(d.pct * 100)}%" class="${d.pct >= 0.8 ? 'ok' : d.pct >= 0.6 ? 'mid' : 'bad'}"></div></div><b>${Math.round(d.pct * 100)}%</b></div>`).join('')}</div>` +
      `<h4>${ui(`Xem lại ${g.wrong.length} câu chưa đạt trọn`, `Review ${g.wrong.length} questions not fully correct`)}</h4>` +
      (g.wrong.length ? `<ol class="ex-review">${g.wrong.map((i) => { const q = exam.qs[i]; return `<li value="${i + 1}"><div class="ex-text">${q.kind === 'sim' ? '🧪 Lab: ' + esc(getLab(q.lab).title) : tx(q.text, q.textEn)}</div><div class="ex-ra">${ui('Bạn', 'You')}: ${ansText(q, answers[i])}</div><div class="ex-rr">${ui('Đúng', 'Correct')}: ${rightText(q)}</div>${q.explain ? `<div class="ex-re">💬 ${tx(q.explain, q.explainEn)}</div>` : ''}</li>`; }).join('')}</ol>` : `<p>${ui('Không sai câu nào 🎉', 'No mistakes 🎉')}</p>`) +
      `</div><div class="pg-foot"><button id="ex-again" class="btn-accent">${ui('Làm đề mới', 'New exam')}</button><button id="ex-home">${ui('Về trang đầu', 'Back to start')}</button></div>`;
    modal.querySelector('.modal-x').onclick = close;
    bindLang();
    modal.querySelector('#ex-home').onclick = home;
    modal.querySelector('#ex-again').onclick = () => begin({ seed: (Math.random() * 0x7fffffff) >>> 0 || 1, mode: st.mode, t0: Date.now(), answers: {}, flags: {}, simlog: {} });
  }
  home();
}
