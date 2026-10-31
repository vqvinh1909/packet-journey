// protocols/bgp.js
// BGP-4 (RFC 4271) — chạy trên TCP cổng 179. Header 19 byte: Marker(16=0xFF) + Length(2) + Type(1).
// Hỗ trợ: OPEN (1), UPDATE (2), KEEPALIVE (4).

import { BitWriter } from '../packet/bytes.js';
import { parseIp, parseMac } from '../packet/addr.js';

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
   *  UPDATE EVPN: { type:2, evpn:{ rd, mac, ip, vni, nextHop, rt:[as,num] } } — route type 2, RFC 7432 + 8365
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
    } else if (type === BGP_TYPE.UPDATE && fields.evpn) {
      const e = fields.evpn, u16 = (n) => [(n >> 8) & 0xff, n & 0xff], u32 = (n) => [...u16(n >>> 16), ...u16(n & 0xffff)];
      const route = [0, 1, ...parseIp(e.rd), 0, 1, ...new Array(10).fill(0), 0, 0, 0, 0, 48, ...parseMac(e.mac), 32, ...parseIp(e.ip), (e.vni >> 16) & 0xff, (e.vni >> 8) & 0xff, e.vni & 0xff];
      const mp = [...u16(25), 70, 4, ...parseIp(e.nextHop), 0, 2, route.length, ...route];
      const origin = [0x40, 1, 1, 0], aspath = [0x40, 2, 0], lpref = [0x40, 5, 4, 0, 0, 0, 100];
      const ext = [0xc0, 16, 16, 0x00, 0x02, ...u16(e.rt[0]), ...u32(e.rt[1]), 0x03, 0x0c, 0, 0, 0, 0, 0, 8];
      const mpAttr = [0x90, 14, ...u16(mp.length), ...mp], palen = origin.length + aspath.length + lpref.length + ext.length + mpAttr.length;
      body = [
        { meta: { name: 'bgp.wlen', nameVi: 'Withdrawn Len', descriptionVi: 'Độ dài route bị rút (0 nếu không rút).', display: '0' }, bytes: [0, 0] },
        { meta: { name: 'bgp.palen', nameVi: 'Path Attr Len', descriptionVi: 'Tổng độ dài các thuộc tính đường đi.', display: String(palen) }, bytes: u16(palen) },
        { meta: { name: 'bgp.origin', nameVi: 'Attr: ORIGIN', descriptionVi: 'Nguồn gốc route.', display: '0 (IGP)' }, bytes: origin },
        { meta: { name: 'bgp.aspath', nameVi: 'Attr: AS_PATH', descriptionVi: 'iBGP trong cùng AS nên chuỗi AS rỗng.', display: '(rỗng)' }, bytes: aspath },
        { meta: { name: 'bgp.localpref', nameVi: 'Attr: LOCAL_PREF', descriptionVi: 'Độ ưu tiên trong AS, bắt buộc với iBGP.', display: '100' }, bytes: lpref },
        { meta: { name: 'bgp.extcomm', nameVi: 'Attr: Extended Communities', descriptionVi: 'Route Target quyết định VTEP nào nhập route. Encapsulation báo kiểu đóng gói, 8 là VXLAN.', display: `RT ${e.rt[0]}:${e.rt[1]}, encap VXLAN` }, bytes: ext },
        { meta: { name: 'bgp.mpreach', nameVi: 'Attr: MP_REACH_NLRI', descriptionVi: 'Thuộc tính đa giao thức: AFI 25 (L2VPN), SAFI 70 (EVPN), next hop là VTEP.', display: `L2VPN EVPN, next hop ${e.nextHop}` }, bytes: mpAttr.slice(0, 4 + 9) },
        { meta: { name: 'bgp.evpn', nameVi: 'EVPN NLRI type 2', descriptionVi: 'MAC/IP Advertisement: RD, ESI, Ethernet Tag, MAC, IP và VNI đặt trong trường nhãn.', display: `RD ${e.rd}:1, MAC ${e.mac}, IP ${e.ip}, VNI ${e.vni}` }, bytes: mpAttr.slice(4 + 9) },
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
