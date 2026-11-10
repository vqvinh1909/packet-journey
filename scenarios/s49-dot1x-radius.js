// scenarios/s49-dot1x-radius.js
// Kịch bản 49 (Bảo mật): 802.1X. Cổng switch chỉ mở sau khi người dùng được RADIUS xác thực.
// Máy trạm nói EAPOL với switch; switch gói EAP vào RADIUS gửi server; server trả Accept kèm VLAN.
// Đơn giản hoá: bỏ các vòng PEAP ở giữa, chỉ giữ gói đầu, một Challenge và gói cuối.

import { Sim } from '../engine/simulate.js';

const PC = { mac: '00:1a:2b:00:00:10' };
const SW = { mac: '00:1a:2b:00:0a:01', ip: '10.0.0.2' };
const SRV = { mac: '00:1a:2b:00:00:99', ip: '10.0.0.10' };
const PAE = '01:80:c2:00:00:03';
const USER = 'tung@corp.local';
const ascii = (s) => [...new TextEncoder().encode(s)];
const eapBytes = (code, id, type, data = '') => { const d = type ? [type, ...ascii(data)] : []; return [code, id, 0, 4 + d.length, ...d]; };

const LESSON = { path: '../Network security/Module-04_Bao-ve-ha-tang-Server-Network-Cloud/Bai-22_Phan-doan-mang-VLAN-NAC-802.1X.md', label: 'Bài 22 Security — VLAN, NAC, 802.1X' };

