/**
 * Message types for iframe communication
 */
export const MESSAGE_TYPES = {
  APP_READY: "APP_READY",
  REQUEST_CREDENTIALS: "REQUEST_CREDENTIALS",
  PROVIDE_CREDENTIALS: "PROVIDE_CREDENTIALS",
} as const;

/**
 * Type union of all message types
 */
export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];
