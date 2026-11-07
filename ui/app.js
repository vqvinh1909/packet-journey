// ui/app.js — bộ điều phối: nối topology, timeline, ngăn xếp tầng, chi tiết gói.

import { esc } from './topo.js';
import { SCENARIOS, getScenario } from '../scenarios/index.js';
import { downloadPcap } from '../packet/pcap.js';
import { flattenFields } from '../packet/serialize.js';
import { t, getLang, setLang, onLangChange, lessonHref } from './i18n.js';
import { load, save, markDone } from './store.js';
import { openGlossary } from './glossary.js';
import { openProgress } from './progress.js';
import { openBuilder } from './builder.js';
import { buildCustom } from '../scenarios/builder.js';
import { openDiagram } from './diagram.js';
import { openWorkspace } from './workspace.js';
import { sandboxFromDiagram } from '../lab/diagram-bridge.js';
import { openLab } from './lab.js';
import { openSubnet } from './subnet.js';
import { openWeak } from './weak.js';
import { openRoadmap } from './roadmap.js';
import { openCheat } from './cheat.js';
import { openExam } from './exam.js';
import * as topo from './topology.js';
import { renderControls } from './controls.js';
import { renderLayerStack } from './layerstack.js';
import { renderFieldTree, highlightFieldRow, clearFieldHighlight } from './fieldtree.js';
import { renderHex, highlightRange, clearHexHighlight } from './hexview.js';
import { renderExplain } from './explain.js';
import { openQuiz } from './quiz.js';
import { buildQuiz, QUIZ_LEN } from '../scenarios/quizzes.js';
import { GUESS } from '../scenarios/guess.js';

const $ = (id) => document.getElementById(id);

const state = {
  scenarioId: load('scenario', SCENARIOS[0].meta.id),
  sim: null,
  step: 0,
  playing: false,
  speed: load('speed', 1),
  tab: load('tab', 'fields'),
  playToken: 0,
  guessMode: load('guess', false),
  answered: new Set(), // "scenarioId#seq" các bước đã đoán
};

let controls;
let tabBody;
let els = {};

function boot() {
  // theme
  document.documentElement.setAttribute('data-theme', load('theme', 'light'));
  document.documentElement.setAttribute('lang', getLang());

  buildChrome();
  controls = renderControls($('controls'), controlCbs(), t);
  buildTabs();

  loadScenario(state.scenarioId);
  onLangChange(() => { refreshChromeText(); controls = renderControls($('controls'), controlCbs(), t); buildTabs(); loadScenario(state.scenarioId); });
  bindKeys();

  // PWA: đăng ký service worker để chạy offline (bỏ qua nếu lỗi/không hỗ trợ).
  // updateViaCache:'none' → trình duyệt luôn kiểm tra sw.js mới, không dùng bản cũ trong cache.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Lần đầu các module đã tải xong trước khi service worker chạy nên nó không thấy: gửi danh sách cho nó lưu.
      const firstVisit = !navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => { if (firstVisit) reg.active?.postMessage({ cache: performance.getEntriesByType('resource').map((r) => r.name).filter((u) => new URL(u).origin === location.origin) }); })
        .catch(() => {});
    });
  }

  // Báo cho bộ tự phục hồi trong index.html: app đã chạy bình thường.
  window.__pjBooted = true;
  sessionStorage.removeItem('pj-heal');
}

// ---------- Chrome (header + panel headers) ----------
function buildChrome() {
  // Giáo trình nằm ngoài repo: máy không có thì ẩn link thay vì để người dùng bấm vào 404. Chỉ 404 mới tính, mất mạng thì giữ.
  fetch(lessonHref('../Network security/x/Bai-01_x.md'), { method: 'HEAD' }).then((r) => {
    if (r.status === 404) document.documentElement.classList.add('no-lessons');
  }).catch(() => {});
  const sel = $('sel-scenario');
  sel.innerHTML = SCENARIOS.map((s) => `<option value="${s.meta.id}">${esc(s.meta.titleVi)}</option>`).join('');
  sel.value = state.scenarioId;
  sel.onchange = () => {
    loadScenario(sel.value);
    // thanh bên trái vẫn bấm được khi Quiz đang mở: đổi kịch bản thì mở lại Quiz của kịch bản mới
    if (document.querySelector('body > .modal-backdrop .quiz-q')) openQuizForScenario();
  };

  $('btn-pcap').onclick = exportPcap;
  $('btn-theme').textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '🌙';
  $('btn-theme').onclick = toggleTheme;
  $('btn-lang').onclick = () => setLang(getLang() === 'vi' ? 'en' : 'vi');
  $('btn-quiz').onclick = openQuizForScenario;
  $('btn-guess').onclick = toggleGuess;
  $('btn-glossary').onclick = openGlossary;
  $('btn-progress').onclick = openProgress;
  $('btn-builder').onclick = () => openBuilder(loadCustom);
  $('btn-canvas').onclick = () => openDiagram(null, (json) => openWorkspace({ onRun: loadSimResult, initialNet: sandboxFromDiagram(json) }));
  $('btn-lab').onclick = () => openLab(loadSimResult);
  $('btn-subnet').onclick = openSubnet;
  $('btn-cheat').onclick = openCheat;
  $('btn-exam').onclick = openExam;
  $('btn-roadmap').onclick = () => openRoadmap({ openLab: (id) => openLab(loadSimResult, { labId: id }), openScenario: loadScenario, openExam });
  $('btn-weak').onclick = () => openWeak({ openLab: (id, x = {}) => openLab(loadSimResult, { labId: id, ...x }) });
  refreshGuessBtn();
  refreshChromeText();
}

