// tests/port-labels.test.js — nhãn cổng phải đọc được trên mọi mô hình: không đè thiết bị, không chồng nhau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LABS } from '../lab/labs.js';
import { SANDBOX_TEMPLATES, emptySandbox, addDevice, connect } from '../lab/sandbox.js';
import { TEMPLATES, toSvg, shapeOf, isContainer, SHAPES, emptyDiagram, addShape, addEdge, edgeSvg } from '../lab/diagram.js';
import { isHost, nodeBoxes, rectsHit, labelRect, layoutPortLabels, portText } from '../ui/topo.js';

const noStp = new Map();
function problems(net, withSub = isHost) {
  const spots = layoutPortLabels(net, (D, p) => portText(noStp, D, p), withSub);
  const labels = net.links.flatMap((l) => [[l.a, l.ap, spots[l.id][0]], [l.b, l.bp, spots[l.id][1]]].map(([id, port, s]) => ({ text: `${net.devices[id].name} ${port}`, r: labelRect(s, s.w) })));
  const out = [];
  for (const L of labels) for (const d of Object.values(net.devices)) if (nodeBoxes(d, withSub(d)).some((b) => rectsHit(L.r, b))) out.push(`${L.text} đè ${d.name}`);
  labels.forEach((a, i) => labels.slice(i + 1).forEach((b) => { if (rectsHit(a.r, b.r)) out.push(`${a.text} chồng ${b.text}`); }));
  return out;
}

test('mọi lab và mẫu mạng: nhãn cổng không đè thiết bị, không chồng nhau', () => {
  for (const [id, build] of [...LABS.map((l) => [l.id, l.build]), ...SANDBOX_TEMPLATES.map((t) => [t.id, t.build])]) {
    assert.deepEqual(problems(build()), [], id);
  }
});

test('dây dọc ngắn như R-GW xuống switch: nhãn nằm ngoài icon và tên', () => {
  const net = emptySandbox();
  const r = addDevice(net, 'router', 500, 70), s = addDevice(net, 'sw2960', 500, 210);
  connect(net, r, 'g0/0', s, 'fa0/1');
  const [a, b] = layoutPortLabels(net, (D, p) => portText(noStp, D, p))[net.links[0].id];
  assert.ok(a.y - 8 >= 70 + 49, `nhãn router ở y=${a.y} còn đè tên R1`);
  assert.ok(b.y + 7 <= 210 - 27, `nhãn switch ở y=${b.y} còn đè icon`);
  assert.equal(a.x, 500);
});

test('thiết bị sát nhau: nhãn đứng cạnh dây thay vì đè icon', () => {
  const net = emptySandbox();
  const r = addDevice(net, 'router', 500, 70), s = addDevice(net, 'sw2960', 500, 150);
  connect(net, r, 'g0/0', s, 'fa0/1');
  const spots = layoutPortLabels(net, (D, p) => portText(noStp, D, p));
  for (const p of spots[net.links[0].id]) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.deepEqual(problems(net).filter((x) => x.includes('chồng')), []);
});

const tags = (svg) => [...svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="15" rx="3"[^>]*\/><text[^>]*>([^<]*)</g)].map((m) => ({ l: +m[1], t: +m[2], r: +m[1] + +m[3], b: +m[2] + 15, s: m[4] }));

test('mọi mẫu sơ đồ: dây vật lý có tên cổng, dây luồng ứng dụng thì không; nhãn không chồng nhau', () => {
  const net = (s) => SHAPES[s?.t]?.group === 'net';
  for (const t of TEMPLATES) {
    const d = t.build();
    for (const e of d.edges) {
      const a = shapeOf(d, e.a), b = shapeOf(d, e.b);
      if (net(a) && net(b) && e.cable !== 'wifi') {
        assert.ok(a.t === 'cloud' || e.la, `${t.id}: ${a.label} thiếu tên cổng`);
        assert.ok(b.t === 'cloud' || e.lb, `${t.id}: ${b.label} thiếu tên cổng`);
      } else if (!net(a) || !net(b)) {
        assert.ok(!e.la || net(a), `${t.id}: ${a.label} không phải thiết bị mạng mà có cổng ${e.la}`);
      }
      for (const [dev, port] of [[a, e.la], [b, e.lb]]) if (port) assert.equal(d.edges.filter((x) => (x.a === dev.id && x.la === port) || (x.b === dev.id && x.lb === port)).length, 1, `${t.id}: ${dev.label} dùng trùng cổng ${port}`);
    }
    const R = tags(toSvg(d));
    const S = d.shapes.filter((s) => !isContainer(s) && s.t !== 'note' && s.t !== 'text').map((s) => ({ l: s.x, r: s.x + s.w, t: s.y, b: s.y + s.h, s: s.label }));
    R.forEach((x, i) => {
      for (const y of R.slice(i + 1)) assert.ok(!rectsHit(x, y), `${t.id}: ${x.s} chồng ${y.s}`);
      for (const y of S) assert.ok(!rectsHit(x, y), `${t.id}: ${x.s} đè ${y.s}`);
    });
  }
});

test('edgeSvg vẽ đủ nhãn hai đầu dây', () => {
  const d = emptyDiagram();
  const a = addShape(d, 'router', 0, 0), b = addShape(d, 'switch', 400, 0);
  const e = addEdge(d, a.id, b.id, { la: 'Gi0/0', lb: 'Fa0/1' });
  assert.match(edgeSvg(d, e), /Gi0\/0[\s\S]*Fa0\/1/);
});
