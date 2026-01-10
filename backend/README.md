# Backend (BitWiperz)

Express + TypeScript backend with custom JWT auth. Persistence is via Supabase (Postgres + Storage).

## Setup

1. Create an `.env` in `backend/` (see `.env.example`):

```bash
PORT=3000
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
CERT_COMPANY_NAME=BitWiperz
# CERT_LOGO_PATH=./data/logo.png
```

2. Install deps:

```bash
pnpm -C backend install
```

## Run

```bash
pnpm -C backend dev
```

Server exposes:
- POST `/api/auth/register` { email, password, name? }
- POST `/api/auth/login` { email, password }
- GET `/api/auth/me` with `Authorization: Bearer <token>`

Health check: GET `/health`

## Supabase Setup

- Tables (snake_case):
	- `users`: id (uuid), email, password_hash, name, created_at, updated_at
	- `certificates`: id (uuid), user_id (uuid FK), certificate_id, certificate_number, issued_at, signature, drive_id, serial_number, model, capacity_bytes (bigint), firmware_version, location, erasure_method, started_at, completed_at, operator_id, operator_name, operator_organization, verification_hash, verification_tool, verification_notes, notes, pdf_storage_path, created_at, updated_at

- Storage:
	- Create private bucket `certificates` for PDF files.

- RLS policies:
	- On `certificates`, allow select/insert/update/delete where `user_id = auth.uid()` (if using Supabase auth) or managed via the service role key on the server.

- Environment:
	- Set `SUPABASE_URL` to your project, e.g. `https://wcwzcguxafkllcpjpipo.supabase.co`
	- Set `SUPABASE_SERVICE_KEY` to the Service Role key from Supabase (server-side only).
	- Optionally set `SUPABASE_ANON_KEY` to the publishable anon key for client scenarios; the backend does not use it for admin operations.

### Quick setup via SQL

Use the SQL editor in the Supabase dashboard and run the statements in [backend/data/schema.sql](backend/data/schema.sql) to create the required `users` and `certificates` tables, indices and triggers.

## Endpoints

- POST `/api/auth/register` { email, password, name? }
- POST `/api/auth/login` { email, password }
- GET `/api/auth/me` with `Authorization: Bearer <token>`
- POST `/api/certificates` (protected)
- GET `/api/certificates` (protected)
- GET `/api/certificates/:certificateId` (protected)
- GET `/api/certificates/:certificateId/pdf` (protected)
