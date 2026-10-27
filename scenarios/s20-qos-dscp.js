// scenarios/s20-qos-dscp.js
// Kịch bản 20 (CCNP): QoS — đánh dấu DSCP & hàng đợi ưu tiên.
// Gói thoại (VoIP) được đánh dấu DSCP EF (46), gói dữ liệu để Best Effort (0).
// Khi WAN nghẽn, router xếp thoại vào hàng ưu tiên (LLQ) đi trước.

import { Sim } from '../engine/simulate.js';

const PHONE = { mac: '00:1a:2b:00:00:11', ip: '192.168.1.11' };
const PC = { mac: '00:1a:2b:00:00:12', ip: '192.168.1.12' };
const R1 = { mac: '00:1a:2b:00:00:a1' };
const DST = { mac: '00:1a:2b:00:00:ff', ip: '203.0.113.50' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-01_Nen-tang-mang/Bai-05_Dia-chi-IPv4.md',
  label: 'Bài 05 — IPv4 (trường DSCP)',
};

export const meta = {
  id: 's20-qos-dscp',
  titleVi: 'QoS: đánh dấu DSCP & LLQ',
  titleEn: 'QoS DSCP marking',
  descriptionVi: 'Voice đánh dấu DSCP EF (46), data để Best Effort (0). Khi WAN nghẽn, router ưu tiên voice (Low Latency Queuing).',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 320',
    devices: [
      { id: 'phone', type: 'host', name: 'IP Phone', x: 130, y: 90, color: '#2e7d5b', lines: ['192.168.1.11', 'VoIP'] },
      { id: 'pc', type: 'host', name: 'PC', x: 130, y: 250, color: '#2c5f8a', lines: ['192.168.1.12', 'Data'] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 400, y: 170, lines: ['trust DSCP'] },
      { id: 'r1', type: 'router', name: 'R1', x: 670, y: 170, lines: ['QoS ra WAN'] },
      { id: 'wan', type: 'host', name: 'WAN', x: 900, y: 170, color: '#a0433a', lines: ['link hẹp'] },
    ],
    links: [
      { id: 'lp', a: 'phone', b: 'sw' }, { id: 'ld', a: 'pc', b: 'sw' },
      { id: 'lr', a: 'sw', b: 'r1' }, { id: 'lw', a: 'r1', b: 'wan', labelMid: 'WAN (nghẽn)' },
    ],
  };

  const sim = new Sim(topology);
  const voice = sim.frame([
    { proto: 'ethernet', fields: { dst: R1.mac, src: PHONE.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: PHONE.ip, dst: DST.ip, ttl: 64, id: 0x1111, protocol: 17, dscp: 46 } },
    { proto: 'udp', fields: { srcPort: 16500, dstPort: 16500 } },
    { proto: 'raw', fields: { data: new Array(20).fill(0), desc: 'Mẫu âm thanh RTP (rút gọn).' } },
  ]);
  const data = sim.frame([
    { proto: 'ethernet', fields: { dst: R1.mac, src: PC.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: PC.ip, dst: DST.ip, ttl: 64, id: 0x2222, protocol: 6, dscp: 0 } },
    { proto: 'tcp', fields: { srcPort: 50000, dstPort: 80, seq: 1, ack: 1, flags: { ack: true, psh: true } } },
  ]);

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 3,
    titleVi: 'Vì sao cần QoS',
    explanationVi: 'Link WAN băng thông hẹp, nhiều loại lưu lượng tranh nhau. Thoại (VoIP) rất nhạy với trễ & jitter, mất gói → rè tiếng. ' +
      'QoS = phân loại → đánh dấu → xếp hàng/định hình để ưu tiên loại quan trọng.',
    lesson: LESSON });

  sim.capture(voice, 'Gói VoIP (DSCP EF 46)');
  sim.emit({ kind: 'transit', fromDevice: 'phone', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'Gói thoại: đánh dấu DSCP EF = 46', packet: voice,
    explanationVi: 'Trường DSCP (6 bit đầu của byte ToS trong IP header) = 46 (EF — Expedited Forwarding) đánh dấu "ưu tiên cao, trễ thấp". ' +
      'Thường đánh dấu ngay tại biên tin cậy (IP phone / switch access).',
    lesson: LESSON });

  sim.capture(data, 'Gói data (DSCP 0 = Best Effort)');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'Gói data: DSCP = 0 (Best Effort)', packet: data,
    explanationVi: 'Lưu lượng web/data để DSCP = 0 (mặc định). So với gói thoại: chỉ khác ở trường DSCP trong IP header.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'R1 nghẽn: voice vào hàng ưu tiên (LLQ) đi trước', packet: voice,
    overlay: { links: { lw: { cls: 'root-path', label: 'voice ưu tiên →' } } },
    explanationVi: 'Khi cổng WAN đầy, R1 PHÂN LOẠI theo DSCP: EF(46) → Priority Queue (Low Latency Queuing) được phục vụ trước và bảo đảm băng thông; ' +
      'data vào hàng thường (CBWFQ), chờ tới lượt. Nhờ vậy cuộc gọi không giật dù link bận.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'Policing vs Shaping, Trust boundary',
    overlay: { links: { lw: { cls: 'root-path', label: 'voice ưu tiên →' } } },
    explanationVi: 'Policing: vượt tốc độ thì DROP/hạ DSCP ngay (không đệm). Shaping: đệm lại rồi phát đều (mượt hơn, thêm trễ). ' +
      '"Trust boundary" là nơi bắt đầu tin DSCP do thiết bị trước đánh dấu — ngoài biên thì không tin, phải đánh dấu lại để tránh lạm dụng ưu tiên.',
    lesson: LESSON });

  return sim.result();
}
