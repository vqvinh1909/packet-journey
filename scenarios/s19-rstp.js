// scenarios/s19-rstp.js
// Kịch bản 19 (CCNP): RSTP (802.1w) — hội tụ nhanh.
// Khác STP: BPDU version 2 / type 2, vai trò cổng mới (Root/Designated/Alternate/Backup),
// trạng thái gộp (Discarding/Learning/Forwarding), và Proposal/Agreement chuyển Forwarding tức thì.

import { Sim } from '../engine/simulate.js';

const BPDU_MAC = '01:80:c2:00:00:00';
const SW1 = { id: 'sw1', mac: '00:00:0c:aa:00:01', prio: 4096 };
const SW2 = { id: 'sw2', mac: '00:00:0c:aa:00:02', prio: 32768 };
const SW3 = { id: 'sw3', mac: '00:00:0c:aa:00:03', prio: 32768 };

// Cờ RSTP: bit1 Proposal, bit2-3 Role(2=Root,3=Designated), bit4 Learning, bit5 Forwarding, bit6 Agreement
const F_DP_FWD = (3 << 2) | (1 << 4) | (1 << 5);     // Designated, Forwarding = 0x3C
const F_PROPOSAL = (1 << 1) | (3 << 2);               // Designated + Proposal = 0x0E
const F_AGREEMENT = (2 << 2) | (1 << 6);              // Root + Agreement = 0x48

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-10_STP-va-EtherChannel.md',
  label: 'Bài 10 — STP/RSTP',
};

