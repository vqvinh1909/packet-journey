# Ghi chú làm tiếp — Packet Journey

## ✅ Thi thử song ngữ + câu sinh tự động + trình vẽ sơ đồ kiểu draw.io (2026-10-28)
- Thi thử: `lab/ccna-exam-en.js` (BANK_EN cùng thứ tự BANK), `makeExam` gắn textEn/optionsEn/leftEn/rightEn/explainEn;
  `ui/exam.js` có nút VI / EN / VI + EN (`pj_exam-lang`). `lab/ccna-gen.js`: 9 dạng câu sinh theo seed (GEN_PLAN full 12, quick 4),
  đáp án tính bằng số học; test tính lại độc lập 400 seed/dạng.
- ✏️ Vẽ mạng: `ui/canvas.js` (ping trên topology vẽ tay) đã xoá — người dùng chọn bỏ cấu hình/chạy ping ở đây vì đã có Lab CLI.
  Mới: `lab/diagram.js` (hình, dây, nhóm, khoá, căn, dàn đều, copy/paste, history, SVG, JSON, mẫu) + `ui/diagram.js` + test `tests/diagram.test.js`.
  `scenarios/graphsim.js` vẫn giữ (có test riêng, có thể dùng lại sau).
- Cổng app mặc định giờ là 8008 (`Mở-Packet-Journey.bat`).

## ✅ Bổ sung theo CCNA 200-301 (2026-10-28)
- So với sách lab CCNA (bản 2017): thêm các chủ đề đề 200-301 còn thiếu. Lab N01–N08 ở `lab/labs-n200.js` (nhóm `n2`).
- `lab/ios.js`: LLDP (`d.lldpRun`, cổng `lldpTx/lldpRx`, show lldp*), `ip ospf network {point-to-point|broadcast}` (`f.ospfNet`),
  `show ip ospf interface [<if>]`, `ip route … name X` (`r.name`), SNMP (gọi `lab/snmp.js`), ACL IPv6 (mode `acl6`, gọi `lab/acl6.js`,
  cổng `f.ipv6Filter = {in,out}`), luật VLAN mở rộng trong `vlanEnter`/`vtpMode`, `config-register` (`d.confregNext` → `d.confreg`
  khi reload; bit 0x40 = bỏ qua startup-config), `power-cycle` (lệnh lab), `send break` trong `d.bootWin` → ROMMON người dùng
  (`d.rommonUser`, `rommonExec`: confreg/reset/boot/dir/?), `copy startup-config running-config` (`copyStartRun`: gộp, giữ shutdown).
- `lab/net.js`: OSPF `ntype` mỗi cổng; lệch kiểu → adjacency có `mismatch`, bị loại khỏi SPF. `lab/net6.js`: `walk6` lọc ACL IPv6
  in/out (gói router tự phát không lọc out), `ping6` chuẩn hoá địa chỉ, `{record}` để đếm match.
- `lab/breaker.js`: thêm lỗi IPv6 (no ipv6 unicast-routing, cổng chỉ-IPv6 shutdown, gỡ traffic-filter). `lab/weak.js`: chủ đề SNMP/LLDP/ROMMON.
- UI: Ctrl+Break (phím Pause) trong console lab và workspace gửi `send break`. Test `tests/n200.test.js`.
- Chưa làm (ngoài 200-301 hoặc tuỳ chọn): RIPv2, EIGRP nâng cao (summary, topology, EIGRPv6), MLPPP, PPPoE, IP SLA, 802.1X đầy đủ.

## ✅ Việc 6–11 (xong 2026-10-27, làm tại máy sau khi cloud hết credit)
- **6 xuất/nạp cấu hình**: đã có từ trước (`lab/configio.js`); kiểm lại trên trình duyệt — thanh công cụ workspace xuống 2 dòng
  ở màn hình 1024px là bình thường (nhiều nút), không che sơ đồ.
- **7 thư viện + .unl**: `lab/labstore.js` (hàm thuần, UI lưu `pj_sandbox-lib`, lab đang mở `pj_sandbox-libcur`),
  `lab/unl.js` (`parseUnl` XML tối giản chạy cả Node, `unlToSandbox`, `applyUnlConfigs` = bật tạm → importConfigs →
  saveAllStartup → tắt lại, `sandboxToUnl`). Đổi tên cổng EVE trong config bằng `rewriteIfs`. Test `tests/library.test.js`.
- **8 chú thích + dây**: `net.notes` (sandbox.js: `addNote/updateNote/removeNote/normNotes`, history snapshot gồm notes,
  `importSandbox` giữ notes). Vẽ ở `drawNotes` (workspace.js) — khung/elip nằm dưới dây, chữ/mũi tên trên dây.
  CSS `.lab-link.off` (thiết bị tắt), `.down` đỏ chấm, `.serial`. Sửa lỗi `physPorts` lọc nhầm `port1` (FortiGate/Sophos).
- **9 ghi chú + cheat sheet**: ghi chú `pj_labnote:<id>`, ⭐ `pj_lab-star`, nút lọc ⭐; `lab/cheat.js` (`describe` dùng
  `DESC` export từ ios.js, `buildCheat` từ `weak.cmds`, `miniMd`), `ui/cheat.js` (in bằng `body.cs-printing` + @media print).
- **10 so sánh + chẩn đoán**: `lab/cfgdiff.js` (`cfgItems` theo khối, bảng `EQUIV` ghi chú hai cách đều đúng),
  `lab/diagnose.js` (L1 → host → L2 resolve → sendPacket, phân loại theo `fail.kind`, 3 mức gợi ý). UI trong `ui/lab.js`
  (`diagHtml`, `diffHtml`). Test `tests/diag.test.js`.
- **11 thi thử CCNA**: `lab/ccna-exam.js` (BANK 100 câu tự soạn, SIMS 4 lab, `makeExam` seed + xáo, `quota` chia tỉ lệ,
  `gradeExam` thang 300–1000), `ui/exam.js` (bài dở `pj_ccna-exam-cur`, lịch sử `pj_ccna-exam-hist`). Test `tests/exam.test.js`.
