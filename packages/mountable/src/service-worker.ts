/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

// Minimal Service Worker bootstrap
// Step 1: only handle installation and activation

const SW_VERSION = "1.0.0"; // Bump to force update when changing SW

// Install: prepare the worker and activate immediately
self.addEventListener("install", (event: any) => {
  console.log(`ServiceWorker v${SW_VERSION}: install`);
  console.log(`Manifest entries:`, (self as any).__WB_MANIFEST?.length || 0);
  (self as any).skipWaiting();
});

// Activate: take control of existing clients immediately
self.addEventListener("activate", (event: any) => {
  console.log(`ServiceWorker v${SW_VERSION}: activate`);
  event.waitUntil((self as any).clients.claim());
});

// Export to make this a module (fixes TypeScript error)
export {};
