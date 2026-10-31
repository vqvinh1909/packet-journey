// scenarios/s02-ping-across-router.js
// Kịch bản 2: Ping KHÁC mạng qua router (PC1 -> R1 -> R2 -> PC2).
// Dạy: quyết định "khác mạng → gửi cho default gateway", ARP cho gateway,
// router tra routing table (longest-prefix match), TTL−1 + TÍNH LẠI checksum,
// MAC nguồn/đích bị VIẾT LẠI mỗi chặng còn IP nguồn/đích GIỮ NGUYÊN.

import { Sim, diffFields } from '../engine/simulate.js';
import { ArpCache, RoutingTable } from '../engine/tables.js';
import { arpFrame, echoFrame, pingData, ARP_OP, ICMP_TYPE, BROADCAST_MAC } from './_common.js';

// ----- Địa chỉ -----
const PC1 = { mac: '00:1a:2b:00:00:01', ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' };
const PC2 = { mac: '00:1a:2b:00:00:02', ip: '192.168.2.10', prefix: 24, gw: '192.168.2.1' };
const R1 = {
  g0: { mac: '00:1a:2b:a1:00:00', ip: '192.168.1.1', prefix: 24, name: 'Gi0/0' },
  g1: { mac: '00:1a:2b:a1:00:01', ip: '10.0.0.1', prefix: 30, name: 'Gi0/1' },
};
const R2 = {
  g1: { mac: '00:1a:2b:b2:00:00', ip: '10.0.0.2', prefix: 30, name: 'Gi0/1' },
  g0: { mac: '00:1a:2b:b2:00:01', ip: '192.168.2.1', prefix: 24, name: 'Gi0/0' },
};

const L_OSI = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-01_Nen-tang-mang/Bai-02_Mo-hinh-OSI-TCPIP.md',
  label: 'Bài 02 — Mô hình OSI/TCP-IP',
};
const L_ROUTE = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-13_Static-Route.md',
  label: 'Bài 13 — Static Route (routing table)',
};
const L_INTRO = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Giới thiệu định tuyến',
};

export const meta = {
  id: 's02-ping-across-router',
  titleVi: 'Ping khác mạng qua router',
  titleEn: 'Ping across routers',
  descriptionVi: 'PC1 (192.168.1.0/24) ping PC2 (192.168.2.0/24) qua 2 router. Xem longest-prefix match, TTL−1, checksum tính lại, MAC viết lại mỗi chặng.',
  difficulty: 2,
  lesson: L_ROUTE,
};

