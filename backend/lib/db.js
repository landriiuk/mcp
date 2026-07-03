import path from 'path'
import process from 'process'

const DATABASE_URL = process.env.DATABASE_URL

function convertPlaceholders(sql) {
  let i = 0
  return sql.replace(/\?/g, () => {
    i += 1
    return `$${i}`
  })
}

if (DATABASE_URL) {
  // Use Postgres when DATABASE_URL is provided
  import('pg').then(({ Pool }) => {
    const pool = new Pool({ connectionString: DATABASE_URL })

    async function ensureSchema() {
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

      const res = await pool.query('SELECT COUNT(*)::int AS count FROM words')
      const count = res.rows[0].count
      if (count === 0) {
        const sampleWords = [
          {
            id: 'brief',
            word: 'brief',
            meaning: 'short in time, duration, or length',
            example: 'Keep the update brief and useful.',
            status: 'learning',
            tags: ['work'],
          },
          {
            id: 'accurate',
            word: 'accurate',
            meaning: 'correct and without mistakes',
            example: 'The report has accurate numbers.',
            status: 'new',
            tags: ['writing'],
          },
          {
            id: 'smooth',
            word: 'smooth',
            meaning: 'easy and without problems or interruptions',
            example: 'The meeting had a smooth start.',
            status: 'known',
            tags: ['speaking'],
          },
        ]

        for (const item of sampleWords) {
          const now = new Date().toISOString()
          const sql = convertPlaceholders(
            `INSERT INTO words (id, word, meaning, example, status, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          await pool.query(sql, [
            item.id,
            item.word,
            item.meaning,
            item.example,
            item.status,
            item.tags.join(','),
            now,
            now,
          ])
        }
      }
    }

    ensureSchema().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to initialize Postgres schema:', err)
    })

    const db = {
      prepare(sql) {
        const converted = convertPlaceholders(sql)
        return {
          async run(...params) {
            return pool.query(converted, params)
          },
          async get(...params) {
            const res = await pool.query(converted, params)
            return res.rows[0]
          },
          async all(...params) {
            const res = await pool.query(converted, params)
            return res.rows
          },
        }
      },
    }

    // export default for ESM consumers
    // eslint-disable-next-line import/no-default-export
    module.exports = db
  })
} else {
  // Fallback to SQLite for local development if DATABASE_URL is not set
  const Database = require('better-sqlite3')

  const dbPath = path.join(process.cwd(), 'db', 'words.db')
  const sqliteDb = new Database(dbPath)

  sqliteDb.pragma('journal_mode = WAL')
  sqliteDb.prepare(`
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
  `).run()

  const count = sqliteDb.prepare('SELECT COUNT(*) AS count FROM words').get().count

  if (count === 0) {
    const sampleWords = [
      {
        id: 'brief',
        word: 'brief',
        meaning: 'short in time, duration, or length',
        example: 'Keep the update brief and useful.',
        status: 'learning',
        tags: ['work'],
      },
      {
        id: 'accurate',
        word: 'accurate',
        meaning: 'correct and without mistakes',
        example: 'The report has accurate numbers.',
        status: 'new',
        tags: ['writing'],
      },
      {
        id: 'smooth',
        word: 'smooth',
        meaning: 'easy and without problems or interruptions',
        example: 'The meeting had a smooth start.',
        status: 'known',
        tags: ['speaking'],
      },
    ]

    const insert = sqliteDb.prepare(
      `INSERT INTO words (id, word, meaning, example, status, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )

    const now = new Date().toISOString()
    const transaction = sqliteDb.transaction((items) => {
      for (const item of items) {
        insert.run(
          item.id,
          item.word,
          item.meaning,
          item.example,
          item.status,
          item.tags.join(','),
          now,
          now,
        )
      }
    })

    transaction(sampleWords)
  }

  module.exports = sqliteDb
}
