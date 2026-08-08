// Service Worker do admin - estrategia "network-first" agressiva
// HTML sempre vai pra rede (sem cache do browser); cache so como fallback offline.
const CACHE_NAME = 'atelie-admin-v13';
const ASSETS = ['./index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c =>
      // Adiciona com cache: 'no-cache' para garantir bytes frescos no install
      Promise.all(ASSETS.map(url =>
        fetch(url, {cache: 'no-cache'}).then(r => c.put(url, r))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // HTML / navegacao: SEMPRE rede, bypass total de cache HTTP. Cache so como fallback offline.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req, {cache: 'no-store'})
        .then(resp => {
          // atualiza cache em background com a versao fresca
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', clone)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // Demais recursos: rede primeiro, cache como fallback
  e.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Permite que a pagina mande "skipWaiting" para ativar o SW novo imediatamente
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
