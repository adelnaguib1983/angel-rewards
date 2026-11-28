const CACHE_NAME = "angel-rewards-cache-v2";

// الملفات الأساسية لتشغيل واجهة التطبيق
const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png.jpeg",
  "/icon-192.png.jpeg",
  "/icon-512.png.jpeg"
];

// عند تثبيت الـ Service Worker لأول مرة
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
});

// تنظيف النسخ القديمة عند التحديث
self.addEventListener("activate", (event) => {
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

// التعامل مع طلبات الشبكة
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // لا نتدخل في طلبات قاعدة البيانات الخارجية
  if (request.method !== "GET" || url.origin.includes("supabase.co")) {
    return;
  }

  // عند فتح الصفحات (HTML): نحاول فتحها من الإنترنت، وإن لم يتوفر نأخذها من الكاش
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const rootCached = await caches.match("/");
          if (rootCached) return rootCached;
          return new Response("أنت تعمل بدون اتصال بالإنترنت", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        })
    );
    return;
  }

  // للملفات والوسائط والخطوط: إرجاع المحفوظ فوراً وتحديثه في الخلفية
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic" || networkResponse.type === "cors")) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
