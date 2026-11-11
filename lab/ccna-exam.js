// lab/ccna-exam.js — "🎓 Thi thử CCNA": ngân hàng câu hỏi TỰ SOẠN theo kiến thức chuẩn (không chép đề thật/dump),
// chia 5 mảng của đề CCNA 200-301 v2.0, trộn trắc nghiệm 1 đáp án / nhiều đáp án, ghép cặp và câu lab mô phỏng (lấy lab
// có sẵn, chấm bằng checkLab). Chấm thang 300–1000 (đạt ≥ 825), báo điểm từng mảng.
//
// Câu hỏi: [mảng, đề, phương án[], đáp án, giải thích]. Đáp án là chỉ số (1 đáp án) hoặc mảng chỉ số (chọn nhiều);
// câu ghép cặp: phương án = { pairs: [[trái, phải]...] }, đáp án = null. Thứ tự phương án được xáo khi tạo đề.

import { BANK_EN } from './ccna-exam-en.js';
import { genQuestions } from './ccna-gen.js';
import { SEC_DOMAINS, SEC_BANK } from './sec-exam.js';

export { SEC_DOMAINS };
// Đề Security (mode 'sec'): 2 câu lab IOS về bảo mật Layer 2 và hardening.
const SEC_SIMS = [{ lab: 'S01', domain: 'satk', pts: 3 }, { lab: 'S04', domain: 'snet', pts: 3 }];

export const DOMAINS = [
  { id: 'infra', name: 'Network Infrastructure and Connectivity', vi: 'Hạ tầng & kết nối mạng', w: 25 },
  { id: 'sw', name: 'Switching and Network Access', vi: 'Switching & truy cập mạng', w: 25 },
  { id: 'rt', name: 'IP Routing', vi: 'Định tuyến IP', w: 20 },
  { id: 'svc', name: 'Network Services and Security', vi: 'Dịch vụ mạng & bảo mật', w: 20 },
  { id: 'ops', name: 'AI, and Network Operations and Management', vi: 'AI & vận hành mạng', w: 10 },
];
export const PASS = 825;

