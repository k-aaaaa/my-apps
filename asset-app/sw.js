// File: sw.js
// PWAとして認識させるためのシンプルなService Worker
const CACHE_NAME = 'asset-manager-v1';

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
    // 常に最新を読み込む（キャッシュは最低限）
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});