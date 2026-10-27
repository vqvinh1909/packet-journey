// protocols/tcp.js
// TCP — RFC 9293. Header 20 byte (+ Options, vd MSS = 4 byte → 24). Checksum có
// pseudo-header IPv4 (serialize tự tính vì cần IP nguồn/đích).

import { BitWriter } from '../packet/bytes.js';

const PORT_NAME = { 20: 'FTP-data', 21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS', 80: 'HTTP', 110: 'POP3', 143: 'IMAP', 179: 'BGP', 443: 'HTTPS', 3389: 'RDP' };
function portLabel(p) { return PORT_NAME[p] ? `${p} — ${PORT_NAME[p]}` : String(p); }

const FLAG_BITS = [['cwr', 0x80], ['ece', 0x40], ['urg', 0x20], ['ack', 0x10], ['psh', 0x08], ['rst', 0x04], ['syn', 0x02], ['fin', 0x01]];
function flagsByte(f = {}) { return FLAG_BITS.reduce((b, [k, v]) => (f[k] ? b | v : b), 0); }
function flagsLabel(f = {}) {
  const on = FLAG_BITS.filter(([k]) => f[k]).map(([k]) => k.toUpperCase());
  return on.length ? on.join(', ') : '(none)';
}

export default {
  id: 'tcp',
  name: 'TCP',
  nameVi: 'TCP',
  osiLayer: 4,
  rfc: 'RFC 9293',
  checksum: 'transport',
  checksumField: 'tcp.checksum',
  ipProto: 6,

  /** fields: { srcPort, dstPort, seq, ack, flags:{syn,ack,...}, window=64240, mss? } */
  build(fields) {
    const w = new BitWriter();
    const opts = fields.mss ? [2, 4, (fields.mss >> 8) & 0xff, fields.mss & 0xff] : [];
    const headerLen = 20 + opts.length;
    const dataOffset = headerLen / 4;

    w.field({ name: 'tcp.src', nameVi: 'Source Port', rfc: 'RFC 9293',
      descriptionVi: 'Cổng nguồn (client thường là cổng tạm/ephemeral).', display: portLabel(fields.srcPort) }, () => w.writeUint(fields.srcPort, 2));
    w.field({ name: 'tcp.dst', nameVi: 'Destination Port', rfc: 'RFC 9293',
      descriptionVi: 'Cổng đích xác định dịch vụ (80 HTTP, 443 HTTPS, 179 BGP...).', display: portLabel(fields.dstPort) }, () => w.writeUint(fields.dstPort, 2));
    w.field({ name: 'tcp.seq', nameVi: 'Sequence Number', rfc: 'RFC 9293',
      descriptionVi: 'Số thứ tự byte đầu của đoạn này. SYN tiêu tốn 1 số (ISN).', display: String(fields.seq >>> 0) }, () => w.writeUint(fields.seq >>> 0, 4));
    w.field({ name: 'tcp.ack', nameVi: 'Acknowledgment Number', rfc: 'RFC 9293',
      descriptionVi: 'Byte kế tiếp đang MONG nhận (chỉ có nghĩa khi cờ ACK = 1).', display: String(fields.ack >>> 0) }, () => w.writeUint(fields.ack >>> 0, 4));
    w.field({ name: 'tcp.off', nameVi: 'Data Offset', rfc: 'RFC 9293',
      descriptionVi: 'Độ dài header TCP theo đơn vị 4 byte (5 = 20 byte; 6 = 24 byte khi có MSS).', display: `${dataOffset} (${headerLen} byte)` }, () => w.writeBits(dataOffset, 4));
    w.field({ name: 'tcp.rsv', nameVi: 'Reserved', rfc: 'RFC 9293', descriptionVi: 'Dành riêng = 0.', display: '0' }, () => w.writeBits(0, 4));
    w.field({ name: 'tcp.flags', nameVi: 'Flags', rfc: 'RFC 9293',
      descriptionVi: 'Cờ điều khiển: SYN (mở), ACK (xác nhận), FIN (đóng), RST (hủy), PSH, URG.', display: `0x${flagsByte(fields.flags).toString(16).padStart(2, '0')} — ${flagsLabel(fields.flags)}` },
      () => w.writeUint(flagsByte(fields.flags), 1));
    w.field({ name: 'tcp.win', nameVi: 'Window', rfc: 'RFC 9293',
      descriptionVi: 'Số byte bên gửi còn nhận thêm được (điều khiển luồng).', display: String(fields.window ?? 64240) }, () => w.writeUint(fields.window ?? 64240, 2));
    w.field({ name: 'tcp.checksum', nameVi: 'Checksum', rfc: 'RFC 9293',
      descriptionVi: 'Checksum có pseudo-header (IP nguồn/đích + proto + length), trên cả header + data.', display: '(tính khi serialize)' }, () => w.writeUint(0, 2));
    w.field({ name: 'tcp.urg', nameVi: 'Urgent Pointer', rfc: 'RFC 9293', descriptionVi: 'Trỏ dữ liệu khẩn (khi URG=1).', display: '0' }, () => w.writeUint(0, 2));
    if (opts.length) {
      w.field({ name: 'tcp.mss', nameVi: 'Option: MSS', rfc: 'RFC 9293',
        descriptionVi: 'Maximum Segment Size — kích thước data tối đa mỗi đoạn (thường 1460 trên Ethernet). Chỉ trao trong SYN.', display: `${fields.mss} byte` },
        () => w.writeBytes(opts));
    }
    return w;
  },
};
