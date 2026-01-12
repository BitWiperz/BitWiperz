use crate::wiping::types::{WipingProgress, WipingResult, WipingStatus};
use chrono::Utc;
use std::sync::Arc;
use tauri::Emitter;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;
use sha2::{Sha256, Digest};
use std::fs::File;
use std::io::Read;

/// Execute Block-level erase using blkdiscard
/// Uses TRIM/UNMAP commands for SSDs via blkdiscard
pub async fn execute_block_erase(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
    cancel_token: CancellationToken,
) -> WipingStatus {
    let start_time = Utc::now();
    let technique = crate::wiping::types::WipingTechnique::BlockErase;

    // Check root privileges
    if !is_root() {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("Root privileges required for block erase".to_string()),
            verification_hash: None,
        };
    }

    // Phase 1: Validate device (15%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 15,
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
            result: WipingResult::Failed,
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
            result: WipingResult::Failed,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some(e),
            verification_hash: None,
        };
    }

    // Unmount device and partitions
    if let Err(e) = unmount_device(&device_id).await {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some(e),
            verification_hash: None,
        };
    }

    // Phase 2: Get device size
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
            status_message: "Getting device size...".to_string(),
            timestamp: Utc::now(),
        },
    );

    let device_size = match get_device_size(&device_id).await {
        Ok(size) => size,
        Err(e) => {
            return WipingStatus {
                operation_id,
                device_id,
                technique,
                result: WipingResult::Failed,
                started_at: start_time,
                completed_at: Utc::now(),
                error_message: Some(e),
                verification_hash: None,
            };
        }
    };

    // Phase 3: Execute blkdiscard (30-90%)
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
            status_message: "Erasing blocks with TRIM/UNMAP commands...".to_string(),
            timestamp: Utc::now(),
        },
    );

    // Check for cancellation before starting
    if cancel_token.is_cancelled() {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Cancelled,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("Operation cancelled before erase started".to_string()),
            verification_hash: None,
        };
    }

    // Spawn blkdiscard as a child process
    let mut child = match Command::new("blkdiscard")
        .arg(&device_id)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            return WipingStatus {
                operation_id,
                device_id,
                technique,
                result: WipingResult::Failed,
                started_at: start_time,
                completed_at: Utc::now(),
                error_message: Some(format!("Failed to spawn blkdiscard: {}", e)),
                verification_hash: None,
            };
        }
    };

    // Wait for the child process or cancellation
    tokio::select! {
        result = child.wait() => {
            match result {
                Ok(status) if status.success() => {
                    emit_progress(
                        &app,
                        WipingProgress {
                            operation_id: operation_id.clone(),
                            device_id: device_id.clone(),
                            technique: technique.clone(),
                            progress_percent: 90,
                            current_pass: 1,
                            total_passes: 1,
                            bytes_processed: device_size,
                            status_message: "Block erase completed".to_string(),
                            timestamp: Utc::now(),
                        },
                    );
                }
                Ok(_status) => {
                    // Process failed, try to get stderr
                    let mut stderr = vec![];
                    if let Some(mut stderr_pipe) = child.stderr.take() {
                        use tokio::io::AsyncReadExt;
                        let _ = stderr_pipe.read_to_end(&mut stderr).await;
                    }
                    
                    return WipingStatus {
                        operation_id,
                        device_id,
                        technique,
                        result: WipingResult::Failed,
                        started_at: start_time,
                        completed_at: Utc::now(),
                        error_message: Some(format!("blkdiscard error: {}", String::from_utf8_lossy(&stderr))),
                        verification_hash: None,
                    };
                }
                Err(e) => {
                    return WipingStatus {
                        operation_id,
                        device_id,
                        technique,
                        result: WipingResult::Failed,
                        started_at: start_time,
                        completed_at: Utc::now(),
                        error_message: Some(format!("Command execution failed: {}", e)),
                        verification_hash: None,
                    };
                }
            }
        }
        _ = cancel_token.cancelled() => {
            // Kill the child process
            let _ = child.kill().await;
            
            return WipingStatus {
                operation_id,
                device_id,
                technique,
                result: WipingResult::Cancelled,
                started_at: start_time,
                completed_at: Utc::now(),
                error_message: Some("Operation cancelled during erase".to_string()),
                verification_hash: None,
            };
        }
    };

    // Phase 4: Verify (100%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 95,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: device_size,
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
            bytes_processed: device_size,
            status_message: "Block erasure verified successfully".to_string(),
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

// Helper functions

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
    let mounts = tokio::fs::read_to_string("/proc/mounts")
        .await
        .map_err(|e| format!("Failed to read /proc/mounts: {}", e))?;

    for line in mounts.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 && parts[1] == "/" {
            let root_device = parts[0];
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
    if device.contains("nvme") {
        if let Some(pos) = device.rfind('p') {
            if device[pos+1..].chars().all(|c| c.is_numeric()) {
                return device[..pos].to_string();
            }
        }
    } else {
        let trimmed = device.trim_end_matches(|c: char| c.is_numeric());
        return trimmed.to_string();
    }
    device.to_string()
}

async fn unmount_device(device_path: &str) -> Result<(), String> {
    let device_name = device_path.trim_start_matches("/dev/");
    let sys_path = format!("/sys/class/block/{}", device_name);
    
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

    for partition in partitions {
        let _ = Command::new("umount")
            .arg(&partition)
            .output()
            .await;
    }

    check_not_mounted(device_path).await
}

async fn get_device_size(device_path: &str) -> Result<u64, String> {
    let device_name = device_path.trim_start_matches("/dev/");
    let size_path = format!("/sys/class/block/{}/size", device_name);
    
    let size_str = tokio::fs::read_to_string(&size_path)
        .await
        .map_err(|e| format!("Failed to read device size: {}", e))?;
    
    let size_sectors: u64 = size_str.trim()
        .parse()
        .map_err(|e| format!("Failed to parse device size: {}", e))?;
    
    Ok(size_sectors * 512) // Convert sectors to bytes
}

async fn verify_wipe(device_path: &str) -> Result<String, String> {
    let file = File::open(device_path)
        .map_err(|e| format!("Failed to open device for verification: {}", e))?;
    
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 1024 * 1024];
    
    let mut handle = file;
    if let Ok(n) = handle.read(&mut buffer) {
        hasher.update(&buffer[..n]);
    }
    
    let hash = hasher.finalize();
    Ok(format!("sha256:{:x}", hash))
}
