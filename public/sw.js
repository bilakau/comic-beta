const CACHE_NAME = 'fmc-comic-v2';
const ASSETS = ['/', '/index.html', '/style.css', '/script.js', '/assets/icon.png'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request).then((response) => {
                // Cache gambar komik untuk mode offline (opsional)
                if(e.request.destination === 'image') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return response;
            });
        })
    );
});
