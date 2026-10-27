// scenarios/graphsim.js — mô phỏng ping trên topology do người dùng VẼ (canvas, M5).
// Tìm đường (BFS) giữa 2 host rồi đi dọc đường: host quyết định cùng/khác mạng, switch
// chuyển tiếp trong suốt, router giảm TTL + viết lại MAC. Trả về {topology, events, pcap}
// hoặc { error } nếu cấu hình sai (để UI báo).
//
// Mô hình thiết bị (từ canvas):
//   host:   { id, type:'host',   name, x, y, ip, prefix, gateway }
//   switch: { id, type:'switch', name, x, y }
//   router: { id, type:'router', name, x, y, rifaces: { <neighborId>: { ip, prefix } } }
//   link:   { id, a, b }

import { Sim, diffFields } from '../engine/simulate.js';
import { sameSubnet } from '../packet/addr.js';
import { arpFrame, echoFrame, ARP_OP, ICMP_TYPE, BROADCAST_MAC } from './_common.js';

function mac(dev, i) { return '02:00:00:00:' + String(i).padStart(2, '0') + ':' + String(i).padStart(2, '0'); }

function neighbors(links, id) {
  const out = [];
  for (const l of links) { if (l.a === id) out.push(l.b); else if (l.b === id) out.push(l.a); }
  return out;
}

function bfsPath(devices, links, srcId, dstId) {
  const prev = new Map([[srcId, null]]);
  const q = [srcId];
  while (q.length) {
    const cur = q.shift();
    if (cur === dstId) break;
    for (const n of neighbors(links, cur)) if (!prev.has(n)) { prev.set(n, cur); q.push(n); }
  }
  if (!prev.has(dstId)) return null;
  const path = [];
  for (let c = dstId; c != null; c = prev.get(c)) path.unshift(c);
  return path;
}

