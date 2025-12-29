export interface OperatorInfo {
  id?: string;
  name: string;
  organization?: string;
}

export interface VerificationInfo {
  hash?: string;
  tool?: string;
  notes?: string;
}

export interface DeviceInfo {
  driveId: string;
  serialNumber?: string;
  model?: string;
  capacityBytes?: number;
  firmwareVersion?: string;
  location?: string;
}

export interface ErasureMetadata extends DeviceInfo {
  erasureMethod: string;
  startedAt: string;
  completedAt: string;
  operator: OperatorInfo;
  verification?: VerificationInfo;
  notes?: string;
}

export interface Certificate extends ErasureMetadata {
  certificateId: string;
  certificateNumber: string;
  issuedAt: string;
  signature: string;
}
