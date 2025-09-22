import React from "react";

interface LoadingStateProps {
  message?: string;
  style?: React.CSSProperties;
}

/**
 * Loading state component shown while waiting for credentials or resources
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = "Loading...",
  style,
}) => {
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
        ...style,
      }}
    >
      {message}
    </div>
  );
};
