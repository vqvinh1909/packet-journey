// lab/diagnose.js — "🩺 Vì sao không ping được?": dò lỗi theo từng lớp như kỹ sư (L1 → L2 → L3 → lọc gói) và trả
// GỢI Ý mở dần (lớp nào → thiết bị nào → chi tiết) thay vì đưa đáp án ngay. Dựa trên chính engine mô phỏng
// (lineUp / resolve / sendPacket) nên khớp đúng điều Lab CLI chấm.
import * as N from './net.js';

const isHost = (d) => d.type === 'pc' || d.type === 'server';
const LAYER = {
  l1: 'Lớp 1 — cáp & cổng',
  host: 'Cấu hình IP của máy nguồn',
  l2: 'Lớp 2 — VLAN / trunk / switch',
  l3: 'Lớp 3 — định tuyến',
  filter: 'Lọc gói — ACL / firewall',
  nat: 'NAT',
  vpn: 'VPN / đường hầm',
  other: 'Khác',
};
const KIND_LAYER = { acl: 'filter', fw: 'filter', vacl: 'filter', dai: 'l2', ipsg: 'l2', nat: 'nat', noroute: 'l3', nogw: 'l3', loop: 'l3', ttl: 'l3', noip: 'host', tunnel: 'vpn', vpn: 'vpn', drop: 'l3', misdeliver: 'l3', arp: 'l2' };
const SHOW = {
  l1: 'show ip interface brief · show interfaces status',
  host: 'ipconfig (hoặc show ip trên VPCS)',
  l2: 'show vlan brief · show interfaces trunk · show mac address-table',
  l3: 'show ip route · show ip ospf neighbor',
  filter: 'show access-lists · show ip interface <cổng>',
  nat: 'show ip nat translations · show ip nat statistics',
  vpn: 'show crypto isakmp sa · show crypto ipsec sa · show interfaces tunnel',
  other: 'show running-config',
};

/** Thiết bị được nhắc tới trong câu lý do (tên dài trước để "R1" không khớp nhầm "R10"). */
function devInText(net, text) {
  const ds = Object.values(net.devices).sort((a, b) => b.name.length - a.name.length);
  return ds.find((d) => new RegExp(`(^|[^\\w-])${d.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w-]|$)`).test(text)) || null;
}

/**
 * Chẩn đoán ping từ thiết bị `src` (id) tới IP `dst`. Trả
 * { ok, steps: [{ layer, ok, text }] (các lớp đã kiểm), problem: null | { layer, layerName, dev, devName, show, detail, hints: [3 mức] } }.
 */
