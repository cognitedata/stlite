/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

const SW_VERSION = "1.0.0"; // Bump to force update when changing SW

// Service worker global scope - minimal interface for what we actually use
// Using 'declare const self' with custom interface instead of official ServiceWorkerGlobalScope:
// - Avoids TypeScript lib conflicts between DOM and WebWorker environments
// - Provides type safety for service worker methods without global pollution
// - Works perfectly without webworker lib reference that was causing conflicts
// - Simpler than casting globalThis - declare is compile-time only, no runtime overhead
declare const self: {
  addEventListener: (type: string, listener: (event: any) => void) => void;
  skipWaiting: () => void;
  clients: { claim: () => Promise<void> };
  __WB_MANIFEST?: any[];
} & typeof globalThis;

// Install: prepare the worker and activate immediately
self.addEventListener("install", (event: any) => {
  console.log(`ServiceWorker v${SW_VERSION}: install`);
  console.log(`Manifest entries:`, self.__WB_MANIFEST?.length || 0);
  self.skipWaiting();
});

// Activate: take control of existing clients immediately
self.addEventListener("activate", (event: any) => {
  console.log(`ServiceWorker v${SW_VERSION}: activate`);
  event.waitUntil(self.clients.claim());
});

// Export to make this a module (fixes TypeScript error)
export {};
