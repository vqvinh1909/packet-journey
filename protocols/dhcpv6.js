// protocols/dhcpv6.js
// DHCPv6 (RFC 8415) — chạy trong UDP (client 546 ↔ server 547, multicast ff02::1:2).
// Header gọn: msg-type(1) + transaction-id(3) + các Option (code2/len2/value).

import { BitWriter } from '../packet/bytes.js';

function msgName(t) { return { 1: 'SOLICIT', 2: 'ADVERTISE', 3: 'REQUEST', 4: 'CONFIRM', 5: 'RENEW', 7: 'REPLY' }[t] || '?'; }
const OPT_NAME = { 1: 'Client ID', 2: 'Server ID', 3: 'IA_NA', 5: 'IA Address', 6: 'ORO', 23: 'DNS Servers' };

export default {
  id: 'dhcpv6',
  name: 'DHCPv6',
  nameVi: 'DHCPv6',
  osiLayer: 7,
  rfc: 'RFC 8415',
  checksum: null,

  /** fields: { msgType, xid (số 24-bit), options: [ { code, data:[...], display? } ] } */
  build(fields) {
    const w = new BitWriter();
    w.field({ name: 'dhcp6.type', nameVi: 'Message Type', rfc: 'RFC 8415', descriptionVi: '1 SOLICIT, 2 ADVERTISE, 3 REQUEST, 7 REPLY.', display: `${fields.msgType} — ${msgName(fields.msgType)}` }, () => w.writeUint(fields.msgType, 1));
    w.field({ name: 'dhcp6.xid', nameVi: 'Transaction ID', rfc: 'RFC 8415', descriptionVi: 'ID 24-bit khớp 4 bản tin của cùng một phiên.', display: `0x${(fields.xid >>> 0).toString(16).padStart(6, '0')}` }, () => w.writeUint(fields.xid & 0xffffff, 3));
    for (const opt of fields.options || []) {
      const name = OPT_NAME[opt.code] || `Option ${opt.code}`;
      w.field({ name: `dhcp6.opt${opt.code}`, nameVi: `Opt ${opt.code}: ${name}`, rfc: 'RFC 8415', descriptionVi: opt.desc || `DHCPv6 option ${opt.code}.`, display: opt.display || `${opt.data.length} byte` },
        () => { w.writeUint(opt.code, 2); w.writeUint(opt.data.length, 2); w.writeBytes(opt.data); });
    }
    return w;
  },
};
