// scenarios/s25-qos-advanced.js
// Kịch bản 25 (CCNP): QoS nâng cao — phân loại, đánh dấu DSCP + CoS(802.1p), DiffServ
// PHB (EF/AF/CS), hàng đợi (LLQ/CBWFQ/WRED), policing vs shaping.

import { Sim } from '../engine/simulate.js';

const SRCMAC = { voice: '00:1a:2b:00:00:11', video: '00:1a:2b:00:00:12', data: '00:1a:2b:00:00:13' };
const R1MAC = '00:1a:2b:00:00:a1';
const DST = '203.0.113.50';

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-01_Nen-tang-mang/Bai-05_Dia-chi-IPv4.md',
  label: 'Bài 05 — IPv4 (ToS/DSCP)',
};

export const meta = {
  id: 's25-qos-advanced',
  titleVi: 'QoS nâng cao (DSCP/CoS, PHB)',
  titleEn: 'Advanced QoS',
  descriptionVi: 'Phân loại → đánh dấu DSCP (L3) + CoS/PCP (L2) → DiffServ PHB (EF/AF/CS) → hàng đợi LLQ/CBWFQ/WRED, policing vs shaping.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 320',
    devices: [
      { id: 'phone', type: 'host', name: 'Thoại', x: 120, y: 70, color: '#2e7d5b', lines: ['EF / CoS5'] },
      { id: 'cam', type: 'host', name: 'Video', x: 120, y: 160, color: '#2c5f8a', lines: ['AF41 / CoS4'] },
      { id: 'pc', type: 'host', name: 'PC', x: 120, y: 250, color: '#6a7686', lines: ['BE / CoS0'] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 420, y: 160, lines: ['trust / marking'] },
      { id: 'r1', type: 'router', name: 'R1', x: 680, y: 160, lines: ['queue ra WAN'] },
      { id: 'wan', type: 'host', name: 'WAN', x: 900, y: 160, color: '#a0433a', lines: ['link hẹp'] },
    ],
    links: [{ id: 'lp', a: 'phone', b: 'sw' }, { id: 'lc', a: 'cam', b: 'sw' }, { id: 'ld', a: 'pc', b: 'sw' }, { id: 'lr', a: 'sw', b: 'r1' }, { id: 'lw', a: 'r1', b: 'wan', bp: '', labelMid: 'WAN' }],
  };
  const sim = new Sim(topology);

  const tagged = (srcMac, pcp, dscp, proto) => sim.frame([
    { proto: 'ethernet', fields: { dst: R1MAC, src: srcMac, etherType: 0x8100 } },
    { proto: 'dot1q', fields: { pcp, dei: 0, vid: 10, innerType: 0x0800 } },
    { proto: 'ipv4', fields: { src: `10.0.0.${pcp === 5 ? 11 : pcp === 4 ? 12 : 13}`, dst: DST, ttl: 64, id: 0x3300 + dscp, protocol: proto, dscp } },
    proto === 17
      ? { proto: 'udp', fields: { srcPort: 16400, dstPort: 16400 } }
      : { proto: 'tcp', fields: { srcPort: 50000, dstPort: 80, seq: 1, ack: 1, flags: { ack: true, psh: true } } },
    { proto: 'raw', fields: { data: new Array(16).fill(0), desc: 'payload mẫu' } },
  ]);

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: '4 bước QoS: phân loại → đánh dấu → hàng đợi → chỉnh tốc độ',
    explanationVi: 'Classification: nhận diện loại lưu lượng (ACL/NBAR). Marking: ghi mức ưu tiên vào gói. ' +
      'Queuing: xếp hàng ưu tiên khi nghẽn. Policing/Shaping: giới hạn tốc độ.',
    lesson: LESSON });

  const voice = tagged(SRCMAC.voice, 5, 46, 17);
  sim.capture(voice, 'Thoại: DSCP EF(46) + CoS5');
  sim.emit({ kind: 'transit', fromDevice: 'phone', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'Đánh dấu 2 tầng: CoS (L2, trong 802.1Q) + DSCP (L3)', packet: voice,
    changedFields: ['dot1q.pcp', 'ip.dscp'],
    explanationVi: 'Thoại: PCP/CoS = 5 trong nhãn 802.1Q (tầng 2) và DSCP = 46 (EF) trong IP header (tầng 3). ' +
      'Switch có thể ánh xạ CoS↔DSCP. Lớp 2 chỉ còn CoS khi có VLAN tag; qua router (bỏ tag) thì dựa vào DSCP.',
    lesson: LESSON });

  const video = tagged(SRCMAC.video, 4, 34, 17);
  sim.capture(video, 'Video: DSCP AF41(34) + CoS4');
  sim.emit({ kind: 'transit', fromDevice: 'cam', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'DiffServ PHB: EF vs AF vs CS vs BE', packet: video,
    explanationVi: 'DSCP ánh xạ tới "hành vi mỗi chặng" (PHB): EF (46) = thoại, độ trễ cực thấp; AF41 (34) = video, ' +
      'đảm bảo băng thông + mức rớt thấp; CS3 (24) = báo hiệu; BE (0) = còn lại. (AFxy: x=lớp, y=mức ưu tiên rớt.)',
    lesson: LESSON });

  const data = tagged(SRCMAC.data, 0, 0, 6);
  sim.capture(data, 'Data: BE (DSCP 0)');
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'Hàng đợi ra WAN: LLQ + CBWFQ + WRED', packet: voice,
    overlay: { links: { lw: { cls: 'root-path', label: 'EF ưu tiên →' } } },
    explanationVi: 'R1 khi nghẽn: EF vào PRIORITY QUEUE (LLQ) — phục vụ trước, có trần băng thông. AF41 vào CBWFQ — đảm bảo % băng thông. ' +
      'BE dùng phần còn lại; WRED chủ động rớt sớm vài gói TCP để tránh "đồng loạt dừng" (global synchronization).',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'Policing vs Shaping (token bucket) & Trust boundary',
    explanationVi: 'Cả hai dùng "gáo token" để đo tốc độ. POLICING: vượt tốc → rớt/hạ DSCP ngay (không đệm, không thêm trễ) — hay dùng chiều vào. ' +
      'SHAPING: đệm gói vượt rồi phát đều (mượt hơn nhưng thêm trễ) — hay dùng chiều ra WAN. ' +
      'Trust boundary: chỉ TIN nhãn do thiết bị tin cậy (IP phone) đặt; ngoài biên thì đánh dấu lại để tránh bị "chơi ăn gian" ưu tiên.',
    lesson: LESSON });

  return sim.result();
}
