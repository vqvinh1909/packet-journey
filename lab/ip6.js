// lab/ip6.js — tiện ích địa chỉ IPv6 cho Lab CLI: phân tích, nén (RFC 5952, in hoa kiểu Cisco),
// so khớp prefix, EUI-64 và link-local sinh từ MAC.

/** "2001:db8::1" → mảng 8 số 16-bit, hoặc null nếu sai cú pháp. */
export function parse6(str) {
  const s = String(str ?? '').trim().toLowerCase();
  if (!s || s.includes('/') || !/^[0-9a-f:]+$/.test(s) || s.includes(':::')) return null;
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const part = (x) => (x === '' ? [] : x.split(':'));
  const head = part(halves[0]), tail = halves.length === 2 ? part(halves[1]) : [];
  if ([...head, ...tail].some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  const fill = 8 - head.length - tail.length;
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null;
  return [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...tail].map((g) => parseInt(g, 16));
}
export const isIp6 = (s) => parse6(s) != null;

/** Mảng 8 nhóm → dạng nén chuẩn (nhóm 0 dài nhất ≥ 2 thành "::"), chữ IN HOA như IOS. */
export function fmt6(g) {
  let bs = -1, bl = 0;
  for (let i = 0; i < 8;) {
    if (g[i] !== 0) { i++; continue; }
    let j = i;
    while (j < 8 && g[j] === 0) j++;
    if (j - i > bl) { bs = i; bl = j - i; }
    i = j;
  }
  const hx = (a) => a.map((x) => x.toString(16).toUpperCase());
  if (bl < 2) return hx(g).join(':');
  return hx(g.slice(0, bs)).join(':') + '::' + hx(g.slice(bs + bl)).join(':');
}
/** Chuẩn hoá chuỗi IPv6 (để so sánh / lưu). null nếu sai. */
export function norm6(str) { const g = parse6(str); return g ? fmt6(g) : null; }

/** "2001:db8:1::1/64" → { ip, prefix } hoặc null. */
export function parsePrefix6(str) {
  const m = String(str ?? '').match(/^([^/]+)\/(\d{1,3})$/);
  if (!m || +m[2] > 128) return null;
  const ip = norm6(m[1]);
  return ip ? { ip, prefix: +m[2] } : null;
}
function mask(g, prefix) {
  return g.map((x, i) => {
    const bits = Math.max(0, Math.min(16, prefix - i * 16));
    return bits === 16 ? x : bits === 0 ? 0 : x & ((0xffff << (16 - bits)) & 0xffff);
  });
}
/** Địa chỉ mạng của ip/prefix (dạng nén). */
export function net6(ip, prefix) { return fmt6(mask(parse6(ip), prefix)); }
/** ip có thuộc mạng net/prefix không. */
export function in6(ip, net, prefix) {
  const a = parse6(ip), b = parse6(net);
  if (!a || !b) return false;
  return mask(a, prefix).every((x, i) => x === mask(b, prefix)[i]);
}
export const isLinkLocal = (ip) => (parse6(ip)?.[0] & 0xffc0) === 0xfe80;

/** Interface ID EUI-64 từ MAC "00:50:79:66:01:01" (đảo bit U/L, chèn FFFE). */
function eui(mac) {
  const b = mac.split(':').map((x) => parseInt(x, 16));
  b[0] ^= 0x02;
  return [(b[0] << 8) | b[1], (b[2] << 8) | 0xff, 0xfe00 | b[3], (b[4] << 8) | b[5]];
}
/** Địa chỉ EUI-64: 64 bit prefix + interface ID từ MAC. */
export function eui64(prefixIp, mac) { const g = parse6(prefixIp); return fmt6([...g.slice(0, 4), ...eui(mac)]); }
/** Link-local FE80::/64 sinh tự động từ MAC (như IOS khi bật IPv6 trên cổng). */
export function linkLocal(mac) { return fmt6([0xfe80, 0, 0, 0, ...eui(mac)]); }
