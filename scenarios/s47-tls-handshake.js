// scenarios/s47-tls-handshake.js
// Kịch bản 47 (Bảo mật): bắt tay TLS 1.3 khi mở một trang HTTPS.
// ClientHello và ServerHello đi dạng rõ để trao khoá Diffie-Hellman; từ đó trở đi mọi thứ được mã hoá.
// Đơn giản hoá: phần đã mã hoá là byte mẫu; server gửi các bản tin mã hoá trong một record.

import { Sim } from '../engine/simulate.js';

const CLI = { mac: '00:1a:2b:00:00:10', ip: '192.168.1.10', port: 51000 };
const SRV = { mac: '00:1a:2b:00:00:80', ip: '192.168.1.80', port: 443 };
const SNI = 'bank.example.vn';

const LESSON = { path: '../Network security/Module-01_Toan-canh-An-ninh-mang/Bai-06_Mat-ma-hoc-ung-dung.md', label: 'Bài 06 Security — Mật mã, TLS/HTTPS' };

export const meta = {
  id: 's47-tls-handshake',
  titleVi: '🔒 Bảo mật: bắt tay TLS 1.3 (HTTPS)',
  titleEn: 'Security: TLS 1.3 handshake (HTTPS)',
  descriptionVi: 'Trình duyệt và server thoả thuận khoá chung qua Diffie-Hellman, server chứng minh danh tính bằng chứng chỉ, rồi dữ liệu được mã hoá.',
  difficulty: 3,
  lesson: LESSON,
};

