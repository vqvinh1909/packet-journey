// scenarios/s01-ping-same-subnet.js
// Kịch bản 1: Ping CÙNG mạng (PC1 -> PC2 qua switch).
// Dạy: quyết định "cùng mạng?", ARP Request broadcast / ARP Reply, switch học MAC
// và flood khi chưa biết, rồi ICMP Echo Request/Reply.

import { Sim } from '../engine/simulate.js';
import { MacTable, ArpCache } from '../engine/tables.js';
import { arpFrame, echoFrame, ARP_OP, ICMP_TYPE, BROADCAST_MAC } from './_common.js';

// ----- Địa chỉ -----
const PC1 = { id: 'pc1', name: 'PC1', mac: '00:1a:2b:00:00:01', ip: '192.168.1.10', prefix: 24 };
const PC2 = { id: 'pc2', name: 'PC2', mac: '00:1a:2b:00:00:02', ip: '192.168.1.20', prefix: 24 };
const SW1 = { id: 'sw1', name: 'SW1' };
const PORT = { pc1: 'Gi0/1', pc2: 'Gi0/2' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-01_Nen-tang-mang/Bai-02_Mo-hinh-OSI-TCPIP.md',
  label: 'Bài 02 — Mô hình OSI/TCP-IP',
};
const LESSON_SW = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-07_Gioi-thieu-va-cau-hinh-Switch-Cisco.md',
  label: 'Bài 07 — Switch Cisco (MAC table)',
};

export const meta = {
  id: 's01-ping-same-subnet',
  titleVi: 'Ping cùng mạng',
  titleEn: 'Ping within the same subnet',
  descriptionVi: 'PC1 ping PC2 trong cùng VLAN/mạng 192.168.1.0/24, qua một switch. Xem ARP, switch học MAC, và ICMP.',
  difficulty: 1,
  lesson: LESSON,
};

