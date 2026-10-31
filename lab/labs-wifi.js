// lab/labs-wifi.js — nhóm "📶 Wi-Fi & WLC" (đề CCNA 200-301 mục 2.6–2.9): nối AP và WLC vào switch,
// tạo WLAN bằng giao diện web, QoS, 802.1X, kênh không chồng lấn. Topology, địa chỉ và tình huống tự thiết kế.

import * as N from './net.js';
import { cfg, quiz, ml3, B } from './kit.js';
import { wlcDevice, radiusServer, apJoined, clientTest, channelsClean, apConfig, rfStatus } from './wlc.js';

const LESSON_WLAN = `${B}Module-05_Remote-Access-va-Wireless/Bai-24_Wireless-LAN.md`;
const LESSON_WLC = `${B}Module-05_Remote-Access-va-Wireless/Bai-25_Cisco-Wireless-Controller.md`;
const STAFF_PSK = 'VanPhong@2026', GUEST_PSK = 'KhachTham@2026', SECRET = 'RadiusChung#26';

//  AP-1, AP-2 (VLAN 10) — CORE — WLC (trunk, native 99) ; RADIUS ở VLAN 40
function ap(id, name, x, ip) {
  const d = N.pc(id, name, x, 330, { ip, gw: '10.10.0.1' });
  d.isAp = true;
  return d;
}
const wifiNet = () => N.makeNet([
  ml3('core', 'CORE', 400, 150, ['fa0/1', 'fa0/2', 'g0/1', 'g0/2'], true),
  wlcDevice('wlc', 'WLC', 130, 150),
  radiusServer('rad', 'RADIUS', 670, 150, { ip: '10.40.0.50', gw: '10.40.0.1', secret: SECRET, users: { nv01: 'MatKhau-nv01' } }),
  ap('ap1', 'AP-1', 280, '10.10.0.11'),
  ap('ap2', 'AP-2', 520, '10.10.0.12'),
], [['core', 'g0/1', 'wlc', 'fa0'], ['core', 'g0/2', 'rad', 'fa0'], ['core', 'fa0/1', 'ap1', 'fa0'], ['core', 'fa0/2', 'ap2', 'fa0']]);

