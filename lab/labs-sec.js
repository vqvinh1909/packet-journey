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

// ---------------------------------------------------------------- firewall các hãng: topology dùng chung
//  PC-IN, PC-IN2 — SW-IN — FW (LAN) | FW (DMZ) — WEB-DMZ | FW (WAN) — ISP — INTERNET + KHACH-NGOAI
const fwNet = (os, [wan, lan, dmz]) => makeNet([
  server('inet', 'INTERNET 8.8.8.8', 930, 70, { ip: '8.8.8.8', gw: '8.8.8.1', services: [80, 443, 23, 53] }),
  pc('ext', 'KHACH-NGOAI', 930, 240, { ip: '198.51.100.66', gw: '198.51.100.1' }),
  router('isp', 'ISP', 720, 140, ['g0/0', 'g0/1', 'g0/2']),
  firewall('fw', { fortios: 'FortiGate', panos: 'PA-VM', sophos: 'SOPHOS-XG', checkpoint: 'CP-GW', pfsense: 'pfSense' }[os] || 'FW', 480, 140, [wan, lan, dmz], os),
  server('web', 'WEB-DMZ', 480, 330, { ip: '172.16.1.10', gw: '172.16.1.1', services: [80, 443, 22] }),
  sw('swin', 'SW-IN', 240, 140, ['fa0/1', 'fa0/2', 'g0/1']),
  pc('pin', 'PC-IN', 90, 260, { ip: '10.1.1.10', gw: '10.1.1.1', services: [445] }),
  pc('pin2', 'PC-IN2', 260, 320, { ip: '10.1.1.11', gw: '10.1.1.1', services: [445] }),
], [['isp', 'g0/1', 'inet', 'fa0'], ['isp', 'g0/2', 'ext', 'fa0'], ['fw', wan, 'isp', 'g0/0'], ['fw', dmz, 'web', 'fa0'], ['fw', lan, 'swin', 'g0/1'], ['pin', 'fa0', 'swin', 'fa0/1'], ['pin2', 'fa0', 'swin', 'fa0/2']]);
const fi = (a, n) => a.d('fw').ifaces[n];
const FG_BASE = ['config system interface', 'edit port1', 'set ip 203.0.113.2 255.255.255.0', 'next', 'edit port2', 'set ip 10.1.1.1 255.255.255.0', 'next', 'edit port3', 'set ip 172.16.1.1 255.255.255.0', 'next', 'end',
  'config router static', 'edit 1', 'set gateway 203.0.113.1', 'set device port1', 'next', 'end', 'config firewall address', 'edit LAN_NET', 'set subnet 10.1.1.0 255.255.255.0', 'next', 'end',
  'config firewall policy', 'edit 1', 'set srcintf port2', 'set dstintf port1', 'set srcaddr LAN_NET', 'set dstaddr all', 'set action accept', 'set schedule always', 'set service HTTP HTTPS DNS PING', 'set nat enable', 'next', 'edit 2', 'set srcintf port2', 'set dstintf port3', 'set srcaddr LAN_NET', 'set dstaddr all', 'set action accept', 'set schedule always', 'set service ALL', 'next', 'end'];
