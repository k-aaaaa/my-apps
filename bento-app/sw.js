// 🔧 v2からv3へバージョンアップし、ブラウザに再キャッシュを促す
const CACHE_NAME = 'bento-app-v3';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(urlsToCache))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// ネットワークが繋がる時は最新を取得し、圏外ならキャッシュ(保存済みファイル)を表示する
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});