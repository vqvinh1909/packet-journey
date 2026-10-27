// scenarios/s03-vlan-segmentation.js
// Kịch bản 3 (CCNA Switching): VLAN chia miền quảng bá (broadcast domain).
// PC1 ping PC2 trong VLAN 10 → switch chỉ FLOOD broadcast trong cổng cùng VLAN;
// PC3/PC4 (VLAN 20) KHÔNG nhận. Muốn VLAN10 ↔ VLAN20 phải có inter-VLAN routing.

import { Sim } from '../engine/simulate.js';
import { MacTable, ArpCache } from '../engine/tables.js';
import { arpFrame, echoFrame, ARP_OP, ICMP_TYPE, BROADCAST_MAC } from './_common.js';

const C10 = '#2c5f8a'; // màu VLAN 10
const C20 = '#c8611a'; // màu VLAN 20

const PC1 = { mac: '00:10:10:00:00:01', ip: '192.168.10.1' };
const PC2 = { mac: '00:10:10:00:00:02', ip: '192.168.10.2' };
const PC3 = { mac: '00:20:20:00:00:03', ip: '192.168.20.3' };
const PC4 = { mac: '00:20:20:00:00:04', ip: '192.168.20.4' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-08_Cau-hinh-va-quan-ly-VLAN.md',
  label: 'Bài 08 — Cấu hình & quản lý VLAN',
};

