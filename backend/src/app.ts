import cors from 'cors';
import express from 'express';

import type { Application } from 'express';

import certificateRoutes from './routes/certificateRoutes.js';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api', certificateRoutes);
app.get('/health', (_req, res) => {
	res.json({ status: 'ok' });
});

export default app;
