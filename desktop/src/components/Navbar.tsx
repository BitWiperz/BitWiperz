import { useNavigate, useLocation } from "react-router-dom";
import { useWiping } from "../contexts/WipingContext";
import "./Navbar.css";

interface NavItem {
  id: number;
  label: string;
  path: string;
}

interface NavbarProps {
  items?: NavItem[];
}

export default function Navbar({ 
  items = [
    { id: 1, label: "Select Devices", path: "/devices" },
    { id: 2, label: "Field Options", path: "/options" },
    { id: 3, label: "Reports", path: "/reports" }
  ]
}: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isWiping } = useWiping();

  const handleNavigation = (path: string) => {
    // Warn if navigating away from devices page while wiping
    if (isWiping && location.pathname === "/devices" && path !== "/devices") {
      const confirmed = window.confirm(
        "A wiping operation is currently in progress. If you navigate away, you can return to this page to see the progress. Continue?"
      );
      if (!confirmed) return;
    }
    navigate(path);
  };

  return (
    <nav className="navbar">
      <div className="navbar-items">
        {items.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
            onClick={() => handleNavigation(item.path)}
          >
            <span className="nav-item-number">{item.id}</span>
            <span className="nav-item-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
