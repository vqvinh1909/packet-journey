// scenarios/s13-hsrp-failover.js
// Kịch bản 13 (CCNA): HSRP (FHRP) — gateway dự phòng.
// 2 router chia nhau 1 IP ảo làm default gateway. Router ưu tiên cao = Active (nhận
// gói hộ nhóm), còn lại = Standby. Active chết → Standby tiếp quản, host không đổi gì.

import { Sim } from '../engine/simulate.js';

const VIP = '192.168.1.1';
const VMAC = '00:00:0c:07:ac:01'; // MAC ảo nhóm 1
const HMAC = '01:00:5e:00:00:02'; // multicast HSRP 224.0.0.2
const R1 = { mac: '00:00:0c:11:11:01', ip: '192.168.1.252' };
const R2 = { mac: '00:00:0c:22:22:02', ip: '192.168.1.253' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-05_Remote-Access-va-Wireless/Bai-21_FHRP.md',
  label: 'Bài 21 — FHRP (HSRP/VRRP)',
};

export const meta = {
  id: 's13-hsrp-failover',
  titleVi: 'HSRP: Active/Standby & failover',
  titleEn: 'HSRP failover',
  descriptionVi: '2 router dùng chung 1 IP ảo làm gateway. Bầu Active theo priority; Active chết thì Standby tiếp quản trong suốt với host.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'pc', type: 'host', name: 'PC', x: 140, y: 180, lines: ['192.168.1.10', `GW ${VIP}`] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 420, y: 180, lines: ['LAN 192.168.1.0/24'] },
      { id: 'r1', type: 'router', name: 'R1', x: 760, y: 90, lines: ['192.168.1.252', 'priority 110'] },
      { id: 'r2', type: 'router', name: 'R2', x: 760, y: 280, lines: ['192.168.1.253', 'priority 100'] },
    ],
    links: [
      { id: 'lpc', a: 'pc', b: 'sw' },
      { id: 'l1', a: 'sw', b: 'r1' },
      { id: 'l2', a: 'sw', b: 'r2' },
    ],
  };

  const sim = new Sim(topology);
  const hello = (r, state, priority, opcode = 0) => sim.frame([
    { proto: 'ethernet', fields: { dst: HMAC, src: r.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: r.ip, dst: '224.0.0.2', ttl: 1, id: 0, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 1985, dstPort: 1985 } },
    { proto: 'hsrp', fields: { opcode, state, priority, group: 1, virtualIp: VIP } },
  ]);

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 7,
    titleVi: 'Vấn đề: 1 gateway chết là cả LAN mất mạng',
    explanationVi: `Nếu host chỉ trỏ gateway tới IP thật của 1 router, router đó hỏng là mất đường ra. HSRP cho 2 router chung 1 IP ẢO ${VIP} ` +
      `(+ MAC ảo ${VMAC}) làm gateway. Host chỉ biết IP ảo này.`,
    lesson: LESSON });

  const h1 = hello(R1, 16, 110); // Active
  sim.capture(h1, 'HSRP Hello R1 (priority 110)');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: 'R1 gửi HSRP Hello (priority 110)', packet: h1,
    explanationVi: 'Hello đi trong UDP 1985 tới multicast 224.0.0.2. Mang Priority, trạng thái, và Virtual IP của nhóm.', lesson: LESSON });

  const h2 = hello(R2, 8, 100); // Standby
  sim.capture(h2, 'HSRP Hello R2 (priority 100)');
  sim.emit({ kind: 'transit', fromDevice: 'r2', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: 'R2 gửi HSRP Hello (priority 100)', packet: h2,
    explanationVi: 'R2 cũng khai priority. Hai router so với nhau để bầu Active/Standby.' });

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 7,
    titleVi: 'Bầu: priority 110 > 100 → R1 Active, R2 Standby', packet: h1,
    overlay: { links: { l1: { cls: 'root-path', label: 'ACTIVE' }, l2: { cls: '', label: 'standby' } }, badges: { r1: 'ACTIVE', r2: 'STANDBY' } },
    explanationVi: 'Priority CAO hơn thắng (hoà thì IP lớn hơn). R1 = Active: nó nhận mọi gói gửi tới MAC ảo. R2 = Standby: im lặng theo dõi, sẵn sàng thay.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'pc', side: 'inspect', activeLayer: 2,
    titleVi: 'PC ra ngoài: ARP gateway ảo → nhận MAC ảo',
    overlay: { badges: { r1: 'ACTIVE', r2: 'STANDBY' } },
    explanationVi: `PC gửi gói ra Internet → dùng gateway ${VIP}. ARP hỏi ${VIP} → Active (R1) trả về MAC ẢO ${VMAC} (không phải MAC thật của R1). ` +
      'Nhờ vậy khi đổi Active, MAC đích không đổi.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: '💥 R1 (Active) chết',
    overlay: { links: { l1: { cls: 'blocking', label: 'DOWN ✗' }, l2: { cls: '', label: 'standby' } }, badges: { r2: 'STANDBY' } },
    explanationVi: 'R1 hỏng/đứt link → ngừng gửi Hello. R2 chờ hết Holdtime (mặc định 10s) không nghe Hello của Active.',
    lesson: LESSON });

  const h3 = hello(R2, 16, 100, 0); // Hello, state Active (Coup chỉ dùng khi preempt)
  sim.capture(h3, 'HSRP Hello R2 (state Active)');
  sim.emit({ kind: 'transit', fromDevice: 'r2', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: 'R2 chuyển sang Active', packet: h3,
    overlay: { links: { l1: { cls: 'blocking', label: 'DOWN ✗' }, l2: { cls: 'root-path', label: 'ACTIVE' } }, badges: { r2: 'ACTIVE' } },
    explanationVi: 'R2 lên Active và gửi Hello với State = Active (Op Code vẫn là Hello; Coup chỉ dùng khi một router priority cao hơn giành quyền bằng preempt). ' +
      'Nó TIẾP QUẢN đúng IP ảo 192.168.1.1 và MAC ảo 00:00:0c:07:ac:01, đồng thời gửi gratuitous ARP để switch cập nhật bảng MAC sang cổng của R2.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'pc', side: 'inspect', activeLayer: 2,
    titleVi: 'Host không hề hay biết — failover trong suốt',
    overlay: { links: { l2: { cls: 'root-path', label: 'ACTIVE' } }, badges: { r2: 'ACTIVE' } },
    explanationVi: 'PC vẫn dùng đúng gateway 192.168.1.1 và MAC ảo cũ trong ARP cache → gói giờ tới R2. Không phải sửa gì trên host. ' +
      '(Đơn giản hóa: bỏ qua timer Hello/Hold thực tế và cơ chế preempt/tracking.)',
    lesson: LESSON });

  return sim.result();
}
