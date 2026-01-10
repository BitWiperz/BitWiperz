import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./NetworkSetup.css";
import {
  listWifiNetworks,
  connectWifi,
  getNetworkStatus,
  testInternetConnectivity,
  type WifiNetwork,
  type NetworkStatus,
} from "../services/networkService";

export default function NetworkSetup() {
  const navigate = useNavigate();
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [internetAvailable, setInternetAvailable] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNetworkStatus();
    scanNetworks();
  }, []);

  const loadNetworkStatus = async () => {
    try {
      const networkStatus = await getNetworkStatus();
      setStatus(networkStatus);
      
      if (networkStatus.connected) {
        // Test internet if connected
        testInternet();
      }
    } catch (err) {
      console.error("Failed to load network status:", err);
    } finally {
      setLoading(false);
    }
  };

  const scanNetworks = async () => {
    try {
      setScanning(true);
      setError(null);
      const wifiNetworks = await listWifiNetworks();
      setNetworks(wifiNetworks);
    } catch (err) {
      setError("Failed to scan WiFi networks. Make sure NetworkManager is running.");
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const handleNetworkClick = (network: WifiNetwork) => {
    if (network.in_use) {
      return; // Already connected
    }

    setSelectedNetwork(network.ssid);
    
    if (network.security === "Open") {
      // Connect without password
      handleConnect(network.ssid, undefined);
    } else {
      // Show password dialog
      setPassword("");
      setShowPasswordDialog(true);
    }
  };

  const handleConnect = async (ssid: string, pwd?: string) => {
    try {
      setConnecting(true);
      setError(null);
      
      await connectWifi(ssid, pwd);
      
      // Reload status after connection
      await loadNetworkStatus();
      
      // Test internet
      await testInternet();
      
      setShowPasswordDialog(false);
      setSelectedNetwork(null);
      setPassword("");
      
      // Rescan to update connection status
      await scanNetworks();
    } catch (err: any) {
      setError(`Connection failed: ${err.message || err}`);
    } finally {
      setConnecting(false);
    }
  };

  const handlePasswordSubmit = () => {
    if (selectedNetwork && password) {
      handleConnect(selectedNetwork, password);
    }
  };

  const testInternet = async () => {
    try {
      setTesting(true);
      const available = await testInternetConnectivity();
      setInternetAvailable(available);
    } catch (err) {
      setInternetAvailable(false);
    } finally {
      setTesting(false);
    }
  };

  const handleContinue = () => {
    if (status?.connected && internetAvailable) {
      navigate("/login");
    } else {
      setError("Please connect to a network with internet access before continuing");
    }
  };

  const handleSkip = () => {
    navigate("/login");
  };

  const getSignalIcon = (strength: number) => {
    if (strength >= 75) return "📶";
    if (strength >= 50) return "📶";
    if (strength >= 25) return "📶";
    return "📶";
  };

  const getSignalClass = (strength: number) => {
    if (strength >= 75) return "signal-excellent";
    if (strength >= 50) return "signal-good";
    if (strength >= 25) return "signal-fair";
    return "signal-poor";
  };

  return (
    <div className="network-setup-container">
      <div className="network-setup-content">
        <h1 className="network-title">Network Setup</h1>
        <p className="network-subtitle">Connect to WiFi or Ethernet</p>

        {/* Current Status */}
        <div className="network-status-card">
          <div className="status-header">
            <h3>Connection Status</h3>
            <button
              className="refresh-btn"
              onClick={loadNetworkStatus}
              disabled={loading}
            >
              🔄
            </button>
          </div>
          
          {loading ? (
            <p className="status-loading">Loading...</p>
          ) : status?.connected ? (
            <div className="status-connected">
              <div className="status-icon">✅</div>
              <div className="status-details">
                <p className="status-type">
                  {status.connection_type === "wifi" ? "📶 WiFi" : "🔌 Ethernet"}
                </p>
                {status.ssid && <p className="status-ssid">{status.ssid}</p>}
                {status.ip_address && (
                  <p className="status-ip">IP: {status.ip_address}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="status-disconnected">
              <div className="status-icon">❌</div>
              <p>Not connected</p>
            </div>
          )}

          {/* Internet Test */}
          <div className="internet-test">
            <button
              className="test-btn"
              onClick={testInternet}
              disabled={testing || !status?.connected}
            >
              {testing ? "Testing..." : "Test Internet"}
            </button>
            {internetAvailable && (
              <span className="internet-status success">✅ Internet Available</span>
            )}
            {!testing && status?.connected && !internetAvailable && (
              <span className="internet-status failure">❌ No Internet</span>
            )}
          </div>
        </div>

        {/* WiFi Networks */}
        <div className="wifi-networks-card">
          <div className="networks-header">
            <h3>Available WiFi Networks</h3>
            <button
              className="scan-btn"
              onClick={scanNetworks}
              disabled={scanning}
            >
              {scanning ? "Scanning..." : "Scan"}
            </button>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="networks-list">
            {networks.length === 0 && !scanning && (
              <p className="no-networks">No WiFi networks found</p>
            )}
            
            {networks.map((network) => (
              <button
                key={network.ssid}
                className={`network-item ${network.in_use ? "connected" : ""}`}
                onClick={() => handleNetworkClick(network)}
                disabled={connecting || network.in_use}
              >
                <span className={`signal-icon ${getSignalClass(network.signal_strength)}`}>
                  {getSignalIcon(network.signal_strength)}
                </span>
                <div className="network-info">
                  <span className="network-ssid">{network.ssid}</span>
                  <span className="network-security">
                    {network.security === "Open" ? "🔓 Open" : "🔒 Secured"}
                  </span>
                </div>
                <span className="network-signal">{network.signal_strength}%</span>
                {network.in_use && <span className="connected-badge">Connected</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Password Dialog */}
        {showPasswordDialog && (
          <div className="password-dialog-overlay">
            <div className="password-dialog">
              <h3>Enter WiFi Password</h3>
              <p className="dialog-network-name">{selectedNetwork}</p>
              
              <input
                type="password"
                className="password-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handlePasswordSubmit()}
                autoFocus
              />
              
              <div className="dialog-actions">
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setShowPasswordDialog(false);
                    setSelectedNetwork(null);
                    setPassword("");
                  }}
                  disabled={connecting}
                >
                  Cancel
                </button>
                <button
                  className="connect-btn"
                  onClick={handlePasswordSubmit}
                  disabled={connecting || !password}
                >
                  {connecting ? "Connecting..." : "Connect"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="setup-actions">
          <button className="skip-btn-secondary" onClick={handleSkip}>
            Skip
          </button>
          <button
            className="continue-btn"
            onClick={handleContinue}
            disabled={!status?.connected || !internetAvailable}
          >
            Continue to Login
          </button>
        </div>
      </div>
    </div>
  );
}
