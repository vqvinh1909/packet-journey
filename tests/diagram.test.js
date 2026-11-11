// tests/diagram.test.js — lõi trình vẽ sơ đồ kiểu draw.io (lab/diagram.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import * as D from '../lab/diagram.js';
import * as Sandbox from '../lab/sandbox.js';
import { diagramFromSandbox, sandboxFromDiagram } from '../lab/diagram-bridge.js';
import { LABS } from '../lab/labs.js';

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

test('căn lề / dàn đều không làm dịch chuyển hình đã khoá', () => {
  const d = D.emptyDiagram(), a = D.addShape(d,'rect',0,0), locked = D.addShape(d,'rect',120,40), b = D.addShape(d,'rect',260,80);
  D.update(d,locked.id,{locked:true});
  D.align(d,[a.id,locked.id,b.id],'top');
  assert.equal(locked.y,40);
  assert.equal(a.y,b.y);
  const lockX=locked.x;
  D.distribute(d,[a.id,locked.id,b.id],'h');
  assert.equal(locked.x,lockX);
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

test('đầu mũi tên dây hỗ trợ nhiều kiểu draw.io ở từng đầu riêng biệt', () => {
  const d=D.emptyDiagram(),a=D.addShape(d,'router',0,0),b=D.addShape(d,'switch',240,0);
  for(const [type] of D.EDGE_ARROW_TYPES) {
    const e=D.addEdge(d,a.id,b.id,{arrowAType:type,arrowBType:type});
    assert.equal(D.edgeArrowType(e,'A'),type);
    assert.equal(D.edgeArrowType(e,'B'),type);
    if(type==='none') assert.doesNotMatch(D.edgeSvg(d,e),/class="dg-arrow dg-arrow-/);
    else assert.match(D.edgeSvg(d,e),new RegExp(`class="dg-arrow dg-arrow-${type}"`),type);
  }
  const open=D.addEdge(d,a.id,b.id,{arrowAType:'none',arrowBType:'open'});
  assert.equal(open.arrowA,false); assert.equal(open.arrowB,true);
});

test('điểm nối cố định giữ nguyên cạnh đã chọn khi hình di chuyển và qua JSON', () => {
  const d = D.emptyDiagram();
  const a = D.addShape(d, 'router', 0, 0), b = D.addShape(d, 'switch', 240, 100);
  const e = D.addEdge(d, a.id, b.id, { portA: 'e', portB: 'n' });
  const expected = () => ({ a: D.portPoint(a, 'e'), b: D.portPoint(b, 'n') });
  for (const style of ['straight', 'curve', 'ortho']) {
    e.style = style;
    let p = D.edgePath(d, e), q = expected();
    assert.deepEqual(p.a, q.a, `${style}: cổng đầu A`);
    assert.deepEqual(p.b, q.b, `${style}: cổng đầu B`);
    D.move(d, [a.id], 40, 30);
    p = D.edgePath(d, e); q = expected();
    assert.deepEqual(p.a, q.a, `${style}: A bám theo hình`);
    assert.deepEqual(p.b, q.b, `${style}: B không tự đổi cổng`);
    D.move(d, [a.id], -40, -30);
  }
  const restored = D.importJson(D.exportJson(d));
  assert.equal(restored.edges[0].portA, 'e');
  assert.equal(restored.edges[0].portB, 'n');
  assert.deepEqual(D.edgePath(restored, restored.edges[0]).a, D.portPoint(D.shapeOf(restored, a.id), 'e'));
});

test('waypoint giữ đúng điểm uốn và dây gấp khúc tự đi vòng qua hình chắn', () => {
  const d = D.emptyDiagram();
  const a = D.addShape(d, 'rect', 0, 30, { w: 80, h: 50 }), b = D.addShape(d, 'rect', 320, 30, { w: 80, h: 50 });
  const obstacle = D.addShape(d, 'rect', 140, 0, { w: 100, h: 120 });
  const e = D.addEdge(d, a.id, b.id, { style: 'ortho', portA: 'e', portB: 'w' });
  let path = D.edgePath(d, e);
  assert.match(path.d, /L/);
  assert.ok(!path.d.includes('L200 55'), 'đường tự tránh qua vùng hình chắn');
  const points = [...path.d.matchAll(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
  const crossesObstacle = points.slice(1).some((p, i) => {
    const q = points[i], horizontal = q.y === p.y, vertical = q.x === p.x;
    return horizontal ? q.y > obstacle.y && q.y < obstacle.y + obstacle.h && Math.max(q.x, p.x) > obstacle.x && Math.min(q.x, p.x) < obstacle.x + obstacle.w
      : vertical ? q.x > obstacle.x && q.x < obstacle.x + obstacle.w && Math.max(q.y, p.y) > obstacle.y && Math.min(q.y, p.y) < obstacle.y + obstacle.h : false;
  });
  assert.equal(crossesObstacle, false);
  e.waypoints = [{ x: 100, y: -40 }];
  path = D.edgePath(d, e);
  assert.match(path.d, /L100 -40/);
  const saved = D.importJson(D.exportJson(d));
  assert.deepEqual(saved.edges[0].waypoints, [{ x: 100, y: -40 }]);
});

test('nhiều dây cùng cặp hình tự tách song song nhưng vẫn bám đúng điểm nối', () => {
  const d = D.emptyDiagram(), a = D.addShape(d, 'router', 0, 0), b = D.addShape(d, 'switch', 240, 0);
  const wires = Array.from({ length: 4 }, () => D.addEdge(d, a.id, b.id, { portA: 'e', portB: 'w' }));
  const paths = wires.map((e) => D.edgePath(d, e));
  assert.equal(new Set(paths.map((p) => p.mid.y)).size, 4, 'mỗi dây có tuyến riêng');
  assert.ok(paths.every((p) => p.a.x === D.portPoint(a, 'e').x && p.b.x === D.portPoint(b, 'w').x));
});

test('gợi ý tên cổng không trùng và kiểu cáp có nét riêng trong SVG', () => {
  const d = D.emptyDiagram(), r = D.addShape(d, 'router', 0, 0), s = D.addShape(d, 'switch', 240, 0);
  assert.equal(D.suggestPortName(d, r.id), 'Gi0/0');
  assert.equal(D.suggestPortName(d, s.id), 'Fa0/1');
  D.addEdge(d, r.id, s.id, { la: 'Gi0/0', lb: 'Fa0/1', cable: 'fiber' });
  assert.equal(D.suggestPortName(d, r.id), 'Gi0/1');
  assert.equal(D.suggestPortName(d, s.id), 'Fa0/2');
  const wifi = D.addEdge(d, r.id, s.id, { cable: 'wifi' });
  const svg = D.edgeSvg(d, wifi);
  assert.match(svg, /stroke-dasharray="8 5"/);
  assert.match(svg, /Q/);
  assert.match(D.edgeSvg(d, D.addEdge(d, r.id, s.id, { cable: 'fiber' })), /#e67e22/);
});

test('thư viện có bộ DevOps/Cloud và pipeline sửa được từng bước', () => {
  const d = D.emptyDiagram(), p = D.addShape(d, 'pipeline', 0, 0);
  const svg = D.shapeSvg(p);
  for (const step of ['Build', 'Test', 'Scan', 'Deploy']) assert.ok(svg.includes(step));
  D.update(d, p.id, { steps: ['Build', 'Test', 'Deploy to prod'] });
  const edited = D.shapeSvg(p);
  assert.ok(edited.includes('Deploy to prod'));
  for (const t of ['pod', 'ingress', 'gitRepo', 'apiGateway', 'monitor', 'microservice', 'modem', 'database', 'satellite', 'lock', 'table']) assert.ok(D.SHAPES[t], `thiếu ${t}`);
  assert.equal(D.SHAPES.pod.group, 'devops');
  assert.equal(D.SHAPES.apiGateway.group, 'cloud');
});

test('icon SVG của các thiết bị mới có phần hình vẽ, không chỉ nhãn', () => {
  for (const t of ['modem','homeRouter','hub','loadBalancer','idsIps','vpnGateway','ipPbx','rack','nas','container','pod','registry','vm','cdn','monitor']) {
    const d=D.emptyDiagram(),s=D.addShape(d,t,0,0,{label:''}),svg=D.shapeSvg({...s,label:''});
    assert.match(svg,/<(?:rect|path|ellipse|circle|line)\b/,`${t} thiếu hình icon`);
    assert.ok(!svg.includes(`>${D.SHAPES[t].glyph}</text>`),`${t} vẫn đang dùng icon chữ trong khung chung`);
  }
});

test('hình cáp và ký hiệu kỹ thuật dùng đúng SVG riêng thay vì khung chữ nhật trống', () => {
  const marks={fiberSingle:'#f97316',fiberMulti:'#2563eb',consoleCable:'#cbd5e1',wifiLink:'#0ea5e9',vpnLink:'#7c3aed',trustZone:'#16a34a',untrustedZone:'#dc2626',redundancyMark:'#60a5fa',faultMark:'#b91c1c'};
  for(const [t,color] of Object.entries(marks)) {
    const d=D.emptyDiagram(),s=D.addShape(d,t,0,0,{label:''}),svg=D.shapeSvg(s);
    assert.ok(svg.includes(`"${color}"`),`${t} chưa gọi SVG riêng (${color})`);
  }
});

test('khung chứa nhận hình thả vào, tự nới và kéo theo hình con', () => {
  const d = D.emptyDiagram(), frame = D.addShape(d, 'vpc', 0, 0, { w: 180, h: 120 }), child = D.addShape(d, 'pc', 35, 40);
  assert.equal(D.assignContainer(d, child.id), true);
  assert.equal(child.parent, frame.id);
  const old = [child.x, child.y];
  D.move(d, D.expandContainers(d, [frame.id]), 100, 50);
  assert.deepEqual([child.x, child.y], [old[0] + 100, old[1] + 50]);
  D.addShape(d, 'server', 500, 400);
  const outside = d.shapes.at(-1);
  D.assignContainer(d, outside.id);
  D.fitContainers(d);
  assert.ok(frame.w >= child.x + child.w - frame.x);
  assert.match(D.shapeSvg(frame), /VPC \/ VNet/);
});

test('tủ rack là khung chứa server nhưng vẫn là thiết bị có thể nối mạng', () => {
  const d=D.emptyDiagram(),rack=D.addShape(d,'rack',0,0),children=['server','switch','router','firewall','nas','ups'].map((t,i)=>D.addShape(d,t,25+i*8,25+i*18));
  assert.ok(D.isContainer(rack)); assert.ok(D.isDevice(rack));
  for(const s of children){assert.equal(D.assignContainer(d,s.id),true,s.t);assert.equal(s.parent,rack.id);}
  D.fitRack(d,rack.id); assert.deepEqual(children.map(s=>s.rackU),[2,1,1,1,2,2]); assert.ok(children.every(s=>s.rackMounted));
  assert.deepEqual(children.map(s=>s.rackStartU),[1,3,4,5,6,8],'thiết bị được đặt theo U và giữ lại các U trống');
  const ids=D.expandContainers(d,[rack.id]); D.move(d,ids,40,20); D.fitRack(d,rack.id);
  assert.deepEqual([rack.x,rack.y,children[0].x,children[0].y],[40,20,70,212]);
  D.fitContainers(d); assert.ok(rack.w>=180&&rack.h>=240);
  assert.ok(D.shapeSvg(D.addShape(D.emptyDiagram(),'ups',0,0)).includes('#16a34a'),'UPS có icon màu');
});

test('rack 42U không chồng thiết bị khi quá tải; phần dư được đưa ra cạnh tủ', () => {
  const d=D.emptyDiagram(),rack=D.addShape(d,'rack',100,100),servers=Array.from({length:6},(_,i)=>D.addShape(d,'server',140,140+i*20,{rackU:8}));
  for(const s of servers) { D.update(d,s.id,{rackU:8}); D.assignContainer(d,s.id); }
  D.fitRack(d,rack.id);
  const mounted=servers.filter(s=>s.rackMounted),overflow=servers.filter(s=>!s.rackMounted);
  assert.equal(rack.rackUnits,42);
  assert.equal(mounted.length,5);
  assert.equal(overflow.length,1);
  assert.equal(overflow[0].parent,undefined);
  assert.ok(overflow[0].x>=rack.x+rack.w);
  assert.equal(D.rackUsage(d,rack.id).overflow,1,'rack báo số thiết bị vượt tải');
  const slots=mounted.flatMap(s=>Array.from({length:s.rackU},(_,i)=>s.rackStartU+i));
  assert.equal(new Set(slots).size,slots.length,'không có U bị chiếm chồng');
});

test('smart guides căn mép/tâm và giữ nguyên khi không có hình gần', () => {
  const d = D.emptyDiagram(), a = D.addShape(d, 'rect', 0, 0, { w: 100, h: 60 }), b = D.addShape(d, 'rect', 250, 100, { w: 100, h: 60 });
  const snap = D.snapToGuides(d, [a.id], 147, 38, 5);
  assert.equal(snap.dx, 150, 'mép phải A bắt vào mép trái B');
  assert.equal(snap.dy, 40, 'tâm dọc bắt tâm dọc');
  assert.deepEqual(snap.guides.map((g) => g.axis).sort(), ['x','y']);
  assert.deepEqual(D.snapToGuides(d, [a.id], -500, 0, 4), { dx: -500, dy: 0, guides: [] });
});

test('auto-layout lưới, phân lớp và cây đưa hình ra vị trí khác', () => {
  for (const mode of ['grid','layered','tree']) {
    const d = D.emptyDiagram(), r = D.addShape(d,'router',0,0), sw = D.addShape(d,'switch',0,0), pc = D.addShape(d,'pc',0,0);
    D.addEdge(d,r.id,sw.id); D.addEdge(d,sw.id,pc.id);
    assert.equal(D.autoLayout(d,[r.id,sw.id,pc.id],mode),true);
    assert.equal(new Set(d.shapes.map((s)=>`${s.x},${s.y}`)).size,3,mode);
    if(mode==='layered') assert.ok(r.y < sw.y && sw.y < pc.y);
  }
});

test('thuộc tính thiết bị/cổng và thuộc tính dây được lưu, xuất SVG', () => {
  const d = D.emptyDiagram(), a = D.addShape(d, 'router', 0, 0), b = D.addShape(d, 'switch', 180, 0);
  D.update(d, a.id, { meta: { hostname: 'R-HQ', model: 'ISR', mgmtIp: '10.0.0.1/24' }, showMeta: true, ports: [{ name: 'Gi0/0', ip: '10.0.0.1/24', vlan: '10', mode: 'access', description: 'LAN' }] });
  const e = D.addEdge(d, a.id, b.id, { la: 'Gi0/0', lb: 'Fa0/1', speed: '1 Gbps', mode: 'trunk', vlans: '10,20' });
  const svg = D.toSvg(d);
  assert.ok(svg.includes('R-HQ') && svg.includes('10.0.0.1/24'));
  const saved = D.importJson(D.exportJson(d));
  assert.deepEqual(D.shapeOf(saved, a.id).ports[0], { name: 'Gi0/0', ip: '10.0.0.1/24', vlan: '10', mode: 'access', description: 'LAN' });
  assert.deepEqual([D.edgeOf(saved, e.id).speed, D.edgeOf(saved, e.id).mode, D.edgeOf(saved, e.id).vlans], ['1 Gbps', 'trunk', '10,20']);
});

test('Network Inspector cảnh báo IP trùng, gateway/subnet sai và VLAN trunk lệch', () => {
  const d = D.emptyDiagram(), a = D.addShape(d, 'router', 0, 0), b = D.addShape(d, 'switch', 200, 0);
  D.update(d, a.id, { meta: { mgmtIp: '10.0.0.1/24', gateway: '10.0.1.1' }, ports: [{ name: 'Gi0/0', ip: '192.168.1.1/24', vlan: '10', mode: 'trunk' }, { name: 'Gi0/0' }] });
  D.update(d, b.id, { meta: { mgmtIp: '10.0.0.1/24' }, ports: [{ name: 'Fa0/1', ip: '192.168.2.2/25', vlan: '10', mode: 'trunk' }] });
  D.addEdge(d, a.id, b.id, { la: 'Gi0/0', lb: 'Fa0/1', mode: 'trunk', vlans: '10,20' });
  const codes = new Set(D.validateNetwork(d).map((w) => w.code));
  for (const code of ['duplicate-ip', 'duplicate-port', 'gateway-subnet', 'link-subnet', 'trunk-vlan']) assert.ok(codes.has(code), `thiếu cảnh báo ${code}`);
  assert.ok(D.edgeVlans(d, d.edges[0]).includes('20'));
});

test('Network Inspector cảnh báo dùng quá cổng, trùng cổng vật lý, tốc độ link và thiếu công suất', () => {
  const d=D.emptyDiagram(),rack=D.addShape(d,'rack',0,0),ups=D.addShape(d,'ups',30,40),server=D.addShape(d,'server',30,80),r=D.addShape(d,'router',400,0),a=D.addShape(d,'switch',600,0),b=D.addShape(d,'switch',800,0);
  D.update(d,rack.id,{meta:{maxPowerW:600}});
  D.update(d,ups.id,{meta:{powerW:100,powerCapacityW:500}});
  D.update(d,server.id,{meta:{powerW:600},rackU:2});
  D.assignContainer(d,ups.id); D.assignContainer(d,server.id); D.fitRack(d,rack.id);
  D.update(d,r.id,{ports:[{name:'Gi0/0',speed:'1 Gbps'}]});
  D.addEdge(d,r.id,a.id,{la:'Gi0/0',speed:'10 Gbps'});
  D.addEdge(d,r.id,b.id,{la:'Gi0/0',speed:'10 Gbps'});
  const codes=new Set(D.validateNetwork(d).map(w=>w.code));
  for(const code of ['port-capacity','port-overused','link-speed','rack-power-capacity','rack-ups-capacity']) assert.ok(codes.has(code),`thiếu cảnh báo ${code}`);
});

test('lưu đồ có ký hiệu chuẩn và kiểm tra thiết bị mồ côi, trùng tên', () => {
  for (const t of ['terminator','decision','flowData','document','connector']) assert.ok(D.shapeSvg(D.addShape(D.emptyDiagram(),t,0,0)).includes('<'));
  const d=D.emptyDiagram(), a=D.addShape(d,'router',0,0,{label:'R1'}), b=D.addShape(d,'switch',200,0,{label:'R1'}), c=D.addShape(d,'pc',400,0);
  D.addEdge(d,a.id,b.id);
  const codes=new Set(D.validateNetwork(d).map(w=>w.code));
  assert.ok(codes.has('duplicate-name')); assert.ok(codes.has('unconnected'));
});

test('bridge workspace ↔ sơ đồ giữ thiết bị, cổng, dây; mạng tạo ra tắt và chưa cấu hình', () => {
  const net = Sandbox.emptySandbox(), r = Sandbox.addDevice(net,'router',100,100), sw = Sandbox.addDevice(net,'sw2960',300,100), pc = Sandbox.addDevice(net,'pc',500,100);
  net.devices[r].name = 'R-HQ'; net.devices[r].ifaces['g0/0'].ip = '10.0.0.1'; net.devices[r].ifaces['g0/0'].prefix = 24;
  Sandbox.connect(net,r,'g0/0',sw,'fa0/1'); Sandbox.connect(net,sw,'fa0/2',pc,'fa0');
  const diagram = diagramFromSandbox(net);
  assert.equal(diagram.shapes.length,3); assert.equal(diagram.edges.length,2);
  assert.ok(diagram.edges.some((e)=>e.la==='g0/0' && e.lb==='fa0/1'));
  const restored = sandboxFromDiagram(diagram);
  assert.equal(Object.keys(restored.devices).length,3); assert.equal(restored.links.length,2);
  assert.ok(Object.values(restored.devices).every((dev)=>dev.off), 'mọi thiết bị khởi tạo ở trạng thái tắt');
  const rr=Object.values(restored.devices).find((dev)=>dev.name==='R-HQ');
  assert.ok(rr); assert.ok(Object.values(rr.ifaces).every((i)=>!i.ip), 'không chép cấu hình IP vào workspace');
});

test('bridge: mọi lab đi được lab → sơ đồ → workspace, giữ đủ thiết bị và dây (kể cả serial)', () => {
  for (const lab of LABS) {
    const net = lab.build(), restored = sandboxFromDiagram(diagramFromSandbox(net));
    assert.equal(Object.keys(restored.devices).length, Object.keys(net.devices).length, lab.id);
    assert.equal(restored.links.length, net.links.length, lab.id);
  }
});

test('bridge: dây serial giữ đúng tên cổng khi có, thiếu cổng thì tự thêm', () => {
  const d = D.emptyDiagram(), a = D.addShape(d, 'router', 0, 0), b = D.addShape(d, 'router', 200, 0);
  D.addEdge(d, a.id, b.id, { la: 'Serial0/0/1', lb: 's0/2/0' });
  const net = sandboxFromDiagram(d), [l] = net.links;
  assert.equal(l.ap, 's0/0/1');
  assert.equal(l.bp, 's0/2/0');
});

test('bridge: giữ đúng tên cổng đã ghi; dây không ghi tên không chiếm cổng của dây khác', () => {
  const d = D.emptyDiagram(), r = D.addShape(d, 'router', 0, 0), sw = D.addShape(d, 'switch', 200, 0), r2 = D.addShape(d, 'router', 0, 200);
  D.addEdge(d, r.id, r2.id); // không ghi tên, đứng trước: không được lấy g0/0 của dây sau
  D.addEdge(d, r.id, sw.id, { la: 'Gi0/0', lb: 'Gi0/24' });
  D.addEdge(d, sw.id, r2.id, { la: 'FastEthernet0/5', lb: 'GigabitEthernet0/7' });
  const net = sandboxFromDiagram(d), rn = Object.values(net.devices).find((x) => x.name === r.label);
  const ports = net.links.flatMap((l) => [l.ap, l.bp]);
  for (const p of ['g0/0', 'g0/24', 'fa0/5', 'g0/7']) assert.ok(ports.includes(p), p);
  assert.notEqual(net.links[0].ap, 'g0/0');
  assert.ok(rn.ifaces['g0/0']);
});

test('điểm nối phụ chỉ có trên cạnh đủ dài, dây bám đúng điểm và giữ qua JSON', () => {
  const d = D.emptyDiagram(), small = D.addShape(d, 'rect', 0, 0, { w: 80, h: 40 }), big = D.addShape(d, 'rect', 300, 0, { w: 200, h: 200 });
  assert.deepEqual(D.portsOf(small), ['n', 'e', 's', 'w']);
  assert.equal(D.portsOf(big).length, 12);
  assert.deepEqual(D.portPoint(big, 'w1'), { x: 300, y: 50 });
  assert.deepEqual(D.portPoint(big, 'n2'), { x: 450, y: 0 });
  assert.equal(D.portPoint(big, 'x9'), null);
  assert.equal(D.nearestPort(big, 290, 45), 'w1');
  assert.equal(D.nearestPort(small, 40, -5), 'n');
  const e = D.addEdge(d, small.id, big.id, { portA: 'e', portB: 'w2' });
  assert.deepEqual(D.edgePath(d, e).b, { x: 300, y: 150 });
  const back = D.importJson(D.exportJson(d));
  assert.deepEqual(D.edgePath(back, back.edges[0]).b, { x: 300, y: 150 });
});

test('draw.io nhiều trang: xuất → nhập giữ tên, thứ tự, nội dung; đọc được trang nén và trang trống', async () => {
  const a = D.TEMPLATES[0].build(), b = D.TEMPLATES[1].build();
  const xml = D.exportDrawioPages([{ name: 'Tầng 1 & <A>', d: a }, { name: 'Page-2', d: b }]);
  const pages = await D.importDrawioPages(xml);
  assert.deepEqual(pages.map((p) => p.name), ['Tầng 1 & <A>', 'Page-2']);
  assert.equal(pages[0].d.shapes.length, a.shapes.length);
  assert.equal(pages[1].d.edges.length, b.edges.length);
  const model = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" parent="1" vertex="1" value="X"><mxGeometry x="1" y="2" width="50" height="50" as="geometry"/></mxCell></root></mxGraphModel>';
  const packed = deflateRawSync(Buffer.from(encodeURIComponent(model))).toString('base64');
  const mixed = await D.importDrawioPages(`<mxfile><diagram name="Trống"/><diagram name="Rỗng"></diagram><diagram name="Nén">${packed}</diagram></mxfile>`);
  assert.deepEqual(mixed.map((p) => [p.name, p.d.shapes.length]), [['Rỗng', 0], ['Nén', 1]]);
  assert.equal((await D.importDrawioFile(`<mxfile><diagram name="Rỗng"></diagram><diagram>${model}</diagram></mxfile>`)).shapes[0].label, 'X');
  await assert.rejects(D.importDrawioPages('<mxfile><diagram name="a"></diagram></mxfile>'), /Không tìm thấy hình/);
});

test('dây gấp khúc: không đi xuyên hình chắn kể cả hình ở xa; sơ đồ 500 hình vẫn nhanh', () => {
  const seg = (p) => [...p.d.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] }));
  const crosses = (pts, r) => pts.slice(1).some((b, i) => { const a = pts[i]; return Math.max(a.x, b.x) > r.x && Math.min(a.x, b.x) < r.x + r.w && Math.max(a.y, b.y) > r.y && Math.min(a.y, b.y) < r.y + r.h; });
  // bức tường dài vượt xa vùng tìm gần: đường vòng phải tính cả hình ở xa
  const w = D.emptyDiagram(), a = D.addShape(w, 'rect', 0, 300, { w: 40, h: 40 }), b = D.addShape(w, 'rect', 800, 300, { w: 40, h: 40 }), walls = [];
  for (let i = 0; i < 12; i++) walls.push(D.addShape(w, 'rect', 400, -400 + i * 130, { w: 40, h: 120 }));
  const pts = seg(D.edgePath(w, D.addEdge(w, a.id, b.id, { style: 'ortho', portA: 'e', portB: 'w' })));
  assert.ok(walls.every((r) => !crosses(pts, r)));
  const big = D.emptyDiagram(), ids = [];
  for (let i = 0; i < 500; i++) ids.push(D.addShape(big, 'switch', (i % 25) * 140, Math.floor(i / 25) * 140).id);
  for (let i = 1; i < 500; i++) D.addEdge(big, ids[i - 1], ids[i], { style: 'ortho' });
  const t = performance.now(); big.edges.forEach((e) => D.edgePath(big, e));
  assert.ok(performance.now() - t < 3000, 'định tuyến 499 dây phải dưới 3 giây');
});

// Khung bao gần đúng từ thuộc tính SVG (điểm điều khiển đường cong cũng tính, nên chỉ có thể rộng hơn thật).
function artBox(svg) {
  const xs = [], ys = [], add = (x, y) => { xs.push(x); ys.push(y); }, attr = (s, k) => +(s.match(new RegExp(`\\b${k}="(-?[\\d.]+)"`))?.[1] ?? 0);
  for (const [, tag, a] of svg.replace(/<text\b[^>]*>[^<]*<\/text>/g, '').matchAll(/<(path|rect|circle|ellipse)\b([^>]*)>/g)) {
    if (tag === 'rect') { add(attr(a, 'x'), attr(a, 'y')); add(attr(a, 'x') + attr(a, 'width'), attr(a, 'y') + attr(a, 'height')); }
    else if (tag !== 'path') { const rx = attr(a, 'r') || attr(a, 'rx'), ry = attr(a, 'r') || attr(a, 'ry'); add(attr(a, 'cx') - rx, attr(a, 'cy') - ry); add(attr(a, 'cx') + rx, attr(a, 'cy') + ry); }
    else {
      let x = 0, y = 0, sx = 0, sy = 0;
      for (const [, c, raw] of a.match(/\bd="([^"]*)"/)[1].matchAll(/([MmLlHhVvCcQqTtAaZz])([^MmLlHhVvCcQqTtAaZz]*)/g)) {
        const n = (raw.match(/-?\d*\.?\d+/g) || []).map(Number), rel = c === c.toLowerCase(), C = c.toUpperCase();
        if (C === 'Z') { x = sx; y = sy; continue; }
        const size = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, T: 2, A: 7 }[C];
        for (let i = 0; i + size <= n.length; i += size) {
          const p = n.slice(i, i + size), ox = rel ? x : 0, oy = rel ? y : 0;
          if (C === 'H') x = ox + p[0]; else if (C === 'V') y = oy + p[0];
          else if (C === 'A') { const nx = ox + p[5], ny = oy + p[6]; add(Math.min(x, nx), Math.min(y, ny)); add(Math.max(x, nx), Math.max(y, ny)); x = nx; y = ny; }
          else { for (let j = 0; j + 2 < size; j += 2) add(ox + p[j], oy + p[j + 1]); x = ox + p[size - 2]; y = oy + p[size - 1]; }
          add(x, y);
          if (C === 'M' && i === 0) { sx = x; sy = y; }
        }
      }
    }
  }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}
const ICON_TYPES = Object.keys(D.SHAPES).filter((t) => !D.SHAPES[t].container && !['text', 'rect', 'round', 'ellipse', 'note', 'pipeline', 'callout', 'table', 'terminator', 'decision', 'flowData', 'document', 'connector', 'lifeline', 'activation', 'messageCall', 'messageReturn', 'umlClass'].includes(t));
const iconAt = (t, x = 0, y = 0, o = {}) => D.shapeSvg(D.addShape(D.emptyDiagram(), t, x, y, { label: '', sub: '', ...o }));

test('icon: nét vẽ không vượt khung, cú pháp SVG hợp lệ', () => {
  for (const t of ICON_TYPES) {
    const svg = iconAt(t), S = D.SHAPES[t], b = artBox(svg);
    assert.ok(!/undefined|NaN|[a-zA-Z]- \d/.test(svg), `${t}: tham số SVG hỏng`);
    assert.ok(b.x0 >= -4 && b.y0 >= -4 && b.x1 <= S.w + 4 && b.y1 <= S.h + 4, `${t}: vượt khung ${S.w}×${S.h}: ${JSON.stringify(b)}`);
  }
});

test('icon: dời vị trí chỉ đổi toạ độ gốc, kéo to thì co giãn theo', () => {
  const inner = (svg) => svg.replace(/^<g data-id="[^"]*" class="dg-shape">/, '').replace(/translate\([^)]*\)/, '');
  for (const t of ICON_TYPES.filter((x) => !['router', 'switch', 'l3switch', 'firewall', 'server', 'pc', 'laptop', 'phone', 'ap', 'wlc', 'printer', 'cloud', 'rack', 'triangle', 'hexagon', 'cylinder', 'star', 'lock', 'blockArrow'].includes(x))) {
    assert.equal(inner(iconAt(t, 300, 200)), inner(iconAt(t, 0, 0)), `${t}: hình đổi khi dời vị trí`);
  }
  assert.match(iconAt('pod', 10, 20, { w: 128, h: 104 }), /translate\(10 20\) scale\(2 2\)/);
});

test('icon: mỗi loại có hình riêng; hình cơ bản không còn là ô vuông', () => {
  const norm = (svg) => svg.replace(/data-id="[^"]*"/, '').replace(/#[0-9a-f]{3,8}/gi, '#');
  const seen = new Map();
  for (const t of ICON_TYPES) {
    const k = norm(iconAt(t));
    assert.ok(!seen.has(k), `${t} trùng icon với ${seen.get(k)}`);
    seen.set(k, t);
  }
  for (const t of ['triangle', 'hexagon', 'cylinder', 'star', 'lock', 'blockArrow']) {
    assert.match(iconAt(t), /<path/, t);
    assert.equal(D.addShape(D.emptyDiagram(), t, 0, 0).label, '', `${t}: không tự mang chữ`);
  }
});

test('icon: tên mặc định ngắn; không khai báo trùng trong hàm vẽ', () => {
  for (const [t, S] of Object.entries(D.SHAPES)) if (S.prefix && S.defaultLabel === undefined) assert.ok(S.prefix.length <= 8, `${t}: ${S.prefix}`);
  const src = readFileSync(new URL('../lab/diagram.js', import.meta.url), 'utf8'), body = src.slice(src.indexOf('function drawIcon'), src.indexOf('const PARAMETRIC'));
  const cases = [...body.matchAll(/case '(\w+)':/g)].map((m) => m[1]);
  assert.deepEqual(cases.filter((c, i) => cases.indexOf(c) !== i), []);
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

test('khung xuất bao gồm waypoint và nhãn dây nằm ngoài vùng thiết bị', () => {
  const d=D.emptyDiagram(),a=D.addShape(d,'rect',0,0),b=D.addShape(d,'rect',300,0),e=D.addEdge(d,a.id,b.id,{label:'WAN'});
  e.waypoints=[{x:-520,y:-180}];
  const box=D.bounds(d);
  assert.ok(box.x < -520);
  assert.ok(box.y < -180);
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

test('draw.io XML: xuất → nhập giữ hình, metadata, vị trí và thuộc tính dây', () => {
  const d = D.emptyDiagram();
  const a = D.addShape(d, 'router', 42, 64, { label: 'R<&1>', sub: 'HQ' });
  const b = D.addShape(d, 'switch', 280, 64, { label: 'SW1' });
  D.update(d, a.id, { meta: { hostname: 'R-HQ', mgmtIp: '10.0.0.1/24' }, showMeta: true, ports: [{ name: 'Gi0/0', vlan: '10' }] });
  D.addEdge(d, a.id, b.id, { label: 'uplink', la: 'Gi0/0', lb: 'Fa0/1', cable: 'fiber', speed: '10 Gbps', mode: 'trunk', vlans: '10,20', dash: 'dash' });
  const xml = D.exportDrawio(d);
  assert.match(xml, /<mxfile/);
  const back = D.importDrawio(xml);
  assert.equal(back.shapes.length, 2);
  assert.deepEqual(back.shapes.map(({ t, x, y, label, sub, meta, ports, showMeta }) => ({ t, x, y, label, sub, meta, ports, showMeta: !!showMeta })), d.shapes.map(({ t, x, y, label, sub, meta, ports, showMeta }) => ({ t, x, y, label, sub, meta, ports, showMeta: !!showMeta })));
  assert.equal(back.edges.length, 1);
  for (const k of ['label', 'la', 'lb', 'cable', 'speed', 'mode', 'vlans', 'dash']) assert.equal(back.edges[0][k], d.edges[0][k], k);
  assert.throws(() => D.importDrawio('<mxfile/>'), /nén không được hỗ trợ/);
});

test('draw.io mặc định nén: giải nén và nhập được topology', async () => {
  const d=D.emptyDiagram(),a=D.addShape(d,'router',0,0),b=D.addShape(d,'pc',180,0);D.addEdge(d,a.id,b.id,{label:'WAN'});
  const graph=D.exportDrawio(d).match(/<mxGraphModel[\s\S]*?<\/mxGraphModel>/)[0],payload=deflateRawSync(Buffer.from(encodeURIComponent(graph))).toString('base64');
  const imported=await D.importDrawioFile(`<mxfile><diagram>${payload}</diagram></mxfile>`);
  assert.equal(imported.shapes.length,2);assert.equal(imported.edges.length,1);assert.equal(imported.edges[0].label,'WAN');
});

test('draw.io giữ định dạng, rack, quan hệ cha/con, waypoint và kiểu dây qua vòng xuất nhập', () => {
  const d=D.emptyDiagram(),rack=D.addShape(d,'rack',0,0),server=D.addShape(d,'server',30,40),sw=D.addShape(d,'switch',400,80);
  D.assignContainer(d,server.id); D.fitRack(d,rack.id);
  D.update(d,server.id,{fill:'#dbeafe',stroke:'#1d4ed8',color:'#123456',sw:3,fs:18,bold:false,italic:true,dash:'dash',op:.7,shadow:true,locked:true,layer:'Rack',meta:{hostname:'srv-01',powerW:650}});
  const e=D.addEdge(d,server.id,sw.id,{label:'uplink',la:'eth0',lb:'Fa0/1',style:'ortho',dash:'dot',cable:'fiber',color:'#f97316',width:4,arrowAType:'openDiamond',arrowBType:'crowFoot',speed:'10 Gbps',mode:'trunk',vlans:'10,20',waypoints:[{x:240,y:-40}]});
  const back=D.importDrawio(D.exportDrawio(d)),r2=back.shapes.find(s=>s.t==='rack'),s2=back.shapes.find(s=>s.label===server.label),e2=back.edges[0];
  assert.equal(s2.parent,r2.id);
  for(const k of ['rackMounted','rackU','rackStartU','fill','stroke','color','sw','fs','bold','italic','dash','op','shadow','locked','layer']) assert.deepEqual(s2[k],server[k],k);
  assert.deepEqual(s2.meta,server.meta);
  for(const k of ['label','la','lb','style','dash','cable','color','width','arrowA','arrowB','arrowAType','arrowBType','speed','mode','vlans','waypoints']) assert.deepEqual(e2[k],e[k],k);
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

test('mẫu sơ đồ: id không trùng, có nhóm, thiết bị không đè lên nhau', () => {
  assert.equal(new Set(D.TEMPLATES.map((t) => t.id)).size, D.TEMPLATES.length);
  for (const t of D.TEMPLATES) {
    assert.ok(t.group && t.vi && t.en, t.id);
    const ds = t.build().shapes.filter((s) => !D.isContainer(s) && s.t !== 'note');
    for (const [i, a] of ds.entries()) for (const b of ds.slice(i + 1)) {
      assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${t.id}: ${a.label} đè ${b.label}`);
    }
    assert.ok(t.build().shapes.every((s) => s.x >= 0 && s.y >= 0), t.id);
  }
});

test('importJson: file lạ không đưa được mã vào SVG qua ID hay trường số', () => {
  const X = '"><image href=x onerror="window.pwned=1"></image>';
  const d = D.emptyDiagram(), a = D.addShape(d, 'router', 0, 0), b = D.addShape(d, 'rect', 300, 0);
  D.addShape(d, 'rack', 600, 0);
  D.addEdge(d, a.id, b.id);
  const raw = JSON.parse(D.exportJson(d));
  const poison = (o) => { const out = { ...o }; for (const k of Object.keys(out)) if (!['id', 't', 'a', 'b', 'x', 'y', 'w', 'h'].includes(k)) out[k] = X; return out; };
  const nums = { sw: X, fs: X, op: X, radius: X, rackUnits: X, rackU: X, rackStartU: X, rackBase: X, width: X };
  raw.shapes = raw.shapes.map((s) => ({ ...poison(s), ...nums })).concat({ ...raw.shapes[0], id: X }, { ...raw.shapes[0], id: 's99', t: 'constructor' });
  raw.edges = raw.edges.map((e) => ({ ...poison(e), ...nums })).concat({ ...raw.edges[0], id: X });
  const got = D.importJson(JSON.stringify(raw));
  assert.equal(got.shapes.length, 3); // bỏ hình có ID lạ và loại hình lạ
  assert.equal(got.edges.length, 1);
  assert.ok(!D.toSvg(got).includes('<image href=x'));
  for (const x of [...got.shapes, ...got.edges]) for (const k of Object.keys(nums)) assert.ok(!(k in x) || Number.isFinite(x[k]), k);
  assert.equal(got.shapes[0].fs, 12);
  assert.equal(got.edges[0].width, 2);
  // Sơ đồ hợp lệ giữ nguyên qua xuất rồi nhập
  assert.deepEqual(JSON.parse(D.exportJson(D.importJson(D.exportJson(d)))).edges, JSON.parse(D.exportJson(d)).edges);
});

test('mẫu sơ đồ: dây thẳng không chạy xuyên qua một hình khác', () => {
  // đoạn p-q có cắt phần trong của hình r (thu vào 6px) không: cắt xén Liang–Barsky
  const hit = (p, q, r) => {
    let t0 = 0, t1 = 1; const dx = q.x - p.x, dy = q.y - p.y;
    for (const [a, b] of [[-dx, p.x - r.x - 6], [dx, r.x + r.w - 6 - p.x], [-dy, p.y - r.y - 6], [dy, r.y + r.h - 6 - p.y]]) {
      if (a === 0) { if (b < 0) return false; continue; }
      const t = b / a;
      if (a < 0) { if (t > t1) return false; t0 = Math.max(t0, t); } else { if (t < t0) return false; t1 = Math.min(t1, t); }
    }
    return t0 < t1;
  };
  const mid = (s) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
  for (const t of D.TEMPLATES) {
    const d = t.build(), ds = d.shapes.filter((s) => !D.isContainer(s) && s.t !== 'note');
    for (const e of d.edges) {
      if (e.style === 'ortho' || e.style === 'curve') continue;
      const a = D.shapeOf(d, e.a), b = D.shapeOf(d, e.b);
      for (const s of ds) assert.ok(s === a || s === b || !hit(mid(a), mid(b), s), `${t.id}: dây ${a.label} → ${b.label} xuyên qua ${s.label}`);
    }
  }
});
