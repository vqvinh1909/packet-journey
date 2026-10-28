// lab/weak.js — "📊 Điểm yếu của tôi": gắn chủ đề (topic) cho lab / nhiệm vụ / lệnh, ghi nhận sự kiện học
// (lệnh gõ sai, nhiệm vụ trượt, gợi ý / lời giải đã mở, quiz sai, thời gian làm lab), tính điểm theo chủ đề
// (gộp cả 🎲 Phá mạng và 🧮 Luyện subnet) và gợi ý lab nên làm. Thuần logic (reducer trả object mới) để kiểm
// bằng node --test; lưu ở localStorage "weak" (ui/lab.js ghi, ui/weak.js vẽ).
// `cmds` (lệnh đúng theo mẫu + chế độ) cũng là nguồn cho cheat sheet.

/** Chủ đề, thứ tự hiển thị. Regex chạy trên tên + bài học + nhóm của lab (hoặc chữ của nhiệm vụ). */
export const TOPICS = [
  ['Nền tảng', /\bosi\b|unicast|multicast|truy vết mac|học mac/i],
  ['Interface & L1', /lỗi interface|cổng bị shutdown|err-disabled|router đầu tiên/i],
  ['Subnet', /subnet|vlsm|đặt ip|phân chia ip|địa chỉ ip/i],
  ['VLAN/Trunk', /vlan|trunk|802\.1q|\bdtp\b|\bvtp\b|router-on-a-stick|inter-vlan|\bsvi\b/i],
  ['STP', /\bstp\b|spanning|root bridge|portfast|bpdu/i],
  ['EtherChannel', /etherchannel|lacp|pagp|port-channel/i],
  ['Static', /static route|route tĩnh|định tuyến tĩnh|floating|default route/i],
  ['OSPF', /ospf/i],
  ['EIGRP', /eigrp/i],
  ['BGP', /\bbgp/i],
  ['ACL', /\bacl\b|access-list|\bvacl\b/i],
  ['NAT', /\bnat\b|\bpat\b|port forward/i],
  ['DHCP', /dhcp(?! snooping)/i],
  ['FHRP', /hsrp|vrrp|glbp|gateway dự phòng/i],
  ['Bảo mật L2', /port.?security|snooping|\bdai\b|arp inspection|arp giả|source guard|bảo mật l2|bảo mật lớp 2|private vlan|protected port/i],
  ['Firewall', /firewall|\basa\b|\bzbf\b|zone-based|fortigate|palo alto|sophos|check point|pfsense|ipsec|\bvpn\b/i],
  ['IPv6', /ipv6|ospfv3|slaac|dual-stack/i],
  ['Quản trị thiết bị', /\bssh\b|\baaa\b|\bntp\b|syslog|nâng cấp ios|\bcdp\b|\blldp\b|\bsnmp|rommon|config-register|kiểm toán|mật khẩu|cấu hình cơ bản/i],
  ['WAN/Serial', /serial|\bppp\b|\bchap\b|\bgre\b/i],
];
export const TOPIC_NAMES = TOPICS.map(([t]) => t);
const GROUP_TOPIC = { sec: 'Firewall', l2s: 'Bảo mật L2' };

/** Chủ đề trong một đoạn chữ. */
export const topicsOfText = (text) => TOPICS.filter(([, re]) => re.test(String(text || ''))).map(([t]) => t);

/** Chủ đề của lab: trường `topics` nếu có, không thì suy từ tên / bài học / nhóm. */
export function labTopics(lab) {
  if (!lab) return [];
  if (Array.isArray(lab.topics) && lab.topics.length) return lab.topics.slice();
  const out = topicsOfText(`${lab.title || ''} ${lab.lesson || ''}`);
  const g = GROUP_TOPIC[lab.group];
  if (g && !out.includes(g)) out.push(g);
  return out;
}
/** Chủ đề của một nhiệm vụ: theo chữ của nhiệm vụ, không có thì theo lab. */
export function taskTopics(lab, task) {
  const t = topicsOfText(task?.text);
  return t.length ? t : labTopics(lab);
}

