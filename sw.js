const CACHE='saiwaisan-test-static-v11';
const FILES=['./','./index.html','./manifest.webmanifest','./styles.css?v=test11','./cloud-model.js?v=test11','./seed-data.js?v=test11','./bootstrap.js?v=test11','./app.js?v=test11','./metronome.js?v=test11','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(x=>x.startsWith('saiwaisan-test-static-')&&x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;e.respondWith(caches.match(req).then(saved=>saved||fetch(req).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(req,r.clone()));return r;})).catch(()=>caches.match('./index.html')));});
