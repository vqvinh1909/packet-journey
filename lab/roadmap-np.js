// lab/roadmap-np.js — các đề chuyên sâu sau ENCOR, theo exam topics trên Learning Network của Cisco (chỉ dùng số mục và tên chủ đề, nội dung tự viết).
// Các nền tảng này (SD-WAN Manager, ThousandEyes, ISE, cloud, FTD, NX-OS, ACI, UCS, IOS XR, CUCM, Webex) không mô phỏng được trong Lab nên chủ yếu là bài đọc, có chỉ tới lab liên quan.
// Nguồn WLCOR v1.0, WLSD v1.2, SCOR v2.0, DCCOR v1.2, SPCOR v1.1, CLCOR v2.0, xem ngày 2026-11-01: learningnetwork.cisco.com/s/wlcor-exam-topics, wlsd-exam-topics, scor-v2-exam-topics, dccor-exam-topics, spcor-exam-topics, clcor-exam-topics.
// Nguồn ENSLD v1.1, xem ngày 2026-11-02: learningnetwork.cisco.com/s/ensld-exam-topics. Bài đầy đủ ở CCNP/Module-03_ENSLD.
// Nguồn ENAUTO v2.0, xem ngày 2026-11-02: learningnetwork.cisco.com/s/enauto-exam-topics. Bài đầy đủ ở CCNP/Module-04_ENAUTO.
// Nguồn ENSDWI v1.2, xem ngày 2026-11-02: learningnetwork.cisco.com/s/ensdwi-exam-topics. Bài đầy đủ ở CCNP/Module-05_ENSDWI.
// Nguồn ENCC v1.0, xem ngày 2026-11-03: learningnetwork.cisco.com/s/encc-exam-topics. Bài đầy đủ ở CCNP/Module-06_ENCC.
// Nguồn ENNA v1.0, xem ngày 2026-11-03: learningnetwork.cisco.com/s/enna-exam-topics. Bài đầy đủ ở CCNP/Module-07_ENNA.
// Nguồn WLCOR v1.0, xem lại ngày 2026-11-03. Bài đầy đủ ở CCNP/Module-08_WLCOR.
// Nguồn WLSD v1.2, xem lại ngày 2026-11-03. Bài đầy đủ ở CCNP/Module-09_WLSD.
// Nguồn WLSI v1.2, xem lại ngày 2026-11-03. Bài đầy đủ ở CCNP/Module-10_WLSI.
// Nguồn SCOR v2.0, xem lại ngày 2026-11-03: learningnetwork.cisco.com/s/scor-v2-exam-topics. Bài đầy đủ ở CCNP/Module-11_SCOR.
// Nguồn DCCOR v1.2, xem lại ngày 2026-11-03: learningnetwork.cisco.com/s/dccor-exam-topics. Bài đầy đủ ở CCNP/Module-12_DCCOR.
// Nguồn SPCOR v1.1, xem lại ngày 2026-11-03: learningnetwork.cisco.com/s/spcor-exam-topics. Bài đầy đủ ở CCNP/Module-13_SPCOR.
// Nguồn CLCOR v2.0, xem lại ngày 2026-11-04: learningnetwork.cisco.com/s/clcor-exam-topics. Bài đầy đủ ở CCNP/Module-14_CLCOR.
// Danh sách đề chọn lấy từ learningnetwork.cisco.com/s/ccnp-security, ccnp-data-center, ccnp-service-provider, ccnp-collaboration.

const T = (ref, title, notes, more = [], sc = [], docs) => ({ ref, title, lessons: [], docs, sc, core: [], more, notes });
const ENSLD = ['Ke-hoach-dia-chi', 'Thiet-ke-IS-IS', 'Thiet-ke-EIGRP', 'Thiet-ke-OSPF', 'Thiet-ke-BGP', 'Chuyen-doi-IPv6', 'Campus-HA', 'Campus-Layer-2', 'Campus-Layer-3', 'Thiet-ke-SD-Access', 'Lua-chon-WAN', 'VPN-site-to-site', 'WAN-HA', 'Thiet-ke-SD-WAN', 'Thiet-ke-QoS', 'Mang-quan-ly', 'Thiet-ke-Multicast', 'YANG-NETCONF-RESTCONF', 'Telemetry-gRPC-gNMI', 'Ket-noi-Cloud'];
const D = (...ns) => ns.map((n) => ({ label: `Bài ${n} ENSLD`, path: `../CCNP/Module-03_ENSLD/Bai-${String(n).padStart(2, '0')}_${ENSLD[n - 1]}.md` }));
const ENAUTO = ['Mo-hinh-YANG-va-giao-thuc', 'Doc-cay-YANG-dung-payload', 'Python-Netmiko', 'Python-ncclient', 'Python-RESTCONF', 'Ansible-thiet-bi', 'Day0-thiet-bi', 'Xu-ly-loi-NETCONF-RESTCONF', 'EEM-Guest-Shell', 'Day0-controller', 'Python-controller', 'Jinja2', 'Ansible-controller', 'Tu-dong-hoa-bao-mat', 'Xu-ly-loi-REST-API', 'API-kiem-thu', 'Mo-phong-topo', 'Quan-ly-phan-mem', 'Giam-sat-suc-khoe', 'Telemetry-IOS-XE', 'Webhook', 'AI-trong-controller', 'Rui-ro-AI', 'MCP-server'];
const DA = (...ns) => ns.map((n) => ({ label: `Bài ${n} ENAUTO`, path: `../CCNP/Module-04_ENAUTO/Bai-${String(n).padStart(2, '0')}_${ENAUTO[n - 1]}.md` }));
const ENSDWI = ['Kien-truc-Catalyst-SD-WAN', 'Thiet-bi-WAN-Edge', 'Cloud-OnRamp', 'Trien-khai-controller', 'Chung-chi-va-danh-sach-thiet-bi', 'Loi-control-plane', 'Trien-khai-WAN-Edge', 'Data-plane-SD-WAN', 'OMP-va-TLOC', 'Template-feature', 'Multicast-SD-WAN', 'Configuration-group', 'Control-policy', 'Data-policy', 'Phan-doan-VPN', 'Application-aware-routing', 'Direct-Internet-Access', 'Service-insertion', 'Bao-mat-SD-WAN', 'Bao-mat-cloud', 'QoS-SD-WAN', 'AppQoE', 'Xac-thuc-giam-sat', 'REST-API-va-nang-cap'];
const DW = (...ns) => ns.map((n) => ({ label: `Bài ${n} ENSDWI`, path: `../CCNP/Module-05_ENSDWI/Bai-${String(n).padStart(2, '0')}_${ENSDWI[n - 1]}.md` }));
const ENCC = ['Internet-toi-cloud', 'Ket-noi-rieng-toi-cloud', 'Ket-noi-SaaS', 'Chon-ket-noi-theo-do-san-sang', 'Chon-ket-noi-theo-kien-truc', 'Tuan-thu-quy-dinh', 'Chinh-sach-bao-mat-cloud', 'IPsec-IOS-XE-toi-AWS', 'IPsec-IOS-XE-toi-Azure', 'IPsec-IOS-XE-toi-Google-Cloud', 'GRE-IPsec-va-SIG', 'IPsec-toi-router-tren-cloud', 'BGP-OSPF-voi-cloud', 'SD-WAN-toi-cloud', 'SD-WAN-toi-SIG', 'OnRamp-SaaS', 'Chinh-sach-SD-WAN-cloud', 'Chan-doan-IPsec', 'Chan-doan-dinh-tuyen-cloud', 'Chan-doan-SD-WAN-cloud', 'Chan-doan-chinh-sach-SD-WAN'];
const DC = (...ns) => ns.map((n) => ({ label: `Bài ${n} ENCC`, path: `../CCNP/Module-06_ENCC/Bai-${String(n).padStart(2, '0')}_${ENCC[n - 1]}.md` }));
const ENNA = ['Cac-loai-agent', 'Vi-tri-dat-agent', 'Giam-sat-chu-dong-bi-dong', 'WAN-Insights', 'Tich-hop-nen-tang', 'Muc-nen-va-xuat-du-lieu', 'Chon-nen-tang', 'Enterprise-Agent', 'Endpoint-Agent-hang-loat', 'Test-mang-va-DNS', 'Test-thoai-va-web', 'Test-Endpoint-Agent', 'Synthetic-web-test', 'Xac-thuc-web-test', 'Chan-doan-mang', 'Chan-doan-may-nguoi-dung', 'Chan-doan-web-waterfall', 'Su-co-bao-mat', 'Canh-bao-mang', 'Canh-bao-nguoi-dung', 'Bao-cao-theo-nguoi-doc', 'Kiem-thu-canh-bao', 'Ke-hoach-dung-luong'];
const DN = (...ns) => ns.map((n) => ({ label: `Bài ${n} ENNA`, path: `../CCNP/Module-07_ENNA/Bai-${String(n).padStart(2, '0')}_${ENNA[n - 1]}.md` }));
const WLCOR = ['Lan-truyen-song', 'Do-tin-hieu-RF', 'Toan-RF', 'Ang-ten', 'Quy-dinh-Wi-Fi', 'Kenh-cong-suat-RRM', 'Dieu-che-va-do-rong-kenh', 'MIMO-MU-MIMO-MLO', 'Topology-va-loai-khung', 'Kien-truc-khong-day', 'Dau-noi-ha-tang', 'Truy-cap-quan-tri', 'Cai-dat-ban-dau', 'AP-join', 'Che-do-AP', 'Cau-hinh-WLAN', 'Quy-tac-may-khach', 'Xac-thuc-ngoai-WLC', 'Xac-thuc-tren-WLC', 'Ket-noi-theo-he-dieu-hanh', 'Roaming', 'Mang-khach', 'Bao-tri-mang-khong-day', 'Giam-sat-may-khach', 'Chan-doan-may-khach', 'Tich-hop-nen-tang', 'Python-cho-khong-day', 'NETCONF-YANG-khong-day', 'API-ha-tang-khong-day', 'AI-Analytics-va-Operations', 'AI-RRM'];
const DWL = (...ns) => ns.map((n) => ({ label: `Bài ${n} WLCOR`, path: `../CCNP/Module-08_WLCOR/Bai-${String(n).padStart(2, '0')}_${WLCOR[n - 1]}.md` }));
const WLSD = ['Yeu-cau-thiet-ke', 'Loai-trien-khai-va-bao-mat', 'Suy-hao-vat-lieu', 'Khao-sat-Layer-1', 'Khao-sat-truoc-trien-khai', 'Khao-sat-sau-trien-khai', 'Khao-sat-du-doan', 'Cong-cu-va-chi-so', 'Ha-tang-vat-ly', 'Ha-tang-logic-va-giay-phep', 'Thiet-ke-RRM', 'RF-profile', 'RxSOP', 'Thiet-ke-cho-du-lieu', 'Thoai-va-video', 'Dinh-vi-va-Cisco-Spaces', 'Mat-do-cao', 'Che-do-mesh', 'Ethernet-bridging', 'WGB-va-roaming', 'Mobility-group', 'Toi-uu-roaming', 'Kiem-tra-ham-mobility', 'Site-tag', 'LAG-cho-WLC', 'SSO', 'Du-phong-WLC-va-anchor', 'AP-priority-va-fallback', 'EWC'];
const DWS = (...ns) => ns.map((n) => ({ label: `Bài ${n} WLSD`, path: `../CCNP/Module-09_WLSD/Bai-${String(n).padStart(2, '0')}_${WLSD[n - 1]}.md` }));
const WLSI = ['FlexConnect-co-ban', 'Nhom-FlexConnect-va-roaming', 'Split-tunnel-va-chiu-loi', 'VLAN-central-va-Flex-ACL', 'Nang-cap-AP-hieu-qua', 'OfficeExtend', 'QoS-tu-co-day-sang-khong-day', 'QoS-cho-may-khach', 'AVC', 'Thanh-phan-multicast', 'Multicast-tren-WLAN', 'mDNS', 'Multicast-Direct', 'CMX-va-Cisco-Spaces', 'Theo-doi-may-va-RFID', 'Dinh-vi-nguon-nhieu-va-rogue', 'Phat-hien-va-phan-tich', 'Captive-portal-va-connector', 'Dich-vu-khach-theo-vi-tri', 'Sua-loi-do-chinh-xac', 'HA-cho-CMX-va-Connector', 'wIPS', 'Profiling', 'CWA', 'LWA', 'BYOD-va-chung-chi', 'Bao-mat-theo-kien-truc', 'Mang-theo-danh-tinh', 'Bao-cao-Catalyst-Center', 'Canh-bao-va-rogue', 'Quan-ly-nguon-nhieu', 'Chan-doan-ket-noi-may', 'Truy-cap-thiet-bi', 'Xac-thuc-AP', 'ACL-mat-phang-dieu-khien'];
const DWI = (...ns) => ns.map((n) => ({ label: `Bài ${n} WLSI`, path: `../CCNP/Module-10_WLSI/Bai-${String(n).padStart(2, '0')}_${WLSI[n - 1]}.md` }));
const SCOR = ['Moi-de-doa', 'Lo-hong-va-CVSS', 'Lo-hong-AI-LLM', 'Chong-phishing', 'Mat-ma', 'Cac-kieu-VPN', 'Threat-intelligence', 'Zero-trust-va-SAFE', 'Doc-script-API', 'Firewall-va-IPS', 'Giam-sat-va-telemetry', 'Bao-mat-ha-tang-L2', 'Cach-quan-tri-bao-mat', 'CIS-Benchmarks', 'Xu-ly-loi-AAA', 'Quan-tri-an-toan', 'Chinh-sach-FTD', 'VPN-tren-FTD', 'Chan-doan-VPN-FTD', 'Trach-nhiem-va-mo-hinh-cloud', 'Chon-bao-ve-cloud', 'Multicloud-Defense-va-Secure-Workload', 'Splunk-nhan-log-cloud', 'eBPF-va-workload', 'DevSecOps', 'SSE-va-SASE', 'Secure-Internet-Access', 'Secure-Private-Access', 'DLP-va-AI-guardrails', 'Diem-Investigate', 'EPP-va-EDR', 'MDM-va-tai-san', 'Posture-may-tram', 'Secure-Client-va-Malware-Analytics', 'Secure-Endpoint', 'Doc-su-kien-Secure-Endpoint', 'Email-Threat-Defense', 'Danh-tinh-va-tuan-thu', 'Dot1X-va-MAB', 'Thay-doi-quyen-CoA', 'Ro-ri-du-lieu', 'XDR-va-SIEM', 'Duo-zero-trust', 'Splunk-SOAR'];
const DSC = (...ns) => ns.map((n) => ({ label: `Bài ${n} SCOR`, path: `../CCNP/Module-11_SCOR/Bai-${String(n).padStart(2, '0')}_${SCOR[n - 1]}.md` }));
const DCCOR = ['OSPF-tren-NX-OS', 'MP-BGP-tren-NX-OS', 'PIM-tren-NX-OS', 'FHRP-tren-NX-OS', 'RSTP-va-LACP', 'vPC', 'VXLAN-EVPN', 'ACI-dung-fabric', 'ACI-access-policies', 'ACI-VMM', 'Luong-goi-tin', 'Dich-vu-cloud-NIST', 'Cap-nhat-NX-OS', 'Quan-ly-cau-hinh-NX-OS', 'Giam-sat-NetFlow-SPAN', 'Streaming-telemetry', 'Nexus-Dashboard', 'UCS-C-Series', 'UCS-B-Series-khoi-tao', 'UCS-mang-va-template', 'UCS-SAN', 'UCS-server-pool-boot', 'UCS-X-Intersight', 'Firmware-UCS', 'Sao-luu-UCS', 'Giam-sat-UCS', 'FC-khoi-tao-fabric', 'VSAN-va-port-channel-FC', 'Zoning', 'FCNS-device-alias-CFS', 'NPV-va-NPIV', 'NFS-va-iSCSI', 'Cap-nhat-SAN', 'Giam-sat-SAN', 'EEM-va-scheduler', 'Bash-Guest-Shell-Python', 'NX-API', 'Ansible-va-Terraform', 'POAP-va-NDFC', 'Python-PowerShell-Intersight', 'Mang-cho-AI', 'AAA-RBAC-trung-tam-du-lieu', 'ACI-contract', 'First-hop-security-NX-OS', 'Keychain-va-MACsec', 'Port-security-fabric-binding'];
const DDC = (...ns) => ns.map((n) => ({ label: `Bài ${n} DCCOR`, path: `../CCNP/Module-12_DCCOR/Bai-${String(n).padStart(2, '0')}_${DCCOR[n - 1]}.md` }));
const SPCOR = ['Kien-truc-loi-nha-mang', 'Truy-cap-va-quang', 'Mang-di-dong-5G', 'IOS-XE-va-IOS-XR', 'Ao-hoa-NFV', 'DiffServ-IntServ', 'QoS-MPLS-va-TE', 'LPTS-va-CoPP', 'Bao-ve-phien-BGP-LDP', 'BGPsec-va-Flowspec', 'Mat-phang-quan-ly', 'uRPF-va-ACL-bien', 'RTBH-va-MACsec', 'IS-IS-dia-chi-va-quang-ba', 'IS-IS-multitopology-metric', 'OSPF-nha-mang', 'Chon-duong-BGP', 'BGP-lang-gieng-address-family', 'BGP-Add-Path-va-PIC', 'RPL-va-route-map', 'Chan-doan-IGP-BGP', 'Chuyen-doi-IPv4-IPv6-nha-mang', 'NSF-va-NSR', 'BFD-va-Bundle', 'LDP-sync-va-session-protection', 'Unified-MPLS-va-OAM', 'TE-IGP-va-RSVP', 'FRR-TE', 'SR-segment-va-control-plane', 'SR-TE-va-PCE', 'TI-LFA', 'Flex-Algo', 'SRv6', 'EVPN-nha-mang', 'Inter-AS-va-CSC', 'mVPN', 'Dich-vu-Ethernet-MEF', 'QinQ-PBB-G8032-OAM', 'L3VPN-intra-AS', 'L3VPN-shared-services', 'Multicast-nha-mang', 'QoS-dich-vu', 'API-va-script-REST', 'NSO', 'YANG-Ansible-Terraform', 'Secure-ZTP', 'gRPC-gNMI-mTLS', 'NetFlow-IPFIX-nha-mang', 'NETCONF-RESTCONF-SNMP'];
const DSP = (...ns) => ns.map((n) => ({ label: `Bài ${n} SPCOR`, path: `../CCNP/Module-13_SPCOR/Bai-${String(n).padStart(2, '0')}_${SPCOR[n - 1]}.md` }));
const CLCOR = ['Thiet-ke-CSR-PA', 'Bang-thong-va-codec', 'HA-va-khoi-phuc', 'Ke-hoach-so-bao-mat-QoS-thiet-ke', 'Expressway-va-CUBE', 'Nang-cap-cum-CUCM', 'Chan-doan-SSO-va-OAuth', 'Chung-chi-TLS-SRTP', 'DNS-va-NTP-cho-collab', 'LDAP-DHCP-CDP-collab', 'Them-thiet-bi-dau-cuoi', 'Webex-App', 'SIP-thiet-lap-va-ket-thuc', 'SDP-va-SRTP', 'DTMF-RFC-4733', 'Giu-may-va-chuyen-cuoc-goi', 'Chan-doan-dang-ky', 'Quy-trinh-dinh-tuyen-CUCM', 'Chong-toll-fraud-CUCM', 'Route-pattern-va-E164', 'Translation-va-transformation', 'Local-route-group', 'Partition-CSS-va-time-of-day', 'FAC-va-urgent-priority', 'Cong-cu-giam-sat-dial-plan', 'API-UC-AXL-UDS', 'Unity-hop-thu-va-tich-hop', 'Call-handler-va-routing-rule', 'LDAP-sync-va-RBAC-CUCM', 'Dial-peer-VoIP-POTS', 'Voice-translation-rule', 'DTMF-va-codec-tren-CUBE', 'Du-phong-server-group-OPTIONS', 'Chan-doan-dial-plan-IOS-XE', 'Media-resources-IOS-XE', 'Webex-Suite', 'Dinh-tuyen-Webex-Calling', 'Chong-toll-fraud-Webex', 'Webex-Calling-location-va-so', 'Webex-Calling-trunk-va-dial-plan', 'Hop-va-tin-nhan-cloud', 'API-Webex-va-webhook', 'Quan-ly-nguoi-dung-cloud', 'Cloud-Connected-UC-va-Hybrid', 'Chan-doan-chat-luong-media', 'QoS-thoai-video-va-bien-tin-cay', 'LLQ-cho-thoai'];
const DCL = (...ns) => ns.map((n) => ({ label: `Bài ${n} CLCOR`, path: `../CCNP/Module-14_CLCOR/Bai-${String(n).padStart(2, '0')}_${CLCOR[n - 1]}.md` }));

