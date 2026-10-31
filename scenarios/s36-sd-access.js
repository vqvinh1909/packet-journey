// scenarios/s36-sd-access.js
// Kịch bản 36 (ENCOR 1.3, 5.4): SD-Access.
// LISP làm mặt phẳng điều khiển, VXLAN-GPO mang SGT, Edge đích thực thi SGACL.

import { Sim } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

const HA = { mac: '00:aa:00:00:36:01', ip: '10.10.10.11' };
const HB = { mac: '00:aa:00:00:36:02', ip: '10.10.10.22' };
const IOT = { mac: '00:aa:00:00:36:03', ip: '10.10.10.33' };
const E1 = { mac: '00:1a:2b:00:36:01', ip: '172.16.0.1' };
const E2 = { mac: '00:1a:2b:00:36:02', ip: '172.16.0.2' };
const CP = { mac: '00:1a:2b:00:36:0a', ip: '172.16.0.100' };
const VNI = 8190;

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-08_Cau-hinh-va-quan-ly-VLAN.md',
  label: 'Bài 08 — VLAN (SD-Access: ENCOR 1.3, 5.4)',
};

export const meta = {
  id: 's36-sd-access',
  titleVi: 'SD-Access: LISP, VXLAN-GPO và SGT',
  titleEn: 'SD-Access: LISP, VXLAN-GPO, SGT',
  descriptionVi: 'Control plane node tìm vị trí máy bằng LISP. Gói đi trong VXLAN mang theo nhãn nhóm SGT. Edge đích dùng SGACL để cho phép hoặc chặn, kể cả hai máy cùng subnet.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1100 300',
    devices: [
      { id: 'ha', type: 'host', name: 'Laptop', x: 90, y: 220, color: '#2c5f8a', lines: ['10.10.10.11', 'SGT 10'] },
      { id: 'e1', type: 'switch', name: 'Edge1', x: 320, y: 220, lines: ['172.16.0.1'] },
      { id: 'cp', type: 'router', name: 'CP + Border', x: 550, y: 220, lines: ['172.16.0.100'] },
      { id: 'e2', type: 'switch', name: 'Edge2', x: 780, y: 220, lines: ['172.16.0.2'] },
      { id: 'hb', type: 'host', name: 'Server', x: 1010, y: 220, color: '#2c5f8a', lines: ['10.10.10.22', 'SGT 20'] },
      { id: 'ise', type: 'host', name: 'ISE', x: 320, y: 60, color: '#6b4fa0', lines: ['xác thực, cấp SGT'] },
      { id: 'cc', type: 'host', name: 'Catalyst Center', x: 780, y: 60, color: '#6b4fa0', lines: ['thiết kế, chính sách'] },
    ],
    links: [
      { id: 'l1', a: 'ha', b: 'e1' },
      { id: 'l2', a: 'e1', b: 'cp' },
      { id: 'l3', a: 'cp', b: 'e2' },
      { id: 'l4', a: 'e2', b: 'hb' },
      { id: 'l5', a: 'ise', b: 'e1' },
      { id: 'l6', a: 'cc', b: 'e2' },
    ],
  };
  const sim = new Sim(topology);

  const ctl = (to, from, srcIp, dstIp, fields) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: srcIp, dst: dstIp, ttl: 64, id: 0x3600, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 40342, dstPort: 4342 } },
    { proto: 'lisp', fields },
  ]);
  const inner = (src, dst, ttl) => echoFrame({ ethDst: dst.mac, ethSrc: src.mac, srcIp: src.ip, dstIp: dst.ip, ttl, ipId: 0x3601, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST });
  const vx = (to, from, sgt, src) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: E1.ip, dst: E2.ip, ttl: 64, id: 0x3602, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 54321, dstPort: 4789 } },
    { proto: 'vxlan', fields: { vni: VNI, sgt } },
    ...inner(src, HB, 64),
  ]);
  const sgacl = (hl) => ({ list: { title: 'Ma trận SGACL trên Edge2', cols: ['Nguồn', 'Đích', 'Hành động'], rows: [['SGT 10 Nhân viên', 'SGT 20 Server', 'permit' + (hl === 10 ? ' ◀' : '')], ['SGT 30 IoT', 'SGT 20 Server', 'deny' + (hl === 30 ? ' ◀' : '')]] } });

  const reg = ctl(CP, E1, E1.ip, CP.ip, { type: 'register', eid: HA.ip, mask: 32, rloc: E1.ip });
  sim.capture(reg, 'Map-Register: EID của Laptop');
  sim.emit({ kind: 'process', atDevice: 'e1', side: 'forward', activeLayer: 4.5,
    titleVi: 'Laptop vượt qua 802.1X, ISE gán SGT 10', packet: reg,
    overlay: { links: { l5: { cls: 'trunk', label: 'RADIUS: SGT 10' } } },
    explanationVi: 'Máy được xếp vào virtual network (tương ứng VRF) và nhóm SGT theo danh tính, không theo địa chỉ IP. Catalyst Center chỉ định nghĩa chính sách, nó không nằm trên đường dữ liệu.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'e1', toDevice: 'cp', side: 'forward', activeLayer: 4.5,
    titleVi: 'Edge1 đăng ký EID với control plane node', packet: reg,
    overlay: { links: { l2: { cls: 'trunk', label: 'LISP Map-Register' } } },
    explanationVi: 'Mặt phẳng điều khiển là LISP, như s35. Vì thế fabric biết ngay máy đang ở Edge nào, kể cả sau khi chuyển vị trí.', lesson: LESSON });
  const reg2 = ctl(CP, E2, E2.ip, CP.ip, { type: 'register', eid: HB.ip, mask: 32, rloc: E2.ip });
  sim.emit({ kind: 'transit', fromDevice: 'e2', toDevice: 'cp', side: 'forward', activeLayer: 4.5,
    titleVi: 'Edge2 đăng ký Server', packet: reg2,
    overlay: { links: { l3: { cls: 'trunk', label: 'LISP Map-Register' } } },
    explanationVi: 'Mạng underlay chỉ cần IP giữa các loopback, thường dùng IS-IS. Không cần trunk VLAN xuyên qua.', lesson: LESSON });

  const q = ctl(CP, E1, E1.ip, CP.ip, { type: 'request', eid: HB.ip, mask: 32, itr: E1.ip });
  sim.capture(q, 'Map-Request: Server ở đâu');
  sim.emit({ kind: 'transit', fromDevice: 'e1', toDevice: 'cp', side: 'forward', activeLayer: 4.5,
    titleVi: 'Laptop gọi Server, Edge1 hỏi vị trí', packet: q,
    overlay: { links: { l2: { cls: 'trunk', label: 'Map-Request' } } },
    explanationVi: 'Hai máy cùng subnet 10.10.10.0/24. Edge dùng cùng anycast gateway nên máy di chuyển không phải đổi gateway.', lesson: LESSON });
  const rep = ctl(E1, CP, CP.ip, E1.ip, { type: 'reply', eid: HB.ip, mask: 32, rloc: E2.ip });
  sim.capture(rep, 'Map-Reply: sau Edge2');
  sim.emit({ kind: 'transit', fromDevice: 'cp', toDevice: 'e1', side: 'forward', activeLayer: 4.5,
    titleVi: 'Control plane node trả lời: Server sau 172.16.0.2', packet: rep,
    overlay: { links: { l2: { cls: 'trunk', label: 'Map-Reply' } } },
    explanationVi: 'Đích không có trong fabric sẽ đi tới Border, nút nối ra mạng ngoài.', lesson: LESSON });

  const d1 = vx(CP, E1, 10, HA);
  sim.capture(d1, 'VXLAN-GPO, SGT 10');
  sim.emit({ kind: 'transit', fromDevice: 'e1', toDevice: 'cp', side: 'encap', activeLayer: 4.5,
    titleVi: 'Edge1 đóng gói VXLAN-GPO, ghi SGT 10 vào header', packet: d1,
    overlay: { links: { l2: { cls: 'forwarding', label: 'VXLAN, SGT 10' } } },
    explanationVi: 'Xem trường VXLAN Flags và Group Policy ID. Nhóm đi kèm từng gói, nên thiết bị ở đầu bên kia không cần biết IP của máy gửi thuộc nhóm nào.', lesson: LESSON });
  const d2 = vx(E2, CP, 10, HA);
  sim.emit({ kind: 'process', atDevice: 'e2', side: 'decap', activeLayer: 4.5,
    titleVi: 'Edge2 tra SGACL: SGT 10 tới SGT 20 được phép', packet: d2, tables: sgacl(10),
    overlay: { links: { l3: { cls: 'forwarding', label: 'VXLAN, SGT 10' } } },
    explanationVi: 'Chính sách thi hành ở Edge đích, vì tại đó mới biết nhóm của cả nguồn và đích. Quy tắc viết theo nhóm nên không phải sửa khi đổi IP.', lesson: LESSON });
  const f = sim.frame(inner(HA, HB, 64));
  sim.capture(f, 'Khung gốc tới Server');
  sim.emit({ kind: 'transit', fromDevice: 'e2', toDevice: 'hb', side: 'decap', activeLayer: 3,
    titleVi: '✓ Server nhận gói', packet: f,
    overlay: { links: { l4: { cls: 'forwarding', label: 'cho phép' } } },
    explanationVi: 'Trên đường ngoài fabric, SGT có thể truyền bằng thẻ inline hoặc qua SXP. Đoạn cáp giữa hai switch có thể mã hoá bằng MACsec 802.1AE.', lesson: LESSON });

  const d3 = vx(E2, CP, 30, IOT);
  sim.capture(d3, 'VXLAN-GPO, SGT 30, bị chặn');
  sim.emit({ kind: 'process', atDevice: 'e2', side: 'decap', activeLayer: 4.5,
    titleVi: '✗ Camera IoT cùng subnet nhưng SGT 30 bị chặn', packet: d3, tables: sgacl(30),
    overlay: { links: { l3: { label: 'SGT 30' }, l4: { label: 'deny' } } },
    explanationVi: 'Đây là phân đoạn vi mô: cùng subnet và cùng VN vẫn tách được theo nhóm. Phân đoạn vĩ mô dùng VN, tách hẳn như VRF. Bài tập: thử nghĩ ACL IP thường sẽ cần bao nhiêu dòng cho cùng yêu cầu.', lesson: LESSON });

  return sim.result();
}
