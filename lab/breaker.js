// lab/breaker.js — "🎲 Phá mạng ngẫu nhiên": lab xử lý sự cố vô hạn.
// Lấy một lab có lời giải → chạy lời giải để có mạng chạy tốt → gài 1–3 lỗi ngẫu nhiên (theo seed, tái hiện được).
// Mỗi lỗi chỉ gài nếu hợp với thiết bị/tính năng có trong lab, và phải THỰC SỰ làm hỏng ít nhất 1 nhiệm vụ
// (kiểm bằng checkLab); áp toàn bộ lệnh sửa phải làm mọi nhiệm vụ đạt lại. Người chơi chỉ thấy nhiệm vụ gốc;
// gợi ý mở dần theo 3 mức (lớp nào → thiết bị nào → cổng/lệnh nào), "Xem đáp án" liệt kê lỗi + lệnh sửa.

import * as N from './net.js';
import { createCli } from './ios.js';
import { LABS, getLab, buildLab, checkLab, solutionOf, applySolution } from './labs.js';

export const BREAK_PREFIX = 'RB:';

/** RNG tất định (mulberry32) theo seed 32-bit. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const randomSeed = () => (Math.random() * 0x7fffffff) >>> 0 || 1;

/** Nhiệm vụ cấu hình (bỏ câu trắc nghiệm) — đề "phá mạng" chấm lại đúng các nhiệm vụ này. */
const realTasks = (lab) => lab.tasks.filter((t) => !t.quiz);
const isIos = (d) => (d.type === 'router' || d.type === 'switch') && !d.os && !d.rommon;
const isHost = (d) => d.type === 'pc' || d.type === 'server';
const L = { l1: 'Lớp 1 — vật lý (cổng/dây)', l2: 'Lớp 2 — chuyển mạch (VLAN/trunk/bảo mật cổng)', l3: 'Lớp 3 — địa chỉ IP / định tuyến', svc: 'Dịch vụ mạng (ACL / NAT / FHRP)' };
const mask = (p) => N.prefixToMask(p);
const sh = (p) => N.shortIf(p);

// ---------------------------------------------------------------- thư viện lỗi
/**
 * Mọi lỗi có thể gài trên mạng ĐANG CHẠY TỐT `net`: [{ key, kind, dev, title, layer, detail, brk: [lệnh], fix: [lệnh], host }].
 * brk/fix là lệnh cấu hình (router/switch: chạy trong configure terminal; máy trạm: lệnh PC).
 */
