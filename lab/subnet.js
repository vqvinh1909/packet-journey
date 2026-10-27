// lab/subnet.js — "🧮 Luyện subnet vô hạn": sinh đề ngẫu nhiên (theo seed), chấm, giải từng bước, thống kê.
// Dạng đề: info (IP/prefix → network, broadcast, host đầu/cuối, số host), convert (mask ↔ prefix ↔ wildcard),
// hosts (cần N host → prefix nhỏ nhất), vlsm (khối + nhu cầu → phân bổ, chấm linh hoạt), summary (gộp route),
// same (2 IP có cùng subnet?). Độ khó 1–3: phạm vi prefix / số subnet / độ "lẻ" của dải.
// Thuần logic (không DOM) để kiểm bằng node --test; giao diện ở ui/subnet.js.

export const KINDS = {
  info: 'IP/prefix → network, broadcast, host đầu/cuối, số host',
  convert: 'Đổi mask ↔ prefix ↔ wildcard',
  hosts: 'Cần N host → prefix nhỏ nhất',
  vlsm: 'VLSM: chia khối theo nhu cầu',
  summary: 'Gộp route (summary)',
  same: 'Hai IP có cùng subnet không?',
};

// ---------------------------------------------------------------- tiện ích IPv4 (số nguyên 32 bit)
export const ip2n = (s) => s.split('.').reduce((a, o) => a * 256 + +o, 0) >>> 0;
export const n2ip = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
export const maskN = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
export const prefixToMask = (p) => n2ip(maskN(p));
export const wildcard = (p) => n2ip(~maskN(p) >>> 0);
export const netN = (ip, p) => (ip2n(ip) & maskN(p)) >>> 0;
export const isIp = (s) => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(String(s).trim()) && String(s).trim().split('.').every((o) => +o <= 255);
/** Mask hợp lệ (dãy bit 1 liên tục) → prefix, không thì null. */
export function maskToPrefix(m) {
  if (!isIp(m)) return null;
  const n = ip2n(m);
  let zeros = 0;
  while (zeros < 32 && !((n >>> zeros) & 1)) zeros++;
  const p = 32 - zeros;
  return maskN(p) === n ? p : null;
}
/** Prefix nhỏ nhất (subnet lớn nhất cần thiết) chứa đủ `hosts` host dùng được. */
export const prefixForHosts = (hosts) => { let h = 2; while (2 ** h - 2 < hosts) h++; return 32 - h; };
export const usable = (p) => (p >= 31 ? 0 : 2 ** (32 - p) - 2);
const bin8 = (o) => o.toString(2).padStart(8, '0');

/** RNG tất định (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

/** IP riêng ngẫu nhiên, prefix theo độ khó: 1 → /24–/30 (octet cuối), 2 → /16–/30, 3 → /8–/30. */
function randIpPrefix(r, level) {
  const p = level === 1 ? ri(r, 24, 30) : level === 2 ? ri(r, 16, 30) : ri(r, 9, 30);
  const base = pick(r, [[10, ri(r, 0, 255)], [172, ri(r, 16, 31)], [192, 168]]);
  const ip = `${base[0]}.${base[1]}.${ri(r, 0, 255)}.${ri(r, 1, 254)}`;
  return { ip, p };
}

