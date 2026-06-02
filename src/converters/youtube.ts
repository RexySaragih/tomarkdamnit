import { YoutubeTranscript } from "youtube-transcript";
import { HttpsProxyAgent } from "https-proxy-agent";

function extractVideoId(input: string): string {
  // Already a bare video ID (11 chars, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);

    // Standard: https://www.youtube.com/watch?v=VIDEO_ID
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;

      // Shorts: https://www.youtube.com/shorts/VIDEO_ID
      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];

      // Embed: https://www.youtube.com/embed/VIDEO_ID
      const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];
    }

    // Shortened: https://youtu.be/VIDEO_ID
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace("/", "");
      if (id) return id;
    }
  } catch {
    // Not a valid URL — fall through
  }

  throw new Error(
    `Cannot extract a YouTube video ID from: "${input}". ` +
      `Provide a full YouTube URL or an 11-character video ID.`
  );
}

/**
 * Build a proxy-aware fetch function if HTTPS_PROXY or https_proxy is set.
 * Falls back to the global fetch if no proxy is configured.
 */
function buildFetch(): typeof fetch {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (!proxyUrl) {
    return fetch;
  }

  const agent = new HttpsProxyAgent(proxyUrl);

  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return fetch(input, { ...init, dispatcher: agent } as any);
  };
}

export async function youtubeToMarkdown(
  urlOrId: string,
  lang = "en"
): Promise<string> {
  const videoId = extractVideoId(urlOrId);
  const fetchFn = buildFetch();

  let segments: { text: string; offset: number; duration: number }[];

  try {
    segments = await YoutubeTranscript.fetchTranscript(videoId, {
      lang,
      fetch: fetchFn,
    });
  } catch (err: any) {
    // If preferred language not found, retry without language preference
    if (
      err?.message?.includes("Could not find") ||
      err?.message?.includes("No transcript") ||
      err?.message?.includes("not available")
    ) {
      try {
        segments = await YoutubeTranscript.fetchTranscript(videoId, {
          fetch: fetchFn,
        });
      } catch (fallbackErr: any) {
        throw new Error(
          `Could not fetch transcript for video "${videoId}": ${fallbackErr?.message ?? fallbackErr}`
        );
      }
    } else {
      const isNetworkError =
        err?.message?.includes("fetch failed") ||
        err?.message?.includes("ECONNRESET") ||
        err?.message?.includes("ETIMEDOUT") ||
        err?.message?.includes("Connect Timeout") ||
        err?.message?.includes("certificate");

      if (isNetworkError) {
        const proxyHint = !(
          process.env.HTTPS_PROXY ||
          process.env.https_proxy ||
          process.env.HTTP_PROXY ||
          process.env.http_proxy
        )
          ? " If YouTube is blocked on your network, set the HTTPS_PROXY environment variable to route traffic through a proxy."
          : " The configured proxy may be unreachable or rejecting the connection.";

        throw new Error(
          `Failed to reach YouTube for video "${videoId}". This is likely a network/firewall issue.${proxyHint}`
        );
      }

      throw new Error(
        `Failed to fetch YouTube transcript for "${videoId}": ${err?.message ?? err}`
      );
    }
  }

  if (!segments || segments.length === 0) {
    return "_No transcript available for this video._";
  }

  // Format as timestamped markdown paragraphs
  // Group segments into ~30-second chunks for readability
  const chunks: { timestamp: string; text: string }[] = [];
  let chunkText = "";
  let chunkStart = segments[0].offset;
  const CHUNK_DURATION_MS = 30_000;

  for (const seg of segments) {
    const elapsed = seg.offset - chunkStart;
    if (elapsed >= CHUNK_DURATION_MS && chunkText.trim()) {
      chunks.push({
        timestamp: formatTimestamp(chunkStart),
        text: chunkText.trim(),
      });
      chunkText = seg.text;
      chunkStart = seg.offset;
    } else {
      chunkText += (chunkText ? " " : "") + seg.text;
    }
  }
  if (chunkText.trim()) {
    chunks.push({
      timestamp: formatTimestamp(chunkStart),
      text: chunkText.trim(),
    });
  }

  const header = `# YouTube Transcript\n\n**Video ID:** ${videoId}  \n**URL:** https://www.youtube.com/watch?v=${videoId}\n\n---\n\n`;

  const body = chunks.map((c) => `**[${c.timestamp}]** ${c.text}`).join("\n\n");

  return header + body;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