/** Chủ đề của một lệnh IOS (lệnh gõ hoặc mẫu `spec`); null = lệnh chung (interface, ip address, show run…). */
export function cmdTopic(cmd) {
  const c = String(cmd || '').toLowerCase().replace(/^(do|no)\s+/, '').replace(/^show\s+(ip\s+)?/, '');
  const rules = [
    [/port-security|dhcp snooping|arp inspection|verify source|private-vlan|protected/, 'Bảo mật L2'],
    [/^ipv6|ospfv3|\bipv6\b/, 'IPv6'],
    [/spanning-tree/, 'STP'],
    [/channel-group|port-channel|etherchannel|lacp|pagp/, 'EtherChannel'],
    [/^switchport (mode|access|trunk|nonegotiate)|^vlan|encapsulation dot1q|^vtp|^name\b|^interfaces trunk/, 'VLAN/Trunk'],
    [/^(ip )?route\b/, 'Static'],
    [/^router ospf|ospf|\barea\b/, 'OSPF'],
    [/eigrp/, 'EIGRP'],
    [/bgp|remote-as|next-hop-self|update-source/, 'BGP'],
    [/access-list|access-group|access-class|^(permit|deny)\b/, 'ACL'],
    [/^nat\b|ip nat|\bnat\b/, 'NAT'],
    [/dhcp|helper-address|default-router|dns-server|excluded-address/, 'DHCP'],
    [/^standby|^vrrp|^glbp|\bstandby\b|\bvrrp\b/, 'FHRP'],
    [/^zone|type inspect|^crypto (isakmp|ipsec|map)|nameif|security-level|^object|^inspect|^policy-map|^class-map|^service-policy/, 'Firewall'],
    [/^aaa|^username|^line |^login|^transport|^crypto key|^ntp|^logging|^enable (secret|password)|^service password|^banner|^ip ssh|^ip domain|^cdp|^lldp|^boot|^copy|^write/, 'Quản trị thiết bị'],
    [/^(shutdown|duplex|speed|errdisable|interfaces? status)/, 'Interface & L1'],
    [/^encapsulation (ppp|hdlc)|^ppp|^clock rate|^tunnel/, 'WAN/Serial'],
  ];
  for (const [re, t] of rules) if (re.test(c)) return t;
  return null;
}

/** Phân loại dòng kết quả của IOS → loại lỗi lệnh, hoặc null nếu lệnh được nhận. */
export function cmdError(out) {
  const s = (out || []).join('\n');
  if (/% Invalid input/.test(s)) return 'invalid';
  if (/% Incomplete command/.test(s)) return 'incomplete';
  if (/% Ambiguous command/.test(s)) return 'ambiguous';
  if (/% Unknown command/.test(s)) return 'unknown';
  return null;
}
/** Dấu nhắc của từng chế độ IOS (hiện cạnh cú pháp gợi ý / cheat sheet). */
export const MODE_PROMPT = { user: '>', priv: '#', config: '(config)#', if: '(config-if)#', subif: '(config-subif)#', range: '(config-if-range)#', vlan: '(config-vlan)#', line: '(config-line)#', pool: '(dhcp-config)#', 'acl-ext': '(config-ext-nacl)#', 'acl-std': '(config-std-nacl)#', router: '(config-router)#', bgp: '(config-router)#', ospf6: '(config-rtr)#', isakmp: '(config-isakmp)#', tset: '(cfg-crypto-trans)#', cmap: '(config-crypto-map)#', zone: '(config-sec-zone)#', mstcfg: '(config-mst)#' };
export const ERR_LABEL = { invalid: '% Invalid input', incomplete: '% Incomplete command', ambiguous: '% Ambiguous command', unknown: '% Unknown command' };

// ---------------------------------------------------------------- dữ liệu (reducer)
export const emptyWeak = () => ({ v: 1, topics: {}, errs: {}, cmds: {}, labs: {} });
const T0 = { ok: 0, err: 0, hint: 0, sol: 0, fail: 0, qok: 0, qbad: 0, done: 0, slow: 0 };
const clone = (w) => ({ v: 1, topics: { ...(w?.topics || {}) }, errs: { ...(w?.errs || {}) }, cmds: { ...(w?.cmds || {}) }, labs: { ...(w?.labs || {}) } });
function bump(w, topics, field, by = 1) {
  for (const t of new Set(topics.filter(Boolean))) w.topics[t] = { ...T0, ...(w.topics[t] || {}), [field]: ((w.topics[t] || {})[field] || 0) + by };
}
const MAX_ERRS = 200, MAX_CMDS = 600;
function trim(obj, max) {
  const ks = Object.keys(obj);
  if (ks.length <= max) return obj;
  const keep = ks.sort((a, b) => (obj[b].at || 0) - (obj[a].at || 0)).slice(0, max);
  return Object.fromEntries(keep.map((k) => [k, obj[k]]));
}