function refreshGuessBtn() {
  $('btn-guess').classList.toggle('btn-accent', state.guessMode);
}

function toggleGuess() {
  state.guessMode = !state.guessMode;
  save('guess', state.guessMode);
  refreshGuessBtn();
  document.querySelector('body > .modal-backdrop')?.remove(); // Đoán bước chạy ở màn chính, bảng đang mở sẽ che mất
  const evs = state.sim?.events || [];
  // bật lên mà bước hiện tại không có câu hỏi thì nhảy tới bước có câu hỏi kế tiếp để thấy ngay
  const next = state.guessMode && !evs[state.step]?.decision ? evs.findIndex((e, i) => i > state.step && e.decision) : -1;
  renderStep(next >= 0 ? next : state.step, false);
}

function openQuizForScenario() {
  const sc = getScenario(state.scenarioId);
  if (!sc) {
    // đang xem mô phỏng tự tạo (🛠️ Tự tạo / ✏️ Vẽ mạng / "Xem gói tin" của Lab CLI) — quiz chỉ có cho kịch bản dựng sẵn
    openQuiz('custom', 'Kịch bản tự tạo', [
      { q: 'Quiz chỉ có cho các kịch bản dựng sẵn. Hãy chọn một kịch bản ở danh sách trên cùng rồi bấm 🎯 Quiz.', options: ['Đã hiểu'], correct: 0, explainVi: 'Mô phỏng bạn tự tạo vẫn xem từng bước, cây trường và hex như bình thường.' },
    ]);
    return;
  }
  // nhớ các câu của lượt trước để lượt này ưu tiên câu chưa gặp
  const seenKey = `quiz-seen_${state.scenarioId}`;
  const quiz = buildQuiz(state.scenarioId, Math.random, QUIZ_LEN, new Set(load(seenKey, []))) || sc.meta.quiz;
  if (quiz?.length) save(seenKey, quiz.map((q) => q.q));
  if (!quiz || !quiz.length) {
    openQuiz(state.scenarioId, sc.meta.titleVi, [
      { q: 'Kịch bản này chưa có bộ quiz riêng.', options: ['Đã hiểu'], correct: 0, explainVi: 'Quiz sẽ được bổ sung dần cho từng bài.' },
    ]);
    return;
  }
  openQuiz(state.scenarioId, sc.meta.titleVi, quiz);
}

function decisionKey(seq) { return `${state.scenarioId}#${seq}`; }

function refreshChromeText() {
  $('app-title').textContent = t('appTitle');
  $('app-sub').textContent = t('appSub');
  $('btn-pcap').textContent = t('exportPcap');
  $('btn-lang').textContent = getLang() === 'vi' ? 'EN' : 'VI';
  $('h-topology').textContent = t('topology');
  $('h-timeline').textContent = t('timeline');
  $('h-layer').textContent = t('layerStack');
  $('h-detail').textContent = t('packetDetail');
  // nút thanh trên cùng (nội dung lab / kịch bản vẫn là tiếng Việt)
  const en = getLang() === 'en';
  const HDR = {
    'btn-roadmap': ['🧭 Lộ trình', '🧭 Roadmap'], 'btn-subnet': ['🧮 Luyện subnet', '🧮 Subnetting'], 'btn-cheat': ['📋 Cheat sheet', '📋 Cheat sheet'], 'btn-exam': ['🎓 Thi thử CCNA', '🎓 CCNA mock exam'],
    'btn-weak': ['📊 Điểm yếu', '📊 Weak spots'], 'btn-guess': ['🤔 Đoán bước', '🤔 Guess step'], 'btn-quiz': ['🎯 Quiz', '🎯 Quiz'], 'btn-builder': ['🛠️ Tự tạo', '🛠️ Builder'],
    'btn-canvas': ['✏️ Vẽ mạng', '✏️ Draw network'], 'btn-glossary': ['📘 Từ điển', '📘 Glossary'], 'btn-progress': ['💾 Tiến độ', '💾 Progress'],
  };
  for (const [id, [vi, enT]] of Object.entries(HDR)) if ($(id)) $(id).textContent = en ? enT : vi;
}