export function diagnose(net, src, dst) {
  const steps = [];
  const S = net.devices[src];
  if (!S) return { ok: false, steps, problem: mk('other', null, 'Thiết bị nguồn không tồn tại.') };
  const step = (layer, ok, text) => { steps.push({ layer, ok, text }); return ok; };
  function mk(layer, dev, detail) {
    const d = dev ? net.devices[dev] || dev : null;
    const devName = d?.name || null;
    return {
      layer, layerName: LAYER[layer], dev: d?.id || null, devName, show: SHOW[layer], detail,
      hints: [
        `Vấn đề nằm ở: ${LAYER[layer]}. Các lớp dưới nó đã ổn — tập trung kiểm tra lớp này.`,
        `${devName ? `Xem trên thiết bị ${devName}` : 'Kiểm tra dọc đường đi'}: ${SHOW[layer]}`,
        detail,
      ],
    };
  }
  if (!N.isL3(S) && !isHost(S)) return { ok: false, steps, problem: mk('other', S.id, `${S.name} không phải máy trạm/router — hãy ping từ PC, server hoặc router.`) };
  if (S.off) return { ok: false, steps, problem: mk('l1', S.id, `${S.name} đang tắt — chuột phải → Start.`) };

  if (isHost(S)) {
    // L1: cáp từ card mạng
    const l = N.linkAt(net, S.id, 'fa0');
    if (!l) { step('l1', false, `${S.name} chưa cắm dây`); return { ok: false, steps, problem: mk('l1', S.id, `${S.name} chưa cắm dây vào switch/router nào.`) }; }
    const peer = N.peerOf(l, S.id, 'fa0');
    peer.ifn = peer.port;
    const P = net.devices[peer.dev];
    if (!N.lineUp(net, S.id, 'fa0')) {
      const why = P.off ? `${P.name} đang tắt`
        : N.errDisabled(net, P, peer.ifn) ? `cổng ${N.longIf(peer.ifn)} của ${P.name} đang err-disabled (port-security / BPDU guard…) — xử lý nguyên nhân rồi shutdown → no shutdown`
        : `cổng ${N.longIf(peer.ifn)} của ${P.name} đang down (shutdown? hoặc lệch cấu hình hai đầu)`;
      step('l1', false, `Đường cáp ${S.name} ↔ ${P.name} không lên`);
      return { ok: false, steps, problem: mk('l1', P.id, `Đường cáp ${S.name} → ${P.name} ${N.longIf(peer.ifn)} không lên: ${why}.`) };
    }
    step('l1', true, `Cáp ${S.name} ↔ ${P.name} ${N.shortIf(peer.ifn)}: up`);
    // cấu hình IP của máy
    if (!S.ip || S.ip.startsWith('169.254')) { step('host', false, 'Máy chưa có IP hợp lệ'); return { ok: false, steps, problem: mk('host', S.id, S.dhcp ? `${S.name} xin DHCP không được (đang 169.254.x.x hoặc trống) — kiểm tra pool DHCP / ip helper-address trên gateway.` : `${S.name} chưa đặt IP.`) }; }
    const same = N.inNet(dst, N.netOf(S.ip, S.prefix), S.prefix);
    if (!same) {
      if (!S.gateway) { step('host', false, 'Thiếu default gateway'); return { ok: false, steps, problem: mk('host', S.id, `${dst} khác subnet ${N.netOf(S.ip, S.prefix)}/${S.prefix} của ${S.name} nhưng máy chưa có default gateway.`) }; }
      if (!N.inNet(S.gateway, N.netOf(S.ip, S.prefix), S.prefix)) { step('host', false, 'Gateway nằm ngoài subnet'); return { ok: false, steps, problem: mk('host', S.id, `Gateway ${S.gateway} không thuộc subnet ${N.netOf(S.ip, S.prefix)}/${S.prefix} của ${S.name} (sai IP, sai mask hoặc sai gateway).`) }; }
    }
    step('host', true, `IP ${S.ip}/${S.prefix}${same ? ` — ${dst} cùng subnet, gửi thẳng` : `, gateway ${S.gateway}`}`);
    // L2: tới được gateway (hoặc máy đích cùng subnet) không
    const target = same ? dst : S.gateway;
    const r = N.resolve(net, { dev: S.id, ifn: 'fa0' }, target);
    if (r.fail || !r.ep) {
      const detail = `${S.name} không tìm được MAC của ${target} (ARP không có trả lời) — ${r.diag?.length ? r.diag.join('; ') : 'thiết bị giữ IP này không cùng VLAN/miền quảng bá, hoặc cổng của nó down'}.`;
      step('l2', false, `ARP tới ${target} thất bại`);
      // thiết bị nên xem: thiết bị mạng được nhắc trong chẩn đoán lớp 2 của engine, không thì switch/router máy đang cắm vào
      const named = devInText(net, (r.diag || []).join(' '));
      return { ok: false, steps, problem: mk('l2', named && !isHost(named) ? named.id : P.id, detail) };
    }
    step('l2', true, `Lớp 2 tới ${target}: thông (ARP được trả lời)`);
  }

  // phần còn lại: cho gói đi thật qua engine (định tuyến, ACL, NAT, VPN, chiều về)
  const res = N.withoutClock(net, () => N.sendPacket(net, { src: S.id, dst }));
  if (res.ok) { step('l3', true, `Ping ${dst}: thành công cả hai chiều`); return { ok: true, steps, problem: null }; }
  const f = res.fail || {};
  const why = f.why || res.why || 'Gói bị hủy dọc đường.';
  let layer = KIND_LAYER[f.kind] || null;
  if (!layer) layer = /ACL|access-list|access-group|firewall|policy|deny/i.test(why) ? 'filter' : /NAT/i.test(why) ? 'nat' : /ARP|VLAN|trunk/i.test(why) ? 'l2' : /route|định tuyến|đường/i.test(why) ? 'l3' : 'other';
  step(layer, false, (res.replyLeg ? 'Chiều VỀ: ' : '') + why);
  const dev = f.dev || devInText(net, why)?.id || null;
  return { ok: false, steps, problem: mk(layer, dev, (res.replyLeg ? 'Gói đi tới đích được nhưng gói TRẢ LỜI bị hủy — kiểm tra đường về. ' : '') + why) };
}
