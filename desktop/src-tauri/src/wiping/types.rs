use serde::{Deserialize, Serialize, Serializer, Deserializer};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, PartialEq)]
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
    
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "ATA Secure Erase" => Some(WipingTechnique::AtaSecureErase),
            "Crypto Erase" => Some(WipingTechnique::CryptoErase),
            "DoD 3-Pass" => Some(WipingTechnique::MultipassDoD3),
            "DoD 7-Pass" => Some(WipingTechnique::MultipassDoD7),
            "Gutmann 35-Pass" => Some(WipingTechnique::MultipassGutmann),
            "Block Erase" => Some(WipingTechnique::BlockErase),
            _ => None,
        }
    }
}

impl Serialize for WipingTechnique {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for WipingTechnique {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Self::from_str(&s)
            .ok_or_else(|| serde::de::Error::custom(format!("Unknown technique: {}", s)))
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum WipingResult {
    Success,
    Failed,
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
