// scenarios/s32-sr-mpls.js
// Kịch bản 32 (SP): Segment Routing trên MPLS.
// Router đầu vào ghi cả đường đi thành chồng nhãn (node SID), các router giữa không giữ trạng thái theo luồng.
// SRGB mặc định của Cisco là 16000-23999, node SID = 16000 + index nên cùng một nhãn trên toàn miền.

import { Sim, diffFields } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

const CE1 = { mac: '00:1a:2b:00:00:01', ip: '10.1.1.1' };
const PE1 = { mac: '00:1a:2b:00:00:a1' };
const P1 = { mac: '00:1a:2b:00:00:b1' };
const P2 = { mac: '00:1a:2b:00:00:b2' };
const P3 = { mac: '00:1a:2b:00:00:b3' };
const PE2 = { mac: '00:1a:2b:00:00:c1' };
const CE2 = { mac: '00:1a:2b:00:00:ff', ip: '10.2.2.2' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Định tuyến (Segment Routing: ngoài CCNA)',
};

export const meta = {
  id: 's32-sr-mpls',
  titleVi: 'SR-MPLS: chồng nhãn chọn đường từ đầu vào',
  titleEn: 'Segment Routing over MPLS',
  descriptionVi: 'PE1 ép lưu lượng đi vòng tránh đường ngắn nhất bằng chồng 2 node SID. Các router giữa chỉ làm theo nhãn, không cần LDP hay RSVP-TE.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1180 400',
    devices: [
      { id: 'ce1', type: 'host', name: 'CE1', x: 80, y: 130, color: '#2c5f8a', lines: ['10.1.1.1'] },
      { id: 'pe1', type: 'router', name: 'PE1', x: 260, y: 130, lines: ['SID 16001'] },
      { id: 'px', type: 'router', name: 'PX', x: 590, y: 60, lines: ['SID 16006', 'đường ngắn nhất, đang nghẽn'] },
      { id: 'p1', type: 'router', name: 'P1', x: 400, y: 290, lines: ['SID 16002'] },
      { id: 'p2', type: 'router', name: 'P2', x: 590, y: 290, lines: ['SID 16003'] },
      { id: 'p3', type: 'router', name: 'P3', x: 780, y: 290, lines: ['SID 16004'] },
      { id: 'pe2', type: 'router', name: 'PE2', x: 920, y: 130, lines: ['SID 16005'] },
      { id: 'ce2', type: 'host', name: 'CE2', x: 1100, y: 130, color: '#2c5f8a', lines: ['10.2.2.2'] },
    ],
    links: [
      { id: 'l0', a: 'ce1', b: 'pe1', ap: 'Gi0/0' },
      { id: 'lx1', a: 'pe1', b: 'px' },
      { id: 'lx2', a: 'px', b: 'pe2' },
      { id: 'l1', a: 'pe1', b: 'p1' },
      { id: 'l2', a: 'p1', b: 'p2' },
      { id: 'l3', a: 'p2', b: 'p3' },
      { id: 'l4', a: 'p3', b: 'pe2' },
      { id: 'l5', a: 'pe2', b: 'ce2', bp: 'Gi0/0' },
    ],
  };
  const sim = new Sim(topology);

  const ip = (ethDst, ethSrc, ttl) => sim.frame(echoFrame({ ethDst, ethSrc, srcIp: CE1.ip, dstIp: CE2.ip, ttl, ipId: 0x7201, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
  // labels: nhãn đỉnh trước. Nhãn cuối mảng là nhãn đáy, bit S = 1.
  const labeled = (ethDst, ethSrc, labels, ttl) => sim.frame([
    { proto: 'ethernet', fields: { dst: ethDst, src: ethSrc, etherType: 0x8847 } },
    ...labels.map((label, i) => ({ proto: 'mpls', fields: { label, tc: 0, s: i === labels.length - 1 ? 1 : 0, ttl: i === 0 ? ttl : 255 } })), // chỉ nhãn đỉnh bị giảm TTL
    { proto: 'ipv4', fields: { src: CE1.ip, dst: CE2.ip, ttl: 63, id: 0x7201, protocol: 1 } },
    { proto: 'icmp', fields: { type: ICMP_TYPE.ECHO_REQUEST, code: 0, identifier: 1, seq: 1, data: [] } },
  ]);

  const f0 = ip(PE1.mac, CE1.mac, 64);
  sim.capture(f0, 'IP thường (CE1 → PE1)');
  sim.emit({ kind: 'transit', fromDevice: 'ce1', toDevice: 'pe1', side: 'encap', activeLayer: 3,
    titleVi: 'CE1 gửi gói IP thường', packet: f0,
    explanationVi: 'Đường IGP ngắn nhất là PE1 → PX → PE2 nhưng đang nghẽn. Nhà mạng có policy: lưu lượng này phải đi qua P3.', lesson: LESSON });

  const f1 = labeled(P1.mac, PE1.mac, [16004, 16005], 255);
  sim.emit({ kind: 'process', atDevice: 'pe1', side: 'forward', activeLayer: 2.5,
    titleVi: 'PE1 PUSH chồng 2 nhãn: tới P3 rồi tới PE2', packet: f1,
    changedFields: diffFields(f0.tree, f1.tree),
    overlay: { links: { l1: { cls: 'trunk', label: '16004 | 16005' } } },
    explanationVi: 'Node SID được IS-IS hoặc OSPF quảng bá, không cần LDP. PE1 ghi đường đi thành 2 segment: 16004 (đi tới P3 theo đường ngắn nhất), rồi 16005 (đi tiếp tới PE2). Đường ngắn nhất từ PE1 tới P3 là qua P1 và P2. Toàn bộ quyết định nằm ở đầu vào.', lesson: LESSON });
  sim.capture(f1, 'Chồng nhãn 16004 | 16005 (PE1 → P1)');
  sim.emit({ kind: 'transit', fromDevice: 'pe1', toDevice: 'p1', side: 'forward', activeLayer: 2.5,
    titleVi: 'Gói mang cả đường đi trong chồng nhãn', packet: f1,
    overlay: { links: { l1: { cls: 'trunk', label: '16004 | 16005' } } },
    explanationVi: 'Xem cây trường: hai lớp MPLS. Nhãn đỉnh S=0, nhãn đáy S=1. Router chỉ đọc nhãn đỉnh, gọi là active segment.' });

  const f2 = labeled(P2.mac, P1.mac, [16004, 16005], 254);
  sim.emit({ kind: 'process', atDevice: 'p1', side: 'forward', activeLayer: 2.5,
    titleVi: 'P1: nhãn đỉnh 16004 giữ nguyên, chuyển tiếp', packet: f2,
    changedFields: diffFields(f1.tree, f2.tree),
    overlay: { links: { l2: { cls: 'trunk', label: '16004 | 16005' } } },
    explanationVi: 'P1 tra 16004 và thấy phải đi qua P2. Vì mọi router dùng chung SRGB nên nhãn ra vẫn là 16004. Với LDP, mỗi chặng thường có nhãn khác. P1 không giữ trạng thái gì về luồng này, chỉ đổi MPLS TTL.', lesson: LESSON });
  sim.capture(f2, 'Chồng nhãn 16004 | 16005 (P1 → P2)');
  sim.emit({ kind: 'transit', fromDevice: 'p1', toDevice: 'p2', side: 'forward', activeLayer: 2.5,
    titleVi: 'Tới P2', packet: f2,
    overlay: { links: { l2: { cls: 'trunk', label: '16004 | 16005' } } },
    explanationVi: 'Nhãn không đổi qua từng chặng, nên đọc gói là biết đích của segment: 16004 là P3.' });

  const f3 = labeled(P3.mac, P2.mac, [16005], 253);
  sim.emit({ kind: 'process', atDevice: 'p2', side: 'forward', activeLayer: 2.5,
    titleVi: 'P2 POP nhãn 16004 (PHP): sắp tới P3', packet: f3,
    changedFields: diffFields(f2.tree, f3.tree),
    overlay: { links: { l3: { cls: 'trunk', label: '16005' } } },
    explanationVi: 'P2 là chặng áp chót của segment 16004 nên gỡ nhãn trước, gọi là Penultimate Hop Popping. P3 chỉ còn thấy 16005.', lesson: LESSON });
  sim.capture(f3, 'Nhãn 16005 (P2 → P3)');
  sim.emit({ kind: 'transit', fromDevice: 'p2', toDevice: 'p3', side: 'forward', activeLayer: 2.5,
    titleVi: 'Segment thứ nhất xong, gói đã đi qua đúng đường vòng', packet: f3,
    overlay: { links: { l3: { cls: 'trunk', label: '16005' } } },
    explanationVi: 'Nhãn còn lại có S=1, sau nó là IP.' });

  const f4 = ip(PE2.mac, P3.mac, 63);
  sim.emit({ kind: 'process', atDevice: 'p3', side: 'forward', activeLayer: 3,
    titleVi: 'P3 POP nhãn 16005 (PHP): PE2 chỉ nhận IP', packet: f4,
    changedFields: diffFields(f3.tree, f4.tree),
    overlay: { links: { l4: { cls: 'forwarding', label: 'IP thường' } } },
    explanationVi: 'P3 là chặng áp chót của segment 16005 nên gỡ nốt. Trong L3VPN thực tế còn có nhãn dịch vụ ở đáy, lab này lược bỏ để dễ theo dõi.', lesson: LESSON });
  sim.capture(f4, 'IP thường (P3 → PE2)');
  sim.emit({ kind: 'transit', fromDevice: 'p3', toDevice: 'pe2', side: 'forward', activeLayer: 3,
    titleVi: 'PE2 nhận IP, tra bảng định tuyến', packet: f4,
    overlay: { links: { l4: { cls: 'forwarding', label: 'IP thường' } } },
    explanationVi: 'Trong mô phỏng, PX không được dùng dù nằm trên đường ngắn nhất.' });

  const f5 = ip(CE2.mac, PE2.mac, 62);
  sim.capture(f5, 'IP thường (PE2 → CE2)');
  sim.emit({ kind: 'transit', fromDevice: 'pe2', toDevice: 'ce2', side: 'decap', activeLayer: 3,
    titleVi: '✓ CE2 nhận gói: chọn đường không cần trạng thái ở lõi', packet: f5,
    overlay: { links: { l5: { cls: 'forwarding', label: 'IP thường' } } },
    explanationVi: 'So với RSVP-TE, lõi không phải giữ đường hầm cho từng luồng: chỉ đầu vào biết policy. Muốn đổi đường thì đổi chồng nhãn ở PE1. Giới hạn là số nhãn phần cứng đẩy được một lần.', lesson: LESSON });

  return sim.result();
}
