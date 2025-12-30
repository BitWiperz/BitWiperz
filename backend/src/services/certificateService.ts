import { createHash, randomUUID } from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import type { Certificate, ErasureMetadata } from '../models/certificate.js';
import { CertificateEntity } from '../models/certificateEntity.js';

const buildCertificateNumber = (issuedAtIso: string, driveId: string): string => {
  const dt = new Date(issuedAtIso);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  const hh = String(dt.getUTCHours()).padStart(2, '0');
  const mm = String(dt.getUTCMinutes()).padStart(2, '0');
  const ss = String(dt.getUTCSeconds()).padStart(2, '0');
  const dateStamp = `${y}${m}${d}${hh}${mm}${ss}`;
  const driveSuffix = driveId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).padStart(6, '0');
  return `CERT-${dateStamp}-${driveSuffix}`;
};

const toCertificate = (row: CertificateEntity): Certificate => ({
  certificateId: row.certificateId,
  certificateNumber: row.certificateNumber,
  issuedAt: row.issuedAt.toISOString(),
  signature: row.signature,
  driveId: row.driveId,
  serialNumber: row.serialNumber ?? undefined,
  model: row.model ?? undefined,
  capacityBytes: row.capacityBytes ?? undefined,
  firmwareVersion: row.firmwareVersion ?? undefined,
  location: row.location ?? undefined,
  erasureMethod: row.erasureMethod,
  startedAt: row.startedAt.toISOString(),
  completedAt: row.completedAt.toISOString(),
  operator: {
    id: row.operatorId ?? undefined,
    name: row.operatorName,
    organization: row.operatorOrganization ?? undefined,
  },
  verification: row.verificationHash || row.verificationTool || row.verificationNotes
    ? {
        hash: row.verificationHash ?? undefined,
        tool: row.verificationTool ?? undefined,
        notes: row.verificationNotes ?? undefined,
      }
    : undefined,
  notes: row.notes ?? undefined,
});

export const createCertificate = async (metadata: ErasureMetadata): Promise<Certificate> => {
  const issuedAt = new Date();
  const certificateId = randomUUID();
  const certificateNumber = buildCertificateNumber(issuedAt.toISOString(), metadata.driveId);

  const signaturePayload = JSON.stringify({
    ...metadata,
    certificateId,
    certificateNumber,
    issuedAt: issuedAt.toISOString(),
  });

  const signature = createHash('sha256').update(signaturePayload).digest('hex');

  const row = await CertificateEntity.create({
    certificateId,
    certificateNumber,
    issuedAt,
    signature,
    // Device info
    driveId: metadata.driveId,
    serialNumber: metadata.serialNumber ?? null,
    model: metadata.model ?? null,
    capacityBytes: metadata.capacityBytes ?? null,
    firmwareVersion: metadata.firmwareVersion ?? null,
    location: metadata.location ?? null,
    // Erasure metadata
    erasureMethod: metadata.erasureMethod,
    startedAt: new Date(metadata.startedAt),
    completedAt: new Date(metadata.completedAt),
    // Operator
    operatorId: metadata.operator.id ?? null,
    operatorName: metadata.operator.name,
    operatorOrganization: metadata.operator.organization ?? null,
    // Verification
    verificationHash: metadata.verification?.hash ?? null,
    verificationTool: metadata.verification?.tool ?? null,
    verificationNotes: metadata.verification?.notes ?? null,
    // Notes
    notes: metadata.notes ?? null,
  });

  return toCertificate(row);
};

export const getCertificate = async (certificateId: string): Promise<Certificate | undefined> => {
  const row = await CertificateEntity.findOne({ where: { certificateId } });
  return row ? toCertificate(row) : undefined;
};

export const generateCertificatePdf = async (certificate: Certificate): Promise<Buffer> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter size
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const draw = (text: string, x: number, y: number, size = 12) => {
    page.drawText(text, { x, y, size, font, color: rgb(0, 0, 0) });
  };

  // Header
  draw('Data Erasure Certificate', 180, 740, 18);

  // Basic info
  let y = 700;
  const step = 20;
  const lines = [
    `Certificate Number: ${certificate.certificateNumber}`,
    `Certificate ID: ${certificate.certificateId}`,
    `Issued At: ${certificate.issuedAt}`,
    `Signature (SHA-256): ${certificate.signature.slice(0, 16)}...`,
    `Drive ID: ${certificate.driveId}`,
    `Model: ${certificate.model ?? 'N/A'}`,
    `Serial: ${certificate.serialNumber ?? 'N/A'}`,
    `Capacity (bytes): ${certificate.capacityBytes ?? 'N/A'}`,
    `Firmware: ${certificate.firmwareVersion ?? 'N/A'}`,
    `Location: ${certificate.location ?? 'N/A'}`,
    `Erasure Method: ${certificate.erasureMethod}`,
    `Started At: ${certificate.startedAt}`,
    `Completed At: ${certificate.completedAt}`,
    `Operator: ${certificate.operator.name}${certificate.operator.organization ? ' (' + certificate.operator.organization + ')' : ''}`,
  ];
  lines.forEach((line) => {
    draw(line, 50, y);
    y -= step;
  });

  if (certificate.verification) {
    draw('Verification:', 50, y);
    y -= step;
    draw(`Hash: ${certificate.verification.hash ?? 'N/A'}`, 70, y);
    y -= step;
    draw(`Tool: ${certificate.verification.tool ?? 'N/A'}`, 70, y);
    y -= step;
    if (certificate.verification.notes) {
      draw(`Notes: ${certificate.verification.notes}`, 70, y);
      y -= step;
    }
  }

  if (certificate.notes) {
    draw('Notes:', 50, y);
    y -= step;
    draw(certificate.notes, 70, y);
    y -= step;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
};
