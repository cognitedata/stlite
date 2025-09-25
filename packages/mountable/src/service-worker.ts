/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals */

import {
  extractProjectFromPath,
  getCachedContentForUrl,
  getContentType,
} from "./sw/lib";

// Service Worker for App Store
// Handles caching and serving of app files in memory

const SW_VERSION = "1.0.3"; // Change this when you update the service worker

// Store for file contents received from main thread
// Organized by project to prevent cross-contamination
const projectCaches = new Map<string, Map<string, unknown>>(); // project -> fileContents Map

// Type definitions for service worker messages
interface CacheAppFilesMessage {
  type: "CACHE_APP_FILES";
  payload: {
    appId: string;
    files: Record<string, unknown>;
    project: string;
  };
}

interface ClaimControlMessage {
  type: "CLAIM_CONTROL";
}

type ServiceWorkerMessage = CacheAppFilesMessage | ClaimControlMessage;

interface CacheAppFilesResponse {
  type: "CACHE_APP_FILES_RESPONSE";
  payload: {
    appId: string;
    project: string;
    success: boolean;
  };
}

// Handle messages from the main thread
self.addEventListener("message", (event: any) => {
  const message = event.data as ServiceWorkerMessage;

  if (message.type === "CLAIM_CONTROL") {
    (self as any).clients.claim();
  }

  if (message.type === "CACHE_APP_FILES") {
    const { appId, files, project } = message.payload;

    // Get or create project-specific cache
    if (!projectCaches.has(project)) {
      projectCaches.set(project, new Map());
    }
    const fileContents = projectCaches.get(project)!;

    // Store file contents in project-specific cache for quick access
    Object.entries(files).forEach(([filePath, content]) => {
      // Store with multiple path formats for flexible matching
      const appFileUrl = `${(self as any).location.origin}/app-files/${appId}/${filePath}`;
      const relativePath = `./${filePath}`;
      const absolutePath = `/${filePath}`;

      fileContents.set(appFileUrl, content);
      fileContents.set(relativePath, content);
      fileContents.set(absolutePath, content);
      fileContents.set(filePath, content); // Just the filename
    });

    // Send response back to main thread
    const response: CacheAppFilesResponse = {
      type: "CACHE_APP_FILES_RESPONSE",
      payload: { appId, project, success: true },
    };

    event.ports[0]?.postMessage(response);

    // Also send message to all clients
    (self as any).clients.matchAll().then((clients: any[]) => {
      clients.forEach((client: any) => {
        client.postMessage(response);
      });
    });
  }
});

// The main fetch event listener
self.addEventListener("fetch", (event: any) => {
  const url = new URL(event.request.url);

  console.log(`ServiceWorker: Intercepted request for: ${url.pathname}`);

  // Try to determine project from URL or referrer
  let project: string | null = null;

  // Method 1: Try to extract project from URL path
  const urlPath = url.pathname;
  const fromPath = extractProjectFromPath(urlPath);
  if (fromPath) {
    project = fromPath;
  }

  // Method 2: Try to get project from referrer if available
  if (!project && event.request.referrer) {
    const referrerUrl = new URL(event.request.referrer);
    const referrerProject = extractProjectFromPath(referrerUrl.pathname);
    if (referrerProject) {
      project = referrerProject;
    }
  }

  // Method 3: Try to get project from client (if available)
  if (!project) {
    // This is a fallback - we'll search all project caches
    console.log("ServiceWorker: No project detected, searching all caches");
  }

  let cachedContent: unknown | null = null;

  if (project && projectCaches.has(project)) {
    // Search in specific project cache
    const fileContents = projectCaches.get(project)!;
    cachedContent = getCachedContentForUrl(fileContents, url);
  } else {
    // Fallback: search all project caches (for backward compatibility)
    for (const [proj, fileContents] of Array.from(projectCaches.entries())) {
      const maybe = getCachedContentForUrl(fileContents, url);
      if (maybe) {
        cachedContent = maybe;
        console.log(`ServiceWorker: Found in project cache: ${proj}`);
        break;
      }
    }
  }

  if (cachedContent) {
    console.log(
      `ServiceWorker: ✅ Serving cached file: ${url.pathname} (project: ${project || "unknown"})`,
    );
    const contentType = getContentType(url.pathname);
    return event.respondWith(
      new Response(cachedContent as BodyInit, {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000",
        },
      }),
    );
  }

  // Not in cache, fetch normally
  return event.respondWith(fetch(event.request));
});

// Service worker installation
self.addEventListener("install", (event: any) => {
  console.log(`ServiceWorker v${SW_VERSION}: Installing...`);
  (self as any).skipWaiting();
});

// Service worker activation
self.addEventListener("activate", (event: any) => {
  console.log(`ServiceWorker v${SW_VERSION}: Activating...`);
  event.waitUntil(
    Promise.all([
      (self as any).clients.claim(),
      // Clear any old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (cacheName) => cacheName !== `app-store-cache-${SW_VERSION}`,
            )
            .map((cacheName) => {
              console.log(`ServiceWorker: Deleting old cache: ${cacheName}`);
              return caches.delete(cacheName);
            }),
        );
      }),
    ]),
  );
});
