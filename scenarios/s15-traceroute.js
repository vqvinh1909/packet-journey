// scenarios/s15-traceroute.js
// Kịch bản 15 (CCNA): Traceroute.
// Gửi probe với TTL = 1, 2, 3… Mỗi router làm TTL về 0 sẽ DROP và gửi ICMP Time
// Exceeded (Type 11) về nguồn → lộ ra từng chặng. Tới đích thì nhận Echo Reply.

import { Sim } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

const PC = { mac: '00:1a:2b:00:00:10', ip: '192.168.1.10' };
const R1 = { mac: '00:1a:2b:00:00:a1', ip: '192.168.1.1' };
const R2 = { mac: '00:1a:2b:00:00:b1', ip: '10.0.0.2' };
const DST = { mac: '00:1a:2b:00:00:ff', ip: '203.0.113.9' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Giới thiệu định tuyến',
};

export const meta = {
  id: 's15-traceroute',
  titleVi: 'Traceroute (TTL & Time Exceeded)',
  titleEn: 'Traceroute',
  descriptionVi: 'Dò đường bằng TTL tăng dần: mỗi router làm TTL=0 gửi ICMP Time Exceeded về, lộ ra từng chặng tới đích.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'pc', type: 'host', name: 'PC', x: 120, y: 160, lines: ['192.168.1.10'] },
      { id: 'r1', type: 'router', name: 'R1', x: 380, y: 160, lines: ['hop 1', '192.168.1.1'] },
      { id: 'r2', type: 'router', name: 'R2', x: 640, y: 160, lines: ['hop 2', '10.0.0.2'] },
      { id: 'dst', type: 'host', name: 'Đích', x: 900, y: 160, color: '#2e7d5b', lines: ['203.0.113.9'] },
    ],
    links: [
      { id: 'l1', a: 'pc', b: 'r1' }, { id: 'l2', a: 'r1', b: 'r2' }, { id: 'l3', a: 'r2', b: 'dst' },
    ],
  };

  const sim = new Sim(topology);
  let probeSeq = 0;
  const probe = (ttl) => sim.frame(echoFrame({
    ethDst: R1.mac, ethSrc: PC.mac, srcIp: PC.ip, dstIp: DST.ip, ttl,
    ipId: 0xaa00 + ttl, identifier: 0x000f, seq: ++probeSeq, type: ICMP_TYPE.ECHO_REQUEST,
  }));
  const timeExceeded = (from, origProbe) => sim.frame([
    { proto: 'ethernet', fields: { dst: PC.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: from.ip, dst: PC.ip, ttl: 64, id: 0, protocol: 1 } },
    { proto: 'icmp', fields: { type: ICMP_TYPE.TIME_EXCEEDED, code: 0, identifier: 0, seq: 0,
      data: Array.from(origProbe.bytes.slice(14, 42)) } }, // IP header gốc + 8 byte
  ]);

  // ===== TTL = 1 =====
  const p1 = probe(1);
  sim.capture(p1, 'Probe TTL=1');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'TTL=1 → tới R1', packet: p1,
    explanationVi: 'PC gửi gói thăm dò (ICMP Echo) tới đích 203.0.113.9 nhưng đặt TTL = 1 để nó "chết" ngay ở chặng đầu.',
    lesson: LESSON });
  const te1 = timeExceeded(R1, p1);
  sim.capture(te1, 'ICMP Time Exceeded từ R1');
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'forward', activeLayer: 3,
    titleVi: 'R1: TTL 1→0 → DROP + báo Time Exceeded', packet: te1,
    overlay: { badges: { r1: 'hop 1 ✓' } },
    explanationVi: 'R1 giảm TTL 1→0 → KHÔNG chuyển tiếp, bỏ gói và gửi ICMP Type 11 (Time Exceeded) về PC. Gói báo lỗi này mang IP nguồn = 192.168.1.1 → PC biết chặng 1 là R1.',
    lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'pc', side: 'decap', activeLayer: 3,
    titleVi: 'Time Exceeded về PC → ghi nhận hop 1 = 192.168.1.1', packet: te1,
    overlay: { badges: { r1: 'hop 1 ✓' } },
    explanationVi: 'ICMP Time Exceeded chứa 28 byte đầu của gói gốc (IP header + 8 byte) để PC khớp đúng probe nào.' });

  // ===== TTL = 2 =====
  const p2 = probe(2);
  sim.capture(p2, 'Probe TTL=2');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'r2', side: 'encap', activeLayer: 3,
    titleVi: 'TTL=2 → qua R1 (còn 1) tới R2', packet: p2,
    overlay: { badges: { r1: 'hop 1 ✓' } },
    explanationVi: 'Lần này TTL = 2: R1 giảm còn 1 và CHUYỂN TIẾP; tới R2 thì TTL về 0.' });
  const te2 = timeExceeded(R2, p2);
  sim.capture(te2, 'ICMP Time Exceeded từ R2');
  sim.emit({ kind: 'process', atDevice: 'r2', side: 'forward', activeLayer: 3,
    titleVi: 'R2: TTL→0 → Time Exceeded (hop 2 = 10.0.0.2)', packet: te2,
    overlay: { badges: { r1: 'hop 1 ✓', r2: 'hop 2 ✓' } },
    explanationVi: 'R2 làm TTL=0 → gửi Time Exceeded, IP nguồn 10.0.0.2 → PC biết chặng 2 là R2.',
    lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'r2', toDevice: 'pc', side: 'decap', activeLayer: 3,
    titleVi: 'PC ghi nhận hop 2', packet: te2,
    overlay: { badges: { r1: 'hop 1 ✓', r2: 'hop 2 ✓' } },
    explanationVi: 'Cứ thế TTL tăng dần sẽ lộ dần từng chặng.' });

  // ===== TTL = 3 → tới đích =====
  const p3 = probe(3);
  sim.capture(p3, 'Probe TTL=3');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'dst', side: 'encap', activeLayer: 3,
    titleVi: 'TTL=3 → tới ĐÍCH', packet: p3,
    overlay: { badges: { r1: 'hop 1 ✓', r2: 'hop 2 ✓' } },
    explanationVi: 'TTL đủ lớn để tới 203.0.113.9. Đích KHÔNG phải router nên không giảm-rồi-drop; nó trả lời như ping thường.' });
  const reply = sim.frame(echoFrame({ ethDst: PC.mac, ethSrc: DST.mac, srcIp: DST.ip, dstIp: PC.ip, ttl: 64, ipId: 0, identifier: 0x000f, seq: 3, type: ICMP_TYPE.ECHO_REPLY }));
  sim.capture(reply, 'ICMP Echo Reply từ đích');
  sim.emit({ kind: 'transit', fromDevice: 'dst', toDevice: 'pc', side: 'decap', activeLayer: 3,
    titleVi: 'Đích trả Echo Reply → traceroute xong', packet: reply,
    overlay: { badges: { r1: 'hop 1 ✓', r2: 'hop 2 ✓', dst: 'đích ✓' } },
    explanationVi: 'Nhận Echo Reply (thay vì Time Exceeded) nghĩa là đã TỚI đích → dừng. Kết quả: hop1 192.168.1.1, hop2 10.0.0.2, đích 203.0.113.9. ' +
      '(Lưu ý: traceroute Linux dùng probe UDP cổng cao → đích trả ICMP Port Unreachable; Windows tracert dùng ICMP Echo như ở đây.)',
    lesson: LESSON });

  return sim.result();
}
