import Navbar from "./Navbar";
import "./Sidebar.css";

interface SidebarProps {
  title?: string;
}

export default function Sidebar({ 
  title = "BitWiperz"
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">
        {title}
      </div>
      <Navbar />
    </aside>
  );
}
