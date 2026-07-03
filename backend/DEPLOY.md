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

- This setup uses SQLite by default (`backend/db/words.db`). For robust production use consider migrating to PostgreSQL (Supabase) or another hosted DB.
- If you keep SQLite, make sure the host provides persistent storage and mount the path where `backend/db/words.db` lives.

Environment variables

- `DATABASE_URL` (optional) — if you migrate to Postgres.
- `PORT` — default 3000.

Platforms

- Render: supports Docker or a Node service with persistent disk — suitable for this repo.
- Vercel: supports Next.js but is serverless; SQLite is not ideal there. Prefer migrating DB to Postgres if using Vercel.

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
	- Set environment variables in Vercel (`DATABASE_URL`).
	- Vercel will run `npm run build` in the `backend` folder as part of Next.js build.

Notes:
- After migration, the app will use Postgres (no SQLite file needed). API code supports both SQLite (local) and Postgres (when `DATABASE_URL` is present).
- Make sure to remove or ignore `backend/db/words.db` from production builds if you switch to Postgres.

*** End of file
