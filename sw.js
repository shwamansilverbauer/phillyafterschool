// The service worker for Philly After School. It does one job: show the notifications the site sends (a sign-up date
// for something you follow) and open the right page when one is tapped. It keeps no copy of the site and never
// touches a page's requests.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

// An address on this site, or the home page: a notification never opens anywhere else.
function ownUrl(u) {
  try { var x = new URL(u || '/', self.location.origin); return x.origin === self.location.origin ? x.href : self.location.origin + '/'; }
  catch (err) { return self.location.origin + '/'; }
}

self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }
  var title = typeof d.title === 'string' && d.title ? d.title : 'Philly After School';
  var opts = { body: typeof d.body === 'string' ? d.body : '', icon: '/icon-192.png', badge: '/icon-192.png', data: { url: ownUrl(d.url) } };
  if (typeof d.tag === 'string' && d.tag) opts.tag = d.tag;   // the same date told twice replaces itself
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = ownUrl(e.notification.data && e.notification.data.url);
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if (list[i].url === url && 'focus' in list[i]) return list[i].focus();
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
