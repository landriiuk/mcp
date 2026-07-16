import db from '../../../lib/db'

function normalizeRow(row) {
  return {
    ...row,
    tags: row.tags ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
    folder: row.folder ?? '',
    interval_days: Number(row.interval_days) || 0,
    next_review_at: row.next_review_at
      ? typeof row.next_review_at === 'string'
        ? row.next_review_at
        : new Date(row.next_review_at).toISOString()
      : null,
  }
}

function normalizeReviewFields(_status, intervalDays, nextReviewAt) {
  // Known cards keep interval_days + next_review_at for decay maintenance.
  return {
    interval_days: Number(intervalDays) || 0,
    next_review_at: nextReviewAt ?? null,
  }
}

async function ensureFolderExists(folderName) {
  const normalizedFolder = (folderName || '').trim()
  if (!normalizedFolder) {
    return ''
  }

  const existing = await db.prepare('SELECT name FROM folders WHERE name = ?').get(normalizedFolder)

  if (existing) {
    return normalizedFolder
  }

  await db.prepare('INSERT INTO folders (name) VALUES (?)').run(normalizedFolder)
  return normalizedFolder
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'Word ID is required.' })
  }

  if (req.method === 'PUT') {
    const {
      word,
      meaning,
      example = '',
      status = 'new',
      tags = [],
      folder = '',
      interval_days = 0,
      next_review_at = null,
    } = req.body || {}

    if (!word?.trim() || !meaning?.trim()) {
      return res.status(400).json({ error: 'Word and meaning are required.' })
    }

    const existing = await db.prepare('SELECT * FROM words WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Word not found.' })
    }

    const normalizedTags = Array.isArray(tags) ? tags.filter(Boolean).join(',') : ''
    const normalizedFolder = await ensureFolderExists(folder)
    const review = normalizeReviewFields(status, interval_days, next_review_at)
    const now = new Date().toISOString()

    await db.prepare(
      `UPDATE words SET word = ?, meaning = ?, example = ?, status = ?, tags = ?, folder = ?, interval_days = ?, next_review_at = ?, updated_at = ? WHERE id = ?`,
    ).run(
      word.trim(),
      meaning.trim(),
      example.trim(),
      status,
      normalizedTags,
      normalizedFolder,
      review.interval_days,
      review.next_review_at,
      now,
      id,
    )

    const updated = await db.prepare('SELECT * FROM words WHERE id = ?').get(id)
    return res.status(200).json(normalizeRow(updated))
  }

  if (req.method === 'DELETE') {
    const existing = await db.prepare('SELECT * FROM words WHERE id = ?').get(id)
    if (!existing) {
      return res.status(404).json({ error: 'Word not found.' })
    }

    await db.prepare('DELETE FROM words WHERE id = ?').run(id)
    return res.status(204).end()
  }

  res.setHeader('Allow', ['PUT', 'DELETE'])
  res.status(405).end(`Method ${req.method} Not Allowed`)
}
