// scenarios/s48-ipsec-ikev2.js
// Kịch bản 48 (Bảo mật): VPN IPsec site-to-site với IKEv2.
// Gói đầu tiên khớp chính sách kích hoạt IKE: IKE_SA_INIT (trao khoá), IKE_AUTH (xác thực, tạo SA), rồi dữ liệu đi trong ESP.
// Đơn giản hoá: hai router nối thẳng qua một đường "Internet"; payload IKE và ESP là byte mẫu.

import { Sim } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

const PC1 = { mac: '00:1a:2b:00:00:10', ip: '10.1.1.10' };
const PC2 = { mac: '00:1a:2b:00:00:20', ip: '10.2.2.20' };
const R1 = { lan: '00:1a:2b:00:01:01', wan: '00:1a:2b:00:01:02', ip: '203.0.113.1' };
const R2 = { lan: '00:1a:2b:00:02:01', wan: '00:1a:2b:00:02:02', ip: '198.51.100.2' };
const SPI_I = [0x5a, 0x11, 0xc3, 0x07, 0x9e, 0x42, 0xd0, 0x18];
const SPI_R = [0xb7, 0x60, 0x2f, 0xe1, 0x04, 0x8c, 0x39, 0xaa];

const LESSON = { path: '../Network security/Module-05_Firewall-VPN/Bai-30_VPN-Site-to-Site-Remote-Access-IPSec-SSL.md', label: 'Bài 30 Security — VPN IPsec/SSL' };

