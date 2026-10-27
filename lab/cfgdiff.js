// lab/cfgdiff.js — "🔍 So sánh với lời giải": running-config của người học so với cấu hình sau khi chạy lời giải mẫu,
// theo từng thiết bị (theo khối: dòng đầu khối + các dòng thụt vào), kèm ghi chú khi hai cách đều đúng
// (vd network trong router ospf ↔ ip ospf … area trên cổng, ACL đánh số ↔ ACL đặt tên, static route next-hop ↔ cổng ra).
import { createCli } from './ios.js';
import { buildLab, applySolution, solutionOf } from './labs.js';
import * as IO from './configio.js';

// dòng không mang ý nghĩa cấu hình (dấu "!", phiên bản, thời gian, mặc định in ra của IOS)
const NOISE = /^(!|end$|version |Building|Current configuration|service timestamps|no service pad|boot-start-marker|boot-end-marker|no aaa new-model|memory-size|ip cef$|no ipv6 cef|spanning-tree extend system-id|line con 0$|line aux 0$|line vty 0 4$| ?logging synchronous$| ?login$|ntp clock-period)/;

/** running-config → danh sách mục so sánh: "khối" (dòng không thụt) và "khối › con" (dòng thụt). */
export function cfgItems(lines) {
  const out = [];
  let head = null;
  for (const raw of lines || []) {
    const l = raw.replace(/\s+$/, '');
    if (!l.trim() || NOISE.test(l) || NOISE.test(l.trim())) continue;
    if (/^\S/.test(l)) { head = l; out.push(l); }
    else if (head) out.push(`${head} › ${l.trim()}`);
  }
  return out;
}

// cặp "hai cách đều đúng": khi phía người học có A và lời giải có B (hoặc ngược lại)
const EQUIV = [
  { a: /› ip ospf \d+ area/, b: /^router ospf \d+ › network /, note: 'Bật OSPF trên cổng (ip ospf <pid> area <n>) hay bằng "network … area" trong router ospf đều đúng — kết quả là cổng tham gia cùng area.' },
  { a: /^router ospf \d+ › network /, b: /^router ospf \d+ › network /, note: 'Lệnh "network" khác wildcard (vd 0.0.0.0 khớp đúng 1 IP, 0.0.0.255 cả subnet) vẫn đúng nếu cùng bao đúng các cổng cần chạy OSPF.' },
  { a: /^access-list \d+ /, b: /^ip access-list (standard|extended) /, note: 'ACL đánh số (access-list 10 …) và ACL đặt tên (ip access-list … NAME) tương đương — đặt tên dễ đọc và sửa từng dòng hơn.' },
  { a: /^ip route \S+ \S+ [A-Za-z]/, b: /^ip route \S+ \S+ \d/, note: 'Static route ghi cổng ra hay next-hop đều chạy (trên Ethernet nên dùng next-hop hoặc cả hai để tránh proxy-ARP).' },
  { a: /› description /, b: /› description /, note: '"description" chỉ là ghi chú, viết khác không ảnh hưởng hoạt động.' },
  { a: /^ipconfig |^ip \d/, b: /^ipconfig |^ip \d/, note: 'IP của máy trạm khác lời giải vẫn đúng nếu cùng subnet, không trùng, đúng gateway.' },
  { a: /› switchport trunk allowed vlan /, b: /› switchport trunk allowed vlan /, note: 'Danh sách allowed VLAN khác nhau vẫn đúng nếu có đủ VLAN cần đi qua trunk.' },
];

/**
 * So sánh mạng của người học (userNet, userCli) với lời giải của `lab`. Trả null nếu lab không có lời giải, hoặc
 * { devices: [{ id, name, mine: [...], sol: [...], notes: [...] }] (chỉ thiết bị có khác biệt), same: số thiết bị giống hệt }.
 */
export function diffLab(lab, userNet, userCli) {
  if (!solutionOf(lab).length) return null;
  const solNet = buildLab(lab);
  const solCli = createCli(solNet);
  applySolution(lab, solNet, solCli);
  const devices = [];
  let same = 0;
  for (const id of Object.keys(solNet.devices)) {
    if (!userNet.devices[id]) continue;
    const a = IO.deviceConfig(userNet, userCli, id), b = IO.deviceConfig(solNet, solCli, id);
    if (!a || !b) continue;
    const A = cfgItems(a), B = cfgItems(b);
    const setA = new Set(A), setB = new Set(B);
    const mine = A.filter((x) => !setB.has(x)), sol = B.filter((x) => !setA.has(x));
    if (!mine.length && !sol.length) { same++; continue; }
    const notes = [];
    for (const e of EQUIV) if ((mine.some((x) => e.a.test(x)) && sol.some((x) => e.b.test(x))) || (mine.some((x) => e.b.test(x)) && sol.some((x) => e.a.test(x)))) if (!notes.includes(e.note)) notes.push(e.note);
    devices.push({ id, name: userNet.devices[id].name, mine, sol, notes });
  }
  return { devices, same };
}
