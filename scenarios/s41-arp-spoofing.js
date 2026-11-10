// scenarios/s41-arp-spoofing.js
// Kịch bản 41 (Tấn công): ARP spoofing. Kẻ tấn công gửi ARP Reply giả để đứng giữa PC và gateway.
// ARP không xác thực, nên máy nhận tin ngay cả khi không hỏi. Phòng thủ: DHCP snooping + Dynamic ARP Inspection.

import { Sim } from '../engine/simulate.js';
import { ArpCache } from '../engine/tables.js';
import { arpFrame, echoFrame, ARP_OP, ICMP_TYPE } from './_common.js';

const PC = { mac: '00:1a:2b:00:00:10', ip: '192.168.1.10' };
const GW = { mac: '00:1a:2b:00:00:01', ip: '192.168.1.1' };
const ATT = { mac: '00:de:ad:00:00:66', ip: '192.168.1.66' };

const LESSON = { path: '../Network security/Module-02_Buc-tranh-tan-cong/Bai-09_Tan-cong-mang-noi-bo.md', label: 'Bài 09 Security — Tấn công Layer 2' };

export const meta = {
  id: 's41-arp-spoofing',
  titleVi: '⚔️ Tấn công: ARP spoofing (đứng giữa)',
  titleEn: 'Attack: ARP spoofing (man-in-the-middle)',
  descriptionVi: 'Kẻ tấn công gửi ARP Reply giả, khiến PC tưởng MAC của gateway là MAC của nó. Mọi gói ra Internet đi qua máy kẻ tấn công.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 380',
    devices: [
      { id: 'pc', type: 'host', name: 'PC nạn nhân', x: 160, y: 120, color: '#2c5f8a', lines: [PC.ip, PC.mac] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 500, y: 120, lines: ['VLAN 10'] },
      { id: 'gw', type: 'router', name: 'Gateway', x: 840, y: 120, lines: [GW.ip, GW.mac] },
      { id: 'att', type: 'host', name: 'Kẻ tấn công', x: 500, y: 310, color: '#a0433a', lines: [ATT.ip, ATT.mac] },
    ],
    links: [{ id: 'l1', a: 'pc', b: 'sw' }, { id: 'l2', a: 'sw', b: 'gw' }, { id: 'l3', a: 'sw', b: 'att', ap: 'Fa0/3' }],
  };
  const sim = new Sim(topology);
  const pcArp = new ArpCache({ [GW.ip]: GW.mac });
  const gwArp = new ArpCache({ [PC.ip]: PC.mac });

  sim.emit({ kind: 'process', atDevice: 'pc', side: 'inspect', activeLayer: 2,
    titleVi: 'Lúc đầu: ARP cache của PC đúng',
    tables: { arp: { title: 'ARP cache của PC', rows: pcArp.snapshot() } },
    explanationVi: `PC đã học đúng: ${GW.ip} ở MAC ${GW.mac}. Mọi gói ra ngoài mạng được đóng khung với MAC đích này.`, lesson: LESSON });

  // ARP Reply giả gửi cho PC: "192.168.1.1 ở MAC của tôi"
  const fake1 = sim.frame(arpFrame({ op: ARP_OP.REPLY, senderMac: ATT.mac, senderIp: GW.ip, targetMac: PC.mac, targetIp: PC.ip, ethDst: PC.mac }));
  sim.capture(fake1, 'ARP Reply giả → PC');
  sim.emit({ kind: 'transit', fromDevice: 'att', toDevice: 'sw', side: 'encap', activeLayer: 2,
    titleVi: `Kẻ tấn công gửi ARP Reply giả: "${GW.ip} ở ${ATT.mac}"`, packet: fake1,
    decision: {
      question: 'PC không hề gửi ARP Request. Nhận ARP Reply này, PC làm gì?',
      options: ['Bỏ qua vì không hỏi', 'Ghi đè ARP cache bằng MAC mới', 'Hỏi lại gateway để xác nhận', 'Báo lỗi trùng IP rồi ngắt mạng'],
      correct: 1,
      explainVi: 'ARP không có xác thực. Hầu hết hệ điều hành nhận ARP Reply không ai hỏi và ghi đè cache.',
    },
    explanationVi: `Trong gói ARP, Sender IP là ${GW.ip} (IP của gateway) nhưng Sender MAC là MAC của kẻ tấn công. Switch chỉ chuyển khung theo MAC đích, không đọc nội dung ARP.`, lesson: LESSON });

  pcArp.insert(GW.ip, ATT.mac);
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'pc', side: 'decap', activeLayer: 2,
    titleVi: 'PC tin và ghi đè ARP cache', packet: fake1,
    tables: { arp: { title: 'ARP cache của PC (đã bị đầu độc)', rows: pcArp.snapshot() } },
    explanationVi: `Giờ PC tưởng ${GW.ip} ở ${ATT.mac}. Kẻ tấn công phải gửi lại gói giả vài giây một lần để cache không trở về giá trị đúng.`, lesson: LESSON });

  // Đầu độc chiều ngược lại
  const fake2 = sim.frame(arpFrame({ op: ARP_OP.REPLY, senderMac: ATT.mac, senderIp: PC.ip, targetMac: GW.mac, targetIp: GW.ip, ethDst: GW.mac }));
  sim.capture(fake2, 'ARP Reply giả → Gateway');
  gwArp.insert(PC.ip, ATT.mac);
  sim.emit({ kind: 'transit', fromDevice: 'att', toDevice: 'sw', side: 'encap', activeLayer: 2,
    titleVi: `Đầu độc cả gateway: "${PC.ip} ở ${ATT.mac}"`, packet: fake2,
    explanationVi: 'Muốn thấy cả hai chiều, kẻ tấn công lừa luôn gateway rằng IP của PC nằm ở MAC của nó.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'gw', side: 'decap', activeLayer: 2,
    titleVi: 'Gateway cũng ghi đè ARP cache', packet: fake2,
    tables: { arp: { title: 'ARP cache của Gateway (đã bị đầu độc)', rows: gwArp.snapshot() } },
    explanationVi: 'Từ lúc này, gói từ Internet về PC cũng được gateway gửi tới MAC của kẻ tấn công.', lesson: LESSON });

  // PC ping ra Internet: khung đi tới kẻ tấn công
  const ping = (ethSrc, ethDst, ttl) => sim.frame(echoFrame({ ethDst, ethSrc, srcIp: PC.ip, dstIp: '8.8.8.8', ttl, ipId: 0x4d2, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
  const p1 = ping(PC.mac, ATT.mac, 64);
  sim.capture(p1, 'Ping của PC (MAC đích = kẻ tấn công)');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'sw', side: 'encap', activeLayer: 2,
    titleVi: 'PC gửi gói ra Internet, nhưng MAC đích là của kẻ tấn công', packet: p1,
    explanationVi: 'IP đích vẫn là 8.8.8.8. Chỉ có MAC đích sai, vì PC tra ARP cache đã bị đầu độc.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'att', side: 'forward', activeLayer: 2,
    titleVi: 'Switch chuyển khung tới kẻ tấn công', packet: p1,
    overlay: { links: { l3: { cls: 'blocking', label: 'dữ liệu bị nghe lén' } } },
    explanationVi: 'Switch làm đúng việc của nó: chuyển theo MAC đích. Kẻ tấn công đọc được, và có thể sửa, mọi gói không mã hoá.', lesson: LESSON });

  const p2 = ping(ATT.mac, GW.mac, 63);
  sim.capture(p2, 'Kẻ tấn công chuyển tiếp tới Gateway');
  sim.emit({ kind: 'transit', fromDevice: 'att', toDevice: 'sw', side: 'forward', activeLayer: 3,
    titleVi: 'Kẻ tấn công chuyển tiếp gói tới gateway thật', packet: p2,
    explanationVi: 'Máy kẻ tấn công bật IP forwarding nên hoạt động như một router: TTL giảm 1, MAC nguồn đổi thành MAC của nó. Nạn nhân vẫn vào mạng bình thường nên không nghi ngờ.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'gw', side: 'decap', activeLayer: 3,
    titleVi: 'Gateway nhận gói và đi tiếp ra Internet', packet: p2,
    explanationVi: 'Dấu hiệu nhận biết: trên PC, `arp -a` cho thấy gateway và một máy khác có cùng MAC; traceroute có thêm một chặng.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'inspect', activeLayer: 2,
    titleVi: 'Phòng thủ: DHCP snooping + Dynamic ARP Inspection',
    decision: {
      question: 'Tính năng nào trên switch chặn được ARP Reply giả?',
      options: ['PortFast', 'Dynamic ARP Inspection (DAI)', 'Storm control', 'EtherChannel'],
      correct: 1,
      explainVi: 'DAI so cặp IP–MAC trong gói ARP với bảng DHCP snooping binding. Không khớp thì loại gói.',
    },
    tables: { list: { title: 'DHCP snooping binding trên SW1', cols: ['MAC', 'IP', 'VLAN', 'Cổng'], rows: [[PC.mac, PC.ip, '10', 'Fa0/1'], [ATT.mac, ATT.ip, '10', 'Fa0/3']] } },
    explanationVi: `Bật \`ip dhcp snooping\` rồi \`ip arp inspection vlan 10\`. Gói ARP từ cổng Fa0/3 khai Sender IP ${GW.ip} với MAC ${ATT.mac} không khớp binding nên bị loại. Cổng uplink tới gateway đặt \`ip arp inspection trust\`. Dùng HTTPS và VPN để dữ liệu vẫn an toàn nếu bị nghe lén.`, lesson: LESSON });

  return sim.result();
}
