/* global self, clients */
/** Service worker: notificaciones push de alertas MatchProp (escritorio y móvil). */
self.addEventListener('push', (event) => {
  let data = { title: 'MatchProp', body: 'Tenés una novedad', url: '/' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      if (parsed && typeof parsed === 'object') {
        data = { ...data, ...parsed };
      }
    }
  } catch {
    /* texto plano */
    try {
      const t = event.data?.text();
      if (t) data.body = t;
    } catch {
      /* ignore */
    }
  }

  const title = data.title || 'MatchProp';
  const options = {
    body: data.body || '',
    data: { url: data.url || '/' },
    tag: data.tag || 'matchprop-alert',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url || '/';
  const fullUrl = new URL(path, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const c of windowClients) {
        if (c.url && new URL(c.url).origin === self.location.origin && 'focus' in c) {
          if ('navigate' in c && typeof c.navigate === 'function') {
            c.navigate(fullUrl);
          }
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl);
      }
      return undefined;
    })
  );
});
