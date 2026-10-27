// scenarios/s26-ipv6-ndp.js
// Kịch bản 26 (CCNP): IPv6 + NDP.
// Ping IPv6 trong cùng link: NDP (Neighbor Solicitation/Advertisement, ICMPv6 135/136)
// THAY cho ARP để phân giải IPv6 → MAC; rồi ICMPv6 Echo Request/Reply (128/129).

import { Sim } from '../engine/simulate.js';

const A = { mac: '00:1a:2b:00:00:01', ip: '2001:db8::1' };
const B = { mac: '00:1a:2b:00:00:02', ip: '2001:db8::2' };
const SNM_MAC = '33:33:ff:00:00:02';   // multicast MAC của solicited-node ::2
const SNM_IP = 'ff02::1:ff00:2';        // solicited-node multicast của ::2

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-01_Nen-tang-mang/Bai-06_Dia-chi-IPv6.md',
  label: 'Bài 06 — Địa chỉ IPv6',
};

export const meta = {
  id: 's26-ipv6-ndp',
  titleVi: 'IPv6 + NDP (thay ARP)',
  titleEn: 'IPv6 & NDP',
  descriptionVi: 'Ping IPv6 cùng link: NDP Neighbor Solicitation/Advertisement thay ARP, rồi ICMPv6 Echo. Header IPv6 không có checksum; ICMPv6 có.',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 240',
    devices: [
      { id: 'a', type: 'host', name: 'PC-A', x: 180, y: 120, color: '#2c5f8a', lines: ['2001:db8::1'] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 500, y: 120, lines: ['link IPv6'] },
      { id: 'b', type: 'host', name: 'PC-B', x: 820, y: 120, color: '#2c5f8a', lines: ['2001:db8::2'] },
    ],
    links: [{ id: 'l1', a: 'a', b: 'sw' }, { id: 'l2', a: 'sw', b: 'b' }],
  };
  const sim = new Sim(topology);

  const ns = sim.frame([
    { proto: 'ethernet', fields: { dst: SNM_MAC, src: A.mac, etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src: A.ip, dst: SNM_IP, nextHeader: 58, hopLimit: 255 } },
    { proto: 'icmpv6', fields: { type: 135, target: B.ip, lladdr: A.mac } },
  ]);
  const na = sim.frame([
    { proto: 'ethernet', fields: { dst: A.mac, src: B.mac, etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src: B.ip, dst: A.ip, nextHeader: 58, hopLimit: 255 } },
    { proto: 'icmpv6', fields: { type: 136, target: B.ip, lladdr: B.mac, naS: true, naO: true } },
  ]);
  const echo = (type, from, to) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x86dd } },
    { proto: 'ipv6', fields: { src: from.ip, dst: to.ip, nextHeader: 58, hopLimit: 64 } },
    { proto: 'icmpv6', fields: { type, code: 0, identifier: 0x0abc, seq: 1, data: [0x61, 0x62, 0x63, 0x64] } },
  ]);

  sim.emit({ kind: 'process', atDevice: 'a', side: 'inspect', activeLayer: 3,
    titleVi: 'PC-A ping 2001:db8::2 — cần MAC → dùng NDP',
    decision: {
      question: 'IPv6 phân giải địa chỉ → MAC bằng gì (thay cho ARP của IPv4)?',
      options: ['ARP', 'NDP (ICMPv6 Neighbor Solicitation/Advertisement)', 'DHCPv6', 'DNS'],
      correct: 1,
      explainVi: 'IPv6 bỏ ARP; dùng NDP qua ICMPv6 (NS type 135 / NA type 136).',
    },
    explanationVi: 'Cùng link, cùng prefix → gửi trực tiếp, cần MAC của ::2. IPv6 KHÔNG có ARP; dùng NDP.',
    lesson: LESSON });

  sim.capture(ns, 'ICMPv6 Neighbor Solicitation (135)');
  sim.emit({ kind: 'transit', fromDevice: 'a', toDevice: 'b', side: 'encap', activeLayer: 3,
    titleVi: 'NS tới multicast solicited-node (không broadcast)', packet: ns,
    explanationVi: `NS gửi tới ${SNM_IP} (solicited-node multicast của ::2), MAC 33:33:ff:00:00:02, Hop Limit = 255. ` +
      'Target = 2001:db8::2, kèm option Source Link-Layer (MAC của A). Đỡ ồn hơn broadcast ARP.',
    lesson: LESSON });

  sim.capture(na, 'ICMPv6 Neighbor Advertisement (136)');
  sim.emit({ kind: 'transit', fromDevice: 'b', toDevice: 'a', side: 'decap', activeLayer: 3,
    titleVi: 'PC-B trả Neighbor Advertisement (S=1, O=1)', packet: na,
    explanationVi: 'PC-B đang nghe multicast solicited-node của mình → trả NA unicast: cờ Solicited=1, Override=1, Target=::2, kèm Target LLA (MAC B). PC-A có MAC B.',
    lesson: LESSON });

  const er = echo(128, A, B);
  sim.capture(er, 'ICMPv6 Echo Request (128)');
  sim.emit({ kind: 'transit', fromDevice: 'a', toDevice: 'b', side: 'encap', activeLayer: 3,
    titleVi: 'ICMPv6 Echo Request — chú ý IPv6 KHÔNG có checksum header', packet: er,
    explanationVi: 'Header IPv6 bỏ checksum (để router nhanh hơn, phó mặc cho L2 CRC + checksum L4). Nhưng ICMPv6 BẮT BUỘC có checksum (dùng pseudo-header IPv6). Hop Limit = 64.',
    lesson: LESSON });

  const ep = echo(129, B, A);
  sim.capture(ep, 'ICMPv6 Echo Reply (129)');
  sim.emit({ kind: 'transit', fromDevice: 'b', toDevice: 'a', side: 'decap', activeLayer: 3,
    titleVi: '✓ Echo Reply — ping IPv6 thành công', packet: ep,
    overlay: { links: { l1: { cls: 'forwarding' }, l2: { cls: 'forwarding', label: 'OK ✓' } } },
    explanationVi: 'PC-B trả Echo Reply (type 129). Ping IPv6 hoàn tất. Toàn bộ dùng ICMPv6 — cả NDP lẫn Echo đều là ICMPv6.',
    lesson: LESSON });

  return sim.result();
}
