// scenarios/s09-dhcp-dora.js
// Kịch bản 9 (CCNA Services): DHCP DORA.
// Client chưa có IP xin cấp địa chỉ: DISCOVER → OFFER → REQUEST → ACK.
// Dùng UDP 68↔67, broadcast 0.0.0.0 → 255.255.255.255, các option (mask, router, DNS, lease).

import { Sim } from '../engine/simulate.js';
import { DHCP_MSG } from '../protocols/dhcp.js';

const CLIENT = { mac: '00:1a:2b:00:00:01' };
const SRV = { mac: '00:1a:2b:00:00:ff', ip: '192.168.1.1' };
const OFFERED = '192.168.1.100';
const XID = 0x3903f326;
const BCAST_MAC = 'ff:ff:ff:ff:ff:ff';
const BCAST_IP = '255.255.255.255';

// các option hay gặp (byte thô)
const OPT = {
  mask: { code: 1, data: [255, 255, 255, 0], desc: 'Subnet mask cấp cho client.' },
  router: { code: 3, data: [192, 168, 1, 1], desc: 'Default gateway.' },
  dns: { code: 6, data: [8, 8, 8, 8], desc: 'DNS server.' },
  lease: { code: 51, data: [0, 1, 0x51, 0x80], desc: 'Lease time = 86400s (1 ngày).' },
  serverId: { code: 54, data: [192, 168, 1, 1], desc: 'IP của DHCP server (để client biết nhận của ai).' },
  requested: { code: 50, data: [192, 168, 1, 100], desc: 'IP client xin lại (đúng cái vừa được OFFER).' },
};

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-04_Dich-vu-va-Bao-mat-co-ban/Bai-19_Dich-vu-DHCP.md',
  label: 'Bài 19 — Dịch vụ DHCP',
};

