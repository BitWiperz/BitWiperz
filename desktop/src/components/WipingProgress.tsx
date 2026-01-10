import { useEffect, useState } from "react";
import "./WipingProgress.css";

export interface WipingProgressData {
  operation_id: string;
  device_id: string;
  technique: string;
  progress_percent: number;
  current_pass: number;
  total_passes: number;
  bytes_processed: number;
  status_message: string;
  timestamp: string;
}

interface WipingProgressProps {
  device: {
    id: string;
    name: string;
    capacity_bytes: number;
  };
  progress: WipingProgressData | null;
  isActive: boolean;
}

export default function WipingProgress({
  device,
  progress,
  isActive,
}: WipingProgressProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, startTime]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const progressPercent = progress?.progress_percent || 0;
  const currentPass = progress?.current_pass || 1;
  const totalPasses = progress?.total_passes || 1;
  const bytesProcessed = progress?.bytes_processed || 0;
  const statusMessage = progress?.status_message || "Preparing...";

  return (
    <div className="wiping-progress">
      <div className="progress-header">
        <h3 className="progress-device-name">{device.name}</h3>
        <span className="progress-device-id">{device.id}</span>
      </div>

      <div className="progress-bar-container">
        <div className="progress-bar-background">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="progress-percentage">{progressPercent}%</span>
      </div>

      <div className="progress-info-grid">
        <div className="progress-info-item">
          <label className="progress-info-label">Status</label>
          <span className="progress-info-value">{statusMessage}</span>
        </div>

        <div className="progress-info-item">
          <label className="progress-info-label">Pass</label>
          <span className="progress-info-value">
            {currentPass} / {totalPasses}
          </span>
        </div>

        <div className="progress-info-item">
          <label className="progress-info-label">Elapsed Time</label>
          <span className="progress-info-value">{formatTime(elapsedTime)}</span>
        </div>

        <div className="progress-info-item">
          <label className="progress-info-label">Data Processed</label>
          <span className="progress-info-value">
            {formatBytes(bytesProcessed)} / {formatBytes(device.capacity_bytes)}
          </span>
        </div>
      </div>
    </div>
  );
}
