const CACHE='fio-shell-v4';
// Push is opt-in and provisioned only for Platform Admin. Existing cache handlers stay intact.
self.addEventListener('push',event=>{
 event.waitUntil(self.registration.showNotification('FIO Platform',{body:'Há um alerta que precisa da sua atenção.',icon:'/icons/icon-192.png',tag:'fio-platform-alert',data:{url:'/platform/alertas'}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  const target=new URL('/platform/alertas',self.location.origin).href;
  const existing=windows.find(w=>new URL(w.url).origin===self.location.origin&&new URL(w.url).pathname.startsWith('/platform'));
  if(existing){await existing.navigate(target);return existing.focus();}return self.clients.openWindow(target);
 }));
});
const SHELL=['/','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable-192.png','/icons/icon-maskable-512.png','/textures/fio-pattern-dark.png','/textures/fio-pattern-light.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).catch(()=>undefined));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('/',copy));return response;}).catch(()=>caches.match('/')));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&['script','style','image','font'].includes(request.destination)){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;})));
});
