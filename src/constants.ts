/** Always same-origin `/api` — Vite proxies locally, Vercel rewrites in production (avoids CORS). */
export const apiBaseUrl = "/api";


export const FOLDER_NAME_MAX_LENGTH = 50;
export const FOLDER_NAME_TOO_LONG_ERROR = `Folder name must be ${FOLDER_NAME_MAX_LENGTH} characters or fewer.`;
