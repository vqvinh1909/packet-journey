// lab/cheat-ref.js — phần "📘 Tra cứu" của Cheat sheet: bảng kiến thức CCNA/CCNP và hỏi đáp phỏng vấn, viết bằng chữ
// để tìm kiếm và in được. Cột đầu tên "Lệnh" sẽ hiện dạng mã. Ảnh gốc nằm ngoài repo, xem REF_IMAGES.

const S = (topic, title, cols, rows, note) => ({ topic, title, cols, rows, note });
const CMD = ['Lệnh', 'Tác dụng'];
const QA = ['Câu hỏi', 'Trả lời'];

const IMG_DIR = '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/';
export const REF_IMAGES = [
  ['photo_2026-06-20_10-50-07.jpg', 'Sơ đồ mạng doanh nghiệp'],
  ['photo_2026-06-20_11-44-15.jpg', 'CCNA 1/10'], ['photo_2026-06-20_11-44-16.jpg', 'CCNA 2/10'],
  ['photo_2026-06-20_11-44-17.jpg', 'CCNA 3/10'], ['photo_2026-06-20_11-44-18.jpg', 'CCNA 4/10'],
  ['photo_2026-06-20_11-44-19.jpg', 'CCNA 5/10'], ['photo_2026-06-20_11-44-20.jpg', 'CCNA 7/10'],
  ['photo_2026-06-20_11-44-21.jpg', 'CCNA 9/10'], ['photo_2026-06-20_11-44-22.jpg', 'CCNA 10/10'],
  ['interview1.jpg', 'Phỏng vấn: bìa'], ['interview2.jpg', 'Phỏng vấn: câu 1–20'], ['interview3.jpg', 'Phỏng vấn: câu 21–45'],
  ['interview4.jpg', 'Phỏng vấn: câu 45–60'], ['interview5.jpg', 'Phỏng vấn: câu 61–80'], ['interview6.jpg', 'Phỏng vấn: câu 81–100'],
].map(([file, label]) => ({ path: IMG_DIR + file, label }));

