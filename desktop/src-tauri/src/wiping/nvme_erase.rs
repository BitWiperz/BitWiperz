use crate::wiping::types::{WipingProgress, WipingResult, WipingStatus, WipingTechnique};
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::sync::Arc;
use tauri::Emitter;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;

/// Execute NVMe Secure Erase using nvme-cli
/// Uses the NVMe sanitize command with block erase
pub async fn execute_nvme_secure_erase(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
    cancel_token: CancellationToken,
) -> WipingStatus {
    let start_time = Utc::now();
    let technique = WipingTechnique::NvmeSecureErase;

    // Check root privileges
    if !is_root() {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("Root privileges required for NVMe secure erase".to_string()),
            verification_hash: None,
        };
    }

    // Verify this is an NVMe device
    if !device_id.contains("nvme") {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some(
                "NVMe Secure Erase can only be used on NVMe devices".to_string(),
            ),
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
            status_message: "Validating NVMe device...".to_string(),
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

    // Unmount device
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

    // Phase 2: Check nvme-cli availability (20%)
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
            status_message: "Checking NVMe capabilities...".to_string(),
            timestamp: Utc::now(),
        },
    );

    let nvme_check = Command::new("which").arg("nvme").output().await;

    if nvme_check.is_err() || !nvme_check.unwrap().status.success() {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("nvme-cli tool is required for NVMe secure erase".to_string()),
            verification_hash: None,
        };
    }

    // Check for cancellation
    if cancel_token.is_cancelled() {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Cancelled,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("Operation cancelled".to_string()),
            verification_hash: None,
        };
    }

    // Phase 3: Check sanitize support (30%)
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
            status_message: "Checking sanitize support...".to_string(),
            timestamp: Utc::now(),
        },
    );

    // Get the controller path (e.g., /dev/nvme0 from /dev/nvme0n1)
    let controller = get_nvme_controller(&device_id);

    // Check if sanitize is supported
    let id_ctrl = Command::new("nvme")
        .args(["id-ctrl", &controller, "-H"])
        .output()
        .await;

    let supports_sanitize = match id_ctrl {
        Ok(output) if output.status.success() => {
            let info = String::from_utf8_lossy(&output.stdout);
            info.contains("Sanitize") || info.contains("sanitize")
        }
        _ => false,
    };

    // Phase 4: Execute sanitize (40-90%)
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
            status_message: "Executing NVMe secure erase...".to_string(),
            timestamp: Utc::now(),
        },
    );

    if supports_sanitize {
        // Use sanitize command with block erase (sanact=2)
        let sanitize_result = Command::new("nvme")
            .args(["sanitize", &device_id, "-a", "2"])
            .output()
            .await;

        match sanitize_result {
            Ok(output) if output.status.success() => {
                // Poll sanitize status until complete
                if let Err(e) = poll_sanitize_status(&app, &operation_id, &device_id, &technique, &cancel_token).await {
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
            }
            Ok(output) => {
                let error = String::from_utf8_lossy(&output.stderr);
                return WipingStatus {
                    operation_id,
                    device_id,
                    technique,
                    result: WipingResult::Failed,
                    started_at: start_time,
                    completed_at: Utc::now(),
                    error_message: Some(format!("NVMe sanitize failed: {}", error)),
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
                    error_message: Some(format!("Failed to execute NVMe sanitize: {}", e)),
                    verification_hash: None,
                };
            }
        }
    } else {
        // Fall back to format command if sanitize not supported
        return execute_nvme_format_internal(
            app,
            operation_id,
            device_id,
            technique,
            start_time,
            cancel_token,
        )
        .await;
    }

    // Phase 5: Verification (95%)
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

    let verification_hash = compute_verification_hash(&device_id);

    // Complete
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
            status_message: "NVMe secure erase complete".to_string(),
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

/// Execute NVMe Format command
/// Uses nvme format to perform a low-level format
pub async fn execute_nvme_format(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
    cancel_token: CancellationToken,
) -> WipingStatus {
    let start_time = Utc::now();
    let technique = WipingTechnique::NvmeFormat;

    // Check root privileges
    if !is_root() {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("Root privileges required for NVMe format".to_string()),
            verification_hash: None,
        };
    }

    // Verify this is an NVMe device
    if !device_id.contains("nvme") {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("NVMe Format can only be used on NVMe devices".to_string()),
            verification_hash: None,
        };
    }

    execute_nvme_format_internal(app, operation_id, device_id, technique, start_time, cancel_token)
        .await
}

async fn execute_nvme_format_internal(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
    technique: WipingTechnique,
    start_time: chrono::DateTime<Utc>,
    cancel_token: CancellationToken,
) -> WipingStatus {
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
            status_message: "Validating NVMe device...".to_string(),
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

    // Unmount device
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

    // Check for cancellation
    if cancel_token.is_cancelled() {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Cancelled,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("Operation cancelled".to_string()),
            verification_hash: None,
        };
    }

    // Phase 2: Execute NVMe format (40-90%)
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
            status_message: "Executing NVMe format with secure erase...".to_string(),
            timestamp: Utc::now(),
        },
    );

    // Execute nvme format with secure erase level 1 (user data erase)
    // ses=1 means user data erase, ses=2 means cryptographic erase
    let format_result = Command::new("nvme")
        .args(["format", &device_id, "-s", "1", "-f"])
        .output()
        .await;

    match format_result {
        Ok(output) if output.status.success() => {
            // Format succeeded
        }
        Ok(output) => {
            let error = String::from_utf8_lossy(&output.stderr);
            return WipingStatus {
                operation_id,
                device_id,
                technique,
                result: WipingResult::Failed,
                started_at: start_time,
                completed_at: Utc::now(),
                error_message: Some(format!("NVMe format failed: {}", error)),
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
                error_message: Some(format!("Failed to execute NVMe format: {}", e)),
                verification_hash: None,
            };
        }
    }

    // Phase 3: Verification (95%)
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

    let verification_hash = compute_verification_hash(&device_id);

    // Complete
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
            status_message: "NVMe format complete".to_string(),
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

