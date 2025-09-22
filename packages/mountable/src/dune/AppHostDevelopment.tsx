import React from "react";
import { useParams } from "react-router-dom";
import { useCredentials, useIframeCredentials } from "./hooks";

/**
 * App host component for development mode
 * Loads Streamlit apps from localhost:port during development
 * Handles credential passing to the iframe
 */
export const AppHostDevelopment: React.FC = () => {
  const { port } = useParams<{ port: string }>();
  const { credentials } = useCredentials();

  // Setup iframe communication (must be called before any conditional returns)
  // In development mode, we MUST have a port
  if (!port) {
    throw new Error(
      "AppHostDevelopment requires a port parameter - this should never happen!",
    );
  }
  const targetOrigin = `http://localhost:${port}`;
  const { iframeRef } = useIframeCredentials(credentials, targetOrigin);

  // Wait for credentials from Fusion
  if (!credentials) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "16px",
          color: "#666",
          fontFamily: "sans-serif",
        }}
      >
        Waiting for credentials from Fusion...
      </div>
    );
  }

  const iframeSrc = `http://localhost:${port}`;

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      style={{
        width: "100%",
        height: "100vh",
        border: "none",
      }}
      title="Streamlit App Development"
      allow="accelerometer; autoplay; camera; clipboard-write; encrypted-media; geolocation; gyroscope; microphone; picture-in-picture"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
    />
  );
};

export default AppHostDevelopment;
