import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { docxToMarkdown } from "../converters/docx.js";
import { pdfToMarkdown } from "../converters/pdf.js";
import { pptxToMarkdown } from "../converters/pptx.js";
import { xlsxToMarkdown } from "../converters/xlsx.js";
import { runTool } from "./run-tool.js";

interface FileToolDefinition {
  name: string;
  title: string;
  description: string;
  fileLabel: string;
  convert: (filepath: string) => Promise<string>;
}

/** Local file reads: no side effects, same input gives same output, no network. */
export const FILE_TOOL_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const FILE_TOOLS: FileToolDefinition[] = [
  {
    name: "pdf_to_markdown",
    title: "PDF to Markdown",
    description:
      "Extract plain text from a PDF file and return it as Markdown. Does not reconstruct layout or OCR scanned pages.",
    fileLabel: "PDF",
    convert: pdfToMarkdown,
  },
  {
    name: "docx_to_markdown",
    title: "DOCX to Markdown",
    description:
      "Convert a DOCX (Microsoft Word) file to Markdown. Preserves headings, bold, italic, lists, and tables.",
    fileLabel: "DOCX",
    convert: docxToMarkdown,
  },
  {
    name: "xlsx_to_markdown",
    title: "Excel to Markdown",
    description:
      "Convert an XLSX/XLSM/XLS workbook to Markdown. Each sheet becomes a Markdown table (row/column caps apply).",
    fileLabel: "XLSX, XLSM, or legacy XLS",
    convert: xlsxToMarkdown,
  },
  {
    name: "pptx_to_markdown",
    title: "PowerPoint to Markdown",
    description:
      "Convert a PPTX (Microsoft PowerPoint) file to Markdown. Extracts slide text runs and speaker notes when present.",
    fileLabel: "PPTX",
    convert: pptxToMarkdown,
  },
];

export function registerFileTools(server: McpServer): void {
  for (const tool of FILE_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: {
          filepath: z
            .string()
            .describe(`Absolute path to the ${tool.fileLabel} file on disk`),
        },
        annotations: FILE_TOOL_ANNOTATIONS,
      },
      async ({ filepath }) => runTool(() => tool.convert(filepath))
    );
  }
}
