import path from 'path';
import { fileURLToPath } from 'url';
import { Sequelize } from 'sequelize';

// Resolve a stable path for the SQLite database file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.resolve(__dirname, '../../data');
const dbFile = path.join(dbDir, process.env.SQLITE_FILENAME ?? 'bitwiperz.sqlite');

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbFile,
  logging: false,
});

export const initDb = async () => {
  // Ensure directory exists without bringing in fs-extra
  await import('fs').then(async (fs) => {
    try {
      await fs.promises.mkdir(dbDir, { recursive: true });
    } catch {
      // ignore
    }
  });

  // Models should call their own init when imported
  await sequelize.authenticate();
  await sequelize.sync();
};
