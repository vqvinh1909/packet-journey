// scenarios/quizzes.js
// Bộ câu hỏi quiz theo từng kịch bản (id → mảng câu hỏi). Tách riêng để dễ bổ sung.
// Mỗi câu: { q, options:[...], correct: index, explainVi }

import { HARD } from './quizzes-hard.js';
import { QGEN, SC_GENS } from './quiz-gen.js';
import { getScenario } from './index.js';
import { BANK } from '../lab/ccna-exam.js';
import { GENS } from '../lab/ccna-gen.js';
import { ROADMAP } from '../lab/roadmap.js';

export const QUIZZES = {
  's01-ping-same-subnet': [
    { q: 'PC1 ping PC2 cùng mạng. Khung ARP Request có MAC đích là gì?', options: ['MAC của PC2', 'ff:ff:ff:ff:ff:ff (broadcast)', 'MAC của switch', '00:00:00:00:00:00'], correct: 1, explainVi: 'ARP Request gửi broadcast vì chưa biết MAC đích.' },
    { q: 'Switch làm gì khi nhận khung broadcast mà chưa biết cổng?', options: ['Drop', 'Gửi về nguồn', 'Flood ra mọi cổng khác', 'Hỏi router'], correct: 2, explainVi: 'Broadcast luôn được flood ra mọi cổng trừ cổng nhận.' },
    { q: 'ARP Reply được gửi kiểu gì?', options: ['Broadcast', 'Unicast về đúng người hỏi', 'Multicast', 'Không gửi'], correct: 1, explainVi: 'Reply biết MAC người hỏi nên gửi unicast.' },
    { q: 'Vì sao lần ping thứ hai nhanh hơn?', options: ['Switch tắt STP', 'Đã có sẵn trong ARP cache', 'TTL lớn hơn', 'Dùng UDP'], correct: 1, explainVi: 'ARP cache còn hạn nên khỏi ARP lại.' },
  ],
  's02-ping-across-router': [
    { q: 'PC1 ping máy khác mạng. Nó hỏi ARP cho IP nào?', options: ['IP đích cuối', 'IP default gateway', 'IP của switch', 'IP DNS'], correct: 1, explainVi: 'Khác mạng → cần MAC của gateway, không phải đích cuối.' },
    { q: 'Qua mỗi router, trường nào của gói GIỮ NGUYÊN?', options: ['MAC nguồn', 'MAC đích', 'IP nguồn/đích', 'TTL'], correct: 2, explainVi: 'IP không đổi suốt hành trình (trừ NAT); MAC và TTL đổi mỗi chặng.' },
    { q: 'Vì sao router phải tính lại Header Checksum?', options: ['Vì đổi IP đích', 'Vì giảm TTL', 'Vì đổi cổng', 'Vì thêm VLAN tag'], correct: 1, explainVi: 'TTL thay đổi làm header đổi → checksum phải tính lại.' },
    { q: 'Router chọn đường bằng cách nào?', options: ['Longest-prefix match', 'Ngẫu nhiên', 'Theo MAC', 'Theo cổng nguồn'], correct: 0, explainVi: 'Chọn tuyến có prefix khớp dài nhất (cụ thể nhất).' },
  ],
  's05-stp-root-election': [
    { q: 'Root Bridge được chọn theo tiêu chí nào trước tiên?', options: ['MAC thấp nhất', 'Bridge ID thấp nhất (Priority rồi MAC)', 'Số cổng', 'Tốc độ cao nhất'], correct: 1, explainVi: 'So Priority trước, hoà thì so MAC.' },
    { q: 'Cổng bị STP chặn ở trạng thái nào?', options: ['Forwarding', 'Learning', 'Blocking (Discarding)', 'Listening'], correct: 2, explainVi: 'Cổng non-designated bị Blocking để phá vòng lặp.' },
    { q: 'Trên đoạn giữa 2 switch non-root cùng cost, ai có Designated Port?', options: ['Switch Bridge ID lớn hơn', 'Switch Bridge ID nhỏ hơn', 'Cả hai', 'Không ai'], correct: 1, explainVi: 'Cost bằng nhau thì Bridge ID nhỏ hơn thắng → Designated.' },
  ],
  's07-ospf-adjacency': [
    { q: 'OSPF gửi Hello tới địa chỉ nào?', options: ['255.255.255.255', '224.0.0.5', '224.0.0.10', '224.0.0.2'], correct: 1, explainVi: 'AllSPFRouters = 224.0.0.5.' },
    { q: 'Priority bằng nhau thì DR chọn theo gì?', options: ['Router ID cao nhất', 'IP thấp nhất', 'MAC', 'Số cổng'], correct: 0, explainVi: 'Hoà Priority → Router ID cao nhất làm DR.' },
    { q: 'OSPF chạy trực tiếp trên gì?', options: ['TCP', 'UDP', 'IP (protocol 89)', 'Ethernet'], correct: 2, explainVi: 'OSPF là IP protocol 89, không dùng TCP/UDP.' },
  ],
  's09-dhcp-dora': [
    { q: 'Thứ tự đúng của DHCP?', options: ['Offer-Discover-Request-Ack', 'Discover-Offer-Request-Ack', 'Request-Ack-Discover-Offer', 'Discover-Request-Offer-Ack'], correct: 1, explainVi: 'DORA: Discover → Offer → Request → Ack.' },
    { q: 'Client gửi DISCOVER với IP nguồn là gì?', options: ['IP được cấp', '0.0.0.0', '127.0.0.1', 'IP gateway'], correct: 1, explainVi: 'Chưa có IP nên nguồn 0.0.0.0, đích 255.255.255.255.' },
    { q: 'DHCP dùng cổng UDP nào?', options: ['53/54', '67/68', '80/443', '546/547'], correct: 1, explainVi: 'Server 67, client 68.' },
    { q: 'Server ở mạng khác thì cần gì?', options: ['NAT', 'DHCP relay (ip helper-address)', 'VLAN', 'STP'], correct: 1, explainVi: 'Relay chuyển broadcast thành unicast tới server.' },
  ],
  's11-nat-pat': [
    { q: 'PAT phân biệt nhiều host chung 1 IP public bằng gì?', options: ['MAC', 'Số cổng', 'VLAN', 'TTL'], correct: 1, explainVi: 'PAT/overload dùng cổng để phân biệt từng phiên.' },
    { q: 'Chiều về, router tra NAT table bằng gì?', options: ['IP+cổng global (đích)', 'MAC nguồn', 'DNS', 'Số seq'], correct: 0, explainVi: 'Tra ngược (IP global + cổng) → ra IP local.' },
    { q: 'Vì sao UDP/TCP checksum phải tính lại khi NAT?', options: ['Vì đổi TTL', 'Vì checksum có pseudo-header (IP nguồn/đích)', 'Vì đổi MAC', 'Không cần tính lại'], correct: 1, explainVi: 'Checksum L4 phụ thuộc IP qua pseudo-header.' },
  ],
  's14-tcp-handshake': [
    { q: 'Thứ tự bắt tay TCP?', options: ['SYN → ACK → FIN', 'SYN → SYN-ACK → ACK', 'ACK → SYN → ACK', 'SYN → RST → ACK'], correct: 1, explainVi: '3 bước: SYN, SYN-ACK, ACK.' },
    { q: 'Trong SYN-ACK, ACK number bằng bao nhiêu nếu client ISN=1000?', options: ['1000', '1001', '5000', '0'], correct: 1, explainVi: 'ACK = ISN client + 1 = 1001 (SYN tốn 1 số).' },
    { q: 'MSS được trao đổi ở bản tin nào?', options: ['Chỉ trong SYN', 'Mọi gói', 'Chỉ FIN', 'Không bao giờ'], correct: 0, explainVi: 'MSS là option chỉ gửi trong SYN.' },
  ],
  's17-bgp-ebgp': [
    { q: 'BGP chạy trên gì?', options: ['UDP 520', 'TCP 179', 'IP 89', 'TCP 80'], correct: 1, explainVi: 'BGP dùng TCP cổng 179 (truyền tin cậy).' },
    { q: 'AS_PATH dùng để làm gì?', options: ['Mã hoá', 'Chọn đường & chống loop', 'Đánh dấu QoS', 'Cấp IP'], correct: 1, explainVi: 'Thấy AS mình trong AS_PATH → loại (chống loop); path ngắn hơn thường tốt hơn.' },
    { q: 'eBGP khác iBGP ở điểm nào?', options: ['Khác giao thức', 'Giữa 2 AS khác nhau (eBGP)', 'eBGP dùng UDP', 'iBGP không cần TCP'], correct: 1, explainVi: 'eBGP giữa các AS khác nhau; iBGP trong cùng AS.' },
  ],
  's19-rstp': [
    { q: 'Vai trò cổng MỚI của RSTP (so với STP) là gì?', options: ['Blocking', 'Alternate & Backup', 'Listening', 'Disabled'], correct: 1, explainVi: 'RSTP thêm Alternate (backup Root Port) và Backup (backup Designated).' },
    { q: 'Nhờ đâu RSTP chuyển Forwarding gần như tức thì?', options: ['Timer 30s', 'Proposal/Agreement trên link P2P', 'Flood BPDU', 'Tắt STP'], correct: 1, explainVi: 'Bắt tay Proposal/Agreement bỏ qua chờ timer.' },
  ],
  's22-wrong-gateway': [
    { q: 'Triệu chứng khi PC cấu hình sai default gateway?', options: ['Ping trong mạng cũng hỏng', 'Ping cùng mạng OK, khác mạng/Internet hỏng', 'Chỉ DNS hỏng', 'Không ảnh hưởng gì'], correct: 1, explainVi: 'Cùng mạng không cần gateway nên vẫn OK; ra ngoài mới hỏng.' },
    { q: 'Vì sao gói không ra được?', options: ['ARP cho gateway không ai trả lời (IP sai không có trên LAN)', 'TTL = 0', 'Checksum sai', 'Sai VLAN'], correct: 0, explainVi: 'Gateway sai → không host nào trả ARP → không có MAC để gửi.' },
  ],
  's23-vlan-mismatch': [
    { q: 'PC2 bị gán nhầm sang VLAN khác. Hậu quả?', options: ['Vẫn liên lạc bình thường', 'Khác broadcast domain → ARP không tới nhau', 'Chỉ chậm hơn', 'Mất IP'], correct: 1, explainVi: 'Khác VLAN = khác broadcast domain, ARP broadcast không vượt qua.' },
    { q: 'Cách khắc phục đúng?', options: ['Đổi IP', 'Gán đúng access VLAN cho cổng (hoặc inter-VLAN routing)', 'Tắt STP', 'Thêm NAT'], correct: 1, explainVi: 'Đưa cổng về đúng VLAN; nếu cần khác VLAN liên lạc thì phải định tuyến.' },
  ],
  's13-hsrp-failover': [
    { q: 'HSRP bầu router Active theo tiêu chí nào?', options: ['MAC thấp nhất', 'Priority cao hơn (hoà thì IP lớn hơn)', 'Ngẫu nhiên', 'Router mới bật'], correct: 1, explainVi: 'Priority cao thắng; bằng nhau thì IP lớn hơn.' },
    { q: 'MAC ảo của nhóm HSRP (group 1) là?', options: ['00:00:0c:07:ac:01', 'ff:ff:ff:ff:ff:ff', 'MAC thật của Active', '01:00:5e:00:00:02'], correct: 0, explainVi: '00:00:0c:07:ac:XX với XX = số group.' },
    { q: 'Active chết thì host phải làm gì?', options: ['Đổi gateway thủ công', 'Không cần làm gì — Standby tiếp quản IP/MAC ảo', 'Khởi động lại', 'Đổi IP'], correct: 1, explainVi: 'Failover trong suốt: host vẫn dùng IP+MAC ảo cũ.' },
    { q: 'HSRP chạy trên?', options: ['TCP 179', 'UDP 1985, multicast 224.0.0.2', 'IP 89', 'UDP 67'], correct: 1, explainVi: 'HSRPv1: UDP 1985 tới 224.0.0.2.' },
  ],
  's15-traceroute': [
    { q: 'Router làm TTL về 0 sẽ gửi gì về nguồn?', options: ['Echo Reply', 'ICMP Time Exceeded (Type 11)', 'ARP', 'RST'], correct: 1, explainVi: 'TTL=0 → drop + ICMP Type 11, lộ ra chặng đó.' },
    { q: 'Làm sao traceroute lộ từng chặng?', options: ['Gửi broadcast', 'Tăng dần TTL = 1, 2, 3…', 'Đổi IP đích', 'Dùng DNS'], correct: 1, explainVi: 'Mỗi giá trị TTL chết ở một router xa dần.' },
    { q: 'Khi tới ĐÍCH, nguồn nhận gì (thay vì Time Exceeded)?', options: ['Time Exceeded', 'Echo Reply (hoặc Port Unreachable với probe UDP)', 'Không gì cả', 'ARP Reply'], correct: 1, explainVi: 'Nhận phản hồi từ đích = đã tới nơi → dừng.' },
  ],
  's16-fragmentation': [
    { q: 'Các mảnh của cùng một gói được nhận biết nhờ trường nào?', options: ['TTL', 'Identification (giống nhau)', 'Checksum', 'Source Port'], correct: 1, explainVi: 'Cùng ID + cùng (src,dst,proto).' },
    { q: 'Fragment Offset tính theo đơn vị?', options: ['1 byte', '8 byte', '4 byte', 'bit'], correct: 1, explainVi: 'Offset đơn vị 8 byte.' },
    { q: 'Gói đặt DF=1 mà lớn hơn MTU?', options: ['Vẫn cắt mảnh', 'Bị drop + ICMP Fragmentation Needed (PMTUD)', 'Tự nhỏ lại', 'Đổi sang UDP'], correct: 1, explainVi: 'DF cấm cắt → drop + báo MTU về nguồn.' },
    { q: 'Ai ghép các mảnh lại?', options: ['Mỗi router dọc đường', 'Chỉ ĐÍCH cuối cùng', 'Switch', 'Nguồn'], correct: 1, explainVi: 'Chỉ đích reassembly; router không ghép.' },
  ],
  's18-ospf-multiarea': [
    { q: 'ABR là router thế nào?', options: ['Chỉ 1 area', 'Có chân ở ≥2 area, một trong đó là Area 0', 'Chạy BGP', 'Không có IP'], correct: 1, explainVi: 'Area Border Router nối các vùng với backbone.' },
    { q: 'LSA nào quảng bá mạng LIÊN VÙNG?', options: ['Type 1 Router', 'Type 2 Network', 'Type 3 Summary', 'Type 5 External'], correct: 2, explainVi: 'ABR sinh Type 3 Summary giữa các area.' },
    { q: 'Vùng xương sống (backbone) là?', options: ['Area 1', 'Area 0 (0.0.0.0)', 'Area 255', 'Mọi area'], correct: 1, explainVi: 'Mọi area phải nối tới Area 0.' },
  ],
  's20-qos-dscp': [
    { q: 'DSCP EF (cho thoại) có giá trị?', options: ['0', '46', '34', '24'], correct: 1, explainVi: 'EF = 46 (Expedited Forwarding).' },
    { q: 'Khi WAN nghẽn, gói thoại được xếp vào?', options: ['Hàng thường', 'Priority Queue (LLQ)', 'Bị drop', 'WRED'], correct: 1, explainVi: 'LLQ phục vụ thoại trước, trễ thấp.' },
    { q: 'Trường DSCP nằm ở đâu?', options: ['Ethernet', '6 bit đầu byte ToS trong IP header', 'TCP header', 'FCS'], correct: 1, explainVi: 'DSCP = 6 bit cao của byte ToS/Traffic Class.' },
  ],
  's21-redistribution': [
    { q: 'Router bơm route giữa 2 giao thức định tuyến gọi là?', options: ['ABR', 'ASBR (boundary)', 'DR', 'Successor'], correct: 1, explainVi: 'ASBR chạy nhiều giao thức và redistribute.' },
    { q: 'Bơm route OSPF → EIGRP cần gì?', options: ['Không cần gì', 'Seed metric (default-metric)', 'Tắt OSPF', 'NAT'], correct: 1, explainVi: 'Không có metric EIGRP → route bị bỏ.' },
    { q: 'Tránh loop khi redistribute hai chiều nhiều điểm?', options: ['Tắt một giao thức', 'Dùng route-tag + chỉnh Administrative Distance', 'Thêm VLAN', 'Giảm TTL'], correct: 1, explainVi: 'Gắn tag để lọc + chỉnh AD ưu tiên nguồn đúng.' },
  ],
  's24-mst': [
    { q: '3 thứ phải GIỐNG nhau để switch cùng một MST region?', options: ['IP, MAC, VLAN', 'Region name, Revision, Config digest (bảng VLAN→instance)', 'Priority, Cost, Port', 'Tên host'], correct: 1, explainVi: 'Sai một thứ là rơi ra region khác.' },
    { q: 'MSTI (instance) dùng để?', options: ['Mã hoá', 'Gom nhiều VLAN vào một cây, mỗi instance root riêng → cân tải', 'Chặn broadcast', 'Cấp IP'], correct: 1, explainVi: 'Ít cây hơn PVST + cân tải VLAN.' },
    { q: 'MST tương thích/ kế thừa cơ chế hội tụ của?', options: ['STP cũ (802.1D)', 'RSTP (802.1w)', 'HSRP', 'LACP'], correct: 1, explainVi: 'MST hội tụ nhanh như RSTP.' },
  ],
  's25-qos-advanced': [
    { q: 'CoS (802.1p) được đánh dấu ở đâu?', options: ['IP header', 'Trường PCP trong nhãn 802.1Q (tầng 2)', 'TCP header', 'MAC'], correct: 1, explainVi: 'CoS = PCP, chỉ tồn tại khi có VLAN tag.' },
    { q: 'Policing khác Shaping thế nào?', options: ['Giống hệt', 'Policing drop/hạ DSCP ngay; Shaping đệm rồi phát đều (thêm trễ)', 'Shaping drop ngay', 'Policing thêm trễ'], correct: 1, explainVi: 'Shaping mượt hơn nhưng trễ; policing không đệm.' },
    { q: 'WRED giúp gì?', options: ['Tăng tốc độ', 'Rớt sớm vài gói TCP để tránh "đồng loạt dừng" (global sync)', 'Mã hoá', 'Đổi DSCP'], correct: 1, explainVi: 'Chủ động rớt trước khi hàng đợi đầy.' },
  ],
  's26-ipv6-ndp': [
    { q: 'IPv6 phân giải địa chỉ → MAC bằng?', options: ['ARP', 'NDP (ICMPv6 NS/NA)', 'DNS', 'DHCP'], correct: 1, explainVi: 'IPv6 bỏ ARP, dùng NDP type 135/136.' },
    { q: 'Header IPv6 có trường checksum không?', options: ['Có', 'KHÔNG (nhưng ICMPv6 thì bắt buộc có)', 'Có, 32-bit', 'Tuỳ chọn'], correct: 1, explainVi: 'IPv6 bỏ checksum header cho nhanh.' },
    { q: 'Neighbor Solicitation gửi tới địa chỉ nào?', options: ['Broadcast', 'Solicited-node multicast (ff02::1:ffXX:XXXX)', 'ff02::5', 'Unicast đích'], correct: 1, explainVi: 'Đỡ ồn hơn broadcast ARP.' },
    { q: 'Hop Limit của gói NDP thường là?', options: ['1', '64', '255', '128'], correct: 2, explainVi: 'NDP dùng 255 để chống giả mạo từ xa.' },
  ],
  's27-ospfv3': [
    { q: 'OSPFv3 Hello dùng địa chỉ nguồn loại nào?', options: ['Global IPv6', 'Link-local (fe80::)', 'IPv4', 'Loopback'], correct: 1, explainVi: 'Next-hop/giao tiếp OSPFv3 dựa link-local.' },
    { q: 'OSPFv3 chạy trên?', options: ['TCP 179', 'IPv6 (Next Header 89), đích ff02::5', 'UDP 1985', 'IPv4 89'], correct: 1, explainVi: 'OSPFv3 là OSPF cho IPv6.' },
    { q: 'So với v2, OSPFv3 bỏ trường nào trong header?', options: ['Checksum', 'Authentication (dựa vào IPsec)', 'Router ID', 'Area ID'], correct: 1, explainVi: 'Bảo mật chuyển sang IPsec của IPv6.' },
    { q: 'Router ID trong OSPFv3 là?', options: ['Địa chỉ IPv6 128-bit', 'Vẫn là số 32-bit (dạng IPv4)', 'MAC', 'Số ngẫu nhiên'], correct: 1, explainVi: 'Router ID giữ nguyên dạng 32-bit.' },
  ],
  's03-vlan-segmentation': [
    { q: 'VLAN tách thiết bị thành các gì?', options: ['Miền xung đột', 'Miền quảng bá (broadcast domain) riêng', 'Subnet IP', 'Collision domain'], correct: 1, explainVi: 'Mỗi VLAN là một broadcast domain.' },
    { q: 'Hai PC khác VLAN trên cùng switch ping nhau được không?', options: ['Được, luôn luôn', 'Không, cần router/inter-VLAN routing', 'Được nếu cùng IP', 'Chỉ khi tắt STP'], correct: 1, explainVi: 'Khác VLAN = khác broadcast domain, cần L3.' },
    { q: 'Broadcast (vd ARP) lan tới đâu?', options: ['Mọi cổng switch', 'Chỉ các cổng cùng VLAN', 'Qua router', 'Toàn mạng'], correct: 1, explainVi: 'Switch chỉ flood trong cùng VLAN.' },
  ],
  's04-trunk-dot1q': [
    { q: 'Trunk 802.1Q thêm gì vào khung?', options: ['Header IP', 'Nhãn 4 byte chứa VLAN ID', 'Checksum', 'MAC thứ 2'], correct: 1, explainVi: 'Tag 802.1Q mang VID để phân biệt VLAN trên trunk.' },
    { q: 'Native VLAN đi qua trunk thế nào?', options: ['Gắn tag', 'KHÔNG gắn tag', 'Bị drop', 'Đổi VID'], correct: 1, explainVi: 'Native VLAN mặc định không tag.' },
    { q: 'Tag VLAN được gỡ ở đâu?', options: ['Giữa trunk', 'Tại cổng access ra host', 'Ở router', 'Không bao giờ'], correct: 1, explainVi: 'Access port gỡ tag trước khi giao host.' },
  ],
  's06-inter-vlan-routing': [
    { q: 'Router-on-a-stick dùng gì để định tuyến nhiều VLAN?', options: ['Nhiều router', 'Sub-interface trên 1 trunk', 'Switch L2', 'NAT'], correct: 1, explainVi: 'Mỗi VLAN một sub-interface làm gateway.' },
    { q: 'Khi gói qua router giữa 2 VLAN, cái gì đổi?', options: ['IP nguồn/đích', 'Tag VLAN + MAC, TTL−1', 'Không gì', 'Cổng nguồn'], correct: 1, explainVi: 'Đổi VID + viết lại MAC, giảm TTL; IP giữ nguyên.' },
    { q: 'Muốn 2 VLAN liên lạc cần thiết bị gì?', options: ['Hub', 'Thiết bị L3 (router hoặc switch L3)', 'Repeater', 'Modem'], correct: 1, explainVi: 'Liên VLAN là định tuyến tầng 3.' },
  ],
  's08-eigrp-dual': [
    { q: 'Successor trong EIGRP là?', options: ['Đường backup', 'Đường tốt nhất (FD nhỏ nhất), nạp vào bảng định tuyến', 'Láng giềng', 'Root'], correct: 1, explainVi: 'Successor = next-hop tốt nhất.' },
    { q: 'Feasible Successor là?', options: ['Đường chính', 'Backup thoả Feasibility Condition (RD < FD)', 'Đường bị loop', 'Successor thứ 2 bất kỳ'], correct: 1, explainVi: 'FS là backup không gây loop, chuyển sang được ngay.' },
    { q: 'Mất Successor mà CÓ Feasible Successor thì?', options: ['Gửi Query đi hỏi', 'Chuyển sang FS tức thì', 'Mạng sập', 'Chờ 180s'], correct: 1, explainVi: 'Có FS → hội tụ cực nhanh, không cần Query.' },
    { q: 'EIGRP chạy trên?', options: ['TCP 179', 'IP protocol 88, multicast 224.0.0.10', 'UDP 520', 'IP 89'], correct: 1, explainVi: 'EIGRP là IP proto 88.' },
  ],
  's10-dns-resolution': [
    { q: 'Resolver đệ quy hỏi theo thứ tự nào?', options: ['Authoritative → TLD → Root', 'Root → TLD (.com) → Authoritative', 'Ngẫu nhiên', 'Chỉ hỏi root'], correct: 1, explainVi: 'Đi từ root xuống dần tới authoritative.' },
    { q: 'Cờ RD = 1 nghĩa là?', options: ['Response', 'Recursion Desired — nhờ resolver hỏi hộ tới kết quả', 'Reverse DNS', 'Random'], correct: 1, explainVi: 'Client nhờ resolver làm đệ quy.' },
    { q: 'Kết quả DNS được cache trong bao lâu?', options: ['Vĩnh viễn', 'Theo TTL của bản ghi', '1 giây', 'Không cache'], correct: 1, explainVi: 'TTL quyết định thời gian giữ cache.' },
    { q: 'DNS thường dùng cổng?', options: ['80', 'UDP/TCP 53', '67', '179'], correct: 1, explainVi: 'Cổng 53 (UDP chính, TCP khi bản ghi lớn).' },
  ],
  's12-acl-filter': [
    { q: 'Router duyệt ACL thế nào?', options: ['Duyệt hết rồi chọn', 'First-match: dừng ở dòng khớp ĐẦU TIÊN', 'Ngẫu nhiên', 'Từ dưới lên'], correct: 1, explainVi: 'Khớp dòng nào thì thực thi dòng đó và dừng.' },
    { q: 'Cuối mọi ACL luôn (ngầm) có?', options: ['permit any', 'deny any (implicit deny)', 'log', 'nat'], correct: 1, explainVi: 'Không khớp gì = bị chặn bởi implicit deny.' },
    { q: 'Extended ACL nên đặt ở đâu?', options: ['Gần đích', 'Gần nguồn (để chặn sớm)', 'Trên mọi cổng', 'Không quan trọng'], correct: 1, explainVi: 'Extended lọc được nguồn+đích+port → đặt gần nguồn; Standard đặt gần đích.' },
  ],
  's28-slaac-dhcpv6': [
    { q: 'Cái gì trong RA quyết định host dùng SLAAC hay DHCPv6?', options: ['TTL', 'Cờ M (Managed) và O (Other)', 'Prefix length', 'MAC'], correct: 1, explainVi: 'M=1 → DHCPv6 lấy địa chỉ; A=1,M=0 → SLAAC.' },
    { q: 'Trong SLAAC, host lấy prefix từ đâu?', options: ['DHCP server', 'Router Advertisement', 'DNS', 'ARP'], correct: 1, explainVi: 'RA mang Prefix Information; host tự ghép prefix + Interface ID.' },
    { q: 'DAD (dò trùng địa chỉ) dùng bản tin gì?', options: ['DHCP Discover', 'Neighbor Solicitation tới địa chỉ tentative', 'ARP Request', 'Echo'], correct: 1, explainVi: 'NS với nguồn :: gửi tới địa chỉ dự kiến; có ai trả lời là trùng.' },
    { q: 'DHCPv6 dùng cổng UDP nào?', options: ['67/68', '546/547', '53', '389'], correct: 1, explainVi: 'Client 546, server 547 (IPv4 là 67/68).' },
    { q: 'Thứ tự bản tin DHCPv6 (tương tự DORA)?', options: ['Discover/Offer/Request/Ack', 'Solicit/Advertise/Request/Reply', 'RS/RA/NS/NA', 'Open/Update'], correct: 1, explainVi: 'Solicit↔Discover, Advertise↔Offer, Request↔Request, Reply↔Ack.' },
  ],
  's29-mpls': [
    { q: 'Router P trong lõi MPLS chuyển tiếp dựa vào?', options: ['Longest-prefix match trên IP', 'Tra LFIB theo nhãn (swap nhãn)', 'MAC', 'Cổng nguồn'], correct: 1, explainVi: 'MPLS chuyển theo NHÃN, không tra IP.' },
    { q: '3 thao tác nhãn cơ bản là?', options: ['Add/Del/Edit', 'Push (gắn) / Swap (đổi) / Pop (gỡ)', 'In/Out/Drop', 'Set/Get/Clear'], correct: 1, explainVi: 'Ingress push, core swap, egress pop.' },
    { q: 'Bit S (Bottom of Stack) = 1 nghĩa là?', options: ['Còn nhãn nữa', 'Đây là nhãn ĐÁY, sau nó là payload (IP)', 'Gói lỗi', 'TTL hết'], correct: 1, explainVi: 'S=1 đánh dấu nhãn cuối của stack.' },
    { q: 'Khung Ethernet mang MPLS dùng EtherType?', options: ['0x0800', '0x8847', '0x8100', '0x86dd'], correct: 1, explainVi: '0x8847 cho MPLS unicast.' },
  ],
  's30-vxlan': [
    { q: 'VXLAN đóng gói cái gì vào bên trong?', options: ['Chỉ IP', 'NGUYÊN khung Ethernet gốc (L2)', 'Chỉ TCP', 'Chỉ MAC'], correct: 1, explainVi: 'VXLAN là L2-trên-L3: bọc cả khung Ethernet.' },
    { q: 'VXLAN chạy trên cổng UDP đích nào?', options: ['67', '4789', '179', '53'], correct: 1, explainVi: 'UDP 4789 (IANA).' },
    { q: 'VNI 24-bit cho phép bao nhiêu mạng ảo?', options: ['4094', '~16 triệu', '256', '65535'], correct: 1, explainVi: 'Vượt xa giới hạn 4094 VLAN.' },
    { q: 'Thiết bị đóng/gỡ gói VXLAN gọi là?', options: ['Router', 'VTEP', 'Switch L2', 'Gateway'], correct: 1, explainVi: 'VTEP = VXLAN Tunnel End Point.' },
  ],
  's31-evpn': [
    { q: 'EVPN thay đổi phần nào của VXLAN?', options: ['Mặt phẳng dữ liệu, bỏ UDP 4789', 'Mặt phẳng điều khiển: học MAC qua BGP thay vì flood', 'Độ dài VNI', 'Khung Ethernet gốc'], correct: 1, explainVi: 'Dữ liệu vẫn là VXLAN, EVPN chỉ đổi cách VTEP biết MAC ở đâu.' },
    { q: 'Route EVPN nào mang MAC và IP của host?', options: ['Type 1', 'Type 2', 'Type 3', 'Type 5'], correct: 1, explainVi: 'Type 2 là MAC/IP Advertisement.' },
    { q: 'ARP suppression hoạt động thế nào?', options: ['VTEP chặn mọi ARP và máy không liên lạc được', 'VTEP tự trả lời ARP từ thông tin EVPN đã học', 'Spine trả lời ARP', 'Host không dùng ARP nữa'], correct: 1, explainVi: 'VTEP có cặp IP và MAC từ route type 2 nên trả lời thay, broadcast không vào fabric.' },
    { q: 'Vì sao dùng Spine làm route reflector?', options: ['Để đóng gói VXLAN', 'Tránh full-mesh iBGP giữa mọi VTEP', 'Để tăng VNI', 'Để bỏ underlay'], correct: 1, explainVi: 'VTEP chỉ cần phiên iBGP với route reflector. Next hop vẫn là VTEP gốc.' },
  ],
  's32-sr-mpls': [
    { q: 'Trong SR-MPLS, ai quyết định đường đi của gói?', options: ['Mọi router P', 'Router đầu vào, ghi đường đi thành chồng nhãn', 'Router cuối', 'Máy khách'], correct: 1, explainVi: 'Đó là source routing, lõi không giữ trạng thái theo luồng.' },
    { q: 'Node SID được quảng bá bằng gì?', options: ['LDP', 'Phần mở rộng của IS-IS hoặc OSPF', 'DHCP', 'STP'], correct: 1, explainVi: 'SR không cần LDP hay RSVP-TE, IGP mang luôn SID.' },
    { q: 'Vì sao nhãn node SID giữ nguyên qua từng chặng?', options: ['Mọi router dùng chung dải SRGB', 'Router lỗi', 'Không có LFIB', 'TTL bằng 0'], correct: 0, explainVi: 'Dùng chung SRGB thì SID 4 luôn là nhãn 16004 trên toàn miền.' },
    { q: 'Penultimate Hop Popping nghĩa là?', options: ['Chặng áp chót gỡ nhãn của segment', 'Chặng đầu gỡ mọi nhãn', 'Xoá gói', 'Thêm nhãn mới'], correct: 0, explainVi: 'Router cuối segment đỡ phải tra hai lần.' },
  ],
  's33-multicast': [
    { q: 'Vì sao cần RPF check trong multicast?', options: ['Để mã hoá luồng', 'Để chống lặp: chỉ nhận gói từ cổng dùng để đi về nguồn', 'Để chọn RP', 'Để tăng TTL'], correct: 1, explainVi: 'Gói vào sai cổng so với đường unicast về nguồn thì bị bỏ.' },
    { q: 'IGMP chạy ở đâu?', options: ['Giữa các router lõi', 'Giữa máy nhận và router cuối', 'Giữa RP và nguồn', 'Giữa hai switch'], correct: 1, explainVi: 'Giữa các router dùng PIM.' },
    { q: 'Router đầu tiên gửi gì tới RP khi nguồn bắt đầu phát?', options: ['PIM Register unicast', 'IGMP Report', 'PIM Hello', 'Prune'], correct: 0, explainVi: 'Register bọc gói multicast trong gói unicast.' },
    { q: 'SSM cần gì ở máy nhận?', options: ['IGMPv1', 'IGMPv2', 'IGMPv3 để nêu nguồn', 'Biết địa chỉ RP'], correct: 2, explainVi: 'IGMPv3 có danh sách nguồn, nên không cần RP.' },
    { q: 'MSDP dùng để làm gì?', options: ['Chia sẻ thông tin nguồn giữa các RP ở các miền', 'Mã hoá multicast', 'Thay IGMP', 'Tạo VLAN'], correct: 0, explainVi: 'Mỗi miền giữ RP riêng và dùng MSDP để biết nguồn của miền khác.' },
  ],
  's34-l3vpn': [
    { q: 'Nhãn ngoài trong L3VPN do ai cấp?', options: ['MP-BGP', 'LDP', 'OSPF', 'CE'], correct: 1, explainVi: 'Nhãn ngoài đưa gói tới PE đích. Nhãn trong do MP-BGP cấp để vào đúng VRF.' },
    { q: 'Vai trò của Route Distinguisher?', options: ['Quyết định VRF nào nhập route', 'Làm prefix trùng nhau thành khác nhau trong VPNv4', 'Mã hoá gói', 'Chọn next hop'], correct: 1, explainVi: 'RT mới quyết định việc nhập route.' },
    { q: 'Vì sao router P không cần bảng route khách hàng?', options: ['P chỉ chuyển theo nhãn ngoài', 'P dùng NAT', 'P chạy VRF', 'P học qua CE'], correct: 0, explainVi: 'Đây là lợi ích chính khi đặt BGP ở biên.' },
    { q: 'Sau PHP, gói L3VPN tới PE đích còn gì?', options: ['Không còn nhãn', 'Nhãn VPN', 'Hai nhãn', 'Nhãn LDP mới'], correct: 1, explainVi: 'P chỉ gỡ nhãn vận chuyển. PE dùng nhãn VPN để chọn VRF.' },
  ],
  's35-lisp': [
    { q: 'EID và RLOC khác nhau thế nào?', options: ['EID là danh tính của máy, RLOC là vị trí trong underlay', 'Hai tên của cùng một địa chỉ', 'EID là MAC, RLOC là VLAN', 'EID chỉ dùng cho IPv6'], correct: 0, explainVi: 'LISP tách hai vai trò mà địa chỉ IP thường gộp làm một.' },
    { q: 'ETR đăng ký EID bằng bản tin nào?', options: ['Map-Request', 'Map-Reply', 'Map-Register', 'Join'], correct: 2, explainVi: 'Map-Register gửi tới Map-Server, UDP 4342.' },
    { q: 'Dữ liệu LISP dùng cổng nào?', options: ['UDP 4341', 'UDP 4789', 'TCP 179', 'UDP 3784'], correct: 0, explainVi: 'UDP 4342 dành cho điều khiển, UDP 4789 là VXLAN.' },
    { q: 'Router lõi có cần biết mạng EID không?', options: ['Có, mọi EID', 'Không, chỉ cần RLOC', 'Chỉ khi dùng NAT', 'Chỉ với IPv6'], correct: 1, explainVi: 'Bảng định tuyến lõi nhỏ đi nhờ vậy.' },
  ],
  's36-sd-access': [
    { q: 'Mặt phẳng điều khiển trong SD-Access là gì?', options: ['LISP', 'BGP EVPN', 'OMP', 'STP'], correct: 0, explainVi: 'Control plane node là LISP Map-Server.' },
    { q: 'SGT nằm ở đâu khi gói qua fabric?', options: ['Trong header VXLAN-GPO', 'Trong TTL', 'Trong MAC', 'Trong DNS'], correct: 0, explainVi: 'Group Policy ID nằm trong header VXLAN.' },
    { q: 'SGACL thường thực thi ở đâu?', options: ['Edge nguồn', 'Edge đích', 'Catalyst Center', 'ISE'], correct: 1, explainVi: 'Tại đó biết được nhóm của cả nguồn và đích.' },
    { q: 'Phân đoạn vi mô khác phân đoạn vĩ mô thế nào?', options: ['Vi mô tách nhóm trong cùng VN, vĩ mô tách VN', 'Vi mô dùng VLAN, vĩ mô dùng STP', 'Không khác nhau', 'Vi mô chỉ dùng cho Wi-Fi'], correct: 0, explainVi: 'SGT là vi mô. VN, tương ứng VRF, là vĩ mô.' },
  ],
  's37-sd-wan': [
    { q: 'vSmart làm nhiệm vụ gì?', options: ['Mặt phẳng điều khiển, phát OMP và chính sách', 'Chuyển dữ liệu người dùng', 'Xác thực ban đầu và NAT traversal', 'Chỉ lưu log'], correct: 0, explainVi: 'vBond điều phối, vManage quản lý, WAN Edge chuyển dữ liệu.' },
    { q: 'TLOC gồm những gì?', options: ['System IP, màu, đóng gói', 'MAC và VLAN', 'SGT và VNI', 'RD và RT'], correct: 0, explainVi: 'TLOC định danh một đầu đường hầm.' },
    { q: 'SD-WAN dùng gì để đo chất lượng đường?', options: ['BFD trong đường hầm', 'STP', 'ARP', 'SNMP trap'], correct: 0, explainVi: 'Kết quả dùng cho Application-Aware Routing.' },
    { q: 'Mất vSmart thì dữ liệu sao?', options: ['Dừng ngay', 'Vẫn chạy một thời gian nhờ graceful restart', 'Đổi sang STP', 'Đổi sang NAT'], correct: 1, explainVi: 'vSmart không nằm trên đường dữ liệu.' },
  ],
  's38-dmvpn': [
    { q: 'NHRP trong DMVPN làm gì?', options: ['Ánh xạ địa chỉ tunnel sang địa chỉ NBMA', 'Mã hoá gói', 'Chọn root bridge', 'Cấp DHCP'], correct: 0, explainVi: 'Nó giống ARP cho mạng đa truy cập không broadcast.' },
    { q: 'Lệnh nào trên hub tạo Traffic Indication?', options: ['ip nhrp redirect', 'ip nhrp shortcut', 'tunnel mode gre', 'ip nhrp map'], correct: 0, explainVi: 'Spoke dùng shortcut để cài route.' },
    { q: 'Phase 3 hơn phase 2 ở chỗ nào?', options: ['Hub tóm tắt route được mà spoke vẫn nói chuyện trực tiếp', 'Không cần GRE', 'Không cần NHRP', 'Chỉ có hub-and-spoke'], correct: 0, explainVi: 'Phase 2 buộc next hop giữ nguyên nên không tóm tắt được.' },
    { q: 'GRE Protocol Type của NHRP là?', options: ['0x0800', '0x2001', '0x8847', '0x86DD'], correct: 1, explainVi: '0x0800 là IPv4 bên trong.' },
  ],
  's39-bfd': [
    { q: 'Thời gian phát hiện với interval 50 ms, multiplier 3 là?', options: ['50 ms', '150 ms', '3 giây', '40 giây'], correct: 1, explainVi: '3 × 50 ms.' },
    { q: 'BFD có tự tìm láng giềng không?', options: ['Có, bằng multicast', 'Không, giao thức khách báo cho nó', 'Có, qua DNS', 'Có, qua CDP'], correct: 1, explainVi: 'OSPF, EIGRP, BGP đăng ký với BFD.' },
    { q: 'Vì sao BFD có ích khi có switch giữa hai router?', options: ['Cổng của router vẫn up khi đoạn kia đứt', 'Switch chặn OSPF', 'Router không có MAC', 'Để giảm TTL'], correct: 0, explainVi: 'Không có tín hiệu lớp 1 để báo.' },
    { q: 'BFD điều khiển một chặng dùng cổng nào?', options: ['UDP 3784', 'TCP 179', 'UDP 4789', 'IP 89'], correct: 0, explainVi: 'BFD đa chặng dùng UDP 4784.' },
  ],
  's40-voip-call': [
    { q: 'Trong cuộc gọi có tổng đài SIP proxy, âm thanh RTP thường đi thế nào?', options: ['Thẳng giữa hai điện thoại', 'Luôn qua tổng đài', 'Qua switch STP root', 'Trong bản tin SIP'], correct: 0, explainVi: 'SDP cho mỗi bên biết IP và cổng của bên kia. Tổng đài chỉ xử lý báo hiệu, trừ khi được cấu hình để giữ media.' },
    { q: 'Phần nào cho biết IP, cổng nhận RTP và codec?', options: ['SDP', 'Header Via', 'RTCP', 'CSeq'], correct: 0, explainVi: 'Dòng c= chứa IP, dòng m= chứa cổng và payload type.' },
    { q: 'Thứ tự bắt tay một cuộc gọi SIP là?', options: ['INVITE, 200 OK, ACK', 'SYN, SYN-ACK, ACK', 'Discover, Offer, Ack', 'REGISTER, BYE, ACK'], correct: 0, explainVi: '100 Trying và 180 Ringing là các bản tin tạm thời xen giữa.' },
    { q: 'Băng thông IP mỗi chiều của G.711 với gói 20 ms là?', options: ['64 kbps', '80 kbps', '8 kbps', '24 kbps'], correct: 1, explainVi: '(160 + 40 byte) × 8 × 50 gói = 80 kbps. 24 kbps là của G.729.' },
    { q: 'Vì sao RTP chạy trên UDP?', options: ['Gói đến muộn không còn giá trị, gửi lại chỉ thêm trễ', 'UDP mã hoá âm thanh', 'TCP không có cổng', 'UDP chọn codec'], correct: 0, explainVi: 'Số thứ tự và timestamp của RTP giúp phát hiện mất gói và phát đều.' },
  ],
  's41-arp-spoofing': [
    { q: 'Vì sao ARP spoofing làm được?', options: ['ARP không xác thực người gửi', 'Switch không có bảng MAC', 'IP nguồn bị mã hoá', 'Gateway tắt ICMP'], correct: 0, explainVi: 'Máy nhận tin mọi ARP Reply, kể cả khi không hỏi.' },
    { q: 'Sau khi bị đầu độc, khung PC gửi ra Internet có gì sai?', options: ['IP đích', 'MAC đích', 'TTL', 'Checksum'], correct: 1, explainVi: 'IP đích vẫn đúng. MAC đích là MAC của kẻ tấn công vì PC tra ARP cache sai.' },
    { q: 'DAI dựa vào bảng nào để kiểm gói ARP?', options: ['Bảng định tuyến', 'Bảng NAT', 'DHCP snooping binding', 'Bảng STP'], correct: 2, explainVi: 'DAI so IP–MAC trong gói ARP với binding do DHCP snooping ghi lại.' },
    { q: 'Dấu hiệu ARP spoofing khi xem `arp -a` trên PC?', options: ['Không có dòng nào', 'Gateway và một máy khác có cùng MAC', 'MAC toàn ff', 'IP gateway đổi'], correct: 1, explainVi: 'Hai IP khác nhau cùng trỏ về một MAC là dấu hiệu điển hình.' },
  ],
  's42-dhcp-rogue': [
    { q: 'DHCP server giả cấp thông số nào để nghe lén?', options: ['Subnet mask sai', 'Default gateway và DNS là chính nó', 'Lease time ngắn', 'IP trùng'], correct: 1, explainVi: 'Gateway giả cho nghe lén gói; DNS giả cho dẫn tới trang giả.' },
    { q: 'Client thường nhận OFFER nào?', options: ['OFFER đến trước', 'OFFER có IP lớn nhất', 'OFFER của server có MAC nhỏ nhất', 'OFFER cuối cùng'], correct: 0, explainVi: 'Client không kiểm được server thật hay giả, nên nhận OFFER đầu tiên.' },
    { q: 'Trên cổng untrusted, DHCP snooping loại gói nào?', options: ['DISCOVER', 'REQUEST', 'OFFER và ACK', 'Mọi gói UDP'], correct: 2, explainVi: 'Gói của server chỉ được đi vào từ cổng trusted.' },
    { q: 'Cổng nào nên đặt `ip dhcp snooping trust`?', options: ['Mọi cổng người dùng', 'Cổng nối tới DHCP server thật hoặc uplink', 'Cổng đang shutdown', 'Không cổng nào'], correct: 1, explainVi: 'Chỉ hướng có DHCP server hợp lệ mới được tin.' },
  ],
  's43-mac-flooding': [
    { q: 'Khi bảng MAC đầy, switch xử lý khung unicast có MAC đích chưa biết thế nào?', options: ['Loại', 'Flood ra mọi cổng trong VLAN', 'Gửi về root bridge', 'Gửi ICMP báo lỗi'], correct: 1, explainVi: 'Unknown unicast được flood giống broadcast.' },
    { q: 'Mục tiêu của MAC flooding là gì?', options: ['Đổi root bridge', 'Nghe lén lưu lượng của máy khác', 'Chiếm IP gateway', 'Tắt trunk'], correct: 1, explainVi: 'Switch flood khung nên cổng của kẻ tấn công cũng nhận bản sao.' },
    { q: 'Tính năng nào giới hạn số MAC trên một cổng?', options: ['Port security', 'PortFast', 'UDLD', 'LACP'], correct: 0, explainVi: '`switchport port-security maximum N`.' },
    { q: 'Với violation shutdown, cổng vi phạm vào trạng thái nào?', options: ['blocking', 'err-disabled', 'listening', 'trunking'], correct: 1, explainVi: 'Cổng bị err-disabled, cần `shutdown` rồi `no shutdown` hoặc errdisable recovery.' },
  ],
  's44-syn-flood': [
    { q: 'SYN flood làm cạn tài nguyên nào của server?', options: ['Dung lượng đĩa', 'Hàng đợi kết nối nửa mở', 'Bảng ARP', 'Bảng định tuyến'], correct: 1, explainVi: 'Mỗi SYN chiếm một dòng nửa mở chờ ACK.' },
    { q: 'Vì sao kẻ tấn công giả IP nguồn?', options: ['Để nhận SYN-ACK nhanh hơn', 'Để khó truy vết và không phải xử lý SYN-ACK', 'Để vượt NAT', 'Để tăng MSS'], correct: 1, explainVi: 'SYN-ACK đi tới IP giả; kẻ tấn công không cần trả lời.' },
    { q: 'SYN cookies hoạt động thế nào?', options: ['Chặn SYN theo quốc gia', 'Không lưu trạng thái cho tới khi ACK hợp lệ quay về', 'Mã hoá payload', 'Tăng thời gian chờ SYN'], correct: 1, explainVi: 'Thông tin kết nối được mã hoá vào số thứ tự của SYN-ACK.' },
    { q: 'Biện pháp nào của nhà mạng chặn gói giả IP nguồn?', options: ['uRPF / BCP 38', 'PortFast', 'HSRP', 'DHCP relay'], correct: 0, explainVi: 'uRPF loại gói có IP nguồn không thể đến từ cổng đó.' },
  ],
  's45-dns-spoofing': [
    { q: 'Client so những gì để chấp nhận một câu trả lời DNS thường?', options: ['Chữ ký số', 'Transaction ID, cổng và IP nguồn', 'MAC nguồn', 'TTL của IP'], correct: 1, explainVi: 'DNS thường không có xác thực mật mã.' },
    { q: 'Vì sao kẻ tấn công đặt TTL bản ghi giả rất dài?', options: ['Để gói đi xa hơn', 'Để bản ghi giả nằm lâu trong cache', 'Để vượt firewall', 'Để tránh phân mảnh'], correct: 1, explainVi: 'TTL của bản ghi DNS là thời gian lưu cache.' },
    { q: 'Cơ chế nào kiểm chữ ký số của bản ghi DNS?', options: ['DNSSEC', 'DHCP snooping', 'NAT', 'SNMPv3'], correct: 0, explainVi: 'DNSSEC cho resolver kiểm tra bản ghi có đúng do chủ tên miền ký.' },
    { q: 'Điều gì giúp người dùng phát hiện trang giả dù DNS đã bị giả?', options: ['Tốc độ tải trang', 'Cảnh báo chứng chỉ HTTPS', 'Biểu tượng Wi-Fi', 'Số hop traceroute'], correct: 1, explainVi: 'Trang giả không có khoá riêng của chứng chỉ thật.' },
  ],
  's46-vlan-hopping': [
    { q: 'Điều kiện để double tagging thành công?', options: ['Kẻ tấn công ở VLAN trùng native VLAN của trunk', 'Kẻ tấn công có quyền admin switch', 'Trunk dùng ISL', 'STP bị tắt'], correct: 0, explainVi: 'Nhãn ngoài phải là native VLAN để SW1 gỡ mà không thêm nhãn mới.' },
    { q: 'Switch đầu tiên làm gì với khung hai nhãn?', options: ['Gỡ nhãn ngoài, giữ nhãn trong', 'Gỡ cả hai', 'Loại khung', 'Đổi nhãn trong'], correct: 0, explainVi: 'Khung native VLAN đi lên trunk không nhãn, nên nhãn trong lộ ra.' },
    { q: 'Double tagging có nhận được gói trả lời không?', options: ['Có', 'Không, chỉ đi một chiều', 'Có nếu dùng TCP', 'Có nếu cùng subnet'], correct: 1, explainVi: 'Chiều về không có nhãn kép nên ở lại VLAN đích.' },
    { q: 'Lệnh nào chặn switch spoofing qua DTP trên cổng người dùng?', options: ['switchport nonegotiate', 'spanning-tree bpduguard enable', 'ip dhcp snooping', 'storm-control broadcast'], correct: 0, explainVi: 'Đặt `switchport mode access` và `switchport nonegotiate` để cổng không tự thành trunk.' },
  ],
  's47-tls-handshake': [
    { q: 'Trong TLS 1.3, phần nào của bắt tay đi dạng rõ?', options: ['ClientHello và ServerHello', 'Chứng chỉ của server', 'Finished', 'Dữ liệu HTTP'], correct: 0, explainVi: 'Hai gói Hello phải đi rõ để trao khoá. Từ sau ServerHello mọi thứ đều mã hoá.' },
    { q: 'Vì sao firewall lọc được trang HTTPS theo tên miền mà không giải mã?', options: ['Đọc cookie', 'Đọc SNI trong ClientHello', 'Đọc đường dẫn URL', 'Đọc chứng chỉ đã mã hoá'], correct: 1, explainVi: 'SNI nằm trong ClientHello dạng rõ.' },
    { q: 'Forward secrecy nghĩa là gì?', options: ['Khoá riêng của server lộ sau này cũng không giải mã được phiên cũ', 'Chứng chỉ không bao giờ hết hạn', 'Client không cần kiểm chứng chỉ', 'Dữ liệu được nén trước khi mã hoá'], correct: 0, explainVi: 'Khoá phiên sinh từ khoá Diffie-Hellman tạm, dùng xong là bỏ.' },
    { q: 'Điều gì ngăn kẻ tấn công dùng bản sao chứng chỉ thật?', options: ['Chứng chỉ được giữ bí mật', 'Nó không có khoá riêng để ký CertificateVerify', 'Chứng chỉ gắn với địa chỉ MAC', 'TLS kiểm địa chỉ IP'], correct: 1, explainVi: 'Chứng chỉ là công khai. Chỉ chủ thật mới có khoá riêng tương ứng.' },
  ],
  's48-ipsec-ikev2': [
    { q: 'IKEv2 cần mấy bản tin để dựng xong đường hầm đầu tiên?', options: ['2', '4', '6', '9'], correct: 1, explainVi: 'Hai gói IKE_SA_INIT và hai gói IKE_AUTH.' },
    { q: 'IKE dùng cổng nào khi không có NAT?', options: ['TCP 443', 'UDP 500', 'UDP 1812', 'TCP 179'], correct: 1, explainVi: 'UDP 500. Có NAT thì chuyển sang UDP 4500 (NAT-T).' },
    { q: 'Hai đầu không có bộ thuật toán nào chung thì lỗi gì?', options: ['NO_PROPOSAL_CHOSEN', 'AUTHENTICATION_FAILED', 'TS_UNACCEPTABLE', 'TTL exceeded'], correct: 0, explainVi: 'Lỗi xảy ra ngay ở IKE_SA_INIT.' },
    { q: 'Trong ESP tunnel mode, IP nào hiện ra trên Internet?', options: ['IP nội bộ của hai PC', 'IP công khai của hai router', 'IP loopback', 'Không có IP'], correct: 1, explainVi: 'Gói IP gốc nằm trong phần đã mã hoá.' },
  ],
  's49-dot1x-radius': [
    { q: 'Trong 802.1X, switch đóng vai gì?', options: ['Supplicant', 'Authenticator', 'Authentication server', 'Certificate authority'], correct: 1, explainVi: 'Switch chuyển tiếp EAP giữa máy trạm và RADIUS, rồi mở hoặc đóng cổng.' },
    { q: 'Trước khi xác thực xong, cổng cho loại khung nào đi qua?', options: ['Mọi khung', 'Chỉ EAPOL', 'Chỉ DHCP', 'Chỉ ARP'], correct: 1, explainVi: 'Cổng Unauthorized chỉ nhận EAPOL (EtherType 0x888e).' },
    { q: 'RADIUS gán VLAN cho người dùng bằng cách nào?', options: ['Gửi lệnh CLI tới switch', 'Thuộc tính Tunnel-Private-Group-ID trong Access-Accept', 'Qua DHCP option', 'Qua VTP'], correct: 1, explainVi: 'Kèm Tunnel-Type = VLAN và Tunnel-Medium-Type = 802.' },
    { q: 'Máy in không có supplicant thì dùng cách nào?', options: ['MAB: dùng địa chỉ MAC làm danh tính', 'PEAP', 'EAP-TLS', 'Không thể vào mạng'], correct: 0, explainVi: 'MAC Authentication Bypass yếu hơn vì MAC giả được, nên thường gán vào VLAN hạn chế.' },
  ],
};

