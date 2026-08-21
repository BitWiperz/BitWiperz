use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveInfo {
    pub device_path: String,
    pub mount_point: Option<String>,
    pub size_bytes: u64,
    pub model: String,
    pub vendor: String,
    pub is_removable: bool,
    pub is_mounted: bool,
}

/// Tauri command to detect external drives
#[tauri::command]
pub fn detect_drives(include_internal: bool) -> Result<Vec<DriveInfo>, String> {
    detect_external_drives(include_internal)
}

/// Tauri command to get partitions for a specific device
#[tauri::command]
pub fn get_device_partitions(device_path: String) -> Result<Vec<String>, String> {
    get_partitions(&device_path)
}

/// Detect external/USB drives connected to Linux system (excluding the drive the app is running from)
pub fn detect_external_drives(include_internal: bool) -> Result<Vec<DriveInfo>, String> {
    let mut drives = Vec::new();
    
    // Get the device path where the application is running from
    let app_device = get_app_device_path()?;
    
    // Get the base device (without partition number) of the app device
    let app_base_device = get_base_device_name(&app_device);
    
    // Get the executable path to check against mount points
    let exe_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.to_str().map(|s| s.to_string()));

    // Read /sys/class/block to find block devices
    let block_path = "/sys/class/block";
    match fs::read_dir(block_path) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(device_name) = path.file_name().and_then(|n| n.to_str()) {
                    // Skip loop devices and RAM disks
                    if device_name.starts_with("loop") || device_name.starts_with("ram") {
                        continue;
                    }

                    // Skip partitions; only include root devices
                    // Partitions typically expose a "partition" file in sysfs.
                    let partition_marker = path.join("partition");
                    if partition_marker.exists() {
                        continue;
                    }

                    // Skip if this is the app's base device
                    if device_name == app_base_device {
                        eprintln!("Skipping app device: {}", device_name);
                        continue;
                    }

                    // Check if device is removable
                    let removable_path = path.join("removable");
                    if let Ok(content) = fs::read_to_string(&removable_path) {
                        let is_removable = content.trim() == "1";

                        // Consider devices under USB topology as external too, even if removable=0
                        let is_usb_external = is_device_usb(&path);
                        let is_external = is_removable || is_usb_external;

                        // If we are only looking for removable drives and this is internal, skip
                        if !include_internal && !is_external {
                            continue;
                        }

                        if let Some(drive) = get_drive_info(&path, device_name, is_removable) {
                            // Skip the drive that the app is running from
                            if !drive.device_path.eq(&app_device) {
                                // Also check if mount point contains executable path
                                if let Some(ref mount_point) = drive.mount_point {
                                    if let Some(ref exe) = exe_path {
                                        if exe.starts_with(mount_point) {
                                            eprintln!("Skipping device with executable mount: {}", drive.device_path);
                                            continue;
                                        }
                                    }
                                }
                                
                                drives.push(drive);
                            }
                        }
                    }
                }
            }
        }
        Err(e) => return Err(format!("Failed to read block devices: {}", e)),
    }

    Ok(drives)
}

/// Get base device name without partition suffix
/// e.g., sda1 -> sda, nvme0n1p1 -> nvme0n1
fn get_base_device_name(device_path: &str) -> String {
    let device_name = device_path.trim_start_matches("/dev/");
    
    if device_name.contains("nvme") {
        // NVMe devices: nvme0n1p1 -> nvme0n1
        if let Some(pos) = device_name.rfind('p') {
            if device_name[pos+1..].chars().all(|c| c.is_numeric()) {
                return device_name[..pos].to_string();
            }
        }
    } else {
        // Traditional devices: sda1 -> sda
        let trimmed = device_name.trim_end_matches(|c: char| c.is_numeric());
        return trimmed.to_string();
    }
    device_name.to_string()
}

/// Determine if a sysfs device path is under USB topology
fn is_device_usb(sysfs_device_path: &Path) -> bool {
    // Resolve symlink to the actual device path in /sys/devices
    if let Ok(real_path) = fs::canonicalize(sysfs_device_path) {
        // Heuristic: if any ancestor contains "usb" segment, treat as external USB
        for component in real_path.components() {
            if let std::path::Component::Normal(name) = component {
                if name.to_string_lossy().contains("usb") {
                    return true;
                }
            }
        }
    }
    false
}

