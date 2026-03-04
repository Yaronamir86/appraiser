
/* Service Worker מינימלי (אופציונלי): Cache-first עבור קבצי האתר */
const CACHE = "yaron-appraiser-site-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k === CACHE ? null : caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // רק GET
  if(req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      // Try cache copy of same-origin resources
      try{
        const url = new URL(req.url);
        if(url.origin === location.origin){
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
      }catch(_){}
      return res;
    }).catch(() => caches.match("./")))
  );
});
