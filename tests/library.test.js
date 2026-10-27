// tests/library.test.js — 📚 thư viện lab theo thư mục (lab/labstore.js) và nhập/xuất .unl của EVE-NG (lab/unl.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../lab/labstore.js';
import * as U from '../lab/unl.js';
import * as S from '../lab/sandbox.js';
import * as N from '../lab/net.js';
import * as IO from '../lab/configio.js';
import { createCli, runScript } from '../lab/ios.js';

const cfg = (...l) => ['enable', 'configure terminal', ...l, 'end'];
const data = (n = 1) => ({ format: S.SANDBOX_FORMAT, version: 1, net: { devices: Object.fromEntries(Array.from({ length: n }, (_, i) => ['d' + i, {}])), links: [] } });

test('thư viện: lưu, ghi đè, trùng tên, thư mục, di chuyển, xoá thư mục đưa lab về gốc, gần đây', () => {
  let lib = L.emptyLib();
  let r = L.saveLab(lib, { name: 'OSPF tam giác', data: data(3), now: 1 });
  assert.ok(!r.error);
  lib = r.lib;
  const a = r.id;
  assert.equal(lib.labs[a].devices, 3);
  assert.match(L.saveLab(lib, { name: 'ospf  TAM giác', data: data() }).error, /Đã có lab/);
  r = L.saveLab(lib, { id: a, name: 'OSPF tam giác', data: data(5), now: 2 });
  assert.equal(r.id, a, 'ghi đè cùng id');
  lib = r.lib;
  assert.equal(lib.labs[a].devices, 5);
  assert.equal(lib.labs[a].created, 1);
  lib = L.addFolder(lib, 'CCNA').lib;
  assert.match(L.addFolder(lib, 'ccna').error, /Đã có thư mục/);
  const b = (r = L.saveLab(lib, { name: 'VLAN', folder: 'CCNA', data: data() })).id;
  lib = r.lib;
  assert.deepEqual(lib.recent, [b, a]);
  lib = L.moveLab(lib, a, 'CCNA').lib;
  assert.equal(lib.labs[a].folder, 'CCNA');
  lib = L.renameFolder(lib, 'CCNA', 'Ôn thi').lib;
  assert.equal(lib.labs[b].folder, 'Ôn thi');
  lib = L.saveLab(lib, { name: 'VLAN', data: data() }).lib; // trùng tên ở thư mục gốc
  lib = L.deleteFolder(lib, 'Ôn thi').lib;
  assert.deepEqual(lib.folders, [L.ROOT]);
  assert.deepEqual(L.tree(lib)[0].labs.map((x) => x.name), ['OSPF tam giác', 'VLAN', 'VLAN (2)']);
  assert.match(L.deleteFolder(lib, L.ROOT).error, /Không xoá/);
  lib = L.deleteLab(lib, a).lib;
  assert.ok(!lib.recent.includes(a));
  assert.deepEqual(L.normLib(JSON.parse(JSON.stringify(lib))), lib, 'lưu/đọc lại localStorage giữ nguyên');
  assert.deepEqual(L.normLib(null), L.emptyLib());
});

