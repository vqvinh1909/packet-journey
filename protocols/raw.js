// protocols/raw.js
// "Payload thô" — chỉ ghi nguyên mảng byte cho trước. Dùng cho các MẢNH fragment
// thứ 2 trở đi (chỉ chứa phần dữ liệu tiếp theo của gói gốc, không có header L4 riêng).

import { BitWriter } from '../packet/bytes.js';

export default {
  id: 'raw',
  name: 'Data',
  nameVi: 'Dữ liệu (mảnh)',
  osiLayer: 7,
  rfc: '—',
  checksum: null,

  /** fields: { data: number[], desc? } */
  build(fields) {
    const w = new BitWriter();
    w.field({ name: 'raw.data', nameVi: 'Payload', rfc: '—',
      descriptionVi: fields.desc || 'Phần dữ liệu tiếp theo của gói gốc (mảnh này không có header tầng 4 riêng).',
      display: `${fields.data.length} byte` }, () => w.writeBytes(fields.data));
    return w;
  },
};
