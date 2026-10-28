// lab/labs-n200.js — nhóm "🆕 Bổ sung CCNA 200-301": các chủ đề của đề hiện hành mà bộ lab trước chưa có —
// LLDP, OSPF point-to-point, static route có tên + dự phòng, SNMPv2c/v3, ACL IPv6, VLAN mở rộng, khôi phục mật khẩu.
// Topology, địa chỉ và tình huống tự thiết kế.

import * as N from './net.js';
import * as V6 from './net6.js';
import { snmpTool } from './snmp.js';
import { cfg, quiz, fa } from './kit.js';

const { pc, server, router, sw, makeNet } = N;
// chạy công cụ SNMP trên bản sao để việc chấm không làm đổi bộ đếm / giá trị của mạng người học
const snmpOk = (a, src, cmd) => snmpTool(N.cloneNet(a.net), src, cmd).some((l) => /= STRING:/.test(l));
const ospfR = (rid, nets) => ['router ospf 1', `router-id ${rid}`, ...nets.map((n) => `network ${n} area 0`), 'exit'];

export const N200_LABS = [
  {
    id: 'N01', group: 'n2', lesson: 'CCNA 200-301 · 2.3 — CDP & LLDP', level: 1, kind: 'config',
    title: 'LLDP: khám phá láng giềng chuẩn mở, chặn quảng bá ra ISP',
    story: 'Công ty sắp thay switch access bằng hãng khác, nên chuyển sang LLDP (chuẩn mở IEEE 802.1AB) thay vì chỉ dùng CDP (độc quyền Cisco). Trên IOS, LLDP mặc định TẮT. Hãy bật LLDP trên R-EDGE, SW-CORE, SW-ACC để SW-CORE thấy được cả 2 láng giềng; riêng cổng R-EDGE hướng ra ISP thì không gửi và không nhận LLDP (không lộ thông tin thiết bị ra ngoài).',
    build: () => makeNet([
      router('isp', 'ISP', 900, 90, ['g0/0']),
      router('redge', 'R-EDGE', 640, 90, ['g0/0', 'g0/1']),
      sw('core', 'SW-CORE', 400, 200, ['fa0/1', 'g0/1', 'g0/2']),
      sw('acc', 'SW-ACC', 160, 320, ['fa0/1', 'g0/1']),
      pc('pc', 'PC1', 160, 460, { ip: '10.0.0.10', gw: '10.0.0.1' }),
    ], [['isp', 'g0/0', 'redge', 'g0/1'], ['redge', 'g0/0', 'core', 'g0/1'], ['core', 'g0/2', 'acc', 'g0/1'], ['pc', 'fa0', 'acc', 'fa0/1']]),
    init: [
      ['isp', cfg('hostname ISP', 'lldp run', 'interface g0/0', 'ip address 203.0.113.1 255.255.255.252', 'no shutdown')],
      ['redge', cfg('hostname R-EDGE', 'interface g0/0', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.2 255.255.255.252', 'no shutdown')],
      ['core', cfg('hostname SW-CORE', 'interface vlan 1', 'ip address 10.0.0.2 255.255.255.0', 'no shutdown')],
      ['acc', cfg('hostname SW-ACC', 'interface vlan 1', 'ip address 10.0.0.3 255.255.255.0', 'no shutdown')],
    ],
    tasks: [
      quiz('Trên router/switch Cisco IOS, LLDP mặc định ở trạng thái nào?', ['Tắt — phải "lldp run"', 'Bật trên mọi cổng', 'Chỉ bật trên trunk', 'Không hỗ trợ LLDP'], 0, 'CDP mặc định bật, LLDP mặc định tắt trên IOS. LLDP là chuẩn IEEE 802.1AB nên thiết bị khác hãng hiểu được.'),
      { text: 'R-EDGE, SW-CORE, SW-ACC đều bật LLDP', verify: 'show lldp', check: (a) => ['redge', 'core', 'acc'].every((d) => a.d(d).lldpRun) },
      { text: 'SW-CORE thấy 2 láng giềng LLDP (R-EDGE và SW-ACC)', verify: 'show lldp neighbors', check: (a) => a.show('core', 'show lldp neighbors').some((l) => /Total entries displayed: 2/.test(l)) },
      { text: 'R-EDGE Gi0/1 (hướng ISP): không gửi và không nhận LLDP', verify: 'show lldp interface', check: (a) => { const f = a.d('redge').ifaces['g0/1']; return f.lldpTx === false && f.lldpRx === false; } },
      { text: 'ISP không còn thấy R-EDGE qua LLDP', verify: 'ISP: show lldp neighbors', check: (a) => a.d('redge').lldpRun && a.show('isp', 'show lldp neighbors').some((l) => /Total entries displayed: 0/.test(l)) },
      quiz('Khác biệt chính giữa LLDP và CDP?', ['LLDP là chuẩn mở IEEE 802.1AB, CDP là giao thức riêng của Cisco', 'LLDP chạy ở lớp 3', 'CDP mã hoá dữ liệu', 'LLDP chỉ dùng cho điện thoại IP'], 0),
    ],
    hints: ['Cấu hình toàn cục trên từng thiết bị: lldp run', 'R-EDGE: interface g0/1 → no lldp transmit → no lldp receive', 'Kiểm tra: show lldp neighbors (detail) — giống show cdp neighbors nhưng chuẩn mở'],
    solution: [['redge', cfg('lldp run', 'interface g0/1', 'no lldp transmit', 'no lldp receive')], ['core', cfg('lldp run')], ['acc', cfg('lldp run')]],
  },
  {
    id: 'N02', group: 'n2', lesson: 'CCNA 200-301 · 3.4 — OSPF network type', level: 2, kind: 'ticket',
    title: 'OSPF lên FULL mà mất route: lệch network type point-to-point',
    story: '🎫 Kỹ sư cũ đổi link R1–R2 (Ethernet /30) sang OSPF point-to-point để khỏi bầu DR/BDR, nhưng mới làm một đầu. Từ đó "show ip ospf neighbor" vẫn thấy láng giềng, nhưng LAN hai bên không ping được nhau. Hãy sửa cho đúng thiết kế: link /30 giữa 2 router chạy point-to-point ở CẢ HAI đầu.',
    build: () => makeNet([
      router('r1', 'R1', 300, 140, ['g0/0', 'g0/1']),
      router('r2', 'R2', 680, 140, ['g0/0', 'g0/1']),
      pc('p1', 'PC1', 300, 340, { ip: '192.168.1.10', gw: '192.168.1.1' }),
      pc('p2', 'PC2', 680, 340, { ip: '192.168.2.10', gw: '192.168.2.1' }),
    ], [['r1', 'g0/1', 'r2', 'g0/1'], ['r1', 'g0/0', 'p1', 'fa0'], ['r2', 'g0/0', 'p2', 'fa0']]),
    init: [
      ['r1', cfg('hostname R1', 'interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.1 255.255.255.252', 'no shutdown', 'exit', ...ospfR('1.1.1.1', ['192.168.1.0 0.0.0.255', '10.0.12.0 0.0.0.3']))],
      ['r2', cfg('hostname R2', 'interface g0/0', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.2 255.255.255.252', 'ip ospf network point-to-point', 'no shutdown', 'exit', ...ospfR('2.2.2.2', ['192.168.2.0 0.0.0.255', '10.0.12.0 0.0.0.3']))],
    ],
    tasks: [
      { text: 'Gi0/1 của cả R1 và R2 là OSPF network type POINT_TO_POINT', verify: 'show ip ospf interface g0/1', check: (a) => a.d('r1').ifaces['g0/1'].ospfNet === 'p2p' && a.d('r2').ifaces['g0/1'].ospfNet === 'p2p' },
      { text: 'Không còn bầu DR/BDR trên link R1–R2 (neighbor hiện FULL/  -)', verify: 'show ip ospf neighbor', check: (a) => { const n = a.nbrs('r1'); return n.length === 1 && n[0].role === '-' && n[0].full; } },
      { text: 'R1 học 192.168.2.0/24 bằng OSPF; PC1 ping được PC2', verify: 'show ip route ospf ; ping', check: (a) => a.route('r1', '192.168.2.0/24')?.code === 'O' && a.ping('p1', '192.168.2.10') },
      quiz('Vì sao link Ethernet /30 giữa 2 router nên đặt OSPF point-to-point?', ['Chỉ có 2 router nên bầu DR/BDR là thừa; lên FULL nhanh hơn, không sinh LSA type 2', 'Để tăng băng thông', 'Bắt buộc với area 0', 'Để dùng được mật khẩu OSPF'], 0),
      quiz('Hai đầu lệch network type (point-to-point ↔ broadcast) thì thường thấy gì?', ['Láng giềng vẫn lên nhưng route qua link bị thiếu', 'Không bao giờ thấy láng giềng', 'Router khởi động lại', 'OSPF tự sửa'], 0, 'Hello mặc định cùng 10 s nên vẫn lên láng giềng, nhưng LSA hai bên mô tả link khác nhau → SPF không dùng được link. Kiểm tra bằng show ip ospf interface.'),
    ],
    hints: ['So sánh "show ip ospf interface g0/1" trên R1 và R2: dòng Network Type.', 'R1: interface g0/1 → ip ospf network point-to-point', 'Sau khi sửa, show ip ospf neighbor hiện FULL/  - (không có DR/BDR).'],
    solution: [['r1', cfg('interface g0/1', 'ip ospf network point-to-point')]],
  },
  {
    id: 'N03', group: 'n2', lesson: 'CCNA 200-301 · 3.3 — Static route & floating static', level: 2, kind: 'config',
    title: 'Static route có tên + đường dự phòng tự động (floating)',
    story: 'Chi nhánh nối về HQ qua 2 đường: WAN1 cáp quang (chính) và WAN2 4G (dự phòng). Yêu cầu: route tới LAN HQ 172.16.0.0/16 đi WAN1; khi WAN1 đứt tự chuyển WAN2 (floating static, AD 200). Theo chuẩn vận hành, MỌI static route phải có "name" ghi chú để người sau đọc running-config là hiểu.',
    build: () => makeNet([
      router('rbr', 'R-BR', 250, 200, ['g0/0', 'g0/1', 'g0/2']),
      router('rhq', 'R-HQ', 720, 200, ['g0/0', 'g0/1', 'g0/2']),
      pc('pbr', 'PC-BR', 250, 400, { ip: '10.10.0.10', gw: '10.10.0.1' }),
      server('srv', 'SRV-HQ', 720, 400, { ip: '172.16.1.10', gw: '172.16.1.1' }),
    ], [['rbr', 'g0/1', 'rhq', 'g0/1'], ['rbr', 'g0/2', 'rhq', 'g0/2'], ['rbr', 'g0/0', 'pbr', 'fa0'], ['rhq', 'g0/0', 'srv', 'fa0']]),
    init: [
      ['rbr', cfg('hostname R-BR', 'interface g0/0', 'ip address 10.10.0.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'description WAN1-CAP-QUANG', 'ip address 100.64.1.2 255.255.255.252', 'no shutdown', 'interface g0/2', 'description WAN2-4G', 'ip address 100.64.2.2 255.255.255.252', 'no shutdown')],
      ['rhq', cfg('hostname R-HQ', 'interface g0/0', 'ip address 172.16.1.1 255.255.0.0', 'no shutdown', 'interface g0/1', 'ip address 100.64.1.1 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 100.64.2.1 255.255.255.252', 'no shutdown', 'exit', 'ip route 10.10.0.0 255.255.255.0 100.64.1.2 name VE-CHINHANH-WAN1', 'ip route 10.10.0.0 255.255.255.0 100.64.2.2 200 name VE-CHINHANH-WAN2')],
    ],
    tasks: [
      { text: 'R-BR: route 172.16.0.0/16 qua WAN1 (100.64.1.1), AD mặc định, có name', verify: 'show running-config | include ip route', check: (a) => a.d('rbr').routes.some((r) => r.net === '172.16.0.0' && r.prefix === 16 && r.nh === '100.64.1.1' && r.ad === 1 && r.name) },
      { text: 'R-BR: floating route 172.16.0.0/16 qua WAN2 (100.64.2.1), AD 200, có name', verify: 'show running-config | include ip route', check: (a) => a.d('rbr').routes.some((r) => r.net === '172.16.0.0' && r.prefix === 16 && r.nh === '100.64.2.1' && r.ad === 200 && r.name) },
      { text: 'Bình thường: PC-BR tới SRV-HQ qua WAN1 (bảng định tuyến chỉ có route AD 1)', verify: 'show ip route 172.16.0.0', check: (a) => a.ping('pbr', '172.16.1.10') && a.route('rbr', '172.16.0.0/16')?.nextHop === '100.64.1.1' },
      { text: 'WAN1 đứt (G0/1 down) → tự chuyển WAN2, PC-BR vẫn tới SRV-HQ', verify: 'R-BR: interface g0/1 → shutdown → show ip route', check: (a) => a.whatIf((n) => { n.devices.rbr.ifaces['g0/1'].shutdown = true; }, (b) => b.route('rbr', '172.16.0.0/16')?.nextHop === '100.64.2.1' && b.ping('pbr', '172.16.1.10')) },
      quiz('Floating static route "nổi" lên bảng định tuyến khi nào?', ['Khi route có AD thấp hơn (route chính) biến mất', 'Luôn luôn, cân tải với route chính', 'Khi gõ clear ip route', 'Khi ping thất bại'], 0),
    ],
    hints: ['ip route 172.16.0.0 255.255.0.0 100.64.1.1 name HQ-QUA-WAN1', 'ip route 172.16.0.0 255.255.0.0 100.64.2.1 200 name HQ-QUA-WAN2-DUPHONG', '"name" không ảnh hưởng định tuyến — chỉ là ghi chú hiện trong running-config.'],
    solution: [['rbr', cfg('ip route 172.16.0.0 255.255.0.0 100.64.1.1 name HQ-QUA-WAN1', 'ip route 172.16.0.0 255.255.0.0 100.64.2.1 200 name HQ-QUA-WAN2-DUPHONG')]],
  },
  {
    id: 'N04', group: 'n2', lesson: 'CCNA 200-301 · 4.4 — SNMP', level: 2, kind: 'config',
    title: 'SNMPv2c: cho máy giám sát đọc thiết bị, chặn máy khác',
    story: 'Phòng NOC lắp máy giám sát NMS (10.0.99.50, có công cụ snmpget/snmpwalk/snmpset). Cấu hình SNMP trên R-CORE: community chỉ đọc PJ-MONITOR và community đọc-ghi PJ-ADMIN, CẢ HAI chỉ cho NMS dùng (ACL standard 10); ghi location "HN-DC1-Rack3" và contact "noc@congty.vn"; gửi trap tới NMS. Máy người dùng PC-USER không được truy vấn SNMP dù biết community.',
    build: () => makeNet([
      router('rc', 'R-CORE', 480, 140, ['g0/0', 'g0/1']),
      server('nms', 'NMS', 230, 340, { ip: '10.0.99.50', gw: '10.0.99.1', services: [162] }),
      pc('user', 'PC-USER', 730, 340, { ip: '10.0.10.20', gw: '10.0.10.1' }),
    ], [['rc', 'g0/0', 'nms', 'fa0'], ['rc', 'g0/1', 'user', 'fa0']]),
    init: [['rc', cfg('hostname R-CORE', 'interface g0/0', 'ip address 10.0.99.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.10.1 255.255.255.0', 'no shutdown')]],
    tasks: [
      { text: 'Community PJ-MONITOR (RO) và PJ-ADMIN (RW), cả hai gắn ACL chỉ cho 10.0.99.50', verify: 'show snmp community', check: (a) => { const c = a.d('rc').snmp?.comm || {}; const okAcl = (x) => !!x?.acl && N.aclEval(a.d('rc'), x.acl, { src: '10.0.99.50' }).action === 'permit' && N.aclEval(a.d('rc'), x.acl, { src: '10.0.10.20' }).action !== 'permit'; return c['PJ-MONITOR'] && !c['PJ-MONITOR'].rw && c['PJ-ADMIN']?.rw && okAcl(c['PJ-MONITOR']) && okAcl(c['PJ-ADMIN']); } },
      { text: 'Location "HN-DC1-Rack3", contact "noc@congty.vn"', verify: 'show snmp', check: (a) => a.d('rc').snmp?.location === 'HN-DC1-Rack3' && a.d('rc').snmp?.contact === 'noc@congty.vn' },
      { text: 'Trap gửi tới NMS (version 2c, community PJ-MONITOR)', verify: 'show snmp host', check: (a) => a.d('rc').snmp?.traps && a.d('rc').snmp.hosts.some((h) => h.ip === '10.0.99.50' && h.ver === '2c') },
      { text: 'NMS đọc được sysName: snmpget -v2c -c PJ-MONITOR 10.0.99.1 sysName.0', verify: 'NMS: snmpget …', check: (a) => snmpOk(a, 'nms', 'snmpget -v2c -c PJ-MONITOR 10.0.99.1 sysName.0') },
      { text: 'PC-USER dùng đúng community vẫn KHÔNG truy vấn được (Timeout)', verify: 'PC-USER: snmpget -v2c -c PJ-MONITOR 10.0.10.1 sysName.0', check: (a) => a.ping('user', '10.0.10.1') && !snmpOk(a, 'user', 'snmpget -v2c -c PJ-MONITOR 10.0.10.1 sysName.0') },
      quiz('Vì sao SNMPv2c bị coi là kém an toàn?', ['Community gửi dạng chữ thường, không mã hoá — bắt gói là thấy', 'Không chạy trên UDP', 'Không đọc được sysName', 'Chỉ dùng cho switch'], 0, 'Nên giới hạn bằng ACL và chuyển sang SNMPv3 authPriv khi có thể.'),
    ],
    hints: ['access-list 10 permit host 10.0.99.50', 'snmp-server community PJ-MONITOR ro 10 ; snmp-server community PJ-ADMIN rw 10', 'snmp-server location HN-DC1-Rack3 ; snmp-server contact noc@congty.vn', 'snmp-server enable traps ; snmp-server host 10.0.99.50 version 2c PJ-MONITOR', 'Trên NMS: snmpwalk -v2c -c PJ-MONITOR 10.0.99.1'],
    solution: [['rc', cfg('access-list 10 permit host 10.0.99.50', 'snmp-server community PJ-MONITOR ro 10', 'snmp-server community PJ-ADMIN rw 10', 'snmp-server location HN-DC1-Rack3', 'snmp-server contact noc@congty.vn', 'snmp-server enable traps', 'snmp-server host 10.0.99.50 version 2c PJ-MONITOR')], ['nms', ['snmpget -v2c -c PJ-MONITOR 10.0.99.1 sysName.0 sysLocation.0']]],
  },
  {
    id: 'N05', group: 'n2', lesson: 'CCNA 200-301 · 4.4 — SNMPv3', level: 3, kind: 'config',
    title: 'SNMPv3 authPriv: thay community "public" bằng user có mã hoá',
    story: 'Kiểm toán bảo mật phát hiện R-CORE còn community mặc định "public" (đọc được từ mọi nơi). Yêu cầu: bỏ SNMPv1/v2c, chuyển sang SNMPv3 mức authPriv — nhóm NOC (v3 priv), user netadmin xác thực SHA mật khẩu Auth@2026 và mã hoá AES-128 mật khẩu Priv@2026. NMS (10.0.99.50) phải đọc được bằng SNMPv3.',
    build: () => makeNet([
      router('rc', 'R-CORE', 480, 140, ['g0/0', 'g0/1']),
      server('nms', 'NMS', 230, 340, { ip: '10.0.99.50', gw: '10.0.99.1', services: [162] }),
      pc('user', 'PC-USER', 730, 340, { ip: '10.0.10.20', gw: '10.0.10.1' }),
    ], [['rc', 'g0/0', 'nms', 'fa0'], ['rc', 'g0/1', 'user', 'fa0']]),
    init: [['rc', cfg('hostname R-CORE', 'interface g0/0', 'ip address 10.0.99.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.10.1 255.255.255.0', 'no shutdown', 'exit', 'snmp-server community public ro', 'snmp-server location HN-DC1-Rack3')]],
    tasks: [
      { text: 'Không còn community v1/v2c nào (đã xoá "public")', verify: 'show snmp community', check: (a) => !Object.keys(a.d('rc').snmp?.comm || {}).length },
      { text: 'Nhóm NOC: SNMPv3 mức priv', verify: 'show snmp group', check: (a) => a.d('rc').snmp?.groups?.NOC?.sec === 'priv' },
      { text: 'User netadmin thuộc NOC: auth SHA, priv AES 128', verify: 'show snmp user', check: (a) => { const u = a.d('rc').snmp?.users?.netadmin; return u?.group === 'NOC' && u.auth === 'sha' && u.priv === 'aes 128'; } },
      { text: 'NMS đọc được bằng SNMPv3 authPriv; PC-USER dùng "public" thì Timeout', verify: 'NMS: snmpget -v3 -u netadmin -l authPriv -a SHA -A Auth@2026 -x AES -X Priv@2026 10.0.99.1 sysName.0', check: (a) => snmpOk(a, 'nms', 'snmpget -v3 -u netadmin -l authPriv -a SHA -A Auth@2026 -x AES -X Priv@2026 10.0.99.1 sysName.0') && !snmpOk(a, 'user', 'snmpget -v2c -c public 10.0.10.1 sysName.0') },
      quiz('Sau khi tạo "snmp-server user", vì sao không thấy user trong show running-config?', ['IOS lưu user SNMPv3 riêng (không hiện trong running-config) — xem bằng show snmp user', 'Lệnh bị lỗi', 'Phải reload mới hiện', 'User bị xoá khi end'], 0),
      quiz('Mức bảo mật SNMPv3 nào vừa xác thực vừa mã hoá?', ['authPriv', 'authNoPriv', 'noAuthNoPriv', 'v2c'], 0),
    ],
    hints: ['no snmp-server community public', 'snmp-server group NOC v3 priv', 'snmp-server user netadmin NOC v3 auth sha Auth@2026 priv aes 128 Priv@2026', 'Kiểm tra trên NMS bằng lệnh snmpget -v3 ở phần "Kiểm tra" của nhiệm vụ 4.'],
    solution: [['rc', cfg('no snmp-server community public', 'snmp-server group NOC v3 priv', 'snmp-server user netadmin NOC v3 auth sha Auth@2026 priv aes 128 Priv@2026')], ['nms', ['snmpget -v3 -u netadmin -l authPriv -a SHA -A Auth@2026 -x AES -X Priv@2026 10.0.99.1 sysName.0']]],
  },
  {
    id: 'N06', group: 'n2', lesson: 'CCNA 200-301 · 5.6 — ACL (IPv6)', level: 3, kind: 'config',
    title: 'ACL IPv6: mạng khách không được chạm vào server',
    story: 'Văn phòng chạy IPv6: STAFF 2001:DB8:10::/64 (G0/0), GUEST 2001:DB8:20::/64 (G0/1), SERVER 2001:DB8:99::/64 (G0/2). Chính sách: máy khách KHÔNG được gửi gì tới mạng server, nhưng vẫn ping được gateway của mình và đi tới mạng STAFF không bị cấm; STAFF vào server bình thường. Dùng ACL IPv6 đặt tên GUEST-IN áp chiều IN trên cổng GUEST (gần nguồn).',
    build: () => makeNet([
      router('r1', 'R1', 480, 120, ['g0/0', 'g0/1', 'g0/2']),
      pc('staff', 'PC-STAFF', 180, 330, {}),
      pc('guest', 'PC-GUEST', 480, 380, {}),
      server('srv', 'SRV-APP', 790, 330, {}),
    ], [['r1', 'g0/0', 'staff', 'fa0'], ['r1', 'g0/1', 'guest', 'fa0'], ['r1', 'g0/2', 'srv', 'fa0']]),
    init: [
      ['r1', cfg('hostname R1', 'ipv6 unicast-routing', 'interface g0/0', 'ipv6 address 2001:db8:10::1/64', 'no shutdown', 'interface g0/1', 'ipv6 address 2001:db8:20::1/64', 'no shutdown', 'interface g0/2', 'ipv6 address 2001:db8:99::1/64', 'no shutdown')],
      ['staff', ['ipv6config 2001:db8:10::10/64 2001:db8:10::1']], ['guest', ['ipv6config 2001:db8:20::20/64 2001:db8:20::1']], ['srv', ['ipv6config 2001:db8:99::99/64 2001:db8:99::1']],
    ],
    tasks: [
      { text: 'Có ACL IPv6 tên GUEST-IN áp chiều IN trên G0/1', verify: 'show ipv6 access-list ; show running-config interface g0/1', check: (a) => !!a.d('r1').acls6?.['GUEST-IN'] && a.d('r1').ifaces['g0/1'].ipv6Filter?.in === 'GUEST-IN' },
      { text: 'PC-GUEST KHÔNG ping được SRV-APP (2001:DB8:99::99)', verify: 'PC-GUEST: ping 2001:db8:99::99', check: (a) => !V6.ping6(a.net, 'guest', '2001:db8:99::99').ok },
      { text: 'PC-GUEST vẫn ping được gateway và PC-STAFF', verify: 'ping 2001:db8:20::1 ; ping 2001:db8:10::10', check: (a) => V6.ping6(a.net, 'guest', '2001:db8:20::1').ok && V6.ping6(a.net, 'guest', '2001:db8:10::10').ok },
      { text: 'PC-STAFF vẫn vào được SRV-APP', verify: 'PC-STAFF: ping 2001:db8:99::99', check: (a) => V6.ping6(a.net, 'staff', '2001:db8:99::99').ok },
      quiz('Cuối mỗi ACL IPv6 có các dòng ngầm định nào?', ['permit icmp any any nd-na, permit icmp any any nd-ns, deny ipv6 any any', 'Chỉ deny ipv6 any any', 'permit ipv6 any any', 'Không có dòng nào'], 0, 'Hai dòng cho phép Neighbor Discovery giúp IPv6 vẫn tìm được láng giềng (thay cho ARP); nếu tự thêm "deny ipv6 any any log" ở cuối thì phải tự permit ND.'),
      quiz('Lệnh áp ACL IPv6 lên cổng là?', ['ipv6 traffic-filter NAME in', 'ipv6 access-group NAME in', 'ip access-group NAME in', 'ipv6 access-class NAME in'], 0),
    ],
    hints: ['ipv6 access-list GUEST-IN', 'deny ipv6 2001:db8:20::/64 2001:db8:99::/64', 'permit ipv6 any any   ← không có dòng này thì mọi thứ khác bị chặn bởi deny ngầm định', 'interface g0/1 → ipv6 traffic-filter GUEST-IN in'],
    solution: [['r1', cfg('ipv6 access-list GUEST-IN', 'deny ipv6 2001:db8:20::/64 2001:db8:99::/64', 'permit ipv6 any any', 'exit', 'interface g0/1', 'ipv6 traffic-filter GUEST-IN in')]],
  },
  {
    id: 'N07', group: 'n2', lesson: 'CCNA 200-301 · 2.1 — VLAN (dải mở rộng)', level: 2, kind: 'config',
    title: 'VLAN mở rộng 2010 cho camera: phải chuyển VTP transparent',
    story: 'Nhà cung cấp camera yêu cầu VLAN 2010 (CAMERA) — thuộc dải mở rộng 1006–4094. Hai switch đang ở VTP server mặc định nên tạo VLAN 2010 sẽ bị từ chối. Hãy chuyển cả hai sang VTP transparent, tạo VLAN 2010 tên CAMERA trên cả hai, gán cổng camera và NVR, để camera đẩy hình về NVR qua trunk.',
    build: () => makeNet([
      sw('s1', 'SW1', 300, 160, ['fa0/1', 'g0/1']),
      sw('s2', 'SW2', 680, 160, ['fa0/1', 'g0/1']),
      server('cam', 'CAMERA-01', 300, 360, { ip: '10.20.10.11', services: [554] }),
      server('nvr', 'NVR', 680, 360, { ip: '10.20.10.100', services: [554, 80] }),
    ], [['s1', 'g0/1', 's2', 'g0/1'], ['cam', 'fa0', 's1', 'fa0/1'], ['nvr', 'fa0', 's2', 'fa0/1']]),
    init: [['s1', cfg('hostname SW1', 'interface g0/1', 'switchport mode trunk')], ['s2', cfg('hostname SW2', 'interface g0/1', 'switchport mode trunk')]],
    tasks: [
      quiz('Vì sao switch ở VTP server (VTPv1/v2) không tạo được VLAN 2010?', ['VTPv1/v2 không quảng bá VLAN dải mở rộng 1006–4094, nên chỉ tạo được ở chế độ transparent (hoặc VTPv3)', 'VLAN tối đa là 1005', 'Phải mua license', 'Trunk không mang được VLAN > 1000'], 0),
      { text: 'SW1 và SW2 ở VTP transparent', verify: 'show vtp status', check: (a) => a.d('s1').vtpMode === 'transparent' && a.d('s2').vtpMode === 'transparent' },
      { text: 'VLAN 2010 tên CAMERA có trên cả hai switch', verify: 'show vlan brief', check: (a) => ['s1', 's2'].every((s) => String(a.d(s).vlans[2010] || '').toUpperCase() === 'CAMERA') },
      { text: 'Fa0/1 của cả hai switch: access VLAN 2010', verify: 'show vlan brief', check: (a) => ['s1', 's2'].every((s) => a.d(s).ports['fa0/1'].modeSet && a.d(s).ports['fa0/1'].mode === 'access' && a.d(s).ports['fa0/1'].vlan === 2010) },
      { text: 'CAMERA-01 tới được NVR (cổng RTSP 554)', verify: 'telnet 10.20.10.100 554', check: (a) => a.tcp('cam', '10.20.10.100', 554).ok },
    ],
    hints: ['Thử "vlan 2010" trước để thấy thông báo lỗi.', 'vtp mode transparent  (cả 2 switch)', 'vlan 2010 → name CAMERA ; interface fa0/1 → switchport mode access → switchport access vlan 2010'],
    solution: ['s1', 's2'].map((s) => [s, cfg('vtp mode transparent', 'vlan 2010', 'name CAMERA', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 2010')]),
  },
  {
    id: 'N08', group: 'n2', lesson: 'CCNA 200-301 · 5.3 — Khôi phục mật khẩu', level: 3, kind: 'ticket',
    title: 'Quên enable secret: khôi phục mật khẩu qua ROMMON mà không mất cấu hình',
    story: '🎫 Kỹ sư cũ nghỉ việc, không ai biết enable secret của R-CN (chi nhánh vẫn chạy OSPF bình thường). Hãy khôi phục quyền quản trị KHÔNG làm mất cấu hình: tắt/bật nguồn (lệnh lab "power-cycle"), trong lúc khởi động gõ "send break" (hoặc Ctrl+Break) để vào ROMMON, đặt config-register bỏ qua startup-config, khởi động lại, nạp lại cấu hình cũ, đặt enable secret mới là Cisco@123, trả config-register về 0x2102 và lưu. Chi nhánh phải hoạt động lại như trước.',
    build: () => makeNet([
      router('rcn', 'R-CN', 480, 140, ['g0/0', 'g0/1']),
      router('rhq', 'R-HQ', 820, 140, ['g0/0', 'g0/1']),
      pc('pcn', 'PC-CN', 300, 340, { ip: '192.168.50.10', gw: '192.168.50.1' }),
      server('srv', 'SRV-HQ', 820, 340, { ip: '172.16.0.10', gw: '172.16.0.1' }),
    ], [['rcn', 'g0/0', 'pcn', 'fa0'], ['rcn', 'g0/1', 'rhq', 'g0/1'], ['rhq', 'g0/0', 'srv', 'fa0']]),
    init: [
      ['rhq', cfg('hostname R-HQ', 'interface g0/0', 'ip address 172.16.0.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.0.1 255.255.255.252', 'no shutdown', 'exit', ...ospfR('1.1.1.1', ['172.16.0.0 0.0.0.255', '10.0.0.0 0.0.0.3']))],
      ['rcn', [...cfg('hostname R-CN', 'enable secret Kh0ngA1Bi3t!', 'interface g0/0', 'ip address 192.168.50.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.0.2 255.255.255.252', 'no shutdown', 'exit', ...ospfR('5.5.5.5', ['192.168.50.0 0.0.0.255', '10.0.0.0 0.0.0.3'])), 'copy running-config startup-config', '']],
    ],
    tasks: [
      quiz('Config-register 0x2142 khác 0x2102 ở điểm nào?', ['Bit 6 bật: khi khởi động BỎ QUA startup-config trong NVRAM (cấu hình vẫn còn đó)', 'Xoá NVRAM', 'Đổi tốc độ console', 'Khởi động từ TFTP'], 0),
      { text: 'Startup-config có enable secret mới Cisco@123', verify: 'show startup-config | include secret', check: (a) => a.d('rcn').startupCfg?.enableSecret === 'Cisco@123' },
      { text: 'Config-register trở về 0x2102 (lần khởi động sau đọc lại startup-config)', verify: 'show version | include register', check: (a) => (a.d('rcn').confregNext || a.d('rcn').confreg) === '0x2102' && !!a.d('rcn').confreg },
      { text: 'Cấu hình cũ còn nguyên trong startup-config (IP + OSPF)', verify: 'show startup-config', check: (a) => { const s0 = a.d('rcn').startupCfg; return s0?.ifaces?.['g0/1']?.ip === '10.0.0.2' && !!s0?.ospf; } },
      { text: 'Chi nhánh hoạt động lại: PC-CN ping được SRV-HQ', verify: 'ping 172.16.0.10', check: (a) => a.ping('pcn', '172.16.0.10') },
      quiz('Sau "copy startup-config running-config", vì sao các cổng vẫn administratively down?', ['Lệnh copy chỉ GỘP cấu hình; startup-config không có lệnh "no shutdown" nên cổng giữ trạng thái shutdown hiện tại', 'Do config-register', 'Do mất IP', 'Do OSPF chưa chạy'], 0),
    ],
    hints: ['Trong lab, gõ power-cycle ở bất kỳ chế độ nào để tắt/bật nguồn; ngay sau đó gõ send break (hoặc Ctrl+Break).', 'rommon 1 > confreg 0x2142   → rommon 2 > reset', 'Router> enable (không hỏi mật khẩu vì bỏ qua startup-config) → copy startup-config running-config', 'configure terminal → enable secret Cisco@123 → interface g0/0 / g0/1 → no shutdown → config-register 0x2102 → end → copy running-config startup-config'],
    solution: [['rcn', ['power-cycle', 'send break', 'confreg 0x2142', 'reset', '', 'enable', 'copy startup-config running-config', '', 'configure terminal', 'enable secret Cisco@123', 'interface g0/0', 'no shutdown', 'interface g0/1', 'no shutdown', 'exit', 'config-register 0x2102', 'end', 'copy running-config startup-config', '']]],
  },
];
