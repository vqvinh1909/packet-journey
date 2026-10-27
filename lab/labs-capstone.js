// lab/labs-capstone.js — 5 lab tổng hợp doanh nghiệp CCNA + CCNP (X01–X05), mỗi lab có
// "🧭 Cách giải chi tiết" (guide: từng bước { dev, title, why, cmds, raw? }) — guide đồng thời là
// lời giải chạy được (labs.js → solutionOf/applySolution), nên test tự động chấm luôn cả guide.
// Topology, địa chỉ, tình huống và lỗi cài sẵn đều tự thiết kế theo kiến thức CCNA/CCNP chuẩn.

import * as N from './net.js';
import { cfg, fa, same, allowedOk, aclOn, quiz, hostIn, ml3 } from './kit.js';
import * as V6 from './net6.js';
import * as A6 from './ip6.js';

const { pc, server, sw, router, makeNet } = N;

const isp = (extra = []) => ['isp', cfg('hostname ISP', 'interface g0/0', 'ip address 203.0.113.1 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown', ...extra)];
/** Tất cả cổng của thiết bị tắt → mô phỏng thiết bị hỏng hẳn (dùng trong whatIf). */
const kill = (n, id) => { const d = n.devices[id]; for (const p of Object.values(d.ports || d.ifaces)) p.shutdown = true; };
/** PC đã nhận IP DHCP hợp lệ (≥ .11) trong subnet /24 với gateway đúng. */
const leased = (a, id, nw, gw) => { const d = a.d(id); return hostIn(d.ip, nw, 24) && +d.ip.split('.')[3] >= 11 && d.gateway === gw; };
const full = (a, rid, peer) => a.nbrs(rid).some((x) => x.dev === peer && x.full);
const accessIn = (d, p, v) => d.ports[p].modeSet && d.ports[p].mode === 'access' && d.ports[p].vlan === v;
const renew = (...ids) => ids.map((id) => ({ dev: id, raw: true, title: '', why: '', cmds: ['ipconfig /renew'] }));

