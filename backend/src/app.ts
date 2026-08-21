import cors from 'cors';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

import type { Application } from 'express';

import authRoutes from './routes/authRoutes.js';
import certificateRoutes from './routes/certificateRoutes.js';


const app: Application = express();

// Middleware
// CORS: restrict origins via env (comma-separated). Default to localhost dev.
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:1420,http://127.0.0.1:1420').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api', authRoutes);
app.use('/api', certificateRoutes);
app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

// Centralized error handler (keeps responses generic in prod)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
	// eslint-disable-next-line no-console
	console.error('[error]', err);
	const isDev = (process.env.NODE_ENV ?? 'development') !== 'production';
	const payload = isDev && err instanceof Error ? { error: 'Internal Server Error', details: err.message } : { error: 'Internal Server Error' };
	res.status(500).json(payload);
});

export default app;
