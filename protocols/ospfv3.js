// protocols/ospfv3.js
// OSPFv3 (RFC 5340) — OSPF cho IPv6. Header 16 byte (bỏ Auth của v2, thêm Instance ID).
// Chạy trên IPv6 (Next Header 89), gửi tới FF02::5. Checksum dùng pseudo-header IPv6.

import { BitWriter } from '../packet/bytes.js';
import { parseIp } from '../packet/addr.js';


export default {
  id: 'ospfv3',
  name: 'OSPFv3',
  nameVi: 'OSPFv3',
  osiLayer: 3,
  rfc: 'RFC 5340',
  checksum: 'transport6',
  checksumField: 'ospf6.checksum',
  ipProto: 89,

  /** fields (Hello): { routerId, areaId='0.0.0.0', instanceId=0, interfaceId=1, priority=1, neighbors:[rid...] } */
  build(fields) {
    const w = new BitWriter();
    const neighbors = fields.neighbors || [];
    const pktLen = 16 + 20 + 4 * neighbors.length;
    w.field({ name: 'ospf6.version', nameVi: 'Version', rfc: 'RFC 5340', descriptionVi: 'OSPF version = 3.', display: '3' }, () => w.writeUint(3, 1));
    w.field({ name: 'ospf6.type', nameVi: 'Type', rfc: 'RFC 5340', descriptionVi: '1 = Hello.', display: '1 — Hello' }, () => w.writeUint(1, 1));
    w.field({ name: 'ospf6.len', nameVi: 'Packet Length', rfc: 'RFC 5340', descriptionVi: 'Độ dài toàn gói OSPFv3.', display: `${pktLen} byte` }, () => w.writeUint(pktLen, 2));
    w.field({ name: 'ospf6.rid', nameVi: 'Router ID', rfc: 'RFC 5340', descriptionVi: 'Vẫn là số 32-bit dạng IPv4, dù chạy trên IPv6.', display: fields.routerId }, () => w.writeBytes(parseIp(fields.routerId)));
    w.field({ name: 'ospf6.area', nameVi: 'Area ID', rfc: 'RFC 5340', descriptionVi: 'Vùng OSPF (32-bit). 0.0.0.0 = backbone.', display: fields.areaId ?? '0.0.0.0' }, () => w.writeBytes(parseIp(fields.areaId ?? '0.0.0.0')));
    w.field({ name: 'ospf6.checksum', nameVi: 'Checksum', rfc: 'RFC 5340', descriptionVi: 'Dùng cơ chế checksum của IPv6 (pseudo-header). OSPFv3 BỎ trường Authentication của v2 (bảo mật dựa vào IPsec).', display: '(tính khi serialize)' }, () => w.writeUint(0, 2));
    w.field({ name: 'ospf6.inst', nameVi: 'Instance ID', rfc: 'RFC 5340', descriptionVi: 'Cho phép nhiều thực thể OSPFv3 trên cùng một link.', display: String(fields.instanceId ?? 0) }, () => w.writeUint(fields.instanceId ?? 0, 1));
    w.field({ name: 'ospf6.resv', nameVi: 'Reserved', rfc: 'RFC 5340', descriptionVi: 'Dành riêng = 0.', display: '0' }, () => w.writeUint(0, 1));
    // Hello body
    w.field({ name: 'ospf6.ifid', nameVi: 'Interface ID', rfc: 'RFC 5340', descriptionVi: 'OSPFv3 định danh cổng theo Interface ID (không theo IP như v2).', display: String(fields.interfaceId ?? 1) }, () => w.writeUint(fields.interfaceId ?? 1, 4));
    w.field({ name: 'ospf6.prio', nameVi: 'Router Priority', rfc: 'RFC 5340', descriptionVi: 'Ưu tiên bầu DR/BDR.', display: String(fields.priority ?? 1) }, () => w.writeUint(fields.priority ?? 1, 1));
    w.field({ name: 'ospf6.opts', nameVi: 'Options', rfc: 'RFC 5340', descriptionVi: 'Cờ khả năng (3 byte).', display: '0x000013' }, () => w.writeBytes([0, 0, 0x13]));
    w.field({ name: 'ospf6.hello', nameVi: 'Hello Interval', rfc: 'RFC 5340', descriptionVi: 'Chu kỳ Hello (giây). Phải khớp.', display: `${fields.helloInterval ?? 10}s` }, () => w.writeUint(fields.helloInterval ?? 10, 2));
    w.field({ name: 'ospf6.dead', nameVi: 'Dead Interval', rfc: 'RFC 5340', descriptionVi: 'Hết giờ coi láng giềng chết.', display: `${fields.deadInterval ?? 40}s` }, () => w.writeUint(fields.deadInterval ?? 40, 2));
    w.field({ name: 'ospf6.dr', nameVi: 'Designated Router', rfc: 'RFC 5340', descriptionVi: 'Router ID của DR (0.0.0.0 khi chưa bầu).', display: fields.dr ?? '0.0.0.0' }, () => w.writeBytes(parseIp(fields.dr ?? '0.0.0.0')));
    w.field({ name: 'ospf6.bdr', nameVi: 'Backup DR', rfc: 'RFC 5340', descriptionVi: 'Router ID của BDR.', display: fields.bdr ?? '0.0.0.0' }, () => w.writeBytes(parseIp(fields.bdr ?? '0.0.0.0')));
    neighbors.forEach((n, i) => w.field({ name: `ospf6.nbr${i}`, nameVi: `Neighbor ${i + 1}`, rfc: 'RFC 5340', descriptionVi: 'Router ID láng giềng đã nghe (2-Way).', display: n }, () => w.writeBytes(parseIp(n))));
    return w;
  },
};
