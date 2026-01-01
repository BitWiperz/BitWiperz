import { useState, useEffect } from "react";
import "./SelectDevices.css";
import DevCard from "../components/DevCard";
import ErasureMethod from "../components/ErasureMethod";
import TopBar from "../components/TopBar";
import { driveService, DriveInfo } from "../services/driveService";

export default function SelectDevices() {
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [selectedDrives, setSelectedDrives] = useState<string[]>([]);
  const [erasureMethod, setErasureMethod] = useState("erase");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load drives on component mount
  useEffect(() => {
    loadDrives();
  }, []);

  const loadDrives = async () => {
    setLoading(true);
    setError(null);
    try {
      // includeInternal=true so when booted from USB we also see the laptop's internal drives
      const detectedDrives = await driveService.detectDrives(true);
      setDrives(detectedDrives);
      console.log(`[SelectDevices] Loaded ${detectedDrives.length} drives`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load drives";
      setError(errorMessage);
      console.error("[SelectDevices] Error loading drives:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleDriveSelection = (devicePath: string) => {
    setSelectedDrives((prev) =>
      prev.includes(devicePath)
        ? prev.filter((d) => d !== devicePath)
        : [...prev, devicePath]
    );
  };

  const handleWifiClick = () => {
    console.log("Wifi clicked");
  };

  const handleInfoClick = () => {
    console.log("Info clicked");
  };

  const handleErrorClick = () => {
    console.log("Error clicked");
  };

  const handleRefreshDrives = () => {
    loadDrives();
  };

  return (
    <div className="page-container">
      <TopBar
        title="Select Devices"
        subtitle="Choose devices to wipe"
        onWifiClick={handleWifiClick}
        onInfoClick={handleInfoClick}
        onErrorClick={handleErrorClick}
      />
      <div className="page-content">
        <div className="device-list-header">
          <h2>Connected Drives</h2>
          <button 
            onClick={handleRefreshDrives}
            disabled={loading}
            className="refresh-button"
            title="Refresh drive list"
          >
            {loading ? "Scanning..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <p>⚠️ {error}</p>
            <button onClick={handleRefreshDrives}>Try Again</button>
          </div>
        )}

        {loading && (
          <div className="loading-message">
            <p>Scanning for connected drives...</p>
          </div>
        )}

        {!loading && drives.length === 0 && !error && (
          <div className="no-drives-message">
            <p>No drives detected</p>
            <button onClick={handleRefreshDrives}>Scan Again</button>
          </div>
        )}

        {!loading && drives.length > 0 && (
          <>
            <div className="device-list">
              {drives.map((drive) => (
                <DevCard
                  key={drive.device_path}
                  name={driveService.getDriveName(drive)}
                  specs={`${drive.device_path} - ${driveService.formatSize(drive.size_bytes)}${
                    drive.mount_point ? ` (Mounted at ${drive.mount_point})` : " (Not mounted)"
                  }`}
                  selected={selectedDrives.includes(drive.device_path)}
                  onSelect={() => toggleDriveSelection(drive.device_path)}
                />
              ))}
            </div>
            <div className="erasure-section">
              <ErasureMethod 
                selectedOption={erasureMethod} 
                onSelect={setErasureMethod} 
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
