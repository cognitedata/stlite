import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { StreamlitLegacy } from "./StreamlitLegacy";
import AppWithCredentials from "./dune/AppWithCredentials";
import AppHostDevelopment from "./dune/AppHostDevelopment";

/**
 * Landing component with router
 * Routes to either AppHostDevelopment for development, AppWithCredentials for production apps, or StreamlitLegacy for root
 */
const Landing: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/development/:port" element={<AppHostDevelopment />} />
        <Route path="/:appId" element={<AppWithCredentials />} />
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
