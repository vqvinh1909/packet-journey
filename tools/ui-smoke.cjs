// tools/ui-smoke.cjs — kiểm tra nhanh giao diện Lab CLI trên trình duyệt thật (tuỳ chọn, không nằm trong `node --test`).
// Cần Playwright + Chromium:  npm i -D playwright && npx playwright install chromium
// Chạy (tại thư mục gốc repo):  node tools/ui-smoke.cjs   → in PASS/FAIL từng mục, mã thoát 1 nếu có FAIL.
// Script tự bật server tĩnh cổng 8799 nên không cần serve.py.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': (TYPES[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8' });
  fs.createReadStream(f).pipe(res);
});
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
server.listen(8799, '127.0.0.1', async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.stack)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('RENAMED') : d.accept()));
  await p.goto('http://127.0.0.1:8799/index.html');
  await p.click('#btn-lab');
  const type = async (c) => { await p.fill('#lab-in', c); await p.press('#lab-in', 'Enter'); };
  // 1) lab thường: gõ tay + lịch sử ↑
  await p.click('.lab-item[data-id="L01"]');
  await p.click('.lab-tab[data-id="pckt1"]');
  await type('ipconfig 192.168.10.1 255.255.255.192 192.168.10.62');
  await p.press('#lab-in', 'ArrowUp');
  ok(await p.inputValue('#lab-in') === 'ipconfig 192.168.10.1 255.255.255.192 192.168.10.62', 'lịch sử ↑ trong console');
  await p.fill('#lab-in', '');
  await p.waitForFunction(() => document.querySelector('.lab-score')?.textContent === '1/4', null, { timeout: 2000 }).catch(() => {});
  ok((await p.textContent('.lab-score')) === '1/4', 'gõ tay làm đạt nhiệm vụ (L01 1/4)');
  // 2) bước guide + gain
  await p.click('.lab-item[data-id="X05"]');
  await p.click('.lab-guide summary');
  for (let g = 0; g < 4; g++) await p.click(`.lab-grun[data-g="${g}"]`);
  ok((await p.textContent('.lab-score')) === '7/8', 'X05: 4 bước guide → 7/8 (còn quiz)');
  ok(!!(await p.$('.lab-gain')), 'thông báo nhiệm vụ vừa đạt');
  await p.click('.lab-tab[data-id="hq"]');
  await type('show ipv6 route');
  ok((await p.$$eval('.lab-ln', (x) => x.map((e) => e.textContent))).some((l) => l.startsWith('OI  2001:DB8:20::/64')), 'show ipv6 route có OI');
  await p.click('.lab-tab[data-id="pbr"]');
  await type('ping 2001:4860:4860::8888');
  ok((await p.$$eval('.lab-ln.good', (x) => x.length)) > 0, 'PC ping IPv6 ra Internet');
  // 3) thi thử: gõ lệnh trong lúc thi
  await p.click('.lab-item[data-id="A05"]');
  await p.click('#lab-exam');
  await p.click('.lab-tab[data-id="sw"]');
  await type('enable');
  ok((await p.textContent('#lab-prompt')) === 'SW-T2#', 'gõ lệnh khi đang thi thử');
  await p.click('#lab-submit');
  ok(!!(await p.$('.lab-exres')), 'nộp bài thi');
  // 4) sandbox: mẫu, gõ lệnh, hoàn tác
  await p.click('#lab-sbx-open');
  await p.selectOption('#lab-t-tpl', 'lan');
  await p.click('.lab-tab[data-id="pc1"]');
  await type('ipconfig 10.0.0.1 255.255.255.0');
  await p.press('#lab-in', 'ArrowUp');
  ok((await p.inputValue('#lab-in')).startsWith('ipconfig'), 'sandbox: lịch sử ↑');
  await p.fill('#lab-in', '');
  await p.click('#lab-t-undo');
  ok(!(await p.textContent('.lab-topo')).includes('10.0.0.1/24'), 'sandbox: hoàn tác lệnh CLI');
  await p.click('#lab-t-ren');
  ok((await p.textContent('.lab-topo')).includes('RENAMED'), 'sandbox: đổi tên');
  // 5) nối dây A04
  await p.click('.lab-item[data-id="A04"]');
  await p.click('#lab-t-wire');
  const n = await p.$$('.lab-node'); await n[0].click(); const n2 = await p.$$('.lab-node'); await n2[1].click();
  await p.click('#lab-w-ok');
  ok((await p.$$eval('.lab-link', (x) => x.length)) >= 1, 'nối dây A04');
  // 6) firewall ASA: cách giải F02 + show conn, biểu tượng firewall, sandbox thêm ASA
  await p.click('.lab-item[data-id="F02"]');
  await p.click('.lab-guide summary');
  for (let g = 0; g < 3; g++) await p.click(`.lab-grun[data-g="${g}"]`);
  ok((await p.textContent('.lab-score')) === '5/6', 'F02: 3 bước guide → 5/6 (còn quiz)');
  await p.click('.lab-tab[data-id="asa"]');
  await type('show conn');
  ok((await p.$$eval('.lab-ln', (x) => x.map((e) => e.textContent))).some((l) => /^TCP dmz 172\.16\.1\.10:80/.test(l)), 'ASA show conn có phiên vào web DMZ');
  await type('show bogus');
  ok((await p.$$eval('.lab-ln.err', (x) => x.length)) > 0, 'lệnh sai trên ASA hiện lỗi');
  ok(!!(await p.$('.lab-g.fw')), 'topology vẽ biểu tượng firewall');
  await p.click('#lab-sbx-open');
  await p.click('[data-add="asa"]');
  ok((await p.$$eval('.lab-node', (x) => x.map((e) => e.getAttribute('aria-label')))).includes('ASA1'), 'sandbox: thêm firewall ASA');
  await p.click('[data-add="fortios"]');
  ok((await p.textContent('#lab-prompt')).includes('FGT1') && await p.isVisible('#lab-term'), 'sandbox: thêm FortiGate → console FortiOS');
  await p.click('[data-add="pfsense"]');
  ok(await p.isVisible('#lab-gui') && (await p.textContent('#lab-gui')).includes('pfSense'), 'sandbox: thêm pfSense → trang quản trị web');
  await p.screenshot({ path: process.env.SHOT_SBX || '/dev/null' }).catch(() => {});
  // 7) FortiGate + Palo Alto: CLI riêng, prompt theo ngữ cảnh, commit
  await p.click('.lab-item[data-id="FG02"]');
  await p.click('.lab-guide summary');
  for (let g = 0; g < 3; g++) await p.click(`.lab-grun[data-g="${g}"]`);
  ok((await p.textContent('.lab-score')) === '5/5', 'FG02: 3 bước guide → 5/5');
  await p.click('.lab-tab[data-id="fw"]');
  await type('config firewall policy');
  ok((await p.textContent('#lab-prompt')).includes('(policy) #'), 'FortiGate: prompt theo ngữ cảnh config');
  await type('end');
  await p.click('.lab-item[data-id="PA01"]');
  await p.click('.lab-tab[data-id="fw"]');
  await type('configure');
  ok((await p.textContent('#lab-prompt')).trim().endsWith('#'), 'Palo Alto: vào configure');
  await type('commit');
  ok((await p.$$eval('.lab-ln', (x) => x.map((e) => e.textContent))).some((l) => l.includes('Configuration committed successfully')), 'Palo Alto: commit');
  // 8) Firewall giao diện web (pfSense / Check Point / Sophos): làm PF01 hoàn toàn bằng click
  await p.click('.lab-item[data-id="PF01"]');
  await p.click('.lab-tab[data-id="fw"]');
  ok(await p.isVisible('#lab-gui') && !(await p.isVisible('#lab-term')), 'pfSense: hiện trang quản trị web thay terminal');
  await p.click('#lab-gui [data-tab="Firewall Rules"]');
  await p.click('#lab-gui details.gf-add summary');
  await p.fill('#gf-rn', 'Web-DNS-Ping');
  await p.selectOption('#gf-rsrc', ['LAN net']);
  await p.selectOption('#gf-rsvc', ['HTTP', 'HTTPS', 'DNS', 'PING']);
  await p.click('#gf-radd');
  await p.click('#lab-gui [data-del="Default allow LAN to any"]');
  ok(await p.isVisible('#gf-commit'), 'pfSense: có nút Apply Changes khi còn thay đổi');
  await p.click('#gf-commit');
  await p.click('.lab-qopt[data-o="0"]');
  await p.waitForTimeout(100);
  ok((await p.textContent('.lab-score')) === '5/5', 'PF01: thêm rule + xoá rule mặc định + Apply qua GUI → 5/5');
  await p.click('.lab-item[data-id="CP01"]');
  await p.click('.lab-guide summary');
  for (let g = 0; g < 3; g++) await p.click(`.lab-grun[data-g="${g}"]`);
  await p.click('.lab-tab[data-id="fw"]');
  await p.click('.lab-qopt[data-o="0"]');
  await p.waitForTimeout(100);
  ok((await p.textContent('.lab-score')) !== '5/5' && (await p.textContent('#lab-gui')).includes('Install'), 'Check Point: chưa Install Policy thì chưa đạt');
  await p.click('#gf-commit');
  await p.waitForTimeout(100);
  ok((await p.textContent('.lab-score')) === '5/5', 'CP01: Install Policy → 5/5');
  await p.click('.lab-item[data-id="SP01"]');
  await p.click('.lab-tab[data-id="fw"]');
  await p.click('#lab-gui [data-tab="Hosts & services"]');
  await p.fill('#gf-on', 'X'); await p.fill('#gf-oa', 'abc'); await p.click('#gf-oadd');
  ok((await p.textContent('#lab-gui')).includes('ERROR'), 'Sophos: thao tác sai hiện ERROR');
  await p.screenshot({ path: process.env.SHOT || '/dev/null' }).catch(() => {});
  ok(errs.length === 0, 'không có lỗi JS: ' + JSON.stringify(errs).slice(0, 300));
  await b.close();
  server.close();
});
