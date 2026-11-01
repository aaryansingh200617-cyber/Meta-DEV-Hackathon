/* HerWay Beacon — trusted-contact service worker: shows push notifications and confirms receipt ("delivered"). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { /* ignore */ }
  const title = data.title || 'HerWay Beacon';
  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: data.body || 'Someone in your circle needs you. Open to respond.',
      tag: data.tag, renotify: true, requireInteraction: true, icon: '/icon.svg', badge: '/icon.svg', data: { url: data.url || '/' },
    });
    // Tell the server the push really reached this device → relay notification becomes "delivered".
    if (data.receipt && data.notificationId) {
      try { await fetch(data.receipt, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: data.notificationId }) }); } catch (_) { /* offline: stays "sent" */ }
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if (c.url.includes(url) && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  })());
});
