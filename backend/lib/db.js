import Database from 'better-sqlite3'
import path from 'path'
import process from 'process'

const dbPath = path.join(process.cwd(), 'db', 'words.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.prepare(`
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

const count = db.prepare('SELECT COUNT(*) AS count FROM words').get().count

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

  const insert = db.prepare(
    `INSERT INTO words (id, word, meaning, example, status, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  const now = new Date().toISOString()
  const transaction = db.transaction((items) => {
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

export default db
