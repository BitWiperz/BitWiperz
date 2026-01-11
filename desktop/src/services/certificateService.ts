import { authService } from './authService';
import { invoke } from '@tauri-apps/api/core';

// Feature flag: set via Vite env to surface mock data without backend
const parseBool = (v: unknown): boolean => {
  const s = String(v ?? '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
};
export const USE_MOCK_DATA = parseBool((import.meta as any).env?.VITE_USE_MOCK_CERTS);

export interface OperatorInfo {
  id?: string;
  name: string;
  organization?: string;
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
  startedAt: string; // ISO
  completedAt: string; // ISO
  operator: OperatorInfo;
  verification?: {
    hash?: string;
    tool?: string;
    notes?: string;
  };
  notes?: string;
}

export interface Certificate extends ErasureMetadata {
  certificateId: string;
  certificateNumber: string;
  issuedAt: string; // ISO
  signature?: string;
}

// Mock reports for quick UI testing
export const MOCK_REPORTS: Certificate[] = [
  {
    certificateId: '11111111-1111-1111-1111-111111111111',
    certificateNumber: 'CERT-20250130120000-ABC123',
    issuedAt: new Date().toISOString(),
    driveId: '/dev/disk1',
    erasureMethod: 'DoD 5220.22-M',
    startedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    completedAt: new Date().toISOString(),
    operator: { name: 'Alice Johnson', organization: 'BitWiperz' },
    model: 'Samsung 870 EVO',
    serialNumber: 'SN123456',
    capacityBytes: 500_107_862_016,
    firmwareVersion: '3B7Q',
    location: 'Lab A',
  },
  {
    certificateId: '22222222-2222-2222-2222-222222222222',
    certificateNumber: 'CERT-20250130123000-XYZ789',
    issuedAt: new Date().toISOString(),
    driveId: '/dev/disk2',
    erasureMethod: 'NIST 800-88',
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    operator: { name: 'Bob Lee', organization: 'BitWiperz' },
    model: 'WD Blue',
    serialNumber: 'WD-987654',
    capacityBytes: 1_000_204_886_016,
    firmwareVersion: '1.2.0',
    location: 'Lab B',
  },
  {
    certificateId: '33333333-3333-3333-3333-333333333333',
    certificateNumber: 'CERT-20250130130000-DEF456',
    issuedAt: new Date().toISOString(),
    driveId: '/dev/disk3',
    erasureMethod: 'NIST 800-88',
    startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    operator: { name: 'Chris Park', organization: 'BitWiperz' },
    model: 'Crucial MX500',
    serialNumber: 'CR-555666',
    capacityBytes: 250_059_350_016,
    firmwareVersion: 'M3CR033',
    location: 'Lab C',
  },
];

export const getMockReports = (): Certificate[] => MOCK_REPORTS;

export async function createCertificate(metadata: ErasureMetadata): Promise<Certificate> {
  if (USE_MOCK_DATA) {
    // Simulate creation by returning a mock augmented object
    const now = new Date().toISOString();
    const mock: Certificate = {
      ...metadata,
      certificateId: cryptoRandomId(),
      certificateNumber: `CERT-${now.replace(/[-:TZ.]/g, '').slice(0, 14)}-MOCK01`,
      issuedAt: now,
    };
    return mock;
  }
  const res = await authService.apiFetch('/certificates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  }, true);
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || 'Failed to create certificate');
  }
  const data = await res.json();
  return data.certificate ?? data;
}

export async function listCertificates(limit = 50, offset = 0): Promise<Certificate[]> {
  if (USE_MOCK_DATA) {
    return getMockReports();
  }
  const res = await authService.apiFetch(`/certificates?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`, { method: 'GET' }, true);
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || 'Failed to list certificates');
  }
  const data = await res.json();
  return data.certificates ?? [];
}

