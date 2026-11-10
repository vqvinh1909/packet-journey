// lab/roadmap.js — lộ trình học theo đề cương "200-301 CCNA v2.0" (Exam Topics, © Cisco; chỉ dùng số mục và tên chủ đề).
// Mỗi chủ đề gom: bài đọc (số bài giáo trình), kịch bản xem gói tin, lab bắt buộc (core) và lab thêm (more).
// `notes` là bài đọc ngắn cho chủ đề chưa có trong giáo trình.
// `gap` ghi rõ phần đề cương app chưa có thực hành, để người học không tưởng đã học đủ.
// tests/roadmap.test.js bắt buộc mọi lab và kịch bản đều có chỗ trong lộ trình.

import { NP_STAGES } from './roadmap-np.js';

// Mini Lab và Lab tổng hợp trong giáo trình HTML Hạ tầng (neo b31–b43).
const IA = '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Infrastructure-Administrator-Giao-trinh.html';
const IA_LABS = [
  ...[1, 2, 3, 4, 5, 6, 7].map((m) => ({ label: `Mini Lab Module ${m}`, path: `${IA}#b${30 + m}-s1` })),
  ...['GreenMart', 'VietManu', 'SunCare', 'sự cố VLAN/Trunk', 'sự cố OSPF/NAT', 'sự cố HSRP/ACL'].map((n, i) => ({ label: `Lab tổng hợp ${i + 1}: ${n}`, path: `${IA}#b${38 + i}-s1` })),
];

// Giáo trình Network Security (HTML ngoài repo): mỗi module một chủ đề, bài trỏ thẳng vào HTML.
// `shared`: lab đã có chỗ chính ở chặng khác, hiện lại ở đây để luyện theo giáo trình này (không tính trùng).
const NS = '../Network security/';
const nsDocs = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => ({ label: `Bài ${from + i}`, path: `${NS}x/Bai-${String(from + i).padStart(2, '0')}_x.md` }));
const NS_LABS = ['Ransomware', 'Insider Threat', 'DDoS và tấn công Web', 'Lộ khoá, xâm nhập Cloud', 'Chuỗi cung ứng']
  .map((n, i) => ({ label: `Lab tổng hợp SecOps ${i + 1}: ${n}`, path: `${NS}Network-Security-Giao-trinh.html#b${42 + i}-s1` }));
const NS_STAGE = {
  id: 'netsec', name: 'An ninh mạng: giáo trình Network Security (không tính tiến độ CCNA)', weight: 0, optional: true,
  topics: [
    ['M01', 'Toàn cảnh an ninh mạng: CIA, rủi ro, xác thực, mật mã', 1, 6, ['s47']],
    ['M02', 'Bức tranh tấn công: phishing, malware, Layer 2, web, DDoS, APT', 7, 13, ['s41', 's42', 's43', 's46', 's45', 's44'], ['S01', 'S02', 'S03', 'S05']],
    ['M03', 'Phòng thủ cấp tổ chức: chính sách, MFA, backup, patch, EDR, ransomware', 14, 21],
    ['M04', 'Bảo vệ hạ tầng: phân đoạn, hardening, Wi-Fi, server, cloud', 22, 26, ['s49'], ['S04', 'S06', 'L20', 'N15', 'N16', 'N17']],
    ['M05', 'Firewall và VPN: perimeter, NGFW, thiết bị hãng, VPN, Zero Trust', 27, 31, ['s48'], ['F01', 'F02', 'F03', 'F04', 'Z01', 'Z02', 'Z03', 'FG01', 'FG02', 'PA01', 'PA02', 'SP01', 'SP02', 'CP01', 'CP02', 'PF01', 'PF02', 'C05', 'D03']],
    ['M06', 'Giám sát và ứng phó: SIEM/SOC, IDS/IPS, quét lỗ hổng, IR, forensics', 32, 38],
    ['M07', 'Thực chiến: mini SOC lab, runbook, Purple Team', 39, 41],
  ].map(([ref, title, from, to, sc = [], shared = []]) => ({ ref, title, lessons: [], docs: nsDocs(from, to), sc, core: [], more: [], shared }))
    .concat({ ref: 'SecOps', title: 'Lab tổng hợp SecOps', lessons: [], docs: NS_LABS, sc: [], core: [], more: [] }),
};

