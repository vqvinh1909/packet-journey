// protocols/stp.js
// Spanning Tree Protocol — Configuration BPDU (IEEE 802.1D), 35 byte.
// Đặt sau LLC trong khung 802.3 gửi tới multicast 01:80:c2:00:00:00.
// Bridge ID = Priority(4 bit) + Sys-ID-ext(12 bit, thường = VLAN) + MAC(6 byte).

import { BitWriter } from '../packet/bytes.js';
import { parseMac } from '../packet/addr.js';

function bridgeId(w, prefix, nameVi, priority, sysId, mac) {
  w.field(
    { name: `${prefix}.prio`, nameVi: `${nameVi}: Priority`, rfc: 'IEEE 802.1D',
      descriptionVi: 'Độ ưu tiên (bội số 4096) + Sys-ID-ext (thường = VLAN). Thấp hơn = ưu tiên làm root.',
      display: `${priority} + ${sysId} = ${priority + sysId}` },
    () => w.writeUint(priority + sysId, 2),
  );
  w.field(
    { name: `${prefix}.mac`, nameVi: `${nameVi}: MAC`, rfc: 'IEEE 802.1D',
      descriptionVi: 'MAC của bridge. Khi Priority bằng nhau thì MAC nhỏ hơn thắng (làm root).',
      display: mac },
    () => w.writeBytes(parseMac(mac)),
  );
}

function timeField(w, name, nameVi, seconds, desc) {
  w.field(
    { name, nameVi, rfc: 'IEEE 802.1D', descriptionVi: desc, display: `${seconds}s` },
    () => w.writeUint(Math.round(seconds * 256), 2), // đơn vị 1/256 giây
  );
}

export default {
  id: 'stp',
  name: 'STP BPDU',
  nameVi: 'STP BPDU',
  osiLayer: 2,
  rfc: 'IEEE 802.1D',
  checksum: null,

  /**
   * fields: {
   *   version=0, type=0, flags=0,
   *   rootPriority, rootSysId, rootMac, rootPathCost,
   *   bridgePriority, bridgeSysId, bridgeMac,
   *   portPriority=128, portNumber,
   *   msgAge=0, maxAge=20, hello=2, fwdDelay=15
   * }
   */
  build(fields) {
    const w = new BitWriter();
    w.field(
      { name: 'stp.proto', nameVi: 'Protocol ID', rfc: 'IEEE 802.1D',
        descriptionVi: 'Protocol Identifier = 0x0000 (STP).', display: '0x0000' },
      () => w.writeUint(0, 2),
    );
    w.field(
      { name: 'stp.version', nameVi: 'Version', rfc: 'IEEE 802.1D',
        descriptionVi: '0 = STP (802.1D), 2 = RSTP (802.1w).', display: String(fields.version ?? 0) },
      () => w.writeUint(fields.version ?? 0, 1),
    );
    w.field(
      { name: 'stp.type', nameVi: 'BPDU Type', rfc: 'IEEE 802.1D',
        descriptionVi: '0x00 = Configuration BPDU; 0x80 = TCN.', display: `0x${(fields.type ?? 0).toString(16).padStart(2, '0')}` },
      () => w.writeUint(fields.type ?? 0, 1),
    );
    w.field(
      { name: 'stp.flags', nameVi: 'Flags', rfc: 'IEEE 802.1D',
        descriptionVi: 'Bit TC (Topology Change) và TCA. Thường 0x00 khi ổn định.', display: `0x${(fields.flags ?? 0).toString(16).padStart(2, '0')}` },
      () => w.writeUint(fields.flags ?? 0, 1),
    );
    bridgeId(w, 'stp.root', 'Root ID', fields.rootPriority, fields.rootSysId ?? 0, fields.rootMac);
    w.field(
      { name: 'stp.cost', nameVi: 'Root Path Cost', rfc: 'IEEE 802.1D',
        descriptionVi: 'Tổng chi phí đường tới root. Mỗi chặng cộng cost của cổng (100M=19, 1G=4).',
        display: String(fields.rootPathCost ?? 0) },
      () => w.writeUint(fields.rootPathCost ?? 0, 4),
    );
    bridgeId(w, 'stp.bridge', 'Bridge ID', fields.bridgePriority, fields.bridgeSysId ?? 0, fields.bridgeMac);
    w.field(
      { name: 'stp.port', nameVi: 'Port ID', rfc: 'IEEE 802.1D',
        descriptionVi: 'Priority cổng (byte cao, mặc định 128) + số hiệu cổng (byte thấp).',
        display: `${fields.portPriority ?? 128}.${fields.portNumber}` },
      () => w.writeUint(((fields.portPriority ?? 128) << 8) | (fields.portNumber & 0xff), 2),
    );
    timeField(w, 'stp.msgage', 'Message Age', fields.msgAge ?? 0, 'Thời gian từ khi root phát BPDU này.');
    timeField(w, 'stp.maxage', 'Max Age', fields.maxAge ?? 20, 'Giữ thông tin BPDU tối đa bao lâu (mặc định 20s).');
    timeField(w, 'stp.hello', 'Hello Time', fields.hello ?? 2, 'Chu kỳ root phát BPDU (mặc định 2s).');
    timeField(w, 'stp.fwddelay', 'Forward Delay', fields.fwdDelay ?? 15, 'Thời gian ở Listening + Learning (mặc định 15s).');
    return w;
  },
};
