pub mod ata_erase;
pub mod block_erase;
pub mod crypto_erase;
pub mod device;
pub mod multipass;
pub mod types;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use once_cell::sync::Lazy;

use crate::wiping::types::{WipingStatus, WipingTechnique};

/// Orchestrator for managing disk wiping operations
pub struct WipingOrchestrator {
    /// Keyed by operation_id, stores handles for all devices in that operation
    active_operations: Arc<RwLock<HashMap<String, Vec<tokio::task::JoinHandle<WipingStatus>>>>>,
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
        let active_ops = self.active_operations.clone();
        let mut handles = Vec::new();

        for device_id in device_ids {
            let op_id = operation_id.clone();
            let dev_id = device_id.clone();
            let tech = technique.clone();
            let app_clone = app.clone();

            let handle = tokio::spawn(async move {
                execute_wipe_for_device(app_clone, op_id, dev_id, tech).await
            });

            handles.push(handle);
        }

        active_ops
            .write()
            .await
            .insert(operation_id.clone(), handles);

        operation_id
    }

    /// Cancel an ongoing wiping operation by operation_id
    pub async fn cancel_wipe(&self, operation_id: &str) {
        let mut ops = self.active_operations.write().await;
        if let Some(handles) = ops.remove(operation_id) {
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
) -> WipingStatus {
    match technique {
        WipingTechnique::AtaSecureErase => {
            ata_erase::execute_ata_erase(app, operation_id, device_id).await
        }
        WipingTechnique::CryptoErase => {
            crypto_erase::execute_crypto_erase(app, operation_id, device_id).await
        }
        WipingTechnique::MultipassDoD3 => {
            multipass::execute_multipass(
                app,
                operation_id,
                device_id,
                WipingTechnique::MultipassDoD3,
            )
            .await
        }
        WipingTechnique::MultipassDoD7 => {
            multipass::execute_multipass(
                app,
                operation_id,
                device_id,
                WipingTechnique::MultipassDoD7,
            )
            .await
        }
        WipingTechnique::MultipassGutmann => {
            multipass::execute_multipass(
                app,
                operation_id,
                device_id,
                WipingTechnique::MultipassGutmann,
            )
            .await
        }
        WipingTechnique::BlockErase => {
            block_erase::execute_block_erase(app, operation_id, device_id).await
        }
    }
}
