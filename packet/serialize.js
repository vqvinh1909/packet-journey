// packet/serialize.js
// Biến một "ngăn xếp layer" thành BYTE THẬT + cây trường (field tree) có offset tuyệt đối.
//
// Một Packet là mảng layer, trong -> ngoài được xếp theo thứ tự xuất hiện trên dây:
//   [ { proto:'ethernet', fields }, { proto:'ipv4', fields }, { proto:'icmp', fields } ]
// (ethernet ngoài cùng đứng trước vì nó ra dây trước).
//
// Cách làm:
//   Phase A — dựng từng layer từ TRONG ra NGOÀI (cuối mảng -> đầu mảng) để IPv4 biết
//             độ dài payload mà điền Total Length; tính & vá checksum của riêng layer đó.
//   Phase B — nối byte từ NGOÀI vào TRONG (đầu -> cuối) và quy đổi offset mỗi trường
//             sang offset tuyệt đối trong cả gói, để hex view highlight đúng.

import { getProtocol } from '../protocols/index.js';
import { internetChecksum, transportChecksum, transportChecksum6 } from './checksum.js';
import { parseIp, parseIpv6 } from './addr.js';
import { toUint8 } from './bytes.js';

export function serialize(layers) {
  // ----- Phase A: dựng byte từng layer (trong -> ngoài) -----
  const built = new Array(layers.length);
  let payloadLength = 0;

  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const proto = getProtocol(layer.proto);
    const w = proto.build(layer.fields, { payloadLength });
    const bytes = w.bytes.slice();
    const fields = w.fields;

    // Checksum: 'self' = internetChecksum trên chính byte của layer (IPv4 header; ICMP;
    // EIGRP). Hoặc proto.checksum là HÀM (bytes)=>number cho trường hợp đặc biệt
    // (OSPF bỏ 8 byte Authentication). Trường checksum để 0 lúc dựng, tính xong vá lại.
    let cksum = null;
    if (proto.checksum === 'self') {
      cksum = internetChecksum(bytes);
    } else if (proto.checksum === 'transport') {
      // UDP/TCP: checksum có pseudo-header. Tự nhận lớp bao ngoài là IPv4 hay IPv6.
      let payload = [];
      for (let j = i + 1; j < built.length; j++) payload = payload.concat(Array.from(built[j].bytes));
      const seg = bytes.concat(payload);
      let v4 = null, v6 = null;
      for (let j = i - 1; j >= 0; j--) {
        if (layers[j].proto === 'ipv4') { v4 = layers[j].fields; break; }
        if (layers[j].proto === 'ipv6') { v6 = layers[j].fields; break; }
      }
      if (v4) {
        cksum = transportChecksum(parseIp(v4.src), parseIp(v4.dst), proto.ipProto, seg);
        if (cksum === 0) cksum = 0xffff; // RFC 768: checksum 0 được truyền thành 0xFFFF
      } else if (v6) {
        cksum = transportChecksum6(parseIpv6(v6.src), parseIpv6(v6.dst), proto.ipProto, seg);
        if (cksum === 0) cksum = 0xffff;
      }
    } else if (proto.checksum === 'transport6') {
      // ICMPv6/UDP/TCP trên IPv6: checksum có pseudo-header v6 (lấy src/dst từ lớp ipv6 bao ngoài).
      let payload = [];
      for (let j = i + 1; j < built.length; j++) payload = payload.concat(Array.from(built[j].bytes));
      const seg = bytes.concat(payload);
      let ip6 = null;
      for (let j = i - 1; j >= 0; j--) if (layers[j].proto === 'ipv6') { ip6 = layers[j].fields; break; }
      if (ip6) cksum = transportChecksum6(parseIpv6(ip6.src), parseIpv6(ip6.dst), proto.ipProto, seg);
    } else if (typeof proto.checksum === 'function') {
      cksum = proto.checksum(bytes);
    }
    if (cksum != null && proto.checksumField) {
      const cf = fields.find((f) => f.name === proto.checksumField);
      if (cf) {
        const byteOff = cf.bitOffset >> 3;
        bytes[byteOff] = (cksum >>> 8) & 0xff;
        bytes[byteOff + 1] = cksum & 0xff;
        cf.display = `0x${cksum.toString(16).padStart(4, '0')}`;
        cf.computedChecksum = cksum;
      }
    }

    built[i] = { proto, bytes, fields };
    payloadLength += bytes.length;
  }

  // ----- Phase B: nối byte + offset tuyệt đối (ngoài -> trong) -----
  const all = [];
  const tree = [];
  let baseBit = 0;

  for (let i = 0; i < built.length; i++) {
    const { proto, bytes, fields } = built[i];
    const baseByte = all.length;
    for (const b of bytes) all.push(b & 0xff);

    const children = fields.map((f) => {
      const absBit = baseBit + f.bitOffset;
      const byteOffset = absBit >> 3;
      const byteEnd = (absBit + f.bitLength - 1) >> 3;
      return {
        name: f.name,
        nameVi: f.nameVi,
        rfc: f.rfc,
        descriptionVi: f.descriptionVi,
        display: f.display,
        bitOffset: absBit,
        bitLength: f.bitLength,
        byteOffset,
        byteLength: byteEnd - byteOffset + 1,
      };
    });

    tree.push({
      layer: proto.id,
      name: proto.name,
      nameVi: proto.nameVi,
      osiLayer: proto.osiLayer,
      rfc: proto.rfc,
      byteOffset: baseByte,
      byteLength: bytes.length,
      fields: children,
    });

    baseBit += bytes.length * 8;
  }

  return { bytes: toUint8(all), tree };
}

/** Trả về mảng phẳng mọi trường (kèm layer) — tiện cho highlight / quiz. */
export function flattenFields(tree) {
  const out = [];
  for (const layer of tree) {
    for (const f of layer.fields) out.push({ ...f, layer: layer.layer });
  }
  return out;
}

/** Tìm 1 trường theo name trong cây. */
export function findField(tree, name) {
  return flattenFields(tree).find((f) => f.name === name) || null;
}
