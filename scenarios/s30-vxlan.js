// scenarios/s30-vxlan.js
// Kịch bản 30 (CCNP/DC): VXLAN overlay.
// 2 host cùng một mạng L2 ảo (VNI) nhưng ở 2 nơi, nối qua hạ tầng L3. VTEP đóng gói
// NGUYÊN khung Ethernet gốc vào VXLAN + UDP 4789 + IP ngoài, gửi qua underlay rồi gỡ ra.

import { Sim } from '../engine/simulate.js';
import { echoFrame } from './_common.js';
import { ICMP_TYPE } from './_common.js';

const HA = { mac: '00:aa:00:00:00:01', ip: '192.168.50.10' };
const HB = { mac: '00:aa:00:00:00:02', ip: '192.168.50.20' };
const V1 = { mac: '00:1a:2b:00:0e:01', ip: '10.0.0.1' }; // VTEP1 underlay
const V2 = { mac: '00:1a:2b:00:0e:02', ip: '10.0.0.2' }; // VTEP2 underlay
const VNI = 5000;

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-08_Cau-hinh-va-quan-ly-VLAN.md',
  label: 'Bài 08 — VLAN (VXLAN mở rộng L2: ngoài CCNA)',
};

export const meta = {
  id: 's30-vxlan',
  titleVi: 'VXLAN overlay (L2 trên L3)',
  titleEn: 'VXLAN overlay',
  descriptionVi: '2 host cùng VNI 5000 ở 2 nơi, nối qua L3. VTEP bọc khung gốc vào VXLAN+UDP 4789+IP ngoài, gửi qua underlay rồi gỡ ra.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 240',
    devices: [
      { id: 'ha', type: 'host', name: 'Host-A', x: 120, y: 120, color: '#2c5f8a', lines: ['192.168.50.10', 'VNI 5000'] },
      { id: 'v1', type: 'switch', name: 'VTEP1', x: 380, y: 120, lines: ['10.0.0.1'] },
      { id: 'v2', type: 'switch', name: 'VTEP2', x: 650, y: 120, lines: ['10.0.0.2'] },
      { id: 'hb', type: 'host', name: 'Host-B', x: 900, y: 120, color: '#2c5f8a', lines: ['192.168.50.20', 'VNI 5000'] },
    ],
    links: [
      { id: 'l1', a: 'ha', b: 'v1' },
      { id: 'l2', a: 'v1', b: 'v2', labelMid: 'IP underlay (L3)' },
      { id: 'l3', a: 'v2', b: 'hb' },
    ],
  };
  const sim = new Sim(topology);

  const inner = (ethDst, ethSrc) => echoFrame({ ethDst, ethSrc, srcIp: HA.ip, dstIp: HB.ip, ttl: 64, ipId: 0x9001, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST });
  const innerFrame = () => sim.frame(inner(HB.mac, HA.mac));
  const vxlanFrame = () => sim.frame([
    { proto: 'ethernet', fields: { dst: V2.mac, src: V1.mac, etherType: 0x0800 } }, // outer
    { proto: 'ipv4', fields: { src: V1.ip, dst: V2.ip, ttl: 64, id: 0x5050, protocol: 17 } }, // underlay
    { proto: 'udp', fields: { srcPort: 54321, dstPort: 4789 } },
    { proto: 'vxlan', fields: { vni: VNI } },
    ...inner(HB.mac, HA.mac).map((l) => l), // khung Ethernet gốc nằm TRỌN bên trong
  ]);

  const f0 = innerFrame();
  sim.capture(f0, 'Khung gốc Host-A → Host-B (VNI 5000)');
  sim.emit({ kind: 'transit', fromDevice: 'ha', toDevice: 'v1', side: 'encap', activeLayer: 2,
    titleVi: 'Host-A gửi khung Ethernet thường tới Host-B', packet: f0,
    explanationVi: 'Host-A nghĩ Host-B cùng mạng L2 (192.168.50.0/24). Gửi khung Ethernet bình thường; khung tới VTEP1 (cổng thuộc VNI 5000).', lesson: LESSON });

  const vf = vxlanFrame();
  sim.capture(vf, 'Gói VXLAN (VTEP1 → VTEP2)');
  sim.emit({ kind: 'process', atDevice: 'v1', side: 'encap', activeLayer: 4.5,
    titleVi: 'VTEP1 ĐÓNG GÓI: bọc khung gốc vào VXLAN', packet: vf,
    overlay: { links: { l2: { cls: 'trunk', label: 'VXLAN VNI 5000' } } },
    explanationVi: 'VTEP1 tra "host B ở sau VTEP 10.0.0.2", rồi bọc NGUYÊN khung gốc: thêm VXLAN (VNI 5000) → UDP (đích 4789) → IP ngoài (10.0.0.1→10.0.0.2) → Ethernet ngoài. ' +
      'Nhìn cây trường: có 2 lớp Ethernet + 2 lớp IPv4 (ngoài = underlay, trong = của host).', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'v1', toDevice: 'v2', side: 'forward', activeLayer: 3,
    titleVi: 'Đi qua underlay — ĐỊNH TUYẾN theo IP ngoài', packet: vf,
    overlay: { links: { l2: { cls: 'trunk', label: 'VXLAN VNI 5000' } } },
    explanationVi: 'Hạ tầng ở giữa chỉ thấy gói UDP/IP bình thường (10.0.0.1→10.0.0.2) và định tuyến L3 như thường — không cần biết VLAN/MAC của host. ' +
      'Nhờ VNI 24-bit, có tới ~16 triệu mạng ảo (so với 4094 VLAN).' });

  const f1 = innerFrame();
  sim.emit({ kind: 'process', atDevice: 'v2', side: 'decap', activeLayer: 2,
    titleVi: 'VTEP2 GỠ GÓI: bóc VXLAN, lấy lại khung gốc', packet: f1,
    overlay: { links: { l3: { cls: 'forwarding', label: 'khung gốc' } } },
    explanationVi: 'VTEP2 thấy UDP 4789 → gỡ IP ngoài + UDP + VXLAN, lấy lại đúng khung Ethernet ban đầu, rồi giao vào cổng thuộc VNI 5000.', lesson: LESSON });
  sim.capture(f1, 'Khung gốc (VTEP2 → Host-B)');
  sim.emit({ kind: 'transit', fromDevice: 'v2', toDevice: 'hb', side: 'decap', activeLayer: 2,
    titleVi: '✓ Host-B nhận khung — như cùng một switch', packet: f1,
    overlay: { links: { l3: { cls: 'forwarding', label: 'khung gốc' } } },
    explanationVi: 'Host-B nhận đúng khung Host-A gửi, tưởng như hai máy cắm chung một switch — dù thực tế cách nhau qua mạng L3. Đó là "overlay": L2 ảo trên nền L3.', lesson: LESSON });

  return sim.result();
}
