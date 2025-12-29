import type { Request, Response } from 'express';

import { listDrives } from '../services/driveService.js';

export const fetchDrives = async (_req: Request, res: Response) => {
  try {
    const drives = await listDrives();
    return res.json({ drives });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to list drives', error);
    return res.status(500).json({ error: 'Failed to list drives' });
  }
};
