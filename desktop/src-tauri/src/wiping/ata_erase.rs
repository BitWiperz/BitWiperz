use crate::wiping::types::{WipingProgress, WipingResult, WipingStatus};
use chrono::Utc;
use std::sync::Arc;
use tauri::Emitter;
use tokio::time::{sleep, Duration};

/// Execute ATA Secure Erase command simulation
/// Simulates ATA SECURITY ERASE UNIT command with realistic timing
pub async fn execute_ata_erase(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
) -> WipingStatus {
    let start_time = Utc::now();
    let technique = crate::wiping::types::WipingTechnique::AtaSecureErase;

    // Simulate total duration: 30-60 seconds
    let total_duration = Duration::from_secs(45);
    let update_interval = Duration::from_millis(500);
    let _total_updates = total_duration.as_millis() / update_interval.as_millis();

    // Phase 1: Prepare device (10%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 10,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 50_000_000_000,
            status_message: "Preparing device...".to_string(),
            timestamp: Utc::now(),
        },
    );
    sleep(Duration::from_secs(5)).await;

    // Phase 2: Issue erase command (50%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 50,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 250_000_000_000,
            status_message: "Issuing ATA SECURITY ERASE UNIT command...".to_string(),
            timestamp: Utc::now(),
        },
    );
    sleep(Duration::from_secs(20)).await;

    // Phase 3: Waiting for completion (90%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 90,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 450_000_000_000,
            status_message: "Waiting for erasure to complete...".to_string(),
            timestamp: Utc::now(),
        },
    );
    sleep(Duration::from_secs(15)).await;

    // Phase 4: Verify (100%)
    emit_progress(
        &app,
        WipingProgress {
            operation_id: operation_id.clone(),
            device_id: device_id.clone(),
            technique: technique.clone(),
            progress_percent: 100,
            current_pass: 1,
            total_passes: 1,
            bytes_processed: 500_000_000_000,
            status_message: "Erasure verified successfully".to_string(),
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
        verification_hash: Some("sha256:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6".to_string()),
    }
}

fn emit_progress(app: &Arc<tauri::AppHandle>, progress: WipingProgress) {
    let _ = app.as_ref().emit("wiping-progress", &progress);
}
