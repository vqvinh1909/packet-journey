// scenarios/index.js
// Danh mục kịch bản. Thêm kịch bản mới: tạo file s0X-*.js export { meta, build },
// rồi thêm vào mảng dưới đây (xem README).

import * as s01 from './s01-ping-same-subnet.js';
import * as s02 from './s02-ping-across-router.js';
import * as s03 from './s03-vlan-segmentation.js';
import * as s04 from './s04-trunk-dot1q.js';
import * as s05 from './s05-stp-root-election.js';
import * as s06 from './s06-inter-vlan-routing.js';
import * as s07 from './s07-ospf-adjacency.js';
import * as s08 from './s08-eigrp-dual.js';
import * as s09 from './s09-dhcp-dora.js';
import * as s10 from './s10-dns-resolution.js';
import * as s11 from './s11-nat-pat.js';
import * as s12 from './s12-acl-filter.js';
import * as s13 from './s13-hsrp-failover.js';
import * as s14 from './s14-tcp-handshake.js';
import * as s15 from './s15-traceroute.js';
import * as s16 from './s16-fragmentation.js';
import * as s17 from './s17-bgp-ebgp.js';
import * as s18 from './s18-ospf-multiarea.js';
import * as s19 from './s19-rstp.js';
import * as s20 from './s20-qos-dscp.js';
import * as s21 from './s21-redistribution.js';
import * as s22 from './s22-wrong-gateway.js';
import * as s23 from './s23-vlan-mismatch.js';
import * as s24 from './s24-mst.js';
import * as s25 from './s25-qos-advanced.js';
import * as s26 from './s26-ipv6-ndp.js';
import * as s27 from './s27-ospfv3.js';
import * as s28 from './s28-slaac-dhcpv6.js';
import * as s29 from './s29-mpls.js';
import * as s30 from './s30-vxlan.js';
import * as s31 from './s31-evpn.js';
import * as s32 from './s32-sr-mpls.js';
import * as s33 from './s33-multicast.js';
import * as s34 from './s34-l3vpn.js';
import * as s35 from './s35-lisp.js';
import * as s36 from './s36-sd-access.js';
import * as s37 from './s37-sd-wan.js';
import * as s38 from './s38-dmvpn.js';
import * as s39 from './s39-bfd.js';

export const SCENARIOS = [
  s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12,
  s13, s14, s15, s16, s17, s18, s19, s20, s21, s22, s23,
  s24, s25, s26, s27, s28, s29, s30, s31, s32,
  s33, s34, s35, s36, s37, s38, s39,
];

export function getScenario(id) {
  return SCENARIOS.find((s) => s.meta.id === id) || null;
}