export function quizFor(id) {
  return QUIZZES[id] || null;
}

for (const [id, qs] of Object.entries(HARD)) QUIZZES[id] = [...(QUIZZES[id] || []), ...qs];

/** Số câu mỗi lần làm quiz; Lộ trình tính đạt khi đúng từ 60% số này. */
export const QUIZ_LEN = 40;

// nhóm của Lộ trình CCNA → mảng của ngân hàng Thi thử và các dạng câu sinh cùng mảng
const CCNA_STAGES = { infra: 'infra', switching: 'sw', routing: 'rt', services: 'svc' };
const DOMAIN_GENS = { infra: ['broadcast', 'hosts', 'validHost', 'dhcp'], rt: ['wildcard', 'summary', 'lpm', 'ad'], svc: ['acl', 'wildcard'], sw: [] };
const DOMAIN_QGEN = { infra: ['tcpAck', 'frag', 'solicited'], sw: ['stpRoot'], rt: ['eigrpFs', 'hsrpMac'], svc: ['natPat', 'dnsTtl'] };
const fullId = (short) => Object.keys(QUIZZES).find((k) => k.startsWith(short));
const stageOf = (short) => ROADMAP.find((st) => st.topics.some((t) => (t.sc || []).includes(short)));
const ccnaShorts = new Set(ROADMAP.filter((st) => CCNA_STAGES[st.id]).flatMap((st) => st.topics.flatMap((t) => t.sc || [])));
const titleOf = (id) => getScenario(id)?.meta.titleVi || id;

