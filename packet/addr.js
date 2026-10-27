// packet/addr.js
// Hàm thuần (pure) xử lý địa chỉ MAC và IPv4: parse chuỗi <-> byte, so sánh mạng.
// Không phụ thuộc DOM nên dùng được cả trong trình duyệt lẫn trong `node --test`.

// ----- MAC (48 bit = 6 byte) -----

/** "aa:bb:cc:dd:ee:ff" hoặc "aa-bb-..." -> [0xaa, 0xbb, ...] (6 số). */
export function parseMac(str) {
  const parts = str.trim().split(/[:-]/);
  if (parts.length !== 6) throw new Error(`MAC không hợp lệ: ${str}`);
  return parts.map((h) => {
    const v = parseInt(h, 16);
    if (Number.isNaN(v) || v < 0 || v > 0xff) throw new Error(`MAC không hợp lệ: ${str}`);
    return v;
  });
}

/** [0xaa, 0xbb, ...] -> "aa:bb:cc:dd:ee:ff". */
export function macToString(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(':');
}

export const BROADCAST_MAC = 'ff:ff:ff:ff:ff:ff';

/** MAC broadcast? */
export function isBroadcastMac(str) {
  return str.toLowerCase() === BROADCAST_MAC;
}

// ----- IPv4 (32 bit = 4 byte) -----

/** "192.168.1.10" -> [192, 168, 1, 10]. */
export function parseIp(str) {
  const parts = str.trim().split('.');
  if (parts.length !== 4) throw new Error(`IPv4 không hợp lệ: ${str}`);
  return parts.map((d) => {
    const v = parseInt(d, 10);
    if (Number.isNaN(v) || v < 0 || v > 255) throw new Error(`IPv4 không hợp lệ: ${str}`);
    return v;
  });
}

/** [192,168,1,10] -> "192.168.1.10". */
export function ipToString(bytes) {
  return Array.from(bytes, (b) => b & 0xff).join('.');
}

/** "192.168.1.10" -> số nguyên 32-bit không dấu. */
export function ipToInt(str) {
  const [a, b, c, d] = parseIp(str);
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

/** Số nguyên 32-bit -> "a.b.c.d". */
export function intToIp(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
}

/** Prefix length (/24) -> mask số nguyên 32-bit. prefix 0 -> 0. */
export function prefixToMaskInt(prefix) {
  if (prefix < 0 || prefix > 32) throw new Error(`Prefix không hợp lệ: /${prefix}`);
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/** prefix -> "255.255.255.0". */
export function prefixToMaskString(prefix) {
  return intToIp(prefixToMaskInt(prefix));
}

/** Địa chỉ mạng (network address) của ip với prefix cho trước, trả về số nguyên. */
export function networkInt(ip, prefix) {
  const ipInt = typeof ip === 'string' ? ipToInt(ip) : ip >>> 0;
  return (ipInt & prefixToMaskInt(prefix)) >>> 0;
}

/**
 * Hai IP có CÙNG mạng không, khi xét theo prefix của bên gửi?
 * Dùng để host quyết định: gửi trực tiếp (cùng mạng) hay nhờ default gateway (khác mạng).
 */
export function sameSubnet(ipA, ipB, prefix) {
  return networkInt(ipA, prefix) === networkInt(ipB, prefix);
}

// ----- IPv6 (128 bit = 16 byte) -----

/** "2001:db8::1" -> [16 byte]. Hỗ trợ rút gọn "::". */
export function parseIpv6(str) {
  const s = str.trim();
  let head, tail;
  if (s.includes('::')) {
    const parts = s.split('::');
    if (parts.length !== 2) throw new Error(`IPv6 không hợp lệ: ${str}`);
    head = parts[0] ? parts[0].split(':') : [];
    tail = parts[1] ? parts[1].split(':') : [];
  } else {
    head = s.split(':');
    tail = [];
  }
  const miss = 8 - head.length - tail.length;
  if (miss < 0) throw new Error(`IPv6 không hợp lệ: ${str}`);
  const groups = [...head, ...Array(s.includes('::') ? miss : 0).fill('0'), ...tail];
  if (groups.length !== 8) throw new Error(`IPv6 không hợp lệ: ${str}`);
  const bytes = [];
  for (const g of groups) {
    const v = parseInt(g || '0', 16);
    if (Number.isNaN(v) || v < 0 || v > 0xffff) throw new Error(`IPv6 không hợp lệ: ${str}`);
    bytes.push((v >> 8) & 0xff, v & 0xff);
  }
  return bytes;
}

/** [16 byte] -> "2001:db8::1" (rút gọn dãy 0 dài nhất). */
export function ipv6ToString(bytes) {
  const g = [];
  for (let i = 0; i < 16; i += 2) g.push((bytes[i] << 8) | bytes[i + 1]);
  // tìm dãy 0 dài nhất để thay bằng ::
  let best = { start: -1, len: 0 }, cur = { start: -1, len: 0 };
  g.forEach((v, i) => {
    if (v === 0) { if (cur.start < 0) cur = { start: i, len: 1 }; else cur.len++; if (cur.len > best.len) best = { ...cur }; }
    else cur = { start: -1, len: 0 };
  });
  const hex = g.map((v) => v.toString(16));
  if (best.len >= 2) {
    const before = hex.slice(0, best.start).join(':');
    const after = hex.slice(best.start + best.len).join(':');
    return `${before}::${after}`;
  }
  return hex.join(':');
}
