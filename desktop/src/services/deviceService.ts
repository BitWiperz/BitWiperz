import { invoke } from "@tauri-apps/api/core";
import { Device } from "../types/device";

export async function getDevices(): Promise<Device[]> {
  try {
    const devices = await invoke<Device[]>("get_devices");
    return devices || [];
  } catch (error) {
    console.error("Failed to fetch devices:", error);
    return [];
  }
}
