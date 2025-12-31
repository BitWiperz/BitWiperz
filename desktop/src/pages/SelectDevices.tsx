import { useState } from "react";
import "./SelectDevices.css";
import DevCard from "../components/DevCard";
import ErasureMethod from "../components/ErasureMethod";
import TopBar from "../components/TopBar";

export default function SelectDevices() {
  const [selectedDevices, setSelectedDevices] = useState<number[]>([]);
  const [erasureMethod, setErasureMethod] = useState("erase");

  const devices = [
    {
      id: 1,
      name: "SAMSUNG/SSD",
      specs: "SATA/SSD - 256GB - S1EVNYAFB35065",
    },
    {
      id: 2,
      name: "WESTERN DIGITAL/HDD",
      specs: "SATA/HDD - 1TB - WD10EZEX",
    },
    {
      id: 3,
      name: "CRUCIAL/SSD",
      specs: "NVMe/SSD - 512GB - CT512P5SSD8",
    },
  ];

  const toggleDeviceSelection = (id: number) => {
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
          {devices.map((device) => (
            <DevCard
              key={device.id}
              name={device.name}
              specs={device.specs}
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
