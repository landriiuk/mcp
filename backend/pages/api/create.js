import db from '../../lib/db'

function normalizeRow(row) {
  return {
    ...row,
    tags: row.tags ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

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
  await stmt.run(newId, word.trim(), meaning.trim(), example.trim(), status, normalizedTags, now, now)

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
