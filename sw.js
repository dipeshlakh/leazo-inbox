// Leazo Inbox — Service Worker
// Caches the app shell so it loads instantly and works offline

const CACHE    = 'leazo-inbox-v1';
const PRECACHE = [
  '/',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Anton&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

// Install — cache app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, cache fallback
// Supabase API calls always go to network (never cached)
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never cache Supabase API or Meta API calls
  if (url.includes('supabase.co') || url.includes('graph.facebook.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network first for everything else
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache fresh responses
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request)) // fallback to cache if offline
  );
});
