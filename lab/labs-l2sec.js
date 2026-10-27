// lab/labs-l2sec.js — nhóm "🔐 Bảo mật L2 & thiết bị": DHCP snooping chống DHCP giả, DAI, IP Source Guard,
// hardening quản trị (AAA, SSH, login block-for), ticket L2 và kiểm toán bảo mật. Topology, địa chỉ, tình huống tự thiết kế.

import * as N from './net.js';
import { cfg, quiz, fa, macOf } from './kit.js';

const { pc, server, router, sw, makeNet } = N;

// ---------------------------------------------------------------- LAN văn phòng dùng chung S01, S02, S05
//  PC-KT1 fa0/1, PC-KT2 fa0/2, MAY-IN fa0/3 (IP tĩnh), [WIFI-LA fa0/4], [PC-LA fa0/5] — SW-ACC g0/1 — R-GW (DHCP) — INTERNET 8.8.8.8
const lanNet = ({ rogue = false, la = false } = {}) => makeNet([
  server('srv', 'INTERNET 8.8.8.8', 920, 80, { ip: '8.8.8.8', gw: '8.8.8.1', services: [80, 443] }),
  router('rgw', 'R-GW', 700, 150, ['g0/0', 'g0/1']),
  sw('sw', 'SW-ACC', 420, 150, fa(8, ['g0/1'])),
  pc('pc1', 'PC-KT1', 130, 300, { dhcp: true }),
  pc('pc2', 'PC-KT2', 290, 340, { dhcp: true }),
  pc('prn', 'MAY-IN', 460, 340, { ip: '10.1.1.50', gw: '10.1.1.1', services: [9100] }),
  ...(rogue ? [router('rogue', 'WIFI-LA', 640, 330, ['g0/0'])] : []),
  ...(la ? [pc('pcla', 'PC-LA', 110, 110, { ip: '10.1.1.77', gw: '10.1.1.1' })] : []),
], [['rgw', 'g0/1', 'srv', 'fa0'], ['rgw', 'g0/0', 'sw', 'g0/1'], ['pc1', 'fa0', 'sw', 'fa0/1'], ['pc2', 'fa0', 'sw', 'fa0/2'], ['prn', 'fa0', 'sw', 'fa0/3'],
  ...(rogue ? [['rogue', 'g0/0', 'sw', 'fa0/4']] : []), ...(la ? [['pcla', 'fa0', 'sw', 'fa0/5']] : [])]);
const RGW = ['rgw', cfg('hostname R-GW', 'interface g0/0', 'ip address 10.1.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown', 'exit',
  'ip dhcp excluded-address 10.1.1.1 10.1.1.99', 'ip dhcp pool NHANVIEN', 'network 10.1.1.0 255.255.255.0', 'default-router 10.1.1.1', 'dns-server 8.8.8.8')];
const SW_BASE = ['hostname SW-ACC', 'vlan 10', 'name NHANVIEN', 'exit', 'interface range fa0/1 - 8', 'switchport mode access', 'switchport access vlan 10', 'exit', 'interface g0/1', 'switchport mode access', 'switchport access vlan 10', 'exit'];
const ROGUE = ['rogue', cfg('hostname WIFI-LA', 'interface g0/0', 'ip address 192.168.0.1 255.255.255.0', 'no shutdown', 'exit', 'ip dhcp pool HOME', 'network 192.168.0.0 255.255.255.0', 'default-router 192.168.0.1')];
const SNOOP = ['ip dhcp snooping', 'ip dhcp snooping vlan 10', 'interface g0/1', 'ip dhcp snooping trust', 'exit'];
const renew = (id) => [id, ['ipconfig /release', 'ipconfig /renew']];
const PRN_MAC = macOf(lanNet({ la: true }), 'prn');
const PRN_MAC_R = macOf(lanNet({ rogue: true }), 'prn');
const inLan = (a, id) => N.inNet(a.d(id).ip || '0.0.0.0', '10.1.1.0', 24);
const tcp = (a, s, ip, p) => a.tcp(s, ip, p).ok;
const sw0 = (a) => a.d('sw');
const userPorts = (a) => Object.entries(sw0(a).ports).filter(([n]) => n !== 'g0/1');

