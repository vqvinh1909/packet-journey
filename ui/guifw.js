// ui/guifw.js — trang quản trị web giả lập cho firewall Sophos / Check Point / pfSense (lab/guifw.js).
// Mỗi thao tác trên form sinh ra 1 "lệnh thao tác" (vd: rule add ... ) và gửi qua api.run(cmd) →
// chạy như gõ lệnh: được ghi nhật ký, khôi phục khi mở lại, và lời giải lab dùng đúng các lệnh này.

import { esc } from './topo.js';
import { GUI_VENDORS, GUI_SVC, gfwOf, pending } from '../lab/guifw.js';
import { renderWlc } from './wlc.js';

const TABS = { sophos: ['Interfaces', 'Hosts & services', 'Rules and policies', 'NAT', 'Monitor'], checkpoint: ['Gateway', 'Objects', 'Access Control', 'NAT', 'Logs'], pfsense: ['Interfaces', 'Aliases', 'Firewall Rules', 'NAT', 'Status'] };

/** Vẽ trang quản trị của thiết bị d vào el. api = { run(cmd) → kết quả, lastErr, tab, setTab(t), ruleIf, setRuleIf(z) }. */
export function renderGuiFw(el, d, api) {
  if (d.os === 'wlc') return renderWlc(el, d, api);
  const v = d.os;
  const V = GUI_VENDORS[v];
  const G = gfwOf(d), C = G.cand;
  const tabs = TABS[v];
  const tab = tabs.includes(api.tab) ? api.tab : tabs[2];
  const zones = V.zones;
  const objNames = Object.keys(C.objs);
  const svcNames = [...Object.keys(GUI_SVC).filter((x) => x !== 'any'), ...Object.keys(C.svcs)];
  const addrOpts = ['any', ...(v === 'pfsense' ? zones.flatMap((z) => [`${z} net`, `${z} address`]) : []), ...objNames];
  const opt = (arr, sel = []) => arr.map((x) => `<option value="${esc(x)}"${sel.includes(x) ? ' selected' : ''}>${esc(x)}</option>`).join('');
  const multi = (id, arr, sel) => `<select id="${id}" multiple size="${Math.min(5, arr.length)}">${opt(arr, sel)}</select>`;

  let body = '';
  if (tab === tabs[0]) {
    body += `<h4>${v === 'checkpoint' ? 'Gateway — Network Management (Topology)' : 'Interfaces'}</h4><table class="gf-t"><tr><th>Cổng</th><th>IP / prefix</th><th>${v === 'checkpoint' ? 'Topology' : v === 'pfsense' ? 'Tên (role)' : 'Zone'}</th><th></th></tr>`;
    for (const k of Object.keys(d.ifaces)) {
      const i = C.ifs[k];
      body += `<tr><td><b>${esc(k)}</b></td><td><input data-ip="${esc(k)}" value="${i ? `${i.ip}/${i.prefix}` : ''}" placeholder="a.b.c.d/nn"></td><td><select data-zone="${esc(k)}">${opt(zones, [i?.zone || ''])}</select></td><td><button data-saveif="${esc(k)}">Lưu</button></td></tr>`;
    }
    body += `</table><div class="gf-row"><label>Default gateway <input id="gf-gw" value="${esc(C.gw || '')}" placeholder="vd 203.0.113.1"></label><button id="gf-gw-save">Lưu</button></div>`;
  } else if (tab === tabs[1]) {
    body += `<h4>${v === 'checkpoint' ? 'Network objects' : v === 'pfsense' ? 'Aliases' : 'IP hosts'}</h4><table class="gf-t"><tr><th>Tên</th><th>Địa chỉ</th></tr>${objNames.map((n) => `<tr><td>${esc(n)}</td><td>${C.objs[n].ip}/${C.objs[n].prefix}</td></tr>`).join('') || '<tr><td colspan="2" class="gf-muted">(chưa có)</td></tr>'}</table>`;
    body += `<div class="gf-row"><input id="gf-on" placeholder="Tên (vd WEB)"><input id="gf-oa" placeholder="IP hoặc mạng (vd 172.16.1.10 hoặc 10.1.1.0/24)"><button id="gf-oadd">＋ Thêm</button></div>`;
    body += `<h4>Services</h4><div class="gf-muted">Có sẵn: ${Object.keys(GUI_SVC).filter((x) => x !== 'any').join(', ')}</div><table class="gf-t">${Object.entries(C.svcs).map(([n, x]) => `<tr><td>${esc(n)}</td><td>${x.proto}/${x.port}</td></tr>`).join('')}</table>`;
    body += `<div class="gf-row"><input id="gf-sn" placeholder="Tên dịch vụ"><select id="gf-sp"><option>tcp</option><option>udp</option></select><input id="gf-sport" placeholder="Port" size="6"><button id="gf-sadd">＋ Thêm</button></div>`;
  } else if (tab === tabs[2]) {
    const rif = v === 'pfsense' ? (zones.includes(api.ruleIf) ? api.ruleIf : 'LAN') : null;
    if (v === 'pfsense') body += `<div class="gf-subtabs">${zones.map((z) => `<button data-rif="${z}" class="${z === rif ? 'on' : ''}">${z}</button>`).join('')}</div><div class="gf-muted">pfSense xét rule trên cổng NHẬN gói (tab ${rif}) — từ trên xuống, khớp là dừng; không khớp → chặn.</div>`;
    const shown = C.rules.map((r, i) => [r, i]).filter(([r]) => !rif || r.from.includes(rif));
    const cols = v === 'checkpoint' ? ['No.', 'Name', 'Source', 'Destination', 'Services', 'Action'] : v === 'pfsense' ? ['', 'Name', 'Source', 'Destination', 'Service', 'Action'] : ['#', 'Name', 'Source zone', 'Dest zone', 'Source', 'Destination', 'Service', 'Action'];
    body += `<table class="gf-t gf-rules"><tr>${cols.map((c) => `<th>${c}</th>`).join('')}<th></th></tr>`;
    for (const [r, i] of shown) {
      const act = `<span class="gf-act ${r.action}">${r.action === 'accept' ? (v === 'checkpoint' ? 'Accept' : 'Allow') : 'Drop'}</span>${r.nat ? ' <span class="gf-nat">MASQ</span>' : ''}`;
      const cells = v === 'checkpoint' ? [i + 1, r.name, r.src, r.dst, r.svc, act] : v === 'pfsense' ? [r.disabled ? '✕' : '✓', r.name, r.src, r.dst, r.svc, act] : [i + 1, r.name, r.from, r.to, r.src, r.dst, r.svc, act];
      body += `<tr class="${r.disabled ? 'gf-off' : ''}">${cells.map((c) => `<td>${Array.isArray(c) ? esc(c.join(', ')) : typeof c === 'string' && c.startsWith('<span') ? c : esc(c)}</td>`).join('')}<td class="gf-btns"><button data-up="${esc(r.name)}" title="Lên">↑</button><button data-down="${esc(r.name)}" title="Xuống">↓</button><button data-tog="${esc(r.name)}" title="Bật/tắt">⏯</button><button data-del="${esc(r.name)}" title="Xoá">🗑</button></td></tr>`;
    }
    body += `<tr class="gf-implicit"><td colspan="${cols.length + 1}">${esc(V.implicit)}</td></tr></table>`;
    body += `<details class="gf-add" ${api.addOpen ? 'open' : ''}><summary>＋ ${v === 'checkpoint' ? 'Add rule' : v === 'pfsense' ? 'Add rule (tab ' + rif + ')' : 'Add firewall rule'}</summary><div class="gf-form">` +
      `<label>Tên <input id="gf-rn" placeholder="vd LAN-ra-Internet"></label>` +
      (v === 'sophos' ? `<label>Source zones ${multi('gf-rfrom', ['any', ...zones], [])}</label><label>Destination zones ${multi('gf-rto', ['any', ...zones], [])}</label>` : '') +
      `<label>Source ${multi('gf-rsrc', addrOpts, ['any'])}</label><label>Destination ${multi('gf-rdst', addrOpts, ['any'])}</label>` +
      `<label>Services ${multi('gf-rsvc', ['any', ...svcNames], ['any'])}</label>` +
      `<label>Action <select id="gf-ract"><option value="accept">${v === 'checkpoint' ? 'Accept' : 'Allow / Accept'}</option><option value="drop">Drop</option></select></label>` +
      (v === 'sophos' ? `<label class="gf-chk"><input type="checkbox" id="gf-rnat"> Linked NAT: MASQ (đổi nguồn sang IP cổng ra)</label>` : '') +
      `<label>Vị trí <select id="gf-rpos"><option value="bottom">Cuối danh sách</option><option value="top">Đầu danh sách</option></select></label>` +
      `<button id="gf-radd" class="btn-accent">Lưu rule</button></div></details>`;
  } else if (tab === tabs[3]) {
    body += `<h4>NAT</h4><table class="gf-t"><tr><th>Tên</th><th>Loại</th><th>Chi tiết</th><th></th></tr>`;
    for (const n of C.nat) body += `<tr><td>${esc(n.name)}</td><td>${n.type === 'snat' ? 'Source NAT' : n.proto ? 'Port forward' : 'Destination NAT'}</td><td>${n.type === 'snat' ? `${esc(n.src.join(','))} → ${esc(n.to.join(','))} (ẩn sau IP cổng ra)` : `${esc(n.ext)}${n.proto ? ':' + n.ext_port : ''} → ${esc(n.int)}${n.proto ? ':' + n.int_port : ''}`}</td><td><button data-ndel="${esc(n.name)}">🗑</button></td></tr>`;
    body += `</table>`;
    if (v === 'pfsense') body += `<div class="gf-row">Outbound NAT mode: <b>${C.outbound === 'automatic' ? 'Automatic' : 'Manual'}</b> <button data-ob="${C.outbound === 'automatic' ? 'manual' : 'automatic'}">Đổi sang ${C.outbound === 'automatic' ? 'Manual' : 'Automatic'}</button><span class="gf-muted">Automatic = mọi mạng nội bộ ra WAN tự NAT.</span></div>`;
    if (v !== 'pfsense' || C.outbound === 'manual') body += `<div class="gf-row"><b>${v === 'checkpoint' ? 'Hide NAT' : 'Source NAT'}</b> tên <input id="gf-sn2" size="8"> nguồn <select id="gf-snsrc">${opt(addrOpts.filter((x) => x !== 'any'))}</select> ra zone <select id="gf-snto">${opt(zones)}</select><button id="gf-snadd">＋</button></div>`;
    body += `<div class="gf-row"><b>${v === 'pfsense' ? 'Port Forward' : v === 'checkpoint' ? 'Static NAT' : 'DNAT (Server access)'}</b> tên <input id="gf-dn" size="8"> IP ngoài <input id="gf-dext" size="13" placeholder="${v === 'pfsense' ? 'wan' : '203.0.113.10'}" value="${v === 'pfsense' ? 'wan' : ''}"> → máy trong <select id="gf-dint">${opt(objNames)}</select>` +
      ` <label class="gf-chk"><input type="checkbox" id="gf-dpf"${v === 'pfsense' ? ' checked' : ''}> đổi port</label> tcp <input id="gf-dep" size="5" placeholder="8080"> → <input id="gf-dip" size="5" placeholder="80">` +
      (v === 'pfsense' ? ` <label class="gf-chk"><input type="checkbox" id="gf-drule" checked> Add associated filter rule</label>` : '') + `<button id="gf-dadd">＋</button></div>`;
  } else {
    body += `<h4>Phiên đang mở (stateful)</h4><table class="gf-t"><tr><th>Proto</th><th>Nguồn</th><th>Đích</th></tr>${(d.fw.conns || []).map((c) => `<tr><td>${c.proto}</td><td>${c.src}:${c.sport ?? 8}</td><td>${c.dst}:${c.dport ?? 0}</td></tr>`).join('') || '<tr><td colspan="3" class="gf-muted">(chưa có — thử ping/telnet từ máy trạm)</td></tr>'}</table>`;
    body += `<h4>Nhật ký thao tác</h4><pre class="gf-log">${esc((api.history || []).slice(-25).join('\n') || '(chưa có)')}</pre>`;
  }
  const pend = pending(d);
  el.className = `lab-gui gf-${v}`;
  el.innerHTML =
    `<div class="gf-top"><span class="gf-logo">${esc(V.name)}</span><span class="gf-dev">${esc(d.name)}</span>` +
    (V.commit ? `<button id="gf-commit" class="gf-commit${pend ? ' pend' : ''}">${v === 'checkpoint' ? '⬆ Install Policy' : '✔ Apply Changes'}</button>` : '<span class="gf-muted">Thay đổi có hiệu lực ngay</span>') + `</div>` +
    (pend ? `<div class="gf-banner">⚠ Có thay đổi CHƯA ${v === 'checkpoint' ? 'Install Policy' : 'Apply'} — firewall vẫn đang chạy cấu hình cũ.</div>` : '') +
    (api.lastErr ? `<div class="gf-err">${esc(api.lastErr)}</div>` : '') +
    `<div class="gf-wrap"><nav class="gf-nav">${tabs.map((t) => `<button data-tab="${esc(t)}" class="${t === tab ? 'on' : ''}">${esc(t)}</button>`).join('')}</nav><div class="gf-body">${body}</div></div>`;

  // ---------------------------------------------------------------- gắn sự kiện → lệnh thao tác
  const $ = (s) => el.querySelector(s);
  const vals = (id) => [...($(id)?.selectedOptions || [])].map((o) => o.value);
  const csv = (a) => (a.length ? a.map((x) => (x.includes(' ') ? `"${x}"` : x)).join(',') : 'any');
  const q = (x) => (/\s/.test(x) ? `"${x}"` : x);
  el.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => api.setTab(b.dataset.tab)));
  el.querySelectorAll('[data-rif]').forEach((b) => (b.onclick = () => api.setRuleIf(b.dataset.rif)));
  el.querySelectorAll('[data-saveif]').forEach((b) => (b.onclick = () => { const k = b.dataset.saveif; api.run(`if ${k} ip=${el.querySelector(`[data-ip="${k}"]`).value.trim()} zone=${el.querySelector(`[data-zone="${k}"]`).value}`); }));
  const on = (sel, fn) => { const x = $(sel); if (x) x.onclick = fn; };
  on('#gf-gw-save', () => api.run(`gw ${$('#gf-gw').value.trim()}`));
  on('#gf-oadd', () => api.run(`obj ${$('#gf-on').value.trim()} ${$('#gf-oa').value.trim()}`));
  on('#gf-sadd', () => api.run(`svc ${$('#gf-sn').value.trim()} ${$('#gf-sp').value} ${$('#gf-sport').value.trim()}`));
  on('#gf-commit', () => api.run(V.commit));
  on('#gf-radd', () => {
    const from = v === 'pfsense' ? (zones.includes(api.ruleIf) ? api.ruleIf : 'LAN') : csv(vals('#gf-rfrom').filter((x) => x !== 'any'));
    const parts = [`rule add ${q($('#gf-rn').value.trim() || 'rule-' + (C.rules.length + 1))}`];
    if (v !== 'checkpoint') parts.push(`from=${from}`, `to=${v === 'sophos' ? csv(vals('#gf-rto').filter((x) => x !== 'any')) : 'any'}`);
    parts.push(`src=${csv(vals('#gf-rsrc').filter((x) => x !== 'any'))}`, `dst=${csv(vals('#gf-rdst').filter((x) => x !== 'any'))}`, `svc=${csv(vals('#gf-rsvc').filter((x) => x !== 'any'))}`, `action=${$('#gf-ract').value}`);
    if ($('#gf-rnat')?.checked) parts.push('nat=masq');
    if ($('#gf-rpos').value === 'top') parts.push('pos=top');
    api.run(parts.join(' '), { keepAdd: true });
  });
  el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => api.run(`rule del ${q(b.dataset.del)}`)));
  el.querySelectorAll('[data-tog]').forEach((b) => (b.onclick = () => api.run(`rule toggle ${q(b.dataset.tog)}`)));
  el.querySelectorAll('[data-up],[data-down]').forEach((b) => (b.onclick = () => {
    const name = b.dataset.up || b.dataset.down;
    const i = C.rules.findIndex((r) => r.name === name);
    const j = b.dataset.up ? i - 1 : i + 1;
    if (j < 0 || j >= C.rules.length) return;
    api.run(`rule move ${q(name)} ${b.dataset.up ? 'before' : 'after'} ${q(C.rules[j].name)}`);
  }));
  el.querySelectorAll('[data-ndel]').forEach((b) => (b.onclick = () => api.run(`nat del ${q(b.dataset.ndel)}`)));
  el.querySelectorAll('[data-ob]').forEach((b) => (b.onclick = () => api.run(`outbound ${b.dataset.ob}`)));
  on('#gf-snadd', () => api.run(`nat add ${$('#gf-sn2').value.trim() || 'SNAT'} type=snat from=any to=${$('#gf-snto').value} src=${q($('#gf-snsrc').value)}`));
  on('#gf-dadd', () => {
    const parts = [`nat add ${$('#gf-dn').value.trim() || 'DNAT'} type=dnat ext=${$('#gf-dext').value.trim()} int=${$('#gf-dint').value}`];
    if ($('#gf-dpf').checked) parts.push(`proto=tcp ext_port=${$('#gf-dep').value.trim()} int_port=${$('#gf-dip').value.trim()}`);
    if ($('#gf-drule')?.checked) parts.push('rule=yes');
    api.run(parts.join(' '));
  });
}
