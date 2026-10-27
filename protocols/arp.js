// protocols/arp.js
// Address Resolution Protocol — RFC 826. Bản cho Ethernet + IPv4 dài 28 byte.
// ARP hỏi "ai có IP này? cho tôi xin MAC" — nối tầng 3 (IP) với tầng 2 (MAC).

import { BitWriter } from '../packet/bytes.js';
import { parseMac, parseIp } from '../packet/addr.js';

export const ARP_OP = { REQUEST: 1, REPLY: 2 };

export default {
  id: 'arp',
  name: 'ARP',
  nameVi: 'ARP (phân giải địa chỉ)',
  osiLayer: 2.5,
  rfc: 'RFC 826',
  checksum: null,

  /** fields: { opcode, senderMac, senderIp, targetMac, targetIp } */
  build(fields) {
    const w = new BitWriter();
    w.field(
      { name: 'arp.htype', nameVi: 'Hardware type', rfc: 'RFC 826',
        descriptionVi: 'Loại địa chỉ phần cứng. 1 = Ethernet.', display: '1 — Ethernet' },
      () => w.writeUint(1, 2),
    );
    w.field(
      { name: 'arp.ptype', nameVi: 'Protocol type', rfc: 'RFC 826',
        descriptionVi: 'Loại địa chỉ tầng mạng cần phân giải. 0x0800 = IPv4.', display: '0x0800 — IPv4' },
      () => w.writeUint(0x0800, 2),
    );
    w.field(
      { name: 'arp.hlen', nameVi: 'Hardware size', rfc: 'RFC 826',
        descriptionVi: 'Độ dài địa chỉ MAC = 6 byte.', display: '6' },
      () => w.writeUint(6, 1),
    );
    w.field(
      { name: 'arp.plen', nameVi: 'Protocol size', rfc: 'RFC 826',
        descriptionVi: 'Độ dài địa chỉ IPv4 = 4 byte.', display: '4' },
      () => w.writeUint(4, 1),
    );
    w.field(
      { name: 'arp.oper', nameVi: 'Opcode', rfc: 'RFC 826',
        descriptionVi: '1 = Request (hỏi MAC), 2 = Reply (trả lời MAC).',
        display: fields.opcode === ARP_OP.REQUEST ? '1 — Request' : '2 — Reply' },
      () => w.writeUint(fields.opcode, 2),
    );
    w.field(
      { name: 'arp.sha', nameVi: 'Sender MAC', rfc: 'RFC 826',
        descriptionVi: 'MAC của bên gửi gói ARP này.', display: fields.senderMac },
      () => w.writeBytes(parseMac(fields.senderMac)),
    );
    w.field(
      { name: 'arp.spa', nameVi: 'Sender IP', rfc: 'RFC 826',
        descriptionVi: 'IP của bên gửi. Trong Request, đây là người đang đi hỏi.', display: fields.senderIp },
      () => w.writeBytes(parseIp(fields.senderIp)),
    );
    w.field(
      { name: 'arp.tha', nameVi: 'Target MAC', rfc: 'RFC 826',
        descriptionVi: 'MAC cần tìm. Trong Request để 00:00:00:00:00:00 (chưa biết); Reply điền MAC thật.',
        display: fields.targetMac },
      () => w.writeBytes(parseMac(fields.targetMac)),
    );
    w.field(
      { name: 'arp.tpa', nameVi: 'Target IP', rfc: 'RFC 826',
        descriptionVi: 'IP đang cần phân giải ra MAC.', display: fields.targetIp },
      () => w.writeBytes(parseIp(fields.targetIp)),
    );
    return w;
  },
};
