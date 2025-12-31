import { createHash, randomUUID } from 'crypto';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

import type { Certificate, ErasureMetadata } from '../models/certificate.js';
import type { CertificateRow } from '../models/certificateEntity.js';
import { getSupabaseAdmin } from '../db/supabase.js';

const getBucketName = (): string => process.env.CERT_STORAGE_BUCKET ?? 'certificates';
const arrayBufferToBuffer = async (blob: Blob): Promise<Buffer> => {
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
};
const ensureBucket = async () => {
  const supabase = getSupabaseAdmin();
  const bucket = getBucketName();
  try {
    const { error } = await supabase.storage.createBucket(bucket, { public: false });
    if (error && !/already exists/i.test(error.message)) {
      // eslint-disable-next-line no-console
      console.warn('Bucket create error:', error.message);
    }
  } catch (e) {
    // ignore bucket creation errors
  }
};

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

const toCertificate = (row: CertificateRow): Certificate => {
  const cert: any = {
    certificateId: row.certificate_id,
    certificateNumber: row.certificate_number,
    issuedAt: row.issued_at,
    signature: row.signature,
    driveId: row.drive_id,
    erasureMethod: row.erasure_method,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    operator: {
      name: row.operator_name,
    },
  };
  if (row.serial_number != null) cert.serialNumber = String(row.serial_number);
  if (row.model != null) cert.model = String(row.model);
  if (row.capacity_bytes != null) {
    const v: unknown = row.capacity_bytes;
    const n = typeof v === 'string' ? Number(v) : (v as number);
    if (Number.isFinite(n)) cert.capacityBytes = n as number;
  }
  if (row.firmware_version != null) cert.firmwareVersion = String(row.firmware_version);
  if (row.location != null) cert.location = String(row.location);
  if (row.operator_id != null) cert.operator.id = String(row.operator_id);
  if (row.operator_organization != null) cert.operator.organization = String(row.operator_organization);
  const hasVer = row.verification_hash != null || row.verification_tool != null || row.verification_notes != null;
  if (hasVer) {
    const v: any = {};
    if (row.verification_hash != null) v.hash = String(row.verification_hash);
    if (row.verification_tool != null) v.tool = String(row.verification_tool);
    if (row.verification_notes != null) v.notes = String(row.verification_notes);
    cert.verification = v;
  }
  if (row.notes != null) cert.notes = String(row.notes);
  return cert as Certificate;
};

export const createCertificate = async (metadata: ErasureMetadata, userId: string): Promise<Certificate> => {
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

  const supabase = getSupabaseAdmin();
  const insert = {
    user_id: userId,
    certificate_id: certificateId,
    certificate_number: certificateNumber,
    issued_at: issuedAt.toISOString(),
    signature,
    // Device info
    drive_id: metadata.driveId,
    serial_number: metadata.serialNumber ?? null,
    model: metadata.model ?? null,
    capacity_bytes: metadata.capacityBytes != null ? String(metadata.capacityBytes) : null,
    firmware_version: metadata.firmwareVersion ?? null,
    location: metadata.location ?? null,
    // Erasure metadata
    erasure_method: metadata.erasureMethod,
    started_at: metadata.startedAt,
    completed_at: metadata.completedAt,
    // Operator
    operator_id: metadata.operator.id ?? null,
    operator_name: metadata.operator.name,
    operator_organization: metadata.operator.organization ?? null,
    // Verification
    verification_hash: metadata.verification?.hash ?? null,
    verification_tool: metadata.verification?.tool ?? null,
    verification_notes: metadata.verification?.notes ?? null,
    // Notes
    notes: metadata.notes ?? null,
    // Storage path (set when uploading PDF to storage) — null for now
    pdf_storage_path: null,
  };
  const { data, error } = await supabase
    .from('certificates')
    .insert(insert)
    .select('*')
    .single();
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[certificates/insert] Failed', {
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
      code: (error as any).code,
      payload: insert,
    });
    throw new Error(`Failed to create certificate: ${error.message}`);
  }
  const created = data as CertificateRow;
  const cert = toCertificate(created);

  // Generate and upload PDF to storage, then persist path
  try {
    await ensureBucket();
    const pdf = await generateCertificatePdf(cert);
    const path = `${userId}/${cert.certificateNumber}.pdf`;
    const blob = new Blob([new Uint8Array(pdf)], { type: 'application/pdf' });
    const bucket = getBucketName();
    const maxAttempts = 3;
    let attempt = 0;
    let lastErr: Error | null = null;
    while (attempt < maxAttempts) {
      attempt += 1;
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { contentType: 'application/pdf', upsert: true });
      if (!upErr) {
        await supabase
          .from('certificates')
          .update({ pdf_storage_path: path })
          .eq('id', created.id)
          .eq('user_id', userId);
        lastErr = null;
        break;
      } else {
        lastErr = new Error(upErr.message);
        await new Promise((r) => setTimeout(r, attempt * 300));
      }
    }
    if (lastErr) {
      // eslint-disable-next-line no-console
      console.error('[storage/upload] Failed after retries', { message: lastErr.message, path });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('PDF upload failed; will fallback to on-demand generation. Reason:', (e as Error)?.message);
  }

  return cert;
};

export const getCertificate = async (certificateId: string, userId: string): Promise<Certificate | undefined> => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('certificate_id', certificateId)
    .eq('user_id', userId)
    .single();
  if (error) return undefined;
  return data ? toCertificate(data as CertificateRow) : undefined;
};

export const listCertificates = async (opts: { limit?: number; offset?: number } = {}, userId: string): Promise<Certificate[]> => {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('user_id', userId)
    .order('issued_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`Failed to list certificates: ${error.message}`);
  const rows = (data ?? []) as CertificateRow[];
  return rows.map((r) => toCertificate(r));
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

export const getCertificatePdfFromStorage = async (
  certificateId: string,
  userId: string,
): Promise<Buffer | null> => {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('certificates')
    .select('pdf_storage_path')
    .eq('certificate_id', certificateId)
    .eq('user_id', userId)
    .single();
  if (error || !data || !data.pdf_storage_path) return null;
  const path = data.pdf_storage_path as string;
  const { data: file, error: dlErr } = await supabase.storage
    .from(getBucketName())
    .download(path);
  if (dlErr || !file) return null;
  // Supabase returns a Blob in Node 18+; convert to Buffer
  try {
    return await arrayBufferToBuffer(file as Blob);
  } catch {
    return null;
  }
};
