// lab/diagram.js — lõi trình vẽ sơ đồ mạng kiểu draw.io (✏️ Vẽ mạng — CHỈ để vẽ; cấu hình & chạy thử nằm ở Lab CLI /
// workspace): hình (thiết bị mạng + hình cơ bản), dây nối (thẳng / gấp khúc / cong, nét liền / gạch / chấm, mũi tên,
// nhãn giữa + nhãn cổng 2 đầu), nhóm, khoá, căn lề, dàn đều, thứ tự lớp, hoàn tác, xuất SVG (chuỗi — dùng cho cả vẽ
// trên màn hình và tải file / chuyển PNG), nhập/xuất JSON, mẫu sơ đồ. Hàm thuần, không đụng DOM — giao diện ở ui/diagram.js.

export const FORMAT = 'packet-journey-diagram';
export const GRID = 10;
const DASH = { solid: '', dash: '8 6', dot: '2 5' };
export const EDGE_ARROW_TYPES = [
  ['none','Không'],['classic','Tam giác cổ điển'],['block','Tam giác đặc'],['open','Mũi tên hở'],
  ['diamond','Hình thoi'],['openDiamond','Thoi rỗng'],['oval','Vòng tròn'],['bar','Vạch'],
  ['doubleBar','Hai vạch'],['crowFoot','Chân quạ'],['ERone','Một'],['ERmany','Nhiều'],
  ['ERzeroToOne','Không hoặc một'],['ERoneToMany','Một hoặc nhiều'],['ERzeroToMany','Không hoặc nhiều'],
];
const ARROW_IDS = new Set(EDGE_ARROW_TYPES.map(([id]) => id));
export function edgeArrowType(e, end) {
  const key = `arrow${end}Type`, flag = `arrow${end}`;
  return ARROW_IDS.has(e?.[key]) ? e[key] : e?.[flag] ? 'classic' : 'none';
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// ---------------------------------------------------------------- thư viện hình
export const SHAPES = {
  router: { group: 'net', vi: 'Router', en: 'Router', w: 64, h: 52, fill: '#e8f1fb', stroke: '#2f6fde', prefix: 'R' },
  switch: { group: 'net', vi: 'Switch', en: 'Switch', w: 72, h: 44, fill: '#e9f7ef', stroke: '#2e9e57', prefix: 'SW' },
  l3switch: { group: 'net', vi: 'Switch Layer 3', en: 'Layer 3 switch', w: 72, h: 50, fill: '#e6f4f1', stroke: '#16857a', prefix: 'L3SW' },
  firewall: { group: 'net', vi: 'Firewall', en: 'Firewall', w: 60, h: 52, fill: '#fdecea', stroke: '#d64545', prefix: 'FW' },
  server: { group: 'net', vi: 'Server', en: 'Server', w: 44, h: 60, fill: '#eef0f3', stroke: '#5b6573', prefix: 'SRV' },
  pc: { group: 'net', vi: 'PC', en: 'PC', w: 60, h: 52, fill: '#ffffff', stroke: '#2b4a6f', prefix: 'PC' },
  laptop: { group: 'net', vi: 'Laptop', en: 'Laptop', w: 64, h: 46, fill: '#ffffff', stroke: '#2b4a6f', prefix: 'LT' },
  phone: { group: 'net', vi: 'Điện thoại IP', en: 'IP phone', w: 44, h: 52, fill: '#ffffff', stroke: '#6c4bb6', prefix: 'IPP' },
  ap: { group: 'net', vi: 'Access Point', en: 'Access point', w: 56, h: 48, fill: '#fff6e8', stroke: '#e67e22', prefix: 'AP' },
  wlc: { group: 'net', vi: 'WLC', en: 'WLC', w: 72, h: 40, fill: '#fff6e8', stroke: '#c0661a', prefix: 'WLC' },
  printer: { group: 'net', vi: 'Máy in', en: 'Printer', w: 56, h: 48, fill: '#ffffff', stroke: '#5b6573', prefix: 'PRN' },
  cloud: { group: 'net', vi: 'Internet / Cloud', en: 'Internet / cloud', w: 110, h: 64, fill: '#eef5ff', stroke: '#6b8fc7', prefix: 'INTERNET' },
  rect: { group: 'basic', vi: 'Chữ nhật', en: 'Rectangle', w: 140, h: 70, fill: '#ffffff', stroke: '#2b4a6f' },
  round: { group: 'basic', vi: 'Bo góc', en: 'Rounded', w: 140, h: 70, fill: '#ffffff', stroke: '#2b4a6f' },
  ellipse: { group: 'basic', vi: 'Elip', en: 'Ellipse', w: 120, h: 80, fill: '#ffffff', stroke: '#2b4a6f' },
  text: { group: 'basic', vi: 'Chữ', en: 'Text', w: 120, h: 30, fill: 'none', stroke: 'none' },
  zone: { group: 'basic', vi: 'Vùng / khung', en: 'Zone', w: 320, h: 200, fill: '#2f6fde', stroke: '#2f6fde' },
  note: { group: 'basic', vi: 'Ghi chú', en: 'Note', w: 150, h: 80, fill: '#fff8c5', stroke: '#d4b106' },
};
const addSymbols = (group, entries) => { for (const [t, vi, en, glyph, fill = '#f3f6fb', stroke = '#496985'] of entries) SHAPES[t] = { group, vi, en, w: 64, h: 52, fill, stroke, glyph, prefix: t.replace(/([a-z])([A-Z])/g, '$1-$2').toUpperCase(), connectable: true }; };
addSymbols('net', [
  ['modem', 'Modem', 'Modem', 'MDM'], ['homeRouter', 'Router Wi-Fi gia đình', 'Home Wi-Fi router', 'Wi-Fi'], ['hub', 'Hub', 'Hub', 'HUB'], ['loadBalancer', 'Load balancer', 'Load balancer', 'LB'], ['idsIps', 'IDS / IPS', 'IDS / IPS', 'IDS'], ['vpnGateway', 'VPN gateway', 'VPN gateway', 'VPN'], ['ipPbx', 'Tổng đài IP', 'IP PBX', 'PBX'], ['rack', 'Tủ rack', 'Rack', 'RACK'], ['ups', 'Bộ lưu điện UPS', 'UPS', 'UPS', '#fff6e8', '#c0661a'], ['nas', 'NAS / SAN', 'NAS / SAN', 'NAS'],
  ['webServer', 'Web server', 'Web server', 'WEB'], ['mailServer', 'Mail server', 'Mail server', 'MAIL'], ['dnsServer', 'DNS server', 'DNS server', 'DNS'], ['dhcpServer', 'DHCP server', 'DHCP server', 'DHCP'], ['database', 'Cơ sở dữ liệu', 'Database', 'DB', '#edf2ff', '#5266a8'], ['virtualMachine', 'Máy ảo / hypervisor', 'VM / hypervisor', 'VM'], ['serverCluster', 'Cụm server', 'Server cluster', 'N×'],
  ['user', 'Người dùng', 'User', 'USER'], ['mobile', 'Điện thoại di động', 'Mobile phone', 'MOB'], ['tablet', 'Máy tính bảng', 'Tablet', 'TAB'], ['camera', 'Camera IP', 'IP camera', 'CAM'], ['iot', 'Thiết bị IoT', 'IoT device', 'IoT'], ['television', 'Màn hình / TV', 'Display / TV', 'TV'],
  ['building', 'Toà nhà / chi nhánh', 'Building / branch', 'HQ'], ['cellTower', 'Trạm 4G / 5G', '4G / 5G tower', '5G'], ['satellite', 'Vệ tinh', 'Satellite', 'SAT'], ['publicCloud', 'Cloud công cộng', 'Public cloud', 'CLOUD'], ['mplsCloud', 'Cloud MPLS', 'MPLS cloud', 'MPLS'], ['isp', 'Nhà mạng ISP', 'ISP', 'ISP'],
  ['bridge', 'Bridge', 'Network bridge', 'BRG'], ['repeater', 'Repeater', 'Repeater', 'REP'], ['mediaConverter', 'Bộ chuyển quang', 'Media converter', 'FO'], ['sdwanEdge', 'SD-WAN edge', 'SD-WAN edge', 'SD-WAN'], ['wirelessController', 'Wireless controller', 'Wireless controller', 'WLC'], ['antenna', 'Ăng-ten Wi-Fi', 'Wi-Fi antenna', 'Wi-Fi'],
  ['olt', 'OLT (GPON)', 'OLT (GPON)', 'OLT'], ['ont', 'ONT / modem quang', 'ONT / fiber modem', 'ONT'], ['splitter', 'Bộ chia quang', 'Optical splitter', 'SPL'], ['sbc', 'SBC (biên thoại)', 'Session border controller', 'SBC'], ['voiceGateway', 'Voice gateway', 'Voice gateway', 'VGW'], ['nvr', 'Đầu ghi hình NVR', 'Network video recorder', 'NVR'],
  ['atm', 'Máy ATM', 'ATM', 'ATM'], ['posTerminal', 'Máy POS', 'POS terminal', 'POS'], ['plc', 'PLC', 'PLC', 'PLC'], ['consoleServer', 'Console server', 'Console server', 'CON'], ['hsm', 'HSM', 'Hardware security module', 'HSM'],
  ['patchPanel', 'Patch panel', 'Patch panel', 'PP'], ['pdu', 'PDU', 'Rack PDU', 'PDU'], ['kvm', 'KVM switch', 'KVM switch', 'KVM'], ['precisionCooling', 'Điều hoà phòng máy', 'Precision cooling', 'CRAC'], ['temperatureSensor', 'Cảm biến nhiệt', 'Temperature sensor', 'TEMP'], ['smokeSensor', 'Cảm biến khói', 'Smoke sensor', 'SMOKE'], ['doorAccess', 'Kiểm soát cửa', 'Door access control', 'AC'],
  ['waf', 'Web application firewall', 'Web application firewall', 'WAF'], ['proxy', 'Proxy server', 'Proxy server', 'PROXY'], ['bastion', 'Bastion host', 'Bastion host', 'JUMP'], ['nac', 'Network access control', 'Network access control', 'NAC'], ['dlp', 'Data loss prevention', 'Data loss prevention', 'DLP'], ['siem', 'SIEM', 'SIEM', 'SIEM'], ['mfa', 'Xác thực đa yếu tố', 'Multi-factor authentication', 'MFA'], ['identityProvider', 'Identity provider', 'Identity provider', 'IdP'], ['vpnClient', 'VPN client', 'VPN client', 'VPN'],
]);
Object.assign(SHAPES.rack,{w:180,h:240,container:true,rackUnits:12});
addSymbols('devops', [
  ['container', 'Container', 'Container', 'CTR'], ['containerImage', 'Container image', 'Container image', 'IMG'], ['registry', 'Registry', 'Registry', 'REG'], ['pod', 'Pod', 'Pod', 'POD'], ['node', 'Node', 'Node', 'NODE'], ['cluster', 'Cluster', 'Cluster', 'CL'], ['namespace', 'Namespace', 'Namespace', 'NS'], ['deployment', 'Deployment', 'Deployment', 'DEP'], ['service', 'Service', 'Service', 'SVC'], ['ingress', 'Ingress', 'Ingress', 'ING'], ['configSecret', 'ConfigMap / Secret', 'ConfigMap / Secret', 'CFG'], ['volume', 'Volume', 'Volume', 'VOL'],
  ['gitRepo', 'Git repository', 'Git repository', 'GIT'], ['gitBranch', 'Nhánh Git', 'Git branch', 'BR'], ['mergeRequest', 'Merge / pull request', 'Merge / pull request', 'MR'], ['pipeline', 'Pipeline CI/CD', 'CI/CD pipeline', 'CI/CD'], ['runner', 'Runner / agent', 'Runner / agent', 'RUN'], ['artifact', 'Artifact', 'Artifact', 'ART'],
  ['vm', 'Virtual machine', 'Virtual machine', 'VM'], ['autoscaling', 'Autoscaling group', 'Autoscaling group', 'ASG'], ['function', 'Serverless function', 'Serverless function', 'FN'], ['apiGateway', 'API gateway', 'API gateway', 'API'], ['cdn', 'CDN', 'CDN', 'CDN'], ['objectStorage', 'Object storage', 'Object storage', 'OBJ'], ['blockStorage', 'Block storage', 'Block storage', 'BLK'], ['queue', 'Message queue', 'Message queue', 'MQ'], ['cache', 'Cache', 'Cache', 'CACHE'], ['sqlDatabase', 'CSDL SQL', 'SQL database', 'SQL'], ['nosqlDatabase', 'CSDL NoSQL', 'NoSQL database', 'NoSQL'], ['timeSeriesDb', 'CSDL time-series', 'Time-series database', 'TS'], ['vault', 'Kho bí mật', 'Secret vault', 'VAULT'], ['iam', 'IAM', 'IAM', 'IAM'],
  ['monitor', 'Monitoring / metrics', 'Monitoring / metrics', 'MET'], ['logging', 'Logging', 'Logging', 'LOG'], ['tracing', 'Tracing', 'Tracing', 'TRACE'], ['alert', 'Cảnh báo', 'Alert', '!'], ['dashboard', 'Dashboard', 'Dashboard', 'DASH'], ['iac', 'Infrastructure as Code', 'Infrastructure as Code', 'IaC'], ['configMgmt', 'Quản lý cấu hình', 'Config management', 'CFG'], ['onCall', 'On-call', 'On-call', 'CALL'],
  ['browser', 'Trình duyệt / client', 'Browser / client', 'WEB'], ['mobileApp', 'Ứng dụng di động', 'Mobile app', 'APP'], ['microservice', 'Microservice', 'Microservice', 'µS'], ['frontend', 'Frontend', 'Frontend', 'FE'], ['backend', 'Backend', 'Backend', 'BE'], ['developer', 'Developer / DevOps', 'Developer / DevOps', 'DEV'],
  ['helmChart', 'Helm chart', 'Helm chart', 'HELM'], ['operator', 'Kubernetes operator', 'Kubernetes operator', 'OP'], ['ingressController', 'Ingress controller', 'Ingress controller', 'ING'], ['serviceMesh', 'Service mesh', 'Service mesh', 'MESH'], ['imageScanner', 'Image scanner', 'Container image scanner', 'SCAN'], ['objectBucket', 'Object bucket', 'Object storage bucket', 'BUCKET'], ['snapshot', 'Snapshot', 'Storage snapshot', 'SNAP'], ['replication', 'Replication', 'Data replication', 'REPL'],
]);
Object.assign(SHAPES.pipeline, { w: 240, h: 64, glyph: 'CI/CD' });
addSymbols('basic', [
  ['triangle', 'Tam giác', 'Triangle', '△'], ['hexagon', 'Lục giác', 'Hexagon', '⬡'], ['cylinder', 'Hình trụ', 'Cylinder', 'DB'], ['star', 'Ngôi sao', 'Star', '★'], ['callout', 'Khung chú thích', 'Callout', 'NOTE'], ['table', 'Bảng', 'Table', 'TBL'], ['lock', 'Ổ khoá', 'Lock', 'LOCK'], ['blockArrow', 'Mũi tên khối', 'Block arrow', '➜'],
  ['terminator', 'Bắt đầu / kết thúc', 'Terminator', 'BẮT ĐẦU', '#e9f7ef', '#2e9e57'], ['decision', 'Quyết định', 'Decision', '?', '#fff6e8', '#e67e22'], ['flowData', 'Dữ liệu', 'Data', 'DATA'], ['document', 'Tài liệu', 'Document', 'DOC'], ['connector', 'Đầu nối trang', 'Off-page connector', 'A'],
  ['lifeline', 'Sequence lifeline', 'Sequence lifeline', 'ACTOR'], ['activation', 'Khối hoạt động', 'Activation', ''], ['messageCall', 'Lời gọi', 'Call message', '→'], ['messageReturn', 'Trả về', 'Return message', '⇠'], ['umlClass', 'Lớp UML', 'UML class', 'Class'],
]);
for (const t of ['terminator','decision','flowData','document','connector']) Object.assign(SHAPES[t], { w: 110, h: 64, connectable: false });
Object.assign(SHAPES.lifeline,{w:110,h:200,connectable:false}); Object.assign(SHAPES.activation,{w:20,h:80,connectable:false});
for(const t of ['messageCall','messageReturn'])Object.assign(SHAPES[t],{w:160,h:32,connectable:false}); Object.assign(SHAPES.umlClass,{w:160,h:110,connectable:false});
Object.assign(SHAPES.terminator,{defaultLabel:'Bắt đầu / kết thúc'}); Object.assign(SHAPES.decision,{defaultLabel:'Điều kiện?'}); Object.assign(SHAPES.flowData,{defaultLabel:'Dữ liệu'}); Object.assign(SHAPES.document,{defaultLabel:'Tài liệu'}); Object.assign(SHAPES.connector,{defaultLabel:'A'}); Object.assign(SHAPES.lifeline,{defaultLabel:'Đối tượng'}); Object.assign(SHAPES.messageCall,{defaultLabel:'Gọi'}); Object.assign(SHAPES.messageReturn,{defaultLabel:'Trả về'}); Object.assign(SHAPES.umlClass,{defaultLabel:'Class'});
for (const [t, vi, en, fill, stroke] of [
  ['region', 'Region', 'Region', '#2463eb', '#2463eb'], ['availabilityZone', 'Availability zone', 'Availability zone', '#147d64', '#147d64'], ['vpc', 'VPC / VNet', 'VPC / VNet', '#7c3aed', '#7c3aed'], ['publicSubnet', 'Subnet public', 'Public subnet', '#16855b', '#16855b'], ['privateSubnet', 'Subnet private', 'Private subnet', '#5266a8', '#5266a8'], ['clusterBoundary', 'Cluster', 'Cluster boundary', '#167a8a', '#167a8a'], ['namespaceBoundary', 'Namespace', 'Namespace boundary', '#0f766e', '#0f766e'], ['securityGroup', 'Security group', 'Security group', '#d97706', '#d97706'], ['datacenter', 'On-premise / data center', 'On-premise / data center', '#475569', '#475569'], ['swimlane', 'Swimlane', 'Swimlane', '#8b5cf6', '#8b5cf6'],
]) SHAPES[t] = { group: 'basic', vi, en, w: 320, h: 200, fill, stroke, container: true };
SHAPES.zone.container = true;
for (const [t, vi, en, glyph, fill = '#f3f6fb', stroke = '#496985'] of [
  ['natGateway', 'NAT gateway', 'NAT gateway', 'NAT'], ['internetGateway', 'Internet gateway', 'Internet gateway', 'IGW'], ['vpcPeering', 'VPC peering', 'VPC peering', 'PEER'], ['privateLink', 'Private link', 'Private link', 'LINK'], ['transitGateway', 'Transit gateway', 'Transit gateway', 'TGW'], ['routeTable', 'Bảng định tuyến', 'Route table', 'ROUTE'], ['networkAcl', 'Network ACL', 'Network ACL', 'NACL'], ['cloudAccount', 'Tài khoản cloud', 'Cloud account', 'CLOUD'], ['siteToSiteVpn', 'VPN site-to-site', 'Site-to-site VPN', 'S2S'], ['sanSwitch', 'SAN switch', 'SAN switch', 'SAN'], ['tapeLibrary', 'Thư viện băng từ', 'Tape library', 'TAPE'], ['backupServer', 'Backup server', 'Backup server', 'BKP'], ['nasArray', 'NAS nhiều khay', 'NAS array', 'NAS×'], ['secretsManager', 'Secrets manager', 'Secrets manager', 'SECRETS'],
]) SHAPES[t] = { group: ['sanSwitch'].includes(t) ? 'net' : 'cloud', vi, en, w: 64, h: 52, fill, stroke, glyph, prefix: t.toUpperCase(), connectable: true };
for (const [t, vi, en, glyph, fill = '#f3f6fb', stroke = '#496985'] of [
  ['fiberSingle', 'Cáp quang single-mode', 'Single-mode fiber', 'SM'], ['fiberMulti', 'Cáp quang multi-mode', 'Multi-mode fiber', 'MM'], ['consoleCable', 'Cáp console', 'Console cable', 'CON'], ['wifiLink', 'Kết nối Wi-Fi', 'Wi-Fi link', 'Wi-Fi'], ['vpnLink', 'Đường hầm VPN', 'VPN tunnel', 'VPN'], ['trustZone', 'Vùng tin cậy', 'Trusted zone', 'TRUST'], ['untrustedZone', 'Vùng không tin cậy', 'Untrusted zone', 'UNTRUST'], ['redundancyMark', 'Dự phòng / HA', 'Redundancy / HA', 'HA'], ['faultMark', 'Điểm lỗi', 'Fault point', '!'],
]) SHAPES[t] = { group: 'basic', vi, en, w: 100, h: 64, fill, stroke, glyph, prefix: t.toUpperCase(), connectable: false, iconOnly: true };
for (const t of ['vm', 'autoscaling', 'function', 'apiGateway', 'cdn', 'objectStorage', 'blockStorage', 'queue', 'cache', 'sqlDatabase', 'nosqlDatabase', 'timeSeriesDb', 'vault', 'iam', 'natGateway', 'internetGateway', 'vpcPeering', 'privateLink', 'transitGateway', 'routeTable', 'networkAcl', 'cloudAccount', 'siteToSiteVpn', 'tapeLibrary', 'backupServer', 'nasArray', 'secretsManager']) SHAPES[t].group = 'cloud';
for (const t of ['helmChart', 'operator', 'ingressController', 'serviceMesh', 'imageScanner', 'objectBucket', 'snapshot', 'replication']) SHAPES[t].group = 'devops';
for (const t of ['region', 'availabilityZone', 'vpc', 'publicSubnet', 'privateSubnet', 'securityGroup']) SHAPES[t].group = 'cloud';
for (const t of ['clusterBoundary', 'namespaceBoundary']) SHAPES[t].group = 'devops';
for (const t of ['waf', 'proxy', 'bastion', 'nac', 'dlp', 'siem', 'mfa', 'identityProvider', 'vpnClient', 'hsm']) SHAPES[t].group = 'security';
for (const t of ['patchPanel', 'pdu', 'kvm', 'precisionCooling', 'temperatureSensor', 'smokeSensor', 'doorAccess', 'tapeLibrary', 'backupServer', 'nasArray', 'consoleServer']) SHAPES[t].group = 'physical';
for (const t of ['monitor', 'logging', 'tracing', 'alert', 'dashboard', 'iac', 'configMgmt', 'onCall']) SHAPES[t].group = 'ops';
for (const t of ['browser', 'mobileApp', 'microservice', 'frontend', 'backend', 'developer']) SHAPES[t].group = 'app';
for (const t of ['triangle', 'hexagon', 'cylinder', 'star', 'callout', 'table', 'lock', 'blockArrow']) SHAPES[t].connectable = false;
// Tên mặc định phải ngắn để không đè sang hình bên cạnh.
const SHORT_PREFIX = { olt: 'OLT', ont: 'ONT', splitter: 'SPLIT', sbc: 'SBC', voiceGateway: 'VGW', nvr: 'NVR', atm: 'ATM', posTerminal: 'POS', plc: 'PLC', consoleServer: 'CON', hsm: 'HSM', dashboard: 'DASH', replication: 'REPL', homeRouter: 'HR', loadBalancer: 'LB', idsIps: 'IPS', vpnGateway: 'VPN-GW', ipPbx: 'PBX', webServer: 'WEB', mailServer: 'MAIL', dnsServer: 'DNS', dhcpServer: 'DHCP', database: 'DB', virtualMachine: 'VM', serverCluster: 'CLUSTER', television: 'TV', building: 'SITE', cellTower: 'CELL', satellite: 'SAT', publicCloud: 'CLOUD', mplsCloud: 'MPLS', repeater: 'REP', mediaConverter: 'MC', sdwanEdge: 'SDWAN', wirelessController: 'WC', patchPanel: 'PP', precisionCooling: 'CRAC', temperatureSensor: 'TEMP', smokeSensor: 'SMOKE', doorAccess: 'DOOR', identityProvider: 'IDP', vpnClient: 'VPNC', containerImage: 'IMG', container: 'CTR', registry: 'REG', namespace: 'NS', deployment: 'DEPLOY', service: 'SVC', configSecret: 'SECRET', gitRepo: 'REPO', gitBranch: 'BRANCH', mergeRequest: 'MR', autoscaling: 'ASG', function: 'FN', apiGateway: 'API', objectStorage: 'OBJ', blockStorage: 'BLK', sqlDatabase: 'SQL', nosqlDatabase: 'NOSQL', timeSeriesDb: 'TSDB', configMgmt: 'CM', mobileApp: 'APP', microservice: 'MS', developer: 'DEV', helmChart: 'HELM', ingressController: 'INGC', serviceMesh: 'MESH', imageScanner: 'SCAN', objectBucket: 'BUCKET', natGateway: 'NAT', internetGateway: 'IGW', vpcPeering: 'PEER', privateLink: 'PL', transitGateway: 'TGW', routeTable: 'RT', networkAcl: 'NACL', cloudAccount: 'ACCOUNT', siteToSiteVpn: 'S2S', sanSwitch: 'SAN', tapeLibrary: 'TAPE', backupServer: 'BACKUP', nasArray: 'NAS-A', secretsManager: 'SECRETS' };
for (const [t, prefix] of Object.entries(SHORT_PREFIX)) SHAPES[t].prefix = prefix;
for (const t of ['triangle', 'hexagon', 'cylinder', 'star', 'lock', 'blockArrow', 'callout', 'table', 'activation', 'fiberSingle', 'fiberMulti', 'consoleCable', 'wifiLink', 'vpnLink', 'trustZone', 'untrustedZone', 'redundancyMark', 'faultMark']) SHAPES[t].defaultLabel = '';
Object.assign(SHAPES.lifeline, { defaultLabel: 'Đối tượng' }); Object.assign(SHAPES.messageCall, { defaultLabel: 'gọi()' }); Object.assign(SHAPES.messageReturn, { defaultLabel: 'trả về' }); Object.assign(SHAPES.umlClass, { defaultLabel: 'Lớp' }); Object.assign(SHAPES.connector, { defaultLabel: 'A' });
export const isDevice = (s) => SHAPES[s.t]?.connectable === true || SHAPES[s.t]?.group === 'net';
export const isContainer = (s) => !!SHAPES[s.t]?.container;

// ---------------------------------------------------------------- tạo sơ đồ / hình / dây
export const emptyDiagram = () => ({ format: FORMAT, version: 1, shapes: [], edges: [], seq: 0 });
const snap = (v, on = true) => (on ? Math.round(v / GRID) * GRID : v);
const nextId = (d, p) => { d.seq = (d.seq || 0) + 1; return p + d.seq; };
/** Tên thiết bị không trùng theo tiền tố: R1, R2… (đám mây: INTERNET, INTERNET2…). */
export function uniqueLabel(d, prefix) {
  const used = new Set(d.shapes.map((s) => s.label));
  for (let i = 1; ; i++) { const n = prefix + (prefix === 'INTERNET' && i === 1 ? '' : i); if (!used.has(n)) return n; }
}

/** Thêm hình loại t tại (x, y) (góc trên trái). Thiết bị được đặt tên không trùng theo tiền tố (R1, SW2…). Trả hình. */
export function addShape(d, t, x, y, o = {}) {
  const S = SHAPES[t];
  if (!S) throw new Error('Loại hình không hợp lệ: ' + t);
  const label = o.label ?? S.defaultLabel ?? (S.prefix ? uniqueLabel(d, S.prefix) : (t === 'text' ? 'Văn bản' : S.container ? S.vi : t === 'note' ? 'Ghi chú' : ''));
  const sh = { id: nextId(d, 's'), t, x: snap(x), y: snap(y), w: o.w ?? S.w, h: o.h ?? S.h, label, sub: o.sub ?? '', fill: o.fill ?? S.fill, stroke: o.stroke ?? S.stroke, sw: o.sw ?? 2, dash: o.dash ?? (S.container ? 'dash' : 'solid'), color: o.color ?? '#1f2933', fs: o.fs ?? (S.container ? 14 : 12), bold: o.bold ?? t !== 'note', italic: !!o.italic };
  if (t === 'pipeline') sh.steps = ['Build', 'Test', 'Scan', 'Deploy'];
  if (isDevice(sh)) { sh.meta = { ...(o.meta || {}) }; sh.ports = JSON.parse(JSON.stringify(o.ports || [])); }
  d.shapes.push(sh);
  return sh;
}
/** Nối 2 hình. Trả dây, hoặc null nếu trùng / nối chính nó. */
export function addEdge(d, a, b, o = {}) {
  if (a === b || !shapeOf(d, a) || !shapeOf(d, b)) return null;
  const arrowAType=ARROW_IDS.has(o.arrowAType)?o.arrowAType:o.arrowA?'classic':'none',arrowBType=ARROW_IDS.has(o.arrowBType)?o.arrowBType:o.arrowB?'classic':'none';
  const e = { id: nextId(d, 'e'), a, b, style: o.style || 'straight', dash: o.dash || 'solid', cable: o.cable || 'ethernet', speed: o.speed || '', mode: o.mode || '', vlans: o.vlans || '', color: o.color || (o.cable === 'fiber' ? '#e67e22' : '#4a6785'), width: o.width || 2, arrowA: arrowAType !== 'none', arrowB: arrowBType !== 'none', arrowAType, arrowBType, label: o.label || '', la: o.la || '', lb: o.lb || '', ...(PORTS.includes(o.portA) ? { portA: o.portA } : {}), ...(PORTS.includes(o.portB) ? { portB: o.portB } : {}) };
  d.edges.push(e);
  return e;
}
export const shapeOf = (d, id) => d.shapes.find((s) => s.id === id) || null;
export const edgeOf = (d, id) => d.edges.find((e) => e.id === id) || null;
/** Suggest an unused interface label for one endpoint (diagram note only). */
export function suggestPortName(d, shapeId) {
  const s = shapeOf(d, shapeId); if (!s || !isDevice(s)) return '';
  const used = new Set([...d.edges.filter((e) => e.a === shapeId || e.b === shapeId).map((e) => e.a === shapeId ? e.la : e.lb), ...(s.ports || []).map((p) => p.name)].filter(Boolean));
  const candidates = s.t === 'router' || s.t === 'l3switch'
    ? Array.from({ length: 64 }, (_, i) => `Gi0/${i}`)
    : s.t === 'switch' ? [...Array.from({ length: 24 }, (_, i) => `Fa0/${i + 1}`), ...Array.from({ length: 40 }, (_, i) => `Gi0/${i + 1}`)]
      : s.t === 'server' ? Array.from({ length: 32 }, (_, i) => `eth${i}`)
        : ['eth0', 'eth1', 'eth2', 'eth3'];
  return candidates.find((name) => !used.has(name)) || '';
}
function ipv4Cidr(value) {
  const m = String(value || '').trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/);
  if (!m || m.slice(1, 5).some((x) => +x > 255) || (m[5] && +m[5] > 32)) return null;
  const ip = m.slice(1, 5).reduce((n, x) => ((n << 8) | +x) >>> 0, 0), prefix = m[5] == null ? 32 : +m[5];
  const mask = prefix ? (0xffffffff << (32 - prefix)) >>> 0 : 0;
  return { ip, prefix, network: ip & mask };
}
function speedBps(value) {
  const m = String(value || '').trim().match(/^(\d+(?:\.\d+)?)\s*(tbps|tbit\/s|tb|t|gbps|gbit\/s|gb|g|mbps|mbit\/s|mb|m|kbps|kbit\/s|kb|k)\s*$/i);
  if (!m) return null;
  const unit = m[2].toLowerCase(), scale = unit.startsWith('t') ? 1e12 : unit.startsWith('g') ? 1e9 : unit.startsWith('m') ? 1e6 : 1e3;
  return +m[1] * scale;
}
const vlanSet = (value) => new Set(String(value || '').split(/[ ,]+/).flatMap((v) => { const m = v.match(/^(\d+)-(\d+)$/); if (!m) return v ? [v] : []; const lo = +m[1], hi = Math.min(4094, +m[2]); return hi < lo ? [] : Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)); }));
/** Advisory-only checks for declared diagram properties; this does not simulate network behavior. */
export function validateNetwork(d) {
  const warnings = [], ips = new Map();
  const warn = (code, ids, message) => warnings.push({ code, ids, message });
  const names = new Map();
  const portUse = new Map();
  for (const s of d.shapes) {
    if (isDevice(s) && s.label) { if (names.has(s.label)) warn('duplicate-name', [names.get(s.label),s.id], `Tên thiết bị “${s.label}” bị trùng.`); else names.set(s.label,s.id); }
    if (isDevice(s) && !d.edges.some((e) => e.a===s.id || e.b===s.id)) warn('unconnected', [s.id], `${s.label}: thiết bị chưa nối dây.`);
  }
  for (let i=0;i<d.edges.length;i++) for(let j=i+1;j<d.edges.length;j++) { const a=edgePath(d,d.edges[i]), b=edgePath(d,d.edges[j]); if(a && b && d.edges[i].a!==d.edges[j].a && d.edges[i].a!==d.edges[j].b && d.edges[i].b!==d.edges[j].a && d.edges[i].b!==d.edges[j].b && a.d===b.d) warn('overlapping-link',[d.edges[i].id,d.edges[j].id],'Hai dây có cùng đường đi.'); }
  const registerIp = (value, id, label) => { const a = ipv4Cidr(value); if (!a) return null; if (ips.has(a.ip)) warn('duplicate-ip', [ips.get(a.ip).id, id], `Địa chỉ IP ${value} bị trùng (${ips.get(a.ip).label}, ${label}).`); else ips.set(a.ip, { id, label }); return a; };
  for (const s of d.shapes.filter(isDevice)) {
    const links = d.edges.filter((e) => e.a === s.id || e.b === s.id);
    const capacity = s.ports?.length || (s.t === 'switch' || s.t === 'l3switch' ? 24 : s.t === 'router' ? 2 : 1);
    if (links.length > capacity) warn('port-capacity', [s.id], `${s.label}: có ${links.length} dây nhưng thiết bị khai báo tối đa ${capacity} cổng.`);
    if (s.meta?.mgmtIp) registerIp(s.meta.mgmtIp.split('/')[0] + (s.meta.mgmtIp.includes('/') ? '/' + s.meta.mgmtIp.split('/')[1] : ''), s.id, s.label + ' (quản lý)');
    const names = new Set();
    for (const p of s.ports || []) {
      if (p.name && names.has(p.name)) warn('duplicate-port', [s.id], `${s.label}: cổng ${p.name} được khai báo nhiều lần.`);
      if (p.name) names.add(p.name);
      if (p.ip) registerIp(p.ip, s.id, `${s.label} ${p.name || 'cổng'}`);
    }
    const mgmt = ipv4Cidr(s.meta?.mgmtIp);
    if (mgmt && s.meta?.gateway) { const gw = ipv4Cidr(s.meta.gateway); if (gw && gw.network !== mgmt.network) warn('gateway-subnet', [s.id], `${s.label}: IP quản lý và gateway khác subnet.`); }
  }
  for (const e of d.edges) {
    const a = shapeOf(d, e.a), b = shapeOf(d, e.b), pa = a?.ports?.find((p) => p.name === e.la), pb = b?.ports?.find((p) => p.name === e.lb);
    for (const [device, port] of [[a,e.la],[b,e.lb]]) if (device && port) {
      const key = `${device.id}\u0000${port}`, use = portUse.get(key) || [];
      use.push(e.id); portUse.set(key, use);
    }
    const ia = ipv4Cidr(pa?.ip), ib = ipv4Cidr(pb?.ip);
    const declaredSpeed = speedBps(e.speed);
    if (declaredSpeed) for (const [device, port, end] of [[a,pa,'A'],[b,pb,'B']]) {
      const portSpeed = speedBps(port?.speed);
      if (portSpeed && declaredSpeed > portSpeed) warn('link-speed', [e.id, device.id], `${device.label}: tốc độ dây ${e.speed} vượt tốc độ cổng ${port.name || end} (${port.speed}).`);
    }
    if (ia && ib && (ia.network !== ib.network || ia.prefix !== ib.prefix)) warn('link-subnet', [e.id, e.a, e.b], `${a.label} ↔ ${b.label}: IP hai đầu dây khác subnet hoặc lệch mask.`);
    if (e.mode === 'trunk' && pa && pb) {
      const va = vlanSet(pa.vlan), vb = vlanSet(pb.vlan), allowed = vlanSet(e.vlans);
      if (allowed.size && [...allowed].some((v) => !va.has(v) || !vb.has(v))) warn('trunk-vlan', [e.id, e.a, e.b], `Trunk ${a.label} ↔ ${b.label}: danh sách VLAN trên cổng không khớp dây.`);
    } else if (e.mode === 'access' && pa && pb && pa.vlan && pb.vlan && pa.vlan !== pb.vlan) warn('access-vlan', [e.id, e.a, e.b], `Access ${a.label} ↔ ${b.label}: VLAN hai đầu khác nhau.`);
  }
  for (const [key, ids] of portUse) if (ids.length > 1) {
    const [deviceId, port] = key.split('\u0000'), device = shapeOf(d, deviceId);
    warn('port-overused', [deviceId, ...ids], `${device?.label || 'Thiết bị'}: cổng ${port} đang được nối với ${ids.length} dây.`);
  }
  for (const rack of d.shapes.filter((s) => s.t === 'rack')) {
    const usage = rackUsage(d, rack.id);
    if (usage.used > usage.total) warn('rack-overcapacity', [rack.id], `${rack.label}: thiết bị chiếm ${usage.used} U nhưng rack chỉ có ${usage.total} U.`);
    const children = d.shapes.filter((s) => s.parent === rack.id), loadW = children.reduce((n,s) => n + Math.max(0,+s.meta?.powerW || 0),0), maxW = +rack.meta?.maxPowerW || 0;
    const upsW = children.filter((s) => s.t === 'ups').reduce((n,s) => n + Math.max(0,+s.meta?.powerCapacityW || 0),0);
    if (maxW && loadW > maxW) warn('rack-power-capacity', [rack.id, ...children.map((s) => s.id)], `${rack.label}: tải ${loadW} W vượt công suất rack ${maxW} W.`);
    if (upsW && loadW > upsW) warn('rack-ups-capacity', [rack.id, ...children.filter((s) => s.t === 'ups').map((s) => s.id)], `${rack.label}: tải ${loadW} W vượt tổng công suất UPS ${upsW} W.`);
  }
  return warnings;
}
export function edgeVlans(d, e) {
  const a = shapeOf(d, e.a), b = shapeOf(d, e.b);
  return [...new Set([...vlanSet(e.vlans), ...vlanSet(a?.ports?.find((p) => p.name === e.la)?.vlan), ...vlanSet(b?.ports?.find((p) => p.name === e.lb)?.vlan)])];
}
export function update(d, id, patch) {
  const o = shapeOf(d, id) || edgeOf(d, id);
  if (!o) return false;
  for (const [k, v] of Object.entries(patch)) if (!['id', 't', 'a', 'b'].includes(k)) o[k] = v;
  if (o.w != null) { o.w = Math.max(20, o.w); o.h = Math.max(16, o.h); }
  return true;
}
/** Xoá hình/dây theo danh sách id (xoá hình thì xoá luôn dây nối với nó). Hình đang khoá không bị xoá. */
export function remove(d, ids) {
  const set = new Set(ids.filter((id) => !shapeOf(d, id)?.locked));
  for (const s of d.shapes) if (set.has(s.parent)) { const parent=shapeOf(d,s.parent); if(parent?.t==='rack'&&s.rackMounted){const base=s.rackBase||SHAPES[s.t];s.w=base?.w||s.w;s.h=base?.h||s.h;delete s.rackMounted;delete s.rackU;delete s.rackStartU;delete s.rackBase;} delete s.parent; }
  d.shapes = d.shapes.filter((s) => !set.has(s.id));
  d.edges = d.edges.filter((e) => !set.has(e.id) && !set.has(e.a) && !set.has(e.b));
  for(const rack of d.shapes.filter(s=>s.t==='rack'))fitRack(d,rack.id);
}
/** Dời các hình (bỏ qua hình đang khoá). */
export function move(d, ids, dx, dy) { for (const s of d.shapes) if (ids.includes(s.id) && !s.locked) { s.x += dx; s.y += dy; } }
/** Include children in container moves without making a frame click select every child. */
export function expandContainers(d, ids) {
  const out = new Set(ids); let changed = true;
  while (changed) { changed = false; for (const s of d.shapes) if (s.parent && out.has(s.parent) && !out.has(s.id)) { out.add(s.id); changed = true; } }
  return [...out];
}
/** Assign a dropped shape to the smallest containing frame, or detach it when dropped outside. */
export function assignContainer(d, id) {
  const s = shapeOf(d, id); if (!s || isContainer(s)) return false;
  const unmount=()=>{if(s.rackMounted){const base=s.rackBase||SHAPES[s.t];s.w=base?.w||s.w;s.h=base?.h||s.h;}delete s.rackMounted;delete s.rackStartU;delete s.rackU;delete s.rackBase;};
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  const candidates = d.shapes.filter((z) => z.id !== id && isContainer(z) && cx >= z.x && cy >= z.y && cx <= z.x + z.w && cy <= z.y + z.h).sort((a, b) => a.w * a.h - b.w * b.h);
  const parent = candidates[0]?.id;
  if (parent) {
    const changed=s.parent!==parent; s.parent=parent;
    if(shapeOf(d,parent).t!=='rack')unmount();
    else if(changed)delete s.rackStartU;
  } else { delete s.parent; unmount(); }
  return !!parent;
}
/** Grow frames to fit their direct children, preserving a title margin. */
export function fitContainers(d, ids = d.shapes.filter(isContainer).map((s) => s.id), pad = 24) {
  for (const id of [...ids].reverse()) {
    const z = shapeOf(d, id), children = d.shapes.filter((s) => s.parent === id);
    if (!z || z.t === 'rack' || !children.length || z.locked) continue;
    const x0 = Math.min(...children.map((s) => s.x)) - pad, y0 = Math.min(...children.map((s) => s.y)) - pad - 18;
    const x1 = Math.max(...children.map((s) => s.x + s.w)) + pad, y1 = Math.max(...children.map((s) => s.y + s.h + (isDevice(s) ? s.fs * 2 + 12 : 0))) + pad;
    z.x = Math.min(z.x, x0); z.y = Math.min(z.y, y0); z.w = Math.max(z.w, x1 - z.x); z.h = Math.max(z.h, y1 - z.y);
  }
}
/** Fit mounted devices into rack slots while preserving gaps and manually chosen U positions. */
export function fitRack(d, rackId) {
  const rack=shapeOf(d,rackId); if(!rack||rack.t!=='rack')return false;
  const children=d.shapes.filter(s=>s.parent===rackId).sort((a,b)=>a.y-b.y||a.x-b.x);
  const defaultU=s=>['server','webServer','mailServer','dnsServer','dhcpServer','database','nas','ups','storage','objectStorage','blockStorage'].includes(s.t)?2:1;
  const sizeU=s=>Math.max(1,Math.min(8,Math.round(s.rackU||defaultU(s))));
  const totalU=children.reduce((n,s)=>n+sizeU(s),0), occupied=new Set(), placed=new Set();
  let capacity=Math.max(1,Math.min(42,Math.max(+rack.rackUnits||12,totalU)));
  const canPlace=(start,n)=>start>=1&&start+n-1<=capacity&&Array.from({length:n},(_,i)=>start+i).every(u=>!occupied.has(u));
  const reserve=(s,start,n)=>{for(let u=start;u<start+n;u++)occupied.add(u);s.rackStartU=start;placed.add(s.id);};
  // Keep existing/manual positions first so blank U slots remain blank after edits or redraws.
  for(const s of children){const n=sizeU(s),start=Math.round(+s.rackStartU||0);if(start&&canPlace(start,n))reserve(s,start,n);}
  // New devices take the first available contiguous U slots, counted up from the rack bottom.
  const overflow=[];
  for(const s of children){if(placed.has(s.id))continue;const n=sizeU(s);let start=1;while(start+n-1<=capacity&&!canPlace(start,n))start++;if(start+n-1>capacity){capacity=Math.min(42,Math.max(capacity,totalU));start=1;while(start+n-1<=capacity&&!canPlace(start,n))start++;}if(start+n-1>capacity){overflow.push(s);continue;}reserve(s,start,n);}
  rack.rackUnits=capacity;rack.rackUsed=occupied.size;rack.rackFree=Math.max(0,capacity-occupied.size);rack.rackOverflow=overflow.map(s=>s.id);
  rack.w=Math.max(180,+rack.w||180); rack.h=24+rack.rackUnits*18;
  for(const s of children){if(overflow.includes(s)){const base=s.rackBase||SHAPES[s.t];s.w=base?.w||s.w;s.h=base?.h||s.h;delete s.rackMounted;delete s.rackU;delete s.rackStartU;delete s.rackBase;delete s.parent;s.x=rack.x+rack.w+36;s.y=rack.y+12+overflow.indexOf(s)*Math.max(48,s.h+24);continue;}if(!s.rackMounted)s.rackBase={w:s.w,h:s.h};else s.rackBase||={w:SHAPES[s.t].w,h:SHAPES[s.t].h};const n=sizeU(s),top=rack.rackUnits-(s.rackStartU+n-1);s.rackU=n;s.rackMounted=true;s.x=rack.x+30;s.y=rack.y+12+top*18;s.w=rack.w-60;s.h=n*18-2;}
  return true;
}
/** Current occupied and free rack units for the inspector. */
export function rackUsage(d, rackId) {
  const rack=shapeOf(d,rackId);if(!rack||rack.t!=='rack')return {used:0,total:0,free:0};
  const slots=new Set();let legacyStart=1;for(const s of d.shapes.filter(x=>x.parent===rackId&&x.rackMounted)){const n=Math.max(1,Math.round(+s.rackU||1)),start=Math.round(+s.rackStartU||legacyStart);for(let u=start;u<start+n;u++)slots.add(u);legacyStart=Math.max(legacyStart,start+n);}
  const total=Math.max(1,+rack.rackUnits||12);return {used:slots.size,total,free:Math.max(0,total-slots.size),overflow:Array.isArray(rack.rackOverflow)?rack.rackOverflow.length:0};
}
/** Mở rộng vùng chọn: chọn 1 hình trong nhóm = chọn cả nhóm (như draw.io). */
export function expandGroups(d, ids) {
  const gs = new Set(d.shapes.filter((s) => ids.includes(s.id) && s.g).map((s) => s.g));
  return [...new Set([...ids, ...d.shapes.filter((s) => s.g && gs.has(s.g)).map((s) => s.id)])];
}
/** Nhóm các hình (≥ 2) — trả id nhóm; bỏ nhóm thì xoá trường g. */
export function group(d, ids) {
  const ss = d.shapes.filter((s) => ids.includes(s.id));
  if (ss.length < 2) return null;
  const g = nextId(d, 'g');
  for (const s of ss) s.g = g;
  return g;
}
export function ungroup(d, ids) { for (const s of d.shapes) if (ids.includes(s.id)) delete s.g; }
/** Nhân bản các hình (và dây nằm giữa chúng), lệch (dx, dy). Trả id các hình mới. */
export function duplicate(d, ids, dx = 20, dy = 20) {
  const map = {};
  for (const s of d.shapes.filter((x) => ids.includes(x.id))) {
    const c = JSON.parse(JSON.stringify(s));
    c.id = nextId(d, 's'); c.x += dx; c.y += dy; delete c.locked;
    if (SHAPES[c.t].prefix && c.label.startsWith(SHAPES[c.t].prefix)) c.label = uniqueLabel(d, SHAPES[c.t].prefix);
    map[s.id] = c.id;
    d.shapes.push(c);
  }
  for (const [oldId,newId] of Object.entries(map)) { const c=shapeOf(d,newId); if(c.parent) { if(map[c.parent]) c.parent=map[c.parent]; else delete c.parent; } }
  for (const e of d.edges.filter((x) => map[x.a] && map[x.b])) d.edges.push({ ...JSON.parse(JSON.stringify(e)), id: nextId(d, 'e'), a: map[e.a], b: map[e.b] });
  // nhóm được nhân bản thành nhóm MỚI
  const gmap = {};
  for (const id of Object.values(map)) { const c = shapeOf(d, id); if (c.g) c.g = gmap[c.g] ||= nextId(d, 'g'); }
  return Object.values(map);
}
/** Bản sao vùng chọn để dán (Ctrl+C / Ctrl+X): các hình + dây nằm giữa chúng. */
export function copyOf(d, ids) {
  const shapes = d.shapes.filter((s) => ids.includes(s.id));
  const set = new Set(shapes.map((s) => s.id));
  return JSON.parse(JSON.stringify({ shapes, edges: d.edges.filter((e) => set.has(e.a) && set.has(e.b)) }));
}
/** Dán bản sao (lệch dx, dy) với id mới, tên thiết bị mới, nhóm mới. Trả id các hình đã dán. */
export function paste(d, clip, dx = 20, dy = 20) {
  const map = {}, gmap = {};
  for (const s of clip?.shapes || []) {
    if (!SHAPES[s.t]) continue;
    const c = { ...JSON.parse(JSON.stringify(s)), id: nextId(d, 's'), x: s.x + dx, y: s.y + dy };
    delete c.locked;
    if (SHAPES[c.t].prefix && d.shapes.some((x) => x.label === c.label)) c.label = uniqueLabel(d, SHAPES[c.t].prefix);
    if (c.g) c.g = gmap[c.g] ||= nextId(d, 'g');
    map[s.id] = c.id;
    d.shapes.push(c);
  }
  for (const [oldId,newId] of Object.entries(map)) { const c=shapeOf(d,newId); if(c.parent) { if(map[c.parent]) c.parent=map[c.parent]; else delete c.parent; } }
  for (const e of clip?.edges || []) if (map[e.a] && map[e.b]) d.edges.push({ ...JSON.parse(JSON.stringify(e)), id: nextId(d, 'e'), a: map[e.a], b: map[e.b] });
  return Object.values(map);
}
/** Đưa lên trên cùng / xuống dưới cùng (thứ tự vẽ = thứ tự mảng). */
export function zOrder(d, ids, front) {
  const sel = d.shapes.filter((s) => ids.includes(s.id)), rest = d.shapes.filter((s) => !ids.includes(s.id));
  d.shapes = front ? [...rest, ...sel] : [...sel, ...rest];
}
/** Căn lề: left | center | right | top | middle | bottom (theo khung bao của vùng chọn). */
export function align(d, ids, how) {
  const ss = d.shapes.filter((s) => ids.includes(s.id) && !s.locked);
  if (ss.length < 2) return;
  const x0 = Math.min(...ss.map((s) => s.x)), x1 = Math.max(...ss.map((s) => s.x + s.w)), y0 = Math.min(...ss.map((s) => s.y)), y1 = Math.max(...ss.map((s) => s.y + s.h));
  for (const s of ss) {
    if (how === 'left') s.x = x0; else if (how === 'right') s.x = x1 - s.w; else if (how === 'center') s.x = Math.round((x0 + x1) / 2 - s.w / 2);
    else if (how === 'top') s.y = y0; else if (how === 'bottom') s.y = y1 - s.h; else if (how === 'middle') s.y = Math.round((y0 + y1) / 2 - s.h / 2);
  }
}
/** Dàn đều khoảng cách giữa các hình theo chiều ngang (h) hoặc dọc (v). */
export function distribute(d, ids, axis) {
  const ss = d.shapes.filter((s) => ids.includes(s.id) && !s.locked);
  if (ss.length < 3) return;
  const k = axis === 'h' ? 'x' : 'y', sz = axis === 'h' ? 'w' : 'h';
  ss.sort((a, b) => a[k] - b[k]);
  const span = ss.at(-1)[k] + ss.at(-1)[sz] - ss[0][k];
  const gap = (span - ss.reduce((t, s) => t + s[sz], 0)) / (ss.length - 1);
  let pos = ss[0][k];
  for (const s of ss) { s[k] = Math.round(pos); pos += s[sz] + gap; }
}
/** Snap a dragged selection's leading shape to peers' edges/centres and return visible guide lines. */
export function snapToGuides(d, ids, dx, dy, threshold = 8) {
  const lead = shapeOf(d, ids[0]); if (!lead) return { dx, dy, guides: [] };
  const peers = d.shapes.filter((s) => !ids.includes(s.id)), guides = [];
  let bestX = { dist: threshold + 1 }, bestY = { dist: threshold + 1 };
  const xs = [lead.x + dx, lead.x + dx + lead.w / 2, lead.x + dx + lead.w], ys = [lead.y + dy, lead.y + dy + lead.h / 2, lead.y + dy + lead.h];
  for (const s of peers) {
    const tx = [s.x, s.x + s.w / 2, s.x + s.w], ty = [s.y, s.y + s.h / 2, s.y + s.h];
    for (const x of xs) for (const target of tx) if (Math.abs(x - target) < bestX.dist) bestX = { dist: Math.abs(x - target), adjust: target - x, value: target };
    for (const y of ys) for (const target of ty) if (Math.abs(y - target) < bestY.dist) bestY = { dist: Math.abs(y - target), adjust: target - y, value: target };
  }
  if (bestX.dist <= threshold) { dx += bestX.adjust; guides.push({ axis: 'x', value: bestX.value }); }
  if (bestY.dist <= threshold) { dy += bestY.adjust; guides.push({ axis: 'y', value: bestY.value }); }
  return { dx, dy, guides };
}
/** Deterministic layered/tree/grid auto-layout for all or selected shapes. */
export function autoLayout(d, ids = d.shapes.map((s) => s.id), mode = 'grid') {
  const ss = d.shapes.filter((s) => ids.includes(s.id) && !isContainer(s) && !s.locked);
  if (ss.length < 2) return false;
  const byId = new Map(ss.map((s) => [s.id, s]));
  if (mode === 'grid') {
    const cols = Math.ceil(Math.sqrt(ss.length)), gapX = 70, gapY = 80, cellW = Math.max(...ss.map((s) => s.w)) + gapX, cellH = Math.max(...ss.map((s) => s.h)) + gapY;
    ss.forEach((s, i) => { s.x = (i % cols) * cellW; s.y = Math.floor(i / cols) * cellH; }); return true;
  }
  let levels = new Map();
  if (mode === 'tree') {
    const root = ss.find((s) => ['router','firewall','cloud'].includes(s.t)) || ss[0], q = [[root.id, 0]]; levels.set(root.id, 0);
    while (q.length) { const [id, level] = q.shift(); for (const e of d.edges) { const n = e.a === id ? e.b : e.b === id ? e.a : null; if (n && byId.has(n) && !levels.has(n)) { levels.set(n, level + 1); q.push([n, level + 1]); } } }
    for (const s of ss) if (!levels.has(s.id)) levels.set(s.id, Math.max(0, ...levels.values()) + 1);
  } else {
    const layer = (s) => ['router','firewall','cloud'].includes(s.t) ? 0 : ['switch','l3switch','loadBalancer'].includes(s.t) ? 1 : ['pc','laptop','phone','mobile','tablet','printer','camera'].includes(s.t) ? 3 : 2;
    for (const s of ss) levels.set(s.id, layer(s));
  }
  const buckets = new Map(); for (const s of ss) { const l = levels.get(s.id); if (!buckets.has(l)) buckets.set(l, []); buckets.get(l).push(s); }
  const maxH = Math.max(...ss.map((s) => s.h)), maxW = Math.max(...ss.map((s) => s.w));
  for (const [level, group] of [...buckets].sort((a,b)=>a[0]-b[0])) group.forEach((s,i) => { s.x = i * (maxW + 70); s.y = level * (maxH + 90); });
  return true;
}
/** Hình có giao với khung chọn (quét chuột) — trả id. */
export function inRect(d, r) {
  const x0 = Math.min(r.x0, r.x1), x1 = Math.max(r.x0, r.x1), y0 = Math.min(r.y0, r.y1), y1 = Math.max(r.y0, r.y1);
  return d.shapes.filter((s) => s.x >= x0 && s.y >= y0 && s.x + s.w <= x1 && s.y + s.h <= y1).map((s) => s.id);
}

