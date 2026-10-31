// lab/sniff.js — nhật ký gói gần đây cho lệnh chẩn đoán trên thiết bị: tcpdump (Linux), diagnose sniffer packet và
// diagnose debug flow (FortiGate). Console của lab không chạy lệnh dạng "chờ tới Ctrl+C" được nên các lệnh này
// in lại những gói ĐÃ đi qua thiết bị. Không lưu vào net để không lọt vào file xuất hay lịch sử hoàn tác.

const LOG = new WeakMap();
const MAX = 300;
const box = (net) => { if (!LOG.has(net)) LOG.set(net, { pkts: [], flows: [] }); return LOG.get(net); };
const add = (list, x) => { list.push(x); if (list.length > MAX) list.shift(); };
const F = (p, proto) => p.layers.find((l) => l.proto === proto)?.fields;

/** Ghi các frame đi trên dây của một lần mô phỏng. Trả các gói vừa ghi. */
export function sniffRecord(net, events) {
  const out = [];
  for (const ev of events) {
    if (ev.kind !== 'transit' || !ev.packet?.bytes || ev.capSkip) continue;
    const p = { t: Date.now(), from: ev.fromDevice, to: ev.toDevice, link: ev.link, layers: ev.packet.layers, len: ev.packet.bytes.length };
    add(box(net).pkts, p);
    out.push(p);
  }
  return out;
}
/** Ghi kết quả firewall xét 1 gói (cho diagnose debug flow). */
export function flowRecord(net, dev, pkt, inIf, outIf, v) {
  add(box(net).flows, { dev, proto: pkt.proto, src: pkt.src, dst: pkt.dst, sport: pkt.sport, dport: pkt.dport, inIf, outIf, allow: v.allow, established: !!v.established, rule: v.rule?.id ?? 0 });
}
export const flowsOf = (net, dev, addr) => box(net).flows.filter((f) => f.dev === dev && (!addr || f.src === addr || f.dst === addr));

/** Biểu thức lọc kiểu tcpdump: icmp, arp, tcp, udp, host/src/dst <IP>, port <n>, ghép bằng and, or, not. Sai cú pháp trả null. */
export function compileBpf(words) {
  const groups = [[]];
  for (let i = 0; i < words.length; i++) {
    let w = words[i].toLowerCase();
    if (w === 'and' || w === '&&') continue;
    if (w === 'or' || w === '||') { groups.push([]); continue; }
    const neg = w === 'not' || w === '!';
    if (neg) w = String(words[++i]).toLowerCase();
    const dir = w === 'src' || w === 'dst' ? w : null;
    if (dir) w = String(words[++i]).toLowerCase();
    let t;
    if (w === 'port') {
      const n = +words[++i];
      if (!(n >= 1 && n <= 65535)) return null;
      t = (p) => { const x = F(p, 'tcp') || F(p, 'udp'); return !!x && (dir === 'src' ? x.srcPort === n : dir === 'dst' ? x.dstPort === n : x.srcPort === n || x.dstPort === n); };
    } else if (w === 'host' || (dir && /^\d+\.\d+\.\d+\.\d+$/.test(w))) {
      const ip = w === 'host' ? words[++i] : w;
      if (!ip) return null;
      t = (p) => { const [s, d] = ends(p); return dir === 'src' ? s === ip : dir === 'dst' ? d === ip : s === ip || d === ip; };
    } else if (['icmp', 'arp', 'tcp', 'udp', 'ip'].includes(w) && !dir) {
      t = (p) => !!F(p, w === 'ip' ? 'ipv4' : w);
    } else return null;
    groups.at(-1).push(neg ? (p) => !t(p) : t);
  }
  if (groups.some((g) => !g.length) && words.length) return null;
  return (p) => groups.some((g) => g.every((t) => t(p)));
}
const ends = (p) => { const ip = F(p, 'ipv4'), a = F(p, 'arp'); return ip ? [ip.src, ip.dst] : a ? [a.senderIp, a.targetIp] : []; };

/** Các gói gần đây qua thiết bị dev, ifn = cổng cụ thể hoặc null (mọi cổng). */
export function sniffQuery(net, dev, ifn, fn, count) {
  const atPort = (p) => {
    if (!ifn) return true;
    const l = net.links.find((x) => x.id === p.link);
    return !!l && (l.a === dev ? l.ap : l.bp) === ifn;
  };
  const span = spanSources(net, dev);
  return box(net).pkts.filter((p) => (((p.from === dev || p.to === dev) && atPort(p)) || span.some((s) => s(p))) && fn(p)).slice(-count);
}

