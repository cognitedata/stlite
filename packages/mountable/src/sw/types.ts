// Service Worker Types

/**
 * Message types for service worker communication
 */
export const SW_MESSAGE_TYPES = {
  REGISTER_APP: "REGISTER_APP",
  SHOULD_UPDATE_APP: "SHOULD_UPDATE_APP",
} as const;

/**
 * Type union of all service worker message types
 */
export type SWMessageType =
  (typeof SW_MESSAGE_TYPES)[keyof typeof SW_MESSAGE_TYPES];

export interface AppFiles {
  [filePath: string]: string; // filePath -> file content
}

export interface CacheEntry {
  files: AppFiles;
  lastUpdatedTime: number; // Unix timestamp (ms)
}

export interface RegisterAppMessage {
  type: typeof SW_MESSAGE_TYPES.REGISTER_APP;
  payload: {
    cluster: string;
    project: string;
    appId: string;
    lastUpdatedTime: number; // Unix timestamp (ms)
    files: AppFiles;
  };
}

export interface RegisterAppResponse {
  success: boolean;
  message: string;
  cacheKey: string;
}

export interface ShouldUpdateAppMessage {
  type: typeof SW_MESSAGE_TYPES.SHOULD_UPDATE_APP;
  payload: {
    cluster: string;
    project: string;
    appId: string;
    lastUpdatedTime: number; // Unix timestamp (ms)
  };
}

export interface ShouldUpdateAppResponse {
  shouldUpdate: boolean;
  message: string;
  cacheKey: string;
  currentLastUpdated?: number; // Unix timestamp (ms)
}

/**
 * Union type for all incoming messages to service worker
 */
export type SWIncomingMessage = RegisterAppMessage | ShouldUpdateAppMessage;

/**
 * Union type for all outgoing messages from service worker
 */
export type SWOutgoingMessage = RegisterAppResponse | ShouldUpdateAppResponse;
