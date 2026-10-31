// lab/diagram-bridge.js — transfer topology only between the drawing canvas and the sandbox workspace.
import * as D from './diagram.js';
import * as S from './sandbox.js';
import * as N from './net.js';

const isSerial = (port) => /^s(e|erial)?\d/i.test(String(port || '').trim());
const shapeType = (dev) => ({ router: 'router', switch: dev.model === '3560' ? 'l3switch' : 'switch', firewall: 'firewall', pc: 'pc', server: dev.cloud ? 'cloud' : 'server' }[dev.type] || 'pc');

export function diagramFromSandbox(net) {
  const out = D.emptyDiagram(), ids = new Map(), kindType = { router: 'router', sw2960: 'switch', sw3560: 'l3switch', asa: 'firewall', fortios: 'firewall', panos: 'firewall', sophos: 'firewall', checkpoint: 'firewall', pfsense: 'firewall', cloud: 'cloud', pc: 'pc', server: 'server' };
  for (const dev of Object.values(net.devices)) {
    const t = kindType[dev.kind] || shapeType(dev), linked = new Set(net.links.filter((l) => l.a === dev.id || l.b === dev.id).map((l) => l.a === dev.id ? l.ap : l.bp));
    const ports0 = dev.type === 'switch' ? dev.ports || {} : dev.ifaces || {};
    const ports = Object.entries(ports0).filter(([name, p]) => linked.has(name) || p.ip || p.desc || (p.vlan && p.vlan !== 1)).map(([name, p]) => ({ name, ip: p.ip ? `${p.ip}/${p.prefix ?? 24}` : '', vlan: p.vlan == null ? '' : String(p.vlan), mode: p.mode || 'access', description: p.desc || '' }));
    const l3 = N.l3ifs(dev), svi = Object.values(l3 || {}).find((p) => p.ip && !p.shutdown), mgmtIp = dev.ip ? `${dev.ip}/${dev.prefix ?? 24}` : svi ? `${svi.ip}/${svi.prefix ?? 24}` : '';
    const spec = D.SHAPES[t], s = D.addShape(out, t, dev.x - spec.w / 2, dev.y - spec.h / 2, { label: dev.name, sub: dev.ip || '', meta: { hostname: dev.name, model: dev.model || dev.os || '', mgmtIp, gateway: dev.gateway || dev.defaultGateway || '' }, ports });
    s.showMeta = !!mgmtIp; ids.set(dev.id, s);
  }
  for (const l of net.links) {
    const a = ids.get(l.a), b = ids.get(l.b); if (!a || !b) continue;
    const da = net.devices[l.a], db = net.devices[l.b], dx = db.x - da.x, dy = db.y - da.y;
    const portA = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'e' : 'w') : (dy >= 0 ? 's' : 'n'), portB = ({ e: 'w', w: 'e', n: 's', s: 'n' })[portA];
    D.addEdge(out, a.id, b.id, { portA, portB, la: l.ap || '', lb: l.bp || '', style: 'ortho', ...(isSerial(l.ap) || isSerial(l.bp) ? { cable: 'serial' } : {}) });
  }
  return out;
}

const workspaceKind = (s) => ({ router: 'router', switch: 'sw2960', l3switch: 'sw3560', firewall: 'asa', pc: 'pc', laptop: 'pc', server: 'server', cloud: 'cloud' }[s.t] || 'server');
function workspacePortName(shape, label, net, id, used, serial = false) {
  const dev = net.devices[id], requested = String(label || '').trim().toLowerCase();
  if (serial && dev.type === 'router') { const want = requested.replace(/^se(rial)?/, 's'); if (dev.ifaces[want] && !used.has(want) && !N.linkAt(net, id, want)) return want; const port = Object.keys(dev.ifaces).filter((p) => p.startsWith('s')).find((p) => !used.has(p) && !N.linkAt(net, id, p)); if (port) return port; const p = `s0/0/${Object.keys(dev.ifaces).filter((x) => x.startsWith('s')).length}`; dev.ifaces[p] = structuredClone(Object.values(dev.ifaces)[0]); return p; }
  const alias = requested.replace(/^gigabitethernet/, 'g').replace(/^gi(?=\d)/, 'g').replace(/^fastethernet/, 'fa').replace(/^ethernet/, 'e');
  const ports = S.physPorts(dev);
  if (alias && ports.includes(alias) && !used.has(alias)) return alias;
  const free = S.freePorts(net, id).find((p) => !used.has(p));
  if (free) return free;
  if (dev.type === 'switch') { const p = `f0/${ports.length + 1}`; dev.ports[p] = N.newPort(); return p; }
  if (dev.type === 'router') { const p = `g0/${ports.length}`; dev.ifaces[p] = structuredClone(Object.values(dev.ifaces)[0]); return p; }
  return 'fa0';
}

/** Create a blank, powered-off sandbox network from diagram topology and its interface names. */
export function sandboxFromDiagram(diagram) {
  const d = typeof diagram === 'string' ? D.importJson(diagram) : D.importJson(diagram), net = S.emptySandbox(), ids = new Map(), used = new Map();
  for (const s of d.shapes.filter(D.isDevice)) {
    const kind = workspaceKind(s), ports = Math.max((s.ports || []).length, d.edges.filter((e) => e.a === s.id || e.b === s.id).length, 1);
    const id = S.addDevice(net, kind, s.x + s.w / 2, s.y + s.h / 2, { off: true, ports });
    net.devices[id].name = (s.label || net.devices[id].name).slice(0, 30); ids.set(s.id, id); used.set(s.id, new Set());
  }
  for (const e of d.edges) {
    const a = ids.get(e.a), b = ids.get(e.b); if (!a || !b) continue;
    const sa = D.shapeOf(d, e.a), sb = D.shapeOf(d, e.b), serial = (e.cable === 'serial' || isSerial(e.la) || isSerial(e.lb)) && net.devices[a].type === 'router' && net.devices[b].type === 'router', ap = workspacePortName(sa, e.la, net, a, used.get(e.a), serial), bp = workspacePortName(sb, e.lb, net, b, used.get(e.b), serial);
    used.get(e.a).add(ap); used.get(e.b).add(bp);
    const error = S.connect(net, a, ap, b, bp); if (error) throw new Error(`Không thể tạo dây ${sa.label || sa.t} ↔ ${sb.label || sb.t}: ${error}`);
  }
  return net;
}
