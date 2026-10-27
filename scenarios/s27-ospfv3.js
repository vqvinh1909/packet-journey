// scenarios/s27-ospfv3.js
// Kịch bản 27 (CCNP): OSPFv3 — OSPF cho IPv6 (RFC 5340).
// Hello chạy trên IPv6 (Next Header 89), nguồn là LINK-LOCAL (fe80::), đích ff02::5.
// Khác v2: định danh cổng theo Interface ID, bỏ trường Authentication, thêm Instance ID.

import { Sim } from '../engine/simulate.js';

const OSPF6_MAC = '33:33:00:00:00:05'; // multicast MAC của ff02::5
const R1 = { id: 'r1', mac: '00:00:00:00:00:a1', ll: 'fe80::1', rid: '1.1.1.1' };
const R2 = { id: 'r2', mac: '00:00:00:00:00:a2', ll: 'fe80::2', rid: '2.2.2.2' };
const R3 = { id: 'r3', mac: '00:00:00:00:00:a3', ll: 'fe80::3', rid: '3.3.3.3' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-14_OSPF.md',
  label: 'Bài 14 — OSPF (OSPFv3: CCNP)',
};

export const meta = {
  id: 's27-ospfv3',
  titleVi: 'OSPFv3 (OSPF cho IPv6)',
  titleEn: 'OSPFv3',
  descriptionVi: '3 router chạy OSPFv3 trên IPv6: Hello dùng link-local → ff02::5, bầu DR/BDR theo Router ID. So khác với OSPFv2.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'r1', type: 'router', name: 'R1', x: 180, y: 90, lines: ['RID 1.1.1.1', 'fe80::1'] },
      { id: 'r2', type: 'router', name: 'R2', x: 500, y: 90, lines: ['RID 2.2.2.2', 'fe80::2'] },
      { id: 'r3', type: 'router', name: 'R3', x: 820, y: 90, lines: ['RID 3.3.3.3', 'fe80::3'] },
      { id: 'sw', type: 'switch', name: 'SW', x: 500, y: 270, lines: ['link IPv6'] },
    ],
    links: [{ id: 'l1', a: 'r1', b: 'sw' }, { id: 'l2', a: 'r2', b: 'sw' }, { id: 'l3', a: 'r3', b: 'sw' }],
  };
  const sim = new Sim(topology);
  const hello = (r, opts = {}) => sim.frame([
    { proto: 'ethernet', fields: { dst: OSPF6_MAC, src: r.mac, etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src: r.ll, dst: 'ff02::5', nextHeader: 89, hopLimit: 1 } },
    { proto: 'ospfv3', fields: { routerId: r.rid, areaId: '0.0.0.0', instanceId: 0, interfaceId: 1, priority: 1, dr: opts.dr, bdr: opts.bdr, neighbors: opts.neighbors } },
  ]);
  const elected = { badges: { r3: 'DR', r2: 'BDR', r1: 'DROther' } };

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'OSPFv3: chạy trên IPv6, Hello dùng link-local',
    explanationVi: 'OSPFv3 là OSPF cho IPv6: đóng trong IPv6 (Next Header 89), nguồn là địa chỉ LINK-LOCAL fe80::, đích ff02::5 (AllSPFRouters). Hop Limit = 1.',
    lesson: LESSON });

  const h1 = hello(R1);
  sim.capture(h1, 'OSPFv3 Hello từ R1');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'sw', side: 'encap', activeLayer: 3,
    titleVi: 'R1 gửi Hello (Router ID 1.1.1.1)', packet: h1,
    explanationVi: 'Để ý: header OSPFv3 có Instance ID, KHÔNG có trường Authentication (bảo mật dựa vào IPsec của IPv6). Checksum dùng pseudo-header IPv6.',
    lesson: LESSON });

  const h3 = hello(R3, { neighbors: [R1.rid, R2.rid] });
  sim.capture(h3, 'OSPFv3 Hello từ R3 (đã thấy R1,R2)');
  sim.emit({ kind: 'transit', fromDevice: 'r3', toDevice: 'sw', side: 'encap', activeLayer: 3,
    titleVi: 'R3 Hello liệt kê neighbor → 2-Way', packet: h3,
    explanationVi: 'Cơ chế láng giềng/2-Way giống OSPFv2. Router ID VẪN là số 32-bit (dạng IPv4) dù chạy trên IPv6.',
    lesson: LESSON });

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Bầu DR/BDR theo Router ID (Priority bằng nhau)',
    packet: h3, overlay: elected,
    explanationVi: 'Priority đều 1 → R3 (3.3.3.3) RID cao nhất = DR, R2 = BDR, R1 = DROther — giống v2.',
    lesson: LESSON });

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Khác biệt chính so với OSPFv2',
    overlay: elected,
    explanationVi: 'OSPFv3: (1) chạy per-LINK không per-subnet; (2) định danh cổng bằng Interface ID; (3) dùng link-local làm next-hop; ' +
      '(4) bỏ Auth (dùng IPsec); (5) thêm LSA mới: Type 8 Link-LSA và Type 9 Intra-Area-Prefix-LSA (tách thông tin prefix khỏi topo). ' +
      'SPF/quy trình adjacency thì giữ nguyên tinh thần v2.',
    lesson: LESSON });

  return sim.result();
}
