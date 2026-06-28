// Leazo Inbox — Service Worker
// Caches the app shell + handles push notifications

const CACHE    = 'leazo-inbox-v5';
const PRECACHE = [
  '/',
  '/index.html',
  'https://fonts.googleapis.com/css2?family=Anton&family=DM+Sans:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

// ════════════════════════════════════════════
// INSTALL — cache app shell
// ════════════════════════════════════════════
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// ════════════════════════════════════════════
// ACTIVATE — clean old caches
// ════════════════════════════════════════════
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ════════════════════════════════════════════
// FETCH — network first, cache fallback
// ════════════════════════════════════════════
self.addEventListener('fetch', e => {
  const url = e.request.url;

  if (url.includes('supabase.co') || url.includes('graph.facebook.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ════════════════════════════════════════════
// PUSH — show notification when a push arrives
// ════════════════════════════════════════════
self.addEventListener('push', e => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
    data = { title: 'Leazo Inbox', body: e.data ? e.data.text() : 'New message' };
  }

  const title = data.title || 'Leazo Inbox';
  const options = {
    body: data.body || 'New message received',
    icon: '/leazo-inbox.png',
    badge: '/leazo-inbox.png',
    tag: data.conversationId ? `conv-${data.conversationId}` : 'leazo-msg',
    renotify: true,
    data: {
      conversationId: data.conversationId || null,
      url: data.url || '/',
    },
    vibrate: [200, 100, 200],
  };

  e.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);

      if ('setAppBadge' in self.registration) {
        try {
          const current = await self.registration.getNotifications();
          await self.registration.setAppBadge(current.length);
        } catch (err) { /* badge not supported — ignore */ }
      }

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach(client => {
        client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND' });
      });
    })()
  );
});

// ════════════════════════════════════════════
// NOTIFICATION CLICK — open/focus the inbox
// ════════════════════════════════════════════
self.addEventListener('notificationclick', e => {
  e.notification.close();

  const targetUrl = e.notification.data?.url || '/';

  e.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of clients) {
        if ((client.url.includes('index.html') || client.url.endsWith('/') || client.url.endsWith('leazo.in')) && 'focus' in client) {
          client.postMessage({
            type: 'OPEN_CONVERSATION',
            conversationId: e.notification.data?.conversationId || null,
          });
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );

  if ('setAppBadge' in self.registration) {
    self.registration.setAppBadge(0).catch(() => {});
  }
});

// ════════════════════════════════════════════
// NOTIFICATION CLOSE — update badge count
// ════════════════════════════════════════════
self.addEventListener('notificationclose', e => {
  if ('setAppBadge' in self.registration) {
    self.registration.getNotifications().then(notifs => {
      self.registration.setAppBadge(notifs.length).catch(() => {});
    });
  }
});
