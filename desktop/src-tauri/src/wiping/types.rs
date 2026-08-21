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
    // New techniques
    NvmeSecureErase,
    NvmeFormat,
    RandomSinglePass,
    ZeroFill,
}

/// Device type classification for compatibility checking
#[derive(Debug, Clone, PartialEq)]
pub enum DeviceType {
    Nvme,
    Sata,
    Hdd,
    Unknown,
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
            WipingTechnique::NvmeSecureErase => "NVMe Secure Erase",
            WipingTechnique::NvmeFormat => "NVMe Format",
            WipingTechnique::RandomSinglePass => "Random Single Pass",
            WipingTechnique::ZeroFill => "Zero Fill",
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
            "NVMe Secure Erase" => Some(WipingTechnique::NvmeSecureErase),
            "NVMe Format" => Some(WipingTechnique::NvmeFormat),
            "Random Single Pass" => Some(WipingTechnique::RandomSinglePass),
            "Zero Fill" => Some(WipingTechnique::ZeroFill),
            _ => None,
        }
    }

    /// Check if this technique is compatible with the given device type
    pub fn is_compatible_with(&self, device_type: &DeviceType) -> bool {
        match self {
            // NVMe-only techniques
            WipingTechnique::NvmeSecureErase | WipingTechnique::NvmeFormat => {
                matches!(device_type, DeviceType::Nvme)
            }
            // ATA-only techniques (SATA drives)
            WipingTechnique::AtaSecureErase => {
                matches!(device_type, DeviceType::Sata)
            }
            // Block erase requires discard support (SSDs, NVMe)
            WipingTechnique::BlockErase => {
                matches!(device_type, DeviceType::Nvme | DeviceType::Sata)
            }
            // Crypto erase works on NVMe and self-encrypting SATA drives
            WipingTechnique::CryptoErase => {
                matches!(device_type, DeviceType::Nvme | DeviceType::Sata)
            }
            // Software-based techniques work on all devices
            WipingTechnique::MultipassDoD3
            | WipingTechnique::MultipassDoD7
            | WipingTechnique::MultipassGutmann
            | WipingTechnique::RandomSinglePass
            | WipingTechnique::ZeroFill => true,
        }
    }

    /// Get a human-readable error message for incompatible technique/device combinations
    pub fn incompatibility_reason(&self, device_type: &DeviceType) -> Option<String> {
        if self.is_compatible_with(device_type) {
            return None;
        }

        let reason = match self {
            WipingTechnique::NvmeSecureErase => {
                "NVMe Secure Erase requires an NVMe device. This device is not NVMe."
            }
            WipingTechnique::NvmeFormat => {
                "NVMe Format requires an NVMe device. This device is not NVMe."
            }
            WipingTechnique::AtaSecureErase => {
                "ATA Secure Erase requires a SATA/ATA device. NVMe devices should use NVMe Secure Erase or NVMe Format instead."
            }
            WipingTechnique::BlockErase => {
                "Block Erase (TRIM/UNMAP) requires an SSD or NVMe device with discard support. Traditional HDDs do not support this method."
            }
            WipingTechnique::CryptoErase => {
                "Crypto Erase requires a self-encrypting drive (SED) or NVMe device with encryption support."
            }
            _ => "This technique is not compatible with the selected device.",
        };

        Some(reason.to_string())
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
