// protocols/index.js
// Đăng ký (registry) tất cả giao thức theo id. serialize.js tra ở đây để biết cách
// dựng byte + quy tắc checksum của từng lớp.

import ethernet from './ethernet.js';
import dot1q from './dot1q.js';
import arp from './arp.js';
import ipv4 from './ipv4.js';
import icmp from './icmp.js';
import llc from './llc.js';
import stp from './stp.js';
import ospf from './ospf.js';
import eigrp from './eigrp.js';
import udp from './udp.js';
import dhcp from './dhcp.js';
import dns from './dns.js';
import tcp from './tcp.js';
import hsrp from './hsrp.js';
import bgp from './bgp.js';
import raw from './raw.js';
import ipv6 from './ipv6.js';
import icmpv6 from './icmpv6.js';
import ospfv3 from './ospfv3.js';
import mstp from './mstp.js';
import dhcpv6 from './dhcpv6.js';
import mpls from './mpls.js';
import vxlan from './vxlan.js';

export const PROTOCOLS = {
  ethernet,
  dot1q,
  arp,
  ipv4,
  icmp,
  llc,
  stp,
  ospf,
  eigrp,
  udp,
  dhcp,
  dns,
  tcp,
  hsrp,
  bgp,
  raw,
  ipv6,
  icmpv6,
  ospfv3,
  mstp,
  dhcpv6,
  mpls,
  vxlan,
};

export function getProtocol(id) {
  const p = PROTOCOLS[id];
  if (!p) throw new Error(`Chưa đăng ký giao thức: ${id}`);
  return p;
}