// ---------------------------------------------------------------- hoàn tác
export function createHistory(limit = 80) {
  const undo = [], redo = [];
  const snapS = (d) => JSON.stringify({ shapes: d.shapes, edges: d.edges, seq: d.seq });
  const restore = (d, s) => Object.assign(d, JSON.parse(s));
  return {
    snapshot: snapS,
    commit(d, before) { if (snapS(d) === before) return false; undo.push(before); if (undo.length > limit) undo.shift(); redo.length = 0; return true; },
    track(d, fn) { const b = snapS(d); const r = fn(); this.commit(d, b); return r; },
    undo(d) { if (!undo.length) return false; redo.push(snapS(d)); restore(d, undo.pop()); return true; },
    redo(d) { if (!redo.length) return false; undo.push(snapS(d)); restore(d, redo.pop()); return true; },
    get canUndo() { return undo.length > 0; },
    get canRedo() { return redo.length > 0; },
  };
}

// ---------------------------------------------------------------- hình học dây nối
const center = (s) => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
export const PORTS = ['n', 'e', 's', 'w', 'n1', 'n2', 'e1', 'e2', 's1', 's2', 'w1', 'w2'];
const EXTRA_PORT_MIN = 120; // cạnh dài từ chừng này trở lên có thêm 2 điểm nối phụ (ở 1/4 và 3/4 cạnh)
/** Stable cardinal connection point on a shape's wire box. */
export function portPoint(s, port) {
  if (!PORTS.includes(port)) return null;
  const b = wireBox(s), side = port[0], k = port[1] === '1' ? 0.25 : port[1] === '2' ? 0.75 : 0.5;
  if (side === 'n') return { x: b.x + b.w * k, y: b.y };
  if (side === 'e') return { x: b.x + b.w, y: b.y + b.h * k };
  if (side === 's') return { x: b.x + b.w * k, y: b.y + b.h };
  return { x: b.x, y: b.y + b.h * k };
}
/** Các điểm nối đang có của hình: 4 điểm giữa cạnh, thêm điểm phụ trên cạnh đủ dài. */
export function portsOf(s) {
  const b = wireBox(s);
  return PORTS.filter((p) => !p[1] || (('ns'.includes(p[0]) ? b.w : b.h) >= EXTRA_PORT_MIN));
}
export function nearestPort(s, x, y) {
  const dist = (p) => { const q = portPoint(s, p); return Math.hypot(q.x - x, q.y - y); };
  return portsOf(s).reduce((a, b) => (dist(a) <= dist(b) ? a : b));
}
/** Manhattan visibility-graph route around intervening shapes; returns elbow points. */
function routeAround(d, aId, bId, start, end) {
  if (start.x === end.x && start.y === end.y) return [];
  const all = d.shapes.filter((s) => s.id !== aId && s.id !== bId && !isContainer(s)).map((s) => ({ x0: s.x - 12, y0: s.y - 12, x1: s.x + s.w + 12, y1: s.y + s.h + 12 }));
  if (!all.length) return [];
  const clear = (list, pts) => pts.slice(1).every((b, i) => !segBlocked(list, pts[i], b));
  // Đường chữ L trống là ngắn nhất rồi, khỏi tìm đường (phần lớn dây rơi vào đây).
  const hv = { x: end.x, y: start.y }, vh = { x: start.x, y: end.y };
  for (const c of Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? [hv, vh] : [vh, hv]) {
    if (clear(all, [start, c, end])) return (c.x === start.x && c.y === start.y) || (c.x === end.x && c.y === end.y) ? [] : [c];
  }
  // Thử với các hình gần trước; đường tìm được đụng hình xa thì mới tìm trên toàn sơ đồ.
  const M = 200, x0 = Math.min(start.x, end.x) - M, x1 = Math.max(start.x, end.x) + M, y0 = Math.min(start.y, end.y) - M, y1 = Math.max(start.y, end.y) + M;
  const near = all.filter((r) => r.x1 > x0 && r.x0 < x1 && r.y1 > y0 && r.y0 < y1);
  const path = searchRoute(near, start, end);
  if (near.length === all.length) return path ? path.slice(1, -1) : [];
  const full = path && clear(all, path) ? path : searchRoute(all, start, end);
  return full ? full.slice(1, -1) : [];
}
function segBlocked(obstacles, a, b) {
  return obstacles.some((r) => {
    if (a.x === b.x) return a.x > r.x0 && a.x < r.x1 && Math.max(a.y, b.y) > r.y0 && Math.min(a.y, b.y) < r.y1;
    if (a.y === b.y) return a.y > r.y0 && a.y < r.y1 && Math.max(a.x, b.x) > r.x0 && Math.min(a.x, b.x) < r.x1;
    return true;
  });
}
/** Dijkstra trên các điểm góc của hình chắn; trả về danh sách điểm từ start tới end, hoặc null. */
function searchRoute(obstacles, start, end) {
  const raw = [start, end, { x: start.x, y: end.y }, { x: end.x, y: start.y }];
  for (const r of obstacles) raw.push(
    { x: r.x0, y: r.y0 }, { x: r.x0, y: r.y1 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 },
    { x: r.x0, y: start.y }, { x: r.x1, y: start.y }, { x: r.x0, y: end.y }, { x: r.x1, y: end.y },
    { x: start.x, y: r.y0 }, { x: start.x, y: r.y1 }, { x: end.x, y: r.y0 }, { x: end.x, y: r.y1 },
  );
  const nodes = [...new Map(raw.map((p) => [`${p.x},${p.y}`, p])).values()]; // start, end vẫn ở vị trí 0, 1
  const byX = new Map(), byY = new Map();
  nodes.forEach((p, i) => { (byX.get(p.x) || byX.set(p.x, []).get(p.x)).push(i); (byY.get(p.y) || byY.set(p.y, []).get(p.y)).push(i); });
  const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), seen = new Set(); dist[0] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!seen.has(i) && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || !Number.isFinite(dist[u]) || u === 1) break;
    seen.add(u);
    for (const v of [...byX.get(nodes[u].x), ...byY.get(nodes[u].y)]) {
      if (u === v || seen.has(v)) continue;
      const nd = dist[u] + Math.abs(nodes[u].x - nodes[v].x) + Math.abs(nodes[u].y - nodes[v].y);
      if (nd < dist[v] && !segBlocked(obstacles, nodes[u], nodes[v])) { dist[v] = nd; prev[v] = u; }
    }
  }
  if (!Number.isFinite(dist[1])) return null;
  const path = []; for (let i = 1; i > 0; i = prev[i]) { path.push(nodes[i]); if (prev[i] < 0) return null; }
  path.reverse();
  const compact = [];
  for (const p of [start, ...path.slice(0, -1), end]) { while (compact.length >= 2) { const [x, y] = compact.slice(-2); if ((x.x === y.x && y.x === p.x) || (x.y === y.y && y.y === p.y)) compact.pop(); else break; } compact.push(p); }
  return compact;
}
/** Khung dùng để đặt đầu dây: thiết bị tính cả phần chữ bên dưới icon để dây không đè lên tên / IP. */
export function wireBox(s) {
  if (!isDevice(s)) return s;
  const extra = (s.label ? s.fs + 6 : 0) + (s.sub ? s.fs + 4 : 0) + (s.showMeta && (s.meta?.mgmtIp || s.meta?.hostname) ? s.fs + 3 : 0);
  return { ...s, h: s.h + extra };
}
/** Điểm trên mép khung hình s theo hướng tới (tx, ty). */
export function edgePoint(s, tx, ty) {
  const c = center(s), dx = tx - c.x, dy = ty - c.y;
  if (!dx && !dy) return c;
  if (s.t === 'ellipse' || s.t === 'cloud') { const a = s.w / 2, b = s.h / 2, k = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b)); return { x: c.x + dx * k, y: c.y + dy * k }; }
  const k = Math.min(Math.abs(dx) > 0 ? s.w / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 0 ? s.h / 2 / Math.abs(dy) : Infinity);
  return { x: c.x + dx * k, y: c.y + dy * k };
}
/** Đường đi của dây: { d (path SVG), pts (điểm đầu/cuối), mid (điểm đặt nhãn), ang (góc cuối để vẽ mũi tên) }. */
export function edgePath(d, e) {
  const A0 = shapeOf(d, e.a), B0 = shapeOf(d, e.b);
  if (!A0 || !B0) return null;
  const A = wireBox(A0), B = wireBox(B0);
  const ca = center(A), cb = center(B);
  const pa = PORTS.includes(e.portA) ? portPoint(A0, e.portA) : edgePoint(A, cb.x, cb.y);
  const pb = PORTS.includes(e.portB) ? portPoint(B0, e.portB) : edgePoint(B, ca.x, ca.y);
  if (Array.isArray(e.waypoints) && e.waypoints.length) {
    const points = [pa, ...e.waypoints.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)), pb];
    const segs = points.slice(1).map((p, i) => `L${r1(p.x)} ${r1(p.y)}`).join('');
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    const half = lengths.reduce((a, b) => a + b, 0) / 2;
    let mid = points[0]; let remain = half;
    for (let i = 1; i < points.length; i++) { if (remain <= lengths[i - 1]) { const k = lengths[i - 1] ? remain / lengths[i - 1] : 0; mid = { x: points[i - 1].x + (points[i].x - points[i - 1].x) * k, y: points[i - 1].y + (points[i].y - points[i - 1].y) * k }; break; } remain -= lengths[i - 1]; mid = points[i]; }
    const last = points.at(-1), prev = points.at(-2);
    return { d: `M${r1(pa.x)} ${r1(pa.y)}${segs}`, a: pa, b: pb, mid, ang: Math.atan2(last.y - prev.y, last.x - prev.x), ang0: Math.atan2(points[1].y - pa.y, points[1].x - pa.x) };
  }
  if (e.style === 'ortho') {
    // Gấp khúc bắt đầu/kết thúc tại đúng cổng đã chọn; đường cũ vẫn tự chọn cạnh gần nhất.
    const p1 = pa;
    const p2 = pb;
    const around = routeAround(d, e.a, e.b, p1, p2);
    if (around.length) {
      const points = [p1, ...around, p2], dPath = `M${r1(p1.x)} ${r1(p1.y)}` + points.slice(1).map((p) => `L${r1(p.x)} ${r1(p.y)}`).join('');
      const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
      let remaining = lengths.reduce((a, b) => a + b, 0) / 2, mid = p1;
      for (let i = 1; i < points.length; i++) { if (remaining <= lengths[i - 1]) { const k = lengths[i - 1] ? remaining / lengths[i - 1] : 0; mid = { x: points[i - 1].x + (points[i].x - points[i - 1].x) * k, y: points[i - 1].y + (points[i].y - points[i - 1].y) * k }; break; } remaining -= lengths[i - 1]; mid = points[i]; }
      return { d: dPath, a: p1, b: p2, mid, ang: Math.atan2(p2.y - points.at(-2).y, p2.x - points.at(-2).x), ang0: Math.atan2(points[1].y - p1.y, points[1].x - p1.x) };
    }
    const horiz = Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y);
    const k = horiz ? { x: p2.x, y: p1.y } : { x: p1.x, y: p2.y };
    if (Math.abs(p2.x - p1.x) < 1 || Math.abs(p2.y - p1.y) < 1) {
      return { d: `M${p1.x} ${p1.y}L${p2.x} ${p2.y}`, a: p1, b: p2, mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, ang: Math.atan2(p2.y - p1.y, p2.x - p1.x), ang0: Math.atan2(p1.y - p2.y, p1.x - p2.x) };
    }
    return { d: `M${p1.x} ${p1.y}L${k.x} ${k.y}L${p2.x} ${p2.y}`, a: p1, b: p2, mid: k, ang: Math.atan2(p2.y - k.y, p2.x - k.x), ang0: Math.atan2(p1.y - k.y, p1.x - k.x) };
  }
  if (e.style === 'curve') {
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2, nx = -(pb.y - pa.y) * 0.25, ny = (pb.x - pa.x) * 0.25;
    const cx = mx + nx, cy = my + ny;
    return { d: `M${pa.x} ${pa.y}Q${cx} ${cy} ${pb.x} ${pb.y}`, a: pa, b: pb, mid: { x: (pa.x + 2 * cx + pb.x) / 4, y: (pa.y + 2 * cy + pb.y) / 4 }, ang: Math.atan2(pb.y - cy, pb.x - cx), ang0: Math.atan2(pa.y - cy, pa.x - cx) };
  }
  const siblings = d.edges.filter((x) => (x.a === e.a && x.b === e.b) || (x.a === e.b && x.b === e.a)).sort((x, y) => x.id.localeCompare(y.id));
  if (siblings.length > 1 && !e.waypoints?.length) {
    const i = siblings.findIndex((x) => x.id === e.id), offset = (i - (siblings.length - 1) / 2) * 8;
    const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const nearA = { x: pa.x + dx * 0.12 + nx * offset, y: pa.y + dy * 0.12 + ny * offset };
    const nearB = { x: pb.x - dx * 0.12 + nx * offset, y: pb.y - dy * 0.12 + ny * offset };
    return { d: `M${pa.x} ${pa.y}L${r1(nearA.x)} ${r1(nearA.y)}L${r1(nearB.x)} ${r1(nearB.y)}L${pb.x} ${pb.y}`, a: pa, b: pb, mid: { x: (nearA.x + nearB.x) / 2, y: (nearA.y + nearB.y) / 2 }, ang: Math.atan2(pb.y - nearB.y, pb.x - nearB.x), ang0: Math.atan2(nearA.y - pa.y, nearA.x - pa.x) };
  }
  return { d: `M${pa.x} ${pa.y}L${pb.x} ${pb.y}`, a: pa, b: pb, mid: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }, ang: Math.atan2(pb.y - pa.y, pb.x - pa.x), ang0: Math.atan2(pa.y - pb.y, pa.x - pb.x) };
}

