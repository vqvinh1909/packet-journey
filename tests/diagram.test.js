// tests/diagram.test.js — lõi trình vẽ sơ đồ kiểu draw.io (lab/diagram.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../lab/diagram.js';

test('thêm hình: tên thiết bị không trùng, bắt lưới, hình cơ bản có chữ mặc định; dây không nối chính nó', () => {
  const d = D.emptyDiagram();
  const r1 = D.addShape(d, 'router', 103, 47), r2 = D.addShape(d, 'router', 300, 50), c = D.addShape(d, 'cloud', 500, 50), c2 = D.addShape(d, 'cloud', 600, 50);
  assert.deepEqual([r1.label, r2.label, c.label, c2.label], ['R1', 'R2', 'INTERNET', 'INTERNET2']);
  assert.deepEqual([r1.x, r1.y], [100, 50], 'bắt lưới 10px');
  assert.equal(D.addShape(d, 'zone', 0, 0).dash, 'dash');
  assert.equal(D.addShape(d, 'text', 0, 0).label, 'Văn bản');
  assert.ok(D.addEdge(d, r1.id, r2.id, { la: 'G0/0' }));
  assert.equal(D.addEdge(d, r1.id, r1.id), null);
  assert.equal(D.addEdge(d, r1.id, 'zz'), null);
  assert.throws(() => D.addShape(d, 'xyz', 0, 0), /không hợp lệ/);
});

test('xoá hình kéo theo dây; hình khoá không di chuyển / không xoá được; nhóm chọn cùng nhau', () => {
  const d = D.emptyDiagram();
  const a = D.addShape(d, 'pc', 0, 0), b = D.addShape(d, 'switch', 200, 0), c = D.addShape(d, 'server', 400, 0);
  D.addEdge(d, a.id, b.id); D.addEdge(d, b.id, c.id);
  D.update(d, c.id, { locked: true });
  D.move(d, [a.id, c.id], 30, 10);
  assert.deepEqual([a.x, c.x], [30, 400]);
  D.remove(d, [b.id, c.id]);
  assert.deepEqual(d.shapes.map((s) => s.id), [a.id, c.id], 'C khoá nên còn');
  assert.equal(d.edges.length, 0, 'dây nối B bị xoá theo');
  const x = D.addShape(d, 'rect', 0, 100), y = D.addShape(d, 'rect', 200, 100);
  const g = D.group(d, [x.id, y.id]);
  assert.ok(g);
  assert.deepEqual(D.expandGroups(d, [x.id]).sort(), [x.id, y.id].sort());
  D.ungroup(d, [x.id, y.id]);
  assert.deepEqual(D.expandGroups(d, [x.id]), [x.id]);
  assert.equal(D.group(d, [x.id]), null, 'nhóm cần ≥ 2 hình');
});

test('nhân bản: giữ dây nội bộ, đặt tên mới, nhóm mới; căn lề, dàn đều, thứ tự lớp, chọn bằng khung', () => {
  const d = D.emptyDiagram();
  const a = D.addShape(d, 'router', 0, 0), b = D.addShape(d, 'switch', 200, 0);
  D.addEdge(d, a.id, b.id, { label: 'trunk' });
  const g = D.group(d, [a.id, b.id]);
  const ids = D.duplicate(d, [a.id, b.id]);
  const [na, nb] = ids.map((id) => D.shapeOf(d, id));
  assert.deepEqual([na.label, nb.label], ['R2', 'SW2']);
  assert.ok(na.g && na.g === nb.g && na.g !== g, 'nhóm mới');
  assert.ok(d.edges.some((e) => e.a === na.id && e.b === nb.id && e.label === 'trunk'));
  const s = [D.addShape(d, 'rect', 0, 300), D.addShape(d, 'rect', 50, 330, { w: 60 }), D.addShape(d, 'rect', 400, 360)];
  const sid = s.map((x) => x.id);
  D.align(d, sid, 'left');
  assert.ok(s.every((x) => x.x === 0));
  D.align(d, sid, 'top');
  assert.ok(s.every((x) => x.y === 300));
  s[1].x = 50; s[2].x = 600;
  D.distribute(d, sid, 'h');
  assert.equal(s[1].x - (s[0].x + s[0].w), s[2].x - (s[1].x + s[1].w), 'khoảng cách bằng nhau');
  D.zOrder(d, [a.id], true);
  assert.equal(d.shapes.at(-1).id, a.id);
  D.zOrder(d, [a.id], false);
  assert.equal(d.shapes[0].id, a.id);
  assert.deepEqual(D.inRect(d, { x0: -5, y0: 290, x1: 1000, y1: 400 }).sort(), sid.sort());
});

test('hoàn tác / làm lại', () => {
  const d = D.emptyDiagram();
  const h = D.createHistory();
  const a = h.track(d, () => D.addShape(d, 'pc', 0, 0));
  h.track(d, () => D.update(d, a.id, { label: 'PC-KT' }));
  assert.equal(d.shapes[0].label, 'PC-KT');
  h.undo(d);
  assert.equal(d.shapes[0].label, 'PC1');
  h.undo(d);
  assert.equal(d.shapes.length, 0);
  assert.ok(!h.canUndo && h.canRedo);
  h.redo(d); h.redo(d);
  assert.equal(d.shapes[0].label, 'PC-KT');
});