// ---------------------------------------------------------------- sinh đề
/** Sinh 1 câu dạng `kind` ('mix' = trộn) ở độ khó `level` (1–3). Trả { kind, level, text, fields, ans, data }. */
export function generate(kind, level = 1, r = Math.random) {
  if (kind === 'mix' || !KINDS[kind]) kind = pick(r, Object.keys(KINDS));
  level = Math.max(1, Math.min(3, +level || 1));
  const gen = { info, convert, hosts, vlsm, summary, same }[kind];
  return { kind, level, ...gen(r, level) };
}
function info(r, level) {
  const { ip, p } = randIpPrefix(r, level);
  const n = netN(ip, p), b = (n | ~maskN(p)) >>> 0;
  return {
    text: `Cho địa chỉ ${ip}/${p}. Tìm network, broadcast, host đầu, host cuối và số host dùng được.`,
    fields: [['network', 'Network'], ['broadcast', 'Broadcast'], ['first', 'Host đầu'], ['last', 'Host cuối'], ['hosts', 'Số host']],
    ans: { network: n2ip(n), broadcast: n2ip(b), first: n2ip(n + 1), last: n2ip(b - 1), hosts: String(usable(p)) },
    data: { ip, p },
  };
}
function convert(r, level) {
  const p = level === 1 ? ri(r, 24, 30) : level === 2 ? ri(r, 16, 30) : ri(r, 8, 30);
  const from = pick(r, ['prefix', 'mask', 'wildcard']);
  const all = { prefix: '/' + p, mask: prefixToMask(p), wildcard: wildcard(p) };
  const label = { prefix: 'Prefix', mask: 'Subnet mask', wildcard: 'Wildcard mask' };
  return {
    text: `Cho ${label[from].toLowerCase()} ${all[from]}. Đổi sang 2 dạng còn lại.`,
    fields: Object.keys(all).filter((k) => k !== from).map((k) => [k, label[k]]),
    ans: Object.fromEntries(Object.entries(all).filter(([k]) => k !== from)),
    data: { p, from },
  };
}
function hosts(r, level) {
  const max = level === 1 ? 250 : level === 2 ? 4000 : 200000;
  const n = ri(r, 2, max);
  return { text: `Một subnet cần ít nhất ${n.toLocaleString('vi-VN')} host dùng được. Prefix lớn nhất (subnet nhỏ nhất) có thể dùng là bao nhiêu?`, fields: [['prefix', 'Prefix (vd /26)']], ans: { prefix: '/' + prefixForHosts(n) }, data: { n } };
}
function vlsm(r, level) {
  const cnt = level === 1 ? 3 : level === 2 ? 4 : 5;
  const names = ['Kinh doanh', 'Kế toán', 'Kỹ thuật', 'Nhân sự', 'Kho', 'Ban giám đốc'];
  const maxH = level === 1 ? 60 : level === 2 ? 200 : 1000;
  const needs = Array.from({ length: cnt }, (_, i) => ({ name: names[i], hosts: ri(r, 2, maxH) }));
  needs.push({ name: 'WAN R1–R2', hosts: 2 });
  const total = needs.reduce((a, x) => a + 2 ** (32 - prefixForHosts(x.hosts)), 0);
  const bp = Math.max(8, 32 - Math.ceil(Math.log2(total)) - (level === 3 ? 0 : 1));
  const base = level === 3 ? `10.${ri(r, 0, 255)}.0.0` : `192.168.${ri(r, 0, 255)}.0`;
  const block = n2ip(netN(base, bp));
  return {
    text: `Chia khối ${block}/${bp} cho các nhu cầu sau (mỗi subnet dùng prefix NHỎ NHẤT đủ chỗ, không chồng lấn, nằm trong khối). Ghi network/prefix cho từng subnet.`,
    fields: needs.map((x, i) => ['s' + i, `${x.name} — ${x.hosts} host`]),
    ans: Object.fromEntries(vlsmPlan(block, bp, needs).map((x, i) => ['s' + i, `${x.net}/${x.p}`])),
    data: { block, bp, needs },
  };
}
/** Một phương án VLSM mẫu: xếp nhu cầu lớn trước, cấp liên tiếp từ đầu khối. Trả theo thứ tự nhu cầu gốc. */
export function vlsmPlan(block, bp, needs) {
  const order = needs.map((x, i) => ({ ...x, i, p: prefixForHosts(x.hosts) })).sort((a, b) => a.p - b.p || a.i - b.i);
  let cur = ip2n(block);
  const out = [];
  for (const x of order) { out[x.i] = { net: n2ip(cur), p: x.p, name: x.name }; cur += 2 ** (32 - x.p); }
  return out;
}
function summary(r, level) {
  const k = level === 1 ? 2 : level === 2 ? 4 : 8;
  const p = level === 1 ? 24 : level === 2 ? pick(r, [24, 23]) : pick(r, [24, 22, 20]);
  const sp = p - Math.log2(k);
  const base = netN(`${pick(r, [10, 172, 192])}.${ri(r, 16, 31)}.${ri(r, 0, 255)}.0`, sp);
  const nets = Array.from({ length: k }, (_, i) => n2ip(base + i * 2 ** (32 - p)) + '/' + p);
  return { text: `Gộp các mạng sau thành 1 route summary nhỏ nhất (chứa đúng các mạng này): ${nets.join(', ')}.`, fields: [['summary', 'Summary (vd 10.1.0.0/22)']], ans: { summary: `${n2ip(base)}/${sp}` }, data: { nets, p, sp } };
}
function same(r, level) {
  const { ip, p } = randIpPrefix(r, level);
  const size = 2 ** (32 - p);
  const n = netN(ip, p);
  const yes = r() < 0.5;
  const other = yes ? n + ri(r, 1, Math.max(1, size - 2)) : (n + size * pick(r, [1, -1]) + ri(r, 1, Math.max(1, size - 2))) >>> 0;
  return { text: `${ip}/${p} và ${n2ip(other)}/${p} có cùng subnet không?`, fields: [['same', 'Có / Không']], ans: { same: netN(n2ip(other), p) === n ? 'có' : 'không' }, data: { a: ip, b: n2ip(other), p } };
}

