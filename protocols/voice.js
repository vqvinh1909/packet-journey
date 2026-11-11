// protocols/voice.js
// Các giao thức thoại: SIP và SDP (báo hiệu, dạng chữ), RTP (âm thanh), RTCP (báo cáo chất lượng).

import { BitWriter } from '../packet/bytes.js';

const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n) => [...u16(n >>> 16), ...u16(n & 0xffff)];
const ascii = (s) => [...new TextEncoder().encode(s)];

function build(id, rfc, rows) {
  const w = new BitWriter();
  for (const [n, nameVi, descriptionVi, display, bytes] of rows) {
    w.field({ name: `${id}.${n}`, nameVi, rfc, descriptionVi, display: String(display) }, () => w.writeBytes(bytes));
  }
  return w;
}

// ---------- SIP: RFC 3261, SDP: RFC 8866 ----------
const HEADER_VI = {
  Via: 'Đường đi của bản tin. Bản trả lời lần ngược theo Via, mỗi proxy thêm một dòng.',
  'Max-Forwards': 'Giảm 1 qua mỗi proxy, chống lặp, giống TTL.',
  From: 'Người gọi. Thẻ tag cùng Call-ID và thẻ của To định danh cuộc thoại.',
  To: 'Người nhận. Bên nhận thêm tag khi trả lời.',
  'Call-ID': 'Mã riêng của cuộc gọi, không đổi trong suốt cuộc gọi.',
  CSeq: 'Số thứ tự và tên phương thức. Bản trả lời lặp lại để ghép với yêu cầu.',
  Contact: 'Địa chỉ trực tiếp của thiết bị để liên lạc về sau.',
  Expires: 'Thời gian đăng ký còn hiệu lực, tính bằng giây.',
  'Record-Route': 'Proxy yêu cầu các bản tin sau của cuộc gọi vẫn đi qua nó.',
  Route: 'Các proxy bản tin phải đi qua, lấy từ Record-Route.',
};
const SDP_VI = {
  v: 'Phiên bản SDP.', o: 'Người tạo phiên và mã phiên.', s: 'Tên phiên.',
  c: 'IP nhận âm thanh. Đây là lý do RTP đi thẳng giữa hai điện thoại được.', t: 'Thời gian phiên, 0 0 là không giới hạn.',
  m: 'Kiểu media, cổng nhận RTP và danh sách payload type theo thứ tự ưu tiên.', a: 'Thuộc tính: tên codec, độ dài mỗi gói, chiều truyền.',
};
const RTPMAP = { 0: 'PCMU/8000', 8: 'PCMA/8000', 9: 'G722/8000', 18: 'G729/8000' };

function sdpLines(s) {
  return [
    `v=0`, `o=${s.user} ${s.sess} 1 IN IP4 ${s.ip}`, `s=call`, `c=IN IP4 ${s.ip}`, `t=0 0`,
    `m=audio ${s.port} RTP/AVP ${s.pts.join(' ')}`,
    ...s.pts.map((p) => `a=rtpmap:${p} ${RTPMAP[p]}`), `a=ptime:20`, `a=sendrecv`,
  ];
}

/** fields: { start, headers: [[tên, giá trị]], sdp?: { user, sess, ip, port, pts } } */
export const sip = {
  id: 'sip', name: 'SIP', nameVi: 'SIP và SDP', osiLayer: 7, rfc: 'RFC 3261', checksum: null,
  build(f) {
    const body = f.sdp ? sdpLines(f.sdp) : [];
    const bodyText = body.map((l) => l + '\r\n').join('');
    const headers = [...f.headers, ...(f.sdp ? [['Content-Type', 'application/sdp']] : []), ['Content-Length', String(ascii(bodyText).length)]];
    return build('sip', 'RFC 3261', [
      ['start', 'Start Line', 'Dòng đầu: yêu cầu có phương thức và đích, trả lời có mã trạng thái.', f.start, ascii(f.start + '\r\n')],
      ...headers.map(([k, v]) => [k.toLowerCase(), k, HEADER_VI[k] || (k === 'Content-Length' ? 'Số byte phần thân SDP phía sau dòng trống.' : 'Kiểu dữ liệu của phần thân.'), v, ascii(`${k}: ${v}\r\n`)]),
      ['blank', 'Dòng trống', 'Ngăn cách header với phần thân.', 'CRLF', ascii('\r\n')],
      ...body.map((l, i) => [`sdp${i}`, `SDP ${l[0]}=`, SDP_VI[l[0]], l.slice(2), ascii(l + '\r\n')]),
    ]);
  },
};

