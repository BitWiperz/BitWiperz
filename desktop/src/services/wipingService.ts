import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export interface DeviceInfo {
  id: string;
  name: string;
  model: string;
  serial_number: string;
  capacity_bytes: number;
  device_type: string; // "SSD", "HDD", "NVMe"
}

export enum WipingTechnique {
  AtaSecureErase = "ATA Secure Erase",
  CryptoErase = "Crypto Erase",
  MultipassDoD3 = "DoD 3-Pass",
  MultipassDoD7 = "DoD 7-Pass",
  MultipassGutmann = "Gutmann 35-Pass",
  BlockErase = "Block Erase",
  // New techniques
  NvmeSecureErase = "NVMe Secure Erase",
  NvmeFormat = "NVMe Format",
  RandomSinglePass = "Random Single Pass",
  ZeroFill = "Zero Fill",
}

export interface WipingProgress {
  operation_id: string;
  device_id: string;
  technique: WipingTechnique;
  progress_percent: number;
  current_pass: number;
  total_passes: number;
  bytes_processed: number;
  status_message: string;
  timestamp: string;
}

export enum WipingResultType {
  Success = "Success",
  Failed = "Failed",
  Cancelled = "Cancelled",
}

export interface WipingStatus {
  operation_id: string;
  device_id: string;
  technique: WipingTechnique;
  result: WipingResultType;
  started_at: string;
  completed_at: string;
  error_message?: string;
  verification_hash?: string;
}

export interface ErasureMetadata {
  device_id: string;
  device_name: string;
  device_model: string;
  serial_number: string;
  capacity_bytes: number;
  technique: string;
  started_at: string;
  completed_at: string;
  verification_hash: string;
}

/**
 * List available storage devices
 */
export async function listDevices(): Promise<DeviceInfo[]> {
  try {
    const devices = await invoke<DeviceInfo[]>("list_devices");
    return devices;
  } catch (error) {
    console.error("Failed to list devices:", error);
    throw error;
  }
}

/**
 * Start wiping operation for one or more devices
 */
export async function startWiping(
  deviceIds: string[],
  technique: WipingTechnique
): Promise<string> {
  try {
    const operationId = await invoke<string>("start_wiping", {
      deviceIds,
      technique: technique,
    });
    return operationId;
  } catch (error) {
    console.error("Failed to start wiping:", error);
    throw error;
  }
}

/**
 * Cancel an ongoing wiping operation
 */
export async function cancelWiping(operationId: string): Promise<void> {
  try {
    await invoke<void>("cancel_wiping", { operationId });
  } catch (error) {
    console.error("Failed to cancel wiping:", error);
    throw error;
  }
}

/**
 * Get status of an active operation
 */
export async function getWipingStatus(operationId: string): Promise<boolean> {
  try {
    const isActive = await invoke<boolean>("get_wiping_status", { operationId });
    return isActive;
  } catch (error) {
    console.error("Failed to get wiping status:", error);
    throw error;
  }
}

/**
 * Subscribe to progress events
 * Returns unsubscribe function
 */
export async function subscribeToProgress(
  callback: (progress: WipingProgress) => void
): Promise<UnlistenFn> {
  const unlisten = await listen<WipingProgress>(
    "wiping-progress",
    (event) => {
      callback(event.payload);
    }
  );

  return unlisten;
}

/**
 * Subscribe to completion status events
 * Returns unsubscribe function
 */
export async function subscribeToStatus(
  callback: (status: WipingStatus) => void
): Promise<UnlistenFn> {
  const unlisten = await listen<WipingStatus>(
    "wiping-complete",
    (event) => {
      callback(event.payload);
    }
  );

  return unlisten;
}

/**
 * Convert WipingTechnique enum to string
 */
export function techniqueToString(technique: WipingTechnique): string {
  return technique.toString();
}

/**
 * Convert string to WipingTechnique enum
 */
export function stringToTechnique(value: string): WipingTechnique {
  switch (value) {
    case "ata-secure-erase":
      return WipingTechnique.AtaSecureErase;
    case "crypto-erase":
      return WipingTechnique.CryptoErase;
    case "dod-3-pass":
      return WipingTechnique.MultipassDoD3;
    case "dod-7-pass":
      return WipingTechnique.MultipassDoD7;
    case "gutmann-35-pass":
      return WipingTechnique.MultipassGutmann;
    case "block-erase":
      return WipingTechnique.BlockErase;
    case "nvme-secure-erase":
      return WipingTechnique.NvmeSecureErase;
    case "nvme-format":
      return WipingTechnique.NvmeFormat;
    case "random-single-pass":
      return WipingTechnique.RandomSinglePass;
    case "zero-fill":
      return WipingTechnique.ZeroFill;
    default:
      return WipingTechnique.MultipassDoD3;
  }
}

/**
 * Validate that a technique is compatible with a device
 * Returns null if compatible, error message if not
 */
export async function validateTechnique(
  deviceId: string,
  technique: WipingTechnique
): Promise<string | null> {
  try {
    await invoke<void>("validate_technique", {
      deviceId,
      technique: technique.toString(),
    });
    return null;
  } catch (error) {
    return error as string;
  }
}

/**
 * Get list of compatible techniques for a device
 */
export async function getCompatibleTechniques(
  deviceId: string
): Promise<WipingTechnique[]> {
  try {
    const techniques = await invoke<string[]>("get_compatible_techniques", {
      deviceId,
    });
    return techniques
      .map((t) => {
        // Convert technique string to enum
        switch (t) {
          case "ATA Secure Erase":
            return WipingTechnique.AtaSecureErase;
          case "Crypto Erase":
            return WipingTechnique.CryptoErase;
          case "DoD 3-Pass":
            return WipingTechnique.MultipassDoD3;
          case "DoD 7-Pass":
            return WipingTechnique.MultipassDoD7;
          case "Gutmann 35-Pass":
            return WipingTechnique.MultipassGutmann;
          case "Block Erase":
            return WipingTechnique.BlockErase;
          case "NVMe Secure Erase":
            return WipingTechnique.NvmeSecureErase;
          case "NVMe Format":
            return WipingTechnique.NvmeFormat;
          case "Random Single Pass":
            return WipingTechnique.RandomSinglePass;
          case "Zero Fill":
            return WipingTechnique.ZeroFill;
          default:
            return null;
        }
      })
      .filter((t): t is WipingTechnique => t !== null);
  } catch (error) {
    console.error("Failed to get compatible techniques:", error);
    // Return all techniques if we can't determine compatibility
    return Object.values(WipingTechnique);
  }
}
