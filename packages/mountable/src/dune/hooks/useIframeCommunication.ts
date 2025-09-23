import { useRef, useEffect } from "react";
import {
  MESSAGE_TYPES,
  Credentials,
  ProvideCredentialsMessage,
  IncomingMessage,
} from "../types/messages";

/**
 * Hook to handle iframe credential communication
 * Manages secure credential exchange between the host and iframe application
 */
export const useIframeCredentials = (
  credentials: Credentials | null,
  targetOrigin: string,
) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!credentials || !iframeRef.current) {
      return;
    }

    /**
     * Send credentials to iframe with error handling
     * Defined inside effect to avoid dependency issues
     */
    const sendCredentials = () => {
      if (!iframeRef.current?.contentWindow) {
        return;
      }

      try {
        const message: ProvideCredentialsMessage = {
          type: MESSAGE_TYPES.PROVIDE_CREDENTIALS,
          credentials: {
            token: credentials.token,
            project: credentials.project,
            baseUrl: credentials.baseUrl,
          },
        };

        iframeRef.current.contentWindow.postMessage(message, targetOrigin);
      } catch (error) {
        console.error("Failed to send credentials to iframe:", error);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      // Filter out noise messages from setImmediate and other sources
      if (
        typeof event.data === "string" &&
        event.data.startsWith("setImmediate")
      ) {
        return;
      }

      // Validate origin for security - must match our expected targetOrigin
      if (event.origin !== targetOrigin) {
        console.warn(
          `Ignoring message from untrusted origin: ${event.origin}, expected: ${targetOrigin}`,
        );
        return;
      }

      // Type guard for incoming messages
      const message = event.data as IncomingMessage;

      // Handle APP_READY message from iframe
      if (message?.type === MESSAGE_TYPES.APP_READY) {
        sendCredentials();
      }
    };

    // Listen for messages from iframe
    window.addEventListener("message", handleMessage);

    // Cleanup
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [credentials, targetOrigin]);

  return { iframeRef };
};
