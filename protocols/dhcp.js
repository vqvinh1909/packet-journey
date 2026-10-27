// protocols/dhcp.js
// DHCP (RFC 2131/2132) trên nền BOOTP. Chạy trong UDP (client 68 ↔ server 67).
// 236 byte cố định + magic cookie (0x63825363) + options kết thúc bằng 0xFF.

import { BitWriter } from '../packet/bytes.js';
import { parseMac, parseIp } from '../packet/addr.js';

export const DHCP_MSG = { DISCOVER: 1, OFFER: 2, REQUEST: 3, DECLINE: 4, ACK: 5, NAK: 6, RELEASE: 7 };
function msgName(t) {
  return { 1: 'DISCOVER', 2: 'OFFER', 3: 'REQUEST', 4: 'DECLINE', 5: 'ACK', 6: 'NAK', 7: 'RELEASE' }[t] || '?';
}
const OPT_NAME = { 1: 'Subnet Mask', 3: 'Router', 6: 'DNS', 51: 'Lease Time', 53: 'Message Type', 54: 'Server ID', 50: 'Requested IP', 55: 'Param Request List', 12: 'Hostname' };

export default {
  id: 'dhcp',
  name: 'DHCP',
  nameVi: 'DHCP',
  osiLayer: 7,
  rfc: 'RFC 2131',
  checksum: null,

  /**
   * fields: {
   *   op=1(request)/2(reply), xid, flags=0x8000(broadcast)|0,
   *   ciaddr, yiaddr, siaddr, giaddr (mặc định 0.0.0.0), chaddr (MAC client),
   *   options: [ { code, data:[...] } ]  (không cần thêm End, tự chèn 0xFF)
   * }
   */
  build(fields) {
    const w = new BitWriter();
    const ip0 = (s) => parseIp(s || '0.0.0.0');
    w.field({ name: 'dhcp.op', nameVi: 'Op', rfc: 'RFC 2131',
      descriptionVi: '1 = BOOTREQUEST (client→server), 2 = BOOTREPLY (server→client).',
      display: fields.op === 2 ? '2 — Reply' : '1 — Request' }, () => w.writeUint(fields.op ?? 1, 1));
    w.field({ name: 'dhcp.htype', nameVi: 'HType', rfc: 'RFC 2131', descriptionVi: '1 = Ethernet.', display: '1' }, () => w.writeUint(1, 1));
    w.field({ name: 'dhcp.hlen', nameVi: 'HLen', rfc: 'RFC 2131', descriptionVi: 'Độ dài MAC = 6.', display: '6' }, () => w.writeUint(6, 1));
    w.field({ name: 'dhcp.hops', nameVi: 'Hops', rfc: 'RFC 2131', descriptionVi: 'Relay agent tăng mỗi chặng. 0 nếu cùng mạng.', display: '0' }, () => w.writeUint(fields.hops ?? 0, 1));
    w.field({ name: 'dhcp.xid', nameVi: 'Transaction ID', rfc: 'RFC 2131',
      descriptionVi: 'ID phiên — khớp 4 bản tin DORA của cùng một lần xin IP.',
      display: `0x${(fields.xid >>> 0).toString(16).padStart(8, '0')}` }, () => w.writeUint(fields.xid >>> 0, 4));
    w.field({ name: 'dhcp.secs', nameVi: 'Secs', rfc: 'RFC 2131', descriptionVi: 'Giây từ khi bắt đầu xin IP.', display: '0' }, () => w.writeUint(0, 2));
    w.field({ name: 'dhcp.flags', nameVi: 'Flags', rfc: 'RFC 2131',
      descriptionVi: 'Bit Broadcast (0x8000): server trả lời bằng broadcast vì client chưa có IP.',
      display: (fields.flags ?? 0) & 0x8000 ? '0x8000 — Broadcast' : '0x0000 — Unicast' }, () => w.writeUint(fields.flags ?? 0, 2));
    w.field({ name: 'dhcp.ciaddr', nameVi: 'Client IP', rfc: 'RFC 2131', descriptionVi: 'IP client ĐANG có (0.0.0.0 khi chưa có).', display: fields.ciaddr ?? '0.0.0.0' }, () => w.writeBytes(ip0(fields.ciaddr)));
    w.field({ name: 'dhcp.yiaddr', nameVi: 'Your (client) IP', rfc: 'RFC 2131', descriptionVi: 'IP server CẤP cho client (ở OFFER/ACK).', display: fields.yiaddr ?? '0.0.0.0' }, () => w.writeBytes(ip0(fields.yiaddr)));
    w.field({ name: 'dhcp.siaddr', nameVi: 'Server IP', rfc: 'RFC 2131', descriptionVi: 'IP server next-server.', display: fields.siaddr ?? '0.0.0.0' }, () => w.writeBytes(ip0(fields.siaddr)));
    w.field({ name: 'dhcp.giaddr', nameVi: 'Gateway (relay) IP', rfc: 'RFC 2131', descriptionVi: 'IP của DHCP relay (ip helper-address). 0 nếu cùng mạng.', display: fields.giaddr ?? '0.0.0.0' }, () => w.writeBytes(ip0(fields.giaddr)));
    w.field({ name: 'dhcp.chaddr', nameVi: 'Client MAC', rfc: 'RFC 2131', descriptionVi: 'MAC client (16 byte, 6 byte MAC + đệm 0).', display: fields.chaddr },
      () => { w.writeBytes(parseMac(fields.chaddr)); w.writeBytes(new Array(10).fill(0)); });
    w.field({ name: 'dhcp.sname', nameVi: 'Server Name', rfc: 'RFC 2131', descriptionVi: 'Tên server (64 byte, thường 0).', display: '(64 byte, 0)' }, () => w.writeBytes(new Array(64).fill(0)));
    w.field({ name: 'dhcp.file', nameVi: 'Boot File', rfc: 'RFC 2131', descriptionVi: 'Tên file boot (128 byte, thường 0).', display: '(128 byte, 0)' }, () => w.writeBytes(new Array(128).fill(0)));
    w.field({ name: 'dhcp.cookie', nameVi: 'Magic Cookie', rfc: 'RFC 2131', descriptionVi: 'Dấu hiệu bắt đầu phần Options DHCP = 0x63825363.', display: '0x63825363' },
      () => w.writeBytes([0x63, 0x82, 0x53, 0x63]));

    for (const opt of fields.options || []) {
      const name = OPT_NAME[opt.code] || `Option ${opt.code}`;
      let disp = opt.display;
      if (!disp) {
        if (opt.code === 53) disp = `${opt.data[0]} — ${msgName(opt.data[0])}`;
        else disp = `[${opt.data.join(', ')}]`;
      }
      w.field({ name: `dhcp.opt${opt.code}`, nameVi: `Opt ${opt.code}: ${name}`, rfc: 'RFC 2132', descriptionVi: opt.desc || `DHCP option ${opt.code}.`, display: disp },
        () => { w.writeUint(opt.code, 1); w.writeUint(opt.data.length, 1); w.writeBytes(opt.data); });
    }
    w.field({ name: 'dhcp.end', nameVi: 'Opt 255: End', rfc: 'RFC 2132', descriptionVi: 'Kết thúc phần options.', display: '0xFF' }, () => w.writeUint(0xff, 1));
    return w;
  },
};
