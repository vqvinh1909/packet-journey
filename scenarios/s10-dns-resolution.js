// scenarios/s10-dns-resolution.js
// Kịch bản 10 (CCNA Services): Phân giải DNS đệ quy.
// Client hỏi resolver (UDP 53, RD=1); resolver hỏi lặp root → TLD (.com) →
// authoritative (example.com), lấy bản ghi A rồi trả về client (và cache theo TTL).

import { Sim } from '../engine/simulate.js';

const CLIENT = { id: 'cli', mac: '00:1a:2b:00:00:10', ip: '192.168.1.10' };
const RES = { id: 'res', mac: '00:1a:2b:00:00:53', ip: '192.168.1.53' };
const ROOT = { id: 'root', mac: '00:1a:2b:00:00:a0', ip: '198.41.0.4' };
const TLD = { id: 'tld', mac: '00:1a:2b:00:00:b0', ip: '192.5.6.30' };
const AUTH = { id: 'auth', mac: '00:1a:2b:00:00:c0', ip: '93.184.216.1' };
const QNAME = 'www.example.com';
const ANSWER = '93.184.216.34';
const ID = 0x1a2b;

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-01_Nen-tang-mang/Bai-02_Mo-hinh-OSI-TCPIP.md',
  label: 'Bài 02 — OSI/TCP-IP (tạm; chưa có bài DNS riêng)',
};

