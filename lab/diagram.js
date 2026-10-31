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
for (const t of ['waf', 'proxy', 'bastion', 'nac', 'dlp', 'siem', 'mfa', 'identityProvider', 'vpnClient']) SHAPES[t].group = 'security';
for (const t of ['patchPanel', 'pdu', 'kvm', 'precisionCooling', 'temperatureSensor', 'smokeSensor', 'doorAccess', 'tapeLibrary', 'backupServer', 'nasArray']) SHAPES[t].group = 'physical';
for (const t of ['monitor', 'logging', 'tracing', 'alert', 'dashboard', 'iac', 'configMgmt', 'onCall']) SHAPES[t].group = 'ops';
for (const t of ['browser', 'mobileApp', 'microservice', 'frontend', 'backend', 'developer']) SHAPES[t].group = 'app';
for (const t of ['triangle', 'hexagon', 'cylinder', 'star', 'callout', 'table', 'lock', 'blockArrow']) SHAPES[t].connectable = false;
// Tên mặc định phải ngắn để không đè sang hình bên cạnh.
const SHORT_PREFIX = { dashboard: 'DASH', replication: 'REPL', homeRouter: 'HR', loadBalancer: 'LB', idsIps: 'IPS', vpnGateway: 'VPN-GW', ipPbx: 'PBX', webServer: 'WEB', mailServer: 'MAIL', dnsServer: 'DNS', dhcpServer: 'DHCP', database: 'DB', virtualMachine: 'VM', serverCluster: 'CLUSTER', television: 'TV', building: 'SITE', cellTower: 'CELL', satellite: 'SAT', publicCloud: 'CLOUD', mplsCloud: 'MPLS', repeater: 'REP', mediaConverter: 'MC', sdwanEdge: 'SDWAN', wirelessController: 'WC', patchPanel: 'PP', precisionCooling: 'CRAC', temperatureSensor: 'TEMP', smokeSensor: 'SMOKE', doorAccess: 'DOOR', identityProvider: 'IDP', vpnClient: 'VPNC', containerImage: 'IMG', container: 'CTR', registry: 'REG', namespace: 'NS', deployment: 'DEPLOY', service: 'SVC', configSecret: 'SECRET', gitRepo: 'REPO', gitBranch: 'BRANCH', mergeRequest: 'MR', autoscaling: 'ASG', function: 'FN', apiGateway: 'API', objectStorage: 'OBJ', blockStorage: 'BLK', sqlDatabase: 'SQL', nosqlDatabase: 'NOSQL', timeSeriesDb: 'TSDB', configMgmt: 'CM', mobileApp: 'APP', microservice: 'MS', developer: 'DEV', helmChart: 'HELM', ingressController: 'INGC', serviceMesh: 'MESH', imageScanner: 'SCAN', objectBucket: 'BUCKET', natGateway: 'NAT', internetGateway: 'IGW', vpcPeering: 'PEER', privateLink: 'PL', transitGateway: 'TGW', routeTable: 'RT', networkAcl: 'NACL', cloudAccount: 'ACCOUNT', siteToSiteVpn: 'S2S', sanSwitch: 'SAN', tapeLibrary: 'TAPE', backupServer: 'BACKUP', nasArray: 'NAS-A', secretsManager: 'SECRETS' };
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
  pod: `<rect x="7" y="6" width="50" height="40" rx="9" fill="#f5f3ff" stroke="#7c3aed" stroke-width="2"/>${[14, 34].map((xx) => `<rect x="${xx}" y="15" width="16" height="22" rx="2" fill="#ddd6fe" stroke="#7c3aed" stroke-width="1.5"/>${line(`M${xx + 5} 19v14M${xx + 11} 19v14`, '#8b5cf6', 1.4)}`).join('')}`,
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
function drawIcon(s) {
  if (ART[s.t]) return ART[s.t];
  const { x, y, w, h } = s, cx = x + w / 2, cy = y + h / 2, f = esc(s.fill), st = esc(s.stroke);
  const box = (rx = s.radius ?? 6) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" stroke="${st}" stroke-width="2"/>`;
  const metal = '#f1f5f9', screen = '#dbeafe', dark = '#eef2f7', deviceDefs = '';
  switch (s.t) {
    case 'router': return `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${f}" stroke="${st}" stroke-width="2"/>` +
      `<path d="M${cx - w * 0.28} ${cy - h * 0.18}l${w * 0.16} ${h * 0.12}M${cx + w * 0.28} ${cy - h * 0.18}l${-w * 0.16} ${h * 0.12}M${cx - w * 0.28} ${cy + h * 0.18}l${w * 0.16} ${-h * 0.12}M${cx + w * 0.28} ${cy + h * 0.18}l${-w * 0.16} ${-h * 0.12}" stroke="${st}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'switch': case 'l3switch': return box(4) +
      `<path d="M${x + w * 0.22} ${cy - h * 0.14}h${w * 0.5}m-${w * 0.1} -${h * 0.1}l${w * 0.1} ${h * 0.1}l-${w * 0.1} ${h * 0.1}M${x + w * 0.78} ${cy + h * 0.14}h-${w * 0.5}m${w * 0.1} -${h * 0.1}l-${w * 0.1} ${h * 0.1}l${w * 0.1} ${h * 0.1}" fill="none" stroke="${st}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      (s.t === 'l3switch' ? `<text x="${x + w - 5}" y="${y + 11}" text-anchor="end" font-size="9" font-weight="700" fill="${st}">L3</text>` : '');
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
    case 'wlc': return box(4) + `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${st}">WLC</text>`;
    case 'homeRouter': return deviceDefs+`<path d="M${x+13} ${y+24}L${x+9} ${y+3}M${x+w-13} ${y+24}L${x+w-9} ${y+3}" stroke="#64748b" stroke-width="2.2" stroke-linecap="round"/><path d="M${x+4} ${y+24}q${w/2-4}-12 ${w-8} 0v15q0 5-5 5H${x+9}q-5 0-5-5z" fill="${metal}" stroke="#475569" stroke-width="2"/><path d="M${cx-12} ${cy-2}q12-11 24 0M${cx-7} ${cy+1}q7-6 14 0" fill="none" stroke="#2563eb" stroke-width="2"/><circle cx="${x+18}" cy="${y+38}" r="1.9" fill="#22c55e"/><circle cx="${x+25}" cy="${y+38}" r="1.9" fill="#3b82f6"/><circle cx="${x+32}" cy="${y+38}" r="1.9" fill="#94a3b8"/>`;
    case 'loadBalancer': return deviceDefs+`<rect x="${x+12}" y="${y+18}" width="${w-24}" height="22" rx="5" fill="${screen}" stroke="#2563eb" stroke-width="2"/><path d="M${cx} ${y+18}V${y+7}M${cx} ${y+40}V${y+48}M${x+12} ${cy}H${x+4}M${x+w-12} ${cy}h8" stroke="#64748b" stroke-width="1.8"/><circle cx="${x+5}" cy="${cy}" r="3" fill="#22c55e"/><circle cx="${x+w-5}" cy="${cy}" r="3" fill="#22c55e"/><rect x="${cx-10}" y="${y+24}" width="20" height="4" rx="2" fill="#1d4ed8"/><rect x="${cx-10}" y="${y+31}" width="20" height="4" rx="2" fill="#1d4ed8" opacity=".6"/><path d="M${cx-4} ${y+10}l4-4 4 4" fill="none" stroke="#2563eb" stroke-width="1.8"/>`;
    case 'idsIps': return `<path d="M${cx} ${y+4}L${x+w-9} ${y+13}v11q0 14-${w/2-9} 21Q${x+9} ${y+38} ${x+9} ${y+24}V${y+13}Z" fill="#fee2e2" stroke="#dc2626" stroke-width="2"/><path d="M${x+17} ${cy}h7l4-7 6 14 5-8h8" fill="none" stroke="#b91c1c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${cx}" cy="${y+17}" r="2" fill="#f97316"/>`;
    case 'bridge': return `<path d="M${x+7} ${y+17}h${w-14}v${h-22}H${x+7}z" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><path d="M${x+7} ${cy}h${w-14}m-${w-14} -7 7 7-7 7m${w-28} -14-7 7 7 7" fill="none" stroke="#1d4ed8" stroke-width="2"/><path d="M${x+17} ${y+17}v${h-22}m${w-34} 0V${y+17}" stroke="#93c5fd" stroke-width="1.5"/>`;
    case 'mediaConverter': return deviceDefs+`<rect x="${x+5}" y="${y+11}" width="${w-10}" height="${h-22}" rx="6" fill="${metal}" stroke="#475569" stroke-width="2"/><rect x="${x+10}" y="${y+18}" width="15" height="17" rx="2" fill="#dbeafe" stroke="#2563eb"/><path d="M${x+13} ${y+22}h9m-9 5h9m-9 5h9" stroke="#60a5fa" stroke-width="1.5"/><path d="M${x+29} ${cy}h${w-40}m-6-5 6 5-6 5" fill="none" stroke="#f59e0b" stroke-width="2"/><circle cx="${x+w-12}" cy="${cy}" r="2" fill="#22c55e"/>`;
    case 'sdwanEdge': return deviceDefs+`<path d="M${x+8} ${y+11}h${w-16}v${h-22}H${x+8}z" fill="${dark}" stroke="#475569" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="11" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><path d="M${cx} ${cy-8}v16m-8-8h16m-14-6 12 12m0-12L${cx-6} ${cy+6}" stroke="#2563eb" stroke-width="1.7"/><circle cx="${x+14}" cy="${y+15}" r="2" fill="#4ade80"/><circle cx="${x+w-14}" cy="${y+15}" r="2" fill="#60a5fa"/>`;
    case 'wirelessController': return deviceDefs+`<rect x="${x+6}" y="${y+10}" width="${w-12}" height="${h-20}" rx="5" fill="${metal}" stroke="#475569" stroke-width="2"/><circle cx="${x+17}" cy="${cy}" r="3" fill="#22c55e"/><path d="M${x+28} ${cy+8}q12-16 24 0m-20-5q8-10 16 0m-12-5q4-5 8 0" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/><path d="M${x+13} ${y+16}h8m-8 5h8m-8 5h8" stroke="#64748b" stroke-width="1.2"/>`;
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
    case 'volume': return `<path d="M${x+7} ${y+11}c0-9 ${w-14}-9 ${w-14} 0v${h-22}c0 9-${w-14} 9-${w-14} 0z" fill="#e0e7ff" stroke="#4f46e5" stroke-width="2"/><path d="M${x+7} ${y+11}c0 9 ${w-14} 9 ${w-14} 0M${x+7} ${cy}c0 9 ${w-14} 9 ${w-14} 0" fill="none" stroke="#6366f1" stroke-width="1.5"/><circle cx="${x+w*.34}" cy="${y+8}" r="2" fill="#a5b4fc"/>`;
    case 'objectStorage': return `<path d="M${x+5} ${y+15}q0-10 12-10h${w-29}q12 0 12 10v25q0 7-7 7H${x+12}q-7 0-7-7z" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><path d="M${x+5} ${y+15}q0 9 12 9h${w-29}q12 0 12-9M${cx-4} ${y+24}v16m0 0-5-5m5 5 5-5" fill="none" stroke="#1d4ed8" stroke-width="1.8"/>`;
    case 'blockStorage': return deviceDefs+`<rect x="${x+6}" y="${y+8}" width="${w-12}" height="${h-16}" rx="4" fill="${metal}" stroke="#475569" stroke-width="2"/><rect x="${x+12}" y="${y+13}" width="${w-24}" height="${h-26}" rx="2" fill="#e2e8f0" stroke="#94a3b8"/><circle cx="${x+19}" cy="${cy}" r="5" fill="#94a3b8" stroke="#475569"/><circle cx="${x+19}" cy="${cy}" r="1.5" fill="#eef2f7"/><path d="M${x+29} ${y+19}h${w-42}m-${w-42} 7h${w-42}" stroke="#64748b" stroke-width="2"/>`;
    case 'database': return `<path d="M${x+6} ${y+11}c0-10 ${w-12}-10 ${w-12} 0v${h-22}c0 10-${w-12} 10-${w-12} 0z" fill="#edf2ff" stroke="#5266a8" stroke-width="2.2"/><path d="M${x+6} ${y+11}c0 10 ${w-12} 10 ${w-12} 0M${x+6} ${cy}c0 10 ${w-12} 10 ${w-12} 0" fill="none" stroke="#7184c2" stroke-width="1.6"/><circle cx="${x+20}" cy="${y+20}" r="2" fill="#93c5fd"/><circle cx="${x+29}" cy="${y+20}" r="2" fill="#60a5fa"/>`;
    case 'node': return deviceDefs+`<rect x="${x+8}" y="${y+6}" width="${w-16}" height="${h-12}" rx="4" fill="${metal}" stroke="#475569" stroke-width="2"/>${[.3,.5,.7].map(k=>`<rect x="${x+13}" y="${y+h*k-4}" width="${w-26}" height="7" rx="1" fill="#475569"/><circle cx="${x+w-17}" cy="${y+h*k-1}" r="1.5" fill="#4ade80"/>`).join('')}`;
    case 'namespace': return `<rect x="${x+5}" y="${y+5}" width="${w-10}" height="${h-10}" rx="8" fill="#ede9fe" fill-opacity=".8" stroke="#7c3aed" stroke-width="2" stroke-dasharray="4 2"/><circle cx="${x+20}" cy="${y+20}" r="5" fill="#a78bfa" stroke="#6d28d9"/><circle cx="${x+w-20}" cy="${y+20}" r="5" fill="#60a5fa" stroke="#1d4ed8"/><circle cx="${cx}" cy="${y+h-17}" r="5" fill="#34d399" stroke="#059669"/><path d="M${x+24} ${y+20}h${w-48}M${x+23} ${y+24}l${w/2-23} ${h-41}" stroke="#8b5cf6" stroke-width="1.5"/>`;
    case 'deployment': return `<path d="M${x+12} ${y+15}a17 17 0 0 1 31-5l4 4m0-9v9h-9M${x+w-12} ${y+h-15}a17 17 0 0 1-31 5l-4-4m0 9v-9h9" fill="none" stroke="#7c3aed" stroke-width="2.5" stroke-linecap="round"/><rect x="${cx-10}" y="${cy-9}" width="20" height="18" rx="4" fill="#ede9fe" stroke="#7c3aed" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="3" fill="#8b5cf6"/>`;
    case 'service': return `<circle cx="${cx}" cy="${cy}" r="10" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="3" fill="#2563eb"/>${[[x+9,y+10],[x+w-9,y+10],[x+9,y+h-10],[x+w-9,y+h-10]].map(([px,py])=>`<path d="M${cx} ${cy}L${px} ${py}" stroke="#60a5fa" stroke-width="1.5"/><circle cx="${px}" cy="${py}" r="3.5" fill="#bfdbfe" stroke="#2563eb"/>`).join('')}`;
    case 'ingress': return `<path d="M${x+12} ${y+h-6}V${y+18}q0-12 12-12h${w-48}q12 0 12 12v${h-24}" fill="#dbeafe" stroke="#2563eb" stroke-width="2.5"/><path d="M${x+3} ${cy}h${w-12}m-${w*.2}-7 7 7-7 7" fill="none" stroke="#1d4ed8" stroke-width="2.5"/><circle cx="${cx}" cy="${y+8}" r="3" fill="#60a5fa"/>`;
    case 'configSecret': return `<path d="M${x+9} ${y+4}h${w*.55}l12 12v${h-20}H${x+9}z" fill="#fef3c7" stroke="#d97706" stroke-width="2"/><path d="M${x+w*.55} ${y+4}v12h12" fill="none" stroke="#d97706" stroke-width="1.5"/><rect x="${x+30}" y="${y+28}" width="22" height="17" rx="3" fill="#fde68a" stroke="#b45309" stroke-width="2"/><path d="M${x+35} ${y+28}v-4a6 6 0 0 1 12 0v4" fill="none" stroke="#b45309" stroke-width="2"/>`;
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
    case 'ingressController': return `<path d="M${x+8} ${y+39}V${y+17}q0-8 8-8h${w-32}q8 0 8 8v22" fill="#dbeafe" stroke="#2563eb" stroke-width="2"/><path d="M${x+2} ${cy}h${w-4}m-8-6 8 6-8 6" fill="none" stroke="#1d4ed8" stroke-width="2.5"/><rect x="${cx-7}" y="${y+14}" width="14" height="16" rx="3" fill="#fff" stroke="#3b82f6"/><circle cx="${cx}" cy="${y+19}" r="2" fill="#22c55e"/><path d="M${cx-3} ${y+24}h6" stroke="#64748b" stroke-width="1.5"/>`;
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
  // nhãn cổng đặt cách đầu dây ~28px (dây ngắn thì 30% chiều dài) theo hướng đi của dây
  const toward = (from, to) => { const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1, k = Math.min(28, len * 0.3) / len; return { x: from.x + dx * k, y: from.y + dy * k }; };
  const nearA = toward(p.a, e.style === 'straight' ? p.b : p.mid), nearB = toward(p.b, e.style === 'straight' ? p.a : p.mid);
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
export function importJson(text) {
  const o = typeof text === 'string' ? JSON.parse(text) : text;
  if (!o || o.format !== FORMAT || !Array.isArray(o.shapes) || !Array.isArray(o.edges)) throw new Error('File không phải sơ đồ Packet Journey');
  const shapes = o.shapes.filter((s) => s && SHAPES[s.t] && typeof s.id === 'string' && [s.x, s.y, s.w, s.h].every(Number.isFinite));
  const ids = new Set(shapes.map((s) => s.id));
  const edges = o.edges.filter((e) => e && ids.has(e.a) && ids.has(e.b) && e.a !== e.b);
  const maxSeq = Math.max(0, ...[...shapes, ...edges].map((x) => +String(x.id).slice(1) || 0));
  const diagram={ format: FORMAT, version: 1, shapes, edges, seq: Math.max(o.seq || 0, maxSeq) };
  for(const rack of shapes.filter(s=>s.t==='rack')){const usage=rackUsage(diagram,rack.id);rack.rackUsed=usage.used;rack.rackFree=usage.free;}
  return diagram;
}
// ---------------------------------------------------------------- mẫu
const T = (build) => () => { const d = emptyDiagram(); build(d); return d; };
const link = (d, a, b, o) => addEdge(d, a.id, b.id, o);
export const TEMPLATES = [
  { id: 'lan', vi: 'LAN văn phòng', en: 'Office LAN', build: T((d) => {
    const z = addShape(d, 'zone', 60, 40, { w: 560, h: 420, label: 'VĂN PHÒNG — 192.168.1.0/24' });
    const r = addShape(d, 'router', 300, 80, { sub: '192.168.1.1' }), s = addShape(d, 'switch', 296, 230);
    const p = [addShape(d, 'pc', 110, 360, { sub: '192.168.1.10' }), addShape(d, 'laptop', 230, 365, { sub: '192.168.1.11' }), addShape(d, 'printer', 370, 365, { sub: '192.168.1.50' }), addShape(d, 'phone', 500, 360, { sub: 'Voice VLAN' })];
    const c = addShape(d, 'cloud', 650, 60, { label: 'INTERNET' });
    link(d, c, r, { la: '', lb: 'G0/1', style: 'straight', dash: 'dash' });
    link(d, r, s, { la: 'G0/0', lb: 'G0/1' });
    p.forEach((x, i) => link(d, s, x, { la: `Fa0/${i + 1}` }));
    void z;
  }) },
  { id: 'campus', vi: 'Campus 3 lớp', en: 'Three-tier campus', build: T((d) => {
    addShape(d, 'zone', 40, 20, { w: 760, h: 110, label: 'CORE', stroke: '#d64545', fill: '#d64545' });
    addShape(d, 'zone', 40, 150, { w: 760, h: 110, label: 'DISTRIBUTION', stroke: '#e67e22', fill: '#e67e22' });
    addShape(d, 'zone', 40, 280, { w: 760, h: 210, label: 'ACCESS', stroke: '#2e9e57', fill: '#2e9e57' });
    const c1 = addShape(d, 'l3switch', 260, 45), c2 = addShape(d, 'l3switch', 520, 45);
    const d1 = addShape(d, 'l3switch', 180, 175), d2 = addShape(d, 'l3switch', 600, 175);
    const a = [addShape(d, 'switch', 90, 305), addShape(d, 'switch', 300, 305), addShape(d, 'switch', 520, 305), addShape(d, 'switch', 690, 305)];
    link(d, c1, c2, { label: 'Po1', width: 4 });
    for (const x of [c1, c2]) for (const y of [d1, d2]) link(d, x, y);
    for (const [i, x] of a.entries()) { link(d, i < 2 ? d1 : d2, x); link(d, i < 2 ? d2 : d1, x, { dash: 'dash' }); }
    a.forEach((x, i) => link(d, x, addShape(d, i % 2 ? 'laptop' : 'pc', x.x + 4, 410, { label: `VLAN ${10 * (i + 1)}` })));
  }) },
  { id: 'wan', vi: 'HQ – chi nhánh qua WAN', en: 'HQ – branch over WAN', build: T((d) => {
    addShape(d, 'zone', 30, 60, { w: 300, h: 320, label: 'HQ — 10.1.0.0/16' });
    addShape(d, 'zone', 620, 60, { w: 260, h: 320, label: 'CHI NHÁNH — 10.2.0.0/16', stroke: '#2e9e57', fill: '#2e9e57' });
    const fw = addShape(d, 'firewall', 220, 110), r1x = addShape(d, 'router', 640, 110, { label: 'R-CN' });
    const core = addShape(d, 'l3switch', 70, 200), srv = addShape(d, 'server', 90, 300, { label: 'SRV-AD' });
    const sw = addShape(d, 'switch', 650, 220), pc = addShape(d, 'pc', 660, 300);
    const net = addShape(d, 'cloud', 400, 90, { label: 'INTERNET / MPLS' });
    link(d, fw, net, { label: 'IPsec VPN', dash: 'dash', color: '#d64545', style: 'curve' });
    link(d, net, r1x, { dash: 'dash', color: '#d64545', style: 'curve' });
    link(d, core, fw, { style: 'ortho', la: 'G0/1', lb: 'inside' });
    link(d, core, srv);
    link(d, r1x, sw, { la: 'G0/0', lb: 'G0/1' });
    link(d, sw, pc, { la: 'Fa0/1' });
  }) },
];
TEMPLATES.push(
  { id: 'ccna-vlan', vi: 'CCNA · VLAN segmentation', en: 'CCNA · VLAN segmentation', build: T((d) => {
    const core = addShape(d, 'l3switch', 330, 80, { label: 'SW-CORE', sub: 'SVI: VLAN 10 / 20 / 30' });
    [0,1,2].forEach((i) => { const sw = addShape(d, 'switch', 120 + i * 220, 260, { label: `SW-ACC${i+1}` }), pc = addShape(d, 'pc', 120 + i * 220, 400, { label: `PC-VLAN${(i+1)*10}` }); link(d, core, sw, { mode: 'trunk', vlans: '10,20,30', label: 'trunk' }); link(d, sw, pc, { mode: 'access', vlans: String((i+1)*10), label: `access VLAN ${(i+1)*10}` }); });
  }) },
  { id: 'ccna-roas', vi: 'CCNA · Inter-VLAN routing (ROAS)', en: 'CCNA · Inter-VLAN routing (ROAS)', build: T((d) => {
    const r = addShape(d, 'router', 330, 40, { label: 'R1', sub: 'G0/0.10 · .20' }), sw = addShape(d, 'switch', 330, 220, { label: 'SW1', sub: 'Trunk 802.1Q' });
    link(d, r, sw, { mode: 'trunk', vlans: '10,20', la: 'G0/0', lb: 'G0/1', label: '802.1Q trunk' });
    for (let i = 0; i < 2; i++) { const pc = addShape(d, 'pc', 150 + i * 360, 390, { label: `PC VLAN ${(i+1)*10}` }); link(d, sw, pc, { mode: 'access', vlans: String((i+1)*10), label: `VLAN ${(i+1)*10}` }); }
  }) },
  { id: 'ccna-ospf', vi: 'CCNA · OSPF đa vùng', en: 'CCNA · Multi-area OSPF', build: T((d) => {
    const r = [addShape(d,'router',340,180,{label:'R1 · ABR',sub:'Area 0'}),addShape(d,'router',120,50,{label:'R2',sub:'Area 0'}),addShape(d,'router',120,330,{label:'R3',sub:'Area 1'}),addShape(d,'router',580,330,{label:'R4',sub:'Area 2'})];
    link(d,r[0],r[1],{cable:'serial',label:'Area 0'}); link(d,r[0],r[2],{cable:'serial',label:'Area 1'}); link(d,r[0],r[3],{cable:'serial',label:'Area 2'});
  }) },
  { id: 'ccna-stp', vi: 'CCNA · STP root election', en: 'CCNA · STP root election', build: T((d) => {
    const s=[addShape(d,'switch',320,60,{label:'SW1 · ROOT',sub:'Priority 4096'}),addShape(d,'switch',100,320,{label:'SW2'}),addShape(d,'switch',540,320,{label:'SW3'})];
    link(d,s[0],s[1],{label:'Forwarding'}); link(d,s[0],s[2],{label:'Forwarding'}); link(d,s[1],s[2],{dash:'dash',label:'Blocked'});
    link(d,s[1],addShape(d,'pc',80,440,{label:'Host'}));
  }) },
  { id: 'ccna-etherchannel', vi: 'CCNA · EtherChannel', en: 'CCNA · EtherChannel', build: T((d) => {
    const a=addShape(d,'switch',130,170,{label:'SW1'}), b=addShape(d,'switch',530,170,{label:'SW2'});
    for(let i=0;i<4;i++) link(d,a,b,{portA:['e','s','n','w'][i],portB:['w','n','s','e'][i],label:i===0?'Po1':''});
    link(d,a,addShape(d,'server',100,360)); link(d,b,addShape(d,'server',560,360));
  }) },
  { id: 'ccna-hsrp', vi: 'CCNA · HSRP failover', en: 'CCNA · HSRP failover', build: T((d) => {
    const a=addShape(d,'router',150,80,{label:'R1 · Active',sub:'Priority 110'}), b=addShape(d,'router',500,80,{label:'R2 · Standby'}), sw=addShape(d,'switch',330,250,{label:'SW-ACCESS'});
    link(d,a,b,{label:'HSRP · VIP 10.1.1.1'}); link(d,a,sw); link(d,b,sw); link(d,sw,addShape(d,'pc',330,390,{label:'Default GW: VIP'}));
  }) },
  { id: 'ccna-nat', vi: 'CCNA · NAT ra Internet', en: 'CCNA · NAT to Internet', build: T((d) => {
    const pc=addShape(d,'pc',70,210,{label:'LAN · 10.0.0.10'}), sw=addShape(d,'switch',250,210), r=addShape(d,'router',440,210,{label:'R1 · NAT/PAT'}), fw=addShape(d,'firewall',620,210), net=addShape(d,'cloud',800,190,{label:'INTERNET'});
    link(d,pc,sw); link(d,sw,r,{la:'Fa0/1',lb:'G0/0'}); link(d,r,fw,{label:'Inside → Outside'}); link(d,fw,net,{cable:'fiber',label:'Public IP'});
  }) },
  { id: 'web-three-tier', vi: 'Web · 3 tầng', en: 'Web · Three tier', build: T((d) => {
    const u=addShape(d,'browser',50,180), lb=addShape(d,'loadBalancer',220,180), web=addShape(d,'webServer',420,80), app=addShape(d,'backend',620,180), db=addShape(d,'database',820,180);
    link(d,u,lb); link(d,lb,web); link(d,web,app); link(d,app,db);
  }) },
  { id: 'dc-spine-leaf', vi: 'Data center · Spine–leaf', en: 'Data center · Spine–leaf', build: T((d) => {
    const s1=addShape(d,'l3switch',300,50,{label:'SPINE-1'}), s2=addShape(d,'l3switch',550,50,{label:'SPINE-2'});
    [0,1,2].forEach(i=>{const leaf=addShape(d,'switch',100+i*300,230,{label:`LEAF-${i+1}`});link(d,s1,leaf,{cable:'fiber'});link(d,s2,leaf,{cable:'fiber'});const srv=addShape(d,'server',100+i*300,390,{label:`HOST-${i+1}`});link(d,leaf,srv);});
  }) },
  { id: 'sdwan', vi: 'SD-WAN · nhiều chi nhánh', en: 'SD-WAN · Branches', build: T((d) => {
    const hub=addShape(d,'cloud',360,80,{label:'SD-WAN FABRIC'}), hq=addShape(d,'building',90,280,{label:'HQ'});
    link(d,hq,hub,{cable:'vpn',label:'Overlay'}); [0,1,2].forEach(i=>{const br=addShape(d,'building',390+i*190,300,{label:`Branch ${i+1}`});link(d,hub,br,{cable:'vpn'});});
  }) },
  { id: 'cicd', vi: 'CI/CD · build đến deploy', en: 'CI/CD · Build to deploy', build: T((d) => {
    const git=addShape(d,'gitRepo',50,180), runner=addShape(d,'runner',170,180), pipe=addShape(d,'pipeline',300,170,{w:440}), env=addShape(d,'cluster',780,130,{label:'Runtime'});
    link(d,git,runner); link(d,runner,pipe); link(d,pipe,env); link(d,pipe,addShape(d,'artifact',500,300));
  }) },
  { id: 'kubernetes', vi: 'Kubernetes · cụm ứng dụng', en: 'Kubernetes · app cluster', build: T((d) => {
    const frame=addShape(d,'clusterBoundary',80,50,{w:740,h:420,label:'Cluster'}), ing=addShape(d,'ingress',120,120), svc=addShape(d,'service',330,120), pod=addShape(d,'pod',530,120), vol=addShape(d,'volume',650,310);
    assignContainer(d,ing.id);assignContainer(d,svc.id);assignContainer(d,pod.id);assignContainer(d,vol.id);fitContainers(d,[frame.id]);link(d,ing,svc);link(d,svc,pod);link(d,pod,vol);
  }) },
  { id: 'dr-site', vi: 'Site dự phòng · DR', en: 'Disaster recovery site', build: T((d) => {
    const pri=addShape(d,'datacenter',60,80,{w:300,h:300,label:'Primary DC'}), dr=addShape(d,'datacenter',540,80,{w:300,h:300,label:'DR site'}), a=addShape(d,'serverCluster',150,190), b=addShape(d,'serverCluster',630,190);
    const db1=addShape(d,'database',100,300),db2=addShape(d,'database',580,300);assignContainer(d,a.id);assignContainer(d,b.id);assignContainer(d,db1.id);assignContainer(d,db2.id);fitContainers(d,[pri.id,dr.id]);link(d,a,b,{cable:'fiber',label:'Replication'});link(d,a,db1);link(d,b,db2);
  }) },
  { id: 'home-network', vi: 'Mạng gia đình / SOHO', en: 'Home / SOHO network', build: T((d) => {
    const net=addShape(d,'cloud',40,160,{label:'ISP'}), modem=addShape(d,'modem',210,160), wifi=addShape(d,'homeRouter',380,160), pc=addShape(d,'laptop',580,70), phone=addShape(d,'mobile',580,250), cam=addShape(d,'camera',740,160);
    link(d,net,modem);link(d,modem,wifi);link(d,wifi,pc,{cable:'wifi'});link(d,wifi,phone,{cable:'wifi'});link(d,wifi,cam,{cable:'wifi'});
  }) },
);
