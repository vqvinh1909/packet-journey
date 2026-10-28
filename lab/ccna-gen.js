// lab/ccna-gen.js — câu hỏi thi thử SINH TỰ ĐỘNG với số liệu mới mỗi đề (tất định theo seed để làm tiếp / chấm lại được).
// Mọi đáp án đúng đều TÍNH bằng số học nhị phân; đáp án nhiễu được kiểm để chắc chắn sai và không trùng nhau.
// tests/exam.test.js chạy mỗi dạng với hàng trăm seed và tính lại đáp án theo cách độc lập.
//
// Mỗi generator(r) → { domain, text, textEn, opts, optsEn?, ans, explain, explainEn } (ans = chỉ số đáp án đúng trong opts).

const n2ip = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
const ip2n = (s) => s.split('.').reduce((a, x) => a * 256 + +x, 0);
const maskN = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
const netN = (n, p) => (n & maskN(p)) >>> 0;
const bcastN = (n, p) => (netN(n, p) | (~maskN(p) >>> 0)) >>> 0;
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
/** Địa chỉ ngẫu nhiên trong các dải private quen thuộc. */
function randIp(r) {
  const k = int(r, 0, 2);
  return k === 0 ? ip2n(`10.${int(r, 0, 255)}.${int(r, 0, 255)}.${int(r, 1, 254)}`) : k === 1 ? ip2n(`172.${int(r, 16, 31)}.${int(r, 0, 255)}.${int(r, 1, 254)}`) : ip2n(`192.168.${int(r, 0, 255)}.${int(r, 1, 254)}`);
}
/** Ghép đáp án đúng + nhiễu (bỏ trùng, bỏ nhiễu trùng đáp án đúng), giữ đúng 4 phương án; trả null nếu không đủ. */
function fin(o, right, wrongs) {
  const opts = [right];
  for (const w of wrongs) if (w != null && !opts.includes(w) && opts.length < 4) opts.push(w);
  return opts.length === 4 ? { ...o, opts, ans: 0 } : null;
}

