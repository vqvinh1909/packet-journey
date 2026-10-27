// protocols/ethernet.js
// Ethernet II frame header (DIX). RFC 894 / IEEE 802.3.
// 14 byte: Destination MAC (6) + Source MAC (6) + EtherType (2). Payload theo sau.
// Đơn giản hóa: KHÔNG đính FCS (CRC32) cuối frame — Wireshark và file .pcap mặc định
// cũng không chứa FCS; ta ghi rõ "đơn giản hóa" ở phần giải thích.

import { BitWriter } from '../packet/bytes.js';
import { parseMac } from '../packet/addr.js';

export const ETHERTYPE = {
  IPv4: 0x0800,
  ARP: 0x0806,
  DOT1Q: 0x8100,
  IPv6: 0x86dd,
  MPLS: 0x8847,
};

function etherTypeName(v) {
  for (const [k, val] of Object.entries(ETHERTYPE)) if (val === v) return k;
  return 'Unknown';
}

export default {
  id: 'ethernet',
  name: 'Ethernet II',
  nameVi: 'Khung Ethernet II',
  osiLayer: 2,
  rfc: 'IEEE 802.3 / RFC 894',
  checksum: null,

  /**
   * fields: { dst, src, etherType }  — khung Ethernet II (DIX), hoặc
   *         { dst, src, mode:'802.3' } — khung IEEE 802.3 (trường cuối là Length).
   * ctx.payloadLength dùng để điền Length cho khung 802.3 (vd BPDU của STP).
   */
  build(fields, ctx = {}) {
    const w = new BitWriter();
    w.field(
      { name: 'eth.dst', nameVi: 'MAC đích', rfc: 'IEEE 802.3',
        descriptionVi: 'Địa chỉ MAC thiết bị nhận trên cùng đoạn mạng. ff:ff:ff:ff:ff:ff = broadcast; 01:80:c2:00:00:00 = multicast STP.',
        display: fields.dst },
      () => w.writeBytes(parseMac(fields.dst)),
    );
    w.field(
      { name: 'eth.src', nameVi: 'MAC nguồn', rfc: 'IEEE 802.3',
        descriptionVi: 'Địa chỉ MAC thiết bị gửi khung này. Bị VIẾT LẠI ở mỗi chặng khi router chuyển tiếp.',
        display: fields.src },
      () => w.writeBytes(parseMac(fields.src)),
    );
    if (fields.mode === '802.3') {
      const len = ctx.payloadLength ?? 0;
      w.field(
        { name: 'eth.len', nameVi: 'Length', rfc: 'IEEE 802.3',
          descriptionVi: 'Khung 802.3: trường này là ĐỘ DÀI payload (≤ 1500), phân biệt với EtherType (≥ 1536). Dùng cho BPDU/STP.',
          display: `${len} byte` },
        () => w.writeUint(len, 2),
      );
    } else {
      w.field(
        { name: 'eth.type', nameVi: 'EtherType', rfc: 'IEEE 802.3',
          descriptionVi: 'Cho biết payload là giao thức gì, để bên nhận bóc đúng tầng trên.',
          display: `0x${fields.etherType.toString(16).padStart(4, '0')} — ${etherTypeName(fields.etherType)}` },
        () => w.writeUint(fields.etherType, 2),
      );
    }
    return w;
  },
};
