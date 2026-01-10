// Deprecated: Sequelize/SQLite is no longer used. Supabase is the sole backend.
// This file remains only to avoid import errors if referenced accidentally.
// Do not use.
export const initDb = async () => {
  throw new Error('Deprecated: Sequelize is no longer used. Use Supabase via src/db/supabase.ts');
};
