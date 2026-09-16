import { fetchPronunciationAudio } from "./pronounce-audio.mjs";

export default async function handler(req, res) {
  const word = Array.isArray(req.query?.word) ? req.query.word[0] : req.query?.word;
  const result = await fetchPronunciationAudio(word);

  if (!result) {
    res.status(404).end();
    return;
  }

  res.setHeader("Content-Type", result.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).send(Buffer.from(result.bytes));
}
