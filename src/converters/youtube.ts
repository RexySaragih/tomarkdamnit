import {
  YoutubeTranscript,
  YoutubeTranscriptNotAvailableLanguageError,
  type TranscriptResponse,
} from "youtube-transcript";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import {
  getYoutubeTimeoutMs,
  YOUTUBE_CHUNK_SECONDS_DEFAULT,
} from "../shared/constants.js";
import { errorMessage } from "../shared/errors.js";
import { extractVideoId, formatTimestamp } from "../shared/youtube-url.js";

export { extractVideoId, formatTimestamp } from "../shared/youtube-url.js";

interface TranscriptResult {
  segments: TranscriptResponse[];
  requestedLang: string;
  usedFallback: boolean;
}

const MS_PER_SECOND = 1000;
const NETWORK_ERROR_MARKERS = [
  "fetch failed",
  "ECONNRESET",
  "ETIMEDOUT",
  "Connect Timeout",
  "certificate",
];
const TIMEOUT_ERROR_MARKERS = [
  "TimeoutError",
  "The operation was aborted",
  "aborted due to timeout",
];

let cachedAgent: { url: string; agent: ProxyAgent } | undefined;

function getProxyUrl(): string | undefined {
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    undefined
  );
}

/** One connection pool per proxy URL; creating an agent per request leaks sockets. */
export function getProxyAgent(proxyUrl: string): ProxyAgent {
  if (cachedAgent?.url !== proxyUrl) {
    cachedAgent = { url: proxyUrl, agent: new ProxyAgent(proxyUrl) };
  }
  return cachedAgent.agent;
}

function buildFetch(): typeof fetch {
  const proxyUrl = getProxyUrl();
  const timeoutMs = getYoutubeTimeoutMs();

  const withTimeout = (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const merged: RequestInit = { ...init, signal };
    if (!proxyUrl) return fetch(input, merged);

    return undiciFetch(
      input as Parameters<typeof undiciFetch>[0],
      {
        ...(merged as object),
        dispatcher: getProxyAgent(proxyUrl),
      } as Parameters<typeof undiciFetch>[1]
    ) as unknown as Promise<Response>;
  };

  return withTimeout as typeof fetch;
}

function messageHasAny(error: unknown, markers: string[]): boolean {
  const message = errorMessage(error);
  return markers.some((marker) => message.includes(marker));
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.name === "TimeoutError") return true;
  return messageHasAny(error, TIMEOUT_ERROR_MARKERS);
}

function normalizeFetchError(error: unknown, videoId: string): Error {
  if (isTimeoutError(error)) {
    const seconds = Math.round(getYoutubeTimeoutMs() / MS_PER_SECOND);
    return new Error(
      `YouTube transcript fetch timed out after ${seconds}s for video "${videoId}".`
    );
  }
  if (messageHasAny(error, NETWORK_ERROR_MARKERS)) {
    const proxyHint = getProxyUrl()
      ? " The configured proxy may be unreachable or rejecting the connection."
      : " If YouTube is blocked on your network, set the HTTPS_PROXY environment variable to route traffic through a proxy.";
    return new Error(
      `Failed to reach YouTube for video "${videoId}". This is likely a network/firewall issue.${proxyHint}`
    );
  }
  return new Error(
    `Failed to fetch YouTube transcript for "${videoId}": ${errorMessage(error)}`
  );
}

async function fetchSegments(
  videoId: string,
  lang: string,
  fetchFn: typeof fetch
): Promise<TranscriptResult> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang, fetch: fetchFn });
    return { segments, requestedLang: lang, usedFallback: false };
  } catch (error: unknown) {
    if (!(error instanceof YoutubeTranscriptNotAvailableLanguageError)) {
      throw normalizeFetchError(error, videoId);
    }
  }

  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { fetch: fetchFn });
    return { segments, requestedLang: lang, usedFallback: true };
  } catch (error: unknown) {
    throw normalizeFetchError(error, videoId);
  }
}

function formatChunks(
  segments: TranscriptResponse[],
  chunkSeconds: number
): string {
  const chunkDurationMs = chunkSeconds * MS_PER_SECOND;
  const chunks: { timestamp: string; text: string }[] = [];
  let chunkText = "";
  let chunkStart = segments[0].offset;

  for (const seg of segments) {
    const elapsed = seg.offset - chunkStart;
    if (elapsed >= chunkDurationMs && chunkText.trim()) {
      chunks.push({ timestamp: formatTimestamp(chunkStart), text: chunkText.trim() });
      chunkText = seg.text;
      chunkStart = seg.offset;
    } else {
      chunkText += (chunkText ? " " : "") + seg.text;
    }
  }

  if (chunkText.trim()) {
    chunks.push({ timestamp: formatTimestamp(chunkStart), text: chunkText.trim() });
  }

  return chunks.map((c) => `**[${c.timestamp}]** ${c.text}`).join("\n\n");
}

function languageLine(result: TranscriptResult): string {
  const actual = result.segments[0]?.lang ?? "unknown";
  if (!result.usedFallback) return `**Language:** ${actual}`;
  return `**Language:** ${actual} (requested "${result.requestedLang}" is not available)`;
}

export async function youtubeToMarkdown(
  urlOrId: string,
  lang = "en",
  chunkSeconds = YOUTUBE_CHUNK_SECONDS_DEFAULT
): Promise<string> {
  const videoId = extractVideoId(urlOrId);
  const result = await fetchSegments(videoId, lang, buildFetch());

  if (result.segments.length === 0) {
    return "_No transcript available for this video._";
  }

  const safeChunkSeconds =
    Number.isFinite(chunkSeconds) && chunkSeconds > 0
      ? chunkSeconds
      : YOUTUBE_CHUNK_SECONDS_DEFAULT;

  const header = [
    "# YouTube Transcript",
    "",
    `**Video ID:** ${videoId}  `,
    `**URL:** https://www.youtube.com/watch?v=${videoId}  `,
    languageLine(result),
    "",
    "---",
    "",
    "",
  ].join("\n");

  return header + formatChunks(result.segments, safeChunkSeconds);
}
