// engine/devices.js
// Hàm dựng thiết bị (host, switch, router) với interface + bảng tương ứng.
// Giữ trạng thái (ARP cache, MAC table, routing table) để mô phỏng thay đổi theo bước.

import { ArpCache, MacTable, RoutingTable } from './tables.js';
import { sameSubnet } from '../packet/addr.js';

/** Host: 1 interface, có default gateway và ARP cache riêng. */
export function makeHost({ id, name, mac, ip, prefix, gateway, x, y }) {
  return {
    id,
    type: 'host',
    name,
    x,
    y,
    interfaces: [{ name: 'eth0', mac, ip, prefix }],
    gateway,
    arp: new ArpCache(),
  };
}

/** Switch L2: học MAC theo cổng, không có IP (ở mức mô phỏng này). */
export function makeSwitch({ id, name, x, y }) {
  return {
    id,
    type: 'switch',
    name,
    x,
    y,
    interfaces: [],
    macTable: new MacTable(),
  };
}

/** Router: nhiều interface (mỗi cái 1 mạng), routing table + ARP cache. */
export function makeRouter({ id, name, x, y, interfaces, routes }) {
  return {
    id,
    type: 'router',
    name,
    x,
    y,
    interfaces, // [{ name, mac, ip, prefix }]
    routing: new RoutingTable(routes || []),
    arp: new ArpCache(),
  };
}

/** Tìm interface của router nằm CÙNG MẠNG với IP cho trước (để biết cổng ra). */
export function ifaceForIp(router, ip) {
  return router.interfaces.find((i) => sameSubnet(i.ip, ip, i.prefix)) || null;
}