const M = (...pairs) => ({ pairs });
export const BANK = [
  // ---------------------------------------------------------------- Network Infrastructure and Connectivity (25)
  ['infra', 'Địa chỉ nào thuộc dải private RFC 1918?', ['10.255.1.1', '172.32.0.1', '192.169.1.1', '100.64.0.1'], 0, 'RFC 1918: 10.0.0.0/8, 172.16.0.0/12 (172.16–172.31), 192.168.0.0/16. 100.64.0.0/10 là dải dùng chung cho CGNAT, không phải RFC 1918.'],
  ['infra', 'Subnet 192.168.10.64/27 có địa chỉ broadcast là?', ['192.168.10.95', '192.168.10.127', '192.168.10.96', '192.168.10.79'], 0, '/27 = khối 32 địa chỉ: .64 → .95.'],
  ['infra', 'Một subnet /26 có bao nhiêu địa chỉ host dùng được?', ['62', '64', '30', '126'], 0, '2^(32−26) − 2 = 62.'],
  ['infra', 'Địa chỉ IPv6 link-local thuộc dải nào?', ['FE80::/10', 'FC00::/7', '2000::/3', 'FF00::/8'], 0, 'FC00::/7 là unique local, 2000::/3 global unicast, FF00::/8 multicast.'],
  ['infra', 'Cách rút gọn đúng của 2001:0db8:0000:0000:0000:0000:0000:0001?', ['2001:db8::1', '2001:db8::0::1', '2001:0db8::0001:', '2001:db8:0:1'], 0, 'Bỏ số 0 đứng đầu mỗi nhóm và thay MỘT chuỗi nhóm 0 liên tiếp bằng "::" (chỉ được dùng :: một lần).'],
  ['infra', 'Lỗi CRC và runts tăng liên tục trên một cổng thường do đâu?', ['Lớp 1: cáp hỏng, nhiễu hoặc lệch duplex', 'ACL chặn nhầm', 'Sai VLAN access', 'Thiếu route'], 0, 'Lỗi khung (CRC, runts, giants) là dấu hiệu tín hiệu vật lý xấu hoặc duplex mismatch.'],
  ['infra', 'Một đầu full-duplex, đầu kia half-duplex thì thường thấy gì?', ['Late collision ở phía half-duplex, mạng chậm', 'Cổng chuyển err-disabled', 'STP chặn cổng', 'CDP tự tắt'], 0, 'Phía half-duplex phát hiện va chạm muộn khi phía full gửi bất kỳ lúc nào.'],
  ['infra', 'Ba kênh Wi-Fi 2.4 GHz không chồng lấn nhau (chuẩn phổ biến) là?', ['1, 6, 11', '1, 5, 9', '2, 7, 12', '1, 4, 8'], 0, 'Mỗi kênh rộng ~22 MHz, cách 5 MHz → chỉ 1/6/11 không chồng nhau.'],
  ['infra', 'ARP dùng để làm gì?', ['Tìm địa chỉ MAC ứng với một IP trong cùng mạng', 'Phân giải tên miền ra IP', 'Cấp địa chỉ IP tự động', 'Tìm đường đi ngắn nhất'], 0, 'ARP Request quảng bá "Ai giữ IP X?", máy giữ IP trả lời bằng MAC của nó.'],
  ['infra', 'Trên Windows, lệnh nào xem đầy đủ IP, gateway, DNS và MAC?', ['ipconfig /all', 'ifconfig -a', 'show ip interface brief', 'netstat -r'], 0, 'ifconfig là Linux/macOS; show ip interface brief là lệnh Cisco IOS.'],
  ['infra', 'Loại cáp chuẩn nối PC với switch (khi không có Auto-MDIX)?', ['Cáp thẳng (straight-through)', 'Cáp chéo (crossover)', 'Cáp rollover (console)', 'Cáp serial DCE'], 0, 'Thiết bị khác loại (PC–switch) dùng cáp thẳng; cùng loại (switch–switch) dùng cáp chéo nếu không có Auto-MDIX.'],
  ['sw', 'Ghép thuật ngữ Wi-Fi với ý nghĩa.', M(['WLC', 'Quản lý tập trung nhiều access point'], ['CAPWAP', 'Đường hầm điều khiển/dữ liệu giữa AP và WLC'], ['SSID', 'Tên mạng không dây'], ['WPA3-SAE', 'Xác thực bằng mật khẩu, chống dò mật khẩu offline']), null, 'Lightweight AP được WLC cấu hình qua CAPWAP; WPA3-Personal dùng SAE thay cho PSK của WPA2.'],
  ['infra', 'Chọn 2 đặc điểm của băng tần 5 GHz so với 2.4 GHz.', ['Nhiều kênh không chồng lấn hơn', 'Xuyên tường kém hơn, phạm vi ngắn hơn', 'Phủ sóng xa hơn', 'Chỉ có 3 kênh'], [0, 1], '5 GHz ít nhiễu, nhiều kênh hơn nhưng suy hao lớn hơn qua vật cản.'],
  ['infra', 'Lệnh cấu hình DHCP relay trên cổng gateway của VLAN người dùng?', ['ip helper-address <IP DHCP server>', 'ip dhcp relay <IP>', 'dhcp forward <IP>', 'ip dhcp server <IP>'], 0, 'Relay đổi broadcast Discover thành unicast tới server và điền giaddr.'],
  ['infra', 'Thứ tự 4 bản tin DHCP?', ['Discover → Offer → Request → Ack', 'Request → Offer → Discover → Ack', 'Discover → Request → Offer → Ack', 'Offer → Discover → Ack → Request'], 0, 'Viết tắt DORA.'],
  ['infra', 'WPA2/WPA3-Enterprise xác thực người dùng bằng gì?', ['802.1X với máy chủ RADIUS', 'Một mật khẩu chung (PSK)', 'Lọc MAC', 'Ẩn SSID'], 0, 'Mỗi người có tài khoản riêng; lọc MAC và ẩn SSID không phải biện pháp bảo mật thật sự.'],
  ['infra', 'Hypervisor loại 1 khác loại 2 ở điểm nào?', ['Loại 1 chạy trực tiếp trên phần cứng, loại 2 chạy trên một hệ điều hành', 'Loại 1 chỉ chạy được container', 'Loại 2 luôn nhanh hơn loại 1', 'Loại 2 không cần CPU hỗ trợ ảo hoá'], 0, 'Máy chủ thường dùng loại 1 (bare-metal); máy cá nhân hay dùng loại 2 cho thử nghiệm.'],
  ['infra', 'Container khác máy ảo ở điểm chính nào?', ['Container dùng chung kernel của máy chủ, máy ảo có hệ điều hành riêng', 'Container cần hypervisor riêng cho từng ứng dụng', 'Máy ảo khởi động nhanh hơn container', 'Container không có địa chỉ mạng'], 0, 'Vì không chứa hệ điều hành đầy đủ nên container nhẹ và khởi động nhanh hơn máy ảo.'],
  ['infra', 'Modified EUI-64 tạo Interface ID từ MAC 0011.2233.4455 như thế nào?', ['0211:22FF:FE33:4455', '0011:22FF:FE33:4455', '0211:2233:4455:FFFE', '1011:22FF:FE33:4455'], 0, 'Chèn FFFE vào giữa MAC và đảo bit thứ 7 của byte đầu: 00 thành 02.'],
  ['infra', 'Prefix nào là kích thước chuẩn cho một subnet IPv6 có máy trạm dùng SLAAC?', ['/64', '/48', '/56', '/128'], 0, 'SLAAC cần Interface ID 64 bit. /128 là một địa chỉ đơn, /48 và /56 thường cấp cho cả site.'],
  ['infra', 'So với cáp quang multimode, cáp quang single-mode có đặc điểm gì?', ['Lõi nhỏ hơn và đi được xa hơn', 'Lõi lớn hơn và đi ngắn hơn', 'Dùng tín hiệu điện', 'Chỉ dùng được trong một phòng máy'], 0, 'Single-mode dùng cho khoảng cách dài; multimode rẻ hơn, hợp trong toà nhà. Sai loại module hoặc quá cự ly gây lỗi tín hiệu.'],
  ['infra', 'Thiết bị nào thường gây nhiễu Wi-Fi băng 2.4 GHz?', ['Lò vi sóng', 'Switch có dây', 'Cáp quang', 'Máy in nối cáp mạng'], 0, 'Lò vi sóng, Bluetooth và AP cùng kênh đều gây nhiễu ở băng 2.4 GHz.'],
  ['infra', 'Giá trị RSSI nào cho biết tín hiệu Wi-Fi mạnh nhất?', ['-50 dBm', '-67 dBm', '-75 dBm', '-90 dBm'], 0, 'RSSI là số âm, càng gần 0 càng mạnh. Khoảng cách và vật cản làm tín hiệu suy hao.'],
  ['infra', 'Máy tính tự nhận địa chỉ 169.254.10.20 nghĩa là gì?', ['Máy không nhận được phản hồi từ DHCP server', 'DNS bị lỗi', 'Máy đã nhận đúng IP public', 'Gateway đang quá tải'], 0, 'APIPA (169.254.0.0/16) được tự gán khi DHCP thất bại. Kiểm tra VLAN, relay và trạng thái server.'],
  ['infra', 'Trên Linux, lệnh nào xem địa chỉ IP của các card mạng?', ['ip addr', 'ipconfig /all', 'show ip interface brief', 'nslookup'], 0, 'Linux dùng ip addr, macOS dùng ifconfig, Windows dùng ipconfig.'],
  // ---------------------------------------------------------------- Switching and Network Access (25)
  ['infra', 'Trường TTL trong header IPv4 dùng để?', ['Chống gói chạy vòng mãi khi có vòng lặp định tuyến', 'Đo băng thông', 'Đánh dấu QoS', 'Ghép mảnh gói'], 0, 'Mỗi router giảm TTL 1; về 0 thì huỷ gói và gửi ICMP Time Exceeded (traceroute dựa vào điều này).'],
  ['sw', 'Frame thuộc native VLAN đi qua trunk 802.1Q như thế nào?', ['Không gắn tag', 'Gắn tag VLAN 1', 'Gắn tag 4095', 'Bị huỷ'], 0, 'Native VLAN đi untagged → hai đầu phải cùng native VLAN, nếu không frame rơi nhầm VLAN.'],
  ['sw', 'Lệnh nào tắt DTP trên một cổng đã đặt trunk tĩnh?', ['switchport nonegotiate', 'no switchport', 'switchport mode dynamic auto', 'spanning-tree portfast'], 0, 'Tắt DTP giảm nguy cơ VLAN hopping (kẻ tấn công giả switch để tự lập trunk).'],
  ['sw', 'Hai đầu cổng cùng để "dynamic auto" thì cổng chạy ở chế độ gì?', ['Access', 'Trunk', 'Err-disabled', 'Down'], 0, 'Auto chỉ chờ được mời; cần ít nhất một đầu desirable hoặc trunk tĩnh.'],
  ['sw', 'Root bridge của STP được bầu theo tiêu chí nào?', ['Bridge ID thấp nhất (priority, rồi MAC)', 'MAC cao nhất', 'Nhiều cổng nhất', 'IP quản lý thấp nhất'], 0, 'Đổi priority (vd spanning-tree vlan 10 root primary) để chọn root đúng thiết kế.'],
  ['sw', 'Rapid PVST+ (802.1w) có các trạng thái cổng nào?', ['Discarding, Learning, Forwarding', 'Blocking, Listening, Learning, Forwarding, Disabled', 'Init, 2-Way, Full', 'Active, Standby, Listen'], 0, 'RSTP gộp blocking/listening/disabled thành discarding và hội tụ nhanh hơn nhiều.'],
  ['sw', 'Nên bật PortFast ở loại cổng nào?', ['Cổng biên nối PC, máy in, server', 'Trunk lên switch core', 'Cổng nối switch access khác', 'Mọi cổng kể cả uplink'], 0, 'PortFast bỏ qua listening/learning; bật trên cổng nối switch có thể tạo vòng lặp tạm thời.'],
  ['sw', 'Cổng bật BPDU Guard nhận được BPDU thì sao?', ['Chuyển err-disabled', 'Thành root port', 'Bỏ qua BPDU', 'Chuyển sang trunk'], 0, 'Bảo vệ cổng người dùng khỏi switch lạ cắm vào; khôi phục bằng shutdown → no shutdown hoặc errdisable recovery.'],
  ['sw', 'Chọn 2 tổ hợp chế độ LACP tạo được EtherChannel.', ['active – active', 'active – passive', 'passive – passive', 'on – active'], [0, 1], 'Passive chỉ trả lời; "on" không chạy LACP nên không bắt cặp với active.'],
  ['sw', 'Các cổng thành viên EtherChannel bắt buộc giống nhau ở điểm nào?', ['Tốc độ, duplex, chế độ access/trunk và VLAN', 'Màu cáp', 'Số thứ tự cổng', 'Địa chỉ MAC'], 0, 'Lệch cấu hình khiến cổng ở trạng thái suspended/stand-alone.'],
  ['sw', 'Khác biệt chính giữa CDP và LLDP?', ['LLDP là chuẩn mở IEEE 802.1AB, CDP là giao thức riêng của Cisco', 'CDP chạy ở lớp 3, LLDP ở lớp 7', 'LLDP chỉ chạy trên router', 'CDP mã hoá dữ liệu'], 0, 'Cả hai đều là giao thức khám phá láng giềng lớp 2; môi trường nhiều hãng nên dùng LLDP.'],
  ['sw', 'Ở chế độ nào lightweight AP đưa toàn bộ traffic người dùng qua đường hầm về WLC?', ['Local mode', 'FlexConnect (local switching)', 'Monitor', 'Sniffer'], 0, 'FlexConnect cho phép chi nhánh chuyển traffic tại chỗ khi mất kết nối tới WLC.'],
  ['sw', 'Lệnh nào gán VLAN thoại 150 cho cổng nối IP Phone?', ['switchport voice vlan 150', 'switchport access vlan 150 voice', 'vlan voice 150', 'switchport trunk native vlan 150'], 0, 'Cổng giữ data VLAN (access vlan) cho PC và voice VLAN (tagged) cho điện thoại.'],
  ['sw', 'Lệnh nào xem cổng trunk, native VLAN và danh sách VLAN được phép?', ['show interfaces trunk', 'show vlan brief', 'show ip interface brief', 'show cdp neighbors'], 0, 'show vlan brief không liệt kê cổng trunk.'],
  ['sw', 'VLAN nào mặc định tồn tại và KHÔNG xoá được trên switch Cisco?', ['VLAN 1', 'VLAN 99', 'VLAN 10', 'VLAN 4094'], 0, 'VLAN 1 (và 1002–1005) là mặc định; thực tế nên chuyển cổng không dùng sang VLAN khác.'],
  ['sw', 'Cổng switch nối với router làm router-on-a-stick phải ở chế độ?', ['Trunk', 'Access VLAN 1', 'Routed port', 'Shutdown'], 0, 'Router nhận các VLAN dạng tagged trên subinterface (encapsulation dot1Q).'],
  ['sw', 'Thêm VLAN 30 vào danh sách allowed của trunk mà KHÔNG xoá các VLAN đang có?', ['switchport trunk allowed vlan add 30', 'switchport trunk allowed vlan 30', 'switchport trunk vlan 30', 'vlan 30 allowed'], 0, 'Thiếu "add" sẽ GHI ĐÈ danh sách → các VLAN cũ bị cắt.'],
  ['sw', 'Root port là cổng như thế nào?', ['Cổng có tổng cost về root thấp nhất trên switch không phải root', 'Cổng có MAC thấp nhất', 'Mọi cổng của root bridge', 'Cổng đang bị chặn'], 0, 'Mỗi switch (trừ root) có đúng một root port; mỗi đoạn mạng có một designated port.'],
  ['sw', 'Trong "show spanning-tree", cổng ghi "Altn BLK" nghĩa là?', ['Cổng alternate: đường dự phòng về root, đang chặn', 'Cổng bị shutdown', 'Cổng err-disabled', 'Cổng trunk lỗi'], 0, 'Khi root port hỏng, cổng alternate chuyển lên rất nhanh (RSTP).'],
  ['sw', 'Root Guard bảo vệ điều gì?', ['Không cho cổng trở thành root port khi nhận BPDU tốt hơn', 'Tự chặn mọi BPDU trên cổng người dùng', 'Chống DHCP giả mạo', 'Giới hạn số MAC trên cổng'], 0, 'Cổng chuyển root-inconsistent và tự phục hồi khi hết BPDU tốt hơn, nhờ đó giữ root đúng thiết kế.'],
  ['sw', 'Loop Guard xử lý tình huống nào?', ['Cổng không còn nhận BPDU, ví dụ do lỗi một chiều, không được tự chuyển sang forwarding', 'Cổng nhận BPDU từ switch lạ', 'Cổng vượt số MAC cho phép', 'Hai đầu trunk lệch native VLAN'], 0, 'Cổng chuyển loop-inconsistent thay vì mở ra và tạo vòng lặp.'],
  ['sw', 'PoE trên cổng switch dùng để làm gì?', ['Cấp nguồn cho thiết bị qua cáp mạng, ví dụ AP và IP Phone', 'Tăng tốc độ cổng', 'Mã hoá dữ liệu', 'Gộp nhiều cổng thành một'], 0, 'AP, điện thoại IP và camera có thể lấy nguồn ngay từ cáp mạng, không cần ổ điện riêng.'],
  ['sw', 'AP độc lập (standalone) phát nhiều SSID ở nhiều VLAN thì cổng switch nên là?', ['Trunk mang các VLAN đó', 'Access VLAN 1', 'Routed port', 'Cổng đã shutdown'], 0, 'AP độc lập tự đưa dữ liệu vào VLAN nên cần trunk. AP Local mode dùng cổng access vì dữ liệu đi trong CAPWAP.'],
  ['sw', 'SVI của VLAN 20 ở trạng thái up/up khi nào?', ['VLAN 20 tồn tại và có ít nhất một cổng hoạt động trong VLAN đó', 'Chỉ cần đặt địa chỉ IP', 'Chỉ cần bật ip routing', 'Khi có một trunk bất kỳ đang up, kể cả không mang VLAN 20'], 0, 'Ngoài ra SVI phải được no shutdown. Thiếu VLAN hoặc không có cổng hoạt động thì SVI down.'],
  ['sw', 'Lệnh nào bật LLDP trên toàn switch Cisco?', ['lldp run', 'cdp run', 'lldp enable', 'feature lldp all'], 0, 'LLDP thường tắt mặc định trên IOS. Dùng show lldp neighbors để đối chiếu với sơ đồ mạng.'],
  // ---------------------------------------------------------------- IP Routing (20)
  ['rt', 'Administrative Distance mặc định của OSPF là?', ['110', '90', '120', '1'], 0, 'Connected 0, static 1, eBGP 20, EIGRP 90, OSPF 110, RIP 120.'],
  ['rt', 'AD mặc định của static route là?', ['1', '0', '5', '110'], 0, 'Static ghi next-hop hay cổng ra đều có AD 1 (trừ khi chỉ định khác).'],
  ['rt', 'Bảng định tuyến có 10.1.0.0/16 qua R-A và 10.1.1.0/24 qua R-B. Gói tới 10.1.1.5 đi đâu?', ['R-B (prefix dài nhất khớp)', 'R-A (prefix ngắn hơn)', 'Cân tải cả hai', 'Bị huỷ'], 0, 'Longest prefix match được xét TRƯỚC AD và metric.'],
  ['rt', 'Floating static route là gì?', ['Static route có AD cao hơn route chính, chỉ dùng khi route chính mất', 'Static route trỏ tới Null0', 'Route học từ BGP', 'Static route không có next-hop'], 0, 'vd ip route 0.0.0.0 0.0.0.0 203.0.113.5 200 làm đường dự phòng cho OSPF (AD 110).'],
  ['rt', 'Lệnh tạo default route tĩnh?', ['ip route 0.0.0.0 0.0.0.0 <next-hop>', 'ip default-route <next-hop>', 'route add default', 'ip route default <next-hop>'], 0, 'Gateway of last resort hiện trong show ip route với mã S*.'],
  ['rt', 'Chọn 2 tham số PHẢI khớp để hai router lên láng giềng OSPF.', ['Area ID', 'Hello/Dead interval', 'Router ID', 'Process ID'], [0, 1], 'Router ID phải KHÁC nhau; process ID chỉ có ý nghĩa cục bộ. Ngoài ra còn subnet/mask, xác thực, MTU (cho Full).'],
  ['rt', 'DR trên một segment OSPF được bầu theo?', ['Priority cổng cao nhất, bằng nhau thì router ID cao nhất', 'Router ID thấp nhất', 'IP cổng thấp nhất', 'Router bật OSPF đầu tiên luôn là DR'], 0, 'Bầu DR không chiếm quyền: router priority cao bật sau không tự thay DR hiện có.'],
  ['rt', 'Đặt "ip ospf priority 0" trên cổng thì?', ['Router không bao giờ làm DR/BDR trên segment đó', 'Router luôn làm DR', 'Tắt OSPF trên cổng', 'Cổng thành passive'], 0, 'Dùng cho router chi nhánh yếu hoặc không nên làm DR.'],
  ['rt', 'Hai router DROTHER trên cùng segment dừng ở trạng thái nào với nhau?', ['2-WAY', 'FULL', 'INIT', 'EXSTART'], 0, 'DROTHER chỉ đồng bộ LSDB (FULL) với DR và BDR.'],
  ['rt', 'Cost OSPF mặc định của cổng được tính thế nào?', ['Reference bandwidth (mặc định 100 Mbps) chia cho bandwidth cổng', 'Số hop', 'Độ trễ cộng dồn', 'Luôn bằng 1'], 0, 'Cổng 1 Gbps và 100 Mbps cùng cost 1 → nên tăng auto-cost reference-bandwidth.'],
  ['rt', 'OSPF chọn router ID theo thứ tự nào?', ['Lệnh router-id → IP loopback cao nhất → IP cổng active cao nhất', 'IP cổng thấp nhất → loopback', 'MAC cao nhất', 'Ngẫu nhiên'], 0, 'Đặt router-id thủ công để ổn định và dễ nhận diện.'],
  ['rt', 'Lệnh quảng bá default route của router biên vào OSPF?', ['default-information originate', 'redistribute static default', 'network 0.0.0.0 255.255.255.255 area 0', 'ip default-network'], 0, 'Router biên cần có default route trong bảng (hoặc thêm "always").'],
  ['rt', 'HSRP chọn router Active thế nào?', ['Priority cao nhất (mặc định 100), bằng nhau thì IP cổng cao nhất', 'IP thấp nhất', 'Router ID OSPF', 'Router bật trước'], 0, 'Kèm "preempt" để router priority cao lấy lại vai trò khi hoạt động trở lại.'],
  ['rt', 'Lệnh "standby 10 preempt" có tác dụng gì?', ['Cho router priority cao hơn giành lại vai trò Active', 'Tắt HSRP nhóm 10', 'Đặt VIP', 'Đổi phiên bản HSRP'], 0, 'Không có preempt, router đang Active giữ vai trò dù priority thấp hơn.'],
  ['rt', 'Phát biểu nào đúng về VRRP?', ['Chuẩn mở, vai trò Master/Backup, preempt bật mặc định', 'Độc quyền Cisco', 'Cân tải nhiều gateway cùng lúc qua nhiều MAC ảo', 'Chỉ chạy trên switch'], 0, 'Cân tải nhiều MAC ảo cùng lúc là đặc trưng của GLBP.'],
  ['rt', 'Bảng có 0.0.0.0/0, 172.16.0.0/16 và 172.16.4.0/22. Gói tới 172.16.5.9 dùng route nào?', ['172.16.4.0/22', '172.16.0.0/16', '0.0.0.0/0', 'Không route nào'], 0, '172.16.4.0/22 bao 172.16.4.0–172.16.7.255 và là prefix dài nhất khớp.'],
  ['rt', 'Default route tĩnh IPv6 viết thế nào?', ['ipv6 route ::/0 <next-hop>', 'ipv6 route 0::0 0::0 <next-hop>', 'ip route ::/0 <next-hop>', 'ipv6 default-gateway <next-hop>'], 0, 'Router phải bật "ipv6 unicast-routing" mới định tuyến IPv6.'],
  ['rt', 'Lệnh nào bật định tuyến IPv6 trên router Cisco?', ['ipv6 unicast-routing', 'ipv6 enable', 'ipv6 routing on', 'router ipv6'], 0, '"ipv6 enable" trên cổng chỉ tạo link-local.'],
  ['rt', 'Ghép mã route với nguồn gốc.', M(['C', 'Mạng nối trực tiếp'], ['L', 'IP của chính cổng (/32)'], ['S', 'Route tĩnh'], ['O', 'OSPF trong cùng vùng']), null, 'Đọc nhanh bảng định tuyến bắt đầu từ cột mã.'],
  ['rt', 'Cùng prefix 10.5.0.0/24 học từ cả OSPF và EIGRP, router đưa route nào vào bảng?', ['EIGRP, vì AD 90 thấp hơn OSPF 110', 'OSPF, vì là chuẩn mở', 'Cả hai và cân tải', 'Route có metric nhỏ hơn'], 0, 'Metric chỉ so sánh trong CÙNG giao thức; giữa các giao thức so AD.'],
  // ---------------------------------------------------------------- Network Services and Security (20)
  ['svc', 'NAT overload còn được gọi là?', ['PAT (Port Address Translation)', 'Static NAT', 'NAT pool', 'NAT64'], 0, 'Nhiều IP private dùng chung một IP public, phân biệt bằng số port.'],
  ['svc', 'Ghép thuật ngữ NAT với ý nghĩa.', M(['Inside local', 'IP thật (private) của máy bên trong'], ['Inside global', 'IP public đại diện cho máy bên trong'], ['Outside global', 'IP thật của máy bên ngoài'], ['Outside local', 'IP của máy bên ngoài như mạng trong nhìn thấy']), null, 'Thường outside local = outside global (không dịch phía ngoài).'],
  ['svc', 'ACL standard nên đặt ở đâu?', ['Gần ĐÍCH', 'Gần NGUỒN', 'Trên router ISP', 'Ở cổng bất kỳ'], 0, 'Standard chỉ lọc IP nguồn — đặt gần nguồn sẽ chặn luôn traffic tới đích khác.'],
  ['svc', 'ACL extended nên đặt ở đâu?', ['Gần NGUỒN', 'Gần ĐÍCH', 'Chỉ chiều out', 'Trên switch lớp 2'], 0, 'Lọc chính xác theo nguồn/đích/port nên chặn sớm để đỡ tốn băng thông.'],
  ['svc', 'Cuối mọi ACL luôn có dòng ngầm định nào?', ['deny any (chặn hết những gì chưa khớp)', 'permit any', 'deny tcp any any', 'Không có dòng nào'], 0, 'Quên "permit" cuối ACL là lỗi hay gặp làm chặn nhầm mọi thứ.'],
  ['svc', 'Port-security vi phạm thì hành động MẶC ĐỊNH là?', ['shutdown (err-disabled)', 'restrict', 'protect', 'Chỉ ghi log'], 0, 'restrict: bỏ frame lạ + đếm + log; protect: bỏ frame lạ, không log.'],
  ['svc', 'DHCP snooping chống lại tấn công nào?', ['DHCP server giả mạo cắm vào cổng untrusted', 'Brute-force mật khẩu', 'Tấn công DNS', 'VLAN hopping'], 0, 'Chỉ cổng "trusted" (hướng về server hợp lệ) được gửi DHCP Offer/Ack.'],
  ['svc', 'Dynamic ARP Inspection (DAI) kiểm tra ARP dựa vào gì?', ['Bảng binding của DHCP snooping', 'Bảng định tuyến', 'Bảng CAM của router', 'Danh sách CDP'], 0, 'Cặp IP–MAC không có trong binding (hoặc ARP ACL) thì bị huỷ — chống ARP spoofing.'],
  ['svc', 'Chọn 2 bước cần để quản trị thiết bị Cisco bằng SSH.', ['Đặt hostname, ip domain-name rồi tạo khoá RSA (crypto key generate rsa)', 'Trên line vty: transport input ssh và login local (kèm username)', 'Đặt enable password cisco', 'Tắt ip routing'], [0, 1], 'Nên dùng SSH version 2 và khoá RSA ≥ 1024 bit.'],
  ['svc', 'TACACS+ khác RADIUS ở điểm nào?', ['TACACS+ dùng TCP 49, mã hoá toàn bộ gói và tách riêng authorization', 'TACACS+ là chuẩn mở', 'RADIUS mã hoá toàn bộ gói', 'RADIUS dùng TCP 49'], 0, 'RADIUS (UDP 1812/1813) chỉ mã hoá mật khẩu, gộp authentication + authorization.'],
  ['svc', 'Phase 1 (IKE) của VPN IPsec site-to-site để làm gì?', ['Tạo kênh an toàn (ISAKMP SA) để thương lượng Phase 2', 'Mã hoá dữ liệu người dùng', 'Cấp IP cho client', 'Chạy NAT'], 0, 'Phase 2 tạo IPsec SA (ESP) mã hoá traffic "interesting" khớp crypto ACL.'],
  ['svc', 'ACL 100: "deny tcp any host 10.1.1.1 eq 23" rồi "permit ip any any". Kết quả?', ['Chặn Telnet tới 10.1.1.1, cho phép mọi thứ khác', 'Chặn mọi traffic tới 10.1.1.1', 'Chặn Telnet từ 10.1.1.1', 'Chặn tất cả'], 0, 'Dòng đầu chỉ khớp TCP port 23 có đích 10.1.1.1.'],
  ['svc', 'Ghép loại bản ghi DNS với công dụng.', M(['A', 'Tên miền tới địa chỉ IPv4'], ['AAAA', 'Tên miền tới địa chỉ IPv6'], ['CNAME', 'Bí danh của một tên miền khác'], ['MX', 'Máy chủ nhận thư của tên miền']), null, 'Lỗi truy cập theo tên thường do bản ghi sai hoặc thiếu; thêm NS là máy chủ quản lý tên miền, PTR là tra ngược IP ra tên.'],
  ['svc', 'Web mở được theo IP nhưng tra IP ra tên không có kết quả. Nên kiểm tra bản ghi nào?', ['PTR', 'MX', 'AAAA', 'CNAME'], 0, 'PTR phục vụ tra ngược. Lỗi này cũng hay làm máy chủ thư từ chối thư đến.'],
  ['svc', 'Storm Control trên cổng switch dùng để?', ['Giới hạn lưu lượng broadcast, multicast hoặc unicast vượt ngưỡng', 'Chặn ARP giả mạo', 'Chặn DHCP giả mạo', 'Mã hoá khung Ethernet'], 0, 'Khi lưu lượng vượt ngưỡng, cổng lọc bớt hoặc shutdown tuỳ cấu hình, giúp hạn chế bão broadcast.'],
  ['svc', 'RA Guard chống lại mối nguy nào?', ['Router Advertisement IPv6 giả từ thiết bị trái phép', 'DHCPv4 server giả', 'Dò mật khẩu qua SSH', 'Sai native VLAN'], 0, 'Máy khách IPv6 tin RA để chọn gateway, nên RA giả có thể kéo lưu lượng đi qua kẻ tấn công.'],
  ['svc', 'Chọn 2 giao thức chép file cấu hình và IOS có mã hoá.', ['SCP', 'SFTP', 'TFTP', 'FTP'], [0, 1], 'SCP và SFTP chạy trên SSH. TFTP và FTP gửi dữ liệu dạng rõ, không nên dùng qua mạng không tin cậy.'],
  ['svc', 'Chế độ tunnel của IPsec khác chế độ transport ở điểm nào?', ['Tunnel bọc cả gói IP gốc trong header IP mới, transport giữ header IP gốc', 'Tunnel không mã hoá dữ liệu', 'Transport bắt buộc dùng cho VPN site-to-site', 'Hai chế độ giống nhau'], 0, 'VPN site-to-site thường dùng tunnel vì che được địa chỉ mạng bên trong.'],
  ['svc', 'Trong IPsec, ESP khác AH ở điểm nào?', ['ESP mã hoá dữ liệu, AH chỉ xác thực và kiểm toàn vẹn', 'AH mã hoá dữ liệu, ESP thì không', 'ESP chỉ dùng cho IPv6', 'AH thay thế cho IKE'], 0, 'Thực tế hầu hết VPN dùng ESP vì cần tính bí mật.'],
  ['svc', 'Lệnh nào phải bật trước khi cấu hình thiết bị làm AAA client?', ['aaa new-model', 'service password-encryption', 'ip domain-lookup', 'login local'], 0, 'Sau đó khai báo máy chủ TACACS+ hoặc RADIUS và danh sách phương thức, nên có local dự phòng để không tự khoá mình.'],
  // ---------------------------------------------------------------- AI, and Network Operations and Management (10)
  ['ops', 'Mức syslog nào nghiêm trọng NHẤT?', ['0 — emergencies', '7 — debugging', '4 — warnings', '3 — errors'], 0, 'Số càng nhỏ càng nghiêm trọng: 0 emergencies … 7 debugging.'],
  ['ops', 'Phiên bản SNMP nào có cả xác thực và mã hoá?', ['SNMPv3', 'SNMPv1', 'SNMPv2c', 'Cả ba'], 0, 'v1/v2c dùng community string dạng chữ thường, không mã hoá.'],
  ['ops', 'SDN tách phần nào khỏi thiết bị mạng để đưa lên controller?', ['Control plane', 'Data plane', 'Management plane của cáp', 'Lớp vật lý'], 0, 'Thiết bị giữ data plane (chuyển tiếp); controller tính toán và đẩy chính sách xuống.'],
  ['ops', 'Đặc điểm của Ansible?', ['Agentless, kết nối qua SSH, playbook viết bằng YAML', 'Bắt buộc cài agent trên thiết bị', 'Chỉ chạy trên Windows', 'Viết bằng ngôn ngữ Ruby DSL'], 0, 'Mô hình push từ máy điều khiển.'],
  ['ops', 'Cisco Catalyst Center (DNA Center) là gì?', ['Controller quản lý mạng doanh nghiệp theo ý định (intent-based), tự động hoá và giám sát', 'Một dòng router chi nhánh', 'Phần mềm giả lập mạng', 'Một giao thức định tuyến'], 0, 'Cung cấp REST API northbound để tích hợp và tự động hoá.'],
  ['ops', 'Agentic AI khác chatbot hỏi đáp thông thường ở điểm nào?', ['Có thể tự lập kế hoạch và gọi công cụ để làm nhiều bước theo mục tiêu', 'Không bao giờ sai', 'Không cần dữ liệu đầu vào', 'Chỉ trả lời có hoặc không'], 0, 'Trong vận hành mạng, kết quả của AI vẫn phải được người kiểm tra, nhất là trước khi đổi cấu hình.'],
  ['ops', 'Trước khi dán cấu hình thiết bị vào công cụ AI công cộng, nên làm gì?', ['Phân loại dữ liệu và xoá mật khẩu, khoá, địa chỉ nhạy cảm', 'Dán nguyên bản để AI hiểu đủ', 'Thêm mật khẩu enable để AI kiểm tra', 'Chỉ cần viết prompt bằng tiếng Anh'], 0, 'Cấu hình có thể chứa bí mật. Phân loại dữ liệu là một thành phần của prompt an toàn.'],
  ['ops', 'Prompt nào phù hợp nhất để nhờ AI hỗ trợ xử lý lỗi OSPF?', ['Bạn là kỹ sư mạng. Từ output đã che thông tin nhạy cảm dưới đây, liệt kê nguyên nhân có thể dưới dạng bảng.', 'OSPF hỏng, sửa đi.', 'Viết gì đó về OSPF.', 'Tự đăng nhập router và sửa giúp tôi.'], 0, 'Prompt tốt có vai trò (persona), dữ liệu đầu vào, yêu cầu rõ và định dạng đầu ra.'],
  ['ops', 'Trong log %LINK-3-UPDOWN: Interface Gi0/1, changed state to down, số 3 và LINK là gì?', ['Mức độ 3 (errors) và facility LINK', 'Cổng số 3 và VLAN LINK', 'Lần lỗi thứ 3 và tên thiết bị', 'Stratum 3 và giao thức LINK'], 0, 'Dạng %FACILITY-SEVERITY-MNEMONIC: số càng nhỏ càng nghiêm trọng.'],
  ['ops', 'Infrastructure as Code nghĩa là gì?', ['Mô tả hạ tầng bằng file có quản lý phiên bản và áp dụng tự động', 'Viết tài liệu sau khi cấu hình xong', 'Gõ lệnh từng thiết bị theo trí nhớ', 'Chỉ dùng giao diện web của từng thiết bị'], 0, 'Cấu hình được review, lặp lại được và ít sai lệch giữa các thiết bị hơn cách làm thủ công.'],
];

