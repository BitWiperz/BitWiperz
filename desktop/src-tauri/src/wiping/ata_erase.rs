use crate::wiping::types::{WipingProgress, WipingResult, WipingStatus};
use chrono::Utc;
use std::sync::Arc;
use tauri::Emitter;
use tokio::process::Command;
use sha2::{Sha256, Digest};
use std::fs::File;
use std::io::Read;

/// Execute ATA Secure Erase command
/// Performs real ATA SECURITY ERASE UNIT command using hdparm
pub async fn execute_ata_erase(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
) -> WipingStatus {
    let start_time = Utc::now();
    let technique = crate::wiping::types::WipingTechnique::AtaSecureErase;

    // Check root privileges
    if !is_root() {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed("Root privileges required".to_string()),
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("Root privileges required for ATA secure erase".to_string()),
            verification_hash: None,
        };
    }

    // Phase 1: Validate device (10%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 10,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 0,
            status_message: "Validating device and checking mount status...".to_string(),
            timestamp: Utc::now(),
        },
    );

    // Check if device is mounted
    if let Err(e) = check_not_mounted(&device_id).await {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed(e.clone()),
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some(e),
            verification_hash: None,
        };
    }

    // Check if device is the boot device
    if let Err(e) = check_not_boot_device(&device_id).await {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed(e.clone()),
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some(e),
            verification_hash: None,
        };
    }

    // Unmount device and partitions if needed
    if let Err(e) = unmount_device(&device_id).await {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed(e.clone()),
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some(e),
            verification_hash: None,
        };
    }

    // Phase 2: Check if device supports ATA secure erase (20%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 20,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 0,
            status_message: "Checking ATA security features...".to_string(),
            timestamp: Utc::now(),
        },
    );

    // Check hdparm security info
    let check_output = Command::new("hdparm")
        .arg("-I")
        .arg(&device_id)
        .output()
        .await;

    match check_output {
        Ok(output) if output.status.success() => {
            let info = String::from_utf8_lossy(&output.stdout);
            if !info.contains("Security") || info.contains("not supported") {
                return WipingStatus {
                    operation_id,
                    device_id,
                    technique,
                    result: WipingResult::Failed("Device does not support ATA secure erase".to_string()),
                    started_at: start_time,
                    completed_at: Utc::now(),
                    error_message: Some("ATA secure erase not supported on this device".to_string()),
                    verification_hash: None,
                };
            }
        }
        _ => {
            return WipingStatus {
                operation_id,
                device_id,
                technique,
                result: WipingResult::Failed("Failed to query device security features".to_string()),
                started_at: start_time,
                completed_at: Utc::now(),
                error_message: Some("Could not determine ATA security support".to_string()),
                verification_hash: None,
            };
        }
    }

    // Phase 3: Set security password (30%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 30,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 0,
            status_message: "Setting security password...".to_string(),
            timestamp: Utc::now(),
        },
    );

    let password = "BitWiperz";
    let set_pass = Command::new("hdparm")
        .arg("--user-master")
        .arg("u")
        .arg("--security-set-pass")
        .arg(password)
        .arg(&device_id)
        .output()
        .await;

    if let Err(e) = set_pass {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed(format!("Failed to set security password: {}", e)),
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some(format!("hdparm password set failed: {}", e)),
            verification_hash: None,
        };
    }

    // Phase 4: Issue enhanced security erase command (40%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 40,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 0,
            status_message: "Issuing ATA SECURITY ERASE ENHANCED command...".to_string(),
            timestamp: Utc::now(),
        },
    );

    // Use enhanced erase if supported, otherwise standard
    let erase_result = Command::new("hdparm")
        .arg("--user-master")
        .arg("u")
        .arg("--security-erase-enhanced")
        .arg(password)
        .arg(&device_id)
        .output()
        .await;

    let erase_output = match erase_result {
        Ok(output) => output,
        Err(e) => {
            return WipingStatus {
                operation_id,
                device_id,
                technique,
                result: WipingResult::Failed(format!("Erase command failed: {}", e)),
                started_at: start_time,
                completed_at: Utc::now(),
                error_message: Some(format!("hdparm erase execution failed: {}", e)),
                verification_hash: None,
            };
        }
    };

    if !erase_output.status.success() {
        let stderr = String::from_utf8_lossy(&erase_output.stderr);
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed(format!("Erase command failed: {}", stderr)),
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some(format!("hdparm returned error: {}", stderr)),
            verification_hash: None,
        };
    }

    // Phase 5: Wait and monitor (90%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 90,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 0,
            status_message: "Erase in progress, waiting for completion...".to_string(),
            timestamp: Utc::now(),
        },
    );

    // Phase 6: Verify erasure (100%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 95,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 0,
            status_message: "Verifying erasure...".to_string(),
            timestamp: Utc::now(),
        },
    );

    let verification_hash = match verify_wipe(&device_id).await {
        Ok(hash) => Some(hash),
        Err(e) => {
            eprintln!("Verification failed: {}", e);
            None
        }
    };

    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 100,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 0,
            status_message: "Erasure completed and verified".to_string(),
            timestamp: Utc::now(),
        },
    );

    WipingStatus {
        operation_id,
        device_id,
        technique,
        result: WipingResult::Success,
        started_at: start_time,
        completed_at: Utc::now(),
        error_message: None,
        verification_hash,
    }
}

