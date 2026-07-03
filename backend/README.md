# MCP Next.js Backend

This backend uses Supabase/Postgres in production and supports a local mockup with SQLite when `DATABASE_URL` is not set.

## Run

From `/Users/liubov/Desktop/mcp/backend`:

```bash
npm install
npm run dev
```

For production or hosted database use:

```bash
DATABASE_URL="postgres://..." npm run dev
```

API endpoint:

- `GET /api/words`
- `POST /api/words`
