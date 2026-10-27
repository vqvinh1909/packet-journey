// packet/checksum.js
// Internet checksum theo RFC 1071 — dùng cho IPv4 header, ICMP, và (từ M2) UDP/TCP.
// Thuần hàm, nhận vào mảng byte (Array hoặc Uint8Array).

/**
 * Tính Internet checksum (one's complement của tổng one's complement 16-bit)
 * trên dải byte [start, end). Nếu số byte lẻ thì byte cuối được đệm 0 ở nửa thấp.
 * Trả về số nguyên 16-bit.
 *
 * Lưu ý: nếu muốn TÍNH checksum thì trước đó phải đặt trường checksum = 0.
 */
export function internetChecksum(bytes, start = 0, end = bytes.length) {
  let sum = 0;
  let i = start;
  for (; i + 1 < end; i += 2) {
    sum += (bytes[i] << 8) + bytes[i + 1];
  }
  if (i < end) {
    // byte lẻ cuối cùng: nằm ở byte cao, byte thấp = 0
    sum += bytes[i] << 8;
  }
  // gộp phần tràn (carry) vòng lại cho tới khi vừa 16 bit
  while (sum >>> 16) {
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  return (~sum) & 0xffff;
}

/**
 * Pseudo-header IPv4 cho checksum của UDP/TCP (RFC 768 / RFC 9293).
 * Trả về mảng 12 byte: srcIP(4) + dstIP(4) + zero(1) + protocol(1) + length(2).
 * (M1 chưa dùng — sẵn cho M2.)
 */
export function pseudoHeaderV4(srcIpBytes, dstIpBytes, protocol, segmentLength) {
  return [
    ...srcIpBytes,
    ...dstIpBytes,
    0,
    protocol & 0xff,
    (segmentLength >>> 8) & 0xff,
    segmentLength & 0xff,
  ];
}

/**
 * Tính checksum của một segment UDP/TCP: ghép pseudo-header + segment rồi tính.
 * segmentBytes phải đã đặt trường checksum = 0.
 */
export function transportChecksum(srcIpBytes, dstIpBytes, protocol, segmentBytes) {
  const ph = pseudoHeaderV4(srcIpBytes, dstIpBytes, protocol, segmentBytes.length);
  const combined = ph.concat(Array.from(segmentBytes));
  return internetChecksum(combined);
}

/**
 * Pseudo-header IPv6 (RFC 8200) cho checksum ICMPv6/UDP/TCP:
 * src(16) + dst(16) + upper-layer length(4) + zero(3) + next header(1) = 40 byte.
 */
export function pseudoHeaderV6(srcIpBytes, dstIpBytes, nextHeader, upperLen) {
  return [
    ...srcIpBytes,
    ...dstIpBytes,
    (upperLen >>> 24) & 0xff, (upperLen >>> 16) & 0xff, (upperLen >>> 8) & 0xff, upperLen & 0xff,
    0, 0, 0,
    nextHeader & 0xff,
  ];
}

/** Checksum cho tầng trên IPv6 (vd ICMPv6) — bắt buộc, dùng pseudo-header v6. */
export function transportChecksum6(srcIpBytes, dstIpBytes, nextHeader, segmentBytes) {
  const ph = pseudoHeaderV6(srcIpBytes, dstIpBytes, nextHeader, segmentBytes.length);
  return internetChecksum(ph.concat(Array.from(segmentBytes)));
}
