// protocols/mpls.js
// MPLS label stack entry — RFC 3032. Mỗi nhãn 4 byte: Label(20) + TC/EXP(3) + S(1) + TTL(8).
// Khung Ethernet mang MPLS dùng EtherType 0x8847 (unicast). Nhiều nhãn = chồng nhiều lớp mpls,
// nhãn đáy stack có S = 1.

import { BitWriter } from '../packet/bytes.js';

export default {
  id: 'mpls',
  name: 'MPLS',
  nameVi: 'Nhãn MPLS',
  osiLayer: 2.5,
  rfc: 'RFC 3032',
  checksum: null,

  /** fields: { label, tc=0, s=1, ttl=255 } */
  build(fields) {
    const w = new BitWriter();
    w.field({ name: 'mpls.label', nameVi: 'Label', rfc: 'RFC 3032',
      descriptionVi: 'Nhãn 20-bit. Router tra LFIB theo nhãn này (không tra IP) để chuyển tiếp — "label switching".', display: String(fields.label) },
      () => w.writeBits(fields.label, 20));
    w.field({ name: 'mpls.tc', nameVi: 'TC (EXP)', rfc: 'RFC 5462',
      descriptionVi: 'Traffic Class (3 bit) cho QoS.', display: String(fields.tc ?? 0) }, () => w.writeBits(fields.tc ?? 0, 3));
    w.field({ name: 'mpls.s', nameVi: 'S (Bottom of Stack)', rfc: 'RFC 3032',
      descriptionVi: 'S=1: đây là nhãn ĐÁY stack (sau nó là payload IP). S=0: còn nhãn nữa.', display: (fields.s ?? 1) ? '1 (đáy)' : '0' },
      () => w.writeBits(fields.s ?? 1, 1));
    w.field({ name: 'mpls.ttl', nameVi: 'TTL', rfc: 'RFC 3032',
      descriptionVi: 'TTL riêng của MPLS, giảm mỗi hop trong lõi (tách khỏi TTL của IP).', display: String(fields.ttl ?? 255) },
      () => w.writeUint(fields.ttl ?? 255, 1));
    return w;
  },
};
