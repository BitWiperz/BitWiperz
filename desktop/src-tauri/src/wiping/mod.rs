pub mod ata_erase;
pub mod block_erase;
pub mod crypto_erase;
pub mod device;
pub mod multipass;
pub mod types;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;
use once_cell::sync::Lazy;
use tauri::Emitter;

use crate::wiping::types::{WipingStatus, WipingTechnique};

/// Orchestrator for managing disk wiping operations
pub struct WipingOrchestrator {
    /// Keyed by operation_id, stores handles and cancellation tokens
    active_operations: Arc<RwLock<HashMap<String, (Vec<tokio::task::JoinHandle<WipingStatus>>, CancellationToken)>>>,
}

impl WipingOrchestrator {
    pub fn new() -> Self {
        WipingOrchestrator {
            active_operations: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Start wiping operation for one or more devices
    pub async fn start_wipe(
        &self,
        app: Arc<tauri::AppHandle>,
        device_ids: Vec<String>,
        technique: WipingTechnique,
    ) -> String {
        let operation_id = Uuid::new_v4().to_string();
        eprintln!("=== ORCHESTRATOR START_WIPE ===");
        eprintln!("Operation ID: {}", operation_id);
        eprintln!("Device IDs: {:?}", device_ids);
        eprintln!("Technique: {:?}", technique);
        
        let active_ops = self.active_operations.clone();
        let cancel_token = CancellationToken::new();
        let mut handles = Vec::new();

        for device_id in device_ids {
            eprintln!("Spawning task for device: {}", device_id);
            let op_id = operation_id.clone();
            let dev_id = device_id.clone();
            let tech = technique.clone();
            let app_clone = app.clone();
            let active_ops_clone = active_ops.clone();
            let token = cancel_token.clone();

            let handle = tokio::spawn(async move {
                eprintln!("Task started for device: {}", dev_id);
                let status = execute_wipe_for_device(app_clone.clone(), op_id.clone(), dev_id.clone(), tech, token).await;
                eprintln!("Task completed for device: {}", dev_id);
                
                // Emit completion event
                let _ = app_clone.as_ref().emit("wiping-complete", &status);
                
                // Remove this operation from active operations
                let mut ops = active_ops_clone.write().await;
                if let Some((handles, _)) = ops.get_mut(&op_id) {
                    // Keep only handles that aren't finished
                    handles.retain(|h| !h.is_finished());
                    // If all handles are done, remove the operation entirely
                    if handles.is_empty() {
                        ops.remove(&op_id);
                    }
                }
                
                status
            });

            handles.push(handle);
        }

        let num_tasks = handles.len();
        active_ops
            .write()
            .await
            .insert(operation_id.clone(), (handles, cancel_token));

        eprintln!("Operation {} registered with {} task(s)", operation_id, num_tasks);
        operation_id
    }

    /// Cancel an ongoing wiping operation by operation_id
    pub async fn cancel_wipe(&self, operation_id: &str) {
        let mut ops = self.active_operations.write().await;
        if let Some((handles, cancel_token)) = ops.remove(operation_id) {
            // Trigger cancellation token
            cancel_token.cancel();
            
            // Abort all running tasks for this operation
            for handle in handles {
                handle.abort();
            }
        }
    }

    /// Get status of an active operation
    pub async fn get_status(&self, operation_id: &str) -> bool {
        self.active_operations
            .read()
            .await
            .contains_key(operation_id)
    }
}

impl Default for WipingOrchestrator {
    fn default() -> Self {
        Self::new()
    }
}

/// Singleton instance of WipingOrchestrator
pub static ORCHESTRATOR: Lazy<WipingOrchestrator> = Lazy::new(WipingOrchestrator::new);

async fn execute_wipe_for_device(
    app: Arc<tauri::AppHandle>,
    operation_id: String,
    device_id: String,
    technique: WipingTechnique,
    cancel_token: CancellationToken,
) -> WipingStatus {
    eprintln!("=== EXECUTE_WIPE_FOR_DEVICE ===");
    eprintln!("Operation ID: {}", operation_id);
    eprintln!("Device ID: {}", device_id);
    eprintln!("Technique: {:?}", technique);
    
    match technique {
        WipingTechnique::AtaSecureErase => {
            eprintln!("Calling ata_erase::execute_ata_erase");
            ata_erase::execute_ata_erase(app, operation_id, device_id, cancel_token).await
        }
        WipingTechnique::CryptoErase => {
            eprintln!("Calling crypto_erase::execute_crypto_erase");
            crypto_erase::execute_crypto_erase(app, operation_id, device_id, cancel_token).await
        }
        WipingTechnique::MultipassDoD3 => {
            eprintln!("Calling multipass::execute_multipass (DoD 3-Pass)");
            multipass::execute_multipass(
                app,
                operation_id,
                device_id,
                WipingTechnique::MultipassDoD3,
                cancel_token,
            )
            .await
        }
        WipingTechnique::MultipassDoD7 => {
            eprintln!("Calling multipass::execute_multipass (DoD 7-Pass)");
            multipass::execute_multipass(
                app,
                operation_id,
                device_id,
                WipingTechnique::MultipassDoD7,
                cancel_token,
            )
            .await
        }
        WipingTechnique::MultipassGutmann => {
            eprintln!("Calling multipass::execute_multipass (Gutmann)");
            multipass::execute_multipass(
                app,
                operation_id,
                device_id,
                WipingTechnique::MultipassGutmann,
                cancel_token,
            )
            .await
        }
        WipingTechnique::BlockErase => {
            block_erase::execute_block_erase(app, operation_id, device_id, cancel_token).await
        }
    }
}
