import "./Reports.css";

export default function Reports() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Reports</h1>
        <p>View wiping history and reports</p>
      </div>
      <div className="page-content">
        <div className="reports-list">
          {/* Reports will be displayed here */}
          <div className="report-item">
            <div className="report-date">No reports available yet</div>
            <p className="report-description">Wiping operations will appear here</p>
          </div>
        </div>
      </div>
    </div>
  );
}