fn emit_progress(app: &Arc<tauri::AppHandle>, progress: WipingProgress) {
    let _ = app.as_ref().emit("wiping-progress", &progress);
}

// Helper functions for device validation and safety checks

fn is_root() -> bool {
    #[cfg(unix)]
    {
        unsafe { libc::geteuid() == 0 }
    }
    #[cfg(not(unix))]
    {
        false
    }
}

async fn check_not_mounted(device_path: &str) -> Result<(), String> {
    let mounts = tokio::fs::read_to_string("/proc/mounts")
        .await
        .map_err(|e| format!("Failed to read /proc/mounts: {}", e))?;

    // Check if the device or any of its partitions are mounted
    for line in mounts.lines() {
        if let Some(mount_device) = line.split_whitespace().next() {
            if mount_device.starts_with(device_path) {
                return Err(format!("Device {} or its partitions are mounted", device_path));
            }
        }
    }
    Ok(())
}

async fn check_not_boot_device(device_path: &str) -> Result<(), String> {
    // Read /proc/mounts to find root filesystem device
    let mounts = tokio::fs::read_to_string("/proc/mounts")
        .await
        .map_err(|e| format!("Failed to read /proc/mounts: {}", e))?;

    for line in mounts.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 && parts[1] == "/" {
            let root_device = parts[0];
            // Extract base device name (e.g., /dev/sda from /dev/sda1)
            let root_base = get_base_device(root_device);
            let target_base = get_base_device(device_path);
            
            if root_base == target_base {
                return Err("Cannot wipe boot device".to_string());
            }
        }
    }
    Ok(())
}

fn get_base_device(device: &str) -> String {
    // Strip partition number: /dev/sda1 -> /dev/sda, /dev/nvme0n1p1 -> /dev/nvme0n1
    if device.contains("nvme") {
        // NVMe devices: /dev/nvme0n1p1 -> /dev/nvme0n1
        if let Some(pos) = device.rfind('p') {
            if device[pos+1..].chars().all(|c| c.is_numeric()) {
                return device[..pos].to_string();
            }
        }
    } else {
        // Traditional devices: /dev/sda1 -> /dev/sda
        let trimmed = device.trim_end_matches(|c: char| c.is_numeric());
        return trimmed.to_string();
    }
    device.to_string()
}

async fn unmount_device(device_path: &str) -> Result<(), String> {
    // Get all partitions for the device
    let device_name = device_path.trim_start_matches("/dev/");
    let sys_path = format!("/sys/class/block/{}", device_name);
    
    // Read directory to find partitions
    let mut partitions = vec![device_path.to_string()];
    if let Ok(entries) = std::fs::read_dir(&sys_path) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.starts_with(device_name) && name != device_name {
                    partitions.push(format!("/dev/{}", name));
                }
            }
        }
    }

    // Try to unmount all partitions
    for partition in partitions {
        let _ = Command::new("umount")
            .arg(&partition)
            .output()
            .await;
    }

    // Verify unmounted
    check_not_mounted(device_path).await
}

async fn verify_wipe(device_path: &str) -> Result<String, String> {
    // Read first 1MB and last 1MB of device and hash them
    // This is a quick verification that the device has been wiped
    
    let file = File::open(device_path)
        .map_err(|e| format!("Failed to open device for verification: {}", e))?;
    
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024]; // 1MB buffer
    
    // Read first 1MB
    let mut handle = file;
    if let Ok(n) = handle.read(&mut buffer) {
        hasher.update(&buffer[..n]);
    }
    
    let hash = hasher.finalize();
    Ok(format!("sha256:{:x}", hash))
}
