import crypto from "crypto";
import db from "../../../lib/db";

const VALID_STATUSES = new Set(["new", "learning", "known"]);

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.filter(Boolean).join(",");
  }

  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .join(",");
  }

  return "";
}

function normalizeRow(row) {
  return {
    ...row,
    tags: row.tags
      ? row.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [],
    folder: row.folder || "",
    interval_days: Number(row.interval_days) || 0,
    next_review_at: row.next_review_at || null,
  };
}

async function ensureFolderExists(folderName) {
  const normalizedFolder = (folderName || "").trim();
  if (!normalizedFolder) {
    return "";
  }
  const existing = await db
    .prepare("SELECT name FROM folders WHERE name = ?")
    .get(normalizedFolder);

  if (existing) {
    return normalizedFolder;
  }

  await db.prepare("INSERT INTO folders (name) VALUES (?)").run(normalizedFolder);
  return normalizedFolder;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { words } = req.body || {};

  if (!Array.isArray(words) || words.length === 0) {
    return res.status(400).json({
      error: "Provide a non-empty words array.",
    });
  }

  const stmt = db.prepare(`
    INSERT INTO words
    (id, word, meaning, example, status, tags, folder, interval_days, next_review_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const created = [];
  const errors = [];

  for (let index = 0; index < words.length; index += 1) {
    const entry = words[index] || {};
    const word = entry.word?.trim();
    const meaning = entry.meaning?.trim();

    if (!word || !meaning) {
      errors.push({
        row: index + 1,
        error: "Word and meaning are required.",
      });
      continue;
    }

    const status = VALID_STATUSES.has(entry.status) ? entry.status : "new";
    const example = (entry.example || "").trim();
    const normalizedTags = normalizeTags(entry.tags);
    const folder = await ensureFolderExists(entry.folder || "");
    const now = new Date().toISOString();
    const newId = crypto.randomUUID();
    const interval_days = 0;
    const next_review_at = null;

    try {
      await stmt.run(
        newId,
        word,
        meaning,
        example,
        status,
        normalizedTags,
        folder,
        interval_days,
        next_review_at,
        now,
        now
      );

      created.push(
        normalizeRow({
          id: newId,
          word,
          meaning,
          example,
          status,
          tags: normalizedTags,
          folder,
          interval_days,
          next_review_at,
          created_at: now,
          updated_at: now,
        })
      );
    } catch (err) {
      errors.push({
        row: index + 1,
        error: err.message || "Failed to import row.",
      });
    }
  }

  return res.status(201).json({
    imported: created.length,
    skipped: errors.length,
    words: created,
    errors,
  });
}
