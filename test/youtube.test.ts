import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import * as transcriptModule from "youtube-transcript";

type FetchTranscript = typeof transcriptModule.YoutubeTranscript.fetchTranscript;

const VIDEO_ID = "dQw4w9WgXcQ";
let fetchTranscript: ReturnType<typeof mock<FetchTranscript>>;

mock.module("youtube-transcript", () => ({
  ...transcriptModule,
  YoutubeTranscript: {
    fetchTranscript: (...args: Parameters<FetchTranscript>) => fetchTranscript(...args),
  },
}));

const { youtubeToMarkdown, getProxyAgent } = await import("../src/converters/youtube.ts");

function segments(lang: string) {
  return [
    { text: "hello", offset: 0, duration: 1000, lang },
    { text: "world", offset: 40_000, duration: 1000, lang },
  ];
}

const PROXY_VARS = ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const name of PROXY_VARS) {
    savedEnv[name] = process.env[name];
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of PROXY_VARS) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

describe("youtubeToMarkdown", () => {
  test("reports the requested language when it is available", async () => {
    fetchTranscript = mock<FetchTranscript>(async () => segments("id"));
    const md = await youtubeToMarkdown(VIDEO_ID, "id", 30);

    expect(md).toContain("**Language:** id\n");
    expect(md).toContain("**[0:00]** hello");
    expect(md).toContain("**[0:40]** world");
    expect(fetchTranscript.mock.calls[0][1]?.lang).toBe("id");
  });

  test("falls back to the default track and says so", async () => {
    fetchTranscript = mock<FetchTranscript>(async (_id, config) => {
      if (config?.lang) {
        throw new transcriptModule.YoutubeTranscriptNotAvailableLanguageError(
          config.lang,
          ["en"],
          VIDEO_ID
        );
      }
      return segments("en");
    });
    const md = await youtubeToMarkdown(VIDEO_ID, "id", 30);

    expect(md).toContain('**Language:** en (requested "id" is not available)');
    expect(fetchTranscript).toHaveBeenCalledTimes(2);
  });

  test("does not retry other errors as a language fallback", async () => {
    fetchTranscript = mock<FetchTranscript>(async () => {
      throw new transcriptModule.YoutubeTranscriptDisabledError(VIDEO_ID);
    });
    await expect(youtubeToMarkdown(VIDEO_ID, "en", 30)).rejects.toThrow(
      /Failed to fetch YouTube transcript/
    );
    expect(fetchTranscript).toHaveBeenCalledTimes(1);
  });

  test("turns timeouts into a clear message", async () => {
    fetchTranscript = mock<FetchTranscript>(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    await expect(youtubeToMarkdown(VIDEO_ID, "en", 30)).rejects.toThrow(/timed out after/);
  });

  test("adds a proxy hint to network errors when no proxy is set", async () => {
    fetchTranscript = mock<FetchTranscript>(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(youtubeToMarkdown(VIDEO_ID, "en", 30)).rejects.toThrow(/set the HTTPS_PROXY/);
  });

  test("returns a notice when the transcript is empty", async () => {
    fetchTranscript = mock<FetchTranscript>(async () => []);
    expect(await youtubeToMarkdown(VIDEO_ID, "en", 30)).toBe(
      "_No transcript available for this video._"
    );
  });
});

describe("getProxyAgent", () => {
  test("reuses one agent per proxy URL", () => {
    const first = getProxyAgent("http://proxy.local:8080");
    expect(getProxyAgent("http://proxy.local:8080")).toBe(first);
    expect(getProxyAgent("http://other.local:8080")).not.toBe(first);
  });
});
