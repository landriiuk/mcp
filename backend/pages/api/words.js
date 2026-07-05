import crypto from "crypto";
import db from "../../lib/db";

function normalizeRow(row) {
  return {
    ...row,
    tags: row.tags
      ? row.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method === "GET") {
      const rows = await db
        .prepare("SELECT * FROM words ORDER BY created_at DESC")
        .all();

      return res.status(200).json(rows.map(normalizeRow));
    }

    if (req.method === "POST") {
      const {
        id,
        word,
        meaning,
        example = "",
        status = "new",
        tags = [],
      } = req.body || {};

      if (!word?.trim() || !meaning?.trim()) {
        return res.status(400).json({
          error: "Word and meaning are required.",
        });
      }

      const now = new Date().toISOString();
      const newId = id || crypto.randomUUID();
      const normalizedTags = Array.isArray(tags)
        ? tags.filter(Boolean).join(",")
        : "";

      const stmt = db.prepare(`
        INSERT INTO words
        (id, word, meaning, example, status, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.run(
        newId,
        word.trim(),
        meaning.trim(),
        example.trim(),
        status,
        normalizedTags,
        now,
        now
      );

      return res.status(201).json({
        id: newId,
        word: word.trim(),
        meaning: meaning.trim(),
        example: example.trim(),
        status,
        tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
        created_at: now,
        updated_at: now,
      });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(405)
      .end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
}