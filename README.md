# Packet Journey — Hành trình gói tin qua từng tầng

Web app học mạng chạy hoàn toàn trong trình duyệt (không backend), mô phỏng **chuyên
sâu** một gói tin đi qua từng tầng OSI/TCP-IP và từng thiết bị — kiểu "Wireshark +
mô phỏng + giáo trình". Gói tin được dựng thành **byte thật**, checksum **tính thật**,
và **xuất được `.pcap`** để mở bằng Wireshark đối chiếu.

> Trạng thái: **đã phủ CCNA + CCNP** — 30 kịch bản byte-thật (23 giao thức, quiz đủ 30 bài),
> chế độ học chủ động (đoán bước, thử thách sửa lỗi, từ điển, lưu tiến độ, PWA offline),
> Builder + Canvas vẽ mạng, và **🧪 Lab CLI Cisco IOS với 109 lab** (27 lab giáo trình, 41 lab
> CCNA trực quan, 5 lab chuyên đề, 17 lab bảo mật & firewall 7 hãng, 6 lab bảo mật L2 & thiết bị, 8 lab bổ sung theo CCNA 200-301, 5 lab tổng hợp doanh nghiệp) + chế độ thi thử + chế độ tự dựng mạng. Chi tiết xem [Lộ trình](#lộ-trình).

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

> Server phải **đa luồng**: app nạp hơn 100 module ES cùng lúc, server 1 luồng (`socketserver.TCPServer`)
> làm Chrome báo `ERR_CONNECTION_REFUSED` giữa chừng. `serve.py` nên dựng bằng `http.server.ThreadingHTTPServer`;
> nếu chỉ cần chạy app, `python -m http.server 8000` cũng được (đa luồng sẵn từ Python 3.7).

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

Với Lab CLI (`tests/lab.test.js`), MỖI lab trong 109 lab phải: trước khi giải có ít nhất 1 nhiệm vụ
cấu hình chưa đạt; chạy lời giải (`applySolution` — `solution` hoặc `guide`, bước `'@link'` = cắm dây)
không sinh lỗi CLI `% Invalid/Incomplete/Ambiguous/Unknown`; sau đó `checkLab(lab, net, quizAnswers(lab))`
đạt toàn bộ. `tests/sandbox.test.js` kiểm chế độ tự dựng mạng (thêm/xoá/nối dây, đổi tên, nhân bản, hoàn tác,
mạng mẫu, xuất-nhập JSON kể cả file cũ, nhiệm vụ, mẫu theo hãng + Add node, Start/Stop/Wipe + link down);
`tests/breaker.test.js` kiểm phá mạng ngẫu nhiên (mọi lab có lời giải: gài lỗi → có nhiệm vụ trượt, áp lệnh sửa → đạt hết; tất định theo seed);
`tests/capture.test.js` kiểm capture trên dây (gói đúng dây, ping lặp, ARP lần đầu, tag 802.1Q, gói định kỳ, bộ lọc, .pcap); `tests/ip6.test.js` + `tests/net6.test.js` kiểm IPv6 (địa chỉ, SLAAC, OSPFv3, ping);
`tests/library.test.js` kiểm thư viện lab, nhập/xuất `.unl` EVE-NG và chú thích sơ đồ; `tests/cheat.test.js` kiểm cheat sheet + markdown ghi chú; `tests/diag.test.js` kiểm 🩺 chẩn đoán ping và 🔍 so sánh cấu hình; `tests/n200.test.js` kiểm LLDP, OSPF network type, static route name, SNMP v2c/v3, ACL IPv6, VLAN mở rộng, khôi phục mật khẩu qua ROMMON; `tests/exam.test.js` kiểm đề thi thử CCNA (tỉ lệ mảng, xáo đáp án, chấm điểm, câu lab);
`tests/fw.test.js` + `tests/guifw.test.js` kiểm firewall; `tests/l2sec.test.js` kiểm DHCP snooping/DHCP giả, DAI,
IP Source Guard, login block-for, AAA.

Kiểm tra giao diện trên trình duyệt thật (tuỳ chọn, cần Playwright: `npm i -D playwright && npx playwright install chromium`):

```bash
node tools/ui-smoke.cjs   # tự bật server tĩnh, in PASS/FAIL từng mục
```

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
- **🧮 Luyện subnet** (`lab/subnet.js`, `ui/subnet.js`): đề ngẫu nhiên vô hạn 6 dạng — IP/prefix → network, broadcast, host đầu/cuối, số host; đổi mask ↔ prefix ↔ wildcard; cần N host → prefix nhỏ nhất; VLSM (chấm linh hoạt: đúng prefix tối thiểu, network chia hết kích thước, không chồng lấn, nằm trong khối — không bắt buộc đúng phương án mẫu); gộp route summary; hai IP có cùng subnet không. 3 mức độ khó, đồng hồ bấm giờ, chế độ **⏱ 10 câu tính giờ** (lưu kỷ lục theo mức), sai thì hiện **giải từng bước** (bảng nhị phân, bước nhảy/block size, công thức 2^h − 2). **📈 Thống kê** theo dạng: tỉ lệ đúng và số giây trung bình (`pj_subnet-stats`, `pj_subnet-runs` — có trong xuất/nhập tiến độ).
- **🐧 PC kiểu VPCS** (mặc định trong workspace, như EVE-NG/GNS3; các lab có sẵn vẫn dùng dòng lệnh kiểu Windows): `ip 10.0.0.10/24 10.0.0.1`, `ip 10.0.0.10 255.255.255.0 10.0.0.1` (không ghi mask → /24, kiểm tra trùng IP bằng gratuitous ARP, báo gateway khác subnet), `ip dhcp` (in `DDORA IP …`), `ip dns`, `ip auto` (SLAAC), `show ip`, `show arp`, `show`, `ping` (5 gói `84 bytes from …`, `-c N`), `trace`, `save` (startup.vpc — Wipe nạp lại), `clear ip/arp`, `version`, `?`. Chuột phải PC → đổi qua lại VPCS / kiểu Windows.
- **⏱ Thời gian hội tụ thật + log IOS** (Lab CLI và workspace): thanh đồng hồ mô phỏng chọn tốc độ **⚡ Tức thì / ×1 / ×5 / ×20** và nút **⚡ Hội tụ ngay**. Khi có thay đổi (bật/tắt cổng, cấu hình, nối dây), giao thức đi qua các trạng thái trung gian như thiết bị thật và `show` hiện đúng trạng thái đó: STP listening 15 s → learning 15 s → forwarding (PortFast ngay, RSTP/MST ~2 s; sơ đồ ghi `LSN`/`LRN` trên cổng), OSPF INIT → 2WAY → EXSTART → EXCHANGE → LOADING → FULL (~11 s, route chỉ có khi FULL), EIGRP lên sau 5 s, BGP Active → OpenSent → OpenConfirm → Established, HSRP Init → Listen → Speak → Standby/Active (10 s), VRRP Backup → Master. Trong lúc chờ, ping không qua được. Log in đúng lúc (có dấu thời gian) trên console từng thiết bị: `%LINK-3-UPDOWN`, `%LINEPROTO-5-UPDOWN`, `%OSPF-5-ADJCHG`, `%DUAL-5-NBRCHANGE`, `%BGP-5-ADJCHANGE`, `%HSRP-5-STATECHANGE`, `%SPANTREE-2-BLOCK_BPDUGUARD`, `%PM-4-ERR_DISABLE`, `%SYS-5-CONFIG_I`. Lệnh mới: `show logging` (buffer log), `debug ip ospf adj`, `debug ip icmp`, `undebug all` / `no debug all`, `show debugging`, `clear logging`, `logging synchronous` (lưu trong `line con/vty`). Chấm điểm luôn tính như mạng đã hội tụ.
- **🎓 Thi thử CCNA** (`lab/ccna-exam.js`, `ui/exam.js`): ngân hàng **100 câu tự soạn** (không chép đề thật/dump) chia đúng tỉ trọng 6 mảng đề CCNA 200-301 (Network Fundamentals 20%, Network Access 20%, IP Connectivity 25%, IP Services 10%, Security Fundamentals 15%, Automation & Programmability 10%) — trắc nghiệm 1 đáp án, nhiều đáp án, ghép cặp — cộng **câu lab mô phỏng** (console thu nhỏ, chấm bằng `checkLab`). Đề đầy đủ 104 câu / 120 phút hoặc rút gọn 31 câu / 40 phút; câu và phương án được xáo theo seed; đồng hồ đếm ngược, lưới câu hỏi, ⚑ đánh dấu, tải lại trang vẫn làm tiếp (`pj_ccna-exam-cur`). Nộp bài → điểm **300–1000 (đạt ≥ 825)**, thanh điểm từng mảng, xem lại câu sai kèm đáp án + giải thích, lịch sử các lần thi (`pj_ccna-exam-hist`).
- **📋 Cheat sheet** (`lab/cheat.js`, `ui/cheat.js`): tự gom các lệnh bạn đã gõ **thành công** trong Lab CLI theo chủ đề → chế độ CLI (kèm dấu nhắc), mô tả ngắn tiếng Việt, ví dụ đã gõ, số lần dùng; lọc chủ đề, tìm kiếm, **🖨 In** (chỉ in bảng lệnh).
- **📊 Điểm yếu của tôi** (`lab/weak.js`, `ui/weak.js`): app tự ghi khi bạn học — lệnh gõ sai trong Lab CLI (`% Invalid / Incomplete / Ambiguous`), nhiệm vụ còn trượt khi mở lời giải hoặc nộp bài thi thử, số gợi ý / lời giải đã mở, câu trắc nghiệm sai (trong lab và 🎯 Quiz kịch bản), thời gian làm từng lab, cộng kết quả 🎲 Phá mạng và 🧮 Luyện subnet. Mỗi lab/nhiệm vụ/lệnh được gắn chủ đề (VLAN/Trunk, STP, EtherChannel, Static, OSPF, EIGRP, BGP, ACL, NAT, DHCP, FHRP, Bảo mật L2, Firewall, IPv6, Subnet, Quản trị thiết bị, WAN/Serial, Interface & L1, Nền tảng — suy từ tên/bài học/nhóm hoặc trường `topics` của lab). Trang hiện **biểu đồ SVG điểm 0–100 theo chủ đề** (rê chuột xem chi tiết, có dạng bảng), **lệnh gõ sai nhiều nhất kèm cú pháp đúng** (CLI tự tìm mẫu lệnh gần nhất, báo cả khi gõ sai chế độ, vd lệnh cổng gõ ở `(config)#`), **3–5 lab nên làm** và nút **🎲 Phá mạng chủ đề yếu nhất**. Dữ liệu ở `pj_weak` (có trong xuất/nhập tiến độ).
- **🧪 Lab CLI (Cisco IOS)** — **109 lab** + chế độ thi thử + chế độ tự dựng mạng: gõ lệnh như trên router/switch thật (viết tắt `sh ip int br`, `conf t`, Tab hoàn thành, `?` trợ giúp, lỗi `% Invalid input ... '^' marker`, mật khẩu enable, `| include/section`...). Mạng được **tính thật** từ cấu hình bạn gõ: VLAN/trunk/native/DTP/VTP/EtherChannel/PVLAN, **STP 802.1D/PVST thật** (root/root port/designated, cổng BLOCKING bị chặn khi chuyển frame), bảng định tuyến connected + static (floating) + **OSPF đa vùng/EIGRP/BGP (iBGP qua loopback, eBGP) tự hội tụ** + redistribution, **IPv6 dual-stack** (địa chỉ/EUI-64/link-local, static, OSPFv3, SLAAC, ping IPv6), GRE, IPsec, PPP CHAP, ACL (thứ tự dòng, deny ngầm định), NAT/PAT/NAT tĩnh/NAT pool, HSRP (tracking)/VRRP, DHCP + relay, **DHCP snooping (chặn DHCP giả, bảng binding) + DAI + IP Source Guard**, port-security, SSH (hỏi mật khẩu)/Telnet, **AAA local, login block-for/quiet mode**, NTP. Nhiệm vụ **tự chấm** sau mỗi lệnh bằng ping/telnet/`show` thật; ping/traceroute/DHCP có nút **▶ Xem gói tin** mở timeline byte-thật ở màn hình chính.
  - Trong mỗi lab: **📝 Ghi chú của tôi** (markdown gọn `**đậm**`, `` `lệnh` ``, gạch đầu dòng — lưu `pj_labnote:<id>`) + cờ **⭐ Cần làm lại** (lọc bằng nút ⭐ ở danh sách lab); **🩺 Vì sao không ping được?** (`lab/diagnose.js`: chọn nguồn + IP đích, app dò theo lớp L1 cáp/cổng → cấu hình IP máy → L2 VLAN/trunk (ARP) → L3/ACL/NAT/VPN bằng chính engine, liệt kê các lớp đã ổn rồi mở **gợi ý 3 mức**: lớp nào → thiết bị + lệnh show nào → chi tiết lỗi); **🔍 So sánh với lời giải** (`lab/cfgdiff.js`: running-config của bạn so với cấu hình sau lời giải theo từng thiết bị — dòng chỉ có ở bạn / chỉ có ở lời giải, kèm ghi chú khi hai cách đều đúng: `network` ↔ `ip ospf … area`, ACL số ↔ ACL tên, static next-hop ↔ cổng ra…).
  - **27 lab theo giáo trình** *Infrastructure Administrator* (L01–L20 theo bài, 🎫 6 ticket T01–T06, 🏢 dự án GreenMart P01).
  - **41 lab "CCNA trực quan"** (`lab/labs-ccna.js`): Ch.1 khái niệm cốt lõi A01–A26, Ch.2 các bước cấu hình B01–B10, Ch.3 xử lý sự cố C01–C05.
  - **🛡️ 17 lab bảo mật & firewall** (`lab/labs-sec.js`), lõi firewall stateful dùng chung `lab/fw.js`:
    - **Cisco ASA** (CLI ASA: nameif/security-level, ACL kiểu ASA, object NAT, inspect icmp, show conn/xlate) — F01 3 vùng cơ bản, F02 publish web DMZ, F03 ticket 5 lỗi, F04 port forwarding + 2 DMZ cùng mức.
    - **Zone-Based Firewall trên router IOS** — Z01 INSIDE→OUTSIDE, Z02 3 zone + DMZ, Z03 ticket 4 lỗi.
    - **FortiGate** (CLI FortiOS `config/edit/set/next/end`, VIP, `get system session list`) — FG01, FG02; **Palo Alto** (PAN-OS: candidate config + `commit`, App-ID, NAT pre-NAT IP / post-NAT zone) — PA01, PA02.
    - **Trang quản trị web giả lập** (thay console khi chọn thiết bị): **Sophos Firewall** (rule theo zone, Linked NAT MASQ, DNAT) — SP01, SP02; **Check Point** SmartConsole (rulebase, Hide/Static NAT, *Install Policy*) — CP01, CP02; **pfSense** (rule theo cổng nhận gói, *Default allow LAN*, port forward + associated rule, *Apply Changes*) — PF01, PF02. Mỗi thao tác trên form sinh một "lệnh thao tác" nên lời giải/cách giải/nhật ký dùng chung.
  - **🔐 6 lab bảo mật L2 & thiết bị** (`lab/labs-l2sec.js`): S01 Wi-Fi lạ phát DHCP → DHCP snooping, S02 Dynamic ARP Inspection + binding tĩnh cho máy in IP tĩnh, S03 IP Source Guard chặn nhân viên giả IP giám đốc, S04 AAA + chỉ SSH + `login block-for` + quiet-mode access-class (thử dò mật khẩu thật), S05 ticket "bật bảo mật L2 xong cả phòng mất mạng" (4 lỗi), S06 kiểm toán bảo mật 6 phát hiện.
  - **🆕 8 lab bổ sung theo CCNA 200-301** (`lab/labs-n200.js`), lấp các chủ đề đề hiện hành mà bộ lab trước chưa có (đối chiếu với các sách lab CCNA phổ biến): N01 **LLDP** (`lldp run`, `no lldp transmit/receive`, `show lldp neighbors [detail]`, `show lldp interface`), N02 ticket **OSPF network type** (`ip ospf network point-to-point`; lệch 2 đầu → láng giềng vẫn lên nhưng mất route; `show ip ospf interface`), N03 **static route có `name`** + floating, N04 **SNMPv2c** (community RO/RW + ACL, location/contact, trap host) và N05 **SNMPv3 authPriv** (group/user SHA + AES; user không hiện trong running-config) — kiểm tra bằng công cụ kiểu net-snmp trên PC/server: `snmpget` / `snmpwalk` / `snmpset` (sai community hoặc bị ACL → Timeout, sai user / mật khẩu / mức bảo mật → báo lỗi như thật), N06 **ACL IPv6** (`ipv6 access-list`, `ipv6 traffic-filter … in|out`, deny ngầm định, đếm match), N07 **VLAN mở rộng 1006–4094** (chỉ tạo được khi VTP transparent), N08 ticket **khôi phục mật khẩu** (`power-cycle` → `send break`/Ctrl+Break → ROMMON `confreg 0x2142` → `reset` → `copy startup-config running-config` (chỉ gộp, cổng vẫn shutdown) → đổi secret → `config-register 0x2102`; `show version` hiện "will be … at next reload").
  - **🔬 5 lab chuyên đề** (`lab/labs-adv.js`): D01 VTP gỡ "bom revision", D02 Private VLAN khách sạn + DHCP, D03 IPsec site-to-site dựng từ đầu + NAT exemption, D04 BGP iBGP/eBGP + next-hop-self, D05 STP đặt Root Bridge đúng chỗ.
  - **🏆 5 lab tổng hợp doanh nghiệp CCNA + CCNP** (`lab/labs-capstone.js`, có cách giải chi tiết):
    X01 campus 3 lớp (EtherChannel, port-security, HSRP trên SVI, DHCP, OSPF, NAT PAT, ACL khách, SSH) ·
    X02 HQ + 2 chi nhánh (PPP CHAP, GRE qua Internet, OSPF đa vùng, DHCP relay, NAT tập trung) ·
    X03 sáp nhập công ty (redistribution OSPF↔EIGRP, dual-ISP eBGP + default-originate, HSRP tracking, NAT) ·
    X04 troubleshooting marathon 9 lỗi (VLAN, allowed list, native, SVI, area OSPF, default-information, ACL NAT, thứ tự ACL, VIP HSRP) ·
    X05 dual-stack IPv6 (ipv6 unicast-routing, OSPFv3 area 0/1, default ::/0, PC tĩnh + SLAAC, IPv4 vẫn chạy).
  - Nhiệm vụ dạng **❓ trắc nghiệm** hiện thành nút chọn đáp án (lưu ở `pj_labans:<id>`), chấm cùng các nhiệm vụ cấu hình.
  - **🧭 Cách giải chi tiết** cho lab có `guide`: từng bước có tiêu đề, lý do và khối lệnh, nút "▶ Gõ bước này vào console" — sau mỗi bước báo bước đó vừa làm đạt nhiệm vụ nào (nhiệm vụ mới đạt nháy sáng).
  - **🎲 Phá mạng ngẫu nhiên** (lab xử lý sự cố vô hạn, `lab/breaker.js`): chọn lab (mặc định ngẫu nhiên, ưu tiên lab đã xong), 1/2/3 lỗi và seed (cùng seed → cùng đề). App chạy lời giải để có mạng chạy tốt rồi gài lỗi ngẫu nhiên từ thư viện: cổng shutdown, sai VLAN access, trunk thiếu VLAN trong allowed list, lệch native VLAN, PC sai IP/mask/gateway, OSPF thiếu network/sai area, mất route tĩnh, ACL chặn nhầm (deny chèn lên đầu), thiếu `ip nat inside/outside`, sai IP ảo HSRP, port-security err-disabled, sai `encapsulation dot1Q`. Chỉ gài lỗi hợp với thiết bị/tính năng trong lab và mỗi lỗi phải làm hỏng ít nhất 1 nhiệm vụ (kiểm bằng `checkLab`). Nhiệm vụ = các nhiệm vụ gốc của lab; 💡 Gợi ý mở dần (lớp nào → thiết bị nào → cổng/lệnh nào), 🔑 Xem đáp án liệt kê lỗi kèm lệnh sửa. Chấm theo thời gian và số gợi ý, lưu lịch sử (có trong xuất/nhập tiến độ).
  - **⏱ Thi thử**: làm lại lab từ đầu có đếm giờ (theo độ khó), ẩn gợi ý / lời giải / kết quả từng nhiệm vụ; nộp bài (hoặc hết giờ) → chấm thang 1000, đạt từ 800, lưu kỷ lục.
  - **🔎 Tìm lab** không dấu nhiều từ khoá (ví dụ "ospf nat"), lọc Chưa xong / Đã xong, mỗi nhóm hiện đã xong/tổng.
  - Topology đánh dấu cổng đang **STP BLOCKING** (✕, rê chuột xem VLAN).
  - **🔗 Nối dây** cho lab kéo-thả (A04): chọn 2 thiết bị rồi chọn cổng; ✂ gỡ dây bằng cách bấm vào dây.
  - **🧱 Tự dựng mạng riêng — workspace toàn màn hình kiểu EVE-NG** (`ui/workspace.js`, logic `lab/sandbox.js`):
    - Canvas lớn: kéo thả thiết bị, kéo nền (hoặc lăn chuột) để cuộn, Ctrl + lăn chuột / nút −, +, ⤢ để phóng to, thu nhỏ, vừa khung.
    - **Bảng thiết bị chia theo hãng**: Cisco (Router, Switch 2960, Switch L3 3560, ASA), Fortinet (FortiGate), Palo Alto, Sophos, Check Point, pfSense, Host (PC, Server). Bấm hoặc kéo vào canvas → hộp thoại **Add node**: mẫu, số lượng, tiền tố tên, số cổng, xem trước tên cổng theo mẫu (Gi0/0…, port1…, ethernet1/1…, eth1…, em0…).
    - **Trạng thái thiết bị**: mới thêm thì **tắt** (icon xám); **Start** → log khởi động trong console rồi mới gõ lệnh (icon xanh); **Stop** → mọi cổng down, dây nối tới nó down, mất kết nối (cấu hình đang chạy được giữ). Có ▶ Start all / ■ Stop all.
    - **Chuột phải** vào thiết bị: Start, Stop, Wipe (về cấu hình trống), Console, Nối dây từ đây, Đổi tên, Nhân bản, Xoá; vào dây: Xoá dây; vào nền: Add node….
    - **Nhiều cửa sổ console cùng lúc** (nháy đúp thiết bị): kéo, đổi kích thước, thu nhỏ xuống thanh dưới, đóng; mỗi console giữ lịch sử ↑/↓, Tab, `?`, dán nhiều dòng. Sophos / Check Point / pfSense mở trang quản trị web trong cửa sổ.
    - **☁️ Cloud / Internet** (nhóm *Network*): thiết bị "Internet" vẽ thành đám mây SVG tự vẽ (đầu dây cắm vào mép đám mây, dưới hiện tên + IP) nhưng vẫn là server giả lập 1 cổng — đặt IP/gateway, ping, telnet như server. Cờ `cloud` lưu trong JSON; server tên chứa "INTERNET" (kể cả trong các lab có sẵn và file JSON cũ) tự vẽ thành đám mây ở sơ đồ Lab CLI, workspace và sơ đồ "Xem gói tin".
    - **📡 Capture trên dây kiểu Wireshark** (`lab/capture.js`): chuột phải vào dây → *Start capture* / *Stop capture*; dây đang bắt có dải sáng chạy dọc dây + kính lúp; bắt được nhiều dây cùng lúc, mỗi dây một cửa sổ nổi. Bảng gói No. / Time / Source / Destination / Protocol / Length / Info (vd `Echo (ping) request id=0x0001, seq=1`, `Who has 10.0.0.1? Tell 10.0.0.2`, `Hello Packet`) tô màu theo giao thức, tag VLAN của trunk 802.1Q; bấm 1 gói → cây trường từng lớp + hex dump (rê chuột nối hai bên); bộ lọc hiển thị `icmp`, `arp`, `tcp`, `udp`, `ospf`, `stp`, `dhcp`, `ip.addr == x.x.x.x`, `tcp.port == 80`, `vlan.id == 10` (ghép `&&` / `||` / `!`); tải `.pcap` mở được bằng Wireshark. Gói lấy từ chính engine (ping lặp 4/5 lượt, ARP chỉ khi bảng ARP chưa có, DHCP, telnet/SSH, traceroute) + gói định kỳ theo cấu hình đang chạy: BPDU 2 s, HSRP Hello 3 s, EIGRP Hello 5 s, OSPF Hello 10 s.
    - **📚 Thư viện lab** (`lab/labstore.js`): lưu nhiều mạng có tên, xếp theo thư mục (tạo / đổi tên / xoá thư mục — lab bên trong về "Của tôi"), lưu đè lab đang mở hoặc lưu thành lab mới, mở nhanh **🕘 Gần đây**, đổi tên / chuyển thư mục / xoá lab (`pj_sandbox-lib`).
    - **EVE-NG `.unl`** (`lab/unl.js`, menu *📁 Lưu / Nạp…*): **nhập** file lab EVE-NG — node theo template/image (iol/vios/csr → router, iol L2/viosl2 → switch, vpcs → PC VPCS, asav, fortinet, paloalto, sophos, cpsg, pfsense, linux…), toạ độ giữ nguyên, network 2 đầu → 1 dây, network ≥ 3 đầu → thêm switch thay bridge, network pnet/cloud → đám mây Internet, serial IOL (remote_id) → dây Serial, config base64 → **startup-config** của node (tên cổng EVE như Ethernet0/0, Gi0/0 được đổi sang cổng app tương ứng); thứ không hỗ trợ được báo cáo. **Xuất** ra `.unl` (đổi image cho khớp máy EVE-NG của bạn). Thiết bị nhập vào ở trạng thái tắt như EVE-NG.
    - **✎ Chú thích sơ đồ**: hộp chữ, khung chữ nhật / elip (vẽ vùng DMZ, Tầng 3…), mũi tên — thêm từ menu *✎ Chú thích…* hoặc chuột phải vào nền; kéo để di chuyển, kéo ô vuông góc để đổi kích thước / đầu mũi tên, nháy đúp sửa chữ, chuột phải đổi màu / xoá, Delete xoá; có hoàn tác và lưu trong JSON.
    - **Kiểu dây**: Ethernet nét liền, **Serial nét gạch-chấm** (lên = cam), dây cắm mà chưa lên (sai encap, err-disabled…) màu **đỏ**, cổng shutdown đỏ đứt nét, thiết bị tắt xám; nút **🏷** ẩn/hiện nhãn cổng.
    - 🔗 Nối dây, ↶ hoàn tác / ↷ làm lại (Ctrl+Z/Ctrl+Y ngoài console), Delete xoá thiết bị đang chọn, 📐 5 mạng mẫu; tự lưu trong trình duyệt (`pj_sandbox-net`, khung nhìn `pj_sandbox-view`), ⬇ xuất / ⬆ nhập JSON (file cũ chưa có trạng thái bật/tắt vẫn mở được — thiết bị coi như đang chạy); 🧭 6 nhiệm vụ gợi ý lộ trình (LAN → VLAN → định tuyến → DHCP → OSPF/EIGRP).
  - Tiến độ + cấu hình đã gõ được lưu, mở lại vẫn còn; có gợi ý từng bước và lời giải mẫu (nút "▶ Gõ lời giải" chạy `applySolution` ngay trong console).
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
lab/        net (máy mô phỏng mạng tính từ cấu hình), net6 + ip6 (IPv6), fw (lõi firewall stateful),
            ios (CLI Cisco IOS + PC + Zone-Based Firewall), asa (CLI Cisco ASA), fortios, panos,
            guifw (Sophos/Check Point/pfSense — ui/guifw.js vẽ trang web), labs-sec (lab firewall), labs-l2sec (lab bảo mật L2),
            labs (27 lab + chấm điểm), labs-ccna (41 lab), labs-adv (5 lab chuyên đề), labs-capstone (5 lab tổng hợp),
            kit (helper soạn lab), sandbox (tự dựng mạng), capture (bắt gói trên dây, lọc, .pcap),
            breaker (phá mạng ngẫu nhiên: thư viện lỗi, seed, gợi ý, đáp án)
tools/      ui-smoke.cjs (kiểm tra giao diện bằng Playwright, tuỳ chọn)
scenarios/  s01..s08 (xem danh sách dưới)
ui/         topology, controls, layerstack, fieldtree, hexview, explain, i18n, store, app,
            lab (Lab CLI), workspace (tự dựng mạng kiểu EVE-NG), topo (vẽ thiết bị dùng chung), guifw (trang web firewall)
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