const UNL = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<lab name="CCNA &amp; OSPF" id="x-1" version="1" scripttimeout="300" lock="0">
  <topology>
    <nodes>
      <node id="1" name="R1" type="iol" template="iol" image="i86bi-linux-l3-adventerprisek9-15.5.2T.bin" ethernet="1" serial="1" left="300" top="150">
        <interface id="0" name="e0/0" type="ethernet" network_id="1"/>
        <interface id="1" name="e0/1" type="ethernet" network_id="3"/>
        <interface id="16" name="s1/0" type="serial" remote_id="2" remote_if="16"/>
      </node>
      <node id="2" name="R2" type="qemu" template="vios" image="vios-adventerprisek9-m.SPA.159-3.M6" ethernet="4" left="600" top="150">
        <interface id="0" name="Gi0/0" type="ethernet" network_id="2"/>
        <interface id="16" name="s1/0" type="serial" remote_id="1" remote_if="16"/>
      </node>
      <node id="3" name="PC 1" type="vpcs" template="vpcs" left="300" top="350"><interface id="0" name="eth0" network_id="1"/></node>
      <node id="4" name="SW1" type="iol" template="iol" image="i86bi_LinuxL2-AdvEnterpriseK9-M_152_May_2018.bin" ethernet="1" left="600" top="350">
        <interface id="0" name="e0/0" type="ethernet" network_id="2"/>
      </node>
      <node id="5" name="PC2" type="vpcs" template="vpcs" left="500" top="450"><interface id="0" name="eth0" network_id="2"/></node>
      <node id="6" name="NX" type="qemu" template="unknownthing" left="10" top="10"/>
    </nodes>
    <networks>
      <network id="1" type="bridge" name="Net-R1iface_0" left="300" top="250" visibility="0"/>
      <network id="2" type="bridge" name="LAN2" left="600" top="300" visibility="1"/>
      <network id="3" type="pnet0" name="Internet" left="200" top="60" visibility="1"/>
    </networks>
  </topology>
  <objects><configs><config id="1">aG9zdG5hbWUgUjEKaW50ZXJmYWNlIEV0aGVybmV0MC8wCiBpcCBhZGRyZXNzIDEwLjAuMC4xIDI1NS4yNTUuMjU1LjAKIG5vIHNodXRkb3du</config></configs></objects>
