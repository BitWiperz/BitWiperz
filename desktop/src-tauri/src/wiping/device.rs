use crate::wiping::types::DeviceInfo;
use std::fs;
use std::path::Path;

/// List available storage devices in the system
/// Queries actual block devices from /sys/block
pub fn list_devices() -> Vec<DeviceInfo> {
    let mut devices = Vec::new();

    // Try to detect devices from /sys/block (Linux)
    if let Ok(entries) = fs::read_dir("/sys/block") {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        // Skip loop and ram devices
                        if name.starts_with("loop") || name.starts_with("ram") {
                            continue;
                        }

                        if let Some(device) = read_device_info(name) {
                            devices.push(device);
                        }
                    }
                }
            }
        }
    }

    // If no devices found, return empty list (user will see "No devices detected")
    // This is better than showing fake data
    devices
}

/// Read device information from /sys/block/{device_name}
fn read_device_info(device_name: &str) -> Option<DeviceInfo> {
    let base_path = format!("/sys/block/{}", device_name);
    let base = Path::new(&base_path);

    // Get device size (in 512-byte sectors)
    let size_path = base.join("size");
    let capacity_bytes = fs::read_to_string(&size_path)
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
        .map(|sectors| sectors * 512)?;

    // Get device model if available
    let model = get_device_model(device_name)
        .unwrap_or_else(|| format!("Storage Device {}", device_name.to_uppercase()));

    // Get serial number if available
    let serial = get_device_serial(device_name).unwrap_or_else(|| "N/A".to_string());

    // Determine device type
    let device_type = if device_name.starts_with("nvme") {
        "NVMe"
    } else if device_name.starts_with("mmc") {
        "MMC"
    } else if device_name.starts_with("vd") {
        "Virtual"
    } else {
        "HDD" // Default for sda, sdb, etc.
    };

    Some(DeviceInfo {
        id: format!("/dev/{}", device_name),
        name: model.clone(),
        model,
        serial_number: serial,
        capacity_bytes,
        device_type: device_type.to_string(),
    })
}

/// Try to get device model from sysfs
fn get_device_model(device_name: &str) -> Option<String> {
    // Try NVME model
    if device_name.starts_with("nvme") {
        let model_path = format!("/sys/block/{}/device/model", device_name);
        if let Ok(model) = fs::read_to_string(&model_path) {
            return Some(model.trim().to_string());
        }
    }

    // Try generic device/model_name
    let model_path = format!("/sys/block/{}/device/model", device_name);
    fs::read_to_string(&model_path)
        .ok()
        .map(|s| s.trim().to_string())
}

/// Try to get device serial number from sysfs
fn get_device_serial(device_name: &str) -> Option<String> {
    // Try NVME serial
    if device_name.starts_with("nvme") {
        let serial_path = format!("/sys/block/{}/device/serial", device_name);
        if let Ok(serial) = fs::read_to_string(&serial_path) {
            return Some(serial.trim().to_string());
        }
    }

    // Try generic device/serial
    let serial_path = format!("/sys/block/{}/device/serial", device_name);
    fs::read_to_string(&serial_path)
        .ok()
        .map(|s| s.trim().to_string())
}

/// Check if running in a virtual machine environment
pub fn is_vm_environment() -> bool {
    // Check for common VM indicators
    if let Ok(dmi_data) = fs::read_to_string("/sys/class/dmi/id/sys_vendor") {
        let vendor = dmi_data.to_lowercase();
        if vendor.contains("vmware")
            || vendor.contains("virtualbox")
            || vendor.contains("qemu")
            || vendor.contains("kvm")
        {
            return true;
        }
    }

    // Check for hypervisor via cpuid
    if let Ok(cpuinfo) = fs::read_to_string("/proc/cpuinfo") {
        if cpuinfo.contains("hypervisor") {
            return true;
        }
    }

    false
}
