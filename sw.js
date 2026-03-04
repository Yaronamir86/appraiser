
const CACHE = "yaron-appraiser-pro-v1";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./manifest.json","./sw.js"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k===CACHE ? null : caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if(event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request).then(res => {
      try{
        const url = new URL(event.request.url);
        if(url.origin === location.origin){
          caches.open(CACHE).then(c => c.put(event.request, res.clone()));
        }
      }catch(_){}
      return res;
    }).catch(() => caches.match("./")))
  );
});
