// ui/diagram.js — "✏️ Vẽ mạng": trình vẽ sơ đồ topology kiểu draw.io (chỉ để vẽ; cấu hình & chạy thử ở Lab CLI).
//   • Thư viện hình (thiết bị mạng + hình cơ bản, có tìm kiếm): kéo vào khung vẽ hoặc bấm để thêm.
//   • Chọn (bấm, Shift+bấm, quét khung), kéo di chuyển (bắt lưới), 8 tay nắm đổi kích thước, sửa chữ tại chỗ (nháy đúp).
//   • Nối dây: rê chuột lên hình → kéo từ chấm xanh sang hình khác. Dây thẳng / gấp khúc / cong, nét, mũi tên, nhãn.
//   • Bảng Định dạng bên phải, menu chuột phải, phím tắt như draw.io, hoàn tác, nhóm, khoá, căn lề, dàn đều, thứ tự lớp.
//   • Tự lưu (localStorage "diagram"), mẫu sơ đồ, xuất PNG / SVG / JSON, mở lại JSON.
import { esc } from './topo.js';
import * as D from '../lab/diagram.js';
import { load, save } from './store.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const ALL_DIAGRAM_PACKS = ['net', 'physical', 'security', 'devops', 'cloud', 'ops', 'app', 'basic'];
let clipboard = null; // giữ qua các lần đóng/mở trong phiên
let styleClipboard = null;
let disposeActiveDiagram = null;

