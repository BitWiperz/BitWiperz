import { Router, type IRouter } from 'express';
import rateLimit from 'express-rate-limit';

import { authMiddleware } from '../controllers/authController.js';
import { fetchCertificate, issueCertificate, downloadCertificatePdf, fetchCertificates } from '../controllers/certificateController.js';

const router: IRouter = Router();

// General API rate limit
const apiLimiter = rateLimit({
	windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
	max: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 500),
	standardHeaders: true,
	legacyHeaders: false,
});

router.post('/certificates', authMiddleware, apiLimiter, issueCertificate);
router.get('/certificates', authMiddleware, apiLimiter, fetchCertificates);
router.get('/certificates/:certificateId', authMiddleware, apiLimiter, fetchCertificate);
router.get('/certificates/:certificateId/pdf', authMiddleware, apiLimiter, downloadCertificatePdf);

export default router;