// ---------------------------------------------------------------- vẽ (chuỗi SVG)
const r1 = (n) => Math.round(n * 10) / 10;
/** Biểu tượng thiết bị vẽ trong khung (x, y, w, h). Tự vẽ — không dùng icon của hãng. */
// Icon vẽ trong khung cố định 64×52; icon() tự dời và co giãn theo hình thật.
const BODY = 'fill="#f1f5f9" stroke="#475569" stroke-width="2"', BLUE = 'fill="#dbeafe" stroke="#2563eb" stroke-width="2"';
const line = (d, stroke = '#475569', sw = 2, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const dot = (x, y, r = 2, fill = '#22c55e') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const label = (x, y, size, fill, txt) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="700" fill="${fill}">${txt}</text>`;
const padlock = (x, y) => `<rect x="${x - 6}" y="${y - 3}" width="12" height="11" rx="2" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/><path d="M${x - 3} ${y - 3}v-3a3 3 0 0 1 6 0v3" fill="none" stroke="#d97706" stroke-width="1.5"/>`;
const cloudShape = (fill, stroke) => `<path d="M14 40h37a10 10 0 0 0 0-20 16 16 0 0 0-30-5 11 11 0 0 0-7 25z" fill="${fill}" stroke="${stroke}" stroke-width="2.3" stroke-linejoin="round"/>`;
const dbShape = (fill, stroke) => `<path d="M10 11c0-9 44-9 44 0v30c0 9-44 9-44 0z" fill="${fill}" stroke="${stroke}" stroke-width="2"/><path d="M10 11c0 9 44 9 44 0" fill="none" stroke="${stroke}" stroke-width="1.7"/>`;
const windowFrame = `<rect x="4" y="5" width="56" height="42" rx="5" fill="#f8fafc" stroke="#475569" stroke-width="2"/><path d="M4 15h56" stroke="#64748b" stroke-width="1.5"/>${dot(11, 10, 1.5, '#ef4444')}${dot(17, 10, 1.5, '#f59e0b')}${dot(23, 10, 1.5)}`;
const roleServer = (badge) => `<rect x="5" y="6" width="34" height="40" rx="4" ${BODY}/>${[12, 22, 32].map((yy) => `<rect x="10" y="${yy}" width="24" height="6" rx="1" fill="#94a3b8"/>${dot(30, yy + 3, 1.4, '#4ade80')}`).join('')}<circle cx="45" cy="17" r="13" fill="#fff" stroke="#2563eb" stroke-width="2"/>${badge}`;
const layers = (cx, top, half, rows, fill, stroke) => `<path d="M${cx} ${top}L${cx + half} ${top + half * .45}L${cx} ${top + half * .9}L${cx - half} ${top + half * .45}Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>` + Array.from({ length: rows }, (_, i) => line(`M${cx - half} ${top + half * .45 + 9 * (i + 1)}L${cx} ${top + half * .9 + 9 * (i + 1)}L${cx + half} ${top + half * .45 + 9 * (i + 1)}`, stroke)).join('');
const ART = {
  modem: `<rect x="8" y="16" width="48" height="26" rx="4" ${BODY}/><rect x="13" y="21" width="38" height="8" rx="1" fill="#dbeafe" stroke="#2563eb" stroke-width="1.2"/>${dot(17, 36)}${dot(25, 36, 2, '#eab308')}${dot(33, 36)}${line('M32 16V9M25 9q7-7 14 0', '#2563eb', 1.8)}`,
  hub: `<path d="M16 15V7M32 15V7M48 15V7M16 37v8M32 37v8M48 37v8" stroke="#60a5fa" stroke-width="2"/><rect x="6" y="15" width="52" height="22" rx="4" ${BODY}/>${line('M12 26h40', '#475569', 2.5)}${[16, 32, 48].map((xx) => dot(xx, 7, 2.5, '#60a5fa') + dot(xx, 45, 2.5, '#60a5fa')).join('')}`,
  vpnGateway: `<rect x="5" y="11" width="54" height="32" rx="5" ${BODY}/>${line('M10 27h44', '#3b82f6', 2, ' stroke-dasharray="3 4"')}${line('M47 21l7 6-7 6M17 21l-7 6 7 6', '#2563eb')}${padlock(32, 26)}`,
  repeater: `${line('M3 26h17M44 26h17M55 20l6 6-6 6', '#059669')}<circle cx="32" cy="26" r="12" fill="#ecfdf5" stroke="#059669" stroke-width="2"/><path d="M27 19v14l11-7z" fill="#10b981"/>`,
  antenna: `${line('M32 47V20M21 47h22', '#475569', 2.5)}<circle cx="32" cy="16" r="4" fill="#f97316"/>${line('M24 9q-5 7 0 14M40 9q5 7 0 14M18 5q-8 11 0 22M46 5q8 11 0 22', '#0ea5e9')}`,
  cellTower: `${line('M32 15L20 48M32 15L44 48M26 32h12M22.5 41h19')}<circle cx="32" cy="12" r="3" fill="#0ea5e9"/>${line('M24 6q-4 6 0 12M40 6q4 6 0 12M18 3q-7 9 0 18M46 3q7 9 0 18', '#0ea5e9')}`,
  building: `<rect x="14" y="6" width="36" height="42" rx="2" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>${[12, 21, 30].map((yy) => [20, 29, 38].map((xx) => `<rect x="${xx}" y="${yy}" width="6" height="5" fill="#60a5fa"/>`).join('')).join('')}<rect x="27" y="39" width="10" height="9" fill="#2563eb"/>`,
  mplsCloud: `${cloudShape('#ede9fe', '#7c3aed')}${line('M21 29h22M37 24l6 5-6 5', '#6d28d9')}${dot(24, 29, 3, '#a78bfa')}${dot(32, 29, 3, '#a78bfa')}`,
  isp: `${cloudShape('#ecfdf5', '#059669')}${line('M20 29h24M25 24l-5 5 5 5M39 24l5 5-5 5', '#059669', 1.9)}${dot(32, 29, 3, '#34d399')}`,
  proxy: `<rect x="5" y="10" width="54" height="32" rx="5" ${BODY}/>${line('M12 26h40M45 20l7 6-7 6M19 20l-7 6 7 6', '#2563eb')}${dot(12, 15)}`,
  natGateway: `<rect x="6" y="7" width="52" height="38" rx="4" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>${line('M14 17h36M43 11l7 6-7 6', '#2563eb')}${label(32, 37, 13, '#1d4ed8', 'NAT')}`,
  sanSwitch: `<rect x="5" y="10" width="54" height="32" rx="5" ${BODY}/>${[0, 1, 2, 3].map((i) => dot(14 + i * 12, 17, 2, ['#4ade80', '#60a5fa', '#a78bfa', '#f59e0b'][i])).join('')}${line('M15 31h34M43 25l6 6-6 6M21 25l-6 6 6 6', '#7c3aed')}`,
  bastion: `<path d="M14 47V20h6v-9h6v6h12v-6h6v9h6v27z" fill="#e0e7ff" stroke="#4f46e5" stroke-width="2" stroke-linejoin="round"/>${padlock(32, 33)}`,
  routeTable: `<rect x="7" y="6" width="50" height="40" rx="3" fill="#f8fafc" stroke="#475569" stroke-width="2"/>${line('M8 17h48M24 17v28M40 17v28', '#94a3b8', 1.3)}${line('M12 12h8M28 12h8M44 12h8M12 25h8M12 33h8M28 25h8M28 33h8M44 25h8M44 33h8', '#2563eb', 1.5)}`,
  siteToSiteVpn: `<rect x="5" y="12" width="15" height="13" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><rect x="44" y="30" width="15" height="13" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>${line('M9 12V8a3 3 0 0 1 7 0v4M48 30v-4a3 3 0 0 1 7 0v4', '#d97706', 1.5)}${line('M20 18q12 0 12 9t12 9', '#7c3aed', 2.5, ' stroke-dasharray="4 3"')}`,
  container: `<rect x="7" y="11" width="50" height="30" rx="2" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>${line('M15 15v22M23 15v22M32 15v22M41 15v22M49 15v22', '#60a5fa', 1.8)}`,
  containerImage: layers(32, 5, 25, 2, '#ffedd5', '#ea580c'),
  registry: `<rect x="7" y="5" width="50" height="42" rx="4" fill="#fff7ed" stroke="#ea580c" stroke-width="2"/>${line('M7 19h50M7 33h50', '#fb923c', 1.5)}${[12, 26, 40].map((yy) => `<rect x="12" y="${yy - 4}" width="8" height="8" rx="1" fill="#fdba74" stroke="#ea580c"/>${line(`M25 ${yy}h26`, '#fdba74', 2)}`).join('')}`,
  gitRepo: `<path d="M6 14a3 3 0 0 1 3-3h14l5 5h27a3 3 0 0 1 3 3v24a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill="#ffedd5" stroke="#ea580c" stroke-width="2" stroke-linejoin="round"/>${line('M24 24v15M24 32q0-7 9-7h6', '#c2410c')}${dot(24, 24, 3, '#fb923c')}${dot(24, 39, 3, '#fb923c')}${dot(42, 25, 3, '#fb923c')}`,
  gitBranch: `${line('M18 9v34M18 31q0-13 13-13h7', '#ea580c', 3)}${[[18, 9], [18, 43], [42, 18]].map(([xx, yy]) => `<circle cx="${xx}" cy="${yy}" r="4.5" fill="#fdba74" stroke="#c2410c" stroke-width="2"/>`).join('')}`,
  mergeRequest: `${line('M16 10v32M46 42V22q0-10-10-10h-8M33 6l-6 6 6 6', '#f97316', 2.5)}<circle cx="16" cy="9" r="4.5" fill="#fed7aa" stroke="#ea580c" stroke-width="2"/><circle cx="16" cy="43" r="4.5" fill="#fed7aa" stroke="#ea580c" stroke-width="2"/><circle cx="46" cy="43" r="4.5" fill="#86efac" stroke="#16a34a" stroke-width="2"/>`,
  artifact: `<path d="M32 5L56 16V37L32 48L8 37V16Z" fill="#ddd6fe" stroke="#6d28d9" stroke-width="2" stroke-linejoin="round"/>${line('M8 16L32 27L56 16M32 27V48', '#6d28d9')}`,
  helmChart: `<path d="M13 5h27l11 11v31H13z" fill="#eff6ff" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>${line('M40 5v11h11', '#2563eb', 1.5)}<rect x="20" y="30" width="6" height="10" fill="#60a5fa"/><rect x="29" y="23" width="6" height="17" fill="#3b82f6"/><rect x="38" y="27" width="6" height="13" fill="#93c5fd"/>`,
  queue: `<rect x="5" y="14" width="54" height="24" rx="3" fill="#fce7f3" stroke="#db2777" stroke-width="2"/>${[11, 24, 37].map((xx) => `<rect x="${xx}" y="20" width="9" height="12" rx="1" fill="#f9a8d4" stroke="#db2777"/>`).join('')}${line('M50 21l5 5-5 5', '#be185d')}`,
  objectBucket: `<path d="M11 13h42l-5 34H16z" fill="#dbeafe" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/><ellipse cx="32" cy="13" rx="21" ry="6" fill="#eff6ff" stroke="#1d4ed8" stroke-width="2"/>${line('M32 25v14M27 34l5 5 5-5', '#3b82f6')}`,
  imageScanner: `${layers(24, 6, 19, 1, '#ffedd5', '#ea580c')}<circle cx="41" cy="30" r="10" fill="#fff" stroke="#2563eb" stroke-width="2.4"/>${line('M48 37l9 9M36 30l3 4 7-8', '#2563eb', 2.4)}`,
  dashboard: `<rect x="4" y="3" width="56" height="39" rx="4" ${BODY}/><rect x="8" y="7" width="48" height="31" rx="2" fill="#eff6ff"/><rect x="12" y="11" width="13" height="8" rx="1" fill="#93c5fd"/><rect x="29" y="11" width="13" height="8" rx="1" fill="#86efac"/>${line('M12 33l9-6 7 3 8-7 8 4 8-5', '#2563eb')}${line('M32 42v7M23 49h18')}`,
  iac: `<path d="M12 4h29l11 11v33H12z" fill="#ccfbf1" stroke="#0f766e" stroke-width="2" stroke-linejoin="round"/>${line('M41 4v11h11', '#0f766e', 1.5)}${line('M25 23l-7 7 7 7M39 23l7 7-7 7M34 20l-4 20', '#0f766e')}`,
  configMgmt: `<rect x="6" y="5" width="52" height="42" rx="5" fill="#f0fdfa" stroke="#0f766e" stroke-width="2"/>${line('M13 15h38M13 26h38M13 37h38', '#14b8a6')}${[[24, 15], [42, 26], [30, 37]].map(([xx, yy]) => `<circle cx="${xx}" cy="${yy}" r="4.5" fill="#99f6e4" stroke="#0f766e" stroke-width="1.5"/>`).join('')}`,
  onCall: `${line('M13 28v-4a19 19 0 0 1 38 0v4', '#7c3aed', 3)}<rect x="8" y="27" width="9" height="15" rx="3" fill="#ddd6fe" stroke="#6d28d9" stroke-width="2"/><rect x="47" y="27" width="9" height="15" rx="3" fill="#ddd6fe" stroke="#6d28d9" stroke-width="2"/>${line('M51 42q0 6-9 6h-6', '#6d28d9')}${dot(35, 48, 2.5, '#6d28d9')}`,
  sqlDatabase: dbShape('#dbeafe', '#2563eb') + label(32, 37, 12, '#1d4ed8', 'SQL'),
  nosqlDatabase: dbShape('#dcfce7', '#16a34a') + label(32, 38, 15, '#15803d', '{ }'),
  timeSeriesDb: dbShape('#fef3c7', '#d97706') + line('M16 37l7-8 6 5 7-10 6 6 6-4', '#b45309'),
  virtualMachine: `<rect x="5" y="6" width="54" height="40" rx="4" ${BODY}/>${[['11', '#dbeafe', '#2563eb'], ['35', '#ede9fe', '#7c3aed']].map(([xx, fl, sk]) => `<rect x="${xx}" y="13" width="18" height="26" rx="2" fill="${fl}" stroke="${sk}" stroke-width="1.5"/>${line(`M${+xx + 4} 19h10M${+xx + 4} 25h10`, sk, 1.5)}`).join('')}`,
  vm: `<rect x="5" y="3" width="54" height="37" rx="4" ${BODY}/><path d="M21 31h20a6 6 0 0 0 0-12 9 9 0 0 0-17-2 7 7 0 0 0-3 14z" fill="#dbeafe" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>${line('M32 40v8M22 48h20')}`,
  webServer: roleServer(line('M32 17h26M45 4q-9 13 0 26M45 4q9 13 0 26', '#2563eb', 1.6)),
  mailServer: roleServer(`<rect x="37" y="11" width="16" height="12" rx="1" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/>${line('M37 12l8 6 8-6', '#2563eb', 1.5)}`),
  dnsServer: roleServer(label(45, 20, 9, '#1d4ed8', 'DNS')),
  dhcpServer: roleServer(label(45, 20, 7.5, '#1d4ed8', 'DHCP')),
  developer: `<circle cx="24" cy="12" r="8" fill="#f3c9a5" stroke="#9a5b3c" stroke-width="1.5"/><path d="M6 48q1-24 18-24t18 24z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="2"/><rect x="30" y="28" width="28" height="17" rx="2" fill="#f8fafc" stroke="#475569" stroke-width="2"/>${line('M40 33l-4 3.500 4 3.500M48 33l4 3.500-4 3.500', '#2563eb', 1.6)}${line('M27 48h34')}`,
  mobile: `<rect x="20" y="3" width="24" height="46" rx="5" ${BODY}/><rect x="23" y="8" width="18" height="33" rx="2" fill="#dbeafe"/>${dot(32, 45, 1.5, '#64748b')}`,
  tablet: `<rect x="7" y="7" width="50" height="38" rx="5" ${BODY}/><rect x="12" y="12" width="36" height="28" rx="2" fill="#dbeafe"/>${dot(53, 26, 1.5, '#64748b')}`,
  mobileApp: `<rect x="20" y="3" width="24" height="46" rx="5" ${BODY}/>${[[24, 9, '#60a5fa'], [33, 9, '#4ade80'], [24, 18, '#fbbf24'], [33, 18, '#f87171'], [24, 27, '#a78bfa'], [33, 27, '#38bdf8']].map(([xx, yy, c]) => `<rect x="${xx}" y="${yy}" width="7" height="7" rx="2" fill="${c}"/>`).join('')}${dot(32, 44, 1.5, '#64748b')}`,
  browser: `${windowFrame}<circle cx="32" cy="31" r="11" fill="#dbeafe" stroke="#2563eb" stroke-width="1.7"/>${line('M21 31h22M32 20q-7 11 0 22M32 20q7 11 0 22', '#2563eb', 1.4)}`,
  frontend: `${windowFrame}<rect x="9" y="19" width="12" height="24" rx="1" fill="#bfdbfe"/><rect x="25" y="19" width="30" height="9" rx="1" fill="#93c5fd"/><rect x="25" y="32" width="13" height="11" rx="1" fill="#bbf7d0"/><rect x="42" y="32" width="13" height="11" rx="1" fill="#fde68a"/>`,
  backend: `<rect x="5" y="5" width="54" height="42" rx="5" ${BODY}/><circle cx="32" cy="26" r="8" fill="#dbeafe" stroke="#2563eb" stroke-width="2.5"/>${line('M32 12v5M32 35v5M18 26h5M41 26h5M22 16l4 4M38 32l4 4M42 16l-4 4M26 32l-4 4', '#2563eb', 3)}${dot(32, 26, 2.5, '#2563eb')}`,
  apiGateway: `<rect x="20" y="7" width="24" height="38" rx="4" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>${label(32, 30, 10, '#1d4ed8', 'API')}${line('M3 26h15M13 21l5 5-5 5M46 15h14M55 10l5 5-5 5M46 37h14M55 32l5 5-5 5', '#1d4ed8')}`,
};
// Kubernetes: bảy cạnh xanh, hình trắng. Vẽ theo quy ước hình dạng của bộ icon cộng đồng, không chép nguyên bản.
const HEPT = `<path d="M${Array.from({ length: 7 }, (_, i) => { const a = (i * 2 * Math.PI) / 7; return `${(32 + 25 * Math.sin(a)).toFixed(1)} ${(27.5 - 25 * Math.cos(a)).toFixed(1)}`; }).join('L')}z" fill="#326ce5" stroke="#1e4fbf" stroke-width="1.5" stroke-linejoin="round"/>`;
const WH = 'fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
Object.assign(ART, {
  pod: `${HEPT}<path d="M32 14l11 6v13l-11 6-11-6V20zM21 20l11 6 11-6M32 26v13" ${WH}/>`,
  service: `${HEPT}<path d="M32 21v5M20 32v-6h24v6M32 26v6" ${WH}/><rect x="27" y="13" width="10" height="8" rx="1.5" fill="#fff"/><rect x="16" y="32" width="8" height="7" rx="1.5" fill="#fff"/><rect x="28" y="32" width="8" height="7" rx="1.5" fill="#fff"/><rect x="40" y="32" width="8" height="7" rx="1.5" fill="#fff"/>`,
  ingress: `${HEPT}<path d="M16 27h10l8-8h10m-4-4 4 4-4 4M26 27l8 8h10m-4-4 4 4-4 4" ${WH}/>`,
  ingressController: `${HEPT}<path d="M33 27h13m-5-5 5 5-5 5M17 20l6 4M17 34l6-4" ${WH}/><circle cx="27" cy="27" r="6" fill="#fff"/><circle cx="27" cy="27" r="2" fill="#326ce5"/>`,
  deployment: `${HEPT}<path d="M42 23a11 11 0 1 0 1.5 8M44 15v8h-8" ${WH}/>`,
  namespace: `${HEPT}<rect x="19" y="16" width="26" height="22" rx="3" ${WH} stroke-dasharray="4.5 3.5"/>`,
  node: `${HEPT}<rect x="20" y="14" width="24" height="7" rx="1.5" fill="#fff"/><rect x="20" y="24" width="24" height="7" rx="1.5" fill="#fff"/><rect x="20" y="34" width="24" height="7" rx="1.5" fill="#fff"/><circle cx="24" cy="17.5" r="1.3" fill="#326ce5"/><circle cx="24" cy="27.5" r="1.3" fill="#326ce5"/><circle cx="24" cy="37.5" r="1.3" fill="#326ce5"/>`,
  volume: `${HEPT}<path d="M21 19c0-5 22-5 22 0v16c0 5-22 5-22 0zM21 19c0 5 22 5 22 0M21 27c0 5 22 5 22 0" ${WH}/>`,
  configSecret: `${HEPT}<path d="M27 25v-4a5 5 0 0 1 10 0v4" ${WH}/><rect x="22" y="25" width="20" height="14" rx="2.5" fill="#fff"/><circle cx="32" cy="31" r="2" fill="#326ce5"/><path d="M32 32v3" stroke="#326ce5" stroke-width="2" stroke-linecap="round"/>`,
});
function drawIcon(s) {
  if (ART[s.t]) return ART[s.t];
  const { x, y, w, h } = s, cx = x + w / 2, cy = y + h / 2, f = esc(s.fill), st = esc(s.stroke);
  const box = (rx = s.radius ?? 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" stroke="${st}" stroke-width="2"/>`;
  const metal = '#f1f5f9', screen = '#dbeafe', dark = '#eef2f7', deviceDefs = '';
  switch (s.t) {
    case 'router': return `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${f}" stroke="${st}" stroke-width="2"/>` +
      `<path d="M${cx - w * 0.28} ${cy - h * 0.18}l${w * 0.16} ${h * 0.12}M${cx + w * 0.28} ${cy - h * 0.18}l${-w * 0.16} ${h * 0.12}M${cx - w * 0.28} ${cy + h * 0.18}l${w * 0.16} ${-h * 0.12}M${cx + w * 0.28} ${cy + h * 0.18}l${-w * 0.16} ${-h * 0.12}" stroke="${st}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'switch': return box(4) +
      `<path d="M${x + w * 0.22} ${cy - h * 0.14}h${w * 0.5}m-${w * 0.1} -${h * 0.1}l${w * 0.1} ${h * 0.1}l-${w * 0.1} ${h * 0.1}M${x + w * 0.78} ${cy + h * 0.14}h-${w * 0.5}m${w * 0.1} -${h * 0.1}l-${w * 0.1} ${h * 0.1}l${w * 0.1} ${h * 0.1}" fill="none" stroke="${st}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'l3switch': { const r = h * 0.2, a = h * 0.09; return box(4) +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${st}" stroke-width="2"/>` +
      `<path d="M${cx - r * 0.5} ${cy - r * 0.5}l${r} ${r}M${cx + r * 0.5} ${cy - r * 0.5}l${-r} ${r}" stroke="${st}" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M${cx + r} ${cy}h${w * 0.2}m${-a} ${-a}l${a} ${a}l${-a} ${a}M${cx - r} ${cy}h${-w * 0.2}m${a} ${-a}l${-a} ${a}l${a} ${a}M${cx} ${cy - r}v${-h * 0.16}m${-a} ${a}l${a} ${-a}l${a} ${a}M${cx} ${cy + r}v${h * 0.16}m${-a} ${-a}l${a} ${a}l${a} ${-a}" fill="none" stroke="${st}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`; }
    case 'wlc': { const a = h * 0.11; return box(4) +
      `<circle cx="${x + w * 0.24}" cy="${cy + h * 0.2}" r="${h * 0.06}" fill="${st}"/>` +
      `<path d="M${x + w * 0.15} ${cy + h * 0.04}q${w * 0.09} ${-h * 0.26} ${w * 0.18} 0M${x + w * 0.09} ${cy - h * 0.08}q${w * 0.15} ${-h * 0.42} ${w * 0.3} 0" fill="none" stroke="${st}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M${x + w * 0.52} ${cy - h * 0.16}h${w * 0.32}m${-a} ${-a}l${a} ${a}l${-a} ${a}M${x + w * 0.84} ${cy + h * 0.16}h${-w * 0.32}m${a} ${-a}l${-a} ${a}l${a} ${a}" fill="none" stroke="${st}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`; }
    case 'firewall': {
      let b = box(3);
      for (let i = 1; i < 4; i++) b += `<line x1="${x}" y1="${r1(y + (h * i) / 4)}" x2="${x + w}" y2="${r1(y + (h * i) / 4)}" stroke="${st}" stroke-width="1.4"/>`;
      for (let i = 0; i < 4; i++) { const xx = r1(x + (w * (i % 2 ? 0.66 : 0.33))); b += `<line x1="${xx}" y1="${r1(y + (h * i) / 4)}" x2="${xx}" y2="${r1(y + (h * (i + 1)) / 4)}" stroke="${st}" stroke-width="1.4"/>`; }
      return b;
    }
    case 'pc': return `<rect x="${x + 4}" y="${y}" width="${w - 8}" height="${h * 0.7}" rx="4" fill="${f}" stroke="${st}" stroke-width="2"/><rect x="${x + 10}" y="${y + 6}" width="${w - 20}" height="${r1(h * 0.7 - 12)}" fill="${st}" opacity="0.12"/><path d="M${cx} ${r1(y + h * 0.7)}v${r1(h * 0.16)}M${cx - w * 0.22} ${y + h - 2}h${w * 0.44}" stroke="${st}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'laptop': return `<rect x="${x + w * 0.12}" y="${y}" width="${w * 0.76}" height="${h * 0.68}" rx="3" fill="${f}" stroke="${st}" stroke-width="2"/><path d="M${x} ${y + h - 3}h${w}l-${w * 0.08} -${h * 0.22}h-${w * 0.84}z" fill="${f}" stroke="${st}" stroke-width="2" stroke-linejoin="round"/>`;
    case 'phone': return box(8) + `<rect x="${x + 8}" y="${y + 7}" width="${w - 16}" height="${r1(h * 0.3)}" fill="${st}" opacity="0.15"/>` + [0, 1, 2].map((r) => [0, 1, 2].map((c) => `<circle cx="${r1(x + w * (0.3 + c * 0.2))}" cy="${r1(y + h * (0.55 + r * 0.14))}" r="2" fill="${st}"/>`).join('')).join('');
    case 'ap': return `<circle cx="${cx}" cy="${y + h * 0.72}" r="4" fill="${st}"/>` + [0.2, 0.3, 0.4].map((k) => `<path d="M${r1(cx - w * k)} ${r1(y + h * 0.72 - w * k * 0.55)}A${r1(w * k)} ${r1(w * k)} 0 0 1 ${r1(cx + w * k)} ${r1(y + h * 0.72 - w * k * 0.55)}" fill="none" stroke="${st}" stroke-width="2.2" stroke-linecap="round"/>`).join('') + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/>`;
    case 'homeRouter': return deviceDefs+`<path d="M${x+13} ${y+24}L${x+9} ${y+3}M${x+w-13} ${y+24}L${x+w-9} ${y+3}" stroke="#64748b" stroke-width="2.2" stroke-linecap="round"/><path d="M${x+4} ${y+24}q${w/2-4}-12 ${w-8} 0v15q0 5-5 5H${x+9}q-5 0-5-5z" fill="${metal}" stroke="#475569" stroke-width="2"/><path d="M${cx-12} ${cy-2}q12-11 24 0M${cx-7} ${cy+1}q7-6 14 0" fill="none" stroke="#2563eb" stroke-width="2"/><circle cx="${x+18}" cy="${y+38}" r="1.9" fill="#22c55e"/><circle cx="${x+25}" cy="${y+38}" r="1.9" fill="#3b82f6"/><circle cx="${x+32}" cy="${y+38}" r="1.9" fill="#94a3b8"/>`;
    case 'loadBalancer': return deviceDefs+`<rect x="${x+12}" y="${y+18}" width="${w-24}" height="22" rx="5" fill="${screen}" stroke="#2563eb" stroke-width="2"/><path d="M${cx} ${y+18}V${y+7}M${cx} ${y+40}V${y+48}M${x+12} ${cy}H${x+4}M${x+w-12} ${cy}h8" stroke="#64748b" stroke-width="1.8"/><circle cx="${x+5}" cy="${cy}" r="3" fill="#22c55e"/><circle cx="${x+w-5}" cy="${cy}" r="3" fill="#22c55e"/><rect x="${cx-10}" y="${y+24}" width="20" height="4" rx="2" fill="#1d4ed8"/><rect x="${cx-10}" y="${y+31}" width="20" height="4" rx="2" fill="#1d4ed8" opacity=".6"/><path d="M${cx-4} ${y+10}l4-4 4 4" fill="none" stroke="#2563eb" stroke-width="1.8"/>`;
    case 'idsIps': return `<path d="M${cx} ${y+4}L${x+w-9} ${y+13}v11q0 14-${w/2-9} 21Q${x+9} ${y+38} ${x+9} ${y+24}V${y+13}Z" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/><path d="M${x+17} ${cy}h7l4-7 6 14 5-8h8" fill="none" stroke="#b91c1c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${cx}" cy="${y+17}" r="2" fill="#f97316"/>`;
    case 'mediaConverter': return deviceDefs+`<rect x="${x+5}" y="${y+11}" width="${w-10}" height="${h-22}" rx="6" fill="${metal}" stroke="#475569" stroke-width="2"/><rect x="${x+10}" y="${y+18}" width="15" height="17" rx="2" fill="#dbeafe" stroke="#2563eb"/><path d="M${x+13} ${y+22}h9m-9 5h9m-9 5h9" stroke="#60a5fa" stroke-width="1.5"/><path d="M${x+29} ${cy}h${w-40}m-6-5 6 5-6 5" fill="none" stroke="#f59e0b" stroke-width="2"/><circle cx="${x+w-12}" cy="${cy}" r="2" fill="#22c55e"/>`;
    case 'sdwanEdge': return deviceDefs+`<path d="M${x+8} ${y+11}h${w-16}v${h-22}H${x+8}z" fill="${dark}" stroke="#475569" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="11" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><path d="M${cx} ${cy-8}v16m-8-8h16m-14-6 12 12m0-12L${cx-6} ${cy+6}" stroke="#2563eb" stroke-width="1.7"/><circle cx="${x+14}" cy="${y+15}" r="2" fill="#4ade80"/><circle cx="${x+w-14}" cy="${y+15}" r="2" fill="#60a5fa"/>`;
    case 'wirelessController': return deviceDefs+`<rect x="${x+6}" y="${y+10}" width="${w-12}" height="${h-20}" rx="5" fill="${metal}" stroke="#475569" stroke-width="2"/><circle cx="${x+17}" cy="${cy}" r="3" fill="#22c55e"/><path d="M${x+28} ${cy+8}q12-16 24 0m-20-5q8-10 16 0m-12-5q4-5 8 0" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/><path d="M${x+13} ${y+16}h8m-8 5h8m-8 5h8" stroke="#64748b" stroke-width="1.2"/>`;
    case 'olt': return `<rect x="${x+4}" y="${y+13}" width="${w-22}" height="${h-26}" rx="4" fill="${metal}" stroke="#475569" stroke-width="2"/>${[0,1,2,3].map(i=>`<rect x="${x+9+i*8}" y="${y+20}" width="5" height="7" rx="1" fill="#60a5fa"/>`).join('')}<circle cx="${x+11}" cy="${y+33}" r="2" fill="#22c55e"/><path d="M${x+46} ${cy}l14-13M${x+46} ${cy}h14M${x+46} ${cy}l14 13" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>`;
    case 'ont': return `<path d="M${x+3} ${cy+5}h11" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/><rect x="${x+14}" y="${y+16}" width="${w-24}" height="${h-30}" rx="5" fill="${metal}" stroke="#475569" stroke-width="2"/>${[0,1,2].map(i=>`<circle cx="${x+21+i*7}" cy="${y+23}" r="2" fill="${['#22c55e','#22c55e','#f59e0b'][i]}"/>`).join('')}<rect x="${x+38}" y="${y+28}" width="6" height="6" rx="1" fill="#93c5fd" stroke="#2563eb" stroke-width="1"/><rect x="${x+46}" y="${y+28}" width="6" height="6" rx="1" fill="#93c5fd" stroke="#2563eb" stroke-width="1"/><path d="M${x+19} ${y+31}h13" stroke="#94a3b8" stroke-width="1.5"/>`;
    case 'splitter': return `<path d="M${x+3} ${cy}h15" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/><path d="M${x+18} ${cy-5}L${x+36} ${cy-17}V${cy+17}L${x+18} ${cy+5}z" fill="#fef3c7" stroke="#d97706" stroke-width="2" stroke-linejoin="round"/><path d="M${x+36} ${cy-12}H${x+61}M${x+36} ${cy-4}H${x+61}M${x+36} ${cy+4}H${x+61}M${x+36} ${cy+12}H${x+61}" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>`;
    case 'sbc': return `<rect x="${x+5}" y="${y+11}" width="${w-10}" height="${h-22}" rx="5" fill="${metal}" stroke="#475569" stroke-width="2"/><path d="M${cx} ${y+14}v${h-28}" stroke="#ef4444" stroke-width="2" stroke-dasharray="3 2"/><path d="M${x+11} ${cy-5}h13m-4-4 4 4-4 4M${x+w-11} ${cy+5}h-13m4-4-4 4 4 4" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'voiceGateway': return `<rect x="${x+5}" y="${y+12}" width="${w-10}" height="${h-24}" rx="5" fill="${metal}" stroke="#475569" stroke-width="2"/><path d="M${x+11} ${cy}q4-9 8 0t8 0" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round"/><rect x="${x+34}" y="${y+20}" width="8" height="7" rx="1.5" fill="#fde68a" stroke="#d97706" stroke-width="1"/><rect x="${x+45}" y="${y+20}" width="8" height="7" rx="1.5" fill="#fde68a" stroke="#d97706" stroke-width="1"/><path d="M${x+34} ${y+32}h19" stroke="#94a3b8" stroke-width="1.5"/>`;
    case 'nvr': return `<rect x="${x+4}" y="${y+12}" width="${w-8}" height="${h-24}" rx="4" fill="${dark}" stroke="#475569" stroke-width="2"/><circle cx="${x+13}" cy="${cy}" r="4" fill="#ef4444"/>${[0,1,2,3].map(i=>`<rect x="${x+23+(i%2)*9}" y="${y+17+Math.floor(i/2)*9}" width="7" height="7" rx="1" fill="#dbeafe" stroke="#2563eb" stroke-width="1"/>`).join('')}<path d="M${x+45} ${y+19}h11m-11 5h11m-11 5h11" stroke="#64748b" stroke-width="1.5"/>`;
    case 'atm': return `<rect x="${x+15}" y="${y+2}" width="${w-30}" height="${h-4}" rx="4" fill="${metal}" stroke="#475569" stroke-width="2"/><rect x="${x+20}" y="${y+7}" width="${w-40}" height="14" rx="2" fill="#dbeafe" stroke="#2563eb" stroke-width="1.2"/>${[0,1,2,3,4,5].map(i=>`<circle cx="${x+25+(i%3)*7}" cy="${y+27+Math.floor(i/3)*6}" r="1.6" fill="#64748b"/>`).join('')}<path d="M${x+21} ${y+42}h${w-42}" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>`;
    case 'posTerminal': return `<path d="M${x+13} ${y+5}h${w-30}l4 22h${-(w-22)}z" fill="#dbeafe" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/><path d="M${x+27} ${y+27}v9M${x+11} ${y+44}h${w-22}v-6q0-2-2-2H${x+13}q-2 0-2 2z" fill="${metal}" stroke="#475569" stroke-width="2" stroke-linejoin="round"/><path d="M${x+46} ${y+12}h9v14h-9" fill="#fff" stroke="#94a3b8" stroke-width="1.3"/><path d="M${x+17} ${y+41}h10" stroke="#16a34a" stroke-width="2" stroke-linecap="round"/>`;
    case 'plc': return `<rect x="${x+7}" y="${y+6}" width="${w-14}" height="${h-12}" rx="3" fill="${metal}" stroke="#475569" stroke-width="2"/><path d="M${x+21} ${y+6}v${h-12}M${x+33} ${y+6}v${h-12}M${x+45} ${y+6}v${h-12}" stroke="#94a3b8" stroke-width="1.3"/>${[0,1,2,3].map(i=>`<circle cx="${x+14}" cy="${y+13+i*6}" r="1.8" fill="${['#22c55e','#22c55e','#f59e0b','#94a3b8'][i]}"/>`).join('')}${[0,1,2].map(i=>`<rect x="${x+24+i*12}" y="${y+35}" width="6" height="6" rx="1" fill="#fde68a" stroke="#d97706" stroke-width="1"/><path d="M${x+24+i*12} ${y+14}h6m-6 5h6" stroke="#64748b" stroke-width="1.2"/>`).join('')}`;
    case 'consoleServer': return `<rect x="${x+3}" y="${y+14}" width="${w-6}" height="${h-28}" rx="4" fill="${dark}" stroke="#475569" stroke-width="2"/><path d="M${x+9} ${cy-4}l5 4-5 4M${x+17} ${cy+4}h6" fill="none" stroke="#16a34a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${[0,1,2,3,4,5].map(i=>`<circle cx="${x+30+i*5}" cy="${cy}" r="1.9" fill="#f8fafc" stroke="#64748b" stroke-width="1"/>`).join('')}`;
    case 'hsm': return `<rect x="${x+6}" y="${y+10}" width="${w-12}" height="${h-20}" rx="5" fill="${dark}" stroke="#475569" stroke-width="2"/><circle cx="${x+21}" cy="${cy}" r="6" fill="#fef3c7" stroke="#d97706" stroke-width="2"/><circle cx="${x+21}" cy="${cy}" r="1.8" fill="#d97706"/><path d="M${x+27} ${cy}h22m-5 0v6m-7-6v4" fill="none" stroke="#d97706" stroke-width="2.2" stroke-linecap="round"/><circle cx="${x+w-12}" cy="${y+16}" r="1.8" fill="#22c55e"/>`;
    case 'bridge': return `<path d="M${x+6} ${y+44}V${y+22}h${w-12}v22h-12a14 14 0 0 0-28 0z" fill="#eff6ff" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/><path d="M${x+14} ${y+12}h${w-28}m-5-5 5 5-5 5M${x+19} ${y+7}l-5 5 5 5" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'patchPanel': return `<rect x="${x+4}" y="${y+11}" width="${w-8}" height="${h-22}" rx="3" fill="#eef2f7" stroke="#475569" stroke-width="2"/><path d="M${x+9} ${y+19}h${w-18}m-${w-18} 8h${w-18}" stroke="#64748b" stroke-width="1"/>${Array.from({length:8},(_,i)=>`<rect x="${x+9+i*6}" y="${y+15}" width="4" height="6" rx="1" fill="${['#60a5fa','#f59e0b','#4ade80','#f87171'][i%4]}"/><rect x="${x+9+i*6}" y="${y+25}" width="4" height="6" rx="1" fill="${['#60a5fa','#f59e0b','#4ade80','#f87171'][i%4]}"/>`).join('')}`;
    case 'pdu': return deviceDefs+`<rect x="${x+18}" y="${y+6}" width="${w-36}" height="${h-9}" rx="5" fill="${dark}" stroke="#475569" stroke-width="2"/><circle cx="${cx}" cy="${y+12}" r="2" fill="#22c55e"/>${[0,1,2,3].map(i=>`<circle cx="${cx}" cy="${y+20+i*7}" r="2.5" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"/>`).join('')}<path d="M${cx} ${y+6}V${y+3}q0-2 3-2" fill="none" stroke="#64748b" stroke-width="2"/>`;
    case 'kvm': return deviceDefs+`<rect x="${x+5}" y="${y+13}" width="${w-10}" height="${h-20}" rx="4" fill="${metal}" stroke="#475569" stroke-width="2"/><rect x="${x+14}" y="${y+5}" width="${w-28}" height="22" rx="3" fill="#eef2f7" stroke="#64748b"/><rect x="${x+17}" y="${y+8}" width="${w-34}" height="16" fill="#bfdbfe"/><path d="M${cx} ${y+35}v7m-11 0h22" stroke="#475569" stroke-width="2"/><circle cx="${x+13}" cy="${y+39}" r="2" fill="#22c55e"/>`;
    case 'precisionCooling': return deviceDefs+`<rect x="${x+10}" y="${y+4}" width="${w-20}" height="${h-8}" rx="5" fill="${metal}" stroke="#475569" stroke-width="2"/><rect x="${x+15}" y="${y+9}" width="${w-30}" height="${h-18}" rx="3" fill="#e0f2fe" stroke="#38bdf8"/><circle cx="${cx}" cy="${cy}" r="9" fill="#fff" stroke="#0284c7" stroke-width="1.5"/><path d="M${cx} ${cy-8}q-8 2-3 8 3 3 3 0m7 4q-2-8-8-3-3 3 0 3m-4 7q8-2 3-8-3-3-3 0" fill="#7dd3fc" stroke="#0284c7" stroke-width="1.2"/><circle cx="${x+19}" cy="${y+h-11}" r="2" fill="#22c55e"/>`;
    case 'temperatureSensor': return `<rect x="${x+24}" y="${y+6}" width="16" height="34" rx="8" fill="#fff7ed" stroke="#ea580c" stroke-width="2"/><circle cx="${cx}" cy="${y+39}" r="7" fill="#f97316"/><rect x="${cx-3}" y="${y+14}" width="6" height="21" rx="3" fill="#fb923c"/><path d="M${x+43} ${y+14}h8m-8 8h6m-6 8h8" stroke="#64748b" stroke-width="1.5"/>`;
    case 'smokeSensor': return `<path d="M${x+8} ${y+38}q0-8 8-8 0-10 10-10 5-12 15-5 11-2 12 9 7 3 6 10 0 7-8 7H${x+16}q-8 0-8-3z" fill="#f1f5f9" stroke="#64748b" stroke-width="2"/><circle cx="${cx}" cy="${y+34}" r="4" fill="#ef4444"/><path d="M${cx-6} ${y+18}q6-9 12 0m-17-3q11-15 22 0" fill="none" stroke="#94a3b8" stroke-width="1.5"/>`;
    case 'doorAccess': return `<rect x="${x+13}" y="${y+4}" width="${w-26}" height="${h-8}" rx="3" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><path d="M${cx-4} ${y+5}v${h-10}m-7-2h7" stroke="#1d4ed8" stroke-width="1.5"/><rect x="${x+4}" y="${cy-8}" width="12" height="16" rx="2" fill="#eef2f7"/><circle cx="${x+10}" cy="${cy-3}" r="1.5" fill="#4ade80"/><path d="M${x+6} ${cy+2}h8m-4-3v6" stroke="#e2e8f0" stroke-width="1"/>`;
    case 'ipPbx': return box(8)+`<path d="M${x+17} ${y+13}q-5 1-5 6 2 15 22 21 5 0 6-5l-8-6-5 4q-7-3-9-10l4-5z" fill="${st}"/><path d="M${x+39} ${y+13}q8 4 8 12m-8-19q13 6 13 19" fill="none" stroke="${st}" stroke-width="2"/>`;
    case 'rack': { const units=s.rackUnits||12,used=Math.max(0,Math.min(units,s.rackUsed||0)),barW=(w-56)*used/units; return deviceDefs+`<rect x="${x+12}" y="${y+2}" width="${w-24}" height="${h-4}" rx="4" fill="#334155" stroke="#334155" stroke-width="2.5"/><rect x="${x+25}" y="${y+10}" width="${w-50}" height="${h-20}" rx="2" fill="#e2e8f0" fill-opacity=".18" stroke="#94a3b8" stroke-width="1"/><path d="M${x+19} ${y+12}v${h-24}M${x+w-19} ${y+12}v${h-24}" stroke="#cbd5e1" stroke-width="2"/>`+Array.from({length:units},(_,i)=>{const yy=y+12+(h-24)*(i/units);return `<path d="M${x+25} ${yy}h${w-50}" stroke="#cbd5e1" stroke-opacity=".28" stroke-width=".8"/><path d="M${x+19} ${yy}h6m${w-31} 0h6" stroke="#cbd5e1" stroke-width="1.1"/><circle cx="${x+16}" cy="${yy}" r="1.2" fill="#60a5fa"/><text x="${x+8}" y="${yy+3}" font-size="4.5" text-anchor="middle" fill="#e2e8f0">${units-i}U</text>`}).join('')+`<rect x="${x+28}" y="${y+5}" width="${w-56}" height="5" rx="2" fill="#0f172a"/><rect x="${x+28}" y="${y+5}" width="${barW}" height="5" rx="2" fill="#38bdf8"/><text x="${cx}" y="${y+9}" text-anchor="middle" font-size="5.5" font-weight="700" fill="#f8fafc">${used}/${units}U</text>`; }
    case 'ups': return deviceDefs+`<rect x="${x+13}" y="${y+3}" width="${w-26}" height="${h-6}" rx="6" fill="${metal}" stroke="#a16207" stroke-width="2"/><rect x="${x+19}" y="${y+9}" width="${w-38}" height="14" rx="2" fill="#eef2f7"/><rect x="${x+22}" y="${y+12}" width="${w-44}" height="8" rx="1" fill="#86efac"/><path d="M${cx+2} ${y+11}l-5 7h4l-2 4 7-8h-4l2-3z" fill="#16a34a"/><circle cx="${x+23}" cy="${y+35}" r="3" fill="#22c55e"/><circle cx="${x+33}" cy="${y+35}" r="3" fill="#64748b"/><path d="M${x+42} ${y+35}h9" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>`;
    case 'nas': return deviceDefs+`<rect x="${x+5}" y="${y+4}" width="${w-10}" height="${h-8}" rx="6" fill="${metal}" stroke="#475569" stroke-width="2"/>`+[.28,.5,.72].map((k,i)=>`<rect x="${x+11}" y="${y+h*k-5}" width="${w-22}" height="8" rx="2" fill="${dark}" stroke="#64748b" stroke-width=".8"/><circle cx="${x+17}" cy="${y+h*k-1}" r="1.6" fill="#60a5fa"/><circle cx="${x+w-16}" cy="${y+h*k-1}" r="1.6" fill="#4ade80"/>`).join('');
    case 'server': {
      const glyph={webServer:'</>',mailServer:'✉',dnsServer:'DNS',dhcpServer:'DHCP',server:''}[s.t];
      return deviceDefs+`<rect x="${x+5}" y="${y+3}" width="${w-10}" height="${h-6}" rx="5" fill="${dark}" stroke="#475569" stroke-width="2"/>`+[.25,.48,.71].map((k,i)=>`<rect x="${x+9}" y="${y+h*k-4}" width="${w-18}" height="8" rx="1.5" fill="${i===1?'#64748b':'#475569'}" stroke="#94a3b8" stroke-width=".6"/><circle cx="${x+w-13}" cy="${y+h*k}" r="1.5" fill="#4ade80"/>`).join('')+(glyph?`<circle cx="${x+13}" cy="${y+10}" r="6.5" fill="#dbeafe" stroke="#2563eb"/><text x="${x+13}" y="${y+12}" text-anchor="middle" font-size="${glyph.length>2?5.2:7}" font-weight="700" fill="#1d4ed8">${glyph}</text>`:'');
    }
    case 'serverCluster': return deviceDefs+`<path d="M${x+13} ${y+10}l${w/2-13} -6 ${w/2-13} 6m-${w/2-13} 0v${h-14}" fill="none" stroke="#60a5fa" stroke-width="1.5"/>`+[0,1,2].map(i=>`<rect x="${x+4+i*7}" y="${y+5+i*3}" width="${w-8-i*14}" height="${h-10-i*6}" rx="4" fill="${i===2?'#dbeafe':metal}" stroke="#475569" stroke-width="1.7"/>`).join('')+`<circle cx="${cx}" cy="${cy}" r="2.5" fill="#22c55e"/>`;
    case 'cluster': return `<path d="M${cx} ${cy}L${x+17} ${y+15}m${w-34} 0L${cx} ${cy}m0 0L${x+17} ${y+h-13}m${w-34} 0L${cx} ${cy}" stroke="#38bdf8" stroke-width="2"/>${[[x+5,y+5],[x+w-27,y+5],[x+5,y+h-23],[x+w-27,y+h-23]].map(([px,py],i)=>`<rect x="${px}" y="${py}" width="22" height="18" rx="4" fill="${['#dbeafe','#ede9fe','#dcfce7','#ffedd5'][i]}" stroke="${['#2563eb','#7c3aed','#16a34a','#ea580c'][i]}" stroke-width="1.8"/><circle cx="${px+6}" cy="${py+6}" r="2" fill="${['#60a5fa','#a78bfa','#4ade80','#fb923c'][i]}"/><path d="M${px+11} ${py+6}h7m-7 5h7" stroke="#64748b" stroke-width="1"/>`).join('')}`;
    case 'user': return `<path d="M${cx} ${y+6}a8 8 0 1 1 0 16 8 8 0 0 1 0-16" fill="#f3c9a5" stroke="#9a5b3c" stroke-width="1.5"/><path d="M${x+w*.18} ${y+h-3}q2-${h*.38} ${w*.3}-${h*.38}h${w*.2}q${w*.28} 0 ${w*.3} ${h*.38}z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="2"/><path d="M${cx-6} ${y+15}q6 5 12 0" fill="none" stroke="#9a5b3c" stroke-width="1.3"/>`;
    case 'objectStorage': return `<path d="M${x+5} ${y+15}q0-10 12-10h${w-29}q12 0 12 10v25q0 7-7 7H${x+12}q-7 0-7-7z" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><path d="M${x+5} ${y+15}q0 9 12 9h${w-29}q12 0 12-9M${cx-4} ${y+24}v16m0 0-5-5m5 5 5-5" fill="none" stroke="#1d4ed8" stroke-width="1.8"/>`;
    case 'blockStorage': return deviceDefs+`<rect x="${x+6}" y="${y+8}" width="${w-12}" height="${h-16}" rx="4" fill="${metal}" stroke="#475569" stroke-width="2"/><rect x="${x+12}" y="${y+13}" width="${w-24}" height="${h-26}" rx="2" fill="#e2e8f0" stroke="#94a3b8"/><circle cx="${x+19}" cy="${cy}" r="5" fill="#94a3b8" stroke="#475569"/><circle cx="${x+19}" cy="${cy}" r="1.5" fill="#eef2f7"/><path d="M${x+29} ${y+19}h${w-42}m-${w-42} 7h${w-42}" stroke="#64748b" stroke-width="2"/>`;
    case 'database': return `<path d="M${x+6} ${y+11}c0-10 ${w-12}-10 ${w-12} 0v${h-22}c0 10-${w-12} 10-${w-12} 0z" fill="#edf2ff" stroke="#5266a8" stroke-width="2.2"/><path d="M${x+6} ${y+11}c0 10 ${w-12} 10 ${w-12} 0M${x+6} ${cy}c0 10 ${w-12} 10 ${w-12} 0" fill="none" stroke="#7184c2" stroke-width="1.6"/><circle cx="${x+20}" cy="${y+20}" r="2" fill="#93c5fd"/><circle cx="${x+29}" cy="${y+20}" r="2" fill="#60a5fa"/>`;
    case 'runner': return `<rect x="${x+6}" y="${y+5}" width="${w-12}" height="${h-10}" rx="6" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/><circle cx="${cx}" cy="${y+17}" r="8" fill="#bae6fd" stroke="#0284c7" stroke-width="1.5"/><path d="M${cx-3} ${y+14}v6l6-3z" fill="#0369a1"/><path d="M${x+15} ${y+h-10}h${w-30}" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>`;
    case 'cache': return `<path d="M${x+9} ${y+8}h${w-18}v${h-16}H${x+9}z" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/>${[0,1].map(i=>`<path d="M${x+14} ${y+17+i*14}h${w-28}" stroke="#f87171" stroke-width="1.5"/><circle cx="${x+18+i*18}" cy="${y+24+i*2}" r="3" fill="#ef4444"/>`).join('')}`;
    case 'autoscaling': return `<circle cx="${cx}" cy="${cy}" r="17" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="5 3"/><path d="M${cx-5} ${cy-18}l5-5 5 5m-5-5v8m5 25-5 5-5-5m5 5v-8" fill="none" stroke="#2563eb" stroke-width="2"/>${[[-11,-5],[11,-5],[0,9]].map(([dx,dy])=>`<rect x="${cx+dx-5}" y="${cy+dy-4}" width="10" height="8" rx="2" fill="#dbeafe" stroke="#2563eb"/>`).join('')}`;
    case 'function': return `<path d="M${x+18} ${y+9}q-7 0-7 8v5q0 5-5 5 5 0 5 5v5q0 7 7 7m${w-36} -35q7 0 7 8v5q0 5 5 5-5 0-5 5v5q0 7-7 7" fill="none" stroke="#7c3aed" stroke-width="2.5"/><path d="M${cx-5} ${y+17}l-5 9h7l-2 9 8-12h-7l3-6z" fill="#f59e0b"/>`;
    case 'vault': return `<circle cx="${cx}" cy="${cy}" r="20" fill="#e0e7ff" stroke="#4f46e5" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="13" fill="#c7d2fe" stroke="#6366f1" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="4" fill="#4f46e5"/><path d="M${cx} ${cy-13}v7m13 6h-7m-6 13v-7m-13-6h7" stroke="#4338ca" stroke-width="2"/>`;
    case 'iam': return `<circle cx="${x+20}" cy="${y+18}" r="8" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/><path d="M${x+7} ${y+h-7}q2-17 13-17t13 17z" fill="#60a5fa" stroke="#2563eb" stroke-width="2"/><circle cx="${x+45}" cy="${cy}" r="8" fill="#fef3c7" stroke="#d97706" stroke-width="2"/><path d="M${x+53} ${cy}h8m-4 0v4" stroke="#b45309" stroke-width="2.5"/>`;
    case 'satellite': return `<rect x="${cx-8}" y="${cy-7}" width="16" height="14" rx="3" transform="rotate(-35 ${cx} ${cy})" fill="#e2e8f0" stroke="#64748b" stroke-width="2"/><path d="M${x+3} ${y+10}l14 2-4 14-14-2zM${x+w-3} ${y+h-10}l-14-2 4-14 14 2z" fill="#93c5fd" stroke="#2563eb" stroke-width="1.5"/><path d="M${x+16} ${y+18}l14 10m6-15q10-2 12 6m-15-12q16-4 19 10" fill="none" stroke="#64748b" stroke-width="1.5"/>`;
    case 'camera': return `<path d="M${x+8} ${y+16}h${w-16}v${h-22}H${x+8}z" fill="#e2e8f0" stroke="#475569" stroke-width="2"/><path d="M${x+8} ${y+16}l10-8h${w-18}v8" fill="#cbd5e1" stroke="#475569" stroke-width="1.5"/><circle cx="${cx+8}" cy="${cy-2}" r="10" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/><circle cx="${cx+8}" cy="${cy-2}" r="4" fill="#1e3a8a"/><path d="M${x+22} ${y+h-6}v4m-6 0h12" stroke="#475569" stroke-width="2"/>`;
    case 'iot': return `<rect x="${x+12}" y="${y+7}" width="${w-24}" height="${h-14}" rx="10" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="8" fill="#86efac" stroke="#16a34a" stroke-width="2"/><path d="M${x+5} ${y+14}q-7 12 0 24m${w-10}-24q7 12 0 24M${cx-4} ${cy}h8m-4-4v8" fill="none" stroke="#15803d" stroke-width="1.7"/>`;
    case 'television': return `<rect x="${x+4}" y="${y+5}" width="${w-8}" height="${h-15}" rx="4" fill="#eef2f7" stroke="#475569" stroke-width="2"/><rect x="${x+8}" y="${y+9}" width="${w-16}" height="${h-23}" rx="2" fill="#93c5fd"/><path d="M${cx} ${y+h-10}v5m-10 0h20" stroke="#475569" stroke-width="2"/><path d="M${x+13} ${cy}q10-12 20 0t18 0" fill="none" stroke="#fff" stroke-width="1.7"/>`;
    case 'monitor': return `<rect x="${x+4}" y="${y+3}" width="${w-8}" height="${h-13}" rx="4" fill="#eef2f7" stroke="#475569" stroke-width="2"/><rect x="${x+8}" y="${y+7}" width="${w-16}" height="${h-21}" rx="2" fill="#e0f2fe"/><path d="M${x+12} ${cy+7}l8-8 7 5 8-12 8 9 8-5" fill="none" stroke="#0284c7" stroke-width="2.4"/><path d="M${cx} ${y+h-10}v7m-9 0h18" stroke="#475569" stroke-width="2"/>`;
    case 'logging': return `<path d="M${x+12} ${y+6}h${w-24}l7 7v${h-15}H${x+12}z" fill="#f1f5f9" stroke="#475569" stroke-width="2"/><path d="M${x+19} ${y+20}h${w-31}m-${w-31} 7h${w-31}m-${w-31} 7h${w-39}" stroke="#64748b" stroke-width="2" stroke-linecap="round"/><circle cx="${x+15}" cy="${y+20}" r="2" fill="#22c55e"/><circle cx="${x+15}" cy="${y+27}" r="2" fill="#f59e0b"/><circle cx="${x+15}" cy="${y+34}" r="2" fill="#38bdf8"/>`;
    case 'tracing': return `<circle cx="${cx}" cy="${cy}" r="17" fill="#f5f3ff" stroke="#7c3aed" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="5" fill="#8b5cf6"/><path d="M${cx} ${cy-5}V${y+6}m5 11h${w/2-8}m-19 5v${h/2-8}m-5-7H${x+8}" stroke="#a78bfa" stroke-width="2.5"/><circle cx="${cx}" cy="${y+6}" r="3" fill="#c4b5fd" stroke="#6d28d9"/><circle cx="${x+w-8}" cy="${cy+6}" r="3" fill="#c4b5fd" stroke="#6d28d9"/><circle cx="${cx-5}" cy="${y+h-8}" r="3" fill="#c4b5fd" stroke="#6d28d9"/><circle cx="${x+8}" cy="${cy-1}" r="3" fill="#c4b5fd" stroke="#6d28d9"/>`;
    case 'alert': return `<path d="M${cx} ${y+4}L${x+w-5} ${y+h-5}H${x+5}Z" fill="#fee2e2" stroke="#dc2626" stroke-width="2.5"/><path d="M${cx} ${y+16}v12m0 6v1" stroke="#b91c1c" stroke-width="3" stroke-linecap="round"/>`;
    case 'microservice': return `<circle cx="${cx}" cy="${cy}" r="9" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/>${[0,1,2,3].map(i=>{const a=i*Math.PI/2,px=cx+Math.cos(a)*19,py=cy+Math.sin(a)*15;return `<path d="M${cx+Math.cos(a)*9} ${cy+Math.sin(a)*8}L${px} ${py}" stroke="#60a5fa" stroke-width="2"/><circle cx="${px}" cy="${py}" r="4" fill="#bfdbfe" stroke="#2563eb"/>`}).join('')}`;
    case 'publicCloud': return `<path d="M${x+14} ${y+h-12}h${w-27}a10 10 0 0 0 0-20 16 16 0 0 0-30-5 11 11 0 0 0 0 25z" fill="#e0f2fe" stroke="#0284c7" stroke-width="2.3"/><path d="M${cx-10} ${cy+4}v-12m0 0-5 5m5-5 5 5m8 7V${cy-1}m0 0-4 4m4-4 4 4" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round"/>`;
    case 'cdn': { const my = y + h / 2; return `<circle cx="${cx}" cy="${my}" r="15" fill="#fef3c7" stroke="#d97706" stroke-width="2"/><circle cx="${cx}" cy="${my}" r="9" fill="#fffbeb" stroke="#f59e0b" stroke-width="1.5"/><circle cx="${cx}" cy="${my}" r="3.5" fill="#f59e0b"/>${[[0,-21],[20,-11],[20,11],[0,21],[-20,11],[-20,-11]].map(([dx,dy])=>`<path d="M${cx+dx*.72} ${my+dy*.72}L${cx+dx} ${my+dy}" stroke="#d97706" stroke-width="2"/><circle cx="${cx+dx}" cy="${my+dy}" r="3.5" fill="#fde68a" stroke="#d97706"/>`).join('')}`; }
    case 'internetGateway': return `<path d="M${cx} ${y+4}v${h-8}M${x+8} ${cy}h${w-16}" stroke="#0284c7" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="17" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/><path d="M${cx-15} ${cy}h30m-15-15q-11 15 0 30m0-30q11 15 0 30" fill="none" stroke="#0284c7" stroke-width="1.5"/><path d="M${cx} ${y+4}l-4 5m4-5 4 5m0 ${h-8} -4-5m4 5 4-5M${x+8} ${cy}l5-4m-5 4 5 4m${w-16} 0-5-4m5 4-5 4" stroke="#0ea5e9" stroke-width="1.8"/>`;
    case 'vpcPeering': return `<rect x="${x+4}" y="${y+8}" width="22" height="${h-16}" rx="7" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><rect x="${x+w-26}" y="${y+8}" width="22" height="${h-16}" rx="7" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/><path d="M${x+26} ${cy}h${w-52}m-8-6 8 6-8 6m${w-36}-12-8 6 8 6" fill="none" stroke="#4f46e5" stroke-width="2.5"/><circle cx="${x+15}" cy="${cy}" r="4" fill="#60a5fa"/><circle cx="${x+w-15}" cy="${cy}" r="4" fill="#a78bfa"/>`;
    case 'privateLink': return `<path d="M${x+7} ${cy}h12m${w-38} 0h12" stroke="#0f766e" stroke-width="2.5"/><rect x="${x+17}" y="${y+10}" width="${w-34}" height="${h-20}" rx="8" fill="#ccfbf1" stroke="#0f766e" stroke-width="2"/><path d="M${cx-5} ${cy-1}v-4a5 5 0 0 1 10 0v4m-12 0h14v10h-14z" fill="#fff" stroke="#0f766e" stroke-width="1.5"/><circle cx="${cx}" cy="${cy+4}" r="1.5" fill="#0f766e"/>`;
    case 'transitGateway': return `<circle cx="${cx}" cy="${cy}" r="12" fill="#fef3c7" stroke="#d97706" stroke-width="2"/><path d="M${cx} ${cy-7}v14m-7-7h14m-7-19v7m0 24v7m-24-19h7m34 0h7m-36-17 5 5m20 24 5 5m0-34-5 5m-20 24-5 5" stroke="#d97706" stroke-width="2"/><circle cx="${x+7}" cy="${cy}" r="3" fill="#93c5fd" stroke="#2563eb"/><circle cx="${x+w-7}" cy="${cy}" r="3" fill="#bbf7d0" stroke="#16a34a"/><circle cx="${cx}" cy="${y+5}" r="3" fill="#ddd6fe" stroke="#7c3aed"/><circle cx="${cx}" cy="${y+h-5}" r="3" fill="#fecaca" stroke="#dc2626"/>`;
    case 'networkAcl': return `<path d="M${cx} ${y+5}L${x+w-8} ${y+12}v13q-2 12-${w/2-8} 20-14-8-14-20V${y+12}Z" fill="#fff7ed" stroke="#ea580c" stroke-width="2"/><path d="M${cx-8} ${cy-6}l16 16m0-16-16 16" stroke="#dc2626" stroke-width="2.5"/><path d="M${x+6} ${y+12}h9m-9 6h7m${w-21}-6h9m-9 6h7" stroke="#f97316" stroke-width="1.5"/>`;
    case 'cloudAccount': return `<rect x="${x+6}" y="${y+7}" width="${w-12}" height="${h-14}" rx="8" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><circle cx="${x+20}" cy="${y+20}" r="6" fill="#bfdbfe" stroke="#2563eb"/><path d="M${x+11} ${y+38}q1-9 9-9t9 9z" fill="#60a5fa"/><path d="M${x+36} ${y+18}h14m-14 7h14m-14 7h9" stroke="#64748b" stroke-width="2"/><path d="M${x+43} ${y+10}l4 4 7-7" fill="none" stroke="#16a34a" stroke-width="2"/>`;
    case 'waf': return `<path d="M${cx} ${y+4}L${x+w-8} ${y+12}v12q-2 13-${w/2-8} 20-14-7-14-20V${y+12}Z" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/><path d="M${x+15} ${cy}h8l4-7 6 14 5-8h10" fill="none" stroke="#b91c1c" stroke-width="2" stroke-linecap="round"/>`;
    case 'nac': return `<circle cx="${cx}" cy="${cy}" r="18" fill="#ecfdf5" stroke="#059669" stroke-width="2"/><path d="M${cx} ${cy-13}l10 4v8q-2 8-10 12-8-4-10-12v-8z" fill="#bbf7d0" stroke="#16a34a" stroke-width="1.5"/><path d="M${cx-5} ${cy}l4 4 7-8" fill="none" stroke="#15803d" stroke-width="2"/><path d="M${x+4} ${cy}h8m${w-20} 0h8" stroke="#059669" stroke-width="2"/>`;
    case 'dlp': return `<path d="M${cx} ${y+4}L${x+w-8} ${y+12}v12q-2 13-${w/2-8} 20-14-7-14-20V${y+12}Z" fill="#ffedd5" stroke="#ea580c" stroke-width="2"/><rect x="${cx-8}" y="${cy-4}" width="16" height="13" rx="2" fill="#fff7ed" stroke="#c2410c"/><path d="M${cx-5} ${cy-4}v-3a5 5 0 0 1 10 0v3m-5 4v4" fill="none" stroke="#c2410c" stroke-width="1.8"/>`;
    case 'siem': return `<rect x="${x+6}" y="${y+8}" width="${w-12}" height="${h-16}" rx="5" fill="#eef2f7" stroke="#475569" stroke-width="2"/><rect x="${x+11}" y="${y+13}" width="${w-22}" height="${h-26}" rx="2" fill="#fee2e2"/><path d="M${x+15} ${cy+7}l8-9 7 5 8-12 9 8" fill="none" stroke="#dc2626" stroke-width="2.2"/><circle cx="${x+16}" cy="${y+17}" r="2" fill="#ef4444"/><circle cx="${x+23}" cy="${y+17}" r="2" fill="#f59e0b"/>`;
    case 'mfa': return `<rect x="${cx-12}" y="${y+4}" width="24" height="${h-8}" rx="6" fill="#eef2f7" stroke="#475569" stroke-width="2"/><rect x="${cx-9}" y="${y+8}" width="18" height="${h-17}" rx="3" fill="#dbeafe"/><circle cx="${cx}" cy="${cy-4}" r="8" fill="#fff" stroke="#2563eb" stroke-width="1.5"/><path d="M${cx-4} ${cy-4}l3 3 5-6" fill="none" stroke="#16a34a" stroke-width="2"/><circle cx="${cx}" cy="${y+h-6}" r="1.5" fill="#cbd5e1"/>`;
    case 'identityProvider': return `<circle cx="${x+19}" cy="${y+18}" r="8" fill="#bfdbfe" stroke="#2563eb" stroke-width="2"/><path d="M${x+7} ${y+h-7}q1-16 12-16t12 16z" fill="#60a5fa" stroke="#2563eb" stroke-width="1.5"/><circle cx="${x+45}" cy="${y+22}" r="10" fill="#fef3c7" stroke="#d97706" stroke-width="2"/><path d="M${x+45} ${y+12}v20m-10-10h20m-17-7 14 14m0-14-14 14" stroke="#d97706" stroke-width="1"/><path d="M${x+31} ${cy}h4" stroke="#64748b" stroke-width="2"/>`;
    case 'vpnClient': return `<rect x="${x+5}" y="${y+9}" width="${w-10}" height="${h-18}" rx="5" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><path d="M${x+13} ${cy}h${w-26}" stroke="#7c3aed" stroke-width="2" stroke-dasharray="3 2"/><rect x="${cx-7}" y="${cy-7}" width="14" height="13" rx="2" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/><path d="M${cx-4} ${cy-7}v-4a4 4 0 0 1 8 0v4" fill="none" stroke="#d97706" stroke-width="1.5"/>`;
    case 'tapeLibrary': return deviceDefs+`<rect x="${x+9}" y="${y+4}" width="${w-18}" height="${h-8}" rx="4" fill="${dark}" stroke="#475569" stroke-width="2"/>${[0,1,2].map(i=>`<rect x="${x+14+i*13}" y="${y+12}" width="10" height="25" rx="2" fill="${['#bfdbfe','#ddd6fe','#bbf7d0'][i]}" stroke="#94a3b8"/><circle cx="${x+19+i*13}" cy="${y+17}" r="2" fill="#475569"/>`).join('')}<circle cx="${x+w-16}" cy="${y+12}" r="2" fill="#4ade80"/>`;
    case 'backupServer': return deviceDefs+`<rect x="${x+7}" y="${y+7}" width="${w-14}" height="${h-14}" rx="4" fill="${dark}" stroke="#475569" stroke-width="2"/><path d="M${x+13} ${y+17}h${w-26}m-${w-26} 10h${w-26}m-${w-26} 10h${w-26}" stroke="#94a3b8" stroke-width="3"/><path d="M${cx+2} ${y+11}l-6 10h5l-2 8 9-12h-6l2-6z" fill="#f59e0b"/><circle cx="${x+w-14}" cy="${y+17}" r="2" fill="#4ade80"/><circle cx="${x+w-14}" cy="${y+27}" r="2" fill="#4ade80"/>`;
    case 'nasArray': return deviceDefs+`<rect x="${x+5}" y="${y+6}" width="${w-10}" height="${h-12}" rx="5" fill="${metal}" stroke="#475569" stroke-width="2"/>${[0,1,2,3].map(i=>`<rect x="${x+10+i*11}" y="${y+12}" width="8" height="${h-24}" rx="2" fill="#eef2f7" stroke="#64748b"/><circle cx="${x+14+i*11}" cy="${y+h-16}" r="1.5" fill="${i%2?'#60a5fa':'#4ade80'}"/>`).join('')}`;
    case 'secretsManager': return `<path d="M${x+8} ${y+6}h${w-16}v${h-12}H${x+8}z" fill="#f5f3ff" stroke="#7c3aed" stroke-width="2"/><circle cx="${x+23}" cy="${cy}" r="8" fill="#ddd6fe" stroke="#6d28d9" stroke-width="2"/><path d="M${x+31} ${cy}h17m-5 0v5m-5-5v4" stroke="#6d28d9" stroke-width="2.5"/><circle cx="${x+15}" cy="${y+13}" r="1.5" fill="#a78bfa"/>`;
    case 'operator': return `<circle cx="${cx}" cy="${cy}" r="17" fill="#ecfdf5" stroke="#059669" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="8" fill="#bbf7d0" stroke="#16a34a" stroke-width="1.5"/><path d="M${cx} ${y+3}v8m-7 9 6-5 6 5m-26-10h12m18 0h12" fill="none" stroke="#059669" stroke-width="2"/><circle cx="${x+7}" cy="${cy}" r="3" fill="#60a5fa"/><circle cx="${x+w-7}" cy="${cy}" r="3" fill="#f59e0b"/>`;
    case 'serviceMesh': return `<circle cx="${cx}" cy="${cy}" r="6" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/>${[[-18,-13],[18,-13],[-18,13],[18,13]].map(([dx,dy],i)=>`<path d="M${cx+Math.sign(dx)*5} ${cy+Math.sign(dy)*4}L${cx+dx} ${cy+dy}" stroke="#8b5cf6" stroke-width="2"/><rect x="${cx+dx-6}" y="${cy+dy-5}" width="12" height="10" rx="3" fill="${['#dbeafe','#dcfce7','#ffedd5','#fce7f3'][i]}" stroke="${['#2563eb','#16a34a','#ea580c','#db2777'][i]}"/>`).join('')}`;
    case 'snapshot': return `<rect x="${x+9}" y="${y+9}" width="${w-18}" height="${h-18}" rx="4" fill="#f1f5f9" stroke="#64748b" stroke-width="2"/><path d="M${x+14} ${y+20}h${w-28}m-${w-28} 8h${w-28}" stroke="#94a3b8" stroke-width="2"/><circle cx="${x+w-15}" cy="${y+15}" r="8" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/><path d="M${x+w-15} ${y+10}v5l4 2" fill="none" stroke="#2563eb" stroke-width="1.5"/>`;
    case 'replication': return `<rect x="${x+6}" y="${y+8}" width="18" height="${h-16}" rx="3" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><rect x="${x+w-24}" y="${y+8}" width="18" height="${h-16}" rx="3" fill="#dcfce7" stroke="#16a34a" stroke-width="2"/><path d="M${x+24} ${cy-6}h${w-48}m-6-5 6 5-6 5m${w-36} 12h-${w-48}m6-5-6 5 6 5" fill="none" stroke="#0f766e" stroke-width="2"/>`;
    case 'fiberSingle': return `<path d="M${x+8} ${cy}q10-20 20 0t20 0 20 0" fill="none" stroke="#f97316" stroke-width="3"/><circle cx="${x+8}" cy="${cy}" r="4" fill="#fff7ed" stroke="#ea580c" stroke-width="2"/><circle cx="${x+w-8}" cy="${cy}" r="4" fill="#fff7ed" stroke="#ea580c" stroke-width="2"/>`;
    case 'fiberMulti': return `<path d="M${x+8} ${cy-4}q10-20 20 0t20 0 20 0M${x+8} ${cy+4}q10 20 20 0t20 0 20 0" fill="none" stroke="#2563eb" stroke-width="2.4"/><circle cx="${x+8}" cy="${cy}" r="4" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><circle cx="${x+w-8}" cy="${cy}" r="4" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>`;
    case 'consoleCable': return `<path d="M${x+9} ${cy}h${w-18}" stroke="#64748b" stroke-width="4"/><path d="M${x+9} ${cy-7}v14m5-11v8m${w-28}-8v8m5-11v14" stroke="#cbd5e1" stroke-width="2"/><rect x="${x+3}" y="${cy-7}" width="8" height="14" rx="1" fill="#eef2f7"/><rect x="${x+w-11}" y="${cy-7}" width="8" height="14" rx="1" fill="#eef2f7"/>`;
    case 'wifiLink': return `<circle cx="${x+12}" cy="${y+h-8}" r="4" fill="#f59e0b"/><circle cx="${x+w-12}" cy="${y+h-8}" r="4" fill="#f59e0b"/><path d="M${x+8} ${cy}q20-20 40 0m-32 6q12-12 24 0m-16 6q4-4 8 0" fill="none" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round"/>`;
    case 'vpnLink': return `<path d="M${x+6} ${cy}h${w-12}" stroke="#7c3aed" stroke-width="3" stroke-dasharray="5 3"/><rect x="${x+5}" y="${cy-8}" width="12" height="16" rx="2" fill="#ede9fe" stroke="#6d28d9"/><rect x="${x+w-17}" y="${cy-8}" width="12" height="16" rx="2" fill="#ede9fe" stroke="#6d28d9"/><path d="M${cx-5} ${cy-2}v-4a5 5 0 0 1 10 0v4m-11 0h12v9H${cx-6}z" fill="#fff" stroke="#6d28d9" stroke-width="1.5"/>`;
    case 'trustZone': return `<rect x="${x+4}" y="${y+5}" width="${w-8}" height="${h-10}" rx="9" fill="#dcfce7" fill-opacity=".7" stroke="#16a34a" stroke-width="2.5" stroke-dasharray="6 3"/><path d="M${cx} ${y+12}l11 4v8q-2 9-11 13-9-4-11-13v-8z" fill="#bbf7d0" stroke="#15803d" stroke-width="1.5"/><path d="M${cx-5} ${cy}l4 4 7-8" fill="none" stroke="#15803d" stroke-width="2"/>`;
    case 'untrustedZone': return `<rect x="${x+4}" y="${y+5}" width="${w-8}" height="${h-10}" rx="9" fill="#fee2e2" fill-opacity=".65" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="3 3"/><path d="M${cx} ${y+12}l11 4v8q-2 9-11 13-9-4-11-13v-8z" fill="#fecaca" stroke="#b91c1c" stroke-width="1.5"/><path d="M${cx-5} ${cy-4}l10 10m0-10-10 10" stroke="#b91c1c" stroke-width="2"/>`;
    case 'redundancyMark': return `<circle cx="${cx}" cy="${cy}" r="17" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><path d="M${cx-11} ${cy-3}a12 12 0 0 1 20-6l3 4m0-7v7h-7m10 8a12 12 0 0 1-20 6l-3-4m0 7v-7h7" fill="none" stroke="#2563eb" stroke-width="2.3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="3" fill="#60a5fa"/>`;
    case 'faultMark': return `<path d="M${cx} ${y+5}L${x+w-7} ${y+h-6}H${x+7}Z" fill="#fee2e2" stroke="#dc2626" stroke-width="2.5"/><path d="M${cx} ${y+19}v12m0 5v1" stroke="#b91c1c" stroke-width="3" stroke-linecap="round"/><path d="M${x+10} ${y+10}l6 5m${w-22}-5-6 5" stroke="#f87171" stroke-width="1.5"/>`;
    case 'printer': return `<rect x="${x + w * 0.2}" y="${y}" width="${w * 0.6}" height="${h * 0.3}" fill="#fff" stroke="${st}" stroke-width="1.6"/><rect x="${x}" y="${y + h * 0.28}" width="${w}" height="${h * 0.45}" rx="5" fill="${f}" stroke="${st}" stroke-width="2"/><rect x="${x + w * 0.2}" y="${y + h * 0.62}" width="${w * 0.6}" height="${h * 0.36}" fill="#fff" stroke="${st}" stroke-width="1.6"/>`;
    case 'cloud': return `<path d="M${r1(x + w * 0.25)} ${y + h * 0.85}h${w * 0.55}a${w * 0.17} ${h * 0.26} 0 0 0 0-${h * 0.52}a${w * 0.22} ${h * 0.32} 0 0 0-${w * 0.38}-${h * 0.14}a${w * 0.17} ${h * 0.26} 0 0 0-${w * 0.17} ${h * 0.66}z" fill="${f}" stroke="${st}" stroke-width="2" stroke-linejoin="round"/>`;
    case 'triangle': return `<path d="M${cx} ${y}L${x + w} ${y + h}H${x}Z" fill="${f}" stroke="${st}" stroke-width="2"/>`;
    case 'hexagon': return `<path d="M${x + w * .25} ${y}H${x + w * .75}L${x + w} ${cy}L${x + w * .75} ${y + h}H${x + w * .25}L${x} ${cy}Z" fill="${f}" stroke="${st}" stroke-width="2"/>`;
    case 'cylinder': return `<path d="M${x} ${y + 8}C${x} ${y - 2} ${x + w} ${y - 2} ${x + w} ${y + 8}V${y + h - 8}C${x + w} ${y + h + 2} ${x} ${y + h + 2} ${x} ${y + h - 8}Z" fill="${f}" stroke="${st}" stroke-width="2"/><path d="M${x} ${y + 8}C${x} ${y + 18} ${x + w} ${y + 18} ${x + w} ${y + 8}M${x} ${y + h - 8}C${x} ${y + h + 2} ${x + w} ${y + h + 2} ${x + w} ${y + h - 8}" fill="none" stroke="${st}" stroke-width="1.5"/>`;
    case 'star': { const ps = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? .42 : .5) * Math.min(w, h); return `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`; }).join('L'); return `<path d="M${ps}Z" fill="${f}" stroke="${st}" stroke-width="2"/>`; }
    case 'lock': return `<rect x="${x + w * .2}" y="${y + h * .42}" width="${w * .6}" height="${h * .48}" rx="5" fill="${f}" stroke="${st}" stroke-width="2"/><path d="M${x + w * .32} ${y + h * .44}V${y + h * .28}a${w * .18} ${w * .18} 0 0 1 ${w * .36} 0v${h * .16}" fill="none" stroke="${st}" stroke-width="3"/>`;
    case 'blockArrow': return `<path d="M${x} ${y + h * .25}H${x + w * .55}V${y}L${x + w} ${cy}L${x + w * .55} ${y + h}V${y + h * .75}H${x}Z" fill="${f}" stroke="${st}" stroke-width="2"/>`;
    default: { const glyph=SHAPES[s.t]?.glyph; return glyph ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${f}" stroke="${st}" stroke-width="2"/><rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" rx="9" fill="${st}" opacity="0.08"/><text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="${glyph.length > 5 ? 9 : 13}" font-weight="700" fill="${st}">${esc(glyph)}</text>` : ''; }
  }
}
// Hình nằm ngoài danh sách này vẽ theo đúng w/h của nó; còn lại vẽ trong khung mặc định rồi co giãn.
const PARAMETRIC = new Set(['router', 'switch', 'l3switch', 'firewall', 'server', 'pc', 'laptop', 'phone', 'ap', 'wlc', 'printer', 'cloud', 'rack', 'triangle', 'hexagon', 'cylinder', 'star', 'lock', 'blockArrow']);
function icon(s) {
  if (PARAMETRIC.has(s.t)) return drawIcon(s);
  const S = SHAPES[s.t], k = (n) => +n.toFixed(4);
  return `<g transform="translate(${s.x} ${s.y}) scale(${k(s.w / S.w)} ${k(s.h / S.h)})">${drawIcon({ ...s, x: 0, y: 0, w: S.w, h: S.h })}</g>`;
}
/** SVG của 1 hình (nhóm <g>). */
export function shapeSvg(s) {
  const S = SHAPES[s.t];
  const fw = s.bold === false ? 400 : null, fst = s.italic ? ' font-style="italic"' : '';
  const lab = (txt, tx, ty, anchor = 'middle', fs = s.fs, weight = 700, fill = s.color) => (txt ? String(txt).split('\n').map((ln, i) => `<text x="${r1(tx)}" y="${r1(ty + i * (fs + 3))}" text-anchor="${anchor}" font-size="${fs}" font-weight="${fw ?? weight}"${fst} fill="${esc(fill)}">${esc(ln)}</text>`).join('') : '');
  // Chữ nằm ngoài hình: nền tối đổi màu qua CSS, trừ khi người dùng đã tự chọn màu chữ.
  const labOut = (...a) => (s.color === '#1f2933' ? lab(...a).replace(/<text /g, '<text class="dg-lab-out" ') : lab(...a));
  const stroke = `stroke="${esc(s.stroke)}" stroke-width="${s.sw ?? 2}"${DASH[s.dash] ? ` stroke-dasharray="${DASH[s.dash]}"` : ''}`;
  let body;
  if (s.t === 'pipeline') {
    const steps = Array.isArray(s.steps) && s.steps.length ? s.steps : ['Build', 'Test', 'Scan', 'Deploy'], gap = 5, cw = (s.w - gap * (steps.length - 1)) / steps.length;
    body = steps.map((step, i) => { const xx = s.x + i * (cw + gap); return `<rect x="${r1(xx)}" y="${s.y}" width="${r1(cw)}" height="${s.h}" rx="6" fill="${i === steps.length - 1 ? '#e8f5e9' : '#eef5ff'}" stroke="${esc(s.stroke)}" stroke-width="1.5"/><text x="${r1(xx + cw / 2)}" y="${s.y + s.h / 2 + s.fs / 3}" text-anchor="middle" font-size="${Math.min(s.fs, cw / 7)}" font-weight="700" fill="${esc(s.color)}">${esc(step)}</text>${i < steps.length - 1 ? `<path d="M${xx + cw - 2} ${s.y + s.h / 2}h${gap + 2}" stroke="${esc(s.stroke)}" stroke-width="2"/>` : ''}`; }).join('') + lab(s.label, s.x + s.w / 2, s.y + s.h + s.fs + 3);
  } else if (s.rackMounted) {
    const rail=s.t==='firewall'?'#ef4444':s.t==='switch'||s.t==='l3switch'?'#38bdf8':s.t==='ups'?'#f59e0b':s.t==='nas'||s.t==='database'?'#a78bfa':'#4ade80';
    const name=esc(String(s.label||SHAPES[s.t]?.vi||s.t).slice(0,20));
    const mid=s.y+s.h/2, portStart=s.x+s.w-47, portY=s.y+Math.max(3,(s.h-7)/2), port=(i,color='#0f172a')=>`<rect x="${portStart+i*4.5}" y="${portY}" width="3.7" height="6" rx=".6" fill="${color}" stroke="#94a3b8" stroke-width=".45"/><circle cx="${portStart+i*4.5+1.8}" cy="${portY+7.3}" r=".8" fill="#4ade80"/>`;
    let face='';
    if(s.t==='switch'||s.t==='l3switch') face=Array.from({length:8},(_,i)=>port(i,'#0b1725')).join('')+`<path d="M${portStart} ${portY-2}h34" stroke="#38bdf8" stroke-width="1"/>`;
    else if(s.t==='firewall') face=`<rect x="${portStart-2}" y="${portY-2}" width="40" height="11" rx="2" fill="#7f1d1d" stroke="#f87171" stroke-width=".7"/>`+Array.from({length:6},(_,i)=>port(i,'#1f2937')).join('')+`<path d="M${s.x+10} ${s.y+3}h${s.w-20}" stroke="#ef4444" stroke-width="1.2"/>`;
    else if(s.t==='router') face=`<rect x="${portStart}" y="${portY}" width="7" height="6" rx="1" fill="#0f172a" stroke="#38bdf8" stroke-width=".7"/><rect x="${portStart+10}" y="${portY}" width="7" height="6" rx="1" fill="#0f172a" stroke="#f59e0b" stroke-width=".7"/><path d="M${portStart+23} ${mid}h18m-4-3 4 3-4 3" fill="none" stroke="#60a5fa" stroke-width="1.2"/>`;
    else if(s.t==='ups') face=`<rect x="${portStart+3}" y="${s.y+Math.max(2,(s.h-9)/2)}" width="25" height="9" rx="1.5" fill="#052e16" stroke="#86efac" stroke-width=".6"/><path d="M${portStart+8} ${mid}h4m-2-2v4m9-2h5" stroke="#4ade80" stroke-width="1"/><circle cx="${portStart+35}" cy="${mid}" r="2" fill="#f59e0b"/>`;
    else if(['nas','database','storage','objectStorage','blockStorage'].includes(s.t)) face=Array.from({length:4},(_,i)=>`<rect x="${portStart+i*9}" y="${s.y+Math.max(2,(s.h-9)/2)}" width="7" height="9" rx="1" fill="#111827" stroke="#a78bfa" stroke-width=".6"/><circle cx="${portStart+i*9+5.5}" cy="${mid+2}" r=".8" fill="#60a5fa"/>`).join('');
    else if(['server','webServer','mailServer','dnsServer','dhcpServer'].includes(s.t)) face=Array.from({length:4},(_,i)=>`<rect x="${portStart+i*8}" y="${s.y+Math.max(2,(s.h-8)/2)}" width="6" height="8" rx="1" fill="#0f172a" stroke="#94a3b8" stroke-width=".6"/><circle cx="${portStart+i*8+4.5}" cy="${mid+1}" r=".8" fill="#4ade80"/>`).join('')+`<path d="M${s.x+12} ${s.y+5}h${s.w*.28}m-${s.w*.28} 4h${s.w*.28}" stroke="#64748b" stroke-width="1"/>`;
    else face=`<path d="M${portStart} ${mid-3}h${s.x+s.w-12-portStart}m-${s.x+s.w-12-portStart} 3h${s.x+s.w-12-portStart}m-${s.x+s.w-12-portStart} 3h${s.x+s.w-12-portStart}" stroke="#64748b" stroke-width="1"/>`;
    body=`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="2" fill="#334155" stroke="#0f172a" stroke-width="1.2"/><rect x="${s.x+2}" y="${s.y+2}" width="5" height="${Math.max(4,s.h-4)}" rx="1" fill="${rail}"/><path d="M${s.x+10} ${s.y+2}h${s.w-20}v${Math.max(3,s.h-4)}h-${s.w-20}z" fill="#1e293b" stroke="#64748b" stroke-width=".55"/><text x="${s.x+13}" y="${mid+3}" font-size="${name.length>9?7:8}" font-family="sans-serif" font-weight="700" fill="#f8fafc">${name}</text>${face}<circle cx="${s.x+s.w-7}" cy="${mid}" r="1.7" fill="#4ade80"/>`;
  } else if (isDevice(s)) {
    const metaLine = [s.meta?.hostname, s.meta?.mgmtIp].filter(Boolean).join(' · ');
    body = icon(s) + labOut(s.label, s.x + s.w / 2, s.y + s.h + s.fs + 3) + labOut(s.sub, s.x + s.w / 2, s.y + s.h + s.fs * 2 + 7, 'middle', s.fs - 2, 400, '#5b6573') + (s.showMeta && metaLine ? labOut(metaLine, s.x + s.w / 2, s.y + s.h + s.fs * (s.sub ? 3 : 2) + (s.sub ? 10 : 6), 'middle', s.fs - 2, 400, '#5266a8') : '');
  } else if (isContainer(s)) {
    body = `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="12" fill="${esc(s.fill)}" fill-opacity="0.06" ${stroke}/>` + (s.t === 'swimlane' ? `<path d="M${s.x} ${s.y + s.h / 3}H${s.x + s.w}M${s.x} ${s.y + 2 * s.h / 3}H${s.x + s.w}" stroke="${esc(s.stroke)}" stroke-width="1" stroke-dasharray="6 4"/>` : '') + lab(s.label, s.x + 12, s.y + s.fs + 8, 'start', s.fs, 700, s.stroke);
  } else if (s.iconOnly || SHAPES[s.t]?.iconOnly) {
    body = icon(s) + labOut(s.label, s.x + s.w / 2, s.y + s.h + s.fs + 3);
  } else if (['triangle', 'hexagon', 'cylinder', 'star', 'lock', 'blockArrow'].includes(s.t)) {
    body = icon(s) + lab(s.label, s.x + s.w / 2, s.y + s.h / 2 + s.fs / 3, 'middle', s.fs, 600);
  } else if (s.t === 'text') {
    body = labOut(s.label, s.x + s.w / 2, s.y + s.h / 2 + s.fs / 3, 'middle', s.fs, 600);
  } else if (s.t === 'lifeline') {
    body=`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="32" rx="4" fill="${esc(s.fill)}" stroke="${esc(s.stroke)}"/><path d="M${s.x+s.w/2} ${s.y+32}V${s.y+s.h}" stroke="${esc(s.stroke)}" stroke-dasharray="6 4"/>`+lab(s.label,s.x+s.w/2,s.y+21,'middle',s.fs,600);
  } else if (s.t === 'activation') {
    body=`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${esc(s.fill)}" stroke="${esc(s.stroke)}"/>`;
  } else if (s.t === 'messageCall' || s.t === 'messageReturn') {
    const x1=s.x+(s.t==='messageReturn'?s.w:0),x2=s.x+(s.t==='messageReturn'?0:s.w),y=s.y+s.h/2; body=`<path d="M${x1} ${y}H${x2}m${x2-x1>0?-8:8} -5l${x2-x1>0?8:-8} 5l${x2-x1>0?-8:8} 5" fill="none" stroke="${esc(s.stroke)}" stroke-width="2"/>`+labOut(s.label,s.x+s.w/2,s.y-4,'middle',s.fs,500);
  } else if (s.t === 'umlClass') {
    body=`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${esc(s.fill)}" stroke="${esc(s.stroke)}"/><path d="M${s.x} ${s.y+32}H${s.x+s.w}M${s.x} ${s.y+70}H${s.x+s.w}" stroke="${esc(s.stroke)}"/>`+lab(s.label,s.x+s.w/2,s.y+21,'middle',s.fs,700)+lab(s.sub||'+ attribute',s.x+8,s.y+48,'start',s.fs-2,400)+lab('+ method()',s.x+8,s.y+88,'start',s.fs-2,400);
  } else {
    const shape = s.t === 'ellipse' || s.t === 'connector' ? `<ellipse cx="${s.x + s.w / 2}" cy="${s.y + s.h / 2}" rx="${s.w / 2}" ry="${s.h / 2}"` : s.t === 'decision' ? `<path d="M${s.x + s.w/2} ${s.y}L${s.x+s.w} ${s.y+s.h/2}L${s.x+s.w/2} ${s.y+s.h}L${s.x} ${s.y+s.h/2}Z"` : s.t === 'flowData' ? `<path d="M${s.x+16} ${s.y}H${s.x+s.w}L${s.x+s.w-16} ${s.y+s.h}H${s.x}Z"` : s.t === 'document' ? `<path d="M${s.x} ${s.y}H${s.x+s.w}V${s.y+s.h-8}Q${s.x+s.w*.75} ${s.y+s.h+4} ${s.x+s.w*.5} ${s.y+s.h-6}T${s.x} ${s.y+s.h-6}Z"` : s.t === 'terminator' ? `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.h/2}"` : s.t === 'note' ? `<path d="M${s.x} ${s.y}h${s.w - 14}l14 14v${s.h - 14}h-${s.w}z"` : s.t === 'callout' ? `<path d="M${s.x} ${s.y}h${s.w}v${s.h * .72}h-${s.w * .62}l-${s.w * .18} ${s.h * .28}v-${s.h * .28}h-${s.w * .2}z"` : `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.radius ?? (s.t === 'round' ? 14 : 2)}"`;
    const lines = String(s.label || '').split('\n').length;
    body = `${shape} fill="${esc(s.fill)}" ${stroke}/>` + (s.t === 'table' ? `<path d="M${s.x} ${s.y + s.h / 3}H${s.x + s.w}M${s.x} ${s.y + 2 * s.h / 3}H${s.x + s.w}M${s.x + s.w / 3} ${s.y}V${s.y + s.h}M${s.x + 2 * s.w / 3} ${s.y}V${s.y + s.h}" stroke="${esc(s.stroke)}"/>` : '') + lab(s.label, s.x + s.w / 2, s.y + s.h / 2 - ((lines - 1) * (s.fs + 3)) / 2 + s.fs / 3, 'middle', s.fs, 600);
  }
  return `<g data-id="${s.id}" class="dg-shape"${s.op != null && s.op < 1 ? ` opacity="${s.op}"` : ''}${s.shadow ? ' filter="url(#dg-shadow)"' : ''}>${body}</g>`;
}
/** SVG của 1 dây: đường, vùng bấm rộng, mũi tên, nhãn giữa, nhãn cổng 2 đầu. */
const tagSpotCache = new WeakMap();
/**
 * Vị trí mọi nhãn cổng của sơ đồ: cách đầu dây ~28px theo hướng đi của dây, lùi xa dần hoặc đứng cạnh dây nếu đè thiết bị
 * hay nhãn khác. Trả Map 'idDây|a' / 'idDây|b' → điểm. Tính một lần cho cả lượt vẽ.
 */
