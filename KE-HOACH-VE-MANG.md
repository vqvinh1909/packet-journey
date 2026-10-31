# Kế hoạch nâng cấp ✏️ Vẽ mạng — giống draw.io

> Trạng thái: **ĐÃ HOÀN TẤT** (2026-10-29). Toàn bộ mục A–J trong kế hoạch đã được triển khai.
> Hiện có: bộ icon mạng/DevOps/cloud/lưu đồ/UML; nhiều trang và lớp; dây có điểm nối/waypoint/cáp; Inspector và kiểm tra; tự bố trí; lịch sử; import/export JSON, draw.io, PNG/SVG và in PDF; cầu nối với lab/workspace.
> Phạm vi: **vẽ sơ đồ + ghi thông tin để làm tài liệu** (IP, VLAN, cổng… ở nhóm J, chỉ để ghi chú và cảnh báo). Cấu hình và chạy thử thật vẫn nằm ở 🧪 Lab CLI và 🧱 workspace.
> Mọi icon đều **tự vẽ**, không chép logo hãng (Cisco, Docker, Kubernetes, AWS…).

**Độ lớn:** S = nhỏ (vài giờ) · M = vừa (~1 buổi) · L = lớn (nhiều buổi).

---

## Thứ tự đề xuất

| Đợt | Nhóm | Vì sao làm trước |
|---|---|---|
| 1 | **B** – Dây nối | Thứ quan trọng nhất khi vẽ topology; hiện còn yếu nhất |
| 2 | **A + E + F + G** – Giao diện, icon, thư viện theo bộ | Hết cảm giác "sơ sài", có đủ hình cho mạng và DevOps |
| 3 | **J1–J5** – Thuộc tính thiết bị/dây, VLAN, Inspector, kiểm tra | Điểm khác biệt so với draw.io, sát nhu cầu học CCNA |
| 4 | **C1 + I1** – Đường gióng, tự sắp xếp | Vẽ nhanh và thẳng hàng |
| 5 | **I2 + J6** – Thư viện mẫu lớn + mẫu theo chủ đề CCNA | Có sơ đồ mẫu để sửa thay vì vẽ từ đầu |
| 6 | **D1 + J7** – Hai chiều sơ đồ ↔ lab, rồi D2 .drawio, D3 PDF | Nối trình vẽ với phần thực hành |
| 7 | **H** – Lưu đồ & kiến trúc | Mở rộng sang quy trình, sequence |
| 8 | **C còn lại + I còn lại** | Hoàn thiện |

---

## Nhóm B — Dây nối ⭐ (đợt 1)

- [x] **B1. Điểm nối cố định** (M) — hoàn tất 2026-10-29
  - Mỗi hình có 4 điểm nối (trên/dưới/trái/phải); thiết bị lớn có thêm điểm phụ.
  - Dây nhớ đúng điểm đã nối, không tự nhảy sang cạnh khác khi kéo hình.
  - Vẫn giữ chế độ "nối tự do" (đầu dây tự chọn cạnh gần nhất) như hiện nay.
  - *Xong khi:* kéo thiết bị đi đâu thì dây vẫn bám đúng điểm đã chọn.
- [x] **B2. Điểm uốn kéo tay + gấp khúc thông minh** (L) — hoàn tất 2026-10-29
  - Bấm vào dây → hiện các điểm uốn, kéo được; nháy đúp để thêm hoặc xoá điểm uốn.
  - Dây gấp khúc tự tìm đường vòng, không cắt ngang qua hình khác.
  - *Xong khi:* dây gấp khúc giữa 2 thiết bị có 1 hình chắn ở giữa thì đi vòng qua hình đó.
- [x] **B3. Kéo đầu dây để đổi hình nối** (S) — hoàn tất 2026-10-29
  - *Xong khi:* kéo đầu B của dây từ SW1 sang SW2 thì dây nối lại vào SW2, có hoàn tác.
- [x] **B4. Nhiều dây giữa 2 thiết bị** (S) — hoàn tất 2026-10-29
  - 2–8 dây giữa cùng một cặp thiết bị (EtherChannel) tự tách song song.
  - Tuỳ chọn vẽ thêm vòng elip quanh bó dây và nhãn "Po1".
- [x] **B5. Kiểu dây theo loại cáp** (M) — hoàn tất 2026-10-29
  - Ethernet (liền), cáp quang (liền màu cam), Serial (zigzag), Wi-Fi (gạch + sóng), VPN/tunnel (gạch đôi), console (chấm).
  - Có chú thích tự động cho các loại dây đang dùng (xem I/C5).
