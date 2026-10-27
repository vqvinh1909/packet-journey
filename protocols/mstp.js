// protocols/mstp.js
// Phần mở rộng MSTP (IEEE 802.1s) nối SAU BPDU chuẩn (version 3, type 2).
// Gồm: V1 Length, V3 Length, MST Configuration Identifier (region name + revision +
// digest VLAN→instance), tham số CIST, và các bản ghi MSTI (mỗi instance 16 byte).

import { BitWriter } from '../packet/bytes.js';
import { parseMac } from '../packet/addr.js';

function bridgeId(w, name, nameVi, prio, mac) {
  w.field({ name, nameVi, rfc: 'IEEE 802.1s', descriptionVi: 'Priority(2) + MAC(6).', display: `${prio} / ${mac}` },
    () => { w.writeUint(prio, 2); w.writeBytes(parseMac(mac)); });
}

export default {
  id: 'mstp',
  name: 'MSTP ext',
  nameVi: 'Phần mở rộng MSTP',
  osiLayer: 2,
  rfc: 'IEEE 802.1s',
  checksum: null,

  /**
   * fields: {
   *   regionName, revision=0, digest?(16 byte),
   *   cistCost=0, cistPrio=32768, cistMac, cistRemHops=20,
   *   mstis: [ { flags=0, instance, rootPrio, rootMac, cost=0, bridgePrio=128, portPrio=128, remHops=20 } ]
   * }
   */
  build(fields) {
    const w = new BitWriter();
    const mstis = fields.mstis || [];
    const v3len = 64 + 16 * mstis.length; // 51 (config id) + 4 + 8 + 1 + 16*N

    w.field({ name: 'mstp.v1len', nameVi: 'Version 1 Length', rfc: 'IEEE 802.1s', descriptionVi: 'Luôn = 0.', display: '0' }, () => w.writeUint(0, 1));
    w.field({ name: 'mstp.v3len', nameVi: 'Version 3 Length', rfc: 'IEEE 802.1s', descriptionVi: 'Độ dài phần MSTP phía sau.', display: `${v3len} byte` }, () => w.writeUint(v3len, 2));

    // MST Configuration Identifier (51 byte): chung cho một REGION
    w.field({ name: 'mstp.fmt', nameVi: 'Config Format', rfc: 'IEEE 802.1s', descriptionVi: 'Selector = 0.', display: '0' }, () => w.writeUint(0, 1));
    const name = (fields.regionName || 'REGION1').slice(0, 32);
    const nameBytes = [];
    for (let i = 0; i < 32; i++) nameBytes.push(i < name.length ? name.charCodeAt(i) : 0);
    w.field({ name: 'mstp.region', nameVi: 'Region Name', rfc: 'IEEE 802.1s', descriptionVi: '3 thứ phải GIỐNG nhau mới cùng region: tên, revision, và digest (bảng VLAN→instance).', display: name }, () => w.writeBytes(nameBytes));
    w.field({ name: 'mstp.rev', nameVi: 'Revision', rfc: 'IEEE 802.1s', descriptionVi: 'Số revision của cấu hình MST.', display: String(fields.revision ?? 0) }, () => w.writeUint(fields.revision ?? 0, 2));
    const digest = fields.digest || [0x4e, 0x51, 0x3b, 0x5d, 0x75, 0x38, 0xd6, 0xd4, 0x5f, 0x7a, 0x0f, 0x6f, 0x46, 0x9c, 0x1f, 0x8a];
    w.field({ name: 'mstp.digest', nameVi: 'Config Digest', rfc: 'IEEE 802.1s', descriptionVi: 'HMAC-MD5 (16 byte) của bảng ánh xạ VLAN→instance. Khác digest = khác region.', display: '16 byte' }, () => w.writeBytes(digest));

    // CIST (Common and Internal Spanning Tree)
    w.field({ name: 'mstp.cistcost', nameVi: 'CIST Internal Root Cost', rfc: 'IEEE 802.1s', descriptionVi: 'Chi phí tới CIST Regional Root trong region.', display: String(fields.cistCost ?? 0) }, () => w.writeUint(fields.cistCost ?? 0, 4));
    bridgeId(w, 'mstp.cistbridge', 'CIST Bridge ID', fields.cistPrio ?? 32768, fields.cistMac);
    w.field({ name: 'mstp.cisthops', nameVi: 'CIST Remaining Hops', rfc: 'IEEE 802.1s', descriptionVi: 'Số hop còn lại trong region (mặc định 20).', display: String(fields.cistRemHops ?? 20) }, () => w.writeUint(fields.cistRemHops ?? 20, 1));

    // Các MSTI (mỗi instance 16 byte) — cây riêng để CÂN TẢI VLAN
    mstis.forEach((m) => {
      w.field({ name: `mstp.msti${m.instance}.flags`, nameVi: `MSTI ${m.instance}: Flags`, rfc: 'IEEE 802.1s', descriptionVi: 'Cờ vai trò/trạng thái cổng trong instance này.', display: `0x${(m.flags ?? 0).toString(16).padStart(2, '0')}` }, () => w.writeUint(m.flags ?? 0, 1));
      w.field({ name: `mstp.msti${m.instance}.root`, nameVi: `MSTI ${m.instance}: Regional Root ID`, rfc: 'IEEE 802.1s', descriptionVi: 'Root của riêng instance này (có thể khác instance khác → cân tải).', display: `${m.rootPrio} / ${m.rootMac}` }, () => { w.writeUint(m.rootPrio, 2); w.writeBytes(parseMac(m.rootMac)); });
      w.field({ name: `mstp.msti${m.instance}.cost`, nameVi: `MSTI ${m.instance}: Internal Root Cost`, rfc: 'IEEE 802.1s', descriptionVi: 'Chi phí tới root của instance.', display: String(m.cost ?? 0) }, () => w.writeUint(m.cost ?? 0, 4));
      w.field({ name: `mstp.msti${m.instance}.bprio`, nameVi: `MSTI ${m.instance}: Bridge Priority`, rfc: 'IEEE 802.1s', descriptionVi: 'Ưu tiên bridge (4 bit cao) trong instance.', display: String(m.bridgePrio ?? 128) }, () => w.writeUint(m.bridgePrio ?? 128, 1));
      w.field({ name: `mstp.msti${m.instance}.pprio`, nameVi: `MSTI ${m.instance}: Port Priority`, rfc: 'IEEE 802.1s', descriptionVi: 'Ưu tiên cổng trong instance.', display: String(m.portPrio ?? 128) }, () => w.writeUint(m.portPrio ?? 128, 1));
      w.field({ name: `mstp.msti${m.instance}.hops`, nameVi: `MSTI ${m.instance}: Remaining Hops`, rfc: 'IEEE 802.1s', descriptionVi: 'Hop còn lại trong instance.', display: String(m.remHops ?? 20) }, () => w.writeUint(m.remHops ?? 20, 1));
    });
    return w;
  },
};
