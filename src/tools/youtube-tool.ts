import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { youtubeToMarkdown } from "../converters/youtube.js";
import {
  YOUTUBE_CHUNK_SECONDS_DEFAULT,
  YOUTUBE_CHUNK_SECONDS_MAX,
  YOUTUBE_CHUNK_SECONDS_MIN,
} from "../shared/constants.js";
import { runTool } from "./run-tool.js";

const DEFAULT_LANG = "en";

/** Read-only, but talks to YouTube and results can change over time. */
export const YOUTUBE_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export function registerYoutubeTool(server: McpServer): void {
  server.registerTool(
    "youtube_to_markdown",
    {
      title: "YouTube transcript to Markdown",
      description:
        "Fetch the transcript of a YouTube video and return it as timestamped Markdown. Accepts a YouTube URL or video ID.",
      inputSchema: {
        url: z
          .string()
          .describe(
            "YouTube video URL (e.g. https://www.youtube.com/watch?v=...) or 11-character video ID"
          ),
        lang: z
          .string()
          .optional()
          .default(DEFAULT_LANG)
          .describe(
            `Preferred transcript language code (e.g. 'en', 'id'). Defaults to '${DEFAULT_LANG}'.`
          ),
        chunkSeconds: z
          .number()
          .min(YOUTUBE_CHUNK_SECONDS_MIN)
          .max(YOUTUBE_CHUNK_SECONDS_MAX)
          .optional()
          .default(YOUTUBE_CHUNK_SECONDS_DEFAULT)
          .describe(
            `Seconds of transcript to group per paragraph (${YOUTUBE_CHUNK_SECONDS_MIN}-${YOUTUBE_CHUNK_SECONDS_MAX}). Defaults to ${YOUTUBE_CHUNK_SECONDS_DEFAULT}.`
          ),
      },
      annotations: YOUTUBE_TOOL_ANNOTATIONS,
    },
    async ({ url, lang, chunkSeconds }) =>
      runTool(() =>
        youtubeToMarkdown(
          url,
          lang ?? DEFAULT_LANG,
          chunkSeconds ?? YOUTUBE_CHUNK_SECONDS_DEFAULT
        )
      )
  );
}
