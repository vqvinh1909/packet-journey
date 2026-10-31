// scenarios/s33-multicast.js
// Kịch bản 33 (ENCOR 3.3): IGMP và PIM Sparse Mode.
// Máy nhận báo IGMP, cây dùng chung qua RP, Register, RPF, chuyển sang cây ngắn nhất, rồi SSM.

import { Sim } from '../engine/simulate.js';

const SRC = { mac: '00:aa:00:00:33:01', ip: '10.1.1.10' };
const RCV = { mac: '00:aa:00:00:33:02', ip: '10.3.3.20' };
const R1 = { mac: '00:1a:2b:00:33:01' };
const RP = { mac: '00:1a:2b:00:33:0a', ip: '10.0.0.100' };
const R3 = { mac: '00:1a:2b:00:33:03' };
const G = '239.1.1.1';
const MAC_G = '01:00:5e:01:01:01', MAC_PIM = '01:00:5e:00:00:0d';

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Định tuyến (multicast: ENCOR 3.3)',
};

export const meta = {
  id: 's33-multicast',
  titleVi: 'Multicast: IGMP, PIM Sparse Mode, RPF, SSM',
  titleEn: 'Multicast: IGMP, PIM-SM, RPF, SSM',
  descriptionVi: 'Máy nhận tham gia nhóm bằng IGMP, router dựng cây qua RP bằng PIM, nguồn đăng ký bằng Register, rồi chuyển sang cây ngắn nhất và kiểm tra RPF.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 'src', type: 'host', name: 'Nguồn', x: 90, y: 220, color: '#2c5f8a', lines: ['10.1.1.10'] },
      { id: 'r1', type: 'router', name: 'R1', x: 300, y: 220, lines: ['First Hop'] },
      { id: 'rp', type: 'router', name: 'RP', x: 500, y: 70, lines: ['10.0.0.100'] },
      { id: 'r3', type: 'router', name: 'R3', x: 700, y: 220, lines: ['Last Hop'] },
      { id: 'rcv', type: 'host', name: 'Máy nhận', x: 910, y: 220, color: '#2c5f8a', lines: ['10.3.3.20'] },
    ],
    links: [
      { id: 'l1', a: 'src', b: 'r1', bp: 'Gi0/0' },
      { id: 'l2', a: 'r1', b: 'rp', ap: 'Gi0/1', bp: 'Gi0/0' },
      { id: 'l3', a: 'rp', b: 'r3', ap: 'Gi0/1', bp: 'Gi0/0' },
      { id: 'l4', a: 'r1', b: 'r3', ap: 'Gi0/2', bp: 'Gi0/1' },
      { id: 'l5', a: 'r3', b: 'rcv', ap: 'Gi0/2' },
    ],
  };
  const sim = new Sim(topology);

  const eth = (dst, src) => ({ proto: 'ethernet', fields: { dst, src, etherType: 0x0800 } });
  const ip = (src, dst, ttl, protocol) => ({ proto: 'ipv4', fields: { src, dst, ttl, id: 0x3300, protocol } });
  const stream = (ttl) => [ip(SRC.ip, G, ttl, 17), { proto: 'udp', fields: { srcPort: 40000, dstPort: 5004 } }, { proto: 'raw', fields: { data: new Array(32).fill(0x4d), desc: 'Dữ liệu luồng video.' } }];
  const data = (src, ttl) => sim.frame([eth(MAC_G, src), ...stream(ttl)]);
  const join = (from, srcMac, upstream, joins, prunes = []) => sim.frame([eth(MAC_PIM, srcMac), ip(from, '224.0.0.13', 1, 103), { proto: 'pim', fields: { type: 'join', upstream, group: G, joins, prunes } }]);
  const mroute = (who, rows) => ({ list: { title: `Bảng mroute ${who}`, cols: ['Mục', 'IIF', 'OIL'], rows } });
  const STAR = (iif, oil) => [`(*, ${G})`, iif, oil];
  const SG = (iif, oil) => [`(${SRC.ip}, ${G})`, iif, oil];

  const hello = sim.frame([eth(MAC_PIM, R3.mac), ip('10.0.23.3', '224.0.0.13', 1, 103), { proto: 'pim', fields: { type: 'hello' } }]);
  sim.capture(hello, 'PIM Hello (R3)');
  sim.emit({ kind: 'transit', fromDevice: 'r3', toDevice: 'rp', side: 'forward', activeLayer: 3,
    titleVi: 'PIM Hello: các router nhận ra nhau', packet: hello,
    overlay: { links: { l3: { label: 'PIM Hello' } } },
    explanationVi: 'PIM chạy trực tiếp trên IP, số giao thức 103, gửi tới 224.0.0.13 với TTL 1. PIM không tự có bảng định tuyến. Nó dùng bảng unicast có sẵn để kiểm tra RPF, nên mới gọi là Protocol Independent.', lesson: LESSON });

  const rep = sim.frame([eth(MAC_G, RCV.mac), ip(RCV.ip, G, 1, 2), { proto: 'igmp', fields: { type: 0x16, group: G } }]);
  sim.capture(rep, 'IGMPv2 Report 239.1.1.1');
  sim.emit({ kind: 'transit', fromDevice: 'rcv', toDevice: 'r3', side: 'encap', activeLayer: 3,
    titleVi: 'Máy nhận báo IGMPv2: muốn nhận 239.1.1.1', packet: rep,
    overlay: { links: { l5: { cls: 'forwarding', label: 'IGMP Report' } } },
    explanationVi: 'MAC đích 01:00:5e:01:01:01 lấy 23 bit thấp của IP nhóm, nên 32 IP nhóm có thể chung một MAC. IGMP chỉ chạy giữa máy và router cuối. Muốn rời nhóm, máy gửi Leave tới 224.0.0.2 và router hỏi lại bằng Group-Specific Query.', lesson: LESSON });

  const j1 = join('10.0.23.3', R3.mac, '10.0.23.2', [{ addr: RP.ip, flags: 7 }]);
  sim.emit({ kind: 'process', atDevice: 'r3', side: 'forward', activeLayer: 3,
    titleVi: 'R3 tạo (*,G) và chọn cổng theo RPF về RP', packet: j1, tables: mroute('R3', [STAR('Gi0/0', 'Gi0/2')]),
    explanationVi: 'R3 tra đường unicast tới RP và thấy đi ra Gi0/0, đó là cổng vào (IIF). Cổng có máy nhận là Gi0/2, vào danh sách ra (OIL). Dấu * nghĩa là mọi nguồn của nhóm.', lesson: LESSON });
  sim.capture(j1, 'PIM Join (*,G)');
  sim.emit({ kind: 'transit', fromDevice: 'r3', toDevice: 'rp', side: 'forward', activeLayer: 3,
    titleVi: 'R3 gửi Join (*,G) về phía RP', packet: j1,
    overlay: { links: { l3: { cls: 'trunk', label: 'Join (*,G)' } } },
    explanationVi: 'Sparse Mode theo kiểu kéo: không ai xin thì không có luồng. Mọi router phải biết cùng một RP, cấu hình tĩnh hoặc học qua Auto-RP, BSR.', lesson: LESSON });
  sim.emit({ kind: 'process', atDevice: 'rp', side: 'forward', activeLayer: 3,
    titleVi: 'RP ghi nhận: nhánh Gi0/1 có người nhận', packet: j1, tables: mroute('RP', [STAR('Null', 'Gi0/1')]),
    explanationVi: 'IIF là Null vì chính RP là gốc của cây dùng chung. Lúc này chưa có nguồn nào, nhưng cây đã sẵn sàng.', lesson: LESSON });

  const d1 = data(SRC.mac, 64);
  sim.capture(d1, 'Luồng multicast từ nguồn');
  sim.emit({ kind: 'transit', fromDevice: 'src', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'Nguồn phát tới 239.1.1.1', packet: d1,
    overlay: { links: { l1: { cls: 'forwarding', label: 'multicast' } } },
    explanationVi: 'Nguồn không cần tham gia nhóm, cứ phát. IP đích là nhóm, IP nguồn vẫn là unicast.', lesson: LESSON });

  const reg = sim.frame([eth(RP.mac, R1.mac), ip('10.0.12.1', RP.ip, 255, 103), { proto: 'pim', fields: { type: 'register' } }, ...stream(63)]);
  sim.capture(reg, 'PIM Register bọc gói multicast');
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'forward', activeLayer: 3,
    titleVi: 'R1 bọc gói vào PIM Register gửi unicast tới RP', packet: reg, tables: mroute('R1', [SG('Gi0/0', 'Register')]),
    explanationVi: 'R1 chưa có cây tới RP, nên bọc nguyên gói multicast vào bản tin unicast. Xem cây trường: IP ngoài có đích là RP, bên trong là gói gốc.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'rp', side: 'forward', activeLayer: 3,
    titleVi: 'Register tới RP', packet: reg,
    overlay: { links: { l2: { cls: 'trunk', label: 'Register (unicast)' } } },
    explanationVi: 'RP gỡ lớp bọc và đẩy gói xuống cây dùng chung.', lesson: LESSON });

  const d2 = data(RP.mac, 62);
  sim.emit({ kind: 'transit', fromDevice: 'rp', toDevice: 'r3', side: 'forward', activeLayer: 3,
    titleVi: 'RP đẩy gói xuống cây dùng chung', packet: d2, tables: mroute('RP', [STAR('Null', 'Gi0/1'), SG('Gi0/0', 'Gi0/1')]),
    overlay: { links: { l3: { cls: 'forwarding', label: 'shared tree' } } },
    explanationVi: 'Máy nhận có gói đầu tiên. RP cũng gửi Join (S,G) về R1 để nhận gói thật không bọc, sau đó trả Register-Stop.', lesson: LESSON });
  const d3 = data(R3.mac, 61);
  sim.capture(d3, 'Gói multicast tới máy nhận');
  sim.emit({ kind: 'transit', fromDevice: 'r3', toDevice: 'rcv', side: 'decap', activeLayer: 3,
    titleVi: 'Máy nhận có dữ liệu qua cây dùng chung', packet: d3,
    overlay: { links: { l5: { cls: 'forwarding', label: 'multicast' } } },
    explanationVi: 'R3 giờ biết IP nguồn. Đường unicast tới nguồn đi thẳng qua Gi0/1, ngắn hơn đường vòng qua RP.', lesson: LESSON });

  const j2 = join('10.0.13.3', R3.mac, '10.0.13.1', [{ addr: SRC.ip, flags: 4 }]);
  sim.capture(j2, 'PIM Join (S,G)');
  sim.emit({ kind: 'transit', fromDevice: 'r3', toDevice: 'r1', side: 'forward', activeLayer: 3,
    titleVi: 'R3 gửi Join (S,G) thẳng về R1: chuyển sang cây ngắn nhất', packet: j2,
    overlay: { links: { l4: { cls: 'trunk', label: 'Join (S,G)' } } },
    explanationVi: 'Mặc định Cisco chuyển sang SPT ngay khi có gói đầu tiên. Không bit W nghĩa là chỉ một nguồn.', lesson: LESSON });

  const pr = join('10.0.23.3', R3.mac, '10.0.23.2', [], [{ addr: SRC.ip, flags: 5 }]);
  sim.capture(pr, 'PIM Prune (S,G,rpt)');
  sim.emit({ kind: 'process', atDevice: 'r3', side: 'forward', activeLayer: 3,
    titleVi: 'Kiểm tra RPF: gói từ RP giờ bị loại', packet: pr, tables: mroute('R3', [STAR('Gi0/0', 'Gi0/2'), SG('Gi0/1', 'Gi0/2')]),
    explanationVi: 'Với mục (S,G), IIF là Gi0/1. Gói của nguồn đi vào Gi0/0 sẽ trượt RPF và bị bỏ. RPF là cách multicast chống lặp: chỉ nhận gói từ cổng mà mình sẽ dùng để đi về nguồn.', lesson: LESSON });
  sim.emit({ kind: 'transit', fromDevice: 'r3', toDevice: 'rp', side: 'forward', activeLayer: 3,
    titleVi: 'R3 cắt nguồn này khỏi cây dùng chung', packet: pr,
    overlay: { links: { l3: { label: 'Prune (S,G,rpt)' } } },
    explanationVi: 'Bit R bật trong Prune List. Các nguồn khác của nhóm vẫn đi qua RP như cũ.', lesson: LESSON });

  const d4 = data(R1.mac, 63);
  sim.capture(d4, 'Luồng đi trên cây ngắn nhất');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'r3', side: 'forward', activeLayer: 3,
    titleVi: 'Luồng đi trên cây ngắn nhất, RP không còn nằm trên đường', packet: d4,
    overlay: { links: { l4: { cls: 'forwarding', label: 'SPT' } } },
    explanationVi: 'TTL giảm một chặng ít hơn so với đường qua RP. RP vẫn cần cho việc nối nguồn mới với máy nhận mới.', lesson: LESSON });

  const v3 = sim.frame([eth('01:00:5e:00:00:16', RCV.mac), ip(RCV.ip, '224.0.0.22', 1, 2), { proto: 'igmp', fields: { type: 0x22, group: '232.1.1.1', recType: 1, sources: [SRC.ip] } }]);
  sim.capture(v3, 'IGMPv3 Report, SSM');
  sim.emit({ kind: 'transit', fromDevice: 'rcv', toDevice: 'r3', side: 'encap', activeLayer: 3,
    titleVi: 'SSM: IGMPv3 nêu rõ nguồn, không cần RP', packet: v3,
    overlay: { links: { l5: { cls: 'forwarding', label: 'IGMPv3 (S,G)' } } },
    explanationVi: 'Dải 232.0.0.0/8 dành cho SSM. Máy nhận đã biết nguồn nên R3 gửi Join (S,G) ngay. Hai biến thể khác cần nhớ: BIDIR-PIM chỉ có cây (*,G) hai chiều, phù hợp khi nhiều nguồn; MSDP nối các RP ở các miền khác nhau để chia sẻ thông tin nguồn.', lesson: LESSON });

  return sim.result();
}