export const NP_STAGES = [
  {
    id: 'enauto', name: 'CCNP ENAUTO 300-435 v2.0 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1–1.5', 'YANG, NETCONF, RESTCONF', [
        'Ba nhóm mô hình YANG: native của Cisco (đủ tính năng nhất), IETF (chuẩn, ít chi tiết), OpenConfig (nhiều hãng cùng dùng). Thực hành đọc lệnh RESTCONF ở lab E07.',
        'Đọc cây theo RFC 8340: rw là cấu hình, ro là trạng thái, ? là không bắt buộc, * là danh sách, [name] là khoá của danh sách. Sinh cây bằng: pyang -f tree file.yang.',
        'Từ cây dựng dữ liệu: container thành object JSON hoặc thẻ XML, list thành mảng JSON hoặc thẻ lặp. JSON của RESTCONF có tiền tố module, ví dụ ietf-interfaces:interface. YANG Suite dựng sẵn mẫu.',
        'RESTCONF dùng Content-Type application/yang-data+json. NETCONF bọc XML trong <rpc>, sửa bằng <edit-config>, đọc bằng <get-config>.',
      ], [], [], DA(1, 2)),
      T('2.1–2.3', 'Python: Netmiko, ncclient, requests', [
        'Netmiko chạy qua SSH và đọc văn bản: c = ConnectHandler(device_type="cisco_ios", host=ip, username=u, password=p); c.send_command("show version"); c.send_config_set(["vlan 10"]).',
        'ncclient chạy NETCONF: m = manager.connect(host=ip, port=830, username=u, password=p, hostkey_verify=False); m.get_config("running", filter=f); m.edit_config(target="running", config=xml).',
        'requests chạy RESTCONF: requests.put(url, auth=(u, p), headers=h, json=body). Kiểm tra r.status_code rồi mới đọc r.json().',
        'Ưu tiên API có cấu trúc khi thiết bị hỗ trợ. CLI qua SSH phải tự tách chuỗi nên dễ hỏng khi đổi phiên bản.',
      ], [], [], DA(3, 4, 5)),
      T('2.4, 3.4', 'Ansible cho thiết bị và controller', [
        'Thiết bị: cisco.ios.ios_config đẩy cấu hình, ios_command chạy show, ios_facts lấy thông tin. Thực hành ở lab N21, N22.',
        'Controller: dùng collection của Catalyst Center hoặc Meraki. Module gọi REST API từ máy điều khiển, không SSH vào từng thiết bị, nên play đặt connection: local hoặc httpapi.',
        'Dùng ansible-vault cho mật khẩu. Chạy thử bằng --check trước khi áp dụng.',
      ], [], [], DA(6, 13)),
      T('2.5, 3.1', 'Day 0: ZTP, PnP', [
        'ZTP trên IOS XE: thiết bị không có cấu hình xin DHCP, option 67 chỉ tới script Python rồi chạy trong Guest Shell.',
        'PnP: thiết bị tìm controller qua DHCP option 43, DNS hoặc cloud, rồi nhận cấu hình và image từ Catalyst Center.',
        'SD-WAN: đăng ký serial vào danh sách thiết bị, edge tự tìm Validator. Meraki: nhận thiết bị vào organization bằng serial, thiết bị tự gọi về cloud.',
      ], [], [], DA(7, 10)),
      T('2.6, 3.6', 'Xử lý lỗi API', [
        '400 sai dữ liệu, 401 thiếu hoặc hết token, 403 không đủ quyền, 404 sai đường dẫn YANG, 409 đối tượng đã có, 429 gọi quá nhanh nên đợi theo Retry-After.',
        'NETCONF báo lỗi trong <rpc-error>. Trên thiết bị: show netconf-yang sessions, show platform software yang-management process.',
        'Danh sách lớn được chia trang, chỉ đọc một trang thì thiếu dữ liệu. Token hết hạn thì lấy lại, không ghi cứng vào mã.',
      ], [], [], DA(8, 15)),
      T('2.7', 'Tự động hoá trên thiết bị: EEM, Guest Shell', [
        'Guest Shell là container Linux trên IOS XE: iox, rồi guestshell enable, rồi guestshell run python3 file.py.',
        'Trong đó gọi lệnh bằng: from cli import cli; cli("show version"). Kết hợp EEM để chạy script khi có sự kiện: lab E10.',
      ], [], [], DA(9)),
      T('3.2, 3.3', 'Python gọi controller, mẫu Jinja2', [
        'Catalyst Center: POST /dna/system/api/v1/auth/token lấy token, gửi kèm header X-Auth-Token. SD-WAN Manager: đăng nhập phiên rồi kèm X-XSRF-TOKEN. Meraki: khoá API trong header Authorization: Bearer.',
        'Jinja2: {% for v in vlans %}vlan {{ v.id }}{% endfor %} là vòng lặp, {% if v.voice %}...{% endif %} là điều kiện, {{ name | upper }} là bộ lọc.',
        'Khoảng trắng thừa làm cấu hình sai: dùng {%- và -%} để cắt.',
      ], [], [], DA(11, 12)),
      T('3.5', 'Tự động hoá bảo mật', [
        'Kiểm tra tuân thủ: so cấu hình thực tế với mẫu, báo lệch và đưa về đúng. Chính sách phân vùng đặt tập trung, ví dụ SGT trên SD-Access hoặc VPN trên SD-WAN.',
        'Tài khoản API chỉ có quyền tối thiểu. Mọi thay đổi có log và có cách hoàn tác.',
      ], [], [], DA(14)),
      T('4.1, 4.2', 'Kiểm thử và mô phỏng', [
        'pyATS và Genie đọc show thành dữ liệu có cấu trúc, chụp trạng thái trước và sau thay đổi rồi so sánh.',
        'Cisco Modeling Labs dựng mô hình mạng để thử trước khi đưa ra thật. API của controller cũng kiểm tra được đường đi, ví dụ Path Trace.',
      ], [], [], DA(16, 17)),
      T('4.3, 4.4', 'Quản lý phần mềm và sức khoẻ qua controller', [
        'Catalyst Center có SWIM: chọn image vàng, kiểm tra trước, phân phối, kích hoạt. SD-WAN Manager và Meraki cũng nâng cấp theo nhóm.',
        'Theo dõi sức khoẻ bằng API, ví dụ /dna/intent/api/v1/network-health, thay vì đọc từng thiết bị.',
      ], [], [], DA(18, 19)),
      T('4.5, 4.6', 'Telemetry và webhook', [
        'Cấu hình telemetry bằng CLI: lab R19. Bằng NETCONF, RESTCONF: sửa mô hình Cisco-IOS-XE-mdt-cfg. Dial-out là thiết bị tự gọi collector, dial-in là collector mở phiên tới thiết bị.',
        'Webhook: controller gửi HTTP POST dạng JSON tới URL của bạn khi có sự kiện. Máy nhận phải có HTTPS, kiểm tra secret và trả mã 2xx thật nhanh.',
      ], [], [], DA(20, 21)),
      T('5.1–5.3', 'AI trong tự động hoá', [
        'Controller dùng AI để phát hiện bất thường, gợi ý nguyên nhân và cách xử lý. Trợ lý sinh mã giúp viết nhanh, nhưng phải đọc lại và chạy thử trên lab.',
        'Rủi ro: lộ khoá và dữ liệu trong prompt, mã sai nhưng trông đúng, prompt injection từ dữ liệu đưa vào, agent có quyền quá rộng. Nên cấp quyền đọc trước và bắt người duyệt thay đổi.',
      ], [], [], DA(22, 23)),
      T('5.4', 'Viết MCP server bằng FastMCP', [
        'MCP là cách chuẩn để AI agent gọi công cụ bên ngoài. Mỗi công cụ là một hàm có mô tả và kiểu tham số rõ ràng.',
        'from fastmcp import FastMCP; mcp = FastMCP("net"). Đặt @mcp.tool() trên def show_interfaces(device: str) -> str, bên trong gọi Netmiko hoặc RESTCONF, cuối file gọi mcp.run().',
        'Chỉ mở công cụ đọc khi chưa cần sửa, kiểm tra tham số đầu vào và không đưa mật khẩu vào kết quả trả về.',
      ], [], [], DA(24)),
    ],
  },
  {
    id: 'ensdwi', name: 'CCNP ENSDWI 300-415 v1.2 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1', 'Kiến trúc: bốn mặt phẳng, TLOC, vRoute', [
        'Xem thêm kịch bản SD-WAN của ENCOR (s37). Validator là điểm hẹn và xử lý NAT, Manager để quản lý, Controller tính chính sách qua OMP, WAN Edge chuyển dữ liệu trong IPsec hoặc GRE, BFD đo từng đường.',
        'TLOC định danh điểm cuối đường hầm gồm system-ip, color và encapsulation. vRoute là route dịch vụ, có TLOC làm next-hop.',
        'Multi-Region Fabric chia mạng thành region truy cập và region lõi, border router nối giữa chúng.',
      ], [], [], DW(1)),
      T('1.2, 1.3', 'Thiết bị và Cloud OnRamp', [
        'WAN Edge có Catalyst 8000, 8000V trên cloud và ISR đời mới. Chọn theo băng thông khi bật IPsec và dịch vụ bảo mật.',
        'Cloud OnRamp cho SaaS đo đường rồi chọn đường tốt nhất tới ứng dụng, cho IaaS dựng edge ảo trên cloud, cho Colocation đặt dịch vụ ở trung tâm trung gian, cho Multicloud nối nhiều cloud và interconnect.',
      ], [], [], DW(2, 3)),
      T('2.1–2.4', 'Triển khai controller', [
        'Cloud: Cisco vận hành hạ tầng. On-premises: tự dựng trên ESXi hoặc KVM, chạy nhiều bản để dự phòng.',
        'Tin nhau bằng chứng chỉ: cần cùng organization-name, root CA, và danh sách serial thiết bị đẩy từ Manager xuống Validator và Controller.',
        'Kiểm tra: show sdwan control connections, show sdwan control local-properties. Lỗi hay gặp: lệch giờ, sai organization-name, chứng chỉ hết hạn, không mở được DTLS UDP 12346.',
      ], [], [], DW(4, 5, 6)),
      T('3.1–3.4', 'Triển khai edge, data plane, OMP, TLOC', [
        'ZTP với serial đã đăng ký, hoặc bootstrap bằng file khi không có DHCP. Mỗi edge có system-ip, site-id và địa chỉ Validator.',
        'VPN 0 là transport, VPN 512 là quản lý, các VPN còn lại là dịch vụ. Color như mpls, biz-internet quyết định cách chọn đường hầm, restrict thì chỉ dựng với cùng color.',
        'TLOC extension cho hai edge dùng chung đường truyền của nhau. Dynamic tunnel chỉ dựng hầm spoke tới spoke khi có lưu lượng.',
        'Kiểm tra: show sdwan omp routes, show sdwan omp tlocs, show sdwan bfd sessions.',
      ], [], [], DW(7, 8, 9)),
      T('3.5–3.7', 'Mẫu cấu hình và multicast', [
        'Template gồm device template ghép từ các feature template cho VRRP, OSPF, BGP, EIGRP ở phía LAN. Cách mới là configuration group, policy group và feature profile, có workflow hướng dẫn.',
        'Multicast chạy trên overlay, edge có thể sao chép gói tại replicator để giảm tải.',
      ], [], [], DW(10, 11, 12)),
      T('4.1–4.5', 'Chính sách', [
        'Control policy đặt trên Controller, đổi cách quảng bá route và tạo topology như hub-and-spoke. Data policy chạy trên edge, xử lý từng luồng.',
        'Phân vùng: VPN tách từ đầu đến cuối, nhãn VPN đi kèm trong hầm.',
        'Application-aware routing: SLA class đặt ngưỡng mất gói, trễ, jitter; đường vi phạm thì lưu lượng chuyển đi. Predictive Path Recommendation dùng AI để đề xuất đường theo lịch sử.',
        'Direct Internet Access: bật NAT trên cổng transport để Internet ra thẳng từ chi nhánh.',
      ], [], [], DW(13, 14, 15, 16, 17)),
      T('5.1–5.5', 'Bảo mật, QoS, AppQoE', [
        'Service insertion đưa lưu lượng qua firewall hoặc IPS bằng service route. Trên edge có firewall theo ứng dụng, IPS, lọc URL, AMP, SSL proxy, TrustSec.',
        'Bảo mật cloud: lọc DNS, và SIG là cổng Internet an toàn qua hầm IPsec hoặc GRE.',
        'QoS gồm đánh dấu, policing, xếp hàng, shaping. Per-tunnel QoS shape riêng từng hầm theo băng thông bên nhận, adaptive QoS tự điều chỉnh khi băng thông đổi. So sánh ở lab E11.',
        'AppQoE: tối ưu TCP, DRE khử dữ liệu lặp, gửi đúp gói và FEC để bù mất gói, AppNav điều hướng tới các dịch vụ đó.',
      ], [], [], DW(18, 19, 20, 21, 22)),
      T('6.1–6.4', 'Vận hành', [
        'Manager có xác thực local, RADIUS, TACACS+, phân quyền theo nhóm, dashboard, báo cáo và nâng cấp phần mềm.',
        'REST API đọc được số liệu giám sát. Lấy phiên đăng nhập và token CSRF trước khi gọi.',
      ], [], [], DW(23, 24)),
    ],
  },
  {
    id: 'ensld', name: 'CCNP ENSLD 300-420 v1.1 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1', 'Kế hoạch địa chỉ', [
        'Chia theo cấu trúc để tóm tắt được: vùng, toà nhà, chức năng. Chừa dải cho tăng trưởng.',
        'IPv6: mỗi site /48, mỗi VLAN /64, nhúng được số VLAN hoặc site vào địa chỉ cho dễ đọc. Point-to-point dùng /127, loopback dùng /128.',
      ], [], [], D(1)),
      T('1.2', 'Thiết kế IS-IS', [
        'IS-IS chạy trực tiếp trên lớp 2, không cần IP. NET gồm area, system ID và 00, ví dụ 49.0001.0000.0000.0001.00.',
        'L1 là nội vùng, L2 là xương sống, L1/L2 nối hai bên và đưa default tới L1. Biên vùng nằm trên link, không nằm trên router như OSPF.',
        'Trên broadcast có DIS, không có bản dự phòng. Dùng wide metric cho cổng nhanh và thêm xác thực. IS-IS không có trong Lab.',
      ], [], [], D(2)),
      T('1.3–1.5', 'Thiết kế EIGRP, OSPF, BGP', [
        'EIGRP: stub ở chi nhánh và tóm tắt ở biên để giới hạn Query. Lab R05, R06.',
        'OSPF: chia area, tóm tắt tại ABR, dùng stub cho chi nhánh, tránh một area quá lớn. Lab E02, R03.',
        'BGP: local-preference chọn đường ra, prepend hoặc MED gợi ý đường vào, lọc bằng prefix-list. RR hay confederation thay full mesh iBGP. Lab R07, R08, R15.',
      ], [], [], D(3, 4, 5)),
      T('1.6', 'Chuyển sang IPv6', [
        'Dual-stack chạy cả hai song song, là cách nên chọn khi được. Tunnel mang IPv6 qua lõi IPv4, ví dụ GRE. Dịch địa chỉ như NAT64 kèm DNS64 cho máy chỉ có IPv6 vào dịch vụ IPv4.',
        'Lab X05 có dual-stack.',
      ], [], [], D(6)),
      T('2.1–2.3', 'Campus: HA, lớp 2, lớp 3', [
        'FHRP cho gateway, StackWise hoặc VSS gộp thiết bị để bỏ STP chặn cổng. SSO kèm NSF giữ chuyển tiếp khi đổi supervisor, NSR giữ phiên mà không cần láng giềng hỗ trợ. BFD phát hiện đứt nhanh.',
        'Lớp 2: gọn phạm vi VLAN, Rapid PVST+, Root Guard, BPDU Guard, port security, VACL. PoE theo công suất từng loại thiết bị, WoL đánh thức máy qua gói magic.',
        'Lớp 3: routed access không cần STP, tóm tắt tại distribution, ECMP chia tải, VRF tách khối, cẩn thận lặp khi redistribute hai điểm: lab R01.',
      ], [], [], D(7, 8, 9)),
      T('2.4, 2.5', 'SD-Access', [
        'Xem kịch bản s36. Control plane LISP, data plane VXLAN, chính sách SGT. Border nối ra ngoài, virtual network tách lớp 3, SGT tách trong cùng VN.',
        'Wi-Fi fabric cho dữ liệu đi thẳng vào fabric. Over-the-top thì Wi-Fi vẫn CAPWAP về WLC, chạy như dữ liệu thường trong fabric.',
      ], [], [], D(10)),
      T('3.1–3.3', 'WAN', [
        'Lựa chọn: L2VPN, MPLS L3VPN (s34), Metro Ethernet (E-Line, E-LAN, E-Tree), DWDM cho nhiều bước sóng trên sợi quang, 4G/5G làm dự phòng, SD-WAN.',
        'VPN: DMVPN (R09) cho nhiều chi nhánh, GRE qua IPsec (K01) khi cần định tuyến, GET VPN mã hoá nhóm không có đường hầm, giữ nguyên IP header nên hợp trên MPLS riêng, khoá do key server cấp qua GDOI.',
        'HA: single-homed một ISP, multihomed nhiều ISP chạy BGP, đường dự phòng 4G với IP SLA và track (E06).',
      ], [], [], D(11, 12, 13)),
      T('3.4, 3.5', 'Thiết kế SD-WAN', [
        'Xem nhóm ENSDWI. Cần tính số edge cho mỗi controller, số hầm trên edge. Dùng dynamic tunnel hoặc hub-and-spoke thay full mesh khi mạng lớn. Dự phòng bằng hai edge và hai đường truyền.',
      ], [], [], D(14)),
      T('4.1, 4.2', 'QoS đầu cuối', [
        'IntServ đặt trước tài nguyên bằng RSVP, khó mở rộng. DiffServ đánh dấu DSCP và xử lý theo từng chặng, phổ biến hơn.',
        'Đánh dấu gần nguồn nhất có thể tin được, xếp hàng và shape tại nơi nghẽn như WAN. Thoại EF không quá khoảng 33% link. Xem E11, s25.',
      ], [], [], D(15)),
      T('4.3', 'Mạng quản lý', [
        'In-band dùng chung đường dữ liệu, rẻ nhưng mất mạng là mất quản lý. Out-of-band có đường riêng để vào được cả khi lỗi. Tách VLAN hoặc VRF quản lý, ưu tiên lưu lượng quản lý bằng QoS.',
      ], [], [], D(16)),
      T('4.4, 4.5', 'Multicast', [
        'Xem kịch bản s33. Cây theo nguồn tối ưu đường đi, cây chung qua RP tiết kiệm trạng thái. RPF chống lặp.',
        'SSM không cần RP nếu ứng dụng hỗ trợ IGMPv3. Bidir hợp với nhiều nguồn. MSDP báo nguồn giữa các RP. Service reflection đổi địa chỉ luồng multicast khi đi qua biên.',
      ], [], [], D(17)),
      T('5.1–5.6', 'Mô hình, telemetry, cloud', [
        'Xem nhóm ENAUTO về YANG. Periodic gửi đều nên dễ tính tải, on-change chỉ gửi khi đổi nên tiết kiệm. gRPC là lớp vận chuyển trên HTTP/2, gNMI là giao diện quản lý chạy trên gRPC.',
        'SaaS dùng ứng dụng, PaaS dùng nền tảng, IaaS tự quản từ hệ điều hành trở lên. Private, public, hybrid khác nhau ở nơi đặt và người vận hành. Kết nối cloud xem nhóm ENCC.',
      ], [], [], D(18, 19, 20)),
    ],
  },
  {
    id: 'wlcor', name: 'CCNP Wireless WLCOR 350-101 v1.0 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1–1.4', 'Sóng, phép tính dB và ăng-ten', [
        'Sóng bị hấp thụ, phản xạ, tán xạ, khúc xạ và nhiễu xạ khi gặp vật cản. Cùng khoảng cách, tần số càng cao thì suy hao không gian càng lớn, nên 6 GHz phủ ngắn hơn 2.4 GHz.',
        'SNR bằng RSSI trừ nhiễu nền, ví dụ -65 dBm trên nền -90 dBm là SNR 25 dB. Độ nhạy thu là mức yếu nhất mà máy còn giải mã được ở một tốc độ. Điện thoại thường phát yếu hơn AP và laptop, nên thiết kế theo máy kém nhất. Đọc SNR ở lab W05.',
        'Thêm 3 dB là gấp đôi công suất, thêm 10 dB là gấp mười. 0 dBm là 1 mW, 20 dBm là 100 mW. EIRP bằng công suất phát trừ suy hao cáp cộng độ lợi ăng-ten.',
        'Ăng-ten omni phủ quanh một vòng, ăng-ten định hướng tập trung vào một phía. dBi là độ lợi so với nguồn đẳng hướng. Độ lợi cao làm búp sóng hẹp lại, không tạo thêm công suất.',
      ], [], [], DWL(1, 2, 3, 4)),
      T('2.1–2.3', 'Quy định, kênh và khung 802.11', [
        'Cơ quan quản lý từng vùng (FCC, ETSI...) đặt băng tần và giới hạn EIRP. IEEE viết chuẩn 802.11, Wi-Fi Alliance chứng nhận tương thích, ví dụ WPA3 và Wi-Fi 7.',
        'Băng 2.4 GHz chỉ có 1, 6, 11 không chồng lấn. 5 GHz và 6 GHz nhiều kênh hơn. Kênh và công suất dùng được đổi theo quốc gia, nên chọn đúng regulatory domain. RRM tự chọn kênh (DCA) và công suất (TPC).',
        'OFDM chia kênh thành nhiều sóng mang, OFDMA chia sóng mang cho nhiều máy cùng lúc. QAM càng cao càng nhanh nhưng càng cần SNR tốt. Kênh rộng 20, 40, 80, 160 MHz cho nhanh hơn nhưng ít kênh và dễ nhiễu hơn.',
        'MIMO gửi nhiều luồng trong không gian, MU-MIMO gửi cho nhiều máy cùng lúc, MLO của Wi-Fi 7 dùng nhiều băng trên cùng một kết nối. Topology: BSS là một AP, ESS là nhiều AP cùng SSID, IBSS không có AP, ngoài ra có mesh và WGB.',
        'Ba loại khung: quản lý (beacon, probe, authentication, association), điều khiển (RTS, CTS, ACK), dữ liệu. Trình tự vào mạng: probe, authentication mở, association, rồi mới tới xác thực 802.1X hoặc PSK.',
      ], [], [], DWL(5, 6, 7, 8, 9)),
      T('3.1–3.3', 'Kiến trúc và đấu nối', [
        'Local: AP dựng hầm CAPWAP về WLC (UDP 5246 điều khiển, 5247 dữ liệu). Fabric: dữ liệu vào thẳng SD-Access bằng VXLAN, xem kịch bản s36. Mesh: AP nối nhau bằng sóng. Cloud: quản lý qua dashboard Meraki, dữ liệu không đi về cloud.',
        'AP Local cắm cổng access. AP FlexConnect và WLC thường cắm trunk. Tính đủ PoE: 802.3af 15.4 W, 802.3at 30 W, 802.3bt tới 90 W tại cổng switch. Lab W01 nối AP và WLC vào switch, lab N11 có PoE.',
        'Vào quản lý bằng console, SSH, HTTPS tới WLC và AP, hoặc dashboard qua Internet. Giới hạn nguồn truy cập và dùng RADIUS hoặc TACACS+ cho tài khoản quản trị.',
      ], [], [], DWL(10, 11, 12)),
      T('4.1–4.5', 'Vận hành: AP join, chế độ AP, WLAN', [
        'Catalyst 9800 dùng ba tag gán cho AP: policy tag ghép WLAN với policy profile, site tag quy định AP join profile và local hay Flex, RF tag chọn hồ sơ RF. Khác với AireOS gom mọi thứ trong WLAN.',
        'AP tìm WLC qua broadcast cùng subnet, WLC đã lưu, DHCP option 43, DNS tên CISCO-CAPWAP-CONTROLLER. Sau đó DTLS, join, tải image nếu lệch phiên bản. Hỏng join thường do lệch giờ, chứng chỉ hoặc thiếu đường tới WLC.',
        'Chế độ AP: Local, FlexConnect, Monitor, Sniffer, Rogue Detector, Bridge cho mesh. Monitor không phục vụ máy, chỉ quét.',
        'Tạo WLAN và thử PSK ở lab W01. Quy tắc cho máy có thể đặt ở nhiều nơi: WLC, dashboard, Catalyst Center, ISE, Spaces, MDM. Nên giữ một nơi quyết định chính sách để dễ tra lỗi.',
      ], [], [], DWL(13, 14, 15, 16, 17)),
      T('5.1–5.5', 'Kết nối máy khách', [
        'Bên ngoài WLC: 802.1X với RADIUS hoặc ISE, phương thức EAP như PEAP và EAP-TLS. Làm lab W03. Máy chủ RADIUS phải khai WLC là client với đúng secret.',
        'Trên WLC: PSK, WPA2, WPA3-SAE, web authentication nội bộ, local EAP khi không có RADIUS. WPA3 ở 6 GHz là bắt buộc, kèm PMF.',
        'Trên máy khách: Windows, macOS, iOS, Android đều có hồ sơ riêng, tin CA và kiểm tra tên server khi dùng 802.1X. Với số lượng lớn, phát hồ sơ bằng MDM.',
        'Roaming: 802.11r rút ngắn đổi khoá, 802.11k gợi ý AP lân cận, 802.11v gợi ý chuyển AP. Khác VLAN giữa hai WLC thì lưu lượng đi qua hầm mobility.',
        'Khách: VLAN riêng, cô lập máy với nhau, giới hạn băng thông, làm ở lab W02. Khách qua cổng ISE là CWA, cổng trên WLC là LWA. Anchor WLC đưa lưu lượng khách về DMZ.',
      ], [], [], DWL(18, 19, 20, 21, 22)),
      T('6.1–6.4', 'Bảo trì, giám sát, chẩn đoán', [
        'Nâng cấp bằng tải trước image xuống AP, nâng từng đợt để không mất sóng cùng lúc. Catalyst Center có SWIM, dashboard đặt lịch được.',
        'Theo dõi một máy: RSSI, SNR, kênh, tốc độ, trạng thái xác thực. Catalyst Center có Client 360 cho lịch sử.',
        'Chẩn đoán theo chuỗi: có sóng, association, xác thực, DHCP, DNS. Thử ở lab W04 và W05. So thêm nhật ký RADIUS khi kẹt ở bước xác thực.',
        'Tích hợp: Catalyst Center quản lý và giám sát, ISE quyết định truy cập, Spaces cho định vị, ThousandEyes đo trải nghiệm.',
      ], [], [], DWL(23, 24, 25, 26)),
      T('7.1–7.6', 'Tự động hoá và AI', [
        'Đọc Python: biến, vòng lặp, dict, gọi requests rồi xem status_code. NETCONF chạy cổng 830, dữ liệu XML theo YANG, thử lệnh ở lab E07. Xem thêm nhóm ENAUTO.',
        'API của WLC, dashboard, Catalyst Center đều có xác thực, đường dẫn, mã trả về. Đọc script bắt đầu từ URL và phần thân gửi đi.',
        'AI Analytics tìm bất thường và so sánh với mạng tương tự. AI Operations đưa nguyên nhân khả dĩ và gợi ý xử lý. AI-RRM học dữ liệu RF dài ngày trên cloud để đề xuất kênh và công suất, thay vì chỉ xét hiện trạng như RRM thường.',
      ], [], [], DWL(27, 28, 29, 30, 31)),
    ],
  },
  {
    id: 'wlsd', name: 'CCNP Wireless WLSD 300-110 v1.2, thay ENWLSD 300-425 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1, 1.2', 'Yêu cầu và suy hao vật liệu', [
        'Hỏi trước khi vẽ: bao nhiêu máy mỗi khu, ứng dụng thời gian thực nào, loại AP và ăng-ten, mục đích dữ liệu, định vị, thoại hay video, cách xác thực. Thiết kế theo máy yếu nhất phải hỗ trợ.',
        'Suy hao tham khảo: vách thạch cao ít, kính vừa, tường gạch và bê tông nhiều, kim loại gần như chặn. Đo thực tế nếu có thể vì số trong sách chỉ để ước tính.',
      ], [], [], DWS(1, 2, 3)),
      T('1.3–1.7', 'Các kiểu khảo sát và công cụ', [
        'Khảo sát Layer 1 tìm nguồn nhiễu không phải Wi-Fi bằng máy phân tích phổ. Khảo sát predictive dựng trên bản vẽ và vật liệu, dùng để dự toán. Khảo sát trước triển khai đặt thử AP tại chỗ để đo. Khảo sát sau triển khai xác nhận đạt yêu cầu ban đầu.',
        'Chỉ số thường kiểm: vùng phủ theo RSSI, SNR, chồng lấn kênh, số AP nghe được ở mỗi điểm. Thoại thường đòi khoảng -67 dBm và SNR từ 25 dB. Đối chiếu số cụ thể với thiết bị đầu cuối đang dùng.',
        'Ekahau và Hamina để mô hình và đo, Chanalyzer và các máy phân tích phổ để xem nhiễu. Lab W05 cho đọc SNR, chọn băng và kênh, không thay được khảo sát thật.',
      ], [], [], DWS(4, 5, 6, 7, 8)),
      T('2.1, 2.2', 'Hạ tầng vật lý và logic', [
        'AP cần đủ PoE cho cả ăng-ten và băng tần, thiếu điện thì AP tắt bớt radio. Cáp đủ chuẩn cho tốc độ mGig, chừa cổng switch, tính đường lên, gắn đúng vị trí và độ cao. Ngoài trời cần tiếp đất và chống sét. Xem PoE ở lab N11.',
        'Logic: giấy phép WLC và AP theo kiến trúc, số AP và máy tối đa của controller, VLAN, DHCP, đường về RADIUS.',
      ], [], [], DWS(9, 10)),
      T('2.3', 'Quản lý sóng', [
        'RRM chọn kênh và công suất. AI-RRM trên Catalyst Center dùng dữ liệu dài ngày để đề xuất. RF profile đặt riêng cho từng khu, ví dụ giảng đường và văn phòng.',
        'RxSOP cho radio bỏ qua tín hiệu dưới ngưỡng để tăng tái sử dụng kênh. Đặt quá cao làm máy ở xa mất kết nối, nên chỉ chỉnh ở khu mật độ cao sau khi đo.',
      ], [], [], DWS(11, 12, 13)),
      T('2.4, 2.5', 'Dữ liệu, thoại, định vị, mật độ cao', [
        'Dữ liệu ưu tiên phủ đủ. Thoại và video cần chồng lấn để roam không rớt, ít nhiễu, QoS WMM. Định vị cần nhiều AP nghe được một máy, ít nhất ba, và bản đồ đúng; Cisco Spaces dùng chính dữ liệu đó.',
        'Mật độ cao: chia ô nhỏ bằng công suất thấp, kênh 20 hoặc 40 MHz, ăng-ten định hướng, bỏ tốc độ cơ bản thấp, ưu tiên 5 và 6 GHz. Tính số máy trên mỗi radio theo ứng dụng, không chỉ theo diện tích.',
      ], [], [], DWS(14, 15, 16, 17)),
      T('2.6', 'Bridging và mesh', [
        'RAP có dây về mạng, MAP nối về RAP bằng sóng. Mỗi chặng sóng tốn băng thông nên hạn chế số chặng. Có thể dùng điểm tới điểm, điểm tới đa điểm hoặc mesh.',
        'Ethernet bridging cho phép cắm thiết bị có dây vào MAP. WGB là máy khách đại diện cho các thiết bị có dây phía sau, có thể roam giữa AP, hợp với xe và robot.',
      ], [], [], DWS(18, 19, 20)),
      T('3.1–3.4', 'Mobility và Site Tag', [
        'Trong cùng mobility group, máy roam giữ phiên và khoá nhanh. Group cần cùng tên, cùng virtual IP (trên AireOS), WLC khai lẫn nhau. Trên 9800, mobility dùng UDP 16666 cho điều khiển và 16667 cho dữ liệu, phải mở qua firewall.',
        'Roam tốt: bật 802.11k/v, 802.11r nếu máy hỗ trợ, tránh chênh lệch công suất lớn giữa các AP. Sticky client thường do AP phát quá mạnh.',
        'Khi roam khác VLAN, WLC cũ là anchor và WLC mới là foreign, lưu lượng đi qua hầm giữa hai bên, giữ nguyên IP. Anchor cũng dùng để đưa khách về DMZ. Kiểm tra bằng thông tin mobility của client trên WLC.',
        'Site Tag trên 9800 gom AP theo khu, chọn local hay FlexConnect và AP join profile. Nên cho AP có thể roam qua lại vào cùng một site tag để giảm tải và giữ roaming nhanh.',
      ], [], [], DWS(21, 22, 23, 24)),
      T('4.1, 4.2', 'Dự phòng', [
        'LAG gộp cổng WLC để chịu đứt link, nối về hai switch trong stack hoặc VSS. SSO có một WLC active và một standby đồng bộ trạng thái, AP và máy không phải join lại khi đổi. N+1 không đồng bộ nên AP phải join lại.',
        'Khai primary, secondary, tertiary WLC cho AP để biết nơi về khi lỗi, và có fall-back để quay về nơi chính. AP priority quyết định AP nào được nhận trước khi WLC dự phòng thiếu chỗ. Anchor nên có nhiều hơn một.',
        'EWC là controller chạy trên AP, hợp với site nhỏ. Khi AP đang giữ vai trò này lỗi, AP đủ điều kiện khác được bầu lên, máy có thể gián đoạn ngắn.',
      ], [], [], DWS(25, 26, 27, 28, 29)),
    ],
  },
  {
    id: 'wlsi', name: 'Wi-Fi nâng cao WLSI 300-120 v1.2, thay ENWLSI 300-430, nay thuộc CCNP Wireless', weight: 0, optional: true,
    topics: [
      T('1.1–1.3', 'FlexConnect và OfficeExtend', [
        'AP FlexConnect đặt ở chi nhánh. Connected là còn nối WLC, standalone là mất WLC nhưng vẫn phục vụ theo cấu hình đã có. Local switching đưa dữ liệu ra ngay switch, central switching đưa về WLC.',
        'Nhóm FlexConnect giữ roaming nhanh và khoá khi mất WLC. Split tunneling gửi một phần lưu lượng về WLC, Flex ACL lọc tại AP, Smart AP upgrade chỉ tải image về vài AP rồi chia cho nhau.',
        'OfficeExtend AP đặt tại nhà, hầm DTLS về WLC qua Internet. Thực hành WLC ở các lab W01–W05.',
      ], [], [], DWI(1, 2, 3, 4, 5, 6)),
      T('2.1–2.3', 'QoS không dây', [
        'Hồ sơ WLC: Platinum thoại, Gold video, Silver mặc định, Bronze nền. DSCP được ánh xạ sang WMM: thoại EF (46) về UP 6, video AF41 (34) về UP 4 theo RFC 8325.',
        'AVC nhận diện ứng dụng bằng NBAR2 để đánh dấu hoặc giới hạn theo ứng dụng.',
      ], [], [], DWI(7, 8, 9)),
      T('3.1–3.5', 'Multicast và mDNS', [
        'Trên sóng, multicast chạy ở một tốc độ bắt buộc, thường là cao nhất, không xác nhận, nên chiếm nhiều thời gian phát. Bật IGMP snooping để giảm bớt.',
        'WLC gửi tới AP bằng multicast-multicast thay vì unicast để đỡ tải. Multicast Direct đổi thành unicast cho từng máy để chất lượng tốt hơn. mDNS gateway cho AirPrint, AirPlay đi qua VLAN khác.',
      ], [], [], DWI(10, 11, 12, 13)),
      T('4.1–5.5', 'Định vị, CMX, Cisco Spaces, wIPS', [
        'Cần ít nhất ba AP nghe được máy để tính vị trí. Sai số do bản đồ, độ cao AP, tường dày và tham số RSSI.',
        'Spaces là bản cloud, CMX là bản đặt tại chỗ, Connector nối WLC với Spaces. Có phân tích hiện diện, captive portal, đăng nhập mạng xã hội cho khách.',
        'Theo dõi được máy, thẻ RFID, nguồn nhiễu, AP giả. wIPS phát hiện tấn công không dây, quản lý từ Catalyst Center.',
      ], [], [], DWI(14, 15, 16, 17, 18, 19, 20, 21, 22)),
      T('6.1–6.4', 'Bảo mật máy khách với ISE', [
        'Profiling nhận diện loại máy qua DHCP, HTTP, RADIUS. CWA chuyển hướng về cổng của ISE, LWA dùng cổng trên WLC, khác nhau ở nơi xác thực.',
        'BYOD: tự đăng ký, cấp chứng chỉ cho supplicant gốc của máy. Theo danh tính: ISE trả về VLAN, ACL, QoS qua RADIUS sau xác thực.',
      ], [], [], DWI(23, 24, 25, 26, 27, 28)),
      T('7.1–7.4', 'Giám sát', [
        'Báo cáo từ Catalyst Center. Phân loại rogue theo mức, chỉ containment khi đã xác nhận và được phép vì có rủi ro pháp lý. CleanAir phát hiện nguồn nhiễu.',
        'Lỗi máy khách: xem theo chuỗi liên kết, xác thực, DHCP. So lại nhật ký ISE. Lab W04.',
      ], [], [], DWI(29, 30, 31, 32)),
      T('8.1–8.3', 'Bảo vệ thiết bị', [
        'Đăng nhập WLC qua RADIUS hoặc TACACS+. AP xác thực với switch bằng 802.1X để chống cắm AP lạ. CPU ACL trên WLC giới hạn ai được nói chuyện với controller.',
      ], [], [], DWI(33, 34, 35)),
    ],
  },
  {
    id: 'encc', name: 'CCNP ENCC 300-440 v1.0 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1–1.3', 'Các cách nối cloud', [
        'Qua Internet: hầm IPsec tới cổng VPN của cloud như AWS VGW hoặc TGW, Azure VPN Gateway, Google HA VPN; hoặc SD-WAN Cloud OnRamp.',
        'Riêng: AWS Direct Connect, Azure ExpressRoute, Google Cloud Interconnect, qua nhà mạng MPLS hoặc colocation. SDCI là dịch vụ cross-connect theo phần mềm của các hãng trung gian, dựng nhanh và theo vùng.',
        'SaaS: ra thẳng Internet tại chi nhánh, qua nhà cung cấp bảo mật cloud, qua cổng Internet tập trung, hoặc kết nối riêng tới nhà cung cấp SaaS.',
      ], [], [], DC(1, 2, 3)),
      T('2.1–2.4', 'Chọn thiết kế', [
        'Internet rẻ và nhanh triển khai nhưng không có SLA về băng thông. Kết nối riêng ổn định, tốn kém và mất thời gian hơn. Thường dùng hai đường: riêng làm chính, IPsec làm dự phòng.',
        'Xét băng thông, QoS, dùng chung hay riêng, multihoming, BGP. Hầm IPsec tới cloud thường bị giới hạn băng thông mỗi hầm.',
        'Tuân thủ: NIST 800-53, FedRAMP cho chính phủ Mỹ, ISO 27001. Quy định có thể yêu cầu vị trí dữ liệu và mã hoá đường truyền riêng.',
        'Bảo mật cloud: security group, network ACL, kiểm tra east/west, inbound qua firewall, có thể đưa Internet về trung tâm kiểm soát.',
      ], [], [], DC(4, 5, 6, 7)),
      T('3.1–3.3', 'Cấu hình IPsec, GRE, BGP', [
        'Làm thử ở lab K01: GRE qua IPsec và eBGP giữa router tại chỗ và router trên cloud. Lab dùng IKEv1, cloud ngày nay thường dùng IKEv2.',
        'Cloud thường cung cấp hai đầu hầm để dự phòng, nên cấu hình cả hai và để BGP chọn đường. Đặt ip tcp adjust-mss 1360 và ip mtu 1400 trên tunnel để tránh phân mảnh.',
        'Khi lấy route BGP về mạng nội bộ OSPF cần redistribute có lọc, tránh quảng bá ngược: lab R01.',
      ], ['K01'], [], DC(8, 9, 10, 11, 12, 13)),
      T('4.1–4.3', 'SD-WAN tới cloud', [
        'Cloud OnRamp dựng hầm từ edge tới cloud hoặc SIG. OnRamp cho SaaS đo chất lượng rồi chọn đường. Chính sách gồm bảo mật, định tuyến và ứng dụng, phân biệt north/south với east/west. Xem nhóm ENSDWI.',
      ], [], [], DC(14, 15, 16, 17)),
      T('5.1–5.4', 'Chẩn đoán', [
        'Hầm không lên: so tham số IKE, PSK, lifetime, NAT-T, kiểm tra UDP 500 và 4500. Lệnh: show crypto ikev2 sa, show crypto ipsec sa, xem counters encaps và decaps có tăng hai chiều.',
        'Hầm lên mà không có route: show ip bgp summary, kiểm tra ASN, IP đầu hầm, route table phía cloud đã bật propagation chưa. Security group chặn cũng làm hỏng dữ liệu dù BGP vẫn lên.',
        'Tải lớn thì lỗi, gói nhỏ thì được: gần như chắc chắn là MTU, thử ping với df-bit và size lớn dần.',
      ], [], [], DC(18, 19, 20, 21)),
    ],
  },
  {
    id: 'enna', name: 'CCNP ENNA 300-445 v1.0 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1–1.3', 'Agent và kiểu giám sát', [
        'Active tự tạo lưu lượng đo, chạy được cả khi không có người dùng. Passive quan sát lưu lượng thật. RFC 7799 phân định các nhóm này.',
        'ThousandEyes có Cloud Agent ngoài Internet, Enterprise Agent trong mạng, Endpoint Agent trên máy người dùng. Đặt agent theo nơi cần trả lời: ngay chi nhánh, ở trung tâm dữ liệu, hoặc phía người dùng.',
      ], [], [], DN(1, 2, 3)),
      T('1.4–1.8', 'Nền tảng và tích hợp', [
        'WAN Insights phân tích lịch sử để đề xuất đường tốt hơn. ThousandEyes tích hợp với SD-WAN Manager, Catalyst Center, Webex Control Hub, Meraki, và cài Endpoint Agent qua Secure Client.',
        'Đặt mức nền bằng dữ liệu một thời gian đủ dài, cảnh báo khi lệch khỏi mức này. Lấy dữ liệu bằng API, ngưỡng cảnh báo, OpenTelemetry hoặc đẩy sang ITSM để tạo ticket.',
        'Chọn nền tảng theo câu hỏi: trải nghiệm người dùng, web, ứng dụng hay sự kiện.',
      ], [], [], DN(4, 5, 6, 7)),
      T('2.1–2.6', 'Thu thập dữ liệu', [
        'Enterprise Agent cài trên máy chủ, thiết bị mạng có hỗ trợ container, hoặc máy chuyên dụng. Endpoint Agent triển khai hàng loạt trên Windows, Mac, Room OS.',
        'Các loại test: TCP/UDP đo mất gói, trễ, jitter, băng thông; DNS; thoại đo MOS; web. Trên thiết bị có IP SLA tương tự ở lab R19.',
        'Synthetic web test chạy script như người dùng, nhưng không phản ánh mọi tình huống thật và phải sửa khi trang đổi.',
        'Xác thực khi test: basic, digest, bearer token, OAuth, SAML, SSO. Giữ thông tin đăng nhập trong kho bí mật, đừng ghi vào script.',
      ], [], [], DN(8, 9, 10, 11, 12, 13, 14)),
      T('3.1–3.4', 'Phân tích', [
        'Mạng: mất gói theo từng chặng trong path visualization, jitter cao hay do nghẽn, đổi route làm trễ nhảy bậc.',
        'Máy người dùng: kiểm tra lần lượt Wi-Fi, gateway, DNS, proxy, VPN gateway rồi tới đích.',
        'Web: biểu đồ waterfall chỉ ra DNS, kết nối, TLS, thời gian chờ server hay tải tài nguyên. Xem từng bước để biết lỗi ở đâu.',
        'Bảo mật: DDoS làm mất gói hàng loạt, DNS hijacking trả sai IP, BGP hijacking và route leak đổi đường đi hoặc AS gốc một cách đột ngột.',
      ], [], [], DN(15, 16, 17, 18)),
      T('4.1–4.5', 'Cảnh báo và báo cáo', [
        'Cảnh báo theo mạng: TCP, nghẽn, lỗi cổng, thông lượng, bảng BGP, Internet, MPLS, VPN, NetFlow, SNMP, syslog. Theo người dùng: CPU, loại kết nối, trình duyệt, VPN.',
        'Không đặt ngưỡng quá nhạy: yêu cầu lệch trong nhiều lần đo để bớt báo giả. Thử bằng cách gây lỗi thật hoặc đổi ngưỡng tạm để biết cảnh báo chạy.',
        'Báo cáo theo người đọc: vận hành cần chi tiết thời gian thực, nhóm ứng dụng cần theo app, lãnh đạo cần tóm tắt SLA.',
        'Lập kế hoạch dung lượng: xem xu hướng, rồi đổi topology, cấu hình hoặc QoS trước khi nghẽn.',
      ], [], [], DN(19, 20, 21, 22, 23)),
    ],
  },
  {
    id: 'scor', name: 'CCNP Security SCOR 350-701 v2.0 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1–1.4', 'Mối đe doạ và lỗ hổng', [
        'Phân biệt: virus cần vật chủ, trojan giả làm phần mềm tốt, rootkit giấu mình ở mức hệ thống, DoS làm cạn tài nguyên, MITM nghe lén giữa đường. PQC là nguy cơ dữ liệu mã hoá bị lưu lại rồi giải khi có máy tính lượng tử. AI vừa hỗ trợ tấn công vừa là mục tiêu.',
        'Lỗi phần mềm hay gặp: buffer overflow, SQL injection, XSS, CSRF, path traversal, mật khẩu cứng. OWASP Top 10 là danh sách rủi ro web. CVE là mã lỗ hổng, CVSS chấm 0–10. Ưu tiên vá theo CVSS, mức lộ ra ngoài và việc đã có khai thác thật chưa.',
        'Mô hình AI/LLM: prompt injection, lộ system prompt, điểm yếu trong vector embedding, chuỗi cung ứng mô hình. Không tin dữ liệu đưa vào và cấp quyền tối thiểu cho công cụ.',
        'Chống lừa đảo: lọc email, SPF, DKIM, DMARC, MFA chống phishing, đào tạo người dùng, tạo quy trình xác minh yêu cầu chuyển tiền.',
      ], [], [], DSC(1, 2, 3, 4)),
      T('1.5, 1.6', 'Mật mã và các kiểu VPN', [
        'Hash cho toàn vẹn, mã hoá đối xứng nhanh, bất đối xứng để trao khoá và ký. PKI dùng CA để tin chứng chỉ. TLS bảo vệ phiên, QUIC là truyền tải trên UDP đã tích hợp TLS 1.3, MASQUE chuyển tiếp lưu lượng qua HTTP/3.',
        'IPsec: ESP là giao thức IP 50, AH là IP 51, IKE dùng UDP 500, NAT-T bọc trong UDP 4500. PSK đơn giản, chứng chỉ mở rộng tốt hơn. PQC chuyển sang thuật toán chống lượng tử như ML-KEM.',
        'Site-to-site và remote access: VTI có interface nên chạy định tuyến dễ, DMVPN cho nhiều spoke (lab R09, s38), FlexVPN thống nhất cấu hình trên IKEv2, GETVPN mã hoá nhóm, SSL VPN cho người dùng. Làm IPsec ở lab D03 và K01, sửa lỗi ở C05.',
      ], [], [], DSC(5, 6)),
      T('1.7–1.10', 'Threat intel, zero trust, script', [
        'Tin tức đe doạ dùng STIX làm định dạng, TAXII để chia sẻ. Giá trị nằm ở chỗ đưa được vào firewall, SIEM để hành động.',
        'Zero trust: không tin theo vị trí mạng, xác minh danh tính, thiết bị và ngữ cảnh ở mọi lần truy cập. Defense in depth chồng nhiều lớp, SAFE là khung tham chiếu của Cisco theo vị trí trong mạng.',
        'Đọc script gọi API: lấy token, gửi kèm header, thao tác trên URL và JSON. Xem lab E07 và nhóm ENAUTO.',
      ], [], [], DSC(7, 8, 9)),
      T('2.1–2.3', 'Firewall, IPS, giám sát, bảo vệ L2', [
        'Firewall chạy routed hoặc transparent, IPS đặt inline thì chặn được, passive chỉ báo. Làm firewall ở lab F01–F04 và Z01–Z03. Lab dùng ASA và ZBF, không có FTD, nhưng ý tưởng vùng, NAT, policy là tương tự.',
        'Giám sát: NetFlow (lab E04), SPAN (E05), syslog, SNMP, telemetry. Đo được luồng, không cần chứa cả nội dung gói.',
        'Bảo vệ L2: DHCP snooping S01, DAI S02, IP Source Guard S03, Storm Control N15, Root Guard và Loop Guard N14, Private VLAN D02. Phân vùng bằng VLAN hoặc SGT, xem s36.',
      ], [], [], DSC(10, 11, 12)),
      T('2.4–2.7', 'Quản trị và làm cứng thiết bị', [
        'Quản lý từng thiết bị hay nhiều thiết bị, in-band hay out-of-band, tại chỗ hay qua Security Cloud Control. Nhiều firewall thì nên quản lý tập trung để không lệch chính sách.',
        'CIS Benchmarks là danh sách kiểm tra làm cứng cho IOS XE, FTD. Lab S04, S06 làm và kiểm toán việc này.',
        'AAA: TACACS+ TCP 49 mã hoá cả gói, tách authorization từng lệnh; RADIUS UDP 1812/1813, chỉ mã hoá mật khẩu, hợp cho truy cập mạng. Xử lý ở lab E08, N17. Lỗi hay gặp: sai secret, chặn cổng, thứ tự method list.',
        'Quản lý an toàn: SNMPv3 authPriv (N05), NETCONF, RESTCONF (E07), syslog qua TLS, NTP có xác thực, CoPP (E09).',
      ], [], [], DSC(13, 14, 15, 16)),
      T('2.8–2.10', 'Cisco Secure Firewall (FTD)', [
        'Access control policy xét theo thứ tự, gắn AVC, lọc URL, malware và intrusion policy cho từng quy tắc. Cấu hình qua FMC hoặc FDM, Lab không mô phỏng được.',
        'FTD chạy site-to-site, remote access cho Secure Client. Tra lỗi: pha 1 sai tham số IKE hoặc PSK, pha 2 sai dải bảo vệ, NAT nhầm làm ảnh hưởng lưu lượng VPN, chặn UDP 500 và 4500. Lệnh show crypto ikev2 sa, show crypto ipsec sa.',
      ], [], [], DSC(17, 18, 19)),
      T('3.1–3.7', 'Bảo mật cloud', [
        'Trách nhiệm chia sẻ: nhà cung cấp lo phần dưới, khách lo dữ liệu và danh tính. IaaS khách lo nhiều nhất, SaaS ít nhất (NIST 800-145). CASB kiểm soát việc dùng SaaS.',
        'Multicloud Defense kiểm tra lưu lượng ở cloud, Secure Workload phân vùng nhỏ theo workload. eBPF chạy mã an toàn trong nhân Linux để quan sát và lọc mà không sửa ứng dụng.',
        'Splunk nhận log cloud qua HTTP Event Collector hoặc add-on, chỉnh sourcetype để tìm được.',
        'DevSecOps: quét IaC, ảnh container và thư viện trong CI/CD, không để khoá trong mã, cấp quyền tối thiểu cho container và nơi điều phối.',
      ], [], [], DSC(20, 21, 22, 23, 24, 25)),
      T('4.1–4.5', 'Secure Service Edge', [
        'SSE gồm web gateway, CASB, ZTNA, firewall dịch vụ trên cloud. SASE là SSE cộng với SD-WAN.',
        'Cisco Secure Access: Secure Internet Access kiểm soát đi Internet, Secure Private Access cho vào ứng dụng nội bộ theo từng ứng dụng thay vì cả mạng. Không có trong Lab.',
        'DLP chặn dữ liệu nhạy cảm đi ra, AI guardrails kiểm soát prompt và kết quả khi dùng công cụ AI. Investigate cho điểm rủi ro và chỉ báo của domain, IP, dùng để hỗ trợ quyết định chứ không chỉ dựa vào một con số.',
      ], [], [], DSC(26, 27, 28, 29, 30)),
      T('5.1–5.7', 'Endpoint và email', [
        'EPP chặn trước khi chạy, EDR ghi lại hành vi để phát hiện và phản ứng sau. MDM quản lý cấu hình, ứng dụng. Posture kiểm tra vá lỗi, mã hoá ổ đĩa, antivirus trước khi cho vào mạng.',
        'Secure Client là phần mềm trên máy gồm VPN và các module. Malware Analytics chạy file trong sandbox. Secure Endpoint dùng danh sách chặn, outbreak control, và theo dõi lại khi file đổi kết luận.',
        'Đọc sự kiện phát hiện: máy nào, file, hash, tiến trình cha, đã cách ly chưa. Sau đó tìm hash đó ở các máy khác. Security Email Threat Defense quét thư bằng API hoặc journal, không đổi MX.',
      ], [], [], DSC(31, 32, 33, 34, 35, 36, 37)),
      T('6.1–6.4', 'Truy cập mạng với ISE', [
        '802.1X có ba vai: supplicant, authenticator (switch, WLC), server (ISE). MAB dùng MAC làm danh tính cho máy không có supplicant, nên kết hợp profiling vì MAC dễ giả.',
        'ISE thêm guest, profiling, posture, BYOD. Trả về VLAN, ACL, SGT theo kết quả. Xem WLSI và lab W03 phần RADIUS.',
        'CoA cho phép ISE đổi quyền của phiên đang chạy, ví dụ sau khi qua posture. Cổng UDP 1700 hoặc 3799 tuỳ hãng, chú ý nếu có firewall ở giữa.',
      ], [], [], DSC(38, 39, 40)),
      T('6.5–6.8', 'Rò rỉ dữ liệu, XDR, Duo, Splunk', [
        'Rò rỉ qua DNS tunneling, HTTPS, email, SCP, ICMP, NTP, cloud storage. Dấu hiệu: tên DNS dài và lạ, dung lượng ra bất thường, đích mới. Đặt mức nền để so sánh.',
        'SIEM gom và tương quan log, SOAR tự động xử lý, XDR nối dữ liệu từ endpoint, mạng, email, cloud. Splunk dùng cho cả SIEM và SOAR, Cisco XDR gom sự cố.',
        'Duo: MFA, Device Trust, kiểm tra sức khoẻ, Adaptive Access theo rủi ro, SSO, Trust Monitor báo đăng nhập bất thường, CII phân tích danh tính.',
      ], [], [], DSC(41, 42, 43, 44)),
      T('Đề chọn', 'Đề chuyên sâu của nhánh (chọn một)', [
        'SNCF 300-710 v1.2: Secure Firewall và FMC. SISE 300-715 v1.2: ISE. SSCA 300-740 v2.0: truy cập cloud an toàn, Duo, SSE, ZTNA. SDSI 300-745: thiết kế hạ tầng bảo mật. Theo trang CCNP Security.',
        'Stage này chỉ đi theo số mục của SCOR, chưa đi chi tiết các đề chọn. Các nền tảng trên không mô phỏng được trong Lab.',
      ]),
    ],
  },
  {
    id: 'dccor', name: 'CCNP Data Center DCCOR 350-601 v1.2 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1–1.3', 'NX-OS: định tuyến, chuyển mạch, overlay', [
        'NX-OS bật từng tính năng bằng feature, ví dụ feature ospf, feature vpc. OSPF (s07, s18), MP-BGP (R15), PIM (s33), HSRP (s13). Lab chạy cú pháp IOS, NX-OS khác một số lệnh.',
        'vPC: hai switch hiện ra như một với máy đấu LACP, cần peer-keepalive (tốt nhất qua đường riêng) và peer-link. Không có STP chặn cổng trên port-channel đó. LACP ở lab A24, RSTP ở kịch bản s19.',
        'VXLAN mở rộng L2 qua L3, EVPN học MAC và IP bằng BGP thay cho flood: xem s30, s31. Trung tâm dữ liệu dùng spine-leaf, VTEP nằm trên leaf.',
      ], [], [], DDC(1, 2, 3, 4, 5, 6, 7)),
      T('1.4–1.6', 'ACI, luồng gói, mô hình cloud', [
        'APIC là controller, spine-leaf là fabric, policy là tenant, VRF, bridge domain, EPG, contract. Dựng fabric: discovery leaf và spine, đặt TEP pool. Không mô phỏng được trong Lab.',
        'Access policies nối vật lý với logic: VLAN pool, domain, AAEP, interface policy group và profile. Khi cổng không lên VLAN mong muốn thì lần theo chuỗi này. VMM kết nối APIC với hypervisor như vCenter để tự cấp port group.',
        'Phân tích luồng: unicast theo bảng MAC và route, multicast theo cây và RPF, broadcast bị flood trong VLAN hoặc bridge domain. Dùng kịch bản s03, s33 để nắm ý.',
        'Cloud theo NIST 800-145: IaaS, PaaS, SaaS và public, private, hybrid, community.',
      ], [], [], DDC(8, 9, 10, 11, 12)),
      T('1.7–1.11', 'Cập nhật, cấu hình, giám sát, Nexus Dashboard', [
        'ISSU nâng cấp không gián đoạn khi nền tảng hỗ trợ, nếu không phải reload. EPLD là firmware phần cứng, thường có gián đoạn. Patch vá riêng lỗi không cần cả image. Đọc bảng tác động trước khi chạy.',
        'Quản lý cấu hình: checkpoint và rollback trên NX-OS, sao lưu và config diff.',
        'Giám sát: NetFlow (E04), SPAN (E05), streaming telemetry đẩy dữ liệu thay vì polling (R19 làm trên IOS XE). Nexus Dashboard gom các dịch vụ như Insights, Orchestrator, Fabric Controller, phát hiện bất thường bằng AI.',
      ], [], [], DDC(13, 14, 15, 16, 17)),
      T('2.1–2.6', 'Compute: UCS', [
        'C-Series rack server chạy độc lập qua CIMC hoặc do Fabric Interconnect quản lý. B-Series là blade trong chassis, IOM nối tới Fabric Interconnect, thường một cặp A và B để dự phòng.',
        'Service profile tách danh tính máy chủ khỏi phần cứng: pool MAC, WWN, UUID, boot policy, vNIC và vHBA. Template sinh nhiều profile giống nhau, đổi blade không cần đổi cấu hình.',
        'SAN trong UCS: VSAN, zoning, WWN pool, SAN policy. Server pool và boot policy chọn cách máy khởi động, ví dụ boot từ SAN.',
        'UCS X-Series chạy Intersight Managed Mode, quản lý từ cloud bằng policy và profile. Khác UCS Manager ở chỗ cấu hình nằm trên Intersight.',
        'Cập nhật firmware theo gói, chú ý thứ tự và lúc reboot máy chủ. Sao lưu: full state, all configuration. Giám sát qua SPAN và Intersight. Lab không có UCS.',
      ], [], [], DDC(18, 19, 20, 21, 22, 23, 24, 25, 26)),
      T('3.1–3.4', 'Storage Network', [
        'FC là mạng SAN không mất gói. Switch bầu principal switch, cấp domain ID, máy chủ FLOGI để lấy FCID 24 bit (domain, area, port). FCNS là danh bạ của fabric. Device alias đặt tên dễ đọc cho WWN, CFS phân phối cấu hình trong fabric.',
        'VSAN giống VLAN cho FC. Zoning giới hạn initiator nào thấy target nào, thường zone single-initiator. Port channel gộp liên kết ISL.',
        'NPV làm switch biên không nhận domain ID, chuyển tiếp login lên core. NPIV cho nhiều login trên một cổng, hay dùng với máy ảo.',
        'NFS chia file, iSCSI chạy khối qua TCP 3260, trên Ethernet thường. Cập nhật SAN và EPLD có thể gián đoạn, nên làm từng fabric để máy chủ còn đường kia. Giám sát qua SPAN và Nexus Dashboard. Lab không có FC.',
      ], [], [], DDC(27, 28, 29, 30, 31, 32, 33, 34)),
      T('4.1, 4.2', 'Tự động hoá', [
        'Trên thiết bị: EEM (lab E10), scheduler chạy theo giờ, Bash và Guest Shell, Python ngay trên switch. NX-API nhận REST bằng JSON hoặc XML. Xem cách đọc API ở lab E07.',
        'Ngoài thiết bị: Ansible (N21) chạy theo playbook, Terraform khai báo trạng thái và có state, POAP cho switch mới tự tải cấu hình, NDFC quản lý fabric, PowerShell hay dùng với UCS và Windows, Intersight có API.',
      ], [], [], DDC(35, 36, 37, 38, 39, 40)),
      T('4.3', 'Mạng cho AI', [
        'Huấn luyện AI cần nhiều GPU trao đổi với độ trễ thấp và không mất gói. RoCEv2 chạy RDMA trên Ethernet, cần PFC để dừng theo lớp và ECN để báo nghẽn sớm. Thiết kế không nghẽn, tải chia đều trên spine-leaf.',
      ], [], [], DDC(41)),
      T('5.1–5.3', 'Bảo mật', [
        'AAA và RBAC cho mạng, compute, storage: tách vai trò, dùng RADIUS hoặc TACACS+. Làm AAA ở lab E08.',
        'ACI mặc định chặn giữa các EPG, chỉ thông khi có contract. Microsegmentation chia EPG theo thuộc tính máy. Ý tưởng cô lập trong VLAN ở lab D02.',
        'First-hop security: DHCP snooping S01, DAI S02, RA Guard N16. Keychain đổi khoá xác thực định tuyến theo lịch, MACsec mã hoá từng chặng ở L2.',
        'Storage: port security của FC khoá WWN vào cổng, fabric binding giới hạn switch được vào fabric.',
      ], [], [], DDC(42, 43, 44, 45, 46)),
      T('Đề chọn', 'Đề chuyên sâu của nhánh (chọn một)', [
        'DCID 300-610 v1.2: thiết kế. DCIT 300-615 v1.2: chẩn đoán. DCACI 300-620 v1.2: ACI. DCNAUTO 300-635 v2.0: tự động hoá. DCAI 300-640: hạ tầng AI. Theo trang CCNP Data Center.',
        'Stage này chỉ đi theo số mục của DCCOR, chưa đi chi tiết các đề chọn. NX-OS, ACI, UCS, FC không mô phỏng được trong Lab.',
      ]),
    ],
  },
  {
    id: 'spcor', name: 'CCNP Service Provider SPCOR 350-501 v1.1 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1–1.3', 'Kiến trúc nhà mạng, phần mềm, ảo hoá', [
        'Lõi: Metro Ethernet, MPLS, Unified MPLS, SR, SRv6. Truy cập: xDSL, DOCSIS, xPON, TDM; DWDM mang nhiều bước sóng trên sợi. Di động: packet core, xhaul nối RAN, vRAN và ORAN. Routed optical gắn quang vào router, giảm một lớp thiết bị.',
        'IOS nguyên khối, IOS XE chạy trên Linux có tiến trình tách biệt, IOS XR đa tiến trình cho router lớn. XR cấu hình theo commit, đổi xong mới áp dụng và rollback được. Lab chạy cú pháp IOS.',
        'NFV đưa chức năng mạng lên máy chủ chung: NFVI là hạ tầng, VNF là ứng dụng. Container nhẹ hơn máy ảo. Application hosting chạy ứng dụng ngay trên router.',
      ], [], [], DSP(1, 2, 3, 4, 5)),
      T('1.4', 'Kiến trúc QoS', [
        'DiffServ xử lý theo từng chặng bằng dấu (s20, s25), IntServ đặt trước bằng RSVP. Biên tin cậy thường nằm tại PE, nơi nhà mạng đánh dấu lại theo hợp đồng.',
        'MPLS: Uniform dùng chung một miền, Pipe xử lý ở egress theo dấu nhà mạng, Short Pipe xử lý ở egress theo dấu khách. EXP nằm trong nhãn.',
        'TE: DS-TE đặt trước băng thông theo lớp, mô hình MAM và RDM chia băng thông. CBTS chọn hầm theo lớp, PBTS theo chính sách. IPv6 có flow label để chia luồng.',
      ], [], [], DSP(6, 7)),
      T('1.5–1.7', 'Bảo vệ ba mặt phẳng', [
        'Control plane: CoPP (lab E09), LPTS trên XR, GTSM kiểm TTL BGP, xác thực giao thức (R08), lọc nhãn LDP. BGPsec ký đường đi AS. Flowspec phát quy tắc lọc qua BGP.',
        'Management plane: AAA, TACACS+ (E08), bảo vệ REST API, truy vết nguồn tấn công, phòng DDoS.',
        'Data plane: uRPF (R10), ACL (A10), MACsec. RTBH phát route tới null để bỏ gói tới một IP bị tấn công, đồng thời mất luôn IP đó.',
      ], [], [], DSP(8, 9, 10, 11, 12, 13)),
      T('2.1, 2.2', 'IS-IS và OSPF', [
        'IS-IS cấu trúc L1, L2, L1/L2 và NET xem nhóm ENSLD. Hai họ địa chỉ IPv4 và IPv6 có thể chung cây hoặc bật multitopology khi hai họ có đường khác nhau. Nhà mạng dùng wide metric cho cổng nhanh. Lab không có IS-IS.',
        'OSPF: bắt tay và DR ở s07, nhiều area và LSA ở s18, area types ở R03, OSPFv3 ở R18 và s27.',
      ], [], [], DSP(14, 15, 16)),
      T('2.3–2.5', 'BGP và chính sách', [
        'Chọn đường theo thứ tự rút gọn: weight, local-pref, local origin, AS path, origin, MED, eBGP trước iBGP, IGP metric, router ID. Thử ở lab R07.',
        'iBGP cần RR (R08), IPv6 dùng address family (R15). Additional Paths gửi nhiều đường để hội tụ nhanh và chia tải. PIC cài sẵn đường dự phòng để không phải tính lại từng prefix.',
        'IOS XE dùng route-map (R01), IOS XR dùng RPL, viết thành policy có tham số dễ dùng lại.',
      ], [], [], DSP(17, 18, 19, 20)),
      T('2.6–2.8', 'Chẩn đoán, IPv6, HA', [
        'Không lên láng giềng: so MTU, area, level, tham số, ACL. BGP kẹt Active là chưa TCP. Có láng giềng mà thiếu route: xem chính sách, next-hop, redistribute. Lab R13.',
        'Chuyển IPv4: NAT44 và CGNAT dùng chung địa chỉ công cộng, NAT64 cho máy IPv6 vào IPv4, DS-Lite gửi IPv4 trong hầm IPv6 về CGN, MAP-T dịch ở CPE và biên mà nhà mạng không giữ trạng thái từng luồng.',
        'NSF giữ chuyển tiếp nhờ láng giềng hỗ trợ, NSR không cần láng giềng biết. BFD báo đứt nhanh: lab R12, s39. Gộp link: LACP ở A24.',
      ], [], [], DSP(21, 22, 23, 24)),
      T('3.1', 'MPLS', [
        'Xem s29 về nhãn, s34 về LDP. LDP-IGP sync giữ IGP không chọn link khi LDP chưa sẵn sàng, session protection giữ phiên LDP khi link đứt tạm.',
        'Unified MPLS chia miền lớn thành nhiều vùng, nối LSP qua các vùng bằng BGP mang nhãn. MPLS OAM kiểm tra bằng lsp ping và lsp traceroute, thấy được lỗi mà ping IP không thấy.',
      ], [], [], DSP(25, 26)),
      T('3.2, 3.3', 'Traffic engineering và Segment Routing', [
        'TE dùng IS-IS, OSPF quảng bá băng thông link, RSVP đặt trước đường và cấp nhãn. FRR có sẵn đường vòng qua link hoặc node hỏng, chuyển trong khoảng 50 ms.',
        'SR đưa đường đi vào chồng nhãn, lõi không giữ trạng thái: s32. Prefix SID theo đích, adjacency SID theo link. Quảng bá bằng IS-IS, OSPF, BGP.',
        'SR-TE chọn đường bằng policy. TI-LFA tính sẵn đường vòng cho mọi link. PCE tính đường tập trung, PCC là router đầu vào. Flexible algorithm tạo mặt phẳng theo tiêu chí riêng như trễ thấp.',
        'SRv6 mã hoá lệnh trong địa chỉ IPv6: locator là phần định tuyến. Micro-segment rút gọn tiêu đề, interworking gateway nối sang miền SR-MPLS.',
      ], [], [], DSP(27, 28, 29, 30, 31, 32, 33)),
      T('4.1–4.3', 'VPN và Carrier Ethernet', [
        'L3VPN: RD làm route duy nhất, RT quyết định VRF nhận route, xem s34 và VRF ở E01. Shared services dùng RT nhập xuất chéo để mở dịch vụ chung, cũng dùng để ra Internet.',
        'EVPN thay flood bằng BGP: s31. Inter-AS option A dùng VRF liền nhau, B đổi VPNv4 ở biên, C dùng multihop giữa RR. CSC là nhà mạng mua MPLS của nhà mạng khác. mVPN chở multicast khách qua lõi.',
        'E-Line điểm tới điểm, E-LAN nhiều điểm, E-Tree có gốc và lá, E-Access mua truy cập qua hãng khác. 802.1ad là QinQ, 802.1ah là MAC-in-MAC, G.8032 chống lặp cho vòng Ethernet. OAM kiểm tra bằng CFM. VLAN tag được push, pop hoặc translate ở cổng dịch vụ.',
      ], [], [], DSP(34, 35, 36, 37, 38, 39, 40)),
      T('4.4, 4.5', 'Multicast và QoS dịch vụ', [
        'PIM-SM, SSM, BIDIR và IGMP đọc ở s33. MLD là IGMP của IPv6.',
        'Phân loại, đánh dấu, RED chống nghẽn, policing cắt, shaping làm trễ để gọn. Làm policy-map ở E11.',
      ], [], [], DSP(41, 42)),
      T('5.1–5.6', 'API, YANG, NSO, ZTP', [
        'Thiết bị lộ API: NETCONF, RESTCONF, gRPC. Đọc script REST bắt đầu từ URL, header, thân JSON. Thực hành E07, xem nhóm ENAUTO về YANG.',
        'NSO có CDB, dùng mô hình dịch vụ YANG và NED nói chuyện với nhiều hãng, có dry-run và rollback. Ansible chạy thủ tục (N21), Terraform so sánh với state.',
        'Secure ZTP thêm kiểm tra cả hai chiều bằng chứng chỉ khi thiết bị mới tự lên cấu hình, tránh nhận cấu hình giả.',
      ], [], [], DSP(43, 44, 45, 46)),
      T('5.7–5.10', 'Telemetry và giám sát', [
        'Dial-out là thiết bị gọi collector, dial-in là collector mở phiên tới. gNMI chạy trên gRPC, mTLS xác thực cả hai đầu. Lab R19 có telemetry trên IOS XE.',
        'NetFlow và IPFIX: lab E04. NETCONF, RESTCONF: E07. SNMPv2c ở N04, v3 ở N05.',
      ], [], [], DSP(47, 48, 49)),
      T('Đề chọn', 'Đề chuyên sâu của nhánh (chọn một)', [
        'SPRI 300-510 v1.1: định tuyến nâng cao. SPVI 300-515 v1.1: VPN. SPCNI 300-540 v1.0: hạ tầng cloud và ảo hoá. Theo trang CCNP Service Provider.',
        'Stage này chỉ đi theo số mục của SPCOR, chưa đi chi tiết các đề chọn. IOS XR, IS-IS, SR, TE, EVPN không có trong Lab CLI, phần gói tin xem các kịch bản đã nêu.',
      ]),
    ],
  },
  {
    id: 'clcor', name: 'CCNP Collaboration CLCOR 350-801 v2.0 (không tính tiến độ CCNA)', weight: 0, optional: true,
    topics: [
      T('1.1–1.3', 'Thiết kế và thiết bị biên', [
        'CSR và Preferred Architecture là tài liệu thiết kế tham chiếu của Cisco. Xét loại triển khai, số người dùng, băng thông, codec, HA, khôi phục thảm hoạ, kế hoạch số, bảo mật, QoS.',
        'G.711 khoảng 64 kbps tải thoại, G.729 khoảng 8 kbps, Opus linh hoạt. Tính băng thông phải cộng thêm IP, UDP, RTP và L2.',
        'Expressway nối thiết bị ngoài Internet không cần VPN và business-to-business. CUBE là SBC nối SIP trunk nhà mạng, tách hai bên về tín hiệu và media.',
        'Nâng cấp cụm CUCM: chạy publisher trước, rồi subscriber, chuyển phiên bản theo thứ tự tương tự và kiểm tra đồng bộ sau khi xong.',
      ], [], [], DCL(1, 2, 3, 4, 5, 6)),
      T('1.4, 1.5', 'Chẩn đoán bảo mật và mạng nền', [
        'Bảo mật: SSO kiểm tra đồng hồ và metadata, chứng chỉ X.509 kiểm tra chuỗi và tên, OAuth kiểm tra token, TLS xem handshake, SRTP mã hoá media và cần khoá khớp hai đầu.',
        'Mạng nền: DNS A/AAAA, SRV, PTR (bản ghi ở N09), NTP lệch thì chứng chỉ và log sai, LDAP đồng bộ người dùng, DHCP cấp option 150 cho TFTP, CDP/LLDP báo voice VLAN (N01, N11).',
      ], [], [], DCL(7, 8, 9, 10)),
      T('2.1–2.3', 'Máy đầu cuối và SIP', [
        'Thêm thiết bị: thủ công, self-provisioning, bulk, mã kích hoạt, Webex App. Đề ghi rõ không gồm Skinny và Jabber.',
        'SIP: xem kịch bản s40. INVITE, 180, 200, ACK, BYE. SDP đề xuất codec, IP, cổng. Giữ máy gửi re-INVITE đổi hướng media, chuyển dùng REFER.',
        'DTMF theo RFC 2833/4733 đi trong RTP với payload riêng. Một đầu dùng cách khác thì mất phím, cần MTP hoặc đổi cấu hình. Lỗi đăng ký: sai user, tài khoản chưa gán, lỗi chứng chỉ, sai DNS.',
      ], [], [], DCL(11, 12, 13, 14, 15, 16, 17)),
      T('3.1–3.3', 'Định tuyến cuộc gọi trên CUCM', [
        'Chuỗi: gọi vào, phân tích số, chọn theo partition mà CSS được nhìn thấy, route pattern, route list, route group, thiết bị. Khớp nhất thì thắng.',
        'Dùng +E.164 để gom số về một dạng. Translation pattern đổi số trước khi tìm tiếp, transformation đổi số trước khi gửi. Local route group chọn cổng địa phương theo máy gọi.',
        'Time-of-day giới hạn theo giờ, FAC yêu cầu mã khi gọi đắt, urgent priority không chờ thêm số. Chống toll fraud: CSS chặt chẽ, chặn trunk ra trunk, chặn gọi quốc tế không cần thiết.',
      ], [], [], DCL(18, 19, 20, 21, 22, 23, 24)),
      T('3.4–3.7', 'Công cụ, API, Unity, người dùng', [
        'Tra kế hoạch số bằng Dialed Number Analyzer, RTMT, trace. API (đề ghi USM APIs): AXL cấu hình bằng SOAP, UDS cho người dùng, CTI cho điều khiển cuộc gọi. Xem loại, cách xác thực và việc làm được.',
        'Unity Connection: hộp thư, đèn MWI, call handler, routing rule, tích hợp CUCM bằng SIP trunk.',
        'Người dùng: đồng bộ và xác thực qua LDAP, phân quyền RBAC.',
      ], [], [], DCL(25, 26, 27, 28, 29)),
      T('4.1–4.3', 'Voice gateway và CUBE', [
        'Dial peer VoIP và POTS khớp theo hướng vào hoặc ra, voice translation rule đổi số, voice class codec đặt thứ tự ưu tiên, dtmf-relay rtp-nte theo RFC 2833.',
        'Dự phòng: voice class server-group, SIP OPTIONS keepalive, DNS SRV. Chẩn đoán: show dial-peer voice summary, debug voip dialpeer, SIP profile, tenant.',
        'Media resources: conference, transcoder, MTP, MoH dùng DSP hoặc phần mềm trên IOS XE. Lab không có CUCM, CUBE.',
      ], [], [], DCL(30, 31, 32, 33, 34, 35)),
      T('5.1–5.4', 'Webex Calling', [
        'Webex Suite gồm gọi, họp, nhắn tin. Control Hub là nơi quản trị.',
        'Khai location, số, trunk, route group, dial plan, translation pattern, operating modes và call permissions. Local Gateway hoặc CCP nối ra PSTN. Chống toll fraud: giới hạn quyền gọi, chặn trên CUBE bằng danh sách IP tin cậy.',
      ], [], [], DCL(36, 37, 38, 39, 40)),
      T('5.5–5.10', 'Họp, tin nhắn, API, hybrid', [
        'Cấu hình cuộc họp và tin nhắn trên Control Hub: mẫu, chính sách, lưu trữ, bảo mật. Cloud APIs dùng OAuth, webhook gọi về URL của bạn khi có sự kiện (kiểu dùng xem nhóm ENAUTO).',
        'Directory Connector đẩy người dùng AD lên cloud, SCIM là cách chuẩn, RBAC chia vai trò quản trị. Cloud Connected UC đưa số liệu CUCM lên Control Hub.',
        'Hybrid Services nối hệ thống tại chỗ với cloud, ví dụ lịch, Video Mesh, bảo mật dữ liệu.',
      ], [], [], DCL(41, 42, 43, 44)),
      T('6.1–6.4', 'Media và QoS', [
        'Một chiều thường do route hoặc NAT cho RTP. Rè là mất gói hoặc jitter. Ô vuông trên video là thiếu băng thông. Đo jitter và MOS ở lab R19.',
        'Thoại EF, video AF41, báo hiệu CS3. Wi-Fi ánh xạ sang WMM, xem nhóm WLSI. Biên tin cậy đặt ở cổng switch nối điện thoại, nơi không tin PC phía sau (N11).',
        'LLQ: class-map, policy-map có priority, service-policy trên cổng. Làm ở E11, xem s20 và s25.',
      ], [], [], DCL(45, 46, 47)),
      T('Đề chọn', 'Đề chuyên sâu của nhánh (chọn một)', [
        'CLACC 300-815 v2.0: điều khiển cuộc gọi nâng cao. CLHCT 300-820: hybrid và cloud. CLCCE 300-830 v1.0: Webex Contact Center. Theo trang CCNP Collaboration.',
        'Stage này chỉ đi theo số mục của CLCOR, chưa đi chi tiết các đề chọn. CUCM, Unity, Webex không mô phỏng được, SIP và RTP có ở kịch bản s40.',
      ]),
    ],
  },
];