// câu lab mô phỏng: lấy lab có sẵn, chấm các nhiệm vụ cấu hình (bỏ câu trắc nghiệm trong lab), mỗi câu 3 điểm
export const SIMS = [
  { lab: 'L16', domain: 'infra', pts: 3 },
  { lab: 'A05', domain: 'sw', pts: 3 },
  { lab: 'A17', domain: 'rt', pts: 3 },
  { lab: 'A19', domain: 'svc', pts: 3 },
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
  if (mode === 'sec') { // toàn bộ ngân hàng Security + 2 câu lab, 50 phút; chỉ có tiếng Việt
    const qs = shuffle(SEC_BANK.map((q, i) => ({ q, i })), r).map(({ q: [domain, text, opts, ans, explain], i }) => {
      const order = shuffle(opts.map((_, k) => k), r), options = order.map((k) => opts[k]);
      return { i: 'sec:' + i, kind: 'one', domain, text, textEn: text, options, optionsEn: options, answer: order.indexOf(ans), pts: 1, explain, explainEn: explain };
    });
    SEC_SIMS.forEach((s, k) => qs.splice(Math.round(((k + 1) * qs.length) / 3) + k, 0, { i: 'sim:' + s.lab, kind: 'sim', domain: s.domain, lab: s.lab, pts: s.pts }));
    return { seed, mode, minutes: 50, qs };
  }
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
  const doms = exam.mode === 'sec' ? SEC_DOMAINS : DOMAINS;
  const per = Object.fromEntries(doms.map((d) => [d.id, { got: 0, max: 0 }]));
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
    domains: doms.map((d) => ({ id: d.id, name: d.name, vi: d.vi, got: per[d.id].got, max: per[d.id].max, pct: per[d.id].max ? per[d.id].got / per[d.id].max : null })),
    wrong,
  };
}
