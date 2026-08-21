import dotenv from 'dotenv';

import app from './app.js';
import { initDb } from './db/supabase.js';

dotenv.config();

const PORT = process.env.PORT || '3000';

function validateEnv(): void {
	const missing: string[] = [];
	if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
	if (!process.env.SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY');
	if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
	if (missing.length) {
		// eslint-disable-next-line no-console
		console.error('Missing required environment variables:', missing.join(', '));
		process.exit(1);
	}

  const secret = process.env.JWT_SECRET as string;
  if (secret.length < 32) {
    // eslint-disable-next-line no-console
    console.error('JWT_SECRET is too short. Use a strong, random secret (>= 32 characters).');
    process.exit(1);
  }
}

validateEnv();

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
