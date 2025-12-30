import { Router, type IRouter } from 'express';

import { fetchCertificate, issueCertificate, downloadCertificatePdf } from '../controllers/certificateController.js';

const router: IRouter = Router();

router.post('/certificates', issueCertificate);
router.get('/certificates/:certificateId', fetchCertificate);
router.get('/certificates/:certificateId/pdf', downloadCertificatePdf);

export default router;
