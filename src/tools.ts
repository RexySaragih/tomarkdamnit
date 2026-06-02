export const PDFToMarkdownTool = {
  name: "pdf_to_markdown",
  description:
    "Convert a PDF file to Markdown text. Extracts all text content from the PDF and formats it as Markdown.",
  inputSchema: {
    type: "object",
    properties: {
      filepath: {
        type: "string",
        description: "Absolute path to the PDF file on disk",
      },
    },
    required: ["filepath"],
  },
} as const;

export const DocxToMarkdownTool = {
  name: "docx_to_markdown",
  description:
    "Convert a DOCX (Microsoft Word) file to Markdown text. Preserves headings, bold, italic, lists, and tables.",
  inputSchema: {
    type: "object",
    properties: {
      filepath: {
        type: "string",
        description: "Absolute path to the DOCX file on disk",
      },
    },
    required: ["filepath"],
  },
} as const;

export const XlsxToMarkdownTool = {
  name: "xlsx_to_markdown",
  description:
    "Convert an XLSX or XLS (Microsoft Excel) file to Markdown. Each sheet becomes a Markdown table.",
  inputSchema: {
    type: "object",
    properties: {
      filepath: {
        type: "string",
        description: "Absolute path to the XLSX or XLS file on disk",
      },
    },
    required: ["filepath"],
  },
} as const;

export const PptxToMarkdownTool = {
  name: "pptx_to_markdown",
  description:
    "Convert a PPTX (Microsoft PowerPoint) file to Markdown text. Extracts slide titles and body content.",
  inputSchema: {
    type: "object",
    properties: {
      filepath: {
        type: "string",
        description: "Absolute path to the PPTX file on disk",
      },
    },
    required: ["filepath"],
  },
} as const;

export const YouTubeToMarkdownTool = {
  name: "youtube_to_markdown",
  description:
    "Fetch the transcript of a YouTube video and return it as Markdown. Accepts a YouTube URL or video ID.",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description:
          "YouTube video URL (e.g. https://www.youtube.com/watch?v=...) or video ID",
      },
      lang: {
        type: "string",
        description:
          "Preferred transcript language code (e.g. 'en', 'id'). Defaults to 'en'.",
      },
    },
    required: ["url"],
  },
} as const;