function portTagSpots(d) {
  if (tagSpotCache.has(d)) return tagSpotCache.get(d);
  const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const box = (x, y, w, h = 15) => ({ l: x - w / 2, r: x + w / 2, t: y - h / 2, b: y + h / 2 });
  const placed = d.shapes.filter((s) => !isContainer(s) && s.t !== 'note' && s.t !== 'text').map((s) => ({ l: s.x, r: s.x + s.w, t: s.y, b: s.y + s.h + 16 }));
  const paths = d.edges.map((e) => [e, edgePath(d, e)]).filter(([, p]) => p);
  for (const [e, p] of paths) if (e.label) placed.push(box(p.mid.x, p.mid.y, String(e.label).length * 6.4 + 8));
  const out = new Map();
  for (const [e, p] of paths) {
    for (const [end, text, from, far] of [['a', e.la, p.a, e.style === 'straight' ? p.b : p.mid], ['b', e.lb, p.b, e.style === 'straight' ? p.a : p.mid]]) {
      if (!text) continue;
      const w = String(text).length * 6.4 + 8, dx = far.x - from.x, dy = far.y - from.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const at = (s, side) => ({ x: from.x + ux * s - uy * side, y: from.y + uy * s + ux * side });
      const base = Math.min(28, len * 0.3), max = e.style === 'straight' ? len / 2 : len, side = Math.abs(ux) * 18 + Math.abs(uy) * (w / 2 + 5);
      let spot = null;
      for (const sd of [0, side, -side]) {
        for (let s = base; !spot && s <= max; s += 4) { const q = at(s, sd); if (!placed.some((b) => hit(box(q.x, q.y, w), b))) spot = q; }
        if (spot) break;
      }
      spot ||= at(base, 0);
      placed.push(box(spot.x, spot.y, w));
      out.set(`${e.id}|${end}`, spot);
    }
  }
  tagSpotCache.set(d, out);
  queueMicrotask(() => tagSpotCache.delete(d)); // sơ đồ có thể đổi sau lượt vẽ này
  return out;
}
export function edgeSvg(d, e, options = {}) {
  const p = edgePath(d, e);
  if (!p) return '';
  const cableDash = { wifi: '8 5', vpn: '10 3 2 3', console: '2 5' };
  const col = esc(options.color || e.color || (e.cable === 'fiber' ? '#e67e22' : '#4a6785'));
  let linePath = p.d;
  if (e.cable === 'serial' && !e.waypoints?.length) {
    const dx = p.b.x - p.a.x, dy = p.b.y - p.a.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, n = Math.max(4, Math.ceil(len / 12));
    linePath = `M${r1(p.a.x)} ${r1(p.a.y)}` + Array.from({ length: n - 1 }, (_, i) => { const t = (i + 1) / n, wiggle = (i % 2 ? -1 : 1) * 4; return `L${r1(p.a.x + dx * t + nx * wiggle)} ${r1(p.a.y + dy * t + ny * wiggle)}`; }).join('') + `L${r1(p.b.x)} ${r1(p.b.y)}`;
  }
  const arrow = (pt, ang, type) => {
    if (!ARROW_IDS.has(type) || type === 'none') return '';
    const deg=ang*180/Math.PI, line=`fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`, solid=`fill="${col}" stroke="${col}" stroke-width="1.4" stroke-linejoin="round"`, hollow=`fill="#fff" stroke="${col}" stroke-width="1.8" stroke-linejoin="round"`;
    let mark='';
    if(type==='classic') mark=`<path d="M0 0L-12-6L-8 0L-12 6Z" ${solid}/>`;
    else if(type==='block') mark=`<path d="M0 0L-12-7L-12 7Z" ${solid}/>`;
    else if(type==='open') mark=`<path d="M-11-7L0 0L-11 7" ${line}/>`;
    else if(type==='diamond') mark=`<path d="M0 0L-8-5L-16 0L-8 5Z" ${solid}/>`;
    else if(type==='openDiamond') mark=`<path d="M0 0L-8-5L-16 0L-8 5Z" ${hollow}/>`;
    else if(type==='oval') mark=`<ellipse cx="-5" cy="0" rx="4.5" ry="5.5" fill="#fff" stroke="${col}" stroke-width="1.8"/>`;
    else if(type==='bar') mark=`<path d="M0-7V7" ${line}/>`;
    else if(type==='doubleBar') mark=`<path d="M-4-7V7M0-7V7" ${line}/>`;
    else if(type==='crowFoot'||type==='ERmany') mark=`<path d="M0 0L-12-7M0 0L-12 0M0 0L-12 7" ${line}/>`;
    else if(type==='ERone') mark=`<path d="M0-7V7" ${line}/>`;
    else if(type==='ERzeroToOne') mark=`<circle cx="-6" cy="0" r="4" fill="#fff" stroke="${col}" stroke-width="1.8"/><path d="M0-7V7" ${line}/>`;
    else if(type==='ERoneToMany') mark=`<path d="M-5-7V7M0 0L-12-7M0 0L-12 0M0 0L-12 7" ${line}/>`;
    else if(type==='ERzeroToMany') mark=`<circle cx="-8" cy="0" r="4" fill="#fff" stroke="${col}" stroke-width="1.8"/><path d="M0 0L-12-7M0 0L-12 0M0 0L-12 7" ${line}/>`;
    return `<g transform="translate(${r1(pt.x)} ${r1(pt.y)}) rotate(${r1(deg)})" class="dg-arrow dg-arrow-${type}">${mark}</g>`;
  };
  const tag = (txt, x, y, bold) => { if (!txt) return ''; const w = String(txt).length * 6.4 + 8; return `<rect x="${r1(x - w / 2)}" y="${r1(y - 8)}" width="${r1(w)}" height="15" rx="3" fill="#ffffff" fill-opacity="0.92" stroke="${col}" stroke-width="0.6"/><text x="${r1(x)}" y="${r1(y + 3.5)}" text-anchor="middle" font-size="10.5" font-weight="${bold ? 700 : 400}" fill="#1f2933">${esc(txt)}</text>`; };
  const spots = portTagSpots(d), nearA = spots.get(e.id + '|a') || p.a, nearB = spots.get(e.id + '|b') || p.b;
  const dash = cableDash[e.cable] || DASH[e.dash];
  const waves = e.cable === 'wifi' ? `<path d="M${r1(p.mid.x - 10)} ${r1(p.mid.y - 7)}Q${r1(p.mid.x)} ${r1(p.mid.y - 16)} ${r1(p.mid.x + 10)} ${r1(p.mid.y - 7)}M${r1(p.mid.x - 6)} ${r1(p.mid.y - 3)}Q${r1(p.mid.x)} ${r1(p.mid.y - 8)} ${r1(p.mid.x + 6)} ${r1(p.mid.y - 3)}" fill="none" stroke="${col}" stroke-width="1.5"/>` : '';
  return `<g data-id="${e.id}" class="dg-edge"><path d="${p.d}" fill="none" stroke="transparent" stroke-width="14" class="dg-hit"/>` +
    `<path d="${linePath}" fill="none" stroke="${col}" stroke-width="${e.width}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>${waves}` +
    arrow(p.b,p.ang,edgeArrowType(e,'B')) + arrow(p.a,p.ang0,edgeArrowType(e,'A')) + tag(e.la, nearA.x, nearA.y) + tag(e.lb, nearB.x, nearB.y) + tag(e.label, p.mid.x, p.mid.y, true) + '</g>';
}
/** Khung bao toàn sơ đồ (kể cả chữ dưới thiết bị). */
export function bounds(d, pad = 30) {
  if (!d.shapes.length) return { x: 0, y: 0, w: 800, h: 500 };
  const boxes = d.shapes.map((s) => {
    const hasMeta = s.showMeta && (s.meta?.mgmtIp || s.meta?.hostname);
    const labelExtra = s.rackMounted ? 0 : s.t === 'pipeline' ? s.fs + 6
      : (s.iconOnly || SHAPES[s.t]?.iconOnly) ? s.fs + 3 : s.t === 'messageCall' || s.t === 'messageReturn' ? 0
        : isDevice(s) ? (s.label ? s.fs + 3 : 0) + (s.sub ? s.fs + 3 : 0) + (hasMeta ? s.fs + 3 : 0) : 0;
    const above = s.t === 'messageCall' || s.t === 'messageReturn' ? s.fs + 8 : 0;
    return { x0: s.x, y0: s.y - above, x1: s.x + s.w, y1: s.y + s.h + labelExtra };
  });
  const addPoint = (x, y, width = 0, height = 0) => boxes.push({ x0: x - width / 2, y0: y - height / 2, x1: x + width / 2, y1: y + height / 2 });
  for (const e of d.edges) {
    const p = edgePath(d, e); if (!p) continue;
    const labelWidth = Math.max(24, String(e.label || '').length * 7);
    addPoint(p.mid.x, p.mid.y, labelWidth, e.label ? 22 : 10);
    for (const pt of [p.a, p.b, ...(e.waypoints || [])]) addPoint(pt.x, pt.y, 10, 10);
    const coords = [...p.d.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)/g)].map((m) => +m[0]);
    for (let i = 0; i + 1 < coords.length; i += 2) addPoint(coords[i], coords[i + 1], 10, 10);
    for (const [pt, text] of [[p.a, e.la], [p.b, e.lb]]) if (text) addPoint(pt.x, pt.y, String(text).length * 7 + 14, 24);
  }
  const x0 = Math.min(...boxes.map((b) => b.x0)) - pad, y0 = Math.min(...boxes.map((b) => b.y0)) - pad;
  const x1 = Math.max(...boxes.map((b) => b.x1)) + pad, y1 = Math.max(...boxes.map((b) => b.y1)) + pad;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** File SVG hoàn chỉnh (vùng/khung vẽ dưới cùng, rồi dây, rồi hình khác) — dùng cho tải về và chuyển PNG. */
