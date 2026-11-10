// scenarios/s42-dhcp-rogue.js
// Kịch bản 42 (Tấn công): DHCP server giả. Máy kẻ tấn công trả lời DISCOVER trước server thật,
// cấp cho client gateway và DNS là chính nó. Phòng thủ: DHCP snooping (cổng trusted/untrusted).

import { Sim } from '../engine/simulate.js';
import { DHCP_MSG } from '../protocols/dhcp.js';
import { BROADCAST_MAC } from './_common.js';

const CLIENT = { mac: '00:1a:2b:00:00:10' };
const ROGUE = { mac: '00:de:ad:00:00:66', ip: '192.168.1.66' };
const XID = 0x5ec0de42;
const ip4 = (s) => s.split('.').map(Number);

const LESSON = { path: '../Network security/Module-02_Buc-tranh-tan-cong/Bai-09_Tan-cong-mang-noi-bo.md', label: 'Bài 09 Security — Tấn công Layer 2' };

export const meta = {
  id: 's42-dhcp-rogue',
  titleVi: '⚔️ Tấn công: DHCP server giả',
  titleEn: 'Attack: rogue DHCP server',
  descriptionVi: 'Một máy lạ trong LAN trả lời DHCP nhanh hơn server thật, cấp gateway và DNS là chính nó để nghe lén.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 380',
    devices: [
      { id: 'pc', type: 'host', name: 'Client', x: 160, y: 120, color: '#2c5f8a', lines: ['chưa có IP', CLIENT.mac] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 500, y: 120, lines: ['VLAN 10'] },
      { id: 'srv', type: 'host', name: 'DHCP thật', x: 840, y: 120, color: '#2e7d5b', lines: ['192.168.1.1', 'ở xa hơn, trả lời chậm'] },
      { id: 'rogue', type: 'host', name: 'DHCP giả', x: 500, y: 310, color: '#a0433a', lines: [ROGUE.ip, ROGUE.mac] },
    ],
    links: [{ id: 'l1', a: 'pc', b: 'sw' }, { id: 'l2', a: 'sw', b: 'srv' }, { id: 'l3', a: 'sw', b: 'rogue' }],
  };
  const sim = new Sim(topology);
  const dhcp = (p) => sim.frame([
    { proto: 'ethernet', fields: { dst: BROADCAST_MAC, src: p.from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: p.from.ip || '0.0.0.0', dst: '255.255.255.255', ttl: 64, id: 0, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: p.op === 1 ? 68 : 67, dstPort: p.op === 1 ? 67 : 68 } },
    { proto: 'dhcp', fields: { op: p.op, xid: XID, flags: 0x8000, yiaddr: p.yiaddr, siaddr: p.from.ip, chaddr: CLIENT.mac, options: p.options } },
  ]);
  const rogueOpts = (type) => [
    { code: 53, data: [type] },
    { code: 54, data: ip4(ROGUE.ip), desc: 'Server Identifier: IP của server gửi gói này.' },
    { code: 1, data: [255, 255, 255, 0], desc: 'Subnet mask.' },
    { code: 3, data: ip4(ROGUE.ip), desc: 'Default gateway = máy kẻ tấn công!' },
    { code: 6, data: ip4(ROGUE.ip), desc: 'DNS = máy kẻ tấn công!' },
    { code: 51, data: [0, 1, 0x51, 0x80], desc: 'Lease time = 86400 giây.' },
  ];

  const disc = dhcp({ from: CLIENT, op: 1, options: [{ code: 53, data: [DHCP_MSG.DISCOVER] }] });
  sim.capture(disc, 'DHCP DISCOVER');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: 'Client phát DHCP DISCOVER (broadcast)', packet: disc,
    explanationVi: 'Client chưa có IP nên hỏi cả mạng: "ai là DHCP server?". Gói là broadcast nên mọi máy trong VLAN đều nhận, kể cả máy lạ.', lesson: LESSON });
  sim.emit({ kind: 'process', atDevice: 'sw', side: 'forward', activeLayer: 2,
    titleVi: 'Switch flood DISCOVER ra mọi cổng', packet: disc,
    overlay: { links: { l2: { cls: 'forwarding', label: 'tới server thật' }, l3: { cls: 'blocking', label: 'tới server giả' } } },
    decision: {
      question: 'Cả server thật và server giả đều nhận DISCOVER và đều gửi OFFER. Client chọn OFFER nào?',
      options: ['OFFER của server có IP nhỏ hơn', 'OFFER đến trước', 'OFFER có lease dài hơn', 'Luôn chọn server đã dùng lần trước'],
      correct: 1,
      explainVi: 'Client thường nhận OFFER đầu tiên tới nơi. DHCP không có cách nào để client kiểm tra server là thật.',
    },
    explanationVi: 'DHCP không xác thực server. Máy nào nghe cổng UDP 67 đều có thể trả lời.', lesson: LESSON });

  const offer = dhcp({ from: ROGUE, op: 2, yiaddr: '192.168.1.150', options: rogueOpts(DHCP_MSG.OFFER) });
  sim.capture(offer, 'DHCP OFFER giả');
  sim.emit({ kind: 'transit', fromDevice: 'rogue', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: 'Server giả gửi OFFER trước: gateway và DNS là chính nó', packet: offer,
    explanationVi: `Server giả nằm ngay trong LAN nên trả lời nhanh hơn. Xem option 3 (Router) và option 6 (DNS): cả hai đều là ${ROGUE.ip}.`, lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'pc', side: 'decap', activeLayer: 7,
    titleVi: 'Client nhận OFFER giả trước OFFER thật', packet: offer,
    explanationVi: 'OFFER của server thật tới sau vài mili giây và bị client bỏ qua.', lesson: LESSON });

  const req = dhcp({ from: CLIENT, op: 1, options: [{ code: 53, data: [DHCP_MSG.REQUEST] }, { code: 50, data: [192, 168, 1, 150], desc: 'IP client xin.' }, { code: 54, data: ip4(ROGUE.ip), desc: 'Client chọn server giả.' }] });
  sim.capture(req, 'DHCP REQUEST (chọn server giả)');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: 'Client gửi REQUEST, ghi rõ chọn server giả', packet: req,
    explanationVi: `REQUEST cũng là broadcast. Option 54 = ${ROGUE.ip} báo cho server thật biết nó không được chọn, nên server thật thu lại IP đã đề nghị.`, lesson: LESSON });

  const ack = dhcp({ from: ROGUE, op: 2, yiaddr: '192.168.1.150', options: rogueOpts(DHCP_MSG.ACK) });
  sim.capture(ack, 'DHCP ACK giả');
  sim.emit({ kind: 'transit', fromDevice: 'rogue', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: 'Server giả gửi ACK', packet: ack,
    explanationVi: 'Bốn bước DORA hoàn tất, nhưng với server sai.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'pc', side: 'decap', activeLayer: 7,
    titleVi: 'Client dùng cấu hình độc: mọi gói đi qua kẻ tấn công', packet: ack,
    tables: { list: { title: 'Cấu hình IP client vừa nhận', cols: ['Mục', 'Giá trị'], rows: [['IP', '192.168.1.150/24'], ['Default gateway', `${ROGUE.ip} ✗`], ['DNS', `${ROGUE.ip} ✗`]] } },
    explanationVi: 'Gateway giả cho phép nghe lén mọi gói. DNS giả cho phép trả về IP giả cho tên miền ngân hàng, email. Lỗi này cũng hay xảy ra vô tình khi ai đó cắm router Wi-Fi gia đình vào mạng công ty.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'inspect', activeLayer: 2,
    titleVi: 'Phòng thủ: DHCP snooping',
    decision: {
      question: 'Với DHCP snooping, gói OFFER đi vào một cổng untrusted thì sao?',
      options: ['Được chuyển bình thường', 'Bị loại', 'Bị gắn nhãn VLAN khác', 'Bị chuyển về server thật'],
      correct: 1,
      explainVi: 'Cổng untrusted chỉ được gửi gói của client (DISCOVER, REQUEST). Gói của server (OFFER, ACK) chỉ được vào từ cổng trusted.',
    },
    overlay: { links: { l2: { cls: 'forwarding', label: 'trusted' }, l3: { cls: 'blocking', label: 'untrusted: loại OFFER/ACK' } } },
    explanationVi: 'Bật `ip dhcp snooping` và `ip dhcp snooping vlan 10`. Chỉ cổng nối tới DHCP server thật mới đặt `ip dhcp snooping trust`. Switch còn ghi bảng binding (MAC, IP, cổng) để DAI và IP Source Guard dùng.', lesson: LESSON });

  return sim.result();
}
