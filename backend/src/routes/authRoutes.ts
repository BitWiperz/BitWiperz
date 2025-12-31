import { Router, type IRouter } from 'express';

import { authMiddleware, getMe, postLogin, postRegister } from '../controllers/authController.js';

const router: IRouter = Router();

router.post('/auth/register', postRegister);
router.post('/auth/login', postLogin);
router.get('/auth/me', authMiddleware, getMe);

export default router;
