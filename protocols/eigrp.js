// protocols/eigrp.js
// EIGRP (RFC 7868) — header 20 byte + TLV. Chạy trực tiếp trên IP (protocol 88),
// gửi tới multicast 224.0.0.10. Gói Hello (Opcode 5) mang Parameters TLV (K-values + Hold).
// Checksum = IP checksum trên toàn gói EIGRP (checksum = 0 lúc tính).

import { BitWriter } from '../packet/bytes.js';

export const EIGRP_OP = { UPDATE: 1, QUERY: 3, REPLY: 4, HELLO: 5 };
function opName(o) {
  return { 1: 'Update', 3: 'Query', 4: 'Reply', 5: 'Hello/Ack' }[o] || 'Unknown';
}

export default {
  id: 'eigrp',
  name: 'EIGRP',
  nameVi: 'EIGRP',
  osiLayer: 3,
  rfc: 'RFC 7868',
  checksum: 'self',
  checksumField: 'eigrp.checksum',

  /**
   * fields: {
   *   opcode=5, flags=0, sequence=0, ack=0, asn=100,
   *   hello:true -> kèm Parameters TLV { k:[1,0,1,0,0,0], hold:15 }
   * }
   */
  build(fields) {
    const w = new BitWriter();
    const op = fields.opcode ?? EIGRP_OP.HELLO;
    w.field({ name: 'eigrp.version', nameVi: 'Header Version', rfc: 'RFC 7868',
      descriptionVi: 'Phiên bản header EIGRP = 2.', display: '2' }, () => w.writeUint(2, 1));
    w.field({ name: 'eigrp.opcode', nameVi: 'Opcode', rfc: 'RFC 7868',
      descriptionVi: '5 = Hello/Ack, 1 = Update (gửi route), 3 = Query, 4 = Reply (DUAL).',
      display: `${op} — ${opName(op)}` }, () => w.writeUint(op, 1));
    w.field({ name: 'eigrp.checksum', nameVi: 'Checksum', rfc: 'RFC 7868',
      descriptionVi: 'Checksum toàn gói EIGRP.', display: '(tính khi serialize)' }, () => w.writeUint(0, 2));
    w.field({ name: 'eigrp.flags', nameVi: 'Flags', rfc: 'RFC 7868',
      descriptionVi: 'Cờ (Init, Conditional Receive...). Hello thường = 0.', display: `0x${(fields.flags ?? 0).toString(16).padStart(8, '0')}` },
      () => w.writeUint(fields.flags ?? 0, 4));
    w.field({ name: 'eigrp.seq', nameVi: 'Sequence', rfc: 'RFC 7868',
      descriptionVi: 'Số thứ tự cho truyền tin cậy (RTP). Hello = 0.', display: String(fields.sequence ?? 0) },
      () => w.writeUint(fields.sequence ?? 0, 4));
    w.field({ name: 'eigrp.ack', nameVi: 'Acknowledgment', rfc: 'RFC 7868',
      descriptionVi: 'Xác nhận Sequence của bên kia (RTP).', display: String(fields.ack ?? 0) },
      () => w.writeUint(fields.ack ?? 0, 4));
    w.field({ name: 'eigrp.vrid', nameVi: 'Virtual Router ID', rfc: 'RFC 7868',
      descriptionVi: '0 = bảng định tuyến unicast thường.', display: '0' }, () => w.writeUint(0, 2));
    w.field({ name: 'eigrp.asn', nameVi: 'AS Number', rfc: 'RFC 7868',
      descriptionVi: 'Số AS EIGRP. Hai router phải CÙNG AS mới thành láng giềng.', display: String(fields.asn ?? 100) },
      () => w.writeUint(fields.asn ?? 100, 2));

    if (fields.hello) {
      const k = fields.k ?? [1, 0, 1, 0, 0, 0];
      const hold = fields.hold ?? 15;
      w.field({ name: 'eigrp.tlv.type', nameVi: 'TLV: Parameters', rfc: 'RFC 7868',
        descriptionVi: 'TLV type 0x0001 = Parameters (K-values + Hold Time).', display: '0x0001' },
        () => w.writeUint(0x0001, 2));
      w.field({ name: 'eigrp.tlv.len', nameVi: 'TLV Length', rfc: 'RFC 7868',
        descriptionVi: 'Độ dài TLV = 12 byte.', display: '12' }, () => w.writeUint(12, 2));
      w.field({ name: 'eigrp.k', nameVi: 'K1..K6', rfc: 'RFC 7868',
        descriptionVi: 'Trọng số metric. Mặc định K1=K3=1, còn lại 0. Phải KHỚP hai bên.', display: `K=[${k.join(',')}]` },
        () => w.writeBytes(k));
      w.field({ name: 'eigrp.hold', nameVi: 'Hold Time', rfc: 'RFC 7868',
        descriptionVi: 'Không nghe Hello trong ngần này giây thì coi láng giềng chết. Mặc định 15s.', display: `${hold}s` },
        () => w.writeUint(hold, 2));
    }
    return w;
  },
};
