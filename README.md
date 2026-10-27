# Packet Journey — Hành trình gói tin qua từng tầng

Web app học mạng chạy hoàn toàn trong trình duyệt (không backend), mô phỏng **chuyên
sâu** một gói tin đi qua từng tầng OSI/TCP-IP và từng thiết bị — kiểu "Wireshark +
mô phỏng + giáo trình". Gói tin được dựng thành **byte thật**, checksum **tính thật**,
và **xuất được `.pcap`** để mở bằng Wireshark đối chiếu.

> Trạng thái: **Mốc M1** — nền tảng dựng gói (Ethernet/ARP/IPv4/ICMP) + 2 kịch bản
> ping + giao diện học cốt lõi. Các mốc sau (UDP/TCP/DNS/DHCP, VLAN/NAT/ACL,
> chế độ đoán/quiz, PWA offline, tự tạo kịch bản) xem phần [Lộ trình](#lộ-trình).

## Chạy app

App dùng **đường dẫn tương đối** và chạy dưới server HTTP ở gốc `E:\SAP`:

```bash
# tại thư mục E:\SAP — dùng serve.py (ép charset=utf-8 để mở bài học .md/.html không lỗi tiếng Việt)
python serve.py 8000
```

Rồi mở: `http://127.0.0.1:8000/M%E1%BA%A1ng%20m%C3%A1y%20t%C3%ADnh/Packet-Journey/`

Hoặc bấm đúp **`Mở-Packet-Journey.bat`** (tự bật server và mở đúng URL).

> Vì sao cần `serve.py` thay cho `python -m http.server`? http.server trả file `.md`/`.html` không
> kèm `charset=utf-8`, trình duyệt đọc nhầm bảng mã → tiếng Việt vỡ ("BÃ i 2"). `serve.py` khai báo
> UTF-8 nên hết lỗi. Link "📖 Đọc thêm" trong app trỏ sang **file HTML giáo trình đã build**
> (`Infrastructure-Administrator-Giao-trinh.html#bNN-s0`) để render đẹp.

> Vì sao cần server mà không mở thẳng `index.html`? App dùng ES modules (`import`),
> trình duyệt chặn `import` khi mở bằng `file://`. Server HTTP là bắt buộc.

## Chạy test

Logic dựng gói / checksum / pcap / engine có unit test bằng Node (không cần cài gì thêm):

```bash
# tại thư mục Packet-Journey
node --test
```

Test kiểm: checksum so với ví dụ đã biết, độ dài & offset header, byte nguyên văn một
gói ARP/ICMP mẫu, cấu trúc file `.pcap`, longest-prefix match, và tính bất biến của
kịch bản (TTL giảm qua router, IP src/dst giữ nguyên).

## Kiểm chứng bằng Wireshark (quan trọng nhất)

1. Mở app, chọn kịch bản, bấm **Xuất .pcap**.
2. Mở file `.pcap` bằng Wireshark.
3. Đúng khi: Wireshark parse ra đủ các trường (Ethernet/ARP/IPv4/ICMP) và **không
   báo checksum sai** (IPv4 header checksum, ICMP checksum đều "correct").

## Giao diện một màn hình

- **Topology** (trên): thiết bị + dây; gói chạy animation; bảng ARP/MAC/routing đổi theo bước.
- **Timeline** (giữa): ⏮ ◀ ▶/⏸ ▶▌ ⏭, tốc độ, thanh trượt, danh sách bước. Phím tắt: `←` `→` `Space`.
- **Ngăn xếp tầng** (trái): tầng đang xử lý sáng lên, kèm nhãn Đóng gói/Bóc tách/Chuyển tiếp.
- **Chi tiết gói** (phải), 3 tab:
  - **Cây trường** kiểu Wireshark (trường vừa đổi được tô màu cam).
  - **Hex/Binary**: rê chuột vào trường → sáng đúng byte; rê vào byte → biết nó thuộc trường nào.
  - **Giải thích**: "chuyện gì đang xảy ra và vì sao", kèm link 📖 Đọc thêm sang bài học.
- **🎯 Quiz** (nút trên thanh tiêu đề): câu hỏi cuối bài, chấm điểm + lưu kỷ lục. **Cả 30 kịch bản đều có quiz** (100 câu, ở `scenarios/quizzes.js`).
- **🤔 Đoán bước** (bật/tắt): dừng trước quyết định quan trọng, bạn chọn đáp án rồi app mới lộ giải thích.
- **🔧 Thử thách sửa lỗi**: s22/s23 cố tình cấu hình sai, bạn đoán triệu chứng/nguyên nhân rồi xem gói chứng minh.
- **📘 Từ điển**: ~25 thuật ngữ (có tìm kiếm) + bảng tra nhanh cổng phổ biến & OSI↔TCP/IP.
- **💾 Tiến độ**: đánh dấu kịch bản đã xem + điểm quiz, và nút xuất/nhập tiến độ (.json).
- **PWA offline**: có `manifest.webmanifest` + `sw.js` (service worker) → cài được như app và chạy offline sau lần mở online đầu (trên Chrome/Edge thật).
- **🧪 Lab CLI (Cisco IOS)** — 27 lab bám giáo trình *Infrastructure Administrator*: gõ lệnh như trên router/switch thật (viết tắt `sh ip int br`, `conf t`, Tab hoàn thành, `?` trợ giúp, lỗi `% Invalid input ... '^' marker`, mật khẩu enable, `| include/section`...). Mạng được **tính thật** từ cấu hình bạn gõ: VLAN/trunk/native/EtherChannel/STP root, bảng định tuyến connected + static (floating) + **OSPF/EIGRP tự hội tụ**, ACL (thứ tự dòng, deny ngầm định), NAT/PAT/NAT tĩnh, HSRP, DHCP + relay, DHCP snooping, port-security, SSH/Telnet, NTP. Nhiệm vụ **tự chấm** sau mỗi lệnh bằng ping/telnet/`show` thật; ping/traceroute/DHCP có nút **▶ Xem gói tin** mở timeline byte-thật ở màn hình chính.
  - Lab cấu hình theo bài: IPv4/subnet (B05), switch cơ bản + SSH (B07), VLAN (B08), trunk + native 999 (B09), EtherChannel + root bridge (B10), router (B11), router-on-a-stick (B12), static + floating static (B13), OSPF + default-information originate (B14), EIGRP (B15), ACL standard/extended (B16–17), NTP/Syslog (B18), DHCP + relay (B19), PAT + NAT tĩnh (B20), HSRP (B21), port-security + DHCP snooping (B26).
  - 🎫 6 **ticket sự cố** dựng sẵn lỗi (3 ticket lấy nguyên từ Lab tổng hợp CCNA 04/05/06 + 3 ticket thêm), 🏢 dự án **GreenMart** (VLAN → ROAS → OSPF → default → DHCP → NAT → ACL).
  - Tiến độ + cấu hình đã gõ được lưu, mở lại vẫn còn; có gợi ý từng bước và lời giải mẫu (chạy thử được ngay trong console).
- **🛠️ Tự tạo (Builder)**: nhập IP/mask/gateway cho PC1–PC2 (± router) → app tự dựng & chạy mô phỏng ping, đúng cho 3 trường hợp: cùng mạng, khác mạng (gateway đúng), và sai gateway (ping hỏng).
- **✏️ Vẽ mạng (Canvas)**: kéo-thả thêm PC/Switch/Router, nối dây, cấu hình IP/gateway từng thiết bị, rồi chọn 2 PC bấm "Chạy ping" → app tìm đường (BFS) và mô phỏng gói tin trên topology BẤT KỲ bạn vẽ (ARP, định tuyến qua router, TTL−1), báo lỗi rõ nếu sai gateway/không nối dây/khác subnet.

## Thêm một kịch bản mới

1. Tạo `scenarios/sNN-ten.js`, export `meta` và `build()`:

```js
import { Sim } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

export const meta = { id: 'sNN-ten', titleVi: '...', descriptionVi: '...', difficulty: 2 };

export function build() {
  const sim = new Sim({ devices: [...], links: [...] });
  const f = sim.frame(echoFrame({ /* ... */ }));
  sim.capture(f, 'nhãn cho Wireshark');
  sim.emit({ kind: 'transit', fromDevice: 'a', toDevice: 'b', activeLayer: 3, packet: f,
             titleVi: '...', explanationVi: '...' });
  return sim.result();
}
```

2. Thêm vào `scenarios/index.js`. Xong — app tự hiện trong danh sách chọn.

Xem `HƯỚNG-DẪN-TẠO-APP.md` để hiểu từng file và các quyết định thiết kế.

## Cấu trúc thư mục

```
packet/     addr, bytes (BitWriter), checksum (RFC 1071), serialize, pcap
protocols/  ethernet, dot1q, arp, ipv4, icmp, llc, stp, ospf, eigrp, udp, dhcp, dns,
            tcp, hsrp, bgp, raw, ipv6, icmpv6, ospfv3, mstp, dhcpv6, mpls, vxlan   (23 giao thức)
engine/     tables (ARP/MAC/routing + longest-prefix), devices, simulate (recorder)
lab/        net (máy mô phỏng mạng tính từ cấu hình), ios (CLI Cisco IOS + PC), labs (27 lab + chấm điểm)
scenarios/  s01..s08 (xem danh sách dưới)
ui/         topology, controls, layerstack, fieldtree, hexview, explain, i18n, store, app
i18n/       vi, en  (chuỗi giao diện)
tests/      *.test.js  (node --test)
styles/     theme (biến màu, sáng/tối), app (bố cục)
```

### Danh sách kịch bản hiện có
- **s01** Ping cùng mạng · **s02** Ping khác mạng qua router
- **s03** VLAN chia miền quảng bá · **s04** Trunk 802.1Q · **s05** STP bầu Root
- **s06** Inter-VLAN (router-on-a-stick) · **s07** OSPF (Hello/DR-BDR) · **s08** EIGRP (DUAL)
- **s09** DHCP DORA · **s10** DNS đệ quy · **s11** NAT/PAT · **s12** ACL (first-match)
- **s13** HSRP failover · **s14** TCP 3-way handshake · **s15** Traceroute (TTL/Time Exceeded)
- **s16** Phân mảnh IPv4 · **s17** BGP (eBGP OPEN/UPDATE) · **s18** OSPF multi-area (ABR/LSA)
- **s19** RSTP (hội tụ nhanh) · **s20** QoS/DSCP · **s21** Redistribution OSPF↔EIGRP
- **s22** 🔧 Sửa lỗi: sai gateway · **s23** 🔧 Sửa lỗi: sai VLAN cổng access
- **s24** MST (region/instance, cân tải) · **s25** QoS nâng cao (DSCP/CoS, PHB, LLQ/WRED)
- **s26** IPv6 + NDP (thay ARP) · **s27** OSPFv3 (OSPF cho IPv6)
- **s28** SLAAC & DHCPv6 (tự cấu hình địa chỉ IPv6: RS/RA, DAD, Solicit/Advertise/Request/Reply)
- **s29** MPLS (push/swap/pop nhãn) · **s30** VXLAN overlay (L2 trên L3, VNI)

## Đơn giản hóa (so với thực tế)

- Ethernet **không đính FCS** (Wireshark/pcap mặc định cũng không chứa FCS).
- IPv4 **không dùng Options** (IHL luôn = 5 → header 20 byte).
- Kịch bản 2: ARP giữa router↔router và router→PC2 được **nạp sẵn** để tập trung vào
  routing; chỉ mô phỏng đầy đủ ARP cho gateway ở PC1.
- Chưa mô phỏng STP timer, độ trễ dây, hàng đợi. TTL mặc định dùng 64 (Linux); Windows thường 128.

## Lộ trình

Theo lộ trình CCNA → CCNP:
- **M1 (xong)**: Ethernet/ARP/IPv4/ICMP, checksum, pcap, 2 kịch bản ping, UI cốt lõi, test.
- **CCNA Switching (xong)**: VLAN (s03), trunk 802.1Q (s04), STP (s05) — thêm protocol 802.3/LLC/STP.
- **CCNA/CCNP Routing (xong)**: inter-VLAN (s06), OSPF (s07), EIGRP/DUAL (s08) — thêm protocol OSPF/EIGRP.
- **CCNA Services (xong)**: DHCP (s09), DNS (s10), NAT/PAT (s11), ACL (s12), HSRP (s13), TCP 3-way (s14), traceroute (s15), fragmentation (s16) — thêm protocol UDP/DHCP/DNS/TCP/HSRP/raw.
- **CCNP (xong)**: BGP eBGP (s17), OSPF multi-area/LSA (s18), RSTP (s19), QoS/DSCP (s20), redistribution (s21).
- **Học chủ động (xong)**: 🎯 quiz chấm điểm, 🤔 đoán bước tiếp theo, 🔧 thử thách sửa lỗi (s22/s23), 📘 từ điển, 💾 lưu/khôi phục tiến độ, PWA offline.
- **M5 (xong)**: 🛠️ Builder (nhập tham số) + ✏️ Canvas kéo-thả vẽ mạng bất kỳ rồi chạy mô phỏng.
- **Chuyên sâu (xong)**: MST (s24), QoS nâng cao (s25), IPv6+NDP (s26), OSPFv3 (s27), SLAAC & DHCPv6 (s28), MPLS (s29), VXLAN (s30) — thêm protocol ipv6/icmpv6/ospfv3/mstp/dhcpv6/mpls/vxlan + checksum pseudo-header IPv6.
- Đã phủ TRỌN spec gốc M1–M5 + học chủ động (quiz đủ 30/30 bài) + chuyên sâu CCNP/SP/DC. Mọi nhánh tùy chọn đã làm.
- **Chế độ học chủ động**: "đoán bước", quiz, thử thách sửa lỗi, từ điển, PWA offline, lưu tiến độ.
