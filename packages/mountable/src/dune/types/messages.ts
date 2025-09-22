import { MESSAGE_TYPES } from "../constants";

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
 * Message sent from iframe requesting credentials
 */
export interface RequestCredentialsMessage {
  type: typeof MESSAGE_TYPES.REQUEST_CREDENTIALS;
}

/**
 * Message sent to iframe containing credentials
 */
export interface CredentialsMessage {
  type: typeof MESSAGE_TYPES.PROVIDE_CREDENTIALS;
  credentials: Credentials;
}

/**
 * Union type for all incoming messages from iframe
 */
export type IncomingMessage = AppReadyMessage | RequestCredentialsMessage;

/**
 * Union type for all outgoing messages to iframe
 */
export type OutgoingMessage = CredentialsMessage;
