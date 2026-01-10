import { useState } from "react";
import "./ConfirmDialog.css";

interface ConfirmDialogProps {
  isOpen: boolean;
  devices: Array<{
    id: string;
    name: string;
    capacity_bytes: number;
  }>;
  technique: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  devices,
  technique,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const totalCapacity = devices.reduce((sum, device) => sum + device.capacity_bytes, 0);

  return (
    <div className="confirm-dialog-overlay">
      <div className="confirm-dialog">
        <div className="dialog-header">
          <h2 className="dialog-title">Confirm Data Erasure</h2>
          <button
            className="dialog-close"
            onClick={onCancel}
            disabled={isLoading}
          >
            ×
          </button>
        </div>

        <div className="dialog-content">
          <div className="warning-box">
            <svg
              className="warning-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L2 20h20L12 2z"
                stroke="#ff9800"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M12 9v4M12 17h.01"
                stroke="#ff9800"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="warning-text">
              <p className="warning-title">Warning: Permanent Data Loss</p>
              <p className="warning-description">
                This operation will permanently erase all data on the selected
                device(s). This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="devices-section">
            <h3 className="section-title">Selected Devices ({devices.length})</h3>
            <div className="devices-list">
              {devices.map((device) => (
                <div key={device.id} className="device-item">
                  <svg
                    className="device-icon"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z"
                      stroke="#222"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 18h.01"
                      stroke="#222"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="device-info">
                    <span className="device-name">{device.name}</span>
                    <span className="device-details">
                      {device.id} • {formatBytes(device.capacity_bytes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="capacity-summary">
              <span className="summary-label">Total Capacity:</span>
              <span className="summary-value">{formatBytes(totalCapacity)}</span>
            </div>
          </div>

          <div className="technique-section">
            <h3 className="section-title">Erasure Method</h3>
            <div className="technique-display">
              <span className="technique-name">{technique}</span>
            </div>
          </div>

          <div className="confirmation-checkbox">
            <input
              type="checkbox"
              id="confirm-checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              disabled={isLoading}
            />
            <label htmlFor="confirm-checkbox" className="checkbox-label">
              I understand this will permanently erase all data on the selected
              device(s)
            </label>
          </div>
        </div>

        <div className="dialog-actions">
          <button
            className="action-btn cancel-btn"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="action-btn confirm-btn"
            onClick={onConfirm}
            disabled={!isChecked || isLoading}
          >
            {isLoading ? "Starting..." : "Start Wiping"}
          </button>
        </div>
      </div>
    </div>
  );
}
