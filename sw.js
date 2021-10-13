"use strict";
const MAIN = "MCCacheV3.4-6";
const IMGS = "GalleryV3.4-6";

self.addEventListener("install", function (event) {
	event.waitUntil(
		caches.open(MAIN)
		.then(c => c.addAll( [
			'index.html',
			'editor.js',
			"FileIO.js",
			"color.js",
			"stylesheet.css",
			"color.css"
		]))
	);
	self.skipWaiting();
});

this.addEventListener('activate', function(event) {
	self.clients.matchAll({includeUncontrolled: true})
	.then(cls => cls[0].postMessage("NewVersion"));
	event.waitUntil(
		caches.keys().then(keyList => {
			return Promise.all(keyList.map(function(key) {
				if (key !== MAIN && key != IMGS)
					return caches.delete(key);
			}));
		})
	);
});

self.addEventListener('fetch', function(event) {
	var er = event.request;
	var url = er.url;
	event.respondWith(
		caches.match(er).then(r0 => {
			return r0 || fetch(er).then(r => {
				if (r.ok) {
					var clone = r.clone();
					if (url.endsWith("svg"))
						caches.open(IMGS).then(c => c.put(er, clone));
					else
						caches.open(MAIN).then(c => c.put(er, clone));
				}
				return r;
			});
		})
	);
});
