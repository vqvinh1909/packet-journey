// i18n/glossary.js — từ điển thuật ngữ + bảng tra nhanh (port, OSI↔TCP/IP).

export const GLOSSARY = [
  { term: 'Encapsulation / Decapsulation', en: 'đóng gói / bóc tách', def: 'Mỗi tầng thêm header (đôi khi trailer) khi gửi (encapsulation); bên nhận bóc ngược từng tầng (decapsulation).' },
  { term: 'PDU', en: 'Protocol Data Unit', def: 'Tên đơn vị dữ liệu mỗi tầng: tầng 2 = Frame, tầng 3 = Packet, tầng 4 = Segment (TCP)/Datagram (UDP).' },
  { term: 'MAC address', en: 'địa chỉ vật lý 48-bit', def: 'Địa chỉ tầng 2, chỉ có ý nghĩa trong một đoạn mạng; bị viết lại ở mỗi chặng router.' },
  { term: 'ARP', en: 'Address Resolution Protocol', def: 'Phân giải IP → MAC trong cùng mạng. Request gửi broadcast, Reply gửi unicast (RFC 826).' },
  { term: 'Broadcast domain', en: 'miền quảng bá', def: 'Phạm vi một gói broadcast lan tới. Một VLAN = một broadcast domain; router chặn broadcast.' },
  { term: 'Collision domain', en: 'miền xung đột', def: 'Phạm vi có thể xảy ra đụng độ khung. Mỗi cổng switch là một collision domain riêng.' },
  { term: 'VLAN', en: 'Virtual LAN', def: 'Chia switch thành nhiều mạng logic (broadcast domain) độc lập, dù chung thiết bị vật lý.' },
  { term: 'Trunk / 802.1Q', en: 'đường trunk / nhãn VLAN', def: 'Link chở nhiều VLAN, mỗi khung gắn nhãn 4 byte (VID). Native VLAN đi qua trunk không gắn tag.' },
  { term: 'STP / Root Bridge', en: 'Spanning Tree', def: 'Chống vòng lặp L2 bằng cách chặn cổng dư. Root = bridge có Bridge ID (Priority+MAC) nhỏ nhất.' },
  { term: 'RSTP', en: 'Rapid STP (802.1w)', def: 'STP nhanh (<1s) nhờ Proposal/Agreement; thêm vai trò Alternate/Backup; trạng thái Discarding/Learning/Forwarding.' },
  { term: 'Longest-prefix match', en: 'khớp prefix dài nhất', def: 'Router chọn tuyến có prefix khớp DÀI nhất (cụ thể nhất) với IP đích.' },
  { term: 'TTL', en: 'Time To Live', def: 'Giảm 1 mỗi router; về 0 thì gói bị bỏ và router gửi ICMP Time Exceeded (dùng cho traceroute).' },
  { term: 'Checksum', en: 'tổng kiểm tra', def: 'Phát hiện lỗi bit. IPv4 chỉ checksum header; ICMP/UDP/TCP checksum cả header+data (UDP/TCP có pseudo-header).' },
  { term: 'OSPF / DR-BDR / LSA', en: 'Open Shortest Path First', def: 'IGP link-state (IP 89, 224.0.0.5). Bầu DR/BDR trên mạng multi-access; trao LSA dựng LSDB; chạy SPF (Dijkstra).' },
  { term: 'EIGRP / DUAL', en: 'Enhanced IGRP', def: 'IGP của Cisco (IP 88). DUAL chọn Successor (đường tốt nhất) + Feasible Successor (backup thoả điều kiện khả thi).' },
  { term: 'BGP / AS_PATH', en: 'Border Gateway Protocol', def: 'Định tuyến giữa các AS (TCP 179). AS_PATH là chuỗi AS đã qua, dùng chọn đường và chống loop.' },
  { term: 'DHCP DORA', en: 'cấp IP động', def: 'Discover → Offer → Request → Ack (UDP 67/68). Cấp IP, mask, gateway, DNS, lease.' },
  { term: 'DNS', en: 'Domain Name System', def: 'Phân giải tên → IP (UDP 53). Resolver hỏi đệ quy root → TLD → authoritative; cache theo TTL.' },
  { term: 'NAT / PAT', en: 'dịch địa chỉ', def: 'Đổi IP private ↔ public. PAT (overload) dùng cổng để nhiều host chung 1 IP public.' },
  { term: 'ACL', en: 'Access Control List', def: 'Lọc gói theo luật, duyệt first-match; cuối luôn có implicit deny any. Standard (chỉ nguồn) đặt gần đích; Extended đặt gần nguồn.' },
  { term: 'HSRP / FHRP', en: 'gateway dự phòng', def: 'Nhiều router chung 1 IP+MAC ảo làm gateway. Active nhận gói; Active chết thì Standby tiếp quản (trong suốt với host).' },
  { term: 'MTU / Fragmentation', en: 'phân mảnh', def: 'Gói lớn hơn MTU bị cắt mảnh (cùng ID, cờ MF, Fragment Offset đơn vị 8 byte). DF=1 thì bị drop + ICMP Frag Needed (PMTUD).' },
  { term: 'DSCP / QoS', en: 'chất lượng dịch vụ', def: '6 bit đầu byte ToS trong IP header đánh dấu ưu tiên (EF=46 cho thoại). Router xếp hàng ưu tiên (LLQ) khi nghẽn.' },
  { term: 'TCP 3-way handshake', en: 'bắt tay 3 bước', def: 'SYN → SYN-ACK → ACK thiết lập kết nối, đồng bộ seq/ack; đóng bằng FIN (4 bước).' },
  { term: 'Redistribution', en: 'bơm route liên giao thức', def: 'ASBR bơm route giữa 2 giao thức (vd OSPF↔EIGRP). Cần seed metric; cẩn thận loop (route-tag, administrative distance).' },
];

// Bảng tra nhanh: cổng phổ biến
export const PORTS = [
  { port: '20/21', proto: 'TCP', name: 'FTP (data/control)' },
  { port: '22', proto: 'TCP', name: 'SSH' },
  { port: '23', proto: 'TCP', name: 'Telnet' },
  { port: '25', proto: 'TCP', name: 'SMTP' },
  { port: '53', proto: 'UDP/TCP', name: 'DNS' },
  { port: '67/68', proto: 'UDP', name: 'DHCP (server/client)' },
  { port: '69', proto: 'UDP', name: 'TFTP' },
  { port: '80', proto: 'TCP', name: 'HTTP' },
  { port: '123', proto: 'UDP', name: 'NTP' },
  { port: '161/162', proto: 'UDP', name: 'SNMP' },
  { port: '179', proto: 'TCP', name: 'BGP' },
  { port: '443', proto: 'TCP', name: 'HTTPS' },
  { port: '514', proto: 'UDP', name: 'Syslog' },
  { port: '1985', proto: 'UDP', name: 'HSRP' },
];

// Bảng tra nhanh: OSI ↔ TCP/IP
export const OSI_MAP = [
  { osi: '7 Application / 6 Presentation / 5 Session', tcpip: 'Application', ex: 'HTTP, DNS, DHCP, TLS' },
  { osi: '4 Transport', tcpip: 'Transport', ex: 'TCP, UDP' },
  { osi: '3 Network', tcpip: 'Internet', ex: 'IP, ICMP, OSPF' },
  { osi: '2 Data Link / 1 Physical', tcpip: 'Network Access', ex: 'Ethernet, ARP, VLAN' },
];
