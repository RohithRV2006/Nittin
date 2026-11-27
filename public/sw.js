const PAGES_CACHE = "nittin-salesman-pages-v1";
const ASSETS_CACHE = "nittin-static-assets-v1";
const SALESMAN_ROUTES = ["/salesman", "/salesman/new-order", "/salesman/orders"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== PAGES_CACHE && k !== ASSETS_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === "WARM_SALESMAN_CACHE") {
    event.waitUntil(
      caches.open(PAGES_CACHE).then(async (cache) => {
        for (const route of SALESMAN_ROUTES) {
          try {
            const alreadyCached = await cache.match(route);
            if (alreadyCached) continue;
            const res = await fetch(route, { credentials: "include" });
            if (res.ok && res.status === 200 && !res.redirected) {
              await cache.put(route, res.clone());
            }
          } catch {
            // Ignore warm errors while offline
          }
        }
      })
    );
  }

  if (data.type === "CLEAR_SALESMAN_CACHE") {
    event.waitUntil(caches.delete(PAGES_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept health ping or auth endpoints
  if (url.pathname.startsWith("/api/")) return;

  // Cache static Next.js build assets & public branding
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/nittin.png" ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
    );
    return;
  }

  // Only cache Salesman portal page navigations (Network-First -> Cache Fallback)
  const isSalesmanPath =
    url.pathname === "/salesman" || url.pathname.startsWith("/salesman/");

  if (request.mode === "navigate" && isSalesmanPath) {
    event.respondWith(
      caches.open(PAGES_CACHE).then(async (cache) => {
        try {
          const networkRes = await fetch(request);
          if (networkRes.ok && networkRes.status === 200 && !networkRes.redirected) {
            await cache.put(url.pathname, networkRes.clone());
          }
          return networkRes;
        } catch {
          const cached =
            (await cache.match(url.pathname)) ||
            (await cache.match("/salesman/new-order")) ||
            (await cache.match("/salesman"));
          if (cached) return cached;
          return new Response(
            "<html><body style='font-family:sans-serif;padding:2rem;background:#faf6ee;color:#23170f'><h2>Offline Mode</h2><p>This page has not been cached yet. Connect briefly to load it once, then it will work offline.</p></body></html>",
            { status: 503, headers: { "Content-Type": "text/html" } }
          );
        }
      })
    );
  }
});
