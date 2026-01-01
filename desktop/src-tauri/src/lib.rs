mod drive_detection;

use drive_detection::{detect_external_drives, get_partitions, DriveInfo};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Detect external/USB drives connected to the Linux system
#[tauri::command]
#[cfg(target_os = "linux")]
fn detect_drives(include_internal: Option<bool>) -> Result<Vec<DriveInfo>, String> {
    let include_internal = include_internal.unwrap_or(false);
    detect_external_drives(include_internal)
}

/// Get partitions for a specific device
#[tauri::command]
#[cfg(target_os = "linux")]
fn get_device_partitions(device_path: String) -> Result<Vec<String>, String> {
    get_partitions(&device_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            #[cfg(target_os = "linux")]
            detect_drives,
            #[cfg(target_os = "linux")]
            get_device_partitions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
