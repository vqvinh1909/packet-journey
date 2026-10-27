// protocols/ospf.js
// OSPFv2 (RFC 2328) — common header 24 byte + gói Hello (Type 1).
// OSPF chạy TRỰC TIẾP trên IP (protocol 89), gửi tới multicast 224.0.0.5.
// Checksum: IP checksum trên toàn gói OSPF NHƯNG BỎ 8 byte Authentication (offset 16–23).

import { BitWriter } from '../packet/bytes.js';
import { parseIp } from '../packet/addr.js';
import { internetChecksum } from '../packet/checksum.js';

export const OSPF_TYPE = { HELLO: 1, DBD: 2, LSR: 3, LSU: 4, LSACK: 5 };
function typeName(t) {
  return { 1: 'Hello', 2: 'DB Description', 3: 'LS Request', 4: 'LS Update', 5: 'LS Ack' }[t] || 'Unknown';
}

export default {
  id: 'ospf',
  name: 'OSPFv2',
  nameVi: 'OSPF',
  osiLayer: 3,
  rfc: 'RFC 2328',
  checksumField: 'ospf.checksum',
  // Checksum bỏ qua 8 byte Authentication (offset 16–23); trường checksum (12–13) đang = 0.
  checksum(bytes) {
    const part = bytes.slice(0, 16).concat(bytes.slice(24));
    return internetChecksum(part);
  },

  /**
   * fields (Hello): {
   *   type=1, routerId, areaId='0.0.0.0',
   *   netmask='255.255.255.0', helloInterval=10, options=0x12, priority=1,
   *   deadInterval=40, dr='0.0.0.0', bdr='0.0.0.0', neighbors:[ip,...]
   * }
   */
  build(fields) {
    const w = new BitWriter();
    const type = fields.type ?? OSPF_TYPE.HELLO;
    const neighbors = fields.neighbors || [];
    const pktLen = 24 + (type === OSPF_TYPE.HELLO ? 20 + 4 * neighbors.length : 0);

    w.field({ name: 'ospf.version', nameVi: 'Version', rfc: 'RFC 2328',
      descriptionVi: 'OSPF version = 2.', display: '2' }, () => w.writeUint(2, 1));
    w.field({ name: 'ospf.type', nameVi: 'Type', rfc: 'RFC 2328',
      descriptionVi: '1 = Hello (tìm & duy trì láng giềng), 2 = DBD, 3 = LSR, 4 = LSU, 5 = LSAck.',
      display: `${type} — ${typeName(type)}` }, () => w.writeUint(type, 1));
    w.field({ name: 'ospf.len', nameVi: 'Packet Length', rfc: 'RFC 2328',
      descriptionVi: 'Độ dài toàn gói OSPF (header + body).', display: `${pktLen} byte` }, () => w.writeUint(pktLen, 2));
    w.field({ name: 'ospf.rid', nameVi: 'Router ID', rfc: 'RFC 2328',
      descriptionVi: 'Định danh router (dạng IP), thường là IP loopback cao nhất.', display: fields.routerId },
      () => w.writeBytes(parseIp(fields.routerId)));
    w.field({ name: 'ospf.area', nameVi: 'Area ID', rfc: 'RFC 2328',
      descriptionVi: 'Vùng OSPF. 0.0.0.0 = Area 0 (backbone).', display: fields.areaId ?? '0.0.0.0' },
      () => w.writeBytes(parseIp(fields.areaId ?? '0.0.0.0')));
    w.field({ name: 'ospf.checksum', nameVi: 'Checksum', rfc: 'RFC 2328',
      descriptionVi: 'Checksum toàn gói, BỎ 8 byte Authentication.', display: '(tính khi serialize)' },
      () => w.writeUint(0, 2));
    w.field({ name: 'ospf.autype', nameVi: 'AuType', rfc: 'RFC 2328',
      descriptionVi: 'Kiểu xác thực: 0 = none, 1 = plain, 2 = MD5.', display: '0 — none' },
      () => w.writeUint(0, 2));
    w.field({ name: 'ospf.auth', nameVi: 'Authentication', rfc: 'RFC 2328',
      descriptionVi: '8 byte xác thực (0 khi không dùng). KHÔNG tính vào checksum.', display: '00000000...' },
      () => w.writeBytes([0, 0, 0, 0, 0, 0, 0, 0]));

    if (type === OSPF_TYPE.HELLO) {
      w.field({ name: 'ospf.netmask', nameVi: 'Network Mask', rfc: 'RFC 2328',
        descriptionVi: 'Mask của mạng trên cổng. Hai bên phải KHỚP mới thành láng giềng.', display: fields.netmask ?? '255.255.255.0' },
        () => w.writeBytes(parseIp(fields.netmask ?? '255.255.255.0')));
      w.field({ name: 'ospf.hello', nameVi: 'Hello Interval', rfc: 'RFC 2328',
        descriptionVi: 'Chu kỳ gửi Hello (giây). Phải KHỚP hai bên. Mặc định 10s.', display: `${fields.helloInterval ?? 10}s` },
        () => w.writeUint(fields.helloInterval ?? 10, 2));
      w.field({ name: 'ospf.options', nameVi: 'Options', rfc: 'RFC 2328',
        descriptionVi: 'Các cờ khả năng (vd bit E cho external).', display: `0x${(fields.options ?? 0x12).toString(16)}` },
        () => w.writeUint(fields.options ?? 0x12, 1));
      w.field({ name: 'ospf.prio', nameVi: 'Router Priority', rfc: 'RFC 2328',
        descriptionVi: 'Ưu tiên bầu DR/BDR. CAO hơn thắng; 0 = không ứng cử DR.', display: String(fields.priority ?? 1) },
        () => w.writeUint(fields.priority ?? 1, 1));
      w.field({ name: 'ospf.dead', nameVi: 'Dead Interval', rfc: 'RFC 2328',
        descriptionVi: 'Không nghe Hello trong ngần này giây thì coi láng giềng chết. Mặc định 40s.', display: `${fields.deadInterval ?? 40}s` },
        () => w.writeUint(fields.deadInterval ?? 40, 4));
      w.field({ name: 'ospf.dr', nameVi: 'Designated Router', rfc: 'RFC 2328',
        descriptionVi: 'IP của DR trên đoạn mạng (0.0.0.0 khi chưa bầu).', display: fields.dr ?? '0.0.0.0' },
        () => w.writeBytes(parseIp(fields.dr ?? '0.0.0.0')));
      w.field({ name: 'ospf.bdr', nameVi: 'Backup DR', rfc: 'RFC 2328',
        descriptionVi: 'IP của BDR (0.0.0.0 khi chưa bầu).', display: fields.bdr ?? '0.0.0.0' },
        () => w.writeBytes(parseIp(fields.bdr ?? '0.0.0.0')));
      neighbors.forEach((n, i) => {
        w.field({ name: `ospf.nbr${i}`, nameVi: `Neighbor ${i + 1}`, rfc: 'RFC 2328',
          descriptionVi: 'Router ID của láng giềng đã nghe thấy (xác nhận 2-Way).', display: n },
          () => w.writeBytes(parseIp(n)));
      });
    }
    return w;
  },
};
