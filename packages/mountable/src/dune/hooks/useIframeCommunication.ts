import { useRef, useEffect } from "react";
import { MESSAGE_TYPES } from "../constants";
import { Credentials, CredentialsMessage, IncomingMessage } from "../types";

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
      if (!credentials || !iframeRef.current?.contentWindow) {
        return;
      }

      try {
        const message: CredentialsMessage = {
          type: MESSAGE_TYPES.PROVIDE_CREDENTIALS,
          credentials: {
            token: credentials.token,
            project: credentials.project,
            baseUrl: credentials.baseUrl,
          },
        };
        // TODO: Security consideration - using specific targetOrigin instead of '*'
        // This prevents credentials from being sent to unintended recipients
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

      // Handle credential requests from iframe
      if (
        message?.type === MESSAGE_TYPES.APP_READY ||
        message?.type === MESSAGE_TYPES.REQUEST_CREDENTIALS
      ) {
        sendCredentials();
      }
    };

    // Listen for messages from iframe
    window.addEventListener("message", handleMessage);

    // Send credentials when iframe loads
    const handleIframeLoad = () => {
      sendCredentials();
    };

    // Add load event listener
    const iframe = iframeRef.current;
    if (iframe) {
      iframe.addEventListener("load", handleIframeLoad);
    }

    // Cleanup
    return () => {
      window.removeEventListener("message", handleMessage);
      if (iframe) {
        iframe.removeEventListener("load", handleIframeLoad);
      }
    };
  }, [credentials, targetOrigin]);

  return { iframeRef };
};