- Muốn mở rộng: thêm câu vào BANK giữ đúng số câu mỗi mảng = tỉ trọng (test kiểm), hoặc đổi test nếu muốn ngân hàng lớn hơn.

## 🐧 VPCS cho PC (2026-10-27, việc 5/11)
- `lab/ios.js` `vpcsExec` khi `d.shell === 'vpcs'` (prompt `PC1> `); PC không có cờ → `pcExec` kiểu Windows như cũ.
  `save` lưu `d.vpcsSaved`; `S.wipeDevice` nạp lại. VPCS không có telnet/ssh (như thật) — cần thì đổi shell.
- `lab/sandbox.js`: kind `pc` tạo với `shell: 'vpcs'`; boot log VPCS. Workspace: menu chuột phải PC đổi shell;
  capture lặp 5 gói cho ping VPCS. Test sandbox/capture đã đổi sang cú pháp VPCS (test trunk capture giữ Windows vì telnet).

## ⏱ Thời gian hội tụ thật + log IOS (2026-10-27, việc 4/11)
- `lab/net.js` (cuối file): `net.clock` tuỳ chọn. Không có → tức thì như cũ (mọi test cũ, breaker, chấm điểm).
  `phaseOf(net, key, kind, meta)` = pha theo tuổi của mục (`PHASES`: stp/rstp/ospf/eigrp/bgp/hsrp/vrrp). Chỗ chặn:
  `stpState` (FWD → LSN/LRN, `stpBlockedFn` coi khác FWD là chặn; PortFast cổng không nối switch thì bỏ qua), `ospfAll`
  (SPF dùng `adjUp` — chỉ láng giềng đã FULL; `ospfNeighbors` hiện pha), `eigrpAll` (adj chờ 5 s), `bgpAll` (state),
  `fhrpActives` (thành viên còn Listen/Speak không được bầu; ghi `role` để log failover). `fhrpPhase` cho show standby.
- `attachClock` (hiện trạng = đã hội tụ), `clockSync(net, quietDev)` = quét toàn mạng (`clockSweep`) → mục mới
  since = t, mục mất → log down; `clockTick(net, dt)` → log qua mốc pha (in đủ từng bước kể cả tick lớn) rồi sync;
  `clockConverge` ("⚡ Hội tụ ngay"); `logPush`/`drainLogs` (buffer `d.logBuf` cho show logging + hàng đợi console);
  `withoutClock` (checkLab dùng). `cloneNet` bỏ `clock`; `exportSandbox` bỏ `logBuf`.
- `lab/ios.js`: exec → `clockSync(net, id)` + nối log đang chờ của thiết bị vào output; khi có đồng hồ thì `diffSnap`
  không in log OSPF/EIGRP/BGP/HSRP (đồng hồ in đúng lúc). `%SYS-5-CONFIG_I` khi rời chế độ cấu hình. Lệnh debug/
  show logging/clear logging/logging synchronous. HSRP log đổi sang `%HSRP-5-STATECHANGE` (khi có đồng hồ).
- `ui/clock.js` (thanh tốc độ, `clockStep`, `pullLogs`) dùng ở `ui/lab.js` (dưới tab thiết bị) và `ui/workspace.js`
  (góc trên trái khung sơ đồ). Tốc độ lưu `pj_clock-speed` (mặc định ×5). Chưa làm: hold-timer khi Active chết
  (Standby lên ngay chứ không chờ 10 s), DR wait timer 40 s.

## 📊 Điểm yếu của tôi (2026-10-27, việc 3/11)
- `lab/weak.js`: `TOPICS` (regex) → `labTopics(lab)` (ưu tiên `lab.topics`; đã thêm `topics` cho T01/T05/T06/P01/X04/B02),
  `taskTopics`, `cmdTopic(cmd|spec)`, `cmdError(out)`. Reducer `recordCmd` (lệnh sai → `errs[lệnh]` kèm `sug`; lệnh
  đúng → `cmds["mode|spec"]` — nguồn cho cheat sheet việc 9) và `recordLab(type: hint|sol|fail|quiz|done|time)`.
  `topicScores(w, {subnet, breaks, labOf})`: điểm Laplace (tốt+1)/(tốt+xấu+2), trọng số ở `GOOD`/`BAD`, < 3 bằng chứng → null.
  `recommend(scores, LABS, done)` 3–5 lab; `breakLabFor(topic)`.
- `lab/ios.js`: `exec` trả thêm `spec` (mẫu lệnh đã khớp); `cli.suggest(dev, line)` xếp mẫu lệnh theo số từ khớp, thử mọi
  chế độ (đánh dấu `here:false` khi sai chế độ), sửa chính tả từ đầu (edit distance ≤ 2).
- `ui/lab.js` ghi: lệnh tự gõ/dán (không ghi mật khẩu, `?`, lệnh mẫu; lệnh của đề 🎲 tính cho lab gốc), gợi ý, lời giải
  (+ nhiệm vụ chưa đạt → fail), quiz (lần chọn đầu), nộp thi thử (fail), xong lab (done; > độ khó × 15 phút → slow),
  thời gian (cộng khi đổi lab / đóng). `ui/quiz.js` ghi quiz kịch bản. `openLab(onRun, {labId, breakLab})`.

## 🧮 Luyện subnet vô hạn (2026-10-27, việc 2/11 — phiên "SAP PROMPT App Hoc Mang")
- `lab/subnet.js` thuần logic: `generate(kind|'mix', level, rng)` → `{kind, level, text, fields:[[key,label]], ans, data}`;
  `grade(q, input)` chuẩn hoá cách gõ (prefix "26" = "/26", "1.022" = 1022, có/không/khong/k/no…), VLSM chấm theo luật
  (prefix tối thiểu, căn biên, không chồng lấn, trong khối) chứ không so phương án mẫu `vlsmPlan`; `explain(q)` trả các
  dòng giải; `addStat`/`statRows` thống kê; `makeRun(level, seed)` bộ 10 câu đủ 6 dạng, xáo theo seed.
