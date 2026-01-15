import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import React, { useEffect } from "react";
import { Sidebar } from "./components";
import { SelectDevices, FieldOptions, Reports, Login, Register } from "./pages";
import Welcome from "./pages/Welcome";
import NetworkSetup from "./pages/NetworkSetup";
import { authService } from "./services/authService";
import { WipingProvider } from "./contexts/WipingContext";
import "./App.css";
// Optional: listen for Tauri window close to clear auth
// If Tauri is not available, this will be a no-op
import { getCurrentWindow } from "@tauri-apps/api/window";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = authService.isAuthenticated();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          // Prevent default close to allow cleanup
          event.preventDefault();
          
          // Perform cleanup (don't await to avoid blocking)
          authService.logout().catch(() => {});
          
          // Close the window immediately
          setTimeout(() => {
            appWindow.close().catch(() => {});
          }, 100);
        });
      } catch {
        // ignore if Tauri is not available
      }
    })();
    return () => {
      if (typeof unlisten === 'function') {
        try { unlisten(); } catch {}
      }
    };
  }, []);
  return (
    <WipingProvider>
      <Router>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/network-setup" element={<NetworkSetup />} />
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
          
          <Route path="/" element={<Navigate to="/welcome" replace />} />
        </Routes>
      </Router>
    </WipingProvider>
  );
}

export default App;
