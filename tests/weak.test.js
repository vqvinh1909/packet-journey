// tests/weak.test.js — "📊 Điểm yếu" (lab/weak.js): gắn chủ đề, ghi lệnh sai/đúng, sự kiện lab, điểm theo chủ đề
// (gộp phá mạng + luyện subnet), lệnh sai nhiều nhất, gợi ý lab; và gợi ý cú pháp của CLI (cli.suggest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LABS, getLab, buildLab, solutionOf } from '../lab/labs.js';
import { createCli } from '../lab/ios.js';
import * as W from '../lab/weak.js';

test('mọi lab đều có ít nhất 1 chủ đề; trường topics được ưu tiên', () => {
  for (const l of LABS) assert.ok(W.labTopics(l).length >= 1, l.id + ' ' + l.title);
  assert.deepEqual(W.labTopics(getLab('T06')), ['Static']);
  assert.ok(W.labTopics(getLab('L10')).includes('OSPF'));
  assert.ok(W.labTopics(getLab('F01')).includes('Firewall'), 'nhóm sec → Firewall');
  assert.ok(W.labTopics(getLab('S01')).includes('Bảo mật L2'));
  for (const t of W.TOPIC_NAMES) assert.ok(LABS.some((l) => W.labTopics(l).includes(t)), 'có lab cho chủ đề ' + t);
});

test('chủ đề của lệnh', () => {
  const cases = { 'switchport trunk allowed vlan 10,20': 'VLAN/Trunk', 'spanning-tree portfast': 'STP', 'channel-group 1 mode active': 'EtherChannel', 'ip route 0.0.0.0 0.0.0.0 1.1.1.1': 'Static', 'router ospf 1': 'OSPF', 'network 10.0.0.0 0.0.0.255 area 0': 'OSPF', 'router eigrp 100': 'EIGRP', 'neighbor 2.2.2.2 remote-as 65001': 'BGP', 'access-list 10 deny host 10.1.1.5': 'ACL', 'ip access-group 10 out': 'ACL', 'ip nat inside': 'NAT', 'ip helper-address 10.0.0.1': 'DHCP', 'ip dhcp snooping trust': 'Bảo mật L2', 'switchport port-security maximum 2': 'Bảo mật L2', 'standby 1 ip 10.1.1.254': 'FHRP', 'ipv6 address 2001:db8::1/64': 'IPv6', 'zone security INSIDE': 'Firewall', 'crypto key generate rsa': 'Quản trị thiết bị', 'show ip ospf neighbor': 'OSPF', 'show vlan brief': 'VLAN/Trunk', 'no shutdown': 'Interface & L1' };
  for (const [c, t] of Object.entries(cases)) assert.equal(W.cmdTopic(c), t, c);
  assert.equal(W.cmdTopic('ip address 10.0.0.1 255.255.255.0'), null);
  assert.equal(W.cmdTopic('hostname R1'), null);
});

test('recordCmd: lệnh sai gộp theo lệnh, kèm gợi ý; lệnh đúng ghi theo mẫu + chế độ (nguồn cheat sheet)', () => {
  const lab = getLab('L04');
  let w = W.emptyWeak();
  const bad = { cmd: 'switchport trunk native 99', out: ["% Invalid input detected at '^' marker."], mode: 'if', lab, sug: [{ spec: 'switchport trunk native vlan <num>', mode: 'if' }] };
  w = W.recordCmd(w, bad);
  w = W.recordCmd(w, { ...bad, cmd: 'switchport  trunk native 99' });
  w = W.recordCmd(w, { cmd: 'vlan', out: ['% Incomplete command.'], mode: 'config', lab });
  w = W.recordCmd(w, { cmd: 'switchport mode trunk', out: [], spec: 'switchport mode {access|trunk}', mode: 'if', lab });
  w = W.recordCmd(w, { cmd: 'sw mo tr', out: [], spec: 'switchport mode {access|trunk}', mode: 'if', lab });
  w = W.recordCmd(w, { cmd: 'show vlan ?', out: [] });
  const top = W.topErrors(w);
  assert.equal(top[0].cmd, 'switchport trunk native 99');
  assert.equal(top[0].n, 2);
  assert.equal(top[0].kind, 'invalid');
  assert.equal(top[0].topic, 'VLAN/Trunk');
  assert.equal(top[0].sug[0].spec, 'switchport trunk native vlan <num>');
  assert.equal(top[1].kind, 'incomplete');
  assert.equal(w.cmds['if|switchport mode {access|trunk}'].n, 2);
  assert.equal(w.topics['VLAN/Trunk'].err, 3);
  assert.equal(w.topics['VLAN/Trunk'].ok, 2);
});

test('recordLab: gợi ý, lời giải, nhiệm vụ trượt, quiz, thời gian, xong chậm', () => {
  const lab = getLab('L10');
  let w = W.emptyWeak();
  w = W.recordLab(w, 'hint', lab);
  w = W.recordLab(w, 'sol', lab);
  w = W.recordLab(w, 'fail', lab, { tasks: lab.tasks.slice(0, 2) });
  w = W.recordLab(w, 'quiz', lab, { ok: false, task: { text: 'Câu hỏi về ACL' } });
  w = W.recordLab(w, 'time', lab, { secs: 5000 });
  w = W.recordLab(w, 'time', lab, { secs: 600 });
  w = W.recordLab(w, 'done', lab);
  w = W.recordLab(w, 'done', lab);
  const o = w.topics.OSPF;
  assert.equal(o.hint, 1); assert.equal(o.sol, 1); assert.ok(o.fail >= 1);
  assert.equal(o.done, 1, 'xong chỉ tính 1 lần');
  assert.equal(o.slow, 1, '4200 giây > độ khó × 15 phút');
  assert.equal(w.labs.L10.secs, 4200, 'mỗi lần cộng tối đa 1 giờ');
  assert.equal(w.topics.ACL.qbad, 1, 'quiz theo chủ đề của câu hỏi');
});

