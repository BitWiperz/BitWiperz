import IconButton from "./IconButton";
import "./TopBar.css";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onWifiClick?: () => void;
  onInfoClick?: () => void;
  onErrorClick?: () => void;
}

export default function TopBar({
  title = "Select Devices",
  subtitle = "Choose devices to wipe",
  onWifiClick,
  onInfoClick,
  onErrorClick,
}: TopBarProps) {
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <h1 className="top-bar-title">{title}</h1>
        <p className="top-bar-subtitle">{subtitle}</p>
      </div>
      <div className="top-bar-icons">
        <IconButton
          icon="wifi"
          label="Connection Status"
          onClick={onWifiClick}
        />
        <IconButton
          icon="info"
          label="Information"
          onClick={onInfoClick}
        />
        <IconButton
          icon="error"
          label="Error Status"
          onClick={onErrorClick}
        />
      </div>
    </div>
  );
}
