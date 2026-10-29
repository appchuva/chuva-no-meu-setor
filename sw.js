// Service worker: guarda os arquivos do app para ele abrir mesmo sem internet.
// Não guarda o mapa (regra do OpenStreetMap) nem a previsão (o app guarda a última sozinho).
// Ao mudar qualquer arquivo do app, aumente a VERSAO para o celular pegar a nova.

const VERSAO = 'v3';
const CACHE = `chuva-no-meu-setor-${VERSAO}`;
const ARQUIVOS = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/store.js',
  'js/geo.js',
  'js/forecast.js',
  'js/mapa.js',
  'js/previsao.js',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/marker-icon.png',
  'vendor/leaflet/images/marker-icon-2x.png',
  'vendor/leaflet/images/marker-shadow.png',
  'manifest.webmanifest',
  'icons/icone.svg',
  'icons/icone-192.png',
  'icons/icone-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Arquivos do próprio app: tenta a internet primeiro (versão mais nova) e usa a cópia guardada se cair.
self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;
  evento.respondWith(
    fetch(pedido)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then((c) => c.put(pedido, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(pedido, { ignoreSearch: true })),
  );
});