// ---------- Tabs ----------
function buildTabs() {
  const tabs = $('tabs');
  const defs = [['fields', t('tabFields')], ['hex', t('tabHex')], ['explain', t('tabExplain')]];
  tabs.innerHTML = defs.map(([k, label]) =>
    `<button class="tab${k === state.tab ? ' active' : ''}" data-tab="${k}">${esc(label)}</button>`).join('');
  tabs.querySelectorAll('.tab').forEach((b) => {
    b.onclick = () => { state.tab = b.dataset.tab; save('tab', state.tab); applyTab(); };
  });

  tabBody = $('tab-body');
  tabBody.innerHTML =
    `<div id="tab-fields" class="ftree"></div>` +
    `<div id="tab-hex"><div id="hexview" class="hexview"></div><div class="hex-legend">${esc(t('hexLegend'))}</div></div>` +
    `<div id="tab-explain"></div>`;
  els = { fields: $('tab-fields'), hex: $('hexview'), explain: $('tab-explain'), hexTab: $('tab-hex') };
  applyTab();
}

function applyTab() {
  els.fields.style.display = state.tab === 'fields' ? '' : 'none';
  els.hexTab.style.display = state.tab === 'hex' ? '' : 'none';
  els.explain.style.display = state.tab === 'explain' ? '' : 'none';
  $('tabs').querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
}

// ---------- Scenario ----------
function loadScenario(id) {
  if (!getScenario(id)) id = SCENARIOS[0].meta.id; // ID lưu từ phiên cũ không còn tồn tại
  state.scenarioId = id;
  $('sel-scenario').value = id;
  save('scenario', id);
  const sc = getScenario(id);
  state.sim = sc.build();
  for (const [i, d] of Object.entries(GUESS[id] || {})) if (state.sim.events[i] && !state.sim.events[i].decision) state.sim.events[i].decision = d;
  state.step = 0;
  state.playing = false;
  state.playToken++;
  $('scenario-desc').textContent = sc.meta.descriptionVi;
  topo.renderTopology($('topology-svg'), state.sim.topology);
  controls.setEvents(state.sim.events);
  renderStep(0, false);
}

// ---------- Kịch bản tự tạo (Builder / Canvas — M5) ----------
function loadSimResult(res, descVi) {
  state.scenarioId = 'custom';
  state.sim = res;
  state.step = 0;
  state.playing = false;
  state.playToken++;
  $('scenario-desc').textContent = descVi || 'Mạng tự tạo: ping giữa 2 PC.';
  topo.renderTopology($('topology-svg'), res.topology);
  controls.setEvents(res.events);
  renderStep(0, false);
}
function loadCustom(p) {
  loadSimResult(buildCustom(p), `Kịch bản tự tạo: PC1 ${p.pc1Ip}/${p.pc1Prefix} ping PC2 ${p.pc2Ip}/${p.pc2Prefix}.`);
}

// ---------- Render 1 bước ----------
function renderStep(i, animate) {
  const events = state.sim.events;
  state.step = Math.max(0, Math.min(i, events.length - 1));
  const step = events[state.step];
  if (state.step === events.length - 1) markDone(state.scenarioId); // tới bước cuối = đã xem xong
  topo.applyOverlay(step.overlay);

  // topology
  if (step.kind === 'transit') {
    topo.setActiveDevice(step.fromDevice);
    if (animate) {
      return topo.animateDot(step.fromDevice, step.toDevice, 900 / state.speed, isArp(step))
        .then(() => { topo.setActiveDevice(step.toDevice); });
    }
    topo.placeDot(step.toDevice, isArp(step));
  } else {
    topo.setActiveDevice(step.atDevice);
    topo.hideDot();
  }
  paintPanels(step);
  return Promise.resolve();
}

