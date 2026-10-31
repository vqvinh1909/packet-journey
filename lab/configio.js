// lab/configio.js — xuất / nạp cấu hình dạng văn bản cho cả mạng (workspace) và "Đặt làm startup-config".
// Xuất: mỗi thiết bị 1 khối, mở đầu bằng dòng "! ===== Thiết bị: <tên> (<loại>) =====" rồi tới running-config
// (Cisco IOS / ASA), startup.vpc (VPCS) hoặc lệnh ipconfig (PC kiểu Windows / server).
// Nạp: tách khối theo dòng tiêu đề trên, hoặc theo "hostname X" / "set pcname X" (dán thẳng từ show run của nhiều
// thiết bị), gõ từng dòng vào đúng thiết bị qua CLI thật (configure terminal … end).
import * as N from './net.js';

const isIos = (d) => (d.type === 'router' || d.type === 'switch') && !N.isVendorOs(d);
const isHost = (d) => d.type === 'pc' || d.type === 'server';
const kindLabel = (d) => (d.os === 'asa' ? 'Cisco ASA' : d.type === 'router' ? 'Cisco router' : d.type === 'switch' ? 'Cisco switch' : d.shell === 'vpcs' ? 'VPCS' : d.type === 'server' ? 'server' : 'PC');
const HEAD = (d) => `! ===== Thiết bị: ${d.name} (${kindLabel(d)}) =====`;
const HEAD_RE = /^!\s*=+\s*(?:Thiết bị|Device):\s*(\S+)/i;

/** Chạy fn với phiên CLI ở chế độ # (bỏ qua mật khẩu enable), thiết bị coi như đang bật, không đụng đồng hồ. */
function asAdmin(net, cli, id, fn) {
  const d = net.devices[id];
  const s = cli.session(id);
  const saved = { mode: s.mode, pw: s.pw, ask: s.ask, loggedOut: s.loggedOut, ifs: s.ifs, off: d.off };
  return N.withoutClock(net, () => {
    Object.assign(s, { mode: 'priv', pw: null, ask: null, loggedOut: false });
    d.off = false;
    try { return fn(); } finally { Object.assign(s, saved); if (saved.off) d.off = saved.off; else delete d.off; }
  });
}

/** Cấu hình dạng văn bản của 1 thiết bị (mảng dòng), hoặc null nếu hãng này chưa hỗ trợ xuất văn bản. */
export function deviceConfig(net, cli, id) {
  const d = net.devices[id];
  if (N.isVendorOs(d)) return null;
  if (isIos(d)) {
    const out = asAdmin(net, cli, id, () => cli.exec(id, 'show running-config').out);
    return out.filter((l) => !/^(Building configuration|Current configuration)/.test(l));
  }
  if (isHost(d) && d.shell === 'vpcs') {
    return [`set pcname ${d.name}`, ...(d.dhcp ? ['ip dhcp'] : d.ip ? [`ip ${d.ip}/${d.prefix}${d.gateway ? ' ' + d.gateway : ''}`] : []), ...(d.dns ? [`ip dns ${d.dns}`] : [])];
  }
  if (isHost(d)) return d.dhcp ? ['ipconfig /renew'] : d.ip ? [`ipconfig ${d.ip} ${N.prefixToMask(d.prefix)}${d.gateway ? ' ' + d.gateway : ''}`] : [];
  return null;
}

/** Toàn bộ cấu hình của mạng thành 1 file .txt. Trả { text, skipped: [tên thiết bị không xuất được] }. */
export function exportConfigs(net, cli) {
  const parts = [`! Packet Journey — cấu hình ${Object.keys(net.devices).length} thiết bị`, '! Nạp lại: workspace → 📁 Lưu / Nạp… → ⬆ Nạp cấu hình (dán hoặc chọn file này)', ''];
  const skipped = [];
  for (const [id, d] of Object.entries(net.devices)) {
    const L = deviceConfig(net, cli, id);
    if (!L) { skipped.push(d.name); parts.push(HEAD(d), `! (${kindLabel(d)} ${d.os || ''}: chưa hỗ trợ xuất dạng văn bản — dùng 📁 Lưu / Nạp… → ⬇ Xuất mạng (.json) để lưu cả mạng)`, ''); continue; }
    parts.push(HEAD(d), ...L, '');
  }
  return { text: parts.join('\n'), skipped };
}

/**
 * Tách văn bản thành các khối [{ name, lines }]. Ranh giới: dòng tiêu đề "! ===== Thiết bị: X" (file do app xuất),
 * hoặc "hostname X" / "set pcname X" xuất hiện lần đầu trong khối hiện tại (dán nhiều show run liền nhau).
 */
