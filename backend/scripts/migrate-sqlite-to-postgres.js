#!/usr/bin/env node
// Migrate rows from backend/db/words.db (SQLite) to a Postgres database.
// Usage: DATABASE_URL=postgres://... node scripts/migrate-sqlite-to-postgres.js

const path = require('path')
const fs = require('fs')

const DATABASE_URL = process.env.DATABASE_URL || process.argv[2]
if (!DATABASE_URL) {
  console.error('Usage: set DATABASE_URL env or pass it as first argument')
  process.exit(1)
}

const Database = require('better-sqlite3')
const { Pool } = require('pg')

const sqlitePath = path.join(process.cwd(), 'db', 'words.db')
if (!fs.existsSync(sqlitePath)) {
  console.error('SQLite DB not found at', sqlitePath)
  process.exit(1)
}

const sqlite = new Database(sqlitePath)
const rows = sqlite.prepare('SELECT * FROM words').all()

const pool = new Pool({ connectionString: DATABASE_URL })

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS words (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL,
      meaning TEXT NOT NULL,
      example TEXT,
      status TEXT NOT NULL,
      tags TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `)

  for (const row of rows) {
    const tags = Array.isArray(row.tags) ? row.tags.join(',') : row.tags
    await pool.query(
      `INSERT INTO words (id, word, meaning, example, status, tags, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET word = EXCLUDED.word, meaning = EXCLUDED.meaning, example = EXCLUDED.example, status = EXCLUDED.status, tags = EXCLUDED.tags, updated_at = EXCLUDED.updated_at`,
      [row.id, row.word, row.meaning, row.example || '', row.status || 'new', tags || '', row.created_at || new Date().toISOString(), row.updated_at || new Date().toISOString()],
    )
  }

  console.log(`Migrated ${rows.length} rows to Postgres`)
  await pool.end()
  process.exit(0)
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
