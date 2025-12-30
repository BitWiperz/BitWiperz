# Backend (BitWiperz)

Auth service powered by Express + Sequelize (SQLite).

## Setup

1. Install deps in this package:

```bash
pnpm -C backend add sequelize sqlite3
```

2. Approve and build native modules (required for `sqlite3` on macOS):

```bash
pnpm -C backend approve-builds
# Select sqlite3 (and esbuild if shown), then confirm
```

If you prefer non-interactive, you can run:

```bash
pnpm -C backend rebuild sqlite3 esbuild
```

3. Create an `.env` in `backend/` (optional):

```bash
PORT=3000
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
SQLITE_FILENAME=bitwiperz.sqlite
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