- `ui/subnet.js`: modal, lưu `subnet-opt`, `subnet-stats` {kind:{n,ok,secs}}, `subnet-runs` (50 bộ gần nhất).
  Việc 3 (điểm yếu) đọc `subnet-stats` để tính điểm chủ đề "Subnet".

## 🎲 Phá mạng ngẫu nhiên (2026-10-27, chức năng 1/3 cho người tự học — phiên "SAP PROMPT App Hoc Mang")
- `lab/breaker.js`: `solvedNet(lab)` (build + applySolution, mọi nhiệm vụ cấu hình đạt) → `faultCandidates(net)` (thư viện
  lỗi: mỗi lỗi có `brk`/`fix` là lệnh CLI, `layer`/`detail` cho gợi ý) → `makeBreak(lab, n, seed)`: xáo theo `rng(seed)`
  (mulberry32), nhận lỗi nếu tự nó làm trượt ≥ 1 nhiệm vụ, không trùng chỗ, và áp mọi `fix` thì đạt hết. Lệnh chạy qua
  CLI thật nhưng vào thẳng configure terminal (bỏ qua mật khẩu enable). Thiết bị hãng khác (d.os) không bị gài.
- Lab giả id `RB:<lab>:<số lỗi>:<seed>` (`breakLab`, cache): kind 'ticket', tasks = nhiệm vụ gốc bỏ quiz, hints 3 mức,
  solution = lệnh sửa, `breakInfo`. ui/lab.js nhận id này ở mọi chỗ (`anyLab`), không đánh dấu labs-done.
- ui/breakui.js: hộp thoại chọn lab/độ khó/seed + lịch sử. Trạng thái đề hiện tại `break-cur` {id, t0, hints, revealed,
  done}; lịch sử `break-history` (100 lượt). Điểm `breakScore`: xem đáp án = 0. A07/A12 không gài được (chỉ chấm cấu hình).
- Thêm lệnh IOS `switchport port-security mac-address <mac>` (MAC tĩnh) cho lỗi port-security.

## ☁️ Thiết bị Internet vẽ thành đám mây (2026-10-27, yêu cầu từ phiên "SAP PROMPT App Hoc Mang")
- `N.server(..., { cloud })`: cờ `cloud` (mặc định bật nếu tên chứa "INTERNET"); `N.isCloud(d)` dùng cờ, JSON cũ
  không có cờ → nhận theo tên. Chỉ đổi hình vẽ — mô phỏng vẫn là server (ping/telnet như cũ).
- Vẽ: `cloudPath(x, y)` (một path 4 cung + đáy phẳng) trong `ui/topo.js` cho Lab CLI + workspace; `ui/topology.js`
  (sơ đồ "Xem gói tin", `topologyOf` trả type 'cloud'); `linkEnd(d, tx, ty)` cắt dây ở mép đám mây (elip xấp xỉ).
- Workspace: mẫu `cloud` (nhóm "Network", tiền tố INTERNET, 1 cổng fa0); `kindOf` nhận đám mây.
- README + `.bat`: khuyên server đa luồng (ThreadingHTTPServer / `python -m http.server`).

## 📡 Capture trên dây kiểu EVE-NG + Wireshark (2026-10-27, yêu cầu từ phiên "SAP PROMPT App Hoc Mang")
- `lab/capture.js` (thuần logic): `createCapture` → `cap.links[linkId] = { on, t0, pkts, last }` (giây epoch);
  `recordSim(cap, sim, now, {repeat})` lấy sự kiện `transit` của engine có `ev.link` đang bắt (byte thật, tree);
  ping nhân 4/5 lượt bằng `serialize` lại (seq, IP ID tăng); thời gian luôn tăng dần. `tickCapture` sinh gói định kỳ
  từ cấu hình: BPDU (Designated Port, VLAN không tag), OSPF Hello (`ospfIfaces` không passive, DR/BDR, neighbors),
  EIGRP Hello, HSRP Hello (Active dùng MAC ảo) — thiết bị tắt / link down thì im lặng. `summarize` (cột Wireshark),
  `compileFilter` (giao thức, ip.addr/src/dst, tcp/udp.port, vlan.id, eth.addr, && || ! ngoặc), `capturePcap`.
- Engine: `Rec.transit` ghi thêm `link` + `capSkip`; ARP mà bảng ARP đã có thì `capSkip` (timeline vẫn minh hoạ).
- `ui/workspace.js`: cửa sổ id `cap:<linkId>` dùng chung khung với console (`showWin`), `refreshCapWin`
  (bảng, lọc, cây trường `ui/fieldtree.js` + hex `ui/hexview.js`, ⬇ .pcap), timer 1 s gọi `tickCapture`.
- Đã kiểm .pcap bằng scapy (đọc đủ record, Dot1Q/DHCP/ARP/TCP/STP, 0 lỗi checksum).

## 🧱 Workspace tự dựng mạng kiểu EVE-NG (2026-10-27, yêu cầu từ phiên "SAP PROMPT App Hoc Mang")
- `ui/workspace.js`: overlay `.ws` toàn màn hình đè lên modal Lab CLI (nút "🧱 Tự dựng mạng riêng" / mục SBX trong danh sách).
  Trạng thái module-level `W` (net, cli, undo, term/hist/gui theo thiết bị, cửa sổ console, view, boot) giữ khi đóng/mở lại.
  Canvas SVG `#ws-world` có transform translate/scale (`W.view`), giấy vẽ = `SANDBOX_VIEW` 2400×1600.
- `lab/sandbox.js`: `SANDBOX_KINDS` = mẫu theo hãng (`vendor`, `prefix`, `ports {def,min,max|choices,names(n)}`, `make(id,name,x,y,cổng[])`),
  `SANDBOX_VENDORS`, `addDevice(net,kind,x,y,{prefix,ports,off})`, `addNodes` (hộp thoại Add node), `freeSpotNear`,
  `portNames/portCount/portCountOf/kindOf`, `startDevice` (trả log khởi động) / `stopDevice` (xoá bảng động, giữ cấu hình) /
  `powerAll` / `wipeDevice` (giữ id/tên/vị trí/cổng → dây còn, để TẮT). File JSON cũ không có `off`/`kind` → đang chạy.
