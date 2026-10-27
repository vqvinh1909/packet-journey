// lab/labs-sec.js — nhóm "🛡️ Bảo mật & Firewall": firewall Cisco ASA (F01–F04), Zone-Based Firewall,
// firewall các hãng phổ biến và bảo mật L2/thiết bị. Topology, địa chỉ và tình huống tự thiết kế.

import * as N from './net.js';
import { cfg, quiz } from './kit.js';

const { pc, server, router, sw, makeNet, firewall } = N;

// ---------------------------------------------------------------- ASA: topology dùng chung F01–F03
//  PC-IN, PC-IN2 — SW-IN — ASA g1/2 (inside) | ASA g1/3 (dmz) — WEB | ASA g1/1 (outside) — ISP — INTERNET + KHACH-NGOAI
const asaNet = () => makeNet([
  server('inet', 'INTERNET 8.8.8.8', 930, 70, { ip: '8.8.8.8', gw: '8.8.8.1', services: [80, 443] }),
  pc('ext', 'KHACH-NGOAI', 930, 240, { ip: '198.51.100.66', gw: '198.51.100.1' }),
  router('isp', 'ISP', 720, 140, ['g0/0', 'g0/1', 'g0/2']),
  firewall('asa', 'ASA', 480, 140, ['g1/1', 'g1/2', 'g1/3'], 'asa'),
  server('web', 'WEB-DMZ', 480, 330, { ip: '172.16.1.10', gw: '172.16.1.1', services: [80, 443, 22] }),
  sw('swin', 'SW-IN', 240, 140, ['fa0/1', 'fa0/2', 'g0/1']),
  pc('pin', 'PC-IN', 90, 260, { ip: '10.1.1.10', gw: '10.1.1.1', services: [445] }),
  pc('pin2', 'PC-IN2', 260, 320, { ip: '10.1.1.11', gw: '10.1.1.1', services: [445] }),
], [['isp', 'g0/1', 'inet', 'fa0'], ['isp', 'g0/2', 'ext', 'fa0'], ['asa', 'g1/1', 'isp', 'g0/0'], ['asa', 'g1/3', 'web', 'fa0'], ['asa', 'g1/2', 'swin', 'g0/1'], ['pin', 'fa0', 'swin', 'fa0/1'], ['pin2', 'fa0', 'swin', 'fa0/2']]);
const ISP = ['isp', cfg('hostname ISP', 'interface g0/0', 'ip address 203.0.113.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown', 'interface g0/2', 'ip address 198.51.100.1 255.255.255.0', 'no shutdown')];
const ASA_IF = ['interface g1/1', 'nameif outside', 'ip address 203.0.113.2 255.255.255.0', 'no shutdown', 'interface g1/2', 'nameif inside', 'ip address 10.1.1.1 255.255.255.0', 'no shutdown', 'interface g1/3', 'nameif dmz', 'security-level 50', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown', 'exit'];
const ASA_NAT = ['route outside 0.0.0.0 0.0.0.0 203.0.113.1', 'object network INSIDE-NET', 'subnet 10.1.1.0 255.255.255.0', 'nat (inside,outside) dynamic interface', 'exit'];
const ASA_ICMP = ['policy-map global_policy', 'class inspection_default', 'inspect icmp', 'exit', 'exit'];
const nif = (a, n) => a.d('asa').ifaces[n];
const tcp = (a, s, ip, p) => a.tcp(s, ip, p).ok;

// ---------------------------------------------------------------- ZBF: router R-FW làm firewall
//  PC-IN, PC-IN2 — SW-IN — R-FW g0/0 | g0/2 — WEB-DMZ | g0/1 — ISP — INTERNET + KHACH-NGOAI
const zbfNet = () => makeNet([
  server('inet', 'INTERNET 8.8.8.8', 930, 70, { ip: '8.8.8.8', gw: '8.8.8.1', services: [80, 443, 23, 53] }),
  pc('ext', 'KHACH-NGOAI', 930, 240, { ip: '198.51.100.66', gw: '198.51.100.1' }),
  router('isp', 'ISP', 720, 140, ['g0/0', 'g0/1', 'g0/2']),
  router('rfw', 'R-FW', 480, 140, ['g0/0', 'g0/1', 'g0/2']),
  server('web', 'WEB-DMZ', 480, 330, { ip: '172.16.1.10', gw: '172.16.1.1', services: [80, 443, 22] }),
  sw('swin', 'SW-IN', 240, 140, ['fa0/1', 'fa0/2', 'g0/1']),
  pc('pin', 'PC-IN', 90, 260, { ip: '10.1.1.10', gw: '10.1.1.1', services: [445] }),
  pc('pin2', 'PC-IN2', 260, 320, { ip: '10.1.1.11', gw: '10.1.1.1', services: [445] }),
], [['isp', 'g0/1', 'inet', 'fa0'], ['isp', 'g0/2', 'ext', 'fa0'], ['rfw', 'g0/1', 'isp', 'g0/0'], ['rfw', 'g0/2', 'web', 'fa0'], ['rfw', 'g0/0', 'swin', 'g0/1'], ['pin', 'fa0', 'swin', 'fa0/1'], ['pin2', 'fa0', 'swin', 'fa0/2']]);
const RFW = ['hostname R-FW', 'interface g0/0', 'ip address 10.1.1.1 255.255.255.0', 'ip nat inside', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.2 255.255.255.0', 'ip nat outside', 'no shutdown', 'exit', 'ip route 0.0.0.0 0.0.0.0 203.0.113.1', 'access-list 1 permit 10.1.1.0 0.0.0.255', 'ip nat inside source list 1 interface g0/1 overload'];
const ZBF_BASE = ['zone security INSIDE', 'exit', 'zone security OUTSIDE', 'exit', 'class-map type inspect match-any INTERNET-CM', 'match protocol http', 'match protocol https', 'match protocol dns', 'match protocol icmp', 'exit', 'policy-map type inspect IN-OUT-PM', 'class type inspect INTERNET-CM', 'inspect', 'exit', 'class class-default', 'drop', 'exit', 'exit', 'zone-pair security IN-OUT source INSIDE destination OUTSIDE', 'service-policy type inspect IN-OUT-PM', 'exit', 'interface g0/0', 'zone-member security INSIDE', 'interface g0/1', 'zone-member security OUTSIDE', 'exit'];

export const SEC_LABS = [
  // =====================================================================
  // F01 — ASA cơ bản: 3 vùng, security-level, NAT, inspect ICMP
  // =====================================================================
  {
    id: 'F01', group: 'sec', lesson: 'Firewall — Cisco ASA cơ bản', level: 2, kind: 'config',
    title: 'Cisco ASA cơ bản: 3 vùng inside/dmz/outside, NAT ra Internet, inspect ICMP',
    story: 'Công ty Hải Đăng thay router biên bằng firewall Cisco ASA. Cổng: G1/1 outside (203.0.113.2/24, ISP 203.0.113.1), G1/2 inside (10.1.1.1/24, LAN nhân viên), G1/3 dmz (172.16.1.1/24, security-level 50, máy chủ WEB-DMZ). Yêu cầu: đặt tên + IP 3 cổng, default route ra ISP, NAT PAT cho LAN ra Internet bằng IP cổng outside, và nhân viên ping được ra ngoài để kiểm tra mạng. ASA đang để cấu hình trống (mọi cổng shutdown).',
    build: asaNet,
    init: [ISP],
    guide: [
      { dev: 'asa', title: '1. Đặt nameif + IP cho 3 cổng', why: 'ASA chỉ chuyển gói giữa các cổng có "nameif". Đặt tên "inside" thì ASA tự gán security-level 100, tên khác mặc định 0 — DMZ phải tự đặt 50. Security-level quyết định chiều mặc định được phép: từ mức CAO xuống THẤP.', cmds: ASA_IF },
      { dev: 'asa', title: '2. Default route + NAT PAT (object NAT)', why: 'ASA dùng "route <tên-cổng> ..." thay cho "ip route". NAT kiểu ASA 8.3+: tạo object network cho dải nội bộ rồi "nat (inside,outside) dynamic interface" = PAT ra IP cổng outside.', cmds: ASA_NAT },
      { dev: 'asa', title: '3. Cho phép ping ra ngoài: inspect icmp', why: 'ASA là firewall STATEFUL nhưng mặc định KHÔNG theo dõi ICMP: echo đi ra được (100 → 0) còn echo-reply quay về bị chặn (0 → 100). "inspect icmp" trong global_policy làm ICMP thành stateful.', cmds: ASA_ICMP },
      { dev: 'pin', raw: true, title: '4. Kiểm tra từ PC-IN', why: 'Web ra Internet (TCP stateful), ping 8.8.8.8, vào được web DMZ (100 → 50). Xem bảng phiên: show conn / show xlate trên ASA.', cmds: ['telnet 8.8.8.8 80', 'ping 8.8.8.8', 'telnet 172.16.1.10 80'] },
    ],
    tasks: [
      { text: 'G1/1 outside (0), G1/2 inside (100), G1/3 dmz (50) — đúng IP, up', verify: 'show nameif ; show interface ip brief', check: (a) => [['g1/1', 'outside', 0, '203.0.113.2'], ['g1/2', 'inside', 100, '10.1.1.1'], ['g1/3', 'dmz', 50, '172.16.1.1']].every(([n, nm, lv, ip]) => nif(a, n).nameif === nm && nif(a, n).secLevel === lv && nif(a, n).ip === ip && a.up('asa', n)) },
      { text: 'Default route ra ISP qua cổng outside', verify: 'show route', check: (a) => a.route('asa', '0.0.0.0/0')?.nextHop === '203.0.113.1' },
      { text: 'NAT PAT: PC-IN mở được web 8.8.8.8 (ISP không có route về 10.1.1.0)', verify: 'PC-IN: telnet 8.8.8.8 80 ; ASA: show xlate', check: (a) => a.d('isp').routes.length === 0 && tcp(a, 'pin', '8.8.8.8', 80) && tcp(a, 'pin2', '8.8.8.8', 443) },
      { text: 'PC-IN ping được 8.8.8.8 (ICMP được inspect)', verify: 'ping 8.8.8.8', check: (a) => a.ping('pin', '8.8.8.8') && !!a.d('asa').fw.inspectIcmp },
      { text: 'Inside vào được web DMZ; DMZ KHÔNG tự mở kết nối vào inside', verify: 'PC-IN: telnet 172.16.1.10 80', check: (a) => tcp(a, 'pin', '172.16.1.10', 80) && !tcp(a, 'web', '10.1.1.10', 445) },
      quiz('Không có ACL nào, traffic nào ASA cho phép mặc định?', ['Từ cổng security-level CAO sang cổng THẤP hơn (và gói trả lời của phiên đó)', 'Mọi traffic', 'Từ THẤP lên CAO', 'Không traffic nào'], 0, 'Cùng mức thì bị chặn trừ khi "same-security-traffic permit inter-interface".'),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'Ping không có reply nhưng web vẫn vào được → nghĩ tới ICMP inspection.', 'Kiểm tra: show nameif · show route · show conn · show xlate.'],
  },

  // =====================================================================
  // F02 — Publish web DMZ: NAT tĩnh + ACL dùng IP thật
  // =====================================================================
  {
    id: 'F02', group: 'sec', lesson: 'Firewall — ASA publish máy chủ DMZ', level: 2, kind: 'config',
    title: 'ASA publish web DMZ: NAT tĩnh 1:1 + ACL chỉ mở HTTP/HTTPS',
    story: 'ASA đã chạy như F01 (inside/dmz/outside, NAT ra Internet). Giờ cần đưa WEB-DMZ (172.16.1.10) ra Internet bằng IP public 203.0.113.10: khách bên ngoài chỉ được vào HTTP và HTTPS; SSH quản trị (22) tuyệt đối không mở ra Internet. Lưu ý ASA từ 8.3 trở đi: ACL viết theo IP THẬT của server, không phải IP public.',
    build: asaNet,
    init: [ISP, ['asa', cfg(...ASA_IF, ...ASA_NAT, ...ASA_ICMP)]],
    guide: [
      { dev: 'asa', title: '1. NAT tĩnh cho WEB', why: 'Object host + "nat (dmz,outside) static <IP public>": NAT 1:1 hai chiều. ASA tự trả ARP cho 203.0.113.10 trên cổng outside (proxy ARP).', cmds: ['object network WEB', 'host 172.16.1.10', 'nat (dmz,outside) static 203.0.113.10', 'exit'] },
      { dev: 'asa', title: '2. ACL chiều vào cổng outside', why: 'Outside (0) → dmz (50) là từ thấp lên cao nên bị chặn mặc định — cần ACL. Viết theo IP THẬT (object WEB) vì ASA dịch NAT trước rồi mới xét ACL. Chỉ mở www + https, phần còn lại rơi vào deny ngầm định.', cmds: ['access-list OUTSIDE_IN extended permit tcp any object WEB eq www', 'access-list OUTSIDE_IN extended permit tcp any object WEB eq https', 'access-group OUTSIDE_IN in interface outside'] },
      { dev: 'ext', raw: true, title: '3. Thử từ Internet', why: 'HTTP/HTTPS vào được qua IP public; SSH bị chặn. Trên ASA: show access-list (hitcnt tăng), show xlate, show conn.', cmds: ['telnet 203.0.113.10 80', 'telnet 203.0.113.10 22'] },
    ],
    tasks: [
      { text: 'NAT tĩnh WEB 172.16.1.10 ↔ 203.0.113.10', verify: 'show nat ; show xlate', check: (a) => a.d('asa').nat.statics.some((s) => s.local === '172.16.1.10' && s.global === '203.0.113.10' && !s.proto) },
      { text: 'ACL áp chiều IN trên cổng outside', verify: 'show running-config | include access-group', check: (a) => !!nif(a, 'g1/1').aclIn },
      { text: 'Khách ngoài mở được http://203.0.113.10 và https', verify: 'KHACH-NGOAI: telnet 203.0.113.10 80 / 443', check: (a) => tcp(a, 'ext', '203.0.113.10', 80) && tcp(a, 'ext', '203.0.113.10', 443) },
      { text: 'SSH (22) tới WEB từ Internet bị chặn; không dòng "permit ip any any"', verify: 'telnet 203.0.113.10 22', check: (a) => !tcp(a, 'ext', '203.0.113.10', 22) && !Object.values(a.d('asa').acls).some((x) => x.asa && x.entries.some((e) => e.action === 'permit' && e.proto === 'ip' && e.src.any && e.dst.any)) },
      { text: 'Nhân viên vẫn ra Internet và vào WEB bằng IP thật; DMZ vẫn không mở được vào inside', verify: 'PC-IN: telnet 8.8.8.8 80 ; telnet 172.16.1.10 80', check: (a) => tcp(a, 'pin', '8.8.8.8', 80) && tcp(a, 'pin', '172.16.1.10', 80) && !tcp(a, 'web', '10.1.1.10', 445) },
      quiz('Trên ASA 8.3+, ACL cho phép khách vào web phải ghi địa chỉ đích nào?', ['IP THẬT của server (172.16.1.10) — ASA bỏ NAT trước khi xét ACL', 'IP public 203.0.113.10', 'IP cổng outside', 'Ghi gì cũng được'], 0, 'Ngược với router IOS: ACL trên cổng outside của router thấy IP public (xét trước NAT).'),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'Vào bằng IP public mà ACL không khớp? → kiểm tra ACL đang ghi IP thật hay IP public.', 'show access-list → hitcnt cho biết dòng nào đang khớp.'],
  },

  // =====================================================================
  // F03 — Ticket: ASA sau khi "đổi người quản trị" (5 lỗi)
  // =====================================================================
  {
    id: 'F03', group: 'sec', lesson: 'Firewall — Xử lý sự cố ASA', level: 3, kind: 'ticket',
    title: 'Ticket ASA: nhân viên mất Internet, web công ty không vào được (5 lỗi)',
    story: '🎫 Thiết kế chuẩn (đúng) giống F01 + F02: outside 0 / inside 100 / dmz 50, default route qua ISP 203.0.113.1, LAN 10.1.1.0/24 PAT ra IP outside, WEB 172.16.1.10 publish bằng 203.0.113.10 chỉ HTTP/HTTPS, ICMP được inspect. Sau khi nhà thầu "tối ưu" cấu hình: nhân viên không vào được Internet, khách không vào được web. Tìm và sửa bằng show nameif / show route / show nat / show xlate / show access-list / show running-config. Không được dùng "permit ip any any".',
    build: asaNet,
    init: [ISP, ['asa', cfg('interface g1/1', 'nameif outside', 'ip address 203.0.113.2 255.255.255.0', 'no shutdown', 'interface g1/2', 'nameif inside', 'security-level 0', 'ip address 10.1.1.1 255.255.255.0', 'no shutdown', 'interface g1/3', 'nameif dmz', 'security-level 50', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown', 'exit',
      'route outside 0.0.0.0 0.0.0.0 203.0.113.254', 'object network INSIDE-NET', 'subnet 10.1.2.0 255.255.255.0', 'nat (inside,outside) dynamic interface', 'exit', ...ASA_ICMP,
      'object network WEB', 'host 172.16.1.10', 'nat (dmz,outside) static 203.0.113.10', 'exit',
      'access-list OUTSIDE_IN extended permit tcp any host 203.0.113.10 eq www', 'access-list OUTSIDE_IN extended permit tcp any host 203.0.113.10 eq https', 'access-group OUTSIDE_IN in interface dmz')]],
    guide: [
      { dev: 'asa', title: '1. Lỗi security-level: inside đang là 0', why: '"show nameif": inside = 0, bằng outside → cùng mức nên bị chặn (và thấp hơn dmz). Trả về 100.', cmds: ['interface g1/2', 'security-level 100', 'exit'] },
      { dev: 'asa', title: '2. Lỗi default route: next-hop sai', why: '"show route": next-hop 203.0.113.254 không tồn tại (ISP là .1) → ARP không ai trả lời.', cmds: ['no route outside 0.0.0.0 0.0.0.0 203.0.113.254', 'route outside 0.0.0.0 0.0.0.0 203.0.113.1'] },
      { dev: 'asa', title: '3. Lỗi NAT: object sai dải', why: '"show nat" / "show xlate": object INSIDE-NET là 10.1.2.0/24 trong khi LAN là 10.1.1.0/24 → không ai được NAT, ISP vứt gói private.', cmds: ['object network INSIDE-NET', 'subnet 10.1.1.0 255.255.255.0', 'exit'] },
      { dev: 'asa', title: '4. Lỗi ACL: ghi IP public', why: 'ASA 8.3+ xét ACL theo IP THẬT → dòng "host 203.0.113.10" không bao giờ khớp. Xoá ACL, viết lại theo 172.16.1.10.', cmds: ['no access-list OUTSIDE_IN', 'access-list OUTSIDE_IN extended permit tcp any host 172.16.1.10 eq www', 'access-list OUTSIDE_IN extended permit tcp any host 172.16.1.10 eq https'] },
      { dev: 'asa', title: '5. Lỗi access-group: áp nhầm cổng', why: 'ACL cho khách từ Internet phải áp chiều IN trên cổng OUTSIDE (nơi gói đi vào), không phải dmz.', cmds: ['no access-group OUTSIDE_IN in interface dmz', 'access-group OUTSIDE_IN in interface outside'] },
    ],
    tasks: [
      { text: 'PC-IN mở được web 8.8.8.8 và ping được 8.8.8.8', verify: 'telnet 8.8.8.8 80 ; ping 8.8.8.8', check: (a) => tcp(a, 'pin', '8.8.8.8', 80) && a.ping('pin', '8.8.8.8') },
      { text: 'Bảng route ASA: default qua 203.0.113.1', verify: 'show route', check: (a) => a.route('asa', '0.0.0.0/0')?.nextHop === '203.0.113.1' },
      { text: 'Khách ngoài vào được http/https://203.0.113.10, SSH vẫn bị chặn', verify: 'KHACH-NGOAI: telnet 203.0.113.10 80', check: (a) => tcp(a, 'ext', '203.0.113.10', 80) && tcp(a, 'ext', '203.0.113.10', 443) && !tcp(a, 'ext', '203.0.113.10', 22) },
      { text: 'Ràng buộc: inside = 100, ACL áp trên outside, không "permit ip any any"', verify: 'show nameif ; show access-list', check: (a) => nif(a, 'g1/2').secLevel === 100 && !!nif(a, 'g1/1').aclIn && !nif(a, 'g1/3').aclIn && !Object.values(a.d('asa').acls).some((x) => x.asa && x.entries.some((e) => e.action === 'permit' && e.proto === 'ip' && e.src.any && e.dst.any)) },
      { text: 'DMZ vẫn không mở kết nối vào inside', verify: 'WEB-DMZ → 10.1.1.10', check: (a) => !tcp(a, 'web', '10.1.1.10', 445) },
    ],
    hints: ['Có 5 lỗi. Đi từ dưới lên: nameif/security-level → route → NAT → ACL → access-group.', 'show nameif · show route · show nat · show xlate · show access-list (hitcnt = 0 nghĩa là dòng đó chưa từng khớp).', 'Mở "🧭 Cách giải chi tiết" nếu bí.'],
  },

  // =====================================================================
  // F04 — 1 IP public: port forwarding + 2 DMZ cùng security-level
  // =====================================================================
  {
    id: 'F04', group: 'sec', lesson: 'Firewall — ASA port forwarding & same-security', level: 3, kind: 'project',
    title: 'ASA chỉ có 1 IP public: port forwarding web/SSH + 2 DMZ cùng mức bảo mật',
    story: 'Startup Mây Xanh chỉ được ISP cấp 1 IP public 203.0.113.2 (chính là cổng outside). Hai vùng DMZ cùng security-level 50: dmz-web (G1/3, 172.16.1.0/24, WEB 172.16.1.10 chạy HTTP 80 + SSH 22) và dmz-db (G1/4, 172.16.2.0/24, DB 172.16.2.20 cổng 3306). Yêu cầu: khách ngoài vào web qua 203.0.113.2:8080 và quản trị viên SSH qua 203.0.113.2:2222 (port forwarding); WEB được truy vấn DB cổng 3306 (2 vùng cùng mức); DB không bao giờ lộ ra Internet. Cổng, IP, route và NAT cho inside đã cấu hình sẵn.',
    build: () => makeNet([
      pc('ext', 'KHACH-NGOAI', 930, 140, { ip: '198.51.100.66', gw: '198.51.100.1' }),
      router('isp', 'ISP', 720, 140, ['g0/0', 'g0/2']),
      firewall('asa', 'ASA', 480, 140, ['g1/1', 'g1/2', 'g1/3', 'g1/4'], 'asa'),
      pc('pin', 'PC-ADMIN', 240, 140, { ip: '10.1.1.10', gw: '10.1.1.1' }),
      server('web', 'WEB', 360, 330, { ip: '172.16.1.10', gw: '172.16.1.1', services: [80, 22] }),
      server('db', 'DB', 620, 330, { ip: '172.16.2.20', gw: '172.16.2.1', services: [3306] }),
    ], [['asa', 'g1/1', 'isp', 'g0/0'], ['isp', 'g0/2', 'ext', 'fa0'], ['asa', 'g1/2', 'pin', 'fa0'], ['asa', 'g1/3', 'web', 'fa0'], ['asa', 'g1/4', 'db', 'fa0']]),
    init: [
      ['isp', cfg('hostname ISP', 'interface g0/0', 'ip address 203.0.113.1 255.255.255.0', 'no shutdown', 'interface g0/2', 'ip address 198.51.100.1 255.255.255.0', 'no shutdown')],
      ['asa', cfg('interface g1/1', 'nameif outside', 'ip address 203.0.113.2 255.255.255.0', 'no shutdown', 'interface g1/2', 'nameif inside', 'ip address 10.1.1.1 255.255.255.0', 'no shutdown',
        'interface g1/3', 'nameif dmz-web', 'security-level 50', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown', 'interface g1/4', 'nameif dmz-db', 'security-level 50', 'ip address 172.16.2.1 255.255.255.0', 'no shutdown', 'exit', ...ASA_NAT, ...ASA_ICMP)],
    ],
    guide: [
      { dev: 'asa', title: '1. Port forwarding (static PAT) bằng IP cổng outside', why: 'Mỗi cặp cổng cần 1 object riêng: "nat (dmz-web,outside) static interface service tcp <port-thật> <port-public>". Khách gõ 203.0.113.2:8080 → ASA đổi thành 172.16.1.10:80.', cmds: ['object network WEB-HTTP', 'host 172.16.1.10', 'nat (dmz-web,outside) static interface service tcp 80 8080', 'object network WEB-SSH', 'host 172.16.1.10', 'nat (dmz-web,outside) static interface service tcp 22 2222', 'exit'] },
      { dev: 'asa', title: '2. ACL outside: IP thật + PORT THẬT', why: 'ACL xét sau khi đã dịch NAT → ghi 172.16.1.10 cổng 80 và 22 (không phải 8080/2222). Thực tế nên giới hạn nguồn SSH theo IP quản trị; lab để any cho gọn.', cmds: ['access-list OUTSIDE_IN extended permit tcp any host 172.16.1.10 eq www', 'access-list OUTSIDE_IN extended permit tcp any host 172.16.1.10 eq ssh', 'access-group OUTSIDE_IN in interface outside'] },
      { dev: 'asa', title: '3. Cho 2 DMZ cùng mức nói chuyện', why: 'dmz-web và dmz-db cùng security-level 50 → mặc định bị chặn. "same-security-traffic permit inter-interface" mở luồng giữa các cổng cùng mức (vẫn stateful).', cmds: ['same-security-traffic permit inter-interface'] },
    ],
    tasks: [
      { text: 'Khách ngoài mở được web qua 203.0.113.2:8080', verify: 'KHACH-NGOAI: telnet 203.0.113.2 8080', check: (a) => tcp(a, 'ext', '203.0.113.2', 8080) },
      { text: 'SSH quản trị qua 203.0.113.2:2222', verify: 'telnet 203.0.113.2 2222', check: (a) => tcp(a, 'ext', '203.0.113.2', 2222) },
      { text: 'ACL outside ghi IP thật + port thật (80/22), áp chiều in', verify: 'show access-list', check: (a) => { const n = nif(a, 'g1/1').aclIn; const acl = n && a.d('asa').acls[n]; return !!acl && acl.entries.some((e) => e.dst.ip === '172.16.1.10' && e.dport?.port === 80) && acl.entries.some((e) => e.dst.ip === '172.16.1.10' && e.dport?.port === 22); } },
      { text: 'WEB truy vấn được DB cổng 3306 (2 vùng cùng mức 50)', verify: 'WEB: telnet 172.16.2.20 3306', check: (a) => tcp(a, 'web', '172.16.2.20', 3306) && a.d('asa').fw.sameSec },
      { text: 'DB không lộ ra Internet; DMZ không vào được inside', verify: 'KHACH-NGOAI: telnet 203.0.113.2 3306', check: (a) => !tcp(a, 'ext', '203.0.113.2', 3306) && !tcp(a, 'ext', '172.16.2.20', 3306) && !tcp(a, 'db', '10.1.1.10', 22) },
      quiz('Khách gõ 203.0.113.2:8080. ACL trên outside phải cho phép port nào?', ['80 — ACL xét sau khi ASA đã dịch về port thật', '8080', 'Cả 2', '2222'], 0),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'Port forwarding trên ASA: object network + "nat (dmz-web,outside) static interface service tcp 80 8080".', 'Hai cổng cùng security-level: same-security-traffic permit inter-interface.'],
  },
  // =====================================================================
  // Z01–Z03 — Cisco IOS Zone-Based Firewall
  // =====================================================================
  {
    id: 'Z01', group: 'sec', lesson: 'Firewall — Zone-Based Firewall (IOS)', level: 2, kind: 'config',
    title: 'Zone-Based Firewall trên router: INSIDE → OUTSIDE chỉ cho web, DNS, ping',
    story: 'Chi nhánh Bình Minh không có firewall riêng — biến router biên R-FW thành firewall bằng Zone-Based Firewall (ZBF). R-FW đã có IP, default route và NAT PAT. Chính sách: nhân viên (zone INSIDE, G0/0) ra Internet (zone OUTSIDE, G0/1) chỉ bằng HTTP, HTTPS, DNS và ping; mọi thứ khác (vd Telnet ra ngoài) bị chặn; Internet không tự mở kết nối vào trong. Tên đặt theo thiết kế: class-map INTERNET-CM, policy-map IN-OUT-PM, zone-pair IN-OUT.',
    build: zbfNet,
    init: [ISP, ['rfw', cfg(...RFW)]],
    guide: [
      { dev: 'rfw', title: '1. Tạo 2 zone', why: 'Zone = nhóm cổng cùng mức tin cậy. Mặc định: cùng zone → thông; khác zone → CHẶN trừ khi có zone-pair cho phép; cổng có zone ↔ cổng không zone → chặn.', cmds: ['zone security INSIDE', 'exit', 'zone security OUTSIDE', 'exit'] },
      { dev: 'rfw', title: '2. Class-map: chọn traffic', why: '"match-any" = khớp 1 trong các giao thức. ZBF nhận diện http/https/dns/icmp theo giao thức + cổng.', cmds: ['class-map type inspect match-any INTERNET-CM', 'match protocol http', 'match protocol https', 'match protocol dns', 'match protocol icmp', 'exit'] },
      { dev: 'rfw', title: '3. Policy-map: inspect = stateful', why: '"inspect" ghi phiên → gói trả lời tự được về. "pass" chỉ cho 1 chiều (chiều về cần policy riêng). class-default luôn ở cuối: drop.', cmds: ['policy-map type inspect IN-OUT-PM', 'class type inspect INTERNET-CM', 'inspect', 'exit', 'class class-default', 'drop', 'exit', 'exit'] },
      { dev: 'rfw', title: '4. Zone-pair + gán cổng vào zone', why: 'Zone-pair có HƯỚNG: source INSIDE → destination OUTSIDE. Không tạo zone-pair OUTSIDE → INSIDE ⇒ Internet không mở kết nối vào được, chỉ có gói trả lời của phiên inspect.', cmds: ['zone-pair security IN-OUT source INSIDE destination OUTSIDE', 'service-policy type inspect IN-OUT-PM', 'exit', 'interface g0/0', 'zone-member security INSIDE', 'interface g0/1', 'zone-member security OUTSIDE'] },
    ],
    tasks: [
      { text: 'Zone INSIDE (G0/0) và OUTSIDE (G0/1)', verify: 'show zone security', check: (a) => a.d('rfw').ifaces['g0/0'].zone === 'INSIDE' && a.d('rfw').ifaces['g0/1'].zone === 'OUTSIDE' },
      { text: 'Zone-pair IN-OUT (INSIDE → OUTSIDE) dùng policy IN-OUT-PM, class INTERNET-CM = inspect, class-default = drop', verify: 'show zone-pair security', check: (a) => { const z = a.d('rfw').zbf; const p = z?.pairs.find((x) => x.name === 'IN-OUT'); const pm = z?.policyMaps['IN-OUT-PM']; return p?.src === 'INSIDE' && p.dst === 'OUTSIDE' && p.policy === 'IN-OUT-PM' && pm?.find((e) => e.cls === 'INTERNET-CM')?.action === 'inspect' && pm.at(-1).cls === 'class-default' && pm.at(-1).action === 'drop'; } },
      { text: 'Nhân viên vào web (80/443) và ping được 8.8.8.8', verify: 'telnet 8.8.8.8 80 ; ping 8.8.8.8 ; show policy-map type inspect zone-pair sessions', check: (a) => tcp(a, 'pin', '8.8.8.8', 80) && tcp(a, 'pin2', '8.8.8.8', 443) && a.ping('pin', '8.8.8.8') },
      { text: 'Telnet ra Internet bị chặn (rơi vào class-default)', verify: 'telnet 8.8.8.8', check: (a) => !tcp(a, 'pin', '8.8.8.8', 23) },
      { text: 'Không có zone-pair OUTSIDE → INSIDE', verify: 'show zone-pair security', check: (a) => !(a.d('rfw').zbf?.pairs || []).some((p) => p.src === 'OUTSIDE' && p.dst === 'INSIDE') },
      quiz('Đổi "inspect" thành "pass" trong IN-OUT-PM thì web còn chạy không?', ['Không — pass không ghi phiên, gói trả lời OUTSIDE → INSIDE không có zone-pair nên bị drop', 'Vẫn chạy bình thường', 'Chỉ HTTPS chạy', 'Router tự thêm zone-pair chiều về'], 0),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'Thứ tự: zone → class-map → policy-map → zone-pair → zone-member trên cổng.', 'Gán zone cho cổng xong mà chưa có zone-pair thì MỌI traffic qua router bị chặn.'],
  },
  {
    id: 'Z02', group: 'sec', lesson: 'Firewall — ZBF 3 zone + DMZ', level: 3, kind: 'config',
    title: 'ZBF 3 zone: publish web DMZ ra Internet, DMZ không vào được INSIDE',
    story: 'R-FW đã chạy ZBF như Z01 (INSIDE ↔ OUTSIDE). Thêm zone DMZ cho G0/2 (WEB 172.16.1.10, đã NAT tĩnh ra 203.0.113.10). Chính sách: (1) Internet chỉ vào được WEB bằng HTTP/HTTPS — class-map OUT-DMZ-CM match-all theo ACL WEB-SERVER (viết theo IP THẬT vì NAT dịch trước khi ZBF xét); (2) nhân viên vào DMZ mọi TCP + ping (class-map IN-DMZ-CM); (3) DMZ không được mở kết nối vào INSIDE.',
    build: zbfNet,
    init: [ISP, ['rfw', cfg(...RFW, 'interface g0/2', 'ip address 172.16.1.1 255.255.255.0', 'ip nat inside', 'no shutdown', 'exit', 'ip nat inside source static 172.16.1.10 203.0.113.10', ...ZBF_BASE)]],
    guide: [
      { dev: 'rfw', title: '1. Zone DMZ + gán G0/2', why: 'Đưa G0/2 vào zone ngay: nếu để G0/2 ngoài zone thì mọi traffic giữa nó và zone khác bị chặn.', cmds: ['zone security DMZ', 'exit', 'interface g0/2', 'zone-member security DMZ', 'exit'] },
      { dev: 'rfw', title: '2. Internet → WEB: ACL + class-map match-all', why: 'ACL chọn đúng server + cổng (IP thật 172.16.1.10). Zone-pair OUT-DMZ hướng OUTSIDE → DMZ, inspect để phản hồi tự về.', cmds: ['ip access-list extended WEB-SERVER', 'permit tcp any host 172.16.1.10 eq www', 'permit tcp any host 172.16.1.10 eq 443', 'exit', 'class-map type inspect match-all OUT-DMZ-CM', 'match access-group name WEB-SERVER', 'exit', 'policy-map type inspect OUT-DMZ-PM', 'class type inspect OUT-DMZ-CM', 'inspect', 'exit', 'exit', 'zone-pair security OUT-DMZ source OUTSIDE destination DMZ', 'service-policy type inspect OUT-DMZ-PM', 'exit'] },
      { dev: 'rfw', title: '3. INSIDE → DMZ', why: 'Nhân viên quản trị/truy cập server: cho mọi TCP + ICMP, stateful. KHÔNG tạo DMZ → INSIDE: server bị chiếm cũng không quét được mạng nội bộ.', cmds: ['class-map type inspect match-any IN-DMZ-CM', 'match protocol tcp', 'match protocol icmp', 'exit', 'policy-map type inspect IN-DMZ-PM', 'class type inspect IN-DMZ-CM', 'inspect', 'exit', 'exit', 'zone-pair security IN-DMZ source INSIDE destination DMZ', 'service-policy type inspect IN-DMZ-PM'] },
    ],
    tasks: [
      { text: 'G0/2 thuộc zone DMZ', verify: 'show zone security', check: (a) => a.d('rfw').ifaces['g0/2'].zone === 'DMZ' },
      { text: 'Khách ngoài mở được http/https://203.0.113.10; SSH vào WEB bị chặn', verify: 'KHACH-NGOAI: telnet 203.0.113.10 80', check: (a) => tcp(a, 'ext', '203.0.113.10', 80) && tcp(a, 'ext', '203.0.113.10', 443) && !tcp(a, 'ext', '203.0.113.10', 22) },
      { text: 'Nhân viên vào WEB (80, 22) và ping được 172.16.1.10; vẫn ra Internet', verify: 'PC-IN: telnet 172.16.1.10 22', check: (a) => tcp(a, 'pin', '172.16.1.10', 80) && tcp(a, 'pin', '172.16.1.10', 22) && a.ping('pin', '172.16.1.10') && tcp(a, 'pin', '8.8.8.8', 80) },
      { text: 'DMZ không mở được kết nối vào INSIDE; không có zone-pair DMZ → INSIDE', verify: 'WEB-DMZ → 10.1.1.10', check: (a) => !tcp(a, 'web', '10.1.1.10', 445) && !(a.d('rfw').zbf?.pairs || []).some((p) => p.src === 'DMZ' && p.dst === 'INSIDE') },
      quiz('Class-map OUT-DMZ-CM match theo ACL ghi địa chỉ nào cho WEB?', ['172.16.1.10 (IP thật) — NAT tĩnh dịch đích ở cổng outside trước khi ZBF xét', '203.0.113.10', 'Địa chỉ cổng G0/1', 'any'], 0),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'Mỗi hướng cần 1 zone-pair riêng (OUTSIDE→DMZ, INSIDE→DMZ).', 'show policy-map type inspect zone-pair sessions — xem phiên đang mở theo từng zone-pair.'],
  },
  {
    id: 'Z03', group: 'sec', lesson: 'Firewall — Xử lý sự cố ZBF', level: 3, kind: 'ticket',
    title: 'Ticket ZBF: sau khi bật firewall trên router, cả công ty "mất mạng" (4 lỗi)',
    story: '🎫 Thiết kế đúng = Z02: zone INSIDE (G0/0), OUTSIDE (G0/1), DMZ (G0/2); zone-pair IN-OUT inspect web/dns/ping, OUT-DMZ inspect HTTP/HTTPS tới WEB, IN-DMZ inspect TCP + ping; KHÔNG có zone-pair nào đi vào INSIDE. Kỹ sư bật ZBF xong thì: nhân viên không vào được gì, khách không vào được web. Dùng show zone security / show zone-pair security / show running-config | section policy-map để tìm lỗi.',
    build: zbfNet,
    init: [ISP, ['rfw', cfg(...RFW, 'interface g0/2', 'ip address 172.16.1.1 255.255.255.0', 'ip nat inside', 'no shutdown', 'exit', 'ip nat inside source static 172.16.1.10 203.0.113.10',
      'zone security INSIDE', 'exit', 'zone security OUTSIDE', 'exit', 'zone security DMZ', 'exit',
      'class-map type inspect match-any INTERNET-CM', 'match protocol http', 'match protocol https', 'match protocol dns', 'match protocol icmp', 'exit',
      'policy-map type inspect IN-OUT-PM', 'class type inspect INTERNET-CM', 'pass', 'exit', 'class class-default', 'drop', 'exit', 'exit',
      'zone-pair security IN-OUT source INSIDE destination OUTSIDE', 'service-policy type inspect IN-OUT-PM', 'exit',
      'ip access-list extended WEB-SERVER', 'permit tcp any host 172.16.1.10 eq www', 'permit tcp any host 172.16.1.10 eq 443', 'exit',
      'class-map type inspect match-all OUT-DMZ-CM', 'match access-group name WEB-SERVER', 'exit', 'policy-map type inspect OUT-DMZ-PM', 'class type inspect OUT-DMZ-CM', 'inspect', 'exit', 'exit',
      'zone-pair security OUT-DMZ source DMZ destination OUTSIDE', 'service-policy type inspect OUT-DMZ-PM', 'exit',
      'class-map type inspect match-any IN-DMZ-CM', 'match protocol tcp', 'match protocol icmp', 'exit', 'policy-map type inspect IN-DMZ-PM', 'class type inspect IN-DMZ-CM', 'inspect', 'exit', 'exit',
      'zone-pair security IN-DMZ source INSIDE destination DMZ', 'exit',
      'interface g0/1', 'zone-member security OUTSIDE', 'interface g0/2', 'zone-member security DMZ')]],
    guide: [
      { dev: 'rfw', title: '1. Lỗi: G0/0 chưa thuộc zone nào', why: '"show zone security": zone INSIDE không có cổng. G0/0 ngoài zone ↔ G0/1 có zone → mọi gói bị chặn.', cmds: ['interface g0/0', 'zone-member security INSIDE', 'exit'] },
      { dev: 'rfw', title: '2. Lỗi: IN-OUT dùng "pass" thay vì "inspect"', why: 'pass không ghi phiên → gói trả lời từ Internet (OUTSIDE → INSIDE) không có zone-pair → drop. Đổi sang inspect.', cmds: ['policy-map type inspect IN-OUT-PM', 'class type inspect INTERNET-CM', 'inspect', 'exit', 'exit'] },
      { dev: 'rfw', title: '3. Lỗi: zone-pair OUT-DMZ bị NGƯỢC hướng', why: '"show zone-pair security": source DMZ → destination OUTSIDE, trong khi khách đi từ OUTSIDE vào DMZ. Xoá và tạo lại đúng hướng.', cmds: ['no zone-pair security OUT-DMZ', 'zone-pair security OUT-DMZ source OUTSIDE destination DMZ', 'service-policy type inspect OUT-DMZ-PM', 'exit'] },
      { dev: 'rfw', title: '4. Lỗi: IN-DMZ chưa gắn service-policy', why: 'Zone-pair không có policy = drop hết.', cmds: ['zone-pair security IN-DMZ source INSIDE destination DMZ', 'service-policy type inspect IN-DMZ-PM'] },
    ],
    tasks: [
      { text: 'Nhân viên vào web Internet và ping được 8.8.8.8', verify: 'telnet 8.8.8.8 80 ; ping 8.8.8.8', check: (a) => tcp(a, 'pin', '8.8.8.8', 80) && a.ping('pin', '8.8.8.8') },
      { text: 'Khách ngoài vào được http://203.0.113.10', verify: 'KHACH-NGOAI: telnet 203.0.113.10 80', check: (a) => tcp(a, 'ext', '203.0.113.10', 80) && !tcp(a, 'ext', '203.0.113.10', 22) },
      { text: 'Nhân viên vào được WEB-DMZ', verify: 'PC-IN: telnet 172.16.1.10 80', check: (a) => tcp(a, 'pin', '172.16.1.10', 80) },
      { text: 'Ràng buộc: không zone-pair nào đi VÀO INSIDE; Telnet ra Internet vẫn bị chặn', verify: 'show zone-pair security', check: (a) => !(a.d('rfw').zbf?.pairs || []).some((p) => p.dst === 'INSIDE') && !tcp(a, 'pin', '8.8.8.8', 23) },
    ],
    hints: ['Có 4 lỗi. Bắt đầu bằng: show zone security (cổng nào thuộc zone nào?).', 'show zone-pair security: kiểm tra HƯỚNG source/destination và service-policy.', 'show running-config | section policy-map: action của từng class là inspect, pass hay drop?'],
  },
];
