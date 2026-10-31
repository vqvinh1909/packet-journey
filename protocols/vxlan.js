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

  /** fields: { vni, sgt? } sgt: VXLAN-GPO, nhóm chính sách trong SD-Access */
  build(fields) {
    const w = new BitWriter();
    w.field({ name: 'vxlan.flags', nameVi: 'Flags', rfc: 'RFC 7348',
      descriptionVi: 'Bit I = 1 (0x08): trường VNI hợp lệ. Bit G = 1 (0x80): có Group Policy ID.', display: fields.sgt != null ? '0x88 (G=1, I=1)' : '0x08 (I=1)' }, () => w.writeUint(fields.sgt != null ? 0x88 : 0x08, 1));
    if (fields.sgt != null) {
      w.field({ name: 'vxlan.gpo', nameVi: 'Group Policy ID', rfc: 'draft-smith-vxlan-group-policy', descriptionVi: 'Nhãn nhóm SGT của máy gửi (byte đầu dành cho cờ). Thiết bị đích dùng nó để tra SGACL.', display: `SGT ${fields.sgt}` }, () => w.writeBytes([0, (fields.sgt >> 8) & 0xff, fields.sgt & 0xff]));
    } else w.field({ name: 'vxlan.resv1', nameVi: 'Reserved', rfc: 'RFC 7348', descriptionVi: 'Dành riêng (24 bit).', display: '0' }, () => w.writeBytes([0, 0, 0]));
    w.field({ name: 'vxlan.vni', nameVi: 'VNI', rfc: 'RFC 7348',
      descriptionVi: 'VXLAN Network Identifier (24 bit) — định danh mạng L2 ảo. ~16 triệu, thay giới hạn 4094 VLAN.', display: String(fields.vni) },
      () => w.writeUint(fields.vni & 0xffffff, 3));
    w.field({ name: 'vxlan.resv2', nameVi: 'Reserved', rfc: 'RFC 7348', descriptionVi: 'Dành riêng (8 bit).', display: '0' }, () => w.writeUint(0, 1));
    return w;
  },
};
