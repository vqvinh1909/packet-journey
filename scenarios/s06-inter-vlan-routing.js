// scenarios/s06-inter-vlan-routing.js
// Kịch bản 6 (CCNA Routing): Inter-VLAN routing kiểu "router-on-a-stick".
// Một router có 2 sub-interface (Gi0/0.10, Gi0/0.20) làm gateway cho VLAN 10 & 20,
// nối switch bằng MỘT trunk. PC1 (VLAN10) ping PC2 (VLAN20): gói đi lên router,
// đổi VLAN 10 → 20 (đổi tag + MAC), TTL−1 rồi về lại switch.

import { Sim, diffFields } from '../engine/simulate.js';
import { echoFrame, pingData, ICMP_TYPE } from './_common.js';

const C10 = '#2c5f8a';
const C20 = '#c8611a';
const PC1 = { mac: '00:10:10:00:00:10', ip: '192.168.10.10', gw: '192.168.10.1' };
const PC2 = { mac: '00:20:20:00:00:20', ip: '192.168.20.20', gw: '192.168.20.1' };
const R1 = { mac: '00:1a:2b:c1:00:00' }; // 1 MAC vật lý dùng chung cho cả 2 sub-interface

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-12_Inter-VLAN-Routing.md',
  label: 'Bài 12 — Inter-VLAN Routing',
};

