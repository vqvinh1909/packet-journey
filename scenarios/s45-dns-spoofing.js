// scenarios/s45-dns-spoofing.js
// Kịch bản 45 (Tấn công): DNS spoofing. Kẻ tấn công đã đứng giữa (xem s41) nên thấy truy vấn DNS,
// rồi tự trả lời giả với đúng Transaction ID và cổng. Phòng thủ: DNSSEC, DNS mã hoá, kiểm tra chứng chỉ HTTPS.

import { Sim } from '../engine/simulate.js';

const PC = { mac: '00:1a:2b:00:00:10', ip: '192.168.1.10' };
const RES = { mac: '00:1a:2b:00:00:53', ip: '192.168.1.53' };
const ATT = { mac: '00:de:ad:00:00:66', ip: '192.168.1.66' };
const QNAME = 'bank.example.vn';
const ID = 0x1a2b;
const SPORT = 50000;

const LESSON = { path: '../Network security/Module-02_Buc-tranh-tan-cong/Bai-09_Tan-cong-mang-noi-bo.md', label: 'Bài 09 Security — Tấn công mạng nội bộ' };

export const meta = {
  id: 's45-dns-spoofing',
  titleVi: '⚔️ Tấn công: DNS spoofing (trả lời DNS giả)',
  titleEn: 'Attack: DNS spoofing',
  descriptionVi: 'Kẻ tấn công thấy truy vấn DNS của nạn nhân và trả lời giả, dẫn nạn nhân tới trang web giả mạo.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 380',
    devices: [
      { id: 'pc', type: 'host', name: 'PC nạn nhân', x: 160, y: 120, color: '#2c5f8a', lines: [PC.ip, 'ARP cache đã bị đầu độc'] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 500, y: 120, lines: ['VLAN 10'] },
      { id: 'res', type: 'host', name: 'DNS Resolver', x: 840, y: 120, color: '#2e7d5b', lines: [RES.ip] },
      { id: 'att', type: 'host', name: 'Kẻ tấn công', x: 500, y: 310, color: '#a0433a', lines: [ATT.ip, 'web giả mạo'] },
    ],
    links: [{ id: 'l1', a: 'pc', b: 'sw' }, { id: 'l2', a: 'sw', b: 'res' }, { id: 'l3', a: 'sw', b: 'att' }],
  };
  const sim = new Sim(topology);
  const dns = (p) => sim.frame([
    { proto: 'ethernet', fields: { dst: p.ethDst, src: p.ethSrc, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: p.srcIp, dst: p.dstIp, ttl: 64, id: 0, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: p.sport, dstPort: p.dport } },
    { proto: 'dns', fields: { id: ID, response: p.response, qname: QNAME, qtype: 1, answers: p.answers } },
  ]);

  // Truy vấn: IP đích là resolver, nhưng MAC đích là kẻ tấn công (ARP cache bị đầu độc)
  const q = dns({ ethDst: ATT.mac, ethSrc: PC.mac, srcIp: PC.ip, dstIp: RES.ip, sport: SPORT, dport: 53, response: false });
  sim.capture(q, 'DNS Query (đi qua kẻ tấn công)');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: `PC hỏi DNS: ${QNAME} có IP nào?`, packet: q,
    explanationVi: `PC gửi truy vấn tới resolver ${RES.ip}. Nhưng ARP cache đã bị đầu độc (kịch bản ARP spoofing), nên MAC đích của khung là MAC của kẻ tấn công. DNS truyền bằng UDP, không mã hoá.`, lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'att', side: 'forward', activeLayer: 7,
    titleVi: 'Kẻ tấn công đọc được truy vấn: ID, cổng nguồn, tên miền', packet: q,
    overlay: { links: { l3: { cls: 'blocking', label: 'truy vấn bị chặn giữ' } } },
    decision: {
      question: 'PC chỉ chấp nhận câu trả lời DNS khi nào?',
      options: ['Khi có chữ ký số của resolver', 'Khi đúng Transaction ID, đúng cổng và đúng IP nguồn', 'Khi đến từ đúng MAC của resolver', 'Khi câu trả lời được mã hoá'],
      correct: 1,
      explainVi: 'DNS thường không có chữ ký. Client chỉ so Transaction ID, cổng UDP và IP nguồn với truy vấn đã gửi.',
    },
    explanationVi: `Kẻ tấn công đã thấy đủ ba thứ cần khớp: Transaction ID 0x${ID.toString(16)}, cổng nguồn ${SPORT} và IP resolver ${RES.ip}. Nó không chuyển truy vấn đi tiếp.`, lesson: LESSON });

  const fake = dns({ ethDst: PC.mac, ethSrc: ATT.mac, srcIp: RES.ip, dstIp: PC.ip, sport: 53, dport: SPORT, response: true, answers: [{ ip: ATT.ip, ttl: 86400 }] });
  sim.capture(fake, 'DNS Response giả');
  sim.emit({ kind: 'transit', fromDevice: 'att', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: `Kẻ tấn công trả lời giả: ${QNAME} = ${ATT.ip}`, packet: fake,
    explanationVi: `IP nguồn ghi là ${RES.ip} (giả làm resolver), Transaction ID và cổng khớp với truy vấn. Câu trả lời trỏ tên miền về máy kẻ tấn công, TTL 86400 giây để nằm lâu trong cache.`, lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'pc', side: 'decap', activeLayer: 7,
    titleVi: 'PC chấp nhận câu trả lời giả và lưu vào cache', packet: fake,
    tables: { list: { title: 'DNS cache của PC', cols: ['Tên miền', 'IP', 'TTL'], rows: [[QNAME, `${ATT.ip} ✗`, '86400 giây']] } },
    explanationVi: 'Mọi thứ đều khớp nên PC tin. Trong một ngày tới, mọi lần vào tên miền này đều dùng IP giả, kể cả khi kẻ tấn công đã ngừng ARP spoofing.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'pc', side: 'inspect', activeLayer: 7,
    titleVi: 'Trình duyệt mở trang web giả mạo',
    overlay: { links: { l3: { cls: 'blocking', label: 'HTTP tới web giả' } } },
    decision: {
      question: 'Trang giả không có chứng chỉ hợp lệ cho tên miền thật. Dấu hiệu nào giúp người dùng nhận ra?',
      options: ['Trang tải chậm hơn', 'Trình duyệt cảnh báo chứng chỉ HTTPS không hợp lệ', 'Địa chỉ IP hiện trên thanh địa chỉ', 'Ping tên miền bị mất gói'],
      correct: 1,
      explainVi: 'Kẻ tấn công đổi được IP nhưng không có khoá riêng của chứng chỉ thật. HTTPS phát hiện điều này.',
    },
    explanationVi: 'Trang giả sao chép giao diện trang thật để lấy tên đăng nhập và mật khẩu. Kiểm tra bằng `nslookup` với một DNS khác rồi so IP; xoá cache bằng `ipconfig /flushdns`.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'inspect', activeLayer: 7,
    titleVi: 'Phòng thủ: chặn đứng giữa, xác thực và mã hoá DNS',
    tables: { list: { title: 'Các lớp phòng thủ', cols: ['Lớp', 'Tác dụng'], rows: [
      ['DAI + DHCP snooping', 'Kẻ tấn công không đứng giữa được nên không thấy truy vấn'],
      ['DNSSEC', 'Resolver kiểm chữ ký số của bản ghi, loại bản ghi giả'],
      ['DoT / DoH', 'Mã hoá truy vấn giữa client và resolver'],
      ['HTTPS + HSTS', 'Trình duyệt từ chối trang có chứng chỉ sai'],
    ] } },
    explanationVi: 'Không lớp nào đủ một mình. Trong LAN, chặn ARP spoofing là bước đầu. DNSSEC chống giả bản ghi trên đường từ máy chủ tên miền tới resolver; DoT và DoH bảo vệ đoạn từ client tới resolver.', lesson: LESSON });

  return sim.result();
}
