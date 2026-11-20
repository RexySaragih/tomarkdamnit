const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
]);

export function extractVideoId(input: string): string {
  const trimmed = input.trim();

  if (VIDEO_ID_RE.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();

    if (!YOUTUBE_HOSTS.has(host)) {
      throw new Error("unsupported host");
    }

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      if (VIDEO_ID_RE.test(id)) return id;
    } else {
      const v = url.searchParams.get("v");
      if (v && VIDEO_ID_RE.test(v)) return v;

      const pathMatch = url.pathname.match(
        /\/(?:shorts|embed|live|clip)\/([a-zA-Z0-9_-]{11})/
      );
      if (pathMatch) return pathMatch[1];
    }
  } catch {
    // Not a valid URL or unsupported host — fall through
  }

  throw new Error(
    `Cannot extract a YouTube video ID from: "${input}". ` +
      `Provide a full YouTube URL or an 11-character video ID.`
  );
}

export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
