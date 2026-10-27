// lab/labs-adv.js — lab chuyên đề nâng cao (D01–D04): VTP an toàn, PVLAN + DHCP, IPsec site-to-site
// dựng từ đầu, BGP nhiều AS (iBGP qua loopback + eBGP). Khai thác các phần engine đã có nhưng
// trước đây ít lab. Nội dung/tình huống tự thiết kế theo kiến thức CCNA/CCNP chuẩn.

import * as N from './net.js';
import { cfg, fa, same, aclOn, quiz, hostIn } from './kit.js';

const { pc, server, sw, router, makeNet } = N;

const VLANS3 = (d) => same(d.vlans[10], 'SALES') && same(d.vlans[20], 'HR') && same(d.vlans[30], 'IT');
const ISAKMP = ['crypto isakmp policy 10', 'encryption aes 256', 'hash sha', 'authentication pre-share', 'group 14', 'exit'];
const polKey = (d) => Object.values(d.crypto.isakmp || {}).map((p) => `${p.encr}|${p.hash}|${p.auth}|${p.group}`);

export const ADV_LABS = [
  // =====================================================================
  // D01 — VTP: "quả bom revision"
  // =====================================================================
  {
    id: 'D01', group: 'adv', lesson: 'Chuyên đề — VTP an toàn', level: 3, kind: 'ticket',
    title: 'VTP: gỡ "quả bom revision" trước khi cắm switch cũ vào mạng',
    story: '🎫 Domain VTP ANKHANG (password Vtp@2026): SW-CORE là server, SW-ACC1 là client, đang chạy VLAN 10 SALES / 20 HR / 30 IT. Kho vừa chuyển lên SW-MOI — switch từng dùng ở phòng lab, CÙNG domain và password, đã tạo/xoá VLAN thử nhiều lần nên Configuration Revision rất cao và VLAN database chỉ còn VLAN 99 LAB-TEST. Cổng Gi0/2 của core nối sang SW-MOI đang được shutdown. Nhiệm vụ: đưa SW-MOI vào domain AN TOÀN (không được để nó ghi đè VLAN của cả công ty), bật đường trunk, và cho PC-MOI (VLAN 10) nói chuyện được với PC-SALES1. Nếu lỡ tay bật cổng trước… hãy tự khôi phục lại VLAN như thiết kế.',
    build: () => makeNet([
      sw('core', 'SW-CORE', 500, 100, ['g0/1', 'g0/2']),
      sw('acc1', 'SW-ACC1', 250, 250, ['fa0/1', 'g0/1']),
      sw('moi', 'SW-MOI', 750, 250, ['fa0/1', 'g0/1']),
      pc('p1', 'PC-SALES1', 250, 390, { ip: '10.10.10.11' }),
      pc('p2', 'PC-MOI', 750, 390, { ip: '10.10.10.12' }),
    ], [['core', 'g0/1', 'acc1', 'g0/1'], ['core', 'g0/2', 'moi', 'g0/1'], ['p1', 'fa0', 'acc1', 'fa0/1'], ['p2', 'fa0', 'moi', 'fa0/1']]),
    init: [
      ['core', cfg('interface g0/2', 'shutdown', 'exit', 'vtp domain ANKHANG', 'vtp password Vtp@2026', 'vlan 10', 'name SALES', 'vlan 20', 'name HR', 'vlan 30', 'name IT', 'exit', 'interface range g0/1 - 2', 'switchport mode trunk')],
      ['acc1', cfg('vtp mode client', 'vtp domain ANKHANG', 'vtp password Vtp@2026', 'interface g0/1', 'switchport mode trunk', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10')],
      ['moi', cfg('vtp domain ANKHANG', 'vtp password Vtp@2026', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'exit',
        ...Array.from({ length: 8 }, (_, i) => [`vlan ${200 + i}`, 'exit', `no vlan ${200 + i}`]).flat(), 'no vlan 10', 'vlan 99', 'name LAB-TEST', 'exit', 'interface g0/1', 'switchport mode trunk')],
    ],
    tasks: [
      { text: 'SW-MOI vào domain ANKHANG ở chế độ CLIENT (đúng password), revision không vượt core', verify: 'SW-MOI: show vtp status', check: (a) => { const d = a.d('moi'); return d.vtpMode === 'client' && d.vtpDomain === 'ANKHANG' && d.vtpPw === 'Vtp@2026' && d.vtpRev <= a.d('core').vtpRev; } },
      { text: 'Core Gi0/2 đã bật, trunk CORE ↔ SW-MOI hoạt động', verify: 'SW-CORE: show interfaces trunk', check: (a) => !a.d('core').ports['g0/2'].shutdown && a.oper('core', 'g0/2') === 'trunk' && a.oper('moi', 'g0/1') === 'trunk' },
      { text: 'VLAN 10 SALES / 20 HR / 30 IT có trên cả 3 switch; VLAN 99 LAB-TEST KHÔNG lan vào domain', verify: 'show vlan brief (cả 3 switch)', check: (a) => ['core', 'acc1', 'moi'].every((s) => VLANS3(a.d(s)) && !a.d(s).vlans[99]) },
      { text: 'PC-MOI ping được PC-SALES1 (cùng VLAN 10 qua 2 trunk)', verify: 'ping 10.10.10.11', check: (a) => a.ping('p2', '10.10.10.11') },
      quiz('Cách AN TOÀN để đưa switch cũ vào domain VTP đang chạy?', ['Đưa về revision 0 trước khi cắm (chuyển transparent rồi về client, hoặc đổi tên domain rồi đổi lại), cấu hình client', 'Cắm vào ngay vì client không bao giờ ghi đè được server', 'Chỉ cần đặt đúng password', 'Xoá hết VLAN trên switch cũ là đủ'], 0, 'Xoá VLAN cũng làm TĂNG revision. Kể cả switch client có revision cao hơn vẫn có thể ghi đè cả domain.'),
    ],
    hints: ['SW-MOI: show vtp status → Configuration Revision rất cao (cao hơn core) → cắm vào là nó thắng!', 'Reset revision về 0: vtp mode transparent → vtp mode client (hoặc đổi vtp domain sang tên khác rồi đổi lại).', 'Rồi mới: SW-CORE → interface g0/2 → no shutdown. Kiểm tra show vlan brief trên cả 3 switch.', 'Lỡ bị ghi đè: trên SW-CORE xoá VLAN 99 và tạo lại VLAN 10/20/30 đúng tên — client sẽ đồng bộ theo.'],
    solution: [['moi', cfg('vtp mode transparent', 'vtp mode client')], ['core', cfg('interface g0/2', 'no shutdown')]],
  },

  // =====================================================================
  // D02 — PVLAN cho khách sạn + DHCP qua cổng promiscuous
  // =====================================================================
  {
    id: 'D02', group: 'adv', lesson: 'Chuyên đề — Private VLAN', level: 3, kind: 'config',
    title: 'Private VLAN cho khách sạn: phòng cô lập, nhân viên chung nhóm, DHCP vẫn chạy',
    story: 'Khách sạn Biển Xanh dùng 1 subnet 10.50.0.0/24 cho cả tầng. Yêu cầu bảo mật: 3 phòng khách (Fa0/2–4) KHÔNG được thấy nhau (isolated VLAN 501); 2 máy quầy lễ tân (Fa0/5–6) được nói chuyện với nhau (community VLAN 502) nhưng không thấy phòng khách; mọi máy nhận IP từ DHCP của R-GW và ra Internet 8.8.8.8 qua cổng promiscuous Fa0/1 (primary VLAN 500). R-GW đã có pool DHCP. Lưu ý: switch đang ở VTP server.',
    build: () => makeNet([
      server('inet', 'INTERNET 8.8.8.8', 860, 70, { ip: '8.8.8.8', gw: '8.8.8.1' }),
      router('rgw', 'R-GW', 500, 70, ['g0/0', 'g0/1']),
      sw('sw', 'SW-TANG3', 500, 210, fa(6)),
      pc('r1', 'PHONG-301', 100, 370, { dhcp: true }), pc('r2', 'PHONG-302', 260, 400, { dhcp: true }), pc('r3', 'PHONG-303', 420, 370, { dhcp: true }),
      pc('l1', 'LETAN-1', 640, 400, { dhcp: true }), pc('l2', 'LETAN-2', 820, 370, { dhcp: true }),
    ], [['rgw', 'g0/1', 'inet', 'fa0'], ['rgw', 'g0/0', 'sw', 'fa0/1'], ['r1', 'fa0', 'sw', 'fa0/2'], ['r2', 'fa0', 'sw', 'fa0/3'], ['r3', 'fa0', 'sw', 'fa0/4'], ['l1', 'fa0', 'sw', 'fa0/5'], ['l2', 'fa0', 'sw', 'fa0/6']]),
    init: [['rgw', cfg('interface g0/0', 'ip address 10.50.0.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown', 'exit', 'ip dhcp excluded-address 10.50.0.1 10.50.0.20', 'ip dhcp pool TANG3', 'network 10.50.0.0 255.255.255.0', 'default-router 10.50.0.1', 'dns-server 8.8.8.8')]],
    tasks: [
      { text: 'SW ở VTP transparent; PVLAN 500 primary (association 501,502), 501 isolated, 502 community', verify: 'show vlan private-vlan', check: (a) => { const d = a.d('sw'), p = d.pvlan; return d.vtpMode === 'transparent' && p[500]?.type === 'primary' && p[501]?.type === 'isolated' && p[502]?.type === 'community' && [501, 502].every((v) => p[500].assoc.includes(v)); } },
      { text: 'Fa0/1 promiscuous (mapping 500 → 501,502); Fa0/2–4 host 500/501; Fa0/5–6 host 500/502', verify: 'show interfaces switchport', check: (a) => { const P = a.d('sw').ports; const pv = (n) => P[n].pv || {}; return P['fa0/1'].mode === 'private-vlan' && pv('fa0/1').mode === 'promiscuous' && [501, 502].every((v) => (pv('fa0/1').mapping || []).includes(v)) && ['fa0/2', 'fa0/3', 'fa0/4'].every((n) => pv(n).mode === 'host' && pv(n).secondary === 501) && ['fa0/5', 'fa0/6'].every((n) => pv(n).mode === 'host' && pv(n).secondary === 502); } },
      { text: 'Cả 5 máy nhận IP DHCP (≥ .21, gateway 10.50.0.1) và ping được 8.8.8.8', verify: 'ipconfig /renew ; ping 8.8.8.8', check: (a) => ['r1', 'r2', 'r3', 'l1', 'l2'].every((id) => { const d = a.d(id); return hostIn(d.ip, '10.50.0.0', 24) && +d.ip.split('.')[3] >= 21 && d.gateway === '10.50.0.1' && a.ping(id, '8.8.8.8'); }) },
      { text: 'Phòng khách cô lập nhau và với lễ tân; 2 máy lễ tân nói chuyện được', verify: 'ping giữa các máy', check: (a) => { const ip = (id) => a.d(id).ip; return !!ip('r1') && !!ip('l2') && !a.ping('r1', ip('r2')) && !a.ping('r3', ip('r1')) && !a.ping('r1', ip('l1')) && !a.ping('l1', ip('r2')) && a.ping('l1', ip('l2')); } },
      quiz('Vì sao DHCP vẫn chạy được cho máy ở cổng isolated?', ['DHCP Discover (broadcast) từ cổng host vẫn tới cổng promiscuous — nơi có R-GW làm DHCP server', 'Isolated không chặn broadcast', 'Vì đã bật DHCP snooping', 'Không chạy được — phải đặt IP tĩnh'], 0, 'Isolated chỉ cấm host ↔ host; host luôn nói chuyện được với cổng promiscuous (gateway, DHCP, DNS...).'),
    ],
    hints: ['Private VLAN chỉ cấu hình được khi "vtp mode transparent".', 'vlan 501 → private-vlan isolated ; vlan 502 → private-vlan community ; vlan 500 → private-vlan primary → private-vlan association 501,502', 'Fa0/1: switchport mode private-vlan promiscuous → switchport private-vlan mapping 500 501,502', 'Fa0/2–4: switchport mode private-vlan host → switchport private-vlan host-association 500 501 (Fa0/5–6 dùng 502). Cuối cùng: ipconfig /renew trên từng máy.'],
    solution: [
      ['sw', cfg('vtp mode transparent', 'vlan 501', 'private-vlan isolated', 'vlan 502', 'private-vlan community', 'vlan 500', 'private-vlan primary', 'private-vlan association 501,502', 'exit',
        'interface fa0/1', 'switchport mode private-vlan promiscuous', 'switchport private-vlan mapping 500 501,502',
        'interface range fa0/2 - 4', 'switchport mode private-vlan host', 'switchport private-vlan host-association 500 501',
        'interface range fa0/5 - 6', 'switchport mode private-vlan host', 'switchport private-vlan host-association 500 502')],
      ...['r1', 'r2', 'r3', 'l1', 'l2'].map((id) => [id, ['ipconfig /renew']]),
    ],
  },

  // =====================================================================
  // D03 — IPsec site-to-site dựng từ đầu (kèm NAT exemption)
  // =====================================================================
  {
    id: 'D03', group: 'adv', lesson: 'Chuyên đề — IPsec site-to-site', level: 3, kind: 'config',
    title: 'IPsec site-to-site từ con số 0: HQ ↔ chi nhánh, vẫn giữ NAT ra Internet',
    story: 'HQ (LAN 10.10.0.0/24, R-HQ public 203.0.113.2) và chi nhánh (LAN 10.20.0.0/24, R-BR public 198.51.100.2) đã có Internet qua NAT PAT (ACL NAT permit LAN → any). Dựng VPN IPsec site-to-site để 2 LAN nói chuyện mã hoá: Phase 1 = ISAKMP policy 10 (AES 256, SHA, pre-share, DH group 14), key "S2S@Key2026"; Phase 2 = transform-set TS (esp-aes 256 esp-sha-hmac), ACL VPN đối xứng, crypto map CMAP áp lên cổng Internet G0/1. Không được làm mất Internet của 2 site.',
    build: () => makeNet([
      router('hq', 'R-HQ', 260, 170, ['g0/0', 'g0/1']), router('isp', 'ISP', 500, 70, ['g0/0', 'g0/1', 'g0/2']), router('br', 'R-BR', 740, 170, ['g0/0', 'g0/1']),
      pc('phq', 'PC-HQ', 110, 350, { ip: '10.10.0.10', gw: '10.10.0.1' }), pc('pbr', 'PC-BR', 890, 350, { ip: '10.20.0.10', gw: '10.20.0.1' }),
      server('inet', 'INTERNET 8.8.8.8', 500, 330, { ip: '8.8.8.8', gw: '8.8.8.1' }),
    ], [['hq', 'g0/1', 'isp', 'g0/0'], ['br', 'g0/1', 'isp', 'g0/1'], ['isp', 'g0/2', 'inet', 'fa0'], ['hq', 'g0/0', 'phq', 'fa0'], ['br', 'g0/0', 'pbr', 'fa0']]),
    init: [
      ['isp', cfg('interface g0/0', 'ip address 203.0.113.1 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 198.51.100.1 255.255.255.252', 'no shutdown', 'interface g0/2', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown')],
      ...[['hq', '10.10.0', '203.0.113'], ['br', '10.20.0', '198.51.100']].map(([r, lan, pub]) => [r, cfg('interface g0/0', `ip address ${lan}.1 255.255.255.0`, 'ip nat inside', 'no shutdown', 'interface g0/1', `ip address ${pub}.2 255.255.255.252`, 'ip nat outside', 'no shutdown', 'exit', `ip route 0.0.0.0 0.0.0.0 ${pub}.1`, 'ip access-list extended NAT', `permit ip ${lan}.0 0.0.0.255 any`, 'exit', 'ip nat inside source list NAT interface g0/1 overload')]),
    ],
    guide: [
      ...[['hq', 'R-HQ', '198.51.100.2', '10.10.0.0', '10.20.0.0'], ['br', 'R-BR', '203.0.113.2', '10.20.0.0', '10.10.0.0']].flatMap(([dev, name, peer, me, them], i) => [
        { dev, title: `${i * 3 + 1}. ${name}: Phase 1 — ISAKMP policy + pre-shared key`, why: i ? 'Đối xứng với HQ: policy giống hệt, key giống hệt, chỉ khác địa chỉ peer.' : 'Hai đầu phải có ít nhất 1 policy trùng hoàn toàn (encryption/hash/authentication/group). Key gắn với IP public của đầu kia, phân biệt hoa/thường.', cmds: [...ISAKMP, `crypto isakmp key S2S@Key2026 address ${peer}`] },
        { dev, title: `${i * 3 + 2}. ${name}: Phase 2 — transform-set, ACL VPN, crypto map`, why: i ? 'ACL VPN phải là ảnh gương của HQ (nguồn/đích đảo nhau).' : 'ACL "interesting traffic" chọn gói nào được mã hoá. Crypto map gom peer + transform-set + ACL và phải ÁP lên cổng ra Internet.', cmds: ['crypto ipsec transform-set TS esp-aes 256 esp-sha-hmac', 'exit', 'ip access-list extended VPN', `permit ip ${me} 0.0.0.255 ${them} 0.0.0.255`, 'exit', 'crypto map CMAP 10 ipsec-isakmp', `set peer ${peer}`, 'set transform-set TS', 'match address VPN', 'exit', 'interface g0/1', 'crypto map CMAP'] },
        { dev, title: `${i * 3 + 3}. ${name}: NAT exemption`, why: 'NAT xảy ra TRƯỚC mã hoá: nếu không loại trừ, gói LAN→LAN bị NAT thành IP public, không còn khớp ACL VPN và đi "trần" ra Internet. Chèn dòng deny lên ĐẦU ACL NAT.', cmds: ['ip access-list extended NAT', `5 deny ip ${me} 0.0.0.255 ${them} 0.0.0.255`] },
      ]),
      { dev: 'phq', raw: true, title: '7. Kiểm tra', why: 'Gói đầu tiên kích hoạt dựng SA ("interesting traffic"). Xem "▶ Xem gói tin" để thấy ESP; trên router: show crypto isakmp sa / show crypto ipsec sa.', cmds: ['ping 10.20.0.10', 'ping 8.8.8.8'] },
    ],
    tasks: [
      { text: 'Phase 1: cả 2 router có ISAKMP policy AES-256 / SHA / pre-share / group 14 và key giống nhau', verify: 'show crypto isakmp policy ; show run | include isakmp key', check: (a) => ['hq', 'br'].every((r) => polKey(a.d(r)).includes('aes 256|sha|pre-share|14') || polKey(a.d(r)).some((k) => /^aes.*\|sha\|pre-share\|14$/.test(k))) && !!a.d('hq').crypto.keys['198.51.100.2'] && a.d('hq').crypto.keys['198.51.100.2'] === a.d('br').crypto.keys['203.0.113.2'] },
      { text: 'Phase 2: crypto map CMAP (peer, transform-set TS, ACL VPN) áp lên G0/1 cả 2 router', verify: 'show crypto map', check: (a) => ['hq', 'br'].every((r) => { const d = a.d(r); const m = d.crypto.maps.CMAP; const e = m && Object.values(m)[0]; return d.ifaces['g0/1'].cryptoMap === 'CMAP' && !!e?.peer && !!d.crypto.tsets[e.tset] && !!d.acls[e.acl]; }) },
      { text: 'NAT exemption: ACL NAT 2 đầu KHÔNG permit traffic LAN ↔ LAN', verify: 'show access-lists NAT', check: (a) => N.aclEval(a.d('hq'), 'NAT', { src: '10.10.0.10', dst: '10.20.0.10', proto: 'icmp' }).action !== 'permit' && N.aclEval(a.d('br'), 'NAT', { src: '10.20.0.10', dst: '10.10.0.10', proto: 'icmp' }).action !== 'permit' },
      { text: 'PC-HQ ↔ PC-BR ping được QUA đường hầm ESP (cả 2 chiều)', verify: 'ping ; show crypto ipsec sa', check: (a) => a.vpnUp('phq', '10.20.0.10') && a.vpnUp('pbr', '10.10.0.10') },
      { text: 'Hai site vẫn ra Internet 8.8.8.8 (NAT vẫn chạy)', verify: 'ping 8.8.8.8', check: (a) => a.ping('phq', '8.8.8.8') && a.ping('pbr', '8.8.8.8') },
      quiz('Trong Phase 1, hai router KHÔNG cần giống nhau điều gì?', ['Số thứ tự policy (10, 20...)', 'Thuật toán mã hoá', 'Hash', 'Nhóm Diffie-Hellman'], 0, 'Router so NỘI DUNG policy, không quan tâm số thứ tự; số chỉ là độ ưu tiên cục bộ.'),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'Thứ tự: Phase 1 (policy + key) → Phase 2 (transform-set + ACL + crypto map) → áp map lên G0/1 → NAT exemption.', 'Debug: show crypto isakmp sa (QM_IDLE = Phase 1 OK) ; show crypto ipsec sa (#pkts encaps/decaps tăng).'],
  },

  // =====================================================================
  // D04 — BGP nhiều AS: iBGP qua loopback + eBGP + next-hop-self
  // =====================================================================
  {
    id: 'D04', group: 'adv', lesson: 'Chuyên đề — BGP iBGP/eBGP', level: 3, kind: 'config',
    title: 'BGP nhiều AS: iBGP qua loopback, eBGP ra ISP, next-hop-self',
    story: 'Công ty Sao Mai (AS 65010) có khối IP public 198.51.100.0/24 đặt ở LAN sau R2. R1 là router biên nối ISP (AS 64600, 203.0.113.0/30). R1–R2 nối nhau 10.0.12.0/30, loopback R1 = 1.1.1.1/32, R2 = 2.2.2.2/32. ISP đã chạy eBGP với khách hàng khác R-CUST (AS 65020, LAN 192.0.2.0/24). Yêu cầu: OSPF area 0 nội bộ (chỉ link R1–R2 và 2 loopback) làm IGP; iBGP R1–R2 bằng LOOPBACK (update-source); eBGP R1–ISP; R2 quảng bá 198.51.100.0/24 ra Internet; PC-SAOMAI tới được PC-CUST. Không dùng static route, không đưa link ISP vào OSPF.',
    build: () => makeNet([
      router('isp', 'ISP (AS64600)', 500, 70, ['g0/0', 'g0/1']),
      router('cust', 'R-CUST (AS65020)', 840, 140, ['g0/0', 'g0/1']),
      router('r1', 'R1 (AS65010)', 300, 170, ['g0/0', 'g0/1', 'lo0']),
      router('r2', 'R2 (AS65010)', 300, 330, ['g0/0', 'g0/1', 'lo0']),
      pc('pa', 'PC-SAOMAI', 520, 420, { ip: '198.51.100.10', gw: '198.51.100.1' }),
      pc('pc', 'PC-CUST', 880, 340, { ip: '192.0.2.10', gw: '192.0.2.1' }),
    ], [['r1', 'g0/0', 'isp', 'g0/0'], ['isp', 'g0/1', 'cust', 'g0/0'], ['cust', 'g0/1', 'pc', 'fa0'], ['r1', 'g0/1', 'r2', 'g0/1'], ['r2', 'g0/0', 'pa', 'fa0']]),
    init: [
      ['isp', cfg('interface g0/0', 'ip address 203.0.113.1 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.5 255.255.255.252', 'no shutdown', 'exit', 'router bgp 64600', 'neighbor 203.0.113.2 remote-as 65010', 'neighbor 203.0.113.6 remote-as 65020')],
      ['cust', cfg('interface g0/0', 'ip address 203.0.113.6 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 192.0.2.1 255.255.255.0', 'no shutdown', 'exit', 'router bgp 65020', 'network 192.0.2.0 mask 255.255.255.0', 'neighbor 203.0.113.5 remote-as 64600')],
      ['r1', cfg('interface g0/0', 'ip address 203.0.113.2 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.1 255.255.255.252', 'no shutdown', 'interface lo0', 'ip address 1.1.1.1 255.255.255.255')],
      ['r2', cfg('interface g0/0', 'ip address 198.51.100.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.2 255.255.255.252', 'no shutdown', 'interface lo0', 'ip address 2.2.2.2 255.255.255.255')],
    ],
    guide: [
      { dev: 'r1', title: '1. IGP: OSPF cho link R1–R2 và loopback', why: 'iBGP chạy trên loopback nên 2 loopback phải tới được nhau qua IGP. KHÔNG đưa link ISP (203.0.113.0/30) vào OSPF — đó là việc của BGP.', cmds: ['router ospf 1', 'router-id 1.1.1.1', 'network 10.0.12.0 0.0.0.3 area 0', 'network 1.1.1.1 0.0.0.0 area 0'] },
      { dev: 'r2', title: '', why: '', cmds: ['router ospf 1', 'router-id 2.2.2.2', 'network 10.0.12.0 0.0.0.3 area 0', 'network 2.2.2.2 0.0.0.0 area 0', 'network 198.51.100.0 0.0.0.255 area 0', 'passive-interface g0/0'] },
      { dev: 'r1', title: '2. R1: eBGP tới ISP + iBGP tới R2 qua loopback', why: '"update-source lo0" để gói BGP mang nguồn 1.1.1.1 (R2 khai neighbor 1.1.1.1). "next-hop-self": route học từ ISP có next-hop 203.0.113.1 — R2 không biết đường tới IP đó → route không vào bảng. next-hop-self đổi next-hop thành 1.1.1.1.', cmds: ['router bgp 65010', 'bgp router-id 1.1.1.1', 'neighbor 203.0.113.1 remote-as 64600', 'neighbor 2.2.2.2 remote-as 65010', 'neighbor 2.2.2.2 update-source lo0', 'neighbor 2.2.2.2 next-hop-self'] },
      { dev: 'r2', title: '3. R2: iBGP tới R1 + quảng bá khối public', why: '"network ... mask ..." chỉ quảng bá khi prefix có CHÍNH XÁC trong bảng định tuyến (ở đây là connected /24).', cmds: ['router bgp 65010', 'bgp router-id 2.2.2.2', 'neighbor 1.1.1.1 remote-as 65010', 'neighbor 1.1.1.1 update-source lo0', 'network 198.51.100.0 mask 255.255.255.0'] },
    ],
    tasks: [
      { text: 'OSPF R1 ↔ R2 FULL; R1 thấy 2.2.2.2/32 và R2 thấy 1.1.1.1/32 (link ISP không nằm trong OSPF)', verify: 'show ip route ospf', check: (a) => a.route('r1', '2.2.2.2/32')?.code === 'O' && a.route('r2', '1.1.1.1/32')?.code === 'O' && !a.ospfIf('r1', 'g0/0') },
      { text: 'iBGP R1 ↔ R2 Established qua loopback (update-source)', verify: 'show ip bgp summary', check: (a) => a.bgpUp('r1', '2.2.2.2') && a.bgpUp('r2', '1.1.1.1') },
      { text: 'eBGP R1 ↔ ISP Established', verify: 'show ip bgp summary', check: (a) => a.bgpUp('r1', '203.0.113.1') && a.bgpUp('isp', '203.0.113.2') },
      { text: 'R-CUST học 198.51.100.0/24 với AS-path 64600 65010', verify: 'R-CUST: show ip bgp', check: (a) => (a.route('cust', '198.51.100.0/24')?.asPath || []).join(' ') === '64600 65010' },
      { text: 'R2 có route BGP tới 192.0.2.0/24 (next-hop 1.1.1.1 nhờ next-hop-self)', verify: 'R2: show ip route bgp', check: (a) => { const r = a.route('r2', '192.0.2.0/24'); return r?.code === 'B' && r.nextHop === '1.1.1.1'; } },
      { text: 'PC-SAOMAI ping được PC-CUST; không có static route nào', verify: 'ping 192.0.2.10', check: (a) => a.ping('pa', '192.0.2.10') && ['r1', 'r2'].every((r) => a.d(r).routes.length === 0) },
      quiz('Vì sao iBGP thường peering bằng loopback?', ['Loopback luôn up khi router còn sống — nếu có nhiều đường, phiên iBGP không rớt khi 1 cổng vật lý đứt', 'Loopback nhanh hơn', 'BGP bắt buộc dùng loopback', 'Để tiết kiệm IP'], 0),
    ],
    hints: ['Xem "🧭 Cách giải chi tiết".', 'Phiên iBGP lên cần: IGP tới loopback đầu kia + "neighbor X update-source lo0" ở CẢ 2 đầu.', 'R2 thấy route 192.0.2.0/24 trong "show ip bgp" nhưng không có trong bảng định tuyến? → next-hop không tới được → next-hop-self trên R1.'],
  },

  // =====================================================================
  // D05 — STP: đặt Root Bridge đúng chỗ (cổng BLOCKING thật)
  // =====================================================================
  {
    id: 'D05', group: 'adv', lesson: 'Chuyên đề — STP & vị trí Root Bridge', level: 2, kind: 'ticket',
    title: 'STP: Root Bridge nằm nhầm ở switch access → dữ liệu đi đường vòng',
    story: '🎫 Tam giác L2: SW-ACC (switch cũ nhất, MAC thấp nhất) nối DS1 và DS2; DS1–DS2 nối trực tiếp bằng Gi0/2. Không ai cấu hình STP nên SW-ACC thắng bầu Root cho mọi VLAN → cổng DS1–DS2 bị BLOCK, mọi frame giữa SRV-DS1 và PC-DS2 phải vòng qua switch access yếu nhất. Yêu cầu: DS1 làm Root primary, DS2 Root secondary cho VLAN 10, để đường DS1–DS2 được dùng và cổng bị chặn chuyển về phía SW-ACC. Dùng "show spanning-tree vlan 10" để quan sát Role/Sts trước và sau.',
    build: () => makeNet([
      sw('acc', 'SW-ACC', 500, 300, ['fa0/1', 'g0/1', 'g0/2']),
      sw('ds1', 'DS1', 260, 120, ['fa0/1', 'g0/1', 'g0/2']),
      sw('ds2', 'DS2', 740, 120, ['fa0/1', 'g0/1', 'g0/2']),
      pc('pa', 'PC-ACC', 500, 430, { ip: '10.0.10.11' }),
      server('srv', 'SRV-DS1', 90, 230, { ip: '10.0.10.100' }),
      pc('pb', 'PC-DS2', 910, 230, { ip: '10.0.10.22' }),
    ], [['acc', 'g0/1', 'ds1', 'g0/1'], ['acc', 'g0/2', 'ds2', 'g0/1'], ['ds1', 'g0/2', 'ds2', 'g0/2'], ['pa', 'fa0', 'acc', 'fa0/1'], ['srv', 'fa0', 'ds1', 'fa0/1'], ['pb', 'fa0', 'ds2', 'fa0/1']]),
    init: ['acc', 'ds1', 'ds2'].map((d) => [d, cfg('vtp mode transparent', 'vlan 10', 'name DATA', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'interface range g0/1 - 2', 'switchport mode trunk')]),
    tasks: [
      { text: 'DS1 là Root Bridge VLAN 10 (priority thấp nhất), DS2 là dự phòng (secondary)', verify: 'show spanning-tree vlan 10', check: (a) => a.stpRoot(10) === 'ds1' && N.stpPriority(a.d('ds2'), 10) < N.stpPriority(a.d('acc'), 10) && N.stpPriority(a.d('ds1'), 10) < N.stpPriority(a.d('ds2'), 10) },
      { text: 'Đường DS1 ↔ DS2 (Gi0/2) đang FORWARDING ở cả 2 đầu; cổng BLOCKING nằm ở SW-ACC', verify: 'show spanning-tree vlan 10 (cột Sts)', check: (a) => a.stpRole('ds1', 'g0/2', 10)?.sts === 'FWD' && a.stpRole('ds2', 'g0/2', 10)?.sts === 'FWD' && a.stpRole('acc', 'g0/2', 10)?.sts === 'BLK' },
      { text: 'Frame SRV-DS1 → PC-DS2 đi thẳng DS1 → DS2, KHÔNG qua SW-ACC', verify: 'ping 10.0.10.22 → "▶ Xem gói tin"', check: (a) => { const p = a.l2path('srv', '10.0.10.22'); return p.length > 0 && !p.includes('acc') && a.ping('srv', '10.0.10.22'); } },
      { text: 'PC-ACC vẫn tới được cả SRV-DS1 và PC-DS2', verify: 'ping', check: (a) => a.ping('pa', '10.0.10.100') && a.ping('pa', '10.0.10.22') },
      { text: 'Dự phòng: dây DS1–DS2 đứt → STP mở lại cổng SW-ACC, PC-DS2 vẫn tới SRV-DS1', verify: 'DS1: interface g0/2 → shutdown', check: (a) => a.whatIf((n) => { n.devices.ds1.ports['g0/2'].shutdown = true; }, (b) => b.stpRole('acc', 'g0/2', 10)?.sts === 'FWD' && b.ping('pb', '10.0.10.100')) },
      quiz('Trước khi sửa, vì sao SW-ACC lại thắng bầu Root?', ['Mọi switch cùng priority 32768+VLAN → so MAC, switch cũ nhất có MAC thấp nhất thắng', 'Vì nó nối nhiều PC nhất', 'Vì nó là switch access', 'Vì cổng của nó nhanh nhất'], 0, 'Luôn chủ động đặt priority cho switch core/distribution, đừng để STP "tự chọn".'),
    ],
    hints: ['show spanning-tree vlan 10 trên cả 3 switch: Root ID là ai? Cổng nào Altn BLK?', 'DS1: spanning-tree vlan 10 root primary ; DS2: spanning-tree vlan 10 root secondary', 'Sau khi đổi: DS2 Gi0/2 thành Root Port, cổng BLK chuyển sang SW-ACC Gi0/2.'],
    solution: [['ds1', cfg('spanning-tree vlan 10 root primary')], ['ds2', cfg('spanning-tree vlan 10 root secondary')]],
  },
];
