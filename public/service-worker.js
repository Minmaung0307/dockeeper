// v1 ဖြစ်နေတာကို v2 (သို့) v3 လို့ ပြောင်းလိုက်ပါ
const CACHE_NAME = 'dockeeper-v3-fix'; 

// အောက်က ကျန်တဲ့ကုဒ်တွေ အတူတူပါပဲ...
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request);
    })
  );
});