/** SPAN, RSPAN, ERSPAN: các bộ lọc gói đang được sao chép tới máy phân tích `dev` qua cổng đích monitor session. */
function spanSources(net, dev) {
  const out = [], all = Object.values(net.devices);
  const portsOf = (sw, s) => [...(s.srcPorts || []), ...(s.srcVlans || []).flatMap((v) => Object.keys(sw.ports || {}).filter((n) => sw.ports[n].vlan === v))];
  const mirror = (sw, s) => {
    for (const port of portsOf(sw, s)) {
      const l = net.links.find((x) => (x.a === sw.id && x.ap === port) || (x.b === sw.id && x.bp === port));
      if (l) out.push((p) => p.link === l.id && (s.dir === 'rx' ? p.to === sw.id : s.dir === 'tx' ? p.from === sw.id : true));
    }
  };
  for (const l of net.links) {
    const me = l.a === dev ? 'a' : l.b === dev ? 'b' : null;
    if (!me) continue;
    const sw = net.devices[me === 'a' ? l.b : l.a], port = me === 'a' ? l.bp : l.ap;
    for (const s of Object.values(sw?.monitor || {})) {
      if (s.dst !== port) continue;
      mirror(sw, s);
      if (s.srcRemote != null) for (const o of all) for (const t of Object.values(o.monitor || {})) if (t.dstRemote === s.srcRemote && o.rspanVlans?.includes(s.srcRemote) && sw.rspanVlans?.includes(s.srcRemote)) mirror(o, t);
      if (s.erspanIp) for (const o of all) for (const t of Object.values(o.monitor || {})) if (t.erspanDst === s.erspanIp && t.erspanId === s.erspanId) mirror(o, t);
    }
  }
  return out;
}

const ICMP = { 0: 'echo reply', 3: 'destination unreachable', 8: 'echo request', 11: 'time exceeded in-transit' };
const tcpFlags = (t) => [t.flags?.syn && 'S', t.flags?.fin && 'F', t.flags?.psh && 'P', t.flags?.rst && 'R', t.flags?.ack && '.'].filter(Boolean).join('') || 'none';
/** Một dòng kiểu tcpdump -n. */
export function tcpdumpLine(p) {
  const time = `${new Date(p.t).toTimeString().slice(0, 8)}.${String(p.t % 1000).padStart(3, '0')}000`;
  const a = F(p, 'arp'), ip = F(p, 'ipv4'), ic = F(p, 'icmp'), t = F(p, 'tcp'), u = F(p, 'udp');
  if (a) return `${time} ARP, ${a.opcode === 2 ? `Reply ${a.senderIp} is-at ${a.senderMac}` : `Request who-has ${a.targetIp} tell ${a.senderIp}`}, length 28`;
  if (ic) return `${time} IP ${ip.src} > ${ip.dst}: ICMP ${ICMP[ic.type] || `type ${ic.type}`}${ic.type === 0 || ic.type === 8 ? `, id ${ic.identifier ?? 0}, seq ${ic.seq ?? 0}` : ''}, length ${Math.max(0, p.len - 34)}`;
  if (t) return `${time} IP ${ip.src}.${t.srcPort} > ${ip.dst}.${t.dstPort}: Flags [${tcpFlags(t)}], seq ${t.seq ?? 0}${t.flags?.ack ? `, ack ${t.ack ?? 0}` : ''}, win ${t.window ?? 0}, length 0`;
  if (u && (u.dstPort === 67 || u.dstPort === 68)) return `${time} IP ${ip.src}.${u.srcPort} > ${ip.dst}.${u.dstPort}: BOOTP/DHCP, ${u.dstPort === 67 ? 'Request' : 'Reply'}, length ${Math.max(0, p.len - 42)}`;
  if (u) return `${time} IP ${ip.src}.${u.srcPort} > ${ip.dst}.${u.dstPort}: UDP, length ${Math.max(0, p.len - 42)}`;
  return ip ? `${time} IP ${ip.src} > ${ip.dst}: ip-proto-${ip.protocol}, length ${p.len}` : `${time} ethernet, length ${p.len}`;
}
/** Một dòng kiểu diagnose sniffer packet (verbose 1). t0 = thời điểm gói đầu tiên. */
export function fortiLine(p, t0) {
  const time = ((p.t - t0) / 1000).toFixed(6);
  const a = F(p, 'arp'), ip = F(p, 'ipv4'), ic = F(p, 'icmp'), t = F(p, 'tcp'), u = F(p, 'udp');
  if (a) return `${time} arp ${a.opcode === 2 ? `reply ${a.senderIp} is-at ${a.senderMac}` : `who-has ${a.targetIp} tell ${a.senderIp}`}`;
  if (ic) return `${time} ${ip.src} -> ${ip.dst}: icmp: ${ICMP[ic.type] || `type-${ic.type}`}`;
  if (t) return `${time} ${ip.src}.${t.srcPort} -> ${ip.dst}.${t.dstPort}: ${[t.flags?.syn && 'syn', t.flags?.fin && 'fin', t.flags?.rst && 'rst', t.flags?.ack && 'ack'].filter(Boolean).join('-') || 'psh'} ${t.seq ?? 0}`;
  if (u) return `${time} ${ip.src}.${u.srcPort} -> ${ip.dst}.${u.dstPort}: udp ${Math.max(0, p.len - 42)}`;
  return ip ? `${time} ${ip.src} -> ${ip.dst}: ip-proto-${ip.protocol} ${p.len}` : `${time} ethernet ${p.len}`;
}
