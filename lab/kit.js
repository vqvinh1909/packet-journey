// lab/kit.js — tiện ích dùng chung khi soạn lab (lab/labs*.js).

import * as N from './net.js';

/** Bọc lệnh cấu hình: enable → configure terminal → ... → end */
export const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
/** Danh sách cổng Fa0/1..n (+ cổng thêm). */
export const fa = (n, extra = []) => [...Array.from({ length: n }, (_, i) => `fa0/${i + 1}`), ...extra];
/** Danh sách cổng Gi0/1..n (switch Layer 3). */
export const gi = (n, extra = []) => [...Array.from({ length: n }, (_, i) => `g0/${i + 1}`), ...extra];
/** So sánh tên không phân biệt hoa/thường. */
export const same = (a, b) => String(a ?? '').toUpperCase() === String(b ?? '').toUpperCase();
/** Allowed VLAN đã giới hạn, đủ VLAN cần, không thừa ngoài danh sách cho phép thêm. */
export const allowedOk = (p, need, extra = [1, 999]) => p.allowed != null && need.every((v) => p.allowed.includes(v)) && p.allowed.every((v) => need.includes(v) || extra.includes(v));
/** Tên ACL loại `type` đang áp trên cổng `ifn` chiều `dir` (đặt tên hay đánh số đều được), hoặc null. */
export const aclOn = (d, ifn, dir, type) => { const n = N.l3ifs(d)[ifn]?.[dir === 'in' ? 'aclIn' : 'aclOut']; return !!n && (!type || d.acls[n]?.type === type) ? n : null; };
/** Câu hỏi trắc nghiệm trong danh sách nhiệm vụ. */
export const quiz = (text, options, correct, explain) => ({ text, quiz: { options, correct, explain } });
/** Lab "cách giải chi tiết": mỗi bước { dev, title, why, cmds } → đồng thời là lời giải chạy được. */
/** IP có hợp lệ làm địa chỉ host trong subnet (không phải network/broadcast) không. */
export function hostIn(ip, net, prefix) {
  if (!ip || !N.inNet(ip, net, prefix)) return false;
  const n = N.ip2n(ip), base = N.ip2n(net);
  return n !== base && n !== base + 2 ** (32 - prefix) - 1;
}
/** Switch Layer 3 (Catalyst 3560) — routing = true nếu đã "ip routing" sẵn. */
export function ml3(id, name, x, y, ports, routing = false) {
  const d = N.sw(id, name, x, y, ports);
  d.model = '3560';
  d.ipRouting = routing;
  return d;
}
/** MAC của PC (dạng "0050.7966.0601") — để ghi trong đề bài. */
export const macOf = (net, id) => N.ciscoMac(N.epMac(net, { dev: id, ifn: 'fa0' }));
export const B = '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/';
