import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { authService } from "./services/authService";

// Clear any persisted authentication on app startup to force re-login
authService.logout();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