// Thư viện giáo trình ngoài mảng mạng (HTML nằm ở E:\\SAP, ngoài thư mục Mạng máy tính nên đường dẫn bắt đầu bằng ../../).
// Chỉ có bài đọc: app chưa có lab cho các mảng này.
const D = (label, path) => ({ label, path });
const LIB_STAGE = {
  id: 'library', name: 'Hệ thống, giám sát, phân tích gói: thư viện giáo trình (chỉ có bài đọc)', weight: 0, optional: true,
  topics: [
    ['Wireshark', 'Phân tích gói bằng Wireshark', [D('Giáo trình Wireshark', '../Wireshark-Network-Administrator/docs/html/index.html')]],
    ['Linux', 'Quản trị Linux và vận hành hệ thống', [
      D('Linux System Administrator', '../../SysOps-DevOps/01-Linux System Administrator/01-Linux-System-Administrator-Giao-trinh.html'),
      D('System Operations và Infrastructure', '../../SysOps-DevOps/02-System Operations va Infrastructure/02-System-Operations-va-Infrastructure-Giao-trinh.html')]],
    ['Windows', 'Windows Server và dịch vụ', [
      D('Windows Server 2022', '../../Windows-Server/System Administrator/Mon-01_Windows-Server-2022/Windows-Server-2022-Giao-trinh.html'),
      D('IIS Web Server', '../../Windows-Server/System Administrator/Mon-02_IIS-Web-Server/IIS-Web-Server-2022-Giao-trinh.html'),
      D('Mail Server MDaemon', '../../Windows-Server/System Administrator/Mon-03_Mail-Server-MDaemon/Mail-Server-MDaemon-Giao-trinh.html'),
      D('Kiwi Syslog Server', '../../Windows-Server/System Administrator/Mon-05_Kiwi-Syslog-Server/Kiwi-Syslog-Server-Giao-trinh.html'),
      D('Sophos Firewall', '../../Windows-Server/System Administrator/Mon-06_Sophos-Firewall/Sophos-Firewall-Giao-trinh.html')]],
    ['DevOps', 'Kubernetes và CI/CD', [
      D('Kubernetes cho SysOps', '../../SysOps-DevOps/03-Kubernetes cho SysOps/03-Kubernetes-cho-SysOps-Giao-trinh.html'),
      D('DevOps Automation CI/CD', '../../SysOps-DevOps/04-DevOps Automation CI-CD/04-DevOps-Automation-CICD-Giao-trinh.html')]],
    ['Hạ tầng', 'Ảo hoá, lưu trữ, sao lưu', [
      D('vSphere Virtualization', '../../Virtualization/vSphere_Virtualization.html'),
      D('Storage Enterprise', '../../Storage/Storage_Enterprise.html'),
      D('Veeam Backup và Disaster Recovery', '../../Monitoring/Backup/Veeam_Backup_Disaster_Recovery.html')]],
    ['SOC', 'Giám sát và phát hiện: Wazuh, Sysmon, SIEM', [
      D('Wazuh: triển khai và quản trị', '../../Monitoring/Wazuh/Wazuh_Basic_Administration_Deployment.html'),
      D('Wazuh: detection engineering cho SOC', '../../Monitoring/Wazuh/Wazuh_Advanced_Detection_Engineering_SOC.html'),
      D('Sysmon: Windows telemetry', '../../Monitoring/Sysmon/Sysmon_Windows_Telemetry.html'),
      D('SIEM chuyên sâu', '../../Advanced-Architecture/04-SIEM-Chuyen-Sau/Mon-04-SIEM-Chuyen-Sau-Textbook.html')]],
    ['Chuẩn', 'Quản trị và tiêu chuẩn: ITIL, NIST, ISO 27001', [
      D('ITIL và COBIT', '../../Advanced-Architecture/01-ITIL-COBIT/Mon-01-ITIL-COBIT-Textbook.html'),
      D('NIST và ISO 27001', '../../Advanced-Architecture/02-NIST-ISO27001/Mon-02-NIST-ISO27001-Textbook.html')]],
  ].map(([ref, title, docs]) => ({ ref, title, lessons: [], docs, sc: [], core: [], more: [], gap: 'Chưa có lab trong app.' })),
};

