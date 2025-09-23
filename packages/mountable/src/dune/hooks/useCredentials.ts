import { useState, useEffect } from "react";
import { Credentials } from "../types";

/**
 * Hook to handle receiving credentials from Fusion framework
 */
export const useCredentials = () => {
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Handle credentials from Fusion
      if (event.data?.token && event.data?.project && event.data?.baseUrl) {
        console.log("Received credentials from Fusion:", {
          project: event.data.project,
          baseUrl: event.data.baseUrl,
          tokenLength: event.data.token.length,
        });

        setCredentials({
          token: event.data.token,
          project: event.data.project,
          baseUrl: event.data.baseUrl,
        });
      }
    };

    // Listen for messages from parent window
    window.addEventListener("message", handleMessage);

    // Send app ready signal to parent window (Fusion)
    if (window.parent !== window) {
      console.log("Sending app-ready signal to parent window");
      window.parent.postMessage({ type: "APP_HOST_READY" }, "*");
    }

    // Cleanup
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  return { credentials };
};
