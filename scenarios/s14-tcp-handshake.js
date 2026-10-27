// scenarios/s14-tcp-handshake.js
// Kịch bản 14 (CCNA): TCP bắt tay 3 bước + đóng kết nối.
// SYN → SYN-ACK → ACK (seq/ack cụ thể, MSS, window), rồi 4 bước FIN để đóng.

import { Sim } from '../engine/simulate.js';

const CLI = { mac: '00:1a:2b:00:00:10', ip: '192.168.1.10', port: 50000 };
const SRV = { mac: '00:1a:2b:00:00:80', ip: '192.168.1.80', port: 80 };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-01_Nen-tang-mang/Bai-02_Mo-hinh-OSI-TCPIP.md',
  label: 'Bài 02 — OSI/TCP-IP (tầng Transport)',
};

export const meta = {
  id: 's14-tcp-handshake',
  titleVi: 'TCP bắt tay 3 bước',
  titleEn: 'TCP 3-way handshake',
  descriptionVi: 'Mở kết nối TCP: SYN → SYN-ACK → ACK với seq/ack, MSS, window; rồi đóng bằng FIN.',
  difficulty: 2,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 260',
    devices: [
      { id: 'cli', type: 'host', name: 'Client', x: 200, y: 130, lines: ['192.168.1.10', `cổng ${CLI.port}`] },
      { id: 'srv', type: 'host', name: 'Web Server', x: 760, y: 130, color: '#2e7d5b', lines: ['192.168.1.80', 'cổng 80 (HTTP)'] },
    ],
    links: [{ id: 'l', a: 'cli', b: 'srv', labelMid: 'TCP' }],
  };

  const sim = new Sim(topology);
  const seg = (from, to, seq, ack, flags, mss) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: from.ip, dst: to.ip, ttl: 64, id: 0x9000 + seq % 100, protocol: 6 } },
    { proto: 'tcp', fields: { srcPort: from.port, dstPort: to.port, seq, ack, flags, window: 64240, mss } },
  ]);

  // 1. SYN
  const syn = seg(CLI, SRV, 1000, 0, { syn: true }, 1460);
  sim.capture(syn, 'TCP SYN');
  sim.emit({ kind: 'transit', fromDevice: 'cli', toDevice: 'srv', side: 'encap', activeLayer: 4,
    titleVi: '① SYN — client xin mở kết nối', packet: syn,
    explanationVi: 'Client chọn ISN seq = 1000, đặt cờ SYN, kèm MSS = 1460 (data tối đa mỗi đoạn) và Window. SYN "tốn" 1 số thứ tự.',
    lesson: LESSON });

  // 2. SYN-ACK
  const synack = seg(SRV, CLI, 5000, 1001, { syn: true, ack: true }, 1460);
  sim.capture(synack, 'TCP SYN-ACK');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'cli', side: 'decap', activeLayer: 4,
    titleVi: '② SYN-ACK — server đồng ý & xin chiều ngược lại', packet: synack,
    explanationVi: 'Server chọn ISN seq = 5000, ACK = 1001 (đã nhận SYN của client, mong byte kế 1001). Cờ SYN+ACK. Cũng khai MSS/Window của nó.',
    lesson: LESSON });

  // 3. ACK
  const ack = seg(CLI, SRV, 1001, 5001, { ack: true });
  sim.capture(ack, 'TCP ACK');
  sim.emit({ kind: 'transit', fromDevice: 'cli', toDevice: 'srv', side: 'encap', activeLayer: 4,
    titleVi: '③ ACK — kết nối thiết lập (ESTABLISHED)', packet: ack,
    explanationVi: 'Client ACK = 5001 (đã nhận SYN server). Giờ cả hai biết seq của nhau → kết nối sẵn sàng truyền data. Cổng nguồn ngẫu nhiên (50000), cổng đích 80.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'cli', side: 'inspect', activeLayer: 7,
    titleVi: 'Truyền dữ liệu (vd HTTP GET)',
    explanationVi: 'Sau bắt tay, client gửi "GET / HTTP/1.1" (data), server ACK và trả nội dung, mỗi đoạn tăng seq theo số byte, bên kia ACK lại. (App tập trung vào bắt tay; data tóm tắt bằng lời.)',
    lesson: LESSON });

  // 4-way close
  const fin1 = seg(CLI, SRV, 1001, 5001, { fin: true, ack: true });
  sim.capture(fin1, 'TCP FIN,ACK (client)');
  sim.emit({ kind: 'transit', fromDevice: 'cli', toDevice: 'srv', side: 'encap', activeLayer: 4,
    titleVi: '④ Đóng: client gửi FIN', packet: fin1,
    explanationVi: 'Client xong việc → gửi FIN,ACK. Bắt đầu quy trình đóng 4 bước (mỗi chiều đóng độc lập).',
    lesson: LESSON });
  const fin2 = seg(SRV, CLI, 5001, 1002, { fin: true, ack: true });
  sim.capture(fin2, 'TCP FIN,ACK (server)');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'cli', side: 'decap', activeLayer: 4,
    titleVi: '⑤ Server ACK rồi cũng FIN', packet: fin2,
    explanationVi: 'Server ACK = 1002 (nhận FIN client) rồi gửi FIN của mình. Client ACK lần cuối (seq 1002, ack 5002) → kết nối đóng hẳn.',
    lesson: LESSON });

  return sim.result();
}
