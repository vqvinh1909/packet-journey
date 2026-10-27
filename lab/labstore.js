// lab/labstore.js — "📚 Thư viện lab" của workspace: lưu nhiều mạng tự dựng có tên, xếp theo thư mục, mở nhanh lab
// gần đây. Hàm thuần (nhận thư viện cũ → trả thư viện mới), phần giao diện ở ui/workspace.js lưu vào localStorage
// ("sandbox-lib"). Mỗi lab giữ nguyên định dạng của ⬇ Xuất mạng (.json) nên mở lại được bằng importSandbox.

export const ROOT = 'Của tôi';
const MAX_RECENT = 8;
const NAME_RE = /^[^/\\<>]{1,60}$/;

export const emptyLib = () => ({ v: 1, folders: [ROOT], labs: {}, recent: [] });

/** Đọc thư viện từ dữ liệu lưu (sai/thiếu → thư viện trống, luôn có thư mục gốc). */
export function normLib(x) {
  if (!x || typeof x !== 'object' || typeof x.labs !== 'object') return emptyLib();
  const folders = [ROOT, ...(Array.isArray(x.folders) ? x.folders : []).filter((f) => typeof f === 'string' && f !== ROOT)];
  const labs = {};
  for (const [id, l] of Object.entries(x.labs || {})) if (l && typeof l.name === 'string' && l.data) labs[id] = { ...l, folder: folders.includes(l.folder) ? l.folder : ROOT };
  return { v: 1, folders: [...new Set(folders)], labs, recent: (x.recent || []).filter((id) => labs[id]) };
}
const copy = (lib) => ({ v: 1, folders: [...lib.folders], labs: { ...lib.labs }, recent: [...lib.recent] });
const clean = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');
const touch = (lib, id) => { lib.recent = [id, ...lib.recent.filter((x) => x !== id)].slice(0, MAX_RECENT); };
const sameName = (lib, folder, name, except) => Object.entries(lib.labs).some(([id, l]) => id !== except && l.folder === folder && l.name.toLowerCase() === name.toLowerCase());

/**
 * Lưu mạng thành lab. o = { id (ghi đè lab có sẵn), name, folder, data (object của exportSandbox), now }.
 * Trả { lib, id } hoặc { error }.
 */
export function saveLab(lib0, o) {
  const name = clean(o.name);
  const folder = o.folder || ROOT;
  if (!NAME_RE.test(name)) return { error: 'Tên lab 1–60 ký tự, không chứa / \\ < >' };
  if (!lib0.folders.includes(folder)) return { error: `Thư mục "${folder}" không tồn tại` };
  if (!o.data) return { error: 'Thiếu dữ liệu mạng' };
  const lib = copy(lib0);
  const old = o.id && lib.labs[o.id];
  if (sameName(lib, folder, name, old ? o.id : null)) return { error: `Đã có lab "${name}" trong thư mục ${folder}` };
  const now = o.now ?? Date.now();
  let id = old ? o.id : null;
  if (!id) { let i = Object.keys(lib.labs).length + 1; while (lib.labs['lab' + i]) i++; id = 'lab' + i; }
  lib.labs[id] = { name, folder, data: o.data, created: old?.created ?? now, updated: now, devices: Object.keys(o.data.net?.devices || o.data.devices || {}).length };
  touch(lib, id);
  return { lib, id };
}
/** Đánh dấu vừa mở (đưa lên đầu "gần đây"). */
export function openedLab(lib0, id) { if (!lib0.labs[id]) return lib0; const lib = copy(lib0); touch(lib, id); return lib; }
export function renameLab(lib0, id, name) {
  name = clean(name);
  const l = lib0.labs[id];
  if (!l) return { error: 'Không tìm thấy lab' };
  if (!NAME_RE.test(name)) return { error: 'Tên lab 1–60 ký tự, không chứa / \\ < >' };
  if (sameName(lib0, l.folder, name, id)) return { error: `Đã có lab "${name}" trong thư mục ${l.folder}` };
  const lib = copy(lib0);
  lib.labs[id] = { ...l, name };
  return { lib };
}
export function moveLab(lib0, id, folder) {
  const l = lib0.labs[id];
  if (!l) return { error: 'Không tìm thấy lab' };
  if (!lib0.folders.includes(folder)) return { error: `Thư mục "${folder}" không tồn tại` };
  if (sameName(lib0, folder, l.name, id)) return { error: `Thư mục ${folder} đã có lab tên "${l.name}"` };
  const lib = copy(lib0);
  lib.labs[id] = { ...l, folder };
  return { lib };
}
export function deleteLab(lib0, id) {
  const lib = copy(lib0);
  delete lib.labs[id];
  lib.recent = lib.recent.filter((x) => x !== id);
  return { lib };
}
export function addFolder(lib0, name) {
  name = clean(name);
  if (!NAME_RE.test(name)) return { error: 'Tên thư mục 1–60 ký tự, không chứa / \\ < >' };
  if (lib0.folders.some((f) => f.toLowerCase() === name.toLowerCase())) return { error: `Đã có thư mục "${name}"` };
  const lib = copy(lib0);
  lib.folders.push(name);
  return { lib };
}
export function renameFolder(lib0, old, name) {
  name = clean(name);
  if (old === ROOT) return { error: `Không đổi tên thư mục gốc "${ROOT}"` };
  if (!lib0.folders.includes(old)) return { error: 'Không tìm thấy thư mục' };
  if (!NAME_RE.test(name)) return { error: 'Tên thư mục 1–60 ký tự, không chứa / \\ < >' };
  if (lib0.folders.some((f) => f !== old && f.toLowerCase() === name.toLowerCase())) return { error: `Đã có thư mục "${name}"` };
  const lib = copy(lib0);
  lib.folders = lib.folders.map((f) => (f === old ? name : f));
  for (const [id, l] of Object.entries(lib.labs)) if (l.folder === old) lib.labs[id] = { ...l, folder: name };
  return { lib };
}
/** Xoá thư mục: các lab bên trong chuyển về thư mục gốc (đổi tên nếu trùng). */
export function deleteFolder(lib0, name) {
  if (name === ROOT) return { error: `Không xoá thư mục gốc "${ROOT}"` };
  if (!lib0.folders.includes(name)) return { error: 'Không tìm thấy thư mục' };
  const lib = copy(lib0);
  lib.folders = lib.folders.filter((f) => f !== name);
  for (const [id, l] of Object.entries(lib.labs)) {
    if (l.folder !== name) continue;
    let nm = l.name, i = 2;
    while (sameName(lib, ROOT, nm, id)) nm = `${l.name} (${i++})`;
    lib.labs[id] = { ...l, folder: ROOT, name: nm };
  }
  return { lib };
}
/** [{ folder, labs: [{ id, ...lab }] }] theo thứ tự thư mục, lab theo tên. */
export function tree(lib) {
  return lib.folders.map((folder) => ({ folder, labs: Object.entries(lib.labs).filter(([, l]) => l.folder === folder).map(([id, l]) => ({ id, ...l })).sort((a, b) => a.name.localeCompare(b.name, 'vi')) }));
}
