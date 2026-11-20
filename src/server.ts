import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { pdfToMarkdown } from "./converters/pdf.js";
import { docxToMarkdown } from "./converters/docx.js";
import { xlsxToMarkdown } from "./converters/xlsx.js";
import { pptxToMarkdown } from "./converters/pptx.js";
import { youtubeToMarkdown } from "./converters/youtube.js";
import {
  DEBUG_ENV,
  PACKAGE_VERSION,
  YOUTUBE_CHUNK_SECONDS_DEFAULT,
  YOUTUBE_CHUNK_SECONDS_MAX,
  YOUTUBE_CHUNK_SECONDS_MIN,
} from "./shared/constants.js";
import { envFlag } from "./shared/env.js";
import { toToolError } from "./shared/errors.js";
import { truncateMarkdown } from "./shared/markdown.js";
import { getToolSemaphore } from "./shared/semaphore.js";

async function runTool(
  work: () => Promise<string>
): Promise<
  | { content: [{ type: "text"; text: string }] }
  | { content: [{ type: "text"; text: string }]; isError: true }
> {
  const release = await getToolSemaphore().acquire();
  try {
    const markdown = truncateMarkdown(await work());
    return {
      content: [{ type: "text", text: markdown }],
    };
  } catch (error: unknown) {
    if (envFlag(DEBUG_ENV)) {
      console.error("[tomarkdamnit]", error);
    }
    return toToolError(error);
  } finally {
    release();
  }
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "tomarkdamnit",
    version: PACKAGE_VERSION,
  });

  server.tool(
    "pdf_to_markdown",
    "Extract plain text from a PDF file and return it as Markdown. Does not reconstruct layout or OCR scanned pages.",
    {
      filepath: z
        .string()
        .describe("Absolute path to the PDF file on disk"),
    },
    async ({ filepath }) => runTool(() => pdfToMarkdown(filepath))
  );

  server.tool(
    "docx_to_markdown",
    "Convert a DOCX (Microsoft Word) file to Markdown. Preserves headings, bold, italic, lists, and tables.",
    {
      filepath: z
        .string()
        .describe("Absolute path to the DOCX file on disk"),
    },
    async ({ filepath }) => runTool(() => docxToMarkdown(filepath))
  );

  server.tool(
    "xlsx_to_markdown",
    "Convert an XLSX/XLSM/XLS workbook to Markdown. Each sheet becomes a Markdown table (row/column caps apply).",
    {
      filepath: z
        .string()
        .describe("Absolute path to the XLSX, XLSM, or legacy XLS file on disk"),
    },
    async ({ filepath }) => runTool(() => xlsxToMarkdown(filepath))
  );

  server.tool(
    "pptx_to_markdown",
    "Convert a PPTX (Microsoft PowerPoint) file to Markdown. Extracts slide text runs and speaker notes when present.",
    {
      filepath: z
        .string()
        .describe("Absolute path to the PPTX file on disk"),
    },
    async ({ filepath }) => runTool(() => pptxToMarkdown(filepath))
  );

  server.tool(
    "youtube_to_markdown",
    "Fetch the transcript of a YouTube video and return it as timestamped Markdown. Accepts a YouTube URL or video ID.",
    {
      url: z
        .string()
        .describe(
          "YouTube video URL (e.g. https://www.youtube.com/watch?v=...) or 11-character video ID"
        ),
      lang: z
        .string()
        .optional()
        .default("en")
        .describe(
          "Preferred transcript language code (e.g. 'en', 'id'). Defaults to 'en'."
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
    async ({ url, lang, chunkSeconds }) =>
      runTool(() =>
        youtubeToMarkdown(
          url,
          lang ?? "en",
          chunkSeconds ?? YOUTUBE_CHUNK_SECONDS_DEFAULT
        )
      )
  );

  return server;
}
