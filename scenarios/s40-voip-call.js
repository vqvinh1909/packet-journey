// scenarios/s40-voip-call.js
// Kịch bản 40: một cuộc gọi VoIP đầy đủ.
// Điện thoại đăng ký với tổng đài, báo hiệu SIP đi qua tổng đài, còn âm thanh RTP đi thẳng giữa hai máy.

import { Sim } from '../engine/simulate.js';

const A = { mac: '00:1a:2b:00:40:01', ip: '10.10.20.11', ext: '2001', rtp: 16384, ssrc: 0x1a2b3c4d };
const B = { mac: '00:1a:2b:00:40:02', ip: '10.20.20.22', ext: '2002', rtp: 16500, ssrc: 0x5e6f7a8b };
const PBX = { mac: '00:1a:2b:00:40:0a', ip: '10.10.50.5' };
const R1 = { mac: '00:1a:2b:00:40:0b' };
const CALL_ID = 'a84b4c76e66710@10.10.20.11';
const CS3 = 24, EF = 46;

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-02_Switching/Bai-08_Cau-hinh-va-quan-ly-VLAN.md',
  label: 'Bài 08 — VLAN (Voice VLAN)',
};

export const meta = {
  id: 's40-voip-call',
  titleVi: 'VoIP: một cuộc gọi SIP và RTP',
  titleEn: 'VoIP: a SIP and RTP call',
  descriptionVi: 'Điện thoại đăng ký với tổng đài, gọi đi, đổ chuông, nghe máy rồi kết thúc. Báo hiệu SIP đi qua tổng đài, âm thanh RTP đi thẳng giữa hai máy.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 320',
    devices: [
      { id: 'a', type: 'host', name: `IP Phone ${A.ext}`, x: 90, y: 230, color: '#2e7d5b', lines: [A.ip, 'Voice VLAN 20'] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 300, y: 230, lines: ['PoE, voice vlan 20'] },
      { id: 'r1', type: 'router', name: 'R1', x: 530, y: 230, lines: ['QoS, ưu tiên EF'] },
      { id: 'b', type: 'host', name: `IP Phone ${B.ext}`, x: 880, y: 230, color: '#2e7d5b', lines: [B.ip] },
      { id: 'pbx', type: 'host', name: 'Tổng đài IP', x: 530, y: 60, color: '#6b4fa0', lines: [PBX.ip, 'SIP proxy, registrar'] },
    ],
    links: [
      { id: 'la', a: 'a', b: 'sw' },
      { id: 'ls', a: 'sw', b: 'r1' },
      { id: 'lb', a: 'r1', b: 'b' },
      { id: 'lp', a: 'r1', b: 'pbx' },
    ],
  };
  const sim = new Sim(topology);

  // Khung ở chặng cuối của mỗi đoạn: gửi từ máy nguồn thì TTL 64, đã qua R1 thì TTL 63.
  const frame = (hopSrc, hopDst, srcIp, dstIp, ttl, dscp, sport, dport, layer) => sim.frame([
    { proto: 'ethernet', fields: { dst: hopDst.mac, src: hopSrc.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: srcIp, dst: dstIp, ttl, id: 0x4000, protocol: 17, dscp } },
    { proto: 'udp', fields: { srcPort: sport, dstPort: dport } },
    layer,
  ]);
  const sipMsg = (hopSrc, hopDst, srcIp, dstIp, ttl, f) => frame(hopSrc, hopDst, srcIp, dstIp, ttl, CS3, 5060, 5060, { proto: 'sip', fields: f });

  const from = `<sip:${A.ext}@${PBX.ip}>;tag=1928301774`;
  const to = `<sip:${B.ext}@${PBX.ip}>`;
  const toTag = `${to};tag=a6c85cf`;
  const viaA = `SIP/2.0/UDP ${A.ip}:5060;branch=z9hG4bK776asdhds`;
  const viaP = `SIP/2.0/UDP ${PBX.ip}:5060;branch=z9hG4bKnashds8`;
  const rr = `<sip:${PBX.ip};lr>`;
  const dlg = (t, cseq, extra = []) => [['From', from], ['To', t], ['Call-ID', CALL_ID], ['CSeq', cseq], ...extra];
  const OFFER = { user: A.ext, sess: 2890844526, ip: A.ip, port: A.rtp, pts: [0, 8, 18] };
  const ANSWER = { user: B.ext, sess: 2890844527, ip: B.ip, port: B.rtp, pts: [0] };

  const regs = (rows) => ({ list: { title: 'Bảng đăng ký trên tổng đài', cols: ['Số máy', 'Contact', 'Hết hạn'], rows } });
  const path = (cls, label, ...ids) => ({ links: Object.fromEntries(ids.map((id) => [id, { cls, label }])) });

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'inspect', activeLayer: 2,
    titleVi: 'Điện thoại khởi động: nhận điện và Voice VLAN',
    overlay: path('trunk', 'PoE, CDP/LLDP', 'la'),
    explanationVi: 'Switch cấp nguồn qua PoE, rồi báo VLAN thoại cho điện thoại qua CDP hoặc LLDP-MED. Điện thoại gắn thẻ VLAN 20 cho gói của nó, còn máy tính cắm phía sau vẫn ở VLAN dữ liệu. Sau đó điện thoại xin IP bằng DHCP và lấy địa chỉ tổng đài.', lesson: LESSON });

  const reg = sipMsg(A, R1, A.ip, PBX.ip, 64, { start: `REGISTER sip:${PBX.ip} SIP/2.0`, headers: [['Via', viaA], ['Max-Forwards', '70'], ...dlg(`<sip:${A.ext}@${PBX.ip}>`, '1 REGISTER', [['Contact', `<sip:${A.ext}@${A.ip}:5060>`], ['Expires', '3600']])] });
  sim.capture(reg, 'SIP REGISTER');
  sim.emit({ kind: 'transit', fromDevice: 'a', toDevice: 'r1', side: 'encap', activeLayer: 7,
    titleVi: `Máy ${A.ext} đăng ký với tổng đài`, packet: reg,
    overlay: path('trunk', 'SIP REGISTER', 'la', 'ls', 'lp'),
    explanationVi: 'SIP là giao thức dạng chữ, giống HTTP, mặc định chạy UDP 5060. Bản tin báo: số 2001 đang ở địa chỉ này. Xem cây trường để đọc từng dòng header. Thực tế lần đầu tổng đài thường trả 401 để hỏi mật khẩu.', lesson: LESSON });
  const regOk = sipMsg(R1, A, PBX.ip, A.ip, 63, { start: 'SIP/2.0 200 OK', headers: [['Via', viaA], ...dlg(`<sip:${A.ext}@${PBX.ip}>;tag=reg1`, '1 REGISTER', [['Contact', `<sip:${A.ext}@${A.ip}:5060>`], ['Expires', '3600']])] });
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'a', side: 'forward', activeLayer: 7,
    titleVi: 'Tổng đài ghi nhận, máy 2002 cũng đăng ký như vậy', packet: regOk, tables: regs([[A.ext, A.ip, '3600 s'], [B.ext, B.ip, '3600 s']]),
    overlay: path('trunk', '200 OK', 'lp', 'ls', 'la'),
    explanationVi: 'Mã trạng thái giống HTTP: 1xx đang xử lý, 2xx thành công, 3xx chuyển hướng, 4xx lỗi phía máy gọi, 5xx lỗi server, 6xx lỗi toàn cục. Nhờ bảng này, tổng đài biết số máy đang ở IP nào.', lesson: LESSON });

  const inv = sipMsg(A, R1, A.ip, PBX.ip, 64, { start: `INVITE sip:${B.ext}@${PBX.ip} SIP/2.0`, headers: [['Via', viaA], ['Max-Forwards', '70'], ...dlg(to, '1 INVITE', [['Contact', `<sip:${A.ext}@${A.ip}:5060>`]])], sdp: OFFER });
  sim.capture(inv, 'SIP INVITE, kèm SDP');
  sim.emit({ kind: 'transit', fromDevice: 'a', toDevice: 'r1', side: 'encap', activeLayer: 7,
    titleVi: 'Bấm số 2002: gửi INVITE kèm SDP', packet: inv,
    overlay: path('trunk', 'INVITE', 'la', 'ls', 'lp'),
    explanationVi: 'Xem phần SDP cuối bản tin: tôi nhận âm thanh tại 10.10.20.11 cổng 16384 và biết các codec 0 (G.711 µ-law), 8 (G.711 A-law), 18 (G.729). Đây là lời đề nghị, bên kia sẽ chọn.', lesson: LESSON });

  const trying = sipMsg(R1, A, PBX.ip, A.ip, 63, { start: 'SIP/2.0 100 Trying', headers: [['Via', viaA], ...dlg(to, '1 INVITE')] });
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'a', side: 'forward', activeLayer: 7,
    titleVi: 'Tổng đài trả 100 Trying', packet: trying,
    overlay: path('trunk', '100 Trying', 'lp', 'ls', 'la'),
    explanationVi: 'Báo đã nhận để máy gọi không gửi lại INVITE. Chạy trên UDP nên SIP tự lo gửi lại khi không có trả lời.', lesson: LESSON });

  const inv2 = sipMsg(R1, B, PBX.ip, B.ip, 63, { start: `INVITE sip:${B.ext}@${B.ip}:5060 SIP/2.0`, headers: [['Via', viaP], ['Via', viaA], ['Max-Forwards', '69'], ['Record-Route', rr], ...dlg(to, '1 INVITE', [['Contact', `<sip:${A.ext}@${A.ip}:5060>`]])], sdp: OFFER });
  sim.capture(inv2, 'INVITE tới máy được gọi');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'b', side: 'forward', activeLayer: 7,
    titleVi: 'Tổng đài tra bảng rồi chuyển INVITE sang 10.20.20.22', packet: inv2, tables: regs([[A.ext, A.ip, '3600 s'], [`${B.ext} ◀`, B.ip, '3600 s']]),
    overlay: path('trunk', 'INVITE', 'lp', 'lb'),
    explanationVi: 'Có 2 dòng Via, bản trả lời sẽ đi ngược theo đúng đường này. Max-Forwards giảm còn 69. Record-Route yêu cầu các bản tin sau vẫn đi qua tổng đài. SDP được giữ nguyên, tổng đài không xen vào âm thanh.', lesson: LESSON });

  const ringing = sipMsg(R1, A, PBX.ip, A.ip, 63, { start: 'SIP/2.0 180 Ringing', headers: [['Via', viaA], ['Record-Route', rr], ...dlg(toTag, '1 INVITE')] });
  sim.capture(ringing, 'SIP 180 Ringing');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'a', side: 'forward', activeLayer: 7,
    titleVi: 'Máy 2002 đổ chuông, người gọi nghe hồi chuông', packet: ringing,
    overlay: path('trunk', '180 Ringing', 'lb', 'lp', 'ls', 'la'),
    explanationVi: 'To giờ có tag của bên nhận. Dòng Via của tổng đài đã được bỏ đi khi đi qua nó. Máy gọi tự phát hồi chuông, chưa có RTP nào.', lesson: LESSON });

  const ok = sipMsg(R1, A, PBX.ip, A.ip, 63, { start: 'SIP/2.0 200 OK', headers: [['Via', viaA], ['Record-Route', rr], ...dlg(toTag, '1 INVITE', [['Contact', `<sip:${B.ext}@${B.ip}:5060>`]])], sdp: ANSWER });
  sim.capture(ok, 'SIP 200 OK, kèm SDP');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'a', side: 'forward', activeLayer: 7,
    titleVi: 'Nghe máy: 200 OK chọn codec G.711', packet: ok,
    overlay: path('trunk', '200 OK', 'lb', 'lp', 'ls', 'la'),
    explanationVi: 'SDP trả lời chốt: tôi nhận tại 10.20.20.22 cổng 16500 và chọn codec 0. Hai bên đã biết IP và cổng của nhau. Cách đề nghị và trả lời này gọi là offer/answer.', lesson: LESSON });

  const ack = sipMsg(A, R1, A.ip, PBX.ip, 64, { start: `ACK sip:${B.ext}@${B.ip}:5060 SIP/2.0`, headers: [['Via', `SIP/2.0/UDP ${A.ip}:5060;branch=z9hG4bK776asdhd2`], ['Max-Forwards', '70'], ['Route', rr], ...dlg(toTag, '1 ACK')] });
  sim.emit({ kind: 'transit', fromDevice: 'a', toDevice: 'r1', side: 'encap', activeLayer: 7,
    titleVi: 'ACK: bắt tay 3 bước của SIP hoàn tất', packet: ack,
    overlay: path('trunk', 'ACK', 'la', 'ls', 'lp', 'lb'),
    explanationVi: 'INVITE, 200 OK, ACK. Báo hiệu đánh dấu DSCP CS3 (24), mức thấp hơn âm thanh vì chịu được trễ hơn. Nếu tường lửa hoặc NAT sai ở bước này, thường gặp cảnh nghe một chiều.', lesson: LESSON });

  const rtpA = frame(A, R1, A.ip, B.ip, 64, EF, A.rtp, B.rtp, { proto: 'rtp', fields: { pt: 0, seq: 21001, ts: 160000, ssrc: A.ssrc, marker: true } });
  sim.capture(rtpA, 'RTP, Phone 2001 sang 2002');
  sim.emit({ kind: 'transit', fromDevice: 'a', toDevice: 'r1', side: 'encap', activeLayer: 5,
    titleVi: 'Âm thanh RTP đi thẳng, không qua tổng đài', packet: rtpA,
    overlay: path('forwarding', 'RTP, DSCP EF', 'la', 'ls', 'lb'),
    explanationVi: 'IP đích là điện thoại 10.20.20.22, không phải tổng đài. Mỗi gói có 20 ms âm thanh: 160 byte với G.711, tức 50 gói mỗi giây. Cộng header IP, UDP, RTP là 200 byte, tức 80 kbps mỗi chiều. Đánh dấu EF để lên hàng đợi ưu tiên, xem kịch bản QoS s20.', lesson: LESSON });
  const rtpB = frame(R1, A, B.ip, A.ip, 63, EF, B.rtp, A.rtp, { proto: 'rtp', fields: { pt: 0, seq: 8801, ts: 320000, ssrc: B.ssrc, marker: true } });
  sim.capture(rtpB, 'RTP, Phone 2002 sang 2001');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'a', side: 'forward', activeLayer: 5,
    titleVi: 'Chiều ngược lại là một luồng RTP riêng', packet: rtpB,
    overlay: path('forwarding', 'RTP, DSCP EF', 'lb', 'ls', 'la'),
    explanationVi: 'SSRC và số thứ tự khác chiều kia. Chạy UDP vì gói đến muộn không còn giá trị, gửi lại chỉ thêm trễ. Mục tiêu: trễ một chiều dưới 150 ms, jitter dưới 30 ms, mất gói dưới 1%.', lesson: LESSON });

  const report = frame(R1, A, B.ip, A.ip, 63, CS3, B.rtp + 1, A.rtp + 1, { proto: 'rtcp', fields: { ssrc: B.ssrc, ntp: [3979000000, 2147483648], ts: 480000, packets: 1000, octets: 160000, peer: A.ssrc, lost8: 2, lostTotal: 8, extSeq: 22001, jitter: 80, lsr: 0x1a2b0000, dlsr: 32768 } });
  sim.capture(report, 'RTCP Sender Report');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'a', side: 'forward', activeLayer: 5,
    titleVi: 'RTCP báo chất lượng cuộc gọi', packet: report,
    overlay: path('trunk', 'RTCP', 'lb', 'ls', 'la'),
    explanationVi: 'RTCP dùng cổng lẻ ngay sau cổng RTP, ở đây là 16501 sang 16385. Xem các trường: tỉ lệ mất 2/256, khoảng 0,8%, và jitter 80 đơn vị, tức 10 ms. Tiếng rè hay ngắt quãng thì đây là nơi đầu tiên cần xem.', lesson: LESSON });

  const bye = sipMsg(A, R1, A.ip, PBX.ip, 64, { start: `BYE sip:${B.ext}@${B.ip}:5060 SIP/2.0`, headers: [['Via', `SIP/2.0/UDP ${A.ip}:5060;branch=z9hG4bK776asdhd3`], ['Max-Forwards', '70'], ['Route', rr], ...dlg(toTag, '2 BYE')] });
  sim.capture(bye, 'SIP BYE');
  sim.emit({ kind: 'transit', fromDevice: 'a', toDevice: 'r1', side: 'encap', activeLayer: 7,
    titleVi: 'Gác máy: gửi BYE', packet: bye,
    overlay: path('trunk', 'BYE', 'la', 'ls', 'lp', 'lb'),
    explanationVi: 'CSeq tăng lên 2 vì đây là yêu cầu mới trong cùng cuộc gọi, Call-ID không đổi. BYE đi qua tổng đài nhờ Record-Route, nên tổng đài biết cuộc gọi đã kết thúc và ghi cước.', lesson: LESSON });
  const byeOk = sipMsg(R1, A, PBX.ip, A.ip, 63, { start: 'SIP/2.0 200 OK', headers: [['Via', `SIP/2.0/UDP ${A.ip}:5060;branch=z9hG4bK776asdhd3`], ...dlg(toTag, '2 BYE')] });
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'a', side: 'forward', activeLayer: 7,
    titleVi: '✓ 200 OK, hai bên dừng RTP', packet: byeOk,
    overlay: path('trunk', '200 OK', 'lb', 'lp', 'ls', 'la'),
    explanationVi: 'Cuộc gọi kết thúc. Bài tập: lọc các gói trong tệp pcap bằng Wireshark, dùng Telephony, VoIP Calls để xem sơ đồ cuộc gọi. SCCP là giao thức báo hiệu cũ của Cisco, H.323 là chuẩn cũ hơn SIP.', lesson: LESSON });

  return sim.result();
}
