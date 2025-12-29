export interface DrivePartition {
  name: string;
  path?: string;
  sizeBytes?: number;
  uuid?: string | null;
  mountpoints?: string[];
}

export interface DriveInfo {
  name: string;
  path?: string;
  sizeBytes?: number;
  serial?: string | null;
  model?: string | null;
  vendor?: string | null;
  transport?: string | null;
  rotational?: boolean | null;
  firmware?: string | null;
  wwn?: string | null;
  state?: string | null;
  mountpoints?: string[];
  partitions?: DrivePartition[];
}