export function simulateGraph(devices, links, srcId, dstId) {
  const byId = new Map(devices.map((d, i) => [d.id, { ...d, _i: i }]));
  const src = byId.get(srcId);
  const dst = byId.get(dstId);
  if (!src || !dst) return { error: 'Thiếu nguồn hoặc đích.' };
  if (src.type !== 'host' || dst.type !== 'host') return { error: 'Nguồn và đích phải là PC (host).' };
  if (!src.ip || !dst.ip) return { error: 'PC chưa được cấu hình IP (bấm vào PC để nhập).' };

  const path = bfsPath(devices, links, srcId, dstId);
  if (!path) return { error: 'Không có đường nối giữa 2 PC — hãy nối dây.' };
  // host chỉ được ở 2 đầu
  for (let k = 1; k < path.length - 1; k++) {
    if (byId.get(path[k]).type === 'host') return { error: 'Đường đi qua một PC khác — PC không chuyển tiếp gói.' };
  }

  const routersOnPath = path.filter((id) => byId.get(id).type === 'router');
  const macOf = (d) => mac(d, byId.get(d).type ? byId.get(d)._i : 0);

  // topology cho UI (giữ nguyên toạ độ người dùng vẽ)
  const topology = {
    viewBox: '0 0 1000 400',
    devices: devices.map((d) => ({
      id: d.id, type: d.type, name: d.name, x: d.x, y: d.y,
      color: d.type === 'host' ? '#2c5f8a' : undefined,
      lines: d.type === 'host' ? [`${d.ip}/${d.prefix}`, d.gateway ? `GW ${d.gateway}` : 'cùng mạng'] : (d.type === 'router' ? ['router'] : ['switch']),
    })),
    links: links.map((l) => ({ id: l.id, a: l.a, b: l.b })),
  };
  const sim = new Sim(topology);
  const transit = (from, to, p, extra = {}) => sim.emit({ kind: 'transit', fromDevice: from, toDevice: to, packet: p, activeLayer: extra.l || 3, side: extra.side || 'encap', titleVi: extra.title, explanationVi: extra.ex, changedFields: extra.changed, overlay: extra.overlay });

  const same = sameSubnet(src.ip, dst.ip, src.prefix);

  // ---- Cùng đoạn L2 nhưng phải CÙNG subnet ----
  if (routersOnPath.length === 0) {
    if (!same) return { error: `PC2 (${dst.ip}) không cùng subnet với PC1 (${src.ip}/${src.prefix}) mà đường đi không có router → không ping được. Thêm router hoặc để cùng subnet.` };
    sim.emit({ kind: 'process', atDevice: srcId, side: 'inspect', activeLayer: 3, titleVi: 'PC1: đích CÙNG mạng',
      explanationVi: `${src.ip}/${src.prefix} và ${dst.ip} cùng subnet → gửi trực tiếp, cần MAC PC2 → ARP.` });
    const aq = sim.frame(arpFrame({ op: ARP_OP.REQUEST, senderMac: macOf(srcId), senderIp: src.ip, targetMac: '00:00:00:00:00:00', targetIp: dst.ip, ethDst: BROADCAST_MAC }));
    sim.capture(aq, 'ARP Request');
    walkTransit(path, aq, { title: 'ARP broadcast tìm MAC PC2', ex: 'Switch chuyển tiếp trong suốt tới PC2.', side: 'encap', l: 2 });
    const ar = sim.frame(arpFrame({ op: ARP_OP.REPLY, senderMac: macOf(dstId), senderIp: dst.ip, targetMac: macOf(srcId), targetIp: src.ip, ethDst: macOf(srcId) }));
    sim.capture(ar, 'ARP Reply');
    walkTransit([...path].reverse(), ar, { title: 'PC2 trả MAC (unicast)', ex: 'PC1 có MAC PC2.', side: 'decap', l: 2 });
    const ec = sim.frame(echoFrame({ ethDst: macOf(dstId), ethSrc: macOf(srcId), srcIp: src.ip, dstIp: dst.ip, ttl: 64, ipId: 0x2468, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
    sim.capture(ec, 'ICMP Echo Request');
    walkTransit(path, ec, { title: '✓ Ping OK (cùng mạng)', ex: 'ICMP đi thẳng qua switch tới PC2.', side: 'encap', l: 3, overlayLast: true });
    return sim.result();
  }

  // ---- Khác subnet: phải qua router, kiểm gateway ----
  if (!same) {
    if (!src.gateway) return { error: `PC1 khác mạng với đích nhưng CHƯA đặt default gateway.` };
    if (!sameSubnet(src.ip, src.gateway, src.prefix)) return { error: `Gateway ${src.gateway} không cùng mạng với PC1 ${src.ip}/${src.prefix}.` };
    // router đầu tiên trên đường = gateway router; neighbor của nó về phía PC1
    const firstRouter = routersOnPath[0];
    const idxR = path.indexOf(firstRouter);
    const towardSrc = path[idxR - 1]; // thiết bị liền trước router (switch hoặc PC1)
    const rif = (byId.get(firstRouter).rifaces || {})[towardSrc];
    if (!rif || rif.ip !== src.gateway) {
      return { error: `Cổng router nối phía PC1 có IP ${rif ? rif.ip : '(chưa đặt)'} ≠ gateway PC1 (${src.gateway}) → ARP gateway không ai trả lời, ping hỏng. Đặt IP cổng router = ${src.gateway}.` };
    }
    sim.emit({ kind: 'process', atDevice: srcId, side: 'inspect', activeLayer: 3, titleVi: 'PC1: đích KHÁC mạng → qua gateway',
      explanationVi: `Gửi cho gateway ${src.gateway} (cổng router). ARP tìm MAC gateway.` });
    // ARP gateway
    const aq = sim.frame(arpFrame({ op: ARP_OP.REQUEST, senderMac: macOf(srcId), senderIp: src.ip, targetMac: '00:00:00:00:00:00', targetIp: src.gateway, ethDst: BROADCAST_MAC }));
    sim.capture(aq, 'ARP hỏi gateway');
    walkTransit(path.slice(0, idxR + 1), aq, { title: `ARP hỏi MAC gateway ${src.gateway}`, ex: 'Chỉ trong đoạn L2 của PC1.', side: 'encap', l: 2 });
    const ar = sim.frame(arpFrame({ op: ARP_OP.REPLY, senderMac: macOf(firstRouter), senderIp: src.gateway, targetMac: macOf(srcId), targetIp: src.ip, ethDst: macOf(srcId) }));
    sim.capture(ar, 'ARP Reply từ gateway');
    walkTransit(path.slice(0, idxR + 1).reverse(), ar, { title: 'Gateway trả MAC', ex: 'PC1 đóng khung được.', side: 'decap', l: 2 });

    // ICMP đi dọc đường, TTL giảm mỗi router
    let ttl = 64;
    let prevMac = macOf(srcId);
    let nextHopMac = macOf(firstRouter);
    let prevFrame = sim.frame(echoFrame({ ethDst: nextHopMac, ethSrc: prevMac, srcIp: src.ip, dstIp: dst.ip, ttl, ipId: 0x2468, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
    sim.capture(prevFrame, `ICMP tới ${byId.get(firstRouter).name} (TTL ${ttl})`);
    // đi từ PC1 tới router đầu
    hop(path.slice(0, idxR + 1), prevFrame, { title: `ICMP: IP đích=PC2, MAC đích=gateway`, ex: 'IP đích đi xa, MAC đích chỉ 1 chặng.', side: 'encap' });

    // qua từng router còn lại trên đường
    for (let ri = 0; ri < routersOnPath.length; ri++) {
      const r = routersOnPath[ri];
      const ridx = path.indexOf(r);
      const nextDev = path[ridx + 1]; // thiết bị kế sau router
      const isLastRouter = ri === routersOnPath.length - 1;
      ttl -= 1;
      const outSrcMac = macOf(r);
      const outDstMac = isLastRouter ? macOf(dstId) : macOf(routersOnPath[ri + 1]);
      const fwd = sim.frame(echoFrame({ ethDst: outDstMac, ethSrc: outSrcMac, srcIp: src.ip, dstIp: dst.ip, ttl, ipId: 0x2468, identifier: 1, seq: 1, type: ICMP_TYPE.ECHO_REQUEST }));
      sim.emit({ kind: 'process', atDevice: r, side: 'forward', activeLayer: 3, packet: fwd, changedFields: diffFields(prevFrame.tree, fwd.tree),
        titleVi: `${byId.get(r).name} định tuyến: TTL−1, viết lại MAC`,
        explanationVi: `TTL ${ttl + 1}→${ttl}, tính lại checksum; MAC nguồn=${byId.get(r).name}, MAC đích=${isLastRouter ? 'PC2' : byId.get(routersOnPath[ri + 1]).name}; IP giữ nguyên.` });
      sim.capture(fwd, `ICMP sau ${byId.get(r).name} (TTL ${ttl})`);
      // đi từ router tới thiết bị kế (đến router kế hoặc PC2)
      const segEnd = isLastRouter ? dstId : routersOnPath[ri + 1];
      const segStart = r;
      hop(subPath(path, segStart, segEnd), fwd, { title: `Chuyển tiếp qua ${isLastRouter ? 'tới PC2' : 'router kế'}`, ex: 'Frame mới trên đoạn kế.', side: 'encap', overlayLast: isLastRouter });
      prevFrame = fwd;
    }
    return sim.result();
  }

  // same subnet NHƯNG đường lại có router (cấu hình lạ)
  return { error: 'PC1 và PC2 cùng subnet nhưng đường đi lại qua router — kiểm tra lại IP/mask hoặc cách nối dây.' };

  // ----- helper nội bộ -----
  function subPath(full, fromId, toId) {
    const i = full.indexOf(fromId), j = full.indexOf(toId);
    return full.slice(Math.min(i, j), Math.max(i, j) + 1);
  }
  function walkTransit(seg, frame, o) {
    for (let k = 0; k < seg.length - 1; k++) {
      const last = k === seg.length - 2;
      transit(seg[k], seg[k + 1], frame, { title: o.title, ex: o.ex, side: o.side, l: o.l, overlay: (o.overlayLast && last) ? { links: {} } : undefined });
    }
  }
  function hop(seg, frame, o) {
    for (let k = 0; k < seg.length - 1; k++) {
      transit(seg[k], seg[k + 1], frame, { title: o.title, ex: o.ex, side: o.side, l: 3 });
    }
  }
}
