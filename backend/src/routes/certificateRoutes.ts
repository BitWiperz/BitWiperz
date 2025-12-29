import { Router, type IRouter } from 'express';

import { fetchCertificate, issueCertificate } from '../controllers/certificateController.js';

const router: IRouter = Router();

router.post('/certificates', issueCertificate);
router.get('/certificates/:certificateId', fetchCertificate);

export default router;
