import React from "react";
import { useParams } from "react-router-dom";
import { useCredentials } from "./hooks/useCredentials";
import { useIframeCommunication } from "./hooks/useIframeCommunication";
import { LoadingState } from "./components/LoadingState";

/**
 * App host component for development mode
 * Loads Streamlit apps from localhost:port during development
 * Handles credential passing to the iframe
 */
export const AppHostDevelopment: React.FC = () => {
  const { port } = useParams<{ port: string }>();
  const { credentials } = useCredentials();
  const { iframeRef } = useIframeCommunication(credentials);

  // Wait for credentials from Fusion
  if (!credentials) {
    return <LoadingState message="Waiting for credentials from Fusion..." />;
  }

  // Load from localhost:port
  if (!port) {
    return <div>Error: No port specified for development mode</div>;
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
