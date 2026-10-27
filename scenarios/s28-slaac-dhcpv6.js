// scenarios/s28-slaac-dhcpv6.js
// Kịch bản 28 (CCNP/IPv6): Tự cấu hình địa chỉ IPv6 — SLAAC & DHCPv6.
// Host gửi Router Solicitation; Router Advertisement mang prefix + cờ M/O quyết định:
//   M=0,A=1 → SLAAC (host tự ghép prefix + Interface ID, rồi DAD).
//   M=1     → DHCPv6 stateful (Solicit → Advertise → Request → Reply).

import { Sim } from '../engine/simulate.js';
import { parseIpv6 } from '../packet/addr.js';

const PC = { mac: '00:1a:2b:00:00:01', ll: 'fe80::1' };
const RT = { mac: '00:1a:2b:00:00:ff', ll: 'fe80::ff' };
const SRV = { mac: '00:1a:2b:00:00:53', ll: 'fe80::53' };
const PREFIX = '2001:db8:1::';
const SLAAC_ADDR = '2001:db8:1::1';
const DHCP_ADDR = '2001:db8:1::100';
const DUID = [0x00, 0x01, 0x00, 0x01, 0x12, 0x34, 0x56, 0x78, 0x00, 0x1a, 0x2b, 0x00, 0x00, 0x01];

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-01_Nen-tang-mang/Bai-06_Dia-chi-IPv6.md',
  label: 'Bài 06 — Địa chỉ IPv6',
};

