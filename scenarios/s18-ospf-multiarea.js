// scenarios/s18-ospf-multiarea.js
// Kịch bản 18 (CCNP): OSPF nhiều vùng (multi-area) + ABR + các loại LSA.
// R2 là ABR nối Area 0 (backbone) với Area 1. LSA Type 1/2 flood TRONG vùng;
// ABR sinh LSA Type 3 (Summary) để quảng bá liên vùng (inter-area).

import { Sim } from '../engine/simulate.js';

const OSPF_MAC = '01:00:5e:00:00:05';
const R1 = { id: 'r1', mac: '00:00:00:00:00:a1', ip: '10.0.0.1', rid: '1.1.1.1' };
const R2 = { id: 'r2', mac: '00:00:00:00:00:a2', ip: '10.0.0.2', ip1: '10.0.1.1', rid: '2.2.2.2' };
const R3 = { id: 'r3', mac: '00:00:00:00:00:a3', ip: '10.0.1.2', rid: '3.3.3.3' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-14_OSPF.md',
  label: 'Bài 14 — OSPF (multi-area: CCNP)',
};

export const meta = {
  id: 's18-ospf-multiarea',
  titleVi: 'OSPF multi-area & LSA',
  titleEn: 'OSPF multi-area',
  descriptionVi: 'R2 là ABR nối Area 0 và Area 1. Xem LSA Type 1/2 trong vùng và Type 3 Summary liên vùng; vì sao chia area.',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'r1', type: 'router', name: 'R1', x: 170, y: 150, color: '#2c5f8a', lines: ['RID 1.1.1.1', 'Area 0'] },
      { id: 'r2', type: 'router', name: 'R2', x: 500, y: 150, lines: ['RID 2.2.2.2', 'ABR'] },
      { id: 'r3', type: 'router', name: 'R3', x: 830, y: 150, color: '#c8611a', lines: ['RID 3.3.3.3', 'Area 1'] },
    ],
    links: [
      { id: 'a0', a: 'r1', b: 'r2', labelMid: 'Area 0 (backbone)' },
      { id: 'a1', a: 'r2', b: 'r3', labelMid: 'Area 1' },
    ],
  };

  const sim = new Sim(topology);
  const hello = (r, ip, area, neighbors = []) => sim.frame([
    { proto: 'ethernet', fields: { dst: OSPF_MAC, src: r.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: ip, dst: '224.0.0.5', ttl: 1, id: 0, protocol: 89 } },
    { proto: 'ospf', fields: { type: 1, routerId: r.rid, areaId: area, neighbors } },
  ]);

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Vì sao chia nhiều Area?',
    explanationVi: 'Mạng lớn mà 1 vùng → LSDB khổng lồ, SPF nặng, một link chớp tắt là cả mạng chạy lại SPF. Chia Area: LSA Type 1/2 chỉ flood TRONG vùng, ' +
      'biên giới giữa các vùng là ABR. Mọi Area phải nối với Area 0 (backbone).',
    lesson: LESSON });

  const h1 = hello(R1, R1.ip, '0.0.0.0');
  sim.capture(h1, 'OSPF Hello Area 0 (R1)');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'r2', side: 'encap', activeLayer: 3,
    titleVi: 'R1 ↔ R2: adjacency trong Area 0', packet: h1,
    overlay: { links: { a0: { cls: 'root-path', label: 'Area 0' } } },
    explanationVi: 'Hello mang Area ID = 0.0.0.0. R1 và R2 lập adjacency trong Area 0, trao LSA Type 1 (Router) và Type 2 (Network) → LSDB của Area 0.',
    lesson: LESSON });

  const h2 = hello(R2, R2.ip1, '0.0.0.1');
  sim.capture(h2, 'OSPF Hello Area 1 (R2)');
  sim.emit({ kind: 'transit', fromDevice: 'r2', toDevice: 'r3', side: 'encap', activeLayer: 3,
    titleVi: 'R2 ↔ R3: adjacency trong Area 1', packet: h2,
    overlay: { links: { a0: { cls: 'root-path', label: 'Area 0' }, a1: { cls: 'root-path', label: 'Area 1' } }, badges: { r2: 'ABR' } },
    explanationVi: 'Cổng kia của R2 thuộc Area 1 (Area ID = 0.0.0.1) → R2 có chân ở 2 vùng = ABR. R2 giữ LSDB RIÊNG cho mỗi vùng.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r2', side: 'inspect', activeLayer: 3,
    titleVi: 'ABR sinh LSA Type 3 (Summary) để nối vùng', packet: h2,
    overlay: { badges: { r2: 'ABR' } },
    explanationVi: 'ABR KHÔNG đẩy chi tiết LSDB vùng này sang vùng kia. Thay vào đó nó tạo LSA Type 3 (Summary) tóm tắt các mạng của Area 1 để quảng bá vào Area 0 (và ngược lại). ' +
      'Nhờ vậy R1 biết đường tới mạng của Area 1 mà không cần biết topo chi tiết bên đó.',
    lesson: LESSON });

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Các loại LSA chính',
    overlay: { badges: { r2: 'ABR' } },
    explanationVi: 'Type 1 Router-LSA và Type 2 Network-LSA: mô tả router/mạng TRONG một vùng (không rời vùng). ' +
      'Type 3 Summary: ABR quảng bá mạng liên vùng. Type 4: tới ASBR. Type 5: External (route redistribute từ giao thức khác, do ASBR sinh). ' +
      'Trên bảng định tuyến R1 sẽ thấy mạng Area 1 là tuyến "O IA" (inter-area).',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'Kết quả: R1 học mạng Area 1 qua ABR',
    overlay: { links: { a0: { cls: 'root-path' }, a1: { cls: 'root-path' } }, badges: { r2: 'ABR' } },
    explanationVi: 'R1 chạy SPF trong Area 0 (chi tiết), còn mạng bên Area 1 đến dưới dạng tuyến tóm tắt qua ABR. Chia vùng giúp mạng lớn hội tụ nhanh và ổn định hơn. ' +
      '(Đơn giản hóa: app mô tả trao đổi LSA bằng lời; gói Hello ở trên là byte thật.)',
    lesson: LESSON });

  return sim.result();
}
