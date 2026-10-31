// sw.js — Service Worker cho PWA chạy offline.
// Chiến lược: NETWORK-FIRST cho tài nguyên cùng origin → luôn lấy bản mới khi online
// (tránh kẹt bản cũ), và tự lưu cache để DÙNG KHI OFFLINE. Lần mở đầu ui/app.js gửi
// danh sách file đã tải qua "message" để lưu, nên mở app online 1 lần là đủ.

const CACHE = 'packet-journey-v3';
const SHELL = ['./', './index.html', './styles/theme.css', './styles/app.css', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.origin !== self.location.origin || !Array.isArray(e.data?.cache)) return;
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(e.data.cache.map((u) => c.add(u)))));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // chỉ xử lý cùng origin

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))),
  );
});
