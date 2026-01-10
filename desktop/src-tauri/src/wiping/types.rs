use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WipingTechnique {
    AtaSecureErase,
    CryptoErase,
    MultipassDoD3,
    MultipassDoD7,
    MultipassGutmann,
    BlockErase,
}

impl WipingTechnique {
    pub fn as_str(&self) -> &'static str {
        match self {
            WipingTechnique::AtaSecureErase => "ATA Secure Erase",
            WipingTechnique::CryptoErase => "Crypto Erase",
            WipingTechnique::MultipassDoD3 => "DoD 3-Pass",
            WipingTechnique::MultipassDoD7 => "DoD 7-Pass",
            WipingTechnique::MultipassGutmann => "Gutmann 35-Pass",
            WipingTechnique::BlockErase => "Block Erase",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub model: String,
    pub serial_number: String,
    pub capacity_bytes: u64,
    pub device_type: String, // "SSD", "HDD", "NVMe"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WipingProgress {
    pub operation_id: String,
    pub device_id: String,
    pub technique: WipingTechnique,
    pub progress_percent: u32,
    pub current_pass: u32,
    pub total_passes: u32,
    pub bytes_processed: u64,
    pub status_message: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WipingResult {
    Success,
    Failed(String),
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WipingStatus {
    pub operation_id: String,
    pub device_id: String,
    pub technique: WipingTechnique,
    pub result: WipingResult,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub error_message: Option<String>,
    pub verification_hash: Option<String>,
}
