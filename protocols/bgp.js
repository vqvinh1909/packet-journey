// protocols/bgp.js
// BGP-4 (RFC 4271) — chạy trên TCP cổng 179. Header 19 byte: Marker(16=0xFF) + Length(2) + Type(1).
// Hỗ trợ: OPEN (1), UPDATE (2), KEEPALIVE (4).

import { BitWriter } from '../packet/bytes.js';
import { parseIp } from '../packet/addr.js';

export const BGP_TYPE = { OPEN: 1, UPDATE: 2, NOTIFICATION: 3, KEEPALIVE: 4 };
function typeName(t) { return { 1: 'OPEN', 2: 'UPDATE', 3: 'NOTIFICATION', 4: 'KEEPALIVE' }[t] || '?'; }

export default {
  id: 'bgp',
  name: 'BGP-4',
  nameVi: 'BGP',
  osiLayer: 7,
  rfc: 'RFC 4271',
  checksum: null,

  /**
   * fields:
   *  OPEN:      { type:1, version=4, myAs, holdTime=180, bgpId }
   *  UPDATE:    { type:2, origin=0, asPath:[..], nextHop, nlri:{prefix,len} }
   *  KEEPALIVE: { type:4 }
   */
  build(fields) {
    const w = new BitWriter();
    const type = fields.type;

    // ---- dựng body trước để biết Length ----
    let body = []; // mảng {meta, bytes} để ghi kèm field
    if (type === BGP_TYPE.OPEN) {
      body = [
        { meta: { name: 'bgp.version', nameVi: 'Version', descriptionVi: 'BGP version = 4.', display: '4' }, bytes: [4] },
        { meta: { name: 'bgp.myas', nameVi: 'My AS', descriptionVi: 'Số AS của router gửi. eBGP: hai bên khác AS.', display: String(fields.myAs) }, bytes: [(fields.myAs >> 8) & 0xff, fields.myAs & 0xff] },
        { meta: { name: 'bgp.hold', nameVi: 'Hold Time', descriptionVi: 'Không nghe KEEPALIVE/UPDATE trong ngần này giây thì ngắt phiên. Mặc định 180s.', display: `${fields.holdTime ?? 180}s` }, bytes: [((fields.holdTime ?? 180) >> 8) & 0xff, (fields.holdTime ?? 180) & 0xff] },
        { meta: { name: 'bgp.id', nameVi: 'BGP Identifier', descriptionVi: 'Router ID (dạng IP), định danh router BGP.', display: fields.bgpId }, bytes: parseIp(fields.bgpId) },
        { meta: { name: 'bgp.optlen', nameVi: 'Opt Param Len', descriptionVi: 'Độ dài tham số tuỳ chọn (0 nếu không có).', display: '0' }, bytes: [0] },
      ];
    } else if (type === BGP_TYPE.UPDATE) {
      const asArr = fields.asPath || [];
      const asVal = [2, asArr.length]; // seg type 2 (AS_SEQUENCE), count
      for (const a of asArr) asVal.push((a >> 8) & 0xff, a & 0xff);
      const origin = [0x40, 1, 1, fields.origin ?? 0];
      const aspath = [0x40, 2, asVal.length, ...asVal];
      const nh = [0x40, 3, 4, ...parseIp(fields.nextHop)];
      const attrs = [...origin, ...aspath, ...nh];
      const plen = fields.nlri.len;
      const pbytes = parseIp(fields.nlri.prefix).slice(0, Math.ceil(plen / 8));
      body = [
        { meta: { name: 'bgp.wlen', nameVi: 'Withdrawn Len', descriptionVi: 'Độ dài route bị rút (0 nếu không rút).', display: '0' }, bytes: [0, 0] },
        { meta: { name: 'bgp.palen', nameVi: 'Path Attr Len', descriptionVi: 'Tổng độ dài các thuộc tính đường đi.', display: String(attrs.length) }, bytes: [(attrs.length >> 8) & 0xff, attrs.length & 0xff] },
        { meta: { name: 'bgp.origin', nameVi: 'Attr: ORIGIN', descriptionVi: 'Nguồn gốc route: 0 = IGP, 1 = EGP, 2 = Incomplete.', display: (fields.origin ?? 0) === 0 ? 'IGP' : String(fields.origin) }, bytes: origin },
        { meta: { name: 'bgp.aspath', nameVi: 'Attr: AS_PATH', descriptionVi: 'Chuỗi AS mà route đã đi qua — dùng để chọn đường & chống loop (thấy AS mình thì bỏ).', display: `AS_SEQ [${asArr.join(' ')}]` }, bytes: aspath },
        { meta: { name: 'bgp.nexthop', nameVi: 'Attr: NEXT_HOP', descriptionVi: 'IP chặng kế để tới các prefix này.', display: fields.nextHop }, bytes: nh },
        { meta: { name: 'bgp.nlri', nameVi: 'NLRI', descriptionVi: 'Prefix được quảng bá (độ dài + các byte mạng).', display: `${fields.nlri.prefix}/${plen}` }, bytes: [plen, ...pbytes] },
      ];
    }

    const bodyLen = body.reduce((n, b) => n + b.bytes.length, 0);
    const length = 19 + bodyLen;

    w.field({ name: 'bgp.marker', nameVi: 'Marker', rfc: 'RFC 4271', descriptionVi: '16 byte toàn 0xFF (di sản xác thực; nay luôn FF).', display: 'ff × 16' },
      () => w.writeBytes(new Array(16).fill(0xff)));
    w.field({ name: 'bgp.length', nameVi: 'Length', rfc: 'RFC 4271', descriptionVi: 'Tổng độ dài bản tin (gồm 19 byte header). KEEPALIVE = 19.', display: `${length} byte` },
      () => w.writeUint(length, 2));
    w.field({ name: 'bgp.type', nameVi: 'Type', rfc: 'RFC 4271', descriptionVi: '1 OPEN, 2 UPDATE, 3 NOTIFICATION, 4 KEEPALIVE.', display: `${type} — ${typeName(type)}` },
      () => w.writeUint(type, 1));

    for (const b of body) {
      w.field({ ...b.meta, rfc: 'RFC 4271' }, () => w.writeBytes(b.bytes));
    }
    return w;
  },
};
