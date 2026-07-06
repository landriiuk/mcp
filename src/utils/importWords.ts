export type CardStatus = "new" | "learning" | "known";

export type ImportWordRow = {
  word: string;
  meaning: string;
  example: string;
  status: CardStatus;
  tags: string;
  folder: string;
};

export type ParsedImportResult = {
  rows: ImportWordRow[];
  errors: string[];
};

export const IMPORT_COLUMNS = [
  "word",
  "meaning",
  "example",
  "status",
  "tags",
  "folder",
] as const;

export const IMPORT_TEMPLATE = `${IMPORT_COLUMNS.join(",")}
brief,short in time duration or length,Keep the update brief and useful.,learning,work,Work
accurate,correct and without mistakes,The report has accurate numbers.,new,writing,Study`;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function mapStatus(value: string): CardStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === "learning" || normalized === "known") {
    return normalized;
  }
  return "new";
}

function rowFromValues(values: string[], columnMap: Record<string, number>): ImportWordRow | null {
  const read = (column: (typeof IMPORT_COLUMNS)[number]) =>
    values[columnMap[column]]?.trim() ?? "";

  const word = read("word");
  const meaning = read("meaning");

  if (!word && !meaning) {
    return null;
  }

  return {
    word,
    meaning,
    example: read("example"),
    status: mapStatus(read("status")),
    tags: read("tags"),
    folder: read("folder") || "General",
  };
}

export function parseWordsTable(content: string): ParsedImportResult {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ["File is empty."] };
  }

  const firstValues = parseCsvLine(lines[0]);
  const headerIndexes = IMPORT_COLUMNS.reduce<Record<string, number>>((accumulator, column) => {
    const headerIndex = firstValues.findIndex(
      (value) => normalizeHeader(value) === column,
    );
    if (headerIndex >= 0) {
      accumulator[column] = headerIndex;
    }
    return accumulator;
  }, {});

  const hasHeader = "word" in headerIndexes && "meaning" in headerIndexes;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const columnMap: Record<string, number> = hasHeader
    ? headerIndexes
    : {
        word: 0,
        meaning: 1,
        example: 2,
        status: 3,
        tags: 4,
        folder: 5,
      };

  const rows: ImportWordRow[] = [];
  const errors: string[] = [];

  dataLines.forEach((line, index) => {
    const values = parseCsvLine(line);
    const row = rowFromValues(values, columnMap);

    if (!row) {
      return;
    }

    if (!row.word || !row.meaning) {
      errors.push(`Row ${index + (hasHeader ? 2 : 1)}: word and meaning are required.`);
      return;
    }

    rows.push(row);
  });

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No valid rows found.");
  }

  return { rows, errors };
}

export function downloadImportTemplate() {
  const blob = new Blob([IMPORT_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "wordly-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}
