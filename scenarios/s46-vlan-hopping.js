// scenarios/s46-vlan-hopping.js
// Kịch bản 46 (Tấn công): VLAN hopping bằng double tagging. Kẻ tấn công ở VLAN trùng native VLAN của trunk
// gửi khung có hai nhãn 802.1Q. SW1 gỡ nhãn ngoài, SW2 đọc nhãn trong và giao khung sang VLAN khác.
// Phòng thủ: native VLAN không dùng cho người dùng, gắn nhãn cả native VLAN, tắt DTP.

import { Sim } from '../engine/simulate.js';
import { pingData } from './_common.js';

const ATT = { mac: '00:de:ad:00:00:66', ip: '192.168.20.66' };
const VIC = { mac: '00:1a:2b:00:00:20', ip: '192.168.20.20' };

const LESSON = { path: '../Network security/Module-02_Buc-tranh-tan-cong/Bai-09_Tan-cong-mang-noi-bo.md', label: 'Bài 09 Security — Tấn công Layer 2' };

export const meta = {
  id: 's46-vlan-hopping',
  titleVi: '⚔️ Tấn công: VLAN hopping (hai nhãn 802.1Q)',
  titleEn: 'Attack: VLAN hopping (double tagging)',
  descriptionVi: 'Kẻ tấn công ở VLAN 1 gửi khung mang hai nhãn VLAN để lọt sang VLAN 20 mà không cần router.',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'att', type: 'host', name: 'Kẻ tấn công', x: 120, y: 150, color: '#a0433a', lines: ['cổng access VLAN 1', '= native VLAN của trunk'] },
      { id: 'sw1', type: 'switch', name: 'SW1', x: 380, y: 150, lines: ['Fa0/3 = VLAN 1'] },
      { id: 'sw2', type: 'switch', name: 'SW2', x: 640, y: 150, lines: ['Fa0/2 = VLAN 20'] },
      { id: 'vic', type: 'host', name: 'Máy chủ VLAN 20', x: 890, y: 150, color: '#2e7d5b', lines: [VIC.ip] },
    ],
    links: [{ id: 'l1', a: 'att', b: 'sw1', bp: 'Fa0/3' }, { id: 'tr', a: 'sw1', b: 'sw2', labelMid: 'trunk, native VLAN 1' }, { id: 'l2', a: 'sw2', b: 'vic', ap: 'Fa0/2' }],
  };
  const sim = new Sim(topology);
  const frame = (tags) => sim.frame([
    { proto: 'ethernet', fields: { dst: VIC.mac, src: ATT.mac, etherType: tags.length ? 0x8100 : 0x0800 } },
    ...tags.map((vid, i) => ({ proto: 'dot1q', fields: { pcp: 0, dei: 0, vid, innerType: i < tags.length - 1 ? 0x8100 : 0x0800 } })),
    { proto: 'ipv4', fields: { src: ATT.ip, dst: VIC.ip, ttl: 64, id: 0x4d2, protocol: 1 } },
    { proto: 'icmp', fields: { type: 8, code: 0, identifier: 1, seq: 1, data: pingData() } },
  ]);

  sim.emit({ kind: 'process', atDevice: 'sw1', side: 'inspect', activeLayer: 2,
    titleVi: 'Bối cảnh: native VLAN của trunk trùng VLAN người dùng',
    tables: { list: { title: 'Cấu hình liên quan', cols: ['Thiết bị', 'Cổng', 'Cấu hình'], rows: [['SW1', 'Fa0/3', 'access VLAN 1'], ['SW1–SW2', 'Gi0/1', 'trunk, native VLAN 1'], ['SW2', 'Fa0/2', 'access VLAN 20']] } },
    explanationVi: 'Trên trunk 802.1Q, khung của native VLAN đi không có nhãn. VLAN 1 là native VLAN mặc định. Kẻ tấn công ngồi ở một cổng access thuộc đúng VLAN đó.', lesson: LESSON });

  const dbl = frame([1, 20]);
  sim.capture(dbl, 'Khung hai nhãn (1 ngoài, 20 trong)');
  sim.emit({ kind: 'transit', fromDevice: 'att', toDevice: 'sw1', side: 'encap', activeLayer: 2,
    titleVi: 'Kẻ tấn công gửi khung có hai nhãn: ngoài VLAN 1, trong VLAN 20', packet: dbl,
    decision: {
      question: 'SW1 nhận khung này ở cổng access VLAN 1 và cần gửi qua trunk có native VLAN 1. SW1 làm gì với các nhãn?',
      options: ['Loại khung vì cổng access không nhận nhãn', 'Gỡ nhãn ngoài (VLAN 1), để nguyên nhãn trong (VLAN 20)', 'Gỡ cả hai nhãn', 'Thêm nhãn thứ ba'],
      correct: 1,
      explainVi: 'Nhãn ngoài khớp VLAN của cổng nên được nhận. Khi gửi lên trunk, khung thuộc native VLAN đi không nhãn, nên SW1 chỉ gỡ nhãn ngoài.',
    },
    explanationVi: 'Máy thường không gắn nhãn VLAN. Kẻ tấn công dùng công cụ tạo khung tuỳ ý (ví dụ Scapy, Yersinia). Mở cây trường để thấy hai lớp 802.1Q liền nhau.', lesson: LESSON });

  const single = frame([20]);
  sim.capture(single, 'Trên trunk: chỉ còn nhãn VLAN 20');
  sim.emit({ kind: 'transit', fromDevice: 'sw1', toDevice: 'sw2', side: 'forward', activeLayer: 2,
    titleVi: 'SW1 gỡ nhãn ngoài: trên trunk chỉ còn nhãn VLAN 20', packet: single,
    overlay: { links: { tr: { cls: 'trunk', label: 'khung mang nhãn 20' } } },
    explanationVi: 'SW1 coi khung thuộc VLAN 1 (native) nên gửi lên trunk mà không thêm nhãn nào. Nhãn bên trong lúc này thành nhãn duy nhất.', lesson: LESSON });

  const plain = frame([]);
  sim.capture(plain, 'Tới máy chủ VLAN 20 (không nhãn)');
  sim.emit({ kind: 'transit', fromDevice: 'sw2', toDevice: 'vic', side: 'decap', activeLayer: 2,
    titleVi: 'SW2 đọc nhãn 20 và giao khung vào VLAN 20', packet: plain,
    overlay: { links: { l2: { cls: 'blocking', label: 'khung lọt sang VLAN 20' } } },
    explanationVi: 'SW2 chỉ thấy một khung mang nhãn VLAN 20 đến từ trunk, nên gỡ nhãn và gửi ra cổng access VLAN 20. Khung đã vượt VLAN mà không qua router hay firewall nào.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'vic', side: 'inspect', activeLayer: 3,
    titleVi: 'Tấn công chỉ đi được một chiều',
    decision: {
      question: 'Máy chủ trả lời. Gói trả lời có về tới kẻ tấn công không?',
      options: ['Có, đi ngược lại đúng đường cũ', 'Không: trả lời thuộc VLAN 20, không lọt ngược về VLAN 1', 'Có, vì trunk cho mọi VLAN', 'Có, nếu máy chủ dùng broadcast'],
      correct: 1,
      explainVi: 'Máy chủ gửi khung không nhãn, switch xếp nó vào VLAN 20. Không có nhãn kép nào ở chiều về.',
    },
    explanationVi: 'Kẻ tấn công không nhận được trả lời, nên kiểu tấn công này dùng để gửi gói một chiều: gói UDP khai thác lỗ hổng, gói gây từ chối dịch vụ. Điều kiện bắt buộc: kẻ tấn công ở VLAN trùng native VLAN của trunk.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'sw1', side: 'inspect', activeLayer: 2,
    titleVi: 'Phòng thủ: tách native VLAN khỏi người dùng',
    decision: {
      question: 'Cách nào chặn double tagging?',
      options: ['Đổi native VLAN của trunk sang một VLAN không có người dùng', 'Bật PortFast trên trunk', 'Tăng MTU', 'Dùng cáp chéo giữa hai switch'],
      correct: 0,
      explainVi: 'Nếu không cổng người dùng nào thuộc native VLAN thì nhãn ngoài của kẻ tấn công không bao giờ bị gỡ theo kiểu native.',
    },
    tables: { list: { title: 'Cấu hình nên có', cols: ['Lệnh', 'Tác dụng'], rows: [
      ['switchport trunk native vlan 999', 'Native VLAN là VLAN không dùng'],
      ['vlan dot1q tag native', 'Gắn nhãn cả native VLAN'],
      ['switchport mode access + switchport nonegotiate', 'Cổng người dùng không tự thành trunk (chặn switch spoofing qua DTP)'],
      ['switchport trunk allowed vlan 10,20', 'Trunk chỉ mang VLAN cần thiết'],
    ] } },
    explanationVi: 'Không để người dùng ở VLAN 1. Kiểu VLAN hopping thứ hai là switch spoofing: kẻ tấn công gửi DTP để cổng tự thành trunk; tắt DTP trên cổng access là chặn được.', lesson: LESSON });

  return sim.result();
}
