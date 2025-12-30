import type { Request, Response } from 'express';

import type { ErasureMetadata } from '../models/certificate.js';
import { createCertificate, getCertificate, listCertificates, generateCertificatePdf } from '../services/certificateService.js';

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

export const issueCertificate = async (req: Request, res: Response) => {
  const payload = req.body as ErasureMetadata;
  const missing = validatePayload(payload);

  if (missing.length > 0) {
    return res.status(400).json({
      error: 'Missing or invalid required fields',
      fields: missing,
    });
  }

  try {
    const certificate = await createCertificate(payload);
    return res.status(201).json({ certificate });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to issue certificate', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Failed to issue certificate', details: message });
  }
};

export const fetchCertificate = async (req: Request, res: Response) => {
  const certificateId = req.params.certificateId;

  if (!certificateId) {
    return res.status(400).json({ error: 'certificateId is required' });
  }

  const certificate = await getCertificate(certificateId);

  if (!certificate) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  return res.json({ certificate });
};

export const downloadCertificatePdf = async (req: Request, res: Response) => {
  const certificateId = req.params.certificateId;
  if (!certificateId) {
    return res.status(400).json({ error: 'certificateId is required' });
  }

  const certificate = await getCertificate(certificateId);
  if (!certificate) {
    return res.status(404).json({ error: 'Certificate not found' });
  }

  try {
    const pdf = await generateCertificatePdf(certificate);
    res.setHeader('Content-Type', 'application/pdf');
    const filename = `${certificate.certificateNumber}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(pdf);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to generate certificate PDF', error);
    return res.status(500).json({ error: 'Failed to generate certificate PDF' });
  }
};

export const fetchCertificates = async (req: Request, res: Response) => {
  const limitQ = req.query.limit ? Number(req.query.limit) : undefined;
  const offsetQ = req.query.offset ? Number(req.query.offset) : undefined;
  try {
    const opts: { limit?: number; offset?: number } = {};
    if (typeof limitQ === 'number' && Number.isFinite(limitQ)) opts.limit = limitQ;
    if (typeof offsetQ === 'number' && Number.isFinite(offsetQ)) opts.offset = offsetQ;
    const certificates = await listCertificates(opts);
    return res.json({ certificates });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to list certificates', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ error: 'Failed to list certificates', details: message });
  }
};
