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
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage();
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
  // 4) workspace tự dựng mạng (kiểu EVE-NG): mẫu, console nổi, lịch sử, hoàn tác, đổi tên, Add node, Start/Stop/Wipe
  const wsText = (sel) => p.$$eval(sel, (x) => x.map((e) => e.textContent).join('\n'));
  const wsMenu = async (id, label) => { await p.click(`.ws-node[data-id="${id}"]`, { button: 'right' }); await p.click(`.ws-menu button:has-text("${label}")`); };
  await p.click('#lab-sbx-open');
  ok(await p.isVisible('.ws'), 'workspace toàn màn hình mở');
  await p.selectOption('#ws-tpl', 'lan');
  await p.dblclick('.ws-node[data-id="pc1"]');
  const pcIn = '.ws-win[data-id="pc1"] .lab-in';
  await p.fill(pcIn, 'ipconfig 10.0.0.1 255.255.255.0'); await p.press(pcIn, 'Enter');
  ok((await wsText('.ws-svg')).includes('10.0.0.1/24'), 'workspace: console nổi gõ lệnh → topology cập nhật');
  await p.press(pcIn, 'ArrowUp');
  ok((await p.inputValue(pcIn)).startsWith('ipconfig'), 'workspace: lịch sử ↑ trong console');
  await p.fill(pcIn, '');
  await p.click('#ws-undo');
  ok(!(await wsText('.ws-svg')).includes('10.0.0.1/24'), 'workspace: hoàn tác lệnh CLI');
  await wsMenu('pc1', 'Đổi tên');
  ok((await wsText('.ws-svg')).includes('RENAMED'), 'workspace: đổi tên (chuột phải)');
  await p.click('.ws-pi[data-kind="router"]');
  await p.fill('#ad-n', '2'); await p.fill('#ad-pre', 'HN'); await p.fill('#ad-ports', '2');
  ok((await p.textContent('#ad-prev')).includes('Gi0/1') && !(await p.textContent('#ad-prev')).includes('Gi0/2'), 'Add node: xem trước tên cổng theo mẫu + số cổng');
  await p.click('#ad-ok');
  ok((await p.getAttribute('.ws-node[data-id="hn1"]', 'class')).includes(' off') && !!(await p.$('.ws-node[data-id="hn2"]')), 'Add node: 2 router HN1, HN2 ở trạng thái tắt');
  await p.click('#ws-wire'); await p.click('.ws-node[data-id="hn1"]'); await p.click('.ws-node[data-id="sw1"]');
  await p.selectOption('#w-b', 'g0/2'); await p.click('#w-ok');
  ok((await p.$$eval('.ws .lab-link', (x) => x.map((e) => e.getAttribute('class')))).includes('lab-link down'), 'nối dây tới router đang tắt → link down');
  await wsMenu('hn1', 'Start');
  await p.dblclick('.ws-node[data-id="hn1"]');
  const rIn = '.ws-win[data-id="hn1"] .lab-in';
  ok(await p.isDisabled(rIn), 'Start: đang khởi động thì chưa gõ được');
  await p.waitForFunction((sel) => !document.querySelector(sel)?.disabled, rIn, { timeout: 4000 });
  ok((await wsText('.ws-win[data-id="hn1"] .lab-ln.boot')).includes('Press RETURN'), 'Start: hiện log khởi động trong console');
  for (const c of ['enable', 'configure terminal', 'interface g0/0', 'ip address 10.0.0.254 255.255.255.0', 'no shutdown', 'end']) { await p.fill(rIn, c); await p.press(rIn, 'Enter'); }
  ok((await p.textContent('.ws-win[data-id="hn1"] .lab-prompt')) === 'HN1#', 'console router gõ lệnh sau khi khởi động');
  ok((await p.$$eval('.ws-win', (x) => x.filter((e) => !e.hidden).length)) === 2, 'mở 2 console cùng lúc');
  await wsMenu('hn1', 'Stop');
  ok((await p.getAttribute('.ws-node[data-id="hn1"]', 'class')).includes(' off') && await p.isDisabled(rIn), 'Stop: icon xám, console ngắt');
  await wsMenu('hn1', 'Wipe');
  await p.click('#ws-start');
  await p.waitForFunction((sel) => !document.querySelector(sel)?.disabled, rIn, { timeout: 4000 });
  await p.fill(rIn, 'show running-config | include 10.0.0.254'); await p.press(rIn, 'Enter');
  ok(!(await wsText('.ws-win[data-id="hn1"] .lab-out')).includes('ip address 10.0.0.254'), 'Wipe: cấu hình về trống; Start all bật lại');
  await p.click('.ws-win[data-id="hn1"] [data-w="min"]');
  ok((await p.textContent('#ws-dock')).includes('HN1'), 'thu nhỏ console xuống thanh dưới');
  await p.click('.ws-zoom [data-z="+"]');
  ok((await p.textContent('#ws-zl')) !== '100%', 'phóng to canvas');
  await p.$eval('[data-link]', (e) => e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 300, clientY: 300 })));
  ok((await wsText('.ws-menu')).includes('Xoá dây'), 'chuột phải vào dây → Xoá dây');
  await p.keyboard.press('Escape');
  // capture trên dây (kiểu Wireshark): Start capture → ping → bảng gói, lọc, chi tiết, .pcap
  const capLink = await p.$eval('.ws-link-hit[data-link*="pc2:fa0"]', (e) => e.dataset.link);
  await p.$eval(`.ws-link-hit[data-link="${capLink}"]`, (e) => e.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 400, clientY: 300 })));
  await p.click('.ws-menu button:has-text("Start capture")');
  const cw = `.ws-win[data-id="cap:${capLink}"]`;
  ok(await p.isVisible(cw) && !!(await p.$('.ws-cap-ico')), 'Start capture: mở cửa sổ capture + kính lúp trên dây');
  for (const [dev, c] of [['pc3', 'ipconfig 10.0.0.3 255.255.255.0'], ['pc2', 'ipconfig 10.0.0.2 255.255.255.0'], ['pc2', 'ping 10.0.0.3']]) {
    await p.dblclick(`.ws-node[data-id="${dev}"]`);
    const i = `.ws-win[data-id="${dev}"] .lab-in`;
    await p.fill(i, c); await p.press(i, 'Enter');
  }
  const capRows = await p.$$eval(`${cw} tbody tr`, (x) => x.map((e) => e.textContent));
  ok(capRows.some((r) => r.includes('Who has 10.0.0.3? Tell 10.0.0.2')) && capRows.filter((r) => r.includes('Echo (ping) request')).length === 4, 'capture: ARP + 4 Echo request của lệnh ping');
  await p.fill(`${cw} .ws-cap-f`, 'arp'); await p.press(`${cw} .ws-cap-f`, 'Enter');
  ok((await p.$$eval(`${cw} tbody tr`, (x) => x.every((e) => e.textContent.includes('ARP')))) && (await p.textContent(`${cw} .ws-cap-foot`)).startsWith('Đang hiển thị 2 /'), 'capture: bộ lọc "arp"');
  await p.click(`${cw} .ws-wn`); // đưa cửa sổ capture lên trên console
  await p.click(`${cw} tbody tr >> nth=0`);
  ok((await p.$$eval(`${cw} .flayer`, (x) => x.length)) === 2 && (await p.$$eval(`${cw} .hex-row`, (x) => x.length)) > 0, 'capture: bấm gói → cây trường + hex dump');
  const [capDl] = await Promise.all([p.waitForEvent('download'), p.click(`${cw} [data-c="pcap"]`)]);
  ok(capDl.suggestedFilename().endsWith('.pcap'), 'capture: tải file .pcap');
  await p.click('#ws-close');
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
  ok((await p.$$eval('.lab-topo .lab-g.cloud', (x) => x.length)) === 1 && (await p.$$eval('.lab-topo .lab-name', (x) => x.map((e) => e.textContent))).includes('INTERNET 8.8.8.8'), 'Internet vẽ thành đám mây (kèm tên)');
  await p.click('#lab-sbx-open');
  for (const k of ['asa', 'fortios', 'pfsense', 'cloud']) { await p.click(`.ws-pi[data-kind="${k}"]`); await p.click('#ad-ok'); }
  ok(!!(await p.$('.ws-node[data-id="internet1"] .lab-g.cloud')), 'workspace: mẫu Cloud / Internet (nhóm Network) vẽ đám mây');
  ok((await p.$$eval('.ws-node', (x) => x.map((e) => e.getAttribute('aria-label')))).includes('ASA1'), 'workspace: thêm firewall ASA');
  await p.click('#ws-start');
  await wsMenu('fgt1', 'Console');
  await p.waitForFunction(() => !document.querySelector('.ws-win[data-id="fgt1"] .lab-in')?.disabled, null, { timeout: 4000 });
  ok((await p.textContent('.ws-win[data-id="fgt1"] .lab-prompt')).includes('FGT1'), 'workspace: FortiGate → console FortiOS');
  await wsMenu('pfs1', 'Console');
  await p.waitForFunction(() => document.querySelector('.ws-win[data-id="pfs1"] .ws-wbody')?.dataset.mode === 'gui', null, { timeout: 4000 });
  ok((await wsText('.ws-win[data-id="pfs1"]')).includes('pfSense'), 'workspace: pfSense → trang quản trị web trong cửa sổ');
  await p.screenshot({ path: process.env.SHOT_SBX || '/dev/null' }).catch(() => {});
  await p.click('#ws-close');
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
  // 9) Bảo mật L2 + thiết bị
  await p.click('.lab-item[data-id="S01"]');
  await p.click('.lab-guide summary');
  for (let g = 0; g < 4; g++) await p.click(`.lab-grun[data-g="${g}"]`);
  await p.waitForTimeout(100);
  ok((await p.textContent('.lab-score')) === '4/5', 'S01: 4 bước guide (snooping + trust + renew) → 4/5 (còn câu quiz)');
  await p.click('.lab-item[data-id="S04"]');
  await p.click('.lab-tab[data-id="hacker"]');
  await type('ssh -l admin 10.1.1.1');
  ok((await p.getAttribute('#lab-in', 'type')) === 'password' && (await p.textContent('#lab-prompt')).includes('Password'), 'SSH từ PC hỏi mật khẩu (ô nhập ẩn)');
  await type('sai');
  ok((await p.$$eval('.lab-ln', (x) => x.map((e) => e.textContent))).some((l) => l.includes('Authentication failed')), 'SSH sai mật khẩu → Authentication failed');
  ok(errs.length === 0, 'không có lỗi JS: ' + JSON.stringify(errs).slice(0, 300));
  await b.close();
  server.close();
});
