import { useNavigate, useLocation } from "react-router-dom";
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

  return (
    <nav className="navbar">
      <div className="navbar-items">
        {items.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-item-number">{item.id}</span>
            <span className="nav-item-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
