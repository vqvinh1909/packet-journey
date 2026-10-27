// protocols/vxlan.js
// VXLAN — RFC 7348. Header 8 byte, bọc trong UDP cổng đích 4789. Dùng để tạo mạng L2
// ẢO (cùng VNI) trải trên hạ tầng L3: VTEP đóng gói nguyên khung Ethernet gốc vào VXLAN.
// Header: Flags(8, bit I=0x08) + Reserved(24) + VNI(24) + Reserved(8).

import { BitWriter } from '../packet/bytes.js';

export default {
  id: 'vxlan',
  name: 'VXLAN',
  nameVi: 'VXLAN',
  osiLayer: 4.5,
  rfc: 'RFC 7348',
  checksum: null,

  /** fields: { vni } */
  build(fields) {
    const w = new BitWriter();
    w.field({ name: 'vxlan.flags', nameVi: 'Flags', rfc: 'RFC 7348',
      descriptionVi: 'Bit I = 1 (0x08): trường VNI hợp lệ.', display: '0x08 (I=1)' }, () => w.writeUint(0x08, 1));
    w.field({ name: 'vxlan.resv1', nameVi: 'Reserved', rfc: 'RFC 7348', descriptionVi: 'Dành riêng (24 bit).', display: '0' }, () => w.writeBytes([0, 0, 0]));
    w.field({ name: 'vxlan.vni', nameVi: 'VNI', rfc: 'RFC 7348',
      descriptionVi: 'VXLAN Network Identifier (24 bit) — định danh mạng L2 ảo. ~16 triệu, thay giới hạn 4094 VLAN.', display: String(fields.vni) },
      () => w.writeUint(fields.vni & 0xffffff, 3));
    w.field({ name: 'vxlan.resv2', nameVi: 'Reserved', rfc: 'RFC 7348', descriptionVi: 'Dành riêng (8 bit).', display: '0' }, () => w.writeUint(0, 1));
    return w;
  },
};
