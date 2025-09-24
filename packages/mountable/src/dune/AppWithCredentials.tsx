import React from "react";
import { useParams } from "react-router-dom";
import {
  useCredentials,
  useFetchFileContent,
  useParseFileContent,
} from "./hooks";
import { CogniteClient } from "@cognite/sdk";

/**
 * Component for the /dune route - handles Fusion integration
 * Sends app ready signal and receives credentials from Fusion
 */
export const AppWithCredentials: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const { credentials } = useCredentials();
  console.log("WTF IS THIS!!!");
  // Create SDK instance when credentials are available
  const sdk = React.useMemo(() => {
    if (!credentials) return null;

    return new CogniteClient({
      appId: "stlite-dune-test",
      project: credentials.project,
      baseUrl: credentials.baseUrl,
      oidcTokenProvider: async () => credentials.token,
    });
  }, [credentials]);

  // Fetch file content using the new hooks
  const {
    fileContent,
    isLoading: isFetching,
    error: fetchError,
  } = useFetchFileContent(appId, sdk);
  const {
    sourceCode,
    isLoading: isParsing,
    error: parseError,
  } = useParseFileContent(fileContent);

  // Console logging for debugging
  React.useEffect(() => {
    console.log("🔍 AppWithCredentials Debug Info:");
    console.log("appId:", appId);
    console.log("credentials:", credentials);
    console.log("sdk:", sdk);
    console.log("fileContent:", fileContent);
    console.log("sourceCode:", sourceCode);
    console.log("isFetching:", isFetching);
    console.log("isParsing:", isParsing);
    console.log("fetchError:", fetchError);
    console.log("parseError:", parseError);
  }, [
    appId,
    credentials,
    sdk,
    fileContent,
    sourceCode,
    isFetching,
    isParsing,
    fetchError,
    parseError,
  ]);

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

        {isParsing && (
          <div style={{ color: "#007bff", marginBottom: "10px" }}>
            🔄 Parsing file content...
          </div>
        )}

        {parseError && (
          <div style={{ color: "#dc3545", marginBottom: "10px" }}>
            ❌ Parse Error: {parseError.message}
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

        {sourceCode && (
          <div>
            <h4>Parsed Source Code:</h4>
            <button
              onClick={() => {
                console.log("📝 Full sourceCode object:", sourceCode);
                console.log("📋 File count:", Object.keys(sourceCode).length);
                Object.entries(sourceCode).forEach(([filePath, content]) => {
                  console.log(`📄 File: ${filePath}`, {
                    path: filePath,
                    contentLength: content.length,
                    contentPreview:
                      content.substring(0, 200) +
                      (content.length > 200 ? "..." : ""),
                    fullContent: content,
                  });
                });
              }}
              style={{
                marginBottom: "15px",
                padding: "8px 15px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Log Source Code to Console
            </button>
            <div
              style={{
                backgroundColor: "#fff",
                padding: "15px",
                borderRadius: "3px",
                border: "1px solid #ddd",
                maxHeight: "300px",
                overflow: "auto",
                fontSize: "12px",
                fontFamily: "monospace",
              }}
            >
              {Object.keys(sourceCode).length === 0 ? (
                <div style={{ color: "#666" }}>No files found</div>
              ) : (
                Object.entries(sourceCode).map(([filePath, content]) => (
                  <div key={filePath} style={{ marginBottom: "20px" }}>
                    <div
                      style={{
                        fontWeight: "bold",
                        color: "#007bff",
                        marginBottom: "5px",
                      }}
                    >
                      📄 {filePath}
                    </div>
                    <div
                      style={{
                        backgroundColor: "#f8f9fa",
                        padding: "10px",
                        borderRadius: "3px",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        maxHeight: "200px",
                        overflow: "auto",
                      }}
                    >
                      {content.length > 1000
                        ? `${content.substring(0, 1000)}... (truncated, ${content.length} total chars)`
                        : content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppWithCredentials;
