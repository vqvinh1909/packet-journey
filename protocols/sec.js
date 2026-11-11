// protocols/sec.js
// Giao thức cho kịch bản bảo mật: TLS 1.3 (bắt tay), IKEv2, EAPOL/EAP (802.1X), RADIUS.
// Đơn giản hoá: khoá, nonce, chứng chỉ và phần đã mã hoá là byte mẫu cố định, không phải mật mã thật.

import { BitWriter } from '../packet/bytes.js';

const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const u24 = (n) => [(n >> 16) & 0xff, ...u16(n & 0xffff)];
const u32 = (n) => [...u16(n >>> 16), ...u16(n & 0xffff)];
const ascii = (s) => [...new TextEncoder().encode(s)];
/** Byte mẫu trông như ngẫu nhiên nhưng cố định theo seed, để ảnh chụp gói không đổi giữa các lần chạy. */
const sample = (n, seed) => Array.from({ length: n }, (_, i) => (seed * 31 + i * 97 + ((i * i) >> 2)) & 0xff);

function proto(id, name, nameVi, osiLayer, rfc, rows) {
  return {
    id, name, nameVi, osiLayer, rfc, checksum: null,
    build(fields) {
      const w = new BitWriter();
      for (const [n, vi, descriptionVi, display, bytes] of rows(fields)) {
        w.field({ name: `${id}.${n}`, nameVi: vi, rfc, descriptionVi, display: String(display) }, () => w.writeBytes(bytes));
      }
      return w;
    },
  };
}

// ---------- TLS 1.3: RFC 8446 ----------
export const TLS_SUITE = { 0x1301: 'TLS_AES_128_GCM_SHA256', 0x1302: 'TLS_AES_256_GCM_SHA384', 0x1303: 'TLS_CHACHA20_POLY1305_SHA256' };
const ext = (type, body) => [...u16(type), ...u16(body.length), ...body];
/**
 * fields: { hello: 'client', sni, suites:[...] } | { hello: 'server', suite }
 *       | { encrypted: n, what } (record đã mã hoá: Certificate, Finished, dữ liệu ứng dụng)
 */