export function build() {
  const topology = {
    devices: [
      { id: 'pc1', type: 'host', name: 'PC1', x: 110, y: 170, lines: ['192.168.1.10/24', 'GW 192.168.1.1'] },
      { id: 'r1', type: 'router', name: 'R1', x: 380, y: 170, lines: ['Gi0/0 192.168.1.1', 'Gi0/1 10.0.0.1/30'] },
      { id: 'r2', type: 'router', name: 'R2', x: 640, y: 170, lines: ['Gi0/1 10.0.0.2/30', 'Gi0/0 192.168.2.1'] },
      { id: 'pc2', type: 'host', name: 'PC2', x: 910, y: 170, lines: ['192.168.2.10/24', 'GW 192.168.2.1'] },
    ],
    links: [
      { id: 'l1', a: 'pc1', b: 'r1', bp: 'Gi0/0', labelMid: '192.168.1.0/24' },
      { id: 'l2', a: 'r1', b: 'r2', ap: 'Gi0/1', bp: 'Gi0/1', labelMid: '10.0.0.0/30' },
      { id: 'l3', a: 'r2', b: 'pc2', ap: 'Gi0/0', labelMid: '192.168.2.0/24' },
    ],
  };

  const sim = new Sim(topology);

  // Routing tables
  const r1routes = new RoutingTable([
    { network: '192.168.1.0', prefix: 24, nextHop: null, iface: 'Gi0/0', kind: 'connected' },
    { network: '10.0.0.0', prefix: 30, nextHop: null, iface: 'Gi0/1', kind: 'connected' },
    { network: '192.168.2.0', prefix: 24, nextHop: '10.0.0.2', iface: 'Gi0/1', kind: 'ospf' },
  ]);
  const r2routes = new RoutingTable([
    { network: '10.0.0.0', prefix: 30, nextHop: null, iface: 'Gi0/1', kind: 'connected' },
    { network: '192.168.2.0', prefix: 24, nextHop: null, iface: 'Gi0/0', kind: 'connected' },
    { network: '192.168.1.0', prefix: 24, nextHop: '10.0.0.1', iface: 'Gi0/1', kind: 'ospf' },
  ]);

  const pc1arp = new ArpCache();
  const DATA = pingData();
  const IP_ID = 0x4d2a;
  const ICMP_ID = 0x0007;

  // Khung ICMP theo mô tả gói (descriptor) — tiện cho việc viết lại từng chặng.
  const makeEcho = (p) =>
    sim.frame(echoFrame({
      ethDst: p.ethDst, ethSrc: p.ethSrc, srcIp: p.srcIp, dstIp: p.dstIp,
      ttl: p.ttl, ipId: p.ipId, identifier: p.identifier, seq: p.seq, type: p.type, data: DATA,
    }));

  // ===== 1. PC1 quyết định: khác mạng =====
  sim.emit({
    kind: 'process', atDevice: 'pc1', side: 'inspect', activeLayer: 3,
    titleVi: 'PC1 thấy đích KHÁC mạng',
    decision: {
      question: 'PC1 (192.168.1.10/24) muốn gửi tới 192.168.2.10. MAC đích của khung sẽ là MAC của ai?',
      options: ['MAC của 192.168.2.10 (đích cuối)', 'MAC của default gateway', 'Broadcast', 'MAC của DNS'],
      correct: 1,
      explainVi: 'Khác mạng → gửi cho default gateway, nên MAC đích tầng 2 là MAC của gateway (IP đích vẫn là máy cuối).',
    },
    explanationVi:
      'PC1 so 192.168.2.10 với mạng của mình 192.168.1.0/24 → KHÁC mạng. Không gửi trực tiếp được, ' +
      'phải nhờ default gateway 192.168.1.1. Nhưng tầng 2 cần MAC của gateway → tra ARP cache: trống → ARP.',
    tables: { arp: { title: 'ARP cache của PC1', rows: pc1arp.snapshot() } },
    lesson: L_OSI,
  });

  // ===== 2. ARP cho gateway =====
  const arpReq = sim.frame(arpFrame({
    op: ARP_OP.REQUEST, senderMac: PC1.mac, senderIp: PC1.ip,
    targetMac: '00:00:00:00:00:00', targetIp: PC1.gw, ethDst: BROADCAST_MAC,
  }));
  sim.capture(arpReq, 'ARP Request (ai có 192.168.1.1?)');
  sim.emit({
    kind: 'transit', fromDevice: 'pc1', toDevice: 'r1', side: 'encap', activeLayer: 2,
    titleVi: 'PC1 hỏi MAC của gateway (192.168.1.1)',
    packet: arpReq,
    explanationVi: 'Target IP = 192.168.1.1 (gateway), không phải IP của PC2. Khác mạng thì luôn hỏi MAC của GATEWAY, không hỏi MAC đích cuối.',
    lesson: L_OSI,
  });
  const arpReply = sim.frame(arpFrame({
    op: ARP_OP.REPLY, senderMac: R1.g0.mac, senderIp: R1.g0.ip,
    targetMac: PC1.mac, targetIp: PC1.ip, ethDst: PC1.mac,
  }));
  sim.capture(arpReply, 'ARP Reply (192.168.1.1 ở MAC R1 Gi0/0)');
  pc1arp.insert(PC1.gw, R1.g0.mac);
  sim.emit({
    kind: 'transit', fromDevice: 'r1', toDevice: 'pc1', side: 'decap', activeLayer: 2,
    titleVi: 'R1 trả MAC cổng Gi0/0, PC1 lưu lại',
    packet: arpReply,
    explanationVi: `R1 trả lời bằng MAC cổng Gi0/0 = ${R1.g0.mac}. PC1 lưu 192.168.1.1 ↔ MAC này. ` +
      '(Đơn giản hóa: ARP giữa router↔router và router→PC2 diễn ra tương tự, đã được nạp sẵn để tập trung vào routing.)',
    tables: { arp: { title: 'ARP cache của PC1', rows: pc1arp.snapshot() } },
    lesson: L_OSI,
  });

  // ===== 3. PC1 gửi Echo Request tới gateway =====
  let reqAtR1 = makeEcho({
    ethDst: R1.g0.mac, ethSrc: PC1.mac, srcIp: PC1.ip, dstIp: PC2.ip,
    ttl: 64, ipId: IP_ID, identifier: ICMP_ID, seq: 1, type: ICMP_TYPE.ECHO_REQUEST,
  });
  sim.capture(reqAtR1, 'ICMP Echo Request (PC1→R1, TTL 64)');
  sim.emit({
    kind: 'transit', fromDevice: 'pc1', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'PC1 gửi Echo Request (MAC đích = gateway)',
    packet: reqAtR1,
    explanationVi:
      'Điểm mấu chốt: IP đích = 192.168.2.10 (PC2), nhưng MAC đích = MAC của R1 (gateway). ' +
      'IP đi "đường dài" tới tận PC2, còn MAC chỉ sống trong 1 chặng. TTL = 64.',
    lesson: L_OSI,
  });

  // Hàm dựng 1 chặng router: tra bảng, TTL−1, tính lại checksum, viết lại MAC.
  function routerHop({ atDevice, routing, arrived, outSrc, outDst, toDevice, nextLabel, lesson }) {
    const dstIp = arrived.layers[1].fields.dst;
    const route = routing.lookup(dstIp);
    const newTtl = arrived.layers[1].fields.ttl - 1;
    const forwarded = makeEcho({
      ethDst: outDst, ethSrc: outSrc, srcIp: arrived.layers[1].fields.src, dstIp,
      ttl: newTtl, ipId: arrived.layers[1].fields.id, identifier: ICMP_ID,
      seq: arrived.layers[2].fields.seq, type: arrived.layers[2].fields.type,
    });
    const changed = diffFields(arrived.tree, forwarded.tree);
    const routeTxt = route.prefix === 0
      ? 'default 0.0.0.0/0'
      : `${route.network}/${route.prefix} ` + (route.nextHop ? `via ${route.nextHop}` : `(trực tiếp, ${route.iface})`);
    sim.emit({
      kind: 'process', atDevice, side: 'forward', activeLayer: 3,
      titleVi: `${topoName(atDevice)} định tuyến ${dstIp}`,
      packet: forwarded,
      changedFields: changed,
      explanationVi:
        `${topoName(atDevice)} bóc tới IP, đọc đích ${dstIp}, tra routing table bằng longest-prefix match → chọn ${routeTxt}. ` +
        `Giảm TTL ${arrived.layers[1].fields.ttl}→${newTtl} nên PHẢI tính lại Header Checksum. ` +
        `Viết lại khung tầng 2: MAC nguồn = cổng ra ${outSrc}, MAC đích = chặng kế ${outDst}. ` +
        'IP nguồn/đích GIỮ NGUYÊN.',
      tables: { routing: { title: `Routing table ${topoName(atDevice)}`, rows: routing.snapshot(), highlight: routeTxt } },
      lesson,
    });
    sim.capture(forwarded, `ICMP (${topoName(atDevice)}→${topoName(toDevice)}, TTL ${newTtl})`);
    sim.emit({
      kind: 'transit', fromDevice: atDevice, toDevice, side: 'encap', activeLayer: 3,
      titleVi: `Chuyển tiếp tới ${topoName(toDevice)} (${nextLabel})`,
      packet: forwarded,
      explanationVi: `Frame mới ra dây ${nextLabel}. So gói trước: chỉ MAC và TTL/checksum đổi; IP, ICMP, Data y nguyên.`,
    });
    return forwarded;
  }

  // ===== 4. R1 và R2 chuyển tiếp Echo Request =====
  const reqAtR2 = routerHop({
    atDevice: 'r1', routing: r1routes, arrived: reqAtR1,
    outSrc: R1.g1.mac, outDst: R2.g1.mac, toDevice: 'r2', nextLabel: '10.0.0.0/30', lesson: L_ROUTE,
  });
  const reqAtPc2 = routerHop({
    atDevice: 'r2', routing: r2routes, arrived: reqAtR2,
    outSrc: R2.g0.mac, outDst: PC2.mac, toDevice: 'pc2', nextLabel: '192.168.2.0/24', lesson: L_ROUTE,
  });

  // ===== 5. PC2 nhận, trả Echo Reply =====
  let replyAtR2 = makeEcho({
    ethDst: R2.g0.mac, ethSrc: PC2.mac, srcIp: PC2.ip, dstIp: PC1.ip,
    ttl: 64, ipId: IP_ID + 1, identifier: ICMP_ID, seq: 1, type: ICMP_TYPE.ECHO_REPLY,
  });
  sim.capture(replyAtR2, 'ICMP Echo Reply (PC2→R2, TTL 64)');
  sim.emit({
    kind: 'process', atDevice: 'pc2', side: 'decap', activeLayer: 3,
    titleVi: 'PC2 nhận Echo Request (TTL còn 62), trả Reply',
    packet: reqAtPc2,
    explanationVi:
      `PC2 nhận gói với TTL ${reqAtPc2.layers[1].fields.ttl} (đã qua 2 router từ 64). Đích IP = PC2 nên xử lý: ` +
      'tạo Echo Reply (type 0), đảo src/dst (src 192.168.2.10, dst 192.168.1.10), TTL đặt lại = 64, gửi về gateway của nó (R2).',
    lesson: L_INTRO,
  });
  sim.emit({
    kind: 'transit', fromDevice: 'pc2', toDevice: 'r2', side: 'encap', activeLayer: 3,
    titleVi: 'PC2 gửi Echo Reply tới gateway R2',
    packet: replyAtR2,
    explanationVi: 'Chiều về bắt đầu, TTL lại từ 64 và sẽ giảm dần qua từng router y như chiều đi.',
  });

  // ===== 6. R2, R1 chuyển tiếp Echo Reply về PC1 =====
  const replyAtR1 = routerHop({
    atDevice: 'r2', routing: r2routes, arrived: replyAtR2,
    outSrc: R2.g1.mac, outDst: R1.g1.mac, toDevice: 'r1', nextLabel: '10.0.0.0/30', lesson: L_ROUTE,
  });
  const replyAtPc1 = routerHop({
    atDevice: 'r1', routing: r1routes, arrived: replyAtR1,
    outSrc: R1.g0.mac, outDst: PC1.mac, toDevice: 'pc1', nextLabel: '192.168.1.0/24', lesson: L_ROUTE,
  });

  sim.emit({
    kind: 'transit', fromDevice: 'pc1', toDevice: 'pc1', side: 'decap', activeLayer: 3,
    titleVi: 'PC1 nhận Echo Reply — ping thành công',
    packet: replyAtPc1,
    explanationVi:
      `PC1 nhận Reply (TTL còn ${replyAtPc1.layers[1].fields.ttl}). Khớp Identifier/Sequence → ping khác mạng thành công. ` +
      'Tổng kết: IP src/dst không đổi suốt hành trình; MAC đổi mỗi chặng; TTL giảm mỗi router; checksum IP tính lại mỗi lần TTL đổi.',
    lesson: L_INTRO,
  });

  function topoName(id) {
    return { pc1: 'PC1', pc2: 'PC2', r1: 'R1', r2: 'R2' }[id] || id;
  }

  return sim.result();
}
