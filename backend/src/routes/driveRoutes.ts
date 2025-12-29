import { Router, type IRouter } from 'express';

import { fetchDrives } from '../controllers/driveController.js';

const router: IRouter = Router();

router.get('/drives', fetchDrives);

export default router;
