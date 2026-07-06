import crypto from "crypto";
import db from "../../lib/db";

async function ensureFolderExists(folderName) {
  const normalizedFolder = (folderName || "General").trim() || "General";
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

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const {
    id,
    word,
    meaning,
    example = "",
    status = "new",
    tags = [],
    folder = "General",
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

  try {
    const stmt = db.prepare(`
      INSERT INTO words
      (id, word, meaning, example, status, tags, folder, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    await stmt.run(
      newId,
      word.trim(),
      meaning.trim(),
      example.trim(),
      status,
      normalizedTags,
      normalizedFolder,
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
      created_at: now,
      updated_at: now,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Database error",
      details: err.message,
    });
  }
}