export const meta = {
  id: 's09-dhcp-dora',
  titleVi: 'DHCP DORA (xin cấp IP)',
  titleEn: 'DHCP DORA',
  descriptionVi: 'Client xin IP: Discover → Offer → Request → Ack. Xem broadcast 0.0.0.0→255.255.255.255, UDP 68/67, các option.',
  difficulty: 2,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'pc', type: 'host', name: 'Client', x: 150, y: 150, lines: ['chưa có IP', CLIENT.mac] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 500, y: 150, lines: ['LAN 192.168.1.0/24'] },
      { id: 'srv', type: 'host', name: 'DHCP Server', x: 850, y: 150, color: '#2e7d5b', lines: ['192.168.1.1'] },
    ],
    links: [{ id: 'l1', a: 'pc', b: 'sw' }, { id: 'l2', a: 'sw', b: 'srv' }],
  };

  const sim = new Sim(topology);

  const dhcp = (p) => sim.frame([
    { proto: 'ethernet', fields: { dst: p.ethDst, src: p.ethSrc, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: p.srcIp, dst: p.dstIp, ttl: 64, id: 0, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: p.sport, dstPort: p.dport } },
    { proto: 'dhcp', fields: { op: p.op, xid: XID, flags: 0x8000, yiaddr: p.yiaddr, siaddr: p.siaddr, chaddr: CLIENT.mac, options: p.options } },
  ]);

  // D — DISCOVER
  const disc = dhcp({ ethDst: BCAST_MAC, ethSrc: CLIENT.mac, srcIp: '0.0.0.0', dstIp: BCAST_IP, sport: 68, dport: 67,
    op: 1, options: [{ code: 53, data: [DHCP_MSG.DISCOVER] }, { code: 55, data: [1, 3, 6, 51], desc: 'Param Request List: xin mask, router, DNS, lease.' }] });
  sim.capture(disc, 'DHCP DISCOVER');
  sim.emit({ kind: 'process', atDevice: 'pc', side: 'encap', activeLayer: 7,
    titleVi: 'D — Client phát DISCOVER (broadcast)',
    packet: disc,
    explanationVi: 'Client chưa có IP nên gửi broadcast: IP nguồn 0.0.0.0, đích 255.255.255.255, UDP 68→67, MAC đích ff:ff:ff:ff:ff:ff. ' +
      'xid khóa cả 4 bản tin lại; Option 55 liệt kê tham số nó muốn xin.',
    lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'srv', side: 'encap', activeLayer: 7, titleVi: 'DISCOVER lan tới server', packet: disc,
    explanationVi: 'Switch flood broadcast; DHCP server nhận được.' });

  // O — OFFER
  const offerOpts = [{ code: 53, data: [DHCP_MSG.OFFER] }, OPT.serverId, OPT.lease, OPT.mask, OPT.router, OPT.dns];
  const offer = dhcp({ ethDst: BCAST_MAC, ethSrc: SRV.mac, srcIp: SRV.ip, dstIp: BCAST_IP, sport: 67, dport: 68, op: 2, yiaddr: OFFERED, siaddr: SRV.ip, options: offerOpts });
  sim.capture(offer, 'DHCP OFFER');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'pc', side: 'decap', activeLayer: 7,
    titleVi: 'O — Server gửi OFFER (đề nghị IP)',
    packet: offer,
    explanationVi: `Server trả OFFER: op=2 (Reply), yiaddr = ${OFFERED} (IP đề nghị), kèm Option 1 (mask), 3 (router), 6 (DNS), 51 (lease), 54 (server id). ` +
      'Vì client chưa có IP (cờ Broadcast = 1) nên server gửi broadcast.',
    lesson: LESSON });

  // R — REQUEST
  const req = dhcp({ ethDst: BCAST_MAC, ethSrc: CLIENT.mac, srcIp: '0.0.0.0', dstIp: BCAST_IP, sport: 68, dport: 67,
    op: 1, options: [{ code: 53, data: [DHCP_MSG.REQUEST] }, OPT.requested, OPT.serverId] });
  sim.capture(req, 'DHCP REQUEST');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'srv', side: 'encap', activeLayer: 7,
    titleVi: 'R — Client REQUEST (xin đúng IP đó, vẫn broadcast)',
    packet: req,
    explanationVi: `Client phát REQUEST broadcast: Option 50 = ${OFFERED} (xin đúng IP vừa OFFER), Option 54 = server đã chọn. ` +
      'Broadcast để các server KHÁC biết lời mời của họ bị từ chối.',
    lesson: LESSON });

  // A — ACK
  const ack = dhcp({ ethDst: BCAST_MAC, ethSrc: SRV.mac, srcIp: SRV.ip, dstIp: BCAST_IP, sport: 67, dport: 68, op: 2, yiaddr: OFFERED, siaddr: SRV.ip,
    options: [{ code: 53, data: [DHCP_MSG.ACK] }, OPT.serverId, OPT.lease, OPT.mask, OPT.router, OPT.dns] });
  sim.capture(ack, 'DHCP ACK');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'pc', side: 'decap', activeLayer: 7,
    titleVi: 'A — Server ACK: chốt hợp đồng thuê IP',
    packet: ack,
    explanationVi: `Server xác nhận bằng ACK (Option 53 = 5). Client nhận ${OFFERED}/24, gateway 192.168.1.1, DNS 8.8.8.8, lease 1 ngày — và bắt đầu dùng.`,
    lesson: LESSON });

  // Relay note
  sim.emit({ kind: 'process', atDevice: 'pc', side: 'inspect', activeLayer: 7,
    titleVi: 'Khi server ở mạng khác? Dùng DHCP Relay',
    explanationVi: 'Broadcast không qua được router. Nếu DHCP server nằm ở mạng khác, cấu hình "ip helper-address" trên cổng router: ' +
      'router nhận broadcast, chuyển thành UNICAST tới server, điền giaddr = IP cổng nhận (để server biết cấp từ dải nào). (Đơn giản hóa: kịch bản này server cùng LAN.)',
    lesson: LESSON });

  return sim.result();
}