export const meta = {
  id: 's49-dot1x-radius',
  titleVi: '🔒 Bảo mật: 802.1X và RADIUS (xác thực trước khi vào mạng)',
  titleEn: 'Security: 802.1X with RADIUS',
  descriptionVi: 'Cắm dây chưa đủ để vào mạng: switch chỉ mở cổng khi RADIUS xác nhận người dùng, rồi gán VLAN theo người đó.',
  difficulty: 4,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 260',
    ports: false,
    devices: [
      { id: 'pc', type: 'host', name: 'Máy trạm (supplicant)', x: 150, y: 130, color: '#2c5f8a', lines: [USER] },
      { id: 'sw', type: 'switch', name: 'Switch (authenticator)', x: 500, y: 130, lines: [SW.ip] },
      { id: 'srv', type: 'host', name: 'RADIUS (ISE/NPS)', x: 850, y: 130, color: '#2e7d5b', lines: [SRV.ip, 'UDP 1812'] },
    ],
    links: [{ id: 'l1', a: 'pc', b: 'sw' }, { id: 'l2', a: 'sw', b: 'srv' }],
  };
  const sim = new Sim(topology);
  const eapol = (fromPc, f) => sim.frame([
    { proto: 'ethernet', fields: { dst: fromPc ? PAE : PC.mac, src: fromPc ? PC.mac : SW.mac, etherType: 0x888e } },
    { proto: 'eapol', fields: f },
  ]);
  const radius = (fromSw, f) => sim.frame([
    { proto: 'ethernet', fields: { dst: fromSw ? SRV.mac : SW.mac, src: fromSw ? SW.mac : SRV.mac, etherType: 0x0800 } },
    { proto: 'ipv4', fields: { src: fromSw ? SW.ip : SRV.ip, dst: fromSw ? SRV.ip : SW.ip, ttl: 64, id: 0x300 + f.code, protocol: 17 } },
    { proto: 'udp', fields: { srcPort: fromSw ? 49152 : 1812, dstPort: fromSw ? 1812 : 49152 } },
    { proto: 'radius', fields: f },
  ]);
  const port = (state, vlan) => ({ list: { title: 'Trạng thái cổng của máy trạm', cols: ['Mục', 'Giá trị'], rows: [['802.1X', state], ['VLAN', vlan], ['Lưu lượng được phép', state === 'Authorized' ? 'mọi lưu lượng của VLAN' : 'chỉ EAPOL']] } });
  const msgAuth = { t: 80, name: 'Message-Authenticator', val: Array.from({ length: 16 }, (_, i) => (i * 59 + 17) & 0xff), desc: 'Mã HMAC-MD5 tính bằng shared secret, chống sửa gói.' };

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'inspect', activeLayer: 2,
    titleVi: 'Vừa cắm dây: cổng ở trạng thái Unauthorized',
    tables: port('Unauthorized', 'chưa gán'),
    explanationVi: 'Với `dot1x port-control auto`, cổng chỉ cho EAPOL đi qua. DHCP, ARP, mọi thứ khác đều bị chặn cho tới khi xác thực xong. Ba vai: supplicant (máy trạm), authenticator (switch), authentication server (RADIUS).', lesson: LESSON });

  const start = eapol(true, { start: true });
  sim.capture(start, 'EAPOL-Start');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'sw', side: 'encap', activeLayer: 2,
    titleVi: 'Máy trạm gửi EAPOL-Start', packet: start,
    explanationVi: `EAPOL chạy thẳng trên Ethernet (EtherType 0x888e), không cần IP. MAC đích ${PAE} là địa chỉ nhóm mà switch không chuyển tiếp, nên gói chỉ tới switch nối trực tiếp.`, lesson: LESSON });

  const reqId = eapol(false, { code: 1, id: 1, type: 1 });
  sim.capture(reqId, 'EAP-Request/Identity');
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'pc', side: 'encap', activeLayer: 2,
    titleVi: 'Switch hỏi danh tính: EAP-Request/Identity', packet: reqId,
    explanationVi: 'Switch chỉ hỏi "bạn là ai". Nó không biết mật khẩu của ai cả.', lesson: LESSON });

  const respId = eapol(true, { code: 2, id: 1, type: 1, data: USER });
  sim.capture(respId, 'EAP-Response/Identity');
  sim.emit({ kind: 'transit', fromDevice: 'pc', toDevice: 'sw', side: 'encap', activeLayer: 2,
    titleVi: `Máy trạm khai danh tính: ${USER}`, packet: respId,
    decision: {
      question: 'Switch nhận danh tính. Ai là bên kiểm tra mật khẩu hoặc chứng chỉ?',
      options: ['Switch, bằng tài khoản local', 'RADIUS server; switch chỉ chuyển tiếp EAP', 'DHCP server', 'Máy trạm tự kiểm'],
      correct: 1,
      explainVi: 'Switch là người trung gian: gói EAP từ máy trạm được bọc vào RADIUS gửi lên server.',
    },
    explanationVi: 'Danh tính đi dạng rõ ở bước này. Mật khẩu thì không: nó sẽ đi trong một đường hầm TLS (PEAP) hoặc thay bằng chứng chỉ (EAP-TLS).', lesson: LESSON });

  const accReq = radius(true, { code: 1, id: 7, attrs: [
    { t: 1, name: 'User-Name', val: USER, desc: 'Danh tính người dùng.' },
    { t: 4, name: 'NAS-IP-Address', val: [10, 0, 0, 2], show: SW.ip, desc: 'IP của switch gửi yêu cầu. Server chỉ nhận từ NAS đã khai báo.' },
    { t: 31, name: 'Calling-Station-Id', val: '00-1A-2B-00-00-10', desc: 'MAC của máy trạm.' },
    { t: 79, name: 'EAP-Message', val: eapBytes(2, 1, 1, USER), desc: 'Nguyên bản tin EAP của máy trạm, switch không sửa.' },
    msgAuth,
  ] });
  sim.capture(accReq, 'RADIUS Access-Request');
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'srv', side: 'encap', activeLayer: 7,
    titleVi: 'Switch bọc EAP vào RADIUS Access-Request', packet: accReq,
    explanationVi: 'RADIUS dùng UDP 1812. Switch và server chia sẻ một shared secret; sai secret thì server lặng lẽ bỏ gói, và trên switch thấy RADIUS timeout.', lesson: LESSON });

  const chal = radius(false, { code: 11, id: 7, attrs: [
    { t: 79, name: 'EAP-Message', val: eapBytes(1, 2, 25), desc: 'EAP-Request loại PEAP: server đề nghị mở đường hầm TLS.' },
    { t: 24, name: 'State', val: [0x5e, 0xc0, 0x01, 0x07], desc: 'Mã phiên, switch gửi lại ở yêu cầu kế tiếp.' },
    msgAuth,
  ] });
  sim.capture(chal, 'RADIUS Access-Challenge');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: 'Server trả Access-Challenge: bắt đầu PEAP', packet: chal,
    explanationVi: 'Access-Challenge nghĩa là "chưa xong, hỏi tiếp". Switch gỡ EAP-Message ra và gửi cho máy trạm qua EAPOL.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'sw', side: 'forward', activeLayer: 2,
    titleVi: 'Nhiều vòng nữa: đường hầm TLS, rồi mật khẩu đi bên trong',
    overlay: { links: { l1: { cls: 'trunk', label: 'EAPOL' }, l2: { cls: 'trunk', label: 'RADIUS' } } },
    decision: {
      question: 'Trong PEAP, máy trạm phải kiểm gì trước khi gửi mật khẩu?',
      options: ['Tốc độ cổng', 'Chứng chỉ của RADIUS server', 'VLAN của cổng', 'MAC của switch'],
      correct: 1,
      explainVi: 'Nếu máy trạm không kiểm chứng chỉ server, kẻ tấn công dựng RADIUS giả là lấy được mật khẩu.',
    },
    explanationVi: 'Khoảng 8 đến 12 gói qua lại (không vẽ ở đây): server gửi chứng chỉ, hai bên dựng TLS, rồi mật khẩu được kiểm bằng MSCHAPv2 bên trong đường hầm. Switch chỉ chuyển tiếp, không đọc được nội dung.', lesson: LESSON });

  const accept = radius(false, { code: 2, id: 9, attrs: [
    { t: 79, name: 'EAP-Message', val: eapBytes(3, 9), desc: 'EAP-Success để switch chuyển cho máy trạm.' },
    { t: 64, name: 'Tunnel-Type', val: [0, 0, 0, 13], show: '13 (VLAN)', desc: 'Kiểu gán: VLAN.' },
    { t: 65, name: 'Tunnel-Medium-Type', val: [0, 0, 0, 6], show: '6 (802)', desc: 'Môi trường: IEEE 802.' },
    { t: 81, name: 'Tunnel-Private-Group-ID', val: '20', desc: 'Số VLAN gán cho người dùng này.' },
    msgAuth,
  ] });
  sim.capture(accept, 'RADIUS Access-Accept (kèm VLAN 20)');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'sw', side: 'encap', activeLayer: 7,
    titleVi: 'Server trả Access-Accept, kèm VLAN 20', packet: accept,
    decision: {
      question: 'Ba thuộc tính Tunnel-Type, Tunnel-Medium-Type, Tunnel-Private-Group-ID trong Access-Accept để làm gì?',
      options: ['Dựng VPN', 'Báo switch gán cổng vào VLAN 20 cho người dùng này', 'Đổi mật khẩu', 'Bật PoE'],
      correct: 1,
      explainVi: 'Đây là gán VLAN động: cùng một cổng, người dùng khác nhau vào VLAN khác nhau.',
    },
    explanationVi: 'Sai mật khẩu thì server trả Access-Reject, switch gửi EAP-Failure và cổng vẫn đóng (hoặc vào guest VLAN nếu có cấu hình).', lesson: LESSON });

  const ok = eapol(false, { code: 3, id: 9 });
  sim.capture(ok, 'EAP-Success');
  sim.emit({ kind: 'transit', fromDevice: 'sw', toDevice: 'pc', side: 'encap', activeLayer: 2,
    titleVi: 'Switch gửi EAP-Success và mở cổng', packet: ok,
    tables: port('Authorized', '20 (do RADIUS gán)'),
    explanationVi: 'Cổng chuyển sang Authorized. Giờ máy trạm mới xin được DHCP. Kiểm tra: `show authentication sessions interface <cổng> details`, `show dot1x all`. Thiết bị không có supplicant (máy in, camera) dùng MAB: switch gửi MAC làm danh tính.', lesson: LESSON });

  return sim.result();
}
