// scenarios/s22-wrong-gateway.js
// Kịch bản 22 (Sửa lỗi): PC cấu hình SAI default gateway.
// Triệu chứng kinh điển: ping cùng mạng OK, nhưng ra Internet/khác mạng thì hỏng.

import { Sim } from '../engine/simulate.js';
import { arpFrame, ARP_OP, BROADCAST_MAC } from './_common.js';

const PC = { mac: '00:1a:2b:00:00:10', ip: '192.168.1.10', wrongGw: '192.168.1.254', rightGw: '192.168.1.1' };
const R1 = { mac: '00:1a:2b:00:00:a1', ip: '192.168.1.1' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-01_Nen-tang-mang/Bai-02_Mo-hinh-OSI-TCPIP.md',
  label: 'Bài 02 — OSI/TCP-IP',
};

export const meta = {
  id: 's22-wrong-gateway',
  titleVi: '🔧 Sửa lỗi: sai default gateway',
  titleEn: 'Troubleshoot: wrong gateway',
  descriptionVi: 'PC đặt nhầm gateway thành 192.168.1.254 (đúng phải là .1). Hãy đoán triệu chứng và nguyên nhân rồi xem gói chứng minh.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'pc', type: 'host', name: 'PC', x: 170, y: 150, color: '#a0433a', lines: ['192.168.1.10', `GW ${PC.wrongGw} ✗`] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 500, y: 150, lines: ['192.168.1.0/24'] },
      { id: 'r1', type: 'router', name: 'R1', x: 830, y: 150, lines: [`${R1.ip} (gateway đúng)`] },
    ],
    links: [{ id: 'l1', a: 'pc', b: 'sw' }, { id: 'l2', a: 'sw', b: 'r1' }],
  };

  const sim = new Sim(topology);

  sim.emit({ kind: 'process', atDevice: 'pc', side: 'inspect', activeLayer: 3,
    titleVi: 'PC ping 8.8.8.8 (khác mạng)',
    decision: {
      question: 'PC đặt gateway = 192.168.1.254 (không có thiết bị nào mang IP này). Triệu chứng sẽ là gì?',
      options: ['Hỏng hoàn toàn, kể cả ping trong mạng', 'Ping cùng mạng OK, ra ngoài thì hỏng', 'Chỉ chậm chứ vẫn chạy', 'Chỉ hỏng DNS'],
      correct: 1,
      explainVi: 'Liên lạc cùng mạng không cần gateway nên vẫn OK; chỉ khi ra mạng khác mới lộ lỗi.',
    },
    explanationVi: 'PC thấy 8.8.8.8 khác mạng → cần gửi cho default gateway. Nhưng gateway cấu hình là 192.168.1.254 (sai).',
    lesson: LESSON });

  const arpReq = sim.frame(arpFrame({ op: ARP_OP.REQUEST, senderMac: PC.mac, senderIp: PC.ip, targetMac: '00:00:00:00:00:00', targetIp: PC.wrongGw, ethDst: BROADCAST_MAC }));
  sim.capture(arpReq, 'ARP hỏi gateway (sai) 192.168.1.254');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'sw', side: 'encap', activeLayer: 2,
    titleVi: 'PC phát ARP hỏi MAC của 192.168.1.254', packet: arpReq,
    explanationVi: 'Để gửi cho gateway, PC cần MAC của 192.168.1.254 → phát ARP Request broadcast.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'forward', activeLayer: 2,
    titleVi: 'Switch flood — nhưng không ai mang IP .254',
    overlay: { links: { l1: { cls: 'blocking', label: 'không hồi đáp' }, l2: { cls: 'blocking', label: '✗' } } },
    explanationVi: 'Switch flood broadcast khắp VLAN. R1 có IP .1, không phải .254 → R1 (và mọi host) BỎ QUA. Không có ARP Reply.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'pc', side: 'inspect', activeLayer: 3,
    titleVi: 'ARP hết giờ → ping thất bại',
    decision: {
      question: 'Vì sao PC không ra được Internet?',
      options: ['TTL = 0', 'Checksum sai', 'ARP cho gateway không ai trả lời (gateway sai)', 'Sai VLAN'],
      correct: 2,
      explainVi: 'Gateway 192.168.1.254 không tồn tại → không có MAC để đóng khung → gói không bao giờ rời PC.',
    },
    explanationVi: 'Không nhận được MAC gateway → PC báo "Request timed out"/"Destination host unreachable". ' +
      'KHẮC PHỤC: đặt lại default gateway = 192.168.1.1 (IP của R1). Sau đó ARP sẽ có Reply và gói ra ngoài bình thường.',
    lesson: LESSON });

  return sim.result();
}
