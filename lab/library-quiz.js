// lab/library-quiz.js — bài tập và quiz cho chặng "thư viện giáo trình" của Lộ trình.
// Wireshark: câu hỏi kèm danh sách gói kiểu Wireshark, dựng từ gói thật của các kịch bản.
// Các mảng khác (Linux, Windows...): quiz ôn lý thuyết, vì app không mô phỏng được các hệ thống đó.
// Câu tĩnh: [câu hỏi, 4 lựa chọn (đáp án đúng ở vị trí 0), giải thích]. libQuiz xáo thứ tự câu và lựa chọn.

import { SCENARIOS } from '../scenarios/index.js';
import { flattenFields } from '../packet/serialize.js';
import { MORE } from './library-bank.js';
import { MORE2 } from './library-bank2.js';

const num = (s) => String(s ?? '').split(' ')[0];
const tail = (s) => String(s ?? '').split(/ — | \(/)[1]?.replace(')', '') ?? String(s ?? '');

// Wireshark in cờ TCP theo thứ tự FIN, SYN, RST, PSH, ACK.
const ORDER = ['FIN', 'SYN', 'RST', 'PSH', 'ACK', 'URG'];
const flags = (s) => tail(s).split(', ').sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join(', ');

/** Danh sách gói của một kịch bản: [{ no, src, dst, proto, info, f }], mỗi khung một dòng (bỏ bản lặp trên chặng kế). */
export function packetList(short) {
  const seen = new Set(), rows = [];
  for (const e of SCENARIOS.find((s) => s.meta.id.startsWith(short)).build().events) {
    if (!e.packet) continue;
    const f = {}, vids = [];
    for (const x of flattenFields(e.packet.tree)) { if (x.name === 'dot1q.vid') vids.push(x.display); f[x.name] ??= String(x.display); }
    let proto, info;
    if (f['radius.code']) [proto, info] = ['RADIUS', tail(f['radius.code'])];
    else if (f['ike.exch']) [proto, info] = ['ISAKMP', `${tail(f['ike.exch'])} ${tail(f['ike.flags'])}`];
    else if (f['tls.ctype']) [proto, info] = ['TLSv1.3', f['tls.htype'] ? tail(f['tls.htype']).replace(/(Client|Server)Hello/, '$1 Hello') : 'Application Data'];
    else if (f['dns.id']) [proto, info] = ['DNS', /Query/.test(f['dns.flags']) ? `Standard query ${f['dns.id']} A ${f['dns.qname']}` : `Standard query response ${f['dns.id']} A ${f['dns.qname']} A ${f['dns.ans0.rdata']}`];
    else if (f['dhcp.opt53']) [proto, info] = ['DHCP', `DHCP ${tail(f['dhcp.opt53'])}`];
    else if (f['esp.spi']) [proto, info] = ['ESP', `ESP (SPI=${f['esp.spi']})`];
    else if (f['eapol.ptype']) [proto, info] = ['EAPOL', f['eapol.code'] ? `${tail(f['eapol.code'])}${f['eapol.type'] ? ', ' + tail(f['eapol.type']) : ''}` : tail(f['eapol.ptype'])];
    else if (f['tcp.flags']) [proto, info] = ['TCP', `${num(f['tcp.src'])} → ${num(f['tcp.dst'])} [${flags(f['tcp.flags'])}] Seq=${f['tcp.seq']} Ack=${f['tcp.ack']}`];
    else if (f['icmp.type']) [proto, info] = ['ICMP', `${tail(f['icmp.type'])}, ttl=${f['ip.ttl']}`];
    else if (f['arp.oper']) [proto, info] = ['ARP', /^2/.test(f['arp.oper']) ? `${f['arp.spa']} is at ${f['arp.sha']}` : `Who has ${f['arp.tpa']}? Tell ${f['arp.spa']}`];
    else [proto, info] = ['Ethernet', ''];
    if (vids.length) info += ` [802.1Q VLAN ${vids.join(', VLAN ')}]`;
    const src = f['ip.src'] || f['eth.src'], dst = f['ip.dst'] || f['eth.dst'], key = `${src}|${dst}|${info}`;
    if (seen.has(key)) continue; // cùng một gói nhìn ở chặng kế: Wireshark tại một điểm bắt chỉ thấy một lần
    seen.add(key);
    rows.push({ no: rows.length + 1, src, dst, proto, info, f });
  }
  return rows;
}

// Bài tập Wireshark. `pick(rows)` trả về dòng đúng: người học chọn số gói. Không có `pick` thì là câu chọn chữ như thường.
const WS = [
  { sc: 's41', q: 'Gói nào là dấu hiệu ARP spoofing: IP của gateway 192.168.1.1 được khai với một MAC lạ, gửi tới PC?', pick: (r) => r.find((x) => x.proto === 'ARP' && x.f['arp.spa'] === '192.168.1.1'), ex: 'ARP Reply không ai hỏi, Sender IP là gateway nhưng Sender MAC là 00:de:ad:00:00:66. Wireshark thường cảnh báo "duplicate use of IP detected".' },
  { sc: 's41', q: 'Bộ lọc hiển thị nào chỉ giữ các gói ARP Reply?', o: ['arp.opcode == 2', 'arp.reply', 'eth.type == arp', 'arp && icmp'], ex: 'Opcode 1 là Request, 2 là Reply.' },
  { sc: 's41', q: 'Hai gói ICMP có cùng IP nguồn và đích. Điều gì cho thấy gói sau đã đi qua một máy trung gian?', o: ['TTL giảm 1 (và MAC nguồn đổi)', 'IP nguồn đổi', 'ICMP type đổi', 'Kích thước gói tăng'], ex: 'Máy đứng giữa chuyển tiếp như một router nên TTL từ 64 còn 63.' },
  { sc: 's42', q: 'Gói nào là OFFER của DHCP server giả?', pick: (r) => r.find((x) => /OFFER/.test(x.info)), ex: 'Mở gói này, xem Option 3 (Router) và Option 6 (DNS): cả hai là 192.168.1.66 thay vì gateway thật.' },
  { sc: 's42', q: 'Bộ lọc hiển thị nào giữ mọi gói DHCP trong Wireshark bản mới?', o: ['dhcp', 'udp.port == 53', 'ip.proto == dhcp', 'arp'], ex: 'Bản cũ dùng `bootp`. Cũng có thể lọc `udp.port == 67 || udp.port == 68`.' },
  { sc: 's44', q: 'Gói nào là SYN-ACK của server gửi tới IP giả (không bao giờ có ACK trả lời)?', pick: (r) => r.find((x) => /SYN, ACK/.test(x.info)), ex: 'Trong vụ SYN flood thật, bạn thấy rất nhiều SYN từ các IP khác nhau và SYN-ACK bị gửi lại nhiều lần.' },
  { sc: 's44', q: 'Bộ lọc nào chỉ giữ gói SYN mở kết nối (không lấy SYN-ACK)?', o: ['tcp.flags.syn == 1 && tcp.flags.ack == 0', 'tcp.flags.syn == 1', 'tcp.port == 443', 'tcp.flags.reset == 1'], ex: 'SYN-ACK cũng có bit SYN, nên phải thêm điều kiện ACK = 0.' },
  { sc: 's45', q: 'Gói trả lời DNS có IP nguồn là resolver 192.168.1.53. Xem trường nào ở tầng 2 để biết nó thật ra đến từ máy khác?', o: ['MAC nguồn của khung Ethernet', 'Cổng UDP đích', 'Transaction ID', 'TTL của IP'], ex: 'IP nguồn giả được, nhưng khung đi ra từ card mạng của kẻ tấn công nên MAC nguồn là 00:de:ad:00:00:66.' },
  { sc: 's45', q: 'Bộ lọc nào chỉ giữ các gói trả lời DNS?', o: ['dns.flags.response == 1', 'dns.qry.name', 'udp.port == 67', 'dns.id == 0'], ex: 'Bit QR = 1 là trả lời. Thêm `&& dns.qry.name == "bank.example.vn"` để lọc theo tên.' },
  { sc: 's46', q: 'Gói nào mang hai nhãn 802.1Q?', pick: (r) => r.find((x) => /VLAN 1, VLAN 20/.test(x.info)), ex: 'Khung thường có nhiều nhất một nhãn. Hai nhãn liền nhau từ cổng access là dấu hiệu VLAN hopping.' },
  { sc: 's47', q: 'Muốn biết người dùng vào tên miền nào trong phiên HTTPS này, mở gói nào?', pick: (r) => r.find((x) => x.info === 'Client Hello'), ex: 'Tên miền nằm trong extension server_name (SNI) của Client Hello, không mã hoá.' },
  { sc: 's47', q: 'Bộ lọc nào chỉ giữ gói Client Hello?', o: ['tls.handshake.type == 1', 'tls.record.version == 1', 'tcp.port == 80', 'http.request'], ex: 'Handshake type 1 = Client Hello, 2 = Server Hello.' },
  { sc: 's47', q: 'Vì sao các gói sau Server Hello chỉ hiện "Application Data" dù bên trong có chứng chỉ?', o: ['TLS 1.3 mã hoá phần bắt tay còn lại', 'Wireshark bị lỗi', 'Server không gửi chứng chỉ', 'Gói bị phân mảnh'], ex: 'Muốn xem bên trong cần khoá phiên: đặt biến SSLKEYLOGFILE cho trình duyệt rồi khai file đó trong Wireshark.' },
  { sc: 's14', q: 'Gói nào là bước 2 của bắt tay TCP?', pick: (r) => r.find((x) => /SYN, ACK/.test(x.info)), ex: 'SYN, rồi SYN-ACK, rồi ACK. Ack của bước 2 bằng Seq của SYN cộng 1.' },
  { sc: 's48', q: 'Gói nào là dữ liệu người dùng đã được mã hoá trong đường hầm?', pick: (r) => r.find((x) => x.proto === 'ESP'), ex: 'Wireshark chỉ thấy SPI và Sequence. IP nguồn và đích là của hai router, không phải của hai PC.' },
  { sc: 's48', q: 'Wireshark gọi IKE bằng tên giao thức nào trong bộ lọc?', o: ['isakmp', 'ike2', 'ipsec', 'esp'], ex: 'Lọc `isakmp` hoặc `udp.port == 500`. Dữ liệu sau đó lọc bằng `esp`.' },
  { sc: 's49', q: 'Gói nào cho biết người dùng được chấp nhận và vào VLAN nào?', pick: (r) => r.find((x) => x.info === 'Access-Accept'), ex: 'Xem các thuộc tính Tunnel-Type, Tunnel-Medium-Type và Tunnel-Private-Group-ID trong Access-Accept.' },
  { sc: 's49', q: 'Bắt gói trên cổng nối máy trạm với switch thì thấy giao thức nào của 802.1X?', o: ['EAPOL', 'RADIUS', 'TACACS+', 'LDAP'], ex: 'EAPOL chỉ đi giữa máy trạm và switch. RADIUS chỉ thấy khi bắt gói trên đường switch tới server.' },
  { q: 'Bộ lọc nào là capture filter (cú pháp BPF), dùng trước khi bắt gói?', o: ['host 10.1.1.1 and port 443', 'ip.addr == 10.1.1.1', 'tcp.port == 443', 'http.request.method == "GET"'], ex: 'Capture filter quyết định gói nào được lưu. Display filter chỉ ẩn hiện gói đã bắt.' },
  { q: 'Bộ lọc `ip.addr == 10.1.1.1` giữ những gói nào?', o: ['Gói có IP nguồn hoặc IP đích là 10.1.1.1', 'Chỉ gói có IP nguồn 10.1.1.1', 'Chỉ gói có IP đích 10.1.1.1', 'Gói trong cả mạng 10.1.1.0/24'], ex: 'Chỉ nguồn: `ip.src`. Chỉ đích: `ip.dst`.' },
  { q: 'Muốn xem trọn một phiên TCP dưới dạng văn bản thì dùng gì?', o: ['Follow → TCP Stream', 'Statistics → Protocol Hierarchy', 'Edit → Mark Packet', 'View → Coloring Rules'], ex: 'Follow TCP Stream ghép payload hai chiều và tự đặt bộ lọc `tcp.stream eq N`.' },
  { q: 'Số Seq và Ack trong Wireshark thường bắt đầu từ 0 hoặc 1. Vì sao?', o: ['Wireshark hiện số tương đối cho dễ đọc', 'TCP luôn bắt đầu từ 0', 'Gói bị lỗi', 'Do NAT'], ex: 'Số thật là ngẫu nhiên 32 bit. Tắt "Relative sequence numbers" trong tuỳ chọn TCP để xem số thật.' },
];

const Q = {
  Linux: [
    ['Lệnh nào xem các cổng đang lắng nghe kèm tên tiến trình?', ['ss -tulpn', 'ls -la', 'df -h', 'uname -a'], '`ss` thay cho `netstat`. -t TCP, -u UDP, -l đang nghe, -p tiến trình, -n không đổi số thành tên.'],
    ['Quyền `chmod 640 file` nghĩa là gì?', ['Chủ đọc ghi, nhóm đọc, người khác không có quyền', 'Mọi người đọc ghi', 'Chủ toàn quyền, nhóm ghi', 'Chỉ root đọc được'], '6 = rw-, 4 = r--, 0 = ---.'],
    ['Lệnh nào bật một dịch vụ ngay và cho tự chạy khi khởi động?', ['systemctl enable --now nginx', 'systemctl status nginx', 'service nginx reload', 'journalctl -u nginx'], '`enable` cho tự khởi động, `--now` chạy luôn.'],
    ['Xem log của một dịch vụ systemd theo thời gian thực?', ['journalctl -u sshd -f', 'cat /etc/passwd', 'top', 'dmesg -c'], '-u chọn unit, -f theo dõi liên tục.'],
    ['File nào khai báo máy chủ DNS mà hệ thống dùng?', ['/etc/resolv.conf', '/etc/hosts.allow', '/etc/fstab', '/etc/shadow'], '`/etc/hosts` là bảng tên tĩnh, được tra trước DNS theo mặc định.'],
    ['Cách đăng nhập SSH an toàn hơn mật khẩu?', ['Dùng cặp khoá và tắt PasswordAuthentication', 'Đổi cổng sang 2222', 'Cho root đăng nhập trực tiếp', 'Dùng Telnet trong mạng nội bộ'], 'Đổi cổng chỉ giảm nhiễu. Khoá công khai mới chống được dò mật khẩu.'],
    ['Ổ đĩa đầy. Lệnh nào tìm thư mục chiếm nhiều chỗ nhất?', ['du -sh /* | sort -h', 'free -m', 'lsblk', 'ps aux'], '`df -h` cho biết phân vùng nào đầy; `du` cho biết thư mục nào chiếm chỗ.'],
    ['`sudo` khác đăng nhập thẳng bằng root ở điểm nào?', ['Cấp quyền theo từng lệnh và có ghi log ai làm gì', 'Chạy nhanh hơn', 'Không cần mật khẩu', 'Chỉ dùng được với file'], 'Mỗi người dùng tài khoản riêng nên truy vết được.'],
  ],
  Windows: [
    ['Vai trò nào của Windows Server quản lý tài khoản và máy tính tập trung?', ['Active Directory Domain Services', 'IIS', 'Hyper-V', 'WSUS'], 'AD DS lưu người dùng, nhóm, máy tính và xác thực bằng Kerberos.'],
    ['Group Policy được áp dụng theo thứ tự nào?', ['Local, Site, Domain, OU', 'OU, Domain, Site, Local', 'Domain, Local, OU, Site', 'Site, OU, Local, Domain'], 'LSDOU. Chính sách áp sau ghi đè chính sách áp trước.'],
    ['Máy trạm không vào được domain, báo không tìm thấy domain controller. Kiểm tra gì trước?', ['DNS của máy trạm có trỏ về DNS của domain không', 'Dung lượng ổ đĩa', 'Độ phân giải màn hình', 'Phiên bản trình duyệt'], 'Máy trạm tìm domain controller bằng bản ghi SRV trong DNS.'],
    ['Lệnh nào buộc máy trạm cập nhật Group Policy ngay?', ['gpupdate /force', 'ipconfig /release', 'sfc /scannow', 'chkdsk'], 'Xem chính sách đang áp bằng `gpresult /r`.'],
    ['Quyền thực tế khi vào thư mục chia sẻ qua mạng được tính thế nào?', ['Lấy quyền chặt hơn giữa Share và NTFS', 'Lấy quyền rộng hơn', 'Chỉ tính quyền Share', 'Chỉ tính quyền NTFS'], 'Thường để Share rộng rồi kiểm soát bằng NTFS.'],
    ['FSMO role nào xử lý đổi mật khẩu và đồng bộ thời gian trong domain?', ['PDC Emulator', 'Schema Master', 'RID Master', 'Infrastructure Master'], 'Kerberos cho phép lệch giờ tối đa 5 phút, nên nguồn giờ rất quan trọng.'],
    ['Trong IIS, một trang web được phân biệt bằng gì?', ['Binding: IP, cổng và host name', 'Tên thư mục', 'Tên application pool', 'Kích thước file'], 'Nhiều trang dùng chung IP và cổng 443 nhờ host name (SNI).'],
    ['Syslog server như Kiwi nhận log qua cổng mặc định nào?', ['UDP 514', 'TCP 3389', 'UDP 161', 'TCP 25'], 'UDP 514 không mã hoá. Syslog qua TLS dùng TCP 6514.'],
  ],
  DevOps: [
    ['Pod trong Kubernetes là gì?', ['Đơn vị nhỏ nhất, gồm một hoặc vài container dùng chung mạng', 'Một máy ảo', 'Một cụm node', 'Một file cấu hình'], 'Các container trong một Pod dùng chung địa chỉ IP.'],
    ['Đối tượng nào giữ cho luôn có đủ số bản sao Pod và cho cập nhật cuốn chiếu?', ['Deployment', 'Service', 'ConfigMap', 'Namespace'], 'Deployment quản lý ReplicaSet và rolling update.'],
    ['Service kiểu ClusterIP dùng để làm gì?', ['Cho một địa chỉ ổn định trong cụm trỏ tới nhóm Pod', 'Mở dịch vụ ra Internet', 'Lưu dữ liệu', 'Lên lịch chạy job'], 'Pod sinh ra và mất đi liên tục nên IP đổi; Service giữ địa chỉ cố định.'],
    ['Pod ở trạng thái CrashLoopBackOff. Lệnh nào xem lý do nhanh nhất?', ['kubectl logs <pod> --previous', 'kubectl get nodes', 'kubectl apply -f', 'kubectl scale'], '--previous xem log của lần chạy vừa chết. Thêm `kubectl describe pod` để xem sự kiện.'],
    ['Trong CI/CD, CI nghĩa là gì?', ['Mỗi lần đẩy mã đều tự build và chạy test', 'Tự động mua máy chủ', 'Sao lưu mã nguồn', 'Giám sát hiệu năng'], 'Lỗi được phát hiện sớm, ngay ở thay đổi gây ra nó.'],
    ['Mật khẩu và token trong pipeline nên để ở đâu?', ['Kho secret của hệ thống CI, không ghi vào mã', 'Trong file cấu hình trong repo', 'Trong tên nhánh', 'Trong thông điệp commit'], 'Đã đẩy lên repo thì coi như lộ, phải đổi ngay.'],
    ['Infrastructure as Code mang lại gì?', ['Hạ tầng được mô tả bằng file, có lịch sử và dựng lại được', 'Không cần máy chủ', 'Không cần test', 'Mạng nhanh hơn'], 'Chạy lại nhiều lần cho cùng một kết quả (idempotent).'],
    ['Image container nên gắn nhãn thế nào khi triển khai?', ['Nhãn phiên bản cụ thể, không dùng latest', 'Luôn dùng latest', 'Không cần nhãn', 'Dùng ngày hiện tại của máy'], '`latest` đổi theo thời gian nên không biết đang chạy bản nào và khó quay lui.'],
  ],
  'Hạ tầng': [
    ['Hypervisor loại 1 khác loại 2 ở điểm nào?', ['Chạy trực tiếp trên phần cứng', 'Chạy trên một hệ điều hành', 'Chỉ chạy container', 'Không cần CPU hỗ trợ ảo hoá'], 'ESXi, Hyper-V là loại 1. VirtualBox, Workstation là loại 2.'],
    ['vMotion làm gì?', ['Chuyển máy ảo đang chạy sang host khác mà không tắt', 'Sao lưu máy ảo', 'Nhân bản máy ảo', 'Mã hoá ổ đĩa ảo'], 'Cần mạng vMotion riêng và lưu trữ dùng chung, hoặc dùng Storage vMotion.'],
    ['Snapshot máy ảo có thay được bản sao lưu không?', ['Không: nó phụ thuộc ổ đĩa gốc và nằm cùng chỗ', 'Có, hoàn toàn', 'Có, nếu giữ trên 30 ngày', 'Có, nếu là máy Linux'], 'Giữ snapshot lâu còn làm chậm máy và đầy datastore.'],
    ['RAID nào chịu được hỏng hai ổ đĩa bất kỳ?', ['RAID 6', 'RAID 0', 'RAID 1 hai ổ', 'RAID 5'], 'RAID 5 chịu một ổ. RAID 0 không chịu ổ nào.'],
    ['SAN khác NAS ở điểm nào?', ['SAN cấp ổ đĩa ở mức block, NAS cấp thư mục ở mức file', 'SAN chậm hơn NAS', 'NAS dùng Fibre Channel', 'SAN chỉ dùng cho sao lưu'], 'SAN: iSCSI, Fibre Channel. NAS: SMB, NFS.'],
    ['RTO là gì?', ['Thời gian tối đa được phép để khôi phục dịch vụ', 'Lượng dữ liệu được phép mất', 'Số bản sao lưu', 'Tốc độ sao lưu'], 'RPO mới là lượng dữ liệu được phép mất, tính theo thời gian.'],
    ['Bản sao lưu immutable giúp gì trước ransomware?', ['Không sửa, không xoá được trong thời hạn đã đặt', 'Sao lưu nhanh hơn', 'Tốn ít dung lượng hơn', 'Không cần kiểm tra khôi phục'], 'Kẻ tấn công thường xoá bản sao lưu trước khi mã hoá.'],
    ['Việc nào chứng minh bản sao lưu dùng được?', ['Khôi phục thử định kỳ', 'Job báo Success', 'Dung lượng file lớn', 'Có email thông báo'], 'Sao lưu chưa từng khôi phục thử thì chưa đáng tin.'],
  ],
  SOC: [
    ['Wazuh agent làm gì trên máy được giám sát?', ['Thu log, kiểm tra toàn vẹn file và gửi về manager', 'Chặn gói ở biên mạng', 'Sao lưu dữ liệu', 'Cấp địa chỉ IP'], 'Manager phân tích bằng rule rồi sinh cảnh báo.'],
    ['Sysmon Event ID 1 ghi lại gì?', ['Tiến trình được tạo, kèm dòng lệnh và tiến trình cha', 'Đăng nhập thất bại', 'Ổ đĩa đầy', 'Thay đổi mật khẩu'], 'Event ID 3 là kết nối mạng, 11 là tạo file.'],
    ['Windows Security Event ID 4625 là gì?', ['Đăng nhập thất bại', 'Đăng nhập thành công', 'Tạo tài khoản', 'Xoá log'], '4624 là đăng nhập thành công. Nhiều 4625 liên tiếp rồi một 4624 là dấu hiệu dò mật khẩu thành công.'],
    ['Rule tương quan trong SIEM dùng để làm gì?', ['Nối nhiều sự kiện rời thành một cảnh báo có nghĩa', 'Nén log', 'Xoá log cũ', 'Đổi định dạng thời gian'], 'Ví dụ: 20 lần đăng nhập sai trong 1 phút rồi một lần đúng từ cùng IP.'],
    ['Cảnh báo sai (false positive) quá nhiều gây hậu quả gì?', ['Người trực mệt mỏi và bỏ sót cảnh báo thật', 'Hệ thống an toàn hơn', 'Log ít đi', 'Mạng nhanh hơn'], 'Phải tinh chỉnh rule, thêm ngoại lệ có lý do.'],
    ['MITRE ATT&CK dùng để làm gì trong SOC?', ['Gắn cảnh báo với kỹ thuật tấn công và tìm chỗ chưa phát hiện được', 'Chấm điểm lỗ hổng', 'Quản lý bản vá', 'Cấp chứng chỉ'], 'Điểm lỗ hổng là CVSS. ATT&CK mô tả hành vi của kẻ tấn công.'],
    ['Vì sao mọi nguồn log phải đồng bộ thời gian (NTP)?', ['Để xếp đúng thứ tự sự kiện khi điều tra', 'Để log nhỏ hơn', 'Để mã hoá log', 'Để tăng tốc tìm kiếm'], 'Lệch vài phút là không dựng lại được chuỗi sự kiện.'],
    ['Log nên gửi về máy chủ tập trung vì lý do bảo mật nào?', ['Kẻ tấn công xoá log trên máy bị chiếm thì bản sao vẫn còn', 'Tiết kiệm điện', 'Giảm số tài khoản', 'Không cần phân quyền'], 'Máy chủ log cần phân quyền riêng và thời hạn lưu rõ ràng.'],
  ],
  'Chuẩn': [
    ['Trong ITIL, Incident khác Problem ở điểm nào?', ['Incident là gián đoạn cần khôi phục nhanh; Problem là nguyên nhân gốc', 'Hai từ cùng nghĩa', 'Problem nhỏ hơn Incident', 'Incident chỉ do người dùng gây ra'], 'Khôi phục dịch vụ trước, tìm nguyên nhân gốc sau.'],
    ['Mục đích của Change Management là gì?', ['Thay đổi có đánh giá rủi ro, có duyệt và có kế hoạch quay lui', 'Cấm mọi thay đổi', 'Làm thay đổi nhanh hơn bằng cách bỏ kiểm tra', 'Ghi log đăng nhập'], 'Phần lớn sự cố bắt nguồn từ thay đổi không được kiểm soát.'],
    ['Năm chức năng cốt lõi của NIST CSF (bản 1.1)?', ['Identify, Protect, Detect, Respond, Recover', 'Plan, Do, Check, Act, Review', 'Scan, Patch, Test, Deploy, Audit', 'Prevent, Block, Alert, Log, Report'], 'CSF 2.0 thêm chức năng thứ sáu: Govern.'],
    ['ISO/IEC 27001 chứng nhận điều gì?', ['Tổ chức có hệ thống quản lý an toàn thông tin (ISMS) vận hành đúng chuẩn', 'Sản phẩm không có lỗ hổng', 'Nhân viên có chứng chỉ', 'Mạng đạt tốc độ chuẩn'], 'Chứng nhận quy trình quản lý, không phải bảo đảm không bị tấn công.'],
    ['Statement of Applicability trong ISO 27001 là gì?', ['Danh sách biện pháp kiểm soát được áp dụng hoặc loại trừ, kèm lý do', 'Hợp đồng với nhà cung cấp', 'Sơ đồ mạng', 'Báo cáo sự cố'], 'Dựa trên kết quả đánh giá rủi ro.'],
    ['SLA là gì?', ['Cam kết mức dịch vụ giữa nhà cung cấp và khách hàng', 'Danh sách tài sản', 'Loại giấy phép phần mềm', 'Chuẩn mã hoá'], 'Ví dụ: sẵn sàng 99,9%, phản hồi sự cố mức 1 trong 15 phút.'],
    ['Bốn cách xử lý rủi ro là gì?', ['Giảm, chuyển giao, chấp nhận, tránh', 'Vá, quét, chặn, xoá', 'Xem, sửa, xoá, lưu', 'Phát hiện, báo cáo, đóng, mở'], 'Chuyển giao: ví dụ mua bảo hiểm. Chấp nhận phải có người có thẩm quyền ký.'],
    ['Vì sao cần tách nhiệm vụ (segregation of duties)?', ['Để một người không tự làm và tự duyệt được việc nhạy cảm', 'Để tăng số nhân viên', 'Để giảm lương', 'Để đơn giản quy trình'], 'Ví dụ: người viết mã không tự đưa lên môi trường thật.'],
  ],
};

function shuffle(a, rnd) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
const mix = (q, options, explainVi, rnd, extra) => { const o = shuffle(options.map((t, i) => [t, i]), rnd); return { q, options: o.map((x) => x[0]), correct: o.findIndex((x) => x[1] === 0), explainVi, ...extra }; };

for (const M of [MORE, MORE2]) for (const k of Object.keys(M)) Q[k].push(...M[k]);

// Câu sinh số liệu mới mỗi lượt: (rnd) => [câu hỏi, [đáp án đúng, các lựa chọn sai], giải thích].
const ri = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
const one = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
/** Giữ đáp án đúng ở đầu, bỏ lựa chọn sai trùng nhau hoặc trùng đáp án, lấy 3 cái. */
const opts = (right, wrong) => [String(right), ...[...new Set(wrong.map(String))].filter((w) => w !== String(right)).slice(0, 3)];
const rwx = (n) => (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-');
const DAYS = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];
const GEN = {
  Linux: [
    (rnd) => { const [u, g, o] = [one(rnd, [7, 6, 5]), one(rnd, [7, 6, 5, 4, 0]), one(rnd, [5, 4, 0])], v = `${u}${g}${o}`;
      return [`\`ls -l\` hiện quyền \`${rwx(u)}${rwx(g)}${rwx(o)}\`. Lệnh chmod dạng số tương ứng là gì?`, opts(v, [`${o}${g}${u}`, `${u}${o}${g}`, `${7 - u}${7 - g}${7 - o}`, `${u}${g}${(o + 1) % 8}`, `${(u + 1) % 8}${g}${o}`]), 'r = 4, w = 2, x = 1. Cộng từng nhóm theo thứ tự chủ, nhóm, người khác.']; },
    (rnd) => { const m = one(rnd, [0, 15, 30, 45]), h = ri(rnd, 0, 23), d = ri(rnd, 0, 6), t = (hh, mm) => `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      return [`Dòng crontab \`${m} ${h} * * ${d}\` chạy lệnh khi nào?`, opts(`${t(h, m)} mỗi ${DAYS[d]}`, [`${t(m % 24, h)} mỗi ${DAYS[d]}`, `${t(h, m)} ngày ${d + 1} hằng tháng`, `${t(h, m)} mỗi ngày`, `Mỗi ${m || 60} phút vào ${DAYS[d]}`]), 'Năm trường: phút, giờ, ngày trong tháng, tháng, thứ trong tuần (0 = Chủ nhật).']; },
    (rnd) => { const mask = one(rnd, ['022', '027', '077', '002']), f = 0o666 & ~parseInt(mask, 8), dir = 0o777 & ~parseInt(mask, 8), o8 = (n) => n.toString(8).padStart(3, '0');
      return [`Với umask ${mask}, một thư mục mới tạo có quyền gì?`, opts(o8(dir), [o8(f), mask, '777', o8(dir ^ 0o111), '755', '700']), `Thư mục bắt đầu từ 777, trừ mặt nạ ${mask} còn ${o8(dir)}. File bắt đầu từ 666 nên còn ${o8(f)}.`]; },
  ],
  Windows: [
    (rnd) => { const L = ['Read', 'Change', 'Full Control'], N = ['Read', 'Modify', 'Full Control'], a = ri(rnd, 0, 2), b = ri(rnd, 0, 2), eff = Math.min(a, b);
      return [`Thư mục có quyền Share là ${L[a]} và quyền NTFS là ${N[b]} cho cùng một nhóm. Qua mạng, nhóm đó có quyền thực tế mức nào?`, opts(['Chỉ đọc', 'Đọc và sửa', 'Toàn quyền'][eff], ['Chỉ đọc', 'Đọc và sửa', 'Toàn quyền', 'Không có quyền nào']), 'Qua mạng, quyền thực tế là mức chặt hơn giữa Share và NTFS. Ngồi tại máy chủ thì chỉ NTFS áp dụng.']; },
  ],
  DevOps: [
    (rnd) => { const n = one(rnd, [4, 6, 8, 10]), k = one(rnd, [1, 2]);
      return [`Deployment có ${n} bản sao, rolling update với maxUnavailable = ${k}. Trong lúc cập nhật, luôn có ít nhất bao nhiêu Pod sẵn sàng?`, opts(n - k, [n, k, n + k, n - k - 1, 0]), `Số Pod sẵn sàng tối thiểu = replicas − maxUnavailable = ${n} − ${k}.`]; },
    (rnd) => { const cpu = one(rnd, [2000, 4000, 8000]), req = one(rnd, [250, 500]), n = Math.floor(cpu / req);
      return [`Node còn trống ${cpu}m CPU. Mỗi Pod khai báo requests.cpu = ${req}m. Scheduler xếp được tối đa bao nhiêu Pod lên node này (chỉ xét CPU)?`, opts(n, [n * 2, n / 2, n + 1, n - 1, cpu / 1000]), `Scheduler cộng requests, không nhìn mức dùng thật: ${cpu} / ${req} = ${n}.`]; },
  ],
  'Hạ tầng': [
    (rnd) => { const n = one(rnd, [4, 6, 8]), sz = one(rnd, [2, 4, 8]), lv = one(rnd, [5, 6, 10]), use = { 5: (n - 1) * sz, 6: (n - 2) * sz, 10: (n / 2) * sz }[lv];
      return [`${n} ổ đĩa ${sz} TB ghép RAID ${lv}. Dung lượng dùng được là bao nhiêu?`, opts(`${use} TB`, [`${n * sz} TB`, `${(n - 1) * sz} TB`, `${(n - 2) * sz} TB`, `${(n / 2) * sz} TB`, `${sz} TB`]), 'RAID 5 mất 1 ổ cho parity, RAID 6 mất 2 ổ, RAID 10 mất một nửa.']; },
    (rnd) => { const h = one(rnd, [1, 4, 6, 12, 24]);
      return [`Hệ thống sao lưu mỗi ${h} giờ một lần. Trường hợp xấu nhất mất dữ liệu của bao lâu?`, opts(`Gần ${h} giờ`, [`${h * 2} giờ`, `${h / 2} giờ`, 'Không mất gì', '1 phút', `${h * 24} giờ`]), `Sự cố xảy ra ngay trước lần sao lưu kế tiếp thì mất gần trọn một chu kỳ. Nếu RPO yêu cầu ngắn hơn ${h} giờ thì phải sao lưu dày hơn.`]; },
    (rnd) => { const vm = one(rnd, [20, 40, 60]), per = one(rnd, [50, 100]), ratio = one(rnd, [2, 4]), need = (vm * per) / ratio;
      return [`${vm} máy ảo, mỗi máy cấp đĩa thin ${per} GB, tỉ lệ cấp vượt cho phép là ${ratio}:1. Datastore cần tối thiểu bao nhiêu dung lượng thật?`, opts(`${need} GB`, [`${vm * per} GB`, `${need / 2} GB`, `${vm * per * ratio} GB`, `${per * ratio} GB`]), `Tổng cấp phát ${vm * per} GB chia tỉ lệ ${ratio}:1 = ${need} GB. Phải giám sát mức dùng thật để không đầy datastore.`]; },
  ],
  SOC: [
    (rnd) => { const f = one(rnd, [5, 8, 10]), t = one(rnd, [60, 120, 300]), got = f + ri(rnd, -2, 3), win = t + one(rnd, [-30, 60]), hit = got >= f && win <= t;
      return [`Rule có frequency = ${f}, timeframe = ${t} giây. Log ghi ${got} lần đăng nhập sai từ một IP trong ${win} giây. Rule có sinh cảnh báo không?`, opts(hit ? 'Có' : (got < f ? 'Không, chưa đủ số lần' : 'Không, các lần trải ra quá khung thời gian'), ['Có', 'Không, chưa đủ số lần', 'Không, các lần trải ra quá khung thời gian', 'Chỉ khi agent khởi động lại']), `Cần ít nhất ${f} sự kiện khớp trong vòng ${t} giây.`]; },
  ],
  'Chuẩn': [
    (rnd) => { const [sla, min] = one(rnd, [['99%', 432], ['99,5%', 216], ['99,9%', 43.2], ['99,99%', 4.32]]), fmt = (m) => (m >= 60 ? `${+(m / 60).toFixed(1)} giờ`.replace('.', ',') : `${String(m).replace('.', ',')} phút`);
      return [`SLA cam kết sẵn sàng ${sla} trong một tháng 30 ngày. Thời gian ngừng tối đa được phép là bao nhiêu?`, opts(fmt(min), [432, 216, 43.2, 4.32, 1440].map(fmt)), `30 ngày = 43 200 phút. Phần được phép ngừng = 43 200 × (100% − ${sla}).`]; },
    (rnd) => { const I = ['thấp', 'trung bình', 'cao'], a = ri(rnd, 0, 2), b = ri(rnd, 0, 2), sc = (a + 1) * (b + 1), lvl = sc >= 6 ? 'Cao' : sc >= 3 ? 'Trung bình' : 'Thấp';
      return [`Ma trận rủi ro 3×3 (điểm = khả năng × tác động; 1–2 thấp, 3–4 trung bình, 6–9 cao). Khả năng xảy ra ${I[a]}, tác động ${I[b]}. Rủi ro ở mức nào?`, opts(lvl, ['Thấp', 'Trung bình', 'Cao', 'Không xác định được']), `${a + 1} × ${b + 1} = ${sc}.`]; },
  ],
};

