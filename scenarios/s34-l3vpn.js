// scenarios/s34-l3vpn.js
// Kịch bản 34 (ENARSI 2.1, 2.2): MPLS L3VPN.
// LDP cấp nhãn vận chuyển, MP-BGP cấp nhãn VPN, gói đi với hai nhãn, PHP gỡ nhãn ngoài.

import { Sim } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

const CE1 = { mac: '00:aa:00:00:34:01', ip: '192.168.1.10' };
const CE2 = { mac: '00:aa:00:00:34:02', ip: '192.168.2.20' };
const PE1 = { mac: '00:1a:2b:00:34:01', ip: '1.1.1.1' };
const P = { mac: '00:1a:2b:00:34:02', ip: '2.2.2.2' };
const PE2 = { mac: '00:1a:2b:00:34:03', ip: '3.3.3.3' };
const LDP_MAC = '01:00:5e:00:00:02';

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Định tuyến (MPLS L3VPN: ENARSI 2.1, 2.2)',
};

export const meta = {
  id: 's34-l3vpn',
  titleVi: 'MPLS L3VPN: LDP, VPNv4 và hai lớp nhãn',
  titleEn: 'MPLS L3VPN: LDP, VPNv4, two labels',
  descriptionVi: 'LDP cấp nhãn để đi tới PE, MP-BGP cấp nhãn để vào đúng VRF. Gói qua lõi mang hai nhãn, nên hai khách hàng dùng trùng địa chỉ vẫn không lẫn.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 260',
    devices: [
      { id: 'ce1', type: 'host', name: 'Site1', x: 90, y: 120, color: '#2c5f8a', lines: ['192.168.1.10', 'VRF A'] },
      { id: 'pe1', type: 'router', name: 'PE1', x: 300, y: 120, lines: ['1.1.1.1'] },
      { id: 'p', type: 'router', name: 'P', x: 500, y: 120, lines: ['2.2.2.2'] },
      { id: 'pe2', type: 'router', name: 'PE2', x: 700, y: 120, lines: ['3.3.3.3'] },
      { id: 'ce2', type: 'host', name: 'Site2', x: 910, y: 120, color: '#2c5f8a', lines: ['192.168.2.20', 'VRF A'] },
    ],
    links: [
      { id: 'l1', a: 'ce1', b: 'pe1' },
      { id: 'l2', a: 'pe1', b: 'p', labelMid: 'MPLS' },
      { id: 'l3', a: 'p', b: 'pe2', labelMid: 'MPLS' },
      { id: 'l4', a: 'pe2', b: 'ce2' },
    ],
  };
  const sim = new Sim(topology);

  const eth = (dst, src, etherType = 0x0800) => ({ proto: 'ethernet', fields: { dst, src, etherType } });
  // bên LSR ID lớn hơn chủ động mở TCP: gửi từ cổng tạm tới 646 của bên kia
  const tcpLdp = { proto: 'tcp', fields: { srcPort: 41646, dstPort: 646, seq: 1000, ack: 2000, flags: { ack: true, psh: true }, window: 16384 } };
  const mapping = (from, to, label) => sim.frame([eth(to.mac, from.mac), { proto: 'ipv4', fields: { src: from.ip, dst: to.ip, ttl: 1, id: 0x3400, protocol: 6 } }, tcpLdp, { proto: 'ldp', fields: { lsrId: from.ip, fec: PE2.ip, prefix: 32, label } } ]);
  const lfib = (who, rows) => ({ list: { title: `LFIB ${who}`, cols: ['Nhãn vào', 'Nhãn ra', 'Đích'], rows } });
  const vrfTable = (who, rows) => ({ list: { title: `Bảng VRF A trên ${who}`, cols: ['Prefix', 'Next hop', 'Nhãn VPN'], rows } });

  const hello = sim.frame([eth(LDP_MAC, P.mac), { proto: 'ipv4', fields: { src: '10.0.23.2', dst: '224.0.0.2', ttl: 1, id: 0x3401, protocol: 17 } }, { proto: 'udp', fields: { srcPort: 646, dstPort: 646 } }, { proto: 'ldp', fields: { lsrId: P.ip, hello: true } }]);
  sim.capture(hello, 'LDP Hello');
  sim.emit({ kind: 'transit', fromDevice: 'p', toDevice: 'pe2', side: 'forward', activeLayer: 4.5,
    titleVi: 'LDP Hello: tìm láng giềng trên UDP 646', packet: hello,
    overlay: { links: { l3: { label: 'LDP Hello' } } },
    explanationVi: 'Hello gửi tới 224.0.0.2. Bên có LSR ID lớn hơn mở phiên TCP 646. Lỗi hay gặp: loopback làm LSR ID không có đường trong IGP, nên phiên TCP không lên dù Hello vẫn thấy.', lesson: LESSON });

  const m1 = mapping(PE2, P, 3);
  sim.capture(m1, 'LDP Label Mapping: 3.3.3.3/32 nhãn 3');
  sim.emit({ kind: 'transit', fromDevice: 'pe2', toDevice: 'p', side: 'forward', activeLayer: 4.5,
    titleVi: 'PE2 báo: tới 3.3.3.3 dùng nhãn 3 (implicit null)', packet: m1,
    overlay: { links: { l3: { cls: 'trunk', label: 'FEC 3.3.3.3 → 3' } } },
    explanationVi: 'Nhãn 3 yêu cầu chặng trước gỡ nhãn ngoài. Đây là Penultimate Hop Popping, giúp PE2 không phải tra hai lần.', lesson: LESSON });
  const m2 = mapping(P, PE1, 16);
  sim.capture(m2, 'LDP Label Mapping: 3.3.3.3/32 nhãn 16');
  sim.emit({ kind: 'transit', fromDevice: 'p', toDevice: 'pe1', side: 'forward', activeLayer: 4.5,
    titleVi: 'P báo: tới 3.3.3.3 dùng nhãn 16', packet: m2, tables: lfib('P', [['16', 'pop', '3.3.3.3/32 qua PE2']]),
    overlay: { links: { l2: { cls: 'trunk', label: 'FEC 3.3.3.3 → 16' } } },
    explanationVi: 'Mỗi router tự cấp nhãn riêng, chỉ có ý nghĩa trên chặng đó. LDP đi theo IGP nên đường nhãn trùng với đường OSPF.', lesson: LESSON });

  const update = (layers) => [...layers, { proto: 'ipv4', fields: { src: PE2.ip, dst: PE1.ip, ttl: 254, id: 0x3402, protocol: 6 } }, { proto: 'tcp', fields: { srcPort: 41179, dstPort: 179, seq: 1000, ack: 2000, flags: { ack: true, psh: true }, window: 16384 } }, { proto: 'bgp', fields: { type: 2, vpnv4: { rd: [65000, 1], prefix: '192.168.2.0', len: 24, label: 100, nextHop: PE2.ip, rt: [65000, 1] } } }];
  const u1 = sim.frame(update([eth(P.mac, PE2.mac, 0x8847), { proto: 'mpls', fields: { label: 17, tc: 0, s: 1, ttl: 255 } }]));
  sim.emit({ kind: 'process', atDevice: 'pe2', side: 'encap', activeLayer: 7,
    titleVi: 'PE2 đưa route của Site2 vào VPNv4, cấp nhãn VPN 100', packet: u1, tables: vrfTable('PE2', [['192.168.2.0/24', 'Site2', '100 (cục bộ)']]),
    explanationVi: 'PE2 học 192.168.2.0/24 từ CE trong VRF A. Thêm RD 65000:1 để prefix thành duy nhất, gắn Route Target 65000:1 để chỉ định VRF nào được nhập.', lesson: LESSON });
  sim.capture(u1, 'MP-BGP VPNv4 UPDATE');
  sim.emit({ kind: 'transit', fromDevice: 'pe2', toDevice: 'p', side: 'forward', activeLayer: 7,
    titleVi: 'PE2 gửi VPNv4 UPDATE tới PE1', packet: u1,
    overlay: { links: { l3: { cls: 'trunk', label: 'VPNv4' } } },
    explanationVi: 'Xem MP_REACH_NLRI: AFI 1, SAFI 128, NLRI gồm nhãn, RD và prefix. Router P không chạy BGP, chỉ chuyển gói theo nhãn. Đó là lý do lõi không phải biết route khách hàng.', lesson: LESSON });
  const u2 = sim.frame(update([eth(PE1.mac, P.mac)]));
  sim.emit({ kind: 'transit', fromDevice: 'p', toDevice: 'pe1', side: 'forward', activeLayer: 7,
    titleVi: 'PE1 nhập route vào VRF A vì Route Target khớp', packet: u2, tables: vrfTable('PE1', [['192.168.2.0/24', '3.3.3.3', '100']]),
    overlay: { links: { l2: { cls: 'trunk', label: 'VPNv4' } } },
    explanationVi: 'RD chỉ làm prefix khác nhau. RT mới quyết định nhập vào VRF nào. Lỗi hay gặp là import và export RT không khớp: BGP có route nhưng bảng VRF không có.', lesson: LESSON });

  const inner = (dst, src, ttl) => echoFrame({ ethDst: dst, ethSrc: src, srcIp: CE1.ip, dstIp: CE2.ip, ttl, ipId: 0x3403, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST });
  const a = sim.frame(inner(PE1.mac, CE1.mac, 64));
  sim.capture(a, 'Gói IP từ Site1');
  sim.emit({ kind: 'transit', fromDevice: 'ce1', toDevice: 'pe1', side: 'encap', activeLayer: 3,
    titleVi: 'Site1 gửi gói IP thường', packet: a,
    overlay: { links: { l1: { cls: 'forwarding', label: 'IP' } } },
    explanationVi: 'Khách hàng không biết gì về MPLS. Cổng vào trên PE1 gắn với VRF A, nên PE1 tra đúng bảng của khách này.', lesson: LESSON });

  const ipLayers = inner('00:00:00:00:00:00', '00:00:00:00:00:00', 63).slice(1);
  const stack = (dst, src, labels, ttl) => sim.frame([eth(dst, src, 0x8847), ...labels.map((label, i) => ({ proto: 'mpls', fields: { label, tc: 0, s: i === labels.length - 1 ? 1 : 0, ttl } })), ...ipLayers]);
  const two = stack(P.mac, PE1.mac, [16, 100], 255); // không chép TTL IP vào nhãn, giống s29
  sim.capture(two, 'Hai nhãn: 16 ngoài, 100 trong');
  sim.emit({ kind: 'process', atDevice: 'pe1', side: 'encap', activeLayer: 2.5,
    titleVi: 'PE1 gắn hai nhãn: 16 để tới PE2, 100 để vào VRF', packet: two,
    overlay: { links: { l2: { cls: 'trunk', label: '[16 | 100]' } } },
    explanationVi: 'Nhãn trong 100 lấy từ BGP. Nhãn ngoài 16 lấy từ LDP cho next hop 3.3.3.3. Nhãn đáy có S=1. Khi next hop BGP không có nhãn LDP, gói không gửi được: đó là lỗi đầu tiên cần kiểm tra.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'pe1', toDevice: 'p', side: 'forward', activeLayer: 2.5,
    titleVi: 'Gói vào lõi với hai nhãn', packet: two,
    overlay: { links: { l2: { cls: 'trunk', label: '[16 | 100]' } } },
    explanationVi: 'Router P chỉ nhìn nhãn ngoài, không đọc địa chỉ khách hàng.', lesson: LESSON });
  const one = stack(PE2.mac, P.mac, [100], 254); // P giảm TTL nhãn ngoài rồi chép xuống nhãn còn lại khi PHP
  sim.capture(one, 'P gỡ nhãn ngoài, còn nhãn 100');
  sim.emit({ kind: 'transit', fromDevice: 'p', toDevice: 'pe2', side: 'forward', activeLayer: 2.5,
    titleVi: 'P gỡ nhãn ngoài (PHP), chỉ còn nhãn VPN', packet: one, tables: lfib('P', [['16', 'pop', '3.3.3.3/32 qua PE2']]),
    overlay: { links: { l3: { cls: 'trunk', label: '[100]' } } },
    explanationVi: 'PE2 đã báo implicit null, nên P gỡ nhãn 16 và giữ nguyên nhãn 100. So sánh với s29: lần này vẫn còn một nhãn sau khi gỡ.', lesson: LESSON });
  const out = sim.frame(inner(CE2.mac, PE2.mac, 62));
  sim.capture(out, 'Gói IP tới Site2');
  sim.emit({ kind: 'transit', fromDevice: 'pe2', toDevice: 'ce2', side: 'decap', activeLayer: 3,
    titleVi: '✓ PE2 dùng nhãn 100 để chọn VRF A, giao gói IP', packet: out, tables: vrfTable('PE2', [['192.168.2.0/24', 'Site2', '100 (cục bộ)']]),
    overlay: { links: { l4: { cls: 'forwarding', label: 'IP' } } },
    explanationVi: 'Một khách hàng khác cũng dùng 192.168.2.0/24 sẽ có RD, RT và nhãn VPN khác, nên hai luồng không lẫn. Khi kiểm tra sự cố, đi lần lượt: IGP, LDP, phiên VPNv4, RT, rồi tới route CE.', lesson: LESSON });

  return sim.result();
}
