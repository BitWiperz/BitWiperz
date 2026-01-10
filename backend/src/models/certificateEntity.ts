// Supabase-backed certificate row (database schema)
export interface CertificateRow {
  id: string; // uuid
  user_id: string; // uuid
  certificate_id: string;
  certificate_number: string;
  issued_at: string; // timestamp ISO
  signature: string;
  drive_id: string;
  serial_number: string | null;
  model: string | null;
  capacity_bytes: string | null; // bigint -> string
  firmware_version: string | null;
  location: string | null;
  erasure_method: string;
  started_at: string; // timestamp ISO
  completed_at: string; // timestamp ISO
  operator_id: string | null;
  operator_name: string;
  operator_organization: string | null;
  verification_hash: string | null;
  verification_tool: string | null;
  verification_notes: string | null;
  notes: string | null;
  pdf_storage_path: string | null;
  created_at: string; // timestamp ISO
  updated_at: string; // timestamp ISO
}
