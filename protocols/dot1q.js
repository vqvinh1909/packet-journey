// protocols/dot1q.js
// IEEE 802.1Q VLAN tag — 4 byte chèn giữa Source MAC và EtherType của Ethernet II.
// Khi có tag, trường "EtherType" của khung Ethernet = 0x8100 — đó CHÍNH LÀ TPID
// (báo hiệu có nhãn VLAN). Lớp dot1q này nối tiếp ngay sau, chỉ gồm TCI + EtherType thật,
// KHÔNG lặp lại 0x8100 (nếu lặp sẽ sai byte).
//
// Cấu trúc trên dây: ... src MAC | 0x8100 (eth.type) | TCI(16)=PCP(3)+DEI(1)+VID(12) | EtherType(16) | payload

import { BitWriter } from '../packet/bytes.js';

export default {
  id: 'dot1q',
  name: 'IEEE 802.1Q VLAN Tag',
  nameVi: 'Nhãn VLAN 802.1Q',
  osiLayer: 2,
  rfc: 'IEEE 802.1Q',
  checksum: null,

  /** fields: { pcp, dei, vid, innerType } — innerType là EtherType thật của payload. */
  build(fields) {
    const w = new BitWriter();
    w.field(
      { name: 'dot1q.pcp', nameVi: 'PCP (ưu tiên)', rfc: 'IEEE 802.1p',
        descriptionVi: 'Priority Code Point (0–7): mức ưu tiên QoS của frame.',
        display: String(fields.pcp ?? 0) },
      () => w.writeBits(fields.pcp ?? 0, 3),
    );
    w.field(
      { name: 'dot1q.dei', nameVi: 'DEI', rfc: 'IEEE 802.1Q',
        descriptionVi: 'Drop Eligible Indicator: frame có thể bị loại trước khi tắc nghẽn.',
        display: String(fields.dei ?? 0) },
      () => w.writeBits(fields.dei ?? 0, 1),
    );
    w.field(
      { name: 'dot1q.vid', nameVi: 'VLAN ID', rfc: 'IEEE 802.1Q',
        descriptionVi: 'VLAN ID (1–4094): frame thuộc VLAN nào. Gắn khi vào trunk, gỡ khi ra cổng access.',
        display: String(fields.vid) },
      () => w.writeBits(fields.vid, 12),
    );
    w.field(
      { name: 'dot1q.type', nameVi: 'EtherType', rfc: 'IEEE 802.1Q',
        descriptionVi: 'EtherType thật của payload (vd 0x0800 = IPv4), nằm sau nhãn VLAN.',
        display: `0x${fields.innerType.toString(16).padStart(4, '0')}` },
      () => w.writeUint(fields.innerType, 2),
    );
    return w;
  },
};