export const ROADMAP = [
  {
    id: 'infra', name: 'Hạ tầng & kết nối mạng', weight: 25,
    topics: [
      { ref: 'Mở đầu', title: 'Gói tin đi trong mạng như thế nào', lessons: [1, 2], sc: ['s01', 's14'], core: ['A01'], more: ['A25', 'A03', 'A04'] },
      { ref: '1.1', title: 'Cáp và lỗi interface', lessons: [3, 4], sc: [], core: ['C01', 'N10', 'N19'], more: [] },
      { ref: '1.2', title: 'Hypervisor, máy ảo, container', lessons: [32], sc: [], core: ['N12'], more: [], notes: [
        'Máy ảo (VM): phần mềm giả lập cả một máy tính, có hệ điều hành riêng, CPU, RAM, ổ đĩa và card mạng ảo (vNIC).',
        'Hypervisor: lớp chia phần cứng cho các VM. Type 1 chạy trực tiếp trên phần cứng (ESXi, Hyper-V). Type 2 chạy trên một hệ điều hành (VirtualBox, VMware Workstation).',
        'Container: chỉ đóng gói ứng dụng và thư viện, dùng chung kernel của máy chủ, nên nhẹ và khởi động nhanh, nhưng cách ly kém hơn VM.',
        'vSwitch: switch Layer 2 bằng phần mềm trong hypervisor. vNIC nối vào port group, thường ứng với một VLAN. Card mạng vật lý là uplink, thường chạy trunk.',
      ] },
      { ref: '1.3', title: 'Địa chỉ IPv4 và subnet', lessons: [5], sc: ['s02', 's16'], core: ['L01', 'A02'], more: ['A06', 'B01'] },
      { ref: '1.4', title: 'Địa chỉ IPv6', lessons: [6], sc: ['s26', 's28'], core: ['X05'], more: [] },
      { ref: '1.5', title: 'Nguyên lý Wi-Fi: băng tần, kênh, bảo mật', lessons: [24], sc: [], core: ['W03', 'W05'], more: [] },
      { ref: '1.6', title: 'Xử lý lỗi kết nối máy khách có dây và Wi-Fi', lessons: [], sc: ['s22'], core: ['W04', 'N20'], more: [] },
      { ref: '1.7', title: 'DHCPv4: client, server, relay', lessons: [19], sc: ['s09'], core: ['L16'], more: ['A18'] },
    ],
  },
  {
    id: 'switching', name: 'Switching & truy cập mạng', weight: 25,
    topics: [
      { ref: '2.2', title: 'Cấu hình switch và VLAN cho cổng người dùng', lessons: [7, 8], sc: ['s03', 's23'], core: ['L02', 'L03', 'A05', 'N11'], more: ['B08', 'N07'] },
      { ref: '2.2.b', title: 'Nối AP và WLC vào switch', lessons: [25, 36], sc: [], core: ['W01', 'W02'], more: [] },
      { ref: '2.1.a', title: 'Cổng Layer 2 và cổng định tuyến Layer 3', lessons: [], sc: [], core: ['N23'], more: [] },
      { ref: '2.1.b', title: 'Trunk 802.1Q', lessons: [9], sc: ['s04'], core: ['L04', 'A09'], more: ['A15', 'C04'] },
      { ref: '2.1.c', title: 'EtherChannel LACP', lessons: [10], sc: [], core: ['L05'], more: ['A24'] },
      { ref: '2.1.d', title: 'SVI và định tuyến giữa các VLAN', lessons: [12], sc: ['s06'], core: ['L07', 'A16'], more: ['B03', 'B06', 'B02'] },
      { ref: '2.3', title: 'Kiểm tra sơ đồ bằng CDP và LLDP', lessons: [], sc: [], core: ['A07', 'N01'], more: [] },
      { ref: '2.4', title: 'Xử lý sự cố bằng show, ping, traceroute', lessons: [], sc: ['s15'], core: ['T01', 'C03'], more: ['T05'] },
      { ref: '2.5', title: 'Rapid PVST+: root, vai trò cổng, PortFast, BPDU Guard', lessons: [10], sc: ['s05', 's19'], core: ['A12', 'A13', 'N14'], more: ['D05'] },
    ],
  },
  {
    id: 'routing', name: 'Định tuyến IP', weight: 20,
    topics: [
      { ref: '3.1', title: 'Đọc bảng định tuyến', lessons: [11], sc: [], core: ['L06'], more: [] },
      { ref: '3.2', title: 'Static route: default, network, host, floating', lessons: [13], sc: [], core: ['L08', 'L09'], more: ['A17', 'B04', 'B05', 'N03', 'T06'] },
      { ref: '3.3', title: 'OSPF một vùng: OSPFv2 và OSPFv3', lessons: [14], sc: ['s07', 's27'], core: ['L10', 'A14', 'N02'], more: ['L11', 'B09', 'T02', 'T04'] },
      { ref: '3.4', title: 'Đọc trạng thái HSRP và VRRP', lessons: [21, 23], sc: ['s13'], core: ['L19', 'A22'], more: ['A23', 'T03'] },
    ],
  },
  {
    id: 'services', name: 'Dịch vụ mạng & bảo mật', weight: 20,
    topics: [
      { ref: '4.1', title: 'Tài khoản local và AAA', lessons: [27], sc: [], core: ['S04', 'N17'], more: [] },
      { ref: '4.2', title: 'Quản lý file cấu hình và IOS', lessons: [], sc: [], core: ['B10', 'N18'], more: ['N08'] },
      { ref: '4.3', title: 'NAT và PAT', lessons: [20], sc: ['s11'], core: ['L17', 'L18'], more: ['A19', 'A20', 'A21'] },
      { ref: '4.4', title: 'Bản ghi DNS', lessons: [31], sc: ['s10'], core: ['N09'], more: [] },
      { ref: '4.5', title: 'VPN IPsec', lessons: [22], sc: [], core: ['C05'], more: ['D03'] },
      { ref: '4.6', title: 'ACL IPv4', lessons: [16, 17], sc: ['s12'], core: ['L13', 'L14', 'A10'], more: ['A08', 'N06'] },
      { ref: '4.7', title: 'Bảo mật Layer 2', lessons: [26], sc: [], core: ['L20', 'S01', 'S02', 'N15', 'N16'], more: ['B07', 'S03', 'S05', 'S06'] },
    ],
  },
  {
    id: 'operations', name: 'AI & vận hành mạng', weight: 10,
    topics: [
      { ref: '5.1–5.2', title: 'Agentic AI và cách viết prompt cho vận hành', lessons: [33], sc: [], core: ['N13'], more: [], notes: [
        'AI tạo sinh trả lời theo prompt. AI agent đi xa hơn: tự chia việc, gọi công cụ như lệnh show hay API, xem kết quả rồi làm bước tiếp theo. Đề thi có thể yêu cầu đánh giá đề xuất của agent và trợ lý mạng.',
        'Bốn thành phần prompt trong đề cương: phân loại dữ liệu (dữ liệu nào được phép gửi), định dạng kết quả, persona (đóng vai ai) và chỉ dẫn (việc cần làm).',
        'Ví dụ: "Bạn là kỹ sư mạng (persona). Dữ liệu nội bộ, đã che IP công khai (phân loại dữ liệu): <output show interfaces>. Liệt kê nguyên nhân khả dĩ và lệnh kiểm chứng, chưa đổi cấu hình (chỉ dẫn). Trả lời dạng bảng (định dạng)."',
        'AI có thể trả lời sai mà vẫn rất tự tin, nên phải kiểm chứng bằng show, ping hoặc tài liệu hãng trước khi áp dụng.',
        'Không dán mật khẩu, community SNMP, khoá VPN hay dữ liệu khách hàng vào công cụ AI chưa được công ty duyệt.',
        'Cho agent quyền tối thiểu, bắt đầu với quyền chỉ đọc. Thay đổi cấu hình cần người duyệt, có log và có cách hoàn tác.',
      ] },
      { ref: '5.3', title: 'Các cách quản lý mạng: controller, cloud, IaC', lessons: [29, 35], sc: [], core: ['N22'], more: [], notes: [
        'Device-based: cấu hình từng thiết bị bằng CLI hoặc giao diện web. Đơn giản, nhưng khó nhất quán khi mạng lớn.',
        'Controller-based: controller như WLC hay Catalyst Center giữ chính sách và đẩy xuống thiết bị.',
        'Cloud-based: bảng điều khiển do nhà cung cấp chạy trên cloud, ví dụ Meraki. Thiết bị chỉ cần kết nối về đó.',
        'Automation-based: công cụ như Ansible chạy lệnh và đẩy cấu hình hàng loạt theo kịch bản.',
        'Infrastructure as Code: cấu hình mong muốn nằm trong tệp có quản lý phiên bản, duyệt rồi mới áp dụng, và chạy lại không gây thay đổi thừa.',
      ] },
      { ref: '5.4', title: 'SNMP', lessons: [], sc: [], core: ['N04'], more: ['N05'] },
      { ref: '5.5', title: 'Chạy lệnh bằng Ansible', lessons: [30], sc: [], core: ['N21'], more: [] },
      { ref: '5.6', title: 'Đọc syslog: mức độ và facility', lessons: [18], sc: [], core: ['L15'], more: [] },
    ],
  },
  {
    id: 'capstone', name: 'Tổng hợp trước khi thi', weight: 0,
    topics: [
      { ref: 'Dự án', title: 'Dựng mạng doanh nghiệp hoàn chỉnh', lessons: [], docs: IA_LABS, sc: [], core: ['P01', 'X01'], more: ['X04'] },
    ],
  },
  {
    id: 'encor', name: 'CCNP ENCOR 350-401 v1.2 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      { ref: '1.1', title: 'Thiết kế mạng doanh nghiệp, HA, FHRP, SSO', lessons: [], docs: [{ label: 'Bài 1 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-01_Thiet-ke-mang-va-HA.md' }], sc: [], core: [], more: [], notes: [
        'Ba lớp access, distribution, core để mở rộng; collapsed core gộp hai lớp trên cho site nhỏ. Leaf-spine dùng cho trung tâm dữ liệu: mọi leaf cách nhau đúng hai chặng.',
        'On-premises chủ động về dữ liệu nhưng tự gánh phần cứng. Cloud trả theo mức dùng, co giãn nhanh nhưng phụ thuộc đường truyền. Hybrid là phổ biến nhất.',
        'Sẵn sàng cao trên switch: StackWise gộp nhiều switch thành một, SSO giữ trạng thái khi supervisor chuyển đổi, NSF giữ chuyển tiếp trong lúc control plane khởi động lại.',
      ] },
      { ref: '1.2', title: 'SD-WAN: vBond, vSmart, vManage, OMP', lessons: [], docs: [{ label: 'Bài 2 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-02_SD-WAN.md' }], sc: ['s37'], core: [], more: [] },
      { ref: '1.3', title: 'SD-Access: fabric, LISP, VXLAN, SGT', lessons: [], docs: [{ label: 'Bài 3 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-03_SD-Access.md' }], sc: ['s36'], core: [], more: [] },
      { ref: '1.4, 3.3', title: 'QoS, NTP, NAT, FHRP', lessons: [], docs: [{ label: 'Bài 4 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-04_QoS.md' }, { label: 'Bài 10 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-10_NTP-NAT-FHRP.md' }], sc: [], core: [], more: ['E11'] },
      { ref: '2.1', title: 'Ảo hoá thiết bị: VM, switch ảo, container', lessons: [], docs: [{ label: 'Bài 5 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-05_Ao-hoa-thiet-bi.md' }], sc: [], core: [], more: [], notes: [
        'Hypervisor type 1 chạy trực tiếp trên phần cứng (ESXi, KVM, Hyper-V), type 2 chạy trên một hệ điều hành khác (VirtualBox).',
        'Switch ảo (vSwitch, OVS) nối VM trong cùng máy, hoạt động giống switch L2 và có thể chạy VLAN, trunk tới switch thật.',
        'Container dùng chung kernel, nhẹ và khởi động nhanh hơn VM. Trên Catalyst có thể chạy ứng dụng container qua IOx.',
      ] },
      { ref: '2.3', title: 'LISP và VXLAN', lessons: [], docs: [{ label: 'Bài 7 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-07_LISP-VXLAN.md' }], sc: ['s35', 's30'], core: [], more: [] },
      { ref: '2.2', title: 'VRF, GRE, IPsec', lessons: [], docs: [{ label: 'Bài 6 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-06_VRF-GRE-IPsec.md' }], sc: [], core: [], more: ['E01'] },
      { ref: '3.1', title: 'RSTP, MST, Root Guard, BPDU Guard', lessons: [], docs: [{ label: 'Bài 8 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-08_Layer-2.md' }], sc: [], core: [], more: ['E03'] },
      { ref: '3.2', title: 'OSPF nhiều vùng, tóm tắt, lọc; so với EIGRP', lessons: [], docs: [{ label: 'Bài 9 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-09_Layer-3.md' }], sc: [], core: [], more: ['E02'], notes: [
        'EIGRP là distance vector nâng cao: tính bằng DUAL, có đường dự phòng feasible successor nên hội tụ ngay, cân bằng tải không đều bằng variance.',
        'OSPF là link-state: mọi router trong vùng có cùng bản đồ và chạy SPF, cân bằng tải chỉ khi chi phí bằng nhau, chia vùng để giới hạn phạm vi cập nhật.',
      ] },
      { ref: '3.3', title: 'Multicast: RPF, PIM SM, IGMP, SSM, BIDIR, MSDP', lessons: [], docs: [{ label: 'Bài 11 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-11_Multicast.md' }], sc: ['s33'], core: [], more: [] },
      { ref: '3.3', title: 'PTP', lessons: [], docs: [{ label: 'Bài 10 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-10_NTP-NAT-FHRP.md' }], sc: [], core: [], more: [], notes: [
        'PTP (IEEE 1588) đồng bộ tới mức dưới micro giây nhờ phần cứng đóng dấu thời gian. NTP thường chỉ đạt mức mili giây.',
        'Grandmaster là nguồn gốc. Boundary clock nhận thời gian rồi phát lại ở từng chặng, transparent clock ghi thêm thời gian gói nằm trong switch.',
      ] },
      { ref: '4.2, 4.3, 4.4', title: 'NetFlow, SPAN, IP SLA', lessons: [], docs: [{ label: 'Bài 13 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-13_NetFlow-SPAN-IPSLA.md' }], sc: [], core: [], more: ['E04', 'E05', 'E06'] },
      { ref: '4.5', title: 'Catalyst Center: quản lý, assurance, AI', lessons: [], docs: [{ label: 'Bài 14 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-14_Catalyst-Center.md' }], sc: [], core: [], more: [], notes: [
        'Khác cách quản lý truyền thống: thiết kế và chính sách đặt tập trung, thiết bị nhận cấu hình tự động thay vì gõ CLI từng máy.',
        'Workflow gồm Design, Policy, Provision, Assurance. Plug and Play đưa thiết bị mới vào mạng không cần gõ tay.',
        'Assurance gom telemetry, chấm điểm sức khoẻ thiết bị, máy khách, ứng dụng. AI giúp phát hiện bất thường theo so sánh với mức nền, và gợi ý cách xử lý.',
      ] },
      { ref: '4.6, 6.2, 6.3, 6.5', title: 'NETCONF, RESTCONF, YANG, JSON', lessons: [], docs: [{ label: 'Bài 15 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-15_NETCONF-RESTCONF-YANG.md' }, { label: 'Bài 19 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-19_Python-JSON.md' }, { label: 'Bài 20 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-20_API-Catalyst-Center-SD-WAN.md' }], sc: [], core: [], more: ['E07'], notes: [
        'YANG là mô hình dữ liệu: mô tả cấu trúc cấu hình và trạng thái. NETCONF (SSH 830, XML) và RESTCONF (HTTPS, JSON hoặc XML) là cách truyền dữ liệu theo mô hình đó.',
        'NETCONF có các kho running, candidate, startup và thao tác khoá, xác nhận. RESTCONF ánh xạ CRUD sang GET, POST, PUT, PATCH, DELETE.',
      ] },
      { ref: '5.3', title: 'Bảo mật REST API', lessons: [], docs: [{ label: 'Bài 18 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-18_Bao-mat-API-va-thiet-ke.md' }], sc: [], core: [], more: [], notes: [
        'Luôn dùng HTTPS và kiểm tra chứng chỉ. Cờ -k của curl chỉ dùng trong lab.',
        'Xác thực bằng token có hạn dùng thay vì gửi mật khẩu mỗi lần. Không ghi token vào mã nguồn, dùng biến môi trường hoặc kho bí mật.',
        'Cấp quyền tối thiểu, giới hạn số yêu cầu, kiểm tra dữ liệu đầu vào và ghi log các lần truy cập.',
      ] },
      { ref: '5.4', title: 'Thiết kế bảo mật: TrustSec, MACsec, 802.1X (SGT: xem kịch bản SD-Access)', lessons: [], docs: [{ label: 'Bài 18 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-18_Bao-mat-API-va-thiet-ke.md' }], sc: [], core: [], more: [], notes: [
        'Threat defense gồm nhiều lớp: NGFW và IPS, phòng chống mã độc, phân tích lưu lượng. Endpoint security bảo vệ từng máy.',
        'TrustSec gán SGT theo danh tính, thực thi bằng SGACL, truyền nhãn inline hoặc qua SXP. MACsec (802.1AE) mã hoá từng đoạn cáp ở lớp 2, khoá trao đổi bằng MKA.',
      ] },
      { ref: '5.1, 5.2', title: 'AAA, CoPP', lessons: [], docs: [{ label: 'Bài 16 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-16_Truy-cap-thiet-bi-AAA.md' }, { label: 'Bài 17 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-17_ACL-CoPP.md' }], sc: [], core: [], more: ['E08', 'E09'] },
      { ref: '6.1, 6.4', title: 'Python và API', lessons: [], docs: [{ label: 'Bài 19 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-19_Python-JSON.md' }, { label: 'Bài 20 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-20_API-Catalyst-Center-SD-WAN.md' }], sc: [], core: [], more: [], notes: [
        'Đọc được mã: requests.get(url, auth=(u, p), verify=True), r.json()["items"], vòng for, if, hàm. Thi yêu cầu hiểu kết quả của đoạn mã ngắn, không phải viết chương trình lớn.',
        'Mã HTTP cần nhớ: 200, 201, 204 thành công; 400 sai yêu cầu; 401 chưa xác thực; 403 không có quyền; 404 không thấy; 500 lỗi phía máy chủ.',
        'Catalyst Center và SD-WAN Manager đều có REST API: lấy token trước rồi gửi kèm header ở các lần gọi sau.',
      ] },
      { ref: '6.6', title: 'EEM', lessons: [], docs: [{ label: 'Bài 21 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-21_EEM-va-orchestration.md' }], sc: [], core: [], more: ['E10'] },
      { ref: '6.7', title: 'Công cụ có agent và không agent', lessons: [], docs: [{ label: 'Bài 21 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-21_EEM-va-orchestration.md' }], sc: [], core: [], more: [], notes: [
        'Có agent (Puppet, Chef): cài phần mềm trên từng thiết bị, agent tự kéo cấu hình từ máy chủ theo chu kỳ. Thiết bị mạng phải hỗ trợ agent.',
        'Không agent (Ansible, cả NETCONF hay SSH thuần): máy điều khiển đẩy lệnh qua SSH hoặc API. Không phải cài gì thêm nên hợp với thiết bị mạng.',
        'Kéo (pull) giữ cấu hình đồng bộ đều đặn, nhưng cần hạ tầng agent. Đẩy (push) đơn giản, thay đổi chạy ngay khi gọi, nhưng phải có máy điều khiển nối được tới thiết bị.',
        'Ansible dùng playbook YAML, Puppet dùng manifest, Chef dùng recipe viết bằng Ruby. SaltStack có cả hai cách: minion có agent hoặc salt-ssh không agent.',
      ] },
      { ref: '3.1, 3.2, 4.1, 5.2', title: 'Phần đã có lab ở nhóm khác', lessons: [], docs: [{ label: 'Bài 8 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-08_Layer-2.md' }, { label: 'Bài 9 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-09_Layer-3.md' }, { label: 'Bài 12 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-12_Chan-doan-mang.md' }, { label: 'Bài 17 ENCOR', path: '../CCNP/Module-01_ENCOR/Bai-17_ACL-CoPP.md' }], sc: [], core: [], more: [], notes: [
        'Trunk và DTP: A09, A15, C04. EtherChannel: L05, A24.',
        'eBGP và best path: R07. PBR: R02. HSRP, VRRP: L19, A22. NAT/PAT: L17, L18.',
        'Debug, ping, traceroute: R12, T01, C03. Syslog: L15. SNMP: N04. ACL: L13, L14, A10.',
      ] },
    ],
  },
  {
    id: 'enarsi', name: 'CCNP ENARSI 300-410 v1.1 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      { ref: '1.1–1.6', title: 'AD, route-map, chống lặp, redistribution, tóm tắt, PBR', lessons: [], docs: [{ label: 'Bài 1 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-01_Administrative-Distance.md' }, { label: 'Bài 2 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-02_Route-map.md' }, { label: 'Bài 3 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-03_Chong-lap.md' }, { label: 'Bài 4 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-04_Redistribution.md' }, { label: 'Bài 5 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-05_Tom-tat-route.md' }, { label: 'Bài 6 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-06_PBR.md' }], sc: [], core: [], more: ['R13', 'R01', 'R02'] },
      { ref: '1.8', title: 'BFD', lessons: [], docs: [{ label: 'Bài 8 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-08_BFD.md' }], sc: ['s39'], core: [], more: [] },
      { ref: '1.9', title: 'EIGRP classic và named, IPv6, xác thực, stub, variance', lessons: [], docs: [{ label: 'Bài 9 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-09_EIGRP.md' }], sc: [], core: [], more: ['R05', 'R06', 'R14'] },
      { ref: '1.10', title: 'OSPF: loại area, virtual link, xác thực, kiểu mạng, OSPFv3 AF', lessons: [], docs: [{ label: 'Bài 10 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-10_OSPF.md' }], sc: [], core: [], more: ['R03', 'R04', 'R17', 'R18'] },
      { ref: '1.11', title: 'BGP: chọn đường, RR, peer group, multihop, IPv6, AS riêng', lessons: [], docs: [{ label: 'Bài 11 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-11_BGP.md' }], sc: [], core: [], more: ['R07', 'R08', 'R15', 'R16'] },
      { ref: '2.1, 2.2', title: 'MPLS, LDP, L3VPN', lessons: [], docs: [{ label: 'Bài 12 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-12_MPLS.md' }], sc: ['s29', 's34'], core: [], more: [] },
      { ref: '2.3', title: 'DMVPN một hub', lessons: [], docs: [{ label: 'Bài 13 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-13_DMVPN.md' }], sc: ['s38'], core: [], more: ['R09'] },
      { ref: '3.2', title: 'uRPF, ACL theo giờ', lessons: [], docs: [{ label: 'Bài 15 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-15_ACL-uRPF.md' }], sc: [], core: [], more: ['R10'] },
      { ref: '3.4', title: 'Bảo mật IPv6 lớp truy cập', lessons: [], docs: [{ label: 'Bài 17 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-17_IPv6-First-Hop.md' }], sc: [], core: [], more: [], notes: [
        'RA Guard chặn RA giả từ cổng máy trạm. DHCPv6 Guard chặn máy chủ DHCPv6 giả.',
        'Binding table ghi cặp IPv6, MAC, cổng, nhờ ND Inspection và Source Guard kiểm tra được gói giả.',
        'Lỗi hay gặp: bật RA Guard mà không đặt cổng nối router là device-role router, nên máy trạm mất default gateway.',
      ] },
      { ref: '4.3, 4.4, 1.8', title: 'Debug có điều kiện, DHCPv6, BFD', lessons: [], docs: [{ label: 'Bài 20 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-20_Logging-Debug.md' }, { label: 'Bài 21 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-21_DHCP.md' }], sc: [], core: [], more: ['R11', 'R12'] },
      { ref: '4.3, 4.5', title: 'IP SLA jitter, telemetry', lessons: [], docs: [{ label: 'Bài 20 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-20_Logging-Debug.md' }, { label: 'Bài 22 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-22_IP-SLA.md' }], sc: [], core: [], more: ['R19'] },
      { ref: '1.7, 3.1, 3.3, 4.1, 4.2, 4.5, 4.6', title: 'Phần đã có lab ở nhóm khác', lessons: [], docs: [{ label: 'Bài 7 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-07_VRF-Lite.md' }, { label: 'Bài 14 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-14_AAA.md' }, { label: 'Bài 16 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-16_CoPP.md' }, { label: 'Bài 18 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-18_Quan-tri-thiet-bi.md' }, { label: 'Bài 19 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-19_SNMP.md' }, { label: 'Bài 22 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-22_IP-SLA.md' }, { label: 'Bài 23 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-23_NetFlow.md' }], sc: [], core: [], more: [], notes: [
        'VRF-Lite: E01. AAA: E08. CoPP: E09.',
        'IP SLA và track: E06. NetFlow: E04. SNMP v2c, v3: N04, N05.',
        'Console, VTY, SSH: S04. SCP: N18. TFTP: B10.',
      ] },
      { ref: '4.7', title: 'Catalyst Center Assurance', lessons: [], docs: [{ label: 'Bài 24 ENARSI', path: '../CCNP/Module-02_ENARSI/Bai-24_Assurance.md' }], sc: [], core: [], more: [], notes: [
        'Dashboard theo sức khoẻ: Network, Client, Application. Bấm vào một máy khách để xem cả quá trình kết nối theo thời gian.',
        'Path Trace vẽ đường đi giữa hai điểm và chỉ ra chỗ ACL chặn. Issue đưa sẵn nguyên nhân có thể và bước xử lý gợi ý.',
      ] },
    ],
  },
  ...NP_STAGES,
  {
    id: 'beyond', name: 'Sau CCNA v2.0 (không tính tiến độ)', weight: 0, optional: true,
    topics: [
      { ref: 'CCNP', title: 'OSPF nhiều vùng, EIGRP, BGP, redistribution', lessons: [15], sc: ['s18', 's08', 's17', 's21'], core: [], more: ['L12', 'D04', 'X03'] },
      { ref: 'CCNP', title: 'VTP, DTP nâng cao, Private VLAN, MST', lessons: [], sc: ['s24'], core: [], more: ['A11', 'D01', 'A26', 'D02'] },
      { ref: 'WAN', title: 'Serial, PPP, GRE', lessons: [], sc: [], core: [], more: ['C02', 'X02'] },
      { ref: 'QoS', title: 'Đánh dấu và xếp hàng', lessons: [34], sc: ['s20', 's25'], core: [], more: [] },
      { ref: 'Voice', title: 'VoIP: SIP, RTP, codec', lessons: [], sc: ['s40'], core: [], more: [] },
      { ref: 'SP/DC', title: 'MPLS, Segment Routing, VXLAN và EVPN', lessons: [], sc: ['s31', 's32'], core: [], more: [] },
      { ref: 'Firewall', title: 'Firewall nhiều hãng', lessons: [28], sc: [], core: [], more: ['F01', 'F02', 'F03', 'F04', 'Z01', 'Z02', 'Z03', 'FG01', 'FG02', 'PA01', 'PA02', 'SP01', 'SP02', 'CP01', 'CP02', 'PF01', 'PF02'] },
    ],
  },
  NS_STAGE,
  LIB_STAGE,
];

