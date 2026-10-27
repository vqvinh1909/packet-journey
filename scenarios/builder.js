// scenarios/builder.js — Trình TỰ TẠO kịch bản (M5).
// Nhận tham số IP/mask/gateway của PC1, PC2 (+ router) rồi dựng mô phỏng ping PC1→PC2
// theo ĐÚNG logic: cùng mạng (ARP trực tiếp), khác mạng qua gateway đúng (định tuyến),
// hoặc sai/không có gateway (ARP gateway không ai trả lời → thất bại).

import { Sim, diffFields } from '../engine/simulate.js';
import { sameSubnet } from '../packet/addr.js';
import { arpFrame, echoFrame, ARP_OP, ICMP_TYPE, BROADCAST_MAC } from './_common.js';

const PC1 = { mac: '00:1a:2b:c0:00:01' };
const PC2 = { mac: '00:1a:2b:c0:00:02' };
const R_IN = { mac: '00:1a:2b:c0:00:a1' };
const R_OUT = { mac: '00:1a:2b:c0:00:a2' };

export const meta = { id: 'custom', titleVi: 'Tự tạo (Builder)' };

/** p: { pc1Ip, pc1Prefix, pc1Gw, pc2Ip, pc2Prefix, routerIp } */
export function buildCustom(p) {
  return sameSubnet(p.pc1Ip, p.pc2Ip, p.pc1Prefix) ? sameSubnetSim(p) : crossSubnetSim(p);
}