- [x] **B6. Gợi ý tên cổng tự động** (S) — hoàn tất 2026-10-29
  - Nối dây xong, app tự điền nhãn cổng còn trống theo loại thiết bị (router Gi0/0, Gi0/1…; switch Fa0/1… / Gi0/1…), không trùng trên cùng thiết bị; sửa tay được.

## Nhóm A — Giao diện (đợt 2)

- [x] **A1. Vẽ lại toàn bộ icon** (L) — hoàn tất 2026-10-29
  - Phong cách thống nhất kiểu sơ đồ mạng: nét gọn, có đổ bóng nhẹ, 2 tông màu, đẹp ở mọi cỡ.
  - Đủ cho cả nền sáng và nền tối.
- [x] **A2. Thanh menu như draw.io** (M) — hoàn tất 2026-10-29
  - Tệp / Sửa / Xem / Sắp xếp / Trợ giúp.
  - Thanh công cụ gọn hơn, có icon kèm chú thích khi rê chuột.
- [x] **A3. Bảng Định dạng chia tab** (M) — hoàn tất 2026-10-29
  - Tab **Kiểu** / **Chữ** / **Sắp xếp**.
  - Ô màu chọn nhanh (bảng 12 màu sẵn), xem trước kiểu dây, kiểu bóng đổ, bo góc.
- [x] **A4. Minimap + thước kẻ** (M) — hoàn tất 2026-10-29
  - Bản đồ nhỏ ở góc để nhảy nhanh; thước kẻ ngang và dọc.
- [x] **A5. Khung vẽ chế độ tối** (S) — hoàn tất 2026-10-29
- [x] **A6. Chế độ toàn màn hình** (S): ẩn thư viện / bảng định dạng, phím F11 hoặc nút ⛶. — hoàn tất 2026-10-29

## Nhóm E — Thêm hình mạng (đợt 2)

- [x] **E1. Hạ tầng** (M): modem, router Wi-Fi gia đình, hub, load balancer, IDS/IPS, VPN gateway, tổng đài IP, tủ rack, NAS/SAN. — hoàn tất 2026-10-29
- [x] **E2. Server theo vai trò** (S): web, mail, DNS, DHCP, database (hình trụ), máy ảo/hypervisor, cụm server. — hoàn tất 2026-10-29
- [x] **E3. Thiết bị đầu cuối** (S): người dùng, điện thoại di động, máy tính bảng, camera IP, thiết bị IoT, màn hình/TV. — hoàn tất 2026-10-29
- [x] **E4. WAN & vùng** (S): toà nhà (HQ/chi nhánh), trạm 4G/5G, vệ tinh, đám mây công cộng, đám mây MPLS, ISP. — hoàn tất 2026-10-29
- [x] **E5. Hình cơ bản** (S): mũi tên khối, tam giác, lục giác, hình trụ, ngôi sao, khung chú thích (callout), bảng, ổ khoá. — hoàn tất 2026-10-29

## Nhóm F — DevOps / Cloud-native (đợt 2)

- [x] **F1. Container** (M): container, image, registry, pod, node, cluster, namespace, deployment, service, ingress, configmap/secret, volume. — hoàn tất 2026-10-29
- [x] **F2. CI/CD** (M) — hoàn tất 2026-10-29
  - Git repo, nhánh, merge/PR, runner, artifact, môi trường dev/staging/prod.
  - Khối **pipeline** nhiều ô (build → test → scan → deploy), thêm/bớt ô được.
- [x] **F3. Dịch vụ cloud** (M) — hoàn tất 2026-10-29
  - VM, autoscaling group, serverless function, API gateway, load balancer L4/L7, CDN, DNS.
  - Object storage, block storage, hàng đợi tin nhắn, cache.
  - Cơ sở dữ liệu SQL / NoSQL / time-series, kho bí mật (vault), IAM.
- [x] **F4. Vận hành** (S): monitoring/metrics, logging, tracing, cảnh báo, dashboard, IaC, config management, on-call. — hoàn tất 2026-10-29
- [x] **F5. Ứng dụng** (S): trình duyệt, app di động, microservice, frontend, backend, người dùng/dev/ops. — hoàn tất 2026-10-29

## Nhóm G — Khung chứa (đợt 2)

