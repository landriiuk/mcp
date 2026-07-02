import db from '../../../lib/db'

function normalizeRow(row) {
  return {
    ...row,
    tags: row.tags ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
  }
}

export default function handler(req, res) {
  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'Word ID is required.' })
  }

  if (req.method === 'PUT') {
    const { word, meaning, example = '', status = 'new', tags = [] } = req.body || {}

    if (!word?.trim() || !meaning?.trim()) {
      return res.status(400).json({ error: 'Word and meaning are required.' })
    }

    const existing = db.prepare('SELECT * FROM words WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Word not found.' })
    }

    const normalizedTags = Array.isArray(tags) ? tags.filter(Boolean).join(',') : ''
    const now = new Date().toISOString()

    db.prepare(
      `UPDATE words SET word = ?, meaning = ?, example = ?, status = ?, tags = ?, updated_at = ? WHERE id = ?`,
    ).run(word.trim(), meaning.trim(), example.trim(), status, normalizedTags, now, id)

    const updated = db.prepare('SELECT * FROM words WHERE id = ?').get(id)
    return res.status(200).json(normalizeRow(updated))
  }

  if (req.method === 'DELETE') {
    const existing = db.prepare('SELECT id FROM words WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Word not found.' })
    }

    db.prepare('DELETE FROM words WHERE id = ?').run(id)
    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