export const meta = {
  id: 's10-dns-resolution',
  titleVi: 'DNS phân giải đệ quy',
  titleEn: 'DNS recursive resolution',
  descriptionVi: 'Client hỏi resolver; resolver hỏi lặp root → .com → example.com để lấy bản ghi A, rồi trả về và cache theo TTL.',
  difficulty: 2,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 340',
    devices: [
      { id: 'cli', type: 'host', name: 'Client', x: 130, y: 180, lines: ['192.168.1.10'] },
      { id: 'res', type: 'host', name: 'Resolver', x: 420, y: 180, color: '#2e7d5b', lines: ['192.168.1.53'] },
      { id: 'root', type: 'host', name: 'Root', x: 820, y: 70, color: '#a0433a', lines: ['198.41.0.4'] },
      { id: 'tld', type: 'host', name: 'TLD .com', x: 820, y: 180, color: '#a0433a', lines: ['192.5.6.30'] },
      { id: 'auth', type: 'host', name: 'example.com', x: 820, y: 290, color: '#a0433a', lines: ['93.184.216.1'] },
    ],
    ports: false, // đường logic giữa các máy chủ DNS, không phải dây nối trực tiếp
    links: [
      { id: 'lc', a: 'cli', b: 'res' },
      { id: 'lr', a: 'res', b: 'root' },
      { id: 'lt', a: 'res', b: 'tld' },
      { id: 'la', a: 'res', b: 'auth' },
    ],
  };

  const sim = new Sim(topology);

  const dns = (p) => sim.frame([
    { proto: 'ethernet', fields: { dst: p.ethDst, src: p.ethSrc, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: p.srcIp, dst: p.dstIp, ttl: 64, id: 0, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: p.sport, dstPort: p.dport } },
    { proto: 'dns', fields: { id: ID, response: p.response, qname: QNAME, qtype: 1, answers: p.answers } },
  ]);

  // 1. Client -> Resolver (RD=1)
  const q1 = dns({ ethDst: RES.mac, ethSrc: CLIENT.mac, srcIp: CLIENT.ip, dstIp: RES.ip, sport: 50000, dport: 53, response: false });
  sim.capture(q1, 'DNS Query (Client→Resolver, RD=1)');
  sim.emit({ kind: 'transit', fromDevice: 'cli', toDevice: 'res', side: 'encap', activeLayer: 7,
    titleVi: 'Client hỏi Resolver (RD = 1)', packet: q1,
    explanationVi: 'Client gửi truy vấn UDP cổng 53, cờ RD = 1 (Recursion Desired: "làm ơn hỏi hộ tới khi ra kết quả"). Hỏi A của www.example.com.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'res', side: 'inspect', activeLayer: 7,
    titleVi: 'Resolver: cache miss → hỏi lặp từ Root',
    explanationVi: 'Resolver không có sẵn trong cache → bắt đầu hỏi LẶP (iterative, RD=0): đi từ root xuống.',
    lesson: LESSON });

  // 2. Resolver -> Root
  const q2 = dns({ ethDst: ROOT.mac, ethSrc: RES.mac, srcIp: RES.ip, dstIp: ROOT.ip, sport: 33001, dport: 53, response: false });
  sim.capture(q2, 'DNS Query → Root');
  sim.emit({ kind: 'transit', fromDevice: 'res', toDevice: 'root', side: 'encap', activeLayer: 7, titleVi: 'Hỏi Root server', packet: q2,
    explanationVi: 'Root không biết www.example.com nhưng biết ai quản .com → trả về REFERRAL (NS của .com). (Đơn giản hóa: app mô tả referral bằng lời.)' });

  // 3. Resolver -> TLD
  const q3 = dns({ ethDst: TLD.mac, ethSrc: RES.mac, srcIp: RES.ip, dstIp: TLD.ip, sport: 33002, dport: 53, response: false });
  sim.capture(q3, 'DNS Query → TLD .com');
  sim.emit({ kind: 'transit', fromDevice: 'res', toDevice: 'tld', side: 'encap', activeLayer: 7, titleVi: 'Hỏi TLD .com', packet: q3,
    explanationVi: '.com cũng không có bản ghi cuối, nhưng biết name server authoritative của example.com → referral tiếp.' });

  // 4. Resolver -> Auth
  const q4 = dns({ ethDst: AUTH.mac, ethSrc: RES.mac, srcIp: RES.ip, dstIp: AUTH.ip, sport: 33003, dport: 53, response: false });
  sim.capture(q4, 'DNS Query → Authoritative');
  sim.emit({ kind: 'transit', fromDevice: 'res', toDevice: 'auth', side: 'encap', activeLayer: 7, titleVi: 'Hỏi Authoritative (example.com)', packet: q4,
    explanationVi: 'Name server authoritative của example.com GIỮ bản ghi thật → sẽ trả lời có kết quả A.' });

  // 5. Auth -> Resolver (answer)
  const r1 = dns({ ethDst: RES.mac, ethSrc: AUTH.mac, srcIp: AUTH.ip, dstIp: RES.ip, sport: 53, dport: 33003, response: true, answers: [{ ip: ANSWER, ttl: 300 }] });
  sim.capture(r1, 'DNS Response (A record)');
  sim.emit({ kind: 'transit', fromDevice: 'auth', toDevice: 'res', side: 'decap', activeLayer: 7, titleVi: 'Authoritative trả bản ghi A', packet: r1,
    explanationVi: `Trả lời: www.example.com → A = ${ANSWER}, TTL 300s. Answer dùng con trỏ nén 0xC00C để khỏi lặp lại tên.`,
    lesson: LESSON });

  // 6. Resolver -> Client (final)
  const r2 = dns({ ethDst: CLIENT.mac, ethSrc: RES.mac, srcIp: RES.ip, dstIp: CLIENT.ip, sport: 53, dport: 50000, response: true, answers: [{ ip: ANSWER, ttl: 300 }] });
  sim.capture(r2, 'DNS Response → Client');
  sim.emit({ kind: 'transit', fromDevice: 'res', toDevice: 'cli', side: 'decap', activeLayer: 7, titleVi: 'Resolver trả Client + cache theo TTL', packet: r2,
    explanationVi: `Resolver trả kết quả về client (RA = 1) và LƯU CACHE 300s: trong thời gian đó, ai hỏi lại cũng trả ngay, không đi hỏi root nữa. Client giờ biết ${ANSWER} để mở kết nối TCP.`,
    lesson: LESSON });

  return sim.result();
}
