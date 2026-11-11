// protocols/udp.js
// User Datagram Protocol — RFC 768. Header 8 byte. Checksum có pseudo-header IPv4
// (do serialize tính vì cần IP nguồn/đích của lớp IPv4 bao ngoài).

import { BitWriter } from '../packet/bytes.js';

const PORT_NAME = { 53: 'DNS', 67: 'DHCP server', 68: 'DHCP client', 123: 'NTP', 161: 'SNMP', 500: 'IKE', 520: 'RIP', 1812: 'RADIUS', 4500: 'IPsec NAT-T' };
function portLabel(p) { return PORT_NAME[p] ? `${p} — ${PORT_NAME[p]}` : String(p); }

export default {
  id: 'udp',
  name: 'UDP',
  nameVi: 'UDP',
  osiLayer: 4,
  rfc: 'RFC 768',
  checksum: 'transport',
  checksumField: 'udp.checksum',
  ipProto: 17,

  /** fields: { srcPort, dstPort }  ctx.payloadLength để tính Length. */
  build(fields, ctx = {}) {
    const w = new BitWriter();
    const length = 8 + (ctx.payloadLength ?? 0);
    w.field({ name: 'udp.src', nameVi: 'Source Port', rfc: 'RFC 768',
      descriptionVi: 'Cổng nguồn. Với client thường là cổng tạm (ephemeral).', display: portLabel(fields.srcPort) },
      () => w.writeUint(fields.srcPort, 2));
    w.field({ name: 'udp.dst', nameVi: 'Destination Port', rfc: 'RFC 768',
      descriptionVi: 'Cổng đích xác định dịch vụ (53 DNS, 67/68 DHCP...).', display: portLabel(fields.dstPort) },
      () => w.writeUint(fields.dstPort, 2));
    w.field({ name: 'udp.len', nameVi: 'Length', rfc: 'RFC 768',
      descriptionVi: 'Độ dài UDP header + data (tối thiểu 8).', display: `${length} byte` },
      () => w.writeUint(length, 2));
    w.field({ name: 'udp.checksum', nameVi: 'Checksum', rfc: 'RFC 768',
      descriptionVi: 'Checksum có pseudo-header (IP nguồn/đích + proto + length). 0 = không dùng.', display: '(tính khi serialize)' },
      () => w.writeUint(0, 2));
    return w;
  },
};
