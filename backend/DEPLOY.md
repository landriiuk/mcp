Deployment notes — single-host Next.js setup

Goal: serve frontend and backend from one Next.js deployment (Render/VPS/Vercel where persistent storage is available).

Strategy
1. Build the frontend and place static files into `backend/public` so Next.js can serve them.
2. Build the Next.js backend and run it in production.

Local steps

```bash
# from repo root
# 1) build frontend and copy into backend/public
npm run prepare-deploy

# 2) build backend
cd backend && npm install && npm run build

# 3) run backend
npm start
```

Docker

- CI should run `npm run prepare-deploy` so `backend/public` contains built frontend files.
- Build Docker image from `backend/Dockerfile` at repo root:

```bash
docker build -t mcp-backend -f backend/Dockerfile .
docker run -p 3000:3000 mcp-backend
```

Notes on the database

- In production, this backend uses Postgres and requires `DATABASE_URL` (set `APP_ENV=production`).
- Locally, a mockup mode is available when `APP_ENV=local` or `DATABASE_URL` is not set. The app uses an in-memory store (no native modules required).
- The legacy SQLite file may still exist for migration scripts but is not required by local mock mode.

Environment variables

- `APP_ENV` — set to `local` for local dev mock mode or `production` to require `DATABASE_URL`.
- `DATABASE_URL` — required in production when `APP_ENV=production`.
- `PORT` — default 3000.

Platforms

- Render: supports Docker or a Node service with persistent disk — suitable for this repo.
- Vercel: supports Next.js and requires a hosted database. Set `DATABASE_URL` in Vercel project settings.

Render CI notes

- The repository includes `.github/workflows/deploy-render.yml` which will run on pushes to `main`.
- Before enabling the workflow, add these repository secrets in GitHub: `RENDER_API_KEY` and `RENDER_SERVICE_ID`.
- `RENDER_API_KEY` is a service account API key from Render; `RENDER_SERVICE_ID` is the Render service ID for the created web service.

The workflow will run `npm run prepare-deploy` (build frontend and copy to `backend/public`) and then POST to Render's deploy API to trigger a deployment.

Vercel + Supabase (recommended migration path)

1. Create a Supabase project (https://app.supabase.com) and note the Postgres connection string.
2. In your Vercel project settings, add a `DATABASE_URL` environment variable with the Supabase Postgres connection string.
3. Run the migration script locally to copy existing SQLite rows into Postgres:

```bash
# from repository root
cd backend
DATABASE_URL="postgres://..." npm run migrate-sqlite
```

4. Deploy to Vercel:
	- Connect the GitHub repo in Vercel.
	- **Root Directory must be `backend`** (not the repo root — root is the Vite frontend).
	- Set environment variables: `DATABASE_URL`, and optionally `APP_ENV=production`.
	- Do **not** rely on `.github/workflows/deploy-render.yml` (removed — it was fully commented and failed every push).
	- Vercel will run `npm run build` inside `backend`.

If Production stays on an old commit while `main` moves: Settings → Git → confirm Production Branch + Root Directory, then Deployments → Redeploy (clear cache).

Notes:
- After migration, the app will use Postgres only. No SQLite file is needed at runtime.
- Make sure to remove or ignore `backend/db/words.db` from production builds once migration is complete.

*** End of file
