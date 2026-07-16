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
    folder: row.folder ?? "",
    interval_days: Number(row.interval_days) || 0,
    next_review_at: row.next_review_at || null,
  };
}

function normalizeReviewFields(_status, intervalDays, nextReviewAt) {
  // Known cards keep interval_days + next_review_at for decay maintenance.
  return {
    interval_days: Number(intervalDays) || 0,
    next_review_at: nextReviewAt || null,
  };
}

async function ensureFolderExists(folderName) {
  const normalizedFolder = (folderName || "").trim();
  if (!normalizedFolder) {
    return "";
  }

  const existing = await db.prepare("SELECT name FROM folders WHERE name = ?").get(normalizedFolder);

  if (existing) {
    return normalizedFolder;
  }

  await db.prepare("INSERT INTO folders (name) VALUES (?)").run(normalizedFolder);
  return normalizedFolder;
}

export default async function handler(req, res) {
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
        folder = "",
        interval_days = 0,
        next_review_at = null,
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
      const normalizedFolder = await ensureFolderExists(folder);
      const review = normalizeReviewFields(status, interval_days, next_review_at);

      const stmt = db.prepare(`
        INSERT INTO words
        (id, word, meaning, example, status, tags, folder, interval_days, next_review_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      await stmt.run(
        newId,
        word.trim(),
        meaning.trim(),
        example.trim(),
        status,
        normalizedTags,
        normalizedFolder,
        review.interval_days,
        review.next_review_at,
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
        folder: normalizedFolder,
        interval_days: review.interval_days,
        next_review_at: review.next_review_at,
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
