import "./WipingStatus.css";

export interface WipingStatusData {
  operation_id: string;
  device_id: string;
  technique: string;
  result: "Success" | "Failed" | "Cancelled";
  started_at: string;
  completed_at: string;
  error_message?: string;
  verification_hash?: string;
}

interface WipingStatusProps {
  device: {
    id: string;
    name: string;
    model: string;
    serial_number: string;
    capacity_bytes: number;
  };
  status: WipingStatusData;
  onGenerateCertificate?: () => void;
  onViewReport?: () => void;
  isGeneratingCertificate?: boolean;
}

export default function WipingStatus({
  device,
  status,
  onGenerateCertificate,
  onViewReport,
  isGeneratingCertificate = false,
}: WipingStatusProps) {
  const isSuccess = status.result === "Success";
  const isFailed = status.result === "Failed";
  const isCancelled = status.result === "Cancelled";

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div
      className={`wiping-status ${
        isSuccess ? "success" : isFailed ? "failed" : "cancelled"
      }`}
    >
      <div className="status-header">
        <div className="status-icon">
          {isSuccess && (
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="16" cy="16" r="15" fill="#4CAF50" />
              <path
                d="M10 16L14 20L22 12"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {isFailed && (
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="16" cy="16" r="15" fill="#F44336" />
              <path
                d="M10 10L22 22M22 10L10 22"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {isCancelled && (
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="16" cy="16" r="15" fill="#FF9800" />
              <path
                d="M16 10V22M10 16H22"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <div className="status-title">
          <h3 className="status-device-name">{device.name}</h3>
          <span className="status-device-id">{device.id}</span>
        </div>
        <div className="status-badge">
          {isSuccess && <span className="badge success-badge">SUCCESSFUL</span>}
          {isFailed && <span className="badge failed-badge">FAILED</span>}
          {isCancelled && (
            <span className="badge cancelled-badge">CANCELLED</span>
          )}
        </div>
      </div>

      <div className="status-details-grid">
        <div className="status-detail-item">
          <label className="status-detail-label">Device Model</label>
          <span className="status-detail-value">{device.model}</span>
        </div>

        <div className="status-detail-item">
          <label className="status-detail-label">Serial Number</label>
          <span className="status-detail-value">{device.serial_number}</span>
        </div>

        <div className="status-detail-item">
          <label className="status-detail-label">Capacity</label>
          <span className="status-detail-value">
            {formatBytes(device.capacity_bytes)}
          </span>
        </div>

        <div className="status-detail-item">
          <label className="status-detail-label">Technique</label>
          <span className="status-detail-value">{status.technique}</span>
        </div>

        <div className="status-detail-item">
          <label className="status-detail-label">Started At</label>
          <span className="status-detail-value">
            {formatDateTime(status.started_at)}
          </span>
        </div>

        <div className="status-detail-item">
          <label className="status-detail-label">Completed At</label>
          <span className="status-detail-value">
            {formatDateTime(status.completed_at)}
          </span>
        </div>

        {status.verification_hash && (
          <div className="status-detail-item full-width">
            <label className="status-detail-label">Verification Hash</label>
            <span className="status-detail-value hash">
              {status.verification_hash}
            </span>
          </div>
        )}

        {isFailed && status.error_message && (
          <div className="status-detail-item full-width">
            <label className="status-detail-label">Error</label>
            <span className="status-detail-value error">{status.error_message}</span>
          </div>
        )}
      </div>

      {isSuccess && (
        <div className="status-actions">
          <button
            className="action-button primary"
            onClick={onGenerateCertificate}
            disabled={isGeneratingCertificate}
          >
            {isGeneratingCertificate ? "Generating..." : "Generate Certificate"}
          </button>
          <button className="action-button secondary" onClick={onViewReport}>
            View Report
          </button>
        </div>
      )}

      {isFailed && (
        <div className="status-actions">
          <button className="action-button secondary">Retry Wiping</button>
        </div>
      )}
    </div>
  );
}
