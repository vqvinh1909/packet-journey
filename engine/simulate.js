// engine/simulate.js
// Bộ ghi sự kiện (recorder) mà mỗi kịch bản dùng để sinh ra timeline.
//
// Mỗi kịch bản export `build()` trả về kết quả của sim.result():
//   { topology, events, pcap }
//
// Cấu trúc 1 Event (bước timeline):
//   {
//     seq,                 // số thứ tự tự gán
//     kind,                // 'process' (thiết bị suy nghĩ) | 'transit' (frame chạy trên dây)
//     titleVi,             // tiêu đề ngắn của bước
//     atDevice,            // (process) id thiết bị đang xử lý
//     fromDevice, toDevice,// (transit) chạy từ đâu tới đâu để animation
//     side,                // 'encap' | 'decap' | 'forward' | 'inspect'
//     activeLayer,         // số tầng OSI đang sáng (1..7) hoặc null
//     packet,              // { bytes, tree } ảnh chụp gói ở bước này (hoặc null)
//     changedFields,       // [name...] trường vừa đổi, để tô màu
//     tables,              // { arp?, mac?, routing? } snapshot để hiện bên topology
//     explanationVi,       // đoạn "chuyện gì đang xảy ra và vì sao"
//     decision,            // (tùy chọn, cho M4) { question, options:[...], correct, explainVi }
//   }

import { serialize, flattenFields } from '../packet/serialize.js';

export class Sim {
  constructor(topology) {
    this.topology = topology;
    this.events = [];
    this.pcap = []; // [{ bytes, label }]
  }

  /** Dựng gói từ ngăn xếp layer -> { layers, bytes, tree }. */
  frame(layers) {
    const { bytes, tree } = serialize(layers);
    return { layers, bytes, tree };
  }

  /** Ghi một bước; trả về seq. */
  emit(ev) {
    const seq = this.events.length;
    this.events.push({ seq, changedFields: [], tables: {}, ...ev });
    return seq;
  }

  /** Thêm 1 frame vào file pcap (theo thứ tự "bắt" được). */
  capture(frame, label) {
    this.pcap.push({ bytes: frame.bytes, label });
  }

  result() {
    return { topology: this.topology, events: this.events, pcap: this.pcap };
  }
}

/**
 * So khớp 2 cây trường theo name, trả danh sách name có display khác nhau.
 * Dùng để tự động tô "trường vừa thay đổi" khi cùng một gói đi qua router.
 */
export function diffFields(prevTree, curTree) {
  if (!prevTree || !curTree) return [];
  const prev = new Map(flattenFields(prevTree).map((f) => [f.name, f.display]));
  const changed = [];
  for (const f of flattenFields(curTree)) {
    if (prev.has(f.name) && prev.get(f.name) !== f.display) changed.push(f.name);
  }
  return changed;
}