/**
 * Ghi 1 lệnh người học gõ. e = { cmd, out, spec, mode, lab (object), sug: [{spec, mode}], at }.
 * Lệnh sai → errs (gộp theo lệnh đã chuẩn hoá) + topic.err; lệnh đúng có spec → cmds + topic.ok.
 */
export function recordCmd(w0, e) {
  const w = clone(w0);
  const cmd = String(e.cmd || '').trim().replace(/\s+/g, ' ');
  if (!cmd || /\?$/.test(cmd)) return w;
  const kind = cmdError(e.out);
  const at = e.at ?? Date.now();
  const lt = labTopics(e.lab);
  if (kind) {
    const topic = cmdTopic(cmd) || cmdTopic(e.sug?.[0]?.spec) || (lt.length === 1 ? lt[0] : null);
    const key = cmd.toLowerCase();
    const old = w.errs[key];
    w.errs[key] = { cmd, kind, topic, n: (old?.n || 0) + 1, mode: e.mode || old?.mode || '', lab: e.lab?.id || old?.lab || '', sug: e.sug?.length ? e.sug : old?.sug || [], at };
    w.errs = trim(w.errs, MAX_ERRS);
    bump(w, [topic], 'err');
  } else if (e.spec) {
    const topic = cmdTopic(e.spec) || cmdTopic(cmd);
    const key = `${e.mode || ''}|${e.spec}`;
    const old = w.cmds[key];
    w.cmds[key] = { spec: e.spec, mode: e.mode || '', topic, n: (old?.n || 0) + 1, ex: cmd, lab: e.lab?.id || old?.lab || '', at };
    w.cmds = trim(w.cmds, MAX_CMDS);
    bump(w, [topic || (lt.length === 1 ? lt[0] : null)], 'ok');
  }
  return w;
}

/**
 * Ghi sự kiện của lab. type: 'hint' | 'sol' | 'fail' (x.tasks = các nhiệm vụ trượt) | 'quiz' (x.ok, x.task) |
 * 'done' | 'time' (x.secs — cộng dồn thời gian làm lab). Thời gian vượt mức (độ khó × 15 phút) lúc xong → 'slow'.
 */
export function recordLab(w0, type, lab, x = {}) {
  const w = clone(w0);
  if (!lab) return w;
  const lt = labTopics(lab);
  const L = { secs: 0, hints: 0, sol: 0, done: false, ...(w.labs[lab.id] || {}) };
  if (type === 'hint') { bump(w, lt, 'hint'); L.hints += 1; }
  else if (type === 'sol') { bump(w, lt, 'sol'); L.sol += 1; }
  else if (type === 'fail') for (const t of x.tasks || []) bump(w, taskTopics(lab, t), 'fail');
  else if (type === 'quiz') bump(w, taskTopics(lab, x.task), x.ok ? 'qok' : 'qbad');
  else if (type === 'time') L.secs = Math.round(L.secs + Math.max(0, Math.min(x.secs || 0, 3600)));
  else if (type === 'done' && !L.done) {
    L.done = true;
    bump(w, lt, 'done');
    if (L.secs > (lab.level || 1) * 900) bump(w, lt, 'slow');
  }
  if (type === 'quiz' || type === 'fail') return w; // không tạo mục thời gian cho kịch bản / quiz lẻ
  L.at = Date.now();
  w.labs[lab.id] = L;
  return w;
}

// ---------------------------------------------------------------- điểm theo chủ đề
const GOOD = { ok: 0.25, done: 3, qok: 1 };
const BAD = { err: 1, hint: 0.5, sol: 2, fail: 1, qbad: 1.5, slow: 1 };
const MIN_EVIDENCE = 3;

