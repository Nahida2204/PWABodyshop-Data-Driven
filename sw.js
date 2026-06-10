self.addEventListener('install', event => {
    event.waitUntil(
        caches.open('static').then(cache => {
            return cache.addAll([
                '/',
                '/index.html',
                './images/icon.png'
            ]);
        })
    );  
});

self.addEventListener('fetch', event => {
    console.log("Fetch event for ", event.request.url);
}   );