// ---------------------------------------------------------------- chấm
const normPrefix = (v) => { const m = String(v ?? '').trim().match(/^\/?\s*(\d{1,2})$/); return m && +m[1] <= 32 ? '/' + +m[1] : null; };
const normIp = (v) => (isIp(v) ? n2ip(ip2n(String(v).trim())) : null);
const normYes = (v) => { const s = String(v ?? '').trim().toLowerCase(); return /^(c|có|co|y|yes|đúng|dung)$/.test(s) ? 'có' : /^(k|không|khong|n|no|sai)$/.test(s) ? 'không' : null; };
const normNet = (v) => { const m = String(v ?? '').trim().match(/^(\S+?)\s*\/\s*(\d{1,2})$/); return m && isIp(m[1]) && +m[2] <= 32 ? { net: n2ip(ip2n(m[1])), p: +m[2] } : null; };

/** Chấm: input = { key: chuỗi người học gõ }. Trả { ok, fields: { key: true|false }, note }. */
export function grade(q, input = {}) {
  const fields = {};
  let note = '';
  if (q.kind === 'vlsm') {
    const { block, bp, needs } = q.data;
    const b0 = ip2n(block), b1 = b0 + 2 ** (32 - bp);
    const got = needs.map((x, i) => normNet(input['s' + i]));
    got.forEach((g, i) => {
      const need = prefixForHosts(needs[i].hosts);
      let ok = !!g && g.p === need && (ip2n(g.net) & maskN(g.p)) >>> 0 === ip2n(g.net) && ip2n(g.net) >= b0 && ip2n(g.net) + 2 ** (32 - g.p) <= b1;
      if (g && g.p !== need) note ||= `${needs[i].name} cần /${need} (prefix nhỏ nhất đủ ${needs[i].hosts} host).`;
      if (ok) for (let j = 0; j < got.length; j++) {
        const h = got[j];
        if (j === i || !h) continue;
        const a0 = ip2n(g.net), a1 = a0 + 2 ** (32 - g.p), c0 = ip2n(h.net), c1 = c0 + 2 ** (32 - h.p);
        if (a0 < c1 && c0 < a1) { ok = false; note ||= `${needs[i].name} chồng lấn với ${needs[j].name}.`; }
      }
      fields['s' + i] = ok;
    });
  } else {
    for (const [k] of q.fields) {
      const v = input[k];
      const exp = q.ans[k];
      let got;
      if (k === 'prefix') got = normPrefix(v);
      else if (k === 'same') got = normYes(v);
      else if (k === 'hosts') got = /^\s*[\d.,\s]+\s*$/.test(String(v ?? '')) ? String(+String(v).replace(/[.,\s]/g, '')) : null;
      else if (k === 'summary') { const g = normNet(v); got = g ? `${g.net}/${g.p}` : null; }
      else got = normIp(v);
      fields[k] = got === exp;
    }
  }
  return { ok: Object.values(fields).every(Boolean), fields, note };
}