</lab>`;

test('.unl → workspace: template, tên, dây 2 đầu, bridge ≥3 đầu thành switch, pnet thành đám mây, serial, cấu hình', () => {
  const r = U.unlToSandbox(UNL);
  const n = r.net;
  assert.equal(r.name, 'CCNA & OSPF');
  const by = (nm) => Object.values(n.devices).find((d) => d.name === nm);
  assert.equal(S.kindOf(by('R1')), 'router');
  assert.equal(S.kindOf(by('R2')), 'router');
  assert.equal(S.kindOf(by('SW1')), 'sw2960');
  assert.equal(by('PC2').shell, 'vpcs');
  assert.ok(by('PC-1'), 'tên có dấu cách đổi thành PC-1');
  assert.ok(r.report.some((x) => /NX/.test(x)), 'node không hỗ trợ được báo');
  assert.ok(Object.values(n.devices).every((d) => d.off), 'thiết bị mới ở trạng thái tắt');
  const linked = (a, b) => n.links.some((l) => (n.devices[l.a].name === a && n.devices[l.b].name === b) || (n.devices[l.a].name === b && n.devices[l.b].name === a));
  assert.ok(linked('R1', 'PC-1'));
  assert.ok(linked('R1', 'R2'), 'serial IOL remote_id');
  assert.ok(n.links.some((l) => /^s/.test(l.ap) && /^s/.test(l.bp)));
  assert.ok(by('LAN2') && linked('LAN2', 'R2') && linked('LAN2', 'SW1') && linked('LAN2', 'PC2'), 'network 3 đầu → switch');
  assert.ok(N.isCloud(by('Internet')) && linked('R1', 'Internet'));
  assert.match(r.configText, /! ===== Thiết bị: R1 =====\ninterface GigabitEthernet0\/0\n ip address 10\.0\.0\.1/, 'Ethernet0/0 (IOL) đổi sang cổng app tương ứng');
  // nạp cấu hình qua configio (thiết bị đang tắt vẫn nạp được)
  const cli = createCli(n);
  const rep = U.applyUnlConfigs(n, cli, r.configText);
  assert.ok(rep.find((x) => x.name === 'R1').ok);
  assert.ok(by('R1').off, 'nạp xong vẫn tắt như EVE-NG');
  assert.ok(by('R1').startupCfg, 'cấu hình thành startup-config (Wipe quay về đây)');
  assert.equal(by('R1').ifaces['g0/0'].ip, '10.0.0.1', 'Ethernet0/0 của EVE → cổng đầu tiên g0/0');
  assert.throws(() => U.unlToSandbox('<html></html>'), /Không phải file \.unl/);
});

test('workspace → .unl → workspace: giữ thiết bị, dây (cả serial, đám mây) và cấu hình', () => {
  const net = S.emptySandbox();
  const r1 = S.addDevice(net, 'router', 100, 100), r2 = S.addDevice(net, 'router', 400, 100), sw = S.addDevice(net, 'sw2960', 100, 300);
  const pc = S.addDevice(net, 'pc', 100, 450), inet = S.addDevice(net, 'cloud', 400, 300), fg = S.addDevice(net, 'fortios', 600, 300);
  S.connect(net, r1, 's0/0/0', r2, 's0/0/0');
  S.connect(net, r1, 'g0/0', sw, 'fa0/1');
  S.connect(net, pc, 'fa0', sw, 'fa0/2');
  S.connect(net, r2, 'g0/0', inet, 'fa0');
  S.connect(net, r2, 'g0/1', fg, 'port1');
  const cli = createCli(net);
  runScript(cli, r1, cfg('interface s0/0/0', 'ip address 10.1.1.1 255.255.255.252', 'no shutdown'));
  const xml = U.sandboxToUnl(net, (id) => IO.deviceConfig(net, cli, id), 'Thử <xuất>');
  assert.match(xml, /<lab name="Thử &lt;xuất&gt;"/);
  assert.match(xml, /template="vios"/);
  assert.match(xml, /template="vpcs"/);
  assert.match(xml, /type="pnet0" name="INTERNET1"/);
  assert.match(xml, /type="serial" remote_id="2" remote_if="16"/);
  assert.match(xml, /<config id="1">/);
  const back = U.unlToSandbox(xml);
  const n = back.net;
  const names = Object.values(n.devices).map((d) => d.name).sort();
  assert.deepEqual(names, ['FGT1', 'INTERNET1', 'PC1', 'R1', 'R2', 'SW1']);
  assert.equal(n.links.length, 5);
  assert.ok(n.links.some((l) => /^s/.test(l.ap)), 'dây serial còn nguyên');
  const c2 = createCli(n);
  U.applyUnlConfigs(n, c2, back.configText);
  const R1 = Object.values(n.devices).find((d) => d.name === 'R1');
  assert.equal(R1.ifaces['s0/0/0'].ip, '10.1.1.1');
});

test('chú thích sơ đồ: thêm/sửa/xoá, làm sạch, đi theo xuất/nhập JSON và hoàn tác; file cũ không có chú thích vẫn mở được', () => {
  const net = S.emptySandbox();
  const h = S.createHistory();
  const a = h.track(net, () => S.addNote(net, 'rect', 100, 100, { text: 'DMZ' }));
  const b = h.track(net, () => S.addNote(net, 'arrow', 50, 50));
  assert.deepEqual(net.notes.map((n) => n.t), ['rect', 'arrow']);
  assert.equal(net.notes[1].x2, 190, 'mũi tên mặc định dài 140');
  h.track(net, () => S.updateNote(net, a, { color: 'red', w: 5, t: 'arrow' }));
  assert.equal(net.notes[0].color, 'red');
  assert.equal(net.notes[0].w, 20, 'kích thước tối thiểu');
  assert.equal(net.notes[0].t, 'rect', 'không đổi được loại');
  assert.ok(S.updateNote(net, a, { color: 'hồng' }) && net.notes[0].color === 'blue', 'màu lạ → mặc định');
  h.track(net, () => S.removeNote(net, b));
  assert.equal(net.notes.length, 1);
  h.undo(net);
  assert.equal(net.notes.length, 2, 'hoàn tác khôi phục chú thích');
  const back = S.importSandbox(JSON.parse(JSON.stringify(S.exportSandbox(net))));
  assert.deepEqual(back.notes, net.notes);
  assert.deepEqual(S.importSandbox({ devices: {}, links: [] }).notes, []);
  assert.deepEqual(S.normNotes([{ t: 'lạ' }, null, { t: 'text', x: 'abc' }]).map((n) => [n.t, n.x]), [['text', 100]]);
  assert.throws(() => S.addNote(net, 'circle', 0, 0), /không hợp lệ/);
});