// Giáo trình CCNP dạng HTML, nằm ngoài repo như giáo trình CCNA. Hai bản nháp lệnh chưa chạy thử nên phải ghi rõ trên nút.
export const CCNP_DOCS = [
  { label: '📘 ENCOR 350-401', path: '../CCNP/CCNP-ENCOR-Giao-trinh.html' },
  { label: '📘 ENARSI 300-410', path: '../CCNP/CCNP-ENARSI-Giao-trinh.html' },
  { label: '📘 ENSLD 300-420', path: '../CCNP/CCNP-ENSLD-Giao-trinh.html' },
  { label: '📘 ENAUTO 300-435', path: '../CCNP/CCNP-ENAUTO-Giao-trinh.html' },
  { label: '📘 ENSDWI 300-415', path: '../CCNP/CCNP-ENSDWI-Giao-trinh.html' },
  { label: '📘 ENCC 300-440', path: '../CCNP/CCNP-ENCC-Giao-trinh.html' },
  { label: '📘 ENNA 300-445', path: '../CCNP/CCNP-ENNA-Giao-trinh.html' },
  { label: '📘 WLCOR 350-101', path: '../CCNP/CCNP-WLCOR-Giao-trinh.html' },
  { label: '📘 WLSD 300-110', path: '../CCNP/CCNP-WLSD-Giao-trinh.html' },
  { label: '📘 WLSI 300-120', path: '../CCNP/CCNP-WLSI-Giao-trinh.html' },
  { label: '📘 SCOR 350-701', path: '../CCNP/CCNP-SCOR-Giao-trinh.html' },
  { label: '📘 DCCOR 350-601', path: '../CCNP/CCNP-DCCOR-Giao-trinh.html' },
  { label: '📘 SPCOR 350-501', path: '../CCNP/CCNP-SPCOR-Giao-trinh.html' },
  { label: '📘 CLCOR 350-801', path: '../CCNP/CCNP-CLCOR-Giao-trinh.html' },
  { label: '📝 CCNP Enterprise (bản nháp)', path: '../CCNP/CCNP-Enterprise-Giao-trinh.html' },
  { label: '📝 CCNP Advanced Routing (bản nháp)', path: '../CCNP/CCNP-Advanced-Routing-Giao-trinh.html' },
];

