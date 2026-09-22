/* 学习乐园 · Service Worker
   作用：让网站可安装为 App（PWA/APK 的前提）+ 断网可用
   策略：
     - 页面导航：网络优先，失败回退缓存（保证更新及时 + 离线可开）
     - 静态资源：缓存优先 + 后台更新（stale-while-revalidate）
     - Supabase 云端请求：一律直连网络，绝不缓存（保证数据实时、不串号）
*/
const VERSION = 'lp-v1.0.0';
const CACHE = 'learning-park-' + VERSION;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/vendor/supabase.js',
  './js/data.js',
  './js/config.js',
  './js/cloud.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

/* 安装：预缓存核心资源 */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // 逐个 add，单个失败不影响整体
      Promise.all(
        ASSETS.map((u) =>
          c.add(new Request(u, { cache: 'reload' })).catch(() => null)
        )
      )
    ).then(() => self.skipWaiting())
  );
});

/* 激活：清理旧版本缓存 */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

/* 是否属于云端接口（不缓存） */
function isCloudRequest(url) {
  return /supabase\.(co|in)/i.test(url.hostname) ||
         /cloudbase|tcb|tencentcloudapi/i.test(url.hostname);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;

  // 只处理 GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 外部/云端请求：直连，不拦截
  if (url.origin !== self.location.origin || isCloudRequest(url)) return;

  // 页面导航：网络优先
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // 静态资源：缓存优先 + 后台静默更新
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/* 收到主线程消息：立即更新 */
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