export function splitConfigs(text) {
  const blocks = [];
  let cur = null;
  const start = (name) => { cur = { name, lines: [], byHead: false }; blocks.push(cur); return cur; };
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/\t/g, ' ').replace(/\s+$/, '');
    const h = line.match(HEAD_RE);
    if (h) { start(h[1]).byHead = true; continue; }
    const hn = line.match(/^\s*(?:hostname|set pcname)\s+(\S+)/i);
    if (hn) {
      if (!cur || (!cur.byHead && cur.name && cur.name.toLowerCase() !== hn[1].toLowerCase())) start(hn[1]);
      else if (!cur.name) cur.name = hn[1];
    } else if (!cur) start(null);
    cur.lines.push(line);
  }
  return blocks.filter((b) => b.name && b.lines.some((l) => l.trim() && !l.trim().startsWith('!')));
}

/** Dòng nào bỏ qua khi nạp (chú thích, dòng thông tin của show run, end…). */
const skipLine = (l) => !l.trim() || /^\s*!/.test(l) || /^(Building configuration|Current configuration|version \d|end$)/i.test(l.trim()) || /^set pcname /i.test(l.trim());

/**
 * Nạp cấu hình vào các thiết bị theo tên (không phân biệt hoa thường). Thiết bị IOS: configure terminal → các dòng →
 * end. PC: chạy từng dòng (ip … / ipconfig …). Trả [{ name, id, ok, lines, errors: [dòng lỗi], note }].
 */
export function importConfigs(net, cli, text) {
  const report = [];
  for (const b of splitConfigs(text)) {
    const id = Object.keys(net.devices).find((k) => net.devices[k].name.toLowerCase() === b.name.toLowerCase());
    if (!id) { report.push({ name: b.name, id: null, ok: false, lines: 0, errors: [], note: 'không có thiết bị tên này trong mạng' }); continue; }
    const d = net.devices[id];
    if (d.off) { report.push({ name: b.name, id, ok: false, lines: 0, errors: [], note: 'thiết bị đang tắt — Start trước rồi nạp lại' }); continue; }
    // dán từ console: bỏ dấu nhắc "R1#", "R1(config-if)#" và các lệnh show/ping lẫn vào
    const lines = b.lines.map((l) => l.replace(/^[A-Za-z][\w.-]*(\([\w-]+\))?[#>]\s*/, '')).filter((l) => !skipLine(l) && !/^(do\s+)?(show|sh|ping|traceroute|copy|write|wr)\b/i.test(l.trim())).map((l) => l.trim());
    if (!isIos(d) && !isHost(d)) { report.push({ name: b.name, id, ok: false, lines: 0, errors: [], note: 'hãng này chưa hỗ trợ nạp dạng văn bản' }); continue; }
    const errors = [];
    const run = (l) => { const out = cli.exec(id, l).out; if (out.some((o) => /^(% (Invalid|Incomplete|Ambiguous|Unknown)|Bad command|Invalid Command|Invalid (address|options|gateway|netmask))/.test(o))) errors.push(l); };
    if (isIos(d)) {
      const s = cli.session(id);
      const keep = { mode: s.mode, ifs: s.ifs, pw: s.pw, ask: s.ask, loggedOut: s.loggedOut };
      Object.assign(s, { mode: 'priv', pw: null, ask: null, loggedOut: false });
      cli.exec(id, 'configure terminal');
      // nạp như startup-config lúc khởi động: cổng không ghi "shutdown" thì được bật (running-config không in "no shutdown")
      for (const l of lines) { run(l); if (/^interface\s+\S/i.test(l) && !/^interface\s+range/i.test(l)) cli.exec(id, 'no shutdown'); }
      cli.exec(id, 'end');
      Object.assign(s, keep);
    } else for (const l of lines) run(l);
    report.push({ name: b.name, id, ok: !errors.length, lines: lines.length, errors, note: '' });
  }
  return report;
}

/** "Đặt làm startup-config" cho mọi thiết bị: IOS/ASA = copy running-config startup-config, VPCS = save. Trả số thiết bị đã lưu. */
export function saveAllStartup(net, cli) {
  let n = 0;
  for (const [id, d] of Object.entries(net.devices)) {
    if (isIos(d)) {
      const out = asAdmin(net, cli, id, () => cli.exec(id, 'write memory').out);
      if (out.some((l) => /\[OK\]/.test(l))) n++;
    } else if (d.type === 'pc' && d.shell === 'vpcs') {
      d.vpcsSaved = { ip: d.ip, prefix: d.prefix, gateway: d.gateway, dns: d.dns, dhcp: !!d.dhcp };
      n++;
    }
  }
  return n;
}