// ---------- RTP: RFC 3550 ----------
const PT_NAME = { 0: 'PCMU, G.711 µ-law', 8: 'PCMA, G.711 A-law', 9: 'G.722', 18: 'G.729' };
/** fields: { pt, seq, ts, ssrc, marker?, size? }. size là số byte âm thanh, mặc định 160 (G.711, 20 ms). */
export const rtp = {
  id: 'rtp', name: 'RTP', nameVi: 'RTP', osiLayer: 5, rfc: 'RFC 3550', checksum: null,
  build(f) {
    const size = f.size ?? 160;
    return build('rtp', 'RFC 3550', [
      ['flags', 'Version, P, X, CC', 'Phiên bản 2, không đệm, không mở rộng, không có nguồn CSRC.', '2, 0, 0, 0', [0x80]],
      ['pt', 'Marker + Payload Type', 'Payload Type cho biết codec. Marker bật ở gói đầu của một đoạn nói.', `M=${f.marker ? 1 : 0}, ${f.pt} (${PT_NAME[f.pt]})`, [(f.marker ? 0x80 : 0) | f.pt]],
      ['seq', 'Sequence Number', 'Tăng 1 mỗi gói. Bên nhận dựa vào đây để biết mất gói và sai thứ tự.', f.seq, u16(f.seq)],
      ['ts', 'Timestamp', 'Tăng theo số mẫu: G.711 có 8000 mẫu mỗi giây nên tăng 160 mỗi 20 ms. Dùng để phát đều và đo jitter.', f.ts, u32(f.ts)],
      ['ssrc', 'SSRC', 'Mã của nguồn âm thanh, mỗi chiều một mã.', `0x${f.ssrc.toString(16)}`, u32(f.ssrc)],
      ['payload', 'Payload', 'Âm thanh đã mã hoá. Ở đây là mẫu im lặng thay cho tiếng nói thật.', `${size} byte`, new Array(size).fill(f.pt === 0 ? 0xff : 0)],
    ]);
  },
};

// ---------- RTCP Sender Report: RFC 3550 ----------
/** fields: { ssrc, ntp: [giây, phần lẻ], ts, packets, octets, peer, lost8, lostTotal, extSeq, jitter, lsr, dlsr } */
export const rtcp = {
  id: 'rtcp', name: 'RTCP', nameVi: 'RTCP Sender Report', osiLayer: 5, rfc: 'RFC 3550', checksum: null,
  build(f) {
    return build('rtcp', 'RFC 3550', [
      ['flags', 'Version, P, RC', 'Phiên bản 2, có 1 khối báo cáo về chiều nhận.', '2, 0, 1', [0x81]],
      ['pt', 'Packet Type', '200 là Sender Report, 201 là Receiver Report.', '200 (SR)', [200]],
      ['length', 'Length', 'Độ dài theo số từ 32 bit, trừ đi 1.', 12, u16(12)],
      ['ssrc', 'SSRC', 'Nguồn gửi báo cáo.', `0x${f.ssrc.toString(16)}`, u32(f.ssrc)],
      ['ntp', 'NTP Timestamp', 'Giờ thực lúc gửi, giúp tính độ trễ khứ hồi.', f.ntp.join('.'), [...u32(f.ntp[0]), ...u32(f.ntp[1])]],
      ['ts', 'RTP Timestamp', 'Mốc RTP ứng với giờ thực trên.', f.ts, u32(f.ts)],
      ['packets', 'Sender Packet Count', 'Tổng gói RTP đã gửi.', f.packets, u32(f.packets)],
      ['octets', 'Sender Octet Count', 'Tổng byte âm thanh đã gửi.', f.octets, u32(f.octets)],
      ['peer', 'Report SSRC', 'Nguồn được báo cáo, tức chiều đang nhận.', `0x${f.peer.toString(16)}`, u32(f.peer)],
      ['lost', 'Fraction + Cumulative Lost', 'Tỉ lệ mất từ lần báo trước (chia 256) và tổng số gói đã mất.', `${f.lost8}/256, ${f.lostTotal} gói`, [f.lost8, (f.lostTotal >> 16) & 0xff, ...u16(f.lostTotal & 0xffff)]],
      ['extseq', 'Highest Sequence', 'Số thứ tự lớn nhất đã nhận.', f.extSeq, u32(f.extSeq)],
      ['jitter', 'Interarrival Jitter', 'Độ dao động thời gian đến, tính theo đơn vị timestamp. G.711: 8 đơn vị là 1 ms.', `${f.jitter} (${f.jitter / 8} ms)`, u32(f.jitter)],
      ['lsr', 'Last SR', 'Dấu thời gian của SR gần nhất đã nhận.', f.lsr, u32(f.lsr)],
      ['dlsr', 'Delay Since Last SR', 'Thời gian giữ từ lúc nhận SR đó, đơn vị 1/65536 giây.', f.dlsr, u32(f.dlsr)],
    ]);
  },
};
