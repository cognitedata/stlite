/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

import type {
  AppFiles,
  CacheEntry,
  RegisterAppResponse,
  ShouldUpdateAppResponse,
  SWIncomingMessage,
} from "./sw/types";

// Minimal Service Worker bootstrap
// Step 1: only handle installation and activation

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

// Cache storage - keyed by cluster::project::appId
const appCaches = new Map<string, CacheEntry>();

// Helper functions
function createCacheKey(
  cluster: string,
  project: string,
  appId: string,
): string {
  return `${cluster}::${project}::${appId}`;
}

function shouldUpdateApp(
  cluster: string,
  project: string,
  appId: string,
  lastUpdatedTime: number,
): ShouldUpdateAppResponse {
  const cacheKey = createCacheKey(cluster, project, appId);
  const existingEntry = appCaches.get(cacheKey);

  if (!existingEntry) {
    return {
      shouldUpdate: true,
      message: `App ${appId} not cached, needs to be cached`,
      cacheKey,
    };
  }

  if (existingEntry.lastUpdatedTime === lastUpdatedTime) {
    return {
      shouldUpdate: false,
      message: `App ${appId} already cached with same timestamp`,
      cacheKey,
      currentLastUpdated: existingEntry.lastUpdatedTime,
    };
  }

  // Compare unix timestamps directly
  if (lastUpdatedTime > existingEntry.lastUpdatedTime) {
    return {
      shouldUpdate: true,
      message: `App ${appId} has newer version available`,
      cacheKey,
      currentLastUpdated: existingEntry.lastUpdatedTime,
    };
  }

  return {
    shouldUpdate: false,
    message: `App ${appId} cached version is newer than requested`,
    cacheKey,
    currentLastUpdated: existingEntry.lastUpdatedTime,
  };
}

function registerApp(
  cluster: string,
  project: string,
  appId: string,
  lastUpdatedTime: number,
  files: AppFiles,
): RegisterAppResponse {
  const cacheKey = createCacheKey(cluster, project, appId);

  // Cache the files
  appCaches.set(cacheKey, {
    files,
    lastUpdatedTime,
  });

  console.log(`Cached app ${appId} with ${Object.keys(files).length} files`);

  return {
    success: true,
    message: `App ${appId} cached successfully`,
    cacheKey,
  };
}

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

// Handle messages from the main thread
self.addEventListener("message", (event: any) => {
  const message = event.data as SWIncomingMessage;

  if (message.type === "REGISTER_APP") {
    const { cluster, project, appId, lastUpdatedTime, files } = message.payload;

    try {
      const response = registerApp(
        cluster,
        project,
        appId,
        lastUpdatedTime,
        files,
      );

      // Send response back to the main thread
      event.ports[0]?.postMessage(response);
    } catch (error) {
      const errorResponse: RegisterAppResponse = {
        success: false,
        message: `Failed to cache app ${appId}: ${error}`,
        cacheKey: createCacheKey(cluster, project, appId),
      };

      event.ports[0]?.postMessage(errorResponse);
    }
  } else if (message.type === "SHOULD_UPDATE_APP") {
    const { cluster, project, appId, lastUpdatedTime } = message.payload;

    try {
      const response = shouldUpdateApp(
        cluster,
        project,
        appId,
        lastUpdatedTime,
      );

      // Send response back to the main thread
      event.ports[0]?.postMessage(response);
    } catch (error) {
      const errorResponse: ShouldUpdateAppResponse = {
        shouldUpdate: false,
        message: `Failed to check app ${appId}: ${error}`,
        cacheKey: createCacheKey(cluster, project, appId),
      };

      event.ports[0]?.postMessage(errorResponse);
    }
  }
});

// Export to make this a module (fixes TypeScript error)
export {};
