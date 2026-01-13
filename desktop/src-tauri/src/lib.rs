mod drive_detection;
mod wiping;
mod network;

use std::sync::Arc;
use std::fs::File;
use std::io::Write;
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
    eprintln!("=== START_WIPING COMMAND CALLED ===");
    eprintln!("Device IDs: {:?}", device_ids);
    eprintln!("Technique: {}", technique);
    
    let technique = WipingTechnique::from_str(&technique)
        .ok_or_else(|| "Unknown wiping technique".to_string())?;

    eprintln!("Starting wipe with orchestrator...");
    let operation_id = ORCHESTRATOR
        .start_wipe(Arc::new(app), device_ids, technique)
        .await;

    eprintln!("Operation ID: {}", operation_id);
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

#[tauri::command]
fn write_temp_pdf(filename: String, data: Vec<u8>) -> Result<String, String> {
    // Get temp directory
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&filename);
    
    // Write PDF data to temp file
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    
    file.write_all(&data)
        .map_err(|e| format!("Failed to write PDF data: {}", e))?;
    
    // Return the full path as a string
    file_path.to_str()
        .ok_or_else(|| "Failed to convert path to string".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
async fn open_file_with_system(path: String) -> Result<(), String> {
    // Use xdg-open on Linux to open file with default application
    #[cfg(target_os = "linux")]
    {
        let status = std::process::Command::new("xdg-open")
            .arg(&path)
            .status()
            .map_err(|e| format!("Failed to open file: {}", e))?;
        
        if !status.success() {
            return Err("xdg-open failed to open file".to_string());
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(&["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }
    
    Ok(())
}

/// Validate that a wiping technique is compatible with a device
/// Returns Ok(()) if compatible, Err(reason) if not
#[tauri::command]
fn validate_technique(device_id: String, technique: String) -> Result<(), String> {
    let technique = WipingTechnique::from_str(&technique)
        .ok_or_else(|| format!("Unknown wiping technique: {}", technique))?;
    
    wiping::validate_technique_for_device(&technique, &device_id)
}

/// Get compatible wiping techniques for a device
#[tauri::command]
fn get_compatible_techniques(device_id: String) -> Vec<String> {
    use wiping::types::DeviceType;
    use wiping::device::get_device_type;
    
    let device_type = get_device_type(&device_id);
    
    let all_techniques = vec![
        WipingTechnique::AtaSecureErase,
        WipingTechnique::CryptoErase,
        WipingTechnique::MultipassDoD3,
        WipingTechnique::MultipassDoD7,
        WipingTechnique::MultipassGutmann,
        WipingTechnique::BlockErase,
        WipingTechnique::NvmeSecureErase,
        WipingTechnique::NvmeFormat,
        WipingTechnique::RandomSinglePass,
        WipingTechnique::ZeroFill,
    ];
    
    all_techniques
        .into_iter()
        .filter(|t| t.is_compatible_with(&device_type))
        .map(|t| t.as_str().to_string())
        .collect()
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
            validate_technique,
            get_compatible_techniques,
            write_temp_pdf,
            open_file_with_system,
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
