import { useState, useEffect } from "react";
import "./SelectDevices.css";
import DevCard from "../components/DevCard";
import ErasureMethod from "../components/ErasureMethod";
import TopBar from "../components/TopBar";
import { getDevices } from "../services/deviceService";
import { Device } from "../types/device";

export default function SelectDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [erasureMethod, setErasureMethod] = useState("erase");

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const fetchedDevices = await getDevices();
        setDevices(fetchedDevices);
        setError(null);
      } catch (err) {
        console.error("Error loading devices:", err);
        setError("Failed to load devices");
      } finally {
        setLoading(false);
      }
    };

    loadDevices();
  }, []);

  const toggleDeviceSelection = (id: string) => {
    setSelectedDevices((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
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
        <div className="device-list">
          {loading && <div className="device-status">Loading devices...</div>}
          {error && !loading && <div className="device-status error">{error}</div>}
          {!loading && !error && devices.length === 0 && (
            <div className="device-status">No devices detected.</div>
          )}
          {!loading &&
            !error &&
            devices.map((device) => (
              <DevCard
                key={device.id}
                name={device.name}
                specs={`${device.interface}/${device.device_type} - ${device.size_formatted}${device.serial ? ` - ${device.serial}` : ""}`}
                selected={selectedDevices.includes(device.id)}
                onSelect={() => toggleDeviceSelection(device.id)}
              />
            ))}
        </div>
        <div className="erasure-section">
          <ErasureMethod selectedOption={erasureMethod} onSelect={setErasureMethod} />
        </div>
      </div>
    </div>
  );
}
