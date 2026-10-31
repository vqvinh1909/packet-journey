// scenarios/s31-evpn.js
// Kịch bản 31 (DC): BGP EVPN, mặt phẳng điều khiển cho VXLAN.
// VTEP học MAC cục bộ rồi quảng bá bằng BGP EVPN route type 2 qua Spine (route reflector),
// nên VTEP bên kia biết trước MAC ở đâu, không phải flood; ARP được trả lời ngay tại VTEP.

import { Sim } from '../engine/simulate.js';
import { arpFrame, echoFrame, ARP_OP, ICMP_TYPE, BROADCAST_MAC } from './_common.js';

const HA = { mac: '00:aa:00:00:00:01', ip: '192.168.50.10' };
const HB = { mac: '00:aa:00:00:00:02', ip: '192.168.50.20' };
const V1 = { mac: '00:1a:2b:00:0e:01', ip: '10.0.0.1' };
const V2 = { mac: '00:1a:2b:00:0e:02', ip: '10.0.0.2' };
const SP = { mac: '00:1a:2b:00:0e:0a', ip: '10.0.0.100' };
const VNI = 5000;

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-08_Cau-hinh-va-quan-ly-VLAN.md',
  label: 'Bài 08 — VLAN (EVPN cho VXLAN: ngoài CCNA)',
};