/// Get the device path where the application is currently running from
fn get_app_device_path() -> Result<String, String> {
    // Get current working directory
    match std::env::current_dir() {
        Ok(cwd) => {
            // Find which device the current directory is mounted on
            match fs::read_to_string("/proc/mounts") {
                Ok(mounts) => {
                    let cwd_str = cwd.to_string_lossy();
                    
                    let mut best_match = String::new();
                    let mut best_mount_len = 0;
                    
                    // Find the mount entry that contains our current directory
                    // Use the longest matching mount point for accuracy
                    for line in mounts.lines() {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 2 {
                            let device = parts[0];
                            let mount_point = parts[1];
                            
                            // Check if our cwd is under this mount point
                            if cwd_str.starts_with(mount_point) && mount_point.len() > best_mount_len {
                                best_match = device.to_string();
                                best_mount_len = mount_point.len();
                            }
                        }
                    }
                    
                    if !best_match.is_empty() {
                        // If we got a partition, derive the parent device
                        let base_device = get_base_device_name(&best_match);
                        return Ok(format!("/dev/{}", base_device));
                    }
                    
                    // Fallback: couldn't determine app device
                    Err("Could not determine app device from /proc/mounts".to_string())
                }
                Err(e) => Err(format!("Failed to read /proc/mounts: {}", e)),
            }
        }
        Err(e) => Err(format!("Failed to get current directory: {}", e)),
    }
}

/// Get detailed information about a specific drive
fn get_drive_info(sysfs_path: &Path, device_name: &str, is_removable: bool) -> Option<DriveInfo> {
    let device_path = format!("/dev/{}", device_name);

    // Get device size
    let size = get_device_size(sysfs_path)?;

    // Get vendor and model
    let (vendor, model) = get_device_model(sysfs_path);

    // Check if mounted
    let (is_mounted, mount_point) = get_mount_point(&device_path);

    Some(DriveInfo {
        device_path,
        mount_point,
        size_bytes: size,
        model,
        vendor,
        is_removable,
        is_mounted,
    })
}

/// Read device size from sysfs
fn get_device_size(sysfs_path: &Path) -> Option<u64> {
    let size_path = sysfs_path.join("size");
    fs::read_to_string(size_path)
        .ok()?
        .trim()
        .parse::<u64>()
        .ok()
        .map(|size| size * 512) // sysfs reports in 512-byte sectors
}

/// Get device vendor and model from sysfs
fn get_device_model(sysfs_path: &Path) -> (String, String) {
    let vendor = fs::read_to_string(sysfs_path.join("device/vendor"))
        .unwrap_or_default()
        .trim()
        .to_string();

    let model = fs::read_to_string(sysfs_path.join("device/model"))
        .unwrap_or_default()
        .trim()
        .to_string();

    (vendor, model)
}

/// Check if device is mounted and get mount point
fn get_mount_point(device_path: &str) -> (bool, Option<String>) {
    match fs::read_to_string("/proc/mounts") {
        Ok(content) => {
            for line in content.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 && parts[0] == device_path {
                    return (true, Some(parts[1].to_string()));
                }
            }
            (false, None)
        }
        Err(_) => (false, None),
    }
}

/// Get list of partition devices from a parent device
pub fn get_partitions(device_path: &str) -> Result<Vec<String>, String> {
    let device_name = device_path
        .split('/')
        .last()
        .ok_or("Invalid device path")?;

    let block_path = format!("/sys/class/block/{}", device_name);
    let mut partitions = Vec::new();

    match fs::read_dir(&block_path) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with(device_name) && name != device_name {
                        partitions.push(format!("/dev/{}", name));
                    }
                }
            }
        }
        Err(e) => return Err(format!("Failed to read partitions: {}", e)),
    }

    Ok(partitions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_drives() {
        match detect_external_drives(false) {
            Ok(drives) => {
                println!("Detected {} external drive(s)", drives.len());
                for drive in drives {
                    println!("  Device: {}", drive.device_path);
                    println!("  Size: {} bytes", drive.size_bytes);
                }
            }
            Err(e) => eprintln!("Error: {}", e),
        }
    }
}