export const meta = {
  id: 's03-vlan-segmentation',
  titleVi: 'VLAN chia miền quảng bá',
  titleEn: 'VLAN broadcast segmentation',
  descriptionVi: 'Một switch, 4 PC: VLAN 10 (xanh) và VLAN 20 (cam). Broadcast chỉ lan trong cùng VLAN.',
  difficulty: 2,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'sw1', type: 'switch', name: 'SW1', x: 500, y: 80, lines: ['VLAN 10 + VLAN 20'] },
      { id: 'pc1', type: 'host', name: 'PC1', x: 170, y: 250, color: C10, lines: ['192.168.10.1', 'VLAN 10'] },
      { id: 'pc2', type: 'host', name: 'PC2', x: 390, y: 250, color: C10, lines: ['192.168.10.2', 'VLAN 10'] },
      { id: 'pc3', type: 'host', name: 'PC3', x: 610, y: 250, color: C20, lines: ['192.168.20.3', 'VLAN 20'] },
      { id: 'pc4', type: 'host', name: 'PC4', x: 830, y: 250, color: C20, lines: ['192.168.20.4', 'VLAN 20'] },
    ],
    links: [
      { id: 'l1', a: 'sw1', b: 'pc1' },
      { id: 'l2', a: 'sw1', b: 'pc2' },
      { id: 'l3', a: 'sw1', b: 'pc3' },
      { id: 'l4', a: 'sw1', b: 'pc4' },
    ],
  };

  const sim = new Sim(topology);
  const swmac = new MacTable();
  const pc1arp = new ArpCache();
  const pc2arp = new ArpCache();

  // Lớp phủ nhấn mạnh ranh giới VLAN khi flood broadcast
  const floodOverlay = {
    links: {
      l1: { cls: 'forwarding', label: 'VLAN10' },
      l2: { cls: 'forwarding', label: 'VLAN10 ✓' },
      l3: { cls: 'blocking', label: 'VLAN20 ✗' },
      l4: { cls: 'blocking', label: 'VLAN20 ✗' },
    },
  };

  sim.emit({
    kind: 'process', atDevice: 'pc1', side: 'inspect', activeLayer: 3,
    titleVi: 'PC1 muốn ping PC2 (cùng VLAN 10)',
    explanationVi:
      'PC1 (192.168.10.1) ping PC2 (192.168.10.2): cùng mạng /24 → gửi trực tiếp, cần MAC của PC2. ARP cache trống → phát ARP Request.',
    tables: { arp: { title: 'ARP cache của PC1', rows: pc1arp.snapshot() } },
    lesson: LESSON,
  });

  const arpReq = sim.frame(arpFrame({
    op: ARP_OP.REQUEST, senderMac: PC1.mac, senderIp: PC1.ip,
    targetMac: '00:00:00:00:00:00', targetIp: PC2.ip, ethDst: BROADCAST_MAC,
  }));
  sim.capture(arpReq, 'ARP Request (VLAN 10)');
  sim.emit({
    kind: 'transit', fromDevice: 'pc1', toDevice: 'sw1', side: 'encap', activeLayer: 2,
    titleVi: 'PC1 phát ARP Request (broadcast)',
    packet: arpReq,
    explanationVi: 'Khung broadcast ff:ff:ff:ff:ff:ff đi vào cổng access Fa0/1 (thuộc VLAN 10).',
    lesson: LESSON,
  });

  swmac.learn(PC1.mac, 'Fa0/1 (VLAN10)');
  sim.emit({
    kind: 'process', atDevice: 'sw1', side: 'forward', activeLayer: 2,
    titleVi: 'SW1 flood broadcast CHỈ trong VLAN 10',
    packet: arpReq,
    overlay: floodOverlay,
    explanationVi:
      'SW1 học MAC PC1 vào VLAN 10. Vì khung là broadcast, switch flood ra MỌI cổng CÙNG VLAN 10 (Fa0/2 → PC2), ' +
      'nhưng KHÔNG ra Fa0/3, Fa0/4 (VLAN 20). VLAN = ranh giới miền quảng bá: mỗi VLAN là một broadcast domain riêng.',
    tables: { mac: { title: 'MAC table của SW1', rows: swmac.snapshot() } },
    lesson: LESSON,
  });

  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'pc2', side: 'encap', activeLayer: 2,
    titleVi: 'ARP Request chỉ tới PC2 (VLAN 10)',
    packet: arpReq,
    overlay: floodOverlay,
    explanationVi: 'Chỉ PC2 nhận. PC3/PC4 bên VLAN 20 không hề thấy gói broadcast này.',
  });

  pc2arp.insert(PC1.ip, PC1.mac);
  const arpReply = sim.frame(arpFrame({
    op: ARP_OP.REPLY, senderMac: PC2.mac, senderIp: PC2.ip,
    targetMac: PC1.mac, targetIp: PC1.ip, ethDst: PC1.mac,
  }));
  sim.capture(arpReply, 'ARP Reply (VLAN 10)');
  swmac.learn(PC2.mac, 'Fa0/2 (VLAN10)');
  sim.emit({
    kind: 'process', atDevice: 'pc2', side: 'decap', activeLayer: 2,
    titleVi: 'PC2 trả ARP Reply (unicast)',
    packet: arpReply,
    explanationVi: 'PC2 thấy Target IP là của mình, học MAC PC1, rồi gửi Reply unicast về PC1.',
    tables: { mac: { title: 'MAC table của SW1', rows: swmac.snapshot() } },
    lesson: LESSON,
  });

  pc1arp.insert(PC2.ip, PC2.mac);
  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'pc1', side: 'decap', activeLayer: 2,
    titleVi: 'PC1 nhận MAC PC2',
    packet: arpReply,
    explanationVi: 'SW1 chuyển Reply đúng cổng Fa0/1 (đã biết MAC PC1). PC1 lưu ARP cache.',
    tables: { arp: { title: 'ARP cache của PC1', rows: pc1arp.snapshot() } },
  });

  const echoReq = sim.frame(echoFrame({
    ethDst: PC2.mac, ethSrc: PC1.mac, srcIp: PC1.ip, dstIp: PC2.ip,
    ttl: 64, ipId: 0x7a10, identifier: 0x0003, seq: 1, type: ICMP_TYPE.ECHO_REQUEST,
  }));
  sim.capture(echoReq, 'ICMP Echo Request (VLAN 10)');
  sim.emit({
    kind: 'transit', fromDevice: 'pc1', toDevice: 'pc2', side: 'encap', activeLayer: 3,
    titleVi: 'ICMP trong VLAN 10 — ping thành công',
    packet: echoReq,
    explanationVi: 'Sau khi có MAC, ICMP đi bình thường trong VLAN 10 (SW1 chuyển đúng cổng, unicast).',
    lesson: LESSON,
  });

  sim.emit({
    kind: 'process', atDevice: 'pc1', side: 'inspect', activeLayer: 3,
    titleVi: 'Thử PC1 → PC3 (khác VLAN) thì sao?',
    overlay: { links: { l3: { cls: 'blocking', label: 'VLAN20 ✗' }, l4: { cls: 'blocking', label: 'VLAN20 ✗' } } },
    explanationVi:
      '192.168.20.3 khác mạng với PC1 → PC1 sẽ hỏi default gateway. Nếu không cấu hình gateway + inter-VLAN routing thì ' +
      'gói không bao giờ sang được VLAN 20. Kết luận: VLAN tách cả broadcast LẪN khả năng liên lạc L2; nối 2 VLAN cần ROUTER (xem kịch bản inter-VLAN).',
    lesson: LESSON,
  });

  return sim.result();
}
