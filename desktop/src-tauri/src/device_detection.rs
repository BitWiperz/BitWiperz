use std::fs;

/// Device information structure serializable for Tauri
#[derive(Debug, Clone, serde::Serialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub serial: Option<String>,
    pub mount_point: Option<String>,
    pub interface: String,
    pub is_removable: bool,
}

/// Get all devices on the system
pub fn get_all_devices() -> Vec<DeviceInfo> {
    let mut devices = Vec::new();

    // Read /sys/block/ to enumerate block devices
    if let Ok(entries) = fs::read_dir("/sys/block") {
        for entry in entries {
            if let Ok(entry) = entry {
                let device_name = entry.file_name().to_string_lossy().to_string();

                // Filter out system/loop devices
                if device_name.starts_with("loop") || device_name.starts_with("ram") {
                    continue;
                }

                let device_path = entry.path();
                if let Some(device_info) = create_device_info_linux(&device_name, &device_path) {
                    devices.push(device_info);
                }
            }
        }
    }

    // Sort devices by name for consistent ordering
    devices.sort_by(|a, b| a.name.cmp(&b.name));
    devices
}

/// Create DeviceInfo from Linux /sys/block/ information
fn create_device_info_linux(device_name: &str, device_path: &std::path::Path) -> Option<DeviceInfo> {
    let id = format!("/dev/{}", device_name);

    // Read size in sectors and convert to bytes (512-byte sectors)
    let size_bytes = read_sysfs_file(&device_path.join("size"))
        .and_then(|s| s.parse::<u64>().ok())
        .map(|sectors| sectors * 512)
        .unwrap_or(0);

    // Skip devices with no size
    if size_bytes == 0 {
        return None;
    }

    // Read vendor and model
    let vendor = read_sysfs_file(&device_path.join("device/vendor"))
        .unwrap_or_else(|| "Unknown".to_string());
    let model = read_sysfs_file(&device_path.join("device/model"))
        .unwrap_or_else(|| device_name.to_string());

    let name = if vendor == "Unknown" {
        model
    } else {
        format!("{} {}", vendor, model)
    };

    // Determine if rotational (HDD vs SSD)
    let is_rotational = read_sysfs_file(&device_path.join("queue/rotational"))
        .map(|val| val == "1")
        .unwrap_or(true);

    // Read serial number
    let serial = read_sysfs_file(&device_path.join("device/serial"));

    // Determine interface
    let interface = parse_interface(device_name);

    // Check if removable
    let is_removable = read_sysfs_file(&device_path.join("removable"))
        .map(|val| val == "1")
        .unwrap_or(false);

    let device_type = determine_device_type(device_name, is_rotational);

    Some(DeviceInfo {
        id,
        name,
        device_type,
        size_bytes,
        size_formatted: format_size(size_bytes),
        serial,
        mount_point: None, // Could be populated by reading /proc/mounts
        interface,
        is_removable,
    })
}

/// Format size in bytes to human-readable format (B, KB, MB, GB, TB)
fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;

    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }

    match unit_idx {
        0 => format!("{} B", bytes),
        _ => format!("{:.1} {}", size, UNITS[unit_idx]),
    }
}

/// Safely read sysfs file and return content
fn read_sysfs_file(path: &std::path::Path) -> Option<String> {
    fs::read_to_string(path)
        .ok()
        .map(|content| content.trim().to_string())
        .filter(|content| !content.is_empty())
}

/// Determine device type based on path and rotational status
fn determine_device_type(device_path: &str, is_rotational: bool) -> String {
    if device_path.starts_with("nvme") {
        "NVMe".to_string()
    } else if device_path.starts_with("mmcblk") {
        "eMMC".to_string()
    } else if is_rotational {
        "HDD".to_string()
    } else {
        "SSD".to_string()
    }
}

/// Parse interface type from device path
fn parse_interface(device_path: &str) -> String {
    if device_path.starts_with("nvme") {
        "NVMe".to_string()
    } else if device_path.starts_with("sd") {
        "SATA".to_string()
    } else if device_path.starts_with("hd") {
        "IDE".to_string()
    } else if device_path.starts_with("vd") {
        "VirtIO".to_string()
    } else if device_path.starts_with("mmcblk") {
        "MMC".to_string()
    } else {
        "Unknown".to_string()
    }
}

/// Read Linux-specific device details from /sys/block/
#[cfg(target_os = "linux")]
fn read_linux_device_details(device_name: &str) -> (String, String, bool, Option<String>, String, bool) {
    let sysfs_path = format!("/sys/block/{}", device_name);

    // Read vendor and model
    let vendor = read_sysfs_file(std::path::Path::new(&format!("{}/device/vendor", sysfs_path)))
        .unwrap_or_else(|| "Unknown".to_string());
    let model = read_sysfs_file(std::path::Path::new(&format!("{}/device/model", sysfs_path)))
        .unwrap_or_else(|| device_name.to_string());

    let name = if vendor == "Unknown" {
        model
    } else {
        format!("{} {}", vendor, model)
    };

    // Determine if rotational (HDD vs SSD)
    let is_rotational = read_sysfs_file(std::path::Path::new(&format!("{}/queue/rotational", sysfs_path)))
        .map(|val| val == "1")
        .unwrap_or(true);

    // Read serial number
    let serial = read_sysfs_file(std::path::Path::new(&format!("{}/device/serial", sysfs_path)));

    // Determine interface
    let interface = parse_interface(device_name);

    // Check if removable
    let is_removable = read_sysfs_file(std::path::Path::new(&format!("{}/removable", sysfs_path)))
        .map(|val| val == "1")
        .unwrap_or(false);

    let device_type = determine_device_type(device_name, is_rotational);

    (name, device_type, is_rotational, serial, interface, is_removable)
}

/// Non-Linux fallback for device details
#[cfg(not(target_os = "linux"))]
fn read_linux_device_details(_device_name: &str) -> (String, String, bool, Option<String>, String, bool) {
    ("Unknown".to_string(), "Unknown".to_string(), false, None, "Unknown".to_string(), false)
}

/// Tauri command to get all devices
#[tauri::command]
pub fn get_devices() -> Result<Vec<DeviceInfo>, String> {
    let devices = get_all_devices();
    Ok(devices)
}
