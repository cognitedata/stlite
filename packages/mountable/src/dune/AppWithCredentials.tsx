import React from "react";
import { useParams } from "react-router-dom";
import { useCredentials, useFetchFileContent } from "./hooks";

/**
 * Component for the /dune route - handles Fusion integration
 * Sends app ready signal and receives credentials from Fusion
 */
export const AppWithCredentials: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const { credentials } = useCredentials();

  // Fetch file content using the new hooks with direct API calls
  const {
    fileContent,
    isLoading: isFetching,
    error: fetchError,
  } = useFetchFileContent(appId, credentials);

  // Console logging for debugging
  React.useEffect(() => {
    console.log("🔍 AppWithCredentials Debug Info:");
    console.log("appId:", appId);
    console.log("credentials:", credentials);
    console.log("fileContent:", fileContent);
    console.log("isFetching:", isFetching);
    console.log("fetchError:", fetchError);
  }, [appId, credentials, fileContent, isFetching, fetchError]);

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

      {/* File Content Testing Section */}
      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          backgroundColor: "#f8f9fa",
          borderRadius: "5px",
          border: "1px solid #dee2e6",
        }}
      >
        <h3>File Content Testing</h3>

        {isFetching && (
          <div style={{ color: "#007bff", marginBottom: "10px" }}>
            🔄 Fetching file content...
          </div>
        )}

        {fetchError && (
          <div style={{ color: "#dc3545", marginBottom: "10px" }}>
            ❌ Fetch Error: {fetchError.message}
          </div>
        )}

        {fileContent && (
          <div style={{ marginBottom: "15px" }}>
            <h4>File Content Info:</h4>
            <p>
              <strong>File Name:</strong> {fileContent.fileName}
            </p>
            <p>
              <strong>MIME Type:</strong> {fileContent.mimeType || "Unknown"}
            </p>
            <p>
              <strong>Size:</strong> {fileContent.binaryData.byteLength} bytes
            </p>
            {fileContent.lastUpdated && (
              <p>
                <strong>Last Updated:</strong>{" "}
                {fileContent.lastUpdated.toLocaleString()}
              </p>
            )}
            <button
              onClick={() => {
                console.log("📁 Full fileContent object:", fileContent);
                console.log(
                  "📊 Binary data preview (first 100 bytes):",
                  Array.from(
                    new Uint8Array(fileContent.binaryData.slice(0, 100)),
                  ),
                );
              }}
              style={{
                marginTop: "10px",
                padding: "5px 10px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Log File Content to Console
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppWithCredentials;