export const GENS = {
  /** Broadcast của IP/prefix. */
  broadcast(r) {
    const p = int(r, 20, 30), n = randIp(r);
    const net = netN(n, p), bc = bcastN(n, p), size = 2 ** (32 - p);
    const a = `${n2ip(n)}/${p}`;
    return fin({ domain: 'nf', text: `Địa chỉ broadcast của subnet chứa ${a} là?`, textEn: `What is the broadcast address of the subnet containing ${a}?`,
      explain: `/${p} → khối ${size} địa chỉ: network ${n2ip(net)}, broadcast ${n2ip(bc)}.`, explainEn: `/${p} → blocks of ${size} addresses: network ${n2ip(net)}, broadcast ${n2ip(bc)}.` },
    n2ip(bc), [n2ip(net), n2ip(bc - 1), n2ip((bc + size) >>> 0), n2ip((net + size / 2) >>> 0), n2ip(bcastN(n, p - 1))]);
  },
  /** Số host dùng được của prefix. */
  hosts(r) {
    const p = int(r, 18, 30), h = 2 ** (32 - p) - 2;
    return fin({ domain: 'nf', text: `Một subnet /${p} có bao nhiêu địa chỉ host dùng được?`, textEn: `How many usable host addresses does a /${p} subnet have?`,
      explain: `2^(32−${p}) − 2 = ${h} (trừ địa chỉ network và broadcast).`, explainEn: `2^(32−${p}) − 2 = ${h} (minus the network and broadcast addresses).` },
    String(h), [String(h + 2), String(h + 1), String(2 ** (31 - p) - 2), String(2 ** (33 - p) - 2)]);
  },
  /** Địa chỉ nào là host hợp lệ trong subnet. */
  validHost(r) {
    const p = int(r, 24, 29), n = randIp(r);
    const net = netN(n, p), bc = bcastN(n, p), size = 2 ** (32 - p);
    const host = net + 1 + int(r, 0, size - 3);
    const s = `${n2ip(net)}/${p}`;
    return fin({ domain: 'nf', text: `Địa chỉ nào là địa chỉ host DÙNG ĐƯỢC trong subnet ${s}?`, textEn: `Which address is a USABLE host address in subnet ${s}?`,
      explain: `${s}: host dùng được từ ${n2ip(net + 1)} đến ${n2ip(bc - 1)}; ${n2ip(net)} là network, ${n2ip(bc)} là broadcast.`, explainEn: `${s}: usable hosts ${n2ip(net + 1)} to ${n2ip(bc - 1)}; ${n2ip(net)} is the network, ${n2ip(bc)} the broadcast.` },
    n2ip(host), [n2ip(net), n2ip(bc), n2ip((bc + 1 + int(r, 0, size - 3)) >>> 0), n2ip((net - size + 1 + int(r, 0, size - 3)) >>> 0)]);
  },
  /** Wildcard của prefix. */
  wildcard(r) {
    const p = int(r, 16, 30);
    const wc = n2ip(~maskN(p) >>> 0);
    return fin({ domain: 'ipc', text: `Wildcard mask tương ứng với prefix /${p} là?`, textEn: `Which wildcard mask matches a /${p} prefix?`,
      explain: `Wildcard = 255.255.255.255 − subnet mask (${n2ip(maskN(p))}) = ${wc}.`, explainEn: `Wildcard = 255.255.255.255 − subnet mask (${n2ip(maskN(p))}) = ${wc}.` },
    wc, [n2ip(maskN(p)), n2ip(~maskN(p + 1) >>> 0), n2ip(~maskN(p - 1) >>> 0), n2ip(~maskN(p + 2) >>> 0)]);
  },
  /** Gộp 2^k mạng /24 liên tiếp. */
  summary(r) {
    const k = int(r, 1, 4), cnt = 2 ** k;
    const third = int(r, 0, 255 - cnt) & ~(cnt - 1) & 255;
    const b = int(r, 0, 1) ? `10.${int(r, 0, 255)}` : `172.${int(r, 16, 31)}`;
    const first = `${b}.${third}.0/24`, lastNet = `${b}.${third + cnt - 1}.0/24`;
    return fin({ domain: 'ipc', text: `Route tóm tắt NHỎ NHẤT gộp đúng ${cnt} mạng từ ${first} đến ${lastNet} là?`, textEn: `What is the SMALLEST summary route covering exactly the ${cnt} networks ${first} through ${lastNet}?`,
      explain: `${cnt} = 2^${k} mạng /24 liên tiếp, bắt đầu từ bội số của ${cnt} → mượn ${k} bit: /${24 - k}.`, explainEn: `${cnt} = 2^${k} contiguous /24 networks starting at a multiple of ${cnt} → ${k} bits: /${24 - k}.` },
    `${b}.${third}.0/${24 - k}`, [`${b}.${third}.0/${24 - k + 1}`, `${b}.${third}.0/${24 - k - 1}`, `${b}.${third}.0/24`, `${b}.0.0/16`]);
  },
  /** Longest prefix match trên bảng định tuyến ngẫu nhiên. */
  lpm(r) {
    const a = int(r, 0, 255), b = int(r, 0, 255), c3 = int(r, 0, 15) * 16;
    const routes = [
      { net: `10.${a}.0.0`, p: 16, via: 'R-A' }, { net: `10.${a}.${b}.0`, p: 24, via: 'R-B' }, { net: `10.${a}.${b}.${c3}`, p: 28, via: 'R-C' }, { net: '0.0.0.0', p: 0, via: 'R-D' },
    ];
    const kind = int(r, 0, 3); // đích rơi vào route nào nhiều khả năng nhất
    const dst = kind === 0 ? ip2n(`10.${a}.${b}.${c3 + int(r, 0, 15)}`) : kind === 1 ? ip2n(`10.${a}.${b}.${(c3 + 16 + int(r, 0, 200)) % 256}`) : kind === 2 ? ip2n(`10.${a}.${(b + 1 + int(r, 0, 250)) % 256}.${int(r, 1, 254)}`) : ip2n(`10.${(a + 1 + int(r, 0, 250)) % 256}.${int(r, 0, 255)}.${int(r, 1, 254)}`);
    const best = routes.filter((x) => netN(dst, x.p) === ip2n(x.net)).sort((x, y) => y.p - x.p)[0];
    const label = (x) => `${x.net}/${x.p} → ${x.via}`;
    const table = routes.map(label).join(' ; ');
    return { domain: 'ipc', text: `Bảng định tuyến: ${table}. Gói tới ${n2ip(dst)} đi theo route nào?`, textEn: `Routing table: ${table}. Which route does a packet to ${n2ip(dst)} use?`,
      explain: `Router chọn route khớp có prefix DÀI nhất: ${label(best)}.`, explainEn: `The router picks the matching route with the LONGEST prefix: ${label(best)}.`,
      opts: routes.map(label), ans: routes.indexOf(best) };
  },
  /** Route nào vào bảng khi học cùng prefix từ 2 nguồn (so AD). */
  ad(r) {
    const AD = [['Static', 1], ['eBGP', 20], ['EIGRP', 90], ['OSPF', 110], ['RIP', 120]];
    const i = int(r, 0, AD.length - 1);
    let j = int(r, 0, AD.length - 2); if (j >= i) j++;
    const [x, y] = [AD[i], AD[j]];
    const win = x[1] < y[1] ? x : y;
    const pfx = `10.${int(r, 0, 255)}.${int(r, 0, 255)}.0/24`;
    return { domain: 'ipc', text: `Router học prefix ${pfx} từ cả ${x[0]} và ${y[0]} (AD mặc định). Route nào được đưa vào bảng định tuyến?`, textEn: `A router learns ${pfx} from both ${x[0]} and ${y[0]} (default AD). Which route is installed?`,
      explain: `So AD: ${x[0]} = ${x[1]}, ${y[0]} = ${y[1]} → AD nhỏ hơn thắng: ${win[0]}.`, explainEn: `Compare AD: ${x[0]} = ${x[1]}, ${y[0]} = ${y[1]} → the lower AD wins: ${win[0]}.`,
      opts: [`${x[0]} (AD ${x[1]})`, `${y[0]} (AD ${y[1]})`, 'Cả hai, cân tải', 'Không route nào'], optsEn: [`${x[0]} (AD ${x[1]})`, `${y[0]} (AD ${y[1]})`, 'Both, load-balanced', 'Neither'], ans: win === x ? 0 : 1 };
  },
  /** Gói từ IP nguồn X qua ACL standard 2 dòng: kết quả. */
  acl(r) {
    const n3 = int(r, 0, 255), host = int(r, 2, 250);
    const deny = `192.168.${n3}.${host}`;
    const kind = int(r, 0, 2);
    const src = kind === 0 ? deny : kind === 1 ? `192.168.${n3}.${host === 250 ? 1 : host + 1}` : `192.168.${(n3 + 1 + int(r, 0, 250)) % 256}.${int(r, 1, 254)}`;
    const ans = kind === 0 ? 0 : kind === 1 ? 1 : 2;
    const lines = `access-list 10 deny host ${deny} ; access-list 10 permit 192.168.${n3}.0 0.0.0.255`;
    return { domain: 'sec', text: `ACL: ${lines} — áp chiều in. Gói có IP nguồn ${src} thì sao?`, textEn: `ACL: ${lines} — applied inbound. What happens to a packet from source ${src}?`,
      explain: `ACL xét từ trên xuống, dừng ở dòng khớp đầu tiên; không khớp dòng nào → deny ngầm định ở cuối.`, explainEn: 'An ACL is processed top-down and stops at the first match; no match → the implicit deny at the end.',
      opts: ['Bị chặn bởi dòng 1 (deny host)', 'Được cho qua bởi dòng 2 (permit)', 'Bị chặn bởi deny ngầm định ở cuối', 'Được cho qua vì ACL mặc định permit'],
      optsEn: ['Denied by line 1 (deny host)', 'Permitted by line 2 (permit)', 'Denied by the implicit deny at the end', 'Permitted because ACLs permit by default'], ans };
  },
  /** Số địa chỉ DHCP cấp được sau excluded-address. */
  dhcp(r) {
    const p = pick(r, [24, 25, 26, 27]), x = int(r, 1, Math.min(60, 2 ** (32 - p) - 10));
    const n3 = int(r, 0, 255);
    const total = 2 ** (32 - p) - 2, left = total - x;
    return fin({ domain: 'ips', text: `Pool DHCP "network 192.168.${n3}.0 /${p}" và "ip dhcp excluded-address 192.168.${n3}.1 192.168.${n3}.${x}". Pool cấp được tối đa bao nhiêu địa chỉ?`, textEn: `DHCP pool "network 192.168.${n3}.0 /${p}" with "ip dhcp excluded-address 192.168.${n3}.1 192.168.${n3}.${x}". How many addresses can the pool lease at most?`,
      explain: `/${p} có ${total} host; trừ ${x} địa chỉ loại trừ (.1–.${x}) → ${left}.`, explainEn: `A /${p} has ${total} hosts; minus ${x} excluded (.1–.${x}) → ${left}.` },
    String(left), [String(total + 2 - x), String(left - 1), String(total), String(left + 1)]);
  },
};
/** Số câu sinh tự động mỗi mảng cho từng loại đề. */
export const GEN_PLAN = { full: { nf: 4, ipc: 6, ips: 1, sec: 1 }, quick: { nf: 1, ipc: 2, sec: 1 } };
const BY_DOMAIN = { nf: ['broadcast', 'hosts', 'validHost'], ipc: ['wildcard', 'summary', 'lpm', 'ad'], ips: ['dhcp'], sec: ['acl'] };

/** Sinh các câu cho đề (tất định theo r). Thử lại khi generator trả null (hiếm, khi nhiễu bị trùng). */
export function genQuestions(r, mode) {
  const out = [];
  for (const [dom, n] of Object.entries(GEN_PLAN[mode] || {})) {
    for (let i = 0; i < n; i++) {
      const name = BY_DOMAIN[dom][i % BY_DOMAIN[dom].length];
      let q = null;
      for (let t = 0; t < 20 && !q; t++) q = GENS[name](r);
      if (q) out.push({ ...q, gen: name });
    }
  }
  return out;
}