const PA_BASE = ['configure', 'set network interface ethernet ethernet1/1 layer3 ip 203.0.113.2/24', 'set network interface ethernet ethernet1/2 layer3 ip 10.1.1.1/24', 'set network interface ethernet ethernet1/3 layer3 ip 172.16.1.1/24', 'set zone untrust network layer3 ethernet1/1', 'set zone trust network layer3 ethernet1/2', 'set zone dmz network layer3 ethernet1/3', 'set network virtual-router default interface [ ethernet1/1 ethernet1/2 ethernet1/3 ]', 'set network virtual-router default routing-table ip static-route default destination 0.0.0.0/0 nexthop ip-address 203.0.113.1',
  'set rulebase security rules LAN-OUT from trust to untrust source any destination any application [ web-browsing ssl dns ping ] service application-default action allow', 'set rulebase security rules LAN-DMZ from trust to dmz source any destination any application any service any action allow', 'set rulebase nat rules SNAT from trust to untrust source any destination any service any source-translation dynamic-ip-and-port interface-address interface ethernet1/1'];

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
  // =====================================================================
  // FG01–FG02 — FortiGate (FortiOS)
  // =====================================================================
  {
    id: 'FG01', group: 'sec', lesson: 'Firewall — FortiGate cơ bản', level: 2, kind: 'config',
    title: 'FortiGate cơ bản: interface, route, address, policy LAN → WAN có NAT',
    story: 'Công ty Hoa Sen lắp FortiGate (FortiOS) làm firewall biên. Cổng: port1 = WAN (203.0.113.2/24, gateway ISP 203.0.113.1), port2 = LAN (10.1.1.1/24), port3 = DMZ (172.16.1.1/24, máy chủ WEB-DMZ). Chính sách: LAN ra Internet chỉ HTTP, HTTPS, DNS, PING và phải NAT ra IP port1; LAN vào DMZ mọi dịch vụ (không NAT); DMZ không được chủ động vào LAN. Đặt address object LAN_NET cho dải LAN.',
    build: () => fwNet('fortios', ['port1', 'port2', 'port3']),
    init: [ISP],
    guide: [
      { dev: 'fw', raw: true, title: '1. Cấu hình interface', why: 'FortiOS cấu hình theo khối: config <bảng> → edit <mục> → set ... → next → end. Mỗi cổng có IP/mask; "allowaccess ping" chỉ là quyền quản trị tới chính FortiGate.', cmds: ['config system interface', 'edit port1', 'set ip 203.0.113.2 255.255.255.0', 'set allowaccess ping', 'next', 'edit port2', 'set ip 10.1.1.1 255.255.255.0', 'set allowaccess ping https ssh', 'next', 'edit port3', 'set ip 172.16.1.1 255.255.255.0', 'next', 'end'] },
      { dev: 'fw', raw: true, title: '2. Default route + address object', why: 'Static route: gateway + device. Address object đặt tên cho dải IP để dùng trong policy (dễ đọc, sửa một chỗ).', cmds: ['config router static', 'edit 1', 'set gateway 203.0.113.1', 'set device port1', 'next', 'end', 'config firewall address', 'edit LAN_NET', 'set subnet 10.1.1.0 255.255.255.0', 'next', 'end'] },
      { dev: 'fw', raw: true, title: '3. Policy: LAN → WAN (NAT) và LAN → DMZ', why: 'Policy xét từ trên xuống, khớp là dừng; không khớp policy nào → Implicit Deny (ID 0). "set nat enable" = NAT nguồn ra IP cổng ra (port1). Không cần policy chiều về: FortiGate stateful.', cmds: ['config firewall policy', 'edit 1', 'set name "LAN-ra-Internet"', 'set srcintf port2', 'set dstintf port1', 'set srcaddr LAN_NET', 'set dstaddr all', 'set action accept', 'set schedule always', 'set service HTTP HTTPS DNS PING', 'set nat enable', 'next', 'edit 2', 'set name "LAN-vao-DMZ"', 'set srcintf port2', 'set dstintf port3', 'set srcaddr LAN_NET', 'set dstaddr all', 'set action accept', 'set schedule always', 'set service ALL', 'next', 'end'] },
    ],
    tasks: [
      { text: 'port1/port2/port3 đúng IP; default route qua 203.0.113.1 (port1)', verify: 'show system interface ; get router info routing-table all', check: (a) => [['port1', '203.0.113.2'], ['port2', '10.1.1.1'], ['port3', '172.16.1.1']].every(([n, ip]) => fi(a, n).ip === ip && a.up('fw', n)) && a.route('fw', '0.0.0.0/0')?.nextHop === '203.0.113.1' },
      { text: 'LAN ra Internet: web 80/443 + ping 8.8.8.8 (có NAT — ISP không có route về LAN)', verify: 'PC-IN: telnet 8.8.8.8 80 ; ping 8.8.8.8 ; FortiGate: get system session list', check: (a) => a.d('isp').routes.length === 0 && tcp(a, 'pin', '8.8.8.8', 80) && tcp(a, 'pin2', '8.8.8.8', 443) && a.ping('pin', '8.8.8.8') },
      { text: 'Dịch vụ khác ra Internet (Telnet 23) bị Implicit Deny', verify: 'telnet 8.8.8.8', check: (a) => !tcp(a, 'pin', '8.8.8.8', 23) },
      { text: 'LAN vào DMZ mọi dịch vụ (80, 22); DMZ KHÔNG mở được vào LAN', verify: 'PC-IN: telnet 172.16.1.10 22', check: (a) => tcp(a, 'pin', '172.16.1.10', 80) && tcp(a, 'pin', '172.16.1.10', 22) && !tcp(a, 'web', '10.1.1.10', 445) },
      { text: 'Dùng address object LAN_NET (10.1.1.0/24) làm srcaddr', verify: 'show firewall address ; show firewall policy', check: (a) => { const F = a.d('fw').forti; return F?.addr.LAN_NET?.subnet?.ip === '10.1.1.0' && F.addr.LAN_NET.subnet.prefix === 24 && Object.values(F.pol).some((p) => (p.srcaddr || []).includes('LAN_NET')); } },
      quiz('Không có policy nào khớp gói thì FortiGate làm gì?', ['Chặn — Implicit Deny (policy ID 0) ở cuối danh sách', 'Cho qua', 'Gửi cảnh báo nhưng vẫn cho qua', 'Chuyển sang policy đầu tiên'], 0),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'Nhập sai tên object/cổng → "entry not found in datasource".', 'get system session list: xem phiên + cột SOURCE-NAT.'],
  },
  {
    id: 'FG02', group: 'sec', lesson: 'Firewall — FortiGate VIP & thứ tự policy', level: 3, kind: 'ticket',
    title: 'FortiGate: publish web bằng VIP — và vì sao policy mới "không ăn"',
    story: '🎫 FortiGate đã chạy như FG01. Nhóm bảo mật thêm sẵn policy 3 "chan-WAN-vao-DMZ" (WAN → DMZ, ALL, deny) để chặn quét cổng. Giờ cần publish WEB-DMZ ra Internet bằng IP 203.0.113.10: tạo VIP WEB_VIP (203.0.113.10 → 172.16.1.10 trên port1) và policy ID 4 WAN → DMZ chỉ HTTP/HTTPS tới WEB_VIP. Tạo xong mà khách vẫn không vào được… Hãy tìm hiểu vì sao và sửa (không xoá policy 3).',
    build: () => fwNet('fortios', ['port1', 'port2', 'port3']),
    init: [ISP, ['fw', [...FG_BASE, 'config firewall policy', 'edit 3', 'set name "chan-WAN-vao-DMZ"', 'set srcintf port1', 'set dstintf port3', 'set srcaddr all', 'set dstaddr all', 'set action deny', 'set schedule always', 'set service ALL', 'next', 'end']]],
    guide: [
      { dev: 'fw', raw: true, title: '1. VIP (DNAT) cho WEB', why: 'VIP = Virtual IP: gói tới 203.0.113.10 trên port1 được đổi đích thành 172.16.1.10. FortiGate tự trả ARP cho IP VIP.', cmds: ['config firewall vip', 'edit WEB_VIP', 'set extip 203.0.113.10', 'set mappedip 172.16.1.10', 'set extintf port1', 'next', 'end'] },
      { dev: 'fw', raw: true, title: '2. Policy 4: WAN → DMZ tới VIP', why: 'Đích của policy là object VIP (không phải "all", không phải IP thật). Chỉ HTTP + HTTPS.', cmds: ['config firewall policy', 'edit 4', 'set name "Publish-WEB"', 'set srcintf port1', 'set dstintf port3', 'set srcaddr all', 'set dstaddr WEB_VIP', 'set action accept', 'set schedule always', 'set service HTTP HTTPS', 'next', 'end'] },
      { dev: 'fw', raw: true, title: '3. Sửa thứ tự: đưa policy 4 lên trước policy 3', why: 'Policy xét theo THỨ TỰ trong danh sách (không theo số ID). Policy 3 (deny ALL) đứng trước nên khớp trước và chặn hết. "move 4 before 3" đổi thứ tự — giữ nguyên policy chặn cho phần còn lại.', cmds: ['config firewall policy', 'move 4 before 3', 'end'] },
    ],
    tasks: [
      { text: 'VIP WEB_VIP: 203.0.113.10 → 172.16.1.10 trên port1', verify: 'show firewall vip', check: (a) => { const v = a.d('fw').forti?.vip.WEB_VIP; return v?.extip === '203.0.113.10' && v.mappedip === '172.16.1.10' && v.extintf === 'port1'; } },
      { text: 'Khách ngoài mở được http/https://203.0.113.10', verify: 'KHACH-NGOAI: telnet 203.0.113.10 80', check: (a) => tcp(a, 'ext', '203.0.113.10', 80) && tcp(a, 'ext', '203.0.113.10', 443) },
      { text: 'SSH (22) vào WEB từ Internet vẫn bị chặn', verify: 'telnet 203.0.113.10 22', check: (a) => !tcp(a, 'ext', '203.0.113.10', 22) },
      { text: 'Policy chặn WAN → DMZ (ID 3) vẫn còn, đứng SAU policy publish', verify: 'show firewall policy', check: (a) => { const o = a.d('fw').forti?.order || []; return o.includes('3') && a.d('fw').forti.pol[3].action === 'deny' && o.some((id, i) => (a.d('fw').forti.pol[id].dstaddr || []).includes('WEB_VIP') && i < o.indexOf('3')); } },
      { text: 'LAN vẫn ra Internet bình thường', verify: 'PC-IN: telnet 8.8.8.8 80', check: (a) => tcp(a, 'pin', '8.8.8.8', 80) },
    ],
    hints: ['Policy mới tạo nằm CUỐI danh sách. Danh sách xét từ trên xuống, khớp là dừng.', 'config firewall policy → move <ID> before <ID>', 'Policy tới server publish dùng dstaddr = tên VIP.'],
  },

  // =====================================================================
  // PA01–PA02 — Palo Alto (PAN-OS)
  // =====================================================================
  {
    id: 'PA01', group: 'sec', lesson: 'Firewall — Palo Alto cơ bản', level: 2, kind: 'config',
    title: 'Palo Alto cơ bản: zone, virtual-router, App-ID, NAT — và đừng quên commit',
    story: 'Công ty Sông Hàn dùng Palo Alto (PAN-OS). Cổng ethernet1/1 = untrust (203.0.113.2/24, gateway 203.0.113.1), ethernet1/2 = trust (10.1.1.1/24), ethernet1/3 = dmz (172.16.1.1/24). Yêu cầu: cả 3 cổng thuộc virtual-router default; rule LAN-OUT cho trust → untrust các ứng dụng web-browsing, ssl, dns, ping (service application-default); NAT rule SNAT: trust → untrust đổi nguồn sang IP ethernet1/1; rule LAN-DMZ cho trust → dmz mọi ứng dụng. Ghi nhớ: trên Palo Alto, "set" chỉ sửa candidate config — phải "commit".',
    build: () => fwNet('panos', ['e1/1', 'e1/2', 'e1/3']),
    init: [ISP],
    guide: [
      { dev: 'fw', raw: true, title: '1. Interface, zone, virtual-router', why: 'Cổng layer3 cần IP + thuộc 1 zone (chính sách viết theo zone) + thuộc virtual-router (thì mới định tuyến).', cmds: ['configure', 'set network interface ethernet ethernet1/1 layer3 ip 203.0.113.2/24', 'set network interface ethernet ethernet1/2 layer3 ip 10.1.1.1/24', 'set network interface ethernet ethernet1/3 layer3 ip 172.16.1.1/24', 'set zone untrust network layer3 ethernet1/1', 'set zone trust network layer3 ethernet1/2', 'set zone dmz network layer3 ethernet1/3', 'set network virtual-router default interface [ ethernet1/1 ethernet1/2 ethernet1/3 ]', 'set network virtual-router default routing-table ip static-route default destination 0.0.0.0/0 nexthop ip-address 203.0.113.1'] },
      { dev: 'fw', raw: true, title: '2. Security rule theo App-ID + NAT rule', why: 'Palo Alto nhận diện ỨNG DỤNG (App-ID); "service application-default" = chỉ cho ứng dụng chạy trên cổng chuẩn của nó. NAT là rulebase riêng, tách khỏi security. Cùng zone mặc định cho phép (intrazone-default), khác zone mặc định chặn (interzone-default).', cmds: ['set rulebase security rules LAN-OUT from trust to untrust source any destination any application [ web-browsing ssl dns ping ] service application-default action allow', 'set rulebase security rules LAN-DMZ from trust to dmz source any destination any application any service any action allow', 'set rulebase nat rules SNAT from trust to untrust source any destination any service any source-translation dynamic-ip-and-port interface-address interface ethernet1/1'] },
      { dev: 'fw', raw: true, title: '3. Commit', why: 'Cho tới bước này MỌI thay đổi chỉ nằm trong candidate config — mạng chưa thay đổi gì. "show config diff" xem trước, "commit" để áp dụng.', cmds: ['show config diff', 'commit', 'exit'] },
    ],
    tasks: [
      { text: 'Đã commit: running config = candidate (không còn thay đổi treo)', verify: 'configure → show config diff', check: (a) => !!a.d('fw').pan && JSON.stringify(a.d('fw').pan.run) === JSON.stringify(a.d('fw').pan.cand) && Object.keys(a.d('fw').pan.run.ifs).length === 3 },
      { text: 'Zone untrust/trust/dmz đúng cổng; cả 3 cổng thuộc virtual-router', verify: 'show interface all', check: (a) => [['e1/1', 'untrust'], ['e1/2', 'trust'], ['e1/3', 'dmz']].every(([n, z]) => fi(a, n).zone === z && a.up('fw', n) && !!fi(a, n).ip) },
      { text: 'trust ra Internet: web, HTTPS, ping (NAT rule SNAT)', verify: 'PC-IN: telnet 8.8.8.8 80 ; show session all', check: (a) => a.d('isp').routes.length === 0 && tcp(a, 'pin', '8.8.8.8', 80) && tcp(a, 'pin2', '8.8.8.8', 443) && a.ping('pin', '8.8.8.8') },
      { text: 'Ứng dụng ngoài danh sách (Telnet 23) bị chặn', verify: 'test security-policy-match from trust to untrust source 10.1.1.10 destination 8.8.8.8 protocol 6 destination-port 23', check: (a) => !tcp(a, 'pin', '8.8.8.8', 23) },
      { text: 'trust vào dmz được; dmz KHÔNG mở được vào trust', verify: 'PC-IN: telnet 172.16.1.10 22', check: (a) => tcp(a, 'pin', '172.16.1.10', 22) && !tcp(a, 'web', '10.1.1.10', 445) },
      quiz('Gõ xong toàn bộ lệnh "set" nhưng chưa commit thì mạng thế nào?', ['Chưa có gì thay đổi — chỉ candidate config bị sửa', 'Đã áp dụng ngay', 'Áp dụng một nửa', 'Firewall khởi động lại'], 0),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'Cổng có IP + zone nhưng chưa vào virtual-router → commit có Warning và không định tuyến được.', 'test security-policy-match ... cho biết rule nào khớp mà không cần gửi gói.'],
  },
  {
    id: 'PA02', group: 'sec', lesson: 'Firewall — Palo Alto DNAT & pre-NAT/post-NAT', level: 3, kind: 'ticket',
    title: 'Palo Alto publish web: rule DNAT đúng mà vẫn bị chặn — bẫy "pre-NAT IP, post-NAT zone"',
    story: '🎫 PA-VM đã chạy như PA01. Kỹ sư thêm sẵn (đã commit): address WEB (172.16.1.10/32), WEB-PUB (203.0.113.10/32), NAT rule DNAT-WEB (untrust → untrust, đích WEB-PUB → dịch thành WEB) và security rule WEB-IN (untrust → dmz, destination WEB, web-browsing + ssl). Khách vẫn không vào được http://203.0.113.10. Sửa rule WEB-IN cho đúng quy tắc của Palo Alto rồi commit. SSH vào WEB từ Internet vẫn phải bị chặn.',
    build: () => fwNet('panos', ['e1/1', 'e1/2', 'e1/3']),
    init: [ISP, ['fw', [...PA_BASE, 'set address WEB ip-netmask 172.16.1.10/32', 'set address WEB-PUB ip-netmask 203.0.113.10/32', 'set rulebase nat rules DNAT-WEB from untrust to untrust source any destination WEB-PUB service any destination-translation translated-address WEB', 'set rulebase security rules WEB-IN from untrust to dmz source any destination WEB application [ web-browsing ssl ] service application-default action allow', 'commit', 'exit']]],
    guide: [
      { dev: 'fw', raw: true, title: '1. Sửa destination của WEB-IN thành IP TRƯỚC NAT', why: 'Quy tắc Palo Alto: security rule so ĐỊA CHỈ theo gói gốc (pre-NAT: 203.0.113.10 = WEB-PUB) nhưng ZONE đích theo kết quả định tuyến sau NAT (dmz). Rule đang ghi WEB (IP thật) nên không bao giờ khớp. (NAT rule thì ngược lại: zone đích pre-NAT = untrust.)', cmds: ['configure', 'set rulebase security rules WEB-IN destination WEB-PUB', 'commit', 'exit'] },
      { dev: 'fw', raw: true, title: '2. Kiểm tra bằng test security-policy-match', why: 'Mô phỏng gói khách vào web: from untrust to dmz, destination là IP public.', cmds: ['test security-policy-match from untrust to dmz source 198.51.100.66 destination 203.0.113.10 protocol 6 destination-port 80'] },
    ],
    tasks: [
      { text: 'Khách ngoài mở được http/https://203.0.113.10', verify: 'KHACH-NGOAI: telnet 203.0.113.10 80', check: (a) => tcp(a, 'ext', '203.0.113.10', 80) && tcp(a, 'ext', '203.0.113.10', 443) },
      { text: 'SSH vào WEB từ Internet vẫn bị chặn', verify: 'telnet 203.0.113.10 22', check: (a) => !tcp(a, 'ext', '203.0.113.10', 22) },
      { text: 'Rule WEB-IN: untrust → dmz, destination = địa chỉ public (pre-NAT); đã commit', verify: 'show running security-policy', check: (a) => { const r = a.d('fw').pan?.run.sec.find((x) => x.name === 'WEB-IN'); return !!r && [r.destination].flat().includes('WEB-PUB') && r.to === 'dmz'; } },
      { text: 'Nhân viên vẫn ra Internet', verify: 'PC-IN: telnet 8.8.8.8 80', check: (a) => tcp(a, 'pin', '8.8.8.8', 80) },
      quiz('Security rule cho khách vào server publish bằng DNAT trên Palo Alto ghi gì?', ['Destination = IP public (trước NAT), zone đích = zone của server (sau NAT)', 'Destination = IP thật, zone đích = untrust', 'Destination = IP thật, zone đích = dmz', 'Destination = IP public, zone đích = untrust'], 0, '"Pre-NAT IP, post-NAT zone" — câu thần chú khi làm DNAT trên Palo Alto.'),
    ],
    hints: ['Lệnh "set" trên rule có sẵn chỉ đổi thuộc tính ghi trong lệnh — đừng quên commit.', 'test security-policy-match from untrust to dmz ... destination 203.0.113.10 → rule nào khớp?', 'Nhớ quy tắc: địa chỉ trước NAT, zone sau NAT.'],
  },
  // =====================================================================
  // SP01–SP02 — Sophos Firewall (giao diện web)
  // =====================================================================
  {
    id: 'SP01', group: 'sec', lesson: 'Firewall — Sophos (web admin)', level: 2, kind: 'config',
    title: 'Sophos Firewall: rule theo zone LAN/WAN/DMZ + Linked NAT (MASQ)',
    story: 'Văn phòng Mai Linh dùng Sophos Firewall (cấu hình bằng trang quản trị web — chọn tab thiết bị "SOPHOS-XG" để mở). Cổng đã qua wizard: Port1 = LAN (10.1.1.1/24), Port2 = WAN (203.0.113.2/24, gateway 203.0.113.1), Port3 = DMZ (172.16.1.1/24). Sophos chặn mọi thứ chưa có rule. Yêu cầu: tạo IP host LAN_NET (10.1.1.0/24); rule "LAN-ra-Internet" LAN → WAN chỉ HTTP/HTTPS/DNS/PING kèm Linked NAT MASQ; rule "LAN-vao-DMZ" LAN → DMZ mọi dịch vụ (không NAT).',
    build: () => fwNet('sophos', ['port2', 'port1', 'port3']),
    init: [ISP, ['fw', ['if port1 ip=10.1.1.1/24 zone=LAN', 'if port2 ip=203.0.113.2/24 zone=WAN', 'if port3 ip=172.16.1.1/24 zone=DMZ', 'gw 203.0.113.1']]],
    guide: [
      { dev: 'fw', raw: true, title: '1. Hosts and services → IP host LAN_NET', why: 'Đặt tên cho dải LAN để dùng trong rule (tab "Hosts & services" → Thêm).', cmds: ['obj LAN_NET 10.1.1.0/24'] },
      { dev: 'fw', raw: true, title: '2. Rules and policies → Add firewall rule (LAN → WAN, MASQ)', why: 'Rule Sophos chọn theo ZONE nguồn/đích. Tích "Linked NAT: MASQ" để đổi IP nguồn sang IP cổng WAN (ISP không biết đường về 10.1.1.0/24). Sophos stateful nên không cần rule chiều về.', cmds: ['rule add LAN-ra-Internet from=LAN to=WAN src=LAN_NET dst=any svc=HTTP,HTTPS,DNS,PING action=accept nat=masq'] },
      { dev: 'fw', raw: true, title: '3. Rule LAN → DMZ', why: 'Không tích MASQ: traffic nội bộ giữ nguyên IP nguồn (server DMZ thấy IP thật của nhân viên).', cmds: ['rule add LAN-vao-DMZ from=LAN to=DMZ src=LAN_NET dst=any svc=any action=accept'] },
    ],
    tasks: [
      { text: 'IP host LAN_NET = 10.1.1.0/24', verify: 'Hosts & services', check: (a) => { const o = a.d('fw').gfw?.cand.objs.LAN_NET; return o?.ip === '10.1.1.0' && o.prefix === 24; } },
      { text: 'Nhân viên ra Internet: web 80/443 + ping (có MASQ — ISP không có route về LAN)', verify: 'PC-IN: telnet 8.8.8.8 80 ; ping 8.8.8.8', check: (a) => a.d('isp').routes.length === 0 && tcp(a, 'pin', '8.8.8.8', 80) && tcp(a, 'pin2', '8.8.8.8', 443) && a.ping('pin', '8.8.8.8') },
      { text: 'Telnet ra Internet bị chặn (không rule nào khớp)', verify: 'telnet 8.8.8.8', check: (a) => !tcp(a, 'pin', '8.8.8.8', 23) },
      { text: 'LAN vào DMZ mọi dịch vụ; DMZ KHÔNG vào được LAN', verify: 'PC-IN: telnet 172.16.1.10 22', check: (a) => tcp(a, 'pin', '172.16.1.10', 22) && !tcp(a, 'web', '10.1.1.10', 445) },
      quiz('Linked NAT "MASQ" trên rule LAN → WAN làm gì?', ['Đổi IP nguồn của nhân viên sang IP cổng WAN (masquerade/PAT)', 'Mã hoá traffic', 'Đổi IP đích', 'Chặn traffic không có NAT'], 0),
    ],
    hints: ['Chọn tab thiết bị "SOPHOS-XG" để mở trang quản trị web.', 'Xem "🧭 Cách giải chi tiết" — mỗi bước là 1 thao tác trên giao diện.', 'Thao tác sai: dòng ERROR màu đỏ hiện ngay trên trang.'],
  },
  {
    id: 'SP02', group: 'sec', lesson: 'Firewall — Sophos publish server', level: 3, kind: 'config',
    title: 'Sophos: publish web DMZ (DNAT) — rule phải trỏ tới IP THẬT của server',
    story: 'Sophos đã chạy như SP01. Cần đưa WEB-DMZ (172.16.1.10) ra Internet bằng IP 203.0.113.10 — chỉ HTTP/HTTPS. Trên Sophos: tạo IP host WEB, NAT rule DNAT (203.0.113.10 → WEB) và firewall rule WAN → DMZ. Lưu ý: firewall rule xét SAU khi DNAT nên đích của rule là WEB (IP thật), không phải IP public.',
    build: () => fwNet('sophos', ['port2', 'port1', 'port3']),
    init: [ISP, ['fw', ['if port1 ip=10.1.1.1/24 zone=LAN', 'if port2 ip=203.0.113.2/24 zone=WAN', 'if port3 ip=172.16.1.1/24 zone=DMZ', 'gw 203.0.113.1', 'obj LAN_NET 10.1.1.0/24', 'rule add LAN-ra-Internet from=LAN to=WAN src=LAN_NET svc=HTTP,HTTPS,DNS,PING action=accept nat=masq', 'rule add LAN-vao-DMZ from=LAN to=DMZ src=LAN_NET action=accept']]],
    guide: [
      { dev: 'fw', raw: true, title: '1. IP host WEB + NAT rule DNAT', why: 'DNAT đổi đích 203.0.113.10 → 172.16.1.10. Sophos tự trả ARP cho IP public trên cổng WAN.', cmds: ['obj WEB 172.16.1.10', 'nat add WEB-PUBLISH type=dnat ext=203.0.113.10 int=WEB'] },
      { dev: 'fw', raw: true, title: '2. Firewall rule WAN → DMZ tới WEB', why: 'Đích = WEB (IP thật) vì DNAT đã đổi đích trước khi xét rule. Chỉ HTTP + HTTPS.', cmds: ['rule add WAN-vao-WEB from=WAN to=DMZ src=any dst=WEB svc=HTTP,HTTPS action=accept'] },
    ],
    tasks: [
      { text: 'Khách ngoài mở được http/https://203.0.113.10', verify: 'KHACH-NGOAI: telnet 203.0.113.10 80', check: (a) => tcp(a, 'ext', '203.0.113.10', 80) && tcp(a, 'ext', '203.0.113.10', 443) },
      { text: 'SSH vào WEB từ Internet bị chặn', verify: 'telnet 203.0.113.10 22', check: (a) => !tcp(a, 'ext', '203.0.113.10', 22) },
      { text: 'Rule WAN → DMZ dùng đích WEB (IP thật), không dùng "any"', verify: 'Rules and policies', check: (a) => (a.d('fw').gfw?.cand.rules || []).some((r) => r.from.includes('WAN') && r.action === 'accept' && r.dst.includes('WEB')) && !(a.d('fw').gfw?.cand.rules || []).some((r) => r.from.includes('WAN') && r.action === 'accept' && r.dst.includes('any')) },
      { text: 'Nhân viên vẫn ra Internet và vào WEB', verify: 'PC-IN: telnet 8.8.8.8 80', check: (a) => tcp(a, 'pin', '8.8.8.8', 80) && tcp(a, 'pin', '172.16.1.10', 80) },
      quiz('Rule cho khách vào web sau DNAT trên Sophos đặt đích là gì?', ['WEB (172.16.1.10) — rule xét sau DNAT', '203.0.113.10', 'any', 'IP cổng WAN'], 0),
    ],
    hints: ['Tab "NAT" → DNAT: IP ngoài 203.0.113.10 → máy trong WEB.', 'Tab "Rules and policies": Source zone WAN, Destination zone DMZ, Destination WEB.'],
  },

  // =====================================================================
  // CP01–CP02 — Check Point (SmartConsole)
  // =====================================================================
  {
    id: 'CP01', group: 'sec', lesson: 'Firewall — Check Point (SmartConsole)', level: 2, kind: 'config',
    title: 'Check Point: rulebase, Hide NAT và Install Policy',
    story: 'Ngân hàng Phương Nam dùng Check Point (quản trị bằng SmartConsole). Gateway đã có topology: eth1 = external (203.0.113.2/24, gateway 203.0.113.1), eth2 = internal (10.1.1.0/24), eth3 = dmz (172.16.1.0/24). Rulebase hiện trống (chỉ có Cleanup rule chặn tất). Yêu cầu: network object LAN_NET; rule "LAN-ra-Internet" (LAN_NET → Any, HTTP/HTTPS/DNS/PING, Accept); rule "LAN-vao-DMZ" (LAN_NET → DMZ_NET, Any, Accept); Hide NAT cho LAN_NET sau IP gateway; và quan trọng: INSTALL POLICY.',
    build: () => fwNet('checkpoint', ['eth1', 'eth2', 'eth3']),
    init: [ISP, ['fw', ['if eth1 ip=203.0.113.2/24 zone=external', 'if eth2 ip=10.1.1.1/24 zone=internal', 'if eth3 ip=172.16.1.1/24 zone=dmz', 'gw 203.0.113.1', 'install']]],
    guide: [
      { dev: 'fw', raw: true, title: '1. Objects: LAN_NET, DMZ_NET', why: 'Check Point làm việc với OBJECT: mọi rule tham chiếu object (dễ tái dùng, đổi một chỗ).', cmds: ['obj LAN_NET 10.1.1.0/24', 'obj DMZ_NET 172.16.1.0/24'] },
      { dev: 'fw', raw: true, title: '2. Access Control: thêm rule', why: 'Rulebase Check Point xét từ trên xuống, khớp là dừng; cuối cùng là Cleanup rule (Any → Any → Drop). Không cần zone: rule theo nguồn/đích/dịch vụ.', cmds: ['rule add LAN-ra-Internet src=LAN_NET dst=any svc=HTTP,HTTPS,DNS,PING action=accept', 'rule add LAN-vao-DMZ src=LAN_NET dst=DMZ_NET svc=any action=accept'] },
      { dev: 'fw', raw: true, title: '3. NAT: Hide NAT cho LAN_NET', why: 'Hide NAT = nhiều IP nội bộ "núp" sau IP gateway khi ra external (tương đương PAT).', cmds: ['nat add HIDE-LAN type=snat from=any to=external src=LAN_NET'] },
      { dev: 'fw', raw: true, title: '4. Install Policy', why: 'Mọi thay đổi trong SmartConsole chỉ là bản nháp trên Management Server cho tới khi "Install Policy" đẩy xuống gateway.', cmds: ['install'] },
    ],
    tasks: [
      { text: 'Đã Install Policy (không còn thay đổi treo)', verify: 'Nút "Install Policy" không còn nháy', check: (a) => a.d('fw').gfw && JSON.stringify(a.d('fw').gfw.cand) === JSON.stringify(a.d('fw').gfw.live) && a.d('fw').gfw.live.rules.length >= 2 },
      { text: 'Nhân viên ra Internet: web + ping (Hide NAT)', verify: 'PC-IN: telnet 8.8.8.8 80 ; ping 8.8.8.8', check: (a) => a.d('isp').routes.length === 0 && tcp(a, 'pin', '8.8.8.8', 80) && a.ping('pin', '8.8.8.8') },
      { text: 'Telnet ra Internet bị Cleanup rule chặn', verify: 'telnet 8.8.8.8', check: (a) => !tcp(a, 'pin', '8.8.8.8', 23) },
      { text: 'LAN vào DMZ được; DMZ không vào được LAN', verify: 'PC-IN: telnet 172.16.1.10 22', check: (a) => tcp(a, 'pin', '172.16.1.10', 22) && !tcp(a, 'web', '10.1.1.10', 445) },
      quiz('Sửa rule trong SmartConsole mà chưa Install Policy thì gateway…', ['Vẫn chạy policy cũ — thay đổi chỉ nằm trên Management Server', 'Áp dụng ngay', 'Ngừng chuyển gói', 'Tự Install sau 5 phút'], 0),
    ],
    hints: ['Chọn tab thiết bị "CP-GW" để mở SmartConsole giả lập.', 'Sau khi thêm rule/NAT, nút "⬆ Install Policy" nháy cam — bấm để áp dụng.'],
  },
  {
    id: 'CP02', group: 'sec', lesson: 'Firewall — Xử lý sự cố Check Point', level: 3, kind: 'ticket',
    title: 'Ticket Check Point: "đã sửa rồi mà không ăn" và web công ty không vào được',
    story: '🎫 Thiết kế đúng: nhân viên ra Internet bằng web/DNS/ping (Hide NAT sau IP gateway); WEB 172.16.1.10 publish bằng Static NAT 203.0.113.10, khách chỉ vào HTTP/HTTPS. Hiện tại: nhân viên không ra được Internet, khách không vào được web. Admin ca trước còn để lại thay đổi chưa cài. Dùng tab Access Control / NAT / Logs để tìm và sửa (nhớ Install Policy).',
    build: () => fwNet('checkpoint', ['eth1', 'eth2', 'eth3']),
    init: [ISP, ['fw', ['if eth1 ip=203.0.113.2/24 zone=external', 'if eth2 ip=10.1.1.1/24 zone=internal', 'if eth3 ip=172.16.1.1/24 zone=dmz', 'gw 203.0.113.1', 'obj LAN_NET 10.1.1.0/24', 'obj WEB 172.16.1.10',
      'rule add Test-chan-tam src=LAN_NET dst=any svc=any action=drop', 'rule add LAN-ra-Internet src=LAN_NET dst=any svc=HTTP,HTTPS,DNS,PING action=accept', 'rule add WEB-IN src=any dst=WEB svc=HTTP,HTTPS action=accept', 'install', 'nat add HIDE-LAN type=snat from=any to=external src=LAN_NET']]],
    guide: [
      { dev: 'fw', raw: true, title: '1. Rule "Test-chan-tam" (Drop) đứng trên cùng', why: 'Rule 1 chặn mọi traffic từ LAN_NET nên rule 2 không bao giờ được xét. Xoá (hoặc tắt) rule thử nghiệm.', cmds: ['rule del Test-chan-tam'] },
      { dev: 'fw', raw: true, title: '2. Thiếu Static NAT cho WEB', why: 'Rule WEB-IN có nhưng không có NAT tĩnh 203.0.113.10 → 172.16.1.10 → khách gõ IP public không tới được server.', cmds: ['nat add WEB-STATIC type=dnat ext=203.0.113.10 int=WEB'] },
      { dev: 'fw', raw: true, title: '3. Install Policy', why: 'Hide NAT ca trước thêm chưa cài + các sửa đổi vừa rồi → chỉ có tác dụng sau Install Policy.', cmds: ['install'] },
    ],
    tasks: [
      { text: 'Nhân viên ra Internet (web, ping)', verify: 'PC-IN: telnet 8.8.8.8 80', check: (a) => tcp(a, 'pin', '8.8.8.8', 80) && a.ping('pin', '8.8.8.8') },
      { text: 'Khách ngoài vào được http/https://203.0.113.10; SSH vẫn bị chặn', verify: 'KHACH-NGOAI: telnet 203.0.113.10 80', check: (a) => tcp(a, 'ext', '203.0.113.10', 80) && tcp(a, 'ext', '203.0.113.10', 443) && !tcp(a, 'ext', '203.0.113.10', 22) },
      { text: 'Không còn thay đổi chưa Install Policy', verify: 'banner ⚠ không còn', check: (a) => JSON.stringify(a.d('fw').gfw?.cand) === JSON.stringify(a.d('fw').gfw?.live) },
      { text: 'Ràng buộc: không thêm rule Any → Any → Accept', verify: 'Access Control', check: (a) => !(a.d('fw').gfw?.live.rules || []).some((r) => r.action === 'accept' && r.src.includes('any') && r.dst.includes('any') && r.svc.includes('any')) },
    ],
    hints: ['Có 3 vấn đề: thứ tự rule, thiếu NAT, chưa Install.', 'Tab Logs → phiên đang mở; banner ⚠ cho biết còn thay đổi chưa cài.'],
  },

  // =====================================================================
  // PF01–PF02 — pfSense
  // =====================================================================
  {
    id: 'PF01', group: 'sec', lesson: 'Firewall — pfSense', level: 2, kind: 'config',
    title: 'pfSense: siết rule "Default allow LAN to any" — rule xét trên cổng NHẬN gói',
    story: 'Trường THPT Lê Lợi cài pfSense. Mặc định pfSense có rule "Default allow LAN to any" — học sinh dùng được mọi dịch vụ (kể cả Telnet, game...). Yêu cầu: chỉ cho LAN dùng HTTP, HTTPS, DNS và ping (tới bất kỳ đâu, kể cả DMZ/OPT1); xoá rule mặc định; DMZ không được vào LAN. Cổng đã cấu hình: em0 = WAN (203.0.113.2/24, gateway .1), em1 = LAN (10.1.1.1/24), em2 = OPT1/DMZ (172.16.1.1/24). Outbound NAT đang Automatic. Nhớ "Apply Changes".',
    build: () => fwNet('pfsense', ['em0', 'em1', 'em2']),
    init: [ISP, ['fw', ['if em0 ip=203.0.113.2/24 zone=WAN', 'if em1 ip=10.1.1.1/24 zone=LAN', 'if em2 ip=172.16.1.1/24 zone=OPT1', 'gw 203.0.113.1', 'apply']]],
    guide: [
      { dev: 'fw', raw: true, title: '1. Firewall Rules → tab LAN: thêm rule cho phép từng dịch vụ', why: 'pfSense gắn rule vào cổng NHẬN gói (tab LAN = gói đi vào từ LAN). Nguồn "LAN net" = cả dải LAN. Thêm trước khi xoá rule mặc định để không tự khoá mình.', cmds: ['rule add Web-DNS-Ping from=LAN to=any src="LAN net" dst=any svc=HTTP,HTTPS,DNS,PING action=accept'] },
      { dev: 'fw', raw: true, title: '2. Xoá "Default allow LAN to any" + Apply Changes', why: 'Còn rule mặc định thì rule mới vô nghĩa (mọi thứ đã được cho phép). pfSense chỉ áp dụng sau "Apply Changes".', cmds: ['rule del "Default allow LAN to any"', 'apply'] },
    ],
    tasks: [
      { text: 'Rule mặc định "Default allow LAN to any" đã bị xoá và đã Apply', verify: 'Firewall Rules → LAN', check: (a) => { const g = a.d('fw').gfw; return !!g && !g.live.rules.some((r) => r.name === 'Default allow LAN to any') && JSON.stringify(g.cand) === JSON.stringify(g.live); } },
      { text: 'LAN ra Internet bằng web + ping (Automatic outbound NAT)', verify: 'PC-IN: telnet 8.8.8.8 80 ; ping 8.8.8.8', check: (a) => a.d('isp').routes.length === 0 && tcp(a, 'pin', '8.8.8.8', 80) && tcp(a, 'pin2', '8.8.8.8', 443) && a.ping('pin', '8.8.8.8') },
      { text: 'Telnet ra ngoài và SSH vào DMZ bị chặn; web vào DMZ vẫn được', verify: 'telnet 8.8.8.8', check: (a) => !tcp(a, 'pin', '8.8.8.8', 23) && !tcp(a, 'pin', '172.16.1.10', 22) && tcp(a, 'pin', '172.16.1.10', 80) },
      { text: 'DMZ (OPT1) không vào được LAN', verify: 'WEB-DMZ → 10.1.1.10', check: (a) => !tcp(a, 'web', '10.1.1.10', 445) },
      quiz('Muốn chặn gói từ LAN đi ra, trên pfSense đặt rule ở tab nào?', ['Tab LAN — cổng gói ĐI VÀO firewall', 'Tab WAN — cổng gói đi ra', 'Tab nào cũng được', 'Floating bắt buộc'], 0),
    ],
    hints: ['Chọn tab thiết bị "pfSense" để mở trang quản trị.', 'Firewall Rules có tab con theo từng cổng (WAN / LAN / OPT1).', 'Sau khi sửa: nút "Apply Changes" phía trên.'],
  },
  {
    id: 'PF02', group: 'sec', lesson: 'Firewall — pfSense port forward', level: 3, kind: 'ticket',
    title: 'pfSense port forward 8080 → web DMZ: rule đặt nhầm tab nên không chạy',
    story: '🎫 Trường chỉ có 1 IP public (em0 = 203.0.113.2). Cần cho Internet vào web nội bộ WEB-DMZ (172.16.1.10:80) qua cổng 8080. Thực tập sinh đã tạo alias WEB và một rule "Cho-web-8080" ở tab OPT1, rồi "Apply" — khách vẫn không vào được. Hãy làm đúng: NAT → Port Forward (WAN 8080 → WEB:80, kèm "associated filter rule" trên WAN), xoá rule đặt nhầm tab, Apply. SSH vào WEB từ ngoài vẫn phải bị chặn.',
    build: () => fwNet('pfsense', ['em0', 'em1', 'em2']),
    init: [ISP, ['fw', ['if em0 ip=203.0.113.2/24 zone=WAN', 'if em1 ip=10.1.1.1/24 zone=LAN', 'if em2 ip=172.16.1.1/24 zone=OPT1', 'gw 203.0.113.1', 'obj WEB 172.16.1.10', 'svc WEB8080 tcp 8080', 'rule add Cho-web-8080 from=OPT1 to=any src=any dst=WEB svc=WEB8080 action=accept', 'apply']]],
    guide: [
      { dev: 'fw', raw: true, title: '1. Rule ở tab OPT1 vô tác dụng', why: 'Gói của khách ĐI VÀO từ WAN, nên rule phải nằm ở tab WAN. Tab OPT1 chỉ xét gói đi vào từ DMZ. Ngoài ra sau port forward đích là 172.16.1.10:80, không còn là 8080. Xoá rule sai.', cmds: ['rule del Cho-web-8080'] },
      { dev: 'fw', raw: true, title: '2. NAT → Port Forward + associated filter rule', why: 'WAN address:8080 → WEB:80. Tích "Add associated filter rule" để pfSense tự tạo rule trên tab WAN cho phép tới WEB:80 (IP + port THẬT).', cmds: ['nat add WEB-8080 type=dnat ext=wan int=WEB proto=tcp ext_port=8080 int_port=80 rule=yes', 'apply'] },
    ],
    tasks: [
      { text: 'Khách ngoài mở được web qua 203.0.113.2:8080', verify: 'KHACH-NGOAI: telnet 203.0.113.2 8080', check: (a) => tcp(a, 'ext', '203.0.113.2', 8080) },
      { text: 'SSH (22) vào WEB từ ngoài bị chặn', verify: 'telnet 203.0.113.2 22', check: (a) => !tcp(a, 'ext', '203.0.113.2', 22) && !tcp(a, 'ext', '172.16.1.10', 22) },
      { text: 'Rule cho phép web nằm ở tab WAN; không còn rule thừa ở tab OPT1; đã Apply', verify: 'Firewall Rules', check: (a) => { const g = a.d('fw').gfw; return !!g && g.live.rules.some((r) => r.from.includes('WAN') && r.action === 'accept') && !g.live.rules.some((r) => r.from.includes('OPT1')) && JSON.stringify(g.cand) === JSON.stringify(g.live); } },
      { text: 'LAN vẫn ra Internet (rule mặc định LAN còn nguyên)', verify: 'PC-IN: telnet 8.8.8.8 80', check: (a) => tcp(a, 'pin', '8.8.8.8', 80) },
      quiz('Associated filter rule của port forward 8080 → WEB:80 cho phép đích nào?', ['172.16.1.10 cổng 80 — rule xét sau khi đã đổi đích', '203.0.113.2 cổng 8080', '172.16.1.10 cổng 8080', 'any'], 0),
    ],
    hints: ['Rule pfSense nằm ở tab của cổng NHẬN gói.', 'NAT → Port Forward: ext=wan, ext_port 8080 → WEB int_port 80, tích "Add associated filter rule".', 'Đừng quên Apply Changes.'],
  },
];
