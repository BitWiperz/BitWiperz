import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./SelectDevices.css";
import DevCard from "../components/DevCard";
import ErasureMethod from "../components/ErasureMethod";
import TopBar from "../components/TopBar";
import WipingProgress from "../components/WipingProgress";
import WipingStatus from "../components/WipingStatus";
import ConfirmDialog from "../components/ConfirmDialog";
import Toast from "../components/Toast";
import { useWiping } from "../contexts/WipingContext";
import {
  startWiping,
  stringToTechnique,
  validateTechnique,
  type DeviceInfo,
  WipingResultType,
} from "../services/wipingService";
import { driveService, type DriveInfo as DetectedDrive } from "../services/driveService";
import { createCertificate, type ErasureMetadata } from "../services/certificateService";

interface ToastNotification {
  id: string;
  message: string;
  type: "error" | "success" | "warning";
  deviceName?: string;
}

export default function SelectDevices() {
  const navigate = useNavigate();
  const { activeOperation, setActiveOperation, isWiping } = useWiping();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [erasureMethod, setErasureMethod] = useState("dod-3-pass");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [generatingCertificate, setGeneratingCertificate] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Helper to show toast notification
  const showToast = (message: string, type: "error" | "success" | "warning", deviceName?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type, deviceName }]);
  };

  // Helper to dismiss toast
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Check if all devices in operation have completed
  const areAllDevicesComplete = () => {
    if (!activeOperation) return false;
    return activeOperation.deviceIds.every((deviceId) => {
      return activeOperation.status.has(deviceId);
    });
  };

  // Reset wiping operation and return to device selection
  const handleResetOperation = () => {
    setActiveOperation(null);
    setSelectedDevices([]);
    setError(null);
  };

  // Retry wiping for a specific device
  const handleRetryDevice = async (deviceId: string) => {
    if (!activeOperation) return;
    
    try {
      // Start a new operation with just this device
      const technique = activeOperation.technique;
      const operationId = await startWiping([deviceId], technique);

      setActiveOperation({
        operationId,
        deviceIds: [deviceId],
        technique,
        startedAt: new Date(),
        progress: new Map(),
        status: new Map(),
      });

      setError(null);
    } catch (err) {
      console.error("Error retrying wipe:", err);
      const errorMessage = "Failed to retry wiping operation";
      setError(errorMessage);
      showToast(errorMessage, "error");
    }
  };

  // Load devices on component mount
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Use drive detection service and map to DeviceInfo used by wiping flow
        // Only include external/removable drives by default for safety
        const detected: DetectedDrive[] = await driveService.detectDrives(false);
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

  // Watch for failed wipes from context and show toasts
  useEffect(() => {
    if (!activeOperation) return;

    // Check for new failures
    activeOperation.status.forEach((status) => {
      if (status.result === "Failed") {
        const device = devices.find((d) => d.id === status.device_id);
        const deviceName = device ? device.name : status.device_id;
        const errorMessage = status.error_message || "Unknown error occurred";
        
        // Only show toast once per device failure (check if toast already exists)
        const alreadyShown = toasts.some(
          (t) => t.deviceName === deviceName && t.message === errorMessage
        );
        if (!alreadyShown) {
          showToast(errorMessage, "error", deviceName);
        }
      }
    });
  }, [activeOperation?.status]);

  const toggleDeviceSelection = (id: string) => {
    setSelectedDevices((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleEraseClick = async () => {
    if (selectedDevices.length === 0) {
      setError("Please select at least one device to wipe");
      return;
    }

    // Validate technique compatibility with all selected devices
    const technique = stringToTechnique(erasureMethod);
    const incompatibleDevices: string[] = [];

    for (const deviceId of selectedDevices) {
      const error = await validateTechnique(deviceId, technique);
      if (error) {
        const device = devices.find((d) => d.id === deviceId);
        const deviceName = device ? device.name : deviceId;
        incompatibleDevices.push(deviceName);
        showToast(error, "warning", deviceName);
      }
    }

    if (incompatibleDevices.length > 0) {
      setError(
        `Selected technique is not compatible with: ${incompatibleDevices.join(", ")}. Please choose a different technique or deselect incompatible devices.`
      );
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
      const errorMessage = "Failed to start wiping operation";
      setError(errorMessage);
      showToast(errorMessage, "error");
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
                      onRetry={() => handleRetryDevice(deviceId)}
                      isGeneratingCertificate={generatingCertificate}
                    />
                  ) : (
                    <WipingProgress
                      device={device}
                      progress={progress || null}
                      isActive={!status}
                      startedAt={activeOperation?.startedAt}
                    />
                  )}
                </div>
              );
            })}
            
            {areAllDevicesComplete() && (
              <div className="operation-complete-actions">
                <button
                  className="action-button primary"
                  onClick={handleResetOperation}
                >
                  Start New Wipe
                </button>
              </div>
            )}
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

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            deviceName={toast.deviceName}
            onClose={() => dismissToast(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}