export function faultCandidates(net) {
  const out = [];
  const add = (f) => out.push(f);
  for (const d of Object.values(net.devices)) {
    if (isHost(d)) {
      // sai IP / mask / gateway của PC (chỉ máy đặt IP tĩnh)
      if (d.dhcp || !d.ip || !N.linkAt(net, d.id, 'fa0')) continue;
      const ok = `ipconfig ${d.ip} ${mask(d.prefix)}${d.gateway ? ' ' + d.gateway : ''}`;
      const n = N.ip2n(d.ip);
      if (d.gateway) {
        const g = N.n2ip(N.ip2n(d.gateway) === n + 1 ? n + 2 : N.ip2n(d.gateway) + 1);
        add({ key: `${d.id}|ip`, kind: 'pc-gw', dev: d.id, layer: L.l3, title: `${d.name}: sai default gateway`, detail: `${d.name} đang trỏ gateway ${g} (đúng là ${d.gateway})`, brk: [`ipconfig ${d.ip} ${mask(d.prefix)} ${g}`], fix: [ok], host: true });
      }
      if (d.prefix >= 16 && d.prefix < 30) {
        add({ key: `${d.id}|ip`, kind: 'pc-mask', dev: d.id, layer: L.l3, title: `${d.name}: sai subnet mask`, detail: `${d.name} dùng mask ${mask(d.prefix + 2)} (đúng là ${mask(d.prefix)})`, brk: [`ipconfig ${d.ip} ${mask(d.prefix + 2)}${d.gateway ? ' ' + d.gateway : ''}`], fix: [ok], host: true });
      }
      add({ key: `${d.id}|ip`, kind: 'pc-ip', dev: d.id, layer: L.l3, title: `${d.name}: sai địa chỉ IP`, detail: `${d.name} đặt IP ${N.n2ip(N.ip2n(d.ip) ^ 0x10000)} (khác mạng; đúng là ${d.ip}/${d.prefix})`, brk: [`ipconfig ${N.n2ip(N.ip2n(d.ip) ^ 0x10000)} ${mask(d.prefix)}${d.gateway ? ' ' + d.gateway : ''}`], fix: [ok], host: true });
      continue;
    }
    if (!isIos(d)) continue;
    if (d.type === 'switch') {
      for (const [p, c] of Object.entries(d.ports)) {
        if (p.startsWith('po') || c.shutdown || !N.lineUp(net, d.id, p)) continue;
        const e = N.effPort(net, d, p);
        const peer = N.peerOf(N.linkAt(net, d.id, p), d.id, p);
        const pd = net.devices[peer.dev];
        add({ key: `${d.id}|${p}|adm`, kind: 'shutdown', dev: d.id, layer: L.l1, title: `${d.name} ${sh(p)}: cổng bị shutdown`, detail: `${d.name} ${sh(p)} (nối ${pd.name}) đang "shutdown"`, brk: [`interface ${p}`, 'shutdown'], fix: [`interface ${p}`, 'no shutdown'] });
        if (c.modeSet && e.mode === 'access' && isHost(pd)) {
          const vls = Object.keys(d.vlans).map(Number).filter((v) => v !== e.vlan && v < 1002);
          const w = vls.find((v) => v !== 1) ?? (e.vlan === 1 ? null : 1);
          if (w != null) add({ key: `${d.id}|${p}|vlan`, kind: 'access-vlan', dev: d.id, layer: L.l2, title: `${d.name} ${sh(p)}: sai VLAN access`, detail: `${d.name} ${sh(p)} (máy ${pd.name}) đang ở VLAN ${w}, đúng là VLAN ${e.vlan}`, brk: [`interface ${p}`, `switchport access vlan ${w}`], fix: [`interface ${p}`, `switchport access vlan ${e.vlan}`] });
          if (!c.ps && !c.group) {
            add({ key: `${d.id}|${p}|ps`, kind: 'port-security', dev: d.id, layer: L.l2, title: `${d.name} ${sh(p)}: port-security err-disabled`, detail: `${d.name} ${sh(p)} bật port-security với MAC tĩnh lạ 0000.0c12.3456 → MAC của ${pd.name} vi phạm → cổng err-disabled`, brk: [`interface ${p}`, 'switchport port-security', 'switchport port-security mac-address 0000.0c12.3456'], fix: [`interface ${p}`, 'no switchport port-security', 'shutdown', 'no shutdown'] });
          }
        }
        if (c.modeSet && e.mode === 'trunk' && !c.group) {
          const used = new Set();
          for (const x of Object.values(net.devices)) if (x.type === 'switch') for (const q of Object.values(x.ports)) if (q.mode === 'access' && q.vlan !== 1) used.add(q.vlan);
          const carried = [...used].filter((v) => d.vlans[v] && (e.allowed == null || e.allowed.includes(v)) && v !== e.native).sort((a, b) => a - b);
          if (carried.length) {
            const v = carried[0];
            add({ key: `${d.id}|${p}|allowed`, kind: 'allowed', dev: d.id, layer: L.l2, title: `${d.name} ${sh(p)}: trunk thiếu VLAN ${v}`, detail: `${d.name} ${sh(p)}: VLAN ${v} bị gỡ khỏi "allowed vlan" của trunk`, brk: [`interface ${p}`, `switchport trunk allowed vlan remove ${v}`], fix: [`interface ${p}`, `switchport trunk allowed vlan add ${v}`] });
          }
          const nv = e.native === 99 ? 98 : 99;
          add({ key: `${d.id}|${p}|native`, kind: 'native', dev: d.id, layer: L.l2, title: `${d.name} ${sh(p)}: lệch native VLAN`, detail: `${d.name} ${sh(p)}: native VLAN ${nv}, đầu kia ${pd.name} là ${e.native}`, brk: [`interface ${p}`, `switchport trunk native vlan ${nv}`], fix: [`interface ${p}`, e.native === 1 ? 'no switchport trunk native vlan' : `switchport trunk native vlan ${e.native}`] });
        }
      }
    }
    // cổng L3 (router; SVI không tính) đang up
    // IPv6: tắt định tuyến IPv6, cổng chỉ có IPv6 bị shutdown, ACL IPv6 bị gỡ khỏi cổng
    if (d.type === 'router' && d.ipv6Routing) add({ key: `${d.id}|v6rt`, kind: 'ipv6-routing', dev: d.id, layer: L.l3, title: `${d.name}: tắt định tuyến IPv6`, detail: `${d.name} mất lệnh "ipv6 unicast-routing" → không chuyển tiếp gói IPv6`, brk: ['no ipv6 unicast-routing'], fix: ['ipv6 unicast-routing'] });
    for (const [n, f] of Object.entries(d.ifaces || {})) {
      if (f.ip || f.shutdown || !(f.ipv6 || []).length || n.includes('.') || !N.ifUp(net, d.id, n)) continue;
      add({ key: `${d.id}|${n}|adm`, kind: 'shutdown', dev: d.id, layer: L.l1, title: `${d.name} ${sh(n)}: cổng bị shutdown`, detail: `${d.name} ${sh(n)} (${f.ipv6[0].ip}/${f.ipv6[0].prefix}) đang "shutdown"`, brk: [`interface ${n}`, 'shutdown'], fix: [`interface ${n}`, 'no shutdown'] });
    }
    for (const [n, f] of Object.entries(d.ifaces || {})) for (const dir of ['in', 'out']) {
      const name = f.ipv6Filter?.[dir];
      if (name) add({ key: `${d.id}|${n}|acl6${dir}`, kind: 'acl6', dev: d.id, layer: L.svc, title: `${d.name} ${sh(n)}: ACL IPv6 bị gỡ khỏi cổng`, detail: `${d.name} ${sh(n)} mất lệnh "ipv6 traffic-filter ${name} ${dir}" → chính sách lọc không còn hiệu lực`, brk: [`interface ${n}`, `no ipv6 traffic-filter ${name} ${dir}`], fix: [`interface ${n}`, `ipv6 traffic-filter ${name} ${dir}`] });
    }
    for (const [n, f] of Object.entries(d.ifaces || {})) {
      if (!f.ip || f.shutdown || n.startsWith('lo') || n.startsWith('tu')) continue;
      if (!N.ifUp(net, d.id, n)) continue;
      if (!n.includes('.')) add({ key: `${d.id}|${n}|adm`, kind: 'shutdown', dev: d.id, layer: L.l1, title: `${d.name} ${sh(n)}: cổng bị shutdown`, detail: `${d.name} ${sh(n)} (${f.ip}/${f.prefix}) đang "shutdown"`, brk: [`interface ${n}`, 'shutdown'], fix: [`interface ${n}`, 'no shutdown'] });
      if (n.includes('.') && f.encap != null && !f.native) add({ key: `${d.id}|${n}|encap`, kind: 'dot1q', dev: d.id, layer: L.l2, title: `${d.name} ${sh(n)}: sai encapsulation dot1Q`, detail: `${d.name} ${sh(n)} gắn VLAN ${f.encap + 1}, đúng là ${f.encap}`, brk: [`interface ${n}`, `encapsulation dot1Q ${f.encap + 1}`], fix: [`interface ${n}`, `encapsulation dot1Q ${f.encap}`] });
      if (f.nat) add({ key: `${d.id}|${n}|nat`, kind: 'nat', dev: d.id, layer: L.svc, title: `${d.name} ${sh(n)}: thiếu "ip nat ${f.nat}"`, detail: `${d.name} ${sh(n)} mất lệnh "ip nat ${f.nat}"`, brk: [`interface ${n}`, `no ip nat ${f.nat}`], fix: [`interface ${n}`, `ip nat ${f.nat}`] });
      for (const [g, st] of Object.entries(f.standby || {})) {
        if (!st.ip) continue;
        const wrong = N.n2ip(N.ip2n(st.ip) + (N.ip2n(st.ip) % 256 >= 250 ? -3 : 3));
        add({ key: `${d.id}|${n}|hsrp${g}`, kind: 'hsrp', dev: d.id, layer: L.svc, title: `${d.name} ${sh(n)}: sai IP ảo HSRP nhóm ${g}`, detail: `${d.name} ${sh(n)}: "standby ${g} ip ${wrong}", đúng là ${st.ip} (gateway của máy trạm)`, brk: [`interface ${n}`, `standby ${g} ip ${wrong}`], fix: [`interface ${n}`, `standby ${g} ip ${st.ip}`] });
      }
      // ACL chặn nhầm: chèn "deny" lên đầu ACL đang gắn vào cổng
      for (const dir of ['aclIn', 'aclOut']) {
        const name = f[dir], acl = name && d.acls[name];
        if (!acl || acl.entries.some((x) => x.seq === 1)) continue;
        const deny = acl.type === 'standard' ? '1 deny any' : '1 deny ip any any';
        add({ key: `${d.id}|acl|${name}`, kind: 'acl', dev: d.id, layer: L.svc, title: `${d.name}: ACL ${name} chặn nhầm`, detail: `ACL ${name} (gắn ${dir === 'aclIn' ? 'chiều vào' : 'chiều ra'} ${sh(n)}) có dòng "${deny}" đứng ĐẦU → chặn mọi thứ`, brk: [`ip access-list ${acl.type} ${name}`, deny], fix: [`ip access-list ${acl.type} ${name}`, 'no 1'] });
      }
    }
    for (const r of d.routes || []) {
      const via = r.nh || r.iface;
      if (!via) continue;
      const cmd = `ip route ${r.net} ${mask(r.prefix)} ${via}${r.ad && r.ad !== 1 ? ' ' + r.ad : ''}`;
      add({ key: `${d.id}|route|${r.net}/${r.prefix}|${via}`, kind: 'static', dev: d.id, layer: L.l3, title: `${d.name}: mất route tĩnh ${r.net}/${r.prefix}`, detail: `${d.name} bị xoá "${cmd}"`, brk: [`no ${cmd}`], fix: [cmd] });
    }
    if (d.ospf?.networks?.length) {
      for (const s of d.ospf.networks) {
        const stmt = `network ${s.net} ${s.wild} area ${s.area}`;
        const wrongArea = String(s.area) === '0' ? 1 : 0;
        add({ key: `${d.id}|ospf|${s.net}`, kind: 'ospf-net', dev: d.id, layer: L.l3, title: `${d.name}: OSPF thiếu network`, detail: `${d.name} (router ospf ${d.ospf.pid}) mất lệnh "${stmt}"`, brk: [`router ospf ${d.ospf.pid}`, `no ${stmt}`], fix: [`router ospf ${d.ospf.pid}`, stmt] });
        add({ key: `${d.id}|ospf|${s.net}`, kind: 'ospf-area', dev: d.id, layer: L.l3, title: `${d.name}: OSPF sai area`, detail: `${d.name}: "${s.net} ${s.wild}" khai báo area ${wrongArea}, đúng là area ${s.area}`, brk: [`router ospf ${d.ospf.pid}`, `no ${stmt}`, `network ${s.net} ${s.wild} area ${wrongArea}`], fix: [`router ospf ${d.ospf.pid}`, `no network ${s.net} ${s.wild} area ${wrongArea}`, stmt] });
      }
    }
  }
  return out;
}

