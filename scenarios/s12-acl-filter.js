// scenarios/s12-acl-filter.js
// Kịch bản 12 (CCNA Services): ACL lọc gói.
// R1 có ACL inbound: permit host A, deny host B. Gói của A được chuyển tiếp;
// gói của B khớp dòng deny → bị DROP. Dạy: first-match và implicit deny any.

import { Sim, diffFields } from '../engine/simulate.js';
import { echoFrame, ICMP_TYPE } from './_common.js';

const A = { mac: '00:1a:2b:00:00:0a', ip: '192.168.1.10' };
const B = { mac: '00:1a:2b:00:00:0b', ip: '192.168.1.20' };
const R_IN = { mac: '00:1a:2b:00:00:a0', ip: '192.168.1.1' };
const R_OUT = { mac: '00:1a:2b:00:00:a1', ip: '10.0.0.1' };
const SRV = { mac: '00:1a:2b:00:00:ff', ip: '10.0.0.5' };

const ACL_TEXT =
  'ip access-list extended FILTER\n 10 permit ip host 192.168.1.10 any\n 20 deny   ip host 192.168.1.20 any\n (ẩn) deny ip any any  ← implicit deny';

const LESSON = {
  path: '../Quản trị Hạ tầng mạng (Infrastructure Administrator)/Module-04_Dich-vu-va-Bao-mat-co-ban/Bai-16_Basic-ACL.md',
  label: 'Bài 16 — Basic ACL',
};

export const meta = {
  id: 's12-acl-filter',
  titleVi: 'ACL chặn gói (first-match)',
  titleEn: 'ACL packet filtering',
  descriptionVi: 'R1 có ACL: permit host A, deny host B. Gói của A đi tiếp, gói của B bị drop. Xem first-match và implicit deny.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 320',
    devices: [
      { id: 'a', type: 'host', name: 'PC-A', x: 130, y: 80, color: '#2e7d5b', lines: ['192.168.1.10', 'được phép'] },
      { id: 'b', type: 'host', name: 'PC-B', x: 130, y: 240, color: '#a0433a', lines: ['192.168.1.20', 'bị chặn'] },
      { id: 'r1', type: 'router', name: 'R1', x: 480, y: 160, lines: ['ACL "FILTER"', 'inbound Gi0/0'] },
      { id: 'srv', type: 'host', name: 'Server', x: 850, y: 160, lines: ['10.0.0.5'] },
    ],
    links: [
      { id: 'la', a: 'a', b: 'r1' },
      { id: 'lb', a: 'b', b: 'r1' },
      { id: 'ls', a: 'r1', b: 'srv' },
    ],
  };

  const sim = new Sim(topology);
  const echo = (ethDst, ethSrc, srcIp, dstIp, ttl) => sim.frame(echoFrame({
    ethDst, ethSrc, srcIp, dstIp, ttl, ipId: 0x3c01, identifier: 0x000c, seq: 1, type: ICMP_TYPE.ECHO_REQUEST,
  }));

  // 0. Giới thiệu ACL
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'R1 có ACL inbound trên Gi0/0',
    explanationVi: 'ACL đặt INBOUND trên cổng hướng về 2 PC. Router duyệt từ trên xuống, DỪNG ở dòng khớp ĐẦU TIÊN (first-match). ' +
      'Cuối ACL luôn có một dòng "deny ip any any" ẨN (implicit deny): không khớp gì = bị chặn.\n\n' + ACL_TEXT,
    lesson: LESSON });

  // PC-A: được phép
  const a1 = echo(R_IN.mac, A.mac, A.ip, SRV.ip, 64);
  sim.capture(a1, 'ICMP từ PC-A (sẽ được permit)');
  sim.emit({ kind: 'transit', fromDevice: 'a', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'PC-A gửi ping tới Server', packet: a1,
    explanationVi: 'Gói nguồn 192.168.1.10 đi vào Gi0/0 → bị ACL kiểm tra trước khi định tuyến.', lesson: LESSON });

  const a2 = echo(SRV.mac, R_OUT.mac, A.ip, SRV.ip, 63);
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'forward', activeLayer: 3,
    titleVi: 'ACL dòng 10: permit host A → CHO QUA', packet: a2,
    changedFields: diffFields(a1.tree, a2.tree),
    overlay: { links: { la: { cls: 'forwarding', label: 'PERMIT ✓' }, ls: { cls: 'forwarding' } } },
    explanationVi: 'Dòng 10 "permit ip host 192.168.1.10 any" KHỚP ngay → hành động permit, dừng duyệt. Router định tuyến bình thường: TTL−1, viết lại MAC, ra Gi0/1.',
    lesson: LESSON });
  sim.capture(a2, 'ICMP PC-A được chuyển tiếp');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'srv', side: 'forward', activeLayer: 3,
    titleVi: 'Gói PC-A tới Server', packet: a2,
    overlay: { links: { la: { cls: 'forwarding', label: 'PERMIT ✓' }, ls: { cls: 'forwarding' } } },
    explanationVi: 'PC-A ping thành công.' });

  // PC-B: bị chặn
  const b1 = echo(R_IN.mac, B.mac, B.ip, SRV.ip, 64);
  sim.capture(b1, 'ICMP từ PC-B (sẽ bị deny)');
  sim.emit({ kind: 'transit', fromDevice: 'b', toDevice: 'r1', side: 'encap', activeLayer: 3,
    titleVi: 'PC-B gửi ping tới Server', packet: b1,
    explanationVi: 'Gói nguồn 192.168.1.20 vào Gi0/0 → ACL kiểm tra.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'ACL: dòng 10 không khớp → dòng 20 deny → DROP', packet: b1,
    overlay: { links: { lb: { cls: 'blocking', label: 'DENY ✗ (drop)' } } },
    explanationVi: 'Dòng 10 (host A) KHÔNG khớp (nguồn là .20). Dòng 20 "deny ip host 192.168.1.20 any" KHỚP → DROP, không định tuyến nữa. ' +
      'Router có thể gửi ICMP "Destination Unreachable — Administratively Prohibited" (Type 3, Code 13) về PC-B. ' +
      'Nếu không có dòng 20 thì gói vẫn bị chặn bởi implicit deny ở cuối.',
    lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 3,
    titleVi: 'Ghi nhớ: chiều & vị trí đặt ACL',
    overlay: { links: { la: { cls: 'forwarding', label: 'PERMIT ✓' }, lb: { cls: 'blocking', label: 'DENY ✗' } } },
    explanationVi: 'Standard ACL (chỉ lọc theo IP nguồn) đặt GẦN ĐÍCH; Extended ACL (nguồn+đích+port) đặt GẦN NGUỒN để chặn sớm. ' +
      'Đặt sai chiều in/out là lỗi hay gặp — gói không bị lọc như mong đợi.',
    lesson: LESSON });

  return sim.result();
}