function paintPanels(step) {
  topo.renderTables($('dev-tables'), step.tables, t);
  renderLayerStack($('layer-stack'), step, t);

  if (step.packet && step.packet.tree) {
    renderFieldTree(els.fields, step.packet.tree, step.changedFields, fieldHandlers(step));
    renderHex(els.hex, step.packet.bytes, changedRanges(step), byteHandlers(step));
  } else {
    els.fields.innerHTML = `<div class="fdesc">${esc(t('noPacket'))}</div>`;
    els.hex.innerHTML = `<div class="fdesc">${esc(t('noPacket'))}</div>`;
  }
  const key = decisionKey(step.seq);
  renderExplain(els.explain, step, t, {
    guessMode: state.guessMode,
    answered: state.answered.has(key),
    onAnswer: () => { state.answered.add(key); }, // chỉ ghi nhận; explain.js tự lộ đáp án inline
  });
  // Nếu đang bật chế độ đoán và bước này có câu hỏi chưa trả lời → tự nhảy sang tab Giải thích
  if (state.guessMode && step.decision && !state.answered.has(key) && state.tab !== 'explain') {
    state.tab = 'explain'; save('tab', state.tab); applyTab();
  }
  controls.setStep(state.step, step, state.playing);
}

// ---------- Cross-highlight hex <-> field ----------
function fieldHandlers() {
  return {
    onFieldHover: (start, len) => highlightRange(els.hex, start, len),
    onFieldLeave: () => clearHexHighlight(els.hex),
  };
}
function byteHandlers(step) {
  const flat = flattenFields(step.packet.tree);
  return {
    onByteHover: (idx) => {
      const f = flat.find((x) => idx >= x.byteOffset && idx < x.byteOffset + x.byteLength);
      if (!f) return;
      highlightRange(els.hex, f.byteOffset, f.byteLength);
      highlightFieldRow(els.fields, f.name);
    },
    onByteLeave: () => { clearHexHighlight(els.hex); clearFieldHighlight(els.fields); },
  };
}

function changedRanges(step) {
  if (!step.changedFields || !step.changedFields.length) return [];
  const flat = flattenFields(step.packet.tree);
  const ranges = [];
  for (const name of step.changedFields) {
    const f = flat.find((x) => x.name === name);
    if (f) ranges.push([f.byteOffset, f.byteLength]);
  }
  return ranges;
}

function isArp(step) {
  return step.packet?.tree?.some((l) => l.layer === 'arp');
}

// ---------- Điều khiển ----------
function controlCbs() {
  return {
    onFirst: () => { stop(); renderStep(0, false); },
    onPrev: () => { stop(); renderStep(state.step - 1, false); },
    onNext: () => { stop(); renderStep(state.step + 1, false); },
    onLast: () => { stop(); renderStep(state.sim.events.length - 1, false); },
    onPlayPause: () => (state.playing ? stop() : play()),
    onSeek: (i) => { stop(); renderStep(i, false); },
    onSpeed: (v) => { state.speed = v; save('speed', v); },
  };
}

function play() {
  if (state.step >= state.sim.events.length - 1) state.step = -1; // phát lại từ đầu
  state.playing = true;
  const token = ++state.playToken;
  const run = async () => {
    while (state.playing && token === state.playToken && state.step < state.sim.events.length - 1) {
      await renderStep(state.step + 1, true);
      if (!state.playing || token !== state.playToken) break;
      const cur = state.sim.events[state.step];
      // Chế độ đoán: dừng lại ở bước có câu hỏi chưa trả lời để người học chọn
      if (state.guessMode && cur.decision && !state.answered.has(decisionKey(cur.seq))) { stop(); controls.setStep(state.step, cur, false); break; }
      const dwell = (cur.kind === 'transit' ? 350 : 1100) / state.speed;
      await sleep(dwell);
    }
    if (token === state.playToken) { state.playing = false; controls.setStep(state.step, state.sim.events[state.step], false); }
  };
  run();
}

function stop() {
  state.playing = false;
  state.playToken++;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------- Khác ----------
function exportPcap() {
  if (!state.sim?.pcap?.length) return;
  downloadPcap(state.sim.pcap, `${state.scenarioId}.pcap`);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  save('theme', next);
  $('btn-theme').textContent = next === 'dark' ? '☀' : '🌙';
}

function bindKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); stop(); renderStep(state.step + 1, false); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); renderStep(state.step - 1, false); }
    else if (e.key === ' ') { e.preventDefault(); state.playing ? stop() : play(); }
  });
}


boot();
