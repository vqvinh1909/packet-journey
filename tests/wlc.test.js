// tests/wlc.test.js — WLC giả lập (lab/wlc.js); từng lab Wi-Fi được chạy lời giải trong tests/lab.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCli } from '../lab/ios.js';
import { LABS, buildLab } from '../lab/labs.js';
import { clientTest } from '../lab/wlc.js';
import { deviceConfig, exportConfigs } from '../lab/configio.js';

const open = (id) => {
  const net = buildLab(LABS.find((l) => l.id === id)), cli = createCli(net);
  return { net, d: net.devices.wlc, run: (...l) => l.map((c) => cli.exec('wlc', c).out.join('\n')), core: (...l) => l.forEach((c) => cli.exec('core', c)) };
};

test('WLC: lỗi được báo đúng bước AP → SSID → xác thực → VLAN', () => {
  const { net, d, run, core } = open('W04');
  const psk = 'VanPhong@2026', test1 = () => clientTest(net, d, { ssid: 'NV-Office', psk });
  assert.equal(test1().step, 'ssid', 'WLAN mới tạo đang tắt');
  run('wlan on 1');
  assert.equal(clientTest(net, d, { ssid: 'NV-Office', psk: 'sai-mat-khau' }).step, 'auth');
  assert.equal(test1().vlan, 30, 'gắn nhầm vlan30 thì vào mạng khách');
  run('wlan set 1 iface=vlan20');
  assert.match(test1().why, /chưa cho phép VLAN 20/);
  core('enable', 'configure terminal', 'interface g0/1', 'switchport trunk allowed vlan add 20', 'end');
  assert.equal(test1().vlan, 20);
  core('enable', 'configure terminal', 'interface g0/1', 'shutdown', 'end');
  assert.equal(test1().step, 'ap', 'mất trunk thì AP mất WLC');
});

test('WLC: dữ liệu sai bị từ chối và không đổi cấu hình', () => {
  const { d, run } = open('W01');
  assert.match(run('mgmt ip=10.99.0.10 gw=10.99.0.1')[0], /^ERROR/);
  assert.match(run('wlan add 1 ssid=X iface=khong-co sec=open')[0], /^ERROR: interface/);
  run('if add v20 vlan=20 ip=10.20.0.5/24 gw=10.20.0.1');
  assert.match(run('wlan add 1 ssid=X iface=v20 sec=wpa2-psk psk=ngan')[0], /ít nhất 8 ký tự/);
  assert.match(run('wlan add 1 ssid=X iface=v20 sec=wpa2-ent radius=1.1.1.1')[0], /chưa khai báo RADIUS/);
  assert.deepEqual(d.wlc.wlans, {});
  run('wlan add 1 ssid="Co Dau Cach" iface=v20 sec=open');
  assert.equal(d.wlc.wlans[1].ssid, 'Co Dau Cach');
  assert.match(run('if del v20')[0], /đang được WLAN sử dụng/);
  assert.match(run('wlan set 1 qos=vang')[0], /^ERROR/);
  assert.equal(d.wlc.wlans[1].qos, 'silver');
});

test('WLC: 802.1X bỏ trống hoặc thiếu mật khẩu đều bị RADIUS từ chối', () => {
  const { net, d, run } = open('W03');
  run('radius add 10.40.0.50 secret=RadiusChung#26', 'wlan add 3 ssid=NV-Secure iface=vlan20 sec=wpa2-ent radius=10.40.0.50', 'wlan on 3');
  for (const cred of [{}, { user: 'khong-ai' }, { user: 'nv01' }, { user: 'nv01', pass: 'sai' }]) {
    assert.match(clientTest(net, d, { ssid: 'NV-Secure', ...cred }).why, /Access-Reject/, JSON.stringify(cred));
  }
  assert.equal(clientTest(net, d, { ssid: 'NV-Secure', user: 'nv01', pass: 'MatKhau-nv01' }).vlan, 20);
});

test('WLC: chưa xuất được dạng văn bản nên báo bỏ qua, không giả vờ là máy chủ thường', () => {
  const net = buildLab(LABS.find((l) => l.id === 'W01')), cli = createCli(net);
  assert.equal(deviceConfig(net, cli, 'wlc'), null);
  assert.ok(exportConfigs(net, cli).skipped.includes('WLC'));
});
