# Hướng dẫn tạo app — giải thích từng file & quyết định thiết kế

Tài liệu này để bạn học **cách làm ra app**, không chỉ cách dùng. Đọc theo thứ tự
từ dưới lên (byte → giao thức → mô phỏng → giao diện).

## Nguyên tắc chung

- **Thuần JS, ES modules, không framework, không thư viện.** Mỗi file một việc.
- **Tầng lõi không đụng DOM.** `packet/`, `protocols/`, `engine/`, `scenarios/` chạy
  được cả trong trình duyệt lẫn trong `node --test`. Chỉ `ui/` mới chạm DOM. Nhờ vậy
  logic quan trọng nhất (dựng byte, checksum) được test tự động, không cần mở trình duyệt.
- **Hàm thuần (pure) ở lõi.** Cùng input → cùng output, không trạng thái ẩn → dễ test,
  dễ suy luận.

## 1. `packet/` — dựng byte thật

### `addr.js`
Parse/format MAC và IPv4, và các phép mạng: `prefixToMaskInt`, `networkInt`,
`sameSubnet`. `sameSubnet(a, b, prefix)` chính là phép mà host dùng để quyết định
"gửi thẳng hay nhờ gateway".

### `checksum.js`
`internetChecksum(bytes)` theo **RFC 1071**: cộng dồn từng word 16-bit, gộp carry,
rồi lấy bù một (one's complement). Hai hàm `pseudoHeaderV4`/`transportChecksum` để
sẵn cho UDP/TCP ở M2 (checksum tầng 4 cần "pseudo-header" gồm IP nguồn/đích).

### `bytes.js` — `BitWriter` (ý tưởng trung tâm)
Khi ghi header, ta **ghi theo bit** (MSB trước) để các trường < 8 bit (vd IPv4
`version`/`IHL`) nằm đúng trong byte. Điểm hay: hàm `field(meta, fn)` **bọc** mỗi lần
ghi để tự lưu lại `bitOffset`/`bitLength` của trường đó. → Chỉ **một lần đi qua** là
có đồng thời: (a) mảng byte, (b) bản đồ vị trí từng trường. Bản đồ này về sau cho
phép hex view và cây trường **highlight hai chiều** mà không phải tính lại gì.

### `serialize.js` — ngăn xếp layer → byte + cây trường
Một "Packet" là mảng layer `[{proto, fields}, ...]` theo thứ tự **ngoài→trong** như
trên dây (`ethernet` trước, rồi `ipv4`, rồi `icmp`). Hai pha:
- **Pha A (trong→ngoài):** dựng byte từng layer từ cuối mảng lên, nhờ vậy khi tới
  IPv4 đã biết `payloadLength` để điền `Total Length`. Với layer có `checksum:'self'`
  (IPv4 = 20 byte header; ICMP = header+data), tính `internetChecksum` trên chính
  byte của layer đó rồi **vá** vào (trường checksum lúc dựng để 0).
- **Pha B (ngoài→trong):** nối byte và quy đổi offset mỗi trường sang **offset tuyệt
  đối** trong cả gói.

> Bug thật đã gặp: tên trường checksum trong `ipv4.js` là `ip.checksum` nhưng
> `checksumField` lúc đầu ghi nhầm `ipv4.checksum` → serialize không tìm thấy trường,
> checksum không được vá, 3 test đỏ. Bài học: **đặt tên trường và `checksumField`
> khớp nhau**, và viết test "checksum của block chứa checksum đúng = 0" để bắt lỗi này.

### `pcap.js`
`buildPcap(frames)` ghi **global header 24 byte** (magic `a1b2c3d4` little-endian,
linktype = 1 Ethernet) + mỗi frame một **record header 16 byte** (timestamp, incl_len,
orig_len) rồi tới byte frame. `downloadPcap` bọc thêm `Blob` để tải về (có guard để
import ở Node không vỡ).

## 2. `protocols/` — định nghĩa trường theo RFC

Mỗi file export 1 object: `id`, `name/nameVi`, `osiLayer`, `rfc`, quy tắc `checksum`,
và `build(fields, ctx)` trả về một `BitWriter`. `build` chỉ **ghi đúng các trường được
đưa vào** — "ngốc" một cách có chủ đích, mọi quyết định (etherType, TTL, địa chỉ) do
tầng trên (engine/scenario) đặt. Mỗi trường kèm `nameVi`, `descriptionVi` (giải thích
ý nghĩa), `rfc`, và `display` (giá trị hiển thị). `protocols/index.js` là registry để
`serialize` tra theo `id`.

- `ethernet.js` (IEEE 802.3): dst/src MAC + EtherType. Không FCS (đơn giản hóa).
- `dot1q.js` (802.1Q): nhãn VLAN 4 byte — định nghĩa sẵn, dùng ở M3.
- `arp.js` (RFC 826): 28 byte, opcode Request/Reply.
- `ipv4.js` (RFC 791): 20 byte, `checksum:'self'`. TTL/checksum là tâm điểm khi qua router.
- `icmp.js` (RFC 792): Echo Request/Reply, `checksum:'self'` trên cả header+data.

## 3. `engine/` — hành vi thiết bị

### `tables.js`
`ArpCache` (IP→MAC), `MacTable` (MAC→cổng), `RoutingTable` với **`lookup` = longest-
prefix match** (trong các tuyến mà IP đích thuộc về, chọn prefix dài nhất). Mỗi bảng
có `snapshot()` để chụp trạng thái vào từng bước cho UI vẽ.

### `devices.js`
Hàm dựng host/switch/router kèm bảng tương ứng; `ifaceForIp` tìm interface router cùng
mạng với một IP.

### `simulate.js` — `Sim` (recorder)
`Sim` không phải một "máy mô phỏng tự động" mà là **bộ ghi**: kịch bản tự mô tả trình
tự, gọi `sim.frame(layers)` để dựng gói, `sim.emit(event)` để ghi một bước,
`sim.capture(frame, label)` để đưa frame vào file pcap. Cách này cho kịch bản **chính
xác về mặt sư phạm** (ta kiểm soát từng bước giải thích) và tránh một simulator tổng
quát dễ sai. `diffFields(treeCũ, treeMới)` tự tìm trường đổi giá trị → dùng để tô màu
"trường vừa thay đổi" khi gói qua router.

Hình dạng một **Event** (bước timeline) được ghi chú đầy đủ ở đầu `simulate.js`:
`kind` (`process`/`transit`), `atDevice`/`fromDevice`/`toDevice`, `side`
(encap/decap/forward), `activeLayer`, `packet`, `changedFields`, `tables`,
`explanationVi`, `lesson`.

## 4. `scenarios/` — nội dung học

`_common.js` gom tiện ích: payload ping mẫu, `arpFrame()`, `echoFrame()` (trả về ngăn
xếp layer). `s01` (ping cùng mạng) dạy ARP + switch học MAC/flood + ICMP. `s02` (ping
khác mạng) có hàm `routerHop()` tái dùng cho cả chiều đi/về: tra routing (longest-
prefix), TTL−1, tính lại checksum, viết lại MAC — `changedFields` lấy tự động bằng
`diffFields`. Mỗi bước gắn link 📖 "Đọc thêm" trỏ sang bài học trong vault (đường dẫn
tương đối, encode từng đoạn vì tên có dấu/space).

## 5. `ui/` — chỉ phần này chạm DOM

- `store.js`: đọc/ghi `localStorage` có try/catch (chạy tốt cả khi bị chặn).
- `i18n.js`: ngôn ngữ giao diện + `lessonHref()` encode đường dẫn bài học.
- `topology.js`: vẽ SVG (viewBox 0 0 1000 300), animation gói chạy bằng transition
  `cx/cy`, và `renderTables()` vẽ ARP/MAC/routing.
- `controls.js`: thanh điều khiển + thanh trượt + danh sách bước.
- `layerstack.js`: 5 hàng OSI, tầng `activeLayer` sáng + nhãn đóng/bóc/chuyển tiếp.
- `fieldtree.js` + `hexview.js`: hai tab, nối với nhau bằng `data-index`/`data-field`.
  Rê trường → `highlightRange` ở hex; rê byte → tìm trường phủ byte đó rồi
  `highlightFieldRow`. Byte thuộc `changedFields` được tô cam.
- `explain.js`: đoạn giải thích + tag trường đổi + link bài học.
- `app.js`: điều phối tất cả — state (kịch bản, bước, play, speed, tab, theme, lang),
  `renderStep(i, animate)`, vòng `play()` dùng `async/await` + `playToken` để hủy khi
  người dùng bấm tay, và nối cross-highlight.

## Quyết định thiết kế đáng nhớ

1. **"Một lần ghi ra cả byte lẫn offset"** (BitWriter.field) là chìa khóa cho cả tính
   đúng (byte thật) lẫn trải nghiệm (highlight hai chiều).
2. **Tách lõi khỏi DOM** để `node --test` kiểm được phần quan trọng nhất.
3. **Checksum tính lúc serialize, vá tại chỗ** — không bắt protocol tự biết payload.
4. **Recorder thay vì simulator tổng quát** — kịch bản rõ ràng, giải thích chuẩn, dễ mở rộng.
5. **Đường dẫn tương đối + server ở gốc `E:\SAP`** để app liên kết được với vault bài học.
