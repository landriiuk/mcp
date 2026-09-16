const MAX_WORD_LENGTH = 80;

function pronunciationUrls(word) {
  const encoded = encodeURIComponent(word);
  const urls = [];

  if (/^[a-z]+(?:'[a-z]+)?$/i.test(word)) {
    urls.push(`https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encoded}--_us_1.mp3`);
  }

  urls.push(
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en-US&q=${encoded}`,
  );

  return urls;
}

export async function fetchPronunciationAudio(word) {
  const key = String(word ?? "")
    .trim()
    .toLowerCase()
    .slice(0, MAX_WORD_LENGTH);

  if (!key) {
    return null;
  }

  for (const url of pronunciationUrls(key)) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        redirect: "follow",
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("audio")) {
        continue;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 400) {
        continue;
      }

      return {
        bytes,
        contentType: contentType.split(";")[0] || "audio/mpeg",
      };
    } catch {
      continue;
    }
  }

  return null;
}

export async function handlePronounceRequest(req, res) {
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const result = await fetchPronunciationAudio(requestUrl.searchParams.get("word"));

  if (!result) {
    res.statusCode = 404;
    res.end();
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(Buffer.from(result.bytes));
}
