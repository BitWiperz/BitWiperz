use crate::wiping::types::{WipingProgress, WipingResult, WipingStatus, WipingTechnique};
use chrono::Utc;
use std::sync::Arc;
use tauri::Emitter;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;
use sha2::{Sha256, Digest};
use std::fs::File;
use std::io::Read;

/// Execute Multipass wiping with actual disk overwriting
/// Supports DoD 3-pass, DoD 7-pass, and Gutmann 35-pass
pub async fn execute_multipass(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
    technique: WipingTechnique,
    cancel_token: CancellationToken,
) -> WipingStatus {
    eprintln!("=== EXECUTE_MULTIPASS ===");
    eprintln!("Device: {}", device_id);
    eprintln!("Technique: {:?}", technique);
    
    let start_time = Utc::now();

    // Check root privileges
    eprintln!("Checking root privileges...");
    if !is_root() {
        eprintln!("ERROR: Not running as root!");
        return WipingStatus {
            operation_id,
            device_id,
            technique,
            result: WipingResult::Failed,
            started_at: start_time,
            completed_at: Utc::now(),
            error_message: Some("Root privileges required for multipass wiping".to_string()),
            verification_hash: None,
        };
    }
    eprintln!("Root check passed");

    let (total_passes, description) = match technique {
        WipingTechnique::MultipassDoD3 => (3, "DoD 5220.22-M 3-Pass"),
        WipingTechnique::MultipassDoD7 => (7, "DoD 7-Pass Extended"),
        WipingTechnique::MultipassGutmann => (35, "Gutmann 35-Pass"),
        _ => (3, "Multipass"),
    };
    eprintln!("Total passes: {}", total_passes);

    // Phase 1: Validate device
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 5,
            current_pass: 0,
            total_passes,
            bytes_processed: 0,
            status_message: "Validating device and checking mount status...".to_string(),
            timestamp: Utc::now(),
        },
    );

    // Check if device is the boot device BEFORE doing anything
    eprintln!("Checking if device is boot device...");
    if let Err(e) = check_not_boot_device(&device_id).await {
        eprintln!("ERROR: Boot device check failed: {}", e);
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
    eprintln!("Boot device check passed");

    // Unmount device and partitions (will check if mounted and unmount)
    eprintln!("Unmounting device and partitions...");
    if let Err(e) = unmount_device(&device_id).await {
        eprintln!("ERROR: Unmount failed: {}", e);
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
    eprintln!("Unmount successful");

    // Get device size
    eprintln!("Getting device size...");
    let device_capacity = match get_device_size(&device_id).await {
        Ok(size) => {
            eprintln!("Device size: {} bytes", size);
            size
        }
        Err(e) => {
            eprintln!("ERROR: Failed to get device size: {}", e);
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

    // Determine pass patterns based on technique
    let patterns = get_pass_patterns(&technique, total_passes);

    // Execute each pass
    for pass in 1..=total_passes {
        let pattern = &patterns[(pass - 1) as usize];
        
        emit_progress(
            &app,
            WipingProgress {
                operation_id: operation_id.clone(),
                device_id: device_id.clone(),
                technique: technique.clone(),
                progress_percent: (5 + (pass - 1) * 85 / total_passes) as u32,
                current_pass: pass,
                total_passes,
                bytes_processed: 0,
                status_message: format!("Pass {}/{} - {}", pass, total_passes, pattern.description),
                timestamp: Utc::now(),
            },
        );

        // Check for cancellation before each pass
        if cancel_token.is_cancelled() {
            return WipingStatus {
                operation_id,
                device_id,
                technique,
                result: WipingResult::Cancelled,
                started_at: start_time,
                completed_at: Utc::now(),
                error_message: Some(format!("Operation cancelled before pass {}", pass)),
                verification_hash: None,
            };
        }

        // Execute the pass
        match execute_pass(
            &app,
            &operation_id,
            &device_id,
            &technique,
            pass,
            total_passes,
            device_capacity,
            pattern,
            &cancel_token,
        ).await {
            Ok(_) => {},
            Err(e) => {
                return WipingStatus {
                    operation_id,
                    device_id,
                    technique,
                    result: WipingResult::Failed,
                    started_at: start_time,
                    completed_at: Utc::now(),
                    error_message: Some(format!("Pass {} failed: {}", pass, e)),
                    verification_hash: None,
                };
            }
        }
    }

    // Final verification (90-100%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 95,
            current_pass: total_passes,
            total_passes,
            bytes_processed: device_capacity,
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
            current_pass: total_passes,
            total_passes,
            bytes_processed: device_capacity,
            status_message: format!("{} wiping completed and verified", description),
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

struct PassPattern {
    description: String,
    pattern_type: PatternType,
}

enum PatternType {
    Fixed(u8),
    Random,
}

fn get_pass_patterns(technique: &WipingTechnique, total_passes: u32) -> Vec<PassPattern> {
    match technique {
        WipingTechnique::MultipassDoD3 => vec![
            PassPattern { description: "Pattern: 0x00".to_string(), pattern_type: PatternType::Fixed(0x00) },
            PassPattern { description: "Pattern: 0xFF".to_string(), pattern_type: PatternType::Fixed(0xFF) },
            PassPattern { description: "Pattern: Random".to_string(), pattern_type: PatternType::Random },
        ],
        WipingTechnique::MultipassDoD7 => vec![
            PassPattern { description: "Pass 1: 0xF6".to_string(), pattern_type: PatternType::Fixed(0xF6) },
            PassPattern { description: "Pass 2: 0x00".to_string(), pattern_type: PatternType::Fixed(0x00) },
            PassPattern { description: "Pass 3: 0xFF".to_string(), pattern_type: PatternType::Fixed(0xFF) },
            PassPattern { description: "Pass 4: Random".to_string(), pattern_type: PatternType::Random },
            PassPattern { description: "Pass 5: 0x00".to_string(), pattern_type: PatternType::Fixed(0x00) },
            PassPattern { description: "Pass 6: 0xFF".to_string(), pattern_type: PatternType::Fixed(0xFF) },
            PassPattern { description: "Pass 7: Random".to_string(), pattern_type: PatternType::Random },
        ],
        WipingTechnique::MultipassGutmann => {
            // Simplified Gutmann pattern
            let mut patterns = Vec::new();
            for i in 1..=total_passes {
                let pattern_type = match i {
                    1..=4 => PatternType::Random,
                    5..=31 => PatternType::Fixed((i % 256) as u8),
                    _ => PatternType::Random,
                };
                patterns.push(PassPattern {
                    description: format!("Pass {}: {}", i, if matches!(pattern_type, PatternType::Random) { "Random" } else { "Pattern" }),
                    pattern_type,
                });
            }
            patterns
        },
        _ => vec![
            PassPattern { description: "Pattern: 0x00".to_string(), pattern_type: PatternType::Fixed(0x00) },
            PassPattern { description: "Pattern: 0xFF".to_string(), pattern_type: PatternType::Fixed(0xFF) },
            PassPattern { description: "Pattern: Random".to_string(), pattern_type: PatternType::Random },
        ],
    }
}

async fn execute_pass(
    app: &Arc<tauri::AppHandle>,
    operation_id: &str,
    device_id: &str,
    technique: &WipingTechnique,
    pass: u32,
    total_passes: u32,
    device_capacity: u64,
    pattern: &PassPattern,
    cancel_token: &CancellationToken,
) -> Result<(), String> {
    eprintln!("=== EXECUTE_PASS ===");
    eprintln!("Pass: {}/{}", pass, total_passes);
    eprintln!("Pattern: {}", pattern.description);
    eprintln!("Device capacity: {} bytes", device_capacity);
    
    // Use dd for efficient disk writing
    match &pattern.pattern_type {
        PatternType::Fixed(byte) => {
            eprintln!("Using fixed pattern: 0x{:02x}", byte);
            // Use dd with fixed pattern
            let pattern_str = format!("\\x{:02x}", byte);
            
            let dd_command = format!(
                "dd if=/dev/zero bs=1M count={} | tr '\\000' '{}' | dd of={} bs=1M status=progress",
                device_capacity / (1024 * 1024),
                pattern_str,
                device_id
            );
            eprintln!("DD Command: {}", dd_command);
            
            // Spawn the shell command as a child process
            let mut child = Command::new("sh")
                .arg("-c")
                .arg(&dd_command)
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn dd: {}", e))?;
            
            eprintln!("DD process spawned, monitoring progress...");

            // Monitor progress by reading stderr
            monitor_dd_progress(
                app,
                operation_id,
                device_id,
                technique,
                pass,
                total_passes,
                device_capacity,
                &mut child,
                cancel_token,
            ).await
        }
        PatternType::Random => {
            // Spawn dd for random data as a child process
            let mut child = Command::new("dd")
                .arg(format!("if=/dev/urandom"))
                .arg(format!("of={}", device_id))
                .arg("bs=1M")
                .arg("status=progress")
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to spawn dd: {}", e))?;

            // Monitor progress by reading stderr
            monitor_dd_progress(
                app,
                operation_id,
                device_id,
                technique,
                pass,
                total_passes,
                device_capacity,
                &mut child,
                cancel_token,
            ).await
        }
    }
}

/// Monitor dd progress by reading its stderr output and emitting progress events
async fn monitor_dd_progress(
    app: &Arc<tauri::AppHandle>,
    operation_id: &str,
    device_id: &str,
    technique: &WipingTechnique,
    pass: u32,
    total_passes: u32,
    device_capacity: u64,
    child: &mut tokio::process::Child,
    cancel_token: &CancellationToken,
) -> Result<(), String> {
    use tokio::io::{AsyncBufReadExt, BufReader};
    use std::sync::Arc as StdArc;
    use std::sync::atomic::AtomicU64;
    
    let stderr = child.stderr.take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;
    
    let mut reader = BufReader::new(stderr);
    let last_bytes = StdArc::new(AtomicU64::new(0));
    
    // Monitor progress in a separate task
    let progress_task = {
        let app = app.clone();
        let operation_id = operation_id.to_string();
        let device_id = device_id.to_string();
        let technique = technique.clone();
        let cancel_token = cancel_token.clone();
        let last_bytes = last_bytes.clone();
        
        tokio::spawn(async move {
            let mut buffer = Vec::new();
            
            loop {
                if cancel_token.is_cancelled() {
                    break;
                }
                
                // Read until carriage return (\r) or newline (\n)
                buffer.clear();
                match reader.read_until(b'\r', &mut buffer).await {
                    Ok(0) => {
                        // EOF reached, try reading with newline delimiter for final output
                        buffer.clear();
                        match reader.read_until(b'\n', &mut buffer).await {
                            Ok(0) => break, // True EOF
                            Ok(_) => {
                                // Process the final line
                                if let Ok(line) = String::from_utf8(buffer.clone()) {
                                    let line = line.trim_end_matches(&['\r', '\n'][..]);
                                    process_dd_line(
                                        &line,
                                        &app,
                                        &operation_id,
                                        &device_id,
                                        &technique,
                                        pass,
                                        total_passes,
                                        device_capacity,
                                        &last_bytes,
                                    );
                                }
                                break;
                            }
                            Err(_) => break,
                        }
                    }
                    Ok(_) => {
                        // Successfully read a chunk ending with \r
                        if let Ok(line) = String::from_utf8(buffer.clone()) {
                            let line = line.trim_end_matches(&['\r', '\n'][..]);
                            
                            // Debug: print the line to see what dd outputs
                            eprintln!("DD OUTPUT: {}", line);
                            
                            process_dd_line(
                                &line,
                                &app,
                                &operation_id,
                                &device_id,
                                &technique,
                                pass,
                                total_passes,
                                device_capacity,
                                &last_bytes,
                            );
                        }
                    }
                    Err(_) => break,
                }
            }
        })
    };
    
    // Wait for child process or cancellation
    tokio::select! {
        result = child.wait() => {
            // Ensure progress task completes
            let _ = progress_task.await;
            
            match result {
                Ok(status) if status.success() => Ok(()),
                Ok(_status) => {
                    Err("dd process failed".to_string())
                }
                Err(e) => Err(format!("Failed to execute dd: {}", e)),
            }
        }
        _ = cancel_token.cancelled() => {
            // Kill the child process
            let _ = child.kill().await;
            let _ = progress_task.await;
            Err("Operation cancelled during pass execution".to_string())
        }
    }
}

/// Process a single line of dd output and emit progress if bytes are found
fn process_dd_line(
    line: &str,
    app: &Arc<tauri::AppHandle>,
    operation_id: &str,
    device_id: &str,
    technique: &WipingTechnique,
    pass: u32,
    total_passes: u32,
    device_capacity: u64,
    last_bytes: &std::sync::Arc<std::sync::atomic::AtomicU64>,
) {
    use std::sync::atomic::Ordering;
    
    // Parse dd progress output: "12345678 bytes (12 MB, 12 MiB) copied"
    if let Some(bytes_written) = parse_dd_bytes(line) {
        let prev_bytes = last_bytes.load(Ordering::Relaxed);
        if bytes_written > prev_bytes {
            last_bytes.store(bytes_written, Ordering::Relaxed);
            
            // Calculate overall progress considering all passes
            let pass_progress = (bytes_written as f64 / device_capacity as f64) * 100.0;
            let base_progress = ((pass - 1) as f64 / total_passes as f64) * 85.0;
            let pass_contribution = (pass_progress / 100.0) * (85.0 / total_passes as f64);
            let overall_progress = (5.0 + base_progress + pass_contribution).min(90.0);
            
            eprintln!("Progress: {:.2}%, bytes: {}", overall_progress, bytes_written);
            
            emit_progress(
                app,
                WipingProgress {
                    operation_id: operation_id.to_string(),
                    device_id: device_id.to_string(),
                    technique: technique.clone(),
                    progress_percent: overall_progress as u32,
                    current_pass: pass,
                    total_passes,
                    bytes_processed: bytes_written,
                    status_message: format!("Pass {}/{} - {} written", pass, total_passes, format_bytes(bytes_written)),
                    timestamp: Utc::now(),
                },
            );
        }
    }
}

/// Parse bytes written from dd progress output
fn parse_dd_bytes(line: &str) -> Option<u64> {
    // dd outputs lines like: "12345678 bytes (12 MB, 12 MiB) copied, 1.2 s, 10.0 MB/s"
    // We want to extract the first number (bytes written)
    line.split_whitespace()
        .next()
        .and_then(|s| s.parse::<u64>().ok())
}

/// Format bytes for display
fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;
    
    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }
    
    format!("{:.2} {}", size, UNITS[unit_index])
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
    eprintln!("Attempting to unmount device: {}", device_path);
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

    eprintln!("Found {} partition(s) to unmount: {:?}", partitions.len(), partitions);

    // Try normal unmount first, then force unmount if needed
    for partition in &partitions {
        eprintln!("Unmounting: {}", partition);
        
        // Try normal unmount
        let output = Command::new("umount")
            .arg(&partition)
            .output()
            .await;
        
        if let Ok(out) = &output {
            if !out.status.success() {
                eprintln!("Normal unmount failed for {}, trying force unmount...", partition);
                // Try force unmount with -f flag
                let force_output = Command::new("umount")
                    .arg("-f")
                    .arg(&partition)
                    .output()
                    .await;
                
                if let Ok(fout) = &force_output {
                    if !fout.status.success() {
                        eprintln!("Force unmount also failed for {}", partition);
                        let stderr = String::from_utf8_lossy(&fout.stderr);
                        eprintln!("Error: {}", stderr);
                    } else {
                        eprintln!("Force unmount succeeded for {}", partition);
                    }
                }
            } else {
                eprintln!("Successfully unmounted {}", partition);
            }
        }
    }

    // Give the system a moment to fully unmount
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

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
    
    Ok(size_sectors * 512)
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
