// protocols/icmp.js
// Internet Control Message Protocol — RFC 792. M1 dùng Echo Request (type 8) /
// Echo Reply (type 0) cho ping. Checksum tính trên TOÀN BỘ bản tin ICMP (header + data).

import { BitWriter } from '../packet/bytes.js';

export const ICMP_TYPE = {
  ECHO_REPLY: 0,
  ECHO_REQUEST: 8,
  DEST_UNREACHABLE: 3,
  TIME_EXCEEDED: 11,
};

function typeName(t) {
  switch (t) {
    case 0: return 'Echo Reply';
    case 8: return 'Echo Request';
    case 3: return 'Destination Unreachable';
    case 11: return 'Time Exceeded';
    default: return 'Unknown';
  }
}

export default {
  id: 'icmp',
  name: 'ICMP',
  nameVi: 'ICMP',
  osiLayer: 3,
  rfc: 'RFC 792',
  checksum: 'self',          // checksum trên toàn bộ byte của lớp ICMP (header + data)
  checksumField: 'icmp.checksum',

  /** fields: { type, code, identifier, seq, data: number[] } */
  build(fields) {
    const w = new BitWriter();
    const data = fields.data ?? [];
    w.field(
      { name: 'icmp.type', nameVi: 'Type', rfc: 'RFC 792',
        descriptionVi: 'Loại bản tin. 8 = Echo Request (ping đi), 0 = Echo Reply (ping về).',
        display: `${fields.type} — ${typeName(fields.type)}` },
      () => w.writeUint(fields.type, 1),
    );
    w.field(
      { name: 'icmp.code', nameVi: 'Code', rfc: 'RFC 792',
        descriptionVi: 'Mã con của type. Với Echo = 0.', display: String(fields.code ?? 0) },
      () => w.writeUint(fields.code ?? 0, 1),
    );
    w.field(
      { name: 'icmp.checksum', nameVi: 'Checksum', rfc: 'RFC 792',
        descriptionVi: 'Checksum của toàn bộ bản tin ICMP (header + data).',
        display: '(tính khi serialize)' },
      () => w.writeUint(0, 2),
    );
    w.field(
      { name: 'icmp.id', nameVi: 'Identifier', rfc: 'RFC 792',
        descriptionVi: 'ID để khớp Request với Reply (thường là PID tiến trình ping).',
        display: `0x${(fields.identifier ?? 0).toString(16).padStart(4, '0')} (${fields.identifier ?? 0})` },
      () => w.writeUint(fields.identifier ?? 0, 2),
    );
    w.field(
      { name: 'icmp.seq', nameVi: 'Sequence', rfc: 'RFC 792',
        descriptionVi: 'Số thứ tự gói ping, tăng dần mỗi lần gửi.', display: String(fields.seq ?? 0) },
      () => w.writeUint(fields.seq ?? 0, 2),
    );
    if (data.length > 0) {
      w.field(
        { name: 'icmp.data', nameVi: 'Data', rfc: 'RFC 792',
          descriptionVi: 'Dữ liệu đệm; bên nhận sao chép nguyên vẹn vào Echo Reply.',
          display: `${data.length} byte` },
        () => w.writeBytes(data),
      );
    }
    return w;
  },
};
