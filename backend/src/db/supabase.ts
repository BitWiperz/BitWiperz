import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in the environment.');
  }
  supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false },
  });
  return supabaseAdmin;
}

export async function initDb(): Promise<void> {
  const client = getSupabaseAdmin();
  // Verify connection and that required tables exist
  try {
    const { data, error } = await client.from('users').select('id').limit(1);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[supabase] Connectivity/table check failed', {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      });
      throw new Error(
        'Supabase init failed: ensure the "users" table exists with the expected schema. See backend/README.md for SQL setup.'
      );
    }
    // eslint-disable-next-line no-console
    console.log('[supabase] Connected. Users table accessible.', { rowsChecked: (data ?? []).length });

    const { error: certErr } = await client.from('certificates').select('id').limit(1);
    if (certErr) {
      // eslint-disable-next-line no-console
      console.error('[supabase] Certificates table check failed', {
        message: certErr.message,
        details: (certErr as any).details,
        hint: (certErr as any).hint,
        code: (certErr as any).code,
      });
      throw new Error(
        'Supabase init failed: ensure the "certificates" table exists. See backend/data/schema.sql for setup.'
      );
    }

    // Ensure storage bucket exists
    const bucket = process.env.CERT_STORAGE_BUCKET ?? 'certificates';
    try {
      const { data: buckets, error: listErr } = await client.storage.listBuckets();
      if (!listErr) {
        const found = (buckets ?? []).some((b) => b.name === bucket);
        if (!found) {
          const { error: createErr } = await client.storage.createBucket(bucket, { public: false });
          if (createErr && !/already exists/i.test(createErr.message)) {
            // eslint-disable-next-line no-console
            console.warn('[supabase] Failed to create storage bucket', { message: createErr.message });
          }
        }
      }
    } catch (be) {
      // eslint-disable-next-line no-console
      console.warn('[supabase] Storage bucket check/create error', (be as Error)?.message);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[supabase] Initialization error', (e as Error).message);
    throw e;
  }
}
