import process from 'process'
import { Pool } from 'pg'

const DATABASE_URL = process.env.DATABASE_URL
const APP_ENV = process.env.APP_ENV || process.env.NODE_ENV || 'development'
const isProduction = APP_ENV === 'production'

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

// Lightweight in-memory fallback for local dev (no native modules)
function createInMemoryDb() {
  const store = new Map()

  function nowISO() {
    return new Date().toISOString()
  }

  return {
    prepare(sql) {
      const s = sql.trim().toUpperCase()

      if (s.startsWith('SELECT * FROM WORDS ORDER BY')) {
        return {
          async all() {
            return Array.from(store.values()).sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
          },
        }
      }

      if (s.startsWith('SELECT * FROM WORDS WHERE ID =')) {
        return {
          async get(id) {
            return store.get(id)
          },
        }
      }

      if (s.startsWith('INSERT INTO WORDS')) {
        return {
          async run(id, word, meaning, example, status, tags, created_at, updated_at) {
            const row = {
              id,
              word,
              meaning,
              example,
              status,
              tags,
              created_at: created_at || nowISO(),
              updated_at: updated_at || nowISO(),
            }
            store.set(id, row)
            return { lastInsertRowid: id }
          },
        }
      }

      if (s.startsWith('UPDATE WORDS SET')) {
        return {
          async run(word, meaning, example, status, tags, updated_at, id) {
            const existing = store.get(id)
            if (!existing) return { changes: 0 }
            const updated = {
              ...existing,
              word,
              meaning,
              example,
              status,
              tags,
              updated_at: updated_at || nowISO(),
            }
            store.set(id, updated)
            return { changes: 1 }
          },
        }
      }

      if (s.startsWith('DELETE FROM WORDS WHERE ID =')) {
        return {
          async run(id) {
            const existed = store.delete(id)
            return { changes: existed ? 1 : 0 }
          },
        }
      }

      // Fallback: return no-op handlers
      return {
        async run() {
          return null
        },
        async get() {
          return null
        },
        async all() {
          return []
        },
      }
    },
  }
}

let db

const forceLocal = APP_ENV === 'local'
const forceProduction = APP_ENV === 'production'

if (forceLocal) {
  db = createInMemoryDb()
} else if (forceProduction && !DATABASE_URL) {
  throw new Error('APP_ENV=production requires DATABASE_URL to be set')
} else if (!DATABASE_URL) {
  db = createInMemoryDb()
} else {
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
      return {
        async run(...params) {
          try {
            return await pool.query(converted, params)
          } catch (err) {
            if (!isProduction && isConnectionError(err)) {
              console.warn('Postgres unavailable, using local SQLite for this request.')
              return createInMemoryDb().prepare(sql).run(...params)
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
              return createInMemoryDb().prepare(sql).get(...params)
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
              return createInMemoryDb().prepare(sql).all(...params)
            }
            throw err
          }
        },
      }
    },
  }
}

export default db
