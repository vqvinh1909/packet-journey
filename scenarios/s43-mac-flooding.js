// scenarios/s43-mac-flooding.js
// Kịch bản 43 (Tấn công): MAC flooding. Kẻ tấn công gửi hàng nghìn khung với MAC nguồn giả làm đầy bảng MAC.
// Switch không học thêm được nên flood khung unicast ra mọi cổng. Phòng thủ: port security.

import { Sim } from '../engine/simulate.js';
import { arpFrame, echoFrame, ARP_OP, ICMP_TYPE, BROADCAST_MAC } from './_common.js';

const PC1 = { mac: '00:1a:2b:00:00:10', ip: '192.168.1.10' };
const PC2 = { mac: '00:1a:2b:00:00:20', ip: '192.168.1.20' };
const FAKE = ['02:11:6f:3a:90:01', '02:c4:07:5e:12:02', '02:9b:e8:41:7d:03'];

const LESSON = { path: '../Network security/Module-02_Buc-tranh-tan-cong/Bai-09_Tan-cong-mang-noi-bo.md', label: 'Bài 09 Security — Tấn công Layer 2' };

export const meta = {
  id: 's43-mac-flooding',
  titleVi: '⚔️ Tấn công: MAC flooding (tràn bảng MAC)',
  titleEn: 'Attack: MAC flooding (CAM table overflow)',
  descriptionVi: 'Kẻ tấn công làm đầy bảng MAC của switch bằng MAC giả. Switch hết chỗ học nên gửi khung ra mọi cổng như một hub.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 380',
    devices: [
      { id: 'pc1', type: 'host', name: 'PC1', x: 160, y: 120, color: '#2c5f8a', lines: [PC1.ip, 'Fa0/1'] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 500, y: 120, lines: ['bảng MAC tối đa 8192'] },
      { id: 'pc2', type: 'host', name: 'PC2', x: 840, y: 120, color: '#2e7d5b', lines: [PC2.ip, 'Fa0/2'] },
      { id: 'att', type: 'host', name: 'Kẻ tấn công', x: 500, y: 310, color: '#a0433a', lines: ['Fa0/3', 'chạy macof'] },
    ],
    links: [{ id: 'l1', a: 'pc1', b: 'sw' }, { id: 'l2', a: 'sw', b: 'pc2' }, { id: 'l3', a: 'sw', b: 'att' }],
  };
  const sim = new Sim(topology);
  const table = (rows, title) => ({ list: { title, cols: ['MAC', 'Cổng'], rows } });
  const real = [[PC1.mac, 'Fa0/1'], [PC2.mac, 'Fa0/2']];
  const fakeRows = FAKE.map((m) => [m, 'Fa0/3']);

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'inspect', activeLayer: 2,
    titleVi: 'Bình thường: switch biết PC2 ở cổng Fa0/2',
    tables: table(real, 'Bảng MAC của SW1 (2/8192)'),
    explanationVi: 'Switch học MAC nguồn của mỗi khung đi vào. Khi biết MAC đích ở cổng nào, nó chỉ gửi khung ra đúng cổng đó, nên máy khác không thấy.', lesson: LESSON });

  FAKE.forEach((mac, i) => {
    const f = sim.frame(arpFrame({ op: ARP_OP.REQUEST, senderMac: mac, senderIp: `10.${i + 7}.${i * 31 + 5}.9`, targetMac: '00:00:00:00:00:00', targetIp: '10.0.0.1', ethDst: BROADCAST_MAC }));
    sim.capture(f, `Khung MAC nguồn giả #${i + 1}`);
    sim.emit({ kind: 'transit', fromDevice: 'att', toDevice: 'sw', side: 'encap', activeLayer: 2,
      titleVi: `Khung giả #${i + 1}: MAC nguồn ${mac}`, packet: f,
      tables: table([...real, ...fakeRows.slice(0, i + 1)], `Bảng MAC của SW1 (${i + 3}/8192)`),
      ...(i === 0 ? { decision: {
        question: 'Mỗi khung mang một MAC nguồn khác nhau, đều đi vào cổng Fa0/3. Switch làm gì với mỗi MAC?',
        options: ['Bỏ qua vì MAC lạ', 'Học thêm một dòng mới trong bảng MAC', 'Khoá cổng Fa0/3 ngay', 'Hỏi lại bằng ARP'],
        correct: 1,
        explainVi: 'Mặc định switch học mọi MAC nguồn, không giới hạn số MAC trên một cổng.',
      } } : {}),
      explanationVi: 'Công cụ như macof sinh hàng chục nghìn khung mỗi phút, mỗi khung một MAC nguồn ngẫu nhiên. Ở đây chỉ vẽ 3 khung đại diện.', lesson: LESSON });
  });

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'inspect', activeLayer: 2,
    titleVi: 'Bảng MAC đầy: 8192/8192',
    tables: table([...fakeRows, ['… 8189 MAC giả khác', 'Fa0/3']], 'Bảng MAC của SW1 (8192/8192, đầy)'),
    decision: {
      question: 'Bảng MAC đã đầy, dòng của PC2 đã hết hạn và không học lại được. PC1 gửi khung tới PC2 thì switch làm gì?',
      options: ['Loại khung', 'Flood khung ra mọi cổng trong VLAN', 'Gửi về gateway', 'Giữ khung chờ bảng trống'],
      correct: 1,
      explainVi: 'MAC đích không có trong bảng là unknown unicast. Switch flood nó ra mọi cổng, giống broadcast.',
    },
    explanationVi: 'Các dòng thật hết hạn sau 300 giây và bị MAC giả chiếm chỗ. Switch không còn chỗ để học lại MAC của PC1 và PC2.', lesson: LESSON });

  const ping = sim.frame(echoFrame({ ethDst: PC2.mac, ethSrc: PC1.mac, srcIp: PC1.ip, dstIp: PC2.ip, ttl: 64, ipId: 0x4d2, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
  sim.capture(ping, 'PC1 → PC2 (bị flood)');
  sim.emit({ kind: 'transit', fromDevice: 'pc1', toDevice: 'sw', side: 'encap', activeLayer: 2,
    titleVi: 'PC1 gửi khung unicast cho PC2', packet: ping,
    explanationVi: 'Khung có MAC đích là PC2. Với PC1, mọi thứ vẫn bình thường.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'pc2', side: 'forward', activeLayer: 2,
    titleVi: 'Switch flood: PC2 nhận được…', packet: ping,
    overlay: { links: { l2: { cls: 'forwarding', label: 'bản sao 1' }, l3: { cls: 'blocking', label: 'bản sao 2' } } },
    explanationVi: 'Không tìm thấy MAC đích trong bảng, switch gửi bản sao ra mọi cổng.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'att', side: 'forward', activeLayer: 2,
    titleVi: '…và kẻ tấn công cũng nhận được bản sao', packet: ping,
    overlay: { links: { l3: { cls: 'blocking', label: 'nghe lén' } } },
    explanationVi: 'Kẻ tấn công bật Wireshark là đọc được lưu lượng của người khác. Mạng cũng chậm hẳn vì mọi khung đều bị nhân bản.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'inspect', activeLayer: 2,
    titleVi: 'Phòng thủ: port security',
    decision: {
      question: 'Cấu hình nào chặn được MAC flooding trên cổng người dùng?',
      options: ['switchport port-security maximum 2', 'spanning-tree portfast', 'switchport mode trunk', 'no cdp enable'],
      correct: 0,
      explainVi: 'Port security giới hạn số MAC học được trên cổng. Vượt giới hạn thì cổng vi phạm.',
    },
    tables: table(real, 'Bảng MAC của SW1 sau khi bật port security'),
    explanationVi: 'Trên cổng access: `switchport port-security`, `switchport port-security maximum 2`, `switchport port-security violation shutdown`. Khi MAC thứ ba xuất hiện, cổng Fa0/3 vào trạng thái err-disabled. Xem bằng `show port-security interface Fa0/3`.', lesson: LESSON });

  return sim.result();
}
