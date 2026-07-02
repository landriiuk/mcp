import db from '../../lib/db'

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

function normalizeRow(row) {
  return {
    ...row,
    tags: row.tags ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
  }
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    const rows = db.prepare('SELECT * FROM words ORDER BY created_at DESC').all()
    return res.status(200).json(rows.map(normalizeRow))
  }

  if (req.method === 'POST') {
    const { id, word, meaning, example = '', status = 'new', tags = [] } = req.body || {}

    if (!word?.trim() || !meaning?.trim()) {
      return res.status(400).json({ error: 'Word and meaning are required.' })
    }

    const now = new Date().toISOString()
    const normalizedTags = Array.isArray(tags) ? tags.filter(Boolean).join(',') : ''
    const newId = id || crypto.randomUUID()

    const stmt = db.prepare(
      `INSERT INTO words (id, word, meaning, example, status, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    stmt.run(newId, word.trim(), meaning.trim(), example.trim(), status, normalizedTags, now, now)

    return res.status(201).json({
      id: newId,
      word: word.trim(),
      meaning: meaning.trim(),
      example: example.trim(),
      status,
      tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
      created_at: now,
      updated_at: now,
    })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