export const LIB_LEN = 15;
/** Số câu trong ngân hàng của một chủ đề (không tính câu sinh số liệu). */
export const libCount = (ref) => (ref === 'Wireshark' ? WS.length : Q[ref]?.length ?? 0);

/**
 * Một lượt quiz của một chủ đề trong chặng thư viện: `n` câu rút ngẫu nhiên, câu chưa có trong `seen` được lấy trước,
 * kèm câu sinh số liệu mới (nếu chủ đề có). Trả null nếu chủ đề không có quiz. Câu Wireshark có `table` là danh sách gói.
 */
export function libQuiz(ref, rnd = Math.random, n = LIB_LEN, seen = new Set()) {
  if (ref !== 'Wireshark' && !Q[ref]) return null;
  const fresh = (text) => !seen.has(text);
  const order = (arr, text) => { const sh = shuffle(arr, rnd); return [...sh.filter((x) => fresh(text(x))), ...sh.filter((x) => !fresh(text(x)))]; };
  if (ref !== 'Wireshark') {
    const gens = shuffle(GEN[ref] || [], rnd).slice(0, 3).map((g) => g(rnd));
    return shuffle([...order(Q[ref], (x) => x[0]).slice(0, Math.max(0, n - gens.length)), ...gens], rnd).map(([q, o, ex]) => mix(q, o, ex, rnd));
  }
  const lists = {};
  return order(WS, (e) => e.q).slice(0, n).map((e) => {
    const rows = e.sc ? (lists[e.sc] ||= packetList(e.sc)) : null;
    const table = rows && { cols: ['No.', 'Source', 'Destination', 'Protocol', 'Info'], rows: rows.map((r) => [r.no, r.src, r.dst, r.proto, r.info]) };
    if (!e.pick) return mix(e.q, e.o, e.ex, rnd, { table });
    const right = e.pick(rows), others = shuffle(rows.filter((r) => r !== right), rnd).slice(0, 3);
    const opts2 = [right, ...others].sort((a, b) => a.no - b.no);
    return { q: e.q, options: opts2.map((r) => `Gói ${r.no}`), correct: opts2.indexOf(right), explainVi: e.ex, table };
  });
}
export const LIB_QUIZ_REFS = ['Wireshark', ...Object.keys(Q)];
