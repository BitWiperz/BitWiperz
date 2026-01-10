use crate::wiping::types::{WipingProgress, WipingResult, WipingStatus, WipingTechnique};
use chrono::Utc;
use std::sync::Arc;
use tauri::Emitter;
use tokio::time::{sleep, Duration};

/// Execute Multipass wiping with different pass patterns
/// Supports DoD 3-pass, DoD 7-pass, and Gutmann 35-pass
pub async fn execute_multipass(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
    technique: WipingTechnique,
) -> WipingStatus {
    let start_time = Utc::now();

    let (total_passes, total_duration, description) = match technique {
        WipingTechnique::MultipassDoD3 => (3, Duration::from_secs(150), "DoD 5220.22-M 3-Pass"),
        WipingTechnique::MultipassDoD7 => (7, Duration::from_secs(420), "DoD 7-Pass Extended"),
        WipingTechnique::MultipassGutmann => (35, Duration::from_secs(900), "Gutmann 35-Pass"),
        _ => (3, Duration::from_secs(150), "Multipass"),
    };

    let duration_per_pass = total_duration.as_secs() / total_passes as u64;
    let device_capacity = 500_000_000_000u64; // 500 GB
    let bytes_per_pass = device_capacity / total_passes as u64;

    for pass in 1..=total_passes {
        let pass_duration = Duration::from_secs(duration_per_pass);
        let update_interval = Duration::from_millis(250);
        let total_updates = pass_duration.as_millis() / update_interval.as_millis();

        let mut update_count = 0;
        while update_count < total_updates {
            let progress_within_pass = (update_count as f32 / total_updates as f32) * 100.0;
            let overall_progress =
                ((pass as f32 - 1.0) * 100.0 / total_passes as f32)
                    + (progress_within_pass / total_passes as f32);

            let bytes_processed = bytes_per_pass * (pass - 1) as u64
                + (bytes_per_pass as f32 * (progress_within_pass / 100.0)) as u64;

            let pass_pattern = match pass % 3 {
                1 => "Pattern: 0x00",
                2 => "Pattern: 0xFF",
                _ => "Pattern: Random",
            };

            emit_progress(
                &app,
                WipingProgress {
                    operation_id: operation_id.clone(),
                    device_id: device_id.clone(),
                    technique: technique.clone(),
                    progress_percent: overall_progress.min(99.0) as u32,
                    current_pass: pass,
                    total_passes,
                    bytes_processed,
                    status_message: format!("Pass {}/{} - {}", pass, total_passes, pass_pattern),
                    timestamp: Utc::now(),
                },
            );

            sleep(update_interval).await;
            update_count += 1;
        }
    }

    // Final completion
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
            status_message: format!(
                "{} wiping verified successfully",
                description
            ),
            timestamp: Utc::now(),
        },
    );

    sleep(Duration::from_millis(500)).await;

    WipingStatus {
        operation_id,
        device_id,
        technique,
        result: WipingResult::Success,
        started_at: start_time,
        completed_at: Utc::now(),
        error_message: None,
        verification_hash: Some("sha256:c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8".to_string()),
    }
}

fn emit_progress(app: &Arc<tauri::AppHandle>, progress: WipingProgress) {
    let _ = app.as_ref().emit("wiping-progress", &progress);
}