export const meta = {
  id: 's31-evpn',
  titleVi: 'BGP EVPN: mặt phẳng điều khiển cho VXLAN',
  titleEn: 'BGP EVPN control plane',
  descriptionVi: 'VTEP quảng bá MAC và IP của host bằng BGP EVPN route type 2 qua Spine, nên không cần flood để học MAC, ARP được trả lời ngay tại VTEP.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1100 260',
    devices: [
      { id: 'ha', type: 'host', name: 'Host-A', x: 90, y: 120, color: '#2c5f8a', lines: ['192.168.50.10', 'VNI 5000'] },
      { id: 'v1', type: 'switch', name: 'VTEP1', x: 320, y: 120, lines: ['10.0.0.1'] },
      { id: 'sp', type: 'router', name: 'Spine', x: 550, y: 120, lines: ['Route Reflector', '10.0.0.100'] },
      { id: 'v2', type: 'switch', name: 'VTEP2', x: 780, y: 120, lines: ['10.0.0.2'] },
      { id: 'hb', type: 'host', name: 'Host-B', x: 1010, y: 120, color: '#2c5f8a', lines: ['192.168.50.20', 'VNI 5000'] },
    ],
    links: [
      { id: 'l1', a: 'ha', b: 'v1' },
      { id: 'l2', a: 'v1', b: 'sp' },
      { id: 'l3', a: 'sp', b: 'v2' },
      { id: 'l4', a: 'v2', b: 'hb' },
    ],
  };
  const sim = new Sim(topology);

  // VTEP1 và VTEP2 đều nói iBGP với Spine, Spine phản xạ route và giữ nguyên next hop là VTEP gốc.
  const evpn = (from, to, host, vtep) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: from.ip, dst: to.ip, ttl: 255, id: 0x3100, protocol: 6 } },
    { proto: 'tcp', fields: { srcPort: 40179, dstPort: 179, seq: 1000, ack: 2000, flags: { ack: true, psh: true }, window: 16384 } },
    { proto: 'bgp', fields: { type: 2, evpn: { rd: vtep.ip, mac: host.mac, ip: host.ip, vni: VNI, nextHop: vtep.ip, rt: [65000, VNI] } } },
  ]);
  const inner = () => echoFrame({ ethDst: HB.mac, ethSrc: HA.mac, srcIp: HA.ip, dstIp: HB.ip, ttl: 64, ipId: 0x9101, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST });
  const vxlan = (dst, src) => sim.frame([
    { proto: 'ethernet', fields: { dst: dst.mac, src: src.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: V1.ip, dst: V2.ip, ttl: 64, id: 0x5150, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 54321, dstPort: 4789 } },
    { proto: 'vxlan', fields: { vni: VNI } },
    ...inner(),
  ]);
  const arpReq = sim.frame(arpFrame({ op: ARP_OP.REQUEST, senderMac: HA.mac, senderIp: HA.ip, targetMac: '00:00:00:00:00:00', targetIp: HB.ip, ethDst: BROADCAST_MAC }));
  const arpRep = sim.frame(arpFrame({ op: ARP_OP.REPLY, senderMac: HB.mac, senderIp: HB.ip, targetMac: HA.mac, targetIp: HA.ip, ethDst: HA.mac }));
  const macTable = (v, rows, highlight) => ({ mac: { title: `Bảng MAC ${v}, VNI 5000`, rows, highlight } });
  const A_LOCAL = { mac: HA.mac, port: 'Fa0/1' }, B_LOCAL = { mac: HB.mac, port: 'Fa0/1' };
  const A_REMOTE = { mac: HA.mac, port: 'VTEP 10.0.0.1 (EVPN)' }, B_REMOTE = { mac: HB.mac, port: 'VTEP 10.0.0.2 (EVPN)' };

  const u1 = evpn(V1, SP, HA, V1);
  sim.emit({ kind: 'process', atDevice: 'v1', side: 'encap', activeLayer: 2,
    titleVi: 'VTEP1 học MAC của Host-A trên cổng cục bộ', packet: u1, tables: macTable('VTEP1', [A_LOCAL]),
    explanationVi: 'Host-A vừa gửi khung đầu tiên. VTEP1 học MAC như switch thường. Khác VXLAN học bằng flood: VTEP1 không chờ VTEP khác tự học mà chủ động báo qua BGP.', lesson: LESSON });
  sim.capture(u1, 'BGP UPDATE EVPN type 2: MAC của Host-A');
  sim.emit({ kind: 'transit', fromDevice: 'v1', toDevice: 'sp', side: 'forward', activeLayer: 7,
    titleVi: 'VTEP1 gửi EVPN route type 2 lên Spine', packet: u1,
    overlay: { links: { l2: { cls: 'trunk', label: 'BGP EVPN' } } },
    explanationVi: 'Xem cây trường: MP_REACH_NLRI có AFI 25, SAFI 70 (L2VPN EVPN). Route type 2 mang MAC, IP, VNI. Next hop là VTEP1. Route Target quyết định VTEP nào nhập route này, còn extended community báo kiểu đóng gói VXLAN.', lesson: LESSON });
  const u2 = evpn(SP, V2, HA, V1);
  sim.emit({ kind: 'transit', fromDevice: 'sp', toDevice: 'v2', side: 'forward', activeLayer: 7,
    titleVi: 'Spine phản xạ route sang VTEP2, giữ nguyên next hop', packet: u2,
    overlay: { links: { l3: { cls: 'trunk', label: 'BGP EVPN' } } },
    explanationVi: 'Spine là route reflector, không cần full-mesh iBGP giữa các VTEP. Next hop vẫn là 10.0.0.1 vì dữ liệu sẽ đi thẳng tới VTEP1. Spine chỉ chuyển route, không phải là VTEP.', lesson: LESSON });
  sim.emit({ kind: 'process', atDevice: 'v2', side: 'decap', activeLayer: 2,
    titleVi: 'VTEP2 cài MAC của Host-A: ở sau VTEP 10.0.0.1', packet: u2, tables: macTable('VTEP2', [B_LOCAL, A_REMOTE], HA.mac),
    explanationVi: 'VTEP2 nhập route vì Route Target khớp VNI 5000. MAC của Host-A vào bảng mà không cần một khung flood nào. Host-B cũng được VTEP2 quảng bá ngược lại theo cách tương tự.', lesson: LESSON });

  const u3 = evpn(V2, SP, HB, V2);
  sim.capture(u3, 'BGP UPDATE EVPN type 2: MAC của Host-B');
  sim.emit({ kind: 'transit', fromDevice: 'v2', toDevice: 'sp', side: 'forward', activeLayer: 7,
    titleVi: 'VTEP2 quảng bá MAC và IP của Host-B', packet: u3,
    overlay: { links: { l3: { cls: 'trunk', label: 'BGP EVPN' } } },
    explanationVi: 'Lần này route mang MAC, IP của Host-B, next hop 10.0.0.2. Spine phản xạ sang VTEP1.' });
  const u4 = evpn(SP, V1, HB, V2);
  sim.emit({ kind: 'transit', fromDevice: 'sp', toDevice: 'v1', side: 'forward', activeLayer: 7,
    titleVi: 'VTEP1 nhận route, biết Host-B ở sau 10.0.0.2', packet: u4, tables: macTable('VTEP1', [A_LOCAL, B_REMOTE], HB.mac),
    overlay: { links: { l2: { cls: 'trunk', label: 'BGP EVPN' } } },
    explanationVi: 'VTEP1 giờ biết cả MAC và IP của Host-B. Thông tin này đủ để nó tự trả lời ARP thay cho Host-B.', lesson: LESSON });

  sim.capture(arpReq, 'ARP Request của Host-A');
  sim.emit({ kind: 'transit', fromDevice: 'ha', toDevice: 'v1', side: 'encap', activeLayer: 2,
    titleVi: 'Host-A hỏi ARP tìm 192.168.50.20', packet: arpReq,
    explanationVi: 'Host-A chưa biết MAC của Host-B nên gửi ARP broadcast như bình thường. Trong VXLAN học bằng flood, khung này phải được nhân bản tới mọi VTEP cùng VNI.', lesson: LESSON });
  sim.capture(arpRep, 'ARP Reply do VTEP1 trả thay');
  sim.emit({ kind: 'transit', fromDevice: 'v1', toDevice: 'ha', side: 'decap', activeLayer: 2,
    titleVi: 'ARP suppression: VTEP1 trả lời ngay, không flood', packet: arpRep,
    overlay: { links: { l1: { cls: 'forwarding', label: 'ARP Reply' }, l2: { label: 'không flood' } } },
    explanationVi: 'VTEP1 đã có cặp IP và MAC từ route type 2 nên tự trả ARP Reply với MAC của Host-B. Broadcast không đi vào fabric, giảm đáng kể lưu lượng BUM khi mạng lớn.', lesson: LESSON });

  const d1 = vxlan(SP, V1);
  sim.capture(d1, 'VXLAN VNI 5000 (VTEP1 → Spine)');
  sim.emit({ kind: 'process', atDevice: 'v1', side: 'encap', activeLayer: 4.5,
    titleVi: 'Dữ liệu: VTEP1 đóng gói VXLAN gửi thẳng tới VTEP2', packet: d1,
    overlay: { links: { l2: { cls: 'forwarding', label: 'VXLAN VNI 5000' } } },
    explanationVi: 'Mặt phẳng dữ liệu vẫn là VXLAN như s30: UDP 4789, VNI 5000. EVPN chỉ thay cách các VTEP biết nhau. Gói đi thẳng tới 10.0.0.2 ngay từ khung đầu tiên.', lesson: LESSON });
  const d2 = vxlan(V2, SP);
  sim.emit({ kind: 'transit', fromDevice: 'sp', toDevice: 'v2', side: 'forward', activeLayer: 3,
    titleVi: 'Spine định tuyến theo IP ngoài, không biết VNI', packet: d2,
    overlay: { links: { l3: { cls: 'forwarding', label: 'VXLAN VNI 5000' } } },
    explanationVi: 'Ở mặt phẳng dữ liệu, Spine chỉ định tuyến IP 10.0.0.1 → 10.0.0.2. Lõi không cần bảng MAC của host.' });
  const f = sim.frame(inner());
  sim.capture(f, 'Khung gốc (VTEP2 → Host-B)');
  sim.emit({ kind: 'transit', fromDevice: 'v2', toDevice: 'hb', side: 'decap', activeLayer: 2,
    titleVi: '✓ Host-B nhận khung, không có khung flood nào trong fabric', packet: f,
    overlay: { links: { l4: { cls: 'forwarding', label: 'khung gốc' } } },
    explanationVi: 'VTEP2 gỡ VXLAN và giao khung gốc. Tóm lại, EVPN chuyển việc học MAC từ flood sang BGP: ít broadcast hơn, phát hiện host di chuyển tốt hơn và dễ mở rộng hơn.', lesson: LESSON });

  return sim.result();
}