/**
 * Điểm 0–100 theo chủ đề (Laplace: (tốt+1)/(tốt+xấu+2)), null nếu chưa đủ dữ liệu.
 * ext = { subnet: stats của 🧮 (lab/subnet.js), breaks: lịch sử 🎲, labOf: (id) → lab } gộp thêm bằng chứng.
 * Trả [{ topic, score, good, bad, parts: {field: số} }] theo thứ tự TOPIC_NAMES.
 */
export function topicScores(w, ext = {}) {
  const acc = Object.fromEntries(TOPIC_NAMES.map((t) => [t, { good: 0, bad: 0, parts: { ...T0, brkOk: 0, brkBad: 0, snOk: 0, snBad: 0 } }]));
  for (const [t, x] of Object.entries(w?.topics || {})) {
    const a = acc[t];
    if (!a) continue;
    for (const [f, v] of Object.entries(x)) {
      a.parts[f] = (a.parts[f] || 0) + v;
      if (GOOD[f]) a.good += GOOD[f] * v;
      if (BAD[f]) a.bad += BAD[f] * v;
    }
  }
  for (const h of ext.breaks || []) {
    const lab = ext.labOf?.(h.src);
    for (const t of labTopics(lab)) {
      const a = acc[t];
      if (!a) continue;
      if (h.revealed) { a.bad += 3; a.parts.brkBad += 1; } else { a.good += 3; a.bad += 0.5 * (h.hints || 0); a.parts.brkOk += 1; }
    }
  }
  if (ext.subnet) {
    const a = acc.Subnet;
    for (const x of Object.values(ext.subnet)) { a.good += x.ok; a.bad += x.n - x.ok; a.parts.snOk += x.ok; a.parts.snBad += x.n - x.ok; }
  }
  return TOPIC_NAMES.map((topic) => {
    const { good, bad, parts } = acc[topic];
    const score = good + bad >= MIN_EVIDENCE ? Math.round((100 * (good + 1)) / (good + bad + 2)) : null;
    return { topic, score, good: Math.round(good * 10) / 10, bad: Math.round(bad * 10) / 10, parts };
  });
}

/** Lệnh gõ sai nhiều nhất: [{ cmd, kind, n, topic, mode, lab, sug }]. */
export function topErrors(w, k = 8) {
  return Object.values(w?.errs || {}).sort((a, b) => b.n - a.n || (b.at || 0) - (a.at || 0)).slice(0, k);
}

/**
 * Gợi ý 3–5 lab: chủ đề yếu nhất (điểm thấp; nếu chưa đủ dữ liệu thì chủ đề chưa đụng tới) → lab có chủ đề đó,
 * ưu tiên lab chưa xong, điểm rất thấp thì lab dễ trước. Trả [{ id, title, topic, why }].
 */
export function recommend(scores, labs, done = {}, k = 5) {
  const scored = scores.filter((s) => s.score != null).sort((a, b) => a.score - b.score);
  const weak = scored.filter((s) => s.score < 70);
  const untouched = scores.filter((s) => s.score == null && s.good + s.bad === 0);
  const order = [...weak, ...untouched, ...scored.filter((s) => s.score >= 70)];
  const out = [];
  const used = new Set();
  for (let round = 0; out.length < k && round < 3; round++) {
    for (const s of order) {
      if (out.length >= k) break;
      const cands = labs.filter((l) => !used.has(l.id) && labTopics(l).includes(s.topic))
        .sort((a, b) => (!!done[a.id] - !!done[b.id]) || (s.score != null && s.score < 50 ? a.level - b.level : b.level - a.level) || labTopics(a).length - labTopics(b).length);
      const l = cands[0];
      if (!l) continue;
      used.add(l.id);
      const why = s.score == null ? `chưa luyện chủ đề ${s.topic}` : `${s.topic} đang ${s.score}/100${done[l.id] ? ' (làm lại lab đã xong)' : ''}`;
      out.push({ id: l.id, title: l.title, topic: s.topic, why });
    }
  }
  return out;
}

/** Lab để "🎲 Phá mạng" theo chủ đề: lab có chủ đề đó và có lời giải (`canBreak`), ưu tiên lab đã xong. */
export function breakLabFor(topic, labs, done = {}, canBreak = () => true) {
  const c = labs.filter((l) => labTopics(l).includes(topic) && canBreak(l));
  return (c.find((l) => done[l.id]) || c[0])?.id || null;
}
