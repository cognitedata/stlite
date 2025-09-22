import React from "react";
import { useParams } from "react-router-dom";
import { useCredentials } from "./hooks";

/**
 * Component for the /dune route - handles Fusion integration
 * Sends app ready signal and receives credentials from Fusion
 */
export const AppWithCredentials: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const { credentials } = useCredentials();

  // Show loading state while waiting for credentials from Fusion
  if (!credentials) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontSize: "16px",
          color: "#666",
          fontFamily: "sans-serif",
        }}
      >
        <div>Waiting for credentials from Fusion...</div>
        <div style={{ marginTop: "10px", fontSize: "14px" }}>
          (app-ready signal sent)
        </div>
      </div>
    );
  }

  // Display received credentials
  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "sans-serif",
      }}
    >
      <h2>Credentials Received! ✅</h2>
      <div
        style={{
          backgroundColor: "#f5f5f5",
          padding: "15px",
          borderRadius: "5px",
          marginTop: "20px",
        }}
      >
        <p>
          <strong>Project:</strong> {credentials.project}
        </p>
        <p>
          <strong>Base URL:</strong> {credentials.baseUrl}
        </p>
        <p>
          <strong>App ID:</strong> {appId}
        </p>
        <p>
          <strong>Bearer Token:</strong>
        </p>
        <div
          style={{
            backgroundColor: "#fff",
            padding: "10px",
            borderRadius: "3px",
            marginTop: "5px",
            wordBreak: "break-all",
            fontSize: "12px",
            fontFamily: "monospace",
            border: "1px solid #ddd",
          }}
        >
          {credentials.token}
        </div>
      </div>
      <div
        style={{
          marginTop: "20px",
          padding: "10px",
          backgroundColor: "#d4edda",
          borderRadius: "5px",
          color: "#155724",
        }}
      >
        Step 2 Complete: App ready signal sent and credentials received!
      </div>
    </div>
  );
};

export default AppWithCredentials;
