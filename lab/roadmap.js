// lab/roadmap.js — lộ trình học theo đề cương "200-301 CCNA v2.0" (Exam Topics, © Cisco; chỉ dùng số mục và tên chủ đề).
// Mỗi chủ đề gom: bài đọc (số bài giáo trình), kịch bản xem gói tin, lab bắt buộc (core) và lab thêm (more).
// `notes` là bài đọc ngắn cho chủ đề chưa có trong giáo trình.
// `gap` ghi rõ phần đề cương app chưa có thực hành, để người học không tưởng đã học đủ.
// tests/roadmap.test.js bắt buộc mọi lab và kịch bản đều có chỗ trong lộ trình.

export const ROADMAP = [
  {
    id: 'infra', name: 'Hạ tầng & kết nối mạng', weight: 25,
    topics: [
      { ref: 'Mở đầu', title: 'Gói tin đi trong mạng như thế nào', lessons: [1, 2], sc: ['s01', 's14'], core: ['A01'], more: ['A25', 'A03', 'A04'] },
      { ref: '1.1', title: 'Cáp và lỗi interface', lessons: [3, 4], sc: [], core: ['C01', 'N10', 'N19'], more: [] },
      { ref: '1.2', title: 'Hypervisor, máy ảo, container', lessons: [], sc: [], core: ['N12'], more: [], notes: [
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
      { ref: '2.2.b', title: 'Nối AP và WLC vào switch', lessons: [25], sc: [], core: ['W01', 'W02'], more: [] },
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
      { ref: '3.4', title: 'Đọc trạng thái HSRP và VRRP', lessons: [21], sc: ['s13'], core: ['L19', 'A22'], more: ['A23', 'T03'] },
    ],
  },
  {
    id: 'services', name: 'Dịch vụ mạng & bảo mật', weight: 20,
    topics: [
      { ref: '4.1', title: 'Tài khoản local và AAA', lessons: [27], sc: [], core: ['S04', 'N17'], more: [] },
      { ref: '4.2', title: 'Quản lý file cấu hình và IOS', lessons: [], sc: [], core: ['B10', 'N18'], more: ['N08'] },
      { ref: '4.3', title: 'NAT và PAT', lessons: [20], sc: ['s11'], core: ['L17', 'L18'], more: ['A19', 'A20', 'A21'] },
      { ref: '4.4', title: 'Bản ghi DNS', lessons: [], sc: ['s10'], core: ['N09'], more: [] },
      { ref: '4.5', title: 'VPN IPsec', lessons: [22], sc: [], core: ['C05'], more: ['D03'] },
      { ref: '4.6', title: 'ACL IPv4', lessons: [16, 17], sc: ['s12'], core: ['L13', 'L14', 'A10'], more: ['A08', 'N06'] },
      { ref: '4.7', title: 'Bảo mật Layer 2', lessons: [26], sc: [], core: ['L20', 'S01', 'S02', 'N15', 'N16'], more: ['B07', 'S03', 'S05', 'S06'] },
    ],
  },
  {
    id: 'operations', name: 'AI & vận hành mạng', weight: 10,
    topics: [
      { ref: '5.1–5.2', title: 'Agentic AI và cách viết prompt cho vận hành', lessons: [], sc: [], core: ['N13'], more: [], notes: [
        'AI tạo sinh trả lời theo prompt. AI agent đi xa hơn: tự chia việc, gọi công cụ như lệnh show hay API, xem kết quả rồi làm bước tiếp theo. Đề thi có thể yêu cầu đánh giá đề xuất của agent và trợ lý mạng.',
        'Bốn thành phần prompt trong đề cương: phân loại dữ liệu (dữ liệu nào được phép gửi), định dạng kết quả, persona (đóng vai ai) và chỉ dẫn (việc cần làm).',
        'Ví dụ: "Bạn là kỹ sư mạng (persona). Dữ liệu nội bộ, đã che IP công khai (phân loại dữ liệu): <output show interfaces>. Liệt kê nguyên nhân khả dĩ và lệnh kiểm chứng, chưa đổi cấu hình (chỉ dẫn). Trả lời dạng bảng (định dạng)."',
        'AI có thể trả lời sai mà vẫn rất tự tin, nên phải kiểm chứng bằng show, ping hoặc tài liệu hãng trước khi áp dụng.',
        'Không dán mật khẩu, community SNMP, khoá VPN hay dữ liệu khách hàng vào công cụ AI chưa được công ty duyệt.',
        'Cho agent quyền tối thiểu, bắt đầu với quyền chỉ đọc. Thay đổi cấu hình cần người duyệt, có log và có cách hoàn tác.',
      ] },
      { ref: '5.3', title: 'Các cách quản lý mạng: controller, cloud, IaC', lessons: [29], sc: [], core: ['N22'], more: [], notes: [
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
      { ref: 'Dự án', title: 'Dựng mạng doanh nghiệp hoàn chỉnh', lessons: [], sc: [], core: ['P01', 'X01'], more: ['X04'] },
    ],
  },
  {
    id: 'encor', name: 'CCNP ENCOR 350-401 v1.2 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      { ref: '1.1', title: 'Thiết kế mạng doanh nghiệp, HA, FHRP, SSO', lessons: [], sc: [], core: [], more: [], notes: [
        'Ba lớp access, distribution, core để mở rộng; collapsed core gộp hai lớp trên cho site nhỏ. Leaf-spine dùng cho trung tâm dữ liệu: mọi leaf cách nhau đúng hai chặng.',
        'On-premises chủ động về dữ liệu nhưng tự gánh phần cứng. Cloud trả theo mức dùng, co giãn nhanh nhưng phụ thuộc đường truyền. Hybrid là phổ biến nhất.',
        'Sẵn sàng cao trên switch: StackWise gộp nhiều switch thành một, SSO giữ trạng thái khi supervisor chuyển đổi, NSF giữ chuyển tiếp trong lúc control plane khởi động lại.',
      ] },
      { ref: '1.2', title: 'SD-WAN: vBond, vSmart, vManage, OMP', lessons: [], sc: ['s37'], core: [], more: [] },
      { ref: '1.3', title: 'SD-Access: fabric, LISP, VXLAN, SGT', lessons: [], sc: ['s36'], core: [], more: [] },
      { ref: '1.4, 3.3', title: 'QoS, NTP, NAT, FHRP', lessons: [], sc: [], core: [], more: ['E11'] },
      { ref: '2.1', title: 'Ảo hoá thiết bị: VM, switch ảo, container', lessons: [], sc: [], core: [], more: [], notes: [
        'Hypervisor type 1 chạy trực tiếp trên phần cứng (ESXi, KVM, Hyper-V), type 2 chạy trên một hệ điều hành khác (VirtualBox).',
        'Switch ảo (vSwitch, OVS) nối VM trong cùng máy, hoạt động giống switch L2 và có thể chạy VLAN, trunk tới switch thật.',
        'Container dùng chung kernel, nhẹ và khởi động nhanh hơn VM. Trên Catalyst có thể chạy ứng dụng container qua IOx.',
      ] },
      { ref: '2.3', title: 'LISP và VXLAN', lessons: [], sc: ['s35', 's30'], core: [], more: [] },
      { ref: '2.2', title: 'VRF, GRE, IPsec', lessons: [], sc: [], core: [], more: ['E01'] },
      { ref: '3.1', title: 'RSTP, MST, Root Guard, BPDU Guard', lessons: [], sc: [], core: [], more: ['E03'] },
      { ref: '3.2', title: 'OSPF nhiều vùng, tóm tắt, lọc; so với EIGRP', lessons: [], sc: [], core: [], more: ['E02'], notes: [
        'EIGRP là distance vector nâng cao: tính bằng DUAL, có đường dự phòng feasible successor nên hội tụ ngay, cân bằng tải không đều bằng variance.',
        'OSPF là link-state: mọi router trong vùng có cùng bản đồ và chạy SPF, cân bằng tải chỉ khi chi phí bằng nhau, chia vùng để giới hạn phạm vi cập nhật.',
      ] },
      { ref: '3.3', title: 'Multicast: RPF, PIM SM, IGMP, SSM, BIDIR, MSDP', lessons: [], sc: ['s33'], core: [], more: [] },
      { ref: '3.3', title: 'PTP', lessons: [], sc: [], core: [], more: [], notes: [
        'PTP (IEEE 1588) đồng bộ tới mức dưới micro giây nhờ phần cứng đóng dấu thời gian. NTP thường chỉ đạt mức mili giây.',
        'Grandmaster là nguồn gốc. Boundary clock nhận thời gian rồi phát lại ở từng chặng, transparent clock ghi thêm thời gian gói nằm trong switch.',
      ] },
      { ref: '4.2, 4.3, 4.4', title: 'NetFlow, SPAN, IP SLA', lessons: [], sc: [], core: [], more: ['E04', 'E05', 'E06'] },
      { ref: '4.5', title: 'Catalyst Center: quản lý, assurance, AI', lessons: [], sc: [], core: [], more: [], notes: [
        'Khác cách quản lý truyền thống: thiết kế và chính sách đặt tập trung, thiết bị nhận cấu hình tự động thay vì gõ CLI từng máy.',
        'Workflow gồm Design, Policy, Provision, Assurance. Plug and Play đưa thiết bị mới vào mạng không cần gõ tay.',
        'Assurance gom telemetry, chấm điểm sức khoẻ thiết bị, máy khách, ứng dụng. AI giúp phát hiện bất thường theo so sánh với mức nền, và gợi ý cách xử lý.',
      ] },
      { ref: '4.6, 6.2, 6.3, 6.5', title: 'NETCONF, RESTCONF, YANG, JSON', lessons: [], sc: [], core: [], more: ['E07'], notes: [
        'YANG là mô hình dữ liệu: mô tả cấu trúc cấu hình và trạng thái. NETCONF (SSH 830, XML) và RESTCONF (HTTPS, JSON hoặc XML) là cách truyền dữ liệu theo mô hình đó.',
        'NETCONF có các kho running, candidate, startup và thao tác khoá, xác nhận. RESTCONF ánh xạ CRUD sang GET, POST, PUT, PATCH, DELETE.',
      ] },
      { ref: '5.3', title: 'Bảo mật REST API', lessons: [], sc: [], core: [], more: [], notes: [
        'Luôn dùng HTTPS và kiểm tra chứng chỉ. Cờ -k của curl chỉ dùng trong lab.',
        'Xác thực bằng token có hạn dùng thay vì gửi mật khẩu mỗi lần. Không ghi token vào mã nguồn, dùng biến môi trường hoặc kho bí mật.',
        'Cấp quyền tối thiểu, giới hạn số yêu cầu, kiểm tra dữ liệu đầu vào và ghi log các lần truy cập.',
      ] },
      { ref: '5.4', title: 'Thiết kế bảo mật: TrustSec, MACsec, 802.1X (SGT: xem kịch bản SD-Access)', lessons: [], sc: [], core: [], more: [], notes: [
        'Threat defense gồm nhiều lớp: NGFW và IPS, phòng chống mã độc, phân tích lưu lượng. Endpoint security bảo vệ từng máy.',
        'TrustSec gán SGT theo danh tính, thực thi bằng SGACL, truyền nhãn inline hoặc qua SXP. MACsec (802.1AE) mã hoá từng đoạn cáp ở lớp 2, khoá trao đổi bằng MKA.',
      ] },
      { ref: '5.1, 5.2', title: 'AAA, CoPP', lessons: [], sc: [], core: [], more: ['E08', 'E09'] },
      { ref: '6.1, 6.4', title: 'Python và API', lessons: [], sc: [], core: [], more: [], notes: [
        'Đọc được mã: requests.get(url, auth=(u, p), verify=True), r.json()["items"], vòng for, if, hàm. Thi yêu cầu hiểu kết quả của đoạn mã ngắn, không phải viết chương trình lớn.',
        'Mã HTTP cần nhớ: 200, 201, 204 thành công; 400 sai yêu cầu; 401 chưa xác thực; 403 không có quyền; 404 không thấy; 500 lỗi phía máy chủ.',
        'Catalyst Center và SD-WAN Manager đều có REST API: lấy token trước rồi gửi kèm header ở các lần gọi sau.',
      ] },
      { ref: '6.6', title: 'EEM', lessons: [], sc: [], core: [], more: ['E10'] },
    ],
  },
  {
    id: 'enarsi', name: 'CCNP ENARSI 300-410 v1.1 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      { ref: '1.1–1.6', title: 'AD, route-map, chống lặp, redistribution, tóm tắt, PBR', lessons: [], sc: [], core: [], more: ['R13', 'R01', 'R02'] },
      { ref: '1.8', title: 'BFD', lessons: [], sc: ['s39'], core: [], more: [] },
      { ref: '1.9', title: 'EIGRP classic và named, xác thực, stub, variance', lessons: [], sc: [], core: [], more: ['R05', 'R06'] },
      { ref: '1.10', title: 'OSPF: loại area, virtual link, xác thực', lessons: [], sc: [], core: [], more: ['R03', 'R04'] },
      { ref: '1.11', title: 'BGP: chọn đường, RR, peer group, multihop', lessons: [], sc: [], core: [], more: ['R07', 'R08'] },
      { ref: '2.1, 2.2', title: 'MPLS, LDP, L3VPN', lessons: [], sc: ['s29', 's34'], core: [], more: [] },
      { ref: '2.3', title: 'DMVPN một hub', lessons: [], sc: ['s38'], core: [], more: ['R09'] },
      { ref: '3.2', title: 'uRPF, ACL theo giờ', lessons: [], sc: [], core: [], more: ['R10'] },
      { ref: '3.4', title: 'Bảo mật IPv6 lớp truy cập', lessons: [], sc: [], core: [], more: [], notes: [
        'RA Guard chặn RA giả từ cổng máy trạm. DHCPv6 Guard chặn máy chủ DHCPv6 giả.',
        'Binding table ghi cặp IPv6, MAC, cổng, nhờ ND Inspection và Source Guard kiểm tra được gói giả.',
        'Lỗi hay gặp: bật RA Guard mà không đặt cổng nối router là device-role router, nên máy trạm mất default gateway.',
      ] },
      { ref: '4.3, 4.4, 1.8', title: 'Debug có điều kiện, DHCPv6, BFD', lessons: [], sc: [], core: [], more: ['R11', 'R12'] },
      { ref: '4.7', title: 'Catalyst Center Assurance', lessons: [], sc: [], core: [], more: [], notes: [
        'Dashboard theo sức khoẻ: Network, Client, Application. Bấm vào một máy khách để xem cả quá trình kết nối theo thời gian.',
        'Path Trace vẽ đường đi giữa hai điểm và chỉ ra chỗ ACL chặn. Issue đưa sẵn nguyên nhân có thể và bước xử lý gợi ý.',
      ] },
    ],
  },
  {
    id: 'beyond', name: 'Sau CCNA v2.0 (không tính tiến độ)', weight: 0, optional: true,
    topics: [
      { ref: 'CCNP', title: 'OSPF nhiều vùng, EIGRP, BGP, redistribution', lessons: [15], sc: ['s18', 's08', 's17', 's21'], core: [], more: ['L12', 'D04', 'X03'] },
      { ref: 'CCNP', title: 'VTP, DTP nâng cao, Private VLAN, MST', lessons: [], sc: ['s24'], core: [], more: ['A11', 'D01', 'A26', 'D02'] },
      { ref: 'WAN', title: 'Serial, PPP, GRE', lessons: [], sc: [], core: [], more: ['C02', 'X02'] },
      { ref: 'QoS', title: 'Đánh dấu và xếp hàng', lessons: [], sc: ['s20', 's25'], core: [], more: [] },
      { ref: 'SP/DC', title: 'MPLS, Segment Routing, VXLAN và EVPN', lessons: [], sc: ['s31', 's32'], core: [], more: [] },
      { ref: 'Firewall', title: 'Firewall nhiều hãng', lessons: [28], sc: [], core: [], more: ['F01', 'F02', 'F03', 'F04', 'Z01', 'Z02', 'Z03', 'FG01', 'FG02', 'PA01', 'PA02', 'SP01', 'SP02', 'CP01', 'CP02', 'PF01', 'PF02'] },
    ],
  },
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
