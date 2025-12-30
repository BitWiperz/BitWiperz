import React, { useEffect, useState } from 'react';
import { Certificate, listCertificates, downloadCertificatePdf, USE_MOCK_DATA } from '../services/certificateService';
import './Reports.css';

export default function Reports() {
  const [reports, setReports] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listCertificates(50, 0);
        if (mounted) setReports(data);
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load reports');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleDownload = async (report: Certificate) => {
    setError(null);
    setDownloading(report.certificateId);
    try {
      // Download an already-issued certificate by its ID
      await downloadCertificatePdf(report.certificateId);
    } catch (e: any) {
      setError(e?.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : 'N/A');

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Reports</h1>
        <p>{USE_MOCK_DATA ? 'Showing mock reports for quick testing' : 'Device erasure reports'}</p>
      </div>
      <div className="page-content">
        {error && <div className="report-error">{error}</div>}
        {loading ? (
          <div className="report-loading">Loading reports…</div>
        ) : (
          <div className="reports-list">
            {reports.map((r) => (
              <div className="report-item" key={r.certificateId}>
                <div className="report-item-header">
                  <div className="report-title">{r.certificateNumber}</div>
                  <button
                    className="download-button"
                    disabled={downloading === r.certificateId}
                    onClick={() => handleDownload(r)}
                    title="Download PDF"
                  >
                    {downloading === r.certificateId ? (
                      'Downloading…'
                    ) : (
                      <>
                        <DownloadIcon />
                        <span>Download</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="report-item-details">
                  <div className="report-detail-row">
                    <span className="label">Drive</span>
                    <span className="value">{r.driveId}</span>
                  </div>
                  <div className="report-detail-row">
                    <span className="label">Method</span>
                    <span className="value">{r.erasureMethod}</span>
                  </div>
                  <div className="report-detail-row">
                    <span className="label">Operator</span>
                    <span className="value">{r.operator?.name ?? 'N/A'}</span>
                  </div>
                  <div className="report-detail-row">
                    <span className="label">Started</span>
                    <span className="value">{fmt(r.startedAt)}</span>
                  </div>
                  <div className="report-detail-row">
                    <span className="label">Completed</span>
                    <span className="value">{fmt(r.completedAt)}</span>
                  </div>
                  <div className="report-detail-row">
                    <span className="label">Issued</span>
                    <span className="value">{fmt(r.issuedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="report-item">
                <div className="report-date">No reports available yet</div>
                <p className="report-description">Wiping operations will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginRight: 8 }}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