// ---------- Cùng mạng: PC1 — SW — PC2 ----------
function sameSubnetSim(p) {
  const topo = {
    viewBox: '0 0 1000 260',
    devices: [
      { id: 'pc1', type: 'host', name: 'PC1', x: 160, y: 130, color: '#2c5f8a', lines: [`${p.pc1Ip}/${p.pc1Prefix}`] },
      { id: 'sw', type: 'switch', name: 'SW1', x: 500, y: 130, lines: ['cùng VLAN'] },
      { id: 'pc2', type: 'host', name: 'PC2', x: 840, y: 130, color: '#2c5f8a', lines: [`${p.pc2Ip}/${p.pc2Prefix}`] },
    ],
    links: [{ id: 'l1', a: 'pc1', b: 'sw' }, { id: 'l2', a: 'sw', b: 'pc2' }],
  };
  const sim = new Sim(topo);
  sim.emit({ kind: 'process', atDevice: 'pc1', side: 'inspect', activeLayer: 3,
    titleVi: 'PC1 xét đích: CÙNG mạng',
    explanationVi: `${p.pc1Ip}/${p.pc1Prefix} và ${p.pc2Ip} cùng mạng → gửi trực tiếp, chỉ cần MAC của PC2 → phát ARP.` });

  const req = sim.frame(arpFrame({ op: ARP_OP.REQUEST, senderMac: PC1.mac, senderIp: p.pc1Ip, targetMac: '00:00:00:00:00:00', targetIp: p.pc2Ip, ethDst: BROADCAST_MAC }));
  sim.capture(req, 'ARP Request');
  sim.emit({ kind: 'transit', fromDevice: 'pc1', toDevice: 'pc2', side: 'encap', activeLayer: 2, titleVi: 'ARP broadcast tìm MAC PC2', packet: req,
    explanationVi: 'Switch flood trong VLAN; PC2 nhận và sẽ trả lời.' });
  const rep = sim.frame(arpFrame({ op: ARP_OP.REPLY, senderMac: PC2.mac, senderIp: p.pc2Ip, targetMac: PC1.mac, targetIp: p.pc1Ip, ethDst: PC1.mac }));
  sim.capture(rep, 'ARP Reply');
  sim.emit({ kind: 'transit', fromDevice: 'pc2', toDevice: 'pc1', side: 'decap', activeLayer: 2, titleVi: 'PC2 trả MAC (unicast)', packet: rep,
    explanationVi: 'PC1 có MAC PC2 → gửi ICMP được.' });
  const echo = sim.frame(echoFrame({ ethDst: PC2.mac, ethSrc: PC1.mac, srcIp: p.pc1Ip, dstIp: p.pc2Ip, ttl: 64, ipId: 0x1234, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
  sim.capture(echo, 'ICMP Echo Request');
  sim.emit({ kind: 'transit', fromDevice: 'pc1', toDevice: 'pc2', side: 'encap', activeLayer: 3, titleVi: '✓ Ping thành công (cùng mạng)', packet: echo,
    overlay: { links: { l1: { cls: 'forwarding' }, l2: { cls: 'forwarding', label: 'OK ✓' } } },
    explanationVi: 'ICMP đi thẳng trong VLAN. Kết quả: PING OK.' });
  return sim.result();
}

// ---------- Khác mạng: PC1 — R1 — PC2 ----------
function crossSubnetSim(p) {
  const gwOk = !!p.pc1Gw && sameSubnet(p.pc1Ip, p.pc1Gw, p.pc1Prefix) && p.pc1Gw === p.routerIp;
  const topo = {
    viewBox: '0 0 1000 260',
    devices: [
      { id: 'pc1', type: 'host', name: 'PC1', x: 150, y: 130, color: gwOk ? '#2c5f8a' : '#a0433a', lines: [`${p.pc1Ip}/${p.pc1Prefix}`, `GW ${p.pc1Gw || '(trống)'}`] },
      { id: 'r1', type: 'router', name: 'R1', x: 500, y: 130, lines: [`${p.routerIp || '?'}`] },
      { id: 'pc2', type: 'host', name: 'PC2', x: 850, y: 130, color: '#2c5f8a', lines: [`${p.pc2Ip}/${p.pc2Prefix}`] },
    ],
    links: [{ id: 'l1', a: 'pc1', b: 'r1' }, { id: 'l2', a: 'r1', b: 'pc2' }],
  };
  const sim = new Sim(topo);

  sim.emit({ kind: 'process', atDevice: 'pc1', side: 'inspect', activeLayer: 3,
    titleVi: 'PC1 xét đích: KHÁC mạng → cần gateway',
    explanationVi: `${p.pc1Ip}/${p.pc1Prefix} khác mạng với ${p.pc2Ip} → gửi cho default gateway ${p.pc1Gw || '(chưa đặt)'}. Cần MAC của gateway → ARP.` });

  const req = sim.frame(arpFrame({ op: ARP_OP.REQUEST, senderMac: PC1.mac, senderIp: p.pc1Ip, targetMac: '00:00:00:00:00:00', targetIp: p.pc1Gw || '0.0.0.0', ethDst: BROADCAST_MAC }));
  sim.capture(req, 'ARP hỏi gateway');
  sim.emit({ kind: 'transit', fromDevice: 'pc1', toDevice: 'r1', side: 'encap', activeLayer: 2, titleVi: `ARP hỏi MAC gateway ${p.pc1Gw || '(trống)'}`, packet: req,
    explanationVi: 'PC1 cần MAC của gateway để đóng khung tầng 2.' });

  if (!gwOk) {
    const why = !p.pc1Gw ? 'chưa đặt gateway' : (!sameSubnet(p.pc1Ip, p.pc1Gw, p.pc1Prefix) ? 'gateway KHÔNG cùng mạng với PC1' : 'gateway khác IP của router');
    sim.emit({ kind: 'process', atDevice: 'r1', side: 'inspect', activeLayer: 2,
      titleVi: '✗ Không ai trả lời ARP → ping HỎNG',
      overlay: { links: { l1: { cls: 'blocking', label: '✗ không hồi đáp' }, l2: { cls: 'blocking' } } },
      explanationVi: `Lỗi: ${why}. Router mang IP ${p.routerIp || '?'}, không khớp gateway PC1 đặt → không có ARP Reply → PC1 không đóng được khung → "Request timed out". ` +
        `Khắc phục: đặt gateway = IP của router (${p.routerIp || 'IP cổng R1 cùng mạng PC1'}) và nằm trong ${p.pc1Ip}/${p.pc1Prefix}.` });
    return sim.result();
  }

  const rep = sim.frame(arpFrame({ op: ARP_OP.REPLY, senderMac: R_IN.mac, senderIp: p.pc1Gw, targetMac: PC1.mac, targetIp: p.pc1Ip, ethDst: PC1.mac }));
  sim.capture(rep, 'ARP Reply từ gateway');
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'pc1', side: 'decap', activeLayer: 2, titleVi: 'Gateway trả MAC — hợp lệ', packet: rep,
    explanationVi: 'Gateway đặt đúng → có MAC để gửi.' });

  const reqAtR1 = sim.frame(echoFrame({ ethDst: R_IN.mac, ethSrc: PC1.mac, srcIp: p.pc1Ip, dstIp: p.pc2Ip, ttl: 64, ipId: 0x1234, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
  sim.capture(reqAtR1, 'ICMP tới R1 (TTL 64)');
  sim.emit({ kind: 'transit', fromDevice: 'pc1', toDevice: 'r1', side: 'encap', activeLayer: 3, titleVi: 'ICMP: IP đích = PC2, MAC đích = gateway', packet: reqAtR1,
    explanationVi: 'IP đích là PC2 (đi xa), MAC đích là gateway (chỉ 1 chặng).' });
  const reqAtPc2 = sim.frame(echoFrame({ ethDst: PC2.mac, ethSrc: R_OUT.mac, srcIp: p.pc1Ip, dstIp: p.pc2Ip, ttl: 63, ipId: 0x1234, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
  sim.capture(reqAtPc2, 'ICMP tới PC2 (TTL 63)');
  sim.emit({ kind: 'process', atDevice: 'r1', side: 'forward', activeLayer: 3, titleVi: 'R1 định tuyến → PC2, TTL−1, viết lại MAC', packet: reqAtPc2,
    changedFields: diffFields(reqAtR1.tree, reqAtPc2.tree),
    overlay: { links: { l1: { cls: 'forwarding' }, l2: { cls: 'forwarding', label: 'OK ✓' } } },
    explanationVi: 'R1 chuyển sang mạng của PC2: TTL 64→63, tính lại checksum, MAC nguồn=R1, MAC đích=PC2; IP giữ nguyên.' });
  sim.emit({ kind: 'transit', fromDevice: 'r1', toDevice: 'pc2', side: 'encap', activeLayer: 3, titleVi: '✓ Tới PC2 — ping thành công', packet: reqAtPc2,
    overlay: { links: { l2: { cls: 'forwarding', label: 'OK ✓' } } },
    explanationVi: 'PC2 nhận ICMP (TTL 63) và sẽ trả Echo Reply theo chiều ngược. Kết quả: PING OK.' });
  return sim.result();
}
