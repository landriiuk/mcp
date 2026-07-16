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

function createInMemoryDb() {
  const wordStore = new Map()
  const folderStore = new Map()

  function nowISO() {
    return new Date().toISOString()
  }

  return {
    prepare(sql) {
      const s = sql.trim().toUpperCase()

      if (s.startsWith('SELECT * FROM WORDS ORDER BY')) {
        return {
          async all() {
            return Array.from(wordStore.values()).sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
          },
        }
      }

      if (s.startsWith('SELECT * FROM WORDS WHERE ID =')) {
        return {
          async get(id) {
            return wordStore.get(id)
          },
        }
      }

      if (s.startsWith('SELECT NAME FROM FOLDERS ORDER BY')) {
        return {
          async all() {
            return Array.from(folderStore.values()).map((folder) => ({ name: folder.name }))
          },
        }
      }

      if (s.startsWith('SELECT NAME FROM FOLDERS WHERE NAME =')) {
        return {
          async get(name) {
            return folderStore.get(name) ? { name } : null
          },
        }
      }

      if (s.startsWith('SELECT FOLDER AS NAME, COUNT(*) AS COUNT FROM WORDS GROUP BY FOLDER')) {
        return {
          async all() {
            const grouped = new Map()
            for (const row of wordStore.values()) {
              const folderName = row.folder ?? ''
              if (!folderName) {
                continue
              }
              grouped.set(folderName, (grouped.get(folderName) || 0) + 1)
            }
            return Array.from(grouped.entries()).map(([name, count]) => ({ name, count }))
          },
        }
      }

      if (s.startsWith('INSERT INTO WORDS')) {
        return {
          async run(
            id,
            word,
            meaning,
            example,
            status,
            tags,
            folder,
            interval_days,
            next_review_at,
            created_at,
            updated_at,
          ) {
            const row = {
              id,
              word,
              meaning,
              example,
              status,
              tags,
              folder: typeof folder === 'string' ? folder : folder || 'General',
              interval_days: Number(interval_days) || 0,
              next_review_at: next_review_at ?? null,
              created_at: created_at || nowISO(),
              updated_at: updated_at || nowISO(),
            }
            wordStore.set(id, row)
            return { lastInsertRowid: id }
          },
        }
      }

      if (s.startsWith('UPDATE WORDS SET WORD =')) {
        return {
          async run(
            word,
            meaning,
            example,
            status,
            tags,
            folder,
            interval_days,
            next_review_at,
            updated_at,
            id,
          ) {
            const existing = wordStore.get(id)
            if (!existing) return { changes: 0 }
            const updated = {
              ...existing,
              word,
              meaning,
              example,
              status,
              tags,
              folder: typeof folder === 'string' ? folder : folder || 'General',
              interval_days: Number(interval_days) || 0,
              next_review_at: next_review_at ?? null,
              updated_at: updated_at || nowISO(),
            }
            wordStore.set(id, updated)
            return { changes: 1 }
          },
        }
      }

      if (s.startsWith('DELETE FROM WORDS WHERE ID =')) {
        return {
          async run(id) {
            const existed = wordStore.delete(id)
            return { changes: existed ? 1 : 0 }
          },
        }
      }

      if (s.startsWith('INSERT INTO FOLDERS')) {
        return {
          async run(name) {
            folderStore.set(name, { name })
            return { changes: 1 }
          },
        }
      }

      if (s.startsWith('UPDATE FOLDERS SET')) {
        return {
          async run(newName, oldName) {
            const existing = folderStore.get(oldName)
            if (!existing) return { changes: 0 }
            folderStore.delete(oldName)
            folderStore.set(newName, { name: newName })
            return { changes: 1 }
          },
        }
      }

      if (s.startsWith('UPDATE WORDS SET FOLDER =')) {
        return {
          async run(newFolder, oldFolder) {
            for (const [id, row] of wordStore.entries()) {
              if (row.folder === oldFolder) {
                wordStore.set(id, { ...row, folder: newFolder })
              }
            }
            return { changes: 1 }
          },
        }
      }

      if (s.startsWith('DELETE FROM FOLDERS WHERE NAME =')) {
        return {
          async run(name) {
            const existed = folderStore.delete(name)
            return { changes: existed ? 1 : 0 }
          },
        }
      }

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
let postgresDisabled = false

const globalStore = globalThis

function getSharedInMemoryDb() {
  // Next.js can evaluate this module per route; bind to globalThis so all
  // handlers share one in-memory store in local/dev mock mode.
  if (!globalStore.__inklexInMemoryDb) {
    globalStore.__inklexInMemoryDb = createInMemoryDb()
    console.warn('Using shared in-memory database.')
  }
  return globalStore.__inklexInMemoryDb
}

function disablePostgres(err) {
  if (!isProduction && isConnectionError(err)) {
    if (!postgresDisabled) {
      postgresDisabled = true
      console.warn('Postgres unavailable; switching to shared in-memory database for this process.')
    }
    return true
  }
  return false
}

function runWithFallback(sql, operation, params) {
  if (postgresDisabled) {
    return getSharedInMemoryDb().prepare(sql)[operation](...params)
  }

  return null
}

const forceLocal = APP_ENV === 'local'
const forceProduction = APP_ENV === 'production'

if (forceLocal) {
  db = getSharedInMemoryDb()
} else if (forceProduction && !DATABASE_URL) {
  throw new Error('APP_ENV=production requires DATABASE_URL to be set')
} else if (!DATABASE_URL) {
  db = getSharedInMemoryDb()
} else {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  async function ensurePostgresSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS folders (
        name TEXT PRIMARY KEY
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS words (
        id TEXT PRIMARY KEY,
        word TEXT NOT NULL,
        meaning TEXT NOT NULL,
        example TEXT,
        status TEXT NOT NULL,
        tags TEXT,
        folder TEXT NOT NULL DEFAULT 'General',
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `)

    await pool.query(`
      ALTER TABLE words
      ADD COLUMN IF NOT EXISTS folder TEXT NOT NULL DEFAULT 'General'
    `)

    await pool.query(`
      ALTER TABLE words
      ADD COLUMN IF NOT EXISTS interval_days INTEGER NOT NULL DEFAULT 0
    `)

    await pool.query(`
      ALTER TABLE words
      ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ
    `)
  }

  ensurePostgresSchema().catch((err) => {
    if (disablePostgres(err)) {
      console.warn('Postgres unavailable in development; using shared in-memory database.')
      return
    }

    console.error('Failed to initialize Postgres schema:', err.message || err)
    if (isProduction) {
      throw err
    }
  })

  db = {
    prepare(sql) {
      const converted = convertPlaceholders(sql)
      return {
        async run(...params) {
          const fallbackResult = runWithFallback(sql, 'run', params)
          if (fallbackResult) {
            return fallbackResult
          }

          try {
            return await pool.query(converted, params)
          } catch (err) {
            if (disablePostgres(err)) {
              return getSharedInMemoryDb().prepare(sql).run(...params)
            }
            throw err
          }
        },
        async get(...params) {
          const fallbackResult = runWithFallback(sql, 'get', params)
          if (fallbackResult) {
            return fallbackResult
          }

          try {
            const res = await pool.query(converted, params)
            return res.rows[0]
          } catch (err) {
            if (disablePostgres(err)) {
              return getSharedInMemoryDb().prepare(sql).get(...params)
            }
            throw err
          }
        },
        async all(...params) {
          const fallbackResult = runWithFallback(sql, 'all', params)
          if (fallbackResult) {
            return fallbackResult
          }

          try {
            const res = await pool.query(converted, params)
            return res.rows
          } catch (err) {
            if (disablePostgres(err)) {
              return getSharedInMemoryDb().prepare(sql).all(...params)
            }
            throw err
          }
        },
      }
    },
  }
}

export default db
