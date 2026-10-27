// protocols/dns.js
// DNS (RFC 1035) — header 12 byte + Question + Answer. Thường chạy trong UDP cổng 53.
// Tên miền mã hóa dạng nhãn có tiền tố độ dài; Answer dùng con trỏ nén 0xC00C.

import { BitWriter } from '../packet/bytes.js';
import { parseIp } from '../packet/addr.js';

const QTYPE = { 1: 'A', 28: 'AAAA', 5: 'CNAME', 15: 'MX', 2: 'NS' };

function encodeName(w, name) {
  for (const label of name.split('.')) {
    w.writeUint(label.length, 1);
    for (let i = 0; i < label.length; i++) w.writeUint(label.charCodeAt(i), 1);
  }
  w.writeUint(0, 1); // kết thúc tên
}

export default {
  id: 'dns',
  name: 'DNS',
  nameVi: 'DNS',
  osiLayer: 7,
  rfc: 'RFC 1035',
  checksum: null,

  /**
   * fields: {
   *   id, response=false, rd=true, qname, qtype=1, qclass=1,
   *   answers: [ { ip, ttl, type=1 } ]   (chỉ A record ở mức này)
   * }
   */
  build(fields) {
    const w = new BitWriter();
    const answers = fields.answers || [];
    const flags = fields.response ? 0x8180 : 0x0100; // response: QR+RD+RA; query: RD

    w.field({ name: 'dns.id', nameVi: 'Transaction ID', rfc: 'RFC 1035',
      descriptionVi: 'ID khớp câu hỏi với câu trả lời.', display: `0x${(fields.id >>> 0).toString(16).padStart(4, '0')}` },
      () => w.writeUint(fields.id, 2));
    w.field({ name: 'dns.flags', nameVi: 'Flags', rfc: 'RFC 1035',
      descriptionVi: fields.response ? 'QR=1 (response), RD=1, RA=1 (server hỗ trợ đệ quy).' : 'QR=0 (query), RD=1 (Recursion Desired — nhờ resolver hỏi hộ).',
      display: `0x${flags.toString(16).padStart(4, '0')} — ${fields.response ? 'Response' : 'Query'}` },
      () => w.writeUint(flags, 2));
    w.field({ name: 'dns.qd', nameVi: 'Questions', rfc: 'RFC 1035', descriptionVi: 'Số câu hỏi.', display: '1' }, () => w.writeUint(1, 2));
    w.field({ name: 'dns.an', nameVi: 'Answer RRs', rfc: 'RFC 1035', descriptionVi: 'Số bản ghi trả lời.', display: String(answers.length) }, () => w.writeUint(answers.length, 2));
    w.field({ name: 'dns.ns', nameVi: 'Authority RRs', rfc: 'RFC 1035', descriptionVi: 'Số bản ghi authority.', display: '0' }, () => w.writeUint(0, 2));
    w.field({ name: 'dns.ar', nameVi: 'Additional RRs', rfc: 'RFC 1035', descriptionVi: 'Số bản ghi bổ sung.', display: '0' }, () => w.writeUint(0, 2));

    // Question
    w.field({ name: 'dns.qname', nameVi: 'Query Name', rfc: 'RFC 1035',
      descriptionVi: 'Tên miền hỏi, mã hóa dạng nhãn (vd 3"www"7"example"3"com"0).', display: fields.qname },
      () => encodeName(w, fields.qname));
    w.field({ name: 'dns.qtype', nameVi: 'Query Type', rfc: 'RFC 1035',
      descriptionVi: '1 = A (IPv4), 28 = AAAA (IPv6), 5 = CNAME.', display: `${fields.qtype ?? 1} — ${QTYPE[fields.qtype ?? 1] || '?'}` },
      () => w.writeUint(fields.qtype ?? 1, 2));
    w.field({ name: 'dns.qclass', nameVi: 'Query Class', rfc: 'RFC 1035', descriptionVi: '1 = IN (Internet).', display: '1 — IN' }, () => w.writeUint(fields.qclass ?? 1, 2));

    // Answers (A record), dùng con trỏ nén tới tên ở Question (offset 12)
    answers.forEach((ans, idx) => {
      w.field({ name: `dns.ans${idx}.name`, nameVi: `Answer ${idx + 1}: Name`, rfc: 'RFC 1035',
        descriptionVi: 'Con trỏ nén 0xC00C → trỏ về tên ở Question (offset 12), khỏi lặp lại.', display: `→ ${fields.qname}` },
        () => w.writeUint(0xc00c, 2));
      w.field({ name: `dns.ans${idx}.type`, nameVi: `Answer ${idx + 1}: Type`, rfc: 'RFC 1035', descriptionVi: '1 = A.', display: '1 — A' }, () => w.writeUint(1, 2));
      w.field({ name: `dns.ans${idx}.class`, nameVi: `Answer ${idx + 1}: Class`, rfc: 'RFC 1035', descriptionVi: '1 = IN.', display: '1 — IN' }, () => w.writeUint(1, 2));
      w.field({ name: `dns.ans${idx}.ttl`, nameVi: `Answer ${idx + 1}: TTL`, rfc: 'RFC 1035', descriptionVi: 'Thời gian cache bản ghi (giây).', display: `${ans.ttl ?? 300}s` }, () => w.writeUint(ans.ttl ?? 300, 4));
      w.field({ name: `dns.ans${idx}.rdlen`, nameVi: `Answer ${idx + 1}: RDLENGTH`, rfc: 'RFC 1035', descriptionVi: 'Độ dài RDATA = 4 (một IPv4).', display: '4' }, () => w.writeUint(4, 2));
      w.field({ name: `dns.ans${idx}.rdata`, nameVi: `Answer ${idx + 1}: Address`, rfc: 'RFC 1035', descriptionVi: 'Địa chỉ IPv4 trả về cho tên miền.', display: ans.ip }, () => w.writeBytes(parseIp(ans.ip)));
    });
    return w;
  },
};
