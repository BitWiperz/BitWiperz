import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import React, { useEffect } from "react";
import { Sidebar } from "./components";
import { SelectDevices, FieldOptions, Reports, Login, Register } from "./pages";
import { authService } from "./services/authService";
import "./App.css";
// Optional: listen for Tauri window close to clear auth
// If Tauri is not available, this will be a no-op
let appWindow: any;
try {
  // Lazy import to avoid bundling errors in non-tauri environments
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  appWindow = require("@tauri-apps/api/window").appWindow;
} catch {}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = authService.isAuthenticated();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      if (appWindow && appWindow.onCloseRequested) {
        try {
          unlisten = await appWindow.onCloseRequested(async () => {
            await authService.logout();
          });
        } catch {
          // ignore
        }
      }
    })();
    return () => {
      if (typeof unlisten === 'function') {
        try { unlisten(); } catch {}
      }
    };
  }, []);
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/*" element={
          <ProtectedRoute>
            <div className="app-container">
              <Sidebar />
              <main className="main-content">
                <Routes>
                  <Route path="/devices" element={<SelectDevices />} />
                  <Route path="/options" element={<FieldOptions />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/" element={<Navigate to="/devices" replace />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
