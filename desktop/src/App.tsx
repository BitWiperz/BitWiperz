import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components";
import { SelectDevices, FieldOptions, Reports } from "./pages";
import "./App.css";

function App() {
  return (
    <Router>
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
    </Router>
  );
}

export default App;