export async function getCertificate(certificateId: string): Promise<Certificate> {
  if (USE_MOCK_DATA) {
    const found = MOCK_REPORTS.find((r) => r.certificateId === certificateId);
    if (!found) throw new Error('Certificate not found (mock)');
    return found;
  }
  const res = await authService.apiFetch(`/certificates/${certificateId}`, { method: 'GET' }, true);
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error || 'Failed to fetch certificate');
  }
  const data = await res.json();
  return data.certificate ?? data;
}

export async function downloadCertificatePdf(certificateId: string): Promise<void> {
  if (USE_MOCK_DATA) {
    const content = `%PDF-1.4\n% Mock PDF for certificate ${certificateId}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`;
    const blob = new Blob([content], { type: 'application/pdf' });
    triggerDownload(blob, `certificate-${certificateId}.pdf`);
    return;
  }
  const res = await authService.apiFetch(`/certificates/${certificateId}/pdf`, { method: 'GET' }, true);
  if (!res.ok) {
    const errText = await res.text();
    try {
      const err = JSON.parse(errText);
      throw new Error(err?.error || 'Failed to download certificate');
    } catch {
      throw new Error('Failed to download certificate');
    }
  }
  const blob = await res.blob();
  triggerDownload(blob, `certificate-${certificateId}.pdf`);
}

// Convenience: issue certificate from metadata, then download its PDF
export async function issueAndDownloadCertificate(metadata: ErasureMetadata): Promise<void> {
  const cert = await createCertificate(metadata);
  await downloadCertificatePdf(cert.certificateId);
}

// Preview certificate PDF in a new window/external viewer for Tauri desktop
export async function previewCertificatePdf(certificateId: string): Promise<void> {
  if (USE_MOCK_DATA) {
    const content = `%PDF-1.4\n% Mock PDF for certificate ${certificateId}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF`;
    const blob = new Blob([content], { type: 'application/pdf' });
    
    // For Tauri, write to temp file and open with system viewer
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const tempPath = await invoke<string>('write_temp_pdf', {
        filename: `certificate-${certificateId}.pdf`,
        data: Array.from(uint8Array),
      });
      await invoke('open_file_with_system', { path: tempPath });
      return;
    } catch (e) {
      console.error('Failed to preview with Tauri, falling back to blob:', e);
      // Fallback for non-Tauri environments
      openBlobPreview(blob);
      return;
    }
  }
  
  const res = await authService.apiFetch(`/certificates/${certificateId}/pdf`, { method: 'GET' }, true);
  if (!res.ok) {
    const errText = await res.text();
    try {
      const err = JSON.parse(errText);
      throw new Error(err?.error || 'Failed to preview certificate');
    } catch {
      throw new Error('Failed to preview certificate');
    }
  }
  const blob = await res.blob();
  
  // For Tauri desktop, write to temp file and open
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const tempPath = await invoke<string>('write_temp_pdf', {
      filename: `certificate-${certificateId}.pdf`,
      data: Array.from(uint8Array),
    });
    await invoke('open_file_with_system', { path: tempPath });
  } catch (e) {
    console.error('Failed to preview with Tauri, falling back to blob:', e);
    // Fallback for non-Tauri environments (web)
    openBlobPreview(blob);
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function openBlobPreview(blob: Blob) {
  const url = URL.createObjectURL(blob);
  // Open in a new tab/window; revoke later to free memory
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function cryptoRandomId(): string {
  // Simple UUID-like generator for mock flow
  const rnd = cryptoGetRandomBytes(16);
  rnd[6] = (rnd[6] & 0x0f) | 0x40; // version 4
  rnd[8] = (rnd[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(rnd).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function cryptoGetRandomBytes(n: number): Uint8Array {
  if (typeof window !== 'undefined' && 'crypto' in window && (window.crypto as any).getRandomValues) {
    const arr = new Uint8Array(n);
    (window.crypto as any).getRandomValues(arr);
    return arr;
  }
  // Fallback for environments without Web Crypto
  const arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
  return arr;
}

async function safeJson(res: Response): Promise<any | null> {
  try { return await res.json(); } catch { return null; }
}
