// lab/ccna-exam.js — "🎓 Thi thử CCNA": ngân hàng câu hỏi TỰ SOẠN theo kiến thức chuẩn (không chép đề thật/dump),
// chia 6 mảng của đề CCNA 200-301, trộn trắc nghiệm 1 đáp án / nhiều đáp án, ghép cặp và câu lab mô phỏng (lấy lab
// có sẵn, chấm bằng checkLab). Chấm thang 300–1000 (đạt ≥ 825), báo điểm từng mảng.
//
// Câu hỏi: [mảng, đề, phương án[], đáp án, giải thích]. Đáp án là chỉ số (1 đáp án) hoặc mảng chỉ số (chọn nhiều);
// câu ghép cặp: phương án = { pairs: [[trái, phải]...] }, đáp án = null. Thứ tự phương án được xáo khi tạo đề.

import { BANK_EN } from './ccna-exam-en.js';
import { genQuestions } from './ccna-gen.js';

export const DOMAINS = [
  { id: 'nf', name: 'Network Fundamentals', vi: 'Nền tảng mạng', w: 20 },
  { id: 'na', name: 'Network Access', vi: 'Truy cập mạng (switching, Wi-Fi)', w: 20 },
  { id: 'ipc', name: 'IP Connectivity', vi: 'Kết nối IP (định tuyến)', w: 25 },
  { id: 'ips', name: 'IP Services', vi: 'Dịch vụ IP', w: 10 },
  { id: 'sec', name: 'Security Fundamentals', vi: 'Nền tảng bảo mật', w: 15 },
  { id: 'auto', name: 'Automation & Programmability', vi: 'Tự động hoá & lập trình', w: 10 },
];
export const PASS = 825;

