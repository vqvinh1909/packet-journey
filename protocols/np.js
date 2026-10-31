// protocols/np.js
// Các giao thức cho kịch bản CCNP: IGMP, PIM, GRE, NHRP, LISP, BFD, LDP, ESP.
// Mỗi hàm rows(fields) trả về danh sách [tên, nhãn, mô tả, giá trị hiển thị, byte].

import { BitWriter } from '../packet/bytes.js';
import { parseIp } from '../packet/addr.js';

const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const u32 = (n) => [...u16(n >>> 16), ...u16(n & 0xffff)];
const zeros = (n) => new Array(n).fill(0);

function proto(id, name, nameVi, osiLayer, rfc, rows, extra = {}) {
  return {
    id, name, nameVi, osiLayer, rfc, checksum: null, ...extra,
    build(fields) {
      const w = new BitWriter();
      for (const [n, vi, descriptionVi, display, bytes] of rows(fields)) {
        w.field({ name: `${id}.${n}`, nameVi: vi, rfc, descriptionVi, display: String(display) }, () => w.writeBytes(bytes));
      }
      return w;
    },
  };
}

// ---------- IGMP: RFC 2236 (v2), RFC 3376 (v3) ----------
const IGMP_NAME = { 0x11: 'Membership Query', 0x16: 'v2 Membership Report', 0x17: 'v2 Leave Group', 0x22: 'v3 Membership Report' };
/** fields: { type, group, maxResp? } hoặc v3: { type:0x22, group, recType, sources:[] } */
export const igmp = proto('igmp', 'IGMP', 'IGMP', 3, 'RFC 2236 / RFC 3376', (f) => {
  const head = [['type', 'Type', 'Loại bản tin IGMP.', `0x${f.type.toString(16)} (${IGMP_NAME[f.type]})`, [f.type]]];
  if (f.type !== 0x22) {
    return [...head,
      ['maxresp', 'Max Resp Time', 'Thời gian chờ trả lời Query, đơn vị 0,1 giây. Report để 0.', f.maxResp ?? 0, [f.maxResp ?? 0]],
      ['checksum', 'Checksum', 'Internet checksum trên toàn bản tin IGMP.', 'tự tính', [0, 0]],
      ['group', 'Group Address', 'Nhóm multicast mà máy muốn nhận.', f.group, parseIp(f.group)]];
  }
  const src = f.sources || [];
  return [...head,
    ['resv1', 'Reserved', 'Dành riêng.', 0, [0]],
    ['checksum', 'Checksum', 'Internet checksum trên toàn bản tin IGMP.', 'tự tính', [0, 0]],
    ['resv2', 'Reserved', 'Dành riêng.', 0, [0, 0]],
    ['nrec', 'Number of Records', 'Số bản ghi nhóm trong Report.', 1, u16(1)],
    ['rectype', 'Record Type', '1 = MODE_IS_INCLUDE: chỉ nhận từ các nguồn liệt kê. Đây là cơ sở của SSM.', `${f.recType} (INCLUDE)`, [f.recType]],
    ['aux', 'Aux Data Len', 'Không có dữ liệu phụ.', 0, [0]],
    ['nsrc', 'Number of Sources', 'Số nguồn liệt kê.', src.length, u16(src.length)],
    ['group', 'Group Address', 'Nhóm multicast.', f.group, parseIp(f.group)],
    ['sources', 'Sources', 'Nguồn máy muốn nhận. IGMPv2 không có trường này nên không làm SSM được.', src.join(', '), src.flatMap(parseIp)]];
}, { checksum: 'self', checksumField: 'igmp.checksum' });

