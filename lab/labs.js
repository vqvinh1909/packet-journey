// lab/labs.js — bộ Lab CLI bám giáo trình "Quản trị Hạ tầng mạng (Infrastructure Administrator)".
//
// Mỗi lab = 1 tình huống doanh nghiệp + topology + cấu hình ban đầu (gõ qua chính CLI) +
// danh sách nhiệm vụ có "Kết quả kiểm tra" chấm TỰ ĐỘNG bằng mô phỏng thật (ping/telnet/
// bảng định tuyến/OSPF neighbor...). Lời giải mẫu cũng là chuỗi lệnh CLI → test tự động
// chạy lời giải để chắc chắn mọi lab đều làm được (tests/lab.test.js).
//
//   { id, group, lesson, lessonPath, title, level(1-3), kind:'config'|'ticket'|'project',
//     story, build(), init:[[dev,[cmd...]]...], tasks:[{text, verify, check(api)}],
//     hints:[...], solution:[[dev,[cmd...]]...] }

import * as N from './net.js';
import { createCli, runScript } from './ios.js';
import { CCNA_LABS } from './labs-ccna.js';
import { CAP_LABS } from './labs-capstone.js';
import { ADV_LABS } from './labs-adv.js';
import { SEC_LABS } from './labs-sec.js';
import { L2SEC_LABS } from './labs-l2sec.js';

const B = '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/';
const P = {
  b05: B + 'Module-01_Nen-tang-mang/Bai-05_Dia-chi-IPv4.md',
  b07: B + 'Module-02_Switching/Bai-07_Gioi-thieu-va-cau-hinh-Switch-Cisco.md',
  b08: B + 'Module-02_Switching/Bai-08_Cau-hinh-va-quan-ly-VLAN.md',
  b09: B + 'Module-02_Switching/Bai-09_Trunking-DTP-VTP.md',
  b10: B + 'Module-02_Switching/Bai-10_STP-va-EtherChannel.md',
  b11: B + 'Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  b12: B + 'Module-03_Routing/Bai-12_Inter-VLAN-Routing.md',
  b13: B + 'Module-03_Routing/Bai-13_Static-Route.md',
  b14: B + 'Module-03_Routing/Bai-14_OSPF.md',
  b15: B + 'Module-03_Routing/Bai-15_EIGRP.md',
  b16: B + 'Module-04_Dich-vu-va-Bao-mat-co-ban/Bai-16_Basic-ACL.md',
  b17: B + 'Module-04_Dich-vu-va-Bao-mat-co-ban/Bai-17_Advanced-ACL.md',
  b18: B + 'Module-04_Dich-vu-va-Bao-mat-co-ban/Bai-18_NTP-va-Syslog.md',
  b19: B + 'Module-04_Dich-vu-va-Bao-mat-co-ban/Bai-19_Dich-vu-DHCP.md',
  b20: B + 'Module-04_Dich-vu-va-Bao-mat-co-ban/Bai-20_NAT.md',
  b21: B + 'Module-05_Remote-Access-va-Wireless/Bai-21_FHRP.md',
  b26: B + 'Module-06_Bao-mat-nang-cao/Bai-26_Bao-mat-Lop-2.md',
  t04: B + 'Lab-Tonghop-CCNA/Lab-Tonghop-CCNA-04-Troubleshooting-VLAN-Trunk.md',
  t05: B + 'Lab-Tonghop-CCNA/Lab-Tonghop-CCNA-05-Troubleshooting-OSPF-NAT.md',
  t06: B + 'Lab-Tonghop-CCNA/Lab-Tonghop-CCNA-06-Troubleshooting-FHRP-ACL.md',
  gm: B + 'Lab-Tonghop-CCNA/Lab-Tonghop-CCNA-01-Full-GreenMart.md',
};

/** Bọc lệnh cấu hình: enable → configure terminal → ... → end */
const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
const { pc, server, sw, router, makeNet } = N;
const ports = (n, extra = []) => [...Array.from({ length: n }, (_, i) => `fa0/${i + 1}`), ...extra];
// Chấm "mềm": tên không phân biệt hoa/thường; allowed VLAN chỉ cần ĐÃ GIỚI HẠN và chứa đủ VLAN cần thiết
const same = (a, b) => String(a ?? '').toUpperCase() === String(b ?? '').toUpperCase();
const allowedOk = (p, need, extra = [1, 999]) => p.allowed != null && need.every((v) => p.allowed.includes(v)) && p.allowed.every((v) => need.includes(v) || extra.includes(v));
/** Có ACL loại `type` nào (đặt tên hay đánh số đều được) đang áp trên cổng `ifn` chiều `dir`. */
const aclOn = (d, ifn, dir, type) => { const n = d.ifaces[ifn]?.[dir === 'in' ? 'aclIn' : 'aclOut']; return !!n && (!type || d.acls[n]?.type === type) ? n : null; };

export const LAB_GROUPS = [
  { id: 'm01', title: 'Module 01 — Nền tảng mạng' },
  { id: 'm02', title: 'Module 02 — Switching' },
  { id: 'm03', title: 'Module 03 — Routing' },
  { id: 'm04', title: 'Module 04 — Dịch vụ & Bảo mật cơ bản' },
  { id: 'm05', title: 'Module 05–06 — Dự phòng & Bảo mật L2' },
  { id: 'tk', title: '🎫 Ticket sự cố (troubleshooting)' },
  { id: 'pj', title: '🏢 Dự án tổng hợp' },
  { id: 'cap', title: '🏆 Lab tổng hợp doanh nghiệp CCNA + CCNP (có cách giải)' },
  { id: 'c1', title: '📗 CCNA trực quan — Ch.1 Khái niệm cốt lõi' },
  { id: 'c2', title: '📗 CCNA trực quan — Ch.2 Các bước cấu hình' },
  { id: 'c3', title: '📗 CCNA trực quan — Ch.3 Xử lý sự cố' },
  { id: 'adv', title: '🔬 Chuyên đề nâng cao — VTP · PVLAN · IPsec · BGP · STP' },
  { id: 'sec', title: '🛡️ Bảo mật & Firewall — ASA · ZBF · FortiGate · Palo Alto · Sophos · Check Point · pfSense' },
  { id: 'l2s', title: '🔐 Bảo mật L2 & thiết bị — DHCP snooping · DAI · IP Source Guard · AAA · hardening' },
];