const M = (...pairs) => ({ pairs });
export const BANK = [
  // ---------------------------------------------------------------- Network Fundamentals (20)
  ['nf', 'Thiết bị nào hoạt động ở lớp 3 mô hình OSI?', ['Router', 'Hub', 'Switch lớp 2', 'Repeater'], 0, 'Router chuyển gói theo địa chỉ IP (lớp 3); switch lớp 2 dùng MAC, hub/repeater chỉ ở lớp 1.'],
  ['nf', 'Địa chỉ nào thuộc dải private RFC 1918?', ['10.255.1.1', '172.32.0.1', '192.169.1.1', '100.64.0.1'], 0, 'RFC 1918: 10.0.0.0/8, 172.16.0.0/12 (172.16–172.31), 192.168.0.0/16. 100.64.0.0/10 là dải dùng chung cho CGNAT, không phải RFC 1918.'],
  ['nf', 'Subnet 192.168.10.64/27 có địa chỉ broadcast là?', ['192.168.10.95', '192.168.10.127', '192.168.10.96', '192.168.10.79'], 0, '/27 = khối 32 địa chỉ: .64 → .95.'],
  ['nf', 'Một subnet /26 có bao nhiêu địa chỉ host dùng được?', ['62', '64', '30', '126'], 0, '2^(32−26) − 2 = 62.'],
  ['nf', 'Chọn 2 phát biểu ĐÚNG về TCP và UDP.', ['TCP thiết lập kết nối bằng bắt tay 3 bước', 'TCP đánh số thứ tự và báo nhận (ACK) để truyền tin cậy', 'UDP đảm bảo gói tới đúng thứ tự', 'UDP dùng cửa sổ trượt để kiểm soát luồng'], [0, 1], 'UDP không kết nối, không đảm bảo thứ tự, không có cửa sổ trượt — dùng cho DNS, VoIP, streaming.'],
  ['nf', 'Cổng mặc định của HTTPS là?', ['TCP 443', 'TCP 80', 'TCP 22', 'UDP 443'], 0, 'HTTP 80, HTTPS 443, SSH 22 (HTTP/3 QUIC mới dùng UDP 443).'],
  ['nf', 'Địa chỉ IPv6 link-local thuộc dải nào?', ['FE80::/10', 'FC00::/7', '2000::/3', 'FF00::/8'], 0, 'FC00::/7 là unique local, 2000::/3 global unicast, FF00::/8 multicast.'],
  ['nf', 'Cách rút gọn đúng của 2001:0db8:0000:0000:0000:0000:0000:0001?', ['2001:db8::1', '2001:db8::0::1', '2001:0db8::0001:', '2001:db8:0:1'], 0, 'Bỏ số 0 đứng đầu mỗi nhóm và thay MỘT chuỗi nhóm 0 liên tiếp bằng "::" (chỉ được dùng :: một lần).'],
  ['nf', 'Mô hình "collapsed core" gộp những lớp nào?', ['Core và Distribution', 'Access và Distribution', 'Core và Access', 'Cả ba lớp vào một switch'], 0, 'Mạng vừa và nhỏ gộp core + distribution thành một lớp, còn lại lớp access → thiết kế 2 lớp.'],
  ['nf', 'Lỗi CRC và runts tăng liên tục trên một cổng thường do đâu?', ['Lớp 1: cáp hỏng, nhiễu hoặc lệch duplex', 'ACL chặn nhầm', 'Sai VLAN access', 'Thiếu route'], 0, 'Lỗi khung (CRC, runts, giants) là dấu hiệu tín hiệu vật lý xấu hoặc duplex mismatch.'],
  ['nf', 'Một đầu full-duplex, đầu kia half-duplex thì thường thấy gì?', ['Late collision ở phía half-duplex, mạng chậm', 'Cổng chuyển err-disabled', 'STP chặn cổng', 'CDP tự tắt'], 0, 'Phía half-duplex phát hiện va chạm muộn khi phía full gửi bất kỳ lúc nào.'],
  ['nf', 'Ba kênh Wi-Fi 2.4 GHz không chồng lấn nhau (chuẩn phổ biến) là?', ['1, 6, 11', '1, 5, 9', '2, 7, 12', '1, 4, 8'], 0, 'Mỗi kênh rộng ~22 MHz, cách 5 MHz → chỉ 1/6/11 không chồng nhau.'],
  ['nf', 'ARP dùng để làm gì?', ['Tìm địa chỉ MAC ứng với một IP trong cùng mạng', 'Phân giải tên miền ra IP', 'Cấp địa chỉ IP tự động', 'Tìm đường đi ngắn nhất'], 0, 'ARP Request quảng bá "Ai giữ IP X?", máy giữ IP trả lời bằng MAC của nó.'],
  ['nf', 'Trường TTL trong header IPv4 dùng để?', ['Chống gói chạy vòng mãi khi có vòng lặp định tuyến', 'Đo băng thông', 'Đánh dấu QoS', 'Ghép mảnh gói'], 0, 'Mỗi router giảm TTL 1; về 0 thì huỷ gói và gửi ICMP Time Exceeded (traceroute dựa vào điều này).'],
  ['nf', 'Ghép mỗi lớp OSI với đơn vị dữ liệu (PDU) của nó.', M(['Transport', 'Segment'], ['Network', 'Packet'], ['Data Link', 'Frame'], ['Physical', 'Bit']), null, 'Đóng gói đi xuống: dữ liệu → segment → packet → frame → bit.'],
  ['nf', 'Địa chỉ nào là multicast IPv4?', ['224.0.0.5', '169.254.1.1', '127.0.0.1', '255.255.255.255'], 0, '224.0.0.0/4 là multicast (224.0.0.5 = mọi router OSPF). 169.254/16 APIPA, 127/8 loopback, 255.255.255.255 broadcast.'],
  ['nf', 'Ưu điểm chính của kiến trúc spine-leaf trong trung tâm dữ liệu?', ['Mọi leaf tới nhau qua đúng một spine → độ trễ đồng đều, dễ mở rộng ngang', 'Không cần cáp quang', 'Không cần định tuyến', 'Chỉ dùng một switch'], 0, 'Leaf nối tới mọi spine, không nối leaf–leaf; thêm spine để tăng băng thông đông–tây.'],
  ['nf', 'Thiết bị nào lọc theo trạng thái kết nối và nhận diện ứng dụng (App-ID, IPS)?', ['Next-Generation Firewall', 'Hub', 'Switch lớp 2', 'Access point'], 0, 'NGFW = firewall stateful + nhận diện ứng dụng, IPS, lọc URL…'],
  ['nf', 'Trên Windows, lệnh nào xem đầy đủ IP, gateway, DNS và MAC?', ['ipconfig /all', 'ifconfig -a', 'show ip interface brief', 'netstat -r'], 0, 'ifconfig là Linux/macOS; show ip interface brief là lệnh Cisco IOS.'],
  ['nf', 'Loại cáp chuẩn nối PC với switch (khi không có Auto-MDIX)?', ['Cáp thẳng (straight-through)', 'Cáp chéo (crossover)', 'Cáp rollover (console)', 'Cáp serial DCE'], 0, 'Thiết bị khác loại (PC–switch) dùng cáp thẳng; cùng loại (switch–switch) dùng cáp chéo nếu không có Auto-MDIX.'],
  // ---------------------------------------------------------------- Network Access (20)
  ['na', 'Frame thuộc native VLAN đi qua trunk 802.1Q như thế nào?', ['Không gắn tag', 'Gắn tag VLAN 1', 'Gắn tag 4095', 'Bị huỷ'], 0, 'Native VLAN đi untagged → hai đầu phải cùng native VLAN, nếu không frame rơi nhầm VLAN.'],
  ['na', 'Lệnh nào tắt DTP trên một cổng đã đặt trunk tĩnh?', ['switchport nonegotiate', 'no switchport', 'switchport mode dynamic auto', 'spanning-tree portfast'], 0, 'Tắt DTP giảm nguy cơ VLAN hopping (kẻ tấn công giả switch để tự lập trunk).'],
  ['na', 'Hai đầu cổng cùng để "dynamic auto" thì cổng chạy ở chế độ gì?', ['Access', 'Trunk', 'Err-disabled', 'Down'], 0, 'Auto chỉ chờ được mời; cần ít nhất một đầu desirable hoặc trunk tĩnh.'],
  ['na', 'Root bridge của STP được bầu theo tiêu chí nào?', ['Bridge ID thấp nhất (priority, rồi MAC)', 'MAC cao nhất', 'Nhiều cổng nhất', 'IP quản lý thấp nhất'], 0, 'Đổi priority (vd spanning-tree vlan 10 root primary) để chọn root đúng thiết kế.'],
  ['na', 'Rapid PVST+ (802.1w) có các trạng thái cổng nào?', ['Discarding, Learning, Forwarding', 'Blocking, Listening, Learning, Forwarding, Disabled', 'Init, 2-Way, Full', 'Active, Standby, Listen'], 0, 'RSTP gộp blocking/listening/disabled thành discarding và hội tụ nhanh hơn nhiều.'],
  ['na', 'Nên bật PortFast ở loại cổng nào?', ['Cổng biên nối PC, máy in, server', 'Trunk lên switch core', 'Cổng nối switch access khác', 'Mọi cổng kể cả uplink'], 0, 'PortFast bỏ qua listening/learning; bật trên cổng nối switch có thể tạo vòng lặp tạm thời.'],
  ['na', 'Cổng bật BPDU Guard nhận được BPDU thì sao?', ['Chuyển err-disabled', 'Thành root port', 'Bỏ qua BPDU', 'Chuyển sang trunk'], 0, 'Bảo vệ cổng người dùng khỏi switch lạ cắm vào; khôi phục bằng shutdown → no shutdown hoặc errdisable recovery.'],
  ['na', 'Chọn 2 tổ hợp chế độ LACP tạo được EtherChannel.', ['active – active', 'active – passive', 'passive – passive', 'on – active'], [0, 1], 'Passive chỉ trả lời; "on" không chạy LACP nên không bắt cặp với active.'],
  ['na', 'Các cổng thành viên EtherChannel bắt buộc giống nhau ở điểm nào?', ['Tốc độ, duplex, chế độ access/trunk và VLAN', 'Màu cáp', 'Số thứ tự cổng', 'Địa chỉ MAC'], 0, 'Lệch cấu hình khiến cổng ở trạng thái suspended/stand-alone.'],
  ['na', 'Khác biệt chính giữa CDP và LLDP?', ['LLDP là chuẩn mở IEEE 802.1AB, CDP là giao thức riêng của Cisco', 'CDP chạy ở lớp 3, LLDP ở lớp 7', 'LLDP chỉ chạy trên router', 'CDP mã hoá dữ liệu'], 0, 'Cả hai đều là giao thức khám phá láng giềng lớp 2; môi trường nhiều hãng nên dùng LLDP.'],
  ['na', 'Ghép thuật ngữ Wi-Fi với ý nghĩa.', M(['WLC', 'Quản lý tập trung nhiều access point'], ['CAPWAP', 'Đường hầm điều khiển/dữ liệu giữa AP và WLC'], ['SSID', 'Tên mạng không dây'], ['WPA3-SAE', 'Xác thực bằng mật khẩu, chống dò mật khẩu offline']), null, 'Lightweight AP được WLC cấu hình qua CAPWAP; WPA3-Personal dùng SAE thay cho PSK của WPA2.'],
  ['na', 'Ở chế độ nào lightweight AP đưa toàn bộ traffic người dùng qua đường hầm về WLC?', ['Local mode', 'FlexConnect (local switching)', 'Monitor', 'Sniffer'], 0, 'FlexConnect cho phép chi nhánh chuyển traffic tại chỗ khi mất kết nối tới WLC.'],
  ['na', 'Lệnh nào gán VLAN thoại 150 cho cổng nối IP Phone?', ['switchport voice vlan 150', 'switchport access vlan 150 voice', 'vlan voice 150', 'switchport trunk native vlan 150'], 0, 'Cổng giữ data VLAN (access vlan) cho PC và voice VLAN (tagged) cho điện thoại.'],
  ['na', 'Lệnh nào xem cổng trunk, native VLAN và danh sách VLAN được phép?', ['show interfaces trunk', 'show vlan brief', 'show ip interface brief', 'show cdp neighbors'], 0, 'show vlan brief không liệt kê cổng trunk.'],
  ['na', 'VLAN nào mặc định tồn tại và KHÔNG xoá được trên switch Cisco?', ['VLAN 1', 'VLAN 99', 'VLAN 10', 'VLAN 4094'], 0, 'VLAN 1 (và 1002–1005) là mặc định; thực tế nên chuyển cổng không dùng sang VLAN khác.'],
  ['na', 'Cổng switch nối với router làm router-on-a-stick phải ở chế độ?', ['Trunk', 'Access VLAN 1', 'Routed port', 'Shutdown'], 0, 'Router nhận các VLAN dạng tagged trên subinterface (encapsulation dot1Q).'],
  ['na', 'Thêm VLAN 30 vào danh sách allowed của trunk mà KHÔNG xoá các VLAN đang có?', ['switchport trunk allowed vlan add 30', 'switchport trunk allowed vlan 30', 'switchport trunk vlan 30', 'vlan 30 allowed'], 0, 'Thiếu "add" sẽ GHI ĐÈ danh sách → các VLAN cũ bị cắt.'],
  ['na', 'Root port là cổng như thế nào?', ['Cổng có tổng cost về root thấp nhất trên switch không phải root', 'Cổng có MAC thấp nhất', 'Mọi cổng của root bridge', 'Cổng đang bị chặn'], 0, 'Mỗi switch (trừ root) có đúng một root port; mỗi đoạn mạng có một designated port.'],
  ['na', 'Trong "show spanning-tree", cổng ghi "Altn BLK" nghĩa là?', ['Cổng alternate: đường dự phòng về root, đang chặn', 'Cổng bị shutdown', 'Cổng err-disabled', 'Cổng trunk lỗi'], 0, 'Khi root port hỏng, cổng alternate chuyển lên rất nhanh (RSTP).'],
  ['na', 'Chọn 2 đặc điểm của băng tần 5 GHz so với 2.4 GHz.', ['Nhiều kênh không chồng lấn hơn', 'Xuyên tường kém hơn, phạm vi ngắn hơn', 'Phủ sóng xa hơn', 'Chỉ có 3 kênh'], [0, 1], '5 GHz ít nhiễu, nhiều kênh hơn nhưng suy hao lớn hơn qua vật cản.'],
  // ---------------------------------------------------------------- IP Connectivity (25)
  ['ipc', 'Administrative Distance mặc định của OSPF là?', ['110', '90', '120', '1'], 0, 'Connected 0, static 1, eBGP 20, EIGRP 90, OSPF 110, RIP 120.'],
  ['ipc', 'AD mặc định của static route là?', ['1', '0', '5', '110'], 0, 'Static ghi next-hop hay cổng ra đều có AD 1 (trừ khi chỉ định khác).'],
  ['ipc', 'Bảng định tuyến có 10.1.0.0/16 qua R-A và 10.1.1.0/24 qua R-B. Gói tới 10.1.1.5 đi đâu?', ['R-B (prefix dài nhất khớp)', 'R-A (prefix ngắn hơn)', 'Cân tải cả hai', 'Bị huỷ'], 0, 'Longest prefix match được xét TRƯỚC AD và metric.'],
  ['ipc', 'Floating static route là gì?', ['Static route có AD cao hơn route chính, chỉ dùng khi route chính mất', 'Static route trỏ tới Null0', 'Route học từ BGP', 'Static route không có next-hop'], 0, 'vd ip route 0.0.0.0 0.0.0.0 203.0.113.5 200 làm đường dự phòng cho OSPF (AD 110).'],
  ['ipc', 'Lệnh tạo default route tĩnh?', ['ip route 0.0.0.0 0.0.0.0 <next-hop>', 'ip default-route <next-hop>', 'route add default', 'ip route default <next-hop>'], 0, 'Gateway of last resort hiện trong show ip route với mã S*.'],
  ['ipc', 'Chọn 2 tham số PHẢI khớp để hai router lên láng giềng OSPF.', ['Area ID', 'Hello/Dead interval', 'Router ID', 'Process ID'], [0, 1], 'Router ID phải KHÁC nhau; process ID chỉ có ý nghĩa cục bộ. Ngoài ra còn subnet/mask, xác thực, MTU (cho Full).'],
  ['ipc', 'DR trên một segment OSPF được bầu theo?', ['Priority cổng cao nhất, bằng nhau thì router ID cao nhất', 'Router ID thấp nhất', 'IP cổng thấp nhất', 'Router bật OSPF đầu tiên luôn là DR'], 0, 'Bầu DR không chiếm quyền: router priority cao bật sau không tự thay DR hiện có.'],
  ['ipc', 'Đặt "ip ospf priority 0" trên cổng thì?', ['Router không bao giờ làm DR/BDR trên segment đó', 'Router luôn làm DR', 'Tắt OSPF trên cổng', 'Cổng thành passive'], 0, 'Dùng cho router chi nhánh yếu hoặc không nên làm DR.'],
  ['ipc', 'Hai router DROTHER trên cùng segment dừng ở trạng thái nào với nhau?', ['2-WAY', 'FULL', 'INIT', 'EXSTART'], 0, 'DROTHER chỉ đồng bộ LSDB (FULL) với DR và BDR.'],
  ['ipc', 'Cost OSPF mặc định của cổng được tính thế nào?', ['Reference bandwidth (mặc định 100 Mbps) chia cho bandwidth cổng', 'Số hop', 'Độ trễ cộng dồn', 'Luôn bằng 1'], 0, 'Cổng 1 Gbps và 100 Mbps cùng cost 1 → nên tăng auto-cost reference-bandwidth.'],
  ['ipc', 'OSPF chọn router ID theo thứ tự nào?', ['Lệnh router-id → IP loopback cao nhất → IP cổng active cao nhất', 'IP cổng thấp nhất → loopback', 'MAC cao nhất', 'Ngẫu nhiên'], 0, 'Đặt router-id thủ công để ổn định và dễ nhận diện.'],
  ['ipc', 'Lệnh quảng bá default route của router biên vào OSPF?', ['default-information originate', 'redistribute static default', 'network 0.0.0.0 255.255.255.255 area 0', 'ip default-network'], 0, 'Router biên cần có default route trong bảng (hoặc thêm "always").'],
  ['ipc', 'Wildcard mask tương ứng với /27 là?', ['0.0.0.31', '0.0.0.32', '0.0.0.224', '255.255.255.224'], 0, 'Wildcard = 255.255.255.255 − mask = 0.0.0.31.'],
  ['ipc', 'HSRP chọn router Active thế nào?', ['Priority cao nhất (mặc định 100), bằng nhau thì IP cổng cao nhất', 'IP thấp nhất', 'Router ID OSPF', 'Router bật trước'], 0, 'Kèm "preempt" để router priority cao lấy lại vai trò khi hoạt động trở lại.'],
  ['ipc', 'Lệnh "standby 10 preempt" có tác dụng gì?', ['Cho router priority cao hơn giành lại vai trò Active', 'Tắt HSRP nhóm 10', 'Đặt VIP', 'Đổi phiên bản HSRP'], 0, 'Không có preempt, router đang Active giữ vai trò dù priority thấp hơn.'],
  ['ipc', 'Phát biểu nào đúng về VRRP?', ['Chuẩn mở, vai trò Master/Backup, preempt bật mặc định', 'Độc quyền Cisco', 'Cân tải nhiều gateway cùng lúc qua nhiều MAC ảo', 'Chỉ chạy trên switch'], 0, 'Cân tải nhiều MAC ảo cùng lúc là đặc trưng của GLBP.'],
  ['ipc', 'Điểm khác biệt nổi bật của GLBP so với HSRP?', ['Nhiều router cùng chuyển tiếp traffic (cân tải) qua nhiều MAC ảo', 'Là chuẩn mở', 'Không có IP ảo', 'Không có failover'], 0, 'GLBP có AVG phát các MAC ảo khác nhau cho các host.'],
  ['ipc', 'Bảng có 0.0.0.0/0, 172.16.0.0/16 và 172.16.4.0/22. Gói tới 172.16.5.9 dùng route nào?', ['172.16.4.0/22', '172.16.0.0/16', '0.0.0.0/0', 'Không route nào'], 0, '172.16.4.0/22 bao 172.16.4.0–172.16.7.255 và là prefix dài nhất khớp.'],
  ['ipc', 'Mã "O IA" trong show ip route nghĩa là?', ['Route OSPF liên vùng (inter-area)', 'Route OSPF trong vùng', 'Route ngoài loại 1', 'Route IS-IS'], 0, 'O = intra-area, O IA = inter-area, O E1/E2 = external.'],
  ['ipc', 'Mã "D" trong show ip route là route học từ?', ['EIGRP', 'RIP', 'Default', 'DHCP'], 0, 'EIGRP dùng chữ D (DUAL); D EX là route EIGRP external.'],
  ['ipc', 'Default route tĩnh IPv6 viết thế nào?', ['ipv6 route ::/0 <next-hop>', 'ipv6 route 0::0 0::0 <next-hop>', 'ip route ::/0 <next-hop>', 'ipv6 default-gateway <next-hop>'], 0, 'Router phải bật "ipv6 unicast-routing" mới định tuyến IPv6.'],
  ['ipc', 'Lệnh nào bật định tuyến IPv6 trên router Cisco?', ['ipv6 unicast-routing', 'ipv6 enable', 'ipv6 routing on', 'router ipv6'], 0, '"ipv6 enable" trên cổng chỉ tạo link-local.'],
  ['ipc', 'Ghép mã route với nguồn gốc.', M(['C', 'Mạng nối trực tiếp'], ['L', 'IP của chính cổng (/32)'], ['S', 'Route tĩnh'], ['O', 'OSPF trong cùng vùng']), null, 'Đọc nhanh bảng định tuyến bắt đầu từ cột mã.'],
  ['ipc', 'Gộp 192.168.0.0/24 → 192.168.3.0/24 thành một route tóm tắt?', ['192.168.0.0/22', '192.168.0.0/23', '192.168.0.0/21', '192.168.0.0/16'], 0, '4 mạng /24 liên tiếp, bắt đầu từ bội số của 4 → /22.'],
  ['ipc', 'Cùng prefix 10.5.0.0/24 học từ cả OSPF và EIGRP, router đưa route nào vào bảng?', ['EIGRP, vì AD 90 thấp hơn OSPF 110', 'OSPF, vì là chuẩn mở', 'Cả hai và cân tải', 'Route có metric nhỏ hơn'], 0, 'Metric chỉ so sánh trong CÙNG giao thức; giữa các giao thức so AD.'],
  // ---------------------------------------------------------------- IP Services (10)
  ['ips', 'NAT overload còn được gọi là?', ['PAT (Port Address Translation)', 'Static NAT', 'NAT pool', 'NAT64'], 0, 'Nhiều IP private dùng chung một IP public, phân biệt bằng số port.'],
  ['ips', 'Ghép thuật ngữ NAT với ý nghĩa.', M(['Inside local', 'IP thật (private) của máy bên trong'], ['Inside global', 'IP public đại diện cho máy bên trong'], ['Outside global', 'IP thật của máy bên ngoài'], ['Outside local', 'IP của máy bên ngoài như mạng trong nhìn thấy']), null, 'Thường outside local = outside global (không dịch phía ngoài).'],
  ['ips', 'Lệnh cấu hình DHCP relay trên cổng gateway của VLAN người dùng?', ['ip helper-address <IP DHCP server>', 'ip dhcp relay <IP>', 'dhcp forward <IP>', 'ip dhcp server <IP>'], 0, 'Relay đổi broadcast Discover thành unicast tới server và điền giaddr.'],
  ['ips', 'Thứ tự 4 bản tin DHCP?', ['Discover → Offer → Request → Ack', 'Request → Offer → Discover → Ack', 'Discover → Request → Offer → Ack', 'Offer → Discover → Ack → Request'], 0, 'Viết tắt DORA.'],
  ['ips', 'Trong NTP, stratum nhỏ hơn có nghĩa là?', ['Gần nguồn thời gian chuẩn hơn (chính xác hơn)', 'Đồng hồ chậm hơn', 'Nhiều hop hơn tới nguồn', 'Không đồng bộ được'], 0, 'Stratum 0 là đồng hồ nguyên tử/GPS; stratum 16 = chưa đồng bộ.'],
  ['ips', 'Mức syslog nào nghiêm trọng NHẤT?', ['0 — emergencies', '7 — debugging', '4 — warnings', '3 — errors'], 0, 'Số càng nhỏ càng nghiêm trọng: 0 emergencies … 7 debugging.'],
  ['ips', 'Phiên bản SNMP nào có cả xác thực và mã hoá?', ['SNMPv3', 'SNMPv1', 'SNMPv2c', 'Cả ba'], 0, 'v1/v2c dùng community string dạng chữ thường, không mã hoá.'],
  ['ips', 'Lưu lượng thoại (voice) thường được đánh dấu DSCP nào?', ['EF (46)', 'AF11 (10)', 'CS1 (8)', 'Default (0)'], 0, 'EF = Expedited Forwarding, dùng hàng đợi ưu tiên (LLQ).'],
  ['ips', 'DNS truy vấn thông thường dùng giao thức và cổng nào?', ['UDP 53', 'TCP 80', 'UDP 67', 'TCP 25'], 0, 'TCP 53 dùng cho zone transfer hoặc phản hồi lớn.'],
  ['ips', 'TFTP khác FTP ở điểm nào?', ['TFTP dùng UDP 69, không xác thực, đơn giản (hay dùng nạp IOS/cấu hình)', 'TFTP mã hoá dữ liệu', 'TFTP dùng TCP 21', 'TFTP có liệt kê thư mục'], 0, 'FTP dùng TCP 20/21 và có đăng nhập.'],
  // ---------------------------------------------------------------- Security Fundamentals (15)
  ['sec', 'ACL standard nên đặt ở đâu?', ['Gần ĐÍCH', 'Gần NGUỒN', 'Trên router ISP', 'Ở cổng bất kỳ'], 0, 'Standard chỉ lọc IP nguồn — đặt gần nguồn sẽ chặn luôn traffic tới đích khác.'],
  ['sec', 'ACL extended nên đặt ở đâu?', ['Gần NGUỒN', 'Gần ĐÍCH', 'Chỉ chiều out', 'Trên switch lớp 2'], 0, 'Lọc chính xác theo nguồn/đích/port nên chặn sớm để đỡ tốn băng thông.'],
  ['sec', 'Cuối mọi ACL luôn có dòng ngầm định nào?', ['deny any (chặn hết những gì chưa khớp)', 'permit any', 'deny tcp any any', 'Không có dòng nào'], 0, 'Quên "permit" cuối ACL là lỗi hay gặp làm chặn nhầm mọi thứ.'],
  ['sec', 'Port-security vi phạm thì hành động MẶC ĐỊNH là?', ['shutdown (err-disabled)', 'restrict', 'protect', 'Chỉ ghi log'], 0, 'restrict: bỏ frame lạ + đếm + log; protect: bỏ frame lạ, không log.'],
  ['sec', 'DHCP snooping chống lại tấn công nào?', ['DHCP server giả mạo cắm vào cổng untrusted', 'Brute-force mật khẩu', 'Tấn công DNS', 'VLAN hopping'], 0, 'Chỉ cổng "trusted" (hướng về server hợp lệ) được gửi DHCP Offer/Ack.'],
  ['sec', 'Dynamic ARP Inspection (DAI) kiểm tra ARP dựa vào gì?', ['Bảng binding của DHCP snooping', 'Bảng định tuyến', 'Bảng CAM của router', 'Danh sách CDP'], 0, 'Cặp IP–MAC không có trong binding (hoặc ARP ACL) thì bị huỷ — chống ARP spoofing.'],
  ['sec', 'Chọn 2 bước cần để quản trị thiết bị Cisco bằng SSH.', ['Đặt hostname, ip domain-name rồi tạo khoá RSA (crypto key generate rsa)', 'Trên line vty: transport input ssh và login local (kèm username)', 'Đặt enable password cisco', 'Tắt ip routing'], [0, 1], 'Nên dùng SSH version 2 và khoá RSA ≥ 1024 bit.'],
  ['sec', '"enable secret" khác "enable password" thế nào?', ['secret lưu dạng băm mạnh và được ưu tiên nếu cả hai cùng có', 'password an toàn hơn', 'Hai lệnh giống nhau', 'secret chỉ dùng cho console'], 0, 'password chỉ được che yếu bằng service password-encryption (type 7).'],
  ['sec', 'TACACS+ khác RADIUS ở điểm nào?', ['TACACS+ dùng TCP 49, mã hoá toàn bộ gói và tách riêng authorization', 'TACACS+ là chuẩn mở', 'RADIUS mã hoá toàn bộ gói', 'RADIUS dùng TCP 49'], 0, 'RADIUS (UDP 1812/1813) chỉ mã hoá mật khẩu, gộp authentication + authorization.'],
  ['sec', 'WPA2/WPA3-Enterprise xác thực người dùng bằng gì?', ['802.1X với máy chủ RADIUS', 'Một mật khẩu chung (PSK)', 'Lọc MAC', 'Ẩn SSID'], 0, 'Mỗi người có tài khoản riêng; lọc MAC và ẩn SSID không phải biện pháp bảo mật thật sự.'],
  ['sec', 'Ghép kiểu tấn công với mô tả.', M(['Phishing', 'Email/trang giả mạo lừa lấy thông tin'], ['DoS', 'Làm cạn tài nguyên khiến dịch vụ ngừng'], ['Man-in-the-middle', 'Chen giữa để nghe lén hoặc sửa dữ liệu'], ['Brute force', 'Thử hàng loạt mật khẩu']), null, 'Phòng chống: đào tạo người dùng, rate-limit, mã hoá + xác thực hai đầu, khoá đăng nhập sau nhiều lần sai.'],
  ['sec', 'Phase 1 (IKE) của VPN IPsec site-to-site để làm gì?', ['Tạo kênh an toàn (ISAKMP SA) để thương lượng Phase 2', 'Mã hoá dữ liệu người dùng', 'Cấp IP cho client', 'Chạy NAT'], 0, 'Phase 2 tạo IPsec SA (ESP) mã hoá traffic "interesting" khớp crypto ACL.'],
  ['sec', 'Phương án nào là xác thực đa yếu tố (MFA)?', ['Mật khẩu + mã OTP trên điện thoại', 'Hai mật khẩu khác nhau', 'Mật khẩu dài 20 ký tự', 'Câu hỏi bí mật + mật khẩu'], 0, 'MFA kết hợp ít nhất hai loại: thứ bạn biết, thứ bạn có, thứ thuộc về bạn.'],
  ['sec', 'Lệnh nào khoá đăng nhập 120 giây khi sai 3 lần trong 60 giây?', ['login block-for 120 attempts 3 within 60', 'login delay 120', 'security passwords min-length 3', 'exec-timeout 120'], 0, 'Giảm hiệu quả tấn công dò mật khẩu vào VTY.'],
  ['sec', 'ACL 100: "deny tcp any host 10.1.1.1 eq 23" rồi "permit ip any any". Kết quả?', ['Chặn Telnet tới 10.1.1.1, cho phép mọi thứ khác', 'Chặn mọi traffic tới 10.1.1.1', 'Chặn Telnet từ 10.1.1.1', 'Chặn tất cả'], 0, 'Dòng đầu chỉ khớp TCP port 23 có đích 10.1.1.1.'],
  // ---------------------------------------------------------------- Automation & Programmability (10)
  ['auto', 'SDN tách phần nào khỏi thiết bị mạng để đưa lên controller?', ['Control plane', 'Data plane', 'Management plane của cáp', 'Lớp vật lý'], 0, 'Thiết bị giữ data plane (chuyển tiếp); controller tính toán và đẩy chính sách xuống.'],
  ['auto', 'Northbound API là giao tiếp giữa?', ['Controller và ứng dụng/người vận hành', 'Controller và thiết bị mạng', 'Hai switch', 'PC và router'], 0, 'Southbound là controller ↔ thiết bị (NETCONF, OpenFlow, RESTCONF…).'],
  ['auto', 'Giao thức nào là ví dụ southbound API?', ['NETCONF', 'HTML', 'SMTP', 'DHCP'], 0, 'NETCONF dùng SSH và dữ liệu theo mô hình YANG.'],
  ['auto', 'Trong REST API, phương thức HTTP nào dùng để LẤY dữ liệu?', ['GET', 'POST', 'DELETE', 'PUT'], 0, 'GET không thay đổi dữ liệu trên server.'],
  ['auto', 'Chuỗi nào là JSON hợp lệ?', ['{"vlan": 10, "name": "SALES"}', '{vlan: 10}', "['vlan': 10]", '{"vlan" = 10}'], 0, 'Khoá JSON phải là chuỗi trong ngoặc kép, cặp khoá–giá trị ngăn bằng dấu hai chấm.'],
  ['auto', 'Đặc điểm của Ansible?', ['Agentless, kết nối qua SSH, playbook viết bằng YAML', 'Bắt buộc cài agent trên thiết bị', 'Chỉ chạy trên Windows', 'Viết bằng ngôn ngữ Ruby DSL'], 0, 'Mô hình push từ máy điều khiển.'],
  ['auto', 'Puppet và Chef khác Ansible chủ yếu ở điểm nào?', ['Thường cần agent trên thiết bị và chạy mô hình pull', 'Không dùng được cho cấu hình', 'Không cần máy chủ', 'Chỉ dùng cho Wi-Fi'], 0, 'Puppet (manifest), Chef (recipe/cookbook), Ansible (playbook).'],
  ['auto', 'Mã trạng thái HTTP 201 nghĩa là?', ['Created — tạo tài nguyên thành công', 'OK', 'Not Found', 'Unauthorized'], 0, '200 OK, 201 Created, 401 Unauthorized, 404 Not Found, 500 lỗi server.'],
  ['auto', 'Ghép thao tác CRUD với phương thức HTTP.', M(['Create', 'POST'], ['Read', 'GET'], ['Update', 'PUT / PATCH'], ['Delete', 'DELETE']), null, 'REST ánh xạ thao tác dữ liệu vào phương thức HTTP.'],
  ['auto', 'Cisco Catalyst Center (DNA Center) là gì?', ['Controller quản lý mạng doanh nghiệp theo ý định (intent-based), tự động hoá và giám sát', 'Một dòng router chi nhánh', 'Phần mềm giả lập mạng', 'Một giao thức định tuyến'], 0, 'Cung cấp REST API northbound để tích hợp và tự động hoá.'],
];

