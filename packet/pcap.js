// packet/pcap.js
// Xuất file .pcap định dạng libpcap cổ điển (little-endian, micro giây),
// linktype = 1 (LINKTYPE_ETHERNET) để Wireshark đọc được và đối chiếu.
// Tham chiếu: https://wiki.wireshark.org/Development/LibpcapFileFormat
//
// buildPcap() là hàm thuần (chạy được trong node --test). downloadPcap() chỉ chạy
// trong trình duyệt (có guard) để không vỡ khi import ở Node.

const MAGIC = 0xa1b2c3d4; // micro giây
const LINKTYPE_ETHERNET = 1;
const SNAPLEN = 65535;

function writeUint32LE(arr, value) {
  const v = value >>> 0;
  arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}
function writeUint16LE(arr, value) {
  arr.push(value & 0xff, (value >>> 8) & 0xff);
}

/**
 * packets: mảng các bản ghi { bytes: Uint8Array|number[], tsSec?, tsUsec? }
 *          hoặc trực tiếp Uint8Array/number[] (sẽ tự gán timestamp tăng dần).
 * Trả về Uint8Array toàn bộ nội dung file .pcap.
 */
export function buildPcap(packets) {
  const out = [];

  // Global header (24 byte)
  writeUint32LE(out, MAGIC);
  writeUint16LE(out, 2); // version major
  writeUint16LE(out, 4); // version minor
  writeUint32LE(out, 0); // thiszone
  writeUint32LE(out, 0); // sigfigs
  writeUint32LE(out, SNAPLEN); // snaplen
  writeUint32LE(out, LINKTYPE_ETHERNET); // network

  let seq = 0;
  for (const p of packets) {
    const rec = Array.isArray(p) || p instanceof Uint8Array ? { bytes: p } : p;
    const bytes = rec.bytes;
    const tsSec = rec.tsSec ?? 0;
    const tsUsec = rec.tsUsec ?? seq * 1000; // mặc định cách nhau 1ms
    const len = bytes.length;

    // Record (packet) header (16 byte)
    writeUint32LE(out, tsSec);
    writeUint32LE(out, tsUsec);
    writeUint32LE(out, len); // incl_len (đã chụp)
    writeUint32LE(out, len); // orig_len (độ dài thật)
    for (let i = 0; i < len; i++) out.push(bytes[i] & 0xff);
    seq++;
  }

  return Uint8Array.from(out);
}

/** Tải file .pcap về máy (chỉ dùng trong trình duyệt). */
export function downloadPcap(packets, filename = 'packet-journey.pcap') {
  if (typeof document === 'undefined' || typeof Blob === 'undefined') {
    throw new Error('downloadPcap chỉ chạy trong trình duyệt');
  }
  const data = buildPcap(packets);
  const blob = new Blob([data], { type: 'application/vnd.tcpdump.pcap' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
