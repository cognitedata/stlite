import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StreamlitLegacy } from "./StreamlitLegacy";

/**
 * Landing component with router
 * Routes to either AppWithCredentials for /:appId paths or StreamlitLegacy for root
 */
const Landing: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StreamlitLegacy />} />
      </Routes>
    </BrowserRouter>
  );
};

// Mount the landing component
ReactDOM.render(
  <React.StrictMode>
    <Landing />
  </React.StrictMode>,
  document.getElementById("root") as HTMLElement,
);

// Export mount for backward compatibility
// This is used by sharing-editor when generating HTML and by external CDN users
export { mountLegacy as mount } from "./StreamlitLegacy";