export const CHEAT_REF = [
  // ---------- Nền tảng ----------
  S('Nền tảng', 'Mô hình OSI', ['Tầng', 'Tên', 'Nhiệm vụ', 'Ví dụ'], [
    ['7', 'Application', 'Dịch vụ cho ứng dụng', 'HTTP, DNS, SMTP'],
    ['6', 'Presentation', 'Định dạng, mã hoá, nén', 'TLS, JPEG'],
    ['5', 'Session', 'Quản lý phiên', 'NetBIOS, RPC'],
    ['4', 'Transport', 'Đầu cuối đến đầu cuối, cổng', 'TCP, UDP'],
    ['3', 'Network', 'Địa chỉ logic, định tuyến', 'IP, ICMP, OSPF'],
    ['2', 'Data Link', 'Địa chỉ MAC, chuyển mạch', 'Ethernet, 802.1Q'],
    ['1', 'Physical', 'Bit, cáp, tín hiệu', 'RJ45, cáp quang'],
  ]),
  S('Nền tảng', 'Mô hình TCP/IP', ['Tầng', 'Giao thức'], [
    ['Application', 'HTTP, DNS, DHCP, SSH, SNMP'], ['Transport', 'TCP, UDP'], ['Internet', 'IPv4, IPv6, ICMP'], ['Network Access', 'Ethernet, Wi-Fi, ARP'],
  ], 'ARP thường được xếp giữa tầng 2 và tầng 3 của OSI.'),
  S('Nền tảng', 'TCP và UDP', ['Tiêu chí', 'TCP', 'UDP'], [
    ['Kết nối', 'Có, bắt tay 3 bước', 'Không'], ['Tin cậy', 'ACK, gửi lại, đúng thứ tự', 'Không đảm bảo'],
    ['Điều khiển luồng', 'Có, dùng window', 'Không'], ['Header', '20–60 byte', '8 byte'],
    ['Dùng cho', 'Web, email, truyền file, SSH', 'DNS, VoIP, video, TFTP, DHCP'],
  ]),
  S('Nền tảng', 'Cổng thường gặp', ['Cổng', 'Dịch vụ', 'Giao thức'], [
    ['20/21', 'FTP dữ liệu/điều khiển', 'TCP'], ['22', 'SSH, SCP, SFTP', 'TCP'], ['23', 'Telnet', 'TCP'], ['25', 'SMTP', 'TCP'],
    ['49', 'TACACS+', 'TCP'], ['53', 'DNS', 'UDP, TCP'], ['67/68', 'DHCP server/client', 'UDP'], ['69', 'TFTP', 'UDP'],
    ['80', 'HTTP', 'TCP'], ['110', 'POP3', 'TCP'], ['123', 'NTP', 'UDP'], ['143', 'IMAP', 'TCP'],
    ['161/162', 'SNMP truy vấn/trap', 'UDP'], ['179', 'BGP', 'TCP'], ['389', 'LDAP', 'TCP'], ['443', 'HTTPS', 'TCP'],
    ['500/4500', 'IKE, NAT-T', 'UDP'], ['514', 'Syslog', 'UDP'], ['520', 'RIP', 'UDP'], ['546/547', 'DHCPv6 client/server', 'UDP'],
    ['1812/1813', 'RADIUS xác thực/kế toán', 'UDP'], ['1985', 'HSRP', 'UDP'], ['3784', 'BFD', 'UDP'], ['4789', 'VXLAN', 'UDP'],
  ]),
  S('Nền tảng', 'Số giao thức IP và EtherType', ['Giá trị', 'Ý nghĩa'], [
    ['IP 1', 'ICMP'], ['IP 2', 'IGMP'], ['IP 6', 'TCP'], ['IP 17', 'UDP'], ['IP 47', 'GRE'], ['IP 50', 'ESP'], ['IP 51', 'AH'], ['IP 88', 'EIGRP'], ['IP 89', 'OSPF'], ['IP 112', 'VRRP'],
    ['0x0800', 'IPv4'], ['0x0806', 'ARP'], ['0x8100', 'Thẻ 802.1Q'], ['0x86DD', 'IPv6'], ['0x8847', 'MPLS'],
  ]),
  S('Nền tảng', 'Khung Ethernet', ['Trường', 'Byte', 'Ý nghĩa'], [
    ['Preamble', '7', 'Đồng bộ'], ['SFD', '1', 'Báo bắt đầu khung (10101011)'], ['MAC đích', '6', 'Nơi nhận'], ['MAC nguồn', '6', 'Nơi gửi'],
    ['Type/Length', '2', 'Giao thức bên trong hoặc độ dài'], ['Data', '46–1500', 'Dữ liệu'], ['FCS', '4', 'Kiểm tra lỗi CRC'],
  ]),
  S('Nền tảng', 'Địa chỉ MAC', ['Mục', 'Chi tiết'], [
    ['Độ dài', '48 bit, viết bằng hệ 16'], ['24 bit đầu', 'OUI, mã nhà sản xuất'], ['24 bit sau', 'Mã riêng của thiết bị'],
    ['Bit thấp nhất của byte đầu', '0 là unicast, 1 là multicast'], ['Broadcast', 'FF:FF:FF:FF:FF:FF'],
    ['Multicast IPv4', '01:00:5E:…'], ['Multicast IPv6', '33:33:…'],
  ]),
  S('Nền tảng', 'Loại thiết bị và cáp', ['Tên', 'Dùng khi'], [
    ['Hub', 'Lặp tín hiệu tầng 1, một miền đụng độ'], ['Switch', 'Chuyển khung theo MAC, tầng 2'], ['Router', 'Chuyển gói giữa các mạng, tầng 3'],
    ['Firewall', 'Lọc lưu lượng theo chính sách'], ['Access Point', 'Nối thiết bị không dây vào mạng có dây'],
    ['Cáp thẳng', 'Khác loại: PC với switch, router với switch'], ['Cáp chéo', 'Cùng loại: switch với switch. Auto-MDIX tự xử lý trên thiết bị mới'],
    ['Cáp console', 'PC vào cổng console của thiết bị'], ['Cáp quang', 'Khoảng cách xa, tốc độ cao, chống nhiễu'],
  ]),
  S('Nền tảng', 'Quá trình gói đi từ đầu đến cuối', ['Bước', 'Việc xảy ra'], [
    ['1', 'Máy so IP đích với subnet của mình. Khác mạng thì gửi cho gateway'], ['2', 'Máy dùng ARP tìm MAC của gateway'],
    ['3', 'Switch học MAC nguồn, tra MAC đích rồi chuyển hoặc flood'], ['4', 'Router giảm TTL, tra bảng định tuyến, đổi MAC theo từng chặng'],
    ['5', 'IP nguồn và đích giữ nguyên qua các router, trừ khi có NAT'],
  ]),
  S('Nền tảng', 'Máy ảo, container và cloud', ['Tên', 'Ý nghĩa'], [
    ['Hypervisor loại 1', 'Chạy thẳng trên phần cứng: ESXi, Hyper-V, KVM'], ['Hypervisor loại 2', 'Chạy trên hệ điều hành: VMware Workstation, VirtualBox'], ['Máy ảo', 'Có hệ điều hành riêng, tách biệt mạnh, nặng hơn'], ['Container', 'Dùng chung nhân hệ điều hành, khởi động nhanh, nhẹ: Docker, Kubernetes'], ['vSwitch', 'Switch ảo nối máy ảo với cổng vật lý, cổng switch thường để trunk'],
    ['IaaS', 'Thuê máy chủ, mạng, lưu trữ'], ['PaaS', 'Thuê nền tảng để chạy ứng dụng'], ['SaaS', 'Dùng phần mềm qua mạng'], ['Public, private, hybrid', 'Cloud công cộng, riêng, hoặc kết hợp'],
  ]),
  S('Nền tảng', 'Cáp đồng, cáp quang và lỗi thường gặp', ['Mục', 'Chi tiết'], [
    ['Cáp đồng Cat5e, Cat6', '100 m, tối đa 1 Gbps. Cat6a đạt 10 Gbps ở 100 m'], ['Quang đa mode', 'Lõi lớn, cự ly ngắn trong toà nhà'], ['Quang đơn mode', 'Lõi nhỏ, cự ly xa'], ['Sơ đồ chân', 'T568A, T568B. Hai đầu giống nhau là cáp thẳng'],
    ['Collision', 'Do half duplex hoặc lệch duplex. CSMA/CD chỉ dùng ở half duplex'], ['Lệch duplex', 'Bên half có late collision, bên full có CRC và runt'], ['Lệch tốc độ', 'Cổng thường down/down vì không thương lượng được'], ['Sai loại quang', 'Module SFP và loại sợi phải khớp, kiểm tra bằng show interfaces transceiver'], ['Tín hiệu quang yếu', 'Đầu nối bẩn, cáp gãy, vượt cự ly'],
  ]),
  // ---------- Địa chỉ IP ----------
  S('Địa chỉ IP', 'Các lớp IPv4', ['Lớp', 'Octet đầu', 'Mask mặc định', 'Ghi chú'], [
    ['A', '1–126', '255.0.0.0', '16.777.214 host'], ['B', '128–191', '255.255.0.0', '65.534 host'], ['C', '192–223', '255.255.255.0', '254 host'], ['D', '224–239', 'Không có', 'Multicast'], ['E', '240–255', 'Không có', 'Thử nghiệm'],
  ]),
  S('Địa chỉ IP', 'Dải địa chỉ đặc biệt', ['Dải', 'Dùng cho'], [
    ['10.0.0.0/8', 'Riêng'], ['172.16.0.0/12', 'Riêng'], ['192.168.0.0/16', 'Riêng'], ['127.0.0.0/8', 'Loopback'], ['169.254.0.0/16', 'APIPA, khi không nhận được DHCP'],
    ['100.64.0.0/10', 'CGNAT của nhà mạng'], ['224.0.0.0/4', 'Multicast'], ['0.0.0.0/0', 'Route mặc định'],
  ]),
  S('Địa chỉ IP', 'Bảng subnet nhanh', ['Prefix', 'Mask', 'Wildcard', 'Bước nhảy', 'Host dùng được'], [
    ['/8', '255.0.0.0', '0.255.255.255', '1 (octet 1)', '16.777.214'], ['/16', '255.255.0.0', '0.0.255.255', '1 (octet 2)', '65.534'],
    ['/20', '255.255.240.0', '0.0.15.255', '16 (octet 3)', '4.094'], ['/22', '255.255.252.0', '0.0.3.255', '4 (octet 3)', '1.022'], ['/23', '255.255.254.0', '0.0.1.255', '2 (octet 3)', '510'],
    ['/24', '255.255.255.0', '0.0.0.255', '1 (octet 3)', '254'], ['/25', '255.255.255.128', '0.0.0.127', '128', '126'], ['/26', '255.255.255.192', '0.0.0.63', '64', '62'],
    ['/27', '255.255.255.224', '0.0.0.31', '32', '30'], ['/28', '255.255.255.240', '0.0.0.15', '16', '14'], ['/29', '255.255.255.248', '0.0.0.7', '8', '6'],
    ['/30', '255.255.255.252', '0.0.0.3', '4', '2'], ['/31', '255.255.255.254', '0.0.0.1', '2', '2, chỉ cho đường point-to-point'], ['/32', '255.255.255.255', '0.0.0.0', '1', '1, route host'],
  ], 'Số host = 2^(số bit host) − 2. Số subnet = 2^(số bit mượn).'),
  S('Địa chỉ IP', 'Ví dụ chia 192.168.1.0/24 thành 4 subnet /26', ['Network', 'Host đầu–cuối', 'Broadcast'], [
    ['192.168.1.0', '.1–.62', '.63'], ['192.168.1.64', '.65–.126', '.127'], ['192.168.1.128', '.129–.190', '.191'], ['192.168.1.192', '.193–.254', '.255'],
  ]),
  S('Địa chỉ IP', 'Kiểu truyền', ['Kiểu', 'Ý nghĩa'], [
    ['Unicast', 'Một đến một'], ['Broadcast', 'Một đến tất cả trong mạng, chỉ IPv4'], ['Multicast', 'Một đến một nhóm'], ['Anycast', 'Một đến nút gần nhất trong nhóm'],
  ]),
  S('Địa chỉ IP', 'Loại địa chỉ IPv6', ['Loại', 'Dải', 'Ý nghĩa'], [
    ['Global Unicast', '2000::/3', 'Định tuyến được trên Internet'], ['Link-Local', 'FE80::/10', 'Chỉ trong một đường link, tự có trên mỗi cổng'], ['Unique Local', 'FC00::/7', 'Địa chỉ riêng, thường dùng FD00::/8'],
    ['Multicast', 'FF00::/8', 'FF02::1 mọi nút, FF02::2 mọi router'], ['Solicited-node', 'FF02::1:FF00:0/104', 'Dùng cho NS thay ARP'], ['Loopback', '::1/128', 'Chính thiết bị'], ['Unspecified', '::/128', 'Khi chưa có địa chỉ'],
  ], 'Rút gọn: bỏ số 0 đầu mỗi nhóm, và thay một cụm nhóm toàn 0 bằng :: đúng một lần.'),
  S('Địa chỉ IP', 'IPv4 so với IPv6', ['Tiêu chí', 'IPv4', 'IPv6'], [
    ['Độ dài', '32 bit', '128 bit'], ['Cách viết', 'Thập phân có dấu chấm', 'Hệ 16 có dấu hai chấm'], ['Broadcast', 'Có', 'Không, dùng multicast'], ['Tìm MAC', 'ARP', 'NDP, dùng ICMPv6'], ['Tự cấu hình', 'DHCP', 'SLAAC, DHCPv6'], ['Header', '20–60 byte, có checksum', '40 byte cố định, không checksum'],
  ]),
  S('Địa chỉ IP', 'Bản tin NDP của IPv6', ['Bản tin', 'Type', 'Mục đích'], [
    ['Router Solicitation (RS)', '133', 'Máy tìm router'], ['Router Advertisement (RA)', '134', 'Router báo prefix, gateway'], ['Neighbor Solicitation (NS)', '135', 'Hỏi MAC, kiểm tra trùng địa chỉ (DAD)'], ['Neighbor Advertisement (NA)', '136', 'Trả lời NS'], ['Redirect', '137', 'Báo có router tốt hơn'],
  ]),
  S('Địa chỉ IP', 'Cấu hình IPv6', CMD, [
    ['ipv6 unicast-routing', 'Bật định tuyến IPv6'], ['ipv6 address 2001:db8:1::1/64', 'Đặt địa chỉ trên cổng'], ['ipv6 address autoconfig', 'Nhận địa chỉ bằng SLAAC'], ['ipv6 nd managed-config-flag', 'Báo máy lấy địa chỉ từ DHCPv6'],
    ['ipv6 nd other-config-flag', 'Báo máy lấy DNS từ DHCPv6'], ['ipv6 route ::/0 2001:db8:1::2', 'Route mặc định'], ['show ipv6 interface brief', 'Xem địa chỉ các cổng'], ['show ipv6 neighbors', 'Xem bảng láng giềng'],
  ]),
  S('Địa chỉ IP', 'EUI-64 kiểu modified và kích thước prefix', ['Mục', 'Chi tiết'], [
    ['Bước 1', 'Tách MAC làm đôi: 00:1A:2B | 3C:4D:5E'], ['Bước 2', 'Chèn FFFE vào giữa: 001A:2BFF:FE3C:4D5E'], ['Bước 3', 'Đảo bit thứ 7 của byte đầu: 00 thành 02'], ['Kết quả', 'Interface ID 021A:2BFF:FE3C:4D5E'], ['Lệnh', 'ipv6 address 2001:db8:1::/64 eui-64'],
    ['/128', 'Một host, thường là loopback'], ['/127', 'Đường point-to-point'], ['/64', 'Một mạng LAN, SLAAC cần đúng độ dài này'], ['/48', 'Thường cấp cho một site'],
  ]),
  S('Địa chỉ IP', 'DHCPv6 và ACL IPv6', CMD, [
    ['ipv6 dhcp pool LAN6', 'Tạo pool'], ['address prefix 2001:db8:1::/64', 'Dải cấp phát'], ['dns-server 2001:4860:4860::8888', 'DNS'], ['ipv6 dhcp server LAN6', 'Áp pool lên cổng'], ['ipv6 dhcp relay destination 2001:db8:9::5', 'Relay trên cổng phía máy khách'], ['show ipv6 dhcp binding', 'Xem địa chỉ đã cấp'],
    ['ipv6 access-list LOC6', 'Tạo ACL IPv6, luôn là ACL có tên'], ['permit tcp any any eq 443', 'Thêm quy tắc'], ['ipv6 traffic-filter LOC6 in', 'Áp lên cổng'],
  ], 'ACL IPv6 ngầm cho phép ND trước dòng deny cuối. Thêm deny ipv6 any any mà không mở ND thì sẽ mất láng giềng.'),
  // ---------- CLI ----------
  S('CLI Cisco', 'Các chế độ IOS', ['Dấu nhắc', 'Chế độ', 'Vào bằng'], [
    ['R>', 'User EXEC', 'Đăng nhập'], ['R#', 'Privileged EXEC', 'enable'], ['R(config)#', 'Global config', 'configure terminal'], ['R(config-if)#', 'Interface', 'interface g0/0'],
    ['R(config-line)#', 'Line', 'line vty 0 4'], ['R(config-router)#', 'Routing', 'router ospf 1'], ['R(config-vlan)#', 'VLAN', 'vlan 10'],
  ], 'exit lùi một mức, end hoặc Ctrl+Z về Privileged EXEC.'),
  S('CLI Cisco', 'Lệnh cơ bản', CMD, [
    ['hostname R1', 'Đặt tên thiết bị'], ['interface g0/0', 'Vào cổng'], ['ip address 10.0.0.1 255.255.255.0', 'Đặt IP'], ['no shutdown', 'Bật cổng'], ['description WAN', 'Ghi chú cổng'],
    ['copy running-config startup-config', 'Lưu cấu hình'], ['write erase', 'Xoá cấu hình đã lưu'], ['reload', 'Khởi động lại'], ['do show ip route', 'Chạy lệnh show ngay trong chế độ config'], ['no ip domain-lookup', 'Không tra DNS khi gõ sai lệnh'],
    ['logging synchronous', 'Thông báo không chen vào dòng đang gõ'], ['exec-timeout 10 0', 'Tự thoát sau 10 phút không dùng'],
  ]),
  S('CLI Cisco', 'Lệnh show hay dùng', CMD, [
    ['show ip interface brief', 'Trạng thái và IP các cổng'], ['show interfaces', 'Chi tiết cổng, lỗi, tốc độ'], ['show ip route', 'Bảng định tuyến'], ['show ip protocols', 'Giao thức định tuyến đang chạy'], ['show running-config', 'Cấu hình đang chạy'],
    ['show startup-config', 'Cấu hình đã lưu'], ['show version', 'Phiên bản IOS, thời gian chạy, config-register'], ['show arp', 'Bảng ARP'], ['show mac address-table', 'Bảng MAC'], ['show vlan brief', 'Danh sách VLAN'],
    ['show interfaces trunk', 'Các trunk và VLAN cho phép'], ['show interfaces status', 'Trạng thái cổng switch'], ['show spanning-tree', 'Trạng thái STP'], ['show etherchannel summary', 'Trạng thái EtherChannel'], ['show cdp neighbors', 'Thiết bị Cisco kế cận'],
    ['show lldp neighbors', 'Thiết bị kế cận, mọi hãng'], ['show ip ospf neighbor', 'Láng giềng OSPF'], ['show ip eigrp neighbors', 'Láng giềng EIGRP'], ['show ip bgp summary', 'Láng giềng BGP'], ['show access-lists', 'ACL và số gói khớp'],
    ['show ip nat translations', 'Bảng NAT'], ['show ip dhcp binding', 'Địa chỉ DHCP đã cấp'], ['show ip dhcp snooping', 'Trạng thái DHCP snooping'], ['show spanning-tree summary', 'Tóm tắt STP và các tính năng đang bật'], ['show mac address-table dynamic', 'Chỉ xem MAC học động'], ['show ip route ospf', 'Chỉ xem route OSPF, thay bằng eigrp, bgp, rip'], ['show standby brief', 'Trạng thái HSRP'],
  ]),
  S('CLI Cisco', 'Quá trình khởi động và bộ nhớ', ['Mục', 'Ý nghĩa'], [
    ['POST', 'Kiểm tra phần cứng'], ['Bootstrap', 'Chương trình trong ROM, tìm và nạp IOS'], ['Nạp IOS', 'Từ Flash vào RAM, không có thì thử TFTP rồi ROMMON'], ['Nạp cấu hình', 'startup-config từ NVRAM, không có thì vào hỏi cấu hình ban đầu'],
    ['ROM', 'Bootstrap, ROMMON'], ['Flash', 'Lưu IOS, không mất khi tắt'], ['NVRAM', 'Lưu startup-config, không mất khi tắt'], ['RAM', 'running-config, bảng định tuyến, ARP. Mất khi tắt'],
  ]),
  S('CLI Cisco', 'Khôi phục mật khẩu router', ['Bước', 'Việc làm'], [
    ['1', 'Khởi động lại, nhấn Break để vào ROMMON'], ['2', 'confreg 0x2142 rồi reset, router bỏ qua startup-config'], ['3', 'copy startup-config running-config'],
    ['4', 'Đổi enable secret, bật lại no shutdown trên các cổng'], ['5', 'config-register 0x2102 rồi lưu cấu hình và reload'],
  ]),
  // ---------- Switching ----------
  S('Switching', 'Cách switch xử lý khung', ['Trường hợp', 'Hành động'], [
    ['MAC nguồn', 'Học vào bảng MAC, mục động hết hạn sau 300 giây'], ['MAC đích đã biết', 'Chuyển ra đúng một cổng'], ['MAC đích chưa biết', 'Flood ra mọi cổng trong VLAN, trừ cổng vào'], ['Broadcast, multicast', 'Flood trong VLAN'],
  ], 'Mỗi cổng switch là một miền đụng độ, mỗi VLAN là một miền broadcast.'),
  S('Switching', 'VLAN và trunk', CMD, [
    ['vlan 10', 'Tạo VLAN'], ['name Sales', 'Đặt tên VLAN'], ['switchport mode access', 'Cổng access, một VLAN'], ['switchport access vlan 10', 'Gán cổng vào VLAN'], ['switchport voice vlan 20', 'VLAN thoại cho điện thoại IP'],
    ['switchport mode trunk', 'Cổng trunk, nhiều VLAN'], ['switchport trunk encapsulation dot1q', 'Chọn 802.1Q trên switch hỗ trợ nhiều chuẩn'], ['switchport trunk allowed vlan 10,20', 'Giới hạn VLAN qua trunk'], ['switchport trunk native vlan 99', 'Đổi native VLAN, hai đầu phải khớp'], ['switchport nonegotiate', 'Tắt DTP'],
  ]),
  S('Switching', 'Thẻ 802.1Q', ['Trường', 'Bit', 'Ý nghĩa'], [
    ['TPID', '16', 'Luôn là 0x8100'], ['PCP', '3', 'Độ ưu tiên CoS'], ['DEI', '1', 'Được phép bỏ khi nghẽn'], ['VLAN ID', '12', 'Giá trị 1–4094'],
  ], 'Khung qua native VLAN không có thẻ.'),
  S('Switching', 'Chế độ cổng và DTP', ['Chế độ', 'Hành vi', 'Thành trunk khi đầu kia là'], [
    ['access', 'Luôn access', 'Không bao giờ'], ['trunk', 'Luôn trunk', 'trunk, desirable, auto'], ['dynamic desirable', 'Chủ động xin trunk', 'trunk, desirable, auto'], ['dynamic auto', 'Chờ đầu kia xin', 'trunk, desirable'], ['nonegotiate', 'Tắt DTP, đi cùng access hoặc trunk', 'Đầu kia đặt trunk cứng'],
  ]),
  S('Switching', 'VTP', ['Chế độ', 'Tạo VLAN', 'Đồng bộ', 'Chuyển tiếp bản tin'], [
    ['Server', 'Có', 'Có', 'Có'], ['Client', 'Không', 'Có', 'Có'], ['Transparent', 'Có, chỉ cục bộ', 'Không', 'Có'],
  ], 'VTP chạy trực tiếp ở tầng 2, qua trunk, không dùng UDP. Switch có revision cao hơn sẽ ghi đè cả domain.'),
  S('Switching', 'Cấu hình VTP', CMD, [
    ['vtp domain CCNA', 'Đặt tên domain'], ['vtp mode transparent', 'Chọn chế độ'], ['vtp password cisco', 'Đặt mật khẩu'], ['vtp pruning', 'Bỏ VLAN không cần khỏi trunk'], ['show vtp status', 'Xem trạng thái'],
  ]),
  S('Switching', 'Chế độ STP', ['Chế độ', 'Chuẩn', 'Đặc điểm'], [
    ['PVST+', 'Cisco', 'Một cây mỗi VLAN, hội tụ chậm'], ['Rapid-PVST+', 'Cisco, dựa 802.1w', 'Một cây mỗi VLAN, hội tụ nhanh'], ['MSTP', '802.1s', 'Gom nhiều VLAN vào một instance'],
  ]),
  S('Switching', 'Vai trò và trạng thái cổng STP', ['Tên', 'Ý nghĩa'], [
    ['Root Port', 'Đường tốt nhất về root, mỗi switch không phải root có một'], ['Designated Port', 'Cổng tốt nhất trên một đoạn mạng'], ['Alternate Port', 'Dự phòng cho Root Port, đang chặn'], ['Backup Port', 'Dự phòng trên cùng đoạn mạng, đang chặn'],
    ['Blocking', 'Chỉ nhận BPDU, không chuyển dữ liệu'], ['Listening', 'Gửi nhận BPDU, chưa học MAC, 15 giây'], ['Learning', 'Học MAC, chưa chuyển dữ liệu, 15 giây'], ['Forwarding', 'Chuyển dữ liệu và học MAC'], ['Disabled', 'Cổng tắt'],
  ], 'Hello 2 giây, Max Age 20 giây, Forward Delay 15 giây. RSTP chỉ có Discarding, Learning, Forwarding.'),
  S('Switching', 'Bầu chọn STP', ['Bước', 'Tiêu chí, thấp hơn thắng'], [
    ['Chọn root', 'Bridge ID: priority rồi đến MAC'], ['Chọn Root Port', 'Root path cost, rồi Sender Bridge ID, rồi Sender Port ID'], ['Cost 802.1D', '10M = 100, 100M = 19, 1G = 4, 10G = 2'],
  ], 'Priority đi theo bội số 4096, mặc định 32768 cộng số VLAN.'),
  S('Switching', 'Cấu hình STP', CMD, [
    ['spanning-tree mode rapid-pvst', 'Chọn chế độ'], ['spanning-tree vlan 10 root primary', 'Đặt switch làm root'], ['spanning-tree vlan 10 root secondary', 'Đặt switch làm root dự phòng'], ['spanning-tree vlan 10 priority 4096', 'Đặt priority cụ thể'], ['spanning-tree portfast', 'Cổng nối máy vào Forwarding ngay'],
    ['spanning-tree bpduguard enable', 'Tắt cổng khi nhận BPDU'], ['spanning-tree guard root', 'Chặn switch lạ giành root'], ['spanning-tree guard loop', 'Chống vòng lặp khi mất BPDU'], ['show spanning-tree vlan 10', 'Xem theo VLAN'],
  ]),
  S('Switching', 'EtherChannel', ['Giao thức', 'Chuẩn', 'Các chế độ tạo được kênh'], [
    ['LACP', '802.3ad', 'active với active hoặc passive'], ['PAgP', 'Cisco', 'desirable với desirable hoặc auto'], ['Tĩnh', 'Không thương lượng', 'on với on'],
  ], 'Các cổng phải khớp tốc độ, duplex, VLAN, chế độ trunk.'),
  S('Switching', 'Cấu hình EtherChannel', CMD, [
    ['interface range g0/1 - 2', 'Chọn các cổng'], ['channel-group 1 mode active', 'Gộp bằng LACP'], ['interface port-channel 1', 'Vào cổng logic'], ['switchport mode trunk', 'Cấu hình cổng logic'], ['port-channel load-balance src-dst-ip', 'Chọn cách chia tải'], ['show etherchannel summary', 'Cờ SU và P là tốt'],
  ]),
  S('Switching', 'Inter-VLAN routing', CMD, [
    ['interface g0/0.10', 'Router-on-a-stick: subinterface cho VLAN 10'], ['encapsulation dot1Q 10', 'Gắn subinterface với VLAN'], ['ip address 192.168.10.1 255.255.255.0', 'Gateway của VLAN'], ['ip routing', 'Switch L3: bật định tuyến'],
    ['interface vlan 10', 'Switch L3: tạo SVI'], ['no switchport', 'Switch L3: đổi cổng thành cổng định tuyến'],
  ]),
  S('Switching', 'Bảo mật tầng 2', CMD, [
    ['switchport port-security', 'Bật port security'], ['switchport port-security maximum 2', 'Số MAC tối đa'], ['switchport port-security mac-address sticky', 'Tự học và giữ MAC'], ['switchport port-security violation restrict', 'Bỏ gói vi phạm, có log'],
    ['ip dhcp snooping', 'Bật DHCP snooping'], ['ip dhcp snooping vlan 10', 'Áp cho VLAN'], ['ip dhcp snooping trust', 'Tin cổng nối DHCP server'], ['ip arp inspection vlan 10', 'Bật DAI, cần bảng DHCP snooping'], ['ip verify source', 'IP Source Guard'], ['storm-control broadcast level 10', 'Giới hạn broadcast'],
  ], 'Hành động vi phạm: protect bỏ gói im lặng, restrict bỏ gói và ghi log, shutdown tắt cổng (mặc định).'),
  S('Switching', 'CDP và LLDP', CMD, [
    ['cdp run', 'Bật CDP toàn thiết bị'], ['no cdp enable', 'Tắt CDP trên một cổng'], ['lldp run', 'Bật LLDP'], ['lldp transmit', 'Cho gửi LLDP trên cổng'], ['lldp receive', 'Cho nhận LLDP trên cổng'],
  ], 'Tắt trên cổng hướng ra ngoài để không lộ thông tin thiết bị.'),
  S('Switching', 'PoE', ['Chuẩn', 'Tên', 'Công suất tại cổng'], [
    ['802.3af', 'PoE', '15,4 W'], ['802.3at', 'PoE+', '30 W'], ['802.3bt', 'PoE++', '60 W, 90 W'],
  ], 'Lệnh: power inline auto, power inline never, show power inline.'),
  S('Switching', 'Cấu hình cổng theo thiết bị', ['Thiết bị', 'Cách cấu hình cổng'], [
    ['Máy tính, máy in, IoT', 'Access, PortFast, BPDU Guard'], ['Điện thoại IP', 'Access cùng voice VLAN, cần PoE'], ['AP nhẹ, chế độ Local', 'Access, lưu lượng đi trong CAPWAP về WLC'], ['AP FlexConnect, AP tự trị', 'Trunk vì AP đưa nhiều VLAN thẳng ra cổng'], ['Máy chủ ảo hoá', 'Trunk, hoặc LACP nếu nhiều cổng'], ['Firewall, thiết bị mạng', 'Trunk hoặc port-channel theo thiết kế'],
    ['Nối hai switch', 'Trunk hoặc EtherChannel LACP'], ['Nối switch với router', 'Cổng L3 bằng no switchport, hoặc trunk cho subinterface'],
  ]),
  S('Switching', 'Cấu hình MST', CMD, [
    ['spanning-tree mode mst', 'Bật MST'], ['spanning-tree mst configuration', 'Vào chế độ cấu hình MST'], ['name LAB', 'Tên region'], ['revision 1', 'Số revision'], ['instance 1 vlan 10,20', 'Gom VLAN vào instance'], ['spanning-tree mst 1 root primary', 'Đặt root cho instance'], ['show spanning-tree mst', 'Xem trạng thái'],
  ], 'Hai switch chỉ cùng region khi khớp name, revision và bảng VLAN với instance.'),
  S('Switching', 'SPAN, RSPAN, ERSPAN', CMD, [
    ['monitor session 1 source interface g0/1', 'SPAN: cổng nguồn'], ['monitor session 1 destination interface g0/2', 'SPAN: cổng nối máy phân tích, cùng switch'],
    ['remote-span', 'RSPAN: đặt trong VLAN dành riêng'], ['monitor session 2 destination remote vlan 999', 'RSPAN: switch nguồn đẩy vào VLAN đó'], ['monitor session 3 source remote vlan 999', 'RSPAN: switch đích nhận từ VLAN đó'],
    ['monitor session 4 type erspan-source', 'ERSPAN: gửi bản sao qua mạng IP bằng GRE'], ['erspan-id 10', 'ERSPAN: mã phiên, hai đầu giống nhau'], ['ip address 10.0.0.9', 'ERSPAN: IP đích, đặt trong destination'], ['origin ip address 10.0.0.1', 'ERSPAN: IP nguồn, đặt trong destination'], ['show monitor session all', 'Xem các phiên'],
  ]),
  S('Switching', 'Phiên bản VTP', ['Phiên bản', 'Điểm mới'], [
    ['v1', 'Bản đầu, VLAN 1–1005'], ['v2', 'Hỗ trợ Token Ring, transparent chuyển tiếp bất kể phiên bản'], ['v3', 'Thêm VLAN mở rộng, private VLAN, MST, primary server chống ghi đè nhầm'],
  ], 'Lệnh: vtp version 3. Thử an toàn trước khi nối switch mới: đặt transparent rồi về lại để đưa revision về 0.'),
  S('Switching', 'Private VLAN', ['Loại', 'Nói chuyện được với'], [
    ['Primary', 'VLAN chính, chứa các VLAN phụ'], ['Promiscuous', 'Mọi cổng, thường là gateway'], ['Isolated', 'Chỉ cổng promiscuous'], ['Community', 'Cùng community và cổng promiscuous'],
  ], 'Tất cả dùng chung một subnet. Mỗi primary có tối đa một isolated VLAN. VTP phải ở transparent, trừ VTPv3.'),
  S('Switching', 'Cấu hình Private VLAN', CMD, [
    ['private-vlan isolated', 'Trong VLAN phụ: đặt loại isolated'], ['private-vlan community', 'Trong VLAN phụ: đặt loại community'], ['private-vlan primary', 'Trong VLAN chính: đặt loại primary'], ['private-vlan association add 101,102', 'Trong VLAN chính: gắn VLAN phụ'], ['switchport mode private-vlan host', 'Cổng máy'], ['switchport private-vlan host-association 100 101', 'Gắn cổng máy với primary và VLAN phụ'], ['switchport mode private-vlan promiscuous', 'Cổng gateway'], ['switchport private-vlan mapping 100 101,102', 'Gắn cổng gateway với các VLAN phụ'], ['private-vlan mapping 101,102', 'Trên SVI: nhận lưu lượng VLAN phụ'], ['show vlan private-vlan', 'Xem quan hệ VLAN'],
  ]),
  S('Switching', 'VACL, protected port, gắn thẻ native', CMD, [
    ['vlan access-map LOC 10', 'Tạo VACL, lọc cả lưu lượng trong cùng VLAN'], ['match ip address 101', 'Chọn lưu lượng bằng ACL'], ['action drop', 'Hành động, cũng có thể là forward'], ['vlan filter LOC vlan-list 10', 'Áp VACL lên VLAN'], ['show vlan access-map', 'Xem VACL'], ['mac access-list extended MAC1', 'ACL tầng 2 theo MAC'], ['switchport protected', 'Các cổng protected không nói chuyện với nhau, chỉ trên cùng switch'], ['vlan dot1q tag native', 'Gắn thẻ cả native VLAN, chống nhảy VLAN'],
  ]),
  S('Switching', 'RSTP chi tiết', ['Mục', 'Ý nghĩa'], [
    ['Trạng thái', 'Discarding, Learning, Forwarding'], ['Vai trò', 'Root, Designated, Alternate, Backup'], ['Cổng edge', 'Nối máy, vào Forwarding ngay như PortFast'], ['Cổng point-to-point', 'Full duplex, dùng được bắt tay nhanh'], ['Cổng shared', 'Half duplex, quay về tốc độ của STP cũ'], ['Proposal, Agreement', 'Hai switch bắt tay qua BPDU, cổng lên Forwarding ngay, không chờ timer'], ['Phát hiện đứt', 'Mất 3 BPDU, tức 6 giây'], ['Thông báo thay đổi', 'Mọi switch gửi TC, không cần gửi tới root trước'],
  ]),
  S('Switching', 'Bộ công cụ STP', ['Tính năng', 'Tác dụng', 'Đặt ở'], [
    ['PortFast', 'Vào Forwarding ngay', 'Cổng nối máy'], ['BPDU Guard', 'Tắt cổng khi nhận BPDU', 'Cổng nối máy'], ['BPDU Filter', 'Không gửi, không xử lý BPDU, dễ gây vòng lặp', 'Hạn chế dùng'], ['Root Guard', 'Chặn cổng nhận BPDU tốt hơn', 'Cổng hướng xuống'], ['Loop Guard', 'Cổng hết BPDU thì không chuyển sang Forwarding', 'Cổng non-designated'], ['UDLD', 'Phát hiện đường một chiều', 'Cổng quang'], ['UplinkFast', 'Đổi sang uplink dự phòng nhanh, RSTP đã có sẵn', 'Access, đời cũ'], ['BackboneFast', 'Bỏ chờ Max Age khi có đứt gián tiếp, RSTP đã có sẵn', 'Mọi switch, đời cũ'],
  ]),
  S('Switching', 'Lệnh bộ công cụ STP', CMD, [
    ['spanning-tree portfast default', 'Bật PortFast cho mọi cổng access'], ['spanning-tree portfast trunk', 'PortFast cho trunk nối máy chủ'], ['spanning-tree bpduguard default', 'BPDU Guard cho mọi cổng PortFast'], ['spanning-tree bpdufilter enable', 'BPDU Filter trên cổng'], ['spanning-tree loopguard default', 'Loop Guard toàn switch'], ['spanning-tree uplinkfast', 'Bật UplinkFast'], ['spanning-tree backbonefast', 'Bật BackboneFast'], ['spanning-tree cost 10', 'Đổi cost của cổng'], ['spanning-tree vlan 10 port-priority 64', 'Đổi priority của cổng'],
    ['udld port aggressive', 'UDLD trên cổng, tắt cổng khi một chiều'], ['show udld neighbors', 'Xem láng giềng UDLD'], ['errdisable recovery cause bpduguard', 'Tự mở lại cổng err-disabled'], ['errdisable recovery interval 300', 'Sau 300 giây'], ['show interfaces status err-disabled', 'Xem cổng bị tắt và lý do'], ['debug spanning-tree events', 'Xem thay đổi STP'],
  ]),
  S('Switching', 'Flex Links và switching tầng 3', ['Tên', 'Ý nghĩa'], [
    ['Flex Links', 'Cặp cổng dự phòng không cần STP. Lệnh: switchport backup interface g0/2'], ['Process switching', 'CPU xử lý từng gói, chậm nhất'], ['Fast switching', 'CPU xử lý gói đầu rồi lưu cache'], ['CEF', 'Tính sẵn bảng trước khi có gói'], ['FIB', 'Bản sao bảng định tuyến để chuyển gói'], ['Bảng adjacency', 'Thông tin tầng 2 của next-hop'], ['TCAM', 'Bộ nhớ tra cứu rất nhanh của switch, chứa FIB, ACL'], ['show adjacency', 'Xem bảng adjacency'],
  ]),
  S('Switching', 'HSRP chi tiết', ['Mục', 'Chi tiết'], [
    ['Trạng thái', 'Initial, Learn, Listen, Speak, Standby, Active'], ['Timer', 'Hello 3 giây, Hold 10 giây'], ['Multicast', 'v1 224.0.0.2, v2 224.0.0.102'], ['MAC ảo', 'v1 0000.0C07.ACxx, v2 0000.0C9F.Fxxx'], ['Số nhóm', 'v1 0–255, v2 0–4095'], ['Đổi timer', 'standby 1 timers 1 3'], ['Xác thực', 'standby 1 authentication md5 key-string KHOA'],
  ]),
  S('Switching', 'Cấu hình GLBP', CMD, [
    ['glbp 1 ip 192.168.1.1', 'Đặt IP ảo'], ['glbp 1 priority 150', 'Priority cao nhất thành AVG'], ['glbp 1 preempt', 'Cho phép giành lại AVG'], ['glbp 1 load-balancing round-robin', 'Mặc định, có thêm weighted và host-dependent'], ['glbp 1 weighting 100 lower 70 upper 90', 'Trọng số của AVF'], ['glbp 1 weighting track 1 decrement 40', 'Giảm trọng số khi đường theo dõi đứt'], ['show glbp brief', 'Xem AVG, AVF'],
  ], 'AVG trả lời ARP và phát MAC ảo. Tối đa 4 AVF cùng chuyển tiếp. MAC ảo 0007.B4xx.xxxx.'),
  S('Switching', 'QoS trên switch cho thoại', CMD, [
    ['mls qos', 'Bật QoS trên switch đời cũ'], ['mls qos trust cos', 'Tin giá trị CoS trên cổng'], ['mls qos trust dscp', 'Tin giá trị DSCP trên cổng'], ['mls qos trust device cisco-phone', 'Chỉ tin khi thấy điện thoại Cisco qua CDP'], ['auto qos voip cisco-phone', 'Tự cấu hình QoS cho điện thoại'], ['switchport priority extend cos 0', 'Đổi CoS của máy tính cắm sau điện thoại'], ['show mls qos interface g0/1', 'Xem trạng thái QoS của cổng'],
  ], 'Thoại cần độ trễ một chiều dưới 150 ms, jitter dưới 30 ms, mất gói dưới 1%.'),
  // ---------- Routing ----------
  S('Routing', 'Administrative Distance', ['Nguồn', 'AD'], [
    ['Connected', '0'], ['Static', '1'], ['EIGRP summary', '5'], ['eBGP', '20'], ['EIGRP nội bộ', '90'], ['OSPF', '110'], ['IS-IS', '115'], ['RIP', '120'], ['EIGRP ngoài', '170'], ['iBGP', '200'], ['Không tin cậy', '255'],
  ], 'Router chọn theo prefix dài nhất trước, rồi AD thấp nhất, rồi metric thấp nhất.'),
  S('Routing', 'So sánh giao thức', ['Giao thức', 'Loại', 'Metric', 'AD', 'Vận chuyển'], [
    ['RIPv2', 'Distance vector', 'Số chặng, tối đa 15', '120', 'UDP 520'], ['EIGRP', 'Distance vector nâng cao', 'Băng thông, độ trễ', '90', 'IP 88'], ['OSPF', 'Link state', 'Cost theo băng thông', '110', 'IP 89'], ['IS-IS', 'Link state', 'Cost', '115', 'Chạy trực tiếp tầng 2'], ['BGP', 'Path vector', 'Thuộc tính đường đi', '20/200', 'TCP 179'],
  ]),
  S('Routing', 'Mã trong bảng routing', ['Mã', 'Ý nghĩa'], [
    ['C', 'Connected'], ['L', 'Local, địa chỉ của chính cổng'], ['S', 'Static'], ['S*', 'Route mặc định tĩnh'], ['R', 'RIP'], ['D', 'EIGRP'], ['D EX', 'EIGRP ngoài'], ['O', 'OSPF cùng area'], ['O IA', 'OSPF khác area'], ['O E1/E2', 'OSPF ngoài'], ['B', 'BGP'], ['H', 'NHRP shortcut'],
  ], 'Trong [110/2], số đầu là AD, số sau là metric.'),
  S('Routing', 'Static route', CMD, [
    ['ip route 10.2.2.0 255.255.255.0 192.168.1.2', 'Route theo next-hop'], ['ip route 10.2.2.0 255.255.255.0 g0/1', 'Route theo cổng ra, dùng cho point-to-point'], ['ip route 0.0.0.0 0.0.0.0 203.0.113.2', 'Route mặc định'], ['ip route 10.2.2.0 255.255.255.0 192.168.1.3 200', 'Floating static, AD 200 để dự phòng'],
  ]),
  S('Routing', 'Tóm tắt route', ['Mạng', 'Tóm tắt'], [
    ['192.168.0.0/24 đến 192.168.3.0/24', '192.168.0.0/22'], ['192.168.0.0/24 đến 192.168.15.0/24', '192.168.0.0/20'],
  ], 'Viết nhị phân các mạng rồi lấy phần bit đầu giống nhau.'),
  S('Routing', 'Trạng thái láng giềng OSPF', ['Trạng thái', 'Ý nghĩa'], [
    ['Down', 'Chưa nhận Hello'], ['Init', 'Đã nhận Hello, chưa thấy mình trong đó'], ['2-Way', 'Hai bên thấy nhau, DROTHER dừng ở đây'], ['ExStart', 'Chọn master/slave'], ['Exchange', 'Trao đổi DBD'], ['Loading', 'Xin LSA còn thiếu'], ['Full', 'Đã đồng bộ LSDB'],
  ]),
  S('Routing', 'Điều kiện lên láng giềng OSPF', ['Phải khớp', 'Ghi chú'], [
    ['Area', 'Cùng area trên đường nối'], ['Subnet và mask', 'Trên mạng broadcast'], ['Hello và Dead', 'Mặc định 10/40 giây, NBMA 30/120'], ['Xác thực', 'Cùng kiểu, cùng khoá'], ['Cờ stub', 'Cùng loại area'], ['MTU', 'Sai thì kẹt ở ExStart'], ['Network type', 'Lệch có thể làm mất route'], ['Router ID', 'Phải khác nhau'],
  ]),
  S('Routing', 'Loại LSA và loại area', ['Tên', 'Ý nghĩa'], [
    ['LSA 1 Router', 'Trong area, do mọi router tạo'], ['LSA 2 Network', 'Trong area, do DR tạo'], ['LSA 3 Summary', 'Giữa các area, do ABR tạo'], ['LSA 4 ASBR Summary', 'Chỉ đường tới ASBR'], ['LSA 5 External', 'Route ngoài, do ASBR tạo'], ['LSA 7 NSSA', 'Route ngoài trong NSSA, ABR đổi thành LSA 5'],
    ['Stub', 'Chặn LSA 4, 5'], ['Totally Stub', 'Chặn LSA 3, 4, 5, chỉ nhận route mặc định'], ['NSSA', 'Chặn LSA 4, 5, cho phép ASBR dùng LSA 7'], ['Totally NSSA', 'Chặn thêm LSA 3'],
  ]),
  S('Routing', 'Bầu DR/BDR', ['Tiêu chí', 'Chi tiết'], [
    ['1. Priority', 'Cao hơn thắng, mặc định 1, bằng 0 thì không tham gia'], ['2. Router ID', 'Cao hơn thắng'], ['Không chiếm quyền', 'DR mới không thay DR cũ khi đang chạy'],
    ['Chọn Router ID', 'router-id, rồi IP loopback cao nhất, rồi IP cổng cao nhất'],
  ]),
  S('Routing', 'Cấu hình OSPF', CMD, [
    ['router ospf 1', 'Bật tiến trình, số chỉ có nghĩa cục bộ'], ['router-id 1.1.1.1', 'Đặt Router ID'], ['network 10.0.0.0 0.0.0.255 area 0', 'Bật OSPF theo dải'], ['ip ospf 1 area 0', 'Bật OSPF trên cổng'], ['passive-interface g0/1', 'Không gửi Hello, vẫn quảng bá mạng'], ['default-information originate', 'Quảng bá route mặc định'],
    ['ip ospf cost 10', 'Đổi cost của cổng'], ['ip ospf priority 100', 'Đổi priority DR'], ['ip ospf network point-to-point', 'Đổi network type'], ['area 1 stub', 'Đặt area stub'], ['area 1 range 10.1.0.0 255.255.0.0', 'Tóm tắt trên ABR'], ['auto-cost reference-bandwidth 10000', 'Đổi băng thông tham chiếu'],
  ]),
  S('Routing', 'EIGRP', CMD, [
    ['router eigrp 100', 'Bật EIGRP, số AS hai đầu phải khớp'], ['network 10.0.0.0 0.0.0.255', 'Bật theo dải'], ['no auto-summary', 'Tắt tự tóm tắt theo lớp'], ['passive-interface g0/1', 'Không gửi Hello'], ['variance 2', 'Chia tải không đều'], ['show ip eigrp topology', 'Xem successor và feasible successor'],
  ], 'Feasible successor phải có Reported Distance nhỏ hơn Feasible Distance của successor. K1 và K3 mặc định bằng 1.'),
  S('Routing', 'RIP', CMD, [
    ['router rip', 'Bật RIP'], ['version 2', 'Dùng RIPv2, gửi multicast 224.0.0.9'], ['network 10.0.0.0', 'Bật theo mạng classful'], ['no auto-summary', 'Tắt tự tóm tắt'],
  ], 'Cập nhật mỗi 30 giây, 16 chặng là không tới được.'),
  S('Routing', 'Chọn đường BGP', ['Thứ tự', 'Tiêu chí'], [
    ['1', 'Weight cao hơn, chỉ của Cisco, không lan ra router khác'], ['2', 'Local Preference cao hơn'], ['3', 'Route do chính router sinh ra'], ['4', 'AS Path ngắn hơn'], ['5', 'Origin: IGP, rồi EGP, rồi Incomplete'], ['6', 'MED thấp hơn'], ['7', 'eBGP hơn iBGP'], ['8', 'Metric IGP tới next-hop thấp hơn'], ['9', 'Đường cũ hơn, với eBGP'], ['10', 'Router ID thấp hơn'], ['11', 'IP láng giềng thấp hơn'],
  ]),
  S('Routing', 'Cấu hình BGP', CMD, [
    ['router bgp 65001', 'Bật BGP'], ['neighbor 192.168.1.2 remote-as 65002', 'Khai báo láng giềng'], ['neighbor 10.0.0.2 update-source loopback0', 'Dùng loopback cho iBGP'], ['neighbor 10.0.0.2 next-hop-self', 'Đổi next-hop khi gửi iBGP'], ['network 10.1.0.0 mask 255.255.0.0', 'Quảng bá mạng, phải khớp bảng định tuyến'], ['show ip bgp', 'Xem bảng BGP'],
  ], 'Trạng thái: Idle, Connect, Active, OpenSent, OpenConfirm, Established. Active kéo dài nghĩa là chưa lập được TCP.'),
  S('Routing', 'Chống vòng lặp và phân phối lại', ['Kỹ thuật', 'Ý nghĩa'], [
    ['Split Horizon', 'Không quảng bá route ngược lại cổng đã học'], ['Poison Reverse', 'Quảng bá ngược với metric vô hạn'], ['Route Poisoning', 'Báo route hỏng bằng metric vô hạn'], ['Redistribution', 'Đưa route từ giao thức này sang giao thức khác'], ['Route tag', 'Đánh dấu để không phân phối ngược, tránh vòng lặp'],
  ]),
  S('Routing', 'Static route IPv4 và IPv6 theo loại', CMD, [
    ['ip route 10.2.2.5 255.255.255.255 192.168.1.2', 'Route host IPv4'], ['ipv6 route 2001:db8:2::/64 2001:db8:1::2', 'Route mạng IPv6'], ['ipv6 route 2001:db8:2::5/128 2001:db8:1::2', 'Route host IPv6'], ['ipv6 route ::/0 g0/1 FE80::2', 'Route mặc định qua link-local, phải có cổng ra'], ['ipv6 route ::/0 2001:db8:1::3 200', 'Floating static IPv6'], ['show ipv6 route', 'Xem bảng định tuyến IPv6'],
  ]),
  S('Routing', 'OSPFv3', CMD, [
    ['ipv6 router ospf 1', 'Bật tiến trình'], ['router-id 1.1.1.1', 'Bắt buộc nếu thiết bị không có IPv4'], ['ipv6 ospf 1 area 0', 'Bật OSPFv3 trên cổng'], ['ipv6 ospf network point-to-point', 'Đổi network type'], ['show ipv6 ospf neighbor', 'Xem láng giềng'], ['show ipv6 route ospf', 'Xem route học được'],
  ], 'Láng giềng dùng link-local, multicast FF02::5 và FF02::6. LSA mới: type 8 Link, type 9 Intra-Area-Prefix.'),
  S('Routing', 'OSPF nâng cao', CMD, [
    ['area 1 virtual-link 2.2.2.2', 'Nối area xa về Area 0, khai Router ID đầu kia, cả hai đầu'], ['area 0 authentication message-digest', 'Bật xác thực MD5 cho area'], ['ip ospf message-digest-key 1 md5 KHOA', 'Khoá trên cổng'], ['area 2 nssa', 'Đặt NSSA'], ['area 1 stub no-summary', 'Totally stub, đặt trên ABR'], ['summary-address 10.9.0.0 255.255.0.0', 'Tóm tắt route ngoài trên ASBR'], ['show ip ospf database', 'Xem LSDB'], ['show ip ospf interface brief', 'Xem cổng, cost, trạng thái'],
  ]),
  S('Routing', 'EIGRP named, stub, xác thực', CMD, [
    ['router eigrp LAB', 'Bật named mode'], ['address-family ipv4 unicast autonomous-system 100', 'Chọn họ địa chỉ và số AS'], ['network 10.0.0.0 0.255.255.255', 'Bật theo dải'], ['af-interface g0/0', 'Vào cấu hình theo cổng'], ['authentication mode hmac-sha-256 KHOA', 'Xác thực SHA'], ['summary-address 10.1.0.0 255.255.0.0', 'Tóm tắt trên cổng'], ['topology base', 'Vào phần chính sách route'], ['eigrp stub connected summary', 'Router stub, không làm nơi trung chuyển'],
  ], 'Stub giúp giới hạn query, tránh kẹt ở Stuck In Active.'),
  S('Routing', 'Lọc route, route-map, phân phối lại', CMD, [
    ['ip prefix-list P1 seq 5 permit 10.0.0.0/8 le 24', 'Khớp prefix trong /8, dài từ 8 đến 24'], ['distribute-list prefix P1 in g0/0', 'Lọc route học từ cổng, đặt trong tiến trình'], ['route-map RM permit 10', 'Tạo dòng 10, cuối route-map có deny ngầm'], ['match ip address prefix-list P1', 'Điều kiện'], ['match tag 100', 'Khớp theo tag'], ['set metric 50', 'Đổi metric'], ['set tag 100', 'Gắn tag để tránh phân phối ngược'],
    ['redistribute eigrp 100 subnets route-map RM', 'Đưa EIGRP vào OSPF'], ['redistribute ospf 1 metric 10000 100 255 1 1500', 'Đưa OSPF vào EIGRP, phải có metric'], ['distance 95', 'Đổi AD của giao thức'], ['show route-map', 'Xem số lần khớp'], ['show ip prefix-list', 'Xem prefix-list'],
  ]),
  S('Routing', 'Policy-based routing (PBR)', CMD, [
    ['access-list 101 permit ip 192.168.1.0 0.0.0.255 any', 'Chọn lưu lượng'], ['route-map PBR permit 10', 'Tạo chính sách'], ['match ip address 101', 'Khớp ACL'], ['set ip next-hop 10.0.0.2', 'Chỉ định next-hop'], ['ip policy route-map PBR', 'Áp trên cổng vào'], ['show ip policy', 'Xem cổng đã áp'],
  ], 'PBR chỉ tác động lưu lượng đi qua. Gói từ chính router cần ip local policy route-map.'),
  S('Routing', 'OSPFv3 theo address family', CMD, [
    ['router ospfv3 1', 'Bật tiến trình'], ['address-family ipv6 unicast', 'Vào phần IPv6, mỗi address family có LSDB riêng'], ['ospfv3 1 ipv6 area 0', 'Bật trên cổng cho IPv6'], ['ospfv3 1 ipv4 area 0', 'Bật trên cổng cho IPv4, không có trong Lab'], ['show ospfv3 neighbor', 'Xem láng giềng'],
  ]),
  S('Routing', 'EIGRP cho IPv6', CMD, [
    ['ipv6 router eigrp 100', 'Kiểu cũ: bật tiến trình'], ['eigrp router-id 1.1.1.1', 'Bắt buộc nếu thiết bị không có IPv4'], ['ipv6 eigrp 100', 'Kiểu cũ: bật trên từng cổng'], ['address-family ipv6 unicast autonomous-system 100', 'Named mode: tự chạy trên mọi cổng có IPv6'], ['show ipv6 eigrp neighbors', 'Xem láng giềng, địa chỉ là link-local'], ['show ipv6 route eigrp', 'Route dạng D'],
  ]),
  S('Routing', 'BGP cho IPv6', CMD, [
    ['neighbor 2001:db8::2 remote-as 65002', 'Khai láng giềng IPv6'], ['address-family ipv6', 'Vào phần IPv6'], ['neighbor 2001:db8::2 activate', 'Bắt buộc, nếu thiếu thì phiên không trao đổi route IPv6'], ['network 2001:db8:1::/64', 'Quảng bá prefix đã có trong bảng route'], ['neighbor 2001:db8::2 next-hop-self', 'Đổi next-hop khi gửi cho iBGP'], ['show bgp ipv6 unicast summary', 'Xem trạng thái phiên'], ['show bgp ipv6 unicast', 'Xem bảng BGP'],
  ], 'AS riêng: 64512 đến 65534 và 4200000000 đến 4294967294. Gỡ bằng neighbor X remove-private-as.'),
  S('Routing', 'BGP nâng cao', CMD, [
    ['neighbor 10.0.0.2 route-reflector-client', 'Route reflector, thay cho full mesh iBGP'], ['neighbor IBGP peer-group', 'Tạo nhóm láng giềng'], ['neighbor 10.0.0.2 peer-group IBGP', 'Đưa láng giềng vào nhóm'], ['neighbor 203.0.113.2 ebgp-multihop 2', 'eBGP không nối trực tiếp'], ['neighbor 203.0.113.2 password KHOA', 'Xác thực MD5'], ['neighbor 203.0.113.2 route-map RM in', 'Áp chính sách'], ['neighbor 10.0.0.2 send-community', 'Gửi community cho láng giềng'],
    ['set local-preference 200', 'Chọn đường ra khỏi AS'], ['set weight 100', 'Chọn đường trên chính router'], ['set as-path prepend 65001 65001', 'Làm đường về xấu đi'], ['set community 65001:100', 'Gắn community'], ['ip bgp-community new-format', 'Hiển thị dạng AS:số'], ['aggregate-address 10.0.0.0 255.0.0.0 summary-only', 'Tóm tắt, ẩn route chi tiết'], ['clear ip bgp * soft', 'Áp lại chính sách, không cắt phiên'],
  ], 'Bản tin: Open, Update, Keepalive, Notification. Keepalive 60, Hold 180 giây. Community có sẵn: no-export, no-advertise, local-AS.'),
  S('Routing', 'Gói và metric của EIGRP', ['Mục', 'Chi tiết'], [
    ['Hello', 'Tìm và giữ láng giềng, 224.0.0.10'], ['Update', 'Gửi route, tin cậy qua RTP'], ['Query', 'Hỏi đường khi mất route, tin cậy'], ['Reply', 'Trả lời Query, tin cậy'], ['Ack', 'Xác nhận, là Hello không có dữ liệu'], ['Timer', 'Hello 5, Hold 15 giây. Đường chậm: 60 và 180'], ['Metric', '256 × (10^7 / băng thông nhỏ nhất theo kbps + tổng độ trễ theo chục micro giây)'], ['K mặc định', 'K1 = 1, K2 = 0, K3 = 1, K4 = 0, K5 = 0. Hai đầu phải khớp'], ['Băng thông dùng', 'EIGRP dùng tối đa 50% băng thông cổng'], ['Stuck In Active', 'Hết 3 phút chưa đủ Reply thì cắt láng giềng'],
  ]),
  S('Routing', 'EIGRP kiểu cũ', CMD, [
    ['ip summary-address eigrp 100 10.1.0.0 255.255.0.0', 'Tóm tắt trên cổng'], ['ip hello-interval eigrp 100 2', 'Đổi Hello'], ['ip hold-time eigrp 100 6', 'Đổi Hold'], ['ip bandwidth-percent eigrp 100 25', 'Giới hạn băng thông'], ['no ip split-horizon eigrp 100', 'Tắt split horizon, cần ở hub'], ['key chain KEYS', 'Tạo chuỗi khoá'], ['key 1', 'Thêm khoá'], ['key-string KHOA', 'Nội dung khoá'], ['ip authentication mode eigrp 100 md5', 'Bật MD5 trên cổng'], ['ip authentication key-chain eigrp 100 KEYS', 'Áp chuỗi khoá'], ['clear ip eigrp neighbors', 'Lập lại láng giềng'], ['ipv6 eigrp 1', 'EIGRP cho IPv6 trên cổng'],
  ]),
  S('Routing', 'Gói và network type của OSPF', ['Mục', 'DR/BDR', 'Hello/Dead', 'Khai láng giềng'], [
    ['Broadcast', 'Có', '10/40', 'Tự động'], ['Non-broadcast (NBMA)', 'Có', '30/120', 'Thủ công'], ['Point-to-point', 'Không', '10/40', 'Tự động'], ['Point-to-multipoint', 'Không', '30/120', 'Tự động'], ['Point-to-multipoint non-broadcast', 'Không', '30/120', 'Thủ công'],
  ], 'Gói OSPF: 1 Hello, 2 DBD, 3 LSR, 4 LSU, 5 LSAck. Multicast 224.0.0.5 cho mọi router, 224.0.0.6 cho DR.'),
  S('Routing', 'Lệnh OSPF thêm', CMD, [
    ['ip ospf network point-to-multipoint', 'Đổi network type'], ['neighbor 10.0.0.2', 'Khai láng giềng trên NBMA'], ['ip ospf hello-interval 5', 'Đổi Hello, hai đầu phải khớp'], ['ip ospf authentication', 'Xác thực dạng rõ trên cổng'], ['ip ospf authentication-key KHOA', 'Khoá dạng rõ'], ['ip ospf authentication message-digest', 'Xác thực MD5 trên cổng'], ['distance ospf external 150', 'Đổi AD của route ngoài'], ['clear ip ospf process', 'Khởi động lại OSPF, chạy khi đổi Router ID'], ['show ip ospf virtual-links', 'Xem virtual link'], ['debug ip ospf hello', 'Xem lệch Hello và mask'], ['debug ip ospf packet', 'Xem gói OSPF'],
  ]),
  S('Routing', 'Metric mặc định khi phân phối lại', ['Đưa vào', 'Seed metric', 'Lưu ý'], [
    ['RIP', 'Vô hạn', 'Phải đặt metric'], ['EIGRP', 'Vô hạn', 'Phải đặt 5 giá trị, trừ khi từ EIGRP khác hoặc route connected, static'], ['OSPF', '20, loại E2, BGP là 1', 'Thêm subnets để lấy cả subnet'], ['IS-IS', '0', 'Mặc định vào level-2'], ['BGP', 'Giữ metric IGP làm MED', 'iBGP không tự đưa vào IGP'],
  ], 'default-metric đặt metric chung. redistribute connected subnets đưa mạng trực tiếp vào OSPF. E2 giữ nguyên cost, E1 cộng thêm cost nội bộ.'),
  S('Routing', 'Thuộc tính BGP', ['Loại', 'Thuộc tính'], [
    ['Well-known, bắt buộc', 'AS_PATH, NEXT_HOP, ORIGIN'], ['Well-known, tuỳ chọn', 'LOCAL_PREF, ATOMIC_AGGREGATE'], ['Optional, lan tiếp', 'AGGREGATOR, COMMUNITY'], ['Optional, không lan tiếp', 'MED, ORIGINATOR_ID, CLUSTER_LIST'],
  ], 'iBGP không chuyển route học từ iBGP, nên cần full mesh hoặc route reflector. IOS đời mới đã tắt synchronization mặc định. maximum-paths 2 cho phép chia tải.'),
  S('Routing', 'Routing IPv6: RIPng, EIGRP, prefix chung', CMD, [
    ['ipv6 enable', 'Bật IPv6 trên cổng, chỉ có link-local'], ['ipv6 router rip R1', 'Bật RIPng, UDP 521, FF02::9'], ['ipv6 rip R1 enable', 'Bật RIPng trên cổng'], ['ipv6 rip R1 default-information originate', 'Quảng bá route mặc định'], ['show ipv6 route rip', 'Xem route RIPng'], ['ipv6 router eigrp 1', 'Bật EIGRP cho IPv6, multicast FF02::A'], ['eigrp router-id 1.1.1.1', 'Bắt buộc nếu không có IPv4'], ['no shutdown', 'IOS cũ: tiến trình EIGRP IPv6 mặc định tắt'], ['show ipv6 eigrp neighbors', 'Xem láng giềng'], ['show ipv6 protocols', 'Xem giao thức IPv6'], ['ipv6 general-prefix P1 2001:db8::/48', 'Đặt tên cho prefix'], ['ipv6 address P1 ::1:0:0:0:1/64', 'Đặt địa chỉ theo prefix có tên'],
  ]),
  // ---------- Dịch vụ IP ----------
  S('Dịch vụ IP', 'Bản tin DHCP', ['Bản tin', 'Ý nghĩa'], [
    ['Discover', 'Máy broadcast tìm server'], ['Offer', 'Server đề xuất địa chỉ'], ['Request', 'Máy xin nhận địa chỉ đó, broadcast để server khác biết'], ['Ack', 'Server xác nhận'], ['Nak', 'Server từ chối'], ['Release', 'Máy trả địa chỉ'], ['Decline', 'Máy từ chối vì địa chỉ bị trùng'], ['Inform', 'Máy chỉ xin thông tin cấu hình'],
  ], 'Offer và Ack có thể là unicast hoặc broadcast, tuỳ cờ Broadcast của máy.'),
  S('Dịch vụ IP', 'Cấu hình DHCP', CMD, [
    ['ip dhcp excluded-address 192.168.1.1 192.168.1.20', 'Giữ lại địa chỉ không cấp'], ['ip dhcp pool LAN1', 'Tạo pool'], ['network 192.168.1.0 255.255.255.0', 'Dải cấp phát'], ['default-router 192.168.1.1', 'Gateway'], ['dns-server 8.8.8.8', 'DNS'], ['lease 7', 'Thời hạn thuê, tính bằng ngày'], ['ip helper-address 10.0.0.5', 'Relay: đặt trên cổng phía máy khách'], ['show ip dhcp binding', 'Xem địa chỉ đã cấp'],
  ]),
  S('Dịch vụ IP', 'Cấu hình NAT', CMD, [
    ['ip nat inside', 'Đánh dấu cổng trong'], ['ip nat outside', 'Đánh dấu cổng ngoài'], ['ip nat inside source static 10.0.0.5 203.0.113.5', 'NAT tĩnh 1:1'], ['ip nat pool P1 203.0.113.10 203.0.113.20 netmask 255.255.255.0', 'Tạo pool'], ['ip nat inside source list 1 pool P1', 'NAT động'], ['ip nat inside source list 1 interface g0/1 overload', 'PAT, dùng IP của cổng'], ['show ip nat translations', 'Xem bảng NAT'], ['clear ip nat translation *', 'Xoá bản ghi động'],
  ]),
  S('Dịch vụ IP', 'Thuật ngữ NAT', ['Tên', 'Ý nghĩa'], [
    ['Inside local', 'IP thật của máy trong'], ['Inside global', 'IP công cộng đại diện cho máy trong'], ['Outside local', 'IP của máy ngoài nhìn từ bên trong'], ['Outside global', 'IP thật của máy ngoài'], ['SNAT', 'Đổi địa chỉ nguồn'], ['DNAT', 'Đổi địa chỉ đích, dùng để mở dịch vụ ra ngoài'], ['PAT', 'Nhiều IP dùng chung một IP công cộng, phân biệt bằng cổng'],
  ]),
  S('Dịch vụ IP', 'FHRP', ['Giao thức', 'Chuẩn', 'Vai trò', 'Đặc điểm'], [
    ['HSRP', 'Cisco', 'Active, Standby', 'UDP 1985, MAC ảo 0000.0C07.ACxx (v1)'], ['VRRP', 'RFC 5798', 'Master, Backup', 'IP 112, mặc định có preempt'], ['GLBP', 'Cisco', 'AVG, AVF', 'Nhiều gateway cùng chia tải'],
  ]),
  S('Dịch vụ IP', 'Cấu hình HSRP', CMD, [
    ['standby 1 ip 192.168.1.1', 'Đặt IP ảo'], ['standby 1 priority 110', 'Priority cao hơn thành Active, mặc định 100'], ['standby 1 preempt', 'Cho phép giành lại Active'], ['standby 1 track g0/1 20', 'Giảm priority khi cổng WAN đứt'], ['standby version 2', 'Dùng HSRPv2'], ['show standby brief', 'Xem trạng thái'],
  ]),
  S('Dịch vụ IP', 'NTP, SNMP, Syslog', CMD, [
    ['ntp server 10.0.0.5', 'Lấy giờ từ server'], ['ntp master 3', 'Làm nguồn giờ, stratum 3'], ['clock timezone ICT 7', 'Đặt múi giờ'], ['service timestamps log datetime msec', 'Log có giờ chính xác'], ['snmp-server community public RO', 'SNMP v2c chỉ đọc'], ['snmp-server host 10.0.0.9 version 2c public', 'Nơi nhận trap'], ['snmp-server group G1 v3 priv', 'Nhóm SNMPv3 có mã hoá'], ['logging host 10.0.0.9', 'Gửi log tới server'], ['logging trap warnings', 'Gửi từ mức 4 trở xuống'],
  ]),
  S('Dịch vụ IP', 'Mức Syslog', ['Mức', 'Tên', 'Ý nghĩa'], [
    ['0', 'Emergency', 'Hệ thống không dùng được'], ['1', 'Alert', 'Phải xử lý ngay'], ['2', 'Critical', 'Tình trạng nghiêm trọng'], ['3', 'Error', 'Lỗi'], ['4', 'Warning', 'Cảnh báo'], ['5', 'Notification', 'Bình thường nhưng đáng chú ý'], ['6', 'Informational', 'Thông tin'], ['7', 'Debug', 'Gỡ lỗi'],
  ], 'Số càng nhỏ càng nghiêm trọng.'),
  S('Dịch vụ IP', 'QoS', ['Lớp', 'DSCP', 'Giá trị', 'Dùng cho'], [
    ['Thoại', 'EF', '46', 'Hàng đợi ưu tiên'], ['Video', 'AF41', '34', 'Băng thông đảm bảo'], ['Dữ liệu quan trọng', 'AF31', '26', 'Băng thông đảm bảo'], ['Mặc định', 'BE', '0', 'Phần còn lại'],
  ], 'Các bước: phân loại, đánh dấu, xếp hàng, giới hạn. Policing bỏ gói vượt mức, shaping giữ lại gửi sau. CoS 802.1p nằm trong thẻ 802.1Q.'),
  S('Dịch vụ IP', 'Cấu hình QoS', CMD, [
    ['class-map match-any VOICE', 'Tạo lớp'], ['match dscp ef', 'Điều kiện khớp'], ['policy-map WAN-OUT', 'Tạo chính sách'], ['class VOICE', 'Chọn lớp'], ['priority percent 30', 'Hàng đợi ưu tiên'], ['bandwidth percent 20', 'Băng thông tối thiểu'], ['service-policy output WAN-OUT', 'Áp lên cổng'],
  ]),
  S('Dịch vụ IP', 'Multicast', ['Mục', 'Chi tiết'], [
    ['224.0.0.0/24', 'Link-local, không định tuyến'], ['239.0.0.0/8', 'Phạm vi nội bộ'], ['IGMP', 'Máy báo tham gia nhóm'], ['PIM', 'Router xây cây phân phối'], ['IGMP snooping', 'Switch chỉ gửi multicast tới cổng cần'],
    ['ip multicast-routing', 'Bật multicast trên router'], ['ip pim sparse-mode', 'Bật PIM trên cổng'],
  ]),
  S('Dịch vụ IP', 'Bản ghi DNS', ['Bản ghi', 'Trỏ tới', 'Khi lỗi thì'], [
    ['A', 'Tên sang IPv4', 'Không vào được web qua tên'], ['AAAA', 'Tên sang IPv6', 'Máy IPv6 không vào được'], ['CNAME', 'Tên phụ sang tên chính', 'Tên phụ không phân giải được'], ['MX', 'Máy chủ nhận thư của miền', 'Không nhận được email'], ['NS', 'Máy chủ quản lý miền', 'Cả miền không phân giải được'], ['PTR', 'IP sang tên', 'Tra ngược lỗi, email hay bị từ chối'],
  ], 'Kiểm tra: nslookup -type=MX example.com hoặc dig MX example.com. Trên IOS: ip name-server 8.8.8.8, ip domain-lookup.'),
  S('Dịch vụ IP', 'Đọc thông báo Syslog', ['Phần', 'Trong %LINK-3-UPDOWN', 'Ý nghĩa'], [
    ['Facility', 'LINK', 'Thành phần phát sinh, như LINK, SYS, OSPF'], ['Severity', '3', 'Mức nghiêm trọng, 0 đến 7'], ['Mnemonic', 'UPDOWN', 'Tên ngắn của sự kiện'], ['Mô tả', 'Interface g0/0, changed state to down', 'Nội dung sự kiện'],
  ], 'logging facility local7 đặt facility khi gửi tới server syslog. Xem log trên thiết bị: show logging.'),
  S('Dịch vụ IP', 'SNMP', ['Tên', 'Ý nghĩa'], [
    ['Manager', 'Phần mềm giám sát'], ['Agent', 'Phần chạy trên thiết bị'], ['MIB, OID', 'Cơ sở dữ liệu thông số, mã của từng thông số'], ['Get, Set', 'Manager đọc, ghi giá trị'], ['Trap, Inform', 'Thiết bị tự báo. Inform có xác nhận'], ['v1, v2c', 'Community dạng rõ'], ['v3', 'Có user, xác thực và mã hoá'],
  ]),
  S('Dịch vụ IP', 'Cấu hình và đọc trạng thái VRRP', CMD, [
    ['vrrp 1 ip 192.168.1.1', 'Đặt IP ảo'], ['vrrp 1 priority 110', 'Priority cao hơn thành Master'], ['show vrrp brief', 'Xem trạng thái Master, Backup'],
  ], 'Hai router cùng báo Active hoặc Master thường do Hello không qua được, hãy kiểm tra VLAN hoặc trunk. HSRP đạt Active rồi không tự trả nếu không có preempt.'),
  S('Dịch vụ IP', 'Flexible NetFlow', CMD, [
    ['flow record FR', 'Chọn trường theo dõi'], ['match ipv4 source address', 'Trường làm khoá'], ['collect counter bytes', 'Trường thu thập'], ['flow exporter FE', 'Nơi gửi'], ['destination 10.0.0.9', 'IP collector'], ['flow monitor FM', 'Gom record và exporter'], ['ip flow monitor FM input', 'Áp lên cổng'], ['show flow monitor FM cache', 'Xem dữ liệu'],
  ]),
  // ---------- Bảo mật ----------
  S('Bảo mật', 'Các loại ACL', ['Loại', 'Số', 'Lọc theo', 'Đặt ở'], [
    ['Standard', '1–99, 1300–1999', 'IP nguồn', 'Gần đích'], ['Extended', '100–199, 2000–2699', 'Nguồn, đích, giao thức, cổng', 'Gần nguồn'], ['Named', 'Đặt tên', 'Theo loại', 'Theo loại'],
  ], 'Xét từ trên xuống, khớp là dừng. Cuối ACL luôn có deny any ngầm.'),
  S('Bảo mật', 'Cấu hình ACL', CMD, [
    ['access-list 10 permit 192.168.1.0 0.0.0.255', 'ACL chuẩn'], ['access-list 110 permit tcp 192.168.1.0 0.0.0.255 any eq 443', 'ACL mở rộng'], ['ip access-list extended WEB', 'ACL có tên'], ['15 deny ip host 10.0.0.5 any', 'Chèn dòng theo số thứ tự'], ['ip access-group 110 in', 'Áp lên cổng'], ['access-class 10 in', 'Áp lên line vty'], ['show access-lists', 'Xem số gói khớp'],
  ], 'Wildcard: host bằng 0.0.0.0, any bằng 255.255.255.255.'),
  S('Bảo mật', 'Làm cứng thiết bị', CMD, [
    ['enable secret class', 'Mật khẩu vào chế độ đặc quyền, có băm'], ['service password-encryption', 'Che mật khẩu dạng rõ, mã hoá yếu'], ['username admin secret pass', 'Tạo người dùng cục bộ'], ['line console 0', 'Vào line console'], ['login local', 'Đăng nhập bằng user cục bộ'], ['ip domain-name lab.local', 'Cần trước khi tạo khoá'],
    ['crypto key generate rsa modulus 2048', 'Tạo khoá SSH'], ['ip ssh version 2', 'Chỉ dùng SSHv2'], ['transport input ssh', 'Trên vty: chặn Telnet'], ['banner motd #Chi danh cho nguoi co quyen#', 'Cảnh báo pháp lý'], ['no ip http server', 'Tắt dịch vụ không dùng'],
  ]),
  S('Bảo mật', 'AAA', ['Tiêu chí', 'RADIUS', 'TACACS+'], [
    ['Chuẩn', 'Mở', 'Cisco phát triển, đã có RFC 8907'], ['Vận chuyển', 'UDP 1812/1813', 'TCP 49'], ['Mã hoá', 'Chỉ mật khẩu', 'Toàn bộ nội dung'], ['Chức năng AAA', 'Gộp xác thực và phân quyền', 'Tách riêng từng phần'], ['Dùng cho', 'Truy cập mạng, 802.1X', 'Quản trị thiết bị'],
  ]),
  S('Bảo mật', 'Cấu hình AAA', CMD, [
    ['aaa new-model', 'Bật AAA'], ['aaa authentication login default group radius local', 'Xác thực qua RADIUS, dự phòng cục bộ'], ['aaa authorization exec default local', 'Phân quyền'], ['aaa accounting exec default start-stop group radius', 'Ghi nhận phiên'], ['radius server R1', 'Khai báo server'], ['dot1x system-auth-control', 'Bật 802.1X toàn switch'], ['authentication port-control auto', 'Bật 802.1X trên cổng'],
  ], '802.1X có 3 vai: supplicant là máy người dùng, authenticator là switch, authentication server là RADIUS.'),
  S('Bảo mật', 'Khái niệm và tấn công', ['Tên', 'Ý nghĩa'], [
    ['CIA', 'Bảo mật, toàn vẹn, sẵn sàng'], ['Phishing', 'Lừa lấy thông tin qua giả mạo'], ['DoS/DDoS', 'Làm quá tải dịch vụ'], ['MITM', 'Xen vào giữa hai bên, thường qua ARP giả'], ['VLAN hopping', 'Nhảy VLAN bằng DTP hoặc gắn hai thẻ'], ['MAC flooding', 'Làm tràn bảng MAC, chống bằng port security'], ['DHCP giả', 'Cấp gateway giả, chống bằng DHCP snooping'],
    ['Zero Trust', 'Không mặc nhiên tin, luôn xác minh, quyền tối thiểu'], ['Microsegmentation', 'Chia nhỏ mạng để chặn di chuyển ngang'],
  ]),
  S('Bảo mật', 'RA Guard', CMD, [
    ['ipv6 nd raguard policy HOST', 'Tạo chính sách'], ['device-role host', 'Cổng nối máy, chặn RA'], ['ipv6 nd raguard attach-policy HOST', 'Áp lên cổng'], ['show ipv6 nd raguard policy', 'Xem chính sách'],
  ], 'Chặn máy lạ giả làm router IPv6 bằng RA.'),
  S('Bảo mật', 'CoPP, uRPF, ACL theo giờ', CMD, [
    ['class-map COPP-SSH', 'CoPP: chọn lưu lượng tới CPU'], ['match access-group name SSH', 'CoPP: khớp ACL'], ['police 64000 conform-action transmit exceed-action drop', 'CoPP: giới hạn tốc độ'], ['control-plane', 'CoPP: vào control plane'], ['service-policy input COPP', 'CoPP: áp chính sách'],
    ['ip verify unicast source reachable-via rx', 'uRPF strict: nguồn phải về đúng cổng vào'], ['ip verify unicast source reachable-via any', 'uRPF loose: nguồn chỉ cần có route'],
    ['time-range GIO-LAM', 'Tạo khung giờ'], ['periodic weekdays 8:00 to 17:00', 'Thứ hai đến thứ sáu'], ['access-list 110 permit tcp any any eq 80 time-range GIO-LAM', 'ACL chỉ có hiệu lực trong khung giờ'],
  ]),
  S('Bảo mật', 'Firewall và công nghệ bảo mật', ['Tên', 'Ý nghĩa'], [
    ['Stateful firewall', 'Nhớ trạng thái kết nối, tự cho gói trả về'], ['NGFW', 'Thêm nhận diện ứng dụng, người dùng, IPS'], ['IDS, IPS', 'IDS cảnh báo. IPS đứng trên đường đi và chặn được'], ['Zone-based firewall', 'Chính sách theo cặp zone trên IOS'], ['TrustSec, SGT', 'Chính sách theo nhóm thay vì theo IP'], ['MACsec 802.1AE', 'Mã hoá từng chặng ở tầng 2, trao khoá bằng MKA'], ['DHCPv6 Guard', 'Chặn máy chủ DHCPv6 giả'], ['EAP', 'Khung xác thực trong 802.1X, như EAP-TLS, PEAP'], ['MAB', 'Xác thực bằng MAC cho thiết bị không hỗ trợ 802.1X'], ['TLS', 'Mã hoá phiên HTTPS, VPN SSL'],
  ]),
  // ---------- Không dây ----------
  S('Không dây', 'Chuẩn Wi-Fi', ['Chuẩn', 'Tên', 'Băng tần', 'Tốc độ lý thuyết'], [
    ['802.11a', '', '5 GHz', '54 Mbps'], ['802.11b', '', '2,4 GHz', '11 Mbps'], ['802.11g', '', '2,4 GHz', '54 Mbps'], ['802.11n', 'Wi-Fi 4', '2,4 và 5 GHz', '600 Mbps'], ['802.11ac', 'Wi-Fi 5', '5 GHz', '6,9 Gbps'], ['802.11ax', 'Wi-Fi 6/6E', '2,4, 5, 6 GHz', '9,6 Gbps'],
  ], 'Ở 2,4 GHz chỉ có kênh 1, 6, 11 không chồng lấn.'),
  S('Không dây', 'Bảo mật và kiến trúc WLAN', ['Tên', 'Ý nghĩa'], [
    ['Open', 'Không mã hoá'], ['WEP', 'Đã bị phá, không dùng'], ['WPA2-PSK', 'AES, khoá dùng chung'], ['WPA2/WPA3-Enterprise', '802.1X và RADIUS, tốt nhất cho doanh nghiệp'], ['WPA3-SAE', 'Thay PSK, chống dò mật khẩu offline'],
    ['AP tự trị', 'Cấu hình từng AP'], ['AP nhẹ và WLC', 'WLC quản lý tập trung qua CAPWAP, UDP 5246/5247'], ['SSID, BSSID', 'Tên mạng, MAC của radio AP'],
  ]),
  S('Không dây', 'Đặc tính sóng và nhiễu', ['Tên', 'Ý nghĩa'], [
    ['RSSI', 'Cường độ tín hiệu, đo bằng dBm. Khoảng -67 dBm hoặc mạnh hơn phù hợp cho thoại'], ['SNR', 'Khoảng cách tín hiệu so với nhiễu, đo bằng dB. Nên từ 25 dB'], ['2,4 GHz', 'Đi xa, xuyên tường tốt hơn, ít kênh, nhiều nhiễu'], ['5, 6 GHz', 'Đi gần hơn, nhiều kênh, tốc độ cao'], ['Độ rộng kênh', '20, 40, 80, 160 MHz. Rộng hơn thì nhanh hơn nhưng dễ chồng lấn'],
    ['Hấp thụ, phản xạ', 'Tường, nước, kim loại làm yếu tín hiệu hoặc gây đa đường'], ['Nhiễu đồng kênh', 'Nhiều AP cùng kênh phải chia nhau thời gian phát'], ['Nhiễu kênh lân cận', 'Kênh chồng lấn nhau, như dùng kênh 1 và 3'], ['Nhiễu ngoài Wi-Fi', 'Lò vi sóng, Bluetooth, camera không dây, radar với kênh DFS'],
  ]),
  S('Không dây', 'Chế độ AP và triển khai', ['Tên', 'Ý nghĩa'], [
    ['Local', 'Mặc định, dữ liệu đi trong CAPWAP về WLC'], ['FlexConnect', 'AP chi nhánh đưa dữ liệu thẳng ra LAN, vẫn chạy khi mất WLC'], ['Monitor', 'Chỉ dò sóng, không phục vụ máy khách'], ['Sniffer', 'Bắt gói và gửi về máy phân tích'], ['Bridge', 'Nối mạng qua không dây'], ['Roaming', 'Máy chuyển AP. Layer 3 roaming giữ IP bằng đường hầm giữa các WLC'], ['Fabric', 'AP trong SD-Access, dữ liệu đi VXLAN'],
  ]),
  // ---------- WAN và VPN ----------
  S('WAN và VPN', 'GRE và IPsec', ['Tiêu chí', 'GRE', 'IPsec'], [
    ['Mã hoá', 'Không', 'Có'], ['Mang multicast, IGP', 'Có', 'Không, trừ khi dùng VTI hoặc GRE bên trong'], ['Giao thức', 'IP 47', 'ESP IP 50, AH IP 51'], ['Chế độ', 'Tunnel', 'Transport, Tunnel'],
  ], 'IKE pha 1 lập kênh quản lý, pha 2 lập SA dữ liệu. AH không mã hoá nên ít dùng.'),
  S('WAN và VPN', 'Cấu hình GRE và IPsec', CMD, [
    ['interface tunnel 0', 'Tạo tunnel'], ['tunnel source g0/0', 'Nguồn tunnel'], ['tunnel destination 203.0.113.2', 'Đích tunnel'], ['crypto isakmp policy 10', 'Chính sách pha 1'], ['encr aes 256', 'Pha 1: thuật toán mã hoá'], ['authentication pre-share', 'Pha 1: dùng khoá chia sẻ trước'], ['group 14', 'Pha 1: nhóm Diffie-Hellman'], ['lifetime 86400', 'Pha 1: thời gian sống, tính bằng giây'], ['crypto isakmp key KHOA address 203.0.113.2', 'Khoá chia sẻ trước'], ['crypto ipsec transform-set TS esp-aes 256 esp-sha-hmac', 'Thuật toán pha 2'], ['crypto map VPN 10 ipsec-isakmp', 'Gom chính sách'], ['set peer 203.0.113.2', 'Crypto map: chọn đầu kia'], ['set transform-set TS', 'Crypto map: chọn thuật toán'], ['match address 110', 'Crypto map: ACL chọn lưu lượng cần mã hoá'], ['crypto map VPN', 'Áp lên cổng WAN'], ['show crypto ipsec sa', 'Xem số gói mã hoá'],
  ]),
  S('WAN và VPN', 'Loại VPN và WAN', ['Tên', 'Ý nghĩa'], [
    ['Site-to-site', 'Nối hai mạng, thiết bị tự mã hoá'], ['Remote access', 'Từng người dùng kết nối vào, thường SSL hoặc IPsec'], ['MPLS L3VPN', 'Nhà mạng định tuyến cho khách, tách bằng VRF'], ['Metro Ethernet', 'Nhà mạng cung cấp đường tầng 2'], ['SD-WAN', 'Quản lý WAN tập trung, chọn đường theo chính sách'],
  ]),
  S('WAN và VPN', 'IPsec dùng VTI', CMD, [
    ['crypto ipsec profile P1', 'Tạo profile'], ['set transform-set TS', 'Chọn transform-set'], ['tunnel mode ipsec ipv4', 'Đổi tunnel thành VTI, chạy được IGP'], ['tunnel protection ipsec profile P1', 'Bảo vệ tunnel'], ['show crypto isakmp sa', 'Xem pha 1, QM_IDLE là tốt'],
  ]),
  S('WAN và VPN', 'Chuyển đổi IPv4 sang IPv6', ['Cách', 'Đặc điểm', 'Lệnh tunnel mode'], [
    ['Dual stack', 'Chạy cả hai, cách được ưu tiên', 'Không cần'], ['Tunnel thủ công 6in4', 'Hai đầu cố định, IP giao thức 41', 'ipv6ip'], ['GRE', 'Thủ công, mang được cả multicast', 'gre ip'], ['6to4', 'Tự động, dùng dải 2002::/16', 'ipv6ip 6to4'], ['ISATAP', 'Máy trong mạng IPv4 nói chuyện IPv6', 'ipv6ip isatap'], ['NAT64', 'Máy chỉ có IPv6 tới máy chỉ có IPv4. NAT-PT là bản cũ đã bỏ', 'Không dùng tunnel'],
  ]),
  S('WAN và VPN', 'Kết nối chi nhánh: PPP, PPPoE', CMD, [
    ['encapsulation ppp', 'Dùng PPP trên serial, mặc định Cisco là HDLC'], ['ppp authentication chap', 'Xác thực CHAP'], ['interface dialer 1', 'PPPoE: tạo cổng logic'], ['ip address negotiated', 'PPPoE: nhận IP từ nhà mạng'], ['dialer pool 1', 'PPPoE: chọn pool'], ['ppp chap hostname user1', 'PPPoE: tên đăng nhập'], ['ppp chap password matkhau', 'PPPoE: mật khẩu'], ['pppoe-client dial-pool-number 1', 'PPPoE: đặt trên cổng vật lý'], ['ip mtu 1492', 'PPPoE tốn thêm 8 byte'], ['ip tcp adjust-mss 1452', 'Tránh gói TCP bị phân mảnh'], ['show pppoe session', 'Xem phiên'],
  ], 'Chi nhánh cần xét: tốc độ, độ tin cậy, chi phí, đường dự phòng như DSL, cáp, 4G.'),
  S('WAN và VPN', 'Frame Relay, công nghệ cũ', CMD, [
    ['encapsulation frame-relay', 'Bật Frame Relay'], ['frame-relay interface-dlci 102', 'Gán DLCI cho subinterface'], ['frame-relay map ip 10.0.0.2 102 broadcast', 'Ánh xạ tĩnh, broadcast để mang được IGP'], ['show frame-relay pvc', 'Xem PVC'], ['show frame-relay map', 'Xem ánh xạ'],
  ], 'Đã ra khỏi đề thi mới, chỉ gặp ở mạng cũ. Đặc trưng: DLCI có nghĩa cục bộ, LMI báo trạng thái, hub-and-spoke vướng split horizon.'),
  S('Voice', 'Thành phần và giao thức', ['Tên', 'Ý nghĩa'], [
    ['SIP', 'Báo hiệu: đăng ký, gọi, kết thúc. Dạng chữ, UDP hoặc TCP 5060, TLS 5061'], ['SDP', 'Mô tả phiên nằm trong SIP: IP, cổng RTP, codec'], ['RTP', 'Mang âm thanh trên UDP, Cisco dùng cổng 16384–32767'], ['RTCP', 'Báo mất gói, jitter, độ trễ. Cổng ngay sau cổng RTP'], ['SRTP', 'RTP có mã hoá'], ['SCCP', 'Báo hiệu riêng của Cisco, TCP 2000'], ['H.323', 'Chuẩn báo hiệu cũ, thường gặp ở gateway'], ['MGCP', 'Tổng đài điều khiển gateway, UDP 2427'],
    ['Tổng đài IP', 'CUCM cho hệ lớn, CUCME chạy trên router, Asterisk mã nguồn mở'], ['Gateway', 'Nối mạng IP với đường điện thoại cũ'], ['CUBE, SBC', 'Biên giữa tổng đài và nhà mạng SIP'], ['Voice VLAN', 'Tách thoại khỏi dữ liệu, dễ áp QoS'],
  ]),
  S('Voice', 'Codec và băng thông', ['Codec', 'PT', 'Tốc độ codec', 'Âm thanh mỗi gói 20 ms', 'Băng thông IP', 'Băng thông Ethernet'], [
    ['G.711 µ-law, A-law', '0, 8', '64 kbps', '160 byte', '80 kbps', '87,2 kbps'], ['G.722', '9', '64 kbps', '160 byte', '80 kbps', '87,2 kbps'], ['G.729', '18', '8 kbps', '20 byte', '24 kbps', '31,2 kbps'],
  ], 'Băng thông = (âm thanh + 40 byte IP, UDP, RTP + 18 byte Ethernet nếu có) × 8 × 50 gói. Mỗi chiều một luồng. Header cRTP giảm 40 byte xuống 2–4 byte trên WAN.'),
  S('Voice', 'Bản tin SIP', ['Bản tin', 'Ý nghĩa'], [
    ['REGISTER', 'Báo số máy đang ở địa chỉ nào'], ['INVITE', 'Mời vào cuộc gọi, thường kèm SDP'], ['ACK', 'Xác nhận cuối của INVITE'], ['BYE', 'Kết thúc cuộc gọi'], ['CANCEL', 'Huỷ khi chưa có người nghe'], ['OPTIONS', 'Hỏi khả năng, hay dùng để kiểm tra còn sống'],
    ['100 Trying', 'Đã nhận, đang xử lý'], ['180 Ringing', 'Đang đổ chuông'], ['183 Session Progress', 'Có âm thanh sớm, như hồi chuông của nhà mạng'], ['200 OK', 'Thành công'], ['401, 407', 'Cần xác thực'], ['403', 'Bị từ chối'], ['404', 'Không có số này'], ['486', 'Máy bận'], ['488', 'Không chấp nhận codec'], ['503', 'Dịch vụ không sẵn sàng'],
  ]),
  S('Voice', 'CUCME, không có trong Lab', CMD, [
    ['telephony-service', 'Bật CUCME trên router'], ['max-ephones 10', 'Số điện thoại tối đa'], ['max-dn 20', 'Số máy nhánh tối đa'], ['ip source-address 10.10.50.1 port 2000', 'IP điện thoại đăng ký SCCP'], ['create cnf-files', 'Tạo file cấu hình cho điện thoại'], ['ephone-dn 1', 'Tạo số máy nhánh'], ['number 2001', 'Đặt số'], ['ephone 1', 'Khai báo điện thoại'], ['mac-address 0011.2233.4455', 'MAC của điện thoại'], ['button 1:1', 'Gán nút 1 với ephone-dn 1'],
    ['option 150 ip 10.10.50.1', 'DHCP: địa chỉ TFTP cho điện thoại Cisco'], ['dial-peer voice 10 voip', 'Tạo dial-peer'], ['destination-pattern 3...', 'Số gọi khớp, dấu chấm là một chữ số bất kỳ'], ['session target ipv4:10.30.0.1', 'Gửi cuộc gọi tới đâu'], ['session protocol sipv2', 'Dùng SIP thay H.323 mặc định'], ['codec g711ulaw', 'Chọn codec'], ['dtmf-relay rtp-nte', 'Truyền phím bấm'], ['show ephone', 'Xem điện thoại đã đăng ký'], ['show dial-peer voice summary', 'Xem dial-peer'], ['show call active voice brief', 'Xem cuộc gọi đang chạy'], ['debug ccsip messages', 'Xem bản tin SIP'],
  ], 'Viết theo cú pháp IOS phổ biến, chưa chạy trên thiết bị thật, cần router có giấy phép và IOS thoại.'),
  S('Voice', 'Sự cố thoại', ['Dấu hiệu', 'Kiểm tra'], [
    ['Điện thoại không lên', 'PoE, Voice VLAN, DHCP, option 150, tường lửa tới tổng đài'], ['Đăng ký thất bại', 'Sai mật khẩu, sai địa chỉ tổng đài, mã 401, 403'], ['Gọi không được', 'Mã 404, 488, sai dial-peer, không có codec chung'], ['Nghe một chiều', 'NAT, ACL, tường lửa chặn RTP, thiếu route về'], ['Rè, ngắt quãng', 'Mất gói, jitter, thiếu QoS, lệch duplex'], ['Có tiếng vang', 'Thiết bị đầu cuối, gateway, độ trễ cao'], ['Mất tiếng sau 30 giây', 'ACK không tới, thường do NAT hoặc SIP ALG'],
  ], 'Mục tiêu: trễ một chiều dưới 150 ms, jitter dưới 30 ms, mất gói dưới 1%. Trong Wireshark dùng Telephony, VoIP Calls.'),
  // ---------- Nâng cao ----------
  S('CCNP nâng cao', 'Thiết kế và ảo hoá', ['Tên', 'Ý nghĩa'], [
    ['3 lớp', 'Access, Distribution, Core'], ['Collapsed core', 'Gộp Core và Distribution cho mạng vừa'], ['Spine-leaf', 'Leaf nối mọi spine, dùng trong trung tâm dữ liệu'], ['StackWise, VSS', 'Gộp nhiều switch thành một thiết bị logic'], ['NSF, SSO', 'Tiếp tục chuyển gói khi đổi bộ điều khiển'],
    ['VRF', 'Nhiều bảng định tuyến trên một router'], ['Hypervisor', 'Chạy máy ảo, loại 1 trên phần cứng, loại 2 trên hệ điều hành'], ['NFV', 'Chạy firewall, router trên máy ảo thay thiết bị riêng'],
  ]),
  S('CCNP nâng cao', 'Công nghệ fabric', ['Tên', 'Ý nghĩa'], [
    ['MPLS', 'Chuyển gói theo nhãn. LDP phân phối nhãn, P-router đổi nhãn'], ['Segment Routing', 'Nhãn nguồn, không cần LDP, phân phối qua IGP'], ['VXLAN', 'Khung tầng 2 trong UDP 4789, VNI 24 bit'], ['EVPN', 'Dùng BGP làm mặt phẳng điều khiển cho VXLAN'], ['LISP', 'Tách vị trí (RLOC) và định danh (EID)'],
    ['SD-Access', 'LISP, VXLAN và SGT. Catalyst Center quản lý, ISE gán nhóm'], ['SD-WAN', 'vManage quản lý, vSmart điều khiển bằng OMP, vBond xác thực, vEdge chuyển gói'], ['DMVPN', 'mGRE, NHRP, IPsec. Spoke nói chuyện trực tiếp với nhau'], ['BFD', 'Phát hiện đứt đường trong mili giây, báo cho giao thức định tuyến'],
  ]),
  S('CCNP nâng cao', 'Lệnh VRF, DMVPN, BFD', CMD, [
    ['vrf definition KHACH', 'Tạo VRF'], ['address-family ipv4', 'Bật IPv4 trong VRF'], ['vrf forwarding KHACH', 'Gán cổng vào VRF, nhớ đặt lại IP'], ['show ip route vrf KHACH', 'Xem bảng của VRF'], ['tunnel mode gre multipoint', 'DMVPN: mGRE'], ['ip nhrp nhs 172.16.0.254 nbma 40.0.0.254 multicast', 'DMVPN: spoke khai hub'], ['ip nhrp redirect', 'DMVPN pha 3: trên hub'], ['ip nhrp shortcut', 'DMVPN pha 3: trên spoke'], ['bfd interval 50 min_rx 50 multiplier 3', 'Chu kỳ BFD trên cổng'], ['ip ospf bfd', 'Cho OSPF dùng BFD'],
  ]),
  S('CCNP nâng cao', 'Đo và kiểm tra', CMD, [
    ['ip sla 1', 'Tạo phép đo'], ['icmp-echo 8.8.8.8', 'Đo bằng ping'], ['ip sla schedule 1 life forever start-time now', 'Chạy phép đo'], ['track 1 ip sla 1 reachability', 'Theo dõi kết quả'], ['ip route 0.0.0.0 0.0.0.0 10.0.0.1 track 1', 'Route chỉ dùng khi phép đo đạt'], ['monitor session 1 source interface g0/1', 'SPAN: chọn cổng cần chép'], ['monitor session 1 destination interface g0/2', 'SPAN: cổng nối máy phân tích'],
    ['ip flow-export destination 10.0.0.9 2055', 'NetFlow: gửi tới collector'], ['show ip cef', 'Xem bảng CEF'],
    ['ip sla responder', 'Đầu nhận của phép đo udp-jitter'], ['udp-jitter 10.0.0.2 16384 codec g711alaw', 'Đo jitter, mất gói và MOS cho thoại'], ['show ip sla statistics', 'Xem kết quả đo'],
    ['telemetry ietf subscription 101', 'Tạo đăng ký telemetry'], ['stream yang-push', 'Nguồn dữ liệu theo YANG'], ['filter xpath /process-cpu-ios-xe-oper:cpu-usage/cpu-utilization/five-seconds', 'Chọn dữ liệu cần gửi'], ['encoding encode-kvgpb', 'Mã hoá dữ liệu'], ['update-policy periodic 1000', 'Gửi mỗi 10 giây, đơn vị là phần trăm giây'], ['receiver ip address 10.0.0.50 57000 protocol grpc-tcp', 'Địa chỉ collector'], ['show telemetry ietf subscription all', 'Xem đăng ký và trạng thái collector'],
  ]),
  S('CCNP nâng cao', 'ENAUTO: gọi API từ Python', ['Việc', 'Cách làm'], [
    ['CLI qua SSH', 'Netmiko: ConnectHandler(...), send_command("show version"), send_config_set([...])'],
    ['NETCONF', 'ncclient: manager.connect(host=ip, port=830, ...), get_config("running", filter=f), edit_config(target="running", config=xml)'],
    ['RESTCONF', 'requests.put(url, auth=(u, p), headers=h, json=body), Content-Type application/yang-data+json'],
    ['Token Catalyst Center', 'POST /dna/system/api/v1/auth/token, gửi kèm header X-Auth-Token'],
    ['Token SD-WAN Manager', 'Đăng nhập phiên, lấy token rồi gửi header X-XSRF-TOKEN'],
    ['Khoá API Meraki', 'Header Authorization: Bearer <key>'],
    ['Đọc cây YANG', 'pyang -f tree file.yang. rw cấu hình, ro trạng thái, ? không bắt buộc, * danh sách'],
    ['Jinja2', '{% for v in vlans %}, {% if v.voice %}, {{ name | upper }}, cắt khoảng trắng bằng {%- và -%}'],
    ['Guest Shell', 'iox, guestshell enable, guestshell run python3 file.py; trong đó from cli import cli'],
    ['MCP bằng FastMCP', 'mcp = FastMCP("net"), đặt @mcp.tool() trên hàm có kiểu tham số rõ ràng, mcp.run()'],
  ]),
  S('CCNP nâng cao', 'ENAUTO: mã lỗi API', ['Mã', 'Hay do đâu'], [
    ['400', 'Dữ liệu gửi lên sai dạng'], ['401', 'Thiếu hoặc hết token'], ['403', 'Tài khoản không đủ quyền'],
    ['404', 'Sai đường dẫn hoặc đối tượng chưa có'], ['409', 'Đối tượng đã tồn tại, thường gặp khi POST lần hai'], ['429', 'Gọi quá nhanh, đợi theo Retry-After'],
  ]),
  S('CCNP nâng cao', 'ENSDWI: kiểm tra SD-WAN', CMD, [
    ['show sdwan control connections', 'Kết nối DTLS tới Validator, Manager, Controller'],
    ['show sdwan control local-properties', 'System-ip, site-id, organization-name, chứng chỉ'],
    ['show sdwan omp routes', 'vRoute học từ Controller'],
    ['show sdwan omp tlocs', 'TLOC đã biết'],
    ['show sdwan bfd sessions', 'Từng đường hầm tới edge khác và trạng thái BFD'],
  ], 'Lab không mô phỏng SD-WAN, các lệnh này để đối chiếu khi làm trên thiết bị thật.'),
  S('CCNP nâng cao', 'ENSDWI: khái niệm', ['Tên', 'Ý nghĩa'], [
    ['VPN 0, 512', 'VPN 0 là transport, VPN 512 là quản lý, còn lại là dịch vụ'],
    ['TLOC', 'Điểm cuối đường hầm: system-ip, color, encapsulation'],
    ['Color restrict', 'Chỉ dựng hầm với TLOC cùng color'],
    ['Control policy, data policy', 'Control đổi cách quảng bá route trên Controller, data xử lý từng luồng trên edge'],
    ['AAR', 'Chọn đường theo SLA class về mất gói, trễ, jitter'],
    ['Lỗi control plane hay gặp', 'Lệch giờ, sai organization-name, chứng chỉ hết hạn, chặn DTLS UDP 12346'],
  ]),
  S('CCNP nâng cao', 'ENSLD: so sánh khi thiết kế', ['Chọn', 'Khi nào'], [
    ['IS-IS', 'Lõi lớn, biên vùng nằm trên link, chạy trên lớp 2. Lab không mô phỏng IS-IS'],
    ['Stub, tóm tắt', 'Giới hạn phạm vi Query của EIGRP và LSA của OSPF'],
    ['RR hay confederation', 'Thay iBGP full mesh. RR đơn giản hơn nên dùng nhiều hơn'],
    ['NSF, NSR', 'NSF cần láng giềng hỗ trợ, NSR thì không'],
    ['SSM, bidir, MSDP', 'SSM không cần RP, bidir cho nhiều nguồn, MSDP báo nguồn giữa các RP'],
    ['GET VPN', 'Mã hoá nhóm, giữ IP header, hợp trên MPLS riêng'],
    ['gRPC, gNMI', 'gRPC là lớp vận chuyển trên HTTP/2, gNMI là giao diện quản lý chạy trên đó'],
  ]),
  S('CCNP nâng cao', 'ENCC: nối cloud', ['Tên', 'Ý nghĩa'], [
    ['Qua Internet', 'IPsec tới AWS VGW hoặc TGW, Azure VPN Gateway, Google HA VPN'],
    ['Kết nối riêng', 'AWS Direct Connect, Azure ExpressRoute, Google Cloud Interconnect'],
    ['SDCI', 'Dịch vụ cross-connect theo phần mềm qua hãng trung gian'],
    ['Tải lớn hỏng, ping nhỏ được', 'Thường do MTU. ip mtu 1400, ip tcp adjust-mss 1360, thử ping df-bit'],
    ['Hầm lên, không có route', 'Xem BGP, route table bên cloud đã bật propagation chưa, security group'],
    ['Thực hành', 'Lab K01: GRE trên IPsec và eBGP trong hầm'],
  ]),
  S('CCNP nâng cao', 'ENNA: đo và phân tích', ['Tên', 'Ý nghĩa'], [
    ['Active, passive', 'Active tự tạo lưu lượng đo, passive quan sát lưu lượng thật'],
    ['Cloud, Enterprise, Endpoint Agent', 'Đo từ Internet, từ trong mạng, từ máy người dùng'],
    ['Waterfall', 'Tách DNS, kết nối, TLS, chờ server, tải tài nguyên'],
    ['BGP hijack, route leak', 'Đường đi hoặc AS gốc đổi đột ngột'],
    ['DNS hijack', 'Trả về IP sai, so kết quả từ nhiều nơi'],
    ['Báo giả', 'Yêu cầu lệch trong nhiều lần đo trước khi cảnh báo'],
  ]),
  S('CCNP nâng cao', 'WLSI: Wi-Fi nâng cao', ['Tên', 'Ý nghĩa'], [
    ['FlexConnect connected, standalone', 'Còn hoặc mất WLC. Standalone vẫn phục vụ theo cấu hình đã có'],
    ['Local, central switching', 'Dữ liệu ra ngay switch hoặc về WLC'],
    ['Platinum, Gold, Silver, Bronze', 'Thoại, video, mặc định, nền'],
    ['EF về UP 6, AF41 về UP 5', 'Ánh xạ DSCP sang WMM'],
    ['Multicast Direct', 'Đổi multicast thành unicast cho từng máy'],
    ['CWA, LWA', 'Cổng khách trên ISE, hoặc trên WLC'],
    ['CMX, Spaces', 'Định vị đặt tại chỗ, hoặc trên cloud'],
  ]),
  S('CCNP nâng cao', 'WLCOR: RF, AP, máy khách', ['Tên', 'Ý nghĩa'], [
    ['SNR', 'RSSI trừ nhiễu nền'],
    ['+3 dB, +10 dB', 'Gấp đôi, gấp mười công suất. 0 dBm là 1 mW'],
    ['EIRP', 'Công suất phát trừ suy hao cáp cộng độ lợi ăng-ten'],
    ['CAPWAP', 'UDP 5246 điều khiển, UDP 5247 dữ liệu'],
    ['AP tìm WLC', 'Broadcast, WLC đã lưu, DHCP option 43, DNS CISCO-CAPWAP-CONTROLLER'],
    ['Tag trên 9800', 'Policy tag, site tag, RF tag'],
    ['802.11k, r, v', 'k gợi ý AP lân cận, r đổi khoá nhanh, v gợi ý chuyển AP'],
    ['Thực hành', 'Lab W01–W05'],
  ]),
  S('CCNP nâng cao', 'WLSD: thiết kế Wi-Fi', ['Tên', 'Ý nghĩa'], [
    ['Layer 1 survey', 'Tìm nhiễu không phải Wi-Fi bằng máy phân tích phổ'],
    ['Predictive, pre, post', 'Mô hình trên bản vẽ, đặt thử AP tại chỗ, xác nhận sau khi lắp'],
    ['RxSOP', 'Bỏ qua tín hiệu dưới ngưỡng, đặt cao quá làm rớt máy ở xa'],
    ['Mobility trên 9800', 'UDP 16666 điều khiển, UDP 16667 dữ liệu'],
    ['Anchor, foreign', 'Roam khác VLAN giữ IP qua hầm giữa hai WLC'],
    ['SSO, N+1', 'SSO đồng bộ trạng thái, N+1 thì AP phải join lại'],
    ['EWC', 'Controller chạy trên AP, cho site nhỏ'],
  ]),
  S('CCNP nâng cao', 'SCOR: bảo mật', ['Tên', 'Ý nghĩa'], [
    ['CVE, CVSS', 'Mã lỗ hổng, điểm 0–10'],
    ['ESP, AH, IKE, NAT-T', 'IP 50, IP 51, UDP 500, UDP 4500'],
    ['TACACS+, RADIUS', 'TCP 49 mã hoá cả gói, UDP 1812/1813 chỉ mã hoá mật khẩu'],
    ['SSE, SASE', 'SSE gồm SWG, CASB, ZTNA, FWaaS. SASE là SSE cộng SD-WAN'],
    ['EPP, EDR', 'Chặn trước khi chạy, ghi hành vi để phát hiện sau'],
    ['SIEM, SOAR, XDR', 'Gom log, tự động xử lý, nối dữ liệu nhiều nguồn'],
    ['CoA', 'ISE đổi quyền phiên đang chạy, UDP 1700 hoặc 3799'],
    ['MAB', 'Dùng MAC làm danh tính, nên kèm profiling'],
  ], 'Firewall trong Lab là ASA và ZBF, không có FTD.'),
  S('CCNP nâng cao', 'DCCOR: trung tâm dữ liệu', ['Tên', 'Ý nghĩa'], [
    ['vPC', 'Hai switch như một với máy đấu LACP, cần peer-keepalive và peer-link'],
    ['ACI', 'APIC, tenant, VRF, bridge domain, EPG, contract'],
    ['Access policies của ACI', 'VLAN pool, domain, AAEP, policy group, profile'],
    ['Service profile', 'Danh tính máy chủ UCS tách khỏi phần cứng'],
    ['FLOGI, FCID', 'Máy chủ vào fabric, nhận địa chỉ 24 bit domain, area, port'],
    ['NPV, NPIV', 'NPV không nhận domain ID, NPIV cho nhiều login trên một cổng'],
    ['EPLD, ISSU', 'Firmware phần cứng thường gián đoạn, ISSU không gián đoạn nếu hỗ trợ'],
    ['RoCEv2, PFC, ECN', 'RDMA trên Ethernet, dừng theo lớp, báo nghẽn sớm'],
  ], 'Lab không mô phỏng NX-OS, ACI, UCS, FC.'),
  S('CCNP nâng cao', 'SPCOR: nhà mạng', ['Tên', 'Ý nghĩa'], [
    ['Uniform, Pipe, Short Pipe', 'Một miền; egress theo dấu nhà mạng; egress theo dấu khách'],
    ['RTBH', 'Route về null để bỏ gói tới IP bị tấn công'],
    ['Prefix, adjacency SID', 'Theo đích, theo link'],
    ['TI-LFA, PCE', 'Đường vòng tính sẵn, tính đường tập trung'],
    ['Inter-AS A, B, C', 'VRF liền nhau; đổi VPNv4 ở biên; multihop giữa RR'],
    ['802.1ad, 802.1ah, G.8032', 'QinQ, MAC-in-MAC, chống lặp vòng Ethernet'],
    ['DS-Lite, MAP-T', 'IPv4 trong hầm IPv6 về CGN, dịch mà nhà mạng không giữ trạng thái từng luồng'],
    ['NSO', 'Mô hình dịch vụ YANG, NED nói chuyện với nhiều hãng'],
  ], 'Lab CLI không có IOS XR, IS-IS, SR, TE, EVPN. Gói tin xem s29, s31, s32, s34.'),
  S('CCNP nâng cao', 'CLCOR: thoại và Webex', ['Tên', 'Ý nghĩa'], [
    ['Partition, CSS', 'Nhóm số, và các nhóm mà máy gọi được thấy'],
    ['Route pattern tới thiết bị', 'Route pattern, route list, route group, thiết bị'],
    ['Translation, transformation', 'Đổi số trước khi tìm tiếp, đổi số trước khi gửi'],
    ['DTMF', 'RFC 2833/4733 trong RTP, trên CUBE dùng dtmf-relay rtp-nte'],
    ['Expressway, CUBE', 'Nối thiết bị ngoài Internet, SBC cho SIP trunk'],
    ['EF, AF41, CS3', 'Thoại, video, báo hiệu'],
    ['Option 150', 'DHCP báo TFTP cho điện thoại'],
    ['AXL, SCIM', 'API cấu hình CUCM, cách chuẩn đồng bộ người dùng lên cloud'],
  ], 'Xem SIP và RTP ở kịch bản s40.'),
  S('CCNP nâng cao', 'Tự động hoá', ['Tên', 'Ý nghĩa'], [
    ['Mặt phẳng', 'Management quản lý, Control tính đường, Data chuyển gói'], ['SDN', 'Tách Control khỏi Data, có bộ điều khiển trung tâm'], ['API hướng bắc, hướng nam', 'Ứng dụng với controller, controller với thiết bị'], ['REST', 'GET đọc, POST tạo, PUT thay, PATCH sửa, DELETE xoá'], ['Mã HTTP', '200 thành công, 201 đã tạo, 401 chưa xác thực, 403 không có quyền, 404 không có, 500 lỗi server'],
    ['NETCONF', 'TCP 830 qua SSH, dữ liệu XML, theo YANG'], ['RESTCONF', 'HTTPS, dữ liệu JSON hoặc XML, theo YANG'], ['Ansible', 'Không cần agent, playbook YAML, đẩy qua SSH'], ['Puppet, Chef', 'Có agent, kéo cấu hình về'], ['SaltStack', 'Có cả minion dùng agent và salt-ssh không agent'], ['Telemetry', 'Thiết bị chủ động đẩy số liệu liên tục'],
  ]),
  S('CCNP nâng cao', 'Cách quản lý mạng', ['Cách', 'Đặc điểm'], [
    ['Theo thiết bị', 'Cấu hình từng máy qua CLI, dễ sai khi nhiều máy'], ['Dựa trên cloud', 'Quản lý qua cổng cloud, như Meraki'], ['Dựa trên controller', 'Một bộ điều khiển đẩy chính sách, như Catalyst Center'], ['Tự động hoá', 'Script hoặc công cụ chạy cùng một việc trên nhiều máy, như Ansible'], ['Hạ tầng dưới dạng mã (IaC)', 'Cấu hình lưu thành file trong Git, có review và triển khai lại được'],
  ]),
  S('CCNP nâng cao', 'AI trong vận hành mạng', ['Tên', 'Ý nghĩa'], [
    ['AI tạo sinh', 'Trả lời hoặc soạn nội dung theo prompt'], ['Agentic AI', 'Tự lập các bước và gọi công cụ để làm một mục tiêu, ví dụ thu log rồi đề xuất cách sửa'], ['Prompt: vai trò', 'Ví dụ: bạn là kỹ sư mạng đang xử lý sự cố OSPF'], ['Prompt: chỉ dẫn', 'Nêu rõ việc cần làm và kèm dữ liệu liên quan'], ['Prompt: định dạng', 'Ví dụ: trả lời bằng bảng, hoặc các lệnh theo thứ tự'], ['Phân loại dữ liệu', 'Xoá mật khẩu, khoá, IP nội bộ trước khi gửi nếu công cụ không được phép nhận'], ['Kiểm tra kết quả', 'Đối chiếu với show và tài liệu, thử trên lab trước khi áp vào mạng thật'],
  ]),
  S('CCNP nâng cao', 'Python, JSON và EEM', CMD, [
    ['requests.get(url, auth=(user, pwd), headers=h)', 'Python: gọi REST API'], ['r.json()["hostname"]', 'Python: đọc trường trong JSON'], ['ConnectHandler(**device).send_command("show version")', 'Python, Netmiko: chạy lệnh qua SSH'], ['ansible-playbook -i hosts site.yml', 'Ansible: chạy playbook'],
    ['event manager applet SAOLUU', 'EEM: tạo applet'], ['event syslog pattern "LINK-3-UPDOWN"', 'EEM: kích hoạt theo log'], ['event timer cron cron-entry "0 1 * * *"', 'EEM: kích hoạt theo giờ'], ['action 1.0 cli command "enable"', 'EEM: lệnh chạy khi kích hoạt'], ['show event manager policy registered', 'EEM: xem các applet'],
  ], 'JSON: khoá nằm trong ngoặc kép, dùng {} cho đối tượng và [] cho danh sách, không có dấu phẩy thừa ở cuối.'),
  // ---------- Vận hành ----------
  S('Vận hành', 'Quy trình xử lý sự cố', ['Bước', 'Việc làm'], [
    ['1', 'Xác định vấn đề'], ['2', 'Thu thập thông tin'], ['3', 'Phân tích và đặt giả thuyết'], ['4', 'Thực hiện cách sửa'], ['5', 'Kiểm tra toàn bộ kết nối'], ['6', 'Ghi lại cách xử lý'],
  ], 'Cách tiếp cận: từ dưới lên, từ trên xuống, hoặc chia đôi từ tầng 3.'),
  S('Vận hành', 'Ký hiệu và trạng thái', ['Hiển thị', 'Ý nghĩa'], [
    ['ping !', 'Có trả lời'], ['ping .', 'Hết giờ'], ['ping U', 'Đích không tới được'], ['traceroute *', 'Chặng đó không trả lời'], ['up/up', 'Cổng hoạt động'], ['up/down', 'Lỗi tầng 2, sai encapsulation hoặc keepalive'], ['down/down', 'Lỗi tầng 1, cáp hoặc đầu kia'], ['administratively down', 'Cổng đang shutdown'], ['err-disabled', 'Bị tắt do port security, BPDU Guard'],
    ['CRC tăng', 'Cáp, nhiễu, hoặc lệch duplex'], ['Late collision', 'Thường do lệch duplex'], ['Runt, giant', 'Khung quá ngắn, quá dài'],
  ]),
  S('Vận hành', 'Máy không vào được Internet', ['Bước', 'Kiểm tra'], [
    ['1', 'IP, mask, gateway bằng ipconfig /all'], ['2', 'Ping gateway'], ['3', 'Ping 8.8.8.8 để loại trừ DNS'], ['4', 'nslookup kiểm tra DNS'], ['5', 'Route mặc định trên router'], ['6', 'NAT và ACL trên đường ra'], ['7', 'Đường truyền của nhà mạng'],
  ]),
  S('Vận hành', 'OSPF không lên láng giềng', ['Bước', 'Kiểm tra'], [
    ['1', 'Cổng up/up, ping được đầu kia'], ['2', 'Area, subnet, mask'], ['3', 'Hello và Dead, network type'], ['4', 'Xác thực'], ['5', 'MTU nếu kẹt ở ExStart'], ['6', 'Cổng có đang passive, ACL có chặn IP 89'],
  ]),
  S('Vận hành', 'Sao lưu và debug', CMD, [
    ['copy running-config tftp:', 'Sao lưu cấu hình'], ['copy tftp: running-config', 'Khôi phục, lệnh sẽ gộp vào cấu hình hiện tại'], ['copy flash: tftp:', 'Sao lưu IOS'], ['archive', 'Tự lưu các bản cấu hình'], ['terminal monitor', 'Xem log khi dùng SSH'], ['debug ip ospf adj', 'Xem quá trình lên láng giềng'], ['undebug all', 'Tắt mọi debug'],
  ], 'Debug tốn CPU, hạn chế dùng trên thiết bị đang chạy thật.'),
  S('Vận hành', 'Sơ đồ mạng doanh nghiệp mẫu', ['Khu vực', 'Thành phần'], [
    ['Biên Internet', 'Hai ISP chạy eBGP, cặp firewall Active/Standby'], ['Core', 'Hai router, OSPF Area 0'], ['Distribution', 'Hai switch L3, HSRP hoặc VRRP làm gateway, EtherChannel'], ['Access', 'VLAN theo phòng ban và VLAN quản trị'], ['DMZ', 'Web, mail tách riêng sau firewall'], ['Server', 'Ứng dụng, cơ sở dữ liệu, file'], ['Chi nhánh', 'IPsec site-to-site'], ['Không dây', 'WLC, SSID nội bộ và SSID khách tách VLAN'],
  ]),
  S('Vận hành', 'Lệnh trên máy khách', ['Việc', 'Windows', 'macOS', 'Linux'], [
    ['Xem IP', 'ipconfig /all', 'ifconfig', 'ip addr'], ['Xem route', 'route print', 'netstat -rn', 'ip route'], ['Xem ARP', 'arp -a', 'arp -a', 'ip neigh'], ['Truy vết', 'tracert', 'traceroute', 'traceroute'], ['Tra DNS', 'nslookup', 'dig, nslookup', 'dig, nslookup'], ['Xin lại DHCP', 'ipconfig /renew', 'sudo ipconfig set en0 DHCP', 'sudo dhclient'], ['Xem Wi-Fi', 'netsh wlan show interfaces', 'wdutil info', 'iw dev wlan0 link'],
  ]),
  S('Vận hành', 'Ping mở rộng, bắt gói, debug có điều kiện', CMD, [
    ['ping 10.0.0.2 source loopback0', 'Chọn IP nguồn, kiểm tra cả đường về'], ['ping 10.0.0.2 size 1500 df-bit', 'Kiểm tra MTU'], ['traceroute 8.8.8.8 source g0/0', 'Truy vết từ cổng chọn trước'], ['show logging', 'Xem log'],
    ['monitor capture CAP interface g0/0 both', 'Bắt gói trên thiết bị: chọn cổng'], ['monitor capture CAP match any', 'Chọn lưu lượng'], ['monitor capture CAP start', 'Bắt đầu'], ['monitor capture CAP stop', 'Dừng'], ['show monitor capture CAP buffer brief', 'Xem gói đã bắt'],
    ['debug condition interface g0/0', 'Chỉ debug trên một cổng'], ['debug ip packet 101', 'Chỉ debug gói khớp ACL'], ['show debugging', 'Xem debug đang bật'],
  ]),
  S('Vận hành', 'Chép file bằng SCP, SFTP', CMD, [
    ['ip scp server enable', 'Cho thiết bị nhận file qua SCP, cần SSH và AAA'], ['copy running-config scp://admin@10.0.0.9/r1.cfg', 'Sao lưu cấu hình qua SCP'], ['copy scp://admin@10.0.0.9/ios.bin flash:', 'Tải IOS về'], ['copy running-config sftp://admin@10.0.0.9/r1.cfg', 'Sao lưu cấu hình qua SFTP'], ['verify /md5 flash:ios.bin', 'Kiểm tra file không hỏng'], ['boot system flash:ios.bin', 'Chọn IOS cho lần khởi động sau'],
  ], 'SCP và SFTP mã hoá qua SSH, TFTP và FTP thì không.'),
  S('Xử lý sự cố', 'Mô hình bảo trì mạng', ['Mô hình', 'Nội dung'], [
    ['FCAPS', 'Fault, Configuration, Accounting, Performance, Security'], ['ITIL', 'Thực hành quản lý dịch vụ CNTT'], ['TMN', 'Mô hình của ITU-T, dựa trên FCAPS'], ['Cisco Lifecycle', 'PPDIOO: Prepare, Plan, Design, Implement, Operate, Optimize'], ['Việc có kế hoạch', 'Bảo trì trước khi có sự cố, giảm thời gian gián đoạn'], ['Việc đột xuất', 'Chỉ sửa khi có sự cố, nên giảm bớt'],
  ]),
  S('Xử lý sự cố', 'Phương pháp xử lý', ['Phương pháp', 'Cách làm', 'Khi dùng'], [
    ['Từ trên xuống', 'Bắt đầu từ ứng dụng, tầng 7', 'Nghi lỗi ứng dụng'], ['Từ dưới lên', 'Bắt đầu từ cáp, tầng 1', 'Nghi lỗi phần cứng, tốn thời gian hơn'], ['Chia đôi', 'Bắt đầu ở tầng 3 bằng ping, rồi đi lên hoặc xuống', 'Chưa rõ nguyên nhân'], ['Theo đường đi', 'Lần theo từng chặng của gói', 'Biết rõ sơ đồ'], ['So sánh', 'Đối chiếu cấu hình với máy đang chạy tốt', 'Có thiết bị mẫu'], ['Đổi linh kiện', 'Tráo cáp, module, cổng', 'Nghi lỗi phần cứng'],
  ]),
  S('Xử lý sự cố', 'Lệnh lọc và kiểm tra nhanh', CMD, [
    ['show run | section ospf', 'Chỉ xem phần OSPF'], ['show run | include ip route', 'Chỉ xem dòng khớp'], ['show run | begin line vty', 'Xem từ dòng khớp trở đi'], ['show ip route | exclude C', 'Bỏ dòng khớp'], ['show processes cpu sorted', 'Tiến trình tốn CPU nhất'], ['show memory statistics', 'Xem bộ nhớ'], ['show ip sockets', 'Xem cổng UDP router đang nghe, IOS mới dùng show udp'], ['show tcp brief', 'Xem phiên TCP, kể cả BGP'], ['telnet 10.0.0.2 179', 'Thử cổng TCP, như BGP, HTTP'], ['show ip interface g0/0', 'Xem ACL đã áp, Helper, Proxy ARP'], ['show interfaces g0/1 switchport', 'Xem chế độ và VLAN của cổng'], ['show port-security interface g0/1', 'Xem số vi phạm'], ['show ip access-lists', 'Xem số gói khớp từng dòng'], ['clear arp-cache', 'Xoá bảng ARP'],
  ]),
  S('Xử lý sự cố', 'Sự cố switching', ['Dấu hiệu', 'Kiểm tra'], [
    ['Trong VLAN không ping được', 'VLAN đã tạo chưa, cổng đúng VLAN chưa, cổng có up không'], ['Không qua được trunk', 'Chế độ DTP, encapsulation, allowed VLAN, native VLAN khớp chưa'], ['Log báo lệch native VLAN', 'CDP báo native VLAN mismatch trên hai đầu trunk'], ['Cổng blocked lạ', 'Root có đúng switch không, xem priority, cost'], ['Một VLAN không có STP', 'no spanning-tree vlan đã tắt, dễ gây vòng lặp'], ['EtherChannel không lên', 'Chế độ on, active, desirable phù hợp, các thông số cổng khớp'], ['Cổng err-disabled', 'Xem show interfaces status err-disabled, sửa nguyên nhân rồi shutdown, no shutdown'], ['Gateway dự phòng lỗi', 'Hai router cùng Active, VLAN giữa hai router có thông không'],
  ]),
  S('Xử lý sự cố', 'Sự cố EIGRP', ['Dấu hiệu', 'Kiểm tra'], [
    ['Không lên láng giềng', 'Số AS, K value, subnet, xác thực, passive-interface, ACL chặn 224.0.0.10'], ['Thiếu route', 'Lệnh network, distribute-list, auto-summary, split horizon ở hub'], ['Không chia tải', 'variance, feasibility condition, maximum-paths'], ['Stuck In Active', 'Query quá rộng: dùng stub và tóm tắt, kiểm tra đường yếu'], ['Lệnh hỗ trợ', 'debug ip eigrp, show ip eigrp interfaces, show ip eigrp topology all-links'],
  ]),
  S('Xử lý sự cố', 'Sự cố OSPF', ['Dấu hiệu', 'Kiểm tra'], [
    ['Kẹt ở Init', 'Hello một chiều, ACL chặn, multicast không qua'], ['Kẹt ở 2-Way', 'Bình thường giữa hai DROTHER; nếu không phải, kiểm tra priority 0'], ['Kẹt ở ExStart, Exchange', 'Lệch MTU, trùng Router ID'], ['Full nhưng thiếu route', 'Lệch network type, area type, distribute-list'], ['Thiếu route khác area', 'Area không nối về Area 0, cần virtual link'], ['Thiếu route ngoài', 'Thiếu subnets, đang ở stub area, thiếu metric'], ['Route mặc định không tới', 'default-information originate cần có route mặc định, hoặc thêm always'],
  ]),
  S('Xử lý sự cố', 'Sự cố BGP', ['Dấu hiệu', 'Kiểm tra'], [
    ['Kẹt ở Active', 'Không tới được IP láng giềng, cổng TCP 179 bị chặn, sai remote-as'], ['iBGP loopback không lên', 'Thiếu update-source, thiếu route tới loopback'], ['eBGP loopback không lên', 'Thiếu ebgp-multihop, thiếu route tĩnh'], ['Có route, không vào bảng định tuyến', 'Next-hop không tới được, dùng next-hop-self'], ['Không quảng bá được mạng', 'Lệnh network phải khớp đúng mask trong bảng định tuyến'], ['Route iBGP không lan tiếp', 'Thiếu full mesh hoặc route reflector'], ['Sai mật khẩu', 'Log báo MD5, phiên không lên'], ['Lệnh hỗ trợ', 'debug ip bgp, show ip bgp neighbors, show tcp brief'],
  ]),
  S('Xử lý sự cố', 'Sự cố dịch vụ', ['Dịch vụ', 'Kiểm tra', 'Lệnh'], [
    ['DHCP', 'Hết địa chỉ, sai network, thiếu helper-address, trùng IP', 'show ip dhcp pool, show ip dhcp conflict, debug ip dhcp server events'], ['NAT', 'Thiếu inside, outside, sai ACL, thiếu route về', 'show ip nat statistics, debug ip nat'], ['ACL', 'Sai chiều, sai vị trí, deny any ngầm', 'show ip access-lists, show ip interface'], ['NTP', 'Không tới được server, stratum, xác thực', 'show ntp status, show ntp associations'], ['SSH, Telnet', 'Thiếu khoá RSA, transport input, login', 'show ip ssh, show line vty 0'], ['IPv6', 'Thiếu ipv6 unicast-routing, sai tunnel, ACL chặn ND', 'show ipv6 interface, show ipv6 protocols, debug ipv6 nd'], ['Router bận', 'CPU cao, debug đang bật, ACL log', 'show processes cpu sorted'],
  ]),
  // ---------- Phỏng vấn ----------
  S('Phỏng vấn', 'Nền tảng và địa chỉ', QA, [
    ['Mô hình OSI là gì?', 'Khung 7 tầng mô tả cách dữ liệu đi qua mạng, giúp chia nhỏ việc xử lý sự cố.'],
    ['TCP khác UDP thế nào?', 'TCP có kết nối, tin cậy, chậm hơn. UDP không kết nối, nhanh, không đảm bảo.'],
    ['Subnetting là gì?', 'Chia một mạng lớn thành nhiều mạng nhỏ bằng cách mượn bit host.'],
    ['Netmask là gì?', 'Dãy bit tách phần mạng và phần host của địa chỉ IP.'],
    ['Wildcard mask là gì?', 'Bit 0 phải khớp, bit 1 bỏ qua. Dùng trong ACL và OSPF.'],
    ['VLSM là gì?', 'Dùng nhiều độ dài mask trong cùng một mạng để đỡ phí địa chỉ.'],
    ['CIDR là gì?', 'Bỏ khái niệm lớp, viết prefix dạng /n, cho phép gộp route.'],
    ['DHCP hoạt động ra sao?', 'Bốn bước DORA: Discover, Offer, Request, Acknowledge.'],
    ['BootP là gì?', 'Giao thức cũ cấp IP cho máy không có đĩa, DHCP đã thay thế.'],
    ['DNS là gì?', 'Đổi tên miền thành địa chỉ IP.'],
    ['HTTP khác HTTPS thế nào?', 'HTTP cổng 80, không mã hoá. HTTPS cổng 443, mã hoá bằng TLS.'],
    ['ICMP là gì?', 'Báo lỗi và chẩn đoán mạng, ping và traceroute dùng nó.'],
    ['Ping hoạt động ra sao?', 'Gửi ICMP Echo Request và chờ Echo Reply.'],
    ['TTL là gì?', 'Giảm 1 qua mỗi router, về 0 thì gói bị bỏ. Mặc định: Windows 128, Linux 64, Cisco 255.'],
    ['MTU là gì?', 'Kích thước gói lớn nhất đi được trên đường link, Ethernet là 1500 byte.'],
    ['ARP là gì?', 'Tìm MAC từ địa chỉ IP trong cùng mạng.'],
    ['Proxy ARP là gì?', 'Router trả lời ARP thay cho máy ở mạng khác.'],
    ['Port là gì?', 'Số logic xác định dịch vụ hoặc ứng dụng trên một máy.'],
    ['Loopback là gì?', 'Cổng ảo luôn up, dùng làm Router ID, quản trị và kiểm tra.'],
  ]),
  S('Phỏng vấn', 'Switching', QA, [
    ['VLAN là gì?', 'Chia switch vật lý thành nhiều mạng logic, mỗi VLAN là một miền broadcast.'],
    ['Access port khác trunk port thế nào?', 'Access thuộc một VLAN, không gắn thẻ. Trunk mang nhiều VLAN, gắn thẻ 802.1Q.'],
    ['STP là gì?', 'Chống vòng lặp tầng 2 bằng cách chặn bớt đường dự phòng.'],
    ['Root Bridge là gì?', 'Switch trung tâm của STP, có Bridge ID thấp nhất.'],
    ['BPDU là gì?', 'Khung điều khiển STP dùng để bầu root và tính đường. Nó không có tác dụng bảo mật.'],
    ['Các vai trò cổng STP?', 'Root, Designated, Alternate, Backup.'],
    ['Các trạng thái cổng STP?', 'Blocking, Listening, Learning, Forwarding, Disabled.'],
    ['EtherChannel là gì?', 'Gộp nhiều đường vật lý thành một đường logic, dùng LACP hoặc PAgP.'],
    ['VTP là gì?', 'Đồng bộ danh sách VLAN giữa các switch Cisco trong cùng domain.'],
    ['ERPS là gì?', 'Bảo vệ mạng vòng Ethernet theo ITU-T G.8032, phục hồi dưới 50 ms.'],
    ['CDP và LLDP là gì?', 'Phát hiện thiết bị kế cận. CDP của Cisco, LLDP là chuẩn mở.'],
    ['Link Aggregation là gì?', 'Tên chung của việc gộp đường, tăng băng thông và dự phòng.'],
  ]),
  S('Phỏng vấn', 'Routing', QA, [
    ['Routing là gì?', 'Chọn đường tốt nhất và chuyển gói giữa các mạng.'],
    ['Static khác dynamic route thế nào?', 'Static do người cấu hình, không tự đổi. Dynamic tự học và tự cập nhật.'],
    ['Default route là gì?', 'Route 0.0.0.0/0, dùng khi không có route cụ thể hơn.'],
    ['Floating static route là gì?', 'Route tĩnh có AD cao hơn route chính, chỉ dùng khi route chính mất.'],
    ['AD là gì?', 'Độ tin cậy của nguồn route, càng thấp càng tin.'],
    ['Route summarization là gì?', 'Gộp nhiều route thành một để bảng định tuyến nhỏ hơn.'],
    ['Route redistribution là gì?', 'Chia sẻ route giữa các giao thức định tuyến khác nhau.'],
    ['Split Horizon là gì?', 'Không quảng bá route ngược ra cổng đã học được nó.'],
    ['Poison Reverse là gì?', 'Quảng bá ngược route với metric vô hạn.'],
    ['OSPF là gì?', 'Giao thức link state, dùng SPF, phân area, hỗ trợ VLSM, AD 110.'],
    ['Thuật toán SPF là gì?', 'Thuật toán Dijkstra, tính đường ngắn nhất từ LSDB.'],
    ['Các trạng thái láng giềng OSPF?', 'Down, Init, 2-Way, ExStart, Exchange, Loading, Full.'],
    ['Hello và Dead của OSPF?', 'Mặc định 10 và 40 giây trên broadcast và point-to-point. Hết Dead thì láng giềng bị coi là mất.'],
    ['Passive interface là gì?', 'Không gửi Hello ra cổng nhưng vẫn quảng bá mạng của cổng đó.'],
    ['Stub area là gì?', 'Area không nhận LSA ngoài type 5, giúp giảm LSDB.'],
    ['Totally stub area là gì?', 'Chặn thêm type 3, chỉ nhận route mặc định.'],
    ['NSSA là gì?', 'Stub area nhưng có ASBR bên trong, dùng LSA 7 rồi đổi thành 5 ở ABR.'],
    ['EIGRP là gì?', 'Distance vector nâng cao của Cisco, hội tụ nhanh, dùng DUAL.'],
    ['DUAL là gì?', 'Thuật toán của EIGRP, tìm đường không lặp và có sẵn đường dự phòng.'],
    ['Feasible successor là gì?', 'Đường dự phòng không lặp của EIGRP, dùng ngay khi đường chính mất.'],
    ['BGP là gì?', 'Giao thức path vector, trao đổi route giữa các AS, chạy TCP 179.'],
    ['BGP chọn đường thế nào?', 'Weight, Local Preference, Locally originated, AS Path, Origin, MED, eBGP hơn iBGP, metric IGP, Router ID, IP láng giềng.'],
  ]),
  S('Phỏng vấn', 'Dịch vụ, gateway, NAT', QA, [
    ['HSRP, VRRP, GLBP khác nhau thế nào?', 'HSRP của Cisco, VRRP là chuẩn mở, cả hai một gateway hoạt động. GLBP của Cisco và chia tải.'],
    ['NAT là gì?', 'Đổi địa chỉ IP, thường từ riêng sang công cộng. Có tĩnh, động, PAT.'],
    ['PAT hay NAT overload là gì?', 'Nhiều IP riêng dùng chung một IP công cộng, phân biệt bằng số cổng.'],
    ['SNAT và DNAT là gì?', 'SNAT đổi địa chỉ nguồn, DNAT đổi địa chỉ đích.'],
    ['ACL là gì?', 'Danh sách lọc lưu lượng theo quy tắc. Standard theo nguồn, Extended theo nhiều tiêu chí.'],
    ['QoS là gì?', 'Ưu tiên lưu lượng quan trọng khi mạng nghẽn.'],
    ['DiffServ là gì?', 'Mô hình QoS phân lớp lưu lượng bằng trường DSCP trong IP.'],
    ['CoS là gì?', 'Đánh dấu ưu tiên tầng 2 trong thẻ 802.1Q, giá trị 0–7.'],
    ['NetFlow là gì?', 'Thống kê lưu lượng theo luồng: IP, cổng, giao thức, số byte.'],
    ['Syslog là gì?', 'Gửi log từ thiết bị về một máy chủ trung tâm.'],
    ['NTP là gì?', 'Đồng bộ đồng hồ thiết bị, cần cho log và chứng chỉ.'],
    ['TFTP là gì?', 'Truyền file đơn giản qua UDP 69, không xác thực.'],
    ['BFD là gì?', 'Phát hiện đứt đường trong mili giây, báo cho giao thức định tuyến.'],
  ]),
  S('Phỏng vấn', 'Bảo mật, VPN, xu hướng', QA, [
    ['AAA là gì?', 'Authentication xác minh danh tính, Authorization cấp quyền, Accounting ghi nhận.'],
    ['RADIUS khác TACACS+ thế nào?', 'RADIUS UDP, chỉ mã hoá mật khẩu. TACACS+ TCP 49, mã hoá toàn bộ và tách từng phần AAA.'],
    ['802.1X là gì?', 'Kiểm soát truy cập theo cổng, gồm supplicant, authenticator, authentication server.'],
    ['IPsec là gì?', 'Bộ giao thức bảo mật gói IP, có chế độ Transport và Tunnel.'],
    ['GRE là gì?', 'Đóng gói nhiều giao thức trong IP, không mã hoá.'],
    ['VPN là gì?', 'Kênh riêng qua mạng công cộng. Có site-to-site và remote access.'],
    ['MPLS là gì?', 'Chuyển gói theo nhãn ngắn thay vì tra địa chỉ IP, hỗ trợ VPN và điều khiển lưu lượng.'],
    ['802.11 là gì?', 'Họ chuẩn mạng không dây, từ a/b/g đến n, ac, ax.'],
    ['Zero Trust là gì?', 'Không mặc nhiên tin ai, luôn xác minh, quyền tối thiểu, coi như đã bị xâm nhập.'],
    ['Microsegmentation là gì?', 'Chia mạng thành phần rất nhỏ để giới hạn di chuyển ngang.'],
    ['SDN là gì?', 'Tách mặt phẳng điều khiển khỏi dữ liệu, quản lý tập trung bằng phần mềm.'],
    ['NFV là gì?', 'Chạy chức năng mạng trên máy ảo thay vì phần cứng riêng.'],
    ['API trong mạng là gì?', 'Giao diện để ứng dụng tự động đọc và cấu hình thiết bị.'],
    ['Telemetry là gì?', 'Thiết bị đẩy dữ liệu liên tục để giám sát theo thời gian thực.'],
    ['SIP và RTP khác nhau thế nào?', 'SIP lo báo hiệu cuộc gọi, RTP mang âm thanh và thường đi thẳng giữa hai máy.'],
  ]),
  S('Phỏng vấn', 'Tình huống', QA, [
    ['Người dùng không vào được Internet, xử lý sao?', 'Đi từ tầng dưới lên: IP, ping gateway, DNS, route, NAT, firewall, đường truyền.'],
    ['Láng giềng OSPF bị down, xử lý sao?', 'Trạng thái cổng, kết nối IP, area, xác thực, MTU, network type, timer. Dùng show ip ospf neighbor và show ip ospf interface.'],
    ['Khi cuộc gọi bị nghe một chiều, kiểm tra gì?', 'Báo hiệu đã xong nên lỗi thường ở đường RTP: NAT, ACL, tường lửa, route về của một chiều.'],
    ['Kể về dự án hiện tại?', 'Tự chuẩn bị theo trình tự: quy mô mạng, thiết bị và giao thức, việc bạn phụ trách, một sự cố đã xử lý và kết quả.'],
  ]),
];

/** Tên chủ đề theo đúng thứ tự xuất hiện. */
export const REF_TOPICS = [...new Set(CHEAT_REF.map((s) => s.topic))];

/** Lọc theo chủ đề và từ khoá. Khớp tên mục thì giữ cả mục, nếu không thì chỉ giữ dòng khớp. */
export function filterRef(ref, o = {}) {
  const q = String(o.q || '').toLowerCase().trim();
  const hit = (x) => x.toLowerCase().includes(q);
  return ref.filter((s) => !o.topic || o.topic === 'all' || s.topic === o.topic)
    .map((s) => (!q || hit(s.title) ? s : { ...s, rows: s.rows.filter((r) => r.some(hit)) }))
    .filter((s) => s.rows.length);
}
