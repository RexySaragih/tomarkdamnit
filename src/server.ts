import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { pdfToMarkdown } from "./converters/pdf.js";
import { docxToMarkdown } from "./converters/docx.js";
import { xlsxToMarkdown } from "./converters/xlsx.js";
import { pptxToMarkdown } from "./converters/pptx.js";
import { youtubeToMarkdown } from "./converters/youtube.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "tomarkdamnit",
    version: "1.0.0",
  });

  // PDF → Markdown
  server.tool(
    "pdf_to_markdown",
    "Convert a PDF file to Markdown text. Extracts all text content from the PDF and formats it as Markdown.",
    {
      filepath: z
        .string()
        .describe("Absolute path to the PDF file on disk"),
    },
    async ({ filepath }) => {
      const markdown = await pdfToMarkdown(filepath);
      return {
        content: [{ type: "text", text: markdown }],
      };
    }
  );

  // DOCX → Markdown
  server.tool(
    "docx_to_markdown",
    "Convert a DOCX (Microsoft Word) file to Markdown. Preserves headings, bold, italic, lists, and tables.",
    {
      filepath: z
        .string()
        .describe("Absolute path to the DOCX file on disk"),
    },
    async ({ filepath }) => {
      const markdown = await docxToMarkdown(filepath);
      return {
        content: [{ type: "text", text: markdown }],
      };
    }
  );

  // XLSX / XLS → Markdown
  server.tool(
    "xlsx_to_markdown",
    "Convert an XLSX or XLS (Microsoft Excel) file to Markdown. Each sheet becomes a Markdown table.",
    {
      filepath: z
        .string()
        .describe("Absolute path to the XLSX or XLS file on disk"),
    },
    async ({ filepath }) => {
      const markdown = xlsxToMarkdown(filepath);
      return {
        content: [{ type: "text", text: markdown }],
      };
    }
  );

  // PPTX → Markdown
  server.tool(
    "pptx_to_markdown",
    "Convert a PPTX (Microsoft PowerPoint) file to Markdown text. Extracts slide titles and body content.",
    {
      filepath: z
        .string()
        .describe("Absolute path to the PPTX file on disk"),
    },
    async ({ filepath }) => {
      const markdown = await pptxToMarkdown(filepath);
      return {
        content: [{ type: "text", text: markdown }],
      };
    }
  );

  // YouTube → Markdown transcript
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
    },
    async ({ url, lang }) => {
      const markdown = await youtubeToMarkdown(url, lang ?? "en");
      return {
        content: [{ type: "text", text: markdown }],
      };
    }
  );

  return server;
}
