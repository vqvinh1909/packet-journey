// scenarios/s37-sd-wan.js
// Kịch bản 37 (ENCOR 1.2): Cisco SD-WAN.
// vBond xác thực, vSmart phát OMP và TLOC, WAN Edge dựng IPsec trực tiếp, BFD đo chất lượng.

import { Sim } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

const HA = { mac: '00:aa:00:00:37:01', ip: '192.168.1.10' };
const HB = { mac: '00:aa:00:00:37:02', ip: '192.168.2.20' };
const E1 = { mac: '00:1a:2b:00:37:01', ip: '20.0.0.1' };
const E2 = { mac: '00:1a:2b:00:37:02', ip: '30.0.0.2' };
const NET = { mac: '00:1a:2b:00:37:0b' };
const BOND = { mac: '00:1a:2b:00:37:0c', ip: '40.0.0.1' };
const SMART = { mac: '00:1a:2b:00:37:0a', ip: '40.0.0.2' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Định tuyến (SD-WAN: ENCOR 1.2)',
};

export const meta = {
  id: 's37-sd-wan',
  titleVi: 'SD-WAN: vBond, vSmart, OMP, TLOC, IPsec',
  titleEn: 'SD-WAN: vBond, vSmart, OMP, TLOC, IPsec',
  descriptionVi: 'WAN Edge xác thực với vBond, trao đổi route và TLOC qua vSmart bằng OMP, rồi dựng IPsec trực tiếp với nhau. BFD đo độ trễ để chọn đường theo ứng dụng.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1100 300',
    devices: [
      { id: 'ha', type: 'host', name: 'Chi nhánh', x: 90, y: 220, color: '#2c5f8a', lines: ['192.168.1.10'] },
      { id: 'e1', type: 'router', name: 'Edge1', x: 300, y: 220, lines: ['TLOC 20.0.0.1'] },
      { id: 'net', type: 'router', name: 'Internet', x: 550, y: 220, lines: ['transport'] },
      { id: 'e2', type: 'router', name: 'Edge2', x: 800, y: 220, lines: ['TLOC 30.0.0.2'] },
      { id: 'hb', type: 'host', name: 'Trụ sở', x: 1010, y: 220, color: '#2c5f8a', lines: ['192.168.2.20'] },
      { id: 'bond', type: 'host', name: 'vBond', x: 300, y: 60, color: '#6b4fa0', lines: ['điều phối'] },
      { id: 'smart', type: 'host', name: 'vSmart', x: 800, y: 60, color: '#6b4fa0', lines: ['điều khiển'] },
      { id: 'mgr', type: 'host', name: 'vManage', x: 550, y: 60, color: '#6b4fa0', lines: ['quản lý'] },
    ],
    links: [
      { id: 'l1', a: 'ha', b: 'e1' },
      { id: 'l2', a: 'e1', b: 'net' },
      { id: 'l3', a: 'net', b: 'e2' },
      { id: 'l4', a: 'e2', b: 'hb' },
      { id: 'l5', a: 'e1', b: 'bond' },
      { id: 'l6', a: 'e2', b: 'smart' },
      { id: 'l7', a: 'e1', b: 'smart', labelMid: 'DTLS' },
      { id: 'l8', a: 'mgr', b: 'smart' },
    ],
  };
  const sim = new Sim(topology);

  // shortcut: OMP độc quyền, phần thân là byte minh hoạ; muốn thật phải có bản bắt gói từ thiết bị
  const dtls = (to, from, srcIp, dstIp, desc) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: srcIp, dst: dstIp, ttl: 64, id: 0x3700, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 12346, dstPort: 12346 } },
    { proto: 'raw', fields: { data: [0x17, 0xfe, 0xfd, ...new Array(29).fill(0xab)], desc } },
  ]);
  const inner = () => echoFrame({ ethDst: HB.mac, ethSrc: HA.mac, srcIp: HA.ip, dstIp: HB.ip, ttl: 63, ipId: 0x3701, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }).slice(1);
  const ipsec = (to, from, seq, payload, desc) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: E1.ip, dst: E2.ip, ttl: 64, id: 0x3702, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 12346, dstPort: 12346 } },
    { proto: 'esp', fields: { spi: 0x1001, seq } },
    ...(payload || [{ proto: 'raw', fields: { data: new Array(48).fill(0xe5), desc } }]),
  ]);
  const omp = (rows) => ({ list: { title: 'Bảng OMP trên Edge1', cols: ['Prefix', 'TLOC', 'Màu', 'Đóng gói'], rows } });

  const b = dtls(BOND, E1, E1.ip, BOND.ip, 'DTLS tới vBond. Chứng chỉ của router được kiểm tra với danh sách vManage cấp.');
  sim.capture(b, 'DTLS tới vBond');
  sim.emit({ kind: 'transit', fromDevice: 'e1', toDevice: 'bond', side: 'forward', activeLayer: 7,
    titleVi: 'Edge1 tìm vBond để được xác thực', packet: b,
    overlay: { links: { l5: { cls: 'trunk', label: 'DTLS' } } },
    explanationVi: 'Bốn mặt phẳng của SD-WAN: orchestration là vBond, management là vManage, control là vSmart, data là WAN Edge. vBond cũng giúp hai bên đứng sau NAT tìm được nhau, sau đó báo địa chỉ vSmart và vManage cho Edge.', lesson: LESSON });
  const c = dtls(SMART, E2, E2.ip, SMART.ip, 'OMP chạy trong DTLS hoặc TLS. Giao thức độc quyền, phần này là byte minh hoạ.');
  sim.capture(c, 'OMP route từ Edge2 lên vSmart');
  sim.emit({ kind: 'transit', fromDevice: 'e2', toDevice: 'smart', side: 'forward', activeLayer: 7,
    titleVi: 'Edge2 quảng bá OMP lên vSmart', packet: c,
    overlay: { links: { l6: { cls: 'trunk', label: 'OMP' } } },
    explanationVi: 'Edge2 gửi route 192.168.2.0/24 kèm TLOC. TLOC gồm IP hệ thống, màu của đường truyền (biz-internet, mpls) và kiểu đóng gói. Khoá IPsec cũng do vSmart phát đi, nên không cần cấu hình IKE từng cặp.', lesson: LESSON });
  const d = dtls(E1, SMART, SMART.ip, E1.ip, 'vSmart phản xạ route và TLOC, áp chính sách điều khiển.');
  sim.emit({ kind: 'transit', fromDevice: 'smart', toDevice: 'e1', side: 'forward', activeLayer: 7,
    titleVi: 'vSmart phản xạ xuống Edge1', packet: d, tables: omp([['192.168.2.0/24', '30.0.0.2', 'biz-internet', 'IPsec']]),
    overlay: { links: { l7: { cls: 'trunk', label: 'OMP' } } },
    explanationVi: 'vSmart giống route reflector nhưng còn áp chính sách, ví dụ ép chi nhánh đi qua trụ sở để tạo hub-and-spoke. Nó không nằm trên đường dữ liệu: mất vSmart thì dữ liệu vẫn chạy cho tới khi hết graceful restart.', lesson: LESSON });

  const f = ipsec(NET, E1, 1, null, 'BFD chạy trong đường hầm, được mã hoá. Đo mất gói, độ trễ, jitter.');
  sim.capture(f, 'BFD trong IPsec');
  sim.emit({ kind: 'transit', fromDevice: 'e1', toDevice: 'net', side: 'forward', activeLayer: 3.5,
    titleVi: 'Dựng IPsec trực tiếp, BFD đo chất lượng đường', packet: f,
    overlay: { links: { l2: { cls: 'trunk', label: 'IPsec + BFD' } } },
    explanationVi: 'Hai Edge nối thẳng nhau qua Internet, không qua vSmart. ESP bọc trong UDP 12346 để qua được NAT. BFD chạy liên tục để đo chất lượng từng đường.', lesson: LESSON });

  const h = sim.frame(echoFrame({ ethDst: E1.mac, ethSrc: HA.mac, srcIp: HA.ip, dstIp: HB.ip, ttl: 64, ipId: 0x3701, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
  sim.capture(h, 'Gói IP từ chi nhánh');
  sim.emit({ kind: 'transit', fromDevice: 'ha', toDevice: 'e1', side: 'encap', activeLayer: 3,
    titleVi: 'Máy ở chi nhánh gửi gói', packet: h, tables: omp([['192.168.2.0/24', '30.0.0.2', 'biz-internet', 'IPsec'], ['192.168.2.0/24', '30.0.0.2', 'mpls', 'IPsec']]),
    overlay: { links: { l1: { cls: 'forwarding', label: 'IP' } } },
    explanationVi: 'Khi có hai đường, Application-Aware Routing đổi đường nếu độ trễ hoặc mất gói vượt ngưỡng SLA của ứng dụng. Dữ liệu vẫn chạy trên cả hai đường cùng lúc được.', lesson: LESSON });
  const g = ipsec(E2, NET, 2, inner());
  sim.capture(g, 'Dữ liệu trong IPsec');
  sim.emit({ kind: 'transit', fromDevice: 'net', toDevice: 'e2', side: 'forward', activeLayer: 3.5,
    titleVi: 'Dữ liệu đi trong ESP, Internet chỉ thấy hai TLOC', packet: g,
    overlay: { links: { l2: { cls: 'forwarding', label: 'ESP' }, l3: { cls: 'forwarding', label: 'ESP' } } },
    explanationVi: 'Mô phỏng hiện gói bên trong để bạn đọc được. Trên dây thật, phần sau ESP đã mã hoá. Ở vùng dữ liệu, VPN tương ứng VRF để tách khách hàng hoặc phòng ban.', lesson: LESSON });
  const k = sim.frame(echoFrame({ ethDst: HB.mac, ethSrc: E2.mac, srcIp: HA.ip, dstIp: HB.ip, ttl: 62, ipId: 0x3701, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
  sim.capture(k, 'Gói gốc tại trụ sở');
  sim.emit({ kind: 'transit', fromDevice: 'e2', toDevice: 'hb', side: 'decap', activeLayer: 3,
    titleVi: '✓ Edge2 giải mã và giao gói', packet: k,
    overlay: { links: { l4: { cls: 'forwarding', label: 'IP' } } },
    explanationVi: 'So với WAN truyền thống: cấu hình tập trung qua template trên vManage, thêm site không phải sửa các site khác. Đổi lại, cần hạ tầng controller và chứng chỉ.', lesson: LESSON });

  return sim.result();
}