export function build() {
  const topology = {
    viewBox: '0 0 1000 260',
    devices: [
      { id: 'cli', type: 'host', name: 'Trình duyệt', x: 200, y: 130, color: '#2c5f8a', lines: [CLI.ip, `cổng ${CLI.port}`] },
      { id: 'srv', type: 'host', name: 'Web Server', x: 760, y: 130, color: '#2e7d5b', lines: [SNI, 'cổng 443 (HTTPS)'] },
    ],
    links: [{ id: 'l', a: 'cli', b: 'srv', labelMid: 'TCP 443' }],
  };
  const sim = new Sim(topology);
  // Số thứ tự TCP tăng đúng theo số byte TLS mỗi bên đã gửi.
  const next = { [CLI.ip]: 1001, [SRV.ip]: 5001 };
  const send = (from, to, tlsFields) => {
    const f = sim.frame([
      { proto: 'ethernet', fields: { dst: to.mac, src: from.mac, etherType: 0x0800 } },
      { proto: 'ipv4', fields: { src: from.ip, dst: to.ip, ttl: 64, id: 0x9100 + (next[from.ip] % 97), protocol: 6 } },
      { proto: 'tcp', fields: { srcPort: from.port, dstPort: to.port, seq: next[from.ip], ack: next[to.ip], flags: { psh: true, ack: true }, window: 64240 } },
      { proto: 'tls', fields: tlsFields },
    ]);
    next[from.ip] += f.bytes.length - 54;
    return f;
  };
  const view = (rows) => ({ list: { title: 'Người nghe lén trên đường truyền thấy gì', cols: ['Thông tin', 'Thấy được?'], rows } });

  sim.emit({ kind: 'process', atDevice: 'cli', side: 'inspect', activeLayer: 4,
    titleVi: 'Kết nối TCP tới cổng 443 đã mở xong',
    explanationVi: 'Bắt tay TCP 3 bước đã xong (xem kịch bản TCP 3-way handshake). TLS chạy bên trên TCP: nó thêm mã hoá, toàn vẹn và xác thực server.', lesson: LESSON });

  const ch = send(CLI, SRV, { hello: 'client', sni: SNI, suites: [0x1301, 0x1302, 0x1303] });
  sim.capture(ch, 'TLS ClientHello');
  sim.emit({ kind: 'transit', fromDevice: 'cli', toDevice: 'srv', side: 'encap', activeLayer: 6,
    titleVi: 'ClientHello: bộ mã hỗ trợ, khoá công khai tạm, tên miền (SNI)', packet: ch,
    decision: {
      question: 'ClientHello là gói đầu tiên, chưa có khoá chung. Tên miền trong SNI đi thế nào?',
      options: ['Đã mã hoá bằng khoá của server', 'Đi dạng rõ, ai nghe lén cũng đọc được', 'Được băm SHA-256', 'Không gửi tên miền'],
      correct: 1,
      explainVi: 'Chưa có khoá nên ClientHello đi dạng rõ. Vì vậy firewall lọc được web theo SNI mà không cần giải mã.',
    },
    explanationVi: 'Client gửi danh sách cipher suite, 32 byte ngẫu nhiên và key_share: khoá công khai X25519 tạm thời. Extension server_name cho server biết client muốn vào tên miền nào.', lesson: LESSON });

  const sh = send(SRV, CLI, { hello: 'server', suite: 0x1301 });
  sim.capture(sh, 'TLS ServerHello');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'cli', side: 'encap', activeLayer: 6,
    titleVi: 'ServerHello: chọn bộ mã, gửi khoá công khai tạm của server', packet: sh,
    decision: {
      question: 'Hai bên vừa trao khoá công khai tạm. Khoá chung dùng để mã hoá được tạo thế nào?',
      options: ['Client gửi khoá chung cho server', 'Mỗi bên tự tính từ khoá riêng của mình và khoá công khai của bên kia', 'Server gửi khoá chung trong chứng chỉ', 'Lấy từ mật khẩu người dùng'],
      correct: 1,
      explainVi: 'Đó là Diffie-Hellman. Khoá chung không bao giờ đi qua mạng, nên nghe lén cả hai gói Hello vẫn không tính ra được.',
    },
    explanationVi: 'Server chọn TLS_AES_128_GCM_SHA256 và gửi key_share của mình. Khoá tạm dùng một lần rồi bỏ: lộ khoá riêng của server sau này cũng không giải mã lại được phiên cũ (forward secrecy).', lesson: LESSON });

  const cert = send(SRV, CLI, { encrypted: 900, what: 'EncryptedExtensions, Certificate, CertificateVerify, Finished' });
  sim.capture(cert, 'TLS: Certificate + Finished (đã mã hoá)');
  sim.emit({ kind: 'transit', fromDevice: 'srv', toDevice: 'cli', side: 'encap', activeLayer: 6,
    titleVi: 'Server gửi chứng chỉ và chữ ký, đã mã hoá', packet: cert,
    explanationVi: 'Từ đây mọi record đều mã hoá. Bên trong có chứng chỉ của server, CertificateVerify (chữ ký bằng khoá riêng của server trên toàn bộ phần bắt tay) và Finished.', lesson: LESSON });

  sim.emit({ kind: 'process', atDevice: 'cli', side: 'inspect', activeLayer: 6,
    titleVi: 'Trình duyệt kiểm chứng chỉ',
    tables: { list: { title: 'Bốn điều trình duyệt kiểm', cols: ['Kiểm', 'Nếu sai'], rows: [
      ['Chuỗi chứng chỉ dẫn tới một CA được tin', 'Cảnh báo: bên phát hành không tin cậy'],
      [`Tên trong chứng chỉ khớp ${SNI}`, 'Cảnh báo: tên không khớp'],
      ['Còn hạn, chưa bị thu hồi', 'Cảnh báo: chứng chỉ hết hạn'],
      ['Chữ ký CertificateVerify đúng', 'Ngắt kết nối: server không có khoá riêng'],
    ] } },
    decision: {
      question: 'Kẻ tấn công dùng DNS spoofing dẫn bạn tới server của nó và gửi bản sao chứng chỉ thật. Vì sao vẫn thất bại?',
      options: ['Vì IP khác', 'Vì nó không có khoá riêng nên không tạo được chữ ký CertificateVerify', 'Vì chứng chỉ bị mã hoá', 'Vì cổng 443 bị chặn'],
      correct: 1,
      explainVi: 'Chứng chỉ là công khai, ai cũng sao chép được. Chỉ chủ thật mới có khoá riêng để ký.',
    },
    explanationVi: 'Mã hoá mà không xác thực thì vô nghĩa: bạn có thể đang mã hoá với kẻ tấn công. Chứng chỉ gắn khoá công khai với tên miền, do một CA ký.', lesson: LESSON });

  const fin = send(CLI, SRV, { encrypted: 53, what: 'Finished của client' });
  sim.capture(fin, 'TLS: Finished của client');
  sim.emit({ kind: 'transit', fromDevice: 'cli', toDevice: 'srv', side: 'encap', activeLayer: 6,
    titleVi: 'Client gửi Finished: bắt tay xong sau một vòng', packet: fin,
    explanationVi: 'Finished chứa mã kiểm trên toàn bộ phần bắt tay, nên nếu ai sửa gói Hello thì hai bên phát hiện. TLS 1.3 chỉ cần một vòng đi về; TLS 1.2 cần hai.', lesson: LESSON });

  const get = send(CLI, SRV, { encrypted: 120, what: 'yêu cầu HTTP GET /login' });
  sim.capture(get, 'HTTP GET trong TLS');
  sim.emit({ kind: 'transit', fromDevice: 'cli', toDevice: 'srv', side: 'encap', activeLayer: 7,
    titleVi: 'Dữ liệu HTTP đi trong TLS', packet: get,
    tables: view([['IP nguồn, IP đích, cổng 443', 'Có'], [`Tên miền (SNI): ${SNI}`, 'Có'], ['Kích thước và thời điểm gói', 'Có'], ['Đường dẫn /login, cookie, mật khẩu', 'Không'], ['Nội dung trang', 'Không']]),
    decision: {
      question: 'Trong Wireshark, gói này hiện gì?',
      options: ['GET /login HTTP/1.1', 'TLSv1.3 Application Data', 'Mật khẩu dạng rõ', 'Gói TCP rỗng'],
      correct: 1,
      explainVi: 'Wireshark chỉ thấy record TLS loại Application Data. Muốn xem nội dung cần khoá phiên (SSLKEYLOGFILE).',
    },
    explanationVi: 'Yêu cầu HTTP nằm trong record đã mã hoá. Kiểm tra từ dòng lệnh: `openssl s_client -connect bank.example.vn:443` hoặc `curl -v https://bank.example.vn`.', lesson: LESSON });

  return sim.result();
}
