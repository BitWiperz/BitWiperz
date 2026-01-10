use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WifiNetwork {
    pub ssid: String,
    pub signal_strength: u8,
    pub security: String,
    pub in_use: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStatus {
    pub connected: bool,
    pub connection_type: String, // "wifi", "ethernet", "none"
    pub ssid: Option<String>,
    pub ip_address: Option<String>,
    pub interface: Option<String>,
}

/// List available WiFi networks using nmcli
#[tauri::command]
pub async fn list_wifi_networks() -> Result<Vec<WifiNetwork>, String> {
    // First, rescan for networks
    let _rescan = Command::new("nmcli")
        .args(&["device", "wifi", "rescan"])
        .output();

    // Wait a moment for scan to complete
    tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;

    // List networks
    let output = Command::new("nmcli")
        .args(&[
            "-t",
            "-f",
            "SSID,SIGNAL,SECURITY,IN-USE",
            "device",
            "wifi",
            "list",
        ])
        .output()
        .map_err(|e| format!("Failed to list WiFi networks: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("nmcli failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut networks = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() >= 4 {
            let ssid = parts[0].trim();
            if ssid.is_empty() {
                continue; // Skip hidden networks
            }

            let signal = parts[1].parse::<u8>().unwrap_or(0);
            let security = if parts[2].is_empty() {
                "Open".to_string()
            } else {
                parts[2].to_string()
            };
            let in_use = parts[3] == "*";

            networks.push(WifiNetwork {
                ssid: ssid.to_string(),
                signal_strength: signal,
                security,
                in_use,
            });
        }
    }

    // Remove duplicates (same SSID), keep the one with stronger signal
    networks.sort_by(|a, b| b.signal_strength.cmp(&a.signal_strength));
    networks.dedup_by(|a, b| a.ssid == b.ssid);

    Ok(networks)
}

/// Connect to a WiFi network
#[tauri::command]
pub async fn connect_wifi(ssid: String, password: Option<String>) -> Result<String, String> {
    let mut args = vec!["device", "wifi", "connect", &ssid];
    
    let password_arg;
    if let Some(ref pwd) = password {
        password_arg = format!("password {}", pwd);
        args.push("password");
        args.push(pwd);
    }

    let output = Command::new("nmcli")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to connect to WiFi: {}", e))?;

    if output.status.success() {
        Ok(format!("Successfully connected to {}", ssid))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Connection failed: {}", stderr))
    }
}

/// Get current network status
#[tauri::command]
pub async fn get_network_status() -> Result<NetworkStatus, String> {
    // Get active connection info
    let output = Command::new("nmcli")
        .args(&["-t", "-f", "TYPE,NAME,DEVICE", "connection", "show", "--active"])
        .output()
        .map_err(|e| format!("Failed to get network status: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    
    let mut status = NetworkStatus {
        connected: false,
        connection_type: "none".to_string(),
        ssid: None,
        ip_address: None,
        interface: None,
    };

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() >= 3 {
            let conn_type = parts[0].trim();
            let name = parts[1].trim();
            let device = parts[2].trim();

            if conn_type == "802-11-wireless" || conn_type == "wifi" {
                status.connected = true;
                status.connection_type = "wifi".to_string();
                status.ssid = Some(name.to_string());
                status.interface = Some(device.to_string());
                break;
            } else if conn_type == "802-3-ethernet" || conn_type == "ethernet" {
                status.connected = true;
                status.connection_type = "ethernet".to_string();
                status.interface = Some(device.to_string());
                break;
            }
        }
    }

    // Get IP address if connected
    if status.connected {
        if let Some(ref interface) = status.interface {
            let ip_output = Command::new("ip")
                .args(&["-4", "addr", "show", interface])
                .output()
                .ok();

            if let Some(ip_out) = ip_output {
                let ip_stdout = String::from_utf8_lossy(&ip_out.stdout);
                for line in ip_stdout.lines() {
                    if line.contains("inet ") {
                        let parts: Vec<&str> = line.trim().split_whitespace().collect();
                        if parts.len() >= 2 {
                            let ip = parts[1].split('/').next().unwrap_or("");
                            status.ip_address = Some(ip.to_string());
                            break;
                        }
                    }
                }
            }
        }
    }

    Ok(status)
}

/// Test internet connectivity
#[tauri::command]
pub async fn test_internet_connectivity() -> Result<bool, String> {
    // Try to ping Cloudflare DNS and Google DNS
    let cloudflare = Command::new("ping")
        .args(&["-c", "2", "-W", "3", "1.1.1.1"])
        .output();

    if let Ok(output) = cloudflare {
        if output.status.success() {
            return Ok(true);
        }
    }

    // Fallback to Google DNS
    let google = Command::new("ping")
        .args(&["-c", "2", "-W", "3", "8.8.8.8"])
        .output();

    if let Ok(output) = google {
        if output.status.success() {
            return Ok(true);
        }
    }

    Ok(false)
}

/// Disconnect from current network
#[tauri::command]
pub async fn disconnect_network() -> Result<String, String> {
    let output = Command::new("nmcli")
        .args(&["networking", "off"])
        .output()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    let _reconnect = Command::new("nmcli")
        .args(&["networking", "on"])
        .output();

    if output.status.success() {
        Ok("Network disconnected".to_string())
    } else {
        Err("Failed to disconnect network".to_string())
    }
}