export function toSvg(d, o = {}) {
  const b = bounds(d);
  const zones = d.shapes.filter(isContainer), rest = d.shapes.filter((s) => !isContainer(s));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(b.w)}" height="${Math.ceil(b.h)}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" font-family="Segoe UI, Arial, sans-serif"><defs><filter id="dg-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".18"/></filter></defs>` +
    (o.background === false ? '' : `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#ffffff"/>`) +
    zones.map(shapeSvg).join('') + d.edges.map((e) => edgeSvg(d, e)).join('') + rest.map(shapeSvg).join('') + '</svg>';
}

// ---------------------------------------------------------------- nhập / xuất
export function exportJson(d) { return JSON.stringify({ format: FORMAT, version: 1, shapes: d.shapes, edges: d.edges, seq: d.seq }, null, 1); }
const xmlEsc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[m]));
const xmlUnesc = (s) => String(s ?? '').replace(/&(amp|lt|gt|quot|apos);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e]));
/** Plain, interoperable draw.io XML (no compressed diagram payload). */
export function exportDrawio(d) { return exportDrawioPages([{ name: 'Page-1', d }]); }
export function exportDrawioPages(pages) {
  return `<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net">${pages.map((p) => `<diagram name="${xmlEsc(p.name)}">${drawioModel(p.d)}</diagram>`).join('')}</mxfile>`;
}
function drawioModel(d) {
  const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
  for (const s of d.shapes) {
    const label = [s.label, s.sub].filter(Boolean).join('\n'), style = `rounded=${s.t === 'round' ? 1 : 0};shape=${s.t === 'ellipse' ? 'ellipse' : s.t === 'cloud' ? 'cloud' : 'rect'};fillColor=${s.fill};strokeColor=${s.stroke};strokeWidth=${s.sw ?? 2};fontColor=${s.color};fontSize=${s.fs};fontStyle=${(s.bold === false ? 0 : 1) | (s.italic ? 2 : 0)};dashed=${s.dash === 'solid' ? 0 : 1};opacity=${Math.round((s.op ?? 1) * 100)};shadow=${s.shadow ? 1 : 0};pjType=${s.t};pjData=${encodeURIComponent(JSON.stringify(s))};`;
    cells.push(`<mxCell id="${xmlEsc(s.id)}" value="${xmlEsc(label)}" style="${xmlEsc(style)}" vertex="1" parent="1"><mxGeometry x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" as="geometry"/></mxCell>`);
  }
  for (const e of d.edges) {
    const style = `edgeStyle=orthogonalEdgeStyle;rounded=0;strokeColor=${e.color || '#34495e'};strokeWidth=${e.width ?? 2};dashed=${e.dash === 'solid' ? 0 : 1};startArrow=${edgeArrowType(e,'A')};endArrow=${edgeArrowType(e,'B')};pjData=${encodeURIComponent(JSON.stringify(e))};pjCable=${e.cable || 'ethernet'};pjStyle=${e.style};pjDash=${e.dash};pjLa=${encodeURIComponent(e.la || '')};pjLb=${encodeURIComponent(e.lb || '')};pjSpeed=${encodeURIComponent(e.speed || '')};pjMode=${e.mode || ''};pjVlans=${encodeURIComponent(e.vlans || '')};`;
    const pts = (e.waypoints || []).map((p) => `<mxPoint x="${p.x}" y="${p.y}"/>`).join('');
    cells.push(`<mxCell id="${xmlEsc(e.id)}" value="${xmlEsc(e.label || '')}" style="${xmlEsc(style)}" edge="1" parent="1" source="${xmlEsc(e.a)}" target="${xmlEsc(e.b)}"><mxGeometry relative="1" as="geometry">${pts ? `<Array as="points">${pts}</Array>` : ''}</mxGeometry></mxCell>`);
  }
  return `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1"><root>${cells.join('')}</root></mxGraphModel>`;
}
/** Import plain mxGraph XML; unfamiliar cell styles become basic rectangles and edges. */
export function importDrawio(xml) {
  const text = String(xml || ''), d = emptyDiagram(), idMap = new Map(), cells = [];
  const attr = (source, key) => { const m = source.match(new RegExp(`\\b${key}=(?:"([^"]*)"|'([^']*)')`)); return m ? xmlUnesc(m[1] ?? m[2]) : ''; };
  for (const m of text.matchAll(/<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g)) cells.push({ a: m[1], body: m[2] || '' });
  for (const c of cells) {
    if (attr(c.a, 'vertex') !== '1') continue;
    const id = attr(c.a, 'id'), style = attr(c.a, 'style'), g = c.body.match(/<mxGeometry\b([^>]*)\/?/), geo = g?.[1] || '';
    const value = attr(c.a, 'value').replace(/<br\s*\/?\s*>/gi, '\n');
    const styleProp = (key) => { const m = style.match(new RegExp(`(?:^|;)${key}=([^;]*)`)); return m?.[1] || ''; };
    let t = styleProp('pjType');
    if (!SHAPES[t]) { const sh = styleProp('shape'); t = sh === 'ellipse' ? 'ellipse' : sh === 'cloud' ? 'cloud' : styleProp('rounded') === '1' ? 'round' : 'rect'; }
    let extras = {}; try { extras = JSON.parse(decodeURIComponent(styleProp('pjData'))); } catch { try { extras = JSON.parse(decodeURIComponent(styleProp('pjMeta'))); } catch { /* foreign draw.io cell */ } }
    const [label = '', sub = ''] = value.split('\n');
    const s = addShape(d, t, +(attr(geo, 'x') || 0), +(attr(geo, 'y') || 0), { label, sub, w: +(attr(geo, 'width') || SHAPES[t].w), h: +(attr(geo, 'height') || SHAPES[t].h), meta: extras.meta, ports: extras.ports });
    // addShape applies editor naming/grid defaults; imported geometry and labels must survive unchanged.
    const internalId = s.id, hasRoundTrip = !!(extras?.t && extras?.id);
    if (extras && typeof extras === 'object') Object.assign(s, extras);
    s.id = internalId; s.t = t; s.x = +(attr(geo, 'x') || 0); s.y = +(attr(geo, 'y') || 0); s.w = +(attr(geo, 'width') || extras.w || SHAPES[t].w); s.h = +(attr(geo, 'height') || extras.h || SHAPES[t].h); s.label = extras.label ?? label; s.sub = extras.sub ?? sub;
    const styleColor = (key, fallback) => styleProp(key) || fallback;
    s.fill = hasRoundTrip ? (extras.fill || s.fill) : styleColor('fillColor', s.fill || '#ffffff'); s.stroke = hasRoundTrip ? (extras.stroke || s.stroke) : styleColor('strokeColor', s.stroke || '#2563eb');
    if (!hasRoundTrip) {
      s.sw = +(styleProp('strokeWidth') || s.sw || 2); s.fs = +(styleProp('fontSize') || s.fs || 14);
      s.color = styleColor('fontColor', s.color || '#1f2937');
      s.bold = !!(+styleProp('fontStyle') & 1); s.italic = !!(+styleProp('fontStyle') & 2);
      s.dash = styleProp('dashed') === '1' ? 'dash' : 'solid'; s.op = styleProp('opacity') ? +styleProp('opacity') / 100 : 1;
      s.shadow = styleProp('shadow') === '1';
    }
    s.showMeta = !!extras.showMeta; idMap.set(id, s.id);
  }
  // Restore parent links from our private round-trip payload after every external id is mapped.
  for (const c of cells) {
    if (attr(c.a, 'vertex') !== '1') continue;
    const target = shapeOf(d, idMap.get(attr(c.a, 'id')));
    if (!target) continue;
    const style = attr(c.a, 'style'), m = style.match(/(?:^|;)pjData=([^;]*)/);
    if (m) { try { const source = JSON.parse(decodeURIComponent(m[1])); if (source.parent) target.parent = idMap.get(source.parent) || source.parent; } catch { /* external draw.io cell */ } }
    if (!target.parent) { const parent = attr(c.a, 'parent'); if (parent && parent !== '0' && parent !== '1') target.parent = idMap.get(parent) || parent; }
  }
  for (const c of cells) {
    if (attr(c.a, 'edge') !== '1') continue;
    const a = idMap.get(attr(c.a, 'source')), b = idMap.get(attr(c.a, 'target')); if (!a || !b) continue;
    const style = attr(c.a, 'style'), prop = (key) => { const m = style.match(new RegExp(`(?:^|;)${key}=([^;]*)`)); return m?.[1] || ''; };
    const decode = (x) => { try { return decodeURIComponent(x); } catch { return x; } };
    let saved = {}; try { saved = JSON.parse(decodeURIComponent(prop('pjData'))); } catch { /* foreign draw.io cell */ }
    const geom = c.body.match(/<mxGeometry\b([^>]*)>([\s\S]*?)<\/mxGeometry>/), pointArray = (geom?.[2] || '').match(/<Array\b[^>]*as=(?:"points"|'points')[^>]*>([\s\S]*?)<\/Array>/), points = [...(pointArray?.[1] || '').matchAll(/<mxPoint\b([^>]*)\/?\s*>/g)].map((m) => ({ x: +attr(m[1], 'x'), y: +attr(m[1], 'y') })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    const edge = addEdge(d, a, b, { label: xmlUnesc(attr(c.a, 'value')), style: ['straight','ortho','curve'].includes(prop('pjStyle')) ? prop('pjStyle') : 'ortho', dash: ['solid','dash','dot'].includes(prop('pjDash')) ? prop('pjDash') : 'solid', cable: prop('pjCable') || 'ethernet', la: decode(prop('pjLa')), lb: decode(prop('pjLb')), speed: decode(prop('pjSpeed')), mode: prop('pjMode'), vlans: decode(prop('pjVlans')), arrowAType: prop('startArrow') || 'none', arrowBType: prop('endArrow') || 'none' });
    if (edge) {
      const internalId = edge.id;
      if (saved && typeof saved === 'object') Object.assign(edge, saved);
      edge.id = internalId; edge.a = a; edge.b = b; edge.label = saved.label ?? xmlUnesc(attr(c.a, 'value'));
      if (!Object.hasOwn(saved, 'arrowAType') && Object.hasOwn(saved, 'arrowA')) edge.arrowAType = saved.arrowA ? 'classic' : 'none';
      if (!Object.hasOwn(saved, 'arrowBType') && Object.hasOwn(saved, 'arrowB')) edge.arrowBType = saved.arrowB ? 'classic' : 'none';
      edge.arrowA = edge.arrowAType !== 'none'; edge.arrowB = edge.arrowBType !== 'none';
      if (!edge.waypoints?.length && points.length) edge.waypoints = points;
      if (!edge.color) edge.color = prop('strokeColor') || '#34495e';
      if (!Number.isFinite(+edge.width)) edge.width = +(prop('strokeWidth') || 2);
      if (edge.arrowA === undefined) edge.arrowA = prop('startArrow') !== '' && prop('startArrow') !== 'none';
      if (edge.arrowB === undefined) edge.arrowB = prop('endArrow') !== '' && prop('endArrow') !== 'none';
    }
  }
  if (!d.shapes.length) throw new Error('Không tìm thấy hình mxGraph XML (file draw.io nén không được hỗ trợ).');
  return d;
}
/** Đọc mọi trang của file draw.io, dạng thường hoặc nén (base64 + raw-deflate, mặc định của diagrams.net). */
export async function importDrawioPages(text) {
  const source = String(text || ''), blocks = [...source.matchAll(/<diagram\b([^>]*)(?<!\/)>([\s\S]*?)<\/diagram>/gi)];
  if (!blocks.length) return [{ name: 'Page-1', d: importDrawio(source) }];
  const pages = [];
  for (const [, attrs, body] of blocks) {
    const payload = body.trim(), compressed = payload && /^[A-Za-z0-9+/=\s]+$/.test(payload);
    const xml = compressed ? await inflateDrawio(payload) : payload;
    // Trang trống của draw.io vẫn giữ để đúng thứ tự trang.
    pages.push({ name: xmlUnesc(attrs.match(/\bname=(?:"([^"]*)"|'([^']*)')/)?.slice(1).find((x) => x != null) ?? '') || `Page-${pages.length + 1}`, d: /<mxCell\b[^>]*\bvertex=/.test(xml) ? importDrawio(xml) : emptyDiagram() });
  }
  if (!pages.some((p) => p.d.shapes.length)) throw new Error('Không tìm thấy hình nào trong file draw.io.');
  return pages;
}
async function inflateDrawio(payload) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Trình duyệt này chưa hỗ trợ giải nén file draw.io.');
  try {
    const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return decodeURIComponent(new TextDecoder().decode(await new Response(stream).arrayBuffer()));
  } catch (err) { throw new Error(`Không giải nén được file draw.io: ${err.message}`); }
}
export async function importDrawioFile(text) { return (await importDrawioPages(text)).find((p) => p.d.shapes.length).d; }
/** Đọc JSON đã xuất; ném lỗi tiếng Việt nếu sai định dạng. Bỏ dây trỏ tới hình không tồn tại. */
// ID và các trường số được ghép thẳng vào SVG và ô nhập, nên file lạ không được đưa chữ vào đó (chống chạy script).
const SAFE_ID = /^[\w-]+$/;
const NUM_FIELDS = ['sw', 'fs', 'op', 'radius', 'rackUnits', 'rackU', 'rackStartU', 'rackBase', 'width'];
const cleanNums = (x) => { for (const k of NUM_FIELDS) { if (!(k in x)) continue; if (x[k] !== null && x[k] !== '' && Number.isFinite(+x[k])) x[k] = +x[k]; else delete x[k]; } };
export function importJson(text) {
  const o = typeof text === 'string' ? JSON.parse(text) : text;
  if (!o || o.format !== FORMAT || !Array.isArray(o.shapes) || !Array.isArray(o.edges)) throw new Error('File không phải sơ đồ Packet Journey');
  const shapes = o.shapes.filter((s) => s && Object.hasOwn(SHAPES, s.t) && typeof s.id === 'string' && SAFE_ID.test(s.id) && [s.x, s.y, s.w, s.h].every(Number.isFinite));
  const ids = new Set(shapes.map((s) => s.id));
  const edges = o.edges.filter((e) => e && SAFE_ID.test(e.id) && ids.has(e.a) && ids.has(e.b) && e.a !== e.b);
  for (const x of [...shapes, ...edges]) cleanNums(x);
  for (const s of shapes) s.fs ??= 12;
  for (const e of edges) e.width ??= 2;
  const maxSeq = Math.max(0, ...[...shapes, ...edges].map((x) => +String(x.id).slice(1) || 0));
  const diagram={ format: FORMAT, version: 1, shapes, edges, seq: Math.max(o.seq || 0, maxSeq) };
  for(const rack of shapes.filter(s=>s.t==='rack')){const usage=rackUsage(diagram,rack.id);rack.rackUsed=usage.used;rack.rackFree=usage.free;}
  return diagram;
}
// ---------------------------------------------------------------- mẫu
/** Đặt tên cổng cho dây vật lý giữa thiết bị mạng; dây luồng ứng dụng và Wi-Fi không có cổng, đầu mây Internet cũng vậy. */
function namePorts(d) {
  const net = (s) => SHAPES[s?.t]?.group === 'net';
  for (const e of d.edges) {
    const a = shapeOf(d, e.a), b = shapeOf(d, e.b);
    if (!net(a) || !net(b) || e.cable === 'wifi') continue;
    if (!e.la && a.t !== 'cloud') e.la = suggestPortName(d, a.id);
    if (!e.lb && b.t !== 'cloud') e.lb = suggestPortName(d, b.id);
  }
}
const T = (build) => () => { const d = emptyDiagram(); build(d); namePorts(d); return d; };
const link = (d, a, b, o) => addEdge(d, a.id, b.id, o);
// Mẫu dạng bảng: hình [khoá, loại, x, y, 'tên|dòng phụ' hoặc tuỳ chọn], dây [a, b, 'nhãn' hoặc tuỳ chọn]. Vùng khai báo trước để nằm dưới thiết bị.
const G = (group, id, vi, en, shapes, edges) => ({ id, group, vi, en, build: T((d) => {
  const m = {};
  for (const [k, t, x, y, o] of shapes) { const [label, sub] = String(o).split('|'); m[k] = addShape(d, t, x, y, typeof o === 'string' ? { label, sub } : o); }
  for (const [a, b, o] of edges) link(d, m[a], m[b], typeof o === 'string' ? { label: o } : o);
}) });
const FO = { cable: 'fiber' }, WIFI = { cable: 'wifi' }, VPN = { cable: 'vpn', dash: 'dash' };
const zone = (k, x, y, w, h, label, c = '#2f6fde') => [k, 'zone', x, y, { w, h, label, fill: c, stroke: c }];
const plan = (x, y, lines, w = 330) => ['plan', 'note', x, y, { label: lines.join('\n'), w, h: 24 + lines.length * 19 }];
const RED = '#d64545', GREEN = '#2e9e57', ORANGE = '#e67e22', PURPLE = '#7c3aed', GRAY = '#475569';
const GP = 'Hạ tầng vật lý', GW = 'Nhà mạng & WAN', GY = 'Hệ thống & dịch vụ';
const GC = 'CCNA', GE = 'Doanh nghiệp & văn phòng', GS = 'Bảo mật', GD = 'Data center & cloud', GA = 'Ứng dụng & DevOps';
export const TEMPLATES = [
  // Văn phòng khoảng 30 người: một firewall UTM, một switch PoE, Wi-Fi tách nhân viên và khách.
  G(GE, 'lan', 'LAN văn phòng', 'Office LAN', [
    plan(960, 270, ['VLAN 10 · Nhân viên · 192.168.10.0/24', 'VLAN 20 · Thoại · 192.168.20.0/24', 'VLAN 30 · Khách · 192.168.30.0/24', 'VLAN 99 · Quản trị · 192.168.99.0/24', 'Gateway: FW-UTM, địa chỉ .1 mỗi VLAN', 'DHCP do FW cấp; NAS và máy in đặt IP tĩnh', 'Khách chỉ ra Internet, không vào VLAN 10']),
    zone('z', 30, 270, 890, 270, 'VĂN PHÒNG · VLAN 10, 20, 30, 99'),
    ['net', 'cloud', 420, 0, 'INTERNET|FTTH, IP tĩnh'], ['fw', 'firewall', 430, 130, 'FW-UTM|NAT, VPN, lọc web'], ['sw', 'switch', 430, 305, 'SW-POE|24 cổng, cấp nguồn PoE'],
    ['ap', 'ap', 720, 305, 'AP-01|SSID nhân viên + khách'], ['m', 'mobile', 840, 440, 'Khách|VLAN 30'],
    ['pc', 'pc', 60, 440, 'PC-KT|VLAN 10'], ['lt', 'laptop', 200, 445, 'LT-KD|VLAN 10'], ['ph', 'phone', 340, 440, 'IP-Phone|Voice VLAN 20'], ['prn', 'printer', 480, 440, 'PRN|VLAN 10'], ['nas', 'nas', 620, 440, 'NAS|File chung, sao lưu'],
  ], [['net', 'fw', { ...FO, lb: 'WAN' }], ['fw', 'sw', { la: 'LAN', label: 'trunk' }], ['sw', 'ap'], ['ap', 'm', WIFI], ['sw', 'pc'], ['sw', 'lt'], ['sw', 'ph'], ['sw', 'prn'], ['sw', 'nas']]),
  // Campus phân cấp: biên Internet có firewall HA, core gộp cổng, distribution chạy HSRP, access nối hai đường lên.
  G(GE, 'campus', 'Campus 3 lớp', 'Three-tier campus', [
    plan(960, 140, ['VLAN 10 · Kế toán · 10.1.10.0/24', 'VLAN 20 · Thoại · 10.1.20.0/24', 'VLAN 30 · Wi-Fi · 10.1.30.0/23', 'VLAN 40 · Kinh doanh · 10.1.40.0/24', 'VLAN 99 · Quản trị · 10.1.99.0/24', 'Gateway: HSRP VIP .1 trên DSW1 và DSW2', 'STP root trùng với HSRP Active (DSW1)', 'Core ↔ Distribution: link Layer 3 /30, OSPF area 0', 'Access ↔ Distribution: trunk 802.1Q']),
    zone('ze', 40, 10, 860, 115, 'BIÊN INTERNET', GRAY), zone('zc', 40, 140, 860, 115, 'CORE', RED), zone('zd', 40, 270, 860, 115, 'DISTRIBUTION', ORANGE), zone('za', 40, 400, 860, 235, 'ACCESS', GREEN),
    ['net', 'cloud', 110, 30, 'INTERNET'], ['f1', 'firewall', 330, 35, 'FW1|Active'], ['f2', 'firewall', 560, 35, 'FW2|Standby'],
    ['c1', 'l3switch', 330, 165, 'CORE1'], ['c2', 'l3switch', 560, 165, 'CORE2'], ['wlc', 'wlc', 770, 165, 'WLC|Quản lý AP'],
    ['d1', 'l3switch', 220, 295, 'DSW1|HSRP Active, STP root'], ['d2', 'l3switch', 670, 295, 'DSW2|HSRP Standby'],
    ['a1', 'switch', 90, 425, 'ASW1'], ['a2', 'switch', 310, 425, 'ASW2'], ['a3', 'switch', 580, 425, 'ASW3'], ['a4', 'switch', 790, 425, 'ASW4'],
    ['h1', 'pc', 90, 545, 'PC-KT|VLAN 10'], ['h2', 'phone', 310, 545, 'IP-Phone|Voice VLAN 20'], ['h3', 'ap', 580, 545, 'AP-T3|VLAN 30'], ['h4', 'laptop', 790, 550, 'LT-KD|VLAN 40'],
  ], [['net', 'f1', FO], ['f1', 'f2', { label: 'HA', dash: 'dash' }], ['f1', 'c1'], ['f2', 'c2'],
    ['c1', 'c2', { label: 'Po1', width: 4 }], ['c2', 'wlc'], ['c1', 'd1', FO], ['c1', 'd2', FO], ['c2', 'd1', FO], ['c2', 'd2', FO], ['d1', 'd2', { label: 'Po2', width: 4 }],
    ['d1', 'a1'], ['d1', 'a2'], ['d2', 'a3'], ['d2', 'a4'], ['d2', 'a1', { dash: 'dash' }], ['d2', 'a2', { dash: 'dash' }], ['d1', 'a3', { dash: 'dash' }], ['d1', 'a4', { dash: 'dash' }],
    ['a1', 'h1'], ['a2', 'h2'], ['a3', 'h3'], ['a4', 'h4']]),
  // Trụ sở và chi nhánh: MPLS là đường chính, IPsec qua Internet là đường dự phòng.
  G(GE, 'wan', 'HQ – chi nhánh qua WAN', 'HQ – branch over WAN', [
    plan(960, 30, ['HQ · 10.1.0.0/16 · AS 65001', 'Chi nhánh · 10.2.0.0/16 · AS 65002', 'MPLS: eBGP với nhà mạng, đường chính', 'IPsec qua Internet: đường dự phòng,', 'đặt local-preference thấp hơn MPLS', 'IP SLA theo dõi đường chính để chuyển đường', 'Thoại và ERP ưu tiên đi MPLS (QoS)']),
    zone('z1', 20, 30, 340, 470, 'HQ · 10.1.0.0/16'), zone('z2', 620, 30, 310, 470, 'CHI NHÁNH · 10.2.0.0/16', GREEN),
    ['srv', 'server', 50, 80, 'SRV-AD|DNS, DHCP, File'], ['core', 'l3switch', 50, 240, 'SW-CORE|Gateway các VLAN'], ['pc', 'pc', 50, 400, 'PC-HQ'],
    ['fw', 'firewall', 240, 140, 'FW-HQ|NAT, IPsec'], ['r', 'router', 240, 340, 'R-HQ|BGP với nhà mạng'],
    ['net', 'cloud', 430, 120, 'INTERNET|IPsec dự phòng'], ['mpls', 'mplsCloud', 430, 320, 'MPLS L3VPN|Đường chính'],
    ['rb', 'router', 650, 240, 'R-CN|Hai đường WAN'], ['sw', 'switch', 810, 240, 'SW-CN'], ['pb', 'pc', 810, 90, 'PC-CN'], ['ap', 'ap', 810, 400, 'AP-CN'], ['ph', 'phone', 650, 400, 'IP-Phone-CN'],
  ], [['srv', 'core'], ['pc', 'core'], ['core', 'fw'], ['core', 'r'], ['fw', 'net', { ...VPN, label: 'IPsec', color: RED }], ['net', 'rb', { ...VPN, color: RED }],
    ['r', 'mpls', { ...FO, label: 'Chính' }], ['mpls', 'rb', FO], ['rb', 'sw', { label: 'trunk' }], ['sw', 'pb'], ['sw', 'ap'], ['sw', 'ph']]),
];
TEMPLATES.push(
  { id: 'ccna-vlan', group: 'CCNA', vi: 'CCNA · VLAN segmentation', en: 'CCNA · VLAN segmentation', build: T((d) => {
    const core = addShape(d, 'l3switch', 330, 80, { label: 'SW-CORE', sub: 'SVI: VLAN 10 / 20 / 30' });
    [0,1,2].forEach((i) => { const sw = addShape(d, 'switch', 120 + i * 220, 260, { label: `SW-ACC${i+1}` }), pc = addShape(d, 'pc', 120 + i * 220, 400, { label: `PC-VLAN${(i+1)*10}` }); link(d, core, sw, { mode: 'trunk', vlans: '10,20,30', label: 'trunk' }); link(d, sw, pc, { mode: 'access', vlans: String((i+1)*10), label: `access VLAN ${(i+1)*10}` }); });
  }) },
  { id: 'ccna-roas', group: 'CCNA', vi: 'CCNA · Inter-VLAN routing (ROAS)', en: 'CCNA · Inter-VLAN routing (ROAS)', build: T((d) => {
    const r = addShape(d, 'router', 330, 40, { label: 'R1', sub: 'G0/0.10 · .20' }), sw = addShape(d, 'switch', 330, 220, { label: 'SW1', sub: 'Trunk 802.1Q' });
    link(d, r, sw, { mode: 'trunk', vlans: '10,20', la: 'G0/0', lb: 'G0/1', label: '802.1Q trunk' });
    for (let i = 0; i < 2; i++) { const pc = addShape(d, 'pc', 150 + i * 360, 390, { label: `PC VLAN ${(i+1)*10}` }); link(d, sw, pc, { mode: 'access', vlans: String((i+1)*10), label: `VLAN ${(i+1)*10}` }); }
  }) },
  { id: 'ccna-ospf', group: 'CCNA', vi: 'CCNA · OSPF đa vùng', en: 'CCNA · Multi-area OSPF', build: T((d) => {
    const r = [addShape(d,'router',340,180,{label:'R1 · ABR',sub:'Area 0'}),addShape(d,'router',120,50,{label:'R2',sub:'Area 0'}),addShape(d,'router',120,330,{label:'R3',sub:'Area 1'}),addShape(d,'router',580,330,{label:'R4',sub:'Area 2'})];
    link(d,r[0],r[1],{cable:'serial',label:'Area 0'}); link(d,r[0],r[2],{cable:'serial',label:'Area 1'}); link(d,r[0],r[3],{cable:'serial',label:'Area 2'});
  }) },
  { id: 'ccna-stp', group: 'CCNA', vi: 'CCNA · STP root election', en: 'CCNA · STP root election', build: T((d) => {
    const s=[addShape(d,'switch',320,60,{label:'SW1 · ROOT',sub:'Priority 4096'}),addShape(d,'switch',100,320,{label:'SW2'}),addShape(d,'switch',540,320,{label:'SW3'})];
    link(d,s[0],s[1],{label:'Forwarding'}); link(d,s[0],s[2],{label:'Forwarding'}); link(d,s[1],s[2],{dash:'dash',label:'Blocked'});
    link(d,s[1],addShape(d,'pc',80,440,{label:'Host'}));
  }) },
  { id: 'ccna-etherchannel', group: 'CCNA', vi: 'CCNA · EtherChannel', en: 'CCNA · EtherChannel', build: T((d) => {
    const a=addShape(d,'switch',130,170,{label:'SW1'}), b=addShape(d,'switch',530,170,{label:'SW2'});
    link(d,a,b,{label:'Po1 · gộp 4 cổng',width:4});
    link(d,a,addShape(d,'server',100,360)); link(d,b,addShape(d,'server',560,360));
  }) },
  { id: 'ccna-hsrp', group: 'CCNA', vi: 'CCNA · HSRP failover', en: 'CCNA · HSRP failover', build: T((d) => {
    const a=addShape(d,'router',150,80,{label:'R1 · Active',sub:'Priority 110'}), b=addShape(d,'router',500,80,{label:'R2 · Standby'}), sw=addShape(d,'switch',330,250,{label:'SW-ACCESS'});
    link(d,a,b,{label:'HSRP · VIP 10.1.1.1'}); link(d,a,sw); link(d,b,sw); link(d,sw,addShape(d,'pc',330,390,{label:'Default GW: VIP'}));
  }) },
  { id: 'ccna-nat', group: 'CCNA', vi: 'CCNA · NAT ra Internet', en: 'CCNA · NAT to Internet', build: T((d) => {
    const pc=addShape(d,'pc',70,210,{label:'LAN · 10.0.0.10'}), sw=addShape(d,'switch',250,210), r=addShape(d,'router',440,210,{label:'R1 · NAT/PAT'}), fw=addShape(d,'firewall',620,210), net=addShape(d,'cloud',800,190,{label:'INTERNET'});
    link(d,pc,sw); link(d,sw,r,{la:'Fa0/1',lb:'G0/0'}); link(d,r,fw,{label:'Inside → Outside'}); link(d,fw,net,{cable:'fiber',label:'Public IP'});
  }) },
  G(GA, 'web-three-tier', 'Web · 3 tầng', 'Web · Three tier', [
    zone('zw', 410, 30, 150, 440, 'Tầng web'), zone('za', 580, 30, 150, 440, 'Tầng ứng dụng', ORANGE), zone('zd', 750, 30, 180, 440, 'Tầng dữ liệu', GREEN),
    ['u', 'browser', 20, 220, 'Người dùng'], ['fw', 'firewall', 150, 220, 'FW|Chỉ mở 443'], ['lb', 'loadBalancer', 280, 220, 'LB|HTTPS, kiểm tra sức khoẻ'],
    ['w1', 'webServer', 450, 110, 'WEB-1'], ['w2', 'webServer', 450, 330, 'WEB-2'], ['a1', 'backend', 620, 110, 'APP-1'], ['a2', 'backend', 620, 330, 'APP-2'],
    ['db', 'sqlDatabase', 805, 110, 'DB chính|Đọc và ghi'], ['rp', 'sqlDatabase', 805, 330, 'DB bản sao|Chỉ đọc'],
  ], [['u', 'fw'], ['fw', 'lb'], ['lb', 'w1'], ['lb', 'w2'], ['w1', 'a1'], ['w2', 'a2'], ['a1', 'db'], ['a2', 'db'], ['a2', 'rp', { dash: 'dash', label: 'Đọc' }], ['db', 'rp', { dash: 'dot', label: 'Sao chép' }]]),
  G(GD, 'dc-spine-leaf', 'Data center · Spine–leaf', 'Data center · Spine–leaf', [
    ['s1', 'l3switch', 250, 30, 'SPINE-1'], ['s2', 'l3switch', 500, 30, 'SPINE-2'],
    ['l1', 'switch', 60, 210, 'LEAF-1'], ['l2', 'switch', 250, 210, 'LEAF-2'], ['l3', 'switch', 440, 210, 'LEAF-3'], ['bl', 'switch', 660, 210, 'BORDER-LEAF|Cửa ra ngoài fabric'],
    ['h1', 'server', 60, 390, 'HOST-1'], ['h2', 'server', 345, 390, 'HOST-2|Hai card, hai leaf'], ['fw', 'firewall', 660, 390, 'FW|Lưu lượng vào ra'], ['net', 'cloud', 800, 380, 'WAN / INTERNET'],
  ], [['s1', 'l1', FO], ['s1', 'l2', FO], ['s1', 'l3', FO], ['s1', 'bl', FO], ['s2', 'l1', FO], ['s2', 'l2', FO], ['s2', 'l3', FO], ['s2', 'bl', FO],
    ['l1', 'h1'], ['l2', 'h2'], ['l3', 'h2'], ['bl', 'fw'], ['fw', 'net', FO]]),
  G(GE, 'sdwan', 'SD-WAN · nhiều chi nhánh', 'SD-WAN · Branches', [
    plan(960, 130, ['Hai loại đường: mpls và biz-internet (4G dự phòng)', 'Mỗi edge dựng tunnel IPsec tới mọi edge khác', 'Controller đẩy chính sách, không chuyển dữ liệu', 'Thoại, ERP: đi MPLS; đổi đường khi trễ > 150 ms', 'Web, cập nhật: đi thẳng Internet tại chi nhánh', 'HQ 10.0.0.0/16 · CN1 10.1.0.0/24', 'CN2 10.2.0.0/24 · CN3 10.3.0.0/24']),
    zone('z', 20, 150, 250, 350, 'TRỤ SỞ / DC'),
    ['ctl', 'cloud', 560, 5, 'CONTROLLER|Quản lý, chính sách'],
    ['e1', 'sdwanEdge', 180, 200, 'EDGE-HQ1'], ['e2', 'sdwanEdge', 180, 390, 'EDGE-HQ2'], ['core', 'l3switch', 45, 290, 'SW-CORE'],
    ['mpls', 'mplsCloud', 370, 180, 'MPLS|Đường chất lượng cao'], ['inet', 'cloud', 450, 370, 'INTERNET|Băng rộng, 4G'],
    ['b1', 'sdwanEdge', 660, 130, 'EDGE-CN1'], ['b2', 'sdwanEdge', 660, 275, 'EDGE-CN2'], ['b3', 'sdwanEdge', 660, 420, 'EDGE-CN3|Chỉ Internet + 4G'],
    ['s1', 'switch', 820, 130, 'SW-CN1'], ['s2', 'switch', 820, 275, 'SW-CN2'], ['s3', 'switch', 820, 420, 'SW-CN3'],
  ], [['core', 'e1'], ['core', 'e2'], ['e1', 'mpls', FO], ['e2', 'inet', VPN],
    ['mpls', 'b1', FO], ['mpls', 'b2', FO], ['inet', 'b1', VPN], ['inet', 'b2', VPN], ['inet', 'b3', VPN],
    ['b1', 's1'], ['b2', 's2'], ['b3', 's3'], ['ctl', 'inet', { dash: 'dot', label: 'Kênh điều khiển' }]]),
  { id: 'cicd', group: 'Ứng dụng & DevOps', vi: 'CI/CD · build đến deploy', en: 'CI/CD · Build to deploy', build: T((d) => {
    const git=addShape(d,'gitRepo',50,180), runner=addShape(d,'runner',170,180), pipe=addShape(d,'pipeline',300,170,{w:440}), env=addShape(d,'cluster',780,130,{label:'Runtime'});
    link(d,git,runner); link(d,runner,pipe); link(d,pipe,env); link(d,pipe,addShape(d,'artifact',500,300));
  }) },
  G(GA, 'kubernetes', 'Kubernetes · cụm ứng dụng', 'Kubernetes · app cluster', [
    ['c', 'clusterBoundary', 150, 20, { w: 780, h: 470, label: 'Cluster' }],
    ['u', 'user', 20, 220, 'Người dùng'], ['ing', 'ingress', 200, 220, 'INGRESS|TLS, định tuyến theo tên miền'], ['svc', 'service', 380, 220, 'SERVICE|ClusterIP'], ['dep', 'deployment', 380, 70, 'DEPLOYMENT|3 bản sao'],
    ['p1', 'pod', 560, 70, 'POD-1'], ['p2', 'pod', 560, 220, 'POD-2'], ['p3', 'pod', 560, 370, 'POD-3'],
    ['n1', 'node', 780, 70, 'NODE-1'], ['n2', 'node', 780, 220, 'NODE-2'], ['v', 'volume', 780, 370, 'PVC|Dữ liệu bền vững'],
  ], [['u', 'ing'], ['ing', 'svc'], ['svc', 'p1'], ['svc', 'p2'], ['svc', 'p3'], ['dep', 'p1', { dash: 'dot', label: 'quản lý' }],
    ['p1', 'n1', { dash: 'dot', label: 'chạy trên' }], ['p2', 'n2', { dash: 'dot' }], ['p3', 'n2', { dash: 'dot' }], ['p3', 'v']]),
  G(GD, 'dr-site', 'Site dự phòng · DR', 'Disaster recovery site', [
    ['pri', 'datacenter', 30, 250, { w: 360, h: 280, label: 'DC chính · đang chạy' }], ['dr', 'datacenter', 560, 250, { w: 360, h: 280, label: 'Site DR · chờ sẵn' }],
    ['u', 'user', 440, 0, 'Người dùng'], ['dns', 'dnsServer', 440, 110, 'GSLB / DNS|Chuyển hướng khi sự cố'],
    ['a', 'serverCluster', 80, 310, 'APP-Chính'], ['d1', 'database', 270, 310, 'DB-Chính'], ['k1', 'backupServer', 175, 435, 'BACKUP-Chính'],
    ['b', 'serverCluster', 800, 310, 'APP-DR'], ['d2', 'database', 610, 310, 'DB-DR'], ['k2', 'backupServer', 705, 435, 'BACKUP-DR'],
  ], [['u', 'dns'], ['dns', 'a', 'Bình thường'], ['dns', 'b', { dash: 'dash', label: 'Khi chuyển site' }], ['a', 'd1'], ['b', 'd2'],
    ['d1', 'd2', { ...FO, label: 'Sao chép liên tục' }], ['d1', 'k1'], ['k1', 'k2', { dash: 'dash', label: 'Bản sao lưu ngoài site' }]]),
  { id: 'home-network', group: 'Doanh nghiệp & văn phòng', vi: 'Mạng gia đình / SOHO', en: 'Home / SOHO network', build: T((d) => {
    const net=addShape(d,'cloud',40,160,{label:'ISP'}), modem=addShape(d,'modem',210,160), wifi=addShape(d,'homeRouter',380,160), pc=addShape(d,'laptop',580,70), phone=addShape(d,'mobile',580,250), cam=addShape(d,'camera',740,160);
    link(d,net,modem);link(d,modem,wifi);link(d,wifi,pc,{cable:'wifi'});link(d,wifi,phone,{cable:'wifi'});link(d,wifi,cam,{cable:'wifi'});
  }) },
);
TEMPLATES.push(
  G(GC, 'ccna-static', 'CCNA · Static route & floating', 'CCNA · Static & floating route', [
    ['a', 'pc', 40, 200, 'PC-A|10.1.1.10'], ['r1', 'router', 200, 200, 'R1|Default route'], ['r2', 'router', 470, 70, 'R2|Đường chính'], ['r3', 'router', 470, 340, 'R3|Đường dự phòng'], ['r4', 'router', 740, 200, 'R4'], ['s', 'server', 900, 190, 'SRV|10.2.2.10'],
  ], [['a', 'r1'], ['r1', 'r2', { cable: 'serial', label: 'AD 1' }], ['r1', 'r3', { dash: 'dash', label: 'Floating AD 200' }], ['r2', 'r4'], ['r3', 'r4'], ['r4', 's']]),
  G(GC, 'ccna-acl', 'CCNA · Vị trí đặt ACL', 'CCNA · ACL placement', [
    ['hr', 'pc', 60, 90, 'PC-HR|10.1.10.10'], ['it', 'pc', 60, 330, 'PC-IT|10.1.20.10'], ['sa', 'switch', 220, 210, 'SW-ACC'], ['r', 'router', 450, 210, 'R1'], ['sd', 'switch', 680, 210, 'SW-SRV'], ['web', 'webServer', 860, 90, 'WEB|10.9.0.10'], ['db', 'database', 860, 330, 'DB|10.9.0.20'],
  ], [['hr', 'sa'], ['it', 'sa'], ['sa', 'r', 'Extended · gần nguồn'], ['r', 'sd', 'Standard · gần đích'], ['sd', 'web'], ['sd', 'db']]),
  G(GC, 'ccna-dhcp-relay', 'CCNA · DHCP relay', 'CCNA · DHCP relay', [
    ['p1', 'pc', 90, 340, 'PC-VLAN10|DHCP client'], ['p2', 'pc', 310, 340, 'PC-VLAN20|DHCP client'], ['sw', 'switch', 200, 200, 'SW-ACC'], ['l3', 'l3switch', 430, 70, 'SW-CORE|ip helper-address'], ['d', 'dhcpServer', 720, 70, 'DHCP|10.99.0.5'],
  ], [['p1', 'sw', { mode: 'access', vlans: '10', label: 'VLAN 10' }], ['p2', 'sw', { mode: 'access', vlans: '20', label: 'VLAN 20' }], ['sw', 'l3', { mode: 'trunk', vlans: '10,20', label: 'trunk' }], ['l3', 'd', 'Unicast tới server']]),
  G(GC, 'ccna-dns', 'CCNA · DNS phân giải tên', 'CCNA · DNS resolution', [
    ['c', 'pc', 50, 210, 'CLIENT|Hỏi www.vd.vn'], ['r', 'dnsServer', 270, 90, 'DNS nội bộ|Resolver'], ['gw', 'router', 270, 330, 'GW'], ['net', 'cloud', 470, 200, 'INTERNET'], ['a', 'dnsServer', 720, 80, 'DNS vd.vn|Bản ghi A, MX'], ['w', 'webServer', 720, 330, 'www.vd.vn|203.0.113.10'],
  ], [['c', 'r', '1. Hỏi tên'], ['r', 'net', '2. Tra tiếp'], ['net', 'a', '3. Bản ghi A'], ['c', 'gw', '4. Kết nối theo IP'], ['gw', 'net'], ['net', 'w']]),
  G(GC, 'ccna-ipv6', 'CCNA · IPv6 dual-stack', 'CCNA · IPv6 dual stack', [
    ['p1', 'pc', 40, 200, 'PC1|2001:db8:1::10'], ['r1', 'router', 240, 200, 'R1|Dual-stack'], ['r2', 'router', 540, 200, 'R2|Dual-stack'], ['p2', 'server', 760, 190, 'SRV|2001:db8:2::10'], ['n', 'note', 240, 340, { label: 'SLAAC: tiền tố /64 từ RA\nOSPFv3 chạy trên link-local', w: 340, h: 70 }],
  ], [['p1', 'r1', 'SLAAC'], ['r1', 'r2', '2001:db8:12::/64 · OSPFv3'], ['r2', 'p2']]),
  G(GC, 'ccna-wifi', 'CCNA · Wi-Fi với WLC', 'CCNA · Wi-Fi with WLC', [
    ['core', 'l3switch', 400, 90, 'SW-CORE'], ['wlc', 'wlc', 120, 90, 'WLC|Native VLAN 99'], ['rad', 'server', 720, 80, 'RADIUS|VLAN 40'], ['a1', 'ap', 230, 260, 'AP-1|Kênh 1'], ['a2', 'ap', 590, 260, 'AP-2|Kênh 6'], ['l', 'laptop', 130, 400, 'NV-Laptop|802.1X'], ['m', 'mobile', 340, 400, 'NV-Mobile|WPA2-PSK'], ['g', 'tablet', 590, 400, 'Khách|VLAN 30'],
  ], [['core', 'wlc', { mode: 'trunk', vlans: '20,30,99', label: 'trunk' }], ['core', 'rad', 'UDP 1812'], ['core', 'a1', { mode: 'access', vlans: '10', label: 'access VLAN 10' }], ['core', 'a2', { mode: 'access', vlans: '10', label: 'access VLAN 10' }], ['a1', 'l', WIFI], ['a1', 'm', WIFI], ['a2', 'g', WIFI]]),
  G(GC, 'ccna-voice', 'CCNA · Voice VLAN & PoE', 'CCNA · Voice VLAN & PoE', [
    ['pbx', 'ipPbx', 100, 70, 'PBX|VLAN 150'], ['core', 'l3switch', 360, 70, 'SW-CORE'], ['sw', 'switch', 360, 220, 'SW-POE|Có cấp nguồn PoE'], ['ph', 'phone', 240, 360, 'IP-Phone|Voice VLAN 150'], ['pc', 'pc', 30, 360, 'PC|Data VLAN 10'], ['ap', 'ap', 540, 360, 'AP|PoE'], ['cam', 'camera', 720, 360, 'CAM|PoE · VLAN 60'],
  ], [['pbx', 'core'], ['core', 'sw', { mode: 'trunk', label: 'trunk' }], ['sw', 'ph', 'Tag 150 + untag 10'], ['ph', 'pc', 'Nối qua phone'], ['sw', 'ap'], ['sw', 'cam']]),
  G(GC, 'ccna-vpn', 'CCNA · VPN IPsec site-to-site', 'CCNA · Site-to-site IPsec VPN', [
    zone('z1', 30, 90, 300, 240, 'HQ · 10.1.0.0/16'), zone('z2', 620, 90, 300, 240, 'Chi nhánh · 10.2.0.0/16', GREEN),
    ['p1', 'pc', 60, 170, 'PC-HQ'], ['r1', 'router', 230, 170, 'R-HQ|Peer 203.0.113.1'], ['net', 'cloud', 420, 160, 'INTERNET'], ['r2', 'router', 660, 170, 'R-CN|Peer 198.51.100.1'], ['p2', 'pc', 830, 170, 'PC-CN'],
  ], [['p1', 'r1'], ['r1', 'net', { ...VPN, label: 'IPsec' }], ['net', 'r2', { ...VPN, label: 'ESP tunnel' }], ['r2', 'p2']]),
  G(GC, 'ccna-l2sec', 'CCNA · DHCP snooping, DAI', 'CCNA · DHCP snooping, DAI', [
    ['core', 'l3switch', 380, 60, 'SW-CORE'], ['d', 'dhcpServer', 680, 60, 'DHCP|Server hợp lệ'], ['sw', 'switch', 380, 220, 'SW-ACC|Snooping + DAI'], ['p1', 'pc', 170, 390, 'PC1|Vào bảng binding'], ['p2', 'pc', 590, 390, 'PC2|Vào bảng binding'], ['bad', 'laptop', 680, 220, 'Kẻ tấn công|DHCP và ARP giả'],
  ], [['core', 'd'], ['core', 'sw', { mode: 'trunk', label: 'trusted' }], ['sw', 'p1', 'untrusted'], ['sw', 'p2', 'untrusted'], ['sw', 'bad', { label: 'untrusted · bị chặn', color: RED, dash: 'dash' }]]),
  G(GC, 'ccna-mgmt', 'CCNA · Mạng quản trị', 'CCNA · Management network', [
    zone('z', 300, 20, 620, 480, 'VLAN quản trị · 10.99.0.0/24 (tách khỏi mạng người dùng)', GRAY),
    ['r', 'router', 60, 60, 'R1'], ['s1', 'l3switch', 60, 225, 'SW-CORE'], ['s2', 'switch', 60, 390, 'SW-ACC'], ['m', 'switch', 580, 225, 'SW-MGMT|Cổng quản trị riêng'],
    ['j', 'bastion', 390, 70, 'JUMP|SSH vào thiết bị'], ['n', 'monitor', 580, 70, 'NMS|SNMPv3'], ['l', 'logging', 770, 70, 'SYSLOG|UDP 514'], ['t', 'server', 390, 380, 'NTP|UDP 123'], ['a', 'server', 580, 380, 'TACACS+|TCP 49'], ['f', 'backupServer', 770, 380, 'TFTP/SCP|Sao lưu cấu hình'],
  ], [['r', 's1'], ['s1', 's2'], ['r', 'm'], ['s1', 'm'], ['s2', 'm'], ['m', 'j'], ['m', 'n'], ['m', 'l'], ['m', 't'], ['m', 'a'], ['m', 'f']]),
  G(GE, 'ent-small', 'Công ty nhỏ · một văn phòng', 'Small office', [
    plan(960, 60, ['VLAN 10 · Nhân viên · 192.168.10.0/24', 'VLAN 20 · Máy chủ, NAS · 192.168.20.0/24', 'VLAN 30 · Wi-Fi khách · 192.168.30.0/24', 'FW làm gateway, DHCP và NAT', 'NAS sao lưu ra cloud mỗi đêm']),
    ['net', 'cloud', 40, 60, 'INTERNET'], ['fw', 'firewall', 240, 70, 'FW|NAT, lọc truy cập'], ['sw', 'switch', 430, 70, 'SW1|VLAN 10, 20, 30'], ['ap', 'ap', 680, 70, 'AP|Nhân viên + khách'], ['pc', 'pc', 180, 280, 'PC-KT'], ['lt', 'laptop', 330, 290, 'LT-KD'], ['prn', 'printer', 480, 280, 'PRN'], ['nas', 'nas', 620, 280, 'NAS|Dữ liệu chung'], ['m', 'mobile', 800, 280, 'Mobile'],
  ], [['net', 'fw', FO], ['fw', 'sw', 'trunk'], ['sw', 'ap'], ['sw', 'pc'], ['sw', 'lt'], ['sw', 'prn'], ['sw', 'nas'], ['ap', 'm', WIFI]]),
  G(GE, 'ent-dual-isp', 'Hai đường Internet · dự phòng', 'Dual ISP edge', [
    plan(960, 150, ['Dải IP công khai riêng /24, AS riêng', 'eBGP với cả hai ISP, quảng bá cùng dải IP', 'Ra: ưu tiên ISP-A bằng local-preference', 'Vào: kéo dài AS-path trên ISP-B', 'FW chạy Active/Standby, đồng bộ phiên', 'Mất một ISP hoặc một thiết bị: không gián đoạn']),
    ['i1', 'isp', 220, 20, 'ISP-A'], ['i2', 'isp', 620, 20, 'ISP-B'], ['r1', 'router', 220, 150, 'R-EDGE1|eBGP với ISP-A'], ['r2', 'router', 620, 150, 'R-EDGE2|eBGP với ISP-B'],
    ['f1', 'firewall', 220, 290, 'FW1|Active'], ['f2', 'firewall', 620, 290, 'FW2|Standby'], ['c1', 'l3switch', 220, 430, 'CORE1'], ['c2', 'l3switch', 620, 430, 'CORE2'],
  ], [['i1', 'r1', FO], ['i2', 'r2', FO], ['r1', 'r2', 'iBGP'], ['r1', 'f1'], ['r2', 'f2'], ['r1', 'f2', { dash: 'dash' }], ['r2', 'f1', { dash: 'dash' }],
    ['f1', 'f2', { label: 'HA sync', dash: 'dash' }], ['f1', 'c1'], ['f2', 'c2'], ['c1', 'c2', { label: 'Stack', width: 4 }]]),
  G(GE, 'ent-hub-spoke', 'Trụ sở & chi nhánh · MPLS + VPN', 'HQ and branches · MPLS + VPN', [
    plan(960, 60, ['HQ · 10.0.0.0/16', 'CN1 10.1.0.0/24 · CN2 10.2.0.0/24 · CN3 10.3.0.0/24', 'MPLS L3VPN: BGP với nhà mạng', 'DMVPN: tunnel 172.16.0.0/24, NHRP, IPsec', 'Chi nhánh nói chuyện với nhau qua tunnel trực tiếp', 'Đường dự phòng có metric cao hơn MPLS']),
    zone('z', 20, 60, 290, 400, 'TRỤ SỞ'),
    ['srv', 'server', 50, 110, 'SRV|ERP, File, AD'], ['core', 'l3switch', 50, 300, 'SW-CORE'], ['r', 'router', 200, 205, 'R-HQ|Hub'],
    ['m', 'mplsCloud', 410, 90, 'MPLS|Đường chính'], ['n', 'cloud', 410, 350, 'INTERNET|DMVPN dự phòng'],
    ['b1', 'router', 670, 70, 'R-CN1'], ['b2', 'router', 670, 225, 'R-CN2'], ['b3', 'router', 670, 380, 'R-CN3'], ['s1', 'switch', 830, 70, 'SW-CN1'], ['s2', 'switch', 830, 225, 'SW-CN2'], ['s3', 'switch', 830, 380, 'SW-CN3'],
  ], [['srv', 'core'], ['core', 'r'], ['r', 'm', FO], ['r', 'n', VPN], ['m', 'b1', FO], ['m', 'b2', FO], ['m', 'b3', FO], ['n', 'b1', VPN], ['n', 'b2', VPN], ['n', 'b3', VPN], ['b1', 's1'], ['b2', 's2'], ['b3', 's3']]),
  G(GE, 'ent-school', 'Trường học', 'School', [
    plan(960, 10, ['VLAN 10 · Phòng máy · 10.20.10.0/24', 'VLAN 20 · Giáo viên · 10.20.20.0/24', 'VLAN 30 · Wi-Fi giáo viên · 10.20.30.0/24', 'VLAN 40 · Wi-Fi học sinh · 10.20.40.0/22', 'VLAN 50 · Văn phòng · 10.20.50.0/24', 'VLAN 60 · Camera · 10.20.60.0/24', 'VLAN 99 · Quản trị · 10.20.99.0/24', 'Học sinh: chỉ ra Internet, lọc nội dung,', 'không vào được VLAN giáo viên và máy chủ']),
    ['net', 'cloud', 100, 5, 'INTERNET|Cáp quang 500 Mb'], ['f1', 'firewall', 305, 10, 'FW1|Active · lọc nội dung'], ['f2', 'firewall', 505, 10, 'FW2|Standby'], ['c1', 'l3switch', 300, 150, 'CORE1'], ['c2', 'l3switch', 500, 150, 'CORE2'], ['sv', 'server', 820, 140, 'SRV|LMS, AD, DHCP, DNS'],
    ['s1', 'switch', 50, 290, 'SW-LAB|VLAN 10'], ['s2', 'switch', 240, 290, 'SW-GV|VLAN 20'], ['s3', 'switch', 430, 290, 'SW-WIFI|VLAN 30, 40'], ['s4', 'switch', 680, 290, 'SW-VP|VLAN 50, 60'],
    ['p1', 'pc', 55, 430, 'PC-LAB|40 máy'], ['p2', 'laptop', 245, 435, 'LT-GV'], ['a', 'ap', 440, 430, 'AP-LOP|SSID GV + HS'], ['m', 'tablet', 560, 430, 'Học sinh|VLAN 40'], ['pv', 'pc', 680, 430, 'PC-VP'], ['cam', 'camera', 810, 430, 'CAM-SAN|VLAN 60'],
  ], [['net', 'f1', FO], ['f1', 'f2', { label: 'HA', dash: 'dash' }], ['f1', 'c1'], ['f2', 'c2'], ['c1', 'c2', { label: 'Stack', width: 4 }], ['c2', 'sv'],
    ['c1', 's1'], ['c1', 's2'], ['c2', 's3'], ['c2', 's4'], ['c2', 's1', { dash: 'dash' }], ['c2', 's2', { dash: 'dash' }], ['c1', 's3', { dash: 'dash' }], ['c1', 's4', { dash: 'dash' }],
    ['s1', 'p1'], ['s2', 'p2'], ['s3', 'a'], ['a', 'm', WIFI], ['s4', 'pv'], ['s4', 'cam']]),
  G(GE, 'ent-hospital', 'Bệnh viện · tách mạng y tế', 'Hospital · segmented network', [
    plan(960, 10, ['VLAN 10 · Nhân viên · 10.30.10.0/23', 'VLAN 20 · Thiết bị y tế · 10.30.20.0/24', 'VLAN 30 · Máy chủ HIS, PACS · 10.30.30.0/24', 'VLAN 40 · Wi-Fi bác sĩ · 10.30.40.0/24', 'VLAN 50 · Wi-Fi bệnh nhân · 10.30.50.0/22', 'VLAN 99 · Quản trị · 10.30.99.0/24', 'Thiết bị y tế chỉ nói chuyện với HIS, PACS', 'Bệnh nhân: chỉ ra Internet', 'Mọi lưu lượng giữa các vùng đi qua firewall']),
    ['net', 'cloud', 110, 5, 'INTERNET|2 nhà mạng'], ['f1', 'firewall', 330, 10, 'FW1|Active'], ['f2', 'firewall', 530, 10, 'FW2|Standby'], ['c1', 'l3switch', 325, 150, 'CORE1'], ['c2', 'l3switch', 525, 150, 'CORE2'],
    ['s1', 'switch', 40, 290, 'SW-KHOA|VLAN 10'], ['s2', 'switch', 230, 290, 'SW-YTE|VLAN 20'], ['s3', 'switch', 420, 290, 'SW-DC|VLAN 30'], ['s4', 'switch', 620, 290, 'SW-WIFI|VLAN 40, 50'], ['a', 'ap', 810, 290, 'AP-KHOA|SSID bác sĩ + bệnh nhân'],
    ['p', 'pc', 45, 430, 'Máy trạm|Nhập bệnh án'], ['i', 'iot', 235, 430, 'Máy xét nghiệm'], ['h', 'database', 380, 430, 'HIS|Hồ sơ bệnh án'], ['x', 'nas', 490, 430, 'PACS|Ảnh chụp'], ['ph', 'phone', 630, 430, 'Điện thoại trực'], ['t', 'tablet', 810, 430, 'Máy bảng|VLAN 40'],
  ], [['net', 'f1', FO], ['f1', 'f2', { label: 'HA', dash: 'dash' }], ['f1', 'c1'], ['f2', 'c2'], ['c1', 'c2', { label: 'Stack', width: 4 }],
    ['c1', 's1'], ['c1', 's2'], ['c2', 's3'], ['c2', 's4'], ['c2', 's1', { dash: 'dash' }], ['c2', 's2', { dash: 'dash' }], ['c1', 's3', { dash: 'dash' }], ['c1', 's4', { dash: 'dash' }],
    ['s4', 'a'], ['s1', 'p'], ['s2', 'i'], ['s3', 'h'], ['s3', 'x'], ['s4', 'ph'], ['a', 't', WIFI]]),
  G(GE, 'ent-hotel', 'Khách sạn · khách, IPTV, tổng đài', 'Hotel · guests, IPTV, PBX', [
    plan(960, 10, ['VLAN 20 · Lễ tân, POS · 10.40.20.0/24', 'VLAN 30 · Thoại · 10.40.30.0/24', 'VLAN 40 · IPTV · 10.40.40.0/23 (multicast)', 'VLAN 60 · Camera · 10.40.60.0/24', 'VLAN 100 · Wi-Fi khách · 10.40.100.0/21', 'VLAN 99 · Quản trị · 10.40.99.0/24', 'Khách: đăng nhập qua portal, giới hạn băng thông,', 'các máy khách không thấy nhau (client isolation)', 'POS tách riêng để đạt yêu cầu thanh toán thẻ']),
    ['net', 'cloud', 60, 5, 'INTERNET|2 đường cáp quang'], ['f1', 'firewall', 305, 10, 'FW1|Active · portal khách'], ['f2', 'firewall', 525, 10, 'FW2|Standby'],
    ['c1', 'l3switch', 300, 150, 'CORE1'], ['c2', 'l3switch', 520, 150, 'CORE2'], ['pbx', 'ipPbx', 770, 150, 'PBX|Tổng đài nội bộ'],
    ['sf', 'switch', 60, 300, 'SW-TANG|VLAN 100'], ['sb', 'switch', 280, 300, 'SW-LETAN|VLAN 20'], ['st', 'switch', 500, 300, 'SW-PHONG|VLAN 30, 40'], ['sm', 'switch', 740, 300, 'SW-CCTV|VLAN 60'],
    ['a', 'ap', 30, 440, 'AP-Tầng'], ['m', 'mobile', 150, 440, 'Khách|Cách ly'], ['pos', 'posTerminal', 285, 440, 'POS'], ['ph', 'phone', 450, 440, 'Điện thoại phòng'], ['tv', 'television', 570, 440, 'IPTV'], ['cam', 'camera', 710, 440, 'CAM-SANH'], ['nvr', 'nvr', 840, 440, 'NVR|Lưu 30 ngày'],
  ], [['net', 'f1', FO], ['f1', 'f2', { label: 'HA', dash: 'dash' }], ['f1', 'c1'], ['f2', 'c2'], ['c1', 'c2', { label: 'Stack', width: 4 }], ['c2', 'pbx'], ['c1', 'sf'], ['c1', 'sb'], ['c2', 'st'], ['c2', 'sm'],
    ['sf', 'a'], ['a', 'm', WIFI], ['sb', 'pos'], ['st', 'ph'], ['st', 'tv'], ['sm', 'cam'], ['sm', 'nvr']]),
  G(GE, 'ent-factory', 'Nhà máy · tách IT và OT', 'Factory · IT/OT separation', [
    plan(960, 30, ['Mạng IT · 10.50.0.0/16 · văn phòng, ERP', 'DMZ công nghiệp · 172.20.0.0/24 · Historian', 'Mạng OT · 192.168.50.0/24 · SCADA, HMI, PLC', 'IT không kết nối thẳng vào OT', 'Dữ liệu sản xuất đi một chiều: OT → Historian → ERP', 'OT không ra Internet; cập nhật qua máy trung gian', 'Truy cập từ xa của nhà thầu: VPN vào DMZ, có ghi hình']),
    zone('z1', 30, 30, 260, 460, 'Mạng IT'), zone('z2', 330, 30, 240, 460, 'DMZ công nghiệp', ORANGE), zone('z3', 610, 30, 310, 460, 'Mạng OT', RED),
    ['erp', 'server', 60, 70, 'ERP'], ['pc', 'pc', 60, 370, 'Văn phòng'], ['sw', 'switch', 180, 220, 'SW-IT'], ['f1', 'firewall', 420, 70, 'FW-IT|Chỉ ERP đọc Historian'], ['h', 'database', 420, 210, 'Historian'], ['f2', 'firewall', 420, 370, 'FW-OT|Chặn mọi kết nối từ IT'], ['sc', 'server', 650, 80, 'SCADA'], ['hmi', 'television', 810, 80, 'HMI'], ['so', 'switch', 635, 230, 'SW-OT1|Vòng ring'], ['so2', 'switch', 825, 230, 'SW-OT2|Vòng ring'], ['plc', 'plc', 650, 370, 'PLC-1'], ['plc2', 'plc', 810, 370, 'PLC-2'],
  ], [['erp', 'sw'], ['pc', 'sw'], ['sw', 'f1'], ['f1', 'h'], ['h', 'f2'], ['f2', 'so', 'Chỉ cổng cho phép'], ['so', 'so2', { label: 'Ring' }], ['so', 'sc'], ['so2', 'hmi'], ['so', 'plc'], ['so2', 'plc2'], ['plc', 'plc2', { dash: 'dash' }]]),
  G(GE, 'ent-retail', 'Chuỗi cửa hàng · SD-WAN', 'Retail chain · SD-WAN', [
    plan(960, 200, ['Mỗi cửa hàng một dải /24: 10.60.N.0/24', 'VLAN 10 · POS · không ra Internet trực tiếp', 'VLAN 20 · Wi-Fi nhân viên', 'VLAN 30 · Wi-Fi khách · tách hẳn khỏi POS', 'Cấu hình cửa hàng mới: cắm là chạy (zero-touch)', 'Mất cáp quang: tự chuyển sang 4G']),
    ['dc', 'datacenter', 300, 20, { w: 330, h: 130, label: 'Trung tâm · POS, kho' }], ['e0', 'sdwanEdge', 340, 70, 'EDGE-HQ'], ['db', 'database', 520, 70, 'DB'],
    ['n', 'cloud', 410, 210, 'INTERNET|4G dự phòng'],
    ['e1', 'sdwanEdge', 85, 340, 'EDGE-CH1'], ['e2', 'sdwanEdge', 425, 340, 'EDGE-CH2'], ['e3', 'sdwanEdge', 765, 340, 'EDGE-CH3'],
    ['p1', 'posTerminal', 30, 460, 'POS-1'], ['w1', 'ap', 145, 460, 'AP-CH1'], ['p2', 'posTerminal', 370, 460, 'POS-2'], ['w2', 'ap', 485, 460, 'AP-CH2'], ['p3', 'posTerminal', 710, 460, 'POS-3'], ['w3', 'ap', 825, 460, 'AP-CH3'],
  ], [['e0', 'db'], ['e0', 'n', VPN], ['n', 'e1', VPN], ['n', 'e2', VPN], ['n', 'e3', VPN], ['e1', 'p1'], ['e1', 'w1'], ['e2', 'p2'], ['e2', 'w2'], ['e3', 'p3'], ['e3', 'w3']]),
  G(GS, 'sec-dmz', 'Firewall 3 vùng · DMZ', 'Three-zone firewall · DMZ', [
    zone('z1', 480, 20, 460, 220, 'DMZ · 172.16.0.0/24', ORANGE), zone('z2', 480, 260, 460, 230, 'Inside · 10.0.0.0/16', GREEN),
    ['net', 'cloud', 40, 190, 'INTERNET'], ['fw', 'firewall', 280, 200, 'FW|Mặc định chặn'], ['sd', 'switch', 510, 90, 'SW-DMZ'], ['w', 'webServer', 670, 45, 'WEB'], ['m', 'mailServer', 820, 90, 'MAIL'], ['d', 'dnsServer', 670, 160, 'DNS'], ['c', 'l3switch', 510, 350, 'SW-CORE'], ['ad', 'server', 720, 290, 'AD'], ['p', 'pc', 720, 400, 'PC'],
  ], [['net', 'fw', { ...FO, label: 'Untrust' }], ['fw', 'sd', 'Chỉ 80, 443, 25, 53'], ['sd', 'w'], ['sd', 'm'], ['sd', 'd'], ['fw', 'c', 'Trust'], ['c', 'ad'], ['c', 'p']]),
  G(GS, 'sec-defense', 'Bảo vệ nhiều lớp', 'Defense in depth', [
    ['u', 'user', 30, 200, 'Người dùng'], ['net', 'cloud', 150, 190, 'INTERNET'], ['fw', 'firewall', 330, 200, 'FW|Lớp mạng'], ['ips', 'idsIps', 480, 200, 'IPS|Chữ ký tấn công'], ['waf', 'waf', 630, 200, 'WAF|Lớp ứng dụng'], ['w', 'webServer', 780, 200, 'WEB'], ['db', 'database', 910, 200, 'DB'], ['s', 'siem', 560, 370, 'SIEM|Gom log, cảnh báo'],
  ], [['u', 'net'], ['net', 'fw'], ['fw', 'ips'], ['ips', 'waf'], ['waf', 'w'], ['w', 'db'], ['fw', 's', { dash: 'dot' }], ['ips', 's', { dash: 'dot' }], ['waf', 's', { dash: 'dot' }], ['w', 's', { dash: 'dot', label: 'log' }]]),
  G(GS, 'sec-remote-vpn', 'VPN cho người làm từ xa', 'Remote access VPN', [
    ['l', 'vpnClient', 40, 90, 'VPN-LAPTOP|Ở nhà'], ['m', 'mobile', 40, 310, 'Điện thoại|4G'], ['n', 'cloud', 210, 190, 'INTERNET'], ['g', 'vpnGateway', 430, 200, 'VPN-GW|Cấp IP 10.8.0.0/24'], ['r', 'server', 640, 60, 'RADIUS'], ['f', 'mfa', 810, 70, 'MFA|Mã một lần'], ['fw', 'firewall', 640, 200, 'FW|Theo nhóm người dùng'], ['s', 'server', 840, 190, 'SRV|Ứng dụng nội bộ'],
  ], [['l', 'n', VPN], ['m', 'n', VPN], ['n', 'g', { ...VPN, label: 'TLS / IPsec' }], ['g', 'r', 'Xác thực'], ['r', 'f'], ['g', 'fw'], ['fw', 's']]),
  G(GS, 'sec-zero-trust', 'Zero Trust · kiểm tra mọi truy cập', 'Zero Trust access', [
    ['u', 'user', 40, 190, 'Nhân viên|Ở bất kỳ đâu'], ['p', 'proxy', 270, 190, 'ZT-PROXY|Điểm kiểm soát'], ['i', 'identityProvider', 270, 40, 'IDP|Danh tính'], ['m', 'mfa', 480, 40, 'MFA'], ['n', 'nac', 270, 350, 'POSTURE|Thiết bị đạt chuẩn'], ['a1', 'webServer', 620, 110, 'APP-1'], ['a2', 'database', 620, 260, 'APP-2'], ['s', 'siem', 820, 190, 'SIEM'],
  ], [['u', 'p', 'Mọi yêu cầu'], ['p', 'i'], ['i', 'm'], ['p', 'n'], ['p', 'a1', 'Quyền tối thiểu'], ['p', 'a2'], ['a1', 's', { dash: 'dot' }], ['a2', 's', { dash: 'dot' }]]),
  G(GS, 'sec-soc', 'SOC · thu thập và cảnh báo', 'SOC · collect and alert', [
    ['f', 'firewall', 60, 50, 'FW'], ['w', 'webServer', 60, 180, 'WEB'], ['a', 'server', 60, 310, 'AD'], ['p', 'pc', 60, 440, 'Máy trạm'], ['l', 'logging', 320, 240, 'LOG|Bộ thu syslog'], ['s', 'siem', 530, 240, 'SIEM|Luật tương quan'], ['d', 'dashboard', 760, 90, 'DASH|Phân tích viên'], ['al', 'alert', 760, 240, 'ALERT'], ['o', 'onCall', 760, 390, 'ON-CALL|Xử lý sự cố'],
  ], [['f', 'l'], ['w', 'l'], ['a', 'l'], ['p', 'l'], ['l', 's'], ['s', 'd'], ['s', 'al'], ['al', 'o']]),
  G(GD, 'dc-three-tier', 'Data center · 3 lớp truyền thống', 'Data center · Three tier', [
    ['n', 'cloud', 350, 20, 'WAN'], ['c1', 'l3switch', 240, 130, 'CORE-1'], ['c2', 'l3switch', 500, 130, 'CORE-2'], ['g1', 'l3switch', 240, 250, 'AGG-1'], ['g2', 'l3switch', 500, 250, 'AGG-2'], ['a1', 'switch', 110, 380, 'ACC-1'], ['a2', 'switch', 370, 380, 'ACC-2'], ['a3', 'switch', 630, 380, 'ACC-3'], ['h1', 'server', 120, 480, 'HOST-1'], ['h2', 'server', 380, 480, 'HOST-2'], ['h3', 'server', 640, 480, 'HOST-3'],
  ], [['n', 'c1', FO], ['n', 'c2', FO], ['c1', 'c2', { ...FO, label: 'Po1', width: 4 }], ['c1', 'g1', FO], ['c1', 'g2', FO], ['c2', 'g1', FO], ['c2', 'g2', FO], ['g1', 'g2', { label: 'Po2 · Gateway, STP root', width: 4 }], ['g1', 'a1'], ['g1', 'a2'], ['g1', 'a3', { dash: 'dash' }], ['g2', 'a1', { dash: 'dash' }], ['g2', 'a2', { dash: 'dash' }], ['g2', 'a3'], ['a1', 'h1'], ['a2', 'h2'], ['a3', 'h3']]),
  G(GD, 'dc-san', 'Lưu trữ SAN · hai đường độc lập', 'Dual-fabric SAN', [
    ['h1', 'virtualMachine', 170, 50, 'HOST-1|2 card HBA'], ['h2', 'virtualMachine', 540, 50, 'HOST-2|2 card HBA'], ['a', 'sanSwitch', 170, 220, 'SAN-A|Fabric A'], ['b', 'sanSwitch', 540, 220, 'SAN-B|Fabric B'], ['s', 'nasArray', 360, 390, 'STORAGE|Controller kép'], ['t', 'tapeLibrary', 680, 390, 'TAPE|Sao lưu'],
  ], [['h1', 'a', FO], ['h1', 'b', FO], ['h2', 'a', FO], ['h2', 'b', FO], ['a', 's', FO], ['b', 's', FO], ['b', 't', FO]]),
  G(GD, 'dc-room', 'Phòng máy · nguồn, lạnh, cảm biến', 'Server room · power, cooling, sensors', [
    ['cu', 'switch', 300, 40, 'SW-TOR|Top of rack'], ['pp', 'patchPanel', 130, 40, 'PP'], ['sv', 'serverCluster', 490, 40, 'SERVERS'], ['pdu', 'pdu', 490, 190, 'PDU'], ['u', 'ups', 300, 190, 'UPS|Pin dự phòng'], ['ac', 'precisionCooling', 130, 190, 'CRAC'], ['t', 'temperatureSensor', 130, 340, 'TEMP'], ['sm', 'smokeSensor', 300, 340, 'SMOKE'], ['da', 'doorAccess', 490, 340, 'DOOR'], ['m', 'monitor', 300, 460, 'NMS|Cảnh báo môi trường'],
  ], [['pp', 'cu'], ['cu', 'sv'], ['pdu', 'sv', 'Nguồn'], ['u', 'pdu'], ['ac', 'm', { dash: 'dot' }], ['t', 'm', { dash: 'dot' }], ['sm', 'm', { dash: 'dot' }], ['da', 'm', { dash: 'dot' }]]),
  G(GD, 'cloud-vpc', 'Cloud · VPC public và private', 'Cloud · Public and private subnets', [
    ['v', 'vpc', 170, 20, { w: 740, h: 480, label: 'VPC · 10.0.0.0/16' }], ['p', 'publicSubnet', 200, 60, { w: 310, h: 410, label: 'Public · 10.0.1.0/24', dash: 'dash' }], ['q', 'privateSubnet', 560, 60, { w: 320, h: 410, label: 'Private · 10.0.2.0/24', dash: 'dash' }],
    ['n', 'cloud', 30, 210, 'INTERNET'], ['i', 'internetGateway', 230, 220, 'IGW'], ['l', 'loadBalancer', 400, 110, 'LB'], ['g', 'natGateway', 400, 340, 'NAT'], ['a', 'vm', 600, 90, 'APP-1'], ['b', 'vm', 780, 200, 'APP-2'], ['d', 'sqlDatabase', 690, 360, 'SQL'],
  ], [['n', 'i'], ['i', 'l'], ['i', 'g'], ['l', 'a'], ['l', 'b'], ['a', 'd'], ['b', 'd'], ['a', 'g', { dash: 'dash', label: 'Ra Internet' }]]),
  G(GD, 'cloud-multi-az', 'Cloud · chạy trên 2 AZ', 'Cloud · Two availability zones', [
    ['z1', 'availabilityZone', 210, 150, { w: 320, h: 340, label: 'AZ-A' }], ['z2', 'availabilityZone', 580, 150, { w: 320, h: 340, label: 'AZ-B' }],
    ['u', 'browser', 40, 40, 'Người dùng'], ['c', 'cdn', 220, 40, 'CDN'], ['l', 'loadBalancer', 520, 40, 'LB'], ['a', 'autoscaling', 330, 210, 'ASG-A'], ['b', 'autoscaling', 700, 210, 'ASG-B'], ['d1', 'sqlDatabase', 330, 370, 'SQL-Chính'], ['d2', 'sqlDatabase', 700, 370, 'SQL-Phụ'],
  ], [['u', 'c'], ['c', 'l'], ['l', 'a'], ['l', 'b'], ['a', 'd1'], ['b', 'd1', { dash: 'dash' }], ['d1', 'd2', 'Sao chép đồng bộ']]),
  G(GD, 'cloud-hybrid', 'Hybrid · nối on-premise với cloud', 'Hybrid · On-premise to cloud', [
    ['o', 'datacenter', 30, 60, { w: 300, h: 370, label: 'On-premise' }],
    ['s', 'server', 70, 110, 'AD'], ['p', 'pc', 70, 290, 'PC'], ['c', 'l3switch', 220, 200, 'SW-CORE'], ['g', 'vpnGateway', 400, 200, 'VPN-GW'], ['t', 'transitGateway', 580, 200, 'TGW'], ['v1', 'vpc', 720, 110, { w: 200, h: 130, label: 'VPC-App' }], ['v2', 'vpc', 720, 290, { w: 200, h: 130, label: 'VPC-Data' }], ['a', 'vm', 790, 150, 'APP'], ['d', 'sqlDatabase', 790, 340, 'SQL'],
  ], [['s', 'c'], ['p', 'c'], ['c', 'g'], ['g', 't', { ...VPN, label: 'S2S VPN' }], ['t', 'a'], ['t', 'd']]),
  G(GA, 'app-microservices', 'Microservices · API và hàng đợi', 'Microservices · API and queue', [
    ['u', 'mobileApp', 40, 200, 'APP'], ['g', 'apiGateway', 200, 200, 'API-GW|Xác thực, giới hạn'], ['a', 'microservice', 430, 60, 'ĐƠN HÀNG'], ['b', 'microservice', 430, 200, 'SẢN PHẨM'], ['c', 'microservice', 430, 340, 'THANH TOÁN'], ['q', 'queue', 640, 340, 'MQ'], ['n', 'microservice', 830, 340, 'THÔNG BÁO'], ['d', 'sqlDatabase', 640, 60, 'SQL'], ['r', 'cache', 640, 200, 'CACHE'],
  ], [['u', 'g'], ['g', 'a'], ['g', 'b'], ['g', 'c'], ['a', 'd'], ['b', 'r'], ['c', 'q', 'Sự kiện'], ['q', 'n']]),
  G(GA, 'app-cdn', 'Web lớn · CDN, cache, nhiều server', 'Large website · CDN, cache', [
    ['u', 'browser', 30, 200, 'Trình duyệt'], ['d', 'dnsServer', 30, 60, 'DNS'], ['c', 'cdn', 190, 200, 'CDN|File tĩnh'], ['o', 'objectStorage', 190, 370, 'OBJ'], ['w', 'waf', 350, 200, 'WAF'], ['l', 'loadBalancer', 500, 200, 'LB'], ['a', 'webServer', 660, 90, 'WEB-1'], ['b', 'webServer', 660, 310, 'WEB-2'], ['r', 'cache', 840, 90, 'CACHE'], ['s', 'sqlDatabase', 840, 310, 'SQL'],
  ], [['u', 'd'], ['u', 'c'], ['c', 'o'], ['c', 'w'], ['w', 'l'], ['l', 'a'], ['l', 'b'], ['a', 'r'], ['b', 's'], ['a', 's'], ['b', 'r']]),
  G(GA, 'devops-gitops', 'GitOps · từ commit đến cụm', 'GitOps · Commit to cluster', [
    ['dv', 'developer', 40, 80, 'DEV'], ['r', 'gitRepo', 200, 80, 'REPO'], ['m', 'mergeRequest', 360, 80, 'MR|Review'], ['rn', 'runner', 520, 80, 'RUNNER|Build, test'], ['sc', 'imageScanner', 680, 80, 'SCAN'], ['g', 'registry', 840, 80, 'REG'], ['h', 'helmChart', 200, 290, 'HELM|Cấu hình mong muốn'], ['o', 'operator', 430, 290, 'GITOPS|Tự đồng bộ'], ['c', 'cluster', 650, 290, 'CLUSTER'], ['p', 'pod', 840, 290, 'POD'],
  ], [['dv', 'r'], ['r', 'm'], ['m', 'rn'], ['rn', 'sc'], ['sc', 'g'], ['m', 'h'], ['h', 'o'], ['o', 'c'], ['c', 'p'], ['g', 'p', { dash: 'dash', label: 'Kéo image' }]]),
  G(GA, 'devops-observability', 'Giám sát · metric, log, trace', 'Observability · metrics, logs, traces', [
    ['a', 'microservice', 50, 60, 'APP-1'], ['b', 'microservice', 50, 210, 'APP-2'], ['c', 'node', 50, 360, 'NODE'], ['m', 'monitor', 300, 60, 'METRIC'], ['l', 'logging', 300, 210, 'LOG'], ['t', 'tracing', 300, 360, 'TRACE'], ['ts', 'timeSeriesDb', 520, 60, 'TSDB'], ['d', 'dashboard', 740, 210, 'DASH'], ['al', 'alert', 740, 60, 'ALERT'], ['o', 'onCall', 900, 60, 'ON-CALL'],
  ], [['a', 'm'], ['b', 'm'], ['c', 'm'], ['a', 'l'], ['b', 'l'], ['a', 't'], ['b', 't'], ['m', 'ts'], ['ts', 'd'], ['l', 'd'], ['t', 'd'], ['ts', 'al'], ['al', 'o']]),
);
TEMPLATES.push(
  G(GE, 'ent-wifi-floors', 'Wi-Fi nhiều tầng · WLC', 'Multi-floor Wi-Fi with WLC', [
    plan(960, 40, ['SSID Corp · WPA2/3-Enterprise · VLAN 30', 'SSID Guest · portal · VLAN 100, chỉ ra Internet', 'AP cùng tầng xen kênh 1, 6, 11 (2.4 GHz)', '5 GHz: kênh 36, 52, 149, độ rộng 40 MHz', 'AP nhận IP ở VLAN quản trị 99, tìm WLC qua DHCP option 43', 'Roaming giữa các AP do WLC điều phối']),
    zone('z3', 30, 150, 880, 110, 'TẦNG 3', GRAY), zone('z2', 30, 275, 880, 110, 'TẦNG 2', GRAY), zone('z1', 30, 400, 880, 110, 'TẦNG 1', GRAY),
    ['core', 'l3switch', 300, 30, 'SW-CORE'], ['wlc', 'wlc', 110, 35, 'WLC|CAPWAP tới mọi AP'], ['rad', 'server', 520, 20, 'RADIUS|Xác thực 802.1X'],
    ['a31', 'ap', 50, 185, 'AP-T3-1|Kênh 1'], ['s3', 'switch', 220, 185, 'SW-T3|PoE+'], ['a32', 'ap', 590, 185, 'AP-T3-2|Kênh 6'], ['l3', 'laptop', 790, 190, 'LT-T3|SSID Corp'],
    ['a21', 'ap', 50, 310, 'AP-T2-1|Kênh 11'], ['s2', 'switch', 310, 310, 'SW-T2|PoE+'], ['a22', 'ap', 590, 310, 'AP-T2-2|Kênh 1'], ['l2', 'mobile', 790, 310, 'Khách-T2|SSID Guest'],
    ['a11', 'ap', 50, 435, 'AP-T1-1|Kênh 6'], ['s1', 'switch', 400, 435, 'SW-T1|PoE+'], ['a12', 'ap', 590, 435, 'AP-T1-2|Kênh 11'], ['l1', 'tablet', 790, 435, 'Tablet-T1|SSID Corp'],
  ], [['core', 'wlc'], ['core', 'rad'], ['core', 's3', FO], ['core', 's2', FO], ['core', 's1', FO], ['s3', 'a31'], ['s3', 'a32'], ['s2', 'a21'], ['s2', 'a22'], ['s1', 'a11'], ['s1', 'a12'],
    ['a32', 'l3', WIFI], ['a22', 'l2', WIFI], ['a12', 'l1', WIFI]]),
  G(GE, 'ent-cctv', 'Camera giám sát · VLAN riêng', 'CCTV on a dedicated VLAN', [
    plan(960, 40, ['VLAN 60 · Camera · 10.1.60.0/24, IP tĩnh', 'Camera không ra Internet, không vào mạng nhân viên', 'Chỉ NVR và máy giám sát được kết nối tới camera', 'Xem từ xa: qua VPN, không mở cổng NVR ra Internet', '8 camera 4 MP ≈ 32 Mb/s ghi liên tục', 'Lưu 30 ngày ≈ 10 TB (H.265)', 'Đổi mật khẩu mặc định, cập nhật firmware camera']),
    ['net', 'cloud', 30, 30, 'INTERNET'], ['fw', 'firewall', 230, 40, 'FW|VPN cho xem từ xa'], ['core', 'l3switch', 420, 40, 'SW-CORE|ACL chặn VLAN 60'], ['nvr', 'nvr', 640, 35, 'NVR|RAID 5, lưu 30 ngày'], ['mon', 'television', 810, 40, 'Màn hình bảo vệ'],
    ['s1', 'switch', 200, 220, 'SW-POE1|Khu văn phòng'], ['s2', 'switch', 620, 220, 'SW-POE2|Khu kho, bãi xe'],
    ['c1', 'camera', 60, 400, 'CAM-CUA'], ['c2', 'camera', 200, 400, 'CAM-SANH'], ['c3', 'camera', 340, 400, 'CAM-HANHLANG'], ['c4', 'camera', 500, 400, 'CAM-KHO'], ['c5', 'camera', 640, 400, 'CAM-BAIXE'], ['c6', 'camera', 780, 400, 'CAM-CONG|Ngoài trời, PoE+'],
    ['u', 'vpnClient', 30, 220, 'Quản lý|Xem qua VPN'],
  ], [['net', 'fw', FO], ['fw', 'core'], ['core', 'nvr'], ['nvr', 'mon'], ['core', 's1', { mode: 'trunk', label: 'trunk' }], ['core', 's2', { mode: 'trunk', label: 'trunk' }],
    ['s1', 'c1'], ['s1', 'c2'], ['s1', 'c3'], ['s2', 'c4'], ['s2', 'c5'], ['s2', 'c6'], ['u', 'net', VPN]]),
  G(GE, 'ent-voip', 'Tổng đài IP · SIP trunk', 'IP telephony with SIP trunk', [
    plan(960, 40, ['Voice VLAN 20 · 10.1.20.0/24 · DHCP option 150/66', 'Điện thoại gắn nhãn VLAN 20; PC cắm sau điện thoại ở VLAN 10', 'QoS: thoại đánh dấu EF (DSCP 46), hàng đợi ưu tiên', 'G.711 ≈ 87 kb/s mỗi cuộc gọi; G.729 ≈ 31 kb/s', 'SBC che tổng đài, chỉ nhận SIP từ IP của nhà mạng', 'Mất SIP trunk: gọi ra qua cổng analog dự phòng', 'Trễ một chiều < 150 ms, jitter < 30 ms, mất gói < 1%']),
    ['itsp', 'cloud', 30, 30, 'NHÀ MẠNG THOẠI|SIP trunk'], ['sbc', 'sbc', 240, 40, 'SBC|Chỉ nhận SIP từ nhà mạng'], ['pbx', 'ipPbx', 430, 40, 'PBX|Tổng đài, hộp thư thoại'], ['gw', 'voiceGateway', 620, 40, 'VOICE-GW|2 đường analog dự phòng'], ['pstn', 'cellTower', 810, 40, 'PSTN'],
    ['core', 'l3switch', 430, 200, 'SW-CORE|Tin DSCP từ điện thoại'], ['sw', 'switch', 430, 340, 'SW-POE|Voice VLAN 20, PoE'],
    ['p1', 'phone', 170, 460, 'IP-Phone-LT|Lễ tân'], ['pc', 'pc', 20, 460, 'PC-LT|VLAN 10'], ['p2', 'phone', 330, 460, 'IP-Phone-KD'], ['p3', 'phone', 490, 460, 'IP-Phone-GD'], ['sf', 'laptop', 640, 465, 'Softphone|Làm từ xa qua VPN'], ['conf', 'phone', 800, 460, 'Phone-HOP|Phòng họp'],
  ], [['itsp', 'sbc', { label: 'SIP + RTP' }], ['sbc', 'pbx'], ['pbx', 'gw'], ['gw', 'pstn', { dash: 'dash', label: 'Dự phòng' }], ['pbx', 'core'], ['core', 'sw', { mode: 'trunk' }],
    ['sw', 'p1'], ['p1', 'pc'], ['sw', 'p2'], ['sw', 'p3'], ['sw', 'conf'], ['sf', 'core', VPN]]),
  G(GE, 'ent-ad-sites', 'Active Directory · nhiều site', 'Active Directory across sites', [
    plan(960, 40, ['Một forest, một domain: corp.local', 'Mỗi site khai báo subnet để máy trạm tìm DC gần nhất', 'HQ giữ 5 vai trò FSMO (PDC Emulator trên DC1)', 'Mọi DC ở HQ và DR đều là Global Catalog và DNS', 'Chi nhánh dùng RODC: không lưu mật khẩu quản trị', 'Đồng bộ trong site: gần như tức thì', 'Đồng bộ giữa các site: theo lịch, mặc định 180 phút', 'Sao lưu System State của ít nhất 2 DC']),
    zone('zh', 30, 30, 400, 230, 'SITE HQ · 10.1.0.0/16'), zone('zb', 30, 290, 400, 220, 'SITE CHI NHÁNH · 10.2.0.0/16', GREEN), zone('zd', 510, 290, 400, 220, 'SITE DR · 10.9.0.0/16', ORANGE),
    ['ca', 'server', 60, 80, 'CA|Cấp chứng chỉ'], ['dc1', 'server', 205, 80, 'DC1|PDC, RID, Infra, GC'], ['dc2', 'server', 360, 80, 'DC2|Schema, Naming, GC'], ['pc1', 'pc', 110, 195, 'PC-HQ'],
    ['ro', 'server', 80, 340, 'RODC|Chỉ đọc, GC, DNS'], ['pc2', 'pc', 220, 350, 'PC-CN'], ['fs', 'nas', 350, 420, 'FILE-CN|DFS'],
    ['dc3', 'server', 560, 340, 'DC3|GC, DNS'], ['bk', 'backupServer', 730, 345, 'BACKUP|System State'],
    ['wan', 'mplsCloud', 620, 100, 'WAN|MPLS / VPN'],
  ], [['dc1', 'dc2'], ['dc1', 'ca'], ['pc1', 'dc1', { dash: 'dot' }], ['dc2', 'wan'], ['wan', 'ro', { dash: 'dash', label: 'Một chiều' }], ['wan', 'dc3', { dash: 'dash', label: 'Theo lịch' }],
    ['pc2', 'ro', { dash: 'dot', label: 'Đăng nhập' }], ['pc2', 'fs'], ['dc3', 'bk']]),
  G(GE, 'ent-backup', 'Sao lưu 3-2-1', '3-2-1 backup', [
    plan(960, 40, ['3 bản dữ liệu: bản gốc + 2 bản sao lưu', '2 loại phương tiện: đĩa và cloud hoặc băng từ', '1 bản để ngoài site', 'Thêm 1 bản không sửa được (immutable) chống ransomware', 'Hằng ngày: incremental · Hằng tuần: synthetic full', 'Giữ: 14 ngày, 4 tuần, 12 tháng, 3 năm', 'RPO 24 giờ; cơ sở dữ liệu sao lưu log mỗi 15 phút', 'Khôi phục thử mỗi tháng, ghi lại thời gian thật']),
    zone('zp', 30, 30, 260, 480, 'HỆ THỐNG ĐANG CHẠY'), zone('zl', 330, 30, 280, 480, 'SAO LƯU TẠI CHỖ', GREEN), zone('zo', 650, 30, 260, 480, 'NGOÀI SITE', ORANGE),
    ['vm', 'virtualMachine', 70, 90, 'VM-HOST|Máy ảo'], ['fsv', 'nas', 70, 230, 'FILE-SRV'], ['db', 'database', 70, 370, 'SQL|Sao lưu log 15 phút'],
    ['bs', 'backupServer', 370, 230, 'BACKUP-SRV|Tách khỏi domain'], ['rp', 'nasArray', 510, 90, 'REPO|Đĩa, khôi phục nhanh'], ['hr', 'nasArray', 510, 370, 'HARDENED|Không sửa được 14 ngày'],
    ['cl', 'objectStorage', 700, 90, 'CLOUD|Object lock'], ['tp', 'tapeLibrary', 700, 370, 'TAPE|Lưu 3 năm, cất két'], ['lab', 'virtualMachine', 820, 230, 'LAB|Khôi phục thử'],
  ], [['vm', 'bs'], ['fsv', 'bs'], ['db', 'bs'], ['bs', 'rp', { label: 'Bản 2' }], ['bs', 'hr', { label: 'Immutable' }], ['rp', 'cl', { dash: 'dash', label: 'Bản 3 · ngoài site' }], ['hr', 'tp', { dash: 'dash', label: 'Hằng tháng' }], ['rp', 'lab', { dash: 'dot', label: 'Kiểm chứng' }]]),
  G(GE, 'ent-cloud-office', 'Văn phòng dùng cloud · không máy chủ', 'Cloud-first office', [
    plan(960, 40, ['Không có máy chủ tại văn phòng', 'Danh tính: Entra ID, đăng nhập một lần + MFA', 'Email, file, họp: Microsoft 365', 'Máy tính join Entra, quản lý bằng Intune', 'Conditional Access: chỉ máy đạt chuẩn mới vào dữ liệu', 'Mạng văn phòng chỉ cần Internet ổn định + Wi-Fi tốt', 'Hai đường Internet vì mọi thứ phụ thuộc cloud', 'Sao lưu M365 sang dịch vụ thứ ba']),
    zone('zo', 30, 250, 620, 260, 'VĂN PHÒNG · 192.168.10.0/24'),
    ['idp', 'identityProvider', 80, 30, 'ENTRA ID|Danh tính, SSO'], ['mfa', 'mfa', 240, 30, 'MFA'], ['m365', 'publicCloud', 400, 30, 'MICROSOFT 365|Mail, file, Teams'], ['bk', 'objectStorage', 560, 30, 'BACKUP M365|Dịch vụ thứ ba'], ['mdm', 'configMgmt', 760, 150, 'INTUNE|Quản lý thiết bị'],
    ['net', 'cloud', 380, 150, 'INTERNET|2 nhà mạng'],
    ['fw', 'firewall', 400, 290, 'FW|Lọc web, hai đường WAN'], ['sw', 'switch', 240, 290, 'SW-POE'], ['ap', 'ap', 80, 290, 'AP-VP|WPA3-Enterprise'],
    ['l1', 'laptop', 80, 420, 'LT-NV1|Join Entra'], ['l2', 'laptop', 240, 420, 'LT-NV2'], ['pr', 'printer', 400, 420, 'PRN|In qua cloud'], ['rm', 'laptop', 740, 420, 'LT-TuXa|Ở nhà, không cần VPN'],
  ], [['idp', 'mfa'], ['m365', 'net'], ['idp', 'net', { dash: 'dot' }], ['mdm', 'net', { dash: 'dot' }], ['m365', 'bk', { dash: 'dash', label: 'Sao lưu' }], ['net', 'fw', FO], ['fw', 'sw'], ['sw', 'ap'], ['ap', 'l1', WIFI], ['sw', 'l2'], ['sw', 'pr'], ['rm', 'net', { dash: 'dash', label: 'HTTPS + MFA' }]]),
  G(GS, 'sec-sase', 'Làm việc từ xa · ZTNA / SASE', 'Remote work · ZTNA / SASE', [
    plan(960, 40, ['Người dùng không vào thẳng mạng công ty', 'Mọi truy cập đi qua điểm kiểm soát trên cloud', 'ZTNA: cấp quyền theo từng ứng dụng, không theo dải mạng', 'SWG: lọc web · CASB: kiểm soát SaaS · DLP: chặn lộ dữ liệu', 'Connector trong DC chỉ kết nối ra, không mở cổng vào', 'Quyết định theo: danh tính + MFA + tình trạng thiết bị', 'Thay cho VPN cấp cả dải mạng']),
    zone('zs', 300, 120, 330, 380, 'SASE · ĐIỂM KIỂM SOÁT TRÊN CLOUD', PURPLE), zone('zd', 700, 290, 220, 220, 'TRUNG TÂM DỮ LIỆU', GREEN),
    ['u1', 'vpnClient', 50, 160, 'NV-O-NHA|Agent trên máy'], ['u2', 'mobile', 50, 300, 'NV-DIDONG'], ['u3', 'laptop', 50, 430, 'Nhà thầu|Trình duyệt, không agent'],
    ['idp', 'identityProvider', 440, 20, 'IDP|Danh tính + MFA'],
    ['zt', 'proxy', 340, 190, 'ZTNA|Theo từng ứng dụng'], ['swg', 'waf', 520, 190, 'SWG|Lọc web'], ['cas', 'dlp', 340, 370, 'CASB / DLP|Kiểm soát SaaS'], ['fwc', 'firewall', 520, 370, 'FWaaS'],
    ['saas', 'publicCloud', 740, 60, 'SaaS|M365, CRM'], ['web', 'cloud', 740, 170, 'WEB'], ['con', 'bridge', 730, 340, 'CONNECTOR|Chỉ kết nối ra'], ['app', 'server', 840, 420, 'APP nội bộ|ERP'],
  ], [['u1', 'zt', VPN], ['u2', 'zt', VPN], ['u3', 'zt', VPN], ['zt', 'idp', { dash: 'dot', label: 'Xác thực' }], ['zt', 'swg'], ['zt', 'cas'], ['swg', 'fwc'], ['swg', 'web'], ['cas', 'saas'], ['zt', 'con', { ...VPN, label: 'Tunnel do connector mở' }], ['con', 'app']]),
  G(GD, 'dc-active-active', 'Hai trung tâm dữ liệu chạy song song', 'Active-active data centers', [
    plan(960, 40, ['Cả hai DC cùng phục vụ; GSLB chia theo sức khoẻ và vị trí', 'Cùng dải IP công khai quảng bá BGP từ cả hai DC', 'Cơ sở dữ liệu sao chép đồng bộ: cần độ trễ < 5 ms', 'Hai DC cách nhau dưới khoảng 100 km', 'Witness ở site thứ ba phá thế hoà khi đứt đường nối', 'Mỗi DC phải chịu được 100% tải', 'RPO = 0, RTO tính bằng giây đến phút']),
    ['dca', 'datacenter', 20, 180, { w: 400, h: 330, label: 'DC-A' }], ['dcb', 'datacenter', 530, 180, { w: 400, h: 330, label: 'DC-B' }],
    ['u', 'user', 440, 0, 'Người dùng'], ['g', 'dnsServer', 440, 122, 'GSLB|Kiểm tra sức khoẻ 2 DC'], ['w', 'server', 640, 60, 'WITNESS|Site thứ ba'],
    ['fa', 'firewall', 40, 230, 'FW-A'], ['la', 'loadBalancer', 190, 230, 'LB-A'], ['aa', 'serverCluster', 340, 230, 'APP-A'], ['da', 'database', 340, 400, 'DB-A'], ['sa', 'nasArray', 150, 400, 'STORAGE-A'],
    ['fb', 'firewall', 860, 230, 'FW-B'], ['lb', 'loadBalancer', 705, 230, 'LB-B'], ['ab', 'serverCluster', 555, 230, 'APP-B'], ['db', 'database', 555, 400, 'DB-B'], ['sb', 'nasArray', 750, 400, 'STORAGE-B'],
  ], [['u', 'g'], ['g', 'fa', { dash: 'dash' }], ['g', 'fb', { dash: 'dash' }], ['fa', 'la'], ['la', 'aa'], ['aa', 'da'], ['da', 'sa'], ['fb', 'lb'], ['lb', 'ab'], ['ab', 'db'], ['db', 'sb'],
    ['da', 'db', { ...FO, label: 'Đồng bộ', width: 4 }], ['w', 'da', { dash: 'dot' }], ['w', 'db', { dash: 'dot' }]]),
  G(GC, 'ccna-portsec', 'CCNA · Port security', 'CCNA · Port security', [
    plan(720, 40, ['switchport mode access', 'switchport port-security', 'switchport port-security maximum 2', 'switchport port-security mac-address sticky', 'switchport port-security violation shutdown', 'Kiểm tra: show port-security interface Fa0/3', 'Khôi phục: shutdown rồi no shutdown'], 320),
    ['sw', 'switch', 280, 60, 'SW-ACC|Port security trên cổng người dùng'], ['up', 'l3switch', 500, 60, 'SW-CORE|Uplink: không bật port security'],
    ['p1', 'pc', 40, 60, 'PC1|MAC đã học (sticky)'], ['p2', 'phone', 60, 250, 'IP-Phone|MAC thứ 2 hợp lệ'], ['bad', 'laptop', 40, 420, 'Máy lạ|MAC thứ 3: vi phạm'], ['hub', 'hub', 280, 420, 'HUB|Cắm thêm trái phép'],
  ], [['sw', 'up', { mode: 'trunk', label: 'trunk' }], ['sw', 'p1', { label: 'Fa0/1 · secure-up' }], ['sw', 'p2', { label: 'Fa0/2' }], ['sw', 'hub', { color: RED, dash: 'dash', label: 'Fa0/3 · err-disabled' }], ['hub', 'bad', { color: RED }]]),
  G(GC, 'ccna-ospf-single', 'CCNA · OSPF một vùng', 'CCNA · Single-area OSPF', [
    plan(700, 40, ['Tất cả trong area 0', 'Router ID: lấy loopback (1.1.1.1, 2.2.2.2, 3.3.3.3)', 'Cost = 100 Mb/s ÷ băng thông (chỉnh auto-cost cho Gig)', 'R1 → mạng của R3: đi thẳng cost 10, vòng qua R2 cost 2', 'Link point-to-point: không bầu DR/BDR', 'Mạng LAN nhiều router: bầu DR/BDR theo priority', 'Kiểm tra: show ip ospf neighbor, show ip route ospf', 'passive-interface trên cổng nối người dùng'], 340),
    ['r1', 'router', 80, 60, 'R1|RID 1.1.1.1'], ['r2', 'router', 480, 60, 'R2|RID 2.2.2.2'], ['r3', 'router', 280, 280, 'R3|RID 3.3.3.3'],
    ['s1', 'switch', 80, 420, 'SW-LAN1|10.1.1.0/24'], ['s3', 'switch', 480, 420, 'SW-LAN3|10.3.3.0/24'], ['p1', 'pc', 240, 425, 'PC-A'], ['p3', 'pc', 620, 425, 'PC-B'],
  ], [['r1', 'r2', { ...FO, label: '10.0.12.0/30 · cost 1' }], ['r2', 'r3', { ...FO, label: '10.0.23.0/30 · cost 1' }], ['r1', 'r3', { label: '10.0.13.0/30 · cost 10' }], ['r1', 's1', { label: 'passive' }], ['r3', 's3', { label: 'passive' }], ['s1', 'p1'], ['s3', 'p3']]),
  G(GC, 'ccna-qos', 'CCNA · QoS: đánh dấu và hàng đợi', 'CCNA · QoS marking and queuing', [
    plan(60, 330, ['Phân loại và đánh dấu sát nguồn (cổng access)', 'Thoại: EF (DSCP 46) · Hàng đợi ưu tiên (LLQ)', 'Video họp: AF41 · Dữ liệu quan trọng: AF21', 'Còn lại: best effort (DSCP 0)', 'Ranh giới tin cậy: tin điện thoại, không tin PC', 'Nghẽn xảy ra ở cổng WAN: xếp hàng tại đó', 'Policing: cắt phần vượt · Shaping: giữ lại, gửi chậm hơn'], 420),
    ['ph', 'phone', 50, 60, 'IP-Phone|Đánh dấu EF'], ['pc', 'pc', 40, 200, 'PC|Bị ghi lại về 0'], ['sw', 'switch', 240, 130, 'SW-ACC|Ranh giới tin cậy'], ['r', 'router', 460, 130, 'R-WAN|LLQ + CBWFQ, shaping'], ['wan', 'cloud', 660, 120, 'WAN 20 Mb/s|Điểm nghẽn'], ['r2', 'router', 860, 130, 'R-HQ|Tin DSCP'],
    ['q', 'table', 620, 330, { label: 'Ưu tiên · Thoại · 10%\nAF41 · Video · 30%\nAF21 · ERP · 25%\nMặc định · 35%', w: 300, h: 110 }],
  ], [['ph', 'sw', { label: 'Tin DSCP' }], ['pc', 'sw', { label: 'Không tin' }], ['sw', 'r', { mode: 'trunk', label: 'trunk' }], ['r', 'wan'], ['wan', 'r2']]),
);
TEMPLATES.push(
  // ----- Hạ tầng vật lý
  G(GP, 'phys-rack', 'Tủ rack · bố trí thiết bị và nguồn', 'Rack layout and power', [
    plan(960, 30, ['Thiết bị nặng (UPS, storage) đặt dưới đáy tủ', 'Patch panel trên cùng, switch ngay dưới, chừa 1U đi cáp', 'Mỗi máy chủ 2 nguồn: một vào PDU-A, một vào PDU-B', 'PDU-A và PDU-B lấy từ hai UPS khác nhau', 'Chừa 20–30% số U cho mở rộng', 'Luồng khí: hút lạnh mặt trước, xả nóng mặt sau', 'Dán nhãn hai đầu mỗi sợi cáp; sơ đồ tủ dán ở cửa']),
    zone('ra', 40, 20, 290, 510, 'RACK A · MẠNG · 42U', GRAY), zone('rb', 380, 20, 290, 510, 'RACK B · MÁY CHỦ · 42U', GRAY),
    ['pp', 'patchPanel', 150, 60, 'PP-01|U42 · cáp về các tầng'], ['fw', 'firewall', 152, 155, 'FW|U38'], ['core', 'l3switch', 146, 250, 'SW-CORE|U36'], ['acc', 'switch', 146, 345, 'SW-ACC|U34'], ['ua', 'ups', 150, 435, 'UPS-A|U1–U4'],
    ['tor', 'switch', 490, 60, 'SW-TOR|U42'], ['h1', 'server', 504, 150, 'ESXi-01|U30–U31'], ['h2', 'server', 504, 250, 'ESXi-02|U28–U29'], ['st', 'nasArray', 494, 350, 'STORAGE|U10–U13'], ['ub', 'ups', 494, 435, 'UPS-B|U1–U4'],
    ['pa', 'pdu', 760, 60, 'PDU-A|Nguồn A'], ['pb', 'pdu', 760, 170, 'PDU-B|Nguồn B'], ['ac', 'precisionCooling', 760, 280, 'CRAC|Lạnh chính xác'], ['tp', 'temperatureSensor', 760, 380, 'TEMP|Cảnh báo > 27 °C'], ['kv', 'kvm', 760, 470, 'KVM'],
  ], [['core', 'tor', { ...FO, label: '2 × 10G' }], ['pa', 'h1', { dash: 'dot', label: 'Nguồn A' }], ['pb', 'h2', { dash: 'dot', label: 'Nguồn B' }], ['tp', 'ac', { dash: 'dot' }], ['kv', 'st', { dash: 'dot' }]]),
  G(GP, 'phys-floor', 'Mặt bằng cáp · MDF và IDF các tầng', 'Cabling plan · MDF and IDFs', [
    plan(960, 30, ['MDF: phòng kỹ thuật chính, nơi cáp nhà mạng đi vào', 'IDF: tủ tầng, mỗi tầng một tủ', 'Trục đứng: cáp quang OM4, mỗi tầng 2 đôi sợi (1 dự phòng)', 'Cáp ngang: Cat6, tối đa 90 m + 10 m dây nhảy', 'Số ổ tường trùng số cổng trên patch panel', 'AP lấy nguồn PoE qua chính cáp ngang', 'Phòng kỹ thuật khoá, có điều hoà và UPS']),
    zone('z3', 30, 20, 880, 145, 'TẦNG 3 · IDF-3', GRAY), zone('z2', 30, 180, 880, 145, 'TẦNG 2 · IDF-2', GRAY), zone('z1', 30, 340, 880, 170, 'TẦNG 1 · MDF', ORANGE),
    ['p3', 'pc', 60, 65, 'PC-T3|Ổ tường T3-017'], ['i3', 'switch', 240, 65, 'SW-T3|48 cổng PoE'], ['pp3', 'patchPanel', 440, 65, 'PP-T3|48 cổng'], ['a3', 'ap', 660, 65, 'AP-T3|Ổ trần T3-A02'],
    ['p2', 'pc', 60, 225, 'PC-T2|Ổ tường T2-009'], ['i2', 'switch', 240, 225, 'SW-T2|48 cổng PoE'], ['pp2', 'patchPanel', 440, 225, 'PP-T2|48 cổng'], ['a2', 'ap', 660, 225, 'AP-T2|Ổ trần T2-A01'],
    ['isp', 'cloud', 40, 390, 'NHÀ MẠNG|Cáp quang vào toà nhà'], ['fw', 'firewall', 250, 400, 'FW'], ['core', 'l3switch', 470, 400, 'SW-CORE|MDF'], ['srv', 'server', 700, 395, 'SRV|Phòng máy chủ'],
  ], [['isp', 'fw', FO], ['fw', 'core'], ['core', 'srv'], ['core', 'i3', { ...FO, label: 'Trục đứng' }], ['core', 'i2', FO],
    ['i3', 'pp3', { label: 'Dây nhảy' }], ['pp3', 'a3', { label: 'Cáp ngang ≤ 90 m' }], ['i3', 'p3'], ['i2', 'pp2'], ['pp2', 'a2'], ['i2', 'p2']]),
  G(GP, 'phys-oob', 'Quản trị ngoài băng · console server', 'Out-of-band management', [
    plan(960, 30, ['Đường quản trị tách khỏi mạng người dùng', 'Console server nối cổng serial của từng thiết bị', 'Mạng chính chết vẫn vào được qua 4G', 'Cổng mgmt của thiết bị nằm trong VRF riêng', 'Mọi phiên đi qua jump host, có ghi lại thao tác', 'Dùng khi nâng cấp IOS, khôi phục mật khẩu, cấu hình sai']),
    ['r', 'router', 40, 30, 'R-EDGE'], ['fw', 'firewall', 42, 155, 'FW'], ['core', 'l3switch', 36, 280, 'SW-CORE'], ['acc', 'switch', 36, 410, 'SW-ACC'],
    ['cs', 'consoleServer', 320, 155, 'CONSOLE SERVER|Cổng serial tới từng thiết bị'], ['ms', 'switch', 316, 410, 'SW-MGMT|Cổng mgmt riêng'],
    ['lte', 'cellTower', 560, 155, '4G|Đường vào độc lập'], ['j', 'bastion', 560, 410, 'JUMP|Ghi lại thao tác'], ['adm', 'vpnClient', 800, 280, 'Quản trị viên'],
  ], [['r', 'cs', { dash: 'dash' }], ['fw', 'cs', { dash: 'dash', label: 'Console' }], ['core', 'cs', { dash: 'dash' }], ['acc', 'ms'], ['core', 'ms'],
    ['cs', 'lte'], ['ms', 'j'], ['lte', 'adm', { dash: 'dash', label: 'Khi mạng chính chết' }], ['j', 'adm', VPN]]),
  // ----- Nhà mạng & WAN
  G(GW, 'sp-mpls', 'Nhà mạng · lõi MPLS, PE, CE', 'Service provider · MPLS core', [
    plan(1000, 30, ['P: chỉ chuyển theo nhãn, không biết route của khách', 'PE: giữ VRF từng khách, gắn 2 nhãn (vận chuyển + VPN)', 'CE: router của khách, chạy eBGP, OSPF hoặc static với PE', 'IGP trong lõi: IS-IS, phân nhãn bằng LDP hoặc Segment Routing', 'MP-BGP VPNv4 giữa các PE, qua route reflector', 'RD làm route của mỗi khách là duy nhất', 'RT quyết định VRF nào nhập, xuất route nào', 'Khách A và B dùng trùng dải 10.0.0.0/8 vẫn không lẫn']),
    ['rr', 'router', 468, 10, 'RR|Route reflector'],
    ['p1', 'router', 370, 150, 'P1'], ['p2', 'router', 570, 150, 'P2'], ['p3', 'router', 370, 330, 'P3'], ['p4', 'router', 570, 330, 'P4'],
    ['e1', 'router', 190, 150, 'PE1|VRF A, VRF B'], ['e2', 'router', 190, 330, 'PE2|VRF B'], ['e3', 'router', 750, 150, 'PE3|VRF A'], ['e4', 'router', 750, 330, 'PE4|VRF B'],
    ['c1', 'router', 10, 60, 'CE-A1|Khách A · HQ'], ['c2', 'router', 10, 420, 'CE-B1|Khách B · HQ'], ['c3', 'router', 900, 60, 'CE-A2|Khách A · CN'], ['c4', 'router', 900, 420, 'CE-B2|Khách B · CN'],
  ], [['p1', 'p2', FO], ['p3', 'p4', FO], ['p1', 'p3', FO], ['p2', 'p4', FO], ['e1', 'p1', FO], ['e2', 'p3', FO], ['e3', 'p2', FO], ['e4', 'p4', FO],
    ['rr', 'p1', { dash: 'dot' }], ['rr', 'p2', { dash: 'dot' }], ['c1', 'e1'], ['c2', 'e2'], ['c3', 'e3'], ['c4', 'e4']]),
  G(GW, 'sp-ftth', 'Nhà mạng · FTTH GPON', 'Service provider · FTTH GPON', [
    plan(1000, 30, ['GPON: một sợi quang chia tối đa 64 thuê bao, xa 20 km', 'Xuống 2,5 Gb/s (1490 nm), lên 1,25 Gb/s (1310 nm)', 'Chiều lên chia khe thời gian, OLT cấp phát cho từng ONT', 'Splitter thụ động, không cần nguồn điện', 'Mỗi dịch vụ một VLAN: Internet, IPTV, thoại', 'BNG kết thúc PPPoE, cấp IP, áp tốc độ theo gói cước', 'Thiếu IPv4 công khai thì dùng CGNAT']),
    ['h1', 'ont', 20, 70, 'ONT-Nhà 1'], ['h2', 'ont', 20, 200, 'ONT-Nhà 2'], ['h3', 'ont', 20, 330, 'ONT-Nhà 3'],
    ['sp', 'splitter', 200, 200, 'SPLITTER|1:32, thụ động'], ['olt', 'olt', 380, 200, 'OLT|Cổng PON'], ['agg', 'l3switch', 560, 200, 'AGG|Metro Ethernet'], ['bng', 'router', 750, 200, 'BNG|PPPoE, cấp IP, QoS'],
    ['core', 'router', 750, 40, 'CORE|BGP'], ['net', 'cloud', 880, 180, 'INTERNET|Peering, transit'], ['rad', 'server', 760, 380, 'RADIUS|Xác thực thuê bao'], ['tv', 'server', 570, 380, 'IPTV|Multicast'],
  ], [['h1', 'sp', FO], ['h2', 'sp', FO], ['h3', 'sp', FO], ['sp', 'olt', FO], ['olt', 'agg', FO], ['agg', 'bng'], ['bng', 'core'], ['core', 'net', FO], ['bng', 'rad'], ['agg', 'tv']]),
  // ----- Doanh nghiệp
  G(GE, 'ent-bank', 'Ngân hàng · chi nhánh và ATM', 'Bank · branch and ATM', [
    plan(960, 30, ['Hai nhà mạng MPLS độc lập, hai router ở mỗi đầu', 'Giao dịch vẫn mã hoá IPsec dù đi trên MPLS', 'ATM ở VLAN riêng, chỉ nói chuyện với hệ thống thẻ ở DC', 'Mã PIN mã hoá ngay tại bàn phím ATM, chỉ HSM giải được', 'Vùng dữ liệu thẻ tách riêng theo PCI DSS', 'Đứt một đường WAN: chuyển đường dưới 1 phút', 'Mọi thay đổi cấu hình qua quy trình duyệt, có ghi log']),
    zone('zd', 20, 30, 300, 480, 'TRUNG TÂM DỮ LIỆU'), zone('zb', 620, 30, 300, 480, 'CHI NHÁNH', GREEN),
    ['cb', 'database', 50, 90, 'CORE BANKING'], ['hsm', 'hsm', 50, 250, 'HSM|Khoá mã hoá PIN'], ['fw', 'firewall', 210, 170, 'FW-DC|Active/Standby'], ['r', 'router', 208, 380, 'R-DC|Hai nhà mạng'],
    ['m1', 'mplsCloud', 430, 110, 'MPLS-A'], ['m2', 'mplsCloud', 430, 380, 'MPLS-B'],
    ['b1', 'router', 650, 110, 'R-CN1'], ['b2', 'router', 650, 380, 'R-CN2'], ['sw', 'switch', 820, 245, 'SW-CN|VLAN giao dịch, ATM, camera'], ['gd', 'pc', 826, 90, 'PC-GDV|Giao dịch viên'], ['atm', 'atm', 824, 410, 'ATM-CN|VLAN riêng'],
  ], [['cb', 'fw'], ['hsm', 'fw', { dash: 'dot' }], ['fw', 'r'], ['r', 'm1', FO], ['r', 'm2', FO], ['m1', 'b1', FO], ['m2', 'b2', FO], ['b1', 'sw'], ['b2', 'sw'], ['sw', 'gd'], ['sw', 'atm']]),
  G(GE, 'ent-multitenant', 'Toà nhà văn phòng cho thuê', 'Multi-tenant office building', [
    plan(960, 30, ['Toà nhà cấp Internet và trục cáp; khách thuê tự quản mạng bên trong', 'Mỗi khách một VLAN và VRF riêng, không định tuyến qua nhau', 'Khách thuê đặt firewall riêng sau điểm bàn giao', 'Băng thông cam kết theo hợp đồng, giới hạn tại core', 'Wi-Fi sảnh, camera, thang máy của toà nhà ở VLAN riêng', 'Phòng MDF khoá; chỉ kỹ thuật toà nhà được vào']),
    zone('ta', 20, 350, 290, 170, 'CÔNG TY A · VLAN 110'), zone('tb', 330, 350, 290, 170, 'CÔNG TY B · VLAN 120', GREEN), zone('tc', 640, 350, 290, 170, 'CÔNG TY C · VLAN 130', ORANGE),
    ['net', 'cloud', 420, 0, 'INTERNET|2 nhà mạng'], ['bf', 'firewall', 445, 128, 'FW-TOANHA'], ['core', 'l3switch', 439, 255, 'SW-CORE|Mỗi khách thuê một VRF'],
    ['fa', 'firewall', 40, 400, 'FW-A'], ['sa', 'switch', 205, 405, 'SW-A'], ['fb', 'firewall', 350, 400, 'FW-B'], ['sb', 'switch', 515, 405, 'SW-B'], ['fc', 'firewall', 660, 400, 'FW-C'], ['sc', 'switch', 825, 405, 'SW-C'],
  ], [['net', 'bf', FO], ['bf', 'core'], ['core', 'fa'], ['core', 'fb'], ['core', 'fc'], ['fa', 'sa'], ['fb', 'sb'], ['fc', 'sc']]),
  // ----- Hệ thống & dịch vụ
  G(GY, 'sys-pki', 'PKI hai tầng · Root CA và Issuing CA', 'Two-tier PKI', [
    plan(960, 30, ['Root CA: tắt máy, không nối mạng, chỉ bật để ký CA cấp dưới', 'Issuing CA: cấp chứng chỉ hằng ngày, tự động theo template', 'Thu hồi: công bố CRL hoặc trả lời qua OCSP', 'Máy trạm tin Root CA nhờ Group Policy', 'Thời hạn: Root 20 năm, Issuing 10 năm, máy và người 1–2 năm', 'Mất khoá riêng của Root CA là phải dựng lại toàn bộ PKI']),
    ['root', 'server', 70, 50, 'ROOT CA|Offline, cất trong két'], ['ca', 'server', 330, 50, 'ISSUING CA|Online, join domain'], ['crl', 'webServer', 590, 55, 'CRL / OCSP|Công bố thu hồi'], ['hsm', 'hsm', 800, 55, 'HSM|Giữ khoá riêng của CA'],
    ['web', 'webServer', 60, 350, 'WEB|Chứng chỉ TLS'], ['vpn', 'vpnGateway', 240, 350, 'VPN-GW|Chứng chỉ máy'], ['wf', 'ap', 424, 352, 'AP|EAP-TLS'], ['u', 'laptop', 600, 353, 'Laptop|Chứng chỉ người dùng'], ['sc', 'mfa', 780, 350, 'Smart card|Đăng nhập'],
  ], [['root', 'ca', { dash: 'dash', label: 'Ký một lần' }], ['ca', 'crl'], ['crl', 'hsm', { dash: 'dot' }], ['ca', 'web', { dash: 'dot' }], ['ca', 'vpn', { dash: 'dot' }], ['ca', 'wf', { dash: 'dot' }], ['ca', 'u', { dash: 'dot' }], ['ca', 'sc', { dash: 'dot' }]]),
  G(GY, 'sys-email', 'Email · đường đi và các lớp lọc', 'Email flow and filtering', [
    plan(960, 30, ['MX trỏ về mail gateway, không trỏ thẳng về máy chủ hộp thư', 'SPF: IP gửi có được tên miền cho phép không', 'DKIM: chữ ký số chứng minh thư không bị sửa', 'DMARC: bảo bên nhận làm gì khi SPF, DKIM thất bại', 'Tệp đính kèm lạ được mở thử trong sandbox', 'Chỉ cho relay với người dùng đã xác thực', 'Lưu trữ thư tách khỏi hộp thư, giữ theo quy định']),
    ['snd', 'mailServer', 30, 200, 'MAIL bên gửi'], ['net', 'cloud', 190, 190, 'INTERNET'], ['dns', 'dnsServer', 210, 30, 'DNS|MX, SPF, DKIM, DMARC'],
    ['gw', 'proxy', 400, 200, 'MAIL GATEWAY|Chống spam, virus, lừa đảo'], ['sbx', 'virtualMachine', 400, 380, 'SANDBOX|Mở thử tệp đính kèm'],
    ['mx', 'mailServer', 590, 200, 'MAIL SERVER|Hộp thư'], ['ar', 'nas', 590, 380, 'ARCHIVE|Lưu trữ, sao lưu'], ['pc', 'laptop', 790, 120, 'Outlook'], ['mb', 'mobile', 790, 300, 'Điện thoại'],
  ], [['snd', 'net'], ['net', 'gw', { label: 'SMTP 25' }], ['gw', 'dns', { dash: 'dot', label: 'Kiểm SPF, DKIM' }], ['gw', 'sbx', { dash: 'dot' }], ['gw', 'mx'], ['mx', 'ar'], ['mx', 'pc'], ['mx', 'mb']]),
  G(GY, 'sys-monitoring', 'Giám sát hạ tầng · SNMP, agent, cảnh báo', 'Infrastructure monitoring', [
    plan(960, 30, ['Thiết bị mạng: SNMPv3 · Máy chủ: agent', 'Lấy số liệu 1–5 phút một lần; trap và syslog cho sự kiện tức thì', 'Ngưỡng dựa trên mức bình thường, có độ trễ chống báo dao động', 'Phụ thuộc: router chết thì không báo 50 máy sau nó', 'Không ai nhận trong 15 phút thì leo thang', 'Giữ số liệu chi tiết 30 ngày, số liệu gộp 1 năm', 'Giám sát cả chính hệ thống giám sát']),
    ['sw', 'switch', 40, 30, 'SW|SNMPv3'], ['fw', 'firewall', 46, 150, 'FW|SNMP, syslog'], ['lx', 'server', 54, 270, 'Linux|Agent'], ['wn', 'virtualMachine', 44, 400, 'Windows|Agent'],
    ['mon', 'monitor', 330, 210, 'MÁY CHỦ GIÁM SÁT|Zabbix, PRTG'], ['px', 'monitor', 330, 400, 'PROXY|Thu ở chi nhánh'],
    ['db', 'timeSeriesDb', 570, 60, 'DB|Lịch sử, xu hướng'], ['da', 'dashboard', 570, 210, 'DASHBOARD'], ['al', 'alert', 570, 370, 'CẢNH BÁO'], ['oc', 'onCall', 790, 370, 'TRỰC|Telegram, email, SMS'],
  ], [['sw', 'mon'], ['fw', 'mon'], ['lx', 'mon'], ['wn', 'px'], ['px', 'mon', { dash: 'dash' }], ['mon', 'db'], ['mon', 'da'], ['mon', 'al'], ['al', 'oc', { label: 'Leo thang' }]]),
  G(GY, 'sys-vsphere', 'Cụm ảo hoá · 3 host, lưu trữ chung', 'Virtualization cluster', [
    plan(960, 30, ['Mỗi host 2 uplink vào 2 switch khác nhau', 'Tách VLAN: quản trị, vMotion, lưu trữ, máy ảo', 'HA: host chết thì máy ảo bật lại trên host khác', 'DRS: tự cân tải bằng vMotion', 'N+1: 3 host nhưng chỉ dùng tối đa khoảng 66% tài nguyên', 'vCenter hỏng thì máy ảo vẫn chạy, chỉ mất quản lý tập trung', 'Datastore dùng chung để vMotion và HA hoạt động']),
    ['t1', 'switch', 150, 30, 'SW-TOR1'], ['t2', 'switch', 450, 30, 'SW-TOR2'], ['vc', 'virtualMachine', 760, 30, 'vCENTER|Quản lý cụm'],
    ['h1', 'server', 80, 220, 'ESXi-01'], ['h2', 'server', 320, 220, 'ESXi-02'], ['h3', 'server', 560, 220, 'ESXi-03'],
    ['st', 'nasArray', 310, 420, 'STORAGE DÙNG CHUNG|2 controller'], ['bk', 'backupServer', 610, 420, 'BACKUP'],
  ], [['t1', 't2', { label: 'MLAG', width: 4 }], ['t1', 'h1'], ['t1', 'h2'], ['t1', 'h3', { dash: 'dash' }], ['t2', 'h1', { dash: 'dash' }], ['t2', 'h2', { dash: 'dash' }], ['t2', 'h3'], ['t2', 'vc'],
    ['h1', 'st', FO], ['h2', 'st', FO], ['h3', 'st', FO], ['st', 'bk', { dash: 'dot' }]]),
  // ----- Bảo mật
  G(GS, 'sec-nac', 'NAC · 802.1X, gán VLAN theo thiết bị', 'NAC · 802.1X and dynamic VLAN', [
    plan(960, 30, ['802.1X: xác thực xong cổng mới mở', 'MAB cho thiết bị không có supplicant, gán VLAN hẹp', 'Posture: kiểm antivirus và bản vá trước khi cho vào', 'RADIUS trả về VLAN hoặc ACL theo nhóm người dùng', 'Triển khai dần: chỉ theo dõi → hạn chế nhẹ → đóng hẳn', 'Mất hết RADIUS: cổng rơi vào VLAN tới hạn']),
    ['c', 'laptop', 40, 40, 'LT-CongTy|Chứng chỉ máy'], ['b', 'mobile', 40, 170, 'BYOD|Máy cá nhân'], ['p', 'printer', 44, 300, 'PRN|Không có supplicant'], ['g', 'tablet', 40, 430, 'Khách'],
    ['sw', 'switch', 260, 170, 'SW-ACC|802.1X + MAB'], ['ap', 'ap', 268, 400, 'AP|WPA2-Enterprise'],
    ['n', 'nac', 500, 170, 'NAC|Chính sách truy cập'], ['ad', 'identityProvider', 740, 40, 'AD|Người dùng, nhóm'], ['pk', 'vault', 740, 170, 'CA|Chứng chỉ máy'],
    ['q', 'table', 470, 330, { label: 'Máy công ty + người dùng hợp lệ → VLAN 10\nBYOD → VLAN 30, chỉ ra Internet\nMáy in (MAB) → VLAN 50\nKhách → VLAN 100 + portal\nKhông đạt chuẩn → VLAN cách ly', w: 400, h: 130 }],
  ], [['c', 'sw'], ['p', 'sw'], ['b', 'ap', WIFI], ['g', 'ap', WIFI], ['sw', 'n', { label: 'RADIUS' }], ['ap', 'n', { dash: 'dash' }], ['n', 'ad'], ['n', 'pk', { dash: 'dot' }]]),
  G(GS, 'sec-dual-fw', 'DMZ hai lớp firewall', 'Dual-firewall DMZ', [
    plan(960, 30, ['Hai firewall của hai hãng khác nhau', 'FW ngoài: chỉ cho Internet vào DMZ, cổng 443 và 25', 'FW trong: chỉ cho DMZ vào đúng máy chủ, đúng cổng', 'Không có luật nào cho Internet đi thẳng vào Inside', 'Máy chủ DMZ bị chiếm vẫn còn một lớp chặn nữa', 'Inside ra Internet qua proxy đặt trong DMZ', 'Log của cả hai firewall gửi về SIEM']),
    zone('z', 350, 20, 290, 480, 'DMZ · 172.16.0.0/24', ORANGE),
    ['net', 'cloud', 10, 200, 'INTERNET'], ['fo', 'firewall', 200, 210, 'FW-NGOAI|Hãng A'],
    ['sd', 'switch', 440, 214, 'SW-DMZ'], ['w', 'webServer', 380, 60, 'WEB'], ['px', 'proxy', 530, 60, 'PROXY|Cho Inside ra web'], ['mg', 'mailServer', 444, 390, 'MAIL GW'],
    ['fi', 'firewall', 700, 210, 'FW-TRONG|Hãng B'], ['core', 'l3switch', 840, 211, 'SW-CORE'], ['ad', 'server', 854, 40, 'AD'], ['db', 'database', 844, 390, 'DB'],
  ], [['net', 'fo', FO], ['fo', 'sd'], ['sd', 'w'], ['sd', 'px'], ['sd', 'mg'], ['sd', 'fi'], ['fi', 'core'], ['core', 'ad'], ['core', 'db']]),
  // ----- Cloud và Kubernetes
  G(GD, 'cloud-hub-spoke', 'Cloud · landing zone hub–spoke', 'Cloud · Hub-and-spoke landing zone', [
    plan(960, 30, ['Hub chứa phần dùng chung: kết nối về on-premise, firewall, DNS', 'Mỗi ứng dụng hoặc môi trường một spoke riêng', 'Spoke không nối thẳng với nhau; mọi luồng đi qua hub', 'Firewall ở hub kiểm tra lưu lượng giữa các spoke và ra Internet', 'Production và Dev ở tài khoản, subscription khác nhau', 'Chính sách và nhật ký đặt ở cấp tổ chức', 'Dải IP quy hoạch trước để không trùng với on-premise']),
    ['op', 'datacenter', 20, 150, { w: 230, h: 230, label: 'On-premise · 10.0.0.0/16' }], ['hub', 'vpc', 330, 150, { w: 270, h: 230, label: 'HUB · 10.100.0.0/22' }],
    ['s1', 'vpc', 690, 20, { w: 230, h: 150, label: 'Spoke Prod · 10.101.0.0/22' }], ['s2', 'vpc', 690, 190, { w: 230, h: 150, label: 'Spoke Dev · 10.102.0.0/22' }], ['s3', 'vpc', 690, 360, { w: 230, h: 150, label: 'Spoke Shared · 10.103.0.0/22' }],
    ['core', 'l3switch', 90, 240, 'SW-CORE'], ['vg', 'siteToSiteVpn', 360, 240, 'VPN / ĐƯỜNG RIÊNG'], ['fw', 'networkAcl', 500, 240, 'FIREWALL|Kiểm tra mọi luồng'],
    ['a', 'vm', 770, 70, 'APP-PROD'], ['d', 'vm', 770, 240, 'APP-DEV'], ['sh', 'vault', 770, 410, 'DNS, AD, LOG'],
  ], [['core', 'vg', { ...VPN, label: 'Hai đường' }], ['vg', 'fw'], ['fw', 'a'], ['fw', 'd'], ['fw', 'sh']]),
  G(GA, 'k8s-ha', 'Kubernetes · control plane dự phòng', 'Kubernetes · HA control plane', [
    plan(960, 30, ['3 control plane: etcd cần đa số (2 trên 3) mới ghi được', 'Mất 1 node vẫn chạy; mất 2 thì cụm chỉ còn đọc', 'API server đứng sau một VIP; kubelet và kubectl gọi VIP đó', 'Control plane có taint, không chạy ứng dụng', 'Sao lưu etcd định kỳ và để ngoài cụm', 'Worker rải trên nhiều zone hoặc nhiều tủ rack', 'Nâng cấp lần lượt từng node, control plane trước']),
    ['c', 'clusterBoundary', 160, 110, { w: 720, h: 320, label: 'Cluster' }],
    ['adm', 'developer', 30, 10, 'kubectl'], ['lb', 'loadBalancer', 480, 10, 'API VIP|Cổng 6443'], ['u', 'user', 30, 460, 'Người dùng'], ['ig', 'ingressController', 480, 460, 'INGRESS'],
    ['m1', 'node', 240, 150, 'CP-1|apiserver, etcd'], ['m2', 'node', 480, 150, 'CP-2|apiserver, etcd'], ['m3', 'node', 720, 150, 'CP-3|apiserver, etcd'],
    ['w1', 'node', 240, 320, 'WORKER-1'], ['w2', 'node', 480, 320, 'WORKER-2'], ['w3', 'node', 720, 320, 'WORKER-3'],
  ], [['adm', 'lb'], ['lb', 'm1'], ['lb', 'm2'], ['lb', 'm3'], ['m1', 'm2', { dash: 'dot', label: 'etcd' }], ['m2', 'm3', { dash: 'dot', label: 'etcd' }],
    ['w1', 'm1', { dash: 'dash' }], ['w2', 'm2', { dash: 'dash' }], ['w3', 'm3', { dash: 'dash' }], ['ig', 'w1'], ['ig', 'w2'], ['ig', 'w3'], ['u', 'ig']]),
);
