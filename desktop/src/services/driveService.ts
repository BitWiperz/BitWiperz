import { invoke } from '@tauri-apps/api/core';

export interface DriveInfo {
  device_path: string;
  mount_point: string | null;
  size_bytes: number;
  model: string;
  vendor: string;
  is_removable: boolean;
  is_mounted: boolean;
}

export const driveService = {
  /**
   * Detect external/USB drives connected to the Linux system
   * @returns Array of detected external drives
   */
  async detectDrives(includeInternal: boolean = false): Promise<DriveInfo[]> {
    try {
      console.log('[drives] Detecting drives...', { includeInternal });
      const drives = await invoke<DriveInfo[]>('detect_drives', {
        includeInternal,
      });
      console.log(`[drives] Found ${drives.length} drive(s)`);
      return drives;
    } catch (error) {
      console.error('[drives] Error detecting drives:', error);
      throw new Error(`Failed to detect drives: ${error}`);
    }
  },

  /**
   * Get partitions for a specific device
   * @param devicePath - The device path (e.g., /dev/sdb)
   * @returns Array of partition paths
   */
  async getDevicePartitions(devicePath: string): Promise<string[]> {
    try {
      console.log(`[drives] Getting partitions for ${devicePath}...`);
      const partitions = await invoke<string[]>('get_device_partitions', {
        devicePath,
      });
      console.log(`[drives] Found ${partitions.length} partition(s)`);
      return partitions;
    } catch (error) {
      console.error(`[drives] Error getting partitions for ${devicePath}:`, error);
      throw new Error(`Failed to get partitions: ${error}`);
    }
  },

  /**
   * Format drive size to human-readable format
   */
  formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  },

  /**
   * Get a friendly display name for a drive
   */
  getDriveName(drive: DriveInfo): string {
    const vendor = drive.vendor.trim() || 'Unknown';
    const model = drive.model.trim() || 'Device';
    return `${vendor} ${model}`.trim() || drive.device_path;
  },
};