/** Chạy lệnh của 1 lỗi: router/switch → vào thẳng configure terminal (bỏ qua mật khẩu enable), máy trạm → lệnh PC. */
function runCmds(net, f, cmds) {
  const cli = createCli(net);
  const d = net.devices[f.dev];
  const outs = [];
  if (isHost(d)) for (const c of cmds) outs.push(...cli.exec(f.dev, c).out);
  else {
    Object.assign(cli.session(f.dev), { mode: 'priv', pw: null, loggedOut: false });
    for (const c of ['configure terminal', ...cmds, 'end']) outs.push(...cli.exec(f.dev, c).out);
  }
  N.vtpSync(net);
  return outs.filter((l) => /^% (Invalid|Incomplete|Ambiguous|Unknown|Bad)|^Command rejected/.test(l));
}
const failing = (lab, net) => checkLab(lab, net, {}).map((ok, i) => (ok ? -1 : i)).filter((i) => i >= 0);

/** Mạng đã chạy lời giải của lab (mọi nhiệm vụ cấu hình đạt) — null nếu lab không có lời giải hoặc lời giải chưa đủ. */
export function solvedNet(lab) {
  if (!solutionOf(lab).length) return null;
  const net = buildLab(lab);
  applySolution(lab, net, createCli(net));
  const t = { tasks: realTasks(lab) };
  return failing(t, net).length ? null : net;
}