test('đường dây: đầu dây nằm trên mép hình; gấp khúc đi qua góc; cong có điểm điều khiển', () => {
  const d = D.emptyDiagram();
  const a = D.addShape(d, 'rect', 0, 0, { w: 100, h: 60 }), b = D.addShape(d, 'rect', 300, 200, { w: 100, h: 60 });
  const e = D.addEdge(d, a.id, b.id);
  const p = D.edgePath(d, e);
  const onEdge = (s, pt) => (Math.abs(pt.x - s.x) < 0.01 || Math.abs(pt.x - s.x - s.w) < 0.01 || Math.abs(pt.y - s.y) < 0.01 || Math.abs(pt.y - s.y - s.h) < 0.01);
  assert.ok(onEdge(a, p.a) && onEdge(b, p.b));
  e.style = 'ortho';
  assert.match(D.edgePath(d, e).d, /^M[\d.]+ [\d.]+L[\d.]+ [\d.]+L[\d.]+ [\d.]+$/);
  e.style = 'curve';
  assert.match(D.edgePath(d, e).d, /Q/);
});

test('SVG: thoát ký tự đặc biệt, có mũi tên / nhãn cổng / nét gạch; vùng vẽ dưới dây; khung bao gồm chữ', () => {
  const d = D.emptyDiagram();
  const z = D.addShape(d, 'zone', 0, 0, { w: 500, h: 300, label: 'DMZ <1>' });
  const r = D.addShape(d, 'router', 50, 50, { label: 'R&D' }), s = D.addShape(d, 'switch', 300, 50);
  D.addEdge(d, r.id, s.id, { arrowB: true, la: 'G0/0', lb: 'G0/1', dash: 'dash', label: 'trunk' });
  const svg = D.toSvg(d);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /R&amp;D/);
  assert.match(svg, /DMZ &lt;1&gt;/);
  assert.match(svg, /stroke-dasharray="8 6"/);
  assert.ok(svg.indexOf(`data-id="${z.id}"`) < svg.indexOf('class="dg-edge"'), 'vùng vẽ trước dây');
  assert.ok(svg.includes('>G0/0<') && svg.includes('>trunk<'));
  assert.ok(D.bounds(d).h > 300);
  for (const t of Object.keys(D.SHAPES)) assert.ok(D.shapeSvg(D.addShape(D.emptyDiagram(), t, 0, 0)).startsWith('<g'), t);
});

test('JSON: xuất → nhập giữ nguyên; bỏ dây hỏng; file lạ báo lỗi; mẫu sơ đồ hợp lệ', () => {
  const d = D.TEMPLATES[1].build();
  const back = D.importJson(D.exportJson(d));
  assert.deepEqual(back.shapes, d.shapes);
  assert.deepEqual(back.edges, d.edges);
  const n = D.addShape(back, 'pc', 0, 0);
  assert.ok(!d.shapes.some((s) => s.id === n.id), 'id mới không trùng sau khi nhập');
  const bad = JSON.parse(D.exportJson(d));
  bad.edges.push({ id: 'e999', a: 'nope', b: d.shapes[0].id });
  assert.equal(D.importJson(bad).edges.length, d.edges.length);
  assert.throws(() => D.importJson('{"a":1}'), /không phải sơ đồ/);
  for (const t of D.TEMPLATES) {
    const x = t.build();
    assert.ok(x.shapes.length > 3 && x.edges.length > 2, t.id);
    assert.ok(x.edges.every((e) => D.shapeOf(x, e.a) && D.shapeOf(x, e.b)), t.id);
    assert.equal(new Set(x.shapes.filter(D.isDevice).map((s) => s.label)).size, x.shapes.filter(D.isDevice).length, `${t.id}: tên thiết bị không trùng`);
  }
});

test('copy / dán: id mới, tên thiết bị mới nếu trùng, giữ dây nội bộ, dán được cả sau khi đã xoá bản gốc', () => {
  const d = D.emptyDiagram();
  const a = D.addShape(d, 'router', 0, 0), b = D.addShape(d, 'switch', 200, 0), c = D.addShape(d, 'pc', 400, 0);
  D.addEdge(d, a.id, b.id); D.addEdge(d, b.id, c.id);
  const clip = D.copyOf(d, [a.id, b.id]);
  assert.equal(clip.edges.length, 1, 'chỉ lấy dây nằm giữa vùng chọn');
  const ids = D.paste(d, clip, 30, 30);
  assert.equal(ids.length, 2);
  assert.deepEqual(ids.map((id) => D.shapeOf(d, id).label), ['R2', 'SW2']);
  assert.equal(D.shapeOf(d, ids[0]).x, 30);
  D.remove(d, [a.id, b.id, ...ids]);
  const again = D.paste(d, clip);
  assert.deepEqual(again.map((id) => D.shapeOf(d, id).label), ['R1', 'SW1'], 'tên gốc còn trống thì giữ nguyên');
  assert.ok(d.edges.some((e) => e.a === again[0] && e.b === again[1]));
});
