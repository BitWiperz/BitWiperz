import { Router, type IRouter } from 'express';
import rateLimit from 'express-rate-limit';

import { authMiddleware, getMe, postLogin, postRegister } from '../controllers/authController.js';

const router: IRouter = Router();

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
	windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
	max: Number(process.env.RATE_LIMIT_MAX_AUTH ?? 50),
	standardHeaders: true,
	legacyHeaders: false,
});

router.post('/auth/register', authLimiter, postRegister);
router.post('/auth/login', authLimiter, postLogin);
router.get('/auth/me', authMiddleware, getMe);

export default router;
