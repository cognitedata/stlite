/**
 * Messages from editor to app
 */
export interface ForwardMessageBase {
  type: string;
  data?: unknown;
}
export interface FileWriteMessage extends ForwardMessageBase {
  type: "file:write";
  data: {
    path: string;
    content: string | Uint8Array;
  };
}
export interface FileRenameMessage extends ForwardMessageBase {
  type: "file:rename";
  data: {
    oldPath: string;
    newPath: string;
  };
}
export type ForwardMessage = FileWriteMessage | FileRenameMessage;

/**
 * Reply message
 */
export interface ReplyMessage {
  type: "reply";
  error?: any;
}