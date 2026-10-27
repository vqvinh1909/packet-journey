// scenarios/s16-fragmentation.js
// Kịch bản 16 (CCNA): Phân mảnh IPv4 khi MTU nhỏ.
// Gói lớn đi vào link MTU nhỏ → router cắt thành nhiều mảnh: cùng Identification,
// cờ MF, Fragment Offset (đơn vị 8 byte). Nếu bật DF → drop + ICMP Fragmentation Needed.

import { Sim } from '../engine/simulate.js';
import { echoFrame, pingData, ICMP_TYPE } from './_common.js';

const PC = { mac: '00:1a:2b:00:00:10', ip: '192.168.1.10' };
const R1 = { mac: '00:1a:2b:00:00:a1' };
const R2 = { mac: '00:1a:2b:00:00:b1' };
const SRV = { mac: '00:1a:2b:00:00:ff', ip: '192.168.2.10' };
const MTU = 300;
const ID = 0xbeef;

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-01_Nen-tang-mang/Bai-05_Dia-chi-IPv4.md',
  label: 'Bài 05 — Địa chỉ IPv4 (header)',
};

export const meta = {
  id: 's16-fragmentation',
  titleVi: 'Phân mảnh IPv4 (MTU nhỏ)',
  titleEn: 'IPv4 fragmentation',
  descriptionVi: 'Gói lớn gặp link MTU nhỏ → router cắt mảnh (Identification, MF, Fragment Offset). DF=1 thì báo ICMP Frag Needed (PMTUD).',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 280',
    devices: [
      { id: 'pc', type: 'host', name: 'PC', x: 130, y: 150, lines: ['192.168.1.10'] },
      { id: 'r1', type: 'router', name: 'R1', x: 400, y: 150, lines: ['cắt mảnh ở đây'] },
      { id: 'r2', type: 'router', name: 'R2', x: 680, y: 150, lines: [] },
      { id: 'srv', type: 'host', name: 'Server', x: 910, y: 150, color: '#2e7d5b', lines: ['192.168.2.10'] },
    ],
    links: [
      { id: 'l1', a: 'pc', b: 'r1', labelMid: 'MTU 1500' },
      { id: 'l2', a: 'r1', b: 'r2', labelMid: `MTU ${MTU}` },
      { id: 'l3', a: 'r2', b: 'srv', labelMid: `MTU ${MTU}` },
    ],
  };

  const sim = new Sim(topology);

  // Gói gốc (chưa cắt): ICMP 8 + 520 data = 528; IP total 548
  const original = sim.frame(echoFrame({ ethDst: R1.mac, ethSrc: PC.mac, srcIp: PC.ip, dstIp: SRV.ip,
    ttl: 64, ipId: ID, identifier: 0x0010, seq: 1, type: ICMP_TYPE.ECHO_REQUEST, data: pingData(520) }));
  const icmpLayer = original.tree.find((l) => l.layer === 'icmp');
  const icmpBytes = Array.from(original.bytes.slice(icmpLayer.byteOffset)); // 528 byte (có checksum đúng)
  const part1 = icmpBytes.slice(0, 280); // ICMP header + 272 byte data đầu (280 = bội số 8)
  const part2 = icmpBytes.slice(280);    // 248 byte còn lại

  sim.capture(original, 'Gói gốc chưa cắt (548 byte)');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'PC gửi gói lớn 548 byte', packet: original,
    explanationVi: 'Một gói IPv4 548 byte (ICMP data 520 byte) rời PC bình thường — link đầu MTU 1500 nên chưa sao. Chú ý MF=0, Offset=0 (gói nguyên).',
    lesson: LESSON });

  // R1 cắt mảnh
  const frag1 = sim.frame([
    { proto: 'ethernet', fields: { dst: R2.mac, src: R1.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: PC.ip, dst: SRV.ip, ttl: 63, id: ID, protocol: 1, flagsMF: true, fragOffset: 0, totalLength: 20 + part1.length } },
    { proto: 'raw', fields: { data: part1, desc: 'Mảnh 1: ICMP header + 272 byte data đầu' } },
  ]);
  const frag2 = sim.frame([
    { proto: 'ethernet', fields: { dst: R2.mac, src: R1.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: PC.ip, dst: SRV.ip, ttl: 63, id: ID, protocol: 1, flagsMF: false, fragOffset: part1.length / 8, totalLength: 20 + part2.length } },
    { proto: 'raw', fields: { data: part2, desc: 'Mảnh 2: 248 byte data còn lại' } },
  ]);

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'forward', activeLayer: 3,
    titleVi: `R1: link kế MTU ${MTU} < 548 → phải cắt mảnh`, packet: frag1,
    overlay: { links: { l2: { cls: 'trunk', label: `MTU ${MTU}` } } },
    explanationVi: `Payload IP tối đa mỗi mảnh = ${MTU} − 20 = ${MTU - 20}, làm tròn xuống bội số 8 = 280. R1 cắt gói 548 byte thành 2 mảnh, ` +
      'GIỮ NGUYÊN Identification (0xbeef) để đích biết chúng cùng một gói. Mảnh đầu đặt MF=1, Offset=0.',
    lesson: LESSON });
  sim.capture(frag1, 'Mảnh 1 (MF=1, offset 0)');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'r2', side: 'forward', activeLayer: 3,
    titleVi: 'Mảnh 1: MF=1, Offset=0, total 300', packet: frag1,
    overlay: { links: { l2: { cls: 'trunk', label: 'mảnh 1 →' } } },
    explanationVi: 'Mảnh 1 chứa ICMP header + 272 byte đầu. MF=1 (còn mảnh sau). Chỉ mảnh đầu mới có header ICMP.' });
  sim.capture(frag2, 'Mảnh 2 (MF=0, offset 35)');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'r2', side: 'forward', activeLayer: 3,
    titleVi: 'Mảnh 2: MF=0, Offset=35 (=280/8), total 268', packet: frag2,
    overlay: { links: { l2: { cls: 'trunk', label: 'mảnh 2 →' } } },
    explanationVi: 'Mảnh 2 chỉ là 248 byte dữ liệu tiếp theo (không có header ICMP). Offset = 35 nghĩa là byte thứ 35×8 = 280 của payload gốc. MF=0 = mảnh cuối.' });

  sim.emit({ kind: 'process', atDevice: 'srv', side: 'decap', activeLayer: 3,
    titleVi: 'Server ghép mảnh lại (reassembly)', packet: original,
    explanationVi: 'Đích gom các mảnh CÙNG Identification + cùng (src,dst,proto), xếp theo Offset; thấy MF=0 là đã đủ → ghép lại đúng gói 548 byte ban đầu rồi xử lý ICMP. ' +
      'Chỉ ĐÍCH mới ghép mảnh, router dọc đường không ghép.',
    lesson: LESSON });

  // Biến thể DF=1 → ICMP Fragmentation Needed (PMTUD)
  const fragNeeded = sim.frame([
    { proto: 'ethernet', fields: { dst: PC.mac, src: R1.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: '192.168.1.1', dst: PC.ip, ttl: 64, id: 0, protocol: 1 } },
    { proto: 'icmp', fields: { type: ICMP_TYPE.DEST_UNREACHABLE, code: 4, identifier: 0, seq: MTU,
      data: Array.from(original.bytes.slice(14, 42)) } }, // unused(0) + Next-Hop MTU(=300) + IP gốc+8
  ]);
  sim.capture(fragNeeded, 'ICMP Fragmentation Needed (DF=1)');
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'Biến thể: nếu DF=1 → không được cắt → báo lỗi', packet: fragNeeded,
    explanationVi: `Nếu gói đặt cờ DF (Don't Fragment) = 1, R1 KHÔNG được cắt → DROP và gửi ICMP Type 3 Code 4 "Fragmentation Needed", ` +
      `kèm Next-Hop MTU = ${MTU}. Nguồn nhận được sẽ giảm kích thước gói xuống — đây là cơ chế Path MTU Discovery (PMTUD). ` +
      '(Đơn giản hóa: trường MTU dùng lại ô Sequence của ICMP cho đúng vị trí byte.)',
    lesson: LESSON });

  return sim.result();
}