// câu lab mô phỏng: lấy lab có sẵn, chấm các nhiệm vụ cấu hình (bỏ câu trắc nghiệm trong lab), mỗi câu 3 điểm
export const SIMS = [
  { lab: 'A05', domain: 'na', pts: 3 },
  { lab: 'A17', domain: 'ipc', pts: 3 },
  { lab: 'A19', domain: 'ips', pts: 3 },
  { lab: 'A08', domain: 'sec', pts: 3 },
];

/** Chia n câu theo tỉ lệ mảng (phương pháp dư lớn nhất → tổng đúng bằng n). */
function quota(n) {
  const raw = DOMAINS.map((d) => ({ id: d.id, v: (d.w / 100) * n }));
  const out = Object.fromEntries(raw.map((x) => [x.id, Math.floor(x.v)]));
  let left = n - Object.values(out).reduce((s, v) => s + v, 0);
  for (const x of [...raw].sort((a, b) => (b.v % 1) - (a.v % 1))) if (left-- > 0) out[x.id]++;
  return out;
}
/** Bộ sinh số giả ngẫu nhiên có seed (đề tái hiện được). */
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s ^ (s >>> 15), 1 | s) + 0x6d2b79f5) >>> 0) / 4294967296); }
function shuffle(arr, r) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/**
 * Tạo đề. mode 'full' = toàn bộ ngân hàng + 4 câu lab, 120 phút; 'quick' = 30 câu (giữ tỉ lệ mảng) + 1 câu lab, 40 phút.
 * Trả { seed, mode, minutes, qs: [{ i, kind:'one'|'multi'|'match'|'sim', domain, text, options?, answer?, left?, right?, rightAns?, lab?, pts, explain }] }.
 */