/**
 * Gài `n` lỗi vào lab theo seed. Trả { lab, seed, n, net (đã gài lỗi), faults, tasks } hoặc null (lab không phá được).
 * Lỗi đã chọn phải: tự nó làm hỏng ≥ 1 nhiệm vụ; không đụng cùng chỗ với lỗi khác; áp mọi lệnh sửa → đạt hết.
 */
export function makeBreak(lab, n = 1, seed = 1) {
  const base = solvedNet(lab);
  if (!base) return null;
  const t = { tasks: realTasks(lab) };
  const r = rng(seed);
  const cands = shuffle(faultCandidates(base), r);
  const chosen = [];
  const used = new Set();
  for (const f of cands) {
    if (chosen.length >= n) break;
    if (used.has(f.key) || chosen.some((c) => c.dev === f.dev && c.kind === f.kind)) continue;
    const trial = N.cloneNet(base);
    if (runCmds(trial, f, f.brk).length || !failing(t, trial).length) continue;
    // gài cùng các lỗi đã chọn rồi thử sửa: phải đạt lại toàn bộ
    const all = N.cloneNet(base);
    for (const c of [...chosen, f]) runCmds(all, c, c.brk);
    const fixed = N.cloneNet(all);
    for (const c of [...chosen, f].reverse()) runCmds(fixed, c, c.fix);
    if (failing(t, fixed).length || !failing(t, all).length) continue;
    chosen.push(f);
    used.add(f.key);
  }
  if (!chosen.length) return null;
  const net = N.cloneNet(base);
  for (const c of chosen) runCmds(net, c, c.brk);
  return { lab, seed, n: chosen.length, net, faults: chosen, tasks: t.tasks };
}

