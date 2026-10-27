// protocols/llc.js
// IEEE 802.2 LLC header (3 byte) — dùng cho khung 802.3 như BPDU của STP.
// DSAP/SSAP = 0x42 (STP), Control = 0x03 (Unnumbered Information).

import { BitWriter } from '../packet/bytes.js';

export default {
  id: 'llc',
  name: 'LLC (802.2)',
  nameVi: 'LLC 802.2',
  osiLayer: 2,
  rfc: 'IEEE 802.2',
  checksum: null,

  /** fields: { dsap=0x42, ssap=0x42, control=0x03 } */
  build(fields = {}) {
    const w = new BitWriter();
    const dsap = fields.dsap ?? 0x42;
    const ssap = fields.ssap ?? 0x42;
    const control = fields.control ?? 0x03;
    w.field(
      { name: 'llc.dsap', nameVi: 'DSAP', rfc: 'IEEE 802.2',
        descriptionVi: 'Destination SAP = 0x42 → payload là STP (Spanning Tree).', display: '0x42 — STP' },
      () => w.writeUint(dsap, 1),
    );
    w.field(
      { name: 'llc.ssap', nameVi: 'SSAP', rfc: 'IEEE 802.2',
        descriptionVi: 'Source SAP = 0x42 → STP.', display: '0x42 — STP' },
      () => w.writeUint(ssap, 1),
    );
    w.field(
      { name: 'llc.control', nameVi: 'Control', rfc: 'IEEE 802.2',
        descriptionVi: 'Control = 0x03 (Unnumbered Information — gửi không cần đánh số).', display: '0x03 — UI' },
      () => w.writeUint(control, 1),
    );
    return w;
  },
};
