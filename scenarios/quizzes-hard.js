// scenarios/quizzes-hard.js — câu tình huống cho quiz từng kịch bản: đọc output, tính toán, tìm lỗi.
// Đáp án đúng luôn viết trước; quiz trộn thứ tự đáp án mỗi lần mở (buildQuiz trong quizzes.js).

const H = (q, right, wrongs, explainVi) => ({ q, options: [right, ...wrongs], correct: 0, explainVi });

export const HARD = {
  's01-ping-same-subnet': [
    H('Router Cisco ping máy cùng mạng lần đầu ra ".!!!!". Dấu chấm đầu là do?', 'Gói đầu bị bỏ trong lúc chờ ARP phân giải MAC', ['Máy đích chặn ICMP', 'STP đang hội tụ', 'MTU quá nhỏ'], 'Router không giữ gói chờ ARP; khi đã có MAC thì các gói sau đi được.'),
    H('Switch học MAC của PC1 từ đâu khi nhận ARP Request?', 'MAC nguồn trong header Ethernet của khung', ['MAC đích của khung', 'Trường Target MAC trong ARP', 'Bảng ARP của PC1'], 'Switch chỉ đọc header Ethernet; MAC nguồn + cổng vào được ghi vào bảng MAC.'),
    H('PC2 vừa thay card mạng (MAC mới), PC1 còn mục ARP cũ. Hiện tượng?', 'PC1 gửi khung tới MAC cũ nên ping lỗi cho tới khi mục ARP hết hạn hoặc bị xoá', ['Switch tự sửa MAC trong khung', 'Ping vẫn được vì IP đúng', 'PC1 tự gửi lại ARP mỗi gói'], 'Gratuitous ARP từ PC2 hoặc "arp -d" trên PC1 sẽ sửa nhanh.'),
  ],
  's02-ping-across-router': [
    H('Gói từ PC1 tới 192.168.2.10 rời R1 sang R2. MAC nguồn và MAC đích lúc này là?', 'Nguồn: cổng ra của R1, đích: cổng vào của R2', ['Nguồn: PC1, đích: PC2', 'Nguồn: PC1, đích: R2', 'Nguồn: R1, đích: PC2'], 'MAC viết lại ở mỗi chặng; IP nguồn và đích giữ nguyên.'),
    H('R1 có 10.0.0.0/8 qua A, 10.1.0.0/16 qua B, 0.0.0.0/0 qua C. Gói tới 10.1.5.5 đi đâu?', 'Qua B', ['Qua A', 'Qua C', 'Chia đều A và B'], 'Longest-prefix match: /16 dài hơn /8 và /0.'),
    H('Gói tới router với TTL = 1, đích ở mạng phía sau. Router làm gì?', 'Bỏ gói và gửi ICMP Time Exceeded về nguồn', ['Chuyển tiếp với TTL = 0', 'Đặt lại TTL = 64 rồi chuyển', 'Bỏ gói, không báo gì'], 'TTL giảm về 0 thì không được chuyển tiếp; traceroute dựa vào điều này.'),
  ],
  's03-vlan-segmentation': [
    H('VLAN 10 gồm cổng 1–4, VLAN 20 gồm cổng 5–8. PC ở cổng 2 gửi broadcast. Cổng nào nhận?', 'Cổng 1, 3, 4', ['Cổng 1–8 trừ 2', 'Cổng 5–8', 'Không cổng nào'], 'Broadcast chỉ flood trong VLAN của cổng nhận (và trunk mang VLAN đó).'),
    H('"show vlan brief" không thấy Fa0/24 ở VLAN nào. Lý do hay gặp nhất?', 'Fa0/24 đang là cổng trunk', ['Fa0/24 bị shutdown', 'Fa0/24 thuộc VLAN 1', 'Switch chưa lưu cấu hình'], 'Bảng này chỉ liệt kê cổng access; trunk xem bằng "show interfaces trunk".'),
    H('Gõ "switchport access vlan 30" khi VLAN 30 chưa tạo. IOS làm gì?', 'Báo "Access VLAN does not exist. Creating vlan 30" và tự tạo', ['Báo lỗi, không nhận lệnh', 'Đưa cổng về VLAN 1', 'Tắt cổng'], 'VLAN được tạo với tên mặc định VLAN0030.'),
  ],
  's04-trunk-dot1q': [
    H('Hai đầu trunk lệch native VLAN (1 và 99). Điều gì xảy ra?', 'CDP báo native VLAN mismatch và khung không tag của VLAN này lọt sang VLAN kia', ['Trunk tự tắt', 'Mọi VLAN mất kết nối', 'Không ảnh hưởng gì'], 'Khung native không có tag nên đầu kia hiểu theo native VLAN của nó.'),
    H('Trunk chỉ cho phép VLAN 10,20. Hai PC VLAN 30 ở hai switch ping nhau?', 'Không được, VLAN 30 bị chặn trên trunk', ['Được, đi qua native VLAN', 'Được nếu cùng subnet', 'Được sau khi STP hội tụ'], 'Xem cột "Vlans allowed and active" trong "show interfaces trunk".'),
    H('Muốn thêm VLAN 40 vào trunk mà giữ các VLAN cũ, gõ lệnh nào?', 'switchport trunk allowed vlan add 40', ['switchport trunk allowed vlan 40', 'switchport trunk native vlan 40', 'switchport access vlan 40'], 'Thiếu chữ "add" sẽ thay cả danh sách, chỉ còn VLAN 40.'),
  ],
  's05-stp-root-election': [
    H('Root port của switch non-root được chọn theo thứ tự nào?', 'Root path cost thấp nhất, rồi Bridge ID người gửi thấp nhất, rồi Port ID người gửi thấp nhất', ['MAC cổng thấp nhất', 'Tốc độ cổng cao nhất trước tiên', 'Số thứ tự cổng thấp nhất'], 'Cùng bộ tiêu chí so sánh BPDU nhận được.'),
    H('Gõ "spanning-tree vlan 10 priority 4097". Kết quả?', 'Báo lỗi: priority phải là bội số của 4096', ['Nhận, làm tròn về 4096', 'Nhận đúng giá trị 4097', 'Switch thành root ngay'], '12 bit thấp của Bridge ID dành cho số VLAN (extended system ID).'),
  ],
  's06-inter-vlan-routing': [
    H('Đặt IP lên g0/0.20 khi chưa gõ "encapsulation dot1Q 20". Kết quả?', 'IOS không nhận IP, VLAN 20 không có gateway', ['Sub-interface tự chọn VLAN 20', 'Chạy được, gửi khung không tag', 'Mọi VLAN dùng chung IP đó'], 'Sub-interface phải gắn VLAN trước rồi mới đặt IP.'),
    H('Cổng switch nối với router-on-a-stick phải ở chế độ nào?', 'Trunk', ['Access VLAN 1', 'Access VLAN của router', 'Routed port'], 'Router cần nhận khung có tag của mọi VLAN.'),
    H('PC VLAN 10 ping PC VLAN 20 qua router-on-a-stick. Mỗi gói đi qua link switch–router mấy lần?', '2 lần: lên với tag 10, xuống với tag 20', ['1 lần', '3 lần', '0 lần vì switch tự định tuyến'], 'Link này dễ nghẽn; switch Layer 3 với SVI bỏ được vòng này.'),
  ],
  's07-ospf-adjacency': [
    H('R1 Hello 10 Dead 40, R2 Hello 5 Dead 20 trên cùng link. Kết quả?', 'Không lên láng giềng vì lệch timer', ['Lên láng giềng, dùng timer nhỏ hơn', 'Lên láng giềng, dùng timer lớn hơn', 'Lên nhưng không bầu DR'], 'Hello, Dead, area, subnet, xác thực, cờ stub phải khớp.'),
    H('Hai router kẹt ở EXSTART/EXCHANGE. Nguyên nhân hay gặp?', 'Lệch MTU trên hai đầu link', ['Lệch Router ID', 'Lệch cost', 'Lệch priority'], 'DBD lớn hơn MTU bên kia bị bỏ; sửa MTU hoặc "ip ospf mtu-ignore".'),
    H('Trên Ethernet có 4 router OSPF, hai DROTHER với nhau ở trạng thái nào?', '2-WAY', ['FULL', 'EXSTART', 'INIT'], 'DROTHER chỉ FULL với DR và BDR; 2-WAY giữa các DROTHER là bình thường.'),
  ],
  's08-eigrp-dual': [
    H('Hai router không lên láng giềng EIGRP, log báo "K-value mismatch". Nghĩa là?', 'Hệ số K của metric khác nhau ở hai router', ['Lệch AS', 'Lệch mật khẩu', 'Lệch Hello timer'], 'K1–K5 phải giống nhau, mặc định K1 = K3 = 1.'),
    H('Mất Successor và KHÔNG có Feasible Successor. Router làm gì?', 'Đưa route sang Active và gửi Query tới láng giềng', ['Xoá route, chờ Update', 'Dùng ngay đường có FD nhỏ nhất còn lại', 'Gửi Hello nhanh hơn'], 'Router stub và tóm tắt route giúp giới hạn phạm vi Query.'),
  ],
  's09-dhcp-dora': [
    H('Máy Windows nhận 169.254.x.x. Khả năng cao nhất?', 'Không nhận được Offer: server lỗi hoặc thiếu ip helper-address', ['Bị trùng IP', 'Sai DNS', 'Sai default gateway'], 'APIPA là địa chỉ tự đặt khi DHCP thất bại.'),
    H('"ip helper-address" đặt ở interface nào?', 'Interface nhận broadcast của client, thường là gateway VLAN đó', ['Interface nối tới DHCP server', 'Mọi interface của router', 'Trên chính DHCP server'], 'Router đổi broadcast thành unicast gửi tới server.'),
    H('Server DHCP trên router cấp trùng IP với máy in đặt tĩnh. Cách phòng?', 'ip dhcp excluded-address cho các IP đặt tĩnh', ['Giảm lease', 'Tắt DHCP snooping', 'Đổi default-router'], 'Pool sẽ bỏ qua các IP bị loại trừ.'),
  ],
  's10-dns-resolution': [
    H('ping 8.8.8.8 được nhưng ping google.com báo không tìm thấy host. Lỗi ở đâu?', 'Phân giải tên: sai DNS server hoặc UDP 53 bị chặn', ['Default gateway', 'Card mạng', 'Định tuyến tới Internet'], 'Đã ra được Internet bằng IP thì lớp mạng ổn.'),
    H('Đã đổi bản ghi A nhưng nhiều người vẫn vào IP cũ vài giờ. Vì sao?', 'Bản ghi cũ còn trong cache tới khi hết TTL', ['Server DNS lỗi', 'Trình duyệt chặn', 'DNS chỉ cập nhật mỗi ngày'], 'Hạ TTL trước khi đổi để chuyển nhanh hơn.'),
    H('Phản hồi DNS quá lớn so với UDP (không có EDNS) thì?', 'Server đặt cờ TC, client hỏi lại bằng TCP 53', ['Bị phân mảnh và bỏ', 'Server nén lại', 'Client bỏ qua câu trả lời'], 'Chuyển vùng (zone transfer) cũng dùng TCP 53.'),
  ],
  's11-nat-pat': [
    H('Đã có "ip nat inside source list 1 interface g0/1 overload" mà bảng NAT trống. Kiểm tra gì trước?', '"ip nat inside" và "ip nat outside" đặt đúng cổng, ACL 1 khớp dải nội bộ', ['Bật ip routing', 'Đổi sang static NAT', 'Xoá route mặc định'], 'Thiếu một trong hai lệnh inside/outside là NAT không chạy.'),
    H('Muốn Internet vào web server nội bộ 192.168.1.10 sau PAT. Cần gì?', 'Static NAT theo cổng: ip nat inside source static tcp 192.168.1.10 80 <IP public> 80', ['Thêm overload', 'ACL permit any', 'Route tĩnh tới 192.168.1.10'], 'PAT động chỉ tạo mục khi bên trong đi ra trước.'),
    H('Trong "show ip nat translations", cột Inside global là?', 'Địa chỉ public đại diện cho máy bên trong', ['IP thật của máy bên trong', 'IP máy chủ ngoài Internet', 'IP gateway'], 'Inside local là IP thật; inside global là IP sau khi dịch.'),
  ],
  's12-acl-filter': [
    H('ACL 100: deny tcp any host 10.1.1.10 eq 80, rồi permit ip any any. Ping tới 10.1.1.10?', 'Được, chỉ TCP 80 bị chặn', ['Bị chặn', 'Bị chặn vì implicit deny', 'Chỉ được chiều về'], 'ICMP khớp dòng permit ip any any.'),
    H('access-list 1 permit 192.168.1.0 0.0.0.255 áp chiều out ra Internet. Máy 192.168.2.5 ra được không?', 'Không, bị implicit deny cuối ACL', ['Được vì ACL standard chỉ xét nguồn', 'Được vì áp chiều out', 'Được nếu có NAT'], 'Mọi ACL kết thúc bằng deny any ngầm.'),
    H('10.0.0.16 với wildcard 0.0.0.15 khớp dải nào?', '10.0.0.16 – 10.0.0.31', ['10.0.0.0 – 10.0.0.15', '10.0.0.16 – 10.0.0.255', 'Chỉ 10.0.0.16'], '4 bit cuối tuỳ ý = 16 địa chỉ bắt đầu từ .16.'),
  ],
  's13-hsrp-failover': [
    H('R1 priority 110, R2 100, cả hai có preempt. R1 chết rồi sống lại. Ai Active?', 'R1 lấy lại Active nhờ preempt', ['R2 giữ Active', 'Cả hai Active', 'Bầu lại theo IP'], 'Không có preempt thì R2 giữ Active tới khi R2 lỗi.'),
    H('R1 đang Active, link WAN của R1 đứt nhưng LAN vẫn lên. Để R2 tiếp quản cần?', 'Track interface WAN để giảm priority của R1, kèm preempt trên R2', ['Tăng hello timer', 'Đổi virtual IP', 'Không cần gì, HSRP tự biết'], 'HSRP chỉ thấy LAN; track báo cho nó biết WAN đã đứt.'),
  ],
  's14-tcp-handshake': [
    H('Client gửi SYN, server trả RST. Nghĩa là?', 'Không có ứng dụng lắng nghe cổng đó (cổng đóng)', ['Firewall chặn gói', 'Server quá tải', 'Mạng mất gói'], 'Firewall chặn thường im lặng nên client chờ tới timeout.'),
    H('Client gửi SYN mãi không thấy trả lời. Khả năng cao nhất?', 'Gói bị firewall bỏ hoặc không có đường tới server', ['Cổng đóng', 'Lệch MSS', 'Server đang bận'], 'Cổng đóng thì có RST trả về ngay.'),
  ],
  's15-traceroute': [
    H('Traceroute chặng 3 hiện "* * *" nhưng chặng 4 trở đi bình thường. Nghĩa là?', 'Router chặng 3 không trả ICMP Time Exceeded, đường vẫn thông', ['Đường đứt ở chặng 3', 'Vòng lặp định tuyến', 'MTU nhỏ ở chặng 3'], 'Nhiều router giới hạn hoặc tắt việc gửi ICMP.'),
    H('tracert của Windows khác traceroute của Cisco ở điểm nào?', 'Windows gửi ICMP Echo, Cisco gửi UDP cổng cao', ['Windows không dùng TTL', 'Cisco chỉ thử 1 lần mỗi chặng', 'Không khác gì'], 'Firewall chặn UDP thì traceroute Cisco dừng sớm hơn.'),
    H('Traceroute hiện hai IP lặp xen kẽ tới khi hết TTL. Dấu hiệu gì?', 'Vòng lặp định tuyến giữa hai router đó', ['Chia tải ECMP', 'Router chặn ICMP', 'Đích tắt máy'], 'Hai router chỉ route của nhau cho cùng đích.'),
  ],
  's16-fragmentation': [
    H('VPN: web nhỏ mở được, tải file lớn bị treo. Ping với DF và gói 1472 byte báo cần phân mảnh. Sửa thế nào?', 'Giảm MTU/MSS trên tunnel, ví dụ ip tcp adjust-mss 1360', ['Tăng TTL', 'Tắt DF trên mọi máy', 'Đổi default gateway'], 'Header tunnel làm gói gốc vượt MTU; ICMP Frag Needed bị chặn thì PMTUD không chạy.'),
  ],
  's17-bgp-ebgp': [
    H('"show ip bgp summary" có neighbor ở trạng thái Active. Nghĩa là?', 'Chưa lập được phiên TCP 179, router vẫn đang thử', ['Phiên đã lên và đang hoạt động', 'Đang nhận route', 'Láng giềng bị shutdown'], 'Lên phiên thì cột này hiện số prefix nhận được.'),
    H('eBGP qua loopback không lên dù ping loopback được. Thiếu gì?', 'ebgp-multihop và update-source loopback', ['next-hop-self', 'route reflector', 'network loopback'], 'eBGP mặc định TTL 1 và lấy nguồn là cổng ra.'),
    H('Hai đường cùng prefix, weight bằng nhau. Local preference 200 và 100 thì?', 'Chọn đường local preference 200', ['Chọn đường 100', 'Chia tải', 'So AS_PATH trước'], 'Local preference cao hơn thắng, xét trước AS_PATH.'),
  ],
  's18-ospf-multiarea': [
    H('Area 1 không nối trực tiếp area 0 nên mất route liên vùng. Cách tạm?', 'Virtual link qua area trung gian tới area 0', ['Đổi area 1 thành stub', 'Redistribute connected', 'Tăng cost'], 'Mọi area phải nối với backbone.'),
    H('Area totally stubby nhận từ ABR loại route liên vùng nào?', 'Chỉ một default route (LSA 3)', ['Mọi LSA 3 và 5', 'Chỉ LSA 5', 'Không nhận gì'], 'Giảm bảng route cho chi nhánh nhỏ.'),
    H('Tóm tắt route liên vùng ở ABR dùng lệnh nào?', 'area <id> range <mạng> <mask>', ['summary-address', 'ip summary-address eigrp', 'aggregate-address'], 'summary-address dùng ở ASBR cho route ngoài.'),
  ],
  's19-rstp': [
    H('Cổng nối PC có PortFast và BPDU Guard, có người cắm switch vào. Kết quả?', 'Cổng vào err-disabled', ['Cổng thành root port', 'Cổng chuyển Discarding rồi tự mở', 'Không có gì'], 'Bật lại bằng shutdown/no shutdown hoặc errdisable recovery.'),
    H('RSTP gộp Blocking và Listening của STP thành trạng thái nào?', 'Discarding', ['Learning', 'Disabled', 'Forwarding'], 'RSTP còn ba trạng thái: Discarding, Learning, Forwarding.'),
    H('Link half-duplex (qua hub) trong RSTP có link type gì?', 'Shared, nên không dùng được Proposal/Agreement nhanh', ['Point-to-point', 'Edge', 'Root'], 'Full-duplex mặc định là point-to-point.'),
  ],
  's20-qos-dscp': [
    H('Đã có LLQ mà thoại vẫn rè khi tải file lớn. Kiểm tra gì trước?', 'Gói thoại có được đánh dấu EF và class-map có khớp không', ['Tăng hello OSPF', 'Đổi codec sang G.711', 'Tắt CDP'], '"show policy-map interface" cho biết lớp nào đang khớp gói.'),
    H('"priority percent 33" trong policy-map nghĩa là?', 'Hàng đợi ưu tiên được tới 33% băng thông, vượt thì bị cắt khi nghẽn', ['Thoại luôn chiếm đúng 33%', 'Giới hạn 33 cuộc gọi', 'Chỉ chạy khi link rảnh'], 'Giới hạn này chống hàng ưu tiên chiếm hết link.'),
  ],
  's21-redistribution': [
    H('Route OSPF học từ redistribute mặc định hiện mã gì, metric bao nhiêu?', 'O E2, metric 20', ['O IA, metric 1', 'O E1, metric 0', 'O, metric 110'], 'Route từ BGP vào OSPF mặc định metric 1.'),
    H('AD của route EIGRP external là?', '170', ['90', '110', '120'], 'EIGRP internal 90, external 170.'),
    H('IOS cũ: "redistribute eigrp 100" vào OSPF mà thiếu "subnets". Kết quả?', 'Chỉ mạng classful được đưa vào, subnet bị bỏ', ['Mọi route được đưa vào', 'Không route nào', 'Báo lỗi cú pháp'], 'IOS XE mới tự thêm subnets.'),
  ],
  's22-wrong-gateway': [
    H('PC sai gateway, "arp -a" không có mục nào cho IP gateway. Điều đó cho thấy?', 'Không thiết bị nào trả ARP cho IP đó: gateway không tồn tại ở địa chỉ này', ['Router chặn ping', 'Switch lỗi', 'DNS sai'], 'Gateway đúng sẽ có mục ARP sau lần thử đầu.'),
    H('Cách nhanh xác định gateway đúng cho LAN của PC?', 'Xem IP cổng router nối LAN bằng show ip interface brief', ['Hỏi DNS', 'Xem bảng MAC của switch', 'Chạy tracert tới chính PC'], 'Gateway là IP cổng router trong cùng subnet.'),
  ],
  's23-vlan-mismatch': [
    H('PC2 sai VLAN vẫn nhận IP qua DHCP nhưng thuộc dải của VLAN 20. Điều đó cho thấy?', 'Cổng đang ở VLAN 20 và DHCP cấp đúng theo VLAN đó', ['DHCP server lỗi', 'PC2 đặt IP tĩnh', 'Trunk lệch native VLAN'], 'Dải IP nhận được là manh mối nhanh để biết cổng thuộc VLAN nào.'),
    H('Trong "show mac address-table", dấu hiệu nào cho biết PC2 sai VLAN?', 'MAC của PC2 nằm dưới VLAN 20 trên cổng Fa0/2', ['MAC PC2 không có', 'MAC PC2 trên mọi cổng', 'MAC PC2 kiểu STATIC'], 'Cột Vlan cho biết khung vào được gán VLAN nào.'),
  ],
  's24-mst': [
    H('Hai switch cùng tên region và revision nhưng bảng ánh xạ VLAN khác nhau. Kết quả?', 'Thành hai region khác nhau, ranh giới chạy như một cây chung', ['Vẫn chung region', 'Switch tự đồng bộ bảng', 'Mọi cổng bị chặn'], 'Tên, revision và bảng VLAN–instance phải khớp hoàn toàn.'),
    H('MST: muốn VLAN 10 đi qua SW1, VLAN 20 qua SW2. Làm thế nào?', 'Đặt hai VLAN vào hai instance, mỗi switch làm root một instance', ['Tắt STP ở VLAN 20', 'Dùng một instance cho cả hai', 'Đổi cost cổng access'], 'Đó là cân tải bằng nhiều instance.'),
    H('IST là instance số mấy?', '0', ['1', '4094', '15'], 'IST (MSTI 0) chạy với bên ngoài region.'),
  ],
  's25-qos-advanced': [
    H('ISP bán 10 Mbps trên cổng 100 Mbps. Vì sao nên shaping thay vì để ISP policing?', 'Shaping xếp hàng làm mượt, policing của ISP sẽ bỏ gói vượt', ['Shaping nhanh hơn', 'Policing không có ở router', 'Shaping mã hoá gói'], 'Đi kèm hàng đợi con để thoại vẫn được ưu tiên.'),
    H('Switch access tin DSCP từ cổng nối thẳng PC người dùng. Rủi ro?', 'Người dùng tự đánh EF để chen hàng ưu tiên', ['Mất kết nối', 'Lặp vòng STP', 'Tốn CPU switch'], 'Chỉ nên tin dấu từ điện thoại IP (trust device cisco-phone).'),
    H('CS6 thường dùng cho loại lưu lượng nào?', 'Điều khiển mạng như giao thức định tuyến', ['Thoại', 'Video', 'Dữ liệu nền'], 'Thoại dùng EF, video AF41, nền CS1.'),
  ],
  's26-ipv6-ndp': [
    H('Router Cisco không gửi RA nên máy không tự cấu hình được. Lý do hay gặp?', 'Chưa bật ipv6 unicast-routing', ['Chưa bật CDP', 'Thiếu ip helper-address', 'MTU nhỏ'], 'Không có lệnh này, router chạy như một máy IPv6 thường.'),
  ],
  's27-ospfv3': [
    H('Router chỉ chạy IPv6, OSPFv3 không khởi động được vì thiếu router-id. Sửa thế nào?', 'Đặt router-id thủ công dạng 32 bit, ví dụ 1.1.1.1', ['Đặt router-id bằng IPv6', 'Bật ipv6 cef', 'Đổi area thành 0'], 'Router-id vẫn là số 32 bit; không có IPv4 thì không tự chọn được.'),
    H('LSA mới của OSPFv3 mang prefix IPv6 trong area là?', 'Intra-Area-Prefix LSA (type 9)', ['Router LSA (type 1)', 'Network LSA (type 2)', 'External LSA (type 5)'], 'OSPFv3 tách prefix ra khỏi LSA 1 và 2; LSA 8 là Link LSA.'),
  ],
  's28-slaac-dhcpv6': [
    H('RA có cờ M = 0, O = 1. Host làm gì?', 'Tự đặt địa chỉ bằng SLAAC, hỏi DHCPv6 stateless để lấy DNS', ['Xin địa chỉ từ DHCPv6 stateful', 'Không đặt địa chỉ', 'Chỉ dùng link-local'], 'M = 1 mới là xin địa chỉ từ DHCPv6.'),
    H('DHCPv6 không cấp default gateway. Host lấy gateway từ đâu?', 'Địa chỉ link-local nguồn của RA', ['Từ DHCPv6 option', 'Từ DNS', 'Tự đặt ::1'], 'Vì vậy dù dùng DHCPv6 stateful vẫn cần RA.'),
  ],
  's29-mpls': [
    H('LDP đã lên nhưng "show mpls forwarding-table" ghi "No Label" cho loopback PE kia. Nguyên nhân hay gặp?', 'Chưa bật mpls ip trên cổng ở chặng sau nên không có nhãn cho prefix đó', ['Lệch OSPF area', 'Thiếu ip cef ở PC', 'BGP chưa lên'], 'Mỗi cổng trong lõi đều cần LDP để LSP liền mạch.'),
    H('Cột Outgoing ghi "Pop Label" nghĩa là?', 'Bỏ nhãn trên cùng trước khi gửi sang chặng sau (PHP)', ['Thêm nhãn mới', 'Bỏ gói', 'Đổi nhãn sang 0'], 'Router áp chót bỏ nhãn để PE cuối đỡ phải tra hai lần.'),
    H('Muốn khách hàng không thấy các router P khi traceroute qua lõi MPLS, dùng?', 'no mpls ip propagate-ttl', ['no mpls ip', 'mpls ldp router-id', 'ip ttl-security'], 'Mặc định TTL IP được chép vào nhãn nên các router P hiện ra.'),
  ],
  's30-vxlan': [
    H('VXLAN trên underlay IPv4 thêm khoảng bao nhiêu byte? MTU underlay cần ít nhất?', 'Khoảng 50 byte, MTU underlay cần ít nhất 1550', ['8 byte, giữ 1500', '20 byte, 1520', '100 byte, 1600 bắt buộc'], 'Gồm Ethernet ngoài 14, IP 20, UDP 8, VXLAN 8.'),
    H('Không có control plane (flood-and-learn), gói BUM được gửi thế nào?', 'Qua multicast underlay hoặc ingress replication tới các VTEP', ['Bỏ đi', 'Gửi tới controller', 'Chỉ gửi tới VTEP gần nhất'], 'BUM là broadcast, unknown unicast, multicast.'),
    H('Hai VTEP gắn cùng VLAN 10 nhưng khác VNI. Máy hai bên?', 'Không liên lạc lớp 2 được với nhau', ['Vẫn thông vì cùng VLAN', 'Thông qua trunk', 'Thông sau khi STP hội tụ'], 'Trong fabric, VNI mới là định danh của mạng lớp 2.'),
  ],
  's31-evpn': [
    H('Route EVPN type 3 dùng để làm gì?', 'Báo VTEP tham gia VNI để dựng danh sách gửi BUM', ['Mang MAC và IP máy', 'Quảng bá prefix IP', 'Bầu designated forwarder'], 'Type 3 là Inclusive Multicast Ethernet Tag.'),
    H('Route EVPN type 5 dùng để làm gì?', 'Quảng bá prefix IP (định tuyến lớp 3)', ['Báo VTEP tham gia VNI', 'Mang MAC máy', 'Đồng bộ ARP'], 'Dùng cho mạng ngoài và định tuyến giữa VRF.'),
    H('Anycast gateway trên mọi leaf giúp gì?', 'Mọi leaf cùng IP và MAC gateway, máy di chuyển không cần ARP lại', ['Giảm số VNI', 'Mã hoá dữ liệu', 'Bỏ được underlay'], 'Gateway luôn ở ngay leaf gần máy nhất.'),
  ],
  's32-sr-mpls': [
    H('Adjacency SID khác Node SID ở điểm nào?', 'Chỉ có nghĩa cục bộ, ép gói đi qua một link cụ thể', ['Giống nhau trên toàn mạng', 'Do LDP cấp', 'Chỉ dùng cho IPv6'], 'Node SID toàn cục, đi theo đường IGP ngắn nhất.'),
    H('TI-LFA đem lại gì?', 'Đường dự phòng tính sẵn, chuyển trong khoảng 50 ms với mọi topology', ['Mã hoá nhãn', 'Thay thế BGP', 'Tự cân tải theo băng thông'], 'Danh sách nhãn đẩy gói đi vòng qua chỗ hỏng.'),
  ],
  's33-multicast': [
    H('Máy đã gửi IGMP Join nhưng không nhận luồng; router báo RPF fail. Nguyên nhân?', 'Route unicast về nguồn đi qua cổng khác cổng đang nhận luồng', ['Thiếu IGMP snooping', 'TTL quá lớn', 'Sai địa chỉ nhóm'], 'Sửa route unicast hoặc thêm ip mroute tĩnh.'),
    H('Mặc định trên Cisco, router cuối chuyển từ cây chung sang cây nguồn khi nào?', 'Ngay khi nhận gói đầu tiên (threshold 0)', ['Sau 1 phút', 'Khi luồng vượt 1 Mbps', 'Không bao giờ'], 'Đổi bằng ip pim spt-threshold infinity.'),
  ],
  's34-l3vpn': [
    H('Route Target dùng để làm gì?', 'Quyết định VRF nào nhập route VPNv4', ['Phân biệt hai prefix trùng', 'Cấp nhãn ngoài', 'Chọn đường ngắn nhất'], 'RD làm prefix duy nhất; RT quyết định ai nhận.'),
    H('PE thấy route VPNv4 của khách nhưng ping không qua; P và PE không có LDP neighbor. Hậu quả?', 'Không có nhãn ngoài tới PE kia, LSP gãy nên gói bị bỏ', ['Đi bằng IP thường', 'Dùng nhãn trong thay thế', 'BGP tự sửa'], 'Router P không biết route khách nên không chuyển IP thường được.'),
    H('Xem bảng route của VRF KHACH-A trên PE bằng lệnh nào?', 'show ip route vrf KHACH-A', ['show ip route', 'show mpls forwarding-table', 'show ip bgp summary'], 'Bảng route toàn cục không có route khách.'),
  ],
  's35-lisp': [
    H('ITR chưa có ánh xạ cho EID đích thì làm gì?', 'Gửi Map-Request tới Map-Resolver, vài gói đầu có thể bị bỏ', ['Broadcast ARP', 'Gửi tới mọi ETR', 'Bỏ hẳn luồng'], 'Ánh xạ nhận về được cache theo TTL.'),
    H('Máy giữ IP và chuyển sang site khác. LISP cập nhật thế nào?', 'ETR mới gửi Map-Register, Map-Server cập nhật RLOC mới cho EID', ['Máy phải đổi IP', 'Router lõi học lại route', 'Không hỗ trợ di chuyển'], 'Đây là lợi ích chính của việc tách EID khỏi RLOC.'),
  ],
  's36-sd-access': [
    H('Máy mới cắm vào edge node. Ai gán SGT cho nó?', 'ISE sau khi xác thực 802.1X hoặc MAB', ['Edge tự chọn ngẫu nhiên', 'DHCP server', 'Control plane node'], 'SGT đi theo danh tính, không theo địa chỉ IP.'),
    H('Máy ở hai virtual network khác nhau muốn liên lạc phải đi qua đâu?', 'Ra ngoài fabric qua border và fusion router hoặc firewall', ['Trực tiếp trong fabric', 'Qua control plane node', 'Không bao giờ được'], 'VN là phân đoạn vĩ mô, tách bảng định tuyến.'),
  ],
  's37-sd-wan': [
    H('Edge không lên control connection, đồng hồ lệch 2 ngày. Vì sao?', 'Chứng chỉ bị coi là chưa hợp lệ theo giờ nên DTLS thất bại', ['Sai VPN 512', 'BFD chưa bật', 'Thiếu OMP route'], 'Cấu hình NTP trước khi onboard.'),
    H('AAR: đường MPLS mất gói 5%, SLA thoại cho phép 2%. Lưu lượng thoại sẽ?', 'Chuyển sang đường khác đạt SLA, ví dụ Internet', ['Ở lại MPLS', 'Bị bỏ', 'Chia đều hai đường'], 'BFD đo liên tục từng đường hầm.'),
    H('TLOC color mpls có "restrict" nghĩa là?', 'Chỉ dựng hầm tới TLOC cùng color mpls', ['Không dựng hầm nào', 'Chỉ dùng cho quản lý', 'Ưu tiên MPLS'], 'Dùng khi hai mạng truyền dẫn không thông nhau.'),
  ],
  's38-dmvpn': [
    H('Hub không thấy spoke nào trong "show ip nhrp". Kiểm tra gì trước?', 'NHS, ip nhrp map, network-id và tunnel key trên spoke khớp với hub', ['OSPF area', 'Native VLAN', 'ip helper-address'], 'Spoke phải đăng ký được với hub trước khi chạy định tuyến.'),
    H('DMVPN phase 2 với EIGRP cần gì trên hub?', 'no ip split-horizon eigrp và no ip next-hop-self eigrp', ['ip nhrp redirect', 'ip nhrp shortcut', 'tunnel mode gre ip'], 'Giữ next-hop là spoke để spoke đi thẳng tới nhau.'),
    H('Tunnel mGRE cấu hình bằng lệnh nào?', 'tunnel mode gre multipoint', ['tunnel mode gre ip', 'tunnel mode ipsec ipv4', 'tunnel mode mpls'], 'Một interface tunnel nói chuyện với nhiều đầu kia.'),
  ],
  's39-bfd': [
    H('Bật BFD cho OSPF trên interface Cisco cần gì?', 'bfd interval 50 min_rx 50 multiplier 3 và ip ospf bfd', ['Chỉ ip ospf hello-interval 1', 'router bfd', 'ip sla 1'], 'Hoặc gõ bfd all-interfaces trong router ospf.'),
    H('BFD echo mode hoạt động thế nào?', 'Gửi gói tới chính mình qua láng giềng, láng giềng chuyển lại bằng phần cứng', ['Gửi Hello tới multicast', 'Dùng ICMP Echo của máy', 'Hỏi qua SNMP'], 'Kiểm cả đường chuyển tiếp mà không tốn CPU bên kia.'),
  ],
  's40-voip-call': [
    H('Gọi được nhưng chỉ nghe một chiều khi điện thoại nằm sau NAT. Nguyên nhân hay gặp?', 'SDP mang IP private nên RTP gửi tới địa chỉ không tới được', ['Codec không khớp', 'SIP dùng TCP', 'Thiếu QoS'], 'Sửa bằng SIP ALG, SBC hoặc STUN.'),
    H('SIP trả "486 Busy Here" nghĩa là?', 'Máy bị gọi đang bận', ['Không tìm thấy máy', 'Sai mật khẩu', 'Cuộc gọi đã kết nối'], '404 là không tìm thấy, 401/407 là cần xác thực.'),
    H('Jitter buffer làm gì?', 'Giữ gói một chút để phát đều, đổi lại tăng độ trễ', ['Nén âm thanh', 'Mã hoá RTP', 'Chọn codec'], 'Buffer quá nhỏ gây rè, quá lớn gây trễ.'),
  ],
};