// ---------------------------------------------------------------- S03: máy chủ lương sau R-GW
const luongNet = () => makeNet([
  server('luong', 'SRV-LUONG', 900, 150, { ip: '172.16.1.10', gw: '172.16.1.1', services: [443] }),
  router('rgw', 'R-GW', 680, 150, ['g0/0', 'g0/2']),
  sw('sw', 'SW-ACC', 420, 150, fa(4, ['g0/1'])),
  pc('gd', 'PC-GIAMDOC', 130, 300, { dhcp: true }),
  pc('kt', 'PC-KETOAN', 320, 340, { dhcp: true }),
  pc('long', 'PC-LONG', 520, 330, { dhcp: true }),
], [['rgw', 'g0/2', 'luong', 'fa0'], ['rgw', 'g0/0', 'sw', 'g0/1'], ['gd', 'fa0', 'sw', 'fa0/1'], ['kt', 'fa0', 'sw', 'fa0/2'], ['long', 'fa0', 'sw', 'fa0/3']]);

// ---------------------------------------------------------------- S04, S06: quản trị thiết bị
//  PC-ADMIN fa0/1, PC-LA fa0/2 — SW — R (g0/0 LAN, g0/1 ra ISP)
const mgmtNet = (rname) => makeNet([
  router('isp', 'ISP', 900, 150, ['g0/0']),
  router('r', rname, 660, 150, ['g0/0', 'g0/1']),
  sw('sw', 'SW-ACC', 400, 150, fa(8, ['g0/1'])),
  pc('admin', 'PC-ADMIN', 140, 290, { ip: '10.1.1.10', gw: '10.1.1.1' }),
  pc('hacker', 'PC-LA', 380, 340, { ip: '10.1.1.66', gw: '10.1.1.1' }),
], [['r', 'g0/1', 'isp', 'g0/0'], ['r', 'g0/0', 'sw', 'g0/1'], ['admin', 'fa0', 'sw', 'fa0/1'], ['hacker', 'fa0', 'sw', 'fa0/2']]);
const ISP = ['isp', cfg('hostname ISP', 'interface g0/0', 'ip address 203.0.113.1 255.255.255.0', 'no shutdown')];
const R_IF = ['interface g0/0', 'ip address 10.1.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.2 255.255.255.0', 'no shutdown', 'exit', 'ip route 0.0.0.0 0.0.0.0 203.0.113.1'];
const SW_MGMT = ['sw', cfg('hostname SW-ACC', 'vlan 10', 'name QUANTRI', 'exit', 'interface range fa0/1 - 2', 'switchport mode access', 'switchport access vlan 10', 'exit', 'interface g0/1', 'switchport mode access', 'switchport access vlan 10')];
const refused = (a, s, p) => a.tcp(s, '10.1.1.1', p).kind === 'refused';

