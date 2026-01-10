mod drive_detection;
mod wiping;
mod network;

use std::sync::Arc;
use wiping::types::{DeviceInfo, WipingTechnique};
use wiping::ORCHESTRATOR;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn list_devices() -> Vec<DeviceInfo> {
    wiping::device::list_devices()
}

#[tauri::command]
async fn start_wiping(
    app: tauri::AppHandle,
    device_ids: Vec<String>,
    technique: String,
) -> Result<String, String> {
    let technique = match technique.as_str() {
        "ATA Secure Erase" => WipingTechnique::AtaSecureErase,
        "Crypto Erase" => WipingTechnique::CryptoErase,
        "DoD 3-Pass" => WipingTechnique::MultipassDoD3,
        "DoD 7-Pass" => WipingTechnique::MultipassDoD7,
        "Gutmann 35-Pass" => WipingTechnique::MultipassGutmann,
        "Block Erase" => WipingTechnique::BlockErase,
        _ => return Err("Unknown wiping technique".to_string()),
    };

    let operation_id = ORCHESTRATOR
        .start_wipe(Arc::new(app), device_ids, technique)
        .await;

    Ok(operation_id)
}

#[tauri::command]
async fn cancel_wiping(operation_id: String) -> Result<(), String> {
    ORCHESTRATOR.cancel_wipe(&operation_id).await;
    Ok(())
}

#[tauri::command]
async fn get_wiping_status(operation_id: String) -> Result<bool, String> {
    Ok(ORCHESTRATOR.get_status(&operation_id).await)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_devices,
            start_wiping,
            cancel_wiping,
            get_wiping_status,
            drive_detection::detect_drives,
            drive_detection::get_device_partitions,
            network::list_wifi_networks,
            network::connect_wifi,
            network::get_network_status,
            network::test_internet_connectivity,
            network::disconnect_network
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
