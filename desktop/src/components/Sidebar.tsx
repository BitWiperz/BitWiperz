import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import { authService } from "../services/authService";
import { useWiping } from "../contexts/WipingContext";
import "./Sidebar.css";

interface SidebarProps {
  title?: string;
}

export default function Sidebar({ 
  title = "BitWiperz"
}: SidebarProps) {
  const navigate = useNavigate();
  const { isWiping } = useWiping();
  const user = authService.getUser();

  const handleLogout = () => {
    if (isWiping) {
      const confirmed = window.confirm(
        "A wiping operation is currently in progress. If you logout now, you will lose track of the operation. Are you sure you want to continue?"
      );
      if (!confirmed) return;
    }
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
