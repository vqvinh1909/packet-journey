// scenarios/s17-bgp-ebgp.js
// Kịch bản 17 (CCNP): eBGP giữa 2 AS.
// BGP chạy TRÊN TCP cổng 179: bắt tay TCP → OPEN (thoả thuận version/AS/hold/BGP ID)
// → KEEPALIVE (Established) → UPDATE (quảng bá prefix kèm AS_PATH).

import { Sim } from '../engine/simulate.js';
import { BGP_TYPE } from '../protocols/bgp.js';

const R1 = { mac: '00:1a:2b:00:0a:01', ip: '10.0.0.1', as: 65001, id: '1.1.1.1', port: 50000 };
const R2 = { mac: '00:1a:2b:00:0a:02', ip: '10.0.0.2', as: 65002, id: '2.2.2.2', port: 179 };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Giới thiệu định tuyến (BGP: CCNP)',
};

export const meta = {
  id: 's17-bgp-ebgp',
  titleVi: 'BGP: eBGP OPEN → UPDATE',
  titleEn: 'eBGP session',
  descriptionVi: 'Hai AS lập phiên eBGP trên TCP 179: OPEN thoả thuận tham số, KEEPALIVE, rồi UPDATE quảng bá prefix kèm AS_PATH.',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'r1', type: 'router', name: 'R1', x: 230, y: 150, lines: ['AS 65001', '10.0.0.1'] },
      { id: 'r2', type: 'router', name: 'R2', x: 620, y: 150, lines: ['AS 65002', '10.0.0.2'] },
      { id: 'net', type: 'host', name: 'Net .9', x: 880, y: 150, color: '#2e7d5b', lines: ['192.168.9.0/24'] },
    ],
    links: [
      { id: 'l', a: 'r1', b: 'r2', labelMid: 'eBGP (TCP 179)' },
      { id: 'ln', a: 'r2', b: 'net', bp: '' },
    ],
  };

  const sim = new Sim(topology);
  const bgpMsg = (from, to, sport, dport, bgp) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: from.ip, dst: to.ip, ttl: 1, id: 0x1000, protocol: 6 } },
    { proto: 'tcp', fields: { srcPort: sport, dstPort: dport, seq: 1000, ack: 2000, flags: { ack: true, psh: true }, window: 16384 } },
    { proto: 'bgp', fields: bgp },
  ]);

  sim.emit({ kind: 'process', side: 'inspect', activeLayer: 7,
    titleVi: 'eBGP: R1 (AS 65001) ↔ R2 (AS 65002)',
    explanationVi: 'BGP là giao thức định tuyến GIỮA các AS (Internet). Khác IGP (OSPF/EIGRP), nó chạy trên TCP cổng 179 (truyền tin cậy) và chọn đường chủ yếu theo chính sách + AS_PATH.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 4,
    titleVi: 'Trước tiên: bắt tay TCP 3 bước tới cổng 179',
    overlay: { links: { l: { cls: 'forwarding', label: 'TCP 179' } } },
    explanationVi: 'R1 mở kết nối TCP (SYN→SYN-ACK→ACK) tới R2:179 (xem kịch bản TCP 3-way). Có kết nối tin cậy rồi mới trao bản tin BGP.',
    lesson: LESSON });

  const open1 = bgpMsg(R1, R2, R1.port, R2.port, { type: BGP_TYPE.OPEN, myAs: R1.as, holdTime: 180, bgpId: R1.id });
  sim.capture(open1, 'BGP OPEN R1→R2');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'r2', side: 'encap', activeLayer: 7,
    titleVi: 'R1 gửi OPEN (My AS 65001)', packet: open1,
    explanationVi: 'OPEN khai Version=4, My AS=65001, Hold Time=180s, BGP ID=1.1.1.1. Hai bên phải thống nhất mới thành peer.',
    lesson: LESSON });

  const open2 = bgpMsg(R2, R1, R2.port, R1.port, { type: BGP_TYPE.OPEN, myAs: R2.as, holdTime: 180, bgpId: R2.id });
  sim.capture(open2, 'BGP OPEN R2→R1');
  sim.emit({ kind: 'transit', fromDevice: 'r2', toDevice: 'r1', side: 'decap', activeLayer: 7,
    titleVi: 'R2 gửi OPEN (My AS 65002)', packet: open2,
    explanationVi: 'R2 khai AS 65002. Vì khác AS → đây là eBGP (nếu cùng AS là iBGP). Hold Time dùng giá trị nhỏ hơn giữa hai bên.' });

  const ka = bgpMsg(R1, R2, R1.port, R2.port, { type: BGP_TYPE.KEEPALIVE });
  sim.capture(ka, 'BGP KEEPALIVE');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'r2', side: 'encap', activeLayer: 7,
    titleVi: 'KEEPALIVE → phiên Established', packet: ka,
    overlay: { links: { l: { cls: 'root-path', label: 'Established' } } },
    explanationVi: 'Mỗi bên gửi KEEPALIVE (chỉ 19 byte header) để xác nhận OPEN. Sau đó phiên vào trạng thái ESTABLISHED và định kỳ KEEPALIVE để duy trì.',
    lesson: LESSON });

  const upd = bgpMsg(R2, R1, R2.port, R1.port, { type: BGP_TYPE.UPDATE, origin: 0, asPath: [65002], nextHop: R2.ip, nlri: { prefix: '192.168.9.0', len: 24 } });
  sim.capture(upd, 'BGP UPDATE (192.168.9.0/24)');
  sim.emit({ kind: 'transit', fromDevice: 'r2', toDevice: 'r1', side: 'decap', activeLayer: 7,
    titleVi: 'R2 UPDATE: quảng bá 192.168.9.0/24', packet: upd,
    overlay: { links: { l: { cls: 'root-path', label: 'Established' }, ln: { cls: 'forwarding' } }, badges: { net: '192.168.9.0/24' } },
    explanationVi: 'UPDATE mang NLRI = 192.168.9.0/24, NEXT_HOP = 10.0.0.2, AS_PATH = [65002]. Khi R1 quảng bá tiếp sang AS khác, nó thêm 65001 vào đầu AS_PATH.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 7,
    titleVi: 'R1 cài route; AS_PATH chống loop & chọn đường',
    overlay: { links: { l: { cls: 'root-path', label: 'Established' } }, badges: { net: 'đã học ✓' } },
    explanationVi: 'R1 nhận 192.168.9.0/24 qua AS 65002. Nếu một UPDATE có AS_PATH CHỨA chính AS của mình → bị loại (chống loop). ' +
      'Chọn đường tốt nhất xét lần lượt: Weight → Local Pref → AS_PATH ngắn hơn → … (đơn giản hóa: ở đây chỉ có 1 đường).',
    lesson: LESSON });

  return sim.result();
}
