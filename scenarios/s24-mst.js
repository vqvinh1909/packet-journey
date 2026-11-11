// scenarios/s24-mst.js
// Kịch bản 24 (CCNP): MST (IEEE 802.1s) đầy đủ.
// Gom VLAN vào vài instance (MSTI). Một BPDU MST mang nhiều instance; mỗi instance có
// cây riêng (root khác nhau) → CÂN TẢI VLAN qua các link thay vì chặn cố định một cổng.

import { Sim } from '../engine/simulate.js';

const BPDU_MAC = '01:80:c2:00:00:00';
const SW1 = { id: 'sw1', mac: '00:00:0c:aa:00:01' };
const SW2 = { id: 'sw2', mac: '00:00:0c:aa:00:02' };
const SW3 = { id: 'sw3', mac: '00:00:0c:aa:00:03' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-10_STP-va-EtherChannel.md',
  label: 'Bài 10 — STP/MST',
};

export const meta = {
  id: 's24-mst',
  titleVi: 'MST: nhiều instance, cân tải',
  titleEn: 'MST regions & instances',
  descriptionVi: '3 switch cùng một MST region. VLAN gom vào MSTI 1 & MSTI 2 có root khác nhau → cân tải VLAN qua 2 đường.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'sw1', type: 'switch', name: 'SW1', x: 500, y: 80, lines: ['MSTI1 root'] },
      { id: 'sw2', type: 'switch', name: 'SW2', x: 260, y: 270, lines: ['MSTI2 root'] },
      { id: 'sw3', type: 'switch', name: 'SW3', x: 740, y: 270, lines: [] },
    ],
    links: [
      { id: 'a', a: 'sw1', b: 'sw2', labelMid: 'VLAN 10–40' },
      { id: 'b', a: 'sw1', b: 'sw3', labelMid: 'VLAN 10–40' },
      { id: 'c', a: 'sw2', b: 'sw3', labelMid: 'VLAN 10–40' },
    ],
  };
  const sim = new Sim(topology);

  const mstBpdu = sim.frame([
    { proto: 'ethernet', fields: { dst: BPDU_MAC, src: SW1.mac, mode: '802.3' } },
    { proto: 'llc', fields: {} },
    { proto: 'stp', fields: { version: 3, type: 2, flags: 0x7c, rootPriority: 4096, rootMac: SW1.mac, rootPathCost: 0, bridgePriority: 4096, bridgeMac: SW1.mac, portNumber: 1, maxAge: 20, hello: 2, fwdDelay: 15 } },
    { proto: 'mstp', fields: { regionName: 'CAMPUS', revision: 1, cistPrio: 4096, cistMac: SW1.mac,
      mstis: [
        { instance: 1, rootPrio: 4096, rootMac: SW1.mac, bridgePrio: 0x10 }, // SW1 là root MSTI 1: priority 4096
        { instance: 2, rootPrio: 4096, rootMac: SW2.mac, cost: 20000 }, // SW1 cách root MSTI 2 (SW2) một link 1G
      ] } },
  ]);

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 2,
    titleVi: 'Vì sao MST?',
    explanationVi: 'PVST+ chạy một cây STP cho MỖI VLAN → nhiều VLAN thì tốn CPU/BPDU. MST (802.1s) gom nhiều VLAN vào vài INSTANCE (MSTI). ' +
      'Các switch cùng REGION khi khớp cả 3: tên region, số revision, và digest (bảng ánh xạ VLAN→instance).',
    lesson: LESSON });

  sim.capture(mstBpdu, 'MST BPDU (version 3, 2 MSTI)');
  sim.emit({ kind: 'transit', fromDevice: 'sw1', toDevice: 'sw2', side: 'encap', activeLayer: 2,
    titleVi: 'MST BPDU (version 3) mang IST + 2 MSTI', packet: mstBpdu,
    overlay: { badges: { sw1: 'MSTI1 root' } },
    explanationVi: 'Một BPDU MST chứa phần CIST (IST) + các bản ghi MSTI. Nhìn phần mở rộng: Region Name=CAMPUS, Revision=1, Config Digest, rồi MSTI 1 và MSTI 2.',
    lesson: LESSON });

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 2,
    titleVi: 'MSTI 1 (VLAN 10,20): root = SW1 → chặn đoạn SW2–SW3',
    packet: mstBpdu,
    overlay: { links: { a: { cls: 'root-path', label: 'MSTI1' }, b: { cls: 'root-path', label: 'MSTI1' }, c: { cls: 'blocking', label: 'MSTI1: block' } }, badges: { sw1: 'MSTI1 root' } },
    explanationVi: 'Instance 1 (gán VLAN 10, 20) có root là SW1. Cây của nó dùng 2 link về SW1; cổng dư trên đoạn SW2–SW3 bị chặn.',
    lesson: LESSON });

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 2,
    titleVi: 'MSTI 2 (VLAN 30,40): root = SW2 → chặn đoạn KHÁC',
    packet: mstBpdu,
    overlay: { links: { a: { cls: 'root-path', label: 'MSTI2' }, c: { cls: 'root-path', label: 'MSTI2' }, b: { cls: 'blocking', label: 'MSTI2: block' } }, badges: { sw2: 'MSTI2 root' } },
    explanationVi: 'Instance 2 (VLAN 30, 40) có root là SW2 → cây khác, chặn cổng trên đoạn SW1–SW3. ' +
      'Kết quả: VLAN 10/20 đi một đường, VLAN 30/40 đi đường khác → CÂN TẢI thay vì để một link ngồi chơi.',
    lesson: LESSON });

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 2,
    titleVi: 'Tóm lại',
    explanationVi: 'MST = ít cây hơn (vài instance thay vì mỗi VLAN một cây) + cân tải + tương thích RSTP (hội tụ nhanh). ' +
      'Chỉ cần 3 thứ region khớp nhau; sai một thứ là switch rơi ra region khác và coi nhau như biên.',
    lesson: LESSON });

  return sim.result();
}