// ---------------------------------------------------------------- giải từng bước
/** Các dòng giải thích (font đều): bảng nhị phân, bước nhảy, công thức. */
export function explain(q) {
  const L = [];
  // octet "thú vị" = octet chứa bit mask cuối cùng (/24 → octet 3, /25 → octet 4)
  const octIdx = (p) => Math.max(0, Math.floor((p - 1) / 8));
  if (q.kind === 'info' || q.kind === 'same') {
    const ip = q.kind === 'info' ? q.data.ip : q.data.a, p = q.data.p;
    const i = octIdx(p), mo = (maskN(p) >>> (24 - 8 * i)) & 255, step = 256 - mo;
    const o = +ip.split('.')[i];
    L.push(`1) /${p} → mask ${prefixToMask(p)} (${p} bit 1). Octet "thú vị" là octet ${i + 1} (mask = ${mo}).`);
    L.push(`2) Bước nhảy = 256 − ${mo} = ${step}. Các subnet ở octet ${i + 1}: ${Array.from({ length: Math.min(8, 256 / step) }, (_, k) => k * step).join(', ')}${256 / step > 8 ? ', …' : ''}`);
    L.push(`3) Octet ${i + 1} của IP = ${o} → nằm trong khối bắt đầu ${Math.floor(o / step) * step}.`);
    L.push('   Nhị phân octet ' + (i + 1) + ':');
    L.push(`     IP   ${bin8(o)}  (${o})`);
    L.push(`     Mask ${bin8(mo)}  (${mo})`);
    L.push(`     AND  ${bin8(o & mo)}  (${o & mo})`);
    if (q.kind === 'info') {
      const a = q.ans;
      L.push(`4) Network = ${a.network}; broadcast = network + ${2 ** (32 - p)} − 1 = ${a.broadcast}.`);
      L.push(`5) Host đầu = network + 1 = ${a.first}; host cuối = broadcast − 1 = ${a.last}.`);
      L.push(`6) Số host = 2^(32 − ${p}) − 2 = ${2 ** (32 - p)} − 2 = ${a.hosts}.`);
    } else {
      const nb = n2ip(netN(q.data.b, p));
      L.push(`4) ${q.data.a} → network ${n2ip(netN(q.data.a, p))}; ${q.data.b} → network ${nb}.`);
      L.push(`5) Hai network ${q.ans.same === 'có' ? 'GIỐNG nhau → cùng subnet' : 'KHÁC nhau → khác subnet'}.`);
    }
  } else if (q.kind === 'convert') {
    const p = q.data.p;
    L.push(`Prefix /${p} = ${p} bit 1 liên tiếp từ trái sang:`);
    L.push('  ' + Array.from({ length: 4 }, (_, k) => bin8((maskN(p) >>> (24 - 8 * k)) & 255)).join('.'));
    L.push(`  → mask ${prefixToMask(p)} (mỗi octet đổi nhị phân → thập phân).`);
    L.push(`Wildcard = 255.255.255.255 − mask = ${wildcard(p)} (lấy 255 trừ từng octet của mask).`);
    L.push('Mẹo: 128,192,224,240,248,252,254,255 = 1…8 bit 1 trong 1 octet.');
  } else if (q.kind === 'hosts') {
    const n = q.data.n, pp = prefixForHosts(n), h = 32 - pp;
    L.push(`Cần 2^h − 2 ≥ ${n} (h = số bit host).`);
    for (let k = Math.max(2, h - 2); k <= Math.min(30, h + 1); k++) L.push(`  h = ${String(k).padStart(2)} → ${2 ** k} − 2 = ${(2 ** k - 2).toLocaleString('vi-VN')} host ${k === h ? '✓ nhỏ nhất đủ' : 2 ** k - 2 < n ? '✗ thiếu' : ''}`);
    L.push(`→ h = ${h} → prefix = 32 − ${h} = /${pp} (mask ${prefixToMask(pp)}).`);
  } else if (q.kind === 'vlsm') {
    const { block, bp, needs } = q.data;
    L.push(`1) Mỗi nhu cầu → prefix nhỏ nhất: ${needs.map((x) => `${x.name} ${x.hosts} host → /${prefixForHosts(x.hosts)}`).join('; ')}.`);
    L.push(`2) Xếp subnet LỚN trước, cấp liên tiếp từ đầu khối ${block}/${bp} (tránh lỗ hổng và chồng lấn):`);
    for (const x of [...vlsmPlan(block, bp, needs)].sort((a, b) => ip2n(a.net) - ip2n(b.net))) L.push(`   ${x.name.padEnd(12)} ${x.net}/${x.p}  (${2 ** (32 - x.p)} địa chỉ, tới ${n2ip(ip2n(x.net) + 2 ** (32 - x.p) - 1)})`);
    L.push('3) Cách khác vẫn đúng nếu: đúng prefix tối thiểu, network chia hết cho kích thước subnet, không chồng lấn, nằm trong khối.');
  } else if (q.kind === 'summary') {
    const { nets, sp } = q.data;
    const i = octIdx(sp);
    L.push(`Viết octet ${i + 1} (octet bắt đầu khác nhau) của các mạng ra nhị phân:`);
    for (const nn of nets) { const o = +nn.split('/')[0].split('.')[i]; L.push(`  ${nn.padEnd(18)} ${bin8(o)}`); }
    L.push(`Giữ phần bit CHUNG từ trái sang → ${sp} bit chung → summary ${q.ans.summary}.`);
    L.push(`Kiểm tra: /${sp} chứa đúng ${nets.length} mạng /${q.data.p} (2^${q.data.p - sp} = ${2 ** (q.data.p - sp)}).`);
  }
  return L;
}

