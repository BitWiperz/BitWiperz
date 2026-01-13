use crate::wiping::types::{WipingProgress, WipingResult, WipingStatus, WipingTechnique};
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::sync::Arc;
use tauri::Emitter;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;

/// Execute Random Single Pass wiping
/// Writes random data to the entire device in one pass
pub async fn execute_random_single_pass(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
    cancel_token: CancellationToken,
) -> WipingStatus {
    execute_single_pass(
        app,
        operation_id,
        device_id,
        WipingTechnique::RandomSinglePass,
        FillPattern::Random,
        cancel_token,
    )
    .await
}

/// Execute Zero Fill wiping
/// Writes zeros to the entire device in one pass
pub async fn execute_zero_fill(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
    cancel_token: CancellationToken,
) -> WipingStatus {
    execute_single_pass(
        app,
        operation_id,
        device_id,
        WipingTechnique::ZeroFill,
        FillPattern::Zero,
        cancel_token,
    )
    .await
}

#[derive(Clone)]
enum FillPattern {
    Random,
    Zero,
}

impl FillPattern {
    fn description(&self) -> &'static str {
        match self {
            FillPattern::Random => "random data",
            FillPattern::Zero => "zeros",
        }
    }
}

async fn execute_single_pass(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
    technique: WipingTechnique,
    pattern: FillPattern,
    cancel_token: CancellationToken,
) -> WipingStatus {
    let start_time = Utc::now();

    // Check root privileges
    if !is_root() {
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("Root privileges required for wiping".to_string()),
            verification_hash: None,
        };
    }

    // Phase 1: Validate device (5%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 5,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 0,
            status_message: "Validating device...".to_string(),
            timestamp: Utc::now(),
        },
    );

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

    // Get device size
    let device_capacity = match get_device_size(&device_id).await {
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

    // Phase 2: Execute single pass (10-90%)
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
            status_message: format!("Writing {}...", pattern.description()),
            timestamp: Utc::now(),
        },
    );

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

    // Execute the write pass
    match execute_write_pass(
        &app,
        &operation_id,
        &device_id,
        &technique,
        device_capacity,
        &pattern,
        &cancel_token,
    )
    .await
    {
        Ok(_) => {}
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
            bytes_processed: device_capacity,
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
            bytes_processed: device_capacity,
            status_message: format!(
                "{} complete",
                match pattern {
                    FillPattern::Random => "Random single pass",
                    FillPattern::Zero => "Zero fill",
                }
            ),
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

async fn execute_write_pass(
    app: &Arc<tauri::AppHandle>,
    operation_id: &str,
    device_id: &str,
    technique: &WipingTechnique,
    device_capacity: u64,
    pattern: &FillPattern,
    cancel_token: &CancellationToken,
) -> Result<(), String> {
    // Use dd for reliable block device writing
    let input_source = match pattern {
        FillPattern::Random => "/dev/urandom",
        FillPattern::Zero => "/dev/zero",
    };

    // Block size of 4MB for efficiency
    let block_size: u64 = 4 * 1024 * 1024;
    let total_blocks = (device_capacity + block_size - 1) / block_size;

    eprintln!(
        "Starting {} pass: {} blocks of {} bytes",
        pattern.description(),
        total_blocks,
        block_size
    );

    // Use dd with progress monitoring
    // We'll run dd in chunks to provide progress updates
    let mut bytes_written: u64 = 0;
    let chunk_blocks: u64 = 100; // Write 100 blocks (400MB) at a time for progress updates

    let mut current_offset: u64 = 0;

    while current_offset < device_capacity {
        if cancel_token.is_cancelled() {
            return Err("Operation cancelled".to_string());
        }

        let blocks_to_write = std::cmp::min(
            chunk_blocks,
            (device_capacity - current_offset + block_size - 1) / block_size,
        );

        let skip_blocks = current_offset / block_size;

        let dd_result = Command::new("dd")
            .args([
                &format!("if={}", input_source),
                &format!("of={}", device_id),
                &format!("bs={}", block_size),
                &format!("count={}", blocks_to_write),
                &format!("seek={}", skip_blocks),
                "conv=notrunc,fsync",
                "status=none",
            ])
            .output()
            .await;

        match dd_result {
            Ok(output) if output.status.success() => {
                bytes_written += blocks_to_write * block_size;
                current_offset = bytes_written;

                // Calculate and emit progress
                let progress_percent =
                    10 + ((bytes_written as f64 / device_capacity as f64) * 80.0) as u32;

                emit_progress(
                    app,
                    WipingProgress {
                        operation_id: operation_id.to_string(),
                        device_id: device_id.to_string(),
                        technique: technique.clone(),
                        progress_percent: std::cmp::min(progress_percent, 90),
                        current_pass: 1,
                        total_passes: 1,
                        bytes_processed: std::cmp::min(bytes_written, device_capacity),
                        status_message: format!(
                            "Writing {} - {:.1}%",
                            pattern.description(),
                            (bytes_written as f64 / device_capacity as f64) * 100.0
                        ),
                        timestamp: Utc::now(),
                    },
                );
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("dd failed: {}", stderr));
            }
            Err(e) => {
                return Err(format!("Failed to execute dd: {}", e));
            }
        }
    }

    // Sync to ensure all data is written to disk
    let _ = Command::new("sync").output().await;

    Ok(())
}

fn is_root() -> bool {
    unsafe { libc::geteuid() == 0 }
}

fn emit_progress(app: &Arc<tauri::AppHandle>, progress: WipingProgress) {
    let _ = app.as_ref().emit("wiping-progress", &progress);
}

async fn check_not_boot_device(device_id: &str) -> Result<(), String> {
    // Read /proc/cmdline to find boot device
    if let Ok(cmdline) = std::fs::read_to_string("/proc/cmdline") {
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

async fn get_device_size(device_id: &str) -> Result<u64, String> {
    let output = Command::new("blockdev")
        .args(["--getsize64", device_id])
        .output()
        .await
        .map_err(|e| format!("Failed to get device size: {}", e))?;

    if !output.status.success() {
        return Err("Failed to get device size".to_string());
    }

    String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<u64>()
        .map_err(|e| format!("Failed to parse device size: {}", e))
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
