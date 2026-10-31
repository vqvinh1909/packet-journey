// lab/unl.js — nhập / xuất file .unl của EVE-NG (XML mở: <lab><topology><nodes>, <networks>, <objects><configs>).
// Nhập: node → thiết bị của workspace theo template/image (vios, iol, viosl2, vpcs, asav, fortinet, paloalto…),
//   toạ độ left/top giữ nguyên, network 2 đầu → 1 dây; network ≥ 3 đầu → thêm 1 switch tên network (EVE dùng bridge);
//   network pnet/cloud → đám mây Internet; serial IOL (remote_id/remote_if) → dây Serial; config (base64) → văn bản
//   "! ===== Thiết bị: …" để nạp qua lab/configio.js. Thứ gì không hỗ trợ thì bỏ qua và ghi vào báo cáo.
// Xuất: mỗi thiết bị → node (template phổ biến; image cần đổi theo máy EVE-NG của bạn), mỗi dây → network ẩn
//   (visibility 0) như khi nối dây trong EVE-NG; dây Serial → interface serial remote_id; cấu hình → <config> base64.
import * as N from './net.js';
import * as S from './sandbox.js';
import * as IO from './configio.js';

// ---------------------------------------------------------------- XML tối giản (đủ cho .unl, chạy cả trong Node)
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unesc = (s) => String(s).replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m));
const xesc = (s) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
function attrs(s) {
  const o = {};
  for (const m of String(s).matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) o[m[1].toLowerCase()] = unesc(m[3] ?? m[4]);
  return o;
}
/** Các phần tử <tag ...>…</tag> hoặc <tag .../> trong xml: [{ a: thuộc tính, body }]. */
function elems(xml, tag) {
  const out = [];
  const re = new RegExp(`<${tag}\\b([^>]*?)(/>|>([\\s\\S]*?)</${tag}>)`, 'gi');
  for (const m of xml.matchAll(re)) out.push({ a: attrs(m[1]), body: m[3] ?? '' });
  return out;
}
const b64dec = (s) => {
  const bin = atob(String(s).replace(/\s+/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};
const b64enc = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

// ---------------------------------------------------------------- template EVE-NG ↔ mẫu thiết bị của app
/** Mẫu thiết bị app cho 1 node EVE-NG (null = không hỗ trợ). */
export function kindOfNode(a) {
  const t = String(a.template || '').toLowerCase(), img = String(a.image || '').toLowerCase(), ty = String(a.type || '').toLowerCase(), nm = String(a.name || '').toLowerCase();
  if (ty === 'vpcs' || t === 'vpcs') return 'pc';
  if (t === 'iol') return /l2|switch/.test(img) ? 'sw2960' : 'router';
  if (/viosl2|iosvl2|vios_l2|nxos|titanium/.test(t + img)) return 'sw3560';
  if (/^(vios|iosv|csr1000v|csr1000vng|c7200|c3725|c1710|c2600|c3600|xrv|xrv9k|vyos|mikrotik|veos)/.test(t)) return 'router';
  if (/asa/.test(t)) return 'asa';
  if (/fortinet|forti/.test(t)) return 'fortios';
  if (/paloalto|pan/.test(t)) return 'panos';
  if (/sophos/.test(t)) return 'sophos';
  if (/^cp|checkpoint/.test(t)) return 'checkpoint';
  if (/pfsense/.test(t)) return 'pfsense';
  if (/linux|docker|win|ubuntu|kali|osx/.test(t)) return /srv|server|web|dns|dhcp|ftp|mail/.test(nm) ? 'server' : 'pc';
  return null;
}
const EXPORT_TPL = {
  router: { type: 'qemu', template: 'vios', image: 'vios-adventerprisek9-m.SPA.159-3.M6', icon: 'Router.png' },
  sw2960: { type: 'qemu', template: 'viosl2', image: 'viosl2-adventerprisek9-m.SSA.high_iron_20200929', icon: 'Switch.png' },
  sw3560: { type: 'qemu', template: 'viosl2', image: 'viosl2-adventerprisek9-m.SSA.high_iron_20200929', icon: 'Switch L3.png' },
  asa: { type: 'qemu', template: 'asav', image: 'asav-9.16.2', icon: 'ASA.png' },
  fortios: { type: 'qemu', template: 'fortinet', image: 'fortinet-FGT-v7.4.4', icon: 'Firewall.png' },
  panos: { type: 'qemu', template: 'paloalto', image: 'paloalto-10.1.0', icon: 'Firewall.png' },
  sophos: { type: 'qemu', template: 'sophosxg', image: 'sophosxg-19.5', icon: 'Firewall.png' },
  checkpoint: { type: 'qemu', template: 'cpsg', image: 'cpsg-R81.20', icon: 'Firewall.png' },
  pfsense: { type: 'qemu', template: 'pfsense', image: 'pfsense-2.7.2', icon: 'Firewall.png' },
  pc: { type: 'vpcs', template: 'vpcs', image: '', icon: 'Desktop.png' },
  server: { type: 'qemu', template: 'linux', image: 'linux-ubuntu-22.04-server', icon: 'Server.png' },
};

// ---------------------------------------------------------------- nhập
/** Đọc XML .unl → { name, nodes:[{ id, name, kind, x, y, ifs:[{ id, name, type, net, rid, rif }] , a }], networks:[{ id, name, type, x, y }], configs:{ nodeId: text } }. */
export function parseUnl(xml) {
  xml = String(xml || '');
  const lab = elems(xml, 'lab')[0];
  if (!lab || !/<topology\b/i.test(xml)) throw new Error('Không phải file .unl của EVE-NG (thiếu <lab>/<topology>)');
  const nodes = elems(xml, 'node').map(({ a, body }) => ({
    id: a.id, name: a.name || 'node' + a.id, kind: kindOfNode(a), x: +a.left || 0, y: +a.top || 0, a,
    ifs: elems(body, 'interface').map((i) => ({ id: +i.a.id, name: i.a.name || '', type: (i.a.type || 'ethernet').toLowerCase(), net: i.a.network_id, rid: i.a.remote_id, rif: i.a.remote_if })),
  }));
  const networks = elems(xml, 'network').map(({ a }) => ({ id: a.id, name: a.name || 'Net' + a.id, type: (a.type || 'bridge').toLowerCase(), x: +a.left || 0, y: +a.top || 0 }));
  const configs = {};
  for (const { a, body } of elems(xml, 'config')) { try { configs[a.id] = b64dec(body); } catch { /* config hỏng: bỏ qua */ } }
  return { name: lab.a.name || 'EVE-NG lab', nodes, networks, configs };
}

// tên cổng EVE (Ethernet0/0, e0/0, Gi0/0, GigabitEthernet0/0, Serial1/0…) → khoá chuẩn "e0/0" để đổi sang cổng app
const IF_WORDS = { g: ['gigabitethernet', 'gi', 'ge', 'g'], f: ['fastethernet', 'fa', 'f'], e: ['ethernet', 'eth', 'et', 'e'], s: ['serial', 'se', 's'] };
function ifKey(word, nums) {
  const w = word.toLowerCase();
  const t = Object.keys(IF_WORDS).find((k) => IF_WORDS[k].includes(w));
  return t ? t + nums : null;
}
const IF_TOKEN = /\b([A-Za-z]+)(\d+(?:\/\d+)+)(\.\d+)?\b/g;
/** Đổi tên cổng EVE trong dòng cấu hình sang tên cổng của app (map: khoá → cổng app). */
function rewriteIfs(line, map) {
  return line.replace(IF_TOKEN, (m, w, nums, sub) => { const k = ifKey(w, nums); return k && map[k] ? N.longIf(map[k]) + (sub || '') : m; });
}

const safeName = (s) => String(s).trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^[^A-Za-z]+/, '').slice(0, 20);

/**
 * Chuyển .unl thành mạng workspace. Trả { net, configText (dùng IO.importConfigs), report: [chuỗi], name }.
 * Thiết bị mới ở trạng thái TẮT như EVE-NG khi vừa mở lab.
 */
export function unlToSandbox(xml) {
  const p = parseUnl(xml);
  const net = S.emptySandbox();
  const report = [];
  const devOf = {}; // id node EVE → id thiết bị app
  const portOf = {}; // `${nodeId}|${ifId}` → tên cổng app
  // toạ độ EVE thường 0–2000 px: dịch cho vừa khung
  const xs = p.nodes.map((n) => n.x), ys = p.nodes.map((n) => n.y);
  const ox = xs.length ? Math.min(...xs) - 120 : 0, oy = ys.length ? Math.min(...ys) - 80 : 0;
  const pos = (x, y) => ({ x: Math.max(60, x - ox), y: Math.max(60, y - oy) });
  for (const n of p.nodes) {
    if (!n.kind) { report.push(`Bỏ qua node "${n.name}" (template ${n.a.template || n.a.type || '?'} chưa hỗ trợ)`); continue; }
    const eth = n.ifs.filter((i) => i.type !== 'serial').sort((a, b) => a.id - b.id);
    const ser = n.ifs.filter((i) => i.type === 'serial').sort((a, b) => a.id - b.id);
    const K = S.SANDBOX_KINDS[n.kind];
    const want = Math.max(eth.length ? Math.max(...eth.map((i) => i.id)) + 1 : 0, +n.a.ethernet || 0);
    let cnt = null;
    if (K.ports) cnt = K.ports.choices ? (K.ports.choices.find((c) => c >= want) ?? K.ports.choices.at(-1)) : Math.max(K.ports.min, Math.min(K.ports.max, want || K.ports.def));
    const xy = pos(n.x, n.y);
    const id = S.addDevice(net, n.kind, xy.x, xy.y, { ports: cnt, off: true, prefix: S.SANDBOX_KINDS[n.kind].prefix });
    const nm = safeName(n.name);
    const rnErr = nm ? S.renameDevice(net, id, nm) : 'tên không hợp lệ';
    if (rnErr || nm !== n.name) report.push(`"${n.name}" đặt tên ${net.devices[id].name} trong app (tên chỉ gồm chữ, số, - và _, không trùng)`);
    devOf[n.id] = id;
    const d = net.devices[id];
    const phys = S.physPorts(d);
    const ethP = phys.filter((x) => !/^s/.test(x)), serP = phys.filter((x) => /^s/.test(x));
    // cổng ethernet theo chỉ số interface (IOL e0/0..e0/3 = id 0..3, e1/0 = id 16 → xếp theo thứ tự)
    eth.forEach((i, k) => { if (ethP[k]) portOf[`${n.id}|${i.id}`] = ethP[k]; else report.push(`${d.name}: thiếu cổng cho ${i.name}`); });
    ser.forEach((i, k) => { if (serP[k]) portOf[`${n.id}|${i.id}`] = serP[k]; else report.push(`${d.name}: ${i.name} (serial) — thiết bị này không có cổng Serial, bỏ qua`); });
  }
  const members = {};
  for (const n of p.nodes) for (const i of n.ifs) if (i.net && i.net !== '0' && devOf[n.id] && portOf[`${n.id}|${i.id}`]) (members[i.net] ||= []).push({ dev: devOf[n.id], port: portOf[`${n.id}|${i.id}`] });
  const link = (a, ap, b, bp) => { const e = S.connect(net, a, ap, b, bp); if (e) report.push(`Không nối được ${net.devices[a].name} ${ap} ↔ ${net.devices[b].name} ${bp}: ${e}`); };
  for (const w of p.networks) {
    const m = members[w.id] || [];
    if (/^pnet|cloud|nat/.test(w.type)) {
      if (!m.length) continue;
      const xy = pos(w.x, w.y);
      const cid = S.addDevice(net, 'cloud', xy.x, xy.y, { off: true });
      const nm = safeName(w.name);
      if (nm) S.renameDevice(net, cid, nm);
      link(m[0].dev, m[0].port, cid, 'fa0');
      if (m.length > 1) report.push(`Network "${w.name}" (${w.type}) có ${m.length} đầu — chỉ nối đầu đầu tiên vào đám mây`);
      continue;
    }
    if (m.length === 2) link(m[0].dev, m[0].port, m[1].dev, m[1].port);
    else if (m.length > 2) {
      const xy = pos(w.x, w.y);
      const sid = S.addDevice(net, 'sw2960', xy.x, xy.y, { ports: m.length <= 8 ? 8 : m.length <= 16 ? 16 : m.length <= 24 ? 24 : 48, off: true });
      const nm = safeName(w.name);
      if (nm) S.renameDevice(net, sid, nm);
      const sp = S.physPorts(net.devices[sid]);
      m.forEach((x, k) => link(x.dev, x.port, sid, sp[k]));
      report.push(`Network "${w.name}" nối ${m.length} thiết bị → thêm switch ${net.devices[sid].name} thay cho bridge của EVE-NG`);
    }
  }
  // serial IOL: interface serial có remote_id/remote_if (mỗi cặp chỉ nối 1 lần)
  const seen = new Set();
  for (const n of p.nodes) for (const i of n.ifs) {
    if (i.type !== 'serial' || !i.rid) continue;
    const k1 = `${n.id}|${i.id}`, k2 = `${i.rid}|${i.rif}`;
    if (seen.has(k2) || !portOf[k1] || !portOf[k2]) continue;
    seen.add(k1);
    link(devOf[n.id], portOf[k1], devOf[i.rid], portOf[k2]);
  }
  const blocks = [];
  for (const [nid, text] of Object.entries(p.configs)) {
    const d = net.devices[devOf[nid]];
    if (!d) continue;
    const map = {};
    for (const i of p.nodes.find((x) => x.id === nid).ifs) {
      const m = /^([A-Za-z]+)(\d+(?:\/\d+)+)$/.exec(i.name);
      const k = m && ifKey(m[1], m[2]);
      if (k && portOf[`${nid}|${i.id}`]) map[k] = portOf[`${nid}|${i.id}`];
    }
    blocks.push(`! ===== Thiết bị: ${d.name} =====`, ...text.split(/\r?\n/).filter((l) => !/^\s*hostname\b/i.test(l)).map((l) => rewriteIfs(l, map)), '');
  }
  return { net, configText: blocks.join('\n'), report, name: p.name };
}

/**
 * Nạp cấu hình đi kèm .unl như EVE-NG: cấu hình thành startup-config của node (Start là chạy với cấu hình đó,
 * Wipe quay về đó), thiết bị vẫn ở trạng thái TẮT. Trả báo cáo của IO.importConfigs.
 */
export function applyUnlConfigs(net, cli, configText) {
  if (!String(configText || '').trim()) return [];
  const was = Object.values(net.devices).filter((d) => d.off).map((d) => d.id);
  S.powerAll(net, true);
  const rep = IO.importConfigs(net, cli, configText);
  IO.saveAllStartup(net, cli);
  for (const id of was) S.stopDevice(net, id);
  return rep;
}

// ---------------------------------------------------------------- xuất
/**
 * Mạng workspace → XML .unl. cfgOf(id) → mảng dòng cấu hình hoặc null (dùng IO.deviceConfig).
 * Đám mây Internet xuất thành network pnet0 (kết nối mạng thật của máy EVE-NG).
 */
export function sandboxToUnl(net, cfgOf = () => null, name = 'Packet Journey lab', id = '') {
  const ds = Object.values(net.devices);
  const nodeId = {}, ifId = {};
  const nodes = [];
  let k = 0;
  for (const d of ds) {
    if (N.isCloud(d)) continue;
    nodeId[d.id] = ++k;
    const phys = S.physPorts(d);
    const eth = phys.filter((p) => !/^s/.test(p)), ser = phys.filter((p) => /^s/.test(p));
    eth.forEach((p, i) => (ifId[`${d.id}|${p}`] = i));
    ser.forEach((p, i) => (ifId[`${d.id}|${p}`] = 16 + i));
    nodes.push({ d, eth, ser });
  }
  const networks = [];
  const nodeIfs = {};
  const addIf = (dev, port, attrs2) => (nodeIfs[dev] ||= []).push({ id: ifId[`${dev}|${port}`], name: ifName(net.devices[dev], port), ...attrs2 });
  for (const l of net.links) {
    const A = net.devices[l.a], B = net.devices[l.b];
    const cloud = N.isCloud(A) ? A : N.isCloud(B) ? B : null;
    if (cloud) {
      const [dev, port] = cloud === A ? [l.b, l.bp] : [l.a, l.ap];
      if (!nodeId[dev]) continue;
      const nid = networks.length + 1;
      networks.push({ id: nid, type: 'pnet0', name: cloud.name, x: cloud.x, y: cloud.y, vis: 1 });
      addIf(dev, port, { type: 'ethernet', network_id: nid });
    } else if (/^s/.test(l.ap) && /^s/.test(l.bp)) {
      addIf(l.a, l.ap, { type: 'serial', remote_id: nodeId[l.b], remote_if: ifId[`${l.b}|${l.bp}`] });
      addIf(l.b, l.bp, { type: 'serial', remote_id: nodeId[l.a], remote_if: ifId[`${l.a}|${l.ap}`] });
    } else {
      const nid = networks.length + 1;
      networks.push({ id: nid, type: 'bridge', name: `Net-${A.name}iface_${ifId[`${l.a}|${l.ap}`]}`, x: Math.round((A.x + B.x) / 2), y: Math.round((A.y + B.y) / 2), vis: 0 });
      addIf(l.a, l.ap, { type: 'ethernet', network_id: nid });
      addIf(l.b, l.bp, { type: 'ethernet', network_id: nid });
    }
  }
  const at = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k2, v]) => `${k2}="${xesc(v)}"`).join(' ');
  const L = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', `<lab ${at({ name, id: id || undefined, version: 1, scripttimeout: 300, lock: 0 })}>`, '  <topology>', '    <nodes>'];
  const cfgs = [];
  for (const { d, eth, ser } of nodes) {
    const kind = S.kindOf(d);
    const T = EXPORT_TPL[kind] || (d.type === 'pc' ? EXPORT_TPL.pc : d.type === 'server' ? EXPORT_TPL.server : EXPORT_TPL.router);
    const lines = cfgOf(d.id);
    const nid = nodeId[d.id];
    if (lines && lines.length) cfgs.push(`      <config id="${nid}">${b64enc(lines.join('\n') + '\n')}</config>`);
    const base = { id: nid, name: d.name, type: T.type, template: T.template, image: T.image, console: 'telnet' };
    const extra = T.type === 'vpcs' ? {} : { cpu: 1, ram: kind === 'router' || kind.startsWith('sw') ? 1024 : 2048, ethernet: Math.max(1, eth.length), ...(ser.length ? { serial: Math.ceil(ser.length / 4) } : {}) };
    L.push(`      <node ${at({ ...base, ...extra, delay: 0, icon: T.icon, config: lines && lines.length ? 1 : 0, left: Math.round(d.x), top: Math.round(d.y) })}>`);
    for (const i of (nodeIfs[d.id] || []).sort((a, b) => a.id - b.id)) L.push(`        <interface ${at(i)}/>`);
    L.push('      </node>');
  }
  L.push('    </nodes>', '    <networks>');
  for (const w of networks) L.push(`      <network ${at({ id: w.id, type: w.type, name: w.name, left: Math.round(w.x), top: Math.round(w.y), visibility: w.vis })}/>`);
  L.push('    </networks>', '  </topology>');
  if (cfgs.length) L.push('  <objects>', '    <configs>', ...cfgs, '    </configs>', '  </objects>');
  L.push('</lab>');
  return L.join('\n');
}
function ifName(d, p) {
  if (d.type === 'pc' || d.type === 'server') return d.shell === 'vpcs' || d.type === 'pc' ? 'eth0' : 'e0';
  return N.shortIf(p);
}
