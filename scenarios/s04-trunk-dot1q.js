// scenarios/s04-trunk-dot1q.js
// Kịch bản 4 (CCNA Switching): Trunk 802.1Q. PC-A và PC-B cùng VLAN 10 nhưng nằm trên
// 2 switch nối nhau bằng TRUNK. Frame được GẮN nhãn 802.1Q (VID=10) khi vào trunk,
// GỠ nhãn khi ra cổng access. Native VLAN thì đi qua trunk KHÔNG gắn tag.

import { Sim } from '../engine/simulate.js';
import { echoFrame, pingData, ICMP_TYPE } from './_common.js';

const C10 = '#2c5f8a';
const PCA = { mac: '00:10:10:aa:00:01', ip: '192.168.10.1' };
const PCB = { mac: '00:10:10:bb:00:02', ip: '192.168.10.2' };
const VID = 10;

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-09_Trunking-DTP-VTP.md',
  label: 'Bài 09 — Trunking (802.1Q, DTP, VTP)',
};

export const meta = {
  id: 's04-trunk-dot1q',
  titleVi: 'Trunk 802.1Q gắn/gỡ nhãn',
  titleEn: '802.1Q trunk tagging',
  descriptionVi: 'PC-A ↔ PC-B cùng VLAN 10 qua 2 switch nối trunk. Xem nhãn 802.1Q được gắn trên trunk và gỡ ở cổng access.',
  difficulty: 2,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'pca', type: 'host', name: 'PC-A', x: 110, y: 220, color: C10, lines: ['192.168.10.1', 'VLAN 10'] },
      { id: 'sw1', type: 'switch', name: 'SW1', x: 350, y: 110, lines: ['Fa0/1 access VLAN10', 'Gi0/1 trunk'] },
      { id: 'sw2', type: 'switch', name: 'SW2', x: 650, y: 110, lines: ['Gi0/1 trunk', 'Fa0/1 access VLAN10'] },
      { id: 'pcb', type: 'host', name: 'PC-B', x: 890, y: 220, color: C10, lines: ['192.168.10.2', 'VLAN 10'] },
    ],
    links: [
      { id: 'la', a: 'pca', b: 'sw1', labelMid: 'access' },
      { id: 'trunk', a: 'sw1', b: 'sw2', labelMid: 'TRUNK 802.1Q' },
      { id: 'lb', a: 'sw2', b: 'pcb', labelMid: 'access' },
    ],
  };

  const sim = new Sim(topology);
  const trunkOverlay = { links: { trunk: { cls: 'trunk', label: 'TRUNK · tagged VID 10' } } };

  // Khung ICMP không tag (trên cổng access)
  const untagged = (type, from = PCA, to = PCB) => sim.frame(echoFrame({
    ethDst: to.mac, ethSrc: from.mac, srcIp: from.ip, dstIp: to.ip,
    ttl: 64, ipId: 0x7b20, identifier: 0x0004, seq: 1, type,
  }));
  // Khung ICMP CÓ nhãn 802.1Q (trên trunk): eth.type = 0x8100 (TPID) + dot1q
  const tagged = (type, from = PCA, to = PCB) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x8100 } },
    { proto: 'dot1q', fields: { pcp: 0, dei: 0, vid: VID, innerType: 0x0800 } },
    { proto: 'ipv4', fields: { src: from.ip, dst: to.ip, ttl: 64, id: 0x7b20, protocol: 1 } },
    { proto: 'icmp', fields: { type, code: 0, identifier: 0x0004, seq: 1, data: pingData() } },
  ]);

  sim.emit({
    kind: 'process', atDevice: 'pca', side: 'encap', activeLayer: 3,
    titleVi: 'PC-A đóng gói ICMP (chưa có tag)',
    packet: untagged(ICMP_TYPE.ECHO_REQUEST),
    explanationVi:
      'PC-A và PC-B cùng VLAN 10, cùng mạng 192.168.10.0/24 (giả định ARP đã xong). PC-A tạo ICMP Echo Request bình thường. ' +
      'Host KHÔNG biết gì về VLAN — frame rời PC-A là Ethernet thường, không nhãn.',
    lesson: LESSON,
  });

  sim.emit({
    kind: 'transit', fromDevice: 'pca', toDevice: 'sw1', side: 'encap', activeLayer: 2,
    titleVi: 'Frame access (không tag) vào SW1',
    packet: untagged(ICMP_TYPE.ECHO_REQUEST),
    explanationVi: 'Trên cổng access Fa0/1, frame đi KHÔNG có nhãn 802.1Q. EtherType = 0x0800 (IPv4).',
  });

  const taggedReq = tagged(ICMP_TYPE.ECHO_REQUEST);
  sim.capture(taggedReq, 'ICMP Echo Request (tagged VID 10 trên trunk)');
  sim.emit({
    kind: 'process', atDevice: 'sw1', side: 'forward', activeLayer: 2,
    titleVi: 'SW1 GẮN nhãn 802.1Q (VID = 10)',
    packet: taggedReq,
    changedFields: ['eth.type', 'dot1q.vid', 'dot1q.type'],
    overlay: trunkOverlay,
    explanationVi:
      'Cổng nhận là access VLAN 10, cổng ra là TRUNK. SW1 chèn 4 byte nhãn 802.1Q: EtherType của khung đổi thành 0x8100 (TPID), ' +
      'thêm TCI chứa VID = 10, rồi EtherType thật 0x0800. Nhờ VID, SW2 biết frame thuộc VLAN nào.',
    lesson: LESSON,
  });

  sim.emit({
    kind: 'transit', fromDevice: 'sw1', toDevice: 'sw2', side: 'forward', activeLayer: 2,
    titleVi: 'Frame CÓ tag chạy trên trunk',
    packet: taggedReq,
    overlay: trunkOverlay,
    explanationVi:
      'Trên trunk, frame dài thêm 4 byte vì nhãn 802.1Q. Nếu frame thuộc NATIVE VLAN (mặc định VLAN 1) thì trunk sẽ gửi KHÔNG gắn tag — đó là ngoại lệ hay bị hỏi.',
  });

  sim.emit({
    kind: 'process', atDevice: 'sw2', side: 'forward', activeLayer: 2,
    titleVi: 'SW2 đọc VID = 10, GỠ nhãn ra cổng access',
    packet: untagged(ICMP_TYPE.ECHO_REQUEST),
    changedFields: [],
    explanationVi:
      'SW2 đọc VID = 10 → biết frame thuộc VLAN 10 → cổng ra là access Fa0/1 (VLAN 10) nên GỠ nhãn 802.1Q. ' +
      'PC-B sẽ nhận một khung Ethernet thường, không tag.',
    lesson: LESSON,
  });

  sim.emit({
    kind: 'transit', fromDevice: 'sw2', toDevice: 'pcb', side: 'decap', activeLayer: 3,
    titleVi: 'PC-B nhận frame (đã gỡ tag) — ping tới',
    packet: untagged(ICMP_TYPE.ECHO_REQUEST),
    explanationVi: 'PC-B nhận ICMP Echo Request như một khung bình thường. Tag chỉ "sống" trên đoạn trunk giữa 2 switch.',
  });

  // Chiều về (tóm tắt): PC-B -> trunk (tag) -> PC-A
  const taggedReply = tagged(ICMP_TYPE.ECHO_REPLY, PCB, PCA);
  sim.capture(taggedReply, 'ICMP Echo Reply (tagged VID 10 trên trunk)');
  sim.emit({
    kind: 'transit', fromDevice: 'sw2', toDevice: 'sw1', side: 'forward', activeLayer: 2,
    titleVi: 'Echo Reply về: lại được gắn tag trên trunk',
    packet: taggedReply,
    overlay: trunkOverlay,
    explanationVi: 'Chiều về y hệt: PC-B gửi không tag → SW2 gắn VID 10 lên trunk → SW1 gỡ tag → PC-A nhận. Ping thành công.',
    lesson: LESSON,
  });

  return sim.result();
}
