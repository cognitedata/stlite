import { useCallback } from "react";
import {
  sendMessage as sendMessageUtil,
  shouldUpdateApp as shouldUpdateAppUtil,
  registerApp as registerAppUtil,
  ensureAppIsReady as ensureAppIsReadyUtil,
  isServiceWorkerAvailable as isServiceWorkerAvailableUtil,
  type ServiceWorkerMessage,
  type ShouldUpdateAppPayload,
  type RegisterAppPayload,
  type ServiceWorkerResponse,
} from "../utils/serviceWorkerUtils";

/**
 * Custom hook for communicating with the service worker
 */
export const useServiceWorker = () => {
  const sendMessage = useCallback(
    <T = ServiceWorkerResponse>(message: ServiceWorkerMessage): Promise<T> => {
      return sendMessageUtil<T>(message);
    },
    [],
  );

  const shouldUpdateApp = useCallback(
    async (payload: ShouldUpdateAppPayload): Promise<ServiceWorkerResponse> => {
      return shouldUpdateAppUtil(payload);
    },
    [],
  );

  const registerApp = useCallback(
    async (payload: RegisterAppPayload): Promise<ServiceWorkerResponse> => {
      return registerAppUtil(payload);
    },
    [],
  );

  const ensureAppIsReady = useCallback(
    async (
      payload: ShouldUpdateAppPayload & { files: Record<string, string> },
    ): Promise<ServiceWorkerResponse> => {
      return ensureAppIsReadyUtil(payload);
    },
    [],
  );

  const isServiceWorkerAvailable = useCallback(() => {
    return isServiceWorkerAvailableUtil();
  }, []);

  return {
    sendMessage,
    shouldUpdateApp,
    registerApp,
    ensureAppIsReady,
    isServiceWorkerAvailable,
  };
};

// Re-export types for convenience
export type {
  ServiceWorkerMessage,
  ShouldUpdateAppPayload,
  RegisterAppPayload,
  ServiceWorkerResponse,
};
