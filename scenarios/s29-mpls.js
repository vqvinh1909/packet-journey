// scenarios/s29-mpls.js
// Kịch bản 29 (CCNP/SP): MPLS label switching.
// Ingress PE PUSH nhãn theo FEC; router P trong lõi SWAP nhãn (tra LFIB, KHÔNG tra IP);
// egress PE POP nhãn trả lại IP. Chuyển tiếp theo NHÃN nên nhanh và tách khỏi bảng IP.

import { Sim, diffFields } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

const CE1 = { mac: '00:1a:2b:00:00:01', ip: '10.1.1.1' };
const PE1 = { mac: '00:1a:2b:00:00:a1' };
const P = { mac: '00:1a:2b:00:00:b1' };
const PE2 = { mac: '00:1a:2b:00:00:c1' };
const CE2 = { mac: '00:1a:2b:00:00:ff', ip: '10.2.2.2' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Định tuyến (MPLS: ngoài CCNA)',
};

export const meta = {
  id: 's29-mpls',
  titleVi: 'MPLS: push / swap / pop nhãn',
  titleEn: 'MPLS label switching',
  descriptionVi: 'Ingress PE gắn nhãn (push), router lõi đổi nhãn (swap theo LFIB, không tra IP), egress PE gỡ nhãn (pop). Chuyển tiếp theo nhãn.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 260',
    devices: [
      { id: 'ce1', type: 'host', name: 'CE1', x: 90, y: 120, color: '#2c5f8a', lines: ['10.1.1.1'] },
      { id: 'pe1', type: 'router', name: 'PE1', x: 300, y: 120, lines: ['ingress (push)'] },
      { id: 'p', type: 'router', name: 'P', x: 500, y: 120, lines: ['core (swap)'] },
      { id: 'pe2', type: 'router', name: 'PE2', x: 700, y: 120, lines: ['egress (pop)'] },
      { id: 'ce2', type: 'host', name: 'CE2', x: 910, y: 120, color: '#2c5f8a', lines: ['10.2.2.2'] },
    ],
    links: [
      { id: 'l1', a: 'ce1', b: 'pe1' },
      { id: 'l2', a: 'pe1', b: 'p', labelMid: 'MPLS' },
      { id: 'l3', a: 'p', b: 'pe2', labelMid: 'MPLS' },
      { id: 'l4', a: 'pe2', b: 'ce2' },
    ],
  };
  const sim = new Sim(topology);

  const ip = (ethDst, ethSrc, ttl) => sim.frame(echoFrame({ ethDst, ethSrc, srcIp: CE1.ip, dstIp: CE2.ip, ttl, ipId: 0x7001, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
  const labeled = (ethDst, ethSrc, label, mttl) => sim.frame([
    { proto: 'ethernet', fields: { dst: ethDst, src: ethSrc, etherType: 0x8847 } },
    { proto: 'mpls', fields: { label, tc: 0, s: 1, ttl: mttl } },
    { proto: 'ipv4', fields: { src: CE1.ip, dst: CE2.ip, ttl: 63, id: 0x7001, protocol: 1 } },
    { proto: 'icmp', fields: { type: ICMP_TYPE.ECHO_REQUEST, code: 0, identifier: 1, seq: 1, data: [] } },
  ]);

  const atCe1 = ip(PE1.mac, CE1.mac, 64);
  sim.capture(atCe1, 'IP thường (CE1 → PE1)');
  sim.emit({ kind: 'transit', fromDevice: 'ce1', toDevice: 'pe1', side: 'encap', activeLayer: 3,
    titleVi: 'CE1 gửi gói IP thường tới PE1', packet: atCe1,
    explanationVi: 'Khách hàng gửi gói IP bình thường (10.1.1.1 → 10.2.2.2). Chưa có nhãn.', lesson: LESSON });

  const pushed = labeled(P.mac, PE1.mac, 16, 255);
  sim.emit({ kind: 'process', atDevice: 'pe1', side: 'forward', activeLayer: 2.5,
    titleVi: 'PE1 (ingress): PUSH nhãn 16', packet: pushed,
    changedFields: diffFields(atCe1.tree, pushed.tree),
    overlay: { links: { l2: { cls: 'trunk', label: 'label 16' } } },
    explanationVi: 'PE1 phân loại gói vào một FEC (vd theo mạng đích), rồi GẮN (push) nhãn 16, đổi EtherType thành 0x8847, đặt MPLS TTL = 255. ' +
      'Từ đây lõi chỉ nhìn nhãn.', lesson: LESSON });
  sim.capture(pushed, 'MPLS label 16 (PE1 → P)');
  sim.emit({ kind: 'transit', fromDevice: 'pe1', toDevice: 'p', side: 'forward', activeLayer: 2.5,
    titleVi: 'Gói gắn nhãn vào lõi', packet: pushed,
    overlay: { links: { l2: { cls: 'trunk', label: 'label 16' } } },
    explanationVi: 'Nhãn nằm giữa Ethernet và IP. Bit S=1 = nhãn đáy (sau là IP).' });

  const swapped = labeled(PE2.mac, P.mac, 17, 254);
  sim.emit({ kind: 'process', atDevice: 'p', side: 'forward', activeLayer: 2.5,
    titleVi: 'P (lõi): SWAP nhãn 16 → 17 (tra LFIB)', packet: swapped,
    changedFields: diffFields(pushed.tree, swapped.tree),
    overlay: { links: { l3: { cls: 'trunk', label: 'label 17' } } },
    explanationVi: 'Router P KHÔNG tra bảng IP. Nó tra LFIB theo nhãn 16 → đổi (swap) thành 17, giảm MPLS TTL 255→254, chuyển ra cổng kế. ' +
      'Đây là lý do MPLS nhanh: tra nhãn cố định thay vì longest-prefix match trên IP.', lesson: LESSON });
  sim.capture(swapped, 'MPLS label 17 (P → PE2)');
  sim.emit({ kind: 'transit', fromDevice: 'p', toDevice: 'pe2', side: 'forward', activeLayer: 2.5,
    titleVi: 'Gói (nhãn 17) tới PE2', packet: swapped,
    overlay: { links: { l3: { cls: 'trunk', label: 'label 17' } } },
    explanationVi: 'Chỉ nhãn và MPLS TTL đổi; gói IP bên trong y nguyên.' });

  const popped = ip(CE2.mac, PE2.mac, 63);
  sim.emit({ kind: 'process', atDevice: 'pe2', side: 'forward', activeLayer: 3,
    titleVi: 'PE2 (egress): POP nhãn → trả lại IP', packet: popped,
    changedFields: diffFields(swapped.tree, popped.tree),
    overlay: { links: { l4: { cls: 'forwarding', label: 'IP thường' } } },
    explanationVi: 'PE2 GỠ (pop) nhãn, lộ lại gói IP, rồi tra IP bình thường để giao CE2. ' +
      '(Thực tế hay dùng PHP — Penultimate Hop Popping: router P pop sẵn để PE2 đỡ phải xử lý 2 lần.)', lesson: LESSON });
  sim.capture(popped, 'IP thường (PE2 → CE2)');
  sim.emit({ kind: 'transit', fromDevice: 'pe2', toDevice: 'ce2', side: 'decap', activeLayer: 3,
    titleVi: '✓ CE2 nhận gói IP — xuyên lõi MPLS trong suốt', packet: popped,
    overlay: { links: { l4: { cls: 'forwarding', label: 'IP thường' } } },
    explanationVi: 'Khách hàng không hề biết lõi dùng MPLS. Nhãn cho phép nhà mạng làm VPN (MPLS L3VPN) và kỹ thuật lưu lượng (TE).', lesson: LESSON });

  return sim.result();
}