function shuffle(a, rnd) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
/** Sinh tối đa n biến thể khác nhau của một dạng câu (bỏ biến thể trùng chữ). */
function variants(gen, n, rnd) {
  const out = new Map();
  for (let t = 0; t < n * 6 && out.size < n; t++) { const q = gen(rnd); if (q) out.set(q.q, q); }
  return [...out.values()];
}
const fromGen = (g) => g && { q: g.text, options: g.opts, correct: g.ans, explainVi: g.explain };

/**
 * Một lượt quiz QUIZ_LEN câu: câu của kịch bản và câu sinh với số liệu mới, rồi câu của các kịch bản cùng nhóm Lộ trình,
 * câu cùng mảng trong ngân hàng Thi thử. Câu chưa có trong `seen` được lấy trước nên các lượt liên tiếp ít trùng nhau.
 * Thứ tự câu và đáp án đều được trộn. Mỗi câu có `from`: tên nguồn khi không phải câu của chính kịch bản này.
 */
export function buildQuiz(id, rnd = Math.random, n = QUIZ_LEN, seen = new Set()) {
  if (!QUIZZES[id]) return null;
  const short = id.slice(0, 3), stage = stageOf(short), dom = CCNA_STAGES[stage?.id];
  const own = [...QUIZZES[id], ...(SC_GENS[short] || []).flatMap((g) => variants(QGEN[g], 3, rnd))];
  // CCNA: kịch bản cùng nhóm; ngoài CCNA: mọi kịch bản CCNP với nhau
  const peers = Object.keys(QUIZZES).filter((k) => k !== id && (dom ? stageOf(k.slice(0, 3)) === stage : !ccnaShorts.has(k.slice(0, 3))));
  const extra = [
    ...peers.flatMap((k) => QUIZZES[k].map((q) => ({ ...q, from: `Cùng nhóm: ${titleOf(k)}` }))),
    ...(dom ? BANK.filter((b) => b[0] === dom && Array.isArray(b[2]) && Number.isInteger(b[3])).map(([, q, options, correct, explainVi]) => ({ q, options, correct, explainVi, from: 'Ngân hàng thi thử' })) : []),
  ];
  const fresh = (q) => !seen.has(q.q);
  // câu của chính kịch bản luôn có; phần còn lại ưu tiên câu chưa gặp
  const first = [...shuffle(own, rnd), ...shuffle(extra, rnd).filter(fresh)];
  // chưa đủ thì bù bằng câu sinh cùng mảng (số liệu mới nên luôn là câu mới), mỗi dạng tối đa 6 câu cho khỏi lệch đề
  const gens = dom ? [...DOMAIN_GENS[dom].map((g) => (r) => fromGen(GENS[g](r))), ...DOMAIN_QGEN[dom].map((g) => QGEN[g])] : [];
  const made = new Set(first.map((q) => q.q)), cap = gens.length * 6;
  for (let t = 0, k = 0; gens.length && first.length < n && k < cap && t < n * 30; t++) {
    const q = gens[t % gens.length](rnd);
    if (q && !made.has(q.q)) { made.add(q.q); k++; first.push({ ...q, from: 'Câu sinh tự động' }); }
  }
  const picked = [...first, ...shuffle(extra, rnd).filter((q) => !fresh(q))].slice(0, n);
  return shuffle(picked, rnd).map((q) => {
    const o = shuffle(q.options.map((t, i) => ({ t, ok: i === q.correct })), rnd);
    return { ...q, options: o.map((x) => x.t), correct: o.findIndex((x) => x.ok) };
  });
}
