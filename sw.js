/* Service Worker — network-first כדי שעדכוני קוד יגיעו מיד,
   עם נפילה ל-cache כשאין רשת (פתיחה מהירה של המעטפת). */
const CACHE = 'trip-v1';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './icons/icon.svg',
];

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

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // בקשות Firebase / גופנים — ישר לרשת, בלי cache
  if (url.origin !== location.origin) return;
  // קובץ הגרסה חייב להגיע תמיד מהרשת, אחרת לא נדע שיש עדכון
  if (url.pathname.endsWith('/version.json')) return;

  // cache:'no-cache' מאלץ אימות מול השרת בכל טעינה, כך שקובץ קוד ישן
  // שיושב במטמון ה-HTTP לא ימשיך לרוץ אחרי שעלתה גרסה חדשה
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((cached) => cached || caches.match('./index.html'))),
  );
});