// ---------- PIMv2: RFC 7761 ----------
const encU = (a) => [1, 0, ...parseIp(a)];
const encG = (a) => [1, 0, 0, 32, ...parseIp(a)];
const encS = (s) => [1, 0, s.flags, 32, ...parseIp(s.addr)];
const srcTxt = (l) => l.map((s) => `${s.addr} ${s.flags & 2 ? '(*,G)' : s.flags & 1 ? '(S,G,rpt)' : '(S,G)'}`).join(', ') || 'không có';
/** fields: { type:'hello' } | { type:'register' } | { type:'join', upstream, group, joins:[{addr,flags}], prunes:[] } */
export const pim = proto('pim', 'PIMv2', 'PIM Sparse Mode', 3, 'RFC 7761', (f) => {
  const code = { hello: 0, register: 1, join: 3 }[f.type];
  const head = [
    ['ver', 'Version + Type', 'PIM phiên bản 2. Type 0 = Hello, 1 = Register, 3 = Join/Prune.', `2, ${f.type}`, [0x20 | code]],
    ['resv', 'Reserved', 'Dành riêng.', 0, [0]],
    ['checksum', 'Checksum', 'Internet checksum. Với Register chỉ tính 8 byte đầu, không tính gói bọc bên trong.', 'tự tính', [0, 0]],
  ];
  if (f.type === 'hello') return [...head, ['holdtime', 'Option: Holdtime', 'Hàng xóm PIM giữ quan hệ trong 105 giây nếu không nhận thêm Hello.', '105 s', [...u16(1), ...u16(2), ...u16(105)]]];
  if (f.type === 'register') return [...head, ['regflags', 'Flags', 'Border bit và Null-Register bit đều bằng 0: bên trong là gói multicast thật.', '0', u32(0)]];
  const joins = f.joins || [], prunes = f.prunes || [];
  return [...head,
    ['upstream', 'Upstream Neighbor', 'Router láng giềng hướng về nguồn hoặc RP, được chọn theo RPF. Chỉ router này xử lý Join.', f.upstream, encU(f.upstream)],
    ['ngroups', 'Reserved + Num Groups', 'Một nhóm trong bản tin.', 1, [0, 1]],
    ['hold', 'Holdtime', 'Trạng thái giữ 210 giây, Join được gửi lại mỗi 60 giây.', '210 s', u16(210)],
    ['group', 'Multicast Group', 'Nhóm cần tham gia hoặc cắt.', f.group, encG(f.group)],
    ['njoin', 'Joined Sources', 'Số nguồn trong danh sách Join.', joins.length, u16(joins.length)],
    ['nprune', 'Pruned Sources', 'Số nguồn trong danh sách Prune.', prunes.length, u16(prunes.length)],
    ['joins', 'Join List', 'Bit W và R bật: (*,G), đích là RP. Không có W: (S,G), đi thẳng về nguồn.', srcTxt(joins), joins.flatMap(encS)],
    ['prunes', 'Prune List', 'Bit R bật: (S,G,rpt), cắt nguồn này khỏi cây dùng chung.', srcTxt(prunes), prunes.flatMap(encS)]];
}, { checksum: 'self', checksumField: 'pim.checksum' });

// ---------- GRE: RFC 2784 + RFC 2890 (key) ----------
/** fields: { ptype, key? } */
export const gre = proto('gre', 'GRE', 'GRE', 3.5, 'RFC 2784 / RFC 2890', (f) => [
  ['flags', 'Flags + Version', 'Bit K bật khi có Tunnel Key. mGRE dùng key để phân biệt các mạng DMVPN.', f.key != null ? '0x2000 (K=1)' : '0x0000', u16(f.key != null ? 0x2000 : 0)],
  ['ptype', 'Protocol Type', 'Thứ nằm bên trong: 0x0800 là IPv4, 0x2001 là NHRP.', `0x${f.ptype.toString(16).padStart(4, '0')} (${f.ptype === 0x2001 ? 'NHRP' : 'IPv4'})`, u16(f.ptype)],
  ...(f.key != null ? [['key', 'Key', 'Giá trị tunnel key, hai đầu phải giống nhau.', f.key, u32(f.key)]] : []),
]);

