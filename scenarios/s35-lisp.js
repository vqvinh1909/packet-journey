// scenarios/s35-lisp.js
// Kịch bản 35 (ENCOR 2.3): LISP tách danh tính (EID) khỏi vị trí (RLOC).
// ETR đăng ký EID với Map-Server, ITR hỏi khi cần, rồi đóng gói UDP 4341 qua underlay.

import { Sim } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

const HA = { mac: '00:aa:00:00:35:01', ip: '192.168.1.10' };
const HB = { mac: '00:aa:00:00:35:02', ip: '192.168.2.20' };
const X1 = { mac: '00:1a:2b:00:35:01', ip: '20.0.0.1' };
const X2 = { mac: '00:1a:2b:00:35:02', ip: '30.0.0.2' };
const MS = { mac: '00:1a:2b:00:35:0a', ip: '40.0.0.100' };
const CORE = { mac: '00:1a:2b:00:35:0b' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Định tuyến (LISP: ENCOR 2.3)',
};

export const meta = {
  id: 's35-lisp',
  titleVi: 'LISP: tách địa chỉ máy khỏi vị trí mạng',
  titleEn: 'LISP: separating identity from location',
  descriptionVi: 'ETR đăng ký EID với Map-Server. ITR chỉ hỏi khi có gói cần gửi, lưu vào map-cache rồi đóng gói UDP 4341 qua underlay.',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'ha', type: 'host', name: 'Host-A', x: 90, y: 220, color: '#2c5f8a', lines: ['EID 192.168.1.10'] },
      { id: 'x1', type: 'router', name: 'xTR1', x: 300, y: 220, lines: ['RLOC 20.0.0.1'] },
      { id: 'core', type: 'router', name: 'Underlay', x: 500, y: 220, lines: ['chỉ biết RLOC'] },
      { id: 'x2', type: 'router', name: 'xTR2', x: 700, y: 220, lines: ['RLOC 30.0.0.2'] },
      { id: 'hb', type: 'host', name: 'Host-B', x: 910, y: 220, color: '#2c5f8a', lines: ['EID 192.168.2.20'] },
      { id: 'ms', type: 'router', name: 'MS/MR', x: 500, y: 60, lines: ['40.0.0.100'] },
    ],
    links: [
      { id: 'l1', a: 'ha', b: 'x1' },
      { id: 'l2', a: 'x1', b: 'core' },
      { id: 'l3', a: 'core', b: 'x2' },
      { id: 'l4', a: 'x2', b: 'hb' },
      { id: 'l5', a: 'x1', b: 'ms', labelMid: 'qua underlay' },
      { id: 'l6', a: 'x2', b: 'ms', labelMid: 'qua underlay' },
    ],
  };
  const sim = new Sim(topology);

  const ctl = (from, to, srcIp, dstIp, fields, { sport = 40342, dport = 4342, ttl = 64 } = {}) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: srcIp, dst: dstIp, ttl, id: 0x3500, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: sport, dstPort: dport } },
    { proto: 'lisp', fields },
  ]);
  const inner = (dst, src, ttl) => echoFrame({ ethDst: dst, ethSrc: src, srcIp: HA.ip, dstIp: HB.ip, ttl, ipId: 0x3501, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST });
  const encap = (to, from, ttl = 64) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: X1.ip, dst: X2.ip, ttl, id: 0x3502, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 49152, dstPort: 4341 } },
    { proto: 'lisp', fields: { type: 'data', instance: 100 } },
    ...inner('00:00:00:00:00:00', '00:00:00:00:00:00', 63).slice(1),
  ]);
  const B_REC = { eid: '192.168.2.0', mask: 24, rloc: X2.ip };
  const db = (rows) => ({ list: { title: 'Cơ sở dữ liệu Map-Server', cols: ['EID', 'RLOC'], rows } });
  const cache = (rows) => ({ list: { title: 'Map-cache xTR1', cols: ['EID', 'RLOC'], rows } });

  const r2 = ctl(X2, MS, X2.ip, MS.ip, { type: 'register', ...B_REC });
  sim.capture(r2, 'Map-Register của xTR2');
  sim.emit({ kind: 'transit', fromDevice: 'x2', toDevice: 'ms', side: 'forward', activeLayer: 4.5,
    titleVi: 'xTR2 đăng ký: 192.168.2.0/24 nằm sau 30.0.0.2', packet: r2, tables: db([['192.168.2.0/24', '30.0.0.2']]),
    overlay: { links: { l6: { cls: 'trunk', label: 'Map-Register' } } },
    explanationVi: 'EID là địa chỉ của máy, RLOC là địa chỉ của router trong underlay. Map-Server giữ bảng ánh xạ giữa hai loại địa chỉ này. Bản tin đi UDP 4342 và có HMAC để Map-Server tin được.', lesson: LESSON });
  const r1 = ctl(X1, MS, X1.ip, MS.ip, { type: 'register', eid: '192.168.1.0', mask: 24, rloc: X1.ip });
  sim.emit({ kind: 'transit', fromDevice: 'x1', toDevice: 'ms', side: 'forward', activeLayer: 4.5,
    titleVi: 'xTR1 cũng đăng ký EID của mình', packet: r1, tables: db([['192.168.1.0/24', '20.0.0.1'], ['192.168.2.0/24', '30.0.0.2']]),
    overlay: { links: { l5: { cls: 'trunk', label: 'Map-Register' } } },
    explanationVi: 'Underlay không biết hai mạng EID này. Bảng định tuyến lõi vì thế nhỏ hơn hẳn.', lesson: LESSON });

  const h = sim.frame(inner(X1.mac, HA.mac, 64));
  sim.capture(h, 'Gói IP từ Host-A');
  sim.emit({ kind: 'transit', fromDevice: 'ha', toDevice: 'x1', side: 'encap', activeLayer: 3,
    titleVi: 'Host-A gửi gói tới 192.168.2.20', packet: h,
    overlay: { links: { l1: { cls: 'forwarding', label: 'IP' } } },
    explanationVi: 'Máy không biết LISP. xTR1 đóng vai ITR, tra map-cache và chưa thấy mục nào.', lesson: LESSON });
  const q = ctl(X1, MS, X1.ip, MS.ip, { type: 'request', eid: HB.ip, mask: 32, itr: X1.ip });
  sim.capture(q, 'Map-Request');
  sim.emit({ kind: 'transit', fromDevice: 'x1', toDevice: 'ms', side: 'forward', activeLayer: 4.5,
    titleVi: 'xTR1 hỏi Map-Resolver: EID này ở đâu?', packet: q,
    overlay: { links: { l5: { cls: 'trunk', label: 'Map-Request' } } },
    explanationVi: 'Đây là cách làm theo yêu cầu, giống DNS: chỉ hỏi khi có lưu lượng. Trong lúc chờ, gói đầu tiên thường bị bỏ.', lesson: LESSON });
  // shortcut: thực tế Map-Server bọc câu hỏi trong Encapsulated Control Message; ở đây gửi thẳng cho dễ đọc
  const q2 = ctl(MS, X2, MS.ip, X2.ip, { type: 'request', eid: HB.ip, mask: 32, itr: X1.ip });
  sim.emit({ kind: 'transit', fromDevice: 'ms', toDevice: 'x2', side: 'forward', activeLayer: 4.5,
    titleVi: 'Map-Server chuyển câu hỏi tới xTR2', packet: q2,
    overlay: { links: { l6: { cls: 'trunk', label: 'Map-Request' } } },
    explanationVi: 'Mặc định ETR là bên có thẩm quyền trả lời. Map-Server chỉ biết phải chuyển tới đâu. Câu hỏi vẫn giữ ITR-RLOC 20.0.0.1 nên xTR2 biết trả lời về đâu. (Đơn giản hóa: thực tế Map-Server bọc câu hỏi trong Encapsulated Control Message.)', lesson: LESSON });
  const rep = ctl(X2, CORE, X2.ip, X1.ip, { type: 'reply', ...B_REC }, { sport: 4342, dport: 40342 }); // trả về đúng cổng nguồn của Map-Request
  sim.capture(rep, 'Map-Reply');
  sim.emit({ kind: 'transit', fromDevice: 'x2', toDevice: 'core', side: 'forward', activeLayer: 4.5,
    titleVi: 'xTR2 trả lời trực tiếp cho xTR1', packet: rep,
    overlay: { links: { l3: { cls: 'trunk', label: 'Map-Reply' } } },
    explanationVi: 'Map-Reply đi thẳng tới ITR-RLOC ghi trong câu hỏi, không quay lại Map-Server.', lesson: LESSON });
  const rep2 = ctl(CORE, X1, X2.ip, X1.ip, { type: 'reply', ...B_REC }, { sport: 4342, dport: 40342, ttl: 63 });
  sim.emit({ kind: 'transit', fromDevice: 'core', toDevice: 'x1', side: 'forward', activeLayer: 4.5,
    titleVi: 'xTR1 lưu vào map-cache', packet: rep2, tables: cache([['192.168.2.0/24', '30.0.0.2']]),
    overlay: { links: { l2: { cls: 'trunk', label: 'Map-Reply' } } },
    explanationVi: 'Mục này tồn tại theo TTL. Router chỉ giữ những đích đang dùng, không phải toàn bộ.', lesson: LESSON });

  const e1 = encap(CORE, X1);
  sim.capture(e1, 'LISP data UDP 4341');
  sim.emit({ kind: 'transit', fromDevice: 'x1', toDevice: 'core', side: 'forward', activeLayer: 4.5,
    titleVi: 'xTR1 đóng gói: IP ngoài theo RLOC, IP trong theo EID', packet: e1,
    overlay: { links: { l2: { cls: 'forwarding', label: 'LISP 4341' } } },
    explanationVi: 'Xem cây trường: IP ngoài 20.0.0.1 → 30.0.0.2, UDP 4341, LISP mang Instance ID 100, rồi tới gói gốc. Khác VXLAN ở chỗ LISP thường bọc gói IP, không bọc khung Ethernet.', lesson: LESSON });
  const e2 = encap(X2, CORE, 63); // router lõi giảm TTL IP ngoài
  sim.emit({ kind: 'transit', fromDevice: 'core', toDevice: 'x2', side: 'forward', activeLayer: 3,
    titleVi: 'Underlay định tuyến theo RLOC', packet: e2,
    overlay: { links: { l3: { cls: 'forwarding', label: 'LISP 4341' } } },
    explanationVi: 'Router lõi không cần biết 192.168.2.0/24.', lesson: LESSON });
  const f = sim.frame(inner(HB.mac, X2.mac, 62));
  sim.capture(f, 'Gói gốc tới Host-B');
  sim.emit({ kind: 'transit', fromDevice: 'x2', toDevice: 'hb', side: 'decap', activeLayer: 3,
    titleVi: '✓ xTR2 gỡ lớp LISP, Host-B nhận gói gốc', packet: f,
    overlay: { links: { l4: { cls: 'forwarding', label: 'IP' } } },
    explanationVi: 'Khi Host-B chuyển sang site khác, địa chỉ EID giữ nguyên. Chỉ cần đăng ký RLOC mới. Trong SD-Access, control plane node chính là LISP Map-Server.', lesson: LESSON });

  return sim.result();
}
