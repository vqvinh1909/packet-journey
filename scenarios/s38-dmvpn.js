// scenarios/s38-dmvpn.js
// Kịch bản 38 (ENARSI 2.3): DMVPN phase 3.
// Spoke đăng ký NHRP với hub, gói đầu đi qua hub, hub báo redirect, spoke hỏi và mở đường trực tiếp.

import { Sim } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

const S1 = { mac: '00:1a:2b:00:38:01', nbma: '20.0.0.1', tun: '172.16.0.1' };
const S2 = { mac: '00:1a:2b:00:38:02', nbma: '30.0.0.2', tun: '172.16.0.2' };
const HUB = { mac: '00:1a:2b:00:38:0a', nbma: '40.0.0.254', tun: '172.16.0.254' };
const NET = { mac: '00:1a:2b:00:38:0b' };
const KEY = 100;

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-03_Routing/Bai-11_Gioi-thieu-ve-Dinh-tuyen.md',
  label: 'Bài 11 — Định tuyến (DMVPN: ENARSI 2.3)',
};

export const meta = {
  id: 's38-dmvpn',
  titleVi: 'DMVPN phase 3: mGRE và NHRP',
  titleEn: 'DMVPN phase 3: mGRE and NHRP',
  descriptionVi: 'Spoke đăng ký địa chỉ thật với hub bằng NHRP. Gói đầu đi qua hub, hub báo redirect, hai spoke hỏi nhau rồi nói chuyện trực tiếp.',
  difficulty: 5,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 300',
    devices: [
      { id: 's1', type: 'router', name: 'Spoke1', x: 170, y: 220, lines: ['NBMA 20.0.0.1', 'Tu 172.16.0.1', 'LAN 192.168.1.0/24'] },
      { id: 'net', type: 'router', name: 'Internet', x: 500, y: 220, lines: ['chỉ thấy NBMA'] },
      { id: 's2', type: 'router', name: 'Spoke2', x: 830, y: 220, lines: ['NBMA 30.0.0.2', 'Tu 172.16.0.2', 'LAN 192.168.2.0/24'] },
      { id: 'hub', type: 'router', name: 'Hub (NHS)', x: 500, y: 60, lines: ['NBMA 40.0.0.254', 'Tu 172.16.0.254'] },
    ],
    links: [
      { id: 'l1', a: 's1', b: 'net' },
      { id: 'l2', a: 'net', b: 's2' },
      { id: 'l3', a: 'net', b: 'hub' },
    ],
  };
  const sim = new Sim(topology);

  const ctrl = (to, from, srcIp, dstIp, fields) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: srcIp, dst: dstIp, ttl: 255, id: 0x3800, protocol: 47 } },
    { proto: 'gre', fields: { ptype: 0x2001, key: KEY } },
    { proto: 'nhrp', fields },
  ]);
  const data = (to, from, srcIp, dstIp) => sim.frame([
    { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: srcIp, dst: dstIp, ttl: 255, id: 0x3801, protocol: 47 } },
    { proto: 'gre', fields: { ptype: 0x0800, key: KEY } },
    ...echoFrame({ ethDst: '00:00:00:00:00:00', ethSrc: '00:00:00:00:00:00', srcIp: '192.168.1.10', dstIp: '192.168.2.20', ttl: 63, ipId: 0x3802, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }).slice(1),
  ]);
  const cache = (who, rows) => ({ list: { title: `Bảng NHRP ${who}`, cols: ['Tunnel', 'NBMA', 'Loại'], rows } });
  const REG = { op: 3, srcNbma: S1.nbma, srcProto: S1.tun, dstProto: HUB.tun, reqId: 1 };

  const r1 = ctrl(NET, S1, S1.nbma, HUB.nbma, REG);
  sim.capture(r1, 'NHRP Registration Request');
  sim.emit({ kind: 'transit', fromDevice: 's1', toDevice: 'net', side: 'forward', activeLayer: 3.5,
    titleVi: 'Spoke1 đăng ký với hub: tunnel 172.16.0.1 ở 20.0.0.1', packet: r1,
    overlay: { links: { l1: { cls: 'trunk', label: 'NHRP Register' } } },
    explanationVi: 'Xem cây trường: IP ngoài là địa chỉ Internet, gọi là NBMA. GRE có Protocol Type 0x2001 báo bên trong là NHRP. Spoke chỉ cần cấu hình sẵn địa chỉ hub (ip nhrp nhs), không cần biết các spoke khác.', lesson: LESSON });
  const r2 = ctrl(HUB, NET, S1.nbma, HUB.nbma, REG);
  sim.emit({ kind: 'transit', fromDevice: 'net', toDevice: 'hub', side: 'forward', activeLayer: 3.5,
    titleVi: 'Hub ghi lại ánh xạ, kể cả khi spoke đổi IP', packet: r2, tables: cache('Hub', [[S1.tun, S1.nbma, 'dynamic'], [S2.tun, S2.nbma, 'dynamic']]),
    overlay: { links: { l3: { cls: 'trunk', label: 'NHRP Register' } } },
    explanationVi: 'Spoke2 đăng ký theo cách tương tự. Tunnel key 100 trong GRE phải khớp hai đầu. Một lỗi hay gặp là sai network-id hoặc authentication trong NHRP nên không đăng ký được.', lesson: LESSON });

  const d1 = data(NET, S1, S1.nbma, HUB.nbma);
  sim.capture(d1, 'Gói đầu tiên: Spoke1 → Hub');
  sim.emit({ kind: 'transit', fromDevice: 's1', toDevice: 'net', side: 'encap', activeLayer: 3.5,
    titleVi: 'Gói đầu tiên đi theo route IGP: qua hub', packet: d1,
    overlay: { links: { l1: { cls: 'forwarding', label: 'GRE' }, l3: { cls: 'forwarding', label: 'GRE' } } },
    explanationVi: 'Route tới 192.168.2.0/24 học từ IGP trỏ về hub (phase 3 cho phép hub chỉ quảng bá route tóm tắt). Gói GRE có đích là 40.0.0.254.', lesson: LESSON });
  const d2 = data(S2, NET, HUB.nbma, S2.nbma);
  const ti = ctrl(NET, HUB, HUB.nbma, S1.nbma, { op: 8, srcNbma: HUB.nbma, srcProto: HUB.tun, dstProto: '192.168.2.20', reqId: 2 });
  sim.capture(d2, 'Hub chuyển tiếp tới Spoke2');
  sim.emit({ kind: 'transit', fromDevice: 'net', toDevice: 's2', side: 'forward', activeLayer: 3.5,
    titleVi: 'Hub chuyển gói sang Spoke2 (đi ra cùng tunnel)', packet: d2,
    overlay: { links: { l2: { cls: 'forwarding', label: 'GRE' } } },
    explanationVi: 'Hub nhận gói từ Tunnel0 rồi lại gửi ra Tunnel0. Đây chính là dấu hiệu để ip nhrp redirect hoạt động.', lesson: LESSON });
  sim.capture(ti, 'NHRP Traffic Indication');
  sim.emit({ kind: 'transit', fromDevice: 'hub', toDevice: 'net', side: 'forward', activeLayer: 3.5,
    titleVi: 'Hub báo Traffic Indication: có đường tốt hơn', packet: ti,
    overlay: { links: { l3: { cls: 'trunk', label: 'Traffic Indication' } } },
    explanationVi: 'Bản tin NHRP type 8 báo Spoke1 rằng lưu lượng tới 192.168.2.20 nên đi trực tiếp.', lesson: LESSON });

  const qq = ctrl(NET, S1, S1.nbma, HUB.nbma, { op: 1, srcNbma: S1.nbma, srcProto: S1.tun, dstProto: '192.168.2.20', reqId: 3 });
  sim.capture(qq, 'NHRP Resolution Request');
  sim.emit({ kind: 'transit', fromDevice: 's1', toDevice: 'net', side: 'forward', activeLayer: 3.5,
    titleVi: 'Spoke1 gửi Resolution Request qua hub', packet: qq,
    overlay: { links: { l1: { cls: 'trunk', label: 'Resolution' }, l3: { cls: 'trunk', label: 'Resolution' } } },
    explanationVi: 'Spoke1 hỏi: ai đứng sau 192.168.2.20? Hub chuyển câu hỏi cho Spoke2 vì Spoke2 có đăng ký.', lesson: LESSON });
  const ans = ctrl(NET, S2, S2.nbma, S1.nbma, { op: 2, srcNbma: S2.nbma, srcProto: S2.tun, dstProto: S1.tun, reqId: 3, cie: { nbma: S2.nbma, proto: '192.168.2.0', prefix: 24 } });
  sim.capture(ans, 'NHRP Resolution Reply');
  sim.emit({ kind: 'transit', fromDevice: 's2', toDevice: 'net', side: 'forward', activeLayer: 3.5,
    titleVi: 'Spoke2 trả lời thẳng cho Spoke1', packet: ans,
    overlay: { links: { l2: { cls: 'trunk', label: 'Resolution Reply' }, l1: { cls: 'trunk', label: 'Resolution Reply' } } },
    explanationVi: 'Reply mang CIE: mạng 192.168.2.0/24 nằm sau NBMA 30.0.0.2. Đường trả lời đã đi trực tiếp, không qua hub.', lesson: LESSON });

  const dd = data(NET, S1, S1.nbma, S2.nbma);
  sim.capture(dd, 'Spoke1 → Spoke2 trực tiếp');
  sim.emit({ kind: 'process', atDevice: 's1', side: 'encap', activeLayer: 3.5,
    titleVi: 'Spoke1 cài route rút gọn (NHRP shortcut)', packet: dd, tables: cache('Spoke1', [[HUB.tun, HUB.nbma, 'static'], ['192.168.2.0/24', S2.nbma, 'dynamic']]),
    explanationVi: 'Bảng định tuyến có thêm route code H. Hub không phải mang lưu lượng giữa hai spoke nữa. ip nhrp shortcut trên spoke là thứ tạo route này.', lesson: LESSON });
  const de = data(S2, NET, S1.nbma, S2.nbma);
  sim.emit({ kind: 'transit', fromDevice: 'net', toDevice: 's2', side: 'forward', activeLayer: 3.5,
    titleVi: '✓ Từ giờ hai spoke nói chuyện trực tiếp', packet: de,
    overlay: { links: { l1: { cls: 'forwarding', label: 'spoke to spoke' }, l2: { cls: 'forwarding', label: 'spoke to spoke' } } },
    explanationVi: 'Thực tế còn có tunnel protection ipsec profile để mã hoá bằng ESP. Phase 1 chỉ hub-and-spoke, phase 2 spoke to spoke nhưng hub không được tóm tắt route, phase 3 cho phép cả hai. Lab R09 cho bạn tự cấu hình DMVPN.', lesson: LESSON });

  return sim.result();
}