export const CAP_LABS = [
  // =====================================================================
  // X01 — Campus 3 lớp ra Internet
  // =====================================================================
  {
    id: 'X01', group: 'cap', lesson: 'Capstone 1 — Campus 3 lớp', level: 3, kind: 'project',
    title: 'Campus 3 lớp: Access – Core L3 (HSRP) – Edge NAT ra Internet',
    story: 'Công ty Sao Việt chuyển trụ sở. Thiết kế 3 lớp: ACCESS (ACC1, ACC2 – 2960) cho VLAN 10 STAFF (192.168.10.0/24) và VLAN 20 GUEST (192.168.20.0/24); CORE (CORE1, CORE2 – 3560) làm gateway dự phòng bằng HSRP trên SVI (.2/.3, VIP .1 — CORE1 Active VLAN 10, CORE2 Active VLAN 20), CORE1 cấp DHCP; EDGE (R-EDGE) chạy OSPF với 2 core (VLAN 101: 10.0.1.0/30, VLAN 102: 10.0.2.0/30), NAT PAT ra ISP và quảng bá default route vào OSPF. ACC1 nối CORE1 bằng EtherChannel LACP 2 sợi. Bảo mật: port-security trên cổng người dùng, khách KHÔNG vào được VLAN STAFF, quản trị CORE1 chỉ bằng SSH. ISP không biết gì về địa chỉ private của bạn. R-EDGE đã đặt IP sẵn.',
    build: () => makeNet([
      server('inet', 'INTERNET 8.8.8.8', 940, 60, { ip: '8.8.8.8', gw: '8.8.8.1' }),
      router('isp', 'ISP', 760, 60, ['g0/0', 'g0/1']),
      router('edge', 'R-EDGE', 500, 60, ['g0/0', 'g0/1', 'g0/2']),
      ml3('core1', 'CORE1', 300, 190, ['g0/1', 'g0/2', 'g0/3', 'g0/4']),
      ml3('core2', 'CORE2', 700, 190, ['g0/1', 'g0/3', 'g0/4']),
      sw('acc1', 'ACC1', 300, 330, ['fa0/1', 'fa0/2', 'fa0/24', 'g0/1', 'g0/2']),
      sw('acc2', 'ACC2', 700, 330, ['fa0/1', 'fa0/2', 'g0/1', 'g0/2']),
      pc('s1', 'STAFF1', 170, 450, { dhcp: true }), pc('g1', 'GUEST1', 380, 460, { dhcp: true }),
      pc('s2', 'STAFF2', 620, 460, { dhcp: true }), pc('g2', 'GUEST2', 830, 450, { dhcp: true }),
    ], [
      ['isp', 'g0/1', 'inet', 'fa0'], ['edge', 'g0/0', 'isp', 'g0/0'], ['edge', 'g0/1', 'core1', 'g0/4'], ['edge', 'g0/2', 'core2', 'g0/4'],
      ['acc1', 'g0/1', 'core1', 'g0/1'], ['acc1', 'g0/2', 'core1', 'g0/2'], ['acc1', 'fa0/24', 'core2', 'g0/3'],
      ['acc2', 'g0/1', 'core2', 'g0/1'], ['acc2', 'g0/2', 'core1', 'g0/3'],
      ['s1', 'fa0', 'acc1', 'fa0/1'], ['g1', 'fa0', 'acc1', 'fa0/2'], ['s2', 'fa0', 'acc2', 'fa0/1'], ['g2', 'fa0', 'acc2', 'fa0/2'],
    ]),
    init: [
      isp(),
      ['edge', cfg('hostname R-EDGE', 'interface g0/0', 'ip address 203.0.113.2 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 10.0.1.2 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 10.0.2.2 255.255.255.252', 'no shutdown')],
    ],
    guide: [
      ...['acc1', 'acc2'].map((s, i) => ({ dev: s, title: `${i + 1}. ${s.toUpperCase()}: VLAN, cổng người dùng + port-security`, why: i ? 'Giống hệt ACC1 — chuẩn hoá cấu hình access giúp vận hành dễ.' : 'Lớp Access: mỗi cổng người dùng là access 1 VLAN. Port-security (max 2, sticky, restrict) chống cắm switch/laptop lạ mà không làm máy hợp lệ mất mạng.', cmds: ['vlan 10', 'name STAFF', 'vlan 20', 'name GUEST', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'interface fa0/2', 'switchport mode access', 'switchport access vlan 20', 'interface range fa0/1 - 2', 'switchport port-security', 'switchport port-security maximum 2', 'switchport port-security mac-address sticky', 'switchport port-security violation restrict'] })),
      { dev: 'acc1', title: '3. ACC1: EtherChannel LACP lên CORE1 + trunk dự phòng lên CORE2', why: 'Gộp 2 sợi Gi0/1–2 thành Port-channel 1 (LACP "active") → gấp đôi băng thông, đứt 1 sợi không sao. Trunk chỉ cho phép VLAN cần thiết (10,20) — nguyên tắc tối thiểu.', cmds: ['interface range g0/1 - 2', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20', 'channel-group 1 mode active', 'interface fa0/24', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20'] },
      { dev: 'acc2', title: '4. ACC2: 2 trunk lên 2 core', why: 'Mỗi switch access nối lên CẢ 2 core → mất 1 core vẫn còn đường.', cmds: ['interface range g0/1 - 2', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20'] },
      { dev: 'core1', title: '5. CORE1: VLAN, EtherChannel, trunk, cổng lên EDGE', why: 'Core cũng phải có VLAN thì mới chuyển frame VLAN đó. Đầu kia của Po1 dùng LACP active (active–active hay active–passive đều lên). Gi0/4 là access VLAN 101 — đoạn /30 tới R-EDGE.', cmds: ['vlan 10', 'name STAFF', 'vlan 20', 'name GUEST', 'vlan 101', 'exit', 'interface range g0/1 - 2', 'switchport trunk encapsulation dot1q', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20', 'channel-group 1 mode active', 'interface g0/3', 'switchport trunk encapsulation dot1q', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20', 'interface g0/4', 'switchport mode access', 'switchport access vlan 101'] },
      { dev: 'core1', title: '6. CORE1: ip routing + SVI + HSRP (Active VLAN 10)', why: 'SVI .2 là IP thật của CORE1; VIP .1 là gateway PC dùng. Priority 110 + preempt → CORE1 luôn giành lại vai trò Active VLAN 10 khi sống lại. VLAN 20 để priority mặc định 100 → CORE2 (110) làm Active — chia tải 2 VLAN cho 2 core.', cmds: ['ip routing', 'interface vlan 10', 'ip address 192.168.10.2 255.255.255.0', 'standby 10 ip 192.168.10.1', 'standby 10 priority 110', 'standby 10 preempt', 'no shutdown', 'interface vlan 20', 'ip address 192.168.20.2 255.255.255.0', 'standby 20 ip 192.168.20.1', 'standby 20 preempt', 'no shutdown', 'interface vlan 101', 'ip address 10.0.1.1 255.255.255.252', 'no shutdown'] },
      { dev: 'core1', title: '7. CORE1: DHCP cho 2 VLAN', why: 'default-router phải là VIP (.1) chứ không phải .2 — nếu không, CORE1 chết là PC mất gateway dù HSRP vẫn chạy. Chừa .1–.10 cho thiết bị mạng.', cmds: ['ip dhcp excluded-address 192.168.10.1 192.168.10.10', 'ip dhcp excluded-address 192.168.20.1 192.168.20.10', 'ip dhcp pool STAFF', 'network 192.168.10.0 255.255.255.0', 'default-router 192.168.10.1', 'dns-server 8.8.8.8', 'ip dhcp pool GUEST', 'network 192.168.20.0 255.255.255.0', 'default-router 192.168.20.1', 'dns-server 8.8.8.8'] },
      { dev: 'core1', title: '8. CORE1: OSPF tới EDGE + ACL khách + SSH', why: 'Quảng bá 2 mạng người dùng vào OSPF nhưng passive trên SVI (không có router nào cần làm hàng xóm ở đó). GUEST_IN đặt chiều IN trên SVI VLAN 20 — gần nguồn nhất: chặn khách → STAFF, còn lại cho phép (ra Internet). SSH: cần hostname, domain, RSA ≥ 768 bit, user local, VTY chỉ SSH.', cmds: ['router ospf 1', 'router-id 1.1.1.1', 'network 192.168.10.0 0.0.0.255 area 0', 'network 192.168.20.0 0.0.0.255 area 0', 'network 10.0.1.0 0.0.0.3 area 0', 'passive-interface vlan 10', 'passive-interface vlan 20', 'exit', 'ip access-list extended GUEST_IN', 'deny ip 192.168.20.0 0.0.0.255 192.168.10.0 0.0.0.255', 'permit ip any any', 'exit', 'interface vlan 20', 'ip access-group GUEST_IN in', 'exit', 'hostname CORE1', 'ip domain-name saoviet.local', 'crypto key generate rsa modulus 1024', 'ip ssh version 2', 'username admin privilege 15 secret Adm1n@SV', 'line vty 0 4', 'login local', 'transport input ssh'] },
      { dev: 'core2', title: '9. CORE2: đối xứng với CORE1 (Active VLAN 20)', why: 'Cùng VLAN/trunk, SVI .3. VLAN 20 priority 110 + preempt; VLAN 10 bật preempt để sẵn sàng tiếp quản. KHÔNG cấu hình DHCP thứ 2 (2 server cùng cấp 1 dải dễ trùng IP). ACL khách cũng phải có ở đây vì khi CORE2 làm gateway VLAN 20, gói khách đi qua CORE2.', cmds: ['vlan 10', 'name STAFF', 'vlan 20', 'name GUEST', 'vlan 102', 'exit', 'interface range g0/1 , g0/3', 'switchport trunk encapsulation dot1q', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20', 'interface g0/4', 'switchport mode access', 'switchport access vlan 102', 'exit', 'ip routing', 'interface vlan 10', 'ip address 192.168.10.3 255.255.255.0', 'standby 10 ip 192.168.10.1', 'standby 10 preempt', 'no shutdown', 'interface vlan 20', 'ip address 192.168.20.3 255.255.255.0', 'standby 20 ip 192.168.20.1', 'standby 20 priority 110', 'standby 20 preempt', 'no shutdown', 'interface vlan 102', 'ip address 10.0.2.1 255.255.255.252', 'no shutdown', 'exit', 'router ospf 1', 'router-id 2.2.2.2', 'network 192.168.10.0 0.0.0.255 area 0', 'network 192.168.20.0 0.0.0.255 area 0', 'network 10.0.2.0 0.0.0.3 area 0', 'passive-interface vlan 10', 'passive-interface vlan 20', 'exit', 'ip access-list extended GUEST_IN', 'deny ip 192.168.20.0 0.0.0.255 192.168.10.0 0.0.0.255', 'permit ip any any', 'exit', 'interface vlan 20', 'ip access-group GUEST_IN in'] },
      { dev: 'edge', title: '10. R-EDGE: OSPF + default route + default-information originate', why: 'Default static trỏ ra ISP; "default-information originate" biến R-EDGE thành ASBR quảng bá O*E2 0.0.0.0/0 cho 2 core — không phải gõ default route tay trên từng core.', cmds: ['router ospf 1', 'router-id 3.3.3.3', 'network 10.0.1.0 0.0.0.3 area 0', 'network 10.0.2.0 0.0.0.3 area 0', 'default-information originate', 'exit', 'ip route 0.0.0.0 0.0.0.0 203.0.113.1'] },
      { dev: 'edge', title: '11. R-EDGE: NAT PAT', why: 'ISP không có route về 192.168.x.x → phải đổi nguồn sang IP public của Gi0/0 (overload = nhiều máy dùng chung 1 IP, phân biệt bằng port). Cả 2 cổng hướng vào core đều là inside.', cmds: ['access-list 1 permit 192.168.0.0 0.0.255.255', 'ip nat inside source list 1 interface g0/0 overload', 'interface g0/0', 'ip nat outside', 'interface range g0/1 - 2', 'ip nat inside'] },
      { ...renew('s1')[0], title: '12. Các PC xin IP (DHCP)', why: 'DORA đi qua access → trunk → SVI của CORE1 (có pool). Bấm "▶ Xem gói tin" để xem.' }, ...renew('g1', 's2', 'g2'),
    ],
    tasks: [
      { text: 'ACC1/ACC2: VLAN 10 STAFF, 20 GUEST; Fa0/1 access VLAN 10, Fa0/2 access VLAN 20', verify: 'show vlan brief', check: (a) => ['acc1', 'acc2'].every((s) => { const d = a.d(s); return same(d.vlans[10], 'STAFF') && same(d.vlans[20], 'GUEST') && accessIn(d, 'fa0/1', 10) && accessIn(d, 'fa0/2', 20); }) },
      { text: 'Port-security trên 4 cổng người dùng: maximum 2, sticky, violation restrict', verify: 'show port-security', check: (a) => ['acc1', 'acc2'].every((s) => ['fa0/1', 'fa0/2'].every((p) => { const ps = a.d(s).ports[p].ps; return ps?.enabled && ps.max === 2 && ps.sticky && ps.violation === 'restrict'; })) },
      { text: 'EtherChannel LACP Po1 ACC1 ↔ CORE1 đã lên (cả 2 sợi) và là trunk', verify: 'show etherchannel summary', check: (a) => ['acc1', 'core1'].every((s) => ['g0/1', 'g0/2'].every((p) => { const b = a.bundle(s, p); return b?.formed && b.proto === 'LACP'; }) && a.oper(s, 'g0/1') === 'trunk') },
      { text: 'Mọi trunk giữa access và core chỉ cho phép VLAN 10,20', verify: 'show interfaces trunk', check: (a) => [['acc1', 'po1'], ['acc1', 'fa0/24'], ['acc2', 'g0/1'], ['acc2', 'g0/2'], ['core1', 'po1'], ['core1', 'g0/3'], ['core2', 'g0/1'], ['core2', 'g0/3']].every(([s, p]) => { const x = a.d(s).ports[p]; return x && x.mode === 'trunk' && allowedOk(x, [10, 20], []); }) && a.oper('acc2', 'g0/2') === 'trunk' && a.oper('core2', 'g0/3') === 'trunk' },
      { text: 'HSRP: VIP .1 cho cả 2 VLAN — CORE1 Active VLAN 10, CORE2 Active VLAN 20, cả 2 bật preempt', verify: 'show standby brief', check: (a) => a.d('core1').ipRouting && a.d('core2').ipRouting && a.hsrpActive('core1', 'vlan10', '10') === 'core1' && a.hsrpActive('core2', 'vlan20', '20') === 'core2' && ['core1', 'core2'].every((c) => [10, 20].every((v) => a.d(c).svis['vlan' + v]?.standby[v]?.preempt && a.d(c).svis['vlan' + v].standby[v].ip === `192.168.${v}.1`)) },
      { text: 'DHCP trên CORE1: 4 PC nhận IP ≥ .11 đúng VLAN, gateway = VIP', verify: 'ipconfig /renew ; show ip dhcp binding', check: (a) => leased(a, 's1', '192.168.10.0', '192.168.10.1') && leased(a, 's2', '192.168.10.0', '192.168.10.1') && leased(a, 'g1', '192.168.20.0', '192.168.20.1') && leased(a, 'g2', '192.168.20.0', '192.168.20.1') },
      { text: 'OSPF: R-EDGE FULL với CORE1 và CORE2; 2 core học O*E2 0.0.0.0/0 từ R-EDGE (không static trên core)', verify: 'show ip ospf neighbor ; show ip route', check: (a) => full(a, 'edge', 'core1') && full(a, 'edge', 'core2') && ['core1', 'core2'].every((c) => a.route(c, '0.0.0.0/0')?.code === 'O*E2' && a.d(c).routes.length === 0) },
      { text: 'NAT PAT: STAFF1, STAFF2 ping được 8.8.8.8 (ISP không có route nào về mạng private)', verify: 'ping 8.8.8.8 ; show ip nat translations', check: (a) => a.d('isp').routes.length === 0 && a.ping('s1', '8.8.8.8') && a.ping('s2', '8.8.8.8') },
      { text: 'Khách ra Internet được nhưng KHÔNG tới được VLAN STAFF (ACL GUEST_IN trên SVI VLAN 20 của cả 2 core)', verify: 'GUEST1: ping 8.8.8.8 ; ping <IP STAFF1>', check: (a) => !!aclOn(a.d('core1'), 'vlan20', 'in', 'extended') && !!aclOn(a.d('core2'), 'vlan20', 'in', 'extended') && a.ping('g1', '8.8.8.8') && a.ping('g2', '8.8.8.8') && !!a.d('s1').ip && !a.ping('g1', a.d('s1').ip) && !a.ping('g2', a.d('s2').ip) && a.ping('s1', a.d('s2').ip) },
      { text: 'Quản trị CORE1 bằng SSH từ STAFF1 (ssh -l admin 192.168.10.2); Telnet bị từ chối', verify: 'ssh -l admin 192.168.10.2', check: (a) => a.tcp('s1', '192.168.10.2', 22).ok && a.tcp('s1', '192.168.10.2', 23).kind === 'refused' },
      { text: 'Dự phòng: CORE1 hỏng hẳn → STAFF1 (qua Fa0/24) và STAFF2 vẫn ra 8.8.8.8 qua CORE2', verify: 'CORE1: shutdown mọi cổng → ping 8.8.8.8', check: (a) => a.whatIf((n) => kill(n, 'core1'), (b) => b.hsrpActive('core2', 'vlan10', '10') === 'core2' && b.ping('s1', '8.8.8.8') && b.ping('s2', '8.8.8.8')) },
      quiz('Vì sao "default-router" trong pool DHCP là 192.168.10.1 chứ không phải 192.168.10.2 (IP của CORE1)?', ['.1 là VIP HSRP — router nào đang Active cũng trả lời, PC không phải đổi gateway khi failover', 'Vì .2 nằm trong dải excluded', 'Vì DHCP chỉ cấp được địa chỉ .1', 'Không có khác biệt'], 0, 'PC chỉ biết 1 gateway. Trỏ vào VIP thì HSRP lo phần chuyển đổi Active/Standby.'),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết" — làm theo thứ tự Access → Core → Edge → PC.', 'Switch 3560: trước "switchport mode trunk" nên gõ "switchport trunk encapsulation dot1q".', 'Kiểm tra từng lớp: show etherchannel summary → show interfaces trunk → show standby brief → show ip ospf neighbor → show ip nat translations.'],
  },

  // =====================================================================
  // X02 — HQ + 2 chi nhánh: PPP CHAP, GRE, OSPF multi-area, DHCP relay, NAT
  // =====================================================================
  {
    id: 'X02', group: 'cap', lesson: 'Capstone 2 — WAN HQ & chi nhánh', level: 3, kind: 'project',
    title: 'HQ + 2 chi nhánh: Serial PPP CHAP, GRE qua Internet, OSPF đa vùng, DHCP relay, NAT',
    story: 'Chuỗi nhà thuốc An Khang có trụ sở (HQ, LAN 192.168.1.0/24) và 2 chi nhánh. Chi nhánh 1 (LAN 192.168.2.0/24) nối HQ bằng leased-line Serial (10.1.12.0/30) — nhà mạng yêu cầu PPP có xác thực CHAP (mật khẩu chung "AnKh@ng"). Chi nhánh 2 (LAN 192.168.3.0/24) chỉ có Internet (198.51.100.2/30, ISP .1) → dựng GRE Tunnel0 (172.16.0.0/30) tới IP public của HQ 203.0.113.2. Routing: OSPF đa vùng — area 0 = LAN HQ + Serial + Tunnel, area 1 = LAN CN1, area 2 = LAN CN2 (R-CN1/R-CN2 là ABR). R-HQ là DHCP server cho cả 3 LAN (chi nhánh dùng DHCP relay) và là cửa ra Internet duy nhất (NAT PAT) — kể cả CN2 đi Internet cũng vòng qua tunnel về HQ (kiểm soát tập trung). Các cổng đã đặt IP sẵn.',
    build: () => makeNet([
      server('inet', 'INTERNET 8.8.8.8', 520, 50, { ip: '8.8.8.8', gw: '8.8.8.1' }),
      router('isp', 'ISP', 520, 170, ['g0/0', 'g0/1', 'g0/2']),
      router('hq', 'R-HQ', 260, 230, ['g0/0', 'g0/1', 's0/0/0']),
      router('cn1', 'R-CN1', 260, 400, ['g0/0', 's0/0/0']),
      router('cn2', 'R-CN2', 780, 270, ['g0/0', 'g0/1']),
      sw('swhq', 'SW-HQ', 90, 200, ['fa0/1', 'fa0/2', 'g0/1']),
      server('srv', 'SRV-HQ', 70, 60, { ip: '192.168.1.10', gw: '192.168.1.1', services: [80, 443, 445] }),
      pc('phq', 'PC-HQ', 80, 360, { dhcp: true }),
      pc('p1', 'PC-CN1', 480, 470, { dhcp: true }),
      pc('p2', 'PC-CN2', 900, 420, { dhcp: true }),
    ], [
      ['isp', 'g0/2', 'inet', 'fa0'], ['hq', 'g0/1', 'isp', 'g0/0'], ['cn2', 'g0/1', 'isp', 'g0/1'],
      ['hq', 'g0/0', 'swhq', 'g0/1'], ['swhq', 'fa0/1', 'srv', 'fa0'], ['swhq', 'fa0/2', 'phq', 'fa0'],
      ['hq', 's0/0/0', 'cn1', 's0/0/0'], ['cn1', 'g0/0', 'p1', 'fa0'], ['cn2', 'g0/0', 'p2', 'fa0'],
    ]),
    init: [
      ['isp', cfg('hostname ISP', 'interface g0/0', 'ip address 203.0.113.1 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 198.51.100.1 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown')],
      ['hq', cfg('hostname R-HQ', 'interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.2 255.255.255.252', 'no shutdown', 'interface s0/0/0', 'ip address 10.1.12.1 255.255.255.252', 'clock rate 64000', 'no shutdown')],
      ['cn1', cfg('hostname R-CN1', 'interface g0/0', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.1.12.2 255.255.255.252', 'no shutdown')],
      ['cn2', cfg('hostname R-CN2', 'interface g0/0', 'ip address 192.168.3.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 198.51.100.2 255.255.255.252', 'no shutdown')],
    ],
    guide: [
      { dev: 'hq', title: '1. Serial HQ ↔ CN1: PPP + CHAP (phía HQ)', why: 'CHAP: mỗi router khai "username <TÊN-HOST-BÊN-KIA> password <mật khẩu chung>". Hai bên phải cùng encapsulation (lệch HDLC/PPP → line protocol down).', cmds: ['username R-CN1 password AnKh@ng', 'interface s0/0/0', 'encapsulation ppp', 'ppp authentication chap'] },
      { dev: 'cn1', title: '2. Serial phía CN1', why: 'Đối xứng: username là hostname của HQ ("R-HQ"), cùng mật khẩu. Gõ xong thấy %LINEPROTO … changed state to up.', cmds: ['username R-HQ password AnKh@ng', 'interface s0/0/0', 'encapsulation ppp', 'ppp authentication chap'] },
      { dev: 'hq', title: '3. GRE Tunnel0 phía HQ + default route ra ISP', why: 'Tunnel source = cổng public, destination = IP public của CN2. Tunnel chỉ là "dây ảo": cần underlay (default route ra ISP) để gói GRE đi được.', cmds: ['ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'interface tunnel 0', 'ip address 172.16.0.1 255.255.255.252', 'tunnel source g0/1', 'tunnel destination 198.51.100.2', 'no shutdown'] },
      { dev: 'cn2', title: '4. GRE Tunnel0 phía CN2 + route underlay /32', why: 'CN2 CHỈ cần route /32 tới IP public HQ qua ISP (underlay). Mọi thứ khác (kể cả Internet) học qua OSPF trong tunnel → đi về HQ. Không dùng default static ở đây, nếu không default OSPF từ HQ sẽ thua (AD 1 < 110).', cmds: ['ip route 203.0.113.2 255.255.255.255 198.51.100.1', 'interface tunnel 0', 'ip address 172.16.0.2 255.255.255.252', 'tunnel source g0/1', 'tunnel destination 203.0.113.2', 'no shutdown'] },
      { dev: 'hq', title: '5. OSPF area 0 trên HQ + quảng bá default', why: 'HQ là backbone: LAN HQ, Serial, Tunnel đều area 0. "default-information originate" đẩy default (từ static ra ISP) cho 2 chi nhánh. Không cho OSPF chạy trên cổng ra ISP.', cmds: ['router ospf 1', 'router-id 1.1.1.1', 'network 192.168.1.0 0.0.0.255 area 0', 'network 10.1.12.0 0.0.0.3 area 0', 'network 172.16.0.0 0.0.0.3 area 0', 'passive-interface g0/0', 'default-information originate'] },
      { dev: 'cn1', title: '6. OSPF CN1: ABR area 0 / area 1', why: 'Serial thuộc area 0, LAN thuộc area 1 → CN1 là ABR, HQ thấy LAN CN1 dạng "O IA" (inter-area).', cmds: ['router ospf 1', 'router-id 2.2.2.2', 'network 10.1.12.0 0.0.0.3 area 0', 'network 192.168.2.0 0.0.0.255 area 1', 'passive-interface g0/0'] },
      { dev: 'cn2', title: '7. OSPF CN2: ABR area 0 (qua tunnel) / area 2', why: 'Chỉ đưa Tunnel0 (area 0) và LAN (area 2) vào OSPF — TUYỆT ĐỐI không đưa cổng Internet vào (tránh học route tunnel destination qua chính tunnel → recursive routing, tunnel flap).', cmds: ['router ospf 1', 'router-id 3.3.3.3', 'network 172.16.0.0 0.0.0.3 area 0', 'network 192.168.3.0 0.0.0.255 area 2', 'passive-interface g0/0'] },
      { dev: 'hq', title: '8. DHCP tập trung trên R-HQ', why: 'Một pool cho mỗi LAN. Gói relay từ chi nhánh mang giaddr = IP cổng LAN chi nhánh → R-HQ chọn đúng pool theo giaddr.', cmds: ['ip dhcp excluded-address 192.168.1.1 192.168.1.10', 'ip dhcp excluded-address 192.168.2.1 192.168.2.10', 'ip dhcp excluded-address 192.168.3.1 192.168.3.10', 'ip dhcp pool LAN-HQ', 'network 192.168.1.0 255.255.255.0', 'default-router 192.168.1.1', 'dns-server 8.8.8.8', 'ip dhcp pool LAN-CN1', 'network 192.168.2.0 255.255.255.0', 'default-router 192.168.2.1', 'dns-server 8.8.8.8', 'ip dhcp pool LAN-CN2', 'network 192.168.3.0 255.255.255.0', 'default-router 192.168.3.1', 'dns-server 8.8.8.8'] },
      { dev: 'cn1', title: '9. DHCP relay ở 2 chi nhánh', why: 'Router chặn broadcast → DHCP Discover không tự tới HQ. "ip helper-address 192.168.1.1" trên cổng LAN đổi broadcast thành unicast gửi về server.', cmds: ['interface g0/0', 'ip helper-address 192.168.1.1'] },
      { dev: 'cn2', title: '', why: '', cmds: ['interface g0/0', 'ip helper-address 192.168.1.1'] },
      { dev: 'hq', title: '10. NAT PAT tập trung tại HQ', why: 'ACL gom cả 3 LAN. Lưu ý: gói của CN2 đi vào HQ qua Tunnel0 → Tunnel0 cũng phải là "ip nat inside", không thì gói ra Internet với IP private và bị ISP vứt.', cmds: ['access-list 1 permit 192.168.0.0 0.0.3.255', 'ip nat inside source list 1 interface g0/1 overload', 'interface g0/1', 'ip nat outside', 'interface g0/0', 'ip nat inside', 'interface s0/0/0', 'ip nat inside', 'interface tunnel 0', 'ip nat inside'] },
      { ...renew('phq')[0], title: '11. PC 3 site xin IP', why: 'PC-CN1/PC-CN2 nhận IP qua relay — xem "▶ Xem gói tin" để thấy Discover unicast về R-HQ.' }, ...renew('p1', 'p2'),
    ],
    tasks: [
      { text: 'Serial HQ ↔ CN1: PPP + CHAP cả 2 đầu, line protocol up', verify: 'show interfaces s0/0/0', check: (a) => ['hq', 'cn1'].every((r) => a.d(r).ifaces['s0/0/0'].l2enc === 'ppp' && a.d(r).ifaces['s0/0/0'].pppAuth === 'chap') && a.up('hq', 's0/0/0') && a.up('cn1', 's0/0/0') },
      { text: 'GRE Tunnel0 HQ ↔ CN2 up/up (172.16.0.1 ↔ 172.16.0.2 ping được)', verify: 'show ip interface brief ; ping 172.16.0.2', check: (a) => a.up('hq', 'tu0') && a.up('cn2', 'tu0') && a.ping('hq', '172.16.0.2') },
      { text: 'OSPF: HQ FULL với CN1 (Serial) và CN2 (Tunnel), tất cả area 0', verify: 'show ip ospf neighbor', check: (a) => full(a, 'hq', 'cn1') && full(a, 'hq', 'cn2') && a.ospfIf('hq', 'tu0')?.area === '0' && a.ospfIf('cn1', 's0/0/0')?.area === '0' },
      { text: 'Đa vùng: LAN CN1 ở area 1, LAN CN2 ở area 2 → HQ thấy cả 2 là "O IA"', verify: 'show ip route ospf', check: (a) => a.ospfIf('cn1', 'g0/0')?.area === '1' && a.ospfIf('cn2', 'g0/0')?.area === '2' && a.route('hq', '192.168.2.0/24')?.code === 'O IA' && a.route('hq', '192.168.3.0/24')?.code === 'O IA' },
      { text: 'Default route: CN1 và CN2 học O*E2 0.0.0.0/0 từ HQ (CN2 qua Tunnel0); chi nhánh không có default static', verify: 'show ip route', check: (a) => ['cn1', 'cn2'].every((r) => a.route(r, '0.0.0.0/0')?.code === 'O*E2' && !a.d(r).routes.some((x) => x.prefix === 0)) && a.route('cn2', '0.0.0.0/0').iface === 'tu0' },
      { text: 'DHCP: PC-HQ nhận IP từ R-HQ; PC-CN1, PC-CN2 nhận IP qua DHCP relay (≥ .11, gateway đúng)', verify: 'ipconfig /renew ; R-HQ: show ip dhcp binding', check: (a) => leased(a, 'phq', '192.168.1.0', '192.168.1.1') && leased(a, 'p1', '192.168.2.0', '192.168.2.1') && leased(a, 'p2', '192.168.3.0', '192.168.3.1') && !!a.dhcp('p2').ok && a.d('cn2').dhcp && Object.keys(a.d('cn2').dhcp.pools).length === 0 },
      { text: 'Cả 3 site ping được SRV-HQ 192.168.1.10; PC-CN2 → SRV-HQ đi trong GRE', verify: 'ping 192.168.1.10', check: (a) => ['phq', 'p1', 'p2'].every((p) => a.ping(p, '192.168.1.10')) && a.greUsed('p2', '192.168.1.10') },
      { text: 'NAT PAT tại HQ: cả 3 site ping được 8.8.8.8 (ISP không có route private; CN2 không tự NAT)', verify: 'ping 8.8.8.8 ; R-HQ: show ip nat translations', check: (a) => a.d('isp').routes.length === 0 && a.d('cn2').nat.dyn.length === 0 && ['phq', 'p1', 'p2'].every((p) => a.ping(p, '8.8.8.8')) },
      quiz('Vì sao chạy OSPF qua GRE tunnel chứ không chạy thẳng trên cổng Internet của CN2?', ['ISP không chuyển multicast OSPF/không định tuyến địa chỉ private; GRE tạo "dây ảo" điểm-điểm để OSPF làm hàng xóm và chở gói private', 'Vì OSPF không chạy được trên cổng Gigabit', 'Vì GRE mã hoá dữ liệu', 'Vì GRE nhanh hơn Serial'], 0, 'GRE không mã hoá (muốn bảo mật phải thêm IPsec), nhưng chở được multicast/IGP và gói private qua Internet.'),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'CHAP: username = hostname router BÊN KIA, mật khẩu 2 bên giống nhau.', 'GRE: tunnel source/destination 2 đầu phải đối xứng; đừng quảng bá cổng Internet vào OSPF.', 'Kiểm tra: show ip ospf neighbor ; show ip route ; show ip nat translations ; show ip dhcp binding.'],
  },

  // =====================================================================
  // X03 — Sáp nhập: redistribution OSPF↔EIGRP, dual-ISP eBGP, HSRP tracking, NAT
  // =====================================================================
  {
    id: 'X03', group: 'cap', lesson: 'Capstone 3 — Sáp nhập & dual-ISP', level: 3, kind: 'project',
    title: 'Sáp nhập công ty: redistribution OSPF↔EIGRP + dual-ISP eBGP + HSRP tracking + NAT',
    story: 'Công ty A (OSPF area 0, LAN 10.1.10.0/24, AS 65000) vừa mua lại công ty B (EIGRP AS 100, LAN 172.20.10.0/24 sau R-B). R-BD (router biên sáp nhập) đã cắm vào LAN A (10.1.10.4) và nối R-B (10.99.0.0/30). A có 2 đường Internet: R-E1 ↔ ISP1 (AS 64501, 203.0.113.0/30) và R-E2 ↔ ISP2 (AS 64502, 198.51.100.0/30); 2 ISP đã cấu hình sẵn eBGP phía họ và gửi default-originate. Yêu cầu: (1) chạy eBGP tới 2 ISP, nhận default rồi đưa vào OSPF; (2) R-BD redistribute 2 chiều OSPF↔EIGRP để A và B thấy nhau và B ra được Internet; (3) gateway LAN A là VIP HSRP 10.1.10.1 — R-E1 Active, theo dõi (track) cổng ISP1 để tự nhường cho R-E2; (4) NAT PAT trên cả 2 router biên cho cả dải A và B.',
    build: () => makeNet([
      server('inet', 'INTERNET 8.8.8.8', 500, 40, { ip: '8.8.8.8', gw: '8.8.8.1' }),
      router('isp1', 'ISP1 (AS64501)', 300, 90, ['g0/0', 'g0/1', 'g0/2']),
      router('isp2', 'ISP2 (AS64502)', 700, 90, ['g0/0', 'g0/2']),
      router('e1', 'R-E1', 300, 220, ['g0/0', 'g0/1']),
      router('e2', 'R-E2', 700, 220, ['g0/0', 'g0/1']),
      sw('swa', 'SW-A', 500, 310, ['fa0/1', 'fa0/2', 'g0/1', 'g0/2', 'g0/3']),
      router('bd', 'R-BD', 720, 400, ['g0/0', 'g0/1']),
      router('rb', 'R-B', 900, 420, ['g0/0', 'g0/1']),
      pc('pa', 'PC-A', 330, 440, { ip: '10.1.10.50', gw: '10.1.10.1' }),
      pc('pa2', 'PC-A2', 520, 460, { ip: '10.1.10.51', gw: '10.1.10.1' }),
      pc('pb', 'PC-B', 960, 280, { ip: '172.20.10.50', gw: '172.20.10.1' }),
    ], [
      ['isp1', 'g0/1', 'inet', 'fa0'], ['isp1', 'g0/2', 'isp2', 'g0/2'], ['e1', 'g0/1', 'isp1', 'g0/0'], ['e2', 'g0/1', 'isp2', 'g0/0'],
      ['e1', 'g0/0', 'swa', 'g0/1'], ['e2', 'g0/0', 'swa', 'g0/2'], ['bd', 'g0/0', 'swa', 'g0/3'], ['pa', 'fa0', 'swa', 'fa0/1'], ['pa2', 'fa0', 'swa', 'fa0/2'],
      ['bd', 'g0/1', 'rb', 'g0/0'], ['rb', 'g0/1', 'pb', 'fa0'],
    ]),
    init: [
      ['isp1', cfg('hostname ISP1', 'interface g0/0', 'ip address 203.0.113.1 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown', 'interface g0/2', 'ip address 100.64.0.1 255.255.255.252', 'no shutdown', 'exit', 'ip route 198.51.100.0 255.255.255.252 100.64.0.2', 'router bgp 64501', 'neighbor 203.0.113.2 remote-as 65000', 'neighbor 203.0.113.2 default-originate')],
      ['isp2', cfg('hostname ISP2', 'interface g0/0', 'ip address 198.51.100.1 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 100.64.0.2 255.255.255.252', 'no shutdown', 'exit', 'ip route 8.8.8.0 255.255.255.0 100.64.0.1', 'ip route 203.0.113.0 255.255.255.252 100.64.0.1', 'router bgp 64502', 'neighbor 198.51.100.2 remote-as 65000', 'neighbor 198.51.100.2 default-originate')],
      ['e1', cfg('hostname R-E1', 'interface g0/0', 'ip address 10.1.10.2 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.2 255.255.255.252', 'no shutdown', 'exit', 'router ospf 1', 'router-id 1.1.1.1', 'network 10.1.10.0 0.0.0.255 area 0')],
      ['e2', cfg('hostname R-E2', 'interface g0/0', 'ip address 10.1.10.3 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 198.51.100.2 255.255.255.252', 'no shutdown', 'exit', 'router ospf 1', 'router-id 2.2.2.2', 'network 10.1.10.0 0.0.0.255 area 0')],
      ['bd', cfg('hostname R-BD', 'interface g0/0', 'ip address 10.1.10.4 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.99.0.1 255.255.255.252', 'no shutdown')],
      ['rb', cfg('hostname R-B', 'interface g0/0', 'ip address 10.99.0.2 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 172.20.10.1 255.255.255.0', 'no shutdown', 'exit', 'router eigrp 100', 'network 10.99.0.0 0.0.0.3', 'network 172.20.10.0 0.0.0.255', 'passive-interface g0/1', 'no auto-summary')],
    ],
    guide: [
      { dev: 'e1', title: '1. R-E1: eBGP tới ISP1 + đưa default vào OSPF', why: 'eBGP cần neighbor nối trực tiếp + đúng remote-as. ISP1 gửi default-originate → R-E1 có "B* 0.0.0.0/0". "default-information originate" (KHÔNG có always) chỉ quảng bá default khi R-E1 thực sự có default — đứt ISP1 là tự rút, rất hợp cho dual-ISP.', cmds: ['router bgp 65000', 'bgp router-id 1.1.1.1', 'neighbor 203.0.113.1 remote-as 64501', 'exit', 'router ospf 1', 'default-information originate'] },
      { dev: 'e2', title: '2. R-E2: eBGP tới ISP2 + default vào OSPF', why: 'Tương tự R-E1. Cả 2 cùng quảng bá O*E2 → R-BD có 2 lối ra, chọn cái nào sống.', cmds: ['router bgp 65000', 'bgp router-id 2.2.2.2', 'neighbor 198.51.100.1 remote-as 64502', 'exit', 'router ospf 1', 'default-information originate'] },
      { dev: 'bd', title: '3. R-BD: chạy OSPF phía A, EIGRP phía B', why: 'Router biên tham gia CẢ 2 miền định tuyến: g0/0 trong OSPF area 0 (LAN A), g0/1 trong EIGRP 100 (về R-B).', cmds: ['router ospf 1', 'router-id 4.4.4.4', 'network 10.1.10.0 0.0.0.255 area 0', 'exit', 'router eigrp 100', 'network 10.99.0.0 0.0.0.3', 'no auto-summary'] },
      { dev: 'bd', title: '4. R-BD: redistribution 2 chiều', why: 'EIGRP → OSPF: thêm "subnets" để mang cả mạng con (/24 của B). OSPF → EIGRP: BẮT BUỘC có seed metric (bandwidth delay reliability load MTU) — thiếu metric thì EIGRP coi là vô hạn, không quảng bá gì. Default O*E2 cũng được đưa sang → B ra được Internet.', cmds: ['router ospf 1', 'redistribute eigrp 100 subnets', 'exit', 'router eigrp 100', 'redistribute ospf 1 metric 100000 100 255 1 1500'] },
      { dev: 'e1', title: '5. R-E1: HSRP Active + tracking cổng ISP1', why: 'Priority 110, preempt; track g0/1 giảm 20 → khi đứt ISP1 priority còn 90 < 100 của R-E2 → R-E2 (có preempt) giành Active. Không track thì PC vẫn gửi về R-E1 — router đã mất Internet (lỗ đen).', cmds: ['interface g0/0', 'standby 1 ip 10.1.10.1', 'standby 1 priority 110', 'standby 1 preempt', 'standby 1 track g0/1 20'] },
      { dev: 'e2', title: '6. R-E2: HSRP Standby + preempt', why: 'Preempt ở R-E2 là điều kiện để tracking của R-E1 có tác dụng.', cmds: ['interface g0/0', 'standby 1 ip 10.1.10.1', 'standby 1 preempt'] },
      ...[['e1', '7. NAT PAT trên R-E1', 'ACL gom cả dải A (10.0.0.0/8) và B (172.20.0.0/16). Mỗi router NAT ra IP public của chính ISP mình — gói về luôn đúng đường.'], ['e2', '8. NAT PAT trên R-E2', 'Giống R-E1, đổi sang IP của ISP2.']].map(([dev, title, why]) => ({ dev, title, why, cmds: ['access-list 1 permit 10.0.0.0 0.255.255.255', 'access-list 1 permit 172.20.0.0 0.0.255.255', 'ip nat inside source list 1 interface g0/1 overload', 'interface g0/0', 'ip nat inside', 'interface g0/1', 'ip nat outside'] })),
    ],
    tasks: [
      { text: 'eBGP Established: R-E1 ↔ ISP1 và R-E2 ↔ ISP2; mỗi router nhận B 0.0.0.0/0', verify: 'show ip bgp summary ; show ip route', check: (a) => a.bgpUp('e1', '203.0.113.1') && a.bgpUp('e2', '198.51.100.1') && a.route('e1', '0.0.0.0/0')?.code === 'B' && a.route('e2', '0.0.0.0/0')?.code === 'B' },
      { text: 'R-BD học default O*E2 qua OSPF (R-E1/R-E2 dùng default-information originate, không "always")', verify: 'R-BD: show ip route', check: (a) => a.route('bd', '0.0.0.0/0')?.code === 'O*E2' && ['e1', 'e2'].every((r) => a.d(r).ospf.defaultOriginate && !a.d(r).ospf.defaultAlways) },
      { text: 'EIGRP 100: R-BD ↔ R-B thành láng giềng', verify: 'show ip eigrp neighbors', check: (a) => a.eigrpNbrs('bd').some((x) => x.to === 'rb') },
      { text: 'EIGRP → OSPF: R-E1 thấy 172.20.10.0/24 dạng O E2', verify: 'R-E1: show ip route', check: (a) => a.route('e1', '172.20.10.0/24')?.code === 'O E2' && a.route('e2', '172.20.10.0/24')?.code === 'O E2' },
      { text: 'OSPF → EIGRP: R-B thấy 10.1.10.0/24 và default 0.0.0.0/0 dạng D EX', verify: 'R-B: show ip route', check: (a) => a.route('rb', '10.1.10.0/24')?.code === 'D EX' && a.route('rb', '0.0.0.0/0')?.code === 'D EX' },
      { text: 'Hai công ty thông nhau: PC-A ↔ PC-B ping được', verify: 'PC-A: ping 172.20.10.50', check: (a) => a.ping('pa', '172.20.10.50') && a.ping('pb', '10.1.10.51') },
      { text: 'HSRP VIP 10.1.10.1: R-E1 Active (track g0/1, giảm ≥ 11), R-E2 bật preempt', verify: 'show standby brief', check: (a) => a.hsrpActive('e1', 'g0/0', '1') === 'e1' && (a.d('e1').ifaces['g0/0'].standby['1']?.track || []).some((t) => t.ifn === 'g0/1' && t.dec > 10) && !!a.d('e2').ifaces['g0/0'].standby['1']?.preempt && a.d('e2').ifaces['g0/0'].standby['1'].ip === '10.1.10.1' },
      { text: 'NAT PAT trên cả 2 router biên: PC-A và PC-B ping được 8.8.8.8', verify: 'ping 8.8.8.8 ; show ip nat translations', check: (a) => ['isp1', 'isp2'].every((r) => !a.d(r).routes.some((x) => x.net.startsWith('10.') || x.net.startsWith('172.'))) && a.ping('pa', '8.8.8.8') && a.ping('pb', '8.8.8.8') },
      { text: 'Đứt ISP1 (R-E1 g0/1 down) → R-E2 lên Active, PC-A và PC-B vẫn ra 8.8.8.8 qua ISP2', verify: 'R-E1: interface g0/1 → shutdown → show standby brief', check: (a) => a.whatIf((n) => { n.devices.e1.ifaces['g0/1'].shutdown = true; }, (b) => b.hsrpActive('e2', 'g0/0', '1') === 'e2' && b.ping('pa', '8.8.8.8') && b.ping('pb', '8.8.8.8') && b.route('bd', '0.0.0.0/0')?.nextHop === '10.1.10.3') },
      quiz('"redistribute ospf 1" vào EIGRP mà KHÔNG có metric thì sao?', ['Route vào EIGRP với seed metric vô hạn → không được quảng bá, R-B không thấy mạng của A', 'EIGRP tự lấy metric OSPF', 'Router báo lỗi cú pháp', 'Route được quảng bá với metric 0'], 0, 'EIGRP (và RIP) cần seed metric khi redistribute từ giao thức khác: "metric ..." hoặc "default-metric ...". OSPF thì mặc định metric 20 nhưng cần "subnets" cho mạng con.'),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'show ip bgp summary → State/PfxRcd; show ip route | include 0.0.0.0', 'Redistribute vào EIGRP phải có metric; vào OSPF nên có "subnets".', 'HSRP tracking chỉ có tác dụng khi router kia bật preempt.'],
  },

  // =====================================================================
  // X04 — Troubleshooting marathon (9 lỗi cài sẵn)
  // =====================================================================
  {
    id: 'X04', group: 'cap', lesson: 'Capstone 4 — Troubleshooting marathon', level: 3, kind: 'ticket',
    title: 'Troubleshooting marathon: 9 lỗi ẩn trong mạng campus',
    story: '🎫 Sáng thứ Hai, kỹ sư cũ nghỉ việc để lại mạng "chạy được một nửa". Thiết kế chuẩn (đúng): ACC1 trunk lên DS1 (Gi0/1) và DS2 (Gi0/2), native VLAN 99 trên MỌI trunk, cho phép VLAN 10,20,30,99. VLAN 10 SALES / 20 HR / 30 IT = 192.168.V.0/24 — DS1 .2, DS2 .3, VIP HSRP .1 (DS1 Active). DS1/DS2 chạy OSPF area 0 với R-EDGE (VLAN 100: 10.0.1.0/30, VLAN 200: 10.0.2.0/30); R-EDGE có default ra ISP và phải quảng bá default vào OSPF, NAT PAT cho cả 3 VLAN. Chính sách: HR KHÔNG được truy cập VLAN IT (ACL HR_IN trên SVI VLAN 20 của 2 DS), còn lại tự do. Người dùng phàn nàn: IT mất mạng, HR không ra được gateway, không ai vào Internet… Hãy tìm và sửa từng lỗi bằng lệnh show — KHÔNG đổi IP của PC, KHÔNG thêm static route trên DS.',
    build: () => makeNet([
      server('inet', 'INTERNET 8.8.8.8', 940, 60, { ip: '8.8.8.8', gw: '8.8.8.1' }),
      router('isp', 'ISP', 760, 60, ['g0/0', 'g0/1']),
      router('edge', 'R-EDGE', 500, 60, ['g0/0', 'g0/1', 'g0/2']),
      ml3('ds1', 'DS1', 300, 200, ['g0/1', 'g0/2']),
      ml3('ds2', 'DS2', 700, 200, ['g0/1', 'g0/2']),
      sw('acc1', 'ACC1', 500, 320, fa(3, ['g0/1', 'g0/2'])),
      pc('sales', 'PC-SALES', 300, 450, { ip: '192.168.10.10', gw: '192.168.10.1' }),
      pc('hr', 'PC-HR', 500, 460, { ip: '192.168.20.10', gw: '192.168.20.1' }),
      pc('it', 'PC-IT', 700, 450, { ip: '192.168.30.10', gw: '192.168.30.1' }),
    ], [
      ['isp', 'g0/1', 'inet', 'fa0'], ['edge', 'g0/2', 'isp', 'g0/0'], ['edge', 'g0/0', 'ds1', 'g0/2'], ['edge', 'g0/1', 'ds2', 'g0/2'],
      ['acc1', 'g0/1', 'ds1', 'g0/1'], ['acc1', 'g0/2', 'ds2', 'g0/1'],
      ['sales', 'fa0', 'acc1', 'fa0/1'], ['hr', 'fa0', 'acc1', 'fa0/2'], ['it', 'fa0', 'acc1', 'fa0/3'],
    ]),
    init: (() => {
      const ds = (n, up, upNet, me, extra) => [n, cfg(
        'vlan 10', 'name SALES', 'vlan 20', 'name HR', 'vlan 30', 'name IT', 'vlan 99', 'name NATIVE', `vlan ${up}`, 'exit',
        'interface g0/1', 'switchport trunk encapsulation dot1q', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20,30,99', ...(n === 'ds1' ? ['switchport trunk native vlan 99'] : []),
        'interface g0/2', 'switchport mode access', `switchport access vlan ${up}`, 'exit', 'ip routing',
        ...[10, 20, 30].flatMap((v) => [`interface vlan ${v}`, `ip address 192.168.${v}.${me} 255.255.255.0`, `standby ${v} ip 192.168.${v}.${n === 'ds2' && v === 10 ? 254 : 1}`, ...(n === 'ds1' ? [`standby ${v} priority 110`] : []), `standby ${v} preempt`, n === 'ds2' && v === 20 ? 'shutdown' : 'no shutdown']),
        `interface vlan ${up}`, `ip address ${upNet}.1 255.255.255.252`, 'no shutdown', 'exit',
        'ip access-list extended HR_IN', 'permit ip any any', 'deny ip 192.168.20.0 0.0.0.255 192.168.30.0 0.0.0.255', 'exit', 'interface vlan 20', 'ip access-group HR_IN in', 'exit',
        'router ospf 1', `router-id ${me - 1}.${me - 1}.${me - 1}.${me - 1}`, ...[10, 20, 30].map((v) => `network 192.168.${v}.0 0.0.0.255 area 0`), `network ${upNet}.0 0.0.0.3 area ${extra}`, ...[10, 20, 30].map((v) => `passive-interface vlan ${v}`))];
      return [
        isp(),
        ['acc1', cfg('vlan 10', 'name SALES', 'vlan 20', 'name HR', 'vlan 30', 'name IT', 'vlan 99', 'name NATIVE', 'exit',
          'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'interface fa0/2', 'switchport mode access', 'switchport access vlan 20', 'interface fa0/3', 'switchport mode access', 'switchport access vlan 30',
          'interface g0/1', 'switchport mode trunk', 'switchport trunk native vlan 99', 'switchport trunk allowed vlan 10,30,99',
          'interface g0/2', 'switchport mode trunk', 'switchport trunk native vlan 99', 'switchport trunk allowed vlan 10,20,30,99', 'exit', 'no vlan 30')],
        ds('ds1', 100, '10.0.1', 2, 0),
        ds('ds2', 200, '10.0.2', 3, 1),
        ['edge', cfg('hostname R-EDGE', 'interface g0/0', 'ip address 10.0.1.2 255.255.255.252', 'ip nat inside', 'no shutdown', 'interface g0/1', 'ip address 10.0.2.2 255.255.255.252', 'ip nat inside', 'no shutdown', 'interface g0/2', 'ip address 203.0.113.2 255.255.255.252', 'ip nat outside', 'no shutdown', 'exit',
          'ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'access-list 1 permit 192.168.0.0 0.0.0.255', 'ip nat inside source list 1 interface g0/2 overload',
          'router ospf 1', 'router-id 9.9.9.9', 'network 10.0.1.0 0.0.0.3 area 0', 'network 10.0.2.0 0.0.0.3 area 0')],
      ];
    })(),
    guide: [
      { dev: 'acc1', title: '1. Lỗi VLAN: VLAN 30 không tồn tại trên ACC1', why: '"show vlan brief" không có VLAN 30 → cổng Fa0/3 (đã gán VLAN 30) "inactive", PC-IT bị cô lập hoàn toàn. Tạo lại VLAN là cổng hoạt động ngay.', cmds: ['vlan 30', 'name IT'] },
      { dev: 'acc1', title: '2. Lỗi allowed list: trunk Gi0/1 lên DS1 thiếu VLAN 20', why: '"show interfaces trunk" → Gi0/1 chỉ allowed 10,30,99. Frame VLAN 20 không tới được DS1 (gateway Active). Đặt lại đủ danh sách chuẩn (hoặc dùng "allowed vlan add 20" trên IOS thật để không lỡ tay xoá VLAN khác).', cmds: ['interface g0/1', 'switchport trunk allowed vlan 10,20,30,99'] },
      { dev: 'ds2', title: '3. Lỗi native VLAN: DS2 Gi0/1 còn native 1', why: 'ACC1 Gi0/2 native 99 nhưng DS2 Gi0/1 native 1 → log %CDP-4-NATIVE_VLAN_MISMATCH, frame untagged rơi nhầm VLAN. Chuẩn: native 99 cả 2 đầu.', cmds: ['interface g0/1', 'switchport trunk native vlan 99'] },
      { dev: 'ds2', title: '4. Lỗi gateway SVI: DS2 interface Vlan20 đang shutdown', why: '"show ip interface brief" → Vlan20 administratively down → DS2 không thể làm gateway dự phòng cho HR.', cmds: ['interface vlan 20', 'no shutdown'] },
      { dev: 'ds2', title: '5. Lỗi VIP HSRP: DS2 nhóm 10 dùng VIP 192.168.10.254', why: '"show standby brief" → 2 router khác VIP. Khi DS1 chết, DS2 chỉ trả lời .254 — PC vẫn trỏ .1 → mất gateway. VIP phải giống nhau.', cmds: ['interface vlan 10', 'standby 10 ip 192.168.10.1'] },
      { dev: 'ds2', title: '6. Lỗi OSPF area: DS2 khai 10.0.2.0/30 vào area 1', why: '"show ip ospf neighbor" trên R-EDGE không thấy DS2; "debug/log" báo mismatch area. Đoạn nối phải cùng area 0 với R-EDGE.', cmds: ['router ospf 1', 'no network 10.0.2.0 0.0.0.3 area 1', 'network 10.0.2.0 0.0.0.3 area 0'] },
      { dev: 'edge', title: '7. Lỗi default route: R-EDGE quên default-information originate', why: 'R-EDGE có static default nhưng không quảng bá → DS1/DS2 không có O*E2 0.0.0.0/0, mọi gói ra Internet bị DS hủy.', cmds: ['router ospf 1', 'default-information originate'] },
      { dev: 'edge', title: '8. Lỗi ACL của NAT: wildcard sai', why: '"access-list 1 permit 192.168.0.0 0.0.0.255" chỉ khớp 192.168.0.x — không VLAN nào được NAT. Cần 192.168.0.0 0.0.255.255 (hoặc liệt kê 3 dải).', cmds: ['no access-list 1', 'access-list 1 permit 192.168.0.0 0.0.255.255'] },
      ...['ds1', 'ds2'].map((d, i) => ({ dev: d, title: i ? '' : '9. Lỗi thứ tự ACL: HR_IN có "permit any" đứng TRƯỚC "deny"', why: i ? '' : 'ACL xét từ trên xuống, khớp là dừng → dòng deny ở seq 20 không bao giờ được dùng. Xoá dòng 10 rồi thêm lại permit ở cuối (seq 30). Sửa trên cả 2 DS.', cmds: ['ip access-list extended HR_IN', 'no 10', '30 permit ip any any'] })),
    ],
    tasks: [
      { text: 'PC-IT ping được gateway 192.168.30.1', verify: 'ACC1: show vlan brief', check: (a) => !!a.d('acc1').vlans[30] && a.ping('it', '192.168.30.1') },
      { text: 'PC-HR ping được gateway 192.168.20.1 qua DS1; trunk ACC1 Gi0/1 mang đủ VLAN 10,20,30', verify: 'ACC1: show interfaces trunk', check: (a) => [10, 20, 30].every((v) => N.portCarries(a.net, a.d('acc1'), 'g0/1', v)) && a.ping('hr', '192.168.20.1') },
      { text: 'Native VLAN 99 thống nhất ở cả 2 đầu mọi trunk', verify: 'show interfaces trunk ; log %CDP-4-NATIVE_VLAN_MISMATCH', check: (a) => [['acc1', 'g0/1'], ['acc1', 'g0/2'], ['ds1', 'g0/1'], ['ds2', 'g0/1']].every(([s, p]) => a.d(s).ports[p].native === 99) },
      { text: 'DS2 sẵn sàng làm gateway dự phòng: SVI Vlan10/20/30 up, cùng VIP HSRP .1 với DS1', verify: 'DS2: show ip interface brief ; show standby brief', check: (a) => [10, 20, 30].every((v) => a.up('ds2', 'vlan' + v) && a.d('ds2').svis['vlan' + v].standby[v]?.ip === `192.168.${v}.1`) },
      { text: 'OSPF: R-EDGE FULL với DS1 và DS2 (area 0)', verify: 'R-EDGE: show ip ospf neighbor', check: (a) => full(a, 'edge', 'ds1') && full(a, 'edge', 'ds2') },
      { text: 'DS1 và DS2 có default O*E2 0.0.0.0/0 (không dùng static)', verify: 'DS1: show ip route', check: (a) => ['ds1', 'ds2'].every((d) => a.route(d, '0.0.0.0/0')?.code === 'O*E2' && a.d(d).routes.length === 0) },
      { text: 'NAT: PC-SALES, PC-HR, PC-IT đều ping được 8.8.8.8', verify: 'ping 8.8.8.8 ; R-EDGE: show ip nat translations', check: (a) => a.d('isp').routes.length === 0 && ['sales', 'hr', 'it'].every((p) => a.ping(p, '8.8.8.8')) },
      { text: 'Chính sách: HR KHÔNG ping được PC-IT nhưng SALES thì được; ACL HR_IN trên cả 2 DS chặn HR→IT', verify: 'PC-HR: ping 192.168.30.10', check: (a) => !a.ping('hr', '192.168.30.10') && a.ping('sales', '192.168.30.10') && ['ds1', 'ds2'].every((d) => aclOn(a.d(d), 'vlan20', 'in', 'extended') && N.aclEval(a.d(d), 'HR_IN', { src: '192.168.20.10', dst: '192.168.30.10', proto: 'icmp' }).action === 'deny' && N.aclEval(a.d(d), 'HR_IN', { src: '192.168.20.10', dst: '8.8.8.8', proto: 'icmp' }).action === 'permit') },
      { text: 'Diễn tập: DS1 hỏng hẳn → cả 3 PC vẫn ra 8.8.8.8 qua DS2', verify: 'DS1: shutdown mọi cổng → ping 8.8.8.8', check: (a) => a.whatIf((n) => kill(n, 'ds1'), (b) => ['sales', 'hr', 'it'].every((p) => b.ping(p, '8.8.8.8'))) },
      { text: 'Ràng buộc: IP của PC không đổi', verify: 'ipconfig', check: (a) => a.d('sales').ip === '192.168.10.10' && a.d('hr').ip === '192.168.20.10' && a.d('it').ip === '192.168.30.10' },
    ],
    hints: ['Làm từ dưới lên theo mô hình OSI: VLAN → trunk (allowed/native) → SVI/HSRP → OSPF → default route → NAT → ACL.', 'Lệnh "thám tử": show vlan brief · show interfaces trunk · show ip interface brief · show standby brief · show ip ospf neighbor · show ip route · show access-lists · show ip nat translations.', 'Có tất cả 9 lỗi. Mở "🧭 Cách giải chi tiết" nếu bí.'],
  },
  // =====================================================================
  // X05 — Dual-stack IPv4/IPv6: OSPFv3 đa vùng, SLAAC, default IPv6 ra ISP
  // =====================================================================
  {
    id: 'X05', group: 'cap', lesson: 'Capstone 5 — Dual-stack IPv6', level: 3, kind: 'project',
    title: 'Triển khai IPv6 song song IPv4 (dual-stack): OSPFv3 đa vùng, SLAAC, default ra ISP',
    story: 'Công ty Lam Sơn chạy IPv4 ổn định (OSPFv2 giữa R-HQ và R-BR). ISP vừa cấp khối 2001:DB8::/32 và đã có route về R-HQ. Kế hoạch địa chỉ: LAN HQ 2001:DB8:10::/64 (R-HQ ::1, PC-HQ ::10 đặt tĩnh), LAN chi nhánh 2001:DB8:20::/64 (R-BR ::1, PC-BR tự cấu hình bằng SLAAC), link R-HQ–R-BR 2001:DB8:FF::/64 (::1/::2), link R-HQ–ISP 2001:DB8:F0::/64 (ISP ::1, R-HQ ::2). Routing: OSPFv3 process 1 (router-id 1.1.1.1 / 2.2.2.2), area 0 = link + LAN HQ, area 1 = LAN chi nhánh; R-HQ default IPv6 ra ISP, R-BR default IPv6 về R-HQ. Mục tiêu: 2 site nói chuyện bằng IPv6, ra được máy chủ IPv6 2001:4860:4860::8888 — và IPv4 KHÔNG được hỏng.',
    build: () => makeNet([
      server('inet6', 'INTERNET IPv6', 900, 70, { ip6: '2001:4860:4860::8888', gw6: '2001:4860:4860::1' }),
      router('isp', 'ISP', 700, 70, ['g0/0', 'g0/1']),
      router('hq', 'R-HQ', 420, 140, ['g0/0', 'g0/1', 'g0/2']),
      router('br', 'R-BR', 420, 320, ['g0/0', 'g0/1']),
      pc('phq', 'PC-HQ', 160, 140, { ip: '192.168.10.10', gw: '192.168.10.1' }),
      pc('pbr', 'PC-BR', 160, 380, { ip: '192.168.20.10', gw: '192.168.20.1' }),
    ], [['isp', 'g0/1', 'inet6', 'fa0'], ['hq', 'g0/2', 'isp', 'g0/0'], ['hq', 'g0/1', 'br', 'g0/1'], ['hq', 'g0/0', 'phq', 'fa0'], ['br', 'g0/0', 'pbr', 'fa0']]),
    init: [
      ['isp', cfg('hostname ISP', 'ipv6 unicast-routing', 'interface g0/0', 'ipv6 address 2001:db8:f0::1/64', 'no shutdown', 'interface g0/1', 'ipv6 address 2001:4860:4860::1/64', 'no shutdown', 'exit', 'ipv6 route 2001:db8::/32 2001:db8:f0::2')],
      ['hq', cfg('hostname R-HQ', 'interface g0/0', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.1 255.255.255.252', 'no shutdown', 'interface g0/2', 'no shutdown', 'exit', 'router ospf 1', 'network 192.168.10.0 0.0.0.255 area 0', 'network 10.0.12.0 0.0.0.3 area 0')],
      ['br', cfg('hostname R-BR', 'interface g0/0', 'ip address 192.168.20.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.2 255.255.255.252', 'no shutdown', 'exit', 'router ospf 1', 'network 192.168.20.0 0.0.0.255 area 0', 'network 10.0.12.0 0.0.0.3 area 0')],
    ],
    guide: [
      { dev: 'hq', title: '1. R-HQ: bật định tuyến IPv6 + đặt địa chỉ 3 cổng', why: 'Mặc định router Cisco KHÔNG chuyển tiếp IPv6 và không gửi Router Advertisement — phải "ipv6 unicast-routing". Mỗi cổng có địa chỉ global mới thì tự sinh thêm link-local FE80::/64 (EUI-64 từ MAC). IPv4 trên cổng vẫn giữ nguyên → dual-stack.', cmds: ['ipv6 unicast-routing', 'interface g0/0', 'ipv6 address 2001:db8:10::1/64', 'interface g0/1', 'ipv6 address 2001:db8:ff::1/64', 'interface g0/2', 'ipv6 address 2001:db8:f0::2/64'] },
      { dev: 'hq', title: '2. R-HQ: OSPFv3 area 0 + default route IPv6 ra ISP', why: 'OSPFv3 bật THEO CỔNG ("ipv6 ospf 1 area 0"), không dùng lệnh network như OSPFv2. Router-id vẫn là số 32-bit dạng IPv4. Không đưa link ISP vào OSPFv3; dùng ::/0 trỏ về ISP.', cmds: ['ipv6 router ospf 1', 'router-id 1.1.1.1', 'exit', 'interface g0/0', 'ipv6 ospf 1 area 0', 'interface g0/1', 'ipv6 ospf 1 area 0', 'exit', 'ipv6 route ::/0 2001:db8:f0::1'] },
      { dev: 'br', title: '3. R-BR: IPv6 + OSPFv3 (LAN ở area 1) + default về HQ', why: 'LAN chi nhánh ở area 1 → R-BR là ABR, R-HQ thấy prefix 2001:DB8:20::/64 dạng "OI". R-BR cần default ::/0 về R-HQ để ra Internet IPv6. Cổng LAN có prefix /64 + unicast-routing → router gửi RA cho SLAAC.', cmds: ['ipv6 unicast-routing', 'ipv6 router ospf 1', 'router-id 2.2.2.2', 'exit', 'interface g0/0', 'ipv6 address 2001:db8:20::1/64', 'ipv6 ospf 1 area 1', 'interface g0/1', 'ipv6 address 2001:db8:ff::2/64', 'ipv6 ospf 1 area 0', 'exit', 'ipv6 route ::/0 2001:db8:ff::1'] },
      { dev: 'phq', raw: true, title: '4. PC: IPv6 tĩnh ở HQ, SLAAC ở chi nhánh', why: 'PC-HQ đặt tay theo kế hoạch. PC-BR tự lấy prefix từ RA + ghép EUI-64 từ MAC; gateway là link-local của R-BR.', cmds: ['ipv6config 2001:db8:10::10/64 2001:db8:10::1'] },
      { dev: 'pbr', raw: true, title: '', why: '', cmds: ['ipv6config autoconfig', 'ping 2001:db8:10::10', 'ping 2001:4860:4860::8888'] },
    ],
    tasks: [
      { text: 'R-HQ và R-BR đã "ipv6 unicast-routing"; các cổng có đúng địa chỉ IPv6 theo kế hoạch', verify: 'show ipv6 interface brief', check: (a) => { const has = (r, n, ip) => (a.d(r).ifaces[n].ipv6 || []).some((x) => x.ip === ip && x.prefix === 64); return a.d('hq').ipv6Routing && a.d('br').ipv6Routing && has('hq', 'g0/0', '2001:DB8:10::1') && has('hq', 'g0/1', '2001:DB8:FF::1') && has('hq', 'g0/2', '2001:DB8:F0::2') && has('br', 'g0/0', '2001:DB8:20::1') && has('br', 'g0/1', '2001:DB8:FF::2'); } },
      { text: 'OSPFv3: R-HQ ↔ R-BR là láng giềng (router-id 1.1.1.1 / 2.2.2.2); R-HQ thấy 2001:DB8:20::/64 dạng OI', verify: 'show ipv6 ospf neighbor ; show ipv6 route ospf', check: (a) => { const o = V6.ospf6All(a.net); return o.rid.hq === '1.1.1.1' && o.rid.br === '2.2.2.2' && (o.adj.hq || []).some((x) => x.to === 'br') && V6.routeTable6(a.net, 'hq').some((r) => r.net === '2001:DB8:20::' && r.code === 'OI'); } },
      { text: 'Default IPv6: R-HQ ::/0 → ISP, R-BR ::/0 → R-HQ (không đưa link ISP vào OSPFv3)', verify: 'show ipv6 route static', check: (a) => { const d0 = (r) => V6.routeTable6(a.net, r).find((x) => x.prefix === 0); return d0('hq')?.nextHop === '2001:DB8:F0::1' && d0('br')?.nextHop === '2001:DB8:FF::1' && !a.d('hq').ifaces['g0/2'].ospf6; } },
      { text: 'PC-HQ: 2001:DB8:10::10/64 tĩnh; PC-BR nhận địa chỉ SLAAC trong 2001:DB8:20::/64 (gateway link-local)', verify: 'ipconfig', check: (a) => { const h = a.d('phq'), b = a.d('pbr'); return h.ip6 === '2001:DB8:10::10' && b.slaac && !!b.ip6 && A6.in6(b.ip6, '2001:DB8:20::', 64) && A6.isLinkLocal(b.gw6); } },
      { text: 'PC-HQ ↔ PC-BR ping được bằng IPv6', verify: 'ping <IPv6>', check: (a) => !!a.d('pbr').ip6 && V6.ping6(a.net, 'phq', a.d('pbr').ip6).ok && V6.ping6(a.net, 'pbr', '2001:DB8:10::10').ok },
      { text: 'Cả 2 PC ping được máy chủ IPv6 2001:4860:4860::8888', verify: 'ping 2001:4860:4860::8888', check: (a) => ['phq', 'pbr'].every((p) => V6.ping6(a.net, p, '2001:4860:4860::8888').ok) },
      { text: 'Dual-stack: IPv4 vẫn chạy (PC-HQ ping 192.168.20.10)', verify: 'ping 192.168.20.10', check: (a) => a.ping('phq', '192.168.20.10') },
      quiz('Địa chỉ SLAAC của PC-BR được ghép từ đâu?', ['64 bit prefix trong Router Advertisement + 64 bit interface ID sinh từ MAC (EUI-64)', 'Do DHCPv6 server cấp', 'Ngẫu nhiên hoàn toàn', 'Copy từ địa chỉ IPv4'], 0, 'EUI-64: chèn FFFE vào giữa MAC và đảo bit thứ 7 (U/L). Windows hiện đại thường dùng interface ID ngẫu nhiên cho riêng tư.'),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'Router không chuyển tiếp IPv6 nếu chưa "ipv6 unicast-routing" — và cũng không gửi RA nên SLAAC thất bại.', 'OSPFv3 cấu hình trên cổng: interface g0/1 → ipv6 ospf 1 area 0. Kiểm tra: show ipv6 ospf neighbor ; show ipv6 route.', 'PC: ipv6config 2001:db8:10::10/64 2001:db8:10::1 ; ipv6config autoconfig'],
  },
];