export const tls = proto('tls', 'TLS', 'TLS 1.3', 6, 'RFC 8446', (f) => {
  if (f.encrypted) {
    return [
      ['ctype', 'Content Type', '23 = Application Data. TLS 1.3 dùng loại này cho mọi record đã mã hoá, kể cả phần bắt tay còn lại.', '23 (Application Data)', [23]],
      ['ver', 'Legacy Version', 'Luôn ghi 0x0303 để thiết bị cũ không chặn. Phiên bản thật nằm trong extension supported_versions.', '0x0303', [3, 3]],
      ['len', 'Length', 'Số byte đã mã hoá phía sau.', f.encrypted, u16(f.encrypted)],
      ['data', 'Encrypted Data', `Đã mã hoá: ${f.what}. Người nghe lén chỉ thấy byte vô nghĩa.`, `${f.encrypted} byte (đã mã hoá)`, sample(f.encrypted, f.encrypted)],
    ];
  }
  const client = f.hello === 'client';
  const body = client ? [
    ['hver', 'Legacy Version', 'Ghi 0x0303 (TLS 1.2) để tương thích.', '0x0303', [3, 3]],
    ['random', 'Random', '32 byte ngẫu nhiên của client, dùng khi sinh khoá.', '32 byte', sample(32, 1)],
    ['sid', 'Session ID Length', 'Không dùng trong TLS 1.3.', 0, [0]],
    ['suites', 'Cipher Suites', 'Danh sách bộ mã client hỗ trợ. Server chọn một.', f.suites.map((s) => TLS_SUITE[s]).join(', '), [...u16(f.suites.length * 2), ...f.suites.flatMap(u16)]],
    ['comp', 'Compression', 'TLS 1.3 không nén.', 'null', [1, 0]],
  ] : [
    ['hver', 'Legacy Version', 'Ghi 0x0303 (TLS 1.2) để tương thích.', '0x0303', [3, 3]],
    ['random', 'Random', '32 byte ngẫu nhiên của server.', '32 byte', sample(32, 2)],
    ['sid', 'Session ID Length', 'Không dùng trong TLS 1.3.', 0, [0]],
    ['suite', 'Cipher Suite', 'Bộ mã server chọn trong danh sách của client.', TLS_SUITE[f.suite], u16(f.suite)],
    ['comp', 'Compression', 'TLS 1.3 không nén.', 'null', [0]],
  ];
  const name = client ? ascii(f.sni) : [];
  const exts = [
    ...(client ? [['sni', 'Extension: server_name (SNI)', 'Tên miền client muốn vào. Trường này KHÔNG mã hoá, nên firewall và người nghe lén đọc được.', f.sni, ext(0, [...u16(name.length + 3), 0, ...u16(name.length), ...name])]] : []),
    ['versions', 'Extension: supported_versions', 'Phiên bản thật: 0x0304 = TLS 1.3.', 'TLS 1.3 (0x0304)', ext(43, client ? [2, 3, 4] : [3, 4])],
    ['keyshare', 'Extension: key_share', 'Khoá công khai tạm (X25519) để hai bên tính ra khoá chung bằng Diffie-Hellman. Không gửi khoá bí mật qua mạng.', 'x25519, 32 byte', ext(51, client ? [...u16(36), ...u16(29), ...u16(32), ...sample(32, 3)] : [...u16(29), ...u16(32), ...sample(32, 4)])],
  ];
  const extLen = exts.reduce((n, r) => n + r[4].length, 0);
  const hlen = body.reduce((n, r) => n + r[4].length, 0) + 2 + extLen;
  return [
    ['ctype', 'Content Type', '22 = Handshake.', '22 (Handshake)', [22]],
    ['ver', 'Legacy Version', 'Phiên bản ghi ở lớp record, giữ để tương thích.', client ? '0x0301' : '0x0303', client ? [3, 1] : [3, 3]],
    ['len', 'Length', 'Độ dài bản tin bắt tay phía sau.', hlen + 4, u16(hlen + 4)],
    ['htype', 'Handshake Type', client ? '1 = ClientHello.' : '2 = ServerHello.', client ? '1 (ClientHello)' : '2 (ServerHello)', [client ? 1 : 2]],
    ['hlen', 'Handshake Length', 'Độ dài phần thân.', hlen, u24(hlen)],
    ...body,
    ['extlen', 'Extensions Length', 'Tổng độ dài các extension.', extLen, u16(extLen)],
    ...exts,
  ];
});

// ---------- IKEv2: RFC 7296 ----------
const IKE_EXCH = { 34: 'IKE_SA_INIT', 35: 'IKE_AUTH' };
/** fields: { spiI, spiR, exch, response, msgId, payloads: 'SA, KE, Nonce', size, encrypted? } — spi là mảng 8 byte */
export const ike = proto('ike', 'IKEv2', 'IKEv2 (ISAKMP)', 5, 'RFC 7296', (f) => [
  ['spii', 'Initiator SPI', 'Mã phiên IKE do bên khởi tạo chọn.', `0x${f.spiI.map((b) => b.toString(16).padStart(2, '0')).join('')}`, f.spiI],
  ['spir', 'Responder SPI', 'Mã phiên do bên trả lời chọn. Bằng 0 ở gói đầu tiên.', `0x${f.spiR.map((b) => b.toString(16).padStart(2, '0')).join('')}`, f.spiR],
  ['next', 'Next Payload', f.encrypted ? '46 = Encrypted (SK): phần sau đã mã hoá.' : '33 = Security Association.', f.encrypted ? '46 (SK)' : '33 (SA)', [f.encrypted ? 46 : 33]],
  ['ver', 'Version', '2.0', '2.0', [0x20]],
  ['exch', 'Exchange Type', '34 = IKE_SA_INIT (thoả thuận thuật toán, trao khoá DH). 35 = IKE_AUTH (xác thực, tạo SA cho dữ liệu).', `${f.exch} (${IKE_EXCH[f.exch]})`, [f.exch]],
  ['flags', 'Flags', 'Bit I: gói của bên khởi tạo. Bit R: gói trả lời.', f.response ? '0x20 (Response)' : '0x08 (Initiator)', [f.response ? 0x20 : 0x08]],
  ['msgid', 'Message ID', 'Số thứ tự cặp hỏi–đáp. Gói trả lời dùng lại số của gói hỏi.', f.msgId, u32(f.msgId)],
  ['len', 'Length', 'Tổng độ dài bản tin IKE.', 28 + f.size, u32(28 + f.size)],
  ['payloads', f.encrypted ? 'Encrypted Payloads' : 'Payloads', f.encrypted ? `Đã mã hoá bằng khoá vừa tính ở IKE_SA_INIT. Bên trong: ${f.payloads}.` : `Chưa mã hoá: ${f.payloads}.`, `${f.payloads} (${f.size} byte)`, sample(f.size, f.msgId * 2 + (f.response ? 1 : 0) + 5)],
]);

