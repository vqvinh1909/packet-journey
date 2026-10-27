// protocols/hsrp.js
// HSRP v1 (Cisco, RFC 2281) — 20 byte, chạy trong UDP cổng 1985, gửi tới multicast
// 224.0.0.2. MAC ảo của nhóm = 00:00:0c:07:ac:XX (XX = số group).

import { BitWriter } from '../packet/bytes.js';
import { parseIp } from '../packet/addr.js';

export const HSRP_OP = { HELLO: 0, COUP: 1, RESIGN: 2 };
export const HSRP_STATE = { INITIAL: 0, LEARN: 1, LISTEN: 2, SPEAK: 4, STANDBY: 8, ACTIVE: 16 };
function opName(o) { return { 0: 'Hello', 1: 'Coup', 2: 'Resign' }[o] || '?'; }
function stateName(s) { return { 0: 'Initial', 1: 'Learn', 2: 'Listen', 4: 'Speak', 8: 'Standby', 16: 'Active' }[s] || '?'; }

export default {
  id: 'hsrp',
  name: 'HSRP v1',
  nameVi: 'HSRP',
  osiLayer: 7,
  rfc: 'RFC 2281',
  checksum: null,

  /** fields: { opcode=0, state, hellotime=3, holdtime=10, priority, group=1, virtualIp } */
  build(fields) {
    const w = new BitWriter();
    w.field({ name: 'hsrp.version', nameVi: 'Version', rfc: 'RFC 2281', descriptionVi: 'HSRP version = 0 (v1).', display: '0' }, () => w.writeUint(0, 1));
    w.field({ name: 'hsrp.op', nameVi: 'Op Code', rfc: 'RFC 2281',
      descriptionVi: '0 = Hello (duy trì), 1 = Coup (giành Active), 2 = Resign (nhường).', display: `${fields.opcode ?? 0} — ${opName(fields.opcode ?? 0)}` }, () => w.writeUint(fields.opcode ?? 0, 1));
    w.field({ name: 'hsrp.state', nameVi: 'State', rfc: 'RFC 2281',
      descriptionVi: 'Trạng thái: 16 = Active (đang nhận gói hộ nhóm), 8 = Standby (dự phòng), 4 = Speak, 2 = Listen...', display: `${fields.state} — ${stateName(fields.state)}` }, () => w.writeUint(fields.state, 1));
    w.field({ name: 'hsrp.hello', nameVi: 'Hellotime', rfc: 'RFC 2281', descriptionVi: 'Chu kỳ gửi Hello (giây). Mặc định 3s.', display: `${fields.hellotime ?? 3}s` }, () => w.writeUint(fields.hellotime ?? 3, 1));
    w.field({ name: 'hsrp.hold', nameVi: 'Holdtime', rfc: 'RFC 2281', descriptionVi: 'Không nghe Hello trong ngần này giây thì coi Active chết. Mặc định 10s.', display: `${fields.holdtime ?? 10}s` }, () => w.writeUint(fields.holdtime ?? 10, 1));
    w.field({ name: 'hsrp.prio', nameVi: 'Priority', rfc: 'RFC 2281',
      descriptionVi: 'Ưu tiên bầu Active: CAO hơn thắng (mặc định 100). Hoà thì IP lớn hơn thắng.', display: String(fields.priority) }, () => w.writeUint(fields.priority, 1));
    w.field({ name: 'hsrp.group', nameVi: 'Group', rfc: 'RFC 2281', descriptionVi: 'Số nhóm HSRP (0–255). MAC ảo = 00:00:0c:07:ac:<group>.', display: String(fields.group ?? 1) }, () => w.writeUint(fields.group ?? 1, 1));
    w.field({ name: 'hsrp.rsv', nameVi: 'Reserved', rfc: 'RFC 2281', descriptionVi: 'Dành riêng = 0.', display: '0' }, () => w.writeUint(0, 1));
    w.field({ name: 'hsrp.auth', nameVi: 'Auth Data', rfc: 'RFC 2281', descriptionVi: 'Mật khẩu plaintext 8 byte, mặc định "cisco".', display: '"cisco"' },
      () => w.writeBytes([0x63, 0x69, 0x73, 0x63, 0x6f, 0, 0, 0]));
    w.field({ name: 'hsrp.vip', nameVi: 'Virtual IP', rfc: 'RFC 2281', descriptionVi: 'IP ảo của nhóm — chính là default gateway mà các host trỏ tới.', display: fields.virtualIp },
      () => w.writeBytes(parseIp(fields.virtualIp)));
    return w;
  },
};
