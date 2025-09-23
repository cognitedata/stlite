/**
 * Message types for iframe communication
 */
export const MESSAGE_TYPES = {
  APP_READY: "APP_READY",
  PROVIDE_CREDENTIALS: "PROVIDE_CREDENTIALS",
} as const;

/**
 * Type union of all message types
 */
export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

/**
 * Credentials interface for authentication
 */
export interface Credentials {
  token: string;
  project: string;
  baseUrl: string;
}

/**
 * Message sent from iframe when it's ready to receive credentials
 */
export interface AppReadyMessage {
  type: typeof MESSAGE_TYPES.APP_READY;
}

/**
 * Message sent to iframe containing credentials
 */
export interface ProvideCredentialsMessage {
  type: typeof MESSAGE_TYPES.PROVIDE_CREDENTIALS;
  credentials: Credentials;
}

/**
 * Union type for all incoming messages from iframe
 */
export type IncomingMessage = AppReadyMessage;

/**
 * Union type for all outgoing messages to iframe
 */
export type OutgoingMessage = ProvideCredentialsMessage;