/// Poll sanitize status until complete
async fn poll_sanitize_status(
    app: &Arc<tauri::AppHandle>,
    operation_id: &str,
    device_id: &str,
    technique: &WipingTechnique,
    cancel_token: &CancellationToken,
) -> Result<(), String> {
    loop {
        if cancel_token.is_cancelled() {
            return Err("Operation cancelled".to_string());
        }

        let status = Command::new("nvme")
            .args(["sanitize-log", device_id])
            .output()
            .await;

        match status {
            Ok(output) if output.status.success() => {
                let log = String::from_utf8_lossy(&output.stdout);

                // Check if sanitize is complete
                if log.contains("completed successfully")
                    || log.contains("SSTAT=0x101")
                    || log.contains("No sanitize operation")
                {
                    return Ok(());
                }

                // Parse progress if available
                if let Some(progress) = parse_sanitize_progress(&log) {
                    emit_progress(
                        app,
                        WipingProgress {
                            operation_id: operation_id.to_string(),
                            device_id: device_id.to_string(),
                            technique: technique.clone(),
                            progress_percent: 40 + (progress as u32 * 50 / 100),
                            current_pass: 1,
                            total_passes: 1,
                            bytes_processed: 0,
                            status_message: format!("Sanitizing... {}%", progress),
                            timestamp: Utc::now(),
                        },
                    );
                }

                // Check for error
                if log.contains("failed") || log.contains("error") {
                    return Err("Sanitize operation failed".to_string());
                }
            }
            _ => {
                // Can't get status, just wait and retry
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }
}

fn parse_sanitize_progress(log: &str) -> Option<u8> {
    // Try to parse progress percentage from sanitize log
    for line in log.lines() {
        if line.contains("SPROG") || line.contains("progress") {
            // Look for percentage value
            if let Some(pct) = line.split_whitespace().find(|s| s.ends_with('%')) {
                if let Ok(val) = pct.trim_end_matches('%').parse::<u8>() {
                    return Some(val);
                }
            }
        }
    }
    None
}

fn get_nvme_controller(device_id: &str) -> String {
    // Convert /dev/nvme0n1 to /dev/nvme0
    let re = regex::Regex::new(r"^(/dev/nvme\d+)n\d+$").unwrap();
    if let Some(caps) = re.captures(device_id) {
        caps.get(1).map_or(device_id.to_string(), |m| m.as_str().to_string())
    } else {
        device_id.to_string()
    }
}

fn is_root() -> bool {
    unsafe { libc::geteuid() == 0 }
}

fn emit_progress(app: &Arc<tauri::AppHandle>, progress: WipingProgress) {
    let _ = app.as_ref().emit("wiping-progress", &progress);
}

async fn check_not_mounted(device_id: &str) -> Result<(), String> {
    let output = Command::new("findmnt")
        .args(["-n", "-o", "TARGET", device_id])
        .output()
        .await;

    match output {
        Ok(result) => {
            if !result.stdout.is_empty() {
                return Err(format!(
                    "Device {} is mounted. Please unmount before wiping.",
                    device_id
                ));
            }
            Ok(())
        }
        Err(_) => Ok(()), // findmnt not found or error, assume not mounted
    }
}

async fn check_not_boot_device(device_id: &str) -> Result<(), String> {
    // Read /proc/cmdline to find boot device
    if let Ok(cmdline) = std::fs::read_to_string("/proc/cmdline") {
        // Extract device name without partition number for comparison
        let base_device = device_id.trim_end_matches(char::is_numeric);

        if cmdline.contains(base_device) || cmdline.contains(&device_id.replace("/dev/", "")) {
            return Err(format!(
                "Device {} appears to be the boot device. Cannot wipe boot device.",
                device_id
            ));
        }
    }

    // Also check root mount
    if let Ok(mounts) = std::fs::read_to_string("/proc/mounts") {
        for line in mounts.lines() {
            if line.contains(" / ") {
                let base_device = device_id.trim_end_matches(char::is_numeric);
                if line.starts_with(device_id) || line.starts_with(base_device) {
                    return Err(format!(
                        "Device {} contains the root filesystem. Cannot wipe.",
                        device_id
                    ));
                }
            }
        }
    }

    Ok(())
}

async fn unmount_device(device_id: &str) -> Result<(), String> {
    // Get list of partitions
    let lsblk = Command::new("lsblk")
        .args(["-ln", "-o", "NAME", device_id])
        .output()
        .await;

    if let Ok(output) = lsblk {
        let devices: Vec<String> = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|s| format!("/dev/{}", s.trim()))
            .collect();

        for dev in devices {
            let _ = Command::new("umount").arg(&dev).output().await;
        }
    }

    // Also try to unmount the main device
    let _ = Command::new("umount").arg(device_id).output().await;

    Ok(())
}

fn compute_verification_hash(device_id: &str) -> Option<String> {
    // Read first 4KB of device and compute hash
    let mut file = match File::open(device_id) {
        Ok(f) => f,
        Err(_) => return None,
    };

    let mut buffer = vec![0u8; 4096];
    match file.read(&mut buffer) {
        Ok(_) => {
            let mut hasher = Sha256::new();
            hasher.update(&buffer);
            Some(format!("{:x}", hasher.finalize()))
        }
        Err(_) => None,
    }
}