/** Áp lệnh sửa của mọi lỗi (dùng cho test / nút "Xem đáp án"). */
export function applyFixes(br, net = br.net) { for (const f of [...br.faults].reverse()) runCmds(net, f, f.fix); return net; }

/** Gợi ý mở dần: mức 1 lớp nào (mọi lỗi), mức 2 thiết bị nào, mức 3 cổng/lệnh nào. */
export function breakHints(br) {
  const name = (f) => br.net.devices[f.dev]?.name || f.dev;
  return [
    ...br.faults.map((f, i) => `Lỗi ${i + 1}: nằm ở ${f.layer}.`),
    ...br.faults.map((f, i) => `Lỗi ${i + 1}: kiểm tra thiết bị ${name(f)}${f.host ? ' (ipconfig /all)' : ' (show running-config, show ip interface brief…)'}.`),
    ...br.faults.map((f, i) => `Lỗi ${i + 1}: ${f.detail}.`),
  ];
}

// ---------------------------------------------------------------- lab giả "RB:<lab>:<số lỗi>:<seed>" cho Lab CLI
const cache = new Map();
export const breakId = (labId, n, seed) => `${BREAK_PREFIX}${labId}:${n}:${seed}`;
export const isBreakId = (id) => String(id || '').startsWith(BREAK_PREFIX);
/** Dựng lại (tất định) lab sự cố từ id. null nếu id sai hoặc lab không phá được. */
export function breakLab(id) {
  if (cache.has(id)) return cache.get(id);
  const m = String(id).match(/^RB:([^:]+):(\d):(\d+)$/);
  const src = m && getLab(m[1]);
  const br = src && makeBreak(src, +m[2], +m[3]);
  if (!br) return null;
  const devName = (d) => br.net.devices[d]?.name || d;
  const lab = {
    id, kind: 'ticket', group: src.group, level: Math.min(3, br.n), lesson: `🎲 Phá mạng ngẫu nhiên · seed ${br.seed}`,
    title: `Sự cố ngẫu nhiên: ${src.title}`,
    story: `🎫 Mạng của lab ${src.id} vừa chạy tốt thì có người cấu hình nhầm: ${br.n} lỗi đã được gài (bạn không thấy là lỗi gì). Hãy chẩn đoán bằng show / ping / tracert và sửa cho MỌI nhiệm vụ gốc của lab đạt lại. Mạng gốc: ${src.story}`,
    build: () => N.cloneNet(br.net), init: [],
    tasks: br.tasks, hints: breakHints(br),
    solution: br.faults.map((f) => [f.dev, f.host ? f.fix : ['enable', 'configure terminal', ...f.fix, 'end']]),
    breakInfo: { src: src.id, n: br.n, seed: br.seed, faults: br.faults.map((f) => ({ title: f.title, detail: f.detail, dev: devName(f.dev), fix: f.fix })) },
  };
  cache.set(id, lab);
  return lab;
}

/** Chọn lab để phá: ưu tiên lab đã xong (done), có lời giải; r = RNG. */
export function pickBreakLab(done = {}, r = Math.random) {
  const ok = LABS.filter((l) => solutionOf(l).length && l.kind !== 'sandbox');
  const pool = ok.filter((l) => done[l.id]);
  const list = pool.length ? pool : ok;
  return list[Math.floor(r() * list.length)];
}

/** Lịch sử: thêm 1 lượt ({ id, src, n, seed, secs, hints, revealed, at }), giữ 100 lượt gần nhất. */
export function addBreakResult(hist, rec) { return [rec, ...(hist || []).filter((x) => x.id !== rec.id)].slice(0, 100); }
/** Điểm 1 lượt: 1000 − 5 điểm/30 giây − 120 điểm/gợi ý; xem đáp án = 0. */
export function breakScore(rec) {
  if (rec.revealed) return 0;
  return Math.max(100, Math.round(1000 * Math.min(1, rec.n / 1.5) - Math.floor(rec.secs / 30) * 5 - rec.hints * 120));
}
