import { createHash, randomUUID } from 'crypto';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

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

const toCertificate = (row: CertificateEntity): Certificate => {
  const cert: any = {
    certificateId: row.certificateId,
    certificateNumber: row.certificateNumber,
    issuedAt: row.issuedAt.toISOString(),
    signature: row.signature,
    driveId: row.driveId,
    erasureMethod: row.erasureMethod,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt.toISOString(),
    operator: {
      name: row.operatorName,
    },
  };
  if (row.serialNumber != null) cert.serialNumber = String((row as any).serialNumber);
  if (row.model != null) cert.model = String((row as any).model);
  if ((row as any).capacityBytes != null) {
    const v: unknown = (row as any).capacityBytes;
    const n = typeof v === 'string' ? Number(v) : (v as number);
    if (Number.isFinite(n)) cert.capacityBytes = n as number;
  }
  if (row.firmwareVersion != null) cert.firmwareVersion = String((row as any).firmwareVersion);
  if (row.location != null) cert.location = String((row as any).location);
  if (row.operatorId != null) cert.operator.id = String((row as any).operatorId);
  if (row.operatorOrganization != null) cert.operator.organization = String((row as any).operatorOrganization);
  const hasVer = (row as any).verificationHash != null || (row as any).verificationTool != null || (row as any).verificationNotes != null;
  if (hasVer) {
    const v: any = {};
    if ((row as any).verificationHash != null) v.hash = String((row as any).verificationHash);
    if ((row as any).verificationTool != null) v.tool = String((row as any).verificationTool);
    if ((row as any).verificationNotes != null) v.notes = String((row as any).verificationNotes);
    cert.verification = v;
  }
  if (row.notes != null) cert.notes = String((row as any).notes);
  return cert as Certificate;
};

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
  const COMPANY = process.env.CERT_COMPANY_NAME ?? 'BitWiperz';
  const LOGO_PATH = process.env.CERT_LOGO_PATH;

  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const width = page.getSize().width;
  const height = page.getSize().height;

  // Optional logo
  if (LOGO_PATH) {
    try {
      const fs = await import('fs');
      const imgBytes = await fs.promises.readFile(LOGO_PATH);
      let img;
      if (LOGO_PATH.toLowerCase().endsWith('.png')) {
        img = await doc.embedPng(imgBytes);
      } else {
        img = await doc.embedJpg(imgBytes);
      }
      const imgW = 120;
      const scale = imgW / img.width;
      const imgH = img.height * scale;
      page.drawImage(img, { x: margin, y: height - margin - imgH, width: imgW, height: imgH });
    } catch {
      // ignore logo errors
    }
  }

  // Header bar
  page.drawRectangle({ x: margin, y: height - margin - 30, width: width - margin * 2, height: 30, color: rgb(0.15, 0.15, 0.18) });
  page.drawText('Data Erasure Certificate', {
    x: margin + 12,
    y: height - margin - 22,
    size: 16,
    font: helvBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(COMPANY, {
    x: width - margin - helvBold.widthOfTextAtSize(COMPANY, 12),
    y: height - margin - 20,
    size: 12,
    font: helvBold,
    color: rgb(1, 1, 1),
  });

  // Watermark certificate number (subtle)
  page.drawText(certificate.certificateNumber, {
    x: width / 2 - 120,
    y: height / 2 + 220,
    size: 48,
    font: helvBold,
    color: rgb(0.92, 0.92, 0.95),
    rotate: degrees(0),
    opacity: 0.25,
  });

  // Section helper
  let y = height - margin - 60;
  const lineGap = 18;
  const labelColor = rgb(0.3, 0.3, 0.35);
  const valueColor = rgb(0, 0, 0);

  const section = (title: string) => {
    page.drawText(title, { x: margin, y, size: 13, font: helvBold, color: valueColor });
    y -= lineGap;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.85, 0.85, 0.88) });
    y -= 8;
  };

  const field = (label: string, value: string) => {
    page.drawText(label + ':', { x: margin, y, size: 11, font: helv, color: labelColor });
    page.drawText(value, { x: margin + 160, y, size: 11, font: helvBold, color: valueColor });
    y -= lineGap;
  };

  // Certificate Info
  section('Certificate');
  field('Number', certificate.certificateNumber);
  field('ID', certificate.certificateId);
  field('Issued At', certificate.issuedAt);
  field('Signature (SHA-256)', certificate.signature);

  // Device Info
  section('Device');
  field('Drive ID', certificate.driveId);
  field('Model', certificate.model ?? 'N/A');
  field('Serial', certificate.serialNumber ?? 'N/A');
  field('Capacity (bytes)', String(certificate.capacityBytes ?? 'N/A'));
  field('Firmware', certificate.firmwareVersion ?? 'N/A');
  field('Location', certificate.location ?? 'N/A');

  // Erasure Info
  section('Erasure');
  field('Method', certificate.erasureMethod);
  field('Started At', certificate.startedAt);
  field('Completed At', certificate.completedAt);

  // Operator & Verification
  section('Operator');
  const opName = certificate.operator.name + (certificate.operator.organization ? ` (${certificate.operator.organization})` : '');
  field('Name', opName);
  if (certificate.verification) {
    section('Verification');
    field('Hash', certificate.verification.hash ?? 'N/A');
    field('Tool', certificate.verification.tool ?? 'N/A');
    if (certificate.verification.notes) {
      page.drawText('Notes:', { x: margin, y, size: 11, font: helv, color: labelColor });
      y -= lineGap;
      const wrap = (text: string, max = 80) => text.match(new RegExp(`.{1,${max}}`, 'g')) ?? [text];
      wrap(certificate.verification.notes, 90).forEach((ln) => {
        page.drawText(ln, { x: margin + 20, y, size: 11, font: helv, color: valueColor });
        y -= lineGap;
      });
    }
  }

  // General notes
  if (certificate.notes) {
    section('Notes');
    const wrap = (text: string, max = 90) => text.match(new RegExp(`.{1,${max}}`, 'g')) ?? [text];
    wrap(certificate.notes, 100).forEach((ln) => {
      page.drawText(ln, { x: margin, y, size: 11, font: helv, color: valueColor });
      y -= lineGap;
    });
  }

  // Footer
  const footer = 'Generated by BitWiperz • This certificate attests to data erasure completed on the device listed above.';
  page.drawLine({ start: { x: margin, y: margin + 30 }, end: { x: width - margin, y: margin + 30 }, thickness: 1, color: rgb(0.85, 0.85, 0.88) });
  page.drawText(footer, { x: margin, y: margin + 12, size: 10, font: helv, color: labelColor });

  const bytes = await doc.save();
  return Buffer.from(bytes);
};
