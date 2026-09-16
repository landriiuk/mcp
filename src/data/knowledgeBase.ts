export type KnowledgeArticle = {
  slug: string;
  title: string;
  summary: string;
  body: string[];
};

export const KNOWLEDGE_BASE_PATH = "/knowledge";

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    slug: "overview",
    title: "What InkLex is",
    summary: "Personal English vocabulary desk: cards, folders, and short practice.",
    body: [
      "InkLex is a vocabulary desk. People save their own words as cards, group them into folders, and practice in short sessions.",
      "Statuses are new, learning, and known. There is no system folder named General. Empty folder means the card only appears under All.",
      "Production data lives under users/{uid}/words and users/{uid}/folders. Mock local mode uses localStorage and never talks to Firebase.",
    ],
  },
  {
    slug: "cards-and-folders",
    title: "Cards and folders",
    summary: "Folder names, URLs, drag-and-drop, and what All means.",
    body: [
      "Folder names are 1–50 characters. Create and rename happen inline in the sidebar. Enter saves; Escape or click outside cancels. Errors show below the input.",
      "All is /. A folder URL is /:encodedFolderId (base64url of the folder id). The sidebar still shows the folder name.",
      "Drag a card onto a folder, or onto the Cards / Learning / Known tabs to change status. Deleting a folder clears the folder field on its cards; the cards stay under All.",
      "Mobile (≤1024px): the burger opens folders from the top. Backdrop, Escape, ×, or picking a folder closes it.",
    ],
  },
  {
    slug: "csv-import",
    title: "CSV import",
    summary: "Required columns and what happens after a successful upload.",
    body: [
      "Columns: word, meaning, example, status, tags, folder. word and meaning are required.",
      "status may be new, learning, or known. Anything else becomes new. tags is a string; folder is a display name that InkLex matches or creates.",
      "Preview shows the first 5 rows, then “+ N more rows”. On success the modal closes and the app opens the folder that appears most often in the file.",
    ],
  },
  {
    slug: "practice",
    title: "Learning, Quest, and Review",
    summary: "How decks are built and how a card becomes Known.",
    body: [
      "From All, Start Learning opens a folder picker. From a folder it goes to /:encodedFolderId/learning. Practice always runs inside one folder.",
      "Quest / Reverse / Typed use new and learning cards only, max 10, due first, then the rest. Known cards stay out of Quest. Reverse Quest needs at least 3 words.",
      "Again resets the streak immediately. Good or Easy adds 1 to the streak. After 3 correct in a row the card becomes Known. Review is flip plus Bad / Good / Easy for every word in the folder.",
      "Typed Quest does not auto-advance on a wrong answer. It shows the answer and waits for Continue.",
      "Each finished Quest / Reverse / Typed session (N/N) adds one to the user’s quest count in the database. Ending early does not count.",
    ],
  },
  {
    slug: "quick-add",
    title: "Quick add and clipboard",
    summary: "Capture a word from a folder without opening the full editor.",
    body: [
      "Quick add is available inside a folder, not on All. Required fields are Word and Meaning. Example is optional. Status is always new.",
      "Paste accepts a single word, or word — meaning / tab-separated pairs. The full card editor remains for tags, folder moves, and richer edits.",
    ],
  },
  {
    slug: "sharing",
    title: "Shared folders",
    summary: "Public snapshots versus students-only links.",
    body: [
      "A share publishes an immutable snapshot. The public URL is /share/{shareId}. Anyone with a public link can preview it.",
      "Teachers can also publish students-only links. Only the owner and students linked to that teacher can open those snapshots.",
      "Visibility is fixed at publish time. Older snapshots without a visibility field stay public.",
    ],
  },
  {
    slug: "roles",
    title: "Roles and students",
    summary: "Student, teacher, admin, and how invites work.",
    body: [
      "Every new account is a student. The app never shows that label. Teachers invite students and can create student-only folder links. Admins assign roles and can use teacher tools.",
      "Users cannot pick a role. To become a teacher they email andriukluba@gmail.com. An admin then assigns teacher on /admin.",
      "A teacher opens /teacher, enters the student’s email, and copies a 7-day invite link. The student must sign in with that exact email and accept /invite/{inviteId}.",
      "Removing a student immediately cuts access to that teacher’s students-only links. A student may belong to more than one teacher.",
    ],
  },
  {
    slug: "pronunciation",
    title: "Word pronunciation",
    summary: "Same-origin audio proxy and browser speech fallback.",
    body: [
      "The speaker button requests /inklex-pronounce?word=… so the browser never reads Google or Oxford files directly (that triggered CORB).",
      "Locally, Vite serves that path. In production Vercel rewrites it to /api/pronounce. The server tries Oxford US audio, then Google TTS, and the client falls back to speechSynthesis.",
    ],
  },
  {
    slug: "ops",
    title: "Auth, mock data, and first admin",
    summary: "How to run locally, migrate leftover words, and bootstrap admin.",
    body: [
      "Local default is VITE_USE_MOCK_DB=true. Open /?clearDb=1 to wipe mock data. Never put the mock or emulator flags on Vercel.",
      "Legacy words without an account lived in global words and folders. Copy them with npm run migrate:auth -- --uid UID --project inklex-be. Dry-run first, then --apply. Keep --delete-source for later.",
      "The first admin is assigned with npm run set:role -- --uid UID --role admin --project inklex-be --apply. Sign out and back in after the role change.",
    ],
  },
];

export function getKnowledgeArticle(slug: string | undefined) {
  if (!slug) {
    return KNOWLEDGE_ARTICLES[0];
  }
  return KNOWLEDGE_ARTICLES.find((article) => article.slug === slug) ?? null;
}
