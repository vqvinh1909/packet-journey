// packet/bytes.js
// BitWriter: ghi từng trường header theo đơn vị BIT (MSB trước), đồng thời ghi lại
// vị trí byte/bit của mỗi trường. Nhờ "một lần ghi ra cả byte lẫn offset" mà sau này
// hex view và cây trường (field tree) highlight được hai chiều mà không cần tính lại.
//
// Mọi header trong app đều căn theo byte ở tổng thể; các trường con < 8 bit
// (vd IPv4 version/IHL) được gộp đúng trong byte nhờ ghi theo bit.

export class BitWriter {
  constructor() {
    this.bytes = [];   // number[] 0..255
    this.bitPos = 0;   // tổng số bit đã ghi
    this.fields = [];  // [{ ...meta, bitOffset, bitLength }] — offset tương đối đầu writer
  }

  _ensureByte(byteIndex) {
    while (this.bytes.length <= byteIndex) this.bytes.push(0);
  }

  /** Ghi `width` bit thấp của `value` (<=32 bit), MSB trước. */
  writeBits(value, width) {
    if (width < 0 || width > 32) throw new Error(`writeBits width không hợp lệ: ${width}`);
    const v = value >>> 0;
    for (let i = width - 1; i >= 0; i--) {
      const bit = (v >>> i) & 1;
      const byteIndex = this.bitPos >> 3;
      const bitInByte = 7 - (this.bitPos & 7); // MSB-first trong byte
      this._ensureByte(byteIndex);
      if (bit) this.bytes[byteIndex] |= (1 << bitInByte);
      this.bitPos++;
    }
  }

  /** Ghi một dãy byte; yêu cầu đang căn byte (dùng cho MAC 48-bit, IP 32-bit, payload...). */
  writeBytes(arr) {
    if (this.bitPos & 7) throw new Error('writeBytes: chưa căn byte (bit lẻ)');
    for (const b of arr) {
      const idx = this.bitPos >> 3;
      this._ensureByte(idx);
      this.bytes[idx] = b & 0xff;
      this.bitPos += 8;
    }
  }

  /** Ghi số nguyên không dấu `byteLen` byte, big-endian (network order). */
  writeUint(value, byteLen) {
    const out = [];
    let v = value >>> 0;
    for (let i = byteLen - 1; i >= 0; i--) {
      out[i] = v & 0xff;
      v = Math.floor(v / 256);
    }
    this.writeBytes(out);
  }

  /**
   * Bọc một thao tác ghi để tự lưu lại offset/length của trường.
   * meta: { name, nameVi, describe?, rfc, note? } — mô tả tĩnh của trường.
   * fn: hàm thực sự gọi writeBits/writeBytes/writeUint.
   */
  field(meta, fn) {
    const bitOffset = this.bitPos;
    fn();
    this.fields.push({ ...meta, bitOffset, bitLength: this.bitPos - bitOffset });
    return this;
  }

  /** Vị trí byte hiện tại (phải đang căn byte). */
  get byteLength() {
    return this.bitPos >> 3;
  }
}

/** Mảng số -> Uint8Array. */
export function toUint8(arr) {
  return Uint8Array.from(arr);
}

/** Byte -> chuỗi hex 2 ký tự. */
export function hex(b) {
  return (b & 0xff).toString(16).padStart(2, '0');
}

/** Mảng byte -> "aabbcc...". */
export function bytesToHex(arr) {
  return Array.from(arr, hex).join('');
}