export const L2SEC_LABS = [
  // =====================================================================
  // S01 — DHCP snooping chống DHCP giả
  // =====================================================================
  {
    id: 'S01', group: 'l2s', lesson: 'Bảo mật L2 — DHCP snooping', level: 2, kind: 'config',
    title: 'Wi-Fi "lạ" phát DHCP: cả phòng nhận sai IP — bật DHCP snooping',
    story: 'Phòng Kế toán (VLAN 10) báo "mất mạng". Kiểm tra thấy PC-KT1, PC-KT2 nhận IP 192.168.0.x — có người cắm bộ phát Wi-Fi mang từ nhà (WIFI-LA, cổng fa0/4) và nó phát DHCP. Máy trạm lấy OFFER nào tới TRƯỚC nên server thật R-GW (qua uplink g0/1) bị "lấn". Yêu cầu: bật DHCP snooping cho VLAN 10 trên SW-ACC, chỉ tin cổng uplink g0/1, rồi cho 2 PC xin lại IP.',
    build: () => lanNet({ rogue: true }),
    init: [RGW, ['sw', cfg(...SW_BASE)], ROGUE, renew('pc1'), renew('pc2')],
    guide: [
      { dev: 'sw', title: '1. Bật DHCP snooping cho VLAN 10', why: 'Bật toàn cục chưa đủ: snooping chỉ chạy trên các VLAN được liệt kê. Từ đây mọi cổng mặc định UNTRUSTED — switch hủy DHCP OFFER/ACK đi vào từ cổng untrusted.', cmds: ['ip dhcp snooping', 'ip dhcp snooping vlan 10'] },
      { dev: 'sw', title: '2. Tin cổng uplink về DHCP server thật', why: 'Chỉ cổng hướng về R-GW (g0/1) được trả lời DHCP. Quên bước này thì cả server thật cũng bị chặn → PC nhận 169.254.x.x. Cổng fa0/4 (WIFI-LA) giữ untrusted.', cmds: ['interface g0/1', 'ip dhcp snooping trust'] },
      { dev: 'pc1', raw: true, title: '3. PC-KT1 xin lại IP', why: 'OFFER của WIFI-LA giờ bị hủy ở fa0/4 → PC nhận IP từ R-GW. Switch ghi binding MAC–IP–VLAN–cổng.', cmds: ['ipconfig /release', 'ipconfig /renew'] },
      { dev: 'pc2', raw: true, title: '4. PC-KT2 xin lại IP rồi xem bảng binding', why: 'Bảng binding là nền cho DAI và IP Source Guard (S02, S03). Trên SW-ACC: show ip dhcp snooping binding.', cmds: ['ipconfig /release', 'ipconfig /renew'] },
    ],
    tasks: [
      { text: 'DHCP snooping bật toàn cục và cho VLAN 10', verify: 'show ip dhcp snooping', check: (a) => sw0(a).snoop.enabled && sw0(a).snoop.vlans.includes(10) },
      { text: 'Chỉ uplink g0/1 là trusted (cổng WIFI-LA fa0/4 vẫn untrusted)', verify: 'show ip dhcp snooping', check: (a) => sw0(a).ports['g0/1'].trust && !userPorts(a).some(([, p]) => p.trust) },
      { text: 'PC-KT1 và PC-KT2 nhận IP 10.1.1.x của R-GW và ra được 8.8.8.8', verify: 'PC: ipconfig /renew ; ping 8.8.8.8', check: (a) => inLan(a, 'pc1') && inLan(a, 'pc2') && a.ping('pc1', '8.8.8.8') && a.ping('pc2', '8.8.8.8') },
      { text: 'Bảng binding có PC-KT1 (fa0/1) và PC-KT2 (fa0/2)', verify: 'show ip dhcp snooping binding', check: (a) => ['fa0/1', 'fa0/2'].every((p) => (sw0(a).snoop.bindings || []).some((b) => b.port === p && b.vlan === 10 && N.inNet(b.ip, '10.1.1.0', 24))) },
      quiz('Vì sao trước khi bật snooping PC lại nhận IP của WIFI-LA?', ['Máy trạm nhận OFFER tới trước — server nào trả lời trước thì thắng', 'WIFI-LA có độ ưu tiên DHCP cao hơn', 'R-GW hết địa chỉ', 'Do VLAN 10 sai'], 0, 'DHCP không có cơ chế xác thực server: client broadcast DISCOVER và nhận OFFER đầu tiên. DHCP snooping vá lỗ hổng này ở switch.'),
    ],
    hints: ['ip dhcp snooping ; ip dhcp snooping vlan 10', 'Cổng nào hướng về DHCP server THẬT thì "ip dhcp snooping trust".', 'Sau khi sửa phải "ipconfig /renew" trên PC.'],
  },

  // =====================================================================
  // S02 — Dynamic ARP Inspection
  // =====================================================================
  {
    id: 'S02', group: 'l2s', lesson: 'Bảo mật L2 — Dynamic ARP Inspection', level: 3, kind: 'config',
    title: 'DAI: chặn ARP giả mạo — nhưng đừng làm "chết" máy in IP tĩnh',
    story: `SW-ACC đã chạy DHCP snooping (VLAN 10, trust g0/1). Bước tiếp theo chống ARP spoofing: bật Dynamic ARP Inspection — switch kiểm mọi ARP vào cổng untrusted, cặp IP–MAC phải có trong bảng binding. Lưu ý: MAY-IN (fa0/3) đặt IP TĨNH 10.1.1.50 nên không có binding (MAC: xem "show mac address-table" hoặc "ipconfig /all" trên máy in). PC-LA (fa0/5) là máy tự đặt IP tĩnh 10.1.1.77 không qua DHCP — phải bị chặn.`,
    build: () => lanNet({ la: true }),
    init: [RGW, ['sw', cfg(...SW_BASE, ...SNOOP)], renew('pc1'), renew('pc2')],
    guide: [
      { dev: 'sw', title: '1. Bật DAI cho VLAN 10 + trust uplink', why: 'ARP Reply của R-GW đi vào g0/1 — IP router không nằm trong bảng binding nên PHẢI trust cổng này (thường trust mọi cổng nối switch/router). Cổng người dùng giữ untrusted.', cmds: ['ip arp inspection vlan 10', 'interface g0/1', 'ip arp inspection trust'] },
      { dev: 'sw', title: '2. Binding tĩnh cho máy in IP tĩnh', why: '"ip source binding" thêm cặp MAC–IP–VLAN–cổng thủ công vào bảng (dùng chung cho DAI và IP Source Guard). Không trust cổng máy in — trust là bỏ kiểm tra hoàn toàn.', cmds: [`ip source binding ${PRN_MAC} vlan 10 10.1.1.50 interface fa0/3`] },
    ],
    tasks: [
      { text: 'DAI bật cho VLAN 10, uplink g0/1 trusted — PC-KT1 vẫn ra được 8.8.8.8', verify: 'show ip arp inspection vlan 10', check: (a) => sw0(a).dai.includes(10) && sw0(a).ports['g0/1'].daiTrust && a.ping('pc1', '8.8.8.8') && a.ping('pc2', '8.8.8.8') },
      { text: 'PC-KT1 vẫn in được (MAY-IN 10.1.1.50:9100) nhờ binding tĩnh', verify: 'show ip source binding ; PC-KT1: telnet 10.1.1.50 9100', check: (a) => sw0(a).dai.includes(10) && tcp(a, 'pc1', '10.1.1.50', 9100) && (sw0(a).snoop.statics || []).some((b) => b.ip === '10.1.1.50' && b.port === 'fa0/3') },
      { text: 'PC-LA (IP tĩnh tự đặt, không có binding) bị DAI chặn', verify: 'PC-LA: ping 10.1.1.1 ; show ip arp inspection statistics', check: (a) => sw0(a).dai.includes(10) && !a.ping('pcla', '10.1.1.1') },
      { text: 'Ràng buộc: không "ip arp inspection trust" trên cổng người dùng/máy in', verify: 'show ip arp inspection interfaces', check: (a) => !userPorts(a).some(([, p]) => p.daiTrust) },
      quiz('DAI dựa vào đâu để quyết định một ARP là hợp lệ?', ['Bảng binding DHCP snooping (+ binding tĩnh / ARP ACL)', 'Bảng MAC của switch', 'Bảng ARP của router', 'Port-security sticky MAC'], 0, 'DAI so cặp sender IP – sender MAC trong gói ARP với bảng binding. Không có binding → hủy (cổng untrusted).'),
    ],
    hints: ['ip arp inspection vlan 10 ; interface g0/1 → ip arp inspection trust', 'Máy in: ip source binding <mac> vlan 10 10.1.1.50 interface fa0/3', 'MAC máy in: "show mac address-table" trên SW-ACC (sau khi máy in đã gửi gói) hoặc tab MAY-IN → ipconfig /all.'],
  },

  // =====================================================================
  // S03 — IP Source Guard
  // =====================================================================
  {
    id: 'S03', group: 'l2s', lesson: 'Bảo mật L2 — IP Source Guard', level: 2, kind: 'config',
    title: 'IP Source Guard: nhân viên giả IP giám đốc để xem bảng lương',
    story: 'R-GW có ACL "LUONG": chỉ IP 10.1.1.100 (máy giám đốc — luôn nhận .100 từ DHCP) được mở SRV-LUONG:443. Tối nay máy giám đốc đã tắt (fa0/1 down) và PC-LONG (fa0/3) tự đặt IP tĩnh 10.1.1.100 — vào được bảng lương! SW-ACC đã có DHCP snooping (VLAN 10). Hãy bật IP Source Guard trên các cổng người dùng để switch chỉ nhận gói có IP nguồn đúng binding của chính cổng đó.',
    build: luongNet,
    init: [['rgw', cfg('hostname R-GW', 'interface g0/2', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown', 'exit', 'ip access-list extended LUONG', 'permit tcp host 10.1.1.100 host 172.16.1.10 eq 443', 'deny tcp any host 172.16.1.10 eq 443', 'permit ip any any', 'exit',
      'interface g0/0', 'ip address 10.1.1.1 255.255.255.0', 'ip access-group LUONG in', 'no shutdown', 'exit', 'ip dhcp excluded-address 10.1.1.1 10.1.1.99', 'ip dhcp pool NHANVIEN', 'network 10.1.1.0 255.255.255.0', 'default-router 10.1.1.1')],
    ['sw', cfg(...SW_BASE.map((l) => l.replace('fa0/1 - 8', 'fa0/1 - 4')), ...SNOOP)], renew('gd'), renew('kt'), renew('long'),
    ['sw', cfg('interface fa0/1', 'description May giam doc (da tat)', 'shutdown')], ['long', ['ipconfig 10.1.1.100 255.255.255.0 10.1.1.1']]],
    guide: [
      { dev: 'sw', title: '1. Bật IP Source Guard trên cổng người dùng', why: '"ip verify source" lọc theo IP nguồn: chỉ cho gói có IP đúng binding của CỔNG đó. Binding 10.1.1.100 thuộc fa0/1 (máy giám đốc) nên gói 10.1.1.100 đi vào fa0/3 bị hủy. Không bật trên uplink g0/1 (gói từ router mang IP mọi mạng).', cmds: ['interface range fa0/1 - 3', 'ip verify source'] },
      { dev: 'long', raw: true, title: '2. Thử lại từ PC-LONG', why: 'Kết nối tới SRV-LUONG bị IP Source Guard hủy ngay tại SW-ACC (xem nút ▶ Xem gói tin).', cmds: ['telnet 172.16.1.10 443'] },
    ],
    tasks: [
      { text: 'IP Source Guard bật trên fa0/1–fa0/3, KHÔNG bật trên uplink g0/1', verify: 'show ip verify source', check: (a) => ['fa0/1', 'fa0/2', 'fa0/3'].every((p) => sw0(a).ports[p].ipsg) && !sw0(a).ports['g0/1'].ipsg },
      { text: 'PC-LONG giả IP 10.1.1.100 không còn mở được SRV-LUONG:443', verify: 'PC-LONG: telnet 172.16.1.10 443', check: (a) => a.d('long').ip === '10.1.1.100' && !tcp(a, 'long', '172.16.1.10', 443) },
      { text: 'PC-KETOAN (IP từ DHCP) vẫn dùng mạng bình thường', verify: 'PC-KETOAN: ping 172.16.1.10', check: (a) => a.ping('kt', '172.16.1.10') },
      { text: 'Ràng buộc: DHCP snooping vẫn bật và còn binding 10.1.1.100 của máy giám đốc (fa0/1)', verify: 'show ip dhcp snooping binding', check: (a) => sw0(a).snoop.enabled && (sw0(a).snoop.bindings || []).some((b) => b.ip === '10.1.1.100' && b.port === 'fa0/1') },
      quiz('IP Source Guard khác DAI ở điểm nào?', ['IPSG lọc gói IP theo IP nguồn + cổng; DAI lọc gói ARP theo cặp IP–MAC', 'IPSG chỉ chạy trên router', 'DAI không cần DHCP snooping', 'Hai tính năng giống hệt nhau'], 0),
    ],
    hints: ['interface range fa0/1 - 3 → ip verify source', 'IPSG cần bảng binding DHCP snooping (đã có sẵn).', 'Không bật trên cổng uplink về router.'],
  },

  // =====================================================================
  // S04 — Hardening quản trị: AAA, chỉ SSH, login block-for
  // =====================================================================
  {
    id: 'S04', group: 'l2s', lesson: 'Bảo mật thiết bị — AAA & chống dò mật khẩu', level: 3, kind: 'config',
    title: 'R-CORE bị dò mật khẩu: AAA local, chỉ SSH, login block-for + quiet-mode access-class',
    story: 'Log R-CORE có hàng trăm lần đăng nhập sai từ PC-LA (10.1.1.66). Router đang mở Telnet và web quản trị (ip http server). Đã có user admin (secret Quantri@2024), domain và khoá RSA. Yêu cầu: (1) aaa new-model + đăng nhập theo user local; (2) VTY chỉ SSH, tự thoát sau 5 phút, tắt web quản trị; (3) mật khẩu tối thiểu 10 ký tự; (4) sai 3 lần trong 60 giây → khoá đăng nhập 120 giây, nhưng PC-ADMIN (10.1.1.10) vẫn vào được khi đang khoá. Cuối cùng thử tấn công từ PC-LA để kiểm chứng.',
    build: () => mgmtNet('R-CORE'),
    init: [ISP, SW_MGMT, ['r', cfg('hostname R-CORE', ...R_IF, 'ip domain-name congty.vn', 'crypto key generate rsa modulus 2048', 'username admin privilege 15 secret Quantri@2024', 'ip http server', 'line vty 0 4', 'login local', 'transport input all')]],
    guide: [
      { dev: 'r', title: '1. Bật AAA, xác thực bằng user local', why: '"aaa new-model" chuyển mọi đăng nhập sang method list; "default local" = dùng username trên router (thực tế thường là "group tacacs+ local" để dự phòng khi mất máy chủ TACACS+).', cmds: ['aaa new-model', 'aaa authentication login default local'] },
      { dev: 'r', title: '2. VTY chỉ SSH, timeout 5 phút; tắt web quản trị', why: 'Telnet gửi mật khẩu dạng rõ; HTTP quản trị cũng vậy. exec-timeout đóng phiên bỏ quên.', cmds: ['ip ssh version 2', 'no ip http server', 'line vty 0 4', 'transport input ssh', 'exec-timeout 5 0'] },
      { dev: 'r', title: '3. Chính sách mật khẩu + chống dò mật khẩu', why: '"login block-for 120 attempts 3 within 60": sai 3 lần trong 60 s → quiet mode 120 s, từ chối MỌI kết nối VTY. "login quiet-mode access-class" chừa đường cho máy quản trị — nếu không, kẻ tấn công khoá luôn cả admin (tấn công từ chối dịch vụ).', cmds: ['security passwords min-length 10', 'access-list 10 permit host 10.1.1.10', 'login block-for 120 attempts 3 within 60', 'login quiet-mode access-class 10', 'login on-failure log'] },
      { dev: 'hacker', raw: true, title: '4. Thử dò mật khẩu từ PC-LA', why: 'Lần sai thứ 3 → R-CORE vào quiet mode ("show login", "show logging").', cmds: ['ssh -l admin 10.1.1.1', '123456', 'ssh -l admin 10.1.1.1', 'admin', 'ssh -l admin 10.1.1.1', 'password'] },
      { dev: 'admin', raw: true, title: '5. PC-ADMIN vẫn SSH được trong lúc quiet mode', why: 'Nguồn 10.1.1.10 nằm trong ACL 10 của quiet-mode access-class.', cmds: ['ssh -l admin 10.1.1.1', 'Quantri@2024'] },
    ],
    tasks: [
      { text: 'AAA: aaa new-model + aaa authentication login default local; PC-ADMIN SSH được', verify: 'PC-ADMIN: ssh -l admin 10.1.1.1', check: (a) => !!a.d('r').aaa?.newModel && /^local/.test(a.d('r').aaa.lists.default?.[0] || '') && tcp(a, 'admin', '10.1.1.1', 22) },
      { text: 'Chỉ SSH: Telnet (23) và web quản trị (80) bị từ chối', verify: 'PC-ADMIN: telnet 10.1.1.1 ; telnet 10.1.1.1 80', check: (a) => refused(a, 'admin', 23) && refused(a, 'admin', 80) },
      { text: 'Mật khẩu tối thiểu ≥ 10 ký tự; VTY tự thoát sau 1–10 phút', verify: 'show running-config | include min-length|exec-timeout', check: (a) => a.d('r').pwMin >= 10 && (([m, s] = a.d('r').lines.vty.execTimeout || [0, 0]) => m * 60 + s > 0 && m * 60 + s <= 600)() },
      { text: 'login block-for ≥ 60 giây, attempts ≤ 5; quiet-mode access-class cho PC-ADMIN nhưng không cho PC-LA', verify: 'show login', check: (a) => { const r = a.d('r'), L = r.loginSec; return L?.blockFor >= 60 && L.attempts <= 5 && !!r.acls[L.quietAcl] && N.aclEval(r, L.quietAcl, { src: '10.1.1.10' }).action === 'permit' && N.aclEval(r, L.quietAcl, { src: '10.1.1.66' }).action !== 'permit'; } },
      { text: 'Đã thử tấn công: R-CORE từng vào quiet mode; PC-ADMIN vẫn SSH được', verify: 'show login ; show logging', check: (a) => a.d('r').loginSec?.quietCount > 0 && tcp(a, 'admin', '10.1.1.1', 22) },
      quiz('Không cấu hình "login quiet-mode access-class" thì rủi ro là gì?', ['Kẻ tấn công cố ý nhập sai để khoá luôn cả quản trị viên (DoS)', 'Router không ghi log', 'SSH bị tắt vĩnh viễn', 'Không có rủi ro'], 0),
    ],
    hints: ['aaa new-model ; aaa authentication login default local', 'line vty 0 4 → transport input ssh ; exec-timeout 5 0 ; no ip http server', 'access-list 10 permit host 10.1.1.10 ; login block-for 120 attempts 3 within 60 ; login quiet-mode access-class 10', 'Thử: tab PC-LA → ssh -l admin 10.1.1.1 rồi gõ sai mật khẩu 3 lần.'],
  },

  // =====================================================================
  // S05 — Ticket: bật bảo mật L2 xong cả phòng mất mạng
  // =====================================================================
  {
    id: 'S05', group: 'l2s', lesson: 'Bảo mật L2 — Xử lý sự cố', level: 3, kind: 'ticket',
    title: 'Ticket: "Anh Tùng bật bảo mật L2 xong, cả phòng mất mạng, máy in cũng chết"',
    story: `🎫 Anh Tùng bật DHCP snooping, DAI và IP Source Guard trên SW-ACC (VLAN 10) theo checklist, sau đó: PC nhận IP lạ 192.168.0.x (WIFI-LA vẫn cắm ở fa0/4), máy in IP tĩnh 10.1.1.50 (MAC ${PRN_MAC_R}) không in được. Yêu cầu: sửa cho PC nhận đúng IP của R-GW, ra được Internet, in được — mà KHÔNG tắt các tính năng bảo mật.`,
    build: () => lanNet({ rogue: true }),
    init: [RGW, ROGUE, ['sw', cfg(...SW_BASE, 'ip dhcp snooping', 'ip dhcp snooping vlan 10', 'interface fa0/4', 'ip dhcp snooping trust', 'exit', 'ip arp inspection vlan 10', 'interface g0/1', 'ip verify source', 'exit', 'interface range fa0/1 - 2', 'ip verify source')], renew('pc1'), renew('pc2')],
    guide: [
      { dev: 'sw', title: '1. Trust nhầm cổng', why: 'fa0/4 (WIFI-LA) đang trusted còn uplink g0/1 thì không → OFFER của server thật bị hủy, OFFER giả được qua. DAI cũng cần trust uplink (ARP của R-GW). IP Source Guard trên uplink hủy mọi gói từ router (nguồn 8.8.8.8… không có binding) → gỡ khỏi g0/1.', cmds: ['interface fa0/4', 'no ip dhcp snooping trust', 'interface g0/1', 'ip dhcp snooping trust', 'ip arp inspection trust', 'no ip verify source'] },
      { dev: 'sw', title: '2. Máy in IP tĩnh không có binding → DAI hủy ARP', why: 'Thêm binding tĩnh thay vì trust cổng máy in.', cmds: [`ip source binding ${PRN_MAC_R} vlan 10 10.1.1.50 interface fa0/3`] },
      { dev: 'pc1', raw: true, title: '3. PC-KT1 xin lại IP', why: 'Giờ chỉ server thật trả lời được; binding mới giúp DAI/IPSG cho qua.', cmds: ['ipconfig /release', 'ipconfig /renew'] },
      { dev: 'pc2', raw: true, title: '4. PC-KT2 xin lại IP', why: '', cmds: ['ipconfig /release', 'ipconfig /renew'] },
    ],
    tasks: [
      { text: 'PC-KT1, PC-KT2 nhận IP 10.1.1.x của R-GW và ra được 8.8.8.8', verify: 'PC: ipconfig /renew ; ping 8.8.8.8', check: (a) => inLan(a, 'pc1') && inLan(a, 'pc2') && a.ping('pc1', '8.8.8.8') && a.ping('pc2', '8.8.8.8') },
      { text: 'PC-KT1 in được (MAY-IN 10.1.1.50:9100)', verify: 'PC-KT1: telnet 10.1.1.50 9100', check: (a) => tcp(a, 'pc1', '10.1.1.50', 9100) },
      { text: 'WIFI-LA vẫn bị chặn: chỉ g0/1 trusted (snooping + DAI)', verify: 'show ip dhcp snooping ; show ip arp inspection interfaces', check: (a) => sw0(a).ports['g0/1'].trust && sw0(a).ports['g0/1'].daiTrust && !userPorts(a).some(([, p]) => p.trust || p.daiTrust) },
      { text: 'Ràng buộc: giữ snooping + DAI cho VLAN 10 và IP Source Guard trên fa0/1–fa0/2', verify: 'show ip verify source', check: (a) => sw0(a).snoop.enabled && sw0(a).snoop.vlans.includes(10) && sw0(a).dai.includes(10) && sw0(a).ports['fa0/1'].ipsg && sw0(a).ports['fa0/2'].ipsg },
    ],
    hints: ['Có 4 lỗi: 2 về "trust", 1 về IP Source Guard đặt sai cổng, 1 về máy in IP tĩnh.', 'show ip dhcp snooping / show ip arp inspection interfaces / show ip verify source / show logging', 'Sau khi sửa, cho PC "ipconfig /renew".'],
  },

  // =====================================================================
  // S06 — Kiểm toán bảo mật thiết bị
  // =====================================================================
  {
    id: 'S06', group: 'l2s', lesson: 'Bảo mật thiết bị — Kiểm toán (audit)', level: 3, kind: 'ticket',
    title: 'Kiểm toán bảo mật: 6 phát hiện trên R-EDGE và SW-ACC phải khắc phục',
    story: '🎫 Báo cáo kiểm toán chi nhánh: (F1) R-EDGE dùng "enable password" dạng rõ; (F2) mật khẩu trong cấu hình đọc được và user admin dùng "password" thay vì "secret"; (F3) VTY cho Telnet, đăng nhập bằng mật khẩu chung "cisco"; (F4) bật web quản trị HTTP; (F5) CDP quảng bá thông tin thiết bị ra phía ISP (g0/1); (F6) SW-ACC: cổng fa0/3–fa0/8 không dùng vẫn bật ở VLAN 1. Khắc phục từng mục (tài khoản admin: đặt secret Admin@2024!; VLAN cách ly 999 tên PARKING). PC-ADMIN (10.1.1.10) phải SSH được. Mật khẩu enable hiện tại: cisco123.',
    build: () => mgmtNet('R-EDGE'),
    init: [ISP, SW_MGMT, ['r', cfg('hostname R-EDGE', ...R_IF, 'enable password cisco123', 'username admin privilege 15 password admin123', 'ip domain-name congty.vn', 'crypto key generate rsa modulus 1024', 'ip http server', 'line vty 0 4', 'password cisco', 'login', 'transport input all')]],
    guide: [
      { dev: 'r', raw: true, title: 'F1 + F2. enable secret, mã hoá mật khẩu, user dùng secret', why: 'Vào enable bằng mật khẩu cũ cisco123. "enable secret" lưu dạng băm; có cả hai thì secret thắng nhưng "enable password" vẫn lộ trong cấu hình → xoá. service password-encryption che mật khẩu dạng 7 (chỉ chống nhìn trộm).', cmds: ['enable', 'cisco123', 'configure terminal', 'enable secret Admin@2024!', 'no enable password', 'service password-encryption', 'username admin privilege 15 secret Admin@2024!', 'end'] },
      { dev: 'r', title: 'F3 + F4. VTY chỉ SSH bằng tài khoản riêng; tắt HTTP', why: '"login local" = mỗi người một tài khoản (truy vết được), thay cho mật khẩu chung.', cmds: ['no ip http server', 'line vty 0 4', 'no password', 'login local', 'transport input ssh'] },
      { dev: 'r', title: 'F5. Tắt CDP trên cổng ra ISP', why: 'CDP gửi hostname, model, phiên bản IOS, IP quản trị — không gửi ra ngoài. Giữ CDP trong LAN để tiện quản trị.', cmds: ['interface g0/1', 'no cdp enable'] },
      { dev: 'sw', title: 'F6. Cổng không dùng: shutdown + VLAN cách ly', why: 'Cổng trống bật sẵn ở VLAN 1 = ai cắm vào cũng vào mạng. Shutdown và đưa vào VLAN không định tuyến.', cmds: ['vlan 999', 'name PARKING', 'exit', 'interface range fa0/3 - 8', 'switchport mode access', 'switchport access vlan 999', 'shutdown'] },
    ],
    tasks: [
      { text: 'F1: chỉ còn "enable secret", không còn "enable password"', verify: 'show running-config | include enable', check: (a) => !!a.d('r').enableSecret && !a.d('r').enablePassword },
      { text: 'F2: service password-encryption + mọi username dùng "secret"', verify: 'show running-config | include username|service', check: (a) => a.d('r').servicePwEnc && Object.values(a.d('r').users).length > 0 && Object.values(a.d('r').users).every((u) => u.kind === 'secret') },
      { text: 'F3: Telnet bị từ chối; PC-ADMIN SSH bằng tài khoản local được', verify: 'PC-ADMIN: telnet 10.1.1.1 ; ssh -l admin 10.1.1.1', check: (a) => refused(a, 'admin', 23) && tcp(a, 'admin', '10.1.1.1', 22) && (a.d('r').lines.vty.loginLocal || !!a.d('r').aaa?.newModel) },
      { text: 'F4: web quản trị HTTP (cổng 80) đã tắt', verify: 'PC-ADMIN: telnet 10.1.1.1 80', check: (a) => refused(a, 'admin', 80) },
      { text: 'F5: không gửi CDP ra cổng g0/1 (phía ISP)', verify: 'show cdp interface', check: (a) => a.d('r').ifaces['g0/1'].cdp === false || !a.d('r').cdpRun },
      { text: 'F6: fa0/3–fa0/8 shutdown và ở VLAN 999 (PARKING)', verify: 'show interfaces status', check: (a) => !!sw0(a).vlans[999] && ['fa0/3', 'fa0/4', 'fa0/5', 'fa0/6', 'fa0/7', 'fa0/8'].every((p) => { const x = sw0(a).ports[p]; return x.shutdown && x.mode === 'access' && x.vlan === 999; }) },
    ],
    hints: ['show running-config là nguồn chính để kiểm toán.', 'F1/F2: enable secret, no enable password, service password-encryption, username … secret …', 'F6: vlan 999 → interface range fa0/3 - 8 → switchport access vlan 999 → shutdown'],
  },
];
