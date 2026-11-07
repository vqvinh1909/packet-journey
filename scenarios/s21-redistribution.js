// scenarios/s21-redistribution.js
// Kịch bản 21 (CCNP): Redistribution giữa OSPF và EIGRP.
// R2 chạy cả hai giao thức (ASBR/boundary), bơm route từ miền này sang miền kia.
// Dạy: external route (OSPF E2), seed metric, và nguy cơ loop khi redistribute 2 chiều.

import { Sim } from '../engine/simulate.js';

const OSPF_MAC = '01:00:5e:00:00:05';
const EIGRP_MAC = '01:00:5e:00:00:0a';
const R1 = { id: 'r1', mac: '00:00:00:00:0c:01', ip: '10.0.0.1', rid: '1.1.1.1' };
const R2 = { id: 'r2', mac: '00:00:00:00:0c:02', ospfIp: '10.0.0.2', eigrpIp: '10.0.1.1' };
const R3 = { id: 'r3', mac: '00:00:00:00:0c:03', ip: '10.0.1.2' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Định tuyến (redistribution: CCNP)',
};

export const meta = {
  id: 's21-redistribution',
  titleVi: 'Redistribution OSPF ↔ EIGRP',
  titleEn: 'Route redistribution',
  descriptionVi: 'R2 (ASBR) bơm route giữa miền OSPF và EIGRP. Xem external route (O E2), seed metric, và cách tránh loop.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'r1', type: 'router', name: 'R1', x: 160, y: 150, color: '#2c5f8a', lines: ['OSPF', 'RID 1.1.1.1'] },
      { id: 'r2', type: 'router', name: 'R2', x: 500, y: 150, lines: ['OSPF + EIGRP', 'ASBR'] },
      { id: 'r3', type: 'router', name: 'R3', x: 760, y: 150, color: '#c8611a', lines: ['EIGRP AS100'] },
      { id: 'net', type: 'host', name: 'Net .3', x: 930, y: 150, color: '#2e7d5b', lines: ['192.168.3.0/24'] },
    ],
    links: [
      { id: 'o', a: 'r1', b: 'r2', labelMid: 'OSPF Area 0' },
      { id: 'e', a: 'r2', b: 'r3', labelMid: 'EIGRP AS 100' },
      { id: 'n', a: 'r3', b: 'net', bp: '' },
    ],
  };

  const sim = new Sim(topology);
  const ospfHello = (r, ip) => sim.frame([
    { proto: 'ethernet', fields: { dst: OSPF_MAC, src: r.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: ip, dst: '224.0.0.5', ttl: 1, id: 0, protocol: 89 } },
    { proto: 'ospf', fields: { type: 1, routerId: r.rid || '2.2.2.2', areaId: '0.0.0.0' } },
  ]);
  const eigrpHello = (r, ip) => sim.frame([
    { proto: 'ethernet', fields: { dst: EIGRP_MAC, src: r.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: ip, dst: '224.0.0.10', ttl: 1, id: 0, protocol: 88 } },
    { proto: 'eigrp', fields: { opcode: 5, hello: true, asn: 100 } },
  ]);

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Hai miền định tuyến khác nhau gặp nhau ở R2',
    overlay: { badges: { r2: 'ASBR' } },
    explanationVi: 'Trái là miền OSPF (R1–R2), phải là miền EIGRP (R2–R3). Chúng KHÔNG tự chia sẻ route cho nhau. R2 chạy cả hai nên có thể "redistribute" — bơm route qua lại.',
    lesson: LESSON });

  const o1 = ospfHello(R1, R1.ip);
  sim.capture(o1, 'OSPF Hello (miền OSPF)');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'r2', side: 'encap', activeLayer: 3,
    titleVi: 'Miền OSPF: R1 ↔ R2 (224.0.0.5)', packet: o1,
    overlay: { links: { o: { cls: 'root-path', label: 'OSPF' } }, badges: { r2: 'ASBR' } },
    explanationVi: 'R2 học các mạng phía OSPF qua Hello/LSA bình thường.' });

  const e1 = eigrpHello(R3, R3.ip);
  sim.capture(e1, 'EIGRP Hello (miền EIGRP)');
  sim.emit({ kind: 'transit', fromDevice: 'r3', toDevice: 'r2', side: 'encap', activeLayer: 3,
    titleVi: 'Miền EIGRP: R2 ↔ R3 (224.0.0.10)', packet: e1,
    overlay: { links: { o: { cls: 'root-path', label: 'OSPF' }, e: { cls: 'root-path', label: 'EIGRP' }, n: { cls: 'forwarding' } }, badges: { r2: 'ASBR' } },
    explanationVi: 'R2 học 192.168.3.0/24 từ EIGRP (R3 quảng bá bằng Update).' });

  sim.emit({ kind: 'process', atDevice: 'r2', side: 'inspect', activeLayer: 3,
    titleVi: 'R2 redistribute EIGRP → OSPF (thành External E2)',
    overlay: { links: { o: { cls: 'root-path', label: 'E2 →' } }, badges: { r2: 'ASBR', net: '192.168.3.0/24' } },
    explanationVi: '`router ospf 1 / redistribute eigrp 100 subnets`: R2 tạo LSA Type 5 External cho 192.168.3.0/24, loan vào miền OSPF. ' +
      'R1 thấy nó là tuyến "O E2": metric E2 CỐ ĐỊNH (mặc định 20), không cộng dồn chi phí nội miền OSPF. Nếu quên "subnets" thì trên IOS cũ chỉ các mạng classful được bơm, các subnet (như 10.1.1.0/24) bị bỏ sót; IOS 15 trở lên tự thêm "subnets".',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r2', side: 'inspect', activeLayer: 3,
    titleVi: 'Chiều ngược OSPF → EIGRP: cần SEED METRIC',
    overlay: { links: { e: { cls: 'root-path', label: '← seed metric' } }, badges: { r2: 'ASBR' } },
    explanationVi: 'EIGRP tính metric từ bandwidth/delay/reliability/load/MTU. Khi bơm route OSPF vào EIGRP phải cho "default-metric" (hoặc metric trong lệnh redistribute), ' +
      'nếu không EIGRP coi metric vô cực → BỎ route.',
    lesson: LESSON });

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Nguy cơ: loop & suboptimal khi redistribute 2 chiều',
    overlay: { badges: { r2: 'ASBR' } },
    explanationVi: 'Redistribute hai chiều ở NHIỀU điểm biên dễ gây loop/đường vòng vì route quay lại miền gốc với administrative distance khác. ' +
      'Phòng tránh: gắn ROUTE TAG rồi lọc khi bơm ngược, và/hoặc chỉnh Administrative Distance để ưu tiên nguồn đúng. (Đơn giản hóa: mô tả cấu hình bằng lời.)',
    lesson: LESSON });

  return sim.result();
}
