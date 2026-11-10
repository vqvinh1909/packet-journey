// lab/sec-exam.js — ngân hàng câu hỏi "Thi thử Security", tự soạn theo 7 module của giáo trình Network Security.
// Mỗi câu: [mảng, câu hỏi, 4 lựa chọn, chỉ số đáp án đúng, giải thích]. makeExam xáo thứ tự lựa chọn nên đáp án đúng để ở vị trí 0.
// shortcut: chỉ có tiếng Việt, bản EN dùng lại chữ Việt; dịch khi cần thi bằng tiếng Anh.

export const SEC_DOMAINS = [
  { id: 'sfund', name: 'Security fundamentals and cryptography', vi: 'Nền tảng & mật mã', w: 20 },
  { id: 'satk', name: 'Attacks', vi: 'Các kiểu tấn công', w: 25 },
  { id: 'sdef', name: 'Organisational defence and endpoints', vi: 'Phòng thủ tổ chức & endpoint', w: 20 },
  { id: 'snet', name: 'Infrastructure, firewall and VPN', vi: 'Hạ tầng, firewall & VPN', w: 20 },
  { id: 'ssoc', name: 'Monitoring and incident response', vi: 'Giám sát & ứng phó sự cố', w: 15 },
];

export const SEC_BANK = [
  // ---------------------------------------------------------------- Nền tảng & mật mã (8)
  ['sfund', 'Ransomware mã hoá file khiến công ty không làm việc được. Thuộc tính nào của CIA bị vi phạm trước tiên?', ['Availability', 'Confidentiality', 'Integrity', 'Non-repudiation'], 0, 'Dữ liệu còn đó nhưng không dùng được: mất tính sẵn sàng. Nếu dữ liệu còn bị đánh cắp thì mất thêm tính bí mật.'],
  ['sfund', 'Hàm băm (SHA-256) dùng để làm gì?', ['Kiểm tra dữ liệu có bị sửa không', 'Mã hoá dữ liệu để giải mã lại sau', 'Trao đổi khoá', 'Nén dữ liệu'], 0, 'Băm là một chiều, không giải ngược được. Cùng đầu vào luôn cho cùng giá trị băm.'],
  ['sfund', 'Vì sao TLS dùng cả mã hoá bất đối xứng lẫn đối xứng?', ['Bất đối xứng để trao khoá và xác thực, đối xứng để mã hoá dữ liệu nhanh', 'Đối xứng an toàn hơn bất đối xứng', 'Bất đối xứng nhanh hơn nên dùng cho dữ liệu', 'Để tương thích IPv6'], 0, 'RSA/ECC chậm, chỉ dùng lúc bắt tay. AES nhanh, dùng cho phần dữ liệu.'],
  ['sfund', 'Chữ ký số được tạo bằng khoá nào?', ['Khoá riêng của người ký', 'Khoá công khai của người ký', 'Khoá công khai của người nhận', 'Khoá phiên'], 0, 'Ký bằng khoá riêng, ai cũng kiểm được bằng khoá công khai.'],
  ['sfund', 'MFA đúng nghĩa cần gì?', ['Hai yếu tố thuộc hai loại khác nhau (biết, có, là)', 'Hai mật khẩu khác nhau', 'Mật khẩu dài trên 16 ký tự', 'Đổi mật khẩu mỗi 30 ngày'], 0, 'Hai mật khẩu vẫn chỉ là một loại yếu tố: thứ bạn biết.'],
  ['sfund', 'Zero Trust dựa trên nguyên tắc nào?', ['Không tin mặc định, luôn xác minh mỗi yêu cầu', 'Tin mọi thiết bị trong mạng nội bộ', 'Chặn mọi truy cập từ Internet', 'Chỉ dùng VPN'], 0, 'Vị trí trong mạng không còn là lý do để tin.'],
  ['sfund', 'Lưu mật khẩu người dùng trong cơ sở dữ liệu nên dùng cách nào?', ['Băm có salt bằng thuật toán chậm (bcrypt, Argon2)', 'Mã hoá AES với một khoá chung', 'Băm MD5', 'Lưu dạng rõ trong bảng riêng'], 0, 'Salt chống bảng tra sẵn; thuật toán chậm làm brute force tốn kém.'],
  ['sfund', 'Rủi ro được tính từ những yếu tố nào?', ['Khả năng xảy ra và mức thiệt hại', 'Số lượng firewall', 'Số nhân viên IT', 'Tuổi của hệ thống'], 0, 'Rủi ro = khả năng × tác động. Dùng để xếp ưu tiên xử lý.'],
  // ---------------------------------------------------------------- Các kiểu tấn công (10)
  ['satk', 'Email giả giám đốc yêu cầu kế toán chuyển khoản gấp là kiểu tấn công gì?', ['BEC (Business Email Compromise)', 'SQL injection', 'DDoS', 'MAC flooding'], 0, 'BEC dựa vào giả mạo danh tính và tạo áp lực thời gian, thường không có mã độc.'],
  ['satk', 'Kẻ tấn công gửi ARP Reply giả để đứng giữa nạn nhân và gateway. Tính năng nào của switch chặn được?', ['Dynamic ARP Inspection', 'PortFast', 'EtherChannel', 'VTP pruning'], 0, 'DAI so gói ARP với bảng DHCP snooping binding.'],
  ['satk', 'Nhập `\' OR 1=1 --` vào ô đăng nhập là thử lỗ hổng nào?', ['SQL injection', 'XSS', 'CSRF', 'Path traversal'], 0, 'Chuỗi này sửa câu truy vấn SQL nếu ứng dụng ghép chuỗi trực tiếp.'],
  ['satk', 'Cách phòng SQL injection đúng nhất ở phía ứng dụng?', ['Dùng truy vấn tham số hoá (prepared statement)', 'Ẩn thông báo lỗi', 'Đổi cổng cơ sở dữ liệu', 'Dùng HTTPS'], 0, 'Tham số hoá tách dữ liệu khỏi câu lệnh. Các cách còn lại không chặn được gốc lỗi.'],
  ['satk', 'Dùng danh sách tài khoản và mật khẩu bị lộ từ trang khác để thử đăng nhập là kiểu gì?', ['Credential stuffing', 'Brute force', 'Phishing', 'Rainbow table'], 0, 'Dựa vào thói quen dùng lại mật khẩu. MFA chặn được.'],
  ['satk', 'Người dùng bị gửi liên tục yêu cầu duyệt đăng nhập trên điện thoại cho tới khi bấm đồng ý. Đây là gì?', ['MFA fatigue', 'SIM swapping', 'Session hijacking', 'Replay attack'], 0, 'Khắc phục: number matching, giới hạn số yêu cầu.'],
  ['satk', 'SYN flood làm cạn tài nguyên nào của server?', ['Hàng đợi kết nối TCP nửa mở', 'Dung lượng đĩa', 'Bảng định tuyến', 'Chứng chỉ TLS'], 0, 'Mỗi SYN giả chiếm một dòng chờ ACK không bao giờ tới.'],
  ['satk', 'Mã độc tự lây qua mạng mà không cần người dùng mở file là loại nào?', ['Worm', 'Trojan', 'Spyware', 'Adware'], 0, 'Worm khai thác lỗ hổng dịch vụ để tự lan. Trojan cần người dùng chạy.'],
  ['satk', 'Đặc điểm của APT là gì?', ['Xâm nhập có mục tiêu, ẩn mình lâu dài để lấy dữ liệu', 'Tấn công nhanh rồi rút trong vài phút', 'Luôn dùng ransomware', 'Chỉ nhắm vào người dùng cá nhân'], 0, 'APT đi qua nhiều giai đoạn; MITRE ATT&CK mô tả các kỹ thuật ở từng giai đoạn.'],
  ['satk', 'Kẻ tấn công lấy được cookie phiên của người dùng đã đăng nhập. Hậu quả?', ['Vào được tài khoản mà không cần mật khẩu hay MFA', 'Chỉ đọc được trang công khai', 'Phải đoán lại mật khẩu', 'Không làm được gì nếu có HTTPS'], 0, 'Cookie phiên đại diện cho phiên đã xác thực. Cần cờ HttpOnly, Secure và thời hạn ngắn.'],
  // ---------------------------------------------------------------- Phòng thủ tổ chức & endpoint (8)
  ['sdef', 'Quy tắc sao lưu 3-2-1 là gì?', ['3 bản, trên 2 loại phương tiện, 1 bản để ngoài site', '3 ngày sao lưu 2 lần giữ 1 tháng', '3 server, 2 ổ đĩa, 1 băng từ', '3 người duyệt, 2 người làm, 1 người kiểm'], 0, 'Chống ransomware cần thêm một bản offline hoặc không sửa được (immutable).'],
  ['sdef', 'RPO trả lời câu hỏi nào?', ['Chấp nhận mất tối đa bao nhiêu dữ liệu, tính theo thời gian', 'Mất bao lâu để khôi phục dịch vụ', 'Chi phí một lần sao lưu', 'Số bản sao lưu phải giữ'], 0, 'RTO mới là thời gian khôi phục. RPO quyết định tần suất sao lưu.'],
  ['sdef', 'EDR khác antivirus truyền thống ở điểm nào?', ['Theo dõi hành vi và cho phép điều tra, cô lập máy', 'Chỉ quét file theo chữ ký', 'Không cần cài agent', 'Chỉ chạy trên server'], 0, 'Antivirus dựa nhiều vào chữ ký; EDR ghi lại tiến trình, kết nối để phát hiện và ứng phó.'],
  ['sdef', 'Nguyên tắc least privilege nghĩa là gì?', ['Chỉ cấp quyền vừa đủ cho công việc', 'Cấp quyền admin cho người đáng tin', 'Mọi người có quyền như nhau', 'Thu hồi quyền mỗi tối'], 0, 'Tài khoản bị chiếm thì thiệt hại giới hạn trong quyền của nó.'],
  ['sdef', 'PAM dùng để quản lý gì?', ['Tài khoản đặc quyền: cấp theo phiên, ghi lại thao tác', 'Bản vá phần mềm', 'Thiết bị di động', 'Chứng chỉ web'], 0, 'Tài khoản admin là mục tiêu số một nên cần kiểm soát riêng.'],
  ['sdef', 'Bản vá cho lỗ hổng đang bị khai thác ngoài thực tế nên xử lý thế nào?', ['Thử nhanh rồi triển khai khẩn, không chờ chu kỳ thường', 'Chờ kỳ bảo trì hằng quý', 'Chỉ vá trên máy trạm', 'Bỏ qua nếu có antivirus'], 0, 'Mức ưu tiên theo việc lỗ hổng có đang bị khai thác và hệ thống có lộ ra Internet không.'],
  ['sdef', 'File nào đáng ngờ nhất khi nhận qua email?', ['hoa-don.pdf.exe', 'bao-cao.pdf', 'anh.jpg', 'ghi-chu.txt'], 0, 'Đuôi kép che đuôi thực thi. Windows ẩn đuôi file theo mặc định.'],
  ['sdef', 'DLP nhằm ngăn điều gì?', ['Dữ liệu nhạy cảm bị đưa ra ngoài tổ chức', 'Mất điện', 'Tấn công DDoS', 'Trùng địa chỉ IP'], 0, 'DLP nhận diện dữ liệu theo phân loại rồi chặn hoặc cảnh báo khi gửi ra ngoài.'],
  // ---------------------------------------------------------------- Hạ tầng, firewall & VPN (8)
  ['snet', 'Máy chủ web công khai nên đặt ở vùng nào?', ['DMZ', 'Vùng Internal cùng máy trạm', 'Vùng Management', 'Ngoài firewall'], 0, 'DMZ cô lập: máy chủ bị chiếm cũng không vào thẳng được mạng nội bộ.'],
  ['snet', 'Firewall stateful khác ACL thường ở điểm nào?', ['Nhớ trạng thái kết nối nên tự cho gói trả lời đi về', 'Chỉ lọc theo MAC', 'Không lọc được cổng', 'Chỉ chạy ở Layer 2'], 0, 'ACL thường xét từng gói riêng lẻ, phải viết luật cho cả hai chiều.'],
  ['snet', 'NGFW muốn nhận diện ứng dụng và mã độc trong HTTPS thì cần gì?', ['SSL/TLS inspection', 'Tăng MTU', 'Bật NAT', 'Tắt IPS'], 0, 'Không giải mã thì firewall chỉ thấy IP, cổng và SNI.'],
  ['snet', 'Luật cuối cùng trong chính sách firewall nên là gì?', ['Chặn tất cả, có ghi log', 'Cho phép tất cả', 'Cho phép ICMP', 'Không cần luật cuối'], 0, 'Mặc định chặn; chỉ mở những gì có lý do rõ ràng.'],
  ['snet', 'VPN site-to-site IPsec dùng giao thức nào để thoả thuận khoá?', ['IKE', 'ESP', 'GRE', 'SNMP'], 0, 'IKE (UDP 500/4500) dựng SA; ESP mang dữ liệu đã mã hoá.'],
  ['snet', '802.1X trên cổng switch làm gì?', ['Chỉ mở cổng sau khi người dùng hoặc thiết bị được xác thực', 'Mã hoá mọi khung Ethernet', 'Chống vòng lặp Layer 2', 'Cân bằng tải'], 0, 'Switch chuyển tiếp EAP tới RADIUS, rồi mở cổng và gán VLAN theo kết quả.'],
  ['snet', 'Cấu hình nào đúng khi hardening truy cập quản trị router?', ['Chỉ cho SSH, tắt Telnet, giới hạn nguồn bằng ACL', 'Mở Telnet và SSH để dự phòng', 'Dùng community SNMP "public"', 'Tắt ghi log để nhẹ CPU'], 0, 'Telnet và SNMPv1/v2c gửi dạng rõ.'],
  ['snet', 'Mạng Wi-Fi cho khách nên thiết kế thế nào?', ['SSID riêng, VLAN riêng, chỉ đi Internet', 'Chung VLAN với nhân viên', 'Dùng chung mật khẩu Wi-Fi nội bộ', 'Tắt mã hoá cho dễ kết nối'], 0, 'Tách khách khỏi tài nguyên nội bộ bằng VLAN và luật firewall.'],
  // ---------------------------------------------------------------- Giám sát & ứng phó sự cố (6)
  ['ssoc', 'SIEM làm việc gì chính?', ['Thu log từ nhiều nguồn, tương quan và cảnh báo', 'Chặn gói ở biên mạng', 'Sao lưu dữ liệu', 'Cấp chứng chỉ'], 0, 'Giá trị của SIEM là nối các sự kiện rời rạc thành một cảnh báo có nghĩa.'],
  ['ssoc', 'IDS khác IPS ở điểm nào?', ['IDS chỉ phát hiện và cảnh báo; IPS nằm trên đường đi và chặn được', 'IDS chặn, IPS cảnh báo', 'IDS chỉ dùng cho Wi-Fi', 'Không khác nhau'], 0, 'IPS đặt inline nên chặn được, nhưng báo nhầm sẽ làm gián đoạn dịch vụ.'],
  ['ssoc', 'Phát hiện một máy nhiễm ransomware. Bước đầu tiên nên làm?', ['Cô lập máy khỏi mạng', 'Cài lại Windows ngay', 'Trả tiền chuộc', 'Tắt toàn bộ firewall'], 0, 'Ngăn lây lan trước (containment), giữ nguyên máy để lấy chứng cứ.'],
  ['ssoc', 'Thứ tự các giai đoạn ứng phó sự cố theo NIST?', ['Chuẩn bị, phát hiện và phân tích, ngăn chặn/diệt trừ/khôi phục, rút kinh nghiệm', 'Phát hiện, khôi phục, chuẩn bị, báo cáo', 'Ngăn chặn, phát hiện, chuẩn bị, khôi phục', 'Khôi phục, diệt trừ, phát hiện, chuẩn bị'], 0, 'NIST SP 800-61. Chuẩn bị là giai đoạn làm trước khi có sự cố.'],
  ['ssoc', 'Chain of custody trong điều tra số là gì?', ['Hồ sơ ghi ai giữ chứng cứ, khi nào, làm gì với nó', 'Chuỗi chứng chỉ TLS', 'Danh sách tài khoản admin', 'Thứ tự khởi động server'], 0, 'Thiếu hồ sơ này, chứng cứ có thể không được chấp nhận.'],
  ['ssoc', 'IOC là gì?', ['Dấu vết cho thấy hệ thống có thể đã bị xâm nhập (hash, IP, tên miền)', 'Chính sách mật khẩu', 'Loại firewall', 'Chuẩn mã hoá Wi-Fi'], 0, 'IOC dùng để dò tìm trong log và chặn ở firewall, EDR.'],
];
