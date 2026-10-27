// scenarios/s23-vlan-mismatch.js
// Kịch bản 23 (Sửa lỗi): cổng access bị gán SAI VLAN.
// PC1 và PC2 cùng dải 192.168.1.0/24 nhưng cổng PC1 bị để VLAN 20, PC2 ở VLAN 10
// → khác broadcast domain → ARP không tới nhau → ping hỏng dù "cùng mạng IP".

import { Sim } from '../engine/simulate.js';
import { MacTable } from '../engine/tables.js';
import { arpFrame, ARP_OP, BROADCAST_MAC } from './_common.js';

const PC1 = { mac: '00:1a:2b:00:00:10', ip: '192.168.1.10' };
const PC2 = { mac: '00:1a:2b:00:00:20', ip: '192.168.1.20' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-08_Cau-hinh-va-quan-ly-VLAN.md',
  label: 'Bài 08 — VLAN',
};

export const meta = {
  id: 's23-vlan-mismatch',
  titleVi: '🔧 Sửa lỗi: sai VLAN cổng access',
  titleEn: 'Troubleshoot: VLAN mismatch',
  descriptionVi: 'PC1 & PC2 cùng dải IP nhưng cổng PC1 bị gán nhầm VLAN 20 (PC2 ở VLAN 10). Đoán vì sao ping hỏng.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'pc1', type: 'host', name: 'PC1', x: 180, y: 150, color: '#a0433a', lines: ['192.168.1.10', 'cổng = VLAN 20 ✗'] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 500, y: 150, lines: ['Fa0/1=VLAN20', 'Fa0/2=VLAN10'] },
      { id: 'pc2', type: 'host', name: 'PC2', x: 820, y: 150, color: '#2c5f8a', lines: ['192.168.1.20', 'cổng = VLAN 10'] },
    ],
    links: [{ id: 'l1', a: 'pc1', b: 'sw' }, { id: 'l2', a: 'sw', b: 'pc2' }],
  };

  const sim = new Sim(topology);
  const swmac = new MacTable();

  sim.emit({ kind: 'process', atDevice: 'pc1', side: 'inspect', activeLayer: 3,
    titleVi: 'PC1 ping PC2 — cùng dải 192.168.1.0/24',
    decision: {
      question: 'Hai PC cùng subnet IP, nhưng cổng PC1 ở VLAN 20 còn PC2 ở VLAN 10. Kết quả ping?',
      options: ['Vẫn OK vì cùng subnet', 'Hỏng — khác VLAN là khác broadcast domain', 'Chỉ chậm', 'OK sau khi ARP timeout'],
      correct: 1,
      explainVi: 'Cùng subnet IP không đủ; khác VLAN thì broadcast (ARP) không vượt qua được.',
    },
    explanationVi: 'PC1 thấy PC2 cùng mạng /24 → định gửi trực tiếp, phát ARP hỏi MAC PC2.',
    lesson: LESSON });

  const arpReq = sim.frame(arpFrame({ op: ARP_OP.REQUEST, senderMac: PC1.mac, senderIp: PC1.ip, targetMac: '00:00:00:00:00:00', targetIp: PC2.ip, ethDst: BROADCAST_MAC }));
  sim.capture(arpReq, 'ARP Request (vào VLAN 20)');
  swmac.learn(PC1.mac, 'Fa0/1 (VLAN20)');
  sim.emit({ kind: 'transit', fromDevice: 'pc1', toDevice: 'sw', side: 'encap', activeLayer: 2,
    titleVi: 'ARP Request vào cổng Fa0/1 — thuộc VLAN 20', packet: arpReq,
    explanationVi: 'Switch nhận khung ở Fa0/1 và gắn nó vào VLAN 20 (theo cấu hình cổng).', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'forward', activeLayer: 2,
    titleVi: 'Switch flood CHỈ trong VLAN 20 → PC2 (VLAN10) không nhận',
    packet: arpReq,
    overlay: { links: { l1: { cls: 'blocking', label: 'VLAN20' }, l2: { cls: 'blocking', label: 'VLAN10 ✗ không nhận' } } },
    tables: { mac: { title: 'MAC table SW1', rows: swmac.snapshot() } },
    explanationVi: 'Broadcast chỉ lan trong VLAN 20. Cổng Fa0/2 (PC2) thuộc VLAN 10 nên switch KHÔNG đẩy ra → PC2 không bao giờ thấy ARP.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'pc1', side: 'inspect', activeLayer: 3,
    titleVi: 'Không có Reply → ping hỏng',
    decision: {
      question: 'Khắc phục đúng là gì?',
      options: ['Đổi IP PC1', 'Gán cổng Fa0/1 về đúng VLAN 10', 'Tắt STP', 'Thêm NAT'],
      correct: 1,
      explainVi: 'Đưa cổng PC1 về VLAN 10 (switchport access vlan 10). Nếu THỰC SỰ muốn 2 VLAN liên lạc thì cần inter-VLAN routing.',
    },
    explanationVi: 'PC1 không nhận ARP Reply → ping thất bại dù IP "cùng mạng". Đây là bẫy hay gặp: nhìn IP tưởng cùng mạng nhưng L2 đã bị tách bởi VLAN. ' +
      'KHẮC PHỤC: `interface Fa0/1 / switchport access vlan 10`.',
    lesson: LESSON });

  return sim.result();
}
