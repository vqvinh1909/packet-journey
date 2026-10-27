// protocols/icmpv6.js
// ICMPv6 — RFC 4443 (Echo) + RFC 4861 (NDP). Checksum BẮT BUỘC, có pseudo-header IPv6.
// NDP thay ARP: Neighbor Solicitation (135) / Advertisement (136) phân giải IPv6 -> MAC.

import { BitWriter } from '../packet/bytes.js';
import { parseMac, parseIpv6 } from '../packet/addr.js';

export const ICMP6 = { ECHO_REQUEST: 128, ECHO_REPLY: 129, RS: 133, RA: 134, NS: 135, NA: 136 };
function typeName(t) {
  return { 128: 'Echo Request', 129: 'Echo Reply', 133: 'Router Solicitation', 134: 'Router Advertisement', 135: 'Neighbor Solicitation', 136: 'Neighbor Advertisement' }[t] || 'Unknown';
}

export default {
  id: 'icmpv6',
  name: 'ICMPv6',
  nameVi: 'ICMPv6',
  osiLayer: 3,
  rfc: 'RFC 4443/4861',
  checksum: 'transport6',
  checksumField: 'icmp6.checksum',
  ipProto: 58,

  /**
   * fields:
   *  Echo:  { type:128/129, identifier, seq, data }
   *  NS:    { type:135, target, lladdr? }   (Source Link-Layer option)
   *  NA:    { type:136, target, lladdr?, naR, naS, naO }  (Target Link-Layer option)
   */
  build(fields) {
    const w = new BitWriter();
    const type = fields.type;
    w.field({ name: 'icmp6.type', nameVi: 'Type', rfc: 'RFC 4443', descriptionVi: '128/129 = Echo; 135 = Neighbor Solicitation; 136 = Neighbor Advertisement (thay ARP).', display: `${type} — ${typeName(type)}` }, () => w.writeUint(type, 1));
    w.field({ name: 'icmp6.code', nameVi: 'Code', rfc: 'RFC 4443', descriptionVi: 'Mã con (0 cho các bản tin này).', display: String(fields.code ?? 0) }, () => w.writeUint(fields.code ?? 0, 1));
    w.field({ name: 'icmp6.checksum', nameVi: 'Checksum', rfc: 'RFC 4443', descriptionVi: 'BẮT BUỘC, tính trên pseudo-header IPv6 + bản tin ICMPv6.', display: '(tính khi serialize)' }, () => w.writeUint(0, 2));

    if (type === ICMP6.ECHO_REQUEST || type === ICMP6.ECHO_REPLY) {
      w.field({ name: 'icmp6.id', nameVi: 'Identifier', rfc: 'RFC 4443', descriptionVi: 'Khớp Request với Reply.', display: `0x${(fields.identifier ?? 0).toString(16).padStart(4, '0')}` }, () => w.writeUint(fields.identifier ?? 0, 2));
      w.field({ name: 'icmp6.seq', nameVi: 'Sequence', rfc: 'RFC 4443', descriptionVi: 'Số thứ tự ping.', display: String(fields.seq ?? 0) }, () => w.writeUint(fields.seq ?? 0, 2));
      const data = fields.data ?? [];
      if (data.length) w.field({ name: 'icmp6.data', nameVi: 'Data', rfc: 'RFC 4443', descriptionVi: 'Dữ liệu đệm.', display: `${data.length} byte` }, () => w.writeBytes(data));
    } else if (type === ICMP6.NS || type === ICMP6.NA) {
      if (type === ICMP6.NA) {
        const flags = ((fields.naR ? 1 : 0) << 7) | ((fields.naS ? 1 : 0) << 6) | ((fields.naO ? 1 : 0) << 5);
        w.field({ name: 'icmp6.flags', nameVi: 'Flags (R/S/O)', rfc: 'RFC 4861', descriptionVi: 'R=Router, S=Solicited (trả lời đúng yêu cầu), O=Override.', display: `R${fields.naR ? 1 : 0} S${fields.naS ? 1 : 0} O${fields.naO ? 1 : 0}` }, () => w.writeUint(flags, 1));
        w.field({ name: 'icmp6.resv', nameVi: 'Reserved', rfc: 'RFC 4861', descriptionVi: 'Dành riêng.', display: '0' }, () => w.writeBytes([0, 0, 0]));
      } else {
        w.field({ name: 'icmp6.resv', nameVi: 'Reserved', rfc: 'RFC 4861', descriptionVi: 'Dành riêng.', display: '0' }, () => w.writeBytes([0, 0, 0, 0]));
      }
      w.field({ name: 'icmp6.target', nameVi: 'Target Address', rfc: 'RFC 4861', descriptionVi: type === ICMP6.NS ? 'IPv6 cần phân giải ra MAC.' : 'IPv6 đang được quảng bá kèm MAC.', display: fields.target }, () => w.writeBytes(parseIpv6(fields.target)));
      if (fields.lladdr) {
        const optType = type === ICMP6.NS ? 1 : 2; // 1 = Source LLA, 2 = Target LLA
        w.field({ name: 'icmp6.opt', nameVi: type === ICMP6.NS ? 'Opt: Source Link-Layer' : 'Opt: Target Link-Layer', rfc: 'RFC 4861', descriptionVi: 'Kèm MAC để bên kia khỏi phải hỏi lại.', display: fields.lladdr }, () => { w.writeUint(optType, 1); w.writeUint(1, 1); w.writeBytes(parseMac(fields.lladdr)); });
      }
    } else if (type === ICMP6.RS) {
      w.field({ name: 'icmp6.resv', nameVi: 'Reserved', rfc: 'RFC 4861', descriptionVi: 'Dành riêng.', display: '0' }, () => w.writeBytes([0, 0, 0, 0]));
      if (fields.lladdr) w.field({ name: 'icmp6.opt', nameVi: 'Opt: Source Link-Layer', rfc: 'RFC 4861', descriptionVi: 'MAC của host gửi RS.', display: fields.lladdr }, () => { w.writeUint(1, 1); w.writeUint(1, 1); w.writeBytes(parseMac(fields.lladdr)); });
    } else if (type === ICMP6.RA) {
      w.field({ name: 'icmp6.curhop', nameVi: 'Cur Hop Limit', rfc: 'RFC 4861', descriptionVi: 'Hop Limit router đề nghị host dùng.', display: String(fields.raCurHop ?? 64) }, () => w.writeUint(fields.raCurHop ?? 64, 1));
      const raFlags = ((fields.raM ? 1 : 0) << 7) | ((fields.raO ? 1 : 0) << 6);
      w.field({ name: 'icmp6.raflags', nameVi: 'Flags (M/O)', rfc: 'RFC 4861', descriptionVi: 'M=Managed (dùng DHCPv6 lấy địa chỉ), O=Other (DHCPv6 chỉ lấy DNS...). M=0,O=0 → SLAAC thuần.', display: `M${fields.raM ? 1 : 0} O${fields.raO ? 1 : 0}` }, () => w.writeUint(raFlags, 1));
      w.field({ name: 'icmp6.ralife', nameVi: 'Router Lifetime', rfc: 'RFC 4861', descriptionVi: 'Thời gian coi router này là default gateway (giây).', display: `${fields.raLifetime ?? 1800}s` }, () => w.writeUint(fields.raLifetime ?? 1800, 2));
      w.field({ name: 'icmp6.reach', nameVi: 'Reachable Time', rfc: 'RFC 4861', descriptionVi: 'ms coi láng giềng còn sống sau khi xác nhận.', display: '0' }, () => w.writeUint(0, 4));
      w.field({ name: 'icmp6.retrans', nameVi: 'Retrans Timer', rfc: 'RFC 4861', descriptionVi: 'ms giữa các lần gửi lại NS.', display: '0' }, () => w.writeUint(0, 4));
      if (fields.prefix) {
        const plen = fields.prefixLen ?? 64;
        const pflags = (1 << 7) | (1 << 6); // L (on-link) + A (autonomous) = SLAAC được phép
        w.field({ name: 'icmp6.pio', nameVi: 'Opt: Prefix Information', rfc: 'RFC 4861',
          descriptionVi: `Prefix ${fields.prefix}/${plen} + cờ A (host tự sinh địa chỉ bằng SLAAC). Host ghép prefix + Interface ID.`, display: `${fields.prefix}/${plen}` },
          () => {
            w.writeUint(3, 1); w.writeUint(4, 1); // type 3, length 4 (×8 = 32 byte)
            w.writeUint(plen, 1); w.writeUint(pflags, 1);
            w.writeUint(fields.prefixValid ?? 86400, 4);
            w.writeUint(fields.prefixPref ?? 14400, 4);
            w.writeUint(0, 4);
            w.writeBytes(parseIpv6(fields.prefix));
          });
      }
    }
    return w;
  },
};