- [x] **G1. Khung "thật"** (M) — hoàn tất 2026-10-29
  - Kéo hình vào khung là hình thuộc khung; kéo khung thì hình bên trong đi theo; khung tự nới khi hình sát mép.
- [x] **G2. Các loại khung** (S) — hoàn tất 2026-10-29
  - Region, availability zone, VPC/VNet, subnet public/private, cluster, namespace, security group, on-premise / data center.
  - Swimlane (làn) cho sơ đồ quy trình.
- [x] **G3. Thư viện theo bộ** (S) — hoàn tất 2026-10-29
  - Nút **"＋ Thêm bộ hình"** bật/tắt từng bộ: Mạng / DevOps / Cloud / Lưu đồ / Cơ bản.
  - Mục **"Hình hay dùng"** ở đầu thư viện; các nhóm thu gọn được.

## Nhóm C — Năng suất (đợt 3 và 7)

- [x] **C1. Đường gióng thông minh** (M) — hoàn tất 2026-10-29
  - Khi kéo, hiện đường căn thẳng hàng với tâm và mép các hình khác, kèm khoảng cách đều; tự bắt dính.
- [x] **C2. Nhiều trang** (M): tab Page-1, Page-2… trong một file; đổi tên, sắp xếp, nhân bản và xoá trang. — hoàn tất 2026-10-29
- [x] **C3. Lớp (layer)** (M): tạo lớp; ẩn/hiện, khoá từng lớp; chuyển hình sang lớp khác. — hoàn tất 2026-10-29
- [x] **C4. Tìm & thay chữ** (S): Ctrl+F tìm hình theo tên, nhảy tới hình đó; thay chữ hàng loạt. — hoàn tất 2026-10-29
- [x] **C5. Bảng chú giải tự sinh** (S): tạo bảng chú giải từ hình và loại dây đang dùng. — hoàn tất 2026-10-29
- [x] **C6. Sao chép định dạng** (S): copy kiểu từ hình này dán sang hình khác. — hoàn tất 2026-10-29

## Nhóm I — Tiện dụng (đợt 3, 4 và 7)

- [x] **I1. Tự sắp xếp (auto-layout)** (L) — hoàn tất 2026-10-29
  - Kiểu phân lớp core → distribution → access (theo loại thiết bị), kiểu cây, kiểu lưới.
  - Có hoàn tác; chỉ áp cho vùng đang chọn nếu có chọn.
- [x] **I2. Thư viện mẫu lớn** (M) — hoàn tất 2026-10-29
  - Campus 3 lớp, data center spine-leaf, SD-WAN nhiều chi nhánh, CI/CD pipeline, cụm Kubernetes.
  - Kiến trúc web 3 tầng (web–app–db), site dự phòng (DR), mạng gia đình/SOHO.
- [x] **I3. Lịch sử phiên bản** (S): tự lưu mỗi 5 phút, giữ tối đa 30 bản, có khôi phục. — hoàn tất 2026-10-29
- [x] **I4. Kiểm tra sơ đồ** (S): báo thiết bị chưa nối dây, trùng tên, dây trùng đường đi, nhãn cổng trùng. — hoàn tất 2026-10-29
- [x] **I5. Cảm ứng** (M): chạm để chọn, kéo; hai ngón phóng to / di chuyển; menu giữ chạm theo context menu của trình duyệt. — hoàn tất 2026-10-29
- [x] **I6. In / PDF** (M): in A4/A3 ngang/dọc, có khung tên (tên dự án, người vẽ, ngày, phiên bản); lưu PDF từ hộp thoại in. — hoàn tất 2026-10-29
- [x] **I7. Hiệu năng** (M): giới hạn cập nhật một lần mỗi khung hình; sơ đồ trên 500 hình chỉ vẽ lại hình được kéo và các dây nối trong trường hợp không cần định tuyến lại dây gấp khúc. — hoàn tất 2026-10-29

## Nhóm J — Tính năng riêng cho CCNA (hơn draw.io) — *bổ sung từ góp ý ChatGPT*

> Đây là **thông tin ghi trên sơ đồ để làm tài liệu và tự kiểm tra**, không phải cấu hình thiết bị (cấu hình thật vẫn ở Lab CLI).
> Mọi kiểm tra chỉ **cảnh báo** dựa trên dữ liệu bạn khai báo; app **không khẳng định** mạng chạy được nếu chưa mô phỏng.