// ---------- NHRP: RFC 2332 ----------
const NHRP_OP = { 1: 'Resolution Request', 2: 'Resolution Reply', 3: 'Registration Request', 4: 'Registration Reply', 8: 'Traffic Indication' };
/** fields: { op, srcNbma, srcProto, dstProto, reqId, cie?:{ nbma, proto, prefix } } */
export const nhrp = proto('nhrp', 'NHRP', 'NHRP', 3.5, 'RFC 2332', (f) => {
  const cie = f.cie;
  const body = 20 + 8 + 4 + 4 + 4 + (cie ? 10 + 8 : 0);
  return [
    ['afn', 'Address Family', '1 = địa chỉ NBMA (mặt phẳng vận chuyển) là IPv4.', 1, u16(1)],
    ['pro', 'Protocol Type + SNAP', '0x0800: địa chỉ tunnel là IPv4.', '0x0800', [...u16(0x0800), ...zeros(5)]],
    ['hop', 'Hop Count', 'Số chặng NHRP tối đa, chống lặp.', 255, [255]],
    ['size', 'Packet Size', 'Tổng độ dài bản tin NHRP.', body, u16(body)],
    ['checksum', 'Checksum', 'Internet checksum trên toàn bản tin NHRP.', 'tự tính', [0, 0]],
    ['extoff', 'Extension Offset', 'Không có phần mở rộng.', 0, u16(0)],
    ['op', 'Version + Type', 'Loại bản tin NHRP.', `1, ${f.op} (${NHRP_OP[f.op]})`, [1, f.op]],
    ['lens', 'NBMA Len', 'Độ dài địa chỉ NBMA nguồn: 4 byte.', 4, [4, 0]],
    ['plens', 'Protocol Len', 'Độ dài địa chỉ tunnel nguồn và đích: 4 byte.', '4, 4', [4, 4]],
    ['flags', 'Flags', 'Không dùng cờ trong kịch bản này.', 0, u16(0)],
    ['reqid', 'Request ID', 'Ghép Reply với Request.', f.reqId, u32(f.reqId)],
    ['srcnbma', 'Source NBMA', 'Địa chỉ Internet thật của router gửi. Đây là thứ NHRP cần học.', f.srcNbma, parseIp(f.srcNbma)],
    ['srcproto', 'Source Protocol', 'Địa chỉ tunnel của router gửi.', f.srcProto, parseIp(f.srcProto)],
    ['dstproto', 'Destination Protocol', 'Địa chỉ tunnel cần hỏi hoặc NHS cần đăng ký.', f.dstProto, parseIp(f.dstProto)],
    ...(cie ? [['cie', 'Client Information Entry', 'Câu trả lời: địa chỉ tunnel này nằm sau địa chỉ NBMA kia, giữ trong 2 giờ.', `${cie.proto}/${cie.prefix} → NBMA ${cie.nbma}`,
      [0, cie.prefix, ...u16(1400), ...u16(7200), 4, 0, 4, 0, ...parseIp(cie.nbma), ...parseIp(cie.proto)]]] : []),
  ];
}, { checksum: 'self', checksumField: 'nhrp.checksum' });

