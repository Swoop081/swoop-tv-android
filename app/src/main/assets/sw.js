const CACHE='swoop-tv-v0853-shell';
const ARTWORK_CACHE='swoop-tv-artwork-v1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./assets/icon.svg','./assets/swoop-tv-logo.jpg','./assets/swoop-tv-icon.png','./assets/avatar-lion.jpeg','./assets/avatar-elephant.jpeg','./assets/avatar-giraffe.jpeg','./assets/avatar-zebra.jpeg','./assets/avatar-rhino.jpeg','./assets/avatar-turtle.jpeg','./assets/avatar-monkey.jpeg','./assets/avatar-meerkat.jpeg','./assets/avatar-parrot.jpeg','./assets/avatar-tiger.jpeg','./assets/avatar-cheetah.svg','./assets/avatar-seal.svg','./assets/avatar-triceratops.svg','./assets/avatar-capybara.svg','./assets/avatar-panda.svg','./assets/avatar-dinosaur.svg','./assets/avatar-red-panda.svg','./assets/avatar-kangaroo.svg','./assets/avatar-dog.svg','./assets/avatar-cat.svg','./src/m3u.js','./src/xtream.js','./src/mdblist.js','./src/sourceStack.js','./src/liveStack.js','./src/profiles.js','./src/themes.js','./src/tmdb.js','./src/discovery.js','./src/seedCache.js','./src/performancePack.js','./seed-cache.json','./starmeter.json','./src/storage.js','./src/storage-worker.js','./src/native.js','./src/nativeCatalog.js','./src/catalog-index-worker.js','./src/xmltv.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==ARTWORK_CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;const u=new URL(e.request.url);
  if(e.request.destination==='image'&&/^https?:$/.test(u.protocol)){
    e.respondWith(caches.open(ARTWORK_CACHE).then(async cache=>{const hit=await cache.match(e.request,{ignoreVary:true});if(hit)return hit;try{const res=await fetch(e.request);if(res)cache.put(e.request,res.clone()).catch(()=>{});return res}catch(err){const fallback=await cache.match(e.request,{ignoreVary:true});if(fallback)return fallback;throw err}}));return;
  }
  if(u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return res}).catch(()=>caches.match(e.request)));
});
