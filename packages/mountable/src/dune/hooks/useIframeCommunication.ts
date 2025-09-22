import { useRef, useEffect } from "react";
import { Credentials } from "./useCredentials";

/**
 * Hook to handle iframe communication for passing credentials
 * Handles the token exchange pattern with the app inside the iframe
 */
export const useIframeCommunication = (credentials: Credentials | null) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!credentials || !iframeRef.current) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      // Listen for messages from the iframe requesting credentials
      if (
        event.data?.type === "APP_READY" ||
        event.data?.type === "REQUEST_CREDENTIALS"
      ) {
        if (iframeRef.current?.contentWindow) {
          const message = {
            type: "CREDENTIALS",
            credentials: {
              token: credentials.token,
              project: credentials.project,
              baseUrl: credentials.baseUrl,
            },
          };
          iframeRef.current.contentWindow.postMessage(message, "*");
        }
      }
    };

    // Listen for messages from iframe
    window.addEventListener("message", handleMessage);

    // Send credentials once iframe loads
    const handleIframeLoad = () => {
      if (iframeRef.current?.contentWindow) {
        const message = {
          type: "CREDENTIALS",
          credentials: {
            token: credentials.token,
            project: credentials.project,
            baseUrl: credentials.baseUrl,
          },
        };
        iframeRef.current.contentWindow.postMessage(message, "*");
      }
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
  }, [credentials]);

  return { iframeRef };
};
