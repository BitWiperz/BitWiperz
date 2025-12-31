import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { authService } from "./services/authService";

// Optionally validate existing session on startup; only clear if invalid
(async () => {
  try {
    await authService.validateSessionOnStartup?.();
  } catch {
    // ignore startup validation errors
  }
})();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
