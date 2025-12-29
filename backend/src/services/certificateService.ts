import { createHash, randomUUID } from 'crypto';

import type { Certificate, ErasureMetadata } from '../models/certificate.js';

const certificateStore: Certificate[] = [];

const buildCertificateNumber = (issuedAt: string, driveId: string): string => {
  const dateStamp = issuedAt.slice(0, 10).replace(/-/g, '');
  const driveSuffix = driveId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).padStart(6, '0');
  return `CERT-${dateStamp}-${driveSuffix}`;
};

export const createCertificate = (metadata: ErasureMetadata): Certificate => {
  const issuedAt = new Date().toISOString();
  const certificateId = randomUUID();
  const certificateNumber = buildCertificateNumber(issuedAt, metadata.driveId);

  const signaturePayload = JSON.stringify({
    ...metadata,
    certificateId,
    certificateNumber,
    issuedAt,
  });

  const signature = createHash('sha256').update(signaturePayload).digest('hex');

  const certificate: Certificate = {
    ...metadata,
    certificateId,
    certificateNumber,
    issuedAt,
    signature,
  };

  certificateStore.push(certificate);
  return certificate;
};

export const getCertificate = (certificateId: string): Certificate | undefined =>
  certificateStore.find((entry) => entry.certificateId === certificateId);
