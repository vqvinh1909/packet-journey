// ui/i18n.js — quản lý ngôn ngữ giao diện + encode đường dẫn bài học.
import vi from '../i18n/vi.js';
import en from '../i18n/en.js';
import { load, save } from './store.js';

const DICT = { vi, en };
let lang = load('lang', 'vi');
const listeners = new Set();

export function getLang() { return lang; }

export function setLang(l) {
  lang = DICT[l] ? l : 'vi';
  save('lang', lang);
  document.documentElement.setAttribute('lang', lang);
  listeners.forEach((fn) => fn(lang));
}

export function onLangChange(fn) { listeners.add(fn); }

/** Lấy chuỗi theo key (hỗ trợ 'osi.3'...). */
export function t(key) {
  const parts = key.split('.');
  let cur = DICT[lang];
  for (const p of parts) cur = cur?.[p];
  return cur ?? key;
}

// File HTML giáo trình đã build cho từng track (render đẹp + UTF-8, thay cho .md thô).
const HTML_BY_TRACK = {
  'Quản trị Hạ tầng mạng (Infrastructure Administrator)': 'Infrastructure-Administrator-Giao-trinh.html',
  'Network security': 'Network-Security-Giao-trinh.html',
  'CCNP/Module-01_ENCOR': 'CCNP-ENCOR-Giao-trinh.html',
  'CCNP/Module-02_ENARSI': 'CCNP-ENARSI-Giao-trinh.html',
  'CCNP/Module-03_ENSLD': 'CCNP-ENSLD-Giao-trinh.html',
  'CCNP/Module-04_ENAUTO': 'CCNP-ENAUTO-Giao-trinh.html',
  'CCNP/Module-05_ENSDWI': 'CCNP-ENSDWI-Giao-trinh.html',
  'CCNP/Module-06_ENCC': 'CCNP-ENCC-Giao-trinh.html',
  'CCNP/Module-07_ENNA': 'CCNP-ENNA-Giao-trinh.html',
  'CCNP/Module-08_WLCOR': 'CCNP-WLCOR-Giao-trinh.html',
  'CCNP/Module-09_WLSD': 'CCNP-WLSD-Giao-trinh.html',
  'CCNP/Module-10_WLSI': 'CCNP-WLSI-Giao-trinh.html',
  'CCNP/Module-11_SCOR': 'CCNP-SCOR-Giao-trinh.html',
  'CCNP/Module-12_DCCOR': 'CCNP-DCCOR-Giao-trinh.html',
  'CCNP/Module-13_SPCOR': 'CCNP-SPCOR-Giao-trinh.html',
  'CCNP/Module-14_CLCOR': 'CCNP-CLCOR-Giao-trinh.html',
};
// App ở E:\SAP\Packet-Journey, giáo trình ở E:\SAP\Mạng máy tính\ (ngoài repo).
const LESSON_ROOT = '../Mạng máy tính/';

/**
 * Tạo href an toàn tới bài học. Nếu nhận ra đường dẫn `../<track>/.../Bai-NN_*.md`,
 * tự chuyển sang file HTML giáo trình + anchor `#bNN-s0` (render đẹp, không lỗi mã).
 * Encode TỪNG đoạn path (tên có dấu cách + tiếng Việt), giữ nguyên '/' và phần '#anchor'.
 */
export function lessonHref(path) {
  let target = path;
  const m = path.match(/^\.\.\/([^/]+)\/([^/]+)\/(?:.*\/)?Bai-0*(\d+)_[^/]*\.md$/);
  // CCNP mỗi đề một file nên tra theo cả thư mục đề.
  const html = m && (HTML_BY_TRACK[m[1]] || HTML_BY_TRACK[`${m[1]}/${m[2]}`]);
  if (html) {
    const n = String(m[3]).padStart(2, '0');
    target = `../${m[1]}/${html}#b${n}-s0`;
  }
  target = target.replace(/^\.\.\//, LESSON_ROOT);
  const hashIdx = target.indexOf('#');
  const anchor = hashIdx >= 0 ? target.slice(hashIdx) : '';
  const p = hashIdx >= 0 ? target.slice(0, hashIdx) : target;
  return p.split('/').map((seg) => (seg === '..' ? '..' : encodeURIComponent(seg))).join('/') + anchor;
}
