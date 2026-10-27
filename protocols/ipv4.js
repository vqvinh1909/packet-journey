// protocols/ipv4.js
// Internet Protocol v4 — RFC 791. Header 20 byte (đơn giản hóa: KHÔNG dùng Options,
// nên IHL luôn = 5). Header checksum tính thật theo RFC 1071; router giảm TTL rồi
// phải tính lại checksum này.

import { BitWriter } from '../packet/bytes.js';
import { parseIp } from '../packet/addr.js';

export const IP_PROTO = { ICMP: 1, TCP: 6, UDP: 17, EIGRP: 88, OSPF: 89 };

function protoName(p) {
  for (const [k, v] of Object.entries(IP_PROTO)) if (v === p) return k;
  return 'Unknown';
}

export default {
  id: 'ipv4',
  name: 'IPv4',
  nameVi: 'Gói IPv4',
  osiLayer: 3,
  rfc: 'RFC 791',
  checksum: 'self',          // tính internetChecksum trên chính 20 byte header này
  checksumField: 'ip.checksum',

  /**
   * fields: { id, ttl, protocol, src, dst, dscp?, ecn?, flagsDF?, flagsMF?, fragOffset?, totalLength? }
   * ctx: { payloadLength } — serialize truyền vào để tính Total Length.
   */
  build(fields, ctx = {}) {
    const w = new BitWriter();
    const headerLen = 20; // IHL = 5, không options
    const totalLength = fields.totalLength ?? (headerLen + (ctx.payloadLength ?? 0));
    const df = fields.flagsDF ? 1 : 0;
    const mf = fields.flagsMF ? 1 : 0;
    const fragOffset = fields.fragOffset ?? 0;

    w.field(
      { name: 'ip.version', nameVi: 'Version', rfc: 'RFC 791',
        descriptionVi: 'Phiên bản IP = 4.', display: '4' },
      () => w.writeBits(4, 4),
    );
    w.field(
      { name: 'ip.ihl', nameVi: 'IHL', rfc: 'RFC 791',
        descriptionVi: 'Độ dài header tính theo đơn vị 4 byte. 5 = 20 byte (không options).',
        display: '5 (20 byte)' },
      () => w.writeBits(5, 4),
    );
    w.field(
      { name: 'ip.dscp', nameVi: 'DSCP', rfc: 'RFC 2474',
        descriptionVi: 'Differentiated Services — phân loại QoS. Mặc định 0.',
        display: String(fields.dscp ?? 0) },
      () => w.writeBits(fields.dscp ?? 0, 6),
    );
    w.field(
      { name: 'ip.ecn', nameVi: 'ECN', rfc: 'RFC 3168',
        descriptionVi: 'Explicit Congestion Notification. Mặc định 0.',
        display: String(fields.ecn ?? 0) },
      () => w.writeBits(fields.ecn ?? 0, 2),
    );
    w.field(
      { name: 'ip.len', nameVi: 'Total Length', rfc: 'RFC 791',
        descriptionVi: 'Tổng độ dài toàn gói IP (header + dữ liệu), tính bằng byte.',
        display: `${totalLength} byte` },
      () => w.writeUint(totalLength, 2),
    );
    w.field(
      { name: 'ip.id', nameVi: 'Identification', rfc: 'RFC 791',
        descriptionVi: 'ID để ghép lại các mảnh (fragment) của cùng một gói.',
        display: `0x${(fields.id ?? 0).toString(16).padStart(4, '0')} (${fields.id ?? 0})` },
      () => w.writeUint(fields.id ?? 0, 2),
    );
    w.field(
      { name: 'ip.flag.rsv', nameVi: 'Flag: Reserved', rfc: 'RFC 791',
        descriptionVi: 'Bit dành riêng, luôn 0.', display: '0' },
      () => w.writeBits(0, 1),
    );
    w.field(
      { name: 'ip.flag.df', nameVi: 'Flag: DF', rfc: 'RFC 791',
        descriptionVi: "Don't Fragment: 1 = cấm phân mảnh (nếu quá MTU sẽ bị drop + báo ICMP).",
        display: df ? '1 (Don’t Fragment)' : '0' },
      () => w.writeBits(df, 1),
    );
    w.field(
      { name: 'ip.flag.mf', nameVi: 'Flag: MF', rfc: 'RFC 791',
        descriptionVi: 'More Fragments: 1 = còn mảnh phía sau.', display: mf ? '1 (More Fragments)' : '0' },
      () => w.writeBits(mf, 1),
    );
    w.field(
      { name: 'ip.fragoffset', nameVi: 'Fragment Offset', rfc: 'RFC 791',
        descriptionVi: 'Vị trí mảnh này trong gói gốc, đơn vị 8 byte.', display: String(fragOffset) },
      () => w.writeBits(fragOffset, 13),
    );
    w.field(
      { name: 'ip.ttl', nameVi: 'TTL', rfc: 'RFC 791',
        descriptionVi: 'Time To Live: mỗi router đi qua giảm 1. Về 0 thì gói bị bỏ + báo ICMP Time Exceeded.',
        display: String(fields.ttl) },
      () => w.writeUint(fields.ttl, 1),
    );
    w.field(
      { name: 'ip.proto', nameVi: 'Protocol', rfc: 'RFC 791',
        descriptionVi: 'Giao thức tầng trên. 1 = ICMP, 6 = TCP, 17 = UDP.',
        display: `${fields.protocol} — ${protoName(fields.protocol)}` },
      () => w.writeUint(fields.protocol, 1),
    );
    w.field(
      { name: 'ip.checksum', nameVi: 'Header Checksum', rfc: 'RFC 791',
        descriptionVi: 'Checksum CHỈ của header IP. Tính lại mỗi khi TTL đổi (qua router) hoặc NAT đổi địa chỉ.',
        display: '(tính khi serialize)' },
      () => w.writeUint(0, 2), // để 0, serialize tính rồi vá lại
    );
    w.field(
      { name: 'ip.src', nameVi: 'Source IP', rfc: 'RFC 791',
        descriptionVi: 'IP nguồn. GIỮ NGUYÊN suốt hành trình (trừ khi NAT đổi).', display: fields.src },
      () => w.writeBytes(parseIp(fields.src)),
    );
    w.field(
      { name: 'ip.dst', nameVi: 'Destination IP', rfc: 'RFC 791',
        descriptionVi: 'IP đích. GIỮ NGUYÊN suốt hành trình (trừ khi NAT đổi).', display: fields.dst },
      () => w.writeBytes(parseIp(fields.dst)),
    );
    return w;
  },
};
