import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useCredentials, useFetchFileContent } from "./hooks";
import { processZipFile, type SourceCodeResult } from "./utils/fileUtils";

/**
 * Component for the /dune route - handles Fusion integration
 * Sends app ready signal and receives credentials from Fusion
 */
export const AppWithCredentials: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();
  const { credentials } = useCredentials();
  const [sourceCode, setSourceCode] = useState<SourceCodeResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<Error | null>(null);

  // Fetch file content using the new hooks with direct API calls
  const {
    fileContent,
    isLoading: isFetching,
    error: fetchError,
  } = useFetchFileContent(appId, credentials);

  // Process ZIP file when fileContent is available
  useEffect(() => {
    let isActive = true;
    if (fileContent) {
      setIsProcessing(true);
      setProcessingError(null);

      processZipFile(fileContent.binaryData, fileContent.fileName)
        .then((result) => {
          if (isActive) {
            setSourceCode(result);
          }
          setIsProcessing(false);
        })
        .catch((error) => {
          if (isActive) {
            setProcessingError(error);
          }
          setIsProcessing(false);
        });
    }

    return () => {
      isActive = false;
    };
  }, [fileContent]);

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
          </div>
        )}

        {isProcessing && (
          <div style={{ color: "#007bff", marginBottom: "10px" }}>
            🔄 Processing ZIP file...
          </div>
        )}

        {processingError && (
          <div style={{ color: "#dc3545", marginBottom: "10px" }}>
            ❌ Processing Error: {processingError.message}
          </div>
        )}

        {sourceCode && (
          <div style={{ marginBottom: "15px" }}>
            <h4>ZIP Contents ({Object.keys(sourceCode).length} files):</h4>
            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                border: "1px solid #ddd",
                borderRadius: "3px",
                padding: "10px",
                backgroundColor: "#f8f9fa",
              }}
            >
              {Object.keys(sourceCode).map((filePath) => (
                <div
                  key={filePath}
                  style={{
                    padding: "5px",
                    borderBottom: "1px solid #eee",
                    fontFamily: "monospace",
                    fontSize: "12px",
                  }}
                >
                  <strong>{filePath}</strong>
                  <span style={{ color: "#666", marginLeft: "10px" }}>
                    ({sourceCode[filePath].length} chars)
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                console.log("📁 Full sourceCode object:", sourceCode);
                console.log("📊 File count:", Object.keys(sourceCode).length);
              }}
              style={{
                marginTop: "10px",
                padding: "5px 10px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Log ZIP Contents to Console
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppWithCredentials;
