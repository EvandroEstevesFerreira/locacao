// Service worker do Loca (PWA) — estratégia conservadora:
// - navegação (páginas): network-first; se offline, mostra /offline em cache.
// - estáticos same-origin (/_next/static, ícones): stale-while-revalidate.
// - demais requisições: repassa para a rede (sem cache).
// Dados sensíveis/autenticados nunca são cacheados como páginas.

const CACHE = "loca-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function estatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|gif|webp|svg|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // não intercepta terceiros

  // Páginas: network-first com fallback offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
    );
    return;
  }

  // Estáticos: stale-while-revalidate.
  if (estatico(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const rede = fetch(req)
          .then((resp) => {
            if (resp && resp.status === 200) cache.put(req, resp.clone());
            return resp;
          })
          .catch(() => cached);
        return cached || rede;
      }),
    );
  }
});