export function makeExam(seed = 1, mode = 'full') {
  const r = rng(seed);
  const want = mode === 'quick' ? quota(30) : null;
  let pool = BANK.map((q, i) => ({ q, i }));
  if (want) pool = DOMAINS.flatMap((d) => shuffle(pool.filter((x) => x.q[0] === d.id), r).slice(0, want[d.id]));
  // mỗi câu mang cả bản tiếng Việt và tiếng Anh (BANK_EN cùng thứ tự), xáo cùng một thứ tự → giao diện chọn VI / EN / VI + EN
  const qs = shuffle(pool, r).map(({ q: [domain, text, opts, ans, explain], i }) => {
    const [textEn, optsEn, explainEn] = BANK_EN[i];
    if (opts?.pairs) {
      const order = shuffle(opts.pairs.map((_, k) => k), r);
      const left = opts.pairs.map((p) => p[0]), leftEn = optsEn.pairs.map((p) => p[0]);
      const right = order.map((k) => opts.pairs[k][1]), rightEn = order.map((k) => optsEn.pairs[k][1]);
      return { i, kind: 'match', domain, text, textEn, left, leftEn, right, rightEn, rightAns: opts.pairs.map((_, k) => order.indexOf(k)), pts: 1, explain, explainEn };
    }
    const order = shuffle(opts.map((_, k) => k), r);
    const options = order.map((k) => opts[k]), optionsEn = order.map((k) => optsEn[k]);
    const multi = Array.isArray(ans);
    const answer = multi ? ans.map((k) => order.indexOf(k)).sort((a, b) => a - b) : order.indexOf(ans);
    return { i, kind: multi ? 'multi' : 'one', domain, text, textEn, options, optionsEn, answer, pts: 1, explain, explainEn };
  });
  // câu sinh tự động (số liệu mới theo seed) rải ngẫu nhiên trong đề
  for (const g of genQuestions(r, mode)) {
    const order = shuffle(g.opts.map((_, k) => k), r);
    const q = { i: 'gen:' + g.gen, gen: g.gen, kind: 'one', domain: g.domain, text: g.text, textEn: g.textEn, options: order.map((k) => g.opts[k]), optionsEn: order.map((k) => (g.optsEn || g.opts)[k]), answer: order.indexOf(g.ans), pts: 1, explain: g.explain, explainEn: g.explainEn };
    qs.splice(Math.floor(r() * (qs.length + 1)), 0, q);
  }
  const sims = (mode === 'quick' ? shuffle(SIMS, r).slice(0, 1) : SIMS).map((s) => ({ i: 'sim:' + s.lab, kind: 'sim', domain: s.domain, lab: s.lab, pts: s.pts }));
  // chèn câu lab rải đều trong đề
  sims.forEach((s, k) => qs.splice(Math.min(qs.length, Math.round(((k + 1) * qs.length) / (sims.length + 1)) + k), 0, s));
  return { seed, mode, minutes: mode === 'quick' ? 40 : 120, qs };
}

