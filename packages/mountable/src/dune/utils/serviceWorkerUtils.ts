export interface ServiceWorkerMessage {
  type: "SHOULD_UPDATE_APP" | "REGISTER_APP";
  payload: any;
}

export interface ShouldUpdateAppPayload {
  cluster: string;
  project: string;
  appId: string;
  lastUpdatedTime: number;
}

export interface RegisterAppPayload {
  cluster: string;
  project: string;
  appId: string;
  lastUpdatedTime: number;
  files: Record<string, string>;
}

export interface ServiceWorkerResponse {
  success?: boolean;
  shouldUpdate?: boolean;
  message: string;
  cacheKey: string;
  currentLastUpdated?: number;
}

/**
 * Check if service worker is available and controlled by this page
 */
export const isServiceWorkerAvailable = (): boolean => {
  return "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
};

/**
 * Send a message to the service worker and return a promise with the response
 */
export const sendMessage = async <T = ServiceWorkerResponse>(
  message: ServiceWorkerMessage,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    if (!isServiceWorkerAvailable()) {
      reject(new Error("No service worker controller available"));
      return;
    }

    try {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      messageChannel.port1.onmessageerror = (event) => {
        reject(new Error(`Service Worker message error: ${event.data}`));
      };

      console.log("📤 Sending to Service Worker:", message);
      navigator.serviceWorker.controller!.postMessage(message, [
        messageChannel.port2,
      ]);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Check if an app should be updated based on its last updated time
 */
export const shouldUpdateApp = async (
  payload: ShouldUpdateAppPayload,
): Promise<ServiceWorkerResponse> => {
  const response = await sendMessage({
    type: "SHOULD_UPDATE_APP",
    payload,
  });

  console.log("🔄 Service Worker shouldUpdateApp Response:", response);
  return response;
};

/**
 * Register an app with the service worker cache
 */
export const registerApp = async (
  payload: RegisterAppPayload,
): Promise<ServiceWorkerResponse> => {
  const response = await sendMessage({
    type: "REGISTER_APP",
    payload,
  });

  console.log("🔄 Service Worker registerApp Response:", response);
  return response;
};

/**
 * Complete flow: check if app should be updated, register if needed, return when ready
 */
export const ensureAppIsReady = async (
  payload: ShouldUpdateAppPayload & { files: Record<string, string> },
): Promise<ServiceWorkerResponse> => {
  console.log("🚀 Starting ensureAppIsReady flow for:", payload.appId);

  // Step 1: Check if we should update
  const shouldUpdateResponse = await shouldUpdateApp({
    cluster: payload.cluster,
    project: payload.project,
    appId: payload.appId,
    lastUpdatedTime: payload.lastUpdatedTime,
  });

  console.log("📋 Should update check result:", shouldUpdateResponse);

  // Step 2: If we should update, register the app
  if (shouldUpdateResponse.shouldUpdate) {
    console.log("📦 App needs to be updated, registering...");

    const registerResponse = await registerApp({
      cluster: payload.cluster,
      project: payload.project,
      appId: payload.appId,
      lastUpdatedTime: payload.lastUpdatedTime,
      files: payload.files,
    });

    console.log("✅ App registration complete:", registerResponse);
    return registerResponse;
  } else {
    console.log("✅ App is already up to date, no registration needed");
    return shouldUpdateResponse;
  }
};
