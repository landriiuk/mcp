# MCP Next.js Backend


This backend uses Supabase/Postgres in production and supports a local mockup (in-memory) when `APP_ENV=local` or `DATABASE_URL` is not set.

## Run

From `/Users/liubov/Desktop/mcp/backend`:

```bash
npm install
npm run dev
```

For production or hosted database use set `APP_ENV=production` and provide `DATABASE_URL`:

```bash
APP_ENV=production DATABASE_URL="postgres://..." npm run dev
```

API endpoint:

- `GET /api/words`
- `POST /api/words`