// ---------- EAPOL + EAP: IEEE 802.1X, RFC 3748 ----------
const EAP_CODE = { 1: 'Request', 2: 'Response', 3: 'Success', 4: 'Failure' };
const EAP_TYPE = { 1: 'Identity', 13: 'EAP-TLS', 25: 'PEAP' };
/** fields: { start: true } | { code, id, type?, data?: string } */
export const eapol = proto('eapol', 'EAPOL', 'EAPOL / EAP (802.1X)', 2, 'IEEE 802.1X / RFC 3748', (f) => {
  if (f.start) {
    return [
      ['ver', 'Version', '802.1X-2004.', 2, [2]],
      ['ptype', 'Packet Type', '1 = EAPOL-Start: máy trạm xin bắt đầu xác thực.', '1 (Start)', [1]],
      ['len', 'Length', 'Không có thân.', 0, u16(0)],
    ];
  }
  const data = f.type ? [f.type, ...ascii(f.data || '')] : [];
  const len = 4 + data.length;
  return [
    ['ver', 'Version', '802.1X-2004.', 2, [2]],
    ['ptype', 'Packet Type', '0 = EAP-Packet: bên trong là một bản tin EAP.', '0 (EAP-Packet)', [0]],
    ['len', 'Length', 'Độ dài bản tin EAP.', len, u16(len)],
    ['code', 'EAP Code', '1 Request, 2 Response, 3 Success, 4 Failure.', `${f.code} (${EAP_CODE[f.code]})`, [f.code]],
    ['id', 'EAP Identifier', 'Ghép Response với Request.', f.id, [f.id]],
    ['elen', 'EAP Length', 'Độ dài bản tin EAP.', len, u16(len)],
    ...(f.type ? [['type', 'EAP Type', '1 = Identity (hỏi/khai danh tính). 25 = PEAP, 13 = EAP-TLS (phương thức xác thực).', `${f.type} (${EAP_TYPE[f.type]})`, [f.type]]] : []),
    ...(f.data ? [['data', 'Type-Data', 'Nội dung theo loại EAP.', f.data, ascii(f.data)]] : []),
  ];
});

// ---------- RADIUS: RFC 2865, RFC 3579 ----------
const RADIUS_CODE = { 1: 'Access-Request', 2: 'Access-Accept', 3: 'Access-Reject', 11: 'Access-Challenge' };
/** fields: { code, id, attrs: [{ t, name, val: string | number[], show?, desc }] } */
export const radius = proto('radius', 'RADIUS', 'RADIUS', 7, 'RFC 2865', (f) => {
  const attrs = f.attrs.map((a) => ({ ...a, bytes: typeof a.val === 'string' ? ascii(a.val) : a.val }));
  const len = 20 + attrs.reduce((n, a) => n + 2 + a.bytes.length, 0);
  return [
    ['code', 'Code', '1 Access-Request, 2 Access-Accept, 3 Access-Reject, 11 Access-Challenge.', `${f.code} (${RADIUS_CODE[f.code]})`, [f.code]],
    ['id', 'Identifier', 'Ghép trả lời với yêu cầu.', f.id, [f.id]],
    ['len', 'Length', 'Tổng độ dài gói RADIUS.', len, u16(len)],
    ['auth', 'Authenticator', '16 byte. Dùng cùng shared secret để kiểm gói trả lời có đúng từ server.', '16 byte', sample(16, f.code * 7 + f.id)],
    ...attrs.map((a, i) => [`attr${i}`, `AVP ${a.t}: ${a.name}`, a.desc, a.show ?? (typeof a.val === 'string' ? a.val : `${a.bytes.length} byte`), [a.t, a.bytes.length + 2, ...a.bytes]]),
  ];
});