// ---------- LISP: RFC 9300 (dữ liệu), RFC 9301 (điều khiển) ----------
const NONCE = [0x4c, 0x49, 0x53, 0x50, 0, 0, 0, 1];
const eidRec = (f) => [['eid', 'EID-Prefix', 'EID là địa chỉ của máy, không đổi khi máy di chuyển.', `${f.eid}/${f.mask}`, [...u16(1), ...parseIp(f.eid)]]];
const mapRec = (f) => [
  ['ttl', 'Record TTL', 'Thời gian lưu trong map-cache: 1440 phút.', '1440 phút', u32(1440)],
  ['lcount', 'Locator Count', 'Số RLOC của EID này.', 1, [1]],
  ['mask', 'EID Mask Len', 'Độ dài prefix của EID.', f.mask, [f.mask]],
  ['act', 'ACT + Flags', 'A bit bật: bản ghi có thẩm quyền.', 'A=1', [0x10, 0]],
  ['ver', 'Map-Version', 'Không dùng.', 0, [0, 0]],
  ...eidRec(f),
  ['loc', 'Locator', 'RLOC là địa chỉ của xTR trong underlay. Priority và weight dùng để chọn đường và chia tải.', `RLOC ${f.rloc}, pri 1, weight 100`, [1, 100, 255, 0, 0, 5, ...u16(1), ...parseIp(f.rloc)]],
];
/** fields: { type:'data', instance } | { type:'register'|'reply', eid, mask, rloc } | { type:'request', eid, mask, itr } */
export const lisp = proto('lisp', 'LISP', 'LISP', 4.5, 'RFC 9300 / RFC 9301', (f) => {
  if (f.type === 'data') {
    return [
      ['flags', 'Flags + Nonce', 'N bit: có nonce. I bit: có Instance ID để tách VRF.', 'N=1, I=1', [0x88, 0x12, 0x34, 0x56]],
      ['instance', 'Instance ID', 'Tương tự VNI hoặc VRF: EID giống nhau ở hai instance không đụng nhau.', f.instance, [(f.instance >> 16) & 0xff, (f.instance >> 8) & 0xff, f.instance & 0xff, 0]],
    ];
  }
  if (f.type === 'request') {
    return [
      ['type', 'Type', 'Type 1: Map-Request, hỏi EID này nằm sau RLOC nào.', '1 (Map-Request)', [0x10, 0, 0, 1]],
      ['nonce', 'Nonce', 'Ghép Map-Reply với Map-Request, chống giả mạo.', '0x4c49535000000001', NONCE],
      ['srceid', 'Source EID AFI', 'Không gửi EID nguồn.', 0, u16(0)],
      ['itr', 'ITR-RLOC', 'Địa chỉ để bên trả lời gửi Map-Reply về.', f.itr, [...u16(1), ...parseIp(f.itr)]],
      ['rec', 'EID Mask Len', 'Độ dài prefix được hỏi.', f.mask, [0, f.mask]],
      ...eidRec(f)];
  }
  if (f.type === 'reply') {
    return [
      ['type', 'Type', 'Type 2: Map-Reply, do ETR có thẩm quyền trả lời trực tiếp.', '2 (Map-Reply)', [0x20, 0, 0, 1]],
      ['nonce', 'Nonce', 'Giống nonce của Map-Request.', '0x4c49535000000001', NONCE],
      ...mapRec(f)];
  }
  return [
    ['type', 'Type', 'Type 3: Map-Register, ETR đăng ký EID với Map-Server.', '3 (Map-Register)', [0x30, 0, 0, 1]],
    ['nonce', 'Nonce', 'Bằng 0 với Map-Register.', 0, zeros(8)],
    ['auth', 'Key ID + Auth Data', 'HMAC-SHA-1-96 bằng khoá dùng chung với Map-Server. Kịch bản để giá trị 0.', 'HMAC-SHA-1-96', [...u16(1), ...u16(12), ...zeros(12)]],
    ...mapRec(f)];
});

