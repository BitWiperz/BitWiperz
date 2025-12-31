import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { authService } from "../services/authService";
import "./Sidebar.css";

interface SidebarProps {
  title?: string;
}

export default function Sidebar({ 
  title = "BitWiperz"
}: SidebarProps) {
  const navigate = useNavigate();
  const user = authService.getUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-title">
        {title}
      </div>
      <Navbar />
      <div className="sidebar-footer">
        {user && <div className="user-info">{user.email}</div>}
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
    </aside>
  );
}
