"use strict";
const CACHE = "MCCacheV4.1-0";

self.addEventListener("install", function (event) {
	event.waitUntil(
		caches.open(CACHE)
		.then(c => c.addAll( [
			'index.html',
			'editor.js',
			"FileIO.js",
			"color.js",
			"decals.js",
			"stylesheet.css"
		]))
	);
	self.skipWaiting();
});

this.addEventListener('activate', function(event) {
	self.clients.matchAll({includeUncontrolled: true})
	.then(cls => cls[0].postMessage(CACHE));
	event.waitUntil(
		caches.keys().then(keyList => {
			return Promise.all(keyList.map(key => {
				if (key !== CACHE)
					return caches.delete(key);
			}));
		})
	);
});

self.addEventListener('fetch', function(event) {
	var er = event.request;
	event.respondWith(
		caches.match(er).then(r0 => {
			return r0 || fetch(er).then(r => {
				if (r.ok) {
					var clone = r.clone();
					caches.open(CACHE).then(c => c.put(er, clone));
				}
				return r;
			});
		})
	);
});