export const meta = {
  id: 's19-rstp',
  titleVi: 'RSTP hội tụ nhanh',
  titleEn: 'RSTP fast convergence',
  descriptionVi: 'RSTP (802.1w): vai trò cổng mới (Alternate thay cho Blocking), Proposal/Agreement chuyển Forwarding dưới 1 giây.',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'sw1', type: 'switch', name: 'SW1', x: 500, y: 80, lines: ['Priority 4096', 'ROOT'] },
      { id: 'sw2', type: 'switch', name: 'SW2', x: 260, y: 270, lines: ['Priority 32768'] },
      { id: 'sw3', type: 'switch', name: 'SW3', x: 740, y: 270, lines: ['Priority 32768'] },
    ],
    links: [
      { id: 'a', a: 'sw1', b: 'sw2', labelMid: 'P2P' },
      { id: 'b', a: 'sw1', b: 'sw3', labelMid: 'P2P' },
      { id: 'c', a: 'sw2', b: 'sw3', labelMid: 'P2P' },
    ],
  };

  const sim = new Sim(topology);
  const rstp = ({ src, flags, cost, bridgePrio, bridgeMac, port }) => sim.frame([
    { proto: 'ethernet', fields: { dst: BPDU_MAC, src, mode: '802.3' } },
    { proto: 'llc', fields: {} },
    { proto: 'stp', fields: {
      version: 2, type: 2, flags, // version 2 = RSTP, type 2 = RST BPDU
      rootPriority: SW1.prio, rootSysId: 0, rootMac: SW1.mac, rootPathCost: cost,
      bridgePriority: bridgePrio, bridgeSysId: 0, bridgeMac, portPriority: 128, portNumber: port,
      msgAge: 0, maxAge: 20, hello: 2, fwdDelay: 15,
    } },
  ]);

  const converged = {
    links: {
      a: { cls: 'root-path', label: 'SW1:DP — SW2:RP' },
      b: { cls: 'root-path', label: 'SW1:DP — SW3:RP' },
      c: { cls: 'blocking', label: 'SW2:DP — SW3:ALT (discarding)' },
    },
    badges: { sw1: '★ ROOT' },
  };

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 2,
    titleVi: 'RSTP vs STP: nhanh hơn nhiều',
    explanationVi: 'RSTP (802.1w) tương thích STP nhưng hội tụ dưới 1 giây (STP mất 30–50s). Gộp 5 trạng thái STP thành 3: ' +
      'Discarding, Learning, Forwarding. Thêm vai trò Alternate (dự phòng Root Port) và Backup (dự phòng Designated).',
    lesson: LESSON });

  const b1 = rstp({ src: SW1.mac, flags: F_DP_FWD, cost: 0, bridgePrio: SW1.prio, bridgeMac: SW1.mac, port: 1 });
  sim.capture(b1, 'RST BPDU từ SW1 (version 2)');
  sim.emit({ kind: 'transit', fromDevice: 'sw1', toDevice: 'sw2', side: 'encap', activeLayer: 2,
    titleVi: 'RST BPDU (version 2, type 2)', packet: b1,
    overlay: { badges: { sw1: '★ ROOT' } },
    explanationVi: 'Mọi switch tự gửi BPDU mỗi Hello (2s), không chờ chuyển tiếp từ root như STP. Flags byte mang Vai trò cổng + Proposal/Agreement/Forwarding. SW1 (priority thấp nhất) là Root.',
    lesson: LESSON });

  const bp = rstp({ src: SW1.mac, flags: F_PROPOSAL, cost: 0, bridgePrio: SW1.prio, bridgeMac: SW1.mac, port: 2 });
  sim.capture(bp, 'RSTP Proposal');
  sim.emit({ kind: 'transit', fromDevice: 'sw1', toDevice: 'sw3', side: 'encap', activeLayer: 2,
    titleVi: 'Proposal: SW1 xin chuyển Forwarding ngay', packet: bp,
    overlay: { badges: { sw1: '★ ROOT' }, links: { b: { cls: 'trunk', label: 'Proposal →' } } },
    explanationVi: 'Trên link point-to-point, cổng Designated của SW1 gửi BPDU có bit Proposal = 1, đề nghị lên Forwarding tức thì.',
    lesson: LESSON });

  const ba = rstp({ src: SW3.mac, flags: F_AGREEMENT, cost: 4, bridgePrio: SW3.prio, bridgeMac: SW3.mac, port: 1 });
  sim.capture(ba, 'RSTP Agreement');
  sim.emit({ kind: 'transit', fromDevice: 'sw3', toDevice: 'sw1', side: 'decap', activeLayer: 2,
    titleVi: 'Agreement: SW3 đồng ý → Forwarding ngay (không chờ timer)', packet: ba,
    overlay: { badges: { sw1: '★ ROOT' }, links: { b: { cls: 'root-path', label: '← Agreement' } } },
    explanationVi: 'SW3 chặn tạm các cổng non-edge khác (sync) rồi trả BPDU bit Agreement = 1. Cổng về SW1 thành Root Port Forwarding NGAY — đây là lý do RSTP nhanh.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'sw3', side: 'inspect', activeLayer: 2,
    titleVi: 'Hội tụ: cổng SW3→SW2 là ALTERNATE (discarding)', packet: ba,
    overlay: converged,
    explanationVi: 'Thay vì "Blocking" như STP, cổng dư của SW3 có vai trò ALTERNATE: đang Discarding nhưng là backup của Root Port. ' +
      'Nếu Root Port (SW3→SW1) chết, Alternate lên Forwarding gần như tức thì (không chờ 30s).',
    lesson: LESSON });

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 2,
    titleVi: 'MST (802.1s): gom VLAN vào vài instance',
    overlay: converged,
    explanationVi: 'PVST+ chạy 1 cây STP mỗi VLAN → tốn CPU khi nhiều VLAN. MST gom nhiều VLAN vào vài "instance" (MSTI) trong một "region" chung ' +
      '(cùng tên region, số revision, bảng ánh xạ VLAN→instance). Ví dụ VLAN 1–500 → instance 1, 501–1000 → instance 2 để cân tải. (Đơn giản hóa: mô tả MST bằng lời.)',
    lesson: LESSON });

  return sim.result();
}