export const meta = {
  id: 's28-slaac-dhcpv6',
  titleVi: 'SLAAC & DHCPv6 (tự cấu hình IPv6)',
  titleEn: 'SLAAC & DHCPv6',
  descriptionVi: 'Host xin cấu hình địa chỉ IPv6: RS/RA, SLAAC tự sinh địa chỉ + DAD, và DHCPv6 stateful (Solicit/Advertise/Request/Reply).',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'pc', type: 'host', name: 'PC', x: 160, y: 100, color: '#2c5f8a', lines: ['fe80::1', 'xin địa chỉ IPv6'] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 470, y: 180, lines: [] },
      { id: 'rt', type: 'router', name: 'Router', x: 780, y: 90, lines: ['fe80::ff', 'phát RA'] },
      { id: 'srv', type: 'host', name: 'DHCPv6', x: 780, y: 270, color: '#2e7d5b', lines: ['fe80::53'] },
    ],
    links: [{ id: 'l1', a: 'pc', b: 'sw' }, { id: 'l2', a: 'sw', b: 'rt' }, { id: 'l3', a: 'sw', b: 'srv' }],
  };
  const sim = new Sim(topology);

  const nd = (fromMac, toMac, src, dst, fields) => sim.frame([
    { proto: 'ethernet', fields: { dst: toMac, src: fromMac, etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src, dst, nextHeader: 58, hopLimit: 255 } },
    { proto: 'icmpv6', fields },
  ]);
  const dhcp6 = (fromMac, toMac, src, dst, sport, dport, msgType, xid, options) => sim.frame([
    { proto: 'ethernet', fields: { dst: toMac, src: fromMac, etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src, dst, nextHeader: 17, hopLimit: 1 } },
    { proto: 'udp', fields: { srcPort: sport, dstPort: dport } },
    { proto: 'dhcpv6', fields: { msgType, xid, options } },
  ]);

  // IA_NA option data = IAID(4)+T1(4)+T2(4) [+ IA Address sub-option khi có địa chỉ]
  const iaNa = (addr) => {
    const base = [0, 0, 0, 1, 0, 0, 1, 0x2c, 0, 0, 2, 0x58]; // IAID 1, T1 300, T2 600
    if (!addr) return base;
    const iaAddr = [0, 5, 0, 24, ...parseIpv6(addr), 0, 0, 1, 0x2c, 0, 0, 2, 0x58]; // opt5 len24 addr pref valid
    return [...base, ...iaAddr];
  };
  const clientId = { code: 1, data: DUID, display: 'DUID client', desc: 'Định danh client (DUID).' };
  const serverId = { code: 2, data: [0, 1, 0, 1, 0x99, 0x88, 0x77, 0x66, 0, 0x53, 0, 0, 0, 1], display: 'DUID server', desc: 'Định danh server.' };

  sim.emit({ kind: 'process', atDevice: 'pc', side: 'inspect', activeLayer: 3,
    titleVi: 'Host IPv6 tự cấu hình địa chỉ bằng cách nào?',
    explanationVi: 'Sau khi có link-local (fe80::), host muốn địa chỉ global. Nó hỏi router bằng Router Solicitation; RA trả về sẽ quyết định: ' +
      'SLAAC (tự tính) hay DHCPv6 (xin server) — dựa vào cờ M (Managed) và A (Autonomous) trong RA.',
    lesson: LESSON });

  // RS
  const rs = nd(PC.mac, '33:33:00:00:00:02', PC.ll, 'ff02::2', { type: 133, lladdr: PC.mac });
  sim.capture(rs, 'ICMPv6 Router Solicitation (133)');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'rt', side: 'encap', activeLayer: 3,
    titleVi: 'PC gửi Router Solicitation → ff02::2 (all-routers)', packet: rs,
    explanationVi: 'RS hỏi "router nào đây, cho tôi prefix". Gửi tới multicast mọi router ff02::2, Hop Limit 255.', lesson: LESSON });

  // RA (SLAAC)
  const ra = nd(RT.mac, '33:33:00:00:00:01', RT.ll, 'ff02::1', { type: 134, raM: false, raO: false, raCurHop: 64, raLifetime: 1800, prefix: PREFIX, prefixLen: 64 });
  sim.capture(ra, 'ICMPv6 Router Advertisement (134)');
  sim.emit({ kind: 'transit', fromDevice: 'rt', toDevice: 'pc', side: 'decap', activeLayer: 3,
    titleVi: 'RA: prefix 2001:db8:1::/64, cờ A=1 M=0 → SLAAC', packet: ra,
    explanationVi: 'Router quảng bá Prefix Information 2001:db8:1::/64 với cờ A=1 (được tự sinh địa chỉ) và M=0 (không cần DHCPv6). ' +
      'Nguồn RA là link-local fe80::ff của router (đó cũng là default gateway của host).',
    lesson: LESSON });

  // SLAAC tạo địa chỉ + DAD
  const dad = nd(PC.mac, '33:33:ff:00:00:01', '::', 'ff02::1:ff00:1', { type: 135, target: SLAAC_ADDR });
  sim.capture(dad, 'ICMPv6 NS (DAD)');
  sim.emit({ kind: 'process', atDevice: 'pc', side: 'inspect', activeLayer: 3,
    titleVi: 'SLAAC: ghép địa chỉ rồi DAD (dò trùng)', packet: dad,
    overlay: { badges: { pc: '2001:db8:1::1' } },
    explanationVi: `PC tự ghép: prefix 2001:db8:1:: + Interface ID → ${SLAAC_ADDR}. Trước khi dùng, nó làm DAD: gửi Neighbor Solicitation ` +
      'với IP nguồn = :: (chưa chính thức) tới địa chỉ tentative; không ai trả lời → không trùng → địa chỉ dùng được. KHÔNG cần server.',
    lesson: LESSON });

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 7,
    titleVi: 'Nếu RA đặt M=1 → dùng DHCPv6 (stateful)',
    explanationVi: 'Khi admin muốn QUẢN LÝ địa chỉ tập trung (ghi sổ ai nhận gì), RA đặt M=1. Host chuyển sang DHCPv6: giống DORA của IPv4 nhưng tên khác — ' +
      'Solicit → Advertise → Request → Reply, chạy trên UDP 546/547.',
    lesson: LESSON });

  const XID = 0xabcdef;
  const sol = dhcp6(PC.mac, '33:33:00:01:00:02', PC.ll, 'ff02::1:2', 546, 547, 1, XID, [clientId, { code: 3, data: iaNa(), display: 'IA_NA (xin 1 địa chỉ)', desc: 'Identity Association for Non-temporary Address.' }]);
  sim.capture(sol, 'DHCPv6 SOLICIT');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'srv', side: 'encap', activeLayer: 7,
    titleVi: 'SOLICIT: tìm server (ff02::1:2, UDP 546→547)', packet: sol,
    explanationVi: 'Client gửi SOLICIT tới multicast All-DHCP-Servers ff02::1:2, kèm Client ID (DUID) và IA_NA (xin một địa chỉ). Dùng nguồn link-local.', lesson: LESSON });

  const adv = dhcp6(SRV.mac, PC.mac, SRV.ll, PC.ll, 547, 546, 2, XID, [clientId, serverId, { code: 3, data: iaNa(DHCP_ADDR), display: `IA_NA → ${DHCP_ADDR}`, desc: 'Địa chỉ server đề nghị.' }]);
  sim.capture(adv, 'DHCPv6 ADVERTISE');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'pc', side: 'decap', activeLayer: 7,
    titleVi: `ADVERTISE: server đề nghị ${DHCP_ADDR}`, packet: adv,
    explanationVi: 'Server trả ADVERTISE: kèm Server ID và IA_NA chứa IA Address = địa chỉ đề nghị + thời hạn (preferred/valid lifetime).', lesson: LESSON });

  const req = dhcp6(PC.mac, '33:33:00:01:00:02', PC.ll, 'ff02::1:2', 546, 547, 3, XID, [clientId, serverId, { code: 3, data: iaNa(DHCP_ADDR), display: `IA_NA xin ${DHCP_ADDR}`, desc: 'Xin đúng địa chỉ vừa được đề nghị.' }]);
  sim.capture(req, 'DHCPv6 REQUEST');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'srv', side: 'encap', activeLayer: 7,
    titleVi: 'REQUEST: xin chính địa chỉ đó (kèm Server ID)', packet: req,
    explanationVi: 'Client chọn server (qua Server ID) và REQUEST đúng địa chỉ đã ADVERTISE.', lesson: LESSON });

  const rep = dhcp6(SRV.mac, PC.mac, SRV.ll, PC.ll, 547, 546, 7, XID, [clientId, serverId, { code: 3, data: iaNa(DHCP_ADDR), display: `IA_NA cấp ${DHCP_ADDR}`, desc: 'Chốt địa chỉ.' }]);
  sim.capture(rep, 'DHCPv6 REPLY');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'pc', side: 'decap', activeLayer: 7,
    titleVi: `✓ REPLY: chốt ${DHCP_ADDR}`, packet: rep,
    overlay: { badges: { pc: DHCP_ADDR } },
    explanationVi: `Server REPLY xác nhận ${DHCP_ADDR} cho client (kèm DNS... nếu có). So với IPv4: SOLICIT↔Discover, ADVERTISE↔Offer, REQUEST↔Request, REPLY↔Ack. ` +
      '(Đơn giản hóa: DUID/IA_NA rút gọn.)',
    lesson: LESSON });

  return sim.result();
}
