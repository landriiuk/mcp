import db from "../../lib/db";

function normalizeFolderName(value) {
  return (value || "").trim().replace(/\s+/g, " ");
}

const FOLDER_NAME_MAX_LENGTH = 50;

function validateFolderName(name) {
  if (!name) {
    return "Folder name is required.";
  }

  if (name.length > FOLDER_NAME_MAX_LENGTH) {
    return `Folder name must be ${FOLDER_NAME_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const rows = await db.prepare("SELECT name FROM folders ORDER BY name ASC").all();
    return res.status(200).json(rows.map((row) => row.name));
  }

  if (req.method === "POST") {
    const name = normalizeFolderName(req.body?.name);
    const validationError = validateFolderName(name);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    if (name.toLowerCase() === "general") {
      return res.status(400).json({ error: '"General" is reserved. Choose another name.' });
    }

    const existing = await db.prepare("SELECT name FROM folders WHERE name = ?").get(name);
    if (existing) {
      return res.status(409).json({ error: "Folder already exists." });
    }

    await db.prepare("INSERT INTO folders (name) VALUES (?)").run(name);
    return res.status(201).json({ name });
  }

  if (req.method === "PUT") {
    const oldName = normalizeFolderName(req.body?.oldName);
    const newName = normalizeFolderName(req.body?.newName);
    const validationError = validateFolderName(newName);

    if (!oldName || validationError) {
      return res.status(400).json({ error: validationError || "Folder names are required." });
    }

    const existing = await db.prepare("SELECT name FROM folders WHERE name = ?").get(newName);
    if (existing && existing.name !== oldName) {
      return res.status(409).json({ error: "Folder already exists." });
    }

    await db.prepare("UPDATE folders SET name = ? WHERE name = ?").run(newName, oldName);
    await db.prepare("UPDATE words SET folder = ? WHERE folder = ?").run(newName, oldName);
    return res.status(200).json({ name: newName });
  }

  if (req.method === "DELETE") {
    const name = normalizeFolderName(req.body?.name);

    if (!name) {
      return res.status(400).json({ error: "Folder name is required." });
    }

    await db.prepare("DELETE FROM folders WHERE name = ?").run(name);
    await db.prepare("UPDATE words SET folder = ? WHERE folder = ?").run("", name);
    return res.status(200).json({ deleted: name });
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}