// ---------- BFD: RFC 5880 ----------
const BFD_STATE = ['AdminDown', 'Down', 'Init', 'Up'];
/** fields: { state, diag?, myDisc, yourDisc, tx, rx, mult } */
export const bfd = proto('bfd', 'BFD', 'BFD', 5, 'RFC 5880', (f) => [
  ['ver', 'Version + Diag', 'Phiên bản 1. Diag 1 = hết thời gian phát hiện.', `1, diag ${f.diag ?? 0}`, [0x20 | (f.diag ?? 0)]],
  ['state', 'State + Flags', 'Trạng thái của phiên theo bên gửi. Lên phiên qua 3 bước: Down, Init, Up.', BFD_STATE[f.state], [f.state << 6]],
  ['mult', 'Detect Mult', 'Mất liên tiếp ngần này gói thì coi như đứt.', f.mult, [f.mult]],
  ['len', 'Length', 'Bản tin 24 byte.', 24, [24]],
  ['mydisc', 'My Discriminator', 'Mã phiên do bên gửi tự chọn.', f.myDisc, u32(f.myDisc)],
  ['yourdisc', 'Your Discriminator', 'Mã phiên của bên kia. Bằng 0 khi chưa biết.', f.yourDisc, u32(f.yourDisc)],
  ['tx', 'Desired Min TX', 'Muốn gửi nhanh nhất mỗi chừng này micro giây.', `${f.tx} µs`, u32(f.tx)],
  ['rx', 'Required Min RX', 'Nhận được nhanh nhất mỗi chừng này micro giây.', `${f.rx} µs`, u32(f.rx)],
  ['echo', 'Required Min Echo', 'Bằng 0: không dùng echo trong kịch bản này.', 0, u32(0)],
]);

// ---------- LDP: RFC 5036 ----------
/** fields: { lsrId, hello:true } | { lsrId, fec, prefix, label } */
export const ldp = proto('ldp', 'LDP', 'LDP', 4.5, 'RFC 5036', (f) => {
  const pdu = (len) => [
    ['ver', 'Version', 'LDP phiên bản 1.', 1, u16(1)],
    ['pdulen', 'PDU Length', 'Độ dài sau trường này.', len, u16(len)],
    ['lsrid', 'LSR ID', 'Định danh router, thường là loopback. Bên có LSR ID lớn hơn mở phiên TCP 646.', f.lsrId, parseIp(f.lsrId)],
    ['space', 'Label Space', '0: nhãn dùng chung cho mọi cổng.', 0, u16(0)]];
  if (f.hello) {
    return [...pdu(6 + 8 + 8),
      ['msg', 'Message: Hello', 'Hello gửi UDP 646 tới 224.0.0.2 để tìm láng giềng LDP.', '0x0100', [...u16(0x0100), ...u16(12), ...u32(1)]],
      ['params', 'Common Hello Params', 'Hold time 15 giây.', '15 s', [...u16(0x0400), ...u16(4), ...u16(15), ...u16(0)]]];
  }
  const pb = parseIp(f.fec).slice(0, Math.ceil(f.prefix / 8));
  const fec = [2, ...u16(1), f.prefix, ...pb], msgLen = 4 + 4 + fec.length + 8;
  return [...pdu(6 + 4 + msgLen),
    ['msg', 'Message: Label Mapping', 'Báo cho láng giềng nhãn mình cấp cho một FEC.', '0x0400', [...u16(0x0400), ...u16(msgLen), ...u32(2)]],
    ['fec', 'FEC TLV', 'FEC là đích mà nhãn đại diện, thường là loopback của PE.', `${f.fec}/${f.prefix}`, [...u16(0x0100), ...u16(fec.length), ...fec]],
    ['label', 'Generic Label TLV', 'Nhãn 3 là implicit null: chặng trước gỡ nhãn ngoài, tức PHP.', f.label === 3 ? '3 (implicit null)' : f.label, [...u16(0x0200), ...u16(4), ...u32(f.label)]]];
});

// ---------- ESP: RFC 4303 ----------
/** fields: { spi, seq } */
export const esp = proto('esp', 'ESP', 'IPsec ESP', 3.5, 'RFC 4303', (f) => [
  ['spi', 'SPI', 'Chỉ ra SA nào dùng để giải mã.', `0x${f.spi.toString(16)}`, u32(f.spi)],
  ['seq', 'Sequence', 'Tăng dần, chống phát lại.', f.seq, u32(f.seq)],
]);
