/**
 * Service Worker - ClimaRMC PWA
 * Suporte offline, cache inteligente e alta disponibilidade
 */

const CACHE_NAME = 'clima-rmc-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/charts.js',
  '/js/map.js',
  '/js/accessibility.js',
  '/js/pwa.js',
  '/manifest.json',
  '/icons/icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'
];

// 1. Instalação: Cache dos ativos essenciais do App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Ativação: Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interceptação de Requisições (Fetch)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Estratégia Network-First com Fallback para Cache nas rotas da API REST
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Salva uma cópia no cache se for bem-sucedida
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Se estiver offline ou a rede falhar, busca a última leitura salva no cache
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Retorno seguro padrão caso nada esteja em cache
          return new Response(JSON.stringify({
            success: false,
            offline: true,
            error: 'Modo offline: os dados em tempo real não puderam ser carregados sem conexão com a internet.'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Estratégia Cache-First para arquivos estáticos (CSS, JS, Fontes, Ícones)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