export const meta = {
  id: 's06-inter-vlan-routing',
  titleVi: 'Inter-VLAN (router-on-a-stick)',
  titleEn: 'Inter-VLAN routing',
  descriptionVi: 'PC1 (VLAN 10) ping PC2 (VLAN 20) qua router 1 chân (sub-interface). Xem tag VLAN đổi 10→20, MAC viết lại, TTL−1.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'pc1', type: 'host', name: 'PC1', x: 150, y: 90, color: C10, lines: ['192.168.10.10', 'VLAN 10'] },
      { id: 'pc2', type: 'host', name: 'PC2', x: 150, y: 270, color: C20, lines: ['192.168.20.20', 'VLAN 20'] },
      { id: 'sw1', type: 'switch', name: 'SW1', x: 480, y: 180, lines: ['access VLAN10/20', 'trunk → R1'] },
      { id: 'r1', type: 'router', name: 'R1', x: 820, y: 180, lines: ['Gi0/0.10 192.168.10.1', 'Gi0/0.20 192.168.20.1'] },
    ],
    links: [
      { id: 'l10', a: 'pc1', b: 'sw1', labelMid: 'access VLAN10' },
      { id: 'l20', a: 'pc2', b: 'sw1', labelMid: 'access VLAN20' },
      { id: 'trunk', a: 'sw1', b: 'r1', labelMid: 'TRUNK' },
    ],
  };

  const sim = new Sim(topology);

  const untagged = (p) => sim.frame(echoFrame({
    ethDst: p.ethDst, ethSrc: p.ethSrc, srcIp: p.srcIp, dstIp: p.dstIp,
    ttl: p.ttl, ipId: 0x5a30, identifier: 0x0006, seq: 1, type: p.type,
  }));
  const tagged = (p) => sim.frame([
    { proto: 'ethernet', fields: { dst: p.ethDst, src: p.ethSrc, etherType: 0x8100 } },
    { proto: 'dot1q', fields: { pcp: 0, dei: 0, vid: p.vid, innerType: 0x0800 } },
    { proto: 'ipv4', fields: { src: p.srcIp, dst: p.dstIp, ttl: p.ttl, id: 0x5a30, protocol: 1 } },
    { proto: 'icmp', fields: { type: p.type, code: 0, identifier: 0x0006, seq: 1, data: pingData() } },
  ]);

  // 1. PC1 quyết định
  sim.emit({
    kind: 'process', atDevice: 'pc1', side: 'inspect', activeLayer: 3,
    titleVi: 'PC1 thấy PC2 khác mạng → gửi gateway VLAN 10',
    explanationVi:
      'PC1 (192.168.10.10) ping PC2 (192.168.20.20): khác mạng → gửi cho gateway 192.168.10.1 (sub-interface Gi0/0.10 của R1). ' +
      'MAC đích = MAC của R1 (giả định ARP đã xong).',
    lesson: LESSON,
  });

  // 2. PC1 -> SW1 (access, không tag)
  let reqAtSw = untagged({ ethDst: R1.mac, ethSrc: PC1.mac, srcIp: PC1.ip, dstIp: PC2.ip, ttl: 64, type: ICMP_TYPE.ECHO_REQUEST });
  sim.capture(reqAtSw, 'ICMP Echo Request (access VLAN10)');
  sim.emit({
    kind: 'transit', fromDevice: 'pc1', toDevice: 'sw1', side: 'encap', activeLayer: 2,
    titleVi: 'PC1 → SW1 (không tag)',
    packet: reqAtSw,
    explanationVi: 'Trên cổng access VLAN 10, khung chưa có nhãn.',
    lesson: LESSON,
  });

  // 3. SW1 -> R1 (trunk, tag VID10)
  let reqAtR1 = tagged({ ethDst: R1.mac, ethSrc: PC1.mac, srcIp: PC1.ip, dstIp: PC2.ip, ttl: 64, vid: 10, type: ICMP_TYPE.ECHO_REQUEST });
  sim.capture(reqAtR1, 'ICMP tagged VID10 (SW1→R1)');
  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'r1', side: 'forward', activeLayer: 2,
    titleVi: 'SW1 gắn tag VID10, đẩy lên trunk tới R1',
    packet: reqAtR1,
    overlay: { links: { trunk: { cls: 'trunk', label: 'VID10 →' } } },
    changedFields: ['eth.type', 'dot1q.vid'],
    explanationVi: 'Trên trunk, khung được gắn nhãn 802.1Q VID = 10. R1 sẽ nhận ở sub-interface Gi0/0.10.',
  });

  // 4. R1 định tuyến VLAN10 -> VLAN20
  const reqOut = tagged({ ethDst: PC2.mac, ethSrc: R1.mac, srcIp: PC1.ip, dstIp: PC2.ip, ttl: 63, vid: 20, type: ICMP_TYPE.ECHO_REQUEST });
  sim.emit({
    kind: 'process', atDevice: 'r1', side: 'forward', activeLayer: 3,
    titleVi: 'R1 định tuyến giữa 2 sub-interface (VLAN10 → VLAN20)',
    packet: reqOut,
    changedFields: diffFields(reqAtR1.tree, reqOut.tree),
    overlay: { links: { trunk: { cls: 'trunk', label: '← VID20' } } },
    explanationVi:
      'R1 nhận khung VID10 ở Gi0/0.10, bóc tới IP: đích 192.168.20.20 thuộc mạng nối trực tiếp của Gi0/0.20. ' +
      'R1 chuyển sang sub-interface Gi0/0.20: đổi nhãn VLAN 10 → 20, viết lại MAC đích = PC2 (MAC nguồn = R1), ' +
      'TTL 64→63 và tính lại checksum. IP nguồn/đích GIỮ NGUYÊN.',
    tables: { routing: { title: 'Routing table R1', rows: [
      { network: '192.168.10.0', prefix: 24, nextHop: '(trực tiếp)', iface: 'Gi0/0.10', kind: 'connected' },
      { network: '192.168.20.0', prefix: 24, nextHop: '(trực tiếp)', iface: 'Gi0/0.20', kind: 'connected' },
    ], highlight: '192.168.20.0/24' } },
    lesson: LESSON,
  });

  // 5. R1 -> SW1 (trunk VID20)
  sim.capture(reqOut, 'ICMP tagged VID20 (R1→SW1)');
  sim.emit({
    kind: 'transit', fromDevice: 'r1', toDevice: 'sw1', side: 'forward', activeLayer: 2,
    titleVi: 'R1 → SW1: khung mang tag VID20',
    packet: reqOut,
    overlay: { links: { trunk: { cls: 'trunk', label: 'VID20 ←' } } },
    explanationVi: 'Cùng một dây trunk nhưng giờ khung thuộc VLAN 20.',
  });

  // 6. SW1 -> PC2 (gỡ tag)
  const reqAtPc2 = untagged({ ethDst: PC2.mac, ethSrc: R1.mac, srcIp: PC1.ip, dstIp: PC2.ip, ttl: 63, type: ICMP_TYPE.ECHO_REQUEST });
  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'pc2', side: 'decap', activeLayer: 3,
    titleVi: 'SW1 gỡ tag, giao PC2 (VLAN 20)',
    packet: reqAtPc2,
    explanationVi: 'SW1 thấy VID20 → cổng access VLAN20 tới PC2 nên gỡ nhãn. PC2 nhận ICMP Echo Request (TTL còn 63).',
    lesson: LESSON,
  });

  // 7. Tóm tắt chiều về
  sim.emit({
    kind: 'process', atDevice: 'pc2', side: 'decap', activeLayer: 3,
    titleVi: 'PC2 trả lời — chiều về đối xứng',
    packet: reqAtPc2,
    explanationVi:
      'PC2 gửi Echo Reply về gateway của nó (192.168.20.1 = Gi0/0.20). R1 lại định tuyến VLAN20 → VLAN10, ' +
      'đổi tag 20→10, TTL−1, về PC1. Kết luận: 1 router + sub-interface + 1 trunk là đủ nối mọi VLAN với nhau.',
    lesson: LESSON,
  });

  return sim.result();
}
