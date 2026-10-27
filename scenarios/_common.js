// scenarios/_common.js
// Tiện ích dùng chung cho các kịch bản: dữ liệu ping mẫu và hàm dựng ngăn xếp layer.

import { BROADCAST_MAC } from '../packet/addr.js';
import { ARP_OP } from '../protocols/arp.js';
import { IP_PROTO } from '../protocols/ipv4.js';
import { ICMP_TYPE } from '../protocols/icmp.js';

export { ARP_OP, IP_PROTO, ICMP_TYPE, BROADCAST_MAC };

/**
 * Payload ping mẫu 32 byte (giống kiểu Windows: 'a'..'w' lặp lại).
 * Đơn giản hóa: không nhúng timestamp như ping Linux.
 */
export function pingData(len = 32) {
  const out = [];
  for (let i = 0; i < len; i++) out.push(0x61 + (i % 23)); // 'a' = 0x61
  return out;
}

/** Ngăn xếp layer cho một gói ARP (Ethernet + ARP). */
export function arpFrame({ op, senderMac, senderIp, targetMac, targetIp, ethDst }) {
  return [
    { proto: 'ethernet', fields: { dst: ethDst, src: senderMac, etherType: 0x0806 } },
    { proto: 'arp', fields: { opcode: op, senderMac, senderIp, targetMac, targetIp } },
  ];
}

/** Ngăn xếp layer cho một gói ICMP Echo (Ethernet + IPv4 + ICMP). */
export function echoFrame({ ethDst, ethSrc, srcIp, dstIp, ttl, ipId, identifier, seq, type, data }) {
  return [
    { proto: 'ethernet', fields: { dst: ethDst, src: ethSrc, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: srcIp, dst: dstIp, ttl, id: ipId, protocol: IP_PROTO.ICMP } },
    { proto: 'icmp', fields: { type, code: 0, identifier, seq, data: data ?? pingData() } },
  ];
}