/** Điểm (0..1) của một câu. ans: chỉ số / mảng chỉ số / mảng ghép (left k → right idx) / tỉ lệ nhiệm vụ đạt (câu lab). */
export function scoreQ(q, ans) {
  if (ans == null) return 0;
  if (q.kind === 'one') return ans === q.answer ? 1 : 0;
  if (q.kind === 'multi') { const a = [...ans].sort((x, y) => x - y); return a.length === q.answer.length && a.every((v, k) => v === q.answer[k]) ? 1 : 0; }
  if (q.kind === 'match') return q.rightAns.filter((v, k) => ans[k] === v).length / q.rightAns.length;
  if (q.kind === 'sim') return Math.max(0, Math.min(1, +ans || 0));
  return 0;
}

/** Chấm đề: { score (300–1000), pass, pct, domains: [{ id, name, vi, pct, got, max }], wrong: [chỉ số câu chưa đạt trọn] }. */
export function gradeExam(exam, answers) {
  const per = Object.fromEntries(DOMAINS.map((d) => [d.id, { got: 0, max: 0 }]));
  let got = 0, max = 0;
  const wrong = [];
  exam.qs.forEach((q, k) => {
    const s = scoreQ(q, answers[k]) * q.pts;
    got += s; max += q.pts;
    per[q.domain].got += s; per[q.domain].max += q.pts;
    if (s < q.pts) wrong.push(k);
  });
  const pct = max ? got / max : 0;
  const score = Math.round(300 + 700 * pct);
  return {
    score, pass: score >= PASS, pct,
    domains: DOMAINS.map((d) => ({ id: d.id, name: d.name, vi: d.vi, got: per[d.id].got, max: per[d.id].max, pct: per[d.id].max ? per[d.id].got / per[d.id].max : null })),
    wrong,
  };
}
