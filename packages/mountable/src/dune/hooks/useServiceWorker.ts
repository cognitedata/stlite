import { useCallback } from "react";

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
 * Custom hook for communicating with the service worker
 */
export const useServiceWorker = () => {
  /**
   * Send a message to the service worker and return a promise with the response
   */
  const sendMessage = useCallback(
    <T = ServiceWorkerResponse>(message: ServiceWorkerMessage): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!navigator.serviceWorker.controller) {
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
          navigator.serviceWorker.controller.postMessage(message, [
            messageChannel.port2,
          ]);
        } catch (error) {
          reject(error);
        }
      });
    },
    [],
  );

  /**
   * Check if an app should be updated based on its last updated time
   */
  const shouldUpdateApp = useCallback(
    async (payload: ShouldUpdateAppPayload): Promise<ServiceWorkerResponse> => {
      const response = await sendMessage({
        type: "SHOULD_UPDATE_APP",
        payload,
      });

      console.log("🔄 Service Worker shouldUpdateApp Response:", response);
      return response;
    },
    [sendMessage],
  );

  /**
   * Register an app with the service worker cache
   */
  const registerApp = useCallback(
    async (payload: RegisterAppPayload): Promise<ServiceWorkerResponse> => {
      const response = await sendMessage({
        type: "REGISTER_APP",
        payload,
      });

      console.log("🔄 Service Worker registerApp Response:", response);
      return response;
    },
    [sendMessage],
  );

  /**
   * Check if service worker is available
   */
  const isServiceWorkerAvailable = useCallback(() => {
    return "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
  }, []);

  return {
    sendMessage,
    shouldUpdateApp,
    registerApp,
    isServiceWorkerAvailable,
  };
};
