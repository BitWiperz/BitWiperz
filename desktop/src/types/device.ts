export interface Device {
  id: string;
  name: string;
  device_type: string;
  size_bytes: number;
  size_formatted: string;
  serial: string | null;
  mount_point: string | null;
  interface: string;
  is_removable: boolean;
}
