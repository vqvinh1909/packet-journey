// scenarios/s11-nat-pat.js
// Kịch bản 11 (CCNA Services): NAT/PAT (overload).
// PC private 192.168.1.10 gửi truy vấn ra Internet. Router đổi IP nguồn (và cổng)
// từ inside local → inside global, ghi NAT table; chiều về tra NGƯỢC bảng. Checksum
// IP và UDP được tính lại vì địa chỉ đổi.

import { Sim, diffFields } from '../engine/simulate.js';

const PC = { mac: '00:1a:2b:00:00:01', ip: '192.168.1.10' };
const R_IN = { mac: '00:1a:2b:00:00:a0', ip: '192.168.1.1' };
const R_OUT = { mac: '00:1a:2b:00:00:a1', ip: '203.0.113.1' };
const SRV = { mac: '00:1a:2b:00:00:ff', ip: '8.8.8.8' };
const SPORT = 50000;

const NAT_ROW = { insideLocal: '192.168.1.10:50000', insideGlobal: '203.0.113.1:50000', outside: '8.8.8.8:53', proto: 'udp' };

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-04_Dich-vu-va-Bao-mat-co-ban/Bai-20_NAT.md',
  label: 'Bài 20 — NAT',
};

export const meta = {
  id: 's11-nat-pat',
  titleVi: 'NAT/PAT (overload)',
  titleEn: 'NAT/PAT',
  descriptionVi: 'Router đổi IP+cổng nguồn private → public (inside local→global), ghi NAT table, chiều về tra ngược. Checksum IP & UDP tính lại.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'pc', type: 'host', name: 'PC1', x: 150, y: 150, color: '#2c5f8a', lines: ['192.168.1.10', '(private)'] },
      { id: 'r1', type: 'router', name: 'R1 (NAT)', x: 500, y: 150, lines: ['in 192.168.1.1', 'out 203.0.113.1'] },
      { id: 'srv', type: 'host', name: '8.8.8.8', x: 850, y: 150, color: '#a0433a', lines: ['Internet'] },
    ],
    links: [
      { id: 'lin', a: 'pc', b: 'r1', labelMid: 'inside (private)' },
      { id: 'lout', a: 'r1', b: 'srv', labelMid: 'outside (public)' },
    ],
  };

  const sim = new Sim(topology);

  const udpDns = (p) => sim.frame([
    { proto: 'ethernet', fields: { dst: p.ethDst, src: p.ethSrc, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: p.srcIp, dst: p.dstIp, ttl: p.ttl, id: 0x6a01, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: p.sport, dstPort: p.dport } },
    { proto: 'dns', fields: { id: 0x7c3d, response: p.response, qname: 'example.com', qtype: 1, answers: p.answers } },
  ]);

  // 1. PC -> R1 (chưa dịch)
  const out1 = udpDns({ ethDst: R_IN.mac, ethSrc: PC.mac, srcIp: PC.ip, dstIp: SRV.ip, ttl: 64, sport: SPORT, dport: 53, response: false });
  sim.capture(out1, 'UDP/DNS query (PC→R1, chưa NAT)');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'r1', side: 'encap', activeLayer: 4,
    titleVi: 'PC gửi truy vấn (nguồn private 192.168.1.10:50000)', packet: out1,
    explanationVi: 'PC1 dùng IP private, gửi UDP tới 8.8.8.8:53. IP private KHÔNG định tuyến được trên Internet → router sẽ phải NAT.',
    lesson: LESSON });

  // 2. R1 dịch outbound
  const out2 = udpDns({ ethDst: SRV.mac, ethSrc: R_OUT.mac, srcIp: R_OUT.ip, dstIp: SRV.ip, ttl: 63, sport: SPORT, dport: 53, response: false });
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'forward', activeLayer: 3,
    titleVi: 'R1 NAT: inside local → inside global', packet: out2,
    changedFields: diffFields(out1.tree, out2.tree),
    explanationVi: 'R1 đổi IP nguồn 192.168.1.10 → 203.0.113.1 (và giữ/đổi cổng — đây là PAT/overload nên nhiều host chia nhau 1 IP public nhờ khác cổng). ' +
      'Ghi một dòng vào NAT table để biết đường về. TTL−1, IP checksum tính lại; UDP checksum cũng tính lại vì nó phụ thuộc IP nguồn/đích (pseudo-header).',
    tables: { nat: { title: 'NAT table R1', rows: [NAT_ROW] } },
    lesson: LESSON });
  sim.capture(out2, 'UDP/DNS query (R1→Internet, đã NAT)');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'srv', side: 'forward', activeLayer: 3,
    titleVi: 'Gói đã dịch ra Internet', packet: out2,
    explanationVi: 'Trên Internet, gói mang IP nguồn public 203.0.113.1. Server chỉ thấy IP public này, không biết PC private phía sau.' });

  // 3. Server trả lời (về IP public)
  const in1 = udpDns({ ethDst: R_OUT.mac, ethSrc: SRV.mac, srcIp: SRV.ip, dstIp: R_OUT.ip, ttl: 64, sport: 53, dport: SPORT, response: true, answers: [{ ip: '93.184.216.34', ttl: 300 }] });
  sim.capture(in1, 'UDP/DNS response (Internet→R1)');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'r1', side: 'decap', activeLayer: 4,
    titleVi: 'Server trả lời về 203.0.113.1:50000', packet: in1,
    explanationVi: 'Trả lời đi về IP public 203.0.113.1, cổng đích = 50000. Router phải biến nó về đúng PC private.' });

  // 4. R1 dịch inbound (tra ngược)
  const in2 = udpDns({ ethDst: PC.mac, ethSrc: R_IN.mac, srcIp: SRV.ip, dstIp: PC.ip, ttl: 63, sport: 53, dport: SPORT, response: true, answers: [{ ip: '93.184.216.34', ttl: 300 }] });
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'forward', activeLayer: 3,
    titleVi: 'R1 tra NGƯỢC NAT table: global → local', packet: in2,
    changedFields: diffFields(in1.tree, in2.tree),
    explanationVi: 'R1 tra NAT table bằng (IP đích 203.0.113.1 + cổng 50000) → tìm ra 192.168.1.10:50000. Đổi IP đích về private, TTL−1, tính lại checksum IP & UDP.',
    tables: { nat: { title: 'NAT table R1', rows: [NAT_ROW] } },
    lesson: LESSON });
  sim.capture(in2, 'UDP/DNS response (R1→PC, đã dịch về)');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'pc', side: 'decap', activeLayer: 4,
    titleVi: 'Về đúng PC1 — NAT trong suốt với host', packet: in2,
    explanationVi: 'PC1 nhận trả lời như thể nó nói chuyện trực tiếp. NAT/PAT giúp nhiều máy private chia sẻ 1 IP public, phân biệt bằng cổng. ' +
      '(Đơn giản hóa: bỏ qua các chặng router trung gian trên Internet.)',
    lesson: LESSON });

  return sim.result();
}
