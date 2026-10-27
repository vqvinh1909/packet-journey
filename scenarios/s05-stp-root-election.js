// scenarios/s05-stp-root-election.js
// Kịch bản 5 (CCNA Switching): STP bầu Root Bridge & vai trò cổng.
// 3 switch nối thành vòng (loop) → STP chặn 1 cổng để tránh bão broadcast.
// Dạy: so sánh Bridge ID (Priority rồi MAC), Root Port (cost nhỏ nhất về root),
// Designated Port trên mỗi đoạn, cổng còn lại bị Blocking.

import { Sim } from '../engine/simulate.js';

const BPDU_MAC = '01:80:c2:00:00:00';
const SW1 = { id: 'sw1', mac: '00:00:0c:aa:00:01', prio: 4096 };  // ưu tiên thấp nhất → root
const SW2 = { id: 'sw2', mac: '00:00:0c:aa:00:02', prio: 32768 };
const SW3 = { id: 'sw3', mac: '00:00:0c:aa:00:03', prio: 32768 };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-10_STP-va-EtherChannel.md',
  label: 'Bài 10 — STP và EtherChannel',
};

export const meta = {
  id: 's05-stp-root-election',
  titleVi: 'STP bầu Root & chặn loop',
  titleEn: 'STP root election',
  descriptionVi: '3 switch nối vòng. STP bầu Root Bridge, chọn Root Port/Designated Port, và chặn 1 cổng để mạng không có vòng lặp.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'sw1', type: 'switch', name: 'SW1', x: 500, y: 80, lines: ['Priority 4096', SW1.mac] },
      { id: 'sw2', type: 'switch', name: 'SW2', x: 260, y: 270, lines: ['Priority 32768', SW2.mac] },
      { id: 'sw3', type: 'switch', name: 'SW3', x: 740, y: 270, lines: ['Priority 32768', SW3.mac] },
    ],
    links: [
      { id: 'a', a: 'sw1', b: 'sw2', labelMid: 'cost 19' },
      { id: 'b', a: 'sw1', b: 'sw3', labelMid: 'cost 19' },
      { id: 'c', a: 'sw2', b: 'sw3', labelMid: 'cost 19' },
    ],
  };

  const sim = new Sim(topology);

  const bpdu = ({ src, rootPrio, rootMac, cost, bridgePrio, bridgeMac, port }) =>
    sim.frame([
      { proto: 'ethernet', fields: { dst: BPDU_MAC, src, mode: '802.3' } },
      { proto: 'llc', fields: {} },
      { proto: 'stp', fields: {
        version: 0, type: 0, flags: 0,
        rootPriority: rootPrio, rootSysId: 0, rootMac,
        rootPathCost: cost,
        bridgePriority: bridgePrio, bridgeSysId: 0, bridgeMac,
        portPriority: 128, portNumber: port,
        msgAge: 0, maxAge: 20, hello: 2, fwdDelay: 15,
      } },
    ]);

  const converged = {
    links: {
      a: { cls: 'root-path', label: 'SW1:DP — SW2:RP ✓' },
      b: { cls: 'root-path', label: 'SW1:DP — SW3:RP ✓' },
      c: { cls: 'blocking', label: 'SW2:DP — SW3:BLOCK ✗' },
    },
    badges: { sw1: '★ ROOT' },
  };

  // 1. Khởi động: ai cũng tự xưng root
  sim.emit({
    kind: 'process', side: 'inspect', activeLayer: 2,
    titleVi: 'Mới bật: switch nào cũng tự nhận là Root',
    explanationVi:
      'Khi mới lên, mỗi switch gửi BPDU 2 giây/lần, khai Root ID = chính nó. Root ID = Priority (bội 4096) + Sys-ID-ext + MAC. ' +
      'Switch sẽ chọn Root Bridge là bridge có Root ID NHỎ NHẤT. SW1 được đặt Priority 4096 (thấp nhất).',
    lesson: LESSON,
  });

  // 2. SW1 phát BPDU xuống SW2
  const b1to2 = bpdu({ src: SW1.mac, rootPrio: SW1.prio, rootMac: SW1.mac, cost: 0, bridgePrio: SW1.prio, bridgeMac: SW1.mac, port: 1 });
  sim.capture(b1to2, 'BPDU từ SW1 (Root=SW1) → SW2');
  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'sw2', side: 'encap', activeLayer: 2,
    titleVi: 'SW1 gửi BPDU (Root = SW1, cost 0)',
    packet: b1to2,
    explanationVi: 'BPDU đi trong khung 802.3 (Length thay cho EtherType) + LLC (DSAP/SSAP 0x42) tới multicast 01:80:c2:00:00:00. Root Path Cost = 0 vì SW1 nghĩ nó là root.',
    lesson: LESSON,
  });

  // 3. SW2 so sánh -> nhận SW1 làm root
  sim.emit({
    kind: 'process', atDevice: 'sw2', side: 'inspect', activeLayer: 2,
    titleVi: 'SW2: Root ID của SW1 nhỏ hơn → nhận SW1 làm Root',
    packet: b1to2,
    overlay: { links: { a: { cls: 'root-path', label: 'SW2:RP' } }, badges: { sw1: '★ ROOT' } },
    explanationVi:
      'SW2 so Root ID trong BPDU (4096 + SW1) với root hiện tại của mình (32768 + SW2): 4096 < 32768 → SW1 tốt hơn. ' +
      'SW2 nhận SW1 làm Root; cổng hướng về SW1 (cost 19 nhỏ nhất về root) trở thành ROOT PORT.',
    lesson: LESSON,
  });

  // 4-5. SW1 -> SW3
  const b1to3 = bpdu({ src: SW1.mac, rootPrio: SW1.prio, rootMac: SW1.mac, cost: 0, bridgePrio: SW1.prio, bridgeMac: SW1.mac, port: 2 });
  sim.capture(b1to3, 'BPDU từ SW1 (Root=SW1) → SW3');
  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'sw3', side: 'encap', activeLayer: 2,
    titleVi: 'SW1 gửi BPDU sang SW3',
    packet: b1to3,
    overlay: { links: { a: { cls: 'root-path', label: 'SW2:RP' } }, badges: { sw1: '★ ROOT' } },
    explanationVi: 'Tương tự, SW3 cũng nhận được BPDU gốc từ SW1.',
  });
  sim.emit({
    kind: 'process', atDevice: 'sw3', side: 'inspect', activeLayer: 2,
    titleVi: 'SW3 nhận SW1 làm Root → cổng về SW1 là Root Port',
    packet: b1to3,
    overlay: { links: { a: { cls: 'root-path', label: 'SW2:RP' }, b: { cls: 'root-path', label: 'SW3:RP' } }, badges: { sw1: '★ ROOT' } },
    explanationVi: 'SW3 cũng thấy 4096 < 32768 → SW1 là Root; cổng về SW1 (cost 19) là Root Port.',
    lesson: LESSON,
  });

  // 6. SW2 <-> SW3 trao BPDU trên đoạn c
  const b2to3 = bpdu({ src: SW2.mac, rootPrio: SW1.prio, rootMac: SW1.mac, cost: 19, bridgePrio: SW2.prio, bridgeMac: SW2.mac, port: 2 });
  sim.capture(b2to3, 'BPDU từ SW2 (Root=SW1, cost 19) → SW3');
  sim.emit({
    kind: 'transit', fromDevice: 'sw2', toDevice: 'sw3', side: 'encap', activeLayer: 2,
    titleVi: 'SW2 và SW3 trao BPDU trên đoạn giữa',
    packet: b2to3,
    overlay: { links: { a: { cls: 'root-path' }, b: { cls: 'root-path' }, c: { cls: '', label: 'ai là Designated?' } }, badges: { sw1: '★ ROOT' } },
    explanationVi:
      'Trên đoạn SW2–SW3, cả hai giờ đều quảng bá Root = SW1 với Root Path Cost = 19 (đều cách root 1 chặng). ' +
      'Phải chọn 1 Designated Port cho đoạn này; cổng còn lại sẽ bị chặn.',
  });

  // 7. Quyết định Designated / Blocking
  sim.emit({
    kind: 'process', atDevice: 'sw3', side: 'inspect', activeLayer: 2,
    titleVi: 'Cost bằng nhau → Bridge ID nhỏ hơn (SW2) thắng',
    packet: b2to3,
    overlay: converged,
    changedFields: [],
    explanationVi:
      'So sánh để chọn Designated trên đoạn SW2–SW3: Root Path Cost bằng nhau (19 = 19) → xét Bridge ID: ' +
      'SW2 (32768 + MAC …02) < SW3 (32768 + MAC …03) → SW2 có Designated Port (Forwarding). ' +
      'Cổng của SW3 trên đoạn này thành Non-Designated → BLOCKING (chặn) để phá vòng lặp.',
    lesson: LESSON,
  });

  // 8. Hội tụ
  sim.emit({
    kind: 'process', side: 'inspect', activeLayer: 2,
    titleVi: 'Hội tụ: cây không vòng lặp',
    overlay: converged,
    explanationVi:
      'Kết quả: Root = SW1 (mọi cổng Designated/Forwarding). SW2 & SW3 mỗi switch 1 Root Port về SW1. ' +
      'Đoạn SW2–SW3: SW2 Forwarding, SW3 Blocking. Vòng vật lý vẫn còn nhưng logic đã là cây — không bão broadcast. ' +
      '(Đơn giản hóa: không mô phỏng timer Listening/Learning 15s hay RSTP.)',
    lesson: LESSON,
  });

  return sim.result();
}