test('topicScores: nhiều lỗi → điểm thấp, nhiều lần đúng → điểm cao, thiếu dữ liệu → null; gộp phá mạng & subnet', () => {
  let w = W.emptyWeak();
  const ospf = getLab('L10'), vlan = getLab('L03');
  for (let i = 0; i < 6; i++) w = W.recordCmd(w, { cmd: 'router osp 1 x' + i, out: ['% Invalid input'], lab: ospf });
  w = W.recordLab(w, 'sol', ospf);
  for (let i = 0; i < 12; i++) w = W.recordCmd(w, { cmd: 'vlan 10', out: [], spec: 'vlan <vlist>', mode: 'config', lab: vlan });
  w = W.recordLab(w, 'done', vlan);
  const sc = W.topicScores(w, {
    subnet: { info: { n: 10, ok: 9, secs: 100 }, vlsm: { n: 4, ok: 1, secs: 400 } },
    breaks: [{ src: 'L13', revealed: true, hints: 2 }, { src: 'L17', revealed: false, hints: 0 }],
    labOf: getLab,
  });
  const by = Object.fromEntries(sc.map((s) => [s.topic, s]));
  assert.ok(by.OSPF.score < 20, 'OSPF ' + by.OSPF.score);
  assert.ok(by['VLAN/Trunk'].score > 80, 'VLAN ' + by['VLAN/Trunk'].score);
  assert.equal(by.BGP.score, null);
  assert.equal(by.Subnet.parts.snOk, 10);
  assert.ok(by.Subnet.score > 50 && by.Subnet.score < 80);
  assert.equal(by.ACL.parts.brkBad, 1, 'phá mạng L13 (ACL) xem đáp án');
  assert.equal(by.NAT.parts.brkOk, 1, 'phá mạng L17 (NAT) tự sửa');
  assert.equal(sc.length, W.TOPIC_NAMES.length);
});

test('recommend: 3–5 lab, chủ đề yếu nhất trước, ưu tiên lab chưa xong; breakLabFor chọn lab gài được lỗi', () => {
  let w = W.emptyWeak();
  for (let i = 0; i < 8; i++) w = W.recordCmd(w, { cmd: 'ip nat insid ' + i, out: ['% Invalid input'], lab: getLab('L17') });
  for (let i = 0; i < 20; i++) w = W.recordCmd(w, { cmd: 'router ospf 1', out: [], spec: 'router ospf <num>', mode: 'config', lab: getLab('L10') });
  const sc = W.topicScores(w);
  const rec = W.recommend(sc, LABS, { L17: true });
  assert.ok(rec.length >= 3 && rec.length <= 5);
  assert.equal(rec[0].topic, 'NAT');
  assert.notEqual(rec[0].id, 'L17', 'lab NAT chưa xong được ưu tiên');
  assert.ok(W.labTopics(getLab(rec[0].id)).includes('NAT'));
  assert.match(rec[0].why, /NAT đang \d+\/100/);
  assert.equal(new Set(rec.map((r) => r.id)).size, rec.length);
  // chưa có dữ liệu: vẫn gợi ý (chủ đề chưa luyện)
  assert.ok(W.recommend(W.topicScores(W.emptyWeak()), LABS).length >= 3);
  const id = W.breakLabFor('NAT', LABS, { L18: true }, (l) => solutionOf(l).length > 0);
  assert.equal(id, 'L18');
});

test('cli.suggest: gợi ý cú pháp đúng (sai từ khoá, sai chính tả, sai chế độ) + exec trả spec', () => {
  const net = buildLab(getLab('L04'));
  const cli = createCli(net);
  const sw = Object.keys(net.devices).find((k) => net.devices[k].type === 'switch');
  cli.exec(sw, 'enable'); cli.exec(sw, 'configure terminal');
  assert.equal(cli.suggest(sw, 'swithport mode trunk')[0].spec, 'switchport mode {access|trunk}', 'sai chính tả từ đầu');
  const wrongMode = cli.suggest(sw, 'switchport mode trunk')[0];
  assert.equal(wrongMode.mode, 'if'); assert.equal(wrongMode.here, false, 'lệnh cổng gõ ở (config)#');
  cli.exec(sw, 'interface g0/1');
  assert.equal(cli.suggest(sw, 'switchport trunk native 99')[0].spec, 'switchport trunk native vlan <num>');
  assert.equal(cli.exec(sw, 'switchport mode trunk').spec, 'switchport mode {access|trunk}');
  assert.equal(cli.exec(sw, 'switchport trunk nat 99').spec, undefined);
  const r1 = Object.keys(net.devices).find((k) => net.devices[k].type === 'pc');
  assert.deepEqual(cli.suggest(r1, 'ipconfig'), []);
});