const INFRA_LABS = [
  // ===================================================================== M01
  {
    id: 'L01', group: 'm01', lesson: 'Bài 05', lessonPath: P.b05, level: 1, kind: 'config',
    title: 'Chia subnet /26 & đặt IP cho phòng Kế toán',
    story: 'Công ty Minh Phát cấp cho phòng Kế toán dải 192.168.10.0/26. Quy chuẩn IT: GATEWAY = IP khả dụng CUỐI của subnet (đã cấu hình sẵn trên R-GW), máy trạm đánh số từ IP khả dụng ĐẦU. Hãy tự tính rồi đặt IP cho 2 máy.',
    build: () => makeNet([
      router('rgw', 'R-GW', 500, 90, ['g0/0', 'g0/1']),
      sw('swkt', 'SW-KT', 500, 240, ports(4, ['g0/1'])),
      pc('pckt1', 'PC-KT1', 260, 380, { prefix: 24 }),
      pc('pckt2', 'PC-KT2', 740, 380, { prefix: 24 }),
    ], [['rgw', 'g0/0', 'swkt', 'g0/1'], ['pckt1', 'fa0', 'swkt', 'fa0/1'], ['pckt2', 'fa0', 'swkt', 'fa0/2']]),
    init: [['rgw', cfg('interface g0/0', 'ip address 192.168.10.62 255.255.255.192', 'no shutdown')]],
    tasks: [
      { text: 'PC-KT1 = IP khả dụng đầu tiên của 192.168.10.0/26, gateway đúng quy chuẩn', verify: 'ipconfig', check: (a) => { const d = a.d('pckt1'); return d.ip === '192.168.10.1' && d.prefix === 26 && d.gateway === '192.168.10.62'; } },
      { text: 'PC-KT2 = IP khả dụng thứ hai, cùng mask & gateway', verify: 'ipconfig', check: (a) => { const d = a.d('pckt2'); return d.ip === '192.168.10.2' && d.prefix === 26 && d.gateway === '192.168.10.62'; } },
      { text: 'PC-KT1 ping được PC-KT2', verify: 'ping 192.168.10.2', check: (a) => a.ping('pckt1', '192.168.10.2') },
      { text: 'Cả 2 máy ping được gateway', verify: 'ping 192.168.10.62', check: (a) => a.ping('pckt1', '192.168.10.62') && a.ping('pckt2', '192.168.10.62') },
    ],
    hints: ['/26 → mask 255.255.255.192, mỗi subnet 64 địa chỉ: .0 = network, .63 = broadcast, khả dụng .1 → .62.', 'Lệnh trên PC (kiểu Packet Tracer): ipconfig <IP> <mask> <gateway>', 'Kiểm tra lại bằng: ipconfig rồi ping 192.168.10.62'],
    solution: [['pckt1', ['ipconfig 192.168.10.1 255.255.255.192 192.168.10.62']], ['pckt2', ['ipconfig 192.168.10.2 255.255.255.192 192.168.10.62']]],
  },

  // ===================================================================== M02
  {
    id: 'L02', group: 'm02', lesson: 'Bài 07', lessonPath: P.b07, level: 2, kind: 'config',
    title: 'Cấu hình cơ bản & SSH cho switch truy cập',
    story: 'Switch mới cho tầng 2 vừa lắp, vẫn để cấu hình xuất xưởng (hostname "Switch", không mật khẩu). Theo chính sách bảo mật công ty: đặt tên, mật khẩu enable mã hoá, mật khẩu console, mã hoá toàn bộ mật khẩu, banner cảnh báo, IP quản lý trên VLAN 1 và CHỈ cho quản trị từ xa bằng SSH (cấm Telnet). Máy PC-ADMIN dùng để kiểm tra.',
    build: () => makeNet([
      sw('sw', 'Switch', 500, 150, ports(4, ['g0/1'])),
      pc('pcadmin', 'PC-ADMIN', 500, 360, { ip: '192.168.1.100', gw: '192.168.1.1' }),
    ], [['pcadmin', 'fa0', 'sw', 'fa0/1']]),
    init: [],
    tasks: [
      { text: 'Hostname SW-ACC-01', verify: 'show running-config | include hostname', check: (a) => a.d('sw').name === 'SW-ACC-01' },
      { text: 'Có "enable secret" và bật "service password-encryption"', verify: 'show running-config | include secret|service', check: (a) => !!a.d('sw').enableSecret && a.d('sw').servicePwEnc },
      { text: 'Console có password + login', verify: 'show running-config | section line con', check: (a) => !!a.d('sw').lines.con.password && a.d('sw').lines.con.login },
      { text: 'Banner MOTD cảnh báo truy cập trái phép', verify: 'show running-config | include banner', check: (a) => !!a.d('sw').banner },
      { text: 'Interface Vlan1 = 192.168.1.2/24 (up), ip default-gateway 192.168.1.1; PC-ADMIN ping được switch', verify: 'show ip interface brief', check: (a) => { const d = a.d('sw'); return d.svis.vlan1?.ip === '192.168.1.2' && d.svis.vlan1.prefix === 24 && d.defaultGateway === '192.168.1.1' && a.ping('pcadmin', '192.168.1.2'); } },
      { text: 'SSH v2 hoạt động (PC-ADMIN: ssh -l <user> 192.168.1.2) bằng tài khoản local', verify: 'show ip ssh', check: (a) => a.tcp('pcadmin', '192.168.1.2', 22).ok && Object.keys(a.d('sw').users).length > 0 && a.d('sw').rsa >= 768 },
      { text: 'Telnet bị từ chối (VTY chỉ cho SSH)', verify: 'PC-ADMIN: telnet 192.168.1.2', check: (a) => a.tcp('pcadmin', '192.168.1.2', 23).kind === 'refused' },
    ],
    hints: ['Mọi lệnh cấu hình bắt đầu bằng: enable → configure terminal (viết tắt: en, conf t).', 'Console: line console 0 → password ... → login', 'SSH cần đủ: hostname khác mặc định, ip domain-name, crypto key generate rsa modulus 1024, username ... secret ..., line vty 0 4 → login local + transport input ssh.', 'IP quản lý: interface vlan 1 → ip address ... → no shutdown (VLAN 1 mặc định đang shutdown!).'],
    solution: [['sw', cfg('hostname SW-ACC-01', 'enable secret Cisco@123', 'service password-encryption', 'banner motd #Chi danh cho nhan vien duoc uy quyen#', 'line console 0', 'password Con@123', 'login', 'exit', 'ip domain-name minhphat.local', 'crypto key generate rsa modulus 1024', 'username admin privilege 15 secret Admin@123', 'line vty 0 4', 'login local', 'transport input ssh', 'exit', 'interface vlan 1', 'ip address 192.168.1.2 255.255.255.0', 'no shutdown', 'exit', 'ip default-gateway 192.168.1.1')]],
  },
  {
    id: 'L03', group: 'm02', lesson: 'Bài 08', lessonPath: P.b08, level: 1, kind: 'config',
    title: 'Tách VLAN cho phòng Kinh doanh & Kế toán',
    story: 'Tầng 3 dùng chung 1 switch và CÙNG dải 192.168.1.0/24 cho cả phòng Kinh doanh và Kế toán (thiết kế cũ). Kế toán lo ngại bảo mật vì mọi broadcast/traffic L2 đều thấy nhau. Yêu cầu: tách thành 2 VLAN — 10 SALES và 30 KETOAN.',
    build: () => makeNet([
      sw('swt3', 'SW-T3', 500, 120, ports(8, ['g0/1'])),
      pc('s1', 'PC-SALES1', 160, 350, { ip: '192.168.1.11' }),
      pc('s2', 'PC-SALES2', 380, 350, { ip: '192.168.1.12' }),
      pc('k1', 'PC-KT1', 620, 350, { ip: '192.168.1.21' }),
      pc('k2', 'PC-KT2', 840, 350, { ip: '192.168.1.22' }),
    ], [['s1', 'fa0', 'swt3', 'fa0/1'], ['s2', 'fa0', 'swt3', 'fa0/2'], ['k1', 'fa0', 'swt3', 'fa0/3'], ['k2', 'fa0', 'swt3', 'fa0/4']]),
    init: [],
    tasks: [
      { text: 'Tạo VLAN 10 tên SALES, VLAN 30 tên KETOAN', verify: 'show vlan brief', check: (a) => same(a.d('swt3').vlans[10], 'SALES') && same(a.d('swt3').vlans[30], 'KETOAN') },
      { text: 'Fa0/1–2 là access VLAN 10; Fa0/3–4 là access VLAN 30 (switchport mode access)', verify: 'show vlan brief', check: (a) => { const p = a.d('swt3').ports; return ['fa0/1', 'fa0/2'].every((n) => p[n].modeSet && p[n].mode === 'access' && p[n].vlan === 10) && ['fa0/3', 'fa0/4'].every((n) => p[n].modeSet && p[n].mode === 'access' && p[n].vlan === 30); } },
      { text: 'Cùng phòng vẫn liên lạc: SALES1↔SALES2, KT1↔KT2', verify: 'ping', check: (a) => a.ping('s1', '192.168.1.12') && a.ping('k1', '192.168.1.22') },
      { text: 'Cách ly: PC-SALES1 KHÔNG ping được PC-KT1 (dù cùng dải IP)', verify: 'ping 192.168.1.21', check: (a) => !a.ping('s1', '192.168.1.21') && !a.ping('s2', '192.168.1.22') },
    ],
    hints: ['vlan 10 → name SALES (tương tự VLAN 30).', 'Cấu hình nhiều cổng một lúc: interface range fa0/1 - 2', 'switchport mode access → switchport access vlan 10', 'Xác minh: show vlan brief'],
    solution: [['swt3', cfg('vlan 10', 'name SALES', 'vlan 30', 'name KETOAN', 'exit', 'interface range fa0/1 - 2', 'switchport mode access', 'switchport access vlan 10', 'interface range fa0/3 - 4', 'switchport mode access', 'switchport access vlan 30')]],
  },
  {
    id: 'L04', group: 'm02', lesson: 'Bài 09', lessonPath: P.b09, level: 2, kind: 'config',
    title: 'Trunk 802.1Q giữa 2 tầng + native VLAN 999',
    story: 'Kinh doanh (VLAN 10) và Kế toán (VLAN 30) có máy ở cả tầng 3 (SW-T3) và tầng 4 (SW-T4). Hai switch nối nhau qua g0/1. Chuẩn bảo mật công ty: native VLAN = 999 (không gán host — chống VLAN hopping), trunk CHỈ cho qua VLAN cần thiết.',
    build: () => makeNet([
      sw('t3', 'SW-T3', 300, 140, ports(4, ['g0/1'])),
      sw('t4', 'SW-T4', 700, 140, ports(4, ['g0/1'])),
      pc('s3', 'PC-SALES-T3', 150, 360, { ip: '192.168.10.11' }),
      pc('k3', 'PC-KT-T3', 400, 360, { ip: '192.168.30.11' }),
      pc('s4', 'PC-SALES-T4', 600, 360, { ip: '192.168.10.12' }),
      pc('k4', 'PC-KT-T4', 850, 360, { ip: '192.168.30.12' }),
    ], [['t3', 'g0/1', 't4', 'g0/1'], ['s3', 'fa0', 't3', 'fa0/1'], ['k3', 'fa0', 't3', 'fa0/2'], ['s4', 'fa0', 't4', 'fa0/1'], ['k4', 'fa0', 't4', 'fa0/2']]),
    init: ['t3', 't4'].map((s) => [s, cfg('vlan 10', 'name SALES', 'vlan 30', 'name KETOAN', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'interface fa0/2', 'switchport mode access', 'switchport access vlan 30')]),
    tasks: [
      { text: 'g0/1 ở CẢ 2 switch là trunk', verify: 'show interfaces trunk', check: (a) => a.d('t3').ports['g0/1'].mode === 'trunk' && a.d('t4').ports['g0/1'].mode === 'trunk' },
      { text: 'Native VLAN 999 (tên NATIVE) ở cả 2 đầu', verify: 'show interfaces trunk', check: (a) => ['t3', 't4'].every((s) => a.d(s).ports['g0/1'].native === 999 && same(a.d(s).vlans[999], 'NATIVE')) },
      { text: 'Trunk chỉ cho phép VLAN cần thiết (10, 30 và native 999)', verify: 'show interfaces trunk', check: (a) => ['t3', 't4'].every((s) => allowedOk(a.d(s).ports['g0/1'], [10, 30])) },
      { text: 'SALES tầng 3 ↔ tầng 4 và KT tầng 3 ↔ tầng 4 ping được', verify: 'ping', check: (a) => a.ping('s3', '192.168.10.12') && a.ping('k3', '192.168.30.12') },
    ],
    hints: ['interface g0/1 → switchport mode trunk', 'switchport trunk native vlan 999 (nhớ tạo VLAN 999 trước: vlan 999 → name NATIVE)', 'switchport trunk allowed vlan 10,30,999', 'Cấu hình ở CẢ HAI đầu trunk, rồi kiểm tra show interfaces trunk'],
    solution: ['t3', 't4'].map((s) => [s, cfg('vlan 999', 'name NATIVE', 'exit', 'interface g0/1', 'switchport mode trunk', 'switchport trunk native vlan 999', 'switchport trunk allowed vlan 10,30,999')]),
  },
  {
    id: 'L05', group: 'm02', lesson: 'Bài 10', lessonPath: P.b10, level: 2, kind: 'config',
    title: 'EtherChannel LACP & chọn Root Bridge',
    story: 'SW-DIST (phòng server) nối SW-ACC bằng 2 dây Fa0/23–24 để dự phòng, nhưng STP đang khoá 1 dây (lãng phí 50% băng thông) và Root Bridge lại rơi vào SW-ACC (switch cũ, MAC thấp nhất) — sai thiết kế. Hãy gộp 2 dây thành Port-channel 1 (LACP) và ép SW-DIST làm Root cho VLAN 10.',
    build: () => makeNet([
      sw('swacc', 'SW-ACC', 700, 140, ['fa0/1', 'fa0/2', 'fa0/23', 'fa0/24']),
      sw('swdist', 'SW-DIST', 300, 140, ['fa0/1', 'fa0/2', 'fa0/23', 'fa0/24']),
      pc('srv', 'PC-SRV', 300, 360, { ip: '192.168.10.10' }),
      pc('nv', 'PC-NV', 700, 360, { ip: '192.168.10.20' }),
    ], [['swdist', 'fa0/23', 'swacc', 'fa0/23'], ['swdist', 'fa0/24', 'swacc', 'fa0/24'], ['srv', 'fa0', 'swdist', 'fa0/1'], ['nv', 'fa0', 'swacc', 'fa0/1']]),
    init: ['swacc', 'swdist'].map((s) => [s, cfg('vlan 10', 'name STAFF', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'interface range fa0/23 - 24', 'switchport mode trunk')]),
    tasks: [
      { text: 'Fa0/23 + Fa0/24 gộp thành Po1 bằng LACP ở cả 2 switch (cờ P = bundled)', verify: 'show etherchannel summary', check: (a) => ['swdist', 'swacc'].every((s) => a.bundle(s, 'fa0/23')?.formed && a.bundle(s, 'fa0/24')?.formed && a.bundle(s, 'fa0/23').proto === 'LACP') },
      { text: 'Port-channel là trunk ở cả 2 đầu', verify: 'show interfaces trunk', check: (a) => ['swdist', 'swacc'].every((s) => { const b = a.bundle(s, 'fa0/23'); return !!b && a.d(s).ports[b.po]?.mode === 'trunk'; }) },
      { text: 'SW-DIST là Root Bridge của VLAN 10', verify: 'show spanning-tree vlan 10', check: (a) => a.stpRoot(10) === 'swdist' },
      { text: 'PC-SRV ping được PC-NV qua EtherChannel', verify: 'ping 192.168.10.20', check: (a) => a.ping('srv', '192.168.10.20') },
    ],
    hints: ['Trước khi làm, xem show spanning-tree vlan 10 trên SW-DIST: 1 trong 2 dây đang Altn BLK (bị STP khoá), còn SW-ACC đang là root.', 'interface range fa0/23 - 24 → channel-group 1 mode active (LACP)', 'interface port-channel 1 → switchport mode trunk', 'spanning-tree vlan 10 root primary (hoặc priority 4096) trên SW-DIST'],
    solution: [['swdist', cfg('interface range fa0/23 - 24', 'channel-group 1 mode active', 'exit', 'interface port-channel 1', 'switchport mode trunk', 'exit', 'spanning-tree vlan 10 root primary')], ['swacc', cfg('interface range fa0/23 - 24', 'channel-group 1 mode active', 'exit', 'interface port-channel 1', 'switchport mode trunk')]],
  },

  // ===================================================================== M03
  {
    id: 'L06', group: 'm03', lesson: 'Bài 11', lessonPath: P.b11, level: 1, kind: 'config',
    title: 'Router đầu tiên: nối Văn phòng và Kho',
    story: 'Chi nhánh có 2 khu ở 2 mạng khác nhau: Văn phòng 192.168.1.0/24 và Kho 192.168.2.0/24. Router mới (cấu hình xuất xưởng, mọi cổng đang shutdown) cần được đặt tên R-CN và nối 2 mạng. Gateway mỗi mạng là địa chỉ .1.',
    build: () => makeNet([
      router('rcn', 'Router', 500, 100, ['g0/0', 'g0/1', 'g0/2']),
      sw('swvp', 'SW-VP', 250, 230, ports(4, ['g0/1'])),
      sw('swkho', 'SW-KHO', 750, 230, ports(4, ['g0/1'])),
      pc('pcvp', 'PC-VP', 250, 380, { ip: '192.168.1.10', gw: '192.168.1.1' }),
      pc('pckho', 'PC-KHO', 750, 380, { ip: '192.168.2.10', gw: '192.168.2.1' }),
    ], [['rcn', 'g0/0', 'swvp', 'g0/1'], ['rcn', 'g0/1', 'swkho', 'g0/1'], ['pcvp', 'fa0', 'swvp', 'fa0/1'], ['pckho', 'fa0', 'swkho', 'fa0/1']]),
    init: [],
    tasks: [
      { text: 'Hostname R-CN', verify: 'show running-config | include hostname', check: (a) => a.d('rcn').name === 'R-CN' },
      { text: 'G0/0 = 192.168.1.1/24, up/up', verify: 'show ip interface brief', check: (a) => a.d('rcn').ifaces['g0/0'].ip === '192.168.1.1' && a.d('rcn').ifaces['g0/0'].prefix === 24 && a.up('rcn', 'g0/0') },
      { text: 'G0/1 = 192.168.2.1/24, up/up', verify: 'show ip interface brief', check: (a) => a.d('rcn').ifaces['g0/1'].ip === '192.168.2.1' && a.d('rcn').ifaces['g0/1'].prefix === 24 && a.up('rcn', 'g0/1') },
      { text: 'Có description cho 2 cổng (thói quen tốt khi vận hành)', verify: 'show running-config | section interface', check: (a) => !!a.d('rcn').ifaces['g0/0'].desc && !!a.d('rcn').ifaces['g0/1'].desc },
      { text: 'PC-VP ping được PC-KHO', verify: 'ping 192.168.2.10', check: (a) => a.ping('pcvp', '192.168.2.10') },
    ],
    hints: ['Router mặc định mọi cổng shutdown → nhớ "no shutdown".', 'interface g0/0 → ip address 192.168.1.1 255.255.255.0 → description LAN-VAN-PHONG → no shutdown', 'Xem bảng định tuyến: show ip route (2 mạng C = directly connected).'],
    solution: [['rcn', cfg('hostname R-CN', 'interface g0/0', 'description LAN-VAN-PHONG', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'description LAN-KHO', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown')]],
  },
  {
    id: 'L07', group: 'm03', lesson: 'Bài 12', lessonPath: P.b12, level: 2, kind: 'config',
    title: 'Inter-VLAN routing: Router-on-a-stick',
    story: 'Văn phòng có VLAN 10 Nhân sự (192.168.10.0/24) và VLAN 20 Kỹ thuật (192.168.20.0/24) đã chia sẵn trên SW-CORE. Chỉ có 1 dây từ SW-CORE g0/1 lên R-CORE g0/0. Hãy dựng router-on-a-stick để 2 VLAN liên lạc với nhau (gateway = .1).',
    build: () => makeNet([
      router('rcore', 'R-CORE', 500, 90, ['g0/0', 'g0/1']),
      sw('swcore', 'SW-CORE', 500, 230, ports(4, ['g0/1'])),
      pc('hr', 'PC-NHANSU', 300, 380, { ip: '192.168.10.10', gw: '192.168.10.1' }),
      pc('kt', 'PC-KYTHUAT', 700, 380, { ip: '192.168.20.10', gw: '192.168.20.1' }),
    ], [['rcore', 'g0/0', 'swcore', 'g0/1'], ['hr', 'fa0', 'swcore', 'fa0/1'], ['kt', 'fa0', 'swcore', 'fa0/2']]),
    init: [['swcore', cfg('vlan 10', 'name NHANSU', 'vlan 20', 'name KYTHUAT', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'interface fa0/2', 'switchport mode access', 'switchport access vlan 20')]],
    tasks: [
      { text: 'SW-CORE g0/1 (lên router) là trunk', verify: 'show interfaces trunk', check: (a) => a.d('swcore').ports['g0/1'].mode === 'trunk' },
      { text: 'R-CORE g0/0.10: encapsulation dot1Q 10, 192.168.10.1/24, up', verify: 'show ip interface brief', check: (a) => { const f = a.d('rcore').ifaces['g0/0.10']; return f && f.encap === 10 && f.ip === '192.168.10.1' && a.up('rcore', 'g0/0.10'); } },
      { text: 'R-CORE g0/0.20: encapsulation dot1Q 20, 192.168.20.1/24, up', verify: 'show ip interface brief', check: (a) => { const f = a.d('rcore').ifaces['g0/0.20']; return f && f.encap === 20 && f.ip === '192.168.20.1' && a.up('rcore', 'g0/0.20'); } },
      { text: 'PC-NHANSU ping được PC-KYTHUAT (khác VLAN)', verify: 'ping 192.168.20.10', check: (a) => a.ping('hr', '192.168.20.10') },
    ],
    hints: ['Cổng vật lý g0/0 không đặt IP, chỉ cần no shutdown.', 'interface g0/0.10 → encapsulation dot1Q 10 → ip address 192.168.10.1 255.255.255.0', 'Bấm "Xem gói tin" sau khi ping để thấy tag 802.1Q đổi từ VLAN 10 sang VLAN 20 khi quay ra.'],
    solution: [['swcore', cfg('interface g0/1', 'switchport mode trunk')], ['rcore', cfg('interface g0/0', 'no shutdown', 'interface g0/0.10', 'encapsulation dot1Q 10', 'ip address 192.168.10.1 255.255.255.0', 'interface g0/0.20', 'encapsulation dot1Q 20', 'ip address 192.168.20.1 255.255.255.0')]],
  },
  {
    id: 'L08', group: 'm03', lesson: 'Bài 13', lessonPath: P.b13, level: 2, kind: 'config',
    title: 'Định tuyến tĩnh cho 3 site (HQ – Chi nhánh 1 – Chi nhánh 2)',
    story: 'Ba site nối nối tiếp bằng đường serial: HQ ⇄ BR1 ⇄ BR2. Interface đã cấu hình xong nhưng chưa có route nào nên chỉ ping được mạng nối trực tiếp. Yêu cầu: định tuyến tĩnh đầy đủ; BR2 là site "cụt" (stub) nên chỉ dùng 1 default route.',
    build: () => makeNet([
      router('rhq', 'R-HQ', 200, 120, ['g0/0', 'g0/1', 's0/0/0', 's0/0/1']),
      router('rbr1', 'R-BR1', 500, 120, ['g0/0', 'g0/1', 's0/0/0', 's0/0/1']),
      router('rbr2', 'R-BR2', 800, 120, ['g0/0', 'g0/1', 's0/0/0', 's0/0/1']),
      pc('pchq', 'PC-HQ', 200, 340, { ip: '192.168.1.10', gw: '192.168.1.1' }),
      pc('pcbr1', 'PC-BR1', 500, 340, { ip: '192.168.2.10', gw: '192.168.2.1' }),
      pc('pcbr2', 'PC-BR2', 800, 340, { ip: '192.168.3.10', gw: '192.168.3.1' }),
    ], [['rhq', 's0/0/0', 'rbr1', 's0/0/0'], ['rbr1', 's0/0/1', 'rbr2', 's0/0/0'], ['pchq', 'fa0', 'rhq', 'g0/0'], ['pcbr1', 'fa0', 'rbr1', 'g0/0'], ['pcbr2', 'fa0', 'rbr2', 'g0/0']]),
    init: [
      ['rhq', cfg('interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.0.12.1 255.255.255.252', 'clock rate 64000', 'no shutdown')],
      ['rbr1', cfg('interface g0/0', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.0.12.2 255.255.255.252', 'no shutdown', 'interface s0/0/1', 'ip address 10.0.23.1 255.255.255.252', 'clock rate 64000', 'no shutdown')],
      ['rbr2', cfg('interface g0/0', 'ip address 192.168.3.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.0.23.2 255.255.255.252', 'no shutdown')],
    ],
    tasks: [
      { text: 'R-HQ có route tĩnh tới 192.168.2.0/24 và 192.168.3.0/24', verify: 'show ip route static', check: (a) => a.route('rhq', '192.168.2.0/24')?.code === 'S' && a.route('rhq', '192.168.3.0/24')?.code === 'S' },
      { text: 'R-BR1 có route tĩnh tới 192.168.1.0/24 và 192.168.3.0/24', verify: 'show ip route static', check: (a) => a.route('rbr1', '192.168.1.0/24')?.code === 'S' && a.route('rbr1', '192.168.3.0/24')?.code === 'S' },
      { text: 'R-BR2 (stub) CHỈ dùng 1 default route 0.0.0.0/0', verify: 'show ip route', check: (a) => a.route('rbr2', '0.0.0.0/0')?.code === 'S*' && a.d('rbr2').routes.length === 1 },
      { text: 'PC-HQ ping được PC-BR1 và PC-BR2; PC-BR1 ping được PC-BR2', verify: 'ping / tracert', check: (a) => a.ping('pchq', '192.168.2.10') && a.ping('pchq', '192.168.3.10') && a.ping('pcbr1', '192.168.3.10') },
    ],
    hints: ['Cú pháp: ip route <mạng đích> <mask> <next-hop>', 'Next-hop là IP của router BÊN KIA đường serial (vd R-HQ → 10.0.12.2).', 'Ping phải có đường VỀ: router bên kia cũng cần route ngược lại!', 'R-BR2: ip route 0.0.0.0 0.0.0.0 10.0.23.1'],
    solution: [
      ['rhq', cfg('ip route 192.168.2.0 255.255.255.0 10.0.12.2', 'ip route 192.168.3.0 255.255.255.0 10.0.12.2')],
      ['rbr1', cfg('ip route 192.168.1.0 255.255.255.0 10.0.12.1', 'ip route 192.168.3.0 255.255.255.0 10.0.23.2')],
      ['rbr2', cfg('ip route 0.0.0.0 0.0.0.0 10.0.23.1')],
    ],
  },
  {
    id: 'L09', group: 'm03', lesson: 'Bài 13', lessonPath: P.b13, level: 3, kind: 'config',
    title: 'Floating static route: đường dự phòng tự động',
    story: 'Chi nhánh truy cập server ERP ở HQ qua cáp quang (g0/1, đường CHÍNH). Đường serial s0/0/0 là đường DỰ PHÒNG chậm hơn. Yêu cầu: bình thường đi cáp quang; khi cáp quang đứt phải tự chuyển sang serial mà không ai phải gõ lệnh — cấu hình 2 chiều.',
    build: () => makeNet([
      router('rbr', 'R-BR', 330, 200, ['g0/0', 'g0/1', 's0/0/0']),
      router('rhq', 'R-HQ', 670, 200, ['g0/0', 'g0/1', 's0/0/0']),
      pc('pcbr', 'PC-BR', 140, 340, { ip: '192.168.50.10', gw: '192.168.50.1' }),
      server('erp', 'SRV-ERP', 860, 340, { ip: '172.16.1.10', gw: '172.16.1.1' }),
    ], [['pcbr', 'fa0', 'rbr', 'g0/0'], ['rbr', 'g0/1', 'rhq', 'g0/1'], ['rbr', 's0/0/0', 'rhq', 's0/0/0'], ['rhq', 'g0/0', 'erp', 'fa0']]),
    init: [
      ['rbr', cfg('interface g0/0', 'ip address 192.168.50.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'description CAP-QUANG-CHINH', 'ip address 10.0.0.2 255.255.255.252', 'no shutdown', 'interface s0/0/0', 'description SERIAL-DU-PHONG', 'ip address 10.0.1.2 255.255.255.252', 'no shutdown')],
      ['rhq', cfg('interface g0/0', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.0.1 255.255.255.252', 'no shutdown', 'interface s0/0/0', 'ip address 10.0.1.1 255.255.255.252', 'clock rate 128000', 'no shutdown')],
    ],
    tasks: [
      { text: 'R-BR: route CHÍNH tới 172.16.1.0/24 qua 10.0.0.1', verify: 'show ip route', check: (a) => a.d('rbr').routes.some((r) => r.net === '172.16.1.0' && r.prefix === 24 && r.nh === '10.0.0.1' && r.ad === 1) },
      { text: 'R-BR: route DỰ PHÒNG (floating, AD lớn hơn, vd 200) qua 10.0.1.1', verify: 'show running-config | include ip route', check: (a) => a.d('rbr').routes.some((r) => r.net === '172.16.1.0' && r.prefix === 24 && r.nh === '10.0.1.1' && r.ad > 1) },
      { text: 'R-HQ: route về 192.168.50.0/24 qua cả 2 đường (chính + floating)', verify: 'show running-config | include ip route', check: (a) => { const r = a.d('rhq').routes.filter((x) => x.net === '192.168.50.0'); return r.some((x) => x.nh === '10.0.0.2' && x.ad === 1) && r.some((x) => x.nh === '10.0.1.2' && x.ad > 1); } },
      { text: 'Bình thường: PC-BR ping SRV-ERP OK và đi qua cáp quang', verify: 'tracert 172.16.1.10', check: (a) => a.ping('pcbr', '172.16.1.10') && a.route('rbr', '172.16.1.0/24')?.nextHop === '10.0.0.1' },
      { text: 'Giả lập ĐỨT cáp quang (R-BR g0/1 shutdown) → ping vẫn OK qua serial', verify: 'shutdown g0/1 rồi ping & show ip route', check: (a) => a.whatIf((n) => { n.devices.rbr.ifaces['g0/1'].shutdown = true; }, (b) => b.ping('pcbr', '172.16.1.10') && b.route('rbr', '172.16.1.0/24')?.nextHop === '10.0.1.1') },
    ],
    hints: ['Floating static = route tĩnh có Administrative Distance cao hơn → chỉ vào bảng định tuyến khi route chính mất.', 'ip route 172.16.1.0 255.255.255.0 10.0.1.1 200', 'Đừng quên chiều về trên R-HQ!', 'Tự thử: interface g0/1 → shutdown rồi show ip route để thấy route floating xuất hiện.'],
    solution: [
      ['rbr', cfg('ip route 172.16.1.0 255.255.255.0 10.0.0.1', 'ip route 172.16.1.0 255.255.255.0 10.0.1.1 200')],
      ['rhq', cfg('ip route 192.168.50.0 255.255.255.0 10.0.0.2', 'ip route 192.168.50.0 255.255.255.0 10.0.1.2 200')],
    ],
  },
  {
    id: 'L10', group: 'm03', lesson: 'Bài 14', lessonPath: P.b14, level: 2, kind: 'config',
    title: 'OSPF đơn vùng cho 3 router (mạng tam giác)',
    story: 'Ba văn phòng nối thành hình tam giác để có dự phòng. Thay vì gõ hàng chục route tĩnh, công ty chuẩn hoá dùng OSPF process 1, area 0, router-id theo quy ước x.x.x.x (R1=1.1.1.1...). Cổng LAN không được gửi hello ra phía người dùng (bảo mật).',
    build: () => makeNet([
      router('r1', 'R1', 220, 110, ['g0/0', 'g0/1', 'g0/2']),
      router('r2', 'R2', 780, 110, ['g0/0', 'g0/1', 'g0/2']),
      router('r3', 'R3', 500, 250, ['g0/0', 'g0/1', 'g0/2']),
      pc('pc1', 'PC1', 90, 320, { ip: '192.168.1.10', gw: '192.168.1.1' }),
      pc('pc2', 'PC2', 910, 320, { ip: '192.168.2.10', gw: '192.168.2.1' }),
      pc('pc3', 'PC3', 500, 400, { ip: '192.168.3.10', gw: '192.168.3.1' }),
    ], [['r1', 'g0/1', 'r2', 'g0/1'], ['r2', 'g0/2', 'r3', 'g0/1'], ['r1', 'g0/2', 'r3', 'g0/2'], ['pc1', 'fa0', 'r1', 'g0/0'], ['pc2', 'fa0', 'r2', 'g0/0'], ['pc3', 'fa0', 'r3', 'g0/0']]),
    init: [
      ['r1', cfg('interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.1 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 10.0.13.1 255.255.255.252', 'no shutdown')],
      ['r2', cfg('interface g0/0', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.2 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 10.0.23.1 255.255.255.252', 'no shutdown')],
      ['r3', cfg('interface g0/0', 'ip address 192.168.3.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.23.2 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 10.0.13.2 255.255.255.252', 'no shutdown')],
    ],
    tasks: [
      { text: 'OSPF process 1 trên cả 3 router, router-id 1.1.1.1 / 2.2.2.2 / 3.3.3.3', verify: 'show ip protocols', check: (a) => [['r1', '1.1.1.1'], ['r2', '2.2.2.2'], ['r3', '3.3.3.3']].every(([r, id]) => a.d(r).ospf?.pid === 1 && a.d(r).ospf.rid === id) },
      { text: 'Mỗi router có đủ 2 láng giềng FULL', verify: 'show ip ospf neighbor', check: (a) => ['r1', 'r2', 'r3'].every((r) => a.nbrs(r).length === 2) },
      { text: 'Cổng LAN g0/0 là passive-interface trên cả 3 router', verify: 'show ip protocols', check: (a) => ['r1', 'r2', 'r3'].every((r) => a.ospfIf(r, 'g0/0')?.passive === true) },
      { text: 'R1 học được 192.168.2.0/24 và 192.168.3.0/24 bằng OSPF (O)', verify: 'show ip route ospf', check: (a) => a.route('r1', '192.168.2.0/24')?.code === 'O' && a.route('r1', '192.168.3.0/24')?.code === 'O' },
      { text: 'PC1, PC2, PC3 ping được lẫn nhau', verify: 'ping', check: (a) => a.ping('pc1', '192.168.2.10') && a.ping('pc1', '192.168.3.10') && a.ping('pc2', '192.168.3.10') },
    ],
    hints: ['router ospf 1 → router-id 1.1.1.1', 'network <địa chỉ mạng> <wildcard> area 0 — wildcard của /30 là 0.0.0.3, của /24 là 0.0.0.255.', 'passive-interface g0/0 (vẫn quảng bá mạng LAN nhưng không gửi hello ra PC).', 'Theo dõi log %OSPF-5-ADJCHG ... FULL khi láng giềng lên.'],
    solution: [
      ['r1', cfg('router ospf 1', 'router-id 1.1.1.1', 'network 192.168.1.0 0.0.0.255 area 0', 'network 10.0.12.0 0.0.0.3 area 0', 'network 10.0.13.0 0.0.0.3 area 0', 'passive-interface g0/0')],
      ['r2', cfg('router ospf 1', 'router-id 2.2.2.2', 'network 192.168.2.0 0.0.0.255 area 0', 'network 10.0.12.0 0.0.0.3 area 0', 'network 10.0.23.0 0.0.0.3 area 0', 'passive-interface g0/0')],
      ['r3', cfg('router ospf 1', 'router-id 3.3.3.3', 'network 192.168.3.0 0.0.0.255 area 0', 'network 10.0.23.0 0.0.0.3 area 0', 'network 10.0.13.0 0.0.0.3 area 0', 'passive-interface g0/0')],
    ],
  },
  {
    id: 'L11', group: 'm03', lesson: 'Bài 14', lessonPath: P.b14, level: 2, kind: 'config',
    title: 'OSPF + default route ra Internet (default-information originate)',
    story: 'R-EDGE là router biên nối ISP. OSPF nội bộ giữa R-EDGE và chi nhánh R-BR đã chạy. Yêu cầu: R-EDGE có default route tới ISP và QUẢNG BÁ default route đó vào OSPF để chi nhánh tự học (không cấu hình tay từng router). (Lab giả định ISP đã định tuyến về dải của công ty; phần NAT sẽ học ở Lab 17.)',
    build: () => makeNet([
      router('rbr', 'R-BR', 180, 120, ['g0/0', 's0/0/0']),
      router('redge', 'R-EDGE', 500, 120, ['g0/0', 'g0/1', 's0/0/0']),
      router('isp', 'ISP', 820, 120, ['g0/0', 'g0/1']),
      pc('pcbr', 'PC-BR', 180, 340, { ip: '192.168.20.10', gw: '192.168.20.1' }),
      pc('pchq', 'PC-HQ', 500, 340, { ip: '192.168.10.10', gw: '192.168.10.1' }),
      server('inet', 'INTERNET 8.8.8.8', 820, 340, { ip: '8.8.8.8', gw: '8.8.8.1' }),
    ], [['rbr', 's0/0/0', 'redge', 's0/0/0'], ['redge', 'g0/1', 'isp', 'g0/1'], ['pcbr', 'fa0', 'rbr', 'g0/0'], ['pchq', 'fa0', 'redge', 'g0/0'], ['isp', 'g0/0', 'inet', 'fa0']]),
    init: [
      ['isp', cfg('interface g0/0', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.1 255.255.255.252', 'no shutdown', 'ip route 192.168.0.0 255.255.0.0 203.0.113.2')],
      ['redge', cfg('interface g0/0', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.2 255.255.255.252', 'no shutdown', 'interface s0/0/0', 'ip address 10.0.0.1 255.255.255.252', 'clock rate 64000', 'no shutdown', 'router ospf 1', 'router-id 1.1.1.1', 'network 192.168.10.0 0.0.0.255 area 0', 'network 10.0.0.0 0.0.0.3 area 0', 'passive-interface g0/0')],
      ['rbr', cfg('interface g0/0', 'ip address 192.168.20.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.0.0.2 255.255.255.252', 'no shutdown', 'router ospf 1', 'router-id 2.2.2.2', 'network 192.168.20.0 0.0.0.255 area 0', 'network 10.0.0.0 0.0.0.3 area 0', 'passive-interface g0/0')],
    ],
    tasks: [
      { text: 'R-EDGE có default route (S*) tới ISP 203.0.113.1', verify: 'show ip route static', check: (a) => a.route('redge', '0.0.0.0/0')?.code === 'S*' && a.route('redge', '0.0.0.0/0').nextHop === '203.0.113.1' },
      { text: 'R-EDGE quảng bá default route vào OSPF', verify: 'show running-config | section ospf', check: (a) => !!a.d('redge').ospf?.defaultOriginate },
      { text: 'R-BR tự học 0.0.0.0/0 qua OSPF (O*E2)', verify: 'show ip route', check: (a) => a.route('rbr', '0.0.0.0/0')?.code === 'O*E2' },
      { text: 'PC-BR và PC-HQ ping được 8.8.8.8', verify: 'ping 8.8.8.8', check: (a) => a.ping('pcbr', '8.8.8.8') && a.ping('pchq', '8.8.8.8') },
      { text: 'Ràng buộc: R-BR KHÔNG có route tĩnh nào', verify: 'show running-config | include ip route', check: (a) => a.d('rbr').routes.length === 0 },
    ],
    hints: ['ip route 0.0.0.0 0.0.0.0 203.0.113.1 trên R-EDGE', 'router ospf 1 → default-information originate', 'Trên R-BR: show ip route → tìm dòng O*E2 0.0.0.0/0'],
    solution: [['redge', cfg('ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'router ospf 1', 'default-information originate')]],
  },
  {
    id: 'L12', group: 'm03', lesson: 'Bài 15', lessonPath: P.b15, level: 2, kind: 'config',
    title: 'EIGRP AS 100 cho 3 chi nhánh',
    story: 'Một khách hàng dùng EIGRP (AS 100) làm chuẩn. Ba router nối tiếp R1 – R2 – R3, mỗi router có 1 LAN 172.16.x.0/24. Yêu cầu: chạy EIGRP AS 100, khai báo mạng bằng wildcard chính xác, TẮT auto-summary.',
    build: () => makeNet([
      router('r1', 'R1', 180, 120, ['g0/0', 'g0/1', 'g0/2']),
      router('r2', 'R2', 500, 120, ['g0/0', 'g0/1', 'g0/2']),
      router('r3', 'R3', 820, 120, ['g0/0', 'g0/1', 'g0/2']),
      pc('pc1', 'PC1', 180, 340, { ip: '172.16.1.10', gw: '172.16.1.1' }),
      pc('pc2', 'PC2', 500, 340, { ip: '172.16.2.10', gw: '172.16.2.1' }),
      pc('pc3', 'PC3', 820, 340, { ip: '172.16.3.10', gw: '172.16.3.1' }),
    ], [['r1', 'g0/1', 'r2', 'g0/1'], ['r2', 'g0/2', 'r3', 'g0/1'], ['pc1', 'fa0', 'r1', 'g0/0'], ['pc2', 'fa0', 'r2', 'g0/0'], ['pc3', 'fa0', 'r3', 'g0/0']]),
    init: [
      ['r1', cfg('interface g0/0', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.1.12.1 255.255.255.252', 'no shutdown')],
      ['r2', cfg('interface g0/0', 'ip address 172.16.2.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.1.12.2 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 10.1.23.1 255.255.255.252', 'no shutdown')],
      ['r3', cfg('interface g0/0', 'ip address 172.16.3.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.1.23.2 255.255.255.252', 'no shutdown')],
    ],
    tasks: [
      { text: 'EIGRP AS 100 trên cả 3 router, no auto-summary', verify: 'show ip protocols', check: (a) => ['r1', 'r2', 'r3'].every((r) => a.d(r).eigrp?.as === 100 && a.d(r).eigrp.autoSummary === false) },
      { text: 'R2 có 2 láng giềng EIGRP; R1, R3 mỗi router 1', verify: 'show ip eigrp neighbors', check: (a) => a.eigrpNbrs('r2').length === 2 && a.eigrpNbrs('r1').length === 1 && a.eigrpNbrs('r3').length === 1 },
      { text: 'R1 học 172.16.3.0/24 bằng EIGRP (D)', verify: 'show ip route eigrp', check: (a) => a.route('r1', '172.16.3.0/24')?.code === 'D' },
      { text: 'PC1 ping được PC3 và PC2', verify: 'ping', check: (a) => a.ping('pc1', '172.16.3.10') && a.ping('pc1', '172.16.2.10') },
    ],
    hints: ['router eigrp 100', 'network 172.16.1.0 0.0.0.255 và network 10.1.12.0 0.0.0.3', 'no auto-summary', 'Log %DUAL-5-NBRCHANGE ... new adjacency báo láng giềng đã lên.'],
    solution: [
      ['r1', cfg('router eigrp 100', 'network 172.16.1.0 0.0.0.255', 'network 10.1.12.0 0.0.0.3', 'no auto-summary', 'passive-interface g0/0')],
      ['r2', cfg('router eigrp 100', 'network 172.16.2.0 0.0.0.255', 'network 10.1.12.0 0.0.0.3', 'network 10.1.23.0 0.0.0.3', 'no auto-summary', 'passive-interface g0/0')],
      ['r3', cfg('router eigrp 100', 'network 172.16.3.0 0.0.0.255', 'network 10.1.23.0 0.0.0.3', 'no auto-summary', 'passive-interface g0/0')],
    ],
  },

  // ===================================================================== M04
  {
    id: 'L13', group: 'm04', lesson: 'Bài 16', lessonPath: P.b16, level: 2, kind: 'config',
    title: 'Standard ACL: chặn mạng Guest vào File Server',
    story: 'Mạng Wi-Fi khách (Guest 192.168.20.0/24) không được truy cập File Server (172.16.1.10), nhưng vẫn phải liên lạc được các nơi khác. Nhân viên (192.168.10.0/24) dùng bình thường. Dùng STANDARD ACL số 10 và đặt ĐÚNG VỊ TRÍ.',
    build: () => makeNet([
      router('rc', 'R-CORE', 500, 150, ['g0/0', 'g0/1', 'g0/2']),
      pc('staff', 'PC-STAFF', 170, 340, { ip: '192.168.10.10', gw: '192.168.10.1' }),
      pc('guest', 'PC-GUEST', 500, 370, { ip: '192.168.20.10', gw: '192.168.20.1' }),
      server('srv', 'SRV-FILE', 830, 340, { ip: '172.16.1.10', gw: '172.16.1.1', services: [445, 80] }),
    ], [['staff', 'fa0', 'rc', 'g0/0'], ['guest', 'fa0', 'rc', 'g0/1'], ['rc', 'g0/2', 'srv', 'fa0']]),
    init: [['rc', cfg('interface g0/0', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 192.168.20.1 255.255.255.0', 'no shutdown', 'interface g0/2', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown')]],
    tasks: [
      { text: 'Một ACL STANDARD (số 10 hoặc đặt tên) chặn 192.168.20.0/24, cho phép phần còn lại', verify: 'show access-lists', check: (a) => { const d = a.d('rc'); return Object.entries(d.acls).some(([n, x]) => x.type === 'standard' && N.aclEval(d, n, { src: '192.168.20.10' }).action === 'deny' && N.aclEval(d, n, { src: '192.168.10.10' }).action === 'permit'); } },
      { text: 'Áp ACL standard gần ĐÍCH: g0/2 chiều OUT', verify: 'show running-config | section interface', check: (a) => !!aclOn(a.d('rc'), 'g0/2', 'out', 'standard') },
      { text: 'PC-GUEST KHÔNG ping được SRV-FILE', verify: 'ping 172.16.1.10', check: (a) => !a.ping('guest', '172.16.1.10') },
      { text: 'PC-STAFF ping được SRV-FILE', verify: 'ping 172.16.1.10', check: (a) => a.ping('staff', '172.16.1.10') },
      { text: 'PC-GUEST VẪN ping được PC-STAFF (đặt ACL sai chỗ sẽ chặn nhầm cái này)', verify: 'ping 192.168.10.10', check: (a) => a.ping('guest', '192.168.10.10') },
    ],
    hints: ['access-list 10 deny 192.168.20.0 0.0.0.255', 'access-list 10 permit any (nếu quên: "deny any" ngầm định chặn hết!)', 'Standard ACL chỉ xét IP NGUỒN → đặt gần ĐÍCH: interface g0/2 → ip access-group 10 out', 'Xem bộ đếm: show access-lists'],
    solution: [['rc', cfg('access-list 10 deny 192.168.20.0 0.0.0.255', 'access-list 10 permit any', 'interface g0/2', 'ip access-group 10 out')]],
  },
  {
    id: 'L14', group: 'm04', lesson: 'Bài 17', lessonPath: P.b17, level: 3, kind: 'config',
    title: 'Extended ACL: Guest chỉ được dùng Web',
    story: 'Chính sách mới: khách (192.168.20.0/24) CHỈ được mở web (HTTP 80, HTTPS 443) trên SRV-WEB 172.16.1.10 — không ping, không SSH, không vào mạng nhân viên. Nhân viên không bị giới hạn. Dùng EXTENDED ACL (gợi ý đặt tên GUEST_IN) đặt gần NGUỒN.',
    build: () => makeNet([
      router('rc', 'R-CORE', 500, 150, ['g0/0', 'g0/1', 'g0/2']),
      pc('staff', 'PC-STAFF', 170, 340, { ip: '192.168.10.10', gw: '192.168.10.1' }),
      pc('guest', 'PC-GUEST', 500, 370, { ip: '192.168.20.10', gw: '192.168.20.1' }),
      server('srv', 'SRV-WEB', 830, 340, { ip: '172.16.1.10', gw: '172.16.1.1', services: [80, 443, 22] }),
    ], [['staff', 'fa0', 'rc', 'g0/0'], ['guest', 'fa0', 'rc', 'g0/1'], ['rc', 'g0/2', 'srv', 'fa0']]),
    init: [['rc', cfg('interface g0/0', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 192.168.20.1 255.255.255.0', 'no shutdown', 'interface g0/2', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown')]],
    tasks: [
      { text: 'Có extended ACL áp vào g0/1 chiều IN (gần nguồn)', verify: 'show access-lists', check: (a) => !!aclOn(a.d('rc'), 'g0/1', 'in', 'extended') },
      { text: 'Guest mở được web: telnet 172.16.1.10 80 và 443', verify: 'PC-GUEST: telnet 172.16.1.10 80', check: (a) => a.tcp('guest', '172.16.1.10', 80).ok && a.tcp('guest', '172.16.1.10', 443).ok },
      { text: 'Guest KHÔNG ping được và KHÔNG SSH (22) được vào server', verify: 'ping / telnet 172.16.1.10 22', check: (a) => !a.ping('guest', '172.16.1.10') && !a.tcp('guest', '172.16.1.10', 22).ok },
      { text: 'Guest KHÔNG vào được mạng nhân viên', verify: 'ping 192.168.10.10', check: (a) => !a.ping('guest', '192.168.10.10') },
      { text: 'Nhân viên vẫn ping & SSH được server', verify: 'PC-STAFF: telnet 172.16.1.10 22', check: (a) => a.ping('staff', '172.16.1.10') && a.tcp('staff', '172.16.1.10', 22).ok },
    ],
    hints: ['ip access-list extended GUEST_IN', 'permit tcp 192.168.20.0 0.0.0.255 host 172.16.1.10 eq www', 'permit tcp 192.168.20.0 0.0.0.255 host 172.16.1.10 eq 443', 'Mọi thứ khác bị "deny any" ngầm định; áp: interface g0/1 → ip access-group GUEST_IN in'],
    solution: [['rc', cfg('ip access-list extended GUEST_IN', 'permit tcp 192.168.20.0 0.0.0.255 host 172.16.1.10 eq www', 'permit tcp 192.168.20.0 0.0.0.255 host 172.16.1.10 eq 443', 'deny ip any any', 'exit', 'interface g0/1', 'ip access-group GUEST_IN in')]],
  },
  {
    id: 'L15', group: 'm04', lesson: 'Bài 18', lessonPath: P.b18, level: 1, kind: 'config',
    title: 'NTP & Syslog: đồng bộ giờ và tập trung log',
    story: 'Khi điều tra sự cố, log 2 router lệch giờ nhau 3 tiếng nên không ghép được dòng thời gian. Yêu cầu: R-HQ làm NTP master (stratum 3), R-BR đồng bộ theo R-HQ; cả 2 router gửi log về SRV-SYSLOG 192.168.1.50.',
    build: () => makeNet([
      router('rhq', 'R-HQ', 300, 150, ['g0/0', 's0/0/0']),
      router('rbr', 'R-BR', 700, 150, ['g0/0', 's0/0/0']),
      server('syslog', 'SRV-SYSLOG', 300, 350, { ip: '192.168.1.50', gw: '192.168.1.1', services: [514] }),
      pc('pcbr', 'PC-BR', 700, 350, { ip: '192.168.2.10', gw: '192.168.2.1' }),
    ], [['rhq', 's0/0/0', 'rbr', 's0/0/0'], ['rhq', 'g0/0', 'syslog', 'fa0'], ['rbr', 'g0/0', 'pcbr', 'fa0']]),
    init: [
      ['rhq', cfg('interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.0.12.1 255.255.255.252', 'clock rate 64000', 'no shutdown', 'ip route 192.168.2.0 255.255.255.0 10.0.12.2')],
      ['rbr', cfg('interface g0/0', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.0.12.2 255.255.255.252', 'no shutdown', 'ip route 192.168.1.0 255.255.255.0 10.0.12.1')],
    ],
    tasks: [
      { text: 'R-HQ là NTP master stratum 3', verify: 'show ntp status', check: (a) => a.d('rhq').ntp.master === 3 },
      { text: 'R-BR đồng bộ NTP theo R-HQ (10.0.12.1)', verify: 'show ntp status', check: (a) => a.d('rbr').ntp.servers.includes('10.0.12.1') && a.show('rbr', 'show ntp status')[0].startsWith('Clock is synchronized') },
      { text: 'Cả 2 router gửi log về 192.168.1.50', verify: 'show running-config | include logging', check: (a) => a.d('rhq').logging.includes('192.168.1.50') && a.d('rbr').logging.includes('192.168.1.50') },
      { text: 'R-BR tới được SRV-SYSLOG (ping từ router)', verify: 'ping 192.168.1.50', check: (a) => a.ping('rbr', '192.168.1.50') },
    ],
    hints: ['R-HQ: ntp master 3', 'R-BR: ntp server 10.0.12.1 → show ntp status phải "Clock is synchronized, stratum 4"', 'logging host 192.168.1.50 trên cả 2 router'],
    solution: [['rhq', cfg('ntp master 3', 'logging host 192.168.1.50')], ['rbr', cfg('ntp server 10.0.12.1', 'logging host 192.168.1.50')]],
  },
  {
    id: 'L16', group: 'm04', lesson: 'Bài 19', lessonPath: P.b19, level: 2, kind: 'config',
    title: 'DHCP server trên router + DHCP relay cho chi nhánh',
    story: 'Bỏ việc gán IP tay: R-HQ làm DHCP server cho cả HQ (192.168.10.0/24) và chi nhánh BR (192.168.20.0/24). 10 địa chỉ đầu mỗi dải dành cho thiết bị mạng/máy in (không cấp). Chi nhánh không có DHCP server riêng → R-BR phải relay.',
    build: () => makeNet([
      router('rhq', 'R-HQ', 300, 110, ['g0/0', 's0/0/0']),
      sw('swhq', 'SW-HQ', 300, 245, ports(4, ['g0/1'])),
      router('rbr', 'R-BR', 750, 110, ['g0/0', 's0/0/0']),
      pc('hq1', 'PC-HQ1', 170, 380, { dhcp: true }),
      pc('hq2', 'PC-HQ2', 430, 380, { dhcp: true }),
      pc('br', 'PC-BR', 750, 340, { dhcp: true }),
    ], [['rhq', 'g0/0', 'swhq', 'g0/1'], ['hq1', 'fa0', 'swhq', 'fa0/1'], ['hq2', 'fa0', 'swhq', 'fa0/2'], ['rhq', 's0/0/0', 'rbr', 's0/0/0'], ['rbr', 'g0/0', 'br', 'fa0']]),
    init: [
      ['rhq', cfg('interface g0/0', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.0.0.1 255.255.255.252', 'clock rate 64000', 'no shutdown', 'ip route 192.168.20.0 255.255.255.0 10.0.0.2')],
      ['rbr', cfg('interface g0/0', 'ip address 192.168.20.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.0.0.2 255.255.255.252', 'no shutdown', 'ip route 192.168.10.0 255.255.255.0 10.0.0.1')],
    ],
    tasks: [
      { text: 'Loại trừ .1–.10 của cả 2 dải', verify: 'show running-config | include excluded', check: (a) => a.excluded('rhq', '192.168.10.1', '192.168.10.10') && a.excluded('rhq', '192.168.20.1', '192.168.20.10') },
      { text: 'Pool cho 192.168.10.0/24: default-router .1, dns-server 8.8.8.8', verify: 'show ip dhcp pool', check: (a) => a.pool('rhq', '192.168.10.0', (p) => p.router === '192.168.10.1' && !!p.dns) },
      { text: 'Pool cho 192.168.20.0/24: default-router 192.168.20.1', verify: 'show ip dhcp pool', check: (a) => a.pool('rhq', '192.168.20.0', (p) => p.router === '192.168.20.1') },
      { text: 'R-BR g0/0 relay về R-HQ (ip helper-address 10.0.0.1)', verify: 'show running-config | section g0/0', check: (a) => a.d('rbr').ifaces['g0/0'].helper.includes('10.0.0.1') },
      { text: 'PC-HQ1 xin được IP ≥ .11 và gateway .1', verify: 'PC-HQ1: ipconfig /renew', check: (a) => { const r = a.dhcp('hq1'); return r.ok && N.inNet(r.ip, '192.168.10.0', 24) && +r.ip.split('.')[3] >= 11 && r.gw === '192.168.10.1'; } },
      { text: 'PC-BR (chi nhánh) xin được IP qua relay', verify: 'PC-BR: ipconfig /renew', check: (a) => { const r = a.dhcp('br'); return r.ok && N.inNet(r.ip, '192.168.20.0', 24) && +r.ip.split('.')[3] >= 11 && r.gw === '192.168.20.1'; } },
      { text: 'Sau khi các PC chạy "ipconfig /renew": PC-BR ping được PC-HQ1', verify: 'ping', check: (a) => !!a.d('hq1').ip && !!a.d('br').ip && N.inNet(a.d('br').ip, '192.168.20.0', 24) && a.ping('br', a.d('hq1').ip) },
    ],
    hints: ['ip dhcp excluded-address 192.168.10.1 192.168.10.10', 'ip dhcp pool LAN-HQ → network 192.168.10.0 255.255.255.0 → default-router 192.168.10.1 → dns-server 8.8.8.8', 'Router KHÔNG chuyển broadcast → trên R-BR: interface g0/0 → ip helper-address 10.0.0.1', 'Trên PC: ipconfig /renew rồi xem gói DORA bằng "Xem gói tin". Server: show ip dhcp binding'],
    solution: [
      ['rhq', cfg('ip dhcp excluded-address 192.168.10.1 192.168.10.10', 'ip dhcp excluded-address 192.168.20.1 192.168.20.10', 'ip dhcp pool LAN-HQ', 'network 192.168.10.0 255.255.255.0', 'default-router 192.168.10.1', 'dns-server 8.8.8.8', 'ip dhcp pool LAN-BR', 'network 192.168.20.0 255.255.255.0', 'default-router 192.168.20.1', 'dns-server 8.8.8.8')],
      ['rbr', cfg('interface g0/0', 'ip helper-address 10.0.0.1')],
      ['hq1', ['ipconfig /renew']], ['hq2', ['ipconfig /renew']], ['br', ['ipconfig /renew']],
    ],
  },
  {
    id: 'L17', group: 'm04', lesson: 'Bài 20', lessonPath: P.b20, level: 2, kind: 'config',
    title: 'NAT overload (PAT): cả văn phòng ra Internet bằng 1 IP public',
    story: 'Văn phòng dùng dải private 192.168.1.0/24. ISP chỉ cấp đúng 1 IP public 203.0.113.2 trên cổng g0/1 của R-EDGE và ISP KHÔNG có đường về dải private. Hãy cho mọi máy ra Internet (8.8.8.8) bằng PAT.',
    build: () => makeNet([
      router('redge', 'R-EDGE', 500, 120, ['g0/0', 'g0/1']),
      sw('swlan', 'SW-LAN', 250, 250, ports(4, ['g0/1'])),
      router('isp', 'ISP', 820, 120, ['g0/0', 'g0/1']),
      pc('pc1', 'PC1', 130, 380, { ip: '192.168.1.10', gw: '192.168.1.1' }),
      pc('pc2', 'PC2', 370, 380, { ip: '192.168.1.11', gw: '192.168.1.1' }),
      server('inet', 'INTERNET 8.8.8.8', 820, 340, { ip: '8.8.8.8', gw: '8.8.8.1' }),
    ], [['redge', 'g0/0', 'swlan', 'g0/1'], ['pc1', 'fa0', 'swlan', 'fa0/1'], ['pc2', 'fa0', 'swlan', 'fa0/2'], ['redge', 'g0/1', 'isp', 'g0/1'], ['isp', 'g0/0', 'inet', 'fa0']]),
    init: [
      ['isp', cfg('interface g0/0', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.1 255.255.255.252', 'no shutdown')],
      ['redge', cfg('interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.2 255.255.255.252', 'no shutdown')],
    ],
    tasks: [
      { text: 'R-EDGE có default route tới ISP', verify: 'show ip route', check: (a) => a.route('redge', '0.0.0.0/0')?.nextHop === '203.0.113.1' },
      { text: 'g0/0 là "ip nat inside", g0/1 là "ip nat outside"', verify: 'show ip nat statistics', check: (a) => a.d('redge').ifaces['g0/0'].nat === 'inside' && a.d('redge').ifaces['g0/1'].nat === 'outside' },
      { text: 'Quy tắc PAT: ACL cho 192.168.1.0/24 + overload (trên cổng g0/1)', verify: 'show running-config | include nat', check: (a) => a.d('redge').nat.dyn.some((r) => (r.iface === 'g0/1' || r.overload) && N.aclEval(a.d('redge'), r.acl, { src: '192.168.1.10', dst: '8.8.8.8', proto: 'icmp' }).action === 'permit') },
      { text: 'PC1 và PC2 ping được 8.8.8.8', verify: 'ping 8.8.8.8 rồi show ip nat translations', check: (a) => a.ping('pc1', '8.8.8.8') && a.ping('pc2', '8.8.8.8') },
      { text: 'Ràng buộc: không "gian lận" bằng cách thêm route trên ISP', verify: '—', check: (a) => a.d('isp').routes.length === 0 },
    ],
    hints: ['ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'access-list 1 permit 192.168.1.0 0.0.0.255', 'interface g0/0 → ip nat inside ; interface g0/1 → ip nat outside', 'ip nat inside source list 1 interface g0/1 overload → ping rồi show ip nat translations'],
    solution: [['redge', cfg('ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'access-list 1 permit 192.168.1.0 0.0.0.255', 'interface g0/0', 'ip nat inside', 'interface g0/1', 'ip nat outside', 'exit', 'ip nat inside source list 1 interface g0/1 overload')]],
  },
  {
    id: 'L18', group: 'm04', lesson: 'Bài 20', lessonPath: P.b20, level: 2, kind: 'config',
    title: 'Static NAT: công bố Web server ra Internet',
    story: 'Website công ty chạy trên SRV-WEB 192.168.100.10 (private). ISP cấp dải public 203.0.113.0/28; dùng 203.0.113.10 làm địa chỉ public của web. Khách hàng ngoài Internet (PC-KHACH) phải mở được web qua IP public.',
    build: () => makeNet([
      server('web', 'SRV-WEB', 170, 340, { ip: '192.168.100.10', gw: '192.168.100.1', services: [80, 443] }),
      router('redge', 'R-EDGE', 400, 150, ['g0/0', 'g0/1']),
      router('isp', 'ISP', 680, 150, ['g0/0', 'g0/1']),
      pc('khach', 'PC-KHACH', 860, 340, { ip: '198.51.100.50', gw: '198.51.100.1' }),
    ], [['web', 'fa0', 'redge', 'g0/0'], ['redge', 'g0/1', 'isp', 'g0/1'], ['isp', 'g0/0', 'khach', 'fa0']]),
    init: [
      ['isp', cfg('interface g0/0', 'ip address 198.51.100.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.1 255.255.255.240', 'no shutdown')],
      ['redge', cfg('interface g0/0', 'ip address 192.168.100.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.2 255.255.255.240', 'no shutdown', 'ip route 0.0.0.0 0.0.0.0 203.0.113.1')],
    ],
    tasks: [
      { text: 'Đánh dấu cổng inside (g0/0) / outside (g0/1)', verify: 'show ip nat statistics', check: (a) => a.d('redge').ifaces['g0/0'].nat === 'inside' && a.d('redge').ifaces['g0/1'].nat === 'outside' },
      { text: 'NAT tĩnh 192.168.100.10 ↔ 203.0.113.10', verify: 'show ip nat translations', check: (a) => a.d('redge').nat.statics.some((s) => s.local === '192.168.100.10' && s.global === '203.0.113.10') },
      { text: 'PC-KHACH mở được web: telnet 203.0.113.10 80', verify: 'PC-KHACH: telnet 203.0.113.10 80', check: (a) => a.tcp('khach', '203.0.113.10', 80).ok },
      { text: 'Từ Internet KHÔNG tới thẳng được địa chỉ private 192.168.100.10', verify: 'ping 192.168.100.10', check: (a) => !a.ping('khach', '192.168.100.10') },
      { text: 'Ràng buộc: không thêm route trên ISP', verify: '—', check: (a) => a.d('isp').routes.length === 0 },
    ],
    hints: ['interface g0/0 → ip nat inside; interface g0/1 → ip nat outside', 'ip nat inside source static 192.168.100.10 203.0.113.10', 'Vì 203.0.113.10 nằm trong subnet cổng outside, router sẽ tự trả lời ARP thay cho địa chỉ này (xem gói tin!).'],
    solution: [['redge', cfg('interface g0/0', 'ip nat inside', 'interface g0/1', 'ip nat outside', 'exit', 'ip nat inside source static 192.168.100.10 203.0.113.10')]],
  },

  // ===================================================================== M05–06
  {
    id: 'L19', group: 'm05', lesson: 'Bài 21', lessonPath: P.b21, level: 3, kind: 'config',
    title: 'HSRP: gateway dự phòng cho VLAN văn phòng',
    story: 'Văn phòng (10.10.0.0/27) có 2 router R-HQ-1 (.1) và R-HQ-2 (.2), OSPF với R-CORE đã chạy. PC dùng gateway ẢO 10.10.0.3 (hiện chưa ai giữ → mất mạng). Yêu cầu: HSRP group 10, R-HQ-1 là Active (priority 110, preempt); tắt R-HQ-1 thì R-HQ-2 phải gánh ngay.',
    build: () => makeNet([
      sw('swo', 'SW-OFFICE', 210, 220, ['fa0/1', 'fa0/2', 'fa0/23', 'fa0/24']),
      router('h1', 'R-HQ-1', 460, 100, ['g0/0', 'g0/1']),
      router('h2', 'R-HQ-2', 460, 340, ['g0/0', 'g0/1']),
      router('core', 'R-CORE', 710, 220, ['g0/0', 'g0/1', 'g0/2']),
      pc('o1', 'PC-OFFICE1', 80, 380, { ip: '10.10.0.10', prefix: 27, gw: '10.10.0.3' }),
      pc('o2', 'PC-OFFICE2', 300, 400, { ip: '10.10.0.11', prefix: 27, gw: '10.10.0.3' }),
      server('app', 'SRV-APP', 900, 220, { ip: '172.16.0.10', gw: '172.16.0.1' }),
    ], [['o1', 'fa0', 'swo', 'fa0/1'], ['o2', 'fa0', 'swo', 'fa0/2'], ['swo', 'fa0/23', 'h1', 'g0/0'], ['swo', 'fa0/24', 'h2', 'g0/0'], ['h1', 'g0/1', 'core', 'g0/1'], ['h2', 'g0/1', 'core', 'g0/2'], ['core', 'g0/0', 'app', 'fa0']]),
    init: [
      ['h1', cfg('interface g0/0', 'ip address 10.10.0.1 255.255.255.224', 'no shutdown', 'interface g0/1', 'ip address 10.0.1.2 255.255.255.252', 'no shutdown', 'router ospf 1', 'router-id 1.1.1.1', 'network 10.10.0.0 0.0.0.31 area 0', 'network 10.0.1.0 0.0.0.3 area 0')],
      ['h2', cfg('interface g0/0', 'ip address 10.10.0.2 255.255.255.224', 'no shutdown', 'interface g0/1', 'ip address 10.0.2.2 255.255.255.252', 'no shutdown', 'router ospf 1', 'router-id 2.2.2.2', 'network 10.10.0.0 0.0.0.31 area 0', 'network 10.0.2.0 0.0.0.3 area 0')],
      ['core', cfg('interface g0/0', 'ip address 172.16.0.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.1.1 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 10.0.2.1 255.255.255.252', 'no shutdown', 'router ospf 1', 'router-id 3.3.3.3', 'network 172.16.0.0 0.0.0.255 area 0', 'network 10.0.1.0 0.0.0.3 area 0', 'network 10.0.2.0 0.0.0.3 area 0')],
    ],
    tasks: [
      { text: 'Cả 2 router: standby 10 ip 10.10.0.3 trên g0/0', verify: 'show standby brief', check: (a) => ['h1', 'h2'].every((r) => a.d(r).ifaces['g0/0'].standby['10']?.ip === '10.10.0.3') },
      { text: 'R-HQ-1 priority > 100 và preempt → là Active', verify: 'show standby brief', check: (a) => (a.d('h1').ifaces['g0/0'].standby['10']?.priority ?? 100) > 100 && !!a.d('h1').ifaces['g0/0'].standby['10']?.preempt && a.hsrpActive('h1', 'g0/0', '10') === 'h1' },
      { text: 'PC-OFFICE1 ping được SRV-APP 172.16.0.10', verify: 'ping 172.16.0.10', check: (a) => a.ping('o1', '172.16.0.10') },
      { text: 'Giả lập tắt R-HQ-1 (g0/0 shutdown) → PC vẫn ping được SRV-APP', verify: 'R-HQ-1: interface g0/0 → shutdown rồi ping lại', check: (a) => a.whatIf((n) => { n.devices.h1.ifaces['g0/0'].shutdown = true; }, (b) => b.ping('o1', '172.16.0.10')) },
    ],
    hints: ['interface g0/0 → standby 10 ip 10.10.0.3 (trên CẢ 2 router, VIP phải giống hệt)', 'R-HQ-1: standby 10 priority 110 → standby 10 preempt', 'Xem log %HSRP-6-STATECHANGE và show standby brief', '"Xem gói tin" để thấy ARP trả về MAC ảo 0000.0c07.ac0a'],
    solution: [['h1', cfg('interface g0/0', 'standby 10 ip 10.10.0.3', 'standby 10 priority 110', 'standby 10 preempt')], ['h2', cfg('interface g0/0', 'standby 10 ip 10.10.0.3')]],
  },
  {
    id: 'L20', group: 'm05', lesson: 'Bài 26', lessonPath: P.b26, level: 3, kind: 'config',
    title: 'Bảo mật lớp 2: Port Security + DHCP Snooping',
    story: 'Kiểm toán bảo mật phát hiện nhân viên tự cắm switch/router Wi-Fi cá nhân vào cổng tường. Yêu cầu trên SW-ACC: cổng người dùng Fa0/1–2 tối đa 2 MAC, học sticky, vi phạm thì restrict; bật DHCP snooping cho VLAN 10, chỉ tin cổng uplink g0/1 (về DHCP server R-GW).',
    build: () => makeNet([
      router('rgw', 'R-GW', 500, 90, ['g0/0']),
      sw('swa', 'SW-ACC', 500, 235, ports(4, ['g0/1'])),
      pc('nv1', 'PC-NV1', 300, 380, { dhcp: true }),
      pc('nv2', 'PC-NV2', 700, 380, { dhcp: true }),
    ], [['rgw', 'g0/0', 'swa', 'g0/1'], ['nv1', 'fa0', 'swa', 'fa0/1'], ['nv2', 'fa0', 'swa', 'fa0/2']]),
    init: [
      ['rgw', cfg('interface g0/0', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'ip dhcp excluded-address 192.168.10.1 192.168.10.10', 'ip dhcp pool STAFF', 'network 192.168.10.0 255.255.255.0', 'default-router 192.168.10.1')],
      ['swa', cfg('vlan 10', 'name STAFF', 'exit', 'interface range fa0/1 - 2', 'switchport mode access', 'switchport access vlan 10', 'interface g0/1', 'switchport mode access', 'switchport access vlan 10')],
    ],
    tasks: [
      { text: 'Fa0/1–2: port-security, maximum 2, mac-address sticky, violation restrict', verify: 'show port-security interface fa0/1', check: (a) => ['fa0/1', 'fa0/2'].every((n) => { const ps = a.d('swa').ports[n].ps; return ps && ps.enabled && ps.max === 2 && ps.sticky && ps.violation === 'restrict'; }) },
      { text: 'DHCP snooping bật toàn cục + VLAN 10', verify: 'show ip dhcp snooping', check: (a) => a.d('swa').snoop.enabled && a.d('swa').snoop.vlans.includes(10) },
      { text: 'Chỉ cổng uplink g0/1 là trusted → PC vẫn xin được IP', verify: 'PC-NV1: ipconfig /renew', check: (a) => a.d('swa').ports['g0/1'].trust && !a.d('swa').ports['fa0/1'].trust && a.dhcp('nv1').ok },
      { text: 'PC-NV1 có IP (đã ipconfig /renew) và ping được gateway; MAC đã được "dán" sticky', verify: 'show port-security interface fa0/1', check: (a) => !!a.d('nv1').ip && a.ping('nv1', '192.168.10.1') && a.d('swa').ports['fa0/1'].ps?.macs.length >= 1 },
    ],
    hints: ['Port-security chỉ cấu hình được trên cổng đã "switchport mode access" (thử trên cổng dynamic sẽ bị từ chối).', 'switchport port-security → maximum 2 → mac-address sticky → violation restrict', 'ip dhcp snooping ; ip dhcp snooping vlan 10 ; interface g0/1 → ip dhcp snooping trust', 'Bật snooping mà QUÊN trust uplink → PC không nhận được IP (thử xem gói tin!).'],
    solution: [
      ['swa', cfg('interface range fa0/1 - 2', 'switchport port-security', 'switchport port-security maximum 2', 'switchport port-security mac-address sticky', 'switchport port-security violation restrict', 'exit', 'ip dhcp snooping', 'ip dhcp snooping vlan 10', 'interface g0/1', 'ip dhcp snooping trust')],
      ['nv1', ['ipconfig /renew', 'ping 192.168.10.1']], ['nv2', ['ipconfig /renew']],
    ],
  },

  // ===================================================================== TICKETS
  {
    id: 'T01', group: 'tk', topics: ['VLAN/Trunk'], lesson: 'Lab CCNA 04', lessonPath: P.t04, level: 2, kind: 'ticket',
    title: 'Ticket #4471 — Thay switch xong, phòng Kế toán mất mạng',
    story: '🎫 Ticket #4471 (Ưu tiên: Cao). Sáng nay đội hạ tầng thay switch tầng Kế toán (SW-EDGE-NEW) do switch cũ hỏng nguồn. Sau khi thay, TOÀN BỘ máy phòng Kế toán (VLAN 30) không vào được mạng, gán tay IP đúng dải cũng không ping được gateway. Các phòng khác bình thường. Đội thi công khẳng định "đã copy y nguyên cấu hình switch cũ". → Tìm TẤT CẢ nguyên nhân, sửa tối thiểu, không đổi VLAN/port.',
    build: () => makeNet([
      router('rcore', 'R-CORE', 500, 80, ['g0/0']),
      sw('swcore', 'SW-CORE', 500, 200, ['fa0/1', 'fa0/2', 'g0/1']),
      sw('swedge', 'SW-EDGE-NEW', 300, 320, ['fa0/1', 'fa0/5']),
      pc('kt', 'PC-KETOAN', 300, 420, { ip: '192.168.30.10', gw: '192.168.30.1' }),
      pc('sales', 'PC-SALES', 720, 330, { ip: '192.168.10.10', gw: '192.168.10.1' }),
    ], [['rcore', 'g0/0', 'swcore', 'g0/1'], ['swcore', 'fa0/1', 'swedge', 'fa0/1'], ['swcore', 'fa0/2', 'sales', 'fa0'], ['swedge', 'fa0/5', 'kt', 'fa0']]),
    init: [
      ['rcore', cfg('interface g0/0', 'no shutdown', 'interface g0/0.10', 'encapsulation dot1Q 10', 'ip address 192.168.10.1 255.255.255.0', 'interface g0/0.20', 'encapsulation dot1Q 20', 'ip address 192.168.20.1 255.255.255.0', 'interface g0/0.30', 'encapsulation dot1Q 30', 'ip address 192.168.30.1 255.255.255.0', 'interface g0/0.40', 'encapsulation dot1Q 40', 'ip address 192.168.40.1 255.255.255.0')],
      ['swcore', cfg('vlan 10', 'name SALES', 'vlan 20', 'name GUEST', 'vlan 30', 'name KETOAN', 'vlan 40', 'name IT', 'exit', 'interface g0/1', 'switchport mode trunk', 'interface fa0/1', 'switchport mode trunk', 'interface fa0/2', 'switchport mode access', 'switchport access vlan 10')],
      ['swedge', cfg('hostname SW-EDGE-NEW', 'vtp mode client', 'interface fa0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20,40', 'interface fa0/5', 'switchport mode access', 'switchport access vlan 30')],
    ],
    tasks: [
      { text: 'PC-KETOAN ping được gateway 192.168.30.1', verify: 'ping 192.168.30.1', check: (a) => a.ping('kt', '192.168.30.1') },
      { text: 'VLAN 30 (tên KETOAN) tồn tại trên SW-EDGE-NEW', verify: 'show vlan brief', check: (a) => a.d('swedge').vlans[30] === 'KETOAN' },
      { text: 'Trunk Fa0/1 cho phép thêm VLAN 30 và VẪN giữ 10,20,40', verify: 'show interfaces trunk', check: (a) => { const al = a.d('swedge').ports['fa0/1'].allowed; return al == null || [10, 20, 30, 40].every((v) => al.includes(v)); } },
      { text: 'Ràng buộc: Fa0/5 vẫn là access VLAN 30 (không né lỗi bằng đổi VLAN)', verify: 'show vlan brief', check: (a) => a.d('swedge').ports['fa0/5'].vlan === 30 },
      { text: 'Phòng Sales vẫn hoạt động bình thường', verify: 'PC-SALES: ping 192.168.10.1', check: (a) => a.ping('sales', '192.168.10.1') },
    ],
    hints: ['Đi từ Lớp 1 lên: show interfaces status → cổng có connected không? Vlan có dấu * không?', 'show vlan brief: VLAN 30 có tồn tại trên switch MỚI không? Vì sao gõ "vlan 30" lại bị từ chối? (show vtp status)', 'show interfaces trunk: VLAN nào đang được phép qua Fa0/1?', 'Bài học: VLAN database KHÔNG nằm trong running-config (trừ VTP transparent) → "copy y nguyên config" không mang VLAN theo.'],
    solution: [['swedge', cfg('vtp mode transparent', 'vlan 30', 'name KETOAN', 'exit', 'interface fa0/1', 'switchport trunk allowed vlan add 30')]],
  },
  {
    id: 'T02', group: 'tk', lesson: 'Lab CCNA 05', lessonPath: P.t05, level: 3, kind: 'ticket',
    title: 'Ticket #4502 — OSPF lên Full mà chi nhánh không ra được Internet',
    story: '🎫 Ticket #4502 (Ưu tiên: Cao). Store B báo không mở được bất kỳ website nào. Máy vẫn ping được server nội bộ ở HQ; "show ip ospf neighbor" trên R-STOREB thấy HQ ở trạng thái FULL. Nhưng ping 8.8.8.8 từ Store B thì timeout. Gợi ý: có HƠN 1 lỗi. Ràng buộc: không thêm static route trên R-STOREB, không đổi cơ chế NAT (vẫn list + overload).',
    build: () => makeNet([
      router('rhq', 'R-HQ', 450, 130, ['g0/0', 's0/0/1', 's0/1/1']),
      router('rsb', 'R-STOREB', 160, 130, ['g0/0', 's0/0/0']),
      router('isp', 'ISP', 780, 130, ['g0/0', 's0/0/1']),
      pc('office', 'PC-OFFICE', 450, 350, { ip: '10.10.0.10', prefix: 27, gw: '10.10.0.1' }),
      pc('sb', 'PC-STOREB', 160, 350, { ip: '10.10.2.5', prefix: 28, gw: '10.10.2.1' }),
      server('inet', 'INTERNET 8.8.8.8', 780, 350, { ip: '8.8.8.8', gw: '8.8.8.1' }),
    ], [['rhq', 's0/1/1', 'rsb', 's0/0/0'], ['rhq', 's0/0/1', 'isp', 's0/0/1'], ['rhq', 'g0/0', 'office', 'fa0'], ['rsb', 'g0/0', 'sb', 'fa0'], ['isp', 'g0/0', 'inet', 'fa0']]),
    init: [
      ['isp', cfg('interface g0/0', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown', 'interface s0/0/1', 'ip address 10.10.0.82 255.255.255.252', 'no shutdown')],
      ['rhq', cfg('interface g0/0', 'ip address 10.10.0.1 255.255.255.224', 'ip nat inside', 'no shutdown', 'interface s0/1/1', 'ip address 10.10.0.77 255.255.255.252', 'ip nat inside', 'clock rate 64000', 'no shutdown', 'interface s0/0/1', 'ip address 10.10.0.81 255.255.255.252', 'ip nat outside', 'no shutdown', 'router ospf 1', 'network 10.10.0.0 0.0.0.31 area 0', 'network 10.10.0.72 0.0.0.3 area 0', 'network 10.10.0.76 0.0.0.3 area 0', 'exit', 'ip route 0.0.0.0 0.0.0.0 10.10.0.82', 'access-list 1 permit 10.10.0.0 0.0.0.255', 'ip nat inside source list 1 interface s0/0/1 overload')],
      ['rsb', cfg('hostname R-STOREB', 'interface g0/0', 'ip address 10.10.2.1 255.255.255.240', 'no shutdown', 'interface s0/0/0', 'ip address 10.10.0.78 255.255.255.252', 'no shutdown', 'router ospf 1', 'network 10.10.2.0 0.0.0.15 area 0', 'network 10.10.0.76 0.0.0.3 area 0')],
    ],
    tasks: [
      { text: 'R-STOREB có 0.0.0.0/0 học qua OSPF (O*E2)', verify: 'R-STOREB: show ip route', check: (a) => a.route('rsb', '0.0.0.0/0')?.code === 'O*E2' },
      { text: 'PC-STOREB ping được 8.8.8.8', verify: 'ping 8.8.8.8 + R-HQ: show ip nat translations', check: (a) => a.ping('sb', '8.8.8.8') },
      { text: 'PC-OFFICE (HQ) vẫn ra Internet bình thường', verify: 'ping 8.8.8.8', check: (a) => a.ping('office', '8.8.8.8') },
      { text: 'Ràng buộc: R-STOREB không có static route', verify: 'show running-config | include ip route', check: (a) => a.d('rsb').routes.length === 0 },
      { text: 'Ràng buộc: NAT vẫn dùng access-list + overload trên s0/0/1', verify: 'show running-config | include nat', check: (a) => a.d('rhq').nat.dyn.some((r) => r.iface === 's0/0/1') },
    ],
    hints: ['Neighbor FULL chỉ chứng minh 2 router trao đổi được thông tin — KHÔNG chứng minh default route đã được quảng bá. Kiểm tra show ip route trên R-STOREB.', 'R-HQ có default route tĩnh, nhưng đã "đẩy" nó vào OSPF chưa? (show run | section ospf)', 'Sau khi có route mà vẫn timeout: so dải trong show access-lists 1 với dải LAN Store B (10.10.2.0/28).', '"Xem gói tin" ở R-HQ: gói Store B đi ra ISP với IP private → không có đường về.'],
    solution: [['rhq', cfg('router ospf 1', 'default-information originate', 'exit', 'access-list 1 permit 10.10.2.0 0.0.0.15')]],
  },
  {
    id: 'T03', group: 'tk', lesson: 'Lab CCNA 06', lessonPath: P.t06, level: 3, kind: 'ticket',
    title: 'Ticket #4588 — HSRP không failover + Partner bị chặn',
    story: '🎫 Ticket #4588 (Khẩn cấp). (a) Tắt R-HQ-1 để bảo trì thì TOÀN BỘ VLAN OFFICE mất mạng — R-HQ-2 không "gánh" thay dù đã cấu hình HSRP. (b) Partner (192.168.40.0/24) không mở được web nội bộ 192.168.100.10; đội mạng nói "đã thêm dòng permit vào cuối ACL rồi". Ràng buộc: giữ VIP 10.10.0.3; không xoá viết lại toàn bộ ACL PARTNER_IN.',
    build: () => makeNet([
      sw('swo', 'SW-OFFICE', 200, 220, ['fa0/1', 'fa0/23', 'fa0/24']),
      router('h1', 'R-HQ-1', 450, 100, ['g0/0', 'g0/1', 'g0/2']),
      router('h2', 'R-HQ-2', 450, 340, ['g0/0', 'g0/1']),
      router('core', 'R-CORE', 700, 220, ['g0/0', 'g0/1', 'g0/2']),
      pc('office', 'PC-OFFICE', 70, 380, { ip: '10.10.0.10', prefix: 27, gw: '10.10.0.3' }),
      pc('partner', 'PC-PARTNER', 700, 60, { ip: '192.168.40.10', gw: '192.168.40.1' }),
      server('web', 'SRV-WEB', 900, 300, { ip: '192.168.100.10', gw: '192.168.100.1', services: [80, 443] }),
    ], [['office', 'fa0', 'swo', 'fa0/1'], ['swo', 'fa0/23', 'h1', 'g0/0'], ['swo', 'fa0/24', 'h2', 'g0/0'], ['h1', 'g0/1', 'core', 'g0/1'], ['h2', 'g0/1', 'core', 'g0/2'], ['core', 'g0/0', 'web', 'fa0'], ['h1', 'g0/2', 'partner', 'fa0']]),
    init: [
      ['h1', cfg('interface g0/0', 'ip address 10.10.0.1 255.255.255.224', 'standby 10 ip 10.10.0.3', 'standby 10 priority 110', 'standby 10 preempt', 'no shutdown', 'interface g0/1', 'ip address 10.0.1.2 255.255.255.252', 'no shutdown', 'interface g0/2', 'description PARTNER', 'ip address 192.168.40.1 255.255.255.0', 'ip access-group PARTNER_IN in', 'no shutdown', 'ip access-list extended PARTNER_IN', 'permit eigrp host 172.16.1.10 host 224.0.0.10', 'permit eigrp host 172.16.1.10 host 172.16.1.9', 'deny ip any any log', 'permit tcp 192.168.40.0 0.0.0.255 host 192.168.100.10 eq www', 'permit tcp 192.168.40.0 0.0.0.255 host 192.168.100.10 eq 443', 'exit', 'router ospf 1', 'router-id 1.1.1.1', 'network 10.10.0.0 0.0.0.31 area 0', 'network 10.0.1.0 0.0.0.3 area 0', 'network 192.168.40.0 0.0.0.255 area 0', 'passive-interface g0/2')],
      ['h2', cfg('interface g0/0', 'ip address 10.10.0.2 255.255.255.224', 'standby 10 ip 10.10.0.30', 'standby 10 priority 100', 'no shutdown', 'interface g0/1', 'ip address 10.0.2.2 255.255.255.252', 'no shutdown', 'router ospf 1', 'router-id 2.2.2.2', 'network 10.10.0.0 0.0.0.31 area 0', 'network 10.0.2.0 0.0.0.3 area 0')],
      ['core', cfg('interface g0/0', 'ip address 192.168.100.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.1.1 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 10.0.2.1 255.255.255.252', 'no shutdown', 'router ospf 1', 'router-id 3.3.3.3', 'network 192.168.100.0 0.0.0.255 area 0', 'network 10.0.1.0 0.0.0.3 area 0', 'network 10.0.2.0 0.0.0.3 area 0')],
    ],
    tasks: [
      { text: '(a) R-HQ-2 dùng đúng VIP 10.10.0.3', verify: 'show standby brief (cả 2 router)', check: (a) => a.d('h2').ifaces['g0/0'].standby['10']?.ip === '10.10.0.3' && a.d('h1').ifaces['g0/0'].standby['10']?.ip === '10.10.0.3' },
      { text: '(a) Tắt R-HQ-1 (g0/0 shutdown) → PC-OFFICE vẫn tới SRV-WEB', verify: 'ping 192.168.100.10', check: (a) => a.ping('office', '192.168.100.10') && a.whatIf((n) => { n.devices.h1.ifaces['g0/0'].shutdown = true; }, (b) => b.ping('office', '192.168.100.10')) },
      { text: '(b) Partner mở được web: telnet 192.168.100.10 80 và 443', verify: 'PC-PARTNER: telnet 192.168.100.10 80', check: (a) => a.tcp('partner', '192.168.100.10', 80).ok && a.tcp('partner', '192.168.100.10', 443).ok },
      { text: '(b) Partner vẫn bị chặn ping (deny ip any any còn hiệu lực)', verify: 'ping 192.168.100.10', check: (a) => !a.ping('partner', '192.168.100.10') },
      { text: 'Ràng buộc: ACL vẫn còn 2 dòng eigrp và dòng deny ip any any (không viết lại từ đầu)', verify: 'show access-lists PARTNER_IN', check: (a) => { const e = a.d('h1').acls.PARTNER_IN?.entries || []; return e.filter((x) => x.proto === 'eigrp').length === 2 && e.some((x) => x.action === 'deny' && x.proto === 'ip' && x.src.any && x.dst.any); } },
    ],
    hints: ['show standby brief trên CẢ 2 router — cột Virtual IP có giống nhau không? (show standby trên R-HQ-2 còn báo %HSRP-4-DIFFVIP1)', 'Priority chỉ quyết định ai thắng khi cả 2 cùng hoạt động; VIP sai thì router dự phòng "đứng" cho một địa chỉ khác.', 'ACL xử lý TỪ TRÊN XUỐNG, dừng ở dòng khớp đầu tiên: dòng nằm SAU "deny ip any any" không bao giờ được xét.', 'Chèn dòng bằng số thứ tự: ip access-list extended PARTNER_IN → 25 permit tcp ... (xem số dòng bằng show access-lists).'],
    solution: [
      ['h2', cfg('interface g0/0', 'standby 10 ip 10.10.0.3')],
      ['h1', cfg('ip access-list extended PARTNER_IN', 'no 40', 'no 50', '25 permit tcp 192.168.40.0 0.0.0.255 host 192.168.100.10 eq www', '26 permit tcp 192.168.40.0 0.0.0.255 host 192.168.100.10 eq 443')],
    ],
  },
  {
    id: 'T04', group: 'tk', lesson: 'Bài 14', lessonPath: P.b14, level: 2, kind: 'ticket',
    title: 'Ticket #4620 — Chi nhánh mới "đã cấu hình OSPF" nhưng không lên',
    story: '🎫 Ticket #4620. Chi nhánh 3 vừa đấu nối đường serial về HQ. Đội triển khai báo "đã cấu hình OSPF xong theo mẫu" nhưng show ip ospf neighbor trống trơn, PC chi nhánh không vào được hệ thống HQ. Chính sách: cổng LAN chi nhánh phải passive.',
    build: () => makeNet([
      router('rhq', 'R-HQ', 300, 130, ['g0/0', 's0/0/0']),
      router('rb3', 'R-BR3', 700, 130, ['g0/0', 's0/0/0']),
      pc('pchq', 'PC-HQ', 300, 350, { ip: '10.1.0.10', gw: '10.1.0.1' }),
      pc('pcb3', 'PC-BR3', 700, 350, { ip: '10.1.3.10', gw: '10.1.3.1' }),
    ], [['rhq', 's0/0/0', 'rb3', 's0/0/0'], ['rhq', 'g0/0', 'pchq', 'fa0'], ['rb3', 'g0/0', 'pcb3', 'fa0']]),
    init: [
      ['rhq', cfg('interface g0/0', 'ip address 10.1.0.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.255.0.1 255.255.255.252', 'clock rate 128000', 'no shutdown', 'router ospf 1', 'router-id 1.1.1.1', 'network 10.1.0.0 0.0.0.255 area 0', 'network 10.255.0.0 0.0.0.3 area 0', 'passive-interface g0/0')],
      ['rb3', cfg('interface g0/0', 'ip address 10.1.3.1 255.255.255.0', 'no shutdown', 'interface s0/0/0', 'ip address 10.255.0.2 255.255.255.252', 'no shutdown', 'router ospf 1', 'router-id 3.3.3.3', 'passive-interface default', 'network 10.1.3.0 0.0.0.255 area 0', 'network 10.255.0.0 0.0.0.3 area 1')],
    ],
    tasks: [
      { text: 'R-BR3 thấy R-HQ là láng giềng FULL', verify: 'show ip ospf neighbor', check: (a) => a.nbrs('rb3').some((n) => n.dev === 'rhq') },
      { text: 'R-HQ học được 10.1.3.0/24 (O)', verify: 'R-HQ: show ip route ospf', check: (a) => a.route('rhq', '10.1.3.0/24')?.code === 'O' },
      { text: 'PC-BR3 ping được PC-HQ', verify: 'ping 10.1.0.10', check: (a) => a.ping('pcb3', '10.1.0.10') },
      { text: 'Chính sách: g0/0 của R-BR3 vẫn passive', verify: 'show ip protocols', check: (a) => a.ospfIf('rb3', 'g0/0')?.passive === true },
    ],
    hints: ['show ip ospf interface brief trên R-BR3: cổng serial đang ở area nào? So với R-HQ.', 'show ip protocols: mục "Passive Interface(s)" có cả cổng WAN không?', 'passive-interface default chặn hello trên MỌI cổng → cần "no passive-interface s0/0/0".'],
    solution: [['rb3', cfg('router ospf 1', 'no network 10.255.0.0 0.0.0.3 area 1', 'network 10.255.0.0 0.0.0.3 area 0', 'no passive-interface s0/0/0')]],
  },
  {
    id: 'T05', group: 'tk', topics: ['VLAN/Trunk'], lesson: 'Bài 12', lessonPath: P.b12, level: 2, kind: 'ticket',
    title: 'Ticket #4655 — Phòng Kỹ thuật mất kết nối sau bảo trì',
    story: '🎫 Ticket #4655. Sau đợt bảo trì cuối tuần (thay cáp, "dọn dẹp" cấu hình), phòng Kỹ thuật (VLAN 20, 192.168.20.0/24) không ping được gateway 192.168.20.1. Phòng Nhân sự (VLAN 10) bình thường. Có thể có nhiều hơn 1 lỗi.',
    build: () => makeNet([
      router('rcore', 'R-CORE', 500, 90, ['g0/0', 'g0/1']),
      sw('swcore', 'SW-CORE', 500, 230, ports(4, ['g0/1'])),
      pc('hr', 'PC-NHANSU', 300, 380, { ip: '192.168.10.10', gw: '192.168.10.1' }),
      pc('kt', 'PC-KYTHUAT', 700, 380, { ip: '192.168.20.10', gw: '192.168.20.1' }),
    ], [['rcore', 'g0/0', 'swcore', 'g0/1'], ['hr', 'fa0', 'swcore', 'fa0/1'], ['kt', 'fa0', 'swcore', 'fa0/2']]),
    init: [
      ['swcore', cfg('vlan 10', 'name NHANSU', 'vlan 20', 'name KYTHUAT', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'interface g0/1', 'switchport mode trunk')],
      ['rcore', cfg('interface g0/0', 'no shutdown', 'interface g0/0.10', 'encapsulation dot1Q 10', 'ip address 192.168.10.1 255.255.255.0', 'interface g0/0.20', 'encapsulation dot1Q 21', 'ip address 192.168.20.1 255.255.255.0')],
    ],
    tasks: [
      { text: 'PC-KYTHUAT ping được gateway 192.168.20.1', verify: 'ping 192.168.20.1', check: (a) => a.ping('kt', '192.168.20.1') },
      { text: 'PC-KYTHUAT ping được PC-NHANSU', verify: 'ping 192.168.10.10', check: (a) => a.ping('kt', '192.168.10.10') },
      { text: 'Subinterface g0/0.20 khớp VLAN 20', verify: 'show running-config | section g0/0.20', check: (a) => a.d('rcore').ifaces['g0/0.20']?.encap === 20 },
      { text: 'Fa0/2 là access VLAN 20', verify: 'show vlan brief', check: (a) => a.d('swcore').ports['fa0/2'].vlan === 20 && a.d('swcore').ports['fa0/2'].mode === 'access' },
    ],
    hints: ['show vlan brief trên SW-CORE: Fa0/2 đang nằm ở VLAN nào?', 'show running-config trên R-CORE: encapsulation của g0/0.20 là VLAN mấy?', '"Xem gói tin" khi ping: frame mang tag VLAN 20 tới router thì router có subinterface nào nhận không?'],
    solution: [['rcore', cfg('interface g0/0.20', 'encapsulation dot1Q 20')], ['swcore', cfg('interface fa0/2', 'switchport mode access', 'switchport access vlan 20')]],
  },
  {
    id: 'T06', group: 'tk', topics: ['Static'], lesson: 'Bài 13', lessonPath: P.b13, level: 2, kind: 'ticket',
    title: 'Ticket #4710 — "Đã thêm route đầy đủ" mà site A vẫn không tới site C',
    story: '🎫 Ticket #4710. Người dùng site A (192.168.1.0/24) không truy cập được server site C (192.168.3.10). Ca NOC trước ghi chú: "đã thêm route đầy đủ trên các router". Hãy chứng minh bằng show/traceroute và sửa tối thiểu.',
    build: () => makeNet([
      router('r1', 'R1', 200, 130, ['g0/0', 'g0/1']),
      router('r2', 'R2', 500, 130, ['g0/1', 'g0/2']),
      router('r3', 'R3', 800, 130, ['g0/0', 'g0/1']),
      pc('pca', 'PC-A', 200, 350, { ip: '192.168.1.10', gw: '192.168.1.1' }),
      server('srvc', 'SRV-C', 800, 350, { ip: '192.168.3.10', gw: '192.168.3.1' }),
    ], [['r1', 'g0/1', 'r2', 'g0/1'], ['r2', 'g0/2', 'r3', 'g0/1'], ['r1', 'g0/0', 'pca', 'fa0'], ['r3', 'g0/0', 'srvc', 'fa0']]),
    init: [
      ['r1', cfg('interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.1 255.255.255.252', 'no shutdown', 'ip route 192.168.3.0 255.255.255.0 10.0.12.6')],
      ['r2', cfg('interface g0/1', 'ip address 10.0.12.2 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 10.0.23.1 255.255.255.252', 'no shutdown', 'ip route 192.168.3.0 255.255.255.0 10.0.23.2', 'ip route 192.168.1.0 255.255.255.0 10.0.12.1')],
      ['r3', cfg('interface g0/0', 'ip address 192.168.3.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.23.2 255.255.255.252', 'no shutdown')],
    ],
    tasks: [
      { text: 'R1 có route ĐANG HOẠT ĐỘNG tới 192.168.3.0/24 qua R2', verify: 'R1: show ip route', check: (a) => a.route('r1', '192.168.3.0/24')?.nextHop === '10.0.12.2' },
      { text: 'Gỡ route "rác" trỏ next-hop không tồn tại (10.0.12.6)', verify: 'show running-config | include ip route', check: (a) => !a.d('r1').routes.some((r) => r.nh === '10.0.12.6') },
      { text: 'R3 có đường VỀ 192.168.1.0/24', verify: 'R3: show ip route', check: (a) => !!a.lookup('r3', '192.168.1.10') },
      { text: 'PC-A ping được SRV-C', verify: 'ping 192.168.3.10 / tracert', check: (a) => a.ping('pca', '192.168.3.10') },
    ],
    hints: ['show running-config | include ip route khác show ip route: route có trong config nhưng KHÔNG vào bảng định tuyến khi next-hop không tới được.', 'Next-hop 10.0.12.6 có nằm trong subnet 10.0.12.0/30 (.1–.2) không?', 'Ping cần 2 chiều: R3 có biết đường về 192.168.1.0/24 không?'],
    solution: [['r1', cfg('no ip route 192.168.3.0 255.255.255.0 10.0.12.6', 'ip route 192.168.3.0 255.255.255.0 10.0.12.2')], ['r3', cfg('ip route 192.168.1.0 255.255.255.0 10.0.23.1')]],
  },

  // ===================================================================== PROJECT
  {
    id: 'P01', group: 'pj', topics: ['VLAN/Trunk', 'OSPF', 'DHCP', 'NAT', 'ACL'], lesson: 'Lab tổng hợp CCNA 01', lessonPath: P.gm, level: 3, kind: 'project',
    title: 'Dự án GreenMart Retail: dựng HQ + Store A + Internet',
    story: 'GreenMart Retail: bạn là kỹ sư mạng duy nhất, dựng hạ tầng HQ (VLAN OFFICE 10.10.0.0/27, WAREHOUSE 10.10.0.32/27) và Store A (10.10.1.0/28) theo đúng bảng địa chỉ của đề GreenMart. WAN & ISP đã đấu nối sẵn. Làm lần lượt các task như đề thi lab tổng hợp: VLAN/trunk → router-on-a-stick → OSPF → default route → DHCP → NAT → ACL cách ly.',
    build: () => makeNet([
      sw('swacc', 'SW-ACC-GM', 200, 230, ['fa0/1', 'fa0/2', 'fa0/3', 'g0/1']),
      router('rhq', 'R-HQ-1', 450, 110, ['g0/0', 's0/0/1', 's0/1/0']),
      router('rsa', 'R-STOREA', 450, 330, ['g0/0', 's0/0/0']),
      router('isp', 'ISP-A', 760, 110, ['g0/0', 's0/0/1']),
      pc('office', 'PC-OFFICE', 70, 380, { dhcp: true }),
      pc('wh', 'PC-WAREHOUSE', 300, 400, { dhcp: true }),
      pc('sa', 'PC-STOREA', 680, 380, { ip: '10.10.1.5', prefix: 28, gw: '10.10.1.1' }),
      server('inet', 'INTERNET 8.8.8.8', 920, 260, { ip: '8.8.8.8', gw: '8.8.8.1' }),
    ], [['swacc', 'g0/1', 'rhq', 'g0/0'], ['office', 'fa0', 'swacc', 'fa0/1'], ['wh', 'fa0', 'swacc', 'fa0/2'], ['rhq', 's0/1/0', 'rsa', 's0/0/0'], ['rhq', 's0/0/1', 'isp', 's0/0/1'], ['rsa', 'g0/0', 'sa', 'fa0'], ['isp', 'g0/0', 'inet', 'fa0']]),
    init: [
      ['isp', cfg('interface g0/0', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown', 'interface s0/0/1', 'ip address 10.10.0.82 255.255.255.252', 'no shutdown')],
      ['rhq', cfg('interface s0/1/0', 'ip address 10.10.0.73 255.255.255.252', 'clock rate 128000', 'no shutdown', 'interface s0/0/1', 'ip address 10.10.0.81 255.255.255.252', 'no shutdown')],
      ['rsa', cfg('interface g0/0', 'ip address 10.10.1.1 255.255.255.240', 'no shutdown', 'interface s0/0/0', 'ip address 10.10.0.74 255.255.255.252', 'no shutdown')],
    ],
    tasks: [
      { text: 'Task 3a — VLAN 10 OFFICE, 20 WAREHOUSE, 999 NATIVE; Fa0/1 → VLAN 10, Fa0/2 → VLAN 20', verify: 'show vlan brief', check: (a) => { const d = a.d('swacc'); return same(d.vlans[10], 'OFFICE') && same(d.vlans[20], 'WAREHOUSE') && same(d.vlans[999], 'NATIVE') && d.ports['fa0/1'].vlan === 10 && d.ports['fa0/2'].vlan === 20; } },
      { text: 'Task 3b — g0/1 trunk, native 999, chỉ cho phép VLAN cần thiết (10, 20, 999)', verify: 'show interfaces trunk', check: (a) => { const p = a.d('swacc').ports['g0/1']; return p.mode === 'trunk' && p.native === 999 && allowedOk(p, [10, 20]); } },
      { text: 'Task 6 — Router-on-a-stick: Gi0/0.10 = 10.10.0.1/27, Gi0/0.20 = 10.10.0.33/27 (up)', verify: 'show ip interface brief', check: (a) => { const f = a.d('rhq').ifaces; return f['g0/0.10']?.ip === '10.10.0.1' && f['g0/0.10'].prefix === 27 && f['g0/0.20']?.ip === '10.10.0.33' && f['g0/0.20'].prefix === 27 && a.up('rhq', 'g0/0.10') && a.up('rhq', 'g0/0.20'); } },
      { text: 'Task 7 — OSPF area 0: R-STOREA học 10.10.0.0/27 và 10.10.0.32/27; R-HQ-1 học 10.10.1.0/28', verify: 'R-STOREA: show ip route ospf', check: (a) => a.route('rsa', '10.10.0.0/27')?.code === 'O' && a.route('rsa', '10.10.0.32/27')?.code === 'O' && a.route('rhq', '10.10.1.0/28')?.code === 'O' },
      { text: 'Task 8 — Default route tới ISP-A (10.10.0.82) và quảng bá vào OSPF (R-STOREA thấy O*E2); R-STOREA không dùng static', verify: 'R-STOREA: show ip route', check: (a) => a.route('rhq', '0.0.0.0/0')?.nextHop === '10.10.0.82' && a.route('rsa', '0.0.0.0/0')?.code === 'O*E2' && a.d('rsa').routes.length === 0 },
      { text: 'Task 9 — DHCP: OFFICE nhận IP ≥ .6 gw .1; WAREHOUSE nhận IP ≥ .38 gw .33', verify: 'PC: ipconfig /renew ; R-HQ-1: show ip dhcp binding', check: (a) => { const o = a.dhcp('office'), w = a.dhcp('wh'); return o.ok && w.ok && N.inNet(o.ip, '10.10.0.0', 27) && +o.ip.split('.')[3] >= 6 && o.gw === '10.10.0.1' && N.inNet(w.ip, '10.10.0.32', 27) && +w.ip.split('.')[3] >= 38 && w.gw === '10.10.0.33'; } },
      { text: 'Task 10 — NAT overload cho 10.10.0.0/16 qua s0/0/1: PC-STOREA và PC-OFFICE (đã có IP DHCP) ping được 8.8.8.8', verify: 'ping 8.8.8.8 ; show ip nat translations', check: (a) => a.ping('sa', '8.8.8.8') && a.hasIp('office', '10.10.0.0', 27) && a.ping('office', '8.8.8.8') },
      { text: 'Task 11 — WAREHOUSE ⇄ OFFICE bị chặn 2 chiều, nhưng WAREHOUSE vẫn ra Internet', verify: 'ping chéo + ping 8.8.8.8', check: (a) => a.hasIp('office', '10.10.0.0', 27) && a.hasIp('wh', '10.10.0.32', 27) && !a.ping('wh', a.d('office').ip) && !a.ping('office', a.d('wh').ip) && a.ping('wh', '8.8.8.8') },
    ],
    hints: ['Làm đúng thứ tự task: VLAN/trunk → subinterface → OSPF → default route → DHCP → NAT → ACL.', 'Subinterface cần "ip nat inside"; s0/1/0 (về Store A) cũng inside; s0/0/1 outside.', 'DHCP: ip dhcp excluded-address 10.10.0.1 10.10.0.5 và 10.10.0.33 10.10.0.37, rồi 2 pool OFFICE/WAREHOUSE.', 'ACL cách ly: extended ACL áp IN trên g0/0.10 và g0/0.20, deny dải bên kia rồi "permit ip any any" để vẫn ra Internet.', 'Nhớ chạy ipconfig /renew trên 2 PC trước khi kiểm tra Task 10–11.'],
    solution: [
      ['swacc', cfg('vlan 10', 'name OFFICE', 'vlan 20', 'name WAREHOUSE', 'vlan 999', 'name NATIVE', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'interface fa0/2', 'switchport mode access', 'switchport access vlan 20', 'interface g0/1', 'switchport mode trunk', 'switchport trunk native vlan 999', 'switchport trunk allowed vlan 10,20,999')],      ['rhq', cfg('interface g0/0', 'no shutdown', 'interface g0/0.10', 'encapsulation dot1Q 10', 'ip address 10.10.0.1 255.255.255.224', 'ip nat inside', 'interface g0/0.20', 'encapsulation dot1Q 20', 'ip address 10.10.0.33 255.255.255.224', 'ip nat inside', 'interface s0/1/0', 'ip nat inside', 'interface s0/0/1', 'ip nat outside', 'exit',
        'router ospf 1', 'router-id 1.1.1.1', 'network 10.10.0.0 0.0.0.31 area 0', 'network 10.10.0.32 0.0.0.31 area 0', 'network 10.10.0.72 0.0.0.3 area 0', 'passive-interface g0/0.10', 'passive-interface g0/0.20', 'default-information originate', 'exit',
        'ip route 0.0.0.0 0.0.0.0 10.10.0.82',
        'ip dhcp excluded-address 10.10.0.1 10.10.0.5', 'ip dhcp excluded-address 10.10.0.33 10.10.0.37', 'ip dhcp pool OFFICE', 'network 10.10.0.0 255.255.255.224', 'default-router 10.10.0.1', 'dns-server 8.8.8.8', 'ip dhcp pool WAREHOUSE', 'network 10.10.0.32 255.255.255.224', 'default-router 10.10.0.33', 'dns-server 8.8.8.8', 'exit',
        'access-list 1 permit 10.10.0.0 0.0.255.255', 'ip nat inside source list 1 interface s0/0/1 overload',
        'ip access-list extended WH_IN', 'deny ip 10.10.0.32 0.0.0.31 10.10.0.0 0.0.0.31', 'permit ip any any', 'ip access-list extended OFFICE_IN', 'deny ip 10.10.0.0 0.0.0.31 10.10.0.32 0.0.0.31', 'permit ip any any', 'exit',
        'interface g0/0.10', 'ip access-group OFFICE_IN in', 'interface g0/0.20', 'ip access-group WH_IN in')],
      ['rsa', cfg('router ospf 1', 'router-id 2.2.2.2', 'network 10.10.1.0 0.0.0.15 area 0', 'network 10.10.0.72 0.0.0.3 area 0', 'passive-interface g0/0')],
      ['office', ['ipconfig /renew']], ['wh', ['ipconfig /renew']],
    ],
  },
];

export const LABS = [...INFRA_LABS, ...CAP_LABS, ...CCNA_LABS, ...ADV_LABS, ...SEC_LABS, ...L2SEC_LABS];
export function getLab(id) { return LABS.find((l) => l.id === id) || null; }

/** Chế độ thi thử: thời gian làm bài (phút) theo độ khó / loại lab. */
export function examMinutes(lab) {
  if (lab.group === 'cap') return 60;
  return { 1: 10, 2: 20, 3: 35 }[lab.level] ?? 20;
}
/** Chấm bài thi kiểu Cisco: thang 1000, đạt khi ≥ 800. `results` = mảng true/false của checkLab. */
export function examResult(results) {
  const ok = results.filter(Boolean).length;
  const score = results.length ? Math.round((ok / results.length) * 1000) : 0;
  return { ok, total: results.length, score, pass: score >= 800 };
}
/** Bỏ dấu tiếng Việt + chữ thường (để tìm "định tuyến" bằng "dinh tuyen"). */
export function fold(str) { return String(str ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase(); }
/** Lab có khớp chuỗi tìm kiếm không: mọi từ khoá phải xuất hiện trong id/tiêu đề/bài/đề bài/gợi ý. */
export function labMatch(lab, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold([lab.id, lab.title, lab.lesson, lab.story, ...(lab.hints || []), ...(lab.tasks || []).map((t) => t.text)].join(' '));
  return words.every((w) => hay.includes(w));
}

/** Dựng mạng cho lab + chạy cấu hình khởi tạo (qua chính CLI). */
export function buildLab(lab) {
  const net = lab.build();
  const cli = createCli(net);
  for (const [dev, cmds] of lab.init || []) runScript(cli, dev, cmds);
  N.vtpSync(net);
  return net;
}

/** Lời giải của lab: ưu tiên "guide" (cách giải chi tiết), không thì "solution". */
export function solutionOf(lab) {
  if (lab.solution) return lab.solution;
  return (lab.guide || []).map((g) => [g.dev, g.raw || g.dev === '@link' ? g.cmds : ['enable', 'configure terminal', ...g.cmds, 'end']]);
}
/** Chạy lời giải trên mạng (bước '@link' = cắm dây). Trả danh sách output để kiểm tra lỗi. */
export function applySolution(lab, net, cli) {
  const outs = [];
  for (const [dev, cmds] of solutionOf(lab)) {
    if (dev === '@link') {
      for (const [a, ap, b, bp] of cmds) if (!N.linkAt(net, a, ap) && !N.linkAt(net, b, bp)) net.links.push(N.mkLink(a, ap, b, bp));
      continue;
    }
    for (const o of runScript(cli, dev, cmds)) outs.push({ dev, ...o });
  }
  return outs;
}
/** Đáp án đúng của các câu hỏi trắc nghiệm trong lab (dùng cho test / nút lời giải). */
export function quizAnswers(lab) {
  const a = {};
  lab.tasks.forEach((t, i) => { if (t.quiz) a[i] = t.quiz.correct; });
  return a;
}

/** API dùng trong hàm check() của nhiệm vụ. */
export function makeApi(net) {
  const ctx = () => N.makeCtx(net);
  const api = {
    net,
    d: (id) => net.devices[id],
    up: (dev, ifn) => N.ifUp(net, dev, ifn),
    ping: (src, ip) => N.sendPacket(net, { src, dst: ip }).ok,
    pingR: (src, ip) => N.sendPacket(net, { src, dst: ip, record: true }).ok, // có ghi trạng thái (NAT pool, MAC, vi phạm...) — chỉ dùng trong whatIf
    trace: (src, ip) => N.sendPacket(net, { src, dst: ip }).hops.map((h) => h.ip),
    owner: (ip) => Object.values(net.devices).find((d) => (d.type === 'pc' || d.type === 'server') ? d.ip === ip : Object.entries(N.l3ifs(d)).some(([n, f]) => f.ip === ip && N.ifUp(net, d.id, n)))?.id || null,
    linked: (a, b, ap, bp) => net.links.some((l) => (l.a === a && l.b === b && (!ap || l.ap === ap) && (!bp || l.bp === bp)) || (l.a === b && l.b === a && (!ap || l.bp === ap) && (!bp || l.ap === bp))),
    err: (s, p) => N.errDisabled(net, net.devices[s], p),
    oper: (s, p) => N.effPort(net, net.devices[s], p).mode,
    ospfRoles: (rid, ifn) => N.ospfRoles(ctx(), rid, ifn),
    bgpUp: (rid, ip) => (N.bgpAll(ctx()).sessions[rid] || []).some((s) => s.ip === ip && s.state === 'Established'),
    vpnUp: (src, dst) => { const r = N.sendPacket(N.cloneNet(net), { src, dst, anim: true }); return r.ok && r.sim.events.some((e) => /ESP/.test(e.titleVi || '')); },
    greUsed: (src, dst) => { const r = N.sendPacket(N.cloneNet(net), { src, dst, anim: true }); return r.ok && r.sim.events.some((e) => /GRE/.test(e.titleVi || '')); },
    tcp: (src, ip, port) => N.sendPacket(net, { src, dst: ip, proto: 'tcp', dport: port }),
    route: (rid, key) => N.routeTable(ctx(), rid).find((r) => `${r.net}/${r.prefix}` === key) || null,
    lookup: (rid, ip) => N.lookup(ctx(), rid, ip),
    nbrs: (rid) => N.ospfNeighbors(ctx(), rid),
    eigrpNbrs: (rid) => N.eigrpAll(ctx()).adj[rid] || [],
    ospfIf: (rid, ifn) => N.ospfIfaces(ctx(), rid).find((e) => e.ifn === ifn) || null,
    bundle: (s, p) => N.bundleOf(net, net.devices[s], p),
    stpRoot: (v) => N.stpRoot(net, v)?.id || null,
    stpRole: (dev, port, v) => N.stpState(net, v).ports[`${dev}|${port}`] || null,
    l2path: (src, ip) => (N.resolve(net, { dev: src, ifn: 'fa0' }, ip).hops || []).map((h) => h.to),
    hsrpActive: (dev, ifn, g, proto = 'hsrp') => N.hsrpView(net, dev, ifn).find((x) => x.group === g && x.proto === proto)?.ep.dev || null,
    dhcp: (pcId) => N.dhcpRequest(N.cloneNet(net), pcId, {}),
    hasIp: (id, nw, p) => !!net.devices[id].ip && N.inNet(net.devices[id].ip, nw, p),
    excluded: (rid, a, b) => net.devices[rid].dhcp.excluded.some(([x, y]) => N.ip2n(x) <= N.ip2n(a) && N.ip2n(y || x) >= N.ip2n(b)),
    pool: (rid, nw, pred) => Object.values(net.devices[rid].dhcp.pools).some((p) => p.net === nw && pred(p)),
    show: (dev, cmd) => { const cli = createCli(net); cli.session(dev).mode = 'priv'; return cli.exec(dev, cmd).out; },
    whatIf: (mutate, fn) => { const c = N.cloneNet(net); mutate(c); return fn(makeApi(c)); },
  };
  return api;
}

/** Chấm toàn bộ nhiệm vụ → mảng true/false. `answers` = {chỉ số nhiệm vụ: phương án đã chọn} cho câu trắc nghiệm. */
export function checkLab(lab, net, answers = {}) {
  // ⏱ chấm theo trạng thái ĐÃ hội tụ: cấu hình đúng là đạt, không bắt người học chờ STP/OSPF lên
  return N.withoutClock(net, () => {
    const api = makeApi(net);
    return lab.tasks.map((t, i) => {
      if (t.quiz) return answers[i] === t.quiz.correct;
      try { return !!t.check(api); } catch { return false; }
    });
  });
}
