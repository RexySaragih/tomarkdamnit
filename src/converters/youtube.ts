import { YoutubeTranscript } from "youtube-transcript";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import {
  getYoutubeTimeoutMs,
  YOUTUBE_CHUNK_SECONDS_DEFAULT,
} from "../shared/constants.js";
import { extractVideoId, formatTimestamp } from "../shared/youtube-url.js";

export { extractVideoId, formatTimestamp } from "../shared/youtube-url.js";

interface TranscriptSegment {
  text: string;
  offset: number;
  duration: number;
}

function getProxyUrl(): string | undefined {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    undefined
  );
}

function buildFetch(): typeof fetch {
  const proxyUrl = getProxyUrl();
  const timeoutMs = getYoutubeTimeoutMs();

  const withTimeout = (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const signal = AbortSignal.timeout(timeoutMs);
    const merged: RequestInit = {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, signal])
        : signal,
    };

    if (!proxyUrl) {
      return fetch(input, merged);
    }

    const agent = new ProxyAgent(proxyUrl);
    return undiciFetch(
      input as Parameters<typeof undiciFetch>[0],
      {
        ...(merged as object),
        dispatcher: agent,
      } as Parameters<typeof undiciFetch>[1]
    ) as unknown as Promise<Response>;
  };

  return withTimeout as typeof fetch;
}

function isLanguageMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Could not find") ||
    message.includes("No transcript") ||
    message.includes("not available")
  );
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.name === "TimeoutError") return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("TimeoutError") ||
    message.includes("The operation was aborted") ||
    message.includes("aborted due to timeout")
  );
}

function isNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("fetch failed") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("Connect Timeout") ||
    message.includes("certificate")
  );
}

async function fetchSegments(
  videoId: string,
  lang: string,
  fetchFn: typeof fetch
): Promise<TranscriptSegment[]> {
  try {
    return await YoutubeTranscript.fetchTranscript(videoId, {
      lang,
      fetch: fetchFn,
    });
  } catch (err: unknown) {
    if (isTimeoutError(err)) {
      const seconds = Math.round(getYoutubeTimeoutMs() / 1000);
      throw new Error(
        `YouTube transcript fetch timed out after ${seconds}s for video "${videoId}".`
      );
    }

    if (!isLanguageMissingError(err)) {
      if (isNetworkError(err)) {
        const proxyHint = !getProxyUrl()
          ? " If YouTube is blocked on your network, set the HTTPS_PROXY environment variable to route traffic through a proxy."
          : " The configured proxy may be unreachable or rejecting the connection.";
        throw new Error(
          `Failed to reach YouTube for video "${videoId}". This is likely a network/firewall issue.${proxyHint}`
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to fetch YouTube transcript for "${videoId}": ${message}`
      );
    }

    try {
      return await YoutubeTranscript.fetchTranscript(videoId, {
        fetch: fetchFn,
      });
    } catch (fallbackErr: unknown) {
      if (isTimeoutError(fallbackErr)) {
        const seconds = Math.round(getYoutubeTimeoutMs() / 1000);
        throw new Error(
          `YouTube transcript fetch timed out after ${seconds}s for video "${videoId}".`
        );
      }
      const message =
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      throw new Error(
        `Could not fetch transcript for video "${videoId}": ${message}`
      );
    }
  }
}

function formatChunks(
  segments: TranscriptSegment[],
  chunkSeconds: number
): string {
  const chunkDurationMs = chunkSeconds * 1000;
  const chunks: { timestamp: string; text: string }[] = [];
  let chunkText = "";
  let chunkStart = segments[0].offset;

  for (const seg of segments) {
    const elapsed = seg.offset - chunkStart;
    if (elapsed >= chunkDurationMs && chunkText.trim()) {
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

  return chunks.map((c) => `**[${c.timestamp}]** ${c.text}`).join("\n\n");
}

export async function youtubeToMarkdown(
  urlOrId: string,
  lang = "en",
  chunkSeconds = YOUTUBE_CHUNK_SECONDS_DEFAULT
): Promise<string> {
  const videoId = extractVideoId(urlOrId);
  const fetchFn = buildFetch();
  const segments = await fetchSegments(videoId, lang, fetchFn);

  if (!segments || segments.length === 0) {
    return "_No transcript available for this video._";
  }

  const safeChunkSeconds =
    Number.isFinite(chunkSeconds) && chunkSeconds > 0
      ? chunkSeconds
      : YOUTUBE_CHUNK_SECONDS_DEFAULT;

  const header = `# YouTube Transcript\n\n**Video ID:** ${videoId}  \n**URL:** https://www.youtube.com/watch?v=${videoId}\n\n---\n\n`;
  const body = formatChunks(segments, safeChunkSeconds);

  return header + body;
}