export const topicKey = (t) => `${t.ref}:${t.title}`;
/** Kịch bản đạt khi quiz đúng từ 60% số câu; kịch bản không có quiz thì không tính. */
export const scenarioDone = (id, st) => { const n = st.quizSize[id]; return !!n && (st.quizBest[id] || 0) >= Math.ceil(n * 0.6); };

/** Việc bắt buộc của một chủ đề: phần lý thuyết (tích tay), quiz kịch bản, lab core. */
export function topicItems(t, st) {
  return [
    { kind: 'read', done: !!st.read[topicKey(t)] },
    ...t.sc.map((id) => ({ kind: 'sc', id, done: scenarioDone(id, st) })),
    ...t.core.map((id) => ({ kind: 'lab', id, done: !!st.labsDone[id] })),
  ];
}
export function topicProgress(t, st) {
  const items = topicItems(t, st), done = items.filter((x) => x.done).length;
  return { done, total: items.length, complete: done === items.length };
}
/** Tiến độ cả lộ trình (bỏ phần tuỳ chọn) và chủ đề nên học tiếp. */
export function roadmapProgress(st) {
  let done = 0, total = 0, next = null;
  for (const stage of ROADMAP) {
    if (stage.optional) continue;
    for (const t of stage.topics) {
      const p = topicProgress(t, st);
      done += p.done; total += p.total;
      if (!next && !p.complete) next = { stage, topic: t };
    }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, next };
}
