// scenarios/s39-bfd.js
// Kịch bản 39 (ENARSI 1.8): BFD phát hiện đứt đường trong vài trăm mili giây.
// Bắt tay 3 trạng thái rồi đo: mất 3 gói 50 ms thì báo cho OSPF, không chờ Dead 40 giây.

import { Sim } from '../engine/simulate.js';

const R1 = { mac: '00:1a:2b:00:39:01', ip: '10.0.12.1' };
const R2 = { mac: '00:1a:2b:00:39:02', ip: '10.0.12.2' };
const DOWN = 1, INIT = 2, UP = 3;

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Định tuyến (BFD: ENARSI 1.8)',
};

export const meta = {
  id: 's39-bfd',
  titleVi: 'BFD: phát hiện đứt đường nhanh hơn Hello',
  titleEn: 'BFD: fast failure detection',
  descriptionVi: 'Hai router lên phiên BFD qua 3 trạng thái, gửi gói mỗi 50 ms. Khi đoạn bên kia switch đứt, BFD báo cho OSPF sau 150 ms thay vì 40 giây.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 900 240',
    devices: [
      { id: 'r1', type: 'router', name: 'R1', x: 130, y: 110, lines: ['10.0.12.1'] },
      { id: 'sw', type: 'switch', name: 'SW', x: 450, y: 110, lines: ['L2 ở giữa'] },
      { id: 'r2', type: 'router', name: 'R2', x: 770, y: 110, lines: ['10.0.12.2'] },
    ],
    links: [
      { id: 'l1', a: 'r1', b: 'sw', ap: 'Gi0/0', bp: 'Gi0/1' },
      { id: 'l2', a: 'sw', b: 'r2', ap: 'Gi0/2', bp: 'Gi0/0' },
    ],
  };
  const sim = new Sim(topology);

  const pkt = (from, to, state, myDisc, yourDisc, diag = 0) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: from.ip, dst: to.ip, ttl: 255, id: 0x3900, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 49152, dstPort: 3784 } },
    { proto: 'bfd', fields: { state, diag, myDisc, yourDisc, tx: 50000, rx: 50000, mult: 3 } },
  ]);
  const sess = (state) => ({ list: { title: 'Phiên BFD R1', cols: ['Láng giềng', 'Trạng thái', 'Khách', 'Phát hiện'], rows: [[R2.ip, state, 'OSPF', '150 ms']] } });

  const a = pkt(R1, R2, DOWN, 1, 0);
  sim.capture(a, 'BFD Down (R1)');
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'encap', activeLayer: 5,
    titleVi: 'OSPF đăng ký dùng BFD, R1 gửi trạng thái Down', packet: a, tables: sess('Down'),
    explanationVi: 'BFD không tự tìm láng giềng. OSPF, EIGRP hay BGP báo cho nó biết cần theo dõi ai. Cấu hình: bfd interval 50 min_rx 50 multiplier 3 và ip ospf bfd. Your Discriminator bằng 0 vì chưa biết bên kia.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'sw', side: 'forward', activeLayer: 5,
    titleVi: 'Gói đi UDP 3784 qua switch', packet: a,
    overlay: { links: { l1: { cls: 'trunk', label: 'Down' }, l2: { cls: 'trunk', label: 'Down' } } },
    explanationVi: 'TTL phải là 255 với BFD một chặng, để chống gói giả từ mạng khác.' });
  const b = pkt(R2, R1, INIT, 2, 1);
  sim.capture(b, 'BFD Init (R2)');
  sim.emit({ kind: 'transit', fromDevice: 'r2', toDevice: 'sw', side: 'forward', activeLayer: 5,
    titleVi: 'R2 đáp Init: đã thấy R1', packet: b,
    overlay: { links: { l2: { cls: 'trunk', label: 'Init' }, l1: { cls: 'trunk', label: 'Init' } } },
    explanationVi: 'R2 chép mã phiên của R1 vào Your Discriminator. Từ đây hai bên dùng mã này để nhận ra phiên.' });
  const c = pkt(R1, R2, UP, 1, 2);
  sim.capture(c, 'BFD Up');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'sw', side: 'forward', activeLayer: 5,
    titleVi: 'R1 chuyển Up, R2 cũng Up khi nhận gói này', packet: c, tables: sess('Up'),
    overlay: { links: { l1: { cls: 'forwarding', label: 'Up, 50 ms' }, l2: { cls: 'forwarding', label: 'Up, 50 ms' } } },
    explanationVi: 'Thời gian phát hiện bằng hệ số nhân của bên kia nhân với khoảng thời gian đã thương lượng: 3 × 50 ms = 150 ms. Gói BFD xử lý ở lớp thấp nên chịu được chu kỳ ngắn.', lesson: LESSON });

  const lost = pkt(R1, R2, UP, 1, 2);
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'sw', side: 'forward', activeLayer: 5,
    titleVi: 'Cáp SW đến R2 đứt: cổng của R1 vẫn up', packet: lost,
    overlay: { links: { l1: { label: 'cổng vẫn up' }, l2: { label: '✗ đứt' } } },
    explanationVi: 'Có switch ở giữa nên R1 không thấy mất tín hiệu. Không có BFD, OSPF phải chờ hết Dead 40 giây. Lưu lượng trong 40 giây đó đi vào chỗ đứt.', lesson: LESSON });
  const d = pkt(R1, R2, DOWN, 1, 2, 1);
  sim.capture(d, 'BFD Down, diag 1');
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'forward', activeLayer: 5,
    titleVi: '✓ Sau 150 ms không nhận gói, BFD báo OSPF', packet: d, tables: sess('Down (diag 1)'),
    overlay: { links: { l2: { label: '✗ đứt' } } },
    explanationVi: 'Diag 1 là Control Detection Time Expired. OSPF bỏ láng giềng ngay và chạy lại SPF. Chế độ echo gửi gói để bên kia quay lại, giúp kiểm tra cả đường chuyển tiếp với chu kỳ nhanh hơn. BFD không sửa lỗi, nó chỉ báo tin cho giao thức định tuyến.', lesson: LESSON });

  return sim.result();
}
