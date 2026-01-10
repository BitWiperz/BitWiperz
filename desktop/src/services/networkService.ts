import { invoke } from "@tauri-apps/api/core";

export interface WifiNetwork {
  ssid: string;
  signal_strength: number;
  security: string;
  in_use: boolean;
}

export interface NetworkStatus {
  connected: boolean;
  connection_type: string; // "wifi", "ethernet", "none"
  ssid?: string;
  ip_address?: string;
  interface?: string;
}

export async function listWifiNetworks(): Promise<WifiNetwork[]> {
  try {
    const networks = await invoke<WifiNetwork[]>("list_wifi_networks");
    return networks;
  } catch (error) {
    console.error("Error listing WiFi networks:", error);
    throw error;
  }
}

export async function connectWifi(
  ssid: string,
  password?: string
): Promise<string> {
  try {
    const result = await invoke<string>("connect_wifi", { ssid, password });
    return result;
  } catch (error) {
    console.error("Error connecting to WiFi:", error);
    throw error;
  }
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  try {
    const status = await invoke<NetworkStatus>("get_network_status");
    return status;
  } catch (error) {
    console.error("Error getting network status:", error);
    throw error;
  }
}

export async function testInternetConnectivity(): Promise<boolean> {
  try {
    const result = await invoke<boolean>("test_internet_connectivity");
    return result;
  } catch (error) {
    console.error("Error testing internet connectivity:", error);
    return false;
  }
}

export async function disconnectNetwork(): Promise<string> {
  try {
    const result = await invoke<string>("disconnect_network");
    return result;
  } catch (error) {
    console.error("Error disconnecting network:", error);
    throw error;
  }
}
