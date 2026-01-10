import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SelectDevices.css";
import DevCard from "../components/DevCard";
import ErasureMethod from "../components/ErasureMethod";
import TopBar from "../components/TopBar";
import WipingProgress, { WipingProgressData } from "../components/WipingProgress";
import WipingStatus, { WipingStatusData } from "../components/WipingStatus";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  startWiping,
  subscribeToProgress,
  subscribeToStatus,
  stringToTechnique,
  WipingTechnique,
  type DeviceInfo,
  WipingResultType,
} from "../services/wipingService";
import { driveService, type DriveInfo as DetectedDrive } from "../services/driveService";
import { createCertificate, type ErasureMetadata } from "../services/certificateService";

interface ActiveWipingOperation {
  operationId: string;
  deviceIds: string[];
  technique: WipingTechnique;
  startedAt: Date;
  progress: Map<string, WipingProgressData>;
  status: Map<string, WipingStatusData>;
}

export default function SelectDevices() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [erasureMethod, setErasureMethod] = useState("dod-3-pass");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [activeOperation, setActiveOperation] = useState<ActiveWipingOperation | null>(null);
  const [generatingCertificate, setGeneratingCertificate] = useState(false);

  // Load devices on component mount
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Use drive detection service and map to DeviceInfo used by wiping flow
        // Include internal drives to ensure comprehensive detection
        const detected: DetectedDrive[] = await driveService.detectDrives(true);
        const mapped: DeviceInfo[] = detected.map((d) => ({
          id: d.device_path,
          name: driveService.getDriveName(d),
          model: d.model,
          serial_number: "", // not available from drive detection
          capacity_bytes: d.size_bytes,
          device_type: d.device_path.includes("nvme")
            ? "NVMe"
            : d.device_path.includes("mmc")
            ? "MMC"
            : d.device_path.includes("vd")
            ? "Virtual"
            : "HDD",
        }));
        setDevices(mapped);
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

  // Subscribe to progress events
  useEffect(() => {
    let unsubscribeProgress: (() => void) | null = null;
    let unsubscribeStatus: (() => void) | null = null;

    const setupListeners = async () => {
      unsubscribeProgress = await subscribeToProgress((progress) => {
        setActiveOperation((prev) => {
          if (!prev) return null;
          const newProgress = new Map(prev.progress);
          newProgress.set(progress.device_id, progress);
          return { ...prev, progress: newProgress };
        });
      });

      unsubscribeStatus = await subscribeToStatus((status) => {
        setActiveOperation((prev) => {
          if (!prev) return null;
          const newStatus = new Map(prev.status);
          newStatus.set(status.device_id, status);
          return { ...prev, status: newStatus };
        });
      });
    };

    setupListeners();

    return () => {
      unsubscribeProgress?.();
      unsubscribeStatus?.();
    };
  }, []);

  const toggleDeviceSelection = (id: string) => {
    setSelectedDevices((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleEraseClick = () => {
    if (selectedDevices.length === 0) {
      setError("Please select at least one device to wipe");
      return;
    }
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmErase = async () => {
    try {
      const technique = stringToTechnique(erasureMethod);
      const operationId = await startWiping(selectedDevices, technique);

      setActiveOperation({
        operationId,
        deviceIds: selectedDevices,
        technique,
        startedAt: new Date(),
        progress: new Map(),
        status: new Map(),
      });

      setIsConfirmDialogOpen(false);
      setError(null);
    } catch (err) {
      console.error("Error starting wipe:", err);
      setError("Failed to start wiping operation");
    }
  };

  const handleGenerateCertificate = async (deviceId: string) => {
    if (!activeOperation) return;

    const status = activeOperation.status.get(deviceId);
    const device = devices.find((d) => d.id === deviceId);

    if (!status || !device || status.result !== WipingResultType.Success) {
      setError("Cannot generate certificate for this device");
      return;
    }

    try {
      setGeneratingCertificate(true);

      const metadata: ErasureMetadata = {
        driveId: device.id,
        serialNumber: device.serial_number,
        model: device.model,
        capacityBytes: device.capacity_bytes,
        erasureMethod: activeOperation.technique.toString(),
        startedAt: status.started_at,
        completedAt: status.completed_at,
        operator: {
          name: device.name || device.id,
        },
        verification: {
          hash: status.verification_hash,
          tool: "BitWiperz",
          notes: "Device wiping completed successfully",
        },
      };

      const certificate = await createCertificate(metadata);
      console.log("Certificate generated:", certificate);

      // Show success message or navigate to certificate view
      navigate("/reports");
    } catch (err) {
      console.error("Error generating certificate:", err);
      setError("Failed to generate certificate");
    } finally {
      setGeneratingCertificate(false);
    }
  };

  const handleViewReport = () => {
    navigate("/reports");
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

  const selectedDeviceObjects = devices.filter((d) =>
    selectedDevices.includes(d.id)
  );

  const isWiping = activeOperation !== null;

  return (
    <div className="page-container">
      <TopBar
        title="Select Devices"
        subtitle={
          isWiping
            ? "Wiping in progress..."
            : "Choose devices to wipe"
        }
        onWifiClick={handleWifiClick}
        onInfoClick={handleInfoClick}
        onErrorClick={handleErrorClick}
      />
      <div className="page-content">
        {isWiping ? (
          <div className="wiping-progress-section">
            <h2 className="section-title">Wiping Progress</h2>
            {activeOperation?.deviceIds.map((deviceId) => {
              const device = devices.find((d) => d.id === deviceId);
              const progress = activeOperation.progress.get(deviceId);
              const status = activeOperation.status.get(deviceId);

              if (!device) return null;

              return (
                <div key={deviceId}>
                  {status ? (
                    <WipingStatus
                      device={device}
                      status={status}
                      onGenerateCertificate={() =>
                        handleGenerateCertificate(deviceId)
                      }
                      onViewReport={handleViewReport}
                      isGeneratingCertificate={generatingCertificate}
                    />
                  ) : (
                    <WipingProgress
                      device={device}
                      progress={progress || null}
                      isActive={!status}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="device-list">
              {loading && (
                <div className="device-status">Loading devices...</div>
              )}
              {error && !loading && (
                <div className="device-status error">{error}</div>
              )}
              {!loading && !error && devices.length === 0 && (
                <div className="device-status">No devices detected.</div>
              )}
              {!loading &&
                !error &&
                devices.map((device) => (
                  <DevCard
                    key={device.id}
                    name={device.name}
                    specs={`${device.device_type} - ${(device.capacity_bytes / (1024 ** 3)).toFixed(0)} GB${device.serial_number ? ` - ${device.serial_number}` : ""}`}
                    selected={selectedDevices.includes(device.id)}
                    onSelect={() => toggleDeviceSelection(device.id)}
                  />
                ))}
            </div>
            <div className="erasure-section">
              <ErasureMethod
                selectedOption={erasureMethod}
                onSelect={setErasureMethod}
                onErase={handleEraseClick}
                isLoading={false}
              />
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        devices={selectedDeviceObjects}
        technique={stringToTechnique(erasureMethod)}
        onConfirm={handleConfirmErase}
        onCancel={() => setIsConfirmDialogOpen(false)}
        isLoading={false}
      />
    </div>
  );
}
