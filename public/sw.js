/*
 * FIT·NOTE Service Worker（フェーズ4-B: オフライン対応）
 * 目的: オフラインでもアプリシェルが起動し、静的アセットを高速配信する。
 * 方針:
 *   - ナビゲーション: network-first → 失敗時はキャッシュした "/"（アプリシェル）を返す
 *   - 静的アセット(_next/static・アイコン): stale-while-revalidate
 *   - API ルート(/api/*): 介入しない（常にネットワーク。AI解析や日次制限はキャッシュ不可）
 *   - GET / 同一オリジンのみ対象
 * 注意: VERSION を変えると古いキャッシュを破棄して更新が反映される。
 */
const VERSION = "v1";
const STATIC_CACHE = `fitnote-static-${VERSION}`;
const RUNTIME_CACHE = `fitnote-runtime-${VERSION}`;
const APP_SHELL = "/";

// 起動に最低限必要な静的アセット（ベストエフォートで先読み）
const PRECACHE_URLS = [
  APP_SHELL,
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // 1件失敗しても install を止めない
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 旧バージョンのキャッシュを破棄
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("fitnote-") && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// 静的アセット判定（cache-first で速く、裏で更新）
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|css|js)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 同一オリジンのみ
  if (url.pathname.startsWith("/api/")) return; // API はネットワーク専用

  // ナビゲーション: network-first → オフライン時はアプリシェル
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(APP_SHELL, fresh.clone()); // 最新のシェルを保持
          return fresh;
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          return (
            (await cache.match(APP_SHELL)) ||
            (await caches.match(APP_SHELL)) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // 静的アセット: stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => undefined);
        return cached || (await network) || Response.error();
      })()
    );
  }
});
