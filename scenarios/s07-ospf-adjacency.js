// scenarios/s07-ospf-adjacency.js
// Kịch bản 7 (CCNA/CCNP Routing): OSPF trên đoạn multi-access.
// 3 router cùng một LAN gửi Hello (224.0.0.5), tìm láng giềng (2-Way), bầu DR/BDR
// (ưu tiên Priority, hoà thì Router ID cao nhất), rồi đồng bộ LSDB (Full).

import { Sim } from '../engine/simulate.js';

const OSPF_MAC = '01:00:5e:00:00:05';
const R1 = { id: 'r1', mac: '00:00:00:00:00:a1', ip: '10.0.0.1', rid: '1.1.1.1' };
const R2 = { id: 'r2', mac: '00:00:00:00:00:a2', ip: '10.0.0.2', rid: '2.2.2.2' };
const R3 = { id: 'r3', mac: '00:00:00:00:00:a3', ip: '10.0.0.3', rid: '3.3.3.3' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-14_OSPF.md',
  label: 'Bài 14 — OSPF',
};

export const meta = {
  id: 's07-ospf-adjacency',
  titleVi: 'OSPF: Hello, DR/BDR, Adjacency',
  titleEn: 'OSPF Hello & DR/BDR',
  descriptionVi: '3 router OSPF chung một LAN: gửi Hello, phát hiện láng giềng, bầu DR/BDR, đồng bộ LSDB.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'r1', type: 'router', name: 'R1', x: 180, y: 90, lines: ['RID 1.1.1.1', '10.0.0.1'] },
      { id: 'r2', type: 'router', name: 'R2', x: 500, y: 90, lines: ['RID 2.2.2.2', '10.0.0.2'] },
      { id: 'r3', type: 'router', name: 'R3', x: 820, y: 90, lines: ['RID 3.3.3.3', '10.0.0.3'] },
      { id: 'sw', type: 'switch', name: 'SW', x: 500, y: 270, lines: ['LAN 10.0.0.0/24'] },
    ],
    links: [
      { id: 'l1', a: 'r1', b: 'sw' },
      { id: 'l2', a: 'r2', b: 'sw' },
      { id: 'l3', a: 'r3', b: 'sw' },
    ],
  };

  const sim = new Sim(topology);

  const hello = (r, opts = {}) => sim.frame([
    { proto: 'ethernet', fields: { dst: OSPF_MAC, src: r.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: r.ip, dst: '224.0.0.5', ttl: 1, id: 0, protocol: 89 } },
    { proto: 'ospf', fields: {
      type: 1, routerId: r.rid, areaId: '0.0.0.0',
      netmask: '255.255.255.0', helloInterval: 10, priority: 1, deadInterval: 40,
      dr: opts.dr ?? '0.0.0.0', bdr: opts.bdr ?? '0.0.0.0', neighbors: opts.neighbors ?? [],
    } },
  ]);

  const elected = { badges: { r3: 'DR', r2: 'BDR', r1: 'DROther' } };

  // 1. Khởi động
  sim.emit({
    kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Bật OSPF: ai cũng phát Hello ra 224.0.0.5',
    explanationVi:
      'Mỗi router gửi gói Hello (OSPF chạy trực tiếp trên IP, protocol 89) tới multicast 224.0.0.5, TTL = 1 (không ra khỏi mạng). ' +
      'Để thành láng giềng, các tham số phải KHỚP: Area, Hello/Dead Interval, Network Mask, xác thực.',
    lesson: LESSON,
  });

  // 2. R1 gửi Hello đầu tiên (chưa biết ai)
  const h1 = hello(R1);
  sim.capture(h1, 'OSPF Hello từ R1 (chưa có neighbor)');
  sim.emit({
    kind: 'transit', fromDevice: 'r1', toDevice: 'sw', side: 'encap', activeLayer: 3,
    titleVi: 'R1 gửi Hello (danh sách Neighbor rỗng)',
    packet: h1,
    explanationVi: 'Hello của R1: Router ID 1.1.1.1, DR/BDR = 0.0.0.0 (chưa bầu), chưa thấy ai → chưa có Neighbor.',
    lesson: LESSON,
  });

  // 3. R3 đã nghe R1, R2 -> Hello liệt kê neighbor (2-Way)
  const h3 = hello(R3, { neighbors: [R1.rid, R2.rid] });
  sim.capture(h3, 'OSPF Hello từ R3 (đã thấy R1, R2)');
  sim.emit({
    kind: 'transit', fromDevice: 'r3', toDevice: 'sw', side: 'encap', activeLayer: 3,
    titleVi: 'R3 Hello có liệt kê R1 & R2 → trạng thái 2-Way',
    packet: h3,
    explanationVi:
      'R3 đã nghe Hello của R1 và R2 nên trong Hello của nó có trường Neighbor = 1.1.1.1, 2.2.2.2. ' +
      'Khi một router THẤY chính RID của mình trong Hello của người khác → đạt 2-Way (nhận ra nhau).',
    lesson: LESSON,
  });

  // 4. Bầu DR/BDR
  sim.emit({
    kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Bầu DR/BDR: Priority bằng nhau → Router ID cao nhất',
    packet: h3,
    overlay: elected,
    explanationVi:
      'Trên đoạn multi-access phải bầu DR (và BDR) để giảm số adjacency. Xét Priority trước (cao hơn thắng; 0 = không ứng cử). ' +
      'Ở đây Priority đều = 1 → so Router ID: R3 (3.3.3.3) cao nhất → DR; R2 (2.2.2.2) → BDR; R1 → DROther. ' +
      '(Lưu ý: DR/BDR KHÔNG ưu tiên (preempt) — ai lên trước giữ vai trò.)',
    lesson: LESSON,
  });

  // 5. Full adjacency
  sim.emit({
    kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Đồng bộ LSDB với DR/BDR → Full',
    overlay: elected,
    explanationVi:
      'DROther chỉ lập adjacency ĐẦY ĐỦ với DR và BDR (gửi tới 224.0.0.6 = AllDRouters). Trình tự: ' +
      'ExStart → trao DBD (mô tả LSDB) → LSR (xin LSA thiếu) → LSU (gửi LSA) → Loading → FULL. ' +
      '(Đơn giản hóa: app mô tả các bước này bằng lời, gói Hello ở trên là byte thật.)',
    lesson: LESSON,
  });

  // 6. Converged
  sim.emit({
    kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Hội tụ: mọi router cùng LSDB, chạy SPF',
    overlay: elected,
    explanationVi:
      'Khi tất cả FULL, mọi router có LSDB giống nhau, chạy thuật toán Dijkstra (SPF) để tính đường ngắn nhất và nạp vào bảng định tuyến. ' +
      'Cost mặc định = 10^8 / băng thông (vd 100M = 1, 10M = 10).',
    lesson: LESSON,
  });

  return sim.result();
}
