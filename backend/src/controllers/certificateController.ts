import type { Request, Response } from 'express';

import type { ErasureMetadata } from '../models/certificate.js';
import { createCertificate, getCertificate } from '../services/certificateService.js';

const REQUIRED_FIELDS: Array<keyof ErasureMetadata> = [
  'driveId',
  'erasureMethod',
  'startedAt',
  'completedAt',
  'operator',
];

const validatePayload = (payload: Partial<ErasureMetadata>): string[] => {
  const missing = REQUIRED_FIELDS.filter((field) => {
    if (field === 'operator') {
      return !payload.operator || !payload.operator.name;
    }
    return payload[field] === undefined || payload[field] === '';
  });

  if (payload.startedAt && payload.completedAt) {
    const start = Date.parse(payload.startedAt);
    const end = Date.parse(payload.completedAt);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      missing.push('startedAt', 'completedAt');
    } else if (end < start) {
      missing.push('completedAt');
    }
  }

  return [...new Set(missing)];
};

export const issueCertificate = (req: Request, res: Response) => {
  const payload = req.body as ErasureMetadata;
  const missing = validatePayload(payload);

  if (missing.length > 0) {
    return res.status(400).json({
      error: 'Missing or invalid required fields',
      fields: missing,
    });
  }

  try {
    const certificate = createCertificate(payload);
    return res.status(201).json({ certificate });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to issue certificate', error);
    return res.status(500).json({ error: 'Failed to issue certificate' });
  }
};

export const fetchCertificate = (req: Request, res: Response) => {
  const certificateId = req.params.certificateId;

  if (!certificateId) {
    return res.status(400).json({ error: 'certificateId is required' });
  }

  const certificate = getCertificate(certificateId);

  if (!certificate) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  return res.json({ certificate });
};
