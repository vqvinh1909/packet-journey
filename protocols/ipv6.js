// protocols/ipv6.js
// Internet Protocol v6 — RFC 8200. Header CỐ ĐỊNH 40 byte, KHÔNG có checksum (tầng
// trên lo). EtherType = 0x86dd. Next Header: 58 ICMPv6, 17 UDP, 6 TCP, 89 OSPFv3.

import { BitWriter } from '../packet/bytes.js';
import { parseIpv6 } from '../packet/addr.js';

export const NH = { ICMPv6: 58, TCP: 6, UDP: 17, OSPFv3: 89 };
function nhName(n) {
  for (const [k, v] of Object.entries(NH)) if (v === n) return k;
  return 'Unknown';
}

export default {
  id: 'ipv6',
  name: 'IPv6',
  nameVi: 'Gói IPv6',
  osiLayer: 3,
  rfc: 'RFC 8200',
  checksum: null, // IPv6 KHÔNG có header checksum

  /** fields: { src, dst, nextHeader, hopLimit=64, trafficClass=0, flowLabel=0, payloadLength? } */
  build(fields, ctx = {}) {
    const w = new BitWriter();
    const plen = fields.payloadLength ?? ctx.payloadLength ?? 0;
    w.field({ name: 'ip6.version', nameVi: 'Version', rfc: 'RFC 8200', descriptionVi: 'Phiên bản = 6.', display: '6' }, () => w.writeBits(6, 4));
    w.field({ name: 'ip6.tc', nameVi: 'Traffic Class', rfc: 'RFC 8200', descriptionVi: 'Tương đương DSCP+ECN của IPv4 (QoS).', display: String(fields.trafficClass ?? 0) }, () => w.writeBits(fields.trafficClass ?? 0, 8));
    w.field({ name: 'ip6.flow', nameVi: 'Flow Label', rfc: 'RFC 8200', descriptionVi: 'Nhãn luồng để nhận diện/ưu tiên các gói cùng dòng.', display: String(fields.flowLabel ?? 0) }, () => w.writeBits(fields.flowLabel ?? 0, 20));
    w.field({ name: 'ip6.plen', nameVi: 'Payload Length', rfc: 'RFC 8200', descriptionVi: 'Độ dài phần sau header (byte). Header IPv6 cố định 40 byte nên KHÔNG tính vào đây.', display: `${plen} byte` }, () => w.writeUint(plen, 2));
    w.field({ name: 'ip6.nh', nameVi: 'Next Header', rfc: 'RFC 8200', descriptionVi: 'Giao thức tầng trên (hoặc extension header). 58=ICMPv6, 6=TCP, 17=UDP, 89=OSPFv3.', display: `${fields.nextHeader} — ${nhName(fields.nextHeader)}` }, () => w.writeUint(fields.nextHeader, 1));
    w.field({ name: 'ip6.hop', nameVi: 'Hop Limit', rfc: 'RFC 8200', descriptionVi: 'Như TTL của IPv4: mỗi router giảm 1, về 0 thì bỏ gói.', display: String(fields.hopLimit ?? 64) }, () => w.writeUint(fields.hopLimit ?? 64, 1));
    w.field({ name: 'ip6.src', nameVi: 'Source', rfc: 'RFC 8200', descriptionVi: 'Địa chỉ IPv6 nguồn (128 bit).', display: fields.src }, () => w.writeBytes(parseIpv6(fields.src)));
    w.field({ name: 'ip6.dst', nameVi: 'Destination', rfc: 'RFC 8200', descriptionVi: 'Địa chỉ IPv6 đích (128 bit).', display: fields.dst }, () => w.writeBytes(parseIpv6(fields.dst)));
    return w;
  },
};