export const meta = {
  id: 's48-ipsec-ikev2',
  titleVi: '🔒 Bảo mật: VPN IPsec site-to-site (IKEv2 + ESP)',
  titleEn: 'Security: IPsec site-to-site VPN (IKEv2 + ESP)',
  descriptionVi: 'Hai router dựng đường hầm IPsec: IKEv2 thoả thuận khoá và xác thực, sau đó gói của người dùng được bọc trong ESP.',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 260',
    devices: [
      { id: 'pc1', type: 'host', name: 'PC1', x: 90, y: 130, color: '#2c5f8a', lines: [PC1.ip, 'chi nhánh A'] },
      { id: 'r1', type: 'router', name: 'R1', x: 330, y: 130, lines: [`WAN ${R1.ip}`] },
      { id: 'r2', type: 'router', name: 'R2', x: 670, y: 130, lines: [`WAN ${R2.ip}`] },
      { id: 'pc2', type: 'host', name: 'PC2', x: 910, y: 130, color: '#2e7d5b', lines: [PC2.ip, 'chi nhánh B'] },
    ],
    links: [{ id: 'l1', a: 'pc1', b: 'r1' }, { id: 'wan', a: 'r1', b: 'r2', labelMid: 'Internet' }, { id: 'l2', a: 'r2', b: 'pc2' }],
  };
  const sim = new Sim(topology);
  const ping = (ethSrc, ethDst, ttl) => sim.frame(echoFrame({ ethDst, ethSrc, srcIp: PC1.ip, dstIp: PC2.ip, ttl, ipId: 0x4d2, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
  const ike = (fromR1, f) => sim.frame([
    { proto: 'ethernet', fields: { dst: fromR1 ? R2.wan : R1.wan, src: fromR1 ? R1.wan : R2.wan, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: fromR1 ? R1.ip : R2.ip, dst: fromR1 ? R2.ip : R1.ip, ttl: 255, id: 0x100 + f.msgId, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: 500, dstPort: 500 } },
    { proto: 'ike', fields: { spiI: SPI_I, ...f, response: !fromR1 } },
  ]);
  const zero = new Array(8).fill(0);

  const p0 = ping(PC1.mac, R1.lan, 64);
  sim.capture(p0, 'Ping gốc (chưa mã hoá, trong LAN)');
  sim.emit({ kind: 'transit', fromDevice: 'pc1', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'PC1 ping PC2 ở chi nhánh B', packet: p0,
    explanationVi: 'Trong LAN, gói đi dạng rõ. PC1 không biết gì về VPN: nó chỉ gửi gói cho default gateway R1.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'R1: gói khớp chính sách VPN nhưng chưa có đường hầm',
    tables: { list: { title: 'Chính sách IPsec trên R1', cols: ['Mục', 'Giá trị'], rows: [['Lưu lượng cần bảo vệ', '10.1.1.0/24 → 10.2.2.0/24'], ['Peer', R2.ip], ['Xác thực', 'pre-shared key'], ['IPsec SA hiện có', 'chưa có']] } },
    decision: {
      question: 'Gói khớp chính sách nhưng chưa có SA. R1 làm gì?',
      options: ['Gửi gói dạng rõ ra Internet', 'Bắt đầu IKE để thoả thuận khoá với R2', 'Trả ICMP unreachable cho PC1', 'Chờ R2 tự kết nối'],
      correct: 1,
      explainVi: 'Lưu lượng khớp chính sách kích hoạt IKE. Gói đầu tiên thường bị mất trong lúc dựng đường hầm.',
    },
    explanationVi: 'IPsec cần hai thứ: một kênh điều khiển an toàn (IKE SA) và các khoá mã hoá dữ liệu (IPsec SA). IKEv2 tạo cả hai chỉ với 4 bản tin.', lesson: LESSON });

  const i1 = ike(true, { spiR: zero, exch: 34, msgId: 0, payloads: 'SA (thuật toán đề nghị), KE (khoá DH), Nonce', size: 300 });
  sim.capture(i1, 'IKE_SA_INIT request');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'r2', side: 'encap', activeLayer: 5,
    titleVi: 'IKE_SA_INIT (1/4): R1 đề nghị thuật toán và gửi khoá DH', packet: i1,
    explanationVi: 'UDP cổng 500, chưa mã hoá. R1 đề nghị bộ thuật toán (ví dụ AES-256, SHA-256, DH nhóm 14) và gửi khoá công khai Diffie-Hellman. Responder SPI còn bằng 0.', lesson: LESSON });
  const i2 = ike(false, { spiR: SPI_R, exch: 34, msgId: 0, payloads: 'SA (thuật toán được chọn), KE (khoá DH), Nonce', size: 300 });
  sim.capture(i2, 'IKE_SA_INIT response');
  sim.emit({ kind: 'transit', fromDevice: 'r2', toDevice: 'r1', side: 'encap', activeLayer: 5,
    titleVi: 'IKE_SA_INIT (2/4): R2 chọn thuật toán, gửi khoá DH của mình', packet: i2,
    decision: {
      question: 'Sau hai gói này hai router đã có khoá chung. Vì sao vẫn chưa tin nhau được?',
      options: ['Vì chưa có địa chỉ IP', 'Vì chưa xác thực: có thể đang trao khoá với kẻ đứng giữa', 'Vì UDP không tin cậy', 'Vì chưa có NAT'],
      correct: 1,
      explainVi: 'Diffie-Hellman cho khoá chung nhưng không cho biết bên kia là ai. Bước IKE_AUTH chứng minh danh tính.',
    },
    explanationVi: 'Hai bên tính ra khoá chung mà không gửi khoá qua mạng. Nếu hai đầu không có bộ thuật toán nào chung, R2 trả NO_PROPOSAL_CHOSEN: lỗi cấu hình hay gặp nhất.', lesson: LESSON });

  const a1 = ike(true, { spiR: SPI_R, exch: 35, msgId: 1, encrypted: true, payloads: 'IDi, AUTH, SA con, Traffic Selector', size: 220 });
  sim.capture(a1, 'IKE_AUTH request (đã mã hoá)');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'r2', side: 'encap', activeLayer: 5,
    titleVi: 'IKE_AUTH (3/4): R1 chứng minh danh tính, đề nghị SA cho dữ liệu', packet: a1,
    explanationVi: 'Từ đây IKE đã mã hoá. Payload AUTH được tính từ pre-shared key (hoặc chữ ký chứng chỉ). Traffic Selector nêu dải mạng hai bên sẽ bảo vệ.', lesson: LESSON });
  const a2 = ike(false, { spiR: SPI_R, exch: 35, msgId: 1, encrypted: true, payloads: 'IDr, AUTH, SA con, Traffic Selector', size: 220 });
  sim.capture(a2, 'IKE_AUTH response (đã mã hoá)');
  sim.emit({ kind: 'transit', fromDevice: 'r2', toDevice: 'r1', side: 'encap', activeLayer: 5,
    titleVi: 'IKE_AUTH (4/4): R2 xác thực lại, đường hầm lên', packet: a2,
    tables: { list: { title: 'SA trên R1 sau IKE_AUTH', cols: ['SA', 'Thông số'], rows: [['IKE SA', 'AES-256, SHA-256, DH 14, sống 24 giờ'], ['IPsec SA ra', 'ESP SPI 0xc0de0001, AES-256-GCM'], ['IPsec SA vào', 'ESP SPI 0xc0de0002, AES-256-GCM']] } },
    explanationVi: 'Pre-shared key lệch thì bước này thất bại với AUTHENTICATION_FAILED. Traffic Selector hai đầu không đối xứng thì trả TS_UNACCEPTABLE. Mỗi chiều dữ liệu có một IPsec SA riêng với SPI riêng.', lesson: LESSON });

  const espF = sim.frame([
    { proto: 'ethernet', fields: { dst: R2.wan, src: R1.wan, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: R1.ip, dst: R2.ip, ttl: 255, id: 0x200, protocol: 50 } },
    { proto: 'esp', fields: { spi: 0xc0de0001, seq: 1 } },
    { proto: 'raw', fields: { data: Array.from({ length: 88 }, (_, i) => (i * 113 + 41) & 0xff), desc: 'Gói IP gốc 10.1.1.10 → 10.2.2.20 (ICMP) đã mã hoá, kèm phần đệm và mã kiểm toàn vẹn.' } },
  ]);
  sim.capture(espF, 'ESP: gói gốc đã mã hoá');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'r2', side: 'encap', activeLayer: 3,
    titleVi: 'Dữ liệu đi trong ESP (tunnel mode)', packet: espF,
    overlay: { links: { wan: { cls: 'trunk', label: 'đường hầm IPsec' } } },
    decision: {
      question: 'Người nghe lén trên Internet thấy gì ở gói này?',
      options: ['IP của PC1 và PC2, nội dung ICMP', 'Chỉ IP công khai của R1 và R2, SPI và dữ liệu đã mã hoá', 'Pre-shared key', 'Không thấy gói nào'],
      correct: 1,
      explainVi: 'Tunnel mode bọc cả gói IP gốc. IP nội bộ 10.x cũng bị che.',
    },
    explanationVi: 'IP ngoài là R1 → R2, giao thức 50 (ESP). SPI cho R2 biết dùng SA nào để giải mã; Sequence tăng dần để chống phát lại. Nếu có NAT trên đường, ESP được bọc thêm trong UDP 4500 (NAT-T).', lesson: LESSON });

  const p2 = ping(R2.lan, PC2.mac, 62);
  sim.capture(p2, 'Ping gốc sau khi R2 giải mã');
  sim.emit({ kind: 'transit', fromDevice: 'r2', toDevice: 'pc2', side: 'decap', activeLayer: 3,
    titleVi: 'R2 giải mã và chuyển gói gốc cho PC2', packet: p2,
    explanationVi: 'R2 tra SPI, kiểm mã toàn vẹn, giải mã rồi định tuyến gói gốc. TTL còn 62 vì gói gốc đi qua hai router. Kiểm tra: `show crypto ikev2 sa`, `show crypto ipsec sa` (bộ đếm encaps và decaps phải cùng tăng).', lesson: LESSON });

  return sim.result();
}
