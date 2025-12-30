import { Router, type IRouter } from 'express';

import { authMiddleware } from '../controllers/authController.js';
import { fetchCertificate, issueCertificate, downloadCertificatePdf, fetchCertificates } from '../controllers/certificateController.js';

const router: IRouter = Router();

router.post('/certificates', authMiddleware, issueCertificate);
router.get('/certificates', authMiddleware, fetchCertificates);
router.get('/certificates/:certificateId', authMiddleware, fetchCertificate);
router.get('/certificates/:certificateId/pdf', authMiddleware, downloadCertificatePdf);

export default router;