// ---------------------------------------------------------------- thống kê
/** stats: { kind: { n, ok, secs } } — cộng 1 câu. Trả object mới. */
export function addStat(stats, kind, ok, secs) {
  const s = { ...(stats || {}) };
  const x = { n: 0, ok: 0, secs: 0, ...(s[kind] || {}) };
  s[kind] = { n: x.n + 1, ok: x.ok + (ok ? 1 : 0), secs: Math.round((x.secs + Math.max(0, secs)) * 10) / 10 };
  return s;
}
/** Bảng thống kê theo dạng: [{ kind, label, n, rate (0–1), avg (giây) }]. */
export function statRows(stats) {
  return Object.entries(KINDS).map(([kind, label]) => {
    const x = stats?.[kind] || { n: 0, ok: 0, secs: 0 };
    return { kind, label, n: x.n, rate: x.n ? x.ok / x.n : null, avg: x.n ? x.secs / x.n : null };
  });
}
/** Bộ 10 câu tính giờ (trộn dạng): mảng 10 câu tất định theo seed. */
export function makeRun(level, seed) {
  const r = rng(seed);
  const kinds = Object.keys(KINDS);
  const qs = Array.from({ length: 10 }, (_, i) => generate(kinds[i % kinds.length], level, r));
  for (let i = qs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [qs[i], qs[j]] = [qs[j], qs[i]]; }
  return qs;
}
