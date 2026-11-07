// scenarios/quiz-gen.js — câu quiz SINH với số liệu mới mỗi lần, theo từng kịch bản (khoá là 3 ký tự đầu của id).
// Mỗi generator(r) trả { q, options, correct: 0, explainVi } với đáp án đúng TÍNH ra, hoặc null nếu đáp án nhiễu bị trùng.
// tests/quiz.test.js chạy mỗi dạng hàng trăm lần và tính lại đáp án theo cách độc lập.

const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, a) => a[Math.floor(r() * a.length)];
/** Đáp án đúng đứng đầu + 3 nhiễu khác nhau; thiếu thì trả null để sinh lại. */
function fin(q, right, wrongs, explainVi) {
  const options = [right];
  for (const w of wrongs) if (w != null && !options.includes(w) && options.length < 4) options.push(w);
  return options.length === 4 ? { q, options, correct: 0, explainVi } : null;
}
const hex = (n, w) => n.toString(16).padStart(w, '0');

export const DSCP = { EF: 46, AF11: 10, AF12: 12, AF21: 18, AF22: 20, AF31: 26, AF32: 28, AF41: 34, AF42: 36, CS1: 8, CS2: 16, CS3: 24, CS4: 32, CS5: 40, CS6: 48 };

export const QGEN = {
  /** Bầu Root Bridge: priority rồi MAC. */
  stpRoot(r) {
    const sw = ['SW1', 'SW2', 'SW3'].map((name) => ({ name, prio: 4096 * int(r, 1, 8), mac: `0000.0000.00${hex(int(r, 1, 255), 2)}` }));
    if (new Set(sw.map((s) => s.prio + s.mac)).size < 3) return null;
    const root = [...sw].sort((a, b) => a.prio - b.prio || a.mac.localeCompare(b.mac))[0];
    const desc = sw.map((s) => `${s.name} priority ${s.prio} MAC ${s.mac}`).join('; ');
    return fin(`${desc}. Switch nào làm Root Bridge?`, root.name, [...sw.filter((s) => s !== root).map((s) => s.name), 'Không bầu được vì trùng VLAN'],
      'So priority trước (nhỏ hơn thắng), bằng nhau mới so MAC (nhỏ hơn thắng).');
  },
  /** EIGRP: tìm Feasible Successor theo điều kiện RD < FD của Successor. */
  eigrpFs(r) {
    const nb = ['R2', 'R3', 'R4'].map((name) => { const rd = int(r, 5, 60) * 100; return { name, rd, fd: rd + int(r, 5, 40) * 100 }; });
    if (new Set(nb.map((n) => n.fd)).size < 3) return null;
    const [succ, ...rest] = [...nb].sort((a, b) => a.fd - b.fd);
    const fs = rest.filter((n) => n.rd < succ.fd);
    if (fs.length > 1 || rest.some((n) => n.rd === succ.fd)) return null; // chỉ hỏi khi có đúng một hoặc không có FS
    const desc = nb.map((n) => `qua ${n.name} FD ${n.fd} (RD ${n.rd})`).join('; ');
    const right = fs[0]?.name || 'Không có feasible successor';
    return fin(`Tới 10.9.9.0/24: ${desc}. Feasible successor là?`, right, [...nb.map((n) => n.name).filter((x) => x !== right), 'Không có feasible successor'],
      `Successor là ${succ.name} (FD nhỏ nhất ${succ.fd}). Feasible successor phải có RD < ${succ.fd}.`);
  },
  /** TCP: số ACK = Seq + số byte dữ liệu. */
  tcpAck(r) {
    const seq = int(r, 1000, 90000), len = pick(r, [100, 200, 500, 512, 1000, 1200, 1460]);
    return fin(`Bên gửi gửi đoạn TCP Seq = ${seq}, mang ${len} byte dữ liệu. Bên nhận trả ACK số bao nhiêu?`, String(seq + len), [String(seq + len + 1), String(seq + 1), String(seq + len - 1)],
      'ACK là số thứ tự của byte tiếp theo bên nhận mong đợi: Seq + số byte đã nhận.');
  },
  /** Phân mảnh IPv4: số mảnh hoặc offset của mảnh thứ hai. */
  frag(r) {
    const mtu = pick(r, [1500, 1400, 1006, 576]), data = int(r, 15, 60) * 100;
    const per = Math.floor((mtu - 20) / 8) * 8, n = Math.ceil(data / per);
    if (n < 2) return null;
    if (r() < 0.5) return fin(`Gói IPv4 mang ${data} byte dữ liệu (header 20 byte) đi qua link MTU ${mtu}, không đặt DF. Bị chia thành mấy mảnh?`, String(n), [String(n + 1), String(n - 1), String(Math.ceil(data / mtu))],
      `Mỗi mảnh mang tối đa ${per} byte dữ liệu (MTU − 20, làm tròn xuống bội 8) nên cần ${n} mảnh.`);
    return fin(`Gói IPv4 mang ${data} byte dữ liệu qua link MTU ${mtu}. Fragment Offset của mảnh thứ hai là?`, String(per / 8), [String(per), String(mtu - 20), String(mtu / 8)],
      `Mảnh đầu mang ${per} byte; offset tính theo đơn vị 8 byte: ${per} / 8 = ${per / 8}.`);
  },
  /** DSCP: tên lớp ↔ giá trị thập phân. */
  dscp(r) {
    const names = Object.keys(DSCP), name = pick(r, names), v = DSCP[name];
    const others = names.filter((x) => x !== name).sort(() => r() - 0.5).slice(0, 3);
    if (r() < 0.5) return fin(`DSCP ${name} có giá trị thập phân là?`, String(v), others.map((x) => String(DSCP[x])), `${name} = ${v} (nhị phân ${v.toString(2).padStart(6, '0')}).`);
    return fin(`Gói có DSCP ${v} thuộc lớp nào?`, name, others, `${name} = ${v}.`);
  },
  /** IPv6: địa chỉ solicited-node multicast = ff02::1:ff + 24 bit cuối. */
  solicited(r) {
    const a = int(r, 0, 0xffff), b = int(r, 0, 0xffff), c = int(r, 0, 0xffff);
    const ip = `2001:db8:${hex(a, 1)}::${hex(b, 1)}:${hex(c, 1)}`, low = (b & 0xff);
    const right = `ff02::1:${hex(0xff00 | low, 4)}:${hex(c, 1)}`;
    return fin(`Địa chỉ solicited-node multicast của ${ip} là?`, right, [`ff02::1:${hex(b, 1)}:${hex(c, 1)}`, `ff02::1:ff00:${hex(c, 1)}`, `ff02::2:${hex(0xff00 | low, 4)}:${hex(c, 1)}`, 'ff02::1'],
      'ff02::1:ff00:0/104 cộng 24 bit cuối của địa chỉ unicast.');
  },
  /** Multicast IPv4 → MAC: 01:00:5e + 23 bit thấp. */
  mcastMac(r) {
    const o2 = int(r, 0, 255), o3 = int(r, 0, 255), o4 = int(r, 1, 255), g = `${int(r, 224, 239)}.${o2}.${o3}.${o4}`;
    const m = (x) => [1, 0, 0x5e, x, o3, o4].map((n) => hex(n, 2)).join(':');
    return fin(`Nhóm multicast ${g} ánh xạ sang MAC nào?`, m(o2 & 0x7f), [m(o2 | 0x80), `33:33:${[o2, o3, o4].map((n) => hex(n, 2)).join(':')}:00`, `ff:ff:ff:${[o2, o3, o4].map((n) => hex(n, 2)).join(':')}`, m((o2 + 1) & 0x7f)],
      '01:00:5e cộng 23 bit thấp của địa chỉ nhóm (bit cao của byte thứ hai bị bỏ).');
  },
  /** SR-MPLS: nhãn = đầu SRGB + index. */
  srLabel(r) {
    const base = pick(r, [16000, 16000, 20000, 900000]), idx = int(r, 1, 999);
    return fin(`SRGB bắt đầu từ ${base}, Prefix-SID index ${idx}. Router dùng nhãn nào?`, String(base + idx), [String(idx), String(base + idx + 1), String(base - idx)],
      'Nhãn = giá trị đầu SRGB + index, giống nhau trên mọi router dùng cùng SRGB.');
  },
  /** HSRPv1: MAC ảo 0000.0c07.acXX với XX là số nhóm (hex). */
  hsrpMac(r) {
    const g = int(r, 1, 255), v1 = `0000.0c07.ac${hex(g, 2)}`;
    return fin(`HSRP version 1, nhóm ${g}. MAC ảo là?`, v1, [`0000.0c07.ac${String(g).padStart(2, '0').slice(-2)}`, `0000.0c9f.f${hex(g, 3)}`, `0000.5e00.01${hex(g, 2)}`],
      `Số nhóm ${g} đổi sang hex là ${hex(g, 2)}. HSRPv2 dùng 0000.0c9f.fXXX, VRRP dùng 0000.5e00.01XX.`);
  },
  /** PAT: mỗi kết nối đồng thời là một mục NAT động. */
  natPat(r) {
    const hosts = int(r, 3, 40), conns = int(r, 2, 12);
    return fin(`${hosts} máy nội bộ, mỗi máy mở ${conns} kết nối TCP cùng lúc ra Internet qua PAT dùng một IP public. Bảng NAT có bao nhiêu mục động?`,
      String(hosts * conns), [String(hosts), String(conns), String(hosts + conns), '1'], 'PAT tạo một mục cho mỗi cặp IP:cổng bên trong; phân biệt bằng số cổng.');
  },
  /** DNS: bản ghi trong cache còn hạn hay đã hết theo TTL. */
  dnsTtl(r) {
    const ttl = pick(r, [60, 300, 600, 3600, 86400]), x = int(r, 1, ttl * 2);
    if (x === ttl) return null;
    const live = x < ttl;
    return fin(`Resolver cache một bản ghi A có TTL ${ttl} giây. ${x} giây sau có máy hỏi lại đúng tên đó. Resolver làm gì?`,
      live ? `Trả từ cache, TTL còn ${ttl - x} giây` : 'Hỏi lại vì bản ghi trong cache đã hết hạn',
      [live ? 'Hỏi lại vì bản ghi trong cache đã hết hạn' : `Trả từ cache, TTL còn ${ttl} giây`, `Trả từ cache, TTL đặt lại ${ttl} giây`, 'Luôn hỏi thẳng máy chủ authoritative', 'Trả NXDOMAIN'],
      'Bản ghi được dùng lại tới khi hết TTL; resolver trả TTL còn lại chứ không đặt lại.');
  },
};

/** Dạng câu sinh cho từng kịch bản. */
export const SC_GENS = { s05: ['stpRoot'], s08: ['eigrpFs'], s10: ['dnsTtl'], s11: ['natPat'], s13: ['hsrpMac'], s14: ['tcpAck'], s16: ['frag'], s20: ['dscp'], s25: ['dscp'], s26: ['solicited'], s32: ['srLabel'], s33: ['mcastMac'] };