- Engine: `d.off` → `physAdminUp`/`ifUp` false (link down); ios.js `exec` từ chối lệnh, `complete` null khi tắt.
- `ui/topo.js`: `drawGlyph`, `stpBlocked`, `adminUp`, `classifyLine`, `el`, `esc` dùng chung lab.js + workspace.js.
  ui/lab.js không còn code sandbox (lab thường giữ nguyên).
- Test: tests/sandbox.test.js (+3 test workspace), tools/ui-smoke.cjs mục 4 + 6 viết lại cho workspace.

## 🛡️ ĐANG LÀM: Bảo mật & Firewall (đợt 4, 2026-10-27) — kế hoạch 6 giai đoạn user đã duyệt
1. ✅ Lõi firewall stateful `lab/fw.js` (kind asa / zbf / policy; phiên stateful theo ctx; firewall xét ACL in SAU NAT;
   `firewall(id,name,x,y,ifs,os)` trong net.js; tests/fw.test.js).
2. ✅ Cisco ASA `lab/asa.js` (dialect riêng, gắn vào ios.js qua `d.os === 'asa'`) + lab F01–F04.
3. ✅ Zone-Based Firewall trong ios.js (mode zone/cmapi/pmapi/pmapic/zpair) + lab Z01–Z03.
4. ✅ FortiGate `lab/fortios.js` (FG01–02) + Palo Alto `lab/panos.js` (PA01–02, commit, pre-NAT IP/post-NAT zone) — kind
   'policy'. Sophos / Check Point / pfSense dạng GUI web: logic `lab/guifw.js` (d.os sophos|checkpoint|pfsense, "lệnh
   thao tác" `if/gw/obj/svc/rule/nat/outbound/install/apply/show`, cand/live cho CP + pfSense), trang web `ui/guifw.js`
   (ui/lab.js ẩn console, hiện #lab-gui) + lab SP01–02, CP01–02, PF01–02. Token `key="a b"` giữ 1 từ (pfSense "LAN net").
5. ✅ Bảo mật L2 + thiết bị (`lab/labs-l2sec.js`, nhóm `l2s`, S01–S06; tests/l2sec.test.js):
   - DHCP: mọi server trong miền quảng bá là ứng viên, máy trạm lấy OFFER đầu tiên (thứ tự flood) → DHCP giả "thắng";
     snooping loại OFFER vào cổng untrusted; ACK ghi `sw.snoop.bindings` {mac, ip, vlan, port}; /release xoá binding.
   - `ip source binding` → `sw.snoop.statics`; `snoopBindings(sw)` = cả hai, dùng cho DAI + IPSG.
   - DAI trong `deliverL2` (net.js): ARP Request (bên hỏi) + Reply (bên trả lời) vào cổng untrusted của VLAN có DAI
     phải khớp binding; `daiTrust` per-port; `daiStats` + `secLog` (show logging). IPSG (`ports.ipsg`): gói IP vào cổng
     phải có IP nguồn = binding của chính cổng đó.
   - SSH hỏi mật khẩu thật (`s.pw = 'ssh'`, cả PC lẫn IOS); `login block-for` (`d.loginSec`, đồng hồ `N.clock` thay được
     trong test), quiet-mode access-class; `aaa new-model` thay "login local"; `security passwords min-length`;
     `ip http server` mở cổng 80; `exec-timeout`, `ip ssh version` lưu và hiện trong running-config.
6. ⏳ Kịch bản tấn công byte-thật (ARP spoofing, DHCP giả/starvation, VLAN hopping) trong scenarios/.
- Tổng hiện tại: 101 lab, `node --test` 253/253, `node tools/ui-smoke.cjs` 78/78; workspace tự dựng mạng kiểu EVE-NG + capture; phá mạng ngẫu nhiên; luyện subnet; điểm yếu; đồng hồ hội tụ + log IOS; VPCS.


## ✅ ĐÃ XONG Lab CLI đợt 3 (session 2026-10-27/28) — 7 cải tiến
- **Cách giải báo nhiệm vụ vừa đạt** (`withGain` trong `ui/lab.js`): sau "▶ Gõ bước này"/"Gõ lời giải" hiện bước đó làm
  đạt nhiệm vụ nào; nhiệm vụ mới chuyển xanh nháy sáng (so với lần chấm trước, cả khi gõ tay).
- **Tìm/lọc lab**: `labMatch`/`fold` (lab/labs.js, không dấu, AND nhiều từ khoá), lọc Tất cả/Chưa xong/Đã xong
  (`pj_lab-filter`), tiến độ từng nhóm.
- **⏱ Thi thử**: `examMinutes`/`examResult` (lab/labs.js); lab làm lại từ đầu, ẩn gợi ý/lời giải/cách giải/giải thích/
  trạng thái nhiệm vụ (cả dấu ✓ ở danh sách), hết giờ tự nộp, kỷ lục `pj_labexam-best`.
- **Sandbox**: `renameDevice`, `duplicateDevice`, `createHistory` (undo/redo — trong session là `s.undo`, KHÔNG nhầm với
  `s.hist` = lịch sử lệnh ↑/↓; từng trùng tên gây lỗi console ở lab thường, đã sửa), `SANDBOX_TEMPLATES` (5 mạng mẫu).
- **5 lab chuyên đề** `lab/labs-adv.js` (nhóm `adv`): D01 VTP, D02 PVLAN + DHCP, D03 IPsec từ đầu, D04 BGP, D05 STP.
- **STP thật** (`stpState` trong lab/net.js): root/root port/designated/BLK theo VLAN, cost 1G=4/100M=19/EtherChannel;
  `flood` bỏ frame vào/ra cổng BLK; `show spanning-tree` dùng chung; topology đánh dấu ✕. Đã kiểm X01/X04 vẫn đạt.
- **IPv6** `lab/ip6.js` (địa chỉ, nén, EUI-64) + `lab/net6.js` (routeTable6 C/L/S/O/OI, OSPFv3 cần router-id hoặc IPv4,
  ping6 2 chiều qua flood L2, SLAAC cần `ipv6 unicast-routing`); CLI: `ipv6 address [eui-64|link-local]`, `ipv6 enable`,
  `ipv6 ospf P area A`, `ipv6 router ospf`, `ipv6 route`, `show ipv6 interface brief|route|ospf neighbor`, `ping <IPv6>`;
  PC: `ipv6config <IPv6>/<p> [gw]`, `ipv6config autoconfig`. Lab **X05** dual-stack. Ping IPv6 chưa có "▶ Xem gói tin".
- **Sửa engine**: BGP dùng `update-source`; gói router tự phát dùng ICMP id riêng (tránh PAT dịch nhầm gói trả lời);
  redistribute ospf→eigrp mang cả O E2/O*E2 (từ đợt 2).
- **Kiểm tra**: `node --test` **170/170 pass**; `node tools/ui-smoke.cjs` (Playwright) 13/13 PASS, 0 lỗi JS.
- Tổng: **78 lab**.

### Còn có thể làm tiếp (tuỳ chọn)
- Ping/traceroute IPv6 có timeline byte-thật ("▶ Xem gói tin") — protocols ipv6/icmpv6 đã có sẵn ở `protocols/`.
- IPv6 trên switch L3 (SVI), DHCPv6, ACL IPv6, OSPFv3 default-information originate.
- STP: RSTP (hội tụ nhanh) / MST theo instance trong forwarding (hiện MST chỉ ảnh hưởng priority).


## ✅ ĐÃ XONG Lab CLI đợt 2 (session 2026-10-27 #2) — CCNA + capstone + UI mới
- **41 lab CCNA** (`lab/labs-ccna.js`, A01–A26 · B01–B10 · C01–C05) đã chạy test lần đầu: tất cả đạt, tên field
  trong check khớp `lab/net.js`/`lab/ios.js` (cdpRun, ports[x].cdp, lines.vty.accessClass, stp.prio/bpduDefault,
  ps.viol, startupCfg, version, crypto.keys/tsets, cryptoMap, l2enc, pppAuth, encap, native, helper, nat.*, routes[].nh).
- `tests/lab.test.js` giờ chạy lời giải qua `applySolution(lab, net, cli)` (hỗ trợ `solution`, `guide`, bước `'@link'`)
  và chấm bằng `checkLab(lab, net, quizAnswers(lab))`. Điều kiện "trước khi giải" chấm VỚI đáp án quiz đúng → buộc
  phải có ít nhất 1 nhiệm vụ CẤU HÌNH trượt (quiz không tính).
- **4 lab capstone** (`lab/labs-capstone.js`, group `'cap'`, đều dùng `guide`): X01 campus 3 lớp, X02 HQ + 2 chi
  nhánh (PPP CHAP/GRE/OSPF đa vùng/DHCP relay/NAT), X03 sáp nhập (OSPF↔EIGRP, dual-ISP eBGP, HSRP track, NAT),
  X04 troubleshooting 9 lỗi. Đã thử bỏ từng bước guide → bước nào cũng làm ít nhất 1 nhiệm vụ trượt.
- **Engine** (`lab/net.js` `eigrpExt`): `redistribute ospf` vào EIGRP giờ mang MỌI route OSPF trong bảng (kể cả
  O E2 và default O*E2) như IOS thật — cần cho X03 (công ty B ra Internet qua default từ OSPF).
- **`lab/sandbox.js`** (mới): thêm/xoá thiết bị, nối/gỡ dây, xuất/nhập JSON, `SANDBOX_LAB` (6 nhiệm vụ gợi ý).
  Test `tests/sandbox.test.js`.
- **`ui/lab.js`** viết lại phần lớn: quiz thành nút (lưu `pj_labans:<id>`), panel "🧭 Cách giải chi tiết" (bước
  không có title được gộp vào bước trước; nút "▶ Gõ bước này"), "▶ Gõ lời giải" dùng `applySolution`, đáp án
  quiz trong lời giải, `lessonPath`/`lesson` tuỳ chọn, thanh công cụ 🔗 Nối dây / ✂ Gỡ dây (lab `edit:'wire'` + sandbox),
  log khôi phục có `['@link', [a,ap,b,bp]]` / `['@unlink', linkId]`, chế độ 🧱 sandbox (thêm PC/Server/2960/3560/Router,
  kéo thả, xoá, xuất/nhập JSON, lưu `pj_sandbox-net`). CSS mới ở `styles/app.css` (khối "Lab: …").
- Đã chạy thật bằng Chromium (Playwright): quiz, guide, gõ lời giải (B02 5/5, X04 10/10), nối dây A04 + khôi phục sau
  reload, sandbox (thêm/nối/kéo/ping/xuất/nhập/xoá/gỡ dây/reload), màn 390px không tràn ngang, 0 lỗi console.
- Tổng: **72 lab**, `node --test` **153/153 pass**.

(Các mục "còn lại" của đợt 2 — undo/đổi tên sandbox, X05 IPv6, STP blocking — đã làm ở đợt 3, xem trên.)


## ✅ ĐÃ XONG (session 2026-10-xx)
- **Link "Đọc thêm" → HTML giáo trình**: sửa tập trung ở `ui/i18n.js` `lessonHref()` — tự đổi
  `.../Bai-NN_*.md` sang `Infrastructure-Administrator-Giao-trinh.html#bNN-s0`, tách `#anchor` khỏi
  encode. KHÔNG phải sửa 12 kịch bản. Đã test: mở ra Bài 02 render đẹp, tiếng Việt đúng.
- **Fix UTF-8 server**: tạo `E:\SAP\serve.py` (ép charset=utf-8); `Mở-Packet-Journey.bat` giờ gọi
  `python serve.py 8000`. Đã test: hết mojibake.
- **Bố cục 3 cột**: `index.html` + `styles/app.css` (`.cols3`) — layerstack TRÁI, topology GIỮA,
  timeline PHẢI, "Chi tiết gói" full-width BÊN DƯỚI. Responsive: ≤960px timeline xuống dưới, ≤680px xếp dọc.
  Đã test vị trí 3 cột đúng ở 1024px. 43/43 test vẫn pass.

## 🔭 CÒN LẠI (ưu tiên trên xuống)
- **Giao diện giống site tham khảo** (hainguyenit.site course_id=8): trang đó CÓ PHÍ, chỉ xem được
  trang bán khoá (mô tả + review), KHÔNG xem được UI mô phỏng thật → không copy trực tiếp được.
  Nếu muốn giống, cần user mô tả/đưa ảnh UI bài học của họ, hoặc tự thiết kế đẹp hơn.

---

## 🐞 Bug cần sửa: link "Đọc thêm" mở .md bị lỗi tiếng Việt (mojibake)
Hiện tượng: bấm link bài học → chữ vỡ kiểu `BÃ i 2`, `MÃ´ hÃ¬nh OSI`.
Nguyên nhân: `python -m http.server` trả file `.md` KHÔNG kèm `charset=utf-8` → trình duyệt đọc
nhầm sang Windows-1252. (File gốc vẫn đúng UTF-8.)

**Cách sửa:** tạo `E:\SAP\serve.py` rồi chạy `python serve.py 8000` (thay cho `http.server`),
và sửa `Mở-Packet-Journey.bat` gọi `serve.py`:
```python
import http.server, socketserver, sys
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.md': 'text/plain; charset=utf-8',
                      '.txt': 'text/plain; charset=utf-8',
                      '.html': 'text/html; charset=utf-8',
                      '.js':  'text/javascript; charset=utf-8',
                      '.json':'application/json; charset=utf-8'}
with socketserver.TCPServer(('127.0.0.1', PORT), H) as httpd:
    print(f'Serving E:/SAP on http://127.0.0.1:{PORT}'); httpd.serve_forever()
```
**CÁCH TỐT NHẤT (user chốt): trỏ "Đọc thêm" sang file HTML giáo trình đã build, KHÔNG dùng .md thô.**
File có sẵn:
- Infra: `../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Infrastructure-Administrator-Giao-trinh.html`
  (có cả bản nhẹ `..._nhe.html`)
- Network security: `../Network security/Network-Security-Giao-trinh.html`

HTML là file ĐƠN có sidebar, mỗi bài là một section với **anchor `#bNN-s0`** (bNN = số bài 2 chữ số,
s0 = section đầu). Ví dụ Bài 02 → `#b02-s0`, Bài 14 → `#b14-s0`.

→ Việc cần làm: trong từng `scenarios/sNN-*.js`, đổi `lesson.path` từ `.../Bai-02_...md` thành
`../.../Infrastructure-Administrator-Giao-trinh.html#b02-s0`. Nhớ: `lessonHref()` trong `ui/i18n.js`
encode từng đoạn path — phải CHỪA phần `#b02-s0` không bị encode (hiện split theo '/', anchor nằm ở
đoạn cuối nên dấu `#` sẽ bị encodeURIComponent làm hỏng → cần sửa `lessonHref` tách anchor ra trước khi encode).
Làm xong thì hết cả lỗi mojibake LẪN chuyện hiện markdown thô, lại render đẹp.



## ⭐ Việc ưu tiên: đổi bố cục màn hình học (user yêu cầu 2026-10-26)

Bố cục MỚI mong muốn: **3 cột ngang**
- **Trái**: Ngăn xếp tầng (layer stack)
- **Giữa**: Topology (sơ đồ mạng + bảng ARP/MAC/routing/NAT)
- **Phải**: Timeline (điều khiển ▶ ◀ + danh sách bước)

Bố cục HIỆN TẠI (cần sửa) trong `index.html`:
- Hàng 1: topology (full width)
- Hàng 2: timeline `#controls` (full width)
- Hàng 3: `.cols` = [layer-stack | packet-detail] (2 cột)

### Cách làm (gợi ý)
- Trong `index.html`: gom 3 vùng vào một grid 3 cột:
  `grid-template-columns: 230px 1fr 340px` → `#layer-stack` | topology panel | `#controls`.
- **Chi tiết gói (tabs Cây trường/Hex/Giải thích)**: yêu cầu của user KHÔNG nhắc tới panel này.
  → Hỏi lại user, hoặc mặc định đặt **full width BÊN DƯỚI 3 cột** (dễ đọc hex). Đừng để mất panel này.
- `styles/app.css`: sửa `.cols` (hiện 2 cột) thành layout 3 cột; thêm `@media (max-width: 980px)` cho
  xếp dọc lại trên màn nhỏ.
- Topology ở giữa hẹp hơn full-width → kiểm lại `viewBox` các kịch bản (một số dùng `0 0 1000 340`)
  có bị chật không; SVG tự co theo width nên thường ổn, chỉ cần nhìn lại s05/s07 (triangle, nhiều node).
- Nhớ cập nhật `HƯỚNG-DẪN-TẠO-APP.md` phần mô tả bố cục.

---

## 🎨 Reference giao diện user muốn tham khảo (2026-10-26)
User gửi: **https://hainguyenit.site/khoahoc/course_content.php?course_id=8** — "sao không làm giống này".
→ Lần sau MỞ trang này (browser pane), xem nó trình bày khoá học/bài học thế nào rồi mô phỏng cho
Packet Journey (có thể là trang danh sách bài + trình xem nội dung, hoặc tổng thể look & feel).
Cần hỏi user: muốn giống ở điểm nào — bố cục xem bài, sidebar chương/bài, hay toàn bộ phong cách?

## Trạng thái hiện tại (chốt tại 2026-10-26)
- **12 kịch bản** (s01–s12): ping, VLAN, trunk, STP, inter-VLAN, OSPF, EIGRP, DHCP, DNS, NAT, ACL.
- **12 giao thức** dựng byte thật: ethernet, dot1q, arp, ipv4, icmp, llc, stp, ospf, eigrp, udp, dhcp, dns.
- **43/43 unit test pass** (`node --test`). Đã xem trực tiếp s01–s08, s11; s09/s10/s12 mới kiểm qua test.
- UI: topology icon thật + animation, timeline, layer stack, field tree, hex 2 chiều, bảng thiết bị,
  song ngữ VI/EN, sáng/tối, xuất .pcap, link 📖 sang vault.

## ✅ ĐÃ XONG batch cuối (session 2026-10-xx #2)
- Protocol mới: **TCP, HSRP, BGP, raw** (payload mảnh). serialize checksum 'transport' đã dùng cho TCP.
- Kịch bản mới: **s13 HSRP, s14 TCP 3-way, s15 traceroute, s16 fragmentation, s17 BGP eBGP, s18 OSPF multi-area**.
- Tổng: **18 kịch bản, 16 protocol, 49/49 test pass**. Đã sweep cả 18 kịch bản trong trình duyệt: render OK, 0 lỗi console.

## ✅ ĐÃ XONG CCNP + học chủ động (session #3)
- **CCNP**: s19 RSTP (reuse stp BPDU v2/type2 + flags), s20 QoS/DSCP, s21 redistribution OSPF↔EIGRP.
- **Học chủ động**: 🎯 Quiz (`ui/quiz.js` modal, chấm điểm + lưu kỷ lục localStorage; nội dung ở `scenarios/quizzes.js`);
  🤔 Đoán bước (toggle; step có `decision:{question,options,correct,explainVi}` → hỏi trước, lộ giải thích sau — ở `ui/explain.js`);
  🔧 2 kịch bản sửa lỗi s22 (sai gateway) + s23 (sai VLAN cổng).
- Tổng: **23 kịch bản, 16 protocol, 49/49 test pass**. Verify trình duyệt: sweep 23 OK, quiz + đoán bước chạy đúng, 0 lỗi console.

## ✅ ĐÃ XONG nốt tính năng học (session #4)
- 📘 **Từ điển**: `i18n/glossary.js` (25 thuật ngữ + bảng port + OSI map) + `ui/glossary.js` (modal có tìm kiếm).
- 💾 **Tiến độ**: `ui/progress.js` (modal: kịch bản đã xem ✓ + điểm quiz + xuất/nhập .json); `ui/store.js` thêm markDone/exportAll/importAll; app markDone khi tới bước cuối.
- **PWA offline**: `manifest.webmanifest` + `icon.svg` + `sw.js` (network-first, cache fallback) + đăng ký trong `app.js`.
- **Dev**: `serve.py` thêm `Cache-Control: no-store` (trừ sw.js) để reload luôn lấy file mới.

⚠️ LƯU Ý: Service Worker KHÔNG đăng ký được trong browser pane của Claude (webview nhúng chặn SW) →
console báo "unknown error fetching the script". Đây là giới hạn môi trường, KHÔNG phải lỗi code —
sw.js hợp lệ (200, đúng MIME, secure context). Trên Chrome/Edge thật sẽ cài + offline bình thường.

## ✅ ĐÃ XONG M5 Builder (session #5)
- 🛠️ **Tự tạo kịch bản**: `scenarios/builder.js` (`buildCustom(params)` dựng sim từ IP/mask/gateway) +
  `ui/builder.js` (form modal có mẫu nhanh same/cross/badgw) + nút header `btn-builder` + `loadCustom` trong app.js.
- Logic đúng 3 ca: cùng mạng (ARP trực tiếp, OK), khác mạng + GW đúng (định tuyến qua R1, TTL−1, OK),
  sai/thiếu GW (ARP gateway không hồi đáp → ping HỎNG). Đã verify cả 3 mẫu trong trình duyệt.

## ✅ ĐÃ XONG Canvas kéo-thả (session #6) — HOÀN TẤT M5
- `scenarios/graphsim.js` `simulateGraph(devices, links, srcId, dstId)`: BFS tìm đường + mô phỏng ping
  trên topology bất kỳ (host quyết định cùng/khác mạng, switch pass-through, router TTL−1 + viết lại MAC),
  trả {topology,events,pcap} hoặc {error}. Có test `tests/graphsim.test.js` (5 ca).
- `ui/canvas.js`: modal kéo-thả — thêm PC/Switch/Router, 4 chế độ (Di chuyển/Nối dây/Cấu hình/Xoá),
  cấu hình IP/prefix/gateway (router: IP từng cổng theo neighbor), chọn 2 PC → Chạy ping → `loadSimResult` trong app.js.
- Nút header `btn-canvas` "✏️ Vẽ mạng". Đã verify: seed 2PC+switch, cấu hình IP, chạy → 7 bước ping cùng mạng OK.

→ **App đã phủ TRỌN spec gốc M1–M5 + chế độ học chủ động.** 54/54 test pass.

## ✅ ĐÃ XONG chuyên sâu (session #7)
- Protocol mới: **ipv6** (40B, no checksum), **icmpv6** (NDP NS/NA 135/136 + Echo, checksum pseudo-header v6),
  **ospfv3** (Hello, checksum v6), **mstp** (phần mở rộng MST đầy đủ: region/digest/CIST/MSTI). 20 protocol tổng.
- Nền: `addr.js` thêm parseIpv6/ipv6ToString; `checksum.js` thêm pseudoHeaderV6/transportChecksum6;
  `serialize.js` thêm chế độ checksum `'transport6'`.
- Kịch bản: **s24 MST** (region + 2 MSTI cân tải), **s25 QoS nâng cao** (DSCP+CoS/PCP, PHB EF/AF/CS, LLQ/CBWFQ/WRED, policing/shaping),
  **s26 IPv6 + NDP** (NS/NA thay ARP + ICMPv6 Echo), **s27 OSPFv3** (Hello trên IPv6, link-local, so khác v2).
- Test `tests/advanced6.test.js` (6 ca). Tổng **60/60 test pass, 27 kịch bản**. Verify trình duyệt: sweep 27 OK, IPv6 field tree đúng (Ethernet/IPv6/ICMPv6), 0 lỗi app.

## ✅ Quiz đủ 27/27 kịch bản (session #8)
- `scenarios/quizzes.js`: nay có quiz cho TẤT CẢ s01–s27 (87 câu). Đã verify mở quiz chạy đúng.

## ✅ ĐÃ XONG SLAAC & DHCPv6 (session #9)
- icmpv6.js: thêm Router Solicitation (133) + Router Advertisement (134) với Prefix Information + cờ M/O.
- dhcpv6.js mới (UDP 546/547): msg-type + xid + options (Client/Server ID, IA_NA + IA Address).
- serialize `'transport'` nay TỰ NHẬN IPv4/IPv6 → UDP/TCP checksum đúng trên cả hai (DHCPv6 cần v6).
- Kịch bản **s28 SLAAC & DHCPv6**: RS/RA → SLAAC (tự sinh + DAD) và nhánh DHCPv6 (Solicit/Advertise/Request/Reply). Quiz 5 câu.
- Test `tests/dhcpv6.test.js`. Tổng **28 kịch bản, 21 protocol, 64/64 test pass, quiz 28/28 bài (92 câu)**.

## ✅ ĐÃ XONG MPLS + VXLAN (session #10)
- Protocol mới: **mpls** (label stack 4B, EtherType 0x8847, S bit) + **vxlan** (header 8B, UDP 4789, VNI 24-bit).
- Kịch bản **s29 MPLS** (push/swap/pop qua PE1–P–PE2) và **s30 VXLAN** (VTEP đóng/gỡ gói, bọc nguyên khung trong — field tree 2 Ethernet + 2 IPv4). Quiz mỗi bài 4 câu.
- Test `tests/overlay.test.js`. Tổng **30 kịch bản, 23 protocol, 68/68 test pass, quiz 30/30 bài (100 câu)**.

## ✅ ĐÃ XONG Lab CLI Cisco IOS (session #11, 2026-10-27) — để giống khoá học thật
User so app với khoá hainguyenit.site → yêu cầu "càng nhiều lab càng tốt, càng giống doanh nghiệp càng tốt",
lấy bài từ giáo trình Infrastructure Administrator. Nút header **🧪 Lab CLI**.
- `lab/net.js` — máy mô phỏng mạng TÍNH TỪ CẤU HÌNH (không scripted): flood L2 theo VLAN/trunk/allowed/native/
  EtherChannel (LACP/PAgP/on), SVI; routing connected + static/floating + **OSPF** (adjacency thật: subnet/area/
  hello/passive/router-id, Dijkstra cost, O/O IA/O*E2, default-information originate) + **EIGRP** (AS, wildcard/
  classful, composite metric); ACL std/ext/named (thứ tự, implicit deny, counters); NAT PAT + static (+ proxy-ARP
  global); HSRP (bầu priority, VIP, MAC ảo, DIFFVIP); DHCP + relay + DHCP snooping; STP root (hiển thị);
  `sendPacket()` đi thật 2 chiều (ARP, TTL, NAT, ACL in/out) và ghi Sim → timeline byte-thật + pcap.
- `lab/ios.js` — CLI IOS: grammar có viết tắt + phát hiện "Ambiguous", lỗi `^` đúng cột, `?` theo ngữ cảnh, Tab
  completion, mọi mode (if/subif/range/vlan/router/dhcp/acl/line), lệnh global trong sub-mode, `do`, pipe
  include/section/begin/exclude, enable secret hỏi mật khẩu, log %LINK/%OSPF-5-ADJCHG/%DUAL/%HSRP, ~40 lệnh show
  định dạng như IOS; PC kiểu Packet Tracer (`ipconfig <ip> <mask> <gw>`, `/renew`, ping, tracert, telnet, ssh).
- `lab/labs.js` — **27 lab**: L01–L20 theo bài (B05, B07–B21, B26), T01–T06 ticket (T01–T03 = Lab tổng hợp
  CCNA 04/05/06), P01 GreenMart. Mỗi lab: init bằng chính CLI, tasks tự chấm (ping/tcp/route/whatIf...), hints,
  solution. `ui/lab.js` (modal: list, đề, topology trạng thái dây, console từng thiết bị, tasks, gợi ý, lời giải,
  ▶ Xem gói tin). Lưu `pj_lablog:<id>` (replay khi mở lại), `pj_labs-done`.
- Test `tests/lab.test.js`: mỗi lab ban đầu CHƯA đạt, chạy lời giải qua CLI thì đạt 100% + test hành vi CLI.
  Tổng **104/104 test pass**. Verify trình duyệt: chạy lời giải cả 27 lab qua UI → đều đạt, 0 lỗi JS.
- Thêm lab mới: thêm object vào `LABS` (build/init/tasks/hints/solution) — test tự kiểm lời giải.

## Các nhánh còn lại (rất tùy chọn)
1. Lab CLI: VPN nâng cao, WLC/Wireless, ASA, AAA/TACACS, Ansible chưa mô phỏng (GreenMart task 2, 12–20 phần lớn).
   (Port-security vi phạm khi cắm máy lạ ĐÃ CÓ — lab B07; IPv6/OSPFv3 và STP blocking ĐÃ CÓ từ đợt 3.)
2. DHCPv6 Prefix Delegation, QoS hierarchical (HQoS), EVPN control-plane cho VXLAN, SR-MPLS.
   → Nhưng về cơ bản app đã HOÀN TẤT: phủ trọn CCNA + CCNP + SP(MPLS) + DC(VXLAN) + IPv6.
3. **Giao diện giống site tham khảo** (hainguyenit.site) — trang đó có phí, chỉ xem được trang bán khoá.

## Cách thêm kịch bản/giao thức mới
- Protocol mới: thêm `protocols/<ten>.js` (export default có `build`, `checksum`, …) rồi đăng ký trong
  `protocols/index.js`. Checksum đặc biệt: xem `ospf.js` (hàm) và serialize `checksum: 'transport'` (UDP/TCP).
- Kịch bản mới: thêm `scenarios/sNN-*.js` (export `meta`, `build`) rồi thêm vào `scenarios/index.js`.
- Visual nâng cao: dùng `step.overlay` (đổi màu/nhãn link, badge thiết bị) và `device.color`,
  `topology.viewBox` — xem s05 (STP) và s11 (NAT table) làm mẫu.
- Luôn viết test trong `tests/` và chạy `node --test` trước khi kết luận xong.
