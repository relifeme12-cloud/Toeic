/* Service worker cho "Từ vựng TOEIC".
   - Lần đầu mở có mạng: lưu toàn bộ app vào máy -> sau đó dùng được khi không có mạng.
   - Có mạng: luôn lấy bản mới nhất (để khi bạn thêm từ mới, app tự cập nhật), mất mạng: dùng bản đã lưu.
   Đổi số VERSION khi muốn ép máy tải lại toàn bộ. */
const VERSION = 'v1';
const CORE = `toeic-core-${VERSION}`;
const FONTS = `toeic-fonts-${VERSION}`;
const PRECACHE = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './apple-touch-icon.png', './favicon-48.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![CORE, FONTS].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Phông chữ Google: dùng bản đã lưu trước, cập nhật ngầm
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(async cache => {
        const hit = await cache.match(req);
        const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // Trang & tệp của app: mạng trước, hỏng mạng thì dùng bản lưu
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CORE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: true }).then(hit =>
          hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())
        )
      )
  );
});
