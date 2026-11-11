// scenarios/s08-eigrp-dual.js
// Kịch bản 8 (CCNP Routing): EIGRP — láng giềng, Update, và DUAL (Successor /
// Feasible Successor). 3 router + 1 mạng đích; R1 học đường tới 192.168.9.0/24
// qua 2 hướng, chọn Successor (tốt nhất) và giữ Feasible Successor làm backup.

import { Sim } from '../engine/simulate.js';

const EIGRP_MAC = '01:00:5e:00:00:0a';
const R1 = { id: 'r1', mac: '00:00:00:00:00:b1', ip: '10.0.13.1' };
const R2 = { id: 'r2', mac: '00:00:00:00:00:b2', ip: '10.0.12.2' };
const R3 = { id: 'r3', mac: '00:00:00:00:00:b3', ip: '10.0.13.3' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-15_EIGRP.md',
  label: 'Bài 15 — EIGRP',
};

export const meta = {
  id: 's08-eigrp-dual',
  titleVi: 'EIGRP: láng giềng & DUAL',
  titleEn: 'EIGRP neighbors & DUAL',
  descriptionVi: 'EIGRP AS 100: Hello tìm láng giềng, Update trao route, DUAL chọn Successor + Feasible Successor (backup).',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'r1', type: 'router', name: 'R1', x: 160, y: 180, lines: ['EIGRP AS 100'] },
      { id: 'r2', type: 'router', name: 'R2', x: 500, y: 300, lines: ['EIGRP AS 100'] },
      { id: 'r3', type: 'router', name: 'R3', x: 620, y: 120, lines: ['EIGRP AS 100'] },
      { id: 'net', type: 'host', name: 'Net .9', x: 880, y: 120, color: '#2e7d5b', lines: ['192.168.9.0/24'] },
    ],
    links: [
      { id: 'r1r3', a: 'r1', b: 'r3', labelMid: 'cost 10' },
      { id: 'r1r2', a: 'r1', b: 'r2', labelMid: 'cost 20' },
      { id: 'r2r3', a: 'r2', b: 'r3', labelMid: 'cost 5' },
      { id: 'r3net', a: 'r3', b: 'net', bp: '', labelMid: 'cost 10' },
    ],
  };

  const sim = new Sim(topology);

  const hello = (r) => sim.frame([
    { proto: 'ethernet', fields: { dst: EIGRP_MAC, src: r.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: r.ip, dst: '224.0.0.10', ttl: 1, id: 0, protocol: 88 } },
    { proto: 'eigrp', fields: { opcode: 5, hello: true, asn: 100, k: [1, 0, 1, 0, 0, 0], hold: 15 } },
  ]);

  // 1. Hello
  sim.emit({
    kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Bật EIGRP AS 100: gửi Hello ra 224.0.0.10',
    explanationVi:
      'EIGRP chạy trực tiếp trên IP (protocol 88), gửi Hello tới multicast 224.0.0.10, TTL = 1. ' +
      'Để thành láng giềng phải KHỚP: số AS (100) và các K-values (mặc định K1=K3=1).',
    lesson: LESSON,
  });

  const h1 = hello(R1);
  sim.capture(h1, 'EIGRP Hello từ R1 (AS 100)');
  sim.emit({
    kind: 'transit', fromDevice: 'r1', toDevice: 'r3', side: 'encap', activeLayer: 3,
    titleVi: 'R1 gửi Hello (Opcode 5) + Parameters TLV',
    packet: h1,
    explanationVi: 'Gói Hello mang Parameters TLV: K1..K6 và Hold Time = 15s. R2, R3 nhận và kiểm AS/K-values.',
    lesson: LESSON,
  });

  // 2. Neighbor
  sim.emit({
    kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Khớp AS + K-values → thành láng giềng',
    overlay: { links: { r1r3: { cls: 'forwarding', label: 'neighbor' }, r1r2: { cls: 'forwarding', label: 'neighbor' }, r2r3: { cls: 'forwarding', label: 'neighbor' } } },
    explanationVi: 'R1↔R2, R1↔R3, R2↔R3 lập quan hệ láng giềng (ghi vào Neighbor Table). Sau đó mới trao đổi route.',
    lesson: LESSON,
  });

  // 3. Update
  const upd = sim.frame([
    { proto: 'ethernet', fields: { dst: EIGRP_MAC, src: R3.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: R3.ip, dst: '224.0.0.10', ttl: 1, id: 0, protocol: 88 } },
    { proto: 'eigrp', fields: { opcode: 1, asn: 100, flags: 0x00000001, sequence: 10, ack: 0 } },
  ]);
  sim.capture(upd, 'EIGRP Update từ R3 (route 192.168.9.0/24)');
  sim.emit({
    kind: 'transit', fromDevice: 'r3', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'R3 gửi Update: có mạng 192.168.9.0/24',
    packet: upd,
    explanationVi:
      'R3 quảng bá mạng 192.168.9.0/24 bằng gói Update (Opcode 1), gửi TIN CẬY qua RTP (có Sequence, bên nhận phải ACK). ' +
      'R1 nhận route từ R3 (R3 báo khoảng cách 10) và cả từ R2 (R2 báo 15 = link R2–R3 5 + 10).',
    lesson: LESSON,
  });

  // 4. DUAL: chọn Successor + Feasible Successor
  sim.emit({
    kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'DUAL: chọn Successor và Feasible Successor',
    overlay: {
      links: {
        r1r3: { cls: 'root-path', label: 'SUCCESSOR (FD 20)' },
        r1r2: { cls: 'blocking', label: 'Feasible Succ (backup)' },
        r2r3: { cls: '' },
        r3net: { cls: 'forwarding' },
      },
      badges: { net: '192.168.9.0/24' },
    },
    explanationVi:
      'R1 tính Feasible Distance (FD) tới 192.168.9.0/24: ' +
      'qua R3 = link 10 + RD 10 = 20 (nhỏ nhất) → SUCCESSOR, nạp vào bảng định tuyến. Qua R2 = link 20 + RD 15 = 35. ' +
      'Reported Distance của R2 = 15 (khoảng cách R2→đích). Điều kiện khả thi (FC): RD < FD của Successor → 15 < 20 → ĐÚNG ' +
      '→ đường qua R2 là FEASIBLE SUCCESSOR (backup không gây loop).',
    lesson: LESSON,
  });

  // 5. Converged + lợi ích FS
  sim.emit({
    kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'Mất Successor? Có FS thì chuyển TỨC THÌ',
    overlay: {
      links: {
        r1r3: { cls: 'blocking', label: 'DOWN ✗' },
        r1r2: { cls: 'root-path', label: 'FS → Successor mới' },
        r2r3: { cls: 'forwarding' },
        r3net: { cls: 'forwarding' },
      },
    },
    explanationVi:
      'Nếu link R1–R3 chết: vì đã có Feasible Successor (qua R2) thỏa FC, DUAL chuyển sang nó NGAY mà không cần hỏi lại ai → hội tụ cực nhanh. ' +
      'Nếu KHÔNG có FS, route vào trạng thái Active và R1 gửi Query đi tìm — đó là lúc EIGRP chậm. ' +
      '(Đơn giản hóa: metric dùng số minh họa thay cho công thức 256·(K1·BW + K3·Delay).)',
    lesson: LESSON,
  });

  return sim.result();
}
