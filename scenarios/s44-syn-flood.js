// scenarios/s44-syn-flood.js
// Kịch bản 44 (Tấn công): TCP SYN flood. Kẻ tấn công gửi rất nhiều SYN với IP nguồn giả.
// Server trả SYN-ACK và giữ chỗ chờ ACK không bao giờ tới, đến khi hàng đợi đầy. Phòng thủ: SYN cookies.

import { Sim } from '../engine/simulate.js';

const ATT = { mac: '00:de:ad:00:00:66', gw: '00:de:ad:00:00:01' };
const CLI = { mac: '00:1a:2b:00:00:10', gw: '00:1a:2b:00:00:11', ip: '100.64.5.10' };
const SRV = { mac: '00:1a:2b:00:00:80', gw: '00:1a:2b:00:00:01', ip: '203.0.113.80' };
const SPOOF = '198.51.100.7';

const LESSON = { path: '../Network security/Module-02_Buc-tranh-tan-cong/Bai-12_DDoS-Session-Hijacking.md', label: 'Bài 12 Security — DDoS/DoS' };

export const meta = {
  id: 's44-syn-flood',
  titleVi: '⚔️ Tấn công: TCP SYN flood',
  titleEn: 'Attack: TCP SYN flood',
  descriptionVi: 'Kẻ tấn công gửi hàng nghìn SYN với IP nguồn giả. Server giữ chỗ chờ bước ACK không bao giờ tới, nên khách thật không kết nối được.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 380',
    devices: [
      { id: 'att', type: 'host', name: 'Kẻ tấn công', x: 150, y: 100, color: '#a0433a', lines: ['giả IP nguồn', SPOOF] },
      { id: 'cli', type: 'host', name: 'Khách thật', x: 150, y: 290, color: '#2c5f8a', lines: [CLI.ip] },
      { id: 'net', type: 'cloud', name: 'Internet', x: 500, y: 190 },
      { id: 'srv', type: 'host', name: 'Web Server', x: 850, y: 190, color: '#2e7d5b', lines: [SRV.ip, 'cổng 443'] },
    ],
    links: [{ id: 'la', a: 'att', b: 'net' }, { id: 'lc', a: 'cli', b: 'net' }, { id: 'ls', a: 'net', b: 'srv' }],
  };
  const sim = new Sim(topology);
  const seg = (ethSrc, ethDst, srcIp, dstIp, sport, dport, seq, ack, flags, ttl) => sim.frame([
    { proto: 'ethernet', fields: { dst: ethDst, src: ethSrc, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: srcIp, dst: dstIp, ttl, id: 0x7000 + (sport % 100), protocol: 6 } },
    { proto: 'tcp', fields: { srcPort: sport, dstPort: dport, seq, ack, flags, window: 64240, mss: flags.syn ? 1460 : undefined } },
  ]);
  const backlog = (rows, title) => ({ list: { title, cols: ['IP nguồn', 'Cổng', 'Trạng thái'], rows } });

  sim.emit({ kind: 'process', atDevice: 'srv', side: 'inspect', activeLayer: 4,
    titleVi: 'Nhắc lại: server giữ chỗ cho mỗi SYN',
    tables: backlog([], 'Hàng đợi SYN của server (0/1024)'),
    explanationVi: 'Bắt tay 3 bước: SYN, SYN-ACK, ACK. Sau khi nhận SYN, server ghi một dòng "nửa mở" vào hàng đợi SYN và chờ ACK. Hàng đợi này có giới hạn.', lesson: LESSON });

  const syn1 = seg(ATT.mac, ATT.gw, SPOOF, SRV.ip, 40001, 443, 9000, 0, { syn: true }, 64);
  sim.capture(syn1, 'SYN giả mạo IP nguồn');
  sim.emit({ kind: 'transit', fromDevice: 'att', toDevice: 'net', side: 'encap', activeLayer: 4,
    titleVi: `Kẻ tấn công gửi SYN với IP nguồn giả ${SPOOF}`, packet: syn1,
    decision: {
      question: `IP nguồn ${SPOOF} là giả. Server sẽ gửi SYN-ACK tới đâu, và chuyện gì xảy ra?`,
      options: ['Tới kẻ tấn công, rồi kẻ tấn công gửi ACK', 'Tới IP giả; không ai gửi ACK, server cứ chờ', 'Server phát hiện IP giả và loại SYN', 'Router Internet chặn vì IP nguồn sai'],
      correct: 1,
      explainVi: 'Server trả lời theo IP nguồn ghi trong gói. Máy ở IP giả không hề mở kết nối nên không gửi ACK.',
    },
    explanationVi: 'Kẻ tấn công không cần nhận trả lời, nên ghi IP nguồn tuỳ ý. Mỗi SYN chỉ dài vài chục byte, gửi được hàng chục nghìn gói mỗi giây.', lesson: LESSON });

  const syn1b = seg(SRV.gw, SRV.mac, SPOOF, SRV.ip, 40001, 443, 9000, 0, { syn: true }, 57);
  sim.emit({ kind: 'transit', fromDevice: 'net', toDevice: 'srv', side: 'decap', activeLayer: 4,
    titleVi: 'SYN tới server: trông giống hệt SYN của khách thật', packet: syn1b,
    tables: backlog([[SPOOF, '40001', 'SYN_RECV (chờ ACK)']], 'Hàng đợi SYN của server (1/1024)'),
    explanationVi: 'Server không phân biệt được SYN này với SYN hợp lệ. Nó cấp bộ nhớ và ghi một dòng nửa mở.', lesson: LESSON });

  const synack = seg(SRV.mac, SRV.gw, SRV.ip, SPOOF, 443, 40001, 5000, 9001, { syn: true, ack: true }, 64);
  sim.capture(synack, 'SYN-ACK gửi tới IP giả');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'net', side: 'encap', activeLayer: 4,
    titleVi: 'Server gửi SYN-ACK tới IP giả, không ai trả lời', packet: synack,
    overlay: { links: { ls: { cls: 'blocking', label: 'SYN-ACK không có hồi âm' } } },
    explanationVi: 'Server gửi lại SYN-ACK vài lần, mỗi lần chờ lâu gấp đôi. Dòng nửa mở nằm trong hàng đợi khoảng một phút mới bị xoá.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'srv', side: 'inspect', activeLayer: 4,
    titleVi: 'Hàng nghìn SYN giả sau đó: hàng đợi đầy',
    tables: backlog([[SPOOF, '40001', 'SYN_RECV'], ['198.51.100.23', '40002', 'SYN_RECV'], ['192.0.2.99', '40003', 'SYN_RECV'], ['… 1021 dòng khác', '', 'SYN_RECV']], 'Hàng đợi SYN của server (1024/1024, đầy)'),
    decision: {
      question: 'Hàng đợi SYN đã đầy. Một khách thật gửi SYN thì sao?',
      options: ['Được ưu tiên vì IP thật', 'Bị loại, khách thấy trang web không tải được', 'Server tự xoá các dòng giả', 'Server chuyển sang UDP'],
      correct: 1,
      explainVi: 'Không còn chỗ trong hàng đợi nên SYN mới bị loại, dù đến từ khách thật.',
    },
    explanationVi: 'Kẻ tấn công gửi SYN nhanh hơn tốc độ server xoá dòng hết hạn. CPU và băng thông của server vẫn còn, nhưng không nhận được kết nối mới.', lesson: LESSON });

  const legit = seg(CLI.mac, CLI.gw, CLI.ip, SRV.ip, 51515, 443, 1000, 0, { syn: true }, 64);
  sim.capture(legit, 'SYN của khách thật (bị loại)');
  sim.emit({ kind: 'transit', fromDevice: 'cli', toDevice: 'net', side: 'encap', activeLayer: 4,
    titleVi: 'Khách thật gửi SYN', packet: legit,
    explanationVi: 'Khách mở trang web như bình thường.', lesson: LESSON });
  const legitB = seg(SRV.gw, SRV.mac, CLI.ip, SRV.ip, 51515, 443, 1000, 0, { syn: true }, 55);
  sim.emit({ kind: 'transit', fromDevice: 'net', toDevice: 'srv', side: 'decap', activeLayer: 4,
    titleVi: 'Server loại SYN của khách thật: từ chối dịch vụ', packet: legitB,
    overlay: { links: { ls: { cls: 'blocking', label: 'SYN bị loại' } } },
    explanationVi: 'Khách không nhận được SYN-ACK, trình duyệt gửi lại SYN rồi báo hết thời gian chờ. Trên server, `netstat -s` cho thấy số SYN bị loại tăng nhanh, và `ss -n state syn-recv` liệt kê rất nhiều kết nối nửa mở.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'srv', side: 'inspect', activeLayer: 4,
    titleVi: 'Phòng thủ: SYN cookies và lọc ở phía trước',
    decision: {
      question: 'SYN cookies giúp server chống SYN flood bằng cách nào?',
      options: ['Chặn mọi SYN từ nước ngoài', 'Không giữ chỗ khi nhận SYN; chỉ tạo kết nối khi ACK hợp lệ quay về', 'Tăng kích thước cửa sổ TCP', 'Mã hoá gói SYN'],
      correct: 1,
      explainVi: 'Server mã hoá thông tin kết nối vào số thứ tự của SYN-ACK. Chỉ máy có IP thật mới trả được ACK đúng.',
    },
    tables: backlog([], 'Hàng đợi SYN của server khi bật SYN cookies (không giữ dòng nửa mở)'),
    explanationVi: 'Linux: `net.ipv4.tcp_syncookies = 1`. Phía trước server: firewall hoặc load balancer làm TCP proxy và giới hạn số SYN mỗi giây theo nguồn. Nhà mạng lọc IP nguồn giả ngay tại biên (uRPF, BCP 38). Tấn công lớn cần dịch vụ chống DDoS.', lesson: LESSON });

  return sim.result();
}