export function openDiagram(initial = null, onToWorkspace = null) {
  disposeActiveDiagram?.();
  document.querySelector('.dg')?.remove();
  let dg;
  try { dg = initial ? D.importJson(initial) : D.importJson(load('diagram', null) || ''); } catch { dg = D.TEMPLATES[0].build(); }
  let pages=load('diagram-pages',[]), pageIndex=Math.max(0,Math.min(load('diagram-page-index',0),pages.length-1));
  if(initial){ // mở từ lab/workspace: thêm trang mới, không đụng các trang đã lưu
    if(!pages.length)try{pages=[{name:'Page-1',json:D.exportJson(D.importJson(load('diagram',null)))}]}catch{}
    const json=D.exportJson(dg);
    pageIndex=pages.findIndex(p=>p.json===json);
    if(pageIndex<0){pages.push({name:`Từ lab ${pages.length+1}`,json});pageIndex=pages.length-1;}
  }
  if(!pages.length) pages=[{name:'Page-1',json:D.exportJson(dg)}];
  if(!initial&&pages[pageIndex]?.json)try{dg=D.importJson(pages[pageIndex].json)}catch{}
  const arrowsMigrated=load('diagram-arrowheads-v1',false), savedEdgeStyle=load('diagram-edge',null);
  let edgeStyle=savedEdgeStyle||{style:'straight',dash:'solid',arrowA:true,arrowB:true};
  if(!arrowsMigrated){
    const addBidirectionalArrows=(d)=>{for(const e of d.edges)if(!e.arrowA&&!e.arrowB){e.arrowA=true;e.arrowB=true;}return d;};
    dg=addBidirectionalArrows(dg);
    pages=pages.map(p=>{try{return {...p,json:D.exportJson(addBidirectionalArrows(D.importJson(p.json)))}}catch{return p;}});
    pages[pageIndex]={...pages[pageIndex],json:D.exportJson(dg)};save('diagram-pages',pages);save('diagram',JSON.parse(D.exportJson(dg)));
    if(!savedEdgeStyle||(!savedEdgeStyle.arrowA&&!savedEdgeStyle.arrowB))edgeStyle={...edgeStyle,arrowA:true,arrowB:true};
    save('diagram-edge',edgeStyle);save('diagram-arrowheads-v1',true);
  }
  let hist = D.createHistory();
  const packsMigrated = load('diagram-packs-v2', false);
  const packs = packsMigrated ? load('diagram-packs', ALL_DIAGRAM_PACKS) : ALL_DIAGRAM_PACKS;
  if (!packsMigrated) { save('diagram-packs', ALL_DIAGRAM_PACKS); save('diagram-packs-v2', true); }
  const st = { sel: [], view: load('diagram-view', null) || { x: 40, y: 30, k: 1 }, grid: load('diagram-grid', true), snap: load('diagram-snap', true), edgeStyle, q: '', packs, favorites: load('diagram-favorites', []), inspector: false, vlan: '', guides: [] };
  const touchPoints=new Map(), activeTracks=new Set(); let pinch=null, pinching=false, gestureEpoch=0;
  const root = document.createElement('div');
  root.className = 'dg';
  root.innerHTML =
    `<div class="dg-top">` +
    `<span class="dg-title">✏️ Vẽ mạng</span><nav class="dg-menubar">` +
    `<details><summary>Tệp</summary><div><button data-act="new">Sơ đồ mới</button><button data-act="open">Mở JSON…</button><button data-act="open-drawio">Mở draw.io…</button><button data-act="save">Lưu trong trình duyệt</button><button data-act="versions">Lịch sử phiên bản…</button><button data-act="export-png">Xuất PNG</button><button data-act="export-svg">Xuất SVG</button><button data-act="print">In / lưu PDF…</button></div></details>` +
    `<details><summary>Sửa</summary><div><button data-act="undo">Hoàn tác</button><button data-act="redo">Làm lại</button><button data-act="cut">Cắt</button><button data-act="copy">Sao chép</button><button data-act="paste">Dán</button><button data-act="copy-style">Sao chép định dạng</button><button data-act="paste-style">Dán định dạng</button><button data-act="find-replace">Tìm / thay chữ…</button><button data-act="legend">Tạo bảng chú giải</button><button data-act="del">Xoá</button><button data-act="all">Chọn tất cả</button></div></details>` +
    `<details><summary>Xem</summary><div><button data-act="zin">Phóng to</button><button data-act="zout">Thu nhỏ</button><button data-act="fit">Vừa khung</button><button data-act="dark">Sáng / tối</button><button data-act="fullscreen">Toàn màn hình</button></div></details>` +
    `<details><summary>Sắp xếp</summary><div><button data-act="front">Đưa lên trên cùng</button><button data-act="back">Đưa xuống dưới cùng</button><button data-act="group">Nhóm</button><button data-act="ungroup">Bỏ nhóm</button><button data-act="lock">Khoá / mở khoá</button></div></details>` +
    `<details><summary>Lớp</summary><div><button data-act="layer-create">Tạo lớp</button><button data-act="layer-assign">Chuyển hình chọn vào lớp</button><button data-act="layer-visible">Ẩn / hiện lớp</button><button data-act="layer-lock">Khoá / mở khoá lớp</button></div></details>` +
    `<details><summary>Trợ giúp</summary><div class="dg-help">Kéo từ chấm xanh để nối dây.<br>Nháy đúp dây để thêm điểm uốn.<br>Kéo đầu dây để nối lại.<br>Ctrl+Z / Ctrl+Y: hoàn tác / làm lại.<br>F11: toàn màn hình.</div></details></nav>` +
    `<button data-act="new" title="Sơ đồ mới">📄 Mới</button><button data-act="open" title="Mở file sơ đồ (.json)">📂 Mở</button>` +
    `<select id="dg-tpl" title="Mẫu sơ đồ"><option value="">📐 Mẫu…</option>${[...new Set(D.TEMPLATES.map((t) => t.group))].map((g) => `<optgroup label="${esc(g)}">${D.TEMPLATES.filter((t) => t.group === g).map((t) => `<option value="${t.id}">${esc(t.vi)}</option>`).join('')}</optgroup>`).join('')}</select>` +
    `<select id="dg-exp" title="Xuất sơ đồ"><option value="">⬇ Xuất…</option><option value="png">Ảnh PNG</option><option value="svg">Ảnh SVG</option><option value="json">File sơ đồ (.json)</option><option value="drawio">File draw.io (.drawio)</option></select>` +
    (onToWorkspace ? `<button data-act="workspace" title="Tạo mạng trống trong workspace từ sơ đồ này">🧱 Mở trong workspace</button>` : '') +
    `<span class="dg-sep"></span>` +
    `<button data-act="undo" title="Hoàn tác (Ctrl+Z)">↶</button><button data-act="redo" title="Làm lại (Ctrl+Y)">↷</button>` +
    `<span class="dg-sep"></span>` +
    `<button data-act="copy" title="Sao chép (Ctrl+C)">⧉</button><button data-act="paste" title="Dán (Ctrl+V)">📋</button><button data-act="dup" title="Nhân bản (Ctrl+D)">⎘</button><button data-act="del" title="Xoá (Delete)">🗑</button>` +
    `<span class="dg-sep"></span>` +
    `<button data-act="front" title="Đưa lên trên cùng (Ctrl+Shift+])">⬆</button><button data-act="back" title="Đưa xuống dưới cùng (Ctrl+Shift+[)">⬇</button>` +
    `<select id="dg-align" title="Căn lề / dàn đều / tự sắp xếp"><option value="">⫷ Căn…</option><option value="left">Căn trái</option><option value="center">Căn giữa (dọc)</option><option value="right">Căn phải</option><option value="top">Căn trên</option><option value="middle">Căn giữa (ngang)</option><option value="bottom">Căn dưới</option><option value="dh">Dàn đều ngang</option><option value="dv">Dàn đều dọc</option><option value="auto-layered">Tự sắp xếp · phân lớp</option><option value="auto-tree">Tự sắp xếp · cây</option><option value="auto-grid">Tự sắp xếp · lưới</option></select>` +
    `<button data-act="group" title="Nhóm (Ctrl+G)">▣ Nhóm</button><button data-act="ungroup" title="Bỏ nhóm (Ctrl+Shift+G)">▢</button><button data-act="lock" title="Khoá / mở khoá vị trí">🔒</button>` +
    `<span class="dg-sep"></span>` +
    `<label class="dg-chk"><input type="checkbox" id="dg-grid"> Lưới</label><label class="dg-chk"><input type="checkbox" id="dg-snap"> Bắt dính</label>` +
    `<span class="dg-grow"></span>` +
    `<button data-act="zout" title="Thu nhỏ (Ctrl −)">−</button><span id="dg-zl" class="dg-zl"></span><button data-act="zin" title="Phóng to (Ctrl +)">+</button><button data-act="fit" title="Vừa khung (Ctrl+Shift+H)">⤢</button>` +
    `<button data-act="close" class="dg-close" title="Đóng (sơ đồ tự lưu)">✕</button>` +
    `<input type="file" id="dg-file" accept=".json,application/json" hidden><input type="file" id="dg-drawio-file" accept=".drawio,.xml,application/xml,text/xml" hidden></div>` +
    `<div class="dg-pages" id="dg-pages"></div><div class="dg-body"><aside class="dg-lib"><input id="dg-q" placeholder="🔍 Tìm hình…" autocomplete="off"><details class="dg-packs" id="dg-packs" open><summary>▦ Bộ hình (chọn nhóm muốn xem)</summary><div>${[['net','Mạng'],['physical','Phòng máy'],['security','Bảo mật'],['devops','DevOps'],['cloud','Cloud'],['ops','Vận hành'],['app','Ứng dụng'],['basic','Cơ bản']].map(([k,v])=>`<label><input type="checkbox" data-pack="${k}"> ${v}</label>`).join('')}</div></details><div id="dg-libs"></div></aside>` +
    `<div class="dg-stage" id="dg-stage" tabindex="0"><svg class="dg-svg" id="dg-svg"><defs><filter id="dg-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".18"/></filter><pattern id="dg-gp" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" class="dg-g1"/></pattern><pattern id="dg-gp5" width="50" height="50" patternUnits="userSpaceOnUse"><rect width="50" height="50" fill="url(#dg-gp)"/><path d="M50 0H0V50" class="dg-g2"/></pattern></defs>` +
    `<g id="dg-world"><rect id="dg-gridr" x="-4000" y="-4000" width="12000" height="12000" fill="url(#dg-gp5)"/><g id="dg-draw"></g><g id="dg-over"></g></g></svg>` +
    `<div class="dg-ruler-x" id="dg-ruler-x"></div><div class="dg-ruler-y" id="dg-ruler-y"></div><div class="dg-mini" id="dg-mini"><svg></svg></div><div class="dg-status" id="dg-status"></div></div>` +
    `<aside class="dg-fmt" id="dg-fmt"></aside></div>`;
  document.body.appendChild(root);
  if (load('diagram-dark', false)) root.classList.add('dg-dark');
  const $ = (id) => root.querySelector('#' + id);
  const stage = $('dg-stage'), svg = $('dg-svg'), world = $('dg-world'), draw = $('dg-draw'), over = $('dg-over');
  const alive = () => document.body.contains(root);
  const snapshotTimer = setInterval(() => { if (!alive()) return clearInterval(snapshotTimer); const versions=load('diagram-versions',[]); const json=D.exportJson(dg); if(versions[0]?.json===json)return; versions.unshift({at:new Date().toISOString(),json}); save('diagram-versions',versions.slice(0,10)); },5*60*1000);

  // ---------------------------------------------------------------- lưu / hoàn tác
  const persist = () => { clearTimeout(persist.t); persist.t = setTimeout(() => { const json=D.exportJson(dg); save('diagram',JSON.parse(json)); pages[pageIndex].json=json; save('diagram-pages',pages); }, 200); };
  function renderPages(){ $('dg-pages').innerHTML=pages.map((p,i)=>`<button class="dg-page${i===pageIndex?' active':''}" data-page="${i}">${esc(p.name)}</button>`).join('')+'<button class="dg-page-add" title="Thêm trang">＋</button>'; }
  function switchPage(i){if(i===pageIndex)return;pages[pageIndex].json=D.exportJson(dg);pageIndex=i;save('diagram-pages',pages);save('diagram-page-index',i);dg=D.importJson(pages[i].json);hist=D.createHistory();st.sel=[];renderPages();render();fit();}
  $('dg-pages').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)switchPage(+b.dataset.page);else if(e.target.closest('.dg-page-add')){pages[pageIndex].json=D.exportJson(dg);pages.push({name:`Page-${pages.length+1}`,json:D.exportJson(D.emptyDiagram())});save('diagram-pages',pages);switchPage(pages.length-1);}});
  $('dg-pages').addEventListener('contextmenu',e=>{const b=e.target.closest('[data-page]');if(!b)return;e.preventDefault();const i=+b.dataset.page,p=pages[i],op=prompt(`Trang “${p.name}”: r đổi tên · d nhân bản · x xoá · ← / → sắp xếp`,'r');if(op==='r'){const n=prompt('Tên trang:',p.name);if(n){p.name=n;save('diagram-pages',pages);renderPages();}}else if(op==='d'){pages.splice(i+1,0,{name:p.name+' (bản sao)',json:i===pageIndex?D.exportJson(dg):p.json});save('diagram-pages',pages);switchPage(i+1);}else if((op==='←'||op==='→')&&i+(op==='→'?1:-1)>=0&&i+(op==='→'?1:-1)<pages.length){[pages[i],pages[i+(op==='→'?1:-1)]]=[pages[i+(op==='→'?1:-1)],pages[i]];const target=i+(op==='→'?1:-1);pageIndex=target;dg=D.importJson(pages[target].json);save('diagram-pages',pages);save('diagram-page-index',target);hist=D.createHistory();renderPages();render();fit();}else if(op==='x'&&pages.length>1&&confirm('Xoá trang này?')){pages.splice(i,1);const next=Math.min(pageIndex,pages.length-1);pageIndex=next;dg=D.importJson(pages[next].json);save('diagram-pages',pages);save('diagram-page-index',next);hist=D.createHistory();st.sel=[];renderPages();render();fit();}});
  const mut = (fn) => { const r = hist.track(dg, fn); persist(); return r; };
  const sel = () => st.sel.map((id) => D.shapeOf(dg, id) || D.edgeOf(dg, id)).filter(Boolean);
  const edgeSvg = (e) => D.edgeSvg(dg, e, st.vlan ? { color: D.edgeVlans(dg, e).includes(st.vlan) ? '#eab308' : '#c5ccd6' } : {});
  const selShapes = () => st.sel.map((id) => D.shapeOf(dg, id)).filter(Boolean);
  function setSel(ids, add = false) {
    const base = add ? [...st.sel] : [];
    for (const id of ids) { const i = base.indexOf(id); if (add && i >= 0) base.splice(i, 1); else if (!base.includes(id)) base.push(id); }
    st.sel = D.expandGroups(dg, base);
    render();
  }

  // ---------------------------------------------------------------- khung nhìn
  const applyView = () => { world.setAttribute('transform', `translate(${st.view.x} ${st.view.y}) scale(${st.view.k})`); $('dg-zl').textContent = Math.round(st.view.k * 100) + '%'; updateRulers(); updateMini(); clearTimeout(applyView.t); applyView.t = setTimeout(() => save('diagram-view', st.view), 300); };
  const toWorld = (e) => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left - st.view.x) / st.view.k, y: (e.clientY - r.top - st.view.y) / st.view.k }; };
  const sn = (v) => (st.snap ? Math.round(v / D.GRID) * D.GRID : Math.round(v));
  function zoomAt(f, cx, cy) {
    const v = st.view, k = Math.max(0.2, Math.min(4, v.k * f));
    v.x = cx - ((cx - v.x) * k) / v.k; v.y = cy - ((cy - v.y) * k) / v.k; v.k = k;
    applyView();
  }
  function focusShape(s) { const r=stage.getBoundingClientRect(); st.view.x=r.width/2-(s.x+s.w/2)*st.view.k; st.view.y=r.height/2-(s.y+s.h/2)*st.view.k; applyView(); }
  function fit() {
    const r = stage.getBoundingClientRect(), b = D.bounds(dg, 40);
    const k = Math.max(0.2, Math.min(2, Math.min(r.width / b.w, r.height / b.h)));
    st.view = { k, x: (r.width - b.w * k) / 2 - b.x * k, y: (r.height - b.h * k) / 2 - b.y * k };
    applyView();
  }
  function updateRulers() {
    const r = stage.getBoundingClientRect(), sx = $('dg-ruler-x'), sy = $('dg-ruler-y');
    const hx = [], vy = [];
    for (let px = 0; px < r.width; px += 60) hx.push(`<span style="left:${px}px">${Math.round((px - st.view.x) / st.view.k)}</span>`);
    for (let py = 0; py < r.height; py += 60) vy.push(`<span style="top:${py}px">${Math.round((py - st.view.y) / st.view.k)}</span>`);
    sx.innerHTML = hx.join(''); sy.innerHTML = vy.join('');
  }
  function updateMini() {
    const host = $('dg-mini'), svgMini = host.querySelector('svg'), b = D.bounds(dg, 10), r = stage.getBoundingClientRect();
    const zones = dg.shapes.filter(D.isContainer), rest = dg.shapes.filter((s) => !D.isContainer(s));
    const viewport = { x: -st.view.x / st.view.k, y: -st.view.y / st.view.k, w: r.width / st.view.k, h: r.height / st.view.k };
    svgMini.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
    svgMini.innerHTML = zones.map(D.shapeSvg).join('') + dg.edges.map((e) => D.edgeSvg(dg, e)).join('') + rest.map(D.shapeSvg).join('') + `<rect class="dg-mini-view" x="${viewport.x}" y="${viewport.y}" width="${viewport.w}" height="${viewport.h}"/>`;
  }
  $('dg-mini').onpointerdown = (e) => e.stopPropagation();
  $('dg-mini').onclick = (e) => { const r = $('dg-mini').getBoundingClientRect(), b = D.bounds(dg, 10), x = b.x + (e.clientX - r.left) / r.width * b.w, y = b.y + (e.clientY - r.top) / r.height * b.h, sr = stage.getBoundingClientRect(); st.view.x = sr.width / 2 - x * st.view.k; st.view.y = sr.height / 2 - y * st.view.k; applyView(); };
  const onResize = () => { updateRulers(); updateMini(); };
  window.addEventListener('resize', onResize);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    else { st.view.x -= e.shiftKey ? e.deltaY : e.deltaX; st.view.y -= e.shiftKey ? 0 : e.deltaY; applyView(); }
  }, { passive: false });

  // ---------------------------------------------------------------- vẽ
  function render() {
    if (!alive()) return;
    const visible = dg.shapes.filter((s) => !s.hidden), zones = visible.filter(D.isContainer), rest = visible.filter((s) => !D.isContainer(s));
    draw.innerHTML = zones.map(D.shapeSvg).join('') + dg.edges.map(edgeSvg).join('') + rest.map(D.shapeSvg).join('');
    for (const s of dg.shapes) if (s.locked) draw.querySelector(`[data-id="${s.id}"]`)?.classList.add('locked');
    drawOverlay();
    $('dg-gridr').style.display = st.grid ? '' : 'none';
    root.querySelector('[data-act=undo]').disabled = !hist.canUndo;
    root.querySelector('[data-act=redo]').disabled = !hist.canRedo;
    renderFmt();
    status();
    applyView();
  }
  function drawOverlay() {
    over.innerHTML = '';
    const mk = (tag, a) => { const n = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(a)) n.setAttribute(k, v); over.appendChild(n); return n; };
    for (const it of sel()) {
      if (it.a) { const p = D.edgePath(dg, it); if (p) { mk('path', { d: p.d, class: 'dg-esel' }); mk('circle', { cx: p.a.x, cy: p.a.y, r: 5, class: 'dg-eend', 'data-eend': 'a', 'data-edge': it.id }); mk('circle', { cx: p.b.x, cy: p.b.y, r: 5, class: 'dg-eend', 'data-eend': 'b', 'data-edge': it.id }); (it.waypoints || []).forEach((w, i) => mk('circle', { cx: w.x, cy: w.y, r: 6, class: 'dg-wp', 'data-wp': i })); } continue; }
      mk('rect', { x: it.x - 4, y: it.y - 4, width: it.w + 8, height: it.h + 8, class: 'dg-sel' + (it.locked ? ' locked' : '') });
    }
    if (st.rewire) mk('line', { x1: st.rewire.x0, y1: st.rewire.y0, x2: st.rewire.x1, y2: st.rewire.y1, class: 'dg-wire' });
    const ss = selShapes();
    if (ss.length === 1 && !ss[0].locked && !ss[0].rackMounted) {
      const s = ss[0], pos = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };
      for (const h of HANDLES) mk('rect', { x: s.x + s.w * pos[h][0] - 4, y: s.y + s.h * pos[h][1] - 4, width: 8, height: 8, class: 'dg-h', 'data-h': h });
    }
    if (st.hover && !st.drag) {
      const s = D.shapeOf(dg, st.hover);
      if (s) for (const side of D.portsOf(s)) { const pt = D.portPoint(s, side); mk('circle', { cx: pt.x, cy: pt.y, r: side[1] ? 4 : 5, class: 'dg-port', 'data-port': s.id, 'data-side': side }); }
    }
    if (st.rubber) { const r = st.rubber; mk('rect', { x: Math.min(r.x0, r.x1), y: Math.min(r.y0, r.y1), width: Math.abs(r.x1 - r.x0), height: Math.abs(r.y1 - r.y0), class: 'dg-rubber' }); }
    for (const g of st.guides || []) if (g.axis === 'x') mk('line', { x1: g.value, x2: g.value, y1: -5000, y2: 5000, class: 'dg-guide' }); else mk('line', { x1: -5000, x2: 5000, y1: g.value, y2: g.value, class: 'dg-guide' });
    if (st.wire) mk('line', { x1: st.wire.x0, y1: st.wire.y0, x2: st.wire.x1, y2: st.wire.y1, class: 'dg-wire' + (st.wire.to ? ' ok' : '') });
  }
  function status() {
    const n = dg.shapes.length, m = dg.edges.length, k = st.sel.length;
    $('dg-status').textContent = `${n} hình · ${m} dây${k ? ` · đang chọn ${k}` : ''} — Kéo hình từ thư viện · rê lên hình rồi kéo chấm xanh để nối dây · nháy đúp để sửa chữ · chuột phải: menu · Ctrl+lăn: phóng to`;
  }

  // ---------------------------------------------------------------- thư viện hình
  function renderLib() {
    const q = st.q.toLowerCase();
    const groups = [['net', 'Thiết bị mạng'], ['physical', 'Phòng máy / Thiết bị rack'], ['security', 'Bảo mật'], ['devops', 'DevOps / Container'], ['cloud', 'Cloud / Mạng đám mây'], ['ops', 'Vận hành'], ['app', 'Ứng dụng'], ['basic', 'Hình cơ bản']].filter(([g]) => st.packs.includes(g));
    const match = ([t, S]) => !q || (S.vi + ' ' + S.en + ' ' + t).toLowerCase().includes(q);
    const makeItems = (items) => items.map(([t, S]) => {
      const tmp = D.addShape(D.emptyDiagram(), t, 0, 0, { label: '', sub: '' });
      const vw = Math.max(S.w, S.h) + 8;
      return `<div class="dg-lirow"><button class="dg-li" data-t="${t}" draggable="true" title="${esc(S.vi)} — kéo vào khung vẽ hoặc bấm"><svg viewBox="${-4 - (vw - S.w - 8) / 2} ${-4 - (vw - S.h - 8) / 2} ${vw} ${vw}">${D.shapeSvg({ ...tmp, label: '' })}</svg><span>${esc(S.vi)}</span></button><button class="dg-fav${st.favorites.includes(t) ? ' active' : ''}" data-fav="${t}" title="${st.favorites.includes(t) ? 'Bỏ khỏi' : 'Thêm vào'} Hình hay dùng">${st.favorites.includes(t) ? '★' : '☆'}</button></div>`;
    }).join('');
    const favItems = Object.entries(D.SHAPES).filter(([t]) => st.favorites.includes(t)).filter(match);
    $('dg-libs').innerHTML = (favItems.length ? `<section class="dg-lg"><div class="dg-lh">Hình hay dùng</div><div class="dg-items">${makeItems(favItems)}</div></section>` : '') + groups.map(([g, title]) => {
      const items = Object.entries(D.SHAPES).filter(([t, S]) => S.group === g && match([t, S]));
      if (!items.length) return '';
      return `<details class="dg-lg" open><summary class="dg-lh">${title}</summary><div class="dg-items">${makeItems(items)}</div></details>`;
    }).join('') || '<div class="dg-none">Không có hình nào khớp.</div>';
    $('dg-libs').querySelectorAll('.dg-li').forEach((b) => {
      b.onclick = () => addAt(b.dataset.t, viewCenter());
      b.ondragstart = (e) => { e.dataTransfer.setData('text/x-dg', b.dataset.t); e.dataTransfer.effectAllowed = 'copy'; };
    });
    $('dg-libs').querySelectorAll('[data-fav]').forEach((b) => { b.onclick = () => { const t = b.dataset.fav; st.favorites = st.favorites.includes(t) ? st.favorites.filter((x) => x !== t) : [...st.favorites, t]; save('diagram-favorites', st.favorites); renderLib(); }; });
    root.querySelectorAll('[data-pack]').forEach((box) => { box.checked = st.packs.includes(box.dataset.pack); box.onchange = () => { st.packs = box.checked ? [...new Set([...st.packs, box.dataset.pack])] : st.packs.filter((x) => x !== box.dataset.pack); save('diagram-packs', st.packs); renderLib(); }; });
  }
  const viewCenter = () => { const r = stage.getBoundingClientRect(); return { x: (r.width / 2 - st.view.x) / st.view.k, y: (r.height / 2 - st.view.y) / st.view.k }; };
  function addAt(t, p) {
    const S = D.SHAPES[t];
    const s = mut(() => { const added=D.addShape(dg,t,p.x-S.w/2,p.y-S.h/2); D.assignContainer(dg,added.id); if(added.parent)D.fitRack(dg,added.parent); if(added.t==='rack')D.fitRack(dg,added.id); D.fitContainers(dg); return added; });
    setSel([s.id]);
    if (t === 'text' || t === 'note') editText(s.id);
  }
  stage.ondragover = (e) => { if (e.dataTransfer.types.includes('text/x-dg')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } };
  stage.ondrop = (e) => { const t = e.dataTransfer.getData('text/x-dg'); if (!t) return; e.preventDefault(); addAt(t, toWorld(e)); };
  $('dg-q').oninput = (e) => { st.q = e.target.value; renderLib(); };

  // ---------------------------------------------------------------- chuột
  const hitId = (t) => t.closest?.('.dg-shape, .dg-edge')?.dataset.id || null;
  stage.addEventListener('pointerdown', (e) => {
    closeMenu();
    if (e.target.closest('.dg-edit')) return;
    stage.focus();
    const p = toWorld(e);
    if (e.button === 1 || (e.button === 0 && st.space)) return panStart(e);
    if (e.button !== 0) return;
    const port = e.target.dataset?.port, side = e.target.dataset?.side, handle = e.target.dataset?.h, wp = e.target.dataset?.wp, eend = e.target.dataset?.eend;
    if (port) return wireStart(port, side, p);
    if (wp != null) return waypointStart(+wp, p);
    if (eend) return edgeEndStart(e.target.dataset.edge, eend, p);
    if (handle) return resizeStart(handle, p);
    const id = hitId(e.target);
    if (!id) { if (!e.shiftKey) st.sel = []; return rubberStart(p, e.shiftKey); }
    if (e.shiftKey) { setSel([id], true); return; }
    if (!st.sel.includes(id)) setSel([id]);
    if (D.shapeOf(dg, id)) dragStart(p);
  });
  stage.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.size===2){gestureEpoch++;for(const cancel of [...activeTracks])cancel();const [a,b]=[...touchPoints.values()],r=stage.getBoundingClientRect(),cx=(a.x+b.x)/2-r.left,cy=(a.y+b.y)/2-r.top;pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),cx,cy,k:st.view.k,x:st.view.x,y:st.view.y};pinching=true;st.rubber=null;st.drag=false;st.wire=false;e.preventDefault();e.stopImmediatePropagation();}},true);
  stage.addEventListener('pointermove',e=>{if(!touchPoints.has(e.pointerId))return;touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!pinching||touchPoints.size<2)return;const [a,b]=[...touchPoints.values()],r=stage.getBoundingClientRect(),cx=(a.x+b.x)/2-r.left,cy=(a.y+b.y)/2-r.top,d=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),k=Math.max(.2,Math.min(4,pinch.k*d/pinch.distance));st.view={k,x:cx-(pinch.cx-pinch.x)*k/pinch.k,y:cy-(pinch.cy-pinch.y)*k/pinch.k};applyView();e.preventDefault();e.stopImmediatePropagation();},true);
  stage.addEventListener('pointerup',e=>{touchPoints.delete(e.pointerId);if(pinching){if(touchPoints.size<2){pinching=false;pinch=null;}e.preventDefault();e.stopImmediatePropagation();}},true);
  stage.addEventListener('pointermove', (e) => {
    if (st.drag || st.rubber || st.wire) return;
    const id = hitId(e.target), port = e.target.dataset?.port;
    const h = port || (D.shapeOf(dg, id) ? id : null);
    if (h !== st.hover) { st.hover = h; drawOverlay(); }
  });
  stage.addEventListener('dblclick', (e) => {
    const id = hitId(e.target);
    if (e.target.dataset?.wp != null) { e.preventDefault(); removeWaypoint(id, +e.target.dataset.wp); return; }
    if (D.shapeOf(dg, id)) editText(id);
    else if (D.edgeOf(dg, id)) addWaypoint(id, toWorld(e));
    else addAt('text', toWorld(e));
  });
  function track(onMove, onUp) {
    const epoch=gestureEpoch; const mv = (ev) => {if(epoch===gestureEpoch&&!pinching)onMove(ev);}, cleanup=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);activeTracks.delete(cleanup);}, up = (ev) => { cleanup(); if(epoch===gestureEpoch&&!pinching)onUp(ev); };
    activeTracks.add(cleanup);
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  }
  function panStart(e) {
    const x0 = st.view.x, y0 = st.view.y, sx = e.clientX, sy = e.clientY;
    stage.classList.add('panning');
    track((ev) => { st.view.x = x0 + ev.clientX - sx; st.view.y = y0 + ev.clientY - sy; applyView(); }, () => stage.classList.remove('panning'));
  }
  function rubberStart(p, add) {
    st.rubber = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    const keep = add ? [...st.sel] : [];
    track((ev) => { const q = toWorld(ev); st.rubber.x1 = q.x; st.rubber.y1 = q.y; drawOverlay(); }, () => {
      const r = st.rubber; st.rubber = null;
      const ids = Math.abs(r.x1 - r.x0) + Math.abs(r.y1 - r.y0) > 4 ? D.inRect(dg, r) : [];
      st.sel = D.expandGroups(dg, [...new Set([...keep, ...ids])]);
      render();
    });
  }
  function dragStart(p) {
    const roots = selShapes().filter((s) => !s.locked).map((s) => s.id);
    const ids = D.expandContainers(dg, roots).filter((id) => !D.shapeOf(dg, id)?.locked);
    if (!ids.length) return;
    const before = hist.snapshot(dg), start = Object.fromEntries(ids.map((id) => { const s = D.shapeOf(dg, id); return [id, [s.x, s.y]]; }));
    const lead = D.shapeOf(dg, ids[0]);
    let moved = false, raf = 0;
    st.drag = true;
    track((ev) => {
      const q = toWorld(ev);
      let dx = q.x - p.x, dy = q.y - p.y;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      dx = sn(start[lead.id][0] + dx) - start[lead.id][0]; dy = sn(start[lead.id][1] + dy) - start[lead.id][1];
      const aligned = D.snapToGuides(dg, ids, dx, dy, 8 / st.view.k); dx = aligned.dx; dy = aligned.dy; st.guides = aligned.guides;
      for (const id of ids) { const s = D.shapeOf(dg, id); s.x = start[id][0] + dx; s.y = start[id][1] + dy; const rack=s.rackMounted&&s.parent&&D.shapeOf(dg,s.parent); if(rack?.t==='rack'&&s.x+s.w/2>=rack.x&&s.x+s.w/2<=rack.x+rack.w&&s.y+s.h/2>=rack.y&&s.y+s.h/2<=rack.y+rack.h){const n=Math.max(1,Math.round(s.rackU||1)),top=Math.max(0,Math.min(rack.rackUnits-n,Math.round((s.y-rack.y-12)/18)));s.x=rack.x+30;s.y=rack.y+12+top*18;} }
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderMove(ids); });
    }, () => { st.drag = false; st.guides = []; if (moved) { for (const id of roots) { const s=D.shapeOf(dg,id); D.assignContainer(dg,id); const rack=s?.parent&&D.shapeOf(dg,s.parent); if(s&&s.t!=='rack'&&rack?.t==='rack'){const n=Math.max(1,Math.round(s.rackU||1)),top=Math.round((s.y-rack.y-12)/18);s.rackStartU=Math.max(1,Math.min(rack.rackUnits-n+1,rack.rackUnits-top-n+1));} } for(const rack of dg.shapes.filter(s=>s.t==='rack'))D.fitRack(dg,rack.id); D.fitContainers(dg); hist.commit(dg, before); persist(); } render(); });
  }
  function resizeStart(h, p) {
    const s = selShapes()[0];
    if (!s || s.rackMounted || s.locked) return;
    const o = { x: s.x, y: s.y, w: s.w, h: s.h }, before = hist.snapshot(dg);
    st.drag = true;
    track((ev) => {
      const q = toWorld(ev), dx = q.x - p.x, dy = q.y - p.y;
      let { x, y, w, h: hh } = o;
      if (h.includes('e')) w = sn(o.x + o.w + dx) - o.x;
      if (h.includes('s')) hh = sn(o.y + o.h + dy) - o.y;
      if (h.includes('w')) { x = Math.min(sn(o.x + dx), o.x + o.w - 20); w = o.x + o.w - x; }
      if (h.includes('n')) { y = Math.min(sn(o.y + dy), o.y + o.h - 16); hh = o.y + o.h - y; }
      if (ev.shiftKey && D.isDevice(s)) { const r = o.w / o.h; if (Math.abs(w - o.w) > Math.abs(hh - o.h)) hh = Math.round(w / r); else w = Math.round(hh * r); }
      Object.assign(s, { x, y, w: Math.max(20, w), h: Math.max(16, hh) });
      render();
    }, () => { st.drag = false; hist.commit(dg, before); persist(); render(); });
  }
  function wireStart(fromId, fromSide, p) {
    const s = D.shapeOf(dg, fromId);
    const start = D.portPoint(s, fromSide);
    st.wire = { from: fromId, fromSide, x0: start.x, y0: start.y, x1: p.x, y1: p.y, to: null, toSide: null };
    st.drag = true;
    track((ev) => {
      const q = toWorld(ev);
      const t = document.elementFromPoint(ev.clientX, ev.clientY);
      const id = t && (t.dataset?.port || hitId(t));
      st.wire.to = id && id !== fromId && D.shapeOf(dg, id) ? id : null;
      if (st.wire.to) {
        const target = D.shapeOf(dg, id), explicit = t?.dataset?.side;
        st.wire.toSide = explicit || D.nearestPort(target, q.x, q.y);
      } else st.wire.toSide = null;
      Object.assign(st.wire, { x1: q.x, y1: q.y });
      drawOverlay();
    }, () => {
      const w = st.wire; st.wire = null; st.drag = false;
      if (w.to) { const e = mut(() => D.addEdge(dg, w.from, w.to, { ...st.edgeStyle, portA: w.fromSide, portB: w.toSide, la: D.suggestPortName(dg, w.from), lb: D.suggestPortName(dg, w.to) })); if (e) { st.sel = [e.id]; } }
      render();
    });
  }
  function waypointStart(index) {
    const edge = sel().find((x) => x.a);
    if (!edge || !edge.waypoints?.[index]) return;
    const before = hist.snapshot(dg), point = edge.waypoints[index];
    st.drag = true;
    track((ev) => { const q = toWorld(ev); point.x = sn(q.x); point.y = sn(q.y); render(); }, () => { st.drag = false; hist.commit(dg, before); persist(); render(); });
  }
  function addWaypoint(id, p) {
    const e = D.edgeOf(dg, id); if (!e) return;
    const path = D.edgePath(dg, e);
    const coords = [...String(path?.d || '').matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
    const points = [path.a, ...coords.slice(1), path.b];
    let best = Infinity, index = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], dx = b.x - a.x, dy = b.y - a.y, k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const dist = Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy);
      if (dist < best) { best = dist; index = i; }
    }
    mut(() => { e.waypoints ||= []; e.waypoints.splice(index, 0, { x: sn(p.x), y: sn(p.y) }); });
    st.sel = [id]; render();
  }
  function removeWaypoint(id, index) {
    const e = D.edgeOf(dg, id); if (!e?.waypoints?.[index]) return;
    mut(() => e.waypoints.splice(index, 1)); render();
  }
  function edgeEndStart(id, end, p) {
    const edge = D.edgeOf(dg, id), endpoint = end === 'a' ? 'a' : 'b';
    if (!edge) return;
    st.rewire = { id, end: endpoint, x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    st.drag = true; drawOverlay();
    track((ev) => { const q = toWorld(ev); Object.assign(st.rewire, { x1: q.x, y1: q.y }); drawOverlay(); }, (ev) => {
      const w = st.rewire; st.rewire = null; st.drag = false;
      const target = document.elementFromPoint(ev.clientX, ev.clientY), shapeId = target?.dataset?.port || hitId(target);
      const shape = D.shapeOf(dg, shapeId);
      if (shape && shape.id !== edge[endpoint]) {
        const q = toWorld(ev), port = target.dataset?.side || D.nearestPort(shape, q.x, q.y);
        mut(() => { const labelKey = endpoint === 'a' ? 'la' : 'lb'; edge[labelKey] = ''; edge[endpoint] = shape.id; edge[endpoint === 'a' ? 'portA' : 'portB'] = port; edge[labelKey] = D.suggestPortName(dg, shape.id); });
      }
      render();
    });
  }

  // ---------------------------------------------------------------- sửa chữ tại chỗ
  function editText(id) {
    const s = D.shapeOf(dg, id);
    if (!s) return;
    const r = stage.getBoundingClientRect(), k = st.view.k;
    const dev = D.isDevice(s);
    const box = { x: s.x * k + st.view.x, y: (dev ? s.y + s.h + 2 : s.y) * k + st.view.y, w: Math.max(120, s.w * k), h: dev ? 52 : Math.max(30, s.h * k) };
    const ta = document.createElement('textarea');
    ta.className = 'dg-edit';
    ta.value = s.label;
    Object.assign(ta.style, { left: box.x - (box.w - s.w * k) / 2 + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px', fontSize: Math.max(11, s.fs * k) + 'px' });
    stage.appendChild(ta);
    ta.focus(); ta.select();
    let done = false;
    const finish = (ok) => { if (done) return; done = true; if (ok && ta.value !== s.label) mut(() => D.update(dg, id, { label: ta.value })); ta.remove(); render(); stage.focus(); };
    ta.onblur = () => finish(true);
    ta.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Escape') finish(false); else if (e.key === 'Enter' && (e.ctrlKey || !e.shiftKey) && !(e.shiftKey)) { e.preventDefault(); finish(true); } };
    void r;
  }
  function editEdgeLabel(id) {
    const e = D.edgeOf(dg, id);
    const v = prompt('Nhãn của dây (để trống = không có nhãn):', e.label);
    if (v != null) mut(() => D.update(dg, id, { label: v }));
    render();
  }

  // ---------------------------------------------------------------- bảng định dạng
  function renderFmt() {
    const f = $('dg-fmt'), items = sel();
    if (document.activeElement && f.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return; // đang gõ trong bảng: không vẽ lại
    if (st.inspector) { renderInspector(f); return; }
    if (!items.length) {
      f.innerHTML = `<button class="dg-wide" data-side="inspector">🧭 Network Inspector</button><div class="dg-fh">Sơ đồ</div><p class="dg-fn">Chưa chọn gì. Bấm vào hình hoặc dây để chỉnh màu, nét, chữ…</p>` +
        `<div class="dg-fh">Kiểu dây mới</div>` + edgeStyleFields(st.edgeStyle, 'def') +
        `<div class="dg-fh">Phím tắt</div><ul class="dg-keys"><li><b>Delete</b> xoá · <b>Ctrl+Z / Y</b> hoàn tác / làm lại</li><li><b>Ctrl+C / X / V / D</b> chép / cắt / dán / nhân bản</li><li><b>Ctrl+A</b> chọn hết · <b>Ctrl+G</b> nhóm · <b>Ctrl+Shift+G</b> bỏ nhóm</li><li><b>Mũi tên</b> dời 1px (Shift: 10px) · <b>F2</b> sửa chữ</li><li><b>Space + kéo</b> / chuột giữa: kéo khung nhìn · <b>Ctrl+lăn</b> phóng to</li><li><b>Shift</b> khi kéo tay nắm thiết bị: giữ tỉ lệ</li></ul>`;
      bindEdgeStyle(f, st.edgeStyle, (patch) => { Object.assign(st.edgeStyle, patch); save('diagram-edge', st.edgeStyle); });
      bindInspector(f);
      return;
    }
    const edges = items.filter((x) => x.a), shapes = items.filter((x) => !x.a);
    let html = `<button class="dg-wide" data-side="inspector">🧭 Network Inspector</button>`;
    if (shapes.length) {
      const s = shapes[0], one = shapes.length === 1, dev = D.isDevice(s);
      html += `<div class="dg-fh">${one ? esc(D.SHAPES[s.t].vi) : `${shapes.length} hình`}</div>` +
        (one ? `<label>Chữ<textarea data-k="label" rows="2">${esc(s.label)}</textarea></label>` + (s.t==='rack'?(()=>{const u=D.rackUsage(dg,s.id);return `<div class="dg-rack-meter"><b data-rack-used>${u.used} / ${u.total} U đang dùng</b><span data-rack-free>${u.overflow?`${u.overflow} thiết bị vượt tải, đặt cạnh tủ`:`${u.free} U trống`}</span><progress data-rack-progress value="${u.used}" max="${u.total}"></progress></div><label>Sức chứa rack<input type="number" min="1" max="42" data-k="rackUnits" value="${s.rackUnits||12}"> U <small>U trống được giữ lại; U1 nằm ở đáy tủ.</small></label><div class="dg-row"><button type="button" data-rack-delta="-1">− Bớt 1 U</button><button type="button" data-rack-delta="1">＋ Thêm 1 U</button></div>`})():'') + (s.rackMounted && s.parent && D.shapeOf(dg,s.parent)?.t==='rack' ? `<div class="dg-fh">Vị trí trong rack</div><div class="dg-row"><label>Chiếm<input type="number" min="1" max="8" data-k="rackU" value="${s.rackU||1}"> U</label><label>Bắt đầu tại U<input type="number" min="1" max="${Math.max(1,(D.shapeOf(dg,s.parent)?.rackUnits||12)-(s.rackU||1)+1)}" data-k="rackStartU" value="${s.rackStartU||1}"></label></div><small>Thiết bị mới tự vào chỗ trống; đổi U để chừa hoặc sắp chỗ trống tùy ý.</small>`:'') + (dev ? `<label>Dòng phụ (IP, vai trò…)<input data-k="sub" value="${esc(s.sub)}"></label>${deviceFields(s)}` : '') + (s.t === 'pipeline' ? `<label>Các bước pipeline, phân tách bằng dấu phẩy<input type="text" data-k="steps" value="${esc((s.steps || []).join(', '))}"></label>` : '') : '') +
        `<div class="dg-row"><label>Nền<input type="color" data-k="fill" value="${hex(s.fill)}"></label><label>Viền<input type="color" data-k="stroke" value="${hex(s.stroke)}"></label><label>Chữ<input type="color" data-k="color" value="${hex(s.color)}"></label></div>` +
        `<div class="dg-row"><label>Nét viền<select data-k="dash">${opt(['solid', 'Liền'], ['dash', 'Gạch'], ['dot', 'Chấm'])(s.dash)}</select></label><label>Dày<input type="number" min="0" max="10" data-k="sw" value="${s.sw ?? 2}"></label><label>Bo góc<input type="number" min="0" max="28" data-k="radius" value="${s.radius ?? 6}"></label></div>` +
        `<label class="dg-chk"><input type="checkbox" data-k="shadow"${s.shadow ? ' checked' : ''}> Bóng đổ nhẹ</label>` +
        `<div class="dg-row"><label>Cỡ chữ<input type="number" min="8" max="48" data-k="fs" value="${s.fs}"></label><label class="dg-chk"><input type="checkbox" data-k="bold"${s.bold !== false ? ' checked' : ''}> <b>Đậm</b></label><label class="dg-chk"><input type="checkbox" data-k="italic"${s.italic ? ' checked' : ''}> <i>Nghiêng</i></label></div>` +
        `<label>Độ mờ <input type="range" min="0.2" max="1" step="0.05" data-k="op" value="${s.op ?? 1}"></label>` +
        (one ? `<div class="dg-row">${s.rackMounted ? '<small class="dg-fn">Vị trí và kích thước tự khớp theo U; sửa ở mục “Vị trí trong rack”.</small>' : `<label>X<input type="number" data-k="x" value="${s.x}"></label><label>Y<input type="number" data-k="y" value="${s.y}"></label><label>Rộng<input type="number" data-k="w" value="${s.w}"></label><label>Cao<input type="number" data-k="h" value="${s.h}"></label>`}</div>` : '') +
        `<label class="dg-chk"><input type="checkbox" data-k="locked"${s.locked ? ' checked' : ''}> 🔒 Khoá vị trí</label>`;
    }
    if (edges.length) {
      const e = edges[0];
      html += `<div class="dg-fh">${edges.length === 1 ? 'Dây nối' : `${edges.length} dây`}</div>` + edgeStyleFields(e, 'edge') +
        (edges.length === 1 ? `<label>Nhãn giữa<input data-e="label" value="${esc(e.label)}" placeholder="vd: uplink, EtherChannel"></label><div class="dg-row"><label>Nhãn đầu A (${esc(D.shapeOf(dg, e.a)?.label)})<input data-e="la" value="${esc(e.la)}" placeholder="vd: Gi0/0"></label><label>Nhãn đầu B (${esc(D.shapeOf(dg, e.b)?.label)})<input data-e="lb" value="${esc(e.lb)}" placeholder="vd: Fa0/1"></label></div><div class="dg-row"><label>Tốc độ<input data-e="speed" value="${esc(e.speed || '')}" placeholder="1 Gbps"></label><label>Chế độ<select data-e="mode">${opt(['','—'],['access','Access'],['trunk','Trunk'])(e.mode || '')}</select></label></div><label>VLAN được phép<input data-e="vlans" value="${esc(e.vlans || '')}" placeholder="1, 10, 20-30"></label>` : '') +
        `<button data-act="setdef" class="dg-wide">Dùng kiểu này cho dây mới</button>`;
    }
    f.innerHTML = html;
    bindInspector(f);
    f.querySelectorAll('[data-rack-delta]').forEach((b)=>{b.onclick=()=>{const rack=shapes[0];if(!rack||rack.t!=='rack')return;mut(()=>{D.update(dg,rack.id,{rackUnits:Math.max(1,Math.min(42,(+rack.rackUnits||12)+(+b.dataset.rackDelta)))});D.fitRack(dg,rack.id);});render();};});
    const shapeIds = shapes.map((s) => s.id), edgeIds = edges.map((e) => e.id);
    f.querySelectorAll('[data-k]').forEach((inp) => {
      const k = inp.dataset.k;
      const val = () => k === 'steps' ? inp.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12) : inp.type === 'checkbox' ? inp.checked : inp.type === 'number' || inp.type === 'range' ? +inp.value : inp.value;
      const apply = () => { mut(() => { for (const id of shapeIds) { const s=D.shapeOf(dg,id); D.update(dg, id, { [k]: val() }); if(k==='rackUnits'&&s?.t==='rack')D.fitRack(dg,id); else if((k==='rackU'||k==='rackStartU')&&s?.parent&&D.shapeOf(dg,s.parent)?.t==='rack')D.fitRack(dg,s.parent); } }); renderCanvasOnly(); const rack=shapeIds.map(id=>D.shapeOf(dg,id)).map(s=>s?.t==='rack'?s:s?.parent?D.shapeOf(dg,s.parent):null).find(s=>s?.t==='rack'),meter=f.querySelector('.dg-rack-meter'); if(rack&&meter){const u=D.rackUsage(dg,rack.id);meter.querySelector('[data-rack-used]').textContent=`${u.used} / ${u.total} U đang dùng`;meter.querySelector('[data-rack-free]').textContent=u.overflow?`${u.overflow} thiết bị vượt tải, đặt cạnh tủ`:`${u.free} U trống`;const p=f.querySelector('[data-rack-progress]');p.value=u.used;p.max=u.total;} };
      if (inp.type === 'text' || inp.tagName === 'TEXTAREA' || inp.type === 'number') { inp.oninput = apply; inp.onkeydown = (e) => e.stopPropagation(); } else inp.onchange = apply;
      if (inp.type === 'range' || inp.type === 'color') inp.oninput = apply;
    });
    f.querySelectorAll('[data-e]').forEach((inp) => { inp.onkeydown = (e) => e.stopPropagation(); const apply = () => { mut(() => { for (const id of edgeIds) D.update(dg, id, { [inp.dataset.e]: inp.value }); }); renderCanvasOnly(); }; inp.oninput = apply; inp.onchange = apply; });
    f.querySelectorAll('[data-meta]').forEach((inp) => { const s = shapes[0]; inp.onkeydown = (e) => e.stopPropagation(); inp.oninput = () => { const value=inp.type==='number'?(inp.value===''?'':+inp.value):inp.value; mut(() => D.update(dg, s.id, { meta: { ...(s.meta || {}), [inp.dataset.meta]: value } })); renderCanvasOnly(); }; });
    f.querySelectorAll('[data-port-key]').forEach((inp) => { const s = shapes[0], i = +inp.dataset.portIndex, key = inp.dataset.portKey; inp.onkeydown = (e) => e.stopPropagation(); const apply = () => { const ports = JSON.parse(JSON.stringify(s.ports || [])); ports[i] = { ...(ports[i] || {}), [key]: inp.value }; mut(() => D.update(dg, s.id, { ports })); renderCanvasOnly(); }; inp.oninput = apply; inp.onchange = apply; });
    f.querySelectorAll('[data-port-add]').forEach((b) => { b.onclick = () => { const s = D.shapeOf(dg, b.dataset.portAdd); mut(() => { s.ports ||= []; s.ports.push({ name: D.suggestPortName(dg, s.id), ip: '', vlan: '', mode: 'access', description: '' }); }); render(); }; });
    f.querySelectorAll('[data-port-remove]').forEach((b) => { b.onclick = () => { const s = D.shapeOf(dg, b.dataset.portRemove); mut(() => s.ports.splice(+b.dataset.portIndex, 1)); render(); }; });
    if (edges.length) bindEdgeStyle(f, edges[0], (patch) => { mut(() => { for (const id of edgeIds) D.update(dg, id, patch); }); renderCanvasOnly(); });
    if (shapes.length) addFormatTabs(f, shapeIds);
    const sd = f.querySelector('[data-act=setdef]');
    if (sd) sd.onclick = () => { const e = edges[0]; st.edgeStyle = { style: e.style, dash: e.dash, cable: e.cable, arrowB: e.arrowB, arrowA: e.arrowA, arrowAType: D.edgeArrowType(e,'A'), arrowBType: D.edgeArrowType(e,'B'), color: e.color, width: e.width }; save('diagram-edge', st.edgeStyle); status(); };
  }
  function bindInspector(f) { f.querySelector('[data-side=inspector]')?.addEventListener('click', () => { st.inspector = true; renderFmt(); }); }
  function focusItem(id) {
    const s = D.shapeOf(dg, id), e = D.edgeOf(dg, id);
    if (!s && !e) return;
    st.sel = [id];
    const p = s ? { x: s.x + s.w / 2, y: s.y + s.h / 2 } : D.edgePath(dg, e).mid, r = stage.getBoundingClientRect();
    st.view.x = r.width / 2 - p.x * st.view.k; st.view.y = r.height / 2 - p.y * st.view.k; render();
  }
  function renderInspector(f) {
    const devices = dg.shapes.filter(D.isDevice), vlans = [...new Set(dg.edges.flatMap((e) => D.edgeVlans(dg, e)))].sort((a, b) => +a - +b), warnings = D.validateNetwork(dg);
    const rows = devices.map((s) => {
      const links = dg.edges.filter((e) => e.a === s.id || e.b === s.id), used = new Set(links.map((e) => e.a === s.id ? e.la : e.lb).filter(Boolean));
      const capacity = s.ports?.length || (s.t === 'switch' || s.t === 'l3switch' ? 24 : s.t === 'router' ? 2 : 1);
      return `<button class="dg-ins-row" data-focus="${s.id}"><b>${esc(s.label)}</b><span>${links.length} dùng · ${Math.max(0, capacity - links.length)} trống (${capacity} cổng)</span><small>${esc(s.meta?.mgmtIp || s.sub || 'Chưa có IP')}</small></button>`;
    }).join('');
    const edgeRows = dg.edges.map((e) => `<button class="dg-ins-row" data-focus="${e.id}"><b>${esc(D.shapeOf(dg,e.a)?.label)} ↔ ${esc(D.shapeOf(dg,e.b)?.label)}</b><span>${esc([e.la,e.lb].filter(Boolean).join(' / ') || 'Chưa đặt tên cổng')}</span><small>${esc([e.cable,e.speed,e.mode,e.vlans && `VLAN ${e.vlans}`].filter(Boolean).join(' · '))}</small></button>`).join('');
    f.innerHTML = `<button class="dg-wide" data-side="back">← Định dạng</button><div class="dg-fh">Network Inspector</div><label>Làm nổi VLAN<select id="dg-vlan"><option value="">Tất cả VLAN</option>${vlans.map((v) => `<option value="${esc(v)}"${st.vlan === v ? ' selected' : ''}>VLAN ${esc(v)}</option>`).join('')}</select></label><div class="dg-fh">Thiết bị (${devices.length})</div>${rows || '<p class="dg-fn">Chưa có thiết bị.</p>'}<div class="dg-fh">Liên kết (${dg.edges.length})</div>${edgeRows || '<p class="dg-fn">Chưa có dây.</p>'}<div class="dg-fh">Cảnh báo khai báo (${warnings.length})</div>${warnings.length ? warnings.map((w) => `<button class="dg-warning" data-focus="${w.ids[0]}">⚠ ${esc(w.message)}</button>`).join('') : '<p class="dg-fn">Không phát hiện vấn đề.</p>'}`;
    f.querySelector('[data-side=back]').onclick = () => { st.inspector = false; renderFmt(); };
    f.querySelector('#dg-vlan').onchange = (e) => { st.vlan = e.target.value; render(); };
    f.querySelectorAll('[data-focus]').forEach((b) => { b.onclick = () => focusItem(b.dataset.focus); });
  }
  function addFormatTabs(f, shapeIds) {
    const children = [...f.children], tabNames = [['style', 'Kiểu'], ['text', 'Chữ'], ['arrange', 'Sắp xếp']];
    const panels = Object.fromEntries(tabNames.map(([id]) => { const p = document.createElement('div'); p.className = 'dg-fpanel'; p.dataset.panel = id; return [id, p]; }));
    let active = 'style';
    for (const el of children) {
      const keys = [...el.querySelectorAll('[data-k],[data-es],[data-e]')].map((x) => x.dataset.k || x.dataset.es || x.dataset.e);
      let tab = keys.some((k) => ['x', 'y', 'w', 'h', 'locked'].includes(k)) ? 'arrange' : keys.some((k) => ['label', 'sub', 'fs', 'bold', 'italic', 'steps'].includes(k)) ? 'text' : 'style';
      el.dataset.formatTab = tab; panels[tab].appendChild(el);
    }
    const nav = document.createElement('div'); nav.className = 'dg-ftabs';
    for (const [id, label] of tabNames) { const b = document.createElement('button'); b.textContent = label; b.dataset.tab = id; b.classList.toggle('active', id === active); b.onclick = () => { active = id; for (const p of Object.values(panels)) p.hidden = p.dataset.panel !== id; nav.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x.dataset.tab === id)); }; nav.appendChild(b); }
    for (const [id, panel] of Object.entries(panels)) panel.hidden = id !== active;
    const palette = document.createElement('div'); palette.className = 'dg-palette'; palette.innerHTML = '<div class="dg-fh">Màu nhanh</div>' + ['#ffffff','#e8f1fb','#e9f7ef','#fdecea','#fff6e8','#eef5ff','#dbeafe','#bbf7d0','#fef3c7','#fecaca','#e9d5ff','#cbd5e1'].map((c) => `<button title="${c}" data-color="${c}" style="background:${c}"></button>`).join('');
    palette.querySelectorAll('[data-color]').forEach((b) => { b.onclick = () => { mut(() => shapeIds.forEach((id) => D.update(dg, id, { fill: b.dataset.color }))); renderCanvasOnly(); }; });
    panels.style.prepend(palette);
    f.replaceChildren(nav, ...Object.values(panels));
  }
  function deviceFields(s) {
    const meta = s.meta || {}, used = new Set(dg.edges.filter((e) => e.a === s.id || e.b === s.id).map((e) => e.a === s.id ? e.la : e.lb));
    const ports = (s.ports || []).map((p, i) => `<div class="dg-port-row"><input data-port-index="${i}" data-port-key="name" value="${esc(p.name || '')}" placeholder="Cổng"><input data-port-index="${i}" data-port-key="ip" value="${esc(p.ip || '')}" placeholder="IP/mask"><input data-port-index="${i}" data-port-key="vlan" value="${esc(p.vlan || '')}" placeholder="VLAN"><select data-port-index="${i}" data-port-key="mode">${opt(['access','Access'],['trunk','Trunk'])(p.mode || 'access')}</select><input data-port-index="${i}" data-port-key="speed" value="${esc(p.speed || '')}" placeholder="Tốc độ"><input data-port-index="${i}" data-port-key="description" value="${esc(p.description || '')}" placeholder="Mô tả"><span>${used.has(p.name) ? 'Đang dùng' : 'Còn trống'}</span><button data-port-remove="${s.id}" data-port-index="${i}" title="Xoá cổng">×</button></div>`).join('');
    return `<details class="dg-device-info"><summary>Thuộc tính thiết bị</summary><label>Hostname<input data-meta="hostname" value="${esc(meta.hostname || '')}"></label><label>Model<input data-meta="model" value="${esc(meta.model || '')}"></label><label>IP quản lý<input data-meta="mgmtIp" value="${esc(meta.mgmtIp || '')}" placeholder="192.168.1.1/24"></label><label>Gateway<input data-meta="gateway" value="${esc(meta.gateway || '')}" placeholder="192.168.1.254"></label><label>Công suất tiêu thụ (W)<input type="number" min="0" data-meta="powerW" value="${esc(meta.powerW ?? '')}"></label>${s.t==='rack' ? `<label>Công suất tối đa rack (W)<input type="number" min="0" data-meta="maxPowerW" value="${esc(meta.maxPowerW ?? '')}"></label>` : ''}${s.t==='ups' ? `<label>Công suất UPS cấp được (W)<input type="number" min="0" data-meta="powerCapacityW" value="${esc(meta.powerCapacityW ?? '')}"></label>` : ''}<label class="dg-chk"><input type="checkbox" data-k="showMeta"${s.showMeta ? ' checked' : ''}> Hiện hostname / IP dưới hình</label><div class="dg-fh">Cổng thiết bị (tên · IP · VLAN · chế độ · tốc độ · mô tả)</div>${ports}<button class="dg-wide" data-port-add="${s.id}">＋ Thêm cổng</button></details>`;
  }
  const opt = (...os) => (v) => os.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${t}</option>`).join('');
  function edgeStyleFields(e, ns) {
    return `<div class="dg-row" data-ns="${ns}"><label>Kiểu<select data-es="style">${opt(['straight', 'Thẳng'], ['ortho', 'Gấp khúc'], ['curve', 'Cong'])(e.style)}</select></label><label>Nét<select data-es="dash">${opt(['solid', 'Liền'], ['dash', 'Gạch'], ['dot', 'Chấm'])(e.dash)}</select></label></div>` +
      `<label>Loại cáp<select data-es="cable">${opt(['ethernet', 'Ethernet'], ['fiber', 'Cáp quang'], ['serial', 'Serial'], ['wifi', 'Wi-Fi'], ['vpn', 'VPN / tunnel'], ['console', 'Console'])(e.cable || 'ethernet')}</select></label>` +
      `<div class="dg-row"><label>Màu<input type="color" data-es="color" value="${hex(e.color || '#4a6785')}"></label><label>Dày<input type="number" min="1" max="10" data-es="width" value="${e.width || 2}"></label></div>` +
      `<div class="dg-row"><label>Đầu A<select data-es="arrowAType">${opt(...D.EDGE_ARROW_TYPES)(D.edgeArrowType(e,'A'))}</select></label><label>Đầu B<select data-es="arrowBType">${opt(...D.EDGE_ARROW_TYPES)(D.edgeArrowType(e,'B'))}</select></label></div>`;
  }
  function bindEdgeStyle(f, e, cb) {
    f.querySelectorAll('[data-es]').forEach((inp) => {
      const k = inp.dataset.es;
      const h = () => { const v = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? +inp.value : inp.value; const arrowEnd=k==='arrowAType'?'A':k==='arrowBType'?'B':null; cb(arrowEnd?{[k]:v,[`arrow${arrowEnd}`]:v!=='none'}:k === 'cable' && v === 'fiber' ? { cable: v, color: '#e67e22' } : { [k]: v }); };
      inp.onchange = h;
      if (inp.type === 'color' || inp.type === 'number') inp.oninput = h;
      inp.onkeydown = (ev) => ev.stopPropagation();
    });
  }
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#ffffff');
  function renderCanvasOnly() { const f = $('dg-fmt'); const keep = f.contains(document.activeElement); if (keep) { const zones = dg.shapes.filter(D.isContainer), rest = dg.shapes.filter((s) => !D.isContainer(s)); draw.innerHTML = zones.map(D.shapeSvg).join('') + dg.edges.map(edgeSvg).join('') + rest.map(D.shapeSvg).join(''); drawOverlay(); status(); } else render(); }
  function renderMove(ids){if(dg.shapes.length<=500||dg.edges.some(e=>e.style==='ortho'))return render();const changed=new Set([...ids,...dg.edges.filter(e=>ids.includes(e.a)||ids.includes(e.b)).map(e=>e.id)]);for(const id of changed){const n=draw.querySelector(`[data-id="${id}"]`);if(!n)continue;const s=D.shapeOf(dg,id),e=D.edgeOf(dg,id);n.outerHTML=s?D.shapeSvg(s):edgeSvg(e);}drawOverlay();status();}

  // ---------------------------------------------------------------- lệnh
  const ACT = {
    new: () => { if (dg.shapes.length && !confirm('Tạo sơ đồ mới? Sơ đồ hiện tại sẽ bị thay (có thể ↶ Hoàn tác).')) return; mut(() => Object.assign(dg, D.emptyDiagram())); st.sel = []; render(); },
    open: () => $('dg-file').click(),
    'open-drawio': () => $('dg-drawio-file').click(),
    undo: () => { if (hist.undo(dg)) { persist(); st.sel = st.sel.filter((id) => D.shapeOf(dg, id) || D.edgeOf(dg, id)); render(); } },
    redo: () => { if (hist.redo(dg)) { persist(); render(); } },
    copy: () => { if (selShapes().length) clipboard = D.copyOf(dg, st.sel); },
    cut: () => { if (!selShapes().length) return; clipboard = D.copyOf(dg, st.sel); ACT.del(); },
    paste: () => { if (!clipboard) return; const ids = mut(() => D.paste(dg, clipboard, 20, 20)); clipboard = D.copyOf(dg, ids); st.sel = ids; render(); },
    dup: () => { if (!selShapes().length) return; const ids = mut(() => D.duplicate(dg, selShapes().map((s) => s.id))); st.sel = ids; render(); },
    del: () => { if (!st.sel.length) return; mut(() => D.remove(dg, st.sel)); st.sel = st.sel.filter((id) => D.shapeOf(dg, id)); render(); },
    front: () => { mut(() => D.zOrder(dg, st.sel, true)); render(); },
    back: () => { mut(() => D.zOrder(dg, st.sel, false)); render(); },
    group: () => { if (selShapes().length < 2) return; mut(() => D.group(dg, st.sel)); render(); },
    ungroup: () => { mut(() => D.ungroup(dg, st.sel)); render(); },
    lock: () => { const ss = selShapes(); if (!ss.length) return; const v = !ss.every((s) => s.locked); mut(() => { for (const s of ss) D.update(dg, s.id, { locked: v }); }); render(); },
    all: () => { st.sel = dg.shapes.map((s) => s.id); render(); },
    'copy-style': () => { const s = selShapes()[0]; if (s) styleClipboard = Object.fromEntries(['fill','stroke','sw','dash','radius','fs','color','bold','italic','shadow','op'].filter((k) => s[k] !== undefined).map((k) => [k,s[k]])); },
    'paste-style': () => { if (!styleClipboard || !selShapes().length) return; mut(() => selShapes().forEach((s) => D.update(dg,s.id,styleClipboard))); render(); },
    'layer-create': () => { const name=prompt('Tên lớp mới:','Lớp mới'); if(!name)return; const current=[...new Set(dg.shapes.map(s=>s.layer||'Mặc định'))]; if(current.includes(name))return alert('Tên lớp đã tồn tại.'); const ids=selShapes().map(s=>s.id); if(ids.length)mut(()=>ids.forEach(id=>D.update(dg,id,{layer:name}))); else save('diagram-layers', [...new Set([...load('diagram-layers',[]),name])]); render(); },
    'layer-assign': () => { const ss=selShapes(); if(!ss.length)return; const layers=[...new Set([...load('diagram-layers',[]),...dg.shapes.map(s=>s.layer||'Mặc định')])]; const name=prompt('Chuyển hình chọn vào lớp:\n'+layers.join(', '),layers[0]); if(!name)return; save('diagram-layers',[...new Set([...layers,name])]); mut(()=>ss.forEach(s=>D.update(dg,s.id,{layer:name}))); render(); },
    'layer-visible': () => { const layers=[...new Set(dg.shapes.map(s=>s.layer||'Mặc định'))]; const name=prompt('Ẩn / hiện lớp nào?\n'+layers.join(', '),layers[0]); if(!name)return; const hide=dg.shapes.filter(s=>(s.layer||'Mặc định')===name).some(s=>!s.hidden); mut(()=>dg.shapes.filter(s=>(s.layer||'Mặc định')===name).forEach(s=>D.update(dg,s.id,{hidden:hide}))); render(); },
    'layer-lock': () => { const layers=[...new Set(dg.shapes.map(s=>s.layer||'Mặc định'))]; const name=prompt('Khoá / mở khoá lớp nào?\n'+layers.join(', '),layers[0]); if(!name)return; const ss=dg.shapes.filter(s=>(s.layer||'Mặc định')===name), lock=!ss.every(s=>s.locked); mut(()=>ss.forEach(s=>D.update(dg,s.id,{locked:lock}))); render(); },
    versions: () => { const versions=load('diagram-versions',[]); if(!versions.length){alert('Chưa có bản sao tự động. Sơ đồ được chụp mỗi 5 phút khi đang mở.');return;} const menu=versions.map((v,i)=>`${i+1}. ${new Date(v.at).toLocaleString('vi-VN')}`).join('\n'); const choice=prompt('Chọn số phiên bản cần khôi phục:\n'+menu,'1'); if(choice==null)return; const v=versions[+choice-1]; if(!v)return alert('Số phiên bản không hợp lệ.'); if(!confirm('Khôi phục bản này? Trạng thái hiện tại sẽ được lưu vào lịch sử trước.'))return; const current=D.exportJson(dg); versions.unshift({at:new Date().toISOString(),json:current}); save('diagram-versions',versions.slice(0,10)); mut(()=>Object.assign(dg,D.importJson(v.json))); st.sel=[]; render(); fit(); },
    'find-replace': () => { const q = prompt('Tìm chữ trong tên hình:'); if (q == null || !q) return; const matches = dg.shapes.filter((s) => `${s.label}\n${s.sub}`.toLocaleLowerCase().includes(q.toLocaleLowerCase())); if (!matches.length) { alert('Không tìm thấy.'); return; } st.sel = [matches[0].id]; focusShape(matches[0]); render(); const replacement = prompt(`Tìm thấy ${matches.length} hình. Thay “${q}” bằng:`, q); if (replacement == null) return; mut(() => matches.forEach((s) => D.update(dg,s.id,{ label: s.label.split(q).join(replacement), sub: s.sub.split(q).join(replacement) }))); render(); },
    legend: () => { const types = [...new Set(dg.shapes.map((s) => s.t))], cables = [...new Set(dg.edges.map((e) => e.cable || 'ethernet'))]; const lines = ['CHÚ GIẢI', ...types.map((t) => `■ ${D.SHAPES[t]?.vi || t}`), ...cables.map((c) => `━ Cáp ${c}`)]; const b = D.bounds(dg,30); const id = mut(() => { const s=D.addShape(dg,'note',b.x,b.y+b.h+20,{label:lines.join('\n'),w:200,h:Math.max(100,lines.length*22)}); return s.id; }); st.sel=[id]; render(); },
    print: () => { const project=prompt('Tên dự án / sơ đồ:','Sơ đồ mạng'); if(project==null)return; const author=prompt('Người vẽ:',''); if(author==null)return; const paper=prompt('Khổ giấy: nhập A4 hoặc A3','A4'); if(paper==null)return; const size=paper.trim().toUpperCase()==='A3'?'A3':'A4',orientation=confirm('OK: in ngang · Cancel: in dọc')?'landscape':'portrait'; let title=$('dg-print-title'); if(!title){title=document.createElement('div');title.id='dg-print-title';title.className='dg-print-title';stage.prepend(title);} title.textContent=`${project} · ${author||'—'} · ${new Date().toLocaleDateString('vi-VN')} · v1`; const page=document.createElement('style'); page.textContent=`@media print{@page{size:${size} ${orientation}}}`; document.head.appendChild(page); document.body.classList.add('dg-printing'); window.addEventListener('afterprint',()=>{document.body.classList.remove('dg-printing'); title.remove(); page.remove();},{once:true}); window.print(); },
    zin: () => { const r = stage.getBoundingClientRect(); zoomAt(1.2, r.width / 2, r.height / 2); },
    zout: () => { const r = stage.getBoundingClientRect(); zoomAt(1 / 1.2, r.width / 2, r.height / 2); },
    z100: () => { st.view.k = 1; applyView(); },
    fit,
    dark: () => { root.classList.toggle('dg-dark'); save('diagram-dark', root.classList.contains('dg-dark')); },
    fullscreen: () => root.classList.toggle('dg-fullscreen'),
    'export-png': () => exportAs('png'), 'export-svg': () => exportAs('svg'),
    save: () => save('diagram', JSON.parse(D.exportJson(dg))),
    workspace: () => { if (!onToWorkspace) return; try { if (onToWorkspace(D.exportJson(dg)) === false) return; } catch (err) { alert(`Không chuyển được sang workspace: ${err.message}`); return; } disposeActiveDiagram?.(); root.remove(); },
    close: () => { save('diagram', JSON.parse(D.exportJson(dg))); disposeActiveDiagram?.(); root.remove(); },
  };
  root.querySelector('.dg-top').addEventListener('click', (e) => { const a = e.target.closest('[data-act]')?.dataset.act; if (a && ACT[a]) { ACT[a](); if (e.target.closest('.dg-menubar')) root.querySelectorAll('.dg-menubar details').forEach((m) => { m.open = false; }); } });
  $('dg-tpl').onchange = (e) => { const t = D.TEMPLATES.find((x) => x.id === e.target.value); e.target.value = ''; if (!t || (dg.shapes.length && !confirm(`Thay sơ đồ hiện tại bằng mẫu "${t.vi}"? (Có thể ↶ Hoàn tác)`))) return; mut(() => Object.assign(dg, t.build())); st.sel = []; render(); fit(); };
  $('dg-align').onchange = (e) => {
    const v = e.target.value; e.target.value = '';
    const ids = selShapes().map((s) => s.id);
    if (!v || (!v.startsWith('auto-') && ids.length < 2)) return;
    mut(() => v.startsWith('auto-') ? D.autoLayout(dg, ids.length ? ids : dg.shapes.map((s) => s.id), v.slice(5)) : v === 'dh' ? D.distribute(dg, ids, 'h') : v === 'dv' ? D.distribute(dg, ids, 'v') : D.align(dg, ids, v));
    render();
  };
  $('dg-exp').onchange = async (e) => { const v = e.target.value; e.target.value = ''; if (v) await exportAs(v); };
  // File 1 trang: thay trang đang mở, hoàn tác được. File nhiều trang: thay cả bộ trang nên phải hỏi trước.
  function openPages(list) {
    if (list.length === 1) { mut(() => Object.assign(dg, list[0].d)); st.sel = []; render(); fit(); return; }
    if ((pages.length > 1 || dg.shapes.length) && !confirm(`File có ${list.length} trang. Toàn bộ ${pages.length} trang hiện tại sẽ bị thay và KHÔNG hoàn tác được.\nMuốn giữ thì bấm Huỷ rồi ⬇ Xuất file trước.`)) return;
    pages = list.map((p) => ({ name: p.name, json: D.exportJson(p.d) })); pageIndex = 0; dg = D.importJson(pages[0].json); hist = D.createHistory(); st.sel = [];
    save('diagram-page-index', 0); persist(); renderPages(); render(); fit();
  }
  $('dg-file').onchange = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { const raw=JSON.parse(await f.text()); openPages(raw?.format==='packet-journey-multipage'&&Array.isArray(raw.pages)&&raw.pages.length?raw.pages.map((p,i)=>({name:String(p.name||`Page-${i+1}`),d:D.importJson(p.json)})):[{d:D.importJson(raw)}]); }
    catch (err) { alert('Không mở được file: ' + err.message); }
  };
  $('dg-drawio-file').onchange = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { openPages(await D.importDrawioPages(await f.text())); }
    catch (err) { alert('Không mở được file draw.io: ' + err.message); }
  };
  $('dg-grid').checked = st.grid; $('dg-snap').checked = st.snap;
  $('dg-grid').onchange = (e) => { st.grid = e.target.checked; save('diagram-grid', st.grid); render(); };
  $('dg-snap').onchange = (e) => { st.snap = e.target.checked; save('diagram-snap', st.snap); };

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function exportAs(kind) {
    if (kind === 'json') { pages[pageIndex].json=D.exportJson(dg); const bundle={format:'packet-journey-multipage',version:1,pages}; return download(new Blob([JSON.stringify(bundle,null,1)], { type: 'application/json' }), 'so-do-mang.json'); }
    if (kind === 'drawio') { pages[pageIndex].json=D.exportJson(dg); return download(new Blob([D.exportDrawioPages(pages.map((p)=>({name:p.name,d:D.importJson(p.json)})))], { type: 'application/xml;charset=utf-8' }), 'so-do-mang.drawio'); }
    const text = D.toSvg(dg);
    if (kind === 'svg') return download(new Blob([text], { type: 'image/svg+xml' }), 'so-do-mang.svg');
    const b = D.bounds(dg), scale = 2;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.ceil(b.w * scale); c.height = Math.ceil(b.h * scale);
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, b.w, b.h);
    c.toBlob((blob) => download(blob, 'so-do-mang.png'), 'image/png');
  }

  // ---------------------------------------------------------------- menu chuột phải
  function closeMenu() { root.querySelector('.dg-menu')?.remove(); }
  stage.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const id = hitId(e.target);
    if (id && !st.sel.includes(id)) setSel([id]);
    const shp = id && D.shapeOf(dg, id), edg = id && D.edgeOf(dg, id);
    const at = toWorld(e);
    const items = shp ? [
      ['✏ Sửa chữ (F2)', () => editText(id)], ['⧉ Sao chép', ACT.copy], ['✂ Cắt', ACT.cut], ['⎘ Nhân bản', ACT.dup], '-',
      ['⬆ Lên trên cùng', ACT.front], ['⬇ Xuống dưới cùng', ACT.back], '-',
      ...(selShapes().length > 1 ? [['▣ Nhóm', ACT.group]] : []), ...(shp.g ? [['▢ Bỏ nhóm', ACT.ungroup]] : []), [shp.locked ? '🔓 Mở khoá' : '🔒 Khoá', ACT.lock], '-', ['🗑 Xoá', ACT.del, 'danger'],
    ] : edg ? [
      ['✏ Sửa nhãn', () => editEdgeLabel(id)], ['Kiểu: thẳng', () => setEdge({ style: 'straight' })], ['Kiểu: gấp khúc', () => setEdge({ style: 'ortho' })], ['Kiểu: cong', () => setEdge({ style: 'curve' })],
      ['Nét: liền / gạch / chấm', () => setEdge({ dash: { solid: 'dash', dash: 'dot', dot: 'solid' }[edg.dash] })], ['⇄ Đảo chiều', () => setEdge({ a: edg.b, b: edg.a, la: edg.lb, lb: edg.la, portA: edg.portB, portB: edg.portA, arrowA: edg.arrowB, arrowB: edg.arrowA, arrowAType: D.edgeArrowType(edg,'B'), arrowBType: D.edgeArrowType(edg,'A') }, true)], '-', ['🗑 Xoá dây', ACT.del, 'danger'],
    ] : [
      ...(clipboard ? [['📋 Dán vào đây', () => { const c0 = clipboard.shapes; const mx = Math.min(...c0.map((s) => s.x)), my = Math.min(...c0.map((s) => s.y)); const ids = mut(() => D.paste(dg, clipboard, Math.round(at.x - mx), Math.round(at.y - my))); st.sel = ids; render(); }]] : []),
      ['＋ Thêm chữ', () => addAt('text', at)], ['＋ Thêm vùng / khung', () => addAt('zone', at)], '-', ['☐ Chọn tất cả (Ctrl+A)', ACT.all], ['⤢ Vừa khung', fit],
    ];
    const m = document.createElement('div');
    m.className = 'dg-menu';
    m.innerHTML = items.map((it, i) => (it === '-' ? '<hr>' : `<button data-i="${i}"${it[2] ? ' class="danger"' : ''}>${esc(it[0])}</button>`)).join('');
    root.appendChild(m);
    const r = root.getBoundingClientRect();
    m.style.left = Math.min(e.clientX - r.left, r.width - m.offsetWidth - 6) + 'px';
    m.style.top = Math.min(e.clientY - r.top, r.height - m.offsetHeight - 6) + 'px';
    m.onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; closeMenu(); items[+b.dataset.i][1](); };
  });
  function setEdge(patch, swap) {
    const es = sel().filter((x) => x.a);
    mut(() => { for (const e of es) { if (swap) Object.assign(e, patch); else D.update(dg, e.id, patch); } });
    render();
  }

  // ---------------------------------------------------------------- phím tắt
  const onKey = (e) => {
    if (!alive()) { document.removeEventListener('keydown', onKey); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === ' ') { st.space = true; stage.classList.add('space'); e.preventDefault(); return; }
    const c = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (e.key === 'Escape') { if (root.querySelector('.dg-menu')) closeMenu(); else { st.sel = []; render(); } return; }
    if (e.key === 'F11') { e.preventDefault(); ACT.fullscreen(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); ACT.del(); return; }
    if (e.key === 'F2') { e.preventDefault(); const s = selShapes()[0]; if (s) editText(s.id); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); ACT['find-replace'](); return; }
    if (e.key.startsWith('Arrow')) {
      const ss = selShapes(); if (!ss.length) return;
      e.preventDefault();
      const n = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
      mut(() => D.move(dg, ss.map((s) => s.id), dx, dy)); render(); return;
    }
    if (!c) return;
    const map = { z: e.shiftKey ? 'redo' : 'undo', y: 'redo', c: 'copy', x: 'cut', v: 'paste', d: 'dup', a: 'all', g: e.shiftKey ? 'ungroup' : 'group', '=': 'zin', '+': 'zin', '-': 'zout', '0': 'z100', ']': 'front', '[': 'back', s: 'save' };
    if (k === 'h' && e.shiftKey) { e.preventDefault(); fit(); return; }
    const a = map[k];
    if (!a) return;
    e.preventDefault();
    if (a === 'save') { $('dg-status').textContent = save('diagram', JSON.parse(D.exportJson(dg))) ? '💾 Đã lưu sơ đồ trong trình duyệt (tự lưu sau mỗi thay đổi; ⬇ Xuất để lưu ra file).' : '⚠ Không lưu được vào trình duyệt, hãy ⬇ Xuất sơ đồ ra file.'; return; }
    ACT[a]();
  };
  const onKeyUp = (e) => { if (e.key === ' ') { st.space = false; stage.classList.remove('space'); } };
  const onBlur = () => { st.space = false; stage.classList.remove('space'); };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  const dispose = () => {
    clearInterval(snapshotTimer); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur); window.removeEventListener('resize', onResize);
    if (disposeActiveDiagram === dispose) disposeActiveDiagram = null;
  };
  disposeActiveDiagram = dispose;
  root.addEventListener('pointerdown', (e) => { if (!e.target.closest('.dg-menu')) closeMenu(); }, true);

  save('diagram-pages',pages); save('diagram-page-index',pageIndex); renderPages();
  renderLib();
  render();
  if (!load('diagram-view', null)) fit();
}
