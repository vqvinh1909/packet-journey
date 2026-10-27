// engine/tables.js
// Các "bảng" mà thiết bị tra khi quyết định chuyển gói: ARP cache, MAC table,
// routing table. Viết dạng hàm thuần + lớp nhỏ, không phụ thuộc DOM.

import { networkInt, ipToInt } from '../packet/addr.js';

/** ARP cache: IP -> MAC (host/router dùng để biết MAC kế tiếp). */
export class ArpCache {
  constructor(initial = {}) {
    this.map = new Map(Object.entries(initial));
  }
  lookup(ip) {
    return this.map.get(ip) || null;
  }
  insert(ip, mac) {
    this.map.set(ip, mac);
  }
  /** Bản sao để chụp trạng thái vào từng bước (snapshot cho UI). */
  snapshot() {
    return Array.from(this.map, ([ip, mac]) => ({ ip, mac }));
  }
}

/** MAC address table của switch: MAC -> cổng (port). */
export class MacTable {
  constructor() {
    this.map = new Map();
  }
  learn(mac, port) {
    this.map.set(mac, port);
  }
  portFor(mac) {
    return this.map.get(mac) ?? null;
  }
  snapshot() {
    return Array.from(this.map, ([mac, port]) => ({ mac, port }));
  }
}

/**
 * Routing table: danh sách tuyến { network, prefix, nextHop, iface, kind }.
 * kind: 'connected' (mạng nối trực tiếp) | 'static' | 'ospf' | 'default'.
 */
export class RoutingTable {
  constructor(routes = []) {
    this.routes = routes.slice();
  }
  add(route) {
    this.routes.push(route);
  }
  /**
   * Longest-prefix match: trong các tuyến mà IP đích thuộc về, chọn tuyến có
   * prefix DÀI NHẤT (cụ thể nhất). Trả về { route, reason } hoặc null.
   */
  lookup(destIp) {
    const dst = ipToInt(destIp);
    let best = null;
    for (const r of this.routes) {
      const net = r.prefix === 0 ? 0 : networkInt(destIp, r.prefix);
      const rNet = r.prefix === 0 ? 0 : networkInt(r.network, r.prefix);
      if (net === rNet) {
        if (!best || r.prefix > best.prefix) best = r;
      }
    }
    return best;
  }
  snapshot() {
    return this.routes.map((r) => ({
      network: r.prefix === 0 ? '0.0.0.0' : r.network,
      prefix: r.prefix,
      nextHop: r.nextHop || '(trực tiếp)',
      iface: r.iface,
      kind: r.kind || 'static',
    }));
  }
}
