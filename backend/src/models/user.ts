// Supabase-backed user row (database schema)
export interface UserRow {
  id: string; // uuid
  email: string;
  password_hash: string;
  name: string | null;
  created_at: string; // timestamp ISO
  updated_at: string; // timestamp ISO
}

// Public user returned by API
export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}
