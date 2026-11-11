// ui/roadmap.js — "🧭 Lộ trình": học theo đề cương CCNA v2.0, xem việc đã xong và việc nên làm tiếp (lab/roadmap.js).
import { esc } from './topo.js';
import { ROADMAP, CCNP_DOCS, roadmapProgress, topicKey, topicProgress, scenarioDone } from '../lab/roadmap.js';
import { getLab } from '../lab/labs.js';
import { B } from '../lab/kit.js';
import { QUIZZES, QUIZ_LEN } from '../scenarios/quizzes.js';
import { SCENARIOS } from '../scenarios/index.js';
import { lessonHref } from './i18n.js';
import { libQuiz, libCount, LIB_LEN } from '../lab/library-quiz.js';
import { openQuiz } from './quiz.js';
import { load, save } from './store.js';

const scenarioOf = (short) => SCENARIOS.find((s) => s.meta.id.startsWith(`${short}-`));
const lessonLink = (n) => lessonHref(`${B}x/Bai-${String(n).padStart(2, '0')}_x.md`);

function readState() {
  const quizBest = {}, quizSize = {};
  for (const s of SCENARIOS) {
    const short = s.meta.id.slice(0, 3);
    quizBest[short] = load(`quiz_${s.meta.id}`, 0);
    quizSize[short] = QUIZZES[s.meta.id] ? QUIZ_LEN : 0;
  }
  return { read: load('roadmap-read', {}), labsDone: load('labs-done', {}), quizBest, quizSize };
}