- [x] **J1. Thuộc tính thiết bị** (M) — hoàn tất 2026-10-29
  - Hostname, model, IP quản lý; danh sách cổng, mỗi cổng có IP/mask, VLAN, chế độ access/trunk, mô tả.
  - Hiện gọn dưới icon (tuỳ chọn ẩn/hiện).
- [x] **J2. Thuộc tính dây** (S) — hoàn tất 2026-10-29
  - Loại cáp (Ethernet / quang / serial / Wi-Fi), tốc độ, chế độ **trunk / access**, VLAN được phép, cổng 2 đầu.
  - Kiểu nét tự đổi theo loại cáp (dùng chung B5).
- [x] **J3. Lớp phủ VLAN** (M) — hoàn tất 2026-10-29
  - Tô màu dây/cổng theo VLAN, bảng chú giải màu; bấm một VLAN để làm nổi phần sơ đồ thuộc VLAN đó.
- [x] **J4. Network Inspector** (M) — hoàn tất 2026-10-29
  - Bảng bên phải liệt kê thiết bị, cổng đã dùng / còn trống, các liên kết; bấm dòng nào thì nhảy tới hình đó.
- [x] **J5. Kiểm tra địa chỉ & VLAN** (M) — chỉ cảnh báo — hoàn tất 2026-10-29:
  - Trùng IP; IP và gateway khác subnet; hai đầu một dây khác subnet hoặc lệch mask.
  - Dây trunk mà hai đầu khác danh sách VLAN; access hai đầu khác VLAN; cổng ghi 2 lần.
- [x] **J6. Mẫu theo chủ đề CCNA** (S): VLAN, inter-VLAN routing (ROAS / SVI), OSPF đa vùng, STP root, EtherChannel, HSRP, NAT ra Internet. — hoàn tất 2026-10-29
- [x] **J7. Từ sơ đồ sang lab** (M) — hoàn tất 2026-10-29
  - Nút "🧱 Mở trong workspace": chuyển thiết bị + dây + tên cổng sang chế độ tự dựng mạng (thiết bị tắt, chưa cấu hình) để bạn tự gõ cấu hình.
  - Chiều ngược lại là D1.

## Nhóm H — Lưu đồ & kiến trúc (đợt 5)

- [x] **H1. Lưu đồ** (S): bắt đầu/kết thúc, xử lý, quyết định (thoi), dữ liệu, tài liệu, đầu nối trang. — hoàn tất 2026-10-29
- [x] **H2. Sequence diagram** (M): có life-line, mũi tên gọi / trả về, khối hoạt động. — hoàn tất 2026-10-29
- [x] **H3. UML class đơn giản + bảng/ma trận** (M). — hoàn tất 2026-10-29

## Nhóm D — Gắn với app & định dạng khác (đợt 6)

- [x] **D1. Vẽ từ lab** (M) — hoàn tất 2026-10-29
  - Nút "✏️ Mở trong trình vẽ" ở Lab CLI và workspace: chuyển topology (thiết bị, dây, tên cổng, IP) sang trình vẽ để chỉnh đẹp rồi xuất ảnh.
- [x] **D2. File .drawio** (L) — hoàn tất 2026-10-29
  - Xuất sang XML của draw.io để mở bằng draw.io thật; nhập file .drawio (hình cơ bản + dây, hình lạ thay bằng khung chữ nhật).
- [x] **D3. Xuất PDF** (S): qua chức năng In / lưu PDF. — hoàn tất 2026-10-29

---

## Kiểm tra sau mỗi đợt

- Test tự động cho phần lõi (`tests/diagram.test.js`): hình học dây, tự sắp xếp, nhập/xuất, kiểm tra sơ đồ.
- Thử trên trình duyệt: kéo thả, nối dây, hoàn tác, xuất PNG/SVG; không lỗi console.
- Mọi đợt làm trên nhánh riêng, mở PR để bạn merge (bạn tự chạy `git pull` như các lần trước).

## Ghi chú cho người làm tiếp

- Lõi: `lab/diagram.js` (hàm thuần, có test) · Giao diện: `ui/diagram.js` · CSS: `styles/app.css` (mục "✏️ Vẽ mạng").
- Dữ liệu sơ đồ lưu ở localStorage `pj_diagram`; đổi định dạng thì tăng `version` và viết hàm chuyển từ bản cũ.
- Bản tóm tắt cũng có trong `GHI-CHU-LAM-TIEP.md`, mục "📝 ĐỀ XUẤT CHỜ DUYỆT".
