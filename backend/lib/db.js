import process from 'process'
import { join } from 'path'
import { Pool } from 'pg'
import Database from 'better-sqlite3'

const DATABASE_URL = process.env.DATABASE_URL
const isProduction = process.env.NODE_ENV === 'production'

function convertPlaceholders(sql) {
  let i = 0
  return sql.replace(/\?/g, () => {
    i += 1
    return `$${i}`
  })
}

function isConnectionError(err) {
  return (
    err?.code === 'ENOTFOUND' ||
    err?.code === 'ECONNREFUSED' ||
    err?.code === 'EAI_AGAIN' ||
    /connect/i.test(err?.message || '')
  )
}

function createSqliteDb() {
  const sqlitePath = join(process.cwd(), 'db', 'words.db')
  const sqlite = new Database(sqlitePath)

  sqlite
    .prepare(`
      CREATE TABLE IF NOT EXISTS words (
        id TEXT PRIMARY KEY,
        word TEXT NOT NULL,
        meaning TEXT NOT NULL,
        example TEXT,
        status TEXT NOT NULL,
        tags TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)
    .run()

  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql)
      return {
        async run(...params) {
          return statement.run(...params)
        },
        async get(...params) {
          return statement.get(...params)
        },
        async all(...params) {
          return statement.all(...params)
        },
      }
    },
  }
}

const localDb = createSqliteDb()
let db = localDb

if (DATABASE_URL) {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  async function ensurePostgresSchema() {
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
  }

  ensurePostgresSchema().catch((err) => {
    console.error('Failed to initialize Postgres schema:', err)
    if (isProduction) {
      throw err
    }
    console.warn('Falling back to local SQLite because Postgres is unavailable in development.')
  })

  db = {
    prepare(sql) {
      const converted = convertPlaceholders(sql)
      const statement = {
        async run(...params) {
          try {
            return await pool.query(converted, params)
          } catch (err) {
            if (!isProduction && isConnectionError(err)) {
              console.warn('Postgres unavailable, using local SQLite for this request.')
              return localDb.prepare(sql).run(...params)
            }
            throw err
          }
        },
        async get(...params) {
          try {
            const res = await pool.query(converted, params)
            return res.rows[0]
          } catch (err) {
            if (!isProduction && isConnectionError(err)) {
              console.warn('Postgres unavailable, using local SQLite for this request.')
              return localDb.prepare(sql).get(...params)
            }
            throw err
          }
        },
        async all(...params) {
          try {
            const res = await pool.query(converted, params)
            return res.rows
          } catch (err) {
            if (!isProduction && isConnectionError(err)) {
              console.warn('Postgres unavailable, using local SQLite for this request.')
              return localDb.prepare(sql).all(...params)
            }
            throw err
          }
        },
      }
      return statement
    },
  }
}

export default db