const svi = (v, ip) => [`vlan ${v}`, 'exit', `interface vlan ${v}`, `ip address ${ip} 255.255.255.0`, 'no shutdown', 'exit'];
const CORE_BASE = ['hostname CORE', ...svi(10, '10.10.0.1'), ...svi(20, '10.20.0.1'), ...svi(30, '10.30.0.1'), ...svi(40, '10.40.0.1'), ...svi(99, '10.99.0.1'), 'interface g0/2', 'switchport mode access', 'switchport access vlan 40', 'exit'];
const AP_PORTS = ['interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'exit', 'interface fa0/2', 'switchport mode access', 'switchport access vlan 10', 'exit'];
const trunk = (allowed) => ['interface g0/1', 'switchport trunk encapsulation dot1q', 'switchport mode trunk', 'switchport trunk native vlan 99', `switchport trunk allowed vlan ${allowed}`, 'exit'];
const MGMT = 'mgmt ip=10.99.0.10/24 gw=10.99.0.1';
const IF20 = 'if add vlan20 vlan=20 ip=10.20.0.5/24 gw=10.20.0.1', IF30 = 'if add vlan30 vlan=30 ip=10.30.0.5/24 gw=10.30.0.1';
const STAFF = `wlan add 1 ssid=NV-Office iface=vlan20 sec=wpa2-psk psk=${STAFF_PSK}`;
const STAFF_READY = [MGMT, IF20, STAFF, 'wlan on 1'];

const w = (a) => a.d('wlc');
const joinedAll = (a) => apJoined(a.net, w(a), 'ap1') && apJoined(a.net, w(a), 'ap2');
const staffOk = (a) => { const r = clientTest(a.net, w(a), { ssid: 'NV-Office', psk: STAFF_PSK }); return r.ok && r.vlan === 20; };
const wlanOf = (a, ssid) => Object.values(w(a).wlc.wlans).find((x) => x.ssid === ssid);
const accessIn = (a, p, v) => a.oper('core', p) === 'access' && a.d('core').ports[p].vlan === v;

export const WIFI_LABS = [
  {
    id: 'W01', group: 'wifi', lesson: 'Bài 25', lessonPath: LESSON_WLC, level: 2, kind: 'config',
    title: 'Dựng Wi-Fi nhân viên: nối AP và WLC vào switch, tạo WLAN WPA2-PSK',
    story: 'Văn phòng An Phát vừa lắp 2 AP và 1 WLC. Switch CORE đã có sẵn các VLAN và gateway, nhưng cổng nối AP và WLC chưa cấu hình. Hãy đưa 2 AP về VLAN 10, nối WLC bằng trunk, cấu hình quản trị trên WLC rồi phát SSID "NV-Office" (WPA2-PSK, mật khẩu ' + STAFF_PSK + ') cho nhân viên vào VLAN 20.',
    build: wifiNet,
    init: [['core', cfg(...CORE_BASE)]],
    guide: [
      { dev: 'core', title: '1. Cổng nối AP là access VLAN 10', why: 'AP chế độ Local gửi mọi dữ liệu Wi-Fi về WLC trong đường hầm CAPWAP, nên AP chỉ cần một VLAN. Các VLAN người dùng đi ở phía WLC.', cmds: AP_PORTS },
      { dev: 'core', title: '2. Cổng nối WLC là trunk, native VLAN 99', why: 'WLC đưa dữ liệu người dùng ra nhiều VLAN nên phải là trunk. Native VLAN 99 mang địa chỉ quản trị của WLC.', cmds: trunk('20,30,99') },
      { dev: 'wlc', raw: true, title: '3. Controller → Management interface', why: 'AP tìm WLC qua IP quản trị. Có IP và gateway đúng thì AP ở VLAN 10 mới tới được WLC ở VLAN 99 và join.', cmds: [MGMT] },
      { dev: 'wlc', raw: true, title: '4. Controller → Dynamic interface cho VLAN 20', why: 'Dynamic interface nối WLAN với một VLAN có dây. Không có nó thì máy khách không có đường ra.', cmds: [IF20] },
      { dev: 'wlc', raw: true, title: '5. WLANs → tạo WLAN rồi bật Status', why: 'WLAN mới tạo ở trạng thái Disabled, chưa bật thì SSID không được phát.', cmds: [STAFF, 'wlan on 1'] },
    ],
    tasks: [
      { text: 'Fa0/1 và Fa0/2 là access VLAN 10', verify: 'show vlan brief', check: (a) => accessIn(a, 'fa0/1', 10) && accessIn(a, 'fa0/2', 10) },
      { text: 'G0/1 nối WLC là trunk, native VLAN 99', verify: 'show interfaces trunk', check: (a) => a.oper('core', 'g0/1') === 'trunk' && a.d('core').ports['g0/1'].native === 99 },
      { text: 'Cả 2 AP đã join WLC', verify: 'WLC → Wireless', check: joinedAll },
      { text: 'WLAN "NV-Office" dùng WPA2-PSK và đang bật', verify: 'WLC → WLANs', check: (a) => { const x = wlanOf(a, 'NV-Office'); return !!x && x.enabled && x.sec === 'wpa2-psk'; } },
      { text: 'Máy khách vào NV-Office đúng mật khẩu thì ở VLAN 20', verify: 'WLC → Monitor → Kết nối', check: staffOk },
      quiz('AP chế độ Local nối vào switch bằng loại cổng nào?', ['Access: dữ liệu Wi-Fi đi trong CAPWAP về WLC', 'Trunk mang mọi VLAN người dùng', 'Routed port', 'EtherChannel bắt buộc'], 0),
    ],
    hints: ['Bấm tab thiết bị "WLC" để mở trang quản trị.', 'Nếu AP chưa join, kiểm tra VLAN của cổng AP, native VLAN của trunk và IP quản trị.', 'Sau khi tạo WLAN, nhớ bấm Bật.'],
  },
  {
    id: 'W02', group: 'wifi', lesson: 'Bài 25', lessonPath: LESSON_WLC, level: 2, kind: 'config',
    title: 'Wi-Fi khách: VLAN riêng, QoS thấp, cô lập máy khách',
    story: 'Wi-Fi nhân viên đã chạy. Giám đốc muốn thêm SSID "Khach-Tham" (WPA2-PSK, mật khẩu ' + GUEST_PSK + ') cho khách vào VLAN 30. Khách dùng QoS Bronze để không ảnh hưởng nhân viên, và máy khách không được thấy nhau. Trunk hiện chỉ cho phép VLAN 20 và 99.',
    build: wifiNet,
    init: [['core', cfg(...CORE_BASE, ...AP_PORTS, ...trunk('20,99'))], ['wlc', STAFF_READY]],
    guide: [
      { dev: 'core', title: '1. Thêm VLAN 30 vào trunk', why: 'WLC đưa dữ liệu khách ra VLAN 30, trunk không cho phép thì khách có Wi-Fi mà không có mạng.', cmds: ['interface g0/1', 'switchport trunk allowed vlan add 30', 'exit'] },
      { dev: 'wlc', raw: true, title: '2. Tạo dynamic interface VLAN 30', why: 'Tách khách sang VLAN riêng để firewall hoặc ACL kiểm soát được.', cmds: [IF30] },
      { dev: 'wlc', raw: true, title: '3. Tạo WLAN khách, QoS Bronze, cô lập, rồi bật', why: 'Bronze là mức nền nên nhường đường cho nhân viên. Cô lập máy khách chặn khách tấn công lẫn nhau.', cmds: [`wlan add 2 ssid=Khach-Tham iface=vlan30 sec=wpa2-psk psk=${GUEST_PSK} qos=bronze`, 'wlan set 2 isolation=yes', 'wlan on 2'] },
    ],
    tasks: [
      { text: 'Trunk G0/1 cho phép thêm VLAN 30', verify: 'show interfaces trunk', check: (a) => a.d('core').ports['g0/1'].allowed?.includes(30) },
      { text: 'WLAN "Khach-Tham" đang bật, QoS Bronze, cô lập máy khách', verify: 'WLC → WLANs', check: (a) => { const x = wlanOf(a, 'Khach-Tham'); return !!x && x.enabled && x.qos === 'bronze' && x.isolation; } },
      { text: 'Khách vào đúng VLAN 30', verify: 'WLC → Monitor → Kết nối', check: (a) => clientTest(a.net, w(a), { ssid: 'Khach-Tham', psk: GUEST_PSK }).vlan === 30 },
      { text: 'Sai mật khẩu thì không vào được', verify: 'WLC → Monitor → Kết nối', check: (a) => !!wlanOf(a, 'Khach-Tham') && clientTest(a.net, w(a), { ssid: 'Khach-Tham', psk: 'sai-mat-khau' }).step === 'auth' },
      { text: 'Nhân viên vẫn dùng bình thường ở VLAN 20', verify: 'WLC → Monitor → Kết nối', check: staffOk },
      quiz('Mức QoS nào của WLC dành cho thoại?', ['Platinum', 'Gold', 'Silver', 'Bronze'], 0, 'Platinum cho thoại, Gold cho video, Silver mặc định, Bronze cho nền.'),
    ],
    hints: ['Dùng "switchport trunk allowed vlan add 30" để không làm mất các VLAN đang có.', 'Cô lập máy khách là ô trong bảng WLANs.'],
  },
  {
    id: 'W03', group: 'wifi', lesson: 'Bài 24', lessonPath: LESSON_WLAN, level: 3, kind: 'config',
    title: 'WPA2-Enterprise với RADIUS và kênh không chồng lấn',
    story: 'Nhân viên nghỉ việc vẫn biết mật khẩu Wi-Fi chung. Hãy chuyển sang đăng nhập từng người: tạo SSID "NV-Secure" dùng WPA2-Enterprise với RADIUS 10.40.0.50 (shared secret ' + SECRET + ', tài khoản thử nv01 / MatKhau-nv01). Hai AP đang để cùng kênh gây nhiễu, hãy đặt AP-1 kênh 1, AP-2 kênh 6.',
    build: wifiNet,
    init: [['core', cfg(...CORE_BASE, ...AP_PORTS, ...trunk('20,30,99'))], ['wlc', [...STAFF_READY, 'ap ap1 channel=3', 'ap ap2 channel=3']]],
    guide: [
      { dev: 'wlc', raw: true, title: '1. Security → khai báo RADIUS', why: 'WLC là authenticator, chuyển yêu cầu đăng nhập cho RADIUS. Hai bên phải dùng chung shared secret.', cmds: [`radius add 10.40.0.50 secret=${SECRET}`] },
      { dev: 'wlc', raw: true, title: '2. WLANs → tạo WLAN 802.1X rồi bật', why: 'Mỗi người có tài khoản riêng, khoá tài khoản là cắt được quyền mà không phải đổi mật khẩu của cả công ty.', cmds: ['wlan add 3 ssid=NV-Secure iface=vlan20 sec=wpa2-ent radius=10.40.0.50', 'wlan on 3'] },
      { dev: 'wlc', raw: true, title: '3. Wireless → đặt kênh 1 và 6', why: 'Băng 2.4 GHz chỉ có 1, 6, 11 không chồng lấn. Hai AP gần nhau mà cùng kênh sẽ tranh nhau thời gian phát.', cmds: ['ap ap1 channel=1', 'ap ap2 channel=6'] },
    ],
    tasks: [
      { text: 'WLAN "NV-Secure" dùng WPA2-Enterprise và đang bật', verify: 'WLC → WLANs', check: (a) => { const x = wlanOf(a, 'NV-Secure'); return !!x && x.enabled && x.sec === 'wpa2-ent'; } },
      { text: 'nv01 đăng nhập được và vào VLAN 20', verify: 'WLC → Monitor → Kết nối', check: (a) => clientTest(a.net, w(a), { ssid: 'NV-Secure', user: 'nv01', pass: 'MatKhau-nv01' }).vlan === 20 },
      { text: 'Sai mật khẩu tài khoản thì bị RADIUS từ chối', verify: 'WLC → Monitor → Kết nối', check: (a) => /Access-Reject/.test(clientTest(a.net, w(a), { ssid: 'NV-Secure', user: 'nv01', pass: 'sai' }).why) },
      { text: 'AP-1 kênh 1, AP-2 kênh 6', verify: 'WLC → Wireless', check: (a) => apConfig(w(a), 'ap1').channel === 1 && apConfig(w(a), 'ap2').channel === 6 && channelsClean(a.net, w(a)) },
      quiz('Trong 802.1X, WLC giữ vai trò nào?', ['Authenticator', 'Supplicant', 'Authentication server', 'Certificate authority'], 0, 'Máy khách là supplicant, WLC là authenticator, RADIUS là authentication server.'),
    ],
    hints: ['Khai báo RADIUS trước, sau đó ô RADIUS khi tạo WLAN mới có lựa chọn.', 'Thử kết nối ở tab Monitor: điền SSID, tài khoản và mật khẩu tài khoản.'],
  },
  {
    id: 'W04', group: 'wifi', lesson: 'Bài 25', lessonPath: LESSON_WLC, level: 3, kind: 'ticket',
    title: 'Ticket: "Wi-Fi tầng 2 yếu, nhân viên kết nối được mà không có mạng"',
    story: '🎫 Sau đợt bảo trì: khu vực AP-2 không có sóng, SSID "NV-Office" lúc có lúc không, máy khách vào được lại không ra mạng, hai AP nhiễu nhau. Mật khẩu vẫn là ' + STAFF_PSK + ', nhân viên phải ở VLAN 20. Chỉ được xem nhật ký và thử kết nối để tìm từng lỗi.',
    build: wifiNet,
    init: [
      ['core', cfg(...CORE_BASE, 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'exit', 'interface fa0/2', 'switchport mode access', 'switchport access vlan 30', 'exit', ...trunk('30,99'))],
      ['wlc', [MGMT, IF20, IF30, `wlan add 1 ssid=NV-Office iface=vlan30 sec=wpa2-psk psk=${STAFF_PSK}`, 'ap ap1 channel=6', 'ap ap2 channel=7']],
    ],
    guide: [
      { dev: 'core', title: '1. AP-2 chưa join: cổng nằm sai VLAN', why: 'AP-2 có IP ở VLAN 10 nhưng Fa0/2 lại ở VLAN 30 nên không tới được gateway, cũng không tới được WLC.', cmds: ['interface fa0/2', 'switchport access vlan 10', 'exit'] },
      { dev: 'wlc', raw: true, title: '2. WLAN đang tắt và gắn nhầm VLAN', why: 'Bật Status để phát SSID. Interface phải là vlan20, gắn vlan30 thì nhân viên rơi vào mạng khách.', cmds: ['wlan set 1 iface=vlan20', 'wlan on 1'] },
      { dev: 'core', title: '3. Trunk thiếu VLAN 20', why: 'Xác thực thành công nhưng dữ liệu không qua được trunk, đúng triệu chứng "kết nối được mà không có mạng".', cmds: ['interface g0/1', 'switchport trunk allowed vlan add 20', 'exit'] },
      { dev: 'wlc', raw: true, title: '4. Kênh 6 và 7 chồng lấn', why: 'Kênh liền nhau ở 2.4 GHz chồng lấn phổ, phải dùng 1, 6, 11.', cmds: ['ap ap2 channel=11'] },
    ],
    tasks: [
      { text: 'Cả 2 AP đã join WLC', verify: 'WLC → Wireless', check: joinedAll },
      { text: 'NV-Office hoạt động, nhân viên vào VLAN 20', verify: 'WLC → Monitor → Kết nối', check: staffOk },
      { text: 'Hai AP dùng các kênh không chồng lấn 1, 6, 11', verify: 'WLC → Wireless', check: (a) => channelsClean(a.net, w(a)) },
      quiz('Máy khách đã xác thực Wi-Fi nhưng không có mạng, nên kiểm tra gì trước?', ['VLAN của WLAN trên trunk và gateway', 'Mật khẩu Wi-Fi', 'SSID có đang phát không', 'Kênh của AP'], 0, 'Mật khẩu và SSID đã qua vì xác thực thành công; lỗi còn lại ở đường có dây phía sau WLC.'),
    ],
    hints: ['Thử kết nối ở tab Monitor: thông báo cho biết lỗi ở bước AP, SSID, xác thực hay VLAN.', 'Có 4 lỗi, 2 lỗi nằm trên switch CORE.', 'Xem "show vlan brief" và "show interfaces trunk" trên CORE.'],
  },
  {
    id: 'W05', group: 'wifi', lesson: 'Bài 24', lessonPath: LESSON_WLAN, level: 2, kind: 'ticket',
    title: 'Ticket: Wi-Fi chập chờn giờ ăn trưa: đọc SNR, đổi băng và kênh',
    story: '🎫 Máy vẫn kết nối nhưng hay rớt, nhất là giờ ăn trưa. Khảo sát cho thấy công ty bên cạnh phát mạnh ở kênh 6, còn lò vi sóng trong bếp gây nhiễu cả băng 2.4 GHz. Vào WLC → Wireless, đọc RSSI, nhiễu và SNR rồi đổi kênh cho hai AP. Đích: SNR từ 25 dB trở lên ở cả hai AP. Mô hình RF ở đây là bản giản lược để thấy quan hệ giữa các đại lượng, số đo không lấy từ thiết bị thật.',
    build: () => { const net = wifiNet(); net.devices.wlc.wlc.rfEnv = [{ ch: 6, dbm: -55, src: 'Wi-Fi công ty bên cạnh' }, { ch: 'all24', dbm: -68, src: 'lò vi sóng' }]; return net; },
    init: [['core', cfg(...CORE_BASE, ...AP_PORTS, ...trunk('20,30,99'))], ['wlc', [...STAFF_READY, 'ap ap1 channel=6', 'ap ap2 channel=7']]],
    tasks: [
      { text: 'AP-1 và AP-2 đều ở băng 5 GHz', verify: 'WLC → Wireless', check: (a) => rfStatus(a.net, w(a)).every((x) => x.band === 5) },
      { text: 'Hai AP không dùng chung kênh', verify: 'WLC → Wireless', check: (a) => { const c = rfStatus(a.net, w(a)).map((x) => x.channel); return c[0] != null && c[0] !== c[1]; } },
      { text: 'SNR của cả hai AP từ 25 dB trở lên', verify: 'WLC → Wireless', check: (a) => rfStatus(a.net, w(a)).every((x) => x.snr >= 25) },
      quiz('RSSI -60 dBm, nhiễu nền -80 dBm. SNR là bao nhiêu?', ['20 dB', '-140 dB', '140 dB', '60 dB'], 0, 'SNR = RSSI - nhiễu = -60 - (-80) = 20 dB.'),
      quiz('So với 2.4 GHz, băng 5 GHz thế nào?', ['Nhiều kênh hơn, ít nhiễu hơn, nhưng đi gần và xuyên tường kém hơn', 'Đi xa hơn và xuyên tường tốt hơn', 'Chỉ có 3 kênh', 'Không dùng được WPA2'], 0),
      quiz('Nguồn nào gây nhiễu băng 2.4 GHz?', ['Lò vi sóng, Bluetooth, AP khác chồng kênh', 'Cáp quang', 'Switch PoE', 'Máy chủ DNS'], 0),
    ],
    guide: [
      { dev: 'wlc', raw: true, title: '1. Wireless → chuyển AP sang 5 GHz, mỗi AP một kênh', why: 'Lò vi sóng làm nhiễu cả băng 2.4 GHz, đổi kênh trong băng này vẫn dưới 25 dB. Hai AP gần nhau mà cùng kênh sẽ nhiễu lẫn nhau.', cmds: ['ap ap1 channel=36', 'ap ap2 channel=44'] },
    ],
    hints: ['Xem cột RSSI / nhiễu / SNR ở tab Wireless. Nhiễu ghi rõ nguồn gây ra.', 'Thử kênh 1 hoặc 11 trước: tránh được công ty bên cạnh nhưng vẫn dính lò vi sóng.', 'Kênh từ 36 trở lên là băng 5 GHz.'],
  },
];