/** o.openLab(id), o.openScenario(fullId), o.openExam() */
export function openRoadmap(o = {}) {
  document.querySelector('.modal-backdrop')?.remove();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal rm-modal';
  back.appendChild(modal);
  const close = () => { back.remove(); document.removeEventListener('keydown', onEsc); };
  function onEsc(e) { if (e.key === 'Escape') close(); }
  const openStages = new Set();

  const labRow = (id, done) => `<button class="rm-item${done ? ' done' : ''}" data-lab="${id}"><span>${done ? '✓' : '○'}</span><b>${id}</b> ${esc(getLab(id).title)}</button>`;
  const topicHtml = (t, st, isNext, optional) => {
    const more = [...t.more, ...(t.shared || [])];
    const p = topicProgress(t, st);
    return `<article class="rm-topic${p.complete && !optional ? ' done' : ''}${isNext ? ' next' : ''}"${isNext ? ' id="rm-next"' : ''}>` +
      `<header><span class="rm-ref">${esc(t.ref)}</span><h4>${esc(t.title)}</h4>${optional ? '' : `<span class="rm-count">${p.done}/${p.total}</span>`}</header>` +
      `<div class="rm-read">${t.lessons.map((n) => `<a href="${lessonLink(n)}" target="_blank" rel="noopener">📖 Bài ${n}</a>`).join('')}` +
      (t.docs || []).map((d) => `<a href="${lessonHref(d.path)}" target="_blank" rel="noopener">📖 ${esc(d.label)}</a>`).join('') +
      (optional ? '' : `<label><input type="checkbox" data-read="${esc(topicKey(t))}"${st.read[topicKey(t)] ? ' checked' : ''}> Đã nắm lý thuyết</label>`) + `</div>` +
      (t.notes ? `<details class="rm-notes"><summary>📝 Bài đọc ngắn</summary><ul>${t.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></details>` : '') +
      t.sc.map((id) => { const d = !optional && scenarioDone(id, st); return `<button class="rm-item${d ? ' done' : ''}" data-sc="${id}"><span>${d ? '✓' : '○'}</span><b>Xem gói tin</b> ${esc(scenarioOf(id).meta.titleVi)}, rồi làm 🎯 Quiz</button>`; }).join('') +
      (t.quiz ? `<button class="rm-item" data-libquiz="${esc(t.quiz)}" data-title="${esc(t.title)}"><span>🎯</span><b>${t.quiz === 'Wireshark' ? 'Bài tập đọc gói' : 'Quiz ôn tập'}</b> ${Math.min(LIB_LEN, libCount(t.quiz))} câu mỗi lượt · ngân hàng ${libCount(t.quiz)} câu, lượt sau ưu tiên câu chưa gặp</button>` : '') +
      t.core.map((id) => labRow(id, !!st.labsDone[id])).join('') +
      (more.length ? `<details class="rm-more"><summary>${optional ? 'Lab' : 'Lab luyện thêm'} (${more.filter((id) => st.labsDone[id]).length}/${more.length})</summary>${more.map((id) => labRow(id, !!st.labsDone[id])).join('')}</details>` : '') +
      (t.gap ? `<p class="rm-gap">⚠ App ${esc(t.gap)}.</p>` : '') + `</article>`;
  };

  function render() {
    const st = readState(), P = roadmapProgress(st);
    if (!openStages.size && P.next) openStages.add(P.next.stage.id);
    modal.innerHTML = `<div class="modal-h"><span>🧭 Lộ trình: CCNA, CCNP, Security, System</span><button class="modal-x" aria-label="Đóng">✕</button></div>` +
      `<div class="modal-b rm-body"><div class="rm-sum"><div class="rm-bar" role="progressbar" aria-valuenow="${P.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ lộ trình"><i style="width:${P.pct}%"></i></div>` +
      `<div class="rm-sumt"><b>${P.pct}%</b> · ${P.done}/${P.total} việc bắt buộc${P.next ? `<button id="rm-go" class="btn-accent">▶ Học tiếp: ${esc(P.next.topic.ref)} ${esc(P.next.topic.title)}</button>` : ' · Đã xong, sẵn sàng thi thử'}</div></div>` +
      `<div class="rm-read">${CCNP_DOCS.map((d) => `<a href="${lessonHref(d.path)}" target="_blank" rel="noopener">${esc(d.label)}</a>`).join('')}</div>` +
      ROADMAP.map((stage) => {
        const ps = stage.topics.map((t) => topicProgress(t, st));
        const count = stage.optional ? '' : `<span class="rm-count">${ps.filter((p) => p.complete).length}/${ps.length} chủ đề</span>`;
        return `<details class="rm-stage" data-stage="${stage.id}"${openStages.has(stage.id) ? ' open' : ''}><summary><b>${esc(stage.name)}</b>${stage.weight ? `<span class="rm-w">${stage.weight}% đề thi</span>` : ''}${count}</summary>` +
          stage.topics.map((t) => topicHtml(t, st, P.next?.topic === t, stage.optional)).join('') + `</details>`;
      }).join('') +
      `<div class="rm-exam"><button id="rm-exam">🎓 Thi thử CCNA</button></div></div>`;
    modal.querySelector('.modal-x').onclick = close;
    modal.querySelector('#rm-exam').onclick = () => { close(); o.openExam?.(); };
    const go = modal.querySelector('#rm-go');
    if (go) go.onclick = () => modal.querySelector('#rm-next')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    modal.querySelectorAll('.rm-stage').forEach((d) => (d.ontoggle = () => { if (d.open) openStages.add(d.dataset.stage); else openStages.delete(d.dataset.stage); }));
    modal.querySelectorAll('[data-lab]').forEach((b) => (b.onclick = () => { close(); o.openLab?.(b.dataset.lab); }));
    modal.querySelectorAll('[data-libquiz]').forEach((b) => (b.onclick = () => {
      // nhớ các câu đã ra để lượt sau rút câu khác; đi hết ngân hàng thì bắt đầu vòng mới
      const ref = b.dataset.libquiz, key = `libseen_${ref}`, seen = load(key, []);
      const quiz = libQuiz(ref, Math.random, LIB_LEN, new Set(seen));
      const all = [...new Set([...seen, ...quiz.map((q) => q.q)])];
      save(key, all.length >= libCount(ref) ? quiz.map((q) => q.q) : all);
      close(); openQuiz('lib-' + ref, b.dataset.title, quiz);
    }));
    modal.querySelectorAll('[data-sc]').forEach((b) => (b.onclick = () => { close(); o.openScenario?.(scenarioOf(b.dataset.sc).meta.id); }));
    modal.querySelectorAll('[data-read]').forEach((c) => (c.onchange = () => {
      const read = load('roadmap-read', {});
      if (c.checked) read[c.dataset.read] = true; else delete read[c.dataset.read];
      save('roadmap-read', read);
      const top = modal.querySelector('.rm-body').scrollTop;
      render();
      modal.querySelector('.rm-body').scrollTop = top;
    }));
  }
  back.onclick = (e) => { if (e.target === back) close(); };
  document.addEventListener('keydown', onEsc);
  render();
  document.body.appendChild(back);
}
