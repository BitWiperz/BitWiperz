import dotenv from 'dotenv';

import app from './app.js';
import { initDb } from './db/sequelize.js';

dotenv.config();

const PORT = process.env.PORT ?? '3000';

initDb()
	.then(() => {
		app.listen(PORT, () => {
		// eslint-disable-next-line no-console
		console.log(`Backend listening on port ${PORT}`);
	});
	})
	.catch((error) => {
		// eslint-disable-next-line no-console
		console.error('Failed to initialize database', error);
		process.exit(1);
	});
