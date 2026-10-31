// ui/wlc.js — trang quản trị web của WLC (lab/wlc.js). Mỗi nút sinh 1 lệnh thao tác gửi qua api.run(cmd).
import { esc } from './topo.js';
import { WLC_QOS, WLC_SEC, apConfig, rfStatus, WLC_CHANNELS, apJoined } from '../lab/wlc.js';

const TABS = ['Monitor', 'WLANs', 'Controller', 'Wireless', 'Security'];
const q = (x) => `"${String(x).trim().replace(/"/g, '')}"`; // lệnh dùng " để bọc giá trị nên giá trị không được chứa "

/** Vẽ trang WLC của thiết bị d vào el. api giống renderGuiFw, thêm api.net để xem AP. */
export function renderWlc(el, d, api) {
  const C = d.wlc, net = api.net;
  const tab = TABS.includes(api.tab) ? api.tab : TABS[0];
  const aps = Object.values(net.devices).filter((x) => x.isAp);
  const opt = (m, sel) => Object.entries(m).map(([k, v]) => `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const ifOpts = Object.keys(C.ifs).map((n) => `<option>${esc(n)}</option>`).join('');
  const radOpts = Object.keys(C.radius).map((n) => `<option>${esc(n)}</option>`).join('');
  let body = '';
  if (tab === 'Monitor') {
    body += `<h4>Tổng quan</h4><div class="gf-muted">AP đã join: ${aps.filter((a) => apJoined(net, d, a.id)).length}/${aps.length} · WLAN đang bật: ${Object.values(C.wlans).filter((w) => w.enabled).length}/${Object.keys(C.wlans).length}</div>`;
    body += `<h4>Thử kết nối bằng máy khách</h4><div class="gf-row"><input id="wc-ssid" placeholder="SSID"><input id="wc-psk" placeholder="Mật khẩu Wi-Fi"><input id="wc-user" placeholder="Tài khoản (802.1X)"><input id="wc-pass" placeholder="Mật khẩu tài khoản"><button id="wc-go" class="btn-accent">Kết nối</button></div>`;
    if (C.lastClient) body += `<div class="wc-res ${C.lastClient.ok ? 'ok' : 'bad'}">${C.lastClient.ok ? '✔' : '✖'} ${esc(C.lastClient.why)}</div>`;
  } else if (tab === 'WLANs') {
    body += `<h4>WLANs</h4><table class="gf-t"><tr><th>ID</th><th>SSID</th><th>Status</th><th>Bảo mật</th><th>Interface</th><th>QoS</th><th>Cô lập</th><th></th></tr>`;
    for (const w of Object.values(C.wlans)) body += `<tr><td>${w.id}</td><td>${esc(w.ssid)}</td><td><span class="gf-act ${w.enabled ? 'accept' : 'drop'}">${w.enabled ? 'Enabled' : 'Disabled'}</span></td><td>${esc(WLC_SEC[w.sec])}</td><td><select data-wif="${w.id}">${Object.keys(C.ifs).map((n) => `<option${n === w.iface ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></td><td><select data-wqos="${w.id}">${opt(WLC_QOS, w.qos)}</select></td><td><input type="checkbox" data-wiso="${w.id}"${w.isolation ? ' checked' : ''} aria-label="Cô lập máy khách WLAN ${w.id}"></td><td class="gf-btns"><button data-wtog="${w.id}" data-on="${w.enabled ? 1 : 0}">${w.enabled ? 'Tắt' : 'Bật'}</button><button data-wdel="${w.id}" title="Xoá">🗑</button></td></tr>`;
    body += `</table><details class="gf-add"${api.addOpen ? ' open' : ''}><summary>＋ Tạo WLAN mới</summary><div class="gf-form">` +
      `<label>ID <input id="wn-id" size="3" value="${Object.keys(C.wlans).length + 1}"></label><label>SSID <input id="wn-ssid"></label>` +
      `<label>Bảo mật <select id="wn-sec">${opt(WLC_SEC, 'wpa2-psk')}</select></label><label>Mật khẩu Wi-Fi <input id="wn-psk"></label>` +
      `<label>RADIUS <select id="wn-rad"><option value="">(không)</option>${radOpts}</select></label><label>Interface <select id="wn-if">${ifOpts}</select></label>` +
      `<label>QoS <select id="wn-qos">${opt(WLC_QOS, 'silver')}</select></label><button id="wn-add" class="btn-accent">Lưu WLAN</button></div></details>`;
  } else if (tab === 'Controller') {
    body += `<h4>Management interface</h4><div class="gf-row"><label>IP <input id="wm-ip" value="${d.ip ? `${esc(d.ip)}/${d.prefix}` : ''}" placeholder="a.b.c.d/nn"></label><label>Gateway <input id="wm-gw" value="${esc(d.gateway)}"></label><button id="wm-save">Lưu</button></div><div class="gf-muted">Quản trị và CAPWAP đi trên native VLAN của trunk.</div>`;
    body += `<h4>Dynamic interfaces</h4><table class="gf-t"><tr><th>Tên</th><th>VLAN</th><th>IP</th><th>Gateway</th><th></th></tr>${Object.values(C.ifs).map((f) => `<tr><td>${esc(f.name)}</td><td>${f.vlan}</td><td>${esc(f.ip)}/${f.prefix}</td><td>${esc(f.gw)}</td><td><button data-idel="${esc(f.name)}" title="Xoá">🗑</button></td></tr>`).join('') || '<tr><td colspan="5" class="gf-muted">(chưa có)</td></tr>'}</table>`;
    body += `<div class="gf-row"><input id="wi-n" placeholder="Tên (vd vlan20)"><input id="wi-v" size="5" placeholder="VLAN"><input id="wi-ip" placeholder="IP/nn"><input id="wi-gw" placeholder="Gateway"><button id="wi-add">＋ Thêm</button></div>`;
  } else if (tab === 'Wireless') {
    body += `<h4>Access Points</h4><table class="gf-t"><tr><th>AP</th><th>Trạng thái</th><th>Chế độ</th><th>Kênh</th><th>Phát (dBm)</th><th>RSSI / nhiễu / SNR</th></tr>`;
    const rf = rfStatus(net, d);
    for (const a of aps) {
      const c = apConfig(d, a.id);
      body += `<tr><td>${esc(a.name)}</td><td><span class="gf-act ${apJoined(net, d, a.id) ? 'accept' : 'drop'}">${apJoined(net, d, a.id) ? 'Joined' : 'Chưa join'}</span></td><td><select data-apm="${esc(a.id)}">${opt({ local: 'Local', flexconnect: 'FlexConnect' }, c.mode)}</select></td><td><select data-apc="${esc(a.id)}"><option value="">Chưa chọn</option>${WLC_CHANNELS.map((ch) => `<option${c.channel === ch ? ' selected' : ''}>${ch}</option>`).join('')}</select></td><td><select data-app="${esc(a.id)}">${[20, 17, 14, 11, 8, 5].map((p) => `<option${(c.power ?? 20) === p ? ' selected' : ''}>${p}</option>`).join('')}</select></td><td>${(() => { const x = rf.find((z) => z.ap === a.id); return x?.channel == null ? '-' : `${x.rssi} / ${x.noise} (${esc(x.by)}) / <b>${x.snr} dB</b>`; })()}</td></tr>`;
    }
    body += `</table><div class="gf-muted">Băng 2.4 GHz chỉ có 3 kênh không chồng lấn: 1, 6, 11. Kênh từ 36 trở lên là băng 5 GHz: nhiều kênh hơn, ít nhiễu hơn nhưng đi gần hơn. SNR nên từ 25 dB trở lên.</div>`;
  } else {
    body += `<h4>RADIUS Authentication Servers</h4><table class="gf-t"><tr><th>IP</th><th>Shared secret</th><th></th></tr>${Object.values(C.radius).map((r) => `<tr><td>${esc(r.ip)}</td><td>••••••</td><td><button data-rdel="${esc(r.ip)}" title="Xoá">🗑</button></td></tr>`).join('') || '<tr><td colspan="3" class="gf-muted">(chưa có)</td></tr>'}</table>`;
    body += `<div class="gf-row"><input id="wr-ip" placeholder="IP máy chủ"><input id="wr-s" placeholder="Shared secret"><button id="wr-add">＋ Thêm</button></div>`;
  }
  el.className = 'lab-gui gf-wlc';
  el.innerHTML = `<div class="gf-top"><span class="gf-logo">Wireless LAN Controller</span><span class="gf-dev">${esc(d.name)}</span><span class="gf-muted">Thay đổi có hiệu lực ngay</span></div>` +
    (api.lastErr ? `<div class="gf-err">${esc(api.lastErr)}</div>` : '') +
    `<div class="gf-wrap"><nav class="gf-nav">${TABS.map((t) => `<button data-tab="${t}" class="${t === tab ? 'on' : ''}">${t}</button>`).join('')}</nav><div class="gf-body">${body}</div></div>`;

  const $ = (s) => el.querySelector(s);
  const val = (s) => $(s).value.trim();
  const on = (s, fn) => { const x = $(s); if (x) x.onclick = fn; };
  const each = (s, ev, fn) => el.querySelectorAll(s).forEach((x) => { x[ev] = () => fn(x); });
  each('[data-tab]', 'onclick', (b) => api.setTab(b.dataset.tab));
  on('#wc-go', () => {
    const p = [`client ssid=${q(val('#wc-ssid'))}`];
    for (const [k, id] of [['psk', '#wc-psk'], ['user', '#wc-user'], ['pass', '#wc-pass']]) if (val(id)) p.push(`${k}=${q(val(id))}`);
    api.run(p.join(' '));
  });
  each('[data-wtog]', 'onclick', (b) => api.run(`wlan ${b.dataset.on === '1' ? 'off' : 'on'} ${b.dataset.wtog}`));
  each('[data-wdel]', 'onclick', (b) => api.run(`wlan del ${b.dataset.wdel}`));
  each('[data-wif]', 'onchange', (x) => api.run(`wlan set ${x.dataset.wif} iface=${q(x.value)}`));
  each('[data-wqos]', 'onchange', (x) => api.run(`wlan set ${x.dataset.wqos} qos=${x.value}`));
  each('[data-wiso]', 'onchange', (x) => api.run(`wlan set ${x.dataset.wiso} isolation=${x.checked ? 'yes' : 'no'}`));
  on('#wn-add', () => {
    const p = [`wlan add ${val('#wn-id')} ssid=${q(val('#wn-ssid'))} iface=${q(val('#wn-if'))} sec=${val('#wn-sec')} qos=${val('#wn-qos')}`];
    if (val('#wn-psk')) p.push(`psk=${q(val('#wn-psk'))}`);
    if (val('#wn-rad')) p.push(`radius=${val('#wn-rad')}`);
    api.run(p.join(' '), { keepAdd: true });
  });
  on('#wm-save', () => api.run(`mgmt ip=${val('#wm-ip')} gw=${val('#wm-gw')}`));
  on('#wi-add', () => api.run(`if add ${q(val('#wi-n'))} vlan=${val('#wi-v')} ip=${val('#wi-ip')} gw=${val('#wi-gw')}`));
  each('[data-idel]', 'onclick', (b) => api.run(`if del ${q(b.dataset.idel)}`));
  each('[data-apm]', 'onchange', (x) => api.run(`ap ${x.dataset.apm} mode=${x.value}`));
  each('[data-apc]', 'onchange', (x) => { if (x.value) api.run(`ap ${x.dataset.apc} channel=${x.value}`); });
  each('[data-app]', 'onchange', (x) => api.run(`ap ${x.dataset.app} power=${x.value}`));
  on('#wr-add', () => api.run(`radius add ${val('#wr-ip')} secret=${q(val('#wr-s'))}`));
  each('[data-rdel]', 'onclick', (b) => api.run(`radius del ${b.dataset.rdel}`));
}
