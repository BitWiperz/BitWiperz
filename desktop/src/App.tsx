import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components";
import { SelectDevices, FieldOptions, Reports, Login, Register } from "./pages";
import { authService } from "./services/authService";
import "./App.css";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = authService.isAuthenticated();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
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