export function build() {
  const topology = {
    devices: [
      { id: 'pc1', type: 'host', name: 'PC1', x: 150, y: 160, lines: ['192.168.1.10/24', PC1.mac] },
      { id: 'sw1', type: 'switch', name: 'SW1', x: 500, y: 160, lines: ['Switch L2'] },
      { id: 'pc2', type: 'host', name: 'PC2', x: 850, y: 160, lines: ['192.168.1.20/24', PC2.mac] },
    ],
    links: [
      { id: 'l1', a: 'pc1', b: 'sw1', bp: PORT.pc1 },
      { id: 'l2', a: 'sw1', b: 'pc2', ap: PORT.pc2 },
    ],
  };

  const sim = new Sim(topology);

  // Trạng thái mô phỏng
  const pc1arp = new ArpCache();
  const pc2arp = new ArpCache();
  const swmac = new MacTable();
  const IP_ID = 0x4d2a;
  const ICMP_ID = 0x0001;

  // --- Bước 1: PC1 quyết định ---
  sim.emit({
    kind: 'process', atDevice: 'pc1', side: 'inspect', activeLayer: 3,
    titleVi: 'PC1 xét đích cùng hay khác mạng',
    decision: {
      question: 'PC1 (192.168.1.10/24) muốn gửi cho 192.168.1.20. Bước tiếp theo PC1 làm gì?',
      options: ['Gửi thẳng cho default gateway', 'Phát ARP hỏi MAC của PC2', 'Truy vấn DNS trước', 'Bỏ gói vì khác mạng'],
      correct: 1,
      explainVi: 'Cùng mạng /24 nên gửi trực tiếp, chỉ cần MAC của PC2 → phát ARP.',
    },
    explanationVi:
      'PC1 muốn ping 192.168.1.20. Nó so IP đích với mạng của mình: 192.168.1.10 AND /24 = 192.168.1.0; ' +
      '192.168.1.20 AND /24 = 192.168.1.0 → CÙNG mạng. Vậy gửi THẲNG cho PC2 (không qua gateway), ' +
      'nhưng tầng 2 cần MAC đích. PC1 tra ARP cache: trống → phải đi hỏi bằng ARP.',
    tables: { arp: { title: 'ARP cache của PC1', rows: pc1arp.snapshot() } },
    lesson: LESSON,
  });

  // --- Bước 2: PC1 phát ARP Request (broadcast) ---
  const arpReq = sim.frame(arpFrame({
    op: ARP_OP.REQUEST, senderMac: PC1.mac, senderIp: PC1.ip,
    targetMac: '00:00:00:00:00:00', targetIp: PC2.ip, ethDst: BROADCAST_MAC,
  }));
  sim.capture(arpReq, 'ARP Request (ai có 192.168.1.20?)');
  sim.emit({
    kind: 'transit', fromDevice: 'pc1', toDevice: 'sw1', side: 'encap', activeLayer: 2,
    titleVi: 'PC1 gửi ARP Request (broadcast)',
    packet: arpReq,
    explanationVi:
      'PC1 đóng khung ARP Request: MAC đích = ff:ff:ff:ff:ff:ff (broadcast) để mọi host trong mạng đều nhận; ' +
      'Sender = (MAC+IP của PC1), Target IP = 192.168.1.20, Target MAC để trống (00:00:00:00:00:00) vì đang đi hỏi.',
    lesson: LESSON,
  });

  // --- Bước 3: SW1 học MAC + flood ---
  swmac.learn(PC1.mac, PORT.pc1);
  sim.emit({
    kind: 'process', atDevice: 'sw1', side: 'forward', activeLayer: 2,
    titleVi: 'SW1 học MAC PC1, rồi flood',
    packet: arpReq,
    explanationVi:
      `SW1 nhận frame ở cổng ${PORT.pc1} → ghi vào MAC table: ${PC1.mac} ↔ ${PORT.pc1}. ` +
      'MAC đích là broadcast (ff:ff:ff:ff:ff:ff) nên switch FLOOD ra mọi cổng còn lại (trừ cổng vừa nhận).',
    tables: { mac: { title: 'MAC table của SW1', rows: swmac.snapshot() } },
    lesson: LESSON_SW,
  });

  // --- Bước 4: ARP Request tới PC2 ---
  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'pc2', side: 'encap', activeLayer: 2,
    titleVi: 'ARP Request được flood tới PC2',
    packet: arpReq,
    explanationVi: 'Frame broadcast tới PC2 (và mọi host khác nếu có). Mỗi host đọc Target IP để biết có phải hỏi mình không.',
  });

  // --- Bước 5: PC2 nhận, tạo ARP Reply ---
  pc2arp.insert(PC1.ip, PC1.mac);
  const arpReply = sim.frame(arpFrame({
    op: ARP_OP.REPLY, senderMac: PC2.mac, senderIp: PC2.ip,
    targetMac: PC1.mac, targetIp: PC1.ip, ethDst: PC1.mac,
  }));
  sim.capture(arpReply, 'ARP Reply (192.168.1.20 ở MAC PC2)');
  sim.emit({
    kind: 'process', atDevice: 'pc2', side: 'decap', activeLayer: 2,
    titleVi: 'PC2 trả lời ARP Reply (unicast)',
    packet: arpReply,
    explanationVi:
      'PC2 thấy Target IP = IP của mình. Nó học luôn MAC của PC1 (từ Sender của Request) vào ARP cache, ' +
      'rồi gửi ARP Reply UNICAST thẳng về PC1: Sender = (MAC+IP PC2), Opcode = 2 (Reply).',
    tables: { arp: { title: 'ARP cache của PC2', rows: pc2arp.snapshot() } },
    lesson: LESSON,
  });

  // --- Bước 6: ARP Reply về SW1 ---
  swmac.learn(PC2.mac, PORT.pc2);
  sim.emit({
    kind: 'transit', fromDevice: 'pc2', toDevice: 'sw1', side: 'encap', activeLayer: 2,
    titleVi: 'ARP Reply về SW1 — switch học MAC PC2',
    packet: arpReply,
    explanationVi:
      `SW1 nhận Reply ở cổng ${PORT.pc2} → học ${PC2.mac} ↔ ${PORT.pc2}. Lần này MAC đích (PC1) ĐÃ biết ở ` +
      `${PORT.pc1} nên switch chuyển đúng 1 cổng, KHÔNG flood nữa.`,
    tables: { mac: { title: 'MAC table của SW1', rows: swmac.snapshot() } },
    lesson: LESSON_SW,
  });

  // --- Bước 7: ARP Reply tới PC1 ---
  pc1arp.insert(PC2.ip, PC2.mac);
  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'pc1', side: 'decap', activeLayer: 2,
    titleVi: 'PC1 nhận ARP Reply — đã có MAC PC2',
    packet: arpReply,
    explanationVi: 'PC1 lưu 192.168.1.20 ↔ MAC PC2 vào ARP cache. Bây giờ mới đủ thông tin để gửi ICMP.',
    tables: { arp: { title: 'ARP cache của PC1', rows: pc1arp.snapshot() } },
  });

  // --- Bước 8: PC1 gửi ICMP Echo Request ---
  const echoReq = sim.frame(echoFrame({
    ethDst: PC2.mac, ethSrc: PC1.mac, srcIp: PC1.ip, dstIp: PC2.ip,
    ttl: 64, ipId: IP_ID, identifier: ICMP_ID, seq: 1, type: ICMP_TYPE.ECHO_REQUEST,
  }));
  sim.capture(echoReq, 'ICMP Echo Request');
  sim.emit({
    kind: 'transit', fromDevice: 'pc1', toDevice: 'sw1', side: 'encap', activeLayer: 3,
    titleVi: 'PC1 đóng gói ICMP Echo Request',
    packet: echoReq,
    explanationVi:
      'PC1 dựng gói từ trên xuống: ICMP (type 8 = Echo Request) → IPv4 (src 192.168.1.10, dst 192.168.1.20, ' +
      'TTL 64, checksum header tính thật) → Ethernet (dst = MAC PC2, src = MAC PC1, type 0x0800). Rồi đẩy ra dây.',
    lesson: LESSON,
  });

  // --- Bước 9: SW1 forward tới PC2 ---
  sim.emit({
    kind: 'process', atDevice: 'sw1', side: 'forward', activeLayer: 2,
    titleVi: 'SW1 chuyển ICMP tới PC2 (đã biết cổng)',
    packet: echoReq,
    explanationVi: `MAC đích = PC2 đã có trong bảng (${PORT.pc2}) → chuyển đúng cổng, không flood.`,
    tables: { mac: { title: 'MAC table của SW1', rows: swmac.snapshot() } },
  });
  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'pc2', side: 'encap', activeLayer: 3,
    titleVi: 'ICMP Echo Request tới PC2',
    packet: echoReq,
    explanationVi: 'Frame đến PC2. PC2 sẽ bóc tách (decapsulation) ngược từ Ethernet → IP → ICMP.',
  });

  // --- Bước 10: PC2 tạo Echo Reply ---
  const echoReply = sim.frame(echoFrame({
    ethDst: PC1.mac, ethSrc: PC2.mac, srcIp: PC2.ip, dstIp: PC1.ip,
    ttl: 64, ipId: IP_ID + 1, identifier: ICMP_ID, seq: 1, type: ICMP_TYPE.ECHO_REPLY,
  }));
  sim.capture(echoReply, 'ICMP Echo Reply');
  sim.emit({
    kind: 'process', atDevice: 'pc2', side: 'decap', activeLayer: 3,
    titleVi: 'PC2 nhận, trả Echo Reply',
    packet: echoReply,
    explanationVi:
      'PC2 đọc ICMP type 8 → tạo Echo Reply (type 0), đảo nguồn/đích: src 192.168.1.20, dst 192.168.1.10; ' +
      'sao chép nguyên Data. Vì đã có MAC PC1 trong ARP cache nên gửi thẳng, không cần ARP lại.',
    lesson: LESSON,
  });

  // --- Bước 11: Reply về PC1 qua switch ---
  sim.emit({
    kind: 'transit', fromDevice: 'pc2', toDevice: 'sw1', side: 'encap', activeLayer: 3,
    titleVi: 'Echo Reply về SW1',
    packet: echoReply,
    explanationVi: 'SW1 đã biết cả hai MAC nên chuyển thẳng tới PC1.',
  });
  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'pc1', side: 'decap', activeLayer: 3,
    titleVi: 'PC1 nhận Echo Reply — ping thành công',
    packet: echoReply,
    explanationVi:
      'PC1 khớp Identifier/Sequence với gói đã gửi → tính thời gian khứ hồi (RTT). ' +
      'Ping cùng mạng hoàn tất: ARP một lần, các lần ping sau dùng lại ARP cache nên nhanh hơn.',
    lesson: LESSON,
  });

  return sim.result();